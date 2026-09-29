import { describe,expect,it,vi } from "vitest";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import reviewed from "../../data/news/reviewed.json" with {type:"json"};
import { buildPublishedNewsFeed } from "./literary-news-publication.mjs";
import { pendingNewsSourceState } from "./literary-news-state.mjs";
import { newsPostKey,newsSemanticRevision,newsSocialPayloadDigest,prepareNewsPost } from "./literary-news-social.mjs";
import { NEWS_RELEASE_DESTINATIONS,newsHistoryCandidates,operateNewsRelease,recheckNewsPublicHistory,summarizeNewsDeliveryHistory,verifyTelegramCanaryPublicPost } from "./literary-news-release-operator.mjs";
import { parseNewsReleaseArguments } from "../operate-literary-news-release.mjs";
import { normalizeNewsMedia, mediaByteHash } from "./literary-news-media.mjs";

const now=new Date("2026-09-27T05:00:00Z"),destination=NEWS_RELEASE_DESTINATIONS.telegram;
function memoryStore(){
  const rows=new Map();let sequence=0;
  const store={
    read:vi.fn(async key=>structuredClone(rows.get(key)||{id:null,state:null})),
    compareAppend:vi.fn(async(key,expected,state,guard)=>{
      await store.beforeAppend?.(key,expected,state);
      if(guard){const c=rows.get(guard.key);if(c?.id!==guard.id||c.state.paused||!c.state.historyReconciled)return{applied:false};}
      const prev=rows.get(key)||{id:null};if(prev.id!==expected)return{applied:false,...structuredClone(prev)};
      const row={id:++sequence,state:structuredClone(state)};rows.set(key,row);return{applied:true,...structuredClone(row)};
    }),
    seed:async(key,state)=>{const row={id:++sequence,state:structuredClone(state)};rows.set(key,row);return row;},
    list:vi.fn(async prefix=>[...rows].filter(([key])=>key.startsWith(prefix)).map(([,row])=>structuredClone(row))),
  };return store;
}
async function setup({withEditorialSourceTitle=false}={}){
  const base=withEditorialSourceTitle?reviewed.find(row=>row.id==="gioconda-belli-fil-prize-2026")
    :reviewed.find(row=>row.kind==="news");
  const item={...base,id:withEditorialSourceTitle?base.id:"release-canary-fixture",
    eventKey:withEditorialSourceTitle?base.eventKey:"release-canary-fixture",
    eventDate:"2026-09-26",publishedAt:null,verifiedAt:"2026-09-26T12:00:00Z"};
  const feed=await buildPublishedNewsFeed({records:[item],state:pendingNewsSourceState(),current:now,release:"a".repeat(40)});
  const source=await sharp({create:{width:480,height:640,channels:3,background:"#8f7788"}}).png().toBuffer();
  const normalized=await normalizeNewsMedia(source,"image/png");
  const asset={id:"release-fixture",status:"approved",newsIds:[item.id],sourceUrl:"https://fixture.example/photo.png",sourceSha256:mediaByteHash(source),
    subject:"portrait",entityEvidence:"Synthetic offline operator fixture; not a production image.",author:"Fixture",rightsholder:"Fixture",credit:"Synthetic fixture",
    license:"owned",licenseEvidenceUrl:"https://fixture.example/license",licenseEvidenceSha256:"a".repeat(64),checkMethod:"ownership-record",
    checkedAt:now.toISOString(),validUntil:"2026-10-20T00:00:00Z",transformations:{resize:true,metadataRemoval:true,reencode:true,crop:false},
    permissions:[{platform:destination.platform,destinationId:destination.id,publish:true,providerProcessing:true,evidenceUrl:"https://fixture.example/license"}],
    derivative:normalized.descriptor};
  const mediaOptions={registry:{assets:[asset],downloadHosts:["fixture.example"]},now,readBytes:async()=>normalized.bytes};
  const prepared=await prepareNewsPost(feed.items[0],feed.snapshot,"telegram",{destination,mediaOptions});
  const history={scope:"public_observed_only",reachedPublicStart:true,minId:1,maxId:410,observedCount:363,
    auditSha256:"b".repeat(64),semanticReviewSha256:"c".repeat(64),
    candidates:await newsHistoryCandidates(feed.items),pages:[{url:"https://t.me/s/probbaperra",sha256:"d".repeat(64)}]};
  const approval={platform:"telegram",destinationId:destination.id,status:"approved",reviewedAt:"2026-09-26T22:00:00Z",
    expiresAt:"2026-09-28T00:00:00Z",providerAccountId:"77",history,canaryNewsId:item.id};
  const store=memoryStore(),transport={preflight:vi.fn(async()=>({ok:true,destinationId:destination.id,providerAccountId:"77"})),
    prepareDelivery:vi.fn(async()=>({kind:"ready",delivery:{providerAccountId:"77"}})),
    send:vi.fn(async()=>({kind:"accepted",remoteId:"411",remoteUrl:"https://t.me/c/2791579809/411"}))};
  const options={action:"enable-canary",platform:"telegram",expectedControlId:null,historyDigest:await newsSocialPayloadDigest(history),
    canaryNewsId:item.id,payloadSha256:prepared.payloadSha256,repositorySha:"a".repeat(40),approval,store,feed,transport,
    mediaOptions,now:()=>now,verifyHead:vi.fn(async()=>({maxId:410}))};
  const controlKey=`destination:telegram:${destination.id}`,key=newsPostKey(item.id,destination);
  const enable=async()=>{const result=await operateNewsRelease(options);options.expectedControlId=result.controlId;return result;};
  return{options,store,transport,key,controlKey,enable};
}
describe("bounded Telegram release operator",()=>{
  it("allows a full-text fallback for both destinations while VK remains off",()=>{
    expect(Object.values(NEWS_RELEASE_DESTINATIONS).every(d=>d.requirePhotoForNewPosts===false&&d.mode==="off")).toBe(true);
  });
  it("restores only an omitted editorial source title for history hashing",async()=>{
    const reviewedItem=reviewed.find(row=>typeof row.source.title==="string");expect(reviewedItem).toBeDefined();
    const publicProjection={...reviewedItem,source:{name:reviewedItem.source.name,url:reviewedItem.source.url,
      language:reviewedItem.source.language}};
    expect(await newsHistoryCandidates([publicProjection])).toEqual(await newsHistoryCandidates([reviewedItem]));
    const changedIdentity={...publicProjection,source:{...publicProjection.source,url:"https://changed.example/"}};
    expect(await newsHistoryCandidates([changedIdentity])).not.toEqual(await newsHistoryCandidates([reviewedItem]));
  });
  it("inspect produces an exact nonsendable preview with no durable/platform writes",async()=>{
    const {options,store,transport}=await setup();const result=await operateNewsRelease({...options,action:"inspect",approval:null});
    expect(result.sendable).toBe(false);expect(result.prepared.payloadSha256).toBe(options.payloadSha256);
    expect(store.compareAppend).not.toHaveBeenCalled();expect(transport.send).not.toHaveBeenCalled();
  });
  it("inspect identifies only the durable delivery-history records that block initialization",async()=>{
    const {options,store,transport}=await setup();
    const reviewedCandidate=options.approval.history.candidates[0];
    await store.seed(`post:news:${reviewedCandidate.newsId}:telegram:${destination.id}`,{
      newsId:reviewedCandidate.newsId,destination,prepared:{textRevision:reviewedCandidate.revision},status:"pending"});
    await store.seed(`post:news:orphan:telegram:${destination.id}`,{
      newsId:"orphan",destination,prepared:null,status:"blocked"});
    const result=await operateNewsRelease({...options,action:"inspect"});
    expect(result.deliveryHistory).toMatchObject({jobCount:2,blockerCount:1,truncated:false,
      blockers:[{newsId:"orphan",status:"blocked",reasons:["not_in_reviewed_history","not_in_current_public_feed","missing_text_revision"]}]});
    expect(store.compareAppend).not.toHaveBeenCalled();expect(transport.send).not.toHaveBeenCalled();
  });
  it("uses the public text revision for pending jobs while checking editorial source-title history",async()=>{
    const {options,store,key,enable}=await setup({withEditorialSourceTitle:true});
    const publicRevision=await newsSemanticRevision(options.feed.items[0]);
    expect(options.feed.items[0].source.title).toBeUndefined();
    expect(options.approval.history.candidates[0].revision).not.toBe(publicRevision);
    await store.seed(key,{key,newsId:options.canaryNewsId,destination,prepared:{textRevision:publicRevision},status:"pending"});
    const inspection=await operateNewsRelease({...options,action:"inspect"});
    expect(inspection.deliveryHistory).toMatchObject({jobCount:1,blockerCount:0});
    await enable();
    await operateNewsRelease({...options,action:"send-canary"});
    const job=(await store.read(key)).state;
    options.nativeObservation={viewed:true,remoteId:job.remoteId,url:`https://t.me/probbaperra/${job.remoteId}`};
    options.verifyNative=vi.fn(async()=>({remoteId:job.remoteId,photoObserved:true,checkedAt:now.toISOString()}));
    expect((await operateNewsRelease({...options,action:"promote"})).mode).toBe("on");
  });
  it("keeps a pending job with a genuinely changed public text revision blocked",async()=>{
    const {options,store,key,transport}=await setup({withEditorialSourceTitle:true});
    const prepared=await prepareNewsPost(options.feed.items[0],options.feed.snapshot,"telegram",
      {destination,mediaOptions:options.mediaOptions});
    await store.seed(key,{key,newsId:options.canaryNewsId,destination,desiredRevision:prepared.revision,
      prepared:{...prepared,textRevision:"e".repeat(64)},status:"pending"});
    const inspection=await operateNewsRelease({...options,action:"inspect"});
    expect(inspection.deliveryHistory.blockers[0].reasons).toContain("text_revision_mismatch");
    await expect(operateNewsRelease(options)).rejects.toThrow("existing_delivery_history_requires_review");
    expect(transport.send).not.toHaveBeenCalled();
  });
  it.each(["approval","digest","candidate","expiry","head","rights"])("blocks %s failure before initialization",async kind=>{
    const {options,store,transport}=await setup();
    if(kind==="approval")options.approval.status="held";
    if(kind==="digest")options.historyDigest="e".repeat(64);
    if(kind==="candidate"){options.approval.history.candidates[0].revision="e".repeat(64);options.historyDigest=await newsSocialPayloadDigest(options.approval.history);}
    if(kind==="expiry")options.approval.expiresAt="2026-09-26T23:00:00Z";
    if(kind==="head")options.verifyHead.mockRejectedValue(new Error("history_head_changed"));
    if(kind==="rights")transport.preflight.mockResolvedValue({ok:false});
    await expect(operateNewsRelease(options)).rejects.toThrow();expect(store.compareAppend).not.toHaveBeenCalled();expect(transport.send).not.toHaveBeenCalled();
  });
  it("a racing control initializer cannot be overwritten after admissions are captured",async()=>{
    const {options,store,controlKey,transport}=await setup();
    store.beforeAppend=async key=>{if(key===controlKey){store.beforeAppend=null;await store.seed(key,{mode:"off",paused:true,historyReconciled:false});}};
    await expect(operateNewsRelease(options)).rejects.toThrow("control_version_changed");
    expect((await store.read(controlKey)).state.paused).toBe(true);expect(transport.send).not.toHaveBeenCalled();
  });
  it("canary send preserves pause and sends an accepted identity only once across JSON reloads",async()=>{
    const {options,store,controlKey,key,enable,transport}=await setup();await enable();
    const initial=(await store.read(controlKey)).state;
    const paused=await store.seed(controlKey,{...initial,paused:true});options.expectedControlId=paused.id;
    await expect(operateNewsRelease({...options,action:"send-canary"})).rejects.toThrow("canary_control_changed");
    expect(transport.send).not.toHaveBeenCalled();
    const resumed=await store.seed(controlKey,initial);options.expectedControlId=resumed.id;
    const first=await operateNewsRelease({...options,action:"send-canary"});expect(first,JSON.stringify(first)).toMatchObject({delivered:1,status:"sent_current"});
    await store.seed(key,JSON.parse(JSON.stringify((await store.read(key)).state)));
    const second=await operateNewsRelease({...options,action:"send-canary"});
    expect(second.alreadyAcknowledged).toBe(true);expect(second.delivered).toBe(0);expect(transport.send).toHaveBeenCalledTimes(1);
  });
  it("rejects stale control versions, changed payloads and deferred VK mutation",async()=>{
    const {options,enable,transport}=await setup();await enable();
    await expect(operateNewsRelease({...options,action:"send-canary",expectedControlId:0})).rejects.toThrow("control_version_changed");
    await expect(operateNewsRelease({...options,action:"send-canary",payloadSha256:"f".repeat(64)})).rejects.toThrow("canary_payload_changed");
    await expect(operateNewsRelease({...options,platform:"vk"})).rejects.toThrow("vk_release_deferred");
    expect(transport.send).not.toHaveBeenCalled();
  });
  it("requires a current accepted canary plus exact reviewed native proof before promotion",async()=>{
    const {options,store,key,enable,controlKey}=await setup();await enable();
    await expect(operateNewsRelease({...options,action:"promote"})).rejects.toThrow("canary_receipt_missing");
    await operateNewsRelease({...options,action:"send-canary"});
    await expect(operateNewsRelease({...options,action:"promote"})).rejects.toThrow("native_canary_review_missing");
    const job=(await store.read(key)).state;
    options.nativeObservation={viewed:true,remoteId:job.remoteId,url:`https://t.me/probbaperra/${job.remoteId}`};
    options.verifyNative=vi.fn(async()=>({remoteId:job.remoteId,photoObserved:true,checkedAt:now.toISOString()}));
    const result=await operateNewsRelease({...options,action:"promote"});expect(result.mode).toBe("on");
    expect(options.verifyHead).toHaveBeenLastCalledWith(expect.objectContaining({allowedRemoteId:"411"}));
    expect((await store.read(controlKey)).state.canaryAccepted.remoteId).toBe("411");
  });
  it("promotion cannot bypass an unavailable public canary proof",async()=>{
    const {options,enable,store,controlKey}=await setup();await enable();await operateNewsRelease({...options,action:"send-canary"});
    options.nativeObservation={viewed:true,remoteId:"411",url:"https://t.me/probbaperra/411"};
    options.verifyNative=vi.fn(async()=>{throw new Error("native_canary_post_missing");});
    await expect(operateNewsRelease({...options,action:"promote"})).rejects.toThrow("native_canary_post_missing");
    expect((await store.read(controlKey)).state.mode).toBe("canary");
  });
  it("a new revision racing the final send gate cannot publish an unapproved payload",async()=>{
    const {options,store,key,enable,transport}=await setup();await enable();
    options.verifyHead=async()=>{const prior=(await store.read(key)).state;
      await store.seed(key,{...prior,desiredRevision:"f".repeat(64),prepared:{...prior.prepared,revision:"f".repeat(64)}});};
    await operateNewsRelease({...options,action:"send-canary"});expect(transport.send).not.toHaveBeenCalled();
  });
  it("an unreviewed orphan expectation prevents activation even when it has no prepared revision",async()=>{
    const {options,store,transport}=await setup();
    await store.seed("post:news:orphan:telegram:-1002791579809",{newsId:"orphan",destination,prepared:null,status:"blocked"});
    await expect(operateNewsRelease(options)).rejects.toThrow("existing_delivery_history_requires_review");
    expect(transport.send).not.toHaveBeenCalled();
  });
  it("a pause racing the final transport rights check never sends",async()=>{
    const {options,store,enable,transport,controlKey}=await setup();await enable();
    let calls=0;
    transport.preflight.mockImplementation(async()=>{if(++calls===2){const row=await store.read(controlKey);await store.seed(controlKey,{...row.state,paused:true});}
      return {ok:true,destinationId:destination.id,providerAccountId:"77"};});
    await operateNewsRelease({...options,action:"send-canary"});
    expect(transport.send).not.toHaveBeenCalled();expect((await store.read(controlKey)).state.paused).toBe(true);
  });
  it("public head detects intervening posts and accepts only the recorded canary afterward",async()=>{
    const response=ids=>new Response(ids.map(id=>`<div class="tgme_widget_message" data-post="probbaperra/${id}"></div>`).join(""));
    const base={destination,history:{maxId:410},fetchImpl:vi.fn(async()=>response([409,410]))};
    expect((await recheckNewsPublicHistory(base)).maxId).toBe(410);
    await expect(recheckNewsPublicHistory({...base,fetchImpl:async()=>response([410,411])})).rejects.toThrow("history_head_changed");
    expect((await recheckNewsPublicHistory({...base,allowedRemoteId:"411",fetchImpl:async()=>response([410,411])})).maxId).toBe(411);
    await expect(recheckNewsPublicHistory({...base,allowedRemoteId:"412",fetchImpl:async()=>response([410,411,412])})).rejects.toThrow("history_head_changed");
    await expect(recheckNewsPublicHistory({...base,fetchImpl:async()=>new Response("<html>no posts</html>")})).rejects.toThrow("history_head_invalid");
  });
  it("CLI and workflow keep destination fixed, manual, main-only and serialized with delivery",()=>{
    expect(()=>parseNewsReleaseArguments(["--platform","attacker"])).toThrow();
    expect(()=>parseNewsReleaseArguments(["--destination-id","-999"])).toThrow();
    const workflow=parse(readFileSync(".github/workflows/operate-literary-news-release.yml","utf8"));
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.on.workflow_dispatch.inputs.action.default).toBe("inspect");
    expect(workflow.concurrency.group).toBe("literary-agenda-delivery");
    const job=workflow.jobs["telegram-operator"];expect(job.if).toBe("github.ref == 'refs/heads/main'");
    const action=job.steps.find(step=>step.run?.includes("operate-literary-news-release.mjs"));
    expect(action.run).toContain("/commits/main");expect(action.run).toContain("--platform telegram");
    expect(action.env).not.toHaveProperty("VK_ACCESS_TOKEN");
    expect(Object.keys(workflow.on.workflow_dispatch.inputs)).toHaveLength(10);
  });
  it("verifies exact text-only canaries and requires an image only when one was prepared",async()=>{
    const prepared={media:{sha256:"a".repeat(64)},payload:{caption:"Title\n\nFull factual caption. https://probpera.ru/"}};
    const page=photo=>`<div class="tgme_widget_message" data-post="probbaperra/411"><div class="tgme_widget_message_text"><b>Title</b><br><br>Full factual caption. <a>https://probpera.ru/</a></div>${photo?'<a class="tgme_widget_message_photo_wrap"></a>':""}</div>`;
    const fetchImpl=vi.fn(async()=>new Response(page(true)));
    const result=await verifyTelegramCanaryPublicPost({remoteId:"411",prepared,fetchImpl});expect(result.photoObserved).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);expect(fetchImpl.mock.calls[0][0]).toBe("https://t.me/s/probbaperra/411");
    const textOnly={media:null,payload:{text:"Title\n\nFull factual caption. https://probpera.ru/"}};
    const textResult=await verifyTelegramCanaryPublicPost({remoteId:"411",prepared:textOnly,fetchImpl:async()=>new Response(page(false))});
    expect(textResult.photoObserved).toBe(false);
    await expect(verifyTelegramCanaryPublicPost({remoteId:"411",prepared,fetchImpl:async()=>new Response(page(false))})).rejects.toThrow("native_canary_photo_missing");
    await expect(verifyTelegramCanaryPublicPost({remoteId:"411",prepared:{...prepared,payload:{caption:"Changed"}},fetchImpl})).rejects.toThrow("native_canary_text_mismatch");
    await expect(verifyTelegramCanaryPublicPost({remoteId:"412",prepared,fetchImpl})).rejects.toThrow("native_canary_post_missing");
    await expect(verifyTelegramCanaryPublicPost({remoteId:"411",prepared,fetchImpl:async()=>new Response("unavailable",{status:403})})).rejects.toThrow("history_recheck_unavailable");
  });
  it.each(["https://attacker.invalid/", "../411", "0", "9007199254740992"])("rejects unsafe remote ID %s before fetch",async remoteId=>{
    const fetchImpl=vi.fn();await expect(verifyTelegramCanaryPublicPost({remoteId,prepared:{},fetchImpl})).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
