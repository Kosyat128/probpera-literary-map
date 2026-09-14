import { load } from "cheerio";
import { normalizeConfirmedArticleHeading } from "./article-route-policy.mjs";
import { applyArticleReadingEditorialFix } from "./article-reading-editorial-fixes-20260914.mjs";

export function headingSlug(value) {
  return value
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72);
}

function imageAltLooksTechnical(value = "") {
  const normalized = String(value).replace(/\s+/gu, " ").trim();
  return (
    !normalized ||
    /^[a-f0-9]{8}(?:[\s-][a-f0-9]{4}){3}[\s-][a-f0-9]{12}$/iu.test(
      normalized
    ) ||
    /^(?:img|image|photo|upload)[-_\s]*\d+/iu.test(normalized)
  );
}

export function prepareArticleDocument(contentHtml, articleTitle = "", locale = "ru") {
  const $ = load(`<main id="cms-article-root">${contentHtml || ""}</main>`, {
    decodeEntities: false,
  });

  $("#cms-article-root h2, #cms-article-root h3, #cms-article-root h4").each(
    (_index, element) => {
      const heading = $(element);
      const sourceText = heading.text().replace(/\s+/gu, " ").trim();
      const text = normalizeConfirmedArticleHeading(sourceText);
      if (text !== sourceText) heading.text(text);
    }
  );

  $("#cms-article-root h2, #cms-article-root h3, #cms-article-root h4, #cms-article-root p").each(
    (_index, element) => {
      const text = $(element).text().replace(/\u00a0/gu, " ").trim();
      if (!text && $(element).find("img").length === 0) $(element).remove();
    }
  );

  $("#cms-article-root p").each((_index, element) => {
    const current = $(element);
    const next = current.next("p");
    if (!next.length) return;
    const leftText = current.text().trim();
    const rightText = next.text().trim();
    const shortBrokenWord = leftText.match(/^([\p{L}]{1,4})$/u)?.[1];
    if (
      shortBrokenWord &&
      /^[\p{Ll}]/u.test(rightText) &&
      !/[.!?…:;»)]$/u.test(leftText)
    ) {
      current.html(`${current.html() || ""}${next.html() || ""}`);
      next.remove();
    }
  });

  const usedIds = new Set();
  const headings = [];

  $("#cms-article-root h2, #cms-article-root h3, #cms-article-root h4").each(
    (index, element) => {
      const text = $(element).text().replace(/\s+/gu, " ").trim();
      if (!text) return;
      const baseId =
        $(element).attr("id") || headingSlug(text) || `section-${index + 1}`;
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      $(element).attr("id", id);
      headings.push({
        id,
        level: Number(element.tagName.slice(1)),
        text,
      });
    }
  );

  $("#cms-article-root img").each((index, element) => {
    const image = $(element);
    const currentAlt = image.attr("alt") || "";
    if (imageAltLooksTechnical(currentAlt)) {
      const sectionTitle = image
        .prevAll("h2, h3, h4")
        .first()
        .text()
        .replace(/\s+/gu, " ")
        .trim();
      image.attr(
        "alt",
        locale === "en"
          ? sectionTitle
            ? `Illustration for the section "${sectionTitle}"`
            : `Illustration ${index + 1} for the article "${articleTitle}"`
          : sectionTitle
            ? `Иллюстрация к разделу «${sectionTitle}»`
            : `Иллюстрация ${index + 1} к статье «${articleTitle}»`
      );
    }
    if (!image.attr("loading")) image.attr("loading", "lazy");
  });

  const plainText = $("#cms-article-root")
    .text()
    .replace(/\s+/gu, " ")
    .trim();
  return {
    contentHtml: $("#cms-article-root").html() || "",
    plainText,
    headings,
  };
}

export function prepareProjectedArticleDocument(article, locale = "ru") {
  const prepared = prepareArticleDocument(article.content_html, article.title, locale);
  const projected = applyArticleReadingEditorialFix({
    ...prepared, id: article.article_id || article.id, locale,
  });
  return projected.contentHtml === prepared.contentHtml
    ? prepared
    : prepareArticleDocument(projected.contentHtml, article.title, locale);
}
