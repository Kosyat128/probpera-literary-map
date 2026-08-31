import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expectNoProvenLiveFactRegression } from "./writerBiographyFactReviewBatch.generated-test-support";
import { legacyWriterBiography } from "../writerBiography";
import { bookArchiveCountries as countries } from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH13_REVIEWER,
  writerBiographyFactReviewBatch13,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch13";

const expectedKeys = [
  "belgium:michel_de_ghelderode",
  "belize:colville_young",
  "belize:glen_godfrey",
  "belize:zee_edgell",
  "bhutan:dzongsar_khyentse",
  "bhutan:kunzang_choden",
  "bhutan:pema_lingpa",
  "bolivia:bartolome_arsans_de_orsua_y_vela",
  "bolivia:gaston_suarez",
  "bolivia:hilda_mundy",
  "bolivia:jesus_lara",
  "bolivia:marcelo_quiroga_santa_cruz",
  "bolivia:nataniel_aguirre",
  "bolivia:oscar_cerruto",
  "bolivia:vilma_tapia_anda",
  "bolivia:yolanda_bedregal",
  "bosnia:aleksandar_hemon",
  "bosnia:mehmed_beg_kapetanovic",
  "bosnia:petar_kocic",
  "bosnia:svetozar_corovic",
] as const;

const frozenBatch11Keys = [
  "armenia:grigor_narekatsi",
  "armenia:hovhannes_tumanyan",
  "armenia:narine_abgaryan",
  "armenia:sayat_nova",
  "australia:alexis_wright",
  "australia:banjo_paterson",
  "australia:bruce_pascoe",
  "australia:christina_stead",
  "australia:james_clavell",
  "australia:kate_grenville",
  "australia:markus_zusak",
  "australia:miles_franklin",
  "australia:ruth_park",
  "australia:terry_hayes",
  "austria:arthur_schnitzler",
  "austria:daniel_kehlmann",
  "austria:elias_canetti",
  "austria:rainer_maria_rilke",
  "austria:robert_musil",
  "austria:stefan_zweig",
] as const;

const frozenBatch12Keys = [
  "austria:thomas_bernhard",
  "azerbaijan:chingiz_abdullayev",
  "azerbaijan:mirza_alakbar_sabir",
  "azerbaijan:muhammad_fuzuli",
  "bahamas:cyril_bray",
  "bahamas:wallace_whitfield",
  "bahrain:ali_abdullah_khalifa",
  "bahrain:amin_saleh",
  "bangladesh:jibanananda_das",
  "bangladesh:selina_hossain",
  "bangladesh:tahmima_anam",
  "barbados:austin_clarke",
  "barbados:george_lamming",
  "belarus:ales_adamovich",
  "belarus:svetlana_alexievich",
  "belarus:symeon_polotsky",
  "belarus:yakub_kolas",
  "belarus:yanka_kupala",
  "belgium:amelie_nothomb",
  "belgium:georges_rodenbach",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch13.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch13.md"
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
  for (let batch = 1; batch <= 10; batch += 1) {
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

describe("writer biography claim review batch 13", () => {
  it("pins the next exact 20-key final-reviewQueue boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const excluded = new Set<string>([
      ...priorReportKeys(),
      ...frozenBatch11Keys,
      ...frozenBatch12Keys,
      ...quarantineKeys,
    ]);
    const eligible = factQa.reviewQueue
      .map((item) => item.key)
      .sort()
      .filter((key) => !excluded.has(key));
    const keys = writerBiographyFactReviewBatch13.map((record) => record.key);

    expect(keys).toEqual(expectedKeys);
    expect(keys).toEqual(eligible.slice(0, 20));
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => excluded.has(key))).toBe(false);
    expect([...keys].sort()).toEqual(keys);
  });

  it("pins source SHA, professional Russian and two-source claim evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch13) {
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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH13_REVIEWER
      );
      expect(record.reviewedTextRu).not.toBe(originalText);
      expect(record.decision).toBe("corrected");
      expect(record.applicableTextRu).toBe(record.reviewedTextRu);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);
      expect(record.claims.every((claim) => claim.verdict === "corrected")).toBe(true);

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

    const decisions = writerBiographyFactReviewBatch13.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(0);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(20);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(0);
  });

  it("records date and identity recommendations and stays disconnected from runtime", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      wikidataIdentityReviewQueue: Array<{ key: string; qid: string }>;
      wikidataDateDiscrepancyQueue: Array<{ key: string; field: string }>;
      badQidIdentityQueue: Array<{ key: string; qid: string }>;
      calendarOrSourceDiscrepancyQueue: Array<{ key: string }>;
    };
    const batchKeys = new Set<string>(expectedKeys);
    const byKey = new Map(
      writerBiographyFactReviewBatch13.map((record) => [record.key, record])
    );
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8"
    );
    const runtimeReviewAggregator = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviews.ts"),
      "utf8"
    );

    expectNoProvenLiveFactRegression(factQa, batchKeys);
    expect(byKey.get("bolivia:oscar_cerruto")?.notes).toContain("1912-06-13");
    expect(byKey.get("bosnia:mehmed_beg_kapetanovic")?.notes).toContain("1902-07-29");
    expect(byKey.get("belize:zee_edgell")?.notes).toContain("2020-12-20");
    expect(byKey.get("bolivia:bartolome_arsans_de_orsua_y_vela")?.notes).toContain("1676");
    expect(byKey.get("bolivia:vilma_tapia_anda")?.notes).toContain("Vilma Tapia Anaya");
    expect(byKey.get("bolivia:yolanda_bedregal")?.notes).toContain("1913-09-21");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch13");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch13"
    );
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch13.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch13.test.ts"
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

    expect(report.batch).toBe("13");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 0,
      corrected: 20,
      held: 0,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch13);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Удержано в карантине: 0");
    expect(markdown).toContain("1912-06-13");
    expect(markdown).toContain("1902-07-29");
  });
});
