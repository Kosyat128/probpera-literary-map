import { normalizedPath } from "./article-route-policy.mjs";
import { cmsSourceArticleId } from "./cms-publication-state.mjs";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanLegacyPath(value) {
  const path = normalizedPath(cleanString(value));
  return path && path !== "/" ? path : "";
}

function cleanCanonicalPath(value) {
  const candidate = cleanString(value);
  if (!candidate) return "";
  try {
    const url = new URL(candidate, "https://probpera.ru");
    if (url.origin !== "https://probpera.ru") return "";
    const path = normalizedPath(url.pathname);
    return path && path !== "/" ? path : "";
  } catch {
    return "";
  }
}

function normalizeWithdrawal(value, label) {
  const cmsId = cleanString(value?.cmsId);
  if (!cmsSourceArticleId(cmsId)) {
    throw new Error(`${label} has an invalid CMS article identity: ${cmsId || "<empty>"}.`);
  }

  const legacyId = cleanString(value?.legacyId);
  const legacyPath = cleanLegacyPath(value?.legacyPath);
  const canonicalPath = cleanCanonicalPath(value?.canonicalPath);
  if (!canonicalPath) {
    throw new Error(`${label} has no valid canonical article path.`);
  }

  return {
    cmsId,
    canonicalPath,
    ...(legacyId ? { legacyId } : {}),
    ...(legacyPath ? { legacyPath } : {}),
  };
}

export function normalizeLegacyArticleWithdrawals(
  value,
  label = "CMS legacy article withdrawals"
) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} is not an array.`);

  const normalized = value.map((entry, index) =>
    normalizeWithdrawal(entry, `${label}[${index}]`)
  );
  const cmsIds = new Set();
  const legacyIds = new Set();
  const legacyPaths = new Set();
  const canonicalPaths = new Set();
  for (const entry of normalized) {
    if (cmsIds.has(entry.cmsId)) {
      throw new Error(`${label} contains duplicate CMS article ${entry.cmsId}.`);
    }
    cmsIds.add(entry.cmsId);
    if (entry.legacyId) {
      if (legacyIds.has(entry.legacyId)) {
        throw new Error(`${label} contains duplicate legacy article ${entry.legacyId}.`);
      }
      legacyIds.add(entry.legacyId);
    }
    if (entry.legacyPath) {
      if (legacyPaths.has(entry.legacyPath)) {
        throw new Error(`${label} contains duplicate legacy path ${entry.legacyPath}.`);
      }
      legacyPaths.add(entry.legacyPath);
    }
    if (canonicalPaths.has(entry.canonicalPath)) {
      throw new Error(
        `${label} contains duplicate canonical path ${entry.canonicalPath}.`
      );
    }
    canonicalPaths.add(entry.canonicalPath);
  }
  return normalized.sort((left, right) => left.cmsId.localeCompare(right.cmsId));
}

/**
 * Carries deployed legacy tombstones forward and adds newly verified CMS
 * withdrawals. A republished CMS row clears its old tombstone automatically.
 */
export function buildLegacyArticleWithdrawals({
  candidateArticles,
  baseline,
  removedIds,
}) {
  if (!Array.isArray(candidateArticles)) {
    throw new Error("Candidate CMS articles are not an array.");
  }
  if (!Array.isArray(removedIds)) {
    throw new Error("Verified CMS withdrawal IDs are not an array.");
  }

  const byCmsId = new Map(
    normalizeLegacyArticleWithdrawals(
      baseline?.withdrawnLegacyArticles,
      "deployed CMS legacy article withdrawals"
    ).map((entry) => [entry.cmsId, entry])
  );
  const baselineArticles = new Map(
    (Array.isArray(baseline?.articles) ? baseline.articles : []).map((article) => [
      cleanString(article?.id),
      article,
    ])
  );

  for (const cmsId of removedIds) {
    const article = baselineArticles.get(cmsId);
    if (!article) {
      throw new Error(`Verified CMS withdrawal ${cmsId} is absent from the deployed baseline.`);
    }
    const legacyId = cleanString(article.legacyId);
    const legacyPath = cleanLegacyPath(article.legacyPath);
    byCmsId.set(
      cmsId,
      normalizeWithdrawal(
        {
          cmsId,
          legacyId,
          legacyPath,
          canonicalPath: article.canonicalUrl || article.url,
        },
        `verified CMS withdrawal ${cmsId}`
      )
    );
  }

  const activeCmsIds = new Set(candidateArticles.map((article) => cleanString(article?.id)));
  const activeLegacyIds = new Set(
    candidateArticles.map((article) => cleanString(article?.legacyId)).filter(Boolean)
  );
  const activeLegacyPaths = new Set(
    candidateArticles.map((article) => cleanLegacyPath(article?.legacyPath)).filter(Boolean)
  );
  const activeCanonicalPaths = new Set(
    candidateArticles
      .map((article) => cleanCanonicalPath(article?.canonicalUrl || article?.url))
      .filter(Boolean)
  );

  return normalizeLegacyArticleWithdrawals(
    [...byCmsId.values()].filter(
      (entry) =>
        !activeCmsIds.has(entry.cmsId) &&
        !(entry.legacyId && activeLegacyIds.has(entry.legacyId)) &&
        !(entry.legacyPath && activeLegacyPaths.has(entry.legacyPath)) &&
        !activeCanonicalPaths.has(entry.canonicalPath)
    )
  );
}

export function legacyArticleWithdrawalFilters(value) {
  const withdrawals = normalizeLegacyArticleWithdrawals(value);
  return {
    legacyIds: new Set(withdrawals.map((entry) => entry.legacyId).filter(Boolean)),
    legacyPaths: new Set(
      withdrawals.map((entry) => entry.legacyPath).filter(Boolean)
    ),
    canonicalPaths: new Set(withdrawals.map((entry) => entry.canonicalPath)),
  };
}

export function partitionRedirectsByWithdrawnDestination(
  redirects,
  withdrawnLegacyArticles
) {
  if (!Array.isArray(redirects)) {
    throw new Error("CMS redirects are not an array.");
  }
  const { canonicalPaths } = legacyArticleWithdrawalFilters(
    withdrawnLegacyArticles
  );
  const allowed = [];
  const blocked = [];
  for (const [index, redirect] of redirects.entries()) {
    const destination = cleanString(redirect?.destinationPath);
    if (!destination) {
      throw new Error(`CMS redirect[${index}] has no destination.`);
    }
    let destinationPath = "";
    try {
      const url = new URL(destination, "https://probpera.ru");
      if (url.origin === "https://probpera.ru") {
        destinationPath = normalizedPath(url.pathname);
      }
    } catch {
      throw new Error(`CMS redirect[${index}] has an invalid destination.`);
    }
    (destinationPath && canonicalPaths.has(destinationPath) ? blocked : allowed).push(
      redirect
    );
  }
  return { allowed, blocked };
}
