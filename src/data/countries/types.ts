export type WorkLocale = "ru" | "en";

export type WriterBiographyLocale = "ru" | "en";

export type WriterBiographyEditorialStatus = "draft" | "reviewed" | "verified";

export type WriterBiographySourceProfile = {
  provider: string;
  url: string;
  fields: Array<"identity" | "life-dates" | "biography-facts" | "awards" | "works">;
  usage: "structured-data" | "fact-check" | "licensed-copy";
  retrievedAt: string;
  author?: string;
  title?: string;
  licenseName?: string;
  licenseUrl?: string;
};

export type WriterBiographyTranslationProfile = {
  locale: WriterBiographyLocale;
  text: string;
  sourceLanguage: string;
  status: WriterBiographyEditorialStatus;
  method:
    | "editorial-original"
    | "human-translation"
    | "machine-translation"
    | "licensed-source";
  reviewedAt?: string;
  reviewer?: string;
  translatedFromLocale?: WriterBiographyLocale;
  sourceTextRights?:
    | "project-original"
    | "public-domain"
    | "licensed"
    | "permission";
  sources: WriterBiographySourceProfile[];
  translationMeta?: {
    model?: string;
    reviewerModel?: string;
    sourceHash?: string;
    generatedAt?: string;
    editorialPostEditedAt?: string;
    editorialPostEditor?: string;
    editorialPostEditReasonCodes?: string[];
  };
};

export type WorkEditorialStatus = "draft" | "reviewed" | "verified";

/**
 * Factual authorship is deliberately separate from the writer that owns the
 * legacy archive key. Older records omit this object and continue to use their
 * enclosing writer as the single credited author.
 */
export type WorkAuthorshipKind =
  | "single"
  | "multiple"
  | "anonymous"
  | "collective"
  | "traditional"
  | "disputed";

export type WorkAuthorCredit = {
  /** A linked public writer. Both identifiers must be supplied together. */
  countryId?: string;
  writerId?: string;
  /** Reviewed credit-line spellings; never inferred across locales. */
  creditNames?: Partial<Record<WorkLocale, string>>;
  attribution?: "credited" | "attributed" | "disputed";
};

export type WorkAuthorship = {
  kind: WorkAuthorshipKind;
  /** Editorial order is meaningful, but it is never part of bookArchiveKey. */
  authors: WorkAuthorCredit[];
};

export type WorkTitleEvidenceRecordKind =
  | "national-bibliography"
  | "legal-deposit-catalog"
  | "publisher-catalog"
  | "rights-holder-catalog"
  | "author-estate"
  | "critical-edition";

export type WorkTitleEvidenceProfile = {
  entityKind: "manifestation";
  manifestationId: string;
  sourceUrl: string;
  provider: string;
  authorityId: string;
  authorityTier: "A" | "B";
  recordKind: WorkTitleEvidenceRecordKind;
  recordId: string;
  /**
   * `principal` (the default for legacy records) means the manifestation's
   * principal catalog title is the localized work title. `contained-work`
   * means an official catalog or publisher contents statement identifies the
   * work analytically inside the named container manifestation.
   */
  titleRelation?: "principal" | "contained-work";
  catalogTitleExact: string;
  /** Exact analytic title as printed in the official contents statement. */
  analyticTitleExact?: string;
  /** Exact principal title of the manifestation containing the analytic. */
  containerTitleExact?: string;
  /** Where the official record exposes the contained-work relationship. */
  containedInField?: "contents-note" | "table-of-contents";
  locale: WorkLocale;
  market: string;
  expressionLanguage: string;
  isbn10?: string;
  isbn13?: string;
  publisher?: string;
  publicationYear?: number;
  translator?: string;
  editionStatement?: string;
  retrievedAt: string;
  checkedAt: string;
  checkedBy: string;
};

export type WorkLocalizedTitleProfile = {
  entityKind: "expression";
  expressionId: string;
  locale: WorkLocale;
  value: string;
  status: "verified-published";
  expressionLanguage: string;
  market: string;
  selectionRule:
    | "authoritative-uniform-title"
    | "earliest-authorized-edition"
    | "current-complete-authorized-edition"
    | "original-market-title";
  selectionNote?: string;
  evidence: WorkTitleEvidenceProfile[];
};

export type WorkDescriptionProvenanceProfile = {
  origin:
    | "article-adapted"
    | "official-source-synthesis"
    | "human-translation";
  sourceLanguage: string;
  sourceCountry: string;
  sourceUrls: string[];
  sourceArticle?: {
    articleId: string;
    url: string;
    revisionId: string;
    sourceHash: string;
    excerptHash: string;
  };
  transformations?: Array<
    "condensed" | "deduplicated" | "spoiler-limited" | "style-edited"
  >;
  translatedFromLocale?: WorkLocale;
  translatedFromSourceHash?: string;
  rights: {
    textOrigin: "project-owned-article" | "project-original";
    copiedSourceText: false;
  };
  author: string;
  createdAt: string;
  reviewedBy: string;
  reviewedAt: string;
};

export type WorkCanonicalityEvidenceProfile = {
  registrySourceId: string;
  registryItemOrdinal: number;
  class:
    | "official-curriculum"
    | "national-library-heritage-collection"
    | "academy-or-literary-institute"
    | "scholarly-critical-project"
    | "international-heritage-register"
    | "work-specific-landmark-award";
  sourceUrl: string;
  provider: string;
  authorityId: string;
  authorityTier: "A" | "B";
  itemId: string;
  assertion: string;
  snapshotAt: string;
};

export type WorkCanonProfile = {
  status: "canonical-classic" | "modern-landmark";
  registryVersion: string;
  evidence: WorkCanonicalityEvidenceProfile[];
  reviewedAt: string;
  reviewedBy: string;
};

export type WorkTranslationProfile = {
  locale: WorkLocale;
  title: string;
  description: string;
  sourceLanguage: string;
  status: WorkEditorialStatus;
  sourceUrls: string[];
  method:
    | "editorial-original"
    | "human-translation"
    | "machine-translation"
    | "licensed-source";
  reviewedAt?: string;
  titleEvidence?: WorkLocalizedTitleProfile;
  descriptionProvenance?: WorkDescriptionProvenanceProfile;
};

export type WorkSourceProfile = {
  provider: string;
  authorityId?: string;
  authorityTier?: "A" | "B";
  /** Legacy descriptive jurisdiction; do not use it as an edition market. */
  country?: string;
  /** ISO-3166-1 alpha-2 publication market for manifestation evidence. */
  market?: string;
  language?: string;
  recordKind?:
    | WorkTitleEvidenceRecordKind
    | "authoritative-work-page"
    | "article-source"
    | "structured-dataset";
  recordId?: string;
  url: string;
  fields: Array<
    | "identity"
    | "authorship"
    | "title"
    | "container-title"
    | "contained-title"
    | "original-title"
    | "publication-year"
    | "language"
    | "genre"
    | "description"
    | "award-criterion"
    | "bestseller-evidence"
    | "market"
    | "period"
    | "measurement"
  >;
  license?: string;
  usage: "structured-data" | "reference-only" | "licensed-copy";
  retrievedAt: string;
};

export type WorkExternalId = {
  scheme: "wikidata" | "openlibrary" | "isbn-10" | "isbn-13" | "other";
  value: string;
  sourceUrl: string;
};

export type WorkDistinction = {
  criterion: "award-cited-work" | "editorial-landmark" | "bestseller-evidence";
  label: string;
  organization: string;
  year?: number;
  sourceUrl: string;
};

export type NobelLiteratureAwardProfile = {
  category: "literature";
  year: number;
  laureateId: number;
  portion: "1" | "1/2";
  verifiedAt: string;
  specialStatus?:
    | "declined"
    | "accepted-then-forced-to-decline"
    | "posthumous";
  sources: Array<{
    title: string;
    url: string;
    publisher: "Nobel Prize Outreach";
  }>;
};

export type WorkProfile = {
  id: string;
  title: string;
  authorship?: WorkAuthorship;
  alternateTitles?: string[];
  originalTitle?: string;
  firstPublished?: number;
  originalLanguage?: string;
  genres?: string[];
  tags?: string[];
  description?: string;
  translations?: Partial<Record<WorkLocale, WorkTranslationProfile>>;
  localizedTitles?: Partial<Record<WorkLocale, WorkLocalizedTitleProfile>>;
  canon?: WorkCanonProfile;
  sources?: WorkSourceProfile[];
  externalIds?: WorkExternalId[];
  distinctions?: WorkDistinction[];
  coverUrl?: string;
  coverThumbnailUrl?: string;
  coverWidth?: number;
  coverHeight?: number;
  coverThumbnailWidth?: number;
  coverThumbnailHeight?: number;
  coverSourceUrl?: string;
  coverRights?: {
    status:
      | "public-domain"
      | "licensed"
      | "permission"
      | "editorial-original"
      | "external-preview"
      | "unverified";
    licenseName?: string;
    licenseUrl?: string;
    creator?: string;
    rightsHolder?: string;
    sourceUrl: string;
    checkedAt?: string;
    note?: string;
  };
  sourceUrl?: string;
  edition?: {
    title: string;
    isbn10?: string | null;
    isbn13?: string | null;
    publisher?: string;
    publicationYear?: number | null;
    language?: string;
    sourceUrl?: string;
  };
  editorial?: {
    status: WorkEditorialStatus;
    reviewedAt?: string;
  };
};

export type WriterProfile = {
  id: string;

  name?: string;
  fullName?: string;

  birth?: string;
  death?: string;
  years?: string;

  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  deathPlace?: string;

  portrait?: string;
  portraitAlt?: string;
  portraitSourceUrl?: string;
  portraitRights?: {
    status: "public-domain" | "licensed" | "permission" | "unverified";
    licenseName?: string;
    licenseUrl?: string;
    creator?: string;
    sourceUrl: string;
    checkedAt?: string;
  };

  country?: string;
  movement?: string;
  literaryEra?: string;

  genres?: string[];
  languages?: string[];
  language?: string;
  nationality?: string;
  tags?: string[];
  category?: string;

  bio?: string;
  biography?: string;
  description?: string;
  biographyTranslations?: Partial<
    Record<WriterBiographyLocale, WriterBiographyTranslationProfile>
  >;

  works?: string[];
  workDetails?: WorkProfile[];
  awards?: string[];

  nobelYear?: number;
  nobel?: boolean;
  isNobel?: boolean;
  nobelPrize?: string | boolean;
  nobelAward?: NobelLiteratureAwardProfile;

  places?: string[];

  coordinates?: {
    lat: number;
    lng: number;
  };

  relatedWriters?: string[];
  articleUrl?: string;
  articles?: string[];
  editorial?: {
    status: "draft" | "reviewed" | "verified";
    reviewedAt?: string;
    sources?: Array<{
      title: string;
      url: string;
      publisher?: string;
    }>;
  };

  [key: string]: unknown;
};

export type CountryTimelineItem =
  | string
  | {
      year?: string | number;
      title?: string;
      description?: string;
    };

export type CountryEnglishTranslationProfile = {
  locale: "en";
  status: "reviewed" | "verified";
  method: "human-translation" | "machine-translation" | "editorial-original";
  sourceHash: string;
  generatedAt?: string;
  model?: string;
  reviewerModel?: string | null;
  fields: {
    name?: string;
    region?: string;
    continent?: string;
    officialLanguage?: string;
    literaryPeriods?: string[];
    literaryMovements?: string[];
    periods?: string[];
    capital?: string;
    description?: string;
    history?: string;
    historicalNote?: string;
    facts?: string[];
    literaryPlaces?: string[];
    timeline?: CountryTimelineItem[];
    chronology?: CountryTimelineItem[];
  };
};

export type Country = {
  id: string;
  name: string;
  code?: string;
  flag?: string;

  coordinates?: [number, number] | { lat: number; lng: number };

  region?: string;
  continent?: string;
  officialLanguage?: string;
  literaryPeriods?: string[];
  literaryMovements?: string[];
  periods?: string[];

  capital?: string;
  description?: string;
  history?: string;
  historicalNote?: string;
  facts?: string[];
  literaryPlaces?: string[];
  timeline?: CountryTimelineItem[];
  chronology?: CountryTimelineItem[];
  translations?: {
    en?: CountryEnglishTranslationProfile;
  };
  nobel?: number;
  places?: number;
  influence?: number;

  writers: WriterProfile[];

  [key: string]: unknown;
};
