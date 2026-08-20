import { describe, expect, it } from "vitest";

import {
  beginGlobePointerGesture,
  GLOBE_KEYBOARD_ROTATION_STEP,
  globeControlActionForKey,
  isGlobePointerTap,
  orbitDollyMethodForZoomDirection,
  shouldGlobeAutoRotate,
  updateGlobePointerGesture,
} from "./globeInteraction";

describe("globe pointer gestures", () => {
  it("accepts an accessible touch tap but rejects a drag that returns to its origin", () => {
    const origin = beginGlobePointerGesture({
      pointerId: 4,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
      isPrimary: true,
    });

    expect(
      isGlobePointerTap(origin, {
        pointerId: 4,
        pointerType: "touch",
        clientX: 111,
        clientY: 106,
        isPrimary: true,
      })
    ).toBe(true);

    const dragged = updateGlobePointerGesture(origin, {
      pointerId: 4,
      pointerType: "touch",
      clientX: 145,
      clientY: 100,
      isPrimary: true,
    });
    expect(
      isGlobePointerTap(dragged, {
        pointerId: 4,
        pointerType: "touch",
        clientX: 101,
        clientY: 100,
        isPrimary: true,
      })
    ).toBe(false);
  });

  it("does not start selection gestures for secondary touch or non-primary mouse buttons", () => {
    expect(
      beginGlobePointerGesture({
        pointerId: 2,
        pointerType: "touch",
        clientX: 0,
        clientY: 0,
        isPrimary: false,
      })
    ).toBeNull();
    expect(
      beginGlobePointerGesture({
        pointerId: 1,
        pointerType: "mouse",
        clientX: 0,
        clientY: 0,
        button: 2,
        isPrimary: true,
      })
    ).toBeNull();
  });
});

describe("globe keyboard controls", () => {
  it("maps arrows, zoom, reset, and selection keys", () => {
    expect(globeControlActionForKey("ArrowLeft")).toEqual({
      type: "rotate",
      azimuthDelta: -GLOBE_KEYBOARD_ROTATION_STEP,
      polarDelta: 0,
    });
    expect(globeControlActionForKey("ArrowDown", true)).toEqual({
      type: "rotate",
      azimuthDelta: 0,
      polarDelta: GLOBE_KEYBOARD_ROTATION_STEP * 2,
    });
    expect(globeControlActionForKey("+")).toEqual({
      type: "zoom",
      direction: "in",
    });
    expect(globeControlActionForKey("-")).toEqual({
      type: "zoom",
      direction: "out",
    });
    expect(globeControlActionForKey("Home")).toEqual({ type: "reset" });
    expect(globeControlActionForKey("Enter")).toEqual({ type: "select" });
    expect(globeControlActionForKey("Escape")).toBeNull();
  });

  it("maps visible plus and minus controls to OrbitControls camera movement", () => {
    expect(orbitDollyMethodForZoomDirection("in")).toBe("dollyOut");
    expect(orbitDollyMethodForZoomDirection("out")).toBe("dollyIn");
  });
});

describe("globe auto-rotation policy", () => {
  const defaults = {
    requested: true,
    reducedMotion: false,
    selectedCountryId: null,
    interactionPaused: false,
    visible: true,
  };

  it("runs only while requested, visible, unselected, and idle", () => {
    expect(shouldGlobeAutoRotate(defaults)).toBe(true);
    expect(
      shouldGlobeAutoRotate({ ...defaults, interactionPaused: true })
    ).toBe(false);
    expect(
      shouldGlobeAutoRotate({ ...defaults, selectedCountryId: "kiribati" })
    ).toBe(false);
    expect(
      shouldGlobeAutoRotate({ ...defaults, reducedMotion: true })
    ).toBe(false);
    expect(shouldGlobeAutoRotate({ ...defaults, requested: false })).toBe(false);
    expect(shouldGlobeAutoRotate({ ...defaults, visible: false })).toBe(false);
  });
});
