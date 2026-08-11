import { describe, expect, it } from "vitest";

import { resolveCountrySiteCopy, resolveSiteCopy } from "./siteCopy";

describe("site copy runtime", () => {
  it("uses a published override before the code fallback", () => {
    const snapshot = {
      ru: { "interface.Поиск": "Найти на сайте" },
      en: { "interface.Поиск": "Search the archive" },
    };

    expect(resolveSiteCopy(snapshot, "interface.Поиск", "Поиск", "ru")).toBe(
      "Найти на сайте"
    );
    expect(resolveSiteCopy(snapshot, "interface.Поиск", "Search", "en")).toBe(
      "Search the archive"
    );
  });

  it("keeps locale fallbacks isolated and ignores empty overrides", () => {
    const snapshot = {
      ru: { "interface.Поиск": "Поиск по архиву" },
      en: { "interface.Поиск": "   " },
    };

    expect(resolveSiteCopy(snapshot, "interface.Поиск", "Search", "en")).toBe(
      "Search"
    );
    expect(resolveSiteCopy(snapshot, "missing", "Исходный текст", "ru")).toBe(
      "Исходный текст"
    );
  });

  it("applies contextual country-name overrides in Russian and English", () => {
    const snapshot = {
      ru: { "country.ID": "Республика Индонезия" },
      en: { "country.ID": "Indonesian Republic" },
    };

    expect(
      resolveCountrySiteCopy(
        snapshot,
        "id",
        "Индонезия",
        "Indonesia",
        "ru"
      )
    ).toBe("Республика Индонезия");
    expect(
      resolveCountrySiteCopy(
        snapshot,
        "id",
        "Индонезия",
        "Indonesia",
        "en"
      )
    ).toBe("Indonesian Republic");
  });
});
