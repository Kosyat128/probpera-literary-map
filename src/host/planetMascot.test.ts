import { describe, expect, it, vi } from "vitest";
import { createPlanetMascotController, type PlanetMascotContext } from "./planetMascot";
import { PLANET_MASCOT_ROUTES, getPlanetMascotStep } from "./planetMascotRoutes";

const ready = (value: Partial<PlanetMascotContext> = {}): PlanetMascotContext => ({
  enabled: true, access: "adult", active: true, screen: "globe",
  selectedCountry: false, selectedWriter: false, ...value,
});

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
});
