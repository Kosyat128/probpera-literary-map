import { BOOKY_ROUTE_HISTORIES, isBookyRoute, migrateBookyRouteState, type BookyTourProgress } from "./bookyTourProgress";
import { type PlanetMascotRoute } from "./planetMascotRoutes";

/** Keep the historical storage key so a version upgrade finds existing data. */
export const BOOKY_PREFERENCE_KEY = "probpera-booky-adult-v1";
export const BOOKY_PREFERENCE_MAX_LENGTH = 1_024;
export type { BookyTourProgress } from "./bookyTourProgress";
export type BookySavedTour = Readonly<{ route: PlanetMascotRoute; routeVersion: number; stepId: string }>;
export type BookyPreference = Readonly<{
  schemaVersion: 2;
  audience: "adult";
  visible: boolean;
  resume: BookySavedTour | null;
  progress: readonly BookyTourProgress[];
}>;
export const DEFAULT_BOOKY_PREFERENCE: BookyPreference = Object.freeze({
  schemaVersion: 2, audience: "adult", visible: false, resume: null, progress: Object.freeze([]),
});

export class BookyPreferenceUnsupportedError extends Error {
  constructor() {
    super("booky-preference-unsupported");
    this.name = "BookyPreferenceUnsupportedError";
  }
}

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

/** Inspect data properties without executing untrusted accessors. */
function dataField(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function plainArray(value: unknown, limit: number): readonly unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > limit
    || Reflect.ownKeys(descriptors).length !== length + 1) return null;
  const result: unknown[] = [];
  for (let index = 0; index < length; ++index) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
    result.push(descriptor.value);
  }
  return result;
}

function readInput(input: unknown): unknown {
  if (typeof input !== "string") return input;
  if (!input.length || input.length > BOOKY_PREFERENCE_MAX_LENGTH) return null;
  return JSON.parse(input);
}

function unsupportedRoute(value: unknown): boolean {
  const route = dataField(value, "route"), version = dataField(value, "routeVersion");
  if (typeof route !== "string" || !route.length) return false;
  if (!isBookyRoute(route)) return true;
  return Number.isSafeInteger(version) && (version as number) > 0
    && !BOOKY_ROUTE_HISTORIES[route].versions.some(known => known.version === version);
}

/** Preserve records that this application cannot safely interpret. This is a
 * write-protection classification, never a source of UI labels or permissions. */
export function isUnsupportedBookyPreference(input: unknown): boolean {
  try {
    // A future record may outgrow today's bounded codec. Do not truncate it or
    // allow an ordinary visibility toggle to overwrite those unknown bytes.
    if (typeof input === "string" && input.length > BOOKY_PREFERENCE_MAX_LENGTH) return true;
    const value = readInput(input), schemaVersion = dataField(value, "schemaVersion");
    if (Number.isSafeInteger(schemaVersion) && (schemaVersion as number) > 2) return true;
    if (schemaVersion !== 1 && schemaVersion !== 2) return false;
    if (unsupportedRoute(dataField(value, "resume"))) return true;
    const progress = dataField(value, "progress");
    if (!Array.isArray(progress)) return false;
    const length = dataField(progress, "length");
    if (!Number.isSafeInteger(length) || (length as number) > BOOKY_PREFERENCE_MAX_LENGTH) return true;
    for (let index = 0; index < (length as number); ++index) {
      if (unsupportedRoute(dataField(progress, String(index)))) return true;
    }
    return false;
  } catch { return false; }
}

export type DecodedBookyPreference = Readonly<{
  value: BookyPreference;
  sourceSchemaVersion: 1 | 2;
  migrated: boolean;
}>;

/** Local adult UI preference only. A cursor never proves that any step was
 * acknowledged; restore never grants navigation or content permissions. */
export function decodeBookyPreference(input: unknown): DecodedBookyPreference | null {
  try {
    const value = readInput(input), sourceSchemaVersion = dataField(value, "schemaVersion");
    if (sourceSchemaVersion !== 1 && sourceSchemaVersion !== 2) return null;
    const record = plainData(value, sourceSchemaVersion === 1
      ? ["schemaVersion", "audience", "visible", "resume"]
      : ["schemaVersion", "audience", "visible", "resume", "progress"]);
    if (!record || record.audience !== "adult" || typeof record.visible !== "boolean") return null;
    let resume: BookySavedTour | null = null;
    if (record.resume !== null) {
      // Preserve the strict v1 contract; only v2 separates hiding from resume.
      if (sourceSchemaVersion === 1 && !record.visible) return null;
      const tour = plainData(record.resume, sourceSchemaVersion === 1 ? ["route", "stepId"] : ["route", "routeVersion", "stepId"]);
      if (!tour || !isBookyRoute(tour.route) || typeof tour.stepId !== "string") return null;
      const routeVersion = sourceSchemaVersion === 1 ? 1 : tour.routeVersion;
      if (!Number.isSafeInteger(routeVersion)) return null;
      resume = { route: tour.route, routeVersion: routeVersion as number, stepId: tour.stepId };
    }
    const progress: BookyTourProgress[] = [];
    if (sourceSchemaVersion === 2) {
      const maximumRecords = Object.values(BOOKY_ROUTE_HISTORIES).reduce((count, history) => count + history.versions.length, 0);
      const records = plainArray(record.progress, maximumRecords);
      if (!records) return null;
      for (const entry of records) {
        const item = plainData(entry, ["route", "routeVersion", "acknowledgedStepIds"]);
        if (!item || !isBookyRoute(item.route) || !Number.isSafeInteger(item.routeVersion)) return null;
        const version = BOOKY_ROUTE_HISTORIES[item.route].versions.find(known => known.version === item.routeVersion);
        if (!version) return null;
        const ids = plainArray(item.acknowledgedStepIds, version.stepIds.length);
        if (!ids || ids.some(id => typeof id !== "string" || !version.stepIds.includes(id))
          || new Set(ids).size !== ids.length) return null;
        progress.push({ route: item.route, routeVersion: item.routeVersion as number, acknowledgedStepIds: ids as string[] });
      }
    }
    let migrated = sourceSchemaVersion === 1;
    const normalized: BookyTourProgress[] = [];
    for (const route of Object.keys(BOOKY_ROUTE_HISTORIES) as PlanetMascotRoute[]) {
      const routeState = migrateBookyRouteState({ resume: resume?.route === route ? resume : null,
        progress: progress.filter(item => item.route === route) }, BOOKY_ROUTE_HISTORIES[route]);
      if (!routeState) return null;
      if (routeState.resume) resume = Object.freeze({ route, ...routeState.resume });
      for (const item of routeState.progress) normalized.push(Object.freeze({ route, ...item }));
      migrated ||= routeState.migrated;
    }
    const preference: BookyPreference = Object.freeze({ schemaVersion: 2, audience: "adult", visible: record.visible,
      resume, progress: Object.freeze(normalized) });
    if (JSON.stringify(preference).length > BOOKY_PREFERENCE_MAX_LENGTH) return null;
    return Object.freeze({ value: preference, sourceSchemaVersion, migrated });
  } catch { return null; }
}

export function parseBookyPreference(input: unknown): BookyPreference | null {
  return decodeBookyPreference(input)?.value ?? null;
}

export function serializeBookyPreference(value: unknown): string | null {
  const valid = parseBookyPreference(value);
  return valid ? JSON.stringify(valid) : null;
}
