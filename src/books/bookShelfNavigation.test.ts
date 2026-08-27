import { describe, expect, it } from "vitest";

import {
  accumulateBookShelfWheelIntent,
  bookShelfProgressValueToFocusIndex,
  clampBookShelfFocusIndex,
  getBookShelfNavigationState,
  getBookShelfProgressState,
  normalizeBookShelfWheelDelta,
  resolveBookShelfKeyboardNavigation,
  resolveBookShelfSwipeIntent,
  resolveBookShelfWheelIntent,
} from "./bookShelfNavigation";

describe("finite Book Shelf navigation", () => {
  it("makes edge states explicit and never modulo-wraps", () => {
    expect(getBookShelfNavigationState(0, 26)).toMatchObject({
      focusIndex: 0,
      canMovePrevious: false,
      canMoveNext: true,
      previousIndex: 0,
      nextIndex: 1,
      pagePreviousIndex: 0,
      pageNextIndex: 13,
    });
    expect(getBookShelfNavigationState(25, 26)).toMatchObject({
      focusIndex: 25,
      canMovePrevious: true,
      canMoveNext: false,
      previousIndex: 24,
      nextIndex: 25,
      pagePreviousIndex: 12,
      pageNextIndex: 25,
    });
    expect(getBookShelfNavigationState(3, 0)).toMatchObject({
      focusIndex: -1,
      canMovePrevious: false,
      canMoveNext: false,
      previousIndex: -1,
      nextIndex: -1,
    });
  });

  it("supports arrows, Home/End and 13-item PageUp/PageDown", () => {
    const target = (key: string, focusIndex: number, total = 40) =>
      resolveBookShelfKeyboardNavigation({ key, focusIndex, total });

    expect(target("ArrowLeft", 0)).toBe(0);
    expect(target("ArrowRight", 39)).toBe(39);
    expect(target("ArrowRight", 12)).toBe(13);
    expect(target("Home", 24)).toBe(0);
    expect(target("End", 2)).toBe(39);
    expect(target("PageUp", 25)).toBe(12);
    expect(target("PageDown", 25)).toBe(38);
    expect(target("PageDown", 38)).toBe(39);
    expect(target("Enter", 4)).toBeNull();
    expect(target("ArrowRight", 0, 0)).toBeNull();
  });

  it("clamps non-finite and out-of-range focus safely", () => {
    expect(clampBookShelfFocusIndex(-5, 8)).toBe(0);
    expect(clampBookShelfFocusIndex(99, 8)).toBe(7);
    expect(clampBookShelfFocusIndex(Number.NaN, 8)).toBe(0);
    expect(clampBookShelfFocusIndex(0, Number.NaN)).toBe(-1);
  });
});

describe("wheel, trackpad and swipe intent", () => {
  it("normalizes horizontal trackpads and conventional vertical wheels", () => {
    expect(normalizeBookShelfWheelDelta({ deltaX: 7, deltaY: 90 })).toBe(7);
    expect(normalizeBookShelfWheelDelta({ deltaX: 0, deltaY: 7 })).toBe(7);
    expect(
      normalizeBookShelfWheelDelta({ deltaX: 0, deltaY: 3, shiftKey: true })
    ).toBe(3);
    expect(normalizeBookShelfWheelDelta({ deltaX: 2, deltaMode: 1 })).toBe(32);
    expect(normalizeBookShelfWheelDelta({ deltaX: 3, deltaMode: 2 })).toBe(160);
    expect(resolveBookShelfWheelIntent({ deltaX: -8 })).toBe(-1);
    expect(resolveBookShelfWheelIntent({ deltaX: 8 })).toBe(1);
    expect(resolveBookShelfWheelIntent({ deltaX: 2 })).toBe(0);
  });

  it("accumulates small trackpad motion once and clears on direction changes", () => {
    const first = accumulateBookShelfWheelIntent(0, { deltaX: 12 });
    expect(first).toEqual({ remainder: 12, direction: 0 });
    const second = accumulateBookShelfWheelIntent(first.remainder, {
      deltaX: 12,
    });
    expect(second).toEqual({ remainder: 24, direction: 0 });
    expect(
      accumulateBookShelfWheelIntent(second.remainder, { deltaX: 12 })
    ).toEqual({ remainder: 0, direction: 1 });
    expect(
      accumulateBookShelfWheelIntent(20, { deltaX: -12 })
    ).toEqual({ remainder: -12, direction: 0 });
  });

  it("requires a horizontal threshold and axis lock for pointer swipes", () => {
    expect(
      resolveBookShelfSwipeIntent({
        startX: 100,
        startY: 10,
        endX: 45,
        endY: 14,
      })
    ).toBe(1);
    expect(
      resolveBookShelfSwipeIntent({
        startX: 20,
        startY: 10,
        endX: 80,
        endY: 18,
      })
    ).toBe(-1);
    expect(
      resolveBookShelfSwipeIntent({
        startX: 20,
        startY: 10,
        endX: 50,
        endY: 12,
      })
    ).toBe(0);
    expect(
      resolveBookShelfSwipeIntent({
        startX: 20,
        startY: 10,
        endX: 70,
        endY: 80,
      })
    ).toBe(0);
  });
});

describe("Book Shelf progress range", () => {
  it("maps zero-based focus to one-based N-of-M range semantics", () => {
    expect(getBookShelfProgressState(12, 40)).toEqual({
      focusIndex: 12,
      current: 13,
      total: 40,
      minimum: 1,
      maximum: 40,
      value: 13,
      disabled: false,
    });
    expect(bookShelfProgressValueToFocusIndex(26, 40)).toBe(25);
    expect(bookShelfProgressValueToFocusIndex(99, 40)).toBe(39);
    expect(bookShelfProgressValueToFocusIndex(1, 0)).toBe(-1);
    expect(getBookShelfProgressState(0, 0)).toMatchObject({
      current: 0,
      total: 0,
      disabled: true,
    });
  });
});
