import type { CSSProperties } from "react";

import { cmsSiteContent } from "./site.generated";
import { cmsHomepageVisualCssProperties } from "./homepageVisualSettings";

export type CoreHomepageSectionKey =
  | "hero"
  | "atlas"
  | "book-month"
  | "editorial-standard"
  | "featured-journal"
  | "community"
  | "authors"
  | "sections"
  | "trust"
  | "calendar";

export type CoreHomepageBackgroundStyle =
  | "light"
  | "violet"
  | "orange"
  | "paper"
  | "transparent";

export type CoreHomepageSection = {
  key: CoreHomepageSectionKey;
  title: string;
  eyebrow: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  backgroundStyle: CoreHomepageBackgroundStyle;
  backgroundImageUrl: string;
  visualSettings?: Record<string, unknown>;
};

type CmsHomepageBlock = {
  title?: unknown;
  settings?: unknown;
  backgroundStyle?: unknown;
  backgroundImageUrl?: unknown;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function backgroundStyleValue(value: unknown): CoreHomepageBackgroundStyle {
  const style = textValue(value);
  return ["light", "violet", "orange", "paper", "transparent"].includes(
    style
  )
    ? (style as CoreHomepageBackgroundStyle)
    : "transparent";
}

const homepageBlocks = (
  cmsSiteContent.homepageBlocks as readonly unknown[]
) as readonly CmsHomepageBlock[];

export function getCoreHomepageSection(
  key: CoreHomepageSectionKey
): CoreHomepageSection | null {
  for (const block of homepageBlocks) {
    const settings = objectValue(block.settings);
    if (settings.coreSectionKey !== key) continue;
    return {
      key,
      title: textValue(block.title),
      eyebrow: textValue(settings.eyebrow),
      description:
        textValue(settings.description) || textValue(settings.copy),
      buttonText: textValue(settings.buttonText),
      buttonUrl: textValue(settings.buttonUrl),
      backgroundStyle: backgroundStyleValue(block.backgroundStyle),
      backgroundImageUrl: textValue(block.backgroundImageUrl),
      visualSettings: settings,
    };
  }
  return null;
}

export function coreHomepageSectionClass(section: CoreHomepageSection | null) {
  if (!section) return "";
  return ` cms-core-editable is-${section.backgroundStyle}${
    section.backgroundImageUrl ? " has-cms-background" : ""
  }`;
}

export function coreHomepageSectionStyle(
  section: CoreHomepageSection | null
): CSSProperties | undefined {
  if (!section) return undefined;
  const visualProperties = cmsHomepageVisualCssProperties(
    section.visualSettings
  );
  if (!section.backgroundImageUrl && !Object.keys(visualProperties).length) {
    return undefined;
  }
  return {
    ...visualProperties,
    ...(section.backgroundImageUrl
      ? {
        "--cms-core-background": `url(${JSON.stringify(
          section.backgroundImageUrl
        )})`,
        }
      : {}),
  } as CSSProperties;
}
