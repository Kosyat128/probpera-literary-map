import { describe, expect, it } from "vitest";

import {
  bookArchiveBackgroundMediaIssue,
  isBookArchiveBackgroundMediaSafe,
} from "./book-archive-media-policy";

const safeMedia = {
  mime_type: "image/webp",
  alt_text: "Тёмная библиотека",
  creator: "Редакция «Пробы Пера»",
  source_url: "",
  license_name: "Редакционное оригинальное изображение",
  license_url: "",
};

describe("book archive background media policy", () => {
  it("accepts a traceable owner-original or HTTPS-attributed raster", () => {
    expect(isBookArchiveBackgroundMediaSafe(safeMedia)).toBe(true);
    expect(
      isBookArchiveBackgroundMediaSafe({
        ...safeMedia,
        license_name: "CC BY 4.0",
        source_url: "https://commons.wikimedia.org/wiki/File:Library.jpg",
        license_url: "https://creativecommons.org/licenses/by/4.0/",
      })
    ).toBe(true);
  });

  it("fails closed on missing rights, unsafe protocols and active SVG", () => {
    expect(bookArchiveBackgroundMediaIssue(null)).toContain("не найдено");
    expect(
      isBookArchiveBackgroundMediaSafe({ ...safeMedia, license_name: "" })
    ).toBe(false);
    expect(
      isBookArchiveBackgroundMediaSafe({
        ...safeMedia,
        license_name: "CC BY 4.0",
      })
    ).toBe(false);

    expect(
      isBookArchiveBackgroundMediaSafe({
        ...safeMedia,
        source_url: "http://example.com/image.jpg",
      })
    ).toBe(false);
    expect(
      isBookArchiveBackgroundMediaSafe({ ...safeMedia, mime_type: "image/svg+xml" })
    ).toBe(false);
  });
});
