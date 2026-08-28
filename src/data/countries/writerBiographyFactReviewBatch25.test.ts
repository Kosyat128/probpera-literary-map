import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH25_REVIEWER,
  writerBiographyFactReviewBatch25,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch25";

const expectedKeys = [
  "england:kazuo_ishiguro",
  "england:laurence_sterne",
  "england:lee_child",
  "england:liz_jensen",
  "england:lord_byron",
  "england:oliver_goldsmith",
  "england:oscar_wilde",
  "england:paula_hawkins",
  "england:percy_shelley",
  "england:rafael_sabatini",
  "england:roald_dahl",
  "england:robert_louis_stevenson",
  "england:ronald_delderfield",
  "england:rudyard_kipling",
  "england:samuel_coleridge",
  "england:samuel_richardson",
  "england:stuart_turton",
  "england:t_s_eliot",
  "england:thomas_hardy",
  "england:thomas_more",
] as const;

const frozenBatch24Keys = [
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

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch25.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch25.md"
);

function sourceTextForKey(key: string): string {
  const [countryId, writerId] = key.split(":");
  const writer = countries
    .find((country) => country.id === countryId)
    ?.writers.find((item) => item.id === writerId);
  if (!writer) throw new Error(`Writer not found: ${key}`);
  const text = legacyWriterBiography(writer);
  if (!text) throw new Error(`Legacy Russian biography not found: ${key}`);
  return text;
}

function sha256(text: string): string {
  return createHash("sha256")
    .update(Buffer.from(text, "utf8"))
    .digest("hex");
}

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

describe("writer biography claim review batch 25", () => {
  it("pins the next exact 20-key final-reviewQueue boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const priorKeys = priorReportKeys();
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const excluded = new Set<string>([
      ...priorKeys,
      ...frozenBatch24Keys,
      ...quarantineKeys,
    ]);
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const keys = writerBiographyFactReviewBatch25.map((record) => record.key);

    // The public corpus and quarantine continue to evolve as later frozen
    // batches are integrated. Keep this historical allocation test focused on
    // its exact keys and non-overlap instead of pinning a mutable queue size.
    expect(reviewQueueKeys).toHaveLength(new Set(reviewQueueKeys).size);
    expect(priorKeys).toHaveLength(460);
    expect(new Set(priorKeys).size).toBe(460);
    expect(frozenBatch24Keys).toHaveLength(20);
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

    for (const record of writerBiographyFactReviewBatch25) {
      const originalText = sourceTextForKey(record.key);
      const sentenceCount =
        record.reviewedTextRu.match(/[.!?…]+(?=\s|$)/gu)?.length ?? 0;

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(originalText);
      expect(originalText).not.toContain(String.fromCharCode(0xfffd));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(80);
      expect(sentenceCount).toBeGreaterThanOrEqual(1);
      expect(sentenceCount, record.key).toBeLessThanOrEqual(3);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH25_REVIEWER
      );
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);

      if (record.decision === "held") {
        expect(record.applicableTextRu).toBeNull();
        expect(
          record.claims.every((claim) => claim.verdict === "not-established")
        ).toBe(true);
      } else if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(
          record.claims.every((claim) => claim.verdict === "supported")
        ).toBe(true);
      } else {
        expect(record.reviewedTextRu).not.toBe(originalText);
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

    const decisions = writerBiographyFactReviewBatch25.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(5);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(15);
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
      writerBiographyFactReviewBatch25.map((record) => [record.key, record])
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
    const buildReviewSource = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/writer-biography-review-source.ts"),
      "utf8"
    );

    expect(identityItems).toEqual([]);
    expect(dateItems).toEqual([]);
    expect(badQidItems).toEqual([]);
    expect(calendarItems).toEqual([]);
    expect(byKey.get("england:lee_child")?.notes).toContain("Q333719");
    expect(byKey.get("england:paula_hawkins")?.notes).toContain("Q20732317");
    expect(byKey.get("england:rafael_sabatini")?.notes).toContain("Q345104");
    expect(byKey.get("england:stuart_turton")?.notes).toContain("Q55474411");
    expect(byKey.get("england:t_s_eliot")?.notes).toContain("Q37767");
    expect(byKey.get("england:t_s_eliot")?.notes).toContain("сокращённой");
    expect(byKey.get("england:oliver_goldsmith")?.notes).toContain("1728");
    expect(byKey.get("england:oliver_goldsmith")?.notes).toContain("1730");
    expect(byKey.get("england:oliver_goldsmith")?.notes).toContain("1728-11-10");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch25");
    expect(buildReviewSource).toContain("writerBiographyFactReviewBatch25");
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch25.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch25.test.ts"
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
      summary: {
        records: number;
        unchanged: number;
        corrected: number;
        held: number;
      };
      records: WriterBiographyFactReviewRecord[];
    };
    const markdown = fs.readFileSync(markdownReportPath, "utf8");

    expect(report.batch).toBe("25");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 5,
      corrected: 15,
      held: 0,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch25);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 5");
    expect(markdown).toContain("Исправлено: 15");
    expect(markdown).toContain("Удержано в карантине: 0");
    expect(markdown).toContain("Q333719");
    expect(markdown).toContain("Q37767");
    expect(markdown).toContain("1728-11-10");
    expect(markdown).toContain("1728 и 1730");
  });
});
