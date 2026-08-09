import type { CSSProperties } from "react";

import { cmsSiteContent } from "./site.generated";

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

export type CoreHomepageSection = {
  key: CoreHomepageSectionKey;
  title: string;
  eyebrow: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  backgroundImageUrl: string;
};

type CmsHomepageBlock = {
  title?: unknown;
  settings?: unknown;
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
      title: key === "atlas" ? "Литературная планета" : textValue(block.title),
      eyebrow: textValue(settings.eyebrow),
      description:
        textValue(settings.description) || textValue(settings.copy),
      buttonText: textValue(settings.buttonText),
      buttonUrl: textValue(settings.buttonUrl),
      backgroundImageUrl: textValue(block.backgroundImageUrl),
    };
  }
  return null;
}

export function coreHomepageSectionClass(section: CoreHomepageSection | null) {
  return section?.backgroundImageUrl
    ? " cms-core-editable has-cms-background"
    : "";
}

export function coreHomepageSectionStyle(
  section: CoreHomepageSection | null
): CSSProperties | undefined {
  return section?.backgroundImageUrl
    ? ({
        "--cms-core-background": `url(${JSON.stringify(
          section.backgroundImageUrl
        )})`,
      } as CSSProperties)
    : undefined;
}
