import { describe, expect, it } from "vitest";

import type { Country } from "./countries/types";
import {
  countryForLanguage,
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
});
