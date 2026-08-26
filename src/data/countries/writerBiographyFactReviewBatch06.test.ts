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
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH06_REVIEWER,
  writerBiographyFactReviewBatch06,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch06";

const expectedKeys = [
  "brazil:paulo_coelho",
  "bulgaria:peyo_yavorov",
  "bulgaria:yordan_yovkov",
  "cambodia:kram_ngoy",
  "cambodia:rim_kin",
  "cameroon:mongo_beti",
  "canada:alice_munro",
  "canada:anne_carson",
  "canada:lucy_maud_montgomery",
  "canada:margaret_atwood",
  "canada:michael_ondaatje",
  "canada:mordecai_richler",
  "canada:northrop_frye",
  "canada:robertson_davies",
  "canada:rohinton_mistry",
  "cape_verde:armenio_vieira",
  "cape_verde:baltasar_lopes",
  "cape_verde:eugenio_tavares",
  "cape_verde:germano_almeida",
  "cape_verde:jorge_barbosa",
] as const;

const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch06.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch06.md"
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

describe("writer biography claim review batch 06", () => {
  it("pins the exact deterministic 20-key boundary without prior-batch overlap", () => {
    const keys = writerBiographyFactReviewBatch06.map((record) => record.key);
    const priorKeys = new Set(
      [
        ...writerBiographyFactReviewBatch01,
        ...writerBiographyFactReviewBatch02,
        ...writerBiographyFactReviewBatch03,
        ...writerBiographyFactReviewBatch04,
        ...writerBiographyFactReviewBatch05,
      ].map((record) => record.key)
    );
    const sourceQueueKeys = new Set(sourceReviewQueueKeys());

    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => priorKeys.has(key))).toBe(false);
    expect(keys.every((key) => sourceQueueKeys.has(key))).toBe(true);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins every source text and records institutional non-Wikimedia evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|огромн|ведущ)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch06) {
      const originalText = sourceTextForKey(record.key);
      const distinctUrls = new Set(
        record.claims.flatMap((claim) =>
          claim.evidence.map((item) => item.url)
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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH06_REVIEWER
      );
      expect(["unchanged", "corrected", "held"]).toContain(record.decision);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);
      expect(distinctUrls.size).toBeGreaterThanOrEqual(2);

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

  it("records identity and date recommendations without mutating runtime data", () => {
    const byKey = new Map(
      writerBiographyFactReviewBatch06.map((record) => [record.key, record])
    );
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8"
    );

    expect(byKey.get("bulgaria:peyo_yavorov")?.notes).toContain(
      "1878-01-13"
    );
    expect(byKey.get("cambodia:kram_ngoy")?.notes).toContain("Q4929923");
    expect(byKey.get("cambodia:rim_kin")?.notes).toContain("1911-11-08");
    expect(byKey.get("cambodia:rim_kin")?.notes).toContain("1959-01-27");
    expect(byKey.get("cameroon:mongo_beti")?.notes).toContain("2001-10-07");
    expect(byKey.get("cape_verde:baltasar_lopes")?.notes).toContain(
      "Q548846"
    );
    expect(byKey.get("cape_verde:jorge_barbosa")?.notes).toContain(
      "1902-05-22"
    );
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch06");
  });

  it("keeps strict UTF-8 and the JSON/Markdown reports in sync", () => {
    const sourcePath = path.resolve(
      process.cwd(),
      "src/data/countries/writerBiographyFactReviewBatch06.ts"
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
    const decisions = writerBiographyFactReviewBatch06.map(
      (record) => record.decision
    );

    expect(sourceBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(
      false
    );
    expect(sourceUtf8).not.toContain("�");
    expect(report.batch).toBe("06");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.records).toEqual(writerBiographyFactReviewBatch06);
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
