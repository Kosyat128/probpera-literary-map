import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { bookArchiveKey, buildBookArchive } from "../bookArchive";
import {
  countEditorialSentences,
  editorialProseQualityIssues,
  isPublicBook,
} from "../bookQuality";
import {
  applyBookArticleSynopsisBatch01Work,
  bookArticleSynopsisBatch01Holds,
  bookArticleSynopsisBatch01RecordKeys,
  bookArticleSynopsisBatch01Records,
} from "./bookArticleSynopsisBatch01";
import { bookArchiveCountries } from "./index";
import type { WorkProfile } from "./types";

type ManifestOccurrence = {
  occurrenceSha256: string;
  kind: string;
  article: {
    cmsArticleId: string;
    canonicalUrl: string;
    sha256: string;
  };
  revision: { documentPath: string; sha256: string };
  heading: { present: boolean; id: string; text: string; sha256: string };
  excerpt: { present: boolean; characters: number; sha256: string };
};

type ManifestPair = {
  pairSha256: string;
  candidate: { title: string };
  resolution: { status: string; targetRecordKey: string };
  selectedOccurrenceSha256: string;
  occurrences: ManifestOccurrence[];
  quarantine: { required: boolean; reasonCodes: string[] };
};

type SynopsisManifest = {
  extractionPolicy: {
    canonicalSource: string;
    canonicalTextLineEndings: "LF";
    minimumUsableExcerptCharacters: number;
    generatedDescriptions: boolean;
  };
  pairs: ManifestPair[];
};

type CanonicalArticleRevision = {
  id: string;
  canonicalUrl: string;
  contentHtml: string;
};

const expectedRecordKeys = [
  "russia:tolstoy:article-series-1ibqthb",
  "russia:bulgakov:the-white-guard-editorial",
  "russia:buninin:the-village",
  "russia:turgenev:article-series-men9bv",
  "russia:chekhov:article-series-38cmfo",
  "russia:tolstoy:article-series-k1mlo9",
  "russia:tolstoy:article-series-u18dwv",
  "russia:chekhov:article-series-807ko1",
  "russia:tolstoy:article-series-zqpjjm",
  "russia:chekhov:article-series-1fa9e8h",
  "russia:chekhov:article-series-10x9915",
  "russia:tolstoy:article-series-ms8wjq",
] as const;

const repositoryRoot = process.cwd();
const manifest = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, "reports/article-book-synopsis-manifest.json"),
    "utf8",
  ),
) as SynopsisManifest;
const archive = buildBookArchive(bookArchiveCountries, {
  includeUserSuppliedCovers: false,
});

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalUtf8Text(value: Buffer) {
  return value.toString("utf8").replace(/\r\n?/gu, "\n");
}

function archiveWork(recordKey: string): WorkProfile {
  const work = archive.find(
    (candidate) =>
      bookArchiveKey(candidate.countryId, candidate.writerId, candidate.id) ===
      recordKey,
  );
  expect(work, recordKey).toBeDefined();
  return work!;
}

function sourceWork(recordKey: string): WorkProfile {
  const [countryId, writerId, workId] = recordKey.split(":");
  const work = bookArchiveCountries
    .find((country) => country.id === countryId)
    ?.writers.find((writer) => writer.id === writerId)
    ?.workDetails?.find((candidate) => candidate.id === workId);
  expect(work, recordKey).toBeDefined();
  return work!;
}

function sectionTextAfterHeading(contentHtml: string, headingId: string) {
  const $ = cheerio.load(contentHtml);
  const heading = $("h2, h3")
    .toArray()
    .find((element) => $(element).attr("id") === headingId);
  if (!heading) throw new Error(`missing-heading:${headingId}`);

  const parts: string[] = [];
  let current = $(heading).next();
  while (current.length && !/^h[23]$/iu.test(current[0]?.tagName || "")) {
    if (!/^(?:figure|figcaption|img|meta)$/iu.test(current[0]?.tagName || "")) {
      const clone = current.clone();
      clone.find("figure, figcaption, img, meta").remove();
      const text = clone.text().replace(/\s+/gu, " ").trim();
      if (text) parts.push(text);
    }
    current = current.next();
  }

  return {
    headingText: $(heading).text().replace(/\s+/gu, " ").trim(),
    excerptText: parts.join(" ").replace(/\s+/gu, " ").trim(),
  };
}

function normalizedWords(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function wordWindows(value: string, width: number) {
  const words = normalizedWords(value);
  return new Set(
    words
      .slice(0, Math.max(0, words.length - width + 1))
      .map((_, index) => words.slice(index, index + width).join(" ")),
  );
}

describe("project-owned article synopsis batch 01", () => {
  it("covers exactly the twelve adjudicated Russian record keys", () => {
    expect(bookArticleSynopsisBatch01RecordKeys).toEqual(expectedRecordKeys);
    expect(bookArticleSynopsisBatch01Records).toHaveLength(12);
    expect(new Set(bookArticleSynopsisBatch01RecordKeys).size).toBe(12);
    expect(manifest.extractionPolicy).toMatchObject({
      canonicalSource: "public/cms/published-articles.json",
      canonicalTextLineEndings: "LF",
      minimumUsableExcerptCharacters: 140,
      generatedDescriptions: false,
    });
  });

  it("recomputes every immutable article, revision, heading, and selected-excerpt hash", () => {
    for (const record of bookArticleSynopsisBatch01Records) {
      const pair = manifest.pairs.find(
        (candidate) =>
          candidate.resolution.targetRecordKey === record.identity.recordKey,
      );
      expect(pair, record.identity.recordKey).toBeDefined();
      expect(pair).toMatchObject({
        pairSha256: record.identity.pairSha256,
        candidate: { title: record.identity.expectedTitle },
        resolution: {
          status: "covered",
          targetRecordKey: record.identity.recordKey,
        },
        selectedOccurrenceSha256: record.identity.occurrenceSha256,
        quarantine: { required: false, reasonCodes: [] },
      });

      const occurrence = pair!.occurrences.find(
        (candidate) =>
          candidate.occurrenceSha256 === pair!.selectedOccurrenceSha256,
      );
      expect(occurrence, record.identity.recordKey).toBeDefined();
      expect(occurrence).toEqual({
        occurrenceSha256: record.identity.occurrenceSha256,
        kind: record.identity.candidateKind,
        article: expect.objectContaining({
          cmsArticleId: record.identity.articleId,
          canonicalUrl: record.identity.articleUrl,
          sha256: record.identity.articleSha256,
        }),
        revision: expect.objectContaining({
          documentPath: record.identity.revisionDocumentPath,
          sha256: record.identity.revisionSha256,
        }),
        heading: {
          present: true,
          id: record.identity.headingId,
          text: record.identity.headingText,
          sha256: record.identity.headingSha256,
        },
        excerpt: expect.objectContaining({
          present: true,
          sha256: record.identity.excerptSha256,
        }),
      });
      expect(occurrence!.excerpt.characters).toBeGreaterThanOrEqual(140);

      const revisionPath = resolve(
        repositoryRoot,
        "public",
        record.identity.revisionDocumentPath,
      );
      const revisionBytes = readFileSync(revisionPath);
      const article = JSON.parse(
        revisionBytes.toString("utf8"),
      ) as CanonicalArticleRevision;
      expect(sha256(canonicalUtf8Text(revisionBytes))).toBe(
        record.identity.revisionSha256,
      );
      expect(article.id).toBe(record.identity.articleId);
      expect(article.canonicalUrl).toBe(record.identity.articleUrl);
      expect(sha256(article.contentHtml)).toBe(record.identity.articleSha256);

      const extracted = sectionTextAfterHeading(
        article.contentHtml,
        record.identity.headingId,
      );
      expect(extracted.headingText).toBe(record.identity.headingText);
      expect(sha256(extracted.headingText)).toBe(record.identity.headingSha256);
      expect(extracted.excerptText).toHaveLength(
        occurrence!.excerpt.characters,
      );
      expect(sha256(extracted.excerptText)).toBe(record.identity.excerptSha256);
    }
  });

  it("links concise original RU adaptations and exact human EN translations to their sources", () => {
    for (const record of bookArticleSynopsisBatch01Records) {
      const work = archiveWork(record.identity.recordKey);
      const ru = work.translations?.ru;
      const en = work.translations?.en;

      expect(work.title).toBe(record.identity.expectedTitle);
      expect(work.description).toBe(record.ruDescription);
      expect(ru?.description).toBe(record.ruDescription);
      expect(en?.description).toBe(record.enDescription);
      for (const [locale, text] of [
        ["ru", record.ruDescription],
        ["en", record.enDescription],
      ] as const) {
        expect(
          text.length,
          `${record.identity.recordKey}:${locale}`,
        ).toBeGreaterThanOrEqual(140);
        expect(
          text.length,
          `${record.identity.recordKey}:${locale}`,
        ).toBeLessThanOrEqual(900);
        expect(countEditorialSentences(text)).toBeGreaterThanOrEqual(2);
        expect(countEditorialSentences(text)).toBeLessThanOrEqual(3);
        expect(editorialProseQualityIssues(text, locale)).toEqual([]);
      }

      expect(sha256(record.ruDescription)).toBe(
        record.translatedFromSourceHash,
      );
      expect(en?.descriptionProvenance?.translatedFromLocale).toBe("ru");
      expect(en?.descriptionProvenance?.translatedFromSourceHash).toBe(
        record.translatedFromSourceHash,
      );
      expect(en?.descriptionProvenance).toMatchObject({
        origin: "human-translation",
        sourceLanguage: "Russian",
        sourceCountry: "russia",
        rights: {
          textOrigin: "project-original",
          copiedSourceText: false,
        },
      });
      expect(ru?.descriptionProvenance).toMatchObject({
        origin: "article-adapted",
        sourceLanguage: "Russian",
        sourceCountry: "russia",
        sourceArticle: {
          articleId: record.identity.articleId,
          url: record.identity.articleUrl,
          revisionId: record.identity.revisionSha256,
          sourceHash: record.identity.articleSha256,
          excerptHash: record.identity.excerptSha256,
        },
        transformations: [
          "condensed",
          "deduplicated",
          "spoiler-limited",
          "style-edited",
        ],
        rights: {
          textOrigin: "project-owned-article",
          copiedSourceText: false,
        },
      });

      const expectedSourceUrls = [
        record.identity.articleUrl,
        ...record.officialSources.map((source) => source.url),
      ];
      expect(ru?.sourceUrls).toEqual(expectedSourceUrls);
      expect(en?.sourceUrls).toEqual(expectedSourceUrls);
      expect(ru?.descriptionProvenance?.sourceUrls).toEqual(expectedSourceUrls);
      expect(en?.descriptionProvenance?.sourceUrls).toEqual(expectedSourceUrls);

      const articleSource = work.sources?.find(
        (source) => source.url === record.identity.articleUrl,
      );
      expect(articleSource).toMatchObject({
        provider: "Проба Пера",
        authorityId: "probpera-editorial",
        country: "russia",
        language: "Russian",
        recordKind: "article-source",
        recordId: record.identity.articleId,
        fields: ["identity", "title", "description"],
        usage: "reference-only",
      });
      for (const officialSource of record.officialSources) {
        expect(
          work.sources?.find(
            (candidate) => candidate.url === officialSource.url,
          ),
        ).toMatchObject({
          ...officialSource,
          fields: expect.arrayContaining(officialSource.fields),
        });
      }
    }
  });

  it("stores rewritten synopsis prose rather than copied article excerpts", () => {
    for (const record of bookArticleSynopsisBatch01Records) {
      const revision = JSON.parse(
        readFileSync(
          resolve(
            repositoryRoot,
            "public",
            record.identity.revisionDocumentPath,
          ),
          "utf8",
        ),
      ) as CanonicalArticleRevision;
      const { excerptText } = sectionTextAfterHeading(
        revision.contentHtml,
        record.identity.headingId,
      );
      const articleWindows = wordWindows(excerptText, 12);
      const adaptedWindows = wordWindows(record.ruDescription, 12);
      const sharedWindows = [...adaptedWindows].filter((window) =>
        articleWindows.has(window),
      );

      expect(record.ruDescription).not.toBe(excerptText);
      expect(excerptText).not.toContain(record.ruDescription);
      expect(sharedWindows, record.identity.recordKey).toEqual([]);
    }
  });

  it("preserves bibliographic identity and existing titles while applying only the synopsis overlay", () => {
    for (const record of bookArticleSynopsisBatch01Records) {
      const [countryId, writerId] = record.identity.recordKey.split(":");
      const before = sourceWork(record.identity.recordKey);
      const after = applyBookArticleSynopsisBatch01Work(
        countryId,
        writerId,
        before,
      );

      expect(after).not.toBe(before);
      expect(after.id).toBe(before.id);
      expect(after.title).toBe(before.title);
      expect(after.originalTitle).toBe(before.originalTitle);
      expect(after.localizedTitles).toEqual(before.localizedTitles);
      expect(after.canon).toEqual(before.canon);
      expect(after.externalIds).toEqual(before.externalIds);
      expect(after.coverUrl).toBe(before.coverUrl);
      expect(after.coverThumbnailUrl).toBe(before.coverThumbnailUrl);
      expect(after.coverRights).toEqual(before.coverRights);
      expect(after.translations?.ru?.title).toBe(
        before.translations?.ru?.title || "",
      );
      expect(after.translations?.en?.title).toBe(
        before.translations?.en?.title || "",
      );
      for (const source of before.sources || []) {
        expect(
          after.sources?.find((candidate) => candidate.url === source.url),
        ).toMatchObject({
          ...source,
          fields: expect.arrayContaining(source.fields),
        });
      }
    }

    const unmatched: WorkProfile = { id: "not-in-batch", title: "Untouched" };
    expect(
      applyBookArticleSynopsisBatch01Work("russia", "nobody", unmatched),
    ).toBe(unmatched);
  });

  it("records explicit one-source holds and cannot auto-publish any batch card", () => {
    expect(bookArticleSynopsisBatch01Holds).toHaveLength(12);
    expect(bookArticleSynopsisBatch01Holds).toEqual(
      bookArticleSynopsisBatch01Records.map((record) => ({
        recordKey: record.identity.recordKey,
        status: "fail-closed",
        code: "insufficient-independent-official-description-sources",
        currentOfficialSourceCount: 1,
        requiredIndependentOfficialSourceCount: 2,
      })),
    );

    for (const record of bookArticleSynopsisBatch01Records) {
      expect(record.officialSources).toHaveLength(1);
      const [officialSource] = record.officialSources;
      expect(officialSource).toMatchObject({
        country: "russia",
        language: "Russian",
        usage: "reference-only",
        fields: expect.arrayContaining(["description"]),
      });
      expect(["A", "B"]).toContain(officialSource.authorityTier);
      expect(new URL(officialSource.url).hostname).toMatch(
        /(?:tolstoy\.ru|feb-web\.ru|prlib\.ru|rusneb\.ru)$/u,
      );
      const work = archiveWork(record.identity.recordKey);
      expect(work.editorial?.status).toBe("draft");
      expect(work.translations?.ru?.status).toBe("draft");
      expect(work.translations?.en?.status).toBe("draft");
      expect(isPublicBook(work)).toBe(false);
    }
  });
});
