import { describe, expect, it } from "vitest";

import {
  bookArchiveSceneCssProperties,
  bookArchiveSceneCssVariables,
  bookSceneOwnerOverrideFromSettings,
  defaultBookArchiveSceneSettings,
  readBookArchiveSceneSettings,
  resolveBookArchiveSceneSettings,
} from "./bookArchiveSceneSettings";

describe("public book archive scene settings", () => {
  it("reads only valid allowlisted stored values", () => {
    expect(
      readBookArchiveSceneSettings({
        bookScenePreset: "deep-blue-study",
        bookSceneDarkness: 54,
        bookSceneDynamicThemes: false,
        bookSceneIntensity: 81,
        bookSceneAmbientTint: "deep-blue",
        bookSceneShelfMaterial: "smoked-oak",
        css: "position:fixed",
        shader: "void main(){}",
      })
    ).toEqual({
      bookScenePreset: "deep-blue-study",
      bookSceneDarkness: 54,
      bookSceneDynamicThemes: false,
      bookSceneIntensity: 81,
      bookSceneAmbientTint: "deep-blue",
      bookSceneShelfMaterial: "smoked-oak",
    });
  });

  it("falls back safely for malformed persisted values", () => {
    expect(
      resolveBookArchiveSceneSettings({
        bookScenePreset: "url(javascript:alert(1))",
        bookSceneDarkness: 999,
        bookSceneDynamicThemes: "yes",
        bookSceneAmbientTint: "#fff",
      })
    ).toEqual(defaultBookArchiveSceneSettings);
  });

  it("maps only a fixed preset to an owner override", () => {
    expect(bookSceneOwnerOverrideFromSettings({ bookScenePreset: "dynamic" })).toBeNull();
    expect(
      bookSceneOwnerOverrideFromSettings({ bookScenePreset: "museum-ivory" })
    ).toEqual({ archetype: "MUSEUM IVORY" });
  });

  it("emits an exact safe CSS variable set", () => {
    const properties = bookArchiveSceneCssProperties({
      bookSceneDarkness: 50,
      bookSceneIntensity: 80,
      bookSceneAmbientTint: "burgundy",
      bookSceneShelfMaterial: "museum-brass",
    }) as Record<string, string>;
    expect(Object.keys(properties).sort()).toEqual(
      [...bookArchiveSceneCssVariables].sort()
    );
    expect(properties["--book-scene-darkness"]).toBe("0.5");
    expect(properties["--book-scene-ambient-tint"]).toBe("#6B263A");
  });
});
