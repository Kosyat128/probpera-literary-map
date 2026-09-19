import { DEFAULT_GLOBE_EDITION_ID, GLOBE_EDITION_BY_ID, isGlobeEditionId, type GlobeEditionId } from "./editions";
import { checkGlobeBackgroundCompatibility, DEFAULT_GLOBE_BACKGROUND_ID, isGlobeBackgroundId, type GlobeBackgroundId } from "./globeBackgrounds";
import { DEFAULT_GLOBE_STAND_ID, isGlobeStandId, type GlobeStandId } from "./globeStands";

export const GLOBE_COMPOSITION_PREFERENCE_KEY = "probpera-planet-composition-v1";
export const GLOBE_COMPOSITION_MAX_LENGTH = 1_024;
export type GlobeCompositionPart = "edition" | "stand" | "background";
export type GlobeCompositionSelection = Readonly<{
  editionId: GlobeEditionId;
  standId: GlobeStandId;
  backgroundId: GlobeBackgroundId;
}>;
export type GlobeCompositionRecord = Readonly<{
  schemaVersion: 1;
  commitId: string;
  selection: GlobeCompositionSelection;
}>;
export type GlobeCompositionEnvironment = Readonly<{ qualityTier: unknown; access: unknown }>;
export const DEFAULT_GLOBE_COMPOSITION_SELECTION: GlobeCompositionSelection = Object.freeze({
  editionId: DEFAULT_GLOBE_EDITION_ID,
  standId: DEFAULT_GLOBE_STAND_ID,
  backgroundId: DEFAULT_GLOBE_BACKGROUND_ID,
});

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor && descriptor.enumerable;
  });
}

/** Only current bundled, available IDs. This is not an entitlement or review grant. */
export function isGlobeCompositionSelection(value: unknown): value is GlobeCompositionSelection {
  try {
    if (!exactRecord(value, ["editionId", "standId", "backgroundId"])) return false;
    return isGlobeEditionId(value.editionId)
      && GLOBE_EDITION_BY_ID[value.editionId].visitorAvailable
      && GLOBE_EDITION_BY_ID[value.editionId].status === "available"
      && isGlobeStandId(value.standId) && isGlobeBackgroundId(value.backgroundId);
  } catch { return false; }
}

export function isGlobeCompositionRecord(value: unknown): value is GlobeCompositionRecord {
  try {
    return exactRecord(value, ["schemaVersion", "commitId", "selection"])
      && value.schemaVersion === 1 && typeof value.commitId === "string"
      && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value.commitId)
      && isGlobeCompositionSelection(value.selection);
  } catch { return false; }
}

export function validateGlobeCompositionSelection(value: unknown, environment: GlobeCompositionEnvironment): value is GlobeCompositionSelection {
  try {
    return isGlobeCompositionSelection(value) && checkGlobeBackgroundCompatibility({
      ...value, qualityTier: environment.qualityTier, access: environment.access,
    }).compatible;
  } catch { return false; }
}

export function copyGlobeCompositionSelection(selection: GlobeCompositionSelection): GlobeCompositionSelection {
  return Object.freeze({ editionId: selection.editionId, standId: selection.standId, backgroundId: selection.backgroundId });
}

/** Bounded local preference codec. Whitespace and property order carry no authority. */
export function parseGlobeComposition(raw: unknown): GlobeCompositionRecord | null {
  if (typeof raw !== "string" || raw.length > GLOBE_COMPOSITION_MAX_LENGTH) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isGlobeCompositionRecord(value)) return null;
    return Object.freeze({ schemaVersion: 1, commitId: value.commitId, selection: copyGlobeCompositionSelection(value.selection) });
  } catch { return null; }
}

export function serializeGlobeComposition(value: unknown): string | null {
  try {
    if (!isGlobeCompositionRecord(value)) return null;
    return JSON.stringify({ schemaVersion: 1, commitId: value.commitId, selection: copyGlobeCompositionSelection(value.selection) });
  } catch { return null; }
}

export function sameGlobeComposition(a: GlobeCompositionSelection, b: GlobeCompositionSelection): boolean {
  return a.editionId === b.editionId && a.standId === b.standId && a.backgroundId === b.backgroundId;
}
