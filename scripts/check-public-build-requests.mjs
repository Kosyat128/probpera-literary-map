import { appendFile } from "node:fs/promises";

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
  process.exit(0);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "content-type": "application/json",
};

if (finalizeArgument) {
  const maxId = finalizeArgument.slice("--finalize=".length).trim();
  if (!/^\d+$/u.test(maxId)) {
    throw new Error("Invalid public build queue marker.");
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/admin_audit_log`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
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
      `Public build finalization failed: ${response.status} ${await response.text()}`
    );
  }
  console.log(`Finalized public build requests through audit record ${maxId}.`);
  process.exit(0);
}

const markerQuery = new URLSearchParams({
  select: "entity_id",
  action: "eq.public_build.deployed",
  order: "id.desc",
  limit: "1",
});
const markerResponse = await fetch(
  `${supabaseUrl}/rest/v1/admin_audit_log?${markerQuery.toString()}`,
  { headers }
);
if (!markerResponse.ok) {
  throw new Error(
    `Public build marker query failed: ${markerResponse.status} ${await markerResponse.text()}`
  );
}
const markers = await markerResponse.json();
const lastProcessedId = /^\d+$/u.test(String(markers[0]?.entity_id || ""))
  ? Number(markers[0].entity_id)
  : 0;

const requestQuery = new URLSearchParams({
  select: "id,action,entity_type,entity_id,created_at",
  action: "in.(public_build.requested,public_build.failed)",
  id: `gt.${lastProcessedId}`,
  order: "id.asc",
  limit: "1000",
});
const requestResponse = await fetch(
  `${supabaseUrl}/rest/v1/admin_audit_log?${requestQuery.toString()}`,
  { headers }
);
if (!requestResponse.ok) {
  throw new Error(
    `Public build request query failed: ${requestResponse.status} ${await requestResponse.text()}`
  );
}
const requests = await requestResponse.json();
const maxId = requests.length ? String(requests.at(-1).id) : "";
await setOutput("requested", requests.length ? "1" : "0");
await setOutput("max_id", maxId);
console.log(
  requests.length
    ? `Found ${requests.length} pending public build request(s), through ${maxId}.`
    : "No pending public build requests."
);
