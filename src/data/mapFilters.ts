import type { Writer } from "./writers";

export const availableMapFilters = [
  { id: "europe", name: "Европа" },
  { id: "asia", name: "Азия" },
  { id: "america", name: "Америка" },
  { id: "africa", name: "Африка" },
  { id: "oceania", name: "Океания" },
  { id: "nobel", name: "Нобелевские лауреаты" },
  { id: "realism", name: "Реализм" },
  { id: "modernism", name: "Модернизм" },
];

export function filterByRegion(writers: Writer[], region: string) {
  if (!region) return writers;
  return writers.filter((writer) => writer.region === region);
}

export function filterByPeriod(writers: Writer[], period: string) {
  if (!period) return writers;
  return writers.filter((writer) => writer.period === period);
}

export function filterByDirection(writers: Writer[], direction: string) {
  if (!direction) return writers;
  return writers.filter((writer) => writer.direction === direction);
}

export function filterNobel(writers: Writer[]) {
  return writers.filter((writer) => writer.nobel);
}

export function searchWriters(writers: Writer[], query: string) {
  const value = query.toLowerCase().trim();
  if (!value) return writers;

  return writers.filter((writer) =>
    `${writer.name} ${writer.country} ${writer.city}`
      .toLowerCase()
      .includes(value)
  );
}
