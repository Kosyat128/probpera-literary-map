import { describe, expect, it } from "vitest";
import pins from "./childNativeSceneReleasePins.json";
import { decodeChildNativeScene, decodeChildNativeScenePins, decodeChildNativeSceneHotspots, decodeChildNativeWebResource,
  decodeChildNativeSceneSummaries } from "./childNativeScene";
const hash="a".repeat(64), owner={kind:"activity" as const,id:"home",contentChecksum:hash};
const slot=(kind:"skin"|"stand"|"background")=>({slotId:kind,assetId:String(kind),entity:{kind,id:kind,contentChecksum:hash},
  mime:"image/png" as const,checksum:hash,encodedBytes:256,altText:"Original fixture "+kind});
const raw=()=>({status:"opened",sceneToken:"b".repeat(32),sceneId:"fixture-scene",owner,skin:slot("skin"),
  stand:{geometryId:"stand.base.child-book-cloud",asset:slot("stand")},background:{geometryId:"background.base.library",asset:slot("background")},
  hotspots:[{id:"book",target:owner,position:[0,1,-3],radius:.2}],remainingLifetimeMs:5000});
describe("closed native scene presentation correlations, no authority",()=>{
  it("preserves authentic empty production pins and rejects asserted approval fields",()=>{
    expect(decodeChildNativeScenePins(pins)).toEqual(pins);
    expect(decodeChildNativeScenePins({...pins,approved:true})).toBeNull();
    expect(decodeChildNativeScenePins({...pins,reviewKeys:[{keyId:"child-scene-review-test",reviewerId:"tester",publicKeyX963Hex:"04"+"a".repeat(128),verified:true}]})).toBeNull();
  });
  it("copies and freezes every child scene slot, target and geometry tuple",()=>{
    const input=raw(),scene=decodeChildNativeScene(input,owner,input.sceneId)!;
    expect(scene).not.toBeNull();input.skin.assetId="changed";input.hotspots[0].position[0]=8;
    expect(scene.skin.assetId).toBe("skin");expect(scene.hotspots[0].position).toEqual([0,1,-3]);
    expect(Object.isFrozen(scene.background.asset)).toBe(true);expect(Object.isFrozen(scene.hotspots[0].position)).toBe(true);
  });
  it("does not admit adult geometry IDs or a texture with a different media role",()=>{
    const input=raw();input.stand.geometryId="canonical";
    expect(decodeChildNativeScene(input,owner,input.sceneId)).toBeNull();
    const other=raw();other.skin.entity.kind="stand" as "skin";
    expect(decodeChildNativeScene(other,owner,other.sceneId)).toBeNull();
  });
  it.each([[0,0,1.4,.2],[10,0,10,.1],[0,6,3,.1],[0,0,3,0]])("rejects hotspot intersecting globe or outside actual room",(x,y,z,radius)=>{
    expect(decodeChildNativeSceneHotspots([{id:"point",target:owner,position:[x,y,z],radius}])).toBeNull();
  });
  it("accepts bounded fractional position and native guard target without a navigation URL",()=>{
    expect(decodeChildNativeSceneHotspots([{id:"point",target:owner,position:[.25,1,-3.5],radius:.15}])).not.toBeNull();
    expect(decodeChildNativeSceneHotspots([{id:"point",target:owner,position:[.25,1,-3.5],radius:.15,url:"https://adult.invalid"}])).toBeNull();
  });
  it("requires exact scene/slot/entity and immutable native URI correlation",()=>{
    const scene=decodeChildNativeScene(raw(),owner,"fixture-scene")!,skin=scene.skin;
    const output={status:"available",sceneToken:scene.sceneToken,slotId:"skin",resourceToken:"c".repeat(32),assetId:skin.assetId,entity:skin.entity,
      mime:skin.mime,checksum:skin.checksum,encodedBytes:skin.encodedBytes,uri:"planet-child-resource://local/"+"c".repeat(32),remainingLifetimeMs:3000};
    expect(decodeChildNativeWebResource(output,scene,skin)).not.toBeNull();
    for(const change of [{uri:"https://native.invalid/resource"},{uri:output.uri+"?proof=true"},{sceneToken:"d".repeat(32)},{encodedBytes:257},{slotId:"stand"}])
      expect(decodeChildNativeWebResource({...output,...change},scene,skin)).toBeNull();
  });
  it("rejects duplicate or foreign-owner choices before labels are rendered",()=>{
    expect(decodeChildNativeSceneSummaries([{sceneId:"one",title:"One",owner},{sceneId:"one",title:"Again",owner}],owner)).toBeNull();
    expect(decodeChildNativeSceneSummaries([{sceneId:"one",title:"One",owner:{...owner,id:"other"}}],owner)).toBeNull();
  });
});

describe("unambiguous scene metadata tokens",()=>{
 it("rejects newline-suffixed identities/digests and negative zero coordinates",()=>{
  const input=raw();input.skin.checksum+="\n";expect(decodeChildNativeScene(input,owner,input.sceneId)).toBeNull();
  const id=raw();id.sceneId+="\n";expect(decodeChildNativeScene(id,owner,id.sceneId)).toBeNull();
  expect(decodeChildNativeSceneHotspots([{id:"point",target:owner,position:[-0,1,3],radius:.2}])).toBeNull();
 });
});
