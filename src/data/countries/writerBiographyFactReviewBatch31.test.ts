import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyWriterBiography } from "../writerBiography";
import {
  countries as publicCountries,
  writerBiographyFactReviewSourceCountries as countries,
} from "./index";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";
import { writerBiographyFactReviewBatch28 } from "./writerBiographyFactReviewBatch28";
import { writerBiographyFactReviewBatch29 } from "./writerBiographyFactReviewBatch29";
import { writerBiographyFactReviewBatch30 } from "./writerBiographyFactReviewBatch30";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH31_REVIEWER,
  writerBiographyFactReviewBatch31,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch31";

const expectedKeys = [
  "guatemala:luis_cardoza_y_aragon",
  "guatemala:miguel_angel_asturias",
  "guatemala:rodrigo_rey_rosa",
  "guinea_bissau:abdulai_sila",
  "guinea_bissau:antonio_aurelio_gomes",
  "guinea_bissau:odete_semedo",
  "guinea_republic:camara_laye",
  "guinea_republic:tierno_monenembo",
  "guyana:cyril_dabydeen",
  "guyana:edgar_mittelholzer",
  "guyana:martin_carter",
  "guyana:roshni_kempadoo",
  "guyana:wilson_harris",
  "haiti:edwidge_danticat",
  "haiti:franketienne",
  "haiti:jacques_roumain",
  "haiti:jacques_stephen_alexis",
  "honduras:juan_ramon_molina",
  "honduras:julio_escoto",
  "honduras:ramon_amaya_amador",
  "honduras:roberto_sosa",
  "hong_kong:xi_xi",
  "hungary:antal_szerb",
  "hungary:endre_ady",
  "hungary:imre_kertesz",
  "hungary:imre_madach",
  "hungary:laszlo_krasznahorkai",
  "hungary:miklos_radnoti",
  "hungary:mor_jokai",
  "hungary:sandor_petofi",
  "hungary:zsigmond_moricz",
  "iceland:arnaldur_indridason",
  "iceland:grimur_thomsen",
  "iceland:gudmundur_kamban",
  "iceland:gunnar_gunnarsson",
  "iceland:halldor_laxness",
  "iceland:jon_arnason",
  "iceland:snorri_sturluson",
  "iceland:steinn_steinarr",
  "india:amit_chaudhuri",
] as const;

const expectedHeldKeys = [
  "guinea_bissau:antonio_aurelio_gomes",
  "guyana:roshni_kempadoo",
] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch31.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch31.md"
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
  for (let batch = 1; batch <= 27; batch += 1) {
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

describe("writer biography claim review batch 31", () => {
  it("pins the exact 40-key lexicographic boundary without overlap", () => {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
      reviewQueue: Array<{ key: string }>;
    };
    const priorReport = priorReportKeys();
    const frozenBatch28Keys = writerBiographyFactReviewBatch28.map(
      (record) => record.key
    );
    const frozenBatch29Keys = writerBiographyFactReviewBatch29.map(
      (record) => record.key
    );
    const frozenBatch30Keys = writerBiographyFactReviewBatch30.map(
      (record) => record.key
    );
    const priorAssigned = [
      ...priorReport,
      ...frozenBatch28Keys,
      ...frozenBatch29Keys,
      ...frozenBatch30Keys,
    ];
    const priorAssignedSet = new Set(priorAssigned);
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const reviewQueueSet = new Set(reviewQueueKeys);
    const keys = writerBiographyFactReviewBatch31.map((record) => record.key);
    const heldKeys = writerBiographyFactReviewBatch31
      .filter((record) => record.decision === "held")
      .map((record) => record.key);
    const applicableKeys = writerBiographyFactReviewBatch31
      .filter((record) => record.decision !== "held")
      .map((record) => record.key);

    // Reinsert newly held identities to reconstruct the frozen pre-integration
    // allocation queue. The live QA queue may omit them after quarantine;
    // six later Batch 38 identities and the later Batch 39 hold stay absent
    // and sort after this slice.
    const frozenReviewQueueKeys = [
      ...new Set([...reviewQueueKeys, ...expectedHeldKeys]),
    ];
    const pendingKeys = frozenReviewQueueKeys
      .filter((key) => !priorAssignedSet.has(key))
      .sort((a, b) => a.localeCompare(b, "en"));

    expect(frozenReviewQueueKeys).toHaveLength(1693);
    expect(new Set(frozenReviewQueueKeys).size).toBe(1693);
    expect(priorReport).toHaveLength(560);
    expect(new Set(priorReport).size).toBe(560);
    expect(frozenBatch28Keys).toHaveLength(40);
    expect(frozenBatch29Keys).toHaveLength(40);
    expect(frozenBatch30Keys).toHaveLength(40);
    expect(priorAssigned).toHaveLength(680);
    expect(priorAssignedSet.size).toBe(680);
    expect(pendingKeys).toHaveLength(1046);
    expect(quarantineKeys.length).toBeGreaterThanOrEqual(62);
    expect(new Set(quarantineKeys).size).toBe(quarantineKeys.length);
    expect(keys).toEqual(expectedKeys);
    expect(keys).toEqual(pendingKeys.slice(0, 40));
    expect(new Set(keys).size).toBe(40);
    expect(keys.some((key) => priorAssignedSet.has(key))).toBe(false);
    expect(applicableKeys.every((key) => reviewQueueSet.has(key))).toBe(true);
    expect(applicableKeys.some((key) => quarantineKeys.includes(key))).toBe(
      false
    );
    expect(heldKeys).toEqual(expectedHeldKeys);
    expect(heldKeys.every((key) => quarantineKeys.includes(key))).toBe(true);
    expect([...keys].sort((a, b) => a.localeCompare(b, "en"))).toEqual(keys);
  });

  it("pins raw source hashes, professional Russian and independent evidence", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш|одн(?:а|о|им|их)?\s+из\s+(?:главн|ведущ|важнейш|заметн))/iu;
    const publicReviewMarker =
      /(?:^|[\s:—-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;—-])/iu;

    for (const record of writerBiographyFactReviewBatch31) {
      const originalText = sourceTextForKey(record.key);
      const sentenceCount =
        record.reviewedTextRu.match(/[.!?…]+(?=\s+[А-ЯЁ]|$)/gu)?.length ?? 0;

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(
        originalText
      );
      expect(originalText).not.toContain(String.fromCharCode(0xfffd));
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(35);
      expect(sentenceCount).toBeGreaterThanOrEqual(1);
      expect(sentenceCount, record.key).toBeLessThanOrEqual(2);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH31_REVIEWER
      );
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims).toHaveLength(1);

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
          expect(item.checkedAt).toBe("2026-08-11");
          expect(item.findingRu.trim()).not.toBe("");
          expect(item.findingRu).toMatch(/[А-Яа-яЁё]/);
          const parsedUrl = new URL(item.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }

    const decisions = writerBiographyFactReviewBatch31.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(3);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(35);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(2);
  });

  it("integrates applicable records through the build-only registry", () => {
    const runtimeIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/data/countries/index.ts"),
      "utf8"
    );
    const runtimeReviewAggregator = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviews.ts"
      ),
      "utf8"
    );
    const buildSource = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/writer-biography-review-source.ts"),
      "utf8"
    );
    const publicKeys = new Set(
      publicCountries.flatMap((country) =>
        country.writers.map((writer) => `${country.id}:${writer.id}`)
      )
    );

    for (const record of writerBiographyFactReviewBatch31) {
      if (record.decision === "held") {
        expect(publicKeys.has(record.key)).toBe(false);
      } else {
        expect(publicKeys.has(record.key)).toBe(true);
      }
    }
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch31");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch31"
    );
    expect(buildSource).toContain("writerBiographyFactReviewBatch31");
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch31.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch31.test.ts"
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

    expect(report.batch).toBe("31");
    expect(report.generatedAt).toBe("2026-08-11");
    expect(report.selectionSnapshot).toEqual({
      reviewQueue: 1707,
      priorAssignedRecords: 680,
      priorAssignedUnique: 680,
      quarantine: 62,
      boundary: 40,
      boundaryUnique: 40,
      overlapPriorAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({
      records: 40,
      unchanged: 3,
      corrected: 35,
      held: 2,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch31);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 3");
    expect(markdown).toContain("Исправлено: 35");
    expect(markdown).toContain("Удержано: 2");
    expect(markdown).toContain("overlap с Batch01–30: 0");
  });
});
