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
import { selectBookText } from "./bookLocalization";
import { applyUserSuppliedBookCover } from "./userSuppliedBookCovers";

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
};

export type BookEnrichmentActionsPayload = {
  generatedAt: string;
  sourceManifestFingerprint: string;
  source: string;
  rejects: Array<{ recordKey: string; reasonCodes: string[] }>;
  merges: Array<{
    from: string;
    into: string;
    basis: string;
    preserveWriterRelation: boolean;
  }>;
};

const enrichmentActions =
  enrichmentActionsJson as BookEnrichmentActionsPayload;

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
            action.preserveWriterRelation === false)
      )
      .map((action) => [action.from, action.into])
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

  const fallbacksByTarget = new Map<string, WorkProfile[]>();
  for (const work of works) {
    const key = bookArchiveKey(countryId, writerId, work.id);
    if (rejected.has(key)) continue;
    const targetKey = terminalKey(key);
    if (targetKey === key) continue;
    if (!workByKey.has(targetKey)) continue;
    if (!fallbacksByTarget.has(targetKey)) {
      fallbacksByTarget.set(targetKey, []);
    }
    fallbacksByTarget.get(targetKey)!.push(work);
  }

  return works
    .filter((work) => {
      const key = bookArchiveKey(countryId, writerId, work.id);
      return !rejected.has(key) && terminalKey(key) === key;
    })
    .map((canonical) => {
      const key = bookArchiveKey(countryId, writerId, canonical.id);
      return {
        ...(fallbacksByTarget.get(key) || []).reduce(
          (combined, fallback) => ({ ...combined, ...fallback }),
          {} as WorkProfile
        ),
        ...canonical,
      };
    });
}

export function buildBookArchive(
  countries: Country[],
  options: BuildBookArchiveOptions = {}
): BookArchiveEntry[] {
  const includeReviewedGenerated = options.includeReviewedGenerated !== false;
  const shouldApplyEnrichmentActions = options.applyEnrichmentActions !== false;
  const includeUserSuppliedCovers = options.includeUserSuppliedCovers !== false;
  const archive = countries.flatMap((country) =>
    country.writers.flatMap((writer) => {
      const candidateGroups = [
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

      return canonicalWorks.map((work) => {
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
          writerName: writer.name || writer.fullName || "Автор",
          writer,
          country,
        };
      });
    })
  );

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

export function buildPublicBookArchive(countries: Country[]): BookArchiveEntry[] {
  return buildBookArchive(countries).filter(isPublicBook);
}
