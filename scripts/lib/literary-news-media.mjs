import { createHash } from "node:crypto";
import { mkdir, open, rename, writeFile } from "node:fs/promises";
import sharp from "sharp";
import registry from "../../data/news/social-media-assets.json" with { type: "json" };
import { fetchPinnedNewsSource } from "./literary-news-safe-fetch.mjs";

export const NEWS_MEDIA_LIMITS = Object.freeze({ sourceBytes: 8 * 1024 * 1024, outputBytes: 2 * 1024 * 1024,
  pixels: 20_000_000, maxSide: 1600, minSide: 240, registryAssets: 32 });
export const NEWS_MEDIA_PROFILE = "literary-news-photo-v1";
const cacheRoot = new URL("../../.tmp/news-social-media/", import.meta.url);
export const mediaByteHash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const fail = (code) => { throw new Error(code); };
const httpsUrl = (input) => {
  try { const url = new URL(input); return url.protocol === "https:" && !url.username && !url.password
    && (!url.port || url.port === "443") ? url : null; } catch { return null; }
};

/** Permissions describe the exact bytes, named work/event and each numeric destination.
 * Public availability, site display permissions and a generic copyright notice are insufficient.
 */
export function checkedNewsMediaAsset(asset, destination, newsId, now = new Date()) {
  if (!asset || !/^[a-z0-9-]{1,100}$/.test(asset.id || "") || asset.status !== "approved"
    || !Array.isArray(asset.newsIds) || !asset.newsIds.length || asset.newsIds.length > 20
    || asset.newsIds.some((id)=>typeof id!=="string" || !id.trim() || id.length>120) || !asset.newsIds.includes(newsId)
    || !hash(asset.sourceSha256) || !httpsUrl(asset.sourceUrl)
    || !["book", "portrait", "adaptation", "festival", "archive", "editorial"].includes(asset.subject)
    || !asset.entityEvidence?.trim() || asset.entityEvidence.length > 2000
    || !asset.author?.trim() || !asset.rightsholder?.trim() || !asset.credit?.trim() || asset.credit.length > 1200
    || !["public-domain", "CC0", "CC-BY-4.0", "explicit-permission", "owned"].includes(asset.license)
    || !httpsUrl(asset.licenseEvidenceUrl) || !hash(asset.licenseEvidenceSha256)
    || !["license-page", "written-permission", "ownership-record"].includes(asset.checkMethod)
    || !Number.isFinite(Date.parse(asset.checkedAt)) || Date.parse(asset.checkedAt) > now.getTime()
    || now.getTime() - Date.parse(asset.checkedAt) > 30 * 86400000
    || !Number.isFinite(Date.parse(asset.validUntil)) || Date.parse(asset.validUntil) <= now.getTime()
    || asset.transformations?.resize !== true || asset.transformations?.metadataRemoval !== true
    || asset.transformations?.reencode !== true || asset.transformations?.crop !== false)
    fail("media_rights_or_identity_unverified");
  if (!Array.isArray(asset.permissions) || asset.permissions.length>16 || !["telegram","vk"].includes(destination?.platform)
    || typeof destination?.id!=="string" || !/^-[1-9]\d{0,15}$/.test(destination.id)) fail("media_destination_not_licensed");
  const permission = asset.permissions.find((row) => row.platform === destination.platform && row.destinationId === destination.id);
  if (!permission || permission.publish !== true || permission.providerProcessing !== true
    || !httpsUrl(permission.evidenceUrl)) fail("media_destination_not_licensed");
  return asset;
}

/** Decode the whole raster, never trust an extension or a metadata header alone.
 * Rotate from EXIF, contain (never crop/upscale), flatten and strip all embedded metadata.
 */
export async function normalizeNewsMedia(bytes, declaredMime) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > NEWS_MEDIA_LIMITS.sourceBytes) fail("media_source_size_invalid");
  const signature = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "image/jpeg"
    : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png"
      : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP" ? "image/webp" : null;
  if (!signature || declaredMime?.split(";")[0].trim().toLowerCase() !== signature) fail("media_mime_invalid");
  try {
    const input = sharp(bytes, { failOn: "warning", limitInputPixels: NEWS_MEDIA_LIMITS.pixels, animated: false });
    const meta = await input.metadata();
    if (!meta.width || !meta.height || (meta.pages || 1) !== 1 || Math.min(meta.width, meta.height) < NEWS_MEDIA_LIMITS.minSide
      || meta.width * meta.height > NEWS_MEDIA_LIMITS.pixels || Math.max(meta.width / meta.height, meta.height / meta.width) > 20)
      fail("media_dimensions_invalid");
    const output = await input.rotate().resize({ width: NEWS_MEDIA_LIMITS.maxSide, height: NEWS_MEDIA_LIMITS.maxSide,
      fit: "inside", withoutEnlargement: true }).flatten({ background: "#f5f1e8" }).jpeg({ quality: 86, mozjpeg: true })
      .timeout({ seconds: 10 }).toBuffer({ resolveWithObject: true });
    if (output.data.length > NEWS_MEDIA_LIMITS.outputBytes) fail("media_output_too_large");
    return { bytes: output.data, descriptor: { sha256: mediaByteHash(output.data), byteLength: output.data.length,
      mime: "image/jpeg", width: output.info.width, height: output.info.height, profile: NEWS_MEDIA_PROFILE } };
  } catch (error) { if (/^media_/.test(error.message)) throw error; fail("media_decode_failed"); }
}

async function boundedBytes(response) {
  if (!response.ok || !response.body) fail("media_source_unavailable");
  if (Number(response.headers.get("content-length")) > NEWS_MEDIA_LIMITS.sourceBytes) fail("media_source_size_invalid");
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break;
    size += value.length; if (size > NEWS_MEDIA_LIMITS.sourceBytes) fail("media_source_size_invalid"); chunks.push(Buffer.from(value)); }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function downloadNewsMediaAsset(asset, { registry: assets = registry, fetchImpl = fetchPinnedNewsSource } = {}) {
  const url = httpsUrl(asset.sourceUrl);
  if (!url || !Array.isArray(assets.downloadHosts) || assets.downloadHosts.length>32
    || !assets.downloadHosts.includes(url.hostname) || !hash(asset.sourceSha256)) fail("media_source_not_allowlisted");
  const response = await fetchImpl(url.href, { redirect: "error", timeoutMs: 15000,
    signal: AbortSignal.timeout(15000), maxResponseBytes: NEWS_MEDIA_LIMITS.sourceBytes, headers: { Accept: "image/jpeg,image/png,image/webp" } });
  const bytes = await boundedBytes(response);
  if (mediaByteHash(bytes) !== asset.sourceSha256) fail("media_source_bytes_changed");
  return normalizeNewsMedia(bytes, response.headers.get("content-type"));
}

export async function readNewsMediaBytes(descriptor) {
  if (!hash(descriptor?.sha256) || descriptor.profile !== NEWS_MEDIA_PROFILE || descriptor.mime !== "image/jpeg"
    || !Number.isSafeInteger(descriptor.byteLength) || descriptor.byteLength < 1 || descriptor.byteLength > NEWS_MEDIA_LIMITS.outputBytes)
    fail("media_cache_descriptor_invalid");
  const file = await open(new URL(`${descriptor.sha256}.jpg`, cacheRoot), "r");
  try {
    if ((await file.stat()).size !== descriptor.byteLength) fail("media_cache_size_changed");
    const bytes = Buffer.alloc(descriptor.byteLength + 1);
    let offset = 0;
    while (offset < bytes.length) { const read = await file.read(bytes, offset, bytes.length - offset, offset); if (!read.bytesRead) break; offset += read.bytesRead; }
    const result = bytes.subarray(0, offset);
    if (offset !== descriptor.byteLength || mediaByteHash(result) !== descriptor.sha256) fail("media_cache_bytes_changed");
    return result;
  } finally { await file.close(); }
}
const equalDescriptor = (a, b) => ["sha256", "byteLength", "mime", "width", "height", "profile"].every((key) => a?.[key] === b?.[key]);
function mediaAttribution(asset) {
  if (asset.license !== "CC-BY-4.0") return asset.credit;
  const author = asset.credit.includes(asset.author) ? "" : ` Автор: ${asset.author}.`;
  return `${asset.credit}${author} CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ . `
    + "Обработка: ориентация, уменьшение при необходимости, JPEG и удаление метаданных; без кадрирования.";
}

/** Preparation is separate from delivery. A reviewed derivative hash is mandatory;
 * changed source bytes or renderer output never silently produce a new attachment.
 */
export async function prepareRegisteredNewsMedia(destinations, { registry: assets = registry, now = new Date(), fetchImpl } = {}) {
  if (!Array.isArray(assets.assets) || assets.assets.length > NEWS_MEDIA_LIMITS.registryAssets) fail("media_registry_invalid");
  const outcomes = [];
  for (const asset of assets.assets) {
    if (!destinations.some((destination) => { try { checkedNewsMediaAsset(asset, destination, asset.newsIds?.[0], now); return true; } catch { return false; } })) continue;
    try {
      try { await readNewsMediaBytes(asset.derivative); outcomes.push({ assetId: asset.id, status: "cached" }); continue; } catch { /* Rebuild the exact reviewed derivative. */ }
      const normalized = await downloadNewsMediaAsset(asset, { registry: assets, fetchImpl });
      if (!equalDescriptor(normalized.descriptor, asset.derivative)) fail("media_derivative_requires_review");
      await mkdir(cacheRoot, { recursive: true });
      const target = new URL(`${normalized.descriptor.sha256}.jpg`, cacheRoot);
      const temporary = new URL(`${normalized.descriptor.sha256}.${process.pid}.tmp`, cacheRoot);
      await writeFile(temporary, normalized.bytes); await rename(temporary, target);
      outcomes.push({ assetId: asset.id, status: "prepared" });
    } catch (error) { outcomes.push({ assetId: asset.id, status: "fallback", reason: /^media_/.test(error.message) ? error.message : "media_preparation_unavailable" }); }
  }
  return outcomes;
}

export async function selectNewsMedia(newsId, destination, { registry: assets = registry, now = new Date(), readBytes = readNewsMediaBytes } = {}) {
  if (!destination) return { media: null, reason: "no_destination_licensed_asset" };
  if (!Array.isArray(assets.assets) || assets.assets.length>NEWS_MEDIA_LIMITS.registryAssets) fail("media_registry_invalid");
  const candidates = assets.assets.filter((asset) => Array.isArray(asset.newsIds) && asset.newsIds.includes(newsId));
  let reason = "no_destination_licensed_asset";
  for (const asset of candidates) try {
    checkedNewsMediaAsset(asset, destination, newsId, now);
    await readBytes(asset.derivative);
    return { media: { assetId: asset.id, ...asset.derivative, credit: mediaAttribution(asset), sourceUrl: asset.sourceUrl,
      sourceSha256: asset.sourceSha256, license: asset.license, licenseEvidenceUrl: asset.licenseEvidenceUrl,
      licenseEvidenceSha256: asset.licenseEvidenceSha256, checkedAt: asset.checkedAt, validUntil: asset.validUntil,
      entityEvidence: asset.entityEvidence, destination: { platform: destination.platform, id: destination.id } }, reason: null };
  } catch (error) { reason = /^media_/.test(error.message) ? error.message : "media_cache_unavailable"; }
  return { media: null, reason };
}

export async function validatePreparedNewsMedia(prepared, destination, { registry: assets = registry, now = new Date(), readBytes = readNewsMediaBytes } = {}) {
  const media = prepared.media;
  const asset = assets.assets.find((row) => row.id === media?.assetId);
  checkedNewsMediaAsset(asset, destination, prepared.newsId, now);
  if (!equalDescriptor(asset.derivative, media) || mediaAttribution(asset) !== media.credit
    || asset.sourceSha256 !== media.sourceSha256 || asset.licenseEvidenceSha256 !== media.licenseEvidenceSha256
    || media.destination?.platform !== destination.platform || media.destination?.id !== destination.id)
    fail("media_prepared_revision_invalid");
  const bytes = await readBytes(media);
  if (bytes.length !== media.byteLength || mediaByteHash(bytes) !== media.sha256) fail("media_cache_bytes_changed");
  return bytes;
}
