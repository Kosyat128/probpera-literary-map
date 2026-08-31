import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  DEFAULT_GLOBE_EDITION_ID,
  parseStoredGlobeEdition,
  type GlobeEditionId,
} from "./globeEditions";

// Keep the established state-machine API names while its values now identify
// concrete editions rather than the former three generic surfaces.
type GlobeVisualStyle = GlobeEditionId;

export type GlobeStyleFailure = Readonly<{
  code: "texture-load-failed";
  style: GlobeVisualStyle;
  requestId: number;
  retryable: true;
}>;

export type GlobeStyleState = Readonly<{
  requestedStyle: GlobeVisualStyle;
  pendingStyle: GlobeVisualStyle | null;
  renderedStyle: GlobeVisualStyle;
  error: GlobeStyleFailure | null;
  requestId: number;
}>;

export type GlobeStyleAction =
  | Readonly<{
      type: "request";
      style: GlobeVisualStyle;
      requestId: number;
    }>
  | Readonly<{
      type: "resolve";
      style: GlobeVisualStyle;
      requestId: number;
    }>
  | Readonly<{
      type: "reject";
      style: GlobeVisualStyle;
      requestId: number;
    }>
  | Readonly<{
      type: "clear-error";
      requestId: number;
    }>;

export type GlobeStyleStatus =
  | Readonly<{
      kind: "idle";
      style: GlobeVisualStyle;
      role: null;
      live: "off";
      retryable: false;
    }>
  | Readonly<{
      kind: "loading";
      style: GlobeVisualStyle;
      role: "status";
      live: "polite";
      retryable: false;
    }>
  | Readonly<{
      kind: "error";
      style: GlobeVisualStyle;
      role: "alert";
      live: "assertive";
      retryable: true;
    }>;

export type GlobeStyleRequestToken = Readonly<{
  requestId: number;
  style: GlobeVisualStyle;
}>;

export type GlobeStyleRequestOutcome =
  | "committed"
  | "failed"
  | "stale"
  | "unchanged";

export type ExecuteGlobeStyleRequestOptions = Readonly<{
  token: GlobeStyleRequestToken;
  applyStyle: (style: GlobeVisualStyle) => Promise<void>;
  isLatest: (token: GlobeStyleRequestToken) => boolean;
  onResolve: (token: GlobeStyleRequestToken) => void;
  onReject: (token: GlobeStyleRequestToken) => void;
  onCommit?: (style: GlobeVisualStyle) => void;
}>;

export type UseGlobeStyleStateOptions = Readonly<{
  /** Invalid or absent stored values fall back to Rand McNally 1887. */
  initialStyle?: unknown;
  applyStyle: (style: GlobeVisualStyle) => Promise<void>;
  /** Called only after the latest request has rendered successfully. */
  onCommit?: (style: GlobeVisualStyle) => void;
}>;

export type GlobeStyleRequestOptions = Readonly<{
  /** Re-applies the rendered style, for example after a locale change. */
  force?: boolean;
}>;

export type UseGlobeStyleStateResult = Readonly<{
  state: GlobeStyleState;
  requestedStyle: GlobeVisualStyle;
  pendingStyle: GlobeVisualStyle | null;
  renderedStyle: GlobeVisualStyle;
  error: GlobeStyleFailure | null;
  status: GlobeStyleStatus;
  requestStyle: (
    style: GlobeVisualStyle,
    options?: GlobeStyleRequestOptions
  ) => Promise<GlobeStyleRequestOutcome>;
  retryStyle: () => Promise<GlobeStyleRequestOutcome>;
  clearError: () => void;
  /** Use this value for both `aria-pressed` and the visual active class. */
  ariaPressedFor: (style: GlobeVisualStyle) => boolean;
}>;

export function resolveInitialGlobeStyle(value: unknown): GlobeVisualStyle {
  return parseStoredGlobeEdition(value);
}

export function createInitialGlobeStyleState(
  initialStyle: unknown = DEFAULT_GLOBE_EDITION_ID
): GlobeStyleState {
  const style = resolveInitialGlobeStyle(initialStyle);
  return {
    requestedStyle: style,
    pendingStyle: null,
    renderedStyle: style,
    error: null,
    requestId: 0,
  };
}

/**
 * Pure state transition used by the hook and unit tests. A settlement from an
 * older request is ignored, so a slow texture can never replace a newer choice.
 */
export function globeStyleStateReducer(
  state: GlobeStyleState,
  action: GlobeStyleAction
): GlobeStyleState {
  if (action.type === "request") {
    if (action.requestId <= state.requestId) return state;
    return {
      ...state,
      requestedStyle: action.style,
      pendingStyle: action.style,
      error: null,
      requestId: action.requestId,
    };
  }

  if (action.requestId !== state.requestId) return state;

  if (action.type === "resolve") {
    // The token style is checked as well as the id so malformed external
    // actions cannot mark a texture other than the requested one as rendered.
    if (action.style !== state.requestedStyle) return state;
    return {
      ...state,
      pendingStyle: null,
      renderedStyle: action.style,
      error: null,
    };
  }

  if (action.type === "reject") {
    if (action.style !== state.requestedStyle) return state;
    return {
      ...state,
      pendingStyle: null,
      error: {
        code: "texture-load-failed",
        style: action.style,
        requestId: action.requestId,
        retryable: true,
      },
    };
  }

  return state.error ? { ...state, error: null } : state;
}

/**
 * Returns semantic live-region data only. The view supplies translated copy,
 * and caught exception text is intentionally never exposed to visitors.
 */
export function describeGlobeStyleStatus(
  state: GlobeStyleState
): GlobeStyleStatus {
  if (state.pendingStyle) {
    return {
      kind: "loading",
      style: state.pendingStyle,
      role: "status",
      live: "polite",
      retryable: false,
    };
  }

  if (state.error) {
    return {
      kind: "error",
      style: state.error.style,
      role: "alert",
      live: "assertive",
      retryable: true,
    };
  }

  return {
    kind: "idle",
    style: state.renderedStyle,
    role: null,
    live: "off",
    retryable: false,
  };
}

export function isGlobeStyleRendered(
  state: Pick<GlobeStyleState, "renderedStyle">,
  style: GlobeVisualStyle
) {
  return state.renderedStyle === style;
}

/**
 * Executes one request without leaking failures. Only the latest token may
 * settle UI state or persistence, while every newer request remains usable.
 */
export async function executeGlobeStyleRequest({
  token,
  applyStyle,
  isLatest,
  onResolve,
  onReject,
  onCommit,
}: ExecuteGlobeStyleRequestOptions): Promise<GlobeStyleRequestOutcome> {
  try {
    await applyStyle(token.style);
  } catch {
    if (!isLatest(token)) return "stale";
    onReject(token);
    return "failed";
  }

  if (!isLatest(token)) return "stale";
  onResolve(token);

  // Persistence is best-effort and is deliberately downstream of a rendered
  // success. Storage restrictions must not turn a valid texture into an error.
  try {
    onCommit?.(token.style);
  } catch {
    // The successful in-session render remains authoritative.
  }
  return "committed";
}

export function useGlobeStyleState({
  initialStyle,
  applyStyle,
  onCommit,
}: UseGlobeStyleStateOptions): UseGlobeStyleStateResult {
  const initialStateRef = useRef<GlobeStyleState | null>(null);
  if (!initialStateRef.current) {
    initialStateRef.current = createInitialGlobeStyleState(initialStyle);
  }

  const [state, dispatch] = useReducer(
    globeStyleStateReducer,
    initialStateRef.current
  );
  const stateRef = useRef(state);
  const requestIdRef = useRef(state.requestId);
  const mountedRef = useRef(true);
  const applyStyleRef = useRef(applyStyle);
  const onCommitRef = useRef(onCommit);

  // Latest callbacks are read at request time without forcing the public
  // handlers to change identity on every parent render.
  applyStyleRef.current = applyStyle;
  onCommitRef.current = onCommit;

  const transition = useCallback((action: GlobeStyleAction) => {
    stateRef.current = globeStyleStateReducer(stateRef.current, action);
    dispatch(action);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const requestStyle = useCallback(
    async (
      style: GlobeVisualStyle,
      options: GlobeStyleRequestOptions = {}
    ): Promise<GlobeStyleRequestOutcome> => {
      const current = stateRef.current;
      if (
        !options.force &&
        current.pendingStyle === null &&
        current.error === null &&
        current.requestedStyle === style &&
        current.renderedStyle === style
      ) {
        return "unchanged";
      }

      const token: GlobeStyleRequestToken = {
        requestId: ++requestIdRef.current,
        style,
      };
      transition({ type: "request", ...token });

      return executeGlobeStyleRequest({
        token,
        applyStyle: applyStyleRef.current,
        isLatest: (candidate) =>
          mountedRef.current && candidate.requestId === requestIdRef.current,
        onResolve: (candidate) =>
          transition({ type: "resolve", ...candidate }),
        onReject: (candidate) =>
          transition({ type: "reject", ...candidate }),
        onCommit: (committedStyle) => onCommitRef.current?.(committedStyle),
      });
    },
    [transition]
  );

  const retryStyle = useCallback(() => {
    const failedStyle = stateRef.current.error?.style;
    return failedStyle
      ? requestStyle(failedStyle, { force: true })
      : Promise.resolve<GlobeStyleRequestOutcome>("unchanged");
  }, [requestStyle]);

  const clearError = useCallback(() => {
    transition({ type: "clear-error", requestId: stateRef.current.requestId });
  }, [transition]);

  const ariaPressedFor = useCallback(
    (style: GlobeVisualStyle) => isGlobeStyleRendered(state, style),
    [state]
  );

  return {
    state,
    requestedStyle: state.requestedStyle,
    pendingStyle: state.pendingStyle,
    renderedStyle: state.renderedStyle,
    error: state.error,
    status: describeGlobeStyleStatus(state),
    requestStyle,
    retryStyle,
    clearError,
    ariaPressedFor,
  };
}
