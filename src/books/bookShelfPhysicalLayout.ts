import type { BookShelfPhase } from "./bookShelfState";

export type BookPhysicalDimensions = Readonly<{
  height: number;
  coverWidth: number;
  pageDepth: number;
  boardThickness: number;
}>;

export type BookPhysicalBounds = Readonly<{
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}>;

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function bookShelfCoverAngle(phase: BookShelfPhase) {
  if (phase === "COVER_CRACKED") return -0.12;
  return ["COVER_OPENING", "BOOK_OPEN", "PAGE_DRAGGING", "PAGE_SETTLING"].includes(phase)
    ? -2.18 : 0;
}

/** Reserve the full swept bounds before a cover or sheet starts moving. */
export function resolveBookPhysicalBounds({
  dimensions, phase, scale = 1, coverAngle = bookShelfCoverAngle(phase),
  pageProgress = 0, rotationY = 0.08,
}: {
  dimensions: BookPhysicalDimensions;
  phase: BookShelfPhase;
  scale?: number;
  coverAngle?: number;
  pageProgress?: number;
  rotationY?: number;
}): BookPhysicalBounds {
  const width = clamp(finite(dimensions.coverWidth, 1.07), 0.1, 4);
  const height = clamp(finite(dimensions.height, 1.52), 0.14, 6);
  const depth = clamp(finite(dimensions.pageDepth, 0.27), 0.02, 1);
  const board = clamp(finite(dimensions.boardThickness, 0.032), 0.002, 0.1);
  const closing = phase === "INSPECTION_CLOSING";
  const angle = closing ? 2.18 : clamp(Math.abs(finite(coverAngle, 0)), 0, Math.PI);
  const turning = closing || phase === "PAGE_DRAGGING" || phase === "PAGE_SETTLING" || pageProgress > 0;
  const pageWidth = width - 0.074;
  const minX = -width / 2 + Math.min(0, width * Math.cos(angle), turning ? -pageWidth : 0);
  const maxX = width / 2;
  const minZ = -depth / 2 - board;
  const maxZ = depth / 2 + board + Math.max(
    width * Math.sin(Math.min(angle, Math.PI / 2)), turning ? pageWidth * 1.08 : 0,
  );
  const rotation = finite(rotationY, 0.08);
  const safeScale = clamp(finite(scale, 1), 0.1, 3);
  const xs: number[] = [], zs: number[] = [];
  for (const x of [minX, maxX]) for (const z of [minZ, maxZ]) {
    xs.push((x * Math.cos(rotation) + z * Math.sin(rotation)) * safeScale);
    zs.push((-x * Math.sin(rotation) + z * Math.cos(rotation)) * safeScale);
  }
  return Object.freeze({
    min: Object.freeze([Math.min(...xs), -height * safeScale / 2, Math.min(...zs)]) as readonly [number, number, number],
    max: Object.freeze([Math.max(...xs), height * safeScale / 2, Math.max(...zs)]) as readonly [number, number, number],
  });
}

/** Clearance is physical, so quality changes cannot change collision safety. */
export function resolveBookShelfInspectionGutter(options: {
  dimensions: BookPhysicalDimensions;
  phase: BookShelfPhase;
  scale?: number;
  coverAngle?: number;
  pageProgress?: number;
  gap?: number;
}) {
  if (["SHELF_IDLE", "SHELF_MOVING", "SHELF_SETTLING", "SHELF_RESTORING", "ERROR_FALLBACK"].includes(options.phase)) {
    return Object.freeze({ left: 0, right: 0 });
  }
  const bounds = resolveBookPhysicalBounds(options);
  const halfSpine = (options.dimensions.pageDepth + options.dimensions.boardThickness * 2) / 2;
  const margin = 0.06;
  return Object.freeze({
    left: Math.max(0, -bounds.min[0] - halfSpine + margin),
    right: Math.max(0, bounds.max[0] - halfSpine + margin),
  });
}
