import type { CSSProperties } from "react";

import {
  bookSceneArchetypes,
  type BookSceneArchetype,
  type BookSceneOwnerOverride,
} from "./bookSceneThemes";

export const bookScenePresetIds = [
  "dynamic",
  "violet-library",
  "warm-paper",
  "museum-ivory",
  "midnight-archive",
  "amber-reading-room",
  "orange-violet-twilight",
  "ink-room",
  "deep-blue-study",
  "muted-green-library",
  "burgundy-edition",
  "charcoal-gallery",
  "cream-publishing-room",
] as const;

export const bookSceneAmbientTints = [
  "theme",
  "probpera-violet",
  "warm-amber",
  "deep-blue",
  "muted-green",
  "burgundy",
  "neutral-ivory",
] as const;

export const bookSceneShelfMaterials = [
  "dark-walnut",
  "smoked-oak",
  "ink-lacquer",
  "museum-brass",
] as const;

export type BookScenePresetId = (typeof bookScenePresetIds)[number];
export type BookSceneAmbientTint = (typeof bookSceneAmbientTints)[number];
export type BookSceneShelfMaterial = (typeof bookSceneShelfMaterials)[number];

export type BookArchiveSceneSettings = {
  bookScenePreset: BookScenePresetId;
  bookSceneDarkness: number;
  bookSceneDynamicThemes: boolean;
  bookSceneIntensity: number;
  bookSceneAmbientTint: BookSceneAmbientTint;
  bookSceneShelfMaterial: BookSceneShelfMaterial;
};

export const bookArchiveSceneSettingKeys = [
  "bookScenePreset",
  "bookSceneDarkness",
  "bookSceneDynamicThemes",
  "bookSceneIntensity",
  "bookSceneAmbientTint",
  "bookSceneShelfMaterial",
] as const satisfies readonly (keyof BookArchiveSceneSettings)[];

export const defaultBookArchiveSceneSettings: Readonly<BookArchiveSceneSettings> =
  Object.freeze({
    bookScenePreset: "dynamic",
    bookSceneDarkness: 42,
    bookSceneDynamicThemes: true,
    bookSceneIntensity: 72,
    bookSceneAmbientTint: "theme",
    bookSceneShelfMaterial: "dark-walnut",
  });

const presetArchetypes: Readonly<Record<Exclude<BookScenePresetId, "dynamic">, BookSceneArchetype>> = {
  "violet-library": "VIOLET LIBRARY",
  "warm-paper": "WARM PAPER",
  "museum-ivory": "MUSEUM IVORY",
  "midnight-archive": "MIDNIGHT ARCHIVE",
  "amber-reading-room": "AMBER READING ROOM",
  "orange-violet-twilight": "ORANGE VIOLET TWILIGHT",
  "ink-room": "INK ROOM",
  "deep-blue-study": "DEEP BLUE STUDY",
  "muted-green-library": "MUTED GREEN LIBRARY",
  "burgundy-edition": "BURGUNDY EDITION",
  "charcoal-gallery": "CHARCOAL GALLERY",
  "cream-publishing-room": "CREAM PUBLISHING ROOM",
};

const ambientTintColors: Readonly<Record<BookSceneAmbientTint, string>> = {
  theme: "currentColor",
  "probpera-violet": "#6810C9",
  "warm-amber": "#D99A5E",
  "deep-blue": "#24506A",
  "muted-green": "#456154",
  burgundy: "#6B263A",
  "neutral-ivory": "#D8CBB5",
};

const shelfMaterialValues: Readonly<
  Record<BookSceneShelfMaterial, { color: string; roughness: number }>
> = {
  "dark-walnut": { color: "#3B251D", roughness: 0.72 },
  "smoked-oak": { color: "#40362E", roughness: 0.8 },
  "ink-lacquer": { color: "#211C25", roughness: 0.34 },
  "museum-brass": { color: "#6A5134", roughness: 0.46 },
};

function plainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeSetting<Key extends keyof BookArchiveSceneSettings>(
  key: Key,
  value: unknown
): BookArchiveSceneSettings[Key] | null {
  if (key === "bookScenePreset") {
    return (bookScenePresetIds.includes(value as never) ? value : null) as
      | BookArchiveSceneSettings[Key]
      | null;
  }
  if (key === "bookSceneAmbientTint") {
    return (bookSceneAmbientTints.includes(value as never) ? value : null) as
      | BookArchiveSceneSettings[Key]
      | null;
  }
  if (key === "bookSceneShelfMaterial") {
    return (bookSceneShelfMaterials.includes(value as never) ? value : null) as
      | BookArchiveSceneSettings[Key]
      | null;
  }
  if (key === "bookSceneDynamicThemes") {
    return (typeof value === "boolean" ? value : null) as
      | BookArchiveSceneSettings[Key]
      | null;
  }
  const maximum = key === "bookSceneDarkness" ? 90 : 100;
  return (typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= maximum
    ? value
    : null) as BookArchiveSceneSettings[Key] | null;
}

export function readBookArchiveSceneSettings(value: unknown) {
  if (!plainRecord(value)) return {};
  return Object.fromEntries(
    bookArchiveSceneSettingKeys.flatMap((key) => {
      const setting = safeSetting(key, value[key]);
      return setting === null ? [] : [[key, setting]];
    })
  ) as Partial<BookArchiveSceneSettings>;
}

export function resolveBookArchiveSceneSettings(value: unknown): BookArchiveSceneSettings {
  return {
    ...defaultBookArchiveSceneSettings,
    ...readBookArchiveSceneSettings(value),
  };
}

export function bookSceneOwnerOverrideFromSettings(
  value: unknown
): BookSceneOwnerOverride | null {
  const settings = resolveBookArchiveSceneSettings(value);
  if (settings.bookScenePreset === "dynamic") return null;
  const archetype = presetArchetypes[settings.bookScenePreset];
  return bookSceneArchetypes.includes(archetype) ? { archetype } : null;
}

export const bookArchiveSceneCssVariables = [
  "--book-scene-darkness",
  "--book-scene-theme-intensity",
  "--book-scene-ambient-tint",
  "--book-scene-material-color",
  "--book-scene-material-roughness",
] as const;

export function bookArchiveSceneCssProperties(value: unknown) {
  const settings = resolveBookArchiveSceneSettings(value);
  const material = shelfMaterialValues[settings.bookSceneShelfMaterial];
  return {
    "--book-scene-darkness": String(settings.bookSceneDarkness / 100),
    "--book-scene-theme-intensity": String(settings.bookSceneIntensity / 100),
    "--book-scene-ambient-tint": ambientTintColors[settings.bookSceneAmbientTint],
    "--book-scene-material-color": material.color,
    "--book-scene-material-roughness": String(material.roughness),
  } as CSSProperties &
    Record<(typeof bookArchiveSceneCssVariables)[number], string>;
}
