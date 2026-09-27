import { load } from "cheerio";
import { dispatchNewsJob, newsPostKey, newsSemanticRevision, newsSocialPayloadDigest,
  prepareNewsPost, reconcileNewsSnapshot } from "./literary-news-social.mjs";
import { verifyPublishedNewsSnapshot } from "./literary-news-publication.mjs";
import reviewed from "../../data/news/reviewed.json" with {type:"json"};

export const NEWS_RELEASE_DESTINATIONS = Object.freeze({
  telegram: Object.freeze({ platform: "telegram", id: "-1002791579809", mode: "off", requirePhotoForNewPosts: false }),
  vk: Object.freeze({ platform: "vk", id: "-231377018", mode: "off", requirePhotoForNewPosts: false }),
});
export const NEWS_RELEASE_ACTIONS = Object.freeze(["inspect", "enable-canary", "send-canary", "pause", "promote"]);
const sha = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const positiveId = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value)>0;
const requireCondition = (condition, reason) => { if (!condition) throw new Error(reason); };

export async function newsHistoryCandidates(items) {
  return Promise.all([...items].sort((a,b)=>a.id.localeCompare(b.id))
    .map(async item=>{
      // The public feed deliberately omits the editorial-only source.title
      // annotation. Restore it only for the reviewed revision hash, and only
      // when the published source identity is otherwise byte-for-byte exact.
      // The outgoing post always uses the public item; no text is changed.
      const reviewedSource=reviewed.find(row=>row.id===item.id)?.source;
      const samePublicSourceIdentity=reviewedSource && ["name","url","language"]
        .every(key=>reviewedSource[key]===item.source?.[key]);
      const candidate=samePublicSourceIdentity && item.source?.title===undefined
        && typeof reviewedSource.title==="string"
        ? {...item,source:{...item.source,title:reviewedSource.title}} : item;
      return {newsId:item.id,revision:await newsSemanticRevision(candidate)};
    }));
}
async function publicNewsRevisions(items) {
  return new Map(await Promise.all(items.map(async item=>[item.id,await newsSemanticRevision(item)])));
}
export async function verifyNewsHistoryApproval(approval, destination, items, expectedDigest, now=new Date()) {
  requireCondition(approval?.status==="approved" && approval.platform===destination.platform
    && approval.destinationId===destination.id, "history_approval_missing");
  requireCondition(Number.isFinite(Date.parse(approval.reviewedAt)) && Date.parse(approval.reviewedAt)<=now.getTime()
    && Number.isFinite(Date.parse(approval.expiresAt)) && Date.parse(approval.expiresAt)>now.getTime()
    && Date.parse(approval.expiresAt)-Date.parse(approval.reviewedAt)<=7*86400000, "history_approval_expired");
  requireCondition(positiveId(approval.providerAccountId), "approved_provider_identity_missing");
  const history=approval.history;
  requireCondition(history?.scope==="public_observed_only" && history.reachedPublicStart===true
    && positiveId(history.minId) && positiveId(history.maxId) && history.minId<=history.maxId
    && Number.isSafeInteger(history.observedCount) && history.observedCount>0
    && sha(history.auditSha256) && sha(history.semanticReviewSha256)
    && Array.isArray(history.pages) && history.pages.length>0 && history.pages.length<=1000
    && history.pages.every(page=>sha(page.sha256) && typeof page.url==="string" && page.url.startsWith("https://"))
    && Array.isArray(history.candidates) && history.candidates.length>0 && history.candidates.length<=5000,
  "history_evidence_invalid");
  const candidates=new Map();
  for(const row of history.candidates) {
    requireCondition(typeof row.newsId==="string" && row.newsId.length>0 && row.newsId.length<=120
      && sha(row.revision) && !candidates.has(row.newsId), "history_candidate_invalid");
    candidates.set(row.newsId,row.revision);
  }
  requireCondition(sha(expectedDigest) && await newsSocialPayloadDigest(history)===expectedDigest, "history_digest_mismatch");
  for(const row of await newsHistoryCandidates(items)) requireCondition(candidates.get(row.newsId)===row.revision,"history_candidate_changed");
  return candidates;
}

export function summarizeNewsDeliveryHistory(rows, candidates, publicRevisions, destination) {
  const reviewedCandidates=new Map((Array.isArray(candidates)?candidates:[])
    .filter(row=>typeof row?.newsId==="string"&&sha(row.revision)).map(row=>[row.newsId,row.revision]));
  const jobs=rows.map(row=>row?.state).filter(job=>job?.destination?.platform===destination.platform
    &&job.destination.id===destination.id);
  const blockers=jobs.flatMap(job=>{
    const reasons=[];
    if(!reviewedCandidates.has(job.newsId))reasons.push("not_in_reviewed_history");
    if(!publicRevisions.has(job.newsId))reasons.push("not_in_current_public_feed");
    if(!sha(job.prepared?.textRevision))reasons.push("missing_text_revision");
    else if(publicRevisions.has(job.newsId) && publicRevisions.get(job.newsId)!==job.prepared.textRevision)
      reasons.push("text_revision_mismatch");
    if(job.remoteId)reasons.push("has_remote_id");
    if(job.dispatchStartedAt)reasons.push("dispatch_started");
    if(["ambiguous","inflight"].includes(job.status))reasons.push("ambiguous_or_inflight");
    return reasons.length?[{newsId:typeof job.newsId==="string"?job.newsId:null,status:job.status||null,reasons}]:[];
  });
  return {jobCount:jobs.length,blockerCount:blockers.length,blockers:blockers.slice(0,25),truncated:blockers.length>25};
}

async function boundedText(response) {
  requireCondition(response.ok && response.body,"history_recheck_unavailable");
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  try {
    while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;
      requireCondition(bytes<=2*1024*1024,"history_recheck_too_large");chunks.push(Buffer.from(value));}
    return Buffer.concat(chunks).toString("utf8");
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
/** Recheck fixed public heads; neither credentials nor arbitrary URLs enter evidence. */
export async function recheckNewsPublicHistory({destination,history,allowedRemoteId=null,fetchImpl=fetch,vkToken}) {
  requireCondition(NEWS_RELEASE_DESTINATIONS[destination?.platform]?.id===destination.id,"release_destination_invalid");
  let ids;
  if(destination.platform==="telegram") {
    const body=await boundedText(await fetchImpl("https://t.me/s/probbaperra",{redirect:"error",cache:"no-store",
      signal:AbortSignal.timeout(20000),headers:{Accept:"text/html"}}));
    const $=load(body);
    ids=$(".tgme_widget_message[data-post]").toArray().map(el=>$(el).attr("data-post"))
      .filter(value=>/^probbaperra\/[1-9]\d*$/.test(value||"")).map(value=>Number(value.split("/")[1]));
  }else {
    requireCondition(typeof vkToken==="string" && vkToken.length>0,"vk_history_token_missing");
    const response=await fetchImpl("https://api.vk.com/method/wall.get",{method:"POST",redirect:"error",
      signal:AbortSignal.timeout(20000),headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({owner_id:destination.id,count:"100",filter:"owner",access_token:vkToken,v:"5.199"})});
    const data=JSON.parse(await boundedText(response));
    requireCondition(!data.error && Array.isArray(data.response?.items) && data.response.items.length<=100,"vk_history_recheck_unavailable");
    requireCondition(data.response.items.every(item=>String(item.owner_id)===destination.id),"history_destination_mismatch");
    ids=data.response.items.map(item=>item.id);
  }
  requireCondition(ids.length>0 && ids.every(positiveId),"history_head_invalid");
  ids=[...new Set(ids)].sort((a,b)=>a-b);
  const expectedMax=allowedRemoteId ? Math.max(history.maxId,Number(allowedRemoteId)) : history.maxId;
  requireCondition(Math.max(...ids)===expectedMax
    && ids.filter(id=>id>history.maxId).every(id=>String(id)===String(allowedRemoteId)),"history_head_changed");
  return {scope:"public_head_only",maxId:expectedMax,observedIds:ids,checkedAt:new Date().toISOString()};
}

export async function verifyTelegramCanaryPublicPost({remoteId,prepared,fetchImpl=fetch}) {
  requireCondition(positiveId(remoteId),"native_canary_id_invalid");
  const target=new URL(`https://t.me/s/probbaperra/${remoteId}`);
  if(target.origin!=="https://t.me" || !/^\/s\/probbaperra\/[1-9]\d*$/.test(target.pathname)
    || target.search || target.hash || target.username || target.password) throw new Error("native_canary_url_invalid");
  const $=load(await boundedText(await fetchImpl(target.href,{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)})));
  const post=$(".tgme_widget_message[data-post]").filter((_,el)=>$(el).attr("data-post")===`probbaperra/${remoteId}`);
  requireCondition(post.length===1,"native_canary_post_missing");
  const body=post.find(".tgme_widget_message_text").first().clone();body.find("br").replaceWith("\n");
  const normalized=value=>String(value||"").normalize("NFC").replace(/\s+/gu," ").trim();
  requireCondition(normalized(body.text())===normalized(prepared.payload.caption||prepared.payload.text),"native_canary_text_mismatch");
  const photoObserved=post.find(".tgme_widget_message_photo_wrap").length>0;
  requireCondition(!prepared.media || photoObserved,"native_canary_photo_missing");
  return {remoteId:String(remoteId),url:target.href,photoObserved,textSha256:await newsSocialPayloadDigest(normalized(body.text())),checkedAt:new Date().toISOString()};
}

/** One operator action, one fixed destination. Sending retains the existing CAS/rights/pause path. */
export async function operateNewsRelease({action,platform,expectedControlId=null,historyDigest,canaryNewsId,payloadSha256,
  repositorySha,approval,store,feed,transport,now=()=>new Date(),verifyHead=recheckNewsPublicHistory,mediaOptions,
  nativeObservation,verifyNative=verifyTelegramCanaryPublicPost,operatorContext={}}) {
  requireCondition(NEWS_RELEASE_ACTIONS.includes(action) && NEWS_RELEASE_DESTINATIONS[platform],"release_action_invalid");
  // VK setup is explicitly deferred; retained identity is not activation authority.
  requireCondition(platform==="telegram" || action==="inspect","vk_release_deferred");
  requireCondition(/^[a-f0-9]{40}$/.test(repositorySha||""),"release_repository_sha_invalid");
  const destination=NEWS_RELEASE_DESTINATIONS[platform],controlKey=`destination:${platform}:${destination.id}`;
  let control=await store.read(controlKey);
  if(action!=="inspect") requireCondition(String(control.id??0)===String(expectedControlId??0),"control_version_changed");
  const commit=async state=>{const result=await store.compareAppend(controlKey,control.id,state);
    requireCondition(result.applied,"control_version_changed");control=result;return result;};
  if(action==="pause") {
    requireCondition(control.state,"destination_not_initialized");
    await commit({...control.state,paused:true,pauseReason:"release_operator_pause",operator:{action,repositorySha,at:now().toISOString()}});
    return {action,platform,controlId:control.id,paused:true,delivered:0};
  }
  await verifyPublishedNewsSnapshot(feed);
  requireCondition(feed.timeZone==="Europe/Moscow" && !feed.fallbackCapturedAt
    && Math.abs(now().getTime()-Date.parse(feed.generatedAt))<=300000,"public_snapshot_not_current");
  const item=feed.items.find(row=>row.id===canaryNewsId);
  requireCondition(item,"canary_not_public");
  // The durable post uses the public serializer, not the editorial source-title projection.
  const publicRevisions=await publicNewsRevisions(feed.items);
  const prepared=await prepareNewsPost(item,feed.snapshot,platform,{destination,mediaOptions:{...mediaOptions,now:now()}});
  const proposedControl={mode:"canary",canaryNewsId,vkProfile:{apiVersion:"5.199",canaryAuthorized:true}};
  if(action==="inspect") {
    const rights=await transport.preflight(destination,{control:proposedControl,requiresMedia:Boolean(prepared.media)});
    const deliveryHistory=summarizeNewsDeliveryHistory(await store.list("post:"),approval?.history?.candidates,publicRevisions,destination);
    return {action,sendable:false,platform,destinationId:destination.id,controlId:control.id,control:control.state,
      historyDigest:approval?.history?await newsSocialPayloadDigest(approval.history):null,
      candidateFingerprint:await newsSocialPayloadDigest(await newsHistoryCandidates(feed.items)),deliveryHistory,
      prepared:{...prepared,sendable:false},rights,delivered:0};
  }
  requireCondition(approval?.canaryNewsId===canaryNewsId,"canary_not_approved");
  const candidates=await verifyNewsHistoryApproval(approval,destination,feed.items,historyDigest,now());
  requireCondition(sha(payloadSha256) && prepared.payloadSha256===payloadSha256,"canary_payload_changed");
  const rights=await transport.preflight(destination,{control:control.state||proposedControl,requiresMedia:Boolean(prepared.media)});
  requireCondition(rights?.ok===true && rights.destinationId===destination.id
    && rights.providerAccountId===approval.providerAccountId,"destination_rights_unverified");
  const key=newsPostKey(canaryNewsId,destination);
  if(action==="enable-canary") {
    requireCondition(!control.state,"destination_already_initialized");
    await verifyHead({destination,history:approval.history});
    await reconcileNewsSnapshot(store,feed,[destination],now(),{mediaOptions});
    for(const {state:job} of await store.list("post:")) if(job.destination?.platform===platform && job.destination.id===destination.id)
      requireCondition(candidates.has(job.newsId) && sha(job.prepared?.textRevision)
        && publicRevisions.get(job.newsId)===job.prepared.textRevision && !job.remoteId && !job.dispatchStartedAt
        && !["ambiguous","inflight"].includes(job.status),"existing_delivery_history_requires_review");
    // A pause/another initializer during reconciliation causes the null-version CAS to fail.
    await commit({...proposedControl,paused:false,historyReconciled:true,
      historyApproval:{sha256:historyDigest,scope:approval.history.scope,maxId:approval.history.maxId,reviewedAt:approval.reviewedAt},
      canaryRevision:prepared.revision,canaryPayloadSha256:payloadSha256,canaryProfile:prepared.profile,
      providerAccountId:rights.providerAccountId,operator:{action,repositorySha,at:now().toISOString()}});
    return {action,platform,controlId:control.id,mode:"canary",delivered:0};
  }
  requireCondition(control.state?.mode==="canary" && control.state.paused===false
    && control.state.historyReconciled===true && control.state.canaryNewsId===canaryNewsId
    && control.state.historyApproval?.sha256===historyDigest && control.state.canaryPayloadSha256===payloadSha256
    && control.state.canaryRevision===prepared.revision && control.state.providerAccountId===rights.providerAccountId,"canary_control_changed");
  if(action==="send-canary") {
    await reconcileNewsSnapshot(store,feed,[destination],now(),{mediaOptions});
    const job=(await store.read(key)).state;
    requireCondition(job?.prepared?.payloadSha256===payloadSha256 && job.desiredRevision===prepared.revision,"canary_job_changed");
    if(job.status==="sent_current" && job.acknowledgedRevision===job.desiredRevision && positiveId(job.remoteId))
      return {action,platform,status:"sent_current",remoteId:job.remoteId,alreadyAcknowledged:true,delivered:0};
    requireCondition(!job.remoteId,"canary_edit_requires_review");
    await verifyHead({destination,history:approval.history});
    const current=await store.read(controlKey);requireCondition(current.id===control.id,"control_version_changed");
    const assertPrepared=args=>requireCondition(args.destination.platform===platform && args.destination.id===destination.id
      && args.prepared?.revision===prepared.revision && args.prepared.payloadSha256===payloadSha256,"canary_job_changed");
    const boundedTransport={...transport,
      preflight:async (...args)=>{const result=await transport.preflight(...args);
        return result.providerAccountId===approval.providerAccountId && result.destinationId===destination.id ? result : {ok:false};},
      prepareDelivery:async args=>{assertPrepared(args);return transport.prepareDelivery(args);},
      send:async args=>{assertPrepared(args);
        const latest=await store.read(controlKey);
        if(latest.id!==control.id) return {kind:"blocked",code:"operator_control_changed"};
        return transport.send(args);},
    };
    const result=await dispatchNewsJob({store,key,transport:boundedTransport,now});
    return {action,platform,...result,delivered:result.status==="sent_current"?1:0};
  }
  const job=(await store.read(key)).state;
  requireCondition(job?.status==="sent_current" && job.acknowledgedRevision===prepared.revision
    && job.desiredRevision===prepared.revision && job.prepared?.payloadSha256===payloadSha256
    && positiveId(job.remoteId) && !job.withdrawal && !job.dispatchStartedAt,"canary_receipt_missing");
  for(const {state:pending} of await store.list("post:")) if(pending.destination?.platform===platform && pending.destination.id===destination.id)
    requireCondition(candidates.has(pending.newsId) && sha(pending.prepared?.textRevision)
      && publicRevisions.get(pending.newsId)===pending.prepared.textRevision
      && (!pending.remoteId || pending.key===key && pending.remoteId===job.remoteId)
      && !pending.dispatchStartedAt && !["ambiguous","inflight"].includes(pending.status),"existing_delivery_history_requires_review");
  const proofUrl=`https://t.me/probbaperra/${job.remoteId}`;
  requireCondition(nativeObservation?.viewed===true && nativeObservation.remoteId===job.remoteId
    && nativeObservation.url===proofUrl && Number.isFinite(Date.parse(job.acknowledgedAt))
    && Date.parse(job.acknowledgedAt)<=now().getTime(),"native_canary_review_missing");
  const publicProof=await verifyNative({remoteId:job.remoteId,prepared});
  await verifyHead({destination,history:approval.history,allowedRemoteId:job.remoteId});
  await commit({...control.state,mode:"on",canaryAccepted:{newsId:canaryNewsId,remoteId:job.remoteId,
    revision:prepared.revision,payloadSha256,proofUrl,reviewedAt:now().toISOString(),publicProof,
    profile:prepared.profile,providerAccountId:rights.providerAccountId,nativeViewed:true},
    operator:{...operatorContext,action,repositorySha,at:now().toISOString()}});
  return {action,platform,controlId:control.id,mode:"on",delivered:0};
}
