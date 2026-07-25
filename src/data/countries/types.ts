export type WriterProfile = {
  id: string;
  fullName: string;

  // Existing date format
  birth: string;
  death?: string;

  // Additional compatible date fields
  birthDate?: string;
  deathDate?: string;

  birthPlace?: string;
  deathPlace?: string;

  portrait?: string;

  country: string;
  movement: string;

  genres?: string[];
  languages?: string[];
  language?: string;
  nationality?: string;
  tags?: string[];
  category?: string;

  biography: string;
  description?: string;

  works: string[];
  awards: string[];

  nobelYear?: number;

  places: string[];
};

export type Country = {
  id: string;
  name: string;
  code?: string;
  writers: WriterProfile[];
};
