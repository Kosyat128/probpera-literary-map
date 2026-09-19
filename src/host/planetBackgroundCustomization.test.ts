import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreferenceStore } from "../platform/ports";
import { GLOBE_BACKGROUND_PREFERENCE_KEY, type GlobeBackgroundId } from "../planet/globeBackgrounds";
import { GLOBE_STAND_PREFERENCE_KEY } from "../planet/globeStands";
import { createPlanetStandCustomizationController } from "./planetStandCustomization";
import { createPlanetBackgroundCustomizationController } from "./planetBackgroundCustomization";

const starfield: GlobeBackgroundId = "background.base.site-starfield", library: GlobeBackgroundId = "background.base.library";
type Controller = ReturnType<typeof createPlanetBackgroundCustomizationController>;
const cleanups: (() => void)[] = [];
afterEach(() => { for (const stop of cleanups.splice(0)) stop(); });
const flush = async () => { for (let turn = 0; turn < 32; turn++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function activate(controller: { activate(): () => void }) {
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
  const controller = createPlanetBackgroundCustomizationController({ preferences, enabled, access });
  return { memory, preferences, controller };
}
function preview(controller: Controller, id: GlobeBackgroundId) {
  expect(controller.open()).toBe(true); expect(controller.preview(id)).toBe(true);
  return controller.getSnapshot().renderRevision;
}
function apply(controller: Controller, id: GlobeBackgroundId) {
  const revision = preview(controller, id);
  expect(controller.acknowledgeRendered(revision, id)).toBe(true);
  expect(controller.apply()).toBe(true);
}

describe("background customization uses the shared lifecycle with its own authority and preference key", () => {
  it("defaults to the existing starfield and allows neither disabled IO nor child/stand IDs", async () => {
    for (const f of [fixture(false), fixture(true, "blocked")]) {
      expect(f.controller.getSnapshot()).toMatchObject({ appliedId: starfield, displayedId: starfield });
      activate(f.controller); expect(f.controller.open()).toBe(false); await flush();
      expect(f.preferences.get).not.toHaveBeenCalled(); expect(f.preferences.set).not.toHaveBeenCalled();
    }
    const f = fixture(); expect(f.preferences.get).not.toHaveBeenCalled(); activate(f.controller); await flush();
    expect(f.controller.open()).toBe(true);
    for (const id of ["canonical", "stand.base.wood", "background.base.child-room", "library", "constructor"]) {
      expect(f.controller.preview(id as GlobeBackgroundId)).toBe(false);
    }
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: starfield, displayedId: starfield, phase: "idle" });
    expect(f.preferences.get).toHaveBeenCalledExactlyOnceWith(GLOBE_BACKGROUND_PREFERENCE_KEY);
    expect(f.preferences.set).not.toHaveBeenCalled();
  });

  it("requires the current frame acknowledgement and saves only Apply to the background key", async () => {
    const f = fixture(); f.memory.set(GLOBE_STAND_PREFERENCE_KEY, "stand.base.wood"); activate(f.controller); await flush();
    const old = preview(f.controller, library);
    expect(f.controller.apply()).toBe(false);
    expect(f.controller.preview(starfield)).toBe(true);
    expect(f.controller.acknowledgeRendered(old, library)).toBe(false);
    expect(f.controller.apply()).toBe(false); f.controller.cancel();
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: starfield, displayedId: starfield });
    expect(f.preferences.set).not.toHaveBeenCalled();
    apply(f.controller, library); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: library, displayedId: library, saveState: "idle" });
    preview(f.controller, starfield); f.controller.cancel();
    expect(f.controller.getSnapshot().displayedId).toBe(library);
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(GLOBE_BACKGROUND_PREFERENCE_KEY, library);
    expect(f.memory.get(GLOBE_STAND_PREFERENCE_KEY)).toBe("stand.base.wood");
  });

  it("restores only a valid rendered background and fences late hydration after explicit intent", async () => {
    const restored = fixture(); restored.memory.set(GLOBE_BACKGROUND_PREFERENCE_KEY, library);
    activate(restored.controller); await flush();
    expect(restored.controller.getSnapshot()).toMatchObject({ appliedId: starfield, displayedId: library });
    expect(restored.controller.acknowledgeRendered(restored.controller.getSnapshot().renderRevision, library)).toBe(true);
    expect(restored.controller.getSnapshot().appliedId).toBe(library); expect(restored.preferences.set).not.toHaveBeenCalled();
    const f = fixture(), read = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(read.promise);
    activate(f.controller); await flush(); apply(f.controller, starfield); await flush();
    read.resolve(library); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: starfield, displayedId: starfield });
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(GLOBE_BACKGROUND_PREFERENCE_KEY, starfield);
    const invalid = fixture(); invalid.memory.set(GLOBE_BACKGROUND_PREFERENCE_KEY, "stand.base.wood");
    activate(invalid.controller); await flush();
    expect(invalid.controller.getSnapshot().appliedId).toBe(starfield); expect(invalid.preferences.set).not.toHaveBeenCalled();
  });

  it("retains the applied library after failed confirmation and retries that background alone", async () => {
    const f = fixture(); activate(f.controller); await flush();
    f.preferences.set.mockResolvedValueOnce(false); apply(f.controller, library); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: library, displayedId: library, saveState: "failed" });
    preview(f.controller, starfield); f.controller.cancel();
    expect(f.controller.retrySave()).toBe(true); await flush();
    expect(f.controller.getSnapshot().saveState).toBe("idle");
    expect(f.preferences.set.mock.calls).toEqual([[GLOBE_BACKGROUND_PREFERENCE_KEY, library], [GLOBE_BACKGROUND_PREFERENCE_KEY, library]]);
  });

  it("does not let an uncancellable stand write block background restoration or saving on the same port", async () => {
    const f = fixture(), standWrite = deferred<boolean>(); f.memory.set(GLOBE_BACKGROUND_PREFERENCE_KEY, library);
    const stand = createPlanetStandCustomizationController({ preferences: f.preferences, enabled: true, access: "adult" });
    activate(stand); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => {
      await standWrite.promise; f.memory.set(key, value); return true;
    });
    expect(stand.open()).toBe(true); expect(stand.preview("stand.base.wood")).toBe(true);
    expect(stand.acknowledgeRendered(stand.getSnapshot().renderRevision, "stand.base.wood")).toBe(true);
    expect(stand.apply()).toBe(true); await flush();
    activate(f.controller); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ appliedId: starfield, displayedId: library });
    expect(f.controller.acknowledgeRendered(f.controller.getSnapshot().renderRevision, library)).toBe(true);
    apply(f.controller, starfield); await flush();
    expect(f.memory.get(GLOBE_BACKGROUND_PREFERENCE_KEY)).toBe(starfield);
    expect(stand.getSnapshot().saveState).toBe("saving");
    expect(f.preferences.set.mock.calls).toEqual([[GLOBE_STAND_PREFERENCE_KEY, "stand.base.wood"], [GLOBE_BACKGROUND_PREFERENCE_KEY, starfield]]);
    standWrite.resolve(true); await flush();
    expect(f.memory.get(GLOBE_STAND_PREFERENCE_KEY)).toBe("stand.base.wood");
  });

  it("serializes background remounts behind their started write while a stand write remains independent", async () => {
    const f = fixture(), oldWrite = deferred<boolean>(); const stop = activate(f.controller); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => {
      await oldWrite.promise; f.memory.set(key, value); return true;
    });
    apply(f.controller, library); await flush(); stop();
    const closed = f.controller.getSnapshot(), observer = vi.fn(); f.controller.subscribe(observer);
    const next = createPlanetBackgroundCustomizationController({ preferences: f.preferences, enabled: true, access: "adult" });
    activate(next); await flush(); expect(f.preferences.get).toHaveBeenCalledTimes(1);
    apply(next, starfield); await flush(); expect(f.preferences.set).toHaveBeenCalledTimes(1);
    const stand = createPlanetStandCustomizationController({ preferences: f.preferences, enabled: true, access: "adult" });
    activate(stand); await flush();
    expect(stand.open()).toBe(true); expect(stand.preview("stand.base.wood")).toBe(true);
    expect(stand.acknowledgeRendered(stand.getSnapshot().renderRevision, "stand.base.wood")).toBe(true);
    expect(stand.apply()).toBe(true); await flush();
    expect(f.memory.get(GLOBE_STAND_PREFERENCE_KEY)).toBe("stand.base.wood");
    expect(f.memory.has(GLOBE_BACKGROUND_PREFERENCE_KEY)).toBe(false);
    oldWrite.resolve(true); await flush();
    expect(f.preferences.set.mock.calls).toEqual([[GLOBE_BACKGROUND_PREFERENCE_KEY, library],
      [GLOBE_STAND_PREFERENCE_KEY, "stand.base.wood"], [GLOBE_BACKGROUND_PREFERENCE_KEY, starfield]]);
    expect(f.memory.get(GLOBE_BACKGROUND_PREFERENCE_KEY)).toBe(starfield);
    expect(next.getSnapshot()).toMatchObject({ appliedId: starfield, displayedId: starfield, saveState: "idle" });
    expect(f.controller.getSnapshot()).toBe(closed); expect(observer).not.toHaveBeenCalled();
  });
});
