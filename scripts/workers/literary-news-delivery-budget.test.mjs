import { afterAll, describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import configuration from '../../data/news/social-destinations.json' with { type: 'json' };
import { runDeliveryTick, runDeliveryCaptureTick, rotatingNativeNewsCaptureIds,
  createDeliveryRequestBudget, scheduleNativeNewsDelivery,LiteraryNewsDeliveryCoordinator } from './literary-news-delivery-worker.mjs';
import { NATIVE_NEWS_ADMISSION_FEED_URL, fetchNativeNewsAdmissionFeed } from '../lib/literary-news-native-admissions.mjs';
import { buildPublishedNewsFeed } from '../lib/literary-news-publication.mjs';
import { pendingNewsSourceState } from '../lib/literary-news-state.mjs';
import { newsPostKey, prepareNewsPost } from '../lib/literary-news-social.mjs';
import { makeDeliveryMediaIndex, DELIVERY_MEDIA_INDEX_KEY, DELIVERY_MEDIA_BYTES_PREFIX } from '../lib/literary-news-delivery-media-profile.mjs';
import { mediaByteHash } from '../lib/literary-news-media-policy.mjs';
import { captureChangedNativeNews } from '../lib/literary-news-capture-progress.mjs';

const current=new Date('2026-10-02T12:00:00Z'),destination=configuration.destinations.find(row=>row.platform==='telegram');
const controlKey=`destination:telegram:${destination.id}`,release='a'.repeat(40);
const evidence=[];
afterAll(async()=>{
  const directory=new URL('../../.tmp/telegram-live-audit/',import.meta.url);
  await mkdir(directory,{recursive:true});
  await writeFile(new URL('sdk-budget-verification.json',directory),JSON.stringify({schemaVersion:1,externalProviderWrites:0,
    scope:'Real Supabase SDK, reconciliation and dispatch; all external HTTP is isolated fixture transport.',scenarios:evidence},null,2)+'\n');
});
const item=id=>({id,eventKey:id,verification:'confirmed',kind:'news',category:'releases',eventDate:'2026-10-02',
  publishedAt:current.toISOString(),verifiedAt:current.toISOString(),title:{ru:'Издатель представил новую книгу',en:'Publisher presented a new book'},
  summary:{ru:`Издатель объявил о книге ${id}. Проверенное описание полностью сохраняется.`,en:`Publisher announced book ${id}. The reviewed description is retained.`},
  source:{name:'Isolated publisher fixture',url:`https://publisher.example/books/${id}`,language:'en'}});

async function sdkFixture({corrections=0,creates=0,photo=true,receiptConflicts=0,claimConflicts=0,captureConflicts=0,quotaAt=null,providerFailure=false,
  priorPacing=false,extraFeedReads=0,cachedPhoto=false,
  control={mode:'on',paused:false,historyReconciled:true}}={}){
  const records=Array.from({length:30},(_,i)=>item(`news-${String(i).padStart(2,'0')}`));
  const correctionRecords=Array.from({length:corrections},(_,i)=>item(`correction-${String(i).padStart(2,'0')}`));
  const feed=await buildPublishedNewsFeed({records:[...records,...correctionRecords],withdrawals:[],state:pendingNewsSourceState(),current,release});
  const bytes=Buffer.from([255,216,255,0,1,2,3]),descriptor={sha256:mediaByteHash(bytes),byteLength:bytes.length,mime:'image/jpeg',width:480,height:640,profile:'literary-news-photo-v1'};
  const asset={id:'fixture-photo',status:'approved',newsIds:records.slice(0,20).map(row=>row.id),sourceUrl:'https://publisher.example/image.jpg',
    sourceSha256:'b'.repeat(64),subject:'book',entityEvidence:'Synthetic test',author:'Fixture',rightsholder:'Fixture',credit:'Fixture',license:'owned',
    licenseEvidenceUrl:'https://publisher.example/license',licenseEvidenceSha256:'c'.repeat(64),checkMethod:'ownership-record',
    checkedAt:'2026-10-01T00:00:00Z',validUntil:'2026-10-10T00:00:00Z',
    transformations:{resize:true,metadataRemoval:true,reencode:true,crop:false},
    permissions:[{platform:'telegram',destinationId:destination.id,publish:true,providerProcessing:true,evidenceUrl:'https://publisher.example/license'}],derivative:descriptor};
  const assets=photo?[asset]:[],index=await makeDeliveryMediaIndex({assets,downloadHosts:[],uploads:photo?[{sha256:descriptor.sha256,uploadedAt:current.toISOString()}]:[],generatedAt:current.toISOString()});
  const rows=new Map(),requests=[],writes=[],conflicts=new Map(),invocations=new Map();let sequence=0,acknowledgedCreates=0,invocation='none';
  const seed=(key,state)=>rows.set(key,{id:++sequence,state:structuredClone(state)});
  seed(controlKey,control);
  const pacingKey=`history:pacing:telegram:${destination.id}`,priorKey=newsPostKey('prior-receipt',destination);
  if(priorPacing){
    const reservedAt=new Date(current.getTime()-6600000).toISOString();
    seed(priorKey,{key:priorKey,destination,remoteId:'699',status:'sent_current',
      firstAcknowledgedAt:new Date(current.getTime()-6300000).toISOString()});
    seed(pacingKey,{schemaVersion:4,key:pacingKey,platform:'telegram',destinationId:destination.id,
      day:'2026-10-02',reservations:1,timeZone:'Europe/Moscow',dailyLimit:20,intervalSeconds:3000,
      minIntervalSeconds:2700,maxIntervalSeconds:3300,scheduleToleranceSeconds:0,publicationStartHour:8,publicationEndHourExclusive:23,
      reservedAt,nextDueAt:new Date(Date.parse(reservedAt)+3000000).toISOString(),jobKey:priorKey,attemptId:'prior-attempt'});
  }
  const prepare=record=>prepareNewsPost(record,feed.snapshot,'telegram',{destination,mediaOptions:{registry:{assets},now:current,deferBytes:true}});
  for(const [index,record] of correctionRecords.entries()){
    const prepared=await prepare(record),key=newsPostKey(record.id,destination);
    seed(key,{key,newsId:record.id,destination,status:'correction_pending',originalAdmission:'2026-09-30T12:00:00Z',
      prepared,desiredRevision:prepared.revision,remoteId:String(700+index),remoteMediaKind:'text',firstAcknowledgedAt:'2026-09-30T12:00:00Z',nextDueAt:current.toISOString()});
  }
  for(const record of records.slice(0,creates)){
    const prepared=await prepare(record),key=newsPostKey(record.id,destination);
    seed(key,{key,newsId:record.id,destination,status:'pending',originalAdmission:'2026-10-01T12:00:00Z',
      prepared,desiredRevision:prepared.revision,nextDueAt:current.toISOString(),
      ...(cachedPhoto?{mediaCache:{platform:'telegram',destinationId:destination.id,providerAccountId:'123',sha256:descriptor.sha256,fileId:'cached_file_id'}}:{})});
  }
  const status=()=>{
    const acknowledged=[...rows.values()].map(row=>row.state).filter(job=>job.firstAcknowledgedAt===current.toISOString());
    const photos=acknowledged.filter(job=>job.remoteMediaKind==='photo').length;
    return {editorialDay:'2026-10-02',timeZone:'Europe/Moscow',minimum:10,maximum:20,
      acknowledgedCreates:acknowledged.length,acknowledgedPhotoCreates:photos,freshCreates:acknowledged.length,freshPhotoCreates:photos,
      legacyReceiptsWithUnknownFirstDate:0,deficitToMinimum:Math.max(0,10-acknowledged.length)};
  };
  const fetchImpl=vi.fn(async(input,options={})=>{
    const url=new URL(input instanceof URL?input.href:typeof input==='string'?input:input.url);
    expect(options.redirect).toBe('manual');requests.push({invocation,path:url.pathname,origin:url.origin,key:url.searchParams.get('entity_id')?.slice(3)});
    expect(requests.filter(row=>row.invocation===invocation).length).toBeLessThanOrEqual(50);
    if(url.href===NATIVE_NEWS_ADMISSION_FEED_URL){
      const response=Response.json(feed,{headers:{'x-probpera-news-release':release}});
      Object.defineProperty(response,'url',{value:url.href});return response;
    }
    if(url.origin==='https://worker-fixture.supabase.co'){
      if(url.pathname==='/budget-read')return Response.json({});
      if(url.pathname.endsWith('/admin_audit_log')){
        const key=url.searchParams.get('entity_id')?.slice(3),row=rows.get(key);
        return Response.json(row?[{id:row.id,metadata:structuredClone(row.state)}]:[]);
      }
      const body=JSON.parse(options.body);
      if(url.pathname.endsWith('/literary_news_delivery_day_status'))return Response.json(status());
      if(url.pathname.endsWith('/read_due_literary_news_runtime_posts')){
        const due=[...rows].filter(([key,row])=>key.startsWith('post:')&&['pending','correction_pending','inflight'].includes(row.state.status)
          &&!(row.state.nextDueAt&&Date.parse(row.state.nextDueAt)>current.getTime()));
        due.sort((left,right)=>Number(Boolean(right[1].state.remoteId))-Number(Boolean(left[1].state.remoteId)));
        return Response.json(due.slice(0,20).map(([entity_id,row])=>({id:row.id,entity_id,metadata:structuredClone(row.state)})));
      }
      if(url.pathname.endsWith('/compare_append_literary_news_runtime')){
        const key=body.p_key,prior=rows.get(key)||{id:null,state:null};
        if(quotaAt==='heartbeat'&&key.startsWith('heartbeat:')
          ||quotaAt==='capture'&&invocation==='capture'&&!key.startsWith('heartbeat:')
          ||quotaAt==='receipt'&&body.p_state.status==='sent_current')return Response.json({code:'402',message:'PRIVATE_QUOTA_RESPONSE'},{status:402});
        const required=body.p_state.status==='sent_current'?receiptConflicts
          :body.p_state.status==='inflight'&&!body.p_state.dispatchStartedAt?claimConflicts
          :key.startsWith('admission:')||key.startsWith('post:')?captureConflicts:0;
        const marker=key+':'+(body.p_state.status||'admission');
        if((conflicts.get(marker)||0)<required){conflicts.set(marker,(conflicts.get(marker)||0)+1);return Response.json({applied:false,...structuredClone(prior)});}
        if(prior.id!==body.p_expected_id)return Response.json({applied:false,...structuredClone(prior)});
        if(body.p_control_key){const control=rows.get(body.p_control_key);
          if(control?.id!==body.p_expected_control_id||control.state.paused)return Response.json({applied:false,...structuredClone(prior)});}
        seed(key,body.p_state);return Response.json({applied:true,...structuredClone(rows.get(key))});
      }
      throw Error('unexpected_sdk_path');
    }
    if(url.origin==='https://api.telegram.org'){
      const method=url.pathname.split('/').at(-1);
      if(method==='getMe')return Response.json({ok:true,result:{id:123}});
      if(method==='getChat')return Response.json({ok:true,result:{id:Number(destination.id),type:'channel'}});
      if(method==='getChatMember')return Response.json({ok:true,result:{status:'administrator',can_post_messages:true,can_edit_messages:true}});
      writes.push(method);
      if(providerFailure)return Response.json({ok:false},{status:500});
      const payload=options.body instanceof FormData?Object.fromEntries(options.body.entries()):JSON.parse(options.body);
      const remote=payload.message_id?Number(payload.message_id):900+(++acknowledgedCreates);
      return Response.json({ok:true,result:{message_id:remote,chat:{id:Number(destination.id)},
        ...(/Photo|Media/.test(method)?{photo:[{file_id:'fixture_file_id'}]}:{})}});
    }
    throw Error('unexpected_network');
  });
  const env={NEWS_DELIVERY_ENABLED:'true',SUPABASE_URL:'https://worker-fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'isolated-key',
    TELEGRAM_BOT_TOKEN:'123:isolated-token',NEWS_STATE:{get:async(key)=>key===DELIVERY_MEDIA_INDEX_KEY?JSON.stringify(index)
      :key===DELIVERY_MEDIA_BYTES_PREFIX+descriptor.sha256?bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength):null}};
  const run=async (phase,captureOptions={})=>{
    const count=(invocations.get(phase)||0)+1;invocations.set(phase,count);invocation=count===1?phase:`${phase}-${count}`;
    const fetchFeedImpl=async args=>{const value=await fetchNativeNewsAdmissionFeed(args);
      for(let i=0;i<extraFeedReads;i++)await args.fetchImpl('https://worker-fixture.supabase.co/budget-read');return value;};
    const report=await (phase==='capture'?runDeliveryCaptureTick({env,now:()=>current,fetchImpl,...captureOptions}):runDeliveryTick({env,now:()=>current,fetchImpl,fetchFeedImpl}));
    evidence.push({phase,corrections,creates,receiptConflicts,claimConflicts,captureConflicts,quotaAt,providerFailure,priorPacing,extraFeedReads,cachedPhoto,
      externalRequests:report.externalRequests,providerWriteAttempts:report.providerWriteAttempts||0,
      status:report.status,code:report.code||null,heartbeatRecorded:report.heartbeatRecorded,
      acknowledgedCreatesThisRun:report.acknowledgedCreatesThisRun||0,acknowledgedCorrectionsThisRun:report.acknowledgedCorrectionsThisRun||0});
    return report;
  };
  return {run,rows,requests,writes,feed,status,pacingKey,priorKey};
}

describe('native capture and dispatch under the real SDK external-request budget',()=>{
  it('does not duplicate an acknowledged create after timer persistence fails and alarm/Cron retry concurrently',async()=>{
    const f=await sdkFixture({creates:1,photo:false}),storage={setAlarm:vi.fn()
      .mockRejectedValueOnce(Error('PRIVATE storage failure')).mockResolvedValue(undefined),deleteAlarm:vi.fn()};
    const runTick=vi.fn(()=>f.run('dispatch'));
    const coordinator=new LiteraryNewsDeliveryCoordinator({storage},{NEWS_DELIVERY_ENABLED:'true'},{runTick,now:()=>current});
    await expect(coordinator.alarm()).rejects.toThrow('delivery_alarm_retry_required');
    expect(f.writes).toEqual(['sendMessage']);
    const prior=structuredClone(f.rows.get(f.pacingKey));
    const [alarm,response]=await Promise.all([coordinator.alarm(),coordinator.fetch(new Request('https://internal/dispatch',{method:'POST'}))]);
    expect(alarm).toBeUndefined();expect(response.status).toBe(200);
    expect((await response.json()).deliveredThisRun).toBe(0);
    expect(runTick).toHaveBeenCalledTimes(2);expect(storage.setAlarm).toHaveBeenCalledTimes(2);
    expect(f.writes).toEqual(['sendMessage']);expect(f.rows.get(f.pacingKey)).toEqual(prior);
    expect(prior.state.intervalSeconds).toBe(6300);
    expect(f.rows.get(newsPostKey('news-00',destination)).state).toMatchObject({status:'sent_current',remoteId:'901',firstAcknowledgedAt:current.toISOString()});
    for(const invocation of ['dispatch','dispatch-2'])
      expect(f.requests.filter(row=>row.invocation===invocation).length).toBeLessThanOrEqual(50);
  });
  it('captures all current IDs immediately in bounded SDK batches, skips unchanged records and admits fresh arrivals',async()=>{
    const f=await sdkFixture(),state=new Map(),storage={get:async key=>structuredClone(state.get(key)),
      put:async(key,value)=>state.set(key,structuredClone(value))};
    const capture=()=>captureChangedNativeNews({storage,capture:options=>f.run('capture',options)});
    for(let i=0;i<6;i++){
      const report=await capture();expect(report).toMatchObject({status:'admissions_captured',capturedCandidates:4});
      expect(report.externalRequests).toBeLessThanOrEqual(22);
    }
    expect([...f.rows.keys()].filter(key=>key.startsWith('admission:'))).toHaveLength(24);
    expect(await capture()).toMatchObject({status:'capture_not_due',capturedCandidates:0,newAdmissions:0});
    const record=item('fresh-after-preparation');
    const fresh=await buildPublishedNewsFeed({records:[record,...f.feed.items],withdrawals:[],state:pendingNewsSourceState(),current,release});
    Object.assign(f.feed,fresh);
    expect(await capture()).toMatchObject({status:'admissions_captured',capturedCandidates:1,newAdmissions:1});
    expect(f.rows.get(newsPostKey(record.id,destination)).state).toMatchObject({status:'pending',newsId:record.id});
    expect(f.rows.get(newsPostKey(record.id,destination)).state.remoteId).toBeUndefined();
    expect(f.writes).toEqual([]);
  });
  it('finishes a 50-request SDK dispatch before a separate private preparation recovery',async()=>{
    const f=await sdkFixture({creates:1,photo:true,priorPacing:true,extraFeedReads:4,claimConflicts:4,receiptConflicts:4});
    const phases=[],reports=[],noRetry=vi.fn();
    const delivery={idFromName:name=>name,get:()=>({fetch:async url=>{
      const phase=new URL(url).pathname.slice(1);phases.push(phase);
      const report=await f.run(phase);reports.push(report);return Response.json(report);
    }})};
    const recovery={idFromName:name=>name,get:()=>({fetch:async()=>{
      phases.push('recover');expect(reports).toHaveLength(2);
      expect(reports[1]).toMatchObject({externalRequests:50,deliveredThisRun:1,heartbeatRecorded:true});
      expect(f.writes).toEqual(['sendPhoto']);return Response.json({status:'skipped',publicationConfirmed:false});
    }})};
    const report=await scheduleNativeNewsDelivery({noRetry},{NEWS_DELIVERY_ENABLED:'true',
      DELIVERY_COORDINATOR:delivery,NEWS_PREPARATION_RECOVERY:recovery},{now:()=>new Date('2026-10-09T13:25:00Z'),log:vi.fn()});
    expect(phases).toEqual(['capture','dispatch','recover']);expect(report).toEqual(reports[1]);
    for(const phase of ['capture','dispatch'])expect(f.requests.filter(row=>row.invocation===phase).length).toBeLessThanOrEqual(50);
    expect(f.requests).toHaveLength(reports[0].externalRequests+reports[1].externalRequests);
    expect(f.writes).toEqual(['sendPhoto']);expect(noRetry).not.toHaveBeenCalled();
  });
  it.each(['capture','dispatch'])('persists the paused %s heartbeat with three real SDK requests and zero provider requests',async phase=>{
    const control={mode:'on',paused:true,pauseReason:'release_operator_pause',historyReconciled:true};
    const f=await sdkFixture({control,creates:1}),before=structuredClone(f.rows.get(controlKey)),report=await f.run(phase);
    expect(report).toMatchObject({status:'destination_not_enabled_or_history_gap',reason:'destination_paused',
      pauseReason:'release_operator_pause',finishedAt:current.toISOString(),externalRequests:3,heartbeatRecorded:true,providerWriteAttempts:0,deliveredThisRun:0});
    expect(f.requests).toHaveLength(3);expect(f.requests.every(row=>row.origin==='https://worker-fixture.supabase.co')).toBe(true);
    expect(f.writes).toEqual([]);expect(f.rows.get(controlKey)).toEqual(before);
    expect(f.rows.get(phase==='capture'?'heartbeat:native-delivery-capture':'heartbeat:native-delivery').state)
      .toMatchObject({status:report.status,externalRequests:3,heartbeatRecorded:true});
  });
  it('stops immediately if persisting a paused heartbeat hits the runtime quota',async()=>{
    const f=await sdkFixture({control:{mode:'on',paused:true,historyReconciled:true},quotaAt:'heartbeat'}),report=await f.run('dispatch');
    expect(report).toMatchObject({status:'blocked',code:'runtime_quota_exceeded',externalRequests:3,heartbeatRecorded:false});
    expect(f.requests).toHaveLength(3);expect(f.writes).toEqual([]);expect(f.rows.has('heartbeat:native-delivery')).toBe(false);
  });
  it('captures four of a full 30-record proof in 22 requests, then creates one photo and safely defers an old edit',async()=>{
    const f=await sdkFixture({corrections:14,creates:6});
    const original=JSON.stringify(f.feed),capture=await f.run('capture'),delivery=await f.run('dispatch');
    expect(capture).toMatchObject({status:'admissions_captured',capturedCandidates:4,deliveredThisRun:0,heartbeatRecorded:true});
    expect(capture.externalRequests).toBeLessThanOrEqual(22);
    expect(delivery).toMatchObject({deliveredThisRun:1,ambiguousThisRun:0,heartbeatRecorded:true,selectedJobs:2,
      status:'request_budget_deferred',providerWriteAttempts:1,acknowledgedCreatesThisRun:1,acknowledgedCorrectionsThisRun:0});
    expect(f.writes).toEqual(['sendPhoto']);
    expect(delivery.dayStatus).toMatchObject({freshCreates:1,freshPhotoCreates:1});
    expect(f.requests.filter(row=>row.invocation==='dispatch'&&row.path.includes('compare_append')).length).toBeGreaterThan(0);
    for(const phase of ['capture','dispatch']){
      const result=phase==='capture'?capture:delivery;
      expect(result.externalRequests).toBe(f.requests.filter(row=>row.invocation===phase).length);
      expect(result.externalRequests).toBeLessThanOrEqual(50);
    }
    expect(JSON.stringify(f.feed)).toBe(original);
    expect([...f.rows.keys()].some(key=>key.startsWith('admission:'))).toBe(true);
    expect(f.requests.some(row=>row.path.includes('read_latest'))).toBe(false);
    const correction=f.rows.get(newsPostKey('correction-00',destination)).state;
    expect(correction).toMatchObject({status:'correction_pending',remoteId:'700',firstAcknowledgedAt:'2026-09-30T12:00:00Z'});
    const next=await f.run('dispatch');
    expect(next.acknowledgedCorrectionsThisRun).toBeGreaterThanOrEqual(1);
    expect(next.acknowledgedCreatesThisRun).toBe(0);
    expect(f.rows.get(newsPostKey('correction-00',destination)).state).toMatchObject({status:'sent_current',remoteId:'700'});
  });
  it.each([{photo:false,extraFeedReads:10},{photo:true,extraFeedReads:4},{photo:true,cachedPhoto:true,extraFeedReads:3}])(
    'reserves the actual prior receipt, all claim and receipt CAS attempts, and heartbeat at the exact request boundary: %j',async options=>{
      const f=await sdkFixture({...options,creates:1,priorPacing:true,claimConflicts:4,receiptConflicts:4});
      const report=await f.run('dispatch');
      expect(report).toMatchObject({deliveredThisRun:1,providerWriteAttempts:1,heartbeatRecorded:true,externalRequests:50});
      expect(f.requests).toHaveLength(50);expect(f.writes).toEqual([options.photo?'sendPhoto':'sendMessage']);
      expect(f.rows.get(f.pacingKey).state).toMatchObject({schemaVersion:5,reservations:2,intervalSeconds:6300});
      expect(f.rows.get(newsPostKey('news-00',destination)).state).toMatchObject({status:'sent_current',firstAcknowledgedAt:current.toISOString()});
      const receiptReads=f.requests.filter(row=>row.key===f.priorKey);
      expect(receiptReads).toHaveLength(1);
    });
  it.each([{photo:false,extraFeedReads:11},{photo:true,extraFeedReads:5},{photo:true,cachedPhoto:true,extraFeedReads:4}])(
    'defers before claiming or consuming a 105-minute slot when one request is missing: %j',async options=>{
      const f=await sdkFixture({...options,creates:1,priorPacing:true,claimConflicts:4,receiptConflicts:4});
      const before=structuredClone(f.rows.get(f.pacingKey)),job=structuredClone(f.rows.get(newsPostKey('news-00',destination)));
      const report=await f.run('dispatch');
      expect(report).toMatchObject({status:'request_budget_deferred',attemptedJobs:0,providerWriteAttempts:0,heartbeatRecorded:true});
      expect(f.writes).toEqual([]);expect(f.rows.get(f.pacingKey)).toEqual(before);
      expect(f.rows.get(newsPostKey('news-00',destination))).toEqual(job);
    });
  it('makes four completely new admissions within 22 requests and never writes to a provider during capture',async()=>{
    const f=await sdkFixture(),report=await f.run('capture');
    expect(report).toMatchObject({newAdmissions:4,capturedCandidates:4,externalRequests:22,heartbeatRecorded:true});
    expect(f.writes).toEqual([]);expect(f.requests.some(row=>row.origin==='https://api.telegram.org')).toBe(false);
  });
  it('covers all 24 selected IDs across six ticks without replacing the full-feed proof',async()=>{
    const f=await sdkFixture(),ids=new Set();
    for(let offset=0;offset<6;offset++)for(const id of rotatingNativeNewsCaptureIds(f.feed,new Date(current.getTime()+offset*3600000)))ids.add(id);
    expect(ids.size).toBe(24);expect(f.feed.items).toHaveLength(30);
  });
  it('reserves all five receipt CAS attempts and the heartbeat after a real accepted photo, then defers the second job',async()=>{
    const f=await sdkFixture({creates:6,corrections:14,receiptConflicts:4}),report=await f.run('dispatch');
    expect(report).toMatchObject({status:'request_budget_deferred',attemptedJobs:1,heartbeatRecorded:true});
    expect(report.externalRequests).toBeLessThanOrEqual(50);
    expect(f.writes[0]).toBe('sendPhoto');expect(report.dayStatus.freshCreates).toBe(1);
    const sent=[...f.rows.values()].filter(row=>row.state.firstAcknowledgedAt===current.toISOString());
    expect(sent).toHaveLength(1);expect(sent[0].state.status).toBe('sent_current');
    expect(report.externalRequests).toBe(f.requests.length);
  });
  it('stops partial capture before the 49th ordinary request and records an actual failure heartbeat within the reserved two requests',async()=>{
    const f=await sdkFixture({captureConflicts:4}),report=await f.run('capture');
    expect(report).toMatchObject({status:'blocked',code:'delivery_request_budget_exhausted',phase:'capture',externalRequests:50,heartbeatRecorded:true});
    expect(f.rows.get('heartbeat:native-delivery-capture').state).toMatchObject({status:'blocked',externalRequests:50});
    expect(f.writes).toEqual([]);
  });
  it.each(['capture','receipt'])('latches HTTP402 at %s and performs no later request, heartbeat or second provider write',async quotaAt=>{
    const f=await sdkFixture({creates:6,corrections:14,quotaAt}),phase=quotaAt==='capture'?'capture':'dispatch';
    const report=await f.run(phase);
    expect(report).toMatchObject({status:'blocked',code:'runtime_quota_exceeded',heartbeatRecorded:false,deliveredThisRun:null});
    expect(report.externalRequests).toBe(f.requests.length);expect(f.writes.length).toBe(quotaAt==='capture'?0:1);
    expect(f.rows.has(phase==='capture'?'heartbeat:native-delivery-capture':'heartbeat:native-delivery')).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|isolated-key|isolated-token|publisher\.example/);
  });
  it('records an uncertain first provider outcome and never starts the second write or invents an acknowledgement',async()=>{
    const f=await sdkFixture({creates:6,corrections:14,providerFailure:true}),report=await f.run('dispatch');
    expect(report).toMatchObject({status:'dispatch_reconciliation_required',deliveredThisRun:0,ambiguousThisRun:1,heartbeatRecorded:true});
    expect(f.writes).toEqual(['sendPhoto']);expect(report.dayStatus.freshCreates).toBe(0);
  });
  it('keeps two requests for a heartbeat and disables provider writes when the full receipt reserve no longer fits',async()=>{
    const network=vi.fn(async()=>Response.json({})),budget=createDeliveryRequestBudget(network);
    for(let i=0;i<37;i++)await budget.fetch('https://fixture.example/read',{redirect:'follow'});
    expect(budget.canWriteProvider()).toBe(false);
    for(let i=37;i<48;i++)await budget.fetch('https://fixture.example/read');
    await expect(budget.fetch('https://fixture.example/read')).rejects.toThrow('delivery_request_budget_exhausted');
    expect(network).toHaveBeenCalledTimes(48);budget.beginHeartbeat();
    await budget.fetch('https://fixture.example/heartbeat-read');await budget.fetch('https://fixture.example/heartbeat-cas');
    expect(budget.requests).toBe(50);expect(network.mock.calls.every(([,options])=>options.redirect==='manual')).toBe(true);
  });
  it.each([301,302,303,307,308])('rejects HTTP%s without following the Location or exposing its response body',async status=>{
    const cancel=vi.fn(),network=vi.fn(async()=>new Response(new ReadableStream({cancel}),
      {status,headers:{Location:'https://untrusted.example/redirect'}})),budget=createDeliveryRequestBudget(network);
    await expect(budget.fetch('https://fixture.example/read',{redirect:'error'})).rejects.toThrow('delivery_network_rejected');
    expect(network).toHaveBeenCalledOnce();expect(cancel).toHaveBeenCalledOnce();
    expect(budget.requests).toBe(1);expect(budget.providerWrites).toBe(0);
  });
});
