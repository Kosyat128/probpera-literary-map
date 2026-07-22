export interface Coordinates {
  lat: number;
  lng: number;
}


export interface Writer {

  id: string;

  name: string;

  years: string;

  birthPlace: string;

  coordinates: Coordinates | [number, number];

  portrait: string;

  bio: string;

  works: string[];

  movement?: string;

  century?: string;

  language?: string;

  wikipedia?: string;

  nobel?: boolean;

}


export interface Country {

  id: string;

  name: string;

  code: string;

  coordinates?: Coordinates | [number, number];

  writers: Writer[];

}
