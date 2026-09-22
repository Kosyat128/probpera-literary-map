import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PreferenceStore } from "../platform/ports";
import { BOOKY_READER_POLICY_KEY, parseBookyReaderPolicy } from "./bookyReaderPolicy";
import { createBookyReaderPolicyStore } from "./bookyReaderPolicyStore";

const date = "2026-09-23T00:00:00.000Z";
const input = { age: 35, readingLevel: "fluent" } as const;
const saved = { schemaVersion: 1, audience: "adult", ...input, confirmedAt: date, revision: 4 };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let turn = 0; turn < 32; ++turn) await Promise.resolve(); }
function fixture(raw: string | null = null) {
  const memory = new Map<string, string>([["unrelated", "preserve"]]);
  if (raw !== null) memory.set(BOOKY_READER_POLICY_KEY, raw);
  const preferences = {
    persistence: "best-effort" as const,
    get: vi.fn<PreferenceStore["get"]>(async key => memory.get(key) ?? null),
    set: vi.fn<PreferenceStore["set"]>(async (key, value) => { memory.set(key, value); return true; }),
    remove: vi.fn<PreferenceStore["remove"]>(async key => { memory.delete(key); return true; }),
  };
  const store = createBookyReaderPolicyStore({ preferences, confirmationTimeoutMs: 100 });
  return { memory, preferences, store };
}

describe("Booky reader policy store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does no constructor IO, rejects premature saves and hydrates only through an authoritative read", async () => {
    const f = fixture(JSON.stringify(saved));
    expect(f.preferences.get).not.toHaveBeenCalled();
    expect(f.store.getSnapshot()).toEqual({ state: "idle", policy: null, error: null, revision: 0 });
    expect(f.store.save(input, date)).toBe(false); expect(f.store.clear()).toBe(false);
    f.store.start(); expect(f.store.getSnapshot().policy).toBeNull();
    expect(f.store.save(input, date)).toBe(false); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "ready", policy: saved, error: null });
    expect(Object.isFrozen(f.store.getSnapshot().policy)).toBe(true);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
    f.store.stop(); expect(f.store.getSnapshot()).toMatchObject({ state: "idle", policy: null });
  });

  it("keeps new and previous values unavailable until the explicit replacement write confirms", async () => {
    const f = fixture(JSON.stringify(saved)), write = deferred<boolean>();
    f.store.start(); await flush(); const previous = f.store.getSnapshot();
    f.preferences.set.mockReturnValueOnce(write.promise);
    expect(f.store.save({ age: 36, readingLevel: "plain" }, date)).toBe(true);
    expect(f.store.getSnapshot()).toMatchObject({ state: "saving", policy: null, error: null }); await flush();
    expect(parseBookyReaderPolicy(f.preferences.set.mock.calls[0][1])).toEqual({ ...saved, age: 36, readingLevel: "plain", revision: 5 });
    write.resolve(true); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "ready", policy: { age: 36, readingLevel: "plain", revision: 5 } });
    expect(f.store.getSnapshot().revision).toBeGreaterThan(previous.revision); f.store.stop();
  });

  it("does not mutate storage or a ready snapshot for invalid input", async () => {
    const f = fixture(); f.store.start(); await flush(); const before = f.store.getSnapshot();
    expect(f.store.save({ age: 17, readingLevel: "plain" }, date)).toBe(false);
    expect(f.store.save(input, "2026-02-30T00:00:00.000Z")).toBe(false);
    expect(f.store.getSnapshot()).toBe(before); expect(f.preferences.set).not.toHaveBeenCalled(); f.store.stop();
  });

  it.each([["{}", "invalid"], ['{"schemaVersion":2,"future":true}', "unsupported"]] as const)(
    "preserves %s until the user explicitly clears only this key", async (raw, error) => {
      const f = fixture(raw); f.store.start(); await flush();
      expect(f.store.getSnapshot()).toMatchObject({ state: "failed", policy: null, error });
      expect(f.store.save(input, date)).toBe(false); expect(f.store.retry()).toBe(true); await flush();
      expect(f.memory.get(BOOKY_READER_POLICY_KEY)).toBe(raw); expect(f.preferences.set).not.toHaveBeenCalled();
      expect(f.store.clear()).toBe(true); expect(f.store.getSnapshot().policy).toBeNull(); await flush();
      expect(f.preferences.remove).toHaveBeenCalledExactlyOnceWith(BOOKY_READER_POLICY_KEY);
      expect(f.store.getSnapshot()).toMatchObject({ state: "ready", policy: null, error: null });
      expect(f.memory.get("unrelated")).toBe("preserve");
      expect(f.store.save(input, date)).toBe(true); await flush(); expect(f.store.getSnapshot().policy?.age).toBe(35); f.store.stop();
    });

  it("bounds read confirmation and ignores a late read after explicit reset", async () => {
    const f = fixture(), old = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(old.promise);
    f.store.start(); await flush(); await vi.advanceTimersByTimeAsync(101);
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "read", policy: null });
    expect(f.store.save(input, date)).toBe(false);
    f.store.clear(); await flush(); expect(f.store.getSnapshot().state).toBe("ready");
    old.resolve(JSON.stringify(saved)); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "ready", policy: null }); f.store.stop();
  });

  it("retries a rejected read and ignores an out-of-order read from a stopped lifetime", async () => {
    const f = fixture(), old = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(old.promise);
    f.store.start(); await flush(); f.store.stop();
    f.preferences.get.mockRejectedValueOnce(new Error("unavailable"));
    f.store.start(); await flush(); expect(f.store.getSnapshot().error).toBe("read");
    expect(f.store.retry()).toBe(true); await flush();
    old.resolve(JSON.stringify(saved)); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "ready", policy: null, error: null });
    expect(f.preferences.get).toHaveBeenCalledTimes(3); f.store.stop();
  });

  it("retains failed input for explicit retry and permits a deliberate replacement after failure", async () => {
    const f = fixture(); f.store.start(); await flush(); f.preferences.set.mockResolvedValueOnce(false);
    f.store.save(input, date); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "write", policy: null });
    const serialized = f.preferences.set.mock.calls[0][1]; expect(f.store.retry()).toBe(true); await flush();
    expect(f.preferences.set.mock.calls[1][1]).toBe(serialized);
    f.preferences.set.mockRejectedValueOnce(new Error("offline")); f.store.save({ ...input, age: 36 }, date); await flush();
    expect(f.store.save({ ...input, age: 37 }, date)).toBe(true); await flush();
    expect(f.store.getSnapshot().policy?.age).toBe(37); expect(f.store.retry()).toBe(false); f.store.stop();
  });

  it("never lets a timed-out unabortable save overtake a later clear across unmount", async () => {
    const f = fixture(), write = deferred<boolean>(); f.store.start(); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => {
      const accepted = await write.promise; if (accepted) f.memory.set(key, value); return accepted;
    });
    f.store.save(input, date); await flush(); await vi.advanceTimersByTimeAsync(101);
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "write", policy: null });
    f.store.clear(); await flush(); f.store.stop();
    const next = createBookyReaderPolicyStore({ preferences: f.preferences, confirmationTimeoutMs: 100 });
    next.start(); await flush(); expect(next.getSnapshot().policy).toBeNull();
    expect(f.preferences.remove).not.toHaveBeenCalled(); write.resolve(true); await flush();
    expect(f.preferences.remove).toHaveBeenCalledOnce(); expect(f.memory.has(BOOKY_READER_POLICY_KEY)).toBe(false);
    expect(next.getSnapshot()).toMatchObject({ state: "ready", policy: null });
    expect(f.store.getSnapshot()).toMatchObject({ state: "idle", policy: null }); next.stop();
  });

  it("keeps latest queued save intent across unmount and coalesces unstarted replacements", async () => {
    const f = fixture(), first = deferred<boolean>(); f.store.start(); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await first.promise; f.memory.set(key, value); return true; });
    f.store.save(input, date); await flush();
    f.store.save({ ...input, age: 36 }, date); f.store.save({ ...input, age: 37 }, date); f.store.stop();
    const next = createBookyReaderPolicyStore({ preferences: f.preferences }); next.start(); await flush();
    first.resolve(true); await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(2);
    expect(next.getSnapshot()).toMatchObject({ state: "ready", policy: { age: 37 } }); next.stop();
  });

  it("retains failed reset across remount and does not reauthorize the previous stored policy", async () => {
    const f = fixture(JSON.stringify(saved)); f.store.start(); await flush(); f.preferences.remove.mockResolvedValueOnce(false);
    f.store.clear(); await flush(); f.store.stop();
    const next = createBookyReaderPolicyStore({ preferences: f.preferences }); next.start(); await flush();
    expect(next.getSnapshot()).toMatchObject({ state: "failed", error: "write", policy: null });
    expect(next.retry()).toBe(true); await flush(); expect(f.memory.has(BOOKY_READER_POLICY_KEY)).toBe(false);
    expect(next.getSnapshot()).toMatchObject({ state: "ready", policy: null, error: null }); next.stop();
  });

  it("revokes all mounted readers immediately for a concurrent explicit clear", async () => {
    const f = fixture(JSON.stringify(saved)), clear = deferred<boolean>();
    const other = createBookyReaderPolicyStore({ preferences: f.preferences }); f.store.start(); other.start(); await flush();
    f.preferences.remove.mockReturnValueOnce(clear.promise);
    f.store.clear(); expect(other.getSnapshot()).toMatchObject({ state: "saving", policy: null }); await flush();
    clear.resolve(true); await flush(); expect(other.getSnapshot()).toMatchObject({ state: "ready", policy: null });
    f.store.stop(); other.stop();
  });

  it("never uses an old write confirmation after a new mount's authoritative-read deadline", async () => {
    const f = fixture(), write = deferred<boolean>(); f.store.start(); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await write.promise; f.memory.set(key, value); return true; });
    f.store.save(input, date); await flush(); f.store.stop();
    const next = createBookyReaderPolicyStore({ preferences: f.preferences, confirmationTimeoutMs: 100 });
    next.start(); await vi.advanceTimersByTimeAsync(101); write.resolve(true); await flush();
    expect(next.getSnapshot()).toMatchObject({ state: "failed", error: "read", policy: null });
    expect(next.retry()).toBe(true); await flush(); expect(next.getSnapshot().policy?.age).toBe(35); next.stop();
  });

  it("reuses a still-running write on retry without releasing serialization ownership", async () => {
    const f = fixture(), write = deferred<boolean>(); f.store.start(); await flush(); f.preferences.set.mockReturnValueOnce(write.promise);
    f.store.save(input, date); await flush(); await vi.advanceTimersByTimeAsync(101);
    expect(f.store.retry()).toBe(true); await flush(); expect(f.preferences.set).toHaveBeenCalledOnce();
    write.resolve(true); await flush(); expect(f.store.getSnapshot().policy?.age).toBe(35); f.store.stop();
  });

  it("rechecks cold storage after a confirmed write and preserves a newly unsupported format", async () => {
    const f = fixture(); f.store.start(); await flush(); f.store.save(input, date); await flush(); f.store.stop();
    f.memory.set(BOOKY_READER_POLICY_KEY, '{"schemaVersion":3}'); f.store.start(); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "failed", error: "unsupported", policy: null });
    expect(f.store.save(input, date)).toBe(false); expect(f.preferences.set).toHaveBeenCalledOnce(); f.store.stop();
  });

  it("revokes an existing reader when another mounted reader discovers unsupported storage", async () => {
    const f = fixture(JSON.stringify(saved)); f.store.start(); await flush();
    f.memory.set(BOOKY_READER_POLICY_KEY, '{"schemaVersion":2}');
    const other = createBookyReaderPolicyStore({ preferences: f.preferences }); other.start(); await flush();
    for (const store of [f.store, other]) {
      expect(store.getSnapshot()).toMatchObject({ state: "failed", error: "unsupported", policy: null });
      expect(store.save(input, date)).toBe(false);
    }
    other.clear(); await flush();
    expect(f.store.getSnapshot()).toMatchObject({ state: "ready", policy: null }); f.store.stop(); other.stop();
  });

  it("uses a five-second default read deadline and releases observer timers on stop", async () => {
    const f = fixture(), pending = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(pending.promise);
    const store = createBookyReaderPolicyStore({ preferences: f.preferences }); store.start(); await flush();
    await vi.advanceTimersByTimeAsync(4_999); expect(store.getSnapshot().state).toBe("loading");
    await vi.advanceTimersByTimeAsync(1); expect(store.getSnapshot()).toMatchObject({ state: "failed", error: "read", policy: null });
    store.stop(); expect(vi.getTimerCount()).toBe(0);
  });

  it("handles reentrant stop and throwing subscribers without doing a stale mount read", async () => {
    const f = fixture(), listener = vi.fn(() => { throw new Error("view"); }); f.store.subscribe(listener);
    const stop = f.store.subscribe(() => { if (f.store.getSnapshot().state === "loading") f.store.stop(); });
    f.store.start(); await flush(); expect(f.preferences.get).not.toHaveBeenCalled();
    expect(f.store.getSnapshot().state).toBe("idle"); stop(); f.store.start(); await flush();
    expect(f.store.getSnapshot().state).toBe("ready"); f.store.stop();
  });
});
