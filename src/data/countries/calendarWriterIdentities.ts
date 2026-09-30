import type { WriterProfile } from './types';
import curatedWriterQids from './generated/curatedWriterQids.generated.json';
import scoped from './generated/writerCalendarIdentities.r10-popular.json';

type ScopedIdentity = { wikidataId: string; expectedNames: string[] };

/** Date-only mappings never replace the main reviewed identity registry. */
export function calendarWriterQid(writer: WriterProfile, writerKey: string) {
  const main = (curatedWriterQids.writers as Record<string, { wikidataId: string }>)[writerKey];
  if (main) return main.wikidataId;
  const dateIdentity = (scoped.writers as Record<string, ScopedIdentity>)[writerKey];
  if (!dateIdentity) return undefined;
  const actualNames = [writer.name, writer.fullName].filter(Boolean);
  if (JSON.stringify(actualNames) !== JSON.stringify(dateIdentity.expectedNames)) return undefined;
  return dateIdentity.wikidataId;
}
