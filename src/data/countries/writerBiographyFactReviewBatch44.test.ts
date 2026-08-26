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
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH44_REVIEWER,
  writerBiographyFactReviewBatch44,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch44";
import { writerBiographyPublicProfileFactCorrectionsBatch44 } from "./writerBiographyPublicProfileFactCorrectionsBatch44";

const expectedKeys = [
  "paraguay:manuel_ortiz_guerrero",
  "paraguay:mario_ruben_alvarez",
  "paraguay:natalicio_gonzalez",
  "paraguay:rafael_barrett",
  "paraguay:rubén_bareiro_saguier",
  "peru:alfredo_bryce_echenique",
  "peru:cesar_vallejo",
  "peru:claudia_salazar_jimenez",
  "peru:eduardo_gonzalez_viana",
  "peru:fernando_iwasaki",
  "peru:inca_garcilaso_de_la_vega",
  "peru:ivan_thays",
  "peru:jose_maria_arguedas",
  "peru:jose_watanabe",
  "peru:juan_espinosa_medrano",
  "peru:julio_ortega",
  "peru:julio_ramon_ribeyro",
  "peru:manuel_gonzalez_prada",
  "peru:mario_bellatin",
  "peru:mario_vargas_llosa",
  "peru:oscar_colchado_lucio",
  "peru:ricardo_palma",
  "peru:santiago_roncagliolo",
  "philippines:edith_tiempo",
  "philippines:f_sionil_jose",
  "philippines:francisco_balagtas",
  "philippines:jose_rizal",
  "philippines:miguel_syjuco",
  "philippines:nick_joaquin",
  "poland:adam_mickiewicz",
  "poland:boleslaw_prus",
  "poland:czeslaw_milosz",
  "poland:henryk_sienkiewicz",
  "poland:jan_kochanowski",
  "poland:joseph_conrad",
  "poland:juliusz_slowacki",
  "poland:olga_tokarczuk",
  "poland:stanislaw_lem",
  "poland:wislawa_szymborska",
  "poland:wladyslaw_reymont",
] as const;

const factQaPath = path.resolve(process.cwd(), "reports/writer-biography-fact-qa.json");
const reportPath = path.resolve(process.cwd(), "reports/writer-biography-fact-review-batch44.json");
const markdownReportPath = path.resolve(process.cwd(), "reports/writer-biography-fact-review-batch44.md");

function sourceTextForKey(key: string): string {
  const [countryId, writerId] = key.split(":");
  const writer = countries
    .find((country) => country.id === countryId)
    ?.writers.find((item) => item.id === writerId);
  if (!writer) throw new Error("Writer not found: " + key);
  const text = legacyWriterBiography(writer);
  if (!text) throw new Error("Legacy Russian biography not found: " + key);
  return text;
}

function sha256(text: string): string {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

function priorReportKeys(): string[] {
  const keys: string[] = [];
  for (let batch = 1; batch <= 43; batch += 1) {
    const suffix = String(batch).padStart(2, "0");
    const report = JSON.parse(
      fs.readFileSync(
        path.resolve(
          process.cwd(),
          "reports/writer-biography-fact-review-batch" + suffix + ".json"
        ),
        "utf8"
      )
    ) as { records: Array<{ key: string }> };
    keys.push(...report.records.map((record) => record.key));
  }
  return keys;
}

describe("writer biography claim review batch 44", () => {
  it("pins the exact next 40-key historical boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const priorAssigned = priorReportKeys();
    const priorAssignedSet = new Set(priorAssigned);
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => item.countryId + ":" + item.writerId
    );
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const keys = writerBiographyFactReviewBatch44.map((record) => record.key);
    const historicalBoundaryKeys = selectHistoricalWriterBiographyFactReviewBoundary({
      liveReviewQueueKeys: reviewQueueKeys,
      currentBatchHeldKeys: [],
      priorAssignedKeys: priorAssigned,
      boundarySize: 40,
    });

    expect(priorAssigned).toHaveLength(1200);
    expect(priorAssignedSet.size).toBe(1200);
    expect(keys).toEqual(expectedKeys);
    expect(keys).toEqual(historicalBoundaryKeys);
    expect(new Set(keys).size).toBe(40);
    expect(keys.some((key) => priorAssignedSet.has(key))).toBe(false);
    expect(keys.every((key) => reviewQueueKeys.includes(key))).toBe(true);
    expect(keys.some((key) => quarantineKeys.includes(key))).toBe(false);
    expect([...keys].sort((a, b) => a.localeCompare(b, "en"))).toEqual(keys);
  });

  it("pins source hashes, restrained Russian copy and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш|одн(?:а|о|им|их)?\s+из\s+(?:главн|ведущ|важнейш|заметн))/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch44) {
      const originalText = sourceTextForKey(record.key);
      const sentenceCount =
        record.reviewedTextRu.match(/[.!?…]+(?=\s+[А-ЯЁ]|$)/gu)?.length ?? 0;
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(35);
      expect(sentenceCount, record.key).toBeGreaterThanOrEqual(1);
      expect(sentenceCount, record.key).toBeLessThanOrEqual(2);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(WRITER_BIOGRAPHY_FACT_REVIEW_BATCH44_REVIEWER);
      expect(record.decision).toBe("corrected");
      expect(record.applicableTextRu).toBe(record.reviewedTextRu);
      expect(record.reviewedTextRu).not.toBe(originalText);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims).toHaveLength(1);
      expect(record.claims[0]?.verdict).toBe("corrected");

      const evidence = record.claims[0]!.evidence;
      const hostnames = new Set(evidence.map((item) => new URL(item.url).hostname));
      expect(evidence.length, record.key).toBeGreaterThanOrEqual(2);
      expect(hostnames.size, record.key).toBeGreaterThanOrEqual(2);
      for (const item of evidence) {
        expect(item.checkedAt).toBe("2026-08-21");
        expect(item.findingRu).toMatch(/[А-Яа-яЁё]/);
        const parsedUrl = new URL(item.url);
        expect(parsedUrl.protocol).toBe("https:");
        expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
        expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
      }
    }

    expect(writerBiographyFactReviewBatch44).toHaveLength(40);
    expect(
      writerBiographyFactReviewBatch44.filter((record) => record.decision === "corrected")
    ).toHaveLength(40);
    expect(
      writerBiographyFactReviewBatch44.filter((record) => record.decision === "held")
    ).toHaveLength(0);
  });

  it("integrates public patches while keeping detailed evidence build-only", () => {
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
        country.writers.map((writer) => country.id + ":" + writer.id)
      )
    );
    const publicPatchKeys = writerBiographyPublicProfileFactCorrectionsBatch44.map(
      (item) => item.countryId + ":" + item.writerId
    );

    expect(publicPatchKeys).toEqual(expectedKeys);
    expect(publicPatchKeys.every((key) => publicKeys.has(key))).toBe(true);
    const ortizCorrection = writerBiographyPublicProfileFactCorrectionsBatch44.find(
      (item) => item.countryId === "paraguay" && item.writerId === "manuel_ortiz_guerrero"
    );
    const publicOrtiz = publicCountries
      .find((country) => country.id === "paraguay")
      ?.writers.find((writer) => writer.id === "manuel_ortiz_guerrero");
    expect(ortizCorrection?.patch).toMatchObject({
      years: "",
      birthDate: "",
      works: ["Surgente", "El Crimen de Tintalila", "La Conquista"],
    });
    expect(ortizCorrection?.note).toMatch(/1894.*1897/u);
    expect(publicOrtiz).toMatchObject({ years: "", birthDate: "" });
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch44");
    expect(runtimeReviewAggregator).not.toContain("writerBiographyFactReviewBatch44");
    expect(buildSource).toContain("writerBiographyFactReviewBatch44");
  });

  it("keeps UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviewBatch44.ts"),
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviewBatch44.test.ts"),
      path.resolve(process.cwd(), "src/data/countries/writerBiographyPublicProfileFactCorrectionsBatch44.ts"),
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
    expect(report.batch).toBe("44");
    expect(report.generatedAt).toBe("2026-08-21");
    expect(report.selectionSnapshot).toEqual({
      reviewQueue: 1681,
      priorAssignedRecords: 1200,
      priorAssignedUnique: 1200,
      quarantine: 88,
      boundary: 40,
      boundaryUnique: 40,
      overlapPriorAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({
      records: 40,
      unchanged: 0,
      corrected: 40,
      held: 0,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch44);
    expect(markdown).toContain("Без изменений: 0");
    expect(markdown).toContain("Исправлено: 40");
    expect(markdown).toContain("Удержано: 0");
    expect(markdown).toContain("overlap с Batch01-43: 0");
  });
});
