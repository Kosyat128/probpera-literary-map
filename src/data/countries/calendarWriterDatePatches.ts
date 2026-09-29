import type { Country } from './types';
import { applyWriterDatePatches, type WriterDatePatch } from './writerDatePatches';
import { applyCmsWriterProfileOverrides, type CmsWriterProfileOverride } from '../cms/editorialOverrides';
import russian from './generated/writerDatePatches.r10-russian.json';
import popular from './generated/writerDatePatches.r10-popular.json';
import scoped from './generated/writerDatePatches.r10-scoped.json';

export type { WriterDatePatch } from './writerDatePatches';
export const calendarWriterDatePatches = [...russian.patches, ...popular.patches, ...scoped.patches] as WriterDatePatch[];

/** Derived calendar writer clones only. Canonical country/profile records stay intact. */
export function applyCalendarWriterDatePatches(
  countries: Country[],
  patches: readonly WriterDatePatch[] = calendarWriterDatePatches,
  options: { rollback?: boolean; asOf?: string; cmsOverrides?: Record<string, CmsWriterProfileOverride> } = {}
) {
  const result = applyWriterDatePatches(countries, patches, options);
  return { ...result, countries: applyCmsWriterProfileOverrides(result.countries, options.cmsOverrides) };
}
