import { describe, expect, it } from "vitest";
import { bookyCardHeightLimit, bookyCardViewport, bookyCardWidth, placeBooky, placeBookyCard, type BookyPlacementRect } from "./bookyPlacement";

const size = { width: 112, height: 200 };
const portrait = { left: 0, top: 70, width: 320, height: 774 };
const overlaps = (a: BookyPlacementRect, b: BookyPlacementRect) =>
  Math.min(a.left + a.width, b.left + b.width) > Math.max(a.left, b.left)
  && Math.min(a.top + a.height, b.top + b.height) > Math.max(a.top, b.top);

describe("companion resting placement", () => {
  it("limits a portrait help sheet to actual free space around a relocated companion", () => {
    expect(bookyCardHeightLimit(portrait, { left: 196, top: 250, ...size }, 296)).toBe(370);
    expect(bookyCardHeightLimit({ ...portrait, height: 400 }, { left: 196, top: 624, ...size }, 296)).toBe(376);
  });
  it("uses a side column only when it fits beside the actual resting position", () => {
    const view = { left: 0, top: 70, width: 800, height: 330 };
    const pet = { left: 250, top: 140, width: 312, height: 96 };
    expect(bookyCardHeightLimit(view, pet, 340)).toBe(140);
    expect(bookyCardHeightLimit(view, { ...pet, left: 468 }, 340)).toBe(306);
  });
  it("leaves an already clear manual position untouched", () => {
    const point = { left: 24, top: 180 };
    expect(placeBooky(point, size, portrait, [{ left: 0, top: 780, width: 320, height: 64 }])).toEqual(point);
  });
  it("moves above the country bar, keeping the full body and toolbar inside a 320px viewport", () => {
    const footer = { left: 0, top: 780, width: 320, height: 64 };
    const point = placeBooky({ left: 188, top: 624 }, size, portrait, [footer]);
    expect(point).toEqual({ left: 188, top: 568 });
    expect(overlaps({ ...point, ...size }, footer)).toBe(false);
    expect(point.left + size.width).toBeLessThanOrEqual(308);
    expect(bookyCardViewport(portrait, size, [footer])).toEqual({ ...portrait, height: 710 });
  });
  it("uses a free landscape column instead of moving above a low viewport", () => {
    const view = { left: 0, top: 70, width: 800, height: 330 };
    const controls = [{ left: 600, top: 80, width: 180, height: 320 }];
    const point = placeBooky({ left: 668, top: 188 }, size, view, controls);
    expect(point).toEqual({ left: 476, top: 188 });
    expect(bookyCardViewport(view, size, controls)).toEqual(view);
  });
  it("finds the hole between several controls with viewport offsets and stable results", () => {
    const view = { left: 15, top: 85, width: 500, height: 500 };
    const controls = [{ left: 15, top: 85, width: 120, height: 500 },
      { left: 370, top: 85, width: 145, height: 500 }, { left: 15, top: 510, width: 500, height: 75 }];
    const point = placeBooky({ left: 390, top: 373 }, size, view, controls);
    expect(controls.every(rect => !overlaps({ ...point, ...size }, rect))).toBe(true);
    expect(point.left).toBeGreaterThanOrEqual(view.left + 12); expect(point.top).toBeGreaterThanOrEqual(view.top + 12);
    expect(placeBooky(point, size, view, controls)).toEqual(point);
  });
  it("fits the horizontal landscape companion between the edition rail and country controls", () => {
    const view = { left: 0, top: 64, width: 800, height: 336 }, row = { width: 312, height: 96 };
    const controls = [{ left: 20, top: 86, width: 760, height: 48 },
      { left: 210, top: 248, width: 380, height: 52 }, { left: 8, top: 258, width: 784, height: 134 },
      { left: 14, top: 144, width: 106, height: 44 }];
    const point = placeBooky({ left: 468, top: 284 }, row, view, controls);
    expect(controls.every(rect => !overlaps({ ...point, ...row }, rect))).toBe(true);
    expect(point.top).toBeGreaterThanOrEqual(76); expect(point.top + row.height).toBeLessThan(248);
  });
  it("stays bounded and minimizes overlap when a control fills the available space", () => {
    const view = { left: 0, top: 0, width: 160, height: 240 };
    const point = placeBooky({ left: 500, top: -20 }, size, view, [view]);
    expect(point).toEqual({ left: 36, top: 12 });
    expect(placeBooky(point, size, view, [view])).toEqual(point);
  });
  it("ignores stale offscreen or invalid obstacles and clamps invalid preferred coordinates", () => {
    const controls = [{ left: NaN, top: 300, width: 40, height: 40 },
      { left: 0, top: 300, width: -20, height: 40 }, { left: -300, top: 300, width: 100, height: 100 }];
    expect(placeBooky({ left: Infinity, top: NaN }, size, portrait, controls)).toEqual({ left: 196, top: 632 });
  });
});

describe("open companion help placement", () => {
  it("keeps body text readable beside the pet on a crowded 568px landscape screen", () => {
    const view = { left: 0, top: 58, width: 568, height: 262 };
    const pet = { left: 294, top: 74, width: 194, height: 96 };
    const controls = [{ left: 0, top: 240, width: 568, height: 80 }];
    const width = bookyCardWidth(view, pet), height = bookyCardHeightLimit(view, pet, width);
    const card = placeBookyCard({ left: 12, top: 70 }, { width, height }, view, pet, controls);
    expect(overlaps(card, pet)).toBe(false);
    expect(card.height).toBeGreaterThanOrEqual(200);
    expect(card.top).toBeGreaterThanOrEqual(70);
    expect(card.top + card.height).toBeLessThanOrEqual(308);
    const tightView = { ...view, height: 160 };
    const tight = placeBookyCard({ left: 12, top: 70 }, { width, height }, tightView, pet, controls);
    expect(tight.top + tight.height).toBeLessThanOrEqual(tightView.top + tightView.height - 12);
    expect(overlaps(tight, pet)).toBe(false);
  });
  it("uses the readable narrow landscape column without squeezing portrait text", () => {
    const view = { left: 0, top: 65, width: 667, height: 310 };
    const pet = { left: 335, top: 146, width: 312, height: 96 };
    const width = bookyCardWidth(view, pet);
    expect(width).toBe(311);
    const height = bookyCardHeightLimit(view, pet, width);
    const card = placeBookyCard({ left: 12, top: 77 }, { width, height }, view, pet, []);
    expect(overlaps(card, pet)).toBe(false);
    expect(card.height).toBeGreaterThanOrEqual(160);
    expect(bookyCardWidth(portrait, { left: 196, top: 250, ...size })).toBe(296);
  });
  it("finds a free column between controls away from the four immediate pet positions", () => {
    const view = { left: 0, top: 70, width: 1000, height: 630 };
    const pet = { left: 820, top: 490, width: 112, height: 190 };
    const controls = [{ left: 0, top: 70, width: 300, height: 630 },
      { left: 680, top: 70, width: 320, height: 630 }];
    const card = placeBookyCard({ left: 468, top: 380 }, { width: 340, height: 300 }, view, pet, controls);
    expect(controls.every(rect => !overlaps(card, rect))).toBe(true);
    expect(overlaps(card, pet)).toBe(false);
    expect(card.height).toBe(300);
  });
  it("uses a readable shorter gap and restores height when the blocking controls leave", () => {
    const view = { left: 0, top: 70, width: 800, height: 630 };
    const pet = { left: 640, top: 500, width: 112, height: 180 };
    const controls = [{ left: 0, top: 100, width: 800, height: 80 },
      { left: 0, top: 420, width: 800, height: 280 }];
    const preferred = { left: 120, top: 100 }, size = { width: 340, height: 400 };
    const compact = placeBookyCard(preferred, size, view, pet, controls);
    expect(controls.every(rect => !overlaps(compact, rect))).toBe(true);
    expect(compact.height).toBeGreaterThanOrEqual(160);
    expect(compact.height).toBeLessThan(400);
    expect(placeBookyCard(preferred, size, view, pet, []).height).toBe(400);
  });
  it("keeps the pet clear and the card readable when every point overlays navigation", () => {
    const view = { left: 20, top: 70, width: 700, height: 430 };
    const pet = { left: 580, top: 280, width: 112, height: 200 };
    const card = placeBookyCard({ left: 570, top: 300 }, { width: 340, height: 300 }, view, pet, [view]);
    expect(overlaps(card, pet)).toBe(false);
    expect(card.height).toBeGreaterThanOrEqual(160);
    expect(card.left).toBeGreaterThanOrEqual(32);
    expect(card.top + card.height).toBeLessThanOrEqual(488);
  });
  it("retains an unobstructed position and ignores invalid or offscreen controls", () => {
    const view = { left: 0, top: 70, width: 1000, height: 630 };
    const pet = { left: 820, top: 490, width: 112, height: 190 };
    const preferred = { left: 350, top: 180 }, size = { width: 340, height: 300 };
    const controls = [{ left: NaN, top: 70, width: 1000, height: 630 },
      { left: -400, top: 180, width: 100, height: 300 }];
    expect(placeBookyCard(preferred, size, view, pet, controls)).toEqual({ ...preferred, ...size });
  });
});
