import { countries } from "../src/data/countries/index";
import { calculateArchiveStatistics } from "../src/data/archiveStatistics";
import { buildBookArchive } from "../src/data/bookArchive";
import { auditCountryArchive } from "../src/data/countries/editorialAudit";
import {
  bookPublicationIssues,
  isPublicBook,
} from "../src/data/bookQuality";
import {
  countBiographySentences,
  isGenericBiographyText,
  legacyWriterBiography,
  normalizeBiographyText,
  selectWriterBiography,
  writerBiographyQualityIssues,
} from "../src/data/writerBiography";
import {
  isWriterBiographyResearchDraftPublishable,
  writerBiographyResearchDraftIssues,
} from "../src/data/countries/writerBiographyResearch";
import { writerBiographyResearchDrafts } from "../src/data/countries/writerBiographyResearchBatches";

export const archiveCountries = countries;
export const archiveBooks = buildBookArchive(countries);
export const archiveRawBooks = buildBookArchive(countries, {
  includeReviewedGenerated: false,
  applyEnrichmentActions: false,
});
export const archiveStatistics = calculateArchiveStatistics(countries);
export const countryEditorialAudit = auditCountryArchive(countries);
export {
  bookPublicationIssues,
  countBiographySentences,
  isGenericBiographyText,
  isPublicBook,
  legacyWriterBiography,
  normalizeBiographyText,
  selectWriterBiography,
  isWriterBiographyResearchDraftPublishable,
  writerBiographyResearchDraftIssues,
  writerBiographyQualityIssues,
};
export { writerBiographyResearchDrafts };
