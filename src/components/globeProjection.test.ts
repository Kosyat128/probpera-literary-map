import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  applyPerspectiveViewInsets,
  globeReticleNdc,
  projectGlobeCandidate,
  raycastGlobeAtNdc,
} from "./globeProjection";

function camera() {
  const result = new THREE.PerspectiveCamera(43, 16 / 9, 0.1, 100);
  result.position.set(0, 0, 4.9);
  result.lookAt(0, -0.2, 0);
  result.updateMatrixWorld(true);
  result.updateProjectionMatrix();
  return result;
}

describe("globe projection", () => {
  it("places the reticle in the unobscured optical centre", () => {
    expect(globeReticleNdc(1000, 800, { top: 0, right: 300, bottom: 0, left: 0 }).x)
      .toBeCloseTo(-0.3, 5);
    expect(globeReticleNdc(1000, 800, { top: 0, right: 0, bottom: 240, left: 0 }).y)
      .toBeCloseTo(0.3, 5);
  });

  it("shifts projection without writing camera position", () => {
    const viewCamera = camera();
    const before = viewCamera.position.clone();
    applyPerspectiveViewInsets(viewCamera, 1000, 800, {
      top: 0,
      right: 300,
      bottom: 0,
      left: 0,
    });
    const projected = new THREE.Vector3(0, 0, 0).project(viewCamera);
    expect(projected.x).toBeLessThan(0);
    expect(viewCamera.position.equals(before)).toBe(true);
  });

  it("clears a prior view offset when insets disappear", () => {
    const viewCamera = camera();
    applyPerspectiveViewInsets(viewCamera, 1000, 800, {
      top: 0,
      right: 300,
      bottom: 0,
      left: 0,
    });
    expect(viewCamera.view?.enabled).toBe(true);
    applyPerspectiveViewInsets(viewCamera, 1000, 800);
    expect(viewCamera.view?.enabled).toBe(false);
  });

  it("raycasts the actual globe mesh and preserves its uv", () => {
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16));
    globe.updateMatrixWorld(true);
    const hit = raycastGlobeAtNdc({
      camera: camera(),
      globeObject: globe,
      ndc: new THREE.Vector2(0, 0),
    });
    expect(hit).not.toBeNull();
    expect(hit?.point.length()).toBeCloseTo(1, 2);
    expect(hit?.uv.x).toBeGreaterThanOrEqual(0);
    expect(hit?.uv.x).toBeLessThanOrEqual(1);
  });

  it("returns only a filter-selectable country candidate", () => {
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16));
    const atlas = { countryAtUv: () => ({ id: "france" }) };
    expect(
      projectGlobeCandidate({
        camera: camera(),
        globeObject: globe,
        atlas,
        selectableCountryIds: new Set(["france"]),
        width: 1000,
        height: 800,
      })?.countryId
    ).toBe("france");
    expect(
      projectGlobeCandidate({
        camera: camera(),
        globeObject: globe,
        atlas,
        selectableCountryIds: new Set(["spain"]),
        width: 1000,
        height: 800,
      })
    ).toBeNull();
  });
});
