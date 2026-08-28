export const BOOK_SHELF_PHASES = [
  "SHELF_IDLE",
  "SHELF_MOVING",
  "SHELF_SETTLING",
  "INSPECTION_ENTERING",
  "INSPECTION_CLOSED",
  "COVER_CRACKED",
  "COVER_OPENING",
  "BOOK_OPEN",
  "PAGE_DRAGGING",
  "PAGE_SETTLING",
  "INSPECTION_CLOSING",
  "SHELF_RESTORING",
  "ERROR_FALLBACK",
] as const;

export type BookShelfPhase = (typeof BOOK_SHELF_PHASES)[number];
export type BookShelfViewMode = "shelf" | "catalog";

export type BookShelfFailureCode =
  | "webgl-unavailable"
  | "transition-failed";

export type BookShelfFailure = Readonly<{
  code: BookShelfFailureCode;
  requestId: number;
  retryable: boolean;
}>;

export type BookShelfState = Readonly<{
  phase: BookShelfPhase;
  requestId: number;
  requestedViewMode: BookShelfViewMode;
  effectiveViewMode: BookShelfViewMode;
  error: BookShelfFailure | null;
}>;

export type BookShelfAction =
  | Readonly<{
      type: "set-view-mode";
      viewMode: BookShelfViewMode;
    }>
  | Readonly<{
      type: "request-focus";
      requestId: number;
    }>
  | Readonly<{
      type: "motion-reached";
      requestId: number;
    }>
  | Readonly<{
      type: "motion-settled";
      requestId: number;
    }>
  | Readonly<{
      type: "request-inspection";
      requestId: number;
    }>
  | Readonly<{
      type: "inspection-entered";
      requestId: number;
    }>
  | Readonly<{
      type: "crack-cover";
      requestId: number;
    }>
  | Readonly<{
      type: "request-cover-open";
      requestId: number;
    }>
  | Readonly<{
      type: "cover-opened";
      requestId: number;
    }>
  | Readonly<{
      type: "start-page-drag";
      requestId: number;
    }>
  | Readonly<{
      type: "request-page-settle";
      requestId: number;
    }>
  | Readonly<{
      type: "page-settled";
      requestId: number;
    }>
  | Readonly<{
      type: "request-inspection-close";
      requestId: number;
    }>
  | Readonly<{
      type: "inspection-closed";
      requestId: number;
    }>
  | Readonly<{
      type: "shelf-restored";
      requestId: number;
    }>
  | Readonly<{
      type: "fail";
      requestId: number;
      code: BookShelfFailureCode;
    }>
  | Readonly<{
      type: "recover";
      requestId: number;
    }>;

const shelfMotionPhases = new Set<BookShelfPhase>([
  "SHELF_IDLE",
  "SHELF_MOVING",
  "SHELF_SETTLING",
  "SHELF_RESTORING",
]);

const inspectionPhases = new Set<BookShelfPhase>([
  "INSPECTION_ENTERING",
  "INSPECTION_CLOSED",
  "COVER_CRACKED",
  "COVER_OPENING",
  "BOOK_OPEN",
  "PAGE_DRAGGING",
  "PAGE_SETTLING",
]);

export function createInitialBookShelfState(
  viewMode: BookShelfViewMode = "shelf"
): BookShelfState {
  return {
    phase: "SHELF_IDLE",
    requestId: 0,
    requestedViewMode: viewMode,
    effectiveViewMode: viewMode,
    error: null,
  };
}

function beginTransition(
  state: BookShelfState,
  requestId: number,
  phase: BookShelfPhase
) {
  if (
    requestId <= state.requestId ||
    state.effectiveViewMode !== "shelf" ||
    state.phase === "ERROR_FALLBACK"
  ) {
    return state;
  }
  return {
    ...state,
    phase,
    requestId,
    error: null,
  };
}

function settleTransition(
  state: BookShelfState,
  requestId: number,
  expected: BookShelfPhase,
  phase: BookShelfPhase
) {
  if (requestId !== state.requestId || state.phase !== expected) return state;
  return { ...state, phase };
}

/**
 * Pure controller-owned transition reducer. Canvas may report settlements,
 * but an older or phase-mismatched report can never commit visual state.
 */
export function bookShelfStateReducer(
  state: BookShelfState,
  action: BookShelfAction
): BookShelfState {
  switch (action.type) {
    case "set-view-mode": {
      if (action.viewMode === state.requestedViewMode) return state;
      if (action.viewMode === "catalog") {
        return {
          ...state,
          requestedViewMode: "catalog",
          effectiveViewMode: "catalog",
          phase:
            state.phase === "ERROR_FALLBACK" ? "ERROR_FALLBACK" : "SHELF_IDLE",
        };
      }
      return {
        ...state,
        requestedViewMode: "shelf",
        effectiveViewMode: state.error ? "catalog" : "shelf",
      };
    }

    case "request-focus":
      return shelfMotionPhases.has(state.phase)
        ? beginTransition(state, action.requestId, "SHELF_MOVING")
        : state;

    case "motion-reached":
      return settleTransition(
        state,
        action.requestId,
        "SHELF_MOVING",
        "SHELF_SETTLING"
      );

    case "motion-settled":
      return settleTransition(
        state,
        action.requestId,
        "SHELF_SETTLING",
        "SHELF_IDLE"
      );

    case "request-inspection":
      return state.phase === "SHELF_IDLE"
        ? beginTransition(state, action.requestId, "INSPECTION_ENTERING")
        : state;

    case "inspection-entered":
      return settleTransition(
        state,
        action.requestId,
        "INSPECTION_ENTERING",
        "INSPECTION_CLOSED"
      );

    case "crack-cover":
      return state.phase === "INSPECTION_CLOSED"
        ? beginTransition(state, action.requestId, "COVER_CRACKED")
        : state;

    case "request-cover-open":
      return state.phase === "INSPECTION_CLOSED" ||
        state.phase === "COVER_CRACKED"
        ? beginTransition(state, action.requestId, "COVER_OPENING")
        : state;

    case "cover-opened":
      return settleTransition(
        state,
        action.requestId,
        "COVER_OPENING",
        "BOOK_OPEN"
      );

    case "start-page-drag":
      return state.phase === "BOOK_OPEN" || state.phase === "PAGE_SETTLING"
        ? beginTransition(state, action.requestId, "PAGE_DRAGGING")
        : state;

    case "request-page-settle":
      return state.phase === "PAGE_DRAGGING"
        ? beginTransition(state, action.requestId, "PAGE_SETTLING")
        : state;

    case "page-settled":
      return settleTransition(
        state,
        action.requestId,
        "PAGE_SETTLING",
        "BOOK_OPEN"
      );

    case "request-inspection-close":
      return inspectionPhases.has(state.phase)
        ? beginTransition(state, action.requestId, "INSPECTION_CLOSING")
        : state;

    case "inspection-closed":
      return settleTransition(
        state,
        action.requestId,
        "INSPECTION_CLOSING",
        "SHELF_RESTORING"
      );

    case "shelf-restored":
      return settleTransition(
        state,
        action.requestId,
        "SHELF_RESTORING",
        "SHELF_IDLE"
      );

    case "fail":
      if (action.requestId < state.requestId) return state;
      return {
        ...state,
        phase: "ERROR_FALLBACK",
        requestId: action.requestId,
        effectiveViewMode: "catalog",
        error: {
          code: action.code,
          requestId: action.requestId,
          retryable: true,
        },
      };

    case "recover":
      if (
        state.phase !== "ERROR_FALLBACK" ||
        action.requestId <= state.requestId
      ) {
        return state;
      }
      return {
        ...state,
        phase: "SHELF_IDLE",
        requestId: action.requestId,
        effectiveViewMode: state.requestedViewMode,
        error: null,
      };
  }
}

export type BookShelfTransitionToken = Readonly<{
  requestId: number;
  signal: AbortSignal;
}>;

export type BookShelfTransitionCoordinator = Readonly<{
  begin: () => BookShelfTransitionToken;
  isLatest: (token: BookShelfTransitionToken) => boolean;
  finish: (token: BookShelfTransitionToken) => boolean;
  cancel: () => void;
  dispose: () => void;
}>;

/**
 * Issues one AbortSignal per transition. Starting a newer transition aborts
 * the previous signal; dispose makes every outstanding callback permanently
 * stale and releases the active controller.
 */
export function createBookShelfTransitionCoordinator(
  initialRequestId = 0
): BookShelfTransitionCoordinator {
  let requestId = Math.max(0, Math.trunc(initialRequestId));
  let active:
    | {
        token: BookShelfTransitionToken;
        controller: AbortController;
      }
    | undefined;
  let disposed = false;

  const cancel = () => {
    if (!active) return;
    active.controller.abort();
    active = undefined;
  };

  return {
    begin() {
      if (disposed) {
        throw new Error("BookShelf transition coordinator is disposed");
      }
      cancel();
      const controller = new AbortController();
      const token = Object.freeze({
        requestId: ++requestId,
        signal: controller.signal,
      });
      active = { token, controller };
      return token;
    },
    isLatest(token) {
      return (
        !disposed &&
        active?.token.requestId === token.requestId &&
        active.token.signal === token.signal &&
        !token.signal.aborted
      );
    },
    finish(token) {
      if (
        disposed ||
        active?.token.requestId !== token.requestId ||
        active.token.signal !== token.signal ||
        token.signal.aborted
      ) {
        return false;
      }
      active = undefined;
      return true;
    },
    cancel,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
    },
  };
}

export type BookShelfTransitionOutcome =
  | "committed"
  | "cancelled"
  | "stale"
  | "failed";

export type ExecuteBookShelfTransitionOptions = Readonly<{
  token: BookShelfTransitionToken;
  run: (signal: AbortSignal) => Promise<void>;
  isLatest: (token: BookShelfTransitionToken) => boolean;
  onResolve: (token: BookShelfTransitionToken) => void;
  onReject: (token: BookShelfTransitionToken) => void;
  onCleanup?: (token: BookShelfTransitionToken) => void;
}>;

/**
 * Executes an animation/load without exposing caught errors. Resolution and
 * rejection callbacks are latest-only; cleanup is best-effort and runs once.
 */
export async function executeBookShelfTransition({
  token,
  run,
  isLatest,
  onResolve,
  onReject,
  onCleanup,
}: ExecuteBookShelfTransitionOptions): Promise<BookShelfTransitionOutcome> {
  let outcome: BookShelfTransitionOutcome;
  try {
    await run(token.signal);
    if (token.signal.aborted) {
      outcome = "cancelled";
    } else if (!isLatest(token)) {
      outcome = "stale";
    } else {
      onResolve(token);
      outcome = "committed";
    }
  } catch {
    if (token.signal.aborted) {
      outcome = "cancelled";
    } else if (!isLatest(token)) {
      outcome = "stale";
    } else {
      onReject(token);
      outcome = "failed";
    }
  } finally {
    try {
      onCleanup?.(token);
    } catch {
      // Cleanup errors cannot resurrect or replace a completed transition.
    }
  }
  return outcome;
}
