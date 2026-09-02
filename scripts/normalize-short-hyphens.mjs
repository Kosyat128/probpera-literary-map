import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeShortHyphens } from "./lib/short-hyphens.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");
const ignoredDirectories = new Set([
  ".git",
  ".cache",
  ".next",
  ".open-next",
  ".tmp",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);
const exactSourceTranscriptionFiles = new Set([
  path.join(projectRoot, "data", "book-canon-source-registry.json"),
  path.join(projectRoot, "data", "book-canon-loc-held-review-batch01.json"),
  path.join(projectRoot, "reports", "book-canon-source-coverage.json"),
  path.join(projectRoot, "reports", "book-canon-source-coverage.md"),
]);

async function filesIn(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await filesIn(absolutePath)));
    else if (entry.isFile() && textExtensions.has(path.extname(entry.name))) {
      result.push(absolutePath);
    }
  }
  return result;
}

const changed = [];
for (const absolutePath of await filesIn(projectRoot)) {
  // Exact authority transcriptions preserve the source's punctuation byte-for-byte.
  // Their dedicated snapshot checks are stricter than the editorial dash policy.
  if (exactSourceTranscriptionFiles.has(absolutePath)) continue;
  const source = await fs.readFile(absolutePath, "utf8");
  const normalized = normalizeShortHyphens(source);
  if (normalized === source) continue;
  changed.push(path.relative(projectRoot, absolutePath));
  if (write) await fs.writeFile(absolutePath, normalized, "utf8");
}

if (changed.length) {
  const verb = write ? "Normalized" : "Found forbidden long dashes in";
  console.error(`${verb} ${changed.length} file(s):`);
  changed.forEach((file) => console.error(`- ${file}`));
  if (!write) process.exitCode = 1;
} else {
  console.log("Short-hyphen policy passed.");
}
