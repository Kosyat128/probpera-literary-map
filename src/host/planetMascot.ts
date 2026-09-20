import {
  PLANET_MASCOT_ROUTES, getPlanetMascotStep,
  type PlanetMascotAction, type PlanetMascotRoute, type PlanetMascotScreen, type PlanetMascotTarget,
} from "./planetMascotRoutes";

export type PlanetMascotAuthorBooksStatus = "idle" | "loading" | "applied" | "no-books" | "filtered-empty" | "invalid" | "load-failed";
export type PlanetMascotContext = Readonly<{
  enabled: boolean;
  access: "adult" | "child" | "blocked";
  active: boolean;
  screen: PlanetMascotScreen;
  selectedCountry: boolean;
  selectedWriter: boolean;
  /** Canonical selection identity fences callbacks even when both flags stay true. */
  selectionKey?: string;
  authorBooksStatus?: PlanetMascotAuthorBooksStatus;
}>;
export type PlanetMascotSnapshot = Readonly<{
  available: boolean;
  visibility: "shown" | "hidden";
  panel: "open" | "closed";
  mode: "help" | "tour";
  route: PlanetMascotRoute | null;
  step: number;
  /** Bind event handlers to the state that actually offered their action. */
  revision: number;
  canAdvance: boolean;
  highlight: PlanetMascotTarget | null;
  /** Acknowledgement of navigation instructions completed, never reading progress. */
  completedRoute: PlanetMascotRoute | null;
  authorBooksStatus: PlanetMascotAuthorBooksStatus;
}>;
type State = Pick<PlanetMascotSnapshot, "visibility" | "panel" | "mode" | "route" | "step">
  & Partial<Pick<PlanetMascotSnapshot, "completedRoute">>;
const resting: State = Object.freeze({ visibility: "hidden", panel: "closed", mode: "help", route: null, step: 0 });

/** Local adult navigation assistant. No camera, DOM, persistence, network,
 * timers, background activity, content generation or child authorization. */
export function createPlanetMascotController() {
  let context: PlanetMascotContext | null = null, disposed = false;
  let snapshot: PlanetMascotSnapshot = Object.freeze({ ...resting, available: false,
    revision: 0, canAdvance: false, highlight: null, completedRoute: null, authorBooksStatus: "idle" });
  const listeners = new Set<() => void>();
  const authorized = () => !disposed && context?.enabled === true && context.access === "adult"
    && (context.screen === "globe" || context.screen === "collection");
  const eligible = () => authorized() && context?.active === true;
  const current = (revision: number) => Number.isSafeInteger(revision) && revision === snapshot.revision;
  const opened = () => eligible() && snapshot.visibility === "shown" && snapshot.panel === "open";

  function publish(state: State, force = false) {
    const available = eligible();
    const completedRoute = state.completedRoute ?? null;
    const authorBooksStatus = context?.authorBooksStatus ?? "idle";
    const step = state.mode === "tour" ? getPlanetMascotStep(state.route, state.step) : null;
    const onScreen = step !== null && (step.requiredScreen === null || step.requiredScreen === context?.screen);
    const canAdvance = available && state.visibility === "shown" && state.panel === "open" && onScreen
      && (step!.requirement === "none"
        || step!.requirement === "country" && context?.selectedCountry === true
        || step!.requirement === "writer" && context?.selectedCountry === true && context.selectedWriter === true
        || step!.requirement === "collection" && context?.screen === "collection"
          && (state.route !== "country-to-book" || context.selectedWriter && authorBooksStatus === "applied"));
    const highlight = available && state.visibility === "shown" && state.panel === "open" && onScreen
      ? step!.target : null;
    if (!force && snapshot.available === available && snapshot.visibility === state.visibility
      && snapshot.panel === state.panel && snapshot.mode === state.mode && snapshot.route === state.route
      && snapshot.step === state.step && snapshot.canAdvance === canAdvance && snapshot.highlight === highlight
      && snapshot.completedRoute === completedRoute && snapshot.authorBooksStatus === authorBooksStatus) return false;
    const next: PlanetMascotSnapshot = Object.freeze({ ...state, available, canAdvance, highlight, completedRoute, authorBooksStatus,
      revision: snapshot.revision + 1 });
    snapshot = next;
    for (const listener of [...listeners]) {
      // A listener can hide, change permission or dispose synchronously. Never
      // deliver a stale transition to the remaining observers after it does.
      if (snapshot !== next) break;
      if (listeners.has(listener)) { try { listener(); } catch { /* An observer cannot own navigation. */ } }
    }
    return snapshot === next;
  }

  function canAct(action: PlanetMascotAction) {
    if (!opened()) return false;
    if (action === "return-globe") return context?.screen === "collection";
    if (action === "writer-books") return snapshot.mode === "help" && context?.selectedCountry === true && context.selectedWriter === true;
    if (action !== "search" && action !== "country" && action !== "writer" && action !== "books" && action !== "appearance") return false;
    if (action === "appearance" && context?.screen !== "globe") return false;
    if (action === "writer" && !context?.selectedCountry) return false;
    if (snapshot.mode === "tour") {
      const step = getPlanetMascotStep(snapshot.route, snapshot.step);
      if (!step || step.action !== action) return false;
      if (snapshot.route === "country-to-book" && action === "books"
        && (!context?.selectedCountry || !context.selectedWriter)) return false;
    }
    return true;
  }

  function finish(revision = snapshot.revision) {
    if (!opened() || !current(revision) || snapshot.mode !== "tour") return false;
    return publish({ visibility: "shown", panel: "open", mode: "help", route: null, step: 0 });
  }

  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setContext(value: PlanetMascotContext) {
      if (disposed) return;
      const next = Object.freeze({ enabled: value.enabled, access: value.access, active: value.active,
        screen: value.screen, selectedCountry: value.selectedCountry,
        selectedWriter: value.selectedCountry && value.selectedWriter, selectionKey: value.selectionKey,
        authorBooksStatus: value.authorBooksStatus ?? "idle" });
      if (context && context.enabled === next.enabled && context.access === next.access && context.active === next.active
        && context.screen === next.screen && context.selectedCountry === next.selectedCountry
        && context.selectedWriter === next.selectedWriter && context.selectionKey === next.selectionKey
        && context.authorBooksStatus === next.authorBooksStatus) return;
      context = next;
      if (!authorized()) { publish(resting, true); return; }
      let step = snapshot.step;
      // A route cannot keep offering an author/book action from a country that
      // has been left. Restoring permission does not reopen a cancelled tour.
      if (snapshot.mode === "tour" && snapshot.route === "country-to-book") {
        if (!next.selectedCountry) step = 0;
        else if (!next.selectedWriter && step > 1) step = 1;
      }
      // Background suspension closes the bubble and removes the highlight, but
      // keeps the user's place. Resume requires an explicit panel toggle.
      publish({ visibility: snapshot.visibility, panel: next.active ? snapshot.panel : "closed", mode: snapshot.mode,
        route: snapshot.route, step, completedRoute: snapshot.completedRoute }, true);
    },
    show() {
      if (!eligible() || snapshot.visibility === "shown") return false;
      return publish({ ...resting, visibility: "shown" });
    },
    hide() {
      if (disposed) return false;
      return publish(resting);
    },
    togglePanel() {
      if (!eligible()) return false;
      return publish({ visibility: "shown", mode: snapshot.mode, route: snapshot.route, step: snapshot.step,
        completedRoute: snapshot.completedRoute,
        panel: snapshot.visibility === "shown" && snapshot.panel === "open" ? "closed" : "open" });
    },
    start(route: PlanetMascotRoute) {
      if (!eligible() || (route !== "overview" && route !== "country-to-book")) return false;
      return publish({ visibility: "shown", panel: "open", mode: "tour", route, step: 0 }, true);
    },
    next(revision = snapshot.revision) {
      if (!opened() || !current(revision) || snapshot.mode !== "tour" || !snapshot.route || !snapshot.canAdvance) return false;
      if (snapshot.step + 1 === PLANET_MASCOT_ROUTES[snapshot.route].steps.length) {
        return publish({ visibility: "shown", panel: "open", mode: "help", route: null, step: 0,
          completedRoute: snapshot.route });
      }
      return publish({ visibility: "shown", panel: "open", mode: "tour", route: snapshot.route, step: snapshot.step + 1 });
    },
    back(revision = snapshot.revision) {
      if (!opened() || !current(revision) || snapshot.mode !== "tour" || !snapshot.route || snapshot.step === 0) return false;
      return publish({ visibility: "shown", panel: "open", mode: "tour", route: snapshot.route, step: snapshot.step - 1 });
    },
    finish,
    canAct,
    act(action: PlanetMascotAction, revision: number, callback: () => void) {
      if (!current(revision) || !canAct(action) || typeof callback !== "function") return false;
      // Invoking an existing App action is not evidence that it completed.
      // Only the subsequent real context can unlock the next route step.
      try { callback(); return true; } catch { return false; }
    },
    dispose() {
      if (disposed) return;
      disposed = true; context = null; publish(resting); listeners.clear();
    },
  });
}

export type PlanetMascotController = ReturnType<typeof createPlanetMascotController>;
