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
});
