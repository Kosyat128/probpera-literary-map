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
  };
};

export type WorkEditorialStatus = "draft" | "reviewed" | "verified";

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
};

export type WorkSourceProfile = {
  provider: string;
  url: string;
  fields: Array<
    | "identity"
    | "authorship"
    | "title"
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
  alternateTitles?: string[];
  originalTitle?: string;
  firstPublished?: number;
  originalLanguage?: string;
  genres?: string[];
  tags?: string[];
  description?: string;
  translations?: Partial<Record<WorkLocale, WorkTranslationProfile>>;
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
  timeline?: Array<
    | string
    | {
        year?: string | number;
        title?: string;
        description?: string;
      }
  >;
  chronology?: Array<
    | string
    | {
        year?: string | number;
        title?: string;
        description?: string;
      }
  >;
  nobel?: number;
  places?: number;
  influence?: number;

  writers: WriterProfile[];

  [key: string]: unknown;
};