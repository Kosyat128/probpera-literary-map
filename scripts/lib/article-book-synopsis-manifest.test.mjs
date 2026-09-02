import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { it } from "vitest";

import {
  articleSynopsisCorpusSha256,
  articleSynopsisRevisionSha256,
} from "./article-book-synopsis-revision.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
const manifestPath = path.join(
  repositoryRoot,
  "reports",
  "article-book-synopsis-manifest.json"
);
const sha256Pattern = /^[a-f0-9]{64}$/u;

async function manifestFixture() {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

function keyNames(value, names = []) {
  if (Array.isArray(value)) {
    for (const item of value) keyNames(item, names);
    return names;
  }
  if (!value || typeof value !== "object") return names;
  for (const [key, item] of Object.entries(value)) {
    names.push(key);
    keyNames(item, names);
  }
  return names;
}

it("manifest preserves the audited 258 author-work pairs", async () => {
  const manifest = await manifestFixture();

  assert.deepEqual(manifest.totals, {
    sourceOccurrences: 267,
    pairs: 258,
    uniquelyResolved: 258,
    missingCards: 0,
    ambiguousCards: 0,
    unmatchedWriters: 0,
    usableSynopsisPairs: 248,
    quarantinedPairs: 10,
  });
  assert.equal(manifest.pairs.length, 258);
  assert.equal(
    manifest.pairs.reduce(
      (total, pair) => total + pair.sourceOccurrenceCount,
      0
    ),
    267
  );
  assert.equal(manifest.extractionPolicy.generatedDescriptions, false);
  assert.equal(manifest.extractionPolicy.canonicalRevisionTextLineEndings, "LF");
  assert.match(manifest.hashScopes.revision, /Canonical JSON projection/u);
});

it("the three researched title collisions resolve to the correct authors", async () => {
  const manifest = await manifestFixture();
  const expected = new Map([
    ["Анри Барбюс::Нежность", "france:henri_barbusse:la-tendresse"],
    ["Иван Бунин::Деревня", "russia:buninin:the-village"],
    ["Майкл Крайтон::Затерянный мир", "usa:michael_crichton:the-lost-world"],
  ]);

  for (const pair of manifest.pairs.filter((item) =>
    expected.has(`${item.candidate.author}::${item.candidate.title}`)
  )) {
    const key = `${pair.candidate.author}::${pair.candidate.title}`;
    assert.equal(pair.resolution.status, "covered");
    assert.equal(pair.resolution.targetRecordKey, expected.get(key));
    assert.equal(pair.quarantine.required, false);
    assert.deepEqual(pair.resolution.collisionReasonCodes, [
      "same-title-multiple-authors",
    ]);
  }
  assert.equal(
    manifest.pairs.filter((pair) => pair.resolution.status === "missing").length,
    0
  );
});

it("Musil duplicate resolves through the reviewed Austrian identity alias", async () => {
  const manifest = await manifestFixture();
  const musil = manifest.pairs.find(
    (pair) => pair.candidate.title === "Человек без свойств"
  );

  assert.ok(musil);
  assert.equal(musil.candidate.author, "Роберт Музиль");
  assert.equal(musil.resolution.status, "covered");
  assert.equal(
    musil.resolution.targetRecordKey,
    "austria:robert_musil:legacy-robert_musil-человек-без-свойств"
  );
  assert.deepEqual(
    musil.resolution.titleCollisionMatches
      .map((match) => match.countryId)
      .sort(),
    ["austria", "germany"]
  );
  assert.deepEqual(musil.resolution.collisionReasonCodes, [
    "duplicate-author-work-records",
    "canonical-writer-alias-resolved",
  ]);
  assert.equal(musil.quarantine.required, false);
  assert.deepEqual(musil.quarantine.reasonCodes, []);
});

it("all source scopes carry SHA-256 without embedding excerpt text", async () => {
  const manifest = await manifestFixture();
  const forbiddenKeys = new Set([
    "description",
    "excerptText",
    "generatedDescription",
    "synopsis",
  ]);

  assert.equal(
    keyNames(manifest).some((key) => forbiddenKeys.has(key)),
    false
  );
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.sourceRevision.articleCount, 167);
  assert.match(manifest.sourceRevision.articleCorpusSha256, sha256Pattern);
  assert.equal("generatedAt" in manifest.sourceRevision, false);
  assert.equal(
    "publishedArticlesManifestSha256" in manifest.sourceRevision,
    false
  );
  assert.match(
    manifest.sourceRevision.writerIdentityAliasRegistrySha256,
    sha256Pattern
  );
  assert.match(manifest.pairsSha256, sha256Pattern);

  for (const pair of manifest.pairs) {
    assert.match(pair.pairSha256, sha256Pattern);
    assert.match(pair.selectedOccurrenceSha256, sha256Pattern);
    assert.equal(
      pair.occurrences.some(
        (occurrence) =>
          occurrence.occurrenceSha256 === pair.selectedOccurrenceSha256
      ),
      true
    );
    for (const occurrence of pair.occurrences) {
      assert.match(occurrence.occurrenceSha256, sha256Pattern);
      assert.match(occurrence.article.sha256, sha256Pattern);
      assert.match(occurrence.revision.sha256, sha256Pattern);
      if (occurrence.heading.present) {
        assert.match(occurrence.heading.sha256, sha256Pattern);
      } else {
        assert.equal(occurrence.heading.sha256, null);
      }
      if (occurrence.excerpt.present) {
        assert.match(occurrence.excerpt.sha256, sha256Pattern);
      } else {
        assert.equal(occurrence.excerpt.sha256, null);
      }
    }
  }
});

it("semantic article hashes ignore deployment metadata but retain prose provenance", () => {
  const article = {
    id: "cms-00000000-0000-4000-8000-000000000000",
    title: "Статья",
    canonicalUrl: "https://probpera.ru/stati/example/",
    contentHtml: "<h2 id=\"book\">Книга</h2><p>Исходный текст.</p>",
    plainText: "Книга Исходный текст.",
    headings: [{ id: "book", text: "Книга" }],
    updatedAt: "2026-09-01T00:00:00.000Z",
    dzenImageUrl: "https://example.com/first.jpg",
    dzenImageAlt: "Первая обложка",
    featured: false,
  };
  const revision = articleSynopsisRevisionSha256(article);
  const deploymentOnlyChange = {
    ...article,
    updatedAt: "2026-09-02T00:00:00.000Z",
    dzenImageUrl: "https://example.com/second.jpg",
    dzenImageAlt: "Вторая обложка",
    featured: true,
  };
  const proseChange = {
    ...deploymentOnlyChange,
    contentHtml: "<h2 id=\"book\">Книга</h2><p>Исправленный текст.</p>",
  };

  assert.equal(articleSynopsisRevisionSha256(deploymentOnlyChange), revision);
  assert.notEqual(articleSynopsisRevisionSha256(proseChange), revision);
  assert.equal(
    articleSynopsisCorpusSha256([
      { article, documentPath: "cms/articles/article.json" },
    ]),
    articleSynopsisCorpusSha256([
      {
        article: deploymentOnlyChange,
        documentPath: "cms/articles/article.json",
      },
    ])
  );
  assert.equal(
    articleSynopsisRevisionSha256({ ...article, contentHtml: "a\r\nb\rc" }),
    articleSynopsisRevisionSha256({ ...article, contentHtml: "a\nb\nc" })
  );
  assert.notEqual(
    articleSynopsisRevisionSha256({
      ...article,
      publishedAt: "2026-09-01T00:00:00.000Z",
    }),
    articleSynopsisRevisionSha256({
      ...article,
      publishedAt: "2026-09-02T00:00:00.000Z",
    })
  );
});

it("semantic corpus hashes reject duplicate or incomplete identities", () => {
  const article = {
    id: "cms-00000000-0000-4000-8000-000000000000",
    title: "Статья",
    contentHtml: "<p>Текст.</p>",
  };
  assert.throws(
    () =>
      articleSynopsisCorpusSha256([
        { article, documentPath: "cms/articles/article.json" },
        { article, documentPath: "cms/articles/article-copy.json" },
      ]),
    /Duplicate article id/u
  );
  assert.throws(
    () => articleSynopsisCorpusSha256([{ article, documentPath: "" }]),
    /require an id and documentPath/u
  );
});
