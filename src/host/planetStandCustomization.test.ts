import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreferenceStore } from "../platform/ports";
import { GLOBE_STAND_PREFERENCE_KEY, type GlobeStandId } from "../planet/globeStands";
import { createPlanetStandCustomizationController, PLANET_STAND_CONFIRMATION_TIMEOUT_MS,
  PLANET_STAND_PREVIEW_TIMEOUT_MS } from "./planetStandCustomization";

const canonical: GlobeStandId = "canonical", museum: GlobeStandId = "stand.base.museum";
const wood: GlobeStandId = "stand.base.wood", books: GlobeStandId = "stand.base.book-stack";
type Controller = ReturnType<typeof createPlanetStandCustomizationController>;
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let turn = 0; turn < 32; turn++) await Promise.resolve(); };
const cleanups: (() => void)[] = [];
afterEach(() => { for (const stop of cleanups.splice(0)) stop(); vi.useRealTimers(); });
function activate(controller: Controller) {
  const stop = controller.activate(); cleanups.push(stop); return stop;
}
function fixture(enabled = true, access: "adult" | "blocked" = "adult") {
  const memory = new Map<string, string>();
  const preferences = {
    persistence: "best-effort" as const,
    get: vi.fn<PreferenceStore["get"]>(async key => memory.get(key) ?? null),
    set: vi.fn<PreferenceStore["set"]>(async (key, value) => { memory.set(key, value); return true; }),
    remove: vi.fn<PreferenceStore["remove"]>(async key => memory.delete(key)),
  };
  return { memory, preferences, controller: createPlanetStandCustomizationController({ preferences, enabled, access }) };
}
function preview(controller: Controller, id: GlobeStandId) {
  expect(controller.open()).toBe(true);
  expect(controller.preview(id)).toBe(true);
  return controller.getSnapshot().renderRevision;
}
function applyRendered(controller: Controller, id: GlobeStandId) {
  const revision = preview(controller, id);
  expect(controller.acknowledgeRendered(revision, id)).toBe(true);
  expect(controller.apply()).toBe(true);
}

describe("adult stand preview and applied preference lifecycle", () => {
  it("keeps construction, disabled website and blocked policy free of preference IO", async () => {
    const unused = fixture();
    expect(unused.preferences.get).not.toHaveBeenCalled();
    expect(unused.controller.open()).toBe(false);
    for (const f of [fixture(false), fixture(true, "blocked")]) {
      f.memory.set(GLOBE_STAND_PREFERENCE_KEY, wood); activate(f.controller);
      expect(f.controller.open()).toBe(false);
      expect(f.controller.preview(wood)).toBe(false);
      expect(f.controller.acknowledgeRendered(0, wood)).toBe(false);
      expect(f.controller.apply()).toBe(false); expect(f.controller.retrySave()).toBe(false);
      await flush();
      expect(f.preferences.get).not.toHaveBeenCalled(); expect(f.preferences.set).not.toHaveBeenCalled();
      expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: canonical, isOpen: false });
      expect(f.memory.get(GLOBE_STAND_PREFERENCE_KEY)).toBe(wood);
    }
  });

  it("applies only the exact rendered preview; cancel restores the applied scene without writing", async () => {
    const f = fixture(); activate(f.controller); await flush();
    expect(f.controller.apply()).toBe(false);
    const revision = preview(f.controller, wood);
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: wood, previewId: wood, phase: "preparing" });
    expect(f.controller.apply()).toBe(false);
    expect(f.controller.acknowledgeRendered(revision, books)).toBe(false);
    expect(f.controller.acknowledgeRendered(revision, wood)).toBe(true);
    expect(f.controller.getSnapshot().phase).toBe("preview");
    expect(f.preferences.set).not.toHaveBeenCalled();
    f.controller.cancel();
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: canonical, previewId: null, isOpen: false });
    expect(f.controller.acknowledgeRendered(revision, wood)).toBe(false);
    expect(f.controller.apply()).toBe(false);
    applyRendered(f.controller, books); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: books, displayedId: books, isOpen: true, saveState: "idle" });
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(GLOBE_STAND_PREFERENCE_KEY, books);
    preview(f.controller, museum); f.controller.cancel(); await flush();
    expect(f.controller.getSnapshot().displayedId).toBe(books);
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
  });

  it("rejects older acknowledgements even when the latest preview repeats the same stand ID", async () => {
    const f = fixture(); activate(f.controller); await flush();
    const old = preview(f.controller, wood);
    expect(f.controller.preview(wood)).toBe(true);
    const current = f.controller.getSnapshot().renderRevision;
    expect(current).toBeGreaterThan(old);
    expect(f.controller.acknowledgeRendered(old, wood)).toBe(false);
    expect(f.controller.failRendering(old, wood)).toBe(false);
    expect(f.controller.apply()).toBe(false);
    expect(f.controller.acknowledgeRendered(current, museum)).toBe(false);
    expect(f.controller.acknowledgeRendered(current, wood)).toBe(true);
    expect(f.controller.preview(books)).toBe(true);
    expect(f.controller.apply()).toBe(false);
    expect(f.controller.acknowledgeRendered(current, wood)).toBe(false);
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: books, phase: "preparing" });
    for (const invalid of ["stand.base.child-book-cloud", "base.stand.wood", "wood", "constructor", "stand.base.wood "]) {
      expect(f.controller.preview(invalid as GlobeStandId)).toBe(false);
    }
    expect(f.controller.getSnapshot().displayedId).toBe(books); expect(f.preferences.set).not.toHaveBeenCalled();
  });

  it.each(["preparing", "preview"] as const)("restores the applied baseline after failure in %s and rejects late success", async phase => {
    const f = fixture(); activate(f.controller); await flush(); applyRendered(f.controller, museum); await flush();
    const revision = preview(f.controller, books);
    if (phase === "preview") expect(f.controller.acknowledgeRendered(revision, books)).toBe(true);
    expect(f.controller.failRendering(revision, wood)).toBe(false);
    expect(f.controller.failRendering(revision, books)).toBe(true);
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: museum, displayedId: museum,
      phase: "error", reason: "render-failed", isOpen: true });
    expect(f.controller.acknowledgeRendered(revision, books)).toBe(false);
    expect(f.controller.apply()).toBe(false);
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
    applyRendered(f.controller, wood); await flush();
    expect(f.memory.get(GLOBE_STAND_PREFERENCE_KEY)).toBe(wood);
  });

  it("expires an unacknowledged preview and preserves baseline and storage", async () => {
    vi.useFakeTimers(); const f = fixture(); activate(f.controller); await flush();
    const revision = preview(f.controller, wood);
    await vi.advanceTimersByTimeAsync(PLANET_STAND_PREVIEW_TIMEOUT_MS);
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: canonical,
      phase: "error", reason: "preview-timeout", isOpen: true });
    expect(f.controller.acknowledgeRendered(revision, wood)).toBe(false);
    expect(f.controller.apply()).toBe(false); expect(f.preferences.set).not.toHaveBeenCalled();
    f.controller.cancel(); expect(vi.getTimerCount()).toBe(0);
  });

  it("requires successful rendering of hydrated data without rewriting the saved stand", async () => {
    const f = fixture(); f.memory.set(GLOBE_STAND_PREFERENCE_KEY, wood); activate(f.controller); await flush();
    expect(f.preferences.get).toHaveBeenCalledExactlyOnceWith(GLOBE_STAND_PREFERENCE_KEY);
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: wood });
    expect(f.controller.apply()).toBe(false);
    expect(f.controller.acknowledgeRendered(f.controller.getSnapshot().renderRevision, wood)).toBe(true);
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: wood, displayedId: wood, isOpen: false });
    expect(f.preferences.set).not.toHaveBeenCalled();
    const failed = fixture(); failed.memory.set(GLOBE_STAND_PREFERENCE_KEY, books); activate(failed.controller); await flush();
    expect(failed.controller.failRendering(failed.controller.getSnapshot().renderRevision, books)).toBe(true);
    expect(failed.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: canonical });
    expect(failed.memory.get(GLOBE_STAND_PREFERENCE_KEY)).toBe(books); expect(failed.preferences.set).not.toHaveBeenCalled();
  });

  it("discards a pending background hydration reply and reads the saved stand again on foreground", async () => {
    vi.useFakeTimers(); const f = fixture(), oldRead = deferred<string | null>();
    f.memory.set(GLOBE_STAND_PREFERENCE_KEY, wood);
    f.preferences.get.mockReturnValueOnce(oldRead.promise); activate(f.controller); await flush();
    expect(f.preferences.get).toHaveBeenCalledOnce();
    f.controller.setVisibility(false);
    await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: canonical, phase: "idle", reason: null });
    expect(f.preferences.get).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
    f.controller.setVisibility(true); await flush();
    expect(f.preferences.get).toHaveBeenCalledTimes(2);
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: wood, phase: "preparing" });
    const freshRestoration = f.controller.getSnapshot();
    oldRead.resolve(books); await flush();
    expect(f.controller.getSnapshot()).toBe(freshRestoration);
    expect(f.controller.acknowledgeRendered(f.controller.getSnapshot().renderRevision, wood)).toBe(true);
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: wood, displayedId: wood, phase: "idle", reason: null });
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("suspends an unacknowledged restored frame without timing out or treating it as explicit cancellation", async () => {
    vi.useFakeTimers(); const f = fixture(); f.memory.set(GLOBE_STAND_PREFERENCE_KEY, wood);
    activate(f.controller); await flush();
    const oldRevision = f.controller.getSnapshot().renderRevision;
    expect(f.controller.getSnapshot().phase).toBe("preparing");
    f.controller.setVisibility(false);
    expect(f.controller.acknowledgeRendered(oldRevision, wood)).toBe(false);
    await vi.advanceTimersByTimeAsync(Math.max(PLANET_STAND_PREVIEW_TIMEOUT_MS, PLANET_STAND_CONFIRMATION_TIMEOUT_MS) * 2);
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: canonical,
      isOpen: false, phase: "idle", reason: null });
    expect(vi.getTimerCount()).toBe(0);
    f.controller.setVisibility(true); await flush();
    const restored = f.controller.getSnapshot();
    expect(f.preferences.get).toHaveBeenCalledTimes(2);
    expect(restored).toMatchObject({ appliedId: canonical, displayedId: wood, phase: "preparing" });
    expect(restored.renderRevision).toBeGreaterThan(oldRevision);
    expect(f.controller.acknowledgeRendered(oldRevision, wood)).toBe(false);
    expect(f.controller.acknowledgeRendered(restored.renderRevision, wood)).toBe(true);
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: wood, displayedId: wood, phase: "idle" });
    f.controller.setVisibility(true); await flush();
    expect(f.preferences.get).toHaveBeenCalledTimes(2);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("fences late hydration from the moment the user opens customization, even after cancel", async () => {
    const f = fixture(), read = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(read.promise);
    activate(f.controller); await flush(); expect(f.preferences.get).toHaveBeenCalledOnce();
    expect(f.controller.open()).toBe(true); f.controller.cancel(); read.resolve(wood); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: canonical, isOpen: false });
    expect(f.preferences.set).not.toHaveBeenCalled();
    applyRendered(f.controller, books); await flush(); expect(f.memory.get(GLOBE_STAND_PREFERENCE_KEY)).toBe(books);
  });

  it("ignores corrupt or failed storage reads without replacing them with a default write", async () => {
    for (const stored of ["", "wood", "stand.base.child-book-cloud", "constructor"]) {
      const f = fixture(); f.memory.set(GLOBE_STAND_PREFERENCE_KEY, stored); activate(f.controller); await flush();
      expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: canonical });
      expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.memory.get(GLOBE_STAND_PREFERENCE_KEY)).toBe(stored);
    }
    const f = fixture(); f.preferences.get.mockRejectedValue(new Error("Port unavailable")); activate(f.controller); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: canonical });
    expect(f.preferences.set).not.toHaveBeenCalled();
  });

  it("bounds hydration and ignores an uncooperative read after its deadline", async () => {
    vi.useFakeTimers(); const f = fixture(), read = deferred<string | null>();
    f.preferences.get.mockReturnValueOnce(read.promise); activate(f.controller); await flush();
    await vi.advanceTimersByTimeAsync(PLANET_STAND_CONFIRMATION_TIMEOUT_MS);
    const baseline = f.controller.getSnapshot(); read.resolve(wood); await flush();
    expect(f.controller.getSnapshot()).toBe(baseline);
    expect(baseline).toMatchObject({ appliedId: canonical, displayedId: canonical });
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("fences deactivated previews and remounts without persisting an abandoned choice", async () => {
    const f = fixture(); const stop = activate(f.controller); await flush();
    const revision = preview(f.controller, wood); stop();
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: canonical, isOpen: false });
    expect(f.controller.acknowledgeRendered(revision, wood)).toBe(false);
    expect(f.controller.open()).toBe(false); expect(f.controller.apply()).toBe(false);
    const remounted = createPlanetStandCustomizationController({ preferences: f.preferences, enabled: true, access: "adult" });
    activate(remounted); await flush();
    expect(remounted.getSnapshot()).toMatchObject({ appliedId: canonical, displayedId: canonical });
    expect(f.preferences.set).not.toHaveBeenCalled();
  });

  it.each(["false", "reject"] as const)("retains an applied stand after a %s save failure and retries only that value", async failure => {
    const f = fixture(); activate(f.controller); await flush();
    if (failure === "false") f.preferences.set.mockResolvedValueOnce(false);
    else f.preferences.set.mockRejectedValueOnce(new Error("Preference rejected"));
    applyRendered(f.controller, wood); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: wood, displayedId: wood, saveState: "failed" });
    preview(f.controller, books); f.controller.cancel();
    expect(f.controller.retrySave()).toBe(true); await flush();
    expect(f.memory.get(GLOBE_STAND_PREFERENCE_KEY)).toBe(wood);
    expect(f.preferences.set.mock.calls.map(([, value]) => value)).toEqual([wood, wood]);
    expect(f.controller.getSnapshot().saveState).toBe("idle"); expect(f.controller.retrySave()).toBe(false);
  });

  it.each(["resolve", "reject"] as const)("keeps writes ordered through timeout and an older %s completion, skipping an obsolete queued stand", async completion => {
    vi.useFakeTimers(); const f = fixture(), first = deferred<boolean>(), latest = deferred<boolean>();
    activate(f.controller); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => {
      await first.promise; f.memory.set(key, value); return true;
    }).mockImplementationOnce(async (key, value) => {
      const saved = await latest.promise; if (saved) f.memory.set(key, value); return saved;
    });
    applyRendered(f.controller, wood); await flush();
    applyRendered(f.controller, museum); applyRendered(f.controller, books);
    await vi.advanceTimersByTimeAsync(PLANET_STAND_CONFIRMATION_TIMEOUT_MS);
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: books, displayedId: books, saveState: "failed" });
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
    if (completion === "resolve") first.resolve(true);
    else first.reject(new Error("Late old write rejection"));
    await flush();
    expect(f.preferences.set.mock.calls.map(([, value]) => value)).toEqual([wood, books]);
    expect(f.controller.getSnapshot().saveState).toBe("failed");
    latest.resolve(true); await flush();
    expect(f.memory.get(GLOBE_STAND_PREFERENCE_KEY)).toBe(books);
    expect(f.controller.getSnapshot().saveState).toBe("idle"); expect(vi.getTimerCount()).toBe(0);
  });

  it("orders a new owner behind an old uncancellable save without publishing to the disposed owner", async () => {
    const f = fixture(), oldWrite = deferred<boolean>(); const stop = activate(f.controller); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => {
      await oldWrite.promise; f.memory.set(key, value); return true;
    });
    applyRendered(f.controller, wood); await flush(); stop();
    const observer = vi.fn(); f.controller.subscribe(observer);
    const next = createPlanetStandCustomizationController({ preferences: f.preferences, enabled: true, access: "adult" });
    activate(next); const reads = f.preferences.get.mock.calls.length; await flush();
    expect(f.preferences.get).toHaveBeenCalledTimes(reads);
    applyRendered(next, books); await flush(); expect(f.preferences.set).toHaveBeenCalledTimes(1);
    oldWrite.resolve(true); await flush();
    expect(f.preferences.set.mock.calls.map(([, value]) => value)).toEqual([wood, books]);
    expect(f.memory.get(GLOBE_STAND_PREFERENCE_KEY)).toBe(books); expect(observer).not.toHaveBeenCalled();
    expect(next.getSnapshot()).toMatchObject({ appliedId: books, displayedId: books, saveState: "idle" });
  });
});
