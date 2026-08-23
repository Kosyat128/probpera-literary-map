import { describe, expect, it } from "vitest";

import type { Country } from "../countries/types";
import {
  applyCmsCountryProfileOverrides,
  applyCmsWriterProfileOverrides,
  cmsLiteraryWorkProfilesForWriter,
} from "./editorialOverrides";

const country = {
  id: "test-country",
  name: "Тест",
  writers: [
    {
      id: "writer",
      name: "Исходное имя",
      bio: "Исходная биография",
    },
  ],
} as Country;

const biographySource = {
  provider: "Редакция",
  url: "https://example.org/writer",
  fields: ["identity", "biography-facts"] as const,
  usage: "fact-check" as const,
  retrievedAt: "2026-08-23",
};

const bookSourceUrl = "https://example.org/book";

describe("CMS editorial overrides", () => {
  it("applies country fields and EN translation without allowing an override to replace writers", () => {
    const unsafeDatabaseValue = {
      "test-country": {
        name: "Новое название",
        capital: "Новая столица",
        translations: {
          en: {
            locale: "en",
            status: "reviewed",
            method: "machine-translation",
            sourceHash: "country-hash",
            fields: {
              name: "Test Country",
              capital: "New Capital",
            },
          },
        },
        writers: [],
      },
    } as unknown as Parameters<typeof applyCmsCountryProfileOverrides>[1];
    const updated = applyCmsCountryProfileOverrides(
      [country],
      unsafeDatabaseValue
    );

    expect(updated[0].name).toBe("Новое название");
    expect(updated[0].capital).toBe("Новая столица");
    expect(updated[0].translations?.en?.fields.name).toBe("Test Country");
    expect(updated[0].writers).toBe(country.writers);
  });

  it("applies a durable writer override after the static profile", () => {
    const [updated] = applyCmsWriterProfileOverrides([country], {
      "test-country:writer": {
        name: "Имя из CMS",
        bio: "Текст, сохранённый владельцем в визуальном редакторе.",
        biographyTranslations: {
          ru: {
            locale: "ru",
            text: "Проверенная редакционная биография писателя содержит два предложения. Второе предложение подтверждает полноту тестового материала.",
            sourceLanguage: "Russian",
            status: "verified",
            method: "editorial-original",
            reviewedAt: "2026-08-23",
            sources: [biographySource],
          },
          en: {
            locale: "en",
            text: "This reviewed English biography contains two complete factual sentences about the writer. Its provenance remains attached to the public profile.",
            sourceLanguage: "Russian",
            status: "reviewed",
            method: "machine-translation",
            reviewedAt: "2026-08-23",
            translatedFromLocale: "ru",
            sourceTextRights: "project-original",
            sources: [biographySource],
          },
        },
      },
    });

    expect(updated.writers[0]).toMatchObject({
      id: "writer",
      name: "Имя из CMS",
      bio: "Текст, сохранённый владельцем в визуальном редакторе.",
    });
    expect(
      updated.writers[0].biographyTranslations?.en?.method
    ).toBe("machine-translation");
    expect(country.writers[0].name).toBe("Исходное имя");
  });

  it("converts a published bilingual CMS work into the canonical archive shape", () => {
    const works = cmsLiteraryWorkProfilesForWriter(
      "test-country",
      "writer",
      {
        "test-country:writer:book": {
          legacyId: "test-country:writer:book",
          countryId: "test-country",
          writerId: "writer",
          localId: "book",
          title: "Название из CMS",
          description: "Описание из CMS",
          firstPublished: 2026,
          genres: ["роман"] as const,
          tags: ["проверено"] as const,
          translations: {
            ru: {
              locale: "ru",
              title: "Название из CMS",
              description:
                "Русское описание книги содержит необходимые сведения о сюжете и контексте произведения. Второе предложение завершает проверенную редакционную аннотацию.",
              sourceLanguage: "Russian",
              status: "verified",
              sourceUrls: [bookSourceUrl],
              method: "editorial-original",
              reviewedAt: "2026-08-23",
            },
            en: {
              locale: "en",
              title: "CMS Book Title",
              description:
                "The English description gives international readers the essential plot and literary context of the work. A second sentence completes the reviewed editorial annotation without adding unsupported claims.",
              sourceLanguage: "Russian",
              status: "reviewed",
              sourceUrls: [bookSourceUrl],
              method: "machine-translation",
              reviewedAt: "2026-08-23",
            },
          },
          sources: [
            {
              provider: "Example Library",
              url: bookSourceUrl,
              fields: ["identity", "title", "description"],
              usage: "reference-only",
              retrievedAt: "2026-08-23",
            },
          ],
          editorialStatus: "verified",
        },
      }
    );

    expect(works).toEqual([
      expect.objectContaining({
        id: "book",
        title: "Название из CMS",
        description: "Описание из CMS",
        firstPublished: 2026,
        genres: ["роман"],
        tags: ["проверено"],
        translations: expect.objectContaining({
          en: expect.objectContaining({
            title: "CMS Book Title",
            method: "machine-translation",
          }),
        }),
        sources: [
          expect.objectContaining({
            url: bookSourceUrl,
            usage: "reference-only",
          }),
        ],
        editorial: { status: "verified", reviewedAt: undefined },
      }),
    ]);
  });
});
