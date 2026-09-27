import { describe, expect, it } from "vitest";
import { resolveBookArchiveAuthorRequest } from "./bookArchiveAuthorRequest";

const countries = [
  { id: "russia", writers: [{ id: "tolstoy" }, { id: "no-published-books" }] },
  { id: "usa", writers: [{ id: "hemingway" }] },
];

describe("book archive author requests", () => {
  it("requires the exact public country/writer identity even if the index contains another key", () => {
    const authors = new Map([["russia:tolstoy", [0]], ["usa:tolstoy", [1]], ["russia:hidden", [2]]]);
    for (const request of [
      { id: 1, countryId: "usa", writerId: "tolstoy" },
      { id: 2, countryId: "russia", writerId: "hidden" },
      { id: 3, countryId: "russia", writerId: "Лев Толстой" },
      { id: 4, countryId: "russia", writerId: "tolstoy:war-and-peace" },
      { id: 0, countryId: "russia", writerId: "tolstoy" },
    ]) expect(resolveBookArchiveAuthorRequest(request, countries, authors)).toEqual({ status: "invalid" });
    expect(resolveBookArchiveAuthorRequest({ id: 5, countryId: "russia", writerId: "tolstoy" },
      [...countries, countries[0]], authors)).toEqual({ status: "invalid" });
  });

  it("retains only the explicit recovery and its collection-owned token while detaching the request", () => {
    const view = Object.freeze({ key: "current-collection-view" });
    const recovery = { kind: "all-writer-books" as const, view };
    const request = { id: 8, countryId: "russia", writerId: "tolstoy", recovery };
    const resolved = resolveBookArchiveAuthorRequest(request, countries, new Map([["russia:tolstoy", [0]]]));
    request.writerId = "no-published-books";
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") throw Error("Expected canonical recovery");
    expect(resolved.request.writerId).toBe("tolstoy");
    expect(resolved.request.recovery).not.toBe(recovery);
    expect(resolved.request.recovery?.view).toBe(view);
    expect(Object.isFrozen(resolved.request.recovery)).toBe(true);
  });

  it("rejects malformed or unknown recovery intents rather than treating them as ordinary navigation", () => {
    for (const recovery of [null, {}, { kind: "other", view: { key: "current" } },
      { kind: "all-writer-books" }, { kind: "all-writer-books", view: { key: "" } }]) {
      const request = { id: 8, countryId: "russia", writerId: "tolstoy", recovery };
      expect(resolveBookArchiveAuthorRequest(request as never, countries,
        new Map([["russia:tolstoy", [0]]]))).toEqual({ status: "invalid" });
    }
  });

  it("distinguishes a known author with no catalog books from a canonical indexed author and detaches the intent", () => {
    const authors = new Map([["russia:tolstoy", [4, 7]]]);
    expect(resolveBookArchiveAuthorRequest({ id: 1, countryId: "russia", writerId: "no-published-books" },
      countries, authors)).toEqual({ status: "no-books" });
    const request = { id: 2, countryId: "russia", writerId: "tolstoy" };
    const result = resolveBookArchiveAuthorRequest(request, countries, authors);
    request.writerId = "no-published-books";
    expect(result).toEqual({ status: "ready", authorKey: "russia:tolstoy",
      request: { id: 2, countryId: "russia", writerId: "tolstoy" } });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.status === "ready") expect(Object.isFrozen(result.request)).toBe(true);
  });
});
