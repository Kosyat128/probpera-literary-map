import { readAtlasUrlState, withAtlasUrlState, withoutAtlasImmersiveHistoryMarker } from "../utils/atlasUrlState";
import { BOOK_ARCHIVE_CONTEXT_HISTORY_STATE_KEY, BOOK_ARCHIVE_DETAIL_HISTORY_STATE_KEY, BOOK_ARCHIVE_ARTICLE_FOCUS_HISTORY_STATE_KEY } from "../books/bookArchiveLocation";
import type { NativeNavigationIntent } from "./NativeNavigation";

/** Merge an already validated partial instruction into the canonical URL. */
export function nativeNavigationTarget(current: string, intent: NativeNavigationIntent) {
  let next = new URL(current);
  const incoming = new URL(intent.canonicalUrl);
  const entity = Boolean(intent.atlas.countryId || intent.bookKey);
  const atlasChange = entity || intent.atlas.filter !== undefined || intent.atlas.view !== undefined;
  const selectionChange = atlasChange || intent.bookKey !== undefined || intent.shelfId !== undefined;
  if (intent.language) next.pathname = incoming.pathname;
  else if (selectionChange || intent.section) {
    const locale = /^\/(ru|en)(?:\/|$)/u.exec(next.pathname)?.[1];
    next.pathname = locale ? `/${locale}/` : "/";
  }
  if (atlasChange) {
    const previous = readAtlasUrlState(next.href);
    const [bookCountry, bookWriter] = intent.bookKey?.split(":") ?? [];
    next = withAtlasUrlState(next, {
      filter: intent.atlas.filter ?? (entity ? "all" : previous.filter),
      countryId: bookCountry ?? intent.atlas.countryId ?? previous.countryId,
      writerId: entity ? bookWriter ?? intent.atlas.writerId ?? null : previous.writerId,
      view: intent.atlas.view ?? previous.view,
    });
  }
  if (entity) {
    if (intent.bookKey) next.searchParams.set("book", intent.bookKey);
    else next.searchParams.delete("book");
  }
  if (intent.shelfId) next.searchParams.set("archiveShelf", intent.shelfId);
  if (intent.section) next.hash = intent.section;
  else if (intent.bookKey) next.hash = "books";
  const localeOnly = !selectionChange && !intent.section;
  return { relative: `${next.pathname}${next.search}${next.hash}`, localeOnly };
}

/** A new external entry cannot inherit the previous UI entry's Back behavior. */
export function nativeNavigationEntryState(previous: unknown): Record<string, unknown> {
  const next = withoutAtlasImmersiveHistoryMarker(previous);
  for (const key of [BOOK_ARCHIVE_CONTEXT_HISTORY_STATE_KEY, BOOK_ARCHIVE_DETAIL_HISTORY_STATE_KEY,
    BOOK_ARCHIVE_ARTICLE_FOCUS_HISTORY_STATE_KEY, "probperaBookDetailShelfChanged", "probperaBookArchiveShelf"]) {
    delete next[key];
  }
  return next;
}
