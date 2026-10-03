import { createHash } from "node:crypto";
import registry from "../../data/news/social-media-assets.json" with { type: "json" };

export const NEWS_MEDIA_LIMITS = Object.freeze({ sourceBytes: 8 * 1024 * 1024, outputBytes: 2 * 1024 * 1024,
  pixels: 20_000_000, maxSide: 1600, minSide: 240, registryAssets: 5000 });
export const NEWS_MEDIA_PROFILE = "literary-news-photo-v1";
export const NEWS_MEDIA_DISCOVERY_POLICY = 'portrait-open-license-v3';
export const NEWS_MEDIA_CC_LICENSES = Object.freeze({
  'CC-BY-2.0': { name: 'CC BY 2.0', url: 'https://creativecommons.org/licenses/by/2.0/', shareAlike: false },
  'CC-BY-4.0': { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', shareAlike: false },
  'CC-BY-SA-3.0': { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/', shareAlike: true },
  'CC-BY-SA-4.0': { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/', shareAlike: true },
});
export const mediaByteHash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const fail = (code) => { throw new Error(code); };
export const newsMediaHttpsUrl = (input) => {
  try { const url = new URL(input); return url.protocol === "https:" && !url.username && !url.password
    && (!url.port || url.port === "443") ? url : null; } catch { return null; }
};
const httpsUrl = newsMediaHttpsUrl;

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
    || !["public-domain", "CC0", ...Object.keys(NEWS_MEDIA_CC_LICENSES), "explicit-permission", "owned"].includes(asset.license)
    || !httpsUrl(asset.licenseEvidenceUrl) || !hash(asset.licenseEvidenceSha256)
    || !["license-page", "written-permission", "ownership-record"].includes(asset.checkMethod)
    || !Number.isFinite(Date.parse(asset.checkedAt)) || Date.parse(asset.checkedAt) > now.getTime()
    || now.getTime() - Date.parse(asset.checkedAt) > 30 * 86400000
    || !Number.isFinite(Date.parse(asset.validUntil)) || Date.parse(asset.validUntil) <= now.getTime()
    || asset.transformations?.resize !== true || asset.transformations?.metadataRemoval !== true
    || asset.transformations?.reencode !== true || asset.transformations?.crop !== false)
    fail("media_rights_or_identity_unverified");
  if (['CC-BY-SA-4.0','CC-BY-SA-3.0','CC-BY-2.0'].includes(asset.license) && (asset.derivativeLicense !== asset.license
    || asset.additionalRestrictions !== false || !asset.materialTitle?.trim()
    || asset.materialTitle.length > 500 || !httpsUrl(asset.materialUrl)
    || !asset.copyrightNotice?.trim() || asset.copyrightNotice.length > 1200))
    fail('media_sharealike_terms_missing');
  if (!Array.isArray(asset.permissions) || asset.permissions.length>16 || !["telegram","vk"].includes(destination?.platform)
    || typeof destination?.id!=="string" || !/^-[1-9]\d{0,15}$/.test(destination.id)) fail("media_destination_not_licensed");
  const permission = asset.permissions.find((row) => row.platform === destination.platform && row.destinationId === destination.id);
  if (!permission || permission.publish !== true || permission.providerProcessing !== true
    || !httpsUrl(permission.evidenceUrl)) fail("media_destination_not_licensed");
  return asset;
}

export const equalDescriptor = (a, b) => ["sha256", "byteLength", "mime", "width", "height", "profile"].every((key) => a?.[key] === b?.[key]);
function mediaAttribution(asset) {
  const cc = NEWS_MEDIA_CC_LICENSES[asset.license];
  if (['CC-BY-SA-4.0','CC-BY-SA-3.0','CC-BY-2.0'].includes(asset.license)) return `${asset.credit} `
    + [asset.materialTitle, asset.copyrightNotice, asset.author, asset.materialUrl]
      .filter(value => !asset.credit.includes(value)).map(value => `${value}. `).join('')
    + `${cc.name}: ${cc.url} . `
    + 'Обработка: ориентация, уменьшение, JPEG и удаление метаданных; без кадрирования. '
    + `Обработанное изображение распространяется по ${cc.name}; дополнительных ограничений нет.`;
  if (asset.license !== "CC-BY-4.0") return asset.credit;
  const author = asset.credit.includes(asset.author) ? "" : ` Автор: ${asset.author}.`;
  return `${asset.credit}${author} CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ . `
    + "Обработка: ориентация, уменьшение при необходимости, JPEG и удаление метаданных; без кадрирования.";
}

/** Keep the complete rights record above; the caption links to its source.
 * Only remove the discovery formatter's known wrapper. Unfamiliar notices are
 * retained verbatim, including custom attribution and disclaimer requirements.
 */
function captionAttribution(asset) {
  const cc = NEWS_MEDIA_CC_LICENSES[asset.license];
  // A portrait can be a painting. Keep the owner's approved neutral label.
  const label = "Изображение";
  const url = httpsUrl(asset.materialUrl) ? asset.materialUrl : asset.licenseEvidenceUrl;
  let text = label;
  const entities = [{ type: "text_link", offset: 0, length: label.length, url }];
  // The approved Aksakov post uses this concise attribution unchanged.
  if (!cc) return { text: `${label}: ${asset.credit}`, entities };
  const copyright = asset.copyrightNotice || `© ${asset.author}`;
  text += `: ${copyright}${copyright.includes(asset.author) ? "" : ` · ${asset.author}`}`;
  let notices = asset.credit;
  const titleMarker = `«${asset.materialTitle}». `;
  const titleAt = notices.indexOf(titleMarker);
  const commonsSuffix = `Wikimedia Commons: ${asset.materialUrl}.`;
  if (/^(Архивный портрет|Из материала|Изображение к новости): /u.test(notices)
    && titleAt >= 0 && notices.endsWith(commonsSuffix)) {
    notices = notices.slice(titleAt + titleMarker.length, -commonsSuffix.length).trim();
    if (notices.startsWith(`${copyright}.`)) notices = notices.slice(copyright.length + 1).trim();
    if (notices === asset.author || notices === `${asset.author}.`) notices = "";
  }
  if (notices && notices !== copyright && notices !== asset.author) text += ` · ${notices}`;
  text += " · ";
  entities.push({ type: "text_link", offset: text.length, length: cc.name.length, url: cc.url });
  // All admitted derivatives are resized/reencoded. A short modification notice
  // replaces the implementation details (JPEG, orientation and metadata).
  text += `${cc.name} · адаптировано`;
  return { text, entities };
}

function equalCaptionAttribution(left, right) {
  return left?.text === right?.text && left?.entities?.length === right?.entities?.length
    && left.entities.every((entity, index) => ["type", "offset", "length", "url"]
      .every(key => entity[key] === right.entities[index]?.[key]));
}


const missingMediaBytes = async () => { throw new Error("media_cache_unavailable"); };

export async function selectNewsMedia(newsId, destination, { registry: assets = registry, now = new Date(), readBytes = missingMediaBytes, deferBytes = false } = {}) {
  if (!destination) return { media: null, reason: "no_destination_licensed_asset" };
  if (!Array.isArray(assets.assets) || assets.assets.length>NEWS_MEDIA_LIMITS.registryAssets) fail("media_registry_invalid");
  const candidates = assets.assets.filter((asset) => Array.isArray(asset.newsIds) && asset.newsIds.includes(newsId));
  let reason = "no_destination_licensed_asset";
  for (const asset of candidates) try {
    checkedNewsMediaAsset(asset, destination, newsId, now);
    if (!deferBytes) await readBytes(asset.derivative);
    return { media: { assetId: asset.id, ...asset.derivative, credit: mediaAttribution(asset),
      captionAttribution: captionAttribution(asset), sourceUrl: asset.sourceUrl,
      sourceSha256: asset.sourceSha256, license: asset.license, licenseEvidenceUrl: asset.licenseEvidenceUrl,
      licenseEvidenceSha256: asset.licenseEvidenceSha256, checkedAt: asset.checkedAt, validUntil: asset.validUntil,
      entityEvidence: asset.entityEvidence, destination: { platform: destination.platform, id: destination.id } }, reason: null };
  } catch (error) { reason = /^media_/.test(error.message) ? error.message : "media_cache_unavailable"; }
  return { media: null, reason };
}

export async function validatePreparedNewsMedia(prepared, destination, { registry: assets = registry, now = new Date(), readBytes = missingMediaBytes } = {}) {
  const media = prepared.media;
  if (!Array.isArray(assets?.assets) || assets.assets.length > NEWS_MEDIA_LIMITS.registryAssets) fail("media_registry_invalid");
  const asset = assets.assets.find((row) => row.id === media?.assetId);
  checkedNewsMediaAsset(asset, destination, prepared.newsId, now);
  if (!equalDescriptor(asset.derivative, media) || mediaAttribution(asset) !== media.credit
    || media.captionAttribution && !equalCaptionAttribution(captionAttribution(asset), media.captionAttribution)
    || asset.sourceSha256 !== media.sourceSha256 || asset.licenseEvidenceSha256 !== media.licenseEvidenceSha256
    || media.destination?.platform !== destination.platform || media.destination?.id !== destination.id)
    fail("media_prepared_revision_invalid");
  const bytes = await readBytes(media);
  if (bytes.length !== media.byteLength || mediaByteHash(bytes) !== media.sha256) fail("media_cache_bytes_changed");
  return bytes;
}
