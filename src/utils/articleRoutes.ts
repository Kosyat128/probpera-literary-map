const basePath = import.meta.env.BASE_URL.replace(/\/+$/, "");

const transliteration: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

const articleSectionSlugs: Record<string, string> = {
  "book-opinions": "mnenie-o-knige",
  "screen-adaptations": "kniga-i-ekranizatsiya",
  "writers-world": "pisateli-mira",
  "book-guides": "knizhnyy-gid",
  awards: "literaturnye-premii",
  folklore: "folklor-i-mifologiya",
  language: "russkiy-yazyk",
  "literary-essays": "o-literature",
  "author-stories": "literaturnye-istorii",
};

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

export function articleSeoSlug(articleId: string, title: string) {
  return `${humanSlug(title) || "material"}-${shortStableHash(articleId)}`;
}

export function articleSectionSlug(sectionId?: string) {
  return articleSectionSlugs[sectionId || ""] || "materialy";
}

export function articlePath(
  articleId: string,
  title: string,
  sectionId?: string,
  preferredSlug?: string
) {
  const routeSlug =
    preferredSlug && /^[a-z0-9][a-z0-9-]{1,179}$/u.test(preferredSlug)
      ? preferredSlug
      : articleSeoSlug(articleId, title);
  return `${basePath}/stati/${articleSectionSlug(sectionId)}/${encodeURIComponent(
    routeSlug
  )}/`;
}

export function articleIdFromPath(
  catalog: Array<{
    id: string;
    title: string;
    sectionId?: string;
    slug?: string;
  }>,
  pathname = window.location.pathname
) {
  const normalizedBase = basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match =
    pathname.match(
      new RegExp(`^${normalizedBase}/stati/[^/]+/([^/]+)/?$`, "i")
    ) ||
    pathname.match(
      new RegExp(`^${normalizedBase}/articles/([^/]+)/?$`, "i")
    );
  if (!match) return null;
  const routeSegment = decodeURIComponent(match[1]);
  const article = catalog.find(
    (item) =>
      item.id === routeSegment ||
      item.slug === routeSegment ||
      articleSeoSlug(item.id, item.title) === routeSegment
  );
  return article?.id || null;
}

export function journalPath(sectionId?: string, seriesId?: string) {
  const params = new URLSearchParams();
  if (sectionId && sectionId !== "all") params.set("section", sectionId);
  if (seriesId) params.set("series", seriesId);
  const query = params.size ? `?${params.toString()}` : "";
  const rootPath = basePath ? `${basePath}/` : "/";
  return `${rootPath}${query}#journal`;
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
  if (replace) window.history.replaceState({}, "", href);
  else window.history.pushState({}, "", href);
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
