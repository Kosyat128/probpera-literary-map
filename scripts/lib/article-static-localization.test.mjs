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
  it("writes an approved English slug and marks it as an English route", () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), "probpera-article-build-"));
    temporaryRoots.push(fixtureRoot);
    mkdirSync(path.join(fixtureRoot, "dist"), { recursive: true });
    writeFileSync(
      path.join(fixtureRoot, "dist", "index.html"),
      '<!doctype html><html lang="ru"><head><title>Fixture</title><meta name="description" content=""><meta name="robots" content="index,follow"><meta property="og:type" content=""><meta property="og:title" content=""><meta property="og:description" content=""><meta property="og:image" content=""><meta property="og:url" content="https://stale.example/old/"><link rel="canonical" href=""><link rel="alternate" type="application/rss+xml" href=""><script type="application/ld+json">{"url":"https://stale.example/old/"}</script></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>',
      "utf8"
    );
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
      canonicalUrl: null,
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
          '<h2>Русский раздел</h2><p>Русский текст со <a href="https://example.test/read/page-article/fixture-related/1">ссылкой на связанный материал</a>.</p>',
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
    expect(englishHtml).toContain('lang="en"');
    expect(englishHtml).toContain('data-route-language="en"');
    expect(englishHtml).toContain("Editor-approved English text.");
    expect(englishHtml).not.toContain("Русский текст.");
    expect(englishHtml).not.toContain("stale.example");
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
