import type { Writer } from "./writers";
import { allWriters } from "./writersAll";

export type WriterFilter = {
  region?: string;
  period?: string;
  direction?: string;
  country?: string;
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
    if (filter.country && writer.country !== filter.country) return false;
    if (filter.nobel !== undefined && writer.nobel !== filter.nobel) return false;
    return true;
  });
}

export function searchAllWriters(query: string) {
  const value = query.toLowerCase().trim();

  if (!value) return allWriters;

  return allWriters.filter((writer) =>
    [writer.name, writer.country, writer.city, writer.books.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(value)
  );
}

export const getNobelWriters = () =>
  allWriters.filter((writer) => writer.nobel === true);
