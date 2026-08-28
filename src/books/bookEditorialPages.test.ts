import { describe, expect, it } from "vitest";

import {
  BOOK_EDITORIAL_MAX_PAGES,
  BOOK_EDITORIAL_PAGE_DATA_VERSION,
  buildBookEditorialDocument,
  createBookEditorialPageCacheKey,
  type BookEditorialPageInput,
} from "./bookEditorialPages";

const input = (
  override: Partial<BookEditorialPageInput> = {}
): BookEditorialPageInput => ({
  bookKey: "ru:writer:work",
  locale: "ru",
  themeVersion: "archive-theme-v3",
  title: "Проверенное произведение",
  writer: "Проверенный автор",
  ...override,
});

describe("book editorial pages", () => {
  it("emits only supplied verified facts and never invents work prose", () => {
    const document = buildBookEditorialDocument(
      input({
        year: { value: 1904, verified: true },
        language: { value: "английский", verified: true },
        country: { value: "Великобритания", verified: true },
        description: {
          value: "Краткое проверенное редакционное описание.",
          verified: true,
        },
      })
    );

    expect(document.pages).toHaveLength(3);
    expect(document.pages.length).toBeLessThanOrEqual(BOOK_EDITORIAL_MAX_PAGES);
    expect(document.pages.map((page) => page.id)).toEqual([
      "identity",
      "details",
      "description",
    ]);
    expect(document.pages.flatMap((page) => page.paragraphs)).toEqual([
      "Краткое проверенное редакционное описание.",
    ]);
    expect(JSON.stringify(document)).not.toMatch(
      /lorem|отрывок|фрагмент произведения|sample text/iu
    );
  });

  it("fails closed for runtime-unverified optional fields", () => {
    const unsafe = {
      value: "Непроверенное значение",
      verified: false,
    } as unknown as BookEditorialPageInput["language"];
    const document = buildBookEditorialDocument(
      input({
        language: unsafe,
        description: unsafe,
        metadata: [
          {
            kind: "publisher",
            value: "Непроверенный издатель",
            verified: false,
          } as unknown as NonNullable<BookEditorialPageInput["metadata"]>[number],
        ],
      })
    );

    expect(document.pages).toHaveLength(1);
    expect(document.pages[0].rows.map((row) => row.kind)).toEqual(["writer"]);
  });

  it("uses fixed RU/EN labels and deterministic metadata/source ordering", () => {
    const metadata: NonNullable<BookEditorialPageInput["metadata"]> = [
      { kind: "pages", value: 320, verified: true as const },
      { kind: "publisher", value: "Archive Press", verified: true as const },
    ];
    const sources = [
      {
        provider: "Library B",
        sourceUrl: "https://library-b.example/work#record",
        verified: true as const,
        usage: "reference-only" as const,
      },
      {
        provider: "Archive A",
        sourceUrl: "https://archive-a.example/work",
        verified: true as const,
        usage: "structured-data" as const,
        license: "CC0",
      },
    ];
    const first = buildBookEditorialDocument(
      input({ locale: "en", metadata, sourceRights: sources })
    );
    const reordered = buildBookEditorialDocument(
      input({
        locale: "en",
        metadata: [...metadata].reverse(),
        sourceRights: [...sources].reverse(),
      })
    );

    expect(reordered).toEqual(first);
    expect(first.pages[0]).toMatchObject({ eyebrow: "Work" });
    expect(first.pages[1].rows.map((row) => row.label)).toEqual([
      "Publisher",
      "Pages",
    ]);
    expect(first.pages[2]).toMatchObject({
      title: "Sources and rights",
    });
    expect(first.pages[2].sources[0]).toMatchObject({
      provider: "Archive A",
      usageLabel: "structured data",
      license: "CC0",
    });
    expect(first.pages[2].sources[1].sourceUrl).toBe(
      "https://library-b.example/work"
    );
  });

  it("keys cache identity by book, locale, theme and page-data versions", () => {
    const base = {
      bookKey: "book/key",
      locale: "ru" as const,
      themeVersion: "theme-v1",
      pageDataVersion: BOOK_EDITORIAL_PAGE_DATA_VERSION,
    };
    const key = createBookEditorialPageCacheKey(base);

    expect(key).toBe(
      "book=book%2Fkey|locale=ru|theme=theme-v1|data=book-editorial-pages-v1"
    );
    expect(
      new Set([
        key,
        createBookEditorialPageCacheKey({ ...base, bookKey: "other" }),
        createBookEditorialPageCacheKey({ ...base, locale: "en" }),
        createBookEditorialPageCacheKey({ ...base, themeVersion: "theme-v2" }),
        createBookEditorialPageCacheKey({
          ...base,
          pageDataVersion: "book-editorial-pages-v2",
        }),
      ]).size
    ).toBe(5);
  });

  it("bounds long descriptions instead of creating unbounded pages", () => {
    const document = buildBookEditorialDocument(
      input({
        description: { value: "слово ".repeat(500), verified: true },
      })
    );
    const description = document.pages.find(
      (page) => page.id === "description"
    )?.paragraphs[0];

    expect(description?.length).toBeLessThanOrEqual(900);
    expect(document.pages).toHaveLength(2);
  });

  it("fails closed instead of placing identity filler on a page", () => {
    expect(() => buildBookEditorialDocument(input({ title: "   " }))).toThrow(
      /confirmed book key, title, writer and theme version/u
    );
  });
});
