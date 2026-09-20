import { describe, expect, it, vi } from "vitest";
import { createPlanetStandInspectionController, type PlanetStandInspectionContext } from "./planetStandInspection";

const ready = (overrides: Partial<PlanetStandInspectionContext> = {}): PlanetStandInspectionContext => ({
  enabled: true, visible: true, editorOpen: true, ready: true, standId: "stand.base.portrait-tolstoy", renderRevision: 3, ...overrides,
});

describe("transient stand inspection intent", () => {
  it("requires the actual adult application editor and a rendered included stand", () => {
    const controller = createPlanetStandInspectionController();
    expect(controller.start()).toBe(false);
    for (const context of [ready({ enabled: false }), ready({ visible: false }), ready({ editorOpen: false }),
      ready({ ready: false }), ready({ standId: "canonical" }), ready({ standId: "stand.base.unknown" }), ready({ renderRevision: NaN })]) {
      controller.setContext(context); expect(controller.start()).toBe(false);
      expect(controller.getSnapshot()).toEqual({ sessionId: null, request: null, phase: "closed" });
    }
    controller.setContext(ready()); expect(controller.start()).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ sessionId: 1, phase: "waiting", request: { standId: "stand.base.portrait-tolstoy", renderRevision: 3 } });
    expect(controller.start()).toBe(false);
  });

  it("keeps one return session through preview/quality updates and fences late callbacks after cancel", () => {
    const controller = createPlanetStandInspectionController(); controller.setContext(ready()); controller.start();
    controller.report({ sessionId: 1, phase: "active" });
    controller.setContext(ready({ standId: "stand.base.three-whales", renderRevision: 4, ready: false }));
    expect(controller.getSnapshot()).toMatchObject({ sessionId: 1, request: { standId: "stand.base.three-whales", renderRevision: 4 } });
    controller.setContext(ready({ standId: "stand.base.three-whales", renderRevision: 5 }));
    controller.report({ sessionId: 1, phase: "active" });
    expect(controller.returnToGlobe()).toBe(true);
    expect(controller.getSnapshot()).toEqual({ sessionId: 1, request: null, phase: "returning" });
    expect(controller.report({ sessionId: 1, phase: "active" })).toBe(false);
    controller.setContext(ready()); expect(controller.start()).toBe(false);
    expect(controller.report({ sessionId: 1, phase: "closed", reason: "returned" })).toBe(true);
    expect(controller.start()).toBe(true);
    expect(controller.report({ sessionId: 1, phase: "closed" })).toBe(false);
    expect(controller.getSnapshot().sessionId).toBe(2);
  });

  it("retains cancellation identity before the first camera frame and never resumes after hidden/editor teardown", () => {
    const controller = createPlanetStandInspectionController(); controller.setContext(ready()); controller.start();
    controller.returnToGlobe();
    expect(controller.getSnapshot()).toEqual({ sessionId: 1, request: null, phase: "returning" });
    controller.report({ sessionId: 1, phase: "closed" }); controller.start();
    controller.setContext(ready({ visible: false }));
    expect(controller.getSnapshot()).toEqual({ sessionId: 2, request: null, phase: "returning" });
    controller.setContext(ready());
    expect(controller.getSnapshot().request).toBeNull();
    controller.report({ sessionId: 2, phase: "closed" }); controller.start();
    controller.setContext(ready({ editorOpen: false }));
    expect(controller.getSnapshot().phase).toBe("returning");
    controller.dispose(); expect(controller.start()).toBe(false);
    expect(controller.report({ sessionId: 3, phase: "active" })).toBe(false);
  });

  it("does not publish stale state to later listeners after a reentrant cancellation", () => {
    const controller = createPlanetStandInspectionController(), observed: string[] = [];
    controller.setContext(ready());
    const stop = controller.subscribe(() => {
      if (controller.getSnapshot().phase === "waiting") controller.returnToGlobe();
    });
    controller.subscribe(() => observed.push(controller.getSnapshot().phase));
    const bad = controller.subscribe(() => { throw new Error("Observer failed"); });
    expect(controller.start()).toBe(false);
    expect(observed).toEqual(["returning"]);
    stop(); bad();
    const subscriber = vi.fn(); controller.subscribe(subscriber);
    controller.report({ sessionId: 1, phase: "closed" });
    expect(subscriber).toHaveBeenCalledOnce();
    controller.dispose(); controller.dispose();
  });
});
