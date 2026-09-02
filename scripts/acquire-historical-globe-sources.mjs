import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function pinnedSourceRequest(source) {
  let url;
  let referer = null;
  switch (source.filename) {
    case "behaim-1908-a-d.jpg":
      url = "https://dl.ub.uni-freiburg.de/diglitData/image/ravenstein1908/4/124.jpg";
      break;
    case "behaim-1908-e-g.jpg":
      url = "https://dl.ub.uni-freiburg.de/diglitData/image/ravenstein1908/4/125.jpg";
      break;
    case "behaim-1908-h-j.jpg":
      url = "https://dl.ub.uni-freiburg.de/diglitData/image/ravenstein1908/4/126.jpg";
      break;
    case "behaim-1908-k-m-caps.jpg":
      url = "https://dl.ub.uni-freiburg.de/diglitData/image/ravenstein1908/4/127.jpg";
      break;
    case "hondius-1615.jpg":
      url =
        "https://tile.loc.gov/image-services/iiif/service:gmd:gmd3:g3201:g3201b:ct000726/full/full/0/default.jpg";
      break;
    case "coronelli-1697.jp2":
      url = "https://stacks.stanford.edu/file/druid:fw438kx8748/fw438kx8748_05_0001.jp2";
      break;
    case "scherer-1700.jpg":
      url =
        "https://images.digital.library.illinois.edu/iiif/2/e0f792e0-8be8-0137-6dac-02d0d7bfd6e4-0/full/full/0/default.jpg";
      referer =
        "https://digital.library.illinois.edu/items/17c519d0-8bdc-0137-6dac-02d0d7bfd6e4-9";
      break;
    default:
      throw new Error(`${source.filename}: historical source is not statically pinned.`);
  }

  if (source.url !== url || (source.referer ?? null) !== referer) {
    throw new Error(`${source.filename}: request metadata does not match the reviewed source.`);
  }
  return { url, referer };
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

  const request = pinnedSourceRequest(source);
  const headers = {
    "user-agent": "ProbPeraHistoricalGlobeSources/1.0",
    ...(request.referer ? { referer: request.referer } : {}),
  };
  const response = await fetch(request.url, { headers, redirect: "error" });
  if (!response.ok || response.redirected || response.url !== request.url) {
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
