import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  extractSiteCopyFromHomepageBlocks,
  normalizeHomepageEditorialCopy,
  SITE_COPY_SYSTEM_KEY,
} from "./site-copy-overrides.mjs";

describe("site-copy CMS export", () => {
  it("exports the newest database override and never exposes the system block", () => {
    const regularBlock = {
      id: "regular",
      settings: { coreSectionKey: "hero" },
      updated_at: "2026-08-01T00:00:00.000Z",
    };
    const olderSystemBlock = {
      id: "copy-old",
      settings: {
        systemKey: SITE_COPY_SYSTEM_KEY,
        siteCopy: { ru: { "interface.Поиск": "Старый поиск" } },
      },
      updated_at: "2026-08-02T00:00:00.000Z",
    };
    const newestSystemBlock = {
      id: "copy-new",
      settings: {
        systemKey: SITE_COPY_SYSTEM_KEY,
        siteCopy: {
          ru: { "interface.Поиск": "Найти на сайте", empty: "  " },
          en: { "interface.Поиск": "Search the archive" },
        },
      },
      updated_at: "2026-08-03T00:00:00.000Z",
    };

    expect(
      extractSiteCopyFromHomepageBlocks([
        regularBlock,
        olderSystemBlock,
        newestSystemBlock,
      ])
    ).toEqual({
      homepageBlocks: [regularBlock],
      siteCopy: {
        ru: { "interface.Поиск": "Найти на сайте" },
        en: { "interface.Поиск": "Search the archive" },
      },
    });
  });

  it("keeps deploy export read-only for the CMS database", async () => {
    const exporter = await readFile(
      new URL("./export-published-content.mjs", import.meta.url),
      "utf8"
    );

    expect(exporter).toContain("extractSiteCopyFromHomepageBlocks(rawHomepageBlocks)");
    expect(exporter).not.toMatch(/method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/u);
    expect(exporter).not.toContain("siteCopyCatalog");
  });

  it("normalizes the legacy book-of-the-month attribution without touching custom copy", () => {
    expect(
      normalizeHomepageEditorialCopy({
        id: "book-month",
        settings: {
          coreSectionKey: "book-month",
          eyebrow: "Выбор энциклопедии",
          description: "Текст",
        },
      })
    ).toEqual({
      id: "book-month",
      settings: {
        coreSectionKey: "book-month",
        eyebrow: "Выбор редакции",
        description: "Текст",
      },
    });
    expect(
      normalizeHomepageEditorialCopy({
        settings: { coreSectionKey: "book-month", eyebrow: "Выбор читателей" },
      })
    ).toEqual({
      settings: { coreSectionKey: "book-month", eyebrow: "Выбор читателей" },
    });
  });
});
