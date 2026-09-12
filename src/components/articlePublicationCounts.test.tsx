import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleCatalogEntry, ArticleCatalogTranslation } from "../data/articles/catalog";
import type { GlobalSearchIndex } from "../search/globalSearchIndex";

const state = vi.hoisted(() => ({
  articles: [] as ArticleCatalogEntry[],
  language: "ru" as "ru" | "en",
  searchIndex: null as GlobalSearchIndex | null,
}));

vi.mock("../data/articles/catalog", async (importOriginal) => ({
  ...await importOriginal<typeof import("../data/articles/catalog")>(),
  articleCatalog: state.articles,
}));

vi.mock("../i18n/InterfaceLanguage", async (importOriginal) => {
  const original = await importOriginal<typeof import("../i18n/InterfaceLanguage")>();
  return {
    ...original,
    useInterfaceLanguage: () => ({
      language: state.language,
      t: (text: string) => original.translateInterfaceText(text, state.language),
      number: (value: number) => new Intl.NumberFormat(state.language).format(value),
      countryName: (_code: string, name: string) => name,
    }),
  };
});

vi.mock("../search/globalSearchRuntime", async (importOriginal) => ({
  ...await importOriginal<typeof import("../search/globalSearchRuntime")>(),
  peekSharedGlobalSearchIndex: () => state.searchIndex,
}));

import { mergeArticleCatalog } from "../data/articles/catalog";
import { articlePublicationCounts } from "../data/articles/publicationStats";
import { createGlobalSearchIndex } from "../search/globalSearchIndex";
import { translateInterfaceText } from "../i18n/InterfaceLanguage";
import ArticleLibrarySection from "./ArticleLibrarySection";
import SectionsDirectory from "./SectionsDirectory";
import GlobalSearch from "./GlobalSearch";

const translation: ArticleCatalogTranslation = {
  locale: "en",
  title: "Published English article",
  description: "An editorially approved translation.",
  sectionLabel: "Literature and culture",
  publishedLabel: "Published: 12 September 2026",
  readingMinutes: 1,
  wordCount: 100,
  headingCount: 0,
  translationStatus: "published",
};

function article(id: string, translated = false): ArticleCatalogEntry {
  return {
    id,
    title: `Публикация ${id}`,
    description: "Редакционный материал.",
    sectionId: "literary-essays",
    sectionLabel: "О литературе и культуре",
    publishedLabel: "Опубликовано: 12 сентября 2026",
    readingMinutes: 1,
    wordCount: 100,
    headingCount: 0,
    url: `https://probpera.ru/stati/o-literature/${id}/`,
    ...(translated ? { translations: { en: { ...translation, title: `Published article ${id}` } } } : {}),
  };
}

beforeEach(() => {
  state.language = "ru";
  state.articles.splice(0, state.articles.length,
    ...Array.from({ length: 13 }, (_, index) => article(`article-${index}`, index < 2)));
  state.searchIndex = null;
  vi.stubGlobal("window", {
    location: new URL("https://probpera.ru/"),
    localStorage: { getItem: () => null },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("public article counts", () => {
  it("counts migrated publications once and excludes withdrawn originals and unreleased translations", () => {
    const migrated = { ...article("cms-new", true), legacyId: "legacy-old" };
    const untranslated = {
      ...article("cms-draft-translation", true),
      translations: { en: { ...translation, translationStatus: "draft" } },
    } as unknown as ArticleCatalogEntry;
    const catalog = mergeArticleCatalog(
      [article("legacy-old"), article("legacy-withdrawn")],
      [migrated, untranslated],
      [{ legacyId: "legacy-withdrawn" }]
    );
    expect(articlePublicationCounts(catalog)).toEqual({ ru: 2, en: 1 });
    expect(articlePublicationCounts([])).toEqual({ ru: 0, en: 0 });
  });

  it.each(["ru", "en"] as const)("keeps the directory, journal total, tabs and found count aligned in %s", (language) => {
    state.language = language;
    const expectedCount = language === "ru" ? 13 : 2;
    const directory = renderToStaticMarkup(<SectionsDirectory
      sections={[{ id: "journal", group: "Журнал", title: "Журнал", copy: "", href: "/stati/", image: "", metric: "all-articles" }]}
      countryCount={0} bookCount={0} writerCount={0}
    />);
    const journal = renderToStaticMarkup(<ArticleLibrarySection />);
    expect(directory).toContain(`${expectedCount} ${language === "ru" ? "публикаций" : "publications"}`);
    expect(journal).toContain(`· ${expectedCount} ${language === "ru" ? "публикаций" : "publications"}`);
    expect(journal).toContain(`${language === "ru" ? "Все материалы" : "All publications"} <span>${expectedCount}</span>`);
    expect(journal).toContain(`<strong>${expectedCount}</strong>`);
    if (language === "ru") expect(journal).toContain("Показать ещё 1");
  });

  it("updates visible totals when another publication is added to the snapshot", () => {
    state.articles.push(article("newly-published", true));
    expect(articlePublicationCounts(state.articles)).toEqual({ ru: 14, en: 3 });
    const markup = renderToStaticMarkup(<ArticleLibrarySection />);
    expect(markup).toContain("· 14 публикаций");
    expect(markup).toContain("Показать ещё 2");
  });

  it.each(["ru", "en"] as const)("takes the search footer total from its loaded index in %s before the journal mounts", (language) => {
    state.language = language;
    state.searchIndex = createGlobalSearchIndex({
      countries: [], books: [], articles: state.articles, language,
      translate: (text) => translateInterfaceText(text, language),
      countryName: (_code, name) => name,
    });
    const markup = renderToStaticMarkup(<GlobalSearch
      open countries={[]} books={[]} onClose={() => {}}
      onCountrySelect={() => {}} onBookSelect={() => {}}
    />);
    expect(markup).toContain(language === "ru" ? "13 статей" : "2 articles");
  });
});
