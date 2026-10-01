import { describe, expect, it } from "vitest";

import { countries, type Writer } from "../countries";
import {
  findNobelArticle,
  getNobelYear,
  isNobelLaureate,
  nobelYearArticles,
} from "./nobelArticles";

const sienkiewicz: Writer = {
  id: "henryk_sienkiewicz",
  name: "Генрик Сенкевич",
  bio: "Польский писатель, лауреат Нобелевской премии по литературе 1905 года.",
  awards: ["Нобелевская премия по литературе"],
};

describe("Nobel article links", () => {
  it("extracts the prize year from an editorial biography", () => {
    expect(getNobelYear(sienkiewicz)).toBe(1905);
    expect(isNobelLaureate(sienkiewicz)).toBe(true);
  });

  it("connects the 1905 laureate to the existing annual article", () => {
    const article = findNobelArticle(sienkiewicz);

    expect(article?.title).toMatch(/1905/u);
    expect(article?.sectionId).toBe("awards");
    expect(article?.url).toMatch(/^https:\/\/probpera\.ru\/stati\//u);
  });

  it("keeps the annual archive chronological and without empty years", () => {
    const years = nobelYearArticles.map((entry) => entry.year);
    const establishedSeries = Array.from({ length: 23 }, (_, index) => 1901 + index)
      .filter((year) => year !== 1914 && year !== 1918);
    expect(years.filter((year) => year <= 1923)).toEqual(establishedSeries);
    expect(years).toEqual([...years].sort((first, second) => first - second));
    expect(new Set(years).size).toBe(years.length);
    expect(years.some((year) => [1914, 1918, 1935, 1940, 1941, 1942, 1943].includes(year))).toBe(false);
  });

  it("connects every laureate represented by the 1901-1923 series", () => {
    const earlyLaureates = countries
      .flatMap((country) => country.writers)
      .filter(
        (writer) =>
          writer.nobelYear !== undefined &&
          writer.nobelYear >= 1901 &&
          writer.nobelYear <= 1923
      );

    expect(earlyLaureates).toHaveLength(23);
    expect(
      earlyLaureates.filter((writer) => !findNobelArticle(writer))
    ).toEqual([]);
  });
});
