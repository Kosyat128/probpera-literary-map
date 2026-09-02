import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { build } from "esbuild";

import {
  buildArticleBookAliasIndex,
  buildArticleBookWriterIdentityAliasMap,
  consolidateArticleBookCandidates,
  extractArticleBookCandidates,
  normalizeArticleBookText,
  resolveArticleBookCandidate,
} from "./lib/article-book-coverage-policy.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(repositoryRoot, "scripts", ".cache");
const bundlePath = path.join(
  cacheDirectory,
  "article-book-synopsis-manifest-source.mjs"
);
const sourcePath = path.join(repositoryRoot, "scripts", "book-mentions-source.ts");
const publishedArticlesPath = path.join(
  repositoryRoot,
  "public",
  "cms",
  "published-articles.json"
);
const outputPath = path.join(
  repositoryRoot,
  "reports",
  "article-book-synopsis-manifest.json"
);
const minimumUsableExcerptCharacters = 140;
const supportedArguments = new Set(["--check"]);

for (const argument of process.argv.slice(2)) {
  if (!supportedArguments.has(argument)) {
    throw new Error(`Unknown argument: ${argument}`);
  }
}
const checkOnly = process.argv.includes("--check");

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalUtf8Text(value) {
  return value.replace(/\r\n?/gu, "\n");
}

async function sourceArchive() {
  await fs.mkdir(cacheDirectory, { recursive: true });
  await build({
    absWorkingDir: repositoryRoot,
    entryPoints: [sourcePath],
    bundle: true,
    platform: "node",
    packages: "external",
    format: "esm",
    target: "node22",
    tsconfigRaw: {
      compilerOptions: {
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2022",
      },
    },
    outfile: bundlePath,
    logLevel: "silent",
  });
  return import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
}

async function sourceArticles() {
  const manifestRaw = await fs.readFile(publishedArticlesPath, "utf8");
  const manifest = JSON.parse(manifestRaw);
  const snapshots = await Promise.all(
    manifest.articles.map(async (metadata) => {
      const absoluteDocumentPath = path.join(
        repositoryRoot,
        "public",
        metadata.documentPath
      );
      const revisionRaw = await fs.readFile(absoluteDocumentPath, "utf8");
      return {
        article: { ...metadata, ...JSON.parse(revisionRaw) },
        documentPath: metadata.documentPath,
        revisionRaw,
      };
    })
  );
  snapshots.sort((first, second) =>
    (first.article.legacyId || first.article.id).localeCompare(
      second.article.legacyId || second.article.id,
      "en"
    )
  );
  return { manifest, manifestRaw, snapshots };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((first, second) =>
    first.localeCompare(second, "en")
  );
}

function sourceOccurrence(occurrence, snapshotById) {
  const snapshot = snapshotById.get(occurrence.cmsArticleId);
  if (!snapshot) {
    throw new Error(
      `Canonical CMS snapshot not found for ${occurrence.cmsArticleId}`
    );
  }
  const { article, documentPath, revisionRaw } = snapshot;
  const headingText = occurrence.headingText || "";
  const excerptText = occurrence.excerptText || "";
  const articleSha256 = sha256(article.contentHtml || "");
  const revisionSha256 = sha256(canonicalUtf8Text(revisionRaw));
  const headingSha256 = headingText ? sha256(headingText) : null;
  const excerptSha256 = excerptText ? sha256(excerptText) : null;
  const occurrenceSha256 = sha256(
    [
      occurrence.kind,
      article.id,
      article.legacyId || "",
      occurrence.headingId || "",
      articleSha256,
      revisionSha256,
      headingSha256 || "",
      excerptSha256 || "",
    ].join("\n")
  );

  return {
    occurrenceSha256,
    kind: occurrence.kind,
    article: {
      cmsArticleId: article.id,
      legacyArticleId: article.legacyId || "",
      canonicalUrl: article.canonicalUrl || article.url || "",
      sha256: articleSha256,
    },
    revision: {
      documentPath,
      publishedAt: article.publishedAt || "",
      sha256: revisionSha256,
    },
    heading: {
      present: Boolean(headingText),
      id: occurrence.headingId || "",
      text: headingText,
      sha256: headingSha256,
    },
    excerpt: {
      present: Boolean(excerptText),
      characters: excerptText.length,
      sha256: excerptSha256,
    },
  };
}

const kindPriority = new Map([
  ["primary", 0],
  ["catalog", 1],
  ["novel", 2],
  ["short-story", 3],
]);

function selectSource(sources) {
  return [...sources].sort((first, second) => {
    const firstUsable =
      first.excerpt.characters >= minimumUsableExcerptCharacters ? 1 : 0;
    const secondUsable =
      second.excerpt.characters >= minimumUsableExcerptCharacters ? 1 : 0;
    return (
      secondUsable - firstUsable ||
      (kindPriority.get(first.kind) ?? 99) -
        (kindPriority.get(second.kind) ?? 99) ||
      second.excerpt.characters - first.excerpt.characters ||
      first.article.cmsArticleId.localeCompare(
        second.article.cmsArticleId,
        "en"
      ) ||
      first.heading.id.localeCompare(second.heading.id, "en")
    );
  })[0];
}

function resolutionRecord(resolution) {
  return {
    status: resolution.status,
    targetRecordKey: resolution.recordKey,
    countryId:
      resolution.book?.countryId || resolution.writer?.countryId || "",
    writerId: resolution.book?.writerId || resolution.writer?.writerId || "",
    writerName:
      resolution.book?.writerName || resolution.writer?.writerName || "",
    writerMatchAmbiguous: resolution.writerMatchAmbiguous,
    workMatchAmbiguous: resolution.workMatchAmbiguous,
    collisionReasonCodes: resolution.collisionReasonCodes,
    titleCollisionMatches: resolution.collisionReasonCodes.length
      ? resolution.titleMatches
      : [],
    authorWorkMatches:
      resolution.status === "ambiguous" ? resolution.authorTitleMatches : [],
  };
}

function quarantineRecord(candidate, resolution, selectedSource) {
  const reasonCodes = [];
  const resolvedWriterAlias = resolution.collisionReasonCodes.includes(
    "canonical-writer-alias-resolved"
  );
  if (resolution.status === "missing") {
    reasonCodes.push("missing-author-work-card");
  } else if (resolution.status === "ambiguous") {
    reasonCodes.push("ambiguous-author-work-match");
  } else if (resolution.status === "unmatched-writer") {
    reasonCodes.push("unmatched-source-author");
  }
  for (const collisionReason of resolution.collisionReasonCodes) {
    if (
      collisionReason === "wrong-author-title-collision" ||
      (collisionReason === "duplicate-author-work-records" &&
        !resolvedWriterAlias) ||
      collisionReason === "source-author-missing"
    ) {
      reasonCodes.push(collisionReason);
    }
  }
  if (
    !selectedSource ||
    selectedSource.excerpt.characters < minimumUsableExcerptCharacters
  ) {
    reasonCodes.push("no-usable-article-synopsis");
  }
  if (!selectedSource?.heading.present) {
    reasonCodes.push("source-heading-absent");
  }
  if (candidate.sourceAuthorAmbiguous) {
    reasonCodes.push("source-author-ambiguous");
  }
  const uniqueReasonCodes = unique(reasonCodes);
  return {
    required: uniqueReasonCodes.length > 0,
    reasonCodes: uniqueReasonCodes,
  };
}

const [archiveSource, articleSource] = await Promise.all([
  sourceArchive(),
  sourceArticles(),
]);
const snapshotById = new Map(
  articleSource.snapshots.map((snapshot) => [snapshot.article.id, snapshot])
);
const occurrences = articleSource.snapshots.flatMap(({ article }) =>
  extractArticleBookCandidates(article)
);
const candidates = consolidateArticleBookCandidates(occurrences);
const aliasIndex = buildArticleBookAliasIndex(archiveSource.archive);
const writerIdentityAliases = buildArticleBookWriterIdentityAliasMap(
  archiveSource.writerIdentityAliases
);
const pairs = candidates
  .map((candidate) => {
    const resolution = resolveArticleBookCandidate(candidate, {
      aliasIndex,
      writers: archiveSource.writers,
      writerIdentityAliases,
    });
    const sources = candidate.occurrences
      .map((occurrence) => sourceOccurrence(occurrence, snapshotById))
      .sort((first, second) =>
        first.occurrenceSha256.localeCompare(second.occurrenceSha256, "en")
      );
    const selectedSource = selectSource(sources);
    const pairSha256 = sha256(
      [candidate.normalizedAuthor, candidate.normalizedTitle].join("\n")
    );
    return {
      pairSha256,
      candidate: {
        author: candidate.author,
        title: candidate.title,
      },
      resolution: resolutionRecord(resolution),
      sourceOccurrenceCount: sources.length,
      sourceArticleIds: unique(
        sources.map((source) => source.article.cmsArticleId)
      ),
      selectedOccurrenceSha256: selectedSource?.occurrenceSha256 || "",
      occurrences: sources,
      quarantine: quarantineRecord(candidate, resolution, selectedSource),
    };
  })
  .sort(
    (first, second) =>
      normalizeArticleBookText(first.candidate.title).localeCompare(
        normalizeArticleBookText(second.candidate.title),
        "ru"
      ) ||
      normalizeArticleBookText(first.candidate.author).localeCompare(
        normalizeArticleBookText(second.candidate.author),
        "ru"
      )
  );

const manifest = {
  schemaVersion: 1,
  purpose:
    "Read-only provenance manifest for later human-reviewed article synopsis migration; it contains no excerpt text and creates no book descriptions.",
  matchingPolicy: "normalized-title-author-and-reviewed-writer-alias-v3",
  hashAlgorithm: "SHA-256",
  hashScopes: {
    article: "UTF-8 contentHtml from the canonical CMS article snapshot",
    revision:
      "UTF-8 text of the canonical public/cms article JSON revision with line endings normalized to LF",
    heading: "Whitespace-normalized heading text; null when absent",
    excerpt:
      "Whitespace-normalized DOM text extracted after the heading; null when absent",
  },
  extractionPolicy: {
    canonicalSource: "public/cms/published-articles.json",
    canonicalTextLineEndings: "LF",
    minimumUsableExcerptCharacters,
    selectedSourcePriority: [
      "usable excerpt",
      "primary article",
      "catalog article",
      "novel list",
      "short-story list",
      "longer excerpt",
      "stable source identifiers",
    ],
    generatedDescriptions: false,
  },
  sourceRevision: {
    generatedAt: articleSource.manifest.generatedAt || "",
    publishedArticlesManifestSha256: sha256(
      canonicalUtf8Text(articleSource.manifestRaw)
    ),
    writerIdentityAliasRegistrySha256: sha256(
      JSON.stringify(archiveSource.writerIdentityAliasRegistry)
    ),
  },
  totals: {
    sourceOccurrences: occurrences.length,
    pairs: pairs.length,
    uniquelyResolved: pairs.filter(
      (pair) => pair.resolution.status === "covered"
    ).length,
    missingCards: pairs.filter(
      (pair) => pair.resolution.status === "missing"
    ).length,
    ambiguousCards: pairs.filter(
      (pair) => pair.resolution.status === "ambiguous"
    ).length,
    unmatchedWriters: pairs.filter(
      (pair) => pair.resolution.status === "unmatched-writer"
    ).length,
    usableSynopsisPairs: pairs.filter(
      (pair) => {
        const selectedSource = pair.occurrences.find(
          (occurrence) =>
            occurrence.occurrenceSha256 === pair.selectedOccurrenceSha256
        );
        return (
          selectedSource?.excerpt.characters >=
          minimumUsableExcerptCharacters
        );
      }
    ).length,
    quarantinedPairs: pairs.filter((pair) => pair.quarantine.required).length,
  },
  pairsSha256: sha256(JSON.stringify(pairs)),
  pairs,
};
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

if (checkOnly) {
  const existing = await fs.readFile(outputPath, "utf8").catch(() => "");
  if (existing !== serialized) {
    console.error(
      "article-book-synopsis-manifest.json is stale; run node scripts/extract-article-book-synopsis-manifest.mjs"
    );
    process.exitCode = 1;
  }
} else {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, serialized, "utf8");
}

console.log(JSON.stringify(manifest.totals, null, 2));
