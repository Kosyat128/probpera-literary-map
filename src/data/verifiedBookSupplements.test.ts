import { describe, expect, it } from "vitest";

import { buildBookArchive, buildPublicBookArchive } from "./bookArchive";
import { bookPublicationIssues, isPublicBook } from "./bookQuality";
import { countries } from "./countries";
import {
  verifiedBestsellerEvidenceTitles,
  verifiedBilingualLandmarkTitles,
  verifiedBookSupplementTitles,
} from "./countries/verifiedBookSupplements";

describe("проверенное ядро книжной базы", () => {
  const books = buildBookArchive(countries);

  it.each(verifiedBookSupplementTitles)(
    "хранит для «%s» год, язык, описание и источник",
    (title) => {
      const book = books.find(
        (entry) =>
          entry.title === title ||
          (entry.alternateTitles || []).includes(title)
      );

      expect(book).toBeDefined();
      expect(book?.editorial?.status).toMatch(/^(reviewed|verified)$/u);
      expect(book?.firstPublished).toBeTypeOf("number");
      expect(book?.originalLanguage).toBeTruthy();
      expect(book?.genres?.length).toBeGreaterThan(0);
      expect(book?.description?.length).toBeGreaterThan(120);
      expect(book?.sourceUrl).toMatch(/^https:\/\//u);
    }
  );

  it("не оставляет проверенные книги одновременно в кратком legacy-списке", () => {
    const duplicates = countries.flatMap((country) =>
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

  it.each(verifiedBilingualLandmarkTitles)(
    "публикует двуязычную Nobel-карточку «%s» только с проверенными текстами",
    (title) => {
      const book = books.find((entry) => entry.title === title);

      expect(book).toBeDefined();
      expect(bookPublicationIssues(book!)).toEqual([]);
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
    }
  );

  it.each(verifiedBilingualLandmarkTitles)(
    "разделяет наградный и структурный provenance для «%s»",
    (title) => {
      const book = books.find((entry) => entry.title === title)!;
      const nobelSource = book.sources?.find(
        (source) => source.provider === "Nobel Prize Outreach"
      );
      const wikidataSource = book.sources?.find(
        (source) => source.provider === "Wikidata"
      );

      expect(nobelSource?.fields).toEqual([
        "identity",
        "title",
        "award-criterion",
      ]);
      expect(nobelSource?.fields).not.toContain("publication-year");
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
      expect(book.translations?.ru?.sourceUrls).toEqual(
        expect.arrayContaining([nobelSource!.url, wikidataSource!.url])
      );
      expect(book.translations?.en?.sourceUrls).toEqual(
        expect.arrayContaining([nobelSource!.url, wikidataSource!.url])
      );
    }
  );

  it.each(verifiedBestsellerEvidenceTitles)(
    "хранит bestseller evidence для «%s» отдельно от наградного критерия",
    (title) => {
      const book = books.find((entry) => entry.title === title);

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
    const publicBooks = buildPublicBookArchive(countries);

    expect(books.length).toBeGreaterThan(publicBooks.length);
    expect(publicBooks.length).toBeGreaterThanOrEqual(
      verifiedBilingualLandmarkTitles.length +
        verifiedBestsellerEvidenceTitles.length
    );
    expect(publicBooks.every(isPublicBook)).toBe(true);
    expect(
      publicBooks.some(
        (book) =>
          book.id.startsWith("legacy-") || book.editorial?.status === "draft"
      )
    ).toBe(false);
  });
});
