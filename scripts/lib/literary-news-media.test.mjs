import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { checkedNewsMediaAsset, downloadNewsMediaAsset, mediaByteHash, normalizeNewsMedia, selectNewsMedia,
  validatePreparedNewsMedia } from "./literary-news-media.mjs";
import { checkedVkNewsUploadUrl, createPinnedVkNewsUpload } from "./literary-news-media-upload.mjs";
import { prepareNewsPost, reconcileNewsSnapshot, dispatchNewsJob, newsPostKey } from "./literary-news-social.mjs";
import { createNewsSocialTransport } from "./literary-news-social-transport.mjs";
import { buildPublishedNewsFeed } from "./literary-news-publication.mjs";
import { pendingNewsSourceState } from "./literary-news-state.mjs";

const now=new Date("2026-09-26T12:00:00Z");
const telegram={platform:"telegram",id:"-100123",mode:"on"},vk={platform:"vk",id:"-456",mode:"on"};
const item={id:"media-fixture",eventKey:"media-fixture",category:"releases",kind:"news",eventDate:"2026-09-25",publishedAt:null,
  verifiedAt:"2026-09-25T12:00:00Z",verification:"confirmed",title:{ru:"Книга 😀",en:"Book"},summary:{ru:"Издатель сообщил о новой книге.",en:"A publisher announced a new book."},
  source:{name:"Publisher",url:"https://publisher.example/news/book",language:"en"}};
const snapshot={id:"test",release:"a".repeat(40)};
async function fixture() {
  const source=await sharp({create:{width:480,height:640,channels:3,background:"#8f7788"}}).png().toBuffer();
  const normalized=await normalizeNewsMedia(source,"image/png");
  const asset={id:"fixture",status:"approved",newsIds:[item.id],sourceUrl:"https://publisher.example/photo.png",sourceSha256:mediaByteHash(source),
    subject:"book",entityEvidence:"Synthetic fixture only; never a real book cover.",author:"Fixture",rightsholder:"Fixture",credit:"Synthetic fixture © Fixture",
    license:"owned",licenseEvidenceUrl:"https://publisher.example/fixture-license",licenseEvidenceSha256:"a".repeat(64),checkMethod:"ownership-record",
    checkedAt:"2026-09-26T00:00:00Z",validUntil:"2026-10-20T00:00:00Z",transformations:{resize:true,metadataRemoval:true,reencode:true,crop:false},
    permissions:[telegram,vk].map(d=>({platform:d.platform,destinationId:d.id,publish:true,providerProcessing:true,evidenceUrl:"https://publisher.example/fixture-license"})),
    derivative:normalized.descriptor};
  const mediaOptions={registry:{assets:[asset],downloadHosts:["publisher.example"]},now,readBytes:async()=>normalized.bytes};
  return {asset,source,...normalized,mediaOptions};
}
async function prepared(destination=telegram,context=null) {
  const f=context||await fixture();return {...f,prepared:await prepareNewsPost(item,snapshot,destination.platform,{destination,mediaOptions:f.mediaOptions})};
}
function memoryStore() {
  const rows=new Map();let id=0;
  return {async read(key){return structuredClone(rows.get(key)||{id:null,state:null});},async list(prefix){return [...rows].filter(([key])=>key.startsWith(prefix)).map(([,v])=>structuredClone(v));},
    async compareAppend(key,expected,state,guard){const old=await this.read(key);if(old.id!==expected)return {applied:false,...old};
      if(guard){const c=await this.read(guard.key);if(c.id!==guard.id||c.state.paused)return{applied:false,...old};}
      const next={id:++id,state:structuredClone(state)};rows.set(key,next);return{applied:true,...structuredClone(next)};},
    async seed(key,state){return this.compareAppend(key,(await this.read(key)).id,state);}};
}
const feed=(rows=[item],withdrawals=[])=>buildPublishedNewsFeed({records:rows,withdrawals,current:now,timeZone:"Europe/Moscow",release:snapshot.release,state:pendingNewsSourceState([])});
async function setup(destination=telegram){const f=await fixture(),store=memoryStore();await reconcileNewsSnapshot(store,await feed(),[destination],now,{mediaOptions:f.mediaOptions});
  await store.seed(`destination:${destination.platform}:${destination.id}`,{mode:"on",paused:false,historyReconciled:true});return{...f,store,key:newsPostKey(item.id,destination)};}

describe("bounded media and destination rights",()=>{
  it("decodes, contains, strips EXIF/GPS and preserves portrait proportions",async()=>{
    const png=await sharp({create:{width:480,height:640,channels:3,background:"white"}}).withMetadata({orientation:6}).png().toBuffer();
    const result=await normalizeNewsMedia(png,"image/png"),meta=await sharp(result.bytes).metadata();
    expect(meta.format).toBe("jpeg");expect(meta.width).toBe(640);expect(meta.height).toBe(480);expect(meta.exif).toBeUndefined();
    expect(result.descriptor.sha256).toBe(mediaByteHash(result.bytes));
  });
  it("rejects HTML disguised as jpeg, declared-MIME mismatch and corrupt raster bytes",async()=>{
    const f=await fixture();await expect(normalizeNewsMedia(Buffer.from("<html>oops</html>"),"image/jpeg")).rejects.toThrow("media_mime_invalid");
    await expect(normalizeNewsMedia(f.source,"image/jpeg")).rejects.toThrow("media_mime_invalid");
    await expect(normalizeNewsMedia(f.source.subarray(0,80),"image/png")).rejects.toThrow("media_decode_failed");
  });
  it("rejects byte, pixel and minimum-dimension violations before admitting an asset",async()=>{
    await expect(normalizeNewsMedia(Buffer.alloc(8*1024*1024+1),"image/jpeg")).rejects.toThrow("media_source_size_invalid");
    const small=await sharp({create:{width:20,height:20,channels:3,background:"white"}}).png().toBuffer();
    await expect(normalizeNewsMedia(small,"image/png")).rejects.toThrow("media_dimensions_invalid");
    const huge=await sharp({create:{width:5000,height:5000,channels:3,background:"white"}}).png().toBuffer();
    await expect(normalizeNewsMedia(huge,"image/png")).rejects.toThrow("media_decode_failed");
  });
  it("does not infer Telegram permission from VK or public availability; rejects stale/revoked/restricted rights",async()=>{
    const {asset}=await fixture();expect(checkedNewsMediaAsset(asset,telegram,item.id,now)).toBe(asset);
    for(const changed of [{permissions:asset.permissions.filter(p=>p.platform==="vk")},{status:"revoked"},{license:"CC-BY-NC-4.0"},
      {checkedAt:"2026-08-01T00:00:00Z"},{validUntil:now.toISOString()},{transformations:{...asset.transformations,crop:true}},
      {newsIds:`prefix-${item.id}-suffix`}])
      expect(()=>checkedNewsMediaAsset({...asset,...changed},telegram,item.id,now)).toThrow();
  });
  it("downloads only allowlisted exact bytes and rejects redirects/error/oversize responses",async()=>{
    const f=await fixture(),fetchImpl=vi.fn(async()=>new Response(f.source,{headers:{"Content-Type":"image/png"}}));
    expect((await downloadNewsMediaAsset(f.asset,{registry:f.mediaOptions.registry,fetchImpl})).descriptor.sha256).toBe(f.descriptor.sha256);
    await expect(downloadNewsMediaAsset({...f.asset,sourceUrl:"https://other.example/photo"},{registry:f.mediaOptions.registry,fetchImpl})).rejects.toThrow("media_source_not_allowlisted");
    await expect(downloadNewsMediaAsset(f.asset,{registry:{downloadHosts:"other.publisher.example"},fetchImpl})).rejects.toThrow("media_source_not_allowlisted");
    await expect(downloadNewsMediaAsset({...f.asset,sourceSha256:"f".repeat(64)},{registry:f.mediaOptions.registry,fetchImpl})).rejects.toThrow("media_source_bytes_changed");
    await expect(downloadNewsMediaAsset(f.asset,{registry:f.mediaOptions.registry,fetchImpl:async()=>new Response(null,{status:302})})).rejects.toThrow("media_source_unavailable");
  });
  it("preserves exact caption/UTF16 bold; long mandatory credit falls back to one complete text",async()=>{
    const f=await prepared();expect(f.prepared.payload.caption_entities[0].length).toBe(item.title.ru.length);expect(f.prepared.payload.caption).toContain(f.asset.credit);
    f.asset.credit="Автор "+"длинная атрибуция ".repeat(65);
    const overflow=await prepareNewsPost(item,snapshot,"telegram",{destination:telegram,mediaOptions:f.mediaOptions});
    expect(overflow.media).toBeNull();expect(overflow.fallbackReason).toBe("required_credit_or_caption_exceeds_limit");
    expect(overflow.payload.text).toContain(item.summary.ru);expect(overflow.payload.text).toContain(item.source.url);
  });
  it("keeps full facts with native source/brand links when verbose URLs would overflow a photo caption",async()=>{
    const f=await fixture();
    const news={...item,title:{...item.title,ru:"📚 Книга: полное название"},summary:{...item.summary,ru:"Проверенное предложение. ".repeat(15).trim()},
      source:{...item.source,url:"https://publisher.example/news/"+"long-path-".repeat(60)}};
    const p=await prepareNewsPost(news,snapshot,"telegram",{destination:telegram,mediaOptions:f.mediaOptions});
    expect(p.media).not.toBeNull();expect(p.payload.caption.length).toBeLessThanOrEqual(1024);
    expect(p.payload.caption).toContain(news.title.ru);expect(p.payload.caption).toContain(news.summary.ru);
    expect(p.payload.caption).toContain(f.asset.credit);expect(p.payload.show_caption_above_media).toBe(false);
    const links=p.payload.caption_entities.filter(e=>e.type==="text_link");
    expect(links.map(e=>e.url)).toEqual([news.source.url,"https://probpera.ru/#literary-news"]);
    expect(p.payload.caption.slice(links[0].offset,links[0].offset+links[0].length)).toBe(news.source.name);
    expect(p.payload.caption_entities[0].length).toBe(news.title.ru.length);
    await validatePreparedNewsMedia(p,telegram,f.mediaOptions);
  });
  it("validates the latest rights and exact cached bytes again at delivery",async()=>{
    const f=await prepared();f.asset.status="revoked";await expect(validatePreparedNewsMedia(f.prepared,telegram,f.mediaOptions)).rejects.toThrow();
    f.asset.status="approved";await expect(validatePreparedNewsMedia(f.prepared,telegram,{...f.mediaOptions,readBytes:async()=>Buffer.from("changed")})).rejects.toThrow("media_cache_bytes_changed");
    expect((await selectNewsMedia(item.id,telegram,{...f.mediaOptions,readBytes:async()=>{throw Error("missing");}})).reason).toBe("media_cache_unavailable");
  });
  it("CC BY includes the creator, license URL and modification notice in the actual native caption",async()=>{
    const f=await fixture();f.asset.license="CC-BY-4.0";f.asset.author="Exact Creator";f.asset.credit="Архивное изображение.";
    const p=await prepareNewsPost(item,snapshot,"telegram",{destination:telegram,mediaOptions:f.mediaOptions});
    expect(p.payload.caption).toContain("Exact Creator");expect(p.payload.caption).toContain("https://creativecommons.org/licenses/by/4.0/");
    expect(p.payload.caption).toContain("без кадрирования");await validatePreparedNewsMedia(p,telegram,f.mediaOptions);
  });
});

describe("native photo delivery without duplicate creates",()=>{
  it("uses one multipart sendPhoto with exact prepared bytes then edits the same message",async()=>{
    const f=await prepared(),calls=[];
    const fetchImpl=vi.fn(async(url,options)=>{calls.push(url.split("/").at(-1));expect(options.body).toBeInstanceOf(FormData);
      expect(Buffer.from(await options.body.get("news_photo").arrayBuffer())).toEqual(f.bytes);
      const caption=options.body.get("caption")||JSON.parse(options.body.get("media")).caption;expect(caption).toBe(f.prepared.payload.caption);
      expect(options.body.has("media")?JSON.parse(options.body.get("media")).show_caption_above_media:options.body.get("show_caption_above_media")).toBe(options.body.has("media")?false:"false");
      return Response.json({ok:true,result:{message_id:17,chat:{id:-100123},photo:[{file_id:"fixture-photo"}]}});});
    const transport=createNewsSocialTransport({mode:"live",telegramToken:"fixture",fetchImpl,mediaOptions:f.mediaOptions});
    const {delivery}=await transport.prepareDelivery({destination:telegram,prepared:f.prepared,providerAccountId:"42"});
    expect((await transport.send({destination:telegram,prepared:f.prepared,remoteId:null,delivery})).kind).toBe("accepted");
    expect((await transport.send({destination:telegram,prepared:f.prepared,remoteId:"17",remoteMediaKind:"photo",delivery})).remoteId).toBe("17");
    expect(calls).toEqual(["sendPhoto","editMessageMedia"]);
  });
  it("uploads a VK photo before wall.post, binds owner and never sends its token to the upload host",async()=>{
    const f=await prepared(vk),calls=[];
    const fetchImpl=vi.fn(async(url,options)=>{const method=url.split("/").at(-1);calls.push(method);const data=Object.fromEntries(new URLSearchParams(options.body));
      if(method==="photos.getWallUploadServer")return Response.json({response:{upload_url:"https://pu.vk.com/c123/upload.php"}});
      if(method==="photos.saveWallPhoto")return Response.json({response:[{owner_id:-456,id:7}]});
      expect(data.attachments).toBe("photo-456_7");expect(data.message).toBe(f.prepared.payload.message);return Response.json({response:{post_id:17}});});
    const uploadImpl=vi.fn(async(url,form)=>{calls.push("upload");expect(form.has("access_token")).toBe(false);expect(Buffer.from(await form.get("photo").arrayBuffer())).toEqual(f.bytes);
      return Response.json({server:1,photo:"fixture",hash:"safe-hash"});});
    const transport=createNewsSocialTransport({mode:"live",vkToken:"fixture",fetchImpl,uploadImpl,mediaOptions:f.mediaOptions});
    const {delivery}=await transport.prepareDelivery({destination:vk,prepared:f.prepared,providerAccountId:"42"});
    expect((await transport.send({destination:vk,prepared:f.prepared,remoteId:null,delivery})).kind).toBe("accepted");
    expect((await transport.send({destination:vk,prepared:f.prepared,remoteId:"17",delivery})).kind).toBe("accepted");
    expect(calls).toEqual(["photos.getWallUploadServer","upload","photos.saveWallPhoto","wall.post","wall.edit"]);
  });
  it("shadow and sendable:false fixtures perform zero uploads or platform calls",async()=>{
    const f=await prepared(),fetchImpl=vi.fn(),uploadImpl=vi.fn();
    for(const mode of ["shadow","live"]){const transport=createNewsSocialTransport({mode,fetchImpl,uploadImpl,mediaOptions:f.mediaOptions});
      const preview={...f.prepared,sendable:false};expect((await transport.prepareDelivery({destination:telegram,prepared:preview})).kind).toBe("blocked");
      expect((await transport.send({destination:telegram,prepared:preview,remoteId:null})).kind).toBe("blocked");}
    expect(fetchImpl).not.toHaveBeenCalled();expect(uploadImpl).not.toHaveBeenCalled();
  });
  it("a photo response lost in transit stays ambiguous with no text resend",async()=>{
    const f=await setup(),fetchImpl=vi.fn(async()=>{throw Error("network_lost");});
    const native=createNewsSocialTransport({mode:"live",telegramToken:"fixture",fetchImpl,mediaOptions:f.mediaOptions});
    const transport={...native,preflight:async()=>({ok:true,providerAccountId:"42"})};
    expect((await dispatchNewsJob({store:f.store,key:f.key,transport,now:()=>now})).status).toBe("ambiguous");
    await dispatchNewsJob({store:f.store,key:f.key,transport,now:()=>new Date(now.getTime()+3600000)});
    expect(fetchImpl).toHaveBeenCalledTimes(1);expect(fetchImpl.mock.calls[0][0]).toContain("/sendPhoto");
  });
  it("pause or withdrawal during upload prevents the later create under a fresh fence",async()=>{
    for(const action of ["pause","withdrawal"]){const f=await setup(vk),send=vi.fn(),preflight=vi.fn(async()=>({ok:true}));
      const prepareDelivery=async()=>{if(action==="pause")await f.store.seed("destination:vk:-456",{mode:"on",paused:true,historyReconciled:true});
        else await reconcileNewsSnapshot(f.store,await feed([],[{id:item.id,withdrawnAt:now.toISOString(),reason:"Correction"}]),[vk],now,{mediaOptions:f.mediaOptions});
        return {kind:"ready",delivery:{sha256:f.descriptor.sha256,attachment:"photo-456_7"}};};
      expect((await dispatchNewsJob({store:f.store,key:f.key,transport:{preflight,prepareDelivery,send},now:()=>now})).status).toBe("pending");
      expect(send).not.toHaveBeenCalled();expect(preflight).toHaveBeenCalledTimes(2);expect((await f.store.read(f.key)).state.dispatchStartedAt).toBeUndefined();}
  });
  it("an image-only revision retains post identity and schedules an edit; removal blocks unsupported Telegram edit",async()=>{
    const f=await setup();const old=(await f.store.read(f.key)).state;
    await f.store.seed(f.key,{...old,status:"sent_current",remoteId:"17",remoteMediaKind:"photo"});
    f.asset.credit="Corrected credit";await reconcileNewsSnapshot(f.store,await feed(),[telegram],now,{mediaOptions:f.mediaOptions});
    const changed=(await f.store.read(f.key)).state;expect(changed.key).toBe(old.key);expect(changed.desiredRevision).not.toBe(old.desiredRevision);expect(changed.status).toBe("correction_pending");
    f.asset.status="revoked";await reconcileNewsSnapshot(f.store,await feed(),[telegram],now,{mediaOptions:f.mediaOptions});
    const fetchImpl=vi.fn(),native=createNewsSocialTransport({mode:"live",telegramToken:"fixture",fetchImpl,mediaOptions:f.mediaOptions});
    const result=await dispatchNewsJob({store:f.store,key:f.key,transport:{...native,preflight:async()=>({ok:true,providerAccountId:"42"})},now:()=>now});
    expect(result.status).toBe("blocked");expect((await f.store.read(f.key)).state.lastError).toBe("telegram_photo_removal_requires_operator");expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("does not restyle already sent text posts or photo posts on a profile-only change",async()=>{
    const f=await setup();const original=(await f.store.read(f.key)).state;
    const text=await prepareNewsPost(item,snapshot,"telegram");
    await f.store.seed(f.key,{...original,status:"sent_current",remoteId:"17",remoteMediaKind:"text",prepared:text,desiredRevision:text.revision});
    await reconcileNewsSnapshot(f.store,await feed(),[telegram],now,{mediaOptions:f.mediaOptions});
    expect((await f.store.read(f.key)).state.status).toBe("sent_current");expect((await f.store.read(f.key)).state.prepared.media).toBeNull();
    const oldPhoto={...original.prepared,media:{...original.prepared.media,profile:"older-photo-profile"}};
    await f.store.seed(f.key,{...original,status:"sent_current",remoteId:"17",remoteMediaKind:"photo",prepared:oldPhoto});
    await reconcileNewsSnapshot(f.store,await feed(),[telegram],now,{mediaOptions:f.mediaOptions});
    expect((await f.store.read(f.key)).state.status).toBe("sent_current");expect((await f.store.read(f.key)).state.prepared.media.profile).toBe("older-photo-profile");
  });
  it("upload rate limits/auth pause the destination and a concurrently installed cooldown prevents upload",async()=>{
    for(const status of [429,403]){
      const f=await setup(vk),fetchImpl=vi.fn(async()=>new Response("{}",{status,headers:{"Retry-After":"3600"}})),uploadImpl=vi.fn();
      const native=createNewsSocialTransport({mode:"live",vkToken:"fixture",fetchImpl,uploadImpl,mediaOptions:f.mediaOptions});
      await dispatchNewsJob({store:f.store,key:f.key,transport:{...native,preflight:async()=>({ok:true,providerAccountId:"42"})},now:()=>now});
      const control=(await f.store.read("destination:vk:-456")).state;
      if(status===429)expect(control.nextDueAt).toBe("2026-09-26T13:00:00.000Z");else expect(control.paused).toBe(true);
      expect(uploadImpl).not.toHaveBeenCalled();await dispatchNewsJob({store:f.store,key:f.key,transport:native,now:()=>now});expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
    const f=await setup(vk),prepareDelivery=vi.fn();
    const preflight=async()=>{await f.store.seed("destination:vk:-456",{mode:"on",paused:false,historyReconciled:true,nextDueAt:"2026-09-26T13:00:00Z"});return{ok:true};};
    expect((await dispatchNewsJob({store:f.store,key:f.key,transport:{preflight,prepareDelivery},now:()=>now})).reason).toBe("destination_rate_limit");expect(prepareDelivery).not.toHaveBeenCalled();
  });
  it("durably caches a VK upload before pause or wall429 and reuses it after restart",async()=>{
    for(const scenario of ["pause","rate"]){const f=await setup(vk);let wallCalls=0;
      const uploadImpl=vi.fn(async()=>{if(scenario==="pause")await f.store.seed("destination:vk:-456",{mode:"on",paused:true,historyReconciled:true});
        return Response.json({server:1,photo:"fixture",hash:"hash"});});
      const fetchImpl=vi.fn(async(url)=>{const method=url.split("/").at(-1);
        if(method==="photos.getWallUploadServer")return Response.json({response:{upload_url:"https://pu.vk.com/upload.php"}});
        if(method==="photos.saveWallPhoto")return Response.json({response:[{owner_id:-456,id:19}]});
        wallCalls++;return scenario==="rate" && wallCalls===1?new Response("{}",{status:429,headers:{"Retry-After":"60"}}):Response.json({response:{post_id:17}});});
      const create=()=>({...createNewsSocialTransport({mode:"live",vkToken:"fixture",fetchImpl,uploadImpl,mediaOptions:f.mediaOptions}),preflight:async()=>({ok:true,providerAccountId:"42"})});
      expect((await dispatchNewsJob({store:f.store,key:f.key,transport:create(),now:()=>now})).status).toBe("pending");
      const stored=(await f.store.read(f.key)).state;expect(stored.mediaCache).toEqual({platform:"vk",destinationId:"-456",providerAccountId:"42",sha256:f.descriptor.sha256,attachment:"photo-456_19"});
      expect(stored.dispatchStartedAt).toBeFalsy();
      await f.store.seed("destination:vk:-456",{mode:"on",paused:false,historyReconciled:true});
      if(scenario==="rate") expect((await dispatchNewsJob({store:f.store,key:f.key,transport:create(),now:()=>new Date(now.getTime()+61000)})).reason).toBe("destination_pacing");
      expect((await dispatchNewsJob({store:f.store,key:f.key,transport:create(),now:()=>new Date(now.getTime()+(scenario==="rate"?1800000:61000))})).status).toBe("sent_current");
      expect(uploadImpl).toHaveBeenCalledTimes(1);expect(fetchImpl.mock.calls.filter(([url])=>url.endsWith("photos.saveWallPhoto"))).toHaveLength(1);
    }
  });
  it("stores Telegram file_id only after an accepted photo and scopes reuse to bot/destination/hash",async()=>{
    const f=await setup(),fetchImpl=vi.fn(async()=>Response.json({ok:true,result:{message_id:17,chat:{id:-100123},photo:[{file_id:"photo-small"},{file_id:"photo-large"}]}}));
    const create=()=>createNewsSocialTransport({mode:"live",telegramToken:"rotatable-token",fetchImpl,mediaOptions:f.mediaOptions});
    expect((await dispatchNewsJob({store:f.store,key:f.key,transport:{...create(),preflight:async()=>({ok:true,providerAccountId:"42"})},now:()=>now})).status).toBe("sent_current");
    const saved=(await f.store.read(f.key)).state;expect(saved.mediaCache.fileId).toBe("photo-large");
    expect(saved.mediaCache.providerAccountId).toBe("42");
    let result=await create().prepareDelivery({destination:telegram,prepared:saved.prepared,providerAccountId:"42",cachedMedia:saved.mediaCache});
    expect(result.delivery.reused).toBe(true);expect(result.delivery.fileId).toBe("photo-large");expect(result.delivery.bytes).toBeUndefined();
    await create().send({destination:telegram,prepared:saved.prepared,remoteId:"17",remoteMediaKind:"photo",delivery:result.delivery});
    expect(JSON.parse(fetchImpl.mock.calls.at(-1)[1].body).media.media).toBe("photo-large");
    for(const cache of [{...saved.mediaCache,providerAccountId:"99"},{...saved.mediaCache,destinationId:"-100999"},{...saved.mediaCache,sha256:"f".repeat(64)},{...saved.mediaCache,platform:"vk"}]){
      result=await create().prepareDelivery({destination:telegram,prepared:saved.prepared,providerAccountId:"42",cachedMedia:cache});
      expect(result.delivery.fileId).toBeUndefined();expect(result.delivery.bytes).toEqual(f.bytes);
    }
    result=await create().prepareDelivery({destination:telegram,prepared:saved.prepared,providerAccountId:"99",cachedMedia:saved.mediaCache});
    expect(result.delivery.fileId).toBeUndefined();expect(result.delivery.providerAccountId).toBe("99");
    f.asset.status="revoked";
    result=await create().prepareDelivery({destination:telegram,prepared:saved.prepared,providerAccountId:"42",cachedMedia:saved.mediaCache});
    expect(result).toEqual({kind:"blocked",code:"media_rights_or_bytes_invalid"});
  });
});

describe("separate upload DNS boundary",()=>{
  it("pins the checked public DNS answer while preserving upload Host and TLS SNI",async()=>{
    const lookupImpl=vi.fn(async()=>[{address:"1.1.1.1",family:4}]);let observed;
    const requestImpl=vi.fn((url,options,respond)=>{observed=options;const request=new EventEmitter();
      request.end=()=>{options.lookup(url.hostname,{all:true},(error,answers)=>{expect(error).toBeNull();expect(answers).toEqual([{address:"1.1.1.1",family:4}]);});
        const response=new PassThrough();response.statusCode=200;response.headers={};respond(response);response.end('{"server":1}');};return request;});
    const form=new FormData();form.set("photo",new Blob(["fixture"]));
    const response=await createPinnedVkNewsUpload({lookupImpl,requestImpl})("https://pu.vk.com/upload.php",form);
    expect(await response.json()).toEqual({server:1});expect(lookupImpl).toHaveBeenCalledTimes(1);expect(observed.agent).toBe(false);
    expect(observed.headers.Host).toBe("pu.vk.com");expect(observed.servername).toBe("pu.vk.com");expect(observed.rejectUnauthorized).toBe(true);
  });
  it("rejects source hosts/private mixtures and aborts DNS without creating a socket",async()=>{
    for(const url of ["https://publisher.example/upload","https://pu.vk.com.evil.example/upload","http://pu.vk.com/upload","https://pu.vk.com:444/upload"])
      expect(()=>checkedVkNewsUploadUrl(url)).toThrow();
    const requestImpl=vi.fn(),form=new FormData();form.set("photo",new Blob(["fixture"]));
    const upload=createPinnedVkNewsUpload({requestImpl,lookupImpl:async()=>[{address:"1.1.1.1",family:4},{address:"127.0.0.1",family:4}]});
    await expect(upload("https://pu.vk.com/upload.php",form)).rejects.toThrow("vk_upload_address_rejected");expect(requestImpl).not.toHaveBeenCalled();
    const controller=new AbortController(),pending=createPinnedVkNewsUpload({requestImpl,lookupImpl:()=>new Promise(()=>{})})("https://pu.vk.com/upload.php",form,{signal:controller.signal});
    controller.abort();await expect(pending).rejects.toThrow();expect(requestImpl).not.toHaveBeenCalled();
  });
});
