// Independent C source acquisition and review proposal. No canonical/remote writes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
import {boundedFetch} from './research-literary-news-sources.mjs';
import {extractDailyNewsDetail,dailyNewsIntakePool} from './lib/literary-news-daily-intake.mjs';
import {LITERARY_NEWS_SOURCES} from './lib/literary-news-sources.mjs';
import {canonicalUrl,validTimestamp,validDate,selectReviewed,CATEGORIES} from './lib/literary-news-reviewed.mjs';
import {mergeReviewedBatch} from './apply-literary-news-batch.mjs';
import {normalizeShortHyphens} from './lib/short-hyphens.mjs';
import {C_EDITORIAL_ROWS} from './news-expanded-c-editorial-20261002.mjs';

const directory='.tmp/news-expanded-c-20261002';
const harvest=JSON.parse(await readFile('reports/r10/publication/current-news-harvest-20261002.json','utf8'));
const candidates=[...harvest.freshDatedCandidates.slice(220,264).map((row,index)=>({...row,harvestIndex:index+220,harvestGroup:'freshDatedCandidates'})),
  ...harvest.needsPublicationVerification.map((row,index)=>({...row,harvestIndex:index+264,harvestGroup:'needsPublicationVerification',undatedIndex:index}))];
const sources=new Map(LITERARY_NEWS_SOURCES.map(source=>[source.id,source]));
const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const plain=text=>String(text||'').replace(/\s+/gu,' ').trim();
const output='reports/r10/publication/news-expanded-c-20261002.json';
const canonical='data/news/reviewed.json';
const exactJson=value=>JSON.stringify(value,null,2).replace(/[\u2010-\u2015]/gu,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))+'\n';
const reviewedRedirects=new Map([[346,'https://www.minimumfax.com/event/vito-bruno-a-napoli-2026-10-03-2143/register']]);

function captureContext(candidate,bytes){
  const d=candidate.evidence,s=sources.get(candidate.sourceId);
  if(!d||d.httpStatus!==200||!s||s.discoveryEnabled===false||bytes.length!==d.documentBytes
    ||hash(bytes)!==d.responseSha256||bytes.length>2*1024*1024||!validTimestamp(d.accessedAt))throw Error('capture_digest_invalid:'+candidate.harvestIndex);
  const expected=candidates.find(c=>c.harvestIndex===candidate.harvestIndex);
  if(!expected||canonicalUrl(expected.source.url)?.href!==canonicalUrl(candidate.source.url)?.href
    ||expected.sourceId!==candidate.sourceId||expected.publishedAt!==candidate.publishedAt)throw Error('harvest_identity_changed');
  const approved=new Set([new URL(s.url).hostname,...(s.articleOrigins||[]).map(u=>new URL(u).hostname)]);
  const finalUrl=canonicalUrl(d.url)?.href,requestedUrl=canonicalUrl(candidate.source.url)?.href;
  if(!approved.has(new URL(d.url).hostname)||!finalUrl||!requestedUrl
    ||finalUrl.replace(/\/$/u,'')!==requestedUrl.replace(/\/$/u,'')&&reviewedRedirects.get(candidate.harvestIndex)!==finalUrl)
    throw Error('capture_origin_invalid:'+candidate.harvestIndex);
  const html=new TextDecoder(s.encoding||'utf-8').decode(bytes),$=load(html);
  $('script,style,noscript,template,svg,form,nav,footer,header,aside').remove();
  $('p,li,h1,h2,h3,h4,blockquote,br').append('\n');
  const main=$('main').first();
  const documentText=plain((main.length?main:$.root()).text());
  return {source:s,html,$,documentText};
}

export function cPublicationBasis(candidate,row,context){
  if(row.publishedDate){
    if(!validDate(row.publishedDate)||!row.dateQuote||!context.documentText.includes(row.dateQuote))throw Error('primary_publication_header_not_grounded:'+row.i);
    return {method:'primary-visible-publisher-publication-date',value:row.publishedDate,visibleEvidence:row.dateQuote,
      metadata:candidate.evidence.publishedDates||[],precision:'date-only; no time or timezone inferred',
      finding:row.facts[0]};
  }
  const dates=(candidate.evidence.publishedDates||[]).filter(d=>validTimestamp(d.value));
  if(dates.length){
    const days=new Set(dates.map(d=>new Date(d.value).toISOString().slice(0,10)));
    if(days.size!==1)throw Error('article_publication_metadata_conflict:'+row.i);
    // An exact article timestamp has precedence over a refreshed publisher-feed entry.
    const value=new Date(dates[0].value).toISOString();
    return {method:'explicit-primary-article-publication-metadata',value,metadata:dates,
      publisherListingValue:candidate.publishedAt||null,precision:'publisher-supplied timestamp'};
  }
  if(!validTimestamp(candidate.publishedAt)||candidate.publicationDateStatus!=='explicit-in-publisher-listing')throw Error('publication_date_unverified:'+row.i);
  const listing=harvest.listingResponses.find(r=>r.url===(context.source.feedUrl||context.source.url));
  if(!listing||listing.httpStatus!==200||!validTimestamp(listing.accessedAt)||!/^[a-f0-9]{64}$/u.test(listing.responseSha256||''))
    throw Error('publisher_listing_proof_missing:'+row.i);
  return {method:'explicit-publisher-listing',value:candidate.publishedAt,listing,
    listingHarvestIndex:row.i,precision:'publisher-supplied feed timestamp; article retrieval is separate'};
}

function heldReason(row){
  const i=row.harvestIndex;
  if(i===225)return 'Cross-batch semantic duplicate of B’s Tatiana Ţîbuleac interview: Mila, father and family memory; no additional news stage.';
  if(i===239)return 'Cross-batch semantic duplicate of B’s Gabriel Zaid anthology review: same book and35source languages; no additional news stage.';
  if(row.error)return 'Original article not retrieved: '+row.error;
  if(row.sourceId==='booker-new-media')return 'Publisher article is paywalled; HTTP200 teaser and navigation are insufficient full-article evidence.';
  if([231,233,235,243,249,251,255,259,263,293,294,299,300,304,334].includes(i))return 'No sufficiently focused new literary stage; visual-art, administrative or general political material held.';
  if([270,282,285,303,305].includes(i))return 'Directory or evergreen institutional page; not an independently dated literary news stage.';
  if([261].includes(i))return 'Article extraction contains no substantive prose.';
  if(i===252)return 'Generic podcast page duplicates the specifically announced episode; no separate stage.';
  if([265,273,274,275,278,279,280,281,283,287,288,289,292,298,307,309,311,312,313,321,322,324,325,326,327,331,332,333,335,336,337,338,340,341,344,345,347,348,349,276].includes(i))
    return 'Primary publication predates the September24 current-review window; retain for separately reviewed backfill when relevant.';
  if([314,329].includes(i))return 'HTTP200 provides only a gated summary, insufficient full substantive article retrieval.';
  if(i===317)return 'Only title/date and an image-led announcement were retrieved; substantive facts not established.';
  return 'No verified publisher publication day or sufficiently distinct dated literary stage; event day/capture time never substitute for publication.';
}

export async function buildC(input,{current=new Date(),readDocument=readFile}={}){
  if(!Array.isArray(input)||input.length!==130||new Set(input.map(r=>r.harvestIndex)).size!==130)throw Error('C_partition_invalid');
  const records=[],evidence=[],held=[],preparedAt=current.toISOString(),accepted=new Map(C_EDITORIAL_ROWS.map(r=>[r.i,r]));
  for(const candidate of input){
    const row=accepted.get(candidate.harvestIndex),d=candidate.evidence;
    if(!d){if(row)throw Error('reviewed_article_unavailable');held.push({harvestIndex:candidate.harvestIndex,sourceId:candidate.sourceId,url:candidate.source.url,
      reason:heldReason(candidate),reviewStatus:'held',publicationEligible:false});continue;}
    if(!/^\.tmp\/news-expanded-c-20261002\/source-documents\/\d{3}\.bin$/u.test(d.localDocumentPath||''))throw Error('source_document_path_invalid');
    const bytes=await readDocument(d.localDocumentPath),context=captureContext(candidate,bytes);
    if(!row){held.push({harvestIndex:candidate.harvestIndex,sourceId:candidate.sourceId,url:candidate.source.url,httpStatus:200,
      accessedAt:d.accessedAt,responseSha256:d.responseSha256,documentBytes:d.documentBytes,
      listingPublishedAt:candidate.publishedAt||null,articlePublicationMetadata:d.publishedDates||[],
      reason:heldReason(candidate),reviewStatus:'held',publicationEligible:false});continue;}
    const scoped=row.selector?context.$(row.selector).first():null;
    if(row.selector&&(!scoped.length||plain(scoped.text()).length<200))throw Error('reviewed_primary_scope_missing:'+row.i);
    const text=row.selector?plain(scoped.text()):d.text;
    const quoteContext=[text,d.headline,context.documentText].join('\n');
    if(row.quotes.some(q=>!quoteContext.includes(q)))throw Error('quote_not_grounded:'+row.i+':'+row.quotes.filter(q=>!quoteContext.includes(q)).join('|'));
    const basis=cPublicationBasis(candidate,row,context);
    const record={id:'r10-news-c-'+row.slug+'-20261002',category:row.category,kind:'news',eventDate:basis.value.slice(0,10),
      publishedAt:basis.value,verifiedAt:preparedAt,title:{ru:normalizeShortHyphens(row.title.ru),en:normalizeShortHyphens(row.title.en)},
      summary:{ru:normalizeShortHyphens(row.summary.ru),en:normalizeShortHyphens(row.summary.en)},
      source:{name:context.source.name,url:candidate.source.url,language:d.language||candidate.source.language,
        title:normalizeShortHyphens(d.headline)},verification:'confirmed',region:candidate.region,eventKey:'r10-news-c-'+row.slug+'-20261002'};
    records.push(record);
    evidence.push({id:record.id,harvestIndex:row.i,harvestGroup:candidate.harvestGroup,sourceId:candidate.sourceId,url:candidate.source.url,
      httpStatus:200,accessedAt:d.accessedAt,responseSha256:d.responseSha256,documentBytes:d.documentBytes,
      localSourceDocument:d.localDocumentPath,capturedHeadline:d.headline,capturedHeadlineSha256:hash(d.headline),
      sourcePublishedEvidence:basis,proofQuotes:row.quotes,facts:row.facts,
      extraction:{sourceProfileHeadlineSelector:context.source.detailHeadlineSelector||null,
        sourceProfileBodySelector:context.source.detailTextSelector||null,reviewedLocalBodySelector:row.selector||null,
        reviewedBodySha256:hash(text),reviewedBodyCharacters:text.length},
      geography:{sourceCountryCodes:context.source.countryCodes||[],basis:'Source organisation geography is retained separately from story geography.'},
      review:{method:'agent_factual_and_bilingual_review_of_fetched_primary_article',reviewedAt:preparedAt,
        bodyRetrieved:true,bodyDigestCheckedAgainstFullBytes:true,quoteGroundingChecked:true,ruEnFactsReviewed:true,
        publicationTimeFromCapture:false,temporal:'new-publisher-announcement-interview-excerpt-review-or-report',
        eventDateBasis:'Publication date of this new item; the book’s original year and planned event dates remain separate.',
        scheduledEventDate:row.scheduledDate||null,scheduledEventCompletionClaimed:false,
        limitation:row.i===260?'Death announcement dated by article publication; no exact death day inferred.':'No book-release day or event completion inferred from publication or acquisition time.'},
      thumbnailCandidates:(d.images||[]).filter(x=>x.displayOnly&&!/(?:logo|icon|avatar)/iu.test(x.url)).slice(0,2)
        .map(x=>({...x,socialReuseApproved:false,relevanceStatus:'article-metadata-proposal-requires-image-review',autoApply:false}))});
  }
  return {schemaVersion:1,batchId:'news-expanded-c-20261002',preparedAt,
    scope:`${records.length} individually reviewed proposals from 44 dated and 86 undated discovery entries; no canonical mutation or publication.`,
    inputEvidence:{harvestFile:'reports/r10/publication/current-news-harvest-20261002.json',harvestSha256:hash(harvest),
      slice:{freshDatedStartInclusive:220,freshDatedEndExclusive:264,needsPublicationVerification:'all86'},
      capturedArticles:130,bodyHTTP200:129,fullBodyDigestsChecked:129},
    records,recordSha256:hash(records),evidence,held,editorialSha256:hash(C_EDITORIAL_ROWS)};
}

export function checkC(batch,existing,current=new Date()){
  if(batch.records.length!==C_EDITORIAL_ROWS.length||batch.evidence.length!==batch.records.length||batch.held.length+batch.records.length!==130
    ||batch.recordSha256!==hash(batch.records)||batch.editorialSha256!==hash(C_EDITORIAL_ROWS))throw Error('C_batch_integrity_invalid');
  const prior=new Map(existing.map(r=>[canonicalUrl(r.source?.url)?.href,r])),urls=new Set(),ids=new Set();
  for(const record of batch.records){
    const proof=batch.evidence.find(p=>p.id===record.id),row=C_EDITORIAL_ROWS.find(r=>r.i===proof?.harvestIndex),source=sources.get(proof?.sourceId);
    if(!proof||!row||!source||source.name!==record.source.name||proof.httpStatus!==200||!validTimestamp(proof.accessedAt)
      ||!/^[a-f0-9]{64}$/u.test(proof.responseSha256)||proof.documentBytes<1||proof.documentBytes>2*1024*1024
      ||proof.sourcePublishedEvidence.value!==record.publishedAt||!CATEGORIES.has(record.category)
      ||!proof.review.bodyDigestCheckedAgainstFullBytes||!proof.review.ruEnFactsReviewed||proof.review.publicationTimeFromCapture)
      throw Error('C_primary_proof_invalid:'+record.id);
    const expectedTitle=Object.fromEntries(['ru','en'].map(l=>[l,normalizeShortHyphens(row.title[l])]));
    const expectedSummary=Object.fromEntries(['ru','en'].map(l=>[l,normalizeShortHyphens(row.summary[l])]));
    if(hash(record.title)!==hash(expectedTitle)||hash(record.summary)!==hash(expectedSummary)
      ||hash(proof.proofQuotes)!==hash(row.quotes)||hash(proof.facts)!==hash(row.facts)
      ||record.category!==row.category||record.kind!=='news'||record.verification!=='confirmed'
      ||record.id!=='r10-news-c-'+row.slug+'-20261002'||record.eventKey!==record.id
      ||hash(proof.capturedHeadline)!==proof.capturedHeadlineSha256)throw Error('C_reviewed_editorial_changed:'+record.id);
    if(!validDate(record.publishedAt)&&!validTimestamp(record.publishedAt)||record.publishedAt.slice(0,10)<'2026-09-24'
      ||record.publishedAt.slice(0,10)>'2026-10-02')throw Error('C_publication_day_invalid:'+record.id);
    for(const l of ['ru','en'])if(record.title[l].length>160||record.summary[l].length<140||record.summary[l].length>440
      ||/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/u.test(record.title[l]+record.summary[l]))throw Error('C_editorial_length_invalid:'+record.id+':'+l);
    if(!proof.proofQuotes.length||proof.proofQuotes.reduce((n,q)=>n+q.split(/\s+/u).length,0)>25)throw Error('C_quote_budget_exceeded:'+record.id);
    const url=canonicalUrl(record.source.url)?.href;
    if(!url||urls.has(url)||ids.has(record.id))throw Error('C_internal_duplicate');
    if(prior.has(url)&&prior.get(url).id!==record.id)throw Error('C_existing_url_duplicate:'+record.id);
    urls.add(url);ids.add(record.id);
  }
  if(batch.held.some(r=>r.publicationEligible!==false||r.reviewStatus!=='held'))throw Error('C_held_became_public');
  if(selectReviewed(batch.records,current,'Europe/Moscow').length!==batch.records.length)throw Error('C_proposals_not_currently_eligible');
  const preview=mergeReviewedBatch(existing,batch,{current});
  if(preview.held.length||preview.added.length+preview.unchanged.length!==batch.records.length)throw Error('C_merge_not_additive');
  return preview;
}

if(process.argv.includes('--build')||process.argv.includes('--check')){
  const before=await readFile(canonical,'utf8'),existing=JSON.parse(before),current=new Date();
  const batch=process.argv.includes('--build')?await buildC(JSON.parse(await readFile(directory+'/details.json','utf8')),{current}):JSON.parse(await readFile(output,'utf8'));
  const preview=checkC(batch,existing,current);
  const receipt={batchId:batch.batchId,checkedAt:current.toISOString(),writtenCanonical:false,remoteWrites:0,
    capturedArticles:130,bodyHTTP200:129,proposedReviewed:batch.records.length,held:batch.held.length,
    beforeReviewedCount:existing.length,proposedReviewedCount:preview.records.length,added:preview.added.length,
    mergeHeld:preview.held,eligiblePublicAfter:selectReviewed(preview.records,current,'Europe/Moscow').length,
    sourceIds:[...new Set(batch.evidence.map(e=>e.sourceId))],dateOnlyPublicationCount:batch.records.filter(r=>validDate(r.publishedAt)).length,
    sourceCountryCodes:[...new Set(batch.evidence.flatMap(e=>e.geography.sourceCountryCodes))].sort(),
    canonicalBeforeSha256:hash(before),recordSha256:batch.recordSha256,
    limitations:[`C contains ${batch.records.length} reviewed items; its original target was approximately100.`,
      'HTTP 200 gated teasers remain held.','Two additional semantic duplicates were held after cross-batch review.','Image metadata has not been approved for social reuse.',
      'September backfill and undated calendars remain separate; acquisition time is never a publication date.']};
  if(process.argv.includes('--build')){await mkdir('reports/r10/publication',{recursive:true});await writeFile(output,exactJson(batch));
    await writeFile(output.replace('.json','-review-preview.json'),exactJson(receipt));}
  if(hash(await readFile(canonical,'utf8'))!==hash(before))throw Error('canonical_changed_during_C_preparation');
  console.log(JSON.stringify(receipt));
}
if(process.argv.includes('--collect')){
  await mkdir(directory+'/source-documents',{recursive:true});let completed=0;
  const details=await dailyNewsIntakePool(candidates,async candidate=>{
    const source=sources.get(candidate.sourceId),localDocumentPath=`${directory}/source-documents/${candidate.harvestIndex}.bin`;
    try{
      if(!source||source.discoveryEnabled===false)throw Error('source_inactive');
      const allowedHosts=new Set([new URL(source.url).hostname,...(source.articleOrigins||[]).map(url=>new URL(url).hostname)]);
      if(!allowedHosts.has(new URL(candidate.source.url).hostname))throw Error('source_origin_unapproved');
      const response=await boundedFetch(candidate.source.url,{timeout:20000,maxBytes:2*1024*1024,allowedHosts,includeBytes:true,encoding:source.encoding});
      if(response.status!==200)throw Error('article_http_'+response.status);
      await writeFile(localDocumentPath,response.rawBytes);
      const evidence=extractDailyNewsDetail(response.text,response.url,source);
      return {...candidate,source:{...candidate.source,name:source.name},evidence:{...evidence,url:response.url,httpStatus:200,
        accessedAt:response.accessedAt,responseSha256:response.sha256,documentBytes:response.bytes,localDocumentPath}};
    }catch(error){return {...candidate,evidence:null,error:error.message};}
    finally{completed++;if(completed%20===0)console.log(JSON.stringify({completed,total:candidates.length}));}
  });
  await writeFile(directory+'/details.json',JSON.stringify(details,null,2)+'\n');
  console.log(JSON.stringify({total:details.length,http200:details.filter(row=>row.evidence).length,failures:details.filter(row=>!row.evidence).map(row=>({i:row.harvestIndex,error:row.error}))}));
}
