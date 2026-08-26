import { describe, expect, it } from "vitest";

import {
  literaryWorkPatch,
  mergeWriterOverrideFields,
  parseBookEntityId,
  parseVisualEntityEdit,
  parseWriterEntityId,
} from "./visual-entity-edit";

describe("visual entity editing policy", () => {
  it("accepts only stable writer and literary-work identities", () => {
    expect(parseWriterEntityId("russia:tolstoy")).toEqual({
      entityId: "russia:tolstoy",
      countryId: "russia",
      writerId: "tolstoy",
    });
    expect(parseBookEntityId("russia:tolstoy:war-and-peace")).toEqual({
      entityId: "russia:tolstoy:war-and-peace",
      countryId: "russia",
      writerId: "tolstoy",
      localWorkId: "war-and-peace",
    });
    expect(() => parseWriterEntityId("tolstoy")).toThrow();
    expect(() => parseBookEntityId("russia:tolstoy")).toThrow();
    expect(() => parseBookEntityId("russia:tolstoy:../../unsafe")).toThrow();
  });

  it("rejects arbitrary fields before a database column can be selected", () => {
    expect(() =>
      parseVisualEntityEdit({
        entityType: "book",
        entityId: "russia:tolstoy:war-and-peace",
        field: "updated_by",
        value: "attacker",
      })
    ).toThrow("нельзя менять");
    expect(() => literaryWorkPatch("metadata", {})).toThrow("нельзя менять");
  });

  it("rejects writer fields whose public value comes from reviewed sources", () => {
    for (const field of ["bio", "works"]) {
      expect(() =>
        parseVisualEntityEdit({
          entityType: "writer",
          entityId: "russia:tolstoy",
          field,
          value: field === "works" ? "Война и мир" : "Новая биография",
        })
      ).toThrow("Это поле нельзя менять из визуального редактора.");
    }

    expect(
      parseVisualEntityEdit({
        entityType: "writer",
        entityId: "russia:tolstoy",
        field: "years",
        value: "1828-1910",
      })
    ).toMatchObject({ field: "years", value: "1828-1910" });
  });

  it("maps each allowed literary field to its fixed database column", () => {
    expect(literaryWorkPatch("title", "Война и мир")).toEqual({
      title: "Война и мир",
    });
    expect(literaryWorkPatch("firstPublished", 1869)).toEqual({
      first_published: 1869,
    });
    expect(literaryWorkPatch("originalLanguage", "русский")).toEqual({
      original_language: "русский",
    });
    expect(literaryWorkPatch("sourceUrl", "https://example.com/work")).toEqual({
      source_url: "https://example.com/work",
    });
  });

  it("normalizes list fields as ordered, unique lines", () => {
    const edit = parseVisualEntityEdit({
      entityType: "writer",
      entityId: "russia:tolstoy",
      field: "awards",
      value: "Премия первая\nПремия вторая\nПремия первая\n",
    });
    expect(edit.value).toEqual(["Премия первая", "Премия вторая"]);
  });

  it("validates years, required titles and portrait protocols", () => {
    expect(
      parseVisualEntityEdit({
        entityType: "book",
        entityId: "russia:tolstoy:war-and-peace",
        field: "firstPublished",
        value: "1869",
      }).value
    ).toBe(1869);
    expect(() =>
      parseVisualEntityEdit({
        entityType: "book",
        entityId: "russia:tolstoy:war-and-peace",
        field: "title",
        value: "   ",
      })
    ).toThrow("пустым");
    expect(() =>
      parseVisualEntityEdit({
        entityType: "writer",
        entityId: "russia:tolstoy",
        field: "portrait",
        value: "javascript:alert(1)",
      })
    ).toThrow("HTTPS");
  });

  it("removes empty writer overrides instead of masking source data", () => {
    expect(
      parseVisualEntityEdit({
        entityType: "writer",
        entityId: "russia:tolstoy",
        field: "name",
        value: "   ",
      }).value
    ).toBe("");
    expect(
      mergeWriterOverrideFields(
        {
          name: "Лев Толстой",
          years: "",
          awards: [],
          portraitAlt: "Портрет писателя",
        },
        "portraitAlt",
        "   "
      )
    ).toEqual({ name: "Лев Толстой" });
    expect(
      mergeWriterOverrideFields({ years: "1828-1910" }, "years", "1828-1910")
    ).toEqual({ years: "1828-1910" });
  });
});
