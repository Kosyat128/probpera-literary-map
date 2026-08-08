import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const importer = readFileSync(
  new URL("../scripts/import-wikidata-writers.mjs", import.meta.url),
  "utf8"
);
const generatedMerge = readFileSync(
  new URL("./data/countries/generated/index.ts", import.meta.url),
  "utf8"
);

describe("Wikidata writer import safety", () => {
  it("writes candidate-only records and never a public biography field", () => {
    expect(importer).toContain('"writers.candidates.json"');
    expect(importer).not.toContain('"writers.generated.json"');
    expect(importer).toContain("sourceDescriptionCandidate");
    expect(importer).not.toMatch(/^\s*biography\s*:/mu);
    expect(importer).toContain('const apply = process.argv.includes("--apply")');
  });

  it("does not merge generated candidates into the visitor archive", () => {
    expect(generatedMerge).not.toContain("writers.generated.json");
    expect(generatedMerge).toContain("return countries;");
  });
});
