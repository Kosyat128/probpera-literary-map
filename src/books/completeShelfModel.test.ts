import { describe, expect, it } from "vitest";

import {
  COMPLETE_SHELF_GAP,
  COMPLETE_SHELF_ECONOMICAL_WORKING_SET,
  COMPLETE_SHELF_INSPECTION_GUTTER,
  COMPLETE_SHELF_MAX_WORKING_SET,
  buildCompleteShelfBookPose,
  buildCompleteShelfBookSpec,
  completeShelfSettlementForPhase,
  completeShelfWorkingSetLimit,
  layoutCompleteShelfBooks,
  normalizeCompleteShelfCoverUrl,
  selectCompleteShelfWorkingSet,
  type CompleteShelfItemInput,
} from "./completeShelfModel";

const input = (key: string, offset = 0): CompleteShelfItemInput => ({
  key,
  title: `Книга ${offset}`,
  writer: `Автор ${offset}`,
  year: 1850 + (offset % 170),
  baseColor: "#3f244d",
  accentColor: "#d8b568",
  paperColor: "#e8dcc4",
});

describe("Complete Shelf procedural model", () => {
  it("keeps physical identity stable when the same book moves in the source", () => {
    const first = buildCompleteShelfBookSpec(input("stable-book", 1), 2);
    const moved = buildCompleteShelfBookSpec(input("stable-book", 1), 47);

    expect(moved.seed).toBe(first.seed);
    expect(moved.dimensions).toEqual(first.dimensions);
    expect(moved.motif).toBe(first.motif);
    expect(moved.lean).toBe(first.lean);
    expect(moved.sourceIndex).not.toBe(first.sourceIndex);

    const emptyAtStart = buildCompleteShelfBookSpec(input("", 1), 0);
    const emptyAfterSort = buildCompleteShelfBookSpec(input("", 1), 12);
    expect(emptyAfterSort.seed).toBe(emptyAtStart.seed);
  });

  it("creates bounded, varied hardcover dimensions", () => {
    const specs = Array.from({ length: 32 }, (_, index) =>
      buildCompleteShelfBookSpec(input(`book-${index}`, index), index)
    );
    const dimensionSignatures = new Set(
      specs.map((spec) => JSON.stringify(spec.dimensions))
    );

    expect(dimensionSignatures.size).toBeGreaterThan(8);
    for (const spec of specs) {
      expect(spec.dimensions.height).toBeGreaterThanOrEqual(1.36);
      expect(spec.dimensions.height).toBeLessThanOrEqual(1.675);
      expect(spec.dimensions.coverWidth).toBeGreaterThanOrEqual(0.7);
      expect(spec.dimensions.pageDepth).toBeGreaterThanOrEqual(0.215);
      expect(spec.dimensions.boardThickness).toBeGreaterThan(0);
      expect(spec.dimensions.pageInset).toBeGreaterThan(0);
    }
  });

  it("bounds the working set and retains the requested anchor", () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      key: `book-${index}`,
    }));
    const quality = selectCompleteShelfWorkingSet(
      items,
      "book-27",
      completeShelfWorkingSetLimit(false)
    );
    const economical = selectCompleteShelfWorkingSet(
      items,
      "book-27",
      completeShelfWorkingSetLimit(true)
    );

    expect(COMPLETE_SHELF_MAX_WORKING_SET).toBe(13);
    expect(COMPLETE_SHELF_ECONOMICAL_WORKING_SET).toBe(11);
    expect(quality.entries).toHaveLength(13);
    expect(economical.entries).toHaveLength(11);
    expect(quality.entries[quality.anchorSlot].item.key).toBe("book-27");
    expect(economical.entries[economical.anchorSlot].item.key).toBe(
      "book-27"
    );
  });

  it("uses authorized cover truth and a varied premium fallback palette", () => {
    const coverUrl = "/probpera-literary-map/brand/book-covers/1984.webp";
    const covered = buildCompleteShelfBookSpec(
      { ...input("covered", 1), coverUrl },
      0
    );
    const fallbacks = Array.from({ length: 48 }, (_, index) =>
      buildCompleteShelfBookSpec(input(`fallback-${index}`, index), index)
    );
    const repeatedFallbacks = Array.from({ length: 48 }, (_, index) =>
      buildCompleteShelfBookSpec(input(`fallback-${index}`, index), index + 70)
    );

    expect(covered.coverUrl).toBe(coverUrl);
    expect(covered.baseColor).toBe(input("covered", 1).baseColor);
    expect(
      new Set(fallbacks.map((spec) => spec.baseColor)).size
    ).toBeGreaterThanOrEqual(5);
    expect(fallbacks.map((spec) => spec.baseColor)).toEqual(
      repeatedFallbacks.map((spec) => spec.baseColor)
    );
    expect(fallbacks.every((spec) => spec.foilColor !== "#f67518")).toBe(true);
    expect(normalizeCompleteShelfCoverUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeCompleteShelfCoverUrl("brand/../secret.webp")).toBeNull();
  });

  it("wraps source boundaries so the first and last books keep two flanks", () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      key: `book-${index}`,
    }));
    const first = selectCompleteShelfWorkingSet(items, "book-0", 13);
    const last = selectCompleteShelfWorkingSet(items, "book-39", 13);

    expect(first.anchorSlot).toBe(6);
    expect(first.entries.map((entry) => entry.sourceIndex)).toEqual([
      34, 35, 36, 37, 38, 39, 0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(last.entries.map((entry) => entry.sourceIndex)).toEqual([
      33, 34, 35, 36, 37, 38, 39, 0, 1, 2, 3, 4, 5,
    ]);
    expect(new Set(first.entries.map((entry) => entry.item.key)).size).toBe(
      13
    );
  });

  it("lays books out without overlap and centers the active spine", () => {
    const specs = Array.from({ length: 9 }, (_, index) =>
      buildCompleteShelfBookSpec(input(`book-${index}`, index), index)
    );
    const anchorSlot = 4;
    const layout = layoutCompleteShelfBooks(specs, anchorSlot);

    expect(layout[anchorSlot].x).toBe(0);
    for (let index = 1; index < layout.length; index += 1) {
      const previous = layout[index - 1];
      const current = layout[index];
      const clearance =
        current.x -
        previous.x -
        (previous.spec.dimensions.pageDepth +
          previous.spec.dimensions.boardThickness * 2) /
          2 -
        (current.spec.dimensions.pageDepth +
          current.spec.dimensions.boardThickness * 2) /
          2;
      expect(clearance).toBeGreaterThanOrEqual(COMPLETE_SHELF_GAP - 0.0001);
    }
  });

  it("maps shelf, inspection, cover and page phases to exact poses", () => {
    const spec = buildCompleteShelfBookSpec(input("selected", 3), 3);
    const [layout] = layoutCompleteShelfBooks([spec], 0);
    const base = {
      layout,
      anchorSlot: 0,
      selectedBookKey: "selected",
      focusedBookKey: "selected",
    };

    const shelf = buildCompleteShelfBookPose({
      ...base,
      phase: "SHELF_IDLE",
    });
    const inspection = buildCompleteShelfBookPose({
      ...base,
      phase: "INSPECTION_CLOSED",
    });
    const opening = buildCompleteShelfBookPose({
      ...base,
      phase: "COVER_OPENING",
    });
    const open = buildCompleteShelfBookPose({
      ...base,
      phase: "BOOK_OPEN",
    });
    const page = buildCompleteShelfBookPose({
      ...base,
      phase: "PAGE_DRAGGING",
    });

    const settling = buildCompleteShelfBookPose({
      ...base,
      phase: "PAGE_SETTLING",
    });
    expect(shelf.rotation[1]).toBeCloseTo(Math.PI / 2);
    expect(shelf.rotation[2]).toBe(0);
    expect(shelf.position[2]).toBe(0);
    expect(shelf.scale).toBe(1);
    expect(inspection.position[0]).toBe(0);
    expect(inspection.position[2]).toBeGreaterThan(1);
    expect(inspection.scale).toBeGreaterThan(1.4);
    expect(open.coverAngle).toBeLessThan(-2);
    expect(open.scale).toBe(1.5);
    expect(page.firstLeafAngle).toBeLessThan(-0.6);
    expect(page.secondLeafAngle).toBeLessThan(-0.3);
    expect(settling.firstLeafAngle).toBe(open.firstLeafAngle);
    expect(settling.secondLeafAngle).toBe(open.secondLeafAngle);
    expect(settling.firstLeafAngle).not.toBe(page.firstLeafAngle);
    expect(settling.scale).toBe(open.scale);
    expect(opening.scale).toBe(open.scale);
    expect(completeShelfSettlementForPhase("INSPECTION_ENTERING")).toBe(
      "inspection-entered"
    );
    expect(completeShelfSettlementForPhase("COVER_OPENING")).toBe(
      "cover-opened"
    );
    expect(completeShelfSettlementForPhase("PAGE_SETTLING")).toBe(
      "page-settled"
    );
    expect(completeShelfSettlementForPhase("SHELF_IDLE")).toBeNull();
  });

  it("keeps inspection neighbors clear on both sides of a raised cover", () => {
    const specs = Array.from({ length: 5 }, (_, index) =>
      buildCompleteShelfBookSpec(input(`book-${index}`, index), index)
    );
    const anchorSlot = 2;
    const layout = layoutCompleteShelfBooks(specs, anchorSlot);
    const common = {
      anchorSlot,
      phase: "INSPECTION_CLOSED" as const,
      selectedBookKey: "book-2",
      focusedBookKey: "book-2",
    };
    const left = buildCompleteShelfBookPose({
      ...common,
      layout: layout[anchorSlot - 1],
    });
    const center = buildCompleteShelfBookPose({
      ...common,
      layout: layout[anchorSlot],
    });
    const right = buildCompleteShelfBookPose({
      ...common,
      layout: layout[anchorSlot + 1],
    });

    expect(COMPLETE_SHELF_INSPECTION_GUTTER).toBeGreaterThanOrEqual(0.5);
    expect(left.position[0]).toBeLessThan(-0.7);
    expect(center.position[0]).toBe(0);
    expect(right.position[0]).toBeGreaterThan(0.7);
    expect(center.position[1]).toBeGreaterThan(left.position[1]);
  });
});
