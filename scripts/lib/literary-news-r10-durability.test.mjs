import {describe,it,expect,vi} from "vitest";
import {makeNewsGeneration,parseNewsGeneration,syncNewsStorage,NEWS_STATE_KEY,NEWS_QUEUE_KEY} from "./literary-news-kv-sync.mjs";
import {createNewsService,newsDiscoveryParserVersion} from "./literary-news-feed.mjs";
import {buildNewsIngestion} from "./literary-news-ingestion.mjs";
import {mergeReviewedBatch} from "../apply-literary-news-batch.mjs";
import batch from "../../data/news/batches/r10-01.json" with {type:"json"};

const stamp="2026-09-26T18:00:00.000Z", current=new Date(stamp);
const source={id:"fixture",name:"Fixture",url:"https://example.test/feed/",language:"en",format:"html",linkPattern:/^\/news\//};
const candidate=(n)=>({sourceId:source.id,source:{name:source.name,url:`https://example.test/news/${n}`,language:"en"},
  title:`Literary story ${n}`,description:null,publishedAt:null,discoveredAt:stamp,verification:"held",reasons:["missing_event_date"]});
const ingestion=(candidates,extra={})=>buildNewsIngestion({sources:[source],current,candidates,
  feed:{lastCheckedAt:stamp,sources:[{...source,status:"ok",lastSuccessAt:stamp}]},...extra});

describe("R10 persisted discovery and additive content",()=>{
  it("keeps discovery 101 and older pending entries after a refresh",()=>{
    const before=ingestion(Array.from({length:101},(_,n)=>candidate(n)));
    const after=ingestion([candidate(101)],{previousState:before.state,previousQueue:before.queue});
    expect(after.queue.items).toHaveLength(102);
    expect(after.queue.items.some(row=>row.source.url.endsWith("/100"))).toBe(true);
  });
  it("retired sources keep their evidence in the private archive",()=>{
    const before=ingestion([candidate(1)]);
    const after=buildNewsIngestion({sources:[],current,candidates:[],feed:{lastCheckedAt:stamp,sources:[]},previousState:before.state,previousQueue:before.queue});
    expect(after.queue.items).toHaveLength(1);expect(after.queue.items[0].reasons).toContain("source_inactive");
  });
  it("a whole generation has a checked digest and rejects a partial mutation",()=>{
    const value=makeNewsGeneration(ingestion([candidate(1)]).bulk);
    expect(JSON.parse(parseNewsGeneration(JSON.stringify(value)).previousQueue).items).toHaveLength(1);
    value.queue.items=[];
    expect(()=>parseNewsGeneration(JSON.stringify(value))).toThrow("corrupted");
  });
  it("a failed legacy projection resumes from the committed whole generation",async()=>{
    let generation=null;
    const storage={readGeneration:async()=>generation,read:vi.fn(async()=>null),
      commitGeneration:async entries=>{generation=parseNewsGeneration(JSON.stringify(makeNewsGeneration(entries)));},
      write:vi.fn().mockRejectedValueOnce(new Error("one old key failed")).mockResolvedValueOnce()};
    const collect=vi.fn(async()=>ingestion([candidate(1)]).bulk);
    await expect(syncNewsStorage({storage,collect})).rejects.toThrow();
    await syncNewsStorage({storage,collect});
    expect(collect.mock.calls[1][0]).toEqual(generation);expect(storage.read).toHaveBeenCalledTimes(2);
  });
  it("a failed whole-generation commit never advances legacy state",async()=>{
    const storage={read:async()=>null,commitGeneration:vi.fn(async()=>{throw new Error("failed");}),write:vi.fn()};
    await expect(syncNewsStorage({storage,collect:async()=>ingestion([candidate(1)]).bulk})).rejects.toThrow();
    expect(storage.write).not.toHaveBeenCalled();
  });
  it("source budgets survive restart and continue at the next source",async()=>{
    const sources=Array.from({length:15},(_,n)=>({...source,id:`source-${n}`})),fetchImpl=vi.fn(async()=>new Response('<a href="/news/book">A verified literary source story</a>'));
    const first=createNewsService({sources,fetchImpl,readReviewed:()=>[],now:()=>current,maxRequests:12});
    await first.refresh();expect(fetchImpl).toHaveBeenCalledTimes(12);
    const second=createNewsService({sources,fetchImpl,readReviewed:()=>[],now:()=>current,maxRequests:12,
      previousScheduler:first.getScheduler(),previousCandidates:first.getReviewQueue()});
    await second.refresh();expect(fetchImpl).toHaveBeenCalledTimes(15);first.close();second.close();
  });
  it("304 reuses the matching parsed evidence without inventing new findings",async()=>{
    const etag='"fixture-v1"';
    const fetchImpl=vi.fn(async()=>new Response(null,{status:304}));
    const instance=createNewsService({sources:[source],fetchImpl,readReviewed:()=>[],now:()=>current,
      previousScheduler:{sources:{fixture:{endpoint:source.url,parserVersion:newsDiscoveryParserVersion(source),etag}}},previousCandidates:[candidate(1)]});
    await instance.refresh();expect(fetchImpl.mock.calls[0][1].headers["If-None-Match"]).toBe(etag);
    expect(instance.getReviewQueue()).toHaveLength(1);instance.close();
  });
  it("replaying a verified batch adds nothing and rollback preserves later edits",()=>{
    const first=mergeReviewedBatch([],batch,{current});expect(first.added).toHaveLength(20);
    expect(mergeReviewedBatch(first.records,batch,{current}).added).toEqual([]);
    const changed=structuredClone(first.records);changed[0].title.ru+=" Уточнение";
    expect(()=>mergeReviewedBatch(changed,batch,{current,rollback:true})).toThrow("batch_conflict");
    expect(mergeReviewedBatch(first.records,batch,{current,rollback:true}).records).toEqual([]);
  });
});
