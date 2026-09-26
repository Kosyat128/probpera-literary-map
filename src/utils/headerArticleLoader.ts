import type { ArticleCatalogEntry } from "../data/articles/catalog";
import { getCoreHomepageSection } from "../data/cms/homepage";
import { readShowcasePins } from "./headerArticleSelection";
let inFlight: Promise<ArticleCatalogEntry[]> | undefined;
export function loadHeaderArticleCatalog() {
  if (!inFlight) {
    inFlight = import("../data/articles/catalog")
      .then(({ articleCatalog }) => articleCatalog)
      .catch(error => { inFlight = undefined; throw error; });
  }
  return inFlight;
}
export const headerShowcasePins = readShowcasePins(getCoreHomepageSection("featured-journal")?.visualSettings?.headerShowcasePins);
