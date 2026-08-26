import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { bookArchiveCountries as countries } from "./index";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH14_REVIEWER,
  writerBiographyFactReviewBatch14,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch14";

const expectedKeys = [
  "botswana:laurie_kubuitsile",
  "botswana:moshe_motshegwa",
  "botswana:unity_dow",
  "brazil:carlos_drummond_de_andrade",
  "brazil:manoel_de_barros",
  "brunei:awang_mohammad_yassin",
  "brunei:masuri_masrun",
  "bulgaria:blaga_dimitrova",
  "bulgaria:elin_pelin",
  "bulgaria:geo_milev",
  "bulgaria:hristo_botev",
  "bulgaria:ivan_vazov",
  "bulgaria:paisius_hilendar",
  "burkina_faso:frederic_titinga_pacere",
  "burkina_faso:jean_pierre_guingane",
  "burkina_faso:monique_ilboudo",
  "burkina_faso:norbert_zongo",
  "burkina_faso:patrick_ilboudo",
  "burundi:christophe_nkezabahizi",
  "burundi:gaetan_muschimyimana",
] as const;

const heldKeys = [
  "botswana:moshe_motshegwa",
  "brunei:awang_mohammad_yassin",
  "brunei:masuri_masrun",
  "burundi:christophe_nkezabahizi",
  "burundi:gaetan_muschimyimana",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json",
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch14.json",
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch14.md",
);
const sourcePath = path.resolve(
  process.cwd(),
  "src/data/countries/writerBiographyFactReviewBatch14.ts",
);
const testPath = path.resolve(
  process.cwd(),
  "src/data/countries/writerBiographyFactReviewBatch14.test.ts",
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
  for (let batch = 1; batch <= 13; batch += 1) {
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

describe("writer biography claim review batch 14", () => {
  it("pins the next exact 20-key final-reviewQueue boundary without overlap", () => {
    const batchKeys = writerBiographyFactReviewBatch14.map(
      (record) => record.key,
    );
    const priorKeys = new Set(priorReportKeys());

    expect(batchKeys).toEqual(expectedKeys);
    expect(new Set(batchKeys).size).toBe(20);
    expect([...batchKeys].sort()).toEqual(batchKeys);
    expect(batchKeys.some((key) => priorKeys.has(key))).toBe(false);
  });

  it("pins raw source hashes and validates professional Russian decisions", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|ведущ|важнейш|главнейш)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch14) {
      const originalText = sourceTextForKey(record.key);

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(
        originalText,
      );
      expect(originalText).not.toContain(String.fromCharCode(0xfffd));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(40);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH14_REVIEWER,
      );
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);

      if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(
          record.claims.every((claim) => claim.verdict === "supported"),
        ).toBe(true);
      } else if (record.decision === "corrected") {
        expect(record.reviewedTextRu).not.toBe(originalText);
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
  });

  it("keeps held text non-applicable and gives every non-held claim evidence", () => {
    const held = writerBiographyFactReviewBatch14.filter(
      (record) => record.decision === "held",
    );
    const applicable = writerBiographyFactReviewBatch14.filter(
      (record) => record.decision !== "held",
    );

    expect(held.map((record) => record.key)).toEqual(heldKeys);
    expect(held.every((record) => record.applicableTextRu === null)).toBe(true);
    expect(
      applicable.every(
        (record) =>
          record.applicableTextRu === record.reviewedTextRu &&
          record.claims.every((claim) => claim.evidence.length >= 2),
      ),
    ).toBe(true);
  });

  it("documents date and identity conclusions without touching shared runtime", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataDateDiscrepancyQueue: Array<{ key: string }>;
      wikidataIdentityReviewQueue: Array<{ key: string }>;
      badQidIdentityQueue: Array<{ key: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
    };
    const batchKeySet = new Set<string>(expectedKeys);
    const selected = (items: Array<{ key: string }>) =>
      items.filter((item) => batchKeySet.has(item.key)).map((item) => item.key);
    const byKey = new Map(
      writerBiographyFactReviewBatch14.map((record) => [record.key, record]),
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

    expect(selected(factQa.wikidataDateDiscrepancyQueue)).toEqual([]);
    expect(selected(factQa.wikidataIdentityReviewQueue)).toEqual([]);
    expect(selected(factQa.badQidIdentityQueue)).toEqual([]);
    expect(selected(factQa.calendarOrSourceDiscrepancyQueue)).toEqual([]);
    expect(byKey.get("botswana:laurie_kubuitsile")?.notes).toContain(
      "1964-01-15",
    );
    expect(
      byKey.get("burkina_faso:frederic_titinga_pacere")?.notes,
    ).toContain("2024-11-08");
    expect(byKey.get("burkina_faso:patrick_ilboudo")?.notes).toContain(
      "1951-02-18",
    );
    expect(byKey.get("brunei:masuri_masrun")?.notes).toContain(
      "не подменять",
    );
    expect(byKey.get("burundi:christophe_nkezabahizi")?.notes).toContain(
      "identity quarantine recommendation",
    );
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch14");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch14",
    );
  });

  it("keeps the four isolated files valid strict UTF-8", () => {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    for (const filePath of [
      sourcePath,
      testPath,
      reportPath,
      markdownReportPath,
    ]) {
      const raw = fs.readFileSync(filePath);
      const decoded = decoder.decode(raw);
      expect(raw.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(
        false,
      );
      expect(decoded).not.toContain(String.fromCharCode(0xfffd));
      expect(Buffer.from(decoded, "utf8")).toEqual(raw);
    }
  });

  it("keeps the JSON and Markdown reports synchronized", () => {
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

    expect(report.batch).toBe("14");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 4,
      corrected: 11,
      held: 5,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch14);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 4");
    expect(markdown).toContain("Исправлено: 11");
    expect(markdown).toContain("Удержано в карантине: 5");
  });
});
