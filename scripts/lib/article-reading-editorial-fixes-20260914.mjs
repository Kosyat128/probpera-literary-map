import { createHash } from "node:crypto";
import { load } from "cheerio";
import reviewedCopy from "../fixtures/article-copy-refinement-20260914.json" with { type: "json" };

export const KNIGHTS_ARTICLE_ID = "e6bf64b8-53eb-419d-a2e2-0e2e00acf9d8";
export const CENTURY_BOOKS_ARTICLE_ID = "c4404e31-9cd9-47fa-b4a9-dec175c651a5";
export const POETRY_ESSAY_ARTICLE_ID = "f5f4a78c-c63e-47ca-9fed-a86ca98aead7";
export const ARTICLE_READING_FIX_IDS = Object.freeze([
  KNIGHTS_ARTICLE_ID, CENTURY_BOOKS_ARTICLE_ID, POETRY_ESSAY_ARTICLE_ID,
]);
const projectionIds = new Set([
  ...ARTICLE_READING_FIX_IDS,
  ...reviewedCopy.textChanges.map((change) => change.articleId),
  ...reviewedCopy.paragraphChanges.map((change) => change.articleId),
]);

const knightsLeadBefore = "В сегодняшней статье мы кратко приведем пятнадцать лучших художественных книг о рыцарях, написанные в совершенно разные эпохи, которые объединяет одно - все они получили широкую известность во всём мире.";
const knightsLeadAfter = "Подборка из пятнадцати художественных книг о рыцарях, написанных в разные эпохи.";
const knightsEnglishLeadBefore = "In today's article, we will briefly present fifteen of the best fiction books about knights, written in completely different eras, which are united by one thing: all of them have achieved widespread fame throughout the world.";
const knightsEnglishLeadAfter = "A selection of fifteen works of fiction about knights, written in different eras.";
const centuryLeadBefore = "Во второй части нашей подборки мы вновь собрали десять выдающихся текстов, выпущенных в XXI веке, значение каждой из которых подтверждается высоким уровнем продаж, международным признанием и практически единогласным одобрением со стороны критиков и читателей.";
const centuryIntroBefore = "Во второй части нашей подборки мы собрали ещё десять выдающихся текстов, выпущенных в XXI веке, значение каждой из которых подтверждается высоким уровнем продаж, международным признанием и практически единогласным одобрением со стороны критиков и читателей.";
const centuryLeadAfter = "Ещё десять книг XXI века: краткие описания и интересные факты о каждом произведении.";

const essayLeadBefore = "Одним сентябрьским солнечным днём, я, по обыкновению, не спеша прогуливался по парку после занятий в университете. Череда пышно-растущих кустов сирени и гортензии, создающие своеобразную живую изгородь, еще пахли летом. Немного позади, как бы за их спинами, выстроились гиганты -";
const essayLeadAfter = "Эссе о первой встрече с поэзией и книге, которая пробудила интерес к стихам.";

const knightsCoverFiles = new Set([
  "d4db3818-d9fc-4b6a-881a-29d7df723249", "5e62c6ae-e5a1-4cad-b8fc-315378d9cf05",
  "cc41e6dd-22b9-48bf-b344-71cc2c5cb228", "8d9c9658-6da5-4d9e-9ab6-d91c8ae60637",
  "cbc6962d-0477-4b16-8385-4fd083487b07", "765de1ee-44ca-4cb2-bfc7-fa190cab725b",
  "36a83815-15c3-4eca-a93a-555b50366c5d", "d2703c8e-1a5c-4d7a-9e4f-d17eaba871c4",
  "f8ea1ffc-baac-4a1a-ac0d-2acd0f761427", "28184d48-7c01-4f11-88d9-655bc35bdd42",
  "a1aaf40c-9c4f-4445-8394-b23492bbc184", "57c9f948-fd98-45ba-a546-96d278151b44",
  "4bf6b607-1bb4-4dfc-aa6b-32a4af7bad25", "0192d2bd-fd6a-4dc4-b34f-adf337892eca",
  "2d8fcdcf-9aca-4f09-89c4-8e44abd4f568",
]);
const mediaPrefix = "https://sjqejjmwpzfsczxdghvw.supabase.co/storage/v1/object/public/editorial-media/2026/08/";

function attribute(tag, name) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`, "u"))?.[1];
}

function fixKnightsCovers(html) {
  return html.replace(/<img\b[^>]*>/gu, (tag) => {
    const src = attribute(tag, "src") || "";
    const file = src.startsWith(mediaPrefix) ? src.slice(mediaPrefix.length).replace(/\.webp$/u, "") : "";
    // Only the observed legacy presentation, never later authored dimensions.
    if (!knightsCoverFiles.has(file) || !src.endsWith(".webp") ||
      attribute(tag, "class") !== "article-image is-wide" ||
      attribute(tag, "data-image-layout") !== "wide" ||
      /\s(?:style|width|height|data-image-(?!layout\b)[\w-]+)=/u.test(tag)) return tag;
    return tag.replace('class="article-image is-wide"', 'class="article-image is-normal"')
      .replace('data-image-layout="wide"', 'data-image-layout="normal" data-image-width="100" data-image-max-width="420"');
  });
}

function replaceText(html, before, after) {
  // Text nodes only: keep permanent fragment IDs, links and media URLs intact.
  return html.split(/(<[^>]*>)/gu).map((part) => part.startsWith("<") ? part : part.replaceAll(before, after)).join("");
}

function repairHeading(html, before, after, legacyId) {
  return html.replace(/<h([234])([^>]*)>(.*?)<\/h\1>/gsu, (heading, level, attrs, inner) => {
    const comparable = inner.replace(/^<br\s*\/?>/iu, "").trim();
    if (comparable !== before && comparable !== `<strong>${before}</strong>`) return heading;
    const anchored = /\sid=/u.test(attrs) ? attrs : `${attrs} id="${legacyId}"`;
    return `<h${level}${anchored}>${inner.replace(before, after)}</h${level}>`;
  });
}

const essayBoundaries = [
  "Я шагал по широкой асфальтированной дорожке",
  "Помню, как в тот день, на одной из «мест встречи студентов»",
  "Тогда я еще учился на третьем курсе университета",
  "Остановившись я с прищуром вглядывался",
  "Помню, как я внутри боролся с самим собой",
];

function fixEssayParagraphs(html) {
  return html.replace(/^<p>(.*?)<\/p>/su, (paragraph, inner) => {
    if (/<(?!br\s*\/?>)[^>]*>/iu.test(inner)) return paragraph;
    if (createHash("sha256").update(inner.replace(/<br\s*\/?>/giu, "<br>")).digest("hex") !==
      "d2ec84ccc30c995566f825b53a299b262aa0d90e1d746a1ce50825c40bda51cd") return paragraph;
    const text = load(inner).text().replace(/\s+/gu, " ").trim();
    if (createHash("sha256").update(text).digest("hex") !==
      "1f25e4e8cc58694e89ae846f932a21ea7c915567bb3697e3ee83bc35eb9ba83e") return paragraph;
    if (essayBoundaries.some((boundary) => inner.split(` ${boundary}`).length !== 2)) return paragraph;
    let revised = inner.replace(/(?:<br\s*\/?>)+$/iu, "")
      .replace(/(?:<br\s*\/?>)+/giu, "</p><p>");
    for (const boundary of essayBoundaries) revised = revised.replace(` ${boundary}`, `</p> <p>${boundary}`);
    return `<p>${revised}</p>`;
  });
}

function applyReviewedCopy(article, id) {
  const textChanges = reviewedCopy.textChanges.filter((change) => change.articleId === id);
  const paragraphs = reviewedCopy.paragraphChanges.filter((change) => change.articleId === id);
  let corrected = article;
  const assign = (field, value) => {
    if (value !== corrected[field]) corrected = { ...corrected, [field]: value };
  };
  for (const change of textChanges) {
    const fields = change.field === "title" ? ["title", "seo_title", "og_title", "seoTitle", "ogTitle"]
      : change.field === "description" ? ["excerpt", "subtitle", "description", "seo_description", "og_description", "seoDescription", "ogDescription"] : [];
    for (const field of fields) if (corrected[field] === change.before) assign(field, change.after);
  }
  for (const field of ["content_html", "contentHtml"]) {
    if (typeof corrected[field] !== "string") continue;
    let html = corrected[field];
    for (const change of textChanges.filter((item) => item.field === "heading")) {
      html = repairHeading(html, change.before, change.after, change.headingId);
    }
    for (const change of paragraphs) {
      if (createHash("sha256").update(change.beforeHtml).digest("hex") !== change.sourceParagraphSha256) throw new Error("Reviewed article paragraph integrity failed.");
      if (html.split(change.beforeHtml).length === 2) html = html.replace(change.beforeHtml, change.afterHtml);
    }
    assign(field, html);
  }
  if (Array.isArray(corrected.headings)) {
    const headings = corrected.headings.map((heading) => {
      const change = textChanges.find((item) => item.field === "heading" && item.headingId === heading.id && item.before === heading.text);
      return change ? { ...heading, text: change.after } : heading;
    });
    if (headings.some((heading, index) => heading !== corrected.headings[index])) assign("headings", headings);
  }
  return corrected;
}

export function applyArticleReadingEditorialFix(article) {
  if (!article) return article;
  const id = String(article.article_id || article.id || "").replace(/^cms-/u, "");
  if (!projectionIds.has(id)) return article;
  const english = article.locale === "en";
  if (english && id !== KNIGHTS_ARTICLE_ID) return article;
  let corrected = article;
  const assign = (field, value) => {
    if (value !== corrected[field]) corrected = { ...corrected, [field]: value };
  };
  const leadPairs = id === KNIGHTS_ARTICLE_ID
    ? [[english ? knightsEnglishLeadBefore : knightsLeadBefore, english ? knightsEnglishLeadAfter : knightsLeadAfter]]
    : id === CENTURY_BOOKS_ARTICLE_ID ? [[centuryLeadBefore, centuryLeadAfter], [centuryIntroBefore, centuryLeadAfter]]
      : id === POETRY_ESSAY_ARTICLE_ID ? [[essayLeadBefore, essayLeadAfter]] : [];
  for (const field of ["excerpt", "subtitle", "description", "seo_description", "og_description", "seoDescription", "ogDescription"]) {
    for (const [before, after] of leadPairs) if (corrected[field] === before) assign(field, after);
  }
  for (const field of ["content_html", "contentHtml"]) {
    if (typeof corrected[field] !== "string") continue;
    let html = corrected[field];
    if (id === KNIGHTS_ARTICLE_ID) {
      html = fixKnightsCovers(html);
      if (!english) {
        html = repairHeading(html, "Предисловиеf", "Предисловие", "предисловиеf");
        html = replaceText(html, "И в сегодняшней статье мы кратко приведем пятнадцать лучших художественных книг о рыцарях, написанные в совершенно разные эпохи, которые объединяет одно - все они получили широкую известность во всём мире.", knightsLeadAfter);
      } else html = replaceText(html, knightsEnglishLeadBefore, knightsEnglishLeadAfter);
    } else if (id === CENTURY_BOOKS_ARTICLE_ID) {
      html = repairHeading(html, "9. «Сочуствующий» - Вьет Тхань Нгуен (2015)", "9. «Сочувствующий» - Вьет Тхань Нгуен (2015)", "9-сочуствующий-вьет-тхань-нгуен-2015");
      html = replaceText(html, centuryIntroBefore, centuryLeadAfter);
      html = html.replace(/<img\b[^>]*>/gu, (tag) => {
        if (attribute(tag, "src") === `${mediaPrefix}7cf5228a-abbb-4edd-8f8c-06b42577d7ab.webp` && attribute(tag, "alt") === "Сочуствующий") tag = tag.replace('alt="Сочуствующий"', 'alt="Сочувствующий"');
        if (attribute(tag, "src") === `${mediaPrefix}2e38f799-d4a9-4554-b52b-63293b7e496e.webp` &&
          attribute(tag, "data-media-id") === "f6d769ea-d5cd-4c92-bc0a-7556b01520cb" &&
          attribute(tag, "data-image-layout") === "right" && attribute(tag, "data-image-width") === "20" &&
          attribute(tag, "data-image-aspect") === "auto" && attribute(tag, "data-image-fit") === "contain" &&
          attribute(tag, "data-lightbox") === "true" && attribute(tag, "data-decorative") === "true") return tag.replace('data-decorative="true"', 'data-decorative="false"');
        return tag;
      });
    } else if (id === POETRY_ESSAY_ARTICLE_ID) html = fixEssayParagraphs(html);
    assign(field, html);
  }
  if (Array.isArray(corrected.headings) && !english) {
    const replacements = id === KNIGHTS_ARTICLE_ID ? [["Предисловиеf", "Предисловие"]]
      : id === CENTURY_BOOKS_ARTICLE_ID ? [["9. «Сочуствующий» - Вьет Тхань Нгуен (2015)", "9. «Сочувствующий» - Вьет Тхань Нгуен (2015)"]] : [];
    const headings = corrected.headings.map((heading) => {
      const pair = replacements.find(([before]) => before === heading.text);
      return pair ? { ...heading, text: pair[1] } : heading;
    });
    if (headings.some((heading, index) => heading !== corrected.headings[index])) assign("headings", headings);
  }
  if (id === KNIGHTS_ARTICLE_ID && !english && corrected.translations?.en) {
    const en = applyArticleReadingEditorialFix({ ...corrected.translations.en, article_id: id });
    const { article_id: _articleId, ...translation } = en;
    if (JSON.stringify(translation) !== JSON.stringify(corrected.translations.en)) assign("translations", { ...corrected.translations, en: translation });
  }
  return english ? corrected : applyReviewedCopy(corrected, id);
}
