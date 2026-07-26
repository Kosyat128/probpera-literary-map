import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "./filterTypes";

export function getAllWriters(countries: Country[]): WriterProfile[] {
  return countries.flatMap((country) =>
    country.writers.map((writer) => ({
      ...writer,
      country: writer.country ?? country.name,
    }))
  );
}

export function filterWriters(
  writers: WriterProfile[],
  filters: WriterFilterState
): WriterProfile[] {
  return writers.filter((writer) => {
    const search = filters.search?.toLowerCase();

    if (
      search &&
      !`${writer.name ?? ""} ${writer.fullName ?? ""}`
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }

    if (filters.country && writer.country !== filters.country) {
      return false;
    }

    if (filters.genre && !writer.genres?.includes(filters.genre)) {
      return false;
    }

    if (
      filters.language &&
      writer.language !== filters.language &&
      !writer.languages?.includes(filters.language)
    ) {
      return false;
    }

    if (filters.period && !writer.tags?.includes(filters.period)) {
      return false;
    }

    if (filters.award && !writer.awards?.includes(filters.award)) {
      return false;
    }

    return true;
  });
}
