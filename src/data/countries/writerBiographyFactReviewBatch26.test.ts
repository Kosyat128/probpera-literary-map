import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expectNoProvenLiveFactRegression } from "./writerBiographyFactReviewBatch.generated-test-support";
import { legacyWriterBiography } from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH26_REVIEWER,
  writerBiographyFactReviewBatch26,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch26";

const expectedKeys = [
  "england:william_golding",
  "england:william_wordsworth",
  "england:winston_churchill",
  "equatorial_guinea:donato_ndongo_bidyogo",
  "equatorial_guinea:juan_tomas_avila_laurel",
  "eritrea:sebhat_gebregziabher",
  "estonia:anton_hansen_tammsaare",
  "estonia:eduard_vilde",
  "estonia:friedebert_tuglas",
  "estonia:friedrich_reinhold_kreutzwald",
  "estonia:jaan_kross",
  "estonia:kristjan_jaak_peterson",
  "estonia:lydia_koidula",
  "estonia:marie_under",
  "ethiopia:haddis_alemayehu",
  "fiji:epeli_hauofa",
  "fiji:satendra_nandan",
  "fiji:subramani",
  "finland:aleksis_kivi",
  "finland:eino_leino",
] as const;

const frozenBatch24Keys = [
  "england:george_eliot",
  "england:george_orwell",
  "england:graham_greene",
  "england:h_g_wells",
  "england:harold_pinter",
  "england:henry_fielding",
  "england:hilary_mantel",
  "england:ian_mcewan",
  "england:j_r_r_tolkien",
  "england:jane_austen",
  "england:joanne_harris",
  "england:john_bunyan",
  "england:john_donne",
  "england:john_fowles",
  "england:john_galsworthy",
  "england:john_keats",
  "england:john_le_carre",
  "england:john_marrs",
  "england:john_milton",
  "england:jonathan_swift",
] as const;

const frozenBatch25Keys = [
  "england:kazuo_ishiguro",
  "england:laurence_sterne",
  "england:lee_child",
  "england:liz_jensen",
  "england:lord_byron",
  "england:oliver_goldsmith",
  "england:oscar_wilde",
  "england:paula_hawkins",
  "england:percy_shelley",
  "england:rafael_sabatini",
  "england:roald_dahl",
  "england:robert_louis_stevenson",
  "england:ronald_delderfield",
  "england:rudyard_kipling",
  "england:samuel_coleridge",
  "england:samuel_richardson",
  "england:stuart_turton",
  "england:t_s_eliot",
  "england:thomas_hardy",
  "england:thomas_more",
] as const;

// These earlier lexical gaps were reserved for the immediately following
// gap-fill allocation before this boundary was frozen. Keeping the reservation
// explicit makes the concurrent machine allocation reproducible.
const reservedGapFillKeys = [
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
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch26.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch26.md"
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
  for (let batch = 1; batch <= 23; batch += 1) {
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

describe("writer biography claim review batch 26", () => {
  it("pins the next exact 20-key final-reviewQueue boundary without overlap", () => {
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const assignedKeys = [
      ...priorReportKeys(),
      ...frozenBatch24Keys,
      ...frozenBatch25Keys,
    ];
    const keys = writerBiographyFactReviewBatch26.map((record) => record.key);
    const heldKeys = writerBiographyFactReviewBatch26
      .filter((record) => record.decision === "held")
      .map((record) => record.key);
    const applicableKeys = writerBiographyFactReviewBatch26
      .filter((record) => record.decision !== "held")
      .map((record) => record.key);

    expect(assignedKeys).toHaveLength(500);
    expect(new Set(assignedKeys).size).toBe(500);
    expect(keys).toEqual(expectedKeys);
    expect(reservedGapFillKeys).toHaveLength(28);
    expect(new Set(reservedGapFillKeys).size).toBe(28);
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => assignedKeys.includes(key))).toBe(false);
    expect(heldKeys.every((key) => quarantineKeys.includes(key))).toBe(true);
    expect(applicableKeys.some((key) => quarantineKeys.includes(key))).toBe(false);
    expect([...keys].sort((a, b) => a.localeCompare(b, "en"))).toEqual(keys);
  });

  it("pins raw source hashes, professional Russian and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш|одн(?:а|о|им|их)?\s+из\s+(?:главн|ведущ|важней|заметн))/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch26) {
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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH26_REVIEWER
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

    const decisions = writerBiographyFactReviewBatch26.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(2);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(17);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(1);
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
      writerBiographyFactReviewBatch26.map((record) => [record.key, record])
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
    expect(byKey.get("eritrea:sebhat_gebregziabher")?.notes).toContain("карантин");
    expect(byKey.get("eritrea:sebhat_gebregziabher")?.notes).toContain(
      "Sibhat Gebre-Egziabher"
    );
    expect(byKey.get("eritrea:sebhat_gebregziabher")?.notes).toContain(
      "Sebhat Ephrem"
    );
    expect(byKey.get("fiji:satendra_nandan")?.notes).toContain("1944-09-22");
    expect(byKey.get("fiji:satendra_nandan")?.notes).toContain("Q7426104");
    expect(byKey.get("fiji:satendra_nandan")?.notes).toContain("1939");
    expect(byKey.get("fiji:subramani")?.notes).toContain("Subramani Ramaswamy");
    expect(byKey.get("fiji:subramani")?.notes).toContain("1949-04-01");
    expect(byKey.get("fiji:subramani")?.notes).toContain("Dina");
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch26");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch26"
    );
    expect(buildReviewSource).toContain("writerBiographyFactReviewBatch26");
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch26.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch26.test.ts"
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
        eligibleAfterAssignedAndQuarantine: number;
        reservedForGapFill: number;
        eligibleAfterReservations: number;
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

    expect(report.batch).toBe("26");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.selectionSnapshot).toEqual({
      reviewQueue: 1720,
      assignedRecords: 500,
      assignedUnique: 500,
      quarantine: 49,
      eligibleAfterAssignedAndQuarantine: 1240,
      reservedForGapFill: 28,
      eligibleAfterReservations: 1212,
      boundary: 20,
      boundaryUnique: 20,
      overlapAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 2,
      corrected: 17,
      held: 1,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch26);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 2");
    expect(markdown).toContain("Исправлено: 17");
    expect(markdown).toContain("Удержано в карантине: 1");
    expect(markdown).toContain("overlap с Batch01-25: 0");
    expect(markdown).toContain("Q7426104");
    expect(markdown).toContain("Sibhat Gebre-Egziabher");
  });
});
