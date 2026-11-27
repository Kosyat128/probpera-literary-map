import { trustedSupabaseOrigin } from "./trusted-server-url.mjs";

export const PENDING_OUTBOX_STATUS_FILTER = "in.(requested,dispatched,failed)";

const maxOutboxId = 9223372036854775807n;
const pageSize = 500;
// A CSV with 5,000 signed bigint IDs is at most 99,999 ASCII bytes. That
// fits the GitHub job output budget and Linux's per-environment-value limit.
const maxAcknowledgementIds = 5000;
const maxAcknowledgementCsvLength = maxAcknowledgementIds * 20 - 1;

function parseOutboxId(value, label, allowZero = false) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,18})$/u.test(value)) {
    throw new Error(`${label} must be a canonical signed-64-bit outbox ID.`);
  }
  const id = BigInt(value);
  if (id.toString() !== value || id > maxOutboxId || (id === 0n && !allowZero)) {
    throw new Error(`${label} must be a canonical signed-64-bit outbox ID.`);
  }
  return id;
}

function validateNextOutboxId(value, cursor, highWater) {
  const id = parseOutboxId(value, "Pending outbox ID");
  if (id <= cursor || id > highWater) {
    throw new Error("Pending outbox IDs must be strictly increasing and within the frozen high-water mark.");
  }
  return id;
}

export function parsePendingOutboxIds(csv, outboxHighWater) {
  const highWater = parseOutboxId(outboxHighWater, "Frozen outbox high-water mark", true);
  if (typeof csv !== "string") throw new Error("The frozen pending outbox ID list is missing.");
  if (csv === "") return [];
  if (csv.length > maxAcknowledgementCsvLength) throw new Error("The frozen pending outbox ID list is too large.");
  const ids = csv.split(",");
  if (ids.length > maxAcknowledgementIds) throw new Error("The frozen pending outbox ID list is too large.");
  let cursor = 0n;
  for (const id of ids) cursor = validateNextOutboxId(id, cursor, highWater);
  return ids;
}

export async function collectPendingOutboxIds({ supabaseUrl, serviceKey, outboxHighWater, fetchImpl = fetch }) {
  const origin = trustedSupabaseOrigin(supabaseUrl);
  if (typeof serviceKey !== "string" || !serviceKey.trim()) throw new Error("Pending outbox capture requires a service key.");
  const highWater = parseOutboxId(outboxHighWater, "Frozen outbox high-water mark", true);
  const ids = [];
  let cursor = 0n;

  while (cursor < highWater) {
    const limit = Math.min(pageSize, maxAcknowledgementIds - ids.length + 1);
    const query = new URLSearchParams({
      select: "request_id:id::text",
      status: PENDING_OUTBOX_STATUS_FILTER,
      and: `(id.gt.${cursor},id.lte.${highWater})`,
      order: "id.asc",
      limit: String(limit),
    });
    const url = new URL("/rest/v1/public_build_outbox", origin);
    url.search = query.toString();
    const response = await fetchImpl(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Pending outbox capture failed: HTTP ${response.status}.`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length > limit) throw new Error("Invalid pending outbox page.");
    if (rows.length === 0) break;
    // A server can return fewer than the requested limit. Advance by identity
    // until exhausted, and never widen the acknowledgement to cover a gap.
    for (const row of rows) {
      cursor = validateNextOutboxId(row?.request_id, cursor, highWater);
      if (ids.length === maxAcknowledgementIds) {
        console.warn(`Captured the first ${maxAcknowledgementIds} pending outbox IDs. Remaining requests will stay pending for a later release.`);
        return ids;
      }
      ids.push(row.request_id);
    }
  }
  return ids;
}
