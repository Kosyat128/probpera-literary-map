import { describe, expect, it } from "vitest";

import { matches } from "./GlobalSearch";

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
});
