import { describe, expect, it } from "vitest";

import {
  literarySearchMatches,
  literarySearchMatchScore,
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

  it("находит русское имя по безопасной латинской транслитерации", () => {
    expect(literarySearchMatches("Dostoevsky", ["Фёдор Достоевский"])).toBe(true);
    expect(literarySearchScore("Фёдор Достоевский", "Dostoevsky")).toBeLessThan(6);
  });

  it("ищет все значимые слова независимо от их соседства", () => {
    expect(
      literarySearchMatches("Толстой Россия", [
        "Лев Николаевич Толстой",
        "романист",
        "Россия",
      ])
    ).toBe(true);
  });

  it("не считает короткий код префиксом длинного запроса", () => {
    expect(literarySearchMatches("inside", ["IN"])).toBe(false);
    expect(literarySearchMatches("in", ["IN"])).toBe(true);
  });

  it("поднимает точное имя выше совпадения в описании", () => {
    expect(literarySearchMatchScore("Чехов", ["Антон Чехов"], ["Чехов"])).toBe(2);
    expect(literarySearchMatchScore("Чехов", ["Чехов"], [])).toBe(0);
  });
});
