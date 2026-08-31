import type { Country, WriterProfile } from "../types";
import identityRemediations from "./writerIdentityRemediations.generated.json";
import manifest from "./writerPortraits.generated.json";

type PortraitMetadata = Pick<
  WriterProfile,
  "portrait" | "portraitAlt" | "portraitSourceUrl" | "portraitRights"
>;

const portraits = manifest.writers as Record<string, PortraitMetadata>;

const stalePortraitQids = new Map(
  [
    ...identityRemediations.repairedMappings,
    ...identityRemediations.removedMappings,
  ].map((item) => [item.key, item.oldQid])
);

function portraitQid(value: string | undefined): string {
  const qid = String(value || "").match(/(?:^|\/)q(\d+)\.webp$/iu)?.[1];
  return qid ? `Q${qid}` : "";
}

// Quarantine only a manifest entry that still points to the old, disproven
// QID. Once the synchronizer replaces it with the corrected QID, the same
// writer key becomes safe automatically.
export const quarantinedWriterPortraitKeys = new Set(
  Object.entries(portraits)
    .filter(
      ([key, portrait]) =>
        stalePortraitQids.get(key) === portraitQid(portrait.portrait)
    )
    .map(([key]) => key)
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
