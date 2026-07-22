export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Writer {
  id: string;
  name: string;
  fullName?: string;
  years: string;
  birth?: string;
  death?: string;
  birthPlace: string;
  deathPlace?: string;
  coordinates: Coordinates | [number, number];
  portrait: string;
  bio: string;
  biography?: string;
  works: string[];
  movement?: string;
  century?: string;
  language?: string;
  languages?: string[];
  genres?: string[];
  wikipedia?: string;
  nobel?: boolean;
  nobelYear?: number;
}

export interface Country {
  id: string;
  name: string;
  code: string;
  coordinates?: Coordinates | [number, number];
  writers: Writer[];
}
