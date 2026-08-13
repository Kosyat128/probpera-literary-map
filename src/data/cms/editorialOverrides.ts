import type { Country, WorkProfile, WriterProfile } from "../countries/types";
import { cmsCountryProfileOverrides as generatedCountryProfiles } from "./countryProfiles.generated";
import { cmsLiteraryWorksByLegacyId as generatedLiteraryWorks } from "./literaryWorks.generated";
import { cmsWriterProfileOverrides as generatedWriterProfiles } from "./writerProfiles.generated";

export type CmsWriterProfileOverride = Partial<
  Pick<
    WriterProfile,
    | "name"
    | "fullName"
    | "years"
    | "birthDate"
    | "deathDate"
    | "birthPlace"
    | "deathPlace"
    | "bio"
    | "portrait"
    | "portraitAlt"
    | "works"
    | "awards"
    | "genres"
    | "languages"
    | "nationality"
  >
>;

export type CmsCountryProfileOverride = Partial<
  Pick<
    Country,
    | "name"
    | "code"
    | "flag"
    | "coordinates"
    | "region"
    | "continent"
    | "officialLanguage"
    | "literaryPeriods"
    | "literaryMovements"
    | "periods"
    | "capital"
    | "description"
    | "history"
    | "historicalNote"
    | "facts"
    | "literaryPlaces"
    | "timeline"
    | "chronology"
    | "nobel"
    | "places"
    | "influence"
  >
>;

export type CmsLiteraryWork = {
  legacyId: string;
  countryId: string;
  writerId: string;
  localId: string;
  title: string;
  originalTitle?: string;
  firstPublished?: number;
  originalLanguage?: string;
  genres?: string[];
  tags?: string[];
  description?: string;
  sourceUrl?: string;
  editorialStatus: "reviewed" | "verified";
  reviewedAt?: string;
};

export const cmsWriterProfileOverrides = generatedWriterProfiles as Record<
  string,
  CmsWriterProfileOverride
>;

export const cmsCountryProfileOverrides = generatedCountryProfiles as Record<
  string,
  CmsCountryProfileOverride
>;

export const cmsLiteraryWorksByLegacyId = generatedLiteraryWorks as Record<
  string,
  CmsLiteraryWork
>;

export function cmsWriterKey(countryId: string, writerId: string) {
  return `${countryId}:${writerId}`;
}

export function applyCmsCountryProfileOverrides(
  countries: Country[],
  overrides: Record<string, CmsCountryProfileOverride> =
    cmsCountryProfileOverrides
): Country[] {
  return countries.map((country) => {
    const override = overrides[country.id];
    if (!override) return country;
    const { writers: _ignoredWriters, ...safeOverride } = override as
      CmsCountryProfileOverride & { writers?: unknown };
    return { ...country, ...safeOverride, writers: country.writers };
  });
}

/**
 * CMS values deliberately run after all reviewed static corrections. This
 * makes an owner's saved edit the final public value while preserving the
 * audited source files as a complete, recoverable fallback.
 */
export function applyCmsWriterProfileOverrides(
  countries: Country[],
  overrides: Record<string, CmsWriterProfileOverride> = cmsWriterProfileOverrides
): Country[] {
  return countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => {
      const override =
        overrides[cmsWriterKey(country.id, writer.id)];
      return override ? { ...writer, ...override } : writer;
    }),
  }));
}

const literaryWorksByWriter = Object.values(cmsLiteraryWorksByLegacyId).reduce(
  (lookup, work) => {
    const key = cmsWriterKey(work.countryId, work.writerId);
    const current = lookup.get(key) || [];
    current.push(work);
    lookup.set(key, current);
    return lookup;
  },
  new Map<string, CmsLiteraryWork[]>()
);

export function cmsLiteraryWorkProfilesForWriter(
  countryId: string,
  writerId: string,
  works: Record<string, CmsLiteraryWork> = cmsLiteraryWorksByLegacyId
): WorkProfile[] {
  const matchingWorks =
    works === cmsLiteraryWorksByLegacyId
      ? literaryWorksByWriter.get(cmsWriterKey(countryId, writerId)) || []
      : Object.values(works).filter(
          (work) => work.countryId === countryId && work.writerId === writerId
        );
  return matchingWorks.map(
    (work) => ({
      id: work.localId,
      title: work.title,
      originalTitle: work.originalTitle || undefined,
      firstPublished: work.firstPublished,
      originalLanguage: work.originalLanguage || undefined,
      genres: work.genres || [],
      tags: work.tags || [],
      description: work.description || undefined,
      sourceUrl: work.sourceUrl || undefined,
      editorial: {
        status: work.editorialStatus,
        reviewedAt: work.reviewedAt,
      },
    })
  );
}
