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
});
