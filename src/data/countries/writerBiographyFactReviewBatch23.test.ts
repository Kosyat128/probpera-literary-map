import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expectNoProvenLiveFactRegression } from "./writerBiographyFactReviewBatch.generated-test-support";
import { legacyWriterBiography } from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH23_REVIEWER,
  writerBiographyFactReviewBatch23,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch23";

const expectedKeys = [
  "england:anne_bronte",
  "england:anthony_burgess",
  "england:anthony_trollope",
  "england:arthur_conan_doyle",
  "england:bede",
  "england:ben_jonson",
  "england:bertrand_russell",
  "england:celia_rees",
  "england:charles_dickens",
  "england:charlotte_bronte",
  "england:chaucer",
  "england:christopher_marlowe",
  "england:daniel_defoe",
  "england:david_mitchell",
  "england:diane_setterfield",
  "england:doris_lessing",
  "england:edmund_spenser",
  "england:emily_bronte",
  "england:evelyn_waugh",
  "england:frederick_forsyth",
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

const frozenBatch22Keys = [
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

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch23.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch23.md"
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
  for (let batch = 1; batch <= 20; batch += 1) {
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

describe("writer biography claim review batch 23", () => {
  it("pins the next exact 20-key final-reviewQueue boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const priorKeys = priorReportKeys();
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const excluded = new Set<string>([
      ...priorKeys,
      ...frozenBatch21Keys,
      ...frozenBatch22Keys,
      ...quarantineKeys,
    ]);
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const eligible = reviewQueueKeys
      .slice()
      .sort()
      .filter((key) => !excluded.has(key));
    const keys = writerBiographyFactReviewBatch23.map((record) => record.key);

    expect(reviewQueueKeys).toHaveLength(new Set(reviewQueueKeys).size);
    expect(priorKeys).toHaveLength(400);
    expect(new Set(priorKeys).size).toBe(400);
    expect(frozenBatch21Keys).toHaveLength(20);
    expect(frozenBatch22Keys).toHaveLength(20);
    expect(keys).toEqual(expectedKeys);
    expect(keys).toEqual(eligible.slice(0, 20));
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => excluded.has(key))).toBe(false);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins raw source hashes, professional Russian and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch23) {
      const originalText = sourceTextForKey(record.key);
      const sentenceText = record.reviewedTextRu
        .replace(/ок\./gu, "ок")
        .replace(/н\.\s*э\./gu, "н э");
      const sentenceCount =
        sentenceText.match(/[.!?…]+(?=\s|$)/gu)?.length ?? 0;

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(originalText);
      expect(originalText).not.toContain(String.fromCharCode(0xfffd));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(80);
      expect(sentenceCount).toBeGreaterThanOrEqual(1);
      expect(sentenceCount, record.key).toBeLessThanOrEqual(3);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH23_REVIEWER
      );
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);

      if (record.decision === "held") {
        expect(record.applicableTextRu).toBeNull();
        expect(
          record.claims.every((claim) => claim.verdict === "not-established")
        ).toBe(true);
      } else if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(
          record.claims.every((claim) => claim.verdict === "supported")
        ).toBe(true);
      } else {
        expect(record.reviewedTextRu).not.toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(
          record.claims.every((claim) => claim.verdict === "corrected")
        ).toBe(true);
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

    const decisions = writerBiographyFactReviewBatch23.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(3);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(17);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(0);
  });

  it("records identity and date recommendations without touching shared runtime", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(
      writerBiographyFactReviewBatch23.map((record) => [record.key, record])
    );
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8"
    );
    const buildReviewSource = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/writer-biography-review-source.ts"),
      "utf8"
    );

    expectNoProvenLiveFactRegression(factQa, batchKeys);
    expect(byKey.get("england:anthony_burgess")?.notes).toContain("Q217619");
    expect(byKey.get("england:bede")?.notes).toContain("Q154938");
    expect(byKey.get("england:chaucer")?.notes).toContain("Q5683");
    expect(byKey.get("england:daniel_defoe")?.notes).toContain("Q40946");
    expect(byKey.get("england:diane_setterfield")?.notes).toContain("Q2550958");
    expect(byKey.get("england:edmund_spenser")?.notes).toContain("Q4352055");
    expect(byKey.get("england:frederick_forsyth")?.notes).toContain("Q249197");
    expect(byKey.get("england:frederick_forsyth")?.notes).toContain("2025");
    expect(byKey.get("england:christopher_marlowe")?.notes).toContain("крещение");
    expect(byKey.get("england:christopher_marlowe")?.notes).toContain("1564");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch23");
    expect(buildReviewSource).toContain("writerBiographyFactReviewBatch23");
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch23.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch23.test.ts"
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

    expect(report.batch).toBe("23");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 3,
      corrected: 17,
      held: 0,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch23);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 3");
    expect(markdown).toContain("Исправлено: 17");
    expect(markdown).toContain("Удержано в карантине: 0");
    expect(markdown).toContain("1564-02-26");
    expect(markdown).toContain("крещение");
    expect(markdown).toContain("Q217619");
    expect(markdown).toContain("2025");
  });
});
