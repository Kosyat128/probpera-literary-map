export function normalizeLiterarySearch(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function literarySearchScore(label: string, query: string) {
  const normalizedLabel = normalizeLiterarySearch(label);
  const normalizedQuery = normalizeLiterarySearch(query);

  if (!normalizedQuery) return 0;
  if (normalizedLabel === normalizedQuery) return 0;
  if (normalizedLabel.startsWith(normalizedQuery)) return 1;
  if (normalizedLabel.includes(normalizedQuery)) return 2;
  return 3;
}
