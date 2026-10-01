// Retained HTTP response is ignored source evidence; only the bounded review receipt is public.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
import {extractDailyNewsDetail} from './lib/literary-news-daily-intake.mjs';
import {LITERARY_NEWS_SOURCES} from './lib/literary-news-sources.mjs';
const reportPath='reports/r10/sources/british-library-scoped-extraction-20261002.json';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function reviewBritishLibrary(html,url){
  const source=LITERARY_NEWS_SOURCES.find(s=>s.id==='british-library'),$=load(html);
  const detail=extractDailyNewsDetail(html,url,source);
  const primaryVisibleDate=$('main#content > article').first().text().replace(/\s+/gu,' ').match(/1 October 2026/u)?.[0];
  if(source.detailHeadlineSelector!=='main#content h1'||source.detailTextSelector!=='main#content > div[class*="ContentBlockRenderer"]'
    ||detail.headline!=='British Library announces 2027 programme'||primaryVisibleDate!=='1 October 2026'
    ||detail.text.length<5000||!detail.text.includes('30 October 2026 \u2013 20 June 2027')
    ||!detail.text.includes('2000 AD: The Galaxy’s Greatest Comic turns 50')
    ||detail.text.includes('British Library announces 2027 programme'))throw Error('british_library_primary_scope_not_proven:'+JSON.stringify({
      headline:detail.headline,headlineSelector:source.detailHeadlineSelector,bodySelector:source.detailTextSelector,
      primaryVisibleDate,bodyCharacters:detail.text.length,christieDates:detail.text.includes('30 October 2026 \u2013 20 June 2027'),
      comicHeading:detail.text.includes('2000 AD: The Galaxy’s Greatest Comic turns 50')}));
  return {detail,source,primaryVisibleDate};
}
if(process.argv.includes('--build')){
 const input=JSON.parse(await readFile('.tmp/news-expanded-c-20261002/details.json','utf8')).find(r=>r.harvestIndex===269);
 const bytes=await readFile(input.evidence.localDocumentPath);
 if(hash(bytes)!==input.evidence.responseSha256||bytes.length!==input.evidence.documentBytes)throw Error('retained_document_digest_invalid');
 const {detail,source,primaryVisibleDate}=reviewBritishLibrary(bytes.toString('utf8'),input.source.url);
 const report={schemaVersion:1,reviewId:'british-library-scoped-extraction-20261002',reviewedAt:new Date().toISOString(),
  scope:'One code-owned detail extraction override; original source initializer, URL grammar and fetch limits unchanged.',
  sourceId:source.id,url:input.source.url,httpStatus:200,accessedAt:input.evidence.accessedAt,
  rawDocumentSha256:hash(bytes),rawDocumentBytes:bytes.length,retainedLocalDocument:input.evidence.localDocumentPath,
  selectors:{headline:source.detailHeadlineSelector,body:source.detailTextSelector},
  finding:'The first article is a 54-character hero; substantive prose is its ContentBlockRenderer sibling within main#content.',
  primaryPublication:{value:'2026-10-01',precision:'date-only',method:'visible date inside primary article hero',literal:primaryVisibleDate},
  extractedBodySha256:hash(detail.text),extractedBodyCharacters:detail.text.length,
  assertions:{heroOnlyFalseBodyExcluded:true,fullProgrammeProseRetrieved:true,christieExhibitionDatesRetained:true,
    comicAnniversaryProgrammeRetained:true,publicationTimeInferred:false,canonicalWrites:0,remoteWrites:0},
  validation:'scripts/lib/british-library-scoped-extraction-20261002.test.mjs plus full retained document digest check'};
 await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
