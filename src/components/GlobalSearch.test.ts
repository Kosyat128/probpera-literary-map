import { describe, expect, it } from "vitest";

import { countries } from "../data/countries";
import { matches, writerSearchLabel } from "./GlobalSearch";

describe("GlobalSearch word matching", () => {
  it("does not treat one-letter conjunctions as matches", () => {
    expect(
      matches("экранизация", ["Антигуа и Барбуда", "Литературная традиция"])
    ).toBe(false);
  });

  it("matches related Russian word forms", () => {
    expect(matches("экранизация", ["Лучшие экранизации классики"])).toBe(true);
    expect(matches("писатель", ["Биографии писателей мира"])).toBe(true);
  });

  it("requires every meaningful query token", () => {
    expect(matches("морской волк", ["Джек Лондон. Морской волк"])).toBe(true);
    expect(matches("морской волк", ["Морской берег"])).toBe(false);
  });

  it("matches a Russian writer by common Latin transliteration", () => {
    expect(matches("Dostoevsky", ["Фёдор Михайлович Достоевский"])).toBe(true);
  });

  it("does not reverse-match a short code against an unrelated word", () => {
    expect(matches("inside", ["IN"])).toBe(false);
    expect(matches("in", ["IN"])).toBe(true);
  });

  it("never exposes a fallback or Cyrillic writer label in English results", () => {
    const labels = countries
      .flatMap((country) => country.writers)
      .map((writer) => writerSearchLabel(writer, "en"))
      .filter((label): label is string => Boolean(label));

    expect(labels.length).toBeGreaterThan(0);
    expect(labels).not.toContain("Author");
    expect(labels.every((label) => !/\p{Script=Cyrillic}/u.test(label))).toBe(
      true
    );
    expect(
      writerSearchLabel(
        { id: "ru-only", name: "Автор без английского имени" },
        "en"
      )
    ).toBeNull();
  });
});
