import { describe, expect, it } from "vitest";

import type { Country } from "./countries/types";
import {
  countryForLanguage,
  countryWithActiveLanguage,
  resolveActiveCountryInterfaceLanguage,
  selectCountryEnglishTranslation,
} from "./countryLocalization";

const country: Country = {
  id: "russia",
  name: "Россия",
  code: "RU",
  coordinates: [55, 37],
  description: "Русское описание",
  literaryPeriods: ["Золотой век"],
  writers: [{ id: "writer-1", name: "Автор" }],
  nobel: 5,
  translations: {
    en: {
      locale: "en",
      status: "reviewed",
      method: "machine-translation",
      sourceHash: "abc123",
      model: "gpt-5.6-sol",
      reviewerModel: "gpt-5.6-sol",
      fields: {
        name: "Russia",
        description: "An English literary profile.",
        literaryPeriods: ["Golden Age"],
      },
    },
  },
};

describe("country localization", () => {
  it("overlays only reviewed English editorial fields", () => {
    const localized = countryForLanguage(country, "en");
    expect(localized.name).toBe("Russia");
    expect(localized.description).toBe("An English literary profile.");
    expect(localized.literaryPeriods).toEqual(["Golden Age"]);
    expect(localized.coordinates).toEqual(country.coordinates);
    expect(localized.writers).toBe(country.writers);
    expect(localized.nobel).toBe(5);
  });

  it("keeps the Russian source unchanged in Russian mode", () => {
    expect(countryForLanguage(country, "ru")).toBe(country);
  });

  it("rejects an English profile without source provenance", () => {
    const unsafe: Country = {
      ...country,
      translations: {
        en: {
          ...country.translations!.en!,
          sourceHash: "",
        },
      },
    };
    expect(selectCountryEnglishTranslation(unsafe)).toBeNull();
    expect(countryForLanguage(unsafe, "en")).toBe(unsafe);
  });

  it("switches a stable public record live without mutating the source", () => {
    let language: "ru" | "en" = "ru";
    const live = countryWithActiveLanguage(country, () => language);

    expect(live.name).toBe("Россия");
    expect(live.description).toBe("Русское описание");

    language = "en";
    expect(live.name).toBe("Russia");
    expect(live.description).toBe("An English literary profile.");
    expect(live.writers).toBe(country.writers);
    expect(country.name).toBe("Россия");

    language = "ru";
    expect(live.name).toBe("Россия");
  });

  it("uses the live applied language after a visitor switches languages", () => {
    expect(
      resolveActiveCountryInterfaceLanguage({
        appliedLanguage: "ru",
        routeLanguage: "en",
        storedLanguage: "en",
        documentLanguage: "en",
      })
    ).toBe("ru");
  });

  it("uses an explicit route before stale storage on the first render", () => {
    expect(
      resolveActiveCountryInterfaceLanguage({
        routeLanguage: "en",
        storedLanguage: "ru",
        documentLanguage: "ru",
      })
    ).toBe("en");
  });

  it("falls back to the stored preference when no route is declared", () => {
    expect(
      resolveActiveCountryInterfaceLanguage({
        storedLanguage: "en",
        documentLanguage: "ru",
      })
    ).toBe("en");
  });
});
