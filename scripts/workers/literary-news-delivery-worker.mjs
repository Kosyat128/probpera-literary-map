import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import configuration from '../../data/news/social-destinations.json' with { type: 'json' };
import { createNewsRuntimeStore, dispatchNewsJob, newsPostKey,reconcileNewsSnapshot,scheduleNewsJobs } from '../lib/literary-news-social.mjs';
import { currentNativeNewsDueRows, fetchNativeNewsAdmissionFeed, selectNativeNewsAdmissionIds } from '../lib/literary-news-native-admissions.mjs';
import { fallbackUnsentNewsPhoto } from '../lib/literary-news-text-fallback.mjs';
import { createNewsSocialTransport } from '../lib/literary-news-social-transport-core.mjs';
import { NEWS_DAILY_TARGET, newsDeliveryPacingKey, newsDeliveryPublicationWindow } from '../lib/literary-news-pacing.mjs';
import { newsAnnouncementEligible } from '../lib/literary-news-reviewed.mjs';
import { DAILY_NEWS_WINDOW, dailyPublicationEpoch } from '../lib/literary-news-daily-profile.mjs';
import { trustedSupabaseOrigin } from '../lib/trusted-server-url.mjs';
import { validatePreparedNewsMedia } from '../lib/literary-news-media-policy.mjs';
import { DELIVERY_MEDIA_INDEX_KEY, DELIVERY_MEDIA_BYTES_PREFIX, DELIVERY_MEDIA_INDEX_MAX_BYTES,
  validateDeliveryMediaIndex, checkDeliveryMediaDescriptor, checkDeliveryMediaBytes } from '../lib/literary-news-delivery-media-profile.mjs';
import { captureChangedNativeNews, planNewsCapture, completedNewsCaptureProgress } from '../lib/literary-news-capture-progress.mjs';

export const DELIVERY_WINDOW = Object.freeze({start:DAILY_NEWS_WINDOW.start+'T00:00:00+03:00',
  end:DAILY_NEWS_WINDOW.endExclusive+'T00:00:00+03:00'});
const dayOf = date => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const fail = code => { throw Error(code); };
const safeCodes = new Set(['runtime_quota_exceeded','runtime_due_rpc_required','runtime_day_status_rpc_required',
  'runtime_due_response_invalid','runtime_day_status_invalid','delivery_media_index_invalid','delivery_media_index_unavailable',
  'delivery_credentials_missing','delivery_supabase_origin_invalid','delivery_network_rejected','delivery_response_too_large',
  'delivery_request_timeout','delivery_registry_binding_missing','delivery_runtime_failed',
  'delivery_public_feed_invalid','delivery_public_feed_unavailable','delivery_public_feed_origin_invalid',
  'delivery_public_feed_too_large','delivery_public_feed_release_mismatch','delivery_public_feed_not_current','bounded_capture_invalid']);
safeCodes.add('delivery_request_budget_exhausted');
safeCodes.add('delivery_capture_progress_invalid');
const safeCode = error => safeCodes.has(error?.message) ? error.message : 'delivery_runtime_failed';
const safePauseReasons = new Set(['destination_rights_unverified','release_operator_pause',
  'telegram_permission_denied','vk_permission_denied','provider_token_missing','provider_endpoint_invalid']);

export const DELIVERY_EXTERNAL_REQUEST_LIMIT = 50;
export const DELIVERY_CAPTURE_LIMIT = 4;
export const DELIVERY_DISPATCH_LIMIT = 2;
// Five receipt CAS attempts need at most ten requests. Keep a day-status read
// and the two-request heartbeat after them, including the provider request itself.
const PROVIDER_ACKNOWLEDGEMENT_RESERVE = 14;
const HEARTBEAT_RESERVE = 2;

/** One invocation-local counter covers the SDK, public feed and provider alike.
 * Redirects cannot silently multiply requests; HTTP402 latches every route. */
export function createDeliveryRequestBudget(fetchImpl=fetch) {
  let requests=0,providerWrites=0,quota=false,exhausted=false,heartbeat=false;
  const budget={
    get requests(){return requests;},get remaining(){return DELIVERY_EXTERNAL_REQUEST_LIMIT-requests;},
    get providerWrites(){return providerWrites;},
    get quota(){return quota;},get exhausted(){return exhausted;},
    canStartJob(job){
      // Include the prior slot receipt read, rights checks (twice for photos),
      // marker and all five claim CAS attempts before consuming a new slot.
      // Reusing a cached photo also persists its cache before dispatch.
      const beforeProvider=(job.prepared?.media?(job.remoteId?16:19):(job.remoteId?10:13))
        +8+(job.prepared?.media&&job.mediaCache?1:0);
      return !quota && budget.remaining>=beforeProvider+PROVIDER_ACKNOWLEDGEMENT_RESERVE;
    },
    canWriteProvider(){return !quota && budget.remaining>=PROVIDER_ACKNOWLEDGEMENT_RESERVE;},
    beginHeartbeat(){heartbeat=true;},
    fetch:async(input,options={})=>{
      if(quota)fail('runtime_quota_exceeded');
      if(requests>=DELIVERY_EXTERNAL_REQUEST_LIMIT-(heartbeat?0:HEARTBEAT_RESERVE)){
        exhausted=true;fail('delivery_request_budget_exhausted');
      }
      requests++;
      const target=new URL(input instanceof URL?input.href:typeof input==='string'?input:input.url);
      if(target.origin==='https://api.telegram.org'&&/\/(?:sendMessage|sendPhoto|editMessageText|editMessageMedia)$/.test(target.pathname))providerWrites++;
      // Workers implements only follow/manual; redirect:error throws before the
      // first SDK request and leaves no durable heartbeat. Reject the response
      // explicitly instead, without following it or spending another request.
      const response=await fetchImpl(input,{...options,redirect:'manual'});
      if(response.status>=300&&response.status<400){
        await response.body?.cancel().catch(()=>{});
        fail('delivery_network_rejected');
      }
      if(response.status===402)quota=true;
      return response;
    },
  };
  return budget;
}

/** A complete feed retains its original proof. Rotation changes only the four
 * explicit IDs reconciled this hour, covering all 24 within six hourly ticks. */
export function rotatingNativeNewsCaptureIds(feed,current) {
  const ids=selectNativeNewsAdmissionIds(feed,current),groups=Math.ceil(ids.length/DELIVERY_CAPTURE_LIMIT);
  if(!groups)return [];
  const group=Math.floor(current.getTime()/3600000)%groups;
  return ids.slice(group*DELIVERY_CAPTURE_LIMIT,(group+1)*DELIVERY_CAPTURE_LIMIT);
}

/** Preserve each group's existing admission-age order, while giving a new create
 * and a durable correction one slot each when both are available. */
export function mixedNativeNewsJobs(jobs) {
  const ordered=scheduleNewsJobs(jobs),creates=ordered.filter(job=>!job.remoteId),corrections=ordered.filter(job=>job.remoteId);
  return creates.length&&corrections.length?[creates[0],corrections[0]]:ordered.slice(0,DELIVERY_DISPATCH_LIMIT);
}

export async function boundedDeliveryResponse(response, maximum = 2 * 1024 * 1024) {
  const declared=Number(response.headers.get('content-length'));
  if(Number.isFinite(declared)&&declared>maximum)fail('delivery_response_too_large');
  if(!response.body)return new Uint8Array();
  const reader=response.body.getReader(),chunks=[];let length=0;
  try { while(true){const {value,done}=await reader.read();if(done)break;
    length+=value.byteLength;if(length>maximum)fail('delivery_response_too_large');chunks.push(Buffer.from(value));}
    return Buffer.concat(chunks,length);
  } finally { await reader.cancel().catch(()=>{});reader.releaseLock(); }
}

/** Invocation-local circuit breaker: no further Supabase request after HTTP 402. */
export function createDeliverySupabaseFetch(origin,fetchImpl=fetch) {
  let quota=false;
  return async (input,options={})=>{
    if(quota)fail('runtime_quota_exceeded');
    const url=new URL(input instanceof URL?input.href:typeof input==='string'?input:input.url);
    if(url.origin!==origin||!url.pathname.startsWith('/rest/v1/')||url.username||url.password)fail('delivery_network_rejected');
    const response=await fetchImpl(input,{...options,redirect:'error',signal:AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(20000)])});
    if(response.status===402){quota=true;await response.body?.cancel().catch(()=>{});
      return Response.json({code:'402',message:'runtime_quota_exceeded'},{status:402});}
    const bytes=await boundedDeliveryResponse(response);
    return new Response(bytes.length?bytes:null,{status:response.status,statusText:response.statusText,headers:response.headers});
  };
}

async function requiredRpc(client,name,args) {
  const result=await client.rpc(name,args);
  if(result?.status===402||Number(result?.error?.status)===402||result?.error?.code==='402')fail('runtime_quota_exceeded');
  if(result?.error)fail(name==='read_due_literary_news_runtime_posts'?'runtime_due_rpc_required':'runtime_day_status_rpc_required');
  return result?.data;
}

export function checkedDeliveryDayStatus(value,current) {
  // Validate the database's original counts before normalizing the current
  // policy during worker-first rollout. Historical days retain their old plan.
  const policyActive=dayOf(current)>='2026-10-09';
  const legacyPolicy=value?.minimum===10&&[15,20].includes(value?.maximum);
  const activePolicy=policyActive&&value?.minimum===NEWS_DAILY_TARGET.minimum&&value?.maximum===NEWS_DAILY_TARGET.maximum;
  if(!value||value.editorialDay!==dayOf(current)||value.timeZone!=='Europe/Moscow'||!legacyPolicy&&!activePolicy
    || ['acknowledgedCreates','acknowledgedPhotoCreates','freshCreates','freshPhotoCreates','legacyReceiptsWithUnknownFirstDate','deficitToMinimum']
      .some(key=>!Number.isSafeInteger(value[key])||value[key]<0)
    ||value.freshPhotoCreates>value.freshCreates||value.freshCreates>value.acknowledgedCreates
    ||value.freshPhotoCreates>value.acknowledgedPhotoCreates||value.acknowledgedPhotoCreates>value.acknowledgedCreates
    ||value.deficitToMinimum!==Math.max(0,value.minimum-value.freshCreates))fail('runtime_day_status_invalid');
  return policyActive?{...value,minimum:NEWS_DAILY_TARGET.minimum,maximum:NEWS_DAILY_TARGET.maximum,
    deficitToMinimum:Math.max(0,NEWS_DAILY_TARGET.minimum-value.freshCreates)}:value;
}

/** The service-only due RPC is required; there is deliberately no journal scan fallback. */
export function checkedDeliveryDueRows(rows,destination,current) {
  if(!Array.isArray(rows)||rows.length>20)fail('runtime_due_response_invalid');
  const keys=new Set();const today=dayOf(current);
  return rows.map(row=>{
    const job=row?.metadata;
    if(!Number.isSafeInteger(row?.id)||row.id<1||typeof row.entity_id!=='string'||!job||keys.has(row.entity_id)
      ||job.key!==row.entity_id||job.destination?.platform!=='telegram'||job.destination.id!==destination.id
      ||newsPostKey(job.newsId,{...destination,mode:'on'})!==row.entity_id
      ||!['pending','correction_pending','inflight'].includes(job.status))fail('runtime_due_response_invalid');
    keys.add(row.entity_id);
    return {id:row.id,key:row.entity_id,state:job};
  }).filter(({state:job})=>{
    if(job.nextDueAt&&Date.parse(job.nextDueAt)>current.getTime()
      ||job.status==='inflight'&&Date.parse(job.leaseUntil)>current.getTime())return false;
    if(job.remoteId)return true; // Existing remote identities, edits and withdrawals remain durable.
    const published=dailyPublicationEpoch(job.prepared?.temporal?.publishedAt);
    return !job.withdrawal && ['news','announcement'].includes(job.prepared?.temporal?.kind) && Number.isFinite(published) && published<=current.getTime()
      && current.getTime()-published<=7*86400000
      && newsAnnouncementEligible(job.prepared.temporal,today,'Europe/Moscow');
  });
}

async function readMediaOptions(binding,current) {
  if(typeof binding?.get!=='function')fail('delivery_registry_binding_missing');
  const text=await binding.get(DELIVERY_MEDIA_INDEX_KEY,'text');
  if(typeof text!=='string')fail('delivery_media_index_unavailable');
  if(Buffer.byteLength(text)>DELIVERY_MEDIA_INDEX_MAX_BYTES)fail('delivery_media_index_invalid');
  let index;try{index=JSON.parse(text);}catch{fail('delivery_media_index_invalid');}
  await validateDeliveryMediaIndex(index,current);
  const cache=new Map();
  const readBytes=async descriptor=>{
    checkDeliveryMediaDescriptor(descriptor);
    if(cache.has(descriptor.sha256))return checkDeliveryMediaBytes(cache.get(descriptor.sha256),descriptor);
    const raw=await binding.get(`${DELIVERY_MEDIA_BYTES_PREFIX}${descriptor.sha256}`,'arrayBuffer');
    if(raw===null)throw Error('delivery_media_bytes_unavailable');
    if(!(raw instanceof ArrayBuffer)||raw.byteLength!==descriptor.byteLength)throw Error('delivery_media_bytes_invalid');
    const bytes=checkDeliveryMediaBytes(Buffer.from(raw),descriptor);
    cache.set(descriptor.sha256,bytes);return bytes;
  };
  return {registry:index,readBytes,now:current,deferBytes:true};
}

export async function runDeliveryTick({env,now=()=>new Date(),fetchImpl=fetch,createClientImpl=createClient,
  storeFactory=createNewsRuntimeStore,dispatchImpl=dispatchNativeNewsJob,fetchFeedImpl=fetchNativeNewsAdmissionFeed,
  invocation='dispatch',captureProgress,saveCaptureProgress}={}) {
  const current=now(),runId=randomUUID(),base={runner:'native-cron',invocation,runId,startedAt:current.toISOString()};
  if(!['capture','dispatch'].includes(invocation))fail('delivery_runtime_failed');
  if(env?.NEWS_DELIVERY_ENABLED!=='true')return {...base,status:'disabled',deliveredThisRun:0};
  if(current.getTime()<Date.parse(DELIVERY_WINDOW.start)||current.getTime()>=Date.parse(DELIVERY_WINDOW.end))
    return {...base,status:'outside_authorized_window',deliveredThisRun:0};
  if(!newsDeliveryPublicationWindow(current).open)
    return {...base,status:'outside_publication_hours',deliveredThisRun:0};
  const budget=createDeliveryRequestBudget(fetchImpl),heartbeatKey=invocation==='capture'?'heartbeat:native-delivery-capture':'heartbeat:native-delivery';
  let store,storeValid=false,phase='configuration',outcomes=[];
  const heartbeat=async summary=>{
    if(!storeValid||budget.quota||budget.remaining<HEARTBEAT_RESERVE)return {...summary,externalRequests:budget.requests,heartbeatRecorded:false};
    budget.beginHeartbeat();
    const prior=await store.read(heartbeatKey);
    const record={...summary,externalRequests:budget.requests+1,heartbeatRecorded:true};
    const written=await store.compareAppend(heartbeatKey,prior.id,record);
    return {...record,externalRequests:budget.requests,heartbeatRecorded:written.applied===true};
  };
  try {
    if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.TELEGRAM_BOT_TOKEN)fail('delivery_credentials_missing');
    let origin;try{origin=trustedSupabaseOrigin(env.SUPABASE_URL);}catch{fail('delivery_supabase_origin_invalid');}
    const client=createClientImpl(origin,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},db:{retry:false},
      global:{fetch:createDeliverySupabaseFetch(origin,budget.fetch)}});
    store=storeFactory(client);
    const destination=configuration.destinations.find(row=>row.platform==='telegram');
    if(!destination)fail('delivery_runtime_failed');
    phase='destination';
    const control=(await store.read(`destination:telegram:${destination.id}`)).state;
    storeValid=true;
    if(control?.mode!=='on'||control.paused||control.historyReconciled!==true)
      return await heartbeat({...base,phase,finishedAt:now().toISOString(),status:'destination_not_enabled_or_history_gap',
        reason:!control?'destination_control_missing':control.mode!=='on'?'destination_mode_not_on'
          :control.paused?'destination_paused':'destination_history_unreconciled',
        destinationMode:['on','off','canary'].includes(control?.mode)?control.mode:null,
        paused:control?.paused===true,historyReconciled:control?.historyReconciled===true,
        pauseReason:control?.paused?safePauseReasons.has(control.pauseReason)?control.pauseReason:'destination_pause_reason_unknown':null,
        providerWriteAttempts:0,deliveredThisRun:0});
    // Prove that the metrics prerequisite exists before any external provider write.
    phase='day_status';
    let dayStatus=checkedDeliveryDayStatus(await requiredRpc(client,'literary_news_delivery_day_status',
      {p_destination_id:destination.id,p_now:current.toISOString()}),current);
    phase='due_queue';
    const rawDue=await requiredRpc(client,'read_due_literary_news_runtime_posts',
      {p_destination_id:destination.id,p_now:current.toISOString(),p_limit:20});
    let candidates=checkedDeliveryDueRows(rawDue,destination,current);
    phase='public_feed';
    const feed=await fetchFeedImpl({fetchImpl:budget.fetch,current});
    const capturePlan=invocation==='capture'&&captureProgress!==undefined?await planNewsCapture(feed,current,captureProgress):null;
    const captureIds=invocation==='capture'?(capturePlan?capturePlan.ids:rotatingNativeNewsCaptureIds(feed,current)):[];
    let mediaOptions={registry:{assets:[]},now:current,deferBytes:true},mediaIndexUnavailable=false;
    if(captureIds.length||candidates.some(row=>row.state.prepared?.media)){
      phase='media_index';
      try{mediaOptions=await readMediaOptions(env.NEWS_STATE,current);}
      catch(error){if(error.message!=='delivery_media_index_unavailable')throw error;mediaIndexUnavailable=true;}
    }
    if(invocation==='capture'){
      phase='capture';
      const capture=await reconcileNewsSnapshot(store,feed,[destination],current,{mediaOptions,boundedCaptureIds:captureIds});
      if(capturePlan&&typeof saveCaptureProgress==='function') {
        const failed=new Set(capture.preparationFailures.map(row=>row.newsId));
        await saveCaptureProgress(completedNewsCaptureProgress(capturePlan,captureIds.filter(id=>!failed.has(id)),current,
          captureIds.filter(id=>failed.has(id))));
      }
      phase='heartbeat';
      return await heartbeat({...base,phase,finishedAt:now().toISOString(),status:capturePlan&&!captureIds.length?'capture_not_due':'admissions_captured',
        capturedCandidates:captureIds.length,newAdmissions:capture.newAdmissions,deliveredThisRun:0});
    }
    phase='current_queue';
    candidates=await currentNativeNewsDueRows(candidates,feed);
    phase='pacing';
    const pacing=(await store.read(newsDeliveryPacingKey(destination))).state;
    const selected=[];let mediaUnavailable=0,textFallbacks=0;
    const rowsByKey=new Map(candidates.map(row=>[row.key,row]));
    const ready=candidates.filter(row=>row.state.remoteId||!(control.nextDueAt&&Date.parse(control.nextDueAt)>current.getTime()
      ||Date.parse(pacing?.nextDueAt)>current.getTime()));
    phase='select_media';
    for(const original of mixedNativeNewsJobs(ready.map(row=>row.state))){
      const row=rowsByKey.get(original.key);let job=original;
      if(job.prepared?.media){try{
        if(mediaIndexUnavailable)throw Error('delivery_media_index_unavailable');
        await validatePreparedNewsMedia(job.prepared,job.destination,mediaOptions);
      }catch(error){
        mediaUnavailable++;
        let fallback;try{fallback=await fallbackUnsentNewsPhoto({store,row,reason:error.message,current});}
        catch(invalid){if(/^text_fallback_(?:admission|revision)_invalid$/.test(invalid.message))continue;throw invalid;}
        if(!fallback?.applied)continue;job=fallback.state;textFallbacks++;
      }}
      selected.push(job);
    }
    // This same CAS/lease/control/pacing path is shared with the Node fallback.
    const live=createNewsSocialTransport({mode:'live',telegramToken:env.TELEGRAM_BOT_TOKEN,fetchImpl:budget.fetch,
      mediaOptions:{...mediaOptions,now:undefined}});
    let providerBudgetStopped=false;
    const transport={
      preflight:async(destination,options)=>destination?.platform==='telegram'?live.preflight(destination,options):{ok:false,reason:'vk_disabled'},
      prepareDelivery:async(args)=>args.destination?.platform==='telegram'?live.prepareDelivery(args):{kind:'blocked',code:'vk_disabled'},
      send:async(args)=>{
        if(args.destination?.platform!=='telegram')return {kind:'blocked',code:'vk_disabled'};
        if(!budget.canWriteProvider()){
          providerBudgetStopped=true;
          return {kind:'retry',code:'delivery_request_budget_exhausted',retryAfterSeconds:3600};
        }
        return live.send(args);
      },
    };
    let budgetStopped=false,attemptedJobs=0;
    phase='dispatch';
    for(const job of selected){
      if(!budget.canStartJob(job)){budgetStopped=true;break;}
      const result=await dispatchImpl({store,jobs:[job],transport,now,limit:1});
      attemptedJobs++;outcomes.push(...result);
      if(budget.quota)fail('runtime_quota_exceeded');
      if(providerBudgetStopped||budget.exhausted){budgetStopped=true;break;}
      if(result.some(row=>row.status==='ambiguous'||row.reason==='destination_rights_unverified'
        ||row.reason==='destination_rate_limit'||row.reason==='destination_not_enabled_or_history_gap'))break;
    }
    if(outcomes.some(row=>row.dispatchAttempted)&&budget.remaining>HEARTBEAT_RESERVE){
      phase='postflight';const countedAt=now();
      dayStatus=checkedDeliveryDayStatus(await requiredRpc(client,'literary_news_delivery_day_status',
        {p_destination_id:destination.id,p_now:countedAt.toISOString()}),countedAt);
    }
    phase='heartbeat';
    const summary={...base,phase,finishedAt:now().toISOString(),status:outcomes.some(row=>row.status==='ambiguous')?'dispatch_reconciliation_required'
        :budgetStopped?'request_budget_deferred':dayStatus.deficitToMinimum?'daily_target_deficit':'daily_minimum_reached',
      inspectedJobs:rawDue.length,eligibleJobs:candidates.length,selectedJobs:selected.length,attemptedJobs,mediaUnavailable,textFallbacks,
      capturedCandidates:0,newAdmissions:0,budgetStopped,
      providerWriteAttempts:budget.providerWrites,
      acknowledgedCreatesThisRun:outcomes.filter(row=>row.status==='sent_current'&&row.dispatchAttempted&&!rowsByKey.get(row.key)?.state.remoteId).length,
      acknowledgedCorrectionsThisRun:outcomes.filter(row=>row.status==='sent_current'&&row.dispatchAttempted&&rowsByKey.get(row.key)?.state.remoteId).length,
      deliveredThisRun:outcomes.filter(row=>row.status==='sent_current'&&row.dispatchAttempted).length,
      ambiguousThisRun:outcomes.filter(row=>row.status==='ambiguous').length,dayStatus};
    // Timer advice never grants a slot. Dispatch still rechecks the durable
    // reservation and actual receipt through the shared CAS provider path.
    const knownDue=Math.max(Date.parse(pacing?.nextDueAt)||0,Date.parse(control.nextDueAt)||0,
      ...outcomes.map(row=>Date.parse(row.nextDueAt)||0),
      summary.acknowledgedCreatesThisRun?now().getTime()+6300000:0);
    if(knownDue>current.getTime()&&Number.isFinite(knownDue))summary.nextDispatchAt=new Date(knownDue).toISOString();
    return await heartbeat(summary);
  } catch(error){
    const summary={...base,phase,status:'blocked',code:budget.quota?'runtime_quota_exceeded'
      :budget.exhausted?'delivery_request_budget_exhausted':safeCode(error),finishedAt:now().toISOString(),
      externalRequests:budget.requests,providerWriteAttempts:budget.providerWrites,deliveredThisRun:null,heartbeatRecorded:false};
    if(summary.code==='runtime_quota_exceeded')return summary;
    try{return await heartbeat(summary);}catch{return {...summary,externalRequests:budget.requests};}
  }
}

export const runDeliveryCaptureTick=options=>runDeliveryTick({...options,invocation:'capture'});

/** Five-minute polling must not re-download/reconcile the same four admissions
 * twelve times an hour. Persist only successful capture, so a missed :00 tick,
 * restart or temporary failure is recovered by the next poll. */
export async function captureNativeNewsOncePerHour({storage,current=new Date(),capture}) {
  const hour=Math.floor(current.getTime()/3600000),key='literary-news:capture-hour';
  if(await storage.get(key)===hour)return {runner:'native-cron',invocation:'capture',status:'capture_not_due',deliveredThisRun:0};
  const summary=await capture();
  if(summary.status==='admissions_captured')await storage.put(key,hour);
  return summary;
}

/** The shared job path rechecks control/lease/pacing and the atomic SQL guard.
 * Avoid a redundant batch-control read for each of the two explicit jobs. */
async function dispatchNativeNewsJob({store,jobs,transport,now}){
  const job=jobs[0];
  try{return [{key:job.key,...await dispatchNewsJob({store,key:job.key,transport,now})}];}
  catch(error){
    if(error?.message==='runtime_quota_exceeded')throw error;
    return [{key:job.key,status:'ambiguous',reason:'runtime_failure_requires_reconciliation'}];
  }
}

/** SDK, JSON/hash validation and dispatch run under the Durable Object CPU budget.
 * Existing Supabase CAS and shared provider pacing remain the dispatch fence. */
export class LiteraryNewsDeliveryCoordinator {
  constructor(state,env,{runTick=runDeliveryTick,now=()=>new Date()}={}){
    this.env=env;this.storage=state.storage;this.captureInFlight=null;this.dispatchInFlight=null;
    this.runTick=runTick;this.now=now;
  }
  async dispatch(){
    this.dispatchInFlight??=(async()=>{
      const summary=await this.runTick({env:this.env});
      await scheduleNextNativeNewsAlarm(this.storage,this.env,summary,this.now());
      return summary;
    })();
    const active=this.dispatchInFlight;
    try{return await active;}finally{if(this.dispatchInFlight===active)this.dispatchInFlight=null;}
  }
  async alarm(){
    // Alarm retries are at-least-once; all writes retain the same SQL/CAS,
    // provider receipt and ambiguous-send fences as Cron dispatches.
    try{await this.dispatch();}catch{
      console.warn(JSON.stringify({component:'literary-news-delivery-alarm',status:'unavailable'}));
      throw Error('delivery_alarm_retry_required');
    }
  }
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(request.method!=='POST'||!['/capture','/dispatch'].includes(path))
      return new Response(null,{status:404});
    let summary;
    if(path==='/capture'&&this.env.NEWS_DELIVERY_ENABLED==='true'){
      this.captureInFlight??=captureChangedNativeNews({storage:this.storage,
        capture:options=>runDeliveryCaptureTick({env:this.env,...options})});
      try{summary=await this.captureInFlight;}finally{this.captureInFlight=null;}
    } else summary=path==='/dispatch'?await this.dispatch():await runDeliveryCaptureTick({env:this.env});
    return Response.json(summary,{status:summary.status==='blocked'?503:200});
  }
}

async function scheduledDelivery(controller,env,log) {
  const stub=env.DELIVERY_COORDINATOR.get(env.DELIVERY_COORDINATOR.idFromName('literary-news-delivery'));
  const captureResponse=await stub.fetch('https://coordinator.internal/capture',{method:'POST'});
  const capture=await captureResponse.json();
  log(JSON.stringify(capture));
  if(!captureResponse.ok||capture.status==='blocked'){
    controller.noRetry();
    if(capture.code!=='delivery_request_budget_exhausted')return capture;
  }
  const response=await stub.fetch('https://coordinator.internal/dispatch',{method:'POST'});
  const summary=await response.json();
  // A retry of an ambiguous dispatch or a quota failure must be operator-reviewed.
  if(!response.ok||summary.status==='blocked'||summary.status==='dispatch_reconciliation_required')controller.noRetry();
  log(JSON.stringify(summary));
  return summary;
}

export async function scheduleNextNativeNewsAlarm(storage,env,summary,current=new Date()) {
  if(typeof storage?.setAlarm!=='function')return;
  if(env.NEWS_DELIVERY_ENABLED!=='true'||['disabled','outside_authorized_window',
    'destination_not_enabled_or_history_gap','dispatch_reconciliation_required'].includes(summary?.status)) {
    if(typeof storage.deleteAlarm==='function')await storage.deleteAlarm();return;
  }
  const window=newsDeliveryPublicationWindow(current),advised=Date.parse(summary?.nextDispatchAt);
  let due=!window.open?Date.parse(window.nextDueAt):Number.isFinite(advised)&&advised>current.getTime()
    ?advised:current.getTime()+300000;
  const dueWindow=newsDeliveryPublicationWindow(new Date(due));
  if(!dueWindow.open)due=Date.parse(dueWindow.nextDueAt);
  if(due>=Date.parse(DELIVERY_WINDOW.end)) {await storage.deleteAlarm?.();return;}
  await storage.setAlarm(due);
}

const preparationStatuses=new Set(['disabled','outside_admission_window','busy','provider_quota_cooldown',
  'degraded','provider_degraded','supply_degraded','target_met','skipped']);

/** The same preparation DO owns the lease, AI budgets and durable slot gate.
 * A missing/older binding or failed preparation must not retry delivery. */
async function recoverScheduledPreparation(env,current,log) {
  const minute=current.getUTCMinutes();
  if(!env.NEWS_PREPARATION_RECOVERY||!(minute>=25&&minute<30||minute>=55&&minute<60))return;
  const component='literary-news-preparation-recovery';
  try{
    const stub=env.NEWS_PREPARATION_RECOVERY.get(env.NEWS_PREPARATION_RECOVERY.idFromName('daily-news-preparation'));
    const response=await stub.fetch('https://coordinator.internal/recover',{
      method:'POST',signal:AbortSignal.timeout(7*60000)});
    if(!response.ok){
      await response.body?.cancel().catch(()=>{});
      log(JSON.stringify({component,status:'unavailable',httpStatus:response.status}));return;
    }
    const report=JSON.parse(Buffer.from(await boundedDeliveryResponse(response,65536)).toString('utf8'));
    if(!preparationStatuses.has(report?.status))throw Error('preparation_recovery_response_invalid');
    log(JSON.stringify({component,status:report.status,publicationConfirmed:report.publicationConfirmed===true}));
    return report.publicationConfirmed===true;
  }catch{
    log(JSON.stringify({component,status:'unavailable'}));
  }
}

/** Every private DO POST retains its own 50-external-request budget. Complete
 * delivery first; the optional recovery calls the existing preparation DO. */
export async function scheduleNativeNewsDelivery(controller,env,{log=console.log,now=()=>new Date()}={}) {
  if(env.NEWS_DELIVERY_ENABLED!=='true')return;
  if(!env.DELIVERY_COORDINATOR)fail('delivery_coordinator_missing');
  try{return await scheduledDelivery(controller,env,log);}
  finally{
    if(await recoverScheduledPreparation(env,now(),log)) {
      // The recovery completed after the ordinary capture. Admit its newly
      // published items now; this second private call never sends to Telegram.
      try {
        const stub=env.DELIVERY_COORDINATOR.get(env.DELIVERY_COORDINATOR.idFromName('literary-news-delivery'));
        const response=await stub.fetch('https://coordinator.internal/capture',{method:'POST'});
        const captured=JSON.parse(Buffer.from(await boundedDeliveryResponse(response,65536)).toString('utf8'));
        log(JSON.stringify({component:'literary-news-preparation-capture',status:response.ok&&
          ['admissions_captured','capture_not_due'].includes(captured?.status)?captured.status:'unavailable'}));
      }catch{log(JSON.stringify({component:'literary-news-preparation-capture',status:'unavailable'}));}
    }
  }
}

export default {
  fetch(){return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});},
  scheduled:scheduleNativeNewsDelivery,
};
