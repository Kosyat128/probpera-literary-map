import { describe, expect, it } from "vitest";

import { articleCatalog } from "./articles/catalog";
import { buildBookArchive, isCoverDisplayAllowed } from "./bookArchive";
import { bookArchiveCountries, countries } from "./countries";

describe("automatic site counters", () => {
  const writers = countries.flatMap((country) => country.writers);
  const books = buildBookArchive(bookArchiveCountries);

  it("derives all encyclopedia totals from countries", () => {
    expect(countries).toHaveLength(200);
    expect(writers.length).toBeGreaterThan(100);
    expect(books.length).toBeGreaterThan(100);
    expect(books).toHaveLength(9_761);
    const isolatedCountryTotal = bookArchiveCountries.reduce(
      (total, country) => total + buildBookArchive([country]).length,
      0
    );
    // Two reviewed Wilde identities cross the legacy England/Ireland split;
    // only the global build can apply those lossless Work merges.
    expect(isolatedCountryTotal - books.length).toBe(2);
    expect(
      new Set(books.map((book) => `${book.countryId}:${book.writerId}:${book.id}`))
        .size
    ).toBe(books.length);
  });

  it("derives article and section counters from the merged publication catalog", () => {
    const sectionTotal = [...new Set(articleCatalog.map((article) => article.sectionId))]
      .map(
        (sectionId) =>
          articleCatalog.filter((article) => article.sectionId === sectionId).length
      )
      .reduce((total, count) => total + count, 0);
    expect(articleCatalog.length).toBeGreaterThan(0);
    expect(sectionTotal).toBe(articleCatalog.length);
  });

  it("never counts an editorial illustration as a real edition cover", () => {
    const editorialOriginals = books.filter(
      (book) => book.coverRights?.status === "editorial-original"
    );
    expect(editorialOriginals.length).toBeGreaterThan(0);
    expect(editorialOriginals.every((book) => !isCoverDisplayAllowed(book))).toBe(true);
    expect(
      books
        .filter(isCoverDisplayAllowed)
        .every((book) => book.coverRights?.status !== "unverified")
    ).toBe(true);
  });
});
