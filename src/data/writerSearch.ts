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
      writer.period,
      writer.direction,
      writer.region,
    ]
      .filter(Boolean)
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

export function getWritersByPeriod(period: string) {
  return allWriters.filter((writer) => writer.period === period);
}

export function getWritersByDirection(direction: string) {
  return allWriters.filter((writer) => writer.direction === direction);
}
