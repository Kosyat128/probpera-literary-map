import manifest from "../../data/news/article-thumbnails.json" with { type: "json" };

/** Display-only publisher metadata. This is never permission to upload an asset to social channels. */
export function newsArticleThumbnail(item, entries = manifest.items) {
  const entry = entries?.[item.id] || (item.provenance?.reviewKind === 'machineReviewed'
    ? item.provenance?.sourceEvidence?.thumbnail : null);
  if (!entry || entry.sourceUrl !== item.source.url || entry.displayOnly !== true
    || entry.socialReuseApproved !== false || !["og:image", "twitter:image"].includes(entry.method)
    || !/^[a-f0-9]{64}$/.test(entry.sourceDocumentSha256 || "")
    || !["ru", "en"].every(locale => typeof entry.alt?.[locale] === "string"
      && entry.alt[locale].trim() && entry.alt[locale].length <= 1000)) return null;
  if (!entries?.[item.id] && entry.sourceDocumentSha256 !== item.provenance?.sourceEvidence?.documentSha256) return null;
  try {
    const url = new URL(entry.imageUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port
      || url.href.length > 2048 || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,63}$/i.test(url.hostname)
      || /(?:^|\.)(?:localhost|local|internal|invalid|test)$/i.test(url.hostname)) return null;
    return { url: url.href, sourceUrl: entry.sourceUrl, alt: entry.alt, displayOnly: true };
  } catch { return null; }
}
