import {describe,it,expect,vi} from "vitest";
import {readFileSync} from "node:fs";
import {verifyLiteraryNewsFeed,runLiteraryNewsLiveVerification} from "./verify-literary-news-live.mjs";
import {buildPublishedNewsFeed,newsDigest,newsSnapshotPayload,publicNewsItem} from "./lib/literary-news-publication.mjs";
import {pendingNewsSourceState} from "./lib/literary-news-state.mjs";
import {buildNobelProfile,nobelPublishedRecords} from "./lib/literary-news-nobel-profile.mjs";

const current=new Date("2026-09-26T18:00:00Z"),release="a".repeat(40),timeZone="Europe/Moscow";
const item=index=>({id:`live-fixture-${index}`,eventKey:`live-fixture-${index}`,kind:"news",category:"releases",
  eventDate:"2026-09-25",publishedAt:null,verifiedAt:"2026-09-25T12:00:00Z",verification:"confirmed",
  title:{ru:`Проверенная книга ${index}`,en:`Verified book ${index}`},summary:{ru:"Сообщение издательства.",en:"A publisher announcement."},
  source:{name:"Fixture publisher",language:"en",url:`https://publisher.example/news/book-${index}`}});
const build=(records=[item(1)],extra={})=>buildPublishedNewsFeed({records,state:pendingNewsSourceState(),current,release,timeZone,...extra});
const options=(records=[item(1)],extra={})=>({records,current,timeZone,expectedHead:release,releaseHeader:release,...extra});
const redigest=async feed=>{feed.snapshot.count=feed.items.length;feed.snapshot.id=await newsDigest(newsSnapshotPayload(feed));return feed;};

describe("live release verifier compatibility and exactness",()=>{
  it("retains legacy limits and ordering while negotiating a complete v2 snapshot",async()=>{
    const records=Array.from({length:501},(_,index)=>item(index));
    const legacy=await build(records,{contractVersion:1});
    expect(legacy.items).toHaveLength(500);expect(legacy.sources).toHaveLength(50);
    await expect(verifyLiteraryNewsFeed(legacy,options(records,{contractVersion:1}))).resolves.toBe(legacy);
    const complete=await build(records);
    expect(complete.items).toHaveLength(501);expect(complete.sources.length).toBeGreaterThan(100);
    await expect(verifyLiteraryNewsFeed(complete,options(records))).resolves.toBe(complete);
    await expect(verifyLiteraryNewsFeed(legacy,options(records))).rejects.toThrow("public_snapshot_incomplete");
    legacy.items.push(publicNewsItem(item(700)));
    await expect(verifyLiteraryNewsFeed(legacy,options(records,{contractVersion:1}))).rejects.toThrow("capacity");
  });
  it("subtracts active withdrawals, keeps future withdrawals inactive and rejects forged removal",async()=>{
    const records=[item(1),item(2)],withdrawals=[
      {id:item(1).id,withdrawnAt:current.toISOString(),reason:"Source correction"},
      {id:item(2).id,withdrawnAt:"2026-10-01T12:00:00Z",reason:"Future correction"},
    ];
    const feed=await build(records,{withdrawals});
    expect(feed.items.map(row=>row.id)).toEqual([item(2).id]);
    await expect(verifyLiteraryNewsFeed(feed,options(records,{withdrawals}))).resolves.toBe(feed);
    const legacy=await build(records,{withdrawals,contractVersion:1});
    await expect(verifyLiteraryNewsFeed(legacy,options(records,{withdrawals,contractVersion:1}))).resolves.toBe(legacy);
    await expect(verifyLiteraryNewsFeed(feed,options(records))).rejects.toThrow("active withdrawals");
    feed.items=[];await redigest(feed);
    await expect(verifyLiteraryNewsFeed(feed,options(records,{withdrawals}))).rejects.toThrow("complete reviewed selection");
  });
  it("accepts only reconstructed Nobel extras and refuses arbitrary or altered extras",async()=>{
    const official=JSON.parse(readFileSync("reports/r10/news/nobel/api-capture.json","utf8"));
    const admitted=await buildNobelProfile({document:{nobelPrizes:[official.nobelPrizes[0]]},current:new Date("2025-10-10T12:00:00Z")});
    const [extra]=await nobelPublishedRecords(admitted.payload,current),records=[item(1)];
    const feed=await build([...records,extra]);
    await expect(verifyLiteraryNewsFeed(feed,options(records))).resolves.toBe(feed);
    const legacy=await build([...records,extra],{contractVersion:1});
    await expect(verifyLiteraryNewsFeed(legacy,options(records,{contractVersion:1}))).resolves.toBe(legacy);
    for(const changed of [item(99),{...extra,source:{...extra.source,url:"https://example.org/fake-prize"}},
      {...extra,summary:{...extra.summary,ru:"Unreviewed extra prose"}},{...extra,verifiedAt:current.toISOString()}]) {
      await expect(verifyLiteraryNewsFeed(await build([...records,changed]),options(records))).rejects.toThrow("published_nobel_profile_invalid");
    }
  });
  it("rejects altered static text even when its source-computed snapshot digest is internally consistent",async()=>{
    const records=[item(1)],feed=await build([{...records[0],title:{...records[0].title,ru:"Изменённое утверждение"}}]);
    await expect(verifyLiteraryNewsFeed(feed,options(records))).rejects.toThrow("complete reviewed selection");
  });
  it("checks digest, completeness, release, capture freshness and Moscow representation",async()=>{
    const feed=await build();
    const damaged=structuredClone(feed);damaged.items[0].summary.en+=" damaged";
    await expect(verifyLiteraryNewsFeed(damaged,options())).rejects.toThrow("digest");
    await expect(verifyLiteraryNewsFeed({...feed,snapshot:{...feed.snapshot,complete:false}},options())).rejects.toThrow("incomplete");
    await expect(verifyLiteraryNewsFeed(feed,options(undefined,{releaseHeader:"b".repeat(40)}))).rejects.toThrow("expected release");
    await expect(verifyLiteraryNewsFeed({...feed,fallbackCapturedAt:feed.generatedAt},options())).rejects.toThrow("fallback");
    await expect(verifyLiteraryNewsFeed(await build(undefined,{timeZone:"UTC"}),options())).rejects.toThrow();
    await expect(verifyLiteraryNewsFeed(feed,options(undefined,{current:new Date(current.getTime()+301000)}))).rejects.toThrow("current");
  });
  it("accepts all 5000 permitted records and rejects 5001 instead of truncating",async()=>{
    const records=Array.from({length:5000},(_,index)=>item(index)),feed=await build(records);
    await expect(verifyLiteraryNewsFeed(feed,options(records))).resolves.toBe(feed);
    feed.items.push(publicNewsItem(item(5000)));await redigest(feed);
    await expect(verifyLiteraryNewsFeed(feed,options([...records,item(5000)]))).rejects.toThrow("capacity");
  });
  it("the actual CLI runner requires three legacy responses plus current complete v2",async()=>{
    const records=[item(1)],fetchImpl=vi.fn(async(url,init)=>{
      if(init.method==="POST")return new Response(null,{status:405});
      const query=new URL(url).searchParams;
      return Response.json(await build(records,{timeZone:query.get("timeZone"),contractVersion:query.get("contract")==="2"?2:1}),
        {headers:{"access-control-allow-origin":"https://probpera.ru","x-probpera-news-release":release}});
    });
    const result=await runLiteraryNewsLiveVerification({args:["--expected-head",release],records,withdrawals:[],fetchImpl,now:()=>current,waitImpl:async()=>{}});
    expect(result).toMatchObject({legacyZones:3,contractVersion:2,timeZone:"Europe/Moscow",release});
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });
  it("an old deployment that ignores contract=2 cannot produce a successful release verification",async()=>{
    const records=[item(1)],fetchImpl=vi.fn(async(url)=>{
      const query=new URL(url).searchParams;
      return Response.json(await build(records,{timeZone:query.get("timeZone"),contractVersion:1}),
        {headers:{"access-control-allow-origin":"https://probpera.ru","x-probpera-news-release":release}});
    });
    await expect(runLiteraryNewsLiveVerification({args:[],records,withdrawals:[],fetchImpl,now:()=>current,waitImpl:async()=>{}})).rejects.toThrow("public_snapshot_incomplete");
    expect(fetchImpl.mock.calls.filter(([url])=>new URL(url).searchParams.get("contract")==="2")).toHaveLength(6);
    expect(fetchImpl.mock.calls.every(([,init])=>init.method===undefined)).toBe(true);
  });
});
