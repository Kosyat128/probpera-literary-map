import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  atlasCountrySiteCopyKey,
  MODERN_GLOBE_OCEAN_LABELS,
  resolveModernGlobeLabels,
} from "./modern-globe-site-copy.mjs";

const indonesia = {
  properties: {
    ADM0_A3: "IDN",
    ISO_A2: "ID",
    WB_A2: "ID",
    NAME_RU: "Индонезия",
    NAME_EN: "Indonesia",
  },
};

describe("modern globe site-copy labels", () => {
  it("passes Russian and English country overrides and an ocean override to the renderer input", () => {
    const resolved = resolveModernGlobeLabels({
      features: [indonesia],
      siteCopy: {
        ru: {
          "country.ID": "Республика Индонезия",
          "globe.ocean.pacific": "Великий Тихий океан",
        },
        en: {
          "country.ID": "Republic of Indonesia",
          "globe.ocean.pacific": "Great Pacific Ocean",
        },
      },
    });

    expect(resolved.countryLabels.IDN).toMatchObject({
      key: "country.ID",
      ru: "Республика Индонезия",
      en: "Republic of Indonesia",
      longitude: 117.37,
      latitude: -2.28,
    });
    expect(resolved.oceanLabels[0]).toMatchObject({
      key: "globe.ocean.pacific",
      ru: "Великий Тихий океан",
      en: "Great Pacific Ocean",
    });
    expect(resolved.appliedCountryKeys).toEqual(["country.ID"]);
    expect(resolved.appliedOceanKeys).toEqual(["globe.ocean.pacific"]);
  });

  it("uses the same explicit Natural Earth edge mappings as globe hit testing", () => {
    expect(atlasCountrySiteCopyKey({ ADM0_A3: "TWN", ISO_A2: "CN-TW" })).toBe(
      "country.TW"
    );
    expect(atlasCountrySiteCopyKey({ ADM0_A3: "CYN", POSTAL: "CN" })).toBe(
      "country.CY"
    );
    expect(atlasCountrySiteCopyKey({ ADM0_A3: "SOL", POSTAL: "SL" })).toBe(
      "country.SO"
    );
    expect(atlasCountrySiteCopyKey({ ADM0_A3: "KOS", WB_A2: "KV" })).toBe(
      "country.XK"
    );
  });

  it("wires the CMS export before all four modern textures and release QA", async () => {
    const [packageJson, builderSource, catalog, atlas] = await Promise.all([
      readFile(new URL("../../package.json", import.meta.url), "utf8").then(
        JSON.parse
      ),
      readFile(
        new URL("../build-modern-globe-texture.mjs", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL(
          "../../apps/admin/catalog-assets/interface-copy-catalog.json",
          import.meta.url
        ),
        "utf8"
      ).then(JSON.parse),
      readFile(
        new URL("../../src/data/geo/countries.geojson", import.meta.url),
        "utf8"
      ).then(JSON.parse),
    ]);
    const build = packageJson.scripts.build;
    const snapshotBuild = packageJson.scripts["build:from-snapshot"];
    expect(build.indexOf("content:export:cms")).toBeLessThan(
      build.indexOf("build:from-snapshot")
    );
    expect(snapshotBuild).toContain("assets:globe:modern");
    expect(snapshotBuild).toContain("assets:globe:qa");
    expect(snapshotBuild.indexOf("assets:globe:modern")).toBeLessThan(
      snapshotBuild.indexOf("assets:globe:qa")
    );
    expect(builderSource).toContain("publicCmsSnapshotPath");
    expect(builderSource).toContain("resolveModernGlobeLabels");
    expect(
      MODERN_GLOBE_OCEAN_LABELS.every((ocean) =>
        catalog.some((entry) => entry.key === ocean.key)
      )
    ).toBe(true);
    const catalogKeys = new Set(catalog.map((entry) => entry.key));
    expect(
      atlas.features.every((feature) =>
        catalogKeys.has(atlasCountrySiteCopyKey(feature.properties))
      )
    ).toBe(true);
  });
});
