import { describe, expect, it, vi } from "vitest";
import { createPlanetMascotController, type PlanetMascotContext } from "./planetMascot";
import { PLANET_MASCOT_ROUTES, getPlanetMascotStep } from "./planetMascotRoutes";

const ready = (value: Partial<PlanetMascotContext> = {}): PlanetMascotContext => ({
  enabled: true, access: "adult", active: true, screen: "globe",
  connectivity: "online", countryStatus: "ready", booksStatus: "ready",
  selectedCountry: false, selectedWriter: false, ...value,
});
const savedBooks = { schemaVersion: 1, audience: "adult", visible: true,
  resume: { route: "country-to-book", stepId: "open-books" } } as const;
const migratedBooks = { ...savedBooks, schemaVersion: 2,
  resume: { ...savedBooks.resume, routeVersion: 1 }, progress: [] } as const;

describe("adult local guided companion", () => {
  it("requires adult permission and explicit showing, cancels on hide or invalidation without resuming", () => {
    const controller = createPlanetMascotController();
    expect(controller.getSnapshot()).toMatchObject({ available: false, visibility: "hidden", panel: "closed",
      mode: "help", route: null, highlight: null });
    expect(controller.show()).toBe(false); expect(controller.start("overview")).toBe(false);
    for (const invalid of [ready({ enabled: false }), ready({ access: "child" }), ready({ access: "blocked" })]) {
      controller.setContext(invalid); expect(controller.togglePanel()).toBe(false);
      controller.setContext(ready()); expect(controller.getSnapshot().visibility).toBe("hidden");
      expect(controller.show()).toBe(true); expect(controller.getSnapshot().panel).toBe("closed");
      expect(controller.start("overview")).toBe(true);
      controller.setContext(invalid);
      expect(controller.getSnapshot()).toMatchObject({ visibility: "hidden", panel: "closed", mode: "help", route: null, highlight: null });
    }
    controller.setContext(ready()); controller.start("country-to-book"); controller.hide();
    expect(controller.next()).toBe(false); expect(controller.getSnapshot().route).toBeNull();
    controller.togglePanel(); controller.start("overview"); controller.next(); controller.togglePanel();
    expect(controller.getSnapshot()).toMatchObject({ visibility: "shown", panel: "closed", route: "overview", step: 1, highlight: null });
    expect(controller.next()).toBe(false);
    controller.togglePanel(); expect(controller.getSnapshot()).toMatchObject({ mode: "tour", step: 1, highlight: "country" });
    controller.setContext(ready({ active: false }));
    expect(controller.getSnapshot()).toMatchObject({ available: false, visibility: "shown", panel: "closed",
      mode: "tour", route: "overview", step: 1, highlight: null, canAdvance: false });
    expect(controller.next()).toBe(false); expect(controller.togglePanel()).toBe(false);
    controller.setContext(ready());
    expect(controller.getSnapshot()).toMatchObject({ available: true, panel: "closed", route: "overview", step: 1 });
    controller.togglePanel(); expect(controller.getSnapshot()).toMatchObject({ step: 1, panel: "open", canAdvance: true });
  });

  it("unlocks country-to-book steps only from actual country, writer and collection context", () => {
    const controller = createPlanetMascotController(); controller.setContext(ready()); controller.start("country-to-book");
    const countryAction = vi.fn();
    expect(controller.next()).toBe(false);
    expect(controller.act("country", controller.getSnapshot().revision, countryAction)).toBe(true);
    expect(countryAction).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ step: 0, canAdvance: false });
    controller.setContext(ready({ selectedCountry: true }));
    expect(controller.next()).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ step: 1, canAdvance: false, highlight: "writer" });
    expect(controller.canAct("books")).toBe(false);
    controller.setContext(ready({ selectedCountry: true, selectedWriter: true }));
    expect(controller.next()).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ step: 2, canAdvance: false, highlight: null });
    expect(controller.act("books", controller.getSnapshot().revision, () => undefined)).toBe(true);
    expect(controller.next()).toBe(false); // Dispatching a navigation action is not its completion.
    for (const authorBooksStatus of ["idle", "loading", "no-books", "filtered-empty", "invalid", "load-failed"] as const) {
      controller.setContext(ready({ selectedCountry: true, selectedWriter: true, screen: "collection", authorBooksStatus }));
      expect(controller.getSnapshot().canAdvance).toBe(false);
      expect(controller.next()).toBe(false); expect(controller.getSnapshot().completedRoute).toBeNull();
    }
    controller.setContext(ready({ selectedCountry: true, selectedWriter: true, screen: "collection", authorBooksStatus: "applied" }));
    expect(controller.getSnapshot()).toMatchObject({ canAdvance: true, highlight: "books" });
    expect(controller.next()).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ panel: "open", mode: "help", route: null, highlight: null,
      completedRoute: "country-to-book" });
    const finished = controller.getSnapshot();
    expect(controller.next()).toBe(false); expect(controller.getSnapshot()).toBe(finished);
    controller.start("country-to-book"); expect(controller.getSnapshot().completedRoute).toBeNull();
    controller.finish(); expect(controller.getSnapshot().completedRoute).toBeNull();
    expect(controller.canAct("writer-books")).toBe(true);
    controller.start("overview"); expect(controller.canAct("writer-books")).toBe(false);
    controller.finish(); controller.setContext(ready({ selectedCountry: true }));
    expect(controller.canAct("writer-books")).toBe(false);
  });

  it("keeps the route across screen changes, hides unavailable targets and ignores identical locale-only contexts", () => {
    const controller = createPlanetMascotController(); controller.setContext(ready()); controller.start("overview");
    expect(controller.next()).toBe(true); expect(controller.next()).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ step: 2, canAdvance: false, highlight: null });
    controller.setContext(ready({ screen: "collection" }));
    const current = controller.getSnapshot(), changed = vi.fn(), stop = controller.subscribe(changed);
    controller.setContext({ ...ready({ screen: "collection" }) }); // Locale is owned outside this controller.
    expect(controller.getSnapshot()).toBe(current); expect(changed).not.toHaveBeenCalled(); stop();
    expect(controller.next()).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ step: 3, canAdvance: false, highlight: null });
    expect(controller.canAct("return-globe")).toBe(true);
    expect(controller.next()).toBe(false);
    controller.setContext(ready());
    expect(controller.getSnapshot()).toMatchObject({ step: 3, canAdvance: true, highlight: "appearance" });
    expect(getPlanetMascotStep("overview", 3)?.action).toBe("appearance");
    expect(controller.canAct("appearance")).toBe(true);
    expect(controller.next()).toBe(true);
    for (const route of Object.values(PLANET_MASCOT_ROUTES)) {
      expect(Object.isFrozen(route.steps)).toBe(true);
      for (const step of route.steps) {
        expect(step.title.ru.length).toBeGreaterThan(0); expect(step.title.en.length).toBeGreaterThan(0);
        expect(step.body.ru.length).toBeGreaterThan(0); expect(step.body.en.length).toBeGreaterThan(0);
      }
    }
  });

  it("rewinds dependent steps when their actual selection is cleared and fences old UI actions", () => {
    const controller = createPlanetMascotController(), invoke = vi.fn();
    controller.setContext(ready({ selectedCountry: true, selectedWriter: true })); controller.start("country-to-book");
    controller.next(); controller.next();
    const bookRevision = controller.getSnapshot().revision;
    controller.setContext(ready({ selectedCountry: true }));
    expect(controller.getSnapshot()).toMatchObject({ step: 1, canAdvance: false });
    expect(controller.act("books", bookRevision, invoke)).toBe(false);
    const writerRevision = controller.getSnapshot().revision;
    controller.setContext(ready());
    expect(controller.getSnapshot()).toMatchObject({ step: 0, canAdvance: false });
    expect(controller.act("writer", writerRevision, invoke)).toBe(false);
    controller.setContext(ready({ selectedCountry: true }));
    const nextRevision = controller.getSnapshot().revision;
    expect(controller.next(nextRevision)).toBe(true); expect(controller.next(nextRevision)).toBe(false);
    expect(controller.back(nextRevision)).toBe(false);
    controller.hide(); controller.start("country-to-book");
    expect(controller.act("country", nextRevision, invoke)).toBe(false);
    expect(controller.finish(nextRevision)).toBe(false); expect(invoke).not.toHaveBeenCalled();
    const before = controller.getSnapshot();
    expect(controller.act("country", before.revision, () => { throw new Error("Navigation failed"); })).toBe(false);
    expect(controller.getSnapshot()).toBe(before);
    controller.setContext(ready({ selectedCountry: true, selectionKey: "a/writer" }));
    const oldSelection = controller.getSnapshot().revision;
    controller.setContext(ready({ selectedCountry: true, selectionKey: "b/writer" }));
    expect(controller.act("country", oldSelection, invoke)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not resurrect cancelled intent through reentrant observers or disposed callbacks", () => {
    const controller = createPlanetMascotController(), later: string[] = [], action = vi.fn();
    controller.setContext(ready());
    const stop = controller.subscribe(() => { if (controller.getSnapshot().mode === "tour") controller.hide(); });
    controller.subscribe(() => later.push(controller.getSnapshot().visibility));
    controller.subscribe(() => { throw new Error("Observer failed"); });
    expect(controller.start("overview")).toBe(false);
    expect(later).toEqual(["hidden"]);
    expect(controller.getPreferenceIntent()).toMatchObject({ revision: 2, value: { visible: false,
      resume: { route: "overview", routeVersion: 1, stepId: "search" }, progress: [] } });
    expect(controller.getSnapshot().intentRevision).toBe(2);
    expect(controller.act("search", controller.getSnapshot().revision, action)).toBe(false);
    stop(); controller.togglePanel();
    const revision = controller.getSnapshot().revision;
    const removed = vi.fn(), unsubscribe = controller.subscribe(removed); unsubscribe();
    controller.dispose(); const final = controller.getSnapshot(); controller.dispose();
    controller.setContext(ready());
    expect(controller.show()).toBe(false); expect(controller.togglePanel()).toBe(false);
    expect(controller.act("search", revision, action)).toBe(false);
    expect(controller.getSnapshot()).toBe(final); expect(removed).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });

  it("offers a saved tour without opening it and resumes only from current real prerequisites", () => {
    const controller = createPlanetMascotController(); controller.setContext(ready());
    expect(controller.restorePreference(savedBooks, 0)).toBe(true);
    const restored = controller.getPreferenceIntent();
    expect(restored.revision).toBe(0); expect(restored.value).toEqual(migratedBooks);
    expect(restored.value).not.toBe(savedBooks);
    expect(Object.isFrozen(restored)).toBe(true); expect(Object.isFrozen(restored.value.resume)).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ visibility: "shown", panel: "closed", mode: "help",
      route: null, step: 0, canAdvance: false, highlight: null, completedRoute: null,
      resumeOffer: savedBooks.resume, intentRevision: 0, authorBooksStatus: "idle" });
    controller.setContext(ready({ active: false })); controller.setContext(ready());
    expect(controller.getSnapshot()).toMatchObject({ panel: "closed", resumeOffer: savedBooks.resume });
    expect(controller.getPreferenceIntent()).toBe(restored);
    expect(controller.next()).toBe(false); expect(controller.canAct("books")).toBe(false);
    const closedRevision = controller.getSnapshot().revision;
    controller.togglePanel();
    expect(controller.resume(closedRevision)).toBe(false);
    expect(controller.resume()).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ panel: "open", mode: "tour", route: "country-to-book",
      step: 0, resumeOffer: null, canAdvance: false });
    expect(controller.getPreferenceIntent().value.resume).toEqual({ route: "country-to-book", routeVersion: 1, stepId: "choose-country" });

    const countryOnly = createPlanetMascotController(); countryOnly.setContext(ready({ selectedCountry: true }));
    countryOnly.restorePreference(savedBooks, 0); expect(countryOnly.resume()).toBe(true);
    expect(countryOnly.getSnapshot()).toMatchObject({ step: 1, canAdvance: false });
    expect(countryOnly.getPreferenceIntent().value.resume?.stepId).toBe("choose-writer");

    const writer = createPlanetMascotController();
    writer.setContext(ready({ selectedCountry: true, selectedWriter: true, screen: "collection" }));
    writer.restorePreference(savedBooks, 0); writer.resume();
    expect(writer.getSnapshot()).toMatchObject({ step: 2, canAdvance: false, completedRoute: null });
    expect(writer.next()).toBe(false); // No persisted author-book acknowledgement.
    writer.setContext(ready({ selectedCountry: true, selectedWriter: true, screen: "collection", authorBooksStatus: "applied" }));
    expect(writer.next()).toBe(true);
    expect(writer.getSnapshot().completedRoute).toBeNull();
    expect(writer.getPreferenceIntent().value).toMatchObject({ visible: true,
      resume: { route: "country-to-book", routeVersion: 1, stepId: "choose-country" },
      progress: [{ route: "country-to-book", routeVersion: 1, acknowledgedStepIds: ["open-books"] }] });
  });

  it("fences late restoration on explicit toggles and keeps dismissing separate from completing", () => {
    const controller = createPlanetMascotController(); controller.setContext(ready());
    const offered = { ...savedBooks, resume: { route: "overview", stepId: "appearance" } } as const;
    expect(controller.restorePreference(offered, 0)).toBe(true);
    const initial = controller.getPreferenceIntent();
    controller.togglePanel(); const opened = controller.getPreferenceIntent();
    controller.togglePanel(); const collapsed = controller.getPreferenceIntent();
    expect(opened.revision).toBe(initial.revision + 1);
    expect(collapsed.revision).toBe(opened.revision + 1);
    expect(collapsed.value).toBe(opened.value); // The save coordinator can deduplicate this unchanged record.
    expect(controller.restorePreference(savedBooks, opened.revision)).toBe(false);
    const oldSnapshotRevision = controller.getSnapshot().revision;
    controller.togglePanel();
    expect(controller.discardResume(oldSnapshotRevision)).toBe(false);
    expect(controller.discardResume()).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ mode: "help", resumeOffer: null, completedRoute: null });
    expect(controller.getPreferenceIntent().value).toMatchObject({ visible: true, resume: null });
    controller.start("overview"); controller.next(); controller.finish();
    expect(controller.getPreferenceIntent().value.resume).toEqual({ route: "overview", routeVersion: 1, stepId: "country" });
    expect(controller.getSnapshot().completedRoute).toBeNull();
    controller.start("overview"); const beforeHide = controller.getPreferenceIntent(); controller.hide();
    expect(controller.restorePreference(offered, beforeHide.revision)).toBe(false);
    expect(controller.getPreferenceIntent().value).toMatchObject({ visible: false,
      resume: { route: "overview", routeVersion: 1, stepId: "search" },
      progress: [{ route: "overview", routeVersion: 1, acknowledgedStepIds: ["search"] }] });
    const stable = controller.getPreferenceIntent(), view = controller.getSnapshot();
    expect(controller.restorePreference({ ...offered, resume: { route: "overview", stepId: "removed-step" } }, stable.revision)).toBe(false);
    expect(controller.restorePreference({ ...savedBooks, audience: "child" }, stable.revision)).toBe(false);
    expect(controller.getPreferenceIntent()).toBe(stable); expect(controller.getSnapshot()).toBe(view);
  });

  it("never saves context, suspension, permission resets or disposal over the adult intent", () => {
    const controller = createPlanetMascotController();
    controller.setContext(ready({ selectedCountry: true, selectedWriter: true }));
    const notified: [number, number][] = [];
    controller.subscribe(() => {
      notified.push([controller.getPreferenceIntent().revision, controller.getSnapshot().intentRevision]);
    });
    controller.start("country-to-book"); controller.next(); controller.next();
    expect(notified).toEqual([[1, 1], [2, 2], [3, 3]]);
    const intent = controller.getPreferenceIntent();
    expect(intent.value.resume).toEqual(migratedBooks.resume);
    controller.setContext(ready({ selectedCountry: true, active: false }));
    expect(controller.getSnapshot()).toMatchObject({ panel: "closed", step: 1, canAdvance: false });
    expect(controller.getPreferenceIntent()).toBe(intent);
    controller.setContext(ready()); // The visible prerequisite changes; the stored user intent does not.
    expect(controller.getSnapshot().step).toBe(0); expect(controller.getPreferenceIntent()).toBe(intent);
    controller.setContext(ready({ access: "child" }));
    expect(controller.getSnapshot()).toMatchObject({ visibility: "hidden", mode: "help", resumeOffer: null });
    expect(controller.hide()).toBe(false); expect(controller.resume()).toBe(false);
    expect(controller.discardResume()).toBe(false);
    expect(controller.restorePreference(savedBooks, intent.revision)).toBe(false);
    expect(controller.getPreferenceIntent()).toBe(intent);
    controller.setContext(ready({ access: "blocked" }));
    controller.setContext(ready({ enabled: false }));
    controller.dispose();
    expect(controller.getPreferenceIntent()).toBe(intent);
    expect(controller.restorePreference(savedBooks, intent.revision)).toBe(false);
    expect(notified.every(([intentRevision, viewRevision]) => intentRevision === viewRevision)).toBe(true);
  });
});

// Current loader and connection state may guide recovery, but must never
// become a persisted user command or proof that a failed page was opened.
describe("versioned adult navigation acknowledgements", () => {
  it("records only a successful current Next and keeps acknowledged steps through back, leave and hide", () => {
    const controller = createPlanetMascotController(); controller.setContext(ready());
    controller.start("overview");
    expect(controller.act("search", controller.getSnapshot().revision, vi.fn())).toBe(true);
    expect(controller.getSnapshot().progress).toEqual([]);
    const revision = controller.getSnapshot().revision;
    expect(controller.next(revision)).toBe(true);
    expect(controller.next(revision)).toBe(false);
    const acknowledged = [{ route: "overview", routeVersion: 1, acknowledgedStepIds: ["search"] }];
    expect(controller.getSnapshot().progress).toEqual(acknowledged);
    controller.back(); controller.next(); // Revisiting is not another acknowledgement.
    expect(controller.getSnapshot().progress).toEqual(acknowledged);
    controller.finish();
    expect(controller.getSnapshot()).toMatchObject({ mode: "help", resumeOffer: { route: "overview", routeVersion: 1, stepId: "country" } });
    controller.hide();
    expect(controller.getPreferenceIntent().value).toMatchObject({ visible: false, progress: acknowledged,
      resume: { route: "overview", routeVersion: 1, stepId: "country" } });
    controller.togglePanel(); expect(controller.getSnapshot().mode).toBe("help");
    controller.resume(); expect(controller.getSnapshot().step).toBe(1);
    controller.start("country-to-book");
    expect(controller.next()).toBe(false);
    expect(controller.getSnapshot().progress).toEqual(acknowledged);
    controller.setContext(ready({ selectedCountry: true })); controller.next();
    expect(controller.getSnapshot().progress).toHaveLength(2);
  });

  it("persists full completion only after every required step is acknowledged, without replaying celebration on restore", () => {
    const controller = createPlanetMascotController(); controller.setContext(ready());
    controller.start("overview"); controller.next(); controller.next();
    expect(controller.next()).toBe(false);
    controller.setContext(ready({ screen: "collection", booksStatus: "loading" }));
    expect(controller.next()).toBe(false);
    controller.setContext(ready({ screen: "collection" })); controller.next();
    controller.setContext(ready()); expect(controller.next()).toBe(true);
    expect(controller.getSnapshot().completedRoute).toBe("overview");
    const stored = controller.getPreferenceIntent().value;
    expect(stored.resume).toBeNull();
    expect(stored.progress).toEqual([{ route: "overview", routeVersion: 1,
      acknowledgedStepIds: ["search", "country", "collection", "appearance"] }]);
    const cold = createPlanetMascotController(); cold.setContext(ready()); cold.restorePreference(stored, 0);
    expect(cold.getSnapshot()).toMatchObject({ panel: "closed", mode: "help", completedRoute: null, progress: stored.progress });
    expect(cold.getPreferenceIntent().revision).toBe(0);
    cold.start("overview"); expect(cold.getSnapshot().step).toBe(0);
    expect(cold.getSnapshot().progress).toEqual(stored.progress);
  });

  it("restores hidden progress without permission or selection and resets only on a current explicit action", () => {
    const controller = createPlanetMascotController(); controller.setContext(ready());
    const saved = { schemaVersion: 2, audience: "adult", visible: false,
      resume: { route: "country-to-book", routeVersion: 1, stepId: "open-books" },
      progress: [{ route: "country-to-book", routeVersion: 1, acknowledgedStepIds: ["choose-country"] }] };
    expect(controller.restorePreference(saved, 0)).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ visibility: "hidden", panel: "closed", mode: "help", progress: saved.progress });
    controller.show(); expect(controller.getSnapshot().panel).toBe("closed");
    controller.resume(); expect(controller.getSnapshot()).toMatchObject({ step: 0, canAdvance: false });
    const stale = controller.getSnapshot().revision;
    controller.togglePanel(); expect(controller.resetSavedProgress(stale)).toBe(false);
    controller.setContext(ready({ access: "child" })); expect(controller.resetSavedProgress()).toBe(false);
    controller.setContext(ready()); controller.togglePanel();
    expect(controller.resetSavedProgress()).toBe(true);
    expect(controller.getPreferenceIntent()).toMatchObject({ allowOverwrite: true,
      value: { schemaVersion: 2, visible: true, resume: null, progress: [] } });
    expect(controller.getSnapshot()).toMatchObject({ mode: "help", route: null, completedRoute: null });
    controller.togglePanel(); expect(controller.getPreferenceIntent().allowOverwrite).toBe(false);
  });

  it("merges a late valid read without undoing a local visibility choice or erasing saved acknowledgements", () => {
    const controller = createPlanetMascotController(); controller.setContext(ready());
    const saved = { schemaVersion: 2, audience: "adult", visible: false,
      resume: { route: "overview", routeVersion: 1, stepId: "country" },
      progress: [{ route: "overview", routeVersion: 1, acknowledgedStepIds: ["search"] }] };
    controller.togglePanel();
    expect(controller.restorePreference(saved, 0)).toBe(false);
    expect(controller.mergePreference(saved, 0)).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ visibility: "shown", panel: "open", mode: "help", resumeOffer: saved.resume });
    expect(controller.getPreferenceIntent().value).toEqual({ ...saved, visible: true });
    expect(controller.getPreferenceIntent().allowOverwrite).toBe(false);
  });

  it("unions independent late progress, preserves the newer tour and never resurrects data after explicit reset", () => {
    const controller = createPlanetMascotController(); controller.setContext(ready({ selectedCountry: true }));
    const saved = { schemaVersion: 2, audience: "adult", visible: false,
      resume: { route: "overview", routeVersion: 1, stepId: "collection" },
      progress: [{ route: "overview", routeVersion: 1, acknowledgedStepIds: ["search", "country"] }] };
    controller.start("country-to-book"); controller.next();
    expect(controller.mergePreference(saved, 0)).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ mode: "tour", route: "country-to-book", step: 1, panel: "open" });
    expect(controller.getPreferenceIntent().value.resume).toEqual({ route: "country-to-book", routeVersion: 1, stepId: "choose-writer" });
    expect(controller.getSnapshot().progress).toHaveLength(2);
    const beforeReset = controller.getPreferenceIntent().revision;
    controller.resetSavedProgress(); controller.hide(); controller.show();
    expect(controller.mergePreference(saved, beforeReset)).toBe(false);
    expect(controller.getPreferenceIntent().value).toMatchObject({ visible: true, resume: null, progress: [] });
  });
});

describe("Booky recovery from live platform and content state", () => {
  it("requires an open adult panel and a current offered retry, fences duplicate and stale callbacks", () => {
    const controller = createPlanetMascotController();
    const retry = vi.fn();
    const context = ready({ screen: "collection", booksStatus: "error", connectivity: "offline" });
    controller.setContext(context);
    expect(controller.getSnapshot().support?.id).toBe("books-error");
    expect(controller.retryContent("books", controller.getSnapshot().revision, retry)).toBe(false);
    controller.togglePanel();
    const before = controller.getPreferenceIntent(), revision = controller.getSnapshot().revision;
    expect(controller.retryContent("countries", revision, retry)).toBe(false);
    expect(controller.retryContent("books", revision, retry)).toBe(true);
    expect(controller.retryContent("books", revision, retry)).toBe(false);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(controller.getPreferenceIntent()).toBe(before);
    controller.setContext({ ...context, connectivity: "online" });
    expect(controller.retryContent("books", controller.getSnapshot().revision, retry)).toBe(false);
    controller.togglePanel(); controller.togglePanel();
    expect(controller.retryContent("books", controller.getSnapshot().revision, retry)).toBe(false);
    const afterToggle = controller.getPreferenceIntent();
    controller.setContext({ ...context, booksStatus: "loading" });
    expect(controller.retryContent("books", revision, retry)).toBe(false);
    expect(controller.getSnapshot().support?.id).toBe("books-loading");
    controller.setContext(context);
    expect(controller.retryContent("books", controller.getSnapshot().revision, retry)).toBe(true);
    expect(retry).toHaveBeenCalledTimes(2);
    for (const blocked of [{ ...context, active: false }, { ...context, access: "child" as const },
      { ...context, access: "blocked" as const }, { ...context, enabled: false }]) {
      controller.setContext(blocked);
      expect(controller.getSnapshot().support).toBeNull();
      expect(controller.retryContent("books", controller.getSnapshot().revision, retry)).toBe(false);
    }
    expect(controller.getPreferenceIntent()).toBe(afterToggle);
    controller.dispose();
  });

  it("does not advance failed or pending collection steps, reopen tips, or save connectivity changes", () => {
    const controller = createPlanetMascotController();
    const context = ready({ screen: "collection", booksStatus: "loading" });
    controller.setContext(context);
    controller.restorePreference({ schemaVersion: 1, audience: "adult", visible: true,
      resume: { route: "overview", stepId: "collection" } }, 0);
    controller.resume();
    const intent = controller.getPreferenceIntent();
    expect(controller.getSnapshot().canAdvance).toBe(false); expect(controller.next()).toBe(false);
    controller.setContext({ ...context, booksStatus: "error" });
    expect(controller.getSnapshot().canAdvance).toBe(false); expect(controller.next()).toBe(false);
    expect(controller.getPreferenceIntent()).toBe(intent);
    controller.setContext({ ...context, screen: "globe", selectedCountry: true, selectedWriter: true, authorBooksStatus: "applied" });
    controller.start("country-to-book");
    controller.next(); controller.next();
    controller.setContext({ ...context, selectedCountry: true, selectedWriter: true, authorBooksStatus: "applied" });
    expect(controller.getSnapshot()).toMatchObject({ step: 2, canAdvance: false, completedRoute: null });
    controller.setContext({ ...context, booksStatus: "error", selectedCountry: true, selectedWriter: true, authorBooksStatus: "applied" });
    expect(controller.next()).toBe(false);
    controller.setContext({ ...context, screen: "globe" });
    controller.start("overview"); controller.next(); controller.next();
    const continuedIntent = controller.getPreferenceIntent();
    controller.setContext({ ...context, booksStatus: "ready", connectivity: "offline" });
    expect(controller.getSnapshot()).toMatchObject({ canAdvance: true, step: 2, completedRoute: null });
    expect(controller.getPreferenceIntent()).toBe(continuedIntent);
    controller.togglePanel();
    const collapsed = controller.getPreferenceIntent();
    for (const connectivity of ["online", "unknown", "offline"] as const) {
      controller.setContext({ ...context, booksStatus: "ready", connectivity });
      expect(controller.getSnapshot()).toMatchObject({ panel: "closed", step: 2, completedRoute: null });
      expect(controller.getPreferenceIntent()).toBe(collapsed);
    }
    controller.hide(); const hidden = controller.getPreferenceIntent();
    controller.setContext({ ...context, booksStatus: "error" });
    expect(controller.getSnapshot()).toMatchObject({ visibility: "hidden", panel: "closed" });
    expect(controller.getPreferenceIntent()).toBe(hidden);
    controller.dispose();
  });
});
