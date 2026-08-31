import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH04_REVIEWER,
  writerBiographyFactReviewBatch04,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch04";

const expectedKeys = [
  "azerbaijan:nizami_ganjavi",
  "azerbaijan:samed_vurgun",
  "bahrain:ibrahim_al_arrayed",
  "bahrain:qassim_haddad",
  "bangladesh:humayun_ahmed",
  "bangladesh:kazi_nazrul_islam",
  "bangladesh:syed_waliullah",
  "barbados:kamau_brathwaite",
  "belarus:francisak_bahushevich",
  "belarus:francysk_skaryna",
  "belarus:maksim_bahdanovic",
  "belarus:uladzimir_karatkevich",
  "belarus:vasil_bykau",
  "belarus:vintsent_dunin_martsinkevich",
  "belgium:charles_de_coster",
  "belgium:emile_verhaeren",
  "belgium:felix_timmermans",
  "belgium:georges_simenon",
  "belgium:hugo_claus",
  "belgium:maurice_maeterlinck",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch04.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch04.md"
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

describe("writer biography claim review batch 04", () => {
  it("pins the frozen exact 20-key boundary", () => {
    const keys = writerBiographyFactReviewBatch04.map((record) => record.key);
    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins original texts, normalized decisions and institutional evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch04) {
      const originalText = sourceTextForKey(record.key);
      const distinctHostnames = new Set(
        record.claims.flatMap((claim) =>
          claim.evidence.map((item) => new URL(item.url).hostname)
        )
      );
      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(originalText);
      expect(originalText).not.toContain("\uFFFD");
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(20);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH04_REVIEWER
      );
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);
      expect(distinctHostnames.size).toBeGreaterThanOrEqual(2);

      if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(record.claims.every((claim) => claim.verdict === "supported")).toBe(true);
      } else if (record.decision === "corrected") {
        expect(record.reviewedTextRu).not.toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(record.claims.some((claim) => claim.verdict === "corrected")).toBe(true);
      } else {
        expect(record.applicableTextRu).toBeNull();
        expect(record.claims.some((claim) => claim.verdict === "not-established")).toBe(true);
      }

      for (const claim of record.claims) {
        expect(claim.textRu.trim()).not.toBe("");
        expect(claim.evidence.length).toBeGreaterThan(0);
        for (const evidence of claim.evidence) {
          expect(evidence.provider.trim()).not.toBe("");
          expect(evidence.findingRu.trim()).not.toBe("");
          const parsedUrl = new URL(evidence.url);
          const supplementalEvidenceUrls = new Set([
            "https://science.gov.az/az/news/open/35226",
            "https://azerbaijan.az/en/related-information/94",
            "https://www.syedwaliullah.com/books",
            "https://www.syedwaliullah.com/novels",
          ]);
          expect(evidence.checkedAt).toBe(
            supplementalEvidenceUrls.has(evidence.url)
              ? "2026-08-31"
              : "2026-08-09"
          );
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }

    const decisions = writerBiographyFactReviewBatch04.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(1);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(19);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(0);
  });

  it("records the one identity-queue recommendation and no date discrepancy", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string }>;
    };
    const batchKeys = new Set(expectedKeys);
    const identityItems = factQa.wikidataIdentityReviewQueue.filter((item) =>
      batchKeys.has(item.key as (typeof expectedKeys)[number])
    );
    const dateItems = factQa.wikidataDateDiscrepancyQueue.filter((item) =>
      batchKeys.has(item.key as (typeof expectedKeys)[number])
    );
    const skaryna = writerBiographyFactReviewBatch04.find(
      (record) => record.key === "belarus:francysk_skaryna"
    );

    expect(identityItems).toEqual([
      expect.objectContaining({ key: "belarus:francysk_skaryna", qid: "Q435320" }),
    ]);
    expect(dateItems).toEqual([]);
    expect(skaryna?.notes).toContain("Q435320");
    expect(skaryna?.notes).toContain("1486");
    expect(skaryna?.notes).toContain("общий файл страны не изменён");
  });

  it("keeps JSON and Markdown reports in sync", () => {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      batch: string;
      generatedAt: string;
      summary: { records: number; unchanged: number; corrected: number; held: number };
      records: WriterBiographyFactReviewRecord[];
    };
    const markdown = fs.readFileSync(markdownReportPath, "utf8");
    expect(report.batch).toBe("04");
    expect(report.generatedAt).toBe("2026-08-31");
    expect(report.summary).toEqual({ records: 20, unchanged: 1, corrected: 19, held: 0 });
    expect(report.records).toEqual(writerBiographyFactReviewBatch04);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
  });
});
