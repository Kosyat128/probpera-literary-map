import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  canonicalEditorialImageData,
  editorialImageElementStyle,
  editorialImageFigureStyle,
  normalizeEditorialImagePublicAttributes,
  safeEditorialMediaUrl,
} from "./editorialImagePresentation";

const sanitizerSource = readFileSync(
  new URL("./sanitizeArticleHtml.ts", import.meta.url),
  "utf8"
);
const articleReaderSource = readFileSync(
  new URL("../components/ArticleReader.tsx", import.meta.url),
  "utf8"
);
const publicStyles = readFileSync(
  new URL("../index.css", import.meta.url),
  "utf8"
);

describe("public editorial image attributes", () => {
  it("normalizes the full typed contract and clamps numeric presentation data", () => {
    const value = normalizeEditorialImagePublicAttributes({
      "data-media-id": "8b52b293-038c-4c11-92a1-8351af7f25c8",
      "data-caption": "  Подпись  ",
      "data-image-layout": "full",
      "data-image-width": "125",
      "data-image-max-width": "120",
      "data-image-aspect": "16-9",
      "data-image-fit": "cover",
      "data-image-appearance": "shadow",
      "data-image-reveal": "fade-up",
      "data-focus-x": "-0.2",
      "data-focus-y": "0.72555",
      "data-credit": "Редакция",
      "data-source": "https://example.com/source",
      "data-license": "CC BY 4.0",
      "data-license-url": "https://creativecommons.org/licenses/by/4.0/",
      "data-link": "/archive/book",
      "data-lightbox": "false",
      "data-decorative": "true",
    });

    expect(value).toMatchObject({
      layout: "full",
      width: 100,
      maxWidth: 240,
      aspect: "16-9",
      fit: "cover",
      appearance: "shadow",
      reveal: "fade-up",
      focusX: 0,
      focusY: 0.72555,
      lightbox: false,
      decorative: true,
      link: "/archive/book",
    });
    expect(canonicalEditorialImageData(value)).toMatchObject({
      "data-image-width": "100",
      "data-image-max-width": "240",
      "data-focus-x": "0.0000",
      "data-focus-y": "0.7256",
      "data-image-appearance": "shadow",
      "data-image-reveal": "fade-up",
      "data-decorative": "true",
    });
  });

  it("rejects executable and protocol-relative URLs", () => {
    expect(safeEditorialMediaUrl("javascript:alert(1)")).toBe("");
    expect(safeEditorialMediaUrl("data:text/html,unsafe")).toBe("");
    expect(safeEditorialMediaUrl("//evil.example/image")).toBe("");
    expect(safeEditorialMediaUrl("#chapter")).toBe("#chapter");
    expect(safeEditorialMediaUrl("/media/image.webp")).toBe(
      "/media/image.webp"
    );
  });

  it("emits only bounded presentation custom properties", () => {
    const value = normalizeEditorialImagePublicAttributes({
      "data-image-width": "43",
      "data-image-max-width": "840",
      "data-focus-x": "0.125",
      "data-focus-y": "0.875",
    });

    expect(editorialImageFigureStyle(value)).toBe(
      "--editorial-image-width: 43%; --editorial-image-max-width: 840px"
    );
    expect(editorialImageElementStyle(value)).toBe(
      "--editorial-focus-x: 12.50%; --editorial-focus-y: 87.50%"
    );
  });

  it("fails closed to the legacy frame and no motion for unknown presentation values", () => {
    const value = normalizeEditorialImagePublicAttributes({
      "data-image-appearance": "custom-class shadow-xl",
      "data-image-reveal": "url(javascript:alert(1))",
    });

    expect(value.appearance).toBe("frame");
    expect(value.reveal).toBe("none");
    expect(canonicalEditorialImageData(value)).toMatchObject({
      "data-image-appearance": "frame",
      "data-image-reveal": "none",
    });
  });
});

describe("public editorial image integration", () => {
  it("rebuilds safe figures, links, captions, provenance, and decorative ARIA", () => {
    expect(sanitizerSource).toContain("normalizeInlineEditorialImage");
    expect(sanitizerSource).toContain('details.className = "article-image-details"');
    expect(sanitizerSource).toContain('provenance.className = "article-image-provenance"');
    expect(sanitizerSource).toContain('element.setAttribute("role", "presentation")');
    expect(sanitizerSource).toContain('element.setAttribute("aria-hidden", "true")');
    expect(sanitizerSource).toContain("safeEditorialMediaUrl(attributes.source)");
    expect(sanitizerSource).toContain(
      "figure.dataset.imageAppearance = attributes.appearance"
    );
    expect(sanitizerSource).toContain(
      "figure.dataset.imageReveal = attributes.reveal"
    );
  });

  it("uses one responsive rendering contract in Article and CmsPage readers", () => {
    expect(publicStyles).toContain(
      ':is(.article-reader-content, .cms-page-prose) figure.article-inline-image'
    );
    expect(publicStyles).toContain("--editorial-image-width");
    expect(publicStyles).toContain("--editorial-image-max-width");
    expect(publicStyles).toContain("--editorial-focus-x");
    expect(publicStyles).toContain("max-width: min(var(--editorial-image-max-width, 100%), 100%)");
    expect(publicStyles).toContain(".article-editorial-image.is-aspect-16-9");
    expect(publicStyles).toContain('[data-image-appearance="clean"]');
    expect(publicStyles).toContain('[data-image-appearance="shadow"]');
    expect(publicStyles).toContain('[data-image-reveal="fade-up"]');
    expect(publicStyles).toContain('[data-image-reveal="zoom"]');
    expect(publicStyles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps decorative, disabled, and linked images out of the lightbox", () => {
    expect(articleReaderSource).toContain(
      'image.dataset.decorative !== "true"'
    );
    expect(articleReaderSource).toContain(
      'image.dataset.lightbox !== "false"'
    );
    expect(articleReaderSource).toContain('!image.closest("a[href]")');
    expect(articleReaderSource).toContain(
      'collection?.dataset.galleryLightbox !== "false"'
    );
  });
});
