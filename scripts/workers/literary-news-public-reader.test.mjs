import {describe,expect,it,vi} from 'vitest';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from 'miniflare';
import worker,{LiteraryNewsPublicReader,handlePublicNewsRequest,handleNewsRequest,PUBLIC_NEWS_STREAM_LEASE_MS,
  PUBLIC_NEWS_REQUEST_DEADLINE_MS,PUBLIC_NEWS_ADMISSION_WAIT_MS,PUBLIC_NEWS_MAX_READERS,PUBLIC_NEWS_MAX_WAITERS} from './literary-news-worker.mjs';
import {NEWS_SOURCE_STATE_KEY,NEWS_HELD_QUEUE_KEY,pendingNewsSourceState} from '../lib/literary-news-state.mjs';
import {NOBEL_PROFILE_KEY} from '../lib/literary-news-nobel-profile.mjs';
import {DAILY_NEWS_PROFILE_KEY} from '../lib/literary-news-daily-profile.mjs';
import {verifyPublishedNewsSnapshot} from '../lib/literary-news-publication.mjs';
const url='https://news.probpera.ru/api/literary-news/feed';
function fixture(options={}){const state=pendingNewsSourceState();state.privateQueue='PRIVATE_HELD_UNREVIEWED';
  const env={NEWS_RELEASE_SHA:'a'.repeat(40),NEWS_STATE:{get:vi.fn(async key=>key===NEWS_SOURCE_STATE_KEY?new Response(JSON.stringify(state)).body:null),
    put:vi.fn(),delete:vi.fn(),list:vi.fn()}};
  const reader=new LiteraryNewsPublicReader({},env,options);
  env.NEWS_PUBLIC_READER={idFromName:vi.fn(()=>1),get:vi.fn(()=>({fetch:vi.fn(request=>reader.fetch(request))}))};return{env,reader};}
describe('Public read-only news projection Durable Object boundary',()=>{
  it('rejects writes, preflights and private paths before invoking any DO or KV operation',async()=>{
    const f=fixture();
    for(const method of ['POST','PUT','DELETE','OPTIONS']){
      const response=await handlePublicNewsRequest(new Request(url,{method}),f.env);
      expect(response.status).toBe(405);expect(response.headers.get('allow')).toBe('GET');
      expect(response.headers.get('access-control-allow-origin')).toBe('https://probpera.ru');}
    const hidden=await worker.fetch(new Request('https://news.probpera.ru/api/literary-news/held-queue'),f.env);
    expect(hidden.status).toBe(404);expect(f.env.NEWS_PUBLIC_READER.get).not.toHaveBeenCalled();expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();
  });
  it('preserves original complete snapshot proofs, fixed CORS and only three public KV keys',async()=>{
    const f=fixture(),response=await worker.fetch(new Request(url+'?contract=2&timeZone=Europe%2FMoscow&key='+NEWS_HELD_QUEUE_KEY,
      {headers:{Origin:'https://untrusted.example'}}),f.env),feed=await response.json();
    expect(response.status).toBe(200);expect(response.headers.get('access-control-allow-origin')).toBe('https://probpera.ru');
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-probpera-news-release')).toBe('a'.repeat(40));
    await expect(verifyPublishedNewsSnapshot(feed)).resolves.toBe(feed);expect(feed.snapshot.complete).toBe(true);
    expect(f.env.NEWS_STATE.get.mock.calls).toEqual([[NEWS_SOURCE_STATE_KEY,'stream'],[NOBEL_PROFILE_KEY,'stream'],[DAILY_NEWS_PROFILE_KEY,'stream']]);
    expect(JSON.stringify(feed)).not.toContain('PRIVATE_HELD_UNREVIEWED');
    expect(f.env.NEWS_STATE.put).not.toHaveBeenCalled();expect(f.env.NEWS_STATE.delete).not.toHaveBeenCalled();expect(f.env.NEWS_STATE.list).not.toHaveBeenCalled();
  });
  it('waits beyond the old two-second retry window, then serves the archive with complete proof and fixed CORS',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
    try{
    const f=fixture();
    const current=await worker.fetch(new Request(url+'?contract=2&timeZone=Europe%2FMoscow'),f.env);
    let settled=false;
    const waiting=worker.fetch(new Request(url+'?contract=2&timeZone=Europe%2FMoscow&view=archive',
      {headers:{Origin:'https://untrusted.example'}}),f.env).then(value=>{settled=true;return value;});
    await vi.advanceTimersByTimeAsync(2500);
    expect(settled).toBe(false);expect(f.reader.waiters).toHaveLength(1);
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);expect(f.reader.pending).toBe(1);
    await current.body.cancel();const archive=await waiting;
    expect(current.status).toBe(200);expect(archive.status).toBe(200);
    expect(archive.headers.get('retry-after')).toBeNull();
    expect(archive.headers.get('access-control-expose-headers').split(/,\s*/)).toEqual(['X-Probpera-News-Release','Retry-After']);
    expect(archive.headers.get('access-control-allow-origin')).toBe('https://probpera.ru');
    expect(archive.headers.get('access-control-allow-credentials')).toBeNull();
    await verifyPublishedNewsSnapshot(await archive.json(),{archive:true});expect(f.reader.pending).toBe(0);
    expect(f.reader.waiters).toHaveLength(0);expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(6);
    }finally{vi.useRealTimers();}
  });
  it('the internal reader itself rejects writes and unregistered paths without storage',async()=>{
    const f=fixture();expect((await f.reader.fetch(new Request(url,{method:'POST'}))).status).toBe(405);
    expect((await f.reader.fetch(new Request('https://private.internal/ledger'))).status).toBe(404);
    expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();
  });
  it('missing or failed reader returns a bounded 503 with no direct large-profile fallback or raw error',async()=>{
    const f=fixture();delete f.env.NEWS_PUBLIC_READER;
    expect((await worker.fetch(new Request(url),f.env)).status).toBe(503);expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();
    f.env.NEWS_PUBLIC_READER={idFromName:()=>1,get:()=>({fetch:async()=>{throw Error('private-provider-token');}})};
    const response=await worker.fetch(new Request(url),f.env);expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private-provider-token');
  });
  it('parallel identical readers share one complete validated load and a single three-key read',async()=>{
    const now=new Date('2026-09-30T12:00:00Z'),f=fixture({now:()=>now});
    const feeds=await Promise.all(Array.from({length:4},async()=>{
      const response=await f.reader.fetch(new Request(url+'?contract=2'));return response.json();}));
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);expect(new Set(feeds.map(feed=>feed.snapshot.id)).size).toBe(1);
    await Promise.all(feeds.map(feed=>verifyPublishedNewsSnapshot(feed)));expect(f.reader.pending).toBe(0);
    expect(Object.isFrozen(f.reader.cached.value.items[0].title)).toBe(true);
  });
  it('preserves consumed variants and reloads the next 30-second bucket/release',async()=>{
    let now=new Date('2026-09-30T12:00:00Z');const f=fixture({now:()=>now});
    const first=await(await f.reader.fetch(new Request(url+'?contract=2&timeZone=UTC'))).json();
    const second=await(await f.reader.fetch(new Request(url+'?contract=2&timeZone=Asia%2FTokyo'))).json();
    expect(first.timeZone).toBe('UTC');expect(second.timeZone).toBe('Asia/Tokyo');expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(6);
    const reused=await(await f.reader.fetch(new Request(url+'?contract=2&timeZone=Asia%2FTokyo'))).json();
    expect(reused.generatedAt).toBe(second.generatedAt);expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(6);
    now=new Date(now.getTime()+30000);await(await f.reader.fetch(new Request(url+'?contract=2&timeZone=Asia%2FTokyo'))).json();
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(9);f.env.NEWS_RELEASE_SHA='b'.repeat(40);
    const newRelease=await(await f.reader.fetch(new Request(url+'?contract=2&timeZone=Asia%2FTokyo'))).json();
    expect(newRelease.snapshot.release).toBe('b'.repeat(40));expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(12);
  });
  it('does not cache unavailable or malformed snapshots and recovers on a later valid load',async()=>{
    let failures=2;const handler=vi.fn(async(request,env,current)=>failures--===2?Response.json({error:'unavailable'},{status:503}):
      failures===0?Response.json({mode:'reviewed',items:[]}):handleNewsRequest(request,env,current));
    const f=fixture({handler,now:()=>new Date('2026-09-30T12:00:00Z')});
    for(let i=0;i<2;i++){expect((await f.reader.fetch(new Request(url+'?contract=2'))).status).toBe(503);expect(f.reader.cached).toBeNull();}
    const response=await f.reader.fetch(new Request(url+'?contract=2'));expect(response.status).toBe(200);
    await verifyPublishedNewsSnapshot(await response.json());expect(handler).toHaveBeenCalledTimes(3);
  });
  it('cancels an injected redirect response body and releases its load and reader capacity',async()=>{
    vi.useFakeTimers();
    try{
      const cancel=vi.fn(),body=new ReadableStream({start(controller){
        controller.enqueue(new TextEncoder().encode('private-redirect-body'));
      },cancel});
      const handler=vi.fn(async()=>new Response(body,{status:302,headers:{Location:'https://private.example/redirect'}}));
      const f=fixture({handler,now:()=>new Date('2026-09-30T12:00:00Z')});
      const response=await f.reader.fetch(new Request(url+'?contract=2'));
      expect(response.status).toBe(503);expect(response.headers.get('x-probpera-news-reader-status')).toBe('load_failed');
      expect(response.headers.get('location')).toBeNull();expect(await response.text()).not.toContain('private-redirect-body');
      expect(cancel).toHaveBeenCalledOnce();expect(handler).toHaveBeenCalledOnce();
      expect(f.reader.pending).toBe(0);expect(f.reader.loading).toBeNull();expect(f.reader.cached).toBeNull();
      expect(f.reader.readers.size).toBe(0);expect(f.reader.waiters).toHaveLength(0);expect(vi.getTimerCount()).toBe(0);
      expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();
    }finally{vi.useRealTimers();}
  });
  it('caps the shared active cohort at eight and queues the ninth without another load',async()=>{
    let open;const gate=new Promise(resolve=>{open=resolve;});
    const handler=async(request,env,current)=>{await gate;return handleNewsRequest(request,env,current);};
    const f=fixture({handler,now:()=>new Date('2026-09-30T12:00:00Z')});
    const waiting=Array.from({length:8},()=>f.reader.fetch(new Request(url+'?contract=2')));
    const ninth=f.reader.fetch(new Request(url+'?contract=2'));
    expect(f.reader.pending).toBe(8);expect(f.reader.waiters).toHaveLength(1);
    open();const responses=await Promise.all(waiting);expect(f.reader.pending).toBe(8);
    await responses[0].body.cancel();const admitted=await ninth;expect(admitted.status).toBe(200);expect(f.reader.pending).toBe(8);
    await Promise.all([...responses.slice(1),admitted].map(response=>response.json()));
    expect(f.reader.pending).toBe(0);expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);
  });
  it('releases an aborted request even when its response body reader remains locked',async()=>{
    let now=new Date('2026-09-30T12:00:00Z');const f=fixture({now:()=>now}),abort=new AbortController();
    const response=await f.reader.fetch(new Request(url+'?contract=2&timeZone=UTC',{signal:abort.signal}));
    const body=response.body.getReader();expect((await body.read()).done).toBe(false);expect(f.reader.pending).toBe(1);
    abort.abort();expect(f.reader.pending).toBe(0);
    await expect(body.read()).rejects.toThrow();body.releaseLock();
    now=new Date(now.getTime()+30000);
    const next=await f.reader.fetch(new Request(url+'?contract=2&timeZone=Europe%2FMoscow'));
    expect(next.status).toBe(200);await verifyPublishedNewsSnapshot(await next.json());
  });
  it('reclaims an abandoned response after a bounded lease without waiting for client cancellation',async()=>{
    let now=new Date('2026-09-30T12:00:00Z');const f=fixture({now:()=>now});
    const abandoned=await f.reader.fetch(new Request(url+'?contract=2&timeZone=UTC'));
    const body=abandoned.body.getReader();await body.read();expect(f.reader.pending).toBe(1);
    now=new Date(now.getTime()+PUBLIC_NEWS_STREAM_LEASE_MS);
    const next=await f.reader.fetch(new Request(url+'?contract=2&timeZone=Europe%2FMoscow'));
    expect(next.status).toBe(200);await verifyPublishedNewsSnapshot(await next.json());
    await expect(body.read()).rejects.toThrow();body.releaseLock();expect(f.reader.pending).toBe(0);
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(6);
  });
  it('expires stalled bodies by timer and clears the timer and request listener exactly once',async()=>{
    vi.useFakeTimers();
    try{
      const abort=new AbortController(),request=new Request(url+'?contract=2',{signal:abort.signal});
      const remove=vi.spyOn(request.signal,'removeEventListener'),f=fixture({now:()=>new Date('2026-09-30T12:00:00Z')});
      const response=await f.reader.fetch(request),body=response.body.getReader();await body.read();
      expect(vi.getTimerCount()).toBe(1);expect(f.reader.pending).toBe(1);
      await vi.advanceTimersByTimeAsync(PUBLIC_NEWS_STREAM_LEASE_MS);
      expect(f.reader.pending).toBe(0);expect(f.reader.readers.size).toBe(0);expect(vi.getTimerCount()).toBe(0);
      expect(remove).toHaveBeenCalledExactlyOnceWith('abort',expect.any(Function));
      await expect(body.read()).rejects.toThrow();body.releaseLock();
      abort.abort();expect(f.reader.pending).toBe(0);expect(remove).toHaveBeenCalledOnce();
    }finally{vi.useRealTimers();}
  });
  it.each(['abort','expiry'])('releases all eight abandoned readers on %s before replacing their shared graph',async mode=>{
    let now=new Date('2026-09-30T12:00:00Z');const f=fixture({now:()=>now});
    const aborts=Array.from({length:8},()=>new AbortController());
    const responses=await Promise.all(aborts.map(abort=>f.reader.fetch(new Request(url+'?contract=2&timeZone=UTC',{signal:abort.signal}))));
    const bodies=responses.map(response=>response.body.getReader());await Promise.all(bodies.map(body=>body.read()));
    expect(f.reader.pending).toBe(8);expect(f.reader.readers.size).toBe(8);expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);
    if(mode==='abort')for(const abort of aborts)abort.abort();
    now=new Date(now.getTime()+PUBLIC_NEWS_STREAM_LEASE_MS);
    const next=await f.reader.fetch(new Request(url+'?contract=2&timeZone=Europe%2FMoscow'));
    expect(next.status).toBe(200);await verifyPublishedNewsSnapshot(await next.json());
    for(const body of bodies){await expect(body.read()).rejects.toThrow();body.releaseLock();}
    for(const abort of aborts)abort.abort();
    expect(f.reader.pending).toBe(0);expect(f.reader.readers.size).toBe(0);expect(f.reader.activeKey).toBeNull();
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(6);
  });
  it('rejects a request already aborted without any load or retained lease',async()=>{
    const f=fixture(),abort=new AbortController();abort.abort();
    const response=await f.reader.fetch(new Request(url+'?contract=2',{signal:abort.signal}));
    expect(response.status).toBe(503);expect(f.reader.pending).toBe(0);expect(f.reader.readers.size).toBe(0);
    expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();
  });
  it.each(['abort','expiry'])('retains the single-load memory fence while a %s releases its waiting request',async mode=>{
    let now=new Date('2026-09-30T12:00:00Z'),open;
    const gate=new Promise(resolve=>{open=resolve;});
    const handler=vi.fn(async(request,env,current)=>{await gate;return handleNewsRequest(request,env,current);});
    const f=fixture({handler,now:()=>now}),abort=new AbortController();
    const first=f.reader.fetch(new Request(url+'?contract=2&timeZone=UTC',{signal:abort.signal}));
    await Promise.resolve();expect(handler).toHaveBeenCalledOnce();
    if(mode==='abort')abort.abort();
    now=new Date(now.getTime()+PUBLIC_NEWS_REQUEST_DEADLINE_MS);
    const waiting=f.reader.fetch(new Request(url+'?contract=2&timeZone=Europe%2FMoscow'));
    const stopped=await first;expect(stopped.status).toBe(503);
    expect(stopped.headers.get('x-probpera-news-reader-status')).toBe(mode==='abort'?'aborted':'wait_expired');
    expect(handler).toHaveBeenCalledOnce();expect(f.reader.loading).not.toBeNull();expect(f.reader.waiters).toHaveLength(1);
    expect(f.reader.pending).toBe(0);expect(f.reader.readers.size).toBe(0);
    open();const next=await waiting;
    expect(next.status).toBe(200);await verifyPublishedNewsSnapshot(await next.json());
    expect(handler).toHaveBeenCalledTimes(2);expect(f.reader.pending).toBe(0);
  });
  it('holds one shared snapshot for eight unfinished streams and admits different variants strictly in FIFO order',async()=>{
    let now=new Date('2026-09-30T12:00:00Z');const f=fixture({now:()=>now});
    const same=url+'?contract=2&timeZone=UTC';
    const responses=await Promise.all(Array.from({length:8},()=>f.reader.fetch(new Request(same))));
    expect(responses.every(response=>response.status===200)).toBe(true);expect(f.reader.pending).toBe(8);
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);
    const zones=['Europe/Moscow','Asia/Tokyo','America/New_York','Europe/London','Europe/Paris','Australia/Melbourne','Europe/Berlin','Asia/Shanghai'];
    const queued=zones.map(zone=>f.reader.fetch(new Request(url+'?contract=2&timeZone='+encodeURIComponent(zone))));
    expect(f.reader.waiters).toHaveLength(zones.length);
    // One remaining stream still owns the entire graph. Waiting requests hold
    // only their admission metadata and cannot initiate another profile load.
    await Promise.all(responses.slice(1).map(response=>response.body.cancel()));expect(f.reader.pending).toBe(1);
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);
    await responses[0].body.cancel();
    for(let index=0;index<zones.length;index++){
      const next=await queued[index];expect(next.status).toBe(200);expect(f.reader.pending).toBe(1);
      expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3*(index+2));
      expect((await next.json()).timeZone).toBe(zones[index]);
    }
    expect(f.reader.pending).toBe(0);expect(f.reader.waiters).toHaveLength(0);
  });
  it('queues different keys during the first load without allocating another profile graph',async()=>{
    let open;const gate=new Promise(resolve=>{open=resolve;});
    const handler=vi.fn(async(request,env,current)=>{await gate;return handleNewsRequest(request,env,current);});
    const f=fixture({handler,now:()=>new Date('2026-09-30T12:00:00Z')});
    const first=f.reader.fetch(new Request(url+'?contract=2&timeZone=UTC'));
    const zones=['Europe/Moscow','Asia/Tokyo','America/New_York','Europe/London','Europe/Paris','Australia/Melbourne','Europe/Berlin','Asia/Shanghai'];
    const queued=zones.map(zone=>f.reader.fetch(new Request(url+'?contract=2&timeZone='+encodeURIComponent(zone))));
    await Promise.resolve();expect(f.reader.waiters).toHaveLength(zones.length);
    expect(handler).toHaveBeenCalledTimes(1);expect(f.reader.pending).toBe(1);expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();
    open();const response=await first;expect(response.status).toBe(200);await response.json();
    for(const waiting of queued){const next=await waiting;expect(next.status).toBe(200);await next.body.cancel();}
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3*(zones.length+1));expect(f.reader.pending).toBe(0);
  });
  it('gives waiting current readers priority over later archive arrivals and shares each contiguous cohort',async()=>{
    const f=fixture({now:()=>new Date('2026-09-30T12:00:00Z')}),current=url+'?contract=2',archive=current+'&view=archive';
    const held=await f.reader.fetch(new Request(archive));
    const first=f.reader.fetch(new Request(current)),second=f.reader.fetch(new Request(current));
    let archiveAdmitted=false;
    const later=Array.from({length:4},()=>f.reader.fetch(new Request(archive)).then(response=>{archiveAdmitted=true;return response;}));
    expect(f.reader.pending).toBe(1);expect(f.reader.waiters).toHaveLength(6);expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);
    await held.body.cancel();const currentResponses=await Promise.all([first,second]);
    expect(currentResponses.every(response=>response.status===200)).toBe(true);
    expect(archiveAdmitted).toBe(false);expect(f.reader.pending).toBe(2);expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(6);
    const feed=await currentResponses[0].json();await verifyPublishedNewsSnapshot(feed);
    expect(archiveAdmitted).toBe(false);await currentResponses[1].body.cancel();
    const archiveResponses=await Promise.all(later);expect(f.reader.pending).toBe(4);
    const feeds=await Promise.all(archiveResponses.map(response=>response.json()));
    for(const value of feeds)await verifyPublishedNewsSnapshot(value,{archive:true});
    expect(new Set(feeds.map(value=>value.snapshot.id)).size).toBe(1);
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(9);expect(f.reader.pending).toBe(0);expect(f.reader.waiters).toHaveLength(0);
  });
  it('bounds waiting metadata at sixteen and cancels queued requests without retaining timers or listeners',async()=>{
    vi.useFakeTimers();
    try{
      const f=fixture({now:()=>new Date('2026-09-30T12:00:00Z')}),held=await f.reader.fetch(new Request(url+'?contract=2'));
      const aborts=Array.from({length:PUBLIC_NEWS_MAX_WAITERS},()=>new AbortController());
      const requests=aborts.map(abort=>new Request(url+'?contract=2&view=archive',{signal:abort.signal}));
      const removes=requests.map(request=>vi.spyOn(request.signal,'removeEventListener'));
      const queued=requests.map(request=>f.reader.fetch(request));
      const overflow=await f.reader.fetch(new Request(url+'?contract=2&view=archive'));
      expect(overflow.status).toBe(503);expect(overflow.headers.get('x-probpera-news-reader-status')).toBe('queue_full');
      expect(overflow.headers.get('retry-after')).toBe('1');
      expect(overflow.headers.get('access-control-expose-headers')).toBe('X-Probpera-News-Release, Retry-After');
      expect(f.reader.waiters).toHaveLength(PUBLIC_NEWS_MAX_WAITERS);expect(f.reader.pending).toBe(1);
      expect(vi.getTimerCount()).toBe(PUBLIC_NEWS_MAX_WAITERS+1);expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);
      for(const abort of aborts)abort.abort();
      for(const response of await Promise.all(queued))expect(response.headers.get('x-probpera-news-reader-status')).toBe('aborted');
      for(const remove of removes)expect(remove).toHaveBeenCalledExactlyOnceWith('abort',expect.any(Function));
      expect(f.reader.waiters).toHaveLength(0);expect(vi.getTimerCount()).toBe(1);
      await held.body.cancel();expect(vi.getTimerCount()).toBe(0);expect(f.reader.pending).toBe(0);
      expect(PUBLIC_NEWS_MAX_READERS).toBe(8);expect(PUBLIC_NEWS_MAX_WAITERS).toBe(16);
    }finally{vi.useRealTimers();}
  });
  it('removes an aborted queue head immediately and admits its same-active successor without a new graph',async()=>{
    const f=fixture({now:()=>new Date('2026-09-30T12:00:00Z')}),abort=new AbortController();
    const held=await f.reader.fetch(new Request(url+'?contract=2&view=archive'));
    const head=f.reader.fetch(new Request(url+'?contract=2',{signal:abort.signal}));
    const next=f.reader.fetch(new Request(url+'?contract=2&view=archive'));
    expect(f.reader.waiters).toHaveLength(2);abort.abort();
    expect((await head).headers.get('x-probpera-news-reader-status')).toBe('aborted');
    const shared=await next;expect(shared.status).toBe(200);expect(f.reader.pending).toBe(2);
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);
    await shared.body.cancel();await held.body.cancel();expect(f.reader.pending).toBe(0);
  });
  it('expires a queued reader at its admission deadline even while a slow shared load remains fenced',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
    let open;const gate=new Promise(resolve=>{open=resolve;});
    try{
      const handler=vi.fn(async(request,env,current)=>{await gate;return handleNewsRequest(request,env,current);});
      const f=fixture({handler});const first=f.reader.fetch(new Request(url+'?contract=2'));
      const queued=f.reader.fetch(new Request(url+'?contract=2&view=archive'));
      await vi.advanceTimersByTimeAsync(PUBLIC_NEWS_ADMISSION_WAIT_MS);
      const expired=await queued;expect(expired.status).toBe(503);
      expect(expired.headers.get('x-probpera-news-reader-status')).toBe('wait_expired');expect(expired.headers.get('retry-after')).toBeNull();
      expect(f.reader.waiters).toHaveLength(0);expect(f.reader.pending).toBe(0);expect(handler).toHaveBeenCalledOnce();
      expect((await first).headers.get('x-probpera-news-reader-status')).toBe('wait_expired');
      expect(f.reader.pending).toBe(0);expect(f.reader.readers.size).toBe(0);expect(vi.getTimerCount()).toBe(0);
      const loading=f.reader.loading.promise;open();await loading;await Promise.resolve();expect(f.reader.loading).toBeNull();
    }finally{open();vi.useRealTimers();}
  });
  it('refreshes the bucket and generation time at admission rather than when a request joined the queue',async()=>{
    let now=new Date('2026-09-30T12:00:29Z');const f=fixture({now:()=>now});
    const held=await f.reader.fetch(new Request(url+'?contract=2'));
    const queued=f.reader.fetch(new Request(url+'?contract=2&view=archive'));
    now=new Date('2026-09-30T12:00:32Z');f.env.NEWS_RELEASE_SHA='b'.repeat(40);
    await held.body.cancel();const response=await queued;const feed=await response.json();
    expect(response.headers.get('x-probpera-news-release')).toBe('b'.repeat(40));
    expect(feed.generatedAt).toBe(now.toISOString());expect(feed.snapshot.release).toBe('b'.repeat(40));
    await verifyPublishedNewsSnapshot(feed,{archive:true});expect(f.reader.cached.key).toContain(String(Math.floor(now.getTime()/30000)));
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(6);
  });
  it('does not reset the twenty-second arrival budget after queueing, loading or opening the body',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
    let open;const gate=new Promise(resolve=>{open=resolve;});
    try{
      let calls=0;
      const f=fixture({handler:async(request,env,current)=>{if(++calls===2)await gate;return handleNewsRequest(request,env,current);}});
      const held=await f.reader.fetch(new Request(url+'?contract=2&view=archive'));
      const heldBody=held.body.getReader();await heldBody.read();
      await vi.advanceTimersByTimeAsync(1000);
      const queued=f.reader.fetch(new Request(url+'?contract=2'));
      await vi.advanceTimersByTimeAsync(14000);
      expect(f.reader.pending).toBe(1);expect(f.reader.waiters).toHaveLength(0);expect(calls).toBe(2);
      await expect(heldBody.read()).rejects.toThrow();heldBody.releaseLock();
      await vi.advanceTimersByTimeAsync(4000);open();const response=await queued;
      expect(response.status).toBe(200);const body=response.body.getReader();await body.read();
      await vi.advanceTimersByTimeAsync(1999);expect(f.reader.pending).toBe(1);
      await vi.advanceTimersByTimeAsync(1);expect(f.reader.pending).toBe(0);
      await expect(body.read()).rejects.toThrow();body.releaseLock();expect(vi.getTimerCount()).toBe(0);
    }finally{open();vi.useRealTimers();}
  });
  it('settles a request before a hung load and bounds later requests without bypassing that load fence',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
    let open;const gate=new Promise(resolve=>{open=resolve;});
    try{
      const handler=vi.fn(async(request,env,current)=>{await gate;return handleNewsRequest(request,env,current);});
      const f=fixture({handler}),first=f.reader.fetch(new Request(url+'?contract=2'));
      await vi.advanceTimersByTimeAsync(PUBLIC_NEWS_REQUEST_DEADLINE_MS);
      expect((await first).headers.get('x-probpera-news-reader-status')).toBe('wait_expired');
      expect(f.reader.pending).toBe(0);expect(f.reader.readers.size).toBe(0);expect(vi.getTimerCount()).toBe(0);
      expect(f.reader.loading).not.toBeNull();expect(handler).toHaveBeenCalledOnce();
      // Still in the original 30-second bucket: a same-key request may share
      // the existing load, but another variant cannot allocate a second one.
      const abort=new AbortController();
      const shared=f.reader.fetch(new Request(url+'?contract=2',{signal:abort.signal}));
      const other=f.reader.fetch(new Request(url+'?contract=2&view=archive'));
      expect(f.reader.pending).toBe(1);expect(f.reader.waiters).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(PUBLIC_NEWS_ADMISSION_WAIT_MS);
      expect((await other).headers.get('x-probpera-news-reader-status')).toBe('wait_expired');
      expect(handler).toHaveBeenCalledOnce();expect(f.reader.waiters).toHaveLength(0);
      expect((await shared).headers.get('x-probpera-news-reader-status')).toBe('wait_expired');abort.abort();
      expect(f.reader.pending).toBe(0);expect(f.reader.readers.size).toBe(0);expect(vi.getTimerCount()).toBe(0);
      const loading=f.reader.loading.promise;open();await loading;await Promise.resolve();
      expect(f.reader.loading).toBeNull();
      const fresh=await f.reader.fetch(new Request(url+'?contract=2&view=archive'));
      const feed=await fresh.json();await verifyPublishedNewsSnapshot(feed,{archive:true});
      expect(feed.generatedAt).toBe(new Date().toISOString());expect(handler).toHaveBeenCalledTimes(2);
    }finally{open();vi.useRealTimers();}
  });
  it.each([false,true])('releases a lease when response construction fails with a cached graph=%s',async cached=>{
    const f=fixture({now:()=>new Date('2026-09-30T12:00:00Z')});
    if(cached)await(await f.reader.fetch(new Request(url+'?contract=2'))).json();
    const OriginalResponse=globalThis.Response;
    class FailingStreamResponse extends OriginalResponse{
      constructor(body,options){if(body instanceof ReadableStream)throw Error('private-response-failure');super(body,options);}
    }
    vi.stubGlobal('Response',FailingStreamResponse);
    try{
      const failed=await f.reader.fetch(new Request(url+'?contract=2'));
      expect(failed.status).toBe(503);expect(failed.headers.get('x-probpera-news-reader-status')).toBe('load_failed');
      expect(await failed.text()).not.toContain('private-response-failure');
      expect(f.reader.pending).toBe(0);expect(f.reader.readers.size).toBe(0);expect(f.reader.waiters).toHaveLength(0);
    }finally{vi.unstubAllGlobals();}
  });
  it('counts delayed loading inside the active lease so a nearly simultaneous different reader is not starved',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
    let open;const gate=new Promise(resolve=>{open=resolve;});
    try{
      let calls=0;
      const f=fixture({handler:async(request,env,current)=>{if(++calls===1)await gate;return handleNewsRequest(request,env,current);}});
      const archive=f.reader.fetch(new Request(url+'?contract=2&view=archive'));
      await vi.advanceTimersByTimeAsync(1);
      const waiting=f.reader.fetch(new Request(url+'?contract=2'));
      await vi.advanceTimersByTimeAsync(1999);open();
      const held=await archive;expect(held.status).toBe(200);const body=held.body.getReader();await body.read();
      expect(f.reader.pending).toBe(1);expect(f.reader.waiters).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(PUBLIC_NEWS_STREAM_LEASE_MS-2000);
      const admitted=await waiting;expect(admitted.status).toBe(200);
      await verifyPublishedNewsSnapshot(await admitted.json());
      await expect(body.read()).rejects.toThrow();body.releaseLock();
      expect(calls).toBe(2);expect(f.reader.pending).toBe(0);expect(f.reader.waiters).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    }finally{open();vi.useRealTimers();}
  });
  it.each([0,1])('uses the live waiter timer when a disconnected response loses its timer, including arrival offset %sms',async offset=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
    try{
      const f=fixture(),archive=await f.reader.fetch(new Request(url+'?contract=2&view=archive'));
      const body=archive.body.getReader();await body.read();
      // Workers can cancel timers owned by a disconnected request context.
      // Do not cancel its body or send another request to trigger lazy reaping.
      for(const lease of f.reader.readers)clearTimeout(lease.timer);
      if(offset)await vi.advanceTimersByTimeAsync(offset);
      const queued=f.reader.fetch(new Request(url+'?contract=2'));
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(PUBLIC_NEWS_STREAM_LEASE_MS-offset);
      const current=await queued;expect(current.status).toBe(200);
      await verifyPublishedNewsSnapshot(await current.json());
      await expect(body.read()).rejects.toThrow();body.releaseLock();
      expect(f.reader.pending).toBe(0);expect(f.reader.waiters).toHaveLength(0);expect(vi.getTimerCount()).toBe(0);
      expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(6);
    }finally{vi.useRealTimers();}
  });
  it.each([{jitter:25,status:200},{jitter:1100,status:503}])('leaves timer jitter headroom without reviving an expired waiter: $jitter ms',async({jitter,status})=>{
    vi.useFakeTimers();const started=new Date('2026-09-30T12:00:00Z').getTime();vi.setSystemTime(started);
    try{
      const f=fixture(),archive=await f.reader.fetch(new Request(url+'?contract=2&view=archive'));
      const body=archive.body.getReader();await body.read();
      for(const lease of f.reader.readers)clearTimeout(lease.timer);
      await vi.advanceTimersByTimeAsync(13);
      const queued=f.reader.fetch(new Request(url+'?contract=2'));
      // Model the real Workers observation: a timer woke 25 ms late after a
      // different reader had arrived only 13 ms behind the active request.
      // Moving the wall clock does not execute timers or send a reaping request.
      vi.setSystemTime(Date.now()+jitter);
      await vi.advanceTimersByTimeAsync(PUBLIC_NEWS_STREAM_LEASE_MS-13);
      const response=await queued;expect(response.status).toBe(status);
      if(status===200){
        const [lease]=f.reader.readers;
        expect(lease.expiresAt).toBe(started+13+PUBLIC_NEWS_REQUEST_DEADLINE_MS);
        const feed=await response.json();await verifyPublishedNewsSnapshot(feed);
        expect(feed.generatedAt).toBe(new Date(started+PUBLIC_NEWS_STREAM_LEASE_MS+jitter).toISOString());
        expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(6);
      }else{
        expect(response.headers.get('x-probpera-news-reader-status')).toBe('wait_expired');
        expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);
      }
      await expect(body.read()).rejects.toThrow();body.releaseLock();
      expect(f.reader.pending).toBe(0);expect(f.reader.waiters).toHaveLength(0);expect(vi.getTimerCount()).toBe(0);
    }finally{vi.useRealTimers();}
  });
  it('does not accumulate cancelled load subscribers and recovers queued work after a failed load',async()=>{
    let fail;const gate=new Promise((_,reject)=>{fail=reject;});let calls=0;
    const handler=vi.fn(async(request,env,current)=>{if(++calls===1)await gate;return handleNewsRequest(request,env,current);});
    const f=fixture({handler,now:()=>new Date('2026-09-30T12:00:00Z')});
    for(let index=0;index<24;index++){
      const abort=new AbortController(),waiting=f.reader.fetch(new Request(url+'?contract=2',{signal:abort.signal}));
      abort.abort();expect((await waiting).headers.get('x-probpera-news-reader-status')).toBe('aborted');
      expect(f.reader.pending).toBe(0);expect(f.reader.readers.size).toBe(0);expect(f.reader.waiters).toHaveLength(0);
    }
    expect(handler).toHaveBeenCalledOnce();expect(f.reader.loading).not.toBeNull();
    const same=f.reader.fetch(new Request(url+'?contract=2'));
    const next=f.reader.fetch(new Request(url+'?contract=2&view=archive'));
    fail(Error('private-provider-token'));
    const failed=await same;expect(failed.headers.get('x-probpera-news-reader-status')).toBe('load_failed');
    expect(await failed.text()).not.toContain('private-provider-token');
    const recovered=await next;expect(recovered.status).toBe(200);await verifyPublishedNewsSnapshot(await recovered.json(),{archive:true});
    expect(handler).toHaveBeenCalledTimes(2);expect(f.reader.pending).toBe(0);expect(f.reader.loading).toBeNull();
  });
  it('drops an idle old cache before loading a new graph and releases failed replacement capacity',async()=>{
    let now=new Date('2026-09-30T12:00:00Z'),failNext=false,f;
    const handler=vi.fn(async(request,env,current)=>{
      expect(f.reader.cached).toBeNull();
      if(failNext)return Response.json({error:'unavailable'},{status:503});
      return handleNewsRequest(request,env,current);
    });
    f=fixture({handler,now:()=>now});await(await f.reader.fetch(new Request(url+'?contract=2'))).json();
    expect(f.reader.cached).not.toBeNull();now=new Date(now.getTime()+30000);failNext=true;
    expect((await f.reader.fetch(new Request(url+'?contract=2'))).status).toBe(503);
    expect(f.reader.cached).toBeNull();expect(f.reader.loading).toBeNull();expect(f.reader.pending).toBe(0);
    failNext=false;await(await f.reader.fetch(new Request(url+'?contract=2'))).json();
    expect(f.reader.pending).toBe(0);expect(handler).toHaveBeenCalledTimes(3);
  });
  it('builds the production cache directly without reparsing a complete serialized Response',async()=>{
    const f=fixture({now:()=>new Date('2026-09-30T12:00:00Z')});
    const json=vi.spyOn(Response.prototype,'json');
    try{
      const response=await f.reader.fetch(new Request(url+'?contract=2'));expect(response.status).toBe(200);
      expect(json).not.toHaveBeenCalled();
      await verifyPublishedNewsSnapshot(await response.json());expect(json).toHaveBeenCalledTimes(1);
      expect(f.reader.pending).toBe(0);
    }finally{json.mockRestore();}
  });
  it('cancels a dense invalid daily profile at the first record instead of allocating the complete nested graph',async()=>{
    const f=fixture({now:()=>new Date('2026-09-30T12:00:00Z')}),cancel=vi.fn();
    const bytes=new TextEncoder().encode(JSON.stringify({records:Array.from({length:5490},()=>({junk:Array.from({length:100},()=>({}))}))}));
    let offset=0;
    const invalid=new ReadableStream({pull(controller){
      if(offset>=bytes.length){controller.close();return;}controller.enqueue(bytes.subarray(offset,offset+1024));offset+=1024;
    },cancel});
    const get=f.env.NEWS_STATE.get.getMockImplementation();
    f.env.NEWS_STATE.get.mockImplementation(async(key,...args)=>key===DAILY_NEWS_PROFILE_KEY?invalid:get(key,...args));
    const response=await f.reader.fetch(new Request(url+'?contract=2'));expect(response.status).toBe(200);
    const feed=await response.json();await verifyPublishedNewsSnapshot(feed);
    expect(cancel).toHaveBeenCalledTimes(1);expect(offset).toBeLessThan(bytes.length/100);
    expect(feed.items.some(item=>Object.hasOwn(item,'junk'))).toBe(false);expect(f.reader.pending).toBe(0);
  });
  it('recovers abandoned and aborted locked bodies inside a real Workers Durable Object',async()=>{
    const bundled=await build({stdin:{contents:`
      import {LiteraryNewsPublicReader,PUBLIC_NEWS_STREAM_LEASE_MS} from './literary-news-worker.mjs';
      import {verifyPublishedNewsSnapshot} from '../lib/literary-news-publication.mjs';
      const feedUrl='https://news.probpera.ru/api/literary-news/feed?contract=2&timeZone=';
      export class ReaderHarness {
        constructor(state){
          this.current=new Date('2026-09-30T12:00:00Z');this.reads=0;
          this.reader=new LiteraryNewsPublicReader(state,{NEWS_RELEASE_SHA:'a'.repeat(40),NEWS_STATE:{get:async()=>{this.reads++;return null;}}},
            {now:()=>this.current});
        }
        async stoppedBody(){
          let rejected=false;try{await this.body.read();}catch{rejected=true;}
          this.body.releaseLock();this.body=null;return rejected;
        }
        async fetch(request){
          const path=new URL(request.url).pathname;
          if(path==='/start'){
            this.abort=new AbortController();
            const response=await this.reader.fetch(new Request(feedUrl+'UTC',{signal:this.abort.signal}));
            this.body=response.body.getReader();const first=await this.body.read();
            return Response.json({status:response.status,pending:this.reader.pending,chunkBytes:first.value.length});
          }
          if(path==='/abort'){
            this.abort.abort();return Response.json({rejected:await this.stoppedBody(),pending:this.reader.pending,leases:this.reader.readers.size});
          }
          this.current=new Date(this.current.getTime()+PUBLIC_NEWS_STREAM_LEASE_MS);
          const response=await this.reader.fetch(new Request(feedUrl+'Europe%2FMoscow'));
          const feed=await response.json();await verifyPublishedNewsSnapshot(feed);
          return Response.json({status:response.status,rejected:await this.stoppedBody(),pending:this.reader.pending,
            leases:this.reader.readers.size,complete:feed.snapshot.complete,timeZone:feed.timeZone,reads:this.reads});
        }
      }
      export default {fetch(request,env){return env.READER.get(env.READER.idFromName('public-reader-fixture')).fetch(request);}};
    `,resolveDir:fileURLToPath(new URL('.',import.meta.url))},bundle:true,write:false,format:'esm',platform:'browser',
      target:'es2022',external:['node:*'],logLevel:'silent'});
    const runtime=new Miniflare(convertV4MiniflareOptions({name:'public-reader-fixture',modules:true,script:bundled.outputFiles[0].text,
      compatibilityDate:'2026-08-18',compatibilityFlags:['nodejs_compat'],cf:false,log:new Log(LogLevel.NONE),logRequests:false,
      durableObjects:{READER:{className:'ReaderHarness',useSQLite:true}},outboundService:async()=>{throw Error('unexpected_network_request');}}));
    try{
      const call=async path=>(await runtime.dispatchFetch('https://fixture.internal'+path)).json();
      const first=await call('/start');expect(first).toMatchObject({status:200,pending:1});expect(first.chunkBytes).toBeGreaterThan(0);
      expect(await call('/abort')).toEqual({rejected:true,pending:0,leases:0});
      expect(await call('/start')).toMatchObject({status:200,pending:1});
      expect(await call('/expire')).toEqual({status:200,rejected:true,pending:0,leases:0,complete:true,timeZone:'Europe/Moscow',reads:6});
    }finally{await runtime.dispose();}
  },15000);
});
