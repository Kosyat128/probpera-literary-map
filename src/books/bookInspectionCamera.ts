export const BOOK_INSPECTION_ENTER_DURATION_MS = 920;
export const BOOK_INSPECTION_CLOSE_DURATION_MS = 620;

export type BookInspectionVector3 = readonly [number, number, number];

export type BookInspectionCameraTarget = Readonly<{
  position: BookInspectionVector3;
  lookAt: BookInspectionVector3;
  fov: number;
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
  }>;

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
}: {
  viewportWidth: number;
  viewportHeight: number;
  detailOpen: boolean;
  detailRightInsetPx?: number;
  itemIndex: number;
  itemCount: number;
}): BookInspectionCameraFraming {
  const width = clamp(finiteOr(viewportWidth, 1280), 240, 8192);
  const height = clamp(finiteOr(viewportHeight, 720), 240, 8192);
  const aspect = clamp(width / height, 0.5, 3.2);
  const sideDetailVisible = detailOpen && width >= 760;
  const defaultInset = clamp(width * 0.285, 260, width * 0.42);
  const rightInsetPx = sideDetailVisible
    ? round(
        clamp(
          finiteOr(detailRightInsetPx ?? defaultInset, defaultInset),
          0,
          width * 0.48
        )
      )
    : 0;
  const fov = width < 680 ? 43 : width < 1024 ? 39 : 35;
  const distance = round(3.9 + Math.max(0, 1.15 - aspect) * 0.55);
  const visibleWorldWidth =
    2 * distance * Math.tan((fov * Math.PI) / 360) * aspect;
  const opticalOffsetX = round(
    visibleWorldWidth * (rightInsetPx / (2 * width))
  );
  const edge = resolveBookInspectionEdgeCompensation(itemIndex, itemCount);
  const edgeScale = width < 680 ? 0.52 : width < 1024 ? 0.78 : 1;
  const edgeCompensationX = round(edge.offsetX * edgeScale);
  const rigX = round(opticalOffsetX + edgeCompensationX);
  const lookAt = freezeVector([rigX, 0.035, 0.98]);
  const position = freezeVector([rigX, 0.115, 0.98 + distance]);

  return Object.freeze({
    position,
    lookAt,
    fov,
    rightInsetPx,
    opticalOffsetX,
    edgeCompensationX,
    edgeClass: edge.edgeClass,
    distance,
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
