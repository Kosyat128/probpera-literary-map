import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildBookArchive } from "./bookArchive";
import { calculateArchiveStatistics } from "./archiveStatistics";
import { bookArchiveCountries, countries } from "./countries";

const currentYear = new Date().getUTCFullYear();

function localPublicAssetExists(assetPath?: string) {
  if (!assetPath || /^https?:\/\//u.test(assetPath)) return true;
  return existsSync(
    fileURLToPath(new URL(`../../public/${assetPath.replace(/^\/+/, "")}`, import.meta.url))
  );
}

function numericYears(value?: string) {
  return [...(value || "").matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/gu)].map(
    (match) => Number(match[1])
  );
}

describe("качество основной базы стран", () => {
  it("не содержит повторяющихся идентификаторов писателей внутри одной страны", () => {
    const duplicates = countries.flatMap((country) => {
      const seen = new Set<string>();
      return country.writers.flatMap((writer) => {
        if (!writer.id || seen.has(writer.id)) {
          return [`${country.id}:${writer.id || "<нет id>"}`];
        }
        seen.add(writer.id);
        return [];
      });
    });

    expect(duplicates).toEqual([]);
  });

  it("хранит корректные координаты стран и писателей", () => {
    const invalid = countries.flatMap((country) => {
      const countryCoordinates = Array.isArray(country.coordinates)
        ? { lat: country.coordinates[0], lng: country.coordinates[1] }
        : country.coordinates;
      const records: string[] = [];

      if (
        countryCoordinates &&
        (Math.abs(countryCoordinates.lat) > 90 || Math.abs(countryCoordinates.lng) > 180)
      ) {
        records.push(`${country.id}:country`);
      }

      for (const writer of country.writers) {
        if (
          writer.coordinates &&
          (Math.abs(writer.coordinates.lat) > 90 || Math.abs(writer.coordinates.lng) > 180)
        ) {
          records.push(`${country.id}:${writer.id}`);
        }
      }

      return records;
    });

    expect(invalid).toEqual([]);
  });

  it("не содержит будущих дат смерти и перевёрнутых диапазонов жизни", () => {
    const invalid = countries.flatMap((country) =>
      country.writers.flatMap((writer) => {
        const years = numericYears(
          [writer.birthDate, writer.deathDate, writer.years].filter(Boolean).join(" ")
        );
        const birthYears = numericYears(writer.birthDate || writer.birth || writer.years);
        const deathYears = numericYears(writer.deathDate || writer.death || writer.years);
        const birthYear = birthYears[0];
        const deathYear = deathYears[deathYears.length - 1];

        if (years.some((year) => year > currentYear)) {
          return [`${country.id}:${writer.id}:будущая дата`];
        }
        if (birthYear && deathYear && deathYear < birthYear) {
          return [`${country.id}:${writer.id}:${birthYear}>${deathYear}`];
        }
        return [];
      })
    );

    expect(invalid).toEqual([]);
  });

  it("использует полные ФИО для российских писателей", () => {
    const incomplete =
      countries
        .find((country) => country.id === "russia")
        ?.writers.filter(
          (writer) => {
            const birthYear = numericYears(writer.birthDate || writer.birth || writer.years)[0];
            const isHistoricalMononym = Boolean(birthYear && birthYear < 1700);
            return (
              !isHistoricalMononym &&
              (writer.fullName || writer.name || "").trim().split(/\s+/u).length < 3
            );
          }
        )
        .map((writer) => `${writer.id}:${writer.fullName || writer.name || "<без имени>"}`) || [];

    expect(incomplete).toEqual([]);
  });

  it("не содержит повторяющихся подробных карточек книг", () => {
    const archive = buildBookArchive(bookArchiveCountries);
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const book of archive.filter((entry) => !entry.id.startsWith("legacy-"))) {
      const key = `${book.countryId}:${book.writerId}:${book.id}`;
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }

    expect(duplicates).toEqual([]);
  });

  it("не публикует карточку с отсутствующей локальной обложкой", () => {
    const missing = buildBookArchive(bookArchiveCountries)
      .filter((book) => book.coverUrl || book.coverThumbnailUrl)
      .flatMap((book) => [
        ...(!localPublicAssetExists(book.coverUrl)
          ? [`${book.id}:coverUrl:${book.coverUrl}`]
          : []),
        ...(!localPublicAssetExists(book.coverThumbnailUrl)
          ? [`${book.id}:coverThumbnailUrl:${book.coverThumbnailUrl}`]
          : []),
      ]);

    expect(missing).toEqual([]);
  });

  it("не публикует карточку писателя с отсутствующим локальным портретом", () => {
    const missing = countries.flatMap((country) =>
      country.writers
        .filter(
          (writer) =>
            writer.portrait && !localPublicAssetExists(writer.portrait)
        )
        .map((writer) => `${country.id}:${writer.id}:${writer.portrait}`)
    );

    expect(missing).toEqual([]);
  });

  it("считает уникальных людей и произведения, а не повторные связи", () => {
    const statistics = calculateArchiveStatistics(countries);

    expect(statistics.countries).toBe(200);
    expect(statistics.uniqueWriters).toBeLessThanOrEqual(
      statistics.writerRecords
    );
    expect(statistics.uniqueWorks).toBeLessThanOrEqual(statistics.workRecords);
    expect(statistics.uniqueWriters).toBeGreaterThan(0);
    expect(statistics.uniqueWorks).toBeGreaterThan(0);
  });

  it("не помечает проверенной книгу без библиографического источника", () => {
    const unsourced = buildBookArchive(bookArchiveCountries)
      .filter((book) => book.editorial?.status === "verified" && !book.sourceUrl)
      .map((book) => `${book.countryId}:${book.writerId}:${book.id}`);

    expect(unsourced).toEqual([]);
  });
});
