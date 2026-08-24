export type AtlasExperienceView = "embedded" | "immersive";

export type AtlasExperienceTransition =
  | "idle"
  | "preparing"
  | "entering"
  | "exiting";

export type AtlasExperienceEntrySource = "embedded" | "hero" | "url";

export type AtlasExperienceSheetState = "collapsed" | "half" | "expanded";

export interface AtlasExperienceState {
  view: AtlasExperienceView;
  transition: AtlasExperienceTransition;
  entrySource: AtlasExperienceEntrySource;
  searchOpen: boolean;
  filtersOpen: boolean;
  sheetState: AtlasExperienceSheetState;
  quiet: boolean;
}

export interface CreateAtlasExperienceStateOptions {
  view?: AtlasExperienceView;
  entrySource?: AtlasExperienceEntrySource;
  reducedMotion?: boolean;
}

export type AtlasExperienceEvent =
  | {
      type: "ENTER";
      source: AtlasExperienceEntrySource;
      reducedMotion?: boolean;
    }
  | { type: "PREPARED" }
  | { type: "TRANSITION_END" }
  | { type: "EXIT"; reducedMotion?: boolean }
  | {
      type: "SYNC_VIEW";
      view: AtlasExperienceView;
      source?: AtlasExperienceEntrySource;
      reducedMotion?: boolean;
    }
  | { type: "OPEN_SEARCH" }
  | { type: "CLOSE_SEARCH" }
  | { type: "TOGGLE_SEARCH" }
  | { type: "OPEN_FILTERS" }
  | { type: "CLOSE_FILTERS" }
  | { type: "TOGGLE_FILTERS" }
  | { type: "CLOSE_OVERLAYS" }
  | { type: "SET_SHEET_STATE"; sheetState: AtlasExperienceSheetState }
  | { type: "TOGGLE_SHEET" }
  | { type: "QUIET_TIMEOUT" }
  | { type: "ACTIVITY" }
  | { type: "ESCAPE"; reducedMotion?: boolean };

const EMBEDDED_IDLE_STATE: AtlasExperienceState = {
  view: "embedded",
  transition: "idle",
  entrySource: "embedded",
  searchOpen: false,
  filtersOpen: false,
  sheetState: "collapsed",
  quiet: false,
};

export function createAtlasExperienceState(
  options: CreateAtlasExperienceStateOptions = {}
): AtlasExperienceState {
  const view = options.view ?? "embedded";
  if (view === "embedded") return { ...EMBEDDED_IDLE_STATE };

  return {
    ...EMBEDDED_IDLE_STATE,
    view: "immersive",
    transition: options.reducedMotion ? "idle" : "entering",
    entrySource: options.entrySource ?? "url",
  };
}

function isImmersiveInteractive(state: AtlasExperienceState) {
  return state.view === "immersive" && state.transition !== "exiting";
}

function enterImmersive(
  state: AtlasExperienceState,
  source: AtlasExperienceEntrySource,
  reducedMotion = false
): AtlasExperienceState {
  if (state.view !== "embedded" || state.transition !== "idle") return state;

  if (reducedMotion) {
    return {
      ...state,
      view: "immersive",
      transition: "idle",
      entrySource: source,
      quiet: false,
    };
  }

  return {
    ...state,
    transition: "preparing",
    entrySource: source,
    quiet: false,
  };
}

function exitImmersive(
  state: AtlasExperienceState,
  reducedMotion = false
): AtlasExperienceState {
  if (state.view === "embedded") {
    if (state.transition === "preparing") return { ...EMBEDDED_IDLE_STATE };
    return state;
  }

  if (state.transition === "exiting") return state;
  if (reducedMotion) return { ...EMBEDDED_IDLE_STATE };

  return {
    ...state,
    transition: "exiting",
    searchOpen: false,
    filtersOpen: false,
    quiet: false,
  };
}

function syncView(
  state: AtlasExperienceState,
  view: AtlasExperienceView,
  source: AtlasExperienceEntrySource | undefined,
  reducedMotion = false
): AtlasExperienceState {
  if (view === "immersive") {
    if (state.view === "immersive" && state.transition !== "exiting") {
      return state;
    }

    return {
      ...EMBEDDED_IDLE_STATE,
      view: "immersive",
      transition: reducedMotion ? "idle" : "entering",
      entrySource: source ?? "url",
    };
  }

  if (state.view === "embedded") {
    if (state.transition === "preparing") return { ...EMBEDDED_IDLE_STATE };
    return state;
  }

  return exitImmersive(state, reducedMotion);
}

function toggleSearch(state: AtlasExperienceState) {
  if (!isImmersiveInteractive(state)) return state;
  if (state.searchOpen) return { ...state, searchOpen: false };
  return {
    ...state,
    searchOpen: true,
    filtersOpen: false,
    quiet: false,
  };
}

function toggleFilters(state: AtlasExperienceState) {
  if (!isImmersiveInteractive(state)) return state;
  if (state.filtersOpen) return { ...state, filtersOpen: false };
  return {
    ...state,
    searchOpen: false,
    filtersOpen: true,
    quiet: false,
  };
}

export function atlasExperienceReducer(
  state: AtlasExperienceState,
  event: AtlasExperienceEvent
): AtlasExperienceState {
  switch (event.type) {
    case "ENTER":
      return enterImmersive(state, event.source, event.reducedMotion);

    case "PREPARED":
      if (state.view !== "embedded" || state.transition !== "preparing") {
        return state;
      }
      return { ...state, view: "immersive", transition: "entering" };

    case "TRANSITION_END":
      if (state.transition === "entering") {
        return { ...state, transition: "idle" };
      }
      if (state.transition === "exiting") return { ...EMBEDDED_IDLE_STATE };
      return state;

    case "EXIT":
      return exitImmersive(state, event.reducedMotion);

    case "SYNC_VIEW":
      return syncView(state, event.view, event.source, event.reducedMotion);

    case "OPEN_SEARCH":
      if (!isImmersiveInteractive(state) || state.searchOpen) return state;
      return {
        ...state,
        searchOpen: true,
        filtersOpen: false,
        quiet: false,
      };

    case "CLOSE_SEARCH":
      if (!state.searchOpen) return state;
      return { ...state, searchOpen: false };

    case "TOGGLE_SEARCH":
      return toggleSearch(state);

    case "OPEN_FILTERS":
      if (!isImmersiveInteractive(state) || state.filtersOpen) return state;
      return {
        ...state,
        searchOpen: false,
        filtersOpen: true,
        quiet: false,
      };

    case "CLOSE_FILTERS":
      if (!state.filtersOpen) return state;
      return { ...state, filtersOpen: false };

    case "TOGGLE_FILTERS":
      return toggleFilters(state);

    case "CLOSE_OVERLAYS":
      if (!state.searchOpen && !state.filtersOpen) return state;
      return { ...state, searchOpen: false, filtersOpen: false };

    case "SET_SHEET_STATE":
      if (
        state.transition !== "idle" ||
        state.sheetState === event.sheetState
      ) {
        return state;
      }
      return { ...state, sheetState: event.sheetState, quiet: false };

    case "TOGGLE_SHEET":
      if (state.transition !== "idle") return state;
      return {
        ...state,
        sheetState:
          state.sheetState === "collapsed"
            ? "half"
            : state.sheetState === "half"
              ? "expanded"
              : "collapsed",
        quiet: false,
      };

    case "QUIET_TIMEOUT":
      if (
        state.view !== "immersive" ||
        state.transition !== "idle" ||
        state.searchOpen ||
        state.filtersOpen ||
        state.quiet
      ) {
        return state;
      }
      return { ...state, quiet: true };

    case "ACTIVITY":
      if (!state.quiet) return state;
      return { ...state, quiet: false };

    case "ESCAPE":
      if (state.searchOpen) return { ...state, searchOpen: false };
      if (state.filtersOpen) return { ...state, filtersOpen: false };
      return exitImmersive(state, event.reducedMotion);
  }
}
