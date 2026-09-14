import type {
  Country,
  CountryEnglishTranslationProfile,
} from "./countries/types";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { COUNTRY_CAPITAL_REVIEW_HASH_CONTRACT, normalizeCountryCapitalEditorialReview } from "./countryCapitalReview.mjs";

const publishableStatuses = new Set(["reviewed", "verified"]);
const publishableMethods = new Set([
  "editorial-original",
  "human-translation",
  "machine-translation",
]);
const interfaceLanguageStorageKey = "probpera-interface-language";
const activeCountryProxyCache = new WeakMap<Country, Country>();
const canonicalCountrySources = new WeakMap<Country, Country>();

function canonicalCountrySource(country: Country): Country {
  return canonicalCountrySources.get(country) ?? country;
}

function capitalReviewHash(country: Country, locale: "ru" | "en"): string | null {
  const source = canonicalCountrySource(country);
  const text = locale === "ru" ? source.capital : source.translations?.en?.fields?.capital;
  if (typeof source.id !== "string" || !source.id.trim() || source.id.length > 256
    || (source.code !== undefined && typeof source.code !== "string")
    || typeof text !== "string" || !text.trim() || text.length > 200) return null;
  // Fixed field order and exact text bytes are part of this immutable contract.
  // Neither observed hashes nor the legacy generation hash are written back.
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify({ hashContract: COUNTRY_CAPITAL_REVIEW_HASH_CONTRACT,
    countryId: source.id, countryCode: source.code ?? null, field: "capital", locale, text }))));
}

export function countryCapitalReviewSourceHash(country: Country): string | null {
  return capitalReviewHash(country, "ru");
}

export function countryCapitalReviewTargetHash(country: Country): string | null {
  return capitalReviewHash(country, "en");
}

/** One capital selector for raw catalogs, snapshots and stable live proxies.
 * A generated or stale English value never falls back to the Russian capital. */
export function selectCountryCapital(country: Country, language: "ru" | "en"): string | null {
  const source = canonicalCountrySource(country);
  if (language === "ru") return typeof source.capital === "string" && source.capital.trim() ? source.capital : null;
  if (language !== "en") return null;
  const translation = source.translations?.en;
  const capital = translation?.fields?.capital;
  if (!translation || translation.locale !== "en" || !publishableStatuses.has(translation.status)
    || !publishableMethods.has(translation.method) || typeof capital !== "string" || !capital.trim()
    || capital !== capital.trim() || capital.length > 200 || /[\u0000-\u001f\u007f<>]/u.test(capital)
    || !/\p{Script=Latin}/u.test(capital)
    || [...capital].some(character => /\p{L}/u.test(character) && !/\p{Script=Latin}/u.test(character))) return null;
  const review = normalizeCountryCapitalEditorialReview(translation.capitalEditorialReview);
  if (!review || review.decision !== "approved" || review.sourceHash !== countryCapitalReviewSourceHash(source)
    || review.targetHash !== countryCapitalReviewTargetHash(source)) return null;
  return capital;
}

type InterfaceLanguageCandidate = string | null | undefined;

function normalizedInterfaceLanguage(
  value: InterfaceLanguageCandidate
): "ru" | "en" | null {
  const normalized = String(value || "").trim().toLocaleLowerCase("en");
  if (normalized === "ru" || normalized.startsWith("ru-")) return "ru";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return null;
}

export function resolveActiveCountryInterfaceLanguage(input: {
  appliedLanguage?: InterfaceLanguageCandidate;
  routeLanguage?: InterfaceLanguageCandidate;
  storedLanguage?: InterfaceLanguageCandidate;
  documentLanguage?: InterfaceLanguageCandidate;
}): "ru" | "en" {
  return (
    normalizedInterfaceLanguage(input.appliedLanguage) ||
    normalizedInterfaceLanguage(input.routeLanguage) ||
    normalizedInterfaceLanguage(input.storedLanguage) ||
    normalizedInterfaceLanguage(input.documentLanguage) ||
    "ru"
  );
}

export function selectCountryEnglishTranslation(country: Country) {
  const translation = canonicalCountrySource(country).translations?.en;
  if (!translation) return null;
  if (translation.locale !== "en") return null;
  if (!publishableStatuses.has(translation.status)) return null;
  if (!publishableMethods.has(translation.method)) return null;
  if (typeof translation.sourceHash !== "string" || !translation.sourceHash.trim()) return null;
  return translation as CountryEnglishTranslationProfile;
}

export function countryForLanguage(
  country: Country,
  language: "ru" | "en"
): Country {
  const source = canonicalCountrySource(country);
  if (language !== "en") return source;
  const translation = selectCountryEnglishTranslation(source);
  const capital = selectCountryCapital(source, "en");
  if (!translation && source.capital === undefined && capital === null) return source;
  const localized: Country = {
    ...source,
    ...translation?.fields,
    capital: capital ?? undefined,
    translations: source.translations,
    writers: source.writers,
    id: source.id,
    code: source.code,
    flag: source.flag,
    coordinates: source.coordinates,
    nobel: source.nobel,
    places: source.places,
    influence: source.influence,
  };
  canonicalCountrySources.set(localized, source);
  return localized;
}

export function activeCountryInterfaceLanguage(): "ru" | "en" {
  let storedLanguage = "";
  try {
    if (typeof window !== "undefined") {
      storedLanguage =
        window.localStorage.getItem(interfaceLanguageStorageKey) || "";
    }
  } catch {
    // localStorage can be denied by privacy settings. Route/document state
    // remains the deterministic publication-safe fallback.
  }

  const root =
    typeof document !== "undefined" ? document.documentElement : null;
  return resolveActiveCountryInterfaceLanguage({
    // Once InterfaceLanguage has applied a choice, it is the live source of
    // truth. Before that first effect, an explicit route beats stale storage.
    appliedLanguage: root?.dataset.language,
    routeLanguage: root?.dataset.routeLanguage,
    storedLanguage,
    documentLanguage: root?.lang,
  });
}

/**
 * Presents one immutable editorial country record through the language that
 * is currently selected by the visitor. InterfaceLanguage already rerenders
 * consumers when the preference changes; reading through this proxy makes the
 * same render receive the reviewed English profile without duplicating the
 * large country archive in React state.
 */
export function countryWithActiveLanguage(
  country: Country,
  resolveLanguage: () => "ru" | "en" = activeCountryInterfaceLanguage
): Country {
  country = canonicalCountrySource(country);
  if (resolveLanguage === activeCountryInterfaceLanguage) {
    const cached = activeCountryProxyCache.get(country);
    if (cached) return cached;
  }

  const proxy = new Proxy(country, {
    get(target, property, receiver) {
      if (property === "capital") return selectCountryCapital(target, resolveLanguage()) ?? undefined;
      if (resolveLanguage() === "en" && typeof property === "string") {
        const translation = selectCountryEnglishTranslation(target);
        if (
          translation &&
          Object.prototype.hasOwnProperty.call(translation.fields, property)
        ) {
          return translation.fields[
            property as keyof CountryEnglishTranslationProfile["fields"]
          ];
        }
      }
      return Reflect.get(target, property, receiver);
    },
    has(target, property) {
      if (property === "capital") return selectCountryCapital(target, resolveLanguage()) !== null;
      if (resolveLanguage() === "en" && typeof property === "string") {
        const translation = selectCountryEnglishTranslation(target);
        if (
          translation &&
          Object.prototype.hasOwnProperty.call(translation.fields, property)
        ) {
          return true;
        }
      }
      return Reflect.has(target, property);
    },
  }) as Country;
  canonicalCountrySources.set(proxy, country);

  if (resolveLanguage === activeCountryInterfaceLanguage) {
    activeCountryProxyCache.set(country, proxy);
  }
  return proxy;
}
