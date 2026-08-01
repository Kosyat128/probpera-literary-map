import { describe, expect, it } from "vitest";

import { countries } from "./countries";
import {
  collectCountryNobelLaureates,
  collectNobelLaureates,
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
