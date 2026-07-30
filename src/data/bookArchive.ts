import type {
  Country,
  WorkProfile,
  WriterProfile,
} from "./countries/types";

export type BookArchiveEntry = WorkProfile & {
  countryId: string;
  countryName: string;
  writerId: string;
  writerName: string;
  writer: WriterProfile;
  country: Country;
};

const displayableCoverStatuses = new Set([
  "public-domain",
  "licensed",
  "permission",
  "editorial-original",
  "external-preview",
]);

export function isCoverDisplayAllowed(work: WorkProfile) {
  return Boolean(
    work.coverUrl &&
      work.coverRights &&
      displayableCoverStatuses.has(work.coverRights.status)
  );
}

function normalizeTitle(title: string) {
  return title
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/[«»"'.,:;!?()[\]{}]/g, "");
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

      return [...detailedWorks, ...legacyWorks].map((work) => ({
        ...work,
        countryId: country.id,
        countryName: country.name,
        writerId: writer.id,
        writerName: writer.name || writer.fullName || "Автор",
        writer,
        country,
      }));
    })
  );
}
