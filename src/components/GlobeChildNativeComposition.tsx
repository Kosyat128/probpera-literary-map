import { useLayoutEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ChildCanonicalResources, ChildCanonicalBundle } from "../child/childNativeCanonicalResources";
import type { ChildEntityReference } from "../child/childPackage";
import { createBookCloudStandGeometry } from "./globeBookCloudStandGeometry";
import { createGlobeLibrary } from "./globeLibraryGeometry";
import type { GlobeQualityTier } from "./globeQuality";

export interface ChildNativeCompositionProps { resources: ChildCanonicalResources; globeRef: RefObject<THREE.Mesh>; quality: GlobeQualityTier; onHotspot(target: ChildEntityReference): void }
/** Lives in the original GlobeScene. Only its original renderer/camera warms
 * and swaps these branches; no globe or geographic transforms are created. */
export default function GlobeChildNativeComposition({ resources, globeRef, quality, onHotspot }: ChildNativeCompositionProps) {
  const { scene, gl, camera, invalidate } = useThree();
  const owner = useRef<{ clear(): void; hotspots: THREE.Mesh[] } | null>(null), click = useRef(onHotspot), currentQuality = useRef(quality);
  useLayoutEffect(() => { currentQuality.current = quality; resources.setTier?.(quality); }, [quality, resources]);
  useLayoutEffect(() => { click.current = onHotspot; }, [onHotspot]);
  useLayoutEffect(() => {
    let mounted = true;
    const cleanup = () => { owner.current?.clear(); owner.current = null; };
    const join = async () => { const context = gl.getContext(); if (!context.isContextLost()) { context.finish(); if (context.getError() !== context.NO_ERROR) throw new Error("Original GPU cleanup unavailable"); } };
    const detachRecipient = resources.attachRecipient({ clear: cleanup, join });
    const stage = async (bundle: ChildCanonicalBundle) => {
      const globe = globeRef.current, surface = globe?.material;
      if (!mounted || gl.getContext().isContextLost() || !globe || !(surface instanceof THREE.MeshPhysicalMaterial)) return null;
      const group = new THREE.Group(); group.name = "child-native-approved-composition";
      const hotspots: THREE.Mesh[] = [], borrowed: THREE.Material[] = [], geometry: THREE.BufferGeometry[] = [];
      let stand: ReturnType<typeof createBookCloudStandGeometry> | undefined, background: ReturnType<typeof createGlobeLibrary> | undefined;
      let cleared = false, applied = false;
      function clear() {
        if (cleared) return; cleared = true;
        if (owner.current?.clear === clear) owner.current = null;
        if (applied && surface instanceof THREE.MeshPhysicalMaterial && surface.map === bundle.textures.skin) { surface.map = null; surface.needsUpdate = true; }
        group.removeFromParent(); for (const h of hotspots) { h.userData = {}; h.raycast = () => undefined; }
        for (const material of borrowed) { if (material instanceof THREE.MeshStandardMaterial) material.map = null; material.dispose(); }
        for (const buffer of geometry) buffer.dispose(); stand?.dispose(); background?.dispose(); group.clear(); invalidate();
      }
      try {
        const standModel = bundle.models.get("stand"), backgroundModel = bundle.models.get("background");
        if (standModel) group.add(standModel.root);
        else {
          stand = createBookCloudStandGeometry(currentQuality.current); group.add(stand.group);
          const cover = stand.group.getObjectByName("book-cloud-rounded-covers");
          if (!(cover instanceof THREE.Mesh) || !(cover.material instanceof THREE.MeshStandardMaterial)) throw new Error("Original book cover slot unavailable");
          const material = cover.material.clone(); material.map = bundle.textures.stand; material.needsUpdate = true; borrowed.push(material); cover.material = material;
        }
        if (backgroundModel) {
          // A surrounding decorative room may intersect the camera's path.
          // Draw its walls before canonical objects without writing their depth.
          // Signed geometry and picking checks still apply to this branch.
          backgroundModel.root.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            object.renderOrder = -100;
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.depthWrite = false;
          });
          group.add(backgroundModel.root);
        }
        else {
          background = createGlobeLibrary(currentQuality.current); group.add(background.group);
          const geo = new THREE.PlaneGeometry(2.4, 1.5); geometry.push(geo);
          const material = new THREE.MeshStandardMaterial({ map: bundle.textures.background, roughness: .86, metalness: 0 }); borrowed.push(material);
          const panel = new THREE.Mesh(geo, material); panel.name = "library-child-gallery"; panel.position.set(0, 1.2, -9.1); background.group.add(panel);
        }
        // Decorative model geometry never competes with canonical picking.
        group.traverse(o => { o.raycast = () => undefined; });
        for (const h of bundle.scene.hotspots) {
          const geo = new THREE.SphereGeometry(h.radius, 16, 10); geometry.push(geo);
          const material = new THREE.MeshStandardMaterial({ color: "#d4bb78", roughness: .65 }); borrowed.push(material);
          const mesh = new THREE.Mesh(geo, material); mesh.name = "child-hotspot:" + h.id; mesh.position.set(...h.position); mesh.userData = { target: h.target }; hotspots.push(mesh); group.add(mesh);
        }
        // Include the future canonical surface shader variant in the same
        // off-state warm. Geometry is borrowed from the original globe and
        // never disposed, transformed geographically or installed as a globe.
        const skinMaterial = surface.clone(); skinMaterial.map = bundle.textures.skin; skinMaterial.needsUpdate = true; borrowed.push(skinMaterial);
        const skinWarm = new THREE.Mesh(globe.geometry, skinMaterial); skinWarm.matrixAutoUpdate = false; globe.updateWorldMatrix(true, false); skinWarm.matrix.copy(globe.matrixWorld); skinWarm.raycast = () => undefined;
        group.add(skinWarm);
        for (const texture of Object.values(bundle.textures)) gl.initTexture(texture);
        group.traverse(o => { if (o instanceof THREE.Mesh) for (const material of Array.isArray(o.material) ? o.material : [o.material]) if (material instanceof THREE.MeshStandardMaterial && material.map) gl.initTexture(material.map); });
        await gl.compileAsync(group, camera, scene);
        if (!mounted || gl.getContext().isContextLost()) { clear(); return null; }
        // Compile alone does not upload geometry. Warm a bounded offscreen
        // target through THIS original renderer/camera before native commit.
        // Restore all borrowed renderer state even when actual GPU upload fails.
        const target = new THREE.WebGLRenderTarget(64, 64, { depthBuffer: true, stencilBuffer: false });
        const previousTarget = gl.getRenderTarget(), previousFace = gl.getActiveCubeFace(), previousMip = gl.getActiveMipmapLevel();
        const viewport = gl.getViewport(new THREE.Vector4()), scissor = gl.getScissor(new THREE.Vector4()), scissorTest = gl.getScissorTest();
        const culling: [THREE.Object3D, boolean][] = [];
        try { group.traverse(o => { culling.push([o, o.frustumCulled]); o.frustumCulled = false; }); gl.setRenderTarget(target); gl.render(group, camera); }
        finally { for (const [object, prior] of culling) object.frustumCulled = prior; gl.setRenderTarget(previousTarget, previousFace, previousMip); gl.setViewport(viewport); gl.setScissor(scissor); gl.setScissorTest(scissorTest); target.dispose(); }
        group.remove(skinWarm);
        const context = gl.getContext(); context.finish(); if (context.getError() !== context.NO_ERROR) throw new Error("Original shader warm-up failed");
        return Object.freeze({
          commit() {
            if (!mounted || cleared || gl.getContext().isContextLost() || globeRef.current !== globe) throw new Error("Original composition retired");
            const previous = owner.current; scene.add(group); surface.map = bundle.textures.skin; surface.needsUpdate = true; applied = true;
            owner.current = { clear, hotspots }; previous?.clear(); invalidate();
          },
          rollback: clear,
        });
      } catch { clear(); return null; }
    };
    const detachRenderer = resources.attachRenderer?.(currentQuality.current, stage);
    return () => { mounted = false; detachRenderer?.(); detachRecipient(); cleanup(); };
  }, [resources, scene, gl, camera, globeRef, invalidate]);
  useLayoutEffect(() => {
    const canvas = gl.domElement, lost = () => { resources.clear(); void resources.join().catch(() => undefined); };
    canvas.addEventListener("webglcontextlost", lost); return () => { canvas.removeEventListener("webglcontextlost", lost); };
  }, [gl, resources]);
  useLayoutEffect(() => {
    const canvas = gl.domElement;
    const pick = (event: PointerEvent) => {
      const value = owner.current; if (!value || !resources.isCurrent() || gl.getContext().isContextLost()) return;
      const rect = canvas.getBoundingClientRect(); if (rect.width <= 0 || rect.height <= 0) return;
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const globe = globeRef.current, hit = ray.intersectObjects(globe ? [globe, ...value.hotspots] : value.hotspots, false)[0];
      const target = hit?.object.userData.target as ChildEntityReference | undefined; if (target && resources.isCurrent()) click.current(target);
    };
    canvas.addEventListener("pointerup", pick); return () => canvas.removeEventListener("pointerup", pick);
  }, [camera, gl, resources, globeRef]);
  useFrame(() => { if (owner.current && (!resources.isCurrent() || gl.getContext().isContextLost())) resources.clear(); }, -10000);
  // The WebGL loss event is queued after the context actually becomes lost.
  // Render through the original renderer after other frame updates, checking
  // the actual context rather than Three's event-dependent internal flag.
  useFrame(() => {
    const context = gl.getContext();
    if (context.isContextLost()) { if (owner.current) resources.clear(); return; }
    try { gl.render(scene, camera); }
    catch (error) { if (!context.isContextLost()) throw error; resources.clear(); }
  }, 1);
  return null;
}
