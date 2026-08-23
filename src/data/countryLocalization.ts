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
