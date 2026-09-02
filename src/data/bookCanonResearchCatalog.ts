import { isPublicBook } from "./bookQuality";
import {
  bookCanonAdditionsBatch01Overlay,
  type BookCanonAdditionResearchOverlay,
} from "./countries/bookCanonAdditionsBatch01";
import { bookCanonLocHeldResearchBatch01Overlay } from "./countries/bookCanonLocHeldResearchBatch01";
import { bookArchiveCountries } from "./countries/index";
import type { Country, WorkAuthorCredit } from "./countries/types";

export type BookCanonResearchOverlay = BookCanonAdditionResearchOverlay;

export type BookCanonUnresolvedWriterLink = {
  authorIndex: number;
  countryId: string | null;
  writerId: string | null;
  key: string;
  creditNames: WorkAuthorCredit["creditNames"];
};

export type BookCanonResearchCatalogEntry = BookCanonResearchOverlay & {
  unresolvedWriterLinks: BookCanonUnresolvedWriterLink[];
  unresolvedAuthorityIds: string[];
  effectiveHoldCodes: string[];
};

export type BookCanonResearchCatalogSummary = {
  total: number;
  draftAdditions: number;
  acceptedMappings: number;
  holdRecords: number;
  visitorVisible: number;
  publicationEffect: number;
  canonClaims: number;
  unresolvedWriterLinks: number;
  unresolvedAuthorities: number;
};

function invariant(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(`book-canon-research-catalog:${code}`);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function activeWriterKeys(countries: readonly Country[]) {
  return new Set(
    countries.flatMap((country) =>
      country.writers.map((writer) => `${country.id}:${writer.id}`)
    )
  );
}

function unresolvedWriterLinks(
  overlay: BookCanonResearchOverlay,
  writerKeys: Set<string>
): BookCanonUnresolvedWriterLink[] {
  const authorship = overlay.work.authorship;
  if (!authorship) return [];
  if (
    (authorship.kind === "anonymous" || authorship.kind === "traditional") &&
    authorship.authors.length === 0
  ) {
    return [];
  }

  return authorship.authors.flatMap((author, authorIndex) => {
    const countryId = author.countryId?.trim() || null;
    const writerId = author.writerId?.trim() || null;
    const key = countryId && writerId
      ? `${countryId}:${writerId}`
      : `unlinked-credit:${overlay.candidateId}:${authorIndex + 1}`;
    if (countryId && writerId && writerKeys.has(key)) return [];
    return [
      {
        authorIndex,
        countryId,
        writerId,
        key,
        creditNames: author.creditNames
          ? { ...author.creditNames }
          : undefined,
      },
    ];
  });
}

function assertResearchOnlyOverlay(overlay: BookCanonResearchOverlay) {
  invariant(
    overlay.integrationStatus === "research-hold",
    `${overlay.candidateId}:integration-status`
  );
  invariant(
    overlay.publicationEffect === "none",
    `${overlay.candidateId}:publication-effect`
  );
  invariant(
    overlay.canonClaim === null,
    `${overlay.candidateId}:canon-claim`
  );
  invariant(
    overlay.work.editorial?.status === "draft",
    `${overlay.candidateId}:work-must-remain-draft`
  );
  invariant(
    overlay.work.canon === undefined,
    `${overlay.candidateId}:work-canon-must-be-absent`
  );
  invariant(
    overlay.work.localizedTitles === undefined,
    `${overlay.candidateId}:research-titles-cannot-enter-published-field`
  );
  invariant(
    overlay.titleResearch.ru.status === "verified-research",
    `${overlay.candidateId}:ru-title-status`
  );
  if (overlay.titleResearch.en.status === "withheld") {
    invariant(
      overlay.titleResearch.en.selectedValue === null &&
        overlay.work.translations?.en === undefined,
      `${overlay.candidateId}:withheld-en-title-leak`
    );
  }
}

/** Extension point for later independently reviewed research batches. */
export const defaultBookCanonResearchOverlays = Object.freeze([
  ...bookCanonAdditionsBatch01Overlay,
  ...bookCanonLocHeldResearchBatch01Overlay,
]);

/**
 * Builds a server/editorial research catalog without changing the visitor
 * archive. Callers may append independently reviewed overlay batches through
 * `overlays`; every record is re-gated here and remains a draft.
 */
export function buildBookCanonResearchCatalog(
  countries: readonly Country[],
  overlays: readonly BookCanonResearchOverlay[] =
    defaultBookCanonResearchOverlays
): BookCanonResearchCatalogEntry[] {
  const writerKeys = activeWriterKeys(countries);
  return overlays.map((overlay) => {
    assertResearchOnlyOverlay(overlay);
    const unresolvedAuthors = unresolvedWriterLinks(overlay, writerKeys);
    const unresolvedAuthorities = unique([...overlay.proposedAuthorityIds]);
    const effectiveHoldCodes = unique([
      ...overlay.publicationHoldCodes,
      ...overlay.canonHoldCodes,
      "research-catalog-only",
      "visitor-archive-excluded",
      ...(unresolvedAuthors.length > 0
        ? ["runtime-writer-links-unresolved"]
        : []),
      ...(unresolvedAuthorities.length > 0
        ? ["runtime-authority-review-required"]
        : []),
    ]);
    invariant(
      effectiveHoldCodes.length > 0,
      `${overlay.candidateId}:effective-holds-required`
    );
    return {
      ...overlay,
      registryHoldRef: { ...overlay.registryHoldRef },
      publicationHoldCodes: [...overlay.publicationHoldCodes],
      canonHoldCodes: [...overlay.canonHoldCodes],
      proposedAuthorityIds: [...overlay.proposedAuthorityIds],
      discoveryOnlySourceIds: [...overlay.discoveryOnlySourceIds],
      titleResearch: {
        ru: { ...overlay.titleResearch.ru },
        en: { ...overlay.titleResearch.en },
      },
      ...(overlay.descriptionResearch
        ? {
            descriptionResearch: {
              ru: { ...overlay.descriptionResearch.ru },
              en: { ...overlay.descriptionResearch.en },
            },
          }
        : {}),
      unresolvedWriterLinks: unresolvedAuthors,
      unresolvedAuthorityIds: unresolvedAuthorities,
      effectiveHoldCodes,
    };
  });
}

export function summarizeBookCanonResearchCatalog(
  entries: readonly BookCanonResearchCatalogEntry[]
): BookCanonResearchCatalogSummary {
  return {
    total: entries.length,
    draftAdditions: entries.filter(
      (entry) => entry.researchDisposition === "draft-addition"
    ).length,
    acceptedMappings: entries.filter(
      (entry) => entry.researchDisposition === "accepted-mapping"
    ).length,
    holdRecords: entries.filter(
      (entry) => entry.integrationStatus === "research-hold"
    ).length,
    visitorVisible: entries.filter((entry) => isPublicBook(entry.work)).length,
    publicationEffect: entries.filter(
      (entry) => entry.publicationEffect !== "none"
    ).length,
    canonClaims: entries.filter((entry) => entry.canonClaim !== null).length,
    unresolvedWriterLinks: entries.reduce(
      (total, entry) => total + entry.unresolvedWriterLinks.length,
      0
    ),
    unresolvedAuthorities: new Set(
      entries.flatMap((entry) => entry.unresolvedAuthorityIds)
    ).size,
  };
}

export const bookCanonResearchCatalog = Object.freeze(
  buildBookCanonResearchCatalog(bookArchiveCountries)
);

export const bookCanonResearchCatalogSummary = Object.freeze(
  summarizeBookCanonResearchCatalog(bookCanonResearchCatalog)
);
