import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { ChildCanonicalResources, ChildCanonicalBundle, ChildCanonicalRenderStage } from "../child/childNativeCanonicalResources";
import type { ChildNativeSceneRecipient } from "../child/childNativeScene";
import { decodeChildNativeScene } from "../child/childNativeScene";
import GlobeChildNativeComposition from "./GlobeChildNativeComposition";

// Actual original geometry/material ownership with mocked hook and GPU scheduling.
// The independent browser case exercises the original GPU. This unit grants no native authority.
const hooks=vi.hoisted(()=>({effects:[] as Array<()=>void|(()=>void)>,frames:[] as Array<()=>void>,priorities:[] as number[],three:null as unknown}));
vi.mock("react",async original=>({...await original<typeof import("react")>(),
 useRef:(value:unknown)=>({current:value}),useLayoutEffect:(work:()=>void|(()=>void))=>{hooks.effects.push(work);}}));
vi.mock("@react-three/fiber",()=>({useThree:()=>hooks.three,useFrame:(work:()=>void,priority=0)=>{hooks.frames.push(work);hooks.priorities.push(priority);}}));
const hash="a".repeat(64),owner={kind:"activity" as const,id:"home",contentChecksum:hash};
const slot=(kind:"skin"|"stand"|"background")=>({slotId:kind,assetId:kind,entity:{kind,id:kind,contentChecksum:hash},mime:"image/png",checksum:hash,encodedBytes:128,altText:kind});
async function fixture(renderFails=false,withBackgroundModel=false){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),surface=new THREE.MeshPhysicalMaterial();
 const globe=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),surface);scene.add(globe);
 const native=decodeChildNativeScene({status:"opened",sceneToken:"b".repeat(32),sceneId:"fixture",owner,skin:slot("skin"),
 stand:{geometryId:"stand.base.child-book-cloud",asset:slot("stand")},background:{geometryId:"background.base.library",asset:slot("background")},
 hotspots:[{id:"activity-one",target:owner,position:[2,0,0],radius:.2}],remainingLifetimeMs:5000},owner,"fixture")!;
 const textures={skin:new THREE.Texture(),stand:new THREE.Texture(),background:new THREE.Texture()};
 const backgroundRoot=new THREE.Group(),backgroundGeometry=new THREE.BoxGeometry(6,6,6),backgroundMaterial=new THREE.MeshStandardMaterial({side:THREE.DoubleSide});
 const backgroundMesh=new THREE.Mesh(backgroundGeometry,backgroundMaterial);backgroundRoot.add(backgroundMesh);
 const bundle:ChildCanonicalBundle={scene:native,textures,models:withBackgroundModel?new Map([["background",{root:backgroundRoot,decodedBytes:1024,triangles:12,dispose:()=>{backgroundRoot.removeFromParent();backgroundGeometry.dispose();backgroundMaterial.dispose();}}]]):new Map(),tier:"economy"};
 let current=true,recipient:ChildNativeSceneRecipient|null=null,renderer:((b:ChildCanonicalBundle)=>Promise<ChildCanonicalRenderStage|null>)|null=null;
 const context={isContextLost:()=>false,finish:vi.fn(),getError:()=>0,NO_ERROR:0};
 const previousTarget=new THREE.WebGLRenderTarget(8,8),viewport=new THREE.Vector4(7,8,111,222),scissor=new THREE.Vector4(1,2,33,44);
 const gl={getContext:()=>context,domElement:{addEventListener:vi.fn(),removeEventListener:vi.fn()},initTexture:vi.fn(),
 compileAsync:vi.fn(async(group:THREE.Group,actualCamera:THREE.Camera,actualScene:THREE.Scene)=>{
  expect(actualCamera).toBe(camera);expect(actualScene).toBe(scene);expect(scene.children).toEqual([globe]);expect(surface.map).toBeNull();
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
 GlobeChildNativeComposition({resources,globeRef:{current:globe},quality:"economy",onHotspot:vi.fn()});
 const cleanups=hooks.effects.splice(0).map(work=>work()).filter((v):v is ()=>void=>typeof v==="function");
 expect(renderer).toBeTypeOf("function");const stage=await (renderer as unknown as (b:ChildCanonicalBundle)=>Promise<ChildCanonicalRenderStage|null>)(bundle);
 return {scene,camera,gl,globe,surface,textures,context,resources,stage,backgroundMesh,backgroundMaterial,previousTarget,viewport,scissor,recipient:()=>recipient,cleanups,current:(v:boolean)=>{current=v;},
 dispose(){cleanups.reverse().forEach(work=>work());previousTarget.dispose();globe.geometry.dispose();surface.dispose();backgroundRoot.removeFromParent();backgroundGeometry.dispose();backgroundMaterial.dispose();Object.values(textures).forEach(t=>t.dispose());}};
}
afterEach(()=>{hooks.effects.length=0;hooks.frames.length=0;hooks.priorities.length=0;vi.clearAllMocks();});
describe("original canonical composition staged recipient",()=>{
 it("keeps enclosing background depth out of the canonical globe draw",async()=>{
  const f=await fixture(false,true);f.stage!.commit();expect(f.backgroundMesh.parent?.parent?.name).toBe("child-native-approved-composition");
  expect(f.backgroundMesh.renderOrder).toBeLessThan(f.globe.renderOrder);expect(f.backgroundMaterial.depthWrite).toBe(false);
  expect(f.surface.depthWrite).toBe(true);expect(f.globe.parent).toBe(f.scene);f.dispose();
 });
 it("skips the original render as soon as the actual context is lost before the queued loss event",async()=>{
  const f=await fixture();f.stage!.commit();f.gl.render.mockClear();const lost=vi.spyOn(f.context,"isContextLost").mockReturnValue(true);
  expect(hooks.priorities).toEqual([-10000,1]);hooks.frames.forEach(frame=>frame());expect(f.gl.render).not.toHaveBeenCalled();expect(f.resources.clear).toHaveBeenCalledOnce();expect(f.surface.map).toBeNull();
  lost.mockReturnValue(false);hooks.frames.forEach(frame=>frame());expect(f.gl.render).toHaveBeenCalledExactlyOnceWith(f.scene,f.camera);expect(f.scene.children).toEqual([f.globe]);f.dispose();
 });
 it("warms the canonical skin and geometry off state and restores borrowed renderer state before apply",async()=>{
  const f=await fixture(),originalGeometryDispose=vi.spyOn(f.globe.geometry,"dispose");
  expect(f.stage).not.toBeNull();expect(f.scene.children).toEqual([f.globe]);expect(f.surface.map).toBeNull();
  expect(f.gl.initTexture).toHaveBeenCalledWith(f.textures.skin);expect(f.gl.compileAsync).toHaveBeenCalledOnce();expect(f.gl.render).toHaveBeenCalledOnce();
  expect(f.gl.setRenderTarget).toHaveBeenLastCalledWith(f.previousTarget,2,1);expect(f.gl.setViewport).toHaveBeenCalledWith(f.viewport);expect(f.gl.setScissor).toHaveBeenCalledWith(f.scissor);expect(f.gl.setScissorTest).toHaveBeenCalledWith(true);
  f.stage!.rollback();expect(f.surface.map).toBeNull();expect(f.scene.children).toEqual([f.globe]);expect(originalGeometryDispose).not.toHaveBeenCalled();f.dispose();
 });
 it("binds maps to the original surface, book covers and a wall only after the staged commit",async()=>{
  const f=await fixture();f.stage!.commit();const group=f.scene.getObjectByName("child-native-approved-composition")!;
  expect(group).toBeInstanceOf(THREE.Group);expect(f.scene.children.filter(o=>o instanceof THREE.Camera)).toHaveLength(0);expect(f.surface.map).toBe(f.textures.skin);
  const cover=group.getObjectByName("book-cloud-rounded-covers") as THREE.Mesh;expect((cover.material as THREE.MeshStandardMaterial).map).toBe(f.textures.stand);
  const wall=group.getObjectByName("library-child-gallery") as THREE.Mesh;expect((wall.material as THREE.MeshStandardMaterial).map).toBe(f.textures.background);expect(group.getObjectByName("child-hotspot:activity-one")).toBeInstanceOf(THREE.Mesh);
  f.recipient()!.clear();expect(f.surface.map).toBeNull();expect(group.parent).toBeNull();expect(f.scene.children).toEqual([f.globe]);await f.recipient()!.join();expect(f.context.finish).toHaveBeenCalledTimes(2);f.dispose();
 });
 it("refuses apply when offscreen upload fails and still restores the original render target",async()=>{
  const f=await fixture(true);expect(f.stage).toBeNull();expect(f.scene.children).toEqual([f.globe]);expect(f.surface.map).toBeNull();expect(f.gl.setRenderTarget).toHaveBeenLastCalledWith(f.previousTarget,2,1);expect(f.gl.setViewport).toHaveBeenCalledWith(f.viewport);f.dispose();
 });
 it("fences old material and hotspot recipients before the next original frame",async()=>{
  const f=await fixture();f.stage!.commit();f.current(false);hooks.frames.forEach(frame=>frame());expect(f.resources.clear).toHaveBeenCalled();expect(f.surface.map).toBeNull();expect(f.scene.getObjectByName("child-native-approved-composition")).toBeUndefined();f.dispose();
 });
 it("does not let a retired frame cancel the successor before effect cleanup",async()=>{
  const f=await fixture();f.stage!.commit();f.resources.clear();expect(f.resources.clear).toHaveBeenCalledTimes(1);expect(f.surface.map).toBeNull();expect(f.scene.getObjectByName("child-native-approved-composition")).toBeUndefined();
  for(let i=0;i<3;i++)hooks.frames.forEach(frame=>frame());expect(f.resources.clear).toHaveBeenCalledTimes(1);await f.recipient()!.join();expect(f.context.finish).toHaveBeenCalledTimes(2);f.dispose();
 });
});
