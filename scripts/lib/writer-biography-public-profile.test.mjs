import { describe, expect, it } from "vitest";

import {
  normalizePublicWriterBiographyTranslations,
  writerBiographyPublicSourceHash,
} from "./writer-biography-public-profile.mjs";

const writerName = "Лев Николаевич Толстой";

const ruText =
  "Лев Толстой (1828-1910) - русский писатель и мыслитель, автор романов «Война и мир» и «Анна Каренина». Его проза оказала значительное влияние на мировую литературу и развитие реалистического романа.";
const enText =
  "Leo Tolstoy (1828-1910) was a Russian writer and thinker who wrote the novels “War and Peace” and “Anna Karenina”. His prose had a major influence on world literature and the development of the realist novel.";
const source = {
  provider: "Государственный музей Л. Н. Толстого",
  url: "https://tolstoymuseum.ru/tolstoy/biography/",
  fields: ["identity", "life-dates", "biography-facts", "works"],
  usage: "fact-check",
  retrievedAt: "2026-08-31",
  title: "Биография Л. Н. Толстого",
};

function russianProfile(overrides = {}) {
  return {
    locale: "ru",
    text: ruText,
    sourceLanguage: "ru",
    status: "verified",
    method: "editorial-original",
    reviewedAt: "2026-08-31",
    reviewer: "Редакция Пробы Пера",
    sourceTextRights: "project-original",
    sources: [source],
    ...overrides,
  };
}

function englishProfile(overrides = {}, russian = russianProfile()) {
  return {
    locale: "en",
    text: enText,
    sourceLanguage: "Russian",
    status: "reviewed",
    method: "machine-translation",
    reviewedAt: "2026-08-31",
    reviewer: "Cloudflare Workers AI reviewer",
    translatedFromLocale: "ru",
    sourceTextRights: "project-original",
    sources: [source],
    translationMeta: {
      model: "draft-model",
      reviewerModel: "review-model",
      sourceHash: writerBiographyPublicSourceHash({ writerName, russian }),
      generatedAt: "2026-08-31T12:00:00.000Z",
    },
    ...overrides,
  };
}

function normalize(value) {
  return normalizePublicWriterBiographyTranslations(value, { writerName });
}

describe("public writer biography profile normalization", () => {
  it("does not mistake the legitimate Korean name Пэк Нам Рён for mojibake", () => {
    const text =
      "Пэк Нам Рён (род. 1949) - северокорейский писатель, получивший известность благодаря психологической прозе. Его роман «Друг» посвящён семейному конфликту и работе судьи, который рассматривает дело о разводе.";
    expect(normalize({ ru: russianProfile({ text }) }).ru?.text).toBe(text);
  });
  it("publishes a complete verified RU and reviewed two-pass EN pair", () => {
    const result = normalize({
      ru: russianProfile(),
      en: englishProfile(),
    });
    expect(result.ru).toMatchObject({ status: "verified", text: ruText });
    expect(result.en).toMatchObject({
      status: "reviewed",
      method: "machine-translation",
      translationMeta: {
        sourceHash: writerBiographyPublicSourceHash({
          writerName,
          russian: russianProfile(),
        }),
      },
    });
  });

  it("preserves complete editorial post-edit provenance", () => {
    const baseEnglish = englishProfile();
    const result = normalize({
      ru: russianProfile(),
      en: englishProfile({
        translationMeta: {
          ...baseEnglish.translationMeta,
          editorialPostEditedAt: "2026-08-31T16:14:09.805Z",
          editorialPostEditor: "Codex bilingual editorial QA",
          editorialPostEditReasonCodes: [
            "source-fact-restoration",
            "english-style-polish",
          ],
        },
      }),
    });
    expect(result.en?.translationMeta).toMatchObject({
      editorialPostEditedAt: "2026-08-31T16:14:09.805Z",
      editorialPostEditor: "Codex bilingual editorial QA",
      editorialPostEditReasonCodes: [
        "source-fact-restoration",
        "english-style-polish",
      ],
    });
  });

  it("hides EN with incomplete editorial post-edit provenance", () => {
    const baseEnglish = englishProfile();
    const result = normalize({
      ru: russianProfile(),
      en: englishProfile({
        translationMeta: {
          ...baseEnglish.translationMeta,
          editorialPostEditor: "Codex bilingual editorial QA",
        },
      }),
    });
    expect(result).toEqual({ ru: expect.any(Object) });
  });

  it("never promotes a machine EN profile to verified", () => {
    const result = normalize({
      ru: russianProfile(),
      en: englishProfile({ status: "verified" }),
    });
    expect(result).toEqual({ ru: expect.any(Object) });
  });

  it.each([
    ["missing reviewedAt", { reviewedAt: "" }],
    ["invalid calendar date", { reviewedAt: "2026-02-31" }],
    ["short text", { text: "Short biography." }],
    ["Cyrillic EN", { text: `${enText} Кириллица.` }],
    ["missing translation rights", { sourceTextRights: "" }],
    ["missing source hash", { translationMeta: { model: "a", reviewerModel: "b", generatedAt: "2026-08-31T12:00:00.000Z" } }],
    ["missing reviewer model", { translationMeta: { model: "a", sourceHash: "a".repeat(64), generatedAt: "2026-08-31T12:00:00.000Z" } }],
  ])("hides malformed reviewed EN: %s", (_label, overrides) => {
    const result = normalize({
      ru: russianProfile(),
      en: englishProfile(overrides),
    });
    expect(result).toEqual({ ru: expect.any(Object) });
  });

  it("rejects the whole locale when any source is malformed", () => {
    expect(
      normalize({
        ru: russianProfile({
          sources: [source, { ...source, url: "http://insecure.test" }],
        }),
      })
    ).toEqual({});
  });

  it("requires fact-check biography evidence and licensed-copy provenance", () => {
    expect(
      normalize({
        ru: russianProfile({
          sources: [{ ...source, fields: ["identity"] }],
        }),
      })
    ).toEqual({});
    expect(
      normalize({
        ru: russianProfile({ method: "licensed-source" }),
      })
    ).toEqual({});
  });

  it("does not publish project-original machine EN without its RU original", () => {
    expect(
      normalize({ en: englishProfile() })
    ).toEqual({});
  });

  it("requires machine EN to inherit the exact RU fact-check sources", () => {
    const result = normalize({
      ru: russianProfile(),
      en: englishProfile({
        sources: [{ ...source, url: "https://example.org/different" }],
      }),
    });
    expect(result).toEqual({ ru: expect.any(Object) });
  });

  it("recomputes the source hash from current RU identity and provenance", () => {
    const changedSource = { ...source, title: "Обновлённая биография" };
    const russian = russianProfile({ sources: [changedSource] });
    const result = normalize({
      ru: russian,
      en: englishProfile({ sources: [changedSource] }),
    });
    expect(result).toEqual({ ru: expect.any(Object) });
  });

  it("runs deterministic RU-to-EN fact QA at the public boundary", () => {
    const result = normalize({
      ru: russianProfile(),
      en: englishProfile({ text: enText.replace("1828", "1829") }),
    });
    expect(result).toEqual({ ru: expect.any(Object) });
  });
});
