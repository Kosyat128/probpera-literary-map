import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isShortHyphenExactSource, loadShortHyphenExactSources } from "./short-hyphen-exact-source.mjs";
import { normalizeShortHyphens } from "./short-hyphens.mjs";

const protectedFiles = loadShortHyphenExactSources(process.cwd());

describe("exact source punctuation protection", () => {
  it("protects only the nine explicitly pinned source artifacts", () => {
    expect([...protectedFiles.keys()]).toEqual([
      "reports/book-r49n-dickens-reviewed-20260912.json",
      "reports/book-r49n-retained-drafts-20260912.json",
      "scripts/database/fixtures/book-canon-source-registry-before-r49n.json",
      "src/data/countries/bookR49nDickensReviewed20260912.ts",
      "src/data/countries/bookR49nAlcottDraft20260912.ts",
      "src/data/countries/bookR49nExistingReviewed20260912.ts",
      "src/data/countries/bookR49nRetainedDrafts20260912Data01.ts",
      "src/data/countries/bookR49nRetainedDrafts20260912Data02.ts",
      "src/data/countries/bookR49nRetainedDrafts20260912Data03.ts",
    ]);
  });
  it.each([...protectedFiles.keys()])("retains exact reviewed punctuation and rejects changed bytes in %s", relativePath => {
    const source = readFileSync(relativePath, "utf8").replace(/\r\n?/gu, "\n");
    expect(normalizeShortHyphens(source)).not.toBe(source);
    expect(isShortHyphenExactSource(relativePath, source, protectedFiles)).toBe(true);
    expect(isShortHyphenExactSource(relativePath.replaceAll("/", "\\"), source.replaceAll("\n", "\r\n"), protectedFiles)).toBe(true);
    expect(() => isShortHyphenExactSource(relativePath, source + " ", protectedFiles)).toThrow("rejected changed bytes");
    expect(() => isShortHyphenExactSource(relativePath, normalizeShortHyphens(source), protectedFiles)).toThrow("rejected changed bytes");
  });
  it.each(["reports/unreviewed.json", "src/components/WriterPanel.tsx", "docs/new-editorial.md"])("keeps ordinary hyphen enforcement active for %s", relativePath => {
    const source = "New prose\u2014not an exact source quotation";
    expect(isShortHyphenExactSource(relativePath, source, protectedFiles)).toBe(false);
    expect(normalizeShortHyphens(source)).toBe("New prose-not an exact source quotation");
  });
});
