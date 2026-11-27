import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, mkdtemp, open, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const maxOriginalBytes = Math.floor(3.9 * 1024 * 1024);
const maxCacheBytes = 192 * 1024 * 1024;
const maxManifestBytes = 1024 * 1024;
const readFlags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
const editorialUrl = /^https:\/\/sjqejjmwpzfsczxdghvw\.supabase\.co\/storage\/v1\/object\/public\/editorial-media\/20\d{2}\/(?:0[1-9]|1[0-2])\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(?:jpg|png|webp|avif)$/u;
const sha256 = value => createHash("sha256").update(value).digest("hex");

function publicObject(url) {
  return typeof url === "string" && url.trim() === url && editorialUrl.test(url);
}

function sourceMetadata(sourceUrl, source) {
  if (!Number.isSafeInteger(source?.bytes) || source.bytes < 1 || source.bytes > maxOriginalBytes ||
      typeof source.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(source.sha256)) return null;
  return { sourceUrl, bytes: source.bytes, sha256: source.sha256 };
}

function readySource(record, sourceUrl) {
  return record?.sourceUrl === sourceUrl && record.status === "ready" && record.pipelineVersion === 1
    ? sourceMetadata(sourceUrl, record.source)
    : null;
}

async function readRegularFile(filename, limit) {
  let file;
  try {
    file = await open(filename, readFlags);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ELOOP") return null;
    throw error;
  }
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > limit) return null;
    // Read one extra byte to detect growth without exceeding the size limit by more than one byte.
    const bytes = Buffer.alloc(info.size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    return offset === info.size ? bytes.subarray(0, offset) : null;
  } finally {
    await file.close();
  }
}

function parseJson(bytes) {
  try { return bytes ? JSON.parse(bytes) : null; } catch { return null; }
}

async function verifiedOriginal(directory, entry) {
  const bytes = await readRegularFile(path.join(directory, `${sha256(entry.sourceUrl)}.bin`), entry.bytes);
  return bytes?.length === entry.bytes && sha256(bytes) === entry.sha256 ? bytes : null;
}

export async function cachePublicEditorialOriginals({ mode, root, inventory, matchedKey = "", restoredDigest = "" }) {
  const temporary = path.join(root, ".tmp");
  const cache = path.join(temporary, "editorial-source-cache");
  const pipeline = path.join(temporary, "public-images");
  const originals = path.join(pipeline, "originals");
  const tracked = JSON.parse(await readFile(path.join(root, "reports/public-image-delivery.json")));
  const known = new Map(tracked.images.map(record => [record.sourceUrl, readySource(record, record.sourceUrl)]));
  const eligible = new Set(inventory.map(record => record.sourceUrl).filter(publicObject));
  const manifest = await readRegularFile(path.join(cache, "manifest.json"), maxManifestBytes);
  const archiveHash = manifest && sha256(manifest);
  const archive = archiveHash && matchedKey.endsWith(`-${archiveHash}`) ? parseJson(manifest) : null;
  const archived = new Map();
  for (const record of Array.isArray(archive) ? archive : []) {
    const url = record?.sourceUrl;
    if (!eligible.has(url)) continue;
    const entry = sourceMetadata(url, record);
    const pinned = known.get(url);
    if (entry && (!pinned || pinned.sha256 === entry.sha256 && pinned.bytes === entry.bytes)) archived.set(url, entry);
  }

  if (mode === "restore") {
    await mkdir(originals, { recursive: true });
    let restored = 0;
    let totalBytes = 0;
    for (const entry of archived.values()) {
      if (totalBytes + entry.bytes > maxCacheBytes) continue;
      const bytes = await verifiedOriginal(cache, entry);
      if (!bytes) continue;
      await writeFile(path.join(originals, `${sha256(entry.sourceUrl)}.bin`), bytes);
      restored += 1;
      totalBytes += entry.bytes;
    }
    const digest = restored && restored === archive.length ? archiveHash : "";
    return { count: restored, digest, changed: false };
  }

  if (mode !== "stage") throw new Error("Expected restore or stage.");
  const entries = [];
  let totalBytes = 0;
  // Newer URLs take priority if the cache reaches its size limit.
  for (const url of [...eligible].sort().reverse()) {
    const checkpoint = parseJson(await readRegularFile(
      path.join(pipeline, "checkpoints", `${sha256(url)}.json`), maxManifestBytes
    ));
    const pinned = known.get(url);
    const entry = pinned || readySource(checkpoint, url) || archived.get(url);
    if (!entry || totalBytes + entry.bytes > maxCacheBytes) continue;
    if (!await verifiedOriginal(originals, entry)) continue;
    entries.push(entry);
    totalBytes += entry.bytes;
  }
  const nextManifest = JSON.stringify(entries);
  const digest = sha256(nextManifest);
  if (entries.length === 0 || digest === restoredDigest) return { count: entries.length, digest, changed: false };

  const staging = await mkdtemp(path.join(temporary, "editorial-source-staging-"));
  for (const entry of entries) {
    const bytes = await verifiedOriginal(originals, entry);
    if (!bytes) throw new Error("A verified original changed while staging the public image cache.");
    await writeFile(path.join(staging, `${sha256(entry.sourceUrl)}.bin`), bytes);
  }
  await writeFile(path.join(staging, "manifest.json"), nextManifest);
  const previous = await mkdtemp(path.join(temporary, "editorial-source-prior-"));
  await rename(cache, path.join(previous, "cache")).catch(error => {
    if (error.code !== "ENOENT") throw error;
  });
  await rename(staging, cache);
  return { count: entries.length, digest, changed: true };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const { collectPublicImageSources } = await import("./prepare-public-images.mjs");
  const mode = process.argv[2];
  const result = await cachePublicEditorialOriginals({
    mode,
    root: process.cwd(),
    inventory: await collectPublicImageSources(),
    matchedKey: process.env.EDITORIAL_SOURCE_CACHE_MATCHED_KEY,
    restoredDigest: process.env.EDITORIAL_SOURCE_CACHE_RESTORED_DIGEST,
  });
  console.error(`Public editorial originals (${mode}): ${result.count}`);
  process.stdout.write(`digest=${result.digest}\nchanged=${result.changed}\n`);
}
