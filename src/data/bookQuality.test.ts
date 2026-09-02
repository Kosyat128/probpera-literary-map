import { describe, expect, it } from "vitest";

import type { WorkProfile } from "./countries/types";
import {
  bookAuthorshipIssues,
  bookPublicationIssues,
  countEditorialSentences,
  editorialProseQualityIssues,
  isPublicBook,
  translationQualityIssues,
} from "./bookQuality";

const sourceUrl = "https://example.org/books/a-tale-of-two-cities";
const validBook: WorkProfile = {
  id: "a-tale-of-two-cities",
  title: "Повесть о двух городах",
  description:
    "На фоне Французской революции судьбы героев связывают Лондон и Париж в историю любви, насилия и политической мести. Диккенс противопоставляет массовую жестокость личной верности и самопожертвованию.",
  editorial: { status: "verified", reviewedAt: "2026-08-08" },
  translations: {
    ru: {
      locale: "ru",
      title: "Повесть о двух городах",
      description:
        "На фоне Французской революции судьбы героев связывают Лондон и Париж в историю любви, насилия и политической мести. Диккенс противопоставляет массовую жестокость личной верности и показывает цену самопожертвования.",
      sourceLanguage: "ru",
      status: "verified",
      sourceUrls: [sourceUrl],
      method: "editorial-original",
      reviewedAt: "2026-08-08",
    },
    en: {
      locale: "en",
      title: "A Tale of Two Cities",
      description:
        "Against the French Revolution, the characters' lives bind London and Paris in a story of love, violence and political revenge. Dickens sets collective brutality against personal loyalty and asks what one person may sacrifice to save another.",
      sourceLanguage: "en",
      status: "verified",
      sourceUrls: [sourceUrl],
      method: "editorial-original",
      reviewedAt: "2026-08-08",
    },
  },
  sources: [
    {
      provider: "Example Library",
      url: sourceUrl,
      fields: ["identity", "title", "description"],
      usage: "reference-only",
      retrievedAt: "2026-08-08",
    },
  ],
};

describe("контроль публичного книжного текста", () => {
  it("принимает только проверенную двухъязычную карточку с provenance", () => {
    expect(bookPublicationIssues(validBook)).toEqual([]);
    expect(isPublicBook(validBook)).toBe(true);
    expect(countEditorialSentences(validBook.translations!.ru!.description)).toBe(2);
    expect(countEditorialSentences(validBook.translations!.en!.description)).toBe(2);
  });

  it("принимает проверенный машинный EN с теми же структурированными источниками", () => {
    const machineTranslated: WorkProfile = {
      ...validBook,
      translations: {
        ...validBook.translations,
        en: {
          ...validBook.translations!.en!,
          sourceLanguage: "Russian",
          status: "reviewed",
          method: "machine-translation",
          reviewedAt: "2026-08-23",
        },
      },
    };

    expect(translationQualityIssues(machineTranslated.translations!.en, "en")).toEqual([]);
    expect(bookPublicationIssues(machineTranslated)).toEqual([]);
    expect(isPublicBook(machineTranslated)).toBe(true);
  });

  it("не выпускает reviewed-карточку без английского текста", () => {
    const incomplete: WorkProfile = {
      ...validBook,
      translations: { ru: validBook.translations!.ru },
    };

    expect(bookPublicationIssues(incomplete)).toContain("нет перевода en");
    expect(isPublicBook(incomplete)).toBe(false);
  });

  it("не принимает русский текст, замаскированный как английская локаль", () => {
    const mixed = {
      ...validBook.translations!.en!,
      title: "A Tale of Two Cities - Повесть о двух городах",
      description:
        "This annotation starts in English but затем подставляет русский текст вместо завершённого перевода. A visitor using the English interface must never receive such a mixed-language book card.",
    };

    expect(translationQualityIssues(mixed, "en")).toContain(
      "английская карточка содержит кириллицу"
    );
  });

  it("отклоняет одно предложение и неподтверждённый перевод", () => {
    const translation = {
      ...validBook.translations!.en!,
      description:
        "This single sentence is deliberately long enough to pass the character threshold but must still fail the editorial sentence rule because a public annotation needs a concise second sentence.",
      status: "draft" as const,
      reviewedAt: undefined,
    };

    expect(translationQualityIssues(translation, "en")).toEqual(
      expect.arrayContaining([
        "описание en должно содержать 2-3 предложения",
        "перевод en не прошёл редакционную проверку",
        "нет даты проверки перевода en",
      ])
    );
  });

  it("не публикует текст без законного метода и структурированного источника", () => {
    const unsafe: WorkProfile = {
      ...validBook,
      translations: {
        ...validBook.translations,
        en: {
          ...validBook.translations!.en!,
          method: "copied-web-text" as "editorial-original",
          sourceUrls: ["https://example.org/untracked-source"],
        },
      },
    };

    expect(bookPublicationIssues(unsafe)).toEqual(
      expect.arrayContaining([
        "не указан допустимый метод создания текста en",
        "источники текста en не описаны в структурированном виде",
      ])
    );
    expect(isPublicBook(unsafe)).toBe(false);
  });

  it("отклоняет объективные типографические дефекты энциклопедического текста", () => {
    expect(
      editorialProseQualityIssues(
        " Текст  содержит <em>разметку</em> , URL https://example.org и дефис - вместо тире!! ",
        "ru"
      )
    ).toEqual(
      expect.arrayContaining([
        "описание ru содержит краевые пробелы",
        "описание ru содержит лишние пробелы или переносы",
        "описание ru содержит пробел перед знаком препинания",
        "описание ru содержит HTML",
        "описание ru содержит URL внутри текста",
        "описание ru содержит экспрессивную пунктуацию",
      ])
    );
    expect(
      editorialProseQualityIssues("Описание с «незакрытой цитатой.", "ru")
    ).toContain("описание ru содержит незакрытые кавычки");
  });

  it("не падает на повреждённом JSONB и закрывает публикацию", () => {
    const malformed = {
      ...validBook,
      translations: {
        ...validBook.translations,
        ru: {
          ...validBook.translations!.ru!,
          title: null,
          description: null,
          sourceUrls: [null],
        },
      },
      sources: [null],
    } as unknown as WorkProfile;

    expect(() => bookPublicationIssues(malformed)).not.toThrow();
    expect(bookPublicationIssues(malformed).length).toBeGreaterThan(0);
    expect(isPublicBook(malformed)).toBe(false);
  });

  it("не позволяет молча потерять соавтора из двуязычной подписи", () => {
    const coauthored: WorkProfile = {
      ...validBook,
      authorship: {
        kind: "multiple",
        authors: [
          {
            countryId: "russia",
            writerId: "ilya-ilf",
            creditNames: { ru: "Илья Ильф", en: "Ilya Ilf" },
          },
          {
            countryId: "russia",
            writerId: "yevgeny-petrov",
            creditNames: { ru: "Евгений Петров" },
          },
        ],
      },
    };

    expect(bookAuthorshipIssues(coauthored)).toContain(
      "автор 2: нет проверенной английской подписи"
    );
    expect(isPublicBook(coauthored)).toBe(false);
  });

  it("принимает явное анонимное и традиционное авторство без псевдоавтора", () => {
    for (const kind of ["anonymous", "traditional"] as const) {
      const work: WorkProfile = {
        ...validBook,
        authorship: { kind, authors: [] },
      };
      expect(bookAuthorshipIssues(work)).toEqual([]);
    }
  });
});
