import configuredArticleSectionSlugs from "../data/articles/sectionRoutes.json";

const basePath = import.meta.env.BASE_URL.replace(/\/+$/, "");

const transliteration: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

const articleSectionSlugs: Record<string, string> =
  configuredArticleSectionSlugs;

function shortStableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 6);
}

export function humanSlug(value: string) {
  return value
    .toLocaleLowerCase("ru")
    .split("")
    .map((letter) => transliteration[letter] ?? letter)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 115);
}

function legacyArticleSeoSlug(articleId: string, title: string) {
  return `${humanSlug(title) || "material"}-${shortStableHash(articleId)}`;
}

export function articleSeoSlug(articleId: string, title: string) {
  void articleId;
  return humanSlug(title) || "material";
}

export function articleSectionSlug(sectionId?: string) {
  return articleSectionSlugs[sectionId || ""] || "materialy";
}

export function articleSectionArchivePath(sectionId?: string) {
  return sectionId && sectionId !== "all"
    ? `/stati/${articleSectionSlug(sectionId)}/`
    : "/stati/";
}

export function articlePublicPath(
  articleId: string,
  title: string,
  sectionId?: string,
  preferredSlug?: string
) {
  const routeSlug =
    preferredSlug && /^[a-z0-9][a-z0-9-]{1,179}$/u.test(preferredSlug)
      ? preferredSlug
      : articleSeoSlug(articleId, title);
  return `/stati/${articleSectionSlug(sectionId)}/${encodeURIComponent(
    routeSlug
  )}/`;
}

export function articlePath(
  articleId: string,
  title: string,
  sectionId?: string,
  preferredSlug?: string
) {
  return `${basePath}${articlePublicPath(
    articleId,
    title,
    sectionId,
    preferredSlug
  )}`;
}

export function isDirectArticlePath(pathname: string) {
  return /\/(?:stati\/[^/]+\/[^/]+|articles\/[^/]+)\/?$/iu.test(pathname);
}

export function journalSectionFromPath(pathname = window.location.pathname) {
  const normalizedBase = basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const archiveMatch = pathname.match(
    new RegExp(`^${normalizedBase}/stati(?:/([^/]+))?/?$`, "i")
  );
  if (!archiveMatch) return null;
  if (!archiveMatch[1]) return "all";
  const requestedSlug = decodedRouteSegment(archiveMatch[1]);
  if (!requestedSlug) return null;
  return (
    Object.entries(articleSectionSlugs).find(
      ([, sectionSlug]) => sectionSlug === requestedSlug
    )?.[0] || null
  );
}

export function articleIdFromPath(
  catalog: ArticleRouteCatalogEntry[],
  pathname = window.location.pathname
) {
  return resolveArticleRoute(catalog, pathname)?.articleId || null;
}

type ArticleRouteCatalogEntry = {
  id: string;
  title: string;
  sectionId?: string;
  slug?: string;
  sourceSlug?: string;
  translations?: Readonly<{
    en?: {
      title: string;
      slug?: string;
      translationStatus?: string;
    };
  }>;
};

export type ArticleRouteResolution = {
  articleId: string;
  canonicalPath: string;
  isCanonical: boolean;
};

function decodedRouteSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function routeCandidates(article: ArticleRouteCatalogEntry) {
  const canonicalSlug =
    article.slug && /^[a-z0-9][a-z0-9-]{1,179}$/u.test(article.slug)
      ? article.slug
      : articleSeoSlug(article.id, article.title);
  const candidates = [
    article.id,
    article.slug,
    article.sourceSlug,
    articleSeoSlug(article.id, article.title),
    legacyArticleSeoSlug(article.id, article.title),
  ]
    .filter((value): value is string => Boolean(value))
    .map((slug) => ({ slug, canonicalSlug }));

  const englishTranslation = article.translations?.en;
  const englishIsReleased =
    englishTranslation?.translationStatus === "approved" ||
    englishTranslation?.translationStatus === "published";
  if (englishTranslation && englishIsReleased) {
    const englishCanonicalSlug =
      englishTranslation.slug &&
      /^[a-z0-9][a-z0-9-]{1,179}$/u.test(englishTranslation.slug)
        ? englishTranslation.slug
        : articleSeoSlug(article.id, englishTranslation.title);
    for (const slug of [
      englishTranslation.slug,
      articleSeoSlug(article.id, englishTranslation.title),
    ]) {
      if (slug) candidates.push({ slug, canonicalSlug: englishCanonicalSlug });
    }
  }
  return candidates;
}

export function resolveArticleRoute(
  catalog: ArticleRouteCatalogEntry[],
  pathname = window.location.pathname
): ArticleRouteResolution | null {
  const normalizedBase = basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const articleMatch = pathname.match(
    new RegExp(`^${normalizedBase}/articles/([^/]+)/?$`, "i")
  );
  const publicMatch = pathname.match(
    new RegExp(`^${normalizedBase}/stati/([^/]+)/([^/]+)/?$`, "i")
  );
  if (!articleMatch && !publicMatch) return null;

  const encodedSegment = publicMatch?.[2] || articleMatch?.[1] || "";
  const routeSegment = decodedRouteSegment(encodedSegment);
  const routeSection = publicMatch
    ? decodedRouteSegment(publicMatch[1])
    : null;
  if (!routeSegment || (publicMatch && !routeSection)) return null;

  const matches = catalog.flatMap((article) =>
    routeCandidates(article)
      .filter((candidate) => candidate.slug === routeSegment)
      .map((candidate) => ({ article, canonicalSlug: candidate.canonicalSlug }))
  );
  const exactSectionMatches = routeSection
    ? matches.filter(
        ({ article }) => articleSectionSlug(article.sectionId) === routeSection
      )
    : [];
  const eligibleMatches = exactSectionMatches.length
    ? exactSectionMatches
    : matches;
  const articleIds = new Set(
    eligibleMatches.map(({ article }) => article.id)
  );
  if (articleIds.size !== 1) return null;

  const resolved = eligibleMatches[0];
  const canonicalPath = `${basePath}${articlePublicPath(
    resolved.article.id,
    resolved.article.title,
    resolved.article.sectionId,
    resolved.canonicalSlug
  )}`;
  return {
    articleId: resolved.article.id,
    canonicalPath,
    isCanonical: pathname === canonicalPath,
  };
}

export function journalPath(sectionId?: string, seriesId?: string) {
  const params = new URLSearchParams();
  if (seriesId) params.set("series", seriesId);
  const query = params.size ? `?${params.toString()}` : "";
  return `${basePath}${articleSectionArchivePath(sectionId)}${query}`;
}

type ArticleRouteTarget = {
  id: string;
  title: string;
  sectionId?: string;
  slug?: string;
};

function reducedMotionPreferred() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function scrollToReadingSurface(id: "journal" | "atlas") {
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({
      behavior: reducedMotionPreferred() ? "auto" : "smooth",
      block: "start",
    });
  });
}

export function navigateToJournal(
  sectionId?: string,
  replace = false,
  seriesId?: string
) {
  const href = journalPath(sectionId, seriesId);
  const state = { probperaJournal: sectionId || "all" };
  if (replace) window.history.replaceState(state, "", href);
  else window.history.pushState(state, "", href);
  window.dispatchEvent(new Event("probpera:navigation"));
  scrollToReadingSurface("journal");
}

export function navigateToArticle(article: ArticleRouteTarget) {
  window.history.pushState(
    { probperaArticle: article.id },
    "",
    articlePath(article.id, article.title, article.sectionId, article.slug)
  );
  window.dispatchEvent(new Event("probpera:navigation"));
  scrollToReadingSurface("journal");
}

export function shouldUseClientNavigation(event: {
  button: number;
  defaultPrevented: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
