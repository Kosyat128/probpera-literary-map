import {describe,expect,it,vi} from 'vitest';
import worker,{checkedPreparationSourceUrl,createPreparationSourceFetch,createPreparationBindingAi,
  boundedNativeNewsCandidates,runNativeNewsPreparation,PREPARATION_REPORT_KEY} from './literary-news-preparation-worker.mjs';
import {NEWS_PREPARATION_FENCE_KEY} from '../lib/literary-news-preparation-fence.mjs';
import {emptyDailyLedger,checkedDailyCandidate} from '../lib/literary-news-daily-automation.mjs';
import {DAILY_NEWS_LEDGER_KEY,DAILY_NEWS_PROFILE_KEY,DAILY_NEWS_OWNER_KEY,
  DAILY_NEWS_WINDOW,makeDailyApprovedPayload,dailyNewsDigest} from '../lib/literary-news-daily-profile.mjs';

const current=new Date('2026-09-30T12:00:00Z');
const sources=[{id:'fixture',name:'Literary Fixture',url:'https://source.example/news/',language:'en',topics:['releases'],
  articleOrigins:['https://source.example'],linkPattern:/^\/news\/[^/]+$/,
  pagination:{allowedPathPattern:/^\/news\/page\/[1-9][0-9]*\/$/g}}];
function detail(n){const url='https://source.example/news/item'+n;return{sourceId:'fixture',source:{url},evidence:{
  url,canonical:url,httpStatus:200,responseSha256:'a'.repeat(64),accessedAt:current.toISOString(),headline:'New novel '+n,
  text:'The publisher released a new literary novel for readers. This factual source paragraph discusses its author and the current literary publishing programme. Novel '+n,
  publishedDates:[{value:'2026-09-30T08:00:00Z',method:'jsonld.datePublished'}]}};}
function storageFixture(){let values=new Map(),tail=Promise.resolve();return{get:async key=>structuredClone(values.get(key)),
  async transaction(work){const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});await previous;
    const next=new Map([...values].map(([k,v])=>[k,structuredClone(v)]));
    try{const result=await work({get:async key=>structuredClone(next.get(key)),put:async(key,value)=>next.set(key,structuredClone(value))});values=next;return result;}finally{release();}}};}
function fixture(){const values=new Map(),storage=storageFixture();
  const env={NEWS_AUTOMATION_ENABLED:'true',NEWS_AUTOMATION_WRITER:'native',NEWS_AUTOMATION_BOOTSTRAP:'true',AI:{run:vi.fn()},
    NEWS_STATE:{get:vi.fn(async key=>values.get(key)??null),put:vi.fn(async(key,value)=>values.set(key,value))}};
  const collect=vi.fn(async()=>({details:[],counts:{checkedSources:32}}));
  return{env,values,storage,collect,run:extra=>runNativeNewsPreparation(env,storage,{now:()=>current,collect,waitImpl:async()=>{},...extra})};}

describe('Private native daily preparation and bounded public source adapter',()=>{
  it('disabled scheduling/public requests do no storage, inference or network work',async()=>{
    const f=fixture();f.env.NEWS_AUTOMATION_ENABLED='false';
    expect((await f.run()).status).toBe('disabled');expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();expect(f.collect).not.toHaveBeenCalled();
    expect((await worker.fetch(new Request('https://public.example/run',{method:'POST'}))).status).toBe(404);
    expect(f.env.AI.run).not.toHaveBeenCalled();
  });
  it('uses the shared Moscow annual boundary and requires native owner or explicit bootstrap',async()=>{
    const f=fixture();expect((await f.run({now:()=>new Date(DAILY_NEWS_WINDOW.endExclusive+'T00:00:00+03:00')})).status).toBe('outside_admission_window');
    f.env.NEWS_AUTOMATION_BOOTSTRAP='false';await expect(f.run()).rejects.toThrow('daily_native_owner_not_authorized');
    f.env.NEWS_AUTOMATION_BOOTSTRAP='true';f.values.set(DAILY_NEWS_OWNER_KEY,JSON.stringify({schemaVersion:1,owner:'node-fallback',nativeEnabled:false,drained:true}));
    await expect(f.run()).rejects.toThrow('daily_native_owner_not_authorized');expect(f.env.NEWS_STATE.put).not.toHaveBeenCalled();
  });
  it('a corrupt existing ledger or profile is never reset by bootstrap',async()=>{
    const f=fixture();f.values.set(DAILY_NEWS_LEDGER_KEY,'{"accepted":"broken"}');
    await expect(f.run()).rejects.toThrow('daily_ledger_invalid');expect(f.env.NEWS_STATE.put).not.toHaveBeenCalled();
    f.values.delete(DAILY_NEWS_LEDGER_KEY);f.values.set(DAILY_NEWS_PROFILE_KEY,'{"records":"broken"}');
    await expect(f.run()).rejects.toThrow('daily_profile_invalid');expect(await f.storage.get(NEWS_PREPARATION_FENCE_KEY)).toBeUndefined();
  });
  it('publishes only validated profile/ledger and reports the actual empty daily deficit',async()=>{
    const f=fixture(),report=await f.run();
    expect(report).toMatchObject({status:'supply_degraded',minimumDeficit:10,newlyAccepted:0,publicationConfirmed:true,deliveryConfirmed:false,
      native:{maximumCandidateAttempts:5,maximumAiCalls:10,sourceCounts:{checkedSources:32}}});
    expect(f.env.AI.run).not.toHaveBeenCalled();
    expect(JSON.parse(f.values.get(DAILY_NEWS_OWNER_KEY))).toMatchObject({owner:'native',nativeEnabled:true,drained:false});
    expect(JSON.parse(f.values.get(DAILY_NEWS_LEDGER_KEY)).accepted).toEqual([]);
    expect(JSON.parse(f.values.get(PREPARATION_REPORT_KEY)).minimumDeficit).toBe(10);
    expect(await f.storage.get(NEWS_PREPARATION_FENCE_KEY)).toMatchObject({lease:null,pendingLedgerSha:null,pendingProfileSha:null});
  });
  it('preserves a saved inference budget and fences a profile PUT with a lost acknowledgement',async()=>{
    const f=fixture();let lost=true;
    f.env.NEWS_STATE.put.mockImplementation(async(key,value)=>{f.values.set(key,value);if(key===DAILY_NEWS_PROFILE_KEY&&lost){lost=false;throw Error('simulated_lost_response');}});
    const execute=async({previous,saveCheckpoint})=>{const state={...previous,inferenceBudgets:[{day:'2026-09-30',reservedCalls:1,draftRequests:1}]};
      await saveCheckpoint(state);return{state,profile:await makeDailyApprovedPayload(state.accepted,current),report:{status:'supply_degraded',minimumDeficit:10}};};
    await expect(f.run({execute})).rejects.toThrow('simulated_lost_response');
    expect(JSON.parse(f.values.get(DAILY_NEWS_LEDGER_KEY)).inferenceBudgets[0].reservedCalls).toBe(1);
    const control=await f.storage.get(NEWS_PREPARATION_FENCE_KEY);expect(control.lease).toBeNull();expect(control.pendingProfileSha).toMatch(/^[a-f0-9]{64}$/);
    expect((await f.run({execute})).publicationConfirmed).toBe(true);
    expect((await f.storage.get(NEWS_PREPARATION_FENCE_KEY)).pendingProfileSha).toBeNull();
  });
  it('admits at most five eligible candidates, bypasses unchanged rejections and does not infer unknown dates',async()=>{
    const all=Array.from({length:9},(_,n)=>detail(n)),unknown=detail(99);unknown.evidence.publishedDates=[];
    const rejected=await checkedDailyCandidate(all[0],current,sources);
    const bounded=await boundedNativeNewsCandidates({details:[unknown,...all]},
      {...emptyDailyLedger(current),reviewCache:[{key:rejected.key,status:'rejected',reason:'daily_draft_ungrounded'}]},current,sources);
    expect(bounded.intake.details).toEqual(all.slice(1,6));expect(bounded.held.map(row=>row.reason)).toEqual(['daily_publication_date_unknown','daily_draft_ungrounded']);
  });
  it('accepts only code-owned HTTPS hosts and valid immutable pagination',()=>{
    for(const url of ['http://source.example/news/item1','https://source.example:8443/news/item1','https://u:p@source.example/news/item1',
      'https://127.0.0.1/news/item1','https://source.example/account/private','https://other.example/news/item1'])
      expect(()=>checkedPreparationSourceUrl(url,sources)).toThrow('daily_source_destination_rejected');
    Object.freeze(sources[0].pagination.allowedPathPattern);
    expect(checkedPreparationSourceUrl('https://source.example/news/page/2/',sources).source.id).toBe('fixture');
  });
  it('fetches bounded source bytes with exact evidence hash and rejects cross-host redirects before fetching them',async()=>{
    const html='<html><h1>A literary news article</h1></html>',fetchImpl=vi.fn(async()=>new Response(html,{headers:{'content-type':'text/html'}}));
    const fetchSource=createPreparationSourceFetch({sources,fetchImpl,current:()=>current,maxRequests:1});
    const evidence=await fetchSource('https://source.example/news/item1',{includeBytes:true});
    const expected=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(html)))].map(n=>n.toString(16).padStart(2,'0')).join('');
    expect(evidence).toMatchObject({status:200,sha256:expected,accessedAt:current.toISOString()});expect(evidence.rawBytes.byteLength).toBe(html.length);
    await expect(fetchSource('https://source.example/news/item2')).rejects.toThrow('daily_source_request_budget');
    const redirect=vi.fn(async()=>new Response(null,{status:302,headers:{location:'https://private.example/secret'}}));
    await expect(createPreparationSourceFetch({sources,fetchImpl:redirect})('https://source.example/news/item1')).rejects.toThrow('daily_source_redirect_rejected');
    expect(redirect).toHaveBeenCalledTimes(1);
  });
  it('rejects excess source streams and unexpected MIME types',async()=>{
    const big=vi.fn(async()=>new Response(new Uint8Array(512*1024+1),{headers:{'content-type':'text/html'}}));
    await expect(createPreparationSourceFetch({sources,fetchImpl:big})('https://source.example/news/item1')).rejects.toThrow('daily_source_response_too_large');
    const binary=vi.fn(async()=>new Response('binary',{headers:{'content-type':'application/octet-stream'}}));
    await expect(createPreparationSourceFetch({sources,fetchImpl:binary})('https://source.example/news/item1')).rejects.toThrow('daily_source_content_type_invalid');
  });
  it('fits the free-plan external fetch allowance, counts redirects and closes discarded response bodies',async()=>{
    expect(()=>createPreparationSourceFetch({maxRequests:49})).toThrow('daily_source_request_budget_invalid');
    const cancelled=vi.fn(),redirectBody=()=>new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('redirect'));},cancel:cancelled});
    const redirect=vi.fn(async()=>new Response(redirectBody(),{status:302,headers:{location:'https://source.example/news/item2'}}));
    await expect(createPreparationSourceFetch({sources,fetchImpl:redirect,maxRequests:1})('https://source.example/news/item1')).rejects.toThrow('daily_source_request_budget');
    expect(redirect).toHaveBeenCalledTimes(1);expect(cancelled).toHaveBeenCalledTimes(1);
  });
  it('uses the shared AI protocol and latches quota 4006/429 without another request',async()=>{
    const binding={run:vi.fn(async()=>({response:'{"status":"held"}'}))},ai=createPreparationBindingAi(binding);
    expect(await ai.request({phase:'review',messages:[]})).toEqual({status:'held'});expect(binding.run.mock.calls[0][0]).toMatch(/^@cf\//);
    expect(binding.run.mock.calls[0][2].signal).toBeInstanceOf(AbortSignal);
    for(const result of [{errors:[{code:4006}]},{status:429,errors:[{code:429}]}]){
      const provider={run:vi.fn(async()=>result)},limited=createPreparationBindingAi(provider);
      const reason=result.status===429?'ai_http_429':'ai_quota_exceeded';
      await expect(limited.request({phase:'draft',messages:[]})).rejects.toThrow(reason);
      await expect(limited.request({phase:'draft',messages:[]})).rejects.toThrow(reason);expect(provider.run).toHaveBeenCalledTimes(1);
    }
  });
  it('scheduled quota reports stop retries and keep all public routes closed',async()=>{
    const controller={noRetry:vi.fn()},log=vi.spyOn(console,'log').mockImplementation(()=>{});
    try{await worker.scheduled(controller,{NEWS_AUTOMATION_ENABLED:'true',PREPARATION_COORDINATOR:{idFromName:()=>1,
      get:()=>({fetch:async()=>Response.json({status:'provider_degraded',stoppedReason:'ai_quota_exceeded',minimumDeficit:10})})}});
      expect(controller.noRetry).toHaveBeenCalledTimes(1);expect(log).toHaveBeenCalled();}finally{log.mockRestore();}
  });
});
