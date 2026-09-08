import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type {
  WriterBiographyEditorialReviewProfile,
  WriterBiographyTranslationProfile,
  WriterProfile,
} from "./countries/types";
import {
  WRITER_BIOGRAPHY_REVIEW_HASH_CONTRACT,
  writerBiographyEditorialReviewIssues,
  writerBiographyReviewSourceHash,
  writerBiographyReviewTargetHash,
} from "./biographyEditorialReview";

function fixture() {
  const source: WriterBiographyTranslationProfile = {
    locale: "ru",
    text: "Русский исходный текст. Точный текст для синтетического теста.",
    sourceLanguage: "ru",
    method: "editorial-original",
    status: "verified",
    reviewedAt: "2026-09-08",
    reviewer: "Fixture source editor",
    sourceTextRights: "project-original",
    sources: [
      {
        provider: "Synthetic archive fixture",
        url: "https://example.org/fixture/biography",
        fields: ["identity", "biography-facts"],
        usage: "fact-check",
        retrievedAt: "2026-09-08",
      },
    ],
  };
  const target: WriterBiographyTranslationProfile = {
    locale: "en",
    text: "English target text. Exact text for a synthetic test fixture.",
    sourceLanguage: "ru",
    method: "machine-translation",
    status: "reviewed",
    reviewedAt: "2026-09-08",
    reviewer: "Fixture human editor",
    translatedFromLocale: "ru",
    sourceTextRights: "project-original",
    sources: structuredClone(source.sources),
    translationMeta: {
      model: "fixture-translator",
      reviewerModel: "fixture-draft-checker",
      sourceHash: `sha256:${"a".repeat(64)}`,
      generatedAt: "2026-09-08T08:00:00.000Z",
    },
  };
  const writer: WriterProfile = {
    id: "synthetic-writer",
    name: "Синтетический писатель",
    biographyTranslations: { ru: source, en: target },
  };
  // This attestation is exclusively a unit-test fixture, never catalog data.
  target.editorialReview = {
    schemaVersion: 1,
    decision: "approved",
    reviewerType: "human",
    reviewer: target.reviewer!,
    reviewedAt: target.reviewedAt!,
    evidenceRef: "editorial-review:synthetic-fixture-001",
    hashContract: WRITER_BIOGRAPHY_REVIEW_HASH_CONTRACT,
    sourceHash: writerBiographyReviewSourceHash(writer, "ru")!,
    targetHash: writerBiographyReviewTargetHash(target),
  };
  return { writer, source, target };
}

// Independent reference uses Node SHA256, unavailable to the browser helper.
function referenceHash(value: unknown): string {
  function sorted(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(sorted);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input)
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([key, nested]) => [key, sorted(nested)])
      );
    }
    return input;
  }
  return createHash("sha256").update(JSON.stringify(sorted(value)), "utf8").digest("hex");
}

function reverseKeys<T>(input: T): T {
  if (Array.isArray(input)) return input.map(reverseKeys) as T;
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).reverse().map(([key, value]) => [key, reverseKeys(value)])
    ) as T;
  }
  return input;
}

describe("writer biography editorial review integrity", () => {
  it("matches independent Node SHA256 for the explicit versioned envelopes", () => {
    const { writer, source, target } = fixture();
    expect(writerBiographyReviewSourceHash(writer, "ru")).toBe(referenceHash({
      hashContract: "writer-biography-review-v1",
      kind: "source",
      writer: { id: writer.id, name: writer.name },
      sourceLocale: "ru",
      profile: {
        locale: source.locale,
        text: source.text,
        sourceLanguage: source.sourceLanguage,
        method: source.method,
        translatedFromLocale: source.translatedFromLocale,
        sourceTextRights: source.sourceTextRights,
        sources: source.sources,
        translationMeta: source.translationMeta,
        status: source.status,
        reviewedAt: source.reviewedAt,
        reviewer: source.reviewer,
        editorialReview: source.editorialReview,
      },
    }));
    expect(writerBiographyReviewTargetHash(target)).toBe(referenceHash({
      hashContract: "writer-biography-review-v1",
      kind: "target",
      profile: {
        locale: target.locale,
        text: target.text,
        sourceLanguage: target.sourceLanguage,
        method: target.method,
        translatedFromLocale: target.translatedFromLocale,
        sourceTextRights: target.sourceTextRights,
        sources: target.sources,
        translationMeta: target.translationMeta,
      },
    }));
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual([]);
  });

  it("is stable across object key order but binds array order and exact whitespace", () => {
    const { writer, target } = fixture();
    expect(writerBiographyReviewSourceHash(reverseKeys(writer), "ru")).toBe(
      writerBiographyReviewSourceHash(writer, "ru")
    );
    expect(writerBiographyReviewTargetHash(reverseKeys(target))).toBe(
      writerBiographyReviewTargetHash(target)
    );
    target.sources[0].fields.reverse();
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["target-changed"]);
    target.sources[0].fields.reverse();
    target.text += "\n";
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["target-changed"]);
  });

  it.each([
    ["writer id", ({ writer }) => { writer.id += "-other"; }],
    ["writer name", ({ writer }) => { writer.name += " другой"; }],
    ["writer full name", ({ writer }) => { writer.fullName = "Другое полное имя"; }],
    ["source text", ({ source }) => { source.text += " "; }],
    ["source language", ({ source }) => { source.sourceLanguage = "Russian"; }],
    ["source method", ({ source }) => { source.method = "licensed-source"; }],
    ["source status", ({ source }) => { source.status = "draft"; }],
    ["source review date", ({ source }) => { source.reviewedAt = "2026-09-07"; }],
    ["source reviewer", ({ source }) => { source.reviewer = "Another fixture editor"; }],
    ["source rights", ({ source }) => { source.sourceTextRights = "permission"; }],
    ["source evidence", ({ source }) => { source.sources[0].url += "-corrected"; }],
    ["source metadata", ({ source }) => { source.translationMeta = { model: "fixture-model" }; }],
    ["source review decision", ({ source, target }) => { source.editorialReview = structuredClone(target.editorialReview!); }],
  ] satisfies Array<[string, (data: ReturnType<typeof fixture>) => void]>) (
    "invalidates a supplied review after changing %s",
    (_label, mutate) => {
      const data = fixture();
      mutate(data);
      expect(writerBiographyEditorialReviewIssues(data.target, data.writer)).toEqual(["source-changed"]);
    }
  );

  it("uses the specified trimmed fullName/name/id fallback, while keeping id exact", () => {
    const { writer } = fixture();
    const original = writerBiographyReviewSourceHash(writer, "ru");
    writer.fullName = `  ${writer.name}  `;
    expect(writerBiographyReviewSourceHash(writer, "ru")).toBe(original);
    delete writer.fullName;
    delete writer.name;
    const fallback = writerBiographyReviewSourceHash(writer, "ru");
    writer.name = writer.id;
    expect(writerBiographyReviewSourceHash(writer, "ru")).toBe(fallback);
    expect(fallback).not.toBe(original);
  });

  it.each([
    ["source language", (target) => { target.sourceLanguage = "Russian"; }],
    ["method", (target) => { target.method = "human-translation"; }],
    ["rights", (target) => { target.sourceTextRights = "licensed"; }],
    ["evidence", (target) => { target.sources[0].retrievedAt = "2026-09-07"; }],
    ["legacy source hash", (target) => { target.translationMeta!.sourceHash = "b".repeat(64); }],
    ["generation provenance", (target) => { target.translationMeta!.model = "another-fixture-model"; }],
    ["post-edit provenance", (target) => { target.translationMeta!.editorialPostEditor = "Fixture post editor"; }],
  ] satisfies Array<[string, (target: WriterBiographyTranslationProfile) => void]>) (
    "invalidates target approval when %s changes",
    (_label, mutate) => {
      const { writer, target } = fixture();
      mutate(target);
      expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["target-changed"]);
    }
  );

  it("keeps target approval declarations out of the hash but requires them to agree", () => {
    const { writer, target } = fixture();
    const hash = writerBiographyReviewTargetHash(target);
    target.status = "draft";
    expect(writerBiographyReviewTargetHash(target)).toBe(hash);
    // Publication status is deliberately enforced by the existing quality gate.
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual([]);
    target.reviewer = "Another fixture editor";
    target.reviewedAt = "2026-09-07";
    expect(writerBiographyReviewTargetHash(target)).toBe(hash);
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["invalid-review"]);
    delete target.editorialReview;
    expect(writerBiographyReviewTargetHash(target)).toBe(hash);
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["missing-review"]);
  });

  it.each(["rejected", "withdrawn"] as const)("refuses a %s review", (decision) => {
    const { writer, target } = fixture();
    target.editorialReview!.decision = decision;
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["not-approved"]);
  });

  it.each([
    ["schemaVersion", 2],
    ["decision", "pending"],
    ["reviewerType", "machine"],
    ["reviewer", ""],
    ["reviewer", " ".repeat(4)],
    ["reviewer", "x".repeat(241)],
    ["reviewer", "Fixture\neditor"],
    ["reviewedAt", "2026-02-30"],
    ["reviewedAt", "2026-09-08T00:00:00Z"],
    ["reviewedAt", "0000-01-01"],
    ["evidenceRef", "http://example.org/review"],
    ["evidenceRef", "https://fixture:password@example.org/review"],
    ["evidenceRef", "https://example.org/review\n"],
    ["evidenceRef", "editorial-review:"],
    ["evidenceRef", `editorial-review:${"a".repeat(201)}`],
    ["hashContract", "legacy-source-hash"],
    ["sourceHash", `sha256:${"a".repeat(64)}`],
    ["targetHash", "A".repeat(64)],
  ])("rejects malformed review field %s=%s", (key, value) => {
    const { writer, target } = fixture();
    Object.assign(target.editorialReview!, { [key]: value });
    if (key === "reviewer" || key === "reviewedAt") Object.assign(target, { [key]: value });
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["invalid-review"]);
  });

  it("accepts real leap dates and safe HTTPS evidence without altering target bytes", () => {
    const { writer, target } = fixture();
    target.reviewedAt = "2024-02-29";
    target.editorialReview!.reviewedAt = target.reviewedAt;
    target.editorialReview!.evidenceRef = "https://example.org/reviews/fixture?revision=1#decision";
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual([]);
  });

  it("reports absent or malformed review without synthesizing one", () => {
    const { writer, target } = fixture();
    delete target.editorialReview;
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["missing-review"]);
    expect(target.editorialReview).toBeUndefined();
    target.editorialReview = [] as unknown as WriterBiographyEditorialReviewProfile;
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["invalid-review"]);
  });

  it("refuses missing, invalid and same-locale sources and never falls back to legacy bio", () => {
    const { writer, target } = fixture();
    expect(writerBiographyReviewSourceHash(writer, "fr")).toBeNull();
    expect(writerBiographyReviewSourceHash(undefined, "ru")).toBeNull();
    expect(writerBiographyEditorialReviewIssues(target, undefined)).toEqual(["missing-source"]);
    target.translatedFromLocale = "en";
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["target-changed", "missing-source"]);
    target.translatedFromLocale = "ru";
    delete writer.biographyTranslations!.ru;
    writer.bio = "Legacy text cannot stand in for the reviewed source profile.";
    expect(writerBiographyReviewSourceHash(writer, "ru")).toBeNull();
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["missing-source"]);
    delete target.editorialReview;
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["missing-review", "missing-source"]);
  });

  it("refuses a source profile whose own locale or text is invalid", () => {
    const { writer, source, target } = fixture();
    source.locale = "en";
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["missing-source"]);
    source.locale = "ru";
    source.text = " \n ";
    expect(writerBiographyReviewSourceHash(writer, "ru")).toBeNull();
  });

  it("reports both changed hashes and preserves the legacy provenance field", () => {
    const { writer, source, target } = fixture();
    const legacyHash = target.translationMeta!.sourceHash;
    source.text += " Corrected source.";
    target.text += " Corrected translation.";
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["source-changed", "target-changed"]);
    expect(target.translationMeta!.sourceHash).toBe(legacyHash);
  });

  it("fails closed for non-JSON provenance instead of hashing a different representation", () => {
    const { writer, source, target } = fixture();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    source.translationMeta = cyclic;
    expect(writerBiographyReviewSourceHash(writer, "ru")).toBeNull();
    target.translationMeta = cyclic;
    expect(() => writerBiographyReviewTargetHash(target)).toThrow(TypeError);
    expect(writerBiographyEditorialReviewIssues(target, writer)).toEqual(["invalid-review", "missing-source"]);
  });
});
