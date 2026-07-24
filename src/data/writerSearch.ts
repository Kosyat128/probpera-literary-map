import { allWriters } from "./writersAll";

export function searchWriters(query: string) {
  const value = query.toLowerCase().trim();

  if (!value) return allWriters;

  return allWriters.filter((writer) =>
    [
      writer.name,
      writer.country,
      writer.city,
      ...writer.books,
    ]
      .join(" ")
      .toLowerCase()
      .includes(value)
  );
}

export function getNobelWriters() {
  return allWriters.filter((writer) => writer.nobel);
}

export function getWritersByRegion(region: string) {
  return allWriters.filter((writer) => writer.region === region);
}
