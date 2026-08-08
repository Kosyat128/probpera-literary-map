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
      '<!doctype html><html lang="ru"><head><title>Fixture</title><meta name="description" content=""><meta name="robots" content="index,follow"><meta property="og:type" content=""><meta property="og:title" content=""><meta property="og:description" content=""><meta property="og:image" content=""><link rel="canonical" href=""><link rel="alternate" type="application/rss+xml" href=""></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>',
      "utf8"
    );
    writeJson(path.join(fixtureRoot, "public", "articles", "index.json"), []);

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
      url: "https://example.test/stati/o-literature/russian-route/",
      canonicalUrl: "https://example.test/stati/o-literature/russian-route/",
      slug: "russian-route",
      title: "Русский заголовок",
      description: "Русское описание.",
      sectionId: "literary-essays",
      sectionLabel: "О литературе",
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
        contentHtml: "<h2>Русский раздел</h2><p>Русский текст.</p>",
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
      "o-literature",
      "a-reviewed-english-article",
      "index.html"
    );
    expect(existsSync(englishFile)).toBe(true);
    const englishHtml = readFileSync(englishFile, "utf8");
    expect(englishHtml).toContain('lang="en"');
    expect(englishHtml).toContain('data-route-language="en"');
    expect(englishHtml).toContain("Editor-approved English text.");
    expect(englishHtml).not.toContain("Русский текст.");
  });
});
