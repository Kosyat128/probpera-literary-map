import { describe, expect, it } from "vitest";
import { atlasSheetDragIntent, atlasSheetSnap, clampAtlasSheetHeight } from "./atlasSheetGesture";

const heights = { collapsed:142, half:360, expanded:560 };

describe("country sheet drag decisions", () => {
  it("leaves small tap movement alone and rejects horizontal gestures", () => {
    expect(atlasSheetDragIntent(4, 7)).toBe("pending");
    expect(atlasSheetDragIntent(16, 9)).toBe("cancel");
    expect(atlasSheetDragIntent(8, 8)).toBe("cancel");
    expect(atlasSheetDragIntent(4, -12)).toBe("vertical");
  });

  it("clamps direct manipulation to the actual measured sheet endpoints", () => {
    expect(clampAtlasSheetHeight(800, heights)).toBe(560);
    expect(clampAtlasSheetHeight(20, heights)).toBe(142);
    expect(clampAtlasSheetHeight(281, heights)).toBe(281);
  });

  it("settles slow drags to the nearest authored height in either direction", () => {
    expect(atlasSheetSnap({state:"collapsed",heights,height:300,deltaY:-158,velocityY:0})).toBe("half");
    expect(atlasSheetSnap({state:"half",heights,height:510,deltaY:-150,velocityY:0})).toBe("expanded");
    expect(atlasSheetSnap({state:"expanded",heights,height:330,deltaY:230,velocityY:0})).toBe("half");
    expect(atlasSheetSnap({state:"half",heights,height:190,deltaY:170,velocityY:0})).toBe("collapsed");
  });

  it("keeps a small aborted drag at its initial snap and requires travel for a flick", () => {
    expect(atlasSheetSnap({state:"half",heights,height:351,deltaY:9,velocityY:1})).toBe("half");
    expect(atlasSheetSnap({state:"collapsed",heights,height:170,deltaY:-28,velocityY:-0.1})).toBe("collapsed");
  });

  it("allows intentional directional flicks but bounds them at the end states", () => {
    expect(atlasSheetSnap({state:"collapsed",heights,height:176,deltaY:-34,velocityY:-0.7})).toBe("half");
    expect(atlasSheetSnap({state:"half",heights,height:320,deltaY:40,velocityY:0.7})).toBe("collapsed");
    expect(atlasSheetSnap({state:"expanded",heights,height:560,deltaY:-100,velocityY:-3})).toBe("expanded");
  });

  it("preserves semantic state at equal capped heights but permits deliberate opening", () => {
    const cramped = {collapsed:120,half:120,expanded:120};
    expect(atlasSheetSnap({state:"half",heights:cramped,height:120,deltaY:10,velocityY:0})).toBe("half");
    expect(atlasSheetSnap({state:"collapsed",heights:cramped,height:120,deltaY:-35,velocityY:-0.7})).toBe("half");
  });
});
