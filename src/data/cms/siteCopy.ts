import { cmsSiteContent } from "./site.generated";
import { normalizeShortHyphens } from "../../utils/shortHyphens";

export type SiteCopyLocale = "ru" | "en";

type SiteCopySnapshot = Partial<
  Record<SiteCopyLocale, Record<string, unknown>>
>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function resolveSiteCopy(
  snapshot: unknown,
  key: string,
  fallback: string,
  locale: SiteCopyLocale
) {
  const localized = objectValue(objectValue(snapshot)[locale]);
  const candidate = localized[key];
  return normalizeShortHyphens(
    typeof candidate === "string" && candidate.trim()
      ? candidate.trim()
      : fallback
  );
}

const siteCopySnapshot = (
  cmsSiteContent as typeof cmsSiteContent & { siteCopy?: SiteCopySnapshot }
).siteCopy;

export function getSiteCopy(
  key: string,
  fallback: string,
  locale: SiteCopyLocale = "ru"
) {
  return resolveSiteCopy(siteCopySnapshot, key, fallback, locale);
}

export function resolveCountrySiteCopy(
  snapshot: unknown,
  code: string | undefined,
  russianName: string,
  localizedName: string | undefined,
  locale: SiteCopyLocale
) {
  const normalizedCode = (code || "").trim().toUpperCase();
  const key = /^[A-Z]{2}$/u.test(normalizedCode)
    ? `country.${normalizedCode}`
    : `country.${russianName}`;
  const fallback =
    locale === "en" && localizedName?.trim()
      ? localizedName.trim()
      : russianName;
  return resolveSiteCopy(snapshot, key, fallback, locale);
}

export function getCountrySiteCopy(
  code: string | undefined,
  russianName: string,
  localizedName: string | undefined,
  locale: SiteCopyLocale
) {
  return resolveCountrySiteCopy(
    siteCopySnapshot,
    code,
    russianName,
    localizedName,
    locale
  );
}
