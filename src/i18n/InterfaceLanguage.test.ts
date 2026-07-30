import { describe, expect, it } from "vitest";

import { translateInterfaceText } from "./InterfaceLanguage";

describe("interface language", () => {
  it("translates the main navigation into English", () => {
    expect(translateInterfaceText("Карта", "en")).toBe("Map");
    expect(translateInterfaceText("Статьи", "en")).toBe("Articles");
    expect(translateInterfaceText("Книжный архив", "en")).toBe(
      "Book archive"
    );
  });

  it("preserves editorial text without an approved translation", () => {
    const original = "Авторский текст статьи";
    expect(translateInterfaceText(original, "en")).toBe(original);
    expect(translateInterfaceText(original, "ru")).toBe(original);
  });
});
