import { describe, expect, it } from "vitest";
import { load } from "cheerio";
import { createPublicImageHtmlRenderer } from "./public-image-delivery.mjs";

const source = "https://media.example.com/original.png";
const render = createPublicImageHtmlRenderer({ [source]: {
  src: "media/full.webp", width: 1800, height: 1200,
  variants: [{ src: "media/card.webp", width: 600, height: 400 }],
} }, "/library/");

describe("static public image delivery", () => {
  it("reserves geometry and supplies responsive renditions under the deployed base path", () => {
    const $ = load(render(`<figure><img src="${source}" alt="A book"><figcaption>Credit</figcaption></figure>`));
    expect($("img").attr()).toMatchObject({ src: "/library/media/full.webp", width: "1800", height: "1200", loading: "lazy", decoding: "async", alt: "A book" });
    expect($("img").attr("srcset")).toBe("/library/media/card.webp 600w, /library/media/full.webp 1800w");
    expect($("figcaption").text()).toBe("Credit");
  });
  it("does not replace editorial source links or unknown illustrations", () => {
    const $ = load(render(`<a href="${source}">Original</a><img src="https://new.example/a.jpg" alt="New">`));
    expect($("a").attr("href")).toBe(source);
    expect($("img").attr("src")).toBe("https://new.example/a.jpg");
    expect($("img").attr("srcset")).toBeUndefined();
  });
  it("lets lazy small images use their rendered slot while preserving authored layout and full fallback", () => {
    const $ = load(render(`<a href="${source}">Original</a><img src="${source}" alt="A book" data-image-width="20" data-image-layout="right" data-lightbox="true">`));
    expect($("img").attr()).toMatchObject({
      src: "/library/media/full.webp", width: "1800", height: "1200", loading: "lazy",
      "data-image-width": "20", "data-image-layout": "right", "data-lightbox": "true",
      sizes: "auto, (max-width: 1000px) calc(100vw - 48px), 880px",
    });
    expect($("a").attr("href")).toBe(source);
    expect($("img").css("aspect-ratio")).toBe("1800 / 1200");
    const cropped = load(render(`<img src="${source}" data-image-width="20" data-image-aspect="1-1">`));
    expect(cropped("img").css("aspect-ratio")).toBeUndefined();
    const unknown = load(render('<img src="https://new.example/a.jpg" data-image-width="20">'));
    expect(unknown("img").attr("sizes")).toBeUndefined();
  });
});
