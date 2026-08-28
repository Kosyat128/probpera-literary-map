import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  PMREMGenerator,
  SRGBColorSpace,
  type RectAreaLight,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

import type {
  BookShelfPresentationItem,
  BookShelfSceneAppearance,
} from "./BookShelfScene";
import type { BookShelfPhase } from "../books/bookShelfState";
import { completeShelfPhaseHasInspection } from "../books/completeShelfModel";
import {
  applyBookInspectionOrbitDelta,
  BOOK_INSPECTION_DEFAULT_ORBIT,
  resolveBookInspectionCameraFraming,
  resolveBookInspectionOrbitCamera,
  smoothBookInspectionCameraTarget,
  type BookInspectionCameraTarget,
  type BookInspectionOrbit,
} from "../books/bookInspectionCamera";
import type { BookEditorialDocument } from "../books/bookEditorialPages";
import type {
  BookInspectionPageDirection,
  BookInspectionSession,
} from "../books/bookInspectionSession";
import type { BookShelfQualitySettings } from "../books/bookShelfQualityController";
import CompleteShelfRenderer, {
  type CompleteShelfTransitionCallbacks,
} from "../books/completeShelfRenderer";

export type BookShelfSceneCanvasProps = CompleteShelfTransitionCallbacks & {
  items: readonly BookShelfPresentationItem[];
  appearance: BookShelfSceneAppearance;
  focusedBookKey: string | null;
  selectedBookKey: string | null;
  active: boolean;
  editorialDocument: BookEditorialDocument | null;
  inspectionSession: BookInspectionSession | null;
  phase: BookShelfPhase;
  requestId: number;
  onFocusBook: (key: string) => void;
  onOpenBook: (key: string) => void;
  qualitySettings: BookShelfQualitySettings;
  onRequestCoverOpen: (key: string) => void;
  onRequestInspectionClose: () => void;
  onRequestSceneCenter: () => void;
  onCrackCover: () => void;
  onStartPageDrag: (direction: BookInspectionPageDirection) => void;
  onUpdatePageDrag: (progress: number) => void;
  onRequestPageSettle: (velocity: number) => void;
  onContextLost: () => void;
  onContextRestored: () => void;
  onTextureFailure: (reason: string) => void;
};

function InspectionCameraController({
  detailOpen,
  itemIndex,
  itemCount,
  reducedMotion,
}: {
  detailOpen: boolean;
  itemIndex: number;
  itemCount: number;
  reducedMotion: boolean;
}) {
  const { camera, gl, invalidate, size } = useThree();
  const targetRef = useRef<BookInspectionCameraTarget>({
    position: [0, 0.02, 5.15],
    lookAt: [0, 0.02, 0],
    fov: 38,
  });
  const orbitRef = useRef<BookInspectionOrbit>(BOOK_INSPECTION_DEFAULT_ORBIT);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!detailOpen) {
      orbitRef.current = BOOK_INSPECTION_DEFAULT_ORBIT;
      dragRef.current = null;
    }
    invalidate();
  }, [detailOpen, invalidate, itemIndex, itemCount, size.height, size.width]);

  useEffect(() => {
    const canvas = gl.domElement;
    const startOrbit = (event: PointerEvent) => {
      if (!detailOpen || (event.button !== 1 && !event.altKey)) return;
      dragRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    const moveOrbit = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      orbitRef.current = applyBookInspectionOrbitDelta(orbitRef.current, {
        yaw: (event.clientX - drag.x) * -0.0024,
        pitch: (event.clientY - drag.y) * -0.0019,
      });
      drag.x = event.clientX;
      drag.y = event.clientY;
      invalidate();
      event.preventDefault();
    };
    const endOrbit = (event: PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      dragRef.current = null;
      canvas.releasePointerCapture?.(event.pointerId);
    };
    const zoomOrbit = (event: WheelEvent) => {
      if (!detailOpen || !event.altKey) return;
      orbitRef.current = applyBookInspectionOrbitDelta(orbitRef.current, {
        zoom: event.deltaY * -0.00065,
      });
      invalidate();
      event.preventDefault();
    };
    const resetOrbit = () => {
      if (!detailOpen) return;
      orbitRef.current = BOOK_INSPECTION_DEFAULT_ORBIT;
      invalidate();
    };
    canvas.addEventListener("pointerdown", startOrbit);
    canvas.addEventListener("pointermove", moveOrbit);
    canvas.addEventListener("pointerup", endOrbit);
    canvas.addEventListener("pointercancel", endOrbit);
    canvas.addEventListener("wheel", zoomOrbit, { passive: false });
    canvas.addEventListener("dblclick", resetOrbit);
    return () => {
      canvas.removeEventListener("pointerdown", startOrbit);
      canvas.removeEventListener("pointermove", moveOrbit);
      canvas.removeEventListener("pointerup", endOrbit);
      canvas.removeEventListener("pointercancel", endOrbit);
      canvas.removeEventListener("wheel", zoomOrbit);
      canvas.removeEventListener("dblclick", resetOrbit);
    };
  }, [detailOpen, gl, invalidate]);

  useFrame((_state, delta) => {
    const desiredFraming = detailOpen
      ? resolveBookInspectionCameraFraming({
          viewportWidth: size.width,
          viewportHeight: size.height,
          detailOpen,
          itemIndex,
          itemCount,
        })
      : {
          position: [0, 0.02, 5.15] as const,
          lookAt: [0, 0, 0] as const,
          fov: 38,
        };
    const desired = resolveBookInspectionOrbitCamera(
      desiredFraming,
      orbitRef.current
    );
    const next = smoothBookInspectionCameraTarget(
      targetRef.current,
      desired,
      delta * 1_000,
      { reducedMotion }
    );
    const changed =
      Math.abs(next.position[0] - targetRef.current.position[0]) > 0.00002 ||
      Math.abs(next.position[1] - targetRef.current.position[1]) > 0.00002 ||
      Math.abs(next.position[2] - targetRef.current.position[2]) > 0.00002 ||
      Math.abs(next.lookAt[0] - targetRef.current.lookAt[0]) > 0.00002 ||
      Math.abs(next.fov - targetRef.current.fov) > 0.00002;
    targetRef.current = next;
    camera.position.set(...next.position);
    camera.lookAt(...next.lookAt);
    if ("fov" in camera && camera.fov !== next.fov) {
      camera.fov = next.fov;
      camera.updateProjectionMatrix();
    }
    if (changed) invalidate();
  });

  return null;
}

function SceneLifecycle({
  dependency,
  exposure,
  qualitySettings,
  onContextLost,
  onContextRestored,
}: {
  dependency: string;
  exposure: number;
  qualitySettings: BookShelfQualitySettings;
  onContextLost: () => void;
  onContextRestored: () => void;
}) {
  const { gl, scene, invalidate, setFrameloop } = useThree();

  useEffect(() => {
    invalidate();
  }, [dependency, invalidate]);

  useEffect(() => {
    const previousExposure = gl.toneMappingExposure;
    const previousToneMapping = gl.toneMapping;
    const previousOutputColorSpace = gl.outputColorSpace;
    const previousShadowType = gl.shadowMap.type;
    const previousEnvironment = scene.environment;
    const previousEnvironmentIntensity = scene.environmentIntensity;
    RectAreaLightUniformsLib.init();
    const pmrem = new PMREMGenerator(gl);
    const environmentTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = exposure;
    gl.outputColorSpace = SRGBColorSpace;
    gl.shadowMap.type = PCFSoftShadowMap;
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity =
      0.38 + qualitySettings.ambientTintStrength * 0.34;
    invalidate();
    return () => {
      gl.toneMappingExposure = previousExposure;
      gl.toneMapping = previousToneMapping;
      gl.outputColorSpace = previousOutputColorSpace;
      gl.shadowMap.type = previousShadowType;
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousEnvironmentIntensity;
      environmentTarget.dispose();
      pmrem.dispose();
    };
  }, [exposure, gl, invalidate, qualitySettings.ambientTintStrength, scene]);

  useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    const handleContextRestored = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        setFrameloop("never");
      } else {
        setFrameloop("demand");
        invalidate();
      }
      onContextRestored();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    canvas.addEventListener(
      "webglcontextrestored",
      handleContextRestored,
      false
    );
    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost, false);
      canvas.removeEventListener(
        "webglcontextrestored",
        handleContextRestored,
        false
      );
    };
  }, [gl, invalidate, onContextLost, onContextRestored, setFrameloop]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setFrameloop("never");
        return;
      }
      setFrameloop("demand");
      invalidate();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleVisibilityChange();
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      setFrameloop("demand");
    };
  }, [invalidate, setFrameloop]);

  return null;
}

function RakingAreaLight({
  color,
  intensity,
  width,
  height,
  position,
  target,
}: {
  color: string;
  intensity: number;
  width: number;
  height: number;
  position: [number, number, number];
  target: [number, number, number];
}) {
  const lightRef = useRef<RectAreaLight>(null);
  const { invalidate } = useThree();

  useLayoutEffect(() => {
    lightRef.current?.lookAt(...target);
    invalidate();
  }, [invalidate, target]);

  return (
    <rectAreaLight
      ref={lightRef}
      color={color}
      intensity={intensity}
      width={width}
      height={height}
      position={position}
    />
  );
}


export default function BookShelfSceneCanvas({
  items,
  appearance,
  focusedBookKey,
  selectedBookKey,
  active,
  qualitySettings,
  editorialDocument,
  inspectionSession,
  phase,
  requestId,
  onFocusBook,
  onOpenBook,
  onRequestCoverOpen,
  onRequestInspectionClose,
  onRequestSceneCenter,
  onCrackCover,
  onStartPageDrag,
  onUpdatePageDrag,
  onRequestPageSettle,
  onMotionReached,
  onMotionSettled,
  onInspectionEntered,
  onCoverOpened,
  onPageSettled,
  onInspectionClosed,
  onShelfRestored,
  onContextLost,
  onContextRestored,
  onTextureFailure,
}: BookShelfSceneCanvasProps) {
  const dependency = [
    phase,
    requestId,
    focusedBookKey || "",
    selectedBookKey || "",
    items.length,
    appearance.shelfColor,
    appearance.ambientColor,
    appearance.lightColor,
    appearance.intensity,
  ].join(":");
  const inspectionActive = completeShelfPhaseHasInspection(phase);
  const dynamicShadows = qualitySettings.shadows !== "selected-contact";
  const shadowMapSize =
    qualitySettings.profile === "HIGH"
      ? 2048
      : qualitySettings.profile === "BALANCED"
        ? 1024
        : 512;
  const textureFailureReportedRef = useRef(false);
  const reportTextureFailure = useCallback(
    (reason: string) => {
      if (textureFailureReportedRef.current) return;
      textureFailureReportedRef.current = true;
      onTextureFailure(reason);
    },
    [onTextureFailure]
  );

  return (
    <Canvas
      aria-hidden="true"
      frameloop="demand"
      shadows={dynamicShadows}
      dpr={[qualitySettings.dpr[0], qualitySettings.dpr[1]]}
      camera={{
        position: [0, 0.02, 5.15],
        fov: 38,
        near: 0.1,
        far: 30,
      }}
      gl={{
        alpha: true,
        antialias: qualitySettings.profile !== "ECONOMY",
        preserveDrawingBuffer: false,
        powerPreference:
          qualitySettings.profile === "ECONOMY"
            ? "low-power"
            : "high-performance",
      }}
      performance={{
        min: qualitySettings.profile === "ECONOMY" ? 0.65 : 0.8,
      }}
      style={{
        pointerEvents: active ? "auto" : "none",
        touchAction: "pan-y",
      }}
      onPointerMissed={onRequestSceneCenter}
    >
      <SceneLifecycle
        dependency={dependency}
        exposure={
          qualitySettings.profile === "HIGH"
            ? 0.9
            : qualitySettings.profile === "BALANCED"
              ? 0.93
              : 0.96
        }
        qualitySettings={qualitySettings}
        onContextLost={onContextLost}
        onContextRestored={onContextRestored}
      />
      <InspectionCameraController
        detailOpen={Boolean(selectedBookKey && inspectionActive)}
        itemIndex={Math.max(
          0,
          items.findIndex(
            (item) => item.key === (selectedBookKey || focusedBookKey)
          )
        )}
        itemCount={items.length}
        reducedMotion={qualitySettings.motion.reduced}
      />
      <hemisphereLight
        args={[
          "#fff8e8",
          "#5b4030",
          0.56 + appearance.intensity * 0.12,
        ]}
      />
      <ambientLight
        intensity={
          qualitySettings.profile === "ECONOMY"
            ? 0.28
            : 0.1 + qualitySettings.ambientTintStrength * 0.04
        }
        color="#fff8ed"
      />
      <directionalLight
        position={[-4.6, 7.4, 5.8]}
        intensity={1.42 + appearance.intensity * 0.18}
        color="#ffe8c2"
        castShadow={dynamicShadows}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-1.5}
        shadow-camera-near={1}
        shadow-camera-far={18}
        shadow-bias={-0.00018}
        shadow-normalBias={0.018}
        shadow-radius={3.5}
      />
      <directionalLight
        position={[5.5, 3.6, 4.2]}
        intensity={0.3 + appearance.intensity * 0.08}
        color="#d8e3e7"
      />
      <RakingAreaLight
        color="#ffe8c2"
        intensity={2.2 + qualitySettings.ambientTintStrength * 3.2}
        width={4.8}
        height={5.6}
        position={[-3.2, 4.05, 4.6]}
        target={[0, 0, 0]}
      />
      <RakingAreaLight
        color="#d5a45e"
        intensity={1.2 + qualitySettings.ambientTintStrength * 2.25}
        width={1.6}
        height={4.8}
        position={[3.8, 2.15, -2.1]}
        target={[-0.2, 0, 0]}
      />
      <RakingAreaLight
        color="#ffe8c2"
        intensity={0.75 + qualitySettings.ambientTintStrength * 1.15}
        width={0.9}
        height={4.6}
        position={[-4.6, 1.75, 1.1]}
        target={[-0.55, 0, 0]}
      />
      <RakingAreaLight
        color="#fff7e7"
        intensity={0.8 + qualitySettings.ambientTintStrength * 1.35}
        width={1.15}
        height={3.8}
        position={[4.2, 3.35, 3.1]}
        target={[0.65, 0.1, 0]}
      />
      <CompleteShelfRenderer
        items={items}
        appearance={appearance}
        focusedBookKey={focusedBookKey}
        selectedBookKey={selectedBookKey}
        phase={phase}
        requestId={requestId}
        qualitySettings={qualitySettings}
        editorialDocument={editorialDocument}
        inspectionSession={inspectionSession}
        onFocusBook={onFocusBook}
        onOpenBook={onOpenBook}
        onRequestCoverOpen={onRequestCoverOpen}
        onRequestInspectionClose={onRequestInspectionClose}
        onCrackCover={onCrackCover}
        onStartPageDrag={onStartPageDrag}
        onUpdatePageDrag={onUpdatePageDrag}
        onRequestPageSettle={onRequestPageSettle}
        onTextureFailure={reportTextureFailure}
        onMotionReached={onMotionReached}
        onMotionSettled={onMotionSettled}
        onInspectionEntered={onInspectionEntered}
        onCoverOpened={onCoverOpened}
        onPageSettled={onPageSettled}
        onInspectionClosed={onInspectionClosed}
        onShelfRestored={onShelfRestored}
      />
    </Canvas>
  );
}
