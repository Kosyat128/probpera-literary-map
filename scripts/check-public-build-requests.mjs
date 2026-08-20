import { appendFile } from "node:fs/promises";
import { isMissingPublicationOutbox } from "./lib/cms-publication-head.mjs";

const supabaseUrl = (
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
).replace(/\/+$/u, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const outputPath = process.env.GITHUB_OUTPUT || "";
const finalizeArgument = process.argv.find((argument) =>
  argument.startsWith("--finalize=")
);

async function setOutput(name, value) {
  if (outputPath) await appendFile(outputPath, `${name}=${value}\n`, "utf8");
}

if (!supabaseUrl || !serviceKey) {
  if (process.env.GITHUB_ACTIONS === "true") {
    throw new Error(
      "Public build queue requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  console.log("Public build queue skipped: Supabase is not configured.");
  await setOutput("requested", "0");
  await setOutput("max_id", "");
  await setOutput("queue", "none");
  process.exit(0);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "content-type": "application/json",
};

async function request(path, options = {}) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
}

function normalizeId(value, label) {
  if (typeof value === "string" && /^\d+$/u.test(value)) return value;
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  ) {
    return String(value);
  }
  throw new Error(`${label} returned an unsafe or invalid bigint identifier.`);
}

async function jsonRows(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${await response.text()}`);
  }
  const value = await response.json();
  if (!Array.isArray(value)) throw new Error(`${label} returned a non-array body.`);
  return value;
}

async function hasOutbox() {
  const response = await request("public_build_outbox?select=id&limit=1");
  if (response.ok) return true;
  const body = await response.text();
  // PGRST205 is the normal schema-cache response for a missing relation. Do
  // not treat auth, RLS, network, or other API failures as an old schema.
  if (
    response.status === 404 &&
    isMissingPublicationOutbox(response.status, body)
  ) {
    return false;
  }
  throw new Error(`Public build outbox probe failed: ${response.status} ${body}`);
}

function parseFinalizeMarkers(rawMarker) {
  const markers = new Map();
  for (const token of rawMarker.split(",")) {
    const match = /^(outbox|legacy-audit):([1-9]\d*)$/u.exec(token);
    if (!match || markers.has(match[1])) {
      throw new Error("Invalid public build queue marker.");
    }
    markers.set(match[1], match[2]);
  }
  return markers;
}

async function finalizeOutbox(maxId) {
  const query = new URLSearchParams({
    id: `lte.${maxId}`,
    status: "in.(requested,dispatched,failed)",
  });
  const response = await request(`public_build_outbox?${query.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "deployed",
      deployed_at: new Date().toISOString(),
      deployment_run_id: process.env.GITHUB_RUN_ID || null,
      last_error: null,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Public build outbox finalization failed: ${response.status} ${await response.text()}`
    );
  }
  console.log(`Finalized transactional public builds through outbox ${maxId}.`);
}

async function finalizeLegacyAudit(maxId) {
  const markerQuery = new URLSearchParams({
    select: "entity_id",
    action: "eq.public_build.deployed",
    order: "id.desc",
    limit: "1",
  });
  const markers = await jsonRows(
    await request(`admin_audit_log?${markerQuery.toString()}`),
    "Legacy public build marker query"
  );
  const deployedId = /^\d+$/u.test(String(markers[0]?.entity_id || ""))
    ? String(markers[0].entity_id)
    : "0";
  if (BigInt(deployedId) >= BigInt(maxId)) {
    console.log(`Legacy public builds are already finalized through audit ${maxId}.`);
    return;
  }
  const response = await request("admin_audit_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_id: null,
      action: "public_build.deployed",
      entity_type: "deployment",
      entity_id: maxId,
      metadata: {
        source: "github-pages",
        run_id: process.env.GITHUB_RUN_ID || null,
        deployed_at: new Date().toISOString(),
      },
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Legacy public build finalization failed: ${response.status} ${await response.text()}`
    );
  }
  console.log(`Finalized legacy public build requests through audit ${maxId}.`);
}

if (finalizeArgument) {
  const rawMarker = finalizeArgument.slice("--finalize=".length).trim();
  // Queue IDs are unrelated sequences. A bare numeric marker must fail closed:
  // guessing its queue during a rollout could acknowledge content that was not
  // present in this deploy.
  const markers = parseFinalizeMarkers(rawMarker);

  if (markers.has("outbox")) await finalizeOutbox(markers.get("outbox"));
  if (markers.has("legacy-audit")) {
    await finalizeLegacyAudit(markers.get("legacy-audit"));
  }
  process.exit(0);
}

async function pendingOutboxRequests() {
  const query = new URLSearchParams({
    select: "id,status,entity_type,entity_id,requested_at",
    status: "in.(requested,dispatched,failed)",
    order: "id.asc",
    limit: "1000",
  });
  const requests = await jsonRows(
    await request(`public_build_outbox?${query.toString()}`),
    "Public build outbox query"
  );
  return {
    count: requests.length,
    maxId: requests.length
      ? normalizeId(requests.at(-1).id, "Public build outbox query")
      : "",
  };
}

async function pendingLegacyRequests() {
  const markerQuery = new URLSearchParams({
    select: "entity_id",
    action: "eq.public_build.deployed",
    order: "id.desc",
    limit: "1",
  });
  const markers = await jsonRows(
    await request(`admin_audit_log?${markerQuery.toString()}`),
    "Public build marker query"
  );
  const markerValue = String(markers[0]?.entity_id || "");
  const lastProcessedId = /^\d+$/u.test(markerValue) ? markerValue : "0";

  const requestQuery = new URLSearchParams({
    select: "id,action,entity_type,entity_id,created_at",
    action: "in.(public_build.requested,public_build.failed)",
    id: `gt.${lastProcessedId}`,
    order: "id.asc",
    limit: "1000",
  });
  const requests = await jsonRows(
    await request(`admin_audit_log?${requestQuery.toString()}`),
    "Public build request query"
  );
  return {
    count: requests.length,
    maxId: requests.length
      ? normalizeId(requests.at(-1).id, "Public build request query")
      : "",
  };
}

const outboxAvailable = await hasOutbox();
const outbox = outboxAvailable
  ? await pendingOutboxRequests()
  : { count: 0, maxId: "" };
// Keep draining compatibility records even after the migration appears. This
// closes the short PostgREST schema-cache window in which the admin can receive
// PGRST202 for the RPC while the scheduled worker can already see the table.
const legacy = await pendingLegacyRequests();
const marker = [
  outbox.maxId ? `outbox:${outbox.maxId}` : "",
  legacy.maxId ? `legacy-audit:${legacy.maxId}` : "",
]
  .filter(Boolean)
  .join(",");
const requestCount = outbox.count + legacy.count;
const queue = outboxAvailable
  ? legacy.count
    ? "outbox+legacy-audit"
    : "outbox"
  : "legacy-audit";

await setOutput("requested", requestCount ? "1" : "0");
await setOutput("max_id", marker);
await setOutput("queue", queue);
console.log(
  requestCount
    ? `Found ${requestCount} public build request(s): ${outbox.count} outbox, ${legacy.count} legacy; marker ${marker}.`
    : `No pending public build requests (${queue}).`
);
