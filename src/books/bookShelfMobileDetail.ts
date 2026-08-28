export const BOOK_SHELF_MOBILE_DETAIL_POSITIONS = [
  "collapsed",
  "half",
  "expanded",
] as const;

export type BookShelfMobileDetailPosition =
  (typeof BOOK_SHELF_MOBILE_DETAIL_POSITIONS)[number];

export type BookShelfMobileDetailAxis =
  | "none"
  | "pending"
  | "horizontal"
  | "vertical";

export type BookShelfMobileDetailPhase = "idle" | "dragging" | "settling";

export type BookShelfMobileDetailMotion = Readonly<{
  mode: "instant" | "panel";
  durationMs: number;
  easing: string;
}>;

type BookShelfMobileDetailGesture = Readonly<{
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
}>;

export type BookShelfMobileDetailState = Readonly<{
  position: BookShelfMobileDetailPosition;
  targetPosition: BookShelfMobileDetailPosition;
  phase: BookShelfMobileDetailPhase;
  axis: BookShelfMobileDetailAxis;
  dragOffsetPx: number;
  reducedMotion: boolean;
  transitionId: number;
  gesture: BookShelfMobileDetailGesture | null;
}>;

export type BookShelfMobileDetailAction =
  | Readonly<{
      type: "request-position";
      position: BookShelfMobileDetailPosition;
    }>
  | Readonly<{ type: "set-reduced-motion"; value: boolean }>
  | Readonly<{ type: "drag-start"; x: number; y: number }>
  | Readonly<{ type: "drag-move"; x: number; y: number }>
  | Readonly<{ type: "drag-end"; velocityY?: number }>
  | Readonly<{ type: "drag-cancel" }>
  | Readonly<{ type: "settled"; transitionId: number }>;

export type BookShelfMobileDetailGestureOptions = Readonly<{
  activationDistancePx?: number;
  axisLockRatio?: number;
  dragThresholdPx?: number;
  velocityThresholdPxPerMs?: number;
}>;

const POSITION_INDEX: Readonly<Record<BookShelfMobileDetailPosition, number>> = {
  collapsed: 0,
  half: 1,
  expanded: 2,
};

const PANEL_DURATION_MS = 260;
const PANEL_EASING = "cubic-bezier(0.2, 0.72, 0.24, 1)";
const DEFAULT_ACTIVATION_DISTANCE_PX = 8;
const DEFAULT_AXIS_LOCK_RATIO = 1.2;
const DEFAULT_DRAG_THRESHOLD_PX = 52;
const DEFAULT_VELOCITY_THRESHOLD_PX_PER_MS = 0.45;
const MAX_DRAG_OFFSET_PX = 180;

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function adjacentPosition(
  position: BookShelfMobileDetailPosition,
  direction: -1 | 0 | 1,
) {
  const nextIndex = Math.max(
    0,
    Math.min(
      BOOK_SHELF_MOBILE_DETAIL_POSITIONS.length - 1,
      POSITION_INDEX[position] + direction,
    ),
  );
  return BOOK_SHELF_MOBILE_DETAIL_POSITIONS[nextIndex];
}

export function getBookShelfMobileDetailMotion(
  reducedMotion: boolean,
): BookShelfMobileDetailMotion {
  return reducedMotion
    ? { mode: "instant", durationMs: 0, easing: "linear" }
    : {
        mode: "panel",
        durationMs: PANEL_DURATION_MS,
        easing: PANEL_EASING,
      };
}

export function resolveBookShelfMobileDetailAxis(
  deltaX: number,
  deltaY: number,
  options: BookShelfMobileDetailGestureOptions = {},
): Exclude<BookShelfMobileDetailAxis, "none"> {
  const safeX = Math.abs(finite(deltaX));
  const safeY = Math.abs(finite(deltaY));
  const activationDistance = Math.max(
    1,
    finite(options.activationDistancePx ?? DEFAULT_ACTIVATION_DISTANCE_PX),
  );
  const axisLockRatio = Math.max(
    1,
    finite(options.axisLockRatio ?? DEFAULT_AXIS_LOCK_RATIO),
  );

  if (Math.hypot(safeX, safeY) < activationDistance) return "pending";
  if (safeY >= safeX * axisLockRatio) return "vertical";
  if (safeX >= safeY * axisLockRatio) return "horizontal";
  return "pending";
}

export function resolveBookShelfMobileDetailSettle({
  position,
  axis,
  deltaY,
  velocityY = 0,
  options = {},
}: Readonly<{
  position: BookShelfMobileDetailPosition;
  axis: BookShelfMobileDetailAxis;
  deltaY: number;
  velocityY?: number;
  options?: BookShelfMobileDetailGestureOptions;
}>): BookShelfMobileDetailPosition {
  if (axis !== "vertical") return position;

  const safeDeltaY = finite(deltaY);
  const safeVelocityY = finite(velocityY);
  const dragThreshold = Math.max(
    1,
    finite(options.dragThresholdPx ?? DEFAULT_DRAG_THRESHOLD_PX),
  );
  const velocityThreshold = Math.max(
    0.01,
    finite(
      options.velocityThresholdPxPerMs ??
        DEFAULT_VELOCITY_THRESHOLD_PX_PER_MS,
    ),
  );
  const intent =
    Math.abs(safeVelocityY) >= velocityThreshold
      ? Math.sign(safeVelocityY)
      : Math.abs(safeDeltaY) >= dragThreshold
        ? Math.sign(safeDeltaY)
        : 0;

  // Dragging upward expands the sheet; dragging downward collapses it.
  return adjacentPosition(position, intent < 0 ? 1 : intent > 0 ? -1 : 0);
}

export function createInitialBookShelfMobileDetailState(
  position: BookShelfMobileDetailPosition = "collapsed",
  reducedMotion = false,
): BookShelfMobileDetailState {
  return {
    position,
    targetPosition: position,
    phase: "idle",
    axis: "none",
    dragOffsetPx: 0,
    reducedMotion,
    transitionId: 0,
    gesture: null,
  };
}

function requestPosition(
  state: BookShelfMobileDetailState,
  position: BookShelfMobileDetailPosition,
) {
  if (
    state.phase === "idle" &&
    state.position === position &&
    state.targetPosition === position
  ) {
    return state;
  }
  const transitionId = state.transitionId + 1;
  if (state.reducedMotion) {
    return {
      ...state,
      position,
      targetPosition: position,
      phase: "idle" as const,
      axis: "none" as const,
      dragOffsetPx: 0,
      transitionId,
      gesture: null,
    };
  }
  return {
    ...state,
    targetPosition: position,
    phase: "settling" as const,
    axis: "none" as const,
    dragOffsetPx: 0,
    transitionId,
    gesture: null,
  };
}

/**
 * Pure mobile detail-sheet controller. Horizontal gestures are locked out so
 * the shelf can keep owning horizontal browsing; vertical gestures alone may
 * move the detail sheet by one adjacent state per settlement.
 */
export function bookShelfMobileDetailReducer(
  state: BookShelfMobileDetailState,
  action: BookShelfMobileDetailAction,
): BookShelfMobileDetailState {
  switch (action.type) {
    case "request-position":
      return requestPosition(state, action.position);

    case "set-reduced-motion":
      if (state.reducedMotion === action.value) return state;
      if (action.value && state.phase === "settling") {
        return {
          ...state,
          position: state.targetPosition,
          phase: "idle",
          axis: "none",
          dragOffsetPx: 0,
          reducedMotion: true,
          gesture: null,
        };
      }
      return { ...state, reducedMotion: action.value };

    case "drag-start": {
      if (!Number.isFinite(action.x) || !Number.isFinite(action.y)) return state;
      return {
        ...state,
        targetPosition: state.position,
        phase: "dragging",
        axis: "pending",
        dragOffsetPx: 0,
        gesture: {
          startX: action.x,
          startY: action.y,
          lastX: action.x,
          lastY: action.y,
        },
      };
    }

    case "drag-move": {
      if (
        state.phase !== "dragging" ||
        !state.gesture ||
        !Number.isFinite(action.x) ||
        !Number.isFinite(action.y)
      ) {
        return state;
      }
      const deltaX = action.x - state.gesture.startX;
      const deltaY = action.y - state.gesture.startY;
      const axis =
        state.axis === "pending"
          ? resolveBookShelfMobileDetailAxis(deltaX, deltaY)
          : state.axis;
      return {
        ...state,
        axis,
        dragOffsetPx:
          axis === "vertical"
            ? Math.max(-MAX_DRAG_OFFSET_PX, Math.min(MAX_DRAG_OFFSET_PX, deltaY))
            : 0,
        gesture: {
          ...state.gesture,
          lastX: action.x,
          lastY: action.y,
        },
      };
    }

    case "drag-end": {
      if (state.phase !== "dragging" || !state.gesture) return state;
      if (state.axis !== "vertical") {
        return {
          ...state,
          targetPosition: state.position,
          phase: "idle",
          axis: "none",
          dragOffsetPx: 0,
          gesture: null,
        };
      }
      const targetPosition = resolveBookShelfMobileDetailSettle({
        position: state.position,
        axis: state.axis,
        deltaY: state.gesture.lastY - state.gesture.startY,
        velocityY: action.velocityY,
      });
      const transitionId = state.transitionId + 1;
      if (state.reducedMotion) {
        return {
          ...state,
          position: targetPosition,
          targetPosition,
          phase: "idle",
          axis: "none",
          dragOffsetPx: 0,
          transitionId,
          gesture: null,
        };
      }
      return {
        ...state,
        targetPosition,
        phase: "settling",
        axis: "none",
        dragOffsetPx: 0,
        transitionId,
        gesture: null,
      };
    }

    case "drag-cancel":
      if (state.phase !== "dragging") return state;
      return state.reducedMotion || state.axis !== "vertical"
        ? {
            ...state,
            targetPosition: state.position,
            phase: "idle",
            axis: "none",
            dragOffsetPx: 0,
            gesture: null,
          }
        : {
            ...state,
            targetPosition: state.position,
            phase: "settling",
            axis: "none",
            dragOffsetPx: 0,
            transitionId: state.transitionId + 1,
            gesture: null,
          };

    case "settled":
      if (
        state.phase !== "settling" ||
        action.transitionId !== state.transitionId
      ) {
        return state;
      }
      return {
        ...state,
        position: state.targetPosition,
        phase: "idle",
        axis: "none",
        dragOffsetPx: 0,
        gesture: null,
      };
  }
}
