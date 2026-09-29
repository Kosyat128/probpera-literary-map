import {describe,expect,it,vi} from 'vitest';
import worker,{LiteraryNewsPublicReader,handlePublicNewsRequest} from './literary-news-worker.mjs';
import {NEWS_SOURCE_STATE_KEY,NEWS_HELD_QUEUE_KEY,pendingNewsSourceState} from '../lib/literary-news-state.mjs';
import {NOBEL_PROFILE_KEY} from '../lib/literary-news-nobel-profile.mjs';
import {DAILY_NEWS_PROFILE_KEY} from '../lib/literary-news-daily-profile.mjs';
import {verifyPublishedNewsSnapshot} from '../lib/literary-news-publication.mjs';
const url='https://news.probpera.ru/api/literary-news/feed';
function fixture(){const state=pendingNewsSourceState();state.privateQueue='PRIVATE_HELD_UNREVIEWED';
  const env={NEWS_RELEASE_SHA:'a'.repeat(40),NEWS_STATE:{get:vi.fn(async key=>key===NEWS_SOURCE_STATE_KEY?new Response(JSON.stringify(state)).body:null),
    put:vi.fn(),delete:vi.fn(),list:vi.fn()}};
  const reader=new LiteraryNewsPublicReader({},env);
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
});
