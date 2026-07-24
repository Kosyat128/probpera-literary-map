import type { Writer } from "./writers";

export type WriterFilter = {
  region?: string;
  period?: string;
  direction?: string;
  nobel?: boolean;
};

export function filterWriters(
  writers: Writer[],
  filter: WriterFilter
) {
  return writers.filter((writer) => {
    if (filter.region && writer.region !== filter.region) return false;
    if (filter.period && writer.period !== filter.period) return false;
    if (filter.direction && writer.direction !== filter.direction) return false;
    if (filter.nobel !== undefined && writer.nobel !== filter.nobel) return false;
    return true;
  });
}

export function searchWriters(writers: Writer[], query: string) {
  const value = query.toLowerCase().trim();

  if (!value) return writers;

  return writers.filter((writer) =>
    [writer.name, writer.country, writer.city]
      .join(" ")
      .toLowerCase()
      .includes(value)
  );
}
