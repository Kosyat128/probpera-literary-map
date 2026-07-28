import { countries } from "../data/countries";

export function resolveRelatedWriters(ids: string[] = []) {
  const writers = countries.flatMap((country) => country.writers || []);

  return ids
    .map((id) => writers.find((writer) => writer.id === id))
    .filter(Boolean)
    .map((writer) => writer?.name || writer?.fullName || "");
}
