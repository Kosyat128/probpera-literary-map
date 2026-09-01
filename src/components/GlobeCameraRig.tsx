import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
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
  | "home";

export type GlobeCameraMotionSource =
  | GlobeProgrammaticCameraSource
  | "manual"
  | "command"
  | "auto"
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
  intent: GlobeCameraFocusIntent;
  startedAt: number | null;
  durationMs: number;
  trajectory: GlobeCameraTrajectory;
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
  source: GlobeCameraMotionSource
): GlobeCameraView {
  return {
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [controls.target.x, controls.target.y, controls.target.z],
    phase,
    source,
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
  onInteractionStart,
  onInteractionEnd,
  onPhaseChange,
  onProgrammaticStart,
  onProgrammaticCancel,
  onViewChange,
  onViewSettled,
}: GlobeCameraRigProps) {
  const { camera, invalidate, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const flightRef = useRef<ActiveFlight | null>(null);
  const settlingRef = useRef<SettlingMotion | null>(null);
  const flightTokenRef = useRef(0);
  const handledFocusKeyRef = useRef<string | null>(null);
  const handledControlKeyRef = useRef<string | null>(null);
  const manualInteractionRef = useRef(false);
  const initializedRef = useRef(false);
  const phaseRef = useRef<GlobeCameraPhase>("idle");
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

  const normalizedInsets = useMemo(
    () => normalizedViewInsets(viewInsets),
    [viewInsets?.bottom, viewInsets?.left, viewInsets?.right, viewInsets?.top]
  );
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
      !flightRef.current &&
      !settlingRef.current &&
      !manualInteractionRef.current;
    controls.enabled =
      settingsRef.current.active && settingsRef.current.interactionEnabled;
    controls.enableRotate = settingsRef.current.interactionEnabled;
    controls.enableZoom = settingsRef.current.interactionEnabled;
    controls.enableDamping = true;
    controls.autoRotate = shouldAutoRotate;
    setPhase(shouldAutoRotate ? "auto" : "idle");
    if (shouldAutoRotate) invalidate();
  }, [invalidate, setPhase]);

  const emitViewChange = useCallback(
    (source: GlobeCameraMotionSource) => {
      const controls = controlsRef.current;
      if (!controls) return;
      callbacksRef.current.onViewChange?.(
        cameraView(camera, controls, phaseRef.current, source)
      );
    },
    [camera]
  );

  const emitViewSettled = useCallback(
    (source: GlobeCameraMotionSource) => {
      const controls = controlsRef.current;
      if (!controls) return;
      callbacksRef.current.onViewSettled?.(
        cameraView(camera, controls, phaseRef.current, source)
      );
    },
    [camera]
  );

  const cancelMotion = useCallback((source: GlobeCameraCancellationSource) => {
    const activeFlight = flightRef.current;
    if (activeFlight) {
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

  const finishFlight = useCallback(
    (flight: ActiveFlight) => {
      if (flightRef.current?.token !== flight.token) return;
      const controls = controlsRef.current;
      if (!controls) return;

      const sample = sampleCameraTrajectory(flight.trajectory, 1);
      camera.up.set(0, 1, 0);
      camera.position.copy(sample.position);
      controls.target.copy(sample.target);
      if (flight.intent.kind === "home" && camera instanceof THREE.PerspectiveCamera) {
        camera.zoom = 1;
        camera.updateProjectionMatrix();
      }
      controls.update();
      flightRef.current = null;
      controls.enableDamping = true;
      emitViewChange(flight.source);
      syncRestingControls();
      emitViewSettled(flight.source);
      invalidate();
    },
    [camera, emitViewChange, emitViewSettled, invalidate, syncRestingControls]
  );

  const startFlight = useCallback(
    (intent: GlobeCameraFocusIntent) => {
      const controls = controlsRef.current;
      if (!controls || !settingsRef.current.active) return;

      cancelMotion("superseded");
      const destination = globeCameraDestination({
        intent,
        verticalFovDegrees:
          camera instanceof THREE.PerspectiveCamera ? camera.fov : 43,
        viewportWidth: size.width,
        viewportHeight: size.height,
        viewInsets: insetsRef.current,
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
    [camera, cancelMotion, finishFlight, invalidate, setPhase, size.height, size.width]
  );

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

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || initializedRef.current) return;
    initializedRef.current = true;
    camera.up.set(0, 1, 0);
    controls.target.copy(homeOrbitTargetVector());
    controls.update();
    syncRestingControls();
  }, [camera, syncRestingControls]);

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
      cancelMotion("visibility");
      manualInteractionRef.current = false;
      controls.enabled = false;
      controls.autoRotate = false;
      setPhase("idle");
      return;
    }

    controls.enabled = interactionEnabled;
    controls.enableRotate = interactionEnabled;
    controls.enableZoom = interactionEnabled;
    if (!interactionEnabled && manualInteractionRef.current) {
      manualInteractionRef.current = false;
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
    finishFlight,
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
      controls[orbitDollyMethodForZoomDirection(action.direction)](1.18);
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
    startFlight,
  ]);

  const handleInteractionStart = useCallback(() => {
    if (!settingsRef.current.interactionEnabled) return;
    const controls = controlsRef.current;
    cancelMotion("manual");
    manualInteractionRef.current = true;
    if (controls) {
      controls.enableDamping = true;
      controls.autoRotate = false;
    }
    setPhase("manual");
    callbacksRef.current.onInteractionStart?.();
  }, [cancelMotion, setPhase]);

  const handleInteractionEnd = useCallback(() => {
    manualInteractionRef.current = false;
    callbacksRef.current.onInteractionEnd?.();
    beginSettling("manual");
  }, [beginSettling]);

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
      enableZoom={interactionEnabled}
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
