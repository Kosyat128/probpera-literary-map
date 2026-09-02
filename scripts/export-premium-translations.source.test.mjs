import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.resolve(process.cwd(), "scripts/export-premium-translations.mjs"),
  "utf8"
).replace(/\r\n?/gu, "\n");

describe("premium translation public export", () => {
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
      "normalizePublicWriterBiographyTranslations(value, { writerName })"
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
