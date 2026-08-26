import { describe, expect, it } from "vitest";

import type { BookArchiveEntry } from "../data/bookArchive";
import {
  bookSceneArchetypes,
  bookSceneThemeContrastRatio,
  bookSceneThemeCssProperties,
  bookSceneThemeCssVariables,
  resolveBookSceneTheme,
  type BookCoverPaletteRecord,
} from "./bookSceneThemes";

function book(overrides: Partial<BookArchiveEntry> = {}) {
  return {
    id: "work",
    title: "Work",
    countryId: "country",
    countryName: "Country",
    writerId: "writer",
    writerName: "Writer",
    genres: ["Novel", "Classic"],
    firstPublished: 1920,
    writer: {},
    country: {},
    ...overrides,
  } as BookArchiveEntry;
}

const palette: BookCoverPaletteRecord = {
  coverUrl: "brand/book-covers/work.webp",
  coverSha256: "a".repeat(64),
  rightsStatus: "editorial-original",
  dominantColor: "#426B70",
  darkColor: "#162B31",
  lightColor: "#E4D5B8",
  accentColor: "#D84F2A",
  warmColor: "#C67E42",
};

describe("book scene themes", () => {
  it("pins the complete twelve-archetype contract", () => {
    expect(bookSceneArchetypes).toEqual([
      "VIOLET LIBRARY",
      "WARM PAPER",
      "MUSEUM IVORY",
      "MIDNIGHT ARCHIVE",
      "AMBER READING ROOM",
      "ORANGE VIOLET TWILIGHT",
      "INK ROOM",
      "DEEP BLUE STUDY",
      "MUTED GREEN LIBRARY",
      "BURGUNDY EDITION",
      "CHARCOAL GALLERY",
      "CREAM PUBLISHING ROOM",
    ]);
    expect(new Set(bookSceneArchetypes).size).toBe(12);
  });

  it("creates an order-independent deterministic fallback from reviewed facets", () => {
    const first = resolveBookSceneTheme(book(), {
      audienceIds: ["all-ages", "adult"],
      palette: null,
    });
    const second = resolveBookSceneTheme(
      book({ genres: ["Classic", "Novel"] }),
      { audienceIds: ["adult", "all-ages"], palette: null }
    );
    expect(second).toEqual(first);
    expect(first.source).toBe("fallback");
    expect(first.versionHash).toMatch(/^theme-v1-[a-f0-9]{16}$/u);
  });

  it("uses only an exact local rights-approved cover palette", () => {
    const covered = book({
      coverUrl: palette.coverUrl,
      coverRights: {
        status: "editorial-original",
        sourceUrl: palette.coverUrl,
      },
    });
    expect(resolveBookSceneTheme(covered, { palette }).source).toBe("cover");
    expect(
      resolveBookSceneTheme(covered, {
        palette: { ...palette, coverUrl: "brand/book-covers/other.webp" },
      }).source
    ).toBe("fallback");
    expect(
      resolveBookSceneTheme(
        book({
          coverUrl: "https://example.com/preview.jpg",
          coverRights: {
            status: "external-preview",
            sourceUrl: "https://example.com/preview.jpg",
          },
        }),
        { palette: { ...palette, coverUrl: "https://example.com/preview.jpg" } }
      ).source
    ).toBe("fallback");
  });

  it("lets a closed owner preset win without accepting raw colors", () => {
    const theme = resolveBookSceneTheme(book(), {
      palette: null,
      ownerOverride: { archetype: "BURGUNDY EDITION" },
    });
    expect(theme.source).toBe("owner-override");
    expect(theme.archetype).toBe("BURGUNDY EDITION");
  });

  it("keeps every generated theme contrast-safe with an exact CSS allowlist", () => {
    const themes = bookSceneArchetypes.map((archetype) =>
      resolveBookSceneTheme(book({ id: archetype }), {
        palette: null,
        ownerOverride: { archetype },
      })
    );
    for (const theme of themes) {
      for (const color of [
        theme.baseColor,
        theme.secondaryColor,
        theme.accentColor,
        theme.warmColor,
        theme.paperColor,
        theme.inkColor,
        theme.shelfColor,
        theme.lightColor,
      ]) {
        expect(color).toMatch(/^#[0-9A-F]{6}$/u);
      }
      expect(theme.contrastScore).toBeGreaterThanOrEqual(4.5);
      expect(bookSceneThemeContrastRatio(theme.inkColor, theme.paperColor)).toBeGreaterThanOrEqual(7);
      expect(Object.keys(bookSceneThemeCssProperties(theme)).sort()).toEqual(
        [...bookSceneThemeCssVariables].sort()
      );
    }
  });
});
