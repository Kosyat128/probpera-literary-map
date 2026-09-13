import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

// These are exact source transcriptions, not editorial prose. Reuse their
// independently checked release pins instead of changing imported punctuation.
export function loadShortHyphenExactSources(projectRoot) {
  const json = relativePath => JSON.parse(readFileSync(path.join(projectRoot, relativePath), "utf8"));
  const dickens = json("scripts/governance/book-r49n-dickens-reviewed-20260912.json");
  const common = json("scripts/governance/book-r49n-package-reviewed-20260912.json");
  const report = json("reports/book-r49n-package-reviewed-20260912.json");
  const sourcePin = (attestation, relativePath) => attestation.additions.find(entry => entry.path === relativePath)?.sha256;
  const protectedFiles = new Map([
    ["reports/book-r49n-dickens-reviewed-20260912.json", report.earlierDickensReview.sha256],
    ["reports/book-r49n-retained-drafts-20260912.json", report.retainedDraftDisplay.sha256],
    ["scripts/database/fixtures/book-canon-source-registry-before-r49n.json", "d0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef"],
    ["src/data/countries/bookR49nDickensReviewed20260912.ts", sourcePin(dickens, "src/data/countries/bookR49nDickensReviewed20260912.ts")],
    ...[
      "src/data/countries/bookR49nAlcottDraft20260912.ts",
      "src/data/countries/bookR49nExistingReviewed20260912.ts",
      "src/data/countries/bookR49nRetainedDrafts20260912Data01.ts",
      "src/data/countries/bookR49nRetainedDrafts20260912Data02.ts",
      "src/data/countries/bookR49nRetainedDrafts20260912Data03.ts",
    ].map(relativePath => [relativePath, sourcePin(common, relativePath)]),
  ]);
  for (const [relativePath, digest] of protectedFiles) {
    if (!/^[0-9a-f]{64}$/u.test(digest || "")) throw new Error(`Exact-source hyphen protection lacks its reviewed SHA-256: ${relativePath}`);
  }
  return protectedFiles;
}

export function isShortHyphenExactSource(relativePath, source, protectedFiles) {
  const expected = protectedFiles.get(relativePath.replaceAll("\\", "/"));
  if (!expected) return false;
  const actual = createHash("sha256").update(source.replace(/\r\n?/gu, "\n"), "utf8").digest("hex");
  if (actual !== expected) throw new Error(`Exact-source hyphen protection rejected changed bytes: ${relativePath}`);
  return true;
}
