import { describe, expect, it } from "vitest";

import { buildBookArchive } from "./bookArchive";
import { countries } from "./countries";
import { verifiedBookSupplementTitles } from "./countries/verifiedBookSupplements";

describe("проверенное ядро книжной базы", () => {
  const books = buildBookArchive(countries);

  it.each(verifiedBookSupplementTitles)(
    "хранит для «%s» год, язык, описание и источник",
    (title) => {
      const book = books.find((entry) => entry.title === title);

      expect(book).toBeDefined();
      expect(book?.editorial?.status).toBe("verified");
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
});
