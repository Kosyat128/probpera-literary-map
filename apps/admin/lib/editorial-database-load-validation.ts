import { isReadRecord } from "./admin-read-result";
import type { EditorialCatalog } from "./editorial-catalog";
import { countryProfileFieldRules, writerProfileFieldRules } from "./editorial-profile-edit";
import {
  writerBiographyMethods, writerBiographySourceFields, writerBiographySourceRights,
  writerBiographySourceUsages, writerBiographyStatuses,
} from "./writer-biography-edit";

export type EditorialOverrideRead = {
  id: string; country_id: string; writer_id?: string; fields: Record<string, unknown>; updated_at: string;
};
const uuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(value);
const text = (value: unknown): value is string => typeof value === "string";
const timestamp = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
function allowed(value: unknown, choices: readonly string[]) { return text(value) && choices.includes(value.trim()); }
function optionalText(value: unknown) { return value == null || text(value); }
// Inspect the same string view as the existing biography reader. Never return
// that view as data: stored text and the existing consumer remain unchanged.
function biographyTextView(value: string) { return value.replace(/\r\n?/gu, "\n").trim(); }
function biographyText(value: unknown, maximum: number, required = false): value is string {
  if (!text(value)) return false;
  const view = biographyTextView(value);
  return (!required || Boolean(view)) && view.length <= maximum
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(view);
}
function optionalBiographyText(value: unknown, maximum: number) {
  return value == null || biographyText(value, maximum);
}
function optionalChoice(value: unknown, choices: readonly string[]) {
  return value == null || text(value) && (!value.trim() || allowed(value, choices));
}
function date(value: unknown) {
  if (!biographyText(value, 10, true)) return false;
  const view = biographyTextView(value);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(view)) return false;
  const [year, month, day] = view.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}
function optionalDate(value: unknown) {
  return value == null || biographyText(value, 10) && (!biographyTextView(value) || date(value));
}
function https(value: unknown) {
  if (!biographyText(value, 1000, true)) return false;
  const view = biographyTextView(value);
  if (/\s/u.test(view)) return false;
  try { const parsed = new URL(view); return parsed.protocol === "https:" && !parsed.username && !parsed.password; }
  catch { return false; }
}
function optionalHttps(value: unknown) {
  return value == null || biographyText(value, 1000) && (!biographyTextView(value) || https(value));
}

/** The catalog reader remains authoritative; this boundary only checks the returned DTO. */
export function validEditorialCatalogRead(value: unknown): value is EditorialCatalog {
  if (!isReadRecord(value) || value.version !== 1 || !Array.isArray(value.countries)) return false;
  const countryIds = new Set<string>();
  return value.countries.every(country => {
    if (!isReadRecord(country) || !text(country.id) || !country.id.trim() || countryIds.has(country.id)
      || !text(country.label) || !country.label.trim() || !isReadRecord(country.fields) || !Array.isArray(country.writers)) return false;
    countryIds.add(country.id);
    const writerIds = new Set<string>();
    return country.writers.every(writer => {
      if (!isReadRecord(writer) || !text(writer.id) || !writer.id.trim() || writerIds.has(writer.id)
        || !text(writer.label) || !writer.label.trim() || !isReadRecord(writer.fields)) return false;
      writerIds.add(writer.id); return true;
    });
  });
}

function validBiographySource(value: unknown) {
  return isReadRecord(value) && biographyText(value.provider, 240, true) && https(value.url)
    && Array.isArray(value.fields) && value.fields.length > 0 && value.fields.every(field => allowed(field, writerBiographySourceFields))
    && allowed(value.usage, writerBiographySourceUsages) && date(value.retrievedAt)
    && optionalBiographyText(value.author, 300) && optionalBiographyText(value.title, 500)
    && optionalBiographyText(value.licenseName, 300) && optionalHttps(value.licenseUrl)
    && (typeof value.usage === "string" && value.usage.trim() !== "licensed-copy"
      || biographyText(value.licenseName, 300, true) && https(value.licenseUrl));
}
function validBiographyProfile(value: unknown, locale: string) {
  if (!isReadRecord(value) || value.locale !== locale || !biographyText(value.text, 1600)
    || !biographyText(value.sourceLanguage, 80, true) || !allowed(value.status, writerBiographyStatuses)
    || !allowed(value.method, writerBiographyMethods) || !Array.isArray(value.sources)
    || !value.sources.every(validBiographySource)) return false;
  return optionalDate(value.reviewedAt) && optionalBiographyText(value.reviewer, 300)
    && optionalChoice(value.translatedFromLocale, ["ru", "en"])
    && optionalChoice(value.sourceTextRights, writerBiographySourceRights)
    && (value.translationMeta == null || isReadRecord(value.translationMeta)
      && ["model", "reviewerModel", "sourceHash", "generatedAt"].every(key =>
        !Object.hasOwn(value.translationMeta as Record<string, unknown>, key) || optionalText((value.translationMeta as Record<string, unknown>)[key])));
}
function validBiographyMap(value: unknown) {
  // Durable null/empty locale maps and null locales are intentional ownership tombstones.
  return value === null || isReadRecord(value) && Object.entries(value).every(([locale, profile]) =>
    ["ru", "en"].includes(locale) && (profile === null || validBiographyProfile(profile, locale)));
}

function validFields(fields: Record<string, unknown>, entity: "country" | "writer") {
  const rules: Record<string, { kind: string }> = entity === "country" ? countryProfileFieldRules : writerProfileFieldRules;
  return Object.entries(fields).every(([field, value]) => {
    if (entity === "writer" && field === "biographyTranslations") return validBiographyMap(value);
    if (!Object.hasOwn(rules, field)) return true;
    const kind = rules[field].kind;
    if (kind === "integer") return value === null || typeof value === "number" && Number.isSafeInteger(value);
    if (kind === "coordinates") return value === null || isReadRecord(value)
      && typeof value.lat === "number" && Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90
      && typeof value.lng === "number" && Number.isFinite(value.lng) && value.lng >= -180 && value.lng <= 180;
    if (kind === "list") return Array.isArray(value) && value.every(text);
    if (kind === "timeline") return Array.isArray(value) && value.every(row => text(row)
      || isReadRecord(row) && [row.year, row.title, row.description].every(item => item === undefined || text(item) || typeof item === "number" && Number.isFinite(item)));
    return text(value);
  });
}

/** Never replace an unread/malformed override by {} and open a destructive blank editor. */
export function validEditorialOverrideRead(value: unknown, countryId: string, writerId?: string): value is EditorialOverrideRead | null {
  return value === null || isReadRecord(value) && uuid(value.id) && value.country_id === countryId
    && (!writerId || value.writer_id === writerId) && timestamp(value.updated_at) && isReadRecord(value.fields)
    && validFields(value.fields, writerId ? "writer" : "country");
}
