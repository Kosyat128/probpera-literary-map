const DAY_MS = 86_400_000;

export const operationalRetentionRules = [
  {
    id: "resolved-client-errors",
    table: "client_errors",
    retentionDays: 90,
    filters: { status: "in.(resolved,ignored)" },
  },
  {
    id: "open-client-errors",
    table: "client_errors",
    retentionDays: 180,
    filters: { status: "eq.open" },
  },
  {
    id: "content-views",
    table: "content_views",
    retentionDays: 365,
    filters: {},
  },
];

export function retentionCutoff(retentionDays, now = new Date()) {
  if (!Number.isInteger(retentionDays) || retentionDays <= 0) {
    throw new Error("Retention days must be a positive integer.");
  }
  const timestamp = new Date(now).getTime();
  if (!Number.isFinite(timestamp)) throw new Error("Invalid retention clock.");
  return new Date(timestamp - retentionDays * DAY_MS).toISOString();
}

export function retentionDeletePath(rule, now = new Date()) {
  const query = new URLSearchParams();
  for (const [field, value] of Object.entries(rule.filters || {})) {
    query.set(field, value);
  }
  query.set("created_at", `lt.${retentionCutoff(rule.retentionDays, now)}`);
  return `${rule.table}?${query.toString()}`;
}

function deletedCount(response) {
  const total = response.headers.get("content-range")?.split("/").pop() || "";
  return /^\d+$/u.test(total) ? Number(total) : null;
}

export async function purgeOperationalData({
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
  apply = false,
} = {}) {
  const supabaseUrl = String(
    environment.SUPABASE_URL || environment.VITE_SUPABASE_URL || ""
  )
    .trim()
    .replace(/\/+$/u, "");
  const serviceKey = String(environment.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const operations = operationalRetentionRules.map((rule) => ({
    id: rule.id,
    table: rule.table,
    retentionDays: rule.retentionDays,
    path: retentionDeletePath(rule, now),
  }));

  if (!supabaseUrl || !serviceKey) {
    if (environment.GITHUB_ACTIONS === "true") {
      throw new Error(
        "Operational retention requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }
    return { applied: false, configured: false, operations };
  }

  if (!/^https:\/\//u.test(supabaseUrl)) {
    throw new Error("SUPABASE_URL must use HTTPS.");
  }

  if (!apply) return { applied: false, configured: true, operations };

  const results = [];
  for (const operation of operations) {
    const response = await fetchImpl(
      `${supabaseUrl}/rest/v1/${operation.path}`,
      {
        method: "DELETE",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "count=exact,return=minimal",
        },
        signal: AbortSignal.timeout(30_000),
      }
    );
    if (!response.ok) {
      throw new Error(
        `Operational retention failed for ${operation.id}: ${response.status} ${await response.text()}`
      );
    }
    results.push({ ...operation, deleted: deletedCount(response) });
  }

  return { applied: true, configured: true, operations: results };
}

const isDirectRun =
  process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isDirectRun) {
  const result = await purgeOperationalData({
    apply: process.argv.includes("--apply"),
  });
  console.log(JSON.stringify(result, null, 2));
}
