import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sanitizerSource = readFileSync(
  new URL("./sanitizeArticleHtml.ts", import.meta.url),
  "utf8"
);
const readerSource = readFileSync(
  new URL("../components/ArticleReader.tsx", import.meta.url),
  "utf8"
);
const pageReaderSource = readFileSync(
  new URL("../components/CmsPageReader.tsx", import.meta.url),
  "utf8"
);
const initializerSource = readFileSync(
  new URL("./initializeEditorialSliders.ts", import.meta.url),
  "utf8"
);
const publicStyles = readFileSync(
  new URL("../index.css", import.meta.url),
  "utf8"
);

describe("public structured gallery policy", () => {
  it("canonicalizes the finite gallery schema and creates caption figures", () => {
    for (const attribute of [
      "data-gallery-version",
      "data-gallery-id",
      "data-gallery-columns-desktop",
      "data-gallery-columns-tablet",
      "data-gallery-columns-mobile",
      "data-gallery-gap",
      "data-gallery-aspect",
      "data-gallery-fit",
      "data-gallery-captions",
      "data-gallery-lightbox",
      "data-slider-arrows",
      "data-slider-dots",
      "data-slider-autoplay",
      "data-slider-interval",
      "data-slider-loop",
    ]) {
      expect(sanitizerSource).toContain(`"${attribute}"`);
    }
    expect(sanitizerSource).toContain('figure.className = "article-gallery-item"');
    expect(sanitizerSource).toContain('captionElement.className = "article-gallery-caption"');
    expect(sanitizerSource).toContain("itemCount >= editorialGalleryMaxItems");
    expect(sanitizerSource).toContain("slice(editorialGalleryMaxItems)");
    expect(sanitizerSource).toContain("candidate !== itemImage");
    expect(sanitizerSource).toContain(
      'child.querySelector<HTMLImageElement>("img")'
    );
    expect(sanitizerSource).toContain(
      'provenance.className = "article-image-provenance"'
    );
    expect(sanitizerSource).toContain("attributes.credit");
    expect(sanitizerSource).toContain("attributes.source");
    expect(sanitizerSource).toContain("attributes.licenseUrl");
  });

  it("shares settings-aware slider behavior between articles and CMS pages", () => {
    expect(readerSource).toContain("initializeEditorialSliders(root");
    expect(pageReaderSource).toContain("initializeEditorialSliders(root");
    expect(initializerSource).toContain("slider.dataset.sliderArrows");
    expect(initializerSource).toContain("slider.dataset.sliderDots");
    expect(initializerSource).toContain("slider.dataset.sliderAutoplay");
    expect(initializerSource).toContain("slider.dataset.sliderLoop");
    expect(initializerSource).toContain('prefers-reduced-motion: reduce');
    expect(initializerSource).toContain("document.addEventListener(\"visibilitychange\"");
    expect(initializerSource).toContain("article-slider-autoplay");
    expect(initializerSource).toContain("userPaused");
    expect(initializerSource).toContain("labels.resume");
    expect(sanitizerSource).toContain("removeEditorialCollectionImage");
  });

  it("renders finite responsive columns without inline style injection", () => {
    expect(publicStyles).toContain('[data-gallery-columns-desktop="6"]');
    expect(publicStyles).toContain('[data-gallery-columns-tablet="4"]');
    expect(publicStyles).toContain('[data-gallery-columns-mobile="2"]');
    expect(publicStyles).toContain('[data-gallery-aspect="16-9"]');
    expect(publicStyles).toContain('[data-gallery-fit="cover"]');
    expect(publicStyles).toContain("content-visibility: auto");
    expect(publicStyles).toContain(
      ".article-gallery-item > .article-image-provenance"
    );
  });
});
