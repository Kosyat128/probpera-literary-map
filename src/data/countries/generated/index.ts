import type { Country, WriterProfile } from "../types";
import generatedWriterGroups from "./writers.generated.json";

const groups = generatedWriterGroups as Record<string, WriterProfile[]>;

function normalizedWriterName(writer: WriterProfile) {
  return (writer.fullName || writer.name || "")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function mergeGeneratedWriters(countries: Country[]): Country[] {
  return countries.map((country) => {
    const additions = groups[country.id] || [];
    if (additions.length === 0) return country;

    const curatedNames = new Set(country.writers.map(normalizedWriterName));
    const curatedIds = new Set(country.writers.map((writer) => writer.id));
    const uniqueAdditions = additions.filter(
      (writer) =>
        !curatedIds.has(writer.id) &&
        !curatedNames.has(normalizedWriterName(writer))
    );

    return {
      ...country,
      writers: [...country.writers, ...uniqueAdditions],
    };
  });
}
