/** Canonical domain types only. Importing these types must not load a catalog. */
export type {
  Country,
  CountryEnglishTranslationProfile,
  WorkAuthorship,
  WorkAuthorCredit,
  WorkEditorialStatus,
  WorkLocale,
  WorkProfile,
  WorkSourceProfile,
  WorkTitleEvidenceProfile,
  WorkTranslationProfile,
  WriterBiographyLocale,
  WriterBiographyTranslationProfile,
  WriterProfile,
  WriterProfile as Writer,
} from "../data/countries/types";
export type { BookArchiveEntry, BuildBookArchiveOptions } from "../data/bookArchive";
export type { BookArchiveRuntime } from "../loading/bookArchiveRuntime";
