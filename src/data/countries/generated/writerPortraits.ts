import type { Country, WriterProfile } from "../types";
import identityRemediations from "./writerIdentityRemediations.generated.json";
import manifest from "./writerPortraits.generated.json";

type PortraitMetadata = Pick<
  WriterProfile,
  "portrait" | "portraitAlt" | "portraitSourceUrl" | "portraitRights"
>;

const portraits = manifest.writers as Record<string, PortraitMetadata>;

// These manifest entries were generated from QIDs that resolved to different
// people. Keep the stale assets out of the public archive until the portrait
// synchronizer has rebuilt them from the corrected curated QIDs.
export const quarantinedWriterPortraitKeys = new Set(
  identityRemediations.stalePortraitKeys
);

export function mergeWriterPortraits(countries: Country[]): Country[] {
  return countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => {
      if (writer.portrait) return writer;
      const key = `${country.id}:${writer.id}`;
      if (quarantinedWriterPortraitKeys.has(key)) return writer;
      const portrait = portraits[key];
      return portrait ? { ...writer, ...portrait } : writer;
    }),
  }));
}
