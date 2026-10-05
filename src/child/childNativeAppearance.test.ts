import { describe, expect, it, vi } from "vitest";
import { decodeChildNativeAppearanceSelection, decodeChildNativeProfileAppearance, decodeChildNativeAppearanceRestore,
  childNativeAppearanceFromScene, sameChildNativeAppearance } from "./childNativeAppearance";
import { decodeChildNativeScene } from "./childNativeScene";
const hash="a".repeat(64),owner={kind:"activity" as const,id:"home",contentChecksum:hash};
const item=(kind:"skin"|"stand"|"background")=>({slotId:kind,assetId:"asset-"+kind,entity:{kind,id:"entity-"+kind,contentChecksum:hash},
  mime:"image/png",checksum:hash,encodedBytes:16,altText:kind});
const scene=decodeChildNativeScene({status:"opened",sceneToken:"b".repeat(32),sceneId:"choice",owner,skin:item("skin"),
 stand:{geometryId:"stand.base.child-book-cloud",asset:item("stand")},background:{geometryId:"background.base.library",asset:item("background")},
 hotspots:[],remainingLifetimeMs:1000},owner,"choice")!;
const choice=()=>childNativeAppearanceFromScene(scene)!;
describe("protected profile appearance projection (no native authority)",()=>{
 it("freezes only stable owner and three-slot logical IDs",()=>{
  const selection=choice();expect(Object.isFrozen(selection)).toBe(true);expect(Object.isFrozen(selection.stand)).toBe(true);
  expect(JSON.stringify(selection)).not.toMatch(/Token|checksum|uri|approved|remainingLifetime/);expect(sameChildNativeAppearance(selection,choice())).toBe(true);
 });
 it.each(["sceneToken","resourceToken","uri","approved","rightsApproved","reviewReceipt","policyGrant"])("rejects injected %s without preserving it",field=>{
  expect(decodeChildNativeAppearanceSelection({...choice(),[field]:true})).toBeNull();
 });
 it("rejects accessors without invoking them",()=>{
  const getter=vi.fn(()=>choice().owner),value={...choice()};Object.defineProperty(value,"owner",{enumerable:true,get:getter});
  expect(decodeChildNativeAppearanceSelection(value)).toBeNull();expect(getter).not.toHaveBeenCalled();
 });
 it("refuses adult owner, arbitrary geometry, duplicate assets and newer schema",()=>{
  for(const value of [{...choice(),owner:{kind:"adult",id:"home"}},{...choice(),stand:{...choice().stand,geometryId:"adult-stand"}},
   {...choice(),background:{...choice().background,assetId:choice().skin.assetId}},{...choice(),schemaVersion:2},
   {...choice(),skin:{...choice().skin,uri:"https://example.invalid"}}])expect(decodeChildNativeAppearanceSelection(value)).toBeNull();
 });
 it("binds an absent/tombstoned or saved value to its exact native profile and revision",()=>{
  expect(decodeChildNativeProfileAppearance({profileId:"p",revision:0,selection:null},"p")?.selection).toBeNull();
  expect(decodeChildNativeProfileAppearance({profileId:"p",revision:2,selection:choice()},"p")?.revision).toBe(2);
  for(const revision of [-0,-1,Number.MAX_SAFE_INTEGER,1.5])expect(decodeChildNativeProfileAppearance({profileId:"p",revision,selection:null},"p")).toBeNull();
  expect(decodeChildNativeProfileAppearance({profileId:"p",revision:0,selection:choice()},"p")).toBeNull();
  expect(decodeChildNativeProfileAppearance({profileId:"other",revision:2,selection:choice()},"p")).toBeNull();
 });
 it("restores the same stable triad with new locale-specific bytes and new lease",()=>{
  const saved={profileId:"p",revision:2,selection:choice()};
  const localized={...scene,sceneToken:"c".repeat(32),owner:{...owner,contentChecksum:"d".repeat(64)}};
  expect(decodeChildNativeAppearanceRestore({status:"restored",...saved,scene:localized},"p",saved)?.scene?.sceneToken).toBe(localized.sceneToken);
 });
 it("rejects changed triad, revision, owner and caller approval in restored replies",()=>{
  const saved={profileId:"p",revision:2,selection:choice()},base={status:"restored",...saved,scene};
  for(const value of [{...base,revision:3},{...base,scene:{...scene,owner:{...owner,id:"other"}}},
   {...base,scene:{...scene,skin:{...scene.skin,assetId:"changed"}}},{...base,approved:true}])expect(decodeChildNativeAppearanceRestore(value,"p",saved)).toBeNull();
 });
 it("keeps missing choice distinct from denied remembered content",()=>{
  const absent={profileId:"p",revision:0,selection:null},saved={profileId:"p",revision:2,selection:choice()};
  expect(decodeChildNativeAppearanceRestore({status:"absent",...absent,scene:null},"p",absent)?.status).toBe("absent");
  expect(decodeChildNativeAppearanceRestore({status:"unavailable",...saved,scene:null},"p",saved)?.selection).toEqual(saved.selection);
  expect(decodeChildNativeAppearanceRestore({status:"restored",...absent,scene},"p",absent)).toBeNull();
 });
});
