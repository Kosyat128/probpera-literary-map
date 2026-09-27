import { normalizeBookArchiveFilterState, type BookArchiveFilterState } from "./bookArchiveFacets";
import { BOOK_COLLECTION_ALL_SHELF_ID } from "./bookCollectionShelfSelector";
import type { BookArchiveAuthorViewToken, ResolvedBookArchiveAuthorRequest } from "./bookArchiveAuthorRequest";

export type BookArchiveAuthorRecoveryView = Readonly<{
  filterState: BookArchiveFilterState;
  query: string;
  searchScope: string;
  activeShelfId: string;
}>;

/** Local presentation only. No token or view key belongs in saved content. */
export function bookArchiveAuthorViewKey(view: BookArchiveAuthorRecoveryView): string {
  return JSON.stringify({ filterState: view.filterState, query: view.query,
    searchScope: view.searchScope, activeShelfId: view.activeShelfId });
}

export function createBookArchiveAuthorViewToken(viewKey: string): BookArchiveAuthorViewToken {
  return Object.freeze({ key: viewKey });
}

/** Plan only an explicit recovery against the exact currently offered view.
 * A replacement token rejects a newer committed edit even if its values match. */
export function planBookArchiveAuthorRecovery(
  resolved: ResolvedBookArchiveAuthorRequest,
  current: BookArchiveAuthorRecoveryView,
  token: BookArchiveAuthorViewToken,
): BookArchiveAuthorRecoveryView | null {
  if (resolved.status !== "ready" || !resolved.request.recovery
    || resolved.request.recovery.view !== token || token.key !== bookArchiveAuthorViewKey(current)
    || current.filterState.authorKey !== resolved.authorKey || current.searchScope !== "library") return null;
  const filterState = normalizeBookArchiveFilterState({ authorKey: resolved.authorKey,
    sort: current.filterState.sort, quickPreset: "custom" });
  for (const value of Object.values(filterState)) if (Array.isArray(value)) Object.freeze(value);
  return Object.freeze({ filterState: Object.freeze(filterState), query: "", searchScope: "library",
    activeShelfId: BOOK_COLLECTION_ALL_SHELF_ID });
}
