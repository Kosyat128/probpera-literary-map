import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import * as canonicalEditions from "../components/globeEditions";
import CanonicalBookIcon from "../components/BrandBookIcon";
import CanonicalFlagIcon, { countryFlagAssetPath as canonicalFlagPath } from "../components/CountryFlagIcon";
import * as editions from "./editions";
import { BrandBookIcon, CountryFlagIcon, countryFlagAssetPath } from "./brand";
import { chooseRandomLiteraryDestination, readAtlasUrlState, withAtlasUrlState } from "./selection";

describe("shared canonical presentation", () => {
  it("preserves the edition registry, current default and overlay object ownership", () => {
    expect(editions.GLOBE_EDITIONS).toBe(canonicalEditions.GLOBE_EDITIONS);
    expect(editions.GLOBE_EDITION_BY_ID).toBe(canonicalEditions.GLOBE_EDITION_BY_ID);
    expect(editions.AVAILABLE_GLOBE_EDITIONS).toBe(canonicalEditions.AVAILABLE_GLOBE_EDITIONS);
    expect(editions.DEFAULT_GLOBE_EDITION_ID).toBe(canonicalEditions.DEFAULT_GLOBE_EDITION_ID);
    for (const edition of editions.GLOBE_EDITIONS) {
      expect(editions.GLOBE_EDITION_BY_ID[edition.id]).toBe(edition);
      expect(editions.GLOBE_EDITION_BY_ID[edition.id].overlayProfile).toBe(edition.overlayProfile);
      for (const locale of ["ru", "en"] as const) {
        for (const compact of [false, true]) {
          const asset = editions.resolveGlobeEditionTexturePath(edition.id, compact, locale);
          expect(asset).toBe(canonicalEditions.resolveGlobeEditionTexturePath(edition.id, compact, locale));
          if (asset) expect(existsSync(new URL(`../../public/${asset}`, import.meta.url))).toBe(true);
        }
      }
    }
  });

  it("reuses existing brand components and checked-in flag assets", () => {
    expect(BrandBookIcon).toBe(CanonicalBookIcon);
    expect(CountryFlagIcon).toBe(CanonicalFlagIcon);
    expect(countryFlagAssetPath).toBe(canonicalFlagPath);
    for (const code of ["RU", "GB", "US"]) {
      const asset = countryFlagAssetPath(code)!;
      expect(asset).toBe(canonicalFlagPath(code));
      expect(existsSync(new URL(`../../public/assets/country-flags/${code.toLowerCase()}.svg`, import.meta.url))).toBe(true);
    }
    expect(countryFlagAssetPath("not-a-country-code")).toBeNull();
  });

  it("selects the caller's existing eligible object instead of creating a platform copy", () => {
    const selected = { id: "russia", name: "Russia" };
    const other = { id: "france", name: "France" };
    expect(chooseRandomLiteraryDestination({ candidates: [selected, other], randomValue: 0, currentId: other.id })).toBe(selected);
    expect(chooseRandomLiteraryDestination({ candidates: [selected, other], randomValue: 0, isEligible: () => false })).toBeNull();
  });

  it("preserves country/writer/work selection and uncontrolled URL state in both locale routes", () => {
    const state = { countryId: "russia", writerId: "tolstoy", filter: "verified", view: "immersive" } as const;
    for (const locale of ["ru", "en"]) {
      const url = withAtlasUrlState(`https://probpera.ru/${locale}/?book=russia%3Atolstoy%3Awar-and-peace&archiveShelf=saved#books`, state);
      expect(readAtlasUrlState(url.href)).toEqual(state);
      expect(url.pathname).toBe(`/${locale}/`);
      expect(url.searchParams.get("book")).toBe("russia:tolstoy:war-and-peace");
      expect(url.searchParams.get("archiveShelf")).toBe("saved");
      expect(url.hash).toBe("#books");
    }
  });
});
