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
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH07_REVIEWER,
  writerBiographyFactReviewBatch07,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch07";

const expectedKeys = [
  "colombia:german_espinosa",
  "colombia:jairo_anibal_nino",
  "colombia:jose_asuncion_silva",
  "colombia:juan_gabriel_vasquez",
  "colombia:manuel_mejia_vallejo",
  "colombia:mario_mendoza",
  "colombia:rafael_pombo",
  "colombia:santiago_gamboa",
  "costa_rica:ana_istarus",
  "costa_rica:carlos_luis_fallas",
  "costa_rica:carmen_lyra",
  "costa_rica:joaquin_garcia_monje",
  "cote_d_ivoire:ahmadou_kourouma",
  "cote_d_ivoire:bernard_binlin_dadie",
  "croatia:august_senoa",
  "croatia:ivan_gundulic",
  "croatia:marko_marulic",
  "croatia:miroslav_krleza",
  "croatia:vesna_parun",
  "cuba:alejo_carpentier",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch07.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch07.md"
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

function sourceReviewQueueKeys(): string[] {
  const report = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
    reviewQueue: Array<{ key: string }>;
  };
  return report.reviewQueue.map((record) => record.key).sort();
}

describe("writer biography claim review batch 07", () => {
  it("pins the frozen exact 20-key boundary without any prior-batch overlap", () => {
    const keys = writerBiographyFactReviewBatch07.map((record) => record.key);
    const priorKeys = new Set(
      [
        ...writerBiographyFactReviewBatch01,
        ...writerBiographyFactReviewBatch02,
        ...writerBiographyFactReviewBatch03,
        ...writerBiographyFactReviewBatch04,
        ...writerBiographyFactReviewBatch05,
        ...writerBiographyFactReviewBatch06,
      ].map((record) => record.key)
    );
    const sourceQueueKeys = new Set(sourceReviewQueueKeys());

    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => priorKeys.has(key))).toBe(false);
    expect(keys.every((key) => sourceQueueKeys.has(key))).toBe(true);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins source SHA, professional Russian and two independent institutional evidence hosts per claim", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch07) {
      const originalText = sourceTextForKey(record.key);
      const sentenceCount =
        record.reviewedTextRu.match(/[.!?…]+(?=\s|$)/gu)?.length ?? 0;

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(originalText);
      expect(originalText).not.toContain(String.fromCharCode(0xfffd));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(80);
      expect(sentenceCount).toBeGreaterThanOrEqual(2);
      expect(sentenceCount).toBeLessThanOrEqual(3);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH07_REVIEWER
      );
      expect(record.decision).toBe("corrected");
      expect(record.reviewedTextRu).not.toBe(originalText);
      expect(record.applicableTextRu).toBe(record.reviewedTextRu);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);
      expect(record.claims.some((claim) => claim.verdict === "corrected")).toBe(
        true
      );

      for (const claim of record.claims) {
        const hostnames = new Set(
          claim.evidence.map((item) => new URL(item.url).hostname)
        );
        expect(claim.textRu.trim()).not.toBe("");
        expect(claim.verdict).toBe("corrected");
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

    const decisions = writerBiographyFactReviewBatch07.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(0);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(20);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(0);
  });

  it("records all identity/date queue conclusions without connecting batch 07 to runtime", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(
      writerBiographyFactReviewBatch07.map((record) => [record.key, record])
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

    expect(identityItems).toEqual([
      expect.objectContaining({ key: "costa_rica:carmen_lyra", qid: "Q2939620" }),
    ]);
    expect(dateItems.map(({ key, field }) => ({ key, field }))).toEqual([
      { key: "colombia:rafael_pombo", field: "deathDate" },
      { key: "costa_rica:carmen_lyra", field: "birthDate" },
    ]);
    expect(badQidItems).toEqual([]);
    expect(calendarItems).toEqual([]);
    expect(byKey.get("colombia:rafael_pombo")?.notes).toContain("1912-05-05");
    expect(byKey.get("colombia:santiago_gamboa")?.notes).toContain("1965-12-30");
    expect(byKey.get("colombia:santiago_gamboa")?.notes).toContain("Q2420039");
    expect(byKey.get("colombia:santiago_gamboa")?.notes).toContain("портрет");
    expect(byKey.get("costa_rica:carlos_luis_fallas")?.notes).toContain(
      "1909-01-21"
    );
    expect(byKey.get("costa_rica:carmen_lyra")?.notes).toContain("Q2939620");
    expect(byKey.get("costa_rica:carmen_lyra")?.notes).toContain("1888-01-15");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch07");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch07"
    );
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch07.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch07.test.ts"
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

    expect(report.batch).toBe("07");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 0,
      corrected: 20,
      held: 0,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch07);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
  });
});
