export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Writer {
  id: string;

  // Names
  name: string;
  fullName?: string;

  // Dates
  years?: string;
  birth?: string;
  death?: string;
  birthDate?: string;
  deathDate?: string;

  // Places
  birthPlace?: string;
  deathPlace?: string;

  // Visual data
  portrait?: string;

  // Location support
  coordinates?: Coordinates | [number, number];

  // Biography
  bio?: string;
  biography?: string;
  description?: string;

  // Literary information
  works?: string[];
  movement?: string;
  century?: string;
  language?: string;
  languages?: string[];
  nationality?: string;
  genres?: string[];
  tags?: string[];

  // Additional links/data
  wikipedia?: string;
  articleUrl?: string;
  relatedWriters?: string[];

  // Awards
  awards?: string[];
  nobel?: boolean;
  nobelYear?: number;

  [key: string]: unknown;
}

export interface Country {
  id: string;
  name: string;
  code?: string;
  coordinates?: Coordinates | [number, number];
  writers: Writer[];
}
