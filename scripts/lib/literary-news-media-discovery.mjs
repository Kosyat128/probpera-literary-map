import { createHash } from "node:crypto";
import manualRegistry from "../../data/news/social-media-assets.json" with { type: "json" };
import newsLimits from "../../data/news/contract.json" with { type: "json" };
import { fetchPinnedNewsSource } from "./literary-news-safe-fetch.mjs";
import { matchNewsMediaSubjects, extractNewsMediaSubjectSearchCandidates } from "./literary-news-media-subjects.mjs";
import { newsSemanticRevision } from "./literary-news-social.mjs";
import { checkedNewsMediaAsset, normalizeNewsMedia, cacheNormalizedNewsMedia, mediaByteHash, NEWS_MEDIA_LIMITS, NEWS_MEDIA_DISCOVERY_POLICY, NEWS_MEDIA_CC_LICENSES } from "./literary-news-media.mjs";
import { inspectNewsSourceCommonsImage, discoverNewsSourceCommonsImage,
  acceptedCommonsNewsImageLicense as acceptedLicense, commonsNewsImageText as plain } from './literary-news-source-image.mjs';

export const NEWS_MEDIA_DISCOVERY_LIMITS = Object.freeze({ news: 8, requests: 24, metadataBytes: 524288,
  negativeDays: 14, rightsDays: 30 });
const fail = code => { throw Error(code); };
// Labels verified against the official Wikidata API: writer, poet, author,
// novelist, playwright, essayist. No broad entertainer/person inference.
const literaryOccupations = new Set(["Q36180","Q49757","Q482980","Q6625963","Q214917","Q11774202"]);
const normalizedName = value => String(value || "").normalize("NFKC").replace(/[‘’]/g,"'").replace(/\s+/g," ").trim().toLowerCase();
const discoveryReason = error => /^media_[a-z_]+$/.test(error.message) ? error.message : 'media_discovery_unavailable';
const discoveryPending = reason => ['media_discovery_request_budget', 'media_discovery_unavailable', 'media_discovery_response_invalid'].includes(reason);
function fixedUrl(input, hosts) {
  const url = new URL(input);
  if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.port || url.username || url.password || url.hash)
    fail("media_discovery_url_rejected");
  return url;
}
async function responseBytes(response, max) {
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > max) fail("media_discovery_response_invalid");
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break;
    size += value.length; if (size > max) fail("media_discovery_response_too_large"); chunks.push(Buffer.from(value)); }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
const claimValues = (claims, property) => {
  const all = (claims?.[property] || []).filter(row => row.rank !== "deprecated" && row.mainsnak?.snaktype === "value");
  const preferred = all.filter(row => row.rank === "preferred");
  return [...new Set((preferred.length ? preferred : all).map(row => row.mainsnak.datavalue?.value))];
};

/** Independently licensed exact Commons source images precede writer portraits.
 * P18 remains a portrait, never evidence of a photograph of the reported event.
 */
export async function resolveNewsMediaBatch(items, destinations, { store = null, registry = manualRegistry,
  now = new Date(), fetchImpl = fetchPinnedNewsSource, matchSubjects = matchNewsMediaSubjects,
  searchCandidates = extractNewsMediaSubjectSearchCandidates,
  maxNews = NEWS_MEDIA_DISCOVERY_LIMITS.news } = {}) {
  if (!Array.isArray(items) || items.length > newsLimits.maxItems || !Array.isArray(registry?.assets)
    || registry.assets.length > NEWS_MEDIA_LIMITS.registryAssets || !Number.isSafeInteger(maxNews) || maxNews < 0 || maxNews > 8)
    fail("media_discovery_input_invalid");
  const cached = new Map();
  if (store) for (const row of await store.list("history:media:")) {
    if (row.state?.semanticRevision) cached.set(row.state.semanticRevision, row);
  }
  const dynamic = [], resolutions = {}, report = { inspected: 0, requests: 0, cached: 0, approved: 0, held: 0, pending: 0, outcomes: [] };
  const request = async (input, max, hosts) => {
    const url = fixedUrl(input, hosts);
    if (report.requests >= NEWS_MEDIA_DISCOVERY_LIMITS.requests) fail("media_discovery_request_budget");
    report.requests++;
    const response = await fetchImpl(url.href, { redirect: "error", timeoutMs: 12000, maxResponseBytes: max,
      signal: AbortSignal.timeout(12000), headers: { Accept: "application/json,image/jpeg,image/png,image/webp",
        "User-Agent": "ProbperaLiteraryNewsMedia/1.0 (+https://probpera.ru)" } });
    return { bytes: await responseBytes(response, max), mime: response.headers.get("content-type") };
  };
  const freshSubject = async item => {
    const hints = searchCandidates(item);
    if (!Array.isArray(hints) || !hints.length || hints.length > 4) fail("media_subject_unmatched");
    const exact = new Map(), searches = [];
    for (const hint of hints) {
      if (typeof hint.query !== "string" || hint.query.length > 160 || hint.matchedField !== "title.en"
        || !normalizedName(item.title?.en).includes(normalizedName(hint.query))) fail("media_subject_unmatched");
      const url = new URL("https://www.wikidata.org/w/api.php");
      url.search = new URLSearchParams({ action:"wbsearchentities",search:hint.query,language:"en",uselang:"en",type:"item",limit:"5",format:"json" });
      const response = await request(url.href,NEWS_MEDIA_DISCOVERY_LIMITS.metadataBytes,["www.wikidata.org"]);
      const body = JSON.parse(response.bytes);
      if (!Array.isArray(body.search) || body.search.length > 5 || body["search-continue"] !== undefined) fail("media_subject_search_ambiguous");
      searches.push({query:hint.query,url:url.href,sha256:mediaByteHash(response.bytes)});
      for (const result of body.search) if (/^Q[1-9]\d{0,11}$/.test(result.id || "")
        && [result.label,result.match?.text].some(value=>normalizedName(value)===normalizedName(hint.query))) {
        const queries=exact.get(result.id)||[];queries.push(hint.query);exact.set(result.id,queries);
      }
    }
    if (!exact.size || exact.size > 5) fail("media_subject_search_ambiguous");
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.search = new URLSearchParams({action:"wbgetentities",ids:[...exact.keys()].join("|"),props:"claims|labels|aliases",languages:"en",format:"json"});
    const response=await request(url.href,NEWS_MEDIA_DISCOVERY_LIMITS.metadataBytes,["www.wikidata.org"]),entities=JSON.parse(response.bytes).entities;
    const qualified=[];
    for(const [qid,queries] of exact){const entity=entities?.[qid];
      const labels=[entity?.labels?.en?.value,...(entity?.aliases?.en||[]).map(a=>a.value)];
      const human=entity?.claims?.P31?.some(c=>c.rank!=="deprecated"&&c.mainsnak?.datavalue?.value?.id==="Q5");
      const occupations=(entity?.claims?.P106||[]).filter(c=>c.rank!=="deprecated").map(c=>c.mainsnak?.datavalue?.value?.id).filter(q=>literaryOccupations.has(q));
      if(entity?.id===qid&&human&&occupations.length&&labels.some(label=>queries.some(query=>normalizedName(label)===normalizedName(query))))
        qualified.push({entity,subject:{qid,name:entity.labels?.en?.value||queries[0],matchedField:"title.en",
          evidence:{method:"exact-fresh-wikidata-name-human-literary-occupation",queries,occupations,searches,entitySha256:mediaByteHash(response.bytes)}}});
    }
    if(qualified.length!==1)fail("media_subject_search_ambiguous");
    return{...qualified[0],entityUrl:url,entityResponse:response};
  };
  const admitCached = (state, item, sourceImage) => {
    // The thumbnail is outside the message identity. A newly available exact
    // source image must receive its own rights check before a cached portrait.
    if (sourceImage.status === 'candidate' && state?.sourceImageRevision !== sourceImage.revision && maxNews > 0) return false;
    if (state?.reason === 'media_discovery_license_unsupported' && state.discoveryPolicy !== NEWS_MEDIA_DISCOVERY_POLICY) return false;
    if (state?.schemaVersion !== 1 || state.newsId !== item.id || !["approved", "held", "pending"].includes(state.status)
      || !Number.isFinite(Date.parse(state.checkedAt)) || Date.parse(state.checkedAt) > now.getTime()
      || !Number.isFinite(Date.parse(state.nextCheckAt)) || Date.parse(state.nextCheckAt) <= now.getTime()) return false;
    if (state.status === "approved") {
      try {
        if (!destinations.length || !destinations.every(d => checkedNewsMediaAsset(state.asset, d, item.id, now))) return false;
        if (state.asset.mediaRole === 'source-image' && (sourceImage.status !== 'candidate'
          || state.sourceImageRevision !== sourceImage.revision || state.asset.sourceUrl !== sourceImage.candidate.originalUrl
          || state.asset.sourceImageEvidence?.imageUrl !== sourceImage.candidate.imageUrl
          || state.asset.sourceImageEvidence?.sourceUrl !== item.source.url)) return false;
        fixedUrl(state.asset.sourceUrl, ["upload.wikimedia.org"]);
        if (!registry.assets.some(asset => asset.id === state.asset.id)) dynamic.push(state.asset);
      } catch { return false; }
    }
    resolutions[item.id] = { status: state.status, reason: state.reason || null };
    report.cached++; if (state.status === "pending") report.pending++; return true;
  };
  const ordered = await Promise.all(items.map(async(item,index)=>({item,index,sourceImage:inspectNewsSourceCommonsImage(item),
    semanticRevision:await newsSemanticRevision(item)})));
  // Transient failures expire sooner than a large feed can be inspected. Give
  // never-checked items first turn, then the least recently checked identities.
  ordered.sort((a,b)=>{
    const left=cached.get(a.semanticRevision)?.state,right=cached.get(b.semanticRevision)?.state;
    return Number(Boolean(left))-Number(Boolean(right))
      || (Date.parse(left?.checkedAt)||0)-(Date.parse(right?.checkedAt)||0) || a.index-b.index;
  });
  for (const {item,semanticRevision,sourceImage} of ordered) {
    const manual = registry.assets.find(asset => destinations.length && destinations.every(destination => {
      if (asset.mediaRole === 'source-image' && (sourceImage.status !== 'candidate'
        || asset.sourceUrl !== sourceImage.candidate.originalUrl || asset.sourceImageEvidence?.imageUrl !== sourceImage.candidate.imageUrl
        || asset.sourceImageEvidence?.sourceUrl !== item.source.url)) return false;
      try { checkedNewsMediaAsset(asset, destination, item.id, now); return true; } catch { return false; }
    }));
    if (manual && (sourceImage.status !== 'candidate' || manual.sourceUrl === sourceImage.candidate.originalUrl
      || report.inspected >= maxNews)) { resolutions[item.id] = { status: "approved", reason: "manual_registry" }; continue; }
    const key = `history:media:${semanticRevision}`, previous = cached.get(semanticRevision);
    if (admitCached(previous?.state, item, sourceImage)) continue;
    if (!destinations.length || report.inspected >= maxNews) {
      resolutions[item.id] = { status: "pending", reason: "media_discovery_budget" }; report.pending++; continue;
    }
    report.inspected++;
    let state = { schemaVersion: 1, discoveryPolicy: NEWS_MEDIA_DISCOVERY_POLICY, newsId: item.id, semanticRevision, status: "held", checkedAt: now.toISOString(),
      nextCheckAt: new Date(now.getTime() + 14 * 86400000).toISOString(), reason: null,
      sourceImageRevision: sourceImage.revision || null, sourceImage: { status: 'held', reason: sourceImage.reason || null } };
    try {
      if (sourceImage.status === 'candidate') {
        try {
          state = { ...state, ...await discoverNewsSourceCommonsImage({ item, candidate: sourceImage.candidate,
            revision: sourceImage.revision, semanticRevision, destinations, now, request }),
          sourceImage: { status: 'approved', reason: 'exact_source_commons_image' } };
        } catch (error) {
          const reason = discoveryReason(error);
          state.sourceImage = { status: discoveryPending(reason) ? 'pending' : 'held', reason };
          if (reason === 'media_discovery_request_budget' && !manual) throw error;
        }
      }
      if (state.status !== 'approved' && manual) state = { ...state, status: 'approved', reason: 'manual_registry',
        asset: manual, nextCheckAt: manual.validUntil };
      if (state.status !== 'approved') {
      const subjects = matchSubjects(item);
      if (!Array.isArray(subjects) || subjects.length > 1) fail("media_subject_ambiguous");
      const fresh = subjects.length ? null : await freshSubject(item);
      const subject = subjects[0] || fresh.subject;
      if (!/^Q[1-9]\d{0,11}$/.test(subject.qid || "") || typeof subject.name !== "string" || !subject.name.trim()
        || subject.name.length > 200 || !/^(title|summary)\.(ru|en)$/.test(subject.matchedField || "")) fail("media_subject_unmatched");
      const entityUrl = fresh?.entityUrl || new URL("https://www.wikidata.org/w/api.php");
      if (!fresh) entityUrl.search = new URLSearchParams({ action: "wbgetentities", ids: subject.qid, props: "claims|labels|aliases", languages:"en|ru", format: "json" });
      const entityResponse = fresh?.entityResponse || await request(entityUrl.href, NEWS_MEDIA_DISCOVERY_LIMITS.metadataBytes, ["www.wikidata.org"]);
      const entity = fresh?.entity || JSON.parse(entityResponse.bytes).entities?.[subject.qid];
      if (entity?.id !== subject.qid || !(entity.claims?.P31 || []).some(c => c.rank !== "deprecated" && c.mainsnak?.datavalue?.value?.id === "Q5")) fail("media_subject_not_human");
      if (!fresh) {
        const aliases=[subject.name,subject.evidence?.matchedName,...Object.values(entity.labels||{}).map(value=>value.value),
          ...Object.values(entity.aliases||{}).flatMap(values=>Array.isArray(values)?values.map(value=>value.value):[])].map(normalizedName);
        if (searchCandidates(item).some(hint=>!aliases.includes(normalizedName(hint.query)))) fail("media_subject_ambiguous");
      }
      const images = claimValues(entity.claims, "P18");
      if (images.length !== 1 || typeof images[0] !== "string" || images[0].length > 240) fail("media_portrait_missing_or_ambiguous");
      const fileTitle = `File:${images[0]}`, commonsUrl = new URL("https://commons.wikimedia.org/w/api.php");
      commonsUrl.search = new URLSearchParams({ action: "query", prop: "imageinfo", titles: fileTitle,
        iiprop: "url|extmetadata|mime|size|sha1", formatversion: "2", format: "json" });
      const commonsResponse = await request(commonsUrl.href, NEWS_MEDIA_DISCOVERY_LIMITS.metadataBytes, ["commons.wikimedia.org"]);
      const pages = JSON.parse(commonsResponse.bytes).query?.pages;
      if (!Array.isArray(pages) || pages.length !== 1 || pages[0].title?.replaceAll("_", " ") !== fileTitle.replaceAll("_", " ")
        || pages[0].missing || pages[0].imageinfo?.length !== 1) fail("media_commons_identity_invalid");
      const info = pages[0].imageinfo[0], meta = info.extmetadata || {}, license = acceptedLicense(meta);
      const author = plain(meta.Artist?.value);
      if (!author || author.length > 400 || !["image/jpeg", "image/png", "image/webp"].includes(info.mime)
        || !Number.isSafeInteger(info.size) || info.size < 1 || info.size > NEWS_MEDIA_LIMITS.sourceBytes) fail("media_commons_metadata_incomplete");
      const sourceUrl = fixedUrl(info.url, ["upload.wikimedia.org"]).href;
      const image = await request(sourceUrl, NEWS_MEDIA_LIMITS.sourceBytes, ["upload.wikimedia.org"]);
      const sha1 = createHash("sha1").update(image.bytes).digest("hex");
      if (![sha1,BigInt(`0x${sha1}`).toString(36).padStart(31,"0")].includes(info.sha1)
        || image.mime?.split(";")[0].trim().toLowerCase() !== info.mime) fail("media_commons_bytes_changed");
      const normalized = await normalizeNewsMedia(image.bytes, image.mime);
      const evidenceUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(images[0])}`;
      const materialTitle = plain(meta.ObjectName?.value || images[0]);
      const materialUrl = Number.isSafeInteger(pages[0].pageid) && pages[0].pageid > 0
        ? `https://commons.wikimedia.org/?curid=${pages[0].pageid}` : evidenceUrl;
      const copyrightNotice = plain(meta.Copyright?.value || `© ${author}`);
      const licenseNotices = [plain(meta.Attribution?.value), plain(meta.Disclaimer?.value)].filter(Boolean).join(' ');
      const validUntil = new Date(now.getTime() + 30 * 86400000).toISOString();
      const asset = { id: `auto-${semanticRevision.slice(0,32)}`, status: "approved", newsIds: [item.id], sourceUrl,
        sourceSha256: mediaByteHash(image.bytes), subject: "portrait",
        entityEvidence: `Portrait of ${subject.name} (${subject.qid}), exact reviewed name in ${subject.matchedField}; Wikidata P18 ${fileTitle}. This is a portrait, not a photograph of the news event.`,
        author, rightsholder: author, credit: NEWS_MEDIA_CC_LICENSES[license]
          ? `Архивный портрет: ${subject.name}. «${materialTitle}». ${copyrightNotice}. ${licenseNotices} Wikimedia Commons: ${materialUrl}.`
          : `Портрет: ${subject.name}. ${author}. Wikimedia Commons.`, license,
        ...(NEWS_MEDIA_CC_LICENSES[license] ? { materialTitle, materialUrl, copyrightNotice,
          derivativeLicense: license, additionalRestrictions: false } : {}),
        licenseEvidenceUrl: evidenceUrl, licenseEvidenceSha256: mediaByteHash(commonsResponse.bytes), checkMethod: "license-page",
        checkedAt: now.toISOString(), validUntil, transformations: { resize: true, metadataRemoval: true, reencode: true, crop: false },
        permissions: destinations.map(d => ({ platform: d.platform, destinationId: d.id, publish: true, providerProcessing: true, evidenceUrl })),
        derivative: normalized.descriptor };
      for (const destination of destinations) checkedNewsMediaAsset(asset, destination, item.id, now);
      await cacheNormalizedNewsMedia(normalized);
      state = { ...state, status: "approved", reason: "exact_reviewed_writer_p18", nextCheckAt: validUntil, asset,
        evidence: { subject, entityUrl: entityUrl.href, entitySha256: mediaByteHash(entityResponse.bytes),
          commonsApiUrl: commonsUrl.href, commonsSha256: mediaByteHash(commonsResponse.bytes), fileTitle,
          metadata: { Artist: author, LicenseShortName: plain(meta.LicenseShortName?.value), UsageTerms: plain(meta.UsageTerms?.value).slice(0,2000),
            Copyrighted: plain(meta.Copyrighted?.value), LicenseUrl: plain(meta.LicenseUrl?.value) } } };
      }
    } catch (error) {
      state.reason = discoveryReason(error);
      if (discoveryPending(state.reason)) {
        state.status = "pending"; state.nextCheckAt = new Date(now.getTime() + 3600000).toISOString();
      }
    }
    // A usable portrait is a fallback, not a month-long negative decision about
    // the article's own photo. Retry transient source-image failures in one hour.
    if (state.status === 'approved' && state.asset.mediaRole !== 'source-image' && state.sourceImage.status === 'pending')
      state.nextCheckAt = new Date(Math.min(Date.parse(state.nextCheckAt), now.getTime() + 3600000)).toISOString();
    if (store) {
      const result = await store.compareAppend(key, previous?.id || null, state);
      if (!result.applied) { resolutions[item.id] = { status: "pending", reason: "media_discovery_cache_conflict" }; report.pending++; continue; }
    }
    if (state.status === "approved") { if (!registry.assets.some(asset => asset.id === state.asset.id)) dynamic.push(state.asset); report.approved++; }
    else if (state.status === "held") report.held++; else report.pending++;
    resolutions[item.id] = { status: state.status, reason: state.reason, sourceImage: state.sourceImage };
    report.outcomes.push({ newsId: item.id, status: state.status, reason: state.reason, sourceImage: state.sourceImage });
  }
  // Admissions outlive the current feed. Preserve their still-valid cached
  // portrait metadata, without preferring an old revision over a current item.
  const currentIds = new Set(items.map(item => item.id)), archived = [];
  // Cached admissions can refer to an older snapshot of a manual asset. The
  // current rights registry and current-item resolutions own those identities.
  const suppliedAssetIds = new Set([...registry.assets, ...dynamic].map(asset => asset.id));
  for (const { state } of cached.values()) if (state?.status === "approved" && !currentIds.has(state.newsId)) {
    if (suppliedAssetIds.has(state.asset?.id)) continue;
    try { if (destinations.every(d => checkedNewsMediaAsset(state.asset,d,state.newsId,now))) {
      fixedUrl(state.asset.sourceUrl,["upload.wikimedia.org"]); archived.push(state.asset);
    } } catch { /* Expired rights remain held; a missing JPEG never changes an approved post into text. */ }
  }
  const assets = [...dynamic.filter(asset => asset.mediaRole === 'source-image'), ...registry.assets,
    ...dynamic.filter(asset => asset.mediaRole !== 'source-image'), ...archived];
  if (assets.length > NEWS_MEDIA_LIMITS.registryAssets) fail("media_registry_capacity");
  return { mediaOptions: { registry: { ...registry, assets, downloadHosts: [...new Set([...(registry.downloadHosts || []), "upload.wikimedia.org"])] },
    now, deferBytes: true, resolutions }, report };
}
