import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { applyCmsWriterProfileOverrides } from "../cms/editorialOverrides";
import { editorialCatalogCountries } from "./index";

describe("closed editorial writer catalog source", () => {
  it("builds the static EN source before CMS overrides", () => {
    const source = readFileSync(
      new URL("../../../scripts/writer-biography-english-source.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain('import { editorialCatalogCountries }');
    expect(source).toContain("editorialCatalogCountries.flatMap");
    expect(source).not.toContain("countries.flatMap");
  });
  it("keeps the static locale map recoverable after a public tombstone", () => {
    const country = editorialCatalogCountries.find(
      (candidate) => candidate.id === "russia"
    );
    const writer = country?.writers.find((candidate) => candidate.id === "tolstoy");
    expect(writer?.biographyTranslations?.ru).toBeTruthy();

    const overridden = applyCmsWriterProfileOverrides(
      editorialCatalogCountries,
      { "russia:tolstoy": { biographyTranslations: {} } }
    );
    const publicWriter = overridden
      .find((candidate) => candidate.id === "russia")
      ?.writers.find((candidate) => candidate.id === "tolstoy");
    expect(publicWriter?.biographyTranslations).toEqual({});
    expect(writer?.biographyTranslations?.ru).toBeTruthy();
  });

  it("keeps omitted locales hidden publicly without mutating the fallback", () => {
    const country = editorialCatalogCountries.find(
      (candidate) => candidate.id === "russia"
    );
    const writer = country?.writers.find((candidate) => candidate.id === "tolstoy");
    const russian = writer?.biographyTranslations?.ru;
    expect(russian).toBeTruthy();

    const overridden = applyCmsWriterProfileOverrides(
      editorialCatalogCountries,
      { "russia:tolstoy": { biographyTranslations: { ru: russian! } } }
    );
    const publicWriter = overridden
      .find((candidate) => candidate.id === "russia")
      ?.writers.find((candidate) => candidate.id === "tolstoy");
    expect(publicWriter?.biographyTranslations?.ru).toBeTruthy();
    expect(publicWriter?.biographyTranslations?.en).toBeUndefined();
    expect(writer?.biographyTranslations).toBe(
      country?.writers.find((candidate) => candidate.id === "tolstoy")
        ?.biographyTranslations
    );
  });
});
