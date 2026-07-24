import { allWriters } from "./writersAll";

export const writerStats = {
  total: allWriters.length,
  nobel: allWriters.filter((writer) => writer.nobel).length,
  regions: [...new Set(allWriters.map((writer) => writer.region).filter(Boolean))],
  countries: [...new Set(allWriters.map((writer) => writer.country))],
};
