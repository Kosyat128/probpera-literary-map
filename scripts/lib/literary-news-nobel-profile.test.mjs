import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { buildNobelProfile, nobelPublishedRecords, validateNobelApprovedPayload, syncNobelProfile, NOBEL_API_URL, NOBEL_PROFILE_KEY, NOBEL_PROFILE_MAX_BYTES } from "./literary-news-nobel-profile.mjs";
import { handleNewsRequest } from "../workers/literary-news-worker.mjs";
import { verifyPublishedNewsSnapshot } from "./literary-news-publication.mjs";
import { parseNewsFeed } from "../../src/news/feed.ts";

const real = JSON.parse(readFileSync("reports/r10/news/nobel/api-capture.json","utf8"));
const NOW = new Date("2025-10-10T12:00:00Z"), TODAY = new Date("2026-09-26T18:00:00Z");
const document = () => structuredClone({nobelPrizes:[real.nobelPrizes[0]]});
const accepted = () => buildNobelProfile({document:document(),current:NOW});
const response = (value) => new Response(JSON.stringify(value),{headers:{"content-type":"application/json"}});
afterEach(()=>vi.restoreAllMocks());

describe("reviewed Nobel literature API profile",()=>{
  it("parses captured official 2025 facts and builds deterministic bilingual text without inventing 2026",async()=>{
    const result=await accepted(),items=await nobelPublishedRecords(result.payload,NOW);
    expect(items).toHaveLength(1);expect(result.payload.records[0].sourceFacts).toEqual({awardYear:"2025",dateAwarded:"2025-10-09",laureateId:"1056",knownName:"László Krasznahorkai"});
    expect(items[0]).toMatchObject({id:"nobel-literature-2025",eventKey:"nobel-literature-2025",kind:"news",category:"awards",eventDate:"2025-10-09",source:{url:"https://www.nobelprize.org/prizes/literature/2025/summary/"}});
    expect(items[0].title.ru).toContain("Нобелевская премия по литературе 2025");expect(items[0].title.en).toContain("Nobel Prize in Literature 2025");
    const current=await buildNobelProfile({document:real,current:TODAY});expect(current.payload.records).toHaveLength(0);expect(current.held).toHaveLength(2);
  });
  it("replays without changing first admission or rendered semantic content; keeps old accepted history",async()=>{
    const before=(await accepted()).payload;
    const replay=(await buildNobelProfile({document:document(),previous:before,current:TODAY})).payload;
    expect(replay.records).toEqual(before.records);expect(await nobelPublishedRecords(replay,TODAY)).toEqual(await nobelPublishedRecords(before,TODAY));
  });
  it("holds future, malformed date, unsupported multiple winners, missing knownName and changed category",async()=>{
    const cases=[{dateAwarded:"2025-12-01"},{dateAwarded:"2025-02-30"},{laureates:[]},{laureates:[...real.nobelPrizes[0].laureates,...real.nobelPrizes[0].laureates]},{category:{en:"Physics"}},{laureates:[{id:"1056",portion:"1",fullName:{en:"Only full name"}}]}];
    for(const change of cases){const source=document();Object.assign(source.nobelPrizes[0],change);const result=await buildNobelProfile({document:source,current:NOW});expect(result.payload.records).toHaveLength(0);expect(result.held[0].reason).toBe("unsupported_or_future_prize");}
    await expect(buildNobelProfile({document:{awards:[]},current:NOW})).rejects.toThrow("shape_drift");
  });
  it("holds conflicting accepted facts and duplicate award years",async()=>{
    const before=(await accepted()).payload,changed=document();changed.nobelPrizes[0].laureates[0].knownName.en="Different Person";
    const conflict=await buildNobelProfile({document:changed,previous:before,current:NOW});expect(conflict.payload.records).toEqual(before.records);expect(conflict.held[0].reason).toBe("accepted_facts_conflict");
    changed.nobelPrizes.push(real.nobelPrizes[0]);const duplicate=await buildNobelProfile({document:changed,current:NOW});expect(duplicate.payload.records).toHaveLength(0);expect(duplicate.held[0].reason).toBe("duplicate_year_conflict");
  });
  it("rejects corrupt hashes, policy changes, old records falsely admitted now and future evidence",async()=>{
    const original=(await accepted()).payload;
    for(const change of [value=>{value.profileVersion=99;},value=>{value.endpoint="https://attacker.test/";},value=>{value.records[0].sourceFacts.knownName="Different Person";},value=>{value.records[0].firstAcceptedAt=TODAY.toISOString();value.fetchedAt=TODAY.toISOString();},value=>{value.fetchedAt="2099-01-01T00:00:00Z";}]){
      const value=structuredClone(original);change(value);await expect(validateNobelApprovedPayload(value,TODAY)).rejects.toThrow();
    }
  });
  it("sync uses only the literal API, validates prior state and writes only approved payload",async()=>{
    const storage={readApprovedProfile:vi.fn(async()=>null),writeApprovedProfile:vi.fn(async()=>{})},fetchImpl=vi.fn(async()=>response(real));
    const result=await syncNobelProfile({storage,fetchImpl,current:TODAY});expect(result.newlyAccepted).toBe(0);expect(result.held).toHaveLength(2);
    expect(fetchImpl.mock.calls[0][0]).toBe(NOBEL_API_URL);expect(fetchImpl.mock.calls[0][1]).toMatchObject({redirect:"manual",headers:{Accept:"application/json"}});
    expect(storage.writeApprovedProfile).toHaveBeenCalledWith(result.payload);expect(result.payload).not.toHaveProperty("held");expect(result.sourceCapture.document).toEqual(real);
    storage.readApprovedProfile.mockResolvedValue("corrupt");await expect(syncNobelProfile({storage,fetchImpl,current:TODAY})).rejects.toThrow();expect(storage.writeApprovedProfile).toHaveBeenCalledTimes(1);
  });
  it("network/shape failure never overwrites existing approved history; oversized responses cancel",async()=>{
    const storage={readApprovedProfile:vi.fn(async()=>JSON.stringify((await accepted()).payload)),writeApprovedProfile:vi.fn(async()=>{})};
    for(const fetchImpl of [async()=>new Response("redirect",{status:302}),async()=>response({differentShape:[]}),async()=>response({nobelPrizes:[],oversized:"x".repeat(NOBEL_PROFILE_MAX_BYTES)})]) await expect(syncNobelProfile({storage,fetchImpl,current:TODAY})).rejects.toThrow();
    expect(storage.writeApprovedProfile).not.toHaveBeenCalled();
  });
  it("Worker publishes only reconstructed validated facts through the complete public snapshot",async()=>{
    const payload=(await accepted()).payload;
    payload.records[0].title={ru:"INJECTED",en:"INJECTED"};payload.sources=[{url:"https://attacker.test/"}];
    const env={NEWS_RELEASE_SHA:"a".repeat(40),NEWS_STATE:{get:vi.fn(async(key)=>key===NOBEL_PROFILE_KEY?response(payload).body:null)}};
    const result=await handleNewsRequest(new Request("https://news.probpera.ru/api/literary-news/feed?contract=2&key=private-queue"),env,NOW),feed=await result.json();
    expect(result.status).toBe(200);expect(feed.items.filter(item=>item.id==="nobel-literature-2025")).toHaveLength(1);expect(JSON.stringify(feed)).not.toMatch(/INJECTED|attacker\.test|sourceFacts|factsSha256/);
    expect(()=>parseNewsFeed(feed)).not.toThrow();await expect(verifyPublishedNewsSnapshot(feed)).resolves.toBe(feed);
    expect(env.NEWS_STATE.get.mock.calls.every(([key])=>["literary-news:v1:source-state",NOBEL_PROFILE_KEY].includes(key))).toBe(true);
  });
  it("Worker rejects unreviewed profile versions and preserves authored feed on invalid profile",async()=>{
    vi.spyOn(console,"warn").mockImplementation(()=>{});const payload=(await accepted()).payload;payload.profileVersion=99;
    const env={NEWS_RELEASE_SHA:"a".repeat(40),NEWS_STATE:{get:async(key)=>key===NOBEL_PROFILE_KEY?response(payload).body:null}};
    const feed=await(await handleNewsRequest(new Request("https://news.probpera.ru/api/literary-news/feed?contract=2"),env,NOW)).json();expect(feed.items.some(item=>item.id==="nobel-literature-2025")).toBe(false);expect(feed.snapshot.complete).toBe(true);
  });
});
