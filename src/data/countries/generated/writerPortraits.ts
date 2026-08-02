import type { Country, WriterProfile } from "../types";
import manifest from "./writerPortraits.generated.json";

type PortraitMetadata = Pick<
  WriterProfile,
  "portrait" | "portraitAlt" | "portraitSourceUrl" | "portraitRights"
>;

const portraits = manifest.writers as Record<string, PortraitMetadata>;

export function mergeWriterPortraits(countries: Country[]): Country[] {
  return countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => {
      if (writer.portrait) return writer;
      const portrait = portraits[`${country.id}:${writer.id}`];
      return portrait ? { ...writer, ...portrait } : writer;
    }),
  }));
}
