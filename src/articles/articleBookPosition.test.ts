import { describe, expect, it } from "vitest";
import { paginateArticleBook, type ArticleBookBlock, type ArticleBookMeasure } from "./articleBookPages";
import { articleBookPageAnchor, readArticleBookAnchor, resolveArticleBookAnchor, writeArticleBookAnchor } from "./articleBookPosition";

const text = Array.from({ length: 1400 }, (_, index) => `word${index} `).join("");
const blocks: ArticleBookBlock[] = [
  { kind: "text", id: "block-0", role: "body", runs: [{ text: text.slice(0, 3000), italic: true }, { text: text.slice(3000) }] },
  { kind: "image", id: "image-1", src: "/fixture.webp", alt: "Fixture", width: 900, height: 1200 },
];
const measure: ArticleBookMeasure = (value, style) => value.length * style.size * .53;
const pagesAt = (fontScale: number) => paginateArticleBook({ articleId: "anchor-fixture", title: "Fixture", sectionLabel: "Articles", locale: "en", html: "fixture", fontScale }, blocks, measure).pages;

describe("canonical article book source position", () => {
  it("restores the same source fragment after repagination, including a split styled block", () => {
    const initial = pagesAt(1);
    const anchor = articleBookPageAnchor(initial, 3)!;
    expect(anchor.blockId).toBe("block-0");
    expect(anchor.offset).toBeGreaterThan(0);
    const fragment = text.slice(anchor.offset, anchor.offset + 24);
    for (const scale of [.9, 1.28, 1.7, 2.4]) {
      const pages = pagesAt(scale);
      const pageIndex = resolveArticleBookAnchor(pages, anchor);
      expect(pageIndex).toBeGreaterThanOrEqual(0);
      expect(pages[pageIndex].text).toContain(fragment);
    }
    expect(readArticleBookAnchor(writeArticleBookAnchor(anchor, "en"), "en")).toEqual(anchor);
  });

  it("retains image positions and explicit end across changed page counts", () => {
    const initial = pagesAt(1);
    const imagePage = initial.findIndex(page => page.articleLayout.some(command => command.kind === "image"));
    const imageAnchor = { blockId: "image-1", offset: 0 };
    expect(resolveArticleBookAnchor(initial, imageAnchor)).toBe(imagePage);
    const larger = pagesAt(2);
    expect(larger.length).toBeGreaterThan(initial.length);
    expect(larger[resolveArticleBookAnchor(larger, imageAnchor)].articleLayout.some(command => command.kind === "image")).toBe(true);
    expect(resolveArticleBookAnchor(larger, { blockId: "end", offset: 0 })).toBe(larger.length - 1);
  });

  it("rejects stale DOM, cross-language and malformed hints so callers can use saved percentage", () => {
    for (const hint of [undefined, "book:v1:ru:3:10", "article-book:v1:ru:block-0:10", "article-book:v1:en:block-0:-1", "article-book:v1:en:block-0:99999999999999999999"]) {
      expect(readArticleBookAnchor(hint, "en")).toBeNull();
    }
    expect(resolveArticleBookAnchor(pagesAt(1), { blockId: "removed", offset: 0 })).toBe(-1);
  });
});
