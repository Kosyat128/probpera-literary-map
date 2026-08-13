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
import { writerBiographyFactReviewBatch31 } from "./writerBiographyFactReviewBatch31";
import { writerBiographyFactReviewBatch32 } from "./writerBiographyFactReviewBatch32";
import { writerBiographyFactReviewBatch33 } from "./writerBiographyFactReviewBatch33";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH34_REVIEWER,
  writerBiographyFactReviewBatch34,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch34";

const expectedKeys = [
  "italy:dante_alighieri",
  "italy:dario_fo",
  "italy:dino_buzzati",
  "italy:elena_ferrante",
  "italy:emilio_salgari",
  "italy:eugenio_montale",
  "italy:francesco_petrarca",
  "italy:gabriele_d_annunzio",
  "italy:giacomo_leopardi",
  "italy:giambattista_marino",
  "italy:giosue_carducci",
  "italy:giovanni_boccaccio",
  "italy:giovanni_verga",
  "italy:grazia_deledda",
  "italy:italo_calvino",
  "italy:italo_svevo",
  "italy:jacopone_da_todi",
  "italy:ludovico_ariosto",
  "italy:luigi_capuana",
  "italy:luigi_pirandello",
  "italy:niccolo_machiavelli",
  "italy:primo_levi",
  "italy:roberto_saviano",
  "italy:salvatore_quasimodo",
  "italy:silvio_pellico",
  "italy:torquato_tasso",
  "italy:umberto_eco",
  "italy:vittorio_alfieri",
  "jamaica:andrew_salky",
  "jamaica:claude_mckay",
  "jamaica:kerry_yang",
  "jamaica:marlon_james",
  "jamaica:roger_mais",
  "japan:akutagawa_ryunosuke",
  "japan:banana_yoshimoto",
  "japan:chikamatsu_monzaemon",
  "japan:futabatei_shimei",
  "japan:haruki_murakami",
  "japan:hirano_keichiro",
  "japan:hiromi_kawakami",
] as const;

const expectedHeldKeys = [] as const;

const factQaPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch34.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch34.md"
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

describe("writer biography claim review batch 34", () => {
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
    const frozenBatch31Keys = writerBiographyFactReviewBatch31.map(
      (record) => record.key
    );
    const frozenBatch32Keys = writerBiographyFactReviewBatch32.map(
      (record) => record.key
    );
    const frozenBatch33Keys = writerBiographyFactReviewBatch33.map(
      (record) => record.key
    );
    const priorAssigned = [
      ...priorReport,
      ...frozenBatch28Keys,
      ...frozenBatch29Keys,
      ...frozenBatch30Keys,
      ...frozenBatch31Keys,
      ...frozenBatch32Keys,
      ...frozenBatch33Keys,
    ];
    const priorAssignedSet = new Set(priorAssigned);
    const quarantineKeys = quarantinedWriterIdentities.map(
      (item) => `${item.countryId}:${item.writerId}`
    );
    const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
    const reviewQueueSet = new Set(reviewQueueKeys);
    const keys = writerBiographyFactReviewBatch34.map((record) => record.key);
    const heldKeys = writerBiographyFactReviewBatch34
      .filter((record) => record.decision === "held")
      .map((record) => record.key);
    const applicableKeys = writerBiographyFactReviewBatch34
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

    expect(frozenReviewQueueKeys).toHaveLength(1691);
    expect(new Set(frozenReviewQueueKeys).size).toBe(1691);
    expect(priorReport).toHaveLength(560);
    expect(new Set(priorReport).size).toBe(560);
    expect(frozenBatch28Keys).toHaveLength(40);
    expect(frozenBatch29Keys).toHaveLength(40);
    expect(frozenBatch30Keys).toHaveLength(40);
    expect(frozenBatch31Keys).toHaveLength(40);
    expect(frozenBatch32Keys).toHaveLength(40);
    expect(frozenBatch33Keys).toHaveLength(40);
    expect(priorAssigned).toHaveLength(800);
    expect(priorAssignedSet.size).toBe(800);
    expect(pendingKeys).toHaveLength(926);
    expect(quarantineKeys.length).toBeGreaterThanOrEqual(64);
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

    for (const record of writerBiographyFactReviewBatch34) {
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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH34_REVIEWER
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

    const decisions = writerBiographyFactReviewBatch34.map(
      (record) => record.decision
    );
    expect(decisions.filter((decision) => decision === "unchanged")).toHaveLength(0);
    expect(decisions.filter((decision) => decision === "corrected")).toHaveLength(40);
    expect(decisions.filter((decision) => decision === "held")).toHaveLength(0);
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

    for (const record of writerBiographyFactReviewBatch34) {
      if (record.decision === "held") {
        expect(publicKeys.has(record.key)).toBe(false);
      } else {
        expect(publicKeys.has(record.key)).toBe(true);
      }
    }
    expect(runtimeIndex).not.toContain("writerBiographyFactReviewBatch34");
    expect(runtimeReviewAggregator).not.toContain(
      "writerBiographyFactReviewBatch34"
    );
    expect(buildSource).toContain("writerBiographyFactReviewBatch34");
  });

  it("keeps strict UTF-8 and JSON/Markdown reports synchronized", () => {
    const sourcePaths = [
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch34.ts"
      ),
      path.resolve(
        process.cwd(),
        "src/data/countries/writerBiographyFactReviewBatch34.test.ts"
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

    expect(report.batch).toBe("34");
    expect(report.generatedAt).toBe("2026-08-11");
    expect(report.selectionSnapshot).toEqual({
      reviewQueue: 1705,
      priorAssignedRecords: 800,
      priorAssignedUnique: 800,
      quarantine: 64,
      boundary: 40,
      boundaryUnique: 40,
      overlapPriorAssigned: 0,
      overlapQuarantine: 0,
    });
    expect(report.summary).toEqual({
      records: 40,
      unchanged: 0,
      corrected: 40,
      held: 0,
    });
    expect(report.records).toEqual(writerBiographyFactReviewBatch34);
    for (const key of expectedKeys) expect(markdown).toContain(`\`${key}\``);
    expect(markdown).toContain("Без изменений: 0");
    expect(markdown).toContain("Исправлено: 40");
    expect(markdown).toContain("Удержано: 0");
    expect(markdown).toContain("overlap с Batch01–33: 0");
  });
});


