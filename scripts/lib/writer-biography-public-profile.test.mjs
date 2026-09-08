import { describe, expect, it } from "vitest";
import {
  WRITER_BIOGRAPHY_REVIEW_HASH_CONTRACT,
  writerBiographyReviewSourceHash,
  writerBiographyReviewTargetHash,
} from "../../src/data/biographyEditorialReview.ts";

import {
  normalizePublicWriterBiographyTranslations,
  writerBiographyPublicSourceHash,
} from "./writer-biography-public-profile.mjs";

const writerName = "Лев Николаевич Толстой";
const writerId = "synthetic-test-writer";

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
  const profile = {
    locale: "en",
    text: enText,
    sourceLanguage: "Russian",
    status: "reviewed",
    method: "machine-translation",
    reviewedAt: "2026-08-31",
    reviewer: "Synthetic test reviewer - not a production approval",
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
  if (!Object.hasOwn(overrides, "editorialReview")) {
    profile.editorialReview = {
      schemaVersion: 1,
      hashContract: WRITER_BIOGRAPHY_REVIEW_HASH_CONTRACT,
      decision: "approved",
      reviewerType: "human",
      reviewer: profile.reviewer,
      reviewedAt: profile.reviewedAt,
      evidenceRef: "editorial-review:synthetic-test-only",
      sourceHash: writerBiographyReviewSourceHash({
        id: writerId, name: writerName, biographyTranslations: { ru: russian },
      }, "ru"),
      targetHash: writerBiographyReviewTargetHash(profile),
    };
  }
  return profile;
}

function normalize(value) {
  return normalizePublicWriterBiographyTranslations(value, { writerName, writerId });
}

describe("public writer biography profile normalization", () => {
  it("does not mistake the legitimate Korean name Пэк Нам Рён for mojibake", () => {
    const text =
      "Пэк Нам Рён (род. 1949) - северокорейский писатель, получивший известность благодаря психологической прозе. Его роман «Друг» посвящён семейному конфликту и работе судьи, который рассматривает дело о разводе.";
    expect(normalize({ ru: russianProfile({ text }) }).ru?.text).toBe(text);
  });
  it("publishes RU and a machine draft only after an independently supplied exact human review", () => {
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
      editorialReview: englishProfile().editorialReview,
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

  it.each(["human-translation", "machine-translation"])(
    "requires independent acceptance even when %s claims reviewed", (method) => {
      const candidate = englishProfile({ method, editorialReview: undefined });
      expect(normalize({ ru: russianProfile(), en: candidate })).toEqual({ ru: expect.any(Object) });
    }
  );

  it("does not treat AI post-edit provenance as acceptance", () => {
    const candidate = englishProfile({ editorialReview: undefined });
    candidate.translationMeta.editorialPostEditedAt = "2026-08-31T16:14:09.805Z";
    candidate.translationMeta.editorialPostEditor = "Codex bilingual editorial QA";
    candidate.translationMeta.editorialPostEditReasonCodes = ["english-style-polish"];
    expect(normalize({ ru: russianProfile(), en: candidate })).toEqual({ ru: expect.any(Object) });
  });

  it("publishes an exactly accepted human translation and rejects its later source/target edits", () => {
    const en = englishProfile({ method: "human-translation", translationMeta: undefined });
    expect(normalize({ ru: russianProfile(), en }).en?.text).toBe(enText);
    const changedSource = russianProfile({ text: ruText.replace("мыслитель", "публицист") });
    expect(normalize({ ru: changedSource, en }).en).toBeUndefined();
    expect(normalize({ ru: russianProfile(), en: { ...en, text: enText.replace("thinker", "essayist") } }).en).toBeUndefined();
  });

  it("binds acceptance to the canonical writer identity and fails closed without it", () => {
    const value = { ru: russianProfile(), en: englishProfile() };
    for (const context of [{ writerName }, { writerName, writerId: "another-writer" }, { writerName: "Changed name", writerId }]) {
      expect(normalizePublicWriterBiographyTranslations(value, context).en).toBeUndefined();
    }
  });

  it("honors withdrawal and refuses to silently normalize approved text", () => {
    const en = englishProfile();
    expect(normalize({ ru: russianProfile(), en: { ...en, editorialReview: { ...en.editorialReview, decision: "withdrawn" } } }).en).toBeUndefined();
    const padded = englishProfile({ text: ` ${enText} ` });
    expect(normalize({ ru: russianProfile(), en: padded }).en).toBeUndefined();
  });

  it("preserves optional original and human-translation provenance covered by acceptance", () => {
    const ru = russianProfile({ translationMeta: { sourceHash: "b".repeat(64), generatedAt: "2026-08-31" } });
    const targetProvenance = {
      editorialPostEditedAt: "2026-08-31T16:14:09.805Z",
      editorialPostEditor: "Synthetic test editor",
      editorialPostEditReasonCodes: ["english-style-polish"],
    };
    const en = englishProfile({ method: "human-translation", translationMeta: targetProvenance }, ru);
    const result = normalize({ ru, en });
    expect(result.ru?.translationMeta).toEqual(ru.translationMeta);
    expect(result.en?.translationMeta).toEqual(targetProvenance);
    expect(result.en?.editorialReview).toEqual(en.editorialReview);
    const machineResult = normalize({ ru, en: englishProfile({}, ru) });
    expect(machineResult.en?.text).toBe(enText);
  });
});
