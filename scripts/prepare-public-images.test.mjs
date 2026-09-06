import { describe, expect, it } from "vitest";
import { extractPublicImageReferences } from "./prepare-public-images.mjs";

describe("public image delivery inventory", () => {
  it("collects actual bilingual article imagery while excluding canonical pages and image credits", () => {
    const references = extractPublicImageReferences({
      canonicalUrl: "https://example.org/article.png",
      imageUrl: "https://cdn.example.org/cover.png?revision=2",
      sources: [{ url: "https://example.org/credits.jpg" }],
      contentHtml: '<p><a href="https://example.org/reference.jpg">Source</a></p><img src="https://cdn.example.org/illustration.jpg"><figure style="background-image:url(https://cdn.example.org/backdrop.webp)"></figure>',
      translations: { en: { contentHtml: '<img src="https://cdn.example.org/english.png">' } },
    });
    expect(references).toEqual([
      "https://cdn.example.org/cover.png?revision=2",
      "https://cdn.example.org/illustration.jpg",
      "https://cdn.example.org/backdrop.webp",
      "https://cdn.example.org/english.png",
    ]);
  });

  it("retains signed and extensionless image URLs, deduplicates exact references and skips non-fetchable assets", () => {
    const url = "https://cdn.example.org/scale_1200?token=public-signature";
    expect(extractPublicImageReferences({ imageUrl: url, contentHtml: `<img src="${url}"><img src="data:image/svg+xml,safe"><img src="blob:local">`, backgroundImageUrl: "/brand/background.avif", portrait: "staging://portrait.webp" })).toEqual([url, "/brand/background.avif"]);
  });

  it("rejects credential-bearing URLs and filesystem references even in image fields", () => {
    expect(extractPublicImageReferences({ imageUrl: "https://user:password@example.org/private.jpg", backgroundImageUrl: "file:///C:/private.png", portrait: "../../secret.png" })).toEqual([]);
  });
});
