import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { describe, expect, it } from "vitest";
import {
  legacyWriterBiography,
  selectWriterBiography,
} from "../writerBiography";
import { writerBiographyFactReviewSourceCountries as countries } from "./index";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH11_REVIEWER,
  writerBiographyFactReviewBatch11,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch11";
import {
  writerBiographyLegacyCorrections,
  writerIdentityCorrections,
} from "./writerBiographyLegacyCorrections";
import { nobelLiteratureLaureateIdByWriterKey } from "./nobelLiteratureRegistry";

const expectedKeys = [
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

const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch11.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch11.md"
);
const sourcePath = path.resolve(
  process.cwd(),
  "src/data/countries/writerBiographyFactReviewBatch11.ts"
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

describe("writer biography claim review batch 11", () => {
  it("pins the exact lexicographic gap-fill and explicit exceptions", () => {
    const keys = writerBiographyFactReviewBatch11.map((record) => record.key);
    const eligibleKeys = eligibleReviewQueueKeys();
    const exceptions = keys.filter((key) => !eligibleKeys.has(key));
    const nobelOverlap = keys.filter((key) =>
      nobelLiteratureLaureateIdByWriterKey.has(key)
    );

    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(exceptions).toEqual([
      "australia:terry_hayes",
      "austria:elias_canetti",
    ]);
    expect(nobelOverlap).toEqual(["austria:elias_canetti"]);
  });

  it("pins raw source hashes and validates every claim and decision", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|ведущ(?:ий|ая|ие|их))/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch11) {
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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH11_REVIEWER
      );
      expect(record.notes.trim()).not.toBe("");
      expect(record.claims.length).toBeGreaterThan(0);

      if (record.decision === "unchanged") {
        expect(record.reviewedTextRu).toBe(originalText);
        expect(record.claims.every((claim) => claim.verdict === "supported")).toBe(
          true
        );
      } else if (record.decision === "corrected") {
        expect(record.reviewedTextRu).not.toBe(originalText);
        expect(record.claims.some((claim) => claim.verdict === "corrected")).toBe(
          true
        );
      } else {
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

      const hostnames = new Set<string>();
      for (const claim of record.claims) {
        expect(claim.textRu.trim()).not.toBe("");
        expect(["supported", "corrected", "not-established"]).toContain(
          claim.verdict
        );
        expect(claim.evidence.length).toBeGreaterThan(0);
        for (const item of claim.evidence) {
          expect(item.provider.trim()).not.toBe("");
          expect(item.checkedAt).toBe("2026-08-09");
          expect(item.findingRu.trim()).not.toBe("");
          const parsedUrl = new URL(item.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
          hostnames.add(parsedUrl.hostname);
        }
      }
      expect(hostnames.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps held text non-applicable and gives every non-held claim evidence", () => {
    const held = writerBiographyFactReviewBatch11.filter(
      (record) => record.decision === "held"
    );
    const applicable = writerBiographyFactReviewBatch11.filter(
      (record) => record.decision !== "held"
    );

    expect(held).toEqual([]);
    expect(held.every((record) => record.applicableTextRu === null)).toBe(true);
    expect(
      applicable.every(
        (record) =>
          record.applicableTextRu === record.reviewedTextRu &&
          record.claims.every((claim) => claim.evidence.length > 0)
      )
    ).toBe(true);
  });

  it("documents the exact date and identity conclusions after shared corrections", () => {
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
    const identityMatches = [
      ...factQa.wikidataIdentityReviewQueue,
      ...factQa.badQidIdentityQueue,
    ]
      .filter((item) => batchKeySet.has(item.key))
      .map((item) => item.key);

    expect(discrepancies).toEqual([]);
    expect(identityMatches).toEqual(["australia:terry_hayes"]);

    const note = (key: string) =>
      writerBiographyFactReviewBatch11.find((record) => record.key === key)
        ?.notes ?? "";
    expect(note("australia:ruth_park")).toContain("1917-08-24");
    expect(note("australia:terry_hayes")).toContain("одну личность");
    expect(note("australia:terry_hayes")).toContain(
      "точная birthDate институционально не установлена"
    );
    expect(note("australia:markus_zusak")).toContain("Маркус Зусак");
    expect(note("austria:elias_canetti")).toContain(
      "Пересечение с Нобелевским реестром намеренное"
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

    expect(report.batch).toBe("11");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.records).toEqual(writerBiographyFactReviewBatch11);
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 5,
      corrected: 15,
      held: 0,
    });
    for (const key of expectedKeys) {
      expect(markdown).toContain(`\`${key}\``);
    }
  });
});
