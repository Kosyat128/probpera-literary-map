import { describe, expect, it } from "vitest";

import {
  defaultHomepageVisualSettings,
  mergeHomepageVisualSettings,
  parseHomepageVisualSettings,
  readHomepageVisualSettings,
} from "./homepage-visual-settings";

describe("homepage visual settings policy", () => {
  it("accepts the complete allowlisted image and typography contract", () => {
    expect(
      parseHomepageVisualSettings({
        ...defaultHomepageVisualSettings,
        imageFit: "contain",
        imagePosition: "top-right",
        imageZoom: "135",
        imageBrightness: "90",
        imageContrast: "125",
        imageSaturation: "80",
        imageBlur: "1.5",
        imageOverlay: "24",
        titleFontSize: "72",
        titleAlign: "center",
        titleWeight: "800",
        titleLineHeight: "0.9",
        bodyFontSize: "20",
        bodyAlign: "right",
        bodyWeight: "500",
        bodyLineHeight: "1.7",
      })
    ).toEqual({
      imageFit: "contain",
      imagePosition: "top-right",
      imageZoom: 135,
      imageBrightness: 90,
      imageContrast: 125,
      imageSaturation: 80,
      imageBlur: 1.5,
      imageOverlay: 24,
      titleFontSize: 72,
      titleAlign: "center",
      titleWeight: 800,
      titleLineHeight: 0.9,
      bodyFontSize: 20,
      bodyAlign: "right",
      bodyWeight: 500,
      bodyLineHeight: 1.7,
    });
  });

  it("rejects arbitrary CSS, unknown keys and out-of-range values", () => {
    expect(() =>
      parseHomepageVisualSettings({
        ...defaultHomepageVisualSettings,
        imageFit: "url(javascript:alert(1))",
      })
    ).toThrow("Недопустимое");
    expect(() =>
      parseHomepageVisualSettings({
        ...defaultHomepageVisualSettings,
        cssText: "position:fixed;inset:0",
      })
    ).toThrow("Неизвестная");
    expect(() =>
      parseHomepageVisualSettings({
        ...defaultHomepageVisualSettings,
        titleFontSize: 113,
      })
    ).toThrow("112");
    expect(() =>
      parseHomepageVisualSettings({
        ...defaultHomepageVisualSettings,
        bodyLineHeight: 2.21,
      })
    ).toThrow("2.2");
  });

  it("does not silently accept a partial settings payload", () => {
    expect(() =>
      parseHomepageVisualSettings({ imageFit: "cover" })
    ).toThrow("неполный");
  });

  it("preserves unrelated block settings and removes only visual keys on reset", () => {
    const existing = {
      coreSectionKey: "hero",
      description: "Текст",
      imageZoom: 155,
      titleFontSize: 70,
    };
    expect(
      mergeHomepageVisualSettings(existing, defaultHomepageVisualSettings, true)
    ).toEqual({ coreSectionKey: "hero", description: "Текст" });
    expect(
      mergeHomepageVisualSettings(existing, {
        ...defaultHomepageVisualSettings,
        imageZoom: 120,
      })
    ).toMatchObject({
      coreSectionKey: "hero",
      description: "Текст",
      imageZoom: 120,
    });
  });

  it("falls back safely when legacy stored values are malformed", () => {
    expect(
      readHomepageVisualSettings({
        imagePosition: "bottom-left",
        imageBlur: 500,
        titleAlign: "justify",
      })
    ).toMatchObject({
      imagePosition: "bottom-left",
      imageBlur: defaultHomepageVisualSettings.imageBlur,
      titleAlign: defaultHomepageVisualSettings.titleAlign,
    });
  });
});
