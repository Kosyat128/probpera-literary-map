import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  applyConfirmedCopyReplacements,
  applyEditorialPublicationFix,
  BLACK_SWAN_REVIEW_ARTICLE_ID,
  CONFIRMED_RUSSIAN_COPY_ARTICLE_IDS,
  CONFIRMED_RUSSIAN_COPY_REPLACEMENTS,
  FILM_ADAPTATIONS_PART_FOUR_ARTICLE_ID,
  INDIA_WRITERS_ARTICLE_ID,
  MYTHOLOGY_EXPRESSIONS_ARTICLE_ID,
  TUGARIN_ARTICLE_ID,
  WRITERS_PROFESSIONS_PART_FOUR_ARTICLE_ID,
} from "./editorial-publication-fixes.mjs";

describe("confirmed editorial publication fixes", () => {
  it("resolves replacement chains to a stable result in one call", () => {
    expect(
      applyConfirmedCopyReplacements("исходный текст", [
        ["промежуточный текст", "готовый текст"],
        ["исходный текст", "промежуточный текст"],
      ]),
    ).toBe("готовый текст");
  });

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

  it("repairs the part-four cover alt without copying the part-three label", () => {
    const corrected = applyEditorialPublicationFix({
      id: FILM_ADAPTATIONS_PART_FOUR_ARTICLE_ID,
      cover_alt: "Иллюстрация к статье (Часть 3)",
      imageAlt: "Иллюстрация к статье (Часть 3)",
    });

    expect(corrected.cover_alt).toContain("(Часть 4)");
    expect(corrected.imageAlt).toContain("(Часть 4)");
    expect(JSON.stringify(corrected)).not.toContain("(Часть 3)");
  });

  it("preserves the sourced 1889 Tugarin illustration idempotently", () => {
    const source = {
      id: TUGARIN_ARTICLE_ID,
      content_html:
        "<p>Предыдущий абзац.</p><p>Эту концепцию нельзя выдавать за окончательно доказанную историю происхождения персонажа.</p>",
    };
    const corrected = applyEditorialPublicationFix(source);

    expect(corrected.content_html).toContain(
      "5ecd0f72-224e-4b3a-af81-6e9ffd374ab7.webp"
    );
    expect(corrected.content_html).toContain(
      "К. В. Лебедев"
    );
    expect(applyEditorialPublicationFix(corrected)).toEqual(corrected);
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

  it("repairs the previously persisted repeated suffix idempotently", () => {
    const article = {
      id: "c244258d-fd2a-48a3-a22e-38f144e75d2d",
      content_html:
        "<p>Компании слишком полагаются на техническую составляющуюю, экономя на сюжете.</p>",
    };
    const corrected = applyEditorialPublicationFix(article);

    expect(corrected.content_html).toContain("техническую составляющую,");
    expect(corrected.content_html).not.toContain("составляющуюю");
    expect(applyEditorialPublicationFix(corrected)).toEqual(corrected);
  });

  it("removes the confirmed space before punctuation in the writers article", () => {
    const corrected = applyEditorialPublicationFix({
      id: WRITERS_PROFESSIONS_PART_FOUR_ARTICLE_ID,
      content_html: "<p>Он работал в журнале The New Yorker , где публиковался.</p>",
    });

    expect(corrected.content_html).toContain("The New Yorker, где");
    expect(corrected.content_html).not.toContain("The New Yorker ,");
    expect(applyEditorialPublicationFix(corrected)).toEqual(corrected);
  });

  it("keeps every confirmed replacement anchored before and after normalization", () => {
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
      const normalizedArticle = applyEditorialPublicationFix(article);
      const sourceArticles = [article, normalizedArticle];
      const sourceTexts = sourceArticles.map(
        (sourceArticle) =>
          `${sourceArticle.contentHtml || ""}\n${sourceArticle.plainText || ""}`,
      );

      for (const [before, after] of CONFIRMED_RUSSIAN_COPY_REPLACEMENTS[
        articleId
      ]) {
        expect(
          sourceTexts.some(
            (source) => source.includes(before) || source.includes(after),
          ),
          `${articleId}: ${before} -> ${after}`,
        ).toBe(true);
      }

      for (const sourceArticle of sourceArticles) {
        const corrected = applyEditorialPublicationFix(sourceArticle);
        const output = `${corrected.contentHtml || ""}\n${corrected.plainText || ""}`;

        for (const [before, after] of CONFIRMED_RUSSIAN_COPY_REPLACEMENTS[
          articleId
        ]) {
          if (!after.includes(before)) {
            expect(output, `${articleId}: ${before}`).not.toContain(before);
          }
          expect(output, `${articleId}: ${after}`).toContain(after);
        }

        expect(
          applyEditorialPublicationFix(corrected),
          `${articleId}: repeated editorial normalization`,
        ).toEqual(corrected);
      }
    }
  });
});
