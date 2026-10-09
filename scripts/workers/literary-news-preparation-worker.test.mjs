import {describe,expect,it,vi} from 'vitest';
import worker,{checkedPreparationSourceUrl,createPreparationSourceFetch,createPreparationBindingAi,
  boundedNativeNewsCandidates,reusableNativeNewsRecord,runNativeNewsPreparation,PREPARATION_REPORT_KEY,
  observeNativeNewsPreparation,PREPARATION_ATTEMPT_KEY} from './literary-news-preparation-worker.mjs';
import {NEWS_PREPARATION_FENCE_KEY} from '../lib/literary-news-preparation-fence.mjs';
import {LITERARY_NEWS_SOURCES} from '../lib/literary-news-sources.mjs';
import {emptyDailyLedger,checkedDailyCandidate} from '../lib/literary-news-daily-automation.mjs';
import {DAILY_NEWS_LEDGER_KEY,DAILY_NEWS_PROFILE_KEY,DAILY_NEWS_OWNER_KEY,
  DAILY_NEWS_WINDOW,DAILY_NEWS_POLICY,DAILY_NEWS_MODELS,makeDailyApprovedPayload,dailyNewsDigest,dailyRecordHashPayload} from '../lib/literary-news-daily-profile.mjs';

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
    NEWS_STATE:{get:vi.fn(async key=>values.get(key)??null),put:vi.fn(async(key,value)=>values.set(key,
      value instanceof ReadableStream?await new Response(value).text():value))}};
  const collect=vi.fn(async()=>({details:[],counts:{checkedSources:32}}));
  return{env,values,storage,collect,run:extra=>runNativeNewsPreparation(env,storage,{now:()=>current,collect,waitImpl:async()=>{},...extra})};}
function quotaProbeExecution(){return vi.fn(async({previous,ai,current:at})=>{
  let stoppedReason=null;try{await ai.request({phase:'review',messages:[]});}catch(error){stoppedReason=error.message;}
  const state={...previous,providerStop:stoppedReason==='ai_quota_exceeded'?{reason:stoppedReason,httpStatus:null,
    retryAfterAt:new Date(Date.UTC(at.getUTCFullYear(),at.getUTCMonth(),at.getUTCDate()+1)).toISOString()}:null};
  return{state,profile:await makeDailyApprovedPayload(state.accepted,at),report:{schemaVersion:1,checkedAt:at.toISOString(),
    status:stoppedReason?'provider_degraded':'supply_degraded',stoppedReason,newlyAccepted:0,minimumDeficit:10}};
});}

describe('Private native daily preparation and bounded public source adapter',()=>{
  it('records successful and cooldown attempts without replacing the publication checkpoint',async()=>{
    const f=fixture(),old=JSON.stringify({checkedAt:'2026-09-29T00:17:00Z',stoppedReason:'ai_quota_exceeded'});
    f.values.set(PREPARATION_REPORT_KEY,old);
    const report={status:'provider_quota_cooldown',stoppedReason:'ai_quota_exceeded',checkedAt:'2026-09-30T00:17:00Z',
      retryAfterAt:'2026-10-01T00:00:00.000Z',publicationConfirmed:false,privateText:'must not escape'};
    expect(await observeNativeNewsPreparation(f.env,f.storage,{now:()=>current,run:async()=>report})).toEqual({report,httpStatus:200});
    const attempt=JSON.parse(f.values.get(PREPARATION_ATTEMPT_KEY));
    expect(attempt).toEqual({schemaVersion:1,startedAt:current.toISOString(),finishedAt:current.toISOString(),
      status:'provider_quota_cooldown',reason:'ai_quota_exceeded',publicationConfirmed:false,retryAfterAt:'2026-10-01T00:00:00.000Z'});
    expect(f.values.get(PREPARATION_REPORT_KEY)).toBe(old);expect(JSON.stringify(attempt)).not.toContain('must not escape');
  });
  it('records a safe failure reason while retaining content and never leaking remote exception text',async()=>{
    const f=fixture();
    const result=await observeNativeNewsPreparation(f.env,f.storage,{now:()=>current,run:async()=>{throw Error('https://secret.invalid/token');}});
    expect(result).toMatchObject({httpStatus:503,report:{status:'degraded',reason:'daily_preparation_unavailable'}});
    const attempt=JSON.parse(f.values.get(PREPARATION_ATTEMPT_KEY));
    expect(attempt.reason).toBe('daily_preparation_unavailable');expect(attempt.publicationConfirmed).toBe(false);
    expect(f.values.size).toBe(1);expect(JSON.stringify(attempt)).not.toContain('secret');
  });
  it('does not undo a publication or infer failure when only the attempt diagnostic write fails',async()=>{
    const f=fixture();f.env.NEWS_STATE.put.mockRejectedValue(Error('network failure'));
    const result=await observeNativeNewsPreparation(f.env,f.storage,{now:()=>current,
      run:async()=>({status:'target_met',publicationConfirmed:true})});
    expect(result).toEqual({httpStatus:200,report:{status:'target_met',publicationConfirmed:true,diagnosticRecorded:false}});
  });
  it('does not write diagnostic state when preparation is disabled',async()=>{
    const f=fixture();f.env.NEWS_AUTOMATION_ENABLED='false';
    await observeNativeNewsPreparation(f.env,f.storage,{now:()=>current,run:async()=>({status:'disabled'})});
    expect(f.env.NEWS_STATE.put).not.toHaveBeenCalled();
  });
  it('disabled scheduling/public requests do no storage, inference or network work',async()=>{
    const f=fixture();f.env.NEWS_AUTOMATION_ENABLED='false';
    expect((await f.run()).status).toBe('disabled');expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();expect(f.collect).not.toHaveBeenCalled();
    expect((await worker.fetch(new Request('https://public.example/run',{method:'POST'}))).status).toBe(404);
    expect(f.env.AI.run).not.toHaveBeenCalled();
  });
  it('same-UTC-day quota cooldown leaves the original report, ledger, profile, owner and lease untouched',async()=>{
    const f=fixture();await f.run();
    const checkedAt='2026-09-30T08:00:00Z';f.values.set(PREPARATION_REPORT_KEY,JSON.stringify({checkedAt,stoppedReason:'ai_quota_exceeded'}));
    const before=structuredClone(f.values),fence=await f.storage.get(NEWS_PREPARATION_FENCE_KEY),execute=quotaProbeExecution();
    const transactions=vi.spyOn(f.storage,'transaction');f.env.NEWS_STATE.get.mockClear();f.env.NEWS_STATE.put.mockClear();f.collect.mockClear();
    expect(await f.run({execute})).toEqual({status:'provider_quota_cooldown',stoppedReason:'ai_quota_exceeded',checkedAt,
      retryAfterAt:'2026-10-01T00:00:00.000Z',publicationConfirmed:false,deliveryConfirmed:false});
    expect(f.env.NEWS_STATE.get.mock.calls).toEqual([[DAILY_NEWS_OWNER_KEY,'text'],[PREPARATION_REPORT_KEY,'stream']]);
    expect(f.values).toEqual(before);expect(await f.storage.get(NEWS_PREPARATION_FENCE_KEY)).toEqual(fence);
    expect(transactions).not.toHaveBeenCalled();expect(f.env.NEWS_STATE.put).not.toHaveBeenCalled();
    expect(f.collect).not.toHaveBeenCalled();expect(execute).not.toHaveBeenCalled();expect(f.env.AI.run).not.toHaveBeenCalled();
  });
  it.each([
    ['2026-09-30T20:59:50Z','2026-09-30T21:01:00Z',true], // Moscow midnight does not reset UTC quota.
    ['2026-09-30T23:59:50Z','2026-10-01T00:00:00Z',false], // Same Moscow date, next UTC day.
    ['2026-10-01T02:59:50+03:00','2026-10-01T00:00:00Z',false], // Normalize an offset before comparing UTC dates.
  ])('uses UTC quota boundary for report %s and tick %s',async(checkedAt,tick,cooling)=>{
    const f=fixture(),execute=quotaProbeExecution();f.env.AI.run.mockResolvedValue({response:'{"status":"held"}'});
    f.values.set(PREPARATION_REPORT_KEY,JSON.stringify({checkedAt,stoppedReason:'ai_quota_exceeded'}));
    const report=await f.run({now:()=>new Date(tick),execute});
    expect(report.status).toBe(cooling?'provider_quota_cooldown':'supply_degraded');
    expect(f.env.AI.run).toHaveBeenCalledTimes(cooling?0:1);expect(execute).toHaveBeenCalledTimes(cooling?0:1);
  });
  it('next UTC day retries the actual binding once; repeated quota persists today and blocks further same-day ticks',async()=>{
    const f=fixture(),execute=quotaProbeExecution();f.env.AI.run.mockResolvedValue({errors:[{code:4006}]});
    f.values.set(PREPARATION_REPORT_KEY,JSON.stringify({checkedAt:'2026-09-30T23:50:00Z',stoppedReason:'ai_quota_exceeded'}));
    const first=await f.run({now:()=>new Date('2026-10-01T00:07:00Z'),execute});
    expect(first.stoppedReason).toBe('ai_quota_exceeded');expect(f.env.AI.run).toHaveBeenCalledTimes(1);
    const saved=f.values.get(PREPARATION_REPORT_KEY),fence=await f.storage.get(NEWS_PREPARATION_FENCE_KEY);
    expect(JSON.parse(saved).checkedAt).toBe('2026-10-01T00:07:00.000Z');
    const second=await f.run({now:()=>new Date('2026-10-01T22:00:00Z'),execute});
    expect(second.status).toBe('provider_quota_cooldown');expect(f.values.get(PREPARATION_REPORT_KEY)).toBe(saved);
    expect(await f.storage.get(NEWS_PREPARATION_FENCE_KEY)).toEqual(fence);expect(f.env.AI.run).toHaveBeenCalledTimes(1);
    f.env.AI.run.mockResolvedValue({response:'{"status":"held"}'});
    expect((await f.run({now:()=>new Date('2026-10-02T00:07:00Z'),execute})).status).toBe('supply_degraded');
    expect(f.env.AI.run).toHaveBeenCalledTimes(2);expect(JSON.parse(f.values.get(DAILY_NEWS_LEDGER_KEY)).providerStop).toBeNull();
  });
  it('records the actual stop day when an inference run crosses UTC midnight',async()=>{
    const f=fixture(),probe=quotaProbeExecution(),started=new Date('2026-09-30T23:59:58Z'),stopped=new Date('2026-10-01T00:00:02Z');
    f.env.AI.run.mockResolvedValue({errors:[{code:4006}]});let ticks=0;
    const execute=async args=>{const result=await probe(args);result.report.checkedAt=started.toISOString();return result;};
    const report=await f.run({now:()=>ticks++===0?started:stopped,execute});
    expect(report.checkedAt).toBe(stopped.toISOString());expect(report.stoppedReason).toBe('ai_quota_exceeded');
    expect((await f.run({now:()=>new Date('2026-10-01T01:00:00Z'),execute})).status).toBe('provider_quota_cooldown');
    expect(f.env.AI.run).toHaveBeenCalledTimes(1);
  });
  it.each([undefined,null,'2026-09-30','invalid','2026-10-01T00:00:00Z'])('invalid or future quota timestamp %s fails closed without touching the fence',async checkedAt=>{
    const f=fixture(),execute=quotaProbeExecution();f.values.set(PREPARATION_REPORT_KEY,JSON.stringify({checkedAt,stoppedReason:'ai_quota_exceeded'}));
    await expect(f.run({execute})).rejects.toThrow('daily_provider_quota_checkpoint_uncertain');
    expect(f.env.AI.run).not.toHaveBeenCalled();expect(execute).not.toHaveBeenCalled();expect(f.env.NEWS_STATE.put).not.toHaveBeenCalled();
    expect(await f.storage.get(NEWS_PREPARATION_FENCE_KEY)).toBeUndefined();
  });
  it('retained non-quota errors do not bypass the next actual attempt or authorize a competing owner',async()=>{
    const f=fixture(),execute=quotaProbeExecution();f.env.AI.run.mockResolvedValue({response:'{"status":"held"}'});
    f.values.set(PREPARATION_REPORT_KEY,JSON.stringify({checkedAt:current.toISOString(),stoppedReason:'ai_http_401'}));
    expect((await f.run({execute})).status).toBe('supply_degraded');expect(f.env.AI.run).toHaveBeenCalledTimes(1);
    f.values.set(PREPARATION_REPORT_KEY,JSON.stringify({checkedAt:current.toISOString(),stoppedReason:'ai_quota_exceeded'}));
    f.values.set(DAILY_NEWS_OWNER_KEY,JSON.stringify({schemaVersion:1,owner:'node-fallback',nativeEnabled:false,drained:true}));
    await expect(f.run({execute})).rejects.toThrow('daily_native_owner_not_authorized');expect(f.env.AI.run).toHaveBeenCalledTimes(1);
  });
  it('bounds the one report read and keeps disabled mode free of report reads',async()=>{
    const f=fixture();f.values.set(PREPARATION_REPORT_KEY,' '.repeat(65537));
    await expect(f.run()).rejects.toThrow('daily_storage_capacity');expect(f.env.NEWS_STATE.put).not.toHaveBeenCalled();
    expect(f.env.NEWS_STATE.get.mock.calls.filter(([key])=>key===PREPARATION_REPORT_KEY)).toHaveLength(1);
    f.env.NEWS_STATE.get.mockClear();f.env.NEWS_AUTOMATION_ENABLED='false';
    expect((await f.run()).status).toBe('disabled');expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();expect(f.env.AI.run).not.toHaveBeenCalled();
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
    f.env.NEWS_STATE.put.mockImplementation(async(key,value)=>{f.values.set(key,value instanceof ReadableStream?await new Response(value).text():value);
      if(key===DAILY_NEWS_PROFILE_KEY&&lost){lost=false;throw Error('simulated_lost_response');}});
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
    const annual=await boundedNativeNewsCandidates({details:all},{...emptyDailyLedger(current),accepted:new Array(3000)},current,sources);
    expect(annual.maximum).toBe(2);expect(annual.intake.details).toHaveLength(2);
  });
  it('reuses prior immutable records only after validating the incoming content, not just its copied old hash field',async()=>{
    const url='https://source.example/news/verified-proof',hash='a'.repeat(64),record={
      id:'daily-'+(await dailyNewsDigest(url)).slice(0,32),eventKey:'daily-topic:'+(await dailyNewsDigest('fixture-topic')).slice(0,40),
      sourceId:'fixture',kind:'news',category:'releases',eventDate:'2026-09-30',publishedAt:'2026-09-30T08:00:00Z',verifiedAt:current.toISOString(),verification:'confirmed',
      title:{ru:'Новый роман',en:'New novel'},summary:{ru:'Издатель представил новый роман.',en:'The publisher announced a new novel.'},
      source:{name:sources[0].name,url,language:'en'},provenance:{reviewKind:'machineReviewed',policy:DAILY_NEWS_POLICY,firstAcceptedAt:current.toISOString(),
        draftModel:DAILY_NEWS_MODELS.draft,reviewModel:DAILY_NEWS_MODELS.review,eventDateBasis:'source-publication',draftSha256:hash,reviewSha256:hash,reviewPassed:true,
        sourceEvidence:{documentSha256:hash,textSha256:hash,accessedAt:'2026-09-30T08:00:00Z',publication:{value:'2026-09-30T08:00:00Z',method:'jsonld.datePublished'},
          quotes:['The publisher announced a new novel.'],literaryQuote:'new novel'}}};
    record.provenance.recordSha256=await dailyNewsDigest(dailyRecordHashPayload(record));const prior=new Map([[record.id,record]]);
    expect(await reusableNativeNewsRecord(structuredClone(record),prior,current,sources)).toBe(record);
    const tampered=structuredClone(record);tampered.title.en='An unsupported replacement';
    await expect(reusableNativeNewsRecord(tampered,prior,current,sources)).rejects.toThrow('daily_record_proof_invalid');
    expect(prior.get(record.id).title.en).toBe('New novel');
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
  it('accepts a 1.6 MB detail only under its matched frozen registered profile and ignores caller limits',async()=>{
    const size=1_600_000,approved=[Object.freeze({...sources[0],detailMaxBytes:2*1024*1024})];
    const body=()=>new Response(new Uint8Array(size),{headers:{'content-type':'text/html'}});
    const fetchImpl=vi.fn(async()=>body()),fetchSource=createPreparationSourceFetch({sources:approved,fetchImpl,current:()=>current,maxRequests:2});
    const evidence=await fetchSource('https://source.example/news/item1',{maxBytes:1});
    expect(evidence).toMatchObject({bytes:size,status:200,accessedAt:current.toISOString()});
    expect(evidence.rawBytes).toBeUndefined();expect(evidence.sha256).toMatch(/^[a-f0-9]{64}$/);
    await expect(fetchSource('https://unregistered.example/news/item1',{maxBytes:2*1024*1024})).rejects.toThrow('daily_source_destination_rejected');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(createPreparationSourceFetch({sources,fetchImpl})('https://source.example/news/item1',{maxBytes:Infinity}))
      .rejects.toThrow('daily_source_response_too_large');
    await expect(createPreparationSourceFetch({sources:approved,fetchImpl})('https://source.example/news/',{includeBytes:true,maxBytes:Infinity}))
      .rejects.toThrow('daily_source_response_too_large');
    const untrustedCaller={includeBytes:false};Object.defineProperty(untrustedCaller,'maxBytes',{get(){throw Error('caller_limit_read');}});
    expect((await fetchSource('https://source.example/news/item2',untrustedCaller)).bytes).toBe(size);
    await expect(fetchSource('https://source.example/news/item3')).rejects.toThrow('daily_source_request_budget');
  });
  it('uses the two measured magazine/library exceptions from the actual frozen registry',async()=>{
    for(const id of ['asymptote','landesbibliothek-li']){
      const source=LITERARY_NEWS_SOURCES.find(item=>item.id===id),size=1_600_000;
      expect(Object.isFrozen(source)).toBe(true);expect(source.detailMaxBytes).toBe(2*1024*1024);
      const input=source.exampleArticleUrls[0],fetchImpl=vi.fn(async()=>new Response(new Uint8Array(size),{headers:{'content-type':'text/html'}}));
      const evidence=await createPreparationSourceFetch({fetchImpl})(input);
      expect(evidence.bytes).toBe(size);expect(evidence.rawBytes).toBeUndefined();expect(fetchImpl).toHaveBeenCalledTimes(1);
      const signal=fetchImpl.mock.calls[0][1].signal;expect(signal).toBeInstanceOf(AbortSignal);
    }
  });
  it.each([false,true])('enforces the exact 2 MiB cap for approved detail/listing overrides, including streamed bytes (%s)',async includeBytes=>{
    const cap=2*1024*1024,approved=[Object.freeze({...sources[0],listingMaxBytes:cap,detailMaxBytes:cap})];
    const input=includeBytes?'https://source.example/news/':'https://source.example/news/item1';
    const exact=vi.fn(async()=>new Response(new Uint8Array(cap),{headers:{'content-type':'text/html'}}));
    expect((await createPreparationSourceFetch({sources:approved,fetchImpl:exact})(input,{includeBytes})).bytes).toBe(cap);
    const cancelled=vi.fn(),stream=()=>new ReadableStream({start(controller){controller.enqueue(new Uint8Array(cap+1));},cancel:cancelled});
    const excess=vi.fn(async()=>new Response(stream(),{headers:{'content-type':'text/html'}}));
    await expect(createPreparationSourceFetch({sources:approved,fetchImpl:excess})(input,{includeBytes,maxBytes:cap*10}))
      .rejects.toThrow('daily_source_response_too_large');
    expect(cancelled).toHaveBeenCalledTimes(1);
    const oversizedHeader=vi.fn(async()=>new Response(stream(),{headers:{'content-type':'text/html','content-length':String(cap+1)}}));
    await expect(createPreparationSourceFetch({sources:approved,fetchImpl:oversizedHeader})(input,{includeBytes}))
      .rejects.toThrow('daily_source_response_too_large');
    expect(cancelled).toHaveBeenCalledTimes(2);
  });
  it('rejects malformed, inherited, accessor and mutable profile overrides before any fetch',async()=>{
    const fetchImpl=vi.fn();
    for(const field of ['listingMaxBytes','detailMaxBytes'])for(const value of [undefined,null,0,-1,1.5,'2097152',NaN,Infinity,2*1024*1024+1,Number.MAX_SAFE_INTEGER]){
      const approved=[Object.freeze({...sources[0],[field]:value})];
      await expect(createPreparationSourceFetch({sources:approved,fetchImpl})('https://source.example/news/item1'))
        .rejects.toThrow('daily_source_byte_limit_invalid');
    }
    const inherited=Object.freeze(Object.assign(Object.create({detailMaxBytes:2*1024*1024}),sources[0]));
    const getter=vi.fn(()=>2*1024*1024),accessor={...sources[0]};Object.defineProperty(accessor,'detailMaxBytes',{get:getter});Object.freeze(accessor);
    for(const source of [inherited,accessor,{...sources[0],detailMaxBytes:2*1024*1024}])
      await expect(createPreparationSourceFetch({sources:[source],fetchImpl})('https://source.example/news/item1'))
        .rejects.toThrow('daily_source_byte_limit_invalid');
    expect(fetchImpl).not.toHaveBeenCalled();expect(getter).not.toHaveBeenCalled();
  });
  it('uses the matched destination profile after a same-origin redirect and retains deadline enforcement',async()=>{
    const approved=[Object.freeze({...sources[0],detailMaxBytes:2*1024*1024}),
      Object.freeze({...sources[0],id:'small-fixture',url:'https://source.example/short/',linkPattern:/^\/short\/[^/]+$/})];
    const cancelled=vi.fn(),redirectBody=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1));},cancel:cancelled});
    const fetchImpl=vi.fn(async url=>url.includes('/news/')?new Response(redirectBody,{status:302,headers:{location:'/short/item1'}}):
      new Response(new Uint8Array(512*1024+1),{headers:{'content-type':'text/html'}}));
    await expect(createPreparationSourceFetch({sources:approved,fetchImpl})('https://source.example/news/item1'))
      .rejects.toThrow('daily_source_response_too_large');
    expect(fetchImpl).toHaveBeenCalledTimes(2);expect(cancelled).toHaveBeenCalledTimes(1);
    const noNetwork=vi.fn();
    await expect(createPreparationSourceFetch({sources:approved,fetchImpl:noNetwork,current:()=>current,deadline:current.getTime()})
      ('https://source.example/news/item1')).rejects.toThrow('daily_preparation_deadline');
    expect(noNetwork).not.toHaveBeenCalled();
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
