import type { WorkLocale } from "../data/countries/types";

export const BOOK_EDITORIAL_PAGE_DATA_VERSION = "book-editorial-pages-v1" as const;
export const BOOK_EDITORIAL_MAX_PAGES = 4 as const;

export type BookEditorialLocale = WorkLocale;

export type BookEditorialVerifiedValue<T> = Readonly<{
  value: T;
  verified: true;
  sourceUrls?: readonly string[];
}>;

export const bookEditorialMetadataKinds = [
  "publisher",
  "edition",
  "isbn",
  "format",
  "pages",
  "binding",
  "genre",
] as const;

export type BookEditorialMetadataKind =
  (typeof bookEditorialMetadataKinds)[number];

export type BookEditorialMetadata = Readonly<{
  kind: BookEditorialMetadataKind;
  value: string | number;
  verified: true;
  sourceUrls?: readonly string[];
}>;

export type BookEditorialSourceRights = Readonly<{
  provider: string;
  sourceUrl: string;
  verified: true;
  usage: "structured-data" | "reference-only" | "licensed-copy";
  license?: string;
  rightsHolder?: string;
}>;

export type BookEditorialPageInput = Readonly<{
  bookKey: string;
  locale: BookEditorialLocale;
  themeVersion: string;
  pageDataVersion?: string;
  title: string;
  writer: string;
  year?: BookEditorialVerifiedValue<number>;
  language?: BookEditorialVerifiedValue<string>;
  country?: BookEditorialVerifiedValue<string>;
  metadata?: readonly BookEditorialMetadata[];
  description?: BookEditorialVerifiedValue<string>;
  sourceRights?: readonly BookEditorialSourceRights[];
}>;

export type BookEditorialRow = Readonly<{
  kind:
    | "writer"
    | "year"
    | "language"
    | "country"
    | BookEditorialMetadataKind;
  label: string;
  value: string;
}>;

export type BookEditorialSourceLine = Readonly<{
  provider: string;
  sourceUrl: string;
  usageLabel: string;
  license?: string;
  rightsHolder?: string;
}>;

export type BookEditorialPage = Readonly<{
  id: "identity" | "details" | "description" | "provenance";
  index: number;
  eyebrow: string;
  title: string;
  rows: readonly BookEditorialRow[];
  paragraphs: readonly string[];
  sources: readonly BookEditorialSourceLine[];
}>;

export type BookEditorialDocument = Readonly<{
  bookKey: string;
  locale: BookEditorialLocale;
  themeVersion: string;
  pageDataVersion: string;
  cacheKey: string;
  pages: readonly BookEditorialPage[];
}>;

type EditorialLabels = Readonly<{
  work: string;
  author: string;
  details: string;
  year: string;
  language: string;
  country: string;
  description: string;
  provenance: string;
  metadata: Readonly<Record<BookEditorialMetadataKind, string>>;
  usage: Readonly<Record<BookEditorialSourceRights["usage"], string>>;
}>;

const labels: Readonly<Record<BookEditorialLocale, EditorialLabels>> = {
  ru: {
    work: "Произведение",
    author: "Автор",
    details: "Сведения об издании",
    year: "Первая публикация",
    language: "Язык оригинала",
    country: "Страна",
    description: "Редакционное описание",
    provenance: "Источники и права",
    metadata: {
      publisher: "Издатель",
      edition: "Издание",
      isbn: "ISBN",
      format: "Формат",
      pages: "Страниц",
      binding: "Переплёт",
      genre: "Жанр",
    },
    usage: {
      "structured-data": "структурированные данные",
      "reference-only": "только сверка фактов",
      "licensed-copy": "лицензированный материал",
    },
  },
  en: {
    work: "Work",
    author: "Author",
    details: "Edition details",
    year: "First published",
    language: "Original language",
    country: "Country",
    description: "Editorial description",
    provenance: "Sources and rights",
    metadata: {
      publisher: "Publisher",
      edition: "Edition",
      isbn: "ISBN",
      format: "Format",
      pages: "Pages",
      binding: "Binding",
      genre: "Genre",
    },
    usage: {
      "structured-data": "structured data",
      "reference-only": "fact-checking only",
      "licensed-copy": "licensed material",
    },
  },
};

const metadataOrder = new Map<BookEditorialMetadataKind, number>(
  bookEditorialMetadataKinds.map((kind, index) => [kind, index])
);

function normalizedText(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maximumLength)
    .trim();
}

function verifiedText(
  field: BookEditorialVerifiedValue<string> | undefined,
  maximumLength: number
) {
  return field?.verified === true
    ? normalizedText(field.value, maximumLength)
    : "";
}

function normalizedSourceUrl(value: unknown) {
  const candidate = normalizedText(value, 2_048);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password
    ) {
      return "";
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function encodedCachePart(value: string) {
  return encodeURIComponent(normalizedText(value, 240));
}

/**
 * The document cache identity is deliberately made only from the four pinned
 * inputs. Page index and quality belong to the downstream texture cache.
 */
export function createBookEditorialPageCacheKey(input: {
  bookKey: string;
  locale: BookEditorialLocale;
  themeVersion: string;
  pageDataVersion: string;
}) {
  return [
    `book=${encodedCachePart(input.bookKey)}`,
    `locale=${input.locale}`,
    `theme=${encodedCachePart(input.themeVersion)}`,
    `data=${encodedCachePart(input.pageDataVersion)}`,
  ].join("|");
}

function freezePage(
  page: Omit<BookEditorialPage, "index">,
  index: number
): BookEditorialPage {
  return Object.freeze({
    ...page,
    index,
    rows: Object.freeze([...page.rows]),
    paragraphs: Object.freeze([...page.paragraphs]),
    sources: Object.freeze([...page.sources]),
  });
}

function normalizedMetadata(
  values: readonly BookEditorialMetadata[] | undefined,
  locale: BookEditorialLocale
) {
  const selectedLabels = labels[locale].metadata;
  const seen = new Set<string>();
  return (values || [])
    .flatMap((entry) => {
      if (
        entry?.verified !== true ||
        !bookEditorialMetadataKinds.includes(entry.kind) ||
        (typeof entry.value !== "string" && typeof entry.value !== "number") ||
        (typeof entry.value === "number" && !Number.isFinite(entry.value))
      ) {
        return [];
      }
      const value = normalizedText(String(entry.value), 160);
      if (!value) return [];
      const identity = `${entry.kind}\u0000${value.toLocaleLowerCase(locale)}`;
      if (seen.has(identity)) return [];
      seen.add(identity);
      return [
        Object.freeze({
          kind: entry.kind,
          label: selectedLabels[entry.kind],
          value,
        }) satisfies BookEditorialRow,
      ];
    })
    .sort((first, second) => {
      const byKind =
        (metadataOrder.get(first.kind as BookEditorialMetadataKind) || 0) -
        (metadataOrder.get(second.kind as BookEditorialMetadataKind) || 0);
      return byKind || first.value.localeCompare(second.value, locale);
    })
    .slice(0, bookEditorialMetadataKinds.length);
}

function normalizedSources(
  values: readonly BookEditorialSourceRights[] | undefined,
  locale: BookEditorialLocale
) {
  const seen = new Set<string>();
  return (values || [])
    .flatMap((entry) => {
      if (entry?.verified !== true) return [];
      const provider = normalizedText(entry?.provider, 120);
      const sourceUrl = normalizedSourceUrl(entry?.sourceUrl);
      if (!provider || !sourceUrl || !labels[locale].usage[entry.usage]) return [];
      const identity = `${provider.toLocaleLowerCase(locale)}\u0000${sourceUrl}`;
      if (seen.has(identity)) return [];
      seen.add(identity);
      const license = normalizedText(entry.license, 160) || undefined;
      const rightsHolder = normalizedText(entry.rightsHolder, 160) || undefined;
      return [
        Object.freeze({
          provider,
          sourceUrl,
          usageLabel: labels[locale].usage[entry.usage],
          ...(license ? { license } : {}),
          ...(rightsHolder ? { rightsHolder } : {}),
        }) satisfies BookEditorialSourceLine,
      ];
    })
    .sort(
      (first, second) =>
        first.provider.localeCompare(second.provider, locale) ||
        first.sourceUrl.localeCompare(second.sourceUrl, "en")
    )
    .slice(0, 6);
}

/**
 * Builds short, finite editorial matter. It never accepts or manufactures the
 * work text: optional facts enter only through runtime-checked `verified`
 * records, and absent fields simply produce no row/page.
 */
export function buildBookEditorialDocument(
  input: BookEditorialPageInput
): BookEditorialDocument {
  const locale: BookEditorialLocale = input.locale === "en" ? "en" : "ru";
  const selectedLabels = labels[locale];
  const bookKey = normalizedText(input.bookKey, 240);
  const title = normalizedText(input.title, 240);
  const writer = normalizedText(input.writer, 160);
  const themeVersion = normalizedText(input.themeVersion, 120);
  if (!bookKey || !title || !writer || !themeVersion) {
    throw new TypeError(
      "Book editorial pages require a confirmed book key, title, writer and theme version."
    );
  }
  const pageDataVersion =
    normalizedText(input.pageDataVersion, 120) ||
    BOOK_EDITORIAL_PAGE_DATA_VERSION;
  const pages: BookEditorialPage[] = [];

  pages.push(
    freezePage(
      {
        id: "identity",
        eyebrow: selectedLabels.work,
        title,
        rows: [
          Object.freeze({
            kind: "writer",
            label: selectedLabels.author,
            value: writer,
          }),
        ],
        paragraphs: [],
        sources: [],
      },
      pages.length
    )
  );

  const details: BookEditorialRow[] = [];
  if (
    input.year?.verified === true &&
    Number.isInteger(input.year.value) &&
    input.year.value >= 1 &&
    input.year.value <= 2_100
  ) {
    details.push(
      Object.freeze({
        kind: "year",
        label: selectedLabels.year,
        value: String(input.year.value),
      })
    );
  }
  const language = verifiedText(input.language, 120);
  if (language) {
    details.push(
      Object.freeze({
        kind: "language",
        label: selectedLabels.language,
        value: language,
      })
    );
  }
  const country = verifiedText(input.country, 120);
  if (country) {
    details.push(
      Object.freeze({
        kind: "country",
        label: selectedLabels.country,
        value: country,
      })
    );
  }
  details.push(...normalizedMetadata(input.metadata, locale));
  if (details.length > 0) {
    pages.push(
      freezePage(
        {
          id: "details",
          eyebrow: selectedLabels.work,
          title: selectedLabels.details,
          rows: details,
          paragraphs: [],
          sources: [],
        },
        pages.length
      )
    );
  }

  const description = verifiedText(input.description, 900);
  if (description) {
    pages.push(
      freezePage(
        {
          id: "description",
          eyebrow: selectedLabels.work,
          title: selectedLabels.description,
          rows: [],
          paragraphs: [description],
          sources: [],
        },
        pages.length
      )
    );
  }

  const sources = normalizedSources(input.sourceRights, locale);
  if (sources.length > 0) {
    pages.push(
      freezePage(
        {
          id: "provenance",
          eyebrow: selectedLabels.work,
          title: selectedLabels.provenance,
          rows: [],
          paragraphs: [],
          sources,
        },
        pages.length
      )
    );
  }

  const cacheKey = createBookEditorialPageCacheKey({
    bookKey,
    locale,
    themeVersion,
    pageDataVersion,
  });

  return Object.freeze({
    bookKey,
    locale,
    themeVersion,
    pageDataVersion,
    cacheKey,
    pages: Object.freeze(pages.slice(0, BOOK_EDITORIAL_MAX_PAGES)),
  });
}
