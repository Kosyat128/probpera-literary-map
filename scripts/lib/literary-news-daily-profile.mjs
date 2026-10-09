import { canonicalUrl, selectReviewed, validDate, validTimestamp, CATEGORIES } from "./literary-news-reviewed.mjs";
import { LITERARY_NEWS_SOURCES } from "./literary-news-sources.mjs";
import {newsJsonByteSize,newsJsonDigest} from './literary-news-json.mjs';

// Worker-safe publication contract: no filesystem, image decoder or provider client.
export const DAILY_NEWS_PROFILE_KEY = "literary-news:v1:approved-profile:daily-grounded";
export const DAILY_NEWS_LEDGER_KEY = "literary-news:v1:daily-automation:ledger";
export const DAILY_NEWS_OWNER_KEY = "literary-news:v1:daily-automation:owner";
export const DAILY_NEWS_PROFILE_ID = "daily-grounded-v1";
export const DAILY_NEWS_WINDOW = Object.freeze({ start: "2026-09-29", endExclusive: "2027-09-30", timeZone: "Europe/Moscow" });
export const DAILY_NEWS_LIMITS = Object.freeze({ minimum: 8, maximum: 10, records: 5490,
  aiCallsPerDay: 80, draftRequestsPerDay: 40,
  profileBytes: 18 * 1024 * 1024, ledgerBytes: 24 * 1024 * 1024, cacheEntries: 120 });
// The owner reduced the current admission target to 8-10. Retained proofs may
// contain days admitted under the earlier 15-story cap; never invalidate them
// or rewrite their hashes when the operational target changes.
export const DAILY_NEWS_ARCHIVE_DAILY_MAXIMUM = 15;
export const DAILY_NEWS_MODELS = Object.freeze({ draft: "@cf/openai/gpt-oss-120b", review: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" });
export const DAILY_NEWS_POLICY = "source-grounded-bilingual-double-machine-review-v1";
export const PUBLICATION_DATE_METHODS = new Set(['meta[property="article:published_time"]', 'meta[property="og:article:published_time"]', 'meta[name="date"]',
  'meta[name="DC.date.issued"]', 'meta[itemprop~="datePublished"]', 'time[itemprop~="datePublished"]', "jsonld.datePublished"]);
const DAY = 86400000;
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const size = newsJsonByteSize;
const fail = code => { throw new Error(code); };
const validatedImmutableRecords = new WeakMap();
function freezeRecord(value,seen=new Set()) {
  if(value&&typeof value==='object'&&!seen.has(value)) {
    seen.add(value);for(const child of Object.values(value))freezeRecord(child,seen);Object.freeze(value);
  }
  return value;
}
const moscowDayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: DAILY_NEWS_WINDOW.timeZone,
  year: "numeric", month: "2-digit", day: "2-digit" });
export function dailyNewsDay(date) {
  return moscowDayFormatter.format(date);
}
export async function dailyNewsDigest(value) {
  return newsJsonDigest(value);
}
export function dailyPublicationEpoch(value) {
  if (validDate(value)) return Date.parse(value + "T00:00:00+03:00");
  return validTimestamp(value) ? Date.parse(value) : NaN;
}
export function approvedDailySource(sourceId, articleUrl, sources = LITERARY_NEWS_SOURCES) {
  const source = sources.find(row => row.id === sourceId && row.discoveryEnabled !== false);
  const article = canonicalUrl(articleUrl), listing = canonicalUrl(source?.url);
  if (!source || !article || article.href.length > 2048 || !listing) return null;
  const origins = source.articleOrigins || [listing.origin];
  if (!origins.includes(article.origin)) return null;
  if (source.linkPattern) {
    // Registry patterns are deeply frozen. Test a stateless copy without mutating executable policy.
    if (!new RegExp(source.linkPattern.source, source.linkPattern.flags.replace(/[gy]/g, "")).test(article.pathname)) return null;
  }
  return source;
}
export function dailyNewsImageUrl(value) {
  const url = canonicalUrl(value);
  return url && !url.port && url.href.length <= 2048
    && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,63}$/i.test(url.hostname)
    && !/(?:^|\.)(?:localhost|local|internal|invalid|test)$/i.test(url.hostname) ? url.href : null;
}
export function dailyRecordHashPayload(record) {
  const { recordSha256, ...provenance } = record.provenance;
  return { ...record, provenance };
}
export async function validateDailyNewsRecord(record, current = new Date(), { sources = LITERARY_NEWS_SOURCES } = {}) {
  const now=current.getTime(),priorCheck=validatedImmutableRecords.get(record);
  // Only the default immutable registry and an already fully validated, deeply
  // frozen news object qualify. News has no expiry; later clocks cannot invalidate
  // its past publication/admission proofs. Custom registries always validate afresh.
  if(sources===LITERARY_NEWS_SOURCES&&Object.isFrozen(sources)&&Number.isFinite(now)
    &&priorCheck!==undefined&&now>=priorCheck) {
    validatedImmutableRecords.set(record,now);return record;
  }
  const p = record?.provenance, e = p?.sourceEvidence, publication = dailyPublicationEpoch(record?.publishedAt);
  const admitted = Date.parse(p?.firstAcceptedAt), day = Number.isFinite(admitted) ? dailyNewsDay(new Date(admitted)) : null;
  const source = approvedDailySource(record?.sourceId, record?.source?.url, sources);
  if (!Number.isFinite(current.getTime()) || !record || !source || record.kind !== "news"
    || !/^daily-[a-f0-9]{32}$/.test(record.id || "") || !/^daily-topic:[a-f0-9]{40}$/.test(record.eventKey || "")
    || !CATEGORIES.has(record.category) || !source.topics?.includes(record.category)
    || !["ru", "en"].every(locale => typeof record.title?.[locale] === "string" && record.title[locale].trim()
      && record.title[locale].length <= 160 && typeof record.summary?.[locale] === "string"
      && record.summary[locale].trim() && record.summary[locale].length <= 440)
    || !/\p{Script=Cyrillic}/u.test(record.title.ru + record.summary.ru)
    || !/[A-Za-z]/.test(record.title.en + record.summary.en)
    || record.source.name !== source.name || record.source.language !== source.language
    || record.verification !== "confirmed" || record.verifiedAt !== p?.firstAcceptedAt
    || !validTimestamp(p?.firstAcceptedAt) || admitted > current.getTime() || day < DAILY_NEWS_WINDOW.start || day >= DAILY_NEWS_WINDOW.endExclusive
    || !Number.isFinite(publication) || publication > admitted || admitted - publication > 7 * DAY
    || record.eventDate !== (validDate(record.publishedAt) ? record.publishedAt : dailyNewsDay(new Date(publication)))
    || p?.reviewKind !== "machineReviewed" || p.policy !== DAILY_NEWS_POLICY
    || p.draftModel !== DAILY_NEWS_MODELS.draft || p.reviewModel !== DAILY_NEWS_MODELS.review
    || p.eventDateBasis !== "source-publication" || !hash(p.draftSha256) || !hash(p.reviewSha256) || !hash(p.recordSha256)
    || !e || !hash(e.documentSha256) || !hash(e.textSha256) || !validTimestamp(e.accessedAt)
    || Date.parse(e.accessedAt) > admitted || !PUBLICATION_DATE_METHODS.has(e.publication?.method)
    || e.publication.value !== record.publishedAt || !Array.isArray(e.quotes) || !e.quotes.length || e.quotes.length > 4
    || e.quotes.some(quote => typeof quote !== "string" || !quote.trim() || quote.length > 240)
    || e.quotes.join("").length > 500 || typeof e.literaryQuote !== "string" || !e.literaryQuote.trim() || e.literaryQuote.length > 180
    || p.reviewPassed !== true || size(record) > 6144) fail("daily_record_invalid");
  const thumbnail = e.thumbnail;
  if (thumbnail !== undefined && (!thumbnail || Object.keys(thumbnail).some(key => !["sourceUrl", "imageUrl", "method",
    "sourceDocumentSha256", "alt", "displayOnly", "socialReuseApproved"].includes(key))
    || thumbnail.sourceUrl !== record.source.url || !dailyNewsImageUrl(thumbnail.imageUrl)
    || !["og:image", "twitter:image"].includes(thumbnail.method) || thumbnail.sourceDocumentSha256 !== e.documentSha256
    || thumbnail.displayOnly !== true || thumbnail.socialReuseApproved !== false
    || thumbnail.alt?.ru !== record.title.ru || thumbnail.alt?.en !== record.title.en)) fail("daily_thumbnail_invalid");
  if (record.id !== "daily-" + (await dailyNewsDigest(record.source.url)).slice(0, 32)
    || p.recordSha256 !== await dailyNewsDigest(dailyRecordHashPayload(record))
    || selectReviewed([record], current, DAILY_NEWS_WINDOW.timeZone).length !== 1) fail("daily_record_proof_invalid");
  if(sources===LITERARY_NEWS_SOURCES&&Object.isFrozen(sources)) {
    freezeRecord(record);validatedImmutableRecords.set(record,now);
  }
  return record;
}
function profilePayload(value) {
  return { schemaVersion: 1, profileId: DAILY_NEWS_PROFILE_ID, policy: DAILY_NEWS_POLICY,
    window: DAILY_NEWS_WINDOW, generatedAt: value.generatedAt, records: value.records };
}
export async function makeDailyApprovedPayload(records, current = new Date()) {
  const value = profilePayload({ generatedAt: current.toISOString(), records });
  return { ...value, sha256: await dailyNewsDigest(value) };
}
export async function validateDailyApprovedPayload(value, current = new Date(), options = {}) {
  if (!value || value.schemaVersion !== 1 || value.profileId !== DAILY_NEWS_PROFILE_ID || value.policy !== DAILY_NEWS_POLICY
    || JSON.stringify(value.window) !== JSON.stringify(DAILY_NEWS_WINDOW)
    || !validTimestamp(value.generatedAt) || Date.parse(value.generatedAt) > current.getTime()
    || !Array.isArray(value.records) || value.records.length > DAILY_NEWS_LIMITS.records
    || size(value) > DAILY_NEWS_LIMITS.profileBytes || !hash(value.sha256)
    || value.sha256 !== await dailyNewsDigest(profilePayload(value))) fail("daily_profile_invalid");
  const ids = new Set(), urls = new Set(), events = new Set(), days = new Map();
  for (const record of value.records) {
    await validateDailyNewsRecord(record, current, options);
    const day = dailyNewsDay(new Date(record.provenance.firstAcceptedAt));
    if (Date.parse(record.provenance.firstAcceptedAt) > Date.parse(value.generatedAt)
      || ids.has(record.id) || urls.has(record.source.url) || events.has(record.eventKey)) fail("daily_profile_duplicate");
    ids.add(record.id); urls.add(record.source.url); events.add(record.eventKey);
    days.set(day, (days.get(day) || 0) + 1);
    if (days.get(day) > DAILY_NEWS_ARCHIVE_DAILY_MAXIMUM) fail("daily_profile_daily_limit");
  }
  return value;
}
export async function dailyPublishedRecords(value, current = new Date(), options = {}) {
  return (await validateDailyApprovedPayload(value, current, options)).records;
}
