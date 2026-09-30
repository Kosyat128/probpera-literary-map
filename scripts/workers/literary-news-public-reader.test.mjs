import {describe,expect,it,vi} from 'vitest';
import worker,{LiteraryNewsPublicReader,handlePublicNewsRequest,handleNewsRequest} from './literary-news-worker.mjs';
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
});
