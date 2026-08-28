import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { bookArchiveCountries as countries } from "./index";
import { writerBiographyFactReviewBatch01 } from "./writerBiographyFactReviewBatch01";
import { writerBiographyFactReviewBatch02 } from "./writerBiographyFactReviewBatch02";
import { writerBiographyFactReviewBatch03 } from "./writerBiographyFactReviewBatch03";
import { writerBiographyFactReviewBatch04 } from "./writerBiographyFactReviewBatch04";
import { writerBiographyFactReviewBatch05 } from "./writerBiographyFactReviewBatch05";
import { writerBiographyFactReviewBatch06 } from "./writerBiographyFactReviewBatch06";
import { writerBiographyFactReviewBatch07 } from "./writerBiographyFactReviewBatch07";
import { writerBiographyFactReviewBatch08 } from "./writerBiographyFactReviewBatch08";
import { writerBiographyFactReviewBatch09 } from "./writerBiographyFactReviewBatch09";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH10_REVIEWER,
  writerBiographyFactReviewBatch10,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch10";

const expectedKeys = [
  "afghanistan:bahauddin_majrooh",
  "afghanistan:khaled_hosseini",
  "afghanistan:rabia_balkhi",
  "albania:andon_zako_cajupi",
  "albania:besnik_mustafaj",
  "albania:fan_noli",
  "algeria:boualem_sansal",
  "andorra:albert_salvado",
  "andorra:joan_peruga",
  "andorra:josep_fonbernat",
  "angola:ana_paula_tavares",
  "angola:manuel_rui",
  "antigua_and_barbuda:alison_hughes",
  "argentina:alberto_manguel",
  "argentina:jose_hernandez",
  "argentina:juan_gelman",
  "argentina:leopoldo_lugones",
  "argentina:leopoldo_marechal",
  "argentina:ricardo_guiraldes",
  "argentina:rodrigo_fresan",
] as const;

const heldKeys = new Set<string>([
  "andorra:josep_fonbernat",
  "antigua_and_barbuda:alison_hughes",
]);

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const identityRemediationsPath = path.resolve(
  process.cwd(),
  "src/data/countries/generated/writerIdentityRemediations.generated.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch10.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch10.md"
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

describe("writer biography claim review batch 10", () => {
  it("pins the frozen exact 20-key gap-fill boundary without prior-batch overlap", () => {
    const keys = writerBiographyFactReviewBatch10.map((record) => record.key);
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
        ...writerBiographyFactReviewBatch09,
      ].map((record) => record.key)
    );
    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => priorKeys.has(key))).toBe(false);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins source SHA, professional Russian, held semantics and independent institutional evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch10) {
      const originalText = sourceTextForKey(record.key);
      const sentenceCount =
        record.reviewedTextRu.match(/[.!?…]+(?=\s|$)/gu)?.length ?? 0;
      const shouldBeHeld = heldKeys.has(record.key);

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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH10_REVIEWER
      );
      expect(record.reviewedTextRu).not.toBe(originalText);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);

      if (shouldBeHeld) {
        expect(record.decision).toBe("held");
        expect(record.applicableTextRu).toBeNull();
        expect(record.claims.every((claim) => claim.verdict === "not-established")).toBe(true);
        expect(record.notes).toContain("Quarantine recommendation");
      } else {
        expect(record.decision).toBe("corrected");
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(record.claims.every((claim) => claim.verdict === "corrected")).toBe(true);
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
          const parsedUrl = new URL(item.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }

    const decisions = writerBiographyFactReviewBatch10.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(0);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(18);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(2);
  });

  it("records identity/date conclusions and keeps batch 10 disconnected from runtime", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
    };
    const remediations = JSON.parse(
      fs.readFileSync(identityRemediationsPath, "utf8")
    ) as {
      removedMappings: Array<{ key: string; oldQid: string }>;
      stalePortraitKeys: string[];
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(
      writerBiographyFactReviewBatch10.map((record) => [record.key, record])
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
      expect.objectContaining({ key: "angola:ana_paula_tavares", qid: "Q59186426" }),
    ]);
    expect(dateItems).toEqual([]);
    expect(badQidItems).toEqual([]);
    expect(calendarItems).toEqual([]);
    expect(byKey.get("angola:ana_paula_tavares")?.notes).toContain("Q59186426");
    expect(byKey.get("argentina:rodrigo_fresan")?.notes).toContain("1963-07-18");
    expect(byKey.get("andorra:josep_fonbernat")?.applicableTextRu).toBeNull();
    expect(byKey.get("antigua_and_barbuda:alison_hughes")?.notes).toContain(
      "Q3611840"
    );
    expect(remediations.removedMappings).toContainEqual(
      expect.objectContaining({
        key: "antigua_and_barbuda:alison_hughes",
        oldQid: "Q3611840",
      })
    );
    expect(remediations.stalePortraitKeys).toContain(
      "antigua_and_barbuda:alison_hughes"
    );
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch10");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch10"
    );
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch10.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch10.test.ts"
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

    expect(report.batch).toBe("10");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 0,
      corrected: 18,
      held: 2,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch10);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("andorra:josep_fonbernat");
    expect(markdown).toContain("antigua_and_barbuda:alison_hughes");
    expect(markdown).toContain("1963-07-18");
  });
});
