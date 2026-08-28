import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { bookArchiveCountries as countries } from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH21_REVIEWER,
  writerBiographyFactReviewBatch21,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch21";

const expectedKeys = [
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

const frozenBatch20Keys = [
  "cook_islands:sir_thomas_davis",
  "cote_d_ivoire:jean_marie_adiaffi",
  "cote_d_ivoire:maurice_bandaman",
  "cote_d_ivoire:tanella_boni",
  "cote_d_ivoire:veronique_tadjo",
  "croatia:antun_matos",
  "croatia:dubravka_ugresic",
  "croatia:ivana_brlic_mazuranic",
  "cyprus:alex_michaelides",
  "cyprus:kyriakos_charalambous",
  "cyprus:nikos_nikolaidis",
  "cyprus:pantelis_michanikos",
  "cyprus:tefkros_anthias",
  "czechia:alois_jirasek",
  "czechia:jan_amos_komensky",
  "czechia:jaroslav_hasek",
  "democratic_republic_of_congo:antoine_roger_bolamba",
  "democratic_republic_of_congo:fiston_mwanza_mujila",
  "democratic_republic_of_congo:kama_sywor_kamanda",
  "democratic_republic_of_congo:pie_tshibanda",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch21.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch21.md"
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
  for (let batch = 1; batch <= 19; batch += 1) {
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

describe("writer biography claim review batch 21", () => {
  it("pins the frozen 20-key original-queue boundary without overlap", () => {
    const keys = writerBiographyFactReviewBatch21.map((record) => record.key);
    const priorKeys = priorReportKeys();
    const assignedKeys = [...priorKeys, ...frozenBatch20Keys];
    const assigned = new Set<string>(assignedKeys);
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );

    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(priorKeys).toHaveLength(380);
    expect(assignedKeys).toHaveLength(400);
    expect(new Set(assignedKeys).size).toBe(400);
    expect(keys.some((key) => assigned.has(key))).toBe(false);
    expect(quarantineKeys.filter((key) => keys.includes(key))).toEqual([
      "democratic_republic_of_congo:sylvain_bemba",
      "democratic_republic_of_congo:tshibumba_kanda_matulu",
      "djibouti:abdourahman_h_yama",
    ]);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins source SHA, professional Russian and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch21) {
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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH21_REVIEWER
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
          const parsedUrl = new URL(item.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }

    const decisions = writerBiographyFactReviewBatch21.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(0);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(19);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(1);
  });

  it("records identity and date resolutions and is connected only to the build source", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(
      writerBiographyFactReviewBatch21.map((record) => [record.key, record])
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
    expect(byKey.get("democratic_republic_of_congo:sylvain_bemba")?.notes).toContain("Republic of the Congo");
    expect(byKey.get("democratic_republic_of_congo:tshibumba_kanda_matulu")?.notes).toContain("художник");
    expect(byKey.get("denmark:jacob_paludan")?.notes).toContain("Жюль Верн");
    expect(byKey.get("djibouti:abdourahman_h_yama")?.decision).toBe("held");
    expect(byKey.get("djibouti:aden_robleh_awaleh")?.notes).toContain("1941");
    expect(byKey.get("djibouti:aden_robleh_awaleh")?.notes).toContain("2014-10-31");
    expect(byKey.get("ecuador:demetrio_aguilera_malta")?.notes).toContain("Агилера");
    expect(byKey.get("ecuador:ernesto_noboa_caamano")?.notes).toContain("1889");
    expect(byKey.get("ecuador:juan_montalvo")?.notes).toContain("Geometría moral");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch21");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch21"
    );
    expect(buildReviewSource).toContain("writerBiographyFactReviewBatch21");
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch21.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch21.test.ts"
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

    expect(report.batch).toBe("21");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.selectionSnapshot).toEqual({
      reviewQueue: 1723,
      assignedRecords: 400,
      assignedUnique: 400,
      quarantine: 44,
      eligible: 1338,
      boundary: 20,
      boundaryUnique: 20,
      overlapAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 0,
      corrected: 19,
      held: 1,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch21);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 0");
    expect(markdown).toContain("Исправлено: 19");
    expect(markdown).toContain("Удержано в карантине: 1");
    expect(markdown).toContain("overlap с Batch01-20: 0");
    expect(markdown).toContain("2014-10-31");
  });
});
