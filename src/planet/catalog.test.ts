import { afterEach, describe, expect, it, vi } from "vitest";

import * as canonical from "../data/countries";
import * as source from "../data/countries/index";
import { applyCmsWriterProfileOverrides } from "../data/cms/editorialOverrides";
import * as catalog from "./catalog";
import * as editorial from "./editorialCatalog";
import { resolveCountryGlobeCoordinates } from "./selection";
import { resolveCountryGlobeCoordinates as canonicalCoordinates } from "../components/globeCoordinates";

afterEach(() => vi.unstubAllGlobals());

describe("shared canonical catalog views", () => {
  it("retains the existing public arrays and their live-language proxy objects", async () => {
    const reloaded = await import("./catalog");
    expect(catalog.countries).toBe(canonical.countries);
    expect(catalog.bookArchiveCountries).toBe(canonical.bookArchiveCountries);
    expect(reloaded.countries).toBe(catalog.countries);
    expect(catalog.generatedWriterDraftCount).toBe(canonical.generatedWriterDraftCount);
    expect(catalog.countries.length).toBeGreaterThan(0);
  });

  it("keeps public, pending-book, pre-review and recovery corpora distinct", () => {
    expect(editorial.publicSourceCountries).toBe(source.countries);
    expect(editorial.bookArchiveSourceCountries).toBe(source.bookArchiveCountries);
    expect(editorial.writerBiographyFactReviewSourceCountries).toBe(source.writerBiographyFactReviewSourceCountries);
    expect(editorial.editorialCatalogCountries).toBe(source.editorialCatalogCountries);
    expect(editorial.editorialCatalogCountries).not.toBe(editorial.publicSourceCountries);
    expect(editorial.bookArchiveSourceCountries).not.toBe(editorial.publicSourceCountries);
    expect(catalog).not.toHaveProperty("editorialCatalogCountries");
    expect(catalog).not.toHaveProperty("writerBiographyFactReviewSourceCountries");
  });

  it("preserves country, writer, coordinates and portrait references across a live locale switch", () => {
    const root = { dataset: { language: "ru" }, lang: "ru" };
    vi.stubGlobal("document", { documentElement: root });
    const country = catalog.countries.find((candidate) => candidate.writers.length > 0)!;
    const writers = country.writers;
    const coordinates = country.coordinates;
    const portraits = writers.map((writer) => writer.portrait);
    for (const language of ["ru", "en", "ru"]) {
      root.dataset.language = language;
      expect(catalog.countries.find((candidate) => candidate.id === country.id)).toBe(country);
      expect(country.writers).toBe(writers);
      expect(country.coordinates).toBe(coordinates);
      expect(country.writers.map((writer) => writer.portrait)).toEqual(portraits);
    }
  });

  it("preserves the canonical geographic resolver for every public country", () => {
    for (const country of catalog.countries) {
      expect(resolveCountryGlobeCoordinates(country)).toEqual(canonicalCoordinates(country));
    }
  });

  it("retains editorial recovery translations when a public CMS tombstone hides them", () => {
    const country = editorial.editorialCatalogCountries.find((candidate) => candidate.id === "russia")!;
    const writer = country.writers.find((candidate) => candidate.id === "tolstoy")!;
    const recovery = writer.biographyTranslations;
    expect(recovery?.ru).toBeTruthy();
    const publicOverride = applyCmsWriterProfileOverrides(editorial.editorialCatalogCountries, {
      "russia:tolstoy": { biographyTranslations: {} },
    });
    expect(publicOverride.find((candidate) => candidate.id === country.id)?.writers.find((candidate) => candidate.id === writer.id)?.biographyTranslations).toEqual({});
    expect(writer.biographyTranslations).toBe(recovery);
    expect(writer.biographyTranslations?.ru).toBeTruthy();
  });
});
