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
    expect(findNobelArticle(sienkiewicz)?.id).toBe(
      "page--article--nobel--prize--6"
    );
  });

  it("keeps the annual archive chronological and without empty years", () => {
    expect(nobelYearArticles[0]?.year).toBe(1901);
    expect(nobelYearArticles).toHaveLength(21);
    expect(nobelYearArticles.some((entry) => entry.year === 1914)).toBe(false);
  });

  it("connects every laureate represented by the 1901–1923 series", () => {
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
