import { load } from 'cheerio';
import { createNewsService } from './literary-news-feed.mjs';
import { LITERARY_NEWS_SOURCES } from './literary-news-sources.mjs';
import { canonicalUrl, selectReviewed } from './literary-news-reviewed.mjs';

export const DAILY_NEWS_INTAKE_CONTRACT = 'literary-news-daily-intake-v2';
export const DAILY_NEWS_INTAKE_LIMITS = Object.freeze({ sources:32, details:30, maximumSources:48,
  maximumDetails:40, rotationMinutes:30, publicationAgeDays:7 });
const plain = value => String(value || '').replace(/\s+/g, ' ').trim();
export async function dailyNewsIntakePool(entries,worker,concurrency=4) {
  if(!Array.isArray(entries)||typeof worker!=='function'||!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>4)
    throw Error('daily_intake_concurrency_invalid');
  let cursor=0;const results=new Array(entries.length);
  await Promise.all(Array.from({length:Math.min(concurrency,entries.length)},async()=>{
    while(cursor<entries.length){const index=cursor++;results[index]=await worker(entries[index],index);}
  }));return results;
}

function circularSelection(rows, count, slot) {
  if (!rows.length || !count) return [];
  const offset = slot * count % rows.length;
  return Array.from({length:Math.min(rows.length,count)},(_,i)=>rows[(offset+i)%rows.length]);
}
/** Every approved active endpoint has a turn; Russian sources keep a share of
 * every bounded run, while worldwide sources rotate by region and country. */
export function selectDailyNewsSources({sources=LITERARY_NEWS_SOURCES,current=new Date(),
  sourceLimit=DAILY_NEWS_INTAKE_LIMITS.sources}={}) {
  if (!Number.isFinite(current.getTime()) || !Number.isSafeInteger(sourceLimit) || sourceLimit<1
    || sourceLimit>DAILY_NEWS_INTAKE_LIMITS.maximumSources || !Array.isArray(sources)) throw Error('daily_source_budget_invalid');
  const active=sources.filter(s=>s.discoveryEnabled!==false && ['html','rss','atom'].includes(s.format||'html'));
  const slot=Math.floor(current.getTime()/(DAILY_NEWS_INTAKE_LIMITS.rotationMinutes*60000));
  const russian=active.filter(s=>/^ru(?:-|$)/i.test(s.language||''));
  const worldwide=active.filter(s=>!/^ru(?:-|$)/i.test(s.language||''));
  const buckets=new Map();
  for(const source of worldwide){const key=`${source.region||'global'}:${source.countryCodes?.[0]||'unknown'}`;
    const bucket=buckets.get(key)||[];bucket.push(source);buckets.set(key,bucket);}
  const balanced=[];
  while([...buckets.values()].some(rows=>rows.length)) for(const rows of buckets.values()) if(rows.length)balanced.push(rows.shift());
  const russianCount=Math.min(russian.length,Math.max(1,Math.floor(sourceLimit/4)));
  const selectedRussian=circularSelection(russian,russianCount,slot);
  const selectedWorld=circularSelection(balanced,sourceLimit-selectedRussian.length,slot);
  return [...selectedRussian,...selectedWorld];
}

function sourceContract(source) {
  return {id:source.id,name:source.name,url:source.url,format:source.format||'html',language:source.language,
    articleOrigins:source.articleOrigins||[new URL(source.url).origin],topics:source.topics||[],
    region:source.region,countryCodes:source.countryCodes||[],coverageCountryCodes:source.coverageCountryCodes||[],
    sourceFamilyId:source.sourceFamilyId||source.id};
}

/** This is a bounded factual review intake, never an automatic confirmed flag.
 * A missing publication date stays unknown; observedAt is not publishedAt. */
export function extractDailyNewsDetail(html, url) {
  const $ = load(html), dates = [], images = [];
  for (const selector of ['meta[property="article:published_time"]','meta[name="date"]','meta[name="DC.date.issued"]']) {
    const value = $(selector).attr('content'); if (value) dates.push({ value, method: selector });
  }
  for (const property of ['og:image','twitter:image']) {
    const value = $(`meta[property="${property}"],meta[name="${property}"]`).first().attr('content');
    const parsed = canonicalUrl(value, url); if (value && parsed) images.push({ url: parsed.href, method: property,
      displayOnly: true, socialReuseApproved: false });
  }
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const visit = entry => {
        if (Array.isArray(entry)) return entry.forEach(visit);
        if (entry && typeof entry === 'object') {
          if (entry.datePublished) dates.push({ value: entry.datePublished, method: 'jsonld.datePublished' });
          if (entry['@graph']) visit(entry['@graph']);
        }
      }; visit(JSON.parse($(element).html()));
    } catch { /* Invalid JSON-LD does not become evidence. */ }
  });
  const headline = plain($('.entry-title, h1[itemprop="headline"]').first().text()
    || $('meta[property="og:title"]').attr('content') || $('h1').first().text() || $('title').text());
  $('script,style,nav,footer,header,aside').remove();
  const main = $('article, main, .entry-content, .post-content, .news-detail').first();
  return { headline: headline.slice(0, 500), text: plain((main.length ? main : $.root()).text()).slice(0, 14000),
    publishedDates: dates.slice(0, 8), images, language: $('html').attr('lang') || null,
    canonical: canonicalUrl($('link[rel="canonical"]').attr('href') || url, url)?.href || url };
}

export async function collectDailyNewsReview({ current = new Date(), detailLimit = DAILY_NEWS_INTAKE_LIMITS.details,
  sourceLimit=DAILY_NEWS_INTAKE_LIMITS.sources, sources:approvedSources=LITERARY_NEWS_SOURCES,
  reviewed:reviewedInput=[],readReviewed=null,fetchImpl,
  resolveMediaEvidence=async()=>({status:'rights_unverified'}) } = {}) {
  if(typeof fetchImpl!=='function')throw Error('daily_fetch_adapter_required');
  if (!Number.isSafeInteger(detailLimit) || detailLimit < 0 || detailLimit > 40) throw Error('daily_detail_budget_invalid');
  const reviewed = typeof readReviewed==='function' ? await readReviewed() : reviewedInput;
  if(!Array.isArray(reviewed))throw Error('daily_reviewed_input_invalid');
  const existing = new Set(reviewed.map(row => canonicalUrl(row.source.url)?.href));
  const sources=selectDailyNewsSources({sources:approvedSources,current,sourceLimit});
  const sourceById=new Map(sources.map(s=>[s.id,s]));
  const requests = [], documents = [];
  const service = createNewsService({ sources, now: () => current, readReviewed: () => [],
    fetchImpl: async url => {
      const source=sources.find(s=>s.url===url||s.pagination && new URL(s.url).origin===new URL(url).origin);
      const result = await fetchImpl(url,{includeBytes:true,encoding:source?.encoding}); requests.push({ url: result.url, httpStatus: result.status,
        responseSha256: result.sha256, accessedAt: result.accessedAt, bytes: result.bytes });
      const {rawBytes,...document}=result;
      documents.push({ sourceUrl: url, ...document });
      return new Response(rawBytes||result.text, { status:result.status,headers: { 'content-type': result.contentType } });
    },
  });
  let finds, sourceHealth;
  try { await service.refresh(); finds = service.getReviewQueue(); sourceHealth = (await service.getFeed()).sources; }
  finally { service.close(); }
  const earliest = current.getTime() - 7 * 86400000;
  const candidates = finds.filter(row => !existing.has(canonicalUrl(row.source.url)?.href)
    && (!row.publishedAt || Date.parse(row.publishedAt) >= earliest && Date.parse(row.publishedAt) <= current.getTime()))
    .sort((a, b) => Number(Boolean(b.publishedAt)) - Number(Boolean(a.publishedAt))
      || (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
  // Round-robin sources avoids a large wire filling the whole editorial intake.
  const bySource = new Map(); for (const row of candidates) {
    const rows = bySource.get(row.sourceId) || []; rows.push(row); bySource.set(row.sourceId, rows);
  }
  const selected = [];
  while (selected.length < detailLimit && [...bySource.values()].some(rows => rows.length)) {
    for (const rows of bySource.values()) { if (rows.length && selected.length < detailLimit) selected.push(rows.shift()); }
  }
  const details = await dailyNewsIntakePool(selected, async row => {
    try {
      const source=sourceById.get(row.sourceId),result = await fetchImpl(row.source.url,{encoding:source?.encoding});
      return { ...row,sourceProfile:sourceContract(source),resolvedMediaEvidence:await resolveMediaEvidence(row,current),
        evidence: { url: result.url, httpStatus: result.status, accessedAt: result.accessedAt,
        responseSha256: result.sha256, ...extractDailyNewsDetail(result.text, result.url) } };
    } catch (error) { return { ...row,sourceProfile:sourceContract(sourceById.get(row.sourceId)),
      resolvedMediaEvidence:{status:'rights_unverified'},evidence: null,
      detailError: /^http_\d+$/.test(error.message) ? error.message : 'detail_unavailable' }; }
  });
  return { schemaVersion: 2, contract:DAILY_NEWS_INTAKE_CONTRACT,generatedAt: current.toISOString(), editorialTimeZone: 'Europe/Moscow',
    selectedSources:sources.map(sourceContract),budgets:{sourceLimit,detailLimit,rotationMinutes:DAILY_NEWS_INTAKE_LIMITS.rotationMinutes},
    scope: 'Current bounded source intake and fetched article evidence; all findings remain held until factual and RU/EN review.',
    counts: { approvedActiveSources:approvedSources.filter(s=>s.discoveryEnabled!==false).length,
      checkedSources: sources.length, totalFinds: finds.length, unreviewedRecentOrUndated: candidates.length,
      knownPublishedWithinSevenDays: candidates.filter(row => row.publishedAt).length,
      unknownPublicationDates: candidates.filter(row => !row.publishedAt).length,
      verifiedDetails: details.filter(row => row.evidence?.httpStatus === 200).length,
      reviewedEligible: selectReviewed(reviewed, current, 'Europe/Moscow').length, newlyReady: 0, newlyPublished: 0 },
    sourceHealth, requests, details, documents, finds };
}

