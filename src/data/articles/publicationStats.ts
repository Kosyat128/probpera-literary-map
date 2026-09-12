import type { ArticleCatalogEntry } from "./catalog";
import { articleCatalogEntryForLanguage } from "./localization";

// Count the same merged, publication-gated snapshot that supplies public cards.
export function articlePublicationCounts(catalog: readonly ArticleCatalogEntry[]) {
  return {
    ru: catalog.length,
    en: catalog.filter((article) => articleCatalogEntryForLanguage(article, "en"))
      .length,
  };
}

export function loadArticlePublicationCounts() {
  return import("./catalog").then(({ articleCatalog }) =>
    articlePublicationCounts(articleCatalog)
  );
}
