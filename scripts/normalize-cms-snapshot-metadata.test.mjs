import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import {
  normalizeArticlePublicMetadata,
  normalizePublicMetadataText,
  publicMetadataArtifacts,
} from "./lib/article-route-policy.mjs";

describe("CMS metadata normalization stability", () => {
  it.each([
    ["  War&amp;amp;nbsp;&amp;nbsp;and\tPeace  ", "War and Peace"],
    ["&amp;lt;em&amp;gt;Чтение&amp;lt;/em&amp;gt;", "Чтение"],
    ["&am\u200bp;nbsp;Reader", "Reader"],
    ["<sp\u200ban>Reader</span>", "Reader"],
    ["Cafe&#x301;", "Café"],
    ["A &amp; B &unknown; C", "A & B &unknown; C"],
  ])("normalizes %s completely in one call", (input, expected) => {
    const actual = normalizePublicMetadataText(input);
    expect(actual).toBe(expected);
    expect(normalizePublicMetadataText(actual)).toBe(actual);
    expect(publicMetadataArtifacts(actual)).toEqual([]);
  });

  it("normalizes RU and EN metadata while preserving article bodies and source records", () => {
    const original = {
      id: "cms-11111111-1111-4111-8111-111111111111",
      title: "Мир&amp;amp;nbsp;книг",
      html: '<pre> A  B\n &amp;lt;tag&amp;gt; </pre>',
      plainText: " A  B\n &amp;nbsp; ",
      sources: [{ title: "Source &amp; title", url: "https://example.org/?a=1&b=2" }],
      translations: {
        en: {
          title: "A&amp;amp;nbsp;world of books",
          seoTitle: "Cafe&#x301;",
          html: '<p>  Keep &amp;nbsp; and <em>markup</em>. </p>',
          headings: [{ text: " A  B " }],
        },
      },
    };
    const before = structuredClone(original);
    const normalized = normalizeArticlePublicMetadata(original);
    expect(normalized.title).toBe("Мир книг");
    expect(normalized.translations.en.title).toBe("A world of books");
    expect(normalized.translations.en.seoTitle).toBe("Café");
    expect(normalized.html).toBe(original.html);
    expect(normalized.plainText).toBe(original.plainText);
    expect(normalized.sources).toBe(original.sources);
    expect(normalized.translations.en.html).toBe(original.translations.en.html);
    expect(normalized.translations.en.headings).toBe(original.translations.en.headings);
    expect(normalizeArticlePublicMetadata(normalized)).toEqual(normalized);
    expect(original).toEqual(before);
  });

  it("keeps the CLI check read-only, accepts CRLF and reports real metadata drift", () => {
    const projectRoot = fileURLToPath(new URL("../", import.meta.url));
    const temporaryRoot = path.resolve(tmpdir());
    const fixture = mkdtempSync(path.join(temporaryRoot, "probpera-metadata-test-"));
    try {
      for (const relativePath of [
        "scripts/normalize-cms-snapshot-metadata.mjs",
        "scripts/editorial-publication-fixes.mjs",
        "scripts/lib/article-route-policy.mjs",
        "scripts/lib/cms-legacy-withdrawals.mjs",
        "scripts/lib/cms-publication-state.mjs",
        "scripts/lib/short-hyphens.mjs",
        "src/data/articles/sectionRoutes.json",
      ]) {
        const destination = path.join(fixture, relativePath);
        mkdirSync(path.dirname(destination), { recursive: true });
        copyFileSync(path.join(projectRoot, relativePath), destination);
      }
      const id = "cms-11111111-1111-4111-8111-111111111111";
      const article = {
        id,
        title: "Книги&amp;amp;nbsp;мира",
        translations: { en: { title: "Books&amp;amp;nbsp;of the world" } },
      };
      const body = '<pre>  A  B\n&amp;nbsp; <em>keep</em> </pre>';
      const document = {
        ...article,
        html: body,
        translations: { en: { ...article.translations.en, html: body } },
      };
      const writeJson = (relativePath, value) => {
        const destination = path.join(fixture, relativePath);
        mkdirSync(path.dirname(destination), { recursive: true });
        writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`);
      };
      for (const filename of ["published-content.json", "published-articles.json"]) {
        writeJson(`public/cms/${filename}`, { articles: [article], withdrawnLegacyArticles: [] });
      }
      const documentPath = `public/cms/articles/${id}.json`;
      writeJson(documentPath, document);
      const generatedPaths = [
        "src/data/articles/cms.generated.ts",
        "src/data/articles/cms-withdrawals.generated.ts",
      ];
      for (const generatedPath of generatedPaths) {
        writeFileSync(path.join(fixture, generatedPath), "");
      }
      const run = (...args) => spawnSync(process.execPath, [
        path.join(fixture, "scripts/normalize-cms-snapshot-metadata.mjs"), ...args,
      ], { cwd: fixture, encoding: "utf8" });

      const repair = run("--write");
      expect(repair.stderr).toBe("");
      expect(repair.status).toBe(0);
      const normalized = JSON.parse(readFileSync(path.join(fixture, documentPath), "utf8"));
      expect(normalized.title).toBe("Книги мира");
      expect(normalized.translations.en.title).toBe("Books of the world");
      expect(normalized.html).toBe(body);
      expect(normalized.translations.en.html).toBe(body);
      expect(run().status).toBe(0);

      for (const generatedPath of generatedPaths) {
        const absolutePath = path.join(fixture, generatedPath);
        const crlf = readFileSync(absolutePath, "utf8").replaceAll("\n", "\r\n");
        writeFileSync(absolutePath, crlf);
        expect(run().status).toBe(0);
        expect(readFileSync(absolutePath, "utf8")).toBe(crlf);
      }

      normalized.translations.en.title = "A&amp;amp;nbsp;changed title";
      writeJson(documentPath, normalized);
      const bytesBeforeCheck = readFileSync(path.join(fixture, documentPath));
      const check = run();
      expect(check.status).toBe(1);
      expect(check.stderr).toContain(id);
      expect(readFileSync(path.join(fixture, documentPath))).toEqual(bytesBeforeCheck);
      expect(run("--write").status).toBe(0);
      expect(run().status).toBe(0);
    } finally {
      // Only remove the exact temporary child created for this test.
      if (path.dirname(path.resolve(fixture)) !== temporaryRoot) {
        throw new Error("Metadata fixture escaped the temporary directory.");
      }
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
