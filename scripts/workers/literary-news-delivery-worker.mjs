import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import configuration from '../../data/news/social-destinations.json' with { type: 'json' };
import { createNewsRuntimeStore, dispatchNewsBatch, newsPostKey,reconcileNewsSnapshot,scheduleNewsJobs } from '../lib/literary-news-social.mjs';
import { currentNativeNewsDueRows, fetchNativeNewsAdmissionFeed, selectNativeNewsAdmissionIds } from '../lib/literary-news-native-admissions.mjs';
import { fallbackUnsentNewsPhoto } from '../lib/literary-news-text-fallback.mjs';
import { createNewsSocialTransport } from '../lib/literary-news-social-transport-core.mjs';
import { newsDeliveryPacingKey } from '../lib/literary-news-pacing.mjs';
import { newsAnnouncementEligible } from '../lib/literary-news-reviewed.mjs';
import { DAILY_NEWS_WINDOW, dailyPublicationEpoch } from '../lib/literary-news-daily-profile.mjs';
import { trustedSupabaseOrigin } from '../lib/trusted-server-url.mjs';
import { validatePreparedNewsMedia } from '../lib/literary-news-media-policy.mjs';
import { DELIVERY_MEDIA_INDEX_KEY, DELIVERY_MEDIA_BYTES_PREFIX, DELIVERY_MEDIA_INDEX_MAX_BYTES,
  validateDeliveryMediaIndex, checkDeliveryMediaDescriptor, checkDeliveryMediaBytes } from '../lib/literary-news-delivery-media-profile.mjs';

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
const safeCode = error => safeCodes.has(error?.message) ? error.message : 'delivery_runtime_failed';

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
  if(!value||value.editorialDay!==dayOf(current)||value.timeZone!=='Europe/Moscow'||value.minimum!==10||value.maximum!==15
    || ['acknowledgedCreates','acknowledgedPhotoCreates','freshCreates','freshPhotoCreates','legacyReceiptsWithUnknownFirstDate','deficitToMinimum']
      .some(key=>!Number.isSafeInteger(value[key])||value[key]<0)
    ||value.freshPhotoCreates>value.freshCreates||value.freshCreates>value.acknowledgedCreates
    ||value.freshPhotoCreates>value.acknowledgedPhotoCreates||value.acknowledgedPhotoCreates>value.acknowledgedCreates
    ||value.deficitToMinimum!==Math.max(0,10-value.freshCreates))fail('runtime_day_status_invalid');
  return value;
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
  storeFactory=createNewsRuntimeStore,dispatchImpl=dispatchNewsBatch,fetchFeedImpl=fetchNativeNewsAdmissionFeed}={}) {
  const current=now(),runId=randomUUID(),base={runner:'native-cron',runId,startedAt:current.toISOString()};
  if(env?.NEWS_DELIVERY_ENABLED!=='true')return {...base,status:'disabled',deliveredThisRun:0};
  if(current.getTime()<Date.parse(DELIVERY_WINDOW.start)||current.getTime()>=Date.parse(DELIVERY_WINDOW.end))
    return {...base,status:'outside_authorized_window',deliveredThisRun:0};
  try {
    if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.TELEGRAM_BOT_TOKEN)fail('delivery_credentials_missing');
    let origin;try{origin=trustedSupabaseOrigin(env.SUPABASE_URL);}catch{fail('delivery_supabase_origin_invalid');}
    const client=createClientImpl(origin,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},
      global:{fetch:createDeliverySupabaseFetch(origin,fetchImpl)}});
    const store=storeFactory(client);
    const destination=configuration.destinations.find(row=>row.platform==='telegram');
    if(!destination)fail('delivery_runtime_failed');
    const control=(await store.read(`destination:telegram:${destination.id}`)).state;
    if(control?.mode!=='on'||control.paused||control.historyReconciled!==true)
      return {...base,status:'destination_not_enabled_or_history_gap',deliveredThisRun:0};
    // Prove that the metrics prerequisite exists before any external provider write.
    let dayStatus=checkedDeliveryDayStatus(await requiredRpc(client,'literary_news_delivery_day_status',
      {p_destination_id:destination.id,p_now:current.toISOString()}),current);
    let rawDue=await requiredRpc(client,'read_due_literary_news_runtime_posts',
      {p_destination_id:destination.id,p_now:current.toISOString(),p_limit:20});
    let candidates=checkedDeliveryDueRows(rawDue,destination,current);
    const feed=await fetchFeedImpl({fetchImpl,current}),captureIds=selectNativeNewsAdmissionIds(feed,current);
    let mediaOptions={registry:{assets:[]},now:current,deferBytes:true},mediaIndexUnavailable=false;
    if(captureIds.length||candidates.some(row=>row.state.prepared?.media)){
      try{mediaOptions=await readMediaOptions(env.NEWS_STATE,current);}
      catch(error){if(error.message!=='delivery_media_index_unavailable')throw error;mediaIndexUnavailable=true;}
    }
    const capture=await reconcileNewsSnapshot(store,feed,[destination],current,{mediaOptions,boundedCaptureIds:captureIds});
    if(captureIds.length){
      rawDue=await requiredRpc(client,'read_due_literary_news_runtime_posts',
        {p_destination_id:destination.id,p_now:current.toISOString(),p_limit:20});
      candidates=checkedDeliveryDueRows(rawDue,destination,current);
    }
    candidates=await currentNativeNewsDueRows(candidates,feed);
    const pacing=(await store.read(newsDeliveryPacingKey(destination))).state;
    const selected=[];let mediaUnavailable=0,textFallbacks=0;
    const rowsByKey=new Map(candidates.map(row=>[row.key,row]));
    for(const original of scheduleNewsJobs(candidates.map(row=>row.state))){
      if(selected.length>=8)break;
      const row=rowsByKey.get(original.key);let job=original;
      if(!job.remoteId&&(control.nextDueAt&&Date.parse(control.nextDueAt)>current.getTime()
        ||Date.parse(pacing?.nextDueAt)>current.getTime()))continue;
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
    const live=createNewsSocialTransport({mode:'live',telegramToken:env.TELEGRAM_BOT_TOKEN,fetchImpl,
      mediaOptions:{...mediaOptions,now:undefined}});
    const transport={
      preflight:async(destination,options)=>destination?.platform==='telegram'?live.preflight(destination,options):{ok:false,reason:'vk_disabled'},
      prepareDelivery:async(args)=>args.destination?.platform==='telegram'?live.prepareDelivery(args):{kind:'blocked',code:'vk_disabled'},
      send:async(args)=>args.destination?.platform==='telegram'?live.send(args):{kind:'blocked',code:'vk_disabled'},
    };
    const outcomes=await dispatchImpl({store,jobs:scheduleNewsJobs(selected),transport,now,limit:8});
    if(outcomes.some(row=>row.dispatchAttempted)){
      const countedAt=now();dayStatus=checkedDeliveryDayStatus(await requiredRpc(client,'literary_news_delivery_day_status',
        {p_destination_id:destination.id,p_now:countedAt.toISOString()}),countedAt);
    }
    const summary={...base,finishedAt:now().toISOString(),status:outcomes.some(row=>row.status==='ambiguous')?'dispatch_reconciliation_required'
        :dayStatus.deficitToMinimum?'daily_target_deficit':'daily_minimum_reached',
      inspectedJobs:rawDue.length,eligibleJobs:candidates.length,selectedJobs:selected.length,mediaUnavailable,textFallbacks,
      capturedCandidates:captureIds.length,newAdmissions:capture.newAdmissions,
      deliveredThisRun:outcomes.filter(row=>row.status==='sent_current'&&row.dispatchAttempted).length,
      ambiguousThisRun:outcomes.filter(row=>row.status==='ambiguous').length,dayStatus};
    const heartbeat=await store.read('heartbeat:native-delivery');
    await store.compareAppend('heartbeat:native-delivery',heartbeat.id,summary);
    return summary;
  } catch(error){return {...base,status:'blocked',code:safeCode(error),finishedAt:now().toISOString(),deliveredThisRun:null};}
}

/** SDK, JSON/hash validation and dispatch run under the Durable Object CPU budget.
 * Existing Supabase CAS and shared provider pacing remain the dispatch fence. */
export class LiteraryNewsDeliveryCoordinator {
  constructor(state,env){this.env=env;}
  async fetch(request){
    if(request.method!=='POST'||new URL(request.url).pathname!=='/run')
      return new Response(null,{status:404});
    const summary=await runDeliveryTick({env:this.env});
    return Response.json(summary,{status:summary.status==='blocked'?503:200});
  }
}

/** Free-plan Cron stays small: one private DO call and a bounded factual summary. */
export async function scheduleNativeNewsDelivery(controller,env,{log=console.log}={}) {
  if(env.NEWS_DELIVERY_ENABLED!=='true')return;
  if(!env.DELIVERY_COORDINATOR)fail('delivery_coordinator_missing');
  const stub=env.DELIVERY_COORDINATOR.get(env.DELIVERY_COORDINATOR.idFromName('literary-news-delivery'));
  const response=await stub.fetch('https://coordinator.internal/run',{method:'POST'});
  const summary=await response.json();
  // A retry of an ambiguous dispatch or a quota failure must be operator-reviewed.
  if(!response.ok||summary.status==='blocked')controller.noRetry();
  log(JSON.stringify(summary));
  return summary;
}

export default {
  fetch(){return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});},
  scheduled:scheduleNativeNewsDelivery,
};
