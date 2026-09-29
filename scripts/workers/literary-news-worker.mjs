import reviewed from "../../data/news/reviewed.json" with { type: "json" };
import withdrawals from "../../data/news/withdrawals.json" with { type: "json" };
import { resolveNewsTimeZone } from "../lib/literary-news-reviewed.mjs";
import { buildPublishedNewsFeed } from "../lib/literary-news-publication.mjs";
import { NEWS_SOURCE_STATE_KEY, NEWS_STATE_MAX_BYTES, parseNewsSourceState, pendingNewsSourceState } from "../lib/literary-news-state.mjs";
import { NOBEL_PROFILE_KEY, nobelPublishedRecords, readNobelProfileText } from "../lib/literary-news-nobel-profile.mjs";
import { DAILY_NEWS_PROFILE_KEY, DAILY_NEWS_LIMITS, dailyPublishedRecords } from '../lib/literary-news-daily-profile.mjs';

const FEED_PATH = "/api/literary-news/feed";
// The canonical site reads this public feed from news.probpera.ru without
// credentials. A fixed origin also covers diagnostics with no Origin header;
// it never reflects an arbitrary caller or requires a Vary: Origin cache key.
const READER_ORIGIN = "https://probpera.ru";
const headersFor = (release) => ({
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": READER_ORIGIN,
  "Access-Control-Expose-Headers": "X-Probpera-News-Release",
  "X-Probpera-News-Release": /^[a-f0-9]{40}$/.test(release || "") ? release : "local",
});

function publicItem(item) {
  return {
    id: item.id, category: item.category, kind: item.kind, eventDate: item.eventDate,
    publishedAt: item.publishedAt, verifiedAt: item.verifiedAt, verification: "confirmed",
    title: { ru: item.title.ru, en: item.title.en },
    summary: { ru: item.summary.ru, en: item.summary.en },
    source: { name: item.source.name, url: item.source.url, language: item.source.language },
    ...(item.region ? { region: item.region } : {}),
    ...(item.eventKey ? { eventKey: item.eventKey } : {}),
  };
}

async function readSourceState(namespace) {
  const stream = await namespace.get(NEWS_SOURCE_STATE_KEY, "stream");
  if (stream === null) return null;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > NEWS_STATE_MAX_BYTES) throw new Error("source_state_too_large");
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

async function readDailyProfile(stream) {
  const reader = stream.getReader(), decoder = new TextDecoder(); let bytes = 0, text = '';
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > DAILY_NEWS_LIMITS.profileBytes) throw Error('daily_profile_too_large');
      text += decoder.decode(value, { stream: true }); }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** Fixed reviewed data and code-owned validated profiles; private findings remain private. */
export async function handleNewsRequest(request, env, current = new Date()) {
  const headers = headersFor(env.NEWS_RELEASE_SHA);
  const url = new URL(request.url);
  if (url.pathname !== FEED_PATH) return Response.json({ error: "not_found" }, { status: 404, headers });
  if (request.method !== "GET") return Response.json({ error: "method_not_allowed" }, {
    status: 405, headers: { ...headers, Allow: "GET" },
  });
  let state = pendingNewsSourceState();
  try {
    // Read one fixed key. Private catalogs and held candidates are never read.
    state = parseNewsSourceState(await readSourceState(env.NEWS_STATE), current) || state;
  } catch {
    // Reviewed stories remain available; null checked-at never invents freshness.
    console.warn(JSON.stringify({ event: "literary_news_state_unavailable" }));
  }
  let approvedProfile = [];
  try {
    const stream = await env.NEWS_STATE.get(NOBEL_PROFILE_KEY,"stream");
    if (stream !== null) approvedProfile = await nobelPublishedRecords(JSON.parse(await readNobelProfileText(new Response(stream))),current);
  } catch {
    console.warn(JSON.stringify({event:"literary_news_nobel_profile_unavailable"}));
  }
  try {
    const stream = await env.NEWS_STATE.get(DAILY_NEWS_PROFILE_KEY, 'stream');
    if (stream !== null) approvedProfile.push(...await dailyPublishedRecords(await readDailyProfile(stream), current));
  } catch {
    console.warn(JSON.stringify({ event: 'literary_news_daily_profile_unavailable' }));
  }
  const timeZone = resolveNewsTimeZone(url.searchParams.get("timeZone"));
  try {
    // Human-reviewed records take precedence on either stable ID or semantic event key.
    const authoredIds = new Set(reviewed.map(item=>item.id)), authoredEvents = new Set(reviewed.map(item=>item.eventKey).filter(Boolean));
    const records = [...reviewed,...approvedProfile.filter(item=>!authoredIds.has(item.id) && !authoredEvents.has(item.eventKey)
      && !reviewed.some(authored=>authored.kind===item.kind && authored.category===item.category
        && authored.eventDate===item.eventDate && authored.source?.url===item.source.url))];
    const feed = await buildPublishedNewsFeed({ records, withdrawals, state, current, timeZone,
      release: env.NEWS_RELEASE_SHA, contractVersion: url.searchParams.get("contract") === "2" ? 2 : 1 });
    return Response.json(feed, { headers });
  } catch {
    return Response.json({ error: "snapshot_unavailable" }, { status: 503, headers });
  }
}

/** Read-only coordinator: the existing handler validates the same three fixed KV keys.
 * No private queue, ledger, provider client or writable binding operation is exposed. */
export class LiteraryNewsPublicReader {
  constructor(_state, env) { this.env = env; }
  fetch(request) { return handleNewsRequest(request, this.env); }
}

/** Keep route/method errors at the public boundary. Large approved-profile validation
 * runs in the SQLite DO's CPU budget; the outer Worker streams its original response. */
export async function handlePublicNewsRequest(request, env) {
  const headers = headersFor(env.NEWS_RELEASE_SHA);
  if (new URL(request.url).pathname !== FEED_PATH) return Response.json({ error: 'not_found' }, { status: 404, headers });
  if (request.method !== 'GET') return Response.json({ error: 'method_not_allowed' }, {
    status: 405, headers: { ...headers, Allow: 'GET' },
  });
  try {
    if (!env.NEWS_PUBLIC_READER) throw Error('public_reader_unavailable');
    const reader = env.NEWS_PUBLIC_READER.get(env.NEWS_PUBLIC_READER.idFromName('literary-news-public-reader'));
    return await reader.fetch(request);
  } catch {
    return Response.json({ error: 'snapshot_unavailable' }, { status: 503, headers });
  }
}

/** @type {ExportedHandler<Env>} */
export default { fetch(request, env) { return handlePublicNewsRequest(request, env); } };
