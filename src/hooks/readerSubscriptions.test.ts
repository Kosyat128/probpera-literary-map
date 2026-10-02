import { afterEach, describe, expect, it, vi } from "vitest";
import { createReaderSubscriptionsController, decodeReaderSubscriptions, readerSubscriptionsStorageKey, type ReaderSubscription, type ReaderSubscriptionsEnvelope } from "./readerSubscriptions";
const item = (id = "synthetic-country"): ReaderSubscription => ({ type: "country", id, label: "Synthetic Country", createdAt: "2026-10-02T00:00:00.000Z" });
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
function fixture(remote = true) {
  let value: unknown = null, online = true;
  const readLocal = vi.fn(() => value), writeLocal = vi.fn((next: ReaderSubscriptionsEnvelope) => { value = JSON.stringify(next); });
  const read = vi.fn(async (): Promise<{ data: unknown; error: unknown }> => ({ data: [], error: null }));
  const save = vi.fn(async (_item: ReaderSubscription, _signal: AbortSignal): Promise<{ error: unknown }> => ({ error: null }));
  const remove = vi.fn(async (_type: ReaderSubscription["type"], _id: string, _signal: AbortSignal): Promise<{ error: unknown }> => ({ error: null }));
  const options = { storage: { read: readLocal, write: writeLocal }, remote: remote ? { read, save, remove } : null, isOnline: () => online, timeoutMs: 100, now: () => Date.parse("2026-10-02T00:00:00.000Z") };
  return { readLocal, writeLocal, read, save, remove, options, controller: createReaderSubscriptionsController(options),
    stored: () => decodeReaderSubscriptions(value), setStored: (next: unknown) => { value = next; }, setOnline: (next: boolean) => { online = next; } };
}
const settle = async () => { for (let index = 0; index < 15; index++) await Promise.resolve(); };
afterEach(() => vi.useRealTimers());
describe("account-isolated reader subscriptions", () => {
  it("keeps anonymous, A, B and the ambiguous old global namespace distinct", () => {
    const keys = [readerSubscriptionsStorageKey(null), readerSubscriptionsStorageKey("user-a"), readerSubscriptionsStorageKey("user-b"), "probpera-reader-subscriptions"];
    expect(new Set(keys).size).toBe(4);
    expect(readerSubscriptionsStorageKey("a:b")).not.toBe(readerSubscriptionsStorageKey("a%3Ab"));
  });
  it("does no network IO until a current account view owns a lease", async () => {
    const f = fixture(); expect(f.read).not.toHaveBeenCalled(); expect(f.controller.toggle(item())).toBe(false);
    const release = f.controller.activate(() => true); await settle(); expect(f.read).toHaveBeenCalledTimes(1); release();
  });
  it("preserves separate local lists for ordinary users A/B and anonymous reading", async () => {
    const a = fixture(false), b = fixture(false), guest = fixture(false);
    const releaseA = a.controller.activate(() => true), releaseB = b.controller.activate(() => true), releaseGuest = guest.controller.activate(() => true);
    expect(a.controller.toggle(item("private-a"))).toBe(true); expect(b.controller.getSnapshot()).toEqual([]); expect(guest.controller.getSnapshot()).toEqual([]);
    expect(b.controller.toggle(item("private-b"))).toBe(true);
    expect(a.controller.getSnapshot().map(value => value.id)).toEqual(["private-a"]);
    expect(b.controller.getSnapshot().map(value => value.id)).toEqual(["private-b"]);
    releaseA(); releaseB(); releaseGuest();
  });
  it("fences old account hydration and mutations after an account switch", async () => {
    const a = fixture(), b = fixture(), late = deferred<{ data: unknown; error: unknown }>(); a.read.mockImplementationOnce(() => late.promise);
    let current = true; const oldLease = a.controller.activate(() => current); await settle();
    current = false; oldLease(); const newLease = b.controller.activate(() => true); await settle();
    late.resolve({ data: [item("private-a")], error: null }); await settle();
    expect(a.controller.getSnapshot()).toEqual([]); expect(b.controller.getSnapshot()).toEqual([]);
    expect(a.controller.toggle(item())).toBe(false); expect(a.save).not.toHaveBeenCalled(); newLease();
  });
  it("persists dirty offline intent and resumes it under the same account after restart", async () => {
    const f = fixture(); f.setOnline(false); const release = f.controller.activate(() => true);
    expect(f.controller.toggle(item())).toBe(true); expect(f.stored()?.pending).toHaveLength(1); expect(f.save).not.toHaveBeenCalled(); release();
    f.setOnline(true); const reopened = createReaderSubscriptionsController(f.options), releaseAgain = reopened.activate(() => true); await settle();
    expect(f.save).toHaveBeenCalledTimes(1); expect(f.stored()?.pending).toEqual([]); expect(reopened.getSnapshot()).toHaveLength(1); releaseAgain();
  });
  it("durably tombstones an offline removal instead of resurrecting it from a remote read", async () => {
    const f = fixture(); f.setStored(JSON.stringify({ schemaVersion: 1, items: [item()], pending: [] }));
    const controller = createReaderSubscriptionsController(f.options); f.setOnline(false); const release = controller.activate(() => true);
    expect(controller.toggle(item())).toBe(true); expect(f.stored()?.pending[0].item).toBeNull(); release();
    f.setOnline(true); f.read.mockResolvedValue({ data: [item()], error: null });
    const reopened = createReaderSubscriptionsController(f.options), next = reopened.activate(() => true); await settle();
    expect(f.remove).toHaveBeenCalledWith("country", item().id, expect.any(AbortSignal)); expect(reopened.getSnapshot()).toEqual([]); next();
  });
  it("keeps a failed token for an explicit retry without an infinite loop", async () => {
    const f = fixture(), release = f.controller.activate(() => true); await settle(); f.save.mockResolvedValueOnce({ error: { code: "503" } });
    expect(f.controller.toggle(item())).toBe(true); await settle(); expect(f.save).toHaveBeenCalledTimes(1); expect(f.stored()?.pending).toHaveLength(1);
    await f.controller.retry(); expect(f.save).toHaveBeenCalledTimes(2); expect(f.stored()?.pending).toEqual([]); release();
  });
  it("does not let an old acknowledgment erase a replacement intent", async () => {
    const f = fixture(), late = deferred<{ error: unknown }>(), release = f.controller.activate(() => true); await settle();
    f.save.mockImplementationOnce(() => late.promise); f.controller.toggle(item()); await settle(); f.controller.toggle(item());
    late.resolve({ error: null }); await settle();
    expect(f.remove).toHaveBeenCalledTimes(1); expect(f.controller.getSnapshot()).toEqual([]); expect(f.stored()?.pending).toEqual([]); release();
  });
  it("ignores rejected old work after a current lease has been reopened", async () => {
    const f = fixture(), late = deferred<{ data: unknown; error: unknown }>(); f.read.mockImplementationOnce(() => late.promise);
    const old = f.controller.activate(() => true); await settle(); old(); f.read.mockResolvedValue({ data: [item("current")], error: null });
    const reopened = f.controller.activate(() => true); await settle(); late.reject(new Error("private obsolete detail")); await settle();
    expect(f.controller.getSnapshot().map(value => value.id)).toEqual(["current"]); reopened();
  });
  it("retains session intent when persistent writes fail", async () => {
    const f = fixture(false), release = f.controller.activate(() => true); f.writeLocal.mockImplementation(() => { throw new Error("synthetic quota"); });
    expect(f.controller.toggle(item())).toBe(true); expect(f.controller.getSnapshot()).toHaveLength(1);
    await f.controller.retry(); expect(f.controller.getSnapshot()).toHaveLength(1); release();
  });
  it("preserves corrupt/newer private storage instead of overwriting it", () => {
    const f = fixture(); const original = JSON.stringify({ schemaVersion: 2, sensitiveFutureData: true }); f.setStored(original);
    const controller = createReaderSubscriptionsController(f.options), release = controller.activate(() => true);
    expect(controller.toggle(item())).toBe(false); expect(f.writeLocal).not.toHaveBeenCalled(); expect(controller.getSnapshot()).toEqual([]); release();
  });
  it("bounds hung network reads and keeps available local records", async () => {
    vi.useFakeTimers(); const f = fixture(); f.setStored(JSON.stringify({ schemaVersion: 1, items: [item("local")], pending: [] }));
    f.read.mockImplementationOnce(() => new Promise(() => {})); const controller = createReaderSubscriptionsController(f.options), release = controller.activate(() => true);
    await vi.advanceTimersByTimeAsync(100); expect(controller.getSnapshot().map(value => value.id)).toEqual(["local"]); release();
  });
  it("rejects ambiguous legacy arrays, unsupported records and contradictory outbox entries", () => {
    const valid = { schemaVersion: 1, items: [item()], pending: [] };
    expect(decodeReaderSubscriptions(valid)).toMatchObject(valid);
    for (const value of [[item()], { ...valid, owner: "other" }, { ...valid, schemaVersion: 2 }, { ...valid, items: [{ ...item(), type: "payment" }] },
      { ...valid, pending: [{ key: "writer:other", token: "synthetic", item: item() }] }]) expect(decodeReaderSubscriptions(value)).toBeNull();
  });
});


it("privacy cleanup seals cached subscriptions before late read/write completion and refuses reactivation", async () => {
  const f = fixture(), read = deferred<{ data: unknown; error: unknown }>(), save = deferred<{ error: unknown }>();
  f.read.mockReturnValue(read.promise); f.save.mockReturnValue(save.promise);
  const stop = f.controller.activate(() => true); f.controller.toggle(item("private-a")); await settle();
  f.controller.forget(); const writes = f.writeLocal.mock.calls.length;
  read.resolve({ data: [item("late-private-a")], error: null }); save.resolve({ error: null }); await settle();
  const old = f.controller.activate(() => true); expect(f.controller.getSnapshot()).toEqual([]);
  expect(f.controller.toggle(item("forbidden-after-logout"))).toBe(false); expect(f.writeLocal).toHaveBeenCalledTimes(writes); stop(); old();
});
