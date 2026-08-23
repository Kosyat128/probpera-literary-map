import type {
  Country,
  CountryEnglishTranslationProfile,
} from "./countries/types";

const publishableStatuses = new Set(["reviewed", "verified"]);
const publishableMethods = new Set([
  "editorial-original",
  "human-translation",
  "machine-translation",
]);
const interfaceLanguageStorageKey = "probpera-interface-language";
const activeCountryProxyCache = new WeakMap<Country, Country>();

export function selectCountryEnglishTranslation(country: Country) {
  const translation = country.translations?.en;
  if (!translation) return null;
  if (translation.locale !== "en") return null;
  if (!publishableStatuses.has(translation.status)) return null;
  if (!publishableMethods.has(translation.method)) return null;
  if (!translation.sourceHash?.trim()) return null;
  return translation as CountryEnglishTranslationProfile;
}

export function countryForLanguage(
  country: Country,
  language: "ru" | "en"
): Country {
  if (language !== "en") return country;
  const translation = selectCountryEnglishTranslation(country);
  if (!translation) return country;
  return {
    ...country,
    ...translation.fields,
    translations: country.translations,
    writers: country.writers,
    id: country.id,
    code: country.code,
    flag: country.flag,
    coordinates: country.coordinates,
    nobel: country.nobel,
    places: country.places,
    influence: country.influence,
  };
}

export function activeCountryInterfaceLanguage(): "ru" | "en" {
  try {
    if (
      typeof window !== "undefined" &&
      window.localStorage.getItem(interfaceLanguageStorageKey) === "en"
    ) {
      return "en";
    }
  } catch {
    // localStorage can be denied by privacy settings. The Russian source is
    // the deterministic and publication-safe fallback.
  }
  if (
    typeof document !== "undefined" &&
    document.documentElement.lang.toLocaleLowerCase("en").startsWith("en")
  ) {
    return "en";
  }
  return "ru";
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
  if (resolveLanguage === activeCountryInterfaceLanguage) {
    const cached = activeCountryProxyCache.get(country);
    if (cached) return cached;
  }

  const proxy = new Proxy(country, {
    get(target, property, receiver) {
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

  if (resolveLanguage === activeCountryInterfaceLanguage) {
    activeCountryProxyCache.set(country, proxy);
  }
  return proxy;
}
