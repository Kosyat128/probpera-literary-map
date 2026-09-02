import { describe, expect, it } from "vitest";

import { buildBookArchive, buildPublicBookArchive } from "./bookArchive";
import { bookPublicationIssues, isPublicBook } from "./bookQuality";
import { bookArchiveCountries } from "./countries";
import {
  verifiedBookSupplementRecords,
} from "./countries/verifiedBookSupplements";

describe("проверенное ядро книжной базы", () => {
  const books = buildBookArchive(bookArchiveCountries);
  const booksByKey = new Map(
    books.map((book) => [
      `${book.countryId}:${book.writerId}:${book.id}`,
      book,
    ])
  );
  const awardCitedRecords = verifiedBookSupplementRecords.filter(
    (record) => record.awardCited
  );
  const bestsellerRecords = verifiedBookSupplementRecords.filter(
    (record) => record.bestsellerEvidence
  );

  it.each(verifiedBookSupplementRecords)(
    "хранит библиографическое ядро для $sourceTitle по стабильной Work-идентичности",
    ({ recordKey }) => {
      const book = booksByKey.get(recordKey);

      expect(book).toBeDefined();
      expect(book?.editorial?.status).toMatch(/^(draft|reviewed|verified)$/u);
      expect(book?.firstPublished).toBeTypeOf("number");
      expect(book?.originalLanguage).toBeTruthy();
      expect(book?.genres?.length).toBeGreaterThan(0);
      expect(
        Math.max(
          book?.description?.length || 0,
          book?.translations?.ru?.description?.length || 0,
          book?.translations?.en?.description?.length || 0
        )
      ).toBeGreaterThan(120);
      expect(book?.sourceUrl).toMatch(/^https:\/\//u);
      if (isPublicBook(book!)) {
        expect(bookPublicationIssues(book!)).toEqual([]);
      } else {
        expect(bookPublicationIssues(book!).length).toBeGreaterThan(0);
      }
    }
  );

  it("не оставляет проверенные книги одновременно в кратком legacy-списке", () => {
    const duplicates = bookArchiveCountries.flatMap((country) =>
      country.writers.flatMap((writer) => {
        const legacyTitles = new Set(
          (writer.works || []).map((title) => title.toLocaleLowerCase("ru"))
        );
        return (writer.workDetails || [])
          .filter((work) => legacyTitles.has(work.title.toLocaleLowerCase("ru")))
          .map((work) => `${country.id}:${writer.id}:${work.title}`);
      })
    );

    expect(duplicates).toEqual([]);
  });

  it.each(awardCitedRecords)(
    "сохраняет наградный критерий для $sourceTitle отдельно от publication gate",
    ({ recordKey }) => {
      const book = booksByKey.get(recordKey);

      expect(book).toBeDefined();
      expect(book?.distinctions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ criterion: "award-cited-work" }),
        ])
      );
      expect(book?.distinctions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ criterion: "bestseller-evidence" }),
        ])
      );
      expect(isPublicBook(book!)).toBe(bookPublicationIssues(book!).length === 0);
    }
  );

  it.each(awardCitedRecords)(
    "разделяет наградный и структурный provenance для $sourceTitle",
    ({ recordKey }) => {
      const book = booksByKey.get(recordKey)!;
      const nobelSource = book.sources?.find(
        (source) => source.provider === "Nobel Prize Outreach"
      );
      const wikidataSource = book.sources?.find(
        (source) => source.provider === "Wikidata"
      );

      expect(nobelSource?.fields).toEqual(
        expect.arrayContaining(["identity", "title", "award-criterion"])
      );
      expect(wikidataSource).toEqual(
        expect.objectContaining({
          usage: "structured-data",
          license: "CC0 1.0",
          url: expect.stringMatching(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/u),
        })
      );
      expect(book.externalIds).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            scheme: "wikidata",
            value: expect.stringMatching(/^Q\d+$/u),
          }),
        ])
      );
      // Evidence V2 translation provenance is intentionally narrower than
      // Work-level award provenance: title/description sources must support
      // the displayed locale text rather than merely the Nobel distinction.
      if (isPublicBook(book)) {
        expect(book.translations?.ru?.sourceUrls?.length).toBeGreaterThan(1);
        expect(book.translations?.en?.sourceUrls?.length).toBeGreaterThan(1);
      }
    }
  );

  it.each(bestsellerRecords)(
    "хранит bestseller evidence для $sourceTitle отдельно от наградного критерия",
    ({ recordKey }) => {
      const book = booksByKey.get(recordKey);

      expect(book).toBeDefined();
      expect(bookPublicationIssues(book!)).toEqual([]);
      expect(book?.distinctions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            criterion: "bestseller-evidence",
            sourceUrl: expect.stringContaining("guinnessworldrecords.com"),
          }),
        ])
      );
      expect(book?.distinctions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ criterion: "award-cited-work" }),
        ])
      );
    }
  );

  it("не отдаёт посетителю legacy и ручные черновики", () => {
    const publicBooks = buildPublicBookArchive(bookArchiveCountries);

    expect(books.length).toBeGreaterThan(publicBooks.length);
    expect(publicBooks).toHaveLength(46);
    expect(publicBooks.every(isPublicBook)).toBe(true);
    expect(
      publicBooks.some(
        (book) =>
          book.id.startsWith("legacy-") || book.editorial?.status === "draft"
      )
    ).toBe(false);
  });
});
