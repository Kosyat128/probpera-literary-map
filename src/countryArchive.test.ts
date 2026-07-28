import { describe, expect, it } from "vitest";

import { countries } from "./data/countries";
import { countryFlag } from "./utils/countryFlag";

describe("country archive", () => {
  it("contains 200 distinct country cards", () => {
    expect(countries).toHaveLength(200);
    expect(new Set(countries.map((country) => country.id)).size).toBe(200);
  });

  it("has a valid unique two-letter code and a flag for every card", () => {
    const codes = countries.map((country) => country.code?.toUpperCase());

    expect(codes.every((code) => Boolean(code && /^[A-Z]{2}$/.test(code)))).toBe(
      true
    );
    expect(new Set(codes).size).toBe(200);
    expect(
      countries.every(
        (country) =>
          country.flag === countryFlag(country.code) &&
          country.flag !== "◈"
      )
    ).toBe(true);
  });

  it("keeps a stable writers collection on every country card", () => {
    expect(countries.every((country) => Array.isArray(country.writers))).toBe(
      true
    );
    expect(countries.filter((country) => country.writers.length > 0).length).toBe(
      198
    );
  });
});
