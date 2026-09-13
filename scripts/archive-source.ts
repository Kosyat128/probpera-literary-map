import {
  bookArchiveCountries,
  bookArchiveSourceCountries,
  countries,
  editorialCatalogCountries,
} from "../src/data/countries/index";
import { calculateArchiveStatistics } from "../src/data/archiveStatistics";
import { buildBookArchive } from "../src/data/bookArchive";
import { mergeBookR49nStoweRecovered20260912 } from "../src/data/countries/bookR49nStoweRecovered20260912";
import { mergeBookR49nAlcottDraft20260912 } from "../src/data/countries/bookR49nAlcottDraft20260912";
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
import {
  quarantinedWriterIdentities,
  writerBiographyLegacyCorrections,
  writerIdentityCorrections,
} from "../src/data/countries/writerBiographyLegacyCorrections";

export const archiveCountries = countries;
// Keep the book's author identity available to the private editorial tools.
// Its separate public biography remains subject to the existing writer review.
export const archiveEditorialCatalogCountries =
  mergeBookR49nAlcottDraft20260912(
    mergeBookR49nStoweRecovered20260912(editorialCatalogCountries)
  );
export const archiveBooks = buildBookArchive(bookArchiveCountries);
// Classification and historical identity merges consume the pre-R49N source.
// The current public catalogue above includes the complete retained package.
export const archiveRawBooks = buildBookArchive(bookArchiveSourceCountries, {
  includeReviewedGenerated: false,
  includeR49nCatalog: false,
  applyEnrichmentActions: false,
  includeUserSuppliedCovers: false,
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
export {
  quarantinedWriterIdentities,
  writerBiographyLegacyCorrections,
  writerIdentityCorrections,
};
