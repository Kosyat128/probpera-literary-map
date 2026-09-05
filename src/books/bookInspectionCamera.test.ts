import { describe, expect, it } from "vitest";

import {
  BOOK_INSPECTION_CLOSE_DURATION_MS,
  BOOK_INSPECTION_DEFAULT_ORBIT,
  BOOK_INSPECTION_ENTER_DURATION_MS,
  BOOK_INSPECTION_ORBIT_LIMITS,
  applyBookInspectionOrbitDelta,
  bookInspectionViewportCanFrame,
  freezeBookInspectionExtraction,
  resetBookInspectionOrbit,
  resolveBookInspectionCameraFraming,
  resolveBookInspectionEdgeCompensation,
  resolveBookInspectionOrbitCamera,
  sampleBookInspectionTransition,
  smoothBookInspectionCameraTarget,
  type BookInspectionCameraTarget,
} from "./bookInspectionCamera";

describe("book inspection camera", () => {
  it("keeps an offscreen resize out of the camera animation until the visible area returns", () => {
    const framing = (bottom: number) => resolveBookInspectionCameraFraming({
      viewportWidth: 368, viewportHeight: 480, detailOpen: true,
      viewportInsets: { top: 0, right: 0, bottom, left: 0 }, itemIndex: 0, itemCount: 17,
    });
    expect(bookInspectionViewportCanFrame(framing(480))).toBe(false);
    expect(bookInspectionViewportCanFrame(framing(450))).toBe(false);
    const visible = framing(278.4);
    expect(bookInspectionViewportCanFrame(visible)).toBe(true);
    expect(resolveBookInspectionOrbitCamera(visible, BOOK_INSPECTION_DEFAULT_ORBIT).position[2]).toBeLessThan(30);
  });

  it("compensates the first, middle, penultimate and last real shelf edges", () => {
    expect(resolveBookInspectionEdgeCompensation(0, 7)).toEqual({
      edgeClass: "first",
      offsetX: 0.16,
    });
    expect(resolveBookInspectionEdgeCompensation(3, 7)).toEqual({
      edgeClass: "middle",
      offsetX: 0,
    });
    expect(resolveBookInspectionEdgeCompensation(5, 7)).toEqual({
      edgeClass: "penultimate",
      offsetX: -0.075,
    });
    expect(resolveBookInspectionEdgeCompensation(6, 7)).toEqual({
      edgeClass: "last",
      offsetX: -0.16,
    });
    expect(resolveBookInspectionEdgeCompensation(0, 1)).toEqual({
      edgeClass: "only",
      offsetX: 0,
    });
    expect(resolveBookInspectionEdgeCompensation(99, 7).edgeClass).toBe(
      "last"
    );
  });

  it("applies a right-panel optical inset without changing the book target depth", () => {
    const closed = resolveBookInspectionCameraFraming({
      viewportWidth: 1440,
      viewportHeight: 900,
      detailOpen: false,
      itemIndex: 4,
      itemCount: 10,
    });
    const open = resolveBookInspectionCameraFraming({
      viewportWidth: 1440,
      viewportHeight: 900,
      detailOpen: true,
      detailRightInsetPx: 400,
      itemIndex: 4,
      itemCount: 10,
    });

    expect(closed.rightInsetPx).toBe(0);
    expect(open.rightInsetPx).toBe(400);
    expect(open.opticalOffsetX).toBeGreaterThan(0);
    expect(open.position[0]).toBe(open.lookAt[0]);
    expect(open.position[0]).toBeGreaterThan(closed.position[0]);
    expect(open.lookAt[2]).toBe(closed.lookAt[2]);
    expect(open.distance).toBe(closed.distance);
  });

  it("keeps a side-panel inset out of the narrow stacked layout", () => {
    const mobile = resolveBookInspectionCameraFraming({
      viewportWidth: 390,
      viewportHeight: 844,
      detailOpen: true,
      detailRightInsetPx: 240,
      itemIndex: 0,
      itemCount: 20,
    });
    expect(mobile.rightInsetPx).toBe(0);
    expect(mobile.opticalOffsetX).toBe(0);
    expect(mobile.edgeCompensationX).toBe(0);
    expect(mobile.position.every(Number.isFinite)).toBe(true);
    expect(mobile.lookAt.every(Number.isFinite)).toBe(true);
  });

  it("damps resize targets without jumping and snaps only for reduced motion", () => {
    const current: BookInspectionCameraTarget = {
      position: [0, 0, 5],
      lookAt: [0, 0, 1],
      fov: 35,
    };
    const desired: BookInspectionCameraTarget = {
      position: [1.2, 0.2, 4.5],
      lookAt: [1.2, 0.1, 1],
      fov: 39,
    };
    expect(smoothBookInspectionCameraTarget(current, desired, 0)).toEqual(
      current
    );
    const firstFrame = smoothBookInspectionCameraTarget(
      current,
      desired,
      16
    );
    expect(firstFrame.position[0]).toBeGreaterThan(0);
    expect(firstFrame.position[0]).toBeLessThan(desired.position[0]);
    expect(firstFrame.fov).toBeGreaterThan(current.fov);
    expect(firstFrame.fov).toBeLessThan(desired.fov);
    const resumed = smoothBookInspectionCameraTarget(
      current,
      desired,
      10_000
    );
    expect(resumed.position[0]).toBeLessThan(desired.position[0]);
    expect(
      smoothBookInspectionCameraTarget(current, desired, 16, {
        reducedMotion: true,
      })
    ).toEqual(desired);
  });

  it("deep-freezes extraction identity and pose independently of source arrays", () => {
    const position: [number, number, number] = [0.2, -0.1, 0.8];
    const rotation: [number, number, number] = [0, 1.4, 0];
    const snapshot = freezeBookInspectionExtraction({
      bookKey: "book-42",
      sourceIndex: 42,
      requestId: 9,
      pose: { position, rotation, scale: 1.42 },
    });
    position[0] = 99;
    rotation[1] = 99;

    expect(snapshot.bookKey).toBe("book-42");
    expect(snapshot.pose.position).toEqual([0.2, -0.1, 0.8]);
    expect(snapshot.pose.rotation).toEqual([0, 1.4, 0]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.pose)).toBe(true);
    expect(Object.isFrozen(snapshot.pose.position)).toBe(true);
    expect(() =>
      freezeBookInspectionExtraction({
        bookKey: " ",
        sourceIndex: 0,
        requestId: 0,
        pose: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
      })
    ).toThrow(/bookKey/u);
  });

  it("finishes enter at 920ms and close at 620ms with bounded easing", () => {
    const enterStart = sampleBookInspectionTransition({
      kind: "enter",
      elapsedMs: -10,
    });
    const enterMid = sampleBookInspectionTransition({
      kind: "enter",
      elapsedMs: BOOK_INSPECTION_ENTER_DURATION_MS / 2,
    });
    const enterEnd = sampleBookInspectionTransition({
      kind: "enter",
      elapsedMs: BOOK_INSPECTION_ENTER_DURATION_MS,
    });
    const closeBefore = sampleBookInspectionTransition({
      kind: "close",
      elapsedMs: BOOK_INSPECTION_CLOSE_DURATION_MS - 1,
    });
    const closeEnd = sampleBookInspectionTransition({
      kind: "close",
      elapsedMs: BOOK_INSPECTION_CLOSE_DURATION_MS + 500,
    });

    expect(enterStart).toMatchObject({
      durationMs: 920,
      linearProgress: 0,
      easedProgress: 0,
      complete: false,
    });
    expect(enterMid.linearProgress).toBe(0.5);
    expect(enterMid.easedProgress).toBe(0.5);
    expect(enterEnd).toMatchObject({
      linearProgress: 1,
      easedProgress: 1,
      complete: true,
    });
    expect(closeBefore.complete).toBe(false);
    expect(closeBefore.easedProgress).toBeLessThan(1);
    expect(closeEnd).toMatchObject({
      durationMs: 620,
      linearProgress: 1,
      easedProgress: 1,
      complete: true,
    });
  });

  it("makes both transitions immediate for reduced motion", () => {
    for (const kind of ["enter", "close"] as const) {
      expect(
        sampleBookInspectionTransition({
          kind,
          elapsedMs: 0,
          reducedMotion: true,
        })
      ).toEqual({
        kind,
        durationMs: 0,
        linearProgress: 1,
        easedProgress: 1,
        complete: true,
      });
    }
  });

  it("clamps yaw, pitch and zoom and restores the exact neutral orbit", () => {
    const maximum = applyBookInspectionOrbitDelta(
      BOOK_INSPECTION_DEFAULT_ORBIT,
      { yaw: 4, pitch: 4, zoom: 4 }
    );
    expect(maximum).toEqual({
      yaw: BOOK_INSPECTION_ORBIT_LIMITS.maximumYaw,
      pitch: BOOK_INSPECTION_ORBIT_LIMITS.maximumPitch,
      zoom: BOOK_INSPECTION_ORBIT_LIMITS.maximumZoom,
    });
    const minimum = applyBookInspectionOrbitDelta(maximum, {
      yaw: -8,
      pitch: -8,
      zoom: -8,
    });
    expect(minimum).toEqual({
      yaw: BOOK_INSPECTION_ORBIT_LIMITS.minimumYaw,
      pitch: BOOK_INSPECTION_ORBIT_LIMITS.minimumPitch,
      zoom: BOOK_INSPECTION_ORBIT_LIMITS.minimumZoom,
    });
    expect(resetBookInspectionOrbit()).toBe(BOOK_INSPECTION_DEFAULT_ORBIT);
  });

  it("resolves bounded orbit into a finite R3F camera pose", () => {
    const framing = resolveBookInspectionCameraFraming({
      viewportWidth: 1440,
      viewportHeight: 900,
      detailOpen: true,
      itemIndex: 4,
      itemCount: 10,
    });
    const neutral = resolveBookInspectionOrbitCamera(
      framing,
      BOOK_INSPECTION_DEFAULT_ORBIT
    );
    const closer = resolveBookInspectionOrbitCamera(
      framing,
      applyBookInspectionOrbitDelta(BOOK_INSPECTION_DEFAULT_ORBIT, {
        yaw: 0.1,
        pitch: -0.05,
        zoom: 0.2,
      })
    );
    const distance = (target: BookInspectionCameraTarget) =>
      Math.hypot(
        target.position[0] - target.lookAt[0],
        target.position[1] - target.lookAt[1],
        target.position[2] - target.lookAt[2]
      );

    expect(neutral.position.every(Number.isFinite)).toBe(true);
    expect(closer.position.every(Number.isFinite)).toBe(true);
    expect(closer.lookAt.every(Number.isFinite)).toBe(true);
    expect(distance(closer)).toBeLessThan(distance(neutral));
    expect(closer.position[0]).not.toBe(neutral.position[0]);
  });
});
