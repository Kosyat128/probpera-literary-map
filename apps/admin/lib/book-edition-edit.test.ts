import { describe, expect, it } from "vitest";

import { parseBookEditionEdit } from "./book-edition-edit";

const base = {
  editionId: "64cf4383-b79f-477a-9754-b4f983a00324",
  expectedUpdatedAt: "2026-08-13T06:16:24.665Z",
  workId: "94f3858d-7da1-4e64-8429-f34958fbf4dc",
  title: "Война и мир",
  isbn10: "0306406152",
  isbn13: "",
  publisher: "Издательство",
  publicationYear: "2005",
  language: "русский",
  format: "твёрдый переплёт",
  pageCount: "1200",
  coverUrl: "",
  coverSourceUrl: "",
  coverRightsStatus: "unverified",
  licenseName: "",
  licenseUrl: "",
  creator: "",
  rightsHolder: "",
  rightsCheckedAt: "",
  sourceUrl: "https://example.org/catalogue/edition",
  primary: "on",
};

describe("existing book-edition edit policy", () => {
  it("normalizes a complete allowlisted edition patch", () => {
    const parsed = parseBookEditionEdit({ ...base, pageCount: "1200" });
    expect(parsed).toMatchObject({
      editionId: base.editionId,
      expectedUpdatedAt: base.expectedUpdatedAt,
      workId: base.workId,
      patch: {
        title: "Война и мир",
        isbn_10: "0306406152",
        publication_year: 2005,
        page_count: 1200,
        is_primary: true,
      },
    });
    expect(parsed.patch).not.toHaveProperty("legacy_id");
    expect(parsed.patch).not.toHaveProperty("metadata");
  });

  it("requires an exact ISO timestamp for optimistic locking", () => {
    expect(() =>
      parseBookEditionEdit({ ...base, expectedUpdatedAt: "2026-08-13 06:16:24" })
    ).toThrow(/ISO-дата/u);
    expect(() =>
      parseBookEditionEdit({ ...base, expectedUpdatedAt: "not-a-date" })
    ).toThrow(/ISO-дата/u);
    expect(() =>
      parseBookEditionEdit({ ...base, expectedUpdatedAt: "2026-02-30T06:16:24Z" })
    ).toThrow(/не существует/u);
  });

  it("checks ISBN control digits and field lengths", () => {
    expect(() =>
      parseBookEditionEdit({ ...base, isbn10: "0306406153" })
    ).toThrow("контрольную");
    expect(() =>
      parseBookEditionEdit({ ...base, isbn10: "", isbn13: "" })
    ).toThrow("хотя бы один");
    expect(() =>
      parseBookEditionEdit({ ...base, title: "x".repeat(301) })
    ).toThrow("300");
  });

  it("requires complete provenance before publishing a cover", () => {
    expect(() =>
      parseBookEditionEdit({
        ...base,
        coverUrl: "https://example.org/cover.jpg",
      })
    ).toThrow("обязательны");
    expect(
      parseBookEditionEdit({
        ...base,
        coverUrl: "https://example.org/cover.jpg",
        coverSourceUrl: "https://example.org/edition",
        coverRightsStatus: "licensed",
        rightsCheckedAt: "2026-08-13",
      }).patch.cover_url
    ).toBe("https://example.org/cover.jpg");
  });

  it("rejects unsafe URL protocols, impossible dates and unknown rights", () => {
    expect(() =>
      parseBookEditionEdit({ ...base, sourceUrl: "javascript:alert(1)" })
    ).toThrow("HTTPS");
    expect(() =>
      parseBookEditionEdit({ ...base, rightsCheckedAt: "2026-02-30" })
    ).toThrow("не существует");
    expect(() =>
      parseBookEditionEdit({ ...base, coverRightsStatus: "copyleft-ish" })
    ).toThrow("Неизвестный");
  });
});
