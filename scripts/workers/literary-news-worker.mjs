import reviewed from "../../data/news/reviewed.json" with { type: "json" };
import withdrawals from "../../data/news/withdrawals.json" with { type: "json" };
import { resolveNewsTimeZone } from "../lib/literary-news-reviewed.mjs";
import { buildPublishedNewsFeed,verifyPublishedNewsSnapshot } from "../lib/literary-news-publication.mjs";
import { NEWS_SOURCE_STATE_KEY, NEWS_STATE_MAX_BYTES, parseNewsSourceState, pendingNewsSourceState } from "../lib/literary-news-state.mjs";
import { NOBEL_PROFILE_KEY, nobelPublishedRecords, readNobelProfileText } from "../lib/literary-news-nobel-profile.mjs";
import { DAILY_NEWS_PROFILE_KEY, DAILY_NEWS_LIMITS, dailyPublishedRecords, validateDailyNewsRecord } from '../lib/literary-news-daily-profile.mjs';
import {newsJsonStream} from '../lib/literary-news-json.mjs';
import {readNewsJsonArray} from '../lib/literary-news-json-reader.mjs';

const FEED_PATH = "/api/literary-news/feed";
// The delivery feed client times out after 20 seconds. Bound each retained
// waiter/body to three such windows even if disconnect never calls cancel;
// an in-flight load keeps its separate memory fence until it settles.
export const PUBLIC_NEWS_STREAM_LEASE_MS = 60000;
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

async function readDailyProfile(stream,current) {
  return readNewsJsonArray(stream,{arrayKey:'records',maxBytes:DAILY_NEWS_LIMITS.profileBytes,
    maxEntries:DAILY_NEWS_LIMITS.records,maxEntryBytes:6144,onEntry:record=>validateDailyNewsRecord(record,current)});
}

/** Build the single validated public graph without serializing an annual intermediate. */
async function buildNewsProjection(request, env, current) {
  const url = new URL(request.url);
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
    if (stream !== null) approvedProfile.push(...await dailyPublishedRecords(await readDailyProfile(stream,current), current));
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
    // The response owns only the validated public projection. Release large private
    // proof arrays before its streaming body is consumed; no record is truncated.
    approvedProfile.length = 0;
    records.length = 0;
    return feed;
  } catch {
    throw Error('public_snapshot_unavailable');
  }
}

/** Fixed reviewed data and code-owned validated profiles; private findings remain private. */
export async function handleNewsRequest(request, env, current = new Date()) {
  const headers = headersFor(env.NEWS_RELEASE_SHA);
  if (new URL(request.url).pathname !== FEED_PATH) return Response.json({ error: 'not_found' }, { status: 404, headers });
  if (request.method !== 'GET') return Response.json({ error: 'method_not_allowed' }, {
    status: 405, headers: { ...headers, Allow: 'GET' },
  });
  try { return new Response(newsJsonStream(await buildNewsProjection(request, env, current)), { headers }); }
  catch { return Response.json({ error: 'snapshot_unavailable' }, { status: 503, headers }); }
}

/** Read-only coordinator: the existing handler validates the same three fixed KV keys.
 * No private queue, ledger, provider client or writable binding operation is exposed. */
export class LiteraryNewsPublicReader {
  constructor(_state, env, {now=()=>new Date(),handler=handleNewsRequest}={}) {
    this.env=env;this.now=now;this.handler=handler;this.pending=0;this.activeKey=null;
    this.cached=null;this.loading=null;this.readers=new Set();
  }
  async load(key,request,current){
    if(this.cached?.key===key)return this.cached.value;
    if(this.loading){
      if(this.loading.key!==key)throw Error('public_snapshot_busy');
      return this.loading.promise;
    }
    // Other variants are admitted only after all streams release the old graph.
    // Drop the cache before loading its replacement, including on a failed load.
    this.cached=null;
    const loading=Promise.resolve().then(async()=>{
      let value;
      if(this.handler===handleNewsRequest)value=await buildNewsProjection(request,this.env,current);
      else {
        const response=await this.handler(request,this.env,current);
        if(response.status!==200)throw Error('public_snapshot_unavailable');
        value=await response.json();
      }
      const zone=resolveNewsTimeZone(new URL(request.url).searchParams.get('timeZone'));
      if(value?.mode!=='reviewed'||value.timeZone!==zone||!Array.isArray(value.items)||!Array.isArray(value.sources)
        ||value.generatedAt!==current.toISOString())throw Error('public_snapshot_invalid');
      if(new URL(request.url).searchParams.get('contract')==='2')await verifyPublishedNewsSnapshot(value,{requireRelease:false});
      const freeze=object=>{if(object&&typeof object==='object'){for(const child of Object.values(object))freeze(child);Object.freeze(object);}return object;};
      this.cached={key,value:freeze(value)};return this.cached.value;
    });
    this.loading={key,promise:loading};
    try{return await loading;}finally{if(this.loading?.promise===loading)this.loading=null;}
  }
  async fetch(request) {
    const headers=headersFor(this.env.NEWS_RELEASE_SHA),url=new URL(request.url);
    if(url.pathname!==FEED_PATH)return Response.json({error:'not_found'},{status:404,headers});
    if(request.method!=='GET')return Response.json({error:'method_not_allowed'},{status:405,headers:{...headers,Allow:'GET'}});
    const current=this.now(),zone=resolveNewsTimeZone(url.searchParams.get('timeZone'));
    // Timers are best-effort across request lifecycles. Reap before admission as
    // well, so an abandoned body cannot permanently pin the previous bucket.
    for(const lease of this.readers)if(lease.expiresAt<=current.getTime())lease.cancel();
    if(request.signal.aborted)return Response.json({error:'snapshot_unavailable'},{status:503,headers});
    const key=[headers['X-Probpera-News-Release'],zone,url.searchParams.get('contract')==='2'?2:1,Math.floor(current.getTime()/30000)].join('|');
    if(this.pending>=8||this.pending>0&&this.activeKey!==key)return Response.json({error:'snapshot_unavailable'},
      {status:503,headers:{...headers,'Retry-After':'1'}});
    this.pending++;this.activeKey=key;
    const abort=new AbortController();let released=false,timer;
    const release=()=>{if(!released){released=true;clearTimeout(timer);request.signal.removeEventListener('abort',lease.cancel);
      this.readers.delete(lease);this.pending--;if(this.pending===0)this.activeKey=null;}};
    const lease={expiresAt:current.getTime()+PUBLIC_NEWS_STREAM_LEASE_MS,cancel:()=>{abort.abort();release();}};
    this.readers.add(lease);request.signal.addEventListener('abort',lease.cancel,{once:true});
    timer=setTimeout(lease.cancel,PUBLIC_NEWS_STREAM_LEASE_MS);timer?.unref?.();
    try{
      const value=await this.load(key,request,current);
      if(abort.signal.aborted)throw Error('public_snapshot_aborted');
      return new Response(newsJsonStream(value,{onComplete:release,signal:abort.signal}),{headers});
    }catch{release();return Response.json({error:'snapshot_unavailable'},{status:503,headers});}
  }
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
