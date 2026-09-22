import type { BookShelfPhase, BookShelfViewMode } from "./bookShelfState";
import type { BookShelfMobileDetailPhase } from "./bookShelfMobileDetail";

/** Observed book details, not a request receipt, reading progress or camera state. */
export type BookArchiveDetailView = Readonly<{
  active: boolean;
  settled: boolean;
  countryId: string | null;
  writerId: string | null;
  workId: string | null;
}>;

export const INACTIVE_BOOK_ARCHIVE_DETAIL_VIEW: BookArchiveDetailView = Object.freeze({
  active: false, settled: false, countryId: null, writerId: null, workId: null,
});

export function resolveBookArchiveDetailView(input: Readonly<{
  book: Readonly<{ countryId: string; writerId: string; id: string }> | null;
  panelActive: boolean;
  visible: boolean;
  transitionPending: boolean;
  viewMode: BookShelfViewMode;
  shelfPhase: BookShelfPhase;
  mobile: boolean;
  mobilePhase: BookShelfMobileDetailPhase;
}>): BookArchiveDetailView {
  if (!input.book || !input.panelActive || !input.visible || input.transitionPending
    || input.shelfPhase === "INSPECTION_CLOSING" || input.shelfPhase === "SHELF_RESTORING") {
    return INACTIVE_BOOK_ARCHIVE_DETAIL_VIEW;
  }
  const shelfSettled = input.viewMode === "catalog"
    || input.shelfPhase === "INSPECTION_CLOSED"
    || input.shelfPhase === "COVER_CRACKED"
    || input.shelfPhase === "BOOK_OPEN";
  return Object.freeze({
    active: true,
    settled: shelfSettled && (!input.mobile || input.mobilePhase === "idle"),
    countryId: input.book.countryId,
    writerId: input.book.writerId,
    workId: input.book.id,
  });
}
