import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.resolve(process.cwd(), "scripts/resolve-curated-writer-qids.mjs"),
  "utf8"
).replace(/\r\n?/gu, "\n");

describe("curated writer QID resolver source contract", () => {
  it("keeps the primary exact-label query strict and unchanged in scope", () => {
    expect(source).toContain("?item rdfs:label ?label;\n        wdt:P31 wd:Q5.");
    expect(source).toContain(
      'selectIndexedWriterCandidate(\n      writer,\n      index,\n      "exact-label-not-found"'
    );
  });

  it("queries exact Wikidata aliases only for records unresolved by labels", () => {
    expect(source).toContain("?item skos:altLabel ?alias;\n        wdt:P31 wd:Q5.");
    expect(source).toContain(
      "const aliases = collectUnresolvedAliasTerms(unresolvedAfterExactLabel);"
    );
    expect(source.indexOf("const aliases = collectUnresolvedAliasTerms")).toBeGreaterThan(
      source.indexOf("for (const { countryId, writer } of records)")
    );
  });

  it("uses an independent, versioned alias cache and explicit provenance", () => {
    expect(source).toContain('"exact-label-query.json"');
    expect(source).toContain('"exact-alias-query-v2.json"');
    expect(source).toContain("const ALIAS_CACHE_VERSION = 2;");
    expect(source).toContain('"exact-alias-and-birth-year"');
    expect(source).toContain('"exact-alias-and-literary-role"');
    expect(source).toContain('...(hasExpectedBirthYear ? ["birth-year"] : [])');
    expect(source).toContain("selectStrictAliasWriterCandidate(");
    expect(source).toContain("candidate.literaryConfirmed = true;");
    expect(source).toContain(
      "Refusing --apply because the exact-label or exact-alias cache is incomplete."
    );
  });

  it("publishes a monotonic merge instead of replacing the trusted registry", () => {
    expect(source).toContain("const existingRegistry = await readJson(outputPath, null);");
    expect(source).toContain("mergePublishedWriterMappings(");
    expect(source).toContain("addManualIdentityOverrides(eligibleFresh.writers)");
    expect(source).toContain('"russia:avvakum"');
    expect(source).toContain("filterBlockedFreshMappings(");
    expect(source).toContain("resolution: evidenceBackedReplacement");
    expect(source).toContain("writers: registryMerge.writers");
    expect(source).toContain(
      "Writer registry merge invariant failed: existing mappings removed."
    );
  });
});
