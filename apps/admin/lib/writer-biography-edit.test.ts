import { describe, expect, it } from "vitest";

import {
  assertWriterBiographyTextQuality,
  assertWriterBiographyEnglishFidelity,
  buildWriterBiographySaveModel,
  effectiveStoredWriterBiographyTranslations,
  isCurrentMachineWriterBiography,
  parseWriterBiographySourcesJson,
  writerBiographyEnglishAutomationOwnership,
  writerBiographySourceIdentity,
  type WriterBiographyLocaleEditorInput,
  type WriterBiographyProfile,
} from "./writer-biography-edit";

const source = {
  provider: "Российская государственная библиотека",
  url: "https://example.org/writer",
  fields: ["identity", "life-dates", "biography-facts", "works"],
  usage: "fact-check",
  retrievedAt: "2026-08-31",
  title: "Проверенная справка о писателе",
};

const russianText =
  "Русский писатель работал в нескольких литературных жанрах и участвовал в культурной жизни своей эпохи. Его основные произведения получили признание читателей и исследователей литературы.";
const changedRussianText =
  "Русский писатель работал в нескольких литературных жанрах и участвовал в культурной жизни своей эпохи. Его основные произведения отражают этапы творческого пути и развитие художественного метода.";
const englishText =
  "The Russian writer worked in several literary genres and participated in the cultural life of the period. The writer's major works gained recognition among readers and literary scholars.";

function localeInput(
  locale: "ru" | "en",
  overrides: Partial<WriterBiographyLocaleEditorInput> = {}
): WriterBiographyLocaleEditorInput {
  return {
    enabled: true,
    text: locale === "ru" ? russianText : englishText,
    sourceLanguage: locale === "ru" ? "Russian" : "Russian",
    status: "reviewed",
    method: locale === "ru" ? "editorial-original" : "human-translation",
    reviewedAt: "2026-08-31",
    reviewer: "Редакция Пробы Пера",
    translatedFromLocale: locale === "en" ? "ru" : "",
    sourceTextRights: locale === "en" ? "project-original" : "",
    sourcesJson: JSON.stringify([source]),
    ...overrides,
  };
}

function profile(
  locale: "ru" | "en",
  overrides: Partial<WriterBiographyProfile> = {}
): WriterBiographyProfile {
  return {
    locale,
    text: locale === "ru" ? russianText : englishText,
    sourceLanguage: "Russian",
    status: "reviewed",
    method: locale === "ru" ? "editorial-original" : "human-translation",
    reviewedAt: "2026-08-31",
    reviewer: "Редакция Пробы Пера",
    ...(locale === "en"
      ? {
          translatedFromLocale: "ru" as const,
          sourceTextRights: "project-original" as const,
        }
      : {}),
    sources: [
      {
        ...source,
        fields: ["identity", "life-dates", "biography-facts", "works"],
        usage: "fact-check",
      },
    ],
    ...overrides,
  };
}

describe("structured writer biography save model", () => {
  it("uses fullName before name for the canonical translation identity", () => {
    expect(
      writerBiographySourceIdentity(
        { name: "Русское имя", fullName: "Canonical Latin Name" },
        "writer-id"
      )
    ).toBe("Canonical Latin Name");
    expect(writerBiographySourceIdentity({ name: "Русское имя" }, "writer-id")).toBe(
      "Русское имя"
    );
  });

  it("blocks machine EN when deterministic facts drift from RU", () => {
    const sourceText =
      "Лев Толстой (1828-1910) - русский писатель, автор романов «Война и мир» и «Анна Каренина». Его произведения входят в мировую литературную традицию и продолжают изучаться исследователями.";
    const validEnglish =
      "Leo Tolstoy (1828-1910) was a Russian writer who wrote the novels “War and Peace” and “Anna Karenina”. His works belong to the world literary tradition and continue to be studied by scholars.";
    expect(
      assertWriterBiographyEnglishFidelity({
        sourceText,
        englishText: validEnglish,
        writerName: "Leo Tolstoy",
      })
    ).toBe(validEnglish);
    expect(() =>
      assertWriterBiographyEnglishFidelity({
        sourceText,
        englishText: validEnglish.replace("1828", "1829"),
        writerName: "Leo Tolstoy",
      })
    ).toThrow("числовые факты");
  });

  it("does not call a legacy one-pass or stale machine EN current", () => {
    const russian = profile("ru");
    const valid = profile("en", {
      method: "machine-translation",
      text:
        "Leo Tolstoy was a Russian writer whose novels examined moral choice and social change throughout his creative period. His major works received lasting recognition among readers and literary scholars.",
      translationMeta: {
        model: "draft-model",
        reviewerModel: "review-model",
        sourceHash: "b".repeat(64),
        generatedAt: "2026-08-31T12:00:00.000Z",
      },
    });
    const input = {
      russian,
      english: valid,
      sourceHash: "b".repeat(64),
      writerName: "Leo Tolstoy",
    };
    expect(isCurrentMachineWriterBiography(input)).toBe(true);
    expect(
      isCurrentMachineWriterBiography({
        ...input,
        english: { ...valid, status: "verified" },
      })
    ).toBe(false);
    expect(
      isCurrentMachineWriterBiography({
        ...input,
        english: {
          ...valid,
          translationMeta: { ...valid.translationMeta, reviewerModel: null },
        },
      })
    ).toBe(false);
    expect(
      isCurrentMachineWriterBiography({
        ...input,
        english: { ...valid, sources: [] },
      })
    ).toBe(false);
  });
  it("accepts the legitimate Korean name Пэк Нам Рён", () => {
    expect(() =>
      assertWriterBiographyTextQuality(
        "ru",
        "Пэк Нам Рён (род. 1949) - северокорейский писатель, получивший известность благодаря психологической прозе. Его роман «Друг» посвящён семейному конфликту и работе судьи, который рассматривает дело о разводе."
      )
    ).not.toThrow();
  });

  it.each([
    [
      "source narration",
      "Согласно источнику, писатель создавал романы о человеческой памяти и исторических переменах своего времени. Его произведения обращаются к нравственному выбору и частной жизни героев.",
    ],
    [
      "technical narration",
      "SHA-256 подтверждает служебную версию биографии писателя и перечень его основных произведений. Текст содержит сведения о романах, литературных темах и периоде творческой работы автора.",
    ],
    [
      "tautology",
      "Писатель создавал психологические романы о нравственном выборе человека и общественных переменах. Писатель создавал психологические романы о нравственном выборе человека и общественных переменах.",
    ],
  ])("blocks RU %s before save", (_label, text) => {
    expect(() => assertWriterBiographyTextQuality("ru", text)).toThrow(
      "служебное описание"
    );
  });

  it("counts initials as part of a sentence and blocks model artifacts", () => {
    expect(() =>
      assertWriterBiographyTextQuality(
        "en",
        "T. S. Eliot was an English-language poet whose writing transformed modernist literature through allusion, rhythm and dramatic voices in a single sustained account."
      )
    ).toThrow("2-4");
    expect(() =>
      assertWriterBiographyTextQuality(
        "en",
        "SOURCE_DATA is a model artifact that must never be presented as a checked biography in the public archive. This second sentence only makes the malformed output long enough for the ordinary length gate."
      )
    ).toThrow("служебный вывод модели");
  });

  it("counts a sentence ending after a regnal Roman numeral", () => {
    expect(() =>
      assertWriterBiographyTextQuality(
        "en",
        "The university was named for Mohammed V. In 2003, Fatima Mernissi shared the Prince of Asturias Award for Letters and continued her work on gender, religion and society."
      )
    ).not.toThrow();
  });

  it("never allows a machine translation to claim verified status", () => {
    const machineEnglish = profile("en", {
      method: "machine-translation",
      status: "reviewed",
      translationMeta: {
        sourceHash: "current-source",
        model: "translator",
        reviewerModel: "reviewer",
        generatedAt: "2026-08-31T12:00:00.000Z",
      },
    });
    expect(() =>
      buildWriterBiographySaveModel({
        sourceTranslations: { ru: profile("ru"), en: machineEnglish },
        overrideTranslations: undefined,
        ru: localeInput("ru"),
        en: localeInput("en", {
          method: "machine-translation",
          status: "verified",
          sourcesJson: JSON.stringify(machineEnglish.sources),
        }),
      })
    ).toThrow("статус reviewed");
  });
  it("keeps validated status, rights and provenance for both locales", () => {
    const result = buildWriterBiographySaveModel({
      sourceTranslations: {},
      overrideTranslations: {},
      ru: localeInput("ru"),
      en: localeInput("en"),
    });

    expect(result.biographyTranslations.ru).toMatchObject({
      locale: "ru",
      status: "reviewed",
      method: "editorial-original",
      sources: [{ provider: source.provider, usage: "fact-check" }],
    });
    expect(result.biographyTranslations.en).toMatchObject({
      locale: "en",
      method: "human-translation",
      translatedFromLocale: "ru",
      sourceTextRights: "project-original",
    });
    expect(result.shouldAutoTranslate).toBe(true);
  });

  it("invalidates stale machine EN after a Russian source edit", () => {
    const machineEnglish = profile("en", {
      method: "machine-translation",
      translationMeta: { sourceHash: "old-source", model: "translator" },
    });
    const result = buildWriterBiographySaveModel({
      sourceTranslations: {
        ru: profile("ru"),
        en: machineEnglish,
      },
      overrideTranslations: undefined,
      ru: localeInput("ru", { text: changedRussianText }),
      en: localeInput("en", {
        method: "machine-translation",
        sourcesJson: JSON.stringify(machineEnglish.sources),
      }),
    });

    expect(result.russianSourceChanged).toBe(true);
    expect(result.invalidatedMachineEnglish).toBe(true);
    expect(result.biographyTranslations.en).toBeNull();
    expect(result.shouldAutoTranslate).toBe(true);
  });

  it("keeps an explicit EN tombstone durable after an RU edit", () => {
    const machineEnglish = profile("en", {
      method: "machine-translation",
      translationMeta: { sourceHash: "old-source", model: "translator" },
    });
    const result = buildWriterBiographySaveModel({
      sourceTranslations: { ru: profile("ru"), en: machineEnglish },
      overrideTranslations: undefined,
      ru: localeInput("ru", { text: changedRussianText }),
      en: localeInput("en", { enabled: false }),
    });

    expect(result.russianSourceChanged).toBe(true);
    expect(result.invalidatedMachineEnglish).toBe(false);
    expect(result.biographyTranslations.en).toBeNull();
    expect(result.shouldAutoTranslate).toBe(false);
  });

  it.each([
    ["omitted EN", { biographyTranslations: { ru: profile("ru") } }],
    [
      "null EN",
      { biographyTranslations: { ru: profile("ru"), en: null } },
    ],
  ])(
    "classifies a CMS %s as a durable EN tombstone",
    (_label, overrideFields) => {
      expect(
        writerBiographyEnglishAutomationOwnership({
          overrideFields,
          english: undefined,
        })
      ).toBe("tombstone");
    }
  );

  it.each(["draft", "reviewed", "verified"] as const)(
    "keeps a human-owned %s EN out of machine automation",
    (status) => {
      const english = profile("en", { status, method: "human-translation" });
      expect(
        writerBiographyEnglishAutomationOwnership({
          overrideFields: { biographyTranslations: { en: english } },
          english,
        })
      ).toBe("human");
    }
  );

  it("does not mistake a source-only missing EN for a CMS tombstone", () => {
    expect(
      writerBiographyEnglishAutomationOwnership({
        overrideFields: { description: "editorial override" },
        english: undefined,
      })
    ).toBe("automatic");
  });

  it("requires explicit re-review before preserving manual EN after an RU change", () => {
    const manualEnglish = profile("en");
    const input = {
      sourceTranslations: { ru: profile("ru"), en: manualEnglish },
      overrideTranslations: undefined,
      ru: localeInput("ru", { text: changedRussianText }),
      en: localeInput("en", {
        method: "human-translation" as const,
        sourcesJson: JSON.stringify(manualEnglish.sources),
      }),
    };

    expect(() => buildWriterBiographySaveModel(input)).toThrow(
      "явно подтвердите"
    );
    const result = buildWriterBiographySaveModel({
      ...input,
      confirmManualEnglishAgainstRussianChange: true,
      manualEnglishConfirmationDate: "2026-09-01",
    });

    expect(result.invalidatedMachineEnglish).toBe(false);
    expect(result.manualEnglishConfirmedAgainstRussianChange).toBe(true);
    expect(result.biographyTranslations.en).toMatchObject({
      text: englishText,
      method: "human-translation",
      status: "reviewed",
      reviewedAt: "2026-09-01",
    });
  });

  it("preserves machine ownership metadata when the source is unchanged", () => {
    const machineEnglish = profile("en", {
      method: "machine-translation",
      translationMeta: { sourceHash: "current-source", model: "translator" },
    });
    const result = buildWriterBiographySaveModel({
      sourceTranslations: { ru: profile("ru"), en: machineEnglish },
      overrideTranslations: undefined,
      ru: localeInput("ru"),
      en: localeInput("en", {
        method: "machine-translation",
        sourcesJson: JSON.stringify(machineEnglish.sources),
      }),
    });

    expect(result.invalidatedMachineEnglish).toBe(false);
    expect(result.biographyTranslations.en?.translationMeta).toEqual({
      sourceHash: "current-source",
      model: "translator",
    });
  });

  it.each([
    ["sourceLanguage", { sourceLanguage: "English" }],
    ["reviewer", { reviewer: "Другой проверяющий" }],
    ["sourceTextRights", { sourceTextRights: "public-domain" }],
  ])("requires human ownership before changing machine EN %s", (_field, change) => {
    const machineEnglish = profile("en", {
      method: "machine-translation",
      translationMeta: { sourceHash: "current-source", model: "translator" },
    });
    expect(() =>
      buildWriterBiographySaveModel({
        sourceTranslations: { ru: profile("ru"), en: machineEnglish },
        overrideTranslations: undefined,
        ru: localeInput("ru"),
        en: localeInput("en", {
          method: "machine-translation",
          sourcesJson: JSON.stringify(machineEnglish.sources),
          ...change,
        }),
      })
    ).toThrow("human-translation");
  });

  it("accepts the published editorial RU original with a machine-translated EN", () => {
    const projectOriginalRussian = profile("ru", {
      sourceTextRights: "project-original",
    });
    const machineEnglish = profile("en", {
      method: "machine-translation",
      translationMeta: { sourceHash: "current-source", model: "translator" },
    });
    const result = buildWriterBiographySaveModel({
      sourceTranslations: {
        ru: projectOriginalRussian,
        en: machineEnglish,
      },
      overrideTranslations: undefined,
      ru: localeInput("ru", { sourceTextRights: "project-original" }),
      en: localeInput("en", {
        method: "machine-translation",
        sourcesJson: JSON.stringify(machineEnglish.sources),
      }),
    });

    expect(result.biographyTranslations.ru).toMatchObject({
      method: "editorial-original",
      sourceTextRights: "project-original",
    });
    expect(result.biographyTranslations.en).toMatchObject({
      method: "machine-translation",
      translatedFromLocale: "ru",
    });
  });

  it("does not resurrect a catalog EN hidden by a CMS invalidation tombstone", () => {
    const effective = effectiveStoredWriterBiographyTranslations(
      { ru: profile("ru"), en: profile("en", { method: "machine-translation" }) },
      { ru: profile("ru", { text: changedRussianText }), en: null }
    );

    expect(effective.ru?.text).toBe(changedRussianText);
    expect(effective.en).toBeUndefined();
  });

  it("uses parent-map ownership for partial and empty CMS biography maps", () => {
    const source = {
      ru: profile("ru"),
      en: profile("en", { method: "machine-translation" }),
    };
    const partial = effectiveStoredWriterBiographyTranslations(source, {
      ru: profile("ru", { text: changedRussianText }),
    });

    expect(partial.ru?.text).toBe(changedRussianText);
    expect(partial.en).toBeUndefined();
    expect(effectiveStoredWriterBiographyTranslations(source, {})).toEqual({});
    expect(effectiveStoredWriterBiographyTranslations(source, null)).toEqual({});
    expect(
      effectiveStoredWriterBiographyTranslations(source, undefined)
    ).toMatchObject({ ru: source.ru, en: source.en });
  });

  it("invalidates machine EN when RU is moved out of the publishable state", () => {
    const machineEnglish = profile("en", {
      method: "machine-translation",
      translationMeta: { sourceHash: "current-source", model: "translator" },
    });
    const result = buildWriterBiographySaveModel({
      sourceTranslations: { ru: profile("ru"), en: machineEnglish },
      overrideTranslations: undefined,
      ru: localeInput("ru", { status: "draft", reviewedAt: "" }),
      en: localeInput("en", {
        method: "machine-translation",
        sourcesJson: JSON.stringify(machineEnglish.sources),
      }),
    });

    expect(result.shouldAutoTranslate).toBe(false);
    expect(result.invalidatedMachineEnglish).toBe(true);
    expect(result.biographyTranslations.en).toBeNull();
  });

  it("rejects incomplete provenance, unlawful translations and Cyrillic EN", () => {
    expect(() =>
      parseWriterBiographySourcesJson('[{"provider":"Archive"}]')
    ).toThrow("Источник 1");
    expect(() =>
      buildWriterBiographySaveModel({
        sourceTranslations: {},
        overrideTranslations: {},
        ru: localeInput("ru"),
        en: localeInput("en", {
          text: `${englishText} Кириллица.`,
          sourceTextRights: "",
        }),
      })
    ).toThrow(/EN:/u);
  });

  it("requires biography-facts fact-check evidence for a checked status", () => {
    const identityOnly = [{
      ...source,
      fields: ["identity"],
      usage: "structured-data",
    }];
    expect(() =>
      buildWriterBiographySaveModel({
        sourceTranslations: {},
        overrideTranslations: {},
        ru: localeInput("ru", { sourcesJson: JSON.stringify(identityOnly) }),
        en: localeInput("en"),
      })
    ).toThrow("fact-check");
  });

  it("rejects overlong or credential-bearing source URLs before save", () => {
    for (const url of [
      `https://example.org/${"a".repeat(1_100)}`,
      "https://user:secret@example.org/writer",
    ]) {
      expect(() =>
        parseWriterBiographySourcesJson(
          JSON.stringify([{ ...source, url }])
        )
      ).toThrow(/HTTPS|1000/u);
    }
  });

  it("rejects generic RU and EN text before the public strict selector", () => {
    const genericRussian =
      "Автор, связанный с литературной традицией страны, представлен в архивной карточке общей справкой без подтверждённых сведений. Расширенная биография этого автора готовится редакцией проекта.";
    const genericEnglish =
      "The biography for this writer is being prepared by the editorial team and currently contains no verified individual facts. A complete biographical note will be added after a later review.";

    expect(() =>
      buildWriterBiographySaveModel({
        sourceTranslations: {},
        overrideTranslations: {},
        ru: localeInput("ru", { text: genericRussian }),
        en: localeInput("en"),
      })
    ).toThrow("шаблонный");
    expect(() =>
      buildWriterBiographySaveModel({
        sourceTranslations: {},
        overrideTranslations: {},
        ru: localeInput("ru"),
        en: localeInput("en", { text: genericEnglish }),
      })
    ).toThrow("шаблонный");
  });

  it("requires licensed-copy evidence for licensed or permission translations", () => {
    expect(() =>
      buildWriterBiographySaveModel({
        sourceTranslations: {},
        overrideTranslations: {},
        ru: localeInput("ru"),
        en: localeInput("en", { sourceTextRights: "permission" }),
      })
    ).toThrow("licensed-copy");
  });

  it("rejects mojibake and project-original without an editorial opposite locale", () => {
    expect(() =>
      buildWriterBiographySaveModel({
        sourceTranslations: {},
        overrideTranslations: {},
        ru: localeInput("ru", { text: `${russianText} Р°.` }),
        en: localeInput("en"),
      })
    ).toThrow("кодировку");

    expect(() =>
      buildWriterBiographySaveModel({
        sourceTranslations: {},
        overrideTranslations: {},
        ru: localeInput("ru", {
          method: "human-translation",
          translatedFromLocale: "en",
          sourceTextRights: "project-original",
        }),
        en: localeInput("en", {
          method: "human-translation",
          translatedFromLocale: "ru",
          sourceTextRights: "public-domain",
        }),
      })
    ).toThrow("редакционного EN-оригинала");
  });
});
