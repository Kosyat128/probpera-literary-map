import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { buildCompleteShelfBookPose, buildCompleteShelfBookSpec, COMPLETE_SHELF_BOOK_FORMAT, layoutCompleteShelfBooks, OWNER_LOCKED_SPINE_PALETTE } from "./completeShelfModel";
import { resolveBookPhysicalBounds, resolveBookShelfInspectionGutter } from "./bookShelfPhysicalLayout";
import { resolveBookInspectionCameraFraming, resolveBookInspectionOrbitCamera, resolveBookShelfUnobscuredViewport } from "./bookInspectionCamera";

const makeSpec = (index: number) => buildCompleteShelfBookSpec({ key: `book-${index}`, title: `Book ${index}`, writer: "Writer", baseColor: "#000000", accentColor: "#000000", paperColor: "#ffffff", ownerPaletteSlot: index }, index);
const phases = ["INSPECTION_CLOSED", "COVER_CRACKED", "COVER_OPENING", "BOOK_OPEN", "PAGE_DRAGGING", "PAGE_SETTLING", "INSPECTION_CLOSING"] as const;

describe("physical shelf bounds and identity", () => {
  it("pins all 17 owner cells without changing an existing key under reorder", () => {
    const specs = Array.from({ length: 17 }, (_, index) => makeSpec(index));
    expect(specs.map((spec) => spec.baseColor)).toEqual(OWNER_LOCKED_SPINE_PALETTE);
    for (const spec of specs) {
      expect(spec.physicalBindingVisual).toBe("OWNER_LOCKED_WOVEN_CLOTH");
      expect(spec.binding).toBe("cloth");
      expect(spec.motif).toBe("rules");
      expect(spec.lean).toBe(0);
      expect(spec.dimensions).toEqual(COMPLETE_SHELF_BOOK_FORMAT);
    }
    expect(new Set(specs.map((spec) => spec.baseColor)).size).toBe(17);
  });

  it("reserves the whole cover/page footprint for first, middle and last books and returns exactly", () => {
    const specs = Array.from({ length: 17 }, (_, index) => makeSpec(index));
    const layout = layoutCompleteShelfBooks(specs, 8);
    for (const anchorSlot of [0, 8, 16]) for (const phase of phases) {
      const common = { anchorSlot, phase, selectedBookKey: specs[anchorSlot].key,
        focusedBookKey: specs[anchorSlot].key, inspectionOriginX: layout[anchorSlot].x };
      const bounds = resolveBookPhysicalBounds({ dimensions: COMPLETE_SHELF_BOOK_FORMAT, phase, scale: 1.42 });
      for (const entry of layout) {
        if (entry.slotIndex === anchorSlot) continue;
        const pose = buildCompleteShelfBookPose({ layout: entry, ...common });
        const halfSpine = (entry.spec.dimensions.pageDepth + entry.spec.dimensions.boardThickness * 2) / 2;
        if (entry.slotIndex < anchorSlot) expect(pose.position[0] + halfSpine).toBeLessThan(bounds.min[0] - 0.05);
        else expect(pose.position[0] - halfSpine).toBeGreaterThan(bounds.max[0] + 0.05);
        const idle = buildCompleteShelfBookPose({ layout: entry, ...common, phase: "SHELF_IDLE" });
        for (let cycle = 0; cycle < 50; cycle += 1) {
          expect(buildCompleteShelfBookPose({ layout: entry, ...common, phase: "SHELF_RESTORING" })).toEqual(idle);
        }
      }
    }
    const closed = resolveBookShelfInspectionGutter({ dimensions: COMPLETE_SHELF_BOOK_FORMAT, phase: "INSPECTION_CLOSED", scale: 1.42 });
    const open = resolveBookShelfInspectionGutter({ dimensions: COMPLETE_SHELF_BOOK_FORMAT, phase: "PAGE_DRAGGING", scale: 1.42 });
    expect(open.left).toBeGreaterThan(closed.left);
    expect(open.right).toBeGreaterThanOrEqual(closed.right);
  });

  it("projects every physical corner inside the measured free rectangle", () => {
    const sizes = [[320,568],[360,640],[360,800],[375,667],[390,844],[393,873],[412,915],[414,896],[568,320],[667,375],[844,390],[896,414],[768,1024],[820,1180],[1024,768],[1024,1366],[1440,900],[1920,1080]];
    for (const [width, height] of sizes) for (const phase of phases) {
      const insets = { top: 12, left: 8, right: width >= 1024 ? 360 : 8, bottom: width < 1024 ? Math.round(height * 0.42) : 58 };
      const position = [0, 0.55, 1.05] as const;
      const bounds = resolveBookPhysicalBounds({ dimensions: COMPLETE_SHELF_BOOK_FORMAT, phase, scale: 1.42 });
      const framing = resolveBookInspectionCameraFraming({ viewportWidth: width, viewportHeight: height, detailOpen: true, viewportInsets: insets, bounds, bookPosition: position, itemIndex: 0, itemCount: 17 });
      const free = resolveBookShelfUnobscuredViewport(width, height, insets);
      for (const orbit of [{ yaw: 0, pitch: 0, zoom: 1 }, { yaw: 0.24, pitch: 0.17, zoom: 1.24 }, { yaw: -0.24, pitch: -0.13, zoom: 1.24 }]) {
        const target = resolveBookInspectionOrbitCamera(framing, orbit);
        const camera = new PerspectiveCamera(target.fov, width / height, 0.1, 200);
        camera.position.set(...target.position); camera.lookAt(...target.lookAt); camera.updateMatrixWorld();
        for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
          const projected = new Vector3(x + position[0], y + position[1], z + position[2]).project(camera);
          const px = (projected.x + 1) * width / 2, py = (1 - projected.y) * height / 2;
          const label = `${width}x${height} ${phase} ${JSON.stringify(orbit)} corner ${x},${y},${z}`;
          expect(px, label).toBeGreaterThanOrEqual(free.x - 0.5);
          expect(px, label).toBeLessThanOrEqual(free.x + free.width + 0.5);
          expect(py, label).toBeGreaterThanOrEqual(free.y - 0.5);
          expect(py, label).toBeLessThanOrEqual(free.y + free.height + 0.5);
          expect(projected.z, label).toBeLessThan(1);
        }
      }
    }
  });
});
