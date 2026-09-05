import { describe, expect, it } from 'vitest';
import { measureBookShelfViewportInsets, shouldRestoreBookShelfAfterOrientation } from './bookShelfViewportInsets';

describe('measured bookshelf free viewport', () => {
  const scene = { left: 40, top: 100, right: 1040, bottom: 700 };
  it('reserves the actual desktop overlay, including after panel resize', () => {
    expect(measureBookShelfViewportInsets({ scene, overlays: [{ edge: 'right', rect: { left: 690, top: 100, right: 1040, bottom: 700 } }] })).toEqual({ top: 0, right: 350, bottom: 0, left: 0 });
    expect(measureBookShelfViewportInsets({ scene, overlays: [{ edge: 'right', rect: { left: 610, top: 100, right: 1040, bottom: 700 } }] }).right).toBe(430);
  });
  it('combines viewport clipping with the visible mobile sheet without double counting', () => {
    expect(measureBookShelfViewportInsets({ scene, viewport: { left: 0, top: 120, right: 1100, bottom: 650 }, overlays: [{ edge: 'bottom', rect: { left: 40, top: 480, right: 1040, bottom: 740 } }] })).toEqual({ top: 20, right: 0, bottom: 220, left: 0 });
  });
  it('ignores navigation outside the canvas and hidden/offscreen panels', () => {
    expect(measureBookShelfViewportInsets({ scene, overlays: [{ edge: 'bottom', rect: { left: 40, top: 720, right: 1040, bottom: 780 } }] })).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
  it('keeps full occlusion and malformed resize samples finite', () => {
    expect(measureBookShelfViewportInsets({ scene, overlays: [{ edge: 'bottom', rect: { left: 0, top: 0, right: 1100, bottom: 900 } }] }).bottom).toBe(600);
    expect(measureBookShelfViewportInsets({ scene: { ...scene, right: Number.NaN } })).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('reserves the real stacked sticky bars above a landscape book', () => {
    const result = measureBookShelfViewportInsets({
      scene: { left: 35, top: -85, right: 810, bottom: 475 },
      viewport: { left: 0, top: 0, right: 844, bottom: 390 },
      overlays: [
        { edge: 'top', rect: { left: 0, top: 0, right: 844, bottom: 80 } },
        { edge: 'top', rect: { left: 0, top: 80, right: 844, bottom: 138 } },
        { edge: 'right', rect: { left: 490, top: -85, right: 810, bottom: 475 } },
      ],
    });
    expect(result).toEqual({ left: 0, top: 223, right: 320, bottom: 85 });
    expect(560 - result.top - result.bottom).toBe(252);
  });

  it('reserves wrapped actions independently of the right panel', () => {
    expect(measureBookShelfViewportInsets({ scene, overlays: [
      { edge: 'right', rect: { left: 690, top: 100, right: 1040, bottom: 700 } },
      { edge: 'bottom', rect: { left: 60, top: 580, right: 670, bottom: 680 } },
    ] })).toEqual({ left: 0, top: 0, right: 350, bottom: 120 });
  });
});

describe('orientation keeps a visible inspection in view', () => {
  const portrait = { width: 390, height: 844, visible: true };
  it('restores swapped viewport axes in both directions, including browser chrome', () => {
    expect(shouldRestoreBookShelfAfterOrientation(portrait, { width: 844, height: 390 })).toBe(true);
    expect(shouldRestoreBookShelfAfterOrientation({ width: 844, height: 390, visible: true }, portrait)).toBe(true);
    expect(shouldRestoreBookShelfAfterOrientation({ ...portrait, height: 756 }, { width: 844, height: 350 })).toBe(true);
  });
  it('does not capture an offscreen inspection, normal resize or an open keyboard', () => {
    expect(shouldRestoreBookShelfAfterOrientation({ ...portrait, visible: false }, { width: 844, height: 390 })).toBe(false);
    expect(shouldRestoreBookShelfAfterOrientation(portrait, { width: 390, height: 320 })).toBe(false);
    expect(shouldRestoreBookShelfAfterOrientation(portrait, { width: 410, height: 800 })).toBe(false);
    expect(shouldRestoreBookShelfAfterOrientation(portrait, { width: 844, height: 390 }, true)).toBe(false);
    expect(shouldRestoreBookShelfAfterOrientation(portrait, { width: Number.NaN, height: 390 })).toBe(false);
  });
});
