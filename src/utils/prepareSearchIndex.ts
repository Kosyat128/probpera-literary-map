export type SearchIndexBatchOptions = {
  signal?: AbortSignal;
  yieldToHost?: () => Promise<void>;
  now?: () => number;
  budgetMs?: number;
};

const MAX_BATCH_ITEMS = 100;
const yieldToNextTask = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** Prepare an ordered snapshot without consuming an iterable before the first
 * host turn. Map each yielded value before advancing a possibly mutable iterator.
 * Generator advances and mapping both count towards the current batch budget;
 * an individual synchronous callback cannot itself be interrupted. An exhausted
 * final batch may yield once before discovering that the iterator is complete. */
export async function mapSearchIndexInBatches<T, U>(
  items: Iterable<T>,
  map: (item: T) => U,
  options: SearchIndexBatchOptions = {}
): Promise<U[]> {
  const { signal, yieldToHost = yieldToNextTask, now = () => performance.now(), budgetMs = 8 } = options;
  if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
    throw new RangeError("Search index batch budget must be finite and positive.");
  }
  const checkAbort = () => {
    if (signal?.aborted) {
      throw signal.reason === undefined
        ? new DOMException("Search index preparation was aborted.", "AbortError")
        : signal.reason;
    }
  };
  let startedAt = 0;
  let advances = 0;
  let mapped = 0;
  const yieldBatch = async () => {
    checkAbort();
    await yieldToHost();
    checkAbort();
    startedAt = now();
    advances = 0;
    mapped = 0;
  };
  const budgetExpired = () => now() - startedAt >= budgetMs;
  const result: U[] = [];
  let iterator: Iterator<T> | undefined;
  let complete = false;
  try {
    await yieldBatch();
    checkAbort();
    iterator = items[Symbol.iterator]();
    checkAbort();
    while (true) {
      if (advances >= MAX_BATCH_ITEMS || mapped >= MAX_BATCH_ITEMS || budgetExpired()) {
        await yieldBatch();
      }
      checkAbort();
      const current = iterator.next();
      advances += 1;
      checkAbort();
      if (current.done) break;
      // An expensive generator step must not be followed by more synchronous
      // mapper work in the same exhausted turn. Keep its current value local.
      if (budgetExpired()) await yieldBatch();
      checkAbort();
      result.push(map(current.value));
      mapped += 1;
      checkAbort();
    }
    complete = true;
    return result;
  } finally {
    if (iterator && !complete) {
      try { iterator.return?.(); }
      catch { /* Preserve the original cancellation, iterator or mapper error. */ }
    }
  }
}
