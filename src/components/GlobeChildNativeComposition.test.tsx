import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { ChildCanonicalResources } from "../child/childNativeCanonicalResources";
import type { ChildNativeSceneRecipient } from "../child/childNativeScene";
import { decodeChildNativeScene } from "../child/childNativeScene";
import GlobeChildNativeComposition from "./GlobeChildNativeComposition";

// Actual original geometry/material ownership with mocked hook scheduling.
// No browser GPU, native owner, review or fixture authorization is supplied.
const hooks=vi.hoisted(()=>({effects:[] as Array<()=>void|(()=>void)>,frames:[] as Array<()=>void>,three:null as unknown}));
vi.mock("react",async original=>({...await original<typeof import("react")>(),
 useRef:(value:unknown)=>({current:value}),useLayoutEffect:(work:()=>void|(()=>void))=>{hooks.effects.push(work);},
 useSyncExternalStore:(_subscribe:unknown,snapshot:()=>unknown)=>snapshot()}));
vi.mock("@react-three/fiber",()=>({useThree:()=>hooks.three,useFrame:(work:()=>void)=>{hooks.frames.push(work);}}));
const hash="a".repeat(64),owner={kind:"activity" as const,id:"home",contentChecksum:hash};
const slot=(kind:"skin"|"stand"|"background")=>({slotId:kind,assetId:kind,entity:{kind,id:kind,contentChecksum:hash},mime:"image/png",checksum:hash,encodedBytes:128,altText:kind});
function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),surface=new THREE.MeshPhysicalMaterial();
 const globe=new THREE.Mesh(new THREE.SphereGeometry(1.3,12,8),surface);scene.add(globe);
 const native=decodeChildNativeScene({status:"opened",sceneToken:"b".repeat(32),sceneId:"fixture",owner,skin:slot("skin"),
 stand:{geometryId:"stand.base.child-book-cloud",asset:slot("stand")},background:{geometryId:"background.base.library",asset:slot("background")},
 hotspots:[{id:"activity-one",target:owner,position:[2,0,0],radius:.2}],remainingLifetimeMs:5000},owner,"fixture")!;
 const textures={skin:new THREE.Texture(),stand:new THREE.Texture(),background:new THREE.Texture()};
 let current=true,recipient:ChildNativeSceneRecipient|null=null;
 const context={isContextLost:()=>false,finish:vi.fn(),getError:()=>0,NO_ERROR:0};
 const gl={getContext:()=>context,domElement:{addEventListener:vi.fn(),removeEventListener:vi.fn()}};
 const resources={subscribe:()=>()=>undefined,getSnapshot:()=>({phase:"ready",revision:1,scene:native,textures}),
 isCurrent:()=>current,clear:vi.fn(()=>{current=false;recipient?.clear();}),join:async()=>undefined,
 attachRecipient:(value:ChildNativeSceneRecipient)=>{recipient=value;return()=>{value.clear();recipient=null;};}} as unknown as ChildCanonicalResources;
 hooks.three={scene,camera,gl,invalidate:vi.fn()};
 GlobeChildNativeComposition({resources,globeRef:{current:globe},quality:"economy",onHotspot:vi.fn()});
 const cleanups=hooks.effects.splice(0).map(work=>work()).filter((v):v is ()=>void=>typeof v==="function");
 return {scene,camera,gl,globe,surface,textures,context,resources,recipient:()=>recipient,cleanups,current:(v:boolean)=>{current=v;}};
}
afterEach(()=>{hooks.effects.length=0;hooks.frames.length=0;vi.clearAllMocks();});
describe("original canonical composition recipient",()=>{
 it("binds native maps to the original surface, book covers and a wall inside full 3D library",async()=>{
  const f=fixture(),group=f.scene.getObjectByName("child-native-approved-composition")!;
  expect(group).toBeInstanceOf(THREE.Group);expect(f.scene.children.filter(o=>o instanceof THREE.Camera)).toHaveLength(0);
  expect(f.surface.map).toBe(f.textures.skin);
  const cover=group.getObjectByName("book-cloud-rounded-covers") as THREE.Mesh;
  expect((cover.material as THREE.MeshStandardMaterial).map).toBe(f.textures.stand);
  const wall=group.getObjectByName("library-child-gallery") as THREE.Mesh;
  expect((wall.material as THREE.MeshStandardMaterial).map).toBe(f.textures.background);
  expect(group.getObjectByName("child-hotspot:activity-one")).toBeInstanceOf(THREE.Mesh);
  f.recipient()!.clear();expect(f.surface.map).toBeNull();expect(group.parent).toBeNull();
  expect(f.scene.children).toEqual([f.globe]);await f.recipient()!.join();expect(f.context.finish).toHaveBeenCalledOnce();
  f.cleanups.reverse().forEach(work=>work());f.globe.geometry.dispose();f.surface.dispose();Object.values(f.textures).forEach(t=>t.dispose());
 });
 it("fences old material and hotspot recipients before the next original frame",()=>{
  const f=fixture();f.current(false);hooks.frames.forEach(frame=>frame());
  expect(f.resources.clear).toHaveBeenCalled();expect(f.surface.map).toBeNull();
  expect(f.scene.getObjectByName("child-native-approved-composition")).toBeUndefined();
  f.cleanups.reverse().forEach(work=>work());f.globe.geometry.dispose();f.surface.dispose();Object.values(f.textures).forEach(t=>t.dispose());
 });
 it("does not let an already retired frame cancel the successor before React effect cleanup",async()=>{
  const f=fixture();
  // A second appearance choice first clears borrowed maps synchronously.
  // The next R3F frame can run before React commits the empty/preparing tree.
  f.resources.clear();
  expect(f.resources.clear).toHaveBeenCalledTimes(1);expect(f.surface.map).toBeNull();
  expect(f.scene.getObjectByName("child-native-approved-composition")).toBeUndefined();
  for(let i=0;i<3;i++)hooks.frames.forEach(frame=>frame());
  expect(f.resources.clear).toHaveBeenCalledTimes(1);
  await f.recipient()!.join();expect(f.context.finish).toHaveBeenCalledOnce();
  f.cleanups.reverse().forEach(work=>work());f.globe.geometry.dispose();f.surface.dispose();Object.values(f.textures).forEach(t=>t.dispose());
 });
});
