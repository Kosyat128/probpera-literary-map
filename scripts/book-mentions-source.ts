import {
  buildBookArchive,
  isCoverArtworkDisplayAllowed,
} from "../src/data/bookArchive";
import { isPublicBook } from "../src/data/bookQuality";
import {
  selectBookText,
  selectBookWriterName,
} from "../src/data/bookLocalization";
import { bookArchiveCountries } from "../src/data/countries";
import { articleCatalog as legacyArticleCatalog } from "../src/data/articles/catalog.generated";
import { cmsArticleCatalog } from "../src/data/articles/cms.generated";
import { cmsWithdrawnLegacyArticles } from "../src/data/articles/cms-withdrawals.generated";

const withdrawnLegacyArticles = cmsWithdrawnLegacyArticles as readonly {
  readonly cmsId: string;
  readonly canonicalPath?: string;
  readonly legacyId?: string;
  readonly legacyPath?: string;
}[];

function normalizedArticlePath(value?: string | null) {
  if (!value) return "";
  try {
    return new URL(value, "https://probpera.ru").pathname.replace(/\/+$/, "") || "/";
  } catch {
    return value.split(/[?#]/u)[0].replace(/\/+$/, "") || "/";
  }
}

const replacedLegacyIds = new Set(
  [
    ...cmsArticleCatalog.map((article) => article.legacyId),
    ...withdrawnLegacyArticles.map((article) => article.legacyId),
  ].filter((value): value is string => Boolean(value))
);
const replacedLegacyPaths = new Set(
  [...cmsArticleCatalog, ...withdrawnLegacyArticles]
    .map((article) => normalizedArticlePath(article.legacyPath))
    .filter(Boolean)
);

export const articles = [
  ...cmsArticleCatalog,
  ...legacyArticleCatalog.filter(
    (article) =>
      !replacedLegacyIds.has(article.id) &&
      !replacedLegacyPaths.has(normalizedArticlePath(article.url))
  ),
].map((article) => ({
  id: article.id,
  legacyId: "legacyId" in article ? article.legacyId : null,
  title: article.title,
  description: article.description,
  sectionId: article.sectionId,
  sectionLabel: article.sectionLabel,
  readingMinutes: article.readingMinutes,
  slug: "slug" in article ? article.slug : "",
  imageUrl: article.imageUrl || "",
}));

// Article payloads are immutable unless article work is explicitly requested.
// User-supplied archive covers therefore stay out of the generated mention index.
const articleBookArchive = buildBookArchive(bookArchiveCountries, {
  includeUserSuppliedCovers: false,
});

const publicArchive = new Map(
  articleBookArchive.filter(isPublicBook).map((entry) => [
    `${entry.countryId}:${entry.writerId}:${entry.id}`,
    entry,
  ])
);

export const archive = articleBookArchive.map((entry) => {
  const { country, writer, ...work } = entry;
  const key = `${entry.countryId}:${entry.writerId}:${entry.id}`;
  const publicEntry = publicArchive.get(key);

  if (!publicEntry) return work;

  const ru = selectBookText(publicEntry, "ru");
  const en = selectBookText(publicEntry, "en");

  return {
    ...work,
    recommendation: {
      key,
      countryId: publicEntry.countryId,
      writerId: publicEntry.writerId,
      bookId: publicEntry.id,
      firstPublished: publicEntry.firstPublished,
      coverUrl: isCoverArtworkDisplayAllowed(publicEntry)
        ? publicEntry.coverThumbnailUrl || publicEntry.coverUrl
        : undefined,
      localizations: {
        ru: {
          title: ru.title,
          writerName: selectBookWriterName(publicEntry, "ru"),
        },
        en: {
          title: en.title,
          writerName: selectBookWriterName(publicEntry, "en"),
        },
      },
    },
  };
});

export const writers = bookArchiveCountries.flatMap((country) =>
  country.writers.map((writer) => ({
    countryId: country.id,
    writerId: writer.id,
    writerName: writer.name || writer.fullName || "Автор",
  }))
);
