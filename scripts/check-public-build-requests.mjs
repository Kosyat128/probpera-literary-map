import { appendFile } from "node:fs/promises";
import { isMissingPublicationOutbox } from "./lib/cms-publication-head.mjs";
import { collectPendingOutboxIds, parsePendingOutboxIds, PENDING_OUTBOX_STATUS_FILTER } from "./lib/cms-outbox-acknowledgement.mjs";
import { trustedSupabaseOrigin } from "./lib/trusted-server-url.mjs";

const rawSupabaseUrl = (
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
).replace(/\/+$/u, "");
const supabaseUrl = rawSupabaseUrl ? trustedSupabaseOrigin(rawSupabaseUrl) : "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const outputPath = process.env.GITHUB_OUTPUT || "";
const finalizeArgument = process.argv.find((argument) =>
  argument.startsWith("--finalize=")
);
const captureOutbox = process.argv.includes("--capture-outbox");

if (captureOutbox && finalizeArgument) {
  throw new Error("Outbox capture and finalization must run separately.");
}

async function setOutput(name, value) {
  if (outputPath) await appendFile(outputPath, `${name}=${value}\n`, "utf8");
}

if (!supabaseUrl || !serviceKey) {
  if (process.env.GITHUB_ACTIONS === "true" || captureOutbox) {
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
    redirect: "error",
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

async function capturePendingOutbox() {
  const query = new URLSearchParams({
    select: "request_id:id::text",
    status: PENDING_OUTBOX_STATUS_FILTER,
    order: "id.desc",
    limit: "1",
  });
  const response = await request(`public_build_outbox?${query}`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    const body = await response.text();
    if (isMissingPublicationOutbox(response.status, body)) return [];
    throw new Error(`Pending outbox head capture failed: ${response.status} ${body}`);
  }
  const newest = await response.json();
  if (!Array.isArray(newest) || newest.length > 1) throw new Error("Invalid outbox head capture.");
  if (!newest.length) return [];
  return collectPendingOutboxIds({ supabaseUrl, serviceKey, outboxHighWater: newest[0]?.request_id });
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

async function finalizeOutbox(ids) {
  const batchSize = 100;
  const body = JSON.stringify({
    status: "deployed",
    deployed_at: new Date().toISOString(),
    deployment_run_id: process.env.GITHUB_RUN_ID || null,
    last_error: null,
  });
  // Commit order can differ from identity order. Acknowledge only the exact
  // requests seen before the export, never all IDs below its high-water mark.
  for (let offset = 0; offset < ids.length; offset += batchSize) {
    const query = new URLSearchParams({
      id: `in.(${ids.slice(offset, offset + batchSize).join(",")})`,
      status: PENDING_OUTBOX_STATUS_FILTER,
    });
    const response = await request(`public_build_outbox?${query}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      signal: AbortSignal.timeout(15_000),
      body,
    });
    if (!response.ok) {
      throw new Error(
        `Public build outbox finalization failed: ${response.status} ${await response.text()}`
      );
    }
  }
  console.log(`Processed ${ids.length} frozen transactional public build acknowledgements.`);
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

async function pendingRequests(table, pendingFilter, releaseFilter, label) {
  const query = new URLSearchParams({
    select: "id",
    order: "id.desc",
    limit: "1",
    ...pendingFilter,
  });
  const newest = await jsonRows(await request(`${table}?${query}`), label);
  if (newest.length === 0) return { maxId: "", requiresRelease: false };

  // Staged uploads belong in the next release's acknowledgement, but a new
  // unattached object does not change the current public content. Filter on
  // the server before limiting the result so staging cannot hide an older edit.
  const releaseQuery = new URLSearchParams(query);
  for (const [key, value] of Object.entries(releaseFilter)) {
    releaseQuery.set(key, value);
  }
  const releaseRequests = await jsonRows(
    await request(`${table}?${releaseQuery}`),
    `${label} release check`
  );
  return {
    maxId: normalizeId(newest[0].id, label),
    requiresRelease: releaseRequests.length > 0,
  };
}

function pendingOutboxRequests() {
  return pendingRequests(
    "public_build_outbox",
    { status: PENDING_OUTBOX_STATUS_FILTER },
    {
      and: "(not.and(entity_type.eq.media,reason.eq.media.uploaded),not.and(entity_type.eq.media_assets,reason.eq.database-insert))",
    },
    "Public build outbox query"
  );
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

  return pendingRequests(
    "admin_audit_log",
    {
      action: "in.(public_build.requested,public_build.failed)",
      id: `gt.${lastProcessedId}`,
    },
    {
      or: "(entity_type.neq.media,metadata->>reason.neq.media.uploaded,metadata->>reason.is.null)",
    },
    "Public build request query"
  );
}

async function reportPendingRequests() {
  const outboxAvailable = await hasOutbox();
  const outbox = outboxAvailable
    ? await pendingOutboxRequests()
    : { maxId: "", requiresRelease: false };
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
  const requiresRelease = outbox.requiresRelease || legacy.requiresRelease;
  const queue = outboxAvailable
    ? legacy.maxId
      ? "outbox+legacy-audit"
      : "outbox"
    : "legacy-audit";

  await setOutput("requested", requiresRelease ? "1" : "0");
  await setOutput("max_id", marker);
  await setOutput("queue", queue);
  if (requiresRelease) {
    console.log(`Pending requests require a public release (${queue}; marker ${marker}).`);
  } else if (marker) {
    console.log(`Staged media requests will be acknowledged by the next public release (${queue}; marker ${marker}).`);
  } else {
    console.log(`No pending public build requests (${queue}).`);
  }
}

if (captureOutbox) {
  const ids = await capturePendingOutbox();
  console.log(`pending_outbox_ids=${ids.join(",")}`);
} else if (finalizeArgument) {
  const rawMarker = finalizeArgument.slice("--finalize=".length).trim();
  // Queue IDs are unrelated sequences. A bare numeric marker must fail closed:
  // guessing its queue during a rollout could acknowledge content that was not
  // present in this deploy.
  const markers = parseFinalizeMarkers(rawMarker);
  const outboxIds = markers.has("outbox")
    ? parsePendingOutboxIds(process.env.CANDIDATE_PENDING_OUTBOX_IDS, markers.get("outbox"))
    : [];
  if (outboxIds.length) await finalizeOutbox(outboxIds);
  if (markers.has("legacy-audit")) {
    await finalizeLegacyAudit(markers.get("legacy-audit"));
  }
} else {
  await reportPendingRequests();
}
