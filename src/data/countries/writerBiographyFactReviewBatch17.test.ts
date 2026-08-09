import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH17_REVIEWER,
  writerBiographyFactReviewBatch17,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch17";

const expectedKeys = [
  "chile:lina_meruane",
  "chile:luis_sepúlveda",
  "chile:marcela_serrano",
  "chile:marta_brunet",
  "chile:nicanor_parra",
  "chile:pablo_neruda",
  "chile:raul_zurita",
  "chile:roberto_bolano",
  "chile:vicente_huidobro",
  "china:ai_qing",
  "china:ba_jin",
  "china:bai_juyi",
  "china:bei_dao",
  "china:can_xue",
  "china:cao_xueqin",
  "china:chi_ziqiang",
  "china:chiang_sheng_tao",
  "china:confucius",
  "china:du_fu",
  "china:gao_xingjian",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch17.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch17.md"
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
  for (let batch = 1; batch <= 16; batch += 1) {
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

describe("writer biography claim review batch 17", () => {
  it("pins the next exact 20-key final-reviewQueue boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const excluded = new Set<string>([
      ...priorReportKeys(),
      ...quarantineKeys,
    ]);
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const eligible = reviewQueueKeys
      .slice()
      .sort()
      .filter((key) => !excluded.has(key));
    const keys = writerBiographyFactReviewBatch17.map((record) => record.key);

    expect(reviewQueueKeys).toHaveLength(new Set(reviewQueueKeys).size);
    expect(keys).toEqual(expectedKeys);
    expect(keys).toEqual(eligible.slice(0, 20));
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => excluded.has(key))).toBe(false);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins raw source hashes, professional Russian and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш)/iu;
    const publicReviewMarker =
      /(?:^|[\s:—-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;—-])/iu;

    for (const record of writerBiographyFactReviewBatch17) {
      const originalText = sourceTextForKey(record.key);
      const sentenceText = record.reviewedTextRu
        .replace(/ок\./gu, "ок")
        .replace(/н\.\s*э\./gu, "н э");
      const sentenceCount =
        sentenceText.match(/[.!?…]+(?=\s|$)/gu)?.length ?? 0;

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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH17_REVIEWER
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

    const decisions = writerBiographyFactReviewBatch17.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(1);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(19);
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
      writerBiographyFactReviewBatch17.map((record) => [record.key, record])
    );
    const identityItems = factQa.wikidataIdentityReviewQueue.filter((item) =>
      batchKeys.has(item.key)
    );
    const dateItems = factQa.wikidataDateDiscrepancyQueue.filter((item) =>
      batchKeys.has(item.key)
    );
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
    const runtimeReviewAggregator = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviews.ts"),
      "utf8"
    );

    // The Batch 17 identity and date recommendations were resolved during the
    // shared integration pass, so neither may remain in the live QA queues.
    expect(identityItems).toEqual([]);
    expect(dateItems).toEqual([]);
    expect(badQidItems).toEqual([]);
    expect(calendarItems).toEqual([]);
    expect(byKey.get("chile:lina_meruane")?.notes).toContain("1970-05-25");
    expect(byKey.get("chile:lina_meruane")?.notes).toContain("1970-09-20");
    expect(byKey.get("china:cao_xueqin")?.notes).toContain("ок. 1715");
    expect(byKey.get("china:chi_ziqiang")?.notes).toContain("1964");
    expect(byKey.get("china:chi_ziqiang")?.notes).toContain("chi_zijian");
    expect(byKey.get("china:chiang_sheng_tao")?.notes).toContain("zhou_zuoren");
    expect(byKey.get("china:confucius")?.notes).toContain("нулевого дополнения");
    expect(byKey.get("china:du_fu")?.notes).toContain("нулевым дополнением");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch17");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch17"
    );
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch17.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch17.test.ts"
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

    expect(report.batch).toBe("17");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 1,
      corrected: 19,
      held: 0,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch17);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 1");
    expect(markdown).toContain("Исправлено: 19");
    expect(markdown).toContain("Удержано в карантине: 0");
    expect(markdown).toContain("1970-09-20");
    expect(markdown).toContain("chi_zijian");
    expect(markdown).toContain("zhou_zuoren");
  });
});
