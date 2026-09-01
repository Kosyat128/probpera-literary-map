export type ArticleWorkspaceSection =
  | "basics"
  | "text"
  | "media"
  | "publish"
  | "cover"
  | "seo"
  | "sources"
  | "quality";
export type ArticleWorkspaceLocale = "ru" | "en";

function normalizeWorkspaceText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/\s+/gu, " ")
    .trim();
}

export function articleWorkspacePanelSection(
  heading: string
): ArticleWorkspaceSection | null {
  const value = normalizeWorkspaceText(heading);
  if (!value) return null;
  if (value.includes("контроль") || value.includes("checklist")) return "quality";
  if (value.includes("publication") || value.includes("публикац")) return "publish";
  if (value.includes("облож")) return "cover";
  if (value.includes("seo") || value.includes("поиск") || value.includes("open graph")) {
    return "seo";
  }
  if (value.includes("source") || value.includes("источник") || value.includes("библиограф")) {
    return "sources";
  }
  if (value.includes("рубри")) return "basics";
  return null;
}

export function articleWorkspaceCheckLocale(label: string): ArticleWorkspaceLocale {
  const value = normalizeWorkspaceText(label);
  return value.startsWith("english:") ||
    value.startsWith("англииская версия:")
    ? "en"
    : "ru";
}

export function articleWorkspaceCheckSection(label: string): ArticleWorkspaceSection {
  const value = normalizeWorkspaceText(label).replace(
    /^(?:english|англииская версия):\s*/u,
    ""
  );
  if (value.includes("seo")) return "seo";
  if (value.includes("источник") || value.includes("source")) return "sources";
  if (value.includes("облож") || value.includes("alt")) return "cover";
  if (value.includes("изображ") || value.includes("media")) return "media";
  if (value.includes("слов") || value.includes("words") || value.includes("h2")) {
    return "text";
  }
  if (value.includes("рубри") || value.includes("category")) return "basics";
  if (value.includes("заголов") || value.includes("описание карточки")) return "basics";
  if (
    value.includes("approved") ||
    value.includes("published") ||
    value.includes("проверен") ||
    value.includes("опубликован") ||
    value.includes("сверен") ||
    value.includes("current original")
  ) {
    return "publish";
  }
  return "quality";
}

export function articleWorkspaceAnchor(text: string, index: number) {
  const normalized = normalizeWorkspaceText(text)
    .replace(/[^a-zа-я0-9]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 54);
  return `article-heading-${normalized || "section"}-${index + 1}`;
}

export function articleWorkspaceQuality(ready: number, total: number) {
  const safeTotal = Math.max(0, total);
  const safeReady = Math.min(Math.max(0, ready), safeTotal || Math.max(0, ready));
  const percent = safeTotal ? Math.round((safeReady / safeTotal) * 100) : 0;
  return {
    ready: safeReady,
    total: safeTotal,
    percent,
    complete: safeTotal > 0 && safeReady === safeTotal,
  };
}

export function articleWorkspaceDocumentMetrics(
  text: string,
  headings: number,
  images: number
) {
  const words = text.replace(/\s+/gu, " ").trim()
    ? text.replace(/\s+/gu, " ").trim().split(" ").length
    : 0;
  return {
    words,
    headings: Math.max(0, Math.trunc(headings)),
    images: Math.max(0, Math.trunc(images)),
    readingMinutes: words ? Math.max(1, Math.ceil(words / 200)) : 0,
  };
}
