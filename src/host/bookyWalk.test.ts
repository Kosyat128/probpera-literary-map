import { describe, expect, it } from "vitest";
import { planBookyApproach, planBookyWalk, sampleBookyWalk } from "./bookyWalk";

describe("explicit companion margin walk", () => {
  it.each([{ left: 0, top: 0, width: 320, height: 844 }, { left: 14, top: 90, width: 1440, height: 760 }])(
    "keeps the entire companion inside the safe margin on every sample", view => {
      const size = { width: 112, height: 198 }, path = planBookyWalk({ left: 9000, top: -400 }, size, view)!;
      expect(path).not.toBeNull(); expect(path.direction).toBe(-1);
      for (let index = 0; index <= 100; index++) {
        const p = sampleBookyWalk(path, index / 100);
        expect(p.left).toBeGreaterThanOrEqual(view.left + 12);
        expect(p.left + size.width).toBeLessThanOrEqual(view.left + view.width - 12);
        expect(p.top + size.height).toBe(view.top + view.height - 12);
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
});
