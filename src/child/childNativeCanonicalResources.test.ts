import { afterEach, describe, expect, it, vi } from "vitest";
import { createChildCanonicalResources } from "./childNativeCanonicalResources";
import type { ChildNativeAppController } from "./childNativeAppBridge";
import { childNativeAppearanceFromScene, type ChildNativeAppearanceRestore, type ChildNativeProfileAppearance } from "./childNativeAppearance";
import { decodeChildNativeScene, type ChildNativeSceneRecipient, type ChildNativeScene, type ChildNativeSceneSlot } from "./childNativeScene";
const hash="a".repeat(64),owner={kind:"activity" as const,id:"home",contentChecksum:hash};
const slot=(kind:"skin"|"stand"|"background")=>({slotId:kind,assetId:kind,entity:{kind,id:kind,contentChecksum:hash},
  mime:"image/png",checksum:hash,encodedBytes:256,altText:kind});
function fixture() {
  let time=0;const context={token:"b".repeat(32),profileId:"native-profile"};
  let snapshot={phase:"ready",status:"child",context};
  const scene=decodeChildNativeScene({status:"opened",sceneToken:"c".repeat(32),sceneId:"fixture",owner,skin:slot("skin"),
    stand:{geometryId:"stand.base.child-book-cloud",asset:slot("stand")},background:{geometryId:"background.base.library",asset:slot("background")},
    hotspots:[],remainingLifetimeMs:5000},owner,"fixture")!;
  const images:ImageFixture[]=[];let hold=false;
  class ImageFixture {
    crossOrigin="";decoding="";naturalWidth=32;naturalHeight=16;
    onload:(()=>void)|null=null;onerror:(()=>void)|null=null;value="";
    release:(()=>void)|null=null;readonly decodingWork:Promise<void>;
    constructor(){images.push(this);this.decodingWork=hold?new Promise<void>(resolve=>{this.release=resolve;}):Promise.resolve();hold=false;}
    set src(v:string){this.value=v;queueMicrotask(()=>this.onload?.());}get src(){return this.value;}
    removeAttribute(){this.value="";}decode(){return this.decodingWork;}
  }
  vi.stubGlobal("Image",ImageFixture);
  let recipient:ChildNativeSceneRecipient|null=null;
  let saved:ChildNativeProfileAppearance={profileId:context.profileId,revision:0,selection:null};
  const scenes={readSelection:vi.fn(async():Promise<ChildNativeProfileAppearance|null>=>saved),
    remember:vi.fn(async(value:ChildNativeScene,expectedRevision:number):Promise<ChildNativeProfileAppearance|null>=>{
      if(expectedRevision!==saved.revision)return null;saved={profileId:context.profileId,revision:saved.revision+1,selection:childNativeAppearanceFromScene(value)};return saved;
    }),
    restore:vi.fn(async(expected:ChildNativeProfileAppearance):Promise<ChildNativeAppearanceRestore|null>=>{
      if(expected.revision!==saved.revision)return null;return {...saved,status:saved.selection?"restored":"absent",scene:saved.selection?scene:null};
    }),
    list:vi.fn(async()=>[]),open:vi.fn(async()=>scene),acquire:vi.fn(async(_scene:ChildNativeScene,asset:ChildNativeSceneSlot)=>({status:"available",sceneToken:scene.sceneToken,
    slotId:asset.slotId,resourceToken:"d".repeat(32),assetId:asset.assetId,entity:asset.entity,mime:asset.mime,checksum:asset.checksum,
    encodedBytes:asset.encodedBytes,uri:"planet-child-resource://local/"+"d".repeat(32),remainingLifetimeMs:4000})),
    releaseResource:vi.fn(async()=>true),release:vi.fn(async()=>true),releaseAll:vi.fn(async()=>true),
    attachRecipient:vi.fn((r:ChildNativeSceneRecipient)=>{recipient=r;return()=>{recipient=null;};})};
  const controller={scenes,getSnapshot:()=>snapshot,suspend:vi.fn(async()=>undefined)} as unknown as ChildNativeAppController;
  const resources=createChildCanonicalResources(controller,context.token,()=>time);resources.activate();
  return {resources,scenes,images,controller,scene,hold(){hold=true;},at(t:number){time=t;},
    seal(){snapshot={phase:"sealed",status:"unavailable",context};recipient?.clear();},
    replaceContext(){snapshot={...snapshot,context:{...context}};},
    saved(){return saved;},savedChoice(){saved={profileId:context.profileId,revision:2,selection:childNativeAppearanceFromScene(scene)};}};
}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe("actual decoder and canonical texture ownership (synthetic native seam only)",()=>{
  it("acquires all three original slots and synchronously detaches the recipient before disposing textures",async()=>{
    const f=fixture(),order:string[]=[];
    f.resources.attachRecipient({clear:()=>{order.push("detach");},join:async()=>{order.push("join");}});
    expect(await f.resources.select(owner,"fixture")).toBe(true);
    const textures=f.resources.getSnapshot().textures!;textures.skin.addEventListener("dispose",()=>order.push("texture-dispose"));
    expect(f.scenes.acquire.mock.calls.map(call=>call[1].slotId)).toEqual(["skin","stand","background"]);
    order.length=0;f.resources.clear();expect(order.slice(0,2)).toEqual(["detach","texture-dispose"]);
    expect(textures.skin.image).toBeNull();await f.resources.join();await f.resources.dispose();
  });
  it("holds the real image decode join after cancellation; a late result cannot republish a surface",async()=>{
    const f=fixture();f.hold();const work=f.resources.select(owner,"fixture");
    for(let n=0;n<12&&f.images.length===0;n++)await Promise.resolve();
    expect(f.images).toHaveLength(1);f.seal();let joined=false;
    const join=f.resources.join().then(()=>{joined=true;});await Promise.resolve();expect(joined).toBe(false);
    f.images[0].release?.();await join;expect(await work).toBe(false);expect(f.resources.getSnapshot().textures).toBeNull();await f.resources.dispose();
  });
  it("a copied equal context cannot own existing decoded textures",async()=>{
    const f=fixture();expect(await f.resources.select(owner,"fixture")).toBe(true);
    f.replaceContext();expect(f.resources.isCurrent()).toBe(false);f.resources.clear();await f.resources.dispose();
  });
  it("consumes the original conservative dispatch budget during decoding rather than renewing it",async()=>{
    const f=fixture();f.hold();const work=f.resources.select(owner,"fixture");
    for(let n=0;n<12&&f.images.length===0;n++)await Promise.resolve();
    f.at(6000);f.images[0].release?.();expect(await work).toBe(false);expect(f.resources.getSnapshot().phase).toBe("unavailable");await f.resources.dispose();
  });
});

describe("failed concrete recipient cleanup remains sealed",()=>{
 it("does not acknowledge a caught synchronous clear failure as a joined cleanup",async()=>{
  const f=fixture();expect(await f.resources.select(owner,"fixture")).toBe(true);
  f.resources.attachRecipient({clear(){throw Error("material detach failed");},join:async()=>undefined});
  f.resources.clear();expect(f.resources.isCurrent()).toBe(false);
  await expect(f.resources.join()).rejects.toThrow("cleanup failed");
  await expect(f.resources.dispose()).rejects.toThrow("cleanup failed");
 });
 it("removes decoded image sources together with their owned texture references",async()=>{
  const f=fixture();expect(await f.resources.select(owner,"fixture")).toBe(true);
  expect(f.images.every(image=>image.value.length>0)).toBe(true);
  f.resources.clear();expect(f.images.every(image=>image.value==="")).toBe(true);
  await f.resources.dispose();
 });
});

describe("durable profile selection and fresh restoration (synthetic native seam only)",()=>{
 it("remembers only after all three texture decoders have joined and before ready publication",async()=>{
  const f=fixture();f.hold();const pending=f.resources.select(owner,"fixture");
  for(let n=0;n<20&&f.images.length===0;n++)await Promise.resolve();
  expect(f.scenes.remember).not.toHaveBeenCalled();expect(f.resources.getSnapshot().persistence).toBe("saving");
  f.images[0].release?.();expect(await pending).toBe(true);
  expect(f.scenes.remember).toHaveBeenCalledWith(f.scene,0);expect(f.saved().revision).toBe(1);
  expect(f.resources.getSnapshot().persistence).toBe("saved");await f.resources.dispose();
 });
 it("never publishes textures when native save/readback cannot be confirmed",async()=>{
  const f=fixture();f.scenes.remember.mockResolvedValueOnce(null);
  expect(await f.resources.select(owner,"fixture")).toBe(false);
  expect(f.resources.getSnapshot()).toMatchObject({phase:"unavailable",textures:null,persistence:"save-failed"});
  expect(f.images.every(image=>image.src==="")).toBe(true);await f.resources.dispose();
 });
 it("restores the exact protected choice with fresh textures without remembering it again",async()=>{
  const f=fixture();f.savedChoice();expect(await f.resources.restore!()).toBe(true);
  expect(f.scenes.open).not.toHaveBeenCalled();expect(f.scenes.restore).toHaveBeenCalledWith(f.saved());
  expect(f.scenes.remember).not.toHaveBeenCalled();expect(f.scenes.acquire).toHaveBeenCalledTimes(3);await f.resources.dispose();
 });
 it("does not reset or rewrite a remembered choice denied by current approval",async()=>{
  const f=fixture();f.savedChoice();const before=f.saved();
  f.scenes.restore.mockResolvedValueOnce({...before,status:"unavailable",scene:null});
  expect(await f.resources.restore!()).toBe(false);expect(f.saved()).toBe(before);expect(f.scenes.remember).not.toHaveBeenCalled();
  expect(f.resources.getSnapshot().persistence).toBe("restore-failed");await f.resources.dispose();
 });
 it("an absent legacy choice leaves a neutral child scene and performs no media acquisition/write",async()=>{
  const f=fixture();expect(await f.resources.restore!()).toBe(true);
  expect(f.resources.getSnapshot().phase).toBe("empty");expect(f.scenes.acquire).not.toHaveBeenCalled();expect(f.scenes.remember).not.toHaveBeenCalled();
  await f.resources.dispose();
 });
 it("a failed predecessor cannot revoke or overwrite a later selection after its delayed cleanup",async()=>{
  const f=fixture();let release!:()=>void,joins=0;
  const delayed=new Promise<void>(resolve=>{release=resolve;});
  f.resources.attachRecipient({clear(){},join:()=>++joins===2?delayed:Promise.resolve()});
  f.scenes.remember.mockResolvedValueOnce(null);
  const failed=f.resources.select(owner,"fixture");
  for(let n=0;n<120&&joins<2;n++)await Promise.resolve();expect(joins).toBe(2);
  expect(await f.resources.select(owner,"fixture")).toBe(true);
  const ready=f.resources.getSnapshot(),releases=f.scenes.releaseAll.mock.calls.length;
  release();expect(await failed).toBe(false);
  expect(f.resources.getSnapshot()).toBe(ready);expect(f.scenes.releaseAll).toHaveBeenCalledTimes(releases);
  await f.resources.dispose();
 });
 it("explicit selection fences a delayed automatic restore",async()=>{
  const f=fixture();f.savedChoice();let resolve!:(value:ChildNativeAppearanceRestore|null)=>void;
  f.scenes.restore.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const late=f.resources.restore!();for(let n=0;n<20&&f.scenes.restore.mock.calls.length===0;n++)await Promise.resolve();
  const selected=f.resources.select(owner,"fixture");resolve({...f.saved(),status:"restored",scene:f.scene});
  expect(await late).toBe(false);expect(await selected).toBe(true);expect(f.saved().revision).toBe(3);await f.resources.dispose();
 });
});
