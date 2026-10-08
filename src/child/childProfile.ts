/** Local metadata only. Decoding does not verify a parent, restore a mode,
 * authorize content or access an adult/child history, index or cache. */
export const CHILD_PROFILE_SCHEMA_VERSION = 1;
export const CHILD_PROFILE_LIMIT = 4;
export const CHILD_PROFILE_MAX_LENGTH = 65_536;
export type ChildAgeBand = "3-5" | "6-8" | "9-11" | "12-14" | "15-17";
export type ChildReadingLevel = "plain" | "developing" | "fluent";
export type ChildLocalePolicy = Readonly<{ schemaVersion: 1; allowedLocales: readonly ("ru" | "en")[] }>;
export type LocalChildProfile = Readonly<{
  id: string;
  label: string;
  exactAge: number;
  ageBand: ChildAgeBand;
  locale: "ru" | "en";
  ageConfirmedAt: string;
  readingLevel: ChildReadingLevel | null;
  allowedTopics: readonly string[] | null;
  blockedTopics: readonly string[];
  soundEnabled: boolean;
  motion: "calm" | "system";
  narrationEnabled: boolean;
  /** A missing lock is unknown; secondary child locales require explicit false. */
  localeLocked?: boolean;
  /** Written only by a parent setting. Legacy absence stays current-locale only. */
  localePolicy?: ChildLocalePolicy;
}>;
export type ChildProfileRegistry = Readonly<{
  schemaVersion: 1;
  policyVersion: string;
  activeProfileId: string | null;
  profiles: readonly LocalChildProfile[];
}>;
export type ChildProfilesDecoded = Readonly<{
  registry: ChildProfileRegistry | null;
  error: "missing" | "invalid" | "unsupported" | "policy-mismatch" | null;
}>;

export function isChildExactAge(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 3 && value <= 17;
}
export function childAgeBand(value: unknown): ChildAgeBand | null {
  if (!isChildExactAge(value)) return null;
  return value <= 5 ? "3-5" : value <= 8 ? "6-8" : value <= 11 ? "9-11" : value <= 14 ? "12-14" : "15-17";
}

function dataObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") return null;
    const descriptor = descriptors[key];
    if (!descriptor.enumerable || !("value" in descriptor)) return null;
    copy[key] = descriptor.value;
  }
  return copy;
}
function exact(data: Record<string, unknown>, fields: readonly string[]): boolean {
  return Object.keys(data).length === fields.length && fields.every(key => Object.prototype.hasOwnProperty.call(data, key));
}
function dataArray(value: unknown, limit: number): readonly unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value as object);
  const length = descriptors.length?.value;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > limit
    || Reflect.ownKeys(descriptors).length !== length + 1) return null;
  const copy: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return null;
    copy.push(descriptor.value);
  }
  return copy;
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/u.test(value);
}
function topics(value: unknown): readonly string[] | null {
  const items = dataArray(value, 64);
  if (!items || items.some(item => typeof item !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(item))
    || new Set(items).size !== items.length) return null;
  return Object.freeze(items as string[]);
}
/** Pure descriptor validation, not parent authentication or child admission. */
export function decodeChildLocalePolicy(value: unknown, currentLocale: unknown): ChildLocalePolicy | null {
  try {
    const row = dataObject(value), allowed = row && dataArray(row.allowedLocales, 2);
    if (currentLocale !== "ru" && currentLocale !== "en" || !row || !exact(row, ["schemaVersion", "allowedLocales"])
      || row.schemaVersion !== 1 || !allowed || !allowed.length
      || allowed.some(locale => locale !== "ru" && locale !== "en") || new Set(allowed).size !== allowed.length
      || !allowed.includes(currentLocale)) return null;
    return Object.freeze({ schemaVersion: 1, allowedLocales: Object.freeze(allowed as ("ru" | "en")[]) });
  } catch { return null; }
}
export function sameChildLocalePolicy(a: ChildLocalePolicy | undefined, b: ChildLocalePolicy | undefined): boolean {
  return !!a && !!b && a.schemaVersion === b.schemaVersion && a.allowedLocales.length === b.allowedLocales.length
    && a.allowedLocales.every((locale, index) => locale === b.allowedLocales[index]);
}
/** Current-only legacy fallback is ephemeral; it does not upgrade stored data. */
export function childProfileAllowsLocale(value: unknown, locale: unknown): boolean {
  try {
    const row = dataObject(value);
    if (!row || row.locale !== "ru" && row.locale !== "en" || locale !== "ru" && locale !== "en"
      || Object.prototype.hasOwnProperty.call(row, "localeLocked") && typeof row.localeLocked !== "boolean") return false;
    const hasPolicy = Object.prototype.hasOwnProperty.call(row, "localePolicy");
    const policy = hasPolicy ? decodeChildLocalePolicy(row.localePolicy, row.locale) : null;
    if (hasPolicy && !policy) return false;
    return locale === row.locale || row.localeLocked === false && !!policy?.allowedLocales.includes(locale);
  } catch { return false; }
}
const profileFields = ["id", "label", "exactAge", "locale", "ageConfirmedAt", "readingLevel", "allowedTopics",
  "blockedTopics", "soundEnabled", "motion", "narrationEnabled"];
function profile(value: unknown, now: number): LocalChildProfile | null {
  const data = dataObject(value);
  if (!data) return null;
  const hasLocaleLock = Object.prototype.hasOwnProperty.call(data, "localeLocked");
  const hasLocalePolicy = Object.prototype.hasOwnProperty.call(data, "localePolicy");
  const fields = [...profileFields, ...(Object.prototype.hasOwnProperty.call(data, "ageBand") ? ["ageBand"] : []),
    ...(hasLocaleLock ? ["localeLocked"] : []), ...(hasLocalePolicy ? ["localePolicy"] : [])];
  if (!exact(data, fields) || !identifier(data.id)
    || typeof data.label !== "string" || data.label.length < 1 || data.label.length > 80
    || data.label.trim() !== data.label || /[\u0000-\u001f\u007f]/u.test(data.label)
    || !isChildExactAge(data.exactAge)
    || Object.prototype.hasOwnProperty.call(data, "ageBand") && data.ageBand !== childAgeBand(data.exactAge)
    || data.locale !== "ru" && data.locale !== "en"
    || typeof data.ageConfirmedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(data.ageConfirmedAt)
    || new Date(data.ageConfirmedAt).toISOString() !== data.ageConfirmedAt
    || Date.parse(data.ageConfirmedAt) > now
    || data.readingLevel !== null && data.readingLevel !== "plain" && data.readingLevel !== "developing" && data.readingLevel !== "fluent"
    || typeof data.soundEnabled !== "boolean" || typeof data.narrationEnabled !== "boolean"
    || hasLocaleLock && typeof data.localeLocked !== "boolean"
    || data.motion !== "calm" && data.motion !== "system") return null;
  const localePolicy = hasLocalePolicy ? decodeChildLocalePolicy(data.localePolicy, data.locale) : null;
  if (hasLocalePolicy && !localePolicy) return null;
  const blockedTopics = topics(data.blockedTopics);
  const allowedTopics = data.allowedTopics === null ? null : topics(data.allowedTopics);
  if (!blockedTopics || data.allowedTopics !== null && !allowedTopics) return null;
  return Object.freeze({ id: data.id, label: data.label, exactAge: data.exactAge, ageBand: childAgeBand(data.exactAge)!,
    locale: data.locale, ageConfirmedAt: data.ageConfirmedAt, readingLevel: data.readingLevel, allowedTopics, blockedTopics,
    soundEnabled: data.soundEnabled, motion: data.motion, narrationEnabled: data.narrationEnabled,
    ...(hasLocaleLock ? { localeLocked: data.localeLocked as boolean } : {}), ...(localePolicy ? { localePolicy } : {}) });
}

/** Strict restoration seam for future local adapters. Invalid/missing/newer
 * data has no registry; callers must keep startup sealed, never infer adult
 * access. No age-reconfirmation interval or parent verification is invented.
 * IDs are restored unchanged; their generation belongs to a gated create flow.
 * The accepted metadata excludes birth dates, contacts, photos and tracking IDs. */
export function decodeChildProfiles(input: unknown, context: Readonly<{ policyVersion: string; now: number }>): ChildProfilesDecoded {
  const fail = (error: Exclude<ChildProfilesDecoded["error"], null>): ChildProfilesDecoded => Object.freeze({ registry: null, error });
  try {
    const environment = dataObject(context);
    if (!environment || !exact(environment, ["policyVersion", "now"]) || !identifier(environment.policyVersion)
      || typeof environment.now !== "number" || !Number.isSafeInteger(environment.now) || environment.now < 0
      || environment.now > 8_640_000_000_000_000) return fail("invalid");
    if (input === null) return fail("missing");
    let value = input;
    if (typeof value === "string") {
      if (value.length > CHILD_PROFILE_MAX_LENGTH) return fail("invalid");
      value = JSON.parse(value);
    }
    const data = dataObject(value);
    if (!data) return fail("invalid");
    if (typeof data.schemaVersion === "number" && Number.isSafeInteger(data.schemaVersion) && data.schemaVersion > 1) return fail("unsupported");
    if (!exact(data, ["schemaVersion", "policyVersion", "activeProfileId", "profiles"])
      || data.schemaVersion !== CHILD_PROFILE_SCHEMA_VERSION || !identifier(data.policyVersion)) return fail("invalid");
    if (data.policyVersion !== environment.policyVersion) return fail("policy-mismatch");
    const rows = dataArray(data.profiles, CHILD_PROFILE_LIMIT);
    if (!rows) return fail("invalid");
    const profiles: LocalChildProfile[] = [];
    const ids = new Set<string>();
    for (const row of rows) {
      const parsed = profile(row, environment.now);
      if (!parsed || ids.has(parsed.id)) return fail("invalid");
      ids.add(parsed.id); profiles.push(parsed);
    }
    if (data.activeProfileId !== null && (!identifier(data.activeProfileId) || !ids.has(data.activeProfileId))) return fail("invalid");
    const registry: ChildProfileRegistry = Object.freeze({ schemaVersion: 1, policyVersion: data.policyVersion,
      activeProfileId: data.activeProfileId, profiles: Object.freeze(profiles) });
    return Object.freeze({ registry, error: null });
  } catch { return fail("invalid"); }
}
