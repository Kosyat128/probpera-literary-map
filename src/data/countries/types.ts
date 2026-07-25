export type WriterProfile = {
  id: string;

  // Supports existing database format
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

  places?: string[];

  coordinates?: {
    lat: number;
    lng: number;
  };

  relatedWriters?: string[];
  articleUrl?: string;

  [key: string]: unknown;
};

export type Country = {
  id: string;
  name: string;
  code?: string;
  writers: WriterProfile[];
};
