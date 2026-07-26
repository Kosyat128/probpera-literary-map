import { countryMetadata } from "./metadata";
import type { CountryMetadata } from "./metadata";

export function getCountryMetadata(countryId: string): CountryMetadata | undefined {
  return countryMetadata[countryId];
}
