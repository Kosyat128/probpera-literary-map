import { load } from 'cheerio';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { boundedFetch, pool, sha } from './research-literary-news-sources.mjs';
import { createNewsService } from './lib/literary-news-feed.mjs';
import { LEGACY_LITERARY_NEWS_SOURCES as LITERARY_NEWS_SOURCES } from './lib/literary-news-sources.mjs';
import { R10_SOURCE_PROFILES } from './lib/literary-news-source-profiles.mjs';
import { checkedProbeSourceId, probePathPattern } from './lib/literary-news-probe-patterns.mjs';

const out='reports/r10/sources';
const scratch='.tmp/r10-source-research';
await mkdir(out,{recursive:true}); await mkdir(scratch,{recursive:true});
const sourceData=JSON.parse(await readFile('data/news/r10-source-candidates.json','utf8'));
const start=Number(process.argv[2]||0), end=Number(process.argv[3]||sourceData.candidates.length);
const repair=process.argv.includes('--repair');
const onlyIds=new Set((process.argv.find(arg=>arg.startsWith('--ids='))?.slice(6)||'').split(',').filter(Boolean));
const TEXT=/(?:book|author|writ(?:er|ing)|literar|literat|poet|poes|novel|fiction|publish|translat|library|librar|archive|heritage|manuscript|exhibition|award|prize|festival|reading|pen |p[eé]n|книг|литерат|поэт|писател|изда(?:т|н)|перевод|библиот|преми|фестивал|чтен|наслед|рукопис|выстав|автор|роман|читател|livr[eo]|auteur|litt[eé]r|biblioth|[eé]di(?:t|c)|libro|autor|letr|bibliot|premio|feria|lectur|buch|b[üu]cher|schrift|verlag|lesung|buchpreis|boek|schrijver|uitgev|b[oö]cker|litter|f[oö]rfatt|forlag|kirj|raamat|knih|knji[žz]|knjig|libri|βιβλ|كتاب|مكتب|شعر|نشر|图书|圖書|文学|文學|書|本|출판|도서|문학|buku|penerbit)/iu;
const NAV=/^(?:home|about|contact|read more|learn more|news|events|more|view all|latest news|see all|resources|our members|join us|privacy|cookies|search|next|previous|menu|publications|membership|news and events|all news|all events|главная|подробнее|новости|события|контакты|о нас|читать далее|читать|читать полностью|читать статью|view details|find out more)$/iu;
const ADMIN=/chief executive|opening hours|join.{0,20}club|klubiedut|lit(?:eratur|erature) & unterhaltung|^promotion du livre$|privacy policy|cookie policy|terms\s*(?:&|and)|annual general meeting|board meeting|federal budget|vacanc|vacature|job opportunit|^our (?:history|mission|members|publications)|\bjoin us\b|renew your|staff appointment|^explore publishers$|^literary fiction$|^welcome to|^ausschuss|^piccoli editori$|^world directory|^behind the books$|^hello world|^disclaimer|^misija i vizija|^uso professionale|^répertoire des éditeurs|^malta libraries$|^e-books et livres audio|^contemporary printed books$|^austrian books online$|^poručivanje publikacije|^literary awards$|^search e-library|няма да работи/i;
const score=s=>(s.match(/(?:novel|fiction|poet|book|author|literar|literat|translat|prize|award|festival|книг|поэ|роман|писател|литерат|преми|фестив|перевод|libro|livr|auteur|buch|schrift|كتاب|文学|圖書|図書)/ig)||[]).length*2 + (/202[5-9]|announc|winner|shortlist|longlist|launch|release|new |nouve|premio|present|объяв|выход|побед|lanc|[eé]di/.test(s)?2:0) - (ADMIN.test(s)?100:0);
const itemScore=x=>score(x.title)+(/\/(?:news|notici[ae]s?|actualit[eé]s?|presse|press|blog|nyhet(?:er)?|nieuws|news-einzelansicht|aktualnosci|novost[iy]?|notizie|berita|novinky|tapahtumat|sobytiya|events?)\//i.test(x.source.url)?20:0)+(/\/20\d{2}\/|20(?:25|26|27)/.test(x.source.url)?10:0)-(/\/(?:about|ueber-uns|services|collection|collections|explore|catalogue|research|catalog|menu|membership|terms|privacy|product|products|books|buch|pages)\//i.test(x.source.url)?15:0);
const BLOCK=/\/(?:wp-(?:content|admin|json|login)|cart|shop|login|account|tag|category|author|privacy|contact|about|terms|search|membership|members|donate|product|products|catalog|catalogue)(?:\/|$)|\.(?:pdf|jpe?g|png|svg|zip|xlsx?|docx?)(?:$|\?)/i;
const normalized=s=>s.replace(/\s+/g,' ').trim();
const base=h=>h.replace(/^www\./,'');
const clean=r=>({url:r.url,status:r.status,contentType:r.contentType,bytes:r.bytes,sha256:r.sha256,accessedAt:r.accessedAt});
const robotsCache=new Map();
async function robots(u) {
  const origin=new URL(u).origin;
  if(!robotsCache.has(origin))robotsCache.set(origin,(async()=>{
    try{const r=await boundedFetch(origin+'/robots.txt',{timeout:7000,maxBytes:128*1024});let relevant=false;const disallowed=[];for(const l of r.text.split(/\r?\n/)){const m=/^\s*(User-agent|Disallow)\s*:\s*([^#]*)/i.exec(l);if(!m)continue;if(m[1].toLowerCase()==='user-agent')relevant=m[2].trim()==='*';else if(relevant&&m[2].trim())disallowed.push(m[2].trim());}return{...clean(r),disallowed};}catch(e){return{url:origin+'/robots.txt',error:e.message,disallowed:[]};}
  })());
  const r=await robotsCache.get(origin);const p=new URL(u).pathname; if(r.disallowed.some(x=>x==='/'||(!x.includes('*')&&p.startsWith(x))))throw new Error('robots_disallowed');return r;
}
function linksFor(html,url) {
  const $=load(html); const links=[];
  $('main a[href], article a[href], h1 a[href], h2 a[href], h3 a[href], h4 a[href], .news a[href], .entry-title a[href], .post-title a[href], a[href]').each((_,e)=>{
    const a=$(e);let u;try{u=new URL(a.attr('href'),url);}catch{return;}
    if(u.protocol!=='https:'||base(u.hostname)!==base(new URL(url).hostname)||u.hash||u.pathname===new URL(url).pathname&&u.search===new URL(url).search||BLOCK.test(u.href))return;
    let title=normalized(a.find('h1,h2,h3,h4').first().text()||a.closest('h1,h2,h3,h4').text()||a.text());
    if(NAV.test(title)||title.length<15||title.length>400)return;
    const heading=!!a.closest('h1,h2,h3,h4,article').length||!!a.find('h1,h2,h3,h4').length;
    if(!heading&&!TEXT.test(title))return;
    if(!links.some(x=>x.url===u.href))links.push({url:u.href,title,heading});
  });
  return links;
}
function facts(html,url) {
  const $=load(html);$('script:not([type="application/ld+json"]),style,nav,footer,header').remove();
  const headline=normalized($('.entry-title,h1[itemprop="headline"],article h1,main h1').first().text()
    ||$('meta[property="og:title"]').attr('content')||$('h1').first().text()||$('title').text());
  const dates=[];
  for(const sel of ['meta[property="article:published_time"]','meta[name="date"]','meta[name="DC.date.issued"]']) { const v=$(sel).attr('content');if(v)dates.push({value:v,method:sel}); }
  $('script[type="application/ld+json"]').each((_,e)=>{try {const d=JSON.parse($(e).html());const visit=x=>{if(Array.isArray(x))return x.forEach(visit);if(x&&typeof x==='object'){if(x.datePublished)dates.push({value:x.datePublished,method:'jsonld.datePublished',type:x['@type']||null});if(x['@graph'])visit(x['@graph']);}};visit(d);}catch{}});
  $('script').remove();
  const main=$('article,main,.entry-content,.post-content').first();const text=normalized((main.length?main:$.root()).text());
  return {headline:headline.slice(0,500),excerpt:text.slice(0,400),publishedDates:dates.slice(0,5),canonical:$('link[rel="canonical"]').attr('href')||url,language:$('html').attr('lang')?.slice(0,40)||null};
}
async function parserCheck(profile,response) {
  const approved=[...R10_SOURCE_PROFILES,...LITERARY_NEWS_SOURCES].find(row=>row.id===profile.id && row.url===profile.url);
  const pattern=approved?.linkPattern || (profile.format==='html' ? probePathPattern(linksFor(response.text,response.url).map(row=>row.url)) : undefined);
  const keywordPattern=approved?.keywordPattern;
  // Replayed reports cannot inject executable patterns; only code-owned patterns
  // or escaped paths derived from the current bounded response are evaluated.
  // The in-memory Response encodes the already-decoded research text as UTF-8;
  // the production collector uses the pinned source encoding on raw bytes.
  const source={...profile,encoding:'utf-8',linkPattern:pattern,keywordPattern,pagination:approved?.pagination};
  // The report stores observations only. Its pagination object is never replayed.
  delete profile.pagination;
  profile.linkPattern=pattern?.source;
  profile.keywordPattern=keywordPattern?.source;
  const service=createNewsService({sources:[source],readReviewed:()=>[],timeoutMs:2000,fetchImpl:async()=>new Response(response.text,{status:200,headers:{'content-type':response.contentType}})});
  try{await service.refresh();return service.getReviewQueue();}finally{service.close();}
}
async function probe(c,index) {
  checkedProbeSourceId(c.id);
  const record={sourceId:c.id,name:c.name,entryUrl:c.entryUrl,countryCodes:c.countryCodes,coverageCountryCodes:c.coverageCountryCodes,attemptedAt:new Date().toISOString(),requests:[],status:'blocked',reason:null};
  try {
    const encoding=c.id==='fil-guadalajara'?'windows-1252':undefined;
    let previous=null,cached=null;
    if(repair){try{previous=JSON.parse(await readFile(out+'/'+c.id+'.json','utf8'));cached=JSON.parse(await readFile(scratch+'/'+c.id+'.json','utf8'));}catch{}}
    record.robots=await robots(c.entryUrl);
    let r=cached?{...cached,...previous.requests.find(x=>x.url===cached.url),text:cached.text}:await boundedFetch(c.entryUrl,{encoding});record.requests.push(clean(r));
    if(cached)record.cacheReplayOf={attemptedAt:previous.attemptedAt,sourceDocumentSha256:previous.responseSha256};
    const entry=load(r.text);const language=entry('html').attr('lang')||c.languageHint;
    let format=cached?previous.endpoint.format:/rss\+xml/.test(r.contentType)?'rss':/atom\+xml/.test(r.contentType)?'atom':'html';
    const feedLinks=[];
    entry('link[rel="alternate"][href]').each((_,e)=>{const a=entry(e);if(/(?:rss|atom)\+xml/.test(a.attr('type')||'')){try{const u=new URL(a.attr('href'),r.url);if(base(u.hostname)===base(new URL(r.url).hostname)&&!/(?:comments|comment|replies)/i.test(u.href+' '+a.attr('title')))feedLinks.push({url:u.href,format:a.attr('type').includes('atom')?'atom':'rss'});}catch{}}});
    if(format==='html'&&feedLinks.length){try{await robots(feedLinks[0].url);const f=await boundedFetch(feedLinks[0].url);record.requests.push(clean(f));const xml=load(f.text,{xmlMode:true});const linked=xml('item > link, item > guid, entry > link').toArray().some(e=>xml(e).text().trim()||xml(e).attr('href'));if(!linked)throw new Error('advertised_feed_has_no_item_links');r=f;format=feedLinks[0].format;}catch(e){record.feedAttemptError=e.message;}}
    let actualLang;try{actualLang=new Intl.Locale(language).toString();}catch{actualLang=c.languageHint;}
    const existing=[...R10_SOURCE_PROFILES,...LITERARY_NEWS_SOURCES].find(x=>x.id===c.id);
    let profile={id:c.id,name:c.name,url:r.url,format,language:actualLang,region:c.region,sourceFamilyId:c.sourceFamilyId,countryCodes:c.countryCodes,coverageCountryCodes:c.coverageCountryCodes,topics:c.sourceClass==='library'?['heritage','discoveries','festivals','releases']:c.sourceClass==='writers-association'?['publishing','awards','festivals']:['publishing','releases','awards','festivals'],articleOrigins:[new URL(r.url).origin],linkPattern:'^/',parserVersion:'r10-source-profile-1',...(encoding?{encoding}:{})};
    if(cached)profile={...previous.endpoint};
    if(format==='html') {
      let found=linksFor(r.text,r.url).filter(x=>!ADMIN.test(x.title));
      if(!existing&&!cached){
        const options=[];entry('a[href]').each((_,e)=>{const a=entry(e);const t=normalized(a.text());if(/^(?:news|latest news|noticias|novosti|novinky|nieuws|nyheter|aktuelles|actualit[eé]s|presse|press releases|новости|события|news & events|news and events|berita|not[ií]cias|notizie|novedades|neuigkeiten|nyheder|uutiset|all news|newsroom)$/iu.test(t)){try{const u=new URL(a.attr('href'),c.entryUrl);if(base(u.hostname)===base(new URL(c.entryUrl).hostname)&&u.href!==r.url)options.push(u.href);}catch{}}});
        if(options[0]){try{await robots(options[0]);const n=await boundedFetch(options[0],{encoding});record.requests.push(clean(n));r=n;profile.url=r.url;profile.articleOrigins=[new URL(r.url).origin];found=linksFor(r.text,r.url).filter(x=>!ADMIN.test(x.title));}catch(e){record.indexAttemptError=e.message;}}
      }
      if(existing&&new URL(existing.url).pathname===new URL(r.url).pathname){profile={...profile,linkPattern:existing.linkPattern?.source||'^/',articleContainer:existing.articleContainer,titleSelector:existing.titleSelector,articleOrigins:existing.articleOrigins||profile.articleOrigins,keywordPattern:existing.keywordPattern?.source};}
      else if(!cached){profile.linkPattern=probePathPattern(found.map(x=>x.url)).source;profile.linkSelector='a[href]:not(nav a):not(header a):not(footer a)';}
      if(!profile.linkPattern)throw new Error('no_literary_article_links');
      if(c.id==='yasnaya-polyana'){profile.articleContainer='.slide';profile.titleSelector='.event-title';}
    }
    const parsed=await parserCheck(profile,r);
    const eligible=parsed.filter(x=>!NAV.test(x.title)&&!ADMIN.test(x.title)).sort((a,b)=>itemScore(b)-itemScore(a));
    if(!eligible.length)throw new Error('runtime_parser_no_literary_item');
    let selected=null;
    for(const item of eligible.slice(0,8)){
      try{await robots(item.source.url);const detail=await boundedFetch(item.source.url,{encoding});record.requests.push(clean(detail));const extracted=facts(detail.text,detail.url);if(!extracted.headline||extracted.excerpt.length<60||ADMIN.test(extracted.headline)||NAV.test(extracted.headline))continue;
        const literary=TEXT.test(extracted.headline+' '+item.title+' '+extracted.excerpt);
        const articleEvidence=Boolean(item.publishedAt)||extracted.publishedDates.some(d=>d.method.startsWith('meta')||/Article|Posting|News/.test(d.type))||/\/(?:news|notici[ae]s?|actualit[eé]s?|presse|press|prensa|boletin|blog|nyhet(?:er)?|nieuws|news-einzelansicht|aktualnosci|novost[iy]?|notizie|berita|novinky|tapahtumat|sobytiya|events?)\/.{5,}|\/20\d{2}\//i.test(item.source.url)||/(?:202[5-9]|announc|winner|shortlist|longlist|launch|release|объяв|выш|побед|[eé]di)/i.test(extracted.headline);
        if(!literary||!articleEvidence)continue;
        selected={...item,detail:{...clean(detail),...extracted,articleEvidence:true}};break;}catch(e){record.detailAttemptError=e.message;}
    }
    if(!selected)throw new Error('detail_not_verified');
    if(!TEXT.test(selected.detail.headline+' '+selected.title+' '+selected.detail.excerpt))throw new Error('detail_not_literary');
    profile.exampleArticleUrls=[selected.source.url];profile.verifiedAt=new Date().toISOString();
    profile.collectionNote='Runtime parser and a real literary item fetched on '+profile.verifiedAt.slice(0,10)+'. Findings remain held until fact and RU/EN review. Country of organisation and event coverage are separate.';
    record.status='runtime_verified';record.reason=null;record.endpoint=profile;record.candidateCount=parsed.length;record.literaryCandidateCount=eligible.length;record.sample=selected;record.lastSuccessAt=profile.verifiedAt;record.foundItems=eligible.slice(0,100);record.responseSha256=r.sha256;
    await writeFile(scratch+'/'+c.id+'.json',JSON.stringify({url:r.url,contentType:r.contentType,text:r.text}));
  }catch(e){record.reason=e.message;}
  await writeFile(out+'/'+c.id+'.json',JSON.stringify(record,null,2)+'\n');
  console.log(index+1,c.id,record.status,record.candidateCount||0,record.reason||record.sample?.title?.slice(0,85));
  return record;
}
const selected=onlyIds.size?sourceData.candidates.map((c,i)=>({c,i})).filter(({c})=>onlyIds.has(c.id)):sourceData.candidates.slice(start,end).map((c,i)=>({c,i:start+i}));
if(onlyIds.size&&selected.length!==onlyIds.size)throw new Error('unknown_source_id');
const result=await pool(selected,({c,i})=>probe(c,i),4);
console.log(JSON.stringify({batch:onlyIds.size?[...onlyIds]:[start,end],verified:result.filter(x=>x.status==='runtime_verified').length,blocked:result.filter(x=>x.status!=='runtime_verified').length}));
