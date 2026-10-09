/** A consumed slot is never refunded: a crash, pause or provider failure may
 * delay a post, but cannot produce a catch-up burst on the next runner. The
 * existing atomic destination guard must still run after this reservation. */
// Reserve 105 minutes, then the five-minute Cron delivers at the first
// eligible tick. Provider latency can delay a post, never shorten the gap.
// A delayed runner may be later, but never accumulates catch-up credits.
export const NEWS_DELIVERY_MAX_INTERVAL_SECONDS = 6300;
export const NEWS_DELIVERY_MIN_INTERVAL_SECONDS = 6300;
export const NEWS_DELIVERY_MAX_RESERVATION_SECONDS = 6300;
export const NEWS_DELIVERY_POLL_SECONDS = 300;
export const NEWS_DELIVERY_SCHEDULE_TOLERANCE_SECONDS = 0;
export const NEWS_DELIVERY_HOURS = Object.freeze({ start: 8, endExclusive: 23, timeZone: 'Europe/Moscow' });
export const NEWS_DAILY_TARGET = Object.freeze({ minimum: 8, maximum: 10, timeZone: 'Europe/Moscow' });
const intervalMs = NEWS_DELIVERY_MAX_INTERVAL_SECONDS * 1000;
const legacyReservationIntervalMs = 3540000;
const editorialDay = date => new Intl.DateTimeFormat('en-CA', {
  timeZone: NEWS_DAILY_TARGET.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
const nextDayAt = day => new Date(Date.parse(`${day}T08:00:00+03:00`) + 86400000).toISOString();
export function newsDeliveryPublicationWindow(current) {
  const day = editorialDay(current), opening = Date.parse(`${day}T08:00:00+03:00`), closing = Date.parse(`${day}T23:00:00+03:00`);
  return { open: current.getTime() >= opening && current.getTime() < closing,
    nextDueAt: current.getTime() < opening ? new Date(opening).toISOString() : nextDayAt(day) };
}

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
  if (row?.id == null || ![1, 2, 3, 4, 5].includes(state?.schemaVersion) || state.key !== key
    || state.platform !== destination.platform || state.destinationId !== destination.id
    || !Number.isFinite(reserved) || !Number.isFinite(due)
    || (state.schemaVersion < 4 && ![1800, 3600].includes(state.intervalSeconds))
    || due - reserved !== (state.schemaVersion === 3 ? legacyReservationIntervalMs : state.intervalSeconds * 1000)
    || typeof state.jobKey !== "string" || !/^post:news:[A-Za-z0-9_%:.-]+$/.test(state.jobKey)
    || !state.jobKey.endsWith(`:${destination.platform}:${destination.id}`) || typeof state.attemptId !== "string")
    return { applied: false, reason: "pacing_state_invalid", nextDueAt: null };
  if (state.schemaVersion === 3 && (state.intervalSeconds !== 3600
    || state.scheduleToleranceSeconds !== 60
    || state.publicationStartHour !== NEWS_DELIVERY_HOURS.start || state.publicationEndHourExclusive !== NEWS_DELIVERY_HOURS.endExclusive))
    return { applied: false, reason: "pacing_state_invalid", nextDueAt: null };
  if (state.schemaVersion === 4 && (!Number.isSafeInteger(state.intervalSeconds)
    || state.intervalSeconds < 2700 || state.intervalSeconds > 3300
    || state.intervalSeconds % 60 !== 0 || state.minIntervalSeconds !== 2700
    || state.maxIntervalSeconds !== 3300 || state.scheduleToleranceSeconds !== 0
    || state.publicationStartHour !== NEWS_DELIVERY_HOURS.start || state.publicationEndHourExclusive !== NEWS_DELIVERY_HOURS.endExclusive))
    return { applied: false, reason: "pacing_state_invalid", nextDueAt: null };
  if (state.schemaVersion === 5 && (state.intervalSeconds !== NEWS_DELIVERY_MIN_INTERVAL_SECONDS
    || state.minIntervalSeconds !== NEWS_DELIVERY_MIN_INTERVAL_SECONDS
    || state.maxIntervalSeconds !== NEWS_DELIVERY_MAX_RESERVATION_SECONDS || state.scheduleToleranceSeconds !== 0
    || state.publicationStartHour !== NEWS_DELIVERY_HOURS.start || state.publicationEndHourExclusive !== NEWS_DELIVERY_HOURS.endExclusive))
    return { applied: false, reason: "pacing_state_invalid", nextDueAt: null };
  if (state.schemaVersion >= 2 && (state.day !== editorialDay(new Date(reserved))
    || !Number.isSafeInteger(state.reservations) || state.reservations < 1 || state.reservations > state.dailyLimit
    || state.timeZone !== NEWS_DAILY_TARGET.timeZone
    || state.dailyLimit !== (state.schemaVersion === 5 ? NEWS_DAILY_TARGET.maximum : state.schemaVersion === 4 ? 20 : 15)))
    return { applied: false, reason: "pacing_state_invalid", nextDueAt: null };
  if (state.schemaVersion >= 2 && state.day === editorialDay(new Date(current))
    && state.reservations >= NEWS_DAILY_TARGET.maximum)
    return { applied: false, reason: 'pacing_daily_limit', nextDueAt: nextDayAt(state.day) };
  const effectiveDue = Math.max(due, reserved + intervalMs);
  if (effectiveDue > current) return { applied: false, reason: "pacing_not_due", nextDueAt: new Date(effectiveDue).toISOString() };
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
  const window = newsDeliveryPublicationWindow(now);
  if (!window.open) return { applied: false, reason: "pacing_outside_publication_hours", nextDueAt: window.nextDueAt };
  const previous = await store.read(key);
  const blocked = blockedSlot(previous, key, destination, current);
  if (blocked) return blocked;
  // Read a prior receipt only once the reserved interval is due. Network time
  // between reservation and acknowledgement must not shorten the next gap.
  if (previous.state) {
    const receipt = (await store.read(previous.state.jobKey)).state;
    const acknowledged = Date.parse(receipt?.firstAcknowledgedAt);
    if (receipt?.remoteId && Number.isFinite(acknowledged)
      && acknowledged >= Date.parse(previous.state.reservedAt) && acknowledged + intervalMs > current)
      return { applied: false, reason: 'pacing_not_due', nextDueAt: new Date(acknowledged + intervalMs).toISOString() };
  }
  const intervalSeconds = NEWS_DELIVERY_MIN_INTERVAL_SECONDS;
  const nextDueAt = new Date(current + intervalSeconds * 1000).toISOString();
  const day = editorialDay(now), old = previous.state;
  // Existing v1 slots still enforce their interval; the last legacy reservation
  // is counted on upgrade. Earlier v1 history did not record a daily total.
  const previousCount = old && editorialDay(new Date(old.reservedAt)) === day
    ? old.schemaVersion >= 2 ? old.reservations : 1 : 0;
  const state = { schemaVersion: 5, key, platform: destination.platform, destinationId: destination.id,
    day, reservations: previousCount + 1, timeZone: NEWS_DAILY_TARGET.timeZone, dailyLimit: NEWS_DAILY_TARGET.maximum,
    intervalSeconds, minIntervalSeconds: NEWS_DELIVERY_MIN_INTERVAL_SECONDS, maxIntervalSeconds: NEWS_DELIVERY_MAX_RESERVATION_SECONDS,
    scheduleToleranceSeconds: NEWS_DELIVERY_SCHEDULE_TOLERANCE_SECONDS,
    publicationStartHour: NEWS_DELIVERY_HOURS.start, publicationEndHourExclusive: NEWS_DELIVERY_HOURS.endExclusive,
    reservedAt: now.toISOString(), nextDueAt, jobKey, attemptId };
  const committed = await store.compareAppend(key, previous.id, state);
  if (committed.applied) return { applied: true, reason: "pacing_reserved", nextDueAt, id: committed.id };
  // One bounded reread exposes the winning runner's due time. Never turn a
  // lost CAS into a second reservation in this call, even after a long stall.
  const latest = await store.read(key);
  return blockedSlot(latest, key, destination, current)
    || { applied: false, reason: "pacing_conflict", nextDueAt: null };
}
