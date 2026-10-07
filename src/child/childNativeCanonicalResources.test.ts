import { afterEach, describe, expect, it, vi } from "vitest";
import { createChildCanonicalResources } from "./childNativeCanonicalResources";
import type { ChildNativeAppController } from "./childNativeAppBridge";
import { childNativeAppearanceFromScene, type ChildNativeAppearanceRestore, type ChildNativeProfileAppearance } from "./childNativeAppearance";
import { decodeChildNativeScene, type ChildNativeSceneRecipient, type ChildNativeScene, type ChildNativeSceneSlot } from "./childNativeScene";
import { common3dFixture } from "./childCommon3dFixture";
import type { Common3dResource, Common3dTierId } from "./childCommon3d";
import { webcrypto } from "node:crypto";
const hash="a".repeat(64),owner={kind:"activity" as const,id:"home",contentChecksum:hash};
const slot=(kind:"skin"|"stand"|"background")=>({slotId:kind,assetId:kind,entity:{kind,id:kind,contentChecksum:hash},
  mime:"image/png",checksum:hash,encodedBytes:256,altText:kind});
function fixture(resourceLifetimeMs=4000,stallImageLoad=false) {
  let time=0;const context={token:"b".repeat(32),profileId:"native-profile"};
  let snapshot={phase:"ready",status:"child",context};
  const scene=decodeChildNativeScene({status:"opened",sceneToken:"c".repeat(32),sceneId:"fixture",owner,skin:slot("skin"),
    stand:{geometryId:"stand.base.child-book-cloud",asset:slot("stand")},background:{geometryId:"background.base.library",asset:slot("background")},
    hotspots:[],remainingLifetimeMs:resourceLifetimeMs+1000},owner,"fixture")!;
  const images:ImageFixture[]=[];let hold=false;
  class ImageFixture {
    crossOrigin="";decoding="";naturalWidth=32;naturalHeight=16;
    onload:(()=>void)|null=null;onerror:(()=>void)|null=null;value="";
    release:(()=>void)|null=null;readonly decodingWork:Promise<void>;
    constructor(){images.push(this);this.decodingWork=hold?new Promise<void>(resolve=>{this.release=resolve;}):Promise.resolve();hold=false;}
    set src(v:string){this.value=v;if(!stallImageLoad)queueMicrotask(()=>this.onload?.());}get src(){return this.value;}
    removeAttribute(){this.value="";}decode(){return this.decodingWork;}
  }
  vi.stubGlobal("Image",ImageFixture);
  let recipient:ChildNativeSceneRecipient|null=null;
  let saved:ChildNativeProfileAppearance={profileId:context.profileId,revision:0,selection:null};
  const nativePrior=new Map<string,{prior:ChildNativeProfileAppearance;committedRevision:number}>();
  const scenes={readSelection:vi.fn(async():Promise<ChildNativeProfileAppearance|null>=>saved),
    remember:vi.fn(async(value:ChildNativeScene,expectedRevision:number):Promise<ChildNativeProfileAppearance|null>=>{
      if(expectedRevision!==saved.revision)return null;const prior=saved;saved={profileId:context.profileId,revision:saved.revision+1,selection:childNativeAppearanceFromScene(value)};nativePrior.set(value.sceneToken,{prior,committedRevision:saved.revision});return saved;
    }),
    rollback:vi.fn(async(value:ChildNativeScene,expectedRevision:number):Promise<ChildNativeProfileAppearance|null>=>{
      const captured=nativePrior.get(value.sceneToken);if(!captured||captured.committedRevision!==expectedRevision||saved.revision!==expectedRevision)return null;
      nativePrior.delete(value.sceneToken);saved={profileId:context.profileId,revision:expectedRevision+1,selection:captured.prior.selection};return saved;
    }),
    restore:vi.fn(async(expected:ChildNativeProfileAppearance):Promise<ChildNativeAppearanceRestore|null>=>{
      if(expected.revision!==saved.revision)return null;return {...saved,status:saved.selection?"restored":"absent",scene:saved.selection?scene:null};
    }),
    list:vi.fn(async()=>[]),open:vi.fn(async():Promise<ChildNativeScene|null>=>scene),acquire:vi.fn(async(_scene:ChildNativeScene,asset:ChildNativeSceneSlot)=>({status:"available",sceneToken:scene.sceneToken,
    slotId:asset.slotId,resourceToken:"d".repeat(32),assetId:asset.assetId,entity:asset.entity,mime:asset.mime,checksum:asset.checksum,
    encodedBytes:asset.encodedBytes,uri:"planet-child-resource://local/"+"d".repeat(32),remainingLifetimeMs:resourceLifetimeMs})),
    releaseResource:vi.fn(async()=>true),release:vi.fn(async()=>true),releaseAll:vi.fn(async()=>true),
    attachRecipient:vi.fn((r:ChildNativeSceneRecipient)=>{recipient=r;return()=>{recipient=null;};})};
  const controller={scenes,getSnapshot:()=>snapshot,suspend:vi.fn(async()=>undefined)} as unknown as ChildNativeAppController;
  const resources=createChildCanonicalResources(controller,context.token,()=>time);resources.activate();
  return {resources,scenes,images,controller,scene,hold(){hold=true;},at(t:number){time=t;},
    seal(){snapshot={phase:"sealed",status:"unavailable",context};recipient?.clear();},
    replaceContext(){snapshot={...snapshot,context:{...context}};},
    saved(){return saved;},savedChoice(value:ChildNativeScene=scene){saved={profileId:context.profileId,revision:2,selection:childNativeAppearanceFromScene(value)};}};
}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe("actual decoder and canonical texture ownership (synthetic native seam only)",()=>{
  it("never calls a renderless selection a visible preview",async()=>{
    const f=fixture();expect(await f.resources.preview(owner,"fixture")).toBe(false);
    expect(f.scenes.open).not.toHaveBeenCalled();expect(f.scenes.remember).not.toHaveBeenCalled();
    expect(await f.resources.applyPreview()).toBe(false);expect(await f.resources.cancelPreview()).toBe(false);await f.resources.dispose();
  });
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

describe("resource-owned navigation cancellation barrier",()=>{
  it("cancels a stalled pre-onload image without decoding or waiting for its original deadline",async()=>{
    vi.useFakeTimers({toFake:["setTimeout","clearTimeout"]});
    const f=fixture(4000,true),selection=f.resources.select(owner,"fixture");
    for(let n=0;n<20&&f.images.length===0;n++)await Promise.resolve();
    expect(f.images).toHaveLength(1);expect(f.images[0].src).toMatch(/^planet-child-resource:/);
    const decode=vi.spyOn(f.images[0],"decode"),leaving=f.resources.cancelAndWait();
    // No timer advancement: only cancellation can settle this transport.
    expect(await selection).toBe(false);expect(await leaving).toBe(true);
    expect(decode).not.toHaveBeenCalled();expect(f.images[0].src).toBe("");
    expect(f.scenes.acquire).toHaveBeenCalledOnce();expect(f.scenes.remember).not.toHaveBeenCalled();
    expect(f.scenes.release).toHaveBeenCalledWith(f.scene.sceneToken);expect(f.controller.suspend).not.toHaveBeenCalled();
    expect(f.resources.getSnapshot().textures).toBeNull();await f.resources.dispose();
  });
  it.each(["restore","select"] as const)("joins an invisible pending %s and releases its late native lease before granting navigation",async(kind)=>{
    const f=fixture();expect(await f.resources.select(owner,"fixture")).toBe(true);
    const baseline=f.resources.getSnapshot(),saved=f.saved(),candidate={...f.scene,sceneToken:"e".repeat(32)};
    let deliver!:()=>void;const reply=new Promise<void>(resolve=>{deliver=resolve;});
    if(kind==="restore")f.scenes.restore.mockImplementationOnce(async()=>{await reply;return {...saved,status:"restored" as const,scene:candidate};});
    else f.scenes.open.mockImplementationOnce(async()=>{await reply;return candidate;});
    const pending=kind==="restore"?f.resources.restore!():f.resources.select(owner,"fixture");
    await vi.waitFor(()=>expect(kind==="restore"?f.scenes.restore.mock.calls.length:f.scenes.open.mock.calls.length).toBe(kind==="restore"?1:2));
    expect(f.resources.getSnapshot().preview??null).toBeNull();
    let settled=false;const leaving=f.resources.cancelAndWait().then(value=>{settled=true;return value;});
    await Promise.resolve();await Promise.resolve();expect(settled).toBe(false);
    expect(f.resources.getSnapshot().textures).toBe(baseline.textures);expect(baseline.textures!.skin.image).not.toBeNull();
    deliver();expect(await pending).toBe(false);expect(await leaving).toBe(true);
    expect(f.scenes.release).toHaveBeenCalledWith(candidate.sceneToken);
    expect(f.scenes.release).not.toHaveBeenCalledWith(f.scene.sceneToken);
    expect(f.scenes.acquire).toHaveBeenCalledTimes(3);expect(f.scenes.remember).toHaveBeenCalledOnce();
    expect(f.saved()).toBe(saved);expect(f.resources.getSnapshot().textures).toBe(baseline.textures);
    expect(f.resources.isCurrent()).toBe(true);expect(f.controller.suspend).not.toHaveBeenCalled();await f.resources.dispose();
  });
  it("grants an admitted idle owner without clearing it but refuses lifecycle or context revocation before acknowledgement",async()=>{
    const f=fixture();expect(await f.resources.cancelAndWait()).toBe(true);
    expect(f.scenes.readSelection).not.toHaveBeenCalled();expect(f.scenes.releaseAll).not.toHaveBeenCalled();
    expect(await f.resources.select(owner,"fixture")).toBe(true);const baseline=f.resources.getSnapshot();
    expect(await f.resources.cancelAndWait()).toBe(true);expect(f.resources.getSnapshot().textures).toBe(baseline.textures);
    expect(baseline.textures!.skin.image).not.toBeNull();expect(f.scenes.remember).toHaveBeenCalledOnce();
    const oldContext=f.resources.cancelAndWait();f.replaceContext();expect(await oldContext).toBe(false);
    f.resources.clear();await f.resources.dispose();expect(await f.resources.cancelAndWait()).toBe(false);

    const stopped=fixture();stopped.hold();const decoding=stopped.resources.select(owner,"fixture");
    await vi.waitFor(()=>expect(stopped.images).toHaveLength(1));
    const leaving=stopped.resources.cancelAndWait();stopped.seal();stopped.images[0].release!();
    expect(await decoding).toBe(false);expect(await leaving).toBe(false);
    expect(stopped.resources.getSnapshot().textures).toBeNull();expect(stopped.scenes.remember).not.toHaveBeenCalled();
    await stopped.resources.dispose();
  });
  it("times out navigation after five seconds without abandoning late CAS compensation or renewing the baseline lease",async()=>{
    vi.useFakeTimers({toFake:["setTimeout","clearTimeout"]});
    const f=fixture(12000);expect(await f.resources.select(owner,"fixture")).toBe(true);
    const baseline=f.resources.getSnapshot(),saved=f.saved(),candidate={...f.scene,sceneToken:"e".repeat(32)};
    f.scenes.open.mockResolvedValueOnce(candidate);
    const remember=f.scenes.remember.getMockImplementation()!;
    let acknowledge!:()=>void,written!:()=>void;
    const held=new Promise<void>(resolve=>{acknowledge=resolve;}),committed=new Promise<void>(resolve=>{written=resolve;});
    f.scenes.remember.mockImplementationOnce(async(scene,revision)=>{
      const reply=await remember(scene,revision);written();await held;return reply;
    });
    const pending=f.resources.select(owner,"fixture");await committed;expect(f.saved().revision).toBe(2);
    let settled=false;const leaving=f.resources.cancelAndWait().then(value=>{settled=true;return value;});
    f.at(4999);await vi.advanceTimersByTimeAsync(4999);expect(settled).toBe(false);
    f.at(5000);await vi.advanceTimersByTimeAsync(1);expect(await leaving).toBe(false);
    expect(f.scenes.rollback).not.toHaveBeenCalled();expect(f.scenes.release).not.toHaveBeenCalledWith(candidate.sceneToken);
    expect(f.resources.getSnapshot().textures).toBe(baseline.textures);expect(baseline.textures!.skin.image).not.toBeNull();
    expect(f.controller.suspend).not.toHaveBeenCalled();expect(f.scenes.releaseAll).not.toHaveBeenCalled();
    acknowledge();expect(await pending).toBe(false);await f.resources.join();
    expect(f.scenes.rollback).toHaveBeenCalledWith(candidate,2);
    expect(f.saved()).toEqual({...saved,revision:3});expect(f.scenes.release).toHaveBeenCalledWith(candidate.sceneToken);
    expect(f.resources.getSnapshot().textures).toBe(baseline.textures);expect(f.resources.isCurrent()).toBe(true);
    expect(f.controller.suspend).not.toHaveBeenCalled();expect(f.scenes.open).toHaveBeenCalledTimes(2);
    f.at(11999);await vi.advanceTimersByTimeAsync(6999);expect(f.resources.isCurrent()).toBe(true);
    f.at(12000);await vi.advanceTimersByTimeAsync(1);expect(f.resources.isCurrent()).toBe(false);
    expect(baseline.textures!.skin.image).toBeNull();expect(f.scenes.releaseAll).toHaveBeenCalledOnce();await f.resources.dispose();
  });
});

describe("versioned typed model transaction through the original scene port",()=>{
 function modelFixture(){
  const f=fixture(),g=common3dFixture(),id=g.pack.packageId+".v"+g.pack.packageVersion;
  const modelScene=decodeChildNativeScene({...f.scene,sceneToken:"e".repeat(32),sceneId:id,modelPackage:g.pack},owner,id)!;
  const acquireModel=vi.fn(async(scene:ChildNativeScene,r:Common3dResource,_tier:Common3dTierId)=>({status:"available" as const,sceneToken:scene.sceneToken,slotId:r.kind,resourceToken:"f".repeat(32),assetId:r.assetId,entity:r.entity,mime:r.mime,checksum:r.checksum,encodedBytes:r.encodedBytes,uri:"planet-child-resource://local/"+r.assetId,remainingLifetimeMs:4000}));
  const readModelChunk=vi.fn(async(scene:ChildNativeScene,output:any,r:Common3dResource,offset:number,byteLength:number)=>{const bytes=r.kind==="model"?g.bytes:g.buffer;return {status:"available" as const,sceneToken:scene.sceneToken,resourceToken:output.resourceToken,offset,totalBytes:r.encodedBytes,mime:r.mime,encodedBase64:Buffer.from(bytes.subarray(offset,offset+byteLength)).toString("base64"),remainingLifetimeMs:3500};});
  Object.assign(f.scenes,{acquireModel,readModelChunk});vi.stubGlobal("crypto",webcrypto);
  const fetcher=vi.fn(()=>Promise.reject(Error("Typed native URI must never use fetch")));vi.stubGlobal("fetch",fetcher);
  return {...f,g,id,modelScene,acquireModel,readModelChunk,fetcher};
 }
 it("imports real buffers, warms the original recipient, then remembers and commits in order",async()=>{
  const f=modelFixture(),events:string[]=[],commit=vi.fn(()=>{events.push("commit");}),rollback=vi.fn();
  f.scenes.open.mockResolvedValueOnce(f.modelScene);f.scenes.remember.mockImplementationOnce(async(scene,expected)=>{events.push("remember");return {profileId:"native-profile",revision:expected+1,selection:childNativeAppearanceFromScene(scene)};});
  f.resources.attachRenderer!("balanced",async b=>{expect(b.models.get("stand")?.root.children.length).toBe(1);events.push("warm");return {commit,rollback};});
  expect(await f.resources.select(owner,f.id)).toBe(true);expect(events).toEqual(["warm","remember","commit"]);
  expect(f.acquireModel.mock.calls.map(c=>[c[1].kind,c[2]])).toEqual([["model","balanced"],["buffer","balanced"]]);expect(f.readModelChunk).toHaveBeenCalledTimes(2);expect(f.fetcher).not.toHaveBeenCalled();expect(rollback).not.toHaveBeenCalled();await f.resources.dispose();
 });
 it("keeps the prior valid composition and protected choice when exact acquired dependency bytes fail",async()=>{
  const f=modelFixture();f.resources.attachRenderer!("balanced",async()=>({commit(){},rollback(){}}));expect(await f.resources.select(owner,"fixture")).toBe(true);
  const prior=f.resources.getSnapshot(),saved=f.saved();f.scenes.open.mockResolvedValueOnce(f.modelScene);f.g.buffer[0]^=1;
  expect(await f.resources.select(owner,f.id)).toBe(false);expect(f.resources.getSnapshot().textures).toBe(prior.textures);expect(f.resources.isCurrent()).toBe(true);expect(f.saved()).toBe(saved);
  expect(f.scenes.release).toHaveBeenCalledWith(f.modelScene.sceneToken);expect(f.scenes.releaseAll).not.toHaveBeenCalled();await f.resources.dispose();
 });
 it("rolls back an offstate warm failure and never writes the native choice",async()=>{
  const f=modelFixture();f.scenes.open.mockResolvedValueOnce(f.modelScene);f.resources.attachRenderer!("balanced",async()=>null);
  expect(await f.resources.select(owner,f.id)).toBe(false);expect(f.scenes.remember).not.toHaveBeenCalled();expect(f.resources.getSnapshot().models).toBeUndefined();await f.resources.dispose();
 });
 it("joins cancelled warm work, disposes its decoded model and refuses late promotion",async()=>{
  const f=modelFixture();f.scenes.open.mockResolvedValueOnce(f.modelScene);let finish!:(s:{commit():void;rollback():void})=>void;const commit=vi.fn(),rollback=vi.fn();
  const stage=vi.fn(()=>new Promise<{commit():void;rollback():void}>(done=>{finish=done;}));f.resources.attachRenderer!("balanced",stage);const pending=f.resources.select(owner,f.id);
  for(let n=0;n<200&&stage.mock.calls.length===0;n++)await new Promise<void>(done=>setTimeout(done,0));expect(stage).toHaveBeenCalledTimes(1);
  f.resources.clear();let joined=false;const joining=f.resources.join().then(()=>{joined=true;});await Promise.resolve();expect(joined).toBe(false);finish({commit,rollback});
  expect(await pending).toBe(false);await joining;expect(commit).not.toHaveBeenCalled();expect(rollback).toHaveBeenCalledTimes(1);expect(f.scenes.remember).not.toHaveBeenCalled();await f.resources.dispose();
 });
 it("wipes raw model/buffer owners after import while the rendered geometry retains its decoded vertices",async()=>{
  const f=modelFixture(),rawOwners:Uint8Array[]=[];
  vi.stubGlobal("crypto",{subtle:{digest:vi.fn(async(algorithm:AlgorithmIdentifier,value:BufferSource)=>{rawOwners.push(value as Uint8Array);return webcrypto.subtle.digest(algorithm as string,value);})}});
  f.scenes.open.mockResolvedValueOnce(f.modelScene);f.resources.attachRenderer!("balanced",async bundle=>{
    expect(rawOwners).toHaveLength(2);expect(rawOwners.every(bytes=>bytes.every(value=>value===0))).toBe(true);
    const model=bundle.models.get("stand")!;let y=0;model.root.traverse(object=>{if("geometry" in object)y=(object as any).geometry.getAttribute("position").getY(0);});expect(y).toBe(-1.5);
    return {commit(){},rollback(){}};
  });
  expect(await f.resources.select(owner,f.id)).toBe(true);expect(f.g.bytes.some(value=>value!==0)).toBe(true);expect(f.g.buffer.some(value=>value!==0)).toBe(true);await f.resources.dispose();
 });
 it("cold-restores the versioned package from current native selection with fresh typed outputs",async()=>{
  const f=modelFixture();f.savedChoice(f.modelScene);const before=f.saved();f.scenes.restore.mockResolvedValueOnce({...before,status:"restored",scene:f.modelScene});
  f.resources.attachRenderer!("economy",async b=>{expect(b.tier).toBe("economy");return {commit(){},rollback(){}};});expect(await f.resources.restore!()).toBe(true);
  expect(f.acquireModel.mock.calls.every(c=>c[2]==="economy")).toBe(true);expect(f.scenes.remember).toHaveBeenCalledWith(f.modelScene,before.revision);expect(f.saved().selection?.sceneId).toBe(f.id);await f.resources.dispose();
 });
 it("retains the current composition when an automatic tier replacement cannot freshly restore",async()=>{
  const f=modelFixture();f.scenes.open.mockResolvedValueOnce(f.modelScene);f.resources.attachRenderer!("balanced",async()=>({commit(){},rollback(){}}));expect(await f.resources.select(owner,f.id)).toBe(true);
  const prior=f.resources.getSnapshot(),before=f.saved();f.scenes.restore.mockResolvedValueOnce({...before,status:"unavailable",scene:null});f.resources.setTier!("economy");await f.resources.join();
  expect(f.resources.getSnapshot().textures).toBe(prior.textures);expect(f.resources.getSnapshot().models).toBe(prior.models);expect(f.resources.isCurrent()).toBe(true);expect(f.saved()).toBe(before);await f.resources.dispose();
 });
 it("rejects mismatched authenticated chunk correlation and retains the last valid native choice",async()=>{
  const f=modelFixture();f.resources.attachRenderer!("balanced",async()=>({commit(){},rollback(){}}));expect(await f.resources.select(owner,"fixture")).toBe(true);const prior=f.resources.getSnapshot(),saved=f.saved();
  f.scenes.open.mockResolvedValueOnce(f.modelScene);const actual=f.readModelChunk.getMockImplementation()!;f.readModelChunk.mockImplementationOnce(async(...args)=>({...await actual(...args),resourceToken:"0".repeat(32)}));
  expect(await f.resources.select(owner,f.id)).toBe(false);expect(f.resources.getSnapshot().textures).toBe(prior.textures);expect(f.saved()).toBe(saved);expect(f.fetcher).not.toHaveBeenCalled();await f.resources.dispose();
 });
 it("joins an in-flight bounded native chunk before late cancellation cleanup can complete",async()=>{
  const f=modelFixture();f.scenes.open.mockResolvedValueOnce(f.modelScene);f.resources.attachRenderer!("balanced",async()=>({commit(){},rollback(){}}));
  const actual=f.readModelChunk.getMockImplementation()!;let deliver!:(chunk:Awaited<ReturnType<typeof actual>>)=>void,args!:Parameters<typeof actual>;
  f.readModelChunk.mockImplementationOnce((...a)=>{args=a;return new Promise(resolve=>{deliver=resolve;});});const pending=f.resources.select(owner,f.id);
  for(let n=0;n<200&&!deliver;n++)await new Promise<void>(done=>setTimeout(done,0));expect(deliver).toBeTypeOf("function");f.resources.clear();let joined=false;const joining=f.resources.join().then(()=>{joined=true;});await Promise.resolve();expect(joined).toBe(false);
  deliver(await actual(...args));expect(await pending).toBe(false);await joining;expect(f.scenes.remember).not.toHaveBeenCalled();expect(f.readModelChunk).toHaveBeenCalledTimes(1);await f.resources.dispose();
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
 it("restores the exact protected choice with fresh textures and promotes its staged lease after preparation",async()=>{
  const f=fixture();f.savedChoice();const before=f.saved();expect(await f.resources.restore!()).toBe(true);
  expect(f.scenes.open).not.toHaveBeenCalled();expect(f.scenes.restore).toHaveBeenCalledWith(before);
  expect(f.scenes.remember).toHaveBeenCalledWith(f.scene,before.revision);expect(f.saved().selection).toEqual(before.selection);expect(f.scenes.acquire).toHaveBeenCalledTimes(3);await f.resources.dispose();
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
 it("joins a failed staged native release before opening a later selection",async()=>{
  const f=fixture();let release!:(value:boolean)=>void;
  f.scenes.release.mockImplementationOnce(()=>new Promise(done=>{release=done;}));f.scenes.remember.mockResolvedValueOnce(null);
  const failed=f.resources.select(owner,"fixture");for(let n=0;n<120&&f.scenes.release.mock.calls.length===0;n++)await Promise.resolve();
  expect(f.scenes.release).toHaveBeenCalledTimes(1);const later=f.resources.select(owner,"fixture");await Promise.resolve();expect(f.scenes.open).toHaveBeenCalledTimes(1);
  release(true);expect(await failed).toBe(false);expect(await later).toBe(true);expect(f.scenes.releaseAll).not.toHaveBeenCalled();await f.resources.dispose();
 });
 it("explicit selection fences a delayed automatic restore",async()=>{
  const f=fixture();f.savedChoice();let resolve!:(value:ChildNativeAppearanceRestore|null)=>void;
  f.scenes.restore.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const late=f.resources.restore!();for(let n=0;n<20&&f.scenes.restore.mock.calls.length===0;n++)await Promise.resolve();
  const selected=f.resources.select(owner,"fixture");resolve({...f.saved(),status:"restored",scene:f.scene});
  expect(await late).toBe(false);expect(await selected).toBe(true);expect(f.saved().revision).toBe(3);await f.resources.dispose();
 });
 it("rolls an obsolete acknowledged native CAS back to the exact displayed snapshot when a newer preparation fails",async()=>{
  const f=fixture();expect(await f.resources.select(owner,"fixture")).toBe(true);const remembered=f.scenes.remember.getMockImplementation()!;
  let finish!:()=>void;const gate=new Promise<void>(done=>{finish=done;});const next={...f.scene,sceneToken:"e".repeat(32)};f.scenes.open.mockResolvedValueOnce(next).mockResolvedValueOnce(null);
  f.scenes.remember.mockImplementationOnce(async(scene,revision)=>{await gate;return remembered(scene,revision);});const first=f.resources.select(owner,"fixture");
  for(let n=0;n<120&&f.scenes.remember.mock.calls.length<2;n++)await Promise.resolve();expect(f.scenes.remember).toHaveBeenCalledTimes(2);
  const queued=f.resources.select(owner,"fixture");finish();expect(await first).toBe(false);expect(await queued).toBe(false);
  expect(f.resources.getSnapshot().scene?.sceneToken).toBe(f.scene.sceneToken);expect(f.resources.isCurrent()).toBe(true);expect(f.scenes.rollback).toHaveBeenCalledWith(next,2);expect(f.saved()).toMatchObject({revision:3,selection:childNativeAppearanceFromScene(f.scene)});expect(f.scenes.release).not.toHaveBeenCalledWith(f.scene.sceneToken);expect(f.scenes.release).toHaveBeenCalledWith(next.sceneToken);await f.resources.dispose();
 });
});

describe("latest intent through acknowledged native CAS and native-owned rollback",()=>{
 it("never commits A or B when C supersedes a held CAS, and preserves native revision ordering",async()=>{
  const f=fixture(),base=f.scene,a={...base,sceneToken:"e".repeat(32)},c={...base,sceneToken:"f".repeat(32)},commits:string[]=[],rollbacks:string[]=[];
  f.resources.attachRenderer!("balanced",async bundle=>({commit(){commits.push(bundle.scene.sceneToken);},rollback(){rollbacks.push(bundle.scene.sceneToken);}}));
  expect(await f.resources.select(owner,"fixture")).toBe(true);const nativeRemember=f.scenes.remember.getMockImplementation()!;
  let finish!:()=>void;const hold=new Promise<void>(done=>{finish=done;});f.scenes.open.mockResolvedValueOnce(a).mockResolvedValueOnce(c);
  f.scenes.remember.mockImplementationOnce(async(scene,revision)=>{await hold;return nativeRemember(scene,revision);});
  const obsolete=f.resources.select(owner,"fixture");for(let n=0;n<150&&f.scenes.remember.mock.calls.length<2;n++)await Promise.resolve();
  expect(f.scenes.remember).toHaveBeenCalledTimes(2);const middle=f.resources.select(owner,"fixture"),latest=f.resources.select(owner,"fixture");finish();
  expect(await obsolete).toBe(false);expect(await middle).toBe(false);expect(await latest).toBe(true);
  expect(commits).toEqual([base.sceneToken,c.sceneToken]);expect(rollbacks).toContain(a.sceneToken);expect(f.scenes.rollback).toHaveBeenCalledTimes(1);
  expect(f.saved()).toMatchObject({revision:4,selection:childNativeAppearanceFromScene(c)});await f.resources.dispose();
 });
 it("restores an absent native prior choice without asking JavaScript to supply a choice",async()=>{
  const f=fixture(),nativeRemember=f.scenes.remember.getMockImplementation()!;let finish!:()=>void;const hold=new Promise<void>(done=>{finish=done;});
  const commit=vi.fn();f.resources.attachRenderer!("balanced",async()=>({commit,rollback(){}}));f.scenes.open.mockResolvedValueOnce(f.scene).mockResolvedValueOnce(null);
  f.scenes.remember.mockImplementationOnce(async(scene,revision)=>{await hold;return nativeRemember(scene,revision);});const obsolete=f.resources.select(owner,"fixture");
  for(let n=0;n<150&&f.scenes.remember.mock.calls.length===0;n++)await Promise.resolve();expect(f.scenes.remember).toHaveBeenCalledTimes(1);
  const newer=f.resources.select(owner,"fixture");finish();expect(await obsolete).toBe(false);expect(await newer).toBe(false);
  expect(commit).not.toHaveBeenCalled();expect(f.saved()).toEqual({profileId:"native-profile",revision:2,selection:null});expect(f.scenes.rollback.mock.calls[0]).toEqual([f.scene,1]);await f.resources.dispose();
 });
 it("reverts protected choice if the final renderer commit refuses the warmed stage",async()=>{
  const f=fixture();expect(await f.resources.select(owner,"fixture")).toBe(true);const before=f.resources.getSnapshot(),chosen={...f.scene,sceneToken:"e".repeat(32)};
  f.scenes.open.mockResolvedValueOnce(chosen);const rollback=vi.fn(),join=vi.fn(async()=>undefined);f.resources.attachRenderer!("balanced",async()=>({commit(){throw Error("Original canvas retired after warm");},rollback,join}));
  expect(await f.resources.select(owner,"fixture")).toBe(false);expect(f.resources.getSnapshot().textures).toBe(before.textures);expect(f.resources.isCurrent()).toBe(true);
  expect(f.scenes.rollback).toHaveBeenCalledWith(chosen,2);expect(f.saved().selection).toEqual(childNativeAppearanceFromScene(f.scene));expect(rollback).toHaveBeenCalledTimes(1);expect(join).toHaveBeenCalledTimes(1);await f.resources.dispose();
 });
 it("does not leave an acknowledged native choice installed after synchronous clear during CAS",async()=>{
  const f=fixture(),nativeRemember=f.scenes.remember.getMockImplementation()!;let finish!:()=>void;const hold=new Promise<void>(done=>{finish=done;});
  const commit=vi.fn();f.resources.attachRenderer!("balanced",async()=>({commit,rollback(){}}));
  f.scenes.remember.mockImplementationOnce(async(scene,revision)=>{await hold;return nativeRemember(scene,revision);});const pending=f.resources.select(owner,"fixture");
  for(let n=0;n<150&&f.scenes.remember.mock.calls.length===0;n++)await Promise.resolve();expect(f.scenes.remember).toHaveBeenCalledOnce();
  f.resources.clear();finish();expect(await pending).toBe(false);expect(commit).not.toHaveBeenCalled();expect(f.scenes.rollback).toHaveBeenCalledWith(f.scene,1);
  expect(f.saved().selection).toBeNull();expect(f.resources.isCurrent()).toBe(false);expect(f.controller.suspend).toHaveBeenCalled();await expect(f.resources.dispose()).rejects.toThrow("cleanup failed");
 });
 it("seals on a thrown rollback transport failure after acknowledged native remember",async()=>{
  const f=fixture();expect(await f.resources.select(owner,"fixture")).toBe(true);const next={...f.scene,sceneToken:"e".repeat(32)};
  f.scenes.open.mockResolvedValueOnce(next);f.scenes.rollback.mockRejectedValueOnce(Error("Native rollback reply transport failed"));
  f.resources.attachRenderer!("balanced",async()=>({commit(){throw Error("Original canvas unavailable");},rollback(){}}));
  expect(await f.resources.select(owner,"fixture")).toBe(false);expect(f.resources.isCurrent()).toBe(false);expect(f.controller.suspend).toHaveBeenCalled();expect(f.scenes.release).toHaveBeenCalledWith(next.sceneToken);await expect(f.resources.dispose()).rejects.toThrow("cleanup failed");
 });
 it("continues image wipe and native release when staged rollback cleanup throws",async()=>{
  const f=fixture();expect(await f.resources.select(owner,"fixture")).toBe(true);const next={...f.scene,sceneToken:"e".repeat(32)};f.scenes.open.mockResolvedValueOnce(next);
  f.resources.attachRenderer!("balanced",async()=>({commit(){throw Error("Original canvas unavailable");},rollback(){throw Error("Borrowed renderer cleanup failed");}}));
  expect(await f.resources.select(owner,"fixture")).toBe(false);expect(f.scenes.rollback).toHaveBeenCalledWith(next,2);expect(f.saved().selection).toEqual(childNativeAppearanceFromScene(f.scene));expect(f.images.every(image=>image.value==="")).toBe(true);
  expect(f.scenes.release).toHaveBeenCalledWith(next.sceneToken);expect(f.resources.isCurrent()).toBe(false);expect(f.controller.suspend).toHaveBeenCalled();await expect(f.resources.dispose()).rejects.toThrow("cleanup failed");
 });
 it("seals rather than acknowledging an unconfirmed durable rollback",async()=>{
  const f=fixture();expect(await f.resources.select(owner,"fixture")).toBe(true);f.scenes.rollback.mockResolvedValueOnce(null);
  f.scenes.open.mockResolvedValueOnce({...f.scene,sceneToken:"e".repeat(32)});f.resources.attachRenderer!("balanced",async()=>({commit(){throw Error("Commit unavailable");},rollback(){}}));
  expect(await f.resources.select(owner,"fixture")).toBe(false);expect(f.resources.isCurrent()).toBe(false);expect(f.controller.suspend).toHaveBeenCalled();
  expect(await f.resources.select(owner,"fixture")).toBe(false);await expect(f.resources.dispose()).rejects.toThrow("cleanup failed");
 });
});
