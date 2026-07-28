import { countries } from "../countries";

export const literaryCountries = Object.fromEntries(
  countries.map((country) => [
    country.id,
    {
      name: country.name,
      flag: (country as any).flag || "🌍",
      writers: country.writers?.length || 0,
      articles: (country as any).articles || 0,
      places: (country as any).places || 0,
      nobel:
        country.writers?.filter(
          (writer) => writer.nobelYear
        ).length || 0,
      influence: (country as any).influence || 0,
      writersList: country.writers || [],
      authors: (country.writers || [])
        .slice(0, 5)
        .map((writer) => writer.name || writer.fullName || ""),
    },
  ])
);
