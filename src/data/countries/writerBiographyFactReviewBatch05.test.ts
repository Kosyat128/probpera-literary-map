import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { describe, expect, it } from "vitest";
import { expectNoProvenLiveFactRegression } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  legacyWriterBiography,
  selectWriterBiography,
} from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH05_REVIEWER,
  writerBiographyFactReviewBatch05,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch05";
import {
  writerBiographyLegacyCorrections,
  writerIdentityCorrections,
} from "./writerBiographyLegacyCorrections";
import { nobelLiteratureLaureateIdByWriterKey } from "./nobelLiteratureRegistry";

const expectedKeys = [
  "bhutan:drukpa_kunley",
  "bhutan:ngawang_namgyal",
  "bolivia:adela_zamudio",
  "bolivia:alcides_arguedas",
  "bolivia:augusto_cespedes",
  "bolivia:edmundo_paz_soldan",
  "bolivia:francisco_javier_del_granado",
  "bolivia:gabriel_rene_moreno",
  "bolivia:jaime_saenz",
  "bosnia:abdulah_sidran",
  "bosnia:alexa_santic",
  "bosnia:branko_copic",
  "botswana:bessie_head",
  "brazil:clarice_lispector",
  "brazil:goncalves_dias",
  "brazil:graciliano_ramos",
  "brazil:joao_guimaraes_rosa",
  "brazil:jorge_amado",
  "brazil:jose_de_alencar",
  "brazil:machado_de_assis",
] as const;

const supplementalEvidenceUrls = new Set([
  "https://mujer.sea.gob.bo/src/personajeResultado.php?variable=34",
  "https://catalogue.bnf.fr/ark:/12148/cb12165329m",
  "https://cienciaycultura.ucb.edu.bo/a/article/view/1391",
  "https://www.treccani.it/enciclopedia/paz-soldan-avila-jose-edmundo/",
  "https://biblio.fcet.uagrm.edu.bo/uPublicaciones/1.Tecnobiblio/Folletos/Anterior/Biografia%20de%20Gabriel%20Rene%20Moreno/assets/downloads/page0004.pdf",
  "https://fmks.gov.ba/en/in-memoriam-abdulah-sidran-a-writer-poet-and-screenwriter-passed-away/",
  "https://teatroslov.mpus.org.rs/licnost.php?id=6263&jezik=lat",
  "https://www.enciklopedija.hr/clanak/copic-branko",
]);

const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch05.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch05.md"
);
const sourcePath = path.resolve(
  process.cwd(),
  "src/data/countries/writerBiographyFactReviewBatch05.ts"
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

function eligibleReviewQueueKeys(): Set<string> {
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

  return new Set(
    report.reviewQueue
      .map((record) => record.key)
      .filter(
        (key) =>
          !strictPublishedKeys.has(key) &&
          !serviceCorrectionKeys.has(key) &&
          !identityRepairKeys.has(key) &&
          !approvedNobelKeys.has(key)
      )
  );
}

describe("writer biography claim review batch 05", () => {
  it("pins the exact isolated batch keys and the shared exclusions", () => {
    const keys = writerBiographyFactReviewBatch05.map((record) => record.key);
    const eligibleKeys = eligibleReviewQueueKeys();

    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect([...keys].sort()).toEqual(keys);
    expect(keys.every((key) => eligibleKeys.has(key))).toBe(true);
  });

  it("pins every legacy source text by raw UTF-8 SHA-256 and validates review semantics", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|ведущ(?:ий|ая|ие|их))/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch05) {
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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH05_REVIEWER
      );
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
          expect(evidence.checkedAt).toBe(
            supplementalEvidenceUrls.has(evidence.url)
              ? "2026-08-31"
              : "2026-08-09"
          );
          expect(evidence.findingRu.trim()).not.toBe("");
          const parsedUrl = new URL(evidence.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    }
  });

  it("keeps held text non-applicable and gives every non-held claim evidence", () => {
    const held = writerBiographyFactReviewBatch05.filter(
      (record) => record.decision === "held"
    );
    const applicable = writerBiographyFactReviewBatch05.filter(
      (record) => record.decision !== "held"
    );

    expect(held.every((record) => record.applicableTextRu === null)).toBe(true);
    expect(
      applicable.every(
        (record) =>
          record.applicableTextRu === record.reviewedTextRu &&
          record.claims.every((claim) => claim.evidence.length > 0)
      )
    ).toBe(true);
  });

  it("documents the two retained discrepancies and the applied death-date correction", () => {
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
        bestRankClaims: Array<{ value: string }>;
      }>;
      wikidataIdentityReviewQueue: Array<{ key: string }>;
      badQidIdentityQueue: Array<{ key: string }>;
    };
    const batchKeySet = new Set<string>(expectedKeys);
    const discrepancies = factQa.wikidataDateDiscrepancyQueue
      .filter((item) => batchKeySet.has(item.key))
      .map((item) => ({
        key: item.key,
        field: item.field,
        cardValue: item.cardValue,
        candidate: item.bestRankClaims[0]?.value,
      }));
    expect(discrepancies).toEqual([
      {
        key: "bolivia:augusto_cespedes",
        field: "deathDate",
        cardValue: "1997-05-11",
        candidate: "1997-05-09",
      },
      {
        key: "bolivia:jaime_saenz",
        field: "birthDate",
        cardValue: "1921-10-08",
        candidate: "1921-10-29",
      },
    ]);
    expectNoProvenLiveFactRegression(factQa, batchKeySet);

    const cespedes = writerBiographyFactReviewBatch05.find(
      (record) => record.key === "bolivia:augusto_cespedes"
    );
    const saenz = writerBiographyFactReviewBatch05.find(
      (record) => record.key === "bolivia:jaime_saenz"
    );
    expect(cespedes?.notes).toContain("оставить deathDate 1997-05-11");
    expect(saenz?.notes).toContain("оставить birthDate 1921-10-08");
    expect(saenz?.notes).toContain(
      "заменить deathDate 1986-08-29 на 1986-08-16"
    );
  });

  it("keeps the source and both reports valid strict UTF-8", () => {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    for (const filePath of [sourcePath, reportPath, markdownReportPath]) {
      const raw = fs.readFileSync(filePath);
      const decoded = decoder.decode(raw);
      expect(decoded).not.toContain("\uFFFD");
      expect(Buffer.from(decoded, "utf8")).toEqual(raw);
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
    const decisions = writerBiographyFactReviewBatch05.map(
      (record) => record.decision
    );

    expect(report.batch).toBe("05");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.records).toEqual(writerBiographyFactReviewBatch05);
    expect(report.summary).toEqual({
      records: 20,
      unchanged: decisions.filter((decision) => decision === "unchanged").length,
      corrected: decisions.filter((decision) => decision === "corrected").length,
      held: decisions.filter((decision) => decision === "held").length,
    });
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 0,
      corrected: 20,
      held: 0,
    });
    for (const key of expectedKeys) {
      expect(markdown).toContain(`\`${key}\``);
    }
  });
});
