import { describe, expect, it, vi } from "vitest";
import { BOOKY_PREFERENCE_KEY, BOOKY_PREFERENCE_MAX_LENGTH, BookyPreferenceUnsupportedError, DEFAULT_BOOKY_PREFERENCE,
  decodeBookyPreference, isUnsupportedBookyPreference, parseBookyPreference, serializeBookyPreference } from "./planetMascotPreference";
import { PLANET_MASCOT_ROUTES, type PlanetMascotRoute } from "./planetMascotRoutes";

const v1 = { schemaVersion: 1, audience: "adult", visible: true, resume: null };
const v2 = { schemaVersion: 2, audience: "adult", visible: false, resume: null, progress: [] };
const overview = { route: "overview", routeVersion: 1, acknowledgedStepIds: ["search"] };

describe("Booky versioned preference codec", () => {
  it("migrates every valid v1 cursor without inferring any acknowledged step", () => {
    expect(BOOKY_PREFERENCE_KEY).toBe("probpera-booky-adult-v1");
    for (const route of Object.keys(PLANET_MASCOT_ROUTES) as PlanetMascotRoute[]) {
      for (const step of PLANET_MASCOT_ROUTES[route].steps) {
        const input = { ...v1, resume: { route, stepId: step.id } }, raw = JSON.stringify(input);
        expect(decodeBookyPreference(raw)).toEqual({ sourceSchemaVersion: 1, migrated: true, value: {
          ...v2, visible: true, resume: { route, routeVersion: 1, stepId: step.id }, progress: [],
        } });
        expect(JSON.parse(serializeBookyPreference(input)!)).toEqual(decodeBookyPreference(raw)!.value);
        expect(input).toEqual(JSON.parse(raw));
      }
    }
    expect(decodeBookyPreference({ ...v1, visible: false })?.value).toEqual(DEFAULT_BOOKY_PREFERENCE);
    expect(parseBookyPreference({ ...v1, visible: false, resume: { route: "overview", stepId: "search" } })).toBeNull();
    expect(parseBookyPreference({ ...v1, progress: [] })).toBeNull();
  });

  it("keeps hidden resume and detached progress, normalizing unique unsorted IDs and routes", () => {
    const input = { ...v2, resume: { route: "overview", routeVersion: 1, stepId: "collection" }, progress: [
      { route: "country-to-book", routeVersion: 1, acknowledgedStepIds: ["open-books", "choose-country"] },
      { route: "overview", routeVersion: 1, acknowledgedStepIds: ["appearance", "search", "country"] },
    ] };
    const decoded = decodeBookyPreference(input)!;
    expect(decoded).toMatchObject({ sourceSchemaVersion: 2, migrated: false });
    expect(decoded.value).toEqual({ ...v2, resume: input.resume, progress: [
      { route: "overview", routeVersion: 1, acknowledgedStepIds: ["search", "country", "appearance"] },
      { route: "country-to-book", routeVersion: 1, acknowledgedStepIds: ["choose-country", "open-books"] },
    ] });
    input.resume.stepId = "search"; input.progress[1].acknowledgedStepIds.push("collection");
    expect(decoded.value.resume?.stepId).toBe("collection");
    expect(decoded.value.progress[0].acknowledgedStepIds).not.toContain("collection");
    expect(Object.isFrozen(decoded.value.resume)).toBe(true);
    expect(Object.isFrozen(decoded.value.progress)).toBe(true);
    expect(Object.isFrozen(decoded.value.progress[0].acknowledgedStepIds)).toBe(true);
    expect(parseBookyPreference(serializeBookyPreference(decoded.value))).toEqual(decoded.value);
    expect(serializeBookyPreference(decoded.value)!.length).toBeLessThan(BOOKY_PREFERENCE_MAX_LENGTH);
  });

  it("rejects duplicate records, unknown IDs, child/personal payloads and malformed versioned fields", () => {
    const invalid: unknown[] = [
      { ...v2, audience: "child" }, { ...v2, visible: 1 }, { ...v2, progress: undefined },
      { ...v2, profileId: "private" }, { ...v2, resume: { route: "overview", stepId: "search" } },
      { ...v2, resume: { route: "overview", routeVersion: 1, stepId: "missing" } },
      { ...v2, resume: { route: "overview", routeVersion: 0, stepId: "search" } },
      { ...v2, progress: [overview, overview] },
      { ...v2, progress: [{ ...overview, acknowledgedStepIds: ["search", "search"] }] },
      { ...v2, progress: [{ ...overview, acknowledgedStepIds: ["missing"] }] },
      { ...v2, progress: [{ ...overview, routeVersion: 1.5 }] },
      { ...v2, progress: [{ ...overview, bookId: "private" }] },
      { ...v2, progress: [{ ...overview, acknowledgedStepIds: [1] }] },
      { ...v2, progress: [null] }, { ...v2, progress: new Array(1) },
      { ...v2, progress: Object.assign([], { custom: true }) },
      { ...v2, progress: [{ ...overview, acknowledgedStepIds: new Array(1) }] },
      null, undefined, "", "{", "x".repeat(BOOKY_PREFERENCE_MAX_LENGTH + 1),
    ];
    for (const input of invalid) {
      expect(decodeBookyPreference(input)).toBeNull();
      expect(serializeBookyPreference(input)).toBeNull();
    }
  });

  it("does not invoke hostile accessors or return borrowed prototypes", () => {
    const getter = vi.fn(() => { throw new Error("must not run"); });
    const top = Object.defineProperty({ ...v2 }, "progress", { get: getter, enumerable: true });
    const item = Object.defineProperty({ ...overview }, "route", { get: getter, enumerable: true });
    const array = Object.defineProperty([overview], "0", { get: getter, enumerable: true });
    for (const input of [top, { ...v2, progress: [item] }, { ...v2, progress: array }, Object.create(v2),
      { ...v2, [Symbol("extra")]: true }]) {
      expect(parseBookyPreference(input)).toBeNull();
      expect(isUnsupportedBookyPreference(input)).toBe(false);
    }
    expect(getter).not.toHaveBeenCalled();
    expect(parseBookyPreference(Object.assign(Object.create(null), v2))).toEqual(DEFAULT_BOOKY_PREFERENCE);
  });

  it("protects future schemas, unknown routes and unknown route versions without exposing their content", () => {
    const unsupported = [
      { ...v2, schemaVersion: 3, privateFuture: "do not expose" },
      { ...v2, resume: { route: "overview", routeVersion: 2, stepId: "search" } },
      { ...v2, progress: [{ ...overview, routeVersion: 2 }] },
      { ...v2, resume: { route: "future-route", routeVersion: 1, stepId: "private" } },
      { ...v2, progress: [{ ...overview, route: "future-route" }] },
      { ...v1, resume: { route: "future-route", stepId: "private" } },
    ];
    for (const record of unsupported) {
      for (const input of [record, JSON.stringify(record)]) {
        expect(isUnsupportedBookyPreference(input)).toBe(true);
        expect(parseBookyPreference(input)).toBeNull();
        expect(serializeBookyPreference(input)).toBeNull();
      }
    }
    expect(isUnsupportedBookyPreference(" ".repeat(BOOKY_PREFERENCE_MAX_LENGTH + 1))).toBe(true);
    expect(isUnsupportedBookyPreference(v2)).toBe(false);
    expect(isUnsupportedBookyPreference({ ...v2, schemaVersion: "3" })).toBe(false);
    const error = new BookyPreferenceUnsupportedError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("BookyPreferenceUnsupportedError");
    expect(error.message).toBe("booky-preference-unsupported");
  });
});
