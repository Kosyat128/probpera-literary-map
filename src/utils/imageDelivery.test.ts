import { describe, expect, it } from "vitest";
import { createImageDeliveryResolver } from "./imageDelivery";

const original = "https://images.example.org/illustration.png";
const resolver = createImageDeliveryResolver({
  [original]: { src: "media/full.webp", width: 2000, height: 1000, variants: [
    { src: "media/small.webp", width: 640, height: 320 },
    { src: "media/medium.webp", width: 1280, height: 640 },
  ] },
}, "/journal/");

describe("public image delivery", () => {
  it("selects a suitable rendition without changing the source proportions", () => {
    expect(resolver.attributes(original, 720, "(max-width: 700px) 100vw, 880px")).toEqual({
      src: "/journal/media/medium.webp", width: 2000, height: 1000,
      srcSet: "/journal/media/small.webp 640w, /journal/media/medium.webp 1280w, /journal/media/full.webp 2000w",
      sizes: "(max-width: 700px) 100vw, 880px",
    });
    expect(resolver.url(original, 4000)).toBe("/journal/media/full.webp");
  });
  it("retains the original URL when opening a responsive image in the viewer", () => {
    expect(resolver.original("https://site.example/journal/media/small.webp")).toBe(original);
    expect(resolver.url("/journal/media/small.webp", 1900)).toBe("/journal/media/full.webp");
  });
  it("keeps unmapped external media and resolves local assets under the actual base path", () => {
    expect(resolver.url("https://other.example/a.png")).toBe("https://other.example/a.png");
    expect(resolver.url("brand/a.svg")).toBe("/journal/brand/a.svg");
    expect(resolver.url("data:image/png;base64,abcd")).toBe("data:image/png;base64,abcd");
  });
});
