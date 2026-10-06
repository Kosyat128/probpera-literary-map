import * as THREE from "three";
import type { ChildEngineComposition } from "../child/childSceneEngine";

export interface ChildSceneCommitOptions {
  readonly signal: AbortSignal; readonly isCurrent: () => boolean; readonly absoluteDeadline: number;
}
export interface ChildSceneRig { readonly ambient: THREE.AmbientLight; readonly key: THREE.DirectionalLight }
type RigState = { ambient: THREE.Color; key: THREE.Color; ambientIntensity: number; keyIntensity: number; exposure: number };
type MaterialState = { material: THREE.Material; opacity: number; transparent: boolean; depthWrite: boolean };
export interface ChildSkinBlend {
  readonly uniforms: { childSceneNextMap: { value: THREE.Texture }; childSceneSkinMix: { value: number } };
  install(material: THREE.MeshPhysicalMaterial): () => void;
}
/** The existing globe is sampled once; no second visible globe/camera exists.
 * Compile this SAME hook on the borrowed off-state warm mesh before commit. */
export function createChildSkinBlend(nextMap: THREE.Texture): ChildSkinBlend {
  const uniforms = { childSceneNextMap: { value: nextMap }, childSceneSkinMix: { value: 0 } };
  return Object.freeze({ uniforms, install(material: THREE.MeshPhysicalMaterial) {
    const originalCompile = material.onBeforeCompile, originalKey = material.customProgramCacheKey;
    const compile: typeof originalCompile = (parameters, renderer) => {
      originalCompile.call(material, parameters, renderer);
      if (!parameters.fragmentShader.includes("#include <map_fragment>")) throw new Error("Original physical map shader is unavailable");
      Object.assign(parameters.uniforms, uniforms);
      parameters.fragmentShader = "uniform sampler2D childSceneNextMap;\nuniform float childSceneSkinMix;\n" + parameters.fragmentShader.replace("#include <map_fragment>", `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
  #endif
  vec4 childSceneNextColor = texture2D(childSceneNextMap, vMapUv);
  diffuseColor *= mix(sampledDiffuseColor, childSceneNextColor, childSceneSkinMix);
#endif`);
    };
    const cacheKey = () => originalKey.call(material) + "|child-scene-skin-crossfade-v1";
    material.onBeforeCompile = compile; material.customProgramCacheKey = cacheKey; material.needsUpdate = true;
    return () => { if (material.onBeforeCompile === compile) { material.onBeforeCompile = originalCompile; material.customProgramCacheKey = originalKey; material.needsUpdate = true; } };
  } });
}
function materials(group: THREE.Group | null): MaterialState[] {
  const states: MaterialState[] = [], seen = new Set<THREE.Material>();
  group?.traverse(object => { if (!(object instanceof THREE.Mesh)) return; for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
    if (seen.has(material)) continue; seen.add(material); states.push({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
  } }); return states;
}
function branchLights(group: THREE.Group | null): Array<{ light: THREE.Light; intensity: number }> {
  const values: Array<{ light: THREE.Light; intensity: number }> = [];
  group?.traverse(object => { if (object instanceof THREE.Light) values.push({ light: object, intensity: object.intensity }); }); return values;
}
export function prepareChildBranchFade(group: THREE.Group): () => void {
  const states = materials(group);
  for (const s of states) { s.material.transparent = true; s.material.depthWrite = false; s.material.needsUpdate = true; }
  return () => { for (const s of states) { s.material.opacity = s.opacity; s.material.transparent = s.transparent; s.material.depthWrite = s.depthWrite; s.material.needsUpdate = true; } };
}
const rigSnapshot = (gl: THREE.WebGLRenderer, rig: ChildSceneRig): RigState => ({ ambient: rig.ambient.color.clone(), key: rig.key.color.clone(), ambientIntensity: rig.ambient.intensity, keyIntensity: rig.key.intensity, exposure: gl.toneMappingExposure });
const writeRig = (gl: THREE.WebGLRenderer, rig: ChildSceneRig, state: RigState) => { rig.ambient.color.copy(state.ambient); rig.key.color.copy(state.key); rig.ambient.intensity = state.ambientIntensity; rig.key.intensity = state.keyIntensity; gl.toneMappingExposure = state.exposure; };
const engineRig = (engine: ChildEngineComposition, baselineExposure: number): RigState => ({
  ambient: new THREE.Color().setRGB(...engine.lighting.ambientRgb.map(n => n / 255) as [number, number, number], THREE.SRGBColorSpace),
  key: new THREE.Color().setRGB(...engine.lighting.keyRgb.map(n => n / 255) as [number, number, number], THREE.SRGBColorSpace),
  ambientIntensity: engine.lighting.ambientMilli / 1000, keyIntensity: engine.lighting.keyMilli / 1000, exposure: baselineExposure * engine.lighting.exposurePermille / 1000,
});
export interface ChildSceneTransition {
  commit(options: ChildSceneCommitOptions): Promise<void>;
  advance(now: number): void;
  rollback(): void;
  finalize(): void;
  join(): Promise<void>;
}
/** Progress is driven by the ORIGINAL R3F frame loop. A bounded independent
 * timer cancels stalled/hidden frames; no second renderer/animation loop, audio
 * autoplay or camera/Booky write is performed. finalize follows a fresh native
 * authority/deadline check; until then rollback restores the live old branch. */
export function createChildSceneTransition({ gl, scene, surface, prior, candidate, nextSkin, blend, rig, engine, baselineExposure, visible, reducedMotion, invalidate, currentClock }:
  { gl: THREE.WebGLRenderer; scene: THREE.Scene; surface: THREE.MeshPhysicalMaterial; prior: THREE.Group | null; candidate: THREE.Group; nextSkin: THREE.Texture; blend: ChildSkinBlend;
    rig: ChildSceneRig; engine: ChildEngineComposition; baselineExposure: number; visible: () => boolean; reducedMotion: () => boolean; invalidate: () => void; currentClock: () => number }): ChildSceneTransition {
  let options: ChildSceneCommitOptions | null = null, started = -1, last = -1, settled = false, successful = false, finalized = false, rolledBack = false;
  let timer: ReturnType<typeof setTimeout> | null = null, restoreHook: (() => void) | null = null, cleanupFailed = false;
  let resolve!: () => void, reject!: (error: Error) => void, promise: Promise<void> | null = null;
  const previousMap = surface.map, originalRig = rigSnapshot(gl, rig), targetRig = engineRig(engine, baselineExposure), oldStates = materials(prior), newStates = materials(candidate);
  const oldLights = branchLights(prior), newLights = branchLights(candidate);
  const priorParent = prior?.parent ?? null, priorIndex = prior && priorParent ? priorParent.children.indexOf(prior) : -1;
  function attempt(work: () => void) { try { work(); } catch { cleanupFailed = true; } }
  function cleanupClock() { if (timer !== null) clearTimeout(timer); timer = null; options?.signal.removeEventListener("abort", abort); }
  function restore(states: MaterialState[]) { for (const s of states) { s.material.opacity = s.opacity; s.material.transparent = s.transparent; s.material.depthWrite = s.depthWrite; s.material.needsUpdate = true; } }
  function rollback() {
    if (finalized || rolledBack) return; rolledBack = true; successful = false; cleanupClock();
    // Settle before invoking any observer: an add/remove/invalidate exception
    // must never leave a pending commit promise or prevent other cleanup.
    if (!settled && promise) { settled = true; reject(new Error("Scene transition retired")); }
    attempt(() => restoreHook?.()); restoreHook = null; blend.uniforms.childSceneSkinMix.value = 0;
    attempt(() => { if (surface.map === previousMap || surface.map === nextSkin) { surface.map = previousMap; surface.needsUpdate = true; } });
    attempt(() => writeRig(gl, rig, originalRig)); attempt(() => restore(oldStates)); attempt(() => restore(newStates));
    for (const s of [...oldLights, ...newLights]) attempt(() => { s.light.intensity = s.intensity; });
    // Three dispatches removed/added after changing parentage. Inspect actual
    // parentage even if add/remove threw before returning to this owner.
    attempt(() => candidate.removeFromParent());
    if (prior && priorParent && prior.parent !== priorParent) attempt(() => priorParent.add(prior));
    if (prior && priorParent && prior.parent === priorParent && priorIndex >= 0) {
      const index = priorParent.children.indexOf(prior);
      if (index !== priorIndex) { priorParent.children.splice(index, 1); priorParent.children.splice(priorIndex, 0, prior); }
    }
    attempt(invalidate);
  }
  function abort() { rollback(); }
  function live(at: number) { return options && !rolledBack && !options.signal.aborted && options.isCurrent() && visible() && !gl.getContext().isContextLost() && Number.isFinite(at) && at >= last && at < options.absoluteDeadline; }
  function step(at: number) {
    if (settled || !options) return;
    try {
      if (!live(at)) { rollback(); return; } last = at;
      const duration = reducedMotion() ? 0 : engine.transition.durationMs, fraction = duration === 0 ? 1 : Math.max(0, Math.min(1, (at - started) / duration)), p = fraction * fraction * (3 - 2 * fraction);
      blend.uniforms.childSceneSkinMix.value = p;
      for (const s of oldStates) { s.material.transparent = true; s.material.depthWrite = false; s.material.opacity = s.opacity * (1 - p); }
      for (const s of newStates) s.material.opacity = s.opacity * p;
      for (const s of oldLights) s.light.intensity = s.intensity * (1 - p);
      for (const s of newLights) s.light.intensity = s.intensity * p;
      rig.ambient.color.copy(originalRig.ambient).lerp(targetRig.ambient, p); rig.key.color.copy(originalRig.key).lerp(targetRig.key, p);
      rig.ambient.intensity = originalRig.ambientIntensity + (targetRig.ambientIntensity - originalRig.ambientIntensity) * p;
      rig.key.intensity = originalRig.keyIntensity + (targetRig.keyIntensity - originalRig.keyIntensity) * p;
      gl.toneMappingExposure = originalRig.exposure + (targetRig.exposure - originalRig.exposure) * p;
      invalidate();
      if (!live(at)) { rollback(); return; }
      if (fraction === 1) { cleanupClock(); settled = successful = true; resolve(); }
    } catch { rollback(); }
  }
  return Object.freeze({
    commit(next: ChildSceneCommitOptions) {
      if (promise) return promise; options = next;
      promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); void promise.catch(() => undefined);
      if (rolledBack) { settled = true; reject(new Error("Scene transition retired")); return promise; }
      try {
        const at = currentClock(); if (!live(at) || !previousMap) { rollback(); return promise; }
        started = last = at; restoreHook = blend.install(surface);
        for (const s of oldStates) { s.material.transparent = true; s.material.depthWrite = false; s.material.needsUpdate = true; }
        for (const s of newStates) { s.material.opacity = 0; s.material.transparent = true; s.material.depthWrite = false; s.material.needsUpdate = true; }
        for (const s of newLights) s.light.intensity = 0;
        scene.add(candidate);
        if (!live(at)) { rollback(); return promise; }
        options.signal.addEventListener("abort", abort, { once: true });
        timer = setTimeout(abort, Math.max(1, Math.min(engine.transition.timeoutMs, options.absoluteDeadline - at)));
        step(at);
      } catch { rollback(); }
      return promise;
    },
    advance: step,
    rollback,
    finalize() {
      try {
        const at = currentClock(); if (!successful || finalized || !live(at)) throw new Error("Current completed transition required");
        cleanupClock(); restoreHook?.(); restoreHook = null; surface.map = nextSkin; surface.needsUpdate = true;
        restore(newStates); restore(oldStates);
        for (const s of [...oldLights, ...newLights]) s.light.intensity = s.intensity;
        prior?.removeFromParent(); writeRig(gl, rig, targetRig); invalidate();
        if (!live(currentClock())) throw new Error("Scene retired during finalization");
        finalized = true;
      } catch (error) { rollback(); throw error; }
    },
    async join() { if (promise) await promise.catch(() => undefined); if (cleanupFailed) throw new Error("Scene transition cleanup failed"); },
  });
}
export function advanceChildSceneAmbience(gl: THREE.WebGLRenderer, rig: ChildSceneRig, engine: ChildEngineComposition, baselineExposure: number, elapsedMs: number, active: boolean, reducedMotion: boolean) {
  const target = engineRig(engine, baselineExposure);
  const animate = active && !reducedMotion && engine.ambience.animation === "gentle-light";
  const modulation = animate ? 1 + Math.sin(elapsedMs * Math.PI * 2 / engine.ambience.periodMs) * engine.ambience.amplitudePermille / 1000 : 1;
  target.ambientIntensity *= modulation; writeRig(gl, rig, target);
}