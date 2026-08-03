import { countries } from "../src/data/countries/index";
import { calculateArchiveStatistics } from "../src/data/archiveStatistics";
import { buildBookArchive } from "../src/data/bookArchive";
import { auditCountryArchive } from "../src/data/countries/editorialAudit";

export const archiveCountries = countries;
export const archiveBooks = buildBookArchive(countries);
export const archiveStatistics = calculateArchiveStatistics(countries);
export const countryEditorialAudit = auditCountryArchive(countries);
