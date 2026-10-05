import { describe, expect, it } from "vitest";
import { decodeChildNativeJourneyProgress, decodeChildNativeJourneySummaries, decodeChildNativeProfileJourney,
  decodeChildNativeJourneyResult } from "./childNativeJourney";
const progress = () => ({schemaVersion:1,journeyId:"journey",journeyVersion:2,contentVersion:2,currentNodeId:"country",
  completedNodeIds:["archived-node"],selectedCountryId:null,selectedWriterId:null,selectedWorkId:null,lastSafeRoute:"journey"});
const summary = () => ({journeyId:"journey",journeyVersion:2,contentVersion:2,title:"Reviewed DTO fixture",description:"Data shape only.",nodeCount:2});
const result = () => ({status:"restored",profileId:"profile-a",revision:3,progress:progress(),journey:{...summary(),nodeIds:["country","writer"]},
  node:{reference:{kind:"country",id:"country",contentChecksum:"a".repeat(64)},payload:{title:"Country fixture",text:"Fixture only.",terms:[],references:[]}}});
describe("child native semantic journey presentation projection",()=>{
  it("copies and freezes bounded canonical semantic IDs including archived completions without authority fields",()=>{
    const raw=progress(),decoded=decodeChildNativeJourneyProgress(raw)!;expect(decoded).not.toBeNull();raw.completedNodeIds.push("later");
    expect(decoded.completedNodeIds).toEqual(["archived-node"]);expect(Object.isFrozen(decoded)).toBe(true);expect(Object.isFrozen(decoded.completedNodeIds)).toBe(true);
    expect(JSON.stringify(decoded)).not.toMatch(/token|url|approved|checksum/u);
  });
  it("denies tokens URLs review booleans and future schema fields in progress",()=>{
    for(const [key,value] of [["nodeToken","b".repeat(32)],["uri","https://example.test"],["approved",true],["schemaVersion",2]] as const)
      expect(decodeChildNativeJourneyProgress({...progress(),[key]:value})).toBeNull();
  });
  it("rejects getters without calling them and inherited semantic authority",()=>{
    let called=false;const raw=progress();Object.defineProperty(raw,"journeyId",{enumerable:true,get(){called=true;return "journey";}});
    expect(decodeChildNativeJourneyProgress(raw)).toBeNull();expect(called).toBe(false);expect(decodeChildNativeJourneyProgress(Object.create(progress()))).toBeNull();
  });
  it("denies malformed IDs duplicate sparse completions oversized history and unsafe versions",()=>{
    for(const patch of [{journeyId:"../journey"},{currentNodeId:"https://test"},{completedNodeIds:["node","node"]},
      {completedNodeIds:Array(65).fill("node")},{completedNodeIds:new Array(2)},{journeyVersion:0},{contentVersion:-0},{contentVersion:Number.MAX_SAFE_INTEGER}])
      expect(decodeChildNativeJourneyProgress({...progress(),...patch})).toBeNull();
  });
  it("binds profile and safe revision independently from stored semantic progress",()=>{
    expect(decodeChildNativeProfileJourney({profileId:"profile-a",revision:0,progress:null},"profile-a")).toEqual({profileId:"profile-a",revision:0,progress:null});
    expect(decodeChildNativeProfileJourney({profileId:"profile-b",revision:0,progress:progress()},"profile-a")).toBeNull();
    expect(decodeChildNativeProfileJourney({profileId:"profile-a",revision:-0,progress:progress()},"profile-a")).toBeNull();
  });
  it("accepts equal RU/EN titles only as bounded native-listed metadata and rejects duplicate roots",()=>{
    expect(decodeChildNativeJourneySummaries([{...summary(),title:"Путешествие"}])?.[0].title).toBe("Путешествие");
    expect(decodeChildNativeJourneySummaries([summary(),summary()])).toBeNull();
    expect(decodeChildNativeJourneySummaries([{...summary(),nodeCount:0}])).toBeNull();
    expect(decodeChildNativeJourneySummaries([{...summary(),title:"bad\nline"}])).toBeNull();
  });
  it("requires freshly returned node ID package content version and exact journey identity",()=>{
    const raw=result();expect(decodeChildNativeJourneyResult(raw,"profile-a","journey",2)?.node?.reference.id).toBe("country");
    expect(decodeChildNativeJourneyResult(raw,"profile-a","other",2)).toBeNull();expect(decodeChildNativeJourneyResult(raw,"profile-a","journey",3)).toBeNull();
    raw.node.reference.id="writer";expect(decodeChildNativeJourneyResult(raw,"profile-a","journey",2)).toBeNull();
  });
  it("refuses orphan cyclic or mismatched graph node inventories",()=>{
    for(const ids of [["country","country"],["journey","writer"],["writer","work"],["country"]]){
      const raw=result();raw.journey.nodeIds=ids;expect(decodeChildNativeJourneyResult(raw,"profile-a","journey",2)).toBeNull();
    }
  });
  it("finished state requires explicit completed IDs for every current graph node and no text node",()=>{
    const raw={...result(),progress:{...progress(),currentNodeId:null,completedNodeIds:["archived-node","country","writer"]},node:null};
    expect(decodeChildNativeJourneyResult(raw,"profile-a","journey",2)?.node).toBeNull();
    expect(decodeChildNativeJourneyResult({...raw,progress:{...raw.progress,completedNodeIds:["country"]}},"profile-a","journey",2)).toBeNull();
    expect(decodeChildNativeJourneyResult({...raw,node:result().node},"profile-a","journey",2)).toBeNull();
  });
  it("unavailable progress never carries a node or a route and remains profile bound",()=>{
    const raw={...result(),status:"unavailable",journey:null,node:null};expect(decodeChildNativeJourneyResult(raw,"profile-a","journey",2)?.progress).not.toBeNull();
    expect(decodeChildNativeJourneyResult({...raw,node:result().node},"profile-a","journey",2)).toBeNull();
    expect(decodeChildNativeJourneyResult({...raw,status:"absent"},"profile-a","journey",2)).toBeNull();
  });
});