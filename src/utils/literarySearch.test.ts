import { describe, expect, it } from "vitest";

import {
  compileLiterarySearchQuery,
  compileLiterarySearchFields,
  compiledLiterarySearchMatches,
  compiledLiterarySearchMatchScore,
  literarySearchMatches,
  literarySearchMatchScore,
  literarySearchScore,
  normalizeLiterarySearch,
  type LiterarySearchValue,
} from "./literarySearch";

type SearchCase = readonly [
  query: string,
  primary: readonly LiterarySearchValue[],
  secondary: readonly LiterarySearchValue[],
  score: number | null,
];

function expectSearchCases(cases: readonly SearchCase[]) {
  for (const [text, primaryValues, secondaryValues, expected] of cases) {
    const query = compileLiterarySearchQuery(text);
    const primary = compileLiterarySearchFields(primaryValues);
    const secondary = compileLiterarySearchFields(secondaryValues);
    expect(compiledLiterarySearchMatchScore(query, primary, secondary), text).toBe(expected);
    expect(compiledLiterarySearchMatches(query, primary, secondary), text).toBe(expected !== null);
    expect(literarySearchMatchScore(text, primaryValues, secondaryValues), text).toBe(expected);
    expect(literarySearchMatches(text, [...primaryValues, ...secondaryValues]), text).toBe(expected !== null);
  }
}

describe("compiled literary search semantics", () => {
  it("preserves all six ranking levels and nonmatches across primary and secondary fields", () => {
    expectSearchCases([
      ["морской волк", ["Морской волк"], [], 0],
      ["морской волк", ["Морской волк: статьи"], [], 1],
      ["морской волк", ["Читаем роман «Морской волк»"], [], 2],
      ["Чехов", ["Русский писатель"], ["Чехов"], 3],
      ["Чехов", ["Русский писатель"], ["Антон Павлович Чехов"], 4],
      ["Толстой Россия", ["Лев Толстой"], ["Россия"], 5],
      ["Толстой Россия", ["Лев Толстой"], ["Япония"], null],
      // The existing phrase-prefix score wins once a secondary token matches.
      ["sun", ["sunlight"], ["sun"], 1],
    ]);
  });

  it("retains per-value stopwords, short-token limits and punctuation-only rejection", () => {
    expectSearchCases([
      ["IN", ["IN", "India"], [], 0],
      ["IN", ["IN India"], [], null],
      ["inside", ["IN"], [], null],
      ["sun", ["sunlight"], [], null],
      ["the", ["the lighthouse"], [], null],
      ["the in", ["the in"], [], null],
      ["lighthouse", ["The Lighthouse"], [], 0],
      ["  «Вишнёвый САД»  ", [null, "", "  ", "Вишневый сад", undefined], [], 0],
      ["—!?", ["Мир"], [], null],
      ["", ["Мир"], [], null],
      ["а", ["А"], [], null],
      ["Мир", [null, undefined, ""], [], null],
    ]);
  });

  it("preserves transliteration, stemming and the one-edit threshold for long tokens", () => {
    expectSearchCases([
      ["Dostoevsky", ["Фёдор Достоевский"], [], 2],
      ["Dostoevski", ["Фёдор Достоевский"], [], 2],
      ["Evgeny Onegin", ["Евгений Онегин"], [], 0],
      ["writing", ["writings"], [], 1],
      ["elephent", ["elephant"], [], 2],
      ["elephnt", ["elephant"], [], 2],
      ["planxt", ["planet"], [], null],
      ["elehpant", ["elephant"], [], null],
    ]);
  });

  it("reuses independent compiled fields and queries after caller arrays change", () => {
    const values = ["Иван Бунин"];
    const primary = compileLiterarySearchFields(values);
    const query = compileLiterarySearchQuery("  БУНИН!  ");
    const empty = compileLiterarySearchFields([null, undefined, ""] as const);
    values[0] = "Антон Чехов";
    expect(query.normalizedQuery).toBe("бунин");
    expect(compiledLiterarySearchMatches(query, primary)).toBe(true);
    expect(compiledLiterarySearchMatchScore(query, primary)).toBe(2);
    expect(compiledLiterarySearchMatches(query, empty, primary)).toBe(true);
    expect(compiledLiterarySearchMatchScore(query, empty, primary)).toBe(4);
    expect(compiledLiterarySearchMatches(query, compileLiterarySearchFields(values))).toBe(false);
    expect(compiledLiterarySearchMatches(compileLiterarySearchQuery("Чехов"), primary)).toBe(false);
    expect(compiledLiterarySearchMatchScore(query, primary)).toBe(2);
  });
});

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
