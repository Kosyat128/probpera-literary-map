import { describe, expect, it } from "vitest";

import { articleSeriesLabel } from "./articleSeries";

describe("локализация серий журнала", () => {
  it("возвращает редакционные названия на выбранном языке", () => {
    expect(articleSeriesLabel("nobel-prize", "", "ru")).toBe(
      "Лауреаты Нобелевской премии"
    );
    expect(articleSeriesLabel("nobel-prize", "", "en")).toBe(
      "Nobel Prize laureates"
    );
    expect(articleSeriesLabel("page-bookvsmovie", "", "en")).toBe(
      "Book and screen adaptation"
    );
    expect(articleSeriesLabel("page-writers-world", "", "ru")).toBe(
      "Литературная планета"
    );
    expect(articleSeriesLabel("page-writers-world", "", "en")).toBe(
      "Literary Planet"
    );
  });

  it("сохраняет уже локализованный fallback для неизвестной серии", () => {
    expect(articleSeriesLabel("custom", "Editorial features", "en")).toBe(
      "Editorial features"
    );
  });
});
