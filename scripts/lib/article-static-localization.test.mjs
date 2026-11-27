import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { load } from "cheerio";
import { afterEach, describe, expect, it } from "vitest";

const temporaryRoots = [];

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

afterEach(() => {
  while (temporaryRoots.length) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

describe("localized static article pages", () => {
  it("rejects a fixture-shaped build root outside the directly approved temporary boundary", () => {
    const outside = mkdtempSync(path.join(tmpdir(), "probpera-outside-"));
    temporaryRoots.push(outside);
    const nested = mkdtempSync(path.join(outside, "probpera-article-build-"));
    const build = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "build-article-pages.mjs")], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, ARTICLE_BUILD_PROJECT_ROOT: nested },
    });
    expect(build.error).toBeUndefined();
    expect(build.status).toBe(1);
    expect(build.stderr).toContain("ARTICLE_BUILD_PROJECT_ROOT must refer to a temporary article-build fixture.");
    expect(existsSync(path.join(nested, "dist"))).toBe(false);
  });

  it("writes an approved English slug and marks it as an English route", () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), "probpera-article-build-"));
    temporaryRoots.push(fixtureRoot);
    // Rendering fixtures must never enter the release-only pruning step.
    writeJson(path.join(fixtureRoot, "reports", "public-image-delivery.json"), { version: 1, completed: false });
    mkdirSync(path.join(fixtureRoot, "dist"), { recursive: true });
    writeFileSync(
      path.join(fixtureRoot, "dist", "index.html"),
      '<!doctype html><html lang="ru"><head><title>Fixture</title><meta name="description" content=""><meta name="robots" content="index,follow"><meta property="og:type" content=""><meta property="og:title" content=""><meta property="og:description" content=""><meta property="og:image" content=""><meta name="twitter:image" content=""><meta property="og:url" content="https://stale.example/old/"><link rel="canonical" href=""><link rel="alternate" type="application/rss+xml" href=""><script type="application/ld+json">{"url":"https://stale.example/old/"}</script></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>',
      "utf8"
    );
    const sourcePrefix = "https://sjqejjmwpzfsczxdghvw.supabase.co/storage/v1/object/public/editorial-media/2026/11/";
    const leadSource = `${sourcePrefix}first.jpg`;
    const inlineSource = `${sourcePrefix}second.jpg`;
    const missingSource = `${sourcePrefix}missing.jpg`;
    const coverSource = `${sourcePrefix}cover.jpg`;
    const optimizedCover = "media/optimized/aaaaaaaaaaaaaaaaaaaaaaaa-1280w.webp";
    const optimizedLead = "media/optimized/bbbbbbbbbbbbbbbbbbbbbbbb-1280w.webp";
    const optimizedInline = "media/optimized/cccccccccccccccccccccccc-1280w.webp";
    const inlineThumb = "media/optimized/cccccccccccccccccccccccc-640w.webp";
    const absentRendition = "media/optimized/dddddddddddddddddddddddd-1280w.webp";
    const variant = (src, width = 1280) => ({ src, width, height: width / 2 });
    writeJson(path.join(fixtureRoot, "src/data/imageDelivery.generated.json"), {
      [leadSource]: { ...variant(optimizedLead), variants: [] },
      [coverSource]: { ...variant(optimizedCover), variants: [] },
      [inlineSource]: { ...variant(optimizedInline), variants: [variant(inlineThumb, 640)] },
      [missingSource]: { ...variant(absentRendition), variants: [] },
    });
    mkdirSync(path.join(fixtureRoot, "dist/media/optimized"), { recursive: true });
    for (const file of [optimizedLead, optimizedCover, optimizedInline, inlineThumb]) {
      writeFileSync(path.join(fixtureRoot, "dist", file), "test rendition");
    }
    const sharedDescription =
      "Общее редакционное описание, намеренно повторённое для проверки уникальности итоговых метаданных.";
    const legacyArticle = {
      id: "page--article--fixture--related--1",
      url: "https://example.test/read/page-article/fixture-related/1",
      slug: "fixture-related-article",
      title: "Связанный материал для проверки",
      description: sharedDescription,
      seoDescription: sharedDescription,
      sectionId: "writers-world",
      sectionLabel: "Писатели мира",
      publishedLabel: "Опубликовано: 7 августа 2026",
      publishedAt: "2026-08-07T10:00:00.000Z",
      readingMinutes: 2,
      wordCount: 180,
      headingCount: 1,
      allowIndexing: true,
    };
    writeJson(
      path.join(fixtureRoot, "public", "articles", "index.json"),
      [legacyArticle]
    );
    writeJson(
      path.join(
        fixtureRoot,
        "public",
        "articles",
        "page--article--fixture--related--1.json"
      ),
      {
        ...legacyArticle,
        headings: [{ id: "legacy", level: 2, text: "Связанный раздел" }],
        contentHtml:
          "<h2>Связанный раздел</h2><p>Самостоятельный текст связанного материала для поисковой проверки.</p>",
        plainText:
          "Связанный раздел. Самостоятельный текст связанного материала для поисковой проверки.",
      }
    );

    const englishTranslation = {
      locale: "en",
      title: "A Reviewed English Article",
      description:
        "This reviewed English summary explains the subject clearly for readers.",
      sectionLabel: "Literary essays",
      publishedLabel: "Published: 8 August 2026",
      publishedAt: "2026-08-08T10:00:00.000Z",
      readingMinutes: 2,
      wordCount: 220,
      headingCount: 1,
      slug: "a-reviewed-english-article",
      canonicalUrl:
        "https://example.test/stati/pisateli-mira/a-reviewed-english-article",
      translationStatus: "approved",
      approvedAt: "2026-08-08T10:00:00.000Z",
    };
    const article = {
      id: "cms-fixture",
      source: "cms",
      url:
        "https://example.test/stati/pisateli-mira/zarubezhnye-klassiki-literatury-i-ih-professii/",
      canonicalUrl:
        "https://example.test/stati/pisateli-mira/zarubezhnye-klassiki-literatury-i-ih-professii/",
      slug: "zarubezhnye-klassiki-literatury-i-ih-professii",
      title: "Зарубежные классики литературы и их профессии",
      description: sharedDescription,
      seoDescription: sharedDescription,
      sectionId: "writers-world",
      sectionLabel: "Писатели мира",
      publishedLabel: "Опубликовано: 8 августа 2026",
      publishedAt: "2026-08-08T10:00:00.000Z",
      readingMinutes: 2,
      wordCount: 200,
      headingCount: 1,
      imageUrl: coverSource,
      documentPath: "cms/articles/cms-fixture.json",
      allowIndexing: true,
      translations: { en: englishTranslation },
    };
    writeJson(
      path.join(fixtureRoot, "public", "cms", "published-content.json"),
      { articles: [article], pages: [], redirects: [] }
    );
    writeJson(
      path.join(fixtureRoot, "public", "cms", "articles", "cms-fixture.json"),
      {
        ...article,
        headings: [{ id: "ru", level: 2, text: "Русский раздел" }],
        contentHtml:
          `<p>Введение.</p><figure><img src="${leadSource}" alt="Ведущая иллюстрация"></figure><h2>Русский раздел</h2><p>Русский текст со <a href="https://example.test/read/page-article/fixture-related/1">ссылкой на связанный материал</a>.</p><figure><img src="${inlineSource}" alt="Вторая иллюстрация"><figcaption><a href="${inlineSource}">Источник</a></figcaption></figure><img src="${missingSource}" alt="Иллюстрация без копии">`,
        plainText: "Русский раздел Русский текст.",
        translations: {
          en: {
            ...englishTranslation,
            headings: [{ id: "en", level: 2, text: "English section" }],
            contentHtml:
              "<h2>English section</h2><p>Editor-approved English text.</p>",
            plainText: "English section Editor-approved English text.",
          },
        },
      }
    );

    const build = spawnSync(
      process.execPath,
      [path.join(process.cwd(), "scripts", "build-article-pages.mjs")],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          ARTICLE_BUILD_PROJECT_ROOT: fixtureRoot,
          PUBLIC_SITE_ORIGIN: "https://example.test",
          PUBLIC_SITE_BASE_PATH: "/",
        },
      }
    );

    expect(build.error).toBeUndefined();
    expect(build.stderr).toBe("");
    expect(build.status).toBe(0);

    const englishFile = path.join(
      fixtureRoot,
      "dist",
      "stati",
      "pisateli-mira",
      "a-reviewed-english-article",
      "index.html"
    );
    expect(existsSync(englishFile)).toBe(true);
    const englishHtml = readFileSync(englishFile, "utf8");
    const $english = load(englishHtml);
    const englishCanonicalUrl =
      "https://example.test/stati/pisateli-mira/a-reviewed-english-article/";
    expect(englishHtml).toContain('lang="en"');
    expect(englishHtml).toContain('data-route-language="en"');
    expect(englishHtml).toContain("Editor-approved English text.");
    expect(englishHtml).not.toContain("Русский текст.");
    expect(englishHtml).not.toContain("stale.example");
    expect($english('link[rel="canonical"]').attr("href")).toBe(
      englishCanonicalUrl
    );
    expect($english('meta[property="og:url"]').attr("content")).toBe(
      englishCanonicalUrl
    );
    const englishSchemaNodes = $english('script[type="application/ld+json"]')
      .toArray()
      .flatMap((element) => {
        const value = JSON.parse($english(element).text());
        return value["@graph"] || [value];
      });
    const englishSchemaTypes = new Set(
      englishSchemaNodes.map((node) => node["@type"])
    );
    expect(englishSchemaTypes.has("WebPage")).toBe(true);
    expect(englishSchemaTypes.has("Article")).toBe(true);
    expect(englishSchemaTypes.has("ImageObject")).toBe(true);
    expect(englishSchemaTypes.has("Organization")).toBe(true);
    expect(englishSchemaTypes.has("BreadcrumbList")).toBe(true);
    expect(englishSchemaNodes.find((node) => node["@id"] === `${englishCanonicalUrl}#primaryimage`)?.url).toBe(`https://example.test/${optimizedCover}`);
    expect($english('meta[property="og:image"]').attr("content")).toBe(`https://example.test/${optimizedCover}`);
    expect($english('meta[name="twitter:image"]').attr("content")).toBe(`https://example.test/${optimizedCover}`);
    expect(
      englishSchemaNodes.find((node) => node["@type"] === "Article")
        ?.mainEntityOfPage
    ).toEqual({ "@id": englishCanonicalUrl });
    expect($english('a[href*="/stati/"]').length).toBeGreaterThanOrEqual(3);
    expect(
      readFileSync(path.join(fixtureRoot, "dist", "index.html"), "utf8")
    ).not.toContain("stale.example");

    const russianFile = path.join(
      fixtureRoot,
      "dist",
      "stati",
      "pisateli-mira",
      "zarubezhnye-klassiki-literatury-i-ih-professii",
      "index.html"
    );
    const russianHtml = readFileSync(russianFile, "utf8");
    const $russian = load(russianHtml);
    expect(russianHtml).toContain(`href="${englishCanonicalUrl}"`);
    expect($russian('meta[property="og:image"]').attr("content")).toBe(`https://example.test/${optimizedCover}`);
    expect($russian('meta[name="twitter:image"]').attr("content")).toBe(`https://example.test/${optimizedCover}`);
    expect($russian('img[alt="Вторая иллюстрация"]').attr()).toMatchObject({
      src: `/${optimizedInline}`, srcset: `/${inlineThumb} 640w, /${optimizedInline} 1280w`,
    });
    const feed = load(readFileSync(path.join(fixtureRoot, "dist", "rss.xml"), "utf8"), { xml: true });
    const item = feed("item").filter((_index, entry) => feed(entry).children("link").text() === article.canonicalUrl);
    expect(item.children("media\\:content").attr("url")).toBe(leadSource);
    const feedHtml = load(item.children("content\\:encoded").text(), {}, false);
    expect(feedHtml('img[alt="Ведущая иллюстрация"]').attr("src")).toBe(leadSource);
    expect(feedHtml('img[alt="Вторая иллюстрация"]').attr("src")).toBe(`https://example.test/${optimizedInline}`);
    expect(feedHtml('img[alt="Иллюстрация без копии"]').attr("src")).toBe(missingSource);
    expect(feedHtml("figcaption a").attr("href")).toBe(inlineSource);
    const schemaTypes = new Set(
      $russian('script[type="application/ld+json"]')
        .toArray()
        .flatMap((element) => {
          const value = JSON.parse($russian(element).text());
          return value["@graph"] || [value];
        })
        .map((node) => node["@type"])
    );
    expect(schemaTypes.has("WebPage")).toBe(true);
    expect(schemaTypes.has("Article")).toBe(true);
    expect(schemaTypes.has("ImageObject")).toBe(true);
    expect(schemaTypes.has("Organization")).toBe(true);
    expect(schemaTypes.has("BreadcrumbList")).toBe(true);
    expect(russianHtml).toContain(
      'href="https://example.test/stati/pisateli-mira/fixture-related-article/"'
    );
    expect(russianHtml).not.toContain(
      'href="https://example.test/read/page-article/fixture-related/1"'
    );

    const journalFile = path.join(fixtureRoot, "dist", "stati", "index.html");
    const sectionFile = path.join(
      fixtureRoot,
      "dist",
      "stati",
      "pisateli-mira",
      "index.html"
    );
    expect(existsSync(journalFile)).toBe(true);
    expect(existsSync(sectionFile)).toBe(true);
    const journalHtml = readFileSync(journalFile, "utf8");
    const sectionHtml = readFileSync(sectionFile, "utf8");
    const $section = load(sectionHtml);
    const sectionSchemaTypes = new Set(
      $section('script[type="application/ld+json"]')
        .toArray()
        .flatMap((element) => {
          const value = JSON.parse($section(element).text());
          return value["@graph"] || [value];
        })
        .map((node) => node["@type"])
    );
    expect(sectionSchemaTypes.has("CollectionPage")).toBe(true);
    expect(sectionSchemaTypes.has("ItemList")).toBe(true);
    expect(sectionSchemaTypes.has("BreadcrumbList")).toBe(true);
    expect(journalHtml).toContain(
      '<link rel="canonical" href="https://example.test/stati/">'
    );
    expect(sectionHtml).toContain(
      '<link rel="canonical" href="https://example.test/stati/pisateli-mira/">'
    );
    expect(journalHtml).not.toContain('script type="module"');
    expect(sectionHtml).not.toContain('script type="module"');

    const $legacy = load(
      readFileSync(
        path.join(
          fixtureRoot,
          "dist",
          "stati",
          "pisateli-mira",
          "fixture-related-article",
          "index.html"
        ),
        "utf8"
      )
    );
    expect($russian('meta[name="description"]').attr("content")).not.toBe(
      $legacy('meta[name="description"]').attr("content")
    );

    const outdatedSectionAlias = path.join(
      fixtureRoot,
      "dist",
      "stati",
      "literaturnye-istorii",
      "zarubezhnye-klassiki-literatury-i-ih-professii",
      "index.html"
    );
    expect(existsSync(outdatedSectionAlias)).toBe(true);
    expect(readFileSync(outdatedSectionAlias, "utf8")).toContain(
      "https://example.test/stati/pisateli-mira/zarubezhnye-klassiki-literatury-i-ih-professii/"
    );
    const generatedRedirects = JSON.parse(
      readFileSync(path.join(fixtureRoot, "dist", "redirects.generated.json"), "utf8")
    );
    expect(generatedRedirects).toContainEqual(
      expect.objectContaining({
        source:
          "/stati/literaturnye-istorii/zarubezhnye-klassiki-literatury-i-ih-professii",
        destination:
          "/stati/pisateli-mira/zarubezhnye-klassiki-literatury-i-ih-professii",
        reason: "section-alias",
        server: false,
      })
    );
    expect(readFileSync(path.join(fixtureRoot, "dist", "_redirects"), "utf8")).not.toContain(
      "/stati/literaturnye-istorii/zarubezhnye-klassiki-literatury-i-ih-professii"
    );
    const headers = readFileSync(
      path.join(fixtureRoot, "dist", "_headers"),
      "utf8"
    );
    expect(headers).toContain(
      "frame-ancestors https://admin.probpera.ru;"
    );
    expect(headers).not.toContain("X-Frame-Options");
    expect(headers).not.toMatch(/frame-ancestors\s+[^;]*\*/u);
    expect(headers).not.toContain("frame-ancestors 'none'");
  });
});
