import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import { writerBiographyFactReviewBatch27 } from "./writerBiographyFactReviewBatch27";
import { writerBiographyFactReviewBatch28 } from "./writerBiographyFactReviewBatch28";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH29_REVIEWER,
  writerBiographyFactReviewBatch29,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch29";

const expectedKeys = [
  "france:simone_de_beauvoir",
  "france:stendhal",
  "france:sully_prudhomme",
  "france:victor_hugo",
  "france:voltaire",
  "french_guiana:leon_gontran_damas",
  "gabon:angele_rawiri",
  "gabon:florentin_moussavou_nzigu",
  "gabon:juste_auguste_kotto",
  "gabon:laurent_owondo",
  "gabon:sylvie_ntsame",
  "gambia:baaba_jobarteh",
  "gambia:lenrie_peters",
  "gambia:nana_grey_johnson",
  "gambia:tijan_sallah",
  "georgia:aka_morchiladze",
  "georgia:akaki_tsereteli",
  "georgia:galaktion_tabidze",
  "georgia:ilia_chavchavadze",
  "georgia:konstantine_gamsakhurdia",
  "georgia:nodar_dumbadze",
  "georgia:otar_chiladze",
  "georgia:shota_rustaveli",
  "georgia:vazha_pshavela",
  "germany:alfred_doblin",
  "germany:andreas_gryphius",
  "germany:anna_seghers",
  "germany:bernhard_schlink",
  "germany:bertolt_brecht",
  "germany:christa_wolf",
  "germany:christoph_martin_wieland",
  "germany:daniel_kehlmann",
  "germany:eduard_morike",
  "germany:erich_maria_remarque",
  "germany:franz_kafka",
  "germany:friedrich_schiller",
  "germany:gerhart_hauptmann",
  "germany:grimmelshausen",
  "germany:guenter_grass",
  "germany:hans_sachs",
] as const;

const factQaPath = path.resolve(process.cwd(), "reports/writer-biography-fact-qa.json");
const reportPath = path.resolve(process.cwd(), "reports/writer-biography-fact-review-batch29.json");
const markdownReportPath = path.resolve(process.cwd(), "reports/writer-biography-fact-review-batch29.md");

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
  for (let batch = 1; batch <= 26; batch += 1) {
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

describe("writer biography claim review batch 29", () => {
  it("pins the exact 40-key boundary after frozen batches 27 and 28 with zero overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const priorKeys = priorReportKeys();
    const frozenBatch27Keys = writerBiographyFactReviewBatch27.map((record) => record.key);
    const frozenBatch28Keys = writerBiographyFactReviewBatch28.map((record) => record.key);
    const assignedKeys = [...priorKeys, ...frozenBatch27Keys, ...frozenBatch28Keys];
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const reviewQueueSet = new Set(reviewQueueKeys);
    const keys = writerBiographyFactReviewBatch29.map((record) => record.key);
    const heldKeys = writerBiographyFactReviewBatch29
      .filter((record) => record.decision === "held")
      .map((record) => record.key);
    const applicableKeys = writerBiographyFactReviewBatch29
      .filter((record) => record.decision !== "held")
      .map((record) => record.key);

    // The report freezes the 1720-key allocation snapshot. The live QA queue is
    // intentionally allowed to shrink as earlier frozen batches are integrated.
    expect(reviewQueueKeys).toHaveLength(reviewQueueSet.size);
    expect(priorKeys).toHaveLength(520);
    expect(frozenBatch27Keys).toHaveLength(40);
    expect(frozenBatch28Keys).toHaveLength(40);
    expect(assignedKeys).toHaveLength(600);
    expect(new Set(assignedKeys).size).toBe(600);
    // The allocation snapshot had 49 quarantined identities; subsequent
    // integrations may legitimately append newly held identities.
    expect(quarantineKeys.length).toBeGreaterThanOrEqual(49);
    expect(quarantineKeys).toHaveLength(new Set(quarantineKeys).size);
    expect(keys).toEqual(expectedKeys);
    expect(applicableKeys.every((key) => reviewQueueSet.has(key))).toBe(true);
    expect(new Set(keys).size).toBe(40);
    expect(keys.some((key) => assignedKeys.includes(key))).toBe(false);
    expect(heldKeys.every((key) => quarantineKeys.includes(key))).toBe(true);
    expect(applicableKeys.some((key) => quarantineKeys.includes(key))).toBe(false);
    expect([...keys].sort((a, b) => a.localeCompare(b, "en"))).toEqual(keys);
  });

  it("pins source hashes, neutral Russian and two independent institutional HTTPS sources", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|ведущ|важнейш|главнейш|известнейш|одн(?:а|о|им|их)?\s+из\s+(?:главн|ведущ|важней|заметн))/iu;
    const publicReviewMarker =
      /(?:^|[\s:—-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;—-])/iu;

    for (const record of writerBiographyFactReviewBatch29) {
      const originalText = sourceTextForKey(record.key);
      const sentenceCount = record.reviewedTextRu.match(/[.!?…]+(?=\s|$)/gu)?.length ?? 0;

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
      expect(record.reviewer).toBe(WRITER_BIOGRAPHY_FACT_REVIEW_BATCH29_REVIEWER);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims).toHaveLength(1);

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
        const hostnames = new Set(claim.evidence.map((item) => new URL(item.url).hostname));
        expect(claim.textRu.trim()).not.toBe("");
        expect(claim.evidence.length).toBeGreaterThanOrEqual(2);
        expect(hostnames.size).toBeGreaterThanOrEqual(2);
        for (const item of claim.evidence) {
          const parsedUrl = new URL(item.url);
          expect(item.provider.trim()).not.toBe("");
          expect(item.checkedAt).toBe("2026-08-09");
          expect(item.findingRu.trim()).not.toBe("");
          expect(item.findingRu).toMatch(/[А-Яа-яЁё]/);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }

    expect(writerBiographyFactReviewBatch29.filter((record) => record.decision === "unchanged")).toHaveLength(4);
    expect(writerBiographyFactReviewBatch29.filter((record) => record.decision === "corrected")).toHaveLength(33);
    expect(writerBiographyFactReviewBatch29.filter((record) => record.decision === "held")).toHaveLength(3);
  });

  it("records exact resolved identity and date recommendations in the build-only registry", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
      records: Array<{
        key: string;
        manualResolutions: Array<{
          field: string;
          cardValue: string;
          decision: string;
        }>;
        wikidataEvidence: {
          identityValidationStatus?: string;
          manualIdentityConfirmation?: { qid: string } | null;
        };
      }>;
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(writerBiographyFactReviewBatch29.map((record) => [record.key, record]));
    const identityItems = factQa.wikidataIdentityReviewQueue
      .filter((item) => batchKeys.has(item.key))
      .map(({ key, qid }) => ({ key, qid }));
    const dateItems = factQa.wikidataDateDiscrepancyQueue
      .filter((item) => batchKeys.has(item.key))
      .map(({ key, field }) => ({ key, field }));
    const badQidItems = factQa.badQidIdentityQueue.filter((item) => batchKeys.has(item.key));
    const calendarItems = factQa.calendarOrSourceDiscrepancyQueue.filter((item) =>
      batchKeys.has(item.key)
    );
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8"
    );
    const runtimeAggregator = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviews.ts"),
      "utf8"
    );
    const buildSource = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/writer-biography-review-source.ts"),
      "utf8"
    );

    const shotaQa = factQa.records.find(
      (record) => record.key === "georgia:shota_rustaveli"
    );
    const galaktionQa = factQa.records.find(
      (record) => record.key === "georgia:galaktion_tabidze"
    );

    expect(identityItems).toEqual([]);
    expect(dateItems).toEqual([]);
    expect(badQidItems).toEqual([]);
    expect(calendarItems).toEqual([]);
    expect(shotaQa?.wikidataEvidence).toMatchObject({
      identityValidationStatus: "identity-corroborated",
      manualIdentityConfirmation: { qid: "Q132984" },
    });
    expect(galaktionQa?.manualResolutions).toEqual([
      expect.objectContaining({
        field: "birthDate",
        cardValue: "1891-11-17",
        decision: "corrected-card",
      }),
    ]);
    expect(byKey.get("georgia:shota_rustaveli")?.notes).toContain("Q132984");
    expect(byKey.get("georgia:galaktion_tabidze")?.notes).toContain("1892-11-17");
    expect(byKey.get("georgia:galaktion_tabidze")?.notes).toContain("1891-11-17");
    expect(byKey.get("france:voltaire")?.notes).toContain("1694-02-20");
    expect(byKey.get("france:voltaire")?.notes).toContain("1694-11-21");
    expect(byKey.get("gabon:florentin_moussavou_nzigu")?.notes).toContain("Identity held");
    expect(byKey.get("gabon:juste_auguste_kotto")?.notes).toContain("Identity held");
    expect(byKey.get("gambia:baaba_jobarteh")?.notes).toContain("Identity held");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch29");
    expect(runtimeAggregator).not.toContain("writerBiographyFactReviewBatch29");
    expect(buildSource).toContain("writerBiographyFactReviewBatch29");
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviewBatch29.ts"),
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviewBatch29.test.ts"),
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
      selectionSnapshot: {
        reviewQueue: number;
        assignedRecords: number;
        assignedUnique: number;
        quarantine: number;
        eligibleAfterAssignedAndQuarantine: number;
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

    expect(report.batch).toBe("29");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.selectionSnapshot).toEqual({
      reviewQueue: 1720,
      assignedRecords: 600,
      assignedUnique: 600,
      quarantine: 49,
      eligibleAfterAssignedAndQuarantine: 1140,
      boundary: 40,
      boundaryUnique: 40,
      overlapAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({
      records: 40,
      unchanged: 4,
      corrected: 33,
      held: 3,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch29);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 4");
    expect(markdown).toContain("Исправлено: 33");
    expect(markdown).toContain("Удержано: 3");
    expect(markdown).toContain("overlap с Batch01–28: 0");
    expect(markdown).toContain("Q132984");
    expect(markdown).toContain("1891-11-17");
    expect(markdown).toContain("1694-02-20");
  });
});
