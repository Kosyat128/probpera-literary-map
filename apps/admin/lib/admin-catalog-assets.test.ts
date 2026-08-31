import { describe, expect, it } from "vitest";

import { archiveEditorialCatalogCountries } from "../../../scripts/archive-source";

import {
  readAdminCatalogText,
  type AdminCatalogNamespace,
} from "./admin-catalog-assets";
import {
  loadEditorialCatalog,
  parseEditorialCatalog,
} from "./editorial-catalog";
import {
  loadAllSiteCopyCatalog,
  parseInterfaceCopyCatalog,
} from "./site-copy-catalog";

function namespaceWith(value: string | null): AdminCatalogNamespace {
  return {
    async get() {
      return value;
    },
  };
}

describe("private admin catalog assets", () => {
  it("reads bounded catalog values through the KV binding boundary", async () => {
    await expect(
      readAdminCatalogText("editorial-catalog.json", {
        namespace: namespaceWith('{"version":1,"countries":[]}'),
      })
    ).resolves.toContain('"version":1');
    await expect(
      readAdminCatalogText("editorial-catalog.json", {
        namespace: namespaceWith(null),
      })
    ).rejects.toThrow("key is unavailable");
  });

  it("loads the complete checked-in editorial catalog without static imports", async () => {
    const catalog = await loadEditorialCatalog({ namespace: null });
    expect(catalog.countries).toHaveLength(200);
    expect(
      catalog.countries.reduce(
        (total, country) => total + country.writers.length,
        0
      )
    ).toBe(1_684);
  });

  it("exports every structured writer biography without catalog loss", async () => {
    const catalog = await loadEditorialCatalog({ namespace: null });
    const expected = new Map(
      archiveEditorialCatalogCountries.flatMap((country) =>
        country.writers.map((writer) => [
          `${country.id}:${writer.id}`,
          writer.biographyTranslations,
        ] as const)
      )
    );
    const actual = new Map(
      catalog.countries.flatMap((country) =>
        country.writers.map((writer) => [
          `${country.id}:${writer.id}`,
          writer.fields.biographyTranslations,
        ] as const)
      )
    );

    expect(expected.size).toBe(1_684);
    expect(actual.size).toBe(expected.size);
    for (const [key, translations] of expected) {
      expect(translations, `${key} must have structured biographies`).toBeTruthy();
      expect(translations?.ru, `${key} must have structured RU`).toBeTruthy();
      expect(actual.get(key), `${key} must be present in the closed catalog`).toEqual(
        translations
      );
    }
  });

  it("rejects a catalog that drops its required structured Russian biography", async () => {
    const source = JSON.parse(
      await readAdminCatalogText("editorial-catalog.json", { namespace: null })
    );
    const target = source.countries
      .flatMap((country: { writers?: unknown[] }) => country.writers ?? [])
      .find(
        (writer: unknown): writer is {
          fields: { biographyTranslations: { ru: unknown; en?: unknown } };
        } =>
          typeof writer === "object" &&
          writer !== null &&
          "fields" in writer &&
          typeof writer.fields === "object" &&
          writer.fields !== null &&
          "biographyTranslations" in writer.fields &&
          typeof writer.fields.biographyTranslations === "object" &&
          writer.fields.biographyTranslations !== null &&
          "ru" in writer.fields.biographyTranslations &&
          Boolean(writer.fields.biographyTranslations.ru)
      );
    expect(
      target,
      "checked-in catalog must contain a writer with structured RU before mutation"
    ).toBeDefined();
    if (!target) return;

    delete target.fields.biographyTranslations.ru;
    expect(() => parseEditorialCatalog(JSON.stringify(source))).toThrow(
      "missing structured RU"
    );
  });

  it("accepts RU-only biographies and preserves optional valid English", async () => {
    const source = JSON.parse(
      await readAdminCatalogText("editorial-catalog.json", { namespace: null })
    );
    const writers = source.countries.flatMap(
      (country: { writers?: unknown[] }) => country.writers ?? []
    ) as Array<{
      id: string;
      fields: { biographyTranslations?: { ru?: unknown; en?: unknown } };
    }>;
    const withEnglish = writers.find(
      (writer) => writer.fields.biographyTranslations?.en
    );
    const russianOnly = writers.find(
      (writer) =>
        writer.fields.biographyTranslations?.ru &&
        !writer.fields.biographyTranslations?.en
    );

    expect(withEnglish).toBeDefined();
    expect(russianOnly).toBeDefined();
    const parsed = parseEditorialCatalog(JSON.stringify(source));
    const parsedWriters = parsed.countries.flatMap((country) => country.writers);
    expect(
      parsedWriters.find((writer) => writer.id === withEnglish?.id)?.fields
        .biographyTranslations
    ).toEqual(withEnglish?.fields.biographyTranslations);
    expect(
      parsedWriters.find((writer) => writer.id === russianOnly?.id)?.fields
        .biographyTranslations
    ).toEqual(russianOnly?.fields.biographyTranslations);
  });

  it("rejects duplicate editorial country ids", () => {
    const country = {
      id: "same",
      label: "Same",
      fields: {},
      writers: [],
    };
    expect(() =>
      parseEditorialCatalog(
        JSON.stringify({
          version: 1,
          countries: Array.from({ length: 100 }, () => country),
        })
      )
    ).toThrow("duplicate country");
  });

  it("loads and validates the complete interface-copy catalog", async () => {
    const catalog = await loadAllSiteCopyCatalog({ namespace: null });
    expect(catalog.length).toBeGreaterThanOrEqual(790);
    expect(
      catalog.filter((definition) => definition.group === "Названия стран")
    ).toHaveLength(200);
  });

  it("rejects duplicate interface-copy keys", () => {
    const definition = {
      key: "interface.same",
      group: "Test",
      label: "Test",
      defaultRu: "Тест",
    };
    expect(() =>
      parseInterfaceCopyCatalog(
        JSON.stringify(Array.from({ length: 100 }, () => definition))
      )
    ).toThrow("duplicate key");
  });
});
