// Additive editorial proposal only. No canonical writes, social sends or publication.
// Build: node scripts/prepare-news-expanded-b-20261002.mjs --evidence-input=.tmp/news-expanded-b-20261002/details.json
// Recheck the committed evidence without fetching: node scripts/prepare-news-expanded-b-20261002.mjs --check
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {load} from 'cheerio';
import {mergeReviewedBatch} from './apply-literary-news-batch.mjs';
import {canonicalUrl,selectReviewed,validDate,validTimestamp} from './lib/literary-news-reviewed.mjs';
import {LITERARY_NEWS_SOURCES} from './lib/literary-news-sources.mjs';
import {normalizeShortHyphens} from './lib/short-hyphens.mjs';
import {REVIEWED_ROWS,HELD_ROWS} from './lib/news-expanded-b-editorial-20261002.mjs';

export const batchId='news-expanded-b-20261002';
const reportFile=new URL(`../reports/r10/publication/${batchId}.json`,import.meta.url);
const receiptFile=new URL(`../reports/r10/publication/${batchId}-review-preview.json`,import.meta.url);
const dateAuditFile=new URL(`../reports/r10/publication/${batchId}-primary-dates.json`,import.meta.url);
const canonicalFile=new URL('../data/news/reviewed.json',import.meta.url);
const harvestFile=new URL('../reports/r10/publication/current-news-harvest-20261002.json',import.meta.url);
export const hash=value=>createHash('sha256').update(Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const exactJson=value=>JSON.stringify(value,null,2).replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/gu,
  c=>`\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`)+'\n';
const sources=new Map(LITERARY_NEWS_SOURCES.map(s=>[s.id,s]));

export function primaryDatesFromBody(rawBody,source,url){
  const $=load(new TextDecoder(source.encoding||'utf-8').decode(rawBody)),published=[],modified=[];
  $('meta[property="article:published_time"],meta[name="date"],meta[itemprop="datePublished"]').each((_,e)=>{
    const value=$(e).attr('content');if(value)published.push({value,method:'primary-publication-meta'});});
  $('meta[property="article:modified_time"],meta[itemprop="dateModified"]').each((_,e)=>{
    const value=$(e).attr('content');if(value)modified.push({value,method:'primary-modification-meta'});});
  function visit(node){if(!node||typeof node!=='object')return;
    const identity=typeof node.url==='string'?node.url:typeof node['@id']==='string'?node['@id']:null;
    const isPrimary=!identity||canonicalUrl(new URL(identity,url).href)?.href===canonicalUrl(url)?.href;
    if(isPrimary&&typeof node.datePublished==='string')published.push({value:node.datePublished,method:'primary-jsonld.datePublished',type:node['@type']||null});
    if(isPrimary&&typeof node.dateModified==='string')modified.push({value:node.dateModified,method:'primary-jsonld.dateModified',type:node['@type']||null});
    for(const child of Object.values(node))visit(child);
  }
  $('script[type="application/ld+json"]').each((_,e)=>{try{visit(JSON.parse($(e).text()));}catch{}});
  return {published,modified};
}

export function validateCapture(candidate,rawBody,harvestRow){
  const detail=candidate?.evidence;
  if(!detail||detail.httpStatus!==200||!validTimestamp(detail.accessedAt)||!Buffer.isBuffer(rawBody)
    ||hash(rawBody)!==detail.responseSha256||rawBody.length!==detail.documentBytes)
    throw new Error('article_body_proof_invalid');
  if(candidate.sourceId!==harvestRow.sourceId||canonicalUrl(candidate.source.url)?.href!==canonicalUrl(harvestRow.source.url)?.href
    ||candidate.publishedAt!==harvestRow.publishedAt||candidate.publicationDateStatus!=='explicit-in-publisher-listing')
    throw new Error('publisher_listing_identity_or_date_changed');
  const source=sources.get(candidate.sourceId);
  if(!source||source.discoveryEnabled===false||source.name!==candidate.source.name)throw new Error('source_not_active');
  const url=new URL(candidate.source.url),allowed=new Set([new URL(source.url).origin,...(source.articleOrigins||[])]);
  if(url.protocol!=='https:'||url.username||url.password||!allowed.has(url.origin)||detail.url!==url.href)
    throw new Error('article_origin_or_identity_invalid');
  if(detail.canonical&&canonicalUrl(new URL(detail.canonical,url).href)?.href!==canonicalUrl(url.href)?.href)
    throw new Error('primary_canonical_identity_mismatch');
  if(!detail.headline||!detail.text||detail.text.length<300||!validTimestamp(candidate.publishedAt))
    throw new Error('substantive_article_or_publisher_date_missing');
  const html=new TextDecoder(source.encoding||'utf-8').decode(rawBody),$=load(html);
  const bodyPrimaryDates=[...$('meta[property="article:published_time"],meta[name="date"],meta[itemprop="datePublished"]')]
    .map(e=>$(e).attr('content')).filter(Boolean);
  const author=$('meta[name="author"]').first().attr('content')||null;
  const structured=[];
  $('script[type="application/ld+json"]').each((_,e)=>{try{structured.push(JSON.parse($(e).text()));}catch{}});
  const dates=[],seen=new Set();
  function visit(value){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
    if(typeof value.startDate==='string')dates.push(value.startDate);for(const child of Object.values(value))visit(child);}
  structured.forEach(visit);
  return {source,author,bodyPrimaryDates,primaryDates:primaryDatesFromBody(rawBody,source,url.href),scheduledDates:dates,
    quoteContext:[candidate.title,detail.headline,detail.text,author].filter(Boolean).join('\n')};
}

export function publicationBasis(candidate,row,context){
  const detail=candidate.evidence;
  const rawDates=context.primaryDates?.published||[];
  if(rawDates.some(d=>/^\d{4}-\d{2}-\d{2}/u.test(d.value)&&d.value.slice(0,10)<'2026-09-25'))
    throw new Error('older_primary_publication_date');
  if(row.dateOnly){
    const visible=detail.text.match(/\bSeptember 30, 2026\b/u)?.[0];
    if(row.index!==122||row.publishedDate!=='2026-09-30'||!visible)throw new Error('visible_publication_date_unverified');
    return {method:'primary-visible-publisher-byline-date',value:row.publishedDate,visibleEvidence:visible,
      metadata:detail.publishedDates,precision:'date-only; primary visible calendar date retained without inferred timezone',limitation:row.dateBasis};
  }
  if(!validTimestamp(candidate.publishedAt)||candidate.publishedAt.slice(0,10)<'2026-09-25'
    ||candidate.publishedAt.slice(0,10)>'2026-10-02')throw new Error('publication_date_outside_review_slice');
  if(rawDates.some(d=>/^\d{4}-\d{2}-\d{2}/u.test(d.value)&&d.value.slice(0,10)!==candidate.publishedAt.slice(0,10)))
    throw new Error('primary_and_listing_publication_dates_disagree');
  // The listing is itself publisher-provided evidence, bound above to the fixed
  // harvest row. Agreeing primary article metadata is additional corroboration.
  const matching=(detail.publishedDates||[]).filter(d=>validTimestamp(d.value)
    &&Date.parse(d.value)===Date.parse(candidate.publishedAt));
  return {method:matching.length?'explicit-publisher-listing-and-matching-article-metadata':'explicit-publisher-listing',
    value:candidate.publishedAt,metadata:matching,primaryDateValues:context.bodyPrimaryDates,
    rawPrimaryPublicationDates:rawDates,rawPrimaryModificationDates:context.primaryDates?.modified||[],
    listingHarvestIndex:row.index,precision:'publisher-supplied timestamp; capture time is separate'};
}

export async function prepareBatch({input,harvest,current=new Date(),readDocument=readFile}){
  if(!Array.isArray(input)||input.length!==110)throw new Error('capture_slice_must_have_110_records');
  const byIndex=new Map(input.map(x=>[x.harvestIndex,x]));
  if(byIndex.size!==110||input.some(x=>x.harvestIndex<110||x.harvestIndex>219))throw new Error('capture_slice_identity_invalid');
  const preparedAt=current.toISOString(),records=[],evidence=[],held=[];
  for(const row of REVIEWED_ROWS){
    const candidate=byIndex.get(row.index),detail=candidate?.evidence;
    if(!detail?.localDocumentPath?.match(/^\.tmp\/news-expanded-b-20261002\/source-documents\/\d{3}\.bin$/u))
      throw new Error(`capture_document_path_invalid:${row.index}`);
    const bytes=await readDocument(new URL('../'+detail.localDocumentPath,import.meta.url));
    const context=validateCapture(candidate,bytes,harvest.freshDatedCandidates[row.index]);
    for(const quote of row.proofQuotes)if(!context.quoteContext.includes(quote))throw new Error(`proof_quote_not_grounded:${row.index}:${quote}`);
    if(row.scheduledEventDate&&!context.scheduledDates.some(d=>d.slice(0,10)===row.scheduledEventDate))
      throw new Error(`scheduled_event_date_not_grounded:${row.index}`);
    const basis=publicationBasis(candidate,row,context),publishedAt=basis.value,publicationDate=publishedAt.slice(0,10);
    const record={id:row.id,category:row.category,kind:'news',eventDate:publicationDate,publishedAt,
      verifiedAt:preparedAt,title:row.title,summary:row.summary,
      source:{...candidate.source,title:normalizeShortHyphens(detail.headline)},
      verification:'confirmed',region:candidate.region,eventKey:row.id};
    records.push(record);
    evidence.push({id:row.id,harvestIndex:row.index,sourceId:candidate.sourceId,url:candidate.source.url,
      httpStatus:200,accessedAt:detail.accessedAt,responseSha256:detail.responseSha256,documentBytes:detail.documentBytes,
      capturedHeadline:detail.headline,capturedHeadlineSha256:hash(detail.headline),capturedAuthor:context.author,
      extractionSelectors:detail.extractionSelectors||null,headlineMethod:detail.headlineMethod||'primary article headline extraction',
      facts:row.facts,proofQuotes:row.proofQuotes,sourcePublishedEvidence:basis,
      geography:{sourceCountryCodes:context.source.countryCodes||[],storyCountryCodes:row.countryCodes,
        basis:'Only countries established by the article’s named location, publishing territory, participant or work context. An empty story list retains uncertainty; source organisation geography is separate.'},
      review:{method:'agent_factual_and_bilingual_review_of_fetched_primary_article',reviewedAt:preparedAt,
        bodyRetrieved:true,bodyDigestCheckedAgainstFullBytes:true,quoteGroundingChecked:true,ruEnFactsReviewed:true,
        temporal:row.temporal,eventDateBasis:'Publication date of this new announcement, excerpt, interview, report or review. Past events and planned future actions are described separately.',
        ...(row.scheduledEventDate?{scheduledEventDate:row.scheduledEventDate,scheduledDateMethod:row.scheduledDateMethod,
          eventTimeCopied:false}:{}),
        limitation:row.limitation||'No book-release day or actual completion of a scheduled event is inferred from article publication or capture time.'},
      thumbnailCandidates:[...new Map((detail.images||[]).filter(x=>x.displayOnly&&x.url
        &&!/(?:logo|icon|avatar)/iu.test(x.url)).map(x=>[x.url,x])).values()].slice(0,2)
        .map(x=>({...x,socialReuseApproved:false,relevanceStatus:'article-metadata-proposal-requires-image-review',autoApply:false})),
    });
  }
  for(const [index,reason] of HELD_ROWS){
    const row=byIndex.get(index),bytes=await readDocument(new URL('../'+row.evidence.localDocumentPath,import.meta.url));
    if(hash(bytes)!==row.evidence.responseSha256||bytes.length!==row.evidence.documentBytes)throw new Error(`held_body_proof_invalid:${index}`);
    held.push({harvestIndex:index,sourceId:row.sourceId,url:row.source.url,listingPublishedAt:row.publishedAt,
      httpStatus:row.evidence.httpStatus,responseSha256:row.evidence.responseSha256,documentBytes:row.evidence.documentBytes,
      reason,reviewStatus:'held',publicationEligible:false});
  }
  return {schemaVersion:1,batchId,preparedAt,
    scope:`${records.length} individually reviewed RU/EN current literary news proposals from a fixed 110-article slice; ${held.length} held. No canonical mutation or publication.`,
    inputEvidence:{harvestFile:'reports/r10/publication/current-news-harvest-20261002.json',
      harvestSha256:hash(harvest),slice:{startInclusive:110,endExclusive:220},capturedArticles:110,bodyHTTP200:110,
      fullBodyDigestsChecked:110},records,recordSha256:hash(records),evidence,held,
    editorialSha256:hash({reviewed:REVIEWED_ROWS,held:HELD_ROWS})};
}

export function checkBatch(batch,existing,current=new Date()){
  if(batch.batchId!==batchId||batch.records?.length!==REVIEWED_ROWS.length||batch.held?.length!==HELD_ROWS.length
    ||batch.recordSha256!==hash(batch.records)||batch.editorialSha256!==hash({reviewed:REVIEWED_ROWS,held:HELD_ROWS}))
    throw new Error('batch_integrity_invalid');
  const byId=new Map(batch.evidence.map(e=>[e.id,e])),urls=new Set(),ids=new Set();
  const canonicalUrls=new Map(existing.map(r=>[canonicalUrl(r.source?.url)?.href,r]).filter(([url])=>url));
  for(const record of batch.records){
    const row=REVIEWED_ROWS.find(r=>r.id===record.id),proof=byId.get(record.id),source=sources.get(proof?.sourceId);
    if(!row||!proof||proof.harvestIndex!==row.index||proof.httpStatus!==200||!validTimestamp(proof.accessedAt)
      ||!/^[a-f0-9]{64}$/u.test(proof.responseSha256||'')||proof.documentBytes<1||proof.documentBytes>2*1024*1024
      ||!source||source.discoveryEnabled===false||source.name!==record.source.name||proof.url!==record.source.url)
      throw new Error(`record_primary_evidence_invalid:${record.id}`);
    if(hash(proof.capturedHeadline)!==proof.capturedHeadlineSha256||hash(proof.proofQuotes)!==hash(row.proofQuotes)
      ||!proof.review.bodyDigestCheckedAgainstFullBytes||!proof.review.ruEnFactsReviewed)
      throw new Error(`literal_or_editorial_proof_invalid:${record.id}`);
    if(record.kind!=='news'||record.verification!=='confirmed'||record.eventKey!==row.id
      ||hash(record.title)!==hash(row.title)||hash(record.summary)!==hash(row.summary))throw new Error(`reviewed_editorial_changed:${record.id}`);
    for(const locale of ['ru','en'])if(record.title[locale].length>160||record.summary[locale].length<140
      ||record.summary[locale].length>440||/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/u.test(record.title[locale]+record.summary[locale]))
      throw new Error(`editorial_length_or_punctuation_invalid:${record.id}:${locale}`);
    if(proof.proofQuotes.length===0||proof.proofQuotes.reduce((n,q)=>n+q.trim().split(/\s+/u).length,0)>25)
      throw new Error(`proof_quote_budget_invalid:${record.id}`);
    if(proof.sourcePublishedEvidence.value!==record.publishedAt||(!validDate(record.publishedAt)&&!validTimestamp(record.publishedAt))
      ||record.publishedAt.slice(0,10)<'2026-09-25'||record.publishedAt.slice(0,10)>'2026-10-02')
      throw new Error(`publication_basis_invalid:${record.id}`);
    if((record.publishedAt===proof.accessedAt&&proof.sourcePublishedEvidence.method?.includes('capture'))
      ||!proof.sourcePublishedEvidence.method?.startsWith('explicit-publisher-')
        &&proof.sourcePublishedEvidence.method!=='primary-visible-publisher-byline-date')throw new Error('capture_time_is_not_publication_evidence');
    const url=canonicalUrl(record.source.url)?.href,prior=canonicalUrls.get(url);
    if(!url||urls.has(url)||ids.has(record.id))throw new Error(`batch_duplicate:${record.id}`);
    if(prior&&(prior.id!==record.id||hash(prior)!==hash(record)))throw new Error(`existing_source_url_duplicate:${record.id}`);
    urls.add(url);ids.add(record.id);
  }
  if(batch.held.some(row=>row.publicationEligible!==false||row.reviewStatus!=='held'
    ||batch.records.some(r=>canonicalUrl(r.source.url)?.href===canonicalUrl(row.url)?.href)))throw new Error('held_item_became_public');
  if(selectReviewed(batch.records,current,'Europe/Moscow').length!==batch.records.length)throw new Error('batch_not_currently_eligible');
  const merged=mergeReviewedBatch(existing,batch,{current});
  if(merged.held.length||merged.added.length+merged.unchanged.length!==batch.records.length)throw new Error('merge_preview_not_additive');
  return merged;
}

async function main(){
  const {values}=parseArgs({options:{'evidence-input':{type:'string'},check:{type:'boolean'}}});
  const current=new Date(),existingRaw=await readFile(canonicalFile,'utf8'),existing=JSON.parse(existingRaw);
  const batch=values['evidence-input']?await prepareBatch({input:JSON.parse(await readFile(values['evidence-input'],'utf8')),
    harvest:JSON.parse(await readFile(harvestFile,'utf8')),current}):JSON.parse(await readFile(reportFile,'utf8'));
  const merged=checkBatch(batch,existing,current);
  const receipt={batchId,checkedAt:current.toISOString(),writtenCanonical:false,remoteWrites:0,
    capturedArticles:110,bodyHTTP200:110,proposedReviewed:batch.records.length,held:batch.held.length,
    beforeReviewedCount:existing.length,proposedReviewedCount:merged.records.length,
    added:merged.added.length,unchanged:merged.unchanged.length,mergeHeld:merged.held,
    eligiblePublicBefore:selectReviewed(existing,current,'Europe/Moscow').length,
    eligiblePublicAfter:selectReviewed(merged.records,current,'Europe/Moscow').length,
    sourceIds:[...new Set(batch.evidence.map(e=>e.sourceId))],
    sourceCountryCodes:[...new Set(batch.evidence.flatMap(e=>e.geography.sourceCountryCodes))].sort(),
    storyCountryCodes:[...new Set(batch.evidence.flatMap(e=>e.geography.storyCountryCodes))].sort(),
    dateOnlyPublicationCount:batch.records.filter(r=>validDate(r.publishedAt)).length,
    explicitPublicationDateCount:batch.records.length,unknownPublicationDateCount:0,
    futureEventTimesInferred:0,proofQuoteWordsMax:Math.max(...batch.evidence.map(e=>e.proofQuotes.reduce((n,q)=>n+q.trim().split(/\s+/u).length,0))),
    summaryLengths:Object.fromEntries(['ru','en'].map(l=>[l,{min:Math.min(...batch.records.map(r=>r.summary[l].length)),max:Math.max(...batch.records.map(r=>r.summary[l].length))}])),
    canonicalBeforeSha256:hash(existingRaw),recordSha256:batch.recordSha256,
    duplicateCheck:'No canonical URL duplicates or repeated agent-reviewed event stages within this slice; cross-agent events coordinated separately.',
    limitations:['HTTP 200 gated articles remain held; article teasers are insufficient.',
      'Fresh source publication is distinguished from an older book or earlier event.',
      'Image metadata is a proposal only; relevance and social reuse have not been approved.',
      'The proposed total is reported honestly; 600-700 items are not claimed by this batch.']};
  if(values['evidence-input']&&!values.check){await mkdir(new URL('../reports/r10/publication/',import.meta.url),{recursive:true});
    await writeFile(reportFile,exactJson(batch));await writeFile(receiptFile,exactJson(receipt));
    const input=JSON.parse(await readFile(values['evidence-input'],'utf8')),audit=[];
    for(const row of input){const bytes=await readFile(new URL('../'+row.evidence.localDocumentPath,import.meta.url));
      const dates=primaryDatesFromBody(bytes,sources.get(row.sourceId),row.source.url),proposal=batch.evidence.find(e=>e.harvestIndex===row.harvestIndex);
      audit.push({harvestIndex:row.harvestIndex,sourceId:row.sourceId,url:row.source.url,httpStatus:200,responseSha256:row.evidence.responseSha256,
        listingPublishedAt:row.publishedAt,...dates,reviewStatus:proposal?'proposed':'held',
        olderPrimaryPublication:dates.published.filter(d=>/^\d{4}-\d{2}-\d{2}/u.test(d.value)&&d.value.slice(0,10)<'2026-09-25'),
        publicationPrecision:proposal?.sourcePublishedEvidence.precision||null,
        heldReason:batch.held.find(h=>h.harvestIndex===row.harvestIndex)?.reason||null});}
    await writeFile(dateAuditFile,exactJson({schemaVersion:1,batchId,checkedAt:current.toISOString(),
      capturedArticles:110,reviewedProposals:batch.records.length,held:batch.held.length,primaryDateBodiesChecked:110,
      earlierPrimaryPublicationAmongProposals:audit.filter(r=>r.reviewStatus==='proposed'&&r.olderPrimaryPublication.length).length,
      visibleDateException:[{harvestIndex:122,visiblePublisherDate:'2026-09-30',machineTimestamp:'2026-10-01T00:22:56+00:00',
        resolution:'Retain the visible calendar date; no timezone is inferred.'}],articles:audit}));}
  if(hash(await readFile(canonicalFile,'utf8'))!==hash(existingRaw))throw new Error('canonical_changed_during_preparation');
  console.log(JSON.stringify(receipt));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
