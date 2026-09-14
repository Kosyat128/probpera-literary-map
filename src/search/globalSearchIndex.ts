import {
  bookArchiveKey,
  getPublicWriterWorkTitles,
  type BookArchiveEntry,
} from "../data/bookArchive";
import { presentBookArchiveEntry } from "../data/bookArchiveQueue";
import { isPublicBook } from "../data/bookQuality";
import { getEvidenceBackedOppositeLocaleBookTitleAliases } from "../data/bookSearchAliases";
import { createBookAuthorSearchResolver } from "../data/bookAuthorSearch";
import {
  selectBookMetadataLabels,
  selectBookOriginalLanguage,
  selectBookWriterName,
} from "../data/bookLocalization";
import type { ArticleCatalogEntry } from "../data/articles/catalog";
import { articleCatalogEntryForLanguage } from "../data/articles/localization";
import type { Country, Writer } from "../data/countries";
import { writerBiographyText } from "../data/writerBiography";
import type { InterfaceLanguage } from "../i18n/InterfaceLanguage";
import {
  compileLiterarySearchFields,
  compileLiterarySearchQuery,
  compiledLiterarySearchMatchScore,
  type CompiledLiterarySearchFields,
  type CompiledLiterarySearchQuery,
  type LiterarySearchValue,
} from "../utils/literarySearch";
import { writerSearchLabel, writerSearchNames } from "../utils/writerSearchLabel";
import { mapSearchIndexInBatches } from "../utils/prepareSearchIndex";
export const globalSearchGroups = [
  "books",
  "writers",
  "countries",
  "genres",
  "audiences",
  "periods",
  "editorialShelves",
  "personalShelves",
  "articles",
] as const;

export type GlobalSearchGroup = (typeof globalSearchGroups)[number];

export type GlobalSearchBookFocusAction = {
  type: "focus-book";
  bookKey: string;
};

export type GlobalSearchActivateAction =
  | { type: "open-book"; bookKey: string }
  | {
      type: "select-writer";
      authorKey: string;
      countryId: string;
      writerId: string;
    }
  | { type: "select-country"; countryId: string }
  | {
      type: "apply-facet";
      facet: "genre" | "audience" | "period";
      ids: readonly string[];
    }
  | {
      type: "switch-collection";
      collectionKind: "editorial" | "personal";
      collectionId: string;
    }
  | { type: "navigate-article"; article: ArticleCatalogEntry };

type GlobalSearchResultBase<
  Kind extends string,
  Group extends GlobalSearchGroup,
> = {
  kind: Kind;
  group: Group;
  key: string;
  label: string;
};

export type GlobalSearchCountryResult = GlobalSearchResultBase<
  "country",
  "countries"
> & {
  country: Country;
  activateAction: Extract<
    GlobalSearchActivateAction,
    { type: "select-country" }
  >;
};

export type GlobalSearchWriterResult = GlobalSearchResultBase<
  "writer",
  "writers"
> & {
  country: Country;
  writer: Writer;
  activateAction: Extract<
    GlobalSearchActivateAction,
    { type: "select-writer" }
  >;
};

export type GlobalSearchBookResult = GlobalSearchResultBase<
  "book",
  "books"
> & {
  book: BookArchiveEntry;
  bookKey: string;
  focusAction: GlobalSearchBookFocusAction;
  activateAction: Extract<
    GlobalSearchActivateAction,
    { type: "open-book" }
  >;
};

export type GlobalSearchGenreResult = GlobalSearchResultBase<
  "genre",
  "genres"
> & {
  genreId: string;
  activateAction: Extract<
    GlobalSearchActivateAction,
    { type: "apply-facet" }
  >;
};

export type GlobalSearchAudienceResult = GlobalSearchResultBase<
  "audience",
  "audiences"
> & {
  audienceId: string;
  activateAction: Extract<
    GlobalSearchActivateAction,
    { type: "apply-facet" }
  >;
};

export type GlobalSearchPeriodResult = GlobalSearchResultBase<
  "period",
  "periods"
> & {
  periodId: string;
  activateAction: Extract<
    GlobalSearchActivateAction,
    { type: "apply-facet" }
  >;
};

export type GlobalSearchEditorialShelfResult = GlobalSearchResultBase<
  "editorial-shelf",
  "editorialShelves"
> & {
  collectionId: string;
  activateAction: Extract<
    GlobalSearchActivateAction,
    { type: "switch-collection" }
  >;
};

export type GlobalSearchPersonalShelfResult = GlobalSearchResultBase<
  "personal-shelf",
  "personalShelves"
> & {
  collectionId: string;
  activateAction: Extract<
    GlobalSearchActivateAction,
    { type: "switch-collection" }
  >;
};

export type GlobalSearchArticleResult = GlobalSearchResultBase<
  "article",
  "articles"
> & {
  article: ArticleCatalogEntry;
  activateAction: Extract<
    GlobalSearchActivateAction,
    { type: "navigate-article" }
  >;
};

export type GlobalSearchResult =
  | GlobalSearchCountryResult
  | GlobalSearchWriterResult
  | GlobalSearchBookResult
  | GlobalSearchGenreResult
  | GlobalSearchAudienceResult
  | GlobalSearchPeriodResult
  | GlobalSearchEditorialShelfResult
  | GlobalSearchPersonalShelfResult
  | GlobalSearchArticleResult;

export type GlobalSearchGroupedResults = {
  countries: GlobalSearchCountryResult[];
  writers: GlobalSearchWriterResult[];
  books: GlobalSearchBookResult[];
  genres: GlobalSearchGenreResult[];
  audiences: GlobalSearchAudienceResult[];
  periods: GlobalSearchPeriodResult[];
  editorialShelves: GlobalSearchEditorialShelfResult[];
  personalShelves: GlobalSearchPersonalShelfResult[];
  articles: GlobalSearchArticleResult[];
};

export type GlobalSearchProfile = {
  minQueryLength: number;
  groups: readonly GlobalSearchGroup[];
  groupLimits: Readonly<Partial<Record<GlobalSearchGroup, number>>>;
  suggestionLimit: number;
};

/** Preserves the current Header groups and exact per-group limits. */
export const HEADER_GLOBAL_SEARCH_PROFILE = {
  minQueryLength: 2,
  groups: ["countries", "writers", "books", "articles"],
  groupLimits: {
    countries: 5,
    writers: 7,
    books: 6,
    articles: 7,
  },
  suggestionLimit: 25,
} as const satisfies GlobalSearchProfile;

/** Complete Shelf global scope: bounded suggestions and full allMatches. */
export const BOOKS_GLOBAL_SEARCH_PROFILE = {
  minQueryLength: 2,
  groups: globalSearchGroups,
  groupLimits: {
    books: 10,
    writers: 10,
    countries: 10,
    genres: 10,
    audiences: 10,
    periods: 10,
    editorialShelves: 10,
    personalShelves: 10,
    articles: 10,
  },
  suggestionLimit: 10,
} as const satisfies GlobalSearchProfile;

/** Complete Shelf library scope: controlled shelf entities and facets only. */
export const BOOKS_LIBRARY_SEARCH_PROFILE = {
  minQueryLength: 2,
  groups: [
    "books",
    "writers",
    "countries",
    "genres",
    "audiences",
    "periods",
    "editorialShelves",
    "personalShelves",
  ],
  groupLimits: {
    books: 10,
    writers: 10,
    countries: 10,
    genres: 10,
    audiences: 10,
    periods: 10,
    editorialShelves: 10,
    personalShelves: 10,
  },
  suggestionLimit: 10,
} as const satisfies GlobalSearchProfile;

type GlobalSearchFacetExtension = {
  kind: "genre" | "audience" | "period";
  id: string;
  label: string;
  aliases?: readonly string[];
  keywords?: readonly string[];
};

type GlobalSearchCollectionExtension = {
  kind: "editorial-shelf" | "personal-shelf";
  id: string;
  label: string;
  aliases?: readonly string[];
  keywords?: readonly string[];
};

/**
 * Controlled IDs from the facet/collection owners. Raw book tags must not be
 * passed as ad-hoc filters; the caller supplies only validated entities.
 */
export type GlobalSearchExtensionDocument =
  | GlobalSearchFacetExtension
  | GlobalSearchCollectionExtension;

type SuggestionFields = {
  title?: LiterarySearchValue[];
  writer?: LiterarySearchValue[];
  original?: LiterarySearchValue[];
  alternate?: LiterarySearchValue[];
  country?: LiterarySearchValue[];
  verifiedMetadata?: LiterarySearchValue[];
};

type GlobalSearchDocumentInput = {
  result: GlobalSearchResult;
  primaryValues: LiterarySearchValue[];
  secondaryValues: LiterarySearchValue[];
  suggestionFields?: SuggestionFields;
};

type CompiledSuggestionFields = Partial<
  Record<keyof SuggestionFields, CompiledLiterarySearchFields>
>;

type IndexedGlobalSearchDocument = GlobalSearchDocumentInput & {
  readonly compiled: {
    readonly primary: CompiledLiterarySearchFields;
    readonly secondary: CompiledLiterarySearchFields;
    readonly suggestions: CompiledSuggestionFields;
  };
};

export type GlobalSearchIndex = {
  language: InterfaceLanguage;
  articleCount: number;
  entityCount: number;
  readonly documents: readonly IndexedGlobalSearchDocument[];
};

function compileDocument(document: GlobalSearchDocumentInput): IndexedGlobalSearchDocument {
  const suggestions: CompiledSuggestionFields = {};
  for (const field of Object.keys(document.suggestionFields || {}) as Array<keyof SuggestionFields>) {
    const values = document.suggestionFields?.[field];
    if (values) suggestions[field] = compileLiterarySearchFields(values);
  }
  return {
    ...document,
    compiled: {
      primary: compileLiterarySearchFields(document.primaryValues),
      secondary: compileLiterarySearchFields(document.secondaryValues),
      suggestions,
    },
  };
}

type IndexCollators = {
  language: InterfaceLanguage;
  labels: Intl.Collator;
  keys: Intl.Collator;
};

// Index-owned caches also support the existing lightweight empty indexes.
const indexCollators = new WeakMap<GlobalSearchIndex, IndexCollators>();

function collatorsForIndex(index: GlobalSearchIndex) {
  const current = indexCollators.get(index);
  if (current?.language === index.language) return current;
  const collators = {
    language: index.language,
    labels: new Intl.Collator(index.language),
    keys: new Intl.Collator("en"),
  };
  indexCollators.set(index, collators);
  return collators;
}

/**
 * Adds the small, caller-owned facet/collection layer without rebuilding the
 * shared countries, writers, books, and articles base index.
 */
export function extendGlobalSearchIndex(
  baseIndex: GlobalSearchIndex,
  extensions: readonly GlobalSearchExtensionDocument[]
): GlobalSearchIndex {
  if (!extensions.length) return baseIndex;

  const extensionDocuments = extensions.flatMap((extension) => {
    const document = extensionDocument(extension);
    return document ? [compileDocument(document)] : [];
  });
  if (!extensionDocuments.length) return baseIndex;

  const documents = [
    ...new Map(
      [...baseIndex.documents, ...extensionDocuments].map((document) => [
        document.result.key,
        document,
      ])
    ).values(),
  ];

  const extendedIndex: GlobalSearchIndex = {
    ...baseIndex,
    entityCount: documents.length,
    documents,
  };
  indexCollators.set(extendedIndex, collatorsForIndex(baseIndex));
  return extendedIndex;
}

export type CreateGlobalSearchIndexOptions = {
  countries: readonly Country[];
  books: readonly BookArchiveEntry[];
  language: InterfaceLanguage;
  translate: (russianText: string) => string;
  countryName: (code: string | undefined, russianName: string) => string;
  articles?: readonly ArticleCatalogEntry[];
  extensions?: readonly GlobalSearchExtensionDocument[];
};

type ArticleCatalogModule = {
  articleCatalog: readonly ArticleCatalogEntry[];
};

export type GlobalSearchArticleCatalogImporter =
  () => Promise<ArticleCatalogModule>;

export function createLazyGlobalSearchArticleCatalogLoader(
  importer: GlobalSearchArticleCatalogImporter
) {
  let catalogPromise: Promise<readonly ArticleCatalogEntry[]> | null = null;

  return function loadArticleCatalog() {
    if (!catalogPromise) {
      catalogPromise = importer()
        .then(({ articleCatalog }) => articleCatalog)
        .catch((error: unknown) => {
          catalogPromise = null;
          throw error;
        });
    }
    return catalogPromise;
  };
}

const loadSingletonArticleCatalog =
  createLazyGlobalSearchArticleCatalogLoader(
    () => import("../data/articles/catalog")
  );

/** One lazy article import shared by Header and Complete Shelf. */
export function loadGlobalSearchArticleCatalog() {
  return loadSingletonArticleCatalog();
}

export function localizeGlobalSearchArticles(
  articles: readonly ArticleCatalogEntry[],
  language: InterfaceLanguage
) {
  return articles.flatMap((article) => {
    const localized = articleCatalogEntryForLanguage(article, language);
    return localized ? [localized] : [];
  });
}

function extensionDocument(
  extension: GlobalSearchExtensionDocument
): GlobalSearchDocumentInput | null {
  const id = extension.id.trim();
  const label = extension.label.trim();
  if (!id || !label) return null;

  const primaryValues = [label, ...(extension.aliases || [])];
  const secondaryValues = [...(extension.keywords || [])];

  if (extension.kind === "genre") {
    return {
      result: {
        kind: "genre",
        group: "genres",
        key: ["genre", id].join(":"),
        genreId: id,
        label,
        activateAction: {
          type: "apply-facet",
          facet: "genre",
          ids: [id],
        },
      },
      primaryValues,
      secondaryValues,
    };
  }

  if (extension.kind === "audience") {
    return {
      result: {
        kind: "audience",
        group: "audiences",
        key: ["audience", id].join(":"),
        audienceId: id,
        label,
        activateAction: {
          type: "apply-facet",
          facet: "audience",
          ids: [id],
        },
      },
      primaryValues,
      secondaryValues,
    };
  }

  if (extension.kind === "period") {
    return {
      result: {
        kind: "period",
        group: "periods",
        key: ["period", id].join(":"),
        periodId: id,
        label,
        activateAction: {
          type: "apply-facet",
          facet: "period",
          ids: [id],
        },
      },
      primaryValues,
      secondaryValues,
    };
  }

  if (extension.kind === "editorial-shelf") {
    return {
      result: {
        kind: "editorial-shelf",
        group: "editorialShelves",
        key: ["editorial-shelf", id].join(":"),
        collectionId: id,
        label,
        activateAction: {
          type: "switch-collection",
          collectionKind: "editorial",
          collectionId: id,
        },
      },
      primaryValues,
      secondaryValues,
    };
  }

  return {
    result: {
      kind: "personal-shelf",
      group: "personalShelves",
      key: ["personal-shelf", id].join(":"),
      collectionId: id,
      label,
      activateAction: {
        type: "switch-collection",
        collectionKind: "personal",
        collectionId: id,
      },
    },
    primaryValues,
    secondaryValues,
  };
}

function* globalSearchDocuments({
  countries,
  books,
  language,
  translate,
  countryName,
  articles = [],
  extensions = [],
}: CreateGlobalSearchIndexOptions, counts: { articleCount: number }): Generator<GlobalSearchDocumentInput | null> {
  const bookAuthorNames = createBookAuthorSearchResolver(countries, language);
  for (const country of countries) {
    const localizedCountryName = countryName(country.code, country.name);
    yield {
      result: {
        kind: "country",
        group: "countries",
        key: ["country", country.id].join(":"),
        country,
        label: localizedCountryName,
        activateAction: {
          type: "select-country",
          countryId: country.id,
        },
      },
      primaryValues: [
        country.name,
        localizedCountryName,
        country.code,
        country.capital,
      ],
      secondaryValues: [
        country.region,
        country.continent,
        country.officialLanguage,
        country.description,
        country.history,
        country.historicalNote,
        ...(country.facts || []),
        ...(country.literaryPlaces || []),
        ...(country.literaryPeriods || []),
        ...(country.periods || []),
        ...(country.literaryMovements || []),
      ],
      suggestionFields: {
        country: [country.name, localizedCountryName],
      },
    };

    for (const writer of country.writers) {
      const label = writerSearchLabel(writer, language);
      if (!label) {
        yield null;
        continue;
      }
      const authorKey = [country.id, writer.id].join(":");
      const authorNames = writerSearchNames(writer, language);
      yield {
        result: {
          kind: "writer",
          group: "writers",
          key: ["writer", authorKey].join(":"),
          country,
          writer,
          label,
          activateAction: {
            type: "select-writer",
            authorKey,
            countryId: country.id,
            writerId: writer.id,
          },
        },
        primaryValues: [
          ...authorNames,
          ...getPublicWriterWorkTitles(writer, language),
        ],
        secondaryValues: [
          writer.years,
          writer.literaryEra,
          writer.literaryEra ? translate(writer.literaryEra) : "",
          writer.movement,
          writer.movement ? translate(writer.movement) : "",
          writerBiographyText(writer, language),
          ...(writer.genres || []),
          ...(writer.genres || []).map((genre) => translate(genre)),
          ...(writer.tags || []),
          ...(writer.tags || []).map((tag) => translate(tag)),
          ...(writer.awards || []),
          ...(writer.languages || []),
          ...(writer.places || []),
          country.name,
          localizedCountryName,
          country.code,
        ],
        suggestionFields: {
          writer: [...authorNames],
        },
      };
    }
  }

  for (const book of books) {
    if (!isPublicBook(book)) {
      yield null;
      continue;
    }
    const displayedBook = presentBookArchiveEntry(book, language);
    const currentAuthorNames = bookAuthorNames(book);
    const oppositeLocaleTitleAliases =
      getEvidenceBackedOppositeLocaleBookTitleAliases(book, language);
    const writerName = selectBookWriterName(
      book,
      language,
      translate("Автор")
    );
    const localizedCountryName = countryName(
      book.country.code,
      book.countryName
    );
    const verifiedMetadata = [
      displayedBook.description,
      selectBookOriginalLanguage(book, language),
      ...selectBookMetadataLabels(book, language, translate),
    ];
    const key = bookArchiveKey(
      book.countryId,
      book.writerId,
      book.id
    );

    yield {
      result: {
        kind: "book",
        group: "books",
        key: ["book", key].join(":"),
        book,
        bookKey: key,
        label: displayedBook.title,
        focusAction: {
          type: "focus-book",
          bookKey: key,
        },
        activateAction: {
          type: "open-book",
          bookKey: key,
        },
      },
      primaryValues: [
        displayedBook.title,
        book.originalTitle,
        writerName,
      ],
      secondaryValues: [
        localizedCountryName,
        ...currentAuthorNames,
        ...(book.alternateTitles || []),
        ...oppositeLocaleTitleAliases,
        ...verifiedMetadata,
      ],
      suggestionFields: {
        title: [displayedBook.title],
        writer: [writerName, ...currentAuthorNames],
        original: [book.originalTitle],
        alternate: [...(book.alternateTitles || []), ...oppositeLocaleTitleAliases],
        country: [
          localizedCountryName,
          book.countryName,
        ],
        verifiedMetadata,
      },
    };
  }

  for (const sourceArticle of articles) {
    const article = articleCatalogEntryForLanguage(sourceArticle, language);
    if (!article) {
      yield null;
      continue;
    }
    counts.articleCount += 1;
    yield {
      result: {
        kind: "article",
        group: "articles",
        key: ["article", article.id].join(":"),
        article,
        label: article.title,
        activateAction: {
          type: "navigate-article",
          article,
        },
      },
      primaryValues: [article.title],
      secondaryValues: [
        article.title,
        article.description,
        article.sectionLabel,
        article.seoTitle,
        article.seoDescription,
        ...(article.seoKeywords || []),
      ],
    };
  }

  for (const extension of extensions) {
    yield extensionDocument(extension);
  }
}

function finishGlobalSearchIndex(
  language: InterfaceLanguage,
  documents: readonly (IndexedGlobalSearchDocument | null)[],
  articleCount: number
): GlobalSearchIndex {
  const uniqueDocuments = new Map<string, IndexedGlobalSearchDocument>();
  for (const document of documents) {
    if (document) uniqueDocuments.set(document.result.key, document);
  }

  const index: GlobalSearchIndex = {
    language,
    articleCount,
    entityCount: uniqueDocuments.size,
    documents: [...uniqueDocuments.values()],
  };
  collatorsForIndex(index);
  return index;
}

function compileAvailableDocument(document: GlobalSearchDocumentInput | null) {
  return document ? compileDocument(document) : null;
}

/** Synchronous compatibility factory; both factories share all document gates. */
export function createGlobalSearchIndex(options: CreateGlobalSearchIndexOptions): GlobalSearchIndex {
  const counts = { articleCount: 0 };
  const documents = Array.from(globalSearchDocuments(options, counts), compileAvailableDocument);
  return finishGlobalSearchIndex(options.language, documents, counts.articleCount);
}

/** Yield before and between bounded batches of construction and compilation. */
export async function createGlobalSearchIndexAsync(
  options: CreateGlobalSearchIndexOptions,
  signal?: AbortSignal
): Promise<GlobalSearchIndex> {
  const counts = { articleCount: 0 };
  const documents = await mapSearchIndexInBatches(
    globalSearchDocuments(options, counts),
    compileAvailableDocument,
    { signal }
  );
  return finishGlobalSearchIndex(options.language, documents, counts.articleCount);
}

function emptyGroupedResults(): GlobalSearchGroupedResults {
  return {
    countries: [],
    writers: [],
    books: [],
    genres: [],
    audiences: [],
    periods: [],
    editorialShelves: [],
    personalShelves: [],
    articles: [],
  };
}

function fieldScore(
  query: CompiledLiterarySearchQuery,
  values: CompiledLiterarySearchFields | undefined
) {
  if (!values) return null;
  return compiledLiterarySearchMatchScore(query, values);
}

function globalSuggestionScore(
  query: CompiledLiterarySearchQuery,
  document: IndexedGlobalSearchDocument,
  fallbackScore: number
) {
  const fields = document.compiled.suggestions;
  const title = fieldScore(query, fields?.title);
  if (title === 0) return 0;
  if (title === 1) return 10;

  const writer = fieldScore(query, fields?.writer);
  if (writer === 0) {
    return document.result.kind === "writer" ? 20 : 21;
  }
  if (writer === 1) {
    return document.result.kind === "writer" ? 22 : 23;
  }

  const original = fieldScore(query, fields?.original);
  if (original === 0) return 30;
  if (original === 1) return 32;

  const alternate = fieldScore(query, fields?.alternate);
  if (alternate === 0) return 40;
  if (alternate === 1) return 42;

  if (document.result.kind === "genre") {
    return fallbackScore <= 1
      ? 45 + fallbackScore
      : 74 + fallbackScore;
  }
  if (document.result.kind === "audience") {
    return fallbackScore <= 1
      ? 47 + fallbackScore
      : 76 + fallbackScore;
  }
  if (document.result.kind === "period") {
    return fallbackScore <= 1
      ? 49 + fallbackScore
      : 78 + fallbackScore;
  }

  const country = fieldScore(query, fields?.country);
  if (country === 0) return 50;
  if (country === 1) return 52;

  const metadata = fieldScore(
    query,
    fields?.verifiedMetadata
  );
  if (metadata === 0) return 60;
  if (metadata === 1) return 62;

  if (document.result.kind === "article") {
    return 80 + fallbackScore;
  }
  if (
    document.result.kind === "editorial-shelf" ||
    document.result.kind === "personal-shelf"
  ) {
    return 70 + fallbackScore;
  }
  return 90 + fallbackScore;
}

const suggestionGroupPriority:
  Record<GlobalSearchGroup, number> = {
    books: 0,
    writers: 1,
    countries: 2,
    genres: 3,
    audiences: 4,
    periods: 5,
    editorialShelves: 6,
    personalShelves: 7,
    articles: 8,
  };

function compareLabels(
  first: IndexedGlobalSearchDocument,
  second: IndexedGlobalSearchDocument,
  collators: IndexCollators
) {
  return (
    collators.labels.compare(first.result.label, second.result.label) ||
    collators.keys.compare(first.result.key, second.result.key)
  );
}

type ScoredDocument = {
  document: IndexedGlobalSearchDocument;
  score: number;
  suggestionScore: number;
};

function pushGroupedResult(
  groups: GlobalSearchGroupedResults,
  result: GlobalSearchResult
) {
  (
    groups[result.group] as unknown as
      GlobalSearchResult[]
  ).push(result);
}

export type GlobalSearchResponse = {
  normalizedQuery: string;
  groups: GlobalSearchGroupedResults;
  suggestions: GlobalSearchResult[];
  allMatches: GlobalSearchResult[];
  totalMatches: number;
};

export function searchGlobalSearchIndex(
  index: GlobalSearchIndex,
  query: string,
  profile: GlobalSearchProfile =
    HEADER_GLOBAL_SEARCH_PROFILE
): GlobalSearchResponse {
  const compiledQuery = compileLiterarySearchQuery(query);
  const { normalizedQuery } = compiledQuery;
  const empty = emptyGroupedResults();

  if (normalizedQuery.length < profile.minQueryLength) {
    return {
      normalizedQuery,
      groups: empty,
      suggestions: [],
      allMatches: [],
      totalMatches: 0,
    };
  }

  const allowedGroups = new Set(profile.groups);
  const collators = collatorsForIndex(index);
  const scored = index.documents.flatMap<ScoredDocument>(
    (document) => {
      if (!allowedGroups.has(document.result.group)) {
        return [];
      }
      const score = compiledLiterarySearchMatchScore(
        compiledQuery,
        document.compiled.primary,
        document.compiled.secondary
      );
      if (score === null) return [];

      return [
        {
          document,
          score,
          suggestionScore: globalSuggestionScore(
            compiledQuery,
            document,
            score
          ),
        },
      ];
    }
  );

  const groups = emptyGroupedResults();
  for (const group of profile.groups) {
    const groupMatches = scored
      .filter(
        ({ document }) =>
          document.result.group === group
      )
      .sort(
        (first, second) =>
          first.score - second.score ||
          compareLabels(
            first.document,
            second.document,
            collators
          )
      );

    const configuredLimit =
      profile.groupLimits[group] ??
      groupMatches.length;
    const limit = Math.max(0, configuredLimit);
    for (
      const { document } of groupMatches.slice(0, limit)
    ) {
      pushGroupedResult(groups, document.result);
    }
  }

  const globallyRanked = [...scored].sort(
    (first, second) =>
      first.suggestionScore - second.suggestionScore ||
      suggestionGroupPriority[
        first.document.result.group
      ] -
        suggestionGroupPriority[
          second.document.result.group
        ] ||
      compareLabels(
        first.document,
        second.document,
        collators
      )
  );
  const allMatches = globallyRanked.map(
    ({ document }) => document.result
  );

  return {
    normalizedQuery,
    groups,
    suggestions: allMatches.slice(
      0,
      Math.max(0, profile.suggestionLimit)
    ),
    allMatches,
    totalMatches: allMatches.length,
  };
}
