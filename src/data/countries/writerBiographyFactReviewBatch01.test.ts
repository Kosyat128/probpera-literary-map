import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expectNoProvenLiveFactRegression } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  legacyWriterBiography,
  selectWriterBiography,
} from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import { nobelLiteratureLaureateIdByWriterKey } from "./nobelLiteratureRegistry";
import {
  writerBiographyLegacyCorrections,
  writerIdentityCorrections,
} from "./writerBiographyLegacyCorrections";
import {
  writerBiographyFactReviewBatch01,
  writerBiographyFactReviewBatch01Normalized,
} from "./writerBiographyFactReviewBatch01";

type FactQaQueueRow = {
  key: string;
  claimsRequiringHumanSources: string[];
};

type FactQaReport = {
  reviewQueue: FactQaQueueRow[];
  wikidataDateDiscrepancyQueue: Array<{ key: string }>;
  wikidataIdentityReviewQueue: Array<{ key: string }>;
};

const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-qa.json"
);
const reviewReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch01.json"
);
const reviewMarkdownPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch01.md"
);

const expectedKeys = [
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
] as const;

function currentWriter(key: string) {
  const [countryId, writerId] = key.split(":");
  return countries
    .find((country) => country.id === countryId)
    ?.writers.find((writer) => writer.id === writerId);
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sharedExclusionSets() {
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

  return {
    strictPublishedKeys,
    serviceCorrectionKeys,
    identityRepairKeys,
    approvedNobelKeys,
  };
}

describe("writer biography claim review batch 01", () => {
  it("pins the frozen first-batch boundary and satisfies the shared exclusions", () => {
    const report = JSON.parse(
      fs.readFileSync(reportPath, "utf8")
    ) as FactQaReport;
    const selectedKeys = writerBiographyFactReviewBatch01.map(
      (record) => record.key
    );
    const queueKeys = new Set(report.reviewQueue.map((record) => record.key));
    const exclusions = sharedExclusionSets();

    expect(selectedKeys).toHaveLength(20);
    expect(new Set(selectedKeys).size).toBe(20);
    expect(selectedKeys).toEqual(expectedKeys);
    for (const key of selectedKeys) {
      expect(queueKeys.has(key), key).toBe(true);
      expect(exclusions.strictPublishedKeys.has(key), key).toBe(false);
      expect(exclusions.serviceCorrectionKeys.has(key), key).toBe(false);
      expect(exclusions.identityRepairKeys.has(key), key).toBe(false);
      expect(exclusions.approvedNobelKeys.has(key), key).toBe(false);
    }
  });

  it("pins every original Russian biography by exact text and SHA-256", () => {
    for (const record of writerBiographyFactReviewBatch01) {
      const writer = currentWriter(record.key);
      expect(writer, record.key).toBeDefined();
      const original = legacyWriterBiography(writer!);
      expect(original, record.key).toBe(record.originalTextRu);
      expect(sha256(original), record.key).toBe(record.originalSha256);
    }
  });

  it("keeps the historical batch free of proven live fact regressions", () => {
    const report = JSON.parse(
      fs.readFileSync(reportPath, "utf8")
    ) as FactQaReport;
    const batchKeys = new Set(expectedKeys);

    expectNoProvenLiveFactRegression(report, batchKeys);
  });

  it("covers every field that the final fact QA queue sends to human review", () => {
    const report = JSON.parse(
      fs.readFileSync(reportPath, "utf8")
    ) as FactQaReport;
    const queueByKey = new Map(
      report.reviewQueue.map((record) => [record.key, record])
    );

    for (const record of writerBiographyFactReviewBatch01) {
      const required = queueByKey.get(record.key)?.claimsRequiringHumanSources;
      expect(required, record.key).toBeDefined();
      const covered = new Set(record.claimEvidence.map((item) => item.field));
      for (const field of required || []) {
        const equivalentFields =
          field === "priority-claim"
            ? ["priority-claim", "critical-ranking"]
            : field === "critical-ranking"
              ? ["critical-ranking", "priority-claim"]
              : field === "works"
                ? ["works", "awards"]
              : [field];
        expect(
          equivalentFields.some((candidate) => covered.has(candidate as never)),
          `${record.key}:${field}`
        ).toBe(true);
      }
    }
  });

  it("stores authoritative evidence and no Wikipedia-family source", () => {
    const disallowed = /(?:wikipedia\.org|wikidata\.org)/i;

    for (const record of writerBiographyFactReviewBatch01) {
      expect(record.reviewer.length, record.key).toBeGreaterThan(0);
      expect(record.claimEvidence.length, record.key).toBeGreaterThan(0);
      for (const item of record.claimEvidence) {
        expect(item.claimRu.length, `${record.key}:${item.field}`).toBeGreaterThan(
          0
        );
        expect(item.sources.length, `${record.key}:${item.field}`).toBeGreaterThan(
          0
        );
        for (const evidence of item.sources) {
          expect(evidence.url, `${record.key}:${item.field}`).toMatch(/^https:\/\//);
          expect(evidence.url, `${record.key}:${item.field}`).not.toMatch(
            disallowed
          );
          expect(evidence.provider.length).toBeGreaterThan(0);
          expect(evidence.sourceFamily.length).toBeGreaterThan(0);
          expect(["2026-08-09", "2026-08-31"]).toContain(
            evidence.checkedAt
          );
        }
      }
      const independentHosts = new Set(
        record.claimEvidence.flatMap((item) =>
          item.sources.map((evidence) => new URL(evidence.url).hostname)
        )
      );
      expect(independentHosts.size, record.key).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps public prose marker-free and records the exact decisions", () => {
    const decisionCounts = writerBiographyFactReviewBatch01.reduce(
      (counts, record) => {
        counts[record.decision] += 1;
        return counts;
      },
      { unchanged: 0, corrected: 0, held: 0 }
    );
    const forbiddenMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    expect(decisionCounts).toEqual({ unchanged: 2, corrected: 18, held: 0 });
    for (const record of writerBiographyFactReviewBatch01) {
      expect(record.reviewedTextRu, record.key).toMatch(/[А-Яа-яЁё]/u);
      expect(record.reviewedTextRu, record.key).not.toMatch(forbiddenMarker);
      expect(record.reviewedTextRu, record.key).not.toMatch(
        /(?:величайш|крупнейш|сам(?:ый|ая|ое|ые)|од(?:ин|на) из (?:главн|наиболее известн)|ключев(?:ая|ой|ые) фигур)/iu
      );
      expect(record.reviewedTextRu.trim(), record.key).toBe(record.reviewedTextRu);

      if (record.decision === "unchanged") {
        expect(record.reviewedTextRu, record.key).toBe(record.originalTextRu);
        expect(record.claimEvidence.every((item) => item.finding === "confirmed"))
          .toBe(true);
      }
      if (record.decision === "corrected") {
        expect(record.reviewedTextRu, record.key).not.toBe(record.originalTextRu);
        expect(record.claimEvidence.some((item) => item.finding === "corrected"))
          .toBe(true);
      }
    }
  });

  it("exports the normalized batch-agnostic adapter without runtime wiring", () => {
    expect(writerBiographyFactReviewBatch01Normalized).toHaveLength(20);
    expect(writerBiographyFactReviewBatch01Normalized.map((record) => record.key))
      .toEqual(expectedKeys);

    for (const [index, record] of writerBiographyFactReviewBatch01Normalized.entries()) {
      const detailed = writerBiographyFactReviewBatch01[index];
      expect(record.originalSha256).toBe(detailed.originalSha256);
      expect(record.reviewedTextRu).toBe(detailed.reviewedTextRu);
      expect(record.claims).toHaveLength(detailed.claimEvidence.length);
      expect(record.notes.trim().length).toBeGreaterThan(0);
      for (const item of record.claims) {
        expect(["supported", "corrected", "not-established"]).toContain(
          item.verdict
        );
        for (const evidence of item.evidence) {
          expect(evidence.findingRu.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps the JSON and Markdown reports aligned with the isolated TS data", () => {
    const jsonReport = JSON.parse(fs.readFileSync(reviewReportPath, "utf8")) as {
      summary: {
        total: number;
        unchanged: number;
        corrected: number;
        held: number;
      };
      records: unknown[];
    };

    expect(jsonReport.summary).toEqual({
      total: 20,
      unchanged: 2,
      corrected: 18,
      held: 0,
    });
    expect(jsonReport.records).toEqual(writerBiographyFactReviewBatch01);
    expect(fs.readFileSync(reviewMarkdownPath, "utf8")).toContain(
      "# Проверка биографий писателей - партия 01"
    );
  });
});
