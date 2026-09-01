import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { trustedHttpsUrl } from "./lib/trusted-server-url.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.resolve(
  repositoryRoot,
  process.argv[2] ?? "scripts/globe-editions/historical-runtime-sources.json"
);
const config = JSON.parse(await readFile(configPath, "utf8"));
if (
  config.schemaVersion !== 1 ||
  config.artifactKind !== "historical-globe-runtime-production-sources"
) {
  throw new Error("Unsupported historical-globe production-source config.");
}

const cacheRoot = path.resolve(repositoryRoot, config.cacheDirectory);
const requiredRoot = path.resolve(
  repositoryRoot,
  "scripts/.cache/globe-editions/historical-runtime/production-inputs"
);
if (cacheRoot !== requiredRoot) {
  throw new Error("Historical sources may only be acquired into the fixed ignored cache.");
}
await mkdir(cacheRoot, { recursive: true });

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

async function verifyPinned(pathname, source) {
  const bytes = await readFile(pathname);
  if (bytes.length !== source.bytes || sha256(bytes) !== source.sha256) {
    throw new Error(`${source.filename}: pinned byte/checksum mismatch.`);
  }
  return bytes.length;
}

const sources = config.editions.flatMap((edition) =>
  edition.sources.map((source) => ({ editionId: edition.id, ...source }))
);
const filenames = new Set();
for (const source of sources) {
  if (
    path.basename(source.filename) !== source.filename ||
    filenames.has(source.filename.toLowerCase())
  ) {
    throw new Error(`Invalid or duplicate historical source filename: ${source.filename}`);
  }
  filenames.add(source.filename.toLowerCase());
  if (!/^https:\/\//u.test(source.url) || !/^[A-F0-9]{64}$/u.test(source.sha256)) {
    throw new Error(`${source.filename}: URL/checksum is not pinned.`);
  }

  const targetPath = path.join(cacheRoot, source.filename);
  try {
    const entry = await stat(targetPath);
    if (!entry.isFile()) throw new Error(`${source.filename}: cache target is not a file.`);
    await verifyPinned(targetPath, source);
    console.log(`Verified cached ${source.editionId}/${source.filename}.`);
    continue;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const headers = {
    "user-agent": "ProbPeraHistoricalGlobeSources/1.0",
    ...(source.referer ? { referer: source.referer } : {}),
  };
  const sourceUrl = trustedHttpsUrl(source.url, ["dl.ub.uni-freiburg.de"], "Historical source URL");
  const response = await fetch(sourceUrl, { headers, redirect: "error" });
  if (!response.ok || response.redirected || response.url !== source.url) {
    throw new Error(`${source.filename}: source request failed or redirected (${response.status}).`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== source.bytes || sha256(bytes) !== source.sha256) {
    throw new Error(`${source.filename}: downloaded bytes do not match the pinned source.`);
  }
  const temporaryPath = `${targetPath}.partial`;
  await unlink(temporaryPath).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
  await writeFile(temporaryPath, bytes, { flag: "wx" });
  await rename(temporaryPath, targetPath);
  console.log(`Acquired ${source.editionId}/${source.filename}.`);
}
