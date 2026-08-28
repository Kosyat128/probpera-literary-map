import {
  BOOK_PAGE_TURN_COMMIT_THRESHOLD,
  BOOK_PAGE_TURN_REVERSE_VELOCITY_THRESHOLD,
  BOOK_PAGE_TURN_VELOCITY_THRESHOLD,
  type BookInspectionPageDirection,
} from "./bookInspectionSession";
import type { BookInspectionTextureQuality } from "./bookInspectionTextures";

export type BookInspectionPageGeometryPlan = Readonly<{
  quality: BookInspectionTextureQuality;
  widthSegments: number;
  heightSegments: number;
  vertexCount: number;
  triangleCount: number;
}>;

export type BookInspectionPageGeometrySample = Readonly<{
  column: number;
  row: number;
  u: number;
  v: number;
  position: readonly [number, number, number];
  turnAngle: number;
  curl: number;
}>;

export type BookInspectionPagePoint = Readonly<{
  position: readonly [number, number, number];
  turnAngle: number;
  curl: number;
}>;

export type BookInspectionPageTurnGeometryInput = Readonly<{
  quality: BookInspectionTextureQuality;
  direction: BookInspectionPageDirection;
  progress: number;
  pageWidth?: number;
  pageHeight?: number;
}>;

export type BookInspectionPageTurnOutcome = Readonly<{
  committed: boolean;
  settleProgress: 0 | 1;
}>;

const plans: Readonly<
  Record<
    BookInspectionTextureQuality,
    Readonly<{ widthSegments: number; heightSegments: number }>
  >
> = {
  HIGH: { widthSegments: 32, heightSegments: 5 },
  BALANCED: { widthSegments: 20, heightSegments: 3 },
  ECONOMY: { widthSegments: 12, heightSegments: 2 },
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;

export function normalizeBookInspectionPageTurnProgress(progress: number) {
  return clamp(finite(progress, 0), 0, 1);
}

export function resolveBookInspectionPageGeometryPlan(
  quality: BookInspectionTextureQuality
): BookInspectionPageGeometryPlan {
  const safeQuality = quality in plans ? quality : "BALANCED";
  const plan = plans[safeQuality];
  return Object.freeze({
    quality: safeQuality,
    widthSegments: plan.widthSegments,
    heightSegments: plan.heightSegments,
    vertexCount: (plan.widthSegments + 1) * (plan.heightSegments + 1),
    triangleCount: plan.widthSegments * plan.heightSegments * 2,
  });
}

/**
 * Samples one anchored sheet. `u=0` is the binding and never moves. Forward
 * starts on the right and backward on the left; the two directions are exact
 * mirrors while sharing the same bounded lift and curl.
 */
export function sampleBookInspectionPageTurn(options: {
  direction: BookInspectionPageDirection;
  progress: number;
  u: number;
  v: number;
  pageWidth?: number;
  pageHeight?: number;
}): BookInspectionPagePoint {
  const progress = normalizeBookInspectionPageTurnProgress(options.progress);
  const u = clamp(finite(options.u, 0), 0, 1);
  const v = clamp(finite(options.v, 0.5), 0, 1);
  const width = clamp(finite(options.pageWidth ?? 1, 1), 0.1, 4);
  const height = clamp(finite(options.pageHeight ?? 1.42, 1.42), 0.14, 6);
  const side = options.direction === "backward" ? -1 : 1;
  const distanceFromBinding = u * width;
  const endpointEnvelope = Math.sin(Math.PI * progress);
  const turnAngle = Math.PI * progress;

  // Curl vanishes at the binding and at both committed endpoints. The small
  // vertical envelope gives the free edge a sheet-like bow without exceeding
  // eight percent of page width.
  const curl =
    width *
    0.08 *
    endpointEnvelope *
    Math.sin(Math.PI * u) *
    (0.88 + 0.12 * Math.cos((v - 0.5) * Math.PI));
  const edgeBow =
    width * 0.012 * endpointEnvelope * Math.sin(Math.PI * u) * (v - 0.5);

  const x =
    side *
    (distanceFromBinding * Math.cos(turnAngle) + curl * 0.12);
  const y = (v - 0.5) * height + edgeBow;
  const z = Math.max(
    0,
    distanceFromBinding * Math.sin(turnAngle) + curl
  );

  return Object.freeze({
    position: Object.freeze([x, y, z]) as readonly [number, number, number],
    turnAngle,
    curl,
  });
}

export function buildBookInspectionPageGeometrySamples(
  input: BookInspectionPageTurnGeometryInput
) {
  const plan = resolveBookInspectionPageGeometryPlan(input.quality);
  const progress = normalizeBookInspectionPageTurnProgress(input.progress);
  const samples: BookInspectionPageGeometrySample[] = [];

  for (let row = 0; row <= plan.heightSegments; row += 1) {
    const v = row / plan.heightSegments;
    for (let column = 0; column <= plan.widthSegments; column += 1) {
      const u = column / plan.widthSegments;
      const sampled = sampleBookInspectionPageTurn({
        direction: input.direction,
        progress,
        u,
        v,
        pageWidth: input.pageWidth,
        pageHeight: input.pageHeight,
      });
      samples.push(
        Object.freeze({
          column,
          row,
          u,
          v,
          position: sampled.position,
          turnAngle: sampled.turnAngle,
          curl: sampled.curl,
        })
      );
    }
  }

  return Object.freeze({
    plan,
    direction: input.direction,
    progress,
    samples: Object.freeze(samples),
  });
}

/** Mirrors the session controller's signed-velocity rules without owning it. */
export function resolveBookInspectionPageTurnOutcome(options: {
  direction: BookInspectionPageDirection;
  progress: number;
  velocity: number;
  commitThreshold?: number;
  velocityThreshold?: number;
  reverseVelocityThreshold?: number;
}): BookInspectionPageTurnOutcome {
  const progress = normalizeBookInspectionPageTurnProgress(options.progress);
  const commitThreshold = normalizeBookInspectionPageTurnProgress(
    finite(options.commitThreshold ?? BOOK_PAGE_TURN_COMMIT_THRESHOLD, 0.5)
  );
  const velocityThreshold = Math.max(
    0,
    finite(
      options.velocityThreshold ?? BOOK_PAGE_TURN_VELOCITY_THRESHOLD,
      BOOK_PAGE_TURN_VELOCITY_THRESHOLD
    )
  );
  const reverseVelocityThreshold = Math.max(
    0,
    finite(
      options.reverseVelocityThreshold ??
        BOOK_PAGE_TURN_REVERSE_VELOCITY_THRESHOLD,
      BOOK_PAGE_TURN_REVERSE_VELOCITY_THRESHOLD
    )
  );
  const directionSign = options.direction === "forward" ? 1 : -1;
  const directionalVelocity = finite(options.velocity, 0) * directionSign;
  const stronglyReversed = directionalVelocity <= -reverseVelocityThreshold;
  const committed =
    !stronglyReversed &&
    (progress >= commitThreshold || directionalVelocity >= velocityThreshold);

  return Object.freeze({
    committed,
    settleProgress: committed ? 1 : 0,
  });
}
