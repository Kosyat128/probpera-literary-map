import { describe, expect, it } from "vitest";

import {
  defaultBookArchiveSceneSettings,
  mergeBookArchiveSceneSettings,
  parseBookArchiveSceneSettings,
  readBookArchiveSceneSettings,
} from "./book-archive-scene-settings";

describe("book archive scene settings policy", () => {
  it("accepts the exact complete closed contract", () => {
    expect(
      parseBookArchiveSceneSettings({
        bookScenePreset: "midnight-archive",
        bookSceneDarkness: "55",
        bookSceneDynamicThemes: "false",
        bookSceneIntensity: "84",
        bookSceneAmbientTint: "deep-blue",
        bookSceneShelfMaterial: "smoked-oak",
      })
    ).toEqual({
      bookScenePreset: "midnight-archive",
      bookSceneDarkness: 55,
      bookSceneDynamicThemes: false,
      bookSceneIntensity: 84,
      bookSceneAmbientTint: "deep-blue",
      bookSceneShelfMaterial: "smoked-oak",
    });
  });

  it("rejects missing, unknown, raw-code and out-of-range values", () => {
    expect(() => parseBookArchiveSceneSettings({ bookScenePreset: "dynamic" })).toThrow(
      "неполный"
    );
    expect(() =>
      parseBookArchiveSceneSettings({
        ...defaultBookArchiveSceneSettings,
        css: "position:fixed",
      })
    ).toThrow("Неизвестная");
    for (const value of ["<script>alert(1)</script>", "url(javascript:alert(1))", "void main(){}"] ) {
      expect(() =>
        parseBookArchiveSceneSettings({
          ...defaultBookArchiveSceneSettings,
          bookSceneAmbientTint: value,
        })
      ).toThrow("Недопустимое");
    }
    expect(() =>
      parseBookArchiveSceneSettings({
        ...defaultBookArchiveSceneSettings,
        bookSceneDarkness: 91,
      })
    ).toThrow("90");
  });

  it("preserves unrelated settings and removes only scene keys on reset", () => {
    const existing = {
      coreSectionKey: "book-archive",
      description: "Книжный архив",
      imageZoom: 120,
      bookScenePreset: "ink-room",
      bookSceneDarkness: 60,
    };
    expect(
      mergeBookArchiveSceneSettings(existing, defaultBookArchiveSceneSettings, true)
    ).toEqual({
      coreSectionKey: "book-archive",
      description: "Книжный архив",
      imageZoom: 120,
    });
  });

  it("falls back per field for malformed legacy storage", () => {
    expect(
      readBookArchiveSceneSettings({
        bookScenePreset: "burgundy-edition",
        bookSceneDarkness: 999,
      })
    ).toMatchObject({
      bookScenePreset: "burgundy-edition",
      bookSceneDarkness: defaultBookArchiveSceneSettings.bookSceneDarkness,
    });
  });
});
