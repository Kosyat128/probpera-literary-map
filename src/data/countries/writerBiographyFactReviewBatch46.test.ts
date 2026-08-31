import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { legacyWriterBiography } from "../writerBiography";
import {
  countries as publicCountries,
  writerBiographyFactReviewSourceCountries as countries,
} from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH46_REVIEWER,
  writerBiographyFactReviewBatch46,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch46";
import { writerBiographyPublicProfileFactCorrectionsBatch46 } from "./writerBiographyPublicProfileFactCorrectionsBatch46";

const expectedKeys = [
  "romania:eugene_ionesco",
  "romania:ion_creanga",
  "romania:ion_luca_caragiale",
  "romania:liviu_rebreanu",
  "romania:mihai_eminescu",
  "romania:mircea_eliade",
  "romania:norman_manea",
  "romania:panait_istrati",
  "russia:akhmatova",
  "russia:avvakum",
  "russia:batushkov",
  "russia:blok",
  "russia:brodsky",
  "russia:bulgakov",
  "russia:buninin",
  "russia:chekhov",
  "russia:derzhavin",
  "russia:dostoevsky",
  "russia:esenin",
  "russia:fonvizin",
  "russia:gogol",
  "russia:goncharov",
  "russia:griboedov",
  "russia:kantemir",
  "russia:karamzin",
  "russia:kirill-turovsky",
  "russia:krylov",
  "russia:lermontov",
  "russia:leskov",
  "russia:lomonosov",
  "russia:mandelstam",
  "russia:nabrakov",
  "russia:nekrasov",
  "russia:nestor",
  "russia:ostrovsky",
  "russia:pasternak",
  "russia:pelevin",
  "russia:pushkin",
  "russia:robert_shtilmark",
  "russia:saltykov-shchedrin",
] as const;

const factQaPath = path.resolve(process.cwd(), "reports/writer-biography-fact-qa.json");
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch46.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch46.md"
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

function priorReportKeys(): string[] {
  const keys: string[] = [];
  for (let batch = 1; batch <= 45; batch += 1) {
    const suffix = String(batch).padStart(2, "0");
    const report = JSON.parse(
      fs.readFileSync(
        path.resolve(
          process.cwd(),
          `reports/writer-biography-fact-review-batch${suffix}.json`
        ),
        "utf8"
      )
    ) as { records: Array<{ key: string }> };
    keys.push(...report.records.map((record) => record.key));
  }
  return keys;
}

function publicWriter(key: string) {
  const [countryId, writerId] = key.split(":");
  return publicCountries
    .find((country) => country.id === countryId)
    ?.writers.find((writer) => writer.id === writerId);
}

describe("writer biography claim review batch 46", () => {
  it("pins the immutable 40-key historical batch without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const priorAssigned = priorReportKeys();
    const priorAssignedSet = new Set(priorAssigned);
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const keys = writerBiographyFactReviewBatch46.map((record) => record.key);
    expect(priorAssigned).toHaveLength(1280);
    expect(priorAssignedSet.size).toBe(1280);
    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(40);
    expect(keys.some((key) => priorAssignedSet.has(key))).toBe(false);
    expect(keys.every((key) => reviewQueueKeys.includes(key))).toBe(true);
    expect(keys.some((key) => quarantineKeys.includes(key))).toBe(false);
    expect([...keys].sort((left, right) => left.localeCompare(right, "en"))).toEqual(keys);
  });

  it("pins source hashes, restrained Russian copy and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш|одн(?:а|о|им|их)?\s+из\s+(?:главн|ведущ|важнейш|заметн))/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch46) {
      const originalText = sourceTextForKey(record.key);
      const sentenceCount =
        record.reviewedTextRu.match(/[.!?…]+(?=\s+[А-ЯЁ]|$)/gu)?.length ?? 0;
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(35);
      expect(sentenceCount, record.key).toBeGreaterThanOrEqual(1);
      expect(sentenceCount, record.key).toBeLessThanOrEqual(2);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(WRITER_BIOGRAPHY_FACT_REVIEW_BATCH46_REVIEWER);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims).toHaveLength(1);

      if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(record.applicableTextRu).toBe(originalText);
        expect(record.claims[0]?.verdict).toBe("supported");
      } else {
        expect(record.decision).toBe("corrected");
        expect(record.reviewedTextRu).not.toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(record.claims[0]?.verdict).toBe("corrected");
      }

      const evidence = record.claims[0]!.evidence;
      const hostnames = new Set(evidence.map((item) => new URL(item.url).hostname));
      expect(evidence.length, record.key).toBeGreaterThanOrEqual(2);
      expect(hostnames.size, record.key).toBeGreaterThanOrEqual(2);
      for (const item of evidence) {
        expect(item.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
        expect(item.checkedAt <= "2026-08-31", record.key).toBe(true);
        expect(item.findingRu).toMatch(/[А-Яа-яЁё]/);
        const parsedUrl = new URL(item.url);
        expect(parsedUrl.protocol).toBe("https:");
        expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
        expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
      }
    }

    expect(writerBiographyFactReviewBatch46).toHaveLength(40);
    expect(
      writerBiographyFactReviewBatch46.filter((record) => record.decision === "corrected")
    ).toHaveLength(40);
    expect(
      writerBiographyFactReviewBatch46.filter((record) => record.decision === "unchanged")
    ).toHaveLength(0);
    expect(writerBiographyFactReviewBatch46.find((record) => record.key === "russia:pasternak")?.decision).toBe("corrected");
  });

  it("publishes the proven profile corrections and keeps evidence build-only", () => {
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8"
    );
    const runtimeReviewAggregator = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviews.ts"),
      "utf8"
    );
    const buildSource = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/writer-biography-review-source.ts"),
      "utf8"
    );

    expect(writerBiographyPublicProfileFactCorrectionsBatch46).toHaveLength(5);
    expect(publicWriter("romania:ion_luca_caragiale")).toMatchObject({
      birthPlace: "Хайманале, Румыния",
    });
    expect(publicWriter("russia:esenin")).toMatchObject({ birthDate: "1895-10-03" });
    expect(publicWriter("russia:kantemir")).toMatchObject({
      years: "1708/1709-1744",
      birthDate: "",
      birthPlace: "",
      deathDate: "1744-04-11",
    });
    expect(publicWriter("russia:karamzin")).toMatchObject({
      years: "1765/1766-1826",
      birthDate: "",
    });
    expect(publicWriter("russia:kirill-turovsky")).toMatchObject({
      years: "",
      birthDate: "",
      deathDate: "",
    });
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch46");
    expect(runtimeReviewAggregator).not.toContain("writerBiographyFactReviewBatch46");
    expect(buildSource).toContain("writerBiographyFactReviewBatch46");
  });

  it("keeps UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviewBatch46.ts"),
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviewBatch46.test.ts"),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyPublicProfileFactCorrectionsBatch46.ts"
      ),
      reportPath,
      markdownReportPath,
    ];
    for (const sourcePath of sourcePaths) {
      const bytes = fs.readFileSync(sourcePath);
      const utf8 = bytes.toString("utf8");
      expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
      expect(utf8).not.toContain(String.fromCharCode(0xfffd));
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      batch: string;
      generatedAt: string;
      selectionSnapshot: Record<string, number>;
      summary: Record<string, number>;
      records: WriterBiographyFactReviewRecord[];
    };
    expect(report.batch).toBe("46");
    expect(report.generatedAt).toBe("2026-08-31");
    expect(report.selectionSnapshot).toMatchObject({
      reviewQueue: 1678,
      priorAssignedRecords: 1280,
      priorAssignedUnique: 1280,
      quarantine: 91,
      boundary: 40,
      boundaryUnique: 40,
      overlapPriorAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({ records: 40, unchanged: 0, corrected: 40, held: 0 });
    expect(report.records).toEqual(writerBiographyFactReviewBatch46);
  });
});
