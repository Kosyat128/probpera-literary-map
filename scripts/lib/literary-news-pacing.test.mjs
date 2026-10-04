import { describe, expect, it, vi } from "vitest";
import { NEWS_DAILY_TARGET, newsDeliveryPacingKey, reserveNewsDeliverySlot } from "./literary-news-pacing.mjs";

const destination = { platform: "telegram", id: "-1002791579809" };
const start = new Date("2026-09-27T05:00:00Z");
const options = (store, overrides = {}) => ({ store, destination, now: start,
  jobKey: "post:news:fixture:telegram:-1002791579809", attemptId: "attempt-1", randomIntImpl: () => 50, ...overrides });
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
  it("lets exactly one simultaneous runner reserve the channel", async () => {
    const store = client(), second = client(store.journal);
    const results = await Promise.all([reserveNewsDeliverySlot(options(store)),
      reserveNewsDeliverySlot(options(second, { jobKey: "post:news:other:telegram:-1002791579809", attemptId: "attempt-2" }))]);
    expect(results.filter(result => result.applied)).toHaveLength(1);
    expect(results.find(result => !result.applied)).toMatchObject({ reason: "pacing_not_due", nextDueAt: "2026-09-27T05:50:00.000Z" });
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
    const before = new Date(start.getTime() + 3000000 - 1);
    expect((await reserveNewsDeliverySlot(options(store, { now: before, attemptId: "after-crash" }))).applied).toBe(false);
    const due = new Date(start.getTime() + 3000000);
    expect(await reserveNewsDeliverySlot(options(store, { now: due, attemptId: "fresh-attempt" })))
      .toMatchObject({ applied: true, nextDueAt: "2026-09-27T06:40:00.000Z" });
  });
  it("does not accrue credits or burst after a long missed schedule", async () => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    const later = new Date("2026-09-29T11:12:13Z");
    expect(await reserveNewsDeliverySlot(options(store, { now: later, attemptId: "late" })))
      .toMatchObject({ applied: true, nextDueAt: "2026-09-29T12:02:13.000Z" });
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
      { nextDueAt: "2026-09-27T00:01:00Z" }, { schemaVersion: 5 }, { reservations: 99 },
      { day: '2026-09-28' }, { dailyLimit: 100 }, { intervalSeconds: 2699 }, { intervalSeconds: 3301 },
      { minIntervalSeconds: 1800 }, { maxIntervalSeconds: 3600 }, { scheduleToleranceSeconds: 60 }]) {
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
  it('caps a destination at twenty attempts per Moscow day across restarts, without catch-up credits', async () => {
    const store = client();
    for (let index = 0; index < NEWS_DAILY_TARGET.maximum; index++) {
      const restarted = client(store.journal);
      expect((await reserveNewsDeliverySlot(options(restarted, {
        now: new Date(start.getTime() + index * 2700000), attemptId: `daily-${index}`, randomIntImpl: () => 45,
      }))).applied).toBe(true);
    }
    expect(await reserveNewsDeliverySlot(options(client(store.journal), {
      now: new Date('2026-09-27T19:59:00Z'), attemptId: 'twenty-first',
    }))).toMatchObject({ applied: false, reason: 'pacing_daily_limit', nextDueAt: '2026-09-28T05:00:00.000Z' });
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
      now: new Date(start.getTime() + 3540000), attemptId: 'upgrade',
    }))).applied).toBe(true);
    expect(store.journal.rows.at(-1).state).toMatchObject({ schemaVersion: 4, reservations: 2 });
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
  it('persists each chosen interval, never draws while blocked and stays within 45–60 minutes with five-minute polling', async () => {
    const store = client(), minutes = [45, 50, 55, 47, 53], random = vi.fn();
    for (const value of minutes) random.mockReturnValueOnce(value);
    let current = new Date('2026-09-27T05:00:42Z');
    for (const [index, value] of minutes.entries()) {
      const result = await reserveNewsDeliverySlot(options(store, { now: current, attemptId: `variable-${index}`, randomIntImpl: random }));
      expect(result.applied).toBe(true);
      expect(store.journal.rows.at(-1).state).toMatchObject({ schemaVersion: 4, intervalSeconds: value * 60, scheduleToleranceSeconds: 0 });
      const reloaded = client(JSON.parse(JSON.stringify(store.journal)));
      expect(await reserveNewsDeliverySlot(options(reloaded, { now: new Date(Date.parse(result.nextDueAt) - 1), randomIntImpl: random })))
        .toMatchObject({ applied: false, reason: 'pacing_not_due', nextDueAt: result.nextDueAt });
      expect(random).toHaveBeenCalledTimes(index + 1);
      const nextPoll = new Date(Math.ceil(Date.parse(result.nextDueAt) / 300000) * 300000);
      expect(nextPoll - current).toBeGreaterThanOrEqual(45 * 60000);
      expect(nextPoll - current).toBeLessThanOrEqual(60 * 60000);
      current = nextPoll;
    }
    expect(random).toHaveBeenCalledWith(45, 56);
  });
  it.each([2, 3])('preserves a legacy schema%d slot and its daily count on upgrade', async schemaVersion => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    const legacy = store.journal.rows[0].state;
    Object.assign(legacy, { schemaVersion, intervalSeconds: 3600, dailyLimit: 15, reservations: 15,
      scheduleToleranceSeconds: 60, nextDueAt: new Date(start.getTime() + (schemaVersion === 3 ? 3540000 : 3600000)).toISOString() });
    const due = new Date(legacy.nextDueAt);
    expect(await reserveNewsDeliverySlot(options(store, { now: new Date(due.getTime() - 1) })))
      .toMatchObject({ applied: false, reason: 'pacing_not_due', nextDueAt: legacy.nextDueAt });
    expect((await reserveNewsDeliverySlot(options(store, { now: due }))).applied).toBe(true);
    expect(store.journal.rows.at(-1).state).toMatchObject({ schemaVersion: 4, reservations: 16, dailyLimit: 20 });
  });
  it.each([44, 56, 45.5, NaN])('rejects an invalid interval draw %s without persisting a grant', async value => {
    const store = client();
    await expect(reserveNewsDeliverySlot(options(store, { randomIntImpl: () => value }))).rejects.toThrow('pacing_interval_invalid');
    expect(store.journal.rows).toHaveLength(0);
  });
});
