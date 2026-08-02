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
  coverUrl?: string;
  coverThumbnailUrl?: string;
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
    status: "draft" | "reviewed" | "verified";
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

  works?: string[];
  workDetails?: WorkProfile[];
  awards?: string[];

  nobelYear?: number;
  nobel?: boolean;
  isNobel?: boolean;
  nobelPrize?: string | boolean;

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
