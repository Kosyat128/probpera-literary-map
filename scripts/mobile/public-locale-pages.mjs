import { load } from "cheerio";
import { createHash } from "node:crypto";
import { evaluatePublicLocaleReview } from "./public-locale-review.mjs";

const ORIGIN = "https://probpera.ru";
// Copied from the existing authored interface dictionary, with source parity tests.
const COPY = Object.freeze({
  ru: {
    brand: "Проба Пера", description: "Литературный журнал и энциклопедия",
    navigation: "Основная навигация", globe: "Литературная планета",
    journal: "Читать журнал", books: "Книжный архив", ogLocale: "ru_RU",
    error: "Страница столкнулась с ошибкой", home: "Вернуться на главную",
  },
  en: {
    brand: "Proba Pera", description: "Literary journal and encyclopedia",
    navigation: "Main navigation", globe: "Literary Planet",
    journal: "Read the journal", books: "Book archive", ogLocale: "en_US",
    error: "This page encountered an error", home: "Return home",
  },
});

export function publicLocaleCopyInput() {
  const bytes = JSON.stringify(COPY);
  return { path: "source/public-locale-copy.json", bytes: Buffer.byteLength(bytes),
    sha256: createHash("sha256").update(bytes).digest("hex") };
}

function structuredData(language) {
  const canonical = `${ORIGIN}/${language}/`;
  const copy = COPY[language];
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${ORIGIN}/#website`, url: `${ORIGIN}/`, name: copy.brand, inLanguage: language },
      { "@type": "WebPage", "@id": `${canonical}#webpage`, url: canonical, name: copy.brand,
        description: copy.description, inLanguage: language, isPartOf: { "@id": `${ORIGIN}/#website` } },
    ],
  };
}

function json(value) { return JSON.stringify(value, null, 2).replace(/</gu, "\\u003c") + "\n"; }

function canonicalResource(value) {
  if (typeof value !== "string" || !value || value.includes("%BASE_URL%") || /[\\\u0000-\u0020]/u.test(value)) {
    throw new Error("Invalid canonical public resource URL");
  }
  const url = new URL(value, `${ORIGIN}/`);
  if (url.origin !== ORIGIN || url.username || url.password || url.hash) {
    throw new Error("Public locale resources must retain the canonical site origin");
  }
  // Resolve relative references at the original homepage, never beneath /en/.
  return value.startsWith("/") || value.startsWith(`${ORIGIN}/`)
    ? value
    : `${url.pathname}${url.search}`;
}

function parseCanonicalHome(builtHtml) {
  if (typeof builtHtml !== "string" || !builtHtml.trim() || builtHtml.length > 2_000_000) {
    throw new Error("Expected the bounded Vite/SEO-built canonical homepage HTML");
  }
  const $ = load(builtHtml);
  if ($("#root").length !== 1 || $("base").length) throw new Error("Expected one canonical root and no base override");
  $('script[type="application/ld+json"]').remove();
  const scripts = $("script");
  if (scripts.length !== 1 || scripts.attr("type") !== "module" || scripts.text().trim()) {
    throw new Error("Expected one external canonical module and no inline executable script");
  }
  const moduleSource = canonicalResource(scripts.attr("src"));
  if (!new URL(moduleSource, ORIGIN).pathname.endsWith(".js")) throw new Error("Expected the built canonical JavaScript module");
  scripts.attr("src", moduleSource).appendTo("head");
  $("*").each((_, node) => {
    if (Object.keys(node.attribs ?? {}).some(name => /^on/iu.test(name))) {
      throw new Error("Inline executable HTML handlers are not part of a canonical locale shell");
    }
  });
  const manifest = $('link[rel="manifest"]');
  if (manifest.length !== 1) throw new Error("Expected one existing public site manifest");
  const manifestHref = canonicalResource(manifest.attr("href"));
  // Preserve site identity. The separate controlled edition is not advertised here.
  if (new URL(manifestHref, ORIGIN).pathname.startsWith("/planet/")) {
    throw new Error("Public locale pages must retain the existing public site manifest");
  }
  manifest.attr("href", manifestHref);
  $('link[rel="stylesheet"], link[rel="modulepreload"], link[rel="preload"], link[rel="icon"], link[rel="apple-touch-icon"]').each((_, node) => {
    const link = $(node);
    link.attr("href", canonicalResource(link.attr("href")));
  });
  const sourceImage = $('meta[property="og:image"]').first().attr("content")
    ?? $('meta[name="twitter:image"]').first().attr("content")
    ?? $('link[rel="icon"]').first().attr("href");
  const image = sourceImage ? new URL(canonicalResource(sourceImage), ORIGIN).href : null;
  return { html: $.html(), image };
}

function localePage(html, language, image, review) {
  const $ = load(html);
  const copy = COPY[language];
  const route = `/${language}/`;
  const canonical = `${ORIGIN}${route}`;
  $("html").attr({ lang: language, "data-route-language": language, "data-public-locale-entry": "" });
  $('meta[property^="og:"],meta[name^="twitter:"],meta[name="description"],meta[name="robots"],meta[name="public-locale-indexing"],meta[name="author"],meta[http-equiv="refresh"],link[rel="canonical"],link[rel="alternate"],title').remove();
  const add = (tag, attributes, text) => {
    const node = $(`<${tag}>`).attr(attributes);
    if (text !== undefined) node.text(text);
    $("head").append(node);
  };
  add("title", {}, copy.brand);
  add("meta", { name: "description", content: copy.description });
  add("meta", { name: "robots", content: review.indexingAllowed ? "index,follow" : "noindex,follow" });
  if (review.indexingAllowed) add("meta", { name: "public-locale-indexing", content: JSON.stringify({
    schemaVersion: 1, contract: "validated-public-locale-build-v1", locales: ["ru", "en"],
    inputsSha256: review.inputsSha256, reviewSha256: review.reviewSha256,
    moduleSource: $('script[type="module"]').attr("src"),
  }) });
  add("link", { rel: "canonical", href: canonical });
  for (const locale of ["ru", "en"]) {
    add("link", { rel: "alternate", hreflang: locale, href: `${ORIGIN}/${locale}/` });
  }
  add("link", { rel: "alternate", hreflang: "x-default", href: `${ORIGIN}/` });
  for (const [property, content] of Object.entries({
    "og:type": "website", "og:locale": copy.ogLocale,
    "og:locale:alternate": COPY[language === "ru" ? "en" : "ru"].ogLocale,
    "og:site_name": copy.brand, "og:title": copy.brand,
    "og:description": copy.description, "og:url": canonical,
    ...(image ? { "og:image": image, "og:image:alt": copy.brand } : {}),
  })) add("meta", { property, content });
  for (const [name, content] of Object.entries({
    "twitter:card": "summary", "twitter:title": copy.brand,
    "twitter:description": copy.description,
    ...(image ? { "twitter:image": image, "twitter:image:alt": copy.brand } : {}),
  })) add("meta", { name, content });
  add("script", { type: "application/ld+json", "data-public-locale-structured-data": "" }, json(structuredData(language)));

  // This authored-copy fallback is a real entry to the existing React app;
  // it does not republish or certify any literary content or translation.
  const main = $("<main>").attr({
    class: "static-article-fallback static-home-fallback", "data-localized-home-fallback": "",
  });
  const article = $("<article>");
  const reviewedBody = review.indexingAllowed ? review.bodies[language] : null;
  article.append($("<h1>").text(reviewedBody?.heading ?? copy.brand));
  for (const paragraph of reviewedBody?.paragraphs ?? [copy.description]) article.append($("<p>").text(paragraph));
  const navigation = $("<nav>").attr("aria-label", reviewedBody?.navigationLabel ?? copy.navigation);
  const links = reviewedBody?.links ?? [
    { path: `${route}#atlas`, label: copy.globe }, { path: "/stati/", label: copy.journal }, { path: `${route}#books`, label: copy.books },
  ];
  for (const { path: href, label } of links) navigation.append($("<a>").attr("href", href).text(label));
  article.append(navigation);
  main.append(article);
  $("body").attr("lang", language).empty().append($("<div>").attr("id", "root").append(main));
  return `${$.html()}\n`;
}

function notFoundPage(html, language) {
  const $ = load(html);
  const copy = COPY[language];
  const canonical = `${ORIGIN}/${language}/404.html`;
  $("html").attr("data-public-locale-not-found", "");
  $('meta[name="public-locale-indexing"]').remove();
  $('meta[name="robots"]').attr("content", "noindex,follow");
  $('script, link[rel="modulepreload"], link[rel="preload"][as="script"]').remove();
  $("title").text(`404 · ${copy.brand}`);
  $('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]').attr("content", copy.error);
  $('meta[property="og:title"],meta[name="twitter:title"]').attr("content", `404 · ${copy.brand}`);
  $('link[rel="canonical"]').attr("href", canonical);
  $('meta[property="og:url"]').attr("content", canonical);
  for (const locale of ["ru", "en"]) $('link[hreflang="' + locale + '"]').attr("href", `${ORIGIN}/${locale}/404.html`);
  $('link[hreflang="x-default"]').attr("href", `${ORIGIN}/404.html`);
  const main = $("<main>").attr({ class: "static-article-fallback", "data-localized-not-found": "" });
  const article = $("<article>");
  article.append($("<h1>").text(`404 · ${copy.brand}`));
  article.append($("<p>").text(copy.error));
  const navigation = $("<nav>").attr("aria-label", copy.navigation);
  for (const [href, label] of [[`/${language}/`, copy.home], ["/stati/", copy.journal], [`/${language}/#atlas`, copy.globe]]) {
    navigation.append($("<a>").attr("href", href).text(label));
  }
  article.append(navigation); main.append(article); $("#root").empty().append(main);
  return `${$.html()}\n`;
}

/** The filesystem writer independently captures sourceSnapshot. This pure
 * renderer validates the supplied contract; it cannot verify declared files. */
export function generatePublicLocalePages({ builtHtml, releaseReady = false, sourceSnapshot, review, provisionedReviewSha256 }) {
  if (releaseReady !== false) {
    throw new Error("Public locale indexing requires a validated bilingual review-artifact contract; product releaseReady remains false");
  }
  const canonical = parseCanonicalHome(builtHtml);
  const files = {};
  let evaluation = { indexingAllowed: false, diagnostics: ["review-missing"] };
  if (review !== undefined || provisionedReviewSha256 !== undefined) {
    evaluation = evaluatePublicLocaleReview({ snapshot: sourceSnapshot, review, provisionedReviewSha256 });
    const expectedCopy = publicLocaleCopyInput();
    const actualHtml = createHash("sha256").update(builtHtml).digest("hex");
    if (sourceSnapshot?.builtHtml?.sha256 !== actualHtml || sourceSnapshot?.builtHtml?.bytes !== Buffer.byteLength(builtHtml)
      || !sourceSnapshot?.copy?.some(entry => entry.path === expectedCopy.path && entry.bytes === expectedCopy.bytes && entry.sha256 === expectedCopy.sha256)) {
      evaluation = { ...evaluation, indexingAllowed: false, bodies: null,
        diagnostics: [...evaluation.diagnostics, "renderer-inputs-mismatch"] };
    }
  }
  const reviewGate = { state: evaluation.indexingAllowed ? "VALIDATED_LOCAL_PAGE_INDEXING" : "OPEN", releaseReady: false,
    indexingAllowed: evaluation.indexingAllowed, scope: "public-localized-homepages-only",
    reviewerAuthentication: "not-performed", diagnostics: evaluation.diagnostics,
    ...(evaluation.inputsSha256 ? { inputsSha256: evaluation.inputsSha256 } : {}),
    ...(evaluation.reviewSha256 ? { reviewSha256: evaluation.reviewSha256 } : {}), requiredEvidence: [
    "reviewed-bilingual-critical-content", "source-bound-editorial-review", "validated-release-artifact",
  ] };
  const excluded = [];
  const entries = [];
  for (const locale of ["ru", "en"]) {
    const home = localePage(canonical.html, locale, canonical.image, evaluation);
    files[`${locale}/index.html`] = home;
    files[`${locale}/404.html`] = notFoundPage(home, locale);
    files[`${locale}/structured-data.json`] = json(structuredData(locale));
    const candidates = [
      ...(!evaluation.indexingAllowed ? [{ url: `${ORIGIN}/${locale}/`, locale, kind: "home", reason: "bilingual-release-gates-open" }] : []),
      { url: `${ORIGIN}/${locale}/404.html`, locale, kind: "not-found", reason: "error-page-never-indexable" },
    ];
    files[`${locale}/sitemap.preparation.json`] = json({ schemaVersion: 1,
      generatedBy: "public-locale-pages", recordType: "localized-sitemap-preparation", locale,
      reviewGate, indexableEntries: evaluation.indexingAllowed ? [`${ORIGIN}/${locale}/`] : [], excludedCandidates: candidates,
      alternates: { ru: `${ORIGIN}/ru/`, en: `${ORIGIN}/en/`, "x-default": `${ORIGIN}/` },
    });
    excluded.push(...candidates);
    if (evaluation.indexingAllowed) entries.push({ url: `${ORIGIN}/${locale}/`, locale, kind: "home" });
  }
  // An owned empty XML is also written on withdrawal by the filesystem writer.
  // The canonical root sitemap is never edited or silently linked here.
  if (evaluation.indexingAllowed) files["sitemap-locales.xml"] = publicLocaleSitemapXml(entries);
  return {
    files,
    sitemap: { version: 1, reviewGate, entries, excluded },
    notFound: { ru: "/ru/404.html", en: "/en/404.html", hostStatusRoutingConfigured: false },
  };
}

export function publicLocaleSitemapXml(entries = []) {
  const urls = entries.map(entry => `  <url><loc>${entry.url}</loc>`
    + ["ru", "en", "x-default"].map(locale => `<xhtml:link rel="alternate" hreflang="${locale}" href="${ORIGIN}/${locale === "x-default" ? "" : `${locale}/`}"/>`).join("")
    + "</url>");
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
    + urls.join("\n") + "\n</urlset>\n";
}
