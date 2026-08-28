import { describe, expect, it, vi } from "vitest";

import type { BookArchiveEntry } from "../data/bookArchive";
import type { ArticleCatalogEntry } from "../data/articles/catalog";
import type { Country } from "../data/countries";
import type { InterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { GlobalSearchIndex } from "./globalSearchIndex";
import {
  createGlobalSearchRuntime,
  globalSearchArchiveVersion,
  globalSearchRequestCacheKey,
  type GlobalSearchBaseRequest,
} from "./globalSearchRuntime";

const countries: Country[] = [];
const books: BookArchiveEntry[] = [];

function request(
  language: InterfaceLanguage = "ru",
  archiveVersion: string = "archive-v1"
): GlobalSearchBaseRequest {
  return {
    countries,
    books,
    language,
    archiveVersion,
    translate: (value) => value,
    countryName: (_code, name) => name,
  };
}

function index(language: InterfaceLanguage, entityCount = 0): GlobalSearchIndex {
  return {
    language,
    articleCount: 0,
    entityCount,
    documents: [],
  };
}

describe("shared global search runtime", () => {
  it("does not import articles or build an index before search intent", () => {
    const loadArticles = vi.fn(() =>
      Promise.resolve<readonly ArticleCatalogEntry[]>([])
    );
    const createIndex = vi.fn(() => index("ru"));

    createGlobalSearchRuntime({ loadArticles, createIndex });

    expect(loadArticles).not.toHaveBeenCalled();
    expect(createIndex).not.toHaveBeenCalled();
  });

  it("shares one promise and one base object across concurrent consumers", async () => {
    let releaseArticles: (
      articles: readonly ArticleCatalogEntry[]
    ) => void = () => undefined;
    const pendingArticles = new Promise<readonly ArticleCatalogEntry[]>(
      (resolve) => {
        releaseArticles = resolve;
      }
    );
    const sharedIndex = index("ru", 12);
    const loadArticles = vi.fn(() => pendingArticles);
    const createIndex = vi.fn(() => sharedIndex);
    const runtime = createGlobalSearchRuntime({ loadArticles, createIndex });

    const headerPromise = runtime.ensure(request());
    const shelfPromise = runtime.ensure(request());

    expect(headerPromise).toBe(shelfPromise);
    expect(loadArticles).toHaveBeenCalledTimes(1);
    expect(createIndex).not.toHaveBeenCalled();

    releaseArticles([]);
    const [headerIndex, shelfIndex] = await Promise.all([
      headerPromise,
      shelfPromise,
    ]);

    expect(createIndex).toHaveBeenCalledTimes(1);
    expect(headerIndex).toBe(sharedIndex);
    expect(shelfIndex).toBe(sharedIndex);
    expect(runtime.peek(request())).toBe(sharedIndex);
  });

  it("adds personal facets and collections as an overlay without rebuilding base", async () => {
    const loadArticles = vi.fn(() =>
      Promise.resolve<readonly ArticleCatalogEntry[]>([])
    );
    const createIndex = vi.fn(() => index("ru", 2));
    const runtime = createGlobalSearchRuntime({ loadArticles, createIndex });
    const baseIndex = await runtime.ensure(request());

    const extended = runtime.extend(baseIndex, [
      { kind: "genre", id: "novel", label: "Роман" },
      {
        kind: "personal-shelf",
        id: "personal:favorites",
        label: "Избранное",
      },
    ]);

    expect(createIndex).toHaveBeenCalledTimes(1);
    expect(extended).not.toBe(baseIndex);
    expect(extended.entityCount).toBe(2);
    expect(extended.documents).toHaveLength(2);
    expect(baseIndex.documents).toHaveLength(0);
  });

  it("invalidates once for each locale or archive revision", async () => {
    const loadArticles = vi.fn(() =>
      Promise.resolve<readonly ArticleCatalogEntry[]>([])
    );
    const createIndex = vi.fn((options) => index(options.language));
    const runtime = createGlobalSearchRuntime({ loadArticles, createIndex });

    await Promise.all([
      runtime.ensure(request("ru", "archive-v1")),
      runtime.ensure(request("ru", "archive-v1")),
    ]);
    await Promise.all([
      runtime.ensure(request("en", "archive-v1")),
      runtime.ensure(request("en", "archive-v1")),
    ]);
    await Promise.all([
      runtime.ensure(request("en", "archive-v2")),
      runtime.ensure(request("en", "archive-v2")),
    ]);

    expect(loadArticles).toHaveBeenCalledTimes(3);
    expect(createIndex).toHaveBeenCalledTimes(3);
  });

  it("does not alias numeric and string archive revisions", () => {
    expect(globalSearchRequestCacheKey(request("ru", "1"))).not.toBe(
      globalSearchRequestCacheKey({ ...request("ru", "1"), archiveVersion: 1 })
    );
  });

  it("drops a rejected entry so an explicit retry can rebuild it", async () => {
    const loadArticles = vi
      .fn<() => Promise<readonly ArticleCatalogEntry[]>>()
      .mockRejectedValueOnce(new Error("catalog unavailable"))
      .mockResolvedValueOnce([]);
    const createIndex = vi.fn(() => index("ru", 3));
    const runtime = createGlobalSearchRuntime({ loadArticles, createIndex });

    await expect(runtime.ensure(request())).rejects.toThrow("catalog unavailable");
    await expect(runtime.ensure(request())).resolves.toMatchObject({
      entityCount: 3,
    });

    expect(loadArticles).toHaveBeenCalledTimes(2);
    expect(createIndex).toHaveBeenCalledTimes(1);
  });

  it("derives a stable cheap revision from immutable archive inputs", () => {
    const first = globalSearchArchiveVersion(countries, books);
    const second = globalSearchArchiveVersion(countries, books);
    const changed = globalSearchArchiveVersion([...countries], books);

    expect(first).toBe(second);
    expect(changed).not.toBe(first);
  });
});
