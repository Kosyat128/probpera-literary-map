import { describe, expect, it } from "vitest";
import { normalizeBookArchiveFilterState } from "./bookArchiveFacets";
import { resolveBookArchiveAuthorRequest } from "./bookArchiveAuthorRequest";
import { bookArchiveAuthorViewKey, createBookArchiveAuthorViewToken, planBookArchiveAuthorRecovery,
  type BookArchiveAuthorRecoveryView } from "./bookArchiveAuthorRecovery";

const countries = [{ id: "russia", writers: [{ id: "tolstoy" }, { id: "no-books" }] }];
const authors = new Map([["russia:tolstoy", [0, 1]]]);
const restricted = (): BookArchiveAuthorRecoveryView => ({
  filterState: normalizeBookArchiveFilterState({ authorKey: "russia:tolstoy", query: "hidden",
    countryIds: ["usa"], genreIds: ["poetry"], audienceIds: ["children"], periods: ["xxi"],
    originalLanguageIds: ["en"], editorialStatuses: ["pending"], coverModes: ["uploaded"],
    articleRelations: ["review"], savedOnly: true, quickPreset: "custom", sort: "newest" }),
  query: "a different title", searchScope: "library", activeShelfId: "personal-empty",
});
const resolve = (view: ReturnType<typeof createBookArchiveAuthorViewToken>, writerId = "tolstoy") =>
  resolveBookArchiveAuthorRequest({ id: 1, countryId: "russia", writerId,
    recovery: { kind: "all-writer-books", view } }, countries, authors);

describe("explicit writer filter recovery", () => {
  it("removes every restriction, opens all archive books and preserves verified author and sorting without mutating the view", () => {
    const current = restricted(), before = structuredClone(current);
    const token = createBookArchiveAuthorViewToken(bookArchiveAuthorViewKey(current));
    const next = planBookArchiveAuthorRecovery(resolve(token), current, token);
    expect(next).toEqual({ filterState: normalizeBookArchiveFilterState({ authorKey: "russia:tolstoy",
      sort: "newest", quickPreset: "custom" }), query: "", searchScope: "library", activeShelfId: "all" });
    expect(current).toEqual(before);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next!.filterState)).toBe(true);
  });

  it("does not turn an ordinary writer request into a filter reset", () => {
    const current = restricted(), before = structuredClone(current);
    const token = createBookArchiveAuthorViewToken(bookArchiveAuthorViewKey(current));
    const ordinary = resolveBookArchiveAuthorRequest({ id: 2, countryId: "russia", writerId: "tolstoy" }, countries, authors);
    expect(planBookArchiveAuthorRecovery(ordinary, current, token)).toBeNull();
    expect(current).toEqual(before);
  });

  it("rejects every newer query, scope, shelf, facet, author and sorting edit without modifying it", () => {
    const original = restricted(), token = createBookArchiveAuthorViewToken(bookArchiveAuthorViewKey(original));
    const request = resolve(token);
    const changes = [
      { ...original, query: "new search" }, { ...original, searchScope: "archive" },
      { ...original, activeShelfId: "favorites" },
      ...Object.entries(normalizeBookArchiveFilterState()).map(([key, value]) => ({ ...original,
        filterState: { ...original.filterState, [key]: value } })),
    ];
    for (const current of changes) {
      if (bookArchiveAuthorViewKey(current) === token.key) continue;
      const before = structuredClone(current);
      expect(planBookArchiveAuthorRecovery(request, current, token)).toBeNull();
      expect(current).toEqual(before);
    }
  });

  it("rejects an A-to-B-to-A round trip represented by a new committed token", () => {
    const current = restricted(), before = structuredClone(current);
    const oldToken = createBookArchiveAuthorViewToken(bookArchiveAuthorViewKey(current));
    const currentToken = createBookArchiveAuthorViewToken(bookArchiveAuthorViewKey(current));
    expect(planBookArchiveAuthorRecovery(resolve(oldToken), current, currentToken)).toBeNull();
    expect(current).toEqual(before);
  });

  it("requires matching current author and library view even with a fresh token", () => {
    for (const current of [
      { ...restricted(), filterState: normalizeBookArchiveFilterState({ authorKey: "russia:other" }) },
      { ...restricted(), searchScope: "archive" },
    ]) {
      const before = structuredClone(current), token = createBookArchiveAuthorViewToken(bookArchiveAuthorViewKey(current));
      expect(planBookArchiveAuthorRecovery(resolve(token), current, token)).toBeNull();
      expect(current).toEqual(before);
    }
  });

  it("cannot recover unavailable or noncanonical writers into invented results", () => {
    const current = restricted(), before = structuredClone(current);
    const token = createBookArchiveAuthorViewToken(bookArchiveAuthorViewKey(current));
    for (const writerId of ["no-books", "hidden"]) expect(planBookArchiveAuthorRecovery(resolve(token, writerId), current, token)).toBeNull();
    expect(current).toEqual(before);
  });
});
