// Read already captured primary documents. This script performs no requests.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
import {extractDailyNewsDetail} from './lib/literary-news-daily-intake.mjs';
import {LITERARY_NEWS_SOURCES} from './lib/literary-news-sources.mjs';
const pool=JSON.parse(await readFile('reports/r10/publication/september-news-candidate-pool-20261002.json','utf8'));
if(pool.candidateArraySha256!=='695c3086b59fd0d34223d2140d795a95e003122755cac432f003f441537af45a')throw new Error('september_pool_changed');
const sources=new Map(LITERARY_NEWS_SOURCES.map(s=>[s.id,s])),rows=[];
for(let index=0;index<120;index++){
 const candidate=JSON.parse(await readFile(`.tmp/september-news-bodies-20261002/${String(index).padStart(3,'0')}.json`,'utf8'));
 if(candidate.septemberIndex!==index||candidate.source.url!==pool.candidates[index].source.url)throw new Error('september_capture_identity_changed');
 if(candidate.evidence){const bytes=await readFile(candidate.evidence.localDocumentPath);
  if(createHash('sha256').update(bytes).digest('hex')!==candidate.evidence.responseSha256)throw new Error('september_body_changed');
  const source=sources.get(candidate.sourceId),html=new TextDecoder(source.encoding||'utf-8').decode(bytes);
  if(index===1){const detail=extractDailyNewsDetail(html,candidate.source.url,source);
   if(detail.text.length<1000)throw new Error('new_zealand_primary_content_not_extracted');
   candidate.evidence={...candidate.evidence,...detail,
     extractionSelectors:{detailHeadlineSelector:source.detailHeadlineSelector,detailTextSelector:source.detailTextSelector},
     extractionMethod:'Verified production source selectors; trusted imported release is cloned before footer chrome removal'};}
  if(index===110){const selectors={detailHeadlineSelector:'#content h1#page-title',detailTextSelector:'#content .field-name-body'};
   const $=load(html);
   if($(selectors.detailHeadlineSelector).length!==1||$(selectors.detailTextSelector).length!==1)
    throw new Error('ukrainian_primary_article_identity_missing');
   const detail=extractDailyNewsDetail(html,candidate.source.url,{...source,...selectors});
   if(detail.headline.replace(/\s+/gu,' ').trim()!==candidate.title)throw new Error('ukrainian_article_heading_mismatch');
   candidate.evidence={...candidate.evidence,...detail,extractionSelectors:selectors,
     headlineMethod:'Unique primary article h1#page-title inside #content; matching publisher-listing title'};}
  if(index===21){const $=load(html),headings=$('h2.elementor-heading-title');
   if(headings.length!==1||headings.text().trim()!==candidate.title)throw new Error('uruguay_primary_heading_mismatch');
   candidate.evidence.headline=headings.text().trim();
   candidate.evidence.headlineMethod='Unique first-party h2.elementor-heading-title matching publisher-listing title';}
  if(index===43){const $=load(html),title=$('head > title').first().text().trim();
   if(!title.startsWith(candidate.title)||$('link[rel="canonical"]').attr('href')!==candidate.source.url)
    throw new Error('uruguay_primary_document_title_mismatch');
   candidate.evidence.headline=title;candidate.evidence.headlineMethod='Primary document head title with matching canonical URL; SVG contact titles excluded';}
  if(candidate.sourceId==='books-ireland'){const $=load(html),title=$('meta[property="og:title"]').attr('content');
   if(title&&$('link[rel="canonical"]').attr('href')===candidate.source.url){candidate.evidence.headline=title;
    candidate.evidence.headlineMethod='Primary og:title with matching canonical URL';}}
  candidate.source.name=source.name;
 }
 rows.push(candidate);
}
await mkdir('.tmp/news-expanded-d-20261002',{recursive:true});
await writeFile('.tmp/news-expanded-d-20261002/details.json',JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify({captured:rows.length,fullBodyHTTP200:rows.filter(r=>r.evidence?.httpStatus===200).length,
 heldTransport:rows.filter(r=>!r.evidence).map(r=>({index:r.septemberIndex,sourceId:r.sourceId,error:r.error})),
 newZealandText:rows[1].evidence.text}));
