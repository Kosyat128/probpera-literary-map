import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { bookArchiveCountries as countries } from "./index";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH15_REVIEWER,
  writerBiographyFactReviewBatch15,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch15";

const expectedKeys = [
  "burundi:jean_pierre_hatungimana",
  "burundi:roland_rugero",
  "cambodia:ang_duong",
  "cambodia:nou_hach",
  "cambodia:soth_polin",
  "cameroon:calixthe_beyala",
  "cameroon:emmanuel_dongala",
  "cameroon:etienne_goyemide",
  "cameroon:ferdinand_oyono",
  "cameroon:jean_roger_essomba",
  "cameroon:leonora_miano",
  "cameroon:patrice_nganang",
  "cameroon:paul_dakeyo",
  "cameroon:rene_philombe",
  "cameroon:werewere_liking",
  "canada:chris_hadfield",
  "canada:margaret_laurence",
  "canada:miriam_toews",
  "canada:yann_martel",
  "cape_verde:manuel_de_novas",
] as const;

const heldKeys = [
  "burundi:jean_pierre_hatungimana",
  "cameroon:emmanuel_dongala",
  "cameroon:etienne_goyemide",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json",
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch15.json",
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch15.md",
);
const sourcePath = path.resolve(
  process.cwd(),
  "src/data/countries/writerBiographyFactReviewBatch15.ts",
);
const testPath = path.resolve(
  process.cwd(),
  "src/data/countries/writerBiographyFactReviewBatch15.test.ts",
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
  for (let batch = 1; batch <= 14; batch += 1) {
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

describe("writer biography claim review batch 15", () => {
  it("pins the next exact 20-key final-reviewQueue boundary without overlap", () => {
    const batchKeys = writerBiographyFactReviewBatch15.map(
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
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|ведущ|важнейш|главнейш|известнейш)/iu;
    const publicReviewMarker =
      /(?:^|[\s:—-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;—-])/iu;

    for (const record of writerBiographyFactReviewBatch15) {
      const originalText = sourceTextForKey(record.key);

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(
        originalText,
      );
      expect(originalText).not.toContain(String.fromCharCode(0xfffd));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(20);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH15_REVIEWER,
      );
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);

      if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(
          record.claims.every((claim) => claim.verdict === "supported"),
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
  });

  it("keeps held text non-applicable and gives every non-held claim evidence", () => {
    const held = writerBiographyFactReviewBatch15.filter(
      (record) => record.decision === "held",
    );
    const applicable = writerBiographyFactReviewBatch15.filter(
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
      writerBiographyFactReviewBatch15.map((record) => [record.key, record]),
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
    expect(byKey.get("burundi:jean_pierre_hatungimana")?.notes).toContain(
      "убрать неподтверждённый birthDate 1963",
    );
    expect(byKey.get("burundi:roland_rugero")?.notes).toContain("1986-02-22");
    expect(byKey.get("cameroon:calixthe_beyala")?.notes).toContain(
      "birthDate 1961-10-26 на годовой 1961",
    );
    expect(byKey.get("cameroon:emmanuel_dongala")?.notes).toContain(
      "republic_of_congo:emmanuel_dongala",
    );
    expect(byKey.get("cameroon:etienne_goyemide")?.notes).toContain(
      "central_african_republic:etienne_goyemide",
    );
    expect(byKey.get("cameroon:etienne_goyemide")?.notes).toContain(
      "1942-01-22",
    );
    expect(byKey.get("cameroon:jean_roger_essomba")?.notes).toContain(
      "birthDate 1950 на годовой 1962",
    );
    expect(byKey.get("cameroon:paul_dakeyo")?.notes).toContain("1948-02-18");
    expect(byKey.get("cameroon:werewere_liking")?.notes).toContain(
      "1950-05-01",
    );
    expect(byKey.get("canada:yann_martel")?.notes).toContain("1963-06-25");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch15");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch15",
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

    expect(report.batch).toBe("15");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 5,
      corrected: 12,
      held: 3,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch15);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 5");
    expect(markdown).toContain("Исправлено: 12");
    expect(markdown).toContain("Удержано в карантине: 3");
  });
});
