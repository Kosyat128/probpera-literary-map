import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
} from "react";

import {
  atlasExperienceReducer,
  createAtlasExperienceState,
  type AtlasExperienceEntrySource,
  type AtlasExperienceEvent,
  type AtlasExperienceState,
} from "./atlasExperienceState";
import {
  commitAtlasUrlState,
  readAtlasImmersiveHistoryMarker,
  readAtlasUrlState,
  withAtlasUrlState,
  withAtlasImmersiveHistoryMarker,
  withoutAtlasImmersiveHistoryMarker,
  type AtlasUrlState,
} from "../utils/atlasUrlState";

export type AtlasExperienceExitReason =
  | "close-button"
  | "escape"
  | "history"
  | "programmatic";

export type AtlasExperienceUrlSelection = Omit<AtlasUrlState, "view">;

export interface UseAtlasExperienceOptions {
  economical?: boolean;
  reducedMotion?: boolean;
  urlSelection?: AtlasExperienceUrlSelection;
  quietDelayMs?: number;
  transitionDurationMs?: number;
  directTransitionDurationMs?: number;
  onUrlStateChange?: (state: AtlasUrlState) => void;
}

export interface AtlasExperienceController {
  state: AtlasExperienceState;
  dispatch: Dispatch<AtlasExperienceEvent>;
  experienceRef: RefObject<HTMLDivElement>;
  surfaceRef: RefObject<HTMLDivElement>;
  stageRef: RefObject<HTMLElement>;
  placeholderRef: RefObject<HTMLDivElement>;
  closeButtonRef: RefObject<HTMLButtonElement>;
  searchButtonRef: RefObject<HTMLButtonElement>;
  filtersButtonRef: RefObject<HTMLButtonElement>;
  launchButtonRef: RefObject<HTMLButtonElement>;
  reducedMotion: boolean;
  economical: boolean;
  proximityEnabled: boolean;
  compactSheet: boolean;
  enter: (
    source: AtlasExperienceEntrySource,
    opener?: HTMLElement | null
  ) => void;
  requestExit: (reason?: AtlasExperienceExitReason) => void;
  syncFromUrl: () => AtlasUrlState;
  notifyActivity: () => void;
  commitUrlSelection: (
    selection: AtlasExperienceUrlSelection,
    embeddedMode?: "push" | "replace"
  ) => boolean;
}

type AttributeSnapshot = {
  element: Element;
  ariaHidden: string | null;
  inert: boolean;
};

type ModalAttributeSnapshot = {
  role: string | null;
  ariaModal: string | null;
  tabIndex: string | null;
};

type PlaceholderSnapshot = {
  element: HTMLDivElement;
  height: string;
  active: string | null;
};

type SurfaceVariableSnapshot = {
  element: HTMLDivElement;
  values: Map<string, string>;
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const PROXIMITY_CONTROL_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[data-atlas-control]",
].join(",");

const SURFACE_ORIGIN_VARIABLES = [
  "--atlas-origin-left",
  "--atlas-origin-top",
  "--atlas-origin-width",
  "--atlas-origin-height",
  "--atlas-origin-center-x",
  "--atlas-origin-center-y",
] as const;

function canUseDom() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readReducedMotion() {
  return (
    canUseDom() &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function readEconomicalMode() {
  if (!canUseDom()) return false;
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  return Boolean(
    connection?.saveData ||
      (deviceMemory !== undefined && deviceMemory <= 4) ||
      navigator.hardwareConcurrency <= 4 ||
      window.devicePixelRatio >= 2.5 ||
      window.innerWidth <= 680
  );
}

function useMediaQuery(query: string, initialValue: boolean) {
  const [matches, setMatches] = useState(() => {
    if (!canUseDom() || !window.matchMedia) return initialValue;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [query]);

  return matches;
}

function useDetectedEconomicalMode() {
  const [economical, setEconomical] = useState(readEconomicalMode);

  useEffect(() => {
    const update = () => setEconomical(readEconomicalMode());
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  return economical;
}

function isFocusable(element: HTMLElement) {
  const style = canUseDom() ? window.getComputedStyle(element) : null;
  return (
    !element.hasAttribute("disabled") &&
    element.getAttribute("aria-hidden") !== "true" &&
    !element.closest('[aria-hidden="true"]') &&
    !element.closest("[inert]") &&
    !element.hidden &&
    style?.display !== "none" &&
    style?.visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

function focusableElements(surface: HTMLElement) {
  return [...surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    isFocusable
  );
}

function hideOutsideModal(surface: HTMLElement) {
  const snapshots: AttributeSnapshot[] = [];
  let branch: Element | null = surface;

  while (branch && branch !== document.body) {
    const parent: Element | null = branch.parentElement;
    if (!parent) break;
    for (const sibling of parent.children) {
      if (sibling === branch) continue;
      snapshots.push({
        element: sibling,
        ariaHidden: sibling.getAttribute("aria-hidden"),
        inert: sibling.hasAttribute("inert"),
      });
      sibling.setAttribute("aria-hidden", "true");
      sibling.setAttribute("inert", "");
    }
    branch = parent;
  }

  return () => {
    for (const snapshot of snapshots.reverse()) {
      if (snapshot.ariaHidden === null) {
        snapshot.element.removeAttribute("aria-hidden");
      } else {
        snapshot.element.setAttribute("aria-hidden", snapshot.ariaHidden);
      }
      if (!snapshot.inert) snapshot.element.removeAttribute("inert");
    }
  };
}

/**
 * Owns the Literary Planet interaction lifecycle while leaving the atlas tree in
 * its original React position. The caller must keep one mounted globe subtree,
 * attach `experienceRef` to the flow container, `surfaceRef` to its fixed-capable
 * surface, `placeholderRef` to the surface's flow placeholder, and `stageRef` to
 * `LiteraryWorldMap.rootRef`. Render from `state` and call `syncFromUrl()` from
 * the application's single `popstate` handler. No fullscreen API, portal,
 * identity-changing key, reparenting, or duplicate canvas is used here.
 */
export function useAtlasExperience(
  options: UseAtlasExperienceOptions = {}
): AtlasExperienceController {
  const detectedReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
    readReducedMotion()
  );
  const detectedEconomical = useDetectedEconomicalMode();
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)", false);
  const compactSheet = useMediaQuery("(max-width: 980px)", false);
  const reducedMotion = options.reducedMotion ?? detectedReducedMotion;
  const economical = options.economical ?? detectedEconomical;
  const proximityEnabled = finePointer && !reducedMotion && !economical;

  const experienceRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const launchButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const quietTimerRef = useRef<number | null>(null);
  const historyFallbackTimerRef = useRef<number | null>(null);
  const enterInFlightRef = useRef(false);
  const exitInFlightRef = useRef(false);
  const placeholderSnapshotRef = useRef<PlaceholderSnapshot | null>(null);
  const surfaceVariableSnapshotRef =
    useRef<SurfaceVariableSnapshot | null>(null);

  const [state, dispatch] = useReducer(
    atlasExperienceReducer,
    undefined,
    () => {
      const urlState = readAtlasUrlState();
      const marker = canUseDom()
        ? readAtlasImmersiveHistoryMarker(window.history.state)
        : null;
      return createAtlasExperienceState({
        view: urlState.view,
        entrySource:
          urlState.view === "immersive"
            ? marker?.source ?? "url"
            : "embedded",
        reducedMotion,
      });
    }
  );

  const stateRef = useRef(state);
  const reducedMotionRef = useRef(reducedMotion);
  const economicalRef = useRef(economical);
  const selectionRef = useRef(options.urlSelection);
  const onUrlStateChangeRef = useRef(options.onUrlStateChange);
  const quietDelayRef = useRef(options.quietDelayMs ?? 2500);
  const transitionDurationRef = useRef(options.transitionDurationMs ?? 440);
  const directTransitionDurationRef = useRef(
    options.directTransitionDurationMs ?? 180
  );

  stateRef.current = state;
  reducedMotionRef.current = reducedMotion;
  economicalRef.current = economical;
  selectionRef.current = options.urlSelection;
  onUrlStateChangeRef.current = options.onUrlStateChange;
  quietDelayRef.current = options.quietDelayMs ?? 2500;
  transitionDurationRef.current = options.transitionDurationMs ?? 440;
  directTransitionDurationRef.current =
    options.directTransitionDurationMs ?? 180;

  const clearQuietTimer = useCallback(() => {
    if (quietTimerRef.current === null || !canUseDom()) return;
    window.clearTimeout(quietTimerRef.current);
    quietTimerRef.current = null;
  }, []);

  const armQuietTimer = useCallback(() => {
    clearQuietTimer();
    if (!canUseDom()) return;
    const current = stateRef.current;
    if (
      current.view !== "immersive" ||
      current.transition !== "idle" ||
      current.searchOpen ||
      current.filtersOpen
    ) {
      return;
    }
    quietTimerRef.current = window.setTimeout(() => {
      quietTimerRef.current = null;
      dispatch({ type: "QUIET_TIMEOUT" });
    }, quietDelayRef.current);
  }, [clearQuietTimer]);

  const notifyActivity = useCallback(() => {
    const current = stateRef.current;
    if (current.view !== "immersive" || current.transition === "exiting") {
      return;
    }
    if (current.quiet) dispatch({ type: "ACTIVITY" });
    armQuietTimer();
  }, [armQuietTimer]);

  const currentUrlState = useCallback((): AtlasUrlState => {
    const urlState = readAtlasUrlState();
    const selection = selectionRef.current;
    return selection ? { ...selection, view: urlState.view } : urlState;
  }, []);

  const replaceWithoutImmersiveMarker = useCallback(
    (next: AtlasUrlState, ensureAtlasHash = false) => {
      if (!canUseDom()) return false;
      const historyState = withoutAtlasImmersiveHistoryMarker(
        window.history.state
      );
      const current = new URL(window.location.href);
      const nextUrl = withAtlasUrlState(current, next);
      if (ensureAtlasHash) nextUrl.hash = "atlas";
      const currentRelative = `${current.pathname}${current.search}${current.hash}`;
      const nextRelative = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      const changed = currentRelative !== nextRelative;
      window.history.replaceState(
        historyState,
        "",
        changed ? nextRelative : currentRelative
      );
      return changed;
    },
    []
  );

  const writeSurfaceOrigin = useCallback((rect: DOMRect) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    surface.style.setProperty("--atlas-origin-left", `${rect.left}px`);
    surface.style.setProperty("--atlas-origin-top", `${rect.top}px`);
    surface.style.setProperty("--atlas-origin-width", `${rect.width}px`);
    surface.style.setProperty("--atlas-origin-height", `${rect.height}px`);
    surface.style.setProperty(
      "--atlas-origin-center-x",
      `${rect.left + rect.width / 2}px`
    );
    surface.style.setProperty(
      "--atlas-origin-center-y",
      `${rect.top + rect.height / 2}px`
    );
  }, []);

  const snapshotSurfaceVariables = useCallback(() => {
    const surface = surfaceRef.current;
    if (!surface || surfaceVariableSnapshotRef.current) return;
    surfaceVariableSnapshotRef.current = {
      element: surface,
      values: new Map(
        SURFACE_ORIGIN_VARIABLES.map((name) => [
          name,
          surface.style.getPropertyValue(name),
        ])
      ),
    };
  }, []);

  const measureEmbeddedGeometry = useCallback(() => {
    const anchor = experienceRef.current ?? surfaceRef.current;
    const surface = surfaceRef.current;
    if (!anchor || !surface) return null;

    const previousView = surface.getAttribute("data-atlas-view");
    const previousTransition = surface.getAttribute("data-atlas-transition");
    surface.setAttribute("data-atlas-view", "embedded");
    surface.setAttribute("data-atlas-transition", "idle");
    const rect = anchor.getBoundingClientRect();
    if (previousView === null) surface.removeAttribute("data-atlas-view");
    else surface.setAttribute("data-atlas-view", previousView);
    if (previousTransition === null) {
      surface.removeAttribute("data-atlas-transition");
    } else {
      surface.setAttribute("data-atlas-transition", previousTransition);
    }
    return rect;
  }, []);

  const captureEmbeddedGeometry = useCallback(() => {
    if (!canUseDom()) return;
    const rect = measureEmbeddedGeometry();
    if (!rect) return;

    snapshotSurfaceVariables();
    writeSurfaceOrigin(rect);

    const placeholder = placeholderRef.current;
    if (placeholder && !placeholderSnapshotRef.current) {
      placeholderSnapshotRef.current = {
        element: placeholder,
        height: placeholder.style.height,
        active: placeholder.getAttribute("data-atlas-placeholder-active"),
      };
      placeholder.style.height = `${Math.max(1, rect.height)}px`;
      placeholder.setAttribute("data-atlas-placeholder-active", "true");
    }
  }, [measureEmbeddedGeometry, snapshotSurfaceVariables, writeSurfaceOrigin]);

  const refreshExitGeometry = useCallback(() => {
    if (!canUseDom()) return;
    const placeholder = placeholderRef.current;
    if (!placeholder) return;
    const rect = measureEmbeddedGeometry();
    if (!rect) return;
    if (!rect.width || !rect.height) return;
    snapshotSurfaceVariables();
    writeSurfaceOrigin(rect);
    placeholder.style.height = `${Math.max(1, rect.height)}px`;
    placeholder.setAttribute("data-atlas-placeholder-active", "true");
  }, [measureEmbeddedGeometry, snapshotSurfaceVariables, writeSurfaceOrigin]);

  const restoreEmbeddedGeometry = useCallback(() => {
    const placeholderSnapshot = placeholderSnapshotRef.current;
    if (placeholderSnapshot) {
      placeholderSnapshot.element.style.height = placeholderSnapshot.height;
      if (placeholderSnapshot.active === null) {
        placeholderSnapshot.element.removeAttribute(
          "data-atlas-placeholder-active"
        );
      } else {
        placeholderSnapshot.element.setAttribute(
          "data-atlas-placeholder-active",
          placeholderSnapshot.active
        );
      }
      placeholderSnapshotRef.current = null;
    }

    const surfaceSnapshot = surfaceVariableSnapshotRef.current;
    if (surfaceSnapshot) {
      for (const [name, value] of surfaceSnapshot.values) {
        if (value) surfaceSnapshot.element.style.setProperty(name, value);
        else surfaceSnapshot.element.style.removeProperty(name);
      }
      surfaceVariableSnapshotRef.current = null;
    }
  }, []);

  const enter = useCallback(
    (source: AtlasExperienceEntrySource, opener?: HTMLElement | null) => {
      if (!canUseDom()) return;
      const current = stateRef.current;
      if (
        enterInFlightRef.current ||
        current.view !== "embedded" ||
        current.transition !== "idle"
      ) {
        return;
      }
      enterInFlightRef.current = true;
      openerRef.current =
        opener ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : launchButtonRef.current);
      captureEmbeddedGeometry();

      const nextUrlState = { ...currentUrlState(), view: "immersive" as const };
      if (source === "url") {
        replaceWithoutImmersiveMarker(nextUrlState);
        dispatch({
          type: "SYNC_VIEW",
          view: "immersive",
          reducedMotion: reducedMotionRef.current,
        });
        return;
      }

      commitAtlasUrlState(
        nextUrlState,
        "push",
        withAtlasImmersiveHistoryMarker(window.history.state, source)
      );
      dispatch({
        type: "ENTER",
        source,
        reducedMotion: reducedMotionRef.current,
      });
    },
    [captureEmbeddedGeometry, currentUrlState, replaceWithoutImmersiveMarker]
  );

  const requestExit = useCallback(
    (reason: AtlasExperienceExitReason = "programmatic") => {
      if (!canUseDom()) return;
      const current = stateRef.current;
      if (
        current.view === "embedded" &&
        current.transition !== "preparing"
      ) {
        return;
      }

      if (reason === "history") {
        dispatch({
          type: "SYNC_VIEW",
          view: readAtlasUrlState().view,
          reducedMotion: reducedMotionRef.current,
        });
        return;
      }

      if (
        exitInFlightRef.current ||
        current.transition === "exiting"
      ) {
        return;
      }
      exitInFlightRef.current = true;
      refreshExitGeometry();
      const ensureAtlasHash = current.entrySource !== "embedded";

      const marker = readAtlasImmersiveHistoryMarker(window.history.state);
      if (marker && readAtlasUrlState().view === "immersive") {
        window.history.back();
        if (historyFallbackTimerRef.current !== null) {
          window.clearTimeout(historyFallbackTimerRef.current);
        }
        historyFallbackTimerRef.current = window.setTimeout(() => {
          historyFallbackTimerRef.current = null;
          const urlState = readAtlasUrlState();
          if (urlState.view === "immersive") {
            replaceWithoutImmersiveMarker({
              ...currentUrlState(),
              view: "embedded",
            }, ensureAtlasHash);
          }
        }, 700);
      } else {
        replaceWithoutImmersiveMarker({
          ...currentUrlState(),
          view: "embedded",
        }, ensureAtlasHash);
      }

      dispatch({ type: "EXIT", reducedMotion: reducedMotionRef.current });
    },
    [currentUrlState, refreshExitGeometry, replaceWithoutImmersiveMarker]
  );

  const syncFromUrl = useCallback(() => {
    let urlState = readAtlasUrlState();
    const current = stateRef.current;
    if (canUseDom() && historyFallbackTimerRef.current !== null) {
      window.clearTimeout(historyFallbackTimerRef.current);
      historyFallbackTimerRef.current = null;
    }

    if (urlState.view === "embedded" && current.view === "immersive") {
      const preservedSelection = selectionRef.current;
      if (preservedSelection) {
        urlState = { ...preservedSelection, view: "embedded" };
        replaceWithoutImmersiveMarker(
          urlState,
          current.entrySource !== "embedded"
        );
      }
      exitInFlightRef.current = true;
    } else if (urlState.view === "immersive" && current.view === "embedded") {
      captureEmbeddedGeometry();
    }

    const marker = canUseDom()
      ? readAtlasImmersiveHistoryMarker(window.history.state)
      : null;
    dispatch({
      type: "SYNC_VIEW",
      view: urlState.view,
      source: marker?.source ?? (urlState.view === "immersive" ? "url" : undefined),
      reducedMotion: reducedMotionRef.current,
    });
    onUrlStateChangeRef.current?.(urlState);
    return urlState;
  }, [captureEmbeddedGeometry, replaceWithoutImmersiveMarker]);

  const commitUrlSelection = useCallback(
    (
      selection: AtlasExperienceUrlSelection,
      embeddedMode: "push" | "replace" = "push"
    ) => {
      if (!canUseDom()) return false;
      selectionRef.current = selection;
      const view = readAtlasUrlState().view;
      return commitAtlasUrlState(
        { ...selection, view },
        view === "immersive" ? "replace" : embeddedMode,
        window.history.state
      );
    },
    []
  );

  useEffect(() => {
    if (!reducedMotion) return;
    const transition = stateRef.current.transition;
    if (transition === "preparing") {
      dispatch({ type: "PREPARED" });
      dispatch({ type: "TRANSITION_END" });
    } else if (transition === "entering" || transition === "exiting") {
      dispatch({ type: "TRANSITION_END" });
    }
  }, [reducedMotion]);

  useEffect(() => {
    if (!canUseDom() || reducedMotion) return undefined;
    if (state.transition === "preparing") {
      const frame = window.requestAnimationFrame(() => {
        dispatch({ type: "PREPARED" });
      });
      return () => window.cancelAnimationFrame(frame);
    }
    if (state.transition !== "entering" && state.transition !== "exiting") {
      return undefined;
    }
    const duration =
      state.entrySource === "url"
        ? directTransitionDurationRef.current
        : transitionDurationRef.current;
    const timer = window.setTimeout(
      () => dispatch({ type: "TRANSITION_END" }),
      duration
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, state.entrySource, state.transition]);

  useLayoutEffect(() => {
    if (
      state.view !== "immersive" ||
      state.entrySource !== "url" ||
      surfaceVariableSnapshotRef.current
    ) {
      return;
    }
    captureEmbeddedGeometry();
  }, [captureEmbeddedGeometry, state.entrySource, state.view]);

  useLayoutEffect(() => {
    const experience = experienceRef.current;
    const surface = surfaceRef.current;
    for (const element of [experience, surface]) {
      if (!element) continue;
      element.setAttribute("data-atlas-view", state.view);
      element.setAttribute("data-atlas-transition", state.transition);
      element.setAttribute("data-atlas-entry-source", state.entrySource);
      element.setAttribute("data-atlas-quiet", String(state.quiet));
      element.setAttribute("data-atlas-search-open", String(state.searchOpen));
      element.setAttribute(
        "data-atlas-filters-open",
        String(state.filtersOpen)
      );
      element.setAttribute("data-atlas-sheet-state", state.sheetState);
      element.setAttribute("data-atlas-reduced-motion", String(reducedMotion));
      element.setAttribute("data-atlas-economical", String(economical));
    }
  }, [economical, reducedMotion, state]);

  useEffect(() => {
    if (state.view !== "embedded" || state.transition !== "idle") return;
    restoreEmbeddedGeometry();
  }, [restoreEmbeddedGeometry, state.transition, state.view]);

  useEffect(() => {
    if (state.view === "immersive" && state.transition === "idle") {
      enterInFlightRef.current = false;
    }
    if (state.view === "embedded" && state.transition === "idle") {
      enterInFlightRef.current = false;
      exitInFlightRef.current = false;
    }
  }, [state.transition, state.view]);

  const modalActive = state.view === "immersive";

  useEffect(() => {
    if (!modalActive || !canUseDom()) return undefined;
    let frame: number | null = null;
    const update = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(refreshExitGeometry);
    };
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [modalActive, refreshExitGeometry]);

  useEffect(() => {
    if (!modalActive || !canUseDom()) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const atlasDocumentY = placeholderRef.current
      ? Math.max(
          0,
          scrollY + placeholderRef.current.getBoundingClientRect().top
        )
      : scrollY;
    const lockedScrollY =
      state.entrySource === "embedded" ? scrollY : atlasDocumentY;
    const scrollbarWidth = Math.max(
      0,
      window.innerWidth - document.documentElement.clientWidth
    );
    const computedBodyPaddingRight = Number.parseFloat(
      window.getComputedStyle(body).paddingRight
    ) || 0;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyPaddingRight: body.style.paddingRight,
    };

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `${-lockedScrollY}px`;
    body.style.left = `${-scrollX}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${computedBodyPaddingRight + scrollbarWidth}px`;
    }

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.width = previous.bodyWidth;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      body.style.paddingRight = previous.bodyPaddingRight;
      window.scrollTo(scrollX, lockedScrollY);
    };
  }, [modalActive, state.entrySource]);

  useEffect(() => {
    if (!modalActive || !canUseDom()) return undefined;
    const surface = surfaceRef.current;
    if (!surface) return undefined;
    const modalAttributes: ModalAttributeSnapshot = {
      role: surface.getAttribute("role"),
      ariaModal: surface.getAttribute("aria-modal"),
      tabIndex: surface.getAttribute("tabindex"),
    };
    surface.setAttribute("role", "dialog");
    surface.setAttribute("aria-modal", "true");
    if (!surface.hasAttribute("tabindex")) surface.tabIndex = -1;
    const restoreOutside = hideOutsideModal(surface);

    const focusInitial = window.requestAnimationFrame(() => {
      const preferred = closeButtonRef.current;
      const fallback = focusableElements(surface)[0] ?? surface;
      (preferred && surface.contains(preferred) ? preferred : fallback).focus({
        preventScroll: true,
      });
    });

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        const current = stateRef.current;
        if (current.searchOpen) {
          dispatch({ type: "CLOSE_SEARCH" });
          window.requestAnimationFrame(() =>
            searchButtonRef.current?.focus({ preventScroll: true })
          );
          notifyActivity();
        } else if (current.filtersOpen) {
          dispatch({ type: "CLOSE_FILTERS" });
          window.requestAnimationFrame(() =>
            filtersButtonRef.current?.focus({ preventScroll: true })
          );
          notifyActivity();
        } else {
          requestExit("escape");
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements(surface);
      if (!focusable.length) {
        event.preventDefault();
        surface.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !surface.contains(active))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (
        !event.shiftKey &&
        (active === last || !surface.contains(active))
      ) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (surface.contains(event.target as Node)) return;
      (closeButtonRef.current ?? focusableElements(surface)[0] ?? surface).focus({
        preventScroll: true,
      });
    };

    document.addEventListener("keydown", handleKeydown, true);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      window.cancelAnimationFrame(focusInitial);
      document.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("focusin", handleFocusIn);
      restoreOutside();
      if (modalAttributes.role === null) surface.removeAttribute("role");
      else surface.setAttribute("role", modalAttributes.role);
      if (modalAttributes.ariaModal === null) {
        surface.removeAttribute("aria-modal");
      } else {
        surface.setAttribute("aria-modal", modalAttributes.ariaModal);
      }
      if (modalAttributes.tabIndex === null) surface.removeAttribute("tabindex");
      else surface.setAttribute("tabindex", modalAttributes.tabIndex);

      const restoreTarget =
        state.entrySource === "embedded" &&
        openerRef.current?.isConnected === true
          ? openerRef.current
          : launchButtonRef.current?.isConnected === true
            ? launchButtonRef.current
            : stageRef.current ?? experienceRef.current;
      openerRef.current = null;
      window.requestAnimationFrame(() => {
        restoreTarget?.focus({ preventScroll: true });
      });
    };
  }, [modalActive, notifyActivity, requestExit, state.entrySource]);

  useEffect(() => {
    if (!modalActive) {
      clearQuietTimer();
      return undefined;
    }
    const surface = surfaceRef.current;
    if (!surface) return undefined;
    const activityEvents: (keyof HTMLElementEventMap)[] = [
      "pointermove",
      "pointerdown",
      "wheel",
      "touchstart",
      "keydown",
      "focusin",
    ];
    for (const eventName of activityEvents) {
      surface.addEventListener(eventName, notifyActivity, { passive: true });
    }
    armQuietTimer();
    return () => {
      for (const eventName of activityEvents) {
        surface.removeEventListener(eventName, notifyActivity);
      }
      clearQuietTimer();
    };
  }, [armQuietTimer, clearQuietTimer, modalActive, notifyActivity]);

  useEffect(() => {
    if (!modalActive || state.transition !== "idle") {
      clearQuietTimer();
      return;
    }
    if (state.searchOpen || state.filtersOpen || state.quiet) clearQuietTimer();
    else armQuietTimer();
  }, [
    armQuietTimer,
    clearQuietTimer,
    modalActive,
    state.filtersOpen,
    state.quiet,
    state.searchOpen,
    state.transition,
  ]);

  useEffect(() => {
    if (!canUseDom()) return undefined;
    const surface = surfaceRef.current;
    if (!surface) return undefined;
    const eventRoot = surface;
    let pointerFrame: number | null = null;
    let latestEvent: PointerEvent | null = null;
    let dragging = false;

    const resetProximity = () => {
      surface.style.setProperty("--atlas-proximity", "0");
      surface.style.setProperty("--atlas-proximity-x", "0.5");
      surface.style.setProperty("--atlas-proximity-y", "0.5");
      surface.style.setProperty("--atlas-near-shift-x", "0px");
      surface.style.setProperty("--atlas-near-shift-y", "0px");
      surface.style.setProperty("--atlas-engraving-shift-x", "0px");
      surface.style.setProperty("--atlas-engraving-shift-y", "0px");
      surface.setAttribute("data-atlas-proximity", "idle");
    };

    if (!proximityEnabled) {
      resetProximity();
      return undefined;
    }

    const renderPointer = () => {
      pointerFrame = null;
      const event = latestEvent;
      latestEvent = null;
      if (!event) return;
      const eventTarget = event.target;
      const overControl =
        eventTarget instanceof Element &&
        Boolean(eventTarget.closest(PROXIMITY_CONTROL_SELECTOR));
      const externallyDragging =
        eventTarget instanceof Element &&
        Boolean(
          eventTarget.closest(
            '[data-atlas-dragging="true"],[data-globe-dragging="true"],.is-dragging'
          )
        );
      if (
        dragging ||
        event.buttons !== 0 ||
        overControl ||
        externallyDragging ||
        reducedMotionRef.current ||
        economicalRef.current
      ) {
        resetProximity();
        return;
      }

      const rect = (stageRef.current ?? surface).getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
      const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
      const normalizedX = x / rect.width;
      const normalizedY = y / rect.height;
      const distance = Math.hypot(x - rect.width / 2, y - rect.height / 2);
      const influenceRadius = Math.max(220, Math.min(rect.width, rect.height) * 0.72);
      const strength = Math.max(
        0,
        Math.min(1, 1 - distance / influenceRadius)
      );
      const centeredX = normalizedX - 0.5;
      const centeredY = normalizedY - 0.5;
      surface.style.setProperty("--atlas-pointer-x", `${x}px`);
      surface.style.setProperty("--atlas-pointer-y", `${y}px`);
      surface.style.setProperty("--atlas-proximity-x", String(normalizedX));
      surface.style.setProperty("--atlas-proximity-y", String(normalizedY));
      surface.style.setProperty("--atlas-proximity", String(strength));
      surface.style.setProperty(
        "--atlas-near-shift-x",
        `${centeredX * 14 * strength}px`
      );
      surface.style.setProperty(
        "--atlas-near-shift-y",
        `${centeredY * 14 * strength}px`
      );
      surface.style.setProperty(
        "--atlas-engraving-shift-x",
        `${centeredX * 20 * strength}px`
      );
      surface.style.setProperty(
        "--atlas-engraving-shift-y",
        `${centeredY * 20 * strength}px`
      );
      surface.setAttribute(
        "data-atlas-proximity",
        strength > 0.02 ? "active" : "idle"
      );
    };

    const handlePointerMove = (event: PointerEvent) => {
      latestEvent = event;
      if (pointerFrame === null) {
        pointerFrame = window.requestAnimationFrame(renderPointer);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const eventTarget = event.target;
      dragging =
        eventTarget instanceof Element &&
        !eventTarget.closest(PROXIMITY_CONTROL_SELECTOR);
      resetProximity();
    };
    const handlePointerUp = () => {
      dragging = false;
    };
    const handlePointerLeave = () => {
      latestEvent = null;
      resetProximity();
    };

    eventRoot.addEventListener("pointermove", handlePointerMove, { passive: true });
    eventRoot.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerUp, { passive: true });
    eventRoot.addEventListener("pointerleave", handlePointerLeave, {
      passive: true,
    });

    return () => {
      if (pointerFrame !== null) window.cancelAnimationFrame(pointerFrame);
      eventRoot.removeEventListener("pointermove", handlePointerMove);
      eventRoot.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      eventRoot.removeEventListener("pointerleave", handlePointerLeave);
      resetProximity();
    };
  }, [proximityEnabled]);

  useEffect(
    () => () => {
      clearQuietTimer();
      restoreEmbeddedGeometry();
      if (historyFallbackTimerRef.current !== null && canUseDom()) {
        window.clearTimeout(historyFallbackTimerRef.current);
      }
    },
    [clearQuietTimer, restoreEmbeddedGeometry]
  );

  return {
    state,
    dispatch,
    experienceRef,
    surfaceRef,
    stageRef,
    placeholderRef,
    closeButtonRef,
    searchButtonRef,
    filtersButtonRef,
    launchButtonRef,
    reducedMotion,
    economical,
    proximityEnabled,
    compactSheet,
    enter,
    requestExit,
    syncFromUrl,
    notifyActivity,
    commitUrlSelection,
  };
}
