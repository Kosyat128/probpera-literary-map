import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expectNoProvenLiveFactRegression } from "./writerBiographyFactReviewBatch.generated-test-support";
import { legacyWriterBiography } from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH27_REVIEWER,
  writerBiographyFactReviewBatch27,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch27";

const expectedKeys = [
  "england:virginia_woolf",
  "england:walter_scott",
  "england:wilkie_collins",
  "england:william_langland",
  "england:william_shakespeare",
  "england:william_thackeray",
  "equatorial_guinea:maria_nsue_angue",
  "eritrea:alemseged_tesfai",
  "eritrea:hadish_haile",
  "eritrea:khaled_abdalla",
  "eritrea:rebkah_haile",
  "estonia:arvo_valton",
  "estonia:betti_alver",
  "estonia:friedrich_robert_faehlmann",
  "eswatini:albert_ncube",
  "eswatini:gladys_lobola",
  "eswatini:sarah_mlotshwa",
  "eswatini:stanley_madwe",
  "ethiopia:bealu_girma",
  "ethiopia:daniachew_worku",
  "ethiopia:hirut_kefele",
  "ethiopia:kebede_michael",
  "ethiopia:maaza_mengiste",
  "ethiopia:solomon_deressa",
  "ethiopia:tsegaye_gebre_medhin",
  "fiji:brij_lal",
  "fiji:teresia_teaiwa",
  "fiji:vijay_mishra",
  "finland:frans_sillanpaa",
  "finland:fredrika_bremer",
  "finland:johan_ludvig_runeberg",
  "finland:mikael_agricola",
  "finland:minna_canth",
  "finland:tove_jansson",
  "finland:vaino_linna",
  "france:albert_camus",
  "france:alexandre_dumas",
  "france:anatole_france",
  "france:andre_gide",
  "france:annie_ernaux",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch27.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch27.md"
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
  for (let batch = 1; batch <= 26; batch += 1) {
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

describe("writer biography claim review batch 27", () => {
  it("pins the exact 40-key final-reviewQueue boundary without overlap", () => {
    const priorKeys = priorReportKeys();
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const keys = writerBiographyFactReviewBatch27.map((record) => record.key);
    const heldKeys = writerBiographyFactReviewBatch27
      .filter((record) => record.decision === "held")
      .map((record) => record.key);
    const applicableKeys = writerBiographyFactReviewBatch27
      .filter((record) => record.decision !== "held")
      .map((record) => record.key);

    expect(priorKeys).toHaveLength(520);
    expect(new Set(priorKeys).size).toBe(520);
    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(40);
    expect(keys.some((key) => priorKeys.includes(key))).toBe(false);
    expect(heldKeys.every((key) => quarantineKeys.includes(key))).toBe(true);
    expect(applicableKeys.some((key) => quarantineKeys.includes(key))).toBe(false);
    expect([...keys].sort((a, b) => a.localeCompare(b, "en"))).toEqual(keys);
  });

  it("pins raw source hashes, professional Russian and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш|одн(?:а|о|им|их)?\s+из\s+(?:главн|ведущ|важней|заметн))/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch27) {
      const originalText = sourceTextForKey(record.key);
      const sentenceCount =
        record.reviewedTextRu.match(/[.!?…]+(?=\s+[А-ЯЁ]|$)/gu)?.length ?? 0;

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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH27_REVIEWER
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
          expect(item.checkedAt).toBe(
            item.url === "https://old.bigenc.ru/world_history/text/1883169"
              ? "2026-08-31"
              : "2026-08-09"
          );
          expect(item.findingRu.trim()).not.toBe("");
          expect(item.findingRu).toMatch(/[А-Яа-яЁё]/);
          const parsedUrl = new URL(item.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }

    const decisions = writerBiographyFactReviewBatch27.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(5);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(27);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(8);
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
      writerBiographyFactReviewBatch27.map((record) => [record.key, record])
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

    expectNoProvenLiveFactRegression(factQa, batchKeys);
    expect(byKey.get("eritrea:alemseged_tesfai")?.notes).toContain("1942");
    expect(byKey.get("eritrea:alemseged_tesfai")?.notes).toContain("1944");
    expect(byKey.get("estonia:friedrich_robert_faehlmann")?.notes).toContain(
      "1798-12-31"
    );
    expect(byKey.get("finland:fredrika_bremer")?.notes).toContain("1801-08-17");
    expect(byKey.get("finland:fredrika_bremer")?.notes).toContain("1865-12-31");
    expect(
      byKey
        .get("finland:fredrika_bremer")
        ?.claims.flatMap((claim) => claim.evidence)
        .map((item) => item.url)
    ).toContain("https://old.bigenc.ru/world_history/text/1883169");
    expect(byKey.get("ethiopia:bealu_girma")?.notes).toContain("1939");
    expect(byKey.get("finland:mikael_agricola")?.notes).toContain("1508-1510");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch27");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch27"
    );
    expect(buildReviewSource).toContain("writerBiographyFactReviewBatch27");
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch27.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch27.test.ts"
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
      revisedAt?: string;
      selectionSnapshot: {
        reviewQueue: number;
        priorAssignedRecords: number;
        priorAssignedUnique: number;
        quarantine: number;
        boundary: number;
        boundaryUnique: number;
        overlapPriorAssigned: number;
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

    expect(report.batch).toBe("27");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.revisedAt).toBe("2026-08-31");
    expect(report.selectionSnapshot).toEqual({
      reviewQueue: 1720,
      priorAssignedRecords: 520,
      priorAssignedUnique: 520,
      quarantine: 49,
      boundary: 40,
      boundaryUnique: 40,
      overlapPriorAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({
      records: 40,
      unchanged: 5,
      corrected: 27,
      held: 8,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch27);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 5");
    expect(markdown).toContain("Исправлено: 27");
    expect(markdown).toContain("Удержано в карантине: 8");
    expect(markdown).toContain("overlap с Batch01-26: 0");
    expect(markdown).toContain("1798-12-31");
    expect(markdown).toContain("1801-08-17");
    expect(markdown).toContain("Q55991620");
    expect(markdown).toContain("Q215346");
  });
});
