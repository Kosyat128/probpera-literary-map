/**
 * Demand-loaded public catalog entry. These are the existing live-language
 * views, including the separate pre-quarantine source for pending book cards.
 * Consumers retain the exact arrays/proxies already owned by data/countries.
 * Do not import this entry from the initial application shell.
 */
export {
  countries,
  bookArchiveCountries,
  generatedWriterDraftCount,
} from "../data/countries";
export type { Country, Writer } from "./types";
