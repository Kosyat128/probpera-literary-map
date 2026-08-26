import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH18_REVIEWER,
  writerBiographyFactReviewBatch18,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch18";

const expectedKeys = [
  "china:gong_zi_zhen",
  "china:han_han",
  "china:jia_pingwa",
  "china:lao_she",
  "china:lao_tzu",
  "china:li_bai",
  "china:lu_xun",
  "china:luo_guanzhong",
  "china:mao_dun",
  "china:mo_yan",
  "china:pu_songling",
  "china:shi_naian",
  "china:sima_qian",
  "china:su_tong",
  "china:tao_yuanming",
  "china:wang_meng",
  "china:wang_wei",
  "china:wu_chengen",
  "china:yan_lianke",
  "china:yu_hua",
] as const;

const frozenBatch17Keys = [
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
  "reports/writer-biography-fact-qa.json",
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch18.json",
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch18.md",
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
          `reports/writer-biography-fact-review-batch${suffix}.json`,
        ),
        "utf8",
      ),
    ) as { records: Array<{ key: string }> };
    keys.push(...report.records.map((record) => record.key));
  }
  return keys;
}

describe("writer biography claim review batch 18", () => {
  it("pins the next exact 20-key final-reviewQueue boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`,
    );
    const excluded = new Set<string>([
      ...priorReportKeys(),
      ...frozenBatch17Keys,
      ...quarantineKeys,
    ]);
    const eligible = factQa.reviewQueue
      .map((item) => item.key)
      .sort()
      .filter((key) => !excluded.has(key));
    const keys = writerBiographyFactReviewBatch18.map((record) => record.key);

    expect(keys).toEqual(expectedKeys);
    expect(keys).toEqual(eligible.slice(0, 20));
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => excluded.has(key))).toBe(false);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins source SHA, professional Russian and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|ведущ|важнейш|главнейш)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch18) {
      const originalText = sourceTextForKey(record.key);

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(
        originalText,
      );
      expect(originalText).not.toContain(String.fromCharCode(0xfffd));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(30);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH18_REVIEWER,
      );
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);

      if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(
          record.claims.some((claim) => claim.verdict === "supported"),
        ).toBe(true);
      } else if (record.decision === "corrected") {
        expect(record.reviewedTextRu).not.toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(
          record.claims.some((claim) => claim.verdict === "corrected"),
        ).toBe(true);
      } else {
        expect(record.applicableTextRu).toBeNull();
        expect(
          record.claims.some(
            (claim) => claim.verdict === "not-established",
          ),
        ).toBe(true);
      }

      for (const claim of record.claims) {
        const hostnames = new Set(
          claim.evidence.map((item) => new URL(item.url).hostname),
        );
        expect(claim.textRu.trim()).not.toBe("");
        expect(claim.evidence.length).toBeGreaterThanOrEqual(2);
        expect(hostnames.size).toBeGreaterThanOrEqual(2);
        for (const item of claim.evidence) {
          expect(item.provider.trim()).not.toBe("");
          expect(item.checkedAt).toBe("2026-08-09");
          expect(item.findingRu.trim()).not.toBe("");
          const parsedUrl = new URL(item.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }

    const decisions = writerBiographyFactReviewBatch18.map(
      (record) => record.decision,
    );
    expect(
      decisions.filter((decision) => decision === "unchanged"),
    ).toHaveLength(2);
    expect(
      decisions.filter((decision) => decision === "corrected"),
    ).toHaveLength(18);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(
      0,
    );
  });

  it("records resolved QA recommendations and connects the compact runtime overlay", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
      manualResolutionQueue: Array<{
        key: string;
        field: string;
        cardValue: string;
      }>;
      records: Array<{
        key: string;
        wikidataEvidence: {
          manualIdentityConfirmation: { qid: string } | null;
        };
      }>;
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(
      writerBiographyFactReviewBatch18.map((record) => [record.key, record]),
    );
    const identityItems = factQa.wikidataIdentityReviewQueue.filter((item) =>
      batchKeys.has(item.key),
    );
    const dateItems = factQa.wikidataDateDiscrepancyQueue.filter((item) =>
      batchKeys.has(item.key),
    );
    const badQidItems = factQa.badQidIdentityQueue.filter((item) =>
      batchKeys.has(item.key),
    );
    const calendarItems = factQa.calendarOrSourceDiscrepancyQueue.filter(
      (item) => batchKeys.has(item.key),
    );
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8",
    );
    const runtimeReviewAggregator = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviews.ts",
      ),
      "utf8",
    );
    const buildReviewRegistry = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "scripts/writer-biography-review-source.ts",
      ),
      "utf8",
    );

    expect(identityItems).toEqual([]);
    expect(dateItems).toEqual([]);
    expect(badQidItems).toEqual([]);
    expect(calendarItems).toEqual([]);
    expect(
      factQa.records
        .filter((item) => batchKeys.has(item.key))
        .filter((item) => item.wikidataEvidence.manualIdentityConfirmation)
        .map((item) => [
          item.key,
          item.wikidataEvidence.manualIdentityConfirmation?.qid,
        ])
        .sort(),
    ).toEqual([
      ["china:lao_tzu", "Q9333"],
      ["china:luo_guanzhong", "Q264517"],
      ["china:shi_naian", "Q1777502"],
      ["china:sima_qian", "Q9372"],
      ["china:wu_chengen", "Q228889"],
    ]);
    expect(
      factQa.manualResolutionQueue
        .filter((item) => batchKeys.has(item.key))
        .map((item) => `${item.key}:${item.field}:${item.cardValue}`),
    ).toEqual(["china:su_tong:birthDate:1963-01-23"]);
    expect(byKey.get("china:lao_tzu")?.notes).toContain("историчность");
    expect(byKey.get("china:luo_guanzhong")?.notes).toContain("ок. 1330");
    expect(byKey.get("china:shi_naian")?.notes).toContain("приблизительный");
    expect(byKey.get("china:sima_qian")?.notes).toContain("ок. 145/135");
    expect(byKey.get("china:su_tong")?.notes).toContain("1963-01-23");
    expect(byKey.get("china:wu_chengen")?.notes).toContain("ок. 1500");
    expect(byKey.get("china:mo_yan")?.notes).toContain("1956-03-25");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch18");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch18",
    );
    expect(buildReviewRegistry).toContain(
      "writerBiographyFactReviewBatch18",
    );
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch18.ts",
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch18.test.ts",
      ),
      reportPath,
      markdownReportPath,
    ];
    for (const sourcePath of sourcePaths) {
      const bytes = fs.readFileSync(sourcePath);
      const utf8 = bytes.toString("utf8");
      expect(
        bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
      ).toBe(false);
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

    expect(report.batch).toBe("18");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 2,
      corrected: 18,
      held: 0,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch18);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменения: 2");
    expect(markdown).toContain("Исправлено: 18");
    expect(markdown).toContain("Удержано в карантине: 0");
    expect(markdown).toContain("1963-01-23");
    expect(markdown).toContain("1956-03-25");
  });
});
