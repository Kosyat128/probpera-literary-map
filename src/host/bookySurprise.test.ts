import { describe, expect, it, vi } from "vitest";
import { BOOKY_GESTURES, type BookyInteraction } from "./bookyAnimation";
import { pickBookySurprise, type BookySurpriseState } from "./bookySurprise";

describe("Booky's local surprise sequence", () => {
  it("shows every gesture once in each uninterrupted round without adjacent repeats", () => {
    let state: BookySurpriseState = { remaining: [], last: null };
    let current: BookyInteraction = "rest";
    for (let round = 0; round < 3; round++) {
      const shown = [];
      for (let i = 0; i < BOOKY_GESTURES.length; i++) {
        const next = pickBookySurprise(state, current, () => .37);
        expect(next.gesture).not.toBe(current);
        shown.push(next.gesture); current = next.gesture; state = next.state;
      }
      expect(new Set(shown)).toEqual(new Set(BOOKY_GESTURES));
      expect(state.remaining).toEqual([]);
    }
  });

  it("avoids the last surprise after the visible character has returned to rest", () => {
    const next = pickBookySurprise({ remaining: [], last: "greeting" }, "rest", () => .999);
    expect(next.gesture).not.toBe("greeting");
    expect(next.state.remaining).toContain("greeting");
    expect(new Set([next.gesture, ...next.state.remaining])).toEqual(new Set(BOOKY_GESTURES));
  });

  it("skips a manually selected pending gesture without reshuffling the remaining choices", () => {
    const random = vi.fn(() => .5);
    const next = pickBookySurprise({ remaining: ["greeting", "wink", "hop"], last: "nod" }, "greeting", random);
    expect(next.gesture).toBe("wink");
    expect(next.state.remaining).toEqual(["hop"]);
    expect(random).not.toHaveBeenCalled();
  });

  it("starts a complete new round when a manual choice consumes the final pending slot", () => {
    const next = pickBookySurprise({ remaining: ["wink"], last: "greeting" }, "wink", () => 0);
    expect(["wink", "greeting"]).not.toContain(next.gesture);
    expect(new Set([next.gesture, ...next.state.remaining])).toEqual(new Set(BOOKY_GESTURES));
  });

  it("does not consume the caller's sequence until the caller accepts the action", () => {
    const state: BookySurpriseState = Object.freeze({ remaining: Object.freeze(["hop", "wink"] as const), last: "nod" });
    const first = pickBookySurprise(state, "rest"), retry = pickBookySurprise(state, "rest");
    expect(first).toEqual(retry);
    expect(state.remaining).toEqual(["hop", "wink"]);
    expect(state.last).toBe("nod");
    expect(first.state.remaining).toEqual(["wink"]);
  });
});
