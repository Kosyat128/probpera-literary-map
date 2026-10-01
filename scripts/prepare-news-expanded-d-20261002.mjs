// Additive September archive proposal. No canonical writes or network requests.
import {readFile,writeFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {hash,validateCapture,primaryDatesFromBody} from './prepare-news-expanded-b-20261002.mjs';
import {mergeReviewedBatch} from './apply-literary-news-batch.mjs';
import {canonicalUrl,selectReviewed,validDate,validTimestamp} from './lib/literary-news-reviewed.mjs';
import {LITERARY_NEWS_SOURCES} from './lib/literary-news-sources.mjs';
import {normalizeShortHyphens} from './lib/short-hyphens.mjs';
import {REVIEWED_ROWS,HELD_ROWS} from './lib/news-expanded-d-editorial-20261002.mjs';

export const batchId='news-expanded-d-20261002';
export const poolSha256='695c3086b59fd0d34223d2140d795a95e003122755cac432f003f441537af45a';
const base=new URL('../',import.meta.url);
const poolFile=new URL('reports/r10/publication/september-news-candidate-pool-20261002.json',base);
const canonicalFile=new URL('data/news/reviewed.json',base);
const reportFile=new URL(`reports/r10/publication/${batchId}.json`,base);
const previewFile=new URL(`reports/r10/publication/${batchId}-review-preview.json`,base);
const datesFile=new URL(`reports/r10/publication/${batchId}-primary-dates.json`,base);
const fixedPool=JSON.parse(await readFile(poolFile,'utf8'));
const sources=new Map(LITERARY_NEWS_SOURCES.map(s=>[s.id,s]));
const exactJson=value=>JSON.stringify(value,null,2).replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/gu,
  c=>`\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`)+'\n';
const dateMethods=new Set(['primary-article-exact-publisher-timestamp','primary-calendar-date-with-conflicting-machine-time',
  'primary-calendar-date-without-timezone','explicit-publisher-listing']);

export function validatePrimaryActor(row,{source,author}){
  // The registry id retains an older alias. The fetched article and publisher
  // identity, rather than that alias, establish the actor named in the prose.
  if(row.index!==103)return;
  if(source.name!=='Mercurio'||author!=='Mercurio'
    ||['ru','en'].some(l=>!row.title[l].startsWith('Mercurio ')||!row.summary[l].startsWith('Mercurio ')))
    throw new Error('primary_editorial_actor_not_grounded');
}

export function publicationBasis(candidate,dates){
  const raw=dates.published||[],calendar=candidate.publishedAt.slice(0,10);
  if(!validTimestamp(candidate.publishedAt)||calendar<'2026-09-01'||calendar>'2026-09-24')
    throw new Error('archive_listing_date_outside_slice');
  const calendarDates=raw.map(d=>d.value.slice(0,10)).filter(validDate);
  if(calendarDates.some(d=>d!==calendar))throw new Error('primary_and_listing_calendar_dates_disagree');
  const stamps=raw.filter(d=>validTimestamp(d.value));
  const uniqueInstants=new Set(stamps.map(d=>Date.parse(d.value)));
  if(uniqueInstants.size>1)return {method:'primary-calendar-date-with-conflicting-machine-time',value:calendar,
    precision:'date-only',rawPrimaryPublicationDates:raw,rawPrimaryModificationDates:dates.modified||[],
    limitation:'Publisher meta and primary JSON-LD agree on the calendar date but disagree on the instant. No clock time or timezone is inferred.'};
  if(stamps.length)return {method:'primary-article-exact-publisher-timestamp',value:stamps[0].value,
    precision:'publisher-supplied-timestamp',rawPrimaryPublicationDates:raw,rawPrimaryModificationDates:dates.modified||[],
    listingPublishedAt:candidate.publishedAt,listingInstantAgreement:Date.parse(stamps[0].value)===Date.parse(candidate.publishedAt),
    limitation:'The exact native primary publisher timestamp is retained. A listing timezone disagreement does not replace the primary offset.'};
  if(calendarDates.length)return {method:'primary-calendar-date-without-timezone',value:calendar,precision:'date-only',
    rawPrimaryPublicationDates:raw,rawPrimaryModificationDates:dates.modified||[],
    limitation:'The primary publisher supplies a calendar date without a supported offset. No time is invented.'};
  return {method:'explicit-publisher-listing',value:candidate.publishedAt,precision:'publisher-supplied-timestamp',
    rawPrimaryPublicationDates:raw,rawPrimaryModificationDates:dates.modified||[],
    limitation:'Bound to the fixed dated publisher listing; capture and modification times are separate.'};
}

export async function prepareBatch({input,pool,current=new Date(),readDocument=readFile}){
  if(pool.candidateArraySha256!==poolSha256||hash(pool.candidates)!==poolSha256)throw new Error('fixed_archive_pool_changed');
  if(!Array.isArray(input)||input.length!==120)throw new Error('archive_slice_must_have_120_records');
  const byIndex=new Map(input.map(c=>[c.septemberIndex,c]));
  const indices=[...REVIEWED_ROWS.map(r=>r.index),...HELD_ROWS.map(r=>r[0])].sort((a,b)=>a-b);
  if(byIndex.size!==120||hash(indices)!==hash(Array.from({length:120},(_,i)=>i)))throw new Error('archive_slice_accounting_invalid');
  const documents=new Map(),dateAudit=[];
  for(let index=0;index<120;index++){
    const candidate=byIndex.get(index),original=pool.candidates[index],detail=candidate?.evidence;
    if(!candidate||candidate.sourceId!==original.sourceId||candidate.source.url!==original.source.url
      ||candidate.publishedAt!==original.publishedAt)throw new Error(`archive_listing_identity_changed:${index}`);
    if(!detail){if(candidate.error!=='http_403')throw new Error(`unexpected_missing_archive_capture:${index}`);
      dateAudit.push({septemberIndex:index,sourceId:candidate.sourceId,url:candidate.source.url,httpStatus:403,
        listingPublishedAt:candidate.publishedAt,reviewStatus:'held',published:[],modified:[]});continue;}
    if(!/^\.tmp\/september-news-bodies-20261002\/source-documents\/\d{3}\.bin$/u.test(detail.localDocumentPath))
      throw new Error(`archive_document_path_invalid:${index}`);
    const bytes=await readDocument(new URL(detail.localDocumentPath,base));
    if(detail.httpStatus!==200||hash(bytes)!==detail.responseSha256||bytes.length!==detail.documentBytes
      ||bytes.length>2*1024*1024)throw new Error(`archive_full_body_digest_invalid:${index}`);
    const dates=primaryDatesFromBody(bytes,sources.get(candidate.sourceId),candidate.source.url);
    documents.set(index,{bytes,dates});
    dateAudit.push({septemberIndex:index,sourceId:candidate.sourceId,url:candidate.source.url,httpStatus:200,
      responseSha256:detail.responseSha256,documentBytes:bytes.length,listingPublishedAt:candidate.publishedAt,...dates,
      reviewStatus:REVIEWED_ROWS.some(r=>r.index===index)?'proposed':'held'});
  }
  const preparedAt=current.toISOString(),records=[],evidence=[],held=[];
  for(const row of [...REVIEWED_ROWS].sort((a,b)=>a.index-b.index)){
    const candidate=byIndex.get(row.index),detail=candidate.evidence,document=documents.get(row.index);
    const context=validateCapture(candidate,document.bytes,pool.candidates[row.index]);
    validatePrimaryActor(row,context);
    for(const quote of row.proofQuotes)if(!context.quoteContext.includes(quote))throw new Error(`proof_quote_not_grounded:${row.index}:${quote}`);
    const basis=publicationBasis(candidate,document.dates);
    const record={id:row.id,category:row.category,kind:'news',eventDate:basis.value.slice(0,10),publishedAt:basis.value,
      verifiedAt:preparedAt,title:row.title,summary:row.summary,
      source:{...candidate.source,title:normalizeShortHyphens(detail.headline)},
      verification:'confirmed',region:candidate.region,eventKey:row.id};
    records.push(record);
    evidence.push({id:row.id,septemberIndex:row.index,sourceId:candidate.sourceId,url:candidate.source.url,
      httpStatus:200,accessedAt:detail.accessedAt,responseSha256:detail.responseSha256,documentBytes:detail.documentBytes,
      retainedLocalInput:detail.localDocumentPath,
      capturedHeadline:detail.headline,capturedHeadlineSha256:hash(detail.headline),capturedAuthor:context.author,
      extractionSelectors:detail.extractionSelectors||null,headlineMethod:detail.headlineMethod||'Primary article headline extraction',
      facts:row.facts,proofQuotes:row.proofQuotes,proofQuotesSha256:hash(row.proofQuotes),sourcePublishedEvidence:basis,
      geography:{sourceCountryCodes:context.source.countryCodes||[],storyCountryCodes:row.countryCodes,
        basis:'Source organisation geography is separate from the named setting, participants or publishing territory. Empty story geography retains uncertainty.'},
      review:{method:'agent_factual_and_bilingual_review_of_retained_primary_article',reviewedAt:preparedAt,
        bodyRetrieved:true,bodyDigestCheckedAgainstFullBytes:true,quoteGroundingChecked:true,ruEnFactsReviewed:true,
        temporal:row.temporal,eventDateBasis:'Date of this publisher article, announcement, excerpt or review; older book dates and scheduled events remain distinct.',
        inferredFutureEventTimes:0,limitation:'No new book-release day or actual completion of an announced event is inferred from article publication or capture.'},
      thumbnailCandidates:(detail.images||[]).filter(i=>i.displayOnly&&i.url&&!/(?:logo|icon|avatar)/iu.test(i.url)).slice(0,2)
        .map(i=>({...i,socialReuseApproved:false,relevanceStatus:'article-metadata-proposal-requires-image-review',autoApply:false}))});
  }
  for(const [index,reason] of HELD_ROWS){const candidate=byIndex.get(index),detail=candidate.evidence;
    held.push({septemberIndex:index,sourceId:candidate.sourceId,url:candidate.source.url,listingPublishedAt:candidate.publishedAt,
      httpStatus:detail?.httpStatus||403,responseSha256:detail?.responseSha256||null,documentBytes:detail?.documentBytes||0,
      reason,reviewStatus:'held',publicationEligible:false});}
  const batch={schemaVersion:1,batchId,preparedAt,
    scope:`${records.length} individually reviewed RU/EN literary archive proposals from September1-24; ${held.length} held. No canonical mutation or publication.`,
    inputEvidence:{poolFile:'reports/r10/publication/september-news-candidate-pool-20261002.json',candidateArraySha256:poolSha256,
      slice:{startInclusive:0,endExclusive:120},capturedArticles:120,bodyHTTP200:documents.size,fullBodyDigestsChecked:documents.size,
      sourceOrganisationEvidenceChanged:false},records,recordSha256:hash(records),evidence,evidenceSha256:hash(evidence),held,heldSha256:hash(held),
    editorialSha256:hash({reviewed:REVIEWED_ROWS,held:HELD_ROWS})};
  return {batch,dateAudit};
}

export function checkBatch(batch,existing,current=new Date()){
  if(batch.batchId!==batchId||batch.records?.length!==REVIEWED_ROWS.length||batch.held?.length!==HELD_ROWS.length
    ||batch.evidence?.length!==batch.records.length||batch.recordSha256!==hash(batch.records)
    ||batch.evidenceSha256!==hash(batch.evidence)||batch.heldSha256!==hash(batch.held)
    ||batch.editorialSha256!==hash({reviewed:REVIEWED_ROWS,held:HELD_ROWS})
    ||batch.inputEvidence?.candidateArraySha256!==poolSha256)throw new Error('archive_batch_integrity_invalid');
  const byId=new Map(batch.evidence.map(e=>[e.id,e])),ids=new Set(),urls=new Set();
  for(const record of batch.records){
    const row=REVIEWED_ROWS.find(r=>r.id===record.id),proof=byId.get(record.id),source=sources.get(proof?.sourceId),basis=proof?.sourcePublishedEvidence;
    if(!row||!proof||proof.septemberIndex!==row.index||proof.httpStatus!==200||!validTimestamp(proof.accessedAt)
      ||!/^[a-f0-9]{64}$/u.test(proof.responseSha256||'')||proof.documentBytes<1||proof.documentBytes>2*1024*1024
      ||!source||source.discoveryEnabled===false||source.name!==record.source.name||proof.url!==record.source.url)
      throw new Error(`archive_primary_evidence_invalid:${record.id}`);
    if(proof.retainedLocalInput!==`.tmp/september-news-bodies-20261002/source-documents/${String(row.index).padStart(3,'0')}.bin`)
      throw new Error(`archive_retained_document_identity_invalid:${record.id}`);
    if(hash(proof.capturedHeadline)!==proof.capturedHeadlineSha256||hash(proof.proofQuotes)!==proof.proofQuotesSha256
      ||hash(proof.proofQuotes)!==hash(row.proofQuotes)||!proof.review.bodyDigestCheckedAgainstFullBytes
      ||!proof.review.ruEnFactsReviewed)throw new Error(`archive_literal_or_editorial_proof_invalid:${record.id}`);
    if(record.kind!=='news'||record.verification!=='confirmed'||record.eventKey!==row.id
      ||hash(record.title)!==hash(row.title)||hash(record.summary)!==hash(row.summary))throw new Error(`archive_editorial_changed:${record.id}`);
    for(const locale of ['ru','en'])if(record.title[locale].length>160||record.summary[locale].length<140||record.summary[locale].length>440
      ||normalizeShortHyphens(record.title[locale]+record.summary[locale])!==record.title[locale]+record.summary[locale])
      throw new Error(`archive_editorial_length_or_punctuation_invalid:${record.id}:${locale}`);
    if(!proof.proofQuotes.length||proof.proofQuotes.reduce((n,q)=>n+q.trim().split(/\s+/u).length,0)>25)
      throw new Error(`archive_quote_budget_invalid:${record.id}`);
    if(!dateMethods.has(basis?.method)||basis.value!==record.publishedAt
      ||(!validDate(record.publishedAt)&&!validTimestamp(record.publishedAt))
      ||record.publishedAt.slice(0,10)<'2026-09-01'||record.publishedAt.slice(0,10)>'2026-09-24'
      ||record.eventDate!==record.publishedAt.slice(0,10))throw new Error(`archive_publication_basis_invalid:${record.id}`);
    const original=fixedPool.candidates[row.index];
    validatePrimaryActor({...row,title:record.title,summary:record.summary},{source,author:proof.capturedAuthor});
    if(original.sourceId!==proof.sourceId||original.source.url!==record.source.url
      ||hash(publicationBasis(original,{published:basis.rawPrimaryPublicationDates,modified:basis.rawPrimaryModificationDates}))!==hash(basis))
      throw new Error(`archive_publication_provenance_changed:${record.id}`);
    const url=canonicalUrl(record.source.url)?.href;
    if(!url||ids.has(record.id)||urls.has(url))throw new Error(`archive_batch_duplicate:${record.id}`);
    ids.add(record.id);urls.add(url);
  }
  if(batch.held.some(h=>h.publicationEligible!==false||h.reviewStatus!=='held'||urls.has(canonicalUrl(h.url)?.href)))
    throw new Error('archive_held_item_became_public');
  if(selectReviewed(batch.records,current,'Europe/Moscow').length!==batch.records.length)throw new Error('archive_batch_not_eligible');
  const merged=mergeReviewedBatch(existing,batch,{current});
  if(merged.held.length||merged.added.length+merged.unchanged.length!==batch.records.length)throw new Error('archive_merge_preview_not_additive');
  return merged;
}

async function main(){
  const {values}=parseArgs({options:{'evidence-input':{type:'string'},check:{type:'boolean'}}});
  const existingRaw=await readFile(canonicalFile,'utf8'),existing=JSON.parse(existingRaw),current=new Date();
  const result=values['evidence-input']?await prepareBatch({input:JSON.parse(await readFile(values['evidence-input'],'utf8')),
    pool:JSON.parse(await readFile(poolFile,'utf8')),current}):{batch:JSON.parse(await readFile(reportFile,'utf8'))};
  const {batch,dateAudit}=result,merged=checkBatch(batch,existing,current);
  const receipt={batchId,checkedAt:current.toISOString(),writtenCanonical:false,remoteWrites:0,providerApiCalls:0,
    capturedArticles:120,bodyHTTP200:116,proposedReviewed:batch.records.length,held:batch.held.length,
    beforeReviewedCount:existing.length,proposedReviewedCount:merged.records.length,added:merged.added.length,unchanged:merged.unchanged.length,
    eligiblePublicBefore:selectReviewed(existing,current,'Europe/Moscow').length,eligiblePublicAfter:selectReviewed(merged.records,current,'Europe/Moscow').length,
    sourceIds:[...new Set(batch.evidence.map(e=>e.sourceId))],
    sourceCountryCodes:[...new Set(batch.evidence.flatMap(e=>e.geography.sourceCountryCodes))].sort(),
    storyCountryCodes:[...new Set(batch.evidence.flatMap(e=>e.geography.storyCountryCodes))].sort(),
    dateOnlyPublicationCount:batch.records.filter(r=>validDate(r.publishedAt)).length,
    explicitPublicationDateCount:batch.records.length,unknownPublicationDateCount:0,inferredFutureEventTimes:0,
    proofQuoteWordsMax:Math.max(...batch.evidence.map(e=>e.proofQuotes.reduce((n,q)=>n+q.trim().split(/\s+/u).length,0))),
    summaryLengths:Object.fromEntries(['ru','en'].map(l=>[l,{min:Math.min(...batch.records.map(r=>r.summary[l].length)),max:Math.max(...batch.records.map(r=>r.summary[l].length))}])),
    canonicalBeforeSha256:hash(existingRaw),recordSha256:batch.recordSha256,
    duplicateCheck:'Pool excludes all existing canonical and current-harvest URLs; cross-agent award stages and event duplicates coordinated separately.',
    limitations:['Four HTTP403 articles remain held. Static catalogues and thin or unrelated reports are not promoted.',
      'Archive publication dates remain in September; October capture never becomes article publication.',
      'A scheduled past or future event is described as announced unless the retrieved report establishes completion.',
      'Image candidates require separate relevance and rights review and are not applied.']};
  if(values['evidence-input']&&!values.check){
    await writeFile(reportFile,exactJson(batch));await writeFile(previewFile,exactJson(receipt));
    await writeFile(datesFile,exactJson({schemaVersion:1,batchId,checkedAt:current.toISOString(),capturedArticles:120,
      bodyHTTP200:116,primaryDateBodiesChecked:116,reviewedProposals:batch.records.length,held:batch.held.length,
      publicationRange:{start:'2026-09-01',end:'2026-09-24'},
      unresolvedPrimaryCalendarDateConflictsAmongProposals:0,
      articles:dateAudit.map(d=>({...d,publicationBasis:batch.evidence.find(e=>e.septemberIndex===d.septemberIndex)?.sourcePublishedEvidence||null,
        heldReason:batch.held.find(h=>h.septemberIndex===d.septemberIndex)?.reason||null}))}));
  }
  if(hash(await readFile(canonicalFile,'utf8'))!==hash(existingRaw))throw new Error('canonical_changed_during_archive_preparation');
  console.log(JSON.stringify(receipt));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
