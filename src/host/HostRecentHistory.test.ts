import { afterEach, describe, expect, it, vi } from "vitest";
import { createHostRecentHistory, HOST_RECENT_HISTORY_KEY, type HostRecentHistoryStore } from "./HostRecentHistory";
import type { HostPreferenceBridge } from "./HostPlatformServices";
import type { RecentTarget } from "../planet/RecentHistory";

const stores: HostRecentHistoryStore[] = [];
const writer = (index: number): RecentTarget => ({ kind: "writer", countryId: "russia", writerId: "writer-" + index });
const encoded = (entries: unknown[]) => JSON.stringify({ v: 1, entries });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function fixture(initial: string | null = null) {
  const state = { value: initial };
  const bridge = {
    get: vi.fn(async (_options: { key: string }) => ({ value: state.value })),
    set: vi.fn(async (options: { key: string; value: string }) => { state.value = options.value; }),
    remove: vi.fn(async (_options: { key: string }) => { state.value = null; }),
  } satisfies HostPreferenceBridge;
  return { state, bridge };
}
function create(bridge?: HostPreferenceBridge, options?: Parameters<typeof createHostRecentHistory>[1]) {
  const store = createHostRecentHistory(bridge, { now: () => 1234, ...options });
  stores.push(store);
  return store;
}
afterEach(() => {
  for (const store of stores.splice(0)) store.dispose();
  vi.useRealTimers();
});

describe("adult native recent history", () => {
  it("loads lazily into stable immutable snapshots without locale labels or subscription-gap disposal", async () => {
    const work = { kind: "work", countryId: "russia", writerId: "writer-2", workId: "edition:canonical-1" } as const;
    const env = fixture(encoded([{ ...writer(1), openedAt: 1200 }, { ...work, openedAt: 1100 }]));
    const store = create(env.bridge);
    const initial = store.getSnapshot();
    expect(store.getSnapshot()).toBe(initial);
    expect(env.bridge.get).not.toHaveBeenCalled();
    const listener = vi.fn();
    const first = store.subscribe(listener);
    const second = store.subscribe(listener);
    first(); first(); second();
    const again = store.subscribe(listener);
    await store.retry();
    expect(env.bridge.get).toHaveBeenCalledTimes(1);
    expect(env.bridge.get).toHaveBeenCalledWith({ key: HOST_RECENT_HISTORY_KEY });
    expect(store.getSnapshot()).toMatchObject({ available: true, loaded: true, storageStatus: "ready" });
    expect(store.getSnapshot().entries[1]).toMatchObject(work);
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);
    expect(Object.isFrozen(store.getSnapshot().entries)).toBe(true);
    expect(Object.isFrozen(store.getSnapshot().entries[0])).toBe(true);
    const loaded = store.getSnapshot();
    await store.record(writer(1));
    expect(store.getSnapshot()).toBe(loaded);
    expect(env.bridge.set).not.toHaveBeenCalled();
    again();
    await store.record(work);
    expect(store.getSnapshot().entries[0]).toMatchObject(work);
  });

  it("keeps the latest 20 distinct canonical targets and persists only typed IDs and timestamps", async () => {
    const env = fixture();
    let time = 1;
    const store = create(env.bridge, { now: () => time++ });
    for (let index = 0; index < 25; index += 1) await store.record(writer(index));
    expect(store.getSnapshot().entries).toHaveLength(20);
    expect(store.getSnapshot().entries.map(entry => entry.writerId)).toEqual(Array.from({ length: 20 }, (_, index) => "writer-" + (24 - index)));
    await store.record(writer(10));
    expect(store.getSnapshot().entries[0]).toMatchObject(writer(10));
    const unchanged = store.getSnapshot();
    await store.record(writer(10));
    expect(store.getSnapshot()).toBe(unchanged);
    await store.record({ kind: "work", countryId: "russia", writerId: "writer-10", workId: "canonical-work" });
    expect(store.getSnapshot().entries.slice(0, 2).map(entry => entry.kind)).toEqual(["work", "writer"]);
    const saved = JSON.parse(env.state.value!);
    expect(Object.keys(saved)).toEqual(["v", "entries"]);
    expect(saved.entries).toEqual(store.getSnapshot().entries);
    expect(env.state.value).not.toMatch(/title|locale|subject|credential|child|entitlement/u);
  });

  it("repairs corrupt storage with an explicit clear and skips unnecessary initial hydration", async () => {
    const corrupt = fixture("corrupt JSON");
    const loaded = create(corrupt.bridge);
    await loaded.retry();
    expect(loaded.getSnapshot().storageStatus).toBe("error");
    await loaded.clear();
    expect(loaded.getSnapshot()).toMatchObject({ entries: [], storageStatus: "ready" });
    expect(corrupt.state.value).toBe(encoded([]));
    expect(corrupt.bridge.get).toHaveBeenCalledTimes(2);

    const fresh = fixture("corrupt JSON");
    const cold = create(fresh.bridge);
    await cold.clear();
    expect(fresh.bridge.set).toHaveBeenCalledTimes(1);
    expect(fresh.bridge.get).toHaveBeenCalledTimes(1);
    expect(fresh.bridge.set.mock.invocationCallOrder[0]).toBeLessThan(fresh.bridge.get.mock.invocationCallOrder[0]);
    expect(cold.getSnapshot()).toMatchObject({ entries: [], storageStatus: "ready" });
  });

  it("makes clear authoritative over pending hydration and older queued records", async () => {
    const env = fixture();
    const read = deferred<{ value: string | null }>();
    env.bridge.get.mockImplementationOnce(() => read.promise);
    const store = create(env.bridge);
    const record = store.record(writer(1));
    await vi.waitFor(() => expect(env.bridge.get).toHaveBeenCalledTimes(1));
    const clear = store.clear();
    expect(store.getSnapshot().entries).toEqual([]);
    expect(env.bridge.set).not.toHaveBeenCalled();
    read.resolve({ value: encoded([{ ...writer(9), openedAt: 100 }]) });
    await Promise.all([record, clear]);
    expect(store.getSnapshot()).toMatchObject({ entries: [], storageStatus: "ready" });
    expect(env.state.value).toBe(encoded([]));
  });

  it("waits for a late older write before persisting clear, without republishing the old record", async () => {
    const env = fixture();
    const write = deferred<void>();
    env.bridge.set.mockImplementationOnce(async options => { await write.promise; env.state.value = options.value; });
    const store = create(env.bridge);
    const record = store.record(writer(1));
    await vi.waitFor(() => expect(env.bridge.set).toHaveBeenCalledTimes(1));
    const clear = store.clear();
    expect(store.getSnapshot().entries).toEqual([]);
    expect(env.bridge.set).toHaveBeenCalledTimes(1);
    write.resolve();
    await Promise.all([record, clear]);
    expect(env.bridge.set).toHaveBeenCalledTimes(2);
    expect(env.state.value).toBe(encoded([]));
    expect(store.getSnapshot()).toMatchObject({ entries: [], storageStatus: "ready" });
  });

  it("retains session intent through rejection or mismatched readback and retries the latest state", async () => {
    const env = fixture();
    env.bridge.set.mockRejectedValueOnce(new Error("private SDK details"));
    const store = create(env.bridge);
    await store.record(writer(1));
    expect(store.getSnapshot()).toMatchObject({ storageStatus: "error", entries: [{ ...writer(1), openedAt: 1234 }] });
    await store.retry();
    expect(store.getSnapshot().storageStatus).toBe("ready");
    env.bridge.get.mockResolvedValueOnce({ value: "mismatched old payload" });
    await store.clear();
    expect(store.getSnapshot()).toMatchObject({ entries: [], storageStatus: "error" });
    await store.retry();
    expect(store.getSnapshot()).toMatchObject({ entries: [], storageStatus: "ready" });
    expect(env.state.value).toBe(encoded([]));
  });

  it("bounds hung read callers while keeping write order until late hydration completes", async () => {
    vi.useFakeTimers();
    const env = fixture();
    const read = deferred<{ value: string | null }>();
    env.bridge.get.mockImplementationOnce(() => read.promise);
    const store = create(env.bridge, { timeoutMs: 100 });
    const record = store.record(writer(1));
    await vi.advanceTimersByTimeAsync(100);
    await record;
    expect(store.getSnapshot().storageStatus).toBe("error");
    const clear = store.clear();
    await vi.advanceTimersByTimeAsync(100);
    await clear;
    expect(env.bridge.get).toHaveBeenCalledTimes(1);
    expect(env.bridge.set).not.toHaveBeenCalled();
    read.resolve({ value: encoded([{ ...writer(7), openedAt: 100 }]) });
    await vi.advanceTimersByTimeAsync(0);
    expect(env.state.value).toBe(encoded([]));
    expect(store.getSnapshot()).toMatchObject({ entries: [], storageStatus: "ready" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds hung writes and lets only the newest intent recover after the actual SDK settles", async () => {
    vi.useFakeTimers();
    const env = fixture();
    const write = deferred<void>();
    env.bridge.set.mockImplementationOnce(async options => { await write.promise; env.state.value = options.value; });
    const store = create(env.bridge, { timeoutMs: 100 });
    const record = store.record(writer(1));
    await vi.advanceTimersByTimeAsync(100);
    await record;
    const clear = store.clear();
    await vi.advanceTimersByTimeAsync(100);
    await clear;
    expect(env.bridge.set).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toMatchObject({ entries: [], storageStatus: "error" });
    write.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(env.bridge.set).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).toMatchObject({ entries: [], storageStatus: "ready" });
    expect(env.state.value).toBe(encoded([]));
  });

  it("disposes confirmation timers and prevents queued or late SDK followups and publication", async () => {
    vi.useFakeTimers();
    const env = fixture();
    const write = deferred<void>();
    env.bridge.set.mockImplementationOnce(async options => { await write.promise; env.state.value = options.value; });
    const store = create(env.bridge, { timeoutMs: 100 });
    const listener = vi.fn();
    store.subscribe(listener);
    const record = store.record(writer(1));
    await vi.advanceTimersByTimeAsync(0);
    expect(env.bridge.set).toHaveBeenCalledTimes(1);
    const clear = store.clear();
    store.dispose();
    const snapshot = store.getSnapshot();
    const notifications = listener.mock.calls.length;
    write.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.all([record, clear, store.retry(), store.record(writer(3)), store.clear()]);
    expect(store.getSnapshot()).toBe(snapshot);
    expect(listener).toHaveBeenCalledTimes(notifications);
    expect(env.bridge.get).toHaveBeenCalledTimes(1);
    expect(env.bridge.set).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects malformed, excessive or noncanonical stored fields without exposing their contents", async () => {
    const row = { ...writer(1), openedAt: 100 };
    for (const source of ["invalid JSON", " ".repeat(32769), encoded([row, row]),
      encoded([{ ...row, title: "untrusted label" }]), encoded([{ ...row, openedAt: -1 }]),
      encoded(Array.from({ length: 21 }, (_, index) => ({ ...writer(index), openedAt: index })))]) {
      const env = fixture(source);
      const store = create(env.bridge);
      await store.retry();
      expect(store.getSnapshot()).toMatchObject({ loaded: true, entries: [], storageStatus: "error" });
      expect(env.bridge.set).not.toHaveBeenCalled();
      store.dispose();
    }
  });

  it("keeps explicit session-only history without a bridge and ignores invalid targets or clocks", async () => {
    const store = create();
    await store.record(writer(1));
    expect(store.getSnapshot()).toMatchObject({ available: true, storageStatus: "error", entries: [{ ...writer(1), openedAt: 1234 }] });
    await store.clear();
    expect(store.getSnapshot()).toMatchObject({ entries: [], storageStatus: "error" });
    const env = fixture();
    const invalidClock = create(env.bridge, { now: () => Number.NaN });
    await invalidClock.record(writer(1));
    const invalidTarget = create(env.bridge);
    await invalidTarget.record({ kind: "writer", countryId: "../private", writerId: "one" });
    expect(env.bridge.get).not.toHaveBeenCalled();
    expect(env.bridge.set).not.toHaveBeenCalled();
  });
});
