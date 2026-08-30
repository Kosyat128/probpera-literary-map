import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sanitizerSource = readFileSync(
  new URL("./sanitizeArticleHtml.ts", import.meta.url),
  "utf8"
);
const publicStyles = readFileSync(
  new URL("../index.css", import.meta.url),
  "utf8"
);

describe("article image proportion policy", () => {
  it("removes base elements before resolving article URLs", () => {
    const blockedSelector = sanitizerSource.match(
      /const blockedElements =\s*\n\s*"([^"]+)";/u
    )?.[1];

    expect(blockedSelector?.split(",")).toContain("base");
    expect(sanitizerSource).toContain(
      "document.querySelectorAll(blockedElements).forEach((element) => element.remove())"
    );
  });

  it("does not reuse the fixed-ratio homepage class for editorial images", () => {
    expect(sanitizerSource).not.toContain(
      'element.classList.add("article-image"'
    );
    expect(sanitizerSource).toMatch(
      /element\.classList\.remove\([\s\S]*?"article-image"/u
    );
    expect(publicStyles).not.toMatch(/^\.article-image\s*\{/mu);
    expect(publicStyles).toMatch(/^\.editorial-grid \.article-image\s*\{/mu);
  });

  it("forces ordinary reader images back to their intrinsic ratio", () => {
    const readerImageRule = publicStyles.match(
      /\.article-reader-content figure img,[\s\S]*?\n\}/u
    )?.[0];

    expect(readerImageRule).toContain("height: auto");
    expect(readerImageRule).toContain("aspect-ratio: auto");
    expect(readerImageRule).toContain("object-fit: contain");
  });

  it("does not treat an in-page fragment as an image source", () => {
    expect(sanitizerSource).toContain("fragmentOnlyImageSource");
  });
});
