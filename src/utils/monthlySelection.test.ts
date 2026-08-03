import { describe, expect, it } from "vitest";

import {
  getLocalMonthKey,
  getMonthlySelectionIndex,
} from "./monthlySelection";

describe("автоматический выбор книги месяца", () => {
  it("сохраняет один ключ в течение календарного месяца", () => {
    expect(getLocalMonthKey(new Date(2026, 7, 1))).toBe(
      getLocalMonthKey(new Date(2026, 7, 31, 23, 59))
    );
  });

  it("переключает ключ в начале следующего месяца", () => {
    expect(getLocalMonthKey(new Date(2026, 8, 1))).toBe(
      getLocalMonthKey(new Date(2026, 7, 31)) + 1
    );
  });

  it("всегда выбирает существующую карточку", () => {
    expect(getMonthlySelectionIndex(17, 2026 * 12 + 7)).toBeGreaterThanOrEqual(0);
    expect(getMonthlySelectionIndex(17, 2026 * 12 + 7)).toBeLessThan(17);
    expect(getMonthlySelectionIndex(0, 2026 * 12 + 7)).toBe(-1);
  });
});
