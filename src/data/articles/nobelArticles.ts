import type { Writer } from "../countries";
import { getNobelYear } from "../nobel";
import { articleCatalog, type ArticleCatalogEntry } from "./catalog";

const NOBEL_SIGNAL = /нобел|nobel/iu;
const YEAR_PATTERN = /\b(18|19|20)\d{2}\b/u;

export { getNobelYear, isNobelLaureate } from "../nobel";

function articleNobelYear(article: ArticleCatalogEntry) {
  if (article.sectionId !== "awards") return null;
  if (!/nobel--prize/iu.test(article.id) && !NOBEL_SIGNAL.test(article.title)) {
    return null;
  }

  const match = article.title.match(YEAR_PATTERN);
  return match ? Number(match[0]) : null;
}

export function findNobelArticle(writer: Writer): ArticleCatalogEntry | null {
  const year = getNobelYear(writer);
  if (!year) return null;

  return articleCatalog.find((article) => articleNobelYear(article) === year) || null;
}

export const nobelYearArticles = articleCatalog
  .map((article) => ({ article, year: articleNobelYear(article) }))
  .filter(
    (entry): entry is { article: ArticleCatalogEntry; year: number } =>
      entry.year !== null
  )
  .sort((first, second) => first.year - second.year);
