import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { ChildCanonicalResources, ChildCanonicalBundle, ChildCanonicalRenderStage } from "../child/childNativeCanonicalResources";
import type { ChildNativeSceneRecipient } from "../child/childNativeScene";
import { decodeChildNativeScene } from "../child/childNativeScene";
import GlobeChildNativeComposition from "./GlobeChildNativeComposition";
import { childSceneEngineFixture } from "../child/childSceneEngineFixture";

// Actual original geometry/material ownership with mocked hook and GPU scheduling.
// The independent browser case exercises the original GPU. This unit grants no native authority.
const hooks=vi.hoisted(()=>({effects:[] as Array<()=>void|(()=>void)>,frames:[] as Array<()=>void>,priorities:[] as number[],three:null as unknown}));
vi.mock("react",async original=>({...await original<typeof import("react")>(),
 useRef:(value:unknown)=>({current:value}),useLayoutEffect:(work:()=>void|(()=>void))=>{hooks.effects.push(work);}}));
vi.mock("@react-three/fiber",()=>({useThree:()=>hooks.three,useFrame:(work:()=>void,priority=0)=>{hooks.frames.push(work);hooks.priorities.push(priority);}}));
const hash="a".repeat(64),owner={kind:"activity" as const,id:"home",contentChecksum:hash};
const slot=(kind:"skin"|"stand"|"background")=>({slotId:kind,assetId:kind,entity:{kind,id:kind,contentChecksum:hash},mime:"image/png",checksum:hash,encodedBytes:128,altText:kind});
async function fixture(renderFails=false,withBackgroundModel=false,engine=false,staticFallback=false){
 vi.stubGlobal("document",{get visibilityState(){return "visible";},querySelector:()=>null,addEventListener:vi.fn(),removeEventListener:vi.fn()});
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),surface=new THREE.MeshPhysicalMaterial();
 const globe=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),surface);scene.add(globe);
 let native=decodeChildNativeScene({status:"opened",sceneToken:"b".repeat(32),sceneId:"fixture",owner,skin:slot("skin"),
 stand:{geometryId:"stand.base.child-book-cloud",asset:slot("stand")},background:{geometryId:"background.base.library",asset:slot("background")},
 hotspots:[{id:"activity-one",target:owner,position:[2,0,0],radius:.2}],remainingLifetimeMs:5000},owner,"fixture")!;
 const publicMap=engine?new THREE.Texture():null;surface.map=publicMap;
 const visibility=engine?vi.spyOn(document,"visibilityState","get").mockReturnValue("visible"):null;
 if(engine){const f=childSceneEngineFixture(),raw=structuredClone(f.raw);raw.tiers.forEach(p=>{p.maxResidentBytes=33_554_432;p.maxTriangles=200_000;});native={...f.scene(raw),hotspots:native.hotspots};}
 const textures={skin:new THREE.Texture(),stand:staticFallback?null:new THREE.Texture(),background:new THREE.Texture()};
 const backgroundRoot=new THREE.Group(),backgroundGeometry=new THREE.BoxGeometry(6,6,6),backgroundMaterial=new THREE.MeshStandardMaterial({side:THREE.DoubleSide});
 const backgroundMesh=new THREE.Mesh(backgroundGeometry,backgroundMaterial);backgroundRoot.add(backgroundMesh);
 const bundle:ChildCanonicalBundle={scene:native,textures,...(engine?{staticFallback,residency:{maxResidentBytes:33_554_432,candidateBytes:8192,priorBytes:0,cacheBytes:0}}:{}),models:withBackgroundModel?new Map([["background",{root:backgroundRoot,decodedBytes:1024,triangles:12,dispose:()=>{backgroundRoot.removeFromParent();backgroundGeometry.dispose();backgroundMaterial.dispose();}}]]):new Map(),tier:"economy"};
 let current=true,recipient:ChildNativeSceneRecipient|null=null,renderer:((b:ChildCanonicalBundle)=>Promise<ChildCanonicalRenderStage|null>)|null=null;
 const context={isContextLost:()=>false,finish:vi.fn(),getError:()=>0,NO_ERROR:0};
 const previousTarget=new THREE.WebGLRenderTarget(8,8),viewport=new THREE.Vector4(7,8,111,222),scissor=new THREE.Vector4(1,2,33,44);
 const gl={toneMappingExposure:1,getContext:()=>context,domElement:{addEventListener:vi.fn(),removeEventListener:vi.fn()},initTexture:vi.fn(),
 compileAsync:vi.fn(async(group:THREE.Group,actualCamera:THREE.Camera,actualScene:THREE.Scene)=>{
  expect(actualCamera).toBe(camera);if(!engine)expect(actualScene).toBe(scene);else expect(actualScene).toBeInstanceOf(THREE.Scene);expect(scene.children.filter(o=>!(o instanceof THREE.Light))).toEqual([globe]);expect(surface.map).toBe(publicMap);
  const skin=group.children.find(child=>child instanceof THREE.Mesh&&child.geometry===globe.geometry) as THREE.Mesh;
  expect(skin).toBeInstanceOf(THREE.Mesh);expect(skin.material).not.toBe(surface);expect((skin.material as THREE.MeshPhysicalMaterial).map).toBe(textures.skin);
 }),getRenderTarget:()=>previousTarget,getActiveCubeFace:()=>2,getActiveMipmapLevel:()=>1,
 getViewport:(v:THREE.Vector4)=>v.copy(viewport),getScissor:(v:THREE.Vector4)=>v.copy(scissor),getScissorTest:()=>true,
 setRenderTarget:vi.fn(),setViewport:vi.fn(),setScissor:vi.fn(),setScissorTest:vi.fn(),
 render:vi.fn(()=>{if(renderFails)throw Error("GPU upload refused");})};
 const resources={isCurrent:()=>current,clear:vi.fn(()=>{current=false;recipient?.clear();}),join:async()=>undefined,setTier:vi.fn(),
 attachRecipient:(value:ChildNativeSceneRecipient)=>{recipient=value;return()=>{value.clear();recipient=null;};},
 attachRenderer:(_tier:unknown,value:typeof renderer)=>{renderer=value;return()=>{renderer=null;};}} as unknown as ChildCanonicalResources;
 hooks.three={scene,camera,gl,invalidate:vi.fn()};
 GlobeChildNativeComposition({resources,globeRef:{current:globe},quality:"economy",editionId:"synthetic-edition",onHotspot:vi.fn()});
 const cleanups=hooks.effects.splice(0).map(work=>work()).filter((v):v is ()=>void=>typeof v==="function");
 expect(renderer).toBeTypeOf("function");const stage=await (renderer as unknown as (b:ChildCanonicalBundle)=>Promise<ChildCanonicalRenderStage|null>)(bundle);
 return {scene,camera,gl,globe,surface,textures,context,resources,stage,bundle,publicMap,prepare:renderer as unknown as (b:ChildCanonicalBundle)=>Promise<ChildCanonicalRenderStage|null>,backgroundMesh,backgroundMaterial,previousTarget,viewport,scissor,recipient:()=>recipient,cleanups,current:(v:boolean)=>{current=v;},
 dispose(){cleanups.reverse().forEach(work=>work());previousTarget.dispose();globe.geometry.dispose();surface.dispose();backgroundRoot.removeFromParent();backgroundGeometry.dispose();backgroundMaterial.dispose();Object.values(textures).forEach(t=>t?.dispose());publicMap?.dispose();visibility?.mockRestore();}};
}
afterEach(()=>{hooks.effects.length=0;hooks.frames.length=0;hooks.priorities.length=0;vi.restoreAllMocks();vi.unstubAllGlobals();});
describe("original canonical composition staged recipient",()=>{
 it("keeps enclosing background depth out of the canonical globe draw",async()=>{
  const f=await fixture(false,true);await f.stage!.commit();f.stage!.finalize?.();expect(f.backgroundMesh.parent?.parent?.name).toBe("child-native-approved-composition");
  expect(f.backgroundMesh.renderOrder).toBeLessThan(f.globe.renderOrder);expect(f.backgroundMaterial.depthWrite).toBe(false);
  expect(f.surface.depthWrite).toBe(true);expect(f.globe.parent).toBe(f.scene);f.dispose();
 });
 it("skips the original render as soon as the actual context is lost before the queued loss event",async()=>{
  const f=await fixture();await f.stage!.commit();f.stage!.finalize?.();f.gl.render.mockClear();const lost=vi.spyOn(f.context,"isContextLost").mockReturnValue(true);
  expect(hooks.priorities).toEqual([-10000,1]);hooks.frames.forEach(frame=>frame());expect(f.gl.render).not.toHaveBeenCalled();expect(f.resources.clear).toHaveBeenCalledOnce();expect(f.surface.map).toBeNull();
  lost.mockReturnValue(false);hooks.frames.forEach(frame=>frame());expect(f.gl.render).toHaveBeenCalledExactlyOnceWith(f.scene,f.camera);expect(f.scene.children.filter(o=>!(o instanceof THREE.Light))).toEqual([f.globe]);f.dispose();
 });
 it("warms the canonical skin and geometry off state and restores borrowed renderer state before apply",async()=>{
  const f=await fixture(),originalGeometryDispose=vi.spyOn(f.globe.geometry,"dispose");
  expect(f.stage).not.toBeNull();expect(f.scene.children.filter(o=>!(o instanceof THREE.Light))).toEqual([f.globe]);expect(f.surface.map).toBeNull();
  expect(f.gl.initTexture).toHaveBeenCalledWith(f.textures.skin);expect(f.gl.compileAsync).toHaveBeenCalledOnce();expect(f.gl.render).toHaveBeenCalledOnce();
  expect(f.gl.setRenderTarget).toHaveBeenLastCalledWith(f.previousTarget,2,1);expect(f.gl.setViewport).toHaveBeenCalledWith(f.viewport);expect(f.gl.setScissor).toHaveBeenCalledWith(f.scissor);expect(f.gl.setScissorTest).toHaveBeenCalledWith(true);
  f.stage!.rollback();expect(f.surface.map).toBeNull();expect(f.scene.children.filter(o=>!(o instanceof THREE.Light))).toEqual([f.globe]);expect(originalGeometryDispose).not.toHaveBeenCalled();f.dispose();
 });
 it("binds maps to the original surface, book covers and a wall only after the staged commit",async()=>{
  const f=await fixture();await f.stage!.commit();f.stage!.finalize?.();const group=f.scene.getObjectByName("child-native-approved-composition")!;
  expect(group).toBeInstanceOf(THREE.Group);expect(f.scene.children.filter(o=>o instanceof THREE.Camera)).toHaveLength(0);expect(f.surface.map).toBe(f.textures.skin);
  const cover=group.getObjectByName("book-cloud-rounded-covers") as THREE.Mesh;expect((cover.material as THREE.MeshStandardMaterial).map).toBe(f.textures.stand);
  const wall=group.getObjectByName("library-child-gallery") as THREE.Mesh;expect((wall.material as THREE.MeshStandardMaterial).map).toBe(f.textures.background);expect(group.getObjectByName("child-hotspot:activity-one")).toBeInstanceOf(THREE.Mesh);
  f.recipient()!.clear();expect(f.surface.map).toBeNull();expect(group.parent).toBeNull();expect(f.scene.children.filter(o=>!(o instanceof THREE.Light))).toEqual([f.globe]);await f.recipient()!.join();expect(f.context.finish).toHaveBeenCalledTimes(2);f.dispose();
 });
 it("refuses apply when offscreen upload fails and still restores the original render target",async()=>{
  const f=await fixture(true);expect(f.stage).toBeNull();expect(f.scene.children.filter(o=>!(o instanceof THREE.Light))).toEqual([f.globe]);expect(f.surface.map).toBeNull();expect(f.gl.setRenderTarget).toHaveBeenLastCalledWith(f.previousTarget,2,1);expect(f.gl.setViewport).toHaveBeenCalledWith(f.viewport);f.dispose();
 });
 it("fences old material and hotspot recipients before the next original frame",async()=>{
  const f=await fixture();await f.stage!.commit();f.stage!.finalize?.();f.current(false);hooks.frames.forEach(frame=>frame());expect(f.resources.clear).toHaveBeenCalled();expect(f.surface.map).toBeNull();expect(f.scene.getObjectByName("child-native-approved-composition")).toBeUndefined();f.dispose();
 });
 it("does not let a retired frame cancel the successor before effect cleanup",async()=>{
  const f=await fixture();await f.stage!.commit();f.stage!.finalize?.();f.resources.clear();expect(f.resources.clear).toHaveBeenCalledTimes(1);expect(f.surface.map).toBeNull();expect(f.scene.getObjectByName("child-native-approved-composition")).toBeUndefined();
  for(let i=0;i<3;i++)hooks.frames.forEach(frame=>frame());expect(f.resources.clear).toHaveBeenCalledTimes(1);await f.recipient()!.join();expect(f.context.finish).toHaveBeenCalledTimes(2);f.dispose();
 });
 it("blends a v4 branch on the original surface and keeps its exact camera, globe and owned rig until finalization",async()=>{
  let time=0;vi.spyOn(performance,"now").mockImplementation(()=>time);const f=await fixture(false,true,true);
  expect(f.stage).not.toBeNull();expect(f.surface.map).toBe(f.publicMap);expect(f.gl.compileAsync).toHaveBeenCalledTimes(3);
  const signal=new AbortController(),work=f.stage!.commit({signal:signal.signal,isCurrent:()=>true,absoluteDeadline:5000});
  time=150;hooks.frames[0]();expect(f.surface.map).toBe(f.publicMap);
  expect((f.scene.getObjectByName("child-scene-ambient") as THREE.Light).intensity).toBeCloseTo(.175);
  expect(f.gl.toneMappingExposure).toBeCloseTo(.975);expect(f.globe.parent).toBe(f.scene);
  time=300;hooks.frames[0]();await work;f.stage!.finalize?.();expect(f.surface.map).toBe(f.textures.skin);expect(f.scene.children.filter(o=>o instanceof THREE.Camera)).toHaveLength(0);
  expect((f.scene.getObjectByName("child-scene-key") as THREE.Light).intensity).toBe(.5);
  await f.stage!.rollback();await f.stage!.join?.();expect(f.surface.map).toBe(f.publicMap);expect(f.gl.toneMappingExposure).toBe(1);f.dispose();
 });
 it("uses a real small static branch with no procedural room, stand, copied actor or second globe",async()=>{
  const f=await fixture(false,false,true,true),signal=new AbortController();
  await f.stage!.rollback();await f.stage!.join?.();
  const instant={...f.bundle,scene:{...f.bundle.scene,modelPackage:{...f.bundle.scene.modelPackage!,engineComposition:{...f.bundle.scene.modelPackage!.engineComposition!,transition:{durationMs:0,timeoutMs:250,reducedMotion:"instant" as const}}}}};
  const stage=await f.prepare(instant);await stage!.commit({signal:signal.signal,isCurrent:()=>true,absoluteDeadline:performance.now()+5000});stage!.finalize?.();
  const branch=f.scene.getObjectByName("child-native-approved-composition")!;expect(branch.userData.childRenderClass).toBe("static");
  expect(branch.getObjectByName("child-static-backdrop")).toBeInstanceOf(THREE.Mesh);expect(branch.getObjectByName("book-cloud-rounded-covers")).toBeUndefined();
  expect(branch.getObjectByName("included-globe-background:background.base.library")).toBeUndefined();expect(f.textures.stand).toBeNull();
  expect(f.globe.parent).toBe(f.scene);await stage!.rollback();await stage!.join?.();f.dispose();
 });
 it("refuses procedural allocation before GPU upload when candidate plus prior residency cannot fit",async()=>{
  const f=await fixture(false,true,true);await f.stage!.rollback();await f.stage!.join?.();f.gl.initTexture.mockClear();
  await expect(f.prepare({...f.bundle,residency:{...f.bundle.residency!,priorBytes:33_554_432}})).rejects.toThrow("reservation");expect(f.gl.initTexture).not.toHaveBeenCalled();expect(f.surface.map).toBe(f.publicMap);f.dispose();
 });
 it("restores the original public map when a legacy prepared commit is rolled back before finalization",async()=>{
  const f=await fixture();await f.stage!.commit();expect(f.surface.map).toBe(f.textures.skin);await f.stage!.rollback();await f.stage!.join?.();expect(f.surface.map).toBeNull();f.dispose();
 });
 it("joins a cancelled shader warm before disposing its stage and never attaches the retired candidate",async()=>{
  const f=await fixture(false,true,true);await f.stage!.rollback();await f.stage!.join?.();f.context.finish.mockClear();f.gl.render.mockClear();
  let resume!:()=>void;f.gl.compileAsync.mockImplementationOnce(()=>new Promise<void>(resolve=>{resume=resolve;}));
  const abort=new AbortController(),work=f.prepare({...f.bundle,preparation:{signal:abort.signal,isCurrent:()=>!abort.signal.aborted,absoluteDeadline:performance.now()+5000}});
  abort.abort();expect(f.context.finish).not.toHaveBeenCalled();expect(f.scene.children.filter(o=>!(o instanceof THREE.Light))).toEqual([f.globe]);
  resume();expect(await work).toBeNull();expect(f.context.finish).toHaveBeenCalledOnce();expect(f.gl.render).not.toHaveBeenCalled();expect(f.surface.map).toBe(f.publicMap);f.dispose();
 });
 it("attempts every renderer restoration field and rejects unknown cleanup when one restorer throws",async()=>{
  const f=await fixture();await f.stage!.rollback();await f.stage!.join?.();f.gl.setViewport.mockImplementationOnce(()=>{throw Error("viewport restoration failed");});f.gl.setScissor.mockClear();f.gl.setScissorTest.mockClear();
  await expect(f.prepare(f.bundle)).rejects.toThrow("cleanup failed");expect(f.gl.setScissor).toHaveBeenCalledWith(f.scissor);expect(f.gl.setScissorTest).toHaveBeenCalledWith(true);expect(f.surface.map).toBeNull();f.dispose();
 });
});
