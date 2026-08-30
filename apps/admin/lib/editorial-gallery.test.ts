import { describe, expect, it } from "vitest";

import {
  EDITORIAL_GALLERY_MAX_ITEMS,
  editorialGalleryHtmlAttributes,
  mergeEditorialGalleryItems,
  normalizeEditorialGalleryItems,
  normalizeEditorialGallerySettings,
  parseEditorialGalleryUrls,
  safeEditorialGalleryHtmlAttributes,
  sanitizeEditorialGalleryJson,
} from "./editorial-gallery";

describe("structured editorial gallery model", () => {
  it("normalizes every setting to a finite, responsive schema", () => {
    expect(
      normalizeEditorialGallerySettings(
        {
          id: "../unsafe id",
          columnsDesktop: 99,
          columnsTablet: 0,
          columnsMobile: 7,
          gap: "wild",
          aspect: "9-7",
          fit: "stretch",
          captions: "false",
          lightbox: "true",
          autoplay: "true",
          interval: 999_999,
          loop: "false",
        } as never,
        "gallery"
      )
    ).toMatchObject({
      version: 1,
      id: "",
      columnsDesktop: 2,
      columnsTablet: 2,
      columnsMobile: 1,
      gap: "normal",
      aspect: "auto",
      fit: "contain",
      captions: false,
      lightbox: true,
      autoplay: true,
      interval: 5000,
      loop: false,
    });
  });

  it("supports twelve and up to one hundred ordered HTTPS items", () => {
    const source = Array.from(
      { length: EDITORIAL_GALLERY_MAX_ITEMS + 12 },
      (_, index) => `https://cdn.example.test/${index + 1}.webp`
    ).join("\n");
    const urls = parseEditorialGalleryUrls(source);

    expect(urls).toHaveLength(100);
    expect(urls[11]).toBe("https://cdn.example.test/12.webp");
    expect(urls.at(-1)).toBe("https://cdn.example.test/100.webp");
  });

  it("keeps media identity and URL fallback in item order", () => {
    const items = normalizeEditorialGalleryItems([
      {
        mediaId: "a1604bed-cafb-43ee-9c1a-65a0bcced59f",
        src: "https://cdn.example.test/first.webp",
        alt: "Первый кадр",
        caption: "Подпись",
        credit: "Архив",
        source: "https://archive.example.test/item/1",
        license: "CC BY 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        link: "https://example.test/source",
      },
      "javascript:alert(1)",
      "https://cdn.example.test/second.webp",
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      mediaId: "a1604bed-cafb-43ee-9c1a-65a0bcced59f",
      src: "https://cdn.example.test/first.webp",
      alt: "Первый кадр",
      caption: "Подпись",
      credit: "Архив",
      source: "https://archive.example.test/item/1",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      link: "https://example.test/source",
    });
    expect(items[1].src).toBe("https://cdn.example.test/second.webp");
  });

  it("rejects malformed URLs and unsafe media identities, then merges without duplicates", () => {
    expect(parseEditorialGalleryUrls("https://\nnot-a-url\nhttps://cdn.example.test/a.webp"))
      .toEqual(["https://cdn.example.test/a.webp"]);

    expect(
      mergeEditorialGalleryItems(
        [
          {
            mediaId: "../../unsafe",
            src: "https://cdn.example.test/a.webp",
          },
        ],
        [
          {
            mediaId: "b2704bed-cafb-43ee-9c1a-65a0bcced59f",
            src: "https://cdn.example.test/b.webp",
          },
          {
            mediaId: "b2704bed-cafb-43ee-9c1a-65a0bcced59f",
            src: "https://cdn.example.test/replacement.webp",
          },
        ]
      )
    ).toEqual([
      expect.objectContaining({
        mediaId: null,
        src: "https://cdn.example.test/a.webp",
      }),
      expect.objectContaining({
        mediaId: "b2704bed-cafb-43ee-9c1a-65a0bcced59f",
        src: "https://cdn.example.test/b.webp",
      }),
    ]);
  });

  it("serializes safe versioned attributes and strips them from other blocks", () => {
    const safe = safeEditorialGalleryHtmlAttributes({
      class: "article-design-block is-slider",
      "data-editorial-block": "slider",
      "data-gallery-id": "gallery-stable_01",
      "data-gallery-columns-desktop": "6",
      "data-slider-interval": "2500",
      "data-slider-loop": "false",
    });
    expect(safe).toMatchObject({
      "data-gallery-version": "1",
      "data-gallery-id": "gallery-stable_01",
      "data-gallery-mode": "slider",
      "data-gallery-columns-desktop": "6",
      "data-slider-interval": "2500",
      "data-slider-loop": "false",
    });

    expect(
      safeEditorialGalleryHtmlAttributes({
        "data-editorial-block": "fact",
        "data-gallery-id": "must-disappear",
      })
    ).not.toHaveProperty("data-gallery-id");

    expect(
      editorialGalleryHtmlAttributes(
        { id: "gallery-stable_01", arrows: false, dots: true },
        "slider"
      )
    ).toMatchObject({
      "data-gallery-id": "gallery-stable_01",
      "data-slider-arrows": "false",
      "data-slider-dots": "true",
    });
  });

  it("canonicalizes gallery settings in untrusted TipTap JSON", () => {
    const value = sanitizeEditorialGalleryJson({
      type: "doc",
      content: [
        {
          type: "editorialBlock",
          attrs: {
            kind: "gallery",
            galleryId: "gallery-json-01",
            galleryColumnsDesktop: 999,
            galleryColumnsTablet: 3,
            galleryColumnsMobile: 2,
            galleryGap: "compact",
            galleryAspect: "1-1",
            galleryFit: "cover",
          },
          content: [],
        },
      ],
    }) as { content: Array<{ attrs: Record<string, unknown> }> };

    expect(value.content[0]?.attrs).toMatchObject({
      galleryVersion: 1,
      galleryId: "gallery-json-01",
      galleryColumnsDesktop: 2,
      galleryColumnsTablet: 3,
      galleryColumnsMobile: 2,
      galleryGap: "compact",
      galleryAspect: "1-1",
      galleryFit: "cover",
    });
  });

  it("caps untrusted gallery JSON at one hundred ordered image children", () => {
    const value = sanitizeEditorialGalleryJson({
      type: "editorialBlock",
      attrs: { kind: "gallery" },
      content: [
        { type: "heading", attrs: { level: 3 } },
        ...Array.from({ length: 104 }, (_, index) => ({
          type: "image",
          attrs: { src: `https://cdn.example.test/${index + 1}.webp` },
        })),
      ],
    }) as { content: Array<{ type: string; attrs?: { src?: string } }> };

    expect(value.content).toHaveLength(101);
    expect(value.content.at(-1)?.attrs?.src).toBe(
      "https://cdn.example.test/100.webp"
    );
  });
});
