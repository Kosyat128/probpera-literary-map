import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
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
import CompleteShelfRenderer, {
  type CompleteShelfTransitionCallbacks,
} from "../books/completeShelfRenderer";

export type BookShelfSceneCanvasProps = CompleteShelfTransitionCallbacks & {
  items: readonly BookShelfPresentationItem[];
  appearance: BookShelfSceneAppearance;
  focusedBookKey: string | null;
  selectedBookKey: string | null;
  active: boolean;
  economical: boolean;
  reducedMotion: boolean;
  phase: BookShelfPhase;
  requestId: number;
  onFocusBook: (key: string) => void;
  onOpenBook: (key: string) => void;
  onRequestCoverOpen: (key: string) => void;
  onRequestInspectionClose: () => void;
  onCrackCover: () => void;
  onStartPageDrag: () => void;
  onRequestPageSettle: () => void;
  onContextLost: () => void;
};

function SceneLifecycle({
  dependency,
  exposure,
  economical,
  onContextLost,
}: {
  dependency: string;
  exposure: number;
  economical: boolean;
  onContextLost: () => void;
}) {
  const { gl, scene, invalidate } = useThree();

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
    scene.environmentIntensity = economical ? 0.48 : 0.72;
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
  }, [economical, exposure, gl, invalidate, scene]);

  useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    return () =>
      canvas.removeEventListener("webglcontextlost", handleContextLost, false);
  }, [gl, onContextLost]);

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
  economical,
  reducedMotion,
  phase,
  requestId,
  onFocusBook,
  onOpenBook,
  onRequestCoverOpen,
  onRequestInspectionClose,
  onCrackCover,
  onStartPageDrag,
  onRequestPageSettle,
  onMotionReached,
  onMotionSettled,
  onInspectionEntered,
  onCoverOpened,
  onPageSettled,
  onInspectionClosed,
  onShelfRestored,
  onContextLost,
}: BookShelfSceneCanvasProps) {
  const dependency = [
    phase,
    requestId,
    focusedBookKey || "",
    selectedBookKey || "",
    items.length,
    appearance.shelfColor,
    appearance.intensity,
  ].join(":");

  return (
    <Canvas
      aria-hidden="true"
      frameloop="demand"
      shadows={!economical}
      dpr={economical ? 1 : [1, 2]}
      camera={{
        position: [0, 0.02, 5.15],
        fov: 38,
        near: 0.1,
        far: 30,
      }}
      gl={{
        alpha: true,
        antialias: !economical,
        powerPreference: economical ? "low-power" : "high-performance",
      }}
      performance={{ min: economical ? 0.65 : 0.8 }}
      style={{ pointerEvents: active ? "auto" : "none" }}
      onPointerMissed={() => {
        if (
          completeShelfPhaseHasInspection(phase) &&
          phase !== "INSPECTION_CLOSING"
        ) {
          onRequestInspectionClose();
        }
      }}
    >
      <SceneLifecycle
        dependency={dependency}
        exposure={economical ? 0.96 : 0.9}
        economical={economical}
        onContextLost={onContextLost}
      />
      <hemisphereLight
        args={[
          "#fff8e8",
          "#5b4030",
          0.56 + appearance.intensity * 0.12,
        ]}
      />
      <ambientLight
        intensity={economical ? 0.28 : 0.12}
        color="#fff8ed"
      />
      <directionalLight
        position={[-4.6, 7.4, 5.8]}
        intensity={1.42 + appearance.intensity * 0.18}
        color="#ffe8c2"
        castShadow={!economical}
        shadow-mapSize-width={economical ? 512 : 2048}
        shadow-mapSize-height={economical ? 512 : 2048}
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
        intensity={economical ? 2.2 : 5.4}
        width={4.8}
        height={5.6}
        position={[-3.2, 4.05, 4.6]}
        target={[0, 0, 0]}
      />
      <RakingAreaLight
        color="#d5a45e"
        intensity={economical ? 1.2 : 3.45}
        width={1.6}
        height={4.8}
        position={[3.8, 2.15, -2.1]}
        target={[-0.2, 0, 0]}
      />
      <RakingAreaLight
        color="#ffe8c2"
        intensity={economical ? 0.75 : 1.9}
        width={0.9}
        height={4.6}
        position={[-4.6, 1.75, 1.1]}
        target={[-0.55, 0, 0]}
      />
      <RakingAreaLight
        color="#fff7e7"
        intensity={economical ? 0.8 : 2.15}
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
        economical={economical}
        reducedMotion={reducedMotion}
        onFocusBook={onFocusBook}
        onOpenBook={onOpenBook}
        onRequestCoverOpen={onRequestCoverOpen}
        onRequestInspectionClose={onRequestInspectionClose}
        onCrackCover={onCrackCover}
        onStartPageDrag={onStartPageDrag}
        onRequestPageSettle={onRequestPageSettle}
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
