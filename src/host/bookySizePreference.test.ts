import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreferenceStore } from "../platform/ports";
import { BOOKY_COMPANION_SIZES, BOOKY_SIZE_PREFERENCE_KEY as KEY, createBookySizeController,
  type BookyCompanionSize, type BookySizeController } from "./bookySizePreference";

const cleanups: (() => void)[] = [];
afterEach(() => { for (const stop of cleanups.splice(0).reverse()) stop(); vi.useRealTimers(); });
function activate(controller: BookySizeController) {
  const stop = controller.activate(); cleanups.push(stop); return stop;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
async function flush() { for (let index = 0; index < 40; index++) await Promise.resolve(); }
function fixture(enabled = true, confirmationTimeoutMs = 100) {
  const memory = new Map<string, string>([
    ["probpera-booky-adult-v1", "existing-progress"], ["probpera-booky-motion-v1", "calm"],
  ]);
  const preferences = {
    persistence: "best-effort" as const,
    get: vi.fn<PreferenceStore["get"]>(async key => memory.get(key) ?? null),
    set: vi.fn<PreferenceStore["set"]>(async (key, value) => { memory.set(key, value); return true; }),
    remove: vi.fn<PreferenceStore["remove"]>(async key => memory.delete(key)),
  };
  const controller = createBookySizeController({ preferences, enabled, confirmationTimeoutMs });
  return { memory, preferences, controller };
}
const ready = (size: BookyCompanionSize) => ({ size, state: "ready", error: null });
const failed = (size: BookyCompanionSize, error: "read" | "write") => ({ size, state: "failed", error });
const saving = (size: BookyCompanionSize) => ({ size, state: "saving", error: null });
function unrelatedUntouched(f: ReturnType<typeof fixture>) {
  expect(f.memory.get("probpera-booky-adult-v1")).toBe("existing-progress");
  expect(f.memory.get("probpera-booky-motion-v1")).toBe("calm");
  expect(f.preferences.remove).not.toHaveBeenCalled();
  expect([...f.preferences.get.mock.calls, ...f.preferences.set.mock.calls].every(([key]) => key === KEY)).toBe(true);
}

describe("Booky size preference", () => {
  it("keeps a disabled host normal without any preference IO", async () => {
    const f = fixture(false); activate(f.controller);
    expect(f.controller.getSnapshot()).toEqual(ready("normal"));
    expect(f.controller.getServerSnapshot()).toBe(f.controller.getSnapshot());
    expect(f.controller.selectSize("large")).toBe(false); expect(f.controller.retry()).toBe(false);
    await flush();
    expect(f.preferences.get).not.toHaveBeenCalled(); expect(f.preferences.set).not.toHaveBeenCalled();
    unrelatedUntouched(f);
  });

  it("confirms absence without default writes and bounds activation and timeout inputs", async () => {
    const f = fixture();
    expect(KEY).toBe("probpera-booky-size-v1"); expect(BOOKY_COMPANION_SIZES).toEqual(["small", "normal", "large"]);
    expect(f.controller.getSnapshot()).toEqual({ size: "normal", state: "loading", error: null });
    expect(f.controller.getSnapshot()).toBe(f.controller.getServerSnapshot());
    expect(Object.isFrozen(f.controller.getSnapshot())).toBe(true);
    expect(f.preferences.get).not.toHaveBeenCalled(); expect(f.controller.selectSize("small")).toBe(false);
    for (const confirmationTimeoutMs of [0, 60_001, 1.5, NaN, Infinity]) {
      expect(() => createBookySizeController({ preferences: f.preferences, enabled: true, confirmationTimeoutMs })).toThrow();
    }
    for (const confirmationTimeoutMs of [1, 60_000]) {
      expect(() => createBookySizeController({ preferences: f.preferences, enabled: true, confirmationTimeoutMs })).not.toThrow();
    }
    const stop = activate(f.controller); await flush();
    expect(f.controller.getSnapshot()).toEqual(ready("normal"));
    expect(f.preferences.get).toHaveBeenCalledExactlyOnceWith(KEY); expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.controller.selectSize("normal")).toBe(false);
    expect(f.controller.selectSize("NORMAL" as BookyCompanionSize)).toBe(false);
    expect(f.controller.retry()).toBe(false); stop();
    expect(f.controller.selectSize("large")).toBe(false); expect(f.controller.retry()).toBe(false);
    unrelatedUntouched(f);
  });

  it("restores each saved size in a fresh owner after a confirmed choice", async () => {
    for (const size of BOOKY_COMPANION_SIZES) {
      const f = fixture(); f.memory.set(KEY, size === "normal" ? "small" : "normal");
      const stop = activate(f.controller); await flush();
      expect(f.controller.selectSize(size)).toBe(true); await flush();
      expect(f.controller.getSnapshot()).toEqual(ready(size)); expect(f.memory.get(KEY)).toBe(size); stop();
      const next = createBookySizeController({ preferences: f.preferences, enabled: true, confirmationTimeoutMs: 100 });
      const nextStop = activate(next); await flush();
      expect(next.getSnapshot()).toEqual(ready(size));
      expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(KEY, size);
      expect(f.preferences.get.mock.calls).toEqual([[KEY], [KEY], [KEY]]);
      unrelatedUntouched(f); nextStop();
    }
  });

  it("preserves unknown bytes and read failures until an explicit normal choice", async () => {
    for (const entry of [{ raw: "future-size" }, { raw: "large " }, { raw: '{"size":"large"}' },
      { raw: "future-size", rejectRead: true }]) {
      const f = fixture(); f.memory.set(KEY, entry.raw);
      if (entry.rejectRead) f.preferences.get.mockRejectedValueOnce(Error("unavailable read"));
      const stop = activate(f.controller); await flush();
      expect(f.controller.getSnapshot()).toEqual(failed("normal", "read"));
      expect(f.memory.get(KEY)).toBe(entry.raw); expect(f.preferences.set).not.toHaveBeenCalled(); stop();
      const resumed = activate(f.controller); await flush();
      expect(f.preferences.get).toHaveBeenCalledTimes(1);
      expect(f.controller.getSnapshot()).toEqual(failed("normal", "read"));
      expect(f.controller.selectSize("normal")).toBe(true);
      expect(f.controller.getSnapshot()).toEqual(saving("normal")); await flush();
      expect(f.controller.getSnapshot()).toEqual(ready("normal"));
      expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(KEY, "normal");
      unrelatedUntouched(f); resumed();
    }
  });

  it("applies an immediate local choice while a late authoritative read is still pending", async () => {
    const f = fixture(), read = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(read.promise);
    activate(f.controller); await flush(); expect(f.preferences.get).toHaveBeenCalledTimes(1);
    expect(f.controller.selectSize("small")).toBe(true);
    expect(f.controller.getSnapshot()).toEqual(saving("small"));
    expect(f.controller.selectSize("small")).toBe(false); await flush();
    expect(f.controller.getSnapshot()).toEqual(ready("small")); expect(f.memory.get(KEY)).toBe("small");
    const committed = f.controller.getSnapshot(); read.resolve("large"); await flush();
    expect(f.controller.getSnapshot()).toBe(committed);
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(KEY, "small"); unrelatedUntouched(f);
  });

  it("serializes a started old-owner write before the newest remounted-owner choice", async () => {
    const f = fixture(), stop = activate(f.controller); await flush(); const write = deferred<void>();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await write.promise; f.memory.set(key, value); return true; });
    f.controller.selectSize("small"); await flush(); f.controller.selectSize("normal"); stop();
    const retired = f.controller.getSnapshot();
    const next = createBookySizeController({ preferences: f.preferences, enabled: true, confirmationTimeoutMs: 100 });
    activate(next); await flush(); expect(f.preferences.get).toHaveBeenCalledTimes(1);
    expect(next.selectSize("large")).toBe(true); await flush();
    expect(next.getSnapshot()).toEqual(saving("large")); expect(f.preferences.set).toHaveBeenCalledTimes(1);
    write.resolve(); await flush();
    expect(f.preferences.set.mock.calls).toEqual([[KEY, "small"], [KEY, "large"]]);
    expect(next.getSnapshot()).toEqual(ready("large")); expect(f.memory.get(KEY)).toBe("large");
    expect(f.controller.getSnapshot()).toBe(retired); unrelatedUntouched(f);
  });

  it("requires exact readback and retains a failed local choice until explicit write retry", async () => {
    for (const behavior of ["false", "reject", "throw", "mismatch", "readback"]) {
      const f = fixture(), stop = activate(f.controller); await flush();
      if (behavior === "false") f.preferences.set.mockResolvedValueOnce(false);
      if (behavior === "reject") f.preferences.set.mockRejectedValueOnce(Error("unavailable write"));
      if (behavior === "throw") f.preferences.set.mockImplementationOnce(() => { throw Error("unavailable write"); });
      if (behavior === "mismatch") f.preferences.set.mockResolvedValueOnce(true);
      if (behavior === "readback") f.preferences.get.mockRejectedValueOnce(Error("unavailable readback"));
      expect(f.controller.selectSize("large")).toBe(true); expect(f.controller.getSnapshot()).toEqual(saving("large"));
      await flush(); expect(f.controller.getSnapshot()).toEqual(failed("large", "write")); stop();
      const resumed = activate(f.controller); await flush();
      expect(f.preferences.set).toHaveBeenCalledTimes(1);
      expect(f.controller.getSnapshot()).toEqual(failed("large", "write"));
      expect(f.controller.retry()).toBe(true); await flush();
      expect(f.controller.getSnapshot()).toEqual(ready("large")); expect(f.memory.get(KEY)).toBe("large");
      expect(f.preferences.set).toHaveBeenCalledTimes(2); expect(f.controller.retry()).toBe(false);
      unrelatedUntouched(f); resumed();
    }
  });

  it("retries a timed-out read without waiting for the old hung read", async () => {
    vi.useFakeTimers(); const f = fixture(), read = deferred<string | null>();
    f.preferences.get.mockReturnValueOnce(read.promise); const stop = activate(f.controller); await flush();
    await vi.advanceTimersByTimeAsync(100); expect(f.controller.getSnapshot()).toEqual(failed("normal", "read"));
    f.memory.set(KEY, "large"); expect(f.controller.retry()).toBe(true); await flush();
    expect(f.preferences.get).toHaveBeenCalledTimes(2); expect(f.controller.getSnapshot()).toEqual(ready("large"));
    const committed = f.controller.getSnapshot(); read.resolve("small"); await flush();
    expect(f.controller.getSnapshot()).toBe(committed); expect(f.preferences.set).not.toHaveBeenCalled();
    stop(); expect(vi.getTimerCount()).toBe(0); unrelatedUntouched(f);
  });

  it("keeps a timed-out write serialized while cleanup and reactivation retain the latest explicit intent", async () => {
    vi.useFakeTimers(); const f = fixture(), stop = activate(f.controller); await flush(); const write = deferred<void>();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await write.promise; f.memory.set(key, value); return true; });
    f.controller.selectSize("small"); await flush(); await vi.advanceTimersByTimeAsync(100);
    expect(f.controller.getSnapshot()).toEqual(failed("small", "write"));
    expect(f.controller.retry()).toBe(true); expect(f.controller.selectSize("large")).toBe(true); await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(1); expect(f.controller.getSnapshot()).toEqual(saving("large"));
    stop(); const retired = f.controller.getSnapshot(); expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(500); expect(f.controller.getSnapshot()).toBe(retired);
    const resumed = activate(f.controller); await flush(); expect(f.preferences.set).toHaveBeenCalledTimes(1);
    write.resolve(); await flush();
    expect(f.preferences.set.mock.calls).toEqual([[KEY, "small"], [KEY, "large"]]);
    expect(f.controller.getSnapshot()).toEqual(ready("large")); expect(f.memory.get(KEY)).toBe("large");
    resumed(); expect(vi.getTimerCount()).toBe(0); unrelatedUntouched(f);
  });

  it("fences late publications and restores the chosen size in a reentrant owner", async () => {
    const f = fixture(), read = deferred<string | null>(), listener = vi.fn();
    f.preferences.get.mockReturnValueOnce(read.promise); const unsubscribe = f.controller.subscribe(listener);
    const stop = activate(f.controller); await flush(); stop();
    const retired = f.controller.getSnapshot(), publications = listener.mock.calls.length;
    read.resolve("large"); await flush();
    expect(f.controller.getSnapshot()).toBe(retired); expect(listener).toHaveBeenCalledTimes(publications);
    f.memory.set(KEY, "small"); const again = activate(f.controller); await flush();
    expect(f.controller.getSnapshot()).toEqual(ready("small")); expect(f.preferences.get).toHaveBeenCalledTimes(2); again();
    f.memory.set(KEY, "large"); unsubscribe(); const count = listener.mock.calls.length;
    activate(f.controller); await flush(); expect(f.controller.getSnapshot()).toEqual(ready("large"));
    expect(listener).toHaveBeenCalledTimes(count); expect(f.preferences.set).not.toHaveBeenCalled();
    const next = createBookySizeController({ preferences: f.preferences, enabled: true, confirmationTimeoutMs: 100 });
    const write = deferred<void>(); let joined = false;
    f.preferences.set.mockImplementationOnce(async (key, value) => { await write.promise; f.memory.set(key, value); return true; });
    const leave = f.controller.subscribe(() => {
      if (!joined && f.controller.getSnapshot().state === "saving") { joined = true; activate(next); }
    });
    expect(f.controller.selectSize("small")).toBe(true); expect(joined).toBe(true);
    expect(f.controller.selectSize("small")).toBe(false); await flush();
    expect(next.getSnapshot()).toEqual({ size: "normal", state: "loading", error: null });
    expect(f.preferences.get).toHaveBeenCalledTimes(3); expect(f.preferences.set).toHaveBeenCalledTimes(1);
    write.resolve(); await flush();
    expect(f.controller.getSnapshot()).toEqual(ready("small")); expect(next.getSnapshot()).toEqual(ready("small"));
    expect(f.memory.get(KEY)).toBe("small"); leave(); unrelatedUntouched(f);
  });
});
