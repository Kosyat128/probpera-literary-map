import { describe, expect, it } from "vitest";

import { countries } from "../data/countries";
import { matches, writerSearchLabel } from "./GlobalSearch";
import { writerSearchNames } from "../utils/writerSearchLabel";

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

describe("canonical cross-language writer search fields", () => {
  const writer = countries.find(country => country.id === "russia")!.writers
    .find(value => value.id === "dostoevsky")!;

  it.each(["ru", "en"] as const)("finds existing names in %s without relabeling the writer", locale => {
    const label = writerSearchLabel(writer, locale);
    const fields = writerSearchNames(writer, locale);
    for (const query of ["Fyodor Dostoevsky", "Фёдор Михайлович Достоевский", "Mikhailovich"]) {
      expect(matches(query, [...fields])).toBe(true);
    }
    expect(matches("Fyodor DifferentPerson", [...fields])).toBe(false);
    expect(writerSearchLabel(writer, locale)).toBe(label);
    expect(fields[0]).toBe(label);
    expect(fields).not.toContain(writer.id);
  });

  it("keeps an unavailable current-locale writer ineligible and does not infer an English name", () => {
    const writer = { id: "synthetic-unreviewed-writer", name: "Условный автор" };
    expect(writerSearchNames(writer, "en")).toEqual([]);
    expect(writerSearchNames(writer, "ru")).toEqual(["Условный автор"]);
  });

  it("preserves an explicit bilingual credit without duplicate aliases or changes", () => {
    const writer = Object.freeze({ id: "", name: "Условная группа", fullName: "Synthetic Collective" });
    expect(writerSearchNames(writer, "ru")).toEqual(["Условная группа", "Synthetic Collective"]);
    expect(writerSearchNames(writer, "en")).toEqual(["Synthetic Collective", "Условная группа"]);
  });
});
