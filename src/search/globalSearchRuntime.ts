import type { BookArchiveEntry } from "../data/bookArchive";
import type { Country } from "../data/countries";
import type { InterfaceLanguage } from "../i18n/InterfaceLanguage";
import {
  createGlobalSearchIndexAsync,
  extendGlobalSearchIndex,
  loadGlobalSearchArticleCatalog,
  type CreateGlobalSearchIndexOptions,
  type GlobalSearchExtensionDocument,
  type GlobalSearchIndex,
} from "./globalSearchIndex";

export type GlobalSearchArchiveVersion = string | number;

export type GlobalSearchBaseRequest = Omit<
  CreateGlobalSearchIndexOptions,
  "articles" | "extensions"
> & {
  archiveVersion: GlobalSearchArchiveVersion;
};

type GlobalSearchRuntimeDependencies = {
  loadArticles: typeof loadGlobalSearchArticleCatalog;
  createIndex: (
    options: CreateGlobalSearchIndexOptions,
    signal?: AbortSignal
  ) => GlobalSearchIndex | Promise<GlobalSearchIndex>;
};

export type GlobalSearchRuntime = {
  ensure: (request: GlobalSearchBaseRequest) => Promise<GlobalSearchIndex>;
  peek: (request: GlobalSearchBaseRequest) => GlobalSearchIndex | null;
  extend: (
    baseIndex: GlobalSearchIndex,
    extensions: readonly GlobalSearchExtensionDocument[]
  ) => GlobalSearchIndex;
};

type RuntimeEntry = {
  key: string;
  promise: Promise<GlobalSearchIndex>;
  index: GlobalSearchIndex | null;
  controller: AbortController;
};

export function globalSearchRequestCacheKey(request: GlobalSearchBaseRequest) {
  return `${request.language}:${typeof request.archiveVersion}:${String(request.archiveVersion)}`;
}

/**
 * Creates the demand-owned search runtime. Calling ensure is the only operation
 * that imports articles or builds the base index; concurrent consumers share
 * the exact same promise and resulting object.
 */
export function createGlobalSearchRuntime(
  dependencies: GlobalSearchRuntimeDependencies = {
    loadArticles: loadGlobalSearchArticleCatalog,
    createIndex: createGlobalSearchIndexAsync,
  }
): GlobalSearchRuntime {
  let entry: RuntimeEntry | null = null;

  const ensure = (request: GlobalSearchBaseRequest) => {
    const key = globalSearchRequestCacheKey(request);
    if (entry?.key === key) return entry.promise;
    if (entry && !entry.index) entry.controller.abort();
    const controller = new AbortController();
    const assertCurrentPreparation = () => {
      if (controller.signal.aborted) {
        throw controller.signal.reason ?? new DOMException("Search preparation superseded", "AbortError");
      }
    };

    const promise = dependencies
      .loadArticles()
      .then((articles) => {
        assertCurrentPreparation();
        return dependencies.createIndex({
          countries: request.countries,
          books: request.books,
          language: request.language,
          translate: request.translate,
          countryName: request.countryName,
          articles,
        }, controller.signal);
      })
      .then((index) => {
        assertCurrentPreparation();
        return index;
      });
    const nextEntry: RuntimeEntry = {
      key,
      promise,
      index: null,
      controller,
    };
    entry = nextEntry;

    // Observe every rejection here as well as in UI consumers. Aborting an old
    // request cannot leave an unhandled rejection or clear a newer cache entry.
    promise.then(
      (index) => {
        if (entry === nextEntry) nextEntry.index = index;
      },
      () => {
        if (entry === nextEntry) entry = null;
      }
    );

    return promise;
  };

  return {
    ensure,
    peek(request) {
      return entry?.key === globalSearchRequestCacheKey(request)
        ? entry.index
        : null;
    },
    extend: extendGlobalSearchIndex,
  };
}

let nextArchiveObjectId = 1;
const archiveObjectIds = new WeakMap<object, number>();

function archiveObjectId(value: object) {
  const existing = archiveObjectIds.get(value);
  if (existing) return existing;
  const id = nextArchiveObjectId;
  nextArchiveObjectId += 1;
  archiveObjectIds.set(value, id);
  return id;
}

/**
 * Both App consumers receive the same immutable country/book arrays. Their
 * object identities therefore form a cheap archive revision without hashing
 * the complete 10k-book catalog during render.
 */
export function globalSearchArchiveVersion(
  countries: readonly Country[],
  books: readonly BookArchiveEntry[]
) {
  return `${archiveObjectId(countries)}:${archiveObjectId(books)}`;
}

export function emptyGlobalSearchIndex(
  language: InterfaceLanguage
): GlobalSearchIndex {
  return {
    language,
    articleCount: 0,
    entityCount: 0,
    documents: [],
  };
}

const sharedGlobalSearchRuntime = createGlobalSearchRuntime();

export const ensureSharedGlobalSearchIndex =
  sharedGlobalSearchRuntime.ensure;
export const peekSharedGlobalSearchIndex = sharedGlobalSearchRuntime.peek;
export const extendSharedGlobalSearchIndex = sharedGlobalSearchRuntime.extend;
