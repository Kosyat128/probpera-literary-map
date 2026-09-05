import { describe, expect, it } from "vitest";
import { bookDossierStaticIssues } from "../audit-book-dossier-delivery.mjs";

describe("dossier static delivery boundary", () => {
  it("allows ordinary catalogue metadata without confusing it with protected dossier records", () => {
    expect(bookDossierStaticIssues({ books: [{ id: "synthetic", rights: "reference-only", title: "Test" }], schemaVersion: 2 })).toEqual([]);
  });
  it.each([
    { schemaVersion: 2, bookKey: "test:writer:book", blocks: [], rights: [] },
    { nested: { schemaVersion: 2, bookKey: "test:writer:book", contentMode: "DOSSIER_ONLY", pages: [], validUntil: "2027-01-01" } },
    { draft: { schemaVersion: 2, bookKey: "test:writer:book" }, reviews: [] },
    { schemaVersion: 2, variants: [] },
    { book_dossiers: [] },
  ])("rejects private or leased public dossier content in static exports", entry => {
    expect(bookDossierStaticIssues(entry)).not.toEqual([]);
  });
});
