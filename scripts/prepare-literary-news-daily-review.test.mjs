import {describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {selectDailyNewsSources,prepareDailyNewsReview,DAILY_NEWS_INTAKE_CONTRACT} from './prepare-literary-news-daily-review.mjs';

const current=new Date('2026-09-29T12:00:00Z');
const source=(id,language='en',region='europe')=>({id,name:`Source ${id}`,url:`https://${id}.example/feed/`,
  format:'rss',language,region,topics:['releases'],countryCodes:['GB']});
describe('all-source bounded daily review intake',()=>{
  it('rotates all approved active sources with Russian and worldwide representation and never revives disabled endpoints',()=>{
    const sources=[...Array.from({length:12},(_,i)=>source(`ru-${i}`,i%2?'ru-RU':'ru')),
      ...Array.from({length:120},(_,i)=>({...source(`world-${i}`,'en',['africa','asia','europe','north-america','latin-america','oceania'][i%6]),countryCodes:[String(i%20)]})),
      {...source('disabled'),discoveryEnabled:false}];
    const visited=new Set();
    for(let slot=0;slot<24;slot++){
      const selected=selectDailyNewsSources({sources,current:new Date(current.getTime()+slot*1800000)});
      expect(selected).toHaveLength(32);expect(new Set(selected.map(s=>s.id)).size).toBe(32);
      expect(selected.filter(s=>/^ru/.test(s.language))).toHaveLength(8);
      expect(new Set(selected.map(s=>s.region)).size).toBeGreaterThan(1);
      selected.forEach(s=>visited.add(s.id));
    }
    expect(visited.size).toBe(132);expect(visited.has('disabled')).toBe(false);
  });
  it('uses the real RSS parser and fetched article date/hash contract without auto-confirming discoveries',async()=>{
    const sources=[source('publisher')],article='https://publisher.example/news/new-novel';
    const xml=`<rss version="2.0"><channel><title>Publisher</title><item><title>A publisher releases a new novel</title><link>${article}</link><pubDate>Tue, 29 Sep 2026 08:00:00 GMT</pubDate><description>A new novel has been announced.</description></item></channel></rss>`;
    const html='<html lang="en"><meta property="article:published_time" content="2026-09-29T08:00:00Z"><meta property="og:image" content="/cover.jpg"><article><h1>A publisher releases a new novel</h1><p>The publisher announced a new novel.</p></article></html>';
    const fetchImpl=async url=>{const text=url===article?html:xml;return{url,status:200,contentType:url===article?'text/html':'application/rss+xml',
      text,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex'),accessedAt:current.toISOString()};};
    const result=await prepareDailyNewsReview({sources,reviewed:[],current,sourceLimit:1,detailLimit:1,fetchImpl});
    expect(result.contract).toBe(DAILY_NEWS_INTAKE_CONTRACT);expect(result.counts).toMatchObject({checkedSources:1,totalFinds:1,verifiedDetails:1,newlyReady:0,newlyPublished:0});
    expect(result.details[0]).toMatchObject({sourceProfile:{id:'publisher',articleOrigins:['https://publisher.example'],countryCodes:['GB']},
      resolvedMediaEvidence:{status:'rights_unverified'},evidence:{url:article,httpStatus:200,responseSha256:createHash('sha256').update(html).digest('hex'),
        publishedDates:[{value:'2026-09-29T08:00:00Z',method:'meta[property="article:published_time"]'}]}});
    expect(result.details[0].evidence.images[0]).toMatchObject({displayOnly:true,socialReuseApproved:false});
  });
});
