import { describe, expect, it } from "vitest";
import { deferUnreadyNewsPhotos, selectDueNewsMediaJobs, selectNewsPhotoPreparationIds } from "./publish-literary-news.mjs";
import { scheduleNewsJobs } from "./lib/literary-news-social.mjs";

describe("bounded byte preparation makes durable progress without duplicate writes",()=>{
  it("a reserved create slot skips photo preparation but leaves existing-post corrections available",()=>{
    const now=new Date("2026-09-27T00:00:00Z"),controls=new Map([["telegram:-1001",{mode:"on",paused:false,historyReconciled:true}]]);
    const pacing=new Map([["telegram:-1001",{nextDueAt:"2026-09-27T00:30:00Z"}]]);
    const rows=[{state:{key:"new",newsId:"new",status:"pending",originalAdmission:now.toISOString(),destination:{platform:"telegram",id:"-1001"}}},
      {state:{key:"edit",newsId:"edit",status:"correction_pending",remoteId:"17",originalAdmission:now.toISOString(),destination:{platform:"telegram",id:"-1001"}}}];
    expect(selectDueNewsMediaJobs(rows,controls,now,pacing).map(job=>job.key)).toEqual(["edit"]);
  });
  it("cycles through all sixty permanently unavailable photos instead of a repeating first-forty-eight failure ring",async()=>{
    const start=Date.parse("2026-09-27T00:00:00Z"),states=new Map(),seen=new Set();
    const controls=new Map([["telegram:-1001",{mode:"on",paused:false,historyReconciled:true}]]);
    for(let n=0;n<60;n++)states.set(`post:${n}`,{id:n+1,state:{key:`post:${n}`,newsId:`news-${n}`,status:"pending",
      originalAdmission:new Date(start+n*1000).toISOString(),destination:{platform:"telegram",id:"-1001"},
      prepared:{media:{assetId:`asset-${n}`}}}});
    const store={async compareAppend(key,id,state){const old=states.get(key);if(old.id!==id)return{applied:false,...old};
      const next={id:id+100,state};states.set(key,next);return{applied:true,...next};}};
    for(let run=0;run<18;run++){
      const now=new Date(start+run*600000),rows=[...states.values()],due=selectDueNewsMediaJobs(rows,controls,now);
      const photoNewsIds=selectNewsPhotoPreparationIds(due);expect(photoNewsIds.length).toBeLessThanOrEqual(8);
      for(const id of photoNewsIds)seen.add(id);
      await deferUnreadyNewsPhotos({store,rows,due,photoNewsIds,readyAssets:new Set(),mediaPreparation:[],now});
      if(run===7)expect(seen.size).toBe(60);
    }
    expect(seen.size).toBe(60);
    expect([...states.values()].every(row=>row.state.mediaPreparationFailedAt&&row.state.prepared.media&&!row.state.remoteId)).toBe(true);
  });
  it("a destination cooldown excludes its photos before the eight-download selection",()=>{
    const now=new Date("2026-09-27T00:00:00Z"),controls=new Map([
      ["telegram:-1001",{mode:"on",paused:false,historyReconciled:true,nextDueAt:"2026-09-27T01:00:00Z"}],
      ["telegram:-1002",{mode:"on",paused:false,historyReconciled:true}]]);
    const rows=Array.from({length:10},(_,n)=>({state:{key:`post:${n}`,newsId:`news-${n}`,status:"pending",
      originalAdmission:`${n}`,destination:{platform:"telegram",id:n<8?"-1001":"-1002"},prepared:{media:{assetId:`asset-${n}`}}}}));
    expect(selectDueNewsMediaJobs(rows,controls,now).map(job=>job.newsId).sort()).toEqual(["news-8","news-9"]);
  });
  it("backs off eight unavailable portraits so later due photos are selected next, preserving concurrent remote receipts",async()=>{
    const now=new Date("2026-09-27T00:00:00Z"),states=new Map();
    const rows=Array.from({length:10},(_,n)=>({id:n+1,state:{key:`post:news:${n}`,newsId:`news-${n}`,status:"pending",
      originalAdmission:new Date(now.getTime()+n*1000).toISOString(),prepared:{media:{assetId:`asset-${n}`}}}}));
    for(const row of rows)states.set(row.state.key,structuredClone(row));
    const due=scheduleNewsJobs(rows.map(row=>row.state)),photoNewsIds=due.slice(0,8).map(row=>row.newsId);
    const raced=due[0];states.set(raced.key,{id:99,state:{...raced,status:"sent_current",remoteId:"17"}});
    const store={async compareAppend(key,id,state){const old=states.get(key);if(old.id!==id)return{applied:false,...old};
      const next={id:id+100,state};states.set(key,next);return{applied:true,...next};}};
    const outcomes=await deferUnreadyNewsPhotos({store,rows,due,photoNewsIds,readyAssets:new Set(),mediaPreparation:[],now});
    expect(outcomes.filter(row=>row.applied)).toHaveLength(7);expect(states.get(raced.key).state.remoteId).toBe("17");
    const next=scheduleNewsJobs([...states.values()].map(row=>row.state)).filter(job=>!job.nextDueAt||Date.parse(job.nextDueAt)<=now.getTime()+600000);
    expect(next.map(job=>job.newsId).sort()).toEqual(due.slice(8).map(job=>job.newsId).sort());
    for(const job of [...states.values()].map(row=>row.state).filter(job=>job.nextDueAt)){
      expect(job.lastError).toBe("media_registered_asset_unavailable");expect(job.nextDueAt).toBe("2026-09-27T01:00:00.000Z");
      expect(job.prepared.media).toBeTruthy();expect(job.remoteId).toBeUndefined();
    }
  });
});
