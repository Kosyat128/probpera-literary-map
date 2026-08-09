import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH22_REVIEWER,
  writerBiographyFactReviewBatch22,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch22";

const expectedKeys = [
  "ecuador:lupe_rumazo",
  "ecuador:medardo_angel_silva",
  "ecuador:monica_ojeda",
  "egypt:abbas_al_aqqad",
  "egypt:ahdaf_soueif",
  "egypt:ahmad_shawqi",
  "egypt:alaa_al_aswany",
  "egypt:edward_al_kharrat",
  "egypt:gamal_al_ghitani",
  "egypt:hamdi_abu_golayyel",
  "egypt:ibrahim_aslan",
  "egypt:miral_al_tahawy",
  "egypt:muhammad_husayn_haykal",
  "egypt:radwa_ashour",
  "egypt:yusuf_idris",
  "el_salvador:alvaro_menen_desleal",
  "el_salvador:claribel_alegria",
  "england:agatha_christie",
  "england:aldous_huxley",
  "england:alex_garland",
] as const;

const frozenBatch21Keys = [
  "democratic_republic_of_congo:sylvain_bemba",
  "democratic_republic_of_congo:tshibumba_kanda_matulu",
  "denmark:hans_christian_andersen",
  "denmark:henrik_pontoppidan",
  "denmark:jacob_paludan",
  "denmark:johannes_v_jensen",
  "denmark:karen_blixen",
  "denmark:karl_gjellerup",
  "denmark:martin_andersen_nexo",
  "denmark:peter_hoeg",
  "denmark:soren_kierkegaard",
  "djibouti:abdourahman_h_yama",
  "djibouti:aden_robleh_awaleh",
  "dominican_republic:julia_alvarez",
  "dominican_republic:junot_diaz",
  "ecuador:demetrio_aguilera_malta",
  "ecuador:ernesto_noboa_caamano",
  "ecuador:juan_bautista_aguirre",
  "ecuador:juan_leon_mera",
  "ecuador:juan_montalvo",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch22.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch22.md"
);

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
  return createHash("sha256")
    .update(Buffer.from(text, "utf8"))
    .digest("hex");
}

function priorReportKeys(): string[] {
  const keys: string[] = [];
  for (let batch = 1; batch <= 20; batch += 1) {
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

describe("writer biography claim review batch 22", () => {
  it("pins the next exact 20-key final-reviewQueue boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => item.countryId + ":" + item.writerId
    );
    const assignedKeys = [...priorReportKeys(), ...frozenBatch21Keys];
    const excluded = new Set<string>([
      ...assignedKeys,
      ...quarantineKeys,
    ]);
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const eligible = reviewQueueKeys
      .slice()
      .sort((a, b) => a.localeCompare(b, "en"))
      .filter((key) => !excluded.has(key));
    const keys = writerBiographyFactReviewBatch22.map((record) => record.key);

    expect(reviewQueueKeys).toHaveLength(new Set(reviewQueueKeys).size);
    expect(keys).toEqual(expectedKeys);
    expect(keys).toEqual(eligible.slice(0, 20));
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => excluded.has(key))).toBe(false);
    expect([...keys].sort((a, b) => a.localeCompare(b, "en"))).toEqual(keys);
    expect(assignedKeys).toHaveLength(420);
    expect(new Set(assignedKeys).size).toBe(420);
  });

  it("pins raw source hashes, professional Russian and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш|одн(?:а|о|им|их)?\s+из\s+(?:главн|ведущ|важней|заметн))/iu;
    const publicReviewMarker =
      /(?:^|[\s:—-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;—-])/iu;

    for (const record of writerBiographyFactReviewBatch22) {
      const originalText = sourceTextForKey(record.key);
      const sentenceCount =
        record.reviewedTextRu.match(/[.!?…]+(?=\s|$)/gu)?.length ?? 0;

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(originalText);
      expect(originalText).not.toContain(String.fromCharCode(0xfffd));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(35);
      expect(sentenceCount).toBeGreaterThanOrEqual(1);
      expect(sentenceCount, record.key).toBeLessThanOrEqual(2);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH22_REVIEWER
      );
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);

      if (record.decision === "held") {
        expect(record.applicableTextRu).toBeNull();
        expect(record.claims.every((claim) => claim.verdict === "not-established")).toBe(true);
      } else if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(record.claims.every((claim) => claim.verdict === "supported")).toBe(true);
      } else {
        expect(record.reviewedTextRu).not.toBe(originalText);
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
          expect(item.findingRu).toMatch(/[А-Яа-яЁё]/);
          const parsedUrl = new URL(item.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }

    const decisions = writerBiographyFactReviewBatch22.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(4);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(16);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(0);
  });

  it("records identity and date recommendations and stays disconnected", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(
      writerBiographyFactReviewBatch22.map((record) => [record.key, record])
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
    const buildReviewSource = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/writer-biography-review-source.ts"),
      "utf8"
    );

    expect(identityItems).toEqual([]);
    expect(dateItems).toEqual([]);
    expect(badQidItems).toEqual([]);
    expect(calendarItems).toEqual([]);
    expect(byKey.get("ecuador:lupe_rumazo")?.notes).toContain("1933-10-14");
    expect(byKey.get("ecuador:lupe_rumazo")?.notes).toContain("не устанавливает дату смерти");
    expect(byKey.get("egypt:hamdi_abu_golayyel")?.notes).toContain("2023");
    expect(byKey.get("egypt:hamdi_abu_golayyel")?.notes).toContain("1967");
    expect(byKey.get("egypt:hamdi_abu_golayyel")?.notes).toContain("1968");
    expect(byKey.get("egypt:ibrahim_aslan")?.notes).toContain("1935");
    expect(byKey.get("egypt:ibrahim_aslan")?.notes).toContain("1936");
    expect(byKey.get("egypt:ibrahim_aslan")?.notes).toContain("1937");
    expect(byKey.get("england:agatha_christie")?.notes).toContain("Q35064");
    expect(byKey.get("england:alex_garland")?.notes).toContain("Q542634");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch22");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch22"
    );
    expect(buildReviewSource).toContain("writerBiographyFactReviewBatch22");
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch22.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch22.test.ts"
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
      selectionSnapshot: {
        reviewQueue: number;
        assignedRecords: number;
        assignedUnique: number;
        quarantine: number;
        eligible: number;
        boundary: number;
        boundaryUnique: number;
        overlapAssigned: number;
        overlapQuarantine: number;
      };
      summary: {
        records: number;
        unchanged: number;
        corrected: number;
        held: number;
      };
      records: WriterBiographyFactReviewRecord[];
    };
    const markdown = fs.readFileSync(markdownReportPath, "utf8");

    expect(report.batch).toBe("22");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.selectionSnapshot).toEqual({
      reviewQueue: 1723,
      assignedRecords: 420,
      assignedUnique: 420,
      quarantine: 44,
      eligible: 1318,
      boundary: 20,
      boundaryUnique: 20,
      overlapAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 4,
      corrected: 16,
      held: 0,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch22);
    for (const key of expectedKeys) {
      expect(markdown).toContain(String.fromCharCode(96) + key + String.fromCharCode(96));
    }
    expect(markdown).toContain("Без изменений: 4");
    expect(markdown).toContain("Исправлено: 16");
    expect(markdown).toContain("Удержано в карантине: 0");
    expect(markdown).toContain("overlap с Batch01–21: 0");
    expect(markdown).toContain("1933-10-14");
    expect(markdown).toContain("Q35064");
    expect(markdown).toContain("Q542634");
  });
});
