import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createChildSceneTransition, createChildSkinBlend, advanceChildSceneAmbience } from "./childSceneTransition";
import { childSceneEngineFixture } from "../child/childSceneEngineFixture";
function fixture(reduced = false) {
  const f = childSceneEngineFixture(), scene = new THREE.Scene(), oldMap = new THREE.Texture(), nextMap = new THREE.Texture();
  const surface = new THREE.MeshPhysicalMaterial({ map: oldMap }), geometry = new THREE.BoxGeometry(1, 1, 1);
  const oldMaterial = new THREE.MeshStandardMaterial(), newMaterial = new THREE.MeshStandardMaterial(), prior = new THREE.Group(), candidate = new THREE.Group();
  const oldLight = new THREE.PointLight("#ffffff", 2), newLight = new THREE.PointLight("#ffffff", 4);
  prior.add(new THREE.Mesh(geometry, oldMaterial), oldLight); candidate.add(new THREE.Mesh(geometry, newMaterial), newLight); scene.add(prior);
  const camera = new THREE.PerspectiveCamera(), globe = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), surface); scene.add(globe);
  camera.position.set(0, 0, 4); const originalCamera = camera.matrixWorld.clone(), originalGlobe = globe.matrixWorld.clone();
  const rig = { ambient: new THREE.AmbientLight("#ffffff", 0), key: new THREE.DirectionalLight("#ffffff", 0) };
  const gl = { toneMappingExposure: 1, getContext: () => ({ isContextLost: () => false }) } as unknown as THREE.WebGLRenderer;
  let time = 0, current = true, visible = true, clockFailed = false; const invalidate = vi.fn(); const abort = new AbortController(), blend = createChildSkinBlend(nextMap);
  const work = createChildSceneTransition({ gl, scene, surface, prior, candidate, nextSkin: nextMap, blend, rig, engine: f.engine, baselineExposure: 1,
    visible: () => visible, reducedMotion: () => reduced, invalidate, currentClock: () => { if (clockFailed) throw new Error("Clock failed"); return time; } });
  return { ...f, scene, surface, geometry, oldMaterial, newMaterial, oldLight, newLight, prior, candidate, rig, gl, blend, work, abort, camera, globe, originalCamera, originalGlobe, oldMap, nextMap,
    commit: () => work.commit({ signal: abort.signal, isCurrent: () => current, absoluteDeadline: 5000 }), at: (at: number) => { time = at; work.advance(at); },
    invalidate, failClock: () => { clockFailed = true; }, stale: () => { current = false; }, hidden: () => { visible = false; },
    dispose() { work.rollback(); geometry.dispose(); globe.geometry.dispose(); surface.dispose(); oldMaterial.dispose(); newMaterial.dispose(); oldMap.dispose(); nextMap.dispose(); },
  };
}
afterEach(() => vi.useRealTimers());
describe("same renderer transition clock and last-valid rollback", () => {
  it("retains the old branch/map until current completion and blends skin, branch, light and exposure together", async () => {
    const f = fixture(), work = f.commit(); f.at(150);
    expect(f.surface.map).toBe(f.oldMap); expect(f.prior.parent).toBe(f.scene); expect(f.candidate.parent).toBe(f.scene);
    expect(f.blend.uniforms.childSceneSkinMix.value).toBeCloseTo(.5); expect(f.oldMaterial.opacity).toBeCloseTo(.5); expect(f.newMaterial.opacity).toBeCloseTo(.5);
    expect(f.oldLight.intensity).toBeCloseTo(1); expect(f.newLight.intensity).toBeCloseTo(2);
    expect(f.gl.toneMappingExposure).toBeCloseTo(.975); expect(f.rig.ambient.intensity).toBeCloseTo(.175);
    f.at(300); await work; expect(f.prior.parent).toBe(f.scene); f.work.finalize();
    expect(f.surface.map).toBe(f.nextMap); expect(f.prior.parent).toBeNull(); expect(f.newLight.intensity).toBe(4); expect(f.oldMaterial.transparent).toBe(false); expect(f.newMaterial.depthWrite).toBe(true);
    expect(f.camera.matrixWorld).toEqual(f.originalCamera); expect(f.globe.matrixWorld).toEqual(f.originalGlobe); await f.work.join(); f.dispose();
  });
  it("rolls a late cancellation back to actual old map/light/exposure/material state and refuses finalize", async () => {
    const f = fixture(), work = f.commit(); f.at(150); f.abort.abort(); await expect(work).rejects.toThrow("retired");
    expect(f.surface.map).toBe(f.oldMap); expect(f.prior.parent).toBe(f.scene); expect(f.candidate.parent).toBeNull();
    expect(f.gl.toneMappingExposure).toBe(1); expect(f.rig.ambient.intensity).toBe(0); expect(f.oldLight.intensity).toBe(2); expect(f.newLight.intensity).toBe(4); expect(f.oldMaterial.opacity).toBe(1); expect(f.oldMaterial.depthWrite).toBe(true);
    expect(() => f.work.finalize()).toThrow(); await f.work.join(); f.dispose();
  });
  it("cancels hidden, obsolete and backwards-clock transitions; a stalled loop hits an independent bounded timeout", async () => {
    for (const retire of ["hidden", "stale", "backwards"] as const) {
      const f = fixture(), work = f.commit(); f.at(100);
      if (retire === "hidden") f.hidden(); else if (retire === "stale") f.stale();
      f.at(retire === "backwards" ? 99 : 101); await expect(work).rejects.toThrow(); expect(f.candidate.parent).toBeNull(); f.dispose();
    }
    vi.useFakeTimers(); const f = fixture(), work = f.commit(); await vi.advanceTimersByTimeAsync(f.engine.transition.timeoutMs);
    await expect(work).rejects.toThrow(); expect(f.prior.parent).toBe(f.scene); await f.work.join(); f.dispose();
  });
  it("honors reduced motion instantly and freezes optional silent ambience without a new actor or animation loop", async () => {
    const f = fixture(true); await f.commit(); f.work.finalize();
    expect(f.blend.uniforms.childSceneSkinMix.value).toBe(1);
    advanceChildSceneAmbience(f.gl, f.rig, f.engine, 1, 1500, true, false); expect(f.rig.ambient.intensity).toBeGreaterThan(.35);
    advanceChildSceneAmbience(f.gl, f.rig, f.engine, 1, 1500, true, true); expect(f.rig.ambient.intensity).toBe(.35);
    expect(f.engine.ambience.audio).toBe("silent"); f.dispose();
  });
  it("settles setup exceptions and removes a candidate even when added observers throw after parentage changes", async () => {
    for (const failure of ["clock", "added"] as const) {
      const f = fixture();
      if (failure === "clock") f.failClock(); else f.candidate.addEventListener("added", () => { throw new Error("added observer failed"); });
      await expect(f.commit()).rejects.toThrow("retired"); await f.work.join();
      expect(f.candidate.parent).toBeNull(); expect(f.prior.parent).toBe(f.scene); expect(f.surface.map).toBe(f.oldMap); f.dispose();
    }
  });
  it("restores exact prior parent order and old light/map when removed observers reject finalization", async () => {
    const f = fixture(true), before = f.scene.children.slice(); await f.commit();
    f.prior.addEventListener("removed", () => { throw new Error("removed observer failed"); });
    expect(() => f.work.finalize()).toThrow("removed observer failed");
    expect(f.scene.children).toEqual(before); expect(f.surface.map).toBe(f.oldMap); expect(f.gl.toneMappingExposure).toBe(1);
    expect(f.oldMaterial.opacity).toBe(1); expect(f.candidate.parent).toBeNull(); await f.work.join(); f.dispose();
  });
  it("refuses synchronous revocation from a finalization observer and exposes unknown cleanup to join", async () => {
    const f = fixture(true); await f.commit(); f.invalidate.mockImplementationOnce(() => f.stale());
    expect(() => f.work.finalize()).toThrow("retired"); expect(f.prior.parent).toBe(f.scene); expect(f.surface.map).toBe(f.oldMap); await f.work.join(); f.dispose();
    const broken = fixture(); broken.invalidate.mockImplementation(() => { throw new Error("invalidate failed"); });
    await expect(broken.commit()).rejects.toThrow("retired"); await expect(broken.work.join()).rejects.toThrow("cleanup failed");
    expect(broken.candidate.parent).toBeNull(); expect(broken.surface.map).toBe(broken.oldMap); broken.dispose();
  });
});