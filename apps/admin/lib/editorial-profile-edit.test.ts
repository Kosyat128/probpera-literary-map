import { describe, expect, it } from "vitest";

import { parseEditorialProfileOverride } from "./editorial-profile-edit";

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

  it("rejects unsafe identifiers, coordinates and image protocols", () => {
    expect(() =>
      parseEditorialProfileOverride({
        entityType: "country",
        countryId: "../russia",
        enabledFields: [],
        values: {},
      })
    ).toThrow("идентификатор");
    expect(() =>
      parseEditorialProfileOverride({
        entityType: "writer",
        countryId: "russia",
        writerId: "tolstoy",
        enabledFields: ["portrait"],
        values: { portrait: "javascript:alert(1)" },
      })
    ).toThrow("HTTPS");
  });
});
