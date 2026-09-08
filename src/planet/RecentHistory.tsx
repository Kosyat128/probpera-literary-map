import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type RecentTarget =
  | { readonly kind: "writer"; readonly countryId: string; readonly writerId: string }
  | { readonly kind: "work"; readonly countryId: string; readonly writerId: string; readonly workId: string };
export type RecentEntry = RecentTarget & { readonly openedAt: number };
export interface RecentHistoryScope {
  readonly issuer: string;
  readonly audience: string;
  readonly product: string;
  readonly subject: string;
}
export interface RecentHistorySnapshot {
  readonly available: boolean;
  readonly loaded: boolean;
  readonly entries: readonly RecentEntry[];
  /** Native persistence feedback; omitted by the existing scoped Web store. */
  readonly storageStatus?: "loading" | "ready" | "saving" | "error";
}
/** Platform-neutral preference port. Never a source of content or paid access. */
export interface RecentHistoryStore {
  readonly persistence: "best-effort";
  getSnapshot(): RecentHistorySnapshot;
  subscribe(listener: () => void): () => void;
  record(target: RecentTarget): Promise<void>;
  clear(): Promise<void>;
  retry?(): Promise<void>;
  dispose?(): void;
}
export const RECENT_HISTORY_LIMIT = 20;
const emptyEntries: readonly RecentEntry[] = Object.freeze([]);
const disabledSnapshot: RecentHistorySnapshot = Object.freeze({ available: false, loaded: true, entries: emptyEntries });
const disabledStore: RecentHistoryStore = Object.freeze({ persistence: "best-effort", getSnapshot: () => disabledSnapshot,
  subscribe: () => () => undefined, record: async () => undefined, clear: async () => undefined });
const Context = createContext<RecentHistoryStore>(disabledStore);
export function RecentHistoryProvider({ store, children }: { store: RecentHistoryStore; children: ReactNode }) {
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
/** Without a provider, including on the public site, this is a stable no-op port. */
export function useRecentHistory() {
  const store = useContext(Context);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return useMemo(() => ({ ...snapshot, record: store.record, clear: store.clear, retry: store.retry }), [snapshot, store]);
}
export const recentEntryKey = (entry: RecentTarget) => JSON.stringify([entry.kind, entry.countryId, entry.writerId, entry.kind === "work" ? entry.workId : null]);
