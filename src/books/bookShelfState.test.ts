import { describe, expect, it, vi } from "vitest";

import {
  bookShelfStateReducer,
  createBookShelfTransitionCoordinator,
  createInitialBookShelfState,
  executeBookShelfTransition,
  type BookShelfState,
} from "./bookShelfState";

function transition(
  state: BookShelfState,
  action: Parameters<typeof bookShelfStateReducer>[1]
) {
  return bookShelfStateReducer(state, action);
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("Book Shelf deterministic state machine", () => {
  it("follows the complete legal shelf, inspection, cover and page path", () => {
    let state = createInitialBookShelfState();
    state = transition(state, { type: "request-focus", requestId: 1 });
    expect(state.phase).toBe("SHELF_MOVING");
    state = transition(state, { type: "motion-reached", requestId: 1 });
    expect(state.phase).toBe("SHELF_SETTLING");
    state = transition(state, { type: "motion-settled", requestId: 1 });
    expect(state.phase).toBe("SHELF_IDLE");

    state = transition(state, { type: "request-inspection", requestId: 2 });
    expect(state.phase).toBe("INSPECTION_ENTERING");
    state = transition(state, { type: "inspection-entered", requestId: 2 });
    expect(state.phase).toBe("INSPECTION_CLOSED");

    state = transition(state, { type: "crack-cover", requestId: 3 });
    expect(state.phase).toBe("COVER_CRACKED");
    state = transition(state, { type: "request-cover-open", requestId: 4 });
    expect(state.phase).toBe("COVER_OPENING");
    state = transition(state, { type: "cover-opened", requestId: 4 });
    expect(state.phase).toBe("BOOK_OPEN");

    state = transition(state, { type: "start-page-drag", requestId: 5 });
    expect(state.phase).toBe("PAGE_DRAGGING");
    state = transition(state, { type: "request-page-settle", requestId: 6 });
    expect(state.phase).toBe("PAGE_SETTLING");
    state = transition(state, { type: "page-settled", requestId: 6 });
    expect(state.phase).toBe("BOOK_OPEN");

    state = transition(state, {
      type: "request-inspection-close",
      requestId: 7,
    });
    expect(state.phase).toBe("INSPECTION_CLOSING");
    state = transition(state, { type: "inspection-closed", requestId: 7 });
    expect(state.phase).toBe("SHELF_RESTORING");
    state = transition(state, { type: "shelf-restored", requestId: 7 });
    expect(state.phase).toBe("SHELF_IDLE");
    expect(state.error).toBeNull();
  });

  it("can interrupt every selectable inspection phase to switch books", () => {
    for (const phase of [
      "INSPECTION_ENTERING",
      "INSPECTION_CLOSED",
      "COVER_CRACKED",
      "COVER_OPENING",
      "BOOK_OPEN",
      "PAGE_DRAGGING",
      "PAGE_SETTLING",
    ] as const) {
      const state: BookShelfState = {
        ...createInitialBookShelfState(),
        phase,
        requestId: 6,
      };
      expect(
        transition(state, {
          type: "request-inspection-close",
          requestId: 7,
        })
      ).toMatchObject({ phase: "INSPECTION_CLOSING", requestId: 7 });
    }
  });

  it("returns an inspected book to the idle shelf after an empty-area reset", () => {
    let state: BookShelfState = {
      ...createInitialBookShelfState(),
      phase: "BOOK_OPEN",
      requestId: 4,
    };

    state = transition(state, {
      type: "request-inspection-close",
      requestId: 5,
    });
    expect(state.phase).toBe("INSPECTION_CLOSING");
    state = transition(state, { type: "inspection-closed", requestId: 5 });
    expect(state.phase).toBe("SHELF_RESTORING");
    state = transition(state, { type: "shelf-restored", requestId: 5 });
    expect(state).toMatchObject({
      phase: "SHELF_IDLE",
      requestId: 5,
      error: null,
    });
  });

  it("ignores stale settlements, duplicate requests and illegal phase jumps", () => {
    const first = transition(createInitialBookShelfState(), {
      type: "request-focus",
      requestId: 1,
    });
    const latest = transition(first, {
      type: "request-focus",
      requestId: 2,
    });

    expect(
      transition(latest, { type: "motion-reached", requestId: 1 })
    ).toBe(latest);
    expect(
      transition(latest, { type: "motion-settled", requestId: 2 })
    ).toBe(latest);
    expect(
      transition(latest, { type: "request-focus", requestId: 2 })
    ).toBe(latest);
    expect(
      transition(latest, { type: "request-inspection", requestId: 3 })
    ).toBe(latest);
  });

  it("allows a newer page drag to cancel a settling page deterministically", () => {
    let state = createInitialBookShelfState();
    state = transition(state, { type: "request-inspection", requestId: 1 });
    state = transition(state, { type: "inspection-entered", requestId: 1 });
    state = transition(state, { type: "request-cover-open", requestId: 2 });
    state = transition(state, { type: "cover-opened", requestId: 2 });
    state = transition(state, { type: "start-page-drag", requestId: 3 });
    state = transition(state, { type: "request-page-settle", requestId: 4 });

    const latest = transition(state, {
      type: "start-page-drag",
      requestId: 5,
    });
    expect(latest.phase).toBe("PAGE_DRAGGING");
    expect(latest.requestId).toBe(5);
    expect(
      transition(latest, { type: "page-settled", requestId: 4 })
    ).toBe(latest);
  });

  it("forces Catalog on failure and requires explicit newer recovery", () => {
    const moving = transition(createInitialBookShelfState(), {
      type: "request-focus",
      requestId: 2,
    });
    expect(
      transition(moving, {
        type: "fail",
        requestId: 1,
        code: "transition-failed",
      })
    ).toBe(moving);

    const failed = transition(moving, {
      type: "fail",
      requestId: 2,
      code: "webgl-unavailable",
    });
    expect(failed).toMatchObject({
      phase: "ERROR_FALLBACK",
      requestedViewMode: "shelf",
      effectiveViewMode: "catalog",
      error: {
        code: "webgl-unavailable",
        requestId: 2,
        retryable: true,
      },
    });
    expect(
      transition(failed, { type: "recover", requestId: 2 })
    ).toBe(failed);

    const recovered = transition(failed, {
      type: "recover",
      requestId: 3,
    });
    expect(recovered).toMatchObject({
      phase: "SHELF_IDLE",
      requestedViewMode: "shelf",
      effectiveViewMode: "shelf",
      requestId: 3,
      error: null,
    });
  });

  it("switches view modes without owning or changing controller book keys", () => {
    const initial = createInitialBookShelfState();
    const catalog = transition(initial, {
      type: "set-view-mode",
      viewMode: "catalog",
    });
    expect(catalog).toMatchObject({
      phase: "SHELF_IDLE",
      requestedViewMode: "catalog",
      effectiveViewMode: "catalog",
      requestId: 0,
    });
    expect(
      transition(catalog, { type: "request-focus", requestId: 1 })
    ).toBe(catalog);

    const shelf = transition(catalog, {
      type: "set-view-mode",
      viewMode: "shelf",
    });
    expect(shelf).toMatchObject({
      requestedViewMode: "shelf",
      effectiveViewMode: "shelf",
    });
  });
});

describe("Book Shelf latest-wins transition coordinator", () => {
  it("aborts the previous token and commits only the active token", () => {
    const coordinator = createBookShelfTransitionCoordinator(10);
    const first = coordinator.begin();
    const second = coordinator.begin();

    expect(first.requestId).toBe(11);
    expect(first.signal.aborted).toBe(true);
    expect(coordinator.isLatest(first)).toBe(false);
    expect(second.requestId).toBe(12);
    expect(coordinator.isLatest(second)).toBe(true);
    expect(coordinator.finish(first)).toBe(false);
    expect(coordinator.finish(second)).toBe(true);
    expect(coordinator.isLatest(second)).toBe(false);
  });

  it("cancels on dispose and rejects reuse after cleanup", () => {
    const coordinator = createBookShelfTransitionCoordinator();
    const token = coordinator.begin();
    coordinator.dispose();

    expect(token.signal.aborted).toBe(true);
    expect(coordinator.isLatest(token)).toBe(false);
    expect(() => coordinator.begin()).toThrow(/disposed/u);
    expect(() => coordinator.dispose()).not.toThrow();
  });

  it("runs cleanup once and resolves only the latest competing request", async () => {
    const coordinator = createBookShelfTransitionCoordinator();
    const firstPending = deferred();
    const secondPending = deferred();
    const resolved: number[] = [];
    const rejected: number[] = [];
    const cleaned: number[] = [];

    const firstToken = coordinator.begin();
    const first = executeBookShelfTransition({
      token: firstToken,
      run: () => firstPending.promise,
      isLatest: coordinator.isLatest,
      onResolve: (token) => resolved.push(token.requestId),
      onReject: (token) => rejected.push(token.requestId),
      onCleanup: (token) => cleaned.push(token.requestId),
    });
    const secondToken = coordinator.begin();
    const second = executeBookShelfTransition({
      token: secondToken,
      run: () => secondPending.promise,
      isLatest: coordinator.isLatest,
      onResolve: (token) => resolved.push(token.requestId),
      onReject: (token) => rejected.push(token.requestId),
      onCleanup: (token) => cleaned.push(token.requestId),
    });

    firstPending.resolve();
    await expect(first).resolves.toBe("cancelled");
    expect(resolved).toEqual([]);

    secondPending.resolve();
    await expect(second).resolves.toBe("committed");
    expect(resolved).toEqual([secondToken.requestId]);
    expect(rejected).toEqual([]);
    expect(cleaned).toEqual([firstToken.requestId, secondToken.requestId]);
  });

  it("reports only the latest non-abort failure and hides raw errors", async () => {
    const coordinator = createBookShelfTransitionCoordinator();
    const token = coordinator.begin();
    const onResolve = vi.fn();
    const onReject = vi.fn();
    const onCleanup = vi.fn(() => {
      throw new Error("cleanup failure");
    });

    await expect(
      executeBookShelfTransition({
        token,
        run: async () => {
          throw new Error("sensitive renderer details");
        },
        isLatest: coordinator.isLatest,
        onResolve,
        onReject,
        onCleanup,
      })
    ).resolves.toBe("failed");
    expect(onResolve).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith(token);
    expect(onCleanup).toHaveBeenCalledOnce();
  });
});
