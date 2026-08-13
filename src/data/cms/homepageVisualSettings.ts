import type { CSSProperties } from "react";

export const cmsHomepageVisualSettingKeys = [
  "imageFit",
  "imagePosition",
  "imageZoom",
  "imageBrightness",
  "imageContrast",
  "imageSaturation",
  "imageBlur",
  "imageOverlay",
  "titleFontSize",
  "titleAlign",
  "titleWeight",
  "titleLineHeight",
  "bodyFontSize",
  "bodyAlign",
  "bodyWeight",
  "bodyLineHeight",
] as const;

export type CmsHomepageVisualSettings = {
  imageFit: "cover" | "contain" | "fill";
  imagePosition:
    | "top-left"
    | "top"
    | "top-right"
    | "left"
    | "center"
    | "right"
    | "bottom-left"
    | "bottom"
    | "bottom-right";
  imageZoom: number;
  imageBrightness: number;
  imageContrast: number;
  imageSaturation: number;
  imageBlur: number;
  imageOverlay: number;
  titleFontSize: number;
  titleAlign: "left" | "center" | "right";
  titleWeight: 400 | 500 | 600 | 700 | 800;
  titleLineHeight: number;
  bodyFontSize: number;
  bodyAlign: "left" | "center" | "right";
  bodyWeight: 400 | 500 | 600 | 700 | 800;
  bodyLineHeight: number;
};

type Rule =
  | { type: "enum"; values: readonly (string | number)[] }
  | { type: "number"; min: number; max: number };

const rules = {
  imageFit: { type: "enum", values: ["cover", "contain", "fill"] },
  imagePosition: {
    type: "enum",
    values: ["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"],
  },
  imageZoom: { type: "number", min: 50, max: 200 },
  imageBrightness: { type: "number", min: 0, max: 200 },
  imageContrast: { type: "number", min: 0, max: 200 },
  imageSaturation: { type: "number", min: 0, max: 200 },
  imageBlur: { type: "number", min: 0, max: 20 },
  imageOverlay: { type: "number", min: 0, max: 90 },
  titleFontSize: { type: "number", min: 20, max: 112 },
  titleAlign: { type: "enum", values: ["left", "center", "right"] },
  titleWeight: { type: "enum", values: [400, 500, 600, 700, 800] },
  titleLineHeight: { type: "number", min: 0.8, max: 1.6 },
  bodyFontSize: { type: "number", min: 12, max: 32 },
  bodyAlign: { type: "enum", values: ["left", "center", "right"] },
  bodyWeight: { type: "enum", values: [400, 500, 600, 700, 800] },
  bodyLineHeight: { type: "number", min: 1, max: 2.2 },
} as const satisfies Record<keyof CmsHomepageVisualSettings, Rule>;

function plainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizedValue<Key extends keyof CmsHomepageVisualSettings>(
  key: Key,
  value: unknown
): CmsHomepageVisualSettings[Key] | null {
  const rule: Rule = rules[key];
  if (rule.type === "enum") {
    return rule.values.includes(value as never)
      ? (value as CmsHomepageVisualSettings[Key])
      : null;
  }
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= rule.min &&
    value <= rule.max
    ? (value as CmsHomepageVisualSettings[Key])
    : null;
}

export function readCmsHomepageVisualSettings(value: unknown) {
  if (!plainRecord(value)) return {};
  return Object.fromEntries(
    cmsHomepageVisualSettingKeys.flatMap((key) => {
      const normalized = normalizedValue(key, value[key]);
      return normalized === null ? [] : [[key, normalized]];
    })
  ) as Partial<CmsHomepageVisualSettings>;
}

export function isCompleteCmsHomepageVisualSettings(
  value: unknown
): value is CmsHomepageVisualSettings {
  if (!plainRecord(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === cmsHomepageVisualSettingKeys.length &&
    keys.every((key) => cmsHomepageVisualSettingKeys.includes(key as never)) &&
    cmsHomepageVisualSettingKeys.every(
      (key) => normalizedValue(key, value[key]) !== null
    )
  );
}

const cssVariableNames = [
  "--cms-image-fit",
  "--cms-image-object-fit",
  "--cms-image-position",
  "--cms-image-zoom",
  "--cms-image-brightness",
  "--cms-image-contrast",
  "--cms-image-saturation",
  "--cms-image-blur",
  "--cms-image-overlay-alpha",
  "--cms-title-font-size",
  "--cms-title-align",
  "--cms-title-weight",
  "--cms-title-line-height",
  "--cms-body-font-size",
  "--cms-body-align",
  "--cms-body-weight",
  "--cms-body-line-height",
] as const;

export const cmsHomepageVisualCssVariables = cssVariableNames;

const positions: Record<CmsHomepageVisualSettings["imagePosition"], string> = {
  "top-left": "left top",
  top: "center top",
  "top-right": "right top",
  left: "left center",
  center: "center center",
  right: "right center",
  "bottom-left": "left bottom",
  bottom: "center bottom",
  "bottom-right": "right bottom",
};

export function cmsHomepageVisualCssProperties(
  value: unknown
): Record<(typeof cssVariableNames)[number], string> {
  const settings = readCmsHomepageVisualSettings(value);
  const properties: Partial<Record<(typeof cssVariableNames)[number], string>> = {};
  if (settings.imageFit) {
    properties["--cms-image-fit"] = settings.imageFit === "fill" ? "100% 100%" : settings.imageFit;
    properties["--cms-image-object-fit"] = settings.imageFit;
  }
  if (settings.imagePosition) properties["--cms-image-position"] = positions[settings.imagePosition];
  if (settings.imageZoom !== undefined) properties["--cms-image-zoom"] = String(settings.imageZoom / 100);
  if (settings.imageBrightness !== undefined) properties["--cms-image-brightness"] = `${settings.imageBrightness}%`;
  if (settings.imageContrast !== undefined) properties["--cms-image-contrast"] = `${settings.imageContrast}%`;
  if (settings.imageSaturation !== undefined) properties["--cms-image-saturation"] = `${settings.imageSaturation}%`;
  if (settings.imageBlur !== undefined) properties["--cms-image-blur"] = `${settings.imageBlur}px`;
  if (settings.imageOverlay !== undefined) properties["--cms-image-overlay-alpha"] = String(settings.imageOverlay / 100);
  if (settings.titleFontSize !== undefined) properties["--cms-title-font-size"] = `${settings.titleFontSize}px`;
  if (settings.titleAlign) properties["--cms-title-align"] = settings.titleAlign;
  if (settings.titleWeight !== undefined) properties["--cms-title-weight"] = String(settings.titleWeight);
  if (settings.titleLineHeight !== undefined) properties["--cms-title-line-height"] = String(settings.titleLineHeight);
  if (settings.bodyFontSize !== undefined) properties["--cms-body-font-size"] = `${settings.bodyFontSize}px`;
  if (settings.bodyAlign) properties["--cms-body-align"] = settings.bodyAlign;
  if (settings.bodyWeight !== undefined) properties["--cms-body-weight"] = String(settings.bodyWeight);
  if (settings.bodyLineHeight !== undefined) properties["--cms-body-line-height"] = String(settings.bodyLineHeight);
  return properties as Record<(typeof cssVariableNames)[number], string>;
}

export function cmsHomepageBlockStyle(
  settings: unknown,
  backgroundImageUrl?: string
) {
  return {
    ...(backgroundImageUrl
      ? { "--cms-background-image": `url(${JSON.stringify(backgroundImageUrl)})` }
      : {}),
    ...cmsHomepageVisualCssProperties(settings),
  } as CSSProperties;
}
