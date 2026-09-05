import type { BookPhysicalBounds } from "./bookShelfPhysicalLayout";
import type { BookShelfViewportInsets } from "./bookShelfViewportInsets";
export type { BookShelfViewportInsets } from "./bookShelfViewportInsets";

export const BOOK_INSPECTION_ENTER_DURATION_MS = 920;
export const BOOK_INSPECTION_CLOSE_DURATION_MS = 620;

export type BookInspectionVector3 = readonly [number, number, number];

export type BookInspectionCameraTarget = Readonly<{
  position: BookInspectionVector3;
  lookAt: BookInspectionVector3;
  fov: number;
  framing?: Readonly<{
    bounds: BookPhysicalBounds;
    position: BookInspectionVector3;
    width: number;
    height: number;
    insets: BookShelfViewportInsets;
    marginPx: number;
  }>;
}>;

export type BookInspectionEdgeClass =
  | "only"
  | "first"
  | "middle"
  | "penultimate"
  | "last";

export type BookInspectionCameraFraming = BookInspectionCameraTarget &
  Readonly<{
    rightInsetPx: number;
    opticalOffsetX: number;
    edgeCompensationX: number;
    edgeClass: BookInspectionEdgeClass;
    distance: number;
    viewportInsets: BookShelfViewportInsets;
  }>;

export function resolveBookShelfUnobscuredViewport(
  width: number,
  height: number,
  requested: Partial<BookShelfViewportInsets> = {},
) {
  const safeWidth = clamp(finiteOr(width, 1), 1, 8192);
  const safeHeight = clamp(finiteOr(height, 1), 1, 8192);
  const left = clamp(finiteOr(requested.left ?? 0, 0), 0, safeWidth - 1);
  const right = clamp(finiteOr(requested.right ?? 0, 0), 0, safeWidth - left - 1);
  const top = clamp(finiteOr(requested.top ?? 0, 0), 0, safeHeight - 1);
  const bottom = clamp(finiteOr(requested.bottom ?? 0, 0), 0, safeHeight - top - 1);
  return Object.freeze({
    x: left, y: top, width: safeWidth - left - right, height: safeHeight - top - bottom,
    insets: Object.freeze({ top, right, bottom, left }),
  });
}

/** An offscreen or covered canvas must not send the physical camera to infinity. */
export function bookInspectionViewportCanFrame(target: BookInspectionCameraTarget) {
  const framing = target.framing;
  if (!framing) return true;
  const free = resolveBookShelfUnobscuredViewport(framing.width, framing.height, framing.insets);
  return free.width >= Math.min(64, framing.width) && free.height >= Math.min(64, framing.height);
}

export type BookInspectionExtractionSnapshot = Readonly<{
  bookKey: string;
  sourceIndex: number;
  requestId: number;
  pose: Readonly<{
    position: BookInspectionVector3;
    rotation: BookInspectionVector3;
    scale: number;
  }>;
}>;

export type BookInspectionTransitionKind = "enter" | "close";

export type BookInspectionTransitionSample = Readonly<{
  kind: BookInspectionTransitionKind;
  durationMs: number;
  linearProgress: number;
  easedProgress: number;
  complete: boolean;
}>;

export type BookInspectionOrbit = Readonly<{
  yaw: number;
  pitch: number;
  zoom: number;
}>;

export const BOOK_INSPECTION_ORBIT_LIMITS = Object.freeze({
  minimumYaw: -0.24,
  maximumYaw: 0.24,
  minimumPitch: -0.13,
  maximumPitch: 0.17,
  minimumZoom: 0.86,
  maximumZoom: 1.24,
});

export const BOOK_INSPECTION_DEFAULT_ORBIT: BookInspectionOrbit = Object.freeze({
  yaw: 0,
  pitch: 0,
  zoom: 1,
});

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const finiteOr = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;

const round = (value: number) => Math.round(value * 100_000) / 100_000;

const freezeVector = (
  value: readonly [number, number, number]
): BookInspectionVector3 =>
  Object.freeze([
    finiteOr(value[0], 0),
    finiteOr(value[1], 0),
    finiteOr(value[2], 0),
  ]) as BookInspectionVector3;

const interpolate = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

/**
 * Compensates for the visual weight of the finite shelf at its real edges.
 * Positive values shift the camera rig right, which places the book slightly
 * left in the rendered frame. There is deliberately no circular wrapping.
 */
export function resolveBookInspectionEdgeCompensation(
  itemIndex: number,
  itemCount: number
): Readonly<{
  edgeClass: BookInspectionEdgeClass;
  offsetX: number;
}> {
  const count = Math.max(0, Math.trunc(finiteOr(itemCount, 0)));
  if (count <= 1) {
    return Object.freeze({ edgeClass: "only", offsetX: 0 });
  }
  const index = clamp(
    Math.trunc(finiteOr(itemIndex, 0)),
    0,
    Math.max(0, count - 1)
  );
  if (index === 0) {
    return Object.freeze({ edgeClass: "first", offsetX: 0.16 });
  }
  if (index === count - 1) {
    return Object.freeze({ edgeClass: "last", offsetX: -0.16 });
  }
  if (index === count - 2) {
    return Object.freeze({ edgeClass: "penultimate", offsetX: -0.075 });
  }
  return Object.freeze({ edgeClass: "middle", offsetX: 0 });
}

/**
 * Resolves a desired camera rig without mutating the Canvas camera. When the
 * details panel occupies the right side, both position and lookAt move right;
 * this optically places the inspected book in the centre of the visible area.
 */
export function resolveBookInspectionCameraFraming({
  viewportWidth,
  viewportHeight,
  detailOpen,
  detailRightInsetPx,
  itemIndex,
  itemCount,
  viewportInsets,
  bounds,
  bookPosition = [0, 0.55, 1.05],
  marginPx = 20,
  fov: requestedFov,
  orbitAllowance = 1.24,
}: {
  viewportWidth: number;
  viewportHeight: number;
  detailOpen: boolean;
  detailRightInsetPx?: number;
  itemIndex: number;
  itemCount: number;
  viewportInsets?: BookShelfViewportInsets;
  bounds?: BookPhysicalBounds;
  bookPosition?: BookInspectionVector3;
  marginPx?: number;
  fov?: number;
  orbitAllowance?: number;
}): BookInspectionCameraFraming {
  const width = clamp(finiteOr(viewportWidth, 1280), 1, 8192);
  const height = clamp(finiteOr(viewportHeight, 720), 1, 8192);
  const aspect = width / height;
  const sideDetailVisible = detailOpen && width >= 760;
  const defaultInset = clamp(width * 0.285, 260, width * 0.42);
  const fallbackRightInset = sideDetailVisible
    ? round(
        clamp(
          finiteOr(detailRightInsetPx ?? defaultInset, defaultInset),
          0,
          width * 0.48
        )
      )
    : 0;
  const free = resolveBookShelfUnobscuredViewport(width, height,
    viewportInsets ?? { right: fallbackRightInset });
  const rightInsetPx = free.insets.right;
  const fov = clamp(finiteOr(requestedFov ?? (width < 680 ? 43 : 35), 35), 30, 48);
  const physical = bounds ?? { min: [-0.82, -1.08, -0.25], max: [0.82, 1.08, 0.25] };
  const center = physical.min.map((value, index) =>
    (finiteOr(value, 0) + finiteOr(physical.max[index], 0)) / 2 + finiteOr(bookPosition[index], 0));
  const extent = physical.min.map((value, index) =>
    Math.max(0.001, Math.abs(finiteOr(physical.max[index], 0) - finiteOr(value, 0))));
  const margin = clamp(finiteOr(marginPx, 20), 0, Math.min(free.width, free.height) * 0.15);
  const usableWidth = Math.max(1, free.width - margin * 2);
  const usableHeight = Math.max(1, free.height - margin * 2);
  const tangent = Math.tan((fov * Math.PI) / 360);
  const fitDistance = Math.max(
    extent[0] / (2 * tangent * aspect * usableWidth / width),
    extent[1] / (2 * tangent * usableHeight / height),
  );
  // Depth and the off-axis free rectangle are included before orbit zoom.
  const distance = round((fitDistance + extent[2] / 2 + 0.08) *
    clamp(finiteOr(orbitAllowance, 1.24), 1, 1.5));
  const visibleWorldWidth = 2 * distance * tangent * aspect;
  const opticalOffsetX = round(
    visibleWorldWidth * ((rightInsetPx - free.insets.left) / (2 * width))
  );
  const edge = resolveBookInspectionEdgeCompensation(itemIndex, itemCount);
  // The physical bounds, not the finite row's visual weight, own safe framing.
  const edgeCompensationX = 0;
  const rigX = center[0] + opticalOffsetX;
  const rigY = center[1] + distance * tangent * (free.insets.top - free.insets.bottom) / height;
  const lookAt = freezeVector([rigX, rigY, center[2]]);
  const position = freezeVector([rigX, rigY, center[2] + distance]);

  return Object.freeze({
    position,
    lookAt,
    fov,
    rightInsetPx,
    opticalOffsetX,
    edgeCompensationX,
    edgeClass: edge.edgeClass,
    distance,
    viewportInsets: free.insets,
    framing: { bounds: physical as BookPhysicalBounds, position: bookPosition,
      width, height, insets: free.insets, marginPx: margin },
  });
}

/**
 * Frame-rate independent half-life damping for resize and panel-layout
 * changes. A capped frame step prevents a background-tab wake-up from
 * producing a one-frame camera jump. Reduced motion intentionally snaps.
 */
export function smoothBookInspectionCameraTarget(
  current: BookInspectionCameraTarget,
  desired: BookInspectionCameraTarget,
  deltaMs: number,
  options: Readonly<{
    reducedMotion?: boolean;
    halfLifeMs?: number;
  }> = {}
): BookInspectionCameraTarget {
  if (options.reducedMotion) {
    return Object.freeze({
      position: freezeVector(desired.position),
      lookAt: freezeVector(desired.lookAt),
      fov: finiteOr(desired.fov, current.fov),
    });
  }
  const elapsed = clamp(finiteOr(deltaMs, 0), 0, 50);
  if (elapsed === 0) {
    return Object.freeze({
      position: freezeVector(current.position),
      lookAt: freezeVector(current.lookAt),
      fov: finiteOr(current.fov, 35),
    });
  }
  const halfLife = clamp(finiteOr(options.halfLifeMs ?? 110, 110), 16, 600);
  const amount = 1 - Math.pow(2, -elapsed / halfLife);
  const vector = (
    from: BookInspectionVector3,
    to: BookInspectionVector3
  ): BookInspectionVector3 =>
    freezeVector([
      round(interpolate(from[0], to[0], amount)),
      round(interpolate(from[1], to[1], amount)),
      round(interpolate(from[2], to[2], amount)),
    ]);

  return Object.freeze({
    position: vector(current.position, desired.position),
    lookAt: vector(current.lookAt, desired.lookAt),
    fov: round(
      interpolate(
        finiteOr(current.fov, 35),
        finiteOr(desired.fov, 35),
        amount
      )
    ),
  });
}

/**
 * Deeply snapshots the extraction pose. The selected identity and its shelf
 * pose therefore cannot drift when filtering, resizing or reassigning pooled
 * meshes while the inspection transition is running.
 */
export function freezeBookInspectionExtraction({
  bookKey,
  sourceIndex,
  requestId,
  pose,
}: {
  bookKey: string;
  sourceIndex: number;
  requestId: number;
  pose: Readonly<{
    position: readonly [number, number, number];
    rotation: readonly [number, number, number];
    scale: number;
  }>;
}): BookInspectionExtractionSnapshot {
  const key = bookKey.trim();
  if (!key) throw new TypeError("bookKey must identify the extracted book");
  if (!Number.isInteger(sourceIndex) || sourceIndex < 0) {
    throw new RangeError("sourceIndex must be a non-negative integer");
  }
  if (!Number.isInteger(requestId) || requestId < 0) {
    throw new RangeError("requestId must be a non-negative integer");
  }
  if (!Number.isFinite(pose.scale) || pose.scale <= 0) {
    throw new RangeError("pose.scale must be a positive finite number");
  }
  return Object.freeze({
    bookKey: key,
    sourceIndex,
    requestId,
    pose: Object.freeze({
      position: freezeVector(pose.position),
      rotation: freezeVector(pose.rotation),
      scale: pose.scale,
    }),
  });
}

export function easeBookInspectionProgress(
  kind: BookInspectionTransitionKind,
  progress: number
) {
  const value = clamp(finiteOr(progress, 0), 0, 1);
  if (kind === "enter") {
    // Smoothstep keeps both ends still and avoids a mechanical extraction.
    return value * value * (3 - 2 * value);
  }
  // Closing begins gently but clears the foreground decisively near the end.
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export function sampleBookInspectionTransition({
  kind,
  elapsedMs,
  reducedMotion = false,
}: {
  kind: BookInspectionTransitionKind;
  elapsedMs: number;
  reducedMotion?: boolean;
}): BookInspectionTransitionSample {
  const nominalDuration =
    kind === "enter"
      ? BOOK_INSPECTION_ENTER_DURATION_MS
      : BOOK_INSPECTION_CLOSE_DURATION_MS;
  if (reducedMotion) {
    return Object.freeze({
      kind,
      durationMs: 0,
      linearProgress: 1,
      easedProgress: 1,
      complete: true,
    });
  }
  const linearProgress = clamp(
    finiteOr(elapsedMs, 0) / nominalDuration,
    0,
    1
  );
  return Object.freeze({
    kind,
    durationMs: nominalDuration,
    linearProgress,
    easedProgress: easeBookInspectionProgress(kind, linearProgress),
    complete: linearProgress >= 1,
  });
}

export function applyBookInspectionOrbitDelta(
  orbit: BookInspectionOrbit,
  delta: Partial<BookInspectionOrbit>
): BookInspectionOrbit {
  const yaw = finiteOr(orbit.yaw, 0) + finiteOr(delta.yaw ?? 0, 0);
  const pitch = finiteOr(orbit.pitch, 0) + finiteOr(delta.pitch ?? 0, 0);
  const zoom = finiteOr(orbit.zoom, 1) + finiteOr(delta.zoom ?? 0, 0);
  return normalizeBookInspectionOrbit({ yaw, pitch, zoom });
}

function normalizeBookInspectionOrbit(
  orbit: BookInspectionOrbit
): BookInspectionOrbit {
  return Object.freeze({
    yaw: round(
      clamp(
        finiteOr(orbit.yaw, 0),
        BOOK_INSPECTION_ORBIT_LIMITS.minimumYaw,
        BOOK_INSPECTION_ORBIT_LIMITS.maximumYaw
      )
    ),
    pitch: round(
      clamp(
        finiteOr(orbit.pitch, 0),
        BOOK_INSPECTION_ORBIT_LIMITS.minimumPitch,
        BOOK_INSPECTION_ORBIT_LIMITS.maximumPitch
      )
    ),
    zoom: round(
      clamp(
        finiteOr(orbit.zoom, 1),
        BOOK_INSPECTION_ORBIT_LIMITS.minimumZoom,
        BOOK_INSPECTION_ORBIT_LIMITS.maximumZoom
      )
    ),
  });
}

export function resetBookInspectionOrbit(): BookInspectionOrbit {
  return BOOK_INSPECTION_DEFAULT_ORBIT;
}

/** Converts bounded orbit state into values directly consumable by R3F. */
export function resolveBookInspectionOrbitCamera(
  target: BookInspectionCameraTarget,
  requestedOrbit: BookInspectionOrbit
): BookInspectionCameraTarget {
  const orbit = normalizeBookInspectionOrbit(requestedOrbit);
  if (target.framing) {
    const { bounds, position, width, height, insets, marginPx } = target.framing;
    const center = bounds.min.map((value, index) => (value + bounds.max[index]) / 2 + position[index]);
    const sy = Math.sin(orbit.yaw), cy = Math.cos(orbit.yaw);
    const sp = Math.sin(orbit.pitch), cp = Math.cos(orbit.pitch);
    const right = [cy, 0, -sy], up = [-sy * sp, cp, -cy * sp], normal = [sy * cp, sp, cy * cp];
    const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const corners: number[][] = [];
    for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
      const point = [x + position[0] - center[0], y + position[1] - center[1], z + position[2] - center[2]];
      corners.push([dot(point, right), dot(point, up), dot(point, normal)]);
    }
    const tangent = Math.tan(target.fov * Math.PI / 360);
    const xMin = (2 * (insets.left + marginPx) / width - 1) * tangent * width / height;
    const xMax = (1 - 2 * (insets.right + marginPx) / width) * tangent * width / height;
    const yMin = (2 * (insets.bottom + marginPx) / height - 1) * tangent;
    const yMax = (1 - 2 * (insets.top + marginPx) / height) * tangent;
    const offsetsAt = (distance: number) => {
      let minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity;
      for (const [x, y, z] of corners) {
        minX = Math.max(minX, x - xMax * (distance - z));
        maxX = Math.min(maxX, x - xMin * (distance - z));
        minY = Math.max(minY, y - yMax * (distance - z));
        maxY = Math.min(maxY, y - yMin * (distance - z));
      }
      return { minX, maxX, minY, maxY };
    };
    let low = Math.max(...corners.map((point) => point[2])) + 0.12;
    let high = Math.max(low + 1, 256);
    for (let iteration = 0; iteration < 32; iteration += 1) {
      const mid = (low + high) / 2;
      const offsets = offsetsAt(mid);
      if (offsets.minX <= offsets.maxX && offsets.minY <= offsets.maxY) high = mid;
      else low = mid;
    }
    const baseDistance = Math.hypot(...target.position.map((value, index) => value - target.lookAt[index]));
    const distance = Math.max(high + 0.001, baseDistance / orbit.zoom);
    const offsets = offsetsAt(distance);
    const panX = (offsets.minX + offsets.maxX) / 2, panY = (offsets.minY + offsets.maxY) / 2;
    const lookAt = freezeVector(center.map((value, index) => value + right[index] * panX + up[index] * panY) as [number, number, number]);
    return Object.freeze({
      position: freezeVector(lookAt.map((value, index) => value + normal[index] * distance) as [number, number, number]),
      lookAt, fov: target.fov,
    });
  }
  const dx = target.position[0] - target.lookAt[0];
  const dy = target.position[1] - target.lookAt[1];
  const dz = target.position[2] - target.lookAt[2];
  const baseRadius = Math.max(0.1, Math.hypot(dx, dy, dz));
  const radius = baseRadius / orbit.zoom;
  const baseYaw = Math.atan2(dx, dz);
  const basePitch = Math.asin(clamp(dy / baseRadius, -1, 1));
  const yaw = baseYaw + orbit.yaw;
  const pitch = clamp(basePitch + orbit.pitch, -Math.PI / 2.2, Math.PI / 2.2);
  const horizontalRadius = Math.cos(pitch) * radius;

  return Object.freeze({
    position: freezeVector([
      round(target.lookAt[0] + Math.sin(yaw) * horizontalRadius),
      round(target.lookAt[1] + Math.sin(pitch) * radius),
      round(target.lookAt[2] + Math.cos(yaw) * horizontalRadius),
    ]),
    lookAt: freezeVector(target.lookAt),
    fov: finiteOr(target.fov, 35),
  });
}
