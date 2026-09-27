import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import mascotImage from "../assets/mascots/knizhulyk-green-v1.png";
import PlanetMascotAvatar from "./PlanetMascotAvatar";
import type { BookyRendererState } from "./useBookyRenderer";
import { BOOKY_GESTURES, type BookyGesture } from "./bookyAnimation";
import { pickBookySurprise, type BookySurpriseState } from "./bookySurprise";
import { useBookyWalk } from "./useBookyWalk";
import { BOOKY_APPROACH_MS, planBookyApproach, planBookyDockReturn } from "./bookyWalk";
import { bookyCardHeightLimit, bookyCardViewport, bookyCardWidth, placeBooky, placeBookyCard } from "./bookyPlacement";
import type { PlanetMascotController, PlanetMascotSnapshot } from "./planetMascot";
import type { PlanetMascotPersistenceSnapshot } from "./planetMascotPersistence";
import type { BookyMotionMode, BookyMotionSnapshot } from "./bookyMotionPreference";
import { isBookyRouteComplete } from "./bookyTourProgress";
import { PLANET_MASCOT_ROUTES, getPlanetMascotStep, type PlanetMascotAction,
  type PlanetMascotScreen, type PlanetMascotTarget } from "./planetMascotRoutes";
import "./PlanetMascotControls.css";

type Position = Readonly<{ left: number; top: number }>;
type Rect = Position & Readonly<{ width: number; height: number }>;
export type PlanetMascotControlsProps = {
  controller: PlanetMascotController;
  snapshot: PlanetMascotSnapshot;
  screen: PlanetMascotScreen;
  countryLabel: string | null;
  writerLabel: string | null;
  onAction: (action: PlanetMascotAction) => void;
  pointRequest?: Readonly<{ id: number; action: PlanetMascotAction }> | null;
  position: Position | null;
  onPositionChange: (position: Position | null) => void;
  persistence: PlanetMascotPersistenceSnapshot;
  onRetryPersistence: () => boolean;
  motion: BookyMotionSnapshot;
  onMotionChange: (mode: BookyMotionMode) => boolean;
  onRetryMotion: () => boolean;
  onRecoverMotion: () => boolean;
  onRetryContent: (target: "countries" | "books") => void;
  readerSettings?: ReactNode;
};
const MARGIN = 12;
const arrowDirections: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};
const selectors: Record<PlanetMascotTarget, readonly string[]> = {
  search: ['.atlas-immersive-chrome [data-atlas-action="toggle-search"]', '#country-search'],
  country: [".atlas-country-presentation", ".literary-globe canvas"],
  writer: [".atlas-country-presentation .writer-list", ".atlas-country-presentation"],
  books: [".book-archive-heading", '.atlas-immersive-chrome [data-atlas-action="open-collection"]'],
  appearance: ["[data-planet-stand-toggle]"],
};
function viewport(): Rect {
  const view = window.visualViewport;
  return { left: view?.offsetLeft ?? 0, top: view?.offsetTop ?? 0,
    width: view?.width ?? window.innerWidth, height: view?.height ?? window.innerHeight };
}
function sameRect(a: Rect | null, b: Rect | null) {
  return a === b || Boolean(a && b && Math.abs(a.left - b.left) < .5 && Math.abs(a.top - b.top) < .5
    && Math.abs(a.width - b.width) < .5 && Math.abs(a.height - b.height) < .5);
}
function clamped(position: Position, width: number, height: number, view: Rect): Position {
  return { left: Math.max(view.left + MARGIN, Math.min(position.left, view.left + view.width - width - MARGIN)),
    top: Math.max(view.top + MARGIN, Math.min(position.top, view.top + view.height - height - MARGIN)) };
}
function visibleRect(element: Element, view: Rect): Rect | null {
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return null;
  const style = getComputedStyle(element), bounds = element.getBoundingClientRect();
  if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0
    || bounds.width < 2 || bounds.height < 2) return null;
  let left = Math.max(bounds.left, view.left), top = Math.max(bounds.top, view.top);
  let right = Math.min(bounds.right, view.left + view.width), bottom = Math.min(bounds.bottom, view.top + view.height);
  let clipAncestors = style.position !== "fixed";
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const parentStyle = getComputedStyle(parent);
    if (parentStyle.display === "none" || Number(parentStyle.opacity) === 0) return null;
    // The fixed globe/panel escapes the surrounding document's overflow boxes.
    // During scroll lock body is fixed and html can have zero content height;
    // neither root box is the viewport that clips these visible controls.
    if (clipAncestors && parent !== document.body && parent !== document.documentElement
      && /hidden|clip|scroll|auto/.test(parentStyle.overflowX + parentStyle.overflowY)) {
      const clip = parent.getBoundingClientRect();
      if (/hidden|clip|scroll|auto/.test(parentStyle.overflowX)) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
      if (/hidden|clip|scroll|auto/.test(parentStyle.overflowY)) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
    }
    if (parentStyle.position === "fixed") clipAncestors = false;
  }
  return right - left >= 2 && bottom - top >= 2 ? { left, top, width: right - left, height: bottom - top } : null;
}
const protectedControls = ".native-planet-panel__header, .native-planet-app .atlas-immersive-chrome .interface-language-control";
const navigationControls = ".native-planet-app .globe-controls, .native-planet-app .globe-scale-feedback, .native-planet-app .atlas-country-sheet-toggle, "
  + ".native-planet-app .globe-style-switch, .native-planet-app .globe-edition-scroll-cue, "
  + ".native-planet-app .globe-style-switch-toggle, .native-planet-app .globe-edition-compact-select, "
  + ".native-planet-app .book-shelf-frame__navigation, .native-planet-app .book-detail-actions, "
  + ".native-planet-app .archive-book-actions, "
  + ".native-planet-app .atlas-country-presentation .panel-close, "
  + ".native-planet-app .book-detail-page-navigation, .native-planet-app [data-planet-stand-toggle]";
function companionViewport(): Rect {
  const view = viewport();
  let top = view.top;
  for (const element of document.querySelectorAll(protectedControls)) {
    const bounds = visibleRect(element, view);
    if (bounds) top = Math.max(top, bounds.top + bounds.height);
  }
  // Long help cards scroll below the host controls, including the collection's
  // back button and locale switch. The companion must never cover those exits.
  return { ...view, top, height: Math.max(0, view.top + view.height - top) };
}
export default function PlanetMascotControls({ controller, snapshot, screen, countryLabel, writerLabel,
  onAction, pointRequest, position, onPositionChange, persistence, onRetryPersistence, motion, onMotionChange,
  onRetryMotion, onRecoverMotion, onRetryContent, readerSettings }: PlanetMascotControlsProps) {
  const { language } = useInterfaceLanguage();
  const ru = language === "ru", name = ru ? "Книжулик" : "Mr. Booky";
  const calmMotion = !motion.hydrated || motion.mode === "calm";
  const id = useId(), root = useRef<HTMLDivElement>(null), card = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const gestureGallery = useRef<HTMLDetailsElement>(null), gestureSummary = useRef<HTMLElement>(null);
  const tourHeading = useRef<HTMLHeadingElement>(null), focusAfterNavigation = useRef(false);
  const resetStart = useRef<HTMLButtonElement>(null), resetConfirm = useRef<HTMLButtonElement>(null);
  const [resetAtRevision, setResetAtRevision] = useState<number | null>(null);
  const [view, setView] = useState<Rect>(() => typeof window === "undefined"
    ? { left: 0, top: 0, width: 1024, height: 768 } : companionViewport());
  const [petSize, setPetSize] = useState({ width: 176, height: 216 });
  const [navigation, setNavigation] = useState<Rect[]>([]);
  const [dockBounds, setDockBounds] = useState<Rect | null>(null);
  const dockDetached = useRef(false);
  const measuredViewport = useRef<Rect | null>(null);
  const [cardHeight, setCardHeight] = useState(360);
  const [cardTextSize, setCardTextSize] = useState({ heading: 0, controls: 0, action: 0 });
  const [highlight, setHighlight] = useState<Rect | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; origin: Position; source: "avatar" | "handle";
    moved: boolean; element: HTMLButtonElement } | null>(null);
  const suppressAvatarClick = useRef(false);
  const walkStopActivation = useRef<"pointer" | "keyboard" | null>(null);
  const [pointerLook, setPointerLook] = useState<{ x: number; y: number } | null>(null);
  const [gesture, setGesture] = useState<"rest" | "dragging" | "pointing" | BookyGesture>("rest");
  const [targetCue, setTargetCue] = useState<{ touch: Position; phase: "approaching" | "tapping" | "returning";
    action: PlanetMascotAction; floating: boolean } | null>(null);
  const handledPoint = useRef<number | null>(null);
  const cancelPoint = useRef<(() => void) | null>(null);
  const [reactionKey, setReactionKey] = useState(0);
  const [character, setCharacter] = useState({ attempt: 0, recoveryAttempt: false, state: "loading" as BookyRendererState });
  const characterOwner = useRef(character), characterMounted = useRef(false);
  const characterRestoring = character.recoveryAttempt && character.state === "loading";
  const surpriseSequence = useRef<BookySurpriseState>({ remaining: [], last: null });
  const [pageTurn, setPageTurn] = useState(0);
  const previousPage = useRef(`${snapshot.mode}:${snapshot.route}:${snapshot.step}`);
  const prior = useRef({ panel: snapshot.panel, visibility: snapshot.visibility });
  const shown = snapshot.visibility === "shown", open = shown && snapshot.panel === "open";
  const step = getPlanetMascotStep(snapshot.route, snapshot.step);
  const tour = snapshot.mode === "tour" && step && snapshot.route ? PLANET_MASCOT_ROUTES[snapshot.route] : null;
  const savedTour = snapshot.resumeOffer ? PLANET_MASCOT_ROUTES[snapshot.resumeOffer.route] : null;
  const savedStep = savedTour?.steps.find(value => value.id === snapshot.resumeOffer?.stepId);
  const acknowledgedCount = (route: "overview" | "country-to-book") => snapshot.progress
    .find(entry => entry.route === route && entry.routeVersion === PLANET_MASCOT_ROUTES[route].version)?.acknowledgedStepIds.length ?? 0;
  const progressText = (route: "overview" | "country-to-book") => ru
    ? `Подтверждено шагов: ${acknowledgedCount(route)} из ${PLANET_MASCOT_ROUTES[route].steps.length}`
    : `Steps acknowledged: ${acknowledgedCount(route)} of ${PLANET_MASCOT_ROUTES[route].steps.length}`;

  useLayoutEffect(() => {
    characterMounted.current = true;
    return () => { characterMounted.current = false; };
  }, []);
  useLayoutEffect(() => {
    if (shown && snapshot.available) return;
    // Invalidate reports from a canvas removed by hide or platform suspension.
    const next = { attempt: characterOwner.current.attempt + 1, recoveryAttempt: false, state: "loading" as const };
    characterOwner.current = next; setCharacter(next);
  }, [shown, snapshot.available]);
  const onCharacterState = useCallback((attempt: number, state: BookyRendererState) => {
    const owner = characterOwner.current, current = controller.getSnapshot();
    if (!characterMounted.current || owner.attempt !== attempt || !current.available
      || current.visibility !== "shown" || owner.state === state) return;
    const next = { ...owner, state };
    characterOwner.current = next; setCharacter(next);
  }, [controller]);

  useLayoutEffect(() => {
    if (!open || !snapshot.available || resetAtRevision !== snapshot.revision) {
      if (open && snapshot.available && resetConfirm.current?.closest('[role="group"]')?.contains(document.activeElement)) {
        resetStart.current?.focus();
      }
      setResetAtRevision(null);
    }
  }, [open, snapshot.available, snapshot.revision, resetAtRevision]);
  useLayoutEffect(() => { if (resetAtRevision !== null) resetConfirm.current?.focus(); }, [resetAtRevision]);

  useLayoutEffect(() => {
    if (shown && snapshot.available) return;
    if (!shown) dockDetached.current = false;
    const intent = drag.current;
    drag.current = null;
    if (intent?.element.hasPointerCapture(intent.pointerId)) intent.element.releasePointerCapture(intent.pointerId);
    suppressAvatarClick.current = false;
    setPointerLook(null); setGesture("rest");
  }, [shown, snapshot.available]);

  useLayoutEffect(() => {
    const page = `${snapshot.mode}:${snapshot.route}:${snapshot.step}`;
    if (!open) setPageTurn(0);
    if (previousPage.current === page) return;
    previousPage.current = page;
    if (!open || !snapshot.available) return;
    // A new instruction starts at the top of its leaf; context updates and
    // locale switches never move a page the user is already reading.
    if (card.current) card.current.scrollTop = 0;
    setPageTurn(value => calmMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : value + 1);
    setGesture("rest");
    setReactionKey(value => value + 1);
  }, [snapshot.mode, snapshot.route, snapshot.step, snapshot.available, open, calmMotion]);

  useLayoutEffect(() => {
    const watched = new Set<Element>();
    const measure = () => {
      const actualViewport = viewport(), previousViewport = measuredViewport.current;
      measuredViewport.current = actualViewport;
      if (previousViewport && !sameRect(previousViewport, actualViewport)) {
        // Rotation invalidates the old surface. Cancel its demonstration and
        // let the new layout place the companion in its reserved row, without
        // replaying a route or overwriting the user's stored preferences.
        cancelPoint.current?.();
        const intent = drag.current;
        if (intent) {
          // A browser can retain touch capture across rotation. Retire that
          // intent before releasing capture, so its old coordinates and the
          // eventual avatar click cannot act on the newly laid out surface.
          drag.current = null;
          suppressAvatarClick.current = intent.source === "avatar";
          setPointerLook(null); setGesture("rest");
          if (intent.element.hasPointerCapture(intent.pointerId)) intent.element.releasePointerCapture(intent.pointerId);
        }
        dockDetached.current = false;
      }
      const next = companionViewport();
      setView(previous => sameRect(previous, next) ? previous : next);
      // The sheet header can move while retaining its own size. Observe the
      // resizing sheet as well, so a finite expansion/drag updates its bounds.
      const elements = new Set(document.querySelectorAll(`${protectedControls}, ${navigationControls}, .native-planet-app .atlas-country-presentation, [data-booky-dock], .native-planet-panel__content`));
      for (const element of watched) if (!elements.has(element)) { observer?.unobserve(element); watched.delete(element); }
      for (const element of elements) if (!watched.has(element)) { observer?.observe(element); watched.add(element); }
      const bounds = [...document.querySelectorAll(navigationControls)]
        .map(element => visibleRect(element, next)).filter((rect): rect is Rect => rect !== null);
      const panel = root.current?.closest(".native-planet-panel");
      const dockElement = panel?.querySelector('[data-booky-dock-active="true"]');
      const nextDock = dockElement ? visibleRect(dockElement, next) : null;
      setDockBounds(previous => previous && nextDock && sameRect(previous, nextDock) ? previous : nextDock);
      // Manual walks remain in the reserved space. Explicit demonstration
      // paths own their finite trip through the selected content separately.
      const content = nextDock && panel?.querySelector(".native-planet-panel__content");
      const contentBounds = content ? visibleRect(content, next) : null;
      if (contentBounds) bounds.push(contentBounds);
      setNavigation(previous => previous.length === bounds.length && previous.every((rect, index) => sameRect(rect, bounds[index])) ? previous : bounds);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const host = root.current?.closest(".native-planet-app");
    const visibility = typeof MutationObserver === "undefined" ? null : new MutationObserver(measure);
    // The globe toolbar becomes interactive after a panel's passive cleanup
    // removes inert. That changes availability without resizing the toolbar.
    if (host) visibility?.observe(host, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["inert", "hidden", "open", "aria-hidden", "data-atlas-sheet-state", "data-globe-edition-rail", "data-visible", "data-booky-dock-active"] });
    // CSS transforms and opacity can move/reveal navigation without resizing
    // it. Refresh its final bounds after motion, including a media change.
    const motionSettled = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      for (const element of watched) {
        if (target === element || target.contains(element)) { measure(); return; }
      }
    };
    const motionEvents = ["animationend", "animationcancel", "transitionend", "transitioncancel"] as const;
    for (const type of motionEvents) host?.addEventListener(type, motionSettled, true);
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    measure();
    return () => { observer?.disconnect(); visibility?.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true);
      for (const type of motionEvents) host?.removeEventListener(type, motionSettled, true);
      window.visualViewport?.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("scroll", measure); };
  }, [screen, language, snapshot.available, shown, open]);

  useLayoutEffect(() => {
    const measure = () => {
      const bounds = root.current?.getBoundingClientRect();
      if (bounds) setPetSize(previous => Math.abs(previous.width - bounds.width) < .5 && Math.abs(previous.height - bounds.height) < .5
        ? previous : { width: bounds.width, height: bounds.height });
      // Measure content, not the constrained viewport, so a compact card can
      // grow again after a resize or after a nearby control disappears.
      const contentHeight = card.current ? card.current.scrollHeight + 2 : null;
      if (contentHeight !== null) setCardHeight(previous => Math.abs(previous - contentHeight) < .5 ? previous : contentHeight);
      if (card.current) {
        const headingHeight = heading.current?.parentElement?.getBoundingClientRect().height ?? 0;
        const controlsHeight = card.current.querySelector(".planet-mascot-controls__heading-actions")?.getBoundingClientRect().height ?? 0;
        const actionHeight = Math.max(0, ...Array.from(card.current.querySelectorAll("button, summary"),
          element => element.getBoundingClientRect().height));
        setCardTextSize(previous => Math.abs(previous.heading - headingHeight) < .5 && Math.abs(previous.controls - controlsHeight) < .5
          && Math.abs(previous.action - actionHeight) < .5 ? previous : { heading: headingHeight, controls: controlsHeight, action: actionHeight });
      }
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (root.current) observer?.observe(root.current);
    if (card.current) observer?.observe(card.current);
    if (card.current?.firstElementChild) observer?.observe(card.current.firstElementChild);
    measure();
    return () => observer?.disconnect();
  }, [snapshot.available, shown, open, language, view.width, view.height]);

  useLayoutEffect(() => {
    const previous = prior.current;
    prior.current = { panel: snapshot.panel, visibility: snapshot.visibility };
    if (!snapshot.available) return;
    if (open && previous.panel !== "open") heading.current?.focus({ preventScroll: true });
    else if ((!open && previous.panel === "open") || (!shown && previous.visibility === "shown")) toggle.current?.focus({ preventScroll: true });
  }, [snapshot.available, snapshot.panel, snapshot.visibility, shown, open]);

  useLayoutEffect(() => {
    if (!focusAfterNavigation.current) return;
    focusAfterNavigation.current = false;
    if (open && snapshot.available) (tourHeading.current ?? heading.current)?.focus({ preventScroll: true });
  }, [snapshot.revision, snapshot.available, open, persistence.state]);

  useLayoutEffect(() => {
    if (!snapshot.available || !open || !snapshot.highlight) { setHighlight(null); return; }
    let observed: Element | null = null, alive = true;
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    function measure() {
      if (!alive) return;
      let target: Element | null = null, next: Rect | null = null;
      for (const selector of selectors[snapshot.highlight!]) {
        for (const candidate of document.querySelectorAll(selector)) {
          const bounds = visibleRect(candidate, viewport());
          if (bounds) { target = candidate; next = bounds; break; }
        }
        if (target) break;
      }
      if (target !== observed) { resize?.disconnect(); observed = target; if (target) resize?.observe(target); }
      setHighlight(previous => sameRect(previous, next) ? previous : next);
    }
    // Async archive loading can replace the real target after the step opens.
    // No mutation writes or animation-frame polling belong to this observer.
    const mutation = typeof MutationObserver === "undefined" ? null : new MutationObserver(measure);
    mutation?.observe(document.body, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["hidden", "inert", "aria-hidden", "data-atlas-sheet-state"] });
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure); window.visualViewport?.addEventListener("scroll", measure);
    measure();
    return () => { alive = false; resize?.disconnect(); mutation?.disconnect(); window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true); window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure); };
  }, [snapshot.available, snapshot.highlight, snapshot.revision, open, screen, countryLabel, writerLabel]);

  const preferredPosition = clamped(position ?? { left: view.left + view.width - petSize.width - 20,
    top: view.top + view.height - petSize.height - 20 }, petSize.width, petSize.height, view);
  const dock = dockBounds && dockBounds.width >= petSize.width + MARGIN * 2
    && dockBounds.height >= petSize.height + MARGIN * 2 ? dockBounds : null;
  // Follow the pointer/selected target exactly during an explicit movement;
  // settle beside navigation controls without writing a new saved preference.
  const floating = gesture === "dragging" || dock && dockDetached.current || targetCue && (!dock || targetCue.floating);
  const restingPosition = floating ? preferredPosition
    : placeBooky(preferredPosition, petSize, dock ?? view, navigation);
  const walk = useBookyWalk({ available: shown && snapshot.available && !open && !characterRestoring && snapshot.mode === "help",
    calmMotion,
    revision: snapshot.revision, position: restingPosition, committedPosition: position ?? preferredPosition,
    size: petSize, viewport: view, controls: navigation, onFinish: onPositionChange });
  useLayoutEffect(() => { if (walk.reducedMotion) setPageTurn(0); }, [walk.reducedMotion]);
  const walkNeedsSpace = !walk.active && !walk.canStart && !walk.reducedMotion && !open
    && snapshot.available && snapshot.mode === "help";
  const petPosition = walk.position ?? restingPosition;
  const pointEnvironment = useRef({ position: petPosition, size: petSize, view, dock });
  pointEnvironment.current = { position: petPosition, size: petSize, view, dock };
  useLayoutEffect(() => { cancelPoint.current?.(); }, [calmMotion]);
  useEffect(() => {
    if (!pointRequest || handledPoint.current === pointRequest.id) return;
    if (!shown || !snapshot.available || open || characterRestoring || snapshot.mode !== "help" || document.hidden) {
      handledPoint.current = pointRequest.id; return;
    }
    const targets: Partial<Record<PlanetMascotAction, string>> = {
      recent: '[data-recent-history][open]', downloads: '[data-planet-downloads][open]',
      graphics: '[data-planet-graphics-settings][open] fieldset',
    };
    const selector = targets[pointRequest.action];
    if (!selector) { handledPoint.current = pointRequest.id; return; }
    let cancelled = false, frame = 0, timer = 0, target: Element | null = null;
    let movementStarted = false, returnedToDock = false;
    const began = performance.now();
    const stop = (consume: unknown = true) => {
      // Let the Stop button own its activation. Stopping on pointer/key down
      // would turn it into Start before the ensuing native click arrives.
      if (consume instanceof Event && consume.target instanceof Element
        && consume.target.closest('[data-booky-walk-stop]')
        && (consume.type === "pointerdown" || consume instanceof KeyboardEvent
          && (consume.key === "Enter" || consume.key === " "))) return;
      if (cancelPoint.current === stop) cancelPoint.current = null;
      if (consume !== false) handledPoint.current = pointRequest.id;
      if (cancelled) return;
      // Cancellation is a real stop, even halfway over content. Do not turn
      // it into a snap to the dock or another unsolicited return animation.
      if (movementStarted && !returnedToDock && pointEnvironment.current.dock) dockDetached.current = true;
      cancelled = true; cancelAnimationFrame(frame); window.clearTimeout(timer);
      detach(); walk.stop(); setTargetCue(null); setGesture(value => value === "pointing" ? "rest" : value);
      setPointerLook(null);
    };
    cancelPoint.current = stop;
    const finish = () => {
      if (cancelled) return;
      const current = pointEnvironment.current, destination = current.dock;
      if (!destination || calmMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { stop(); return; }
      const path = planBookyDockReturn(current.position, current.size, current.view, destination);
      if (!path) { stop(); return; }
      const arrived = () => { returnedToDock = true; dockDetached.current = false; stop(); };
      if (Math.hypot(path.to.left - path.from.left, path.to.top - path.from.top) < .01) { arrived(); return; }
      const currentDock = () => {
        const next = pointEnvironment.current.dock;
        return !cancelled && Boolean(next && sameRect(next, destination));
      };
      if (walk.start(path, arrived, BOOKY_APPROACH_MS, currentDock)) {
        movementStarted = true;
        setTargetCue(value => value ? { ...value, phase: "returning", floating: true } : null);
        setGesture("rest"); setPointerLook(null);
      } else stop();
    };
    const tap = (touch: Position) => {
      if (cancelled || !target?.isConnected || !visibleRect(target, viewport()) || document.hidden) { stop(); return; }
      setTargetCue({ touch, phase: "tapping", action: pointRequest.action, floating: movementStarted });
      setPointerLook({ x: -1, y: 0 }); setGesture("pointing"); setReactionKey(value => value + 1);
      timer = window.setTimeout(finish, 700);
    };
    const find = () => {
      if (cancelled) return;
      const current = pointEnvironment.current;
      // Opening phone utilities changes both the panel and the companion size.
      // Wait for those measured bounds before consuming this one-shot request;
      // otherwise the first walking frame immediately invalidates its route.
      const panel = root.current?.closest(".native-planet-panel");
      const expectsDock = window.matchMedia("(max-width: 640px), (max-width: 1024px) and (max-height: 540px) and (orientation: landscape)").matches
        && panel?.querySelector(selector);
      if (expectsDock) {
        const actualPet = root.current?.getBoundingClientRect();
        const actualDock = panel?.querySelector('[data-booky-dock-active="true"]')?.getBoundingClientRect();
        const ready = actualPet && actualDock && current.dock
          && sameRect(actualPet, { ...current.position, ...current.size })
          && sameRect(actualDock, current.dock)
          && Math.abs(actualDock.height - Math.ceil(actualPet.height) - MARGIN * 2) < .5;
        if (!ready) {
          if (performance.now() - began < 600) frame = requestAnimationFrame(find);
          else stop();
          return;
        }
      }
      target = [...document.querySelectorAll(selector)].find(element => visibleRect(element, viewport())) ?? null;
      const bounds = target && visibleRect(target, viewport());
      const canvas = root.current?.querySelector('[data-booky-canvas]')?.getBoundingClientRect();
      const hand = canvas ? { left: canvas.left - current.position.left + canvas.width * .17,
        top: canvas.top - current.position.top + canvas.height * .53 } : undefined;
      const path = bounds && planBookyApproach(current.position, current.size, current.view, bounds, hand);
      if (!path) {
        if (performance.now() - began < 600) frame = requestAnimationFrame(find);
        else stop();
        return;
      }
      handledPoint.current = pointRequest.id;
      document.addEventListener("scroll", stop, true);
      if (calmMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { tap(path.touch); return; }
      // Catalog readiness can revise the helper while this exact visible
      // section is unchanged. Fence this route by its target and user intent.
      const currentTarget = () => {
        const next = target && visibleRect(target, viewport());
        return !cancelled && Boolean(next && bounds && sameRect(next, bounds));
      };
      if (walk.start(path, () => tap(path.touch), BOOKY_APPROACH_MS, currentTarget)) {
        movementStarted = true;
        setTargetCue({ touch: path.touch, phase: "approaching", action: pointRequest.action, floating: true });
        setGesture("rest"); setPointerLook(null); setReactionKey(value => value + 1);
      }
    };
    // The panel opens the section, then reveals it after the dock layout.
    // Wait for that reveal's queued scroll event before attaching the travel
    // interruption listener, including when reduced motion points in place.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(find); });
    });
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const detach = () => {
      document.removeEventListener("pointerdown", stop, true); document.removeEventListener("keydown", stop, true);
      document.removeEventListener("visibilitychange", stop); window.removeEventListener("resize", stop);
      document.removeEventListener("scroll", stop, true); media.removeEventListener("change", stop);
    };
    document.addEventListener("pointerdown", stop, true); document.addEventListener("keydown", stop, true);
    document.addEventListener("visibilitychange", stop); window.addEventListener("resize", stop);
    media.addEventListener("change", stop);
    // StrictMode may replay setup before the first frame. Only an actual start,
    // timeout or user interruption consumes the one-shot request.
    return () => stop(false);
  }, [pointRequest, shown, snapshot.available, open, characterRestoring, snapshot.mode, screen, language, calmMotion, walk.start, walk.stop]);
  useEffect(() => {
    if ((targetCue?.phase === "approaching" || targetCue?.phase === "returning") && !walk.active) cancelPoint.current?.();
  }, [walk.active, targetCue?.phase]);
  const petRect = { ...petPosition, ...petSize };
  const cardWidth = bookyCardWidth(view, petRect);
  const cardView = bookyCardViewport(view, petSize, navigation);
  // Use measured typography so native text zoom also reflows the card without
  // applying a second font multiplier. Leave room for a whole action below the
  // sticky heading, including the deliberate recovery action after a read error.
  // The action row does not wrap with the title, so returning to normal text
  // can also return to the compact heading without a layout feedback loop.
  const expandedText = cardTextSize.controls > 52;
  const minimumCardHeight = expandedText ? Math.max(200, cardTextSize.heading + cardTextSize.action + 24) : 200;
  const maxCardHeight = Math.max(bookyCardHeightLimit(cardView, petRect, cardWidth),
    expandedText ? Math.min(minimumCardHeight, Math.max(0, cardView.height - MARGIN * 2)) : 0);
  const height = Math.min(cardHeight, maxCardHeight);
  const cardObstacles = highlight && highlight.width * highlight.height < view.width * view.height * .45
    ? [...navigation, highlight] : navigation;
  const cardPosition = open ? placeBookyCard({ left: petPosition.left - cardWidth - MARGIN,
    top: petPosition.top + petSize.height - height }, { width: cardWidth, height }, cardView, petRect, cardObstacles, minimumCardHeight)
    : { left: 0, top: 0, width: cardWidth, height };
  const perform = (action: PlanetMascotAction) => {
    const performed = controller.act(action, snapshot.revision, () => onAction(action));
    if (performed) { setGesture("rest"); setReactionKey(value => value + 1); }
    return performed;
  };
  const restoreCharacter = () => {
    const current = controller.getSnapshot(), owner = characterOwner.current;
    if (owner.state !== "fallback" || !characterMounted.current || current.revision !== snapshot.revision
      || !current.available || current.visibility !== "shown" || current.panel !== "open" || document.hidden || drag.current) return;
    // Claim the attempt synchronously: repeated activation cannot queue a remount.
    const next = { attempt: owner.attempt + 1, recoveryAttempt: true, state: "loading" as const };
    characterOwner.current = next;
    cancelPoint.current?.(); walk.stop();
    if (pointRequest) handledPoint.current = pointRequest.id;
    walkStopActivation.current = null;
    setTargetCue(null); setGesture("rest"); setPointerLook(null); setPageTurn(0);
    heading.current?.focus({ preventScroll: true });
    setCharacter(next);
  };
  const playGesture = (next: BookyGesture) => {
    const current = controller.getSnapshot();
    // Play is local presentation only. A stale or backgrounded control cannot
    // replay a gesture or change saved tours, reading history or permissions.
    if (current.revision !== snapshot.revision || !current.available || current.visibility !== "shown"
      || current.panel !== "open" || document.hidden || drag.current
      || characterOwner.current.recoveryAttempt && characterOwner.current.state === "loading") return false;
    setPointerLook(null); setGesture(next); setReactionKey(value => value + 1);
    return true;
  };
  const canStopGesture = BOOKY_GESTURES.some(value => value === gesture);
  const openGestures = () => {
    const current = controller.getSnapshot(), panel = card.current;
    const gallery = gestureGallery.current, summary = gestureSummary.current;
    if (current.revision !== snapshot.revision || !current.available || current.visibility !== "shown"
      || current.panel !== "open" || document.hidden || drag.current || !panel || !gallery || !summary) return;
    gallery.open = true;
    summary.focus({ preventScroll: true });
    // Move only this reading page, keeping its sticky Stop/Close controls clear
    // of the gallery heading. Opening the gallery never starts a gesture.
    const headerHeight = heading.current?.parentElement?.getBoundingClientRect().height ?? 0;
    panel.scrollTop += summary.getBoundingClientRect().top - panel.getBoundingClientRect().top - headerHeight - 8;
  };
  const stopGesture = () => {
    const current = controller.getSnapshot();
    if (!canStopGesture || current.revision !== snapshot.revision || !current.available
      || current.visibility !== "shown" || current.panel !== "open" || document.hidden || drag.current) return;
    // Ordinary rest cancels the reaction without starting another animation.
    // The selected tour still owns its contextual pointing pose.
    setGesture("rest"); setPointerLook(null);
  };
  const navigateTips = (action: () => boolean) => {
    focusAfterNavigation.current = Boolean(card.current?.contains(document.activeElement));
    if (!action()) focusAfterNavigation.current = false;
  };
  const retryPreference = () => {
    if (open) { navigateTips(onRetryPersistence); return; }
    // A closed/hidden companion can retry without changing its preference.
    // Keep focus on the stable toggle when the retry control disappears.
    if (onRetryPersistence()) toggle.current?.focus({ preventScroll: true });
  };
  const move = (next: Position) => {
    dockDetached.current = Boolean(dock);
    onPositionChange(clamped(next, petSize.width, petSize.height, view));
  };
  const resetPosition = () => {
    const current = controller.getSnapshot();
    if (current.revision !== snapshot.revision || !current.available || current.visibility !== "shown"
      || current.panel !== "open" || current.mode !== "help" || document.hidden || drag.current) return;
    cancelPoint.current?.(); walk.stop();
    dockDetached.current = false;
    setPointerLook(null); setGesture("rest");
    onPositionChange(null);
    // This deliberate touch action changes presentation only. Keep the helper
    // visible and return focus through the existing panel-close owner.
    controller.togglePanel();
  };
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const intent = drag.current;
    if (intent?.pointerId !== event.pointerId) return;
    if (intent.source === "avatar") suppressAvatarClick.current = intent.moved && event.type !== "pointercancel";
    drag.current = null;
    setGesture("rest");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const followPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!shown) return;
    const intent = drag.current;
    if (intent?.source === "avatar" && intent.pointerId === event.pointerId) {
      const dx = event.clientX - intent.x, dy = event.clientY - intent.y;
      if (!intent.moved && Math.hypot(dx, dy) < 6) return;
      intent.moved = true;
      event.preventDefault(); setGesture("dragging");
      move({ left: intent.origin.left + dx, top: intent.origin.top + dy });
      return;
    }
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height) * 2 - 1));
    setPointerLook(previous => previous && Math.abs(previous.x - x) < .025 && Math.abs(previous.y - y) < .025 ? previous : { x, y });
  };
  const guidedLook = open && highlight ? {
    x: Math.max(-1, Math.min(1, (highlight.left + highlight.width / 2 - petPosition.left - petSize.width / 2) / Math.max(1, view.width / 2))),
    y: Math.max(-1, Math.min(1, (highlight.top + highlight.height / 2 - petPosition.top - petSize.height / 2) / Math.max(1, view.height / 2))),
  } : { x: 0, y: 0 };
  const contextual = writerLabel ?? countryLabel;
  const primaryAction: PlanetMascotAction | null = step?.requiredScreen && step.requiredScreen !== screen
    ? step.requiredScreen === "globe" ? "return-globe" : "books" : step?.action ?? null;
  const actionLabel = (action: PlanetMascotAction) => ({
    search: ru ? "Поиск" : "Search", country: ru ? "Выбрать страну" : "Choose a country",
    writer: ru ? "Писатели страны" : "Country writers", books: ru ? "К книгам" : "Explore books",
    "writer-books": ru ? "Книги писателя" : "Books by this writer",
    "writer-books-all": ru ? "Все доступные книги писателя" : "All available books by this writer",
    appearance: ru ? "Оформление" : "Appearance", "return-globe": ru ? "К глобусу" : "Return to globe",
    "random-country": ru ? "Случайная страна" : "Random country",
    recent: ru ? "Недавно открытое" : "Recently opened",
    downloads: ru ? "Загрузки и память" : "Downloads and storage",
    graphics: ru ? "Настройки графики" : "Graphics settings",
  })[action];
  const gestureCopy: Record<BookyGesture, { label: string; response: string; symbol: string }> = {
    greeting: { label: ru ? "Помахать" : "Wave", response: ru ? "Рад тебя видеть! Куда отправимся?" : "Lovely to see you! Where shall we go?", symbol: "✦" },
    nod: { label: ru ? "Кивнуть" : "Nod", response: ru ? "Я рядом. Продолжим в твоём темпе." : "I'm here. Let's go at your pace.", symbol: "✓" },
    curious: { label: ru ? "Посмотреть в лупу" : "Take a closer look", response: ru ? "Интересно, что мы найдём дальше?" : "I wonder what we'll discover next?", symbol: "⌕" },
    happy: { label: ru ? "Радоваться" : "Celebrate", response: ru ? "Немного радости в наше путешествие!" : "A little joy for our journey!", symbol: "☆" },
    reassuring: { label: ru ? "Подбодрить" : "Encourage", response: ru ? "Можно не спешить. Давай по одному шагу." : "There's no rush. One step at a time.", symbol: "♡" },
    wink: { label: ru ? "Подмигнуть" : "Wink", response: ru ? "У хорошей истории всегда есть продолжение." : "Every good story has more to discover.", symbol: "✧" },
    sway: { label: ru ? "Покачаться" : "Sway", response: ru ? "Маленькая пауза — и снова к открытиям." : "A little pause, then back to discovering.", symbol: "∿" },
    dance: { label: ru ? "Потанцевать" : "Dance", response: ru ? "Лови мой книжный ритм!" : "Here's my bookish beat!", symbol: "♫" },
    hop: { label: ru ? "Подпрыгнуть" : "Hop", response: ru ? "Прыг — навстречу приключениям!" : "A little leap toward adventure!", symbol: "↑" },
    twirl: { label: ru ? "Покружиться" : "Twirl", response: ru ? "Разворот на целую историю!" : "A whole story in one turn!", symbol: "↻" },
    stretch: { label: ru ? "Потянуться" : "Stretch", response: ru ? "Разомнёмся между историями." : "A stretch between stories.", symbol: "↟" },
    shy: { label: ru ? "Посмущаться" : "Act shy", response: ru ? "Ой, кажется, я немного смущаюсь." : "Oh, I'm feeling a little shy.", symbol: "❀" },
    highfive: { label: ru ? "Дай пять!" : "High five!", response: ru ? "Пять! Хорошо путешествовать вместе." : "High five! Adventures are better together.", symbol: "✋" },
    bow: { label: ru ? "Поклониться" : "Take a bow", response: ru ? "Этот маленький поклон — для тебя!" : "This little bow is for you!", symbol: "❧" },
    balance: { label: ru ? "На одной ножке" : "Balance", response: ru ? "Держу равновесие… и лупу тоже!" : "Keeping my balance… and my magnifier!", symbol: "⚖" },
  };
  const tipKind = screen === "collection" ? "collection" : writerLabel ? "writer" : countryLabel ? "country" : "globe";
  const helpTip = {
    globe: ru ? "Начните со страны на глобусе или найдите писателя через поиск. Могу показать путь от страны к книгам."
      : "Start with a country on the globe or search for a writer. I can show you the route from a country to books.",
    country: ru ? "Страна выбрана. В её архиве можно выбрать писателя, а затем перейти к его книгам."
      : "A country is selected. Choose a writer in its archive, then explore their books.",
    writer: ru ? "Писатель выбран. Откройте его книги или продолжите исследовать архив страны."
      : "A writer is selected. Open their books or keep exploring the country's archive.",
    collection: ru ? "Вы в коллекции. Здесь можно искать книги, менять фильтры и открывать карточки. К глобусу можно вернуться в любой момент."
      : "You are in the collection. Search books, adjust filters and open their details. You can return to the globe at any time.",
  }[tipKind];
  const authorFeedback = {
    idle: null,
    loading: ru ? "Готовим список книг писателя. Если открыта книга, закройте её, чтобы продолжить."
      : "Preparing the writer's books. If a book is open, close it to continue.",
    applied: ru ? "Список книг писателя готов." : "The writer's book list is ready.",
    "no-books": ru ? "В каталоге пока нет доступных книг этого писателя." : "This writer has no available books in the catalog yet.",
    "filtered-empty": ru ? "Выбранные фильтры скрывают книги этого писателя. Измените фильтры в коллекции и повторите попытку."
      : "The current filters hide this writer's books. Adjust the collection filters and try again.",
    invalid: ru ? "Выберите писателя заново, чтобы открыть его книги." : "Select the writer again to open their books.",
    "load-failed": ru ? "Не удалось загрузить книги. Повторите попытку." : "Could not load the books. Please try again.",
  }[snapshot.authorBooksStatus];
  const stepStatus = snapshot.canAdvance ? ru ? "Этот шаг готов — можно продолжить." : "This step is ready. You can continue."
    : step?.requiredScreen === "globe" && screen !== "globe" ? ru ? "Вернитесь к глобусу, чтобы продолжить." : "Return to the globe to continue."
    : snapshot.route === "country-to-book" && step?.requirement === "collection" && snapshot.authorBooksStatus !== "applied" && authorFeedback ? authorFeedback
    : step?.requiredScreen === "collection" && screen !== "collection" ? ru ? "Откройте коллекцию, чтобы продолжить." : "Open the collection to continue."
    : step?.requirement === "collection" && (snapshot.support?.id === "books-error" || snapshot.support?.id === "books-loading")
      ? ru ? "Продолжить можно, когда коллекция откроется." : "You can continue when the collection opens."
    : step?.requirement === "country" ? ru ? "Сначала выберите страну." : "Choose a country first."
    : step?.requirement === "writer" ? ru ? "Сначала выберите писателя в архиве страны." : "Choose a writer in the country's archive first."
    : ru ? "Откройте книги писателя, чтобы завершить этот шаг." : "Open the writer's books to complete this step.";

  const persistenceNotice = persistence.state !== "idle" && <div className="planet-mascot-controls__persistence"
    data-planet-mascot-preference-state={persistence.state} role="status" aria-live="polite" aria-atomic="true">
    <p>{persistence.state === "failed"
      ? persistence.error === "unsupported"
        ? ru ? "Эта версия не может прочитать сохранённые маршруты. Сохранение не изменяется. Обновите приложение или повторите загрузку."
          : "This version cannot read your saved tours. The saved data is being kept unchanged. Update the app or try loading again."
      : persistence.error === "read"
        ? ru ? "Не удалось восстановить настройки помощника." : "Could not restore your companion settings."
        : ru ? "Не удалось сохранить ваш выбор." : "Could not save your choice."
      : persistence.state === "loading"
        ? ru ? "Восстанавливаем настройки помощника…" : "Restoring companion settings…"
        : ru ? "Сохраняем ваш выбор…" : "Saving your choice…"}</p>
    {persistence.state === "failed" && <button type="button" data-planet-mascot-retry-preference=""
      onClick={retryPreference}>{ru ? "Повторить" : "Try again"}</button>}
  </div>;

  if (!snapshot.available) return null;
  return <>
    {targetCue && targetCue.phase !== "returning" && <div className="planet-mascot-target" aria-hidden="true" data-booky-target={targetCue.phase}
      data-booky-calm={calmMotion ? "true" : undefined}
      data-booky-target-action={targetCue.action} style={{ left: targetCue.touch.left - 20, top: targetCue.touch.top - 20 }} />}
    {open && highlight && snapshot.highlight && <div className="planet-mascot-highlight" aria-hidden="true"
      data-planet-mascot-highlight={snapshot.highlight} style={highlight as CSSProperties} />}
    <div ref={root} className="planet-mascot-controls" data-planet-mascot-pet=""
      data-booky-calm={calmMotion ? "true" : undefined}
      data-booky-expanded-text={expandedText ? "true" : undefined}
      data-planet-mascot-active={shown ? "true" : "false"} data-planet-mascot-visibility={snapshot.visibility}
      data-planet-mascot-panel-state={open ? "open" : "closed"}
      data-planet-mascot-mode={snapshot.mode} data-planet-mascot-current-route={snapshot.route ?? "none"}
      data-planet-mascot-step={snapshot.step} data-planet-mascot-screen={screen} data-planet-mascot-gesture={walk.active ? "walking" : gesture}
      data-booky-returning={targetCue?.phase === "returning" ? "true" : undefined}
      data-planet-mascot-closed-notice={!open && persistence.state !== "idle" ? "true" : undefined}
      style={{ ...petPosition, left: `min(${petPosition.left}px, var(--booky-dock-max-left, ${petPosition.left}px))` }}
      onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
      onPointerMove={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()} onKeyDown={event => {
        // Native collection owns its Tab loop; an already collapsed companion
        // must also let Escape reach that surrounding panel.
        if (event.key === "Tab") return;
        if (event.key === "Escape") {
          const intent = drag.current;
          if (intent) {
            event.preventDefault(); event.stopPropagation();
            drag.current = null; suppressAvatarClick.current = intent.source === "avatar";
            onPositionChange(intent.origin); setGesture("rest"); setPointerLook(null);
            if (intent.element.hasPointerCapture(intent.pointerId)) intent.element.releasePointerCapture(intent.pointerId);
            return;
          }
          if (open) { event.preventDefault(); event.stopPropagation(); controller.togglePanel(); }
          return;
        }
        event.stopPropagation();
      }}>
      <button ref={toggle} type="button" className={shown ? "planet-mascot-controls__avatar-button" : "planet-mascot-controls__show"}
        data-planet-mascot-toggle="" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={shown ? ru ? `Подсказки: ${name}` : `Tips from ${name}` : ru ? `Показать: ${name}` : `Show ${name}`}
        aria-describedby={shown ? `${id}-move` : undefined}
        onPointerDown={event => {
          if (!shown || !event.isPrimary || event.button !== 0) return;
          suppressAvatarClick.current = false;
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: petPosition,
            source: "avatar", moved: false, element: event.currentTarget };
          event.currentTarget.setPointerCapture(event.pointerId);
        }} onPointerMove={followPointer} onPointerUp={endDrag} onPointerCancel={endDrag}
        onLostPointerCapture={event => {
          const intent = drag.current;
          if (intent?.pointerId !== event.pointerId) return;
          if (intent.source === "avatar" && intent.moved) suppressAvatarClick.current = true;
          drag.current = null; setGesture("rest");
        }}
        onPointerLeave={() => { if (!drag.current) { setPointerLook(null); setGesture("rest"); } }}
        onClick={event => {
          if (event.detail > 0 && suppressAvatarClick.current) { suppressAvatarClick.current = false; return; }
          if (!characterRestoring) { setGesture("greeting"); setReactionKey(value => value + 1); }
          controller.togglePanel();
        }}>
        {shown ? <PlanetMascotAvatar key={character.attempt} attempt={character.attempt}
          recoveryAttempt={character.recoveryAttempt} onRendererState={onCharacterState} src={mascotImage} mood={snapshot.completedRoute ? "celebrate" : snapshot.mode === "tour" ? "guiding" : "idle"}
          lookAt={walk.active ? { x: walk.direction * .45, y: 0 } : pointerLook ?? guidedLook}
          interaction={walk.active ? "walking" : gesture === "rest" && open && highlight ? "pointing" : gesture}
          reactionKey={reactionKey} active={snapshot.available} calmMotion={calmMotion} /> : name}
      </button>
      {shown && <div className="planet-mascot-controls__tools">
        <button type="button" data-planet-mascot-move="" className="planet-mascot-controls__move"
          aria-label={ru ? "Переместить помощника" : "Move the companion"} aria-describedby={`${id}-move`}
          title={ru ? "Перетащите или используйте стрелки. Home — исходное место." : "Drag or use arrow keys. Home resets the position."}
          onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0) return;
            event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
            if (dock) { dockDetached.current = true; onPositionChange(petPosition); }
            drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: petPosition,
              source: "handle", moved: true, element: event.currentTarget };
            setGesture("dragging");
            event.currentTarget.setPointerCapture(event.pointerId);
          }} onPointerMove={event => {
            const intent = drag.current; if (!intent || intent.pointerId !== event.pointerId) return;
            event.preventDefault(); move({ left: intent.origin.left + event.clientX - intent.x, top: intent.origin.top + event.clientY - intent.y });
          }} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={event => {
            if (drag.current?.pointerId !== event.pointerId) return;
            drag.current = null; setGesture("rest");
          }}
          onKeyDown={event => {
            if (event.key === "Home") { event.preventDefault(); dockDetached.current = false; onPositionChange(null); return; }
            const direction = arrowDirections[event.key];
            if (!direction) return;
            event.preventDefault(); const distance = event.shiftKey ? 30 : 10;
            move({ left: petPosition.left + direction[0] * distance, top: petPosition.top + direction[1] * distance });
          }}><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />
          </svg></button>
        <button type="button" data-planet-mascot-hide="" onClick={() => controller.hide()}
          aria-label={ru ? "Скрыть помощника" : "Hide the companion"} title={ru ? "Скрыть" : "Hide"}>
          <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg></button>
        <span id={`${id}-move`} className="planet-mascot-controls__sr-only">
          {ru ? "Нажмите на Книжулика для подсказок или перетащите его за фигурку. Для перемещения с клавиатуры используйте кнопку со стрелками. Home возвращает исходное положение."
            : "Tap Mr. Booky for tips or drag the character to move him. Use the arrow button for keyboard movement. Home restores the default position."}
        </span>
      </div>}
      {shown && <button type="button" className="planet-mascot-controls__walk"
        data-booky-walk={walk.active ? undefined : ""} data-booky-walk-stop={walk.active ? "" : undefined}
        disabled={!walk.active && !walk.canStart}
        title={walk.reducedMotion ? ru ? "Включено уменьшенное движение" : "Reduced motion is enabled"
          : open ? ru ? "Сверните подсказки, чтобы начать прогулку" : "Collapse the tips to start a walk"
          : walkNeedsSpace ? ru ? "Пока мало свободного места для прогулки" : "There is not enough clear space to walk here"
          : ru ? "Короткая прогулка по свободному месту" : "A short walk through a clear area"}
        onPointerDown={event => {
          if (event.isPrimary && event.button === 0) walkStopActivation.current = walk.active ? "pointer" : null;
        }}
        onPointerCancel={() => { walkStopActivation.current = null; }}
        onBlur={() => {
          if (walkStopActivation.current === "keyboard") walkStopActivation.current = null;
        }}
        onKeyDown={event => {
          // One held Enter is one intent even after Stop becomes Start.
          if (event.key === "Enter" && event.repeat) event.preventDefault();
          if (!event.repeat && (event.key === "Enter" || event.key === " ")) {
            walkStopActivation.current = walk.active ? "keyboard" : null;
          }
        }}
        onClick={event => {
          // A finite walk can finish while a finger is still holding Stop.
          // Preserve that initial intent when the same button becomes Start.
          const stopping = walkStopActivation.current === (event.detail > 0 ? "pointer" : "keyboard");
          walkStopActivation.current = null;
          if (walk.active || stopping) { cancelPoint.current?.(); walk.stop(); return; }
          if (controller.getSnapshot().revision !== snapshot.revision) return;
          if (walk.start()) { setGesture("rest"); setPointerLook(null); setReactionKey(value => value + 1); }
        }}><span aria-hidden="true">{walk.active ? "Ⅱ" : "↝"}</span> {walk.active
          ? ru ? "Остановить" : "Stop walking"
          : walkNeedsSpace ? ru ? "Мало места" : "No room"
          : ru ? "Прогуляться" : "Take a walk"}</button>}
      {!open && persistenceNotice}
      {open && <section ref={card} id={id} role="region" aria-labelledby={`${id}-title`} data-planet-mascot-panel=""
        className="planet-mascot-controls__panel" style={{ left: cardPosition.left, top: cardPosition.top,
          width: cardPosition.width, maxHeight: cardPosition.height }}>
        <div className="planet-mascot-controls__leaf" data-planet-mascot-leaf={pageTurn}
          style={pageTurn ? { animationName: pageTurn % 2 ? "booky-leaf-reveal-a" : "booky-leaf-reveal-b" } : undefined}>
        <header className="planet-mascot-controls__heading">
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{name}</h2>
          <div className="planet-mascot-controls__heading-actions">
            <button type="button" data-booky-stop-gesture="" disabled={!canStopGesture} onClick={stopGesture}
              aria-label={ru ? "Остановить жест" : "Stop gesture"} title={ru ? "Остановить жест" : "Stop gesture"}>
              {ru ? "Стоп" : "Stop"}
            </button>
            <button type="button" data-planet-mascot-collapse="" onClick={() => controller.togglePanel()}
              aria-label={ru ? "Свернуть подсказки" : "Collapse tips"}>×</button>
          </div>
        </header>
        {(character.state === "fallback" || characterRestoring) && <div className="planet-mascot-controls__support"
          data-booky-character-recovery={characterRestoring ? "loading" : "fallback"}>
          <p id={`${id}-character-status`} role="status" aria-live="polite" aria-atomic="true">{characterRestoring
            ? ru ? "Восстанавливаем персонажа… Подсказки доступны." : "Restoring the character… Tips are still available."
            : ru ? "Книжулик пока отображается картинкой. Подсказки доступны." : "Mr. Booky is shown as a picture for now. Tips are still available."}</p>
          <button type="button" data-booky-character-retry="" disabled={characterRestoring}
            aria-describedby={`${id}-character-status`} onClick={restoreCharacter}
            onKeyDown={event => { if (event.key === "Enter" && event.repeat) event.preventDefault(); }}>
            {characterRestoring ? ru ? "Восстановление…" : "Restoring…" : ru ? "Восстановить персонажа" : "Restore character"}
          </button>
        </div>}
        {contextual && <p className="planet-mascot-controls__context">{ru ? "Выбрано: " : "Selected: "}{contextual}</p>}
        <button type="button" className="planet-mascot-controls__quiet" data-booky-open-gestures=""
          aria-controls={`${id}-gestures`} onClick={openGestures}>
          {ru ? "Поиграть с Книжуликом" : "Play with Mr. Booky"}
        </button>
        {snapshot.support && <div className="planet-mascot-controls__support" data-booky-support={snapshot.support.id}>
          <div role="status" aria-live="polite" aria-atomic="true">
            <h3>{snapshot.support.title[language]}</h3>
            <p>{snapshot.support.body[language]}</p>
          </div>
          {snapshot.support.retry && <button type="button" data-booky-retry-content={snapshot.support.retry}
            onClick={() => {
              const target = snapshot.support?.retry;
              if (target) navigateTips(() => controller.retryContent(target, snapshot.revision, () => onRetryContent(target)));
            }}>{ru ? "Повторить загрузку" : "Try loading again"}</button>}
          {snapshot.support.kind === "error" && screen === "collection" && <button type="button"
            data-booky-recovery-return="" onClick={() => perform("return-globe")}>
            {ru ? "Вернуться к глобусу" : "Return to the globe"}
          </button>}
        </div>}
        {snapshot.authorBooksStatus === "filtered-empty" && controller.canAct("writer-books-all") &&
          <div className="planet-mascot-controls__support" data-booky-writer-filter-recovery="">
            <p id={id + "-writer-filter-recovery"}>{ru
              ? "Сброшу фильтры и открою весь каталог для выбранного писателя. Сохранённые полки не изменятся."
              : "I’ll clear the filters and open the full catalog for the selected writer. Your saved shelves will stay unchanged."}</p>
            <button type="button" data-booky-show-all-writer-books="" aria-describedby={id + "-writer-filter-recovery"}
              onClick={() => {
                if (!document.hidden && !drag.current && perform("writer-books-all")) heading.current?.focus({ preventScroll: true });
              }}>{actionLabel("writer-books-all")}</button>
          </div>}
        {tour && step ? <>
          <p className="planet-mascot-controls__progress">
            {ru ? `Шаг ${snapshot.step + 1} из ${tour.steps.length}` : `Step ${snapshot.step + 1} of ${tour.steps.length}`}
          </p>
          <p className="planet-mascot-controls__progress" data-booky-tour-progress={snapshot.route!}>
            {progressText(snapshot.route!)}
          </p>
          <h3 ref={tourHeading} tabIndex={-1}>{step.title[language]}</h3><p>{step.body[language]}</p>
          <p className="planet-mascot-controls__feedback" data-planet-mascot-step-status={snapshot.canAdvance ? "ready" : "waiting"}
            data-planet-mascot-author-books-status={step.requirement === "collection" ? snapshot.authorBooksStatus : undefined}
            role="status" aria-live="polite" aria-atomic="true">{stepStatus}</p>
          {primaryAction && <button type="button" className="planet-mascot-controls__primary"
            data-planet-mascot-action={primaryAction} disabled={!controller.canAct(primaryAction)} onClick={() => perform(primaryAction)}>
            {primaryAction === step.action ? step.actionLabel?.[language] ?? actionLabel(primaryAction) : actionLabel(primaryAction)}
          </button>}
          <div className="planet-mascot-controls__navigation">
            <button type="button" data-planet-mascot-back="" disabled={snapshot.step === 0}
              onClick={() => navigateTips(() => controller.back(snapshot.revision))}>{ru ? "Назад" : "Back"}</button>
            <button type="button" data-planet-mascot-next="" disabled={!snapshot.canAdvance}
              onClick={() => navigateTips(() => controller.next(snapshot.revision))}>
              {snapshot.step + 1 === tour.steps.length ? ru ? "Готово" : "Done" : ru ? "Далее" : "Next"}
            </button>
          </div>
          <button type="button" data-planet-mascot-finish="" className="planet-mascot-controls__quiet"
            onClick={() => navigateTips(() => controller.finish(snapshot.revision))}>{ru ? "Выйти из маршрута" : "Leave the tour"}</button>
        </> : <>
          {savedTour && savedStep && <div className="planet-mascot-controls__resume" data-planet-mascot-resume-offer="">
            <h3>{ru ? "Продолжим маршрут?" : "Continue your tour?"}</h3>
            <p>{savedTour.title[language]}<br /><span>{savedStep.title[language]}</span></p>
            <div className="planet-mascot-controls__resume-actions">
              <button type="button" className="planet-mascot-controls__primary" data-planet-mascot-resume=""
                onClick={() => navigateTips(() => controller.resume(snapshot.revision))}>
                {ru ? "Продолжить маршрут" : "Resume tour"}
              </button>
              <button type="button" data-planet-mascot-discard-resume=""
                onClick={() => navigateTips(() => controller.discardResume(snapshot.revision))}>
                {ru ? "Убрать предложение" : "Dismiss resume offer"}
              </button>
            </div>
          </div>}
          {snapshot.completedRoute && <p className="planet-mascot-controls__feedback" role="status" aria-live="polite"
            data-planet-mascot-completion={snapshot.completedRoute}>
            {ru ? `Маршрут «${PLANET_MASCOT_ROUTES[snapshot.completedRoute].title.ru}» завершён. Можно продолжить самостоятельно или выбрать другой.`
              : `The “${PLANET_MASCOT_ROUTES[snapshot.completedRoute].title.en}” tour is complete. Continue exploring or choose another tour.`}
          </p>}
          <p data-planet-mascot-context-tip={tipKind}>{helpTip}</p>
          {authorFeedback && <p className="planet-mascot-controls__feedback" role="status" aria-live="polite" aria-atomic="true"
            data-planet-mascot-author-books-status={snapshot.authorBooksStatus}>{authorFeedback}</p>}
          <div className="planet-mascot-controls__routes">
            {(["overview", "country-to-book"] as const).map(route => <button key={route} type="button"
              data-planet-mascot-route={route} onClick={() => navigateTips(() => controller.start(route))}>
              {isBookyRouteComplete(snapshot.progress, route) ? ru ? "Повторить: " : "Revisit: " : ""}{PLANET_MASCOT_ROUTES[route].title[language]}
              <span data-booky-tour-progress={route}>{progressText(route)}</span>
            </button>)}
          </div>
          <div className="planet-mascot-controls__actions">
            {(["search", "books", ...(countryLabel ? ["writer" as const] : []),
              ...(writerLabel ? ["writer-books" as const] : []),
              screen === "collection" ? "return-globe" : "appearance"] as PlanetMascotAction[]).map(action => (
              <button key={action} type="button" data-planet-mascot-action={action}
                disabled={!controller.canAct(action)} onClick={() => perform(action)}>{actionLabel(action)}</button>
            ))}
          </div>
          <details className="planet-mascot-controls__extras" data-booky-useful-actions="">
            <summary>{ru ? "Полезные действия" : "Useful actions"}</summary>
            <p>{ru ? "Выберем новое место, вернёмся к знакомой книге или настроим приложение под тебя."
              : "Discover somewhere new, return to a familiar book or make the app comfortable for you."}</p>
            <div className="planet-mascot-controls__actions">
              {(["random-country", "recent", "downloads", "graphics"] as const).map(action => <button key={action}
                type="button" data-planet-mascot-action={action} disabled={!controller.canAct(action)}
                onClick={() => perform(action)}>{actionLabel(action)}</button>)}
              <button type="button" data-booky-reset-position="" onClick={resetPosition}>
                {ru ? "Вернуть на место" : "Return to default spot"}
              </button>
            </div>
          </details>
        </>}
        <details ref={gestureGallery} id={`${id}-gestures`} className="planet-mascot-controls__extras planet-mascot-controls__gestures" data-booky-gestures="">
          <summary ref={gestureSummary}>{ru ? "Жесты Книжулика" : "Mr. Booky’s gestures"}</summary>
          <p>{ru ? "Нажми на жест — я отвечу. Можно повторить сколько хочется. Кнопка «Стоп» рядом с моим именем остановит жест."
            : "Choose a gesture and I'll respond. Try it again whenever you like. Use Stop beside my name to end a gesture."}</p>
          <div data-booky-motion-notice="" role="status" aria-live="polite" aria-atomic="true">
            {walk.reducedMotion && <p className="planet-mascot-controls__response">
              {walk.systemReducedMotion
                ? ru ? "Меньше движения: все жесты доступны как неподвижные позы."
                  : "Reduced motion is on. All gestures are available as still poses."
                : ru ? "Спокойные движения: жесты показываются неподвижными позами."
                  : "Calm movements: gestures appear as still poses."}
            </p>}
          </div>
          <div className="planet-mascot-controls__motion">
            <button type="button" role="switch" data-booky-calm-motion="" aria-checked={motion.mode === "calm"}
              disabled={!motion.hydrated} aria-describedby={`${id}-motion-status`}
              onClick={() => {
                const current = controller.getSnapshot();
                if (current.revision === snapshot.revision && current.available && current.visibility === "shown"
                  && current.panel === "open" && !document.hidden && !drag.current) {
                  onMotionChange(motion.mode === "calm" ? "system" : "calm");
                }
              }}><span aria-hidden="true">{motion.mode === "calm" ? "✓" : "○"}</span> {ru ? "Спокойные движения" : "Calm movements"}</button>
            <div id={`${id}-motion-status`} data-booky-motion-save-status="" role="status" aria-live="polite" aria-atomic="true">
              {motion.state === "loading" && <p>{ru ? "Загружаем настройку движения…" : "Loading the movement setting…"}</p>}
              {motion.state === "saving" && <p>{ru ? "Сохраняем настройку…" : "Saving the setting…"}</p>}
              {motion.state === "failed" && <p>{motion.error === "read"
                ? ru ? "Не удалось прочитать настройку. Пока движения уменьшены." : "The setting could not be read. Movements are reduced for now."
                : ru ? "Не удалось подтвердить сохранение. Выбор действует до закрытия приложения." : "Saving could not be confirmed. Your choice applies until the app closes."}</p>}
            </div>
            {motion.state === "failed" && !motion.hydrated && <>
              <p id={`${id}-motion-recovery`}>{ru
                ? "Можно заменить только эту настройку на спокойные движения. Остальные настройки и прогресс сохранятся."
                : "You can replace just this setting with calm movements. Your other settings and progress will stay."}</p>
              <button type="button" data-booky-motion-recover="" aria-describedby={`${id}-motion-recovery`} onClick={() => {
                const current = controller.getSnapshot();
                if (current.revision === snapshot.revision && current.available && current.visibility === "shown"
                  && current.panel === "open" && !document.hidden && !drag.current && onRecoverMotion()) {
                  heading.current?.focus({ preventScroll: true });
                }
              }}>{ru ? "Заменить на спокойные движения" : "Replace with calm movements"}</button>
            </>}
            {motion.state === "failed" && <button type="button" data-booky-motion-retry="" onClick={() => {
              const current = controller.getSnapshot();
              if (current.revision === snapshot.revision && current.available && current.visibility === "shown"
                && current.panel === "open" && !document.hidden && !drag.current && onRetryMotion()) {
                heading.current?.focus({ preventScroll: true });
              }
            }}>
              {ru ? "Повторить" : "Try again"}
            </button>}
          </div>
          <div className="planet-mascot-controls__actions">
            <button type="button" data-booky-surprise="" disabled={characterRestoring} onClick={() => {
              const next = pickBookySurprise(surpriseSequence.current, gesture);
              if (playGesture(next.gesture)) surpriseSequence.current = next.state;
            }}><span aria-hidden="true">✦</span> {ru ? "Удиви меня" : "Surprise me"}</button>
            {BOOKY_GESTURES.map(value => <button key={value} type="button" data-booky-gesture={value}
              aria-pressed={gesture === value} disabled={characterRestoring} onClick={() => playGesture(value)}>
              <span className="planet-mascot-controls__gesture-symbol" aria-hidden="true">{gestureCopy[value].symbol}</span>
              <span>{gestureCopy[value].label}</span>
            </button>)}
          </div>
          <p className="planet-mascot-controls__response" role="status" aria-live="polite" aria-atomic="true"
            data-booky-gesture-response="">{gesture !== "rest" && gesture !== "dragging" && gesture !== "pointing" ? gestureCopy[gesture].response
              : ru ? "Давай познакомимся поближе." : "Let's get to know each other."}</p>
        </details>
        {readerSettings}
        {persistenceNotice}
        <div className="planet-mascot-controls__reset">
          <button ref={resetStart} type="button" data-booky-reset-progress="" className="planet-mascot-controls__quiet"
            onClick={() => setResetAtRevision(snapshot.revision)}>{ru ? "Сбросить сохранённые маршруты" : "Reset saved tours"}</button>
          {resetAtRevision !== null && <div role="group" aria-labelledby={`${id}-reset-title`}>
            <p id={`${id}-reset-title`}>{ru ? "Сбросить всё сохранение маршрутов помощника на этом устройстве? Отменить сброс нельзя."
              : "Reset all saved companion tours on this device? This cannot be undone."}</p>
            <button ref={resetConfirm} type="button" data-booky-confirm-reset=""
              onClick={() => navigateTips(() => {
                const reset = controller.resetSavedProgress(resetAtRevision);
                if (reset && card.current) card.current.scrollTop = 0;
                return reset;
              })}>
              {ru ? "Сбросить" : "Reset"}
            </button>
            <button type="button" data-booky-cancel-reset="" onClick={() => { setResetAtRevision(null); resetStart.current?.focus(); }}>
              {ru ? "Отмена" : "Cancel"}
            </button>
          </div>}
        </div>
        </div>
      </section>}
    </div>
  </>;
}
