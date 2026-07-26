import { countries } from "../countries";

export const literaryCountries = Object.fromEntries(
  countries.map((country) => [
    country.id,
    {
      name: country.name,
      flag: country.flag || "🌍",
      writers: country.writers?.length || 0,
      articles: country.articles || 0,
      places: country.places || 0,
      nobel: country.writers?.filter((writer) => writer.nobel).length || 0,
      influence: country.influence || 0,
      writersList: country.writers || [],
      authors: (country.writers || [])
        .slice(0, 5)
        .map((writer) => writer.fullName || writer.name),
    },
  ])
);
