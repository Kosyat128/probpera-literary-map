import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const legacyHost = ["static", "tildacdn", "com"].join(".");
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);
const excludedDirectories = new Set([
  ".git",
  ".next",
  ".tmp",
  "dist",
  "node_modules",
  "playwright-report",
  "reports",
  "test-results",
]);
const criticalRuntimeBoundaries = [
  ".github/",
  "apps/admin/",
  "scripts/cloudflare/",
  "src/community/",
  "src/lib/",
  "index.html",
  "public/sw.js",
  "vite.config.ts",
  "package.json",
  "package-lock.json",
];

function sourceFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(entryPath));
      continue;
    }
    if (!entry.isFile() || !textExtensions.has(path.extname(entry.name))) continue;
    if (statSync(entryPath).size > 8 * 1024 * 1024) continue;
    files.push(entryPath);
  }
  return files;
}

function repositoryPath(filename) {
  return path.relative(root, filename).split(path.sep).join("/");
}

function legacyReferences() {
  const httpsPattern = new RegExp(
    `https:\\/\\/${legacyHost.replaceAll(".", "\\.")}[^\\s\\"'<>)]*`,
    "giu"
  );
  const httpPattern = new RegExp(
    `http:\\/\\/${legacyHost.replaceAll(".", "\\.")}[^\\s\\"'<>)]*`,
    "giu"
  );
  const references = [];
  const insecure = [];

  for (const filename of sourceFiles(root)) {
    const relativePath = repositoryPath(filename);
    if (relativePath === "scripts/legacy-media-boundary.source.test.mjs") continue;
    const source = readFileSync(filename, "utf8");
    for (const url of source.match(httpsPattern) || []) {
      references.push({ file: relativePath, url });
    }
    for (const url of source.match(httpPattern) || []) {
      insecure.push({ file: relativePath, url });
    }
  }

  return { references, insecure };
}

function isCriticalBoundary(filename) {
  return criticalRuntimeBoundaries.some((boundary) =>
    boundary.endsWith("/")
      ? filename.startsWith(boundary)
      : filename === boundary
  );
}

describe("legacy media boundary", () => {
  const { references, insecure } = legacyReferences();

  it("never introduces an insecure legacy CDN URL", () => {
    expect(insecure, JSON.stringify(insecure.slice(0, 20), null, 2)).toEqual([]);
  });

  it("keeps legacy Tilda references out of executable and security boundaries", () => {
    const violations = references.filter(({ file }) => isCriticalBoundary(file));
    expect(violations, JSON.stringify(violations.slice(0, 30), null, 2)).toEqual([]);
  });

  it("accepts only passive media URLs without embedded credentials", () => {
    const executableExtensions = /\.(?:c?js|mjs|css|wasm)(?:$|[?#])/iu;
    const sensitiveQueryKeys = new Set([
      "access_token",
      "api_key",
      "apikey",
      "auth",
      "key",
      "secret",
      "signature",
      "token",
    ]);
    const violations = [];

    for (const reference of references) {
      const parsed = new URL(reference.url);
      const hasSensitiveQuery = [...parsed.searchParams.keys()].some((key) =>
        sensitiveQueryKeys.has(key.toLocaleLowerCase("en-US"))
      );
      if (executableExtensions.test(parsed.pathname) || hasSensitiveQuery) {
        violations.push(reference);
      }
    }

    expect(violations, JSON.stringify(violations.slice(0, 30), null, 2)).toEqual([]);
  });
});
