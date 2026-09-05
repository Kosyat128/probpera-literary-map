import { describe, expect, it } from "vitest";
import { bookShelfExtractionClearance, bookShelfExtractionStages, canRetainBookShelfRow, sampleBookShelfExtractionPose } from "./bookShelfExtractionMotion";
import { COMPLETE_SHELF_BOOK_FORMAT, type CompleteShelfBookPose } from "./completeShelfModel";

const coverWidth = COMPLETE_SHELF_BOOK_FORMAT.coverWidth;
const row: CompleteShelfBookPose = {
  position: [-2.5, -.24, .035], rotation: [0, Math.PI / 2, 0], scale: 1,
  coverAngle: 0, firstLeafAngle: 0, secondLeafAngle: 0,
};
const inspection: CompleteShelfBookPose = {
  ...row, position: [0, .21, 1.05], rotation: [0, .08, 0], scale: 1.42,
};

describe("visible bookshelf extraction", () => {
  it("retains a returned row across focus changes but respects sorting, filtering and LOD", () => {
    const common = { anchorKey: "b", phase: "SHELF_IDLE" as const, rowKeys: ["a", "b", "c"], sourceKeys: ["a", "b", "c", "d"], previousSourceKeys: ["a", "b", "c", "d"], requestedCount: 3 };
    expect(canRetainBookShelfRow(common)).toBe(true);
    expect(canRetainBookShelfRow({ ...common, anchorKey: "c" })).toBe(true);
    expect(canRetainBookShelfRow({ ...common, sourceKeys: ["d", "c", "b", "a"] })).toBe(false);
    expect(canRetainBookShelfRow({ ...common, sourceKeys: ["a", "b", "c"] })).toBe(false);
    expect(canRetainBookShelfRow({ ...common, requestedCount: 2 })).toBe(false);
    expect(canRetainBookShelfRow({ ...common, phase: "SHELF_MOVING" })).toBe(false);
  });

  it("reverses an early cancellation without pulling the book further out", () => {
    const partial = sampleBookShelfExtractionPose({ from: row, to: inspection, coverWidth, progress: .2 });
    const returning = sampleBookShelfExtractionPose({ from: partial, to: row, coverWidth, progress: .2, returning: true });
    expect(returning.position[2]).toBeLessThan(partial.position[2]);
    expect(returning.position[2]).toBeGreaterThan(row.position[2]);
    expect(returning.rotation).toEqual(row.rotation);
  });

  it("keeps the source slot, orientation and size until the whole binding clears the row", () => {
    const samples = [0, .1, .25, .45].map(progress => sampleBookShelfExtractionPose({ from: row, to: inspection, coverWidth, progress }));
    for (const pose of samples) {
      expect(pose.position.slice(0, 2)).toEqual(row.position.slice(0, 2));
      expect(pose.rotation).toEqual(row.rotation);
      expect(pose.scale).toBe(1);
      expect(pose.coverAngle).toBe(0);
    }
    expect(samples[0]).toEqual(row);
    for (let index = 1; index < samples.length; index++) expect(samples[index].position[2]).toBeGreaterThan(samples[index - 1].position[2]);
    const backOfExtractedBook = samples[3].position[2] - coverWidth / 2;
    expect(backOfExtractedBook).toBeGreaterThan(coverWidth / 2 + .1);
  });

  it("turns only after clearance and arrives at the exact existing inspection pose", () => {
    const mid = sampleBookShelfExtractionPose({ from: row, to: inspection, coverWidth, progress: .7 });
    expect(mid.rotation[1]).toBeLessThan(row.rotation[1]);
    expect(mid.rotation[1]).toBeGreaterThan(inspection.rotation[1]);
    expect(mid.position[0]).toBeGreaterThan(row.position[0]);
    expect(mid.scale).toBeGreaterThan(1);
    expect(sampleBookShelfExtractionPose({ from: row, to: inspection, coverWidth, progress: 1 })).toEqual(inspection);
  });

  it("aligns with the original slot before inserting on return", () => {
    const outside = sampleBookShelfExtractionPose({ from: inspection, to: row, coverWidth, progress: .55, returning: true });
    const inserting = sampleBookShelfExtractionPose({ from: inspection, to: row, coverWidth, progress: .8, returning: true });
    for (const pose of [outside, inserting]) {
      expect(pose.position.slice(0, 2)).toEqual(row.position.slice(0, 2));
      expect(pose.rotation).toEqual(row.rotation);
      expect(pose.scale).toBe(1);
    }
    expect(outside.position[2]).toBeGreaterThan(inserting.position[2]);
    expect(sampleBookShelfExtractionPose({ from: inspection, to: row, coverWidth, progress: 1, returning: true })).toEqual(row);
  });

  it("holds camera presentation until extraction and restores it before insertion", () => {
    expect(bookShelfExtractionStages(0).presentation).toBe(0);
    expect(bookShelfExtractionStages(.45)).toEqual({ pull: 1, presentation: 0 });
    expect(bookShelfExtractionStages(.55, true)).toEqual({ pull: 0, presentation: 1 });
    expect(bookShelfExtractionStages(1)).toEqual({ pull: 1, presentation: 1 });
    expect(bookShelfExtractionClearance(coverWidth, 1.42)).toBeGreaterThan(coverWidth * 1.42);
  });
});
