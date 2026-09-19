import { describe, expect, it, vi } from "vitest";
import { createPlanetSceneInspectionController, type PlanetSceneInspectionContext } from "./planetSceneInspection";

const STUDY = "background.base.writer-study";
const adult: PlanetSceneInspectionContext = Object.freeze({ enabled: true, access: "adult", visible: true,
  editorOpen: false, appliedBackgroundId: STUDY, displayedBackgroundId: STUDY });

describe("transient adult writer-study inspection authority", () => {
  it("denies every unavailable context and ignores retired registration leases", () => {
    const controller = createPlanetSceneInspectionController(), ready = vi.fn(() => true);
    expect(controller.getSnapshot()).toEqual({ available: false, mode: "closed" });
    expect(controller.open()).toBe(false);
    const resource = {}, oldRelease = controller.registerTarget(resource, { backgroundId: STUDY, canActivate: ready });
    expect(ready).not.toHaveBeenCalled();
    controller.setContext(adult); expect(controller.open()).toBe(true); expect(controller.openObject()).toBe(true);
    for (const override of [{ enabled: false }, { access: "blocked" as const }, { visible: false }, { editorOpen: true },
      { appliedBackgroundId: "background.base.library" }, { displayedBackgroundId: "background.base.library" },
      { appliedBackgroundId: "background.base.writer-study-unknown" }]) {
      controller.setContext({ ...adult, ...override });
      expect(controller.getSnapshot()).toEqual({ available: false, mode: "closed" });
      expect(controller.open()).toBe(false); expect(controller.openObject()).toBe(false);
      controller.setContext(adult); expect(controller.open()).toBe(true); expect(controller.openObject()).toBe(true);
    }
    // Registering the same shown resource renews its lease, not its identity.
    const renewedRelease = controller.registerTarget(resource, { backgroundId: STUDY, canActivate: ready });
    oldRelease(); expect(controller.getSnapshot()).toEqual({ available: true, mode: "object" });
    const replacementRelease = controller.registerTarget({}, { backgroundId: STUDY, canActivate: ready });
    expect(controller.getSnapshot()).toEqual({ available: true, mode: "closed" });
    expect(controller.open()).toBe(true); renewedRelease();
    expect(controller.getSnapshot().mode).toBe("scene");
    replacementRelease(); expect(controller.getSnapshot()).toEqual({ available: false, mode: "closed" });
    controller.registerTarget({}, { backgroundId: "background.base.library", canActivate: ready });
    expect(controller.open()).toBe(false);
    controller.dispose();
  });

  it("publishes immutable transitions and closes before the guarded book-collection callback", () => {
    const controller = createPlanetSceneInspectionController(); let ready = true;
    const context = { ...adult }; controller.setContext(context);
    context.visible = false; // The controller owns a detached context snapshot.
    controller.registerTarget({}, { backgroundId: STUDY, canActivate: () => ready });
    const changed = vi.fn(); controller.subscribe(changed);
    const first = controller.getSnapshot(); expect(Object.isFrozen(first)).toBe(true);
    controller.refreshTarget(); controller.setContext(adult);
    expect(controller.getSnapshot()).toBe(first); expect(changed).not.toHaveBeenCalled();
    expect(controller.openObject()).toBe(false); expect(controller.open()).toBe(true);
    const callback = vi.fn(() => { expect(controller.getSnapshot().mode).toBe("closed"); });
    expect(controller.openBooks(callback)).toBe(false); expect(callback).not.toHaveBeenCalled();
    expect(controller.openObject()).toBe(true); controller.closeObject();
    expect(controller.getSnapshot().mode).toBe("scene");
    ready = false; expect(controller.openObject()).toBe(false);
    expect(controller.getSnapshot()).toEqual({ available: false, mode: "scene" });
    ready = true; expect(controller.openObject()).toBe(true);
    const order: string[] = [];
    const stop = controller.subscribe(() => { if (controller.getSnapshot().mode === "closed") order.push("closed"); });
    expect(controller.openBooks(() => { callback(); order.push("books"); })).toBe(true);
    expect(order).toEqual(["closed", "books"]); expect(callback).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ available: true, mode: "closed" });
    expect(controller.open()).toBe(true); expect(controller.openObject()).toBe(true);
    ready = false; expect(controller.openBooks(callback)).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1); expect(controller.getSnapshot()).toEqual({ available: false, mode: "object" });
    controller.close(); expect(controller.getSnapshot().mode).toBe("closed");
    stop(); controller.dispose();
  });

  it("keeps the object during a same-resource repaint but fences reentrant target changes and disposal", () => {
    const controller = createPlanetSceneInspectionController(); let ready = true, duringRead: (() => void) | undefined;
    controller.setContext(adult);
    const release = controller.registerTarget({}, { backgroundId: STUDY, canActivate: () => { duringRead?.(); return ready; } });
    expect(controller.open()).toBe(true); expect(controller.openObject()).toBe(true);
    ready = false; controller.refreshTarget();
    expect(controller.getSnapshot()).toEqual({ available: false, mode: "object" });
    const waiting = controller.getSnapshot(); controller.refreshTarget(); expect(controller.getSnapshot()).toBe(waiting);
    expect(controller.openObject()).toBe(false); expect(controller.getSnapshot().mode).toBe("object");
    ready = true; controller.refreshTarget(); expect(controller.getSnapshot()).toEqual({ available: true, mode: "object" });
    // The renderer revokes an old target while its canActivate is on the stack.
    duringRead = () => { duringRead = undefined; release(); controller.registerTarget({}, { backgroundId: STUDY, canActivate: () => true }); };
    expect(controller.openObject()).toBe(false); expect(controller.getSnapshot().mode).toBe("closed");
    controller.refreshTarget(); expect(controller.open()).toBe(true); expect(controller.openObject()).toBe(true);
    const callback = vi.fn(), notified = vi.fn();
    controller.subscribe(() => { if (controller.getSnapshot().mode === "closed") controller.dispose(); });
    controller.subscribe(notified);
    expect(controller.openBooks(callback)).toBe(false); expect(callback).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({ available: false, mode: "closed" });
    const final = controller.getSnapshot(), calls = notified.mock.calls.length, staleReady = vi.fn(() => true);
    controller.setContext(adult); controller.registerTarget({}, { backgroundId: STUDY, canActivate: staleReady });
    controller.refreshTarget(); controller.close(); controller.closeObject(); controller.dispose(); release();
    expect(controller.open()).toBe(false); expect(controller.openObject()).toBe(false); expect(controller.openBooks(callback)).toBe(false);
    expect(controller.getSnapshot()).toBe(final); expect(notified).toHaveBeenCalledTimes(calls); expect(staleReady).not.toHaveBeenCalled();
  });
});
