import { describe, expect, it } from "vitest";

import {
  applyEditorialPublicationFix,
  BLACK_SWAN_REVIEW_ARTICLE_ID,
  INDIA_WRITERS_ARTICLE_ID,
  MYTHOLOGY_EXPRESSIONS_ARTICLE_ID,
} from "./editorial-publication-fixes.mjs";

describe("confirmed editorial publication fixes", () => {
  it("replaces the mismatched film metadata on the mythology article", () => {
    const corrected = applyEditorialPublicationFix({
      id: MYTHOLOGY_EXPRESSIONS_ARTICLE_ID,
      excerpt: "Подборка фильмов",
      seo_description: "Подборка фильмов",
      og_description: "Подборка фильмов",
    });

    expect(corrected.excerpt).toContain("выражений из античных мифов");
    expect(corrected.seo_description).toContain("15 выражений");
    expect(corrected.og_description).not.toContain("фильмов");
  });

  it("rewrites confirmed legacy links to the permanent article URLs", () => {
    const blackSwan = applyEditorialPublicationFix({
      id: BLACK_SWAN_REVIEW_ARTICLE_ID,
      content_html:
        '<p><a href="https://probpera.ru/read/page-books/7">обзор</a></p>',
    });
    const india = applyEditorialPublicationFix({
      id: INDIA_WRITERS_ARTICLE_ID,
      content_html:
        '<p><a href="https://probpera.ru/read/page-article/nobel-prize/14">мы рассказывали</a></p>',
    });

    expect(blackSwan.content_html).toContain(
      "/stati/mnenie-o-knige/mnenie-o-knige-devid-mitchell-oblachnyy-atlas/"
    );
    expect(blackSwan.content_html).not.toContain("/read/page-books/7");
    expect(india.content_html).toContain(
      "/stati/literaturnye-premii/1913-god-rabindranat-tagor-laureat-nobelevskoy-premii/"
    );
    expect(india.content_html).not.toContain("/read/page-article/nobel-prize/14");
  });

  it("leaves unrelated publications untouched", () => {
    const article = { id: "unrelated", excerpt: "Без изменений" };
    expect(applyEditorialPublicationFix(article)).toBe(article);
  });
});
