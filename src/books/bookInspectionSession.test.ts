import { describe, expect, it } from "vitest";

import {
  beginBookInspectionDrag,
  captureBookInspectionSnapshot,
  createBookInspectionSession,
  endBookInspectionDrag,
  getBookInspectionKeyboardTarget,
  getNextBookInspectionPageTarget,
  getPreviousBookInspectionPageTarget,
  requestBookInspectionClose,
  requestBookInspectionSwitch,
  requestNextBookInspectionPage,
  requestPreviousBookInspectionPage,
  restoreBookInspectionSnapshot,
  settleBookInspectionSession,
  updateBookInspectionDrag,
} from "./bookInspectionSession";

describe("Book inspection session", () => {
  it("normalizes page state and keeps navigation finite at first and last page", () => {
    const first = createBookInspectionSession({
      bookKey: "book:first",
      pageCount: 5,
      pageIndex: -10,
    });
    expect(first.pageIndex).toBe(0);
    expect(getPreviousBookInspectionPageTarget(first)).toBe(0);
    expect(requestPreviousBookInspectionPage(first, 1)).toBe(first);

    const last = createBookInspectionSession({
      bookKey: "book:last",
      pageCount: 5,
      pageIndex: 99,
    });
    expect(last.pageIndex).toBe(4);
    expect(getNextBookInspectionPageTarget(last)).toBe(4);
    expect(requestNextBookInspectionPage(last, 1)).toBe(last);
  });

  it("commits a forward drag over the threshold and settles once", () => {
    let session = createBookInspectionSession({
      bookKey: "book:one",
      pageCount: 4,
    });
    session = beginBookInspectionDrag(session, 1, "forward");
    session = updateBookInspectionDrag(session, 1, 0.68);
    session = endBookInspectionDrag(session, {
      requestId: 1,
      velocity: 0.05,
    });

    expect(session).toMatchObject({
      phase: "settling",
      direction: "forward",
      dragProgress: 1,
      settlePageIndex: 1,
    });
    const settled = settleBookInspectionSession(session, 1);
    expect(settled).toMatchObject({
      phase: "idle",
      pageIndex: 1,
      dragProgress: 0,
    });
    expect(settleBookInspectionSession(settled, 1)).toBe(settled);
  });

  it("cancels a short drag and lets a strong reverse velocity override progress", () => {
    const initial = createBookInspectionSession({
      bookKey: "book:one",
      pageCount: 4,
      pageIndex: 1,
    });
    let short = beginBookInspectionDrag(initial, 1, "forward");
    short = updateBookInspectionDrag(short, 1, 0.2);
    short = endBookInspectionDrag(short, { requestId: 1, velocity: 0.1 });
    expect(settleBookInspectionSession(short, 1).pageIndex).toBe(1);

    let reversed = beginBookInspectionDrag(
      settleBookInspectionSession(short, 1),
      2,
      "forward"
    );
    reversed = updateBookInspectionDrag(reversed, 2, 0.86);
    reversed = endBookInspectionDrag(reversed, {
      requestId: 2,
      velocity: -0.6,
    });
    expect(reversed).toMatchObject({
      dragProgress: 0,
      settlePageIndex: 1,
    });
    expect(settleBookInspectionSession(reversed, 2).pageIndex).toBe(1);
  });

  it("uses signed velocity correctly for backward turns", () => {
    let session = createBookInspectionSession({
      bookKey: "book:one",
      pageCount: 4,
      pageIndex: 2,
    });
    session = beginBookInspectionDrag(session, 1, "backward");
    session = updateBookInspectionDrag(session, 1, 0.1);
    session = endBookInspectionDrag(session, {
      requestId: 1,
      velocity: -0.8,
    });
    expect(settleBookInspectionSession(session, 1).pageIndex).toBe(1);
  });

  it("maps owned keyboard controls to clamped session targets", () => {
    const session = createBookInspectionSession({
      bookKey: "book:one",
      pageCount: 7,
      pageIndex: 3,
    });
    expect(getBookInspectionKeyboardTarget(session, "ArrowRight")).toBe(4);
    expect(getBookInspectionKeyboardTarget(session, "PageUp")).toBe(2);
    expect(getBookInspectionKeyboardTarget(session, " ", true)).toBe(2);
    expect(getBookInspectionKeyboardTarget(session, "Home")).toBe(0);
    expect(getBookInspectionKeyboardTarget(session, "End")).toBe(6);
    expect(getBookInspectionKeyboardTarget(session, "Escape")).toBeNull();
  });

  it("closes the current book before activating a pending switch", () => {
    const current = createBookInspectionSession({
      bookKey: "book:old",
      pageCount: 5,
      pageIndex: 3,
    });
    const switching = requestBookInspectionSwitch(current, 1, {
      bookKey: "book:new",
      pageCount: 9,
      pageIndex: 2,
    });
    expect(switching).toMatchObject({
      bookKey: "book:old",
      pendingBookKey: "book:new",
      phase: "settling",
      pageIndex: 3,
    });

    expect(settleBookInspectionSession(switching, 0)).toBe(switching);
    expect(settleBookInspectionSession(switching, 1)).toMatchObject({
      bookKey: "book:new",
      pendingBookKey: null,
      pageCount: 9,
      pageIndex: 2,
      phase: "idle",
    });
  });

  it("ignores stale requests and stale settlements by identity", () => {
    const initial = createBookInspectionSession({
      bookKey: "book:one",
      pageCount: 4,
      requestId: 4,
    });
    expect(beginBookInspectionDrag(initial, 4, "forward")).toBe(initial);

    const first = requestBookInspectionSwitch(initial, 5, {
      bookKey: "book:two",
      pageCount: 3,
    });
    const latest = requestBookInspectionSwitch(first, 6, {
      bookKey: "book:three",
      pageCount: 6,
    });
    expect(settleBookInspectionSession(latest, 5)).toBe(latest);
    expect(settleBookInspectionSession(latest, 6).bookKey).toBe("book:three");
  });

  it("captures the real session, closes, and restores the same page and orbit", () => {
    const orbit = {
      cameraPosition: [1, 2, 3] as const,
      target: [0, 0.5, 0] as const,
      zoom: 1.25,
    };
    const open = createBookInspectionSession({
      bookKey: "book:restore",
      pageCount: 8,
      pageIndex: 5,
      orbitSnapshot: orbit,
    });
    const snapshot = captureBookInspectionSnapshot(open);
    expect(snapshot).not.toBeNull();

    const closing = requestBookInspectionClose(open, 1);
    const closed = settleBookInspectionSession(closing, 1);
    expect(closed).toMatchObject({
      bookKey: null,
      pageCount: 0,
      pageIndex: 0,
      phase: "idle",
    });

    const restored = restoreBookInspectionSnapshot(closed, 2, snapshot!);
    expect(restored).toMatchObject({
      bookKey: "book:restore",
      pageCount: 8,
      pageIndex: 5,
      requestId: 2,
      orbitSnapshot: orbit,
    });
    expect(restoreBookInspectionSnapshot(restored, 1, snapshot!)).toBe(
      restored
    );
  });
});
