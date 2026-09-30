import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { newsArticleThumbnail } from './literary-news-thumbnails.mjs';
import { checkedNewsMediaAsset, normalizeNewsMedia, cacheNormalizedNewsMedia,
  mediaByteHash, NEWS_MEDIA_LIMITS, NEWS_MEDIA_CC_LICENSES } from './literary-news-media.mjs';

const fail = code => { throw Error(code); };
export const commonsNewsImageText = value => {
  const $ = load(String(value || '')); $('script,style').remove();
  return $.text().replace(/\s+/g, ' ').trim();
};
export function acceptedCommonsNewsImageLicense(meta) {
  const short = commonsNewsImageText(meta.LicenseShortName?.value), usage = commonsNewsImageText(meta.UsageTerms?.value);
  if (/\b(?:NC|ND)\b/i.test(`${short} ${usage}`)) fail('media_discovery_license_unsupported');
  if (/^public domain$/i.test(short) && /^false$/i.test(commonsNewsImageText(meta.Copyrighted?.value))) return 'public-domain';
  const licenseUrl = commonsNewsImageText(meta.LicenseUrl?.value).replace(/^http:/, 'https:').replace(/\/$/, '');
  if (/^CC0(?: 1\.0)?$/i.test(short) && licenseUrl === 'https://creativecommons.org/publicdomain/zero/1.0') return 'CC0';
  for (const [license, profile] of Object.entries(NEWS_MEDIA_CC_LICENSES))
    if (short.toLowerCase() === profile.name.toLowerCase() && licenseUrl === profile.url.replace(/\/$/, '')) return license;
  fail('media_discovery_license_unsupported');
}

function exactHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && url.href === value ? url : null;
  } catch { return null; }
}

/** This only identifies a candidate. Neither an OG tag nor this URL parser grants reuse rights. */
export function inspectNewsSourceCommonsImage(item) {
  const held = reason => ({ status: 'held', reason });
  if (item?.verification !== 'confirmed' || !['news', 'announcement'].includes(item.kind)
    || !exactHttpsUrl(item.source?.url)) return held('media_source_association_invalid');
  const privateThumbnail = item.thumbnail === undefined ? newsArticleThumbnail(item, Object.create(null)) : null;
  const thumbnail = item.thumbnail || privateThumbnail;
  if (!thumbnail) return held('media_source_image_missing');
  if (thumbnail.displayOnly !== true || thumbnail.sourceUrl !== item.source.url
    || !['ru', 'en'].every(locale => typeof thumbnail.alt?.[locale] === 'string'
      && thumbnail.alt[locale].trim() && thumbnail.alt[locale].length <= 1000)) return held('media_source_association_invalid');
  const url = exactHttpsUrl(thumbnail.url);
  if (!url || url.search || url.hostname !== 'upload.wikimedia.org') return held('media_source_image_url_unsupported');
  const parts = url.pathname.split('/');
  const thumb = parts[3] === 'thumb', offset = thumb ? 4 : 3;
  if (parts[1] !== 'wikipedia' || parts[2] !== 'commons' || parts.length !== (thumb ? 8 : 6)
    || !/^[a-f0-9]$/.test(parts[offset]) || !/^[a-f0-9]{2}$/.test(parts[offset + 1])
    || !parts[offset + 1].startsWith(parts[offset])) return held('media_source_image_path_unsupported');
  let fileName;
  try { fileName = decodeURIComponent(parts[offset + 2]); } catch { return held('media_source_image_path_unsupported'); }
  if (!fileName || fileName.length > 240 || /[\u0000-\u001f\u007f/\\|<>\[\]{}#]/.test(fileName)
    || !/\.(?:jpe?g|png|webp)$/i.test(fileName)) return held('media_source_image_path_unsupported');
  let width = null;
  if (thumb) {
    let last;
    try { last = decodeURIComponent(parts[7]); } catch { return held('media_source_image_path_unsupported'); }
    const match = /^([1-9]\d{1,3})px-(.+)$/u.exec(last);
    if (!match || match[2] !== fileName || Number(match[1]) > 8000) return held('media_source_image_path_unsupported');
    width = Number(match[1]);
  }
  const sourceDocumentSha256 = privateThumbnail ? item.provenance.sourceEvidence.documentSha256 : null;
  const candidate = { sourceUrl: item.source.url, imageUrl: url.href,
    originalUrl: `${url.origin}/wikipedia/commons/${parts[offset]}/${parts[offset + 1]}/${parts[offset + 2]}`,
    fileName, fileTitle: `File:${fileName}`, width, sourceDocumentSha256,
    associationMethod: privateThumbnail ? 'verified-source-document-thumbnail' : 'approved-public-source-thumbnail' };
  return { status: 'candidate', candidate, revision: mediaByteHash(Buffer.from(JSON.stringify(candidate))) };
}

/** Exact API original/thumbnail identity is checked before fetching any image bytes.
 * A thumbnail identifies its original raster; download that SHA-1 verified original
 * and apply the same no-crop JPEG normalization used by existing approved assets.
 */
export async function discoverNewsSourceCommonsImage({ item, candidate, revision, semanticRevision, destinations, now, request }) {
  const commonsUrl = new URL('https://commons.wikimedia.org/w/api.php');
  commonsUrl.search = new URLSearchParams({ action: 'query', prop: 'imageinfo', titles: candidate.fileTitle,
    iiprop: 'url|extmetadata|mime|size|sha1', formatversion: '2', format: 'json',
    ...(candidate.width ? { iiurlwidth: String(candidate.width) } : {}) });
  const commonsResponse = await request(commonsUrl.href, 524288, ['commons.wikimedia.org']);
  const pages = JSON.parse(commonsResponse.bytes).query?.pages;
  if (!Array.isArray(pages) || pages.length !== 1 || typeof pages[0].title !== 'string'
    || pages[0].title.replaceAll('_', ' ') !== candidate.fileTitle.replaceAll('_', ' ')
    || pages[0].missing || pages[0].invalid || pages[0].imageinfo?.length !== 1) fail('media_source_commons_identity_invalid');
  const info = pages[0].imageinfo[0];
  if (info.url !== candidate.originalUrl || !exactHttpsUrl(info.url)
    || candidate.width && info.thumburl !== candidate.imageUrl
    || !candidate.width && info.url !== candidate.imageUrl) fail('media_source_commons_identity_invalid');
  const meta = info.extmetadata || {}, license = acceptedCommonsNewsImageLicense(meta), author = commonsNewsImageText(meta.Artist?.value);
  if (!author || author.length > 400 || !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)
    || !Number.isSafeInteger(info.size) || info.size < 1 || info.size > NEWS_MEDIA_LIMITS.sourceBytes) fail('media_commons_metadata_incomplete');
  const image = await request(info.url, NEWS_MEDIA_LIMITS.sourceBytes, ['upload.wikimedia.org']);
  const sha1 = createHash('sha1').update(image.bytes).digest('hex');
  if (image.bytes.length !== info.size || ![sha1, BigInt(`0x${sha1}`).toString(36).padStart(31, '0')].includes(info.sha1)
    || image.mime?.split(';')[0].trim().toLowerCase() !== info.mime) fail('media_commons_bytes_changed');
  const normalized = await normalizeNewsMedia(image.bytes, image.mime);
  const evidenceUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(candidate.fileName)}`;
  const materialTitle = commonsNewsImageText(meta.ObjectName?.value || candidate.fileName);
  const materialUrl = Number.isSafeInteger(pages[0].pageid) && pages[0].pageid > 0
    ? `https://commons.wikimedia.org/?curid=${pages[0].pageid}` : evidenceUrl;
  const copyrightNotice = commonsNewsImageText(meta.Copyright?.value || `© ${author}`);
  const licenseNotices = [commonsNewsImageText(meta.Attribution?.value), commonsNewsImageText(meta.Disclaimer?.value)].filter(Boolean).join(' ');
  const validUntil = new Date(now.getTime() + 30 * 86400000).toISOString();
  const hasDocumentProof = candidate.associationMethod === 'verified-source-document-thumbnail' && candidate.sourceDocumentSha256;
  const associationEvidence = hasDocumentProof
    ? `Exact Commons file ${candidate.fileTitle} used by the reviewed source document ${candidate.sourceDocumentSha256} at ${candidate.sourceUrl}: ${candidate.imageUrl}.`
    : `Exact Commons file ${candidate.fileTitle} for the reviewed news thumbnail associated with ${candidate.sourceUrl}: ${candidate.imageUrl}.`;
  const creditLabel = hasDocumentProof ? 'Из материала' : 'Изображение к новости';
  const asset = { id: `source-${semanticRevision.slice(0, 32)}-${revision.slice(0, 12)}`, status: 'approved',
    newsIds: [item.id], sourceUrl: info.url, sourceSha256: mediaByteHash(image.bytes), subject: 'editorial', mediaRole: 'source-image',
    entityEvidence: `${associationEvidence} No inference about people or the event depicted.`,
    sourceImageEvidence: { ...candidate }, author, rightsholder: author,
    credit: NEWS_MEDIA_CC_LICENSES[license]
      ? `${creditLabel}: «${materialTitle}». ${copyrightNotice}. ${licenseNotices} Wikimedia Commons: ${materialUrl}.`
      : `${creditLabel}: «${materialTitle}». ${author}. Wikimedia Commons: ${materialUrl}.`, license,
    ...(NEWS_MEDIA_CC_LICENSES[license] ? { materialTitle, materialUrl, copyrightNotice, derivativeLicense: license, additionalRestrictions: false } : {}),
    licenseEvidenceUrl: evidenceUrl, licenseEvidenceSha256: mediaByteHash(commonsResponse.bytes), checkMethod: 'license-page',
    checkedAt: now.toISOString(), validUntil, transformations: { resize: true, metadataRemoval: true, reencode: true, crop: false },
    permissions: destinations.map(d => ({ platform: d.platform, destinationId: d.id, publish: true, providerProcessing: true, evidenceUrl })),
    derivative: normalized.descriptor };
  for (const destination of destinations) checkedNewsMediaAsset(asset, destination, item.id, now);
  await cacheNormalizedNewsMedia(normalized);
  return { status: 'approved', reason: 'exact_source_commons_image', nextCheckAt: validUntil, asset,
    evidence: { sourceImage: { ...candidate }, commonsApiUrl: commonsUrl.href,
      commonsSha256: mediaByteHash(commonsResponse.bytes), fileTitle: candidate.fileTitle,
      metadata: { Artist: author, LicenseShortName: commonsNewsImageText(meta.LicenseShortName?.value),
        UsageTerms: commonsNewsImageText(meta.UsageTerms?.value).slice(0, 2000), Copyrighted: commonsNewsImageText(meta.Copyrighted?.value),
        LicenseUrl: commonsNewsImageText(meta.LicenseUrl?.value) } } };
}
