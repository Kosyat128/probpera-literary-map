import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildBookArchive } from "./bookArchive";
import { countries } from "./countries";

const archive = buildBookArchive(countries);
const editorialSeries = [
  ["Три мушкетёра", 1844],
  ["Вишнёвый сад", 1904],
  ["Морской волк", 1904],
  ["1984", 1949],
  ["Хоббит, или Туда и обратно", 1937],
  ["Отцы и дети", 1862],
] as const;

describe("редакционная серия книжного архива", () => {
  it.each(editorialSeries)(
    "связывает «%s» с автором, годом и собственной обложкой",
    (title, year) => {
      const book = archive.find((entry) => entry.title === title);

      expect(book).toBeDefined();
      expect(book?.firstPublished).toBe(year);
      expect(book?.writerName).toBeTruthy();
      expect(book?.coverRights?.status).toBe("editorial-original");
      expect(book?.editorial?.status).toBe("verified");

      const coverPath = fileURLToPath(
        new URL(`../../public/${book?.coverUrl}`, import.meta.url)
      );
      expect(existsSync(coverPath)).toBe(true);
    }
  );

  it("не хранит названия подробных карточек второй раз в legacy-списках", () => {
    const duplicates = countries.flatMap((country) =>
      country.writers.flatMap((writer) => {
        const legacyTitles = new Set(
          (writer.works || []).map((title) => title.toLocaleLowerCase("ru"))
        );
        return (writer.workDetails || [])
          .filter((work) =>
            legacyTitles.has(work.title.toLocaleLowerCase("ru"))
          )
          .map(
            (work) =>
              `${country.name}: ${writer.name || writer.fullName}: ${work.title}`
          );
      })
    );

    expect(duplicates).toEqual([]);
  });
});
