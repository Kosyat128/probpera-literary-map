import {
  PLANET_MASCOT_ROUTES, getPlanetMascotStep,
  type PlanetMascotAction, type PlanetMascotRoute, type PlanetMascotScreen, type PlanetMascotTarget,
} from "./planetMascotRoutes";
import { DEFAULT_BOOKY_PREFERENCE, parseBookyPreference,
  type BookyPreference, type BookySavedTour } from "./planetMascotPreference";
import { getBookySupport, type BookySupportInput } from "./bookySupport";
import { acknowledgeBookyStep, isBookyRouteComplete, type BookyTourProgress } from "./bookyTourProgress";

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
  connectivity?: BookySupportInput["connectivity"];
  countryStatus?: BookySupportInput["countryStatus"];
  booksStatus?: BookySupportInput["booksStatus"];
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
  /** A saved route is only an offer, never navigation or proof of completion. */
  resumeOffer: BookySavedTour | null;
  /** Explicit user intent only; context-derived UI transitions do not save. */
  intentRevision: number;
  support: ReturnType<typeof getBookySupport>;
  progress: readonly BookyTourProgress[];
}>;
export type PlanetMascotPreferenceIntent = Readonly<{ revision: number; value: BookyPreference; allowOverwrite: boolean; resumeExplicit: boolean }>;
type State = Pick<PlanetMascotSnapshot, "visibility" | "panel" | "mode" | "route" | "step">
  & Partial<Pick<PlanetMascotSnapshot, "completedRoute" | "resumeOffer">>;
const resting: State = Object.freeze({ visibility: "hidden", panel: "closed", mode: "help", route: null, step: 0 });

/** Local adult navigation assistant. No camera, DOM, storage IO, network,
 * timers, background activity, content generation or child authorization. */
export function createPlanetMascotController() {
  let context: PlanetMascotContext | null = null, disposed = false;
  let preferenceIntent: PlanetMascotPreferenceIntent = Object.freeze({ revision: 0, value: DEFAULT_BOOKY_PREFERENCE,
    allowOverwrite: false, resumeExplicit: false });
  let resumeIntentRevision = 0, resetIntentRevision = 0;
  let snapshot: PlanetMascotSnapshot = Object.freeze({ ...resting, available: false,
    revision: 0, canAdvance: false, highlight: null, completedRoute: null, authorBooksStatus: "idle",
    resumeOffer: null, intentRevision: 0, support: null, progress: DEFAULT_BOOKY_PREFERENCE.progress });
  const contentRetries = new Set<"countries" | "books">();
  const listeners = new Set<() => void>();
  const authorized = () => !disposed && context?.enabled === true && context.access === "adult"
    && (context.screen === "globe" || context.screen === "collection");
  const eligible = () => authorized() && context?.active === true;
  const current = (revision: number) => Number.isSafeInteger(revision) && revision === snapshot.revision;
  const opened = () => eligible() && snapshot.visibility === "shown" && snapshot.panel === "open";

  function publish(state: State, force = false) {
    const available = eligible();
    const completedRoute = state.completedRoute ?? null;
    const resumeOffer = state.resumeOffer ?? null;
    const authorBooksStatus = context?.authorBooksStatus ?? "idle";
    const support = available && context ? getBookySupport({ screen: context.screen,
      connectivity: context.connectivity ?? "unknown", countryStatus: context.countryStatus ?? "idle",
      booksStatus: context.booksStatus ?? "idle" }) : null;
    const step = state.mode === "tour" ? getPlanetMascotStep(state.route, state.step) : null;
    const onScreen = step !== null && (step.requiredScreen === null || step.requiredScreen === context?.screen);
    const canAdvance = available && state.visibility === "shown" && state.panel === "open" && onScreen
      && (step!.requirement === "none"
        || step!.requirement === "country" && context?.selectedCountry === true
        || step!.requirement === "writer" && context?.selectedCountry === true && context.selectedWriter === true
        || step!.requirement === "collection" && context?.screen === "collection" && context.booksStatus === "ready"
          && (state.route !== "country-to-book" || context.selectedWriter && authorBooksStatus === "applied"));
    const highlight = available && state.visibility === "shown" && state.panel === "open" && onScreen
      ? step!.target : null;
    if (!force && snapshot.available === available && snapshot.visibility === state.visibility
      && snapshot.panel === state.panel && snapshot.mode === state.mode && snapshot.route === state.route
      && snapshot.step === state.step && snapshot.canAdvance === canAdvance && snapshot.highlight === highlight
      && snapshot.completedRoute === completedRoute && snapshot.authorBooksStatus === authorBooksStatus
      && snapshot.resumeOffer === resumeOffer && snapshot.intentRevision === preferenceIntent.revision
      && snapshot.support === support) return false;
    const next: PlanetMascotSnapshot = Object.freeze({ ...state, available, canAdvance, highlight, completedRoute,
      authorBooksStatus, resumeOffer, intentRevision: preferenceIntent.revision, support, progress: preferenceIntent.value.progress,
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

  function accept(state: State, force = false, progress = preferenceIntent.value.progress, allowOverwrite = false) {
    if (!force && state.visibility === snapshot.visibility && state.panel === snapshot.panel
      && state.mode === snapshot.mode && state.route === snapshot.route && state.step === snapshot.step
      && (state.resumeOffer ?? null) === snapshot.resumeOffer && (state.completedRoute ?? null) === snapshot.completedRoute) return false;
    const activeStep = state.mode === "tour" ? getPlanetMascotStep(state.route, state.step) : null;
    const value = parseBookyPreference({ schemaVersion: 2, audience: "adult", visible: state.visibility === "shown",
      resume: activeStep && state.route
        ? { route: state.route, routeVersion: PLANET_MASCOT_ROUTES[state.route].version, stepId: activeStep.id }
        : state.resumeOffer ?? null, progress });
    if (!value) return false;
    const old = preferenceIntent.value;
    const sameResume = JSON.stringify(old.resume) === JSON.stringify(value.resume);
    const sameValue = old.visible === value.visible && sameResume && JSON.stringify(old.progress) === JSON.stringify(value.progress);
    // Establish ownership before notifying even a reentrant listener. Collapsing
    // a panel still fences a late read, although its stored value is unchanged.
    const revision = preferenceIntent.revision + 1;
    if (!sameResume || allowOverwrite) resumeIntentRevision = revision;
    if (allowOverwrite) resetIntentRevision = revision;
    preferenceIntent = Object.freeze({ revision, value: sameValue ? old : value, allowOverwrite, resumeExplicit: resumeIntentRevision > 0 });
    return publish(state, true);
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
    return accept({ visibility: "shown", panel: "open", mode: "help", route: null, step: 0,
      resumeOffer: preferenceIntent.value.resume });
  }

  return Object.freeze({
    getSnapshot: () => snapshot,
    getPreferenceIntent: () => preferenceIntent,
    restorePreference(value: unknown, expectedIntentRevision: number) {
      if (!eligible() || !Number.isSafeInteger(expectedIntentRevision)
        || expectedIntentRevision !== preferenceIntent.revision) return false;
      const record = parseBookyPreference(value);
      if (!record) return false;
      preferenceIntent = Object.freeze({ revision: preferenceIntent.revision, value: record, allowOverwrite: false,
        resumeExplicit: resumeIntentRevision > 0 });
      return publish({ ...resting, visibility: record.visible ? "shown" : "hidden", resumeOffer: record.resume }, true);
    },
    adoptPendingPreference(value: unknown, expectedRevision: number, resumeExplicit: boolean) {
      if (!eligible() || !Number.isSafeInteger(expectedRevision) || expectedRevision !== preferenceIntent.revision
        || typeof resumeExplicit !== "boolean") return false;
      const record = parseBookyPreference(value);
      if (!record) return false;
      const revision = preferenceIntent.revision + 1;
      if (resumeExplicit) resumeIntentRevision = revision;
      preferenceIntent = Object.freeze({ revision, value: record, allowOverwrite: false, resumeExplicit });
      return publish({ ...resting, visibility: record.visible ? "shown" : "hidden", resumeOffer: record.resume }, true);
    },
    mergePreference(value: unknown, readRevision: number) {
      if (!eligible() || !Number.isSafeInteger(readRevision) || readRevision < 0
        || readRevision >= preferenceIntent.revision || resetIntentRevision > readRevision) return false;
      const record = parseBookyPreference(value);
      if (!record) return false;
      // A late authoritative read must not undo current visibility/navigation,
      // nor may the local visibility choice erase previously saved progress.
      const merged = new Map<string, BookyTourProgress>();
      for (const entry of [...record.progress, ...preferenceIntent.value.progress]) {
        const key = `${entry.route}:${entry.routeVersion}`, previous = merged.get(key);
        merged.set(key, { ...entry, acknowledgedStepIds: [...new Set([
          ...(previous?.acknowledgedStepIds ?? []), ...entry.acknowledgedStepIds,
        ])] });
      }
      return accept({ ...snapshot, resumeOffer: resumeIntentRevision > readRevision
        ? snapshot.resumeOffer : record.resume }, true, [...merged.values()]);
    },
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
        authorBooksStatus: value.authorBooksStatus ?? "idle", connectivity: value.connectivity ?? "unknown",
        countryStatus: value.countryStatus ?? "idle", booksStatus: value.booksStatus ?? "idle" });
      if (context && context.enabled === next.enabled && context.access === next.access && context.active === next.active
        && context.screen === next.screen && context.selectedCountry === next.selectedCountry
        && context.selectedWriter === next.selectedWriter && context.selectionKey === next.selectionKey
        && context.authorBooksStatus === next.authorBooksStatus && context.connectivity === next.connectivity
        && context.countryStatus === next.countryStatus && context.booksStatus === next.booksStatus) return;
      context = next;
      // Connection/locale/panel changes do not create a new failed load.
      // Re-arm only after the real target leaves its current error state.
      if (next.countryStatus !== "error") contentRetries.delete("countries");
      if (next.booksStatus !== "error") contentRetries.delete("books");
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
        route: snapshot.route, step, completedRoute: snapshot.completedRoute, resumeOffer: snapshot.resumeOffer }, true);
    },
    show() {
      if (!eligible() || snapshot.visibility === "shown") return false;
      return accept({ ...resting, visibility: "shown", resumeOffer: snapshot.resumeOffer ?? preferenceIntent.value.resume });
    },
    hide() {
      if (!eligible()) return false;
      return accept({ ...resting, resumeOffer: preferenceIntent.value.resume });
    },
    togglePanel() {
      if (!eligible()) return false;
      return accept({ visibility: "shown", mode: snapshot.mode, route: snapshot.route, step: snapshot.step,
        completedRoute: snapshot.completedRoute, resumeOffer: snapshot.mode === "tour" ? null
          : snapshot.resumeOffer ?? preferenceIntent.value.resume,
        panel: snapshot.visibility === "shown" && snapshot.panel === "open" ? "closed" : "open" });
    },
    start(route: PlanetMascotRoute) {
      if (!eligible() || (route !== "overview" && route !== "country-to-book")) return false;
      return accept({ visibility: "shown", panel: "open", mode: "tour", route, step: 0 }, true);
    },
    resume(revision = snapshot.revision) {
      if (!eligible() || !current(revision) || !snapshot.resumeOffer) return false;
      const { route, stepId } = snapshot.resumeOffer;
      let step = PLANET_MASCOT_ROUTES[route].steps.findIndex(candidate => candidate.id === stepId);
      if (step < 0) return false;
      if (route === "country-to-book") {
        if (!context?.selectedCountry) step = 0;
        else if (!context.selectedWriter) step = Math.min(step, 1);
      }
      return accept({ visibility: "shown", panel: "open", mode: "tour", route, step });
    },
    discardResume(revision = snapshot.revision) {
      if (!eligible() || !current(revision) || !snapshot.resumeOffer) return false;
      return accept({ visibility: snapshot.visibility, panel: snapshot.panel, mode: snapshot.mode,
        route: snapshot.route, step: snapshot.step, completedRoute: snapshot.completedRoute });
    },
    next(revision = snapshot.revision) {
      if (!opened() || !current(revision) || snapshot.mode !== "tour" || !snapshot.route || !snapshot.canAdvance) return false;
      const route = snapshot.route, definition = PLANET_MASCOT_ROUTES[route];
      const progress = acknowledgeBookyStep(preferenceIntent.value.progress, route, definition.steps[snapshot.step].id);
      if (snapshot.step + 1 === PLANET_MASCOT_ROUTES[snapshot.route].steps.length) {
        const complete = isBookyRouteComplete(progress, route);
        const acknowledged = progress.find(entry => entry.route === route && entry.routeVersion === definition.version)?.acknowledgedStepIds ?? [];
        const firstPending = definition.steps.find(step => !acknowledged.includes(step.id));
        return accept({ visibility: "shown", panel: "open", mode: "help", route: null, step: 0,
          completedRoute: complete ? route : null, resumeOffer: firstPending
            ? { route, routeVersion: definition.version, stepId: firstPending.id } : null }, true, progress);
      }
      return accept({ visibility: "shown", panel: "open", mode: "tour", route, step: snapshot.step + 1 }, true, progress);
    },
    back(revision = snapshot.revision) {
      if (!opened() || !current(revision) || snapshot.mode !== "tour" || !snapshot.route || snapshot.step === 0) return false;
      return accept({ visibility: "shown", panel: "open", mode: "tour", route: snapshot.route, step: snapshot.step - 1 });
    },
    finish,
    resetSavedProgress(revision = snapshot.revision) {
      if (!eligible() || !current(revision)) return false;
      return accept({ ...resting, visibility: snapshot.visibility, panel: snapshot.panel }, true, [], true);
    },
    canAct,
    retryContent(target: "countries" | "books", revision: number, callback: () => void) {
      if (!opened() || !current(revision) || contentRetries.has(target)
        || snapshot.support?.retry !== target || typeof callback !== "function") return false;
      // Only an explicit currently offered recovery may invoke the existing
      // loader. One attempt owns each observed content failure, even if an
      // unrelated connection update changes the surrounding snapshot.
      contentRetries.add(target);
      try { callback(); return true; }
      catch { contentRetries.delete(target); return false; }
    },
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
