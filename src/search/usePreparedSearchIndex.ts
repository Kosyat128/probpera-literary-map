import { useCallback, useEffect, useState } from "react";
import { mapSearchIndexInBatches } from "../utils/prepareSearchIndex";

type PreparedIndexSnapshot<T, U> = {
  source: () => Iterable<T>;
  prepare: (item: T) => U;
  revision: number;
  items: readonly U[];
  error: Error | null;
};

const emptyItems: readonly never[] = [];

export type PreparedSearchIndex<U> = {
  items: readonly U[];
  loading: boolean;
  error: Error | null;
  retry: () => void;
};

/** The caller owns stable source/mapper identities for one catalog and locale. */
export function usePreparedSearchIndex<T, U>(
  source: () => Iterable<T>,
  prepare: (item: T) => U
): PreparedSearchIndex<U> {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<PreparedIndexSnapshot<T, U> | null>(null);
  const retry = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const items = await mapSearchIndexInBatches(source(), prepare, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setSnapshot({ source, prepare, revision, items, error: null });
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          const error = failure instanceof Error ? failure
            : new Error(typeof failure === "string" && failure ? failure : "Search index preparation failed");
          setSnapshot({ source, prepare, revision, items: emptyItems, error });
        }
      }
    })();
    return () => controller.abort();
  }, [source, prepare, revision]);

  // Render can precede the previous effect's cleanup. Never expose that
  // previous catalog or locale while the next preparation is pending.
  const current = snapshot?.source === source && snapshot.prepare === prepare && snapshot.revision === revision;
  return {
    items: current ? snapshot.items : emptyItems,
    loading: !current,
    error: current ? snapshot.error : null,
    retry,
  };
}
