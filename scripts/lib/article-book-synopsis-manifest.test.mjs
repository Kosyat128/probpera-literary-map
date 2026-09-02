import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { it } from "vitest";

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

it("manifest preserves the audited 259 author-work pairs", async () => {
  const manifest = await manifestFixture();

  assert.deepEqual(manifest.totals, {
    sourceOccurrences: 268,
    pairs: 259,
    uniquelyResolved: 259,
    missingCards: 0,
    ambiguousCards: 0,
    unmatchedWriters: 0,
    usableSynopsisPairs: 249,
    quarantinedPairs: 10,
  });
  assert.equal(manifest.pairs.length, 259);
  assert.equal(
    manifest.pairs.reduce(
      (total, pair) => total + pair.sourceOccurrenceCount,
      0
    ),
    268
  );
  assert.equal(manifest.extractionPolicy.generatedDescriptions, false);
  assert.equal(manifest.extractionPolicy.canonicalTextLineEndings, "LF");
  assert.match(manifest.hashScopes.revision, /normalized to LF/u);
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
  assert.match(manifest.sourceRevision.publishedArticlesManifestSha256, sha256Pattern);
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
