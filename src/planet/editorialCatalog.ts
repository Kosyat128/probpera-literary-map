/**
 * Editorial/recovery views, kept separate from the visitor catalog API.
 * Book cards and pre-review evidence survive writer-only quarantine; the
 * editorial fallback precedes public CMS overrides. Never merge these views
 * into the visitor corpus or use their writers as public navigation targets.
 */
export {
  countries as publicSourceCountries,
  bookArchiveCountries as bookArchiveSourceCountries,
  editorialCatalogCountries,
  writerBiographyFactReviewSourceCountries,
} from "../data/countries/index";
