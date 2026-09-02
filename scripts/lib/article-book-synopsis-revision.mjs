import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

const semanticArticleRevisionFields = Object.freeze([
  "id",
  "source",
  "legacyId",
  "legacyPath",
  "url",
  "canonicalUrl",
  "slug",
  "title",
  "description",
  "sectionId",
  "sectionLabel",
  "publishedAt",
  "contentHtml",
  "plainText",
  "headings",
  "sources",
  "bibliography",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function compareUtf8(first, second) {
  return Buffer.compare(Buffer.from(first, "utf8"), Buffer.from(second, "utf8"));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareUtf8)
        .map((key) => [key, canonicalJson(value[key])])
    );
  }
  return typeof value === "string" ? value.replace(/\r\n?/gu, "\n") : value;
}

function selectedOwnFields(value, fields) {
  return Object.fromEntries(
    fields.flatMap((field) =>
      Object.hasOwn(value, field) ? [[field, value[field]]] : []
    )
  );
}

export function articleSynopsisRevisionProjection(article) {
  if (!article || typeof article !== "object" || Array.isArray(article)) {
    throw new TypeError("Article revision must be an object.");
  }
  return canonicalJson(selectedOwnFields(article, semanticArticleRevisionFields));
}

export function articleSynopsisRevisionSha256(article) {
  return sha256(JSON.stringify(articleSynopsisRevisionProjection(article)));
}

export function articleSynopsisCorpusSha256(snapshots) {
  if (!Array.isArray(snapshots)) {
    throw new TypeError("Article corpus snapshots must be an array.");
  }
  const revisions = snapshots
    .map(({ article, documentPath }) => ({
      articleId: String(article?.id || ""),
      documentPath: String(documentPath || ""),
      revisionSha256: articleSynopsisRevisionSha256(article),
    }))
    .sort(
      (first, second) =>
        compareUtf8(first.articleId, second.articleId) ||
        compareUtf8(first.documentPath, second.documentPath)
    );
  const articleIds = new Set();
  const documentPaths = new Set();
  for (const revision of revisions) {
    if (!revision.articleId || !revision.documentPath) {
      throw new TypeError("Article corpus entries require an id and documentPath.");
    }
    if (articleIds.has(revision.articleId)) {
      throw new TypeError(`Duplicate article id: ${revision.articleId}`);
    }
    if (documentPaths.has(revision.documentPath)) {
      throw new TypeError(`Duplicate article documentPath: ${revision.documentPath}`);
    }
    articleIds.add(revision.articleId);
    documentPaths.add(revision.documentPath);
  }
  return sha256(JSON.stringify(revisions));
}
