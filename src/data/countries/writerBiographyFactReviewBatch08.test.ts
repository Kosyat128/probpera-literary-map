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
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH08_REVIEWER,
  writerBiographyFactReviewBatch08,
  type WriterBiographyFactReviewRecord,
} from "./writerBiographyFactReviewBatch08";
import {
  writerBiographyLegacyCorrections,
  writerIdentityCorrections,
} from "./writerBiographyLegacyCorrections";
import { nobelLiteratureLaureateIdByWriterKey } from "./nobelLiteratureRegistry";

const expectedKeys = [
  "cuba:guillermo_cabrera_infante",
  "cuba:jose_marti",
  "cuba:leonardo_padura",
  "cuba:reynaldo_arenas",
  "cyprus:kostas_montis",
  "cyprus:vasilis_michaelides",
  "czechia:bozena_nemcova",
  "czechia:jaroslav_seifert",
  "czechia:karel_capek",
  "czechia:karel_hynek_macha",
  "czechia:milan_kundera",
  "democratic_republic_of_congo:v_y_mudimbe",
  "denmark:adam_oehlenschlager",
  "denmark:klaus_rifbjerg",
  "denmark:ludvig_holberg",
  "djibouti:abdourahman_waberi",
  "dominica:jean_rhys",
  "dominica:phyllis_shand_allfrey",
  "dominican_republic:juan_bosch",
  "dominican_republic:manuel_del_cabral",
] as const;

const reportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch08.json"
);
const markdownReportPath = path.resolve(
  process.cwd(),
  "reports/writer-biography-fact-review-batch08.md"
);
const sourcePath = path.resolve(
  process.cwd(),
  "src/data/countries/writerBiographyFactReviewBatch08.ts"
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

describe("writer biography claim review batch 08", () => {
  it("pins the exact isolated keys and the explicit Nobel supplement", () => {
    const keys = writerBiographyFactReviewBatch08.map((record) => record.key);
    const eligibleKeys = eligibleReviewQueueKeys();
    const exceptions = keys.filter((key) => !eligibleKeys.has(key));
    const nobelOverlap = keys.filter((key) =>
      nobelLiteratureLaureateIdByWriterKey.has(key)
    );

    expect(keys).toEqual(expectedKeys);
    expect(new Set(keys).size).toBe(20);
    expect(exceptions).toEqual(["czechia:jaroslav_seifert"]);
    expect(nobelOverlap).toEqual(["czechia:jaroslav_seifert"]);
  });

  it("pins raw source hashes and validates every claim and decision", () => {
    const subjectiveSuperlative =
      /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|ведущ(?:ий|ая|ие|их))/iu;
    const publicReviewMarker =
      /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

    for (const record of writerBiographyFactReviewBatch08) {
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
        WRITER_BIOGRAPHY_FACT_REVIEW_BATCH08_REVIEWER
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
    const held = writerBiographyFactReviewBatch08.filter(
      (record) => record.decision === "held"
    );
    const applicable = writerBiographyFactReviewBatch08.filter(
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

  it("documents date and identity conclusions after proven corrections are applied", () => {
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
      records: Array<{
        key: string;
        manualResolutions: Array<{
          field: string;
          cardValue: string;
          decision: string;
          sources: Array<{ url: string }>;
        }>;
        wikidataEvidence: {
          identityValidationStatus?: string;
          manualIdentityConfirmation?: { qid: string } | null;
        };
      }>;
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
    expect(discrepancies).toEqual([]);
    expectNoProvenLiveFactRegression(factQa, batchKeySet);

    const mudimbeQa = factQa.records.find(
      (record) => record.key === "democratic_republic_of_congo:v_y_mudimbe"
    );
    expect(mudimbeQa?.wikidataEvidence).toMatchObject({
      identityValidationStatus: "identity-corroborated",
      manualIdentityConfirmation: { qid: "Q3056528" },
    });
    expect(mudimbeQa?.manualResolutions).toContainEqual(
      expect.objectContaining({
        field: "deathDate",
        cardValue: "2025-04-21",
        decision: "retain-authority-confirmed-card",
      })
    );
    expect(
      mudimbeQa?.manualResolutions
        .find((item) => item.field === "deathDate")
        ?.sources.map((source) => source.url)
    ).toEqual([
      "https://trinity.duke.edu/news/literature-professor-valentin-yves-mudimbe-passes-away",
      "https://www.cambridge.org/core/journals/africa/article/life-and-work-of-vy-mudimbe-8-december-194121-april-2025/E7E89FC89E5B6CDAF870EA8B54A0D5E0",
    ]);

    const note = (key: string) =>
      writerBiographyFactReviewBatch08.find((record) => record.key === key)
        ?.notes ?? "";
    expect(note("cyprus:vasilis_michaelides")).toContain("1917-12-18");
    expect(note("dominica:phyllis_shand_allfrey")).toContain("1986");
    expect(note("dominica:phyllis_shand_allfrey")).toContain(
      "точный день институционально не установлен"
    );
    expect(note("democratic_republic_of_congo:v_y_mudimbe")).toContain(
      "2025-04-21"
    );
    expect(note("djibouti:abdourahman_waberi")).toContain(
      "Абдурахман Али Вабери"
    );
    expect(note("dominican_republic:juan_bosch")).toContain(
      "одна личность"
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

    expect(report.batch).toBe("08");
    expect(report.generatedAt).toBe("2026-08-09");
    expect(report.records).toEqual(writerBiographyFactReviewBatch08);
    expect(report.summary).toEqual({
      records: 20,
      unchanged: 1,
      corrected: 19,
      held: 0,
    });
    for (const key of expectedKeys) {
      expect(markdown).toContain(`\`${key}\``);
    }
  });
});
