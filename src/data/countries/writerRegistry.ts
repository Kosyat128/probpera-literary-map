import type { Writer } from "./types";
import { countries } from "./index";

export const allWriters: Writer[] = countries.flatMap(
  (country) => country.writers || []
);

export function getWriterById(id: string) {
  return allWriters.find((writer) => writer.id === id);
}
