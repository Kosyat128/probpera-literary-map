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
