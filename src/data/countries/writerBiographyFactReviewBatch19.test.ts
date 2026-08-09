import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { bookArchiveCountries as countries } from "./index";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH19_REVIEWER,
  writerBiographyFactReviewBatch19,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch19";

const expectedKeys = [
  "china:zhang_a_ling",
  "china:zhang_ling",
  "china:zhuangzi",
  "colombia:alvaro_mutis",
  "colombia:andres_caicedo",
  "colombia:fernando_vallejo",
  "colombia:gabriel_garcia_marquez",
  "colombia:german_castro_caycedo",
  "colombia:hector_abad_faciolince",
  "colombia:hector_rojas_herazo",
  "colombia:jorge_isaacs",
  "colombia:juan_carlos_botero",
  "colombia:laura_restrepo",
  "colombia:leon_de_greiff",
  "colombia:pilar_quintana",
  "colombia:ricardo_silva_romero",
  "colombia:santiago_mutis_duran",
  "comoros:mahmoud_said_ahmed",
  "comoros:said_ahmed_mohamed",
  "comoros:salim_hatubou",
] as const;

const frozenBatch17Keys = [
  "chile:lina_meruane",
  "chile:luis_sepúlveda",
  "chile:marcela_serrano",
  "chile:marta_brunet",
  "chile:nicanor_parra",
  "chile:pablo_neruda",
  "chile:raul_zurita",
  "chile:roberto_bolano",
  "chile:vicente_huidobro",
  "china:ai_qing",
  "china:ba_jin",
  "china:bai_juyi",
  "china:bei_dao",
  "china:can_xue",
  "china:cao_xueqin",
  "china:chi_ziqiang",
  "china:chiang_sheng_tao",
  "china:confucius",
  "china:du_fu",
  "china:gao_xingjian",
] as const;

const frozenBatch18Keys = [
  "china:gong_zi_zhen",
  "china:han_han",
  "china:jia_pingwa",
  "china:lao_she",
  "china:lao_tzu",
  "china:li_bai",
  "china:lu_xun",
  "china:luo_guanzhong",
  "china:mao_dun",
  "china:mo_yan",
  "china:pu_songling",
  "china:shi_naian",
  "china:sima_qian",
  "china:su_tong",
  "china:tao_yuanming",
  "china:wang_meng",
  "china:wang_wei",
  "china:wu_chengen",
  "china:yan_lianke",
  "china:yu_hua",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch19.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch19.md"
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
  for (let batch = 1; batch <= 16; batch += 1) {
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

describe("writer biography claim review batch 19", () => {
  it("pins the next exact 20-key final-reviewQueue boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const assigned = new Set<string>([
      ...priorReportKeys(),
      ...frozenBatch17Keys,
      ...frozenBatch18Keys,
    ]);
    const keys = writerBiographyFactReviewBatch19.map((record) => record.key);

    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => assigned.has(key))).toBe(false);
    expect([...keys].sort()).toEqual(keys);
    expect(factQa.reviewQueue.length).toBeGreaterThan(0);
  });

  it("pins source SHA, professional Russian and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш)/iu;
    const publicReviewMarker =
      /(?:^|[\s:—-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;—-])/iu;

    for (const record of writerBiographyFactReviewBatch19) {
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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH19_REVIEWER
      );
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);

      if (record.decision === "held") {
        expect(record.applicableTextRu).toBeNull();
        expect(record.claims.every((claim) => claim.verdict === "not-established")).toBe(true);
      } else {
        expect(record.reviewedTextRu).not.toBe(originalText);
        expect(record.decision).toBe("corrected");
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

    const decisions = writerBiographyFactReviewBatch19.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(0);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(19);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(1);
  });

  it("records date and identity recommendations and stays disconnected", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(
      writerBiographyFactReviewBatch19.map((record) => [record.key, record])
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
    const buildReviewSource = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/writer-biography-review-source.ts"),
      "utf8"
    );

    expect(identityItems).toEqual([]);
    expect(dateItems).toEqual([]);
    expect(badQidItems).toEqual([]);
    expect(calendarItems).toEqual([]);
    expect(byKey.get("china:zhang_ling")?.notes).toContain("Hangzhou");
    expect(byKey.get("china:zhuangzi")?.notes).toContain("Q47739");
    expect(byKey.get("colombia:hector_rojas_herazo")?.notes).toContain("2002-04-11");
    expect(byKey.get("colombia:ricardo_silva_romero")?.notes).toContain("1975-08-14");
    expect(byKey.get("comoros:mahmoud_said_ahmed")?.decision).toBe("held");
    expect(byKey.get("comoros:said_ahmed_mohamed")?.notes).toContain("1947-12-12");
    expect(byKey.get("comoros:said_ahmed_mohamed")?.notes).toContain("Tanzania");
    expect(byKey.get("comoros:salim_hatubou")?.notes).toContain("Hahaya");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch19");
    expect(buildReviewSource).toContain(
      "writerBiographyFactReviewBatch19"
    );
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch19.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch19.test.ts"
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

    expect(report.batch).toBe("19");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 0,
      corrected: 19,
      held: 1,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch19);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 0");
    expect(markdown).toContain("Исправлено: 19");
    expect(markdown).toContain("Удержано в карантине: 1");
    expect(markdown).toContain("1975-08-14");
    expect(markdown).toContain("1947-12-12");
  });
});
