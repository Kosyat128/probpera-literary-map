import { describe, expect, it, vi } from "vitest";

import { literarySearchMatches } from "../utils/literarySearch";
import { buildPublicBookArchive, bookArchiveKey } from "./bookArchive";
import type { BookArchiveEntry } from "./bookArchive";
import { createBookAuthorSearchResolver } from "./bookAuthorSearch";
import { selectBookText, selectBookWriterName } from "./bookLocalization";
import { isPublicBook } from "./bookQuality";
import { countries } from "./countries";
import type { Country, WorkLocale, WriterProfile } from "./countries/types";

const canonicalBook = buildPublicBookArchive(countries).find(book =>
  book.countryId === "russia" && book.writerId === "dostoevsky" && book.id === "crime-and-punishment"
)!;
const canonicalCountry = countries.find(item => item.id === canonicalBook.countryId)!;
// The live canonical catalog uses locale-aware Proxy views. Materialize its
// serializable data once before cloning isolated mutation fixtures; cloning a
// Proxy directly fails before any author-search behavior is exercised.
const canonicalFixture = JSON.parse(JSON.stringify({
  book: canonicalBook,
  country: {
    ...canonicalCountry,
    writers: canonicalCountry.writers.filter(writer => writer.id === canonicalBook.writerId),
  },
})) as { book: BookArchiveEntry; country: Country };

function fixture() {
  return structuredClone(canonicalFixture);
}

function namesFor(book: BookArchiveEntry, currentCountries: readonly Country[], locale: WorkLocale = "en") {
  return createBookAuthorSearchResolver(currentCountries, locale)(book);
}

describe("current canonical book author search fields", () => {
  it.each<WorkLocale>(["ru", "en"])("finds the same real work through canonical names and existing transliteration in %s", locale => {
    const { book, country } = fixture();
    const before = structuredClone(book);
    const title = selectBookText(book, locale).title;
    const byline = selectBookWriterName(book, locale);
    const key = bookArchiveKey(book.countryId, book.writerId, book.id);
    const fields = namesFor(book, [country], locale);
    expect(fields).toContain("Фёдор Михайлович Достоевский");
    expect(literarySearchMatches("Михайлович", fields)).toBe(true);
    expect(literarySearchMatches("Mikhailovich", fields)).toBe(true);
    expect(fields).not.toContain(book.id);
    expect(fields).not.toContain(book.translations!.en!.title);
    expect(fields).not.toContain(book.translations!.ru!.title);
    expect(selectBookText(book, locale).title).toBe(title);
    expect(selectBookWriterName(book, locale)).toBe(byline);
    expect(bookArchiveKey(book.countryId, book.writerId, book.id)).toBe(key);
    expect(book).toEqual(before);
  });

  it("uses current canonical names rather than stale embedded writer fields or identifiers", () => {
    const { book, country } = fixture();
    book.writer = { id: "stale-other-writer", name: "Устаревшая подпись", fullName: "Stale Embedded Name" };
    book.writerName = "Stale Cached Byline";
    const fields = namesFor(book, [country]);
    expect(literarySearchMatches("Mikhailovich", fields)).toBe(true);
    expect(fields.join(" ")).not.toMatch(/Stale|Устаревшая/);
  });

  it.each(["removed writer", "wrong country", "removed country", "duplicate writer", "duplicate country"])("does not revive an ambiguous or absent target: %s", condition => {
    const { book, country } = fixture();
    let current = [country];
    if (condition === "removed writer") country.writers = [];
    if (condition === "wrong country") country.id = "another-country";
    if (condition === "removed country") current = [];
    if (condition === "duplicate writer") country.writers.push(structuredClone(country.writers[0]));
    if (condition === "duplicate country") current.push(structuredClone(country));
    expect(namesFor(book, current)).toEqual([]);
  });

  it("resolves the same writer ID in another country only through the exact country key", () => {
    const { book, country } = fixture();
    const other: Country = {
      id: "synthetic-other-country", name: "Synthetic country",
      writers: [{ id: book.writerId, name: "Условный однофамилец", fullName: "Synthetic Other Person" }],
    };
    const fields = namesFor(book, [other, country]);
    expect(literarySearchMatches("Mikhailovich", fields)).toBe(true);
    expect(fields.join(" ")).not.toContain("Synthetic");
  });

  it("excludes an English-ineligible current profile despite a stale English embedded label", () => {
    const { book, country } = fixture();
    book.writerId = "synthetic-unreviewed-writer";
    book.writer = { id: book.writerId, name: "Условный автор", fullName: "Stale English Name" };
    country.writers = [{ id: book.writerId, name: "Условный автор" }];
    expect(namesFor(book, [country], "en")).toEqual([]);
    expect(namesFor(book, [country], "ru")).toEqual(["Условный автор"]);
  });

  it.each(["anonymous", "traditional"] as const)("does not add the routing writer to %s authorship", kind => {
    const { book, country } = fixture();
    book.authorship = { kind, authors: [] };
    expect(isPublicBook(book)).toBe(true);
    expect(namesFor(book, [country])).toEqual([]);
  });

  it("indexes only the exact current credited coauthors, with no unrelated routing owner", () => {
    const { book, country } = fixture();
    const first: WriterProfile = { id: "synthetic-first-credit", name: "Условный первый соавтор", fullName: "Synthetic First Coauthor" };
    const second: WriterProfile = { id: "synthetic-second-credit", name: "Условный второй соавтор", fullName: "Synthetic Second Coauthor" };
    country.writers.push(first, second);
    book.authorship = {
      kind: "multiple",
      authors: [first, second].map(writer => ({
        countryId: country.id, writerId: writer.id,
        creditNames: { ru: writer.name, en: writer.fullName },
      })),
    };
    // Synthetic credits test semantics only; they do not alter canonical data
    // or assert any factual coauthorship for the cloned bibliographic record.
    expect(isPublicBook(book)).toBe(true);
    const fields = namesFor(book, [country]);
    expect(fields).toContain(first.name);
    expect(fields).toContain(second.name);
    expect(literarySearchMatches("Mikhailovich", fields)).toBe(false);
    country.writers = country.writers.filter(writer => writer.id !== first.id);
    const afterRemoval = namesFor(book, [country]);
    expect(afterRemoval).not.toContain(first.name);
    expect(afterRemoval).not.toContain(first.fullName);
    expect(afterRemoval).toContain(second.name);
  });

  it("uses explicit literal collective credits without inferring a profile or archive owner", () => {
    const { book, country } = fixture();
    book.authorship = {
      kind: "collective",
      authors: [{ creditNames: { ru: "Условная литературная группа", en: "Synthetic Literary Collective" } }],
    };
    expect(isPublicBook(book)).toBe(true);
    expect(namesFor(book, [country])).toEqual([
      "Synthetic Literary Collective", "Условная литературная группа",
    ]);
  });

  it.each(["attributed", "disputed"] as const)("does not convert %s attribution into a factual author alias", attribution => {
    const { book, country } = fixture();
    book.authorship = {
      kind: attribution === "disputed" ? "disputed" : "single",
      authors: [{
        countryId: country.id, writerId: book.writerId,
        creditNames: { ru: "Условная атрибуция", en: "Synthetic Attribution" }, attribution,
      }],
    };
    expect(isPublicBook(book)).toBe(true);
    expect(namesFor(book, [country])).toEqual([]);
  });

  it.each<[string, (book: BookArchiveEntry) => void]>([
    ["withdrawn work", book => { book.editorial!.status = "draft"; }],
    ["draft translation", book => { book.translations!.en!.status = "draft"; }],
    ["missing English title evidence", book => { delete book.localizedTitles?.en; delete book.translations!.en!.titleEvidence; }],
    ["stale English published title", book => { book.translations!.en!.title = "Synthetic Changed Title"; }],
    ["incomplete explicit credit", book => { book.authorship = { kind: "single", authors: [{ writerId: book.writerId }] }; }],
  ])("adds no author fields for %s", (_reason, mutate) => {
    const { book, country } = fixture();
    mutate(book);
    expect(namesFor(book, [country])).toEqual([]);
  });

  it("reads the country/writer lookup once, then reuses it for every book", () => {
    const { book, country } = fixture();
    const writerList = country.writers;
    const readWriters = vi.fn(() => writerList);
    Object.defineProperty(country, "writers", { get: readWriters, configurable: true });
    const resolve = createBookAuthorSearchResolver([country], "en");
    expect(readWriters).toHaveBeenCalledTimes(1);
    for (let index = 0; index < 8; index += 1) {
      expect(literarySearchMatches("Mikhailovich", resolve(book))).toBe(true);
    }
    expect(readWriters).toHaveBeenCalledTimes(1);
  });
});
