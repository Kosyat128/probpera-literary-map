import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreferenceStore } from "../platform/ports";
import { DEFAULT_GLOBE_EDITION_ID, type GlobeEditionId } from "../components/globeEditions";
import { executeGlobeStyleRequest } from "../components/useGlobeStyleState";
import { createPlanetEditionPreferenceController, PLANET_EDITION_CONFIRMATION_TIMEOUT_MS,
  PLANET_EDITION_LEGACY_KEY, PLANET_EDITION_PREFERENCE_KEY } from "./planetEditionPreference";

const earth: GlobeEditionId = "nasa-blue-marble", modern: GlobeEditionId = "natural-earth-2026", historical: GlobeEditionId = "cassini-1790";
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error?: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let turn = 0; turn < 32; turn++) await Promise.resolve(); };
const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); vi.useRealTimers(); });
function activate(controller: ReturnType<typeof createPlanetEditionPreferenceController>) {
  const stop = controller.activate(); cleanups.push(stop); return stop;
}
function fixture(enabled = true, readLegacyPreference?: () => unknown) {
  const memory = new Map<string, string>();
  const preferences = {
    persistence: "best-effort" as const,
    get: vi.fn<PreferenceStore["get"]>(async key => memory.get(key) ?? null),
    set: vi.fn<PreferenceStore["set"]>(async (key, value) => { memory.set(key, value); return true; }),
    remove: vi.fn<PreferenceStore["remove"]>(async key => memory.delete(key)),
  };
  const controller = createPlanetEditionPreferenceController({ preferences, enabled, readLegacyPreference });
  return { preferences, memory, controller };
}
function renderCommit(controller: ReturnType<typeof createPlanetEditionPreferenceController>, edition: GlobeEditionId) {
  expect(controller.requestEdition(edition)).toBe(true);
  expect(controller.renderedEdition(edition)).toBe(true);
}

describe("application globe edition preference lifecycle", () => {
  it("does no constructor IO and keeps the disabled public-site path out of the platform preference store", async () => {
    const active = fixture(), publicSite = fixture(false);
    expect(active.preferences.get).not.toHaveBeenCalled(); expect(active.preferences.set).not.toHaveBeenCalled();
    expect(active.controller.requestEdition(earth)).toBe(false); expect(active.controller.renderedEdition(earth)).toBe(false);
    publicSite.memory.set(PLANET_EDITION_PREFERENCE_KEY, historical); activate(publicSite.controller);
    expect(publicSite.controller.requestEdition(earth)).toBe(false);
    expect(publicSite.controller.renderedEdition(earth)).toBe(false); expect(publicSite.controller.retrySave()).toBe(false);
    await flush();
    expect(publicSite.preferences.get).not.toHaveBeenCalled(); expect(publicSite.preferences.set).not.toHaveBeenCalled();
    expect(publicSite.memory.get(PLANET_EDITION_PREFERENCE_KEY)).toBe(historical);
    expect(publicSite.controller.getSnapshot()).toEqual(publicSite.controller.getServerSnapshot());
  });

  it.each([
    { current: historical, legacy: "earth", restored: historical, legacyRead: false },
    { current: "earth", legacy: "modern", restored: earth, legacyRead: false },
    { current: null, legacy: "modern", restored: modern, legacyRead: true },
    { current: "constructor", legacy: "earth", restored: DEFAULT_GLOBE_EDITION_ID, legacyRead: false },
    { current: null, legacy: "corrupt-style", restored: DEFAULT_GLOBE_EDITION_ID, legacyRead: true },
  ])("hydrates canonical identity from $current / $legacy without persisting an unrendered texture", async ({ current, legacy, restored, legacyRead }) => {
    const f = fixture();
    if (current !== null) f.memory.set(PLANET_EDITION_PREFERENCE_KEY, current);
    f.memory.set(PLANET_EDITION_LEGACY_KEY, legacy); activate(f.controller); await flush();
    expect(f.controller.getSnapshot()).toEqual({ restoredEditionId: restored, saveState: "idle" });
    expect(f.preferences.get.mock.calls.map(([key]) => key)).toEqual(legacyRead
      ? [PLANET_EDITION_PREFERENCE_KEY, PLANET_EDITION_LEGACY_KEY] : [PLANET_EDITION_PREFERENCE_KEY]);
    expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.controller.renderedEdition(restored)).toBe(true); await flush();
    if (current === restored) expect(f.preferences.set).not.toHaveBeenCalled();
    else expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(PLANET_EDITION_PREFERENCE_KEY, restored);
  });

  it("fences late hydration even when the explicit texture fails, and persists only its later successful render", async () => {
    const f = fixture(), read = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(read.promise);
    activate(f.controller); await flush(); expect(f.preferences.get).toHaveBeenCalledOnce();
    expect(f.controller.requestEdition(earth)).toBe(true);
    const rejected = vi.fn(), resolved = vi.fn();
    expect(await executeGlobeStyleRequest({ token: { style: earth, requestId: 1 }, isLatest: () => true,
      applyStyle: async () => { throw new Error("Texture unavailable"); }, onReject: rejected, onResolve: resolved,
      onCommit: id => { f.controller.renderedEdition(id); } })).toBe("failed");
    expect(rejected).toHaveBeenCalledOnce(); expect(resolved).not.toHaveBeenCalled();
    expect(f.controller.renderedEdition(DEFAULT_GLOBE_EDITION_ID)).toBe(false);
    read.resolve(historical); await flush();
    expect(f.controller.getSnapshot().restoredEditionId).toBeNull(); expect(f.preferences.set).not.toHaveBeenCalled();
    expect(await executeGlobeStyleRequest({ token: { style: earth, requestId: 2 }, isLatest: () => true,
      applyStyle: async () => {}, onReject: rejected, onResolve: resolved,
      onCommit: id => { f.controller.renderedEdition(id); } })).toBe("committed");
    await flush(); expect(f.memory.get(PLANET_EDITION_PREFERENCE_KEY)).toBe(earth);
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(PLANET_EDITION_PREFERENCE_KEY, earth);
  });

  it("rejects stale render completion and never persists a preview, legacy request or bootstrap fallback", async () => {
    const f = fixture(), oldTexture = deferred<void>(); activate(f.controller); await flush();
    expect(f.controller.renderedEdition(DEFAULT_GLOBE_EDITION_ID)).toBe(false);
    expect(f.controller.requestEdition("earth" as never)).toBe(false);
    expect(f.controller.requestEdition(earth)).toBe(true);
    expect(f.preferences.set).not.toHaveBeenCalled();
    let latest = 1;
    const oldRender = executeGlobeStyleRequest({ token: { style: earth, requestId: 1 }, isLatest: token => token.requestId === latest,
      applyStyle: () => oldTexture.promise, onResolve: vi.fn(), onReject: vi.fn(),
      onCommit: id => { f.controller.renderedEdition(id); } });
    latest = 2; renderCommit(f.controller, modern); await flush();
    oldTexture.resolve(); expect(await oldRender).toBe("stale");
    expect(f.controller.renderedEdition(earth)).toBe(false); await flush();
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(PLANET_EDITION_PREFERENCE_KEY, modern);
    expect(f.memory.get(PLANET_EDITION_PREFERENCE_KEY)).toBe(modern);
  });

  it.each(["false", "reject"] as const)("keeps the latest rendered choice after an older slow write returns %s", async failure => {
    const f = fixture(), first = deferred<boolean>(); activate(f.controller); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => {
      const saved = await first.promise; if (saved) f.memory.set(key, value); return saved;
    });
    renderCommit(f.controller, earth); await flush(); renderCommit(f.controller, modern);
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
    if (failure === "reject") first.reject(new Error("Slow write failed"));
    else {
      // A returned false is distinct from a successful, late durable write.
      first.resolve(false);
    }
    await flush();
    expect(f.preferences.set.mock.calls.map(([, value]) => value)).toEqual([earth, modern]);
    expect(f.memory.get(PLANET_EDITION_PREFERENCE_KEY)).toBe(modern);
    expect(f.controller.getSnapshot().saveState).toBe("idle");
  });

  it("skips an intermediate queued choice instead of letting it overwrite the newest rendered edition", async () => {
    const f = fixture(), first = deferred<boolean>(); activate(f.controller); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await first.promise; f.memory.set(key, value); return true; });
    renderCommit(f.controller, earth); await flush(); renderCommit(f.controller, historical); renderCommit(f.controller, modern);
    first.resolve(true); await flush();
    expect(f.preferences.set.mock.calls.map(([, value]) => value)).toEqual([earth, modern]);
    expect(f.memory.get(PLANET_EDITION_PREFERENCE_KEY)).toBe(modern);
  });

  it("orders a new mount behind an uncancellable old write and never publishes the disposed completion", async () => {
    const f = fixture(), first = deferred<boolean>(); const stop = activate(f.controller); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await first.promise; f.memory.set(key, value); return true; });
    renderCommit(f.controller, earth); await flush(); stop();
    const closed = f.controller.getSnapshot(), listener = vi.fn(); f.controller.subscribe(listener);
    const remounted = createPlanetEditionPreferenceController({ preferences: f.preferences, enabled: true }); activate(remounted);
    const reads = f.preferences.get.mock.calls.length; await flush(); expect(f.preferences.get).toHaveBeenCalledTimes(reads);
    renderCommit(remounted, modern); await flush(); expect(f.preferences.set).toHaveBeenCalledTimes(1);
    first.resolve(true); await flush();
    expect(f.controller.getSnapshot()).toBe(closed); expect(listener).not.toHaveBeenCalled();
    expect(remounted.getSnapshot().restoredEditionId).toBeNull(); expect(f.memory.get(PLANET_EDITION_PREFERENCE_KEY)).toBe(modern);
    expect(f.preferences.set.mock.calls.map(([, value]) => value)).toEqual([earth, modern]);
  });

  it("does not run a queued write after disposal and permits a fresh controller to restore the actual stored value", async () => {
    const f = fixture(), read = deferred<string | null>(); f.memory.set(PLANET_EDITION_PREFERENCE_KEY, historical);
    f.preferences.get.mockReturnValueOnce(read.promise); const stop = activate(f.controller); await flush();
    renderCommit(f.controller, earth); stop();
    read.resolve(historical); await flush(); expect(f.preferences.set).not.toHaveBeenCalled();
    const next = createPlanetEditionPreferenceController({ preferences: f.preferences, enabled: true }); activate(next); await flush();
    expect(next.getSnapshot()).toEqual({ restoredEditionId: historical, saveState: "idle" });
    expect(f.controller.requestEdition(modern)).toBe(false); expect(f.controller.renderedEdition(earth)).toBe(false);
  });

  it("reports write failure and retries the last rendered edition while a newer requested texture has not succeeded", async () => {
    const f = fixture(); activate(f.controller); await flush(); f.preferences.set.mockResolvedValueOnce(false);
    renderCommit(f.controller, earth); await flush(); expect(f.controller.getSnapshot().saveState).toBe("failed");
    expect(f.controller.retrySave()).toBe(true); await flush();
    expect(f.preferences.set.mock.calls.map(([, value]) => value)).toEqual([earth, earth]);
    expect(f.memory.get(PLANET_EDITION_PREFERENCE_KEY)).toBe(earth); expect(f.controller.getSnapshot().saveState).toBe("idle");
    f.preferences.set.mockRejectedValueOnce(new Error("Storage denied")); renderCommit(f.controller, modern); await flush();
    expect(f.controller.getSnapshot().saveState).toBe("failed");
    expect(f.controller.requestEdition(historical)).toBe(true); expect(f.controller.retrySave()).toBe(true);
    await flush(); expect(f.preferences.set.mock.calls.map(([, value]) => value)).toEqual([earth, earth, modern, modern]);
    expect(f.memory.get(PLANET_EDITION_PREFERENCE_KEY)).toBe(modern);
  });

  it("bounds uncooperative write confirmation without allowing the newest write to overtake it", async () => {
    vi.useFakeTimers(); const f = fixture(), first = deferred<boolean>(), second = deferred<boolean>(); activate(f.controller); await flush();
    f.preferences.set.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    renderCommit(f.controller, earth); await flush(); renderCommit(f.controller, modern);
    await vi.advanceTimersByTimeAsync(PLANET_EDITION_CONFIRMATION_TIMEOUT_MS);
    expect(f.controller.getSnapshot().saveState).toBe("failed"); expect(f.preferences.set).toHaveBeenCalledTimes(1);
    first.resolve(true); await flush(); expect(f.preferences.set).toHaveBeenCalledTimes(2);
    expect(f.controller.getSnapshot().saveState).toBe("failed");
    second.resolve(true); await flush(); expect(f.controller.getSnapshot().saveState).toBe("idle"); expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds hydration and ignores a late stored edition after the deadline", async () => {
    vi.useFakeTimers(); const f = fixture(), read = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(read.promise);
    activate(f.controller); await flush(); await vi.advanceTimersByTimeAsync(PLANET_EDITION_CONFIRMATION_TIMEOUT_MS);
    expect(f.controller.getSnapshot().restoredEditionId).toBeNull();
    const timedOut = f.controller.getSnapshot(); read.resolve(historical); await flush();
    expect(f.controller.getSnapshot()).toBe(timedOut); expect(f.preferences.set).not.toHaveBeenCalled();
  });

  it("handles a newer rendered choice from a synchronous save observer before starting the obsolete write", async () => {
    const f = fixture(); activate(f.controller); await flush(); let switched = false;
    const unsubscribe = f.controller.subscribe(() => {
      if (!switched && f.controller.getSnapshot().saveState === "saving") {
        switched = true; renderCommit(f.controller, modern);
      }
    });
    renderCommit(f.controller, earth); await flush(); unsubscribe();
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(PLANET_EDITION_PREFERENCE_KEY, modern);
    expect(f.memory.get(PLANET_EDITION_PREFERENCE_KEY)).toBe(modern);
  });

  it.each([["earth", earth], [historical, historical]] as const)("migrates old WebView value %s only after both platform keys are absent and its texture renders", async (stored, restored) => {
    const fallback = vi.fn(() => stored), f = fixture(true, fallback);
    expect(fallback).not.toHaveBeenCalled(); activate(f.controller); await flush();
    expect(f.preferences.get.mock.calls.map(([key]) => key)).toEqual([PLANET_EDITION_PREFERENCE_KEY, PLANET_EDITION_LEGACY_KEY]);
    expect(fallback).toHaveBeenCalledOnce(); expect(f.controller.getSnapshot().restoredEditionId).toBe(restored);
    expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.controller.renderedEdition(restored)).toBe(true); await flush();
    expect(f.memory.get(PLANET_EDITION_PREFERENCE_KEY)).toBe(restored);
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(PLANET_EDITION_PREFERENCE_KEY, restored);
  });

  it("never uses old local migration to replace a present platform value or conceal a failed platform read", async () => {
    for (const [key, stored] of [[PLANET_EDITION_PREFERENCE_KEY, historical],
      [PLANET_EDITION_PREFERENCE_KEY, "corrupt-platform-value"], [PLANET_EDITION_LEGACY_KEY, "modern"]]) {
      const fallback = vi.fn(() => "earth"), f = fixture(true, fallback);
      f.memory.set(key, stored); activate(f.controller); await flush();
      expect(fallback).not.toHaveBeenCalled(); expect(f.preferences.set).not.toHaveBeenCalled();
    }
    const fallback = vi.fn(() => "earth"), failed = fixture(true, fallback);
    failed.preferences.get.mockRejectedValue(new Error("Native preference unavailable")); activate(failed.controller); await flush();
    expect(fallback).not.toHaveBeenCalled(); expect(failed.controller.getSnapshot().restoredEditionId).toBeNull();
  });

  it("ignores malformed old local values and fences migration after an explicit choice or expired read", async () => {
    const malformed = fixture(true, () => ({ edition: earth })); activate(malformed.controller); await flush();
    expect(malformed.controller.getSnapshot().restoredEditionId).toBeNull(); expect(malformed.preferences.set).not.toHaveBeenCalled();
    const oldRead = deferred<string | null>(), fallback = vi.fn(() => "earth"), chosen = fixture(true, fallback);
    chosen.preferences.get.mockReturnValueOnce(oldRead.promise); activate(chosen.controller); await flush();
    expect(chosen.controller.requestEdition(modern)).toBe(true); oldRead.resolve(null); await flush(); expect(fallback).not.toHaveBeenCalled();
    vi.useFakeTimers(); const timedRead = deferred<string | null>(), expiredFallback = vi.fn(() => "earth"), expired = fixture(true, expiredFallback);
    expired.preferences.get.mockReturnValueOnce(timedRead.promise); activate(expired.controller); await flush();
    await vi.advanceTimersByTimeAsync(PLANET_EDITION_CONFIRMATION_TIMEOUT_MS); timedRead.resolve(null); await flush();
    expect(expiredFallback).not.toHaveBeenCalled(); expect(expired.preferences.set).not.toHaveBeenCalled();
  });
});
