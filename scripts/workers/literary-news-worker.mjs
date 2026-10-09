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
// The total budget starts at arrival. Queueing leaves at least five seconds of
// the delivery client's 20-second budget. Each active lease includes loading
// and streaming, so slow loading cannot extend a stalled body's ownership.
// Leave one second of timer headroom for readers queued behind an active cohort.
// An in-flight private load keeps its separate memory fence until it settles.
export const PUBLIC_NEWS_REQUEST_DEADLINE_MS = 20000;
export const PUBLIC_NEWS_ADMISSION_WAIT_MS = 15000;
export const PUBLIC_NEWS_STREAM_LEASE_MS = 14000;
export const PUBLIC_NEWS_MAX_READERS = 8;
export const PUBLIC_NEWS_MAX_WAITERS = 16;
// The canonical site reads this public feed from news.probpera.ru without
// credentials. A fixed origin also covers diagnostics with no Origin header;
// it never reflects an arbitrary caller or requires a Vary: Origin cache key.
const READER_ORIGIN = "https://probpera.ru";
const headersFor = (release) => ({
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": READER_ORIGIN,
  "Access-Control-Expose-Headers": "X-Probpera-News-Release, Retry-After",
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
      release: env.NEWS_RELEASE_SHA, contractVersion: url.searchParams.get("contract") === "2" ? 2 : 1,
      archive: url.searchParams.get('view') === 'archive' });
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
    this.cached=null;this.loading=null;this.readers=new Set();this.waiters=[];
    this.drainScheduled=false;this.draining=false;
  }
  keyFor(request,current){
    const url=new URL(request.url);
    return [headersFor(this.env.NEWS_RELEASE_SHA)['X-Probpera-News-Release'],
      resolveNewsTimeZone(url.searchParams.get('timeZone')),url.searchParams.get('contract')==='2'?2:1,
      url.searchParams.get('view')==='archive'?'archive':'current',Math.floor(current.getTime()/30000)].join('|');
  }
  unavailable(code){
    return Response.json({error:'snapshot_unavailable'},{status:503,headers:{...headersFor(this.env.NEWS_RELEASE_SHA),
      'X-Probpera-News-Reader-Status':code,...(['busy','queue_full'].includes(code)?{'Retry-After':'1'}:{})}});
  }
  scheduleDrain(){
    if(this.drainScheduled)return;
    this.drainScheduled=true;
    queueMicrotask(()=>{this.drainScheduled=false;this.drain();});
  }
  arm(lease,expiresAt){
    clearTimeout(lease.timer);lease.expiresAt=expiresAt;
    lease.timer=setTimeout(()=>lease.cancel('wait_expired'),Math.max(0,expiresAt-this.now().getTime()));
    lease.timer?.unref?.();
  }
  armWaiter(lease){
    clearTimeout(lease.timer);
    const wakeAt=Math.min(lease.expiresAt,...Array.from(this.readers,reader=>reader.expiresAt));
    lease.timer=setTimeout(()=>{
      // A disconnected response can lose its request-context timer in Workers.
      // This live waiter's own timer must reap expired active leases without
      // requiring another HTTP request, before expiring its admission budget.
      this.drain(new Date(Math.max(this.now().getTime(),wakeAt)));
      if(!lease.released&&this.waiters.includes(lease))this.armWaiter(lease);
    },Math.max(0,wakeAt-this.now().getTime()));
    lease.timer?.unref?.();
  }
  release(lease,code){
    if(lease.released)return;
    lease.released=true;clearTimeout(lease.timer);
    lease.request.signal.removeEventListener('abort',lease.onAbort);
    if(this.readers.delete(lease)){
      this.pending--;if(this.pending===0)this.activeKey=null;
    }else{
      const index=this.waiters.indexOf(lease);if(index!==-1)this.waiters.splice(index,1);
    }
    // Aborting the stream also invokes onComplete. Mark released first so that
    // both paths clean up exactly once, including when a body reader is locked.
    if(code)lease.abort.abort();
    if(lease.resolve){lease.resolve(this.unavailable(code||'aborted'));lease.resolve=null;}
    this.scheduleDrain();
  }
  reap(current){
    for(const lease of this.readers){
      if(lease.expiresAt<=current.getTime())lease.cancel('wait_expired');
    }
    for(const lease of [...this.waiters])if(lease.expiresAt<current.getTime())lease.cancel('wait_expired');
  }
  canAdmit(key){
    return this.pending<PUBLIC_NEWS_MAX_READERS&&(!this.pending||this.activeKey===key)
      &&(!this.loading||this.loading.key===key);
  }
  drain(current=this.now()){
    if(this.draining)return;
    this.draining=true;
    try{
      this.reap(current);
      while(this.waiters.length){
        current=new Date(Math.max(current.getTime(),this.now().getTime()));
        const lease=this.waiters[0],key=this.keyFor(lease.request,current);
        if(lease.expiresAt<current.getTime()){lease.cancel('wait_expired');continue;}
        // Only the head may join the active cohort. New arrivals of that same
        // variant cannot keep it alive ahead of an older different-mode reader.
        if(!this.canAdmit(key)){
          if(lease.expiresAt<=current.getTime()){lease.cancel('wait_expired');continue;}
          break;
        }
        this.waiters.shift();this.admit(lease,key,current);
      }
    }finally{this.draining=false;}
  }
  respond(lease,value){
    if(lease.released||!lease.resolve)return;
    const current=this.now();
    if(lease.expiresAt<=current.getTime()){lease.cancel('wait_expired');return;}
    try{
      const response=new Response(newsJsonStream(value,{onComplete:()=>this.release(lease),signal:lease.abort.signal}),
        {headers:lease.headers});
      const resolve=lease.resolve;lease.resolve=null;resolve(response);
    }catch{lease.cancel('load_failed');}
  }
  admit(lease,key,current){
    lease.key=key;lease.headers=headersFor(this.env.NEWS_RELEASE_SHA);
    this.readers.add(lease);this.pending++;this.activeKey=key;
    this.arm(lease,Math.min(lease.deadline,current.getTime()+PUBLIC_NEWS_STREAM_LEASE_MS));
    if(this.cached?.key===key){this.respond(lease,this.cached.value);return;}
    if(!this.loading)this.load(key,lease.request,current);
  }
  load(key,request,current){
    // Other variants are admitted only after all streams release the old graph.
    // Drop the cache before loading its replacement, including on a failed load.
    this.cached=null;
    const loading={key,promise:null};this.loading=loading;
    loading.promise=Promise.resolve().then(async()=>{
      let value;
      if(this.handler===handleNewsRequest)value=await buildNewsProjection(request,this.env,current);
      else {
        const response=await this.handler(request,this.env,current);
        try{
          if(response.status!==200)throw Error('public_snapshot_unavailable');
          value=await response.json();
        }finally{await response.body?.cancel().catch(()=>{});}
      }
      const zone=resolveNewsTimeZone(new URL(request.url).searchParams.get('timeZone'));
      if(value?.mode!=='reviewed'||value.timeZone!==zone||!Array.isArray(value.items)||!Array.isArray(value.sources)
        ||value.generatedAt!==current.toISOString())throw Error('public_snapshot_invalid');
      if(new URL(request.url).searchParams.get('contract')==='2')await verifyPublishedNewsSnapshot(value,
        {requireRelease:false,archive:new URL(request.url).searchParams.get('view')==='archive'});
      const freeze=object=>{if(object&&typeof object==='object'){for(const child of Object.values(object))freeze(child);Object.freeze(object);}return object;};
      return freeze(value);
    });
    // One completion observer per load, not one await per cancelled request.
    // A hung KV read therefore retains one bounded load and no departed waiters.
    void loading.promise.then(value=>{
      this.cached={key,value};this.loading=null;
      for(const lease of this.readers)if(lease.key===key)this.respond(lease,value);
      this.scheduleDrain();
    },()=>{
      this.loading=null;
      for(const lease of this.readers)if(lease.key===key)lease.cancel('load_failed');
      this.scheduleDrain();
    });
  }
  async fetch(request) {
    const headers=headersFor(this.env.NEWS_RELEASE_SHA),url=new URL(request.url);
    if(url.pathname!==FEED_PATH)return Response.json({error:'not_found'},{status:404,headers});
    if(request.method!=='GET')return Response.json({error:'method_not_allowed'},{status:405,headers:{...headers,Allow:'GET'}});
    const current=this.now();
    // Timers are best-effort across request lifecycles. Reap before admission as
    // well, so an abandoned body cannot permanently pin the previous bucket.
    this.reap(current);this.drain();
    if(request.signal.aborted)return this.unavailable('aborted');
    const key=this.keyFor(request,current),immediate=!this.waiters.length&&this.canAdmit(key);
    if(!immediate&&this.waiters.length>=PUBLIC_NEWS_MAX_WAITERS)return this.unavailable('queue_full');
    return new Promise(resolve=>{
      const lease={request,resolve,abort:new AbortController(),released:false,
        deadline:current.getTime()+PUBLIC_NEWS_REQUEST_DEADLINE_MS};
      lease.cancel=code=>this.release(lease,code||'aborted');lease.onAbort=()=>lease.cancel('aborted');
      request.signal.addEventListener('abort',lease.onAbort,{once:true});
      if(immediate)this.admit(lease,key,current);
      else{
        lease.expiresAt=current.getTime()+PUBLIC_NEWS_ADMISSION_WAIT_MS;
        this.waiters.push(lease);this.armWaiter(lease);
      }
    });
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
