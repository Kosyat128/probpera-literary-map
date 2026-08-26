import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { bookArchiveCountries as countries } from "./index";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH12_REVIEWER,
  writerBiographyFactReviewBatch12,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch12";

const expectedKeys = [
  "austria:thomas_bernhard",
  "azerbaijan:chingiz_abdullayev",
  "azerbaijan:mirza_alakbar_sabir",
  "azerbaijan:muhammad_fuzuli",
  "bahamas:cyril_bray",
  "bahamas:wallace_whitfield",
  "bahrain:ali_abdullah_khalifa",
  "bahrain:amin_saleh",
  "bangladesh:jibanananda_das",
  "bangladesh:selina_hossain",
  "bangladesh:tahmima_anam",
  "barbados:austin_clarke",
  "barbados:george_lamming",
  "belarus:ales_adamovich",
  "belarus:svetlana_alexievich",
  "belarus:symeon_polotsky",
  "belarus:yakub_kolas",
  "belarus:yanka_kupala",
  "belgium:amelie_nothomb",
  "belgium:georges_rodenbach",
] as const;

const reportsDirectory = path.resolve(process.cwd(), "reports");
const reportPath = path.join(
  reportsDirectory,
  "writer-biography-fact-review-batch12.json",
);
const markdownReportPath = path.join(
  reportsDirectory,
  "writer-biography-fact-review-batch12.md",
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

function priorBatchKeys(): Set<string> {
  const priorReportPattern =
    /^writer-biography-fact-review-batch(?:0[1-9]|1[01])\.json$/u;
  const keys = fs
    .readdirSync(reportsDirectory)
    .filter((fileName) => priorReportPattern.test(fileName))
    .flatMap((fileName) => {
      const report = JSON.parse(
        fs.readFileSync(path.join(reportsDirectory, fileName), "utf8"),
      ) as { records: Array<{ key: string }> };
      return report.records.map((record) => record.key);
    });
  return new Set(keys);
}

describe("writer biography claim review batch 12", () => {
  it("pins the frozen exact 20-key boundary without prior-batch overlap", () => {
    const keys = writerBiographyFactReviewBatch12.map((record) => record.key);
    const priorKeys = priorBatchKeys();

    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => priorKeys.has(key))).toBe(false);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins source SHA, professional Russian and independent institutional evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch12) {
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
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(30);
      expect(sentenceCount).toBeGreaterThanOrEqual(1);
      expect(sentenceCount).toBeLessThanOrEqual(3);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH12_REVIEWER,
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

  it("records identity and date recommendations without runtime mutation", () => {
    const byKey = new Map(
      writerBiographyFactReviewBatch12.map((record) => [record.key, record]),
    );
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8",
    );

    expect(byKey.get("azerbaijan:muhammad_fuzuli")?.notes).toContain(
      "годовой 1494",
    );
    expect(byKey.get("bahrain:ali_abdullah_khalifa")?.notes).toContain(
      "1944-03-04",
    );
    expect(byKey.get("bahrain:ali_abdullah_khalifa")?.notes).toContain(
      "2026-06-22",
    );
    expect(byKey.get("barbados:austin_clarke")?.notes).toContain(
      "1934-07-26",
    );
    expect(byKey.get("belarus:symeon_polotsky")?.notes).toContain(
      "старому стилю",
    );
    expect(byKey.get("belgium:amelie_nothomb")?.notes).toContain(
      "расхождение",
    );
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch12");
  });

  it("keeps strict UTF-8 and the JSON/Markdown reports in sync", () => {
    const sourcePath = path.resolve(
      process.cwd(),
      "src/data/countries/writerBiographyFactReviewBatch12.ts",
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
    const decisions = writerBiographyFactReviewBatch12.map(
      (record) => record.decision,
    );

    expect(
      sourceBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
    ).toBe(false);
    expect(sourceUtf8).not.toContain("�");
    expect(report.batch).toBe("12");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.records).toEqual(writerBiographyFactReviewBatch12);
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
