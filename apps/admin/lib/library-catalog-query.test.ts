import { describe, expect, it } from "vitest";

import {
  LIBRARY_CATALOG_PAGE_SIZE,
  LIBRARY_WORK_PICKER_PAGE_SIZE,
  libraryCatalogFormHref,
  libraryCatalogHref,
  mergeLibraryWorkOptions,
  normalizeLibraryIdentifier,
  parseLibraryCatalogQuery,
} from "./library-catalog-query";

describe("library catalog query", () => {
  it("normalizes allowlisted filters and independent page ranges", () => {
    expect(
      parseLibraryCatalogQuery({
        q: "  Война   и мир ",
        country: "russia",
        writer: "leo-tolstoy",
        status: "verified",
        works_page: "3",
        editions_page: "2",
        work_picker_q: "  Мастер   и Маргарита ",
        work_picker_page: "4",
      })
    ).toMatchObject({
      term: "Война и мир",
      country: "russia",
      writer: "leo-tolstoy",
      status: "verified",
      worksFrom: LIBRARY_CATALOG_PAGE_SIZE * 2,
      worksTo: LIBRARY_CATALOG_PAGE_SIZE * 3 - 1,
      editionsFrom: LIBRARY_CATALOG_PAGE_SIZE,
      editionsTo: LIBRARY_CATALOG_PAGE_SIZE * 2 - 1,
      workPickerTerm: "Мастер и Маргарита",
      workPickerFrom: LIBRARY_WORK_PICKER_PAGE_SIZE * 3,
      workPickerTo: LIBRARY_WORK_PICKER_PAGE_SIZE * 4 - 1,
    });
  });

  it("rejects arbitrary identifiers/statuses and escapes LIKE wildcards", () => {
    expect(
      parseLibraryCatalogQuery({
        q: "100%_книга",
        work_picker_q: "50%_сборник",
        country: "russia,or(editorial_status.eq.draft)",
        writer: "writer id",
        status: "deleted",
      })
    ).toMatchObject({
      pattern: "%100\\%\\_книга%",
      workPickerPattern: "%50\\%\\_сборник%",
      country: "",
      writer: "",
      status: "",
    });
    expect(normalizeLibraryIdentifier("russia:tolstoy:war-and-peace")).toBe(
      "russia:tolstoy:war-and-peace"
    );
  });

  it("keeps the current work first and de-duplicates independent search results", () => {
    expect(
      mergeLibraryWorkOptions(
        { id: "current", title: "Текущее" },
        { id: "selected", title: "Выбранное" },
        [
          { id: "current", title: "Дубликат" },
          { id: "result", title: "Результат" },
        ]
      )
    ).toEqual([
      { id: "current", title: "Текущее" },
      { id: "selected", title: "Выбранное" },
      { id: "result", title: "Результат" },
    ]);
  });

  it("creates canonical links while preserving selection context", () => {
    const catalog = parseLibraryCatalogQuery({
      q: "Анна",
      country: "russia",
      works_page: 4,
      editions_page: 2,
      work_picker_q: "Анна Каренина",
      work_picker_page: 3,
    });
    const href = libraryCatalogHref(catalog, {
      worksPage: 1,
      editionId: "f769b7df-173b-4ca3-9d3c-fdbef93b82ea",
      isbn: "978-5-17-000000-0",
    });
    expect(href).toBe(
      "/library?q=%D0%90%D0%BD%D0%BD%D0%B0&country=russia&editions_page=2&work_picker_q=%D0%90%D0%BD%D0%BD%D0%B0+%D0%9A%D0%B0%D1%80%D0%B5%D0%BD%D0%B8%D0%BD%D0%B0&work_picker_page=3&isbn=9785170000000&edition_id=f769b7df-173b-4ca3-9d3c-fdbef93b82ea"
    );
  });

  it("reads only canonical hidden form fields for action redirects", () => {
    const values = new Map<string, unknown>([
      ["catalog_q", "Обложка"],
      ["catalog_status", "reviewed"],
      ["catalog_editions_page", "7"],
      ["catalog_work_picker_q", "Герой нашего времени"],
      ["catalog_work_picker_page", "2"],
      ["catalog_edition_id", "f769b7df-173b-4ca3-9d3c-fdbef93b82ea"],
    ]);
    const href = libraryCatalogFormHref(
      { get: (name) => values.get(name) },
      { notice: "edition-exists", saved: "edition" }
    );
    expect(href).toContain("q=%D0%9E%D0%B1%D0%BB%D0%BE%D0%B6%D0%BA%D0%B0");
    expect(href).toContain("status=reviewed");
    expect(href).toContain("editions_page=7");
    expect(href).toContain("work_picker_q=%D0%93%D0%B5%D1%80%D0%BE%D0%B9+%D0%BD%D0%B0%D1%88%D0%B5%D0%B3%D0%BE+%D0%B2%D1%80%D0%B5%D0%BC%D0%B5%D0%BD%D0%B8");
    expect(href).toContain("work_picker_page=2");
    expect(href).toContain("notice=edition-exists");
    expect(href).toContain("saved=edition");
  });
});
