/** A consumed slot is never refunded: a crash, pause or provider failure may
 * delay a post, but cannot produce a catch-up burst on the next runner. The
 * existing atomic destination guard must still run after this reservation. */
export const NEWS_DELIVERY_INTERVAL_SECONDS = 1800;
const intervalMs = NEWS_DELIVERY_INTERVAL_SECONDS * 1000;

export function newsDeliveryPacingKey(destination) {
  if (!["telegram", "vk"].includes(destination?.platform)
    || typeof destination.id !== "string" || !/^-[1-9]\d{0,15}$/.test(destination.id)
    || !Number.isSafeInteger(Number(destination.id))) throw Error("pacing_destination_invalid");
  return `history:pacing:${destination.platform}:${destination.id}`;
}

function blockedSlot(row, key, destination, current) {
  if (row?.id == null && row?.state == null) return null;
  const state = row?.state;
  const reserved = Date.parse(state?.reservedAt), due = Date.parse(state?.nextDueAt);
  if (row?.id == null || state?.schemaVersion !== 1 || state.key !== key
    || state.platform !== destination.platform || state.destinationId !== destination.id
    || state.intervalSeconds !== NEWS_DELIVERY_INTERVAL_SECONDS
    || !Number.isFinite(reserved) || !Number.isFinite(due) || due - reserved !== intervalMs
    || typeof state.jobKey !== "string" || typeof state.attemptId !== "string")
    return { applied: false, reason: "pacing_state_invalid", nextDueAt: null };
  if (due > current) return { applied: false, reason: "pacing_not_due", nextDueAt: state.nextDueAt };
  return null;
}

/** Call once per new-create attempt immediately before the guarded dispatch
 * marker. A repeated attempt never receives a second grant from the same slot.
 * `now` is the current trusted runner clock, not an earlier captured feed time.
 */
export async function reserveNewsDeliverySlot({ store, destination, now = new Date(), jobKey, attemptId }) {
  const key = newsDeliveryPacingKey(destination), current = now instanceof Date ? now.getTime() : NaN;
  if (!Number.isFinite(current) || current > 8640000000000000 - intervalMs
    || typeof store?.read !== "function" || typeof store?.compareAppend !== "function"
    || typeof jobKey !== "string" || jobKey.length > 400
    || !/^post:news:[A-Za-z0-9_%:.-]+$/.test(jobKey)
    || !jobKey.endsWith(`:${destination.platform}:${destination.id}`)
    || typeof attemptId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(attemptId))
    throw Error("pacing_input_invalid");
  const previous = await store.read(key);
  const blocked = blockedSlot(previous, key, destination, current);
  if (blocked) return blocked;
  const nextDueAt = new Date(current + intervalMs).toISOString();
  const state = { schemaVersion: 1, key, platform: destination.platform, destinationId: destination.id,
    intervalSeconds: NEWS_DELIVERY_INTERVAL_SECONDS, reservedAt: now.toISOString(), nextDueAt, jobKey, attemptId };
  const committed = await store.compareAppend(key, previous.id, state);
  if (committed.applied) return { applied: true, reason: "pacing_reserved", nextDueAt, id: committed.id };
  // One bounded reread exposes the winning runner's due time. Never turn a
  // lost CAS into a second reservation in this call, even after a long stall.
  const latest = await store.read(key);
  return blockedSlot(latest, key, destination, current)
    || { applied: false, reason: "pacing_conflict", nextDueAt: null };
}
