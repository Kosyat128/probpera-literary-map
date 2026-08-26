import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  DoubleSide,
  MathUtils,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  Vector2,
  type CanvasTexture,
  type Group,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import type {
  BookShelfPresentationItem,
  BookShelfSceneAppearance,
} from "../components/BookShelfScene";
import type { BookShelfPhase } from "./bookShelfState";
import {
  buildCompleteShelfBookPose,
  buildCompleteShelfBookSpec,
  completeShelfPhaseAllowsSelectionSwitch,
  completeShelfPhaseHasInspection,
  completeShelfSettlementForPhase,
  completeShelfWorkingSetLimit,
  layoutCompleteShelfBooks,
  resolveCompleteShelfViewportFraming,
  selectCompleteShelfWorkingSet,
  type CompleteShelfBookPose,
  type CompleteShelfLayoutEntry,
  type CompleteShelfSettlement,
} from "./completeShelfModel";
import {
  createCompleteShelfArtworkTextures,
  createCompleteShelfClothMap,
  createCompleteShelfClothSurfaceMaps,
  createCompleteShelfContactShadowTexture,
  createCompleteShelfLeatherMap,
  createCompleteShelfLeatherSurfaceMaps,
  createCompleteShelfPageEdgeTextures,
  createCompleteShelfWoodDetailMap,
  createCompleteShelfWoodMap,
  disposeCompleteShelfTextures,
} from "./completeShelfTextures";

const HIGH_CLOTH_NORMAL_SCALE = new Vector2(0.42, 0.42);
const ECONOMICAL_CLOTH_NORMAL_SCALE = new Vector2(0.24, 0.24);
const EMPTY_PAGE_EDGE_TEXTURES = Object.freeze({
  fore: null,
  headTail: null,
});

type PresentationItemWithYear = BookShelfPresentationItem &
  Readonly<{ year?: number | null }>;

export type CompleteShelfTransitionCallbacks = Readonly<{
  onMotionReached: (requestId: number) => void;
  onMotionSettled: (requestId: number) => void;
  onInspectionEntered: (requestId: number) => void;
  onCoverOpened: (requestId: number) => void;
  onPageSettled: (requestId: number) => void;
  onInspectionClosed: (requestId: number) => void;
  onShelfRestored: (requestId: number) => void;
}>;

export type CompleteShelfRendererProps = CompleteShelfTransitionCallbacks &
  Readonly<{
    items: readonly BookShelfPresentationItem[];
    appearance: BookShelfSceneAppearance;
    focusedBookKey: string | null;
    selectedBookKey: string | null;
    phase: BookShelfPhase;
    requestId: number;
    economical: boolean;
    reducedMotion: boolean;
    onFocusBook: (key: string) => void;
    onOpenBook: (key: string) => void;
    onRequestCoverOpen: (key: string) => void;
    onRequestInspectionClose: () => void;
    onCrackCover: () => void;
    onStartPageDrag: () => void;
    onRequestPageSettle: () => void;
  }>;

function dispatchSettlement(
  settlement: CompleteShelfSettlement,
  requestId: number,
  callbacks: CompleteShelfTransitionCallbacks
) {
  switch (settlement) {
    case "motion-reached":
      callbacks.onMotionReached(requestId);
      break;
    case "motion-settled":
      callbacks.onMotionSettled(requestId);
      break;
    case "inspection-entered":
      callbacks.onInspectionEntered(requestId);
      break;
    case "cover-opened":
      callbacks.onCoverOpened(requestId);
      break;
    case "page-settled":
      callbacks.onPageSettled(requestId);
      break;
    case "inspection-closed":
      callbacks.onInspectionClosed(requestId);
      break;
    case "shelf-restored":
      callbacks.onShelfRestored(requestId);
      break;
  }
}

function applyPoseImmediately(
  group: Group,
  cover: Group,
  firstLeaf: Group,
  secondLeaf: Group,
  pose: CompleteShelfBookPose
) {
  group.position.set(...pose.position);
  group.rotation.set(...pose.rotation);
  group.scale.setScalar(pose.scale);
  cover.rotation.y = pose.coverAngle;
  firstLeaf.rotation.y = pose.firstLeafAngle;
  secondLeaf.rotation.y = pose.secondLeafAngle;
}

function animatePose(
  group: Group,
  cover: Group,
  firstLeaf: Group,
  secondLeaf: Group,
  pose: CompleteShelfBookPose,
  delta: number,
  reducedMotion: boolean
) {
  if (reducedMotion) {
    applyPoseImmediately(group, cover, firstLeaf, secondLeaf, pose);
    return false;
  }
  const frameDelta = Math.min(delta, 0.08);
  const positionRate = 9.5;
  const rotationRate = 11;
  const before = [
    group.position.x,
    group.position.y,
    group.position.z,
    group.rotation.x,
    group.rotation.y,
    group.rotation.z,
    group.scale.x,
    cover.rotation.y,
    firstLeaf.rotation.y,
    secondLeaf.rotation.y,
  ];
  group.position.x = MathUtils.damp(
    group.position.x,
    pose.position[0],
    positionRate,
    frameDelta
  );
  group.position.y = MathUtils.damp(
    group.position.y,
    pose.position[1],
    positionRate,
    frameDelta
  );
  group.position.z = MathUtils.damp(
    group.position.z,
    pose.position[2],
    positionRate,
    frameDelta
  );
  group.rotation.x = MathUtils.damp(
    group.rotation.x,
    pose.rotation[0],
    rotationRate,
    frameDelta
  );
  group.rotation.y = MathUtils.damp(
    group.rotation.y,
    pose.rotation[1],
    rotationRate,
    frameDelta
  );
  group.rotation.z = MathUtils.damp(
    group.rotation.z,
    pose.rotation[2],
    rotationRate,
    frameDelta
  );
  const scale = MathUtils.damp(
    group.scale.x,
    pose.scale,
    positionRate,
    frameDelta
  );
  group.scale.setScalar(scale);
  cover.rotation.y = MathUtils.damp(
    cover.rotation.y,
    pose.coverAngle,
    rotationRate,
    frameDelta
  );
  firstLeaf.rotation.y = MathUtils.damp(
    firstLeaf.rotation.y,
    pose.firstLeafAngle,
    rotationRate,
    frameDelta
  );
  secondLeaf.rotation.y = MathUtils.damp(
    secondLeaf.rotation.y,
    pose.secondLeafAngle,
    rotationRate,
    frameDelta
  );
  const after = [
    group.position.x,
    group.position.y,
    group.position.z,
    group.rotation.x,
    group.rotation.y,
    group.rotation.z,
    group.scale.x,
    cover.rotation.y,
    firstLeaf.rotation.y,
    secondLeaf.rotation.y,
  ];
  return after.some(
    (value, index) => Math.abs(value - before[index]) > 0.00008
  );
}

function createCompleteShelfPageBlockGeometry(
  width: number,
  height: number,
  depth: number,
  economical: boolean
) {
  const geometry = new RoundedBoxGeometry(
    width,
    height,
    depth,
    economical ? 2 : 4,
    economical ? 0.0018 : 0.0025
  );
  const position = geometry.getAttribute("position");
  const halfWidth = width * 0.5;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const normalizedX = Math.min(1, Math.max(0, (x + halfWidth) / width));
    const gutterProgress = Math.min(1, normalizedX / 0.16);
    const gutterEase =
      gutterProgress * gutterProgress * (3 - 2 * gutterProgress);
    const gutterCompression = (1 - gutterEase) * 0.012;
    const foreEdgeCharacter =
      Math.pow(normalizedX, 8) * Math.sin(position.getY(index) * 31) * 0.00055;
    position.setZ(
      index,
      Math.sign(z || 1) *
        Math.max(0, Math.abs(z) - gutterCompression + foreEdgeCharacter)
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createCompleteShelfRoundedPlaneGeometry(
  width: number,
  height: number,
  radius: number
) {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const corner = Math.min(radius, halfWidth, halfHeight);
  const shape = new Shape();
  shape.moveTo(-halfWidth + corner, -halfHeight);
  shape.lineTo(halfWidth - corner, -halfHeight);
  shape.quadraticCurveTo(
    halfWidth,
    -halfHeight,
    halfWidth,
    -halfHeight + corner
  );
  shape.lineTo(halfWidth, halfHeight - corner);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - corner, halfHeight);
  shape.lineTo(-halfWidth + corner, halfHeight);
  shape.quadraticCurveTo(
    -halfWidth,
    halfHeight,
    -halfWidth,
    halfHeight - corner
  );
  shape.lineTo(-halfWidth, -halfHeight + corner);
  shape.quadraticCurveTo(
    -halfWidth,
    -halfHeight,
    -halfWidth + corner,
    -halfHeight
  );
  const geometry = new ShapeGeometry(shape, 8);
  const position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    uv[index * 2] = (position.getX(index) + halfWidth) / width;
    uv[index * 2 + 1] = (position.getY(index) + halfHeight) / height;
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function createCompleteShelfBowedSpineGeometry(
  thickness: number,
  height: number,
  depth: number,
  bow: number,
  economical: boolean
) {
  const geometry = new BoxGeometry(
    thickness,
    height,
    depth,
    1,
    economical ? 1 : 2,
    economical ? 6 : 12
  );
  const position = geometry.getAttribute("position");
  const halfThickness = thickness * 0.5;
  const halfDepth = depth * 0.5;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const normalizedZ = Math.min(1, Math.abs(position.getZ(index)) / halfDepth);
    const shoulder = Math.max(0, 1 - normalizedZ * normalizedZ);
    if (x <= -halfThickness + 0.0001) {
      position.setX(index, x - bow * shoulder);
    } else if (x >= halfThickness - 0.0001) {
      position.setX(index, x + bow * shoulder * 0.16);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createCompleteShelfBowedSpineFoilGeometry(
  width: number,
  height: number,
  bow: number,
  economical: boolean
) {
  const geometry = new PlaneGeometry(
    width,
    height,
    economical ? 6 : 12,
    economical ? 1 : 2
  );
  const position = geometry.getAttribute("position");
  const halfWidth = width * 0.5;
  for (let index = 0; index < position.count; index += 1) {
    const normalizedX = Math.min(1, Math.abs(position.getX(index)) / halfWidth);
    position.setZ(index, bow * Math.max(0, 1 - normalizedX * normalizedX));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function BindingMaterial({
  binding,
  color,
  bindingMap,
  bindingNormalMap,
  bindingRoughnessMap,
  economical,
}: {
  binding: "leather" | "cloth";
  color: string;
  bindingMap: CanvasTexture | null;
  bindingNormalMap: CanvasTexture | null;
  bindingRoughnessMap: CanvasTexture | null;
  economical: boolean;
}) {
  const leather = binding === "leather";
  if (economical) {
    return (
      <meshStandardMaterial
        color={color}
        roughness={leather ? 0.82 : 0.91}
        metalness={0}
        roughnessMap={bindingRoughnessMap || undefined}
        normalMap={bindingNormalMap || undefined}
        normalScale={ECONOMICAL_CLOTH_NORMAL_SCALE}
        bumpMap={bindingMap || undefined}
        bumpScale={leather ? 0.0052 : 0.004}
      />
    );
  }
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={leather ? 0.72 : 0.86}
      metalness={0.005}
      roughnessMap={bindingRoughnessMap || undefined}
      normalMap={bindingNormalMap || undefined}
      normalScale={HIGH_CLOTH_NORMAL_SCALE}
      bumpMap={bindingMap || undefined}
      bumpScale={leather ? 0.007 : 0.0055}
      clearcoat={leather ? 0.055 : 0.01}
      clearcoatRoughness={leather ? 0.72 : 0.92}
      sheen={leather ? 0.06 : 0.14}
      sheenColor={color}
      sheenRoughness={leather ? 0.8 : 0.74}
    />
  );
}

function SpineMaterial({
  map,
  binding,
  surfaceColor,
  bindingMap,
  bindingNormalMap,
  bindingRoughnessMap,
  economical,
}: {
  map: CanvasTexture | null;
  binding: "leather" | "cloth";
  surfaceColor: string;
  bindingMap: CanvasTexture | null;
  bindingNormalMap: CanvasTexture | null;
  bindingRoughnessMap: CanvasTexture | null;
  economical: boolean;
}) {
  const leather = binding === "leather";
  return (
    <meshPhysicalMaterial
      color="#ffffff"
      map={map || undefined}
      normalMap={bindingNormalMap || undefined}
      normalScale={
        economical ? ECONOMICAL_CLOTH_NORMAL_SCALE : HIGH_CLOTH_NORMAL_SCALE
      }
      roughnessMap={bindingRoughnessMap || undefined}
      bumpMap={bindingMap || undefined}
      bumpScale={
        economical ? (leather ? 0.0045 : 0.003) : leather ? 0.007 : 0.005
      }
      roughness={
        economical ? (leather ? 0.82 : 0.91) : leather ? 0.72 : 0.85
      }
      metalness={economical ? 0 : 0.005}
      clearcoat={leather && !economical ? 0.055 : 0}
      clearcoatRoughness={0.72}
      sheen={economical ? 0.04 : leather ? 0.06 : 0.14}
      sheenColor={surfaceColor}
      sheenRoughness={leather ? 0.8 : 0.74}
      side={DoubleSide}
    />
  );
}

function FoilMaterial({
  map,
  embossMap,
  color,
  front = false,
  precolored = false,
}: {
  map: CanvasTexture | null;
  embossMap: CanvasTexture | null;
  color: string;
  front?: boolean;
  precolored?: boolean;
}) {
  return (
    <meshPhysicalMaterial
      map={map || undefined}
      alphaMap={precolored ? undefined : map || undefined}
      color={precolored ? "#ffffff" : color}
      transparent
      alphaTest={0.015}
      depthWrite={false}
      bumpMap={embossMap || undefined}
      bumpScale={front ? 0.016 : 0.017}
      metalness={front ? 0.94 : 0.92}
      roughness={front ? 0.18 : 0.16}
      clearcoat={front ? 0.18 : 0.16}
      clearcoatRoughness={front ? 0.12 : 0.13}
      polygonOffset
      polygonOffsetFactor={-2}
      polygonOffsetUnits={-2}
    />
  );
}

function CompleteShelfBook({
  layout,
  anchorSlot,
  phase,
  requestId,
  focusedBookKey,
  selectedBookKey,
  reporterKey,
  economical,
  reducedMotion,
  bindingMap,
  bindingNormalMap,
  bindingRoughnessMap,
  foreEdgeMap,
  headTailEdgeMap,
  contactShadowMap,
  onOpenBook,
  onRequestCoverOpen,
  onStartPageDrag,
  onRequestPageSettle,
  callbacks,
}: {
  layout: CompleteShelfLayoutEntry;
  anchorSlot: number;
  phase: BookShelfPhase;
  requestId: number;
  focusedBookKey: string | null;
  selectedBookKey: string | null;
  reporterKey: string | null;
  economical: boolean;
  reducedMotion: boolean;
  bindingMap: CanvasTexture | null;
  bindingNormalMap: CanvasTexture | null;
  bindingRoughnessMap: CanvasTexture | null;
  foreEdgeMap: CanvasTexture | null;
  headTailEdgeMap: CanvasTexture | null;
  contactShadowMap: CanvasTexture | null;
  onOpenBook: (key: string) => void;
  onRequestCoverOpen: (key: string) => void;
  onStartPageDrag: () => void;
  onRequestPageSettle: () => void;
  callbacks: CompleteShelfTransitionCallbacks;
}) {
  const groupRef = useRef<Group>(null);
  const coverRef = useRef<Group>(null);
  const firstLeafRef = useRef<Group>(null);
  const secondLeafRef = useRef<Group>(null);
  const settledSignatureRef = useRef("");
  const pageGestureStartedRef = useRef(false);
  const pageSettleFrameRef = useRef<number | null>(null);
  const pageSettleCallbackRef = useRef(onRequestPageSettle);
  const { invalidate } = useThree();
  const { spec } = layout;
  const { height, coverWidth, pageDepth, boardThickness } = spec.dimensions;
  const selected = spec.key === selectedBookKey;
  const renderFullRig = selected && completeShelfPhaseHasInspection(phase);
  const spineBoardThickness = economical ? 0.012 : 0.014;
  const spineBow = economical ? 0.014 : 0.02;
  const spineWidth = 0.082;
  const pageWidth = coverWidth - 0.074;
  const pageHeight = height - 0.068;
  const pageThickness = Math.max(0.12, pageDepth - 0.026);
  const foreEdgeX = 0.018 + pageWidth * 0.5 + 0.002;
  const headbandY = pageHeight * 0.5 - 0.004;
  const visiblePageWidth = pageWidth - spineWidth * 0.42;
  const signatureOffsets = Array.from(
    { length: economical ? 3 : 6 },
    (_, index) => -0.5 + (index + 1) / (economical ? 4 : 7)
  );
  const coverGeometry = useMemo(
    () =>
      renderFullRig
        ? new RoundedBoxGeometry(
            coverWidth,
            height,
            boardThickness,
            economical ? 1 : 2,
            economical ? 0.0032 : 0.0045
          )
        : null,
    [boardThickness, coverWidth, economical, height, renderFullRig]
  );
  const pageBlockGeometry = useMemo(
    () =>
      renderFullRig
        ? createCompleteShelfPageBlockGeometry(
            pageWidth,
            pageHeight,
            pageThickness,
            economical
          )
        : null,
    [economical, pageHeight, pageThickness, pageWidth, renderFullRig]
  );
  const spineGeometry = useMemo(
    () =>
      createCompleteShelfBowedSpineGeometry(
        spineBoardThickness,
        height - 0.012,
        pageDepth + boardThickness * 1.88,
        spineBow,
        economical
      ),
    [
      boardThickness,
      economical,
      height,
      pageDepth,
      spineBoardThickness,
      spineBow,
    ]
  );
  const spineFoilGeometry = useMemo(
    () =>
      createCompleteShelfBowedSpineFoilGeometry(
        pageDepth + boardThickness * 1.82,
        height - 0.018,
        spineBow,
        economical
      ),
    [boardThickness, economical, height, pageDepth, spineBow]
  );
  const spineBandGeometry = useMemo(
    () =>
      new RoundedBoxGeometry(
        economical ? 0.009 : 0.012,
        economical ? 0.018 : 0.022,
        (pageDepth + boardThickness * 1.82) * 0.92,
        1,
        economical ? 0.002 : 0.0035
      ),
    [boardThickness, economical, pageDepth]
  );
  const spineLiningGeometry = useMemo(
    () =>
      new RoundedBoxGeometry(
        spineWidth * 0.68,
        height - 0.056,
        Math.max(0.045, pageThickness - 0.008),
        1,
        0.0015
      ),
    [height, pageThickness]
  );
  const coverSurfaceGeometry = useMemo(
    () =>
      renderFullRig
        ? createCompleteShelfRoundedPlaneGeometry(
            coverWidth - 0.007,
            height - 0.007,
            0.0035
          )
        : null,
    [coverWidth, height, renderFullRig]
  );
  const endpaperGeometry = useMemo(
    () =>
      renderFullRig
        ? createCompleteShelfRoundedPlaneGeometry(
            coverWidth - 0.045,
            height - 0.045,
            0.003
          )
        : null,
    [coverWidth, height, renderFullRig]
  );
  useEffect(
    () => () => {
      coverGeometry?.dispose();
      pageBlockGeometry?.dispose();
      spineGeometry.dispose();
      spineFoilGeometry.dispose();
      spineBandGeometry.dispose();
      spineLiningGeometry.dispose();
      coverSurfaceGeometry?.dispose();
      endpaperGeometry?.dispose();
    }, [
      coverGeometry,
      coverSurfaceGeometry,
      endpaperGeometry,
      pageBlockGeometry,
      spineBandGeometry,
      spineFoilGeometry,
      spineGeometry,
      spineLiningGeometry,
    ]
  );

  useLayoutEffect(() => {
    pageSettleCallbackRef.current = onRequestPageSettle;
  }, [onRequestPageSettle]);
  useEffect(
    () => () => {
      if (pageSettleFrameRef.current !== null) {
        cancelAnimationFrame(pageSettleFrameRef.current);
      }
    },
    []
  );
  const pose = useMemo(
    () =>
      buildCompleteShelfBookPose({
        layout,
        anchorSlot,
        phase,
        selectedBookKey,
        focusedBookKey,
      }),
    [anchorSlot, focusedBookKey, layout, phase, selectedBookKey]
  );
  const artworkSignature = [
    economical ? "economical" : "quality",
    spec.key,
    spec.title,
    spec.writer,
    spec.year || "",
    spec.baseColor,
    spec.accentColor,
    spec.paperColor,
    spec.foilColor,
    spec.coverUrl || "",
    spec.motif,
  ].join(":");
  const artwork = useMemo(
    () => createCompleteShelfArtworkTextures(spec, economical, renderFullRig),
    [artworkSignature, renderFullRig]
  );
  useEffect(
    () => () =>
      disposeCompleteShelfTextures([
        artwork.frontFoil,
        artwork.frontFoilEmboss,
        artwork.spineFoil,
        artwork.spineFoilEmboss,
        artwork.spineSurface,
      ]),
    [artwork]
  );

  const targetSignature = [
    phase,
    requestId,
    spec.key,
    ...pose.position,
    ...pose.rotation,
    pose.scale,
    pose.coverAngle,
    pose.firstLeafAngle,
    pose.secondLeafAngle,
  ].join(":");

  useLayoutEffect(() => {
    const group = groupRef.current;
    const cover = coverRef.current;
    const firstLeaf = firstLeafRef.current;
    const secondLeaf = secondLeafRef.current;
    if (!group || !cover || !firstLeaf || !secondLeaf) return;
    if (!group.userData.completeShelfReady) {
      applyPoseImmediately(group, cover, firstLeaf, secondLeaf, pose);
      group.userData.completeShelfReady = true;
    }
    settledSignatureRef.current = "";
    invalidate();
  }, [invalidate, pose, targetSignature]);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    const cover = coverRef.current;
    const firstLeaf = firstLeafRef.current;
    const secondLeaf = secondLeafRef.current;
    if (!group || !cover || !firstLeaf || !secondLeaf) return;
    const moving = animatePose(
      group,
      cover,
      firstLeaf,
      secondLeaf,
      pose,
      delta,
      reducedMotion
    );
    if (moving) {
      settledSignatureRef.current = "";
      invalidate();
      return;
    }
    applyPoseImmediately(group, cover, firstLeaf, secondLeaf, pose);
    const settlement = completeShelfSettlementForPhase(phase);
    if (
      reporterKey === spec.key &&
      settlement &&
      settledSignatureRef.current !== targetSignature
    ) {
      settledSignatureRef.current = targetSignature;
      dispatchSettlement(settlement, requestId, callbacks);
    }
  });

  return (
    <group
      ref={groupRef}
      onClick={(event) => {
        event.stopPropagation();
        if (
          !selected &&
          (phase === "SHELF_IDLE" ||
            completeShelfPhaseAllowsSelectionSwitch(phase))
        ) {
          onOpenBook(spec.key);
          return;
        }
        if (
          selected &&
          (phase === "INSPECTION_CLOSED" || phase === "COVER_CRACKED")
        ) {
          onRequestCoverOpen(spec.key);
        }
      }}
    >
      <mesh
        position={[0, -height * 0.5 - 0.022, 0.025]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[
          renderFullRig ? coverWidth * 1.22 : 0.12,
          renderFullRig ? pageDepth * 2.05 : pageDepth * 1.24,
          1,
        ]}
        renderOrder={-1}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#120b08"
          alphaMap={contactShadowMap || undefined}
          transparent
          opacity={0.24}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      {renderFullRig && (
        <>
          <mesh
            geometry={coverGeometry || undefined}
            position={[0, 0, -pageDepth / 2 - boardThickness / 2]}
            castShadow={!economical}
            receiveShadow
          >
            <BindingMaterial
              binding={spec.binding}
              color={spec.baseColor}
              bindingMap={bindingMap}
              bindingNormalMap={bindingNormalMap}
              bindingRoughnessMap={bindingRoughnessMap}
              economical={economical}
            />
          </mesh>
          <mesh
            geometry={endpaperGeometry || undefined}
            position={[0, 0, -pageDepth / 2 + boardThickness * 0.015]}
          >
            <meshPhysicalMaterial
              color={spec.paperColor}
              roughness={0.94}
              metalness={0}
              sheen={0.025}
              sheenRoughness={1}
            />
          </mesh>
          <mesh
            position={[
              -coverWidth / 2 + 0.038,
              0,
              -pageDepth / 2 - boardThickness * 1.035,
            ]}
            rotation={[0, Math.PI, 0]}
            scale={[0.012, height * 0.94, 1]}
          >
            <planeGeometry args={[1, 1]} />
            <meshPhysicalMaterial
              color="#17100d"
              roughness={0.9}
              metalness={0}
              bumpMap={bindingMap || undefined}
              bumpScale={0.006}
              transparent
              opacity={0.48}
              side={DoubleSide}
            />
          </mesh>
        </>
      )}

      <mesh
        geometry={spineGeometry}
        position={[
          -coverWidth / 2 - spineBoardThickness * 0.35,
          0,
          0,
        ]}
        castShadow={!economical}
      >
        <SpineMaterial
          map={artwork.spineSurface}
          binding={spec.binding}
          surfaceColor={spec.baseColor}
          bindingMap={bindingMap}
          bindingNormalMap={bindingNormalMap}
          bindingRoughnessMap={bindingRoughnessMap}
          economical={economical}
        />
      </mesh>
      <mesh
        geometry={spineFoilGeometry}
        position={[
          -coverWidth / 2 - spineBoardThickness * 0.855,
          0,
          0,
        ]}
        rotation={[0, -Math.PI / 2, 0]}
        visible={Boolean(artwork.spineFoil)}
        renderOrder={4}
      >
        <FoilMaterial
          map={artwork.spineFoil}
          embossMap={artwork.spineFoilEmboss}
          color={spec.foilColor}
          precolored
        />
      </mesh>
      {[-0.41, 0.41].map((offset) => (
        <mesh
          key={offset}
          geometry={spineBandGeometry}
          position={[
            -coverWidth / 2 -
              spineBoardThickness * 0.855 -
              spineBow +
              (economical ? 0.003 : 0.004),
            height * offset,
            0,
          ]}
          castShadow={!economical}
          receiveShadow
          renderOrder={3}
        >
            <BindingMaterial
              binding={spec.binding}
              color="#2a1c21"
            bindingMap={bindingMap}
            bindingNormalMap={bindingNormalMap}
            bindingRoughnessMap={bindingRoughnessMap}
            economical={economical}
          />
        </mesh>
      ))}
      <mesh
        geometry={spineLiningGeometry}
        position={[-coverWidth / 2 + spineWidth * 0.38, 0, 0]}
        castShadow={!economical}
        receiveShadow
      >
        <meshPhysicalMaterial
          color={spec.paperColor}
          roughness={0.94}
          metalness={0}
          sheen={0.025}
          sheenRoughness={1}
        />
      </mesh>

      {renderFullRig && (
        <>
      <mesh
        geometry={pageBlockGeometry || undefined}
        position={[0.018, 0, 0]}
        castShadow={!economical}
        receiveShadow
      >
        <meshPhysicalMaterial
          color={spec.paperColor}
          roughness={0.95}
          metalness={0}
          sheen={0.018}
          sheenRoughness={1}
        />
      </mesh>
      <mesh
        position={[foreEdgeX, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[pageThickness * 0.94, pageHeight - 0.028, 1]}
      >
        <planeGeometry args={[1, 1]} />
        <meshPhysicalMaterial
          color="#fff3e5"
          map={foreEdgeMap || undefined}
          bumpMap={foreEdgeMap || undefined}
          bumpScale={0.0022}
          roughness={0.93}
          metalness={0}
          side={DoubleSide}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0.018, side * (pageHeight * 0.5 + 0.002), 0]}
          rotation={[side > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]}
          scale={[pageWidth - 0.035, pageThickness * 0.94, 1]}
        >
          <planeGeometry args={[1, 1]} />
          <meshPhysicalMaterial
            color="#fff3e5"
            map={headTailEdgeMap || undefined}
            bumpMap={headTailEdgeMap || undefined}
            bumpScale={0.0015}
            roughness={0.94}
            metalness={0}
            side={DoubleSide}
          />
        </mesh>
      ))}
      {signatureOffsets.map((offset) => (
        <mesh
          key={offset}
          position={[foreEdgeX + 0.001, offset * pageHeight, 0]}
          scale={[0.0035, 0.00135, pageThickness * 0.91]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshPhysicalMaterial
            color="#9b8d77"
            roughness={0.98}
            metalness={0}
          />
        </mesh>
      ))}

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[
            -pageWidth * 0.5 + 0.046,
            side * headbandY,
            0,
          ]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry
            args={[0.018, 0.018, pageThickness * 0.93, 10]}
          />
          <meshStandardMaterial
            color={side > 0 ? spec.foilColor : spec.accentColor}
            roughness={0.62}
          />
        </mesh>
      ))}

      <mesh
        position={[
          -pageWidth * 0.5 + 0.09 + (spec.seed % 3) * 0.018,
          -pageHeight * 0.17,
          pageThickness * 0.5 + 0.003,
        ]}
        rotation={[0, 0, (spec.seed % 2 ? -1 : 1) * 0.014]}
        scale={[0.034, pageHeight * 0.76, 1]}
      >
        <planeGeometry args={[1, 1]} />
        <meshPhysicalMaterial
          color={spec.accentColor}
          roughness={0.62}
          metalness={0.08}
          sheen={0.36}
          sheenRoughness={0.68}
          side={DoubleSide}
        />
      </mesh>
        </>
      )}

      <group
        ref={firstLeafRef}
        position={[
          -coverWidth / 2 + spineWidth * 0.65,
          0,
          pageThickness * 0.5 + 0.0015,
        ]}
        onPointerDown={(event) => {
          if (!selected || phase !== "BOOK_OPEN") return;
          event.stopPropagation();
          pageGestureStartedRef.current = true;
          onStartPageDrag();
        }}
        onPointerUp={(event) => {
          if (!selected || !pageGestureStartedRef.current) return;
          event.stopPropagation();
          pageGestureStartedRef.current = false;
          pageSettleFrameRef.current = requestAnimationFrame(() => {
            pageSettleFrameRef.current = null;
            pageSettleCallbackRef.current();
          });
        }}
        onPointerLeave={(event) => {
          if (!selected || !pageGestureStartedRef.current) return;
          event.stopPropagation();
          pageGestureStartedRef.current = false;
          pageSettleFrameRef.current = requestAnimationFrame(() => {
            pageSettleFrameRef.current = null;
            pageSettleCallbackRef.current();
          });
        }}
        onPointerCancel={(event) => {
          if (!selected || !pageGestureStartedRef.current) return;
          event.stopPropagation();
          pageGestureStartedRef.current = false;
          pageSettleFrameRef.current = requestAnimationFrame(() => {
            pageSettleFrameRef.current = null;
            pageSettleCallbackRef.current();
          });
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {renderFullRig && (
          <mesh position={[visiblePageWidth / 2, 0, 0.00022]}>
            <planeGeometry args={[visiblePageWidth, pageHeight - 0.014]} />
            <meshStandardMaterial
              color={spec.paperColor}
              roughness={0.96}
              side={DoubleSide}
            />
          </mesh>
        )}
      </group>
      <group
        ref={secondLeafRef}
        position={[
          -coverWidth / 2 + spineWidth * 0.65,
          0,
          pageThickness * 0.5 + 0.003,
        ]}
      >
        {renderFullRig && (
          <mesh position={[visiblePageWidth / 2, 0, 0.00022]}>
            <planeGeometry args={[visiblePageWidth, pageHeight - 0.014]} />
            <meshStandardMaterial
              color="#efe5cf"
              roughness={0.97}
              side={DoubleSide}
            />
          </mesh>
        )}
      </group>

      <group
        ref={coverRef}
        position={[
          -coverWidth / 2,
          0,
          pageDepth / 2 + boardThickness / 2,
        ]}
      >
        {renderFullRig && (
          <>
        <mesh
          geometry={coverGeometry || undefined}
          position={[coverWidth / 2, 0, 0]}
          castShadow={!economical}
        >
          <BindingMaterial
            binding={spec.binding}
            color={spec.baseColor}
            bindingMap={bindingMap}
            bindingNormalMap={bindingNormalMap}
            bindingRoughnessMap={bindingRoughnessMap}
            economical={economical}
          />
        </mesh>
        <mesh
          geometry={coverSurfaceGeometry || undefined}
          position={[coverWidth / 2, 0, boardThickness * 0.605]}
          visible={Boolean(artwork.frontFoil)}
          renderOrder={5}
        >
          <FoilMaterial
            map={artwork.frontFoil}
            embossMap={artwork.frontFoilEmboss}
            color={spec.foilColor}
            front
          />
        </mesh>
        <mesh
          geometry={endpaperGeometry || undefined}
          position={[coverWidth / 2, 0, -boardThickness * 0.515]}
          rotation={[0, Math.PI, 0]}
        >
          <meshPhysicalMaterial
            color={spec.paperColor}
            roughness={0.94}
            metalness={0}
            sheen={0.025}
            sheenRoughness={1}
          />
        </mesh>
        {selected &&
          [
            {
              key: "head",
              position: [coverWidth * 0.5, height * 0.5 - 0.0101, -boardThickness * 0.53],
              scale: [coverWidth - 0.0126, 0.018, 0.002],
            },
            {
              key: "tail",
              position: [coverWidth * 0.5, -height * 0.5 + 0.0101, -boardThickness * 0.53],
              scale: [coverWidth - 0.0126, 0.018, 0.002],
            },
            {
              key: "spine",
              position: [0.0101, 0, -boardThickness * 0.53],
              scale: [0.018, height - 0.0396, 0.002],
            },
            {
              key: "fore",
              position: [coverWidth - 0.0101, 0, -boardThickness * 0.53],
              scale: [0.018, height - 0.0396, 0.002],
            },
          ].map((strip) => (
            <mesh
              key={strip.key}
              position={strip.position as [number, number, number]}
              scale={strip.scale as [number, number, number]}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshPhysicalMaterial
                color={spec.baseColor}
                roughness={0.98}
                metalness={0.02}
                normalMap={bindingNormalMap || undefined}
                normalScale={HIGH_CLOTH_NORMAL_SCALE}
                bumpMap={bindingMap || undefined}
                bumpScale={0.0045}
              />
            </mesh>
          ))}
        <mesh
          position={[0.038, 0, boardThickness * 0.655]}
          scale={[0.012, height * 0.94, 1]}
          renderOrder={6}
        >
          <planeGeometry args={[1, 1]} />
          <meshPhysicalMaterial
            color="#17100d"
            roughness={0.9}
            metalness={0}
            bumpMap={bindingMap || undefined}
            bumpScale={0.006}
            transparent
            opacity={0.48}
            side={DoubleSide}
          />
        </mesh>
          </>
        )}
      </group>
    </group>
  );
}

function WarmWoodShelf({
  width,
  appearance,
  economical,
  woodMap,
  woodDetailMap,
  contactShadowMap,
}: {
  width: number;
  appearance: BookShelfSceneAppearance;
  economical: boolean;
  woodMap: CanvasTexture | null;
  woodDetailMap: CanvasTexture | null;
  contactShadowMap: CanvasTexture | null;
}) {
  const topGeometry = useMemo(
    () =>
      new RoundedBoxGeometry(
        width,
        0.2,
        1.18,
        economical ? 1 : 3,
        economical ? 0.018 : 0.028
      ),
    [economical, width]
  );
  const backRailGeometry = useMemo(
    () =>
      new RoundedBoxGeometry(
        Math.max(0.2, width - 0.04),
        0.16,
        0.13,
        economical ? 1 : 2,
        0.016
      ),
    [economical, width]
  );
  useEffect(
    () => () => {
      topGeometry.dispose();
      backRailGeometry.dispose();
    }, [backRailGeometry, topGeometry]
  );
  const topRoughness = Math.min(
    0.68,
    Math.max(0.52, appearance.materialRoughness * 0.82)
  );
  return (
    <group>
      <mesh
        geometry={topGeometry}
        position={[0, -1.12, -0.03]}
        castShadow={!economical}
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#c89267"
          map={woodMap || undefined}
          bumpMap={woodDetailMap || undefined}
          bumpScale={economical ? 0.007 : 0.012}
          roughnessMap={woodDetailMap || undefined}
          roughness={topRoughness}
          metalness={0}
          clearcoat={0.08}
          clearcoatRoughness={0.66}
          envMapIntensity={0.72}
        />
      </mesh>
      <mesh
        geometry={backRailGeometry}
        position={[0, -0.93, -0.545]}
        castShadow={!economical}
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#70412c"
          map={woodMap || undefined}
          bumpMap={woodDetailMap || undefined}
          bumpScale={economical ? 0.004 : 0.007}
          roughnessMap={woodDetailMap || undefined}
          roughness={0.68}
          metalness={0}
          clearcoat={0.035}
          clearcoatRoughness={0.78}
        />
      </mesh>
      <mesh
        position={[0, -1.014, 0.02]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[width * 0.92, 0.72, 1]}
        renderOrder={-2}
        visible={Boolean(contactShadowMap)}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#2f1d13"
          alphaMap={contactShadowMap || undefined}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default function CompleteShelfRenderer(
  props: CompleteShelfRendererProps
) {
  const { size, viewport, invalidate } = useThree();
  const renderingEconomical = props.economical || size.width <= 640;
  const anchorKey = props.selectedBookKey || props.focusedBookKey;
  const workingSet = useMemo(
    () =>
      selectCompleteShelfWorkingSet(
        props.items,
        anchorKey,
        completeShelfWorkingSetLimit(renderingEconomical)
      ),
    [anchorKey, props.items, renderingEconomical]
  );
  const specs = useMemo(
    () =>
      workingSet.entries.map(({ item, sourceIndex }) => {
        const presentation = item as PresentationItemWithYear;
        return buildCompleteShelfBookSpec(
          {
            key: presentation.key,
            title: presentation.title,
            writer: presentation.writer,
            year: presentation.year,
            baseColor: presentation.baseColor,
            accentColor: presentation.accentColor,
            paperColor: presentation.paperColor,
            coverUrl: presentation.coverUrl,
          },
          sourceIndex
        );
      }),
    [workingSet.entries]
  );
  const layout = useMemo(
    () => layoutCompleteShelfBooks(specs, workingSet.anchorSlot),
    [specs, workingSet.anchorSlot]
  );
  const needsFullRigMaps = Boolean(
    props.selectedBookKey && completeShelfPhaseHasInspection(props.phase)
  );
  const clothMap = useMemo(
    () => createCompleteShelfClothMap(renderingEconomical),
    [renderingEconomical]
  );
  const clothSurfaceMaps = useMemo(
    () => createCompleteShelfClothSurfaceMaps(renderingEconomical),
    [renderingEconomical]
  );
  const leatherMap = useMemo(
    () => createCompleteShelfLeatherMap(renderingEconomical),
    [renderingEconomical]
  );
  const leatherSurfaceMaps = useMemo(
    () => createCompleteShelfLeatherSurfaceMaps(renderingEconomical),
    [renderingEconomical]
  );
  const pageEdgeMaps = useMemo(
    () =>
      needsFullRigMaps
        ? createCompleteShelfPageEdgeTextures(renderingEconomical)
        : EMPTY_PAGE_EDGE_TEXTURES,
    [needsFullRigMaps, renderingEconomical]
  );
  const contactShadowMap = useMemo(
    () => createCompleteShelfContactShadowTexture(renderingEconomical),
    [renderingEconomical]
  );
  const woodMap = useMemo(
    () => createCompleteShelfWoodMap("#6a3b26", renderingEconomical),
    [renderingEconomical]
  );
  const woodDetailMap = useMemo(
    () => createCompleteShelfWoodDetailMap(renderingEconomical),
    [renderingEconomical]
  );
  useEffect(
    () => () =>
      disposeCompleteShelfTextures([
        clothMap,
        clothSurfaceMaps.normal,
        clothSurfaceMaps.roughness,
        leatherMap,
        leatherSurfaceMaps.normal,
        leatherSurfaceMaps.roughness,
        contactShadowMap,
        pageEdgeMaps.fore,
        pageEdgeMaps.headTail,
        woodMap,
        woodDetailMap,
      ]),
    [
      clothMap,
      clothSurfaceMaps,
      contactShadowMap,
      leatherMap,
      leatherSurfaceMaps,
      pageEdgeMaps,
      woodDetailMap,
      woodMap,
    ]
  );
  const shelfWidth = Math.max(
    6.5,
    layout.length
      ? layout[layout.length - 1].x - layout[0].x + 1.7
      : 6.5
  );
  const sceneFraming = resolveCompleteShelfViewportFraming({
    pixelWidth: size.width,
    viewportWidth: viewport.width,
    shelfWidth,
  });
  useEffect(() => {
    let firstFrame = 0;
    let secondFrame = 0;
    const scheduleStableFrame = () => {
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      invalidate();
      firstFrame = window.requestAnimationFrame(() => {
        firstFrame = 0;
        invalidate();
        secondFrame = window.requestAnimationFrame(() => {
          secondFrame = 0;
          invalidate();
        });
      });
    };
    scheduleStableFrame();
    window.addEventListener("resize", scheduleStableFrame);
    window.addEventListener("scroll", scheduleStableFrame, true);
    return () => {
      window.removeEventListener("resize", scheduleStableFrame);
      window.removeEventListener("scroll", scheduleStableFrame, true);
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [
    invalidate,
    sceneFraming.positionY,
    sceneFraming.scale,
    size.height,
    size.left,
    size.top,
    size.width,
    workingSet.entries.length,
  ]);
  const reporterKey =
    props.selectedBookKey ||
    props.focusedBookKey ||
    workingSet.entries[workingSet.anchorSlot]?.item.key ||
    null;
  const callbacks: CompleteShelfTransitionCallbacks = {
    onMotionReached: props.onMotionReached,
    onMotionSettled: props.onMotionSettled,
    onInspectionEntered: props.onInspectionEntered,
    onCoverOpened: props.onCoverOpened,
    onPageSettled: props.onPageSettled,
    onInspectionClosed: props.onInspectionClosed,
    onShelfRestored: props.onShelfRestored,
  };

  return (
    <group
      scale={sceneFraming.scale}
      position={[0, sceneFraming.positionY, 0]}
    >
      <WarmWoodShelf
        width={shelfWidth}
        appearance={props.appearance}
        economical={renderingEconomical}
        woodMap={woodMap}
        woodDetailMap={woodDetailMap}
        contactShadowMap={contactShadowMap}
      />
      {workingSet.entries.map((entry, index) => {
        const binding = layout[index].spec.binding;
        const bindingMap = binding === "leather" ? leatherMap : clothMap;
        const bindingSurfaceMaps =
          binding === "leather" ? leatherSurfaceMaps : clothSurfaceMaps;
        return (
          <CompleteShelfBook
            key={entry.item.key}
            layout={layout[index]}
            anchorSlot={workingSet.anchorSlot}
            phase={props.phase}
            requestId={props.requestId}
            focusedBookKey={props.focusedBookKey}
            selectedBookKey={props.selectedBookKey}
            reporterKey={reporterKey}
            economical={renderingEconomical}
            reducedMotion={props.reducedMotion}
            bindingMap={bindingMap}
            bindingNormalMap={bindingSurfaceMaps.normal}
            bindingRoughnessMap={bindingSurfaceMaps.roughness}
            foreEdgeMap={pageEdgeMaps.fore}
            headTailEdgeMap={pageEdgeMaps.headTail}
            contactShadowMap={contactShadowMap}
            onOpenBook={props.onOpenBook}
            onRequestCoverOpen={props.onRequestCoverOpen}
            onStartPageDrag={props.onStartPageDrag}
            onRequestPageSettle={props.onRequestPageSettle}
            callbacks={callbacks}
          />
        );
      })}
    </group>
  );
}
