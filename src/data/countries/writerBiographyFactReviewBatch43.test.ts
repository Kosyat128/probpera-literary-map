import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { legacyWriterBiography } from "../writerBiography";
import {
  countries as publicCountries,
  writerBiographyFactReviewSourceCountries as countries,
} from "./index";
import { selectHistoricalWriterBiographyFactReviewBoundary } from "./writerBiographyFactReviewBoundary.test-support";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import { writerBiographyFactReviewBatch28 } from "./writerBiographyFactReviewBatch28";
import { writerBiographyFactReviewBatch29 } from "./writerBiographyFactReviewBatch29";
import { writerBiographyFactReviewBatch30 } from "./writerBiographyFactReviewBatch30";
import { writerBiographyFactReviewBatch31 } from "./writerBiographyFactReviewBatch31";
import { writerBiographyFactReviewBatch32 } from "./writerBiographyFactReviewBatch32";
import { writerBiographyFactReviewBatch33 } from "./writerBiographyFactReviewBatch33";
import { writerBiographyFactReviewBatch34 } from "./writerBiographyFactReviewBatch34";
import { writerBiographyFactReviewBatch35 } from "./writerBiographyFactReviewBatch35";
import { writerBiographyFactReviewBatch36 } from "./writerBiographyFactReviewBatch36";
import { writerBiographyFactReviewBatch37 } from "./writerBiographyFactReviewBatch37";
import { writerBiographyFactReviewBatch38 } from "./writerBiographyFactReviewBatch38";
import { writerBiographyFactReviewBatch39 } from "./writerBiographyFactReviewBatch39";
import { writerBiographyFactReviewBatch40 } from "./writerBiographyFactReviewBatch40";
import { writerBiographyFactReviewBatch41 } from "./writerBiographyFactReviewBatch41";
import { writerBiographyFactReviewBatch42 } from "./writerBiographyFactReviewBatch42";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH43_REVIEWER,
  writerBiographyFactReviewBatch43,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch43";

const expectedKeys = [
  "norway:jonas_lie",
  "norway:jostein_gaarder",
  "norway:karl_ove_knausgard",
  "norway:knut_hamsun",
  "norway:olav_duun",
  "norway:sigrid_undset",
  "norway:tarjei_vesaas",
  "oman:abdullah_bin_mohammed_al_taie",
  "oman:abdullah_habib",
  "oman:abu_muslim_al_bahlani",
  "oman:jokha_alharthi",
  "oman:saif_al_rahbi",
  "oman:zahir_al_ghazali",
  "pakistan:bano_qudsia",
  "pakistan:faiz_ahmad_faiz",
  "pakistan:intizar_husain",
  "pakistan:kamila_shamsie",
  "pakistan:mohsin_hamid",
  "pakistan:muhammad_iqbal",
  "pakistan:saadat_hasan_manto",
  "palau:emelihter_kihleng",
  "palestine:edward_said",
  "palestine:fadwa_tuqan",
  "palestine:ghassan_kanafani",
  "palestine:ibrahim_nasrallah",
  "palestine:mahmoud_darwish",
  "palestine:sahar_khalifeh",
  "panama:demetrio_kalleyas",
  "panama:juan_david_morgan",
  "panama:ricardo_miro",
  "panama:rogelio_sinan",
  "papua_new_guinea:siri_gising",
  "papua_new_guinea:vincent_eri",
  "paraguay:augusto_roa_bastos",
  "paraguay:elvio_romero",
  "paraguay:gabriel_casaccia",
  "paraguay:juan_manuel_marcos",
  "paraguay:julio_correa",
  "paraguay:lisandro_diaz_leon",
  "paraguay:liza_haedo",
] as const;

const expectedHeldKeys = [
  "oman:zahir_al_ghazali",
  "panama:demetrio_kalleyas",
  "papua_new_guinea:siri_gising",
] as const;

const factQaPath = path.resolve(process.cwd(), "reports/writer-biography-fact-qa.json");
const reportPath = path.resolve(process.cwd(), "reports/writer-biography-fact-review-batch43.json");
const markdownReportPath = path.resolve(process.cwd(), "reports/writer-biography-fact-review-batch43.md");

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
  for (let batch = 1; batch <= 27; batch += 1) {
    const suffix = String(batch).padStart(2, "0");
    const report = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), `reports/writer-biography-fact-review-batch${suffix}.json`),
        "utf8"
      )
    ) as { records: Array<{ key: string }> };
    keys.push(...report.records.map((record) => record.key));
  }
  return keys;
}

describe("writer biography claim review batch 43", () => {
  it("pins the exact next 40-key historical boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const priorBatches = [
      writerBiographyFactReviewBatch28,
      writerBiographyFactReviewBatch29,
      writerBiographyFactReviewBatch30,
      writerBiographyFactReviewBatch31,
      writerBiographyFactReviewBatch32,
      writerBiographyFactReviewBatch33,
      writerBiographyFactReviewBatch34,
      writerBiographyFactReviewBatch35,
      writerBiographyFactReviewBatch36,
      writerBiographyFactReviewBatch37,
      writerBiographyFactReviewBatch38,
      writerBiographyFactReviewBatch39,
      writerBiographyFactReviewBatch40,
      writerBiographyFactReviewBatch41,
      writerBiographyFactReviewBatch42,
    ];
    const priorReport = priorReportKeys();
    const priorAssigned = [
      ...priorReport,
      ...priorBatches.flatMap((batch) => batch.map((record) => record.key)),
    ];
    const priorAssignedSet = new Set(priorAssigned);
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const reviewQueueSet = new Set(reviewQueueKeys);
    const keys = writerBiographyFactReviewBatch43.map((record) => record.key);
    const heldKeys = writerBiographyFactReviewBatch43
      .filter((record) => record.decision === "held")
      .map((record) => record.key);
    const applicableKeys = writerBiographyFactReviewBatch43
      .filter((record) => record.decision !== "held")
      .map((record) => record.key);
    const historicalBoundaryKeys = selectHistoricalWriterBiographyFactReviewBoundary({
      liveReviewQueueKeys: reviewQueueKeys,
      currentBatchHeldKeys: expectedHeldKeys,
      priorAssignedKeys: priorAssigned,
      boundarySize: 40,
    });

    expect(priorReport).toHaveLength(560);
    expect(new Set(priorReport).size).toBe(560);
    for (const batch of priorBatches) expect(batch).toHaveLength(40);
    expect(priorAssigned).toHaveLength(1160);
    expect(priorAssignedSet.size).toBe(1160);
    expect(new Set(quarantineKeys).size).toBe(quarantineKeys.length);
    expect(keys).toEqual(expectedKeys);
    expect(keys).toEqual(historicalBoundaryKeys);
    expect(new Set(keys).size).toBe(40);
    expect(keys.some((key) => priorAssignedSet.has(key))).toBe(false);
    expect(applicableKeys.every((key) => reviewQueueSet.has(key))).toBe(true);
    expect(applicableKeys.some((key) => quarantineKeys.includes(key))).toBe(false);
    expect(heldKeys).toEqual(expectedHeldKeys);
    expect(heldKeys.every((key) => quarantineKeys.includes(key))).toBe(true);
    expect([...keys].sort((a, b) => a.localeCompare(b, "en"))).toEqual(keys);
  });

  it("pins source hashes, restrained Russian copy and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш|одн(?:а|о|им|их)?\s+из\s+(?:главн|ведущ|важнейш|заметн))/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch43) {
      const originalText = sourceTextForKey(record.key);
      const sentenceCount =
        record.reviewedTextRu.match(/[.!?…]+(?=\s+[А-ЯЁ]|$)/gu)?.length ?? 0;
      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(originalText);
      expect(originalText).not.toContain(String.fromCharCode(0xfffd));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(35);
      expect(sentenceCount, record.key).toBeGreaterThanOrEqual(1);
      expect(sentenceCount, record.key).toBeLessThanOrEqual(2);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(WRITER_BIOGRAPHY_FACT_REVIEW_BATCH43_REVIEWER);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims).toHaveLength(1);

      if (record.decision === "held") {
        expect(record.applicableTextRu).toBeNull();
        expect(record.claims.every((claim) => claim.verdict === "not-established")).toBe(true);
      } else {
        expect(record.decision).toBe("corrected");
        expect(record.reviewedTextRu).not.toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(record.claims.every((claim) => claim.verdict === "corrected")).toBe(true);
      }

      for (const claim of record.claims) {
        const hostnames = new Set(claim.evidence.map((item) => new URL(item.url).hostname));
        expect(claim.evidence.length, record.key).toBeGreaterThanOrEqual(2);
        expect(hostnames.size, record.key).toBeGreaterThanOrEqual(2);
        for (const item of claim.evidence) {
          expect(item.provider.trim()).not.toBe("");
          expect(item.checkedAt).toBe("2026-08-20");
          expect(item.findingRu).toMatch(/[А-Яа-яЁё]/);
          const parsedUrl = new URL(item.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }

    const decisions = writerBiographyFactReviewBatch43.map((record) => record.decision);
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(0);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(37);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(3);
  });

  it("integrates applicable records through the build-only registry", () => {
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
    const publicKeys = new Set(
      publicCountries.flatMap((country) =>
        country.writers.map((writer) => `${country.id}:${writer.id}`)
      )
    );

    for (const record of writerBiographyFactReviewBatch43) {
      expect(publicKeys.has(record.key)).toBe(record.decision !== "held");
    }
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch43");
    expect(runtimeReviewAggregator).not.toContain("writerBiographyFactReviewBatch43");
    expect(buildSource).toContain("writerBiographyFactReviewBatch43");
  });

  it("keeps UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviewBatch43.ts"),
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviewBatch43.test.ts"),
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
    const markdown = fs.readFileSync(markdownReportPath, "utf8");
    expect(report.batch).toBe("43");
    expect(report.generatedAt).toBe("2026-08-20");
    expect(report.selectionSnapshot).toEqual({
      reviewQueue: 1684,
      priorAssignedRecords: 1160,
      priorAssignedUnique: 1160,
      quarantine: 85,
      boundary: 40,
      boundaryUnique: 40,
      overlapPriorAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({
      records: 40,
      unchanged: 0,
      corrected: 37,
      held: 3,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch43);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 0");
    expect(markdown).toContain("Исправлено: 37");
    expect(markdown).toContain("Удержано: 3");
    expect(markdown).toContain("overlap с Batch01-42: 0");
  });
});
