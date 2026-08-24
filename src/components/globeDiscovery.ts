export type LiteraryDestination = Readonly<{ id: string }>;

export type RandomLiteraryDestinationOptions<T extends LiteraryDestination> =
  Readonly<{
    candidates: ReadonlyArray<T>;
    randomValue: number;
    currentId?: string | null;
    recentIds?: ReadonlyArray<string>;
    isEligible?: (candidate: T) => boolean;
    recentWindow?: number;
  }>;

function normalizedRandomIndex(randomValue: number, length: number) {
  const normalized = Number.isFinite(randomValue)
    ? Math.max(0, Math.min(1 - Number.EPSILON, randomValue))
    : 0;
  return Math.floor(normalized * length);
}

function uniqueEligibleCandidates<T extends LiteraryDestination>(
  candidates: ReadonlyArray<T>,
  isEligible: ((candidate: T) => boolean) | undefined
) {
  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      if (!candidate.id || seen.has(candidate.id) || isEligible?.(candidate) === false) {
        return false;
      }
      seen.add(candidate.id);
      return true;
    })
    .sort((first, second) => first.id.localeCompare(second.id));
}

/**
 * Selects only from the current filter result. The last three destinations and
 * current country are excluded whenever another eligible destination exists;
 * history is relaxed before the current-country guard for very small filters.
 */
export function chooseRandomLiteraryDestination<T extends LiteraryDestination>({
  candidates,
  randomValue,
  currentId = null,
  recentIds = [],
  isEligible,
  recentWindow = 3,
}: RandomLiteraryDestinationOptions<T>): T | null {
  const eligible = uniqueEligibleCandidates(candidates, isEligible);
  if (eligible.length === 0) return null;

  const windowSize = Math.max(0, Math.min(3, Math.trunc(recentWindow)));
  const recent = new Set(recentIds.slice(-windowSize));
  const withoutCurrent = eligible.filter((candidate) => candidate.id !== currentId);
  const withoutRecent = withoutCurrent.filter((candidate) => !recent.has(candidate.id));
  const pool =
    withoutRecent.length > 0
      ? withoutRecent
      : withoutCurrent.length > 0
        ? withoutCurrent
        : eligible;

  return pool[normalizedRandomIndex(randomValue, pool.length)] ?? null;
}

export function rememberLiteraryDestination(
  history: ReadonlyArray<string>,
  destinationId: string,
  limit = 3
) {
  const safeLimit = Math.max(0, Math.min(3, Math.trunc(limit)));
  if (!destinationId || safeLimit === 0) return [];
  return [...history.filter((id) => id !== destinationId), destinationId].slice(
    -safeLimit
  );
}
