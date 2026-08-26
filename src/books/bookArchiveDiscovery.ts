export const BOOK_ARCHIVE_RANDOM_HISTORY_LIMIT = 13;

export type BookArchiveDiscoveryCandidate = Readonly<{
  key: string;
}>;

export type RandomBookArchiveItemOptions<
  T extends BookArchiveDiscoveryCandidate,
> = Readonly<{
  candidates: readonly T[];
  randomValue: number;
  currentKey?: string | null;
  recentKeys?: readonly string[];
  recentWindow?: number;
}>;

function normalizedRandomIndex(randomValue: number, length: number) {
  const normalized = Number.isFinite(randomValue)
    ? Math.max(0, Math.min(1 - Number.EPSILON, randomValue))
    : 0;
  return Math.floor(normalized * length);
}

function uniqueCandidates<T extends BookArchiveDiscoveryCandidate>(
  candidates: readonly T[]
) {
  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      const key = candidate.key.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((first, second) => first.key.localeCompare(second.key, "en"));
}

/**
 * Selects from the complete caller-provided archive, independently of any
 * visible shelf batch or active UI filter. Sorting by the canonical key keeps
 * a supplied random value deterministic when source order changes.
 */
export function chooseRandomBookArchiveItem<
  T extends BookArchiveDiscoveryCandidate,
>({
  candidates,
  randomValue,
  currentKey = null,
  recentKeys = [],
  recentWindow = BOOK_ARCHIVE_RANDOM_HISTORY_LIMIT,
}: RandomBookArchiveItemOptions<T>): T | null {
  const eligible = uniqueCandidates(candidates);
  if (eligible.length === 0) return null;

  const windowSize = Math.max(
    0,
    Math.min(
      BOOK_ARCHIVE_RANDOM_HISTORY_LIMIT,
      Math.trunc(recentWindow) || 0
    )
  );
  const recent = new Set(
    recentKeys
      .slice(-windowSize)
      .map((key) => key.trim())
      .filter(Boolean)
  );
  const normalizedCurrentKey = currentKey?.trim() || "";
  const withoutCurrent = eligible.filter(
    (candidate) => candidate.key !== normalizedCurrentKey
  );
  const withoutRecent = withoutCurrent.filter(
    (candidate) => !recent.has(candidate.key)
  );
  const pool =
    withoutRecent.length > 0
      ? withoutRecent
      : withoutCurrent.length > 0
        ? withoutCurrent
        : eligible;

  return pool[normalizedRandomIndex(randomValue, pool.length)] ?? null;
}

export function rememberRandomBookArchiveItem(
  history: readonly string[],
  selectedKey: string,
  limit = BOOK_ARCHIVE_RANDOM_HISTORY_LIMIT
) {
  const safeLimit = Math.max(
    0,
    Math.min(BOOK_ARCHIVE_RANDOM_HISTORY_LIMIT, Math.trunc(limit) || 0)
  );
  const normalizedSelectedKey = selectedKey.trim();
  if (!normalizedSelectedKey || safeLimit === 0) return [];

  const latestUnique: string[] = [];
  const seen = new Set<string>();
  const candidates = [...history, normalizedSelectedKey];
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const key = candidates[index].trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    latestUnique.push(key);
    if (latestUnique.length === safeLimit) break;
  }
  return latestUnique.reverse();
}
