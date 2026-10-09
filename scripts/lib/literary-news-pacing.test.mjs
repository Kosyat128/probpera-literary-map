import { describe, expect, it, vi } from "vitest";
import { NEWS_DAILY_TARGET, inspectNewsDeliveryPacing, newsDeliveryPacingKey, reserveNewsDeliverySlot } from "./literary-news-pacing.mjs";

const destination = { platform: "telegram", id: "-1002791579809" };
const start = new Date("2026-09-27T05:00:00Z");
const options = (store, overrides = {}) => ({ store, destination, now: start,
  jobKey: "post:news:fixture:telegram:-1002791579809", attemptId: "attempt-1", ...overrides });
// JSON serialization models the real JSONB journal boundary. Two clients may
// share the same durable rows; no process-local lock or retained helper state.
function client(journal = { rows: [], sequence: 0 }) {
  return { journal,
    async read(key) { const row = journal.rows.findLast(row => row.key === key);
      return row ? JSON.parse(JSON.stringify({ id: row.id, state: row.state })) : { id: null, state: null }; },
    async compareAppend(key, expected, state) {
      const row = journal.rows.findLast(row => row.key === key);
      if ((row?.id ?? null) !== expected) return { applied: false };
      const next = JSON.parse(JSON.stringify({ key, id: ++journal.sequence, state }));
      journal.rows.push(next); return { applied: true, id: next.id, state: next.state };
    },
  };
}

describe("durable per-destination create pacing", () => {
  it('inspects the same durable reservation and delayed receipt without consuming a slot', async () => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    const row = await store.read(newsDeliveryPacingKey(destination)), count = store.journal.rows.length;
    const receipt = { key: row.state.jobKey, remoteId: '1', firstAcknowledgedAt: '2026-09-27T05:03:00Z' };
    expect(inspectNewsDeliveryPacing({ row, destination, current: new Date('2026-09-27T06:45:00Z'), receipt })).toEqual({
      valid: true, reason: 'pacing_not_due', nextDueAt: '2026-09-27T06:48:00.000Z', eligibleAt: '2026-09-27T06:48:00.000Z', reservations: 1 });
    expect(inspectNewsDeliveryPacing({ row, destination, current: new Date('2026-09-27T07:10:00Z'), receipt })).toMatchObject({
      valid: true, reason: 'pacing_due', nextDueAt: '2026-09-27T07:10:00.000Z', eligibleAt: '2026-09-27T06:48:00.000Z' });
    expect(store.journal.rows).toHaveLength(count);
  });
  it('normalizes read-only wake-ups to publication hours, daily cap, and destination cooldown', async () => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    const row = await store.read(newsDeliveryPacingKey(destination));
    expect(inspectNewsDeliveryPacing({ row, destination, current: new Date('2026-09-27T04:00:00Z') })).toMatchObject({
      valid: true, reason: 'pacing_outside_publication_hours', nextDueAt: '2026-09-27T06:45:00.000Z' });
    expect(inspectNewsDeliveryPacing({ row, destination, current: new Date('2026-09-27T19:00:00Z'),
      control: { nextDueAt: '2026-09-27T20:30:00Z' } })).toMatchObject({ valid: true, nextDueAt: '2026-09-28T05:00:00.000Z' });
    row.state.reservations = 10;
    expect(inspectNewsDeliveryPacing({ row, destination, current: new Date('2026-09-27T09:00:00Z') })).toMatchObject({
      valid: true, reason: 'pacing_daily_limit', nextDueAt: '2026-09-28T05:00:00.000Z', reservations: 10 });
  });
  it('does not turn invalid persisted data or a different post receipt into a wake-up', async () => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    const row = await store.read(newsDeliveryPacingKey(destination));
    for (const patch of [{ schemaVersion: 99 }, { destinationId: '-42' }, { reservations: 11 }, { nextDueAt: 'bad' }])
      expect(inspectNewsDeliveryPacing({ row: { ...row, state: { ...row.state, ...patch } }, destination, current: start }))
        .toMatchObject({ valid: false, reason: 'pacing_state_invalid', nextDueAt: null });
    expect(inspectNewsDeliveryPacing({ row, destination, current: start, receipt: { key: 'different' } })).toMatchObject({
      valid: false, reason: 'pacing_receipt_invalid', nextDueAt: null });
    expect(inspectNewsDeliveryPacing({ row, destination, current: start, control: { nextDueAt: 'bad' } })).toMatchObject({ valid: false });
  });
  it("lets exactly one simultaneous runner reserve the channel", async () => {
    const store = client(), second = client(store.journal);
    const results = await Promise.all([reserveNewsDeliverySlot(options(store)),
      reserveNewsDeliverySlot(options(second, { jobKey: "post:news:other:telegram:-1002791579809", attemptId: "attempt-2" }))]);
    expect(results.filter(result => result.applied)).toHaveLength(1);
    expect(results.find(result => !result.applied)).toMatchObject({ reason: "pacing_not_due", nextDueAt: "2026-09-27T06:45:00.000Z" });
    expect(store.journal.rows).toHaveLength(1);
  });
  it("does not grant the same attempt twice, even after a fresh client reload", async () => {
    const store = client(); expect((await reserveNewsDeliverySlot(options(store))).applied).toBe(true);
    const restarted = client(JSON.parse(JSON.stringify(store.journal)));
    expect(await reserveNewsDeliverySlot(options(restarted))).toMatchObject({ applied: false, reason: "pacing_not_due" });
    expect(restarted.journal.rows).toHaveLength(1);
  });
  it("a crash before dispatch consumes the interval and expiry admits only a new slot", async () => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    const before = new Date(start.getTime() + 6300000 - 1);
    expect((await reserveNewsDeliverySlot(options(store, { now: before, attemptId: "after-crash" }))).applied).toBe(false);
    const due = new Date(start.getTime() + 6300000);
    expect(await reserveNewsDeliverySlot(options(store, { now: due, attemptId: "fresh-attempt" })))
      .toMatchObject({ applied: true, nextDueAt: "2026-09-27T08:30:00.000Z" });
  });
  it("does not accrue credits or burst after a long missed schedule", async () => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    const later = new Date("2026-09-29T11:12:13Z");
    expect(await reserveNewsDeliverySlot(options(store, { now: later, attemptId: "late" })))
      .toMatchObject({ applied: true, nextDueAt: "2026-09-29T12:57:13.000Z" });
    expect((await reserveNewsDeliverySlot(options(store, { now: later, attemptId: "no-catch-up" }))).applied).toBe(false);
  });
  it("keeps numeric destinations and platforms independent", async () => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    const other = { platform: "vk", id: "-231377018" };
    expect((await reserveNewsDeliverySlot(options(store, { destination: other,
      jobKey: "post:news:fixture:vk:-231377018" }))).applied).toBe(true);
    expect(store.journal.rows).toHaveLength(2);
  });
  it("fails closed on corrupt or cross-destination persisted timing", async () => {
    for (const patch of [{ nextDueAt: "bad" }, { intervalSeconds: 1 }, { destinationId: "-42" },
      { nextDueAt: "2026-09-27T00:01:00Z" }, { schemaVersion: 6 }, { reservations: 99 },
      { day: '2026-09-28' }, { dailyLimit: 100 }, { intervalSeconds: 2699 }, { intervalSeconds: 3301 },
      { minIntervalSeconds: 1800 }, { maxIntervalSeconds: 3600 }, { scheduleToleranceSeconds: 60 },
      { jobKey: 'destination:telegram:-1002791579809' }, { jobKey: 'post:news:other:telegram:-42' }]) {
      const store = client(); await reserveNewsDeliverySlot(options(store));
      Object.assign(store.journal.rows[0].state, patch);
      expect(await reserveNewsDeliverySlot(options(store, { now: new Date("2026-10-01T12:00:00Z") })))
        .toMatchObject({ applied: false, reason: "pacing_state_invalid" });
      expect(store.journal.rows).toHaveLength(1);
    }
  });
  it("cannot create a slot for an invalid destination, attempt or mismatched job", async () => {
    const store = client();
    for (const patch of [{ destination: { platform: "telegram", id: "@name" } }, { jobKey: "post:news:x:vk:-1" },
      { attemptId: "" }, { now: new Date("bad") }, { jobKey: "../file" }])
      await expect(reserveNewsDeliverySlot(options(store, patch))).rejects.toThrow(/pacing_/);
    expect(store.journal.rows).toHaveLength(0);
    expect(newsDeliveryPacingKey(destination)).toBe("history:pacing:telegram:-1002791579809");
  });
  it("propagates durable-store failures without issuing a grant", async () => {
    const store = client(); store.compareAppend = async () => { throw Error("database unavailable"); };
    await expect(reserveNewsDeliverySlot(options(store))).rejects.toThrow("database unavailable");
    expect(store.journal.rows).toHaveLength(0);
  });
  it("a backwards runner clock cannot bypass a recorded future slot", async () => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    expect((await reserveNewsDeliverySlot(options(store, { now: new Date("2026-09-26T23:00:00Z") }))).applied).toBe(false);
  });
  it('fits nine evenly spaced posts into a Moscow day and never catches up outside the window', async () => {
    const store = client();
    expect(NEWS_DAILY_TARGET).toMatchObject({ minimum: 8, maximum: 10 });
    for (let index = 0; index < 9; index++) {
      const restarted = client(store.journal);
      expect((await reserveNewsDeliverySlot(options(restarted, {
        now: new Date(start.getTime() + index * 6300000), attemptId: `daily-${index}`,
      }))).applied).toBe(true);
    }
    expect(await reserveNewsDeliverySlot(options(client(store.journal), {
      now: new Date('2026-09-27T20:45:00Z'), attemptId: 'tenth',
    }))).toMatchObject({ applied: false, reason: 'pacing_outside_publication_hours', nextDueAt: '2026-09-28T05:00:00.000Z' });
    expect((await reserveNewsDeliverySlot(options(client(store.journal), {
      now: new Date('2026-09-28T05:00:00Z'), attemptId: 'new-moscow-day',
    }))).applied).toBe(true);
    expect(store.journal.rows.at(-1).state).toMatchObject({ day: '2026-09-28', reservations: 1 });
  });
  it('upgrades a valid persisted v1 slot without bypassing its remaining interval', async () => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    const legacy = store.journal.rows[0].state;
    legacy.schemaVersion = 1; delete legacy.day; delete legacy.reservations; delete legacy.dailyLimit; delete legacy.timeZone;
    legacy.intervalSeconds = 1800; legacy.nextDueAt = new Date(start.getTime() + 1800000).toISOString();
    delete legacy.scheduleToleranceSeconds; delete legacy.publicationStartHour; delete legacy.publicationEndHourExclusive;
    expect(await reserveNewsDeliverySlot(options(store))).toMatchObject({ applied: false, reason: 'pacing_not_due' });
    expect((await reserveNewsDeliverySlot(options(store, {
      now: new Date(start.getTime() + 6300000), attemptId: 'upgrade',
    }))).applied).toBe(true);
    expect(store.journal.rows.at(-1).state).toMatchObject({ schemaVersion: 5, reservations: 2 });
  });
  it('keeps new posts within 08:00-22:59 Moscow and returns the next morning without a write', async () => {
    for (const [clock, due] of [['2026-09-27T04:59:59Z', '2026-09-27T05:00:00.000Z'],
      ['2026-09-27T20:00:00Z', '2026-09-28T05:00:00.000Z'], ['2026-09-27T21:00:00Z', '2026-09-28T05:00:00.000Z']]) {
      const store = client();
      expect(await reserveNewsDeliverySlot(options(store, { now: new Date(clock) })))
        .toMatchObject({ applied: false, reason: 'pacing_outside_publication_hours', nextDueAt: due });
      expect(store.journal.rows).toHaveLength(0);
    }
  });
  it('persists the fixed 105-minute interval across restarts with five-minute polling', async () => {
    const store = client();
    let current = new Date('2026-09-27T05:00:42Z');
    for (let index = 0; index < 5; index++) {
      const result = await reserveNewsDeliverySlot(options(store, { now: current, attemptId: `fixed-${index}` }));
      expect(result.applied).toBe(true);
      expect(store.journal.rows.at(-1).state).toMatchObject({ schemaVersion: 5, intervalSeconds: 6300,
        minIntervalSeconds: 6300, maxIntervalSeconds: 6300, scheduleToleranceSeconds: 0, dailyLimit: 10 });
      const reloaded = client(JSON.parse(JSON.stringify(store.journal)));
      expect(await reserveNewsDeliverySlot(options(reloaded, { now: new Date(Date.parse(result.nextDueAt) - 1) })))
        .toMatchObject({ applied: false, reason: 'pacing_not_due', nextDueAt: result.nextDueAt });
      const nextPoll = new Date(Math.ceil(Date.parse(result.nextDueAt) / 300000) * 300000);
      expect(nextPoll - current).toBeGreaterThanOrEqual(105 * 60000);
      expect(nextPoll - current).toBeLessThan(110 * 60000);
      current = nextPoll;
    }
  });
  it.each([2, 3])('preserves a legacy schema%d slot and its daily count on upgrade', async schemaVersion => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    const legacy = store.journal.rows[0].state;
    Object.assign(legacy, { schemaVersion, intervalSeconds: 3600, dailyLimit: 15, reservations: 2,
      scheduleToleranceSeconds: 60, nextDueAt: new Date(start.getTime() + (schemaVersion === 3 ? 3540000 : 3600000)).toISOString() });
    const due = new Date(start.getTime() + 6300000);
    expect(await reserveNewsDeliverySlot(options(store, { now: new Date(due.getTime() - 1) })))
      .toMatchObject({ applied: false, reason: 'pacing_not_due', nextDueAt: due.toISOString() });
    expect((await reserveNewsDeliverySlot(options(store, { now: due }))).applied).toBe(true);
    expect(store.journal.rows.at(-1).state).toMatchObject({ schemaVersion: 5, reservations: 3, dailyLimit: 10 });
  });
  it.each([2700, 3000, 3300])('extends a legacy v4 %s-second slot and preserves its journal on upgrade', async seconds => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    Object.assign(store.journal.rows[0].state, { schemaVersion: 4, intervalSeconds: seconds,
      minIntervalSeconds: 2700, maxIntervalSeconds: 3300, dailyLimit: 20, reservations: 8,
      nextDueAt: new Date(start.getTime() + seconds * 1000).toISOString() });
    const before = structuredClone(store.journal.rows[0]);
    expect(await reserveNewsDeliverySlot(options(store, { now: new Date(start.getTime() + seconds * 1000) })))
      .toMatchObject({ applied: false, reason: 'pacing_not_due', nextDueAt: '2026-09-27T06:45:00.000Z' });
    expect(store.journal.rows[0]).toEqual(before);
    expect((await reserveNewsDeliverySlot(options(store, { now: new Date('2026-09-27T06:45:00Z') }))).applied).toBe(true);
    expect(store.journal.rows.at(-1).state).toMatchObject({ schemaVersion: 5, reservations: 9, dailyLimit: 10 });
  });
  it.each([10, 15, 20])('does not reset a legacy day with %s consumed slots to bypass the new maximum', async reservations => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    Object.assign(store.journal.rows[0].state, { schemaVersion: 4, intervalSeconds: 3000,
      minIntervalSeconds: 2700, maxIntervalSeconds: 3300, dailyLimit: 20, reservations,
      nextDueAt: new Date(start.getTime() + 3000000).toISOString() });
    expect(await reserveNewsDeliverySlot(options(store, { now: new Date('2026-09-27T19:00:00Z') })))
      .toMatchObject({ applied: false, reason: 'pacing_daily_limit', nextDueAt: '2026-09-28T05:00:00.000Z' });
    expect(store.journal.rows).toHaveLength(1);
    expect((await reserveNewsDeliverySlot(options(store, { now: new Date('2026-09-28T05:00:00Z') }))).applied).toBe(true);
    expect(store.journal.rows.at(-1).state.reservations).toBe(1);
  });
  it('extends the next slot to 105 minutes after the durable first acknowledgement, without extra reads while blocked', async () => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    await store.compareAppend(options(store).jobKey, null, { remoteId: '17', firstAcknowledgedAt: '2026-09-27T05:03:00Z' });
    const read = vi.spyOn(store, 'read');
    expect(await reserveNewsDeliverySlot(options(store, { now: new Date('2026-09-27T06:44:59Z') })))
      .toMatchObject({ applied: false, nextDueAt: '2026-09-27T06:45:00.000Z' });
    expect(read).toHaveBeenCalledTimes(1); read.mockClear();
    expect(await reserveNewsDeliverySlot(options(store, { now: new Date('2026-09-27T06:45:00Z') })))
      .toMatchObject({ applied: false, reason: 'pacing_not_due', nextDueAt: '2026-09-27T06:48:00.000Z' });
    expect(read).toHaveBeenCalledTimes(2);
    expect((await reserveNewsDeliverySlot(options(store, { now: new Date('2026-09-27T06:48:00Z') }))).applied).toBe(true);
    expect(store.journal.rows.at(-1).state.reservations).toBe(2);
  });
});
