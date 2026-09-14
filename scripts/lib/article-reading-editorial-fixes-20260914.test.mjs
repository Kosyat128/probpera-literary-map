import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { prepareArticleDocument as prepare, prepareProjectedArticleDocument as prepareProjection } from "./article-document-preparation.mjs";
import {
  applyArticleReadingEditorialFix, ARTICLE_READING_FIX_IDS,
  KNIGHTS_ARTICLE_ID, CENTURY_BOOKS_ARTICLE_ID, POETRY_ESSAY_ARTICLE_ID,
} from "./article-reading-editorial-fixes-20260914.mjs";
import { EDITORIAL_PUBLICATION_FIX_IDS } from "../editorial-publication-fixes.mjs";
import reviewedCopy from "../fixtures/article-copy-refinement-20260914.json" with { type: "json" };

const snapshot = (id) => JSON.parse(readFileSync(new URL(`../../public/cms/articles/cms-${id}.json`, import.meta.url), "utf8"));
const images = (html) => { const $ = load(html); return $("img").toArray().map((img) => ({ ...img.attribs })); };
const exporter = readFileSync(new URL("../export-published-content.mjs", import.meta.url), "utf8");
const austerlitz = '<img src="https://sjqejjmwpzfsczxdghvw.supabase.co/storage/v1/object/public/editorial-media/2026/08/2e38f799-d4a9-4554-b52b-63293b7e496e.webp" alt="Обложка «Аустерлиц»" class="article-image is-right is-aspect-auto is-fit-contain" data-media-id="f6d769ea-d5cd-4c92-bc0a-7556b01520cb" data-image-layout="right" data-image-width="20" data-image-aspect="auto" data-image-fit="contain" data-image-appearance="frame" data-image-reveal="none" data-focus-x="0.5000" data-focus-y="0.5000" data-lightbox="true" data-decorative="true" loading="lazy">';

describe("reviewed article reading projection", () => {
  it("keeps source CMS writes and translation approval outside this projection", () => {
    for (const id of ARTICLE_READING_FIX_IDS) expect(EDITORIAL_PUBLICATION_FIX_IDS).not.toContain(id);
    expect(exporter).toContain("normalizeShortHyphensDeep(structuredClone(applyEditorialPublicationFix(rawArticle)))");
    expect(exporter).toContain("normalizeShortHyphensDeep(structuredClone(englishTranslationByArticleId.get(article.id)))");
  });

  it("fixes Knights copy and all 15 covers without changing URLs, alt or permanent anchors", () => {
    const original = snapshot(KNIGHTS_ARTICLE_ID);
    const before = structuredClone(original);
    const corrected = applyArticleReadingEditorialFix(original);
    expect(original).toEqual(before);
    expect(corrected.description).toBe("Подборка из пятнадцати художественных книг о рыцарях, написанных в разные эпохи.");
    expect(corrected.seoDescription).toBe(corrected.description);
    expect(corrected.ogDescription).toBe(corrected.description);
    expect(corrected.headings[0]).toEqual({ ...original.headings[0], text: "Предисловие" });
    const oldImages = images(original.contentHtml), newImages = images(corrected.contentHtml);
    expect(newImages).toHaveLength(15);
    newImages.forEach((img, index) => {
      expect(img).toEqual({ ...oldImages[index], class: "article-image is-normal", "data-image-layout": "normal", "data-image-width": "100", "data-image-max-width": "420" });
    });
    expect(applyArticleReadingEditorialFix(corrected)).toEqual(corrected);
  });

  it("persists the same result through fresh RU and EN document preparation", () => {
    const publicArticle = snapshot(KNIGHTS_ARTICLE_ID);
    for (const locale of ["ru", "en"]) {
      const source = locale === "en" ? publicArticle.translations.en : publicArticle;
      const row = { article_id: KNIGHTS_ARTICLE_ID, locale, title: source.title, excerpt: source.description, content_html: source.contentHtml,
        status: "published", source_content_hash: "historical-source-fingerprint", approved_at: "existing-approval", source_article_updated_at: "existing-source-date" };
      const projected = applyArticleReadingEditorialFix(row);
      const fresh = prepare(projected.content_html, projected.title, locale);
      expect(images(fresh.contentHtml).filter((img) => img["data-image-max-width"] === "420")).toHaveLength(15);
      expect(fresh.headings.map((h) => h.id)).toEqual(source.headings.map((h) => h.id));
      expect(fresh.plainText).not.toContain(locale === "ru" ? "Предисловиеf" : "In today's article");
      for (const field of ["status", "source_content_hash", "approved_at", "source_article_updated_at"]) expect(projected[field]).toBe(row[field]);
      expect(applyArticleReadingEditorialFix(projected)).toEqual(projected);
    }
  });

  it("preserves later custom copy and cover presentation", () => {
    const original = snapshot(KNIGHTS_ARTICLE_ID);
    const custom = { id: original.id, excerpt: "Новый редакционный лид.", content_html: original.contentHtml.match(/<img\b[^>]*>/u)[0].replace('data-image-layout="wide"', 'data-image-layout="wide" data-image-max-width="580"') };
    expect(applyArticleReadingEditorialFix(custom)).toBe(custom);
    expect(applyArticleReadingEditorialFix({ id: "unrelated", content_html: original.contentHtml }).content_html).toBe(original.contentHtml);
  });

  it("enables only the observed Austerlitz cover and preserves its 20 percent layout", () => {
    const original = { id: CENTURY_BOOKS_ARTICLE_ID, content_html: `${austerlitz}<h2 id="9-сочуствующий-вьет-тхань-нгуен-2015"><strong>9. «Сочуствующий» - Вьет Тхань Нгуен (2015)</strong></h2>` };
    const corrected = applyArticleReadingEditorialFix(original);
    expect(images(corrected.content_html)[0]).toEqual({ ...images(original.content_html)[0], "data-decorative": "false" });
    const fresh = prepare(corrected.content_html);
    expect(fresh.headings[0]).toEqual({ id: "9-сочуствующий-вьет-тхань-нгуен-2015", level: 2, text: "9. «Сочувствующий» - Вьет Тхань Нгуен (2015)" });
    expect(applyArticleReadingEditorialFix(corrected)).toEqual(corrected);
    const custom = { id: CENTURY_BOOKS_ARTICLE_ID, content_html: austerlitz.replace('data-image-width="20"', 'data-image-width="40"') };
    expect(applyArticleReadingEditorialFix(custom)).toBe(custom);
  });

  it("splits exactly the reviewed essay prose into eight paragraphs, preserving text and every verse byte", () => {
    const original = snapshot(POETRY_ESSAY_ARTICLE_ID);
    const corrected = applyArticleReadingEditorialFix(original);
    const text = (html) => load(html).text().replace(/\s+/gu, " ").trim();
    expect(corrected.description).toBe("Эссе о первой встрече с поэзией и книге, которая пробудила интерес к стихам.");
    expect(corrected.seoDescription).toBe(corrected.description);
    expect(corrected.ogDescription).toBe(corrected.description);
    const customLead = { id: POETRY_ESSAY_ARTICLE_ID, description: "Авторское вступление после ручной редакции" };
    expect(applyArticleReadingEditorialFix(customLead)).toBe(customLead);
    expect(text(corrected.contentHtml)).toBe(text(original.contentHtml));
    expect(corrected.contentHtml.slice(corrected.contentHtml.indexOf("<p>***</p>"))).toBe(original.contentHtml.slice(original.contentHtml.indexOf("<p>***</p>")));
    expect(load(corrected.contentHtml)("p").length - load(original.contentHtml)("p").length).toBe(7);
    expect(applyArticleReadingEditorialFix(corrected)).toEqual(corrected);
    const edited = { id: original.id, contentHtml: original.contentHtml.replace("Одним сентябрьским", "Одним октябрьским") };
    expect(applyArticleReadingEditorialFix(edited)).toBe(edited);
    const manualBreak = { id: original.id, contentHtml: original.contentHtml.replace("Одним сентябрьским", "Одним <br>сентябрьским") };
    expect(applyArticleReadingEditorialFix(manualBreak)).toBe(manualBreak);
  });

  it("pins the independently approved copy and paragraph fixture", () => {
    const bytes = readFileSync(new URL("../fixtures/article-copy-refinement-20260914.json", import.meta.url), "utf8").replace(/\r\n/gu, "\n");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("4de0a8415df6fd49f3858f6bb41dfc45000a62efc66cfb75d6869275059750de");
    expect(reviewedCopy.textChanges).toHaveLength(39);
    expect(reviewedCopy.paragraphChanges).toHaveLength(8);
  });

  it("matches reviewed prose after actual export HTML serialization without mutating CMS input", () => {
    const original = snapshot(POETRY_ESSAY_ARTICLE_ID);
    const raw = { id: POETRY_ESSAY_ARTICLE_ID, title: original.title, content_html: original.contentHtml.replaceAll("<br>", "<br />").replaceAll("&nbsp;", "\u00a0") };
    const before = structuredClone(raw);
    const projected = prepareProjection(raw);
    expect(raw).toEqual(before);
    expect(load(projected.contentHtml)("p").length - load(original.contentHtml)("p").length).toBe(7);
    expect(projected.plainText).toBe(prepare(projected.contentHtml).plainText);
    expect(prepareProjection({ ...raw, content_html: projected.contentHtml })).toEqual(projected);
  });

  it("applies all reviewed copy fields, including computed descriptions, without changing custom metadata", () => {
    for (const change of reviewedCopy.textChanges) {
      const source = change.field === "heading"
        ? { id: change.articleId, content_html: `<h2 id="${change.headingId}"><strong>${change.before}</strong></h2>` }
        : { id: change.articleId, [change.field]: change.before, [change.field === "title" ? "seoTitle" : "seoDescription"]: change.before, ogDescription: "Авторский текст редактора" };
      const corrected = applyArticleReadingEditorialFix(source);
      if (change.field === "heading") {
        expect(prepare(corrected.content_html).headings[0]).toEqual({ id: change.headingId, level: 2, text: change.after });
        const legacy = applyArticleReadingEditorialFix({ id: change.articleId, content_html: `<h2 id="${change.headingId}"><br>${change.before} </h2>` });
        expect(prepare(legacy.content_html).headings[0]).toEqual({ id: change.headingId, level: 2, text: change.after });
      } else {
        expect(corrected[change.field]).toBe(change.after);
        expect(corrected[change.field === "title" ? "seoTitle" : "seoDescription"]).toBe(change.after);
        expect(corrected.ogDescription).toBe("Авторский текст редактора");
      }
      expect(applyArticleReadingEditorialFix(corrected)).toEqual(corrected);
      const edited = { id: change.articleId, [change.field]: "Новая ручная редакция" };
      expect(applyArticleReadingEditorialFix(edited)).toBe(edited);
    }
    expect(exporter).toContain("applyArticleReadingEditorialFix(normalizeArticlePublicMetadata({");
  });

  it("limits the eight additional prose splits to one exact reviewed paragraph and preserves surrounding HTML", () => {
    for (const change of reviewedCopy.paragraphChanges) {
      const source = { id: change.articleId, content_html: `<h2 id="kept">Без изменений</h2>${change.beforeHtml}<p><em>Строка стихотворения<br>Вторая строка</em></p>` };
      const corrected = applyArticleReadingEditorialFix(source);
      expect(corrected.content_html).toBe(source.content_html.replace(change.beforeHtml, change.afterHtml));
      expect(load(corrected.content_html).text().replace(/\s+/gu, "").trim()).toBe(load(source.content_html).text().replace(/\s+/gu, "").trim());
      expect(applyArticleReadingEditorialFix(corrected)).toEqual(corrected);
      const duplicate = { id: change.articleId, content_html: change.beforeHtml.repeat(2) };
      expect(applyArticleReadingEditorialFix(duplicate)).toBe(duplicate);
      const edited = { id: change.articleId, content_html: change.beforeHtml.replace(/<p\b/u, '<p data-manual="true"') };
      expect(applyArticleReadingEditorialFix(edited)).toBe(edited);
    }
  });
});
