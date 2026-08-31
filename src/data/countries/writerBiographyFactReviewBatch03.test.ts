import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import { writerBiographyFactReviewBatch01 } from "./writerBiographyFactReviewBatch01";
import { writerBiographyFactReviewBatch02 } from "./writerBiographyFactReviewBatch02";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH03_REVIEWER,
  writerBiographyFactReviewBatch03,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch03";

const expectedKeys = [
  "australia:gregory_david_roberts",
  "australia:henry_lawson",
  "australia:joseph_furphy",
  "australia:judith_wright",
  "australia:les_murray",
  "australia:nevil_shute",
  "australia:oodgeroo_noonuccal",
  "australia:patrick_white",
  "australia:peter_carey",
  "australia:richard_flanagan",
  "australia:tim_winton",
  "austria:elfriede_jelinek",
  "austria:franz_kafka",
  "austria:hugo_von_hofmannsthal",
  "austria:peter_handke",
  "azerbaijan:anar_rzayev",
  "azerbaijan:huseyn_javid",
  "azerbaijan:imadaddin_nasimi",
  "azerbaijan:jalil_mammadguluzadeh",
  "azerbaijan:mirza_fatali_akhundov",
] as const;

const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch03.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch03.md"
);

function sourceTextForKey(key: string): string {
  const [countryId, writerId] = key.split(":");
  const writer = countries
    .find((country) => country.id === countryId)
    ?.writers.find((item) => item.id === writerId);
  if (!writer) {
    throw new Error(`Writer not found: ${key}`);
  }
  const text = legacyWriterBiography(writer);
  if (!text) {
    throw new Error(`Legacy Russian biography not found: ${key}`);
  }
  return text;
}

function sha256(text: string): string {
  return createHash("sha256")
    .update(Buffer.from(text, "utf8"))
    .digest("hex");
}

function sourceReviewQueueKeys(): string[] {
  const report = JSON.parse(
    fs.readFileSync(
      path.resolve(process.cwd(), "reports/writer-biography-fact-qa.json"),
      "utf8"
    )
  ) as { reviewQueue: Array<{ key: string }> };
  return report.reviewQueue.map((record) => record.key).sort();
}

describe("writer biography claim review batch 03", () => {
  it("pins the next deterministic 20-key boundary without batch 01/02 overlap", () => {
    const keys = writerBiographyFactReviewBatch03.map((record) => record.key);
    const priorKeys = new Set([
      ...writerBiographyFactReviewBatch01.map((record) => record.key),
      ...writerBiographyFactReviewBatch02.map((record) => record.key),
    ]);
    const sourceQueueKeys = new Set(sourceReviewQueueKeys());
    const sortedBatch02Keys = writerBiographyFactReviewBatch02
      .map((record) => record.key)
      .sort();

    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => priorKeys.has(key))).toBe(false);
    expect(keys.every((key) => sourceQueueKeys.has(key))).toBe(true);
    expect([...keys].sort()).toEqual(keys);
    expect(keys[0] > sortedBatch02Keys[sortedBatch02Keys.length - 1]!).toBe(
      true
    );
  });

  it("pins every source text and records non-Wikimedia evidence per claim", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|огромн|ведущ)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch03) {
      const originalText = sourceTextForKey(record.key);
      const distinctUrls = new Set(
        record.claims.flatMap((claim) =>
          claim.evidence.map((item) => item.url)
        )
      );
      const distinctHostnames = new Set(
        record.claims.flatMap((claim) =>
          claim.evidence.map((item) => new URL(item.url).hostname)
        )
      );

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(
        originalText
      );
      expect(originalText).not.toContain("�");
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(20);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH03_REVIEWER
      );
      expect(["unchanged", "corrected", "held"]).toContain(record.decision);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);
      expect(distinctUrls.size).toBeGreaterThanOrEqual(2);
      expect(distinctHostnames.size).toBeGreaterThanOrEqual(2);

      if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(record.claims.every((claim) => claim.verdict === "supported")).toBe(
          true
        );
      }
      if (record.decision === "corrected") {
        expect(record.reviewedTextRu).not.toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(record.claims.some((claim) => claim.verdict === "corrected")).toBe(
          true
        );
      }
      if (record.decision === "held") {
        expect(record.applicableTextRu).toBeNull();
        expect(
          record.claims.some((claim) => claim.verdict === "not-established")
        ).toBe(true);
      }

      for (const claim of record.claims) {
        expect(claim.textRu.trim()).not.toBe("");
        expect(["supported", "corrected", "not-established"]).toContain(
          claim.verdict
        );
        expect(claim.evidence.length).toBeGreaterThan(0);
        for (const item of claim.evidence) {
          expect(item.provider.trim()).not.toBe("");
          expect(item.findingRu.trim()).not.toBe("");
          const parsedUrl = new URL(item.url);
          const supplementalEvidenceUrls = new Set([
            "https://adb.anu.edu.au/biography/white-patrick-victor-paddy-14925",
            "https://www.bundeskanzleramt.gv.at/bundeskanzleramt/nachrichten-der-bundesregierung/2019/bierlein-und-schallenberg-gratulieren-peter-handke-zum-literaturnobelpreis-2019.html",
            "https://www.onb.ac.at/museen/literaturmuseum/kalender/die-klavierspielerin-zum-80-geburtstag-von-elfriede-jelinek",
          ]);
          expect(item.checkedAt).toBe(
            supplementalEvidenceUrls.has(item.url)
              ? "2026-08-31"
              : "2026-08-09"
          );
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }
  });

  it("records the identity/date recommendations without mutating runtime data", () => {
    const byKey = new Map(
      writerBiographyFactReviewBatch03.map((record) => [record.key, record])
    );
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8"
    );

    expect(byKey.get("australia:gregory_david_roberts")?.notes).toContain(
      "Q1370495"
    );
    expect(byKey.get("australia:les_murray")?.notes).toContain("Q259841");
    expect(byKey.get("australia:nevil_shute")?.notes).toContain(
      "1960-01-12"
    );
    expect(byKey.get("azerbaijan:mirza_fatali_akhundov")?.notes).toContain(
      "1812-07-12"
    );
    expect(byKey.get("azerbaijan:mirza_fatali_akhundov")?.notes).toContain(
      "1878-03-10"
    );
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch03");
  });

  it("keeps machine-readable and human-readable reports in sync", () => {
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
    const decisions = writerBiographyFactReviewBatch03.map(
      (record) => record.decision
    );

    expect(report.batch).toBe("03");
    expect(report.generatedAt).toBe("2026-08-31");
    expect(report.records).toEqual(writerBiographyFactReviewBatch03);
    expect(report.summary).toEqual({
      records: 20,
      unchanged: decisions.filter((decision) => decision === "unchanged").length,
      corrected: decisions.filter((decision) => decision === "corrected").length,
      held: decisions.filter((decision) => decision === "held").length,
    });
    for (const key of expectedKeys) {
      expect(markdown).toContain(`\`${key}\``);
    }
  });
});
