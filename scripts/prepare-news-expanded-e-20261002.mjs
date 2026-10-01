// Agent/source-reviewed proposal for September pool indexes120..239. No canonical or remote writes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {load} from 'cheerio';
import {mergeReviewedBatch} from './apply-literary-news-batch.mjs';
import {selectReviewed,canonicalUrl,validTimestamp,validDate} from './lib/literary-news-reviewed.mjs';
import {normalizeShortHyphens} from './lib/short-hyphens.mjs';
import {LITERARY_NEWS_SOURCES} from './lib/literary-news-sources.mjs';
import { rows } from './lib/news-expanded-e-editorial-20261002.mjs';
const batchId='news-expanded-e-20261002';
const reportFile=new URL(`../reports/r10/publication/${batchId}.json`,import.meta.url);
const receiptFile=new URL(`../reports/r10/publication/${batchId}-review-preview.json`,import.meta.url);
const hash=value=>createHash('sha256').update(Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const serialize=value=>JSON.stringify(value,null,2).replaceAll('\u2013','\\u2013').replaceAll('\u2014','\\u2014')+'\n';
const countryCodes={121:['AU'],123:['GB'],125:['US'],127:['ES'],128:['ZA'],132:['MD','BG','LV','LT','PL','RO'],134:['UA'],136:['ES'],140:['AT','DE'],144:['IN'],147:['US','GT'],148:['GB','NL'],149:['US','IT'],150:['US'],151:['US'],156:['MD','RO','FR'],160:['IE','GB'],161:['AT','DE'],163:['FR','IT','RO'],165:['US'],168:['AU'],170:['GB'],172:['US'],175:['ZA'],177:['MD','RO'],180:['IE'],181:['AT'],182:['IT','GB'],183:['FR','DE'],185:['US','CZ'],186:['IN','FR','US'],190:['GB'],192:['US'],194:['ES'],195:['ZA'],197:['IE','US'],199:['AT','SE'],200:['IT','NL'],201:['FR'],206:['AU'],207:['US'],208:['GB','IE'],209:['US'],210:['US'],212:['ZA'],220:['US'],228:['LT'],231:['US','IN'],234:['US','NI','PR'],235:['LT','NO'],236:['FR','DZ','MA'],238:['FR','BE'],239:['US','GB']};
const heldReasons={
 120:'Secondary reprint of a review; distinct publication stage unverified',122:'Photography scholarship outside selected literary-news scope',124:'Development interview without a distinct literary publication or event',126:'Visual-art and AI commentary outside selected literary-news scope',130:'Single catalogue recommendation without a verified new edition',133:'Original body unavailable; HTTP200notestablished',135:'Legal/political advocacy outside selected literary-news scope',137:'Historical literary comparison without a verified current stage',142:'Journal retrospective describing2025rather than a verified new issue',145:'Secondary reprint of a review; distinct current stage unverified',146:'Award stage ambiguous: still running and forthcoming-shortlist language conflict',153:'Generic author biography repeats the same book edition as128',154:'Single catalogue recommendation without a verified new edition',155:'General database guide; actual new literary resource unverified',157:'General bibliometrics platform announcement outside literary-event scope',158:'General social-platform article outside literary-event scope',159:'General education opinion without a distinct new literary-news stage',162:'General critical essay without a new publication or event stage',166:'Very short press-release shell; substantive book facts absent',167:'Secondary reprint of a review; distinct current stage unverified',169:'Disaster-research article outside selected literary-news scope',173:'Political/war essay outside selected literary-news scope',178:'Visual-art collection article outside selected literary-news scope',179:'General philosophical opinion without a distinct new literary-news stage',187:'Secondary reprint of a review; distinct current stage unverified',188:'Evergreen literary travel guide; new event stage unverified',191:'Second poem in the same author/issue cycle; avoid inflating the selected publication stage',193:'Political/policy interview outside selected literary-news scope',196:'Music/visual-art workshops without a distinct literary programme',198:'Publisher-localSeptember25outside thisSeptember1\u201324slice; general historical/political essay',204:'Evergreen nutrition guide outside selected literary-news scope',205:'Secondary review reprint with historical2006wording; date/stage unverified',211:'War/political memorial outside selected literary-news scope',213:'Short weekly bibliography notice; specific book facts insufficient',216:'War/political feature outside selected literary-news scope',217:'Architecture/heritage panel without a dominant literary programme',218:'General comparative arts opinion without a distinct current literary event',219:'Same Gdańskfair programme stage as215; industry debate not counted separately',222:'Visual-art and music feature outside selected literary-news scope',223:'Third poem in the same author/issue cycle; avoid inflating the selected publication stage',224:'Music-history commemoration outside selected literary-news scope',225:'General retrospective opinion without a new book or literary event',229:'Secondary reprint of another review; distinct original publication stage unverified',230:'Fan playlist promotion; no distinct book/cover publication stage established',232:'Short weekly bibliography notice; specific book facts insufficient',233:'Publisher-localSeptember25outside thisSeptember1\u201324archive slice',237:'Evergreen reading list without a distinct dated news stage'
};

function publicationBasis(input,r,listingProof){
  const metadata=(input.evidence.publishedDates||[]).filter(d=>validTimestamp(d.value)||validDate(d.value));
  const primary=metadata.find(d=>d.method?.startsWith('meta['))||metadata[0];
  const publicationDay=r.publishedDate||primary?.value.slice(0,10)||input.publishedAt?.slice(0,10);
  if(!validDate(publicationDay)||publicationDay<'2026-09-01'||publicationDay>'2026-09-24')throw new Error(`publication_day_invalid:${r.i}`);
  if(!validTimestamp(input.publishedAt)||input.publicationDateStatus!=='explicit-in-publisher-listing'
    ||!listingProof||!/^[a-f0-9]{64}$/u.test(listingProof.responseSha256||''))throw new Error(`publisher_listing_date_unverified:${r.i}`);
  const precise=!r.dateOnly&&primary&&validTimestamp(primary.value);
  return {method:precise?'explicit-original-article-publication-metadata':'explicit-publisher-calendar-date',
    value:precise?primary.value:publicationDay,precision:precise?'timestamp-with-source-offset':'date-only; no time or timezone inferred',
    articleMetadata:metadata,publisherListingPublishedAt:input.publishedAt,
    publisherListingResponseSha256:listingProof.responseSha256,
    visibleDateBasis:r.publishedDate?'Explicit visible publisher calendar date reviewed against the article body.':
      metadata.length?'Original article metadata corroborates the publisher listing date.':'The verified publisher listing supplies its explicit publication date; body dates refer separately to the event.',
    captureTimeUsedAsPublication:false};
}

export function checkBatch(batch,existing,current=new Date()){
  if(batch.records?.length!==rows.length||batch.evidence?.length!==rows.length||batch.recordSha256!==hash(batch.records))throw new Error('batch_integrity_invalid');
  const byUrl=new Map(existing.map(r=>[canonicalUrl(r.source?.url)?.href,r])),incoming=new Set();
  const proof=new Map(batch.evidence.map(p=>[p.id,p]));
  for(const record of batch.records){
    const url=canonicalUrl(record.source.url)?.href, prior=byUrl.get(url),e=proof.get(record.id);
    if(!url||incoming.has(url)||prior&&(prior.id!==record.id||hash(prior)!==hash(record)))throw new Error(`source_url_duplicate:${record.id}`);
    incoming.add(url);
    for(const locale of ['ru','en'])if(record.title[locale].length>160||record.summary[locale].length<250||record.summary[locale].length>440
      ||normalizeShortHyphens(record.title[locale])!==record.title[locale]||normalizeShortHyphens(record.summary[locale])!==record.summary[locale])throw new Error(`editorial_prose_invalid:${record.id}:${locale}`);
    const source=LITERARY_NEWS_SOURCES.find(s=>s.id===e?.sourceId);
    if(!source||source.discoveryEnabled===false||source.name!==record.source.name||e.httpStatus!==200||!e.review.bodyRetrieved
      ||!e.retainedLocalInput||!/^[a-f0-9]{64}$/u.test(e.responseSha256||'')||e.sourcePublishedEvidence.value!==record.publishedAt
      ||e.sourcePublishedEvidence.captureTimeUsedAsPublication!==false)throw new Error(`source_evidence_invalid:${record.id}`);
    const q=e.proofQuotes||[];
    if(!q.length||q.reduce((n,v)=>n+v.trim().split(/\s+/u).length,0)>25)throw new Error(`proof_quote_budget_invalid:${record.id}`);
    if(!validDate(record.publishedAt)&&!validTimestamp(record.publishedAt)||record.publishedAt.slice(0,10)<'2026-09-01'
      ||record.publishedAt.slice(0,10)>'2026-09-24')throw new Error(`publication_date_invalid:${record.id}`);
  }
  if(selectReviewed(batch.records,current,'Europe/Moscow').length!==batch.records.length)throw new Error('batch_not_currently_eligible');
  const merged=mergeReviewedBatch(existing,batch,{current});
  if(merged.added.length+merged.unchanged.length!==rows.length||merged.held.length)throw new Error('batch_merge_not_additive');
  return merged;
}

export async function prepareBatch({input,harvest,current=new Date()}){
  const records=[],evidence=[],preparedAt=current.toISOString();
  const listing=new Map(harvest.parentListingResponses.map(r=>[r.url,r]));
  for(const r of rows){
    const sourceRow=input[r.i],detail=sourceRow?.evidence,source=LITERARY_NEWS_SOURCES.find(s=>s.id===sourceRow?.sourceId);
    if(sourceRow?.septemberIndex!==r.i||!source||source.discoveryEnabled===false||detail?.httpStatus!==200||detail.text.length<(r.minimumBodyCharacters||400)
      ||!validTimestamp(detail.accessedAt)||!/^[a-f0-9]{64}$/u.test(detail.responseSha256||''))throw new Error(`article_response_unverified:${r.i}`);
    const document=await readFile(new URL(`../${detail.localDocumentPath}`,import.meta.url));
    if(document.length!==detail.documentBytes||hash(document)!==detail.responseSha256)throw new Error(`retained_document_digest_mismatch:${r.i}`);
    const $=load(document.toString('utf8'));
    const authorEvidence=r.authorProof?(r.authorProof.attribute?$(r.authorProof.selector).first().attr(r.authorProof.attribute):$(r.authorProof.selector).first().text()):null;
    if(r.authorProof&&!authorEvidence?.includes(r.authorProof.quote))throw new Error(`author_metadata_not_grounded:${r.i}`);
    const corpus=`${sourceRow.title}\n${detail.headline}\n${detail.text}`;
    for(const quote of r.quotes)if(!corpus.includes(quote))throw new Error(`proof_quote_not_grounded:${r.i}:${quote}`);
    const basis=publicationBasis(sourceRow,r,listing.get(source.url)),day=basis.value.slice(0,10);
    const id=`${r.slug}-${day.replaceAll('-','')}`;
    const record={id,category:r.category,kind:'news',eventDate:r.eventDate||day,publishedAt:basis.value,verifiedAt:preparedAt,
      title:Object.fromEntries(['ru','en'].map(l=>[l,normalizeShortHyphens(r.title[l])])),
      summary:Object.fromEntries(['ru','en'].map(l=>[l,normalizeShortHyphens(r.summary[l])])),
      source:{...sourceRow.source,title:normalizeShortHyphens(sourceRow.title)},verification:'confirmed',region:sourceRow.region,eventKey:id};
    records.push(record);evidence.push({id,septemberIndex:r.i,sourceId:source.id,url:sourceRow.source.url,httpStatus:200,
      accessedAt:detail.accessedAt,responseSha256:detail.responseSha256,documentBytes:document.length,retainedLocalInput:detail.localDocumentPath,
      facts:r.facts,proofQuotes:r.authorProof?[...r.quotes,r.authorProof.quote]:r.quotes,sourcePublishedEvidence:basis,
      authorMetadataEvidence:r.authorProof?{...r.authorProof,value:authorEvidence}:null,
      sourceHeadlineEvidence:{method:'verified-publisher-listing-title-corroborated-by-retained-original',value:sourceRow.title,capturedBodyHeadline:detail.headline,limitation:sourceRow.title!==detail.headline?'Page-level headline differs; source display title uses the actual publisher listing and checked original metadata/article heading.':null},
      geography:{sourceCountryCodes:source.countryCodes||[],storyCountryCodes:countryCodes[r.i]||source.countryCodes||[],
        basis:'Countries of explicitly discussed organisations, settings, events, participant origins or publishing territories; source-host countries are reported separately.'},
      review:{method:'agent_factual_and_bilingual_review_of_complete_captured_article',reviewedAt:preparedAt,
        temporal:r.temporal||'new-source-publication',eventDateBasis:r.eventDate?'Explicit completed event date in the article.':'Publication date of this announcement, review, interview, selection or report; Elapsed planned actions are explicitly attributed to the dated notice; future actions retain future tense.',
        limitation:r.limitation||'No exact release day or event time is inferred when the original article does not state it.',
        bodyRetrieved:true,quoteGroundingChecked:true,ruEnFactsReviewed:true,retainedDocumentDigestChecked:true},
      thumbnailCandidates:[],
    });
  }
  return {schemaVersion:1,batchId,preparedAt,scope:`Propose ${records.length} genuinely new literary article/event stages from September pool indexes120..239 after independent root review; no canonical or remote writes.`,
    records,recordSha256:hash(records),evidence,
    held:input.filter(r=>r.septemberIndex>=120&&r.septemberIndex<=239&&!rows.some(q=>q.i===r.septemberIndex)).map(r=>({septemberIndex:r.septemberIndex,sourceId:r.sourceId,url:r.source.url,
      reason:heldReasons[r.septemberIndex]||'Insufficient verified facts for admission',httpStatus:r.evidence?.httpStatus||null,
      responseSha256:r.evidence?.responseSha256||null,retainedLocalInput:r.evidence?.localDocumentPath||null})),
    actions:{canonicalWritten:false,remoteWrites:0,socialSends:0,providerApiCalls:0,publicationEnabledChanged:false},
  };
}

async function main(){
  const {values}=parseArgs({options:{'evidence-input':{type:'string'},check:{type:'boolean'}}});
  const current=new Date(),raw=await readFile(new URL('../data/news/reviewed.json',import.meta.url),'utf8'),existing=JSON.parse(raw);
  const batch=values['evidence-input']?await prepareBatch({input:JSON.parse(await readFile(values['evidence-input'],'utf8')),
    harvest:JSON.parse(await readFile(new URL('../reports/r10/publication/september-news-candidate-pool-20261002.json',import.meta.url),'utf8')),current})
    :JSON.parse(await readFile(reportFile,'utf8'));
  const merged=checkBatch(batch,existing,current);
  const receipt={batchId,checkedAt:current.toISOString(),writtenCanonical:false,remoteWrites:0,beforeReviewedCount:existing.length,
    proposedReviewedCount:merged.records.length,added:merged.added.length,unchanged:merged.unchanged.length,heldCandidates:batch.held.length,
    eligiblePublicBefore:selectReviewed(existing,current,'Europe/Moscow').length,eligiblePublicAfter:selectReviewed(merged.records,current,'Europe/Moscow').length,
    sourceCount:new Set(batch.evidence.map(e=>e.sourceId)).size,sourceCountryCodes:[...new Set(batch.evidence.flatMap(e=>e.geography.sourceCountryCodes))].sort(),
    storyCountryCodes:[...new Set(batch.evidence.flatMap(e=>e.geography.storyCountryCodes))].sort(),
    explicitPublicationDateCount:batch.records.length,dateOnlyPublicationCount:batch.records.filter(r=>validDate(r.publishedAt)).length,
    unknownPublicationDateCount:0,freshWithinSevenDays:batch.records.filter(r=>Date.parse(r.publishedAt)>=current.getTime()-7*86400000).length,
    sourceResponseDigestCount:batch.evidence.length,dates:[...new Set(batch.records.map(r=>r.publishedAt.slice(0,10)))].sort(),
    summaryLengths:Object.fromEntries(['ru','en'].map(l=>[l,{min:Math.min(...batch.records.map(r=>r.summary[l].length)),max:Math.max(...batch.records.map(r=>r.summary[l].length))}])),
    recordSha256:batch.recordSha256,canonicalBeforeSha256:hash(raw),duplicateCheck:'Canonical source URLs, stable IDs/event keys and agent-reviewed distinct publication/event stages.',
    limitations:['The proposal contains exactly the reported admitted records; held candidates are not counted as public news.',
      'This is an archival September1\u201324batch; original dates are retained, and these records must not be represented as fresh Telegram news.',
      'Reviews, interviews and reading selections are dated as publications, never as invented book-release dates.',
      'All full original response bytes are retained locally with digest verification; originals and summaries remain unpublished until root review.',
      'No illustration is applied without separate source-image relevance/rights review.'],
  };
  if(values['evidence-input']&&!values.check){await mkdir(new URL('../reports/r10/publication/',import.meta.url),{recursive:true});await writeFile(reportFile,serialize(batch));await writeFile(receiptFile,serialize(receipt));}
  if(hash(await readFile(new URL('../data/news/reviewed.json',import.meta.url),'utf8'))!==hash(raw))throw new Error('canonical_changed_during_batch_preparation');
  console.log(JSON.stringify(receipt));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
