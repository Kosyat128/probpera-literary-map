import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LEGACY_SUFFIXES = ["tildacdn.com", "tildacdn.info"];
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".csv",
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
  ".yml",
  ".yaml",
]);
const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".tmp",
  ".turbo",
  "dist",
  "node_modules",
  "playwright-report",
  "reports",
  "test-results",
]);
const EXECUTABLE_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".wasm",
]);
const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);
const VIDEO_EXTENSIONS = new Set([
  ".m4v",
  ".mov",
  ".mp4",
  ".webm",
]);
const DOCUMENT_EXTENSIONS = new Set([
  ".doc",
  ".docx",
  ".epub",
  ".pdf",
  ".rtf",
]);
const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "auth",
  "authorization",
  "key",
  "password",
  "secret",
  "signature",
  "token",
]);
const MAX_SOURCE_FILE_BYTES = 16 * 1024 * 1024;

function isLegacyHost(hostname) {
  const normalized = hostname.toLocaleLowerCase("en-US");
  return LEGACY_SUFFIXES.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`)
  );
}

function mediaKind(extension) {
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (DOCUMENT_EXTENSIONS.has(extension)) return "document";
  if (EXECUTABLE_EXTENSIONS.has(extension)) return "executable";
  return extension ? "other" : "unknown";
}

function trimUrlCandidate(value) {
  let output = value;
  while (/[),.;:!?\]}]$/u.test(output)) output = output.slice(0, -1);
  return output;
}

function locationForOffset(source, offset) {
  const before = source.slice(0, offset);
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function redactUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLocaleLowerCase("en-US"))) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    if (url.username) url.username = "[redacted]";
    if (url.password) url.password = "[redacted]";
    return url.toString();
  } catch {
    return rawUrl.slice(0, 500);
  }
}

function normalizeUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.hash = "";
  url.hostname = url.hostname.toLocaleLowerCase("en-US");
  const sortedEntries = [...url.searchParams.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );
  url.search = "";
  for (const [key, value] of sortedEntries) url.searchParams.append(key, value);
  return url.toString();
}

export function extractLegacyMediaReferences(source, filename = "unknown") {
  const suffixPattern = LEGACY_SUFFIXES.map((suffix) =>
    suffix.replaceAll(".", "\\.")
  ).join("|");
  const pattern = new RegExp(
    `https?:\\/\\/(?:[a-z0-9.-]+\\.)?(?:${suffixPattern})(?:\\/[^\\s\\"'<>\\`\\\\]*)?`,
    "giu"
  );
  const references = [];

  for (const match of source.matchAll(pattern)) {
    const candidate = trimUrlCandidate(match[0]);
    const offset = match.index ?? 0;
    const location = locationForOffset(source, offset);
    try {
      const parsed = new URL(candidate);
      if (!isLegacyHost(parsed.hostname)) continue;
      const extension = path.extname(parsed.pathname).toLocaleLowerCase("en-US");
      const sensitiveQueryKeys = [...parsed.searchParams.keys()].filter((key) =>
        SENSITIVE_QUERY_KEYS.has(key.toLocaleLowerCase("en-US"))
      );
      references.push({
        file: filename,
        line: location.line,
        column: location.column,
        url: redactUrl(candidate),
        normalizedUrl: normalizeUrl(candidate),
        protocol: parsed.protocol,
        host: parsed.hostname.toLocaleLowerCase("en-US"),
        pathname: parsed.pathname,
        extension,
        mediaKind: mediaKind(extension),
        hasCredentials: Boolean(parsed.username || parsed.password),
        sensitiveQueryKeys,
        malformed: false,
      });
    } catch {
      references.push({
        file: filename,
        line: location.line,
        column: location.column,
        url: candidate.slice(0, 500),
        normalizedUrl: candidate,
        protocol: "",
        host: "",
        pathname: "",
        extension: "",
        mediaKind: "unknown",
        hasCredentials: false,
        sensitiveQueryKeys: [],
        malformed: true,
      });
    }
  }

  return references;
}

async function collectSourceFiles(root, directory = root) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(root, entryPath));
      continue;
    }
    if (!entry.isFile() || !TEXT_EXTENSIONS.has(path.extname(entry.name))) continue;
    const stat = await fs.stat(entryPath);
    if (stat.size > MAX_SOURCE_FILE_BYTES) continue;
    files.push(entryPath);
  }
  return files;
}

function repositoryPath(root, filename) {
  return path.relative(root, filename).split(path.sep).join("/");
}

function countBy(values, selector) {
  const counts = new Map();
  for (const value of values) {
    const key = selector(value) || "(none)";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))
  );
}

function topEntries(counts, limit = 20) {
  return Object.entries(counts)
    .sort(([, left], [, right]) => right - left)
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function safeUniqueUrl(reference) {
  return reference.hasCredentials || reference.sensitiveQueryKeys.length
    ? reference.url
    : reference.normalizedUrl;
}

export function buildLegacyMediaInventory(references, sourceFilesScanned = 0) {
  const grouped = new Map();
  for (const reference of references) {
    const key = reference.normalizedUrl;
    const existing = grouped.get(key) || {
      url: safeUniqueUrl(reference),
      host: reference.host,
      extension: reference.extension,
      mediaKind: reference.mediaKind,
      protocol: reference.protocol,
      hasCredentials: reference.hasCredentials,
      sensitiveQueryKeys: reference.sensitiveQueryKeys,
      malformed: reference.malformed,
      references: [],
    };
    existing.references.push({
      file: reference.file,
      line: reference.line,
      column: reference.column,
    });
    grouped.set(key, existing);
  }

  const assets = [...grouped.values()]
    .map((asset) => ({
      ...asset,
      referenceCount: asset.references.length,
      files: [...new Set(asset.references.map(({ file }) => file))].sort(),
    }))
    .sort((left, right) =>
      right.referenceCount - left.referenceCount || left.url.localeCompare(right.url)
    );
  const httpReferences = references.filter(({ protocol }) => protocol === "http:");
  const executableReferences = references.filter(
    ({ mediaKind: kind }) => kind === "executable"
  );
  const credentialedReferences = references.filter(
    ({ hasCredentials, sensitiveQueryKeys }) =>
      hasCredentials || sensitiveQueryKeys.length > 0
  );
  const malformedReferences = references.filter(({ malformed }) => malformed);
  const byFile = countBy(references, ({ file }) => file);
  const byExtension = countBy(references, ({ extension }) => extension || "(none)");
  const byKind = countBy(references, ({ mediaKind: kind }) => kind);
  const uniqueUrls = assets.map(({ url }) => url).sort();
  const urlSetSha256 = createHash("sha256")
    .update(uniqueUrls.join("\n"))
    .digest("hex");

  return {
    generatedAt: new Date().toISOString(),
    sourceFilesScanned,
    totalReferences: references.length,
    uniqueAssets: assets.length,
    duplicatedAssets: assets.filter(({ referenceCount }) => referenceCount > 1).length,
    unsafe: {
      httpReferences: httpReferences.length,
      executableReferences: executableReferences.length,
      credentialedReferences: credentialedReferences.length,
      malformedReferences: malformedReferences.length,
    },
    byKind,
    byExtension,
    topFiles: topEntries(byFile),
    urlSetSha256,
    assets,
  };
}

function inventoryMarkdown(inventory) {
  const lines = [
    "# Инвентаризация старых Tilda-медиа",
    "",
    `Сформировано: ${inventory.generatedAt}`,
    "",
    `- Проверено файлов: ${inventory.sourceFilesScanned}`,
    `- Всего ссылок: ${inventory.totalReferences}`,
    `- Уникальных ресурсов: ${inventory.uniqueAssets}`,
    `- Ресурсов с повторным использованием: ${inventory.duplicatedAssets}`,
    `- SHA-256 набора URL: \`${inventory.urlSetSha256}\``,
    "",
    "## Риски",
    "",
    `- HTTP-ссылки: ${inventory.unsafe.httpReferences}`,
    `- Исполняемые ресурсы: ${inventory.unsafe.executableReferences}`,
    `- URL с чувствительными параметрами: ${inventory.unsafe.credentialedReferences}`,
    `- Некорректные URL: ${inventory.unsafe.malformedReferences}`,
    "",
    "## Типы ресурсов",
    "",
    "| Тип | Ссылок |",
    "|---|---:|",
    ...Object.entries(inventory.byKind).map(
      ([kind, count]) => `| ${kind} | ${count} |`
    ),
    "",
    "## Файлы с наибольшим числом ссылок",
    "",
    "| Файл | Ссылок |",
    "|---|---:|",
    ...inventory.topFiles.map(
      ({ name, count }) => `| \`${name.replaceAll("|", "\\|")}\` | ${count} |`
    ),
    "",
    "## Ресурсы",
    "",
    "| URL | Тип | Расширение | Использований | Файлов |",
    "|---|---|---|---:|---:|",
    ...inventory.assets.map(
      ({ url, mediaKind: kind, extension, referenceCount, files }) =>
        `| ${url.replaceAll("|", "%7C")} | ${kind} | ${extension || "—"} | ${referenceCount} | ${files.length} |`
    ),
    "",
  ];
  return lines.join("\n");
}

function inventoryCsv(inventory) {
  const rows = [
    ["url", "host", "kind", "extension", "reference_count", "file_count", "files"],
    ...inventory.assets.map((asset) => [
      asset.url,
      asset.host,
      asset.mediaKind,
      asset.extension,
      asset.referenceCount,
      asset.files.length,
      asset.files.join(" | "),
    ]),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export async function auditLegacyTildaMedia({
  root = process.cwd(),
  outputDirectory = path.join(root, ".tmp", "legacy-media-inventory"),
  write = true,
} = {}) {
  const absoluteRoot = path.resolve(root);
  const sourceFiles = await collectSourceFiles(absoluteRoot);
  const references = [];
  for (const filename of sourceFiles) {
    const relativeFilename = repositoryPath(absoluteRoot, filename);
    if (relativeFilename === "scripts/audit-legacy-tilda-media.mjs") continue;
    const source = await fs.readFile(filename, "utf8");
    references.push(
      ...extractLegacyMediaReferences(source, relativeFilename)
    );
  }
  const inventory = buildLegacyMediaInventory(references, sourceFiles.length);

  if (write) {
    await fs.mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      fs.writeFile(
        path.join(outputDirectory, "inventory.json"),
        `${JSON.stringify(inventory, null, 2)}\n`,
        "utf8"
      ),
      fs.writeFile(
        path.join(outputDirectory, "inventory.md"),
        inventoryMarkdown(inventory),
        "utf8"
      ),
      fs.writeFile(
        path.join(outputDirectory, "inventory.csv"),
        inventoryCsv(inventory),
        "utf8"
      ),
    ]);
  }

  return inventory;
}

function argumentValue(name) {
  const inlinePrefix = `${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const root = path.resolve(argumentValue("--root") || process.cwd());
  const outputDirectory = path.resolve(
    argumentValue("--output") || path.join(root, ".tmp", "legacy-media-inventory")
  );
  const inventory = await auditLegacyTildaMedia({ root, outputDirectory });
  const summary = {
    status:
      Object.values(inventory.unsafe).some((count) => count > 0)
        ? "unsafe"
        : "ready",
    sourceFilesScanned: inventory.sourceFilesScanned,
    totalReferences: inventory.totalReferences,
    uniqueAssets: inventory.uniqueAssets,
    duplicatedAssets: inventory.duplicatedAssets,
    unsafe: inventory.unsafe,
    urlSetSha256: inventory.urlSetSha256,
    outputDirectory,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.status !== "ready") process.exitCode = 1;
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
