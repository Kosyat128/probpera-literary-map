import { describe, expect, it } from "vitest";

import {
  literarySearchScore,
  normalizeLiterarySearch,
} from "./literarySearch";

describe("поиск по названиям книг", () => {
  it("не зависит от кавычек, регистра и буквы ё", () => {
    expect(normalizeLiterarySearch("  «Вишнёвый САД»  ")).toBe(
      "вишневый сад"
    );
  });

  it("ставит точное название выше частичного совпадения", () => {
    expect(literarySearchScore("Морской волк", "морской волк")).toBe(0);
    expect(literarySearchScore("Морской волк: статьи", "морской волк")).toBe(1);
    expect(literarySearchScore("Читаем роман «Морской волк»", "морской волк")).toBe(2);
  });

  it("принимает название без имени автора", () => {
    const title = normalizeLiterarySearch("Моби Дик");
    const indexed = normalizeLiterarySearch("Моби Дик Herman Melville США");
    expect(indexed.includes(title)).toBe(true);
  });
});
