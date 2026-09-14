import { describe, expect, it, vi } from "vitest";

import type { Country } from "./countries/types";
import {
  countryForLanguage,
  countryCapitalReviewSourceHash,
  countryCapitalReviewTargetHash,
  countryWithActiveLanguage,
  resolveActiveCountryInterfaceLanguage,
  selectCountryEnglishTranslation,
  selectCountryCapital,
} from "./countryLocalization";
import { normalizeCountryCapitalEditorialReview } from "./countryCapitalReview.mjs";

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

// Synthetic attestation used only to exercise the source/target contract.
function capitalCountry(): Country {
  const value: Country = { ...structuredClone(country), id: "synthetic-country", capital: "Тестовая столица" };
  value.translations!.en!.fields.capital = "Test Capital";
  value.translations!.en!.capitalEditorialReview = {
    schemaVersion: 1, hashContract: "country-capital-review-v1", decision: "approved", reviewerType: "human",
    reviewer: "Synthetic fixture reviewer", reviewedAt: "2026-09-14", evidenceRef: "editorial-review:synthetic-capital-fixture",
    sourceHash: countryCapitalReviewSourceHash(value)!, targetHash: countryCapitalReviewTargetHash(value)!,
  };
  return value;
}

describe("source-bound capital selection", () => {
  it("keeps Russian text but never treats an AI-reviewed profile or generation hash as approval", () => {
    const value = capitalCountry(); delete value.translations!.en!.capitalEditorialReview;
    value.translations!.en!.sourceHash = countryCapitalReviewSourceHash(value)!;
    expect(selectCountryCapital(value, "ru")).toBe("Тестовая столица");
    expect(selectCountryCapital(value, "en")).toBeNull();
    const live = countryWithActiveLanguage(value, () => "en");
    expect(live.capital).toBeUndefined(); expect("capital" in live).toBe(false);
    expect(countryForLanguage(value, "en").capital).toBeUndefined();
    expect(value.capital).toBe("Тестовая столица");
  });

  it("accepts only the separately supplied exact source/target attestation without changing source data", () => {
    const value = capitalCountry(), before = structuredClone(value);
    expect(selectCountryCapital(value, "en")).toBe("Test Capital");
    expect(countryCapitalReviewSourceHash(value)).not.toBe(countryCapitalReviewTargetHash(value));
    expect(value).toEqual(before);
    // The new explicit contract is independent of the legacy generator's hash.
    value.translations!.en!.sourceHash = "";
    expect(selectCountryCapital(value, "en")).toBe("Test Capital");
  });

  it("rejects changed Russian capital or country identity without overwriting historical review hashes", () => {
    for (const changed of [{ capital: "Изменённая столица" }, { id: "other-country" }, { code: "XX" }]) {
      const value = capitalCountry(); const priorReview = structuredClone(value.translations!.en!.capitalEditorialReview);
      Object.assign(value, changed);
      expect(selectCountryCapital(value, "en")).toBeNull();
      expect(value.translations!.en!.capitalEditorialReview).toEqual(priorReview);
    }
    const value = capitalCountry(); value.description = "Изменилось несвязанное описание";
    expect(selectCountryCapital(value, "en")).toBe("Test Capital");
  });

  it("rejects changed English text while retaining the previous target hash", () => {
    const value = capitalCountry(), targetHash = value.translations!.en!.capitalEditorialReview!.targetHash;
    value.translations!.en!.fields.capital = "Different Capital";
    expect(selectCountryCapital(value, "en")).toBeNull();
    expect(value.translations!.en!.capitalEditorialReview!.targetHash).toBe(targetHash);
  });

  it("preserves raw source ownership through proxy/snapshot and explicit RU/EN round trips", () => {
    const value = capitalCountry(); let language: "ru" | "en" = "en";
    const live = countryWithActiveLanguage(value, () => language);
    expect(live.capital).toBe("Test Capital");
    expect(selectCountryCapital(live, "ru")).toBe("Тестовая столица");
    expect(countryCapitalReviewSourceHash(live)).toBe(countryCapitalReviewSourceHash(value));
    const snapshot = countryForLanguage(live, "en");
    expect(snapshot.capital).toBe("Test Capital");
    expect(selectCountryCapital(snapshot, "ru")).toBe("Тестовая столица");
    expect(countryForLanguage(snapshot, "ru")).toBe(value);
    expect(countryWithActiveLanguage(snapshot, () => "en").capital).toBe("Test Capital");
    language = "ru"; expect(live.capital).toBe("Тестовая столица");
    language = "en"; expect(live.capital).toBe("Test Capital");
    expect(live.writers).toBe(value.writers); expect(snapshot.writers).toBe(value.writers);
    expect(live.coordinates).toBe(value.coordinates); expect(live.id).toBe(value.id);
  });

  it("makes review withdrawal effective in the retained live proxy and newly selected snapshots", () => {
    const value = capitalCountry(); const live = countryWithActiveLanguage(value, () => "en");
    expect(live.capital).toBe("Test Capital");
    value.translations!.en!.capitalEditorialReview!.decision = "withdrawn";
    expect(live.capital).toBeUndefined(); expect("capital" in live).toBe(false);
    expect(countryForLanguage(live, "en").capital).toBeUndefined();
    value.translations!.en!.capitalEditorialReview!.decision = "rejected";
    expect(selectCountryCapital(value, "en")).toBeNull();
    expect(selectCountryCapital(value, "ru")).toBe("Тестовая столица");
  });

  it("rejects mixed-language, empty and executable markup capital values despite freshly supplied test hashes", () => {
    for (const capital of ["", " ", "Лусака", "Test столица", "Test 北京", "<b>Test</b>", "Test\nCapital"]) {
      const value = capitalCountry(); value.translations!.en!.fields.capital = capital;
      value.translations!.en!.capitalEditorialReview!.targetHash = countryCapitalReviewTargetHash(value) || "a".repeat(64);
      expect(selectCountryCapital(value, "en")).toBeNull();
    }
  });

  it("rejects malformed or nonhuman review metadata and preserves explicit nonapproval in transport", () => {
    const review = capitalCountry().translations!.en!.capitalEditorialReview!;
    for (const changed of [{ reviewerType: "ai" }, { reviewedAt: "2026-02-30" }, { hashContract: "legacy" },
      { evidenceRef: "http://example.org/review" }, { sourceHash: "observed-now" }, { reviewer: "" }, { extra: true }]) {
      expect(normalizeCountryCapitalEditorialReview({ ...review, ...changed })).toBeNull();
    }
    expect(normalizeCountryCapitalEditorialReview({ ...review, decision: "withdrawn" })?.decision).toBe("withdrawn");
  });

  it("copies review metadata without invoking accessors or sharing mutable transport state", () => {
    const review = capitalCountry().translations!.en!.capitalEditorialReview!;
    const copied = normalizeCountryCapitalEditorialReview(review)!;
    expect(copied).toEqual(review); expect(copied).not.toBe(review);
    copied.decision = "withdrawn"; expect(review.decision).toBe("approved");
    const getter = vi.fn(() => "approved");
    const unsafe = { ...review }; Object.defineProperty(unsafe, "decision", { get: getter, enumerable: true });
    expect(normalizeCountryCapitalEditorialReview(unsafe)).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });
});
