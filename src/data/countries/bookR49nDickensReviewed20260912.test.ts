import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import canonRegistry from "../../../data/book-canon-source-registry.json";
import review from "../../../reports/book-r49n-dickens-reviewed-20260912.json";
import attestation from "../../../scripts/governance/book-r49n-dickens-reviewed-20260912.json";
import { buildBookArchive, type BookArchiveEntry } from "../bookArchive";
import { bookEvidenceV2Issues } from "../bookEvidence";
import { isPublicBook } from "../bookQuality";
import { bookArchiveCountries } from "./index";
import {
  applyBookR49nDickensReviewed20260912Work,
  bookR49nDickensReviewed20260912RecordKeys,
} from "./bookR49nDickensReviewed20260912";
import type { WorkProfile } from "./types";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const archive = buildBookArchive(bookArchiveCountries);
const keyOf = (book: BookArchiveEntry) => `${book.countryId}:${book.writerId}:${book.id}`;
const byKey = new Map(archive.map((book) => [keyOf(book), book]));
const context = (book: BookArchiveEntry) => ({
  canonRegistry,
  recordKey: keyOf(book),
  originCountryIds: [book.countryId],
  descriptionSha256ByLocale: { ru: hash(book.translations?.ru?.description || "") },
});

describe("independently reviewed R49N Dickens profiles", () => {
  it("applies exactly the ten reviewed existing keys, including Our Mutual Friend once", () => {
    expect([...bookR49nDickensReviewed20260912RecordKeys].sort()).toEqual(
      review.records.map((record) => record.recordKey).sort()
    );
    expect(new Set(bookR49nDickensReviewed20260912RecordKeys).size).toBe(10);
    for (const key of bookR49nDickensReviewed20260912RecordKeys) {
      expect(archive.filter((book) => keyOf(book) === key), key).toHaveLength(1);
    }
    const mutualFriends = archive.filter((book) =>
      book.writerId === "charles_dickens" &&
      book.translations?.en?.title === "Our Mutual Friend"
    );
    expect(mutualFriends.map(keyOf)).toEqual([
      "england:charles_dickens:article-series-1tdjfsi",
    ]);
  });

  it.each(review.records)("retains the selected RU/EN texts and passes the real registry: $recordKey", (record) => {
    const book = byKey.get(record.recordKey)!;
    expect(book).toBeDefined();
    expect(isPublicBook(book)).toBe(true);
    expect(bookEvidenceV2Issues(book, context(book))).toEqual([]);
    expect(book.canon).toBeUndefined();
    expect(book.firstPublished).toBe(record.firstPublicationReview.after);
    expect(book.description).toBe(record.recommendedTexts.ru.text);
    for (const locale of ["ru", "en"] as const) {
      const text = book.translations?.[locale];
      const selected = record.recommendedTexts[locale];
      expect(text?.description).toBe(selected.text);
      expect(hash(text?.description || "")).toBe(selected.textSha256);
      expect(text?.title).toBe(selected.title);
      expect(text?.status).toBe("reviewed");
      expect(text?.descriptionProvenance?.reviewedAt).toBe("2026-09-12");
      for (const url of selected.sourceUrls) {
        expect(text?.sourceUrls).toContain(url);
        expect(text?.descriptionProvenance?.sourceUrls).toContain(url);
        expect(book.sources?.some((source) => source.url === url && source.fields.includes("description"))).toBe(true);
      }
      expect(text?.titleEvidence).toEqual(book.localizedTitles?.[locale]);
      expect(text?.titleEvidence?.evidence.some((evidence) => evidence.authorityTier === "A")).toBe(true);
    }
  });

  it("preserves all 46 previously publishable records through the same evidence gate", () => {
    expect(review.baseline.readyKeys).toHaveLength(46);
    for (const key of review.baseline.readyKeys) {
      const book = byKey.get(key)!;
      expect(book, key).toBeDefined();
      expect(isPublicBook(book), key).toBe(true);
      expect(bookEvidenceV2Issues(book, context(book)), key).toEqual([]);
    }
  });

  it("preserves the complete key set, all 9751 non-target records and protected fields of the ten targets", () => {
    const canonical = (value: unknown): unknown => Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]))
        : value;
    const objectHash = (value: unknown) => hash(JSON.stringify(canonical(value)));
    const aggregate = (pairs: [string, string][]) => hash(pairs.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, sha]) => `${key}\0${sha}\n`).join(""));
    const targetKeys = new Set(attestation.runtime.newReadyKeys);
    const nonTargets = archive.filter((book) => !targetKeys.has(keyOf(book)));
    const protectedFields = new Set(attestation.runtime.protectedTargetFields);
    expect(archive).toHaveLength(attestation.runtime.canonicalCount);
    expect(hash(archive.map(keyOf).sort().join("\n") + "\n")).toBe(attestation.runtime.canonicalKeysSha256);
    expect(nonTargets).toHaveLength(attestation.runtime.nonTargetCount);
    expect(aggregate(nonTargets.map(({ country, writer, ...book }) => [
      `${book.countryId}:${book.writerId}:${book.id}`, objectHash(book),
    ]))).toBe(attestation.runtime.nonTargetRecordsSha256);
    expect(aggregate(archive.filter((book) => targetKeys.has(keyOf(book))).map((book) => [
      keyOf(book), objectHash(Object.fromEntries(Object.entries(book).filter(([field, value]) => protectedFields.has(field) && value !== undefined))),
    ]))).toBe(attestation.runtime.protectedTargetFieldsSha256);
    expect(archive.filter(isPublicBook).map(keyOf).sort()).toEqual([
      ...attestation.runtime.beforeReadyKeys, ...attestation.runtime.newReadyKeys,
    ].sort());
    expect(archive.filter(isPublicBook)).toHaveLength(attestation.runtime.afterReadyCount);
  });

  it("preserves later cover, edition, identity and other unrelated enrichment without mutating the input", () => {
    const current: WorkProfile = {
      id: "great-expectations",
      title: "Current catalog title",
      sourceUrl: "https://example.org/current-identity",
      coverUrl: "current-cover.webp",
      coverThumbnailUrl: "current-cover-thumb.webp",
      coverSourceUrl: "https://example.org/current-cover",
      coverRights: { status: "unverified", sourceUrl: "https://example.org/current-cover", note: "Current rights review" },
      edition: { title: "Current edition", publisher: "Current edition publisher", publicationYear: 2026 },
      genres: ["Current genre"],
      tags: ["Current tag"],
      alternateTitles: ["Current alternate title"],
      sources: [{
        url: "https://example.org/current-identity",
        provider: "Current source",
        fields: ["identity"],
        usage: "reference-only",
        retrievedAt: "2026-09-12",
      }],
    };
    const before = structuredClone(current);
    const result = applyBookR49nDickensReviewed20260912Work("england", "charles_dickens", current);
    expect(current).toEqual(before);
    for (const field of ["id", "title", "sourceUrl", "coverUrl", "coverThumbnailUrl", "coverSourceUrl", "coverRights", "edition", "genres", "tags", "alternateTitles"] as const) {
      expect(result[field], field).toEqual(before[field]);
    }
    expect(result.sources).toContainEqual(before.sources![0]);
    expect(applyBookR49nDickensReviewed20260912Work("england", "charles_dickens", result)).toEqual(result);
  });

  it("does not apply a matching work id under another author or country", () => {
    const unrelated = { id: "great-expectations", title: "Unrelated work" };
    expect(applyBookR49nDickensReviewed20260912Work("england", "another_writer", unrelated)).toBe(unrelated);
    expect(applyBookR49nDickensReviewed20260912Work("usa", "charles_dickens", unrelated)).toBe(unrelated);
    const untargeted = { id: "a-tale-of-two-cities", title: "A Tale of Two Cities" };
    expect(applyBookR49nDickensReviewed20260912Work("england", "charles_dickens", untargeted)).toBe(untargeted);
  });

  it("records AI review without relabelling it as human review or freshly read national title evidence", () => {
    expect(review.humanReview).toBe(false);
    for (const record of review.records) {
      expect(record.application.humanReview).toBe(false);
      expect(record.bibliographicChainFullyReaudited).toBe(false);
      const book = byKey.get(record.recordKey)!;
      expect(book.localizedTitles?.ru?.evidence.every((evidence) => evidence.checkedAt !== "2026-09-12")).toBe(true);
    }
  });
});
