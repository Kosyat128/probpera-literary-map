import { useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ChildCanonicalResources } from "../child/childNativeCanonicalResources";
import type { ChildEntityReference } from "../child/childPackage";
import { createBookCloudStandGeometry } from "./globeBookCloudStandGeometry";
import { createGlobeLibrary } from "./globeLibraryGeometry";
import type { GlobeQualityTier } from "./globeQuality";

export interface ChildNativeCompositionProps {
  resources: ChildCanonicalResources; globeRef: RefObject<THREE.Mesh>;
  quality: GlobeQualityTier; onHotspot(target: ChildEntityReference): void;
}
/** The new branches are owned by the ORIGINAL GlobeScene. There is no camera,
 * Canvas, renderer or globe in this component. Native textures are borrowed
 * only by these exact material slots and the original globe surface material. */
export default function GlobeChildNativeComposition({resources,globeRef,quality,onHotspot}:ChildNativeCompositionProps) {
  const {scene,gl,invalidate}=useThree();
  const snapshot=useSyncExternalStore(resources.subscribe,resources.getSnapshot,resources.getSnapshot);
  const owner=useRef<{ clear():void; hotspots:THREE.Mesh[] }|null>(null);
  const click=useRef(onHotspot);useLayoutEffect(()=>{click.current=onHotspot;},[onHotspot]);
  useLayoutEffect(()=>{
    if(snapshot.phase!=="ready" || !snapshot.scene || !snapshot.textures || !resources.isCurrent() || gl.getContext().isContextLost()) return;
    const globe=globeRef.current, surface=globe?.material;
    if(!globe || !(surface instanceof THREE.MeshPhysicalMaterial)) { resources.clear();return; }
    let stand:ReturnType<typeof createBookCloudStandGeometry>|undefined, background:ReturnType<typeof createGlobeLibrary>|undefined;
    const group=new THREE.Group();group.name="child-native-approved-composition";

    const hotspots:THREE.Mesh[]=[], borrowed:THREE.Material[]=[], geometry:THREE.BufferGeometry[]=[];
    let cleared=false;
    const prior=surface.map;
    function clear() {
      if(cleared)return;cleared=true;
      if(surface instanceof THREE.MeshPhysicalMaterial && surface.map===snapshot.textures?.skin) {surface.map=null;surface.needsUpdate=true;}
      group.removeFromParent();
      for(const mesh of hotspots) {mesh.userData={};mesh.raycast=()=>undefined;}
      for(const material of borrowed) { if(material instanceof THREE.MeshStandardMaterial) material.map=null;material.dispose(); }
      for(const buffer of geometry)buffer.dispose();
      stand?.dispose();background?.dispose();group.clear();invalidate();
    }
    const recipient={clear,join:async()=>{clear();const context=gl.getContext();if(!context.isContextLost()){context.finish();if(context.getError()!==context.NO_ERROR)throw new Error("Original GPU cleanup unavailable");}}};
    const detach=resources.attachRecipient(recipient);
    owner.current={clear,hotspots};
    try {
      stand=createBookCloudStandGeometry(quality);background=createGlobeLibrary(quality);
      group.add(stand.group,background.group);
      surface.map=snapshot.textures.skin;surface.needsUpdate=true;
      const cover=stand.group.getObjectByName("book-cloud-rounded-covers");
      if(!(cover instanceof THREE.Mesh) || !(cover.material instanceof THREE.MeshStandardMaterial)) throw new Error("Original book cover slot unavailable");
      const coverMaterial=cover.material.clone();coverMaterial.name="child-approved-book-cover";coverMaterial.map=snapshot.textures.stand;coverMaterial.needsUpdate=true;
      borrowed.push(coverMaterial);cover.material=coverMaterial;
      // A real wall panel belongs to the complete original 3D library. Its
      // fixed source/placement is covered by the independent scene manifest.
      const panelGeometry=new THREE.PlaneGeometry(2.4,1.5);geometry.push(panelGeometry);
      const panelMaterial=new THREE.MeshStandardMaterial({map:snapshot.textures.background,roughness:.86,metalness:0});
      borrowed.push(panelMaterial);const panel=new THREE.Mesh(panelGeometry,panelMaterial);panel.name="library-child-gallery";
      panel.position.set(0,1.2,-9.1);background.group.add(panel);
      for(const hotspot of snapshot.scene.hotspots) {
        const geo=new THREE.SphereGeometry(hotspot.radius,16,10);geometry.push(geo);
        const material=new THREE.MeshStandardMaterial({color:"#d4bb78",roughness:.65});borrowed.push(material);
        const mesh=new THREE.Mesh(geo,material);mesh.name="child-hotspot:"+hotspot.id;mesh.position.set(...hotspot.position);
        mesh.userData={target:hotspot.target};hotspots.push(mesh);group.add(mesh);
      }
      if(!resources.isCurrent()) {clear();return;}
      scene.add(group);invalidate();
    } catch {clear();resources.clear();}
    return()=>{detach();clear();if(owner.current?.clear===clear)owner.current=null;
      // A revoked child surface never restores an unapproved adult texture.
      if(prior && surface instanceof THREE.MeshPhysicalMaterial && surface.map===snapshot.textures?.skin)surface.map=null;
    };
  },[snapshot,resources,quality,scene,gl,globeRef,invalidate]);
  useLayoutEffect(()=>{
    const canvas=gl.domElement;
    const lost=()=>{resources.clear();void resources.join().catch(()=>undefined);};
    // R3F event bridge below owns hit testing; context loss immediately detaches.
    canvas.addEventListener("webglcontextlost",lost);
    return()=>{canvas.removeEventListener("webglcontextlost",lost);};
  },[gl,resources,globeRef]);
  const {camera}=useThree();
  useLayoutEffect(()=>{
    const canvas=gl.domElement;
    const pick=(event:PointerEvent)=>{
      const value=owner.current;if(!value || !resources.isCurrent() || gl.getContext().isContextLost())return;
      const rect=canvas.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return;
      const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
      const globe=globeRef.current;
      const hit=ray.intersectObjects(globe?[globe,...value.hotspots]:value.hotspots,false)[0];
      const target=hit?.object.userData.target as ChildEntityReference|undefined;
      if(target && resources.isCurrent())click.current(target);
    };
    canvas.addEventListener("pointerup",pick);return()=>canvas.removeEventListener("pointerup",pick);
  },[camera,gl,resources]);
  useFrame(()=>{if(owner.current && (!resources.isCurrent()||gl.getContext().isContextLost()))resources.clear();},-10000);
  return null;
}
