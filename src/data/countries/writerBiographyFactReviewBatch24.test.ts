import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
  ["england:hilary_mantel", "21ee178593bbefa613e81495daa875bc3d35089f3ba81feeee9a751bf2f36622"],
  ["england:ian_mcewan", "62554679df32c1b3efa63d39c2e40f4fec9398503cfbbad422ff4834a5d8ab5a"],
  ["england:j_r_r_tolkien", "598ed7c7e6c8844fbd844884acd38514f3991761268b50d6643b8591d4b9378d"],
  ["england:jane_austen", "a81f6cbd0e51cdec54fc0cc5e656578409ff0111e5294306fea10f34ee705585"],
  ["england:joanne_harris", "6512e8afc7f32ee6f1aef52f22d3ab58d13ee3771d618ebbc93d141a08734ebf"],
  ["england:john_bunyan", "ed6cbd0879af358c6f5d892381e4d263d94fb292be6b0280b777ec6c728e4377"],
  ["england:john_donne", "ef0eaf0f13c3ad4f5f119d71582ca416a81b3a1430313296a25bb909e7c22250"],
  ["england:john_fowles", "5d0e636a5159f470588fcdcf67ea7e75b786dc47e1a6be1e5dff60078acdd001"],
  ["england:john_galsworthy", "36106e63dc5cef10dcb80abcce232ed084c049c9c84d5b62014b652a8d847604"],
  ["england:john_keats", "9417e3caafdedcc1c277bcdd58c0b8d17d755f254d0a0485484d398380b1401d"],
  ["england:john_le_carre", "8e434b6d90717234085d0729213da24d77aab8ee0d970c5fcd255108628a0b61"],
  ["england:john_marrs", "cfed816004cecc2425d0ad0bbd205c6155d15cf2ad895f66cd4077bbe1dc013b"],
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
      /(?:^|[\s:—-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;—-])/iu;

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
    const identityItems = factQa.wikidataIdentityReviewQueue
      .filter((item) => batchKeys.has(item.key))
      .map(({ key, qid }) => ({ key, qid }));
    const dateItems = factQa.wikidataDateDiscrepancyQueue
      .filter((item) => batchKeys.has(item.key))
      .map(({ key, field }) => ({ key, field }));
    const badQidItems = factQa.badQidIdentityQueue.filter((item) =>
      batchKeys.has(item.key)
    );
    const calendarItems = factQa.calendarOrSourceDiscrepancyQueue.filter((item) =>
      batchKeys.has(item.key)
    );
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8"
    );
    const aggregator = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviews.ts"),
      "utf8"
    );

    expect(identityItems).toEqual([]);
    expect(dateItems).toEqual([]);
    expect(badQidItems).toEqual([]);
    expect(calendarItems).toEqual([]);
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
