import {describe,expect,it,vi} from 'vitest';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from 'miniflare';
import worker,{LiteraryNewsPublicReader,handlePublicNewsRequest,handleNewsRequest,PUBLIC_NEWS_STREAM_LEASE_MS} from './literary-news-worker.mjs';
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
  it('caps active/queued readers at eight and releases capacity on completion and cancellation',async()=>{
    let open;const gate=new Promise(resolve=>{open=resolve;});
    const handler=async(request,env,current)=>{await gate;return handleNewsRequest(request,env,current);};
    const f=fixture({handler,now:()=>new Date('2026-09-30T12:00:00Z')});
    const waiting=Array.from({length:8},()=>f.reader.fetch(new Request(url+'?contract=2')));
    expect((await f.reader.fetch(new Request(url+'?contract=2'))).status).toBe(503);expect(f.reader.pending).toBe(8);
    open();const responses=await Promise.all(waiting);expect(f.reader.pending).toBe(8);
    await responses[0].body.cancel();await Promise.all(responses.slice(1).map(response=>response.json()));
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
    now=new Date(now.getTime()+PUBLIC_NEWS_STREAM_LEASE_MS);
    const rejected=await f.reader.fetch(new Request(url+'?contract=2&timeZone=Europe%2FMoscow'));
    expect(rejected.status).toBe(503);expect(handler).toHaveBeenCalledOnce();expect(f.reader.loading).not.toBeNull();
    expect(f.reader.pending).toBe(0);expect(f.reader.readers.size).toBe(0);
    open();expect((await first).status).toBe(503);expect(f.reader.loading).toBeNull();
    const next=await f.reader.fetch(new Request(url+'?contract=2&timeZone=Europe%2FMoscow'));
    expect(next.status).toBe(200);await verifyPublishedNewsSnapshot(await next.json());
    expect(handler).toHaveBeenCalledTimes(2);expect(f.reader.pending).toBe(0);
  });
  it('holds one shared snapshot for eight unfinished streams and rejects every different variant until they release',async()=>{
    let now=new Date('2026-09-30T12:00:00Z');const f=fixture({now:()=>now});
    const same=url+'?contract=2&timeZone=UTC';
    const responses=await Promise.all(Array.from({length:8},()=>f.reader.fetch(new Request(same))));
    expect(responses.every(response=>response.status===200)).toBe(true);expect(f.reader.pending).toBe(8);
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);
    for(const zone of ['Europe/Moscow','Asia/Tokyo','America/New_York','Europe/London','Europe/Paris','Australia/Melbourne','Europe/Berlin','Asia/Shanghai']){
      const response=await f.reader.fetch(new Request(url+'?contract=2&timeZone='+encodeURIComponent(zone)));
      expect(response.status).toBe(503);expect(response.headers.get('retry-after')).toBe('1');
    }
    // One remaining stream still owns the entire graph, including across bucket,
    // contract and release changes; none may initiate another annual-profile load.
    await Promise.all(responses.slice(1).map(response=>response.body.cancel()));expect(f.reader.pending).toBe(1);
    now=new Date(now.getTime()+30000);f.env.NEWS_RELEASE_SHA='b'.repeat(40);
    for(const target of [same,url+'?contract=1&timeZone=UTC',url+'?contract=2&timeZone=Asia%2FTokyo'])
      expect((await f.reader.fetch(new Request(target))).status).toBe(503);
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);
    await responses[0].body.cancel();expect(f.reader.pending).toBe(0);expect(f.reader.activeKey).toBeNull();
    const next=await f.reader.fetch(new Request(url+'?contract=2&timeZone=Asia%2FTokyo'));
    expect(next.status).toBe(200);expect((await next.json()).timeZone).toBe('Asia/Tokyo');
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(6);expect(f.reader.pending).toBe(0);
  });
  it('rejects different keys during the first load instead of queueing another profile graph',async()=>{
    let open;const gate=new Promise(resolve=>{open=resolve;});
    const handler=vi.fn(async(request,env,current)=>{await gate;return handleNewsRequest(request,env,current);});
    const f=fixture({handler,now:()=>new Date('2026-09-30T12:00:00Z')});
    const first=f.reader.fetch(new Request(url+'?contract=2&timeZone=UTC'));
    for(const zone of ['Europe/Moscow','Asia/Tokyo','America/New_York','Europe/London','Europe/Paris','Australia/Melbourne','Europe/Berlin','Asia/Shanghai']){
      const response=await f.reader.fetch(new Request(url+'?contract=2&timeZone='+encodeURIComponent(zone)));
      expect(response.status).toBe(503);expect(response.headers.get('retry-after')).toBe('1');
    }
    expect(handler).toHaveBeenCalledTimes(1);expect(f.reader.pending).toBe(1);expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();
    open();const response=await first;expect(response.status).toBe(200);await response.json();
    expect(f.env.NEWS_STATE.get).toHaveBeenCalledTimes(3);expect(f.reader.pending).toBe(0);
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
