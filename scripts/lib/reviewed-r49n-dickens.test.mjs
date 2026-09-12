import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectReviewedR49nPackage } from "./reviewed-r49n-package.mjs";
import {
  isReviewedR49nDickensAddition,
  projectReviewedR49nDickens,
  r49nDickensAttestation,
  reviewedR49nDickensSourceSha256,
} from "./reviewed-r49n-dickens.mjs";

const sha = (source) => createHash("sha256").update(source).digest("hex");
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const read = (file) => projectReviewedR49nPackage(
  file, readFileSync(file, "utf8").replace(/\r\n?/gu, "\n")
);

describe("September 12 independently reviewed Dickens publication scope", () => {
  it("pins this new review independently of historical UI/catalog attestations", () => {
    expect(sha(JSON.stringify(r49nDickensAttestation))).toBe("2fd2b7dbbb6fe34040aba24e6dfef4a8498d6a01f4ae753698715abe72c408f6");
    expect(r49nDickensAttestation).toMatchObject({
      id: "BOOK-R49N-DICKENS-EDITORIAL-20260912",
      authorizedOn: "2026-09-12",
      humanReview: false,
      inputArchiveSha256: "977f25072022cb7275242b030836326f8f30c97423697b60081859d8ce17fb69",
      inputMasterSha256: "f441344f6b4367684c8f5ec39f746f12c079ff05e5130b3183e06bab7c359674",
    });
    expect(r49nDickensAttestation.allowedProjectionPaths).toEqual(["src/data/bookArchive.ts"]);
    expect(r49nDickensAttestation.additions.map((entry) => entry.path)).toEqual([
      "src/data/countries/bookR49nDickensReviewed20260912.ts",
    ]);
    expect(r49nDickensAttestation.runtime.newReadyKeys).toHaveLength(10);
  });

  it("restores the original archive source and rejects missing, duplicate, changed or unrelated fragments", () => {
    const file = "src/data/bookArchive.ts";
    const source = read(file);
    const original = projectReviewedR49nDickens(file, source);
    expect(reviewedR49nDickensSourceSha256(original)).toBe(r49nDickensAttestation.sourceBaselines[file]);
    const unrelated = "\n/* Unreviewed archive change remains protected. */\n";
    expect(projectReviewedR49nDickens(file, source + unrelated)).toBe(original + unrelated);
    expect(reviewedR49nDickensSourceSha256(original + unrelated)).not.toBe(r49nDickensAttestation.sourceBaselines[file]);
    for (const delta of r49nDickensAttestation.projections) {
      expect(source.split(delta.after)).toHaveLength(2);
      for (const changed of [source.replace(delta.after, ""), source + delta.after, source.replace(delta.after, delta.after.replace(/\S/u, "?"))]) {
        expect(() => projectReviewedR49nDickens(file, changed)).toThrow("Missing or duplicate reviewed R49N Dickens delta");
      }
    }
  });

  it("excludes only the exact reviewed overlay; changes and extra files remain in historical digests", () => {
    const addition = r49nDickensAttestation.additions[0];
    const source = read(addition.path);
    expect(isReviewedR49nDickensAddition(addition.path, source)).toBe(true);
    expect(isReviewedR49nDickensAddition(addition.path, source.replaceAll("\n", "\r\n"))).toBe(true);
    for (const changed of [source + "\n", source.replace('"firstPublished": 1860', '"firstPublished": 1861'), ""]) {
      expect(isReviewedR49nDickensAddition(addition.path, changed)).toBe(false);
    }
    for (const path of [addition.path.replace("20260912", "20260913"), "src/data/countries/extra.ts", "data/book-canon-source-registry.json", "src/data/bookEvidence.ts"]) {
      expect(isReviewedR49nDickensAddition(path, source)).toBe(false);
      expect(projectReviewedR49nDickens(path, "protected source\n")).toBe("protected source\n");
    }
  });

  it("binds the actual twenty selected texts, their master hashes and independent source review", () => {
    const report = JSON.parse(read(r49nDickensAttestation.editorialReview.path));
    const evidence = report.records.map((record) => ({
      recordKey: record.recordKey,
      masterRecordSha256: record.masterRecordSha256,
      recommendedTexts: record.recommendedTexts,
      sourceReadings: record.sourceReadings,
      preservedOriginalDescriptionProvenance: record.preservedOriginalDescriptionProvenance,
      firstPublicationReview: record.firstPublicationReview,
      application: record.application,
    }));
    expect(sha(JSON.stringify(canonical(evidence)))).toBe(r49nDickensAttestation.editorialReview.canonicalJsonSha256);
    expect(report.records.map((record) => record.recordKey).sort()).toEqual(r49nDickensAttestation.runtime.newReadyKeys);
    for (const record of report.records) {
      for (const locale of ["ru", "en"]) {
        expect(sha(record.recommendedTexts[locale].text)).toBe(record.recommendedTexts[locale].textSha256);
      }
      expect(record.application.humanReview).toBe(false);
    }
  });
});
