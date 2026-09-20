import { PLANET_MASCOT_ROUTES, type PlanetMascotRoute } from "./planetMascotRoutes";

export const BOOKY_PREFERENCE_KEY = "probpera-booky-adult-v1";
export const BOOKY_PREFERENCE_MAX_LENGTH = 1_024;
export type BookySavedTour = Readonly<{ route: PlanetMascotRoute; stepId: string }>;
export type BookyPreference = Readonly<{
  schemaVersion: 1;
  audience: "adult";
  visible: boolean;
  resume: BookySavedTour | null;
}>;
export const DEFAULT_BOOKY_PREFERENCE: BookyPreference = Object.freeze({
  schemaVersion: 1, audience: "adult", visible: false, resume: null,
});

function plainData(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key))) return null;
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
    result[key] = descriptor.value;
  }
  return result;
}

/** Local adult UI preference only: never restores selection, permission,
 * completed reading, a camera pose or a child profile. Returns detached data. */
export function parseBookyPreference(input: unknown): BookyPreference | null {
  try {
    let value = input;
    if (typeof value === "string") {
      if (!value.length || value.length > BOOKY_PREFERENCE_MAX_LENGTH) return null;
      value = JSON.parse(value);
    }
    const record = plainData(value, ["schemaVersion", "audience", "visible", "resume"]);
    if (!record || record.schemaVersion !== 1 || record.audience !== "adult" || typeof record.visible !== "boolean") return null;
    let resume: BookySavedTour | null = null;
    if (record.resume !== null) {
      if (!record.visible) return null;
      const tour = plainData(record.resume, ["route", "stepId"]);
      if (!tour || (tour.route !== "overview" && tour.route !== "country-to-book") || typeof tour.stepId !== "string"
        || !PLANET_MASCOT_ROUTES[tour.route].steps.some(step => step.id === tour.stepId)) return null;
      resume = Object.freeze({ route: tour.route, stepId: tour.stepId });
    }
    return Object.freeze({ schemaVersion: 1, audience: "adult", visible: record.visible, resume });
  } catch { return null; }
}

export function serializeBookyPreference(value: unknown): string | null {
  const valid = parseBookyPreference(value);
  return valid ? JSON.stringify(valid) : null;
}
