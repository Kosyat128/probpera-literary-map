import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PreferenceStore } from "../platform/ports";
import { contentTextHash } from "../planet/contentExportHash";
import { BOOKY_JOURNEY_PROGRESS_KEY, BOOKY_JOURNEY_PROGRESS_MAX_LENGTH, DEFAULT_BOOKY_JOURNEY_PROGRESS,
  parseBookyJourneyProgress, serializeBookyJourneyProgress, type BookyJourneyProgressPreference,
  type BookyJourneyProgressNode } from "./bookyJourneyProgress";
import { createBookyJourneyProgressStore } from "./bookyJourneyProgressStore";

// Structural fixtures only: no reviewed route or runtime admission is implied.
function progress(acknowledged = 0, revision = 4, journeyVersion = 1): BookyJourneyProgressPreference {
  const policyFingerprint = "a".repeat(64), journeyId = "fixture-journey";
  const nodes: BookyJourneyProgressNode[] = [
    { id: "country", kind: "country", screen: "globe", entity: { kind: "country", countryId: "fixture-country" } },
    { id: "checkpoint", kind: "checkpoint", screen: "globe", entity: null },
  ];
  const recordId = contentTextHash(JSON.stringify([policyFingerprint, journeyId, journeyVersion]));
  return { schemaVersion: 1, audience: "adult", revision, activeRecordId: recordId, records: [{
    recordId, policyFingerprint, journeyId, journeyVersion, locale: "en", definitionChecksum: "b".repeat(64),
    nodes, acknowledgedNodeIds: nodes.slice(0, acknowledged).map(node => node.id), resumeNodeId: nodes[acknowledged]?.id ?? null,
  }] };
}
const encode = (value: BookyJourneyProgressPreference) => serializeBookyJourneyProgress(value)!;
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let turn = 0; turn < 48; ++turn) await Promise.resolve(); }
function fixture(raw: string | null = null) {
  const memory = new Map<string, string>([["unrelated", "preserve"]]);
  if (raw !== null) memory.set(BOOKY_JOURNEY_PROGRESS_KEY, raw);
  const preferences = {
    persistence: "best-effort" as const,
    get: vi.fn<PreferenceStore["get"]>(async key => memory.get(key) ?? null),
    set: vi.fn<PreferenceStore["set"]>(async (key, value) => { memory.set(key, value); return true; }),
    remove: vi.fn<PreferenceStore["remove"]>(async key => { memory.delete(key); return true; }),
  };
  const store = createBookyJourneyProgressStore({ preferences, confirmationTimeoutMs: 100 });
  return { memory, preferences, store };
}

describe("Booky journey progress preference store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does no constructor IO and exposes only confirmed immutable progress", async () => {
    const f = fixture(encode(progress(1)));
    expect(f.preferences.get).not.toHaveBeenCalled();
    expect(f.store.getSnapshot()).toEqual({ state: "idle", preference: null, error: null, revision: 0 });
    expect(f.store.save(progress())).toBe(false); expect(f.store.clear()).toBe(false); expect(f.store.retry()).toBe(false);
    f.store.start(); expect(f.store.getSnapshot()).toMatchObject({ state: "loading", preference: null });
    expect(f.store.save(progress())).toBe(false); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "ready", preference: progress(1), error: null });
    expect(Object.isFrozen(f.store.getSnapshot())).toBe(true);
    expect(Object.isFrozen(f.store.getSnapshot().preference?.records[0].nodes[0].entity)).toBe(true);
    const confirmed = f.store.getSnapshot(); f.store.start(); expect(f.store.getSnapshot()).toBe(confirmed);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
    f.store.stop(); expect(f.store.getSnapshot()).toMatchObject({ state: "idle", preference: null });
  });

  it("hydrates authoritative absence to the frozen default without creating a preference", async () => {
    const f = fixture(); f.store.start(); await flush();
    expect(f.store.getSnapshot().preference).toBe(DEFAULT_BOOKY_JOURNEY_PROGRESS);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled(); f.store.stop();
  });

  it("waits for both the write and matching readback, with a store-owned revision", async () => {
    const f = fixture(encode(progress())), write = deferred<boolean>(), readback = deferred<string | null>();
    f.store.start(); await flush(); const before = f.store.getSnapshot();
    f.preferences.get.mockImplementationOnce(async key => f.memory.get(key) ?? null).mockReturnValueOnce(readback.promise);
    f.preferences.set.mockImplementationOnce(async (key, value) => {
      const accepted = await write.promise; if (accepted) f.memory.set(key, value); return accepted;
    });
    expect(f.store.save(progress(1, 900))).toBe(true); await flush();
    const serialized = f.preferences.set.mock.calls[0][1];
    expect(parseBookyJourneyProgress(serialized)).toEqual(progress(1, 5));
    expect(f.store.getSnapshot()).toMatchObject({ state: "saving", preference: null });
    write.resolve(true); await flush(); expect(f.store.getSnapshot().state).toBe("saving");
    readback.resolve(f.memory.get(BOOKY_JOURNEY_PROGRESS_KEY)!); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "ready", preference: progress(1, 5) });
    expect(f.store.getSnapshot().revision).toBeGreaterThan(before.revision); f.store.stop();
  });

  it("cannot confirm a true write result when readback still contains the previous value", async () => {
    const f = fixture(encode(progress())); f.store.start(); await flush();
    f.preferences.set.mockResolvedValueOnce(true); f.store.save(progress(1)); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "write", preference: null });
    expect(f.memory.get(BOOKY_JOURNEY_PROGRESS_KEY)).toBe(encode(progress()));
    const attempted = f.preferences.set.mock.calls[0][1]; expect(f.store.retry()).toBe(true); await flush();
    expect(f.preferences.set.mock.calls[1][1]).toBe(attempted);
    expect(f.store.getSnapshot()).toMatchObject({ state: "ready", preference: progress(1, 5) }); f.store.stop();
  });

  it("retains failed input exactly on retry and accepts an explicit replacement", async () => {
    const f = fixture(); f.store.start(); await flush(); f.preferences.set.mockResolvedValueOnce(false);
    f.store.save(progress(1)); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "write", preference: null });
    const attempted = f.preferences.set.mock.calls[0][1]; f.store.retry(); await flush();
    expect(f.preferences.set.mock.calls[1][1]).toBe(attempted);
    f.preferences.set.mockRejectedValueOnce(new Error("unavailable")); f.store.save(progress(2)); await flush();
    expect(f.store.save(progress(0))).toBe(true); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "ready", preference: progress(0, 3) });
    expect(f.store.retry()).toBe(false); f.store.stop();
  });

  it("keeps failed save intent through remount and never admits the older stored checkpoint", async () => {
    const f = fixture(encode(progress())); f.store.start(); await flush(); f.preferences.set.mockResolvedValueOnce(false);
    f.store.save(progress(1)); await flush(); const attempted = f.preferences.set.mock.calls[0][1]; f.store.stop();
    const next = createBookyJourneyProgressStore({ preferences: f.preferences }); next.start(); await flush();
    expect(next.getSnapshot()).toMatchObject({ state: "failed", error: "write", preference: null });
    expect(f.preferences.set).toHaveBeenCalledOnce(); next.retry(); await flush();
    expect(f.preferences.set.mock.calls[1][1]).toBe(attempted);
    expect(next.getSnapshot()).toMatchObject({ state: "ready", preference: progress(1, 5) }); next.stop();
  });

  it("rejects malformed input and accessors without mutating a confirmed snapshot", async () => {
    const f = fixture(); f.store.start(); await flush(); const before = f.store.getSnapshot();
    const getter = vi.fn(() => "adult"), malicious = { ...progress() };
    Object.defineProperty(malicious, "audience", { enumerable: true, get: getter });
    expect(f.store.save(malicious)).toBe(false);
    expect(f.store.save({ ...progress(), records: [] })).toBe(false);
    expect(f.store.getSnapshot()).toBe(before); expect(getter).not.toHaveBeenCalled();
    expect(f.preferences.set).not.toHaveBeenCalled(); f.store.stop();
  });

  it.each([
    ["{}", "invalid"], ['{"schemaVersion":2,"future":true}', "unsupported"],
    [" ".repeat(BOOKY_JOURNEY_PROGRESS_MAX_LENGTH + 1), "unsupported"],
  ] as const)("preserves protected input (%#) until an explicit clear", async (raw, error) => {
    const f = fixture(raw); f.store.start(); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", preference: null, error });
    expect(f.store.save(progress())).toBe(false); f.store.retry(); await flush();
    expect(f.memory.get(BOOKY_JOURNEY_PROGRESS_KEY)).toBe(raw);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
    f.store.clear(); await flush(); expect(f.store.getSnapshot().preference).toBe(DEFAULT_BOOKY_JOURNEY_PROGRESS);
    expect(f.preferences.remove).toHaveBeenCalledExactlyOnceWith(BOOKY_JOURNEY_PROGRESS_KEY);
    expect(f.memory.get("unrelated")).toBe("preserve"); expect(f.store.save(progress(1))).toBe(true); await flush();
    expect(f.store.getSnapshot().preference).toEqual(progress(1, 1)); f.store.stop();
  });

  it("protects a future format introduced after hydration before issuing a save", async () => {
    const f = fixture(encode(progress())); f.store.start(); await flush();
    const future = '{"schemaVersion":3,"future":"preserve"}'; f.memory.set(BOOKY_JOURNEY_PROGRESS_KEY, future);
    expect(f.store.save(progress(1))).toBe(true); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "unsupported", preference: null });
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.memory.get(BOOKY_JOURNEY_PROGRESS_KEY)).toBe(future);
    expect(f.store.save(progress(2))).toBe(false); f.store.clear(); await flush();
    expect(f.store.getSnapshot().preference).toBe(DEFAULT_BOOKY_JOURNEY_PROGRESS); f.store.stop();
  });

  it("keeps failed deletion of a future format distinct from a save across remount", async () => {
    const raw = '{"schemaVersion":2,"future":true}', f = fixture(raw);
    f.store.start(); await flush(); f.preferences.remove.mockResolvedValueOnce(false); f.store.clear(); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "write", preference: null }); f.store.stop();
    const next = createBookyJourneyProgressStore({ preferences: f.preferences }); next.start(); await flush();
    expect(next.getSnapshot()).toMatchObject({ state: "failed", error: "write", preference: null });
    expect(f.memory.get(BOOKY_JOURNEY_PROGRESS_KEY)).toBe(raw); expect(f.preferences.remove).toHaveBeenCalledOnce();
    expect(next.retry()).toBe(true); await flush(); expect(f.preferences.remove).toHaveBeenCalledTimes(2);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(next.getSnapshot().preference).toBe(DEFAULT_BOOKY_JOURNEY_PROGRESS);
    next.stop();
  });

  it("does not confirm deletion until readback is absent and retains deletion for retry", async () => {
    const f = fixture(encode(progress(1))); f.store.start(); await flush(); f.preferences.remove.mockResolvedValueOnce(true);
    f.store.clear(); await flush(); expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "write", preference: null });
    f.store.stop(); f.store.start(); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "write", preference: null });
    f.store.retry(); await flush(); expect(f.store.getSnapshot().preference).toBe(DEFAULT_BOOKY_JOURNEY_PROGRESS); f.store.stop();
  });

  it("bounds hydration and ignores a late old read after explicit clear", async () => {
    const f = fixture(), old = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(old.promise);
    f.store.start(); await flush(); await vi.advanceTimersByTimeAsync(101);
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "read", preference: null });
    expect(f.store.save(progress())).toBe(false); f.store.clear(); await flush();
    old.resolve(encode(progress(1))); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "ready", preference: DEFAULT_BOOKY_JOURNEY_PROGRESS }); f.store.stop();
  });

  it("retries a read failure while ignoring an out-of-order read from a stopped lifetime", async () => {
    const f = fixture(), old = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(old.promise);
    f.store.start(); await flush(); f.store.stop(); f.preferences.get.mockRejectedValueOnce(new Error("read-unavailable"));
    f.store.start(); await flush(); expect(f.store.getSnapshot().error).toBe("read");
    f.store.retry(); await flush(); old.resolve(encode(progress(2))); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "ready", preference: DEFAULT_BOOKY_JOURNEY_PROGRESS });
    expect(f.preferences.get).toHaveBeenCalledTimes(3); f.store.stop();
  });

  it("never allows a timed-out write to overtake a queued clear across unmount", async () => {
    const f = fixture(), write = deferred<boolean>(); f.store.start(); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => {
      const accepted = await write.promise; if (accepted) f.memory.set(key, value); return accepted;
    });
    f.store.save(progress(1)); await flush(); await vi.advanceTimersByTimeAsync(101);
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "write", preference: null });
    f.store.clear(); await flush(); f.store.stop();
    const next = createBookyJourneyProgressStore({ preferences: f.preferences, confirmationTimeoutMs: 100 });
    next.start(); await flush(); expect(f.preferences.remove).not.toHaveBeenCalled();
    write.resolve(true); await flush(); expect(f.preferences.remove).toHaveBeenCalledOnce();
    expect(f.memory.has(BOOKY_JOURNEY_PROGRESS_KEY)).toBe(false);
    expect(next.getSnapshot()).toMatchObject({ state: "ready", preference: DEFAULT_BOOKY_JOURNEY_PROGRESS });
    expect(f.store.getSnapshot()).toMatchObject({ state: "idle", preference: null }); next.stop();
  });

  it("retains its serial slot when readback itself times out", async () => {
    const f = fixture(), readback = deferred<string | null>(); f.store.start(); await flush();
    f.preferences.get.mockResolvedValueOnce(null).mockReturnValueOnce(readback.promise);
    f.store.save(progress(1)); await flush(); const pendingBytes = f.memory.get(BOOKY_JOURNEY_PROGRESS_KEY)!;
    await vi.advanceTimersByTimeAsync(101); expect(f.store.getSnapshot().error).toBe("write");
    f.store.clear(); await flush(); expect(f.preferences.remove).not.toHaveBeenCalled();
    readback.resolve(pendingBytes); await flush(); expect(f.preferences.remove).toHaveBeenCalledOnce();
    expect(f.store.getSnapshot().preference).toBe(DEFAULT_BOOKY_JOURNEY_PROGRESS); f.store.stop();
  });

  it("serializes all instances and coalesces unstarted replacements across remount", async () => {
    const f = fixture(), first = deferred<boolean>(); let running = 0, maximum = 0;
    const other = createBookyJourneyProgressStore({ preferences: f.preferences });
    f.store.start(); other.start(); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => {
      ++running; maximum = Math.max(maximum, running); await first.promise;
      f.memory.set(key, value); --running; return true;
    }).mockImplementation(async (key, value) => {
      ++running; maximum = Math.max(maximum, running); f.memory.set(key, value); --running; return true;
    });
    f.store.save(progress(0)); await flush(); other.save(progress(1)); other.save(progress(2));
    expect(f.store.getSnapshot()).toMatchObject({ state: "saving", preference: null }); f.store.stop(); other.stop();
    const next = createBookyJourneyProgressStore({ preferences: f.preferences }); next.start(); await flush();
    expect(f.preferences.set).toHaveBeenCalledOnce(); first.resolve(true); await flush();
    expect(maximum).toBe(1); expect(f.preferences.set).toHaveBeenCalledTimes(2);
    expect(next.getSnapshot()).toMatchObject({ state: "ready", preference: progress(2, 3) }); next.stop();
  });

  it("requires a new authoritative read after a remount read deadline despite a late write", async () => {
    const f = fixture(), write = deferred<boolean>(); f.store.start(); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await write.promise; f.memory.set(key, value); return true; });
    f.store.save(progress(1)); await flush(); f.store.stop();
    const next = createBookyJourneyProgressStore({ preferences: f.preferences, confirmationTimeoutMs: 100 });
    next.start(); await vi.advanceTimersByTimeAsync(101); write.resolve(true); await flush();
    expect(next.getSnapshot()).toMatchObject({ state: "failed", error: "read", preference: null });
    next.retry(); await flush(); expect(next.getSnapshot().preference).toEqual(progress(1, 1)); next.stop();
  });

  it("watches an already-running timed-out intent on retry without issuing a duplicate write", async () => {
    const f = fixture(), write = deferred<boolean>(); f.store.start(); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await write.promise; f.memory.set(key, value); return true; });
    f.store.save(progress(1)); await flush(); await vi.advanceTimersByTimeAsync(101);
    f.store.retry(); await flush(); expect(f.preferences.set).toHaveBeenCalledOnce();
    write.resolve(true); await flush(); expect(f.store.getSnapshot().preference).toEqual(progress(1, 1)); f.store.stop();
  });

  it("revokes every mounted observer when another reader discovers a future preference", async () => {
    const f = fixture(encode(progress(1))); f.store.start(); await flush();
    f.memory.set(BOOKY_JOURNEY_PROGRESS_KEY, '{"schemaVersion":2}');
    const other = createBookyJourneyProgressStore({ preferences: f.preferences }); other.start(); await flush();
    for (const store of [f.store, other]) {
      expect(store.getSnapshot()).toMatchObject({ state: "failed", error: "unsupported", preference: null });
      expect(store.save(progress(2))).toBe(false);
    }
    other.clear(); await flush(); expect(f.store.getSnapshot().preference).toBe(DEFAULT_BOOKY_JOURNEY_PROGRESS);
    f.store.stop(); other.stop();
  });

  it("does not silently overwrite a newer external revision and lets a new explicit save advance it", async () => {
    const f = fixture(encode(progress())); f.store.start(); await flush();
    f.memory.set(BOOKY_JOURNEY_PROGRESS_KEY, encode(progress(2, 20))); f.store.save(progress(1)); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "write", preference: null });
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.memory.get(BOOKY_JOURNEY_PROGRESS_KEY)).toBe(encode(progress(2, 20)));
    f.store.retry(); await flush(); expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.store.save(progress(1))).toBe(true); await flush();
    expect(f.store.getSnapshot().preference).toEqual(progress(1, 21)); f.store.stop();
  });

  it("preserves a write whose readback failed across remount until an explicit retry confirms it", async () => {
    const f = fixture(); f.store.start(); await flush();
    f.preferences.get.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("readback-unavailable"));
    f.store.save(progress(1)); await flush(); const attempted = f.preferences.set.mock.calls[0][1];
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "write", preference: null });
    f.store.stop(); f.store.start(); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "write", preference: null });
    expect(f.preferences.set).toHaveBeenCalledOnce(); f.store.retry(); await flush();
    expect(f.preferences.set.mock.calls[1][1]).toBe(attempted);
    expect(f.store.getSnapshot().preference).toEqual(progress(1, 1)); f.store.stop();
  });

  it("recovers an exhausted revision only after confirmed explicit deletion", async () => {
    const f = fixture(encode(progress(1, Number.MAX_SAFE_INTEGER))); f.store.start(); await flush();
    const before = f.store.getSnapshot(); expect(f.store.save(progress(2))).toBe(false); expect(f.store.getSnapshot()).toBe(before);
    f.store.clear(); await flush(); expect(f.store.getSnapshot().preference).toBe(DEFAULT_BOOKY_JOURNEY_PROGRESS);
    expect(f.store.save(progress())).toBe(true); await flush();
    expect(f.store.getSnapshot().preference).toEqual(progress(0, 1)); f.store.stop();
  });

  it("only reads unknown route-version checkpoints on stop/start and never resumes or acknowledges them", async () => {
    const retained = progress(1, 23, 900_000), bytes = encode(retained), f = fixture(bytes);
    for (let activation = 0; activation < 3; ++activation) {
      f.store.start(); await flush(); expect(f.store.getSnapshot().preference).toEqual(retained);
      await vi.advanceTimersByTimeAsync(30_000); f.store.stop();
    }
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
    expect(f.memory.get(BOOKY_JOURNEY_PROGRESS_KEY)).toBe(bytes);
  });

  it("uses a five-second default deadline and cleans up observer timers on stop", async () => {
    const f = fixture(), read = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(read.promise);
    const store = createBookyJourneyProgressStore({ preferences: f.preferences }); store.start(); await flush();
    await vi.advanceTimersByTimeAsync(4_999); expect(store.getSnapshot().state).toBe("loading");
    await vi.advanceTimersByTimeAsync(1); expect(store.getSnapshot()).toMatchObject({ state: "failed", error: "read", preference: null });
    store.stop(); expect(vi.getTimerCount()).toBe(0);
  });

  it("tolerates throwing observers and a reentrant stop without performing a stale mount read", async () => {
    const f = fixture(), listener = vi.fn(() => { throw new Error("view"); }); f.store.subscribe(listener);
    const unsubscribe = f.store.subscribe(() => { if (f.store.getSnapshot().state === "loading") f.store.stop(); });
    f.store.start(); await flush(); expect(f.preferences.get).not.toHaveBeenCalled();
    expect(f.store.getSnapshot().state).toBe("idle"); unsubscribe(); f.store.start(); await flush();
    expect(f.store.getSnapshot().state).toBe("ready"); f.store.stop();
  });
});
