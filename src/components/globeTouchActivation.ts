export type GlobeTouchView = "embedded" | "immersive";

export type GlobePrimaryPointer = "coarse" | "fine";

export type GlobeTouchEnvironment = Readonly<{
  view: GlobeTouchView;
  pointer: GlobePrimaryPointer;
  reducedMotion: boolean;
  globeVisible: boolean;
}>;

export type GlobeTouchActivationState = GlobeTouchEnvironment &
  Readonly<{
    /** User-owned full-control request for the embedded coarse-pointer view. */
    embeddedControlRequested: boolean;
  }>;

export type GlobeTouchActivationEvent =
  | { type: "ACTIVATE" }
  | { type: "DEACTIVATE" }
  | { type: "ESCAPE" }
  | {
      type: "SYNC_ENVIRONMENT";
      environment: GlobeTouchEnvironment;
    };

export type GlobeTouchInteractionMode =
  | "page-pan"
  | "globe-control"
  | "suspended";

export type GlobeTouchActivationPolicy = Readonly<{
  mode: GlobeTouchInteractionMode;
  controlsEnabled: boolean;
  capturesTouch: boolean;
  touchAction: "pan-y pinch-zoom" | "none";
  activationControl: "activate" | "deactivate" | null;
  escapeDeactivates: boolean;
  reducedMotion: boolean;
}>;

export function createGlobeTouchActivationState(
  environment: GlobeTouchEnvironment
): GlobeTouchActivationState {
  return {
    ...environment,
    embeddedControlRequested: false,
  };
}

function canRequestEmbeddedControl(state: GlobeTouchActivationState) {
  return (
    state.globeVisible &&
    state.view === "embedded" &&
    state.pointer === "coarse"
  );
}

function sameEnvironment(
  state: GlobeTouchActivationState,
  environment: GlobeTouchEnvironment
) {
  return (
    state.view === environment.view &&
    state.pointer === environment.pointer &&
    state.reducedMotion === environment.reducedMotion &&
    state.globeVisible === environment.globeVisible
  );
}

/**
 * Explicit embedded control is intentionally session-like. It survives a
 * reduced-motion preference update, but is cleared when the input modality,
 * view, or visibility changes so a returning page can never become a trap.
 */
function syncGlobeTouchEnvironment(
  state: GlobeTouchActivationState,
  environment: GlobeTouchEnvironment
): GlobeTouchActivationState {
  if (sameEnvironment(state, environment)) return state;

  const embeddedControlRequested =
    state.embeddedControlRequested &&
    state.view === environment.view &&
    state.pointer === environment.pointer &&
    environment.view === "embedded" &&
    environment.pointer === "coarse" &&
    environment.globeVisible;

  return {
    ...environment,
    embeddedControlRequested,
  };
}

export function globeTouchActivationReducer(
  state: GlobeTouchActivationState,
  event: GlobeTouchActivationEvent
): GlobeTouchActivationState {
  switch (event.type) {
    case "ACTIVATE":
      if (!canRequestEmbeddedControl(state) || state.embeddedControlRequested) {
        return state;
      }
      return { ...state, embeddedControlRequested: true };

    case "DEACTIVATE":
    case "ESCAPE":
      if (!state.embeddedControlRequested) return state;
      return { ...state, embeddedControlRequested: false };

    case "SYNC_ENVIRONMENT":
      return syncGlobeTouchEnvironment(state, event.environment);
  }
}

/** Call before the immersive Escape handler; true means this layer owns it. */
export function shouldGlobeTouchConsumeEscape(
  state: GlobeTouchActivationState
) {
  return canRequestEmbeddedControl(state) && state.embeddedControlRequested;
}

/**
 * Maps state to the small set of values needed by the canvas, OrbitControls,
 * and the explicit mobile activation button.
 */
export function resolveGlobeTouchActivationPolicy(
  state: GlobeTouchActivationState
): GlobeTouchActivationPolicy {
  if (!state.globeVisible) {
    return {
      mode: "suspended",
      controlsEnabled: false,
      capturesTouch: false,
      touchAction: "pan-y pinch-zoom",
      activationControl: null,
      escapeDeactivates: false,
      reducedMotion: state.reducedMotion,
    };
  }

  const coarseEmbedded =
    state.view === "embedded" && state.pointer === "coarse";
  const controlsEnabled =
    !coarseEmbedded || state.embeddedControlRequested;

  return {
    mode: controlsEnabled ? "globe-control" : "page-pan",
    controlsEnabled,
    capturesTouch: controlsEnabled,
    touchAction: controlsEnabled ? "none" : "pan-y pinch-zoom",
    activationControl: coarseEmbedded
      ? state.embeddedControlRequested
        ? "deactivate"
        : "activate"
      : null,
    escapeDeactivates: shouldGlobeTouchConsumeEscape(state),
    reducedMotion: state.reducedMotion,
  };
}
