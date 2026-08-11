import { describe, expect, it } from "vitest";

import { countries } from "./countries";
import type { Writer } from "./countries";
import {
  localNobelLiteratureWriterKeysByLaureateId,
  nobelLiteratureLaureateIdByWriterKey,
  officialNobelLiteratureById,
  officialNobelLiteratureSnapshot,
  previouslyUnstructuredNobelWriterKeys,
} from "./countries/nobelLiteratureRegistry";
import {
  collectCountryNobelLaureates,
  collectNobelLaureates,
  getNobelYear,
  isNobelLaureate,
} from "./nobel";

describe("complete Nobel literature archive", () => {
  const laureates = collectNobelLaureates(countries);

  it("contains the official 1901–2025 total without cross-country duplicates", () => {
    expect(laureates).toHaveLength(122);
    expect(new Set(laureates.map(({ year }) => year)).size).toBe(118);
    expect(laureates[0].year).toBe(1901);
    expect(laureates[laureates.length - 1]?.year).toBe(2025);
  });

  it("reconciles every official record to structured local metadata", () => {
    const writerByKey = new Map(
      countries.flatMap((country) =>
        country.writers.map(
          (writer) => [`${country.id}:${writer.id}`, writer] as const
        )
      )
    );
    const localKeys = Object.values(
      localNobelLiteratureWriterKeysByLaureateId
    ).flat();

    expect(officialNobelLiteratureSnapshot.laureates).toHaveLength(122);
    expect(officialNobelLiteratureById.size).toBe(122);
    expect(Object.keys(localNobelLiteratureWriterKeysByLaureateId)).toHaveLength(122);
    expect(localKeys).toHaveLength(125);
    expect(nobelLiteratureLaureateIdByWriterKey.size).toBe(125);

    for (const writerKey of localKeys) {
      const writer = writerByKey.get(writerKey);
      const laureateId = nobelLiteratureLaureateIdByWriterKey.get(writerKey);
      const official = laureateId
        ? officialNobelLiteratureById.get(laureateId)
        : undefined;

      expect(writer, writerKey).toBeDefined();
      expect(official, writerKey).toBeDefined();
      expect(writer?.nobel).toBe(true);
      expect(writer?.nobelYear, writerKey).toBe(official?.year);
      expect(writer?.nobelAward, writerKey).toMatchObject({
        category: "literature",
        year: official?.year,
        laureateId: official?.id,
        portion: official?.portion,
      });
      expect(writer?.nobelAward?.sources.length, writerKey).toBeGreaterThanOrEqual(2);
      expect(writer?.nobelPrize, writerKey).toBe(
        `Нобелевская премия по литературе ${official?.year} года`
      );
      expect(
        writer?.awards?.some(
          (award) =>
            /нобел|nobel/iu.test(award) && award.includes(String(official?.year))
        ),
        writerKey
      ).toBe(true);
      expect(writer?.tags, writerKey).toContain("Нобелевская премия");
      expect(
        writer?.nobelAward?.sources.every(({ url }) =>
          /^https:\/\/(?:api\.|www\.)?nobelprize\.org\//u.test(url)
        ),
        writerKey
      ).toBe(true);
    }
  });

  it("closes the exact 77 pre-reconciliation structured-year gaps", () => {
    const writerByKey = new Map(
      countries.flatMap((country) =>
        country.writers.map(
          (writer) => [`${country.id}:${writer.id}`, writer] as const
        )
      )
    );

    expect(previouslyUnstructuredNobelWriterKeys).toHaveLength(77);
    for (const writerKey of previouslyUnstructuredNobelWriterKeys) {
      const writer = writerByKey.get(writerKey);
      expect(writer?.nobelYear, writerKey).toBeTypeOf("number");
      expect(writer?.nobelAward?.laureateId, writerKey).toBeTypeOf("number");
    }
  });

  it("does not turn a prose-only Nobel mention into a laureate", () => {
    const mentionOnly: Writer = {
      id: "critic",
      name: "Литературный критик",
      bio: "Исследовал историю Нобелевской премии по литературе 1905 года.",
    };

    expect(getNobelYear(mentionOnly)).toBeNull();
    expect(isNobelLaureate(mentionOnly)).toBe(false);
  });

  it("never derives the Nobel year from prose or legacy award strings", () => {
    const legacySignalOnly: Writer = {
      id: "legacy",
      name: "Legacy fixture",
      nobel: true,
      nobelPrize: "Нобелевская премия по литературе 1970 года",
      awards: ["Нобелевская премия 1970"],
      bio: "Лауреат Нобелевской премии по литературе 1970 года.",
    };

    expect(getNobelYear(legacySignalOnly)).toBeNull();
    expect(isNobelLaureate(legacySignalOnly)).toBe(false);
    expect(getNobelYear({ ...legacySignalOnly, nobelYear: 1970 })).toBe(1970);
  });

  it("recovers an official year from an unambiguous canonical writer id", () => {
    const legacySienkiewicz: Writer = {
      id: "henryk_sienkiewicz",
      name: "Генрик Сенкевич",
      awards: ["Нобелевская премия по литературе"],
    };

    expect(getNobelYear(legacySienkiewicz)).toBe(1905);
    expect(isNobelLaureate(legacySienkiewicz)).toBe(true);
  });

  it("preserves all four jointly awarded literature prizes", () => {
    const sharedYears = [1904, 1917, 1966, 1974];
    for (const year of sharedYears) {
      expect(laureates.filter((laureate) => laureate.year === year)).toHaveLength(2);
    }
  });

  it("does not create laureates for years when the prize was not awarded", () => {
    for (const year of [1914, 1918, 1935, 1940, 1941, 1942, 1943]) {
      expect(laureates.some((laureate) => laureate.year === year)).toBe(false);
    }
  });

  it("keeps every country's full laureate set available for its globe spotlight", () => {
    for (const country of countries) {
      const expectedIds = country.writers
        .filter(isNobelLaureate)
        .map((writer) => writer.id)
        .sort();
      const spotlightIds = collectCountryNobelLaureates(countries, country.id)
        .map((entry) => entry.writer.id)
        .sort();

      expect(spotlightIds, country.id).toEqual(expectedIds);
    }
  });
});
