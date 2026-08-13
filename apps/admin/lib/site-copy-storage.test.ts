import { describe, expect, it } from "vitest";

import { resolveSiteCopy } from "../../../src/data/cms/siteCopy";
import {
  allSiteCopyCatalog,
  siteCopyCatalog,
} from "./site-copy-catalog";
import {
  mergeInlineRussianSiteCopy,
  mergeSiteCopyRows,
  readSiteCopyValues,
} from "./site-copy-storage";

describe("site-copy admin storage", () => {
  it("has one editable row per source string and a complete searchable catalog", () => {
    const keys = allSiteCopyCatalog.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThanOrEqual(790);
    const countryKeys = allSiteCopyCatalog
      .filter((item) => item.group === "Названия стран")
      .map((item) => item.key);
    expect(countryKeys).toHaveLength(200);
    expect(new Set(countryKeys).size).toBe(200);
    expect(countryKeys.every((key) => /^country\.[A-Z]{2}$/u.test(key))).toBe(
      true
    );
    for (const definition of siteCopyCatalog) {
      expect(keys).toContain(definition.key);
      expect(definition.key).toBe(`interface.${definition.defaultRu}`);
    }
    expect(
      siteCopyCatalog.find(
        (definition) => definition.key === "interface.Литературная планета"
      )
    ).toMatchObject({
      label: "Пункт «Литературная планета»",
      defaultRu: "Литературная планета",
      defaultEn: "Literary Planet",
    });
  });

  it("persists a curated edit to the universal runtime key", () => {
    const next = mergeSiteCopyRows(
      {
        ru: { unrelated: "Сохранить меня" },
        en: {
          unrelated: "Keep me",
          "interface.Поиск": "Old search",
        },
      },
      [{ key: "interface.Поиск", ru: "Найти на сайте", en: "" }]
    );

    expect(next.ru.unrelated).toBe("Сохранить меня");
    expect(next.en.unrelated).toBe("Keep me");
    expect(next.en["interface.Поиск"]).toBeUndefined();
    expect(
      resolveSiteCopy(next, "interface.Поиск", "Поиск", "ru")
    ).toBe("Найти на сайте");
    expect(resolveSiteCopy(next, "interface.Поиск", "Search", "en")).toBe(
      "Search"
    );
  });

  it("reads only non-empty database values", () => {
    expect(
      readSiteCopyValues({
        ru: { good: "  Текст  ", empty: " " },
        en: null,
      })
    ).toEqual({ ru: { good: "Текст" }, en: {} });
  });

  it("preserves the English translation during an inline Russian edit", () => {
    const next = mergeInlineRussianSiteCopy(
      {
        ru: { "interface.key": "Старый текст" },
        en: { "interface.key": "Keep this translation" },
      },
      "interface.key",
      "Новый текст"
    );

    expect(next.ru["interface.key"]).toBe("Новый текст");
    expect(next.en["interface.key"]).toBe("Keep this translation");
  });
});
