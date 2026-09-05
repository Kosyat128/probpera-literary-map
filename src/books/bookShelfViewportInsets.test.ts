import { describe, expect, it } from 'vitest';
import { measureBookShelfViewportInsets } from './bookShelfViewportInsets';

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
});
