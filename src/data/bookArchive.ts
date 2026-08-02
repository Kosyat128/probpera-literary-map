import type {
  Country,
  WorkProfile,
  WriterProfile,
} from "./countries/types";
import {
  cmsBookEditionsByWorkId,
  type CmsBookEdition,
} from "./cms/bookEditions";

export type BookArchiveEntry = WorkProfile & {
  countryId: string;
  countryName: string;
  writerId: string;
  writerName: string;
  writer: WriterProfile;
  country: Country;
};

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

function legacyWorkId(writerId: string, title: string, index: number) {
  const titlePart = normalizeTitle(title)
    .replace(/[^a-zа-яё0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `legacy-${writerId}-${titlePart || index}`;
}

export function buildBookArchive(countries: Country[]): BookArchiveEntry[] {
  return countries.flatMap((country) =>
    country.writers.flatMap((writer) => {
      const detailedWorks = writer.workDetails || [];
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

      return [...detailedWorks, ...legacyWorks].map((work) => {
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
}
