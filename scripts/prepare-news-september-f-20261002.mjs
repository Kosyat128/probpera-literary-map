// Fixed F partition, read-only cached source evidence. No network or canonical mutation.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {LITERARY_NEWS_SOURCES} from './lib/literary-news-sources.mjs';
import {canonicalUrl,validDate,validTimestamp,selectReviewed,CATEGORIES} from './lib/literary-news-reviewed.mjs';
import {mergeReviewedBatch} from './apply-literary-news-batch.mjs';
import {normalizeShortHyphens} from './lib/short-hyphens.mjs';
import {F_EDITORIAL_ROWS} from './news-september-f-editorial-20261002.mjs';
const hash=value=>createHash('sha256').update(Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const sources=new Map(LITERARY_NEWS_SOURCES.map(s=>[s.id,s]));
const directory='.tmp/september-news-bodies-20261002';
const reportFile='reports/r10/publication/news-september-f-20261002.json';
const canonicalFile='data/news/reviewed.json';
const exactJson=v=>JSON.stringify(v,null,2).replace(/[\u2010-\u2015]/gu,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))+'\n';

export function septemberPublicationBasis(candidate,listing){
 const dates=(candidate.evidence.publishedDates||[]).filter(d=>validTimestamp(d.value)||validDate(d.value));
 const days=new Set(dates.map(d=>validDate(d.value)?d.value:new Date(d.value).toISOString().slice(0,10)));
 if(days.size>1)throw Error('F_primary_publication_conflict');
 const timestamp=dates.find(d=>validTimestamp(d.value));
 if(timestamp)return {method:'explicit-primary-article-publication-metadata',value:new Date(timestamp.value).toISOString(),
  metadata:dates,listingValue:candidate.publishedAt,precision:'publisher-supplied timestamp; capture time separate'};
 if(dates.length)return {method:'explicit-primary-article-publication-date',value:dates[0].value,metadata:dates,
  precision:'date-only; no inferred time or timezone'};
 if(!validTimestamp(candidate.publishedAt)||candidate.publicationDateStatus!=='explicit-in-publisher-listing'
  ||!listing||listing.httpStatus!==200||!/^[a-f0-9]{64}$/u.test(listing.responseSha256||''))throw Error('F_publication_unverified');
 return {method:'explicit-publisher-listing',value:candidate.publishedAt,listing,precision:'publisher-supplied feed timestamp'};
}

function heldReason(index){
 if(index===240)return 'Semantic duplicate: the same Selbert exhibition and opening are already covered by C248.';
 if([243,260,291,294,298].includes(index))return 'General political/legal framing was not selected for this literary backfill.';
 if([245,251,257,261,265,267,272,284,285,286,287,290,247].includes(index))
  return 'Held outside this bounded literary selection: general guides, commerce, nonliterary subjects or insufficient substantive text.';
 return 'Not selected after source-backed editorial and distinct-stage review.';
}

export async function buildSeptemberF({current=new Date(),readDocument=readFile}={}){
 const harvestRaw=await readDocument('reports/r10/publication/september-news-candidate-pool-20261002.json','utf8'),harvest=JSON.parse(harvestRaw);
 const selected=new Map(F_EDITORIAL_ROWS.map(r=>[r.i,r])),records=[],evidence=[],held=[];
 const preparedAt=current.toISOString();let http200=0,digestChecks=0;
 for(let index=240;index<300;index++){
  const candidate=JSON.parse(await readDocument(`${directory}/${index}.json`,'utf8')),row=selected.get(index),d=candidate.evidence;
  const prior=harvest.candidates[index],source=sources.get(candidate.sourceId);
  if(candidate.septemberIndex!==index||!prior||!source||source.discoveryEnabled===false||candidate.sourceId!==prior.sourceId
   ||candidate.source.url!==prior.source.url||candidate.publishedAt!==prior.publishedAt)throw Error('F_harvest_identity_invalid:'+index);
  if(!d||d.httpStatus!==200){if(row)throw Error('F_selected_body_unavailable');held.push({septemberIndex:index,sourceId:candidate.sourceId,
   url:candidate.source.url,reason:candidate.error||'Original article unavailable',reviewStatus:'held',publicationEligible:false});continue;}
  if(d.localDocumentPath!==`${directory}/source-documents/${index}.bin`||!validTimestamp(d.accessedAt)
   ||!Number.isSafeInteger(d.documentBytes)||d.documentBytes<1||d.documentBytes>2*1024*1024)throw Error('F_capture_metadata_invalid:'+index);
  const bytes=await readDocument(d.localDocumentPath),allowed=new Set([new URL(source.url).hostname,...(source.articleOrigins||[]).map(u=>new URL(u).hostname)]);
  if(hash(bytes)!==d.responseSha256||bytes.length!==d.documentBytes||!allowed.has(new URL(d.url).hostname)
   ||canonicalUrl(d.url)?.href.replace(/\/$/u,'')!==canonicalUrl(candidate.source.url)?.href.replace(/\/$/u,''))throw Error('F_full_body_digest_invalid:'+index);
  http200++;digestChecks++;
  if(!row){held.push({septemberIndex:index,sourceId:candidate.sourceId,url:candidate.source.url,httpStatus:200,
   accessedAt:d.accessedAt,responseSha256:d.responseSha256,documentBytes:d.documentBytes,reason:heldReason(index),
   reviewStatus:'held',publicationEligible:false});continue;}
  const quoteContext=[d.headline,d.text].join('\n');
  if(d.text.length<200||row.quotes.some(q=>!quoteContext.includes(q)))throw Error('F_literal_fact_not_grounded:'+index+':'+row.quotes.filter(q=>!quoteContext.includes(q)).join('|'));
  const listing=harvest.parentListingResponses.find(r=>r.url===(source.feedUrl||source.url));
  const basis=septemberPublicationBasis(candidate,listing),publishedAt=basis.value;
  if(publishedAt.slice(0,10)<'2026-09-01'||publishedAt.slice(0,10)>'2026-09-24')throw Error('F_date_outside_archival_window');
  const record={id:'r10-news-f-'+row.slug+'-20261002',category:row.category,kind:'news',eventDate:publishedAt.slice(0,10),publishedAt,
   verifiedAt:preparedAt,title:Object.fromEntries(['ru','en'].map(l=>[l,normalizeShortHyphens(row.title[l])])),
   summary:Object.fromEntries(['ru','en'].map(l=>[l,normalizeShortHyphens(row.summary[l])])),
   source:{name:source.name,url:candidate.source.url,language:d.language||candidate.source.language,title:normalizeShortHyphens(d.headline)},
   verification:'confirmed',region:candidate.region,eventKey:'r10-news-f-'+row.slug+'-20261002'};
  records.push(record);evidence.push({id:record.id,septemberIndex:index,sourceId:candidate.sourceId,url:candidate.source.url,
   httpStatus:200,accessedAt:d.accessedAt,responseSha256:d.responseSha256,documentBytes:d.documentBytes,
   localSourceDocument:d.localDocumentPath,capturedHeadline:d.headline,capturedHeadlineSha256:hash(d.headline),
   sourcePublishedEvidence:basis,proofQuotes:row.quotes,facts:row.facts,
   geography:{sourceCountryCodes:source.countryCodes||[],basis:'Publisher organisation geography; author and fictional-setting geography are separate.'},
   review:{method:'agent_factual_and_bilingual_review_of_fetched_primary_article',reviewedAt:preparedAt,
    bodyRetrieved:true,bodyDigestCheckedAgainstFullBytes:true,quoteGroundingChecked:true,ruEnFactsReviewed:true,
    eventDateBasis:'Primary publication date of this September report, interview, review or announcement.',
    archiveOnly:true,captureTimeUsedAsPublication:false,freshTelegramBackfill:false,
    limitation:'Book years and future event/release plans are kept separate; no completion or precise release day inferred.'},
   thumbnailCandidates:(d.images||[]).filter(x=>x.displayOnly&&!/(?:logo|icon|avatar)/iu.test(x.url)).slice(0,2)
    .map(x=>({...x,socialReuseApproved:false,relevanceStatus:'article-metadata-proposal-requires-image-review',autoApply:false}))});
 }
 return {schemaVersion:1,batchId:'news-september-f-20261002',preparedAt,
  scope:'A bounded September literary archive proposal from prefetched candidates 240..299; no network, canonical or remote mutations.',
  inputEvidence:{harvestFile:'reports/r10/publication/september-news-candidate-pool-20261002.json',harvestSha256:hash(harvestRaw),
   slice:{startInclusive:240,endExclusive:300},capturedArticles:60,bodyHTTP200:http200,fullBodyDigestsChecked:digestChecks},
  records,recordSha256:hash(records),evidence,held,editorialSha256:hash(F_EDITORIAL_ROWS)};
}

export function checkSeptemberF(batch,existing,current=new Date()){
 if(batch.records.length!==F_EDITORIAL_ROWS.length||batch.evidence.length!==batch.records.length||batch.held.length+batch.records.length!==60
  ||batch.recordSha256!==hash(batch.records)||batch.editorialSha256!==hash(F_EDITORIAL_ROWS))throw Error('F_integrity_invalid');
 const prior=new Map(existing.map(r=>[canonicalUrl(r.source?.url)?.href,r])),urls=new Set(),ids=new Set();
 const cutoff=current.getTime()-7*86400000;
 for(const record of batch.records){
  const proof=batch.evidence.find(p=>p.id===record.id),row=F_EDITORIAL_ROWS.find(r=>r.i===proof?.septemberIndex),source=sources.get(proof?.sourceId);
  if(!row||!source||proof.httpStatus!==200||!validTimestamp(proof.accessedAt)||!/^[a-f0-9]{64}$/u.test(proof.responseSha256)
   ||!proof.review.bodyDigestCheckedAgainstFullBytes||!proof.review.ruEnFactsReviewed||!proof.review.archiveOnly
   ||proof.review.captureTimeUsedAsPublication||proof.review.freshTelegramBackfill||proof.sourcePublishedEvidence.value!==record.publishedAt)
   throw Error('F_primary_evidence_invalid');
  for(const l of['ru','en'])if(record.summary[l].length<140||record.summary[l].length>440||record.title[l].length>160
   ||record.summary[l]!==normalizeShortHyphens(row.summary[l])||record.title[l]!==normalizeShortHyphens(row.title[l]))throw Error('F_editorial_invalid:'+row.i+':'+l);
  if(hash(proof.proofQuotes)!==hash(row.quotes)||hash(proof.facts)!==hash(row.facts)||hash(proof.capturedHeadline)!==proof.capturedHeadlineSha256
   ||proof.proofQuotes.reduce((n,q)=>n+q.trim().split(/\s+/u).length,0)>25||!CATEGORIES.has(record.category)||record.category!==row.category
   ||record.kind!=='news'||record.verification!=='confirmed'||record.id!==record.eventKey
   ||record.id!=='r10-news-f-'+row.slug+'-20261002'||record.source.name!==source.name
   ||record.source.url!==proof.url||record.eventDate!==record.publishedAt.slice(0,10))throw Error('F_review_changed');
  if(!validTimestamp(record.publishedAt)&&!validDate(record.publishedAt)||Date.parse(record.publishedAt)>=cutoff)throw Error('F_archival_article_became_fresh');
  const url=canonicalUrl(record.source.url)?.href;
  if(!url||urls.has(url)||ids.has(record.id)||prior.has(url)&&prior.get(url).id!==record.id)throw Error('F_duplicate:'+record.id);
  urls.add(url);ids.add(record.id);
 }
 if(batch.held.some(r=>r.publicationEligible!==false||r.reviewStatus!=='held'))throw Error('F_held_became_public');
 if(selectReviewed(batch.records,current,'Europe/Moscow').length!==batch.records.length)throw Error('F_not_publicly_eligible');
 const preview=mergeReviewedBatch(existing,batch,{current});
 if(preview.held.length||preview.added.length+preview.unchanged.length!==batch.records.length)throw Error('F_merge_not_additive');
 return preview;
}

async function main(){
 if(!process.argv.includes('--build')&&!process.argv.includes('--check'))throw Error('Use --build or --check; there is no network mode.');
 const before=await readFile(canonicalFile,'utf8'),existing=JSON.parse(before),current=new Date();
 const batch=process.argv.includes('--build')?await buildSeptemberF({current}):JSON.parse(await readFile(reportFile,'utf8'));
 const preview=checkSeptemberF(batch,existing,current);
 const receipt={batchId:batch.batchId,checkedAt:current.toISOString(),writtenCanonical:false,remoteWrites:0,networkRequests:0,
  proposedReviewed:batch.records.length,held:batch.held.length,bodyHTTP200:batch.inputEvidence.bodyHTTP200,
  fullBodyDigestsChecked:batch.inputEvidence.fullBodyDigestsChecked,added:preview.added.length,mergeHeld:preview.held,
  beforeReviewedCount:existing.length,proposedReviewedCount:preview.records.length,
  eligiblePublicAfter:selectReviewed(preview.records,current,'Europe/Moscow').length,
  freshForTelegram:batch.records.filter(r=>Date.parse(r.publishedAt)>=current.getTime()-7*86400000).length,
  sourceIds:[...new Set(batch.evidence.map(e=>e.sourceId))],sourceCountryCodes:[...new Set(batch.evidence.flatMap(e=>e.geography.sourceCountryCodes))].sort(),
  canonicalBeforeSha256:hash(before),recordSha256:batch.recordSha256,
  limitations:['September archive is dated by primary publisher evidence; it is excluded from fresh Telegram intake.',
   'The overall Kometenparade market and separately timed author sessions are identified distinctly for root semantic review.',
   'The Selbert exhibition duplicate is held. Image metadata has not been approved for reuse.']};
 if(process.argv.includes('--build')){await mkdir('reports/r10/publication',{recursive:true});await writeFile(reportFile,exactJson(batch));
  await writeFile(reportFile.replace('.json','-review-preview.json'),exactJson(receipt));}
 if(hash(await readFile(canonicalFile,'utf8'))!==hash(before))throw Error('canonical_changed_during_F_preparation');
 console.log(JSON.stringify(receipt));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
