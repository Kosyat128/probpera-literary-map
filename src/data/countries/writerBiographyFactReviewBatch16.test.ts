import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import { bookArchiveCountries as countries } from "./index";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH16_REVIEWER,
  writerBiographyFactReviewBatch16,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch16";

const expectedKeys = [
  "cape_verde:manuel_lopes",
  "cape_verde:ovidio_martins",
  "cape_verde:virgilio_de_lemos",
  "central_african_republic:benoit_ndemba",
  "central_african_republic:etienne_goyemide",
  "chad:ahmat_taboye",
  "chad:felix_tchikaya",
  "chad:koulsy_lamko",
  "chad:nimrod",
  "chile:alberto_blest_gana",
  "chile:alejandra_costamagna",
  "chile:alejandro_jodorowsky_chile",
  "chile:alejandro_zambra",
  "chile:baldomero_lillo",
  "chile:diamela_eltit",
  "chile:gabriela_mistral",
  "chile:hernan_rivera_letelier",
  "chile:isabel_allende",
  "chile:jose_donoso",
  "chile:jose_miguel_varas",
] as const;

const frozenBatch15Keys = [
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

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch16.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch16.md"
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
          `reports/writer-biography-fact-review-batch${suffix}.json`
        ),
        "utf8"
      )
    ) as { records: Array<{ key: string }> };
    keys.push(...report.records.map((record) => record.key));
  }
  return keys;
}

describe("writer biography claim review batch 16", () => {
  it("pins the next exact 20-key final-reviewQueue boundary without overlap", () => {
    const excluded = new Set<string>([
      ...priorReportKeys(),
      ...frozenBatch15Keys,
    ]);
    const keys = writerBiographyFactReviewBatch16.map((record) => record.key);

    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => excluded.has(key))).toBe(false);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins source SHA, professional Russian and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch16) {
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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH16_REVIEWER
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

    const decisions = writerBiographyFactReviewBatch16.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(0);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(18);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(2);
  });

  it("records queue recommendations and stays disconnected from runtime", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(
      writerBiographyFactReviewBatch16.map((record) => [record.key, record])
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

    expect(identityItems).toEqual([]);
    expect(dateItems).toEqual([]);
    expect(badQidItems).toEqual([]);
    expect(calendarItems).toEqual([]);
    expect(byKey.get("cape_verde:ovidio_martins")?.notes).toContain("1928-09-17");
    expect(byKey.get("cape_verde:virgilio_de_lemos")?.notes).toContain("Мозамбику");
    expect(byKey.get("central_african_republic:etienne_goyemide")?.notes).toContain("cameroon:etienne_goyemide");
    expect(byKey.get("chad:ahmat_taboye")?.notes).toContain("Ahmad Taboye");
    expect(byKey.get("chile:alberto_blest_gana")?.notes).toContain("1830-05-04");
    expect(byKey.get("chile:diamela_eltit")?.notes).toContain("1949-08-24");
    expect(byKey.get("central_african_republic:benoit_ndemba")?.decision).toBe("held");
    expect(byKey.get("chad:felix_tchikaya")?.decision).toBe("held");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch16");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch16"
    );
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch16.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch16.test.ts"
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

    expect(report.batch).toBe("16");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 0,
      corrected: 18,
      held: 2,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch16);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Удержано в карантине: 2");
    expect(markdown).toContain("1928-09-17");
    expect(markdown).toContain("1949-08-24");
  });
});
