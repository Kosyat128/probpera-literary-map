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
    | "works"
    | "awards"
    | "genres"
    | "languages"
    | "nationality"
    | "biographyTranslations"
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
    | "translations"
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
  authorship?: WorkProfile["authorship"];
  originalTitle?: string;
  firstPublished?: number;
  originalLanguage?: string;
  genres?: readonly string[];
  tags?: readonly string[];
  description?: string;
  sourceUrl?: string;
  translations?: WorkProfile["translations"];
  localizedTitles?: WorkProfile["localizedTitles"];
  canon?: WorkProfile["canon"];
  sources?: WorkProfile["sources"];
  editorialStatus: "reviewed" | "verified";
  reviewedAt?: string;
};

// Generated modules intentionally use `as const` so their build artefacts are
// immutable. The premium exporter validates every nested field before writing;
// runtime mappers below make mutable defensive copies where WorkProfile needs
// them, so a readonly-to-editorial assertion is safe at this boundary.
export const cmsWriterProfileOverrides = generatedWriterProfiles as unknown as Record<
  string,
  CmsWriterProfileOverride
>;

export const cmsCountryProfileOverrides = generatedCountryProfiles as unknown as Record<
  string,
  CmsCountryProfileOverride
>;

export const cmsLiteraryWorksByLegacyId = generatedLiteraryWorks as unknown as Record<
  string,
  CmsLiteraryWork
>;

export function cmsWriterKey(countryId: string, writerId: string) {
  return `${countryId}:${writerId}`;
}

const protectedWriterPortraitFields = new Set([
  "portrait",
  "portraitAlt",
  "portraitSourceUrl",
  "portraitRights",
]);

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
      if (!override) return writer;
      const safeOverride = Object.fromEntries(
        Object.entries(override).filter(
          ([field]) => !protectedWriterPortraitFields.has(field)
        )
      ) as CmsWriterProfileOverride;
      return { ...writer, ...safeOverride };
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

function copiedJsonMetadata<T>(value: T): T {
  if (value === undefined) return value;
  // These fields have already crossed a JSONB/generated-module boundary. A
  // JSON copy mirrors that contract and prevents CMS consumers from mutating
  // nested evidence owned by the generated snapshot.
  return JSON.parse(JSON.stringify(value)) as T;
}

function copiedTranslations(
  translations: WorkProfile["translations"]
): WorkProfile["translations"] {
  if (!translations) return undefined;
  return {
    ...(translations.ru
      ? {
          ru: {
            ...copiedJsonMetadata(translations.ru),
            sourceUrls: [...translations.ru.sourceUrls],
          },
        }
      : {}),
    ...(translations.en
      ? {
          en: {
            ...copiedJsonMetadata(translations.en),
            sourceUrls: [...translations.en.sourceUrls],
          },
        }
      : {}),
  };
}

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
      authorship: copiedJsonMetadata(work.authorship),
      originalTitle: work.originalTitle || undefined,
      firstPublished: work.firstPublished,
      originalLanguage: work.originalLanguage || undefined,
      genres: [...(work.genres || [])],
      tags: [...(work.tags || [])],
      description: work.description || undefined,
      sourceUrl: work.sourceUrl || undefined,
      translations: copiedTranslations(work.translations),
      localizedTitles: copiedJsonMetadata(work.localizedTitles),
      canon: copiedJsonMetadata(work.canon),
      sources: work.sources?.map((source) => ({
        ...copiedJsonMetadata(source),
        fields: [...source.fields],
      })),
      editorial: {
        status: work.editorialStatus,
        reviewedAt: work.reviewedAt,
      },
    })
  );
}
