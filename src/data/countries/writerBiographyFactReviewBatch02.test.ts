import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  legacyWriterBiography,
  selectWriterBiography,
} from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH02_REVIEWER,
  writerBiographyFactReviewBatch02,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch02";
import {
  writerBiographyLegacyCorrections,
  writerIdentityCorrections,
} from "./writerBiographyLegacyCorrections";
import { nobelLiteratureLaureateIdByWriterKey } from "./nobelLiteratureRegistry";

const expectedKeys = [
  "argentina:andres_neuman",
  "argentina:cesar_aira",
  "argentina:claudia_pineiro",
  "argentina:domingo_faustino_sarmiento",
  "argentina:ernesto_sabato",
  "argentina:esteban_echeverria",
  "argentina:jorge_luis_borges",
  "argentina:julio_cortazar",
  "argentina:manuel_puig",
  "argentina:mariana_enriquez",
  "argentina:samanta_schweblin",
  "argentina:victoria_ocampo",
  "armenia:avetik_isahakyan",
  "armenia:hrant_matevosyan",
  "armenia:khachatur_abovian",
  "armenia:mesrop_mashtots",
  "armenia:william_saroyan",
  "australia:christos_tsiolkas",
  "australia:gerald_murnane",
  "australia:greg_egan",
] as const;

const batch01Keys = new Set([
  "afghanistan:atiq_rahimi",
  "afghanistan:khalilullah_khalili",
  "afghanistan:mahmud_tarzi",
  "albania:ismail_kadare",
  "albania:jeronim_de_rada",
  "albania:mitrush_kuteli",
  "albania:naim_frasheri",
  "algeria:assia_djebar",
  "algeria:kateb_yacine",
  "algeria:mohammed_dib",
  "algeria:moufdi_zakaria",
  "algeria:mouloud_feraoun",
  "algeria:rachid_boudjedra",
  "andorra:antoni_morell_i_mora",
  "angola:agostinho_neto",
  "angola:jose_luandino_vieira",
  "angola:ondjaki",
  "angola:pepetela",
  "antigua_and_barbuda:jamaica_kincaid",
  "argentina:adolfo_bioy_casares",
]);

const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch02.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch02.md"
);

function sourceTextForKey(key: string): string {
  const [countryId, writerId] = key.split(":");
  const writer = countries
    .find((country) => country.id === countryId)
    ?.writers.find((item) => item.id === writerId);
  if (!writer) {
    throw new Error(`Writer not found: ${key}`);
  }
  const text = legacyWriterBiography(writer);
  if (!text) {
    throw new Error(`Legacy Russian biography not found: ${key}`);
  }
  return text;
}

function sha256(text: string): string {
  return createHash("sha256")
    .update(Buffer.from(text, "utf8"))
    .digest("hex");
}

function eligibleReviewQueueKeys(): string[] {
  const report = JSON.parse(
    fs.readFileSync(
      path.resolve(process.cwd(), "reports/writer-biography-fact-qa.json"),
      "utf8"
    )
  ) as { reviewQueue: Array<{ key: string }> };
  const strictPublishedKeys = new Set(
    countries.flatMap((country) =>
      country.writers
        .filter((writer) => Boolean(selectWriterBiography(writer, "ru")))
        .map((writer) => `${country.id}:${writer.id}`)
    )
  );
  const serviceCorrectionKeys = new Set(
    writerBiographyLegacyCorrections.map(
      (record) => `${record.countryId}:${record.writerId}`
    )
  );
  const identityRepairKeys = new Set(
    writerIdentityCorrections.flatMap((record) => [
      `${record.countryId}:${record.writerId}`,
      `${record.countryId}:${record.replacement.id}`,
    ])
  );
  const approvedNobelKeys = new Set(
    nobelLiteratureLaureateIdByWriterKey.keys()
  );

  return report.reviewQueue
    .map((record) => record.key)
    .sort()
    .filter(
      (key) =>
        !strictPublishedKeys.has(key) &&
        !serviceCorrectionKeys.has(key) &&
        !identityRepairKeys.has(key) &&
        !approvedNobelKeys.has(key)
    );
}

describe("writer biography claim review batch 02", () => {
  it("pins the frozen positions 21-40 boundary and the shared exclusions", () => {
    const records = writerBiographyFactReviewBatch02;
    const keys = records.map((record) => record.key);
    const eligibleKeys = new Set(eligibleReviewQueueKeys());

    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(keys.some((key) => batch01Keys.has(key))).toBe(false);
    expect(keys.every((key) => eligibleKeys.has(key))).toBe(true);
    expect([...keys].sort()).toEqual(keys);
    const sortedBatch01Keys = [...batch01Keys].sort();
    expect(keys[0] > sortedBatch01Keys[sortedBatch01Keys.length - 1]!).toBe(true);
  });

  it("pins every source text by SHA-256 and records evidence per claim", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|огромн)/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch02) {
      const originalText = sourceTextForKey(record.key);

      expect(record.originalSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.originalSha256).toBe(sha256(originalText));
      expect(Buffer.from(originalText, "utf8").toString("utf8")).toBe(
        originalText
      );
      expect(originalText).not.toContain("\uFFFD");
      expect(record.reviewedTextRu.trim().length).toBeGreaterThan(20);
      expect(record.reviewedTextRu).toMatch(/[А-Яа-яЁё]/);
      expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
      expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
      expect(record.reviewer).toBe(
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH02_REVIEWER
      );
      expect(["unchanged", "corrected", "held"]).toContain(record.decision);
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);

      if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(record.claims.every((claim) => claim.verdict === "supported")).toBe(
          true
        );
      }
      if (record.decision === "corrected") {
        expect(record.reviewedTextRu).not.toBe(originalText);
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(record.claims.some((claim) => claim.verdict === "corrected")).toBe(
          true
        );
      }
      if (record.decision === "held") {
        expect(record.applicableTextRu).toBeNull();
        expect(
          record.claims.some((claim) => claim.verdict === "not-established")
        ).toBe(true);
      }

      if (record.decision !== "held") {
        expect(record.applicableTextRu).toBe(record.reviewedTextRu);
        expect(record.claims.every((claim) => claim.evidence.length > 0)).toBe(
          true
        );
      }

      for (const claim of record.claims) {
        expect(claim.textRu.trim()).not.toBe("");
        expect(["supported", "corrected", "not-established"]).toContain(
          claim.verdict
        );
        expect(claim.evidence.length).toBeGreaterThan(0);
        for (const evidence of claim.evidence) {
          expect(evidence.provider.trim()).not.toBe("");
          expect(evidence.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(evidence.findingRu.trim()).not.toBe("");
          const parsedUrl = new URL(evidence.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
      const independentHosts = new Set(
        record.claims.flatMap((claim) =>
          claim.evidence.map((evidence) => new URL(evidence.url).hostname)
        )
      );
      expect(independentHosts.size, record.key).toBeGreaterThanOrEqual(2);
    }
  });

  it("pins the two authoritative date corrections and clears them from the discrepancy queue", () => {
    const factQa = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), "reports/writer-biography-fact-qa.json"),
        "utf8"
      )
    ) as {
      wikidataDateDiscrepancyQueue: Array<{
        key: string;
        field: string;
        cardValue: string;
      }>;
    };
    const expectedReplacements = new Map([
      ["argentina:mariana_enriquez", ["1973-12-08", "1973-12-06"]],
      ["argentina:samanta_schweblin", ["1978-04-19", "1978-03-08"]],
    ]);
    const batchKeySet = new Set(expectedKeys);
    const discrepancies = factQa.wikidataDateDiscrepancyQueue
      .filter((item) => batchKeySet.has(item.key as (typeof expectedKeys)[number]))
      .sort((left, right) => left.key.localeCompare(right.key));

    expect(discrepancies).toEqual([]);
    for (const [key, [oldValue, replacement]] of expectedReplacements) {
      const record = writerBiographyFactReviewBatch02.find(
        (item) => item.key === key
      );
      const dateClaim = record?.claims.find((claim) =>
        claim.textRu.includes("birthDate")
      );
      const [countryId, writerId] = key.split(":");
      const writer = countries
        .find((country) => country.id === countryId)
        ?.writers.find((item) => item.id === writerId);

      expect(writer?.birthDate).toBe(replacement);
      expect(record).toBeDefined();
      expect(record?.notes).toContain(
        `заменить birthDate ${oldValue} на ${replacement}`
      );
      expect(dateClaim?.verdict).toBe("corrected");
      expect(dateClaim?.textRu).toContain(oldValue);
      expect(dateClaim?.textRu).toContain(replacement);
      expect(dateClaim?.evidence.length).toBeGreaterThan(0);
    }
  });

  it("keeps the machine-readable and human-readable reports in sync", () => {
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
    const decisions = writerBiographyFactReviewBatch02.map(
      (record) => record.decision
    );

    expect(report.batch).toBe("02");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.records).toEqual(writerBiographyFactReviewBatch02);
    expect(report.summary).toEqual({
      records: 20,
      unchanged: decisions.filter((decision) => decision === "unchanged").length,
      corrected: decisions.filter((decision) => decision === "corrected").length,
      held: decisions.filter((decision) => decision === "held").length,
    });
    for (const key of expectedKeys) {
      expect(markdown).toContain(`\`${key}\``);
    }
  });
});
