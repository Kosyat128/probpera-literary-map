import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRootDir = path.resolve(scriptDir, "..");
const defaultManifestPath = path.join(
  defaultRootDir,
  "config",
  "tilda-dependency-baseline.json"
);
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".webmanifest",
  ".xml",
]);
const tildaUrlPattern =
  /https:\/\/static\.tildacdn\.com\/[^\s"'<>`\\)]+/gu;

function portablePath(value) {
  return value.split(path.sep).join("/");
}

function normalizeMatchedUrl(value) {
  return value.replace(/[.,;:!?]+$/u, "");
}

export function extractTildaUrls(source) {
  return [...String(source).matchAll(tildaUrlPattern)].map((match) =>
    normalizeMatchedUrl(match[0])
  );
}

function isTextFile(filename) {
  return textExtensions.has(path.extname(filename).toLocaleLowerCase("en"));
}

async function collectRuntimeTextFiles(rootDir, runtimeRoots) {
  const files = [];

  async function walk(absoluteDirectory) {
    let entries;
    try {
      entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile() && isTextFile(entry.name)) {
        files.push(absolutePath);
      }
    }
  }

  for (const runtimeRoot of runtimeRoots) {
    await walk(path.join(rootDir, runtimeRoot));
  }

  return files.sort((left, right) => left.localeCompare(right, "en"));
}

export function classifyTildaPath(relativePath, manifest) {
  if (Object.hasOwn(manifest.handwrittenFiles || {}, relativePath)) {
    return "handwritten";
  }
  if (
    (manifest.generatedPrefixes || []).some(
      (prefix) => relativePath === prefix || relativePath.startsWith(prefix)
    )
  ) {
    return "generated";
  }
  return "unexpected";
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

export async function auditTildaDependencies({
  rootDir = defaultRootDir,
  manifestPath = defaultManifestPath,
  manifest: suppliedManifest,
} = {}) {
  const manifest =
    suppliedManifest || JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const runtimeRoots = manifest.runtimeRoots || ["src", "public"];
  const runtimeFiles = await collectRuntimeTextFiles(rootDir, runtimeRoots);
  const matches = [];

  for (const absolutePath of runtimeFiles) {
    const relativePath = portablePath(path.relative(rootDir, absolutePath));
    const source = await fs.readFile(absolutePath, "utf8");
    const urls = extractTildaUrls(source);
    if (!urls.length) continue;
    matches.push({
      path: relativePath,
      category: classifyTildaPath(relativePath, manifest),
      occurrences: urls.length,
      urls: sortedUnique(urls),
    });
  }

  const errors = [];
  const handwrittenSummary = [];

  for (const [relativePath, baseline] of Object.entries(
    manifest.handwrittenFiles || {}
  )) {
    const entry = matches.find((match) => match.path === relativePath);
    const actualOccurrences = entry?.occurrences || 0;
    const actualUrls = entry?.urls || [];
    const allowedUrls = sortedUnique(baseline.allowedUrls || []);
    const addedUrls = difference(actualUrls, allowedUrls);
    const missingUrls = difference(allowedUrls, actualUrls);

    if (actualOccurrences !== baseline.expectedOccurrences) {
      errors.push(
        `${relativePath}: expected ${baseline.expectedOccurrences} Tilda occurrence(s), found ${actualOccurrences}`
      );
    }
    if (addedUrls.length) {
      errors.push(
        `${relativePath}: unreviewed Tilda URL(s): ${addedUrls.join(", ")}`
      );
    }
    if (missingUrls.length) {
      errors.push(
        `${relativePath}: reviewed baseline URL(s) disappeared; update the migration baseline deliberately: ${missingUrls.join(", ")}`
      );
    }

    handwrittenSummary.push({
      path: relativePath,
      occurrences: actualOccurrences,
      uniqueUrls: actualUrls.length,
      addedUrls,
      missingUrls,
    });
  }

  const unexpected = matches.filter((match) => match.category === "unexpected");
  for (const entry of unexpected) {
    errors.push(
      `${entry.path}: Tilda dependency is outside reviewed handwritten/generated locations (${entry.occurrences} occurrence(s))`
    );
  }

  const generated = matches.filter((match) => match.category === "generated");
  const totalOccurrences = matches.reduce(
    (total, match) => total + match.occurrences,
    0
  );

  return {
    status: errors.length ? "failed" : "ready",
    host: manifest.host || "static.tildacdn.com",
    scannedFiles: runtimeFiles.length,
    filesWithDependencies: matches.length,
    totalOccurrences,
    uniqueUrls: sortedUnique(matches.flatMap((match) => match.urls)).length,
    handwritten: handwrittenSummary,
    generated: {
      files: generated.length,
      occurrences: generated.reduce(
        (total, match) => total + match.occurrences,
        0
      ),
      uniqueUrls: sortedUnique(generated.flatMap((match) => match.urls)).length,
      largestFiles: generated
        .slice()
        .sort(
          (left, right) =>
            right.occurrences - left.occurrences ||
            left.path.localeCompare(right.path, "en")
        )
        .slice(0, 12)
        .map(({ path: filename, occurrences, urls }) => ({
          path: filename,
          occurrences,
          uniqueUrls: urls.length,
        })),
    },
    unexpected: unexpected.map(({ path: filename, occurrences, urls }) => ({
      path: filename,
      occurrences,
      urls,
    })),
    errors,
  };
}

async function main() {
  const unknownArguments = process.argv.slice(2);
  if (unknownArguments.length) {
    throw new Error(`Unknown argument: ${unknownArguments[0]}`);
  }
  const summary = await auditTildaDependencies();
  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors.length) process.exitCode = 1;
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryPoint === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
