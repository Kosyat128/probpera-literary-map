import { describe, expect, it } from "vitest";
import { BOOK_SHELF_PHASES } from "./bookShelfState";
import { INACTIVE_BOOK_ARCHIVE_DETAIL_VIEW, resolveBookArchiveDetailView } from "./bookArchiveDetailView";

const book = { countryId: "russia", writerId: "tolstoy", id: "war-and-peace" };
const ready = { book, panelActive: true, visible: true, transitionPending: false,
  viewMode: "catalog" as const, shelfPhase: "SHELF_IDLE" as const,
  mobile: false, mobilePhase: "idle" as const };

describe("observed archive detail view", () => {
  it("reports the exact committed book independently of any request receipt", () => {
    const source = { ...book };
    const result = resolveBookArchiveDetailView({ ...ready, book: source });
    source.id = "another-book";
    expect(result).toEqual({ active: true, settled: true,
      countryId: book.countryId, writerId: book.writerId, workId: book.id });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("clears all identity while hidden, inactive, switching or restoring history", () => {
    for (const change of [
      { book: null }, { visible: false }, { panelActive: false }, { transitionPending: true },
      { shelfPhase: "INSPECTION_CLOSING" as const }, { shelfPhase: "SHELF_RESTORING" as const },
    ]) expect(resolveBookArchiveDetailView({ ...ready, ...change }))
      .toBe(INACTIVE_BOOK_ARCHIVE_DETAIL_VIEW);
  });

  it("does not acknowledge shelf motion, entry, cover animation or page motion", () => {
    const stable = new Set(["INSPECTION_CLOSED", "COVER_CRACKED", "BOOK_OPEN"]);
    for (const shelfPhase of BOOK_SHELF_PHASES) {
      const view = resolveBookArchiveDetailView({ ...ready, viewMode: "shelf", shelfPhase });
      expect(view.settled, shelfPhase).toBe(stable.has(shelfPhase));
    }
  });

  it("keeps a visible mobile card unsettled during dragging and settlement", () => {
    for (const mobilePhase of ["dragging", "settling"] as const) {
      expect(resolveBookArchiveDetailView({ ...ready, mobile: true, mobilePhase }))
        .toMatchObject({ active: true, settled: false, workId: book.id });
    }
    expect(resolveBookArchiveDetailView({ ...ready, mobile: true }).settled).toBe(true);
    expect(resolveBookArchiveDetailView({ ...ready, mobilePhase: "settling" }).settled).toBe(true);
  });
});
