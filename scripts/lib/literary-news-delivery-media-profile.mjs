import { newsDigest } from './literary-news-publication.mjs';
import { NEWS_MEDIA_LIMITS, NEWS_MEDIA_PROFILE, checkedNewsMediaAsset, mediaByteHash } from './literary-news-media-policy.mjs';

export const DELIVERY_MEDIA_INDEX_KEY = 'literary-news:v1:delivery-media:index';
export const DELIVERY_MEDIA_BYTES_PREFIX = 'literary-news:v1:delivery-media:jpeg:';
export const DELIVERY_MEDIA_INDEX_MAX_BYTES = 8 * 1024 * 1024;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fail = code => { throw Error(code); };
const projection = value => ({ schemaVersion: value.schemaVersion, assets: value.assets,
  downloadHosts: value.downloadHosts, generatedAt: value.generatedAt, uploads: value.uploads });

export function checkDeliveryMediaDescriptor(value) {
  if (!hash(value?.sha256) || value.profile !== NEWS_MEDIA_PROFILE || value.mime !== 'image/jpeg'
    || !Number.isSafeInteger(value.byteLength) || value.byteLength < 1 || value.byteLength > NEWS_MEDIA_LIMITS.outputBytes
    || !Number.isSafeInteger(value.width) || !Number.isSafeInteger(value.height)
    || Math.min(value.width, value.height) < 1
    || Math.max(value.width / value.height, value.height / value.width) > 20
    || Math.max(value.width, value.height) > NEWS_MEDIA_LIMITS.maxSide) fail('delivery_media_descriptor_invalid');
  return value;
}
export function checkDeliveryMediaBytes(bytes, descriptor) {
  checkDeliveryMediaDescriptor(descriptor);
  if (!Buffer.isBuffer(bytes) || bytes.length !== descriptor.byteLength || mediaByteHash(bytes) !== descriptor.sha256
    || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) fail('delivery_media_bytes_invalid');
  return bytes;
}
export async function makeDeliveryMediaIndex({ assets, downloadHosts = [], uploads, generatedAt }) {
  const value = { schemaVersion: 1, assets, downloadHosts, generatedAt, uploads };
  return { ...value, sha256: await newsDigest(projection(value)) };
}
export async function validateDeliveryMediaIndex(value, current = new Date()) {
  if (value?.schemaVersion !== 1 || !Array.isArray(value.assets) || value.assets.length > NEWS_MEDIA_LIMITS.registryAssets
    || new Set(value.assets.map(asset => asset.id)).size !== value.assets.length
    || !Array.isArray(value.downloadHosts) || value.downloadHosts.length > 32
    || value.downloadHosts.some(host => typeof host !== 'string' || !/^[a-z0-9.-]+$/.test(host))
    || !Array.isArray(value.uploads) || value.uploads.length > NEWS_MEDIA_LIMITS.registryAssets
    || !Number.isFinite(Date.parse(value.generatedAt)) || Date.parse(value.generatedAt) > current.getTime()
    || value.uploads.some(row => !hash(row.sha256) || !Number.isFinite(Date.parse(row.uploadedAt))
      || Date.parse(row.uploadedAt) > current.getTime())
    || !hash(value.sha256) || await newsDigest(projection(value)) !== value.sha256
    || Buffer.byteLength(JSON.stringify(value)) > DELIVERY_MEDIA_INDEX_MAX_BYTES) fail('delivery_media_index_invalid');
  for (const asset of value.assets) checkDeliveryMediaDescriptor(asset.derivative);
  return value;
}

/** A confirmed index refers only to already uploaded exact JPEG bytes. Source images
 * are not copied to Supabase Storage and unchanged hashes are not uploaded again. */
export async function syncDeliveryMedia({ storage, registry, destinations, now = new Date(),
  readBytes, maximumNewUploads = 32 }) {
  if (!Array.isArray(registry?.assets) || registry.assets.length > NEWS_MEDIA_LIMITS.registryAssets
    || typeof readBytes !== 'function' || !Number.isSafeInteger(maximumNewUploads)
    || maximumNewUploads < 0 || maximumNewUploads > 32) fail('delivery_media_input_invalid');
  const priorRaw = await storage.readIndex();
  const prior = priorRaw === null ? null : await validateDeliveryMediaIndex(priorRaw, now);
  const uploaded = new Map((prior?.uploads || []).map(row => [row.sha256, row.uploadedAt]));
  const candidates = new Map(), assets = [], outcomes = []; let uploadedCount = 0;
  for (const asset of registry.assets) {
    if (candidates.has(asset.id)) {
      if (await newsDigest(candidates.get(asset.id)) !== await newsDigest(asset)) fail('delivery_media_identity_conflict');
      continue;
    }
    candidates.set(asset.id, asset);
    if (!destinations.some(destination => destination.platform === 'telegram' && (() => {
      try { checkedNewsMediaAsset(asset, destination, asset.newsIds?.[0], now); checkDeliveryMediaDescriptor(asset.derivative); return true; }
      catch { return false; }
    })())) continue;
    const descriptor = asset.derivative, uploadedAt = uploaded.get(descriptor.sha256);
    if (uploadedAt && now.getTime() - Date.parse(uploadedAt) < 25 * 86400000) {
      assets.push(asset); outcomes.push({ assetId: asset.id, status: 'reused' }); continue;
    }
    if (uploadedCount >= maximumNewUploads) { outcomes.push({ assetId: asset.id, status: 'pending', reason: 'delivery_media_upload_budget' }); continue; }
    let bytes;
    try { bytes = checkDeliveryMediaBytes(await readBytes(descriptor), descriptor); }
    catch { outcomes.push({ assetId: asset.id, status: 'held', reason: 'delivery_media_bytes_unavailable' }); continue; }
    await storage.writeJpeg(descriptor.sha256, bytes); uploadedCount++;
    uploaded.set(descriptor.sha256, now.toISOString()); assets.push(asset); outcomes.push({ assetId: asset.id, status: 'uploaded' });
  }
  const hashes = new Set(assets.map(asset => asset.derivative.sha256));
  const uploads = [...uploaded].filter(([sha256]) => hashes.has(sha256)).map(([sha256, uploadedAt]) => ({ sha256, uploadedAt }));
  const index = await makeDeliveryMediaIndex({ assets, downloadHosts: registry.downloadHosts || [], uploads, generatedAt: now.toISOString() });
  await validateDeliveryMediaIndex(index, now);
  await storage.writeIndex(index);
  return { index, uploaded: uploadedCount, reused: outcomes.filter(row => row.status === 'reused').length, outcomes };
}
