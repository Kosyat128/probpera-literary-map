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

describe("CMS editorial overrides", () => {
  it("applies country fields without allowing an override to replace writers", () => {
    const unsafeDatabaseValue = {
      "test-country": {
        name: "Новое название",
        capital: "Новая столица",
        writers: [],
      },
    } as unknown as Parameters<typeof applyCmsCountryProfileOverrides>[1];
    const updated = applyCmsCountryProfileOverrides(
      [country],
      unsafeDatabaseValue
    );

    expect(updated[0].name).toBe("Новое название");
    expect(updated[0].capital).toBe("Новая столица");
    expect(updated[0].writers).toBe(country.writers);
  });

  it("applies a durable writer override after the static profile", () => {
    const [updated] = applyCmsWriterProfileOverrides([country], {
      "test-country:writer": {
        name: "Имя из CMS",
        bio: "Текст, сохранённый владельцем в визуальном редакторе.",
      },
    });

    expect(updated.writers[0]).toMatchObject({
      id: "writer",
      name: "Имя из CMS",
      bio: "Текст, сохранённый владельцем в визуальном редакторе.",
    });
    expect(country.writers[0].name).toBe("Исходное имя");
  });

  it("converts a published CMS work into the canonical archive shape", () => {
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
        editorial: { status: "verified", reviewedAt: undefined },
      }),
    ]);
  });
});
