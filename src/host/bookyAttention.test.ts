import { describe, expect, it } from "vitest";
import { BOOKY_ATTENTION_RETURN_MS, createBookyAttention } from "./bookyAttention";
const avatar = { left: 400, top: 300, width: 100, height: 100 }, view = { width: 1000, height: 800 };
const center = { x: 450, y: 350 };
describe("Booky local attention intent", () => {
  it("looks toward real screen positions relative to the avatar and bounds both axes", () => {
    const attention = createBookyAttention();
    expect(attention.offer("pointer", { x: 610, y: 222 }, avatar, view, 100, false)).toBe(100 + BOOKY_ATTENTION_RETURN_MS);
    expect(attention.read(101)).toEqual({ x: .5, y: -.5 });
    attention.offer("pointer", { x: -1000, y: 2000 }, avatar, view, 200, false);
    expect(attention.read(200)).toEqual({ x: -1, y: 1 });
  });
  it("holds an actual press against incidental hover, but another press or focus replaces it immediately", () => {
    const attention = createBookyAttention();
    attention.offer("press", { x: 770, y: 350 }, avatar, view, 100, false);
    expect(attention.offer("pointer", center, avatar, view, 749, false)).toBeNull();
    expect(attention.read(749)).toEqual({ x: 1, y: 0 });
    attention.offer("focus", { x: 130, y: 350 }, avatar, view, 750, false);
    expect(attention.read(750)).toEqual({ x: -1, y: 0 });
    expect(attention.offer("pointer", center, avatar, view, 1399, false)).toBeNull();
    expect(attention.offer("pointer", center, avatar, view, 1400, false)).not.toBeNull();
    expect(attention.read(1400)).toEqual({ x: 0, y: 0 });
  });
  it("ignores hover in calm mode while allowing one explicit still press/focus pose", () => {
    const attention = createBookyAttention();
    expect(attention.offer("pointer", center, avatar, view, 100, true)).toBeNull();
    expect(attention.read(100)).toBeNull();
    attention.offer("press", { x: 770, y: 350 }, avatar, view, 100, true);
    expect(attention.offer("pointer", center, avatar, view, 1000, true)).toBeNull();
    expect(attention.read(1000)).toEqual({ x: 1, y: 0 });
    attention.offer("focus", center, avatar, view, 1200, true);
    expect(attention.read(1200)).toEqual({ x: 0, y: 0 });
  });
  it("expires at the original deadline and clears without replay after suspension", () => {
    const attention = createBookyAttention();
    attention.offer("press", center, avatar, view, 100, false);
    expect(attention.read(100 + BOOKY_ATTENTION_RETURN_MS - 1)).not.toBeNull();
    expect(attention.read(100 + BOOKY_ATTENTION_RETURN_MS)).toBeNull();
    attention.offer("focus", center, avatar, view, 3000, false); attention.clear();
    expect(attention.read(3001)).toBeNull();
    expect(attention.offer("pointer", center, avatar, view, 3001, false)).not.toBeNull();
  });
  it("does not replace valid intent with invalid dimensions, coordinates or timing", () => {
    const attention = createBookyAttention(); attention.offer("press", center, avatar, view, 100, false);
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(attention.offer("focus", { x: value, y: 0 }, avatar, view, 200, false)).toBeNull();
      expect(attention.offer("focus", center, avatar, view, value, false)).toBeNull();
    }
    expect(attention.offer("focus", center, { ...avatar, width: 0 }, view, 200, false)).toBeNull();
    expect(attention.offer("focus", center, avatar, { ...view, height: -1 }, 200, false)).toBeNull();
    expect(attention.read(200)).toEqual({ x: 0, y: 0 });
    expect(attention.read(NaN)).toBeNull(); expect(attention.read(201)).toBeNull();
  });
});
