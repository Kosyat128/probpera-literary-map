import { describe, expect, it } from "vitest";
import { acknowledgeBookyStep, BOOKY_ROUTE_HISTORIES, forgetBookyRoute, isBookyRouteComplete,
  migrateBookyRouteState, type BookyRouteHistory, type BookyRouteState, type BookyTourProgress } from "./bookyTourProgress";
import { PLANET_MASCOT_ROUTES, type PlanetMascotRoute } from "./planetMascotRoutes";

// Synthetic version history exercises migration without inventing a production
// route update or changing the two authored adult navigation routes.
const history: BookyRouteHistory = {
  currentVersion: 3,
  versions: [
    { version: 1, stepIds: ["old-start", "retired", "old-end"] },
    { version: 2, stepIds: ["start", "review", "end"] },
    { version: 3, stepIds: ["start", "review", "new-step", "finish"] },
  ],
  migrations: [
    { fromVersion: 1, toVersion: 2, stepMap: { "old-start": "start", retired: null, "old-end": "end" }, safeCheckpoint: "review" },
    { fromVersion: 2, toVersion: 3, stepMap: { start: "start", review: "review", end: "finish" }, safeCheckpoint: "start" },
  ],
};

describe("Booky explicit adult navigation progress", () => {
  it("records only explicitly acknowledged IDs, independently of a final cursor or order", () => {
    for (const route of Object.keys(PLANET_MASCOT_ROUTES) as PlanetMascotRoute[]) {
      const definition = PLANET_MASCOT_ROUTES[route];
      let progress: readonly BookyTourProgress[] = [];
      for (const step of [...definition.steps].reverse()) {
        expect(isBookyRouteComplete(progress, route)).toBe(false);
        progress = acknowledgeBookyStep(progress, route, step.id);
      }
      expect(progress).toEqual([{ route, routeVersion: 1, acknowledgedStepIds: definition.steps.map(step => step.id) }]);
      expect(isBookyRouteComplete(progress, route)).toBe(true);
      expect(Object.isFrozen(progress)).toBe(true);
      expect(Object.isFrozen(progress[0].acknowledgedStepIds)).toBe(true);
      expect(BOOKY_ROUTE_HISTORIES[route].versions.map(version => version.version)).toEqual([1]);
    }
  });

  it("is idempotent and rejects nonexistent IDs without changing existing history", () => {
    const historical: BookyTourProgress = { route: "overview", routeVersion: 99, acknowledgedStepIds: ["search", "country", "collection", "appearance"] };
    const progress = acknowledgeBookyStep([historical], "overview", "appearance");
    expect(isBookyRouteComplete(progress, "overview")).toBe(false);
    expect(progress[1]).toBe(historical);
    expect(acknowledgeBookyStep(progress, "overview", "appearance")).toBe(progress);
    expect(acknowledgeBookyStep(progress, "overview", "invented")).toBe(progress);
    expect(acknowledgeBookyStep(progress, "child" as PlanetMascotRoute, "search")).toBe(progress);
    expect(isBookyRouteComplete(progress, "child" as PlanetMascotRoute)).toBe(false);
  });

  it("forgets all versions of one route while preserving the other route", () => {
    let progress = acknowledgeBookyStep([], "overview", "search");
    progress = acknowledgeBookyStep(progress, "country-to-book", "choose-country");
    const withHistory = [{ route: "overview", routeVersion: 7, acknowledgedStepIds: ["historical"] } as BookyTourProgress, ...progress];
    const retained = forgetBookyRoute(withHistory, "overview");
    expect(retained).toEqual([progress[1]]);
    expect(retained[0]).toBe(progress[1]);
    expect(forgetBookyRoute(retained, "overview")).toBe(retained);
    expect(withHistory).toHaveLength(3);
  });
});

describe("Booky explicit known-version migration", () => {
  it("uses an explicit safe checkpoint for a retired cursor and preserves historical acknowledgements", () => {
    const input: BookyRouteState = { resume: { routeVersion: 1, stepId: "retired" }, progress: [
      { routeVersion: 1, acknowledgedStepIds: ["old-end", "retired", "old-start"] },
      { routeVersion: 2, acknowledgedStepIds: ["review"] },
    ] };
    const result = migrateBookyRouteState(input, history)!;
    expect(result).toEqual({ migrated: true, resume: { routeVersion: 3, stepId: "review" }, progress: [
      { routeVersion: 1, acknowledgedStepIds: ["old-start", "retired", "old-end"] },
      { routeVersion: 2, acknowledgedStepIds: ["start", "review", "end"] },
      { routeVersion: 3, acknowledgedStepIds: ["start", "review", "finish"] },
    ] });
    expect(result.progress[2].acknowledgedStepIds).not.toContain("new-step");
    expect(input.progress[0].acknowledgedStepIds).toEqual(["old-end", "retired", "old-start"]);
    expect(Object.isFrozen(result.resume)).toBe(true);
    expect(Object.isFrozen(result.progress[0].acknowledgedStepIds)).toBe(true);
    expect(migrateBookyRouteState(result, history)).toEqual({ ...result, migrated: false });
  });

  it("never acknowledges a mapped or fallback checkpoint from a resume cursor", () => {
    for (const stepId of ["old-start", "retired", "old-end"]) {
      const result = migrateBookyRouteState({ resume: { routeVersion: 1, stepId }, progress: [] }, history)!;
      expect(result.resume?.routeVersion).toBe(3);
      expect(result.progress).toEqual([]);
    }
    const retiredOnly = migrateBookyRouteState({ resume: null, progress: [{ routeVersion: 1, acknowledgedStepIds: ["retired"] }] }, history)!;
    expect(retiredOnly.progress).toEqual([{ routeVersion: 1, acknowledgedStepIds: ["retired"] }]);
  });

  it("fails closed on unknown versions, IDs, duplicate acknowledgements and incomplete mapping plans", () => {
    const invalid: BookyRouteState[] = [
      { resume: { routeVersion: 4, stepId: "future" }, progress: [] },
      { resume: { routeVersion: 1, stepId: "missing" }, progress: [] },
      { resume: null, progress: [{ routeVersion: 4, acknowledgedStepIds: [] }] },
      { resume: null, progress: [{ routeVersion: 1, acknowledgedStepIds: ["missing"] }] },
      { resume: null, progress: [{ routeVersion: 1, acknowledgedStepIds: ["old-start", "old-start"] }] },
      { resume: null, progress: [{ routeVersion: 1, acknowledgedStepIds: [] }, { routeVersion: 1, acknowledgedStepIds: [] }] },
    ];
    for (const state of invalid) expect(migrateBookyRouteState(state, history)).toBeNull();
    const state: BookyRouteState = { resume: null, progress: [] };
    expect(migrateBookyRouteState(state, { ...history, migrations: history.migrations.slice(0, 1) })).toBeNull();
    expect(migrateBookyRouteState(state, { ...history, migrations: [
      { ...history.migrations[0], stepMap: { "old-start": "start" } }, history.migrations[1],
    ] })).toBeNull();
    expect(migrateBookyRouteState(state, { ...history, migrations: [
      { ...history.migrations[0], safeCheckpoint: "unknown" }, history.migrations[1],
    ] })).toBeNull();
  });
});
