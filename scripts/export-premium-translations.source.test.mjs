import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { normalizeCountryCapitalEditorialReview } from "../src/data/countryCapitalReview.mjs";

const source = readFileSync(
  path.resolve(process.cwd(), "scripts/export-premium-translations.mjs"),
  "utf8"
).replace(/\r\n?/gu, "\n");

// Evaluate only the actual pure country normalizer and its local helpers;
// importing the exporter itself would run its environment/network lifecycle.
function countryNormalizer() {
  const parsed = ts.createSourceFile("export-premium-translations.mjs", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const functions = new Set(["objectValue", "stringValue", "optionalString", "safeStringList", "safeTimeline", "normalizeCountryTranslation"]);
  const constants = new Set(["countryTranslationStatuses", "countryTranslationMethods", "cyrillicPattern"]);
  const selected = [];
  for (const statement of parsed.statements) {
    if (ts.isFunctionDeclaration(statement) && functions.has(statement.name?.text)) {
      selected.push(statement.getText(parsed)); functions.delete(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      const names = statement.declarationList.declarations.map(declaration => declaration.name.getText(parsed));
      if (names.length === 1 && constants.has(names[0])) { selected.push(statement.getText(parsed)); constants.delete(names[0]); }
    }
  }
  if (functions.size || constants.size) throw new Error("Country normalizer source dependencies changed");
  return new Function("normalizeCountryCapitalEditorialReview", selected.join("\n") + "\nreturn normalizeCountryTranslation;")(normalizeCountryCapitalEditorialReview);
}

describe("premium translation public export", () => {
  it("transports the exact supplied capital review with the shared runtime parser and no generated acceptance", () => {
    const normalize = countryNormalizer();
    const review = { schemaVersion: 1, hashContract: "country-capital-review-v1", decision: "approved", reviewerType: "human",
      reviewer: "Synthetic transport reviewer", reviewedAt: "2026-09-14", evidenceRef: "editorial-review:synthetic-transport",
      sourceHash: "a".repeat(64), targetHash: "b".repeat(64) };
    const profile = { locale: "en", status: "reviewed", method: "machine-translation", sourceHash: "legacy-generation-only",
      fields: { name: "Synthetic country", capital: "Test Capital" }, capitalEditorialReview: review };
    const result = normalize(profile);
    expect(result.capitalEditorialReview).toEqual(review); expect(result.capitalEditorialReview).not.toBe(review);
    expect(result.fields.capital).toBe("Test Capital"); expect(result.sourceHash).toBe("legacy-generation-only");
    expect(normalize({ ...profile, capitalEditorialReview: undefined })).not.toHaveProperty("capitalEditorialReview");
    expect(source).toContain('from "../src/data/countryCapitalReview.mjs"');
  });

  it("rejects malformed capital review transport while retaining withdrawal and rejection without promotion", () => {
    const normalize = countryNormalizer();
    const review = { schemaVersion: 1, hashContract: "country-capital-review-v1", decision: "withdrawn", reviewerType: "human",
      reviewer: "Synthetic transport reviewer", reviewedAt: "2026-09-14", evidenceRef: "editorial-review:synthetic-transport",
      sourceHash: "a".repeat(64), targetHash: "b".repeat(64) };
    const profile = { locale: "en", status: "reviewed", method: "machine-translation", sourceHash: "legacy-generation-only",
      fields: { name: "Synthetic country", capital: "Test Capital" } };
    for (const decision of ["withdrawn", "rejected"]) {
      expect(normalize({ ...profile, capitalEditorialReview: { ...review, decision } }).capitalEditorialReview.decision).toBe(decision);
    }
    expect(normalize({ ...profile, capitalEditorialReview: { ...review, reviewerType: "model" } })).not.toHaveProperty("capitalEditorialReview");
    expect(normalize({ ...profile, capitalEditorialReview: { ...review, targetHash: "unbound" } })).not.toHaveProperty("capitalEditorialReview");
    expect(normalize({ ...profile, capitalEditorialReview: { ...review, extra: true } })).not.toHaveProperty("capitalEditorialReview");
  });

  it("uses the complete literary-work source identity", () => {
    expect(source).toContain(
      "literary_work_sources: (row) =>\n    `${row.work_id}:${row.provider}:${row.source_url}`"
    );
  });

  it("orders source rows by the same complete identity", () => {
    expect(source).toContain(
      'order: "work_id.asc,provider.asc,source_url.asc"'
    );
  });

  it("reads public literary-work data through the public snapshot key", () => {
    const publicKeyUses = source.match(/publicSnapshotKey/gu) || [];
    expect(publicKeyUses.length).toBeGreaterThanOrEqual(4);
  });

  it("applies explicit biography tombstones instead of preserving stale public text", () => {
    expect(source).toContain("applyPublishedWriterBiographyOverrides({");
    expect(source).toContain("normalizeBiographyTranslations,");
  });

  it("uses the fail-closed public biography profile normalizer", () => {
    expect(source).toContain(
      'await fs.readFile(editorialCatalogPath, "utf8")'
    );
    expect(source).toContain(
      "normalizePublicWriterBiographyTranslations(value, { writerName, writerId })"
    );
    expect(source.indexOf("effectiveFields.fullName")).toBeLessThan(
      source.indexOf("effectiveFields.name")
    );
    expect(source).not.toContain("function normalizeBiographyProfile(");
  });

  it("fetches and validates every literary evidence JSONB payload", () => {
    expect(source).toContain('select: "id,legacy_id,metadata"');
    expect(source).toContain(
      '"work_id,locale,title,description,source_language,translation_method,editorial_status,source_urls,reviewed_at,metadata"'
    );
    expect(source).toContain(
      '"work_id,provider,source_url,field_names,license_name,usage,retrieved_at,metadata"'
    );
    expect(source).toContain(
      "const evidence = normalizeWorkEvidenceMetadata(work.metadata);"
    );
    expect(source).toContain(
      "metadata.titleEvidence,\n    locale"
    );
    expect(source).toContain(
      "metadata.descriptionProvenance"
    );
    expect(source).toContain(
      "const evidence = normalizeWorkSourceEvidenceMetadata(row.metadata);"
    );
    expect(source).toContain("const market = optionalString(metadata.market, 80);");
    expect(source).toContain("...(market ? { market } : {}),");
  });

  it("fails closed on malformed evidence enums, URLs, dates and hashes", () => {
    for (const validator of [
      "workTitleEvidenceRecordKinds",
      "workTitleSelectionRules",
      "workDescriptionOrigins",
      "workDescriptionTransformations",
      "workCanonEvidenceClasses",
      "httpsUrlValue",
      "isoDateValue",
      "sha256Value",
    ]) {
      expect(source).toContain(validator);
    }
    expect(source).toContain('rights.copiedSourceText !== false');
    expect(source).toContain('row.status !== "verified-published"');
    expect(source).toContain('row.entityKind === "manifestation"');
    expect(source).toContain('row.entityKind === "expression"');
    expect(source).toContain("registryItemOrdinal < 1");
    expect(source).toContain("evidence.some((item) => !item)");
  });

  it("removes stale work-level evidence before applying validated metadata", () => {
    expect(source).toContain("canon: _staleCanon");
    expect(source).toContain(
      "localizedTitles: _staleLocalizedTitles"
    );
    expect(source).toContain("...baseWork,\n    ...evidence,");
  });
});
