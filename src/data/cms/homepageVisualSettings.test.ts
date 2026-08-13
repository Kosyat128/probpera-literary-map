import { describe, expect, it } from "vitest";

import {
  cmsHomepageBlockStyle,
  isCompleteCmsHomepageVisualSettings,
  readCmsHomepageVisualSettings,
} from "./homepageVisualSettings";

const settings = {
  imageFit: "contain",
  imagePosition: "top-right",
  imageZoom: 120,
  imageBrightness: 90,
  imageContrast: 110,
  imageSaturation: 105,
  imageBlur: 2,
  imageOverlay: 24,
  titleFontSize: 60,
  titleAlign: "center",
  titleWeight: 700,
  titleLineHeight: 1.1,
  bodyFontSize: 19,
  bodyAlign: "left",
  bodyWeight: 400,
  bodyLineHeight: 1.6,
} as const;

describe("public homepage visual settings", () => {
  it("turns only valid persisted settings into CSS variables", () => {
    const style = cmsHomepageBlockStyle(settings, "https://example.com/hero.webp") as Record<string, string>;
    expect(style["--cms-image-fit"]).toBe("contain");
    expect(style["--cms-image-position"]).toBe("right top");
    expect(style["--cms-image-zoom"]).toBe("1.2");
    expect(style["--cms-background-image"]).toContain("hero.webp");
  });

  it("ignores invalid and unknown stored values", () => {
    expect(
      readCmsHomepageVisualSettings({
        imageFit: "javascript",
        imageZoom: 9_999,
        arbitraryCss: "display:none",
        titleAlign: "right",
      })
    ).toEqual({ titleAlign: "right" });
  });

  it("requires the exact complete bridge payload", () => {
    expect(isCompleteCmsHomepageVisualSettings(settings)).toBe(true);
    expect(isCompleteCmsHomepageVisualSettings({ ...settings, css: "x" })).toBe(false);
    expect(isCompleteCmsHomepageVisualSettings({ ...settings, imageBlur: 99 })).toBe(false);
  });
});
