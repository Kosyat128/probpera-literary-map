export interface HistoricalWriterBiographyBoundaryInput {
  readonly liveReviewQueueKeys: readonly string[];
  readonly currentBatchHeldKeys: readonly string[];
  readonly priorAssignedKeys: readonly string[];
  readonly boundarySize: number;
}

/**
 * Reconstructs the queue as it existed when a historical batch was allocated.
 *
 * Only identities held by that batch are restored. Later quarantine entries are
 * deliberately not merged because legacy quarantine records were not all part
 * of the allocation queue. The caller must still pin the exact expected slice,
 * prior-assignment cardinality and held set in its batch-specific test.
 */
export function selectHistoricalWriterBiographyFactReviewBoundary({
  liveReviewQueueKeys,
  currentBatchHeldKeys,
  priorAssignedKeys,
  boundarySize,
}: HistoricalWriterBiographyBoundaryInput): readonly string[] {
  if (new Set(liveReviewQueueKeys).size !== liveReviewQueueKeys.length) {
    throw new Error("Live writer biography review queue contains duplicate keys");
  }

  const priorAssigned = new Set(priorAssignedKeys);
  const reconstructedQueue = [
    ...new Set([...liveReviewQueueKeys, ...currentBatchHeldKeys]),
  ];

  return reconstructedQueue
    .filter((key) => !priorAssigned.has(key))
    .sort((a, b) => a.localeCompare(b, "en"))
    .slice(0, boundarySize);
}
