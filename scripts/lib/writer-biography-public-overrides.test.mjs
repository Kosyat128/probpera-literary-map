import { describe, expect, it } from "vitest";

import { applyCmsWriterProfileOverrides } from "../../src/data/cms/editorialOverrides.ts";
import { applyPublishedWriterBiographyOverrides } from "./writer-biography-public-overrides.mjs";

const normalize = (value) => {
  const row = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    ["ru", "en"].flatMap((locale) =>
      row[locale]?.status === "reviewed" ? [[locale, row[locale]]] : []
    )
  );
};

describe("published writer biography override merge", () => {
  it("replaces the complete locale map for an explicit durable override", () => {
    const result = applyPublishedWriterBiographyOverrides({
      snapshotOverrides: {
        "russia:writer": {
          name: "Писатель",
          biographyTranslations: {
            ru: { status: "reviewed", text: "old ru" },
            en: { status: "reviewed", text: "stale en" },
          },
        },
      },
      rows: [
        {
          country_id: "russia",
          writer_id: "writer",
          fields: {
            biographyTranslations: {
              ru: { status: "reviewed", text: "new ru" },
              en: null,
            },
          },
        },
      ],
      normalizeBiographyTranslations: normalize,
    });

    expect(result["russia:writer"]).toEqual({
      name: "Писатель",
      biographyTranslations: {
        ru: { status: "reviewed", text: "new ru" },
      },
    });
  });

  it("clears stale public biographies when the durable map normalizes empty", () => {
    const result = applyPublishedWriterBiographyOverrides({
      snapshotOverrides: {
        "russia:writer": {
          biographyTranslations: {
            ru: { status: "reviewed" },
            en: { status: "reviewed" },
          },
        },
      },
      rows: [
        {
          country_id: "russia",
          writer_id: "writer",
          fields: {
            biographyTranslations: {
              ru: { status: "draft" },
              en: null,
            },
          },
        },
      ],
      normalizeBiographyTranslations: normalize,
    });

    expect(result).toEqual({
      "russia:writer": { biographyTranslations: {} },
    });

    const merged = applyCmsWriterProfileOverrides(
      [
        {
          id: "russia",
          writers: [
            {
              id: "writer",
              biographyTranslations: {
                ru: { status: "verified", text: "static ru" },
                en: { status: "reviewed", text: "static en" },
              },
            },
          ],
        },
      ],
      result
    );
    expect(merged[0].writers[0].biographyTranslations).toEqual({});
  });

  it("preserves a snapshot when the row does not own biographyTranslations", () => {
    const snapshot = {
      "russia:writer": {
        biographyTranslations: { ru: { status: "reviewed" } },
      },
    };
    expect(
      applyPublishedWriterBiographyOverrides({
        snapshotOverrides: snapshot,
        rows: [
          {
            country_id: "russia",
            writer_id: "writer",
            fields: { name: "Новое имя" },
          },
        ],
        normalizeBiographyTranslations: normalize,
      })
    ).toEqual(snapshot);
  });
});
