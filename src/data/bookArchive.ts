import type {
  Country,
  WorkLocale,
  WorkProfile,
  WriterProfile,
} from "./countries/types";
import {
  cmsBookEditionsByWorkId,
  type CmsBookEdition,
} from "./cms/bookEditions";
import {
  rawGeneratedBooksForWriter,
  reviewedBooksForWriter,
} from "./countries/generated/generatedBooks";
import enrichmentActionsJson from "./countries/generated/books.enrichment-actions.json";
import { isPublicBook } from "./bookQuality";
import {
  selectBookAuthorRefs,
  selectBookText,
} from "./bookLocalization";
import { applyUserSuppliedBookCover } from "./userSuppliedBookCovers";
import {
  cmsLiteraryWorkProfilesForWriter,
  cmsWriterKey,
  cmsWriterProfileOverrides,
  type CmsWriterProfileOverride,
} from "./cms/editorialOverrides";
import { applyBookBibliographicOverlay } from "./countries/bookBibliographicOverlays";
import { applyBookArticleSynopsisBatch01Work } from "./countries/bookArticleSynopsisBatch01";
import { applyBookEvidenceV2PublicBatch02Work } from "./countries/bookEvidenceV2PublicBatch02";
import { applyBookEvidenceV2PublicBatch03Work } from "./countries/bookEvidenceV2PublicBatch03";
import { applyBookEvidenceV2PublicBatch04Work } from "./countries/bookEvidenceV2PublicBatch04";
import { applyBookEvidenceV2PublicBatch05Work } from "./countries/bookEvidenceV2PublicBatch05";
import { applyBookEvidenceV2PublicBatch06Work } from "./countries/bookEvidenceV2PublicBatch06";
import { applyBookEvidenceV2PublicBatch07Work } from "./countries/bookEvidenceV2PublicBatch07";
import { applyBookEvidenceV2PublicHolds01Work } from "./countries/bookEvidenceV2PublicHolds01";
import { applyBookEvidenceV2PublicQuarantine01Work } from "./countries/bookEvidenceV2PublicQuarantine01";
import { applyBookEvidenceV2ExpansionBatch01Work } from "./countries/bookEvidenceV2ExpansionBatch01";
import { applyBookEvidenceV2LegacyVerifiedReaudit01Work } from "./countries/bookEvidenceV2LegacyVerifiedReaudit01";

export type BookArchiveEntry = WorkProfile & {
  countryId: string;
  countryName: string;
  writerId: string;
  writerName: string;
  writer: WriterProfile;
  country: Country;
};

/**
 * Resolves a book relation back into the public writer/globe corpus. Book
 * entries may intentionally survive a writer quarantine, so their embedded
 * pre-quarantine writer object must never be passed to public writer views.
 */
export function resolveBookArchivePublicTarget(
  publicCountries: Country[],
  book: Pick<BookArchiveEntry, "countryId" | "writerId">
) {
  const country = publicCountries.find((item) => item.id === book.countryId);
  if (!country) return null;
  const writer = country.writers.find((item) => item.id === book.writerId);
  if (!writer) return null;
  return {
    country,
    writer,
  };
}

/**
 * Resolves factual, linkable authors without changing the legacy routing
 * target above. Anonymous and literal collective credits deliberately resolve
 * to an empty list.
 */
export function resolveBookArchiveAuthorTargets(
  publicCountries: Country[],
  book: BookArchiveEntry
) {
  const seen = new Set<string>();
  return selectBookAuthorRefs(book).flatMap((author) => {
    const key = `${author.countryId}:${author.writerId}`;
    if (seen.has(key)) return [];
    const country = publicCountries.find((item) => item.id === author.countryId);
    const writer = country?.writers.find((item) => item.id === author.writerId);
    if (!country || !writer) return [];
    seen.add(key);
    return [{ country, writer, author }];
  });
}

const editionCoverStatuses = new Set([
  "public-domain",
  "licensed",
  "permission",
  "external-preview",
]);

const displayableArtworkStatuses = new Set([
  ...editionCoverStatuses,
  "editorial-original",
]);

export function isCoverDisplayAllowed(work: WorkProfile) {
  return Boolean(
    work.coverUrl &&
      work.coverRights &&
      editionCoverStatuses.has(work.coverRights.status)
  );
}

/**
 * Includes clearly labelled editorial artwork. Unlike isCoverDisplayAllowed,
 * this helper must never be used for counters of real publisher editions.
 */
export function isCoverArtworkDisplayAllowed(work: WorkProfile) {
  return Boolean(
    work.coverUrl &&
      work.coverRights &&
      displayableArtworkStatuses.has(work.coverRights.status)
  );
}

function normalizeTitle(title: string) {
  return title
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/[«»"'.,:;!?()[\]{}]/g, "");
}

export function isEditorialCover(work: WorkProfile) {
  return work.coverRights?.status === "editorial-original";
}

export function getWriterWorkTitles(writer: WriterProfile) {
  const titles = [
    ...(writer.workDetails || []).map((work) => work.title),
    ...(writer.works || []),
  ];
  const seen = new Set<string>();

  return titles.filter((title) => {
    const normalizedTitle = normalizeTitle(title);
    if (!normalizedTitle || seen.has(normalizedTitle)) return false;
    seen.add(normalizedTitle);
    return true;
  });
}

export function getPublicWriterWorkTitles(
  writer: WriterProfile,
  locale: WorkLocale = "ru"
) {
  const seen = new Set<string>();
  return (writer.workDetails || [])
    .filter(isPublicBook)
    .map((work) => selectBookText(work, locale).title)
    .filter((title) => {
      const normalizedTitle = normalizeTitle(title);
      if (!normalizedTitle || seen.has(normalizedTitle)) return false;
      seen.add(normalizedTitle);
      return true;
    });
}

function legacyWorkId(writerId: string, title: string, index: number) {
  const titlePart = normalizeTitle(title)
    .replace(/[^a-zа-яё0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `legacy-${writerId}-${titlePart || index}`;
}

export type BuildBookArchiveOptions = {
  includeReviewedGenerated?: boolean;
  applyEnrichmentActions?: boolean;
  includeUserSuppliedCovers?: boolean;
  writerProfileOverrides?: Record<string, CmsWriterProfileOverride>;
};

/**
 * Gives archive/search cards the same CMS-edited author name as the public
 * writer profile. Only presentation names are copied: quarantine membership,
 * biographies, works and every source record remain owned by their existing
 * reviewed pipelines.
 */
export function applyBookArchiveWriterPresentationOverride(
  countryId: string,
  writer: WriterProfile,
  overrides: Record<string, CmsWriterProfileOverride> =
    cmsWriterProfileOverrides
): WriterProfile {
  const override = overrides[cmsWriterKey(countryId, writer.id)];
  if (!override) return writer;

  const name = typeof override.name === "string" ? override.name : undefined;
  const fullName =
    typeof override.fullName === "string" ? override.fullName : undefined;
  if (name === undefined && fullName === undefined) return writer;

  return {
    ...writer,
    ...(name !== undefined ? { name } : {}),
    ...(fullName !== undefined ? { fullName } : {}),
  };
}

export type BookEnrichmentActionsPayload = {
  generatedAt: string;
  sourceManifestFingerprint: string;
  source: string;
  duplicateResolutionManifest?: {
    manifestId: string;
    fingerprint: string;
  };
  rejects: Array<{ recordKey: string; reasonCodes: string[] }>;
  merges: Array<{
    from: string;
    into: string;
    basis: string;
    preserveWriterRelation: boolean;
    mergeContractVersion?: number;
    resolutionId?: string;
    resolutionFingerprint?: string;
    sourceFingerprint?: string;
    survivorFingerprint?: string;
    sourceMergeProjectionFingerprint?: string;
    survivorMergeProjectionFingerprint?: string;
    workFirstPublishedStatus?: "authority-backed" | "withheld";
    workFirstPublished?: number | null;
    canonicalTitle?: string;
  }>;
  aliases?: Array<{
    recordKey: string;
    title: string;
    sourceId: string;
    basis: string;
    aliasContractVersion?: number;
    resolutionId: string;
    resolutionFingerprint: string;
    targetFingerprint: string;
    targetMergeProjectionFingerprint: string;
    workFirstPublishedStatus?: "authority-backed" | "withheld";
    workFirstPublished?: number | null;
  }>;
};

const enrichmentActions =
  enrichmentActionsJson as BookEnrichmentActionsPayload;

const REVIEWED_CANON_IDENTITY_MERGE_BASIS =
  "canon-reviewed-work-identity-resolution";
const REVIEWED_CANON_TITLE_ALIAS_BASIS =
  "canon-reviewed-exact-title-alias";

function uniqueWorkStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))] as
    string[];
}

function uniqueWorkObjects<T>(values: T[], identity: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = identity(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function openLibraryExternalIdFromWork(work: WorkProfile) {
  const sourceUrl = String(work.sourceUrl || "");
  if (!/openlibrary\.org/iu.test(sourceUrl)) return null;
  const value = sourceUrl.toUpperCase().match(/OL\d+W/u)?.[0];
  if (!value) return null;
  return {
    scheme: "openlibrary" as const,
    value,
    sourceUrl,
  };
}

/**
 * Applies the controlled field-union contract for a fingerprint-pinned Work
 * merge. Workflow identity, survivor title and survivor artwork stay owned by
 * the reviewed survivor; source titles and external identities remain
 * discoverable instead of disappearing with the duplicate card.
 */
export function mergeReviewedCanonWorkIdentity(
  source: WorkProfile,
  survivor: WorkProfile,
  action: BookEnrichmentActionsPayload["merges"][number]
): WorkProfile {
  if (action.basis !== REVIEWED_CANON_IDENTITY_MERGE_BASIS) {
    return { ...source, ...survivor };
  }

  const alternateTitles = uniqueWorkStrings([
    ...(survivor.alternateTitles || []),
    action.canonicalTitle,
    source.title,
    source.originalTitle,
    ...(source.alternateTitles || []),
  ]).filter((title) => title !== survivor.title);
  const genres = uniqueWorkStrings([
    ...(survivor.genres || []),
    ...(source.genres || []),
  ]);
  const tags = uniqueWorkStrings([
    ...(survivor.tags || []),
    ...(source.tags || []),
  ]);
  const sources = uniqueWorkObjects(
    [...(survivor.sources || []), ...(source.sources || [])],
    (entry) => entry.url
  );
  const externalIds = uniqueWorkObjects(
    [
      ...(survivor.externalIds || []),
      ...(source.externalIds || []),
      openLibraryExternalIdFromWork(survivor),
      openLibraryExternalIdFromWork(source),
    ].filter(Boolean) as NonNullable<WorkProfile["externalIds"]>,
    (entry) => `${entry.scheme.toLowerCase()}:${entry.value.toUpperCase()}`
  );
  const distinctions = uniqueWorkObjects(
    [...(survivor.distinctions || []), ...(source.distinctions || [])],
    (entry) => JSON.stringify(entry)
  );
  const translations =
    survivor.translations || source.translations
      ? { ...(source.translations || {}), ...(survivor.translations || {}) }
      : undefined;
  const localizedTitles =
    survivor.localizedTitles || source.localizedTitles
      ? {
          ...(source.localizedTitles || {}),
          ...(survivor.localizedTitles || {}),
        }
      : undefined;
  const shouldUseReviewedOriginalTitle =
    !survivor.originalTitle &&
    /[А-Яа-яЁё]/u.test(survivor.title) &&
    /[A-Za-z]/u.test(action.canonicalTitle || "");

  const merged: WorkProfile = {
    ...source,
    ...survivor,
    ...(alternateTitles.length ? { alternateTitles } : {}),
    ...(genres.length ? { genres } : {}),
    ...(tags.length ? { tags } : {}),
    ...(sources.length ? { sources } : {}),
    ...(externalIds.length ? { externalIds } : {}),
    ...(distinctions.length ? { distinctions } : {}),
    ...(translations ? { translations } : {}),
    ...(localizedTitles ? { localizedTitles } : {}),
    ...(shouldUseReviewedOriginalTitle
      ? { originalTitle: action.canonicalTitle }
      : {}),
  };

  if (
    action.workFirstPublishedStatus === "authority-backed" &&
    Number.isInteger(action.workFirstPublished)
  ) {
    merged.firstPublished = action.workFirstPublished as number;
  } else if (action.workFirstPublishedStatus === "withheld") {
    delete merged.firstPublished;
  }
  return merged;
}

function applyReviewedCanonTitleAliases(
  recordKey: string,
  work: WorkProfile,
  actions: BookEnrichmentActionsPayload
) {
  const aliasActions = (actions.aliases || []).filter(
    (action) =>
      action.recordKey === recordKey &&
      action.basis === REVIEWED_CANON_TITLE_ALIAS_BASIS
  );
  if (aliasActions.length === 0) return work;
  const aliased = {
    ...work,
    alternateTitles: uniqueWorkStrings([
      ...(work.alternateTitles || []),
      ...aliasActions.map((action) => action.title),
    ]).filter((title) => title !== work.title),
  };
  const withheldYear = aliasActions.some(
    (action) => action.workFirstPublishedStatus === "withheld"
  );
  const authorityBackedYears = uniqueWorkStrings(
    aliasActions
      .filter(
        (action) =>
          action.workFirstPublishedStatus === "authority-backed" &&
          Number.isInteger(action.workFirstPublished)
      )
      .map((action) => String(action.workFirstPublished))
  );
  if (withheldYear) {
    delete aliased.firstPublished;
  } else if (authorityBackedYears.length === 1) {
    aliased.firstPublished = Number(authorityBackedYears[0]);
  }
  return aliased;
}

/**
 * Deduplicates by stable ID or normalized title. Earlier candidates have
 * editorial precedence; later candidates only fill fields they do not carry
 * (notably an existing cover on a reviewed overlay).
 */
export function mergeWriterWorkCandidates(
  candidateGroups: WorkProfile[][]
): WorkProfile[] {
  const merged: WorkProfile[] = [];
  for (const candidate of candidateGroups.flat()) {
    const normalized = normalizeTitle(candidate.title);
    if (!normalized) continue;
    const existingIndex = merged.findIndex(
      (existing) =>
        existing.id === candidate.id ||
        normalizeTitle(existing.title) === normalized
    );
    if (existingIndex === -1) {
      merged.push(candidate);
      continue;
    }
    merged[existingIndex] = { ...candidate, ...merged[existingIndex] };
  }
  return merged;
}

export function bookArchiveKey(
  countryId: string,
  writerId: string,
  workId: string
) {
  return `${countryId}:${writerId}:${workId}`;
}

export function filterRejectedBookCandidates(
  countryId: string,
  writerId: string,
  works: WorkProfile[],
  actions: BookEnrichmentActionsPayload = enrichmentActions
) {
  const rejected = new Set(actions.rejects.map((action) => action.recordKey));
  return works.filter(
    (work) =>
      !rejected.has(bookArchiveKey(countryId, writerId, work.id))
  );
}

/**
 * Applies generated high-confidence decisions to the canonical archive while
 * leaving the raw/staging inputs untouched and recoverable.
 */
export function applyBookEnrichmentActions(
  countryId: string,
  writerId: string,
  works: WorkProfile[],
  actions: BookEnrichmentActionsPayload = enrichmentActions
) {
  const writerPrefix = `${countryId}:${writerId}:`;
  const rejected = new Set(
    actions.rejects
      .map((action) => action.recordKey)
      .filter((key) => key.startsWith(writerPrefix))
  );
  const mergeTargets = new Map(
    actions.merges
      .filter(
        (action) =>
          action.from.startsWith(writerPrefix) &&
          (action.into.startsWith(writerPrefix) ||
            (action.preserveWriterRelation === false &&
              action.basis ===
                "curated-reviewed-cross-writer-authorship-correction"))
      )
      .map((action) => [action.from, action.into])
  );
  const mergeActionBySource = new Map(
    actions.merges.map((action) => [action.from, action])
  );
  const reviewedCrossWriterMergeSources = new Set(
    actions.merges
      .filter(
        (action) =>
          action.from.startsWith(writerPrefix) &&
          !action.into.startsWith(writerPrefix) &&
          action.preserveWriterRelation === false &&
          action.basis ===
            "curated-reviewed-cross-writer-authorship-correction"
      )
      .map((action) => action.from)
  );
  const workByKey = new Map(
    works.map((work) => [
      bookArchiveKey(countryId, writerId, work.id),
      work,
    ])
  );

  function terminalKey(startKey: string) {
    const seen = new Set<string>();
    let currentKey = startKey;
    while (mergeTargets.has(currentKey) && !seen.has(currentKey)) {
      seen.add(currentKey);
      currentKey = mergeTargets.get(currentKey)!;
    }
    return workByKey.has(currentKey) ||
      reviewedCrossWriterMergeSources.has(startKey)
      ? currentKey
      : startKey;
  }

  const fallbacksByTarget = new Map<
    string,
    Array<{
      work: WorkProfile;
      action: BookEnrichmentActionsPayload["merges"][number] | undefined;
    }>
  >();
  for (const work of works) {
    const key = bookArchiveKey(countryId, writerId, work.id);
    if (rejected.has(key)) continue;
    const targetKey = terminalKey(key);
    if (targetKey === key) continue;
    if (!workByKey.has(targetKey)) continue;
    if (!fallbacksByTarget.has(targetKey)) {
      fallbacksByTarget.set(targetKey, []);
    }
    fallbacksByTarget.get(targetKey)!.push({
      work,
      action: mergeActionBySource.get(key),
    });
  }

  return works
    .filter((work) => {
      const key = bookArchiveKey(countryId, writerId, work.id);
      return !rejected.has(key) && terminalKey(key) === key;
    })
    .map((canonical) => {
      const key = bookArchiveKey(countryId, writerId, canonical.id);
      const merged = (fallbacksByTarget.get(key) || []).reduce(
        (combined, fallback) =>
          fallback.action?.basis === REVIEWED_CANON_IDENTITY_MERGE_BASIS
            ? mergeReviewedCanonWorkIdentity(
                fallback.work,
                combined,
                fallback.action
              )
            : { ...fallback.work, ...combined },
        canonical
      );
      return applyReviewedCanonTitleAliases(key, merged, actions);
    });
}

/**
 * Completes the two reviewed cross-country Oscar Wilde merges after every
 * writer-local archive has been assembled. Missing endpoints fail closed: the
 * source card is retained instead of being deleted without its survivor.
 */
export function applyCrossCountryReviewedCanonMerges(
  archive: BookArchiveEntry[],
  actions: BookEnrichmentActionsPayload = enrichmentActions
) {
  const byKey = new Map(
    archive.map((work) => [
      bookArchiveKey(work.countryId, work.writerId, work.id),
      work,
    ])
  );
  const removed = new Set<string>();
  const reviewedActions = actions.merges
    .filter(
      (action) =>
        action.basis === REVIEWED_CANON_IDENTITY_MERGE_BASIS &&
        action.preserveWriterRelation === false
    )
    .slice()
    .sort((left, right) => left.from.localeCompare(right.from, "en"));

  for (const action of reviewedActions) {
    const source = byKey.get(action.from);
    const survivor = byKey.get(action.into);
    if (!source || !survivor || removed.has(action.into)) continue;
    byKey.set(
      action.into,
      mergeReviewedCanonWorkIdentity(source, survivor, action) as
        BookArchiveEntry
    );
    removed.add(action.from);
  }

  return archive
    .filter(
      (work) =>
        !removed.has(bookArchiveKey(work.countryId, work.writerId, work.id))
    )
    .map(
      (work) =>
        byKey.get(bookArchiveKey(work.countryId, work.writerId, work.id)) ||
        work
    );
}

export function buildBookArchive(
  countries: Country[],
  options: BuildBookArchiveOptions = {}
): BookArchiveEntry[] {
  const includeReviewedGenerated = options.includeReviewedGenerated !== false;
  const shouldApplyEnrichmentActions = options.applyEnrichmentActions !== false;
  const includeUserSuppliedCovers = options.includeUserSuppliedCovers !== false;
  const writerProfileOverrides =
    options.writerProfileOverrides || cmsWriterProfileOverrides;
  const writerLocalArchive = countries.flatMap((country) =>
    country.writers.flatMap((writer) => {
      const presentationWriter = applyBookArchiveWriterPresentationOverride(
        country.id,
        writer,
        writerProfileOverrides
      );
      const candidateGroups = [
        cmsLiteraryWorkProfilesForWriter(country.id, writer.id),
        includeReviewedGenerated
          ? reviewedBooksForWriter(country.id, writer.id)
          : [],
        writer.workDetails || [],
        rawGeneratedBooksForWriter(country.id, writer.id),
      ];
      const detailedWorks = mergeWriterWorkCandidates(
        shouldApplyEnrichmentActions
          ? candidateGroups.map((works) =>
              filterRejectedBookCandidates(country.id, writer.id, works)
            )
          : candidateGroups
      );
      const detailedTitles = new Set(
        detailedWorks.map((work) => normalizeTitle(work.title))
      );
      const legacyWorks = (writer.works || [])
        .map((title) => title.trim())
        .filter(Boolean)
        .filter((title) => !detailedTitles.has(normalizeTitle(title)))
        .map((title, index) => ({
          id: legacyWorkId(writer.id, title, index),
          title,
          editorial: { status: "draft" as const },
        }));

      const canonicalWorks = shouldApplyEnrichmentActions
        ? applyBookEnrichmentActions(country.id, writer.id, [
            ...detailedWorks,
            ...legacyWorks,
          ])
        : [...detailedWorks, ...legacyWorks];

      return canonicalWorks.map((candidate) => {
        const expandedWork = applyBookEvidenceV2ExpansionBatch01Work(
          country.id,
          writer.id,
          applyBookEvidenceV2PublicQuarantine01Work(
            country.id,
            writer.id,
            applyBookEvidenceV2PublicBatch07Work(
              country.id,
              writer.id,
              applyBookEvidenceV2PublicHolds01Work(
                country.id,
                writer.id,
                applyBookEvidenceV2PublicBatch06Work(
                  country.id,
                  writer.id,
                  applyBookEvidenceV2PublicBatch05Work(
                    country.id,
                    writer.id,
                    applyBookEvidenceV2PublicBatch04Work(
                      country.id,
                      writer.id,
                      applyBookEvidenceV2PublicBatch03Work(
                        country.id,
                        writer.id,
                        applyBookEvidenceV2PublicBatch02Work(
                          country.id,
                          writer.id,
                          applyBookArticleSynopsisBatch01Work(
                            country.id,
                            writer.id,
                            applyBookBibliographicOverlay(
                              country.id,
                              writer.id,
                              candidate
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        );
        // Final publication guard: keep this after every public/expansion
        // overlay so a later enrichment cannot re-promote a held legacy card.
        const work = applyBookEvidenceV2LegacyVerifiedReaudit01Work(
          country.id,
          writer.id,
          expandedWork
        );
        const workId = `${country.id}:${writer.id}:${work.id}`;
        const edition = (
          cmsBookEditionsByWorkId as Record<string, CmsBookEdition>
        )[workId];
        return {
          ...work,
          ...(edition
            ? {
                coverUrl: edition.coverUrl,
                coverThumbnailUrl: undefined,
                coverSourceUrl: edition.coverSourceUrl,
                coverRights: {
                  status: edition.coverRightsStatus,
                  licenseName: edition.licenseName || undefined,
                  licenseUrl: edition.licenseUrl || undefined,
                  creator: edition.creator || undefined,
                  rightsHolder: edition.rightsHolder || undefined,
                  sourceUrl: edition.sourceUrl || edition.coverSourceUrl,
                  checkedAt: edition.rightsCheckedAt,
                  note: "Точное издание связано редакцией по ISBN.",
                },
                edition: {
                  title: edition.title,
                  isbn10: edition.isbn10,
                  isbn13: edition.isbn13,
                  publisher: edition.publisher,
                  publicationYear: edition.publicationYear,
                  language: edition.language,
                  sourceUrl: edition.sourceUrl,
                },
              }
            : {}),
          countryId: country.id,
          countryName: country.name,
          writerId: writer.id,
          writerName:
            presentationWriter.name ||
            presentationWriter.fullName ||
            "Автор",
          writer: presentationWriter,
          country,
        };
      });
    })
  );

  const archive = shouldApplyEnrichmentActions
    ? applyCrossCountryReviewedCanonMerges(writerLocalArchive)
    : writerLocalArchive;

  if (!includeUserSuppliedCovers) return archive;

  const protectedWorkKeys = new Set(
    archive
      .filter((work) => work.coverUrl || work.coverRights || work.edition)
      .map((work) => bookArchiveKey(work.countryId, work.writerId, work.id))
  );

  return archive.map((work) => {
    const workKey = bookArchiveKey(work.countryId, work.writerId, work.id);
    return applyUserSuppliedBookCover(workKey, work, protectedWorkKeys) as
      BookArchiveEntry;
  });
}

export function coverArtworkSrcSet(
  work: WorkProfile,
  resolveUrl: (value: string) => string = (value) => value
) {
  if (
    !isCoverArtworkDisplayAllowed(work) ||
    !work.coverThumbnailUrl ||
    !work.coverUrl
  ) {
    return undefined;
  }

  return `${resolveUrl(work.coverThumbnailUrl)} ${work.coverThumbnailWidth || 400}w, ${resolveUrl(work.coverUrl)} ${work.coverWidth || 800}w`;
}

export function buildPublicBookArchive(countries: Country[]): BookArchiveEntry[] {
  return buildBookArchive(countries).filter(isPublicBook);
}
