import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { legacyWriterBiography } from "../writerBiography";
import {
  countries as publicCountries,
  writerBiographyFactReviewSourceCountries as countries,
} from "./index";
import type { WriterProfile } from "./types";
import { quarantinedWriterIdentities } from "./writerBiographyLegacyCorrections";

type ReviewDecision = "unchanged" | "corrected" | "held";

type ReviewRecord = {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly applicableTextRu: string | null;
  readonly claims: readonly {
    readonly verdict: "supported" | "corrected" | "not-established";
    readonly evidence: readonly {
      readonly provider: string;
      readonly url: string;
      readonly checkedAt: string;
      readonly findingRu: string;
    }[];
  }[];
  readonly reviewer: string;
  readonly decision: ReviewDecision;
  readonly notes: string;
};

type ProfileCorrection = {
  readonly countryId: string;
  readonly writerId: string;
  readonly patch: Partial<WriterProfile>;
  readonly evidence: readonly {
    readonly provider: string;
    readonly url: string;
    readonly checkedAt: string;
  }[];
  readonly note: string;
};

type BatchTestOptions = {
  readonly batch: number;
  readonly generatedAt: string;
  readonly reviewer: string;
  readonly records: readonly ReviewRecord[];
  readonly profileCorrections: readonly ProfileCorrection[];
};

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

function publicWriter(key: string) {
  const [countryId, writerId] = key.split(":");
  return publicCountries
    .find((country) => country.id === countryId)
    ?.writers.find((writer) => writer.id === writerId);
}

function sha256(text: string): string {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

function priorReportKeys(batch: number): string[] {
  const keys: string[] = [];
  for (let current = 1; current < batch; current += 1) {
    const suffix = String(current).padStart(2, "0");
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

export function defineWriterBiographyFactReviewBatchTests({
  batch,
  generatedAt,
  reviewer,
  records,
  profileCorrections,
}: BatchTestOptions): void {
  const suffix = String(batch).padStart(2, "0");
  const factQaPath = path.resolve(
    process.cwd(),
    "reports/writer-biography-fact-qa.json"
  );
  const reportPath = path.resolve(
    process.cwd(),
    `reports/writer-biography-fact-review-batch${suffix}.json`
  );
  const markdownReportPath = path.resolve(
    process.cwd(),
    `reports/writer-biography-fact-review-batch${suffix}.md`
  );

  describe(`writer biography claim review batch ${suffix}`, () => {
    it("pins the immutable historical batch without overlap", () => {
      const factQa = JSON.parse(fs.readFileSync(factQaPath, "utf8")) as {
        reviewQueue: Array<{ key: string }>;
      };
      const priorAssigned = priorReportKeys(batch);
      const priorAssignedSet = new Set(priorAssigned);
      const quarantineKeys = quarantinedWriterIdentities.map(
        (item) => `${item.countryId}:${item.writerId}`
      );
      const reviewQueueKeys = factQa.reviewQueue.map((item) => item.key);
      const reviewQueueSet = new Set(reviewQueueKeys);
      const keys = records.map((record) => record.key);
      const heldKeys = records
        .filter((record) => record.decision === "held")
        .map((record) => record.key);
      const applicableKeys = records
        .filter((record) => record.decision !== "held")
        .map((record) => record.key);
      expect(records).toHaveLength(batch === 57 ? 20 : 40);
      expect(priorAssignedSet.size).toBe(priorAssigned.length);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.some((key) => priorAssignedSet.has(key))).toBe(false);
      expect(applicableKeys.every((key) => reviewQueueSet.has(key))).toBe(true);
      expect(applicableKeys.some((key) => quarantineKeys.includes(key))).toBe(false);
      expect(heldKeys.every((key) => quarantineKeys.includes(key))).toBe(true);
      expect([...keys].sort((left, right) => left.localeCompare(right, "en"))).toEqual(
        keys
      );
    });

    it("pins hashes, restrained Russian copy and independent evidence", () => {
      const subjectiveSuperlative =
        /(?:крупнейш|величайш|сам(?:ый|ая|ое|ые|ых)|наиболее|великий|ведущ|важнейш|главнейш|известнейш|одн(?:а|о|им|их)?\s+из\s+(?:главн|ведущ|важнейш|заметн))/iu;
      const publicReviewMarker =
        /(?:^|[\s:-])(?:проверено|непроверено|verified|unverified)(?:$|[\s.!,:;-])/iu;

      for (const record of records) {
        const originalText = sourceTextForKey(record.key);
        const sentenceCount =
          record.reviewedTextRu.match(/[.!?…]+(?=\s+[А-ЯЁ]|$)/gu)?.length ?? 0;
        expect(record.originalSha256).toBe(sha256(originalText));
        expect(record.reviewedTextRu.trim().length).toBeGreaterThan(35);
        expect(sentenceCount, record.key).toBeGreaterThanOrEqual(1);
        expect(sentenceCount, record.key).toBeLessThanOrEqual(2);
        expect(record.reviewedTextRu).not.toMatch(subjectiveSuperlative);
        expect(record.reviewedTextRu).not.toMatch(publicReviewMarker);
        expect(record.reviewer).toBe(reviewer);
        expect(record.notes.trim()).not.toBe("");
        expect(record.claims).toHaveLength(1);

        if (record.decision === "held") {
          expect(record.applicableTextRu).toBeNull();
          expect(record.claims[0]?.verdict).toBe("not-established");
        } else if (record.decision === "unchanged") {
          expect(record.reviewedTextRu).toBe(originalText);
          expect(record.applicableTextRu).toBe(originalText);
          expect(record.claims[0]?.verdict).toBe("supported");
        } else {
          expect(record.reviewedTextRu).not.toBe(originalText);
          expect(record.applicableTextRu).toBe(record.reviewedTextRu);
          expect(record.claims[0]?.verdict).toBe("corrected");
        }

        const evidence = record.claims[0]!.evidence;
        const hostnames = new Set(evidence.map((item) => new URL(item.url).hostname));
        expect(evidence.length, record.key).toBeGreaterThanOrEqual(2);
        expect(hostnames.size, record.key).toBeGreaterThanOrEqual(2);
        for (const item of evidence) {
          expect(item.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
          expect(item.checkedAt <= generatedAt, record.key).toBe(true);
          expect(item.findingRu).toMatch(/[А-Яа-яЁё]/);
          const parsedUrl = new URL(item.url);
          expect(parsedUrl.protocol).toBe("https:");
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikidata\.org$/);
          expect(parsedUrl.hostname).not.toMatch(/(^|\.)wikipedia\.org$/);
        }
      }
    });

    it("publishes only proven profile patches and keeps held records fail-closed", () => {
      const runtimeIndex = fs.readFileSync(
        path.resolve(process.cwd(), "src/data/countries/index.ts"),
        "utf8"
      );
      const runtimeReviewAggregator = fs.readFileSync(
        path.resolve(process.cwd(), "src/data/countries/writerBiographyFactReviews.ts"),
        "utf8"
      );
      const buildSource = fs.readFileSync(
        path.resolve(process.cwd(), "scripts/writer-biography-review-source.ts"),
        "utf8"
      );
      const patchKeys = profileCorrections.map(
        (item) => `${item.countryId}:${item.writerId}`
      );

      expect(new Set(patchKeys).size).toBe(patchKeys.length);
      for (const item of profileCorrections) {
        const itemKey = `${item.countryId}:${item.writerId}`;
        const hostnames = new Set(
          item.evidence.map((evidence) => new URL(evidence.url).hostname)
        );
        expect(item.evidence.length, itemKey).toBeGreaterThanOrEqual(2);
        expect(hostnames.size, itemKey).toBeGreaterThanOrEqual(2);
        expect(item.note.trim()).not.toBe("");
        expect(publicWriter(itemKey), itemKey).toMatchObject(item.patch);
      }
      for (const record of records) {
        expect(Boolean(publicWriter(record.key)), record.key).toBe(
          record.decision !== "held"
        );
      }
      expect(runtimeIndex).not.toContain(`writerBiographyFactReviewBatch${suffix}`);
      expect(runtimeReviewAggregator).not.toContain(
        `writerBiographyFactReviewBatch${suffix}`
      );
      expect(buildSource).toContain(`writerBiographyFactReviewBatch${suffix}`);
    });

    it("keeps UTF-8 and JSON/Markdown reports synchronized", () => {
      const sourcePaths = [
        path.resolve(
          process.cwd(),
          `src/data/countries/writerBiographyFactReviewBatch${suffix}.ts`
        ),
        path.resolve(
          process.cwd(),
          `src/data/countries/writerBiographyFactReviewBatch${suffix}.test.ts`
        ),
        path.resolve(
          process.cwd(),
          `src/data/countries/writerBiographyPublicProfileFactCorrectionsBatch${suffix}.ts`
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
        selectionSnapshot: Record<string, number>;
        summary: Record<string, number>;
        records: ReviewRecord[];
      };
      const priorAssigned = priorReportKeys(batch).length;
      const unchanged = records.filter(
        (record) => record.decision === "unchanged"
      ).length;
      const corrected = records.filter(
        (record) => record.decision === "corrected"
      ).length;
      const held = records.filter((record) => record.decision === "held").length;

      expect(report.batch).toBe(suffix);
      expect(report.generatedAt).toBe(generatedAt);
      expect(report.selectionSnapshot).toMatchObject({
        reviewQueue: 1678,
        priorAssignedRecords: priorAssigned,
        priorAssignedUnique: priorAssigned,
        boundary: records.length,
        boundaryUnique: records.length,
        overlapPriorAssigned: 0,
        overlapQuarantine: 0,
      });
      expect(report.summary).toEqual({
        records: records.length,
        unchanged,
        corrected,
        held,
      });
      expect(report.records).toEqual(records);
    });
  });
}
