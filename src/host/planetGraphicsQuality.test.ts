import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobeQualityTier } from "../components/globeQuality";
import type { PreferenceStore } from "../platform/ports";
import {
  createPlanetGraphicsQualityController,
  PLANET_GRAPHICS_CONFIRMATION_TIMEOUT_MS,
  PLANET_GRAPHICS_QUALITY_KEY,
} from "./planetGraphicsQuality";

afterEach(() => { vi.useRealTimers(); });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function flush() {
  for (let turn = 0; turn < 32; turn += 1) await Promise.resolve();
}

function fixture(enabled = true) {
  const memory = new Map<string, string>();
  const preferences = {
    persistence: "best-effort" as const,
    get: vi.fn<PreferenceStore["get"]>(async key => memory.get(key) ?? null),
    set: vi.fn<PreferenceStore["set"]>(async (key, value) => { memory.set(key, value); return true; }),
    remove: vi.fn<PreferenceStore["remove"]>(async key => memory.delete(key)),
  };
  const controller = createPlanetGraphicsQualityController({ preferences, enabled });
  return { memory, preferences, controller };
}

describe("planet graphics quality preference controller", () => {
  it("starts immediately at High without constructor IO or automatic default writes", async () => {
    const f = fixture();
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "high", saveState: "idle" });
    expect(f.controller.getSnapshot()).toBe(f.controller.getSnapshot());
    expect(Object.isFrozen(f.controller.getSnapshot())).toBe(true);
    expect(f.preferences.get).not.toHaveBeenCalled();
    const stop = f.controller.activate();
    await flush();
    expect(f.preferences.get).toHaveBeenCalledExactlyOnceWith(PLANET_GRAPHICS_QUALITY_KEY);
    expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().qualityTier).toBe("high");
    stop();
  });

  it("performs no preference IO or selection changes for the disabled website", async () => {
    const f = fixture(false);
    f.memory.set(PLANET_GRAPHICS_QUALITY_KEY, "economy");
    const stop = f.controller.activate();
    expect(f.controller.selectQuality("balanced")).toBe(false);
    await flush();
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "high", saveState: "idle" });
    expect(f.preferences.get).not.toHaveBeenCalled();
    expect(f.preferences.set).not.toHaveBeenCalled();
    stop();
  });

  it.each(["high", "balanced", "economy"] as const)("hydrates the explicit saved %s once", async tier => {
    const f = fixture();
    f.memory.set(PLANET_GRAPHICS_QUALITY_KEY, tier);
    const stop = f.controller.activate();
    await flush();
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: tier, saveState: "idle" });
    stop();
    const stopAgain = f.controller.activate();
    await flush();
    expect(f.preferences.get).toHaveBeenCalledTimes(1);
    expect(f.preferences.set).not.toHaveBeenCalled();
    stopAgain();
  });

  it.each([null, "", "HIGH", "auto", "balanced ", "ru"])("keeps High for unsupported saved value %j", async value => {
    const f = fixture();
    f.preferences.get.mockResolvedValue(value);
    const stop = f.controller.activate();
    await flush();
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "high", saveState: "idle" });
    expect(f.preferences.set).not.toHaveBeenCalled();
    stop();
  });

  it.each(["reject", "throw"] as const)("keeps the globe available when preference read fails by %s", async mode => {
    const f = fixture();
    if (mode === "reject") f.preferences.get.mockRejectedValue(new Error("unavailable"));
    else f.preferences.get.mockImplementation(() => { throw new Error("unavailable"); });
    const stop = f.controller.activate();
    await flush();
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "high", saveState: "idle" });
    expect(f.preferences.set).not.toHaveBeenCalled();
    stop();
  });

  it.each(["high", "balanced"] as const)("never lets delayed hydration override a user choice of %s", async tier => {
    const f = fixture();
    const read = deferred<string | null>();
    f.preferences.get.mockReturnValue(read.promise);
    const stop = f.controller.activate();
    await flush();
    expect(f.controller.selectQuality(tier)).toBe(true);
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: tier, saveState: "saving" });
    read.resolve("economy");
    await flush();
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: tier, saveState: "idle" });
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(PLANET_GRAPHICS_QUALITY_KEY, tier);
    stop();
  });

  it("coalesces queued obsolete intentions and keeps only the newest choice", async () => {
    const f = fixture();
    const stop = f.controller.activate();
    f.controller.selectQuality("economy");
    f.controller.selectQuality("balanced");
    f.controller.selectQuality("high");
    await flush();
    expect(f.preferences.get).not.toHaveBeenCalled();
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(PLANET_GRAPHICS_QUALITY_KEY, "high");
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "high", saveState: "idle" });
    stop();
  });

  it("serializes an in-flight old write and ignores its failure while a newer choice is pending", async () => {
    const f = fixture();
    const first = deferred<boolean>();
    f.preferences.set.mockReturnValueOnce(first.promise);
    const stop = f.controller.activate();
    await flush();
    f.controller.selectQuality("economy");
    await flush();
    f.controller.selectQuality("balanced");
    await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "balanced", saveState: "saving" });
    first.reject(new Error("old write failed"));
    await flush();
    expect(f.preferences.set.mock.calls).toEqual([
      [PLANET_GRAPHICS_QUALITY_KEY, "economy"],
      [PLANET_GRAPHICS_QUALITY_KEY, "balanced"],
    ]);
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "balanced", saveState: "idle" });
    stop();
  });

  it.each(["false", "reject", "throw"] as const)("keeps selected quality after save %s and retries the same current choice", async mode => {
    const f = fixture();
    if (mode === "false") f.preferences.set.mockResolvedValueOnce(false);
    else if (mode === "reject") f.preferences.set.mockRejectedValueOnce(new Error("quota"));
    else f.preferences.set.mockImplementationOnce(() => { throw new Error("unavailable"); });
    const stop = f.controller.activate();
    await flush();
    f.controller.selectQuality("economy");
    expect(f.controller.getSnapshot().qualityTier).toBe("economy");
    await flush();
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "economy", saveState: "failed" });
    f.controller.selectQuality(f.controller.getSnapshot().qualityTier);
    await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(2);
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "economy", saveState: "idle" });
    expect(f.preferences.persistence).toBe("best-effort");
    stop();
  });

  it("skips unstarted reads and writes after cleanup, including an immediate StrictMode restart", async () => {
    const f = fixture();
    const stop = f.controller.activate();
    stop();
    stop();
    const stopAgain = f.controller.activate();
    await flush();
    expect(f.preferences.get).toHaveBeenCalledTimes(1);
    f.controller.selectQuality("balanced");
    stopAgain();
    await flush();
    expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.controller.selectQuality("economy")).toBe(false);
  });

  it("never publishes a pending read result after its view has closed", async () => {
    const f = fixture();
    const read = deferred<string | null>();
    f.preferences.get.mockReturnValue(read.promise);
    const listener = vi.fn();
    const unsubscribe = f.controller.subscribe(listener);
    const stop = f.controller.activate();
    await flush();
    stop();
    read.resolve("economy");
    await flush();
    expect(listener).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().qualityTier).toBe("high");
    unsubscribe();
  });

  it("restores through a fresh controller without a second quality owner", async () => {
    const f = fixture();
    const stop = f.controller.activate();
    await flush();
    f.controller.selectQuality("balanced");
    await flush();
    stop();
    const next = createPlanetGraphicsQualityController({ preferences: f.preferences, enabled: true });
    expect(next.getSnapshot().qualityTier).toBe("high");
    const stopNext = next.activate();
    await flush();
    expect(next.getSnapshot()).toEqual({ qualityTier: "balanced", saveState: "idle" });
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
    stopNext();
  });

  it("orders a recreated session behind a started old write and skips all old queued writes", async () => {
    const f = fixture();
    const first = deferred<void>();
    f.preferences.set.mockImplementationOnce(async (key, value) => {
      await first.promise;
      f.memory.set(key, value);
      return true;
    });
    const stop = f.controller.activate();
    await flush();
    f.controller.selectQuality("economy");
    await flush();
    f.controller.selectQuality("high");
    stop();
    const oldSnapshot = f.controller.getSnapshot();
    const next = createPlanetGraphicsQualityController({ preferences: f.preferences, enabled: true });
    const stopNext = next.activate();
    next.selectQuality("balanced");
    await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
    first.resolve();
    await flush();
    expect(f.memory.get(PLANET_GRAPHICS_QUALITY_KEY)).toBe("balanced");
    expect(f.preferences.set.mock.calls.map(([, value]) => value)).toEqual(["economy", "balanced"]);
    expect(next.getSnapshot()).toEqual({ qualityTier: "balanced", saveState: "idle" });
    expect(f.controller.getSnapshot()).toBe(oldSnapshot);
    stopNext();
  });

  it("lets a fresh session read a completed old write without overtaking the active port operation", async () => {
    const f = fixture();
    const write = deferred<void>();
    f.preferences.set.mockImplementationOnce(async (key, value) => {
      await write.promise;
      f.memory.set(key, value);
      return true;
    });
    const stop = f.controller.activate();
    await flush();
    f.controller.selectQuality("economy");
    await flush();
    stop();
    const next = createPlanetGraphicsQualityController({ preferences: f.preferences, enabled: true });
    const stopNext = next.activate();
    await flush();
    expect(f.preferences.get).toHaveBeenCalledTimes(1);
    write.resolve();
    await flush();
    expect(next.getSnapshot().qualityTier).toBe("economy");
    expect(f.preferences.get).toHaveBeenCalledTimes(2);
    stopNext();
  });

  it("isolates a different preference store from an old session's pending read", async () => {
    const old = fixture();
    const read = deferred<string | null>();
    old.preferences.get.mockReturnValue(read.promise);
    const stopOld = old.controller.activate();
    await flush();
    stopOld();
    const fresh = fixture();
    fresh.memory.set(PLANET_GRAPHICS_QUALITY_KEY, "balanced");
    const stopFresh = fresh.controller.activate();
    await flush();
    expect(fresh.controller.getSnapshot().qualityTier).toBe("balanced");
    read.resolve("economy");
    await flush();
    expect(fresh.controller.getSnapshot().qualityTier).toBe("balanced");
    stopFresh();
  });

  it("protects the latest reentrant intent and rejects unsupported values", async () => {
    const f = fixture();
    const stop = f.controller.activate();
    const unsubscribe = f.controller.subscribe(() => {
      if (f.controller.getSnapshot().qualityTier === "balanced") f.controller.selectQuality("economy");
    });
    const unsubscribeThrowing = f.controller.subscribe(() => { throw new Error("view failure"); });
    expect(f.controller.selectQuality("auto" as GlobeQualityTier)).toBe(false);
    f.controller.selectQuality("balanced");
    await flush();
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(PLANET_GRAPHICS_QUALITY_KEY, "economy");
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "economy", saveState: "idle" });
    unsubscribe();
    unsubscribeThrowing();
    stop();
  });

  it("bounds confirmation behind a hanging read while preserving the chosen quality and serialized write", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const read = deferred<string | null>();
    f.preferences.get.mockReturnValue(read.promise);
    const stop = f.controller.activate();
    await flush();
    f.controller.selectQuality("balanced");
    await vi.advanceTimersByTimeAsync(PLANET_GRAPHICS_CONFIRMATION_TIMEOUT_MS);
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "balanced", saveState: "failed" });
    expect(f.preferences.set).not.toHaveBeenCalled();
    // Timing out is only an unconfirmed outcome, never permission to overtake IO.
    read.resolve("economy");
    await flush();
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(PLANET_GRAPHICS_QUALITY_KEY, "balanced");
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "balanced", saveState: "idle" });
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });

  it("keeps a timed-out latest write unconfirmed until that exact intent finishes", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const first = deferred<boolean>();
    const second = deferred<boolean>();
    f.preferences.set.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const stop = f.controller.activate();
    await flush();
    f.controller.selectQuality("economy");
    await flush();
    f.controller.selectQuality("balanced");
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(PLANET_GRAPHICS_CONFIRMATION_TIMEOUT_MS);
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "balanced", saveState: "failed" });
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
    first.resolve(true);
    await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(2);
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "balanced", saveState: "failed" });
    second.resolve(true);
    await flush();
    expect(f.controller.getSnapshot()).toEqual({ qualityTier: "balanced", saveState: "idle" });
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });

  it("clears confirmation deadlines on cleanup and never publishes late inactive completion", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const write = deferred<boolean>();
    f.preferences.set.mockReturnValue(write.promise);
    const listener = vi.fn();
    const unsubscribe = f.controller.subscribe(listener);
    const stop = f.controller.activate();
    await flush();
    f.controller.selectQuality("economy");
    await flush();
    expect(vi.getTimerCount()).toBe(1);
    stop();
    const closedSnapshot = f.controller.getSnapshot();
    listener.mockClear();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(PLANET_GRAPHICS_CONFIRMATION_TIMEOUT_MS + 1);
    write.resolve(true);
    await flush();
    expect(f.controller.getSnapshot()).toBe(closedSnapshot);
    expect(listener).not.toHaveBeenCalled();
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
