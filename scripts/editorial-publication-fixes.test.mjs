import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  applyEditorialPublicationFix,
  BLACK_SWAN_REVIEW_ARTICLE_ID,
  CONFIRMED_RUSSIAN_COPY_ARTICLE_IDS,
  CONFIRMED_RUSSIAN_COPY_REPLACEMENTS,
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
      "/stati/mnenie-o-knige/mnenie-o-knige-devid-mitchell-oblachnyy-atlas/",
    );
    expect(blackSwan.content_html).not.toContain("/read/page-books/7");
    expect(india.content_html).toContain(
      "/stati/literaturnye-premii/1913-god-rabindranat-tagor-laureat-nobelevskoy-premii/",
    );
    expect(india.content_html).not.toContain(
      "/read/page-article/nobel-prize/14",
    );
  });

  it("leaves unrelated publications untouched", () => {
    const article = { id: "unrelated", excerpt: "Без изменений" };
    expect(applyEditorialPublicationFix(article)).toBe(article);
  });

  it("corrects confirmed Russian grammar in CMS body fields", () => {
    const grimms = applyEditorialPublicationFix({
      id: "cms-13723645-4457-4386-9d66-8b94f4b90743",
      contentHtml:
        "<p>Запасливый башмачник с едой в котомке, не охотно рвётся помочь своему приятелю, всячески издеваясь над ним и подтрунивая за его оптимизм, лишь смотрит, как тот изнывает от голода.</p>",
      plainText:
        "Запасливый башмачник с едой в котомке, не охотно рвётся помочь своему приятелю, всячески издеваясь над ним и подтрунивая за его оптимизм, лишь смотрит, как тот изнывает от голода.",
    });
    const mediaCulture = applyEditorialPublicationFix({
      id: "c244258d-fd2a-48a3-a22e-38f144e75d2d",
      content_html:
        "<p>Такие творения не имеют не изюминки, не смысла и до сих зарабатывают.</p>",
    });

    expect(grimms.contentHtml).toContain("не спешит помочь");
    expect(grimms.contentHtml).toContain("подтрунивая над его оптимизмом");
    expect(grimms.plainText).not.toContain("не охотно");
    expect(mediaCulture.content_html).toContain("ни изюминки, ни смысла");
    expect(mediaCulture.content_html).toContain("до сих пор зарабатывают");
    expect(CONFIRMED_RUSSIAN_COPY_ARTICLE_IDS).toContain(
      "13723645-4457-4386-9d66-8b94f4b90743",
    );
  });

  it("keeps every confirmed replacement anchored to the exported CMS corpus", () => {
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );

    for (const articleId of CONFIRMED_RUSSIAN_COPY_ARTICLE_IDS) {
      const articlePath = path.join(
        projectRoot,
        "public",
        "cms",
        "articles",
        `cms-${articleId}.json`,
      );
      const article = JSON.parse(readFileSync(articlePath, "utf8"));
      const source = `${article.contentHtml || ""}\n${article.plainText || ""}`;
      const corrected = applyEditorialPublicationFix(article);
      const output = `${corrected.contentHtml || ""}\n${corrected.plainText || ""}`;

      for (const [before, after] of CONFIRMED_RUSSIAN_COPY_REPLACEMENTS[
        articleId
      ]) {
        expect(source, `${articleId}: ${before}`).toContain(before);
        if (!after.includes(before)) {
          expect(output, `${articleId}: ${before}`).not.toContain(before);
        }
        expect(output, `${articleId}: ${after}`).toContain(after);
      }
    }
  });
});
