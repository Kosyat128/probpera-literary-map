import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  globeCameraDestination,
  globeCameraIntentKey,
  globeCameraMotionSourceForIntent,
  type GlobeCountryCameraIntentKind,
  type GlobeCountryFocusIntent,
} from "./GlobeCameraRig";
import {
  GLOBE_SAFE_CAMERA_RADIUS,
  HOME_CAMERA_POSITION,
  HOME_ORBIT_TARGET,
} from "./globeFocusMath";

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

function countryIntent(
  kind: GlobeCountryCameraIntentKind = "country-focus",
  id: string | number = 4,
  countryId = "france"
): GlobeCountryFocusIntent {
  return {
    id,
    kind,
    countryId,
    metrics: {
      direction: new THREE.Vector3(0.3, 0.4, 0.8).normalize(),
      angularRadius: THREE.MathUtils.degToRad(8),
      principalAngularExtent: THREE.MathUtils.degToRad(8),
      principalPolygonCount: 1,
      source: "geometry",
    },
  };
}

describe("GlobeCameraRig contract", () => {
  it("keeps distinct country and home targets", () => {
    const country = globeCameraDestination({
      intent: countryIntent(),
      verticalFovDegrees: 43,
      viewportWidth: 1_200,
      viewportHeight: 800,
      viewInsets: ZERO_INSETS,
    });
    const home = globeCameraDestination({
      intent: { id: 5, kind: "home" },
      verticalFovDegrees: 43,
      viewportWidth: 1_200,
      viewportHeight: 800,
      viewInsets: ZERO_INSETS,
    });

    expect(country.target.toArray()).toEqual([0, 0, 0]);
    expect(home.target.toArray()).toEqual([
      HOME_ORBIT_TARGET.x,
      HOME_ORBIT_TARGET.y,
      HOME_ORBIT_TARGET.z,
    ]);
    expect(home.direction.clone().multiplyScalar(home.radius).toArray()).toEqual([
      HOME_CAMERA_POSITION.x,
      HOME_CAMERA_POSITION.y,
      HOME_CAMERA_POSITION.z,
    ]);
    expect(country.radius).toBeGreaterThanOrEqual(GLOBE_SAFE_CAMERA_RADIUS);
  });

  it("uses the free-area insets to choose a safer country radius", () => {
    const intent = countryIntent();
    intent.metrics.principalAngularExtent = THREE.MathUtils.degToRad(34);
    const open = globeCameraDestination({
      intent,
      verticalFovDegrees: 43,
      viewportWidth: 1_200,
      viewportHeight: 800,
      viewInsets: ZERO_INSETS,
    });
    const obstructed = globeCameraDestination({
      intent,
      verticalFovDegrees: 43,
      viewportWidth: 1_200,
      viewportHeight: 800,
      viewInsets: { ...ZERO_INSETS, right: 420 },
    });
    expect(obstructed.radius).toBeGreaterThan(open.radius);
  });

  it("keys every intent so a newer request can replace an active flight", () => {
    expect(globeCameraIntentKey(countryIntent())).toBe(
      "country-focus:france:4"
    );
    expect(globeCameraIntentKey({ id: "reset-9", kind: "home" })).toBe(
      "home:reset-9"
    );
  });

  it("preserves each semantic programmatic source", () => {
    const countrySources: GlobeCountryCameraIntentKind[] = [
      "country-focus",
      "country-refocus",
      "writer-focus",
      "random-focus",
    ];

    for (const [index, source] of countrySources.entries()) {
      const intent = countryIntent(source, index + 1);
      expect(globeCameraMotionSourceForIntent(intent)).toBe(source);
      expect(globeCameraIntentKey(intent)).toBe(
        `${source}:france:${index + 1}`
      );
    }
    expect(globeCameraMotionSourceForIntent({ id: 5, kind: "home" })).toBe(
      "home"
    );
  });

  it("makes rapid same-target requests distinct so the latest flight wins", () => {
    const rapidIntents = [
      countryIntent("country-focus", 11, "japan"),
      countryIntent("country-refocus", 12, "japan"),
      countryIntent("random-focus", 13, "china"),
    ];
    const keys = rapidIntents.map(globeCameraIntentKey);

    expect(new Set(keys).size).toBe(rapidIntents.length);
    expect(keys[keys.length - 1]).toBe("random-focus:china:13");

    const source = readFileSync(
      new URL("./GlobeCameraRig.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain('cancelMotion("superseded")');
    expect(source).toContain("flightRef.current = flight");
    expect(source).not.toContain("flightQueue");
  });

  it("labels cancellation at every controller-owned interruption boundary", () => {
    const source = readFileSync(
      new URL("./GlobeCameraRig.tsx", import.meta.url),
      "utf8"
    );

    for (const cancellationSource of [
      "superseded",
      "manual",
      "command",
      "visibility",
      "unmount",
    ]) {
      expect(source).toContain(`cancelMotion("${cancellationSource}")`);
    }
    expect(source).toContain("onProgrammaticStart");
    expect(source).toContain("onProgrammaticCancel");
    expect(source).toContain("globeCameraIntentKey(activeFlight.intent)");
  });

  it("contains one controls owner and no cartesian or external RAF tween", () => {
    const source = readFileSync(new URL("./GlobeCameraRig.tsx", import.meta.url), "utf8");
    expect(source.match(/<OrbitControls\b/g)).toHaveLength(1);
    expect(source).toContain("sampleCameraTrajectory");
    expect(source).not.toContain("lerpVectors");
    expect(source).not.toContain("requestAnimationFrame");
    expect(source).toContain("onStart={handleInteractionStart}");
    expect(source).toContain("enabled={active && interactionEnabled}");
  });

  it("starts flight time on its first rendered frame and clears damping residue", () => {
    const source = readFileSync(
      new URL("./GlobeCameraRig.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("startedAt: null");
    expect(source).toContain(
      "if (flight.startedAt === null) flight.startedAt = frameTime"
    );
    const settlingLoop = source.slice(
      source.indexOf("const settling ="),
      source.indexOf("if (controls.autoRotate) invalidate()")
    );
    expect(settlingLoop).toContain("controls.enableDamping = false");
    expect(settlingLoop.indexOf("controls.enableDamping = false")).toBeLessThan(
      settlingLoop.indexOf("syncRestingControls();")
    );
  });

  it("issues one atomic country intent per selection, including same-country refocus", () => {
    const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    const selectCountrySource = appSource.slice(
      appSource.indexOf("const selectCountry"),
      appSource.indexOf("const selectRandomLiteraryDestination")
    );
    const closeCountrySource = appSource.slice(
      appSource.indexOf("const closeCountry"),
      appSource.indexOf("const selectAtlasFilter")
    );
    const randomSource = appSource.slice(
      appSource.indexOf("const selectRandomLiteraryDestination"),
      appSource.indexOf("const focusCountryPresentation")
    );
    const writerSource = appSource.slice(
      appSource.indexOf("const showWriterOnGlobe"),
      appSource.indexOf("const openCommunity")
    );
    expect(selectCountrySource).toContain(
      "globeFocusRequestIdRef.current += 1"
    );
    expect(selectCountrySource).toContain('"country-refocus"');
    expect(selectCountrySource).toContain('"country-focus"');
    expect(selectCountrySource).toContain("countryId: country.id");
    expect(randomSource).toContain('"random-focus"');
    expect(writerSource).toContain('kind: "writer-focus"');
    expect(closeCountrySource).toContain("setGlobeFocusRequest(null)");
  });
});
