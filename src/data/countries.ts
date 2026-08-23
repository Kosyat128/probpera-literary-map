import {
  bookArchiveCountries as sourceBookArchiveCountries,
  countries as sourceCountries,
  generatedWriterDraftCount,
} from "./countries/index";
import { countryWithActiveLanguage } from "./countryLocalization";

export const countries = sourceCountries.map((country) =>
  countryWithActiveLanguage(country)
);
export const bookArchiveCountries = sourceBookArchiveCountries.map((country) =>
  countryWithActiveLanguage(country)
);
export { generatedWriterDraftCount };
export type { Country, WriterProfile as Writer } from "./countries/types";
