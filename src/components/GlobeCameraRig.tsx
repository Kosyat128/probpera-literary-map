import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import {
  GLOBE_MAX_FOCUS_RADIUS,
  GLOBE_MAX_CAMERA_RADIUS,
  GLOBE_SAFE_CAMERA_RADIUS,
  angularDistanceRadians,
  cameraFlightDurationMs,
  focusCameraRadius,
  globeCenterVector,
  homeCameraPositionVector,
  homeOrbitTargetVector,
  sampleCameraTrajectory,
  type CountryFocusMetrics,
  type GlobeCameraTrajectory,
  type ViewInsets,
} from "./globeFocusMath";
import {
  orbitDollyMethodForZoomDirection,
  type GlobeControlAction,
} from "./globeInteraction";
import {
  applyPerspectiveViewInsets,
  normalizedViewInsets,
} from "./globeProjection";
import {
  globeStandInspectionFrame, globeStandInspectionMagnification, globeStandInspectionOrbitLimits, globeStandInspectionZoom, standInspectionBoundsMatch,
  type GlobeRenderedStandBounds, type GlobeStandInspectionBridge, type GlobeStandInspectionEvent,
  type GlobeStandInspectionRequest, type GlobeStandInspectionZoomState,
} from "./globeStandInspection";

export type GlobeCameraPhase =
  | "idle"
  | "auto"
  | "programmatic"
  | "manual"
  | "settling"
  | "command";

export type GlobeCountryCameraIntentKind =
  | "country-focus"
  | "country-refocus"
  | "writer-focus"
  | "random-focus";

export type GlobeProgrammaticCameraSource =
  | GlobeCountryCameraIntentKind
  | "home"
  | "stand-inspection"
  | "stand-return";

export type GlobeCameraMotionSource =
  | GlobeProgrammaticCameraSource
  | "manual"
  | "command"
  | "auto"
  | "scene-return"
  | "projection";

export type GlobeCameraCancellationSource =
  | "manual"
  | "command"
  | "visibility"
  | "superseded"
  | "unmount";

export type GlobeCameraCancellationEvent = {
  source: GlobeCameraCancellationSource;
  intentKey: string;
};

export type GlobeCountryFocusIntent = {
  id: string | number;
  kind: GlobeCountryCameraIntentKind;
  countryId: string;
  metrics: CountryFocusMetrics;
};

export type GlobeHomeFocusIntent = {
  id: string | number;
  kind: "home";
};

export type GlobeCameraFocusIntent =
  | GlobeCountryFocusIntent
  | GlobeHomeFocusIntent;

export type GlobeCameraControlRequest = {
  id: string | number;
  action: Exclude<GlobeControlAction, { type: "select" }>;
};

export type GlobeCameraView = {
  position: readonly [x: number, y: number, z: number];
  target: readonly [x: number, y: number, z: number];
  phase: GlobeCameraPhase;
  source: GlobeCameraMotionSource;
  inspectionZoom?: GlobeStandInspectionZoomState;
};

export type GlobeCameraRigProps = {
  focusIntent?: GlobeCameraFocusIntent | null;
  controlRequest?: GlobeCameraControlRequest | null;
  autoRotate?: boolean;
  reducedMotion?: boolean;
  mobile?: boolean;
  active?: boolean;
  interactionEnabled?: boolean;
  viewInsets?: Partial<ViewInsets> | null;
  standInspection?: GlobeStandInspectionBridge;
  standInspectionBounds?: GlobeRenderedStandBounds | null;
  /** A preview/Explore lease, not a second camera or serialized camera state. */
  inspectionSession?: string | null;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  onPhaseChange?: (phase: GlobeCameraPhase) => void;
  /** Persistent semantic evidence that a new programmatic flight actually began. */
  onProgrammaticStart?: (intentKey: string) => void;
  /** Emitted only when an active programmatic flight is interrupted. */
  onProgrammaticCancel?: (event: GlobeCameraCancellationEvent) => void;
  /** Called after an actual camera change; suitable for a throttled centre-ray candidate. */
  onViewChange?: (view: GlobeCameraView) => void;
  /** Called once a flight, keyboard command, wheel, or drag has fully settled. */
  onViewSettled?: (view: GlobeCameraView) => void;
};

type CameraDestination = {
  direction: THREE.Vector3;
  radius: number;
  target: THREE.Vector3;
};

type ActiveFlight = {
  token: number;
  source: GlobeProgrammaticCameraSource;
  startedAt: number | null;
  durationMs: number;
  trajectory: GlobeCameraTrajectory;
} & ({ intent: GlobeCameraFocusIntent; inspection?: undefined } | {
  intent: null;
  inspection: { sessionId: number; returning: boolean; fromZoom: number; toZoom: number };
});

type CameraPose = { position: THREE.Vector3; target: THREE.Vector3; quaternion: THREE.Quaternion; up: THREE.Vector3; zoom: number };
type InspectionSession = {
  request: GlobeStandInspectionRequest;
  original: CameraPose;
  focusKey: string | null;
  phase: GlobeStandInspectionEvent["phase"];
  framedStandId: string | null;
  bounds: GlobeRenderedStandBounds | null;
  viewportKey: string;
  fittedZoom: number | null;
  zoomFactor: number;
};

type SettlingMotion = {
  source: "manual" | "command";
  startedAt: number;
  stableFrames: number;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  target: THREE.Vector3;
};

const MIN_POLAR_ANGLE = 0.08;
const MAX_POLAR_ANGLE = Math.PI - MIN_POLAR_ANGLE;
const DAMPING_FACTOR = 0.055;
const SETTLE_POSITION_EPSILON_SQ = 1e-8;
const SETTLE_QUATERNION_EPSILON = 1e-7;
const SETTLE_STABLE_FRAMES = 3;
const SETTLE_TIMEOUT_MS = 1_500;

export function globeCameraIntentKey(intent: GlobeCameraFocusIntent) {
  return intent.kind === "home"
    ? `home:${String(intent.id)}`
    : `${intent.kind}:${intent.countryId}:${String(intent.id)}`;
}

export function globeCameraMotionSourceForIntent(
  intent: GlobeCameraFocusIntent
): GlobeProgrammaticCameraSource {
  return intent.kind;
}

export function globeCameraDestination({
  intent,
  verticalFovDegrees,
  viewportWidth,
  viewportHeight,
  viewInsets,
}: {
  intent: GlobeCameraFocusIntent;
  verticalFovDegrees: number;
  viewportWidth: number;
  viewportHeight: number;
  viewInsets: ViewInsets;
}): CameraDestination {
  if (intent.kind === "home") {
    const position = homeCameraPositionVector();
    return {
      direction: position.clone().normalize(),
      radius: position.length(),
      target: homeOrbitTargetVector(),
    };
  }

  return {
    direction: intent.metrics.direction.clone().normalize(),
    radius: focusCameraRadius({
      metrics: intent.metrics,
      verticalFovDegrees,
      viewportWidth,
      viewportHeight,
      insets: viewInsets,
    }),
    target: globeCenterVector(),
  };
}

function cameraView(
  camera: THREE.Camera,
  controls: OrbitControlsImpl,
  phase: GlobeCameraPhase,
  source: GlobeCameraMotionSource,
  inspection?: InspectionSession | null,
): GlobeCameraView {
  const magnification = inspection?.phase === "active" && inspection.fittedZoom !== null
    ? globeStandInspectionMagnification(inspection.fittedZoom, inspection.zoomFactor) : null;
  return {
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [controls.target.x, controls.target.y, controls.target.z],
    phase,
    source,
    ...(magnification && camera instanceof THREE.PerspectiveCamera ? { inspectionZoom: {
      zoom: camera.zoom, minZoom: magnification.minZoom, maxZoom: magnification.maxZoom,
      percent: Math.round(camera.zoom / inspection!.fittedZoom! * 100),
    } } : {}),
  };
}

/**
 * The only imperative owner of globe camera position, target, zoom and orbit
 * commands. Keeping OrbitControls inside this component prevents competing
 * writers and makes cancellation deterministic: the newest request wins and a
 * real pointer/wheel start cancels a programmatic flight synchronously.
 */
export default function GlobeCameraRig({
  focusIntent = null,
  controlRequest = null,
  autoRotate = false,
  reducedMotion = false,
  mobile = false,
  active = true,
  interactionEnabled = true,
  viewInsets,
  standInspection,
  standInspectionBounds = null,
  inspectionSession = null,
  onInteractionStart,
  onInteractionEnd,
  onPhaseChange,
  onProgrammaticStart,
  onProgrammaticCancel,
  onViewChange,
  onViewSettled,
}: GlobeCameraRigProps) {
  const { camera, gl, invalidate, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const flightRef = useRef<ActiveFlight | null>(null);
  const settlingRef = useRef<SettlingMotion | null>(null);
  const flightTokenRef = useRef(0);
  const handledFocusKeyRef = useRef<string | null>(null);
  const handledControlKeyRef = useRef<string | null>(null);
  const manualInteractionRef = useRef(false);
  const initializedRef = useRef(false);
  const phaseRef = useRef<GlobeCameraPhase>("idle");
  const inspectionRef = useRef<InspectionSession | null>(null);
  const sceneCameraRef = useRef<{ key: string; original: CameraPose; focusKey: string | null } | null>(null);
  const seenSceneCameraKey = useRef<string | null>(null);
  const closedInspectionRef = useRef(0);
  const inspectionBridgeRef = useRef(standInspection);
  useLayoutEffect(() => { inspectionBridgeRef.current = standInspection; }, [standInspection]);
  const callbacksRef = useRef({
    onInteractionStart,
    onInteractionEnd,
    onPhaseChange,
    onProgrammaticStart,
    onProgrammaticCancel,
    onViewChange,
    onViewSettled,
  });
  callbacksRef.current = {
    onInteractionStart,
    onInteractionEnd,
    onPhaseChange,
    onProgrammaticStart,
    onProgrammaticCancel,
    onViewChange,
    onViewSettled,
  };

  const settingsRef = useRef({
    active,
    autoRotate,
    reducedMotion,
    mobile,
    interactionEnabled,
  });
  settingsRef.current = {
    active,
    autoRotate,
    reducedMotion,
    mobile,
    interactionEnabled,
  };

  const inspectionInsets = standInspection?.phase !== "closed" ? standInspection?.insets : undefined;
  const baseInsets = useMemo(() => normalizedViewInsets(viewInsets), [viewInsets?.bottom, viewInsets?.left, viewInsets?.right, viewInsets?.top]);
  const baseInsetsRef = useRef(baseInsets); baseInsetsRef.current = baseInsets;
  const normalizedInsets = useMemo(() => ({
    top: Math.max(baseInsets.top, inspectionInsets?.top ?? 0),
    right: Math.max(baseInsets.right, inspectionInsets?.right ?? 0),
    bottom: Math.max(baseInsets.bottom, inspectionInsets?.bottom ?? 0),
    left: Math.max(baseInsets.left, inspectionInsets?.left ?? 0),
  }), [baseInsets, inspectionInsets?.top, inspectionInsets?.right, inspectionInsets?.bottom, inspectionInsets?.left]);
  const insetsRef = useRef(normalizedInsets);
  insetsRef.current = normalizedInsets;

  const setPhase = useCallback((nextPhase: GlobeCameraPhase) => {
    if (phaseRef.current === nextPhase) return;
    phaseRef.current = nextPhase;
    callbacksRef.current.onPhaseChange?.(nextPhase);
  }, []);

  const syncRestingControls = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const shouldAutoRotate =
      settingsRef.current.active &&
      settingsRef.current.autoRotate &&
      !settingsRef.current.reducedMotion &&
      !inspectionRef.current &&
      !sceneCameraRef.current &&
      !flightRef.current &&
      !settlingRef.current &&
      !manualInteractionRef.current;
    controls.enabled =
      settingsRef.current.active && settingsRef.current.interactionEnabled;
    controls.enableRotate = settingsRef.current.interactionEnabled;
    controls.enableZoom = settingsRef.current.interactionEnabled && !inspectionRef.current;
    controls.enableDamping = true;
    if (!flightRef.current) {
      const limits = inspectionRef.current?.framedStandId ? globeStandInspectionOrbitLimits(controls.target) : null;
      controls.minDistance = limits?.minDistance ?? GLOBE_SAFE_CAMERA_RADIUS;
      controls.maxDistance = limits?.maxDistance ?? GLOBE_MAX_CAMERA_RADIUS;
      controls.minPolarAngle = MIN_POLAR_ANGLE; controls.maxPolarAngle = MAX_POLAR_ANGLE;
    }
    controls.autoRotate = shouldAutoRotate;
    setPhase(shouldAutoRotate ? "auto" : "idle");
    if (shouldAutoRotate) invalidate();
  }, [invalidate, setPhase]);

  const emitViewChange = useCallback(
    (source: GlobeCameraMotionSource) => {
      const controls = controlsRef.current;
      if (!controls) return;
      callbacksRef.current.onViewChange?.(
        cameraView(camera, controls, phaseRef.current, source, inspectionRef.current)
      );
    },
    [camera]
  );

  const emitViewSettled = useCallback(
    (source: GlobeCameraMotionSource) => {
      const controls = controlsRef.current;
      if (!controls) return;
      callbacksRef.current.onViewSettled?.(
        cameraView(camera, controls, phaseRef.current, source, inspectionRef.current)
      );
    },
    [camera]
  );

  const cancelMotion = useCallback((source: GlobeCameraCancellationSource) => {
    const activeFlight = flightRef.current;
    if (activeFlight?.intent) {
      callbacksRef.current.onProgrammaticCancel?.({
        source,
        intentKey: globeCameraIntentKey(activeFlight.intent),
      });
    }
    flightTokenRef.current += 1;
    flightRef.current = null;
    settlingRef.current = null;
    const controls = controlsRef.current;
    if (controls) controls.autoRotate = false;
  }, []);

  const reportInspection = useCallback((session: InspectionSession, phase: GlobeStandInspectionEvent["phase"],
    reason?: GlobeStandInspectionEvent["reason"]) => {
    if (session.phase === phase && !reason) return;
    session.phase = phase;
    inspectionBridgeRef.current?.onState({ sessionId: session.request.sessionId, phase, ...(reason ? { reason } : {}) });
  }, []);

  const restoreCameraPose = useCallback((original: CameraPose, restorePosition: boolean) => {
    const controls = controlsRef.current;
    if (!controls) return;
    // Flush accumulated OrbitControls deltas without allowing them to alter the
    // saved pose (or the current pose that a newer geographic intent will use).
    const position = restorePosition ? original.position : camera.position.clone();
    const target = restorePosition ? original.target : controls.target.clone();
    controls.autoRotate = false; controls.enableDamping = false;
    controls.minDistance = 0; controls.maxDistance = Infinity;
    controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; controls.update();
    camera.position.copy(position); controls.target.copy(target); camera.up.copy(original.up);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.zoom = original.zoom;
      applyPerspectiveViewInsets(camera, size.width, size.height, baseInsetsRef.current);
    }
    controls.update();
    if (restorePosition) { camera.position.copy(position); camera.quaternion.copy(original.quaternion); }
    controls.minDistance = GLOBE_SAFE_CAMERA_RADIUS; controls.maxDistance = GLOBE_MAX_CAMERA_RADIUS;
  }, [camera, size.height, size.width]);

  const finishInspection = useCallback((restorePosition: boolean, reason: GlobeStandInspectionEvent["reason"], notify = true) => {
    const session = inspectionRef.current, controls = controlsRef.current;
    if (!session || !controls) return;
    cancelMotion("superseded");
    restoreCameraPose(session.original, restorePosition);
    inspectionRef.current = null;
    closedInspectionRef.current = Math.max(closedInspectionRef.current, session.request.sessionId);
    if (manualInteractionRef.current) { manualInteractionRef.current = false; callbacksRef.current.onInteractionEnd?.(); }
    syncRestingControls();
    emitViewChange("stand-return"); emitViewSettled("stand-return");
    if (settingsRef.current.active) invalidate();
    if (notify) reportInspection(session, "closed", reason);
  }, [cancelMotion, emitViewChange, emitViewSettled, invalidate, reportInspection, restoreCameraPose, syncRestingControls]);
  const finishInspectionRef = useRef(finishInspection);
  useLayoutEffect(() => { finishInspectionRef.current = finishInspection; }, [finishInspection]);

  const finishFlight = useCallback(
    (flight: ActiveFlight) => {
      if (flightRef.current?.token !== flight.token) return;
      const controls = controlsRef.current;
      if (!controls) return;
      if (flight.inspection?.returning) { finishInspection(true, "returned"); return; }

      const sample = sampleCameraTrajectory(flight.trajectory, 1);
      camera.up.set(0, 1, 0);
      camera.position.copy(sample.position);
      controls.target.copy(sample.target);
      if ((flight.intent?.kind === "home" || flight.inspection) && camera instanceof THREE.PerspectiveCamera) {
        camera.zoom = flight.inspection?.toZoom ?? 1;
        camera.updateProjectionMatrix();
      }
      controls.update();
      flightRef.current = null;
      controls.enableDamping = true;
      if (flight.inspection && inspectionRef.current?.request.sessionId === flight.inspection.sessionId) {
        reportInspection(inspectionRef.current, "active");
      }
      emitViewChange(flight.source);
      syncRestingControls();
      emitViewSettled(flight.source);
      invalidate();
    },
    [camera, emitViewChange, emitViewSettled, finishInspection, invalidate, reportInspection, syncRestingControls]
  );

  const startFlight = useCallback(
    (intent: GlobeCameraFocusIntent) => {
      const controls = controlsRef.current;
      if (!controls || !settingsRef.current.active) return;

      // A genuinely new country/writer/home intent owns navigation. Remove the
      // optical inspection state but do not replay its old geographic pose.
      if (inspectionRef.current) finishInspection(false, "superseded");
      sceneCameraRef.current = null;

      cancelMotion("superseded");
      const destination = globeCameraDestination({
        intent,
        verticalFovDegrees:
          camera instanceof THREE.PerspectiveCamera ? camera.fov : 43,
        viewportWidth: size.width,
        viewportHeight: size.height,
        viewInsets: baseInsetsRef.current,
      });
      const fromDirection = camera.position.clone().normalize();
      const trajectory: GlobeCameraTrajectory = {
        fromDirection,
        toDirection: destination.direction,
        fromRadius: Math.max(GLOBE_SAFE_CAMERA_RADIUS, camera.position.length()),
        toRadius: destination.radius,
        fromTarget: controls.target.clone(),
        toTarget: destination.target,
        safeMinimumRadius: GLOBE_SAFE_CAMERA_RADIUS,
      };
      const durationMs = cameraFlightDurationMs(
        angularDistanceRadians(fromDirection, destination.direction),
        {
          mobile: settingsRef.current.mobile,
          reducedMotion: settingsRef.current.reducedMotion,
        }
      );
      const flight: ActiveFlight = {
        token: ++flightTokenRef.current,
        source: globeCameraMotionSourceForIntent(intent),
        intent,
        // Start the clock on the first frame that can actually render the
        // flight. A busy main thread must not consume the whole animation
        // before the user has had a chance to interrupt it.
        startedAt: null,
        durationMs,
        trajectory,
      };
      flightRef.current = flight;
      callbacksRef.current.onProgrammaticStart?.(
        globeCameraIntentKey(intent)
      );
      controls.autoRotate = false;
      controls.enableDamping = false;
      setPhase("programmatic");

      if (durationMs === 0) {
        finishFlight(flight);
        return;
      }
      invalidate();
    },
    [camera, cancelMotion, finishFlight, finishInspection, invalidate, setPhase, size.height, size.width]
  );

  const startInspectionFlight = useCallback((session: InspectionSession, position: THREE.Vector3,
    target: THREE.Vector3, zoom: number, returning: boolean) => {
    const controls = controlsRef.current;
    if (!controls || !(camera instanceof THREE.PerspectiveCamera)) return;
    reportInspection(session, returning ? "returning" : "focusing");
    cancelMotion("superseded");
    if (manualInteractionRef.current) { manualInteractionRef.current = false; callbacksRef.current.onInteractionEnd?.(); }
    const fromPosition = camera.position.clone(), fromTarget = controls.target.clone();
    controls.autoRotate = false; controls.enableDamping = false;
    // The spherical path is safe around the original globe centre. During that
    // path OrbitControls must not clamp distance about its moving target.
    controls.minDistance = 0; controls.maxDistance = Infinity;
    controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; controls.update();
    camera.position.copy(fromPosition); controls.target.copy(fromTarget); controls.update();
    const fromDirection = fromPosition.clone().normalize(), toDirection = position.clone().normalize();
    const flight: ActiveFlight = { token: ++flightTokenRef.current, intent: null,
      source: returning ? "stand-return" : "stand-inspection", startedAt: null,
      durationMs: cameraFlightDurationMs(angularDistanceRadians(fromDirection, toDirection), settingsRef.current),
      trajectory: { fromDirection, toDirection, fromRadius: Math.max(GLOBE_SAFE_CAMERA_RADIUS, fromPosition.length()),
        toRadius: position.length(), fromTarget, toTarget: target.clone(), safeMinimumRadius: GLOBE_SAFE_CAMERA_RADIUS },
      inspection: { sessionId: session.request.sessionId, returning, fromZoom: camera.zoom, toZoom: zoom } };
    flightRef.current = flight;
    setPhase("programmatic");
    if (flight.durationMs === 0) finishFlight(flight); else invalidate();
  }, [camera, cancelMotion, finishFlight, invalidate, reportInspection, setPhase]);

  const beginSettling = useCallback(
    (source: "manual" | "command") => {
      const controls = controlsRef.current;
      if (!controls) return;
      settlingRef.current = {
        source,
        startedAt: performance.now(),
        stableFrames: 0,
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        target: controls.target.clone(),
      };
      controls.autoRotate = false;
      setPhase(source === "command" ? "command" : "settling");
      invalidate();
    },
    [camera, invalidate, setPhase]
  );

  const endManualInteraction = useCallback(() => {
    if (!manualInteractionRef.current) return false;
    manualInteractionRef.current = false;
    callbacksRef.current.onInteractionEnd?.();
    return true;
  }, []);

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    if (!controls || initializedRef.current) return;
    initializedRef.current = true;
    camera.up.set(0, 1, 0);
    controls.target.copy(homeOrbitTargetVector());
    controls.update();
    syncRestingControls();
  }, [camera, syncRestingControls]);

  const inspectionFocusKey = focusIntent ? globeCameraIntentKey(focusIntent) : null;
  const finishSceneCamera = useCallback((restore: boolean) => {
    const session = sceneCameraRef.current;
    if (!session) return;
    sceneCameraRef.current = null;
    if (inspectionRef.current) finishInspection(false, restore ? "returned" : "superseded");
    cancelMotion("superseded");
    if (restore) restoreCameraPose(session.original, true);
    if (manualInteractionRef.current) { manualInteractionRef.current = false; callbacksRef.current.onInteractionEnd?.(); }
    syncRestingControls(); emitViewChange("scene-return"); emitViewSettled("scene-return");
    if (settingsRef.current.active && !gl.getContext().isContextLost()) invalidate();
  }, [cancelMotion, emitViewChange, emitViewSettled, finishInspection, gl, invalidate, restoreCameraPose, syncRestingControls]);
  const finishSceneCameraRef = useRef(finishSceneCamera);
  useLayoutEffect(() => { finishSceneCameraRef.current = finishSceneCamera; }, [finishSceneCamera]);
  useLayoutEffect(() => {
    const controls = controlsRef.current, session = sceneCameraRef.current;
    if (!controls || !(camera instanceof THREE.PerspectiveCamera)) return;
    const superseded = session && inspectionFocusKey !== null && session.focusKey !== inspectionFocusKey;
    if (session && (session.key !== inspectionSession || superseded || gl.getContext().isContextLost())) {
      finishSceneCamera(!superseded);
    }
    if (inspectionSession !== seenSceneCameraKey.current) {
      if (!inspectionSession) seenSceneCameraKey.current = null;
      if (inspectionSession && active && !gl.getContext().isContextLost()) {
        seenSceneCameraKey.current = inspectionSession;
        const original = inspectionRef.current?.original ?? { position: camera.position.clone(), target: controls.target.clone(),
          quaternion: camera.quaternion.clone(), up: camera.up.clone(), zoom: camera.zoom };
        sceneCameraRef.current = { key: inspectionSession, original, focusKey: inspectionFocusKey };
        cancelMotion("superseded"); syncRestingControls();
      }
    }
  }, [active, camera, cancelMotion, finishSceneCamera, gl, inspectionFocusKey, inspectionSession, syncRestingControls]);
  useEffect(() => {
    const lost = () => finishSceneCameraRef.current(true);
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => { gl.domElement.removeEventListener("webglcontextlost", lost); finishSceneCameraRef.current(true); };
  }, [gl]);
  useLayoutEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const bridge = inspectionBridgeRef.current, request = bridge?.request;
    let session = inspectionRef.current;
    if (session && inspectionFocusKey !== null && inspectionFocusKey !== session.focusKey) {
      finishInspection(false, "superseded"); return;
    }
    if (!active || gl.getContext().isContextLost() || !(camera instanceof THREE.PerspectiveCamera)) {
      if (session) finishInspection(true, "unavailable");
      else if (request && request.sessionId > closedInspectionRef.current) {
        closedInspectionRef.current = request.sessionId;
        bridge?.onState({ sessionId: request.sessionId, phase: "closed", reason: "unavailable" });
      } else if (bridge?.phase === "returning" && bridge.sessionId !== null) {
        closedInspectionRef.current = Math.max(closedInspectionRef.current, bridge.sessionId);
        bridge.onState({ sessionId: bridge.sessionId, phase: "closed", reason: "unavailable" });
      }
      return;
    }
    if (!request) {
      if (session && session.phase !== "returning") {
        if (camera.position.distanceToSquared(session.original.position) < 1e-16
          && controls.target.distanceToSquared(session.original.target) < 1e-16 && camera.zoom === session.original.zoom) {
          finishInspection(true, "returned");
        } else startInspectionFlight(session, session.original.position, session.original.target, session.original.zoom, true);
      } else if (!session && bridge?.phase === "returning" && bridge.sessionId !== null) {
        // Start and Return can commit before the first rig effect ever owns a
        // pose. Acknowledge that no-op return instead of stranding the editor.
        closedInspectionRef.current = Math.max(closedInspectionRef.current, bridge.sessionId);
        bridge.onState({ sessionId: bridge.sessionId, phase: "closed", reason: "returned" });
      }
      return;
    }
    if (!Number.isSafeInteger(request.sessionId) || request.sessionId <= closedInspectionRef.current
      || request.sessionId !== bridge?.sessionId) return;
    if (session && session.request.sessionId !== request.sessionId) {
      if (request.sessionId < session.request.sessionId) return;
      finishInspection(true, "returned"); session = null;
    }
    if (!session) {
      session = { request, original: { position: camera.position.clone(), target: controls.target.clone(),
        quaternion: camera.quaternion.clone(), up: camera.up.clone(), zoom: camera.zoom }, focusKey: inspectionFocusKey,
        phase: "closed", framedStandId: null, bounds: null, viewportKey: "", fittedZoom: null, zoomFactor: 1 };
      inspectionRef.current = session;
      reportInspection(session, "waiting");
      controls.autoRotate = false; controls.enableZoom = false;
    }
    if (request.renderRevision < session.request.renderRevision || session.phase === "returning") return;
    session.request = request;
    if (!standInspectionBoundsMatch(request, standInspectionBounds)) {
      if (session.framedStandId !== request.standId) {
        cancelMotion("superseded"); syncRestingControls();
        reportInspection(session, "waiting");
      }
      return;
    }
    const bounds = standInspectionBounds!;
    const projection = { verticalFovDegrees: camera.fov, viewportWidth: size.width,
      viewportHeight: size.height, viewInsets: insetsRef.current };
    const viewportKey = [camera.fov, size.width, size.height, normalizedInsets.left, normalizedInsets.right,
      normalizedInsets.top, normalizedInsets.bottom].join(":");
    session.bounds = bounds;
    if (session.framedStandId !== bounds.standId) {
      const frame = globeStandInspectionFrame({ ...projection, bounds });
      if (!frame) { finishInspection(true, "unavailable"); return; }
      session.framedStandId = bounds.standId; session.viewportKey = viewportKey;
      session.fittedZoom = frame.zoom;
      const magnification = globeStandInspectionMagnification(frame.zoom, session.zoomFactor)!;
      session.zoomFactor = magnification.factor;
      startInspectionFlight(session, frame.position, frame.target, magnification.zoom, false);
    } else if (session.viewportKey !== viewportKey) {
      session.viewportKey = viewportKey;
      const flight = flightRef.current;
      if (flight?.inspection && !flight.inspection.returning) {
        const destination = sampleCameraTrajectory(flight.trajectory, 1);
        const zoom = globeStandInspectionZoom({ ...projection, bounds, position: destination.position, target: destination.target });
        if (zoom !== null) {
          session.fittedZoom = zoom;
          const magnification = globeStandInspectionMagnification(zoom, session.zoomFactor)!;
          session.zoomFactor = magnification.factor; flight.inspection.toZoom = magnification.zoom;
        }
      } else if (!flight) {
        const zoom = globeStandInspectionZoom({ ...projection, bounds, position: camera.position, target: controls.target });
        if (zoom !== null) {
          session.fittedZoom = zoom;
          const magnification = globeStandInspectionMagnification(zoom, session.zoomFactor)!;
          session.zoomFactor = magnification.factor; camera.zoom = magnification.zoom;
          camera.updateProjectionMatrix(); emitViewChange("projection"); invalidate();
        }
      }
    }
  }, [active, camera, cancelMotion, emitViewChange, finishInspection, gl, inspectionFocusKey, invalidate, normalizedInsets,
    reportInspection, size.height, size.width, standInspection?.request, standInspection?.phase, standInspection?.sessionId,
    standInspectionBounds, startInspectionFlight, syncRestingControls]);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.aspect = size.width / Math.max(1, size.height);
    applyPerspectiveViewInsets(
      camera,
      size.width,
      size.height,
      normalizedInsets
    );
    emitViewChange("projection");
    if (active) invalidate();
  }, [
    active,
    camera,
    emitViewChange,
    invalidate,
    normalizedInsets,
    size.height,
    size.width,
  ]);

  useEffect(
    () => () => {
      finishInspectionRef.current(true, "unavailable", false);
      cancelMotion("unmount");
      handledFocusKeyRef.current = null;
      handledControlKeyRef.current = null;
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
      }
    },
    [camera, cancelMotion]
  );

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (!active) {
      finishInspection(true, "unavailable");
      cancelMotion("visibility");
      controls.enabled = false;
      controls.autoRotate = false;
      // A native background transition can swallow pointerup. End the parent
      // gesture pause too, and ignore its delayed pointerup after resuming.
      endManualInteraction();
      setPhase("idle");
      return;
    }

    controls.enabled = interactionEnabled;
    controls.enableRotate = interactionEnabled;
    controls.enableZoom = interactionEnabled && !inspectionRef.current;
    if (!interactionEnabled && manualInteractionRef.current) {
      endManualInteraction();
      settlingRef.current = null;
    }
    if (reducedMotion && flightRef.current) {
      finishFlight(flightRef.current);
      return;
    }
    if (!flightRef.current && !settlingRef.current && !manualInteractionRef.current) {
      syncRestingControls();
    }
  }, [
    active,
    autoRotate,
    endManualInteraction,
    finishFlight,
    finishInspection,
    interactionEnabled,
    reducedMotion,
    setPhase,
    syncRestingControls,
  ]);

  useEffect(() => {
    if (!active || !focusIntent) return;
    const key = globeCameraIntentKey(focusIntent);
    if (handledFocusKeyRef.current === key) return;
    handledFocusKeyRef.current = key;
    startFlight(focusIntent);
  }, [active, focusIntent, startFlight]);

  useEffect(() => {
    if (!controlRequest) return;
    const key = `command:${String(controlRequest.id)}`;
    if (handledControlKeyRef.current === key) return;
    handledControlKeyRef.current = key;
    if (!active) return;

    const controls = controlsRef.current;
    if (!controls) return;
    if (flightRef.current?.inspection) {
      // A user command takes over at an actual, bounded inspection pose rather
      // than inheriting a moving target and unrestricted flight distances.
      finishFlight(flightRef.current);
    }
    cancelMotion("command");
    controls.enableDamping = true;
    controls.autoRotate = false;

    const { action } = controlRequest;
    if (action.type === "reset") {
      startFlight({ id: key, kind: "home" });
      return;
    }
    if (action.type === "rotate") {
      controls.setAzimuthalAngle(
        controls.getAzimuthalAngle() + action.azimuthDelta
      );
      controls.setPolarAngle(
        THREE.MathUtils.clamp(
          controls.getPolarAngle() + action.polarDelta,
          controls.minPolarAngle,
          controls.maxPolarAngle
        )
      );
    } else {
      const inspection = inspectionRef.current;
      if (inspection?.fittedZoom !== null && inspection?.fittedZoom !== undefined && camera instanceof THREE.PerspectiveCamera) {
        const magnification = globeStandInspectionMagnification(inspection.fittedZoom,
          inspection.zoomFactor * (action.direction === "in" ? 1.18 : 1 / 1.18))!;
        inspection.zoomFactor = magnification.factor; camera.zoom = magnification.zoom; camera.updateProjectionMatrix();
      } else if (!inspection) controls[orbitDollyMethodForZoomDirection(action.direction)](1.18);
    }
    camera.up.set(0, 1, 0);
    controls.update();
    emitViewChange("command");
    beginSettling("command");
  }, [
    active,
    beginSettling,
    camera,
    cancelMotion,
    controlRequest,
    emitViewChange,
    finishFlight,
    startFlight,
  ]);

  const handleInteractionStart = useCallback(() => {
    if (!settingsRef.current.active || !settingsRef.current.interactionEnabled) return;
    const controls = controlsRef.current;
    if (flightRef.current?.inspection) finishFlight(flightRef.current);
    cancelMotion("manual");
    manualInteractionRef.current = true;
    if (controls) {
      controls.enableDamping = true;
      controls.autoRotate = false;
    }
    setPhase("manual");
    callbacksRef.current.onInteractionStart?.();
  }, [cancelMotion, finishFlight, setPhase]);

  const handleInteractionEnd = useCallback(() => {
    if (!endManualInteraction() || !settingsRef.current.active) return;
    beginSettling("manual");
  }, [beginSettling, endManualInteraction]);

  const handleControlsChange = useCallback(() => {
    const source: GlobeCameraMotionSource = flightRef.current
      ? flightRef.current.source
      : manualInteractionRef.current || settlingRef.current?.source === "manual"
        ? "manual"
        : settlingRef.current?.source === "command"
          ? "command"
          : controlsRef.current?.autoRotate
            ? "auto"
            : "manual";
    emitViewChange(source);
  }, [emitViewChange]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls || !settingsRef.current.active) return;

    const flight = flightRef.current;
    if (flight) {
      const frameTime = performance.now();
      if (flight.startedAt === null) flight.startedAt = frameTime;
      const elapsed = frameTime - flight.startedAt;
      const progress = THREE.MathUtils.clamp(elapsed / flight.durationMs, 0, 1);
      const sample = sampleCameraTrajectory(flight.trajectory, progress);
      camera.up.set(0, 1, 0);
      camera.position.copy(sample.position);
      controls.target.copy(sample.target);
      if (flight.inspection && camera instanceof THREE.PerspectiveCamera) {
        camera.zoom = THREE.MathUtils.lerp(flight.inspection.fromZoom, flight.inspection.toZoom,
          progress * progress * (3 - 2 * progress));
        camera.updateProjectionMatrix();
      }
      controls.update();
      if (progress >= 1) finishFlight(flight);
      else invalidate();
      return;
    }

    const settling = settlingRef.current;
    if (settling) {
      const positionDelta = settling.position.distanceToSquared(camera.position);
      const targetDelta = settling.target.distanceToSquared(controls.target);
      const quaternionDelta = 1 - Math.abs(settling.quaternion.dot(camera.quaternion));
      const stable =
        positionDelta <= SETTLE_POSITION_EPSILON_SQ &&
        targetDelta <= SETTLE_POSITION_EPSILON_SQ &&
        quaternionDelta <= SETTLE_QUATERNION_EPSILON;
      settling.stableFrames = stable ? settling.stableFrames + 1 : 0;
      settling.position.copy(camera.position);
      settling.target.copy(controls.target);
      settling.quaternion.copy(camera.quaternion);

      if (
        settling.stableFrames >= SETTLE_STABLE_FRAMES ||
        performance.now() - settling.startedAt >= SETTLE_TIMEOUT_MS
      ) {
        settlingRef.current = null;
        // OrbitControls retains a tiny spherical delta while damping is on.
        // Flush that residue once before returning to demand rendering so an
        // idle globe cannot keep invalidating frames indefinitely.
        controls.enableDamping = false;
        controls.update();
        syncRestingControls();
        emitViewSettled(settling.source);
      } else {
        invalidate();
      }
      return;
    }

    if (controls.autoRotate) invalidate();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={active && interactionEnabled}
      enableRotate={interactionEnabled}
      enableDamping
      dampingFactor={DAMPING_FACTOR}
      enablePan={false}
      enableZoom={interactionEnabled && (!standInspection || standInspection.phase === "closed")}
      minDistance={GLOBE_SAFE_CAMERA_RADIUS}
      maxDistance={Math.max(GLOBE_MAX_CAMERA_RADIUS, GLOBE_MAX_FOCUS_RADIUS)}
      minPolarAngle={MIN_POLAR_ANGLE}
      maxPolarAngle={MAX_POLAR_ANGLE}
      rotateSpeed={0.48}
      zoomSpeed={0.75}
      autoRotate={false}
      autoRotateSpeed={0.24}
      screenSpacePanning={false}
      onStart={handleInteractionStart}
      onEnd={handleInteractionEnd}
      onChange={handleControlsChange}
    />
  );
}
