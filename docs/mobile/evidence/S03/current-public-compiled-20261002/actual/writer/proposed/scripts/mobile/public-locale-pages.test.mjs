import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, realpath, rm, access, symlink, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import * as ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import { generatePublicLocalePages, publicLocaleCopyInput } from "./public-locale-pages.mjs";
import { writePublicLocalePages, capturePublicLocaleSourceSnapshot } from "./write-public-locale-pages.mjs";
import { createPublicLocaleReviewSnapshot, publicLocaleReviewDigest } from "./public-locale-review.mjs";
import { generatePlanetAccountPages } from "./account-pages.mjs";

const builtHtml = `<!doctype html><html lang="ru" data-react-shell><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#4b087c"><meta name="robots" content="index,follow">
<meta name="description" content="Old Russian homepage description"><meta name="author" content="Old author">
<title>Old homepage</title><link rel="canonical" href="https://probpera.ru/">
<meta property="og:image" content="https://probpera.ru/og-v3.webp"><meta property="og:title" content="Old title">
<meta name="twitter:title" content="Old title"><meta name="twitter:image" content="/og-v3.webp">
<link rel="alternate" type="application/rss+xml" href="/rss.xml"><link rel="alternate" hreflang="ru" href="/">
<link rel="manifest" href="/site.webmanifest"><link rel="icon" href="/brand/probpera-logo.png">
<style data-home-prepaint>#root>[data-static-seo]{visibility:hidden}</style>
<script type="application/ld+json">{"name":"Old article claims","inLanguage":"ru-RU"}</script>
<script type="module" crossorigin src="/assets/main-123.js"></script>
<link rel="stylesheet" href="/assets/main-123.css"><link rel="modulepreload" crossorigin href="/assets/vendor-123.js">
</head><body lang="ru"><div id="root"><main data-static-seo>Old unreviewed article list</main></div></body></html>`;

// Synthetic contract fixtures only; no actual editorial or owner approval.
function approvedFixture(snapshot) {
  const approval = { status: "approved", identity: "synthetic-test-reviewer", reviewedAt: "2026-09-14", evidenceRef: "fixture-only" };
  return { schemaVersion: 1, contract: "public-locale-review-v1", inputs: snapshot,
    inputsSha256: publicLocaleReviewDigest(snapshot), ownerReview: { ...approval }, locales: {
      ru: { editorialReview: { ...approval }, body: { heading: "Тестовая планета", paragraphs: ["Тестовое описание литературной планеты."],
        navigationLabel: "Тестовая навигация", links: [{ path: "/ru/#atlas", label: "Открыть планету" }] } },
      en: { editorialReview: { ...approval }, body: { heading: "Test planet", paragraphs: ["A synthetic description of the literary planet."],
        navigationLabel: "Test navigation", links: [{ path: "/en/#atlas", label: "Open the planet" }] } },
    } };
}

function pureReviewFixture() {
  const record = path => ({ path, bytes: 1, sha256: "1".repeat(64) });
  const sourceSnapshot = createPublicLocaleReviewSnapshot({ builtHtml, assets: [record("assets/main-123.js")],
    content: [record("catalog.json")], copy: [publicLocaleCopyInput()] });
  const review = approvedFixture(sourceSnapshot);
  return { builtHtml, sourceSnapshot, review, provisionedReviewSha256: publicLocaleReviewDigest(review) };
}

function interfaceDictionary() {
  const source = ts.createSourceFile("InterfaceLanguage.tsx", readFileSync(new URL("../../src/i18n/InterfaceLanguage.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "englishInterfaceText") initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) throw new Error("Canonical interface dictionary missing");
  return Object.fromEntries(initializer.properties.flatMap(property => {
    if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.initializer)) return [];
    const name = ts.isStringLiteralLike(property.name) ? property.name.text : property.name.getText(source);
    return [[name, property.initializer.text]];
  }));
}

describe("public RU/EN canonical homepage preparation", () => {
  it("renders explicitly provisioned source-exact reviewed bodies and reciprocal XML without releasing the product", () => {
    const input = pureReviewFixture(); const result = generatePublicLocalePages(input);
    expect(result.sitemap.reviewGate).toMatchObject({ indexingAllowed: true, releaseReady: false, reviewerAuthentication: "not-performed" });
    for (const locale of ["ru", "en"]) {
      const $ = load(result.files[`${locale}/index.html`]);
      expect($("h1").text()).toBe(input.review.locales[locale].body.heading);
      expect($("main p").text()).toBe(input.review.locales[locale].body.paragraphs[0]);
      expect($('meta[name="robots"]').attr("content")).toBe("index,follow");
      expect(JSON.parse($('meta[name="public-locale-indexing"]').attr("content")))
        .toMatchObject({ contract: "validated-public-locale-build-v1", inputsSha256: input.review.inputsSha256, moduleSource: "/assets/main-123.js" });
      const recovery = load(result.files[`${locale}/404.html`]);
      expect(recovery('meta[name="robots"]').attr("content")).toBe("noindex,follow");
      expect(recovery('meta[name="public-locale-indexing"]')).toHaveLength(0);
    }
    const xml = load(result.files["sitemap-locales.xml"], { xmlMode: true });
    expect(xml("url > loc").map((_, node) => xml(node).text()).get()).toEqual(["https://probpera.ru/ru/", "https://probpera.ru/en/"]);
    expect(xml("url").first().children().filter((_, node) => node.name === "xhtml:link").map((_, node) => xml(node).attr("hreflang")).get())
      .toEqual(["ru", "en", "x-default"]);
  });

  it.each(["stale-html", "stale-copy", "missing-pin", "rejected", "partial", "unsafe-body"])("keeps %s review fail-closed", mode => {
    const input = pureReviewFixture();
    if (mode === "stale-html") input.builtHtml = input.builtHtml.replace("Old homepage", "Changed homepage");
    if (mode === "stale-copy") input.sourceSnapshot.copy[0].sha256 = "9".repeat(64);
    if (mode === "missing-pin") delete input.provisionedReviewSha256;
    if (mode === "rejected") input.review.locales.en.editorialReview.status = "rejected";
    if (mode === "partial") delete input.review.locales.en;
    if (mode === "unsafe-body") input.review.locales.en.body.paragraphs[0] = "<img src=x onerror=alert(1)>";
    if (["rejected", "partial", "unsafe-body"].includes(mode)) input.provisionedReviewSha256 = publicLocaleReviewDigest(input.review);
    const result = generatePublicLocalePages(input);
    expect(result.sitemap.reviewGate.indexingAllowed).toBe(false);
    expect(result.sitemap.reviewGate.diagnostics.length).toBeGreaterThan(0);
    expect(result.files["sitemap-locales.xml"]).toBeUndefined();
    expect(load(result.files["en/index.html"])('meta[name="robots"]').attr("content")).toBe("noindex,follow");
  });
  it("returns two locale homes, recovery pages and schema/sitemap artifacts while excluding all drafts", () => {
    const result = generatePublicLocalePages({ builtHtml });
    expect(Object.keys(result.files)).toEqual(["ru/index.html", "ru/404.html", "ru/structured-data.json", "ru/sitemap.preparation.json",
      "en/index.html", "en/404.html", "en/structured-data.json", "en/sitemap.preparation.json"]);
    expect(result.sitemap.entries).toEqual([]);
    expect(result.sitemap.excluded.map(entry => entry.url)).toEqual([
      "https://probpera.ru/ru/", "https://probpera.ru/ru/404.html", "https://probpera.ru/en/", "https://probpera.ru/en/404.html",
    ]);
    expect(result.sitemap.reviewGate).toMatchObject({ state: "OPEN", releaseReady: false });
    expect(generatePublicLocalePages({ builtHtml })).toEqual(result);
  });

  it("uses only existing authored interface pairs for every visible fallback string and navigation label", () => {
    const { files } = generatePublicLocalePages({ builtHtml });
    const ru = load(files["ru/index.html"]), en = load(files["en/index.html"]);
    const dictionary = interfaceDictionary();
    for (const selector of ["h1", "main p", "nav a:nth-child(1)", "nav a:nth-child(2)", "nav a:nth-child(3)"]) {
      expect(dictionary[ru(selector).text()]).toBe(en(selector).text());
      expect(en(selector).text()).not.toBe("");
    }
    expect(dictionary[ru("nav").attr("aria-label")]).toBe(en("nav").attr("aria-label"));
  });

  it.each(["ru", "en"])("sets %s metadata and body language before the shared app hydrates", locale => {
    const { files } = generatePublicLocalePages({ builtHtml });
    const $ = load(files[`${locale}/index.html`]);
    const brand = locale === "ru" ? "Проба Пера" : "Proba Pera";
    const description = locale === "ru" ? "Литературный журнал и энциклопедия" : "Literary journal and encyclopedia";
    expect($("html").attr("lang")).toBe(locale);
    expect($("html").attr("data-route-language")).toBe(locale);
    expect($("body").attr("lang")).toBe(locale);
    expect($("title").text()).toBe(brand);
    expect($("h1").text()).toBe(brand);
    expect($('meta[name="description"]').attr("content")).toBe(description);
    expect($('meta[property="og:description"]').attr("content")).toBe(description);
    expect($('meta[name="twitter:description"]').attr("content")).toBe(description);
    expect($('meta[property="og:title"]').attr("content")).toBe(brand);
    expect($('meta[name="twitter:title"]').attr("content")).toBe(brand);
    expect($('meta[property="og:locale"]').attr("content")).toBe(locale === "ru" ? "ru_RU" : "en_US");
    expect($('link[rel="canonical"]').attr("href")).toBe(`https://probpera.ru/${locale}/`);
    expect($('meta[property="og:url"]').attr("content")).toBe(`https://probpera.ru/${locale}/`);
    expect($('meta[name="robots"]').attr("content")).toBe("noindex,follow");
    expect($("#root > main[data-localized-home-fallback]")).toHaveLength(1);
    expect($("[data-static-seo]")).toHaveLength(0);
    if (locale === "en") expect($("body").text()).not.toMatch(/\p{Script=Cyrillic}/u);
  });

  it("provides reciprocal RU/EN alternatives, with the canonical root as x-default", () => {
    const { files } = generatePublicLocalePages({ builtHtml });
    for (const html of [files["ru/index.html"], files["en/index.html"]]) {
      const $ = load(html);
      expect($('link[rel="alternate"]').map((_, node) => `${$(node).attr("hreflang")} ${$(node).attr("href")}`).get()).toEqual([
        "ru https://probpera.ru/ru/", "en https://probpera.ru/en/", "x-default https://probpera.ru/",
      ]);
    }
  });

  it("preserves the exact canonical runtime, CSS and existing site manifest without another app", () => {
    const { files } = generatePublicLocalePages({ builtHtml });
    for (const html of [files["ru/index.html"], files["en/index.html"]]) {
      const $ = load(html);
      expect($('script:not([type="application/ld+json"])')).toHaveLength(1);
      expect($('script[type="module"]').attr("src")).toBe("/assets/main-123.js");
      expect($('script[type="module"]').text()).toBe("");
      expect($('script[type="application/ld+json"]')).toHaveLength(1);
      expect($('link[rel="stylesheet"]').attr("href")).toBe("/assets/main-123.css");
      expect($('link[rel="modulepreload"]').attr("href")).toBe("/assets/vendor-123.js");
      expect($('link[rel="manifest"]').attr("href")).toBe("/site.webmanifest");
      expect($('meta[name="theme-color"]').attr("content")).toBe("#4b087c");
      expect($('meta[property="og:image"]').attr("content")).toBe("https://probpera.ru/og-v3.webp");
      expect(html).not.toContain("/planet/");
    }
  });

  it("removes stale article fallbacks, structured claims and Russian RSS metadata", () => {
    const { files } = generatePublicLocalePages({ builtHtml });
    for (const html of [files["ru/index.html"], files["en/index.html"]]) {
      expect(html).not.toMatch(/Old |rss\.xml|Old author/u);
      const $ = load(html);
      expect($('link[rel="canonical"],meta[property="og:title"],meta[name="twitter:title"]')).toHaveLength(3);
      expect($("a").map((_, node) => $(node).attr("href")).get()).toContain("/stati/");
    }
  });

  it.each(["ru", "en"])("emits matching %s JSON-LD using one canonical WebSite identity and existing UI copy", locale => {
    const result = generatePublicLocalePages({ builtHtml }); const $ = load(result.files[`${locale}/index.html`]);
    const schema = JSON.parse($('script[data-public-locale-structured-data]').text());
    expect(schema).toEqual(JSON.parse(result.files[`${locale}/structured-data.json`]));
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@graph"].map(node => node["@type"])).toEqual(["WebSite", "WebPage"]);
    const [site, page] = schema["@graph"];
    expect(site).toEqual({ "@type": "WebSite", "@id": "https://probpera.ru/#website", url: "https://probpera.ru/", name: $("h1").text(), inLanguage: locale });
    expect(page).toEqual({ "@type": "WebPage", "@id": `https://probpera.ru/${locale}/#webpage`, url: `https://probpera.ru/${locale}/`,
      name: $("h1").text(), description: $("main p").text(), inLanguage: locale, isPartOf: { "@id": site["@id"] } });
    expect(result.files[`${locale}/structured-data.json`]).not.toMatch(/Article|Person|SearchAction|datePublished|price|approved/u);
    const preparation = JSON.parse(result.files[`${locale}/sitemap.preparation.json`]);
    expect(preparation.locale).toBe(locale);
    expect(preparation.reviewGate).toEqual(result.sitemap.reviewGate);
    expect(preparation.indexableEntries).toEqual([]);
    expect(preparation.excludedCandidates).toEqual(result.sitemap.excluded.filter(entry => entry.locale === locale));
  });

  it("provides localized static 404 recovery using authored dictionary pairs and no executable runtime", () => {
    const result = generatePublicLocalePages({ builtHtml }); const dictionary = interfaceDictionary();
    const ru = load(result.files["ru/404.html"]), en = load(result.files["en/404.html"]);
    for (const selector of ["main p", "nav a:nth-child(1)", "nav a:nth-child(2)", "nav a:nth-child(3)"]) {
      expect(dictionary[ru(selector).text()]).toBe(en(selector).text());
    }
    for (const locale of ["ru", "en"]) {
      const $ = locale === "ru" ? ru : en;
      expect($("html").attr("lang")).toBe(locale); expect($("body").attr("lang")).toBe(locale);
      expect($("h1").text()).toContain("404"); expect($("script")).toHaveLength(0);
      expect($('link[rel="modulepreload"]')).toHaveLength(0);
      expect($('meta[name="robots"]').attr("content")).toBe("noindex,follow");
      expect($('link[rel="canonical"]').attr("href")).toBe(`https://probpera.ru/${locale}/404.html`);
      expect($('link[hreflang="ru"]').attr("href")).toBe("https://probpera.ru/ru/404.html");
      expect($('link[hreflang="en"]').attr("href")).toBe("https://probpera.ru/en/404.html");
      expect($('link[rel="manifest"]').attr("href")).toBe("/site.webmanifest");
      expect($("nav a").first().attr("href")).toBe(`/${locale}/`);
    }
    expect(en("body").text()).not.toMatch(/\p{Script=Cyrillic}/u);
    expect(result.notFound).toEqual({ ru: "/ru/404.html", en: "/en/404.html", hostStatusRoutingConfigured: false });
  });

  it("resolves relative module, manifest and style references at the original site root", () => {
    const relative = builtHtml.replaceAll('="/assets/', '="./assets/').replace('href="/site.webmanifest"', 'href="site.webmanifest"');
    const { files } = generatePublicLocalePages({ builtHtml: relative });
    const $ = load(files["en/index.html"]);
    expect($("script").attr("src")).toBe("/assets/main-123.js");
    expect($('link[rel="stylesheet"]').attr("href")).toBe("/assets/main-123.css");
    expect($('link[rel="manifest"]').attr("href")).toBe("/site.webmanifest");
  });

  it.each([true, "true", 1, null, {}])("rejects releaseReady=%j without inventing reviewed approval", releaseReady => {
    expect(() => generatePublicLocalePages({ builtHtml, releaseReady, reviewArtifacts: { approved: true } }))
      .toThrow("review-artifact contract");
  });

  it.each([
    ["missing root", builtHtml.replace('id="root"', 'id="not-root"')],
    ["duplicate root", builtHtml.replace("</body>", '<div id="root"></div></body>')],
    ["missing manifest", builtHtml.replace('<link rel="manifest" href="/site.webmanifest">', "")],
    ["second manifest", builtHtml.replace("</head>", '<link rel="manifest" href="/other.webmanifest"></head>')],
    ["controlled manifest", builtHtml.replace("/site.webmanifest", "/planet/en/manifest.webmanifest")],
    ["remote module", builtHtml.replace("/assets/main-123.js", "https://remote.invalid/main.js")],
    ["remote CSS", builtHtml.replace("/assets/main-123.css", "//remote.invalid/main.css")],
    ["source module", builtHtml.replace("/assets/main-123.js", "/src/main.tsx")],
    ["inline script", builtHtml.replace("</head>", "<script>alert(1)</script></head>")],
    ["inline handler", builtHtml.replace('<body lang="ru">', '<body lang="ru" onload="doSomething()">')],
    ["base override", builtHtml.replace("</head>", '<base href="/different-root/"></head>')],
    ["unresolved Vite placeholder", builtHtml.replace("/site.webmanifest", "%BASE_URL%site.webmanifest")],
  ])("rejects %s instead of fabricating a valid canonical public artifact", (_, html) => {
    expect(() => generatePublicLocalePages({ builtHtml: html })).toThrow();
  });
});

describe("actual public locale artifact writer", () => {
  const base = fileURLToPath(new URL("../../.tmp/", import.meta.url));
  const directories = [];
  const sitemap = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://probpera.ru/</loc></url></urlset>';
  async function output(xml = sitemap) {
    await mkdir(base, { recursive: true });
    const directory = await mkdtemp(path.join(base, "public-locale-test-")); directories.push(directory);
    await writeFile(path.join(directory, "index.html"), builtHtml);
    await writeFile(path.join(directory, "404.html"), "existing-root-recovery");
    await writeFile(path.join(directory, "sitemap.xml"), xml);
    return directory;
  }
  async function completeOutput(xml = sitemap) {
    const directory = await output(xml);
    for (const [relative, bytes] of Object.entries({ "assets/main-123.js": "export {};", "assets/vendor-123.js": "export const fixture = true;",
      "assets/main-123.css": "body { color: black; }", "site.webmanifest": "{}", "brand/probpera-logo.png": "synthetic-image",
      "og-v3.webp": "synthetic-social-image", "catalog.json": '{"fixture":true}' })) {
      await mkdir(path.dirname(path.join(directory, relative)), { recursive: true });
      await writeFile(path.join(directory, relative), bytes);
    }
    return directory;
  }
  afterAll(async () => {
    const resolvedBase = await realpath(base);
    for (const directory of directories) {
      const resolved = await realpath(directory); const relative = path.relative(resolvedBase, resolved);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Refuse cleanup outside fixture root");
      await rm(resolved, { recursive: true, force: true });
    }
  });

  it("writes locale artifacts and four account pages, preserves canonical source/root404/sitemap and safely repeats", async () => {
    const directory = await output(); const first = await writePublicLocalePages({ directory });
    expect(first.files).toHaveLength(12);
    expect(first.accountRoutes).toHaveLength(4);
    expect(await readFile(path.join(directory, "index.html"), "utf8")).toBe(builtHtml);
    expect(await readFile(path.join(directory, "404.html"), "utf8")).toBe("existing-root-recovery");
    expect(await readFile(path.join(directory, "sitemap.xml"), "utf8")).toBe(sitemap);
    const expected = generatePublicLocalePages({ builtHtml });
    for (const [file, content] of Object.entries(expected.files)) expect(await readFile(path.join(directory, file), "utf8")).toBe(content);
    for (const [file, content] of Object.entries(generatePlanetAccountPages({ builtHtml }).files)) expect(await readFile(path.join(directory, file), "utf8")).toBe(content);
    expect(await writePublicLocalePages({ directory })).toEqual(first);
    expect(JSON.parse(await readFile(path.join(directory, "locale-routes.json"), "utf8"))).toEqual(first);
  });

  it("independently hashes the complete build, remains stable across owned-output reruns, and withdraws owned XML", async () => {
    const directory = await completeOutput();
    const snapshot = await capturePublicLocaleSourceSnapshot({ directory });
    expect(snapshot.assets.map(entry => entry.path)).toContain("assets/vendor-123.js");
    expect(snapshot.content.map(entry => entry.path)).toContain("catalog.json");
    const review = approvedFixture(snapshot); const provisionedReviewSha256 = publicLocaleReviewDigest(review);
    const approved = await writePublicLocalePages({ directory, review, provisionedReviewSha256 });
    expect(approved.sitemap.reviewGate.indexingAllowed).toBe(true);
    expect(approved.artifacts.filter(entry => entry.indexable).map(entry => entry.path)).toEqual(["ru/index.html", "en/index.html"]);
    expect(await capturePublicLocaleSourceSnapshot({ directory })).toEqual(snapshot);
    expect(await writePublicLocalePages({ directory, review, provisionedReviewSha256 })).toEqual(approved);
    expect(await readFile(path.join(directory, "sitemap.xml"), "utf8")).toBe(sitemap);
    await writeFile(path.join(directory, "assets/vendor-123.js"), "export const fixture = false;");
    const stale = await writePublicLocalePages({ directory, review, provisionedReviewSha256 });
    expect(stale.sitemap.reviewGate).toMatchObject({ indexingAllowed: false, diagnostics: ["review-inputs-stale"] });
    expect(load(await readFile(path.join(directory, "sitemap-locales.xml"), "utf8"), { xmlMode: true })("url")).toHaveLength(0);
    expect(load(await readFile(path.join(directory, "en/index.html"), "utf8"))('meta[name="robots"]').attr("content")).toBe("noindex,follow");
    expect(load(await readFile(path.join(directory, "en/planet-account/index.html"), "utf8"))('meta[name="robots"]').attr("content")).toBe("noindex,nofollow");
  });

  it("captures every actual contained content file beyond the former 4096-entry ceiling", async () => {
    const directory = await completeOutput();
    const contentDirectory = path.join(directory, "catalog-expanded"); await mkdir(contentDirectory);
    const bytes = '{"synthetic":"expanded local capture"}';
    const names = Array.from({ length: 4097 }, (_, index) => `catalog-expanded/${String(index).padStart(5, "0")}.json`);
    for (let offset = 0; offset < names.length; offset += 64) {
      await Promise.all(names.slice(offset, offset + 64).map(name => writeFile(path.join(directory, name), bytes)));
    }
    const snapshot = await capturePublicLocaleSourceSnapshot({ directory });
    const actual = snapshot.content.filter(entry => entry.path.startsWith("catalog-expanded/"));
    expect(actual.map(entry => entry.path)).toEqual(names);
    const expectedDigest = createHash("sha256").update(bytes).digest("hex");
    expect(actual.every(entry => entry.sha256 === expectedDigest && entry.bytes === Buffer.byteLength(bytes))).toBe(true);
    expect(snapshot.content.map(entry => entry.path)).toContain("catalog.json");
    expect(publicLocaleReviewDigest(snapshot)).toMatch(/^[a-f0-9]{64}$/u);
  }, 60_000);

  it.each([
    ['meta[property="og:image"]', "./social-preview.webp"],
    ['meta[name="twitter:image"]', "https://probpera.ru/social-preview.webp"],
  ])("requires the actual contained social image selected by %s", async (selector, reference) => {
    const directory = await completeOutput();
    const $ = load(builtHtml); $(selector).attr("content", reference);
    await writeFile(path.join(directory, "index.html"), $.html());
    await expect(capturePublicLocaleSourceSnapshot({ directory })).rejects.toThrow("missing or noncanonical build input");
    await writeFile(path.join(directory, "social-preview.webp"), "synthetic-additional-social-image");
    const snapshot = await capturePublicLocaleSourceSnapshot({ directory });
    expect(snapshot.content.map(entry => entry.path)).toContain("social-preview.webp");
  });

  it("binds new unrelated localized content and detects missing entry runtime files", async () => {
    const directory = await completeOutput();
    const review = approvedFixture(await capturePublicLocaleSourceSnapshot({ directory }));
    const provisionedReviewSha256 = publicLocaleReviewDigest(review);
    await mkdir(path.join(directory, "en"));
    await writeFile(path.join(directory, "en/existing-editorial.json"), '{"existing":true}');
    const stale = await writePublicLocalePages({ directory, review, provisionedReviewSha256 });
    expect(stale.sitemap.reviewGate.diagnostics).toContain("review-inputs-stale");
    expect((await capturePublicLocaleSourceSnapshot({ directory })).content.map(entry => entry.path)).toContain("en/existing-editorial.json");
    await unlink(path.join(directory, "assets/main-123.js"));
    const incomplete = await writePublicLocalePages({ directory, review, provisionedReviewSha256 });
    expect(incomplete.sitemap.reviewGate.indexingAllowed).toBe(false);
    expect(incomplete.sitemap.reviewGate.diagnostics.join(" ")).toContain("missing or noncanonical build input");
  });

  it("validates owned XML replacements through the root sitemap graph when review is withdrawn", async () => {
    const index = '<sitemapindex><sitemap><loc>https://probpera.ru/sitemap-locales.xml</loc></sitemap></sitemapindex>';
    const directory = await completeOutput(index);
    const review = approvedFixture(await capturePublicLocaleSourceSnapshot({ directory }));
    await writePublicLocalePages({ directory, review, provisionedReviewSha256: publicLocaleReviewDigest(review) });
    const withdrawn = await writePublicLocalePages({ directory });
    expect(withdrawn.checkedSitemaps).toBe(2);
    expect(withdrawn.sitemap.entries).toEqual([]);
    expect(await readFile(path.join(directory, "sitemap.xml"), "utf8")).toBe(index);
    expect(load(await readFile(path.join(directory, "sitemap-locales.xml"), "utf8"), { xmlMode: true })("url")).toHaveLength(0);
  });

  it("permits only reviewed canonical homes already in the root sitemap and rejects withdrawal before writes", async () => {
    const xml = '<urlset><url><loc>https://probpera.ru/en/</loc></url></urlset>';
    const directory = await completeOutput(xml);
    const review = approvedFixture(await capturePublicLocaleSourceSnapshot({ directory }));
    await writePublicLocalePages({ directory, review, provisionedReviewSha256: publicLocaleReviewDigest(review) });
    await expect(writePublicLocalePages({ directory })).rejects.toThrow("Unreviewed locale shell");
    expect(await readFile(path.join(directory, "sitemap.xml"), "utf8")).toBe(xml);
  });

  it("does not overwrite or ignore an unowned localized XML file", async () => {
    const directory = await output();
    const xml = '<urlset><url><loc>https://probpera.ru/en/</loc></url></urlset>';
    await writeFile(path.join(directory, "sitemap-locales.xml"), xml);
    await expect(writePublicLocalePages({ directory })).rejects.toThrow("unowned or changed locale artifact");
    expect(await readFile(path.join(directory, "sitemap-locales.xml"), "utf8")).toBe(xml);
  });

  it.each(["https://probpera.ru/en/", "https://probpera.ru/ru/404.html", "https://probpera.ru/%65n/?q=1",
    "https://probpera.ru/en/planet-account/", "https://probpera.ru/ru/delete-account", "https://probpera.ru/en/delete-account/index.html",
    "https://probpera.ru/en/%70lanet-account/?returnTo=%2Fplanet%2Fen%2F"])("rejects indexable draft %s before writing any locale file", async url => {
    const directory = await output(`<urlset><url><loc>\n ${url}\n </loc></url></urlset>`);
    await expect(writePublicLocalePages({ directory })).rejects.toThrow("Unreviewed locale shell");
    await expect(access(path.join(directory, "ru"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("checks a sitemap index's real child files and does not hide drafts in a child sitemap", async () => {
    const directory = await output('<sitemapindex><sitemap><loc>https://probpera.ru/child.xml</loc></sitemap></sitemapindex>');
    await writeFile(path.join(directory, "child.xml"), '<urlset><url><loc>https://probpera.ru/en/</loc></url></urlset>');
    await expect(writePublicLocalePages({ directory })).rejects.toThrow("Unreviewed locale shell");
    await expect(access(path.join(directory, "ru"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses an existing unrelated recovery page or modified JSON artifact before overwriting homes", async () => {
    const directory = await output(); await mkdir(path.join(directory, "en"));
    await writeFile(path.join(directory, "en/404.html"), "unrelated-existing-page");
    await expect(writePublicLocalePages({ directory })).rejects.toThrow("non-generated public locale page");
    await expect(access(path.join(directory, "ru"))).rejects.toMatchObject({ code: "ENOENT" });
    const owned = await output(); await writePublicLocalePages({ directory: owned });
    await writeFile(path.join(owned, "en/structured-data.json"), '{"changed":true}');
    await expect(writePublicLocalePages({ directory: owned })).rejects.toThrow("unowned or changed locale artifact");
    expect(await readFile(path.join(owned, "en/structured-data.json"), "utf8")).toBe('{"changed":true}');
  });

  it("rejects a nested account output junction before creating files through it", async () => {
    const directory = await output(), linkedTarget = await output();
    await mkdir(path.join(directory, "en"));
    const link = path.join(directory, "en/planet-account");
    await symlink(linkedTarget, link, process.platform === "win32" ? "junction" : "dir");
    try {
      await expect(writePublicLocalePages({ directory })).rejects.toThrow("Linked locale output directory");
      expect(await readFile(path.join(linkedTarget, "index.html"), "utf8")).toBe(builtHtml);
      await expect(access(path.join(directory, "ru"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally { await unlink(link); }
  });

  it("does not replace an unrelated existing account page even when sibling locale homes are generated", async () => {
    const directory = await output(); await mkdir(path.join(directory, "en/planet-account"), { recursive: true });
    const filename = path.join(directory, "en/planet-account/index.html");
    await writeFile(filename, "existing-account-route-owner");
    await expect(writePublicLocalePages({ directory })).rejects.toThrow("non-generated public locale page");
    expect(await readFile(filename, "utf8")).toBe("existing-account-route-owner");
    await expect(access(path.join(directory, "ru"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
