import { mkdir, writeFile } from 'node:fs/promises';
import { createNewsService } from './lib/literary-news-feed.mjs';
import { LITERARY_NEWS_SOURCES } from './lib/literary-news-sources.mjs';

const sources=LITERARY_NEWS_SOURCES.filter(x=>x.evidenceReport);
const outputDirectory=process.argv.find(arg=>arg.startsWith('--output-dir='))?.slice(13)||'reports/r10/sources';
if(!/^reports\/r10\/[a-z0-9/-]+$/u.test(outputDirectory))throw Error('Invalid evidence directory');
await mkdir(outputDirectory,{recursive:true});
const batches=[];
for(let i=0;i<sources.length;i+=12){
  const selected=sources.slice(i,i+12);
  const service=createNewsService({sources:selected,readReviewed:()=>[],timeoutMs:12000});
  try{
    await service.refresh();
    const feed=await service.getFeed();
    const queue=service.getReviewQueue();
    const record={batch:i/12+1,checkedAt:new Date().toISOString(),sourceCount:selected.length,availableSourceCount:feed.sources.filter(x=>x.status==='ok').length,candidateCount:queue.length,sources:feed.sources,items:queue};
    batches.push(record);
    await writeFile(`${outputDirectory}/runtime-batch-${String(record.batch).padStart(2,'0')}.json`,JSON.stringify(record,null,2)+'\n');
    console.log(`batch ${record.batch}: ${record.availableSourceCount}/${selected.length} actual collector HTTP endpoints; ${record.candidateCount} held items`);
  }finally{service.close();}
}
const states=batches.flatMap(x=>x.sources);
const result={checkedAt:new Date().toISOString(),method:'createNewsService production default transport; approved code-owned registry subset; 12-source batches and 4 concurrent requests',sourceCount:sources.length,availableSourceCount:states.filter(x=>x.status==='ok').length,failedSources:states.filter(x=>x.status!=='ok'),heldCandidateCount:batches.reduce((n,x)=>n+x.candidateCount,0),publicCount:0,batches:batches.map(({items,...batch})=>batch)};
await writeFile(`${outputDirectory}/runtime-verification.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({sources:result.sourceCount,available:result.availableSourceCount,held:result.heldCandidateCount,failed:result.failedSources.map(x=>[x.id,x.error])},null,2));
