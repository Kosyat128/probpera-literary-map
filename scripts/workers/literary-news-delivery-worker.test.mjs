import { describe, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import worker,{runDeliveryTick,DELIVERY_WINDOW,checkedDeliveryDueRows,checkedDeliveryDayStatus,
  createDeliverySupabaseFetch,boundedDeliveryResponse,LiteraryNewsDeliveryCoordinator,
  scheduleNativeNewsDelivery} from './literary-news-delivery-worker.mjs';
import {makeDeliveryMediaIndex,DELIVERY_MEDIA_INDEX_KEY,DELIVERY_MEDIA_BYTES_PREFIX} from '../lib/literary-news-delivery-media-profile.mjs';
import {prepareNewsPost,newsPostKey} from '../lib/literary-news-social.mjs';
import {mediaByteHash} from '../lib/literary-news-media-policy.mjs';
import configuration from '../../data/news/social-destinations.json' with {type:'json'};
const now=new Date('2026-09-29T12:00:00Z');
const destination=configuration.destinations.find(row=>row.platform==='telegram');
const day=(fresh=0)=>({editorialDay:'2026-09-29',timeZone:'Europe/Moscow',acknowledgedCreates:20,
  acknowledgedPhotoCreates:15,freshCreates:fresh,freshPhotoCreates:fresh,legacyReceiptsWithUnknownFirstDate:2,minimum:10,maximum:15,deficitToMinimum:Math.max(0,10-fresh)});
const item=id=>({id,verification:'confirmed',kind:'news',category:'releases',eventDate:'2026-09-29',publishedAt:now.toISOString(),verifiedAt:now.toISOString(),
 title:{ru:'Новая книга',en:'New book'},summary:{ru:'Издатель сообщил о книге.',en:'Publisher announced a book.'},source:{name:'Fixture',url:'https://publisher.example/book',language:'en'}});
const row=(id,extra={})=>({id:1,entity_id:newsPostKey(id,{...destination,mode:'on'}),metadata:{key:newsPostKey(id,{...destination,mode:'on'}),newsId:id,
 destination:{platform:'telegram',id:destination.id},status:'pending',originalAdmission:now.toISOString(),
 prepared:{temporal:{kind:'news',eventDate:'2026-09-29',publishedAt:now.toISOString(),verifiedAt:now.toISOString()},media:{assetId:'unknown'}},...extra}});
async function fixture({rows=[],status=day(),control={mode:'on',paused:false,historyReconciled:true},rpcError=null,index}={}){
 const state=new Map();let seq=1;
 state.set(`destination:telegram:${destination.id}`,{id:seq,state:control});
 for(const value of rows)state.set(value.entity_id,{id:value.id,state:value.metadata});
 const store={read:vi.fn(async key=>structuredClone(state.get(key)||{id:null,state:null})),
   compareAppend:vi.fn(async(key,id,value)=>{const old=state.get(key);if((old?.id??null)!==id)return {applied:false,...old};
     const next={id:++seq,state:structuredClone(value)};state.set(key,next);return {applied:true,...next};})};
 const client={rpc:vi.fn(async name=>rpcError?{error:{code:'PGRST202'},status:404}:{data:name==='literary_news_delivery_day_status'?status:rows,error:null,status:200})};
 const registry=index||await makeDeliveryMediaIndex({assets:[],downloadHosts:[],uploads:[],generatedAt:now.toISOString()});
 const env={NEWS_DELIVERY_ENABLED:'true',SUPABASE_URL:'https://worker-fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'isolated-key',TELEGRAM_BOT_TOKEN:'isolated-token',
   NEWS_STATE:{get:vi.fn(async(key,type)=>key===DELIVERY_MEDIA_INDEX_KEY?JSON.stringify(registry):null)}};
 const dispatch=vi.fn(async()=>[]);
 const run=()=>runDeliveryTick({env,now:()=>now,createClientImpl:()=>client,storeFactory:()=>store,dispatchImpl:dispatch});
 return{env,store,client,dispatch,run,state};
}

describe('Private native delivery cron boundary',()=>{
 it('keeps the heavy delivery entry private to its Durable Object binding',async()=>{
   const coordinator=new LiteraryNewsDeliveryCoordinator({storage:{}},{});
   for(const [method,url] of [['GET','https://coordinator.internal/run'],['POST','https://coordinator.internal/send']])
     expect((await coordinator.fetch(new Request(url,{method}))).status).toBe(404);
   const response=await coordinator.fetch(new Request('https://coordinator.internal/run',{method:'POST'}));
   expect(response.status).toBe(200);expect(await response.json()).toMatchObject({status:'disabled',deliveredThisRun:0});
   expect((await worker.fetch(new Request('https://public.example/run',{method:'POST'}))).status).toBe(404);
 });
 it('uses one private coordinator call per enabled Cron and reports its factual result',async()=>{
   const report={status:'daily_target_deficit',deliveredThisRun:0,dayStatus:day()};
   const stub={fetch:vi.fn(async()=>Response.json(report))};
   const coordinator={idFromName:vi.fn(name=>name),get:vi.fn(()=>stub)};
   const controller={noRetry:vi.fn()},log=vi.fn();
   await scheduleNativeNewsDelivery(controller,{NEWS_DELIVERY_ENABLED:'false',DELIVERY_COORDINATOR:coordinator},{log});
   expect(coordinator.get).not.toHaveBeenCalled();
   expect(await scheduleNativeNewsDelivery(controller,{NEWS_DELIVERY_ENABLED:'true',DELIVERY_COORDINATOR:coordinator},{log})).toEqual(report);
   expect(coordinator.idFromName).toHaveBeenCalledWith('literary-news-delivery');
   expect(stub.fetch).toHaveBeenCalledExactlyOnceWith('https://coordinator.internal/run',{method:'POST'});
   expect(log).toHaveBeenCalledExactlyOnceWith(JSON.stringify(report));expect(controller.noRetry).not.toHaveBeenCalled();
 });
 it('never automatically retries a blocked coordinator quota result',async()=>{
   const report={status:'blocked',code:'runtime_quota_exceeded',deliveredThisRun:null};
   const controller={noRetry:vi.fn()},log=vi.fn();
   const coordinator={idFromName:()=> 'fixture',get:()=>({fetch:async()=>Response.json(report,{status:503})})};
   expect(await scheduleNativeNewsDelivery(controller,{NEWS_DELIVERY_ENABLED:'true',DELIVERY_COORDINATOR:coordinator},{log})).toEqual(report);
   expect(controller.noRetry).toHaveBeenCalledOnce();
   await expect(scheduleNativeNewsDelivery(controller,{NEWS_DELIVERY_ENABLED:'true'},{log})).rejects.toThrow('delivery_coordinator_missing');
 });
 it('disabled scheduling and public requests have no storage/network/send capability',async()=>{
   const fetchImpl=vi.fn();expect((await runDeliveryTick({env:{},now:()=>now,fetchImpl})).status).toBe('disabled');
   expect((await worker.fetch(new Request('https://arbitrary.example/send'))).status).toBe(404);expect(fetchImpl).not.toHaveBeenCalled();
 });
 it('uses the exact inclusive/exclusive Moscow year window',async()=>{
   const env={NEWS_DELIVERY_ENABLED:'true'};
   expect((await runDeliveryTick({env,now:()=>new Date(Date.parse(DELIVERY_WINDOW.start)-1)})).status).toBe('outside_authorized_window');
   expect((await runDeliveryTick({env,now:()=>new Date(DELIVERY_WINDOW.start)})).code).toBe('delivery_credentials_missing');
   expect((await runDeliveryTick({env,now:()=>new Date(DELIVERY_WINDOW.end)})).status).toBe('outside_authorized_window');
 });
 it.each([{mode:'off',historyReconciled:true},{mode:'on',historyReconciled:false},{mode:'on',paused:true,historyReconciled:true}])('preserves existing control and never changes activation: %j',async control=>{
   const f=await fixture({control});expect((await f.run()).status).toBe('destination_not_enabled_or_history_gap');
   expect(f.client.rpc).not.toHaveBeenCalled();expect(f.store.compareAppend).not.toHaveBeenCalled();expect(f.dispatch).not.toHaveBeenCalled();
 });
 it('requires the bounded SQL prerequisites without a full-history fallback',async()=>{
   const f=await fixture({rpcError:true});const result=await f.run();expect(result.code).toBe('runtime_day_status_rpc_required');
   expect(f.client.rpc).toHaveBeenCalledTimes(1);expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();expect(f.dispatch).not.toHaveBeenCalled();
 });
 it('reports fresh news counts separately from photos or legacy acknowledgments',async()=>{
   const f=await fixture();const result=await f.run();expect(result.status).toBe('daily_target_deficit');expect(result.dayStatus.deficitToMinimum).toBe(10);
   expect(result.dayStatus.legacyReceiptsWithUnknownFirstDate).toBe(2);
   expect(f.client.rpc).toHaveBeenCalledWith('read_due_literary_news_runtime_posts',{p_destination_id:destination.id,p_now:now.toISOString(),p_limit:20});
   expect(f.store.read.mock.calls.some(([key])=>key.startsWith('admission:')||key==='post:')).toBe(false);
 });
 it('rejects contradictory day counts and wrong editorial dates',()=>{
   expect(()=>checkedDeliveryDayStatus({...day(),deficitToMinimum:0},now)).toThrow('runtime_day_status_invalid');
   expect(()=>checkedDeliveryDayStatus({...day(),editorialDay:'2026-09-28'},now)).toThrow('runtime_day_status_invalid');
   expect(()=>checkedDeliveryDayStatus({...day(1),freshCreates:0},now)).toThrow('runtime_day_status_invalid');
   expect(checkedDeliveryDayStatus({...day(),freshCreates:10,deficitToMinimum:0},now).freshPhotoCreates).toBe(0);
 });
 it('permits verified fresh text without requiring a photo registry and reports minimum by all fresh receipts',async()=>{
   const prepared=await prepareNewsPost(item('fresh-text'),{id:'verified-fixture',release:'a'.repeat(40)},'telegram');
   const f=await fixture({rows:[row('fresh-text',{prepared})],status:{...day(),freshCreates:10,deficitToMinimum:0}});
   const result=await f.run();expect(result.status).toBe('daily_minimum_reached');expect(result.selectedJobs).toBe(1);
   expect(f.dispatch.mock.calls[0][0].jobs[0].prepared.payload.text).toContain('https://probpera.ru/#literary-news');
   expect(f.env.NEWS_STATE.get).not.toHaveBeenCalled();
 });
 it('a missing photo index cannot block fresh text, while an unknown photo admission remains held',async()=>{
   const prepared=await prepareNewsPost(item('fresh-text'),{id:'verified-fixture',release:'a'.repeat(40)},'telegram');
   const f=await fixture({rows:[row('photo-without-admission'),row('fresh-text',{prepared})]});
   f.env.NEWS_STATE.get.mockResolvedValue(null);
   const result=await f.run();expect(result.status).toBe('daily_target_deficit');expect(result.selectedJobs).toBe(1);
   expect(f.dispatch.mock.calls[0][0].jobs[0].prepared.payload).toEqual(prepared.payload);
   expect(result.mediaUnavailable).toBe(1);expect(result.textFallbacks).toBe(0);
 });
 it('corrupt media index data fails closed instead of fabricating approved rights',async()=>{
   const prepared=await prepareNewsPost(item('fresh-text'),{id:'verified-fixture',release:'a'.repeat(40)},'telegram');
   const f=await fixture({rows:[row('photo'),row('fresh-text',{prepared})]});f.env.NEWS_STATE.get.mockResolvedValue('corrupt-json');
   expect((await f.run()).status).toBe('blocked');expect(f.dispatch).not.toHaveBeenCalled();
 });
 it('includes fresh text and photo creates while excluding stale/missing/future dates and retaining remote corrections',()=>{
   const fresh=row('fresh');const stale=row('stale');stale.metadata.prepared.temporal.publishedAt='2026-09-20T12:00:00Z';
   const missing=row('missing');delete missing.metadata.prepared.temporal.publishedAt;
   const future=row('future');future.metadata.prepared.temporal.publishedAt='2026-09-30T12:00:00Z';
   const text=row('text');text.metadata.prepared.media=null;
   const expired=row('expired');expired.metadata.prepared.temporal.kind='announcement';expired.metadata.prepared.temporal.eventDate='2026-09-28';
   const correction=row('correction',{remoteId:'123',status:'correction_pending',prepared:{media:null,temporal:{publishedAt:'2025-01-01T00:00:00Z'}}});
   expect(checkedDeliveryDueRows([fresh,stale,missing,future,text,expired,correction],destination,now).map(row=>row.state.newsId)).toEqual(['fresh','text','correction']);
   expect(()=>checkedDeliveryDueRows([fresh,fresh],destination,now)).toThrow('runtime_due_response_invalid');
 });
 it('treats source date-only publications at Moscow midnight and preserves fresh upcoming announcements',()=>{
   const announcement=row('announcement');announcement.metadata.prepared.temporal={kind:'announcement',eventDate:'2026-10-01',publishedAt:'2026-09-30',verifiedAt:'2026-09-29T21:00:00Z'};
   const calendar=row('calendar');calendar.metadata.prepared.temporal.kind='calendar';
   expect(checkedDeliveryDueRows([announcement,calendar],destination,new Date('2026-09-29T22:00:00Z')).map(row=>row.state.newsId)).toEqual(['announcement']);
   const invalid=row('invalid');invalid.metadata.prepared.temporal.publishedAt='2026-02-31';
   expect(checkedDeliveryDueRows([invalid],destination,now)).toEqual([]);
 });
 it('prepares available bytes once, skips early unready jobs and explicitly refuses every VK operation',async()=>{
   const bytes=Buffer.from([255,216,255,0,1,2,3]);const descriptor={sha256:mediaByteHash(bytes),byteLength:bytes.length,mime:'image/jpeg',width:480,height:640,profile:'literary-news-photo-v1'};
   const asset={id:'fixture-photo',status:'approved',newsIds:['good'],sourceUrl:'https://publisher.example/image.jpg',sourceSha256:'b'.repeat(64),subject:'book',entityEvidence:'Synthetic test',author:'Fixture',rightsholder:'Fixture',credit:'Fixture',license:'owned',licenseEvidenceUrl:'https://publisher.example/license',licenseEvidenceSha256:'c'.repeat(64),checkMethod:'ownership-record',checkedAt:'2026-09-29T00:00:00Z',validUntil:'2026-10-10T00:00:00Z',transformations:{resize:true,metadataRemoval:true,reencode:true,crop:false},permissions:[{platform:'telegram',destinationId:destination.id,publish:true,providerProcessing:true,evidenceUrl:'https://publisher.example/license'}],derivative:descriptor};
   const prepared=await prepareNewsPost(item('good'),{id:'verified-fixture',release:'a'.repeat(40)},'telegram',{destination,mediaOptions:{registry:{assets:[asset]},now,readBytes:async()=>bytes}});
   const index=await makeDeliveryMediaIndex({assets:[asset],downloadHosts:[],uploads:[{sha256:descriptor.sha256,uploadedAt:now.toISOString()}],generatedAt:now.toISOString()});
   const good=row('good',{prepared}),text=await prepareNewsPost(item('fresh-text'),{id:'verified-fixture',release:'a'.repeat(40)},'telegram');
   const f=await fixture({rows:[row('fresh-text',{prepared:text}),row('unready'),good],index});
   f.env.NEWS_STATE.get.mockImplementation(async(key,type)=>key===DELIVERY_MEDIA_INDEX_KEY?JSON.stringify(index):key===DELIVERY_MEDIA_BYTES_PREFIX+descriptor.sha256?bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength):null);
   f.dispatch.mockImplementation(async({jobs,transport})=>{
     expect(jobs.map(job=>job.newsId)).toEqual(['good','fresh-text']);
     expect(await transport.preflight({platform:'vk',id:'-123'})).toEqual({ok:false,reason:'vk_disabled'});
     expect(await transport.send({destination:{platform:'vk',id:'-123'}})).toEqual({kind:'blocked',code:'vk_disabled'});
     vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-11T00:00:00Z'));
     try{expect(await transport.prepareDelivery({destination,prepared,providerAccountId:'1'})).toEqual({kind:'blocked',code:'media_rights_or_bytes_invalid'});}
     finally{vi.useRealTimers();}
     return[];
   });
   const result=await f.run();expect(result.selectedJobs).toBe(2);expect(result.mediaUnavailable).toBe(1);
   expect(f.env.NEWS_STATE.get.mock.calls.filter(([key])=>key.startsWith(DELIVERY_MEDIA_BYTES_PREFIX))).toHaveLength(1);
 });
 it('latches actual SDK HTTP402 without another request or credential diagnostics',async()=>{
   const fetchImpl=vi.fn(async()=>Response.json({message:'sensitive response'},{status:402}));
   const f=await fixture();const result=await runDeliveryTick({env:f.env,now:()=>now,fetchImpl});
   expect(result.code).toBe('runtime_quota_exceeded');expect(result.deliveredThisRun).toBeNull();expect(fetchImpl).toHaveBeenCalledTimes(1);
   expect(JSON.stringify(result)).not.toMatch(/sensitive|isolated-key|isolated-token/);
   const latch=createDeliverySupabaseFetch('https://worker-fixture.supabase.co',fetchImpl);
   expect((await latch('https://worker-fixture.supabase.co/rest/v1/rpc/test')).status).toBe(402);
   await expect(latch('https://worker-fixture.supabase.co/rest/v1/rpc/test')).rejects.toThrow('runtime_quota_exceeded');
   expect(fetchImpl).toHaveBeenCalledTimes(2);
 });
 it('rejects unexpected Supabase endpoints and bounds streamed responses without trusting content-length',async()=>{
   const network=vi.fn();const guarded=createDeliverySupabaseFetch('https://worker-fixture.supabase.co',network);
   await expect(guarded('https://attacker.example/rest/v1/rpc/test')).rejects.toThrow('delivery_network_rejected');expect(network).not.toHaveBeenCalled();
   const response=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1025));controller.close();}}));
   await expect(boundedDeliveryResponse(response,1024)).rejects.toThrow('delivery_response_too_large');
 });
});
