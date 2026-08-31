import { describe, expect, it } from "vitest";

import {
  parseEditorialProfileOverride,
  protectedWriterPortraitFields,
  preserveProtectedEditorialField,
  preserveUneditedEditorialFields,
  resolveEditorialSourceFields,
  writerProfileFields,
} from "./editorial-profile-edit";

describe("full editorial profile editing", () => {
  it("keeps only allowlisted and explicitly enabled country fields", () => {
    expect(
      parseEditorialProfileOverride({
        entityType: "country",
        countryId: "russia",
        enabledFields: ["name", "facts", "coordinates", "writers"],
        values: {
          name: "Россия",
          facts: "Факт 1\nФакт 2\nФакт 1",
          coordinates: { lat: "61.5", lng: "105,3" },
          writers: [],
        },
      })
    ).toMatchObject({
      fields: {
        name: "Россия",
        facts: ["Факт 1", "Факт 2"],
        coordinates: { lat: 61.5, lng: 105.3 },
      },
    });
  });

  it("supports complete writer biography and works overrides", () => {
    const result = parseEditorialProfileOverride({
      entityType: "writer",
      countryId: "russia",
      writerId: "tolstoy",
      enabledFields: ["name", "bio", "works"],
      values: {
        name: "Лев Толстой",
        bio: "Проверенная редакционная биография.",
        works: "Война и мир\nАнна Каренина",
      },
    });
    expect(result.fields).toEqual({
      name: "Лев Толстой",
      bio: "Проверенная редакционная биография.",
      works: ["Война и мир", "Анна Каренина"],
    });
  });

  it("reverts an unchecked override to the catalog value for translation", () => {
    const submittedValues = {
      name: "Старое снятое переопределение",
      bio: "Активная редакционная биография.",
    };
    const edit = parseEditorialProfileOverride({
      entityType: "writer",
      countryId: "russia",
      writerId: "tolstoy",
      enabledFields: ["bio"],
      values: submittedValues,
    });

    expect(
      resolveEditorialSourceFields(
        { name: "Лев Толстой", bio: "Каталожная биография." },
        edit.fields
      )
    ).toEqual({
      name: "Лев Толстой",
      bio: "Активная редакционная биография.",
    });
  });

  it("preserves an explicit empty or null protected locale-map tombstone", () => {
    expect(
      preserveProtectedEditorialField(
        { name: "Лев Толстой" },
        { biographyTranslations: {} },
        "biographyTranslations"
      )
    ).toEqual({ name: "Лев Толстой", biographyTranslations: {} });
    expect(
      preserveProtectedEditorialField(
        { name: "Лев Толстой" },
        { biographyTranslations: null },
        "biographyTranslations"
      )
    ).toEqual({ name: "Лев Толстой", biographyTranslations: null });
  });

  it("does not erase hidden legacy biographies on an unrelated profile edit", () => {
    expect(
      preserveUneditedEditorialFields(
        { name: "Новое имя" },
        {
          name: "Старое имя",
          bio: "Существующий краткий текст.",
          biography: "Существующая полная биография.",
        },
        ["bio", "biography"]
      )
    ).toEqual({
      name: "Новое имя",
      bio: "Существующий краткий текст.",
      biography: "Существующая полная биография.",
    });
    expect(
      preserveUneditedEditorialFields(
        { biography: "Явно обновлённая биография." },
        { biography: "Старая биография." },
        ["bio", "biography"]
      )
    ).toEqual({ biography: "Явно обновлённая биография." });
  });

  it("rejects unsafe identifiers and coordinates", () => {
    expect(() =>
      parseEditorialProfileOverride({
        entityType: "country",
        countryId: "../russia",
        enabledFields: [],
        values: {},
      })
    ).toThrow("идентификатор");
  });

  it("keeps the complete portrait provenance bundle outside CMS overrides", () => {
    expect(writerProfileFields).not.toEqual(
      expect.arrayContaining([...protectedWriterPortraitFields])
    );
    for (const field of protectedWriterPortraitFields) {
      expect(() =>
        parseEditorialProfileOverride({
          entityType: "writer",
          countryId: "russia",
          writerId: "tolstoy",
          enabledFields: [field],
          values: {
            [field]:
              field === "portraitRights"
                ? { status: "licensed" }
                : "https://example.org/portrait.jpg",
          },
        })
      ).toThrow("только в проверенном каталоге");
    }
  });
});
