import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import { writerBiographyFactReviewBatch01 } from "./writerBiographyFactReviewBatch01";
import { writerBiographyFactReviewBatch02 } from "./writerBiographyFactReviewBatch02";
import { writerBiographyFactReviewBatch03 } from "./writerBiographyFactReviewBatch03";
import { writerBiographyFactReviewBatch04 } from "./writerBiographyFactReviewBatch04";
import { writerBiographyFactReviewBatch05 } from "./writerBiographyFactReviewBatch05";
import { writerBiographyFactReviewBatch06 } from "./writerBiographyFactReviewBatch06";
import { writerBiographyFactReviewBatch07 } from "./writerBiographyFactReviewBatch07";
import { writerBiographyFactReviewBatch08 } from "./writerBiographyFactReviewBatch08";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH09_REVIEWER,
  writerBiographyFactReviewBatch09,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch09";

const expectedKeys = [
  "dominican_republic:pedro_henriquez_urena",
  "ecuador:abdon_ubidia",
  "ecuador:alfredo_pareja_diezcanseco",
  "ecuador:arturo_borja",
  "ecuador:eliecer_cardenas",
  "ecuador:javier_vasconez",
  "ecuador:jorge_carrera_andrade",
  "ecuador:jorge_icaza",
  "ecuador:maria_fernanda_ampuero",
  "ecuador:pablo_palacio",
  "ecuador:santiago_paez",
  "egypt:ahmed_khaled_towfik",
  "egypt:bahaa_taher",
  "egypt:naguib_mahfouz",
  "egypt:rifaa_al_tahtawi",
  "egypt:salah_abdel_sabour",
  "egypt:sonallah_ibrahim",
  "egypt:taha_hussein",
  "el_salvador:roque_dalton",
  "el_salvador:salvador_salarre",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json",
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch09.json",
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch09.md",
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
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

function sourceReviewQueueKeys(): string[] {
  const report = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
    reviewQueue: Array<{ key: string }>;
  };
  return report.reviewQueue.map((record) => record.key).sort();
}

describe("writer biography claim review batch 09", () => {
  it("pins the frozen exact 20-key boundary without prior-batch overlap", () => {
    const keys = writerBiographyFactReviewBatch09.map((record) => record.key);
    const priorKeys = new Set(
      [
        ...writerBiographyFactReviewBatch01,
        ...writerBiographyFactReviewBatch02,
        ...writerBiographyFactReviewBatch03,
        ...writerBiographyFactReviewBatch04,
        ...writerBiographyFactReviewBatch05,
        ...writerBiographyFactReviewBatch06,
        ...writerBiographyFactReviewBatch07,
        ...writerBiographyFactReviewBatch08,
      ].map((record) => record.key),
    );
    const sourceQueueKeys = new Set(sourceReviewQueueKeys());

    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => priorKeys.has(key))).toBe(false);
    expect(keys.every((key) => sourceQueueKeys.has(key))).toBe(true);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins source SHA, professional Russian and independent institutional evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch09) {
      const originalText = sourceTextForKey(record.key);
      const evidenceItems = record.claims.flatMap((claim) => claim.evidence);
      const distinctUrls = new Set(evidenceItems.map((item) => item.url));
      const distinctHosts = new Set(
        evidenceItems.map((item) => new URL(item.url).hostname),
      );
      const sentenceCount =
        record.reviewedTextRu.match(/[.!?…]+(?=\s|$)/gu)?.length ?? 0;

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(
        originalText,
      );
      expect(originalText).not.toContain("�");
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(60);
      expect(sentenceCount).toBeGreaterThanOrEqual(1);
      expect(sentenceCount).toBeLessThanOrEqual(3);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH09_REVIEWER,
      );
      expect(["unchanged", "corrected", "held"]).toContain(record.decision);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);
      expect(distinctUrls.size).toBeGreaterThanOrEqual(2);
      expect(distinctHosts.size).toBeGreaterThanOrEqual(2);

      if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(
          record.claims.every((claim) => claim.verdict === "supported"),
        ).toBe(true);
      }
      if (record.decision === "corrected") {
        expect(record.reviewedTextRu).not.toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(
          record.claims.some((claim) => claim.verdict === "corrected"),
        ).toBe(true);
      }
      if (record.decision === "held") {
        expect(record.applicableTextRu).toBeNull();
        expect(
          record.claims.some((claim) => claim.verdict === "not-established"),
        ).toBe(true);
      }

      for (const claim of record.claims) {
        expect(claim.textRu.trim()).not.toBe("");
        expect(["supported", "corrected", "not-established"]).toContain(
          claim.verdict,
        );
        expect(claim.evidence.length).toBeGreaterThanOrEqual(2);
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
  });

  it("records proven identity and date recommendations without runtime mutation", () => {
    const byKey = new Map(
      writerBiographyFactReviewBatch09.map((record) => [record.key, record]),
    );
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8",
    );

    expect(byKey.get("ecuador:eliecer_cardenas")?.notes).toContain(
      "2021-09-26",
    );
    expect(byKey.get("ecuador:eliecer_cardenas")?.notes).toContain(
      "2021-09-01",
    );
    expect(byKey.get("egypt:ahmed_khaled_towfik")?.notes).toContain(
      "1962-06-10",
    );
    expect(byKey.get("egypt:ahmed_khaled_towfik")?.notes).toContain(
      "2018-04-02",
    );
    expect(byKey.get("egypt:bahaa_taher")?.notes).toContain("1935-01-13");
    expect(byKey.get("egypt:bahaa_taher")?.notes).toContain("2022-10-27");
    expect(byKey.get("egypt:naguib_mahfouz")?.notes).toContain("1911-12-11");
    expect(byKey.get("egypt:naguib_mahfouz")?.notes).toContain("2006-08-30");
    expect(byKey.get("egypt:rifaa_al_tahtawi")?.notes).toContain("1801-10-15");
    expect(byKey.get("egypt:salah_abdel_sabour")?.notes).toContain(
      "1931-05-03",
    );
    expect(byKey.get("egypt:salah_abdel_sabour")?.notes).toContain(
      "1981-08-14",
    );
    expect(byKey.get("egypt:sonallah_ibrahim")?.notes).toContain("2025-08-13");
    expect(byKey.get("egypt:taha_hussein")?.notes).toContain("1889-11-14");
    expect(byKey.get("egypt:taha_hussein")?.notes).toContain("1973-10-28");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch09");
  });

  it("keeps strict UTF-8 and the JSON/Markdown reports in sync", () => {
    const sourcePath = path.resolve(
      process.cwd(),
      "src/data/countries/writerBiographyFactReviewBatch09.ts",
    );
    const sourceBytes = fs.readFileSync(sourcePath);
    const sourceUtf8 = sourceBytes.toString("utf8");
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
    const decisions = writerBiographyFactReviewBatch09.map(
      (record) => record.decision,
    );

    expect(
      sourceBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
    ).toBe(false);
    expect(sourceUtf8).not.toContain("�");
    expect(report.batch).toBe("09");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.records).toEqual(writerBiographyFactReviewBatch09);
    expect(report.summary).toEqual({
      records: 20,
      unchanged: decisions.filter((decision) => decision === "unchanged")
        .length,
      corrected: decisions.filter((decision) => decision === "corrected")
        .length,
      held: decisions.filter((decision) => decision === "held").length,
    });
    for (const key of expectedKeys) {
      expect(markdown).toContain(`\`${key}\``);
    }
  });
});
