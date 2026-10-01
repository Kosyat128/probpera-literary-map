// Read-only bounded original-article capture for the second independent review
// slice. Captured HTML stays local; collection cannot approve or publish news.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fetchPinnedNewsSource} from './lib/literary-news-safe-fetch.mjs';
import {extractDailyNewsDetail,dailyNewsIntakePool} from './lib/literary-news-daily-intake.mjs';
import {LITERARY_NEWS_SOURCES} from './lib/literary-news-sources.mjs';
import {load} from 'cheerio';
const harvest=JSON.parse(await readFile('reports/r10/publication/current-news-harvest-20261002.json','utf8'));
const rows=harvest.freshDatedCandidates.slice(110,220).map((row,index)=>({...row,harvestIndex:index+110}));
const directory='.tmp/news-expanded-b-20261002';
await mkdir(directory+'/source-documents',{recursive:true});
const sources=new Map(LITERARY_NEWS_SOURCES.map(source=>[source.id,source]));
export function extractBatchDetail(html,url,source){
  // Selectors were inspected in these fetched primary article documents. They
  // affect this capture only; the frozen worldwide runtime registry is unchanged.
  const local={
    'buchmarkt':{detailHeadlineSelector:'.elementor-location-single h1',detailTextSelector:'.elementor-location-single .elementor-widget-theme-post-content'},
    'revista-letras-libres':{detailHeadlineSelector:'#primary .cs-entry__header h1.cs-entry__title',detailTextSelector:'#primary .entry-content'},
  }[source.id];
  const detail=extractDailyNewsDetail(html,url,{...source,...local});
  if(local)detail.extractionSelectors=local;
  if(source.id==='books-ireland'){
    const $=load(html),headline=$('meta[property="og:title"]').attr('content');
    const canonical=$('link[rel="canonical"]').attr('href');
    if(headline&&canonical&&new URL(canonical,url).href===url){detail.headline=headline;detail.headlineMethod='Primary og:title with matching article canonical URL';}
  }
  return detail;
}
let completed=0;
const details=await dailyNewsIntakePool(rows,async candidate=>{
  const source=sources.get(candidate.sourceId),localDocumentPath=`${directory}/source-documents/${String(candidate.harvestIndex).padStart(3,'0')}.bin`;
  try{
    if(!source||source.discoveryEnabled===false)throw new Error('source_not_currently_active');
    const url=new URL(candidate.source.url),origins=new Set([new URL(source.url).origin,...(source.articleOrigins||[])]);
    if(!origins.has(url.origin)||url.username||url.password||url.protocol!=='https:')throw new Error('article_origin_not_approved');
    const response=await fetchPinnedNewsSource(url,{maxResponseBytes:2*1024*1024,timeoutMs:15000,
      headers:{'User-Agent':'ProbperaLiteraryNews/1.0 (+https://probpera.ru)',Accept:'text/html,application/xhtml+xml'}});
    if(!response.ok)throw new Error(`http_${response.status}`);
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>2*1024*1024)throw new Error('document_too_large');chunks.push(Buffer.from(value));}}
    finally{reader.releaseLock();}
    const bytes=Buffer.concat(chunks,size);await writeFile(localDocumentPath,bytes);
    const html=new TextDecoder(source.encoding||'utf-8').decode(bytes);
    return {...candidate,source:{...candidate.source,name:source.name},evidence:{httpStatus:200,url:url.href,
      accessedAt:new Date().toISOString(),responseSha256:createHash('sha256').update(bytes).digest('hex'),
      documentBytes:size,localDocumentPath,...extractBatchDetail(html,url.href,source)}};
  }catch(error){return {...candidate,evidence:null,error:error.message};}
  finally{completed++;if(completed%20===0)console.log(JSON.stringify({completed,total:rows.length}));}
});
await writeFile(directory+'/details.json',JSON.stringify(details,null,2)+'\n');
console.log(JSON.stringify({total:details.length,bodyHTTP200:details.filter(row=>row.evidence).length,
  held:details.filter(row=>!row.evidence).map(row=>({harvestIndex:row.harvestIndex,sourceId:row.sourceId,error:row.error}))}));
