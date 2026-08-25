export type ArticleWorkspaceSection =
  | "basics"
  | "text"
  | "media"
  | "publish"
  | "cover"
  | "seo"
  | "sources"
  | "quality";

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
  if (value.includes("publication") || value.includes("публикац")) return "publish";
  if (value.includes("облож")) return "cover";
  if (value.includes("seo") || value.includes("поиск") || value.includes("open graph")) {
    return "seo";
  }
  if (value.includes("source") || value.includes("источник") || value.includes("библиограф")) {
    return "sources";
  }
  if (value.includes("контроль") || value.includes("checklist")) return "quality";
  if (value.includes("рубри")) return "basics";
  return null;
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
