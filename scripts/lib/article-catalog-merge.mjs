import { normalizedPath } from "./article-route-policy.mjs";
import { legacyArticleWithdrawalFilters } from "./cms-legacy-withdrawals.mjs";

export function mergePublishedArticleCatalog(
  legacyArticles,
  cmsArticles,
  withdrawnLegacyArticles = []
) {
  if (!Array.isArray(legacyArticles) || !Array.isArray(cmsArticles)) {
    throw new Error("Published article catalogs must be arrays.");
  }
  const withdrawals = legacyArticleWithdrawalFilters(withdrawnLegacyArticles);
  const replacedIds = new Set([
    ...cmsArticles.map((article) => article.legacyId).filter(Boolean),
    ...withdrawals.legacyIds,
  ]);
  const replacedPaths = new Set([
    ...cmsArticles.map((article) => normalizedPath(article.legacyPath)).filter(Boolean),
    ...withdrawals.legacyPaths,
  ]);
  return [
    ...cmsArticles,
    ...legacyArticles.filter(
      (article) =>
        !replacedIds.has(article.id) &&
        !replacedPaths.has(normalizedPath(article.legacyPath || article.url))
    ),
  ];
}
