export type WriterProfile = {
  id: string;
  fullName: string;
  birth: string;
  death?: string;

  birthPlace?: string;
  deathPlace?: string;

  portrait?: string;

  country: string;
  movement: string;
  genres?: string[];
  languages?: string[];

  biography: string;

  works: string[];
  awards: string[];
  nobelYear?: number;

  places: string[];
};
