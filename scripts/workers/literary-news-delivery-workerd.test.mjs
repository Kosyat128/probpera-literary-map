import { beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions, Log, LogLevel } from 'miniflare';
import { buildPublishedNewsFeed } from '../lib/literary-news-publication.mjs';
import { pendingNewsSourceState } from '../lib/literary-news-state.mjs';
import configuration from '../../data/news/social-destinations.json' with {type:'json'};
import { prepareNewsPost, newsPostKey } from '../lib/literary-news-social.mjs';
import { mediaByteHash } from '../lib/literary-news-media-policy.mjs';
import { makeDeliveryMediaIndex, DELIVERY_MEDIA_INDEX_KEY, DELIVERY_MEDIA_BYTES_PREFIX } from '../lib/literary-news-delivery-media-profile.mjs';

const current=new Date('2026-10-03T12:00:00Z'),release='a'.repeat(40);
const destination=configuration.destinations.find(row=>row.platform==='telegram');
let script,feed;
beforeAll(async()=>{
  const result=await build({stdin:{contents:`
    import { runDeliveryTick } from './literary-news-delivery-worker.mjs';
    export default { async fetch(request,env) {
      return Response.json(await runDeliveryTick({env,now:()=>new Date('${current.toISOString()}')}));
    }};`,resolveDir:fileURLToPath(new URL('.',import.meta.url))},
    bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:*'],logLevel:'silent'});
  script=result.outputFiles[0].text;
  feed=await buildPublishedNewsFeed({records:[],withdrawals:[],state:pendingNewsSourceState(),current,release});
});

async function runWorkerd({redirect=false,photo=false}={}){
  const requests=[],heartbeats=[],providerPayloads=[],rows=new Map();let sequence=0,publicFeed=feed,media;
  const seed=(key,state)=>rows.set(key,{id:++sequence,state:structuredClone(state)});
  seed(`destination:telegram:${destination.id}`,{mode:'on',paused:false,historyReconciled:true});
  if(photo){
    const record={id:'isolated-photo-news',eventKey:'isolated-photo-news',verification:'confirmed',kind:'news',category:'releases',
      eventDate:'2026-10-03',publishedAt:current.toISOString(),verifiedAt:current.toISOString(),
      title:{ru:'Издатель представил новую книгу',en:'Publisher presented a new book'},
      summary:{ru:'Издатель объявил о новой книге. Проверенное описание полностью сохранено.',en:'Publisher announced a new book. The verified description is retained.'},
      source:{name:'Isolated publisher',url:'https://publisher.example/books/new',language:'en'}};
    publicFeed=await buildPublishedNewsFeed({records:[record],withdrawals:[],state:pendingNewsSourceState(),current,release});
    const bytes=Buffer.from([255,216,255,0,1,2,3]),descriptor={sha256:mediaByteHash(bytes),byteLength:bytes.length,mime:'image/jpeg',width:480,height:640,profile:'literary-news-photo-v1'};
    const asset={id:'isolated-photo',status:'approved',newsIds:[record.id],sourceUrl:'https://publisher.example/image.jpg',
      sourceSha256:'b'.repeat(64),subject:'book',entityEvidence:'Isolated fixture',author:'Fixture',rightsholder:'Fixture',credit:'Fixture',license:'owned',
      licenseEvidenceUrl:'https://publisher.example/license',licenseEvidenceSha256:'c'.repeat(64),checkMethod:'ownership-record',
      checkedAt:'2026-10-01T00:00:00Z',validUntil:'2027-10-10T00:00:00Z',
      transformations:{resize:true,metadataRemoval:true,reencode:true,crop:false},
      permissions:[{platform:'telegram',destinationId:destination.id,publish:true,providerProcessing:true,evidenceUrl:'https://publisher.example/license'}],derivative:descriptor};
    const index=await makeDeliveryMediaIndex({assets:[asset],downloadHosts:[],uploads:[{sha256:descriptor.sha256,uploadedAt:current.toISOString()}],generatedAt:current.toISOString()});
    media={bytes,descriptor,index};
    const prepared=await prepareNewsPost(record,publicFeed.snapshot,'telegram',{destination,mediaOptions:{registry:index,now:current,deferBytes:true}}),key=newsPostKey(record.id,destination);
    seed(key,{key,newsId:record.id,destination,status:'pending',originalAdmission:current.toISOString(),prepared,
      desiredRevision:prepared.revision,nextDueAt:current.toISOString()});
  }
  const runtime=new Miniflare(convertV4MiniflareOptions({name:'isolated-news-delivery-transport',modules:true,script,
    // Match the pinned local workerd binary. The production date is newer.
    compatibilityDate:'2026-08-18',compatibilityFlags:['nodejs_compat'],cf:false,
    log:new Log(LogLevel.NONE),logRequests:false,
    kvNamespaces:['NEWS_STATE'],
    bindings:{NEWS_DELIVERY_ENABLED:'true',SUPABASE_URL:'https://worker-fixture.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY:'isolated-key',TELEGRAM_BOT_TOKEN:'123:isolated-token'},
    // Every outbound request is handled here: no credentials or live services.
    outboundService:async request=>{
      const url=new URL(request.url);requests.push(url.href);
      if(redirect)return new Response('fixture redirect',{status:302,headers:{Location:'https://untrusted.example/never-follow'}});
      if(url.origin==='https://news.probpera.ru')return Response.json(publicFeed,{headers:{'x-probpera-news-release':release}});
      if(url.origin==='https://api.telegram.org'){
        const method=url.pathname.split('/').at(-1);
        if(method==='getMe')return Response.json({ok:true,result:{id:123}});
        if(method==='getChat')return Response.json({ok:true,result:{id:Number(destination.id),type:'channel'}});
        if(method==='getChatMember')return Response.json({ok:true,result:{status:'administrator',can_post_messages:true,can_edit_messages:true}});
        if(method!=='sendPhoto')throw Error('unexpected_fixture_provider_write');
        const form=await request.formData(),file=form.get('news_photo');
        providerPayloads.push({method,caption:form.get('caption'),entities:JSON.parse(form.get('caption_entities')),
          type:file.type,bytes:Buffer.from(await file.arrayBuffer())});
        return Response.json({ok:true,result:{message_id:901,chat:{id:Number(destination.id)},photo:[{file_id:'fixture_file_id'}]}});
      }
      if(url.origin!=='https://worker-fixture.supabase.co')throw Error('unexpected_fixture_request');
      if(url.pathname.endsWith('/admin_audit_log')){
        const row=rows.get(url.searchParams.get('entity_id')?.slice(3));
        return Response.json(row?[{id:row.id,metadata:row.state}]:[]);
      }
      if(url.pathname.endsWith('/literary_news_delivery_day_status')){
        const count=[...rows.values()].filter(row=>row.state.firstAcknowledgedAt===current.toISOString()).length;
        return Response.json({editorialDay:'2026-10-03',timeZone:'Europe/Moscow',minimum:10,maximum:15,
          acknowledgedCreates:count,acknowledgedPhotoCreates:count,freshCreates:count,freshPhotoCreates:count,
          legacyReceiptsWithUnknownFirstDate:0,deficitToMinimum:10-count});
      }
      if(url.pathname.endsWith('/read_due_literary_news_runtime_posts'))return Response.json([...rows].filter(([key,row])=>key.startsWith('post:')&&row.state.status==='pending')
        .map(([entity_id,row])=>({id:row.id,entity_id,metadata:row.state})));
      if(url.pathname.endsWith('/compare_append_literary_news_runtime')){
        const body=await request.json(),prior=rows.get(body.p_key)||{id:null,state:null};
        if(prior.id!==body.p_expected_id)return Response.json({applied:false,...prior});
        if(body.p_key.startsWith('heartbeat:'))heartbeats.push(body);
        seed(body.p_key,body.p_state);
        return Response.json({applied:true,...rows.get(body.p_key)});
      }
      throw Error('unexpected_fixture_request');
    }}));
  try{
    if(media){const kv=await runtime.getKVNamespace('NEWS_STATE');
      await kv.put(DELIVERY_MEDIA_INDEX_KEY,JSON.stringify(media.index));
      await kv.put(DELIVERY_MEDIA_BYTES_PREFIX+media.descriptor.sha256,media.bytes);}
    return {report:await (await runtime.dispatchFetch('https://fixture.internal/run')).json(),requests,heartbeats,providerPayloads,rows,media};
  }
  finally{await runtime.dispose();}
}

describe('native delivery under the actual Workers fetch implementation',()=>{
  it('reaches the SDK, feed and durable heartbeat with no injected Node fetch',async()=>{
    const {report,requests,heartbeats}=await runWorkerd();
    expect(report).toMatchObject({status:'daily_target_deficit',phase:'heartbeat',heartbeatRecorded:true,
      deliveredThisRun:0,providerWriteAttempts:0,externalRequests:7});
    expect(requests).toHaveLength(7);expect(heartbeats).toHaveLength(1);
    expect(heartbeats[0]).toMatchObject({p_key:'heartbeat:native-delivery',p_state:{heartbeatRecorded:true,externalRequests:7}});
    expect(requests.every(url=>new URL(url).origin!=='https://api.telegram.org')).toBe(true);
  },15000);
  it('rejects a real Workers redirect without following it or attempting publication',async()=>{
    const {report,requests,heartbeats}=await runWorkerd({redirect:true});
    expect(report).toMatchObject({status:'blocked',phase:'destination',heartbeatRecorded:false,externalRequests:1,providerWriteAttempts:0});
    expect(requests).toHaveLength(1);expect(heartbeats).toEqual([]);
    expect(requests[0]).toMatch(/^https:\/\/worker-fixture\.supabase\.co\/rest\/v1\/admin_audit_log\?/);
  },15000);
  it('uploads a photo with actual Workers FormData and persists the acknowledged receipt and heartbeat',async()=>{
    const {report,requests,heartbeats,providerPayloads,rows,media}=await runWorkerd({photo:true});
    expect(report).toMatchObject({status:'daily_target_deficit',heartbeatRecorded:true,providerWriteAttempts:1,
      acknowledgedCreatesThisRun:1,acknowledgedCorrectionsThisRun:0,deliveredThisRun:1,dayStatus:{freshCreates:1,freshPhotoCreates:1}});
    expect(requests.length).toBe(report.externalRequests);expect(requests.length).toBeLessThanOrEqual(50);
    expect(providerPayloads).toHaveLength(1);
    expect(providerPayloads[0]).toMatchObject({method:'sendPhoto',type:'image/jpeg',bytes:media.bytes});
    const payload=providerPayloads[0];
    expect(payload.caption.length).toBeLessThanOrEqual(1024);
    expect(payload.entities.filter(entity=>entity.type==='url').map(entity=>payload.caption.slice(entity.offset,entity.offset+entity.length)))
      .toEqual(expect.arrayContaining(['https://publisher.example/books/new','https://probpera.ru/#literary-news']));
    expect(rows.get(newsPostKey('isolated-photo-news',destination)).state).toMatchObject({status:'sent_current',remoteId:'901',
      remoteMediaKind:'photo',firstAcknowledgedAt:current.toISOString(),acknowledgedAt:current.toISOString(),dispatchStartedAt:null});
    expect(heartbeats).toHaveLength(1);expect(heartbeats[0].p_state.acknowledgedCreatesThisRun).toBe(1);
  },15000);
});
