import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { planetAccountCopy } from "../../src/pwa/accountCopy.ts";
import { generatePlanetAccountPages } from "./account-pages.mjs";

const builtHtml = `<!doctype html><html><head><title>Old homepage</title>
<script type="module" crossorigin src="/assets/main-canonical.js"></script>
<link rel="stylesheet" href="/assets/main-canonical.css"><link rel="modulepreload" href="/assets/vendor.js">
<link rel="manifest" href="/site.webmanifest"><meta property="og:image" content="/og-v3.webp">
<script type="application/ld+json">{"name":"Old article"}</script></head>
<body><div id="root">Old article</div></body></html>`;

describe("canonical account and deletion page preparation", () => {
  const result = generatePlanetAccountPages({ builtHtml });
  it("emits exactly the four owned routes and excludes every page from indexing", () => {
    expect(Object.keys(result.files)).toEqual(["ru/planet-account/index.html", "ru/delete-account/index.html", "en/planet-account/index.html", "en/delete-account/index.html"]);
    expect(result.releaseReady).toBe(false);
    expect(result.excluded.map(entry => entry.url)).toEqual(result.routes.map(entry => entry.canonical));
    expect(result.routes.every(entry => entry.indexable === false)).toBe(true);
    expect(generatePlanetAccountPages({ builtHtml })).toEqual(result);
  });
  it.each(result.routes)("provides a localized, non-executable fallback for $pathname", route => {
    const $ = load(result.files[route.file]); const copy = planetAccountCopy.locales[route.locale];
    const title = route.mode === "access" ? copy.access : copy.deletion;
    expect($("html").attr("lang")).toBe(route.locale);
    expect($("html").attr("data-route-language")).toBe(route.locale);
    expect($("html").attr("data-copy-review")).toBe("draft");
    expect($("body").attr("lang")).toBe(route.locale);
    expect($("title").text()).toBe(title); expect($("h1").text()).toBe(title);
    expect($('meta[name="robots"]').attr("content")).toBe("noindex,nofollow");
    expect($('link[rel="canonical"]').attr("href")).toBe(route.canonical);
    expect($('meta[property="og:url"]').attr("content")).toBe(route.canonical);
    const name = route.mode === "access" ? "planet-account" : "delete-account";
    for (const locale of ["ru", "en"]) expect($(`link[hreflang="${locale}"]`).attr("href")).toBe(`https://probpera.ru/${locale}/${name}/`);
    expect($('link[hreflang="x-default"]').attr("href")).toBe("https://probpera.ru/");
    expect($('a[href="mailto:probperasite@yandex.ru"]').text()).toBe(copy.support);
    expect($("form,input,button,canvas,iframe")).toHaveLength(0);
    expect(result.files[route.file]).not.toContain("Old article");
    if (route.locale === "en") expect($("body").text()).not.toMatch(/\p{Script=Cyrillic}/u);
    if (route.mode === "deletion") expect($("body").text()).toContain(copy.disclosureUnavailable);
  });
  it.each(result.routes)("retains the same built app and site install identity for $pathname", route => {
    const $ = load(result.files[route.file]);
    expect($('script:not([type="application/ld+json"])')).toHaveLength(1);
    expect($('script[type="module"]').attr("src")).toBe("/assets/main-canonical.js");
    expect($('script[type="module"]').text()).toBe("");
    expect($('link[rel="stylesheet"]').attr("href")).toBe("/assets/main-canonical.css");
    expect($('link[rel="modulepreload"]').attr("href")).toBe("/assets/vendor.js");
    expect($('link[rel="manifest"]').attr("href")).toBe("/site.webmanifest");
    const schema = JSON.parse($('script[type="application/ld+json"]').text());
    expect(schema).toMatchObject({ "@type": "WebPage", "@id": route.canonical + "#webpage", url: route.canonical,
      inLanguage: route.locale, name: $("h1").text(), isPartOf: { "@id": "https://probpera.ru/#website" } });
    expect(Object.keys(schema).sort()).toEqual(["@context", "@id", "@type", "description", "inLanguage", "isPartOf", "name", "url"]);
    expect($('script[type="application/ld+json"]')).toHaveLength(1);
  });
});
