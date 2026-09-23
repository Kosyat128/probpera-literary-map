import { describe, expect, it } from "vitest";
import { isBookyWalkPathClear, planBookyApproach, planBookyDockReturn, planBookyWalk, sampleBookyWalk } from "./bookyWalk";

describe("explicit companion walk", () => {
  it.each([{ left: 0, top: 0, width: 320, height: 844 }, { left: 14, top: 90, width: 1440, height: 760 }])(
    "keeps the entire companion inside the safe margin on every sample", view => {
      const size = { width: 112, height: 198 }, path = planBookyWalk({ left: 9000, top: -400 }, size, view)!;
      expect(path).not.toBeNull(); expect(path.direction).toBe(-1);
      for (let index = 0; index <= 100; index++) {
        const p = sampleBookyWalk(path, index / 100);
        expect(p.left).toBeGreaterThanOrEqual(view.left + 12);
        expect(p.left + size.width).toBeLessThanOrEqual(view.left + view.width - 12);
        expect(p.top).toBe(view.top + 12);
        expect(p.top + size.height).toBeLessThanOrEqual(view.top + view.height - 12);
      }
      expect(sampleBookyWalk(path, 0)).toEqual(path.from); expect(sampleBookyWalk(path, 1)).toEqual(path.to);
    });
  it("chooses available space, bounds distance and refuses viewports with no walking room", () => {
    const view = { left: 0, top: 70, width: 1440, height: 700 }, size = { width: 176, height: 220 };
    const path = planBookyWalk({ left: 12, top: 100 }, size, view)!;
    expect(path.direction).toBe(1); expect(path.to.left - path.from.left).toBe(220);
    expect(planBookyWalk({ left: 0, top: 0 }, size, { ...view, width: 200 })).toBeNull();
    expect(planBookyWalk({ left: 0, top: 0 }, size, { ...view, height: 230 })).toBeNull();
    expect(planBookyWalk({ left: NaN, top: 0 }, size, view)).toBeNull();
    expect(planBookyWalk({ left: 0, top: 0 }, { ...size, width: -1 }, view)).toBeNull();
  });
  it("starts at the visible resting row instead of teleporting to a lower country toolbar", () => {
    const view = { left: 0, top: 62, width: 568, height: 258 }, size = { width: 312, height: 96 };
    const current = { left: 176, top: 74 }, country = { left: 8, top: 248, width: 552, height: 64 };
    const path = planBookyWalk(current, size, view, [country])!;
    expect(path.from).toEqual(current); expect(path.to).toEqual({ left: 12, top: 74 });
    expect(isBookyWalkPathClear(path, size, view, [country])).toBe(true);
    expect(isBookyWalkPathClear({ from: { ...current, top: 212 }, to: { left: 12, top: 212 }, direction: -1 }, size, view, [country])).toBe(false);
  });
  it("uses the free horizontal corridor without crossing an intermediate control", () => {
    const view = { left: 0, top: 0, width: 900, height: 500 }, size = { width: 100, height: 80 };
    const current = { left: 300, top: 140 }, controls = [
      { left: 160, top: 140, width: 60, height: 80 }, { left: 460, top: 160, width: 40, height: 40 },
    ];
    const path = planBookyWalk(current, size, view, controls)!;
    expect(path.from).toEqual(current); expect(path.to).toEqual({ left: 220, top: 140 });
    expect(path.direction).toBe(-1); expect(isBookyWalkPathClear(path, size, view, controls)).toBe(true);
    const crossing = { from: current, to: { left: 600, top: 140 }, direction: 1 as const };
    expect(isBookyWalkPathClear(crossing, size, view)).toBe(true);
    expect(isBookyWalkPathClear(crossing, size, view, controls)).toBe(false);
  });
  it("declines an already obstructed row and any corridor with less than 32px of travel", () => {
    const view = { left: 0, top: 62, width: 640, height: 298 }, size = { width: 312, height: 96 };
    expect(planBookyWalk({ left: 172.5625, top: 146 }, size, view,
      [{ left: 289.65625, top: 227, width: 164.671875, height: 48 }])).toBeNull();
    const small = { width: 100, height: 80 }, current = { left: 200, top: 140 };
    const corridor = [{ left: 0, top: 140, width: 169, height: 80 }, { left: 331, top: 140, width: 200, height: 80 }];
    expect(planBookyWalk(current, small, view, corridor)).toBeNull();
    const exact = planBookyWalk(current, small, view, [{ ...corridor[0], width: 168 }, corridor[1]])!;
    expect(exact.to.left).toBe(168);
  });
  it("ignores invalid, empty and offscreen controls, but rejects invalid or out-of-bounds paths", () => {
    const view = { left: 10, top: 70, width: 900, height: 600 }, size = { width: 100, height: 80 };
    const current = { left: 300, top: 140 }, path = planBookyWalk(current, size, view)!;
    const ignored = [
      { left: 250, top: 140, width: NaN, height: 80 }, { left: 250, top: 140, width: 0, height: 80 },
      { left: 250, top: 140, width: 100, height: -1 }, { left: -200, top: 140, width: 100, height: 80 },
      { left: 250, top: 800, width: 100, height: 80 },
    ];
    expect(planBookyWalk(current, size, view, ignored)).toEqual(path);
    expect(isBookyWalkPathClear(path, size, view, ignored)).toBe(true);
    expect(isBookyWalkPathClear({ ...path, to: { left: 950, top: 140 } }, size, view)).toBe(false);
    expect(isBookyWalkPathClear({ ...path, to: { left: 400, top: 141 } }, size, view)).toBe(false);
    expect(isBookyWalkPathClear({ ...path, from: { left: NaN, top: 140 } }, size, view)).toBe(false);
    expect(isBookyWalkPathClear(path, { ...size, height: 0 }, view)).toBe(false);
    expect(isBookyWalkPathClear(path, size, { ...view, width: NaN })).toBe(false);
    expect(planBookyWalk(current, size, { ...view, height: -1 })).toBeNull();
  });
  it("approaches a reachable section from the current position with a hand contact inside the target", () => {
    const view = { left: 0, top: 75, width: 1440, height: 825 }, size = { width: 176, height: 272 };
    const target = { left: 28, top: 205, width: 1384, height: 400 };
    const current = { left: 1252, top: 610 }, path = planBookyApproach(current, size, view, target)!;
    expect(path.from).toEqual(current); expect(path.to).not.toEqual(current);
    expect(path.touch.left).toBeGreaterThan(target.left); expect(path.touch.left).toBeLessThan(target.left + target.width);
    expect(path.touch.top).toBeGreaterThan(target.top); expect(path.touch.top).toBeLessThan(target.top + target.height);
    expect(path.to.left + size.width * .18).toBeCloseTo(path.touch.left);
    expect(path.to.top + size.width * .48).toBeCloseTo(path.touch.top);
    for (let i = 0; i <= 40; i++) {
      const p = sampleBookyWalk(path, i / 40);
      expect(p.left).toBeGreaterThanOrEqual(12); expect(p.left + size.width).toBeLessThanOrEqual(1428);
      expect(p.top).toBeGreaterThanOrEqual(87); expect(p.top + size.height).toBeLessThanOrEqual(888);
    }
  });
  it("declines clipped, unreachable and invalid targets instead of covering protected controls", () => {
    const view = { left: 0, top: 75, width: 1440, height: 825 }, size = { width: 176, height: 272 };
    const current = { left: 1200, top: 600 };
    for (const target of [{ left: 10, top: 92, width: 1400, height: 47 },
      { left: -100, top: 300, width: 20, height: 40 }, { left: 100, top: 300, width: NaN, height: 40 }]) {
      expect(planBookyApproach(current, size, view, target)).toBeNull();
    }
  });
  it("keeps the canvas hand aligned when a persistence notice widens the controls", () => {
    const view = { left: 0, top: 75, width: 1440, height: 825 }, size = { width: 280, height: 330 };
    const target = { left: 670, top: 205, width: 700, height: 350 }, hand = { left: 85, top: 87 };
    const path = planBookyApproach({ left: 1000, top: 400 }, size, view, target, hand)!;
    expect(path.to.left + hand.left).toBeCloseTo(path.touch.left);
    expect(path.to.top + hand.top).toBeCloseTo(path.touch.top);
    expect(planBookyApproach(path.from, size, view, target, { left: NaN, top: 87 })).toBeNull();
  });
  it.each([320, 390])("returns continuously to a reserved phone dock without changing the starting point (%s)", width => {
    const view = { left: 0, top: 74, width, height: 770 }, size = { width: 240, height: 96 };
    const dock = { left: 0, top: 724, width, height: 120 }, current = { left: 40, top: 360 };
    const path = planBookyDockReturn(current, size, view, dock)!;
    expect(path.from).toEqual(current); expect(path.to).toEqual({ left: 40, top: 736 });
    expect(sampleBookyWalk(path, 0)).toEqual(current);
    for (let frame = 0; frame <= 100; frame++) {
      const point = sampleBookyWalk(path, frame / 100);
      expect(point.left).toBeGreaterThanOrEqual(view.left + 12);
      expect(point.top).toBeGreaterThanOrEqual(view.top + 12);
      expect(point.left + size.width).toBeLessThanOrEqual(view.width - 12);
      expect(point.top + size.height).toBeLessThanOrEqual(view.top + view.height - 12);
    }
  });
  it("refuses missing dock space or an invalid starting point instead of teleporting", () => {
    const view = { left: 10, top: 74, width: 390, height: 770 }, size = { width: 240, height: 96 };
    const dock = { left: 10, top: 724, width: 390, height: 120 }, current = { left: 40, top: 360 };
    expect(planBookyDockReturn({ left: 0, top: 360 }, size, view, dock)).toBeNull();
    expect(planBookyDockReturn({ left: 40, top: NaN }, size, view, dock)).toBeNull();
    expect(planBookyDockReturn(current, size, view, { ...dock, top: 740 })).toBeNull();
    expect(planBookyDockReturn(current, size, view, { ...dock, width: 250 })).toBeNull();
    expect(planBookyDockReturn(current, size, view, { ...dock, height: Infinity })).toBeNull();
    expect(planBookyDockReturn(current, { ...size, height: 160 }, view, dock)).toBeNull();
  });
});
