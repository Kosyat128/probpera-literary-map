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
  sectionId?: string
) {
  return `${basePath}/stati/${articleSectionSlug(sectionId)}/${encodeURIComponent(
    articleSeoSlug(articleId, title)
  )}/`;
}

export function articleIdFromPath(
  catalog: Array<{ id: string; title: string; sectionId?: string }>,
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
      articleSeoSlug(item.id, item.title) === routeSegment
  );
  return article?.id || null;
}

export function journalPath(sectionId?: string) {
  const query =
    sectionId && sectionId !== "all"
      ? `?section=${encodeURIComponent(sectionId)}`
      : "";
  return `${basePath || "/"}${query}#journal`;
}
