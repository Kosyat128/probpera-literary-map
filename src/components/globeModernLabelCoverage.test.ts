import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type Locale = "ru" | "en";

type AtlasFeature = {
  properties: {
    ADM0_A3: string;
    NAME_RU: string;
    NAME_EN: string;
  };
};

type RenderedAsset = {
  path: string;
  locale: Locale;
  density: "desktop" | "mobile";
  countryLabelCount: number;
  countryLabelCoverage: {
    accepted: string;
    omittedByRank: string;
    omittedByCollision: string;
  };
};

type LabelOverride = Partial<Record<Locale, string>>;

const atlas = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../data/geo/countries.geojson", import.meta.url)),
    "utf8"
  )
) as { features: AtlasFeature[] };

const provenance = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../data/geo/countries.provenance.json", import.meta.url)
    ),
    "utf8"
  )
) as {
  renderedAssets: RenderedAsset[];
  labels: {
    shortLabelOverrides: Record<string, LabelOverride>;
    oceanLabels: Array<Record<Locale, string>>;
    localizationAudit: Record<
      Locale,
      {
        featureLabels: number;
        oceanLabels: number;
        missingLabels: number;
        mixedScriptLabels: number;
      }
    >;
    densityPolicy: {
      desktop: { maxLabelRank: number };
      mobile: { maxLabelRank: number };
    };
  };
};

const localeRules = {
  ru: {
    required: /\p{Script=Cyrillic}/u,
    forbidden: /\p{Script=Latin}/u,
  },
  en: {
    required: /\p{Script=Latin}/u,
    forbidden: /\p{Script=Cyrillic}/u,
  },
} satisfies Record<
  Locale,
  { required: RegExp; forbidden: RegExp }
>;

function localizedCountryLabel(feature: AtlasFeature, locale: Locale) {
  return String(
    provenance.labels.shortLabelOverrides[feature.properties.ADM0_A3]?.[
      locale
    ] ??
      (locale === "ru"
        ? feature.properties.NAME_RU
        : feature.properties.NAME_EN)
  ).trim();
}

function coverageIds(value: string) {
  return value.split(/\s+/u).filter(Boolean);
}

describe("modern globe label coverage", () => {
  it.each(["ru", "en"] as const)(
    "keeps every %s source label in the requested writing system",
    (locale) => {
      const rule = localeRules[locale];
      const countryLabels = atlas.features.map((feature) =>
        localizedCountryLabel(feature, locale)
      );
      const oceanLabels = provenance.labels.oceanLabels.map((ocean) =>
        String(ocean[locale]).trim()
      );

      expect(countryLabels).toHaveLength(177);
      expect(oceanLabels).toHaveLength(5);
      expect(
        [...countryLabels, ...oceanLabels].every(
          (label) =>
            rule.required.test(label) && !rule.forbidden.test(label)
        )
      ).toBe(true);
      expect(provenance.labels.localizationAudit[locale]).toEqual({
        featureLabels: 177,
        oceanLabels: 5,
        missingLabels: 0,
        mixedScriptLabels: 0,
      });
    }
  );

  it("records the reviewed desktop and mobile density without reducing texture scope", () => {
    expect(provenance.labels.densityPolicy.desktop.maxLabelRank).toBe(5);
    expect(provenance.labels.densityPolicy.mobile.maxLabelRank).toBe(3);
    expect(
      Object.fromEntries(
        provenance.renderedAssets.map((asset) => [
          `${asset.locale}-${asset.density}`,
          asset.countryLabelCount,
        ])
      )
    ).toEqual({
      "ru-desktop": 87,
      "ru-mobile": 70,
      "en-desktop": 87,
      "en-mobile": 69,
    });
  });

  it.each(["ru", "en"] as const)(
    "partitions all 177 %s labels into accepted and intentional omissions",
    (locale) => {
      const featureIds = atlas.features
        .map((feature) => feature.properties.ADM0_A3)
        .sort();
      const assets = provenance.renderedAssets.filter(
        (asset) => asset.locale === locale
      );

      expect(assets).toHaveLength(2);
      for (const asset of assets) {
        const accepted = coverageIds(asset.countryLabelCoverage.accepted);
        const omittedByRank = coverageIds(
          asset.countryLabelCoverage.omittedByRank
        );
        const omittedByCollision = coverageIds(
          asset.countryLabelCoverage.omittedByCollision
        );
        const omitted = [...omittedByRank, ...omittedByCollision].sort();

        expect(accepted).toHaveLength(asset.countryLabelCount);
        expect(
          [...accepted, ...omitted].sort()
        ).toEqual(featureIds);
        expect(new Set(accepted).size).toBe(accepted.length);
        expect(new Set(omitted).size).toBe(omitted.length);
        expect(accepted).toContain("IDN");
      }
    }
  );
});
