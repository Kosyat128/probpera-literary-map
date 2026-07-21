export interface Writer {
  name: string;
  years: string;
}

export interface CountryData {
  id: string;
  name: string;
  writers: Writer[];
}

export const countries: CountryData[] = [
  {
    id: 'france',
    name: 'France',
    writers: [
      { name: 'Victor Hugo', years: '1802–1885' },
      { name: 'Alexandre Dumas', years: '1802–1870' }
    ]
  },
  {
    id: 'russia',
    name: 'Russia',
    writers: [
      { name: 'Leo Tolstoy', years: '1828–1910' },
      { name: 'Fyodor Dostoevsky', years: '1821–1881' }
    ]
  }
];