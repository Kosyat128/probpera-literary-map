import { describe, expect, it } from "vitest";
import { NEWS_DELIVERY_INTERVAL_SECONDS, NEWS_DAILY_TARGET, newsDeliveryPacingKey, reserveNewsDeliverySlot } from "./literary-news-pacing.mjs";

const destination = { platform: "telegram", id: "-1002791579809" };
const start = new Date("2026-09-27T00:00:00Z");
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
  it("lets exactly one simultaneous runner reserve the channel", async () => {
    const store = client(), second = client(store.journal);
    const results = await Promise.all([reserveNewsDeliverySlot(options(store)),
      reserveNewsDeliverySlot(options(second, { jobKey: "post:news:other:telegram:-1002791579809", attemptId: "attempt-2" }))]);
    expect(results.filter(result => result.applied)).toHaveLength(1);
    expect(results.find(result => !result.applied)).toMatchObject({ reason: "pacing_not_due", nextDueAt: "2026-09-27T00:30:00.000Z" });
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
    const before = new Date(start.getTime() + NEWS_DELIVERY_INTERVAL_SECONDS * 1000 - 1);
    expect((await reserveNewsDeliverySlot(options(store, { now: before, attemptId: "after-crash" }))).applied).toBe(false);
    const due = new Date(start.getTime() + NEWS_DELIVERY_INTERVAL_SECONDS * 1000);
    expect(await reserveNewsDeliverySlot(options(store, { now: due, attemptId: "fresh-attempt" })))
      .toMatchObject({ applied: true, nextDueAt: "2026-09-27T01:00:00.000Z" });
  });
  it("does not accrue credits or burst after a long missed schedule", async () => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    const later = new Date("2026-09-29T11:12:13Z");
    expect(await reserveNewsDeliverySlot(options(store, { now: later, attemptId: "late" })))
      .toMatchObject({ applied: true, nextDueAt: "2026-09-29T11:42:13.000Z" });
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
      { nextDueAt: "2026-09-27T00:01:00Z" }, { schemaVersion: 3 }, { reservations: 99 },
      { day: '2026-09-28' }, { dailyLimit: 100 }]) {
      const store = client(); await reserveNewsDeliverySlot(options(store));
      Object.assign(store.journal.rows[0].state, patch);
      expect(await reserveNewsDeliverySlot(options(store, { now: new Date("2026-10-01") })))
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
  it('caps a destination at fifteen attempts per Moscow day across restarts, without catch-up credits', async () => {
    const store = client();
    for (let index = 0; index < NEWS_DAILY_TARGET.maximum; index++) {
      const restarted = client(store.journal);
      expect((await reserveNewsDeliverySlot(options(restarted, {
        now: new Date(start.getTime() + index * 1800000), attemptId: `daily-${index}`,
      }))).applied).toBe(true);
    }
    expect(await reserveNewsDeliverySlot(options(client(store.journal), {
      now: new Date('2026-09-27T12:00:00Z'), attemptId: 'sixteenth',
    }))).toMatchObject({ applied: false, reason: 'pacing_daily_limit', nextDueAt: '2026-09-27T21:00:00.000Z' });
    expect((await reserveNewsDeliverySlot(options(client(store.journal), {
      now: new Date('2026-09-27T21:00:00Z'), attemptId: 'new-moscow-day',
    }))).applied).toBe(true);
    expect(store.journal.rows.at(-1).state).toMatchObject({ day: '2026-09-28', reservations: 1 });
  });
  it('upgrades a valid persisted v1 slot without bypassing its remaining interval', async () => {
    const store = client(); await reserveNewsDeliverySlot(options(store));
    const legacy = store.journal.rows[0].state;
    legacy.schemaVersion = 1; delete legacy.day; delete legacy.reservations; delete legacy.dailyLimit; delete legacy.timeZone;
    expect(await reserveNewsDeliverySlot(options(store))).toMatchObject({ applied: false, reason: 'pacing_not_due' });
    expect((await reserveNewsDeliverySlot(options(store, {
      now: new Date(start.getTime() + 1800000), attemptId: 'upgrade',
    }))).applied).toBe(true);
    expect(store.journal.rows.at(-1).state).toMatchObject({ schemaVersion: 2, reservations: 2 });
  });
});
