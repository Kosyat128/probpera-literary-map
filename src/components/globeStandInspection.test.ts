import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLOBE_MAX_CAMERA_RADIUS, GLOBE_SAFE_CAMERA_RADIUS } from "./globeFocusMath";
import { applyPerspectiveViewInsets } from "./globeProjection";
import { globeStandInspectionFrame, globeStandInspectionMagnification, globeStandInspectionOrbitLimits, globeStandInspectionZoom,
  standInspectionBoundsMatch, type GlobeRenderedStandBounds } from "./globeStandInspection";

const head: GlobeRenderedStandBounds = { standId: "stand.base.portrait-tolstoy", renderRevision: 8,
  qualityTier: "high", min: [-.4, -1.73, -.4], max: [.4, -1.02, .4] };
const whales: GlobeRenderedStandBounds = { standId: "stand.base.three-whales", renderRevision: 9,
  qualityTier: "economy", min: [-1.4, -1.36, -1.4], max: [1.4, -.78, 1.4] };
const book: GlobeRenderedStandBounds = { standId: "stand.base.child-book-cloud", renderRevision: 10,
  qualityTier: "balanced", min: [-.53, -1.44, -.4], max: [.53, -1.03, .4] };
const desktop = { verticalFovDegrees: 43, viewportWidth: 1440, viewportHeight: 900,
  viewInsets: { top: 0, right: 470, bottom: 0, left: 345 } };
const phone = { verticalFovDegrees: 43, viewportWidth: 390, viewportHeight: 844,
  viewInsets: { top: 355, right: 0, bottom: 154, left: 0 } };

function expectProjectionFits(bounds: GlobeRenderedStandBounds, projection: typeof desktop, position: THREE.Vector3,
  target: THREE.Vector3, zoom: number) {
  // Use Three's actual projection and the existing inset implementation as the
  // oracle, not a second implementation of the framing inequalities.
  const camera = new THREE.PerspectiveCamera(projection.verticalFovDegrees,
    projection.viewportWidth / projection.viewportHeight, .05, 100);
  camera.position.copy(position); camera.zoom = zoom; camera.lookAt(target); camera.updateMatrixWorld(true);
  applyPerspectiveViewInsets(camera, projection.viewportWidth, projection.viewportHeight, projection.viewInsets);
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
    const projected = new THREE.Vector3(x, y, z).project(camera);
    const pixelX = (projected.x + 1) * projection.viewportWidth / 2;
    const pixelY = (1 - projected.y) * projection.viewportHeight / 2;
    expect(pixelX).toBeGreaterThan(projection.viewInsets.left);
    expect(pixelX).toBeLessThan(projection.viewportWidth - projection.viewInsets.right);
    expect(pixelY).toBeGreaterThan(projection.viewInsets.top);
    expect(pixelY).toBeLessThan(projection.viewportHeight - projection.viewInsets.bottom);
    expect(projected.z).toBeGreaterThan(-1); expect(projected.z).toBeLessThan(1);
  }
}

describe("stand inspection framing on the existing globe camera", () => {
  it("bounds optical commands and retains chosen magnification when the fitted viewport zoom changes", () => {
    let factor = 1;
    for (let step = 0; step < 20; step++) factor = globeStandInspectionMagnification(2.3, factor * 1.18)!.factor;
    const enlarged = globeStandInspectionMagnification(2.3, factor)!;
    expect(enlarged).toMatchObject({ zoom: 4.6, maxZoom: 4.6, factor: 2, percent: 200 });
    for (let step = 0; step < 20; step++) factor = globeStandInspectionMagnification(2.3, factor / 1.18)!.factor;
    expect(globeStandInspectionMagnification(2.3, factor)).toMatchObject({ zoom: 2.3 * .65, minZoom: 2.3 * .65, percent: 65 });
    const userZoom = globeStandInspectionMagnification(2.3, 1.18)!;
    const resized = globeStandInspectionMagnification(.85, userZoom.factor)!;
    expect(resized.percent).toBe(118); expect(resized.zoom).toBeCloseTo(.85 * 1.18, 12);
    expect(globeStandInspectionMagnification(8, 100)?.zoom).toBe(16);
    expect(globeStandInspectionMagnification(.1, 0)?.zoom).toBe(.1);
    expect(globeStandInspectionMagnification(NaN)).toBeNull();
    expect(globeStandInspectionMagnification(2, Infinity)).toBeNull();
  });

  it("fits full portrait, whales and book bounds inside desktop and narrow unobscured viewports", () => {
    for (const bounds of [head, whales, book]) for (const projection of [desktop, phone]) {
      const frame = globeStandInspectionFrame({ ...projection, bounds });
      expect(frame, `${bounds.standId}/${projection.viewportWidth}`).not.toBeNull();
      if (!frame) throw new Error("Missing inspection frame");
      expectProjectionFits(bounds, projection, frame.position, frame.target, frame.zoom);
      expect(frame.position.length()).toBeGreaterThanOrEqual(GLOBE_SAFE_CAMERA_RADIUS);
      expect(frame.position.length()).toBeLessThanOrEqual(GLOBE_MAX_CAMERA_RADIUS);
      expect(frame.position.distanceTo(frame.target)).toBeGreaterThanOrEqual(frame.minDistance);
      expect(frame.position.distanceTo(frame.target)).toBeLessThanOrEqual(frame.maxDistance);
    }
  });

  it("keeps the complete allowed orbit outside the globe and within the existing background clearance", () => {
    for (const bounds of [head, whales, book]) {
      const frame = globeStandInspectionFrame({ ...desktop, bounds })!;
      // Include both poles and shortest/longest radius, where moving a target
      // below the globe previously made the ordinary distance limits unsafe.
      for (const distance of [frame.minDistance, frame.maxDistance]) for (let polar = 0; polar <= 12; polar++) {
        for (let azimuth = 0; azimuth < 16; azimuth++) {
          const point = new THREE.Vector3().setFromSphericalCoords(distance, polar * Math.PI / 12, azimuth * Math.PI / 8).add(frame.target);
          expect(point.length()).toBeGreaterThanOrEqual(GLOBE_SAFE_CAMERA_RADIUS);
          expect(point.length()).toBeLessThanOrEqual(GLOBE_MAX_CAMERA_RADIUS);
        }
      }
    }
    expect(globeStandInspectionOrbitLimits(new THREE.Vector3(0, -1.6, 0))).toBeNull();
    expect(globeStandInspectionOrbitLimits(new THREE.Vector3(NaN, 0, 0))).toBeNull();
  });

  it("reframes a resized view at the actual manually chosen pose without modifying its position or target", () => {
    const frame = globeStandInspectionFrame({ ...desktop, bounds: head })!;
    const position = new THREE.Vector3().setFromSphericalCoords((frame.minDistance + frame.maxDistance) / 2, 1.32, -.63).add(frame.target);
    const originalPosition = position.toArray(), originalTarget = frame.target.toArray();
    const zoom = globeStandInspectionZoom({ ...phone, bounds: head, position, target: frame.target });
    expect(zoom).not.toBeNull();
    expectProjectionFits(head, phone, position, frame.target, zoom!);
    expect(position.toArray()).toEqual(originalPosition); expect(frame.target.toArray()).toEqual(originalTarget);
    // Bounds from another detail tier have identical authored extent and must
    // not themselves invent a new view or a different framing scale.
    expect(globeStandInspectionZoom({ ...phone, bounds: { ...head, qualityTier: "economy", renderRevision: 11 }, position, target: frame.target })).toBe(zoom);
  });

  it("rejects stale receipts and impossible or malformed frames instead of zooming to unknown geometry", () => {
    const request = { sessionId: 4, standId: head.standId, renderRevision: 8 };
    expect(standInspectionBoundsMatch(request, head)).toBe(true);
    expect(standInspectionBoundsMatch(request, null)).toBe(false);
    expect(standInspectionBoundsMatch(request, { ...head, renderRevision: 7 })).toBe(false);
    expect(standInspectionBoundsMatch(request, whales)).toBe(false);
    expect(standInspectionBoundsMatch({ ...request, sessionId: Infinity }, head)).toBe(false);
    expect(globeStandInspectionFrame({ ...desktop, bounds: { ...head, min: [NaN, -1.73, -.4] } })).toBeNull();
    expect(globeStandInspectionFrame({ ...desktop, bounds: { ...head, max: head.min } })).toBeNull();
    expect(globeStandInspectionFrame({ ...phone, bounds: head, viewInsets: { ...phone.viewInsets, top: 844 } })).toBeNull();
    expect(globeStandInspectionFrame({ ...desktop, bounds: head, verticalFovDegrees: 0 })).toBeNull();
    expect(globeStandInspectionZoom({ ...desktop, bounds: head, position: new THREE.Vector3(0, -1.3, 0), target: new THREE.Vector3(0, -1.3, -1) })).toBeNull();
  });
});
