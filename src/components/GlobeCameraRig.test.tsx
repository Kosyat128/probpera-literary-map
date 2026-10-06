import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import GlobeCameraRig, {
  globeCameraDestination,
  globeCameraIntentKey,
  globeCameraMotionSourceForIntent,
  type GlobeCameraRigProps,
  type GlobeCountryCameraIntentKind,
  type GlobeCountryFocusIntent,
} from "./GlobeCameraRig";
import {
  GLOBE_SAFE_CAMERA_RADIUS,
  HOME_CAMERA_POSITION,
  HOME_ORBIT_TARGET,
} from "./globeFocusMath";
import type { GlobeRenderedStandBounds, GlobeStandInspectionBridge } from "./globeStandInspection";

// Execute the original rig through repeated controlled hook commits. Only the
// React/Fiber scheduler and the OrbitControls port are replaced; camera values,
// rig effects, flight progression and inspection ownership are production code.
// This is not a browser/DOM or GPU test.
const rigHooks = vi.hoisted(() => {
  type Effect = () => void | (() => void);
  type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void; layout?: boolean };
  const same = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) =>
    a !== undefined && b !== undefined && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  class Host {
    slots: Slot[] = [];
    cursor = 0;
    pending: Array<{ slot: Slot; work: Effect; layout: boolean }> = [];
    frame: (() => void) | null = null;
    three: unknown;
    ref(value: unknown) {
      const index = this.cursor++;
      if (!this.slots[index]) this.slots[index] = { value: { current: value } };
      return this.slots[index].value;
    }
    memo(work: () => unknown, deps?: readonly unknown[]) {
      const index = this.cursor++, prior = this.slots[index];
      if (!prior || !same(prior.deps, deps)) this.slots[index] = { value: work(), deps };
      return this.slots[index].value;
    }
    effect(work: Effect, deps: readonly unknown[] | undefined, layout: boolean) {
      const index = this.cursor++, prior = this.slots[index];
      if (prior && same(prior.deps, deps)) return;
      const slot = { deps, cleanup: prior?.cleanup, layout };
      this.slots[index] = slot;
      this.pending.push({ slot, work, layout });
    }
    commit() {
      const pending = this.pending.splice(0);
      for (const layout of [true, false]) {
        const phase = pending.filter(item => item.layout === layout);
        for (const { slot } of phase) { slot.cleanup?.(); slot.cleanup = undefined; }
        for (const { slot, work } of phase) {
          const cleanup = work();
          slot.cleanup = typeof cleanup === "function" ? cleanup : undefined;
        }
      }
    }
    cleanup(layout: boolean) {
      for (const slot of this.slots) if (slot.layout === layout) {
        slot.cleanup?.(); slot.cleanup = undefined;
      }
    }
  }
  return { current: null as Host | null, create: () => new Host() };
});
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useRef: (value: unknown) => rigHooks.current!.ref(value),
  useMemo: (work: () => unknown, deps?: readonly unknown[]) => rigHooks.current!.memo(work, deps),
  useCallback: (callback: unknown, deps?: readonly unknown[]) => rigHooks.current!.memo(() => callback, deps),
  useLayoutEffect: (work: () => void | (() => void), deps?: readonly unknown[]) => rigHooks.current!.effect(work, deps, true),
  useEffect: (work: () => void | (() => void), deps?: readonly unknown[]) => rigHooks.current!.effect(work, deps, false),
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => rigHooks.current!.three,
  useFrame: (work: () => void) => { rigHooks.current!.frame = work; },
}));
vi.mock("@react-three/drei", () => ({ OrbitControls: () => null }));

const rigCleanups = new Set<() => void>();
afterEach(() => {
  for (const cleanup of rigCleanups) cleanup();
  rigCleanups.clear(); rigHooks.current = null;
  vi.restoreAllMocks();
});

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

function controlledRig(initial: GlobeCameraRigProps = {}) {
  const host = rigHooks.create(), camera = new THREE.PerspectiveCamera(43, 1.6, .1, 100);
  const canvas = new EventTarget(), residual = new THREE.Vector3();
  const updateStates: Array<{ damping: boolean; min: number; max: number }> = [];
  let lost = false, time = 0, mounted = true;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  const controls = {
    target: new THREE.Vector3(), enabled: true, enableRotate: true, enableZoom: true,
    enableDamping: true, autoRotate: false, minDistance: 0, maxDistance: Infinity,
    minPolarAngle: 0, maxPolarAngle: Math.PI,
    update: vi.fn(() => {
      updateStates.push({ damping: controls.enableDamping, min: controls.minDistance, max: controls.maxDistance });
      // A residue is intentionally capable of moving the camera during a flush.
      // Restoring only before update(), instead of after it, must fail the test.
      if (!controls.enableDamping) { camera.position.add(residual); residual.set(0, 0, 0); }
      camera.lookAt(controls.target);
      return true;
    }),
  };
  const invalidate = vi.fn(), onViewSettled = vi.fn(), onInteractionEnd = vi.fn(), onProgrammaticStart = vi.fn();
  let props: GlobeCameraRigProps = { active: true, reducedMotion: true, onViewSettled, onInteractionEnd, onProgrammaticStart, ...initial };
  let element: { ref: { current: unknown }; props: { onStart(): void; onEnd(): void } };
  host.three = { camera, gl: { domElement: canvas, getContext: () => ({ isContextLost: () => lost }) },
    size: { width: 960, height: 600 }, invalidate };
  const render = (next: Partial<GlobeCameraRigProps> = {}) => {
    if (!mounted) throw new Error("Cannot render a retired rig");
    props = { ...props, ...next }; host.cursor = 0; rigHooks.current = host;
    try { element = GlobeCameraRig(props) as unknown as typeof element; }
    finally { rigHooks.current = null; }
    element.ref.current = controls;
    host.commit();
  };
  const pose = () => ({ position: camera.position.toArray(), target: controls.target.toArray(),
    quaternion: camera.quaternion.toArray(), up: camera.up.toArray(), zoom: camera.zoom });
  const place = (variant: number) => {
    camera.position.set(3.1 - variant * .35, 1.7 + variant * .2, 5.4 - variant * .3);
    controls.target.set(.07 + variant * .03, -.11 - variant * .04, .02 + variant * .05);
    camera.up.set(.03 + variant * .01, 1, .07 - variant * .01).normalize();
    camera.zoom = 1.37 + variant * .19; camera.lookAt(controls.target); camera.updateProjectionMatrix();
  };
  const unmount = () => {
    if (!mounted) return;
    mounted = false; host.cleanup(true);
    // React detaches the child controls ref before the parent's passive cleanup.
    element.ref.current = null; host.cleanup(false);
    host.frame = null; rigCleanups.delete(unmount);
  };
  rigCleanups.add(unmount); render(); place(0);
  return { camera, controls, canvas, invalidate, onViewSettled, onInteractionEnd, onProgrammaticStart,
    residual, updateStates, render, pose, place, unmount,
    startDrag: () => element.props.onStart(),
    frame: (now: number) => { time = now; host.frame?.(); },
    queuedFrame: () => host.frame!,
    contextLost: () => { lost = true; canvas.dispatchEvent(new Event("webglcontextlost")); },
    contextRestored: () => { lost = false; canvas.dispatchEvent(new Event("webglcontextrestored")); },
  };
}

function inspectedStand() {
  const request = { sessionId: 1, standId: "stand.base.portrait-tolstoy" as const, renderRevision: 8 };
  const onState = vi.fn();
  const bridge: GlobeStandInspectionBridge = { sessionId: 1, request, phase: "waiting", onState,
    insets: { left: 120, right: 160 } };
  const bounds: GlobeRenderedStandBounds = { standId: request.standId, renderRevision: request.renderRevision,
    qualityTier: "high", min: [-.4, -1.73, -.4], max: [.4, -1.02, .4] };
  return { bridge, bounds, onState,
    closed: { ...bridge, request: null, phase: "closed" as const } };
}

function countryIntent(
  kind: GlobeCountryCameraIntentKind = "country-focus",
  id: string | number = 4,
  countryId = "france"
): GlobeCountryFocusIntent {
  return {
    id,
    kind,
    countryId,
    metrics: {
      direction: new THREE.Vector3(0.3, 0.4, 0.8).normalize(),
      angularRadius: THREE.MathUtils.degToRad(8),
      principalAngularExtent: THREE.MathUtils.degToRad(8),
      principalPolygonCount: 1,
      source: "geometry",
    },
  };
}

describe("GlobeCameraRig contract", () => {
  it("keeps distinct country and home targets", () => {
    const country = globeCameraDestination({
      intent: countryIntent(),
      verticalFovDegrees: 43,
      viewportWidth: 1_200,
      viewportHeight: 800,
      viewInsets: ZERO_INSETS,
    });
    const home = globeCameraDestination({
      intent: { id: 5, kind: "home" },
      verticalFovDegrees: 43,
      viewportWidth: 1_200,
      viewportHeight: 800,
      viewInsets: ZERO_INSETS,
    });

    expect(country.target.toArray()).toEqual([0, 0, 0]);
    expect(home.target.toArray()).toEqual([
      HOME_ORBIT_TARGET.x,
      HOME_ORBIT_TARGET.y,
      HOME_ORBIT_TARGET.z,
    ]);
    expect(home.direction.clone().multiplyScalar(home.radius).toArray()).toEqual([
      HOME_CAMERA_POSITION.x,
      HOME_CAMERA_POSITION.y,
      HOME_CAMERA_POSITION.z,
    ]);
    expect(country.radius).toBeGreaterThanOrEqual(GLOBE_SAFE_CAMERA_RADIUS);
  });

  it("uses the free-area insets to choose a safer country radius", () => {
    const intent = countryIntent();
    intent.metrics.principalAngularExtent = THREE.MathUtils.degToRad(34);
    const open = globeCameraDestination({
      intent,
      verticalFovDegrees: 43,
      viewportWidth: 1_200,
      viewportHeight: 800,
      viewInsets: ZERO_INSETS,
    });
    const obstructed = globeCameraDestination({
      intent,
      verticalFovDegrees: 43,
      viewportWidth: 1_200,
      viewportHeight: 800,
      viewInsets: { ...ZERO_INSETS, right: 420 },
    });
    expect(obstructed.radius).toBeGreaterThan(open.radius);
  });

  it("keys every intent so a newer request can replace an active flight", () => {
    expect(globeCameraIntentKey(countryIntent())).toBe(
      "country-focus:france:4"
    );
    expect(globeCameraIntentKey({ id: "reset-9", kind: "home" })).toBe(
      "home:reset-9"
    );
  });

  it("preserves each semantic programmatic source", () => {
    const countrySources: GlobeCountryCameraIntentKind[] = [
      "country-focus",
      "country-refocus",
      "writer-focus",
      "random-focus",
    ];

    for (const [index, source] of countrySources.entries()) {
      const intent = countryIntent(source, index + 1);
      expect(globeCameraMotionSourceForIntent(intent)).toBe(source);
      expect(globeCameraIntentKey(intent)).toBe(
        `${source}:france:${index + 1}`
      );
    }
    expect(globeCameraMotionSourceForIntent({ id: 5, kind: "home" })).toBe(
      "home"
    );
  });

  it("makes rapid same-target requests distinct so the latest flight wins", () => {
    const rapidIntents = [
      countryIntent("country-focus", 11, "japan"),
      countryIntent("country-refocus", 12, "japan"),
      countryIntent("random-focus", 13, "china"),
    ];
    const keys = rapidIntents.map(globeCameraIntentKey);

    expect(new Set(keys).size).toBe(rapidIntents.length);
    expect(keys[keys.length - 1]).toBe("random-focus:china:13");

    const source = readFileSync(
      new URL("./GlobeCameraRig.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain('cancelMotion("superseded")');
    expect(source).toContain("flightRef.current = flight");
    expect(source).not.toContain("flightQueue");
  });

  it("labels cancellation at every controller-owned interruption boundary", () => {
    const source = readFileSync(
      new URL("./GlobeCameraRig.tsx", import.meta.url),
      "utf8"
    );

    for (const cancellationSource of [
      "superseded",
      "manual",
      "command",
      "visibility",
      "unmount",
    ]) {
      expect(source).toContain(`cancelMotion("${cancellationSource}")`);
    }
    expect(source).toContain("onProgrammaticStart");
    expect(source).toContain("onProgrammaticCancel");
    expect(source).toContain("globeCameraIntentKey(activeFlight.intent)");
  });

  it("contains one controls owner and no cartesian or external RAF tween", () => {
    const source = readFileSync(new URL("./GlobeCameraRig.tsx", import.meta.url), "utf8");
    expect(source.match(/<OrbitControls\b/g)).toHaveLength(1);
    expect(source).toContain("sampleCameraTrajectory");
    expect(source).not.toContain("lerpVectors");
    expect(source).not.toContain("requestAnimationFrame");
    expect(source).toContain("onStart={handleInteractionStart}");
    expect(source).toContain("enabled={active && interactionEnabled}");
  });

  it("starts flight time on its first rendered frame and clears damping residue", () => {
    const source = readFileSync(
      new URL("./GlobeCameraRig.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("startedAt: null");
    expect(source).toContain(
      "if (flight.startedAt === null) flight.startedAt = frameTime"
    );
    const settlingLoop = source.slice(
      source.indexOf("const settling ="),
      source.indexOf("if (controls.autoRotate) invalidate()")
    );
    expect(settlingLoop).toContain("controls.enableDamping = false");
    expect(settlingLoop.indexOf("controls.enableDamping = false")).toBeLessThan(
      settlingLoop.indexOf("syncRestingControls();")
    );
  });

  it("issues one atomic country intent per selection, including same-country refocus", () => {
    const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    const selectCountrySource = appSource.slice(
      appSource.indexOf("const selectCountry"),
      appSource.indexOf("const selectRandomLiteraryDestination")
    );
    const closeCountrySource = appSource.slice(
      appSource.indexOf("const closeCountry"),
      appSource.indexOf("const selectAtlasFilter")
    );
    const randomSource = appSource.slice(
      appSource.indexOf("const selectRandomLiteraryDestination"),
      appSource.indexOf("const focusCountryPresentation")
    );
    const writerSource = appSource.slice(
      appSource.indexOf("const showWriterOnGlobe"),
      appSource.indexOf("const openCommunity")
    );
    expect(selectCountrySource).toContain(
      "globeFocusRequestIdRef.current += 1"
    );
    expect(selectCountrySource).toContain('"country-refocus"');
    expect(selectCountrySource).toContain('"country-focus"');
    expect(selectCountrySource).toContain("countryId: country.id");
    expect(randomSource).toContain('"random-focus"');
    expect(writerSource).toContain('kind: "writer-focus"');
    expect(closeCountrySource).toContain("setGlobeFocusRequest(null)");
  });
});

describe("controlled original rig preview and Explore camera ownership", () => {
  it("restores the exact saved pose after manual preview movement and drains pending damping", () => {
    const f = controlledRig({ reducedMotion: false, autoRotate: true, viewInsets: { left: 90, bottom: 35 } });
    const original = f.pose(), originalProjection = f.camera.projectionMatrix.toArray();
    f.render({ inspectionSession: "preview:1" });
    expect(f.controls.autoRotate).toBe(false);
    f.startDrag(); f.place(2); f.residual.set(.2, -.1, .3);
    const before = f.updateStates.length;
    f.render({ inspectionSession: null });
    expect(f.pose()).toEqual(original);
    expect(f.camera.projectionMatrix.toArray()).toEqual(originalProjection);
    expect(f.residual.lengthSq()).toBe(0);
    expect(f.updateStates.slice(before)).toContainEqual({ damping: false, min: 0, max: Infinity });
    expect(f.onInteractionEnd).toHaveBeenCalledOnce();
    expect(f.onViewSettled).toHaveBeenLastCalledWith(expect.objectContaining({ source: "scene-return", position: original.position, target: original.target }));
    expect(f.controls.autoRotate).toBe(true);
    f.frame(100); f.frame(200);
    expect(f.pose()).toEqual(original);
  });

  it.each(["preview-first", "stand-first"] as const)(
    "restores the outer original pose when closing a nested stand inspection (%s)", order => {
      const f = controlledRig(), stand = inspectedStand(), original = f.pose();
      if (order === "preview-first") {
        f.render({ inspectionSession: "preview:1" }); f.place(1);
        f.render({ standInspection: stand.bridge, standInspectionBounds: stand.bounds });
      } else {
        f.render({ standInspection: stand.bridge, standInspectionBounds: stand.bounds });
        const framed = f.pose();
        f.render({ inspectionSession: "preview:1" });
        expect(f.pose()).toEqual(framed); // Capturing a lease must not itself move the camera.
      }
      expect(stand.onState).toHaveBeenCalledWith({ sessionId: 1, phase: "active" });
      expect(f.pose().position).not.toEqual(original.position);
      expect(f.pose().zoom).not.toBe(original.zoom);
      f.render({ inspectionSession: null, standInspection: stand.closed });
      expect(f.pose()).toEqual(original);
      expect(stand.onState).toHaveBeenLastCalledWith({ sessionId: 1, phase: "closed", reason: "returned" });
      f.frame(10_000);
      expect(f.pose()).toEqual(original);
    },
  );

  it.each(["country", "home-focus", "home-command"] as const)(
    "lets a newer %s intent win over the retired preview and its later close", kind => {
      const f = controlledRig({ reducedMotion: false }), stand = inspectedStand(), original = f.pose();
      f.render({ inspectionSession: "preview:1" }); f.place(2);
      f.render({ standInspection: stand.bridge, standInspectionBounds: stand.bounds });
      f.frame(0); f.frame(10_000);
      expect(stand.onState).toHaveBeenCalledWith({ sessionId: 1, phase: "active" });
      const country = countryIntent("country-focus", 41, "japan");
      const intent = kind === "country" ? country : { id: "new-home", kind: "home" as const };
      if (kind === "home-command") f.render({ controlRequest: { id: "new-home", action: { type: "reset" } } });
      else f.render({ focusIntent: intent });
      f.frame(20_000); f.frame(30_000);
      const expected = globeCameraDestination({ intent, verticalFovDegrees: 43, viewportWidth: 960, viewportHeight: 600, viewInsets: ZERO_INSETS });
      expect(f.camera.position.distanceTo(expected.direction.clone().multiplyScalar(expected.radius))).toBeLessThan(1e-12);
      expect(f.controls.target.distanceTo(expected.target)).toBeLessThan(1e-12);
      expect(f.pose().position).not.toEqual(original.position);
      if (kind !== "country") expect(f.camera.zoom).toBe(1);
      expect(stand.onState).toHaveBeenLastCalledWith({ sessionId: 1, phase: "closed", reason: "superseded" });
      expect(f.onProgrammaticStart).toHaveBeenCalledOnce();
      const destination = f.pose(), arrivals = f.onViewSettled.mock.calls.length;
      f.render({ inspectionSession: null, standInspection: stand.closed }); f.frame(40_000);
      expect(f.pose()).toEqual(destination);
      expect(f.onViewSettled).toHaveBeenCalledTimes(arrivals);
      // A later explicit inspection captures the new geographic pose.
      f.render({ inspectionSession: "preview:2" }); f.place(3);
      f.render({ inspectionSession: null });
      expect(f.pose()).toEqual(destination);
    },
  );

  it("retires a context-lost lease and never resurrects it on foreground or context restoration", () => {
    const f = controlledRig(), original = f.pose();
    f.render({ inspectionSession: "preview:1" }); f.startDrag(); f.place(2);
    const invalidations = f.invalidate.mock.calls.length;
    f.contextLost();
    expect(f.pose()).toEqual(original);
    expect(f.onInteractionEnd).toHaveBeenCalledOnce();
    expect(f.invalidate).toHaveBeenCalledTimes(invalidations);
    const restored = f.onViewSettled.mock.calls.length;
    f.contextLost(); // Duplicate browser delivery has no second owner to restore.
    expect(f.onViewSettled).toHaveBeenCalledTimes(restored);
    f.render({ active: false });
    f.contextRestored(); f.render({ active: true });
    f.place(3); const newerPose = f.pose();
    f.render({ inspectionSession: null }); f.frame(10_000);
    expect(f.pose()).toEqual(newerPose);
    expect(f.onViewSettled).toHaveBeenCalledTimes(restored);
    f.render({ inspectionSession: "preview:2" }); f.place(4);
    f.render({ inspectionSession: null });
    expect(f.pose()).toEqual(newerPose);
  });

  it("restores a cancelled background preview before suspension and leaves no retired event/frame writer", () => {
    const f = controlledRig(), original = f.pose();
    const add = vi.spyOn(f.canvas, "addEventListener"), remove = vi.spyOn(f.canvas, "removeEventListener");
    // The first mounted listener was installed before these spies. A new GL
    // owner is unnecessary: observe actual removed callback and subsequent events.
    f.render({ inspectionSession: "preview:1" }); f.place(2);
    f.render({ active: false, inspectionSession: null });
    expect(f.pose()).toEqual(original);
    expect(f.controls.enabled).toBe(false);
    f.render({ active: true, inspectionSession: "preview:2" }); f.place(3);
    const queued = f.queuedFrame();
    f.unmount();
    expect(remove).toHaveBeenCalledWith("webglcontextlost", expect.any(Function));
    expect(add).not.toHaveBeenCalled();
    f.place(4); const external = f.pose(), settlements = f.onViewSettled.mock.calls.length;
    f.contextLost(); queued();
    expect(f.pose()).toEqual(external);
    expect(f.onViewSettled).toHaveBeenCalledTimes(settlements);
  });
});
