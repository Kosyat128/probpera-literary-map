export const INITIAL_ARTICLE_COPY_OPTIONS_LIMIT = 24;
export const ARTICLE_COPY_SEARCH_LIMIT = 30;
export const ARTICLE_COPY_SEARCH_MAX_QUERY = 120;

export function normalizeArticleCopySearch(value: string) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, ARTICLE_COPY_SEARCH_MAX_QUERY);
}

export function articleCopySearchPattern(value: string) {
  const normalized = normalizeArticleCopySearch(value);
  if (normalized.length < 2) return null;
  const escaped = normalized.replace(/[\\%_]/gu, (character) => `\\${character}`);
  return `%${escaped}%`;
}
