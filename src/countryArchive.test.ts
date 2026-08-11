import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

  it("has a local SVG asset for every country without a CDN request", () => {
    const flagDirectory = fileURLToPath(
      new URL("../public/assets/country-flags/", import.meta.url)
    );

    expect(
      countries.every((country) =>
        existsSync(
          `${flagDirectory}${country.code?.toLowerCase()}.svg`
        )
      )
    ).toBe(true);
  });

  it("keeps every flag SVG self-contained and renderable on the globe", () => {
    const flagDirectory = fileURLToPath(
      new URL("../public/assets/country-flags/", import.meta.url)
    );

    countries.forEach((country) => {
      const file = `${flagDirectory}${country.code?.toLowerCase()}.svg`;
      const source = readFileSync(file, "utf8");
      const viewBox = source.match(
        /viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i
      );

      expect(source).toMatch(/^<svg\b/i);
      expect(source).not.toMatch(/(?:href|src)=["']https?:\/\//i);
      expect(viewBox, `${country.name}: SVG без корректного viewBox`).not.toBeNull();
      expect(Number(viewBox?.[3])).toBeGreaterThan(0);
      expect(Number(viewBox?.[4])).toBeGreaterThan(0);
    });
  });

  it("keeps a stable writers collection on every country card", () => {
    expect(countries.every((country) => Array.isArray(country.writers))).toBe(
      true
    );
    expect(countries.filter((country) => country.writers.length > 0).length).toBe(
      194
    );
  });
});
