import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expectNoProvenLiveFactRegression } from "./writerBiographyFactReviewBatch.generated-test-support";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH24_REVIEWER,
  writerBiographyFactReviewBatch24,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch24";

const expectedKeys = [
  "england:george_eliot",
  "england:george_orwell",
  "england:graham_greene",
  "england:h_g_wells",
  "england:harold_pinter",
  "england:henry_fielding",
  "england:hilary_mantel",
  "england:ian_mcewan",
  "england:j_r_r_tolkien",
  "england:jane_austen",
  "england:joanne_harris",
  "england:john_bunyan",
  "england:john_donne",
  "england:john_fowles",
  "england:john_galsworthy",
  "england:john_keats",
  "england:john_le_carre",
  "england:john_marrs",
  "england:john_milton",
  "england:jonathan_swift",
] as const;

const expectedOriginalSha256 = new Map<string, string>([
  ["england:george_eliot", "6a213a5612a751ec1c12d3cd1794609f949573cea53119bd00cb1e2641e33524"],
  ["england:george_orwell", "1a1a3d581631292b559547d44f68404eb13cf257b4da4b88e16c9ae52c4510a8"],
  ["england:graham_greene", "90c784152a62774a48dcfee666771d4924ae0d814d86a9caa9a7261cd020b6de"],
  ["england:h_g_wells", "4355ae6552ab168b5c9f77d15737eb545122ed715dfcebf9153dd7143173b6ad"],
  ["england:harold_pinter", "a421a1b2e924c68c25a2555025a74495c2e207be8c68db2c15741495cefa7dd9"],
  ["england:henry_fielding", "6b1514fbb3f50bb123dae06e3ed779bcfed2148276ab77fa3a1e3f194344c40d"],
  ["england:hilary_mantel", "e71b83463302aaade8d7bbb9bf4da920b9819f0b523cc18c91ee2cc2b298db2e"],
  ["england:ian_mcewan", "e415b4a9a22ee958a8d3935136c74443639947e07920086b14604710f2fcd4d6"],
  ["england:j_r_r_tolkien", "598ed7c7e6c8844fbd844884acd38514f3991761268b50d6643b8591d4b9378d"],
  ["england:jane_austen", "a81f6cbd0e51cdec54fc0cc5e656578409ff0111e5294306fea10f34ee705585"],
  ["england:joanne_harris", "6d5605fd1291769a8c23a88f475bc32d1bc5a9591f4cb0da0491b9cfc6e9488b"],
  ["england:john_bunyan", "ed6cbd0879af358c6f5d892381e4d263d94fb292be6b0280b777ec6c728e4377"],
  ["england:john_donne", "ef0eaf0f13c3ad4f5f119d71582ca416a81b3a1430313296a25bb909e7c22250"],
  ["england:john_fowles", "9eb8c4ff190db88661df8ec1684c69e49b2b421217f3c3839aac70e5b901fc49"],
  ["england:john_galsworthy", "36106e63dc5cef10dcb80abcce232ed084c049c9c84d5b62014b652a8d847604"],
  ["england:john_keats", "9417e3caafdedcc1c277bcdd58c0b8d17d755f254d0a0485484d398380b1401d"],
  ["england:john_le_carre", "1906e3ce1368143ce299525059538d9b0de03f27844a458cc9eb2e4917cae086"],
  ["england:john_marrs", "fb8ea4eba3bb3df9832b30b06b8e8f6aa43ebd0374fcd1c4e7f3a7887e2faea7"],
  ["england:john_milton", "398a5e2d7ab9fe6ce4354c548f93156fcb871bf47a463f959abb580cd2bfc09e"],
  ["england:jonathan_swift", "550400efd5e8b850acb16a031254b7ad76ee373ae64a694918bab321a4f70446"],
]);

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch24.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch24.md"
);

function priorReportKeys(): string[] {
  const keys: string[] = [];
  for (let batch = 1; batch <= 23; batch += 1) {
    const suffix = String(batch).padStart(2, "0");
    const report = JSON.parse(
      fs.readFileSync(
        path.resolve(
          process.cwd(),
          `reports/writer-biography-fact-review-batch${suffix}.json`
        ),
        "utf8"
      )
    ) as { records: Array<{ key: string }> };
    keys.push(...report.records.map((record) => record.key));
  }
  return keys;
}

describe("writer biography claim review batch 24", () => {
  it("pins the next exact 20-key frozen final-reviewQueue boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const assignedKeys = priorReportKeys();
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const excluded = new Set<string>([...assignedKeys, ...quarantineKeys]);
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const keys = writerBiographyFactReviewBatch24.map((record) => record.key);

    expect(reviewQueueKeys).toHaveLength(new Set(reviewQueueKeys).size);
    expect(assignedKeys).toHaveLength(460);
    expect(new Set(assignedKeys).size).toBe(460);
    expect(new Set(quarantineKeys).size).toBe(quarantineKeys.length);
    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => excluded.has(key))).toBe(false);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins raw source hashes, professional Russian and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch24) {
      const sentenceText = record.reviewedTextRu
        .replace(/ок\./gu, "ок")
        .replace(/н\.\s*э\./gu, "н э");
      const sentenceCount =
        sentenceText.match(/[.!?…]+(?=\s|$)/gu)?.length ?? 0;

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(expectedOriginalSha256.get(record.key));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(80);
      expect(sentenceCount, record.key).toBeGreaterThanOrEqual(2);
      expect(sentenceCount, record.key).toBeLessThanOrEqual(3);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH24_REVIEWER
      );
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);

      if (record.decision === "held") {
        expect(record.applicableTextRu).toBeNull();
        expect(
          record.claims.every((claim) => claim.verdict === "not-established")
        ).toBe(true);
      } else if (record.decision === "unchanged") {
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(
          record.claims.every((claim) => claim.verdict === "supported")
        ).toBe(true);
      } else {
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(
          record.claims.every((claim) => claim.verdict === "corrected")
        ).toBe(true);
      }

      for (const claim of record.claims) {
        const hostnames = new Set(
          claim.evidence.map((item) => new URL(item.url).hostname)
        );
        expect(claim.textRu.trim()).not.toBe("");
        expect(claim.evidence.length).toBeGreaterThanOrEqual(2);
        expect(hostnames.size).toBeGreaterThanOrEqual(2);
        for (const item of claim.evidence) {
          expect(item.provider.trim()).not.toBe("");
          expect(item.checkedAt).toBe("2026-08-09");
          expect(item.findingRu.trim()).not.toBe("");
          expect(item.findingRu).toMatch(/[А-Яа-яЁё]/);
          const parsedUrl = new URL(item.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }

    const decisions = writerBiographyFactReviewBatch24.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(0);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(20);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(0);
  });

  it("records identity and date recommendations without touching shared runtime", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(
      writerBiographyFactReviewBatch24.map((record) => [record.key, record])
    );
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8"
    );
    const aggregator = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviews.ts"),
      "utf8"
    );

    expectNoProvenLiveFactRegression(factQa, batchKeys);
    expect(byKey.get("england:hilary_mantel")?.notes).toContain("Q465700");
    expect(byKey.get("england:hilary_mantel")?.notes).toContain("1952-07-06");
    expect(byKey.get("england:hilary_mantel")?.notes).toContain("2022-09-22");
    expect(byKey.get("england:ian_mcewan")?.notes).toContain("Q190379");
    expect(byKey.get("england:ian_mcewan")?.notes).toContain("1948-06-21");
    expect(byKey.get("england:joanne_harris")?.notes).toContain("Q234718");
    expect(byKey.get("england:joanne_harris")?.notes).toContain("1964");
    expect(byKey.get("england:john_le_carre")?.notes).toContain("Q209641");
    expect(byKey.get("england:john_le_carre")?.notes).toContain("1931-10-19");
    expect(byKey.get("england:john_le_carre")?.notes).toContain("2020-12-12");
    expect(byKey.get("england:john_marrs")?.notes).toContain("Q64014274");
    expect(byKey.get("england:john_marrs")?.notes).toContain("birthDate не установлен");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch24");
    expect(aggregator).not.toContain("writerBiographyFactReviewBatch24");
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch24.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch24.test.ts"
      ),
      reportPath,
      markdownReportPath,
    ];
    for (const sourcePath of sourcePaths) {
      const bytes = fs.readFileSync(sourcePath);
      const utf8 = bytes.toString("utf8");
      expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(
        false
      );
      expect(utf8).not.toContain(String.fromCharCode(0xfffd));
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      batch: string;
      generatedAt: string;
      boundarySnapshot: {
        reviewQueue: number;
        assignedRecords: number;
        assignedUnique: number;
        quarantine: number;
        eligible: number;
        boundary: number;
        boundaryUnique: number;
        overlapAssigned: number;
        overlapQuarantine: number;
      };
      summary: {
        records: number;
        unchanged: number;
        corrected: number;
        held: number;
      };
      records: WriterBiographyFactReviewRecord[];
    };
    const markdown = fs.readFileSync(markdownReportPath, "utf8");

    expect(report.batch).toBe("24");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.boundarySnapshot).toEqual({
      reviewQueue: 1722,
      assignedRecords: 460,
      assignedUnique: 460,
      quarantine: 46,
      eligible: 1279,
      boundary: 20,
      boundaryUnique: 20,
      overlapAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 0,
      corrected: 20,
      held: 0,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch24);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 0");
    expect(markdown).toContain("Исправлено: 20");
    expect(markdown).toContain("Удержано в карантине: 0");
    expect(markdown).toContain("Q465700");
    expect(markdown).toContain("1952-07-06");
    expect(markdown).toContain("2022-09-22");
    expect(markdown).toContain("Q64014274");
    expect(markdown).toContain("birthDate");
  });
});
