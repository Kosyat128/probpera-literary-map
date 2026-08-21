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
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH45_REVIEWER,
  writerBiographyFactReviewBatch45,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch45";
import { writerBiographyPublicProfileFactCorrectionsBatch45 } from "./writerBiographyPublicProfileFactCorrectionsBatch45";

const expectedKeys = [
  "portugal:alexandre_herculano",
  "portugal:almeida_garrett",
  "portugal:antonio_lobo_antunes",
  "portugal:augusto_abreu",
  "portugal:branquinho_da_fonseca",
  "portugal:eca_de_queiros",
  "portugal:fernando_pessoa",
  "portugal:gil_vicente",
  "portugal:goncalo_m_tavares",
  "portugal:helia_correa",
  "portugal:herberto_helder",
  "portugal:jose_luis_peixoto",
  "portugal:jose_rodrigues_dos_santos",
  "portugal:jose_saramago",
  "portugal:lidia_jorge",
  "portugal:luis_de_camoes",
  "portugal:manuel_de_aranha",
  "portugal:mario_de_sa_carneiro",
  "portugal:miguel_torga",
  "portugal:sofia_de_mello_breyner",
  "portugal:vergilio_ferreira",
  "portugal:walter_hugo_mae",
  "puerto_rico:esmeralda_santiago",
  "puerto_rico:jose_luis_gonzalez",
  "puerto_rico:julia_de_burgos",
  "puerto_rico:manuel_ramos_otero",
  "puerto_rico:rene_marques",
  "qatar:abdulaziz_al_mahmoud",
  "qatar:ahmad_al_mahmoud",
  "qatar:jamal_fayiz_al_maliki",
  "qatar:kulthum_jaber",
  "republic_of_congo:alain_mabanckou",
  "republic_of_congo:daniel_biyaoula",
  "republic_of_congo:emmanuel_dongala",
  "republic_of_congo:guy_menga",
  "republic_of_congo:henri_lopes",
  "republic_of_congo:jean_baptiste_tati_loutard",
  "republic_of_congo:jean_malonga",
  "republic_of_congo:sony_labou_tansi",
  "republic_of_congo:sylvain_bemba",
] as const;

const expectedHeldKeys = [
  "portugal:augusto_abreu",
  "qatar:ahmad_al_mahmoud",
  "qatar:jamal_fayiz_al_maliki",
] as const;

const factQaPath = path.resolve(process.cwd(), "reports/writer-biography-fact-qa.json");
const reportPath = path.resolve(process.cwd(), "reports/writer-biography-fact-review-batch45.json");
const markdownReportPath = path.resolve(process.cwd(), "reports/writer-biography-fact-review-batch45.md");

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
  for (let batch = 1; batch <= 44; batch += 1) {
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

function publicWriter(key: string) {
  const [countryId, writerId] = key.split(":");
  return publicCountries
    .find((country) => country.id === countryId)
    ?.writers.find((writer) => writer.id === writerId);
}

describe("writer biography claim review batch 45", () => {
  it("pins the exact next 40-key historical boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const priorAssigned = priorReportKeys();
    const priorAssignedSet = new Set(priorAssigned);
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const reviewQueueSet = new Set(reviewQueueKeys);
    const keys = writerBiographyFactReviewBatch45.map((record) => record.key);
    const heldKeys = writerBiographyFactReviewBatch45
      .filter((record) => record.decision === "held")
      .map((record) => record.key);
    const applicableKeys = writerBiographyFactReviewBatch45
      .filter((record) => record.decision !== "held")
      .map((record) => record.key);
    const historicalBoundaryKeys = selectHistoricalWriterBiographyFactReviewBoundary({
      liveReviewQueueKeys: reviewQueueKeys,
      currentBatchHeldKeys: expectedHeldKeys,
      priorAssignedKeys: priorAssigned,
      boundarySize: 40,
    });

    expect(priorAssigned).toHaveLength(1240);
    expect(priorAssignedSet.size).toBe(1240);
    expect(new Set(quarantineKeys).size).toBe(quarantineKeys.length);
    expect(keys).toEqual(expectedKeys);
    expect(keys).toEqual(historicalBoundaryKeys);
    expect(new Set(keys).size).toBe(40);
    expect(keys.some((key) => priorAssignedSet.has(key))).toBe(false);
    expect(applicableKeys.every((key) => reviewQueueSet.has(key))).toBe(true);
    expect(applicableKeys.some((key) => quarantineKeys.includes(key))).toBe(false);
    expect(heldKeys).toEqual(expectedHeldKeys);
    expect(heldKeys.every((key) => quarantineKeys.includes(key))).toBe(true);
    expect([...keys].sort((left, right) => left.localeCompare(right, "en"))).toEqual(keys);
  });

  it("pins source hashes, restrained Russian copy and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш|одн(?:а|о|им|их)?\s+из\s+(?:главн|ведущ|важнейш|заметн))/iu;
    const publicReviewMarker =
      /(?:^|[\s:—-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;—-])/iu;

    for (const record of writerBiographyFactReviewBatch45) {
      const originalText = sourceTextForKey(record.key);
      const sentenceCount =
        record.reviewedTextRu.match(/[.!?…]+(?=\s+[А-ЯЁ]|$)/gu)?.length ?? 0;
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(35);
      expect(sentenceCount, record.key).toBeGreaterThanOrEqual(1);
      expect(sentenceCount, record.key).toBeLessThanOrEqual(2);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(WRITER_BIOGRAPHY_FACT_REVIEW_BATCH45_REVIEWER);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims).toHaveLength(1);

      if (record.decision === "held") {
        expect(record.applicableTextRu).toBeNull();
        expect(record.claims[0]?.verdict).toBe("not-established");
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
        expect(item.checkedAt).toBe("2026-08-21");
        expect(item.findingRu).toMatch(/[А-Яа-яЁё]/);
        const parsedUrl = new URL(item.url);
        expect(parsedUrl.protocol).toBe("https:");
        expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
        expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        expect(parsedUrl.hostname).not.toBe("www.valterhugomae.com");
      }
    }

    expect(writerBiographyFactReviewBatch45).toHaveLength(40);
    expect(writerBiographyFactReviewBatch45.filter((record) => record.decision === "corrected")).toHaveLength(37);
    expect(writerBiographyFactReviewBatch45.filter((record) => record.decision === "held")).toHaveLength(3);
  });

  it("publishes only corrected structured patches and keeps risky facts fail-closed", () => {
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
    const portugalSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/portugal.ts"),
      "utf8"
    );
    const publicPatchKeys = writerBiographyPublicProfileFactCorrectionsBatch45.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const correctedKeys = writerBiographyFactReviewBatch45
      .filter((record) => record.decision === "corrected")
      .map((record) => record.key);

    expect(publicPatchKeys).toEqual(correctedKeys);
    expect(writerBiographyPublicProfileFactCorrectionsBatch45).toHaveLength(37);
    for (const record of writerBiographyFactReviewBatch45) {
      expect(Boolean(publicWriter(record.key))).toBe(record.decision === "corrected");
    }
    expect(publicWriter("portugal:antonio_lobo_antunes")).toMatchObject({
      years: "1942–2026",
      deathDate: "2026-03-05",
    });
    expect(publicWriter("portugal:luis_de_camoes")).toMatchObject({
      birthDate: "",
      birthPlace: "",
    });
    expect(publicWriter("portugal:walter_hugo_mae")).toMatchObject({
      fullName: "",
      birthDate: "1971",
    });
    expect(publicWriter("republic_of_congo:jean_malonga")?.deathDate).toBe("1985");
    expect(publicWriter("portugal:manuel_de_aranha")).toMatchObject({
      id: "manuel_de_aranha",
      name: "Мануэл де Арриага",
    });
    expect(portugalSource).not.toContain("valterhugomae.com");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch45");
    expect(runtimeReviewAggregator).not.toContain("writerBiographyFactReviewBatch45");
    expect(buildSource).toContain("writerBiographyFactReviewBatch45");
  });

  it("keeps UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviewBatch45.ts"),
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviewBatch45.test.ts"),
      path.resolve(process.cwd(), "src/data/countries/writerBiographyPublicProfileFactCorrectionsBatch45.ts"),
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
    expect(report.batch).toBe("45");
    expect(report.generatedAt).toBe("2026-08-21");
    expect(report.selectionSnapshot).toEqual({
      reviewQueue: 1681,
      priorAssignedRecords: 1240,
      priorAssignedUnique: 1240,
      quarantine: 88,
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
    expect(report.records).toEqual(writerBiographyFactReviewBatch45);
    expect(markdown).toContain("Без изменений: 0");
    expect(markdown).toContain("Исправлено: 37");
    expect(markdown).toContain("Удержано: 3");
    expect(markdown).toContain("overlap с Batch01–44: 0");
  });
});
