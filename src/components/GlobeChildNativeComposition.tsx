import { useLayoutEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Capacitor } from "@capacitor/core";
import * as THREE from "three";
import type { ChildCanonicalResources, ChildCanonicalBundle } from "../child/childNativeCanonicalResources";
import type { ChildEntityReference } from "../child/childPackage";
import { CHILD_ENGINE_FIXED_RESIDENT_BYTES, childEngineProceduralReserve, ChildSceneBudgetError, ChildSceneCleanupError, type ChildEngineComposition, type ChildEnginePlatform } from "../child/childSceneEngine";
import { createBookCloudStandGeometry } from "./globeBookCloudStandGeometry";
import { createGlobeLibrary } from "./globeLibraryGeometry";
import type { GlobeQualityTier } from "./globeQuality";
import { beginGlobePointerGesture, updateGlobePointerGesture, isGlobePointerTap, type GlobePointerGesture } from "./globeInteraction";
import { advanceChildSceneAmbience, createChildSceneTransition, createChildSkinBlend, prepareChildBranchFade, type ChildSceneTransition, type ChildSceneRig, type ChildSceneCommitOptions } from "./childSceneTransition";

export interface ChildNativeCompositionProps {
  resources: ChildCanonicalResources; globeRef: RefObject<THREE.Mesh>; quality: GlobeQualityTier;
  onHotspot(target: ChildEntityReference): void;
  editionId?: string; active?: boolean; exploring?: boolean; reducedMotion?: boolean; preloadPaused?: boolean;
}
type RenderOwner = { clear(): void; group: THREE.Group; hotspots: THREE.Mesh[]; publicMap: THREE.Texture | null; engine?: ChildEngineComposition; startedAt: number; ready: boolean };
type PreviewFrame = { finish(): void; cancel(): void };
/** Lives in the original GlobeScene. The actual renderer/camera/globe warms and
 * transitions its branches. Booky remains its existing screen avatar; reading
 * that anchor never moves its controls, canvas, animation or retained state. */
export default function GlobeChildNativeComposition({ resources, globeRef, quality, onHotspot, editionId = "", active = true, exploring = false, reducedMotion = false, preloadPaused = false }: ChildNativeCompositionProps) {
  const { scene, gl, camera, invalidate } = useThree();
  const owner = useRef<RenderOwner | null>(null), previewOwner = useRef<RenderOwner | null>(null), click = useRef(onHotspot), currentQuality = useRef(quality);
  const view = useRef({ editionId, active, exploring, reducedMotion, preloadPaused }), transition = useRef<ChildSceneTransition | null>(null);
  const rig = useRef<ChildSceneRig | null>(null), baselineExposure = useRef(gl.toneMappingExposure), lastFrame = useRef(-1), ambienceTime = useRef(0);
  const previewFrames = useRef(new Set<PreviewFrame>());
  useLayoutEffect(() => { view.current = { editionId, active, exploring, reducedMotion, preloadPaused }; resources.refreshEnvironment?.(); }, [resources, editionId, active, exploring, reducedMotion, preloadPaused]);
  useLayoutEffect(() => { currentQuality.current = quality; resources.setTier?.(quality); }, [quality, resources]);
  useLayoutEffect(() => { click.current = onHotspot; }, [onHotspot]);
  useLayoutEffect(() => {
    let mounted = true, cleanupFailed = false;
    const safeInvalidate = () => { try { invalidate(); } catch { cleanupFailed = true; } };
    const staged = new Set<{ clear(): void }>(), warming = new Set<Promise<unknown>>();
    // Both lights belong to this consumer for its entire lifetime, so shader
    // light counts stay stable across all scene transitions. Existing palette
    // lights are never changed or replaced.
    const ambient = new THREE.AmbientLight("#ffffff", 0), key = new THREE.DirectionalLight("#ffffff", 0);
    ambient.name = "child-scene-ambient"; key.name = "child-scene-key"; key.position.set(3, 4, 3); key.castShadow = false;
    const localRig = { ambient, key }; rig.current = localRig; baselineExposure.current = gl.toneMappingExposure; scene.add(ambient, key);
    function resetRig() { ambient.intensity = key.intensity = 0; gl.toneMappingExposure = baselineExposure.current; }
    const cleanup = () => {
      transition.current?.rollback(); transition.current = null;
      for (const pending of [...staged]) pending.clear();
      previewOwner.current?.clear(); previewOwner.current = null;
      owner.current?.clear(); owner.current = null; resetRig();
    };
    const finishGpu = async () => {
      try { const context = gl.getContext(); if (!context.isContextLost()) { context.finish(); if (context.getError() !== context.NO_ERROR) throw new Error("Original GPU cleanup unavailable"); } }
      catch { cleanupFailed = true; throw new ChildSceneCleanupError("Original GPU cleanup unavailable"); }
    };
    const join = async () => { await Promise.all([...warming]); await transition.current?.join(); await finishGpu(); if (cleanupFailed) throw new Error("Original renderer disposal failed"); };
    const detachRecipient = resources.attachRecipient({ clear: cleanup, join });
    async function prepare(bundle: ChildCanonicalBundle) {
      const globe = globeRef.current, surface = globe?.material, engine = bundle.scene.modelPackage?.engineComposition;
      if (!mounted || gl.getContext().isContextLost() || !globe || !(surface instanceof THREE.MeshPhysicalMaterial)) return null;
      const previousSurfaceMap = surface.map, publicMap = owner.current ? owner.current.publicMap : surface.map;
      function liveAnchors() {
        if (!mounted || cleanupFailed || globeRef.current !== globe || gl.getContext().isContextLost()
          || bundle.preparation && (bundle.preparation.signal.aborted || !bundle.preparation.isCurrent())) return false;
        if (!engine) return true;
        const origin = globe!.getWorldPosition(new THREE.Vector3()), scale = globe!.getWorldScale(new THREE.Vector3());
        const avatar = document.querySelector<HTMLElement>("[data-planet-mascot-avatar]"), box = avatar?.getBoundingClientRect();
        return view.current.active && document.visibilityState === "visible" && origin.length() < .00001
          && scale.distanceTo(new THREE.Vector3(1, 1, 1)) < .00001
          && (!box || [box.left, box.top, box.width, box.height].every(Number.isFinite)) && !!publicMap;
      }
      if (!liveAnchors()) return null;
      const procedural = childEngineProceduralReserve(bundle.tier, !bundle.models.has("stand"), !bundle.models.has("background"), bundle.scene.hotspots.length, !!bundle.staticFallback);
      if (engine) {
        const b = bundle.residency, p = engine.tiers.find(p => p.tier === bundle.tier)!;
        if (!b || b.candidateBytes + b.priorBytes + b.cacheBytes + procedural.residentBytes + CHILD_ENGINE_FIXED_RESIDENT_BYTES > b.maxResidentBytes
          || [...bundle.models.values()].reduce((sum, model) => sum + model.triangles, 0) + procedural.triangles > p.maxTriangles)
          throw new ChildSceneBudgetError("Procedural owner reservation exceeds signed peak budget");
      }
      const group = new THREE.Group(); group.name = "child-native-approved-composition";
      group.userData.childRenderClass = bundle.staticFallback ? "static" : engine ? bundle.tier === "economy" ? "3d-lite" : "geometry" : "legacy";
      const hotspots: THREE.Mesh[] = [], borrowed: THREE.Material[] = [], geometry: THREE.BufferGeometry[] = [];
      let stand: ReturnType<typeof createBookCloudStandGeometry> | undefined, background: ReturnType<typeof createGlobeLibrary> | undefined;
      let extraResidentBytes = 0, actualTriangles = 0;
      let cleared = false, warmingStage = true, disposedStage = false, applied = false, previewing = false, promoted = false, localTransition: ChildSceneTransition | null = null, prior: RenderOwner | null = null;
      let priorParent: THREE.Object3D | null = null, priorIndex = -1;
      let priorAmbienceTime: number | null = null;
      let legacyRig: { ambient: THREE.Color; key: THREE.Color; ambientIntensity: number; keyIntensity: number; exposure: number } | null = null;
      let previewFrame: PreviewFrame | null = null, previewShown: Promise<void> | null = null;
      const pending = { clear }; staged.add(pending); bundle.preparation?.signal.addEventListener("abort", clear, { once: true });
      function clear() {
        if (cleared) return; cleared = true; staged.delete(pending); bundle.preparation?.signal.removeEventListener("abort", clear);
        previewFrame?.cancel();
        localTransition?.rollback(); if (transition.current === localTransition) transition.current = null;
        if (previewOwner.current?.clear === clear) previewOwner.current = null;
        const owns = owner.current?.clear === clear; if (owns) owner.current = null;
        if (applied && surface instanceof THREE.MeshPhysicalMaterial && surface.map === bundle.textures.skin) { surface.map = owns ? publicMap : previousSurfaceMap; surface.needsUpdate = true; if (owns) resetRig(); }
        if (previewing && !promoted && !engine && prior && priorParent) {
          try {
            if (prior.group.parent !== priorParent) priorParent.add(prior.group);
            const index = priorParent.children.indexOf(prior.group);
            if (priorIndex >= 0 && index !== priorIndex) { priorParent.children.splice(index, 1); priorParent.children.splice(priorIndex, 0, prior.group); }
          } catch { cleanupFailed = true; }
        }
        if (previewing && !promoted && legacyRig) {
          ambient.color.copy(legacyRig.ambient); key.color.copy(legacyRig.key);
          ambient.intensity = legacyRig.ambientIntensity; key.intensity = legacyRig.keyIntensity; gl.toneMappingExposure = legacyRig.exposure;
        }
        if (!promoted && priorAmbienceTime !== null) {
          ambienceTime.current = priorAmbienceTime; lastFrame.current = -1;
        }
        try { group.removeFromParent(); } catch { cleanupFailed = true; } for (const h of hotspots) { h.userData = {}; h.raycast = () => undefined; }
        if (!warmingStage) disposeStage(); safeInvalidate();
      }
      function disposeStage() {
        if (disposedStage) return; disposedStage = true;
        for (const material of borrowed) { try { if (material instanceof THREE.MeshStandardMaterial) material.map = null; material.dispose(); } catch { cleanupFailed = true; } }
        for (const buffer of geometry) try { buffer.dispose(); } catch { cleanupFailed = true; }
        try { stand?.dispose(); } catch { cleanupFailed = true; } try { background?.dispose(); } catch { cleanupFailed = true; }
        try { group.clear(); } catch { cleanupFailed = true; } safeInvalidate();
      }
      try {
        const standModel = bundle.models.get("stand"), backgroundModel = bundle.models.get("background");
        if (standModel) group.add(standModel.root);
        else if (!bundle.staticFallback) {
          stand = createBookCloudStandGeometry(bundle.tier); group.add(stand.group);
          const cover = stand.group.getObjectByName("book-cloud-rounded-covers");
          if (!(cover instanceof THREE.Mesh) || !(cover.material instanceof THREE.MeshStandardMaterial)) throw new Error("Original book cover slot unavailable");
          const material = cover.material.clone(); material.map = bundle.textures.stand;
          material.needsUpdate = true; borrowed.push(material); cover.material = material;
        }
        if (backgroundModel) {
          backgroundModel.root.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            object.renderOrder = -100;
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.depthWrite = false;
          }); group.add(backgroundModel.root);
        } else {
          // A signed static fallback is only a checked flat backdrop. It does
          // not claim to load the omitted room model or its stand texture.
          if (!bundle.staticFallback) { background = createGlobeLibrary(bundle.tier); group.add(background.group); }
          const geo = new THREE.PlaneGeometry(bundle.staticFallback ? 16 : 2.4, bundle.staticFallback ? 10 : 1.5); geometry.push(geo);
          const material = new THREE.MeshStandardMaterial({ map: bundle.textures.background, roughness: .86, metalness: 0, depthWrite: false }); borrowed.push(material);
          const panel = new THREE.Mesh(geo, material); panel.name = bundle.staticFallback ? "child-static-backdrop" : "library-child-gallery";
          panel.position.set(0, bundle.staticFallback ? 0 : 1.2, -9.1); panel.renderOrder = -100; (background?.group ?? group).add(panel);
        }
        group.traverse(o => { o.raycast = () => undefined; });
        for (const h of bundle.scene.hotspots) {
          const geo = new THREE.SphereGeometry(h.radius, bundle.tier === "economy" ? 8 : 16, bundle.tier === "economy" ? 6 : 10); geometry.push(geo);
          const material = new THREE.MeshStandardMaterial({ color: "#d4bb78", roughness: .65 }); borrowed.push(material);
          const mesh = new THREE.Mesh(geo, material); mesh.name = "child-hotspot:" + h.id; mesh.position.set(...h.position); mesh.userData = { target: h.target }; hotspots.push(mesh); group.add(mesh);
        }
        const importedGeometry = new Set<THREE.BufferGeometry>(), importedTextures = new Set<THREE.Texture>();
        const ownedGeometry = new Set<THREE.BufferGeometry>(), ownedMaterials = new Set<THREE.Material>(), ownedTextures = new Set<THREE.Texture>();
        const fields = ["map", "roughnessMap", "metalnessMap", "normalMap", "alphaMap", "emissiveMap", "aoMap", "bumpMap", "envMap"] as const;
        for (const model of bundle.models.values()) model.root.traverse(o => { if (o instanceof THREE.Mesh) {
          importedGeometry.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m instanceof THREE.MeshStandardMaterial)
            for (const field of fields) if (m[field]) importedTextures.add(m[field]!);
        } });
        group.traverse(o => {
          if (!(o instanceof THREE.Mesh)) return;
          actualTriangles += (o.geometry.index?.count ?? o.geometry.getAttribute("position").count) / 3 * (o instanceof THREE.InstancedMesh ? o.count : 1);
          if (!importedGeometry.has(o.geometry)) ownedGeometry.add(o.geometry);
          if (o instanceof THREE.InstancedMesh) extraResidentBytes += (o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0)) * 2;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            ownedMaterials.add(m);
            if (m instanceof THREE.MeshStandardMaterial) for (const field of fields) if (m[field]) ownedTextures.add(m[field]!);
          }
        });
        for (const geometry of ownedGeometry) {
          for (const attribute of Object.values(geometry.attributes)) extraResidentBytes += attribute.array.byteLength * 2;
          extraResidentBytes += (geometry.index?.array.byteLength ?? 0) * 2;
        }
        for (const texture of ownedTextures) {
          if (importedTextures.has(texture) || Object.values(bundle.textures).includes(texture) || texture.name.startsWith("original-craft:")) continue;
          const image = texture.image as { width?: number; height?: number; data?: Uint8Array } | null;
          if (!image || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height) || image.width! < 1 || image.height! < 1) throw new Error("Bounded owned texture dimensions required");
          extraResidentBytes += image.data?.byteLength ?? image.width! * image.height! * 4;
          extraResidentBytes += Math.ceil(image.width! * image.height! * 16 / 3);
        }
        // Protected craft factories own ALL 15 square RGBA tiles, reflection
        // tile and six source materials, including tiles absent from mesh maps.
        // Charge their complete fixed bound without modifying those factories.
        const tileSize = bundle.tier === "high" ? 256 : bundle.tier === "balanced" ? 128 : 64;
        const cubeSize = Math.max(16, tileSize / 4), cubeUvWidth = 3 * Math.max(cubeSize, 112), cubeUvHeight = 4 * cubeSize;
        const craftCopies = Number(!!stand) + Number(!!background);
        const craftBytes = Math.ceil(tileSize * tileSize * 15.5 * (4 + 16 / 3)) + 6 * 1024;
        // Two bounded RGBA16F PMREM targets plus bookkeeping are a conservative
        // pinned-Three estimate, not measured physical GPU/driver byte proof.
        extraResidentBytes += craftCopies * (craftBytes + 2 * cubeUvWidth * cubeUvHeight * 8 + 16_384);
        extraResidentBytes += ownedMaterials.size * 1024 + (engine ? 4096 : 2048);
        function requireResident(transient = 0) {
          if (!engine) return;
          const budget = bundle.residency;
          if (!budget || budget.candidateBytes + budget.priorBytes + budget.cacheBytes + extraResidentBytes + transient + CHILD_ENGINE_FIXED_RESIDENT_BYTES > budget.maxResidentBytes)
            throw new ChildSceneBudgetError("Measured procedural/shader-warm branch exceeds signed peak budget");
        }
        if (engine && (extraResidentBytes > procedural.residentBytes || actualTriangles > engine.tiers.find(p => p.tier === bundle.tier)!.maxTriangles))
          throw new ChildSceneBudgetError("Measured procedural ownership exceeds its reservation");
        requireResident();
        const blend = engine ? createChildSkinBlend(bundle.textures.skin) : null;
        // Borrow only the original geometry for off-state shader warm. Neither
        // mesh is a visible globe or a new geographic/camera owner.
        const skinMaterial = surface.clone(); skinMaterial.onBeforeCompile = surface.onBeforeCompile; skinMaterial.customProgramCacheKey = surface.customProgramCacheKey; skinMaterial.map = bundle.textures.skin; skinMaterial.needsUpdate = true; borrowed.push(skinMaterial);
        const skinWarm = new THREE.Mesh(globe.geometry, skinMaterial); skinWarm.matrixAutoUpdate = false; globe.updateWorldMatrix(true, false); skinWarm.matrix.copy(globe.matrixWorld); skinWarm.raycast = () => undefined; group.add(skinWarm);
        let blendWarm: THREE.Mesh | null = null, restoreBlendWarm: (() => void) | null = null;
        if (blend) {
          const material = surface.clone(); material.onBeforeCompile = surface.onBeforeCompile; material.customProgramCacheKey = surface.customProgramCacheKey; borrowed.push(material); restoreBlendWarm = blend.install(material);
          blendWarm = new THREE.Mesh(globe.geometry, material); blendWarm.matrixAutoUpdate = false; blendWarm.matrix.copy(globe.matrixWorld); blendWarm.raycast = () => undefined; group.add(blendWarm);
        }
        for (const texture of Object.values(bundle.textures)) if (texture) gl.initTexture(texture);
        group.traverse(o => { if (o instanceof THREE.Mesh) for (const material of Array.isArray(o.material) ? o.material : [o.material]) if (material instanceof THREE.MeshStandardMaterial && material.map) gl.initTexture(material.map); });
        const target = new THREE.WebGLRenderTarget(64, 64, { depthBuffer: true, stencilBuffer: false });
        async function warm() {
          await gl.compileAsync(group, camera, scene);
          if (cleared || !liveAnchors()) throw new Error("Original composition warm retired");
          const previousTarget = gl.getRenderTarget(), previousFace = gl.getActiveCubeFace(), previousMip = gl.getActiveMipmapLevel();
          const viewport = gl.getViewport(new THREE.Vector4()), scissor = gl.getScissor(new THREE.Vector4()), scissorTest = gl.getScissorTest(), priorParent = group.parent;
          const culling: [THREE.Object3D, boolean][] = [];
          // This atomic offscreen pass uses the actual original scene lights
          // and camera. Remove the candidate before any visible frame or await.
          try { group.traverse(o => { culling.push([o, o.frustumCulled]); o.frustumCulled = false; }); scene.add(group); gl.setRenderTarget(target); gl.render(scene, camera); }
          finally {
                        let restorationFailed = false;
            const restore = (work: () => void) => { try { work(); } catch { restorationFailed = cleanupFailed = true; } };
            restore(() => group.removeFromParent()); restore(() => { priorParent?.add(group); });
            for (const [object, previous] of culling) restore(() => { object.frustumCulled = previous; });
            restore(() => gl.setRenderTarget(previousTarget, previousFace, previousMip)); restore(() => gl.setViewport(viewport));
            restore(() => gl.setScissor(scissor)); restore(() => gl.setScissorTest(scissorTest));
            if (restorationFailed) throw new ChildSceneCleanupError("Original renderer state restoration failed");
          }
        }
        try {
          await warm();
          if (engine) {
            // The old branch shader can be warmed using borrowed geometry and
            // cloned materials; live old materials remain untouched pre-CAS.
            const oldWarm = new THREE.Group(), oldMaterials = new Map<THREE.Material, THREE.Material>();
            const variants = new Map<string, { mesh: THREE.Mesh; material: THREE.Material }>();
            owner.current?.group.traverse(o => {
              if (!(o instanceof THREE.Mesh)) return;
              const layout = Object.keys(o.geometry.attributes).sort().join(",") + "|" + Number(o.receiveShadow) + "|" + Number(o instanceof THREE.InstancedMesh) + "|" + Number(o instanceof THREE.InstancedMesh && !!o.instanceColor);
              for (const material of Array.isArray(o.material) ? o.material : [o.material]) variants.set(material.uuid + "|" + layout, { mesh: o, material });
            });
            const unique = new Set([...variants.values()].map(v => v.material));
            requireResident((unique.size + variants.size + 1) * 1024);
            for (const { mesh: original, material } of variants.values()) {
              let copied = oldMaterials.get(material);
              if (!copied) { copied = material.clone(); copied.onBeforeCompile = material.onBeforeCompile; copied.customProgramCacheKey = material.customProgramCacheKey; copied.transparent = true; copied.depthWrite = false; oldMaterials.set(material, copied); }
              // Clone the original object TYPE without cloning geometry,
              // textures or borrowed instance arrays. Instanced defines and
              // actual instance attributes remain the same shader variant.
              const mesh = original instanceof THREE.InstancedMesh ? new THREE.InstancedMesh(original.geometry, copied, 0) : new THREE.Mesh(original.geometry, copied);
              mesh.receiveShadow = original.receiveShadow; mesh.castShadow = false; mesh.visible = original.visible; mesh.renderOrder = original.renderOrder; mesh.layers.mask = original.layers.mask;
              if (mesh instanceof THREE.InstancedMesh && original instanceof THREE.InstancedMesh) { mesh.instanceMatrix = original.instanceMatrix; mesh.instanceColor = original.instanceColor; mesh.count = original.count; }
              mesh.matrixAutoUpdate = false; original.updateWorldMatrix(true, false); mesh.matrix.copy(original.matrixWorld); mesh.raycast = () => undefined; oldWarm.add(mesh);
            }
            group.add(oldWarm); const restoreFade = prepareChildBranchFade(group);
            try { await gl.compileAsync(group, camera, scene); } finally {
              restoreFade(); group.remove(oldWarm); for (const material of oldMaterials.values()) { try { material.dispose(); } catch { cleanupFailed = true; } } oldWarm.clear();
            }
            // A retiring legacy/procedural room can own PointLights. Compile
            // the final opaque/skin variant against the exact final light
            // topology too, without mutating any live light before native CAS.
            const finalLights = new THREE.Scene(), retiredLights = new Set<THREE.Object3D>();
            owner.current?.group.traverse(o => { if (o instanceof THREE.Light) retiredLights.add(o); });
            scene.traverse(o => { if (o instanceof THREE.Light && !retiredLights.has(o)) { o.updateWorldMatrix(true, false); const copy = o.clone(false); copy.matrixAutoUpdate = false; copy.matrix.copy(o.matrixWorld); finalLights.add(copy); } });
            try { await gl.compileAsync(group, camera, finalLights); } finally { finalLights.clear(); }
            if (cleared || !liveAnchors()) throw new Error("Final light variant warm retired");
          }
        } finally { target.dispose(); }
        group.remove(skinWarm); if (blendWarm) group.remove(blendWarm); restoreBlendWarm?.();
        await finishGpu();
        if (cleared || cleanupFailed || !liveAnchors()) { clear(); return null; }
        return Object.freeze({
          residentBytes: extraResidentBytes,
          async commit(options?: ChildSceneCommitOptions) {
            if (cleared || !liveAnchors()) throw new Error("Original composition retired");
            prior = owner.current;
            priorAmbienceTime = ambienceTime.current;
            priorParent = prior?.group.parent ?? null; priorIndex = prior && priorParent ? priorParent.children.indexOf(prior.group) : -1;
            if (engine) {
              if (!options || !blend) throw new Error("Current native transaction required");
              localTransition = createChildSceneTransition({ gl, scene, surface, prior: prior?.group ?? null, candidate: group, nextSkin: bundle.textures.skin, blend,
                rig: localRig, engine, baselineExposure: baselineExposure.current, visible: liveAnchors, reducedMotion: () => view.current.reducedMotion, invalidate: safeInvalidate, currentClock: () => performance.now() });
              transition.current = localTransition; await localTransition.commit({ ...options, isCurrent: () => options.isCurrent() && liveAnchors() });
            } else {
              legacyRig = { ambient: ambient.color.clone(), key: key.color.clone(), ambientIntensity: ambient.intensity, keyIntensity: key.intensity, exposure: gl.toneMappingExposure };
              scene.add(group); surface.map = bundle.textures.skin; surface.needsUpdate = true; applied = true;
            }
          },
          presentPreview() {
            if (previewShown) return previewShown;
            if (cleared || !liveAnchors() || !applied && !localTransition) throw new Error("Current shown preview required");
            localTransition?.presentPreview();
            // Set before observer callbacks so failed legacy detach can restore.
            previewing = true;
            if (!engine) { prior?.group.removeFromParent(); resetRig(); }
            if (cleared || !liveAnchors()) throw new Error("Preview retired during presentation");
            if (transition.current === localTransition) transition.current = null;
            previewOwner.current = { clear, group, hotspots, publicMap, engine, startedAt: performance.now(), ready: false };
            previewShown = new Promise<void>((resolve, reject) => {
              const retire = () => { if (previewFrame) previewFrames.current.delete(previewFrame); previewFrame = null; };
              previewFrame = {
                finish() {
                  const shown = previewOwner.current;
                  if (cleared || !liveAnchors() || shown?.clear !== clear || !view.current.active || document.visibilityState !== "visible") {
                    retire(); reject(new Error("Preview retired before its visible frame")); return;
                  }
                  shown.ready = true; retire(); resolve();
                },
                cancel() { retire(); reject(new Error("Preview frame retired")); },
              };
              previewFrames.current.add(previewFrame);
            });
            safeInvalidate(); return previewShown;
          },
          finalize() {
            if (cleared || !liveAnchors()) throw new Error("Current completed composition required");
            localTransition?.finalize(); if (!engine) resetRig(); if (transition.current === localTransition) transition.current = null;
            applied = promoted = true; staged.delete(pending); bundle.preparation?.signal.removeEventListener("abort", clear);
            if (previewOwner.current?.clear === clear) previewOwner.current = null;
            owner.current = { clear, group, hotspots, publicMap, engine, startedAt: performance.now(), ready: true }; prior?.clear(); safeInvalidate();
          },
          rollback: clear,
          async join() { await localTransition?.join(); await finishGpu(); if (cleanupFailed) throw new Error("Original renderer disposal failed"); },
        });
      } catch (error) { clear(); if (cleanupFailed) throw new ChildSceneCleanupError("Original renderer cleanup failed"); if (error instanceof ChildSceneBudgetError) throw error; return null; }
      finally { warmingStage = false; if (cleared) { disposeStage(); await finishGpu(); if (cleanupFailed) throw new ChildSceneCleanupError("Original renderer cleanup failed"); } }
    }
    const stage = (bundle: ChildCanonicalBundle) => {
      const work = prepare(bundle); warming.add(work); void work.then(() => warming.delete(work), () => warming.delete(work)); return work;
    };
    const platform = (): ChildEnginePlatform => { const value = Capacitor.getPlatform(); return value === "android" || value === "ios" ? value : "web"; };
    const detachRenderer = resources.attachRenderer?.(currentQuality.current, stage, () => ({
      editionId: view.current.editionId, platform: platform(), exploring: view.current.exploring,
      visible: view.current.active && document.visibilityState === "visible", reducedMotion: view.current.reducedMotion, preloadPaused: view.current.preloadPaused,
    }));
    const visibility = () => { resources.refreshEnvironment?.(); if (document.visibilityState !== "visible") cleanup(); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted = false; document.removeEventListener("visibilitychange", visibility); detachRenderer?.(); detachRecipient(); cleanup();
      ambient.removeFromParent(); key.removeFromParent(); if (rig.current === localRig) rig.current = null;
    };
  }, [resources, scene, gl, camera, globeRef, invalidate]);
  useLayoutEffect(() => {
    const canvas = gl.domElement, lost = () => { resources.clear(); void resources.join().catch(() => undefined); };
    canvas.addEventListener("webglcontextlost", lost); return () => { canvas.removeEventListener("webglcontextlost", lost); };
  }, [gl, resources]);
  useLayoutEffect(() => {
    const canvas = gl.domElement;
    let gesture: GlobePointerGesture | null = null, gestureOwner: RenderOwner | null = null;
    const reset = () => { gesture = null; gestureOwner = null; };
    const eligible = () => {
      const value = previewOwner.current ?? owner.current;
      return value?.ready && view.current.active && view.current.exploring && document.visibilityState === "visible"
        && !transition.current && resources.isCurrent() && !gl.getContext().isContextLost() ? value : null;
    };
    const begin = (event: PointerEvent) => {
      // A second pointer retires the whole tap. Camera orbit/pinch/scroll keep
      // their original listeners; this observer never captures or cancels input.
      if (gesture && event.pointerId !== gesture.pointerId) { reset(); return; }
      gestureOwner = eligible(); gesture = gestureOwner ? beginGlobePointerGesture(event) : null;
    };
    const move = (event: PointerEvent) => { gesture = updateGlobePointerGesture(gesture, event); };
    const pick = (event: PointerEvent) => {
      const value = eligible(), tap = value === gestureOwner && isGlobePointerTap(gesture, event); reset();
      if (!value || !tap) return;
      const box = document.querySelector<HTMLElement>("[data-planet-mascot-avatar]")?.getBoundingClientRect(), pad = value.engine?.anchors.bookyPaddingPx ?? 0;
      if (box && event.clientX >= box.left - pad && event.clientX <= box.right + pad && event.clientY >= box.top - pad && event.clientY <= box.bottom + pad) return;
      const rect = canvas.getBoundingClientRect(); if (rect.width <= 0 || rect.height <= 0) return;
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const globe = globeRef.current, hit = ray.intersectObjects(globe ? [globe, ...value.hotspots] : value.hotspots, false)[0];
      const target = hit?.object.userData.target as ChildEntityReference | undefined; if (target && eligible() === value) click.current(target);
    };
    const observers: Array<[string, EventListener]> = [["pointerdown", begin as EventListener], ["pointermove", move as EventListener],
      ["pointerup", pick as EventListener], ["pointercancel", reset], ["pointerleave", reset], ["lostpointercapture", reset], ["contextmenu", reset]];
    for (const [type, observer] of observers) canvas.addEventListener(type, observer, { passive: true });
    document.addEventListener("visibilitychange", reset);
    return () => { reset(); for (const [type, observer] of observers) canvas.removeEventListener(type, observer); document.removeEventListener("visibilitychange", reset); };
  }, [camera, gl, resources, globeRef]);
  useFrame(() => {
    const at = performance.now(), previous = lastFrame.current; lastFrame.current = at;
    if ((previewOwner.current || owner.current) && (!resources.isCurrent() || gl.getContext().isContextLost())) {
      const held = previewOwner.current && resources.getSnapshot?.().preview;
      if (held && !gl.getContext().isContextLost()) void resources.cancelPreview(held.revision);
      else resources.clear();
      return;
    }
    transition.current?.advance(at);
    const value = previewOwner.current ?? owner.current;
    if (!transition.current && value?.engine && rig.current) {
      if (view.current.active && document.visibilityState === "visible" && !view.current.reducedMotion && previous >= 0) ambienceTime.current += Math.min(50, Math.max(0, at - previous));
      advanceChildSceneAmbience(gl, rig.current, value.engine, baselineExposure.current, ambienceTime.current, view.current.active && document.visibilityState === "visible", view.current.reducedMotion);
    }
  }, -10000);
  // The WebGL loss event can lag the actual context. Render only through this
  // original renderer, checking its actual context before every visible pass.
  useFrame(() => {
    const context = gl.getContext();
    if (context.isContextLost()) { if (previewOwner.current || owner.current || transition.current) resources.clear(); return; }
    try {
      gl.render(scene, camera);
      if (context.isContextLost()) { resources.clear(); return; }
      if (previewFrames.current.size && context.getError() !== context.NO_ERROR) {
        for (const frame of [...previewFrames.current]) frame.cancel();
        const held = resources.getSnapshot?.().preview; if (held) void resources.cancelPreview(held.revision);
        return;
      }
      for (const frame of [...previewFrames.current]) frame.finish();
    } catch (error) { if (!context.isContextLost()) throw error; resources.clear(); }
  }, 1);
  return null;
}
