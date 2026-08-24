import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  createGlobeTouchActivationState,
  globeTouchActivationReducer,
  resolveGlobeTouchActivationPolicy,
  shouldGlobeTouchConsumeEscape,
  type GlobeTouchEnvironment,
} from "./globeTouchActivation";

const embeddedCoarse = {
  view: "embedded",
  pointer: "coarse",
  reducedMotion: false,
  globeVisible: true,
} satisfies GlobeTouchEnvironment;

describe("globe touch activation policy", () => {
  it("keeps an embedded coarse-pointer globe passive until explicit activation", () => {
    const passive = createGlobeTouchActivationState(embeddedCoarse);

    expect(resolveGlobeTouchActivationPolicy(passive)).toMatchObject({
      mode: "page-pan",
      controlsEnabled: false,
      capturesTouch: false,
      touchAction: "pan-y pinch-zoom",
      activationControl: "activate",
    });

    const active = globeTouchActivationReducer(passive, { type: "ACTIVATE" });
    expect(resolveGlobeTouchActivationPolicy(active)).toMatchObject({
      mode: "globe-control",
      controlsEnabled: true,
      capturesTouch: true,
      touchAction: "none",
      activationControl: "deactivate",
    });
  });

  it("lets Escape leave explicit full control before a higher-level handler exits", () => {
    const active = globeTouchActivationReducer(
      createGlobeTouchActivationState(embeddedCoarse),
      { type: "ACTIVATE" }
    );

    expect(shouldGlobeTouchConsumeEscape(active)).toBe(true);
    const passive = globeTouchActivationReducer(active, { type: "ESCAPE" });
    expect(shouldGlobeTouchConsumeEscape(passive)).toBe(false);
    expect(resolveGlobeTouchActivationPolicy(passive).mode).toBe("page-pan");
  });

  it("gives immersive coarse-pointer views full gestures by default", () => {
    const immersive = createGlobeTouchActivationState({
      ...embeddedCoarse,
      view: "immersive",
    });

    expect(resolveGlobeTouchActivationPolicy(immersive)).toMatchObject({
      mode: "globe-control",
      controlsEnabled: true,
      touchAction: "none",
      activationControl: null,
      escapeDeactivates: false,
    });
    expect(globeTouchActivationReducer(immersive, { type: "ESCAPE" })).toBe(
      immersive
    );
  });

  it("clears embedded activation across view and pointer mode changes", () => {
    const active = globeTouchActivationReducer(
      createGlobeTouchActivationState(embeddedCoarse),
      { type: "ACTIVATE" }
    );
    const immersive = globeTouchActivationReducer(active, {
      type: "SYNC_ENVIRONMENT",
      environment: { ...embeddedCoarse, view: "immersive" },
    });
    const embeddedAgain = globeTouchActivationReducer(immersive, {
      type: "SYNC_ENVIRONMENT",
      environment: embeddedCoarse,
    });

    expect(immersive.embeddedControlRequested).toBe(false);
    expect(resolveGlobeTouchActivationPolicy(immersive).mode).toBe(
      "globe-control"
    );
    expect(resolveGlobeTouchActivationPolicy(embeddedAgain).mode).toBe(
      "page-pan"
    );

    const fine = globeTouchActivationReducer(active, {
      type: "SYNC_ENVIRONMENT",
      environment: { ...embeddedCoarse, pointer: "fine" },
    });
    expect(fine.embeddedControlRequested).toBe(false);
    expect(resolveGlobeTouchActivationPolicy(fine).mode).toBe("globe-control");
  });

  it("suspends offscreen input and returns embedded touch to passive page pan", () => {
    const active = globeTouchActivationReducer(
      createGlobeTouchActivationState(embeddedCoarse),
      { type: "ACTIVATE" }
    );
    const offscreen = globeTouchActivationReducer(active, {
      type: "SYNC_ENVIRONMENT",
      environment: { ...embeddedCoarse, globeVisible: false },
    });

    expect(resolveGlobeTouchActivationPolicy(offscreen)).toMatchObject({
      mode: "suspended",
      controlsEnabled: false,
      capturesTouch: false,
      touchAction: "pan-y pinch-zoom",
      activationControl: null,
    });
    expect(offscreen.embeddedControlRequested).toBe(false);

    const onscreen = globeTouchActivationReducer(offscreen, {
      type: "SYNC_ENVIRONMENT",
      environment: embeddedCoarse,
    });
    expect(resolveGlobeTouchActivationPolicy(onscreen).mode).toBe("page-pan");
  });

  it("does not disable direct manipulation when reduced motion changes", () => {
    const active = globeTouchActivationReducer(
      createGlobeTouchActivationState(embeddedCoarse),
      { type: "ACTIVATE" }
    );
    const reduced = globeTouchActivationReducer(active, {
      type: "SYNC_ENVIRONMENT",
      environment: { ...embeddedCoarse, reducedMotion: true },
    });

    expect(reduced.embeddedControlRequested).toBe(true);
    expect(resolveGlobeTouchActivationPolicy(reduced)).toMatchObject({
      mode: "globe-control",
      controlsEnabled: true,
      reducedMotion: true,
    });
  });

  it("keeps a fine-pointer globe active without activation UI", () => {
    const fine = createGlobeTouchActivationState({
      ...embeddedCoarse,
      pointer: "fine",
      reducedMotion: true,
    });

    expect(resolveGlobeTouchActivationPolicy(fine)).toMatchObject({
      mode: "globe-control",
      controlsEnabled: true,
      activationControl: null,
    });
    expect(globeTouchActivationReducer(fine, { type: "ACTIVATE" })).toBe(fine);
    expect(globeTouchActivationReducer(fine, { type: "ESCAPE" })).toBe(fine);
  });

  it("keeps passive taps selectable without installing a scroll-blocking listener", () => {
    const globeSource = readFileSync(
      new URL("./LiteraryGlobe.tsx", import.meta.url),
      "utf8"
    );
    const cameraSource = readFileSync(
      new URL("./GlobeCameraRig.tsx", import.meta.url),
      "utf8"
    );

    expect(globeSource).toContain("function GlobePagePanTapBridge");
    expect(globeSource).toContain('canvas.addEventListener("pointerup", handlePointerUp, { passive: true })');
    expect(globeSource).toContain("if (!isGlobePointerTap(gestureRef.current, event))");
    expect(cameraSource).toContain("enabled={active && interactionEnabled}");
  });
});
