import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreferenceStore } from "../platform/ports";
import { BOOKY_MOTION_PREFERENCE_KEY as KEY, createBookyMotionController, type BookyMotionMode } from "./bookyMotionPreference";

afterEach(() => vi.useRealTimers());
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let index = 0; index < 40; index++) await Promise.resolve(); }
function fixture(enabled = true, confirmationTimeoutMs = 100) {
  const memory = new Map<string, string>();
  const preferences = {
    persistence: "best-effort" as const,
    get: vi.fn<PreferenceStore["get"]>(async key => memory.get(key) ?? null),
    set: vi.fn<PreferenceStore["set"]>(async (key, value) => { memory.set(key, value); return true; }),
    remove: vi.fn<PreferenceStore["remove"]>(async key => memory.delete(key)),
  };
  const controller = createBookyMotionController({ preferences, enabled, confirmationTimeoutMs });
  return { memory, preferences, controller };
}
const ready = (mode: BookyMotionMode) => ({ mode, state: "ready", hydrated: true, error: null });
const failed = (mode: BookyMotionMode, error: "read" | "write") => ({ mode, state: "failed", hydrated: error === "write", error });

describe("Booky motion preference", () => {
  it("starts safely still with stable snapshots and no IO/default writes, then confirms absence", async () => {
    const f = fixture();
    expect(f.controller.getSnapshot()).toEqual({ mode: "system", state: "loading", hydrated: false, error: null });
    expect(f.controller.getSnapshot()).toBe(f.controller.getServerSnapshot());
    expect(Object.isFrozen(f.controller.getSnapshot())).toBe(true);
    expect(f.preferences.get).not.toHaveBeenCalled();
    expect(f.controller.selectMode("system")).toBe(false);
    const stop = f.controller.activate();
    expect(f.controller.selectMode("calm")).toBe(false);
    await flush(); expect(f.controller.getSnapshot()).toEqual(ready("system"));
    expect(f.preferences.get).toHaveBeenCalledExactlyOnceWith(KEY);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled(); stop();
  });
  it("keeps a disabled host untouched", async () => {
    const f = fixture(false), stop = f.controller.activate();
    expect(f.controller.getSnapshot()).toEqual(ready("system"));
    expect(f.controller.selectMode("calm")).toBe(false); expect(f.controller.retry()).toBe(false);
    await flush(); expect(f.preferences.get).not.toHaveBeenCalled(); expect(f.preferences.set).not.toHaveBeenCalled(); stop();
  });
  it.each(["calm", "system"] as const)("hydrates saved %s without rewriting old Booky progress", async mode => {
    const f = fixture(); f.memory.set(KEY, mode); f.memory.set("probpera-booky-adult-v1", "existing-progress");
    const stop = f.controller.activate(); await flush();
    expect(f.controller.getSnapshot()).toEqual(ready(mode)); stop();
    const stopAgain = f.controller.activate(); await flush();
    expect(f.preferences.get).toHaveBeenCalledTimes(1); expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.memory.get("probpera-booky-adult-v1")).toBe("existing-progress"); stopAgain();
  });
  it.each(["", "CALM", "calm ", "future", "{\"mode\":\"calm\"}"])("preserves invalid raw %j and denies choice until explicit successful read retry", async raw => {
    const f = fixture(); f.memory.set(KEY, raw); const stop = f.controller.activate(); await flush();
    expect(f.controller.getSnapshot()).toEqual(failed("system", "read"));
    expect(f.controller.selectMode("system")).toBe(false); expect(f.memory.get(KEY)).toBe(raw);
    expect(f.preferences.set).not.toHaveBeenCalled();
    f.memory.set(KEY, "calm"); expect(f.controller.retry()).toBe(true); await flush();
    expect(f.controller.getSnapshot()).toEqual(ready("calm")); expect(f.controller.retry()).toBe(false); stop();
  });
  it.each(["throw", "reject"])("retains safe unknown state on read %s", async behavior => {
    const f = fixture();
    f.preferences.get.mockImplementationOnce(() => { if (behavior === "throw") throw Error("private"); return Promise.reject(Error("private")); });
    const stop = f.controller.activate(); await flush(); expect(f.controller.getSnapshot()).toEqual(failed("system", "read"));
    expect(f.controller.selectMode("calm")).toBe(false); expect(f.preferences.set).not.toHaveBeenCalled(); stop();
  });
  it.each(["false", "reject", "throw", "mismatch", "readback"])("keeps the immediate local choice after write %s and explicitly retries it", async behavior => {
    const f = fixture(), stop = f.controller.activate(); await flush();
    if (behavior === "false") f.preferences.set.mockResolvedValueOnce(false);
    if (behavior === "reject") f.preferences.set.mockRejectedValueOnce(Error("private"));
    if (behavior === "throw") f.preferences.set.mockImplementationOnce(() => { throw Error("private"); });
    if (behavior === "mismatch") f.preferences.set.mockResolvedValueOnce(true);
    if (behavior === "readback") f.preferences.get.mockRejectedValueOnce(Error("private"));
    expect(f.controller.selectMode("calm")).toBe(true);
    expect(f.controller.getSnapshot()).toEqual({ mode: "calm", state: "saving", hydrated: true, error: null });
    await flush(); expect(f.controller.getSnapshot()).toEqual(failed("calm", "write"));
    expect(f.controller.retry()).toBe(true); await flush(); expect(f.controller.getSnapshot()).toEqual(ready("calm"));
    expect(f.memory.get(KEY)).toBe("calm"); stop();
  });
  it("coalesces queued choices and serializes an in-flight write ahead of the newest intent", async () => {
    const f = fixture(), stop = f.controller.activate(); await flush();
    const gate = deferred<void>(); f.preferences.set.mockImplementationOnce(async (key, value) => { await gate.promise; f.memory.set(key, value); return true; });
    f.controller.selectMode("calm"); await flush();
    f.controller.selectMode("system"); f.controller.selectMode("calm"); f.controller.selectMode("system"); await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(1); expect(f.controller.getSnapshot().mode).toBe("system");
    gate.resolve(); await flush();
    expect(f.preferences.set.mock.calls).toEqual([[KEY, "calm"], [KEY, "system"]]);
    expect(f.memory.get(KEY)).toBe("system"); expect(f.controller.getSnapshot()).toEqual(ready("system")); stop();
  });
  it("ignores a failed obsolete write while the latest choice is confirmed", async () => {
    const f = fixture(), stop = f.controller.activate(); await flush(); const gate = deferred<boolean>();
    f.preferences.set.mockReturnValueOnce(gate.promise); f.controller.selectMode("calm"); await flush();
    f.controller.selectMode("system"); gate.reject(Error("old failure")); await flush();
    expect(f.controller.getSnapshot()).toEqual(ready("system")); expect(f.memory.get(KEY)).toBe("system"); stop();
  });
  it("bounds unknown reads and ignores a late timed-out result until explicit retry", async () => {
    vi.useFakeTimers(); const f = fixture(), gate = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(gate.promise);
    const stop = f.controller.activate(); await flush(); await vi.advanceTimersByTimeAsync(100);
    expect(f.controller.getSnapshot()).toEqual(failed("system", "read"));
    gate.resolve("system"); await flush(); expect(f.controller.getSnapshot()).toEqual(failed("system", "read"));
    f.memory.set(KEY, "calm"); expect(f.controller.retry()).toBe(true); await flush();
    expect(f.controller.getSnapshot()).toEqual(ready("calm")); stop(); expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps a timed-out local choice while retries wait behind its noncancellable write", async () => {
    vi.useFakeTimers(); const f = fixture(), stop = f.controller.activate(); await flush(); const gate = deferred<void>();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await gate.promise; f.memory.set(key, value); return true; });
    f.controller.selectMode("calm"); await flush(); await vi.advanceTimersByTimeAsync(100);
    expect(f.controller.getSnapshot()).toEqual(failed("calm", "write")); f.controller.retry(); await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(1); gate.resolve(); await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(2); expect(f.controller.getSnapshot()).toEqual(ready("calm"));
    stop(); expect(vi.getTimerCount()).toBe(0);
  });
  it("skips unstarted StrictMode reads, suppresses inactive publications and hydrates a new activation", async () => {
    const f = fixture(), listener = vi.fn(), unsubscribe = f.controller.subscribe(listener);
    const stop = f.controller.activate(); stop(); stop(); const nextStop = f.controller.activate(); await flush();
    expect(f.preferences.get).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenCalledTimes(1); nextStop(); unsubscribe();
    const g = fixture(), gate = deferred<string | null>(), changed = vi.fn(); g.preferences.get.mockReturnValueOnce(gate.promise); g.controller.subscribe(changed);
    const gStop = g.controller.activate(); await flush(); gStop(); gate.resolve("system"); await flush();
    expect(changed).not.toHaveBeenCalled(); expect(g.controller.getSnapshot().hydrated).toBe(false);
    g.memory.set(KEY, "calm"); const gAgain = g.controller.activate(); await flush(); expect(g.controller.getSnapshot()).toEqual(ready("calm")); gAgain();
  });
  it("orders a new owner after old in-flight writes and skips old queued intentions", async () => {
    const f = fixture(), stop = f.controller.activate(); await flush(); const gate = deferred<void>();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await gate.promise; f.memory.set(key, value); return true; });
    f.controller.selectMode("calm"); await flush(); f.controller.selectMode("system"); stop();
    const old = f.controller.getSnapshot();
    const next = createBookyMotionController({ preferences: f.preferences, enabled: true }); const nextStop = next.activate();
    expect(next.selectMode("system")).toBe(false); await flush(); expect(f.preferences.get).toHaveBeenCalledTimes(1);
    gate.resolve(); await flush(); expect(next.getSnapshot()).toEqual(ready("calm"));
    expect(f.controller.getSnapshot()).toBe(old); expect(f.preferences.set).toHaveBeenCalledTimes(1);
    next.selectMode("system"); await flush(); expect(f.memory.get(KEY)).toBe("system"); nextStop();
  });
  it("resumes an explicit pending choice once after same-owner cleanup without default writes", async () => {
    const f = fixture(), stop = f.controller.activate(); await flush(); f.controller.selectMode("calm"); stop();
    const nextStop = f.controller.activate(); await flush();
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(KEY, "calm");
    expect(f.controller.getSnapshot()).toEqual(ready("calm")); nextStop();
  });
  it("handles subscriber reentrancy and invalid runtime values without racing newer intent", async () => {
    const f = fixture(), stop = f.controller.activate(); await flush();
    const unsubscribe = f.controller.subscribe(() => { if (f.controller.getSnapshot().mode === "calm") f.controller.selectMode("system"); });
    f.controller.selectMode("calm"); await flush();
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(KEY, "system"); expect(f.controller.getSnapshot()).toEqual(ready("system"));
    expect(f.controller.selectMode("invalid" as BookyMotionMode)).toBe(false); unsubscribe(); stop();
    expect(f.controller.selectMode("calm")).toBe(false); expect(f.controller.retry()).toBe(false);
  });
  it("replaces an unknown raw value only after explicit calm recovery and confirms its readback", async () => {
    const f = fixture(); f.memory.set(KEY, "future-motion-mode"); f.memory.set("probpera-booky-adult-v1", "existing-progress");
    const stop = f.controller.activate(); await flush();
    expect(f.controller.getSnapshot()).toEqual(failed("system", "read"));
    expect(f.memory.get(KEY)).toBe("future-motion-mode"); expect(f.preferences.set).not.toHaveBeenCalled();
    f.controller.retry(); await flush();
    expect(f.memory.get(KEY)).toBe("future-motion-mode"); expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.controller.recoverWithCalm()).toBe(true);
    expect(f.controller.getSnapshot()).toEqual({ mode: "calm", state: "saving", hydrated: true, error: null });
    expect(f.controller.recoverWithCalm()).toBe(false); await flush();
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(KEY, "calm");
    expect(f.preferences.get.mock.calls).toEqual([[KEY], [KEY], [KEY]]);
    expect(f.controller.getSnapshot()).toEqual(ready("calm")); expect(f.memory.get(KEY)).toBe("calm");
    expect(f.memory.get("probpera-booky-adult-v1")).toBe("existing-progress"); expect(f.preferences.remove).not.toHaveBeenCalled(); stop();
  });
  it.each(["false", "reject", "mismatch"])("keeps calm locally after recovery save %s and offers ordinary write retry", async behavior => {
    const f = fixture(); f.preferences.get.mockRejectedValueOnce(Error("unavailable read"));
    const stop = f.controller.activate(); await flush();
    if (behavior === "false") f.preferences.set.mockResolvedValueOnce(false);
    if (behavior === "reject") f.preferences.set.mockRejectedValueOnce(Error("unavailable write"));
    if (behavior === "mismatch") f.preferences.set.mockResolvedValueOnce(true);
    expect(f.controller.recoverWithCalm()).toBe(true); await flush();
    expect(f.controller.getSnapshot()).toEqual(failed("calm", "write")); expect(f.controller.recoverWithCalm()).toBe(false);
    expect(f.controller.retry()).toBe(true); await flush();
    expect(f.controller.getSnapshot()).toEqual(ready("calm")); expect(f.memory.get(KEY)).toBe("calm"); stop();
  });
  it("rejects inactive, disabled and stale recovery after an ordinary read retry begins or succeeds", async () => {
    const f = fixture(); f.memory.set(KEY, "unknown");
    expect(f.controller.recoverWithCalm()).toBe(false); const stop = f.controller.activate();
    expect(f.controller.recoverWithCalm()).toBe(false); await flush();
    f.memory.set(KEY, "system"); expect(f.controller.retry()).toBe(true);
    expect(f.controller.recoverWithCalm()).toBe(false); await flush();
    expect(f.controller.getSnapshot()).toEqual(ready("system")); expect(f.controller.recoverWithCalm()).toBe(false);
    expect(f.preferences.set).not.toHaveBeenCalled(); stop();
    const g = fixture(); g.memory.set(KEY, "unknown"); const gStop = g.controller.activate(); await flush(); gStop();
    expect(g.controller.recoverWithCalm()).toBe(false); expect(g.memory.get(KEY)).toBe("unknown"); expect(g.preferences.set).not.toHaveBeenCalled();
    const off = fixture(false), offStop = off.controller.activate(); expect(off.controller.recoverWithCalm()).toBe(false);
    await flush(); expect(off.preferences.get).not.toHaveBeenCalled(); expect(off.preferences.set).not.toHaveBeenCalled(); offStop();
  });
  it("skips an unstarted recovery write on cleanup and serializes its deliberate restart", async () => {
    const f = fixture(); f.memory.set(KEY, "unknown"); const stop = f.controller.activate(); await flush();
    expect(f.controller.recoverWithCalm()).toBe(true); stop(); await flush();
    expect(f.memory.get(KEY)).toBe("unknown"); expect(f.preferences.set).not.toHaveBeenCalled();
    const again = f.controller.activate(); await flush();
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(KEY, "calm"); expect(f.controller.getSnapshot()).toEqual(ready("calm")); again();
  });
});
