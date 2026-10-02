import {Buffer} from 'node:buffer';
import {collectDailyNewsReview} from '../lib/literary-news-daily-intake.mjs';
import {LITERARY_NEWS_SOURCES} from '../lib/literary-news-sources.mjs';
import {canonicalUrl,validTimestamp} from '../lib/literary-news-reviewed.mjs';
import {newsJsonStream} from '../lib/literary-news-json.mjs';
import {readNewsJsonArray} from '../lib/literary-news-json-reader.mjs';
import {runDailyNewsAutomation,mergeDailyLedgers,validateDailyLedger,checkedDailyCandidate} from '../lib/literary-news-daily-automation.mjs';
import {createPreparationBindingAi} from '../lib/literary-news-preparation-binding-ai.mjs';
export {createPreparationBindingAi} from '../lib/literary-news-preparation-binding-ai.mjs';
import {DAILY_NEWS_PROFILE_KEY,DAILY_NEWS_LEDGER_KEY,DAILY_NEWS_OWNER_KEY,DAILY_NEWS_WINDOW,DAILY_NEWS_LIMITS,
  dailyNewsDay,dailyNewsDigest,approvedDailySource,validateDailyApprovedPayload,validateDailyNewsRecord} from '../lib/literary-news-daily-profile.mjs';
import {acquireNewsPreparationLease,stageNewsPreparationCheckpoint,confirmNewsPreparationCheckpoint,stageNewsPreparationPublication,
  confirmNewsPreparationPublication,releaseNewsPreparationLease} from '../lib/literary-news-preparation-fence.mjs';
import reviewed from '../../data/news/reviewed.json' with{type:'json'};
import withdrawals from '../../data/news/withdrawals.json' with{type:'json'};

export const PREPARATION_REPORT_KEY='literary-news:v1:daily-automation:native-report';
const fail=code=>{throw Error(code);};
const safeError=error=>/^(?:daily_|ai_|provider_)[a-z0-9_]+$/.test(error?.message||'')?error.message:'daily_preparation_unavailable';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function byteDigest(bytes){return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}

export function checkedPreparationSourceUrl(input,sources=LITERARY_NEWS_SOURCES){
  const url=canonicalUrl(input);
  if(!url||url.port||url.href.length>2048||!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,63}$/i.test(url.hostname)
    ||/(?:^|\.)(?:localhost|local|internal|invalid|test)$/i.test(url.hostname))fail('daily_source_destination_rejected');
  const source=sources.find(s=>s.discoveryEnabled!==false&&(canonicalUrl(s.url)?.href===url.href
    ||s.pagination&&new URL(s.url).origin===url.origin&&!url.search&&new RegExp(s.pagination.allowedPathPattern.source,s.pagination.allowedPathPattern.flags.replace(/[gy]/g,'')).test(url.pathname)
    ||approvedDailySource(s.id,url.href,[s])));
  if(!source)fail('daily_source_destination_rejected');return{url,source};
}
export async function boundedPreparationBytes(response,maxBytes){
  if(!response.body)fail('daily_source_response_too_large');
  if(Number(response.headers.get('content-length'))>maxBytes){
    await response.body.cancel().catch(()=>{});fail('daily_source_response_too_large');}
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>maxBytes)fail('daily_source_response_too_large');chunks.push(Buffer.from(value));}
    return Buffer.concat(chunks,size);
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
function preparationSourceMaxBytes(source,listing){
  const checked=(field,fallback)=>{
    const property=Object.getOwnPropertyDescriptor(source,field);
    if(!property){if(field in source)fail('daily_source_byte_limit_invalid');return fallback;}
    if(!Object.isFrozen(source)||!Object.hasOwn(property,'value')||!Number.isSafeInteger(property.value)
      ||property.value<1||property.value>2*1024*1024)fail('daily_source_byte_limit_invalid');
    return property.value;
  };
  // Both fields are checked before network work, even when only one is used.
  const listingMaxBytes=checked('listingMaxBytes',1024*1024),detailMaxBytes=checked('detailMaxBytes',512*1024);
  return listing?listingMaxBytes:detailMaxBytes;
}
/** Fixed approved hosts only. Cloudflare global_fetch_strictly_public sends through the public Internet;
 * credentials, IP literals, arbitrary ports and cross-origin redirects are never accepted. */
export function createPreparationSourceFetch({sources=LITERARY_NEWS_SOURCES,fetchImpl=fetch,current=()=>new Date(),
  deadline=Infinity,maxRequests=48}={}){
  if(!Number.isSafeInteger(maxRequests)||maxRequests<1||maxRequests>48)fail('daily_source_request_budget_invalid');
  let requests=0;
  return async(input,options={})=>{
    let{url,source}=checkedPreparationSourceUrl(input,sources);
    let maxBytes=preparationSourceMaxBytes(source,options.includeBytes);
    const remaining=deadline-current().getTime();if(remaining<=0)fail('daily_preparation_deadline');
    const signal=AbortSignal.timeout(Math.min(options.includeBytes?8000:12000,remaining));
    for(let redirects=0;redirects<4;redirects++){
      if(++requests>maxRequests)fail('daily_source_request_budget');
      const response=await fetchImpl(url.href,{redirect:'manual',signal,headers:{
        Accept:'text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml,text/plain',
        'User-Agent':'ProbperaLiteraryNewsPreparation/1.0 (+https://probpera.ru)'}});
      if(response.status>=300&&response.status<400){await response.body?.cancel().catch(()=>{});const target=new URL(response.headers.get('location'),url);
        if(target.origin!==url.origin)fail('daily_source_redirect_rejected');
        ({url,source}=checkedPreparationSourceUrl(target.href,sources));
        maxBytes=preparationSourceMaxBytes(source,options.includeBytes);continue;}
      if(response.status!==200){await response.body?.cancel().catch(()=>{});fail('daily_source_http_'+response.status);}
      const contentType=response.headers.get('content-type')||'';
      if(!/^(?:text\/(?:html|xml|plain)|application\/(?:xhtml\+xml|rss\+xml|atom\+xml|xml))(?:;|$)/i.test(contentType)){
        await response.body?.cancel().catch(()=>{});fail('daily_source_content_type_invalid');}
      const rawBytes=await boundedPreparationBytes(response,maxBytes);
      const encoding=options.encoding||source.encoding||/charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType)?.[1]||'utf-8';
      let text;try{text=new TextDecoder(encoding).decode(rawBytes);}catch{fail('daily_source_encoding_invalid');}
      if(/just a moment\.\.\.|checking your browser|verify you are human|captcha-container/i.test(text.slice(0,120000)))fail('daily_source_challenge');
      return{url:url.href,status:200,contentType,bytes:rawBytes.length,text,sha256:await byteDigest(rawBytes),
        accessedAt:current().toISOString(),...(options.includeBytes?{rawBytes}:{})};
    }fail('daily_source_redirect_limit');
  };
}
async function readJsonBinding(kv,key,maxBytes,{onEntry}={}){
  const raw=await kv.get(key,maxBytes>4096?'stream':'text');if(raw===null)return null;
  if(typeof raw==='string'){
    if(Buffer.byteLength(raw,'utf8')>maxBytes)fail('daily_storage_capacity');
    try{return JSON.parse(raw);}catch{fail('daily_storage_json_invalid');}
  }
  if(typeof raw?.getReader!=='function')fail('daily_storage_capacity');
  if(key===DAILY_NEWS_PROFILE_KEY||key===DAILY_NEWS_LEDGER_KEY)return readNewsJsonArray(raw,{
    arrayKey:key===DAILY_NEWS_PROFILE_KEY?'records':'accepted',maxBytes,maxEntries:DAILY_NEWS_LIMITS.records,
    maxMetadataBytes:key===DAILY_NEWS_PROFILE_KEY?65536:2*1024*1024,...(onEntry?{onEntry}:{})});
  const reader=raw.getReader(),decoder=new TextDecoder();let bytes=0,text='';
  try{while(true){const{value,done}=await reader.read();if(done)break;bytes+=value.byteLength;
      if(bytes>maxBytes)fail('daily_storage_capacity');text+=decoder.decode(value,{stream:true});}
    try{return JSON.parse(text+decoder.decode());}catch{fail('daily_storage_json_invalid');}
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
/** Article dates and rights stay deterministic. Invalid evidence never consumes inference;
 * cached rejections cannot occupy all five slots forever. */
export async function boundedNativeNewsCandidates(intake,state,current,sources=LITERARY_NEWS_SOURCES){
  const maximum=(state.accepted?.length||0)>=3000?2:5;
  const details=[],held=[],cache=new Map((state.reviewCache||[]).map(row=>[row.key,row]));
  for(const detail of intake.details||[]){
    let candidate;
    try{candidate=await checkedDailyCandidate(detail,current,sources);}
    catch(error){held.push({sourceId:detail?.sourceId||null,reason:safeError(error)});continue;}
    const cached=cache.get(candidate.key);
    if(cached?.status==='rejected'){held.push({sourceId:candidate.source.id,reason:cached.reason});continue;}
    if(details.length<maximum)details.push(detail);
  }
  return{intake:{...intake,details},held,maximum};
}
export async function reusableNativeNewsRecord(record,priorRecords,current,sources=LITERARY_NEWS_SOURCES){
  await validateDailyNewsRecord(record,current,{sources});const prior=priorRecords.get(record.id);
  return prior?.provenance.recordSha256===record.provenance.recordSha256?prior:record;
}
export async function runNativeNewsPreparation(env,storage,{now=()=>new Date(),collect=collectDailyNewsReview,
  execute=runDailyNewsAutomation,fetchImpl=fetch,waitImpl=sleep}={}){
  const started=now(),day=dailyNewsDay(started);
  if(env.NEWS_AUTOMATION_ENABLED!=='true')return{status:'disabled',publicationConfirmed:false,deliveryConfirmed:false};
  if(day<DAILY_NEWS_WINDOW.start||day>=DAILY_NEWS_WINDOW.endExclusive)return{status:'outside_admission_window',window:DAILY_NEWS_WINDOW};
  if(env.NEWS_AUTOMATION_WRITER!=='native'||!env.NEWS_STATE||typeof env.AI?.run!=='function')fail('daily_native_bindings_missing');
  const bootstrap=env.NEWS_AUTOMATION_BOOTSTRAP==='true',deadline=started.getTime()+6*60000;
  const owner=await readJsonBinding(env.NEWS_STATE,DAILY_NEWS_OWNER_KEY,4096);
  if(owner!==null&&!(owner.schemaVersion===1&&owner.owner==='native'&&owner.nativeEnabled===true&&owner.drained===false))fail('daily_native_owner_not_authorized');
  if(owner===null&&!bootstrap)fail('daily_native_owner_not_authorized');
  const previousReport=await readJsonBinding(env.NEWS_STATE,PREPARATION_REPORT_KEY,65536);
  if(previousReport?.stoppedReason==='ai_quota_exceeded'){
    if(!validTimestamp(previousReport.checkedAt)||Date.parse(previousReport.checkedAt)>started.getTime())
      fail('daily_provider_quota_checkpoint_uncertain');
    const stoppedDay=new Date(previousReport.checkedAt).toISOString().slice(0,10);
    if(stoppedDay===started.toISOString().slice(0,10))return{status:'provider_quota_cooldown',stoppedReason:'ai_quota_exceeded',
      checkedAt:previousReport.checkedAt,retryAfterAt:new Date(Date.UTC(started.getUTCFullYear(),started.getUTCMonth(),started.getUTCDate()+1)).toISOString(),
      publicationConfirmed:false,deliveryConfirmed:false};
  }
  const previous=await readJsonBinding(env.NEWS_STATE,DAILY_NEWS_LEDGER_KEY,DAILY_NEWS_LIMITS.ledgerBytes,{onEntry:async record=>{
    await validateDailyNewsRecord(record,started);return record;
  }});
  if(previous!==null)await validateDailyLedger(previous,started);
  const priorRecords=new Map((previous?.accepted||[]).map(record=>[record.id,record]));
  let profile=await readJsonBinding(env.NEWS_STATE,DAILY_NEWS_PROFILE_KEY,DAILY_NEWS_LIMITS.profileBytes,{onEntry:async record=>{
    // Validate incoming content before reusing an immutable prior object. Merely
    // copying an old proof field must not hide changed source/title/summary data.
    return reusableNativeNewsRecord(record,priorRecords,started);
  }});
  if(profile!==null)await validateDailyApprovedPayload(profile,started);
  const lease=await acquireNewsPreparationLease(storage,{ledgerSha:previous===null?null:await dailyNewsDigest(previous),
    profileSha:profile===null?null:await dailyNewsDigest(profile),current:started.getTime(),bootstrap});
  if(!lease.acquired)return{status:'busy',reason:lease.reason,publicationConfirmed:false,deliveryConfirmed:false};
  let lastLedgerWrite=0,lastLedgerSha=previous===null?null:await dailyNewsDigest(previous);
  const checkpoint=async state=>{
    const current=now();if(current.getTime()>deadline+15000)fail('daily_preparation_deadline');
    await validateDailyLedger(state,current);const sha=await dailyNewsDigest(state);
    if(sha===lastLedgerSha)return;
    await stageNewsPreparationCheckpoint(storage,{leaseId:lease.leaseId,ledgerSha:sha,current:current.getTime()});
    const delay=lastLedgerWrite+1200-current.getTime();if(delay>0)await waitImpl(delay);
    await env.NEWS_STATE.put(DAILY_NEWS_LEDGER_KEY,newsJsonStream(state));lastLedgerWrite=now().getTime();
    await confirmNewsPreparationCheckpoint(storage,{leaseId:lease.leaseId,ledgerSha:sha,current:now().getTime()});lastLedgerSha=sha;
  };
  try{
    if(owner===null)await env.NEWS_STATE.put(DAILY_NEWS_OWNER_KEY,JSON.stringify({schemaVersion:1,owner:'native',nativeEnabled:true,drained:false}));
    const state=await mergeDailyLedgers(previous,profile,null,started);
    // Merge retained immutable prior records after matching their exact proofs;
    // release the independently parsed public-profile copy before inference.
    profile=null;
    const cooling=state.providerStop&&Date.parse(state.providerStop.retryAfterAt)>started.getTime();
    const admittedToday=state.accepted.filter(r=>dailyNewsDay(new Date(r.provenance.firstAcceptedAt))===day).length;
    const intake=cooling||admittedToday>=DAILY_NEWS_LIMITS.maximum?{details:[],counts:{checkedSources:0}}:await collect({
      current:started,sourceLimit:32,detailLimit:10,rotationMinutes:120,reviewed:[...reviewed,...state.accepted],
      fetchImpl:createPreparationSourceFetch({fetchImpl,current:now,deadline})});
    const bounded=await boundedNativeNewsCandidates(intake,state,now());
    const result=await execute({intake:bounded.intake,previous:state,reviewed,withdrawals,current:now(),maxAiCalls:bounded.maximum*2,
      ai:createPreparationBindingAi(env.AI,{deadline,now:()=>now().getTime()}),saveCheckpoint:checkpoint});
    await checkpoint(result.state);await validateDailyApprovedPayload(result.profile,now());
    const profileSha=await dailyNewsDigest(result.profile);
    await stageNewsPreparationPublication(storage,{leaseId:lease.leaseId,ledgerSha:lastLedgerSha,profileSha,current:now().getTime()});
    await env.NEWS_STATE.put(DAILY_NEWS_PROFILE_KEY,newsJsonStream(result.profile));
    await confirmNewsPreparationPublication(storage,{leaseId:lease.leaseId,profileSha,current:now().getTime()});
    result.report.publicationConfirmed=true;result.report.deliveryConfirmed=false;
    result.report.native={window:DAILY_NEWS_WINDOW,writer:'native',sourceCounts:intake.counts||null,
      maximumCandidateAttempts:bounded.maximum,maximumAiCalls:bounded.maximum*2,deadlineMinutes:6,deterministicHeld:bounded.held,
      ownerFence:'durable-object-lease-and-staged-ledger-hash'};
    // A quota result belongs to the UTC day when it was observed, including a run crossing midnight.
    if(result.report.stoppedReason==='ai_quota_exceeded')result.report.checkedAt=now().toISOString();
    await env.NEWS_STATE.put(PREPARATION_REPORT_KEY,JSON.stringify(result.report));
    return result.report;
  }finally{await releaseNewsPreparationLease(storage,lease.leaseId);}
}
export class DailyNewsPreparationCoordinator{
  constructor(state,env){this.storage=state.storage;this.env=env;}
  async fetch(request){
    if(request.method!=='POST'||new URL(request.url).pathname!=='/run')return new Response(null,{status:404});
    try{return Response.json(await runNativeNewsPreparation(this.env,this.storage));}
    catch(error){return Response.json({status:'degraded',reason:safeError(error),publicationConfirmed:false,deliveryConfirmed:false},{status:503});}
  }
}
export default{
  fetch(){return new Response(null,{status:404});},
  async scheduled(controller,env){
    if(env.NEWS_AUTOMATION_ENABLED!=='true')return;
    if(!env.PREPARATION_COORDINATOR)fail('daily_preparation_coordinator_missing');
    const stub=env.PREPARATION_COORDINATOR.get(env.PREPARATION_COORDINATOR.idFromName('daily-news-preparation'));
    const response=await stub.fetch('https://coordinator.internal/run',{method:'POST'}),report=await response.json();
    console.log(JSON.stringify({component:'literary-news-preparation',...report,held:undefined,media:undefined}));
    if(['ai_quota_exceeded','ai_http_429','provider_cooldown'].includes(report.stoppedReason))controller.noRetry();
    if(!response.ok)controller.noRetry();
  }
};
