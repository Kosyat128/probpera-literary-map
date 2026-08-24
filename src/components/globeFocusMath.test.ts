import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  GLOBE_SAFE_CAMERA_RADIUS,
  angularDistanceRadians,
  cameraFlightDurationMs,
  countryFocusMetricsFromGeometries,
  focusCameraRadius,
  opticalCenterOffset,
  sampleCameraTrajectory,
  stableSphericalDirection,
} from "./globeFocusMath";
import type { GlobeGeoGeometry } from "./globeGeography";

const square = (
  west: number,
  south: number,
  east: number,
  north: number
): GlobeGeoGeometry => ({
  type: "Polygon",
  coordinates: [[
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ]],
});

describe("premium globe spherical camera math", () => {
  it("uses a safe great-circle path for near, far, and exact-opposite targets", () => {
    const origins = [
      [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.98, 0.2, 0)],
      [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
      [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)],
    ] as const;

    for (const [from, to] of origins) {
      for (let step = 0; step <= 40; step += 1) {
        const direction = stableSphericalDirection(from, to, step / 40);
        expect(direction.length()).toBeCloseTo(1, 7);
        expect([direction.x, direction.y, direction.z].every(Number.isFinite)).toBe(true);
      }
      expect(stableSphericalDirection(from, to, 0).distanceTo(from.clone().normalize())).toBeLessThan(1e-7);
      expect(stableSphericalDirection(from, to, 1).distanceTo(to.clone().normalize())).toBeLessThan(1e-7);
    }
  });

  it("samples radius separately and never enters the globe", () => {
    const trajectory = {
      fromDirection: new THREE.Vector3(1, 0, 0),
      toDirection: new THREE.Vector3(-1, 0, 0),
      fromRadius: 4.9,
      toRadius: 2.1,
      fromTarget: new THREE.Vector3(0, -0.2, 0),
      toTarget: new THREE.Vector3(0, 0, 0),
      safeMinimumRadius: GLOBE_SAFE_CAMERA_RADIUS,
    };
    for (let step = 0; step <= 80; step += 1) {
      const sample = sampleCameraTrajectory(trajectory, step / 80);
      expect(sample.position.length()).toBeGreaterThanOrEqual(GLOBE_SAFE_CAMERA_RADIUS - 1e-7);
      expect([sample.position.x, sample.position.y, sample.position.z].every(Number.isFinite)).toBe(true);
    }
  });

  it("keeps premium timings below the old 1450ms flight", () => {
    expect(cameraFlightDurationMs(THREE.MathUtils.degToRad(8))).toBeGreaterThanOrEqual(300);
    expect(cameraFlightDurationMs(Math.PI / 2)).toBeGreaterThanOrEqual(420);
    expect(cameraFlightDurationMs(Math.PI)).toBeLessThanOrEqual(850);
    expect(cameraFlightDurationMs(Math.PI, { mobile: true })).toBeLessThanOrEqual(580);
    expect(cameraFlightDurationMs(Math.PI, { reducedMotion: true })).toBe(0);
  });

  it("uses the free UI area for optical framing", () => {
    const desktop = opticalCenterOffset(1440, 900, { top: 0, right: 440, bottom: 0, left: 0 });
    const mobile = opticalCenterOffset(390, 844, { top: 0, right: 0, bottom: 180, left: 0 });
    expect(desktop.x).toBeLessThan(0);
    expect(mobile.y).toBeGreaterThan(0);
  });

  it("clamps microstates and zooms large countries out further", () => {
    const micro = focusCameraRadius({
      metrics: { principalAngularExtent: THREE.MathUtils.degToRad(0.2) },
      verticalFovDegrees: 43,
      viewportWidth: 1440,
      viewportHeight: 900,
    });
    const large = focusCameraRadius({
      metrics: { principalAngularExtent: THREE.MathUtils.degToRad(45) },
      verticalFovDegrees: 43,
      viewportWidth: 1440,
      viewportHeight: 900,
      insets: { top: 0, right: 440, bottom: 0, left: 0 },
    });
    expect(micro).toBe(GLOBE_SAFE_CAMERA_RADIUS);
    expect(large).toBeGreaterThan(micro);
  });
});

describe("country focus metrics", () => {
  it("is antimeridian-safe and ignores a tiny remote territory", () => {
    const metrics = countryFocusMetricsFromGeometries([
      square(170, -12, 190, 12),
      square(-62, 2, -61.5, 2.5),
    ]);
    expect(metrics).not.toBeNull();
    expect(metrics?.principalPolygonCount).toBe(1);
    const dateLine = new THREE.Vector3(-1, 0, 0);
    expect(angularDistanceRadians(metrics!.direction, dateLine)).toBeLessThan(
      THREE.MathUtils.degToRad(20)
    );
  });

  it("uses an explicit fallback for a microstate without principal geometry", () => {
    const metrics = countryFocusMetricsFromGeometries([], [43.7384, 7.4246]);
    expect(metrics).toMatchObject({
      source: "fallback",
      principalPolygonCount: 0,
    });
    expect(metrics?.direction.length()).toBeCloseTo(1, 7);
  });
});
