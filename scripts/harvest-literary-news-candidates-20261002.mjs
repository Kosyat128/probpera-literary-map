// Read-only source harvest. Candidates remain unreviewed and cannot be published by this script.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {createNewsService} from './lib/literary-news-feed.mjs';
import {fetchPinnedNewsSource} from './lib/literary-news-safe-fetch.mjs';
import {LITERARY_NEWS_SOURCES} from './lib/literary-news-sources.mjs';
import {canonicalUrl,validDate,validTimestamp} from './lib/literary-news-reviewed.mjs';

const {values}=parseArgs({options:{limit:{type:'string',default:'350'},from:{type:'string',default:'2026-09-25'},output:{type:'string'}}});
const limit=Number(values.limit);
if(!Number.isSafeInteger(limit)||limit<1||limit>700)throw new Error('harvest_limit_invalid');
const current=new Date(),snapshot=current.toISOString(),from=values.from;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(current);
if(!validDate(from)||from<'2026-01-01'||from>today)throw new Error('harvest_date_window_invalid');
const sources=LITERARY_NEWS_SOURCES.filter(s=>s.discoveryEnabled!==false);
const canonicalFile=new URL('../data/news/reviewed.json',import.meta.url);
const canonicalRaw=await readFile(canonicalFile,'utf8'),reviewed=JSON.parse(canonicalRaw);
const digest=(s)=>createHash('sha256').update(s).digest('hex');
const excludedUrls=new Set(reviewed.map(r=>canonicalUrl(r.source?.url)?.href).filter(Boolean));
try{const proposed=JSON.parse(await readFile(new URL('../reports/r10/publication/current-news-reviewed-20261002.json',import.meta.url),'utf8'));
  for(const r of proposed.records)excludedUrls.add(canonicalUrl(r.source.url).href);
}catch(e){if(e.code!=='ENOENT')throw e;}
const byId=new Map(sources.map(s=>[s.id,s])),responses=[],hashes=[];
const readonlyFetch=async(url,options)=>{
  const response=await fetchPinnedNewsSource(url,options);
  const proof={url:String(url),httpStatus:response.status,accessedAt:new Date().toISOString()};
  responses.push(proof);
  const copy=response.clone();
  hashes.push((async()=>{
    if(!copy.body)return;
    const reader=copy.body.getReader(),hash=createHash('sha256');let bytes=0;
    try{for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;
      if(bytes>2*1024*1024)throw new Error('listing_evidence_over_budget');hash.update(chunk.value);}
      proof.responseSha256=hash.digest('hex');proof.responseBytes=bytes;
    }catch{proof.evidenceStatus='bounded_read_failed';await reader.cancel().catch(()=>{});}
    finally{reader.releaseLock();}
  })());
  return response;
};
const service=createNewsService({sources,readReviewed:()=>reviewed,fetchImpl:readonlyFetch,now:()=>current,
  timeoutMs:10_000,maxResponseBytes:2*1024*1024,maxRequests:sources.length,
  maxPageChecks:sources.length,maxHttpRequests:sources.length*2});
function fair(rows,max){
  const pools=new Map();for(const r of rows){if(!pools.has(r.sourceId))pools.set(r.sourceId,[]);pools.get(r.sourceId).push(r);}
  for(const pool of pools.values())pool.sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''));
  const result=[];for(let index=0;result.length<max;index++){
    let any=false;for(const pool of pools.values())if(pool[index]&&result.length<max){result.push(pool[index]);any=true;}
    if(!any)break;
  }return result;
}
try{
  await service.refresh();await Promise.allSettled(hashes);
  const queue=service.getReviewQueue(),feed=await service.getFeed('Europe/Moscow');
  const unique=new Map(),counts={discovered:queue.length,alreadyReviewedOrProposed:0,invalidUrl:0,oldDated:0,futureDated:0};
  for(const q of queue){const url=canonicalUrl(q.source.url)?.href;
    if(!url){counts.invalidUrl++;continue;}if(excludedUrls.has(url)){counts.alreadyReviewedOrProposed++;continue;}
    if(unique.has(url))continue;
    const explicit=validTimestamp(q.publishedAt)||validDate(q.publishedAt);
    if(explicit&&(validTimestamp(q.publishedAt)?Date.parse(q.publishedAt)>current.getTime():q.publishedAt>today)){
      counts.futureDated++;continue;}
    if(explicit&&q.publishedAt.slice(0,10)<from){counts.oldDated++;continue;}
    const source=byId.get(q.sourceId);
    unique.set(url,{sourceId:q.sourceId,title:q.title,source:{...q.source,url},region:q.region,topics:q.topics,
      publishedAt:explicit?q.publishedAt:null,discoveredAt:q.discoveredAt,
      publicationDateStatus:explicit?'explicit-in-publisher-listing':'unknown-needs-article-verification',
      sourceCountryCodes:source.countryCodes||[],reviewStatus:'unreviewed',publicationEligible:false,
      pendingChecks:['retrieve original article','verify article headline, publication date and substantive facts',
        'distinguish a new stage from old information','RU/EN factual and editorial review','duplicate check before additive merge'],
    });
  }
  const remaining=[...unique.values()],fresh=remaining.filter(r=>r.publishedAt!==null),unknown=remaining.filter(r=>r.publishedAt===null);
  const selected=fair(fresh,limit),held=fair(unknown,Math.max(0,limit-selected.length));
  const report={schemaVersion:1,kind:'unreviewed-source-harvest',capturedAt:snapshot,fromPublishedDate:from,
    canonicalWritten:false,remoteWrites:0,providerApiCalls:0,publishedOrAcceptedCount:0,
    sourceRegistryIds:sources.map(s=>s.id),counts:{...counts,sourceEndpoints:sources.length,
      healthyEndpoints:feed.sources.filter(s=>s.status==='ok').length,failedEndpoints:feed.sources.filter(s=>s.status==='error').length,
      freshDatedCandidatePool:fresh.length,unknownPublicationDatePool:unknown.length,
      selectedFreshDatedCandidates:selected.length,selectedHeldForPublicationDate:held.length,
      selectedSources:new Set([...selected,...held].map(r=>r.sourceId)).size,
      selectedFreshDatedSources:new Set(selected.map(r=>r.sourceId)).size,
      selectedFreshDatedSourceCountryCodes:[...new Set(selected.flatMap(r=>r.sourceCountryCodes))].sort()},
    freshDatedCandidates:selected,needsPublicationVerification:held,
    sourceHealth:feed.sources.map(s=>({id:s.id,status:s.status,lastCheckedAt:s.lastCheckedAt,error:s.error||null})),
    listingResponses:responses,
    limitations:['Explicit feed/listing dates have not been corroborated against complete articles yet.',
      'Unknown publication dates are held separately; access time never supplies a publication date.',
      'No candidate is claimed to be a verified news event, public item or Telegram-ready post.',
      'Candidate selection rotates across sources. This one-pass harvest does not exhaust article archives.',
      'No source HTML or article bodies are retained in this report.'],
    canonicalBeforeSha256:digest(canonicalRaw)};
  if(digest(await readFile(canonicalFile,'utf8'))!==digest(canonicalRaw))report.concurrentCanonicalChangeObserved=true;
  const dir=new URL('../reports/r10/publication/',import.meta.url);await mkdir(dir,{recursive:true});
  await writeFile(values.output||new URL('current-news-harvest-20261002.json',dir),JSON.stringify(report,null,2)
    .replace(/\u2013/g,'\\u2013').replace(/\u2014/g,'\\u2014')+'\n');
  console.log(JSON.stringify({capturedAt:snapshot,...report.counts,publishedOrAcceptedCount:0,remoteWrites:0,
    ...(report.concurrentCanonicalChangeObserved?{concurrentCanonicalChangeObserved:true}:{})}));
}finally{service.close();}
