export const BOOK_INSPECTION_SESSION_VERSION = 1 as const;

export const BOOK_PAGE_TURN_COMMIT_THRESHOLD = 0.5;
export const BOOK_PAGE_TURN_VELOCITY_THRESHOLD = 0.4;
export const BOOK_PAGE_TURN_REVERSE_VELOCITY_THRESHOLD = 0.24;

export type BookInspectionPageDirection = "forward" | "backward";
export type BookInspectionSessionPhase = "idle" | "dragging" | "settling";

/**
 * Camera values captured by the scene before extracting a book. They are
 * deliberately presentation-only: no catalogue or edition facts live here.
 */
export type BookInspectionOrbitSnapshot = Readonly<{
  cameraPosition: readonly [number, number, number];
  target: readonly [number, number, number];
  zoom?: number;
}>;

type BookInspectionSettlement = "none" | "page" | "switch" | "close";

/**
 * Versioned, serialisable controller state for one inspection session.
 * `pageIndex` is zero-based session UI state and is never canonical book data.
 */
export type BookInspectionSession = Readonly<{
  version: typeof BOOK_INSPECTION_SESSION_VERSION;
  bookKey: string | null;
  pageIndex: number;
  pageCount: number;
  direction: BookInspectionPageDirection;
  dragProgress: number;
  phase: BookInspectionSessionPhase;
  pendingBookKey: string | null;
  orbitSnapshot: BookInspectionOrbitSnapshot | null;
  requestId: number;
  /** Internal target retained while a page/switch/close animation settles. */
  settlePageIndex: number;
  pendingPageCount: number;
  pendingPageIndex: number;
  settlement: BookInspectionSettlement;
}>;

export type BookInspectionRestoreSnapshot = Readonly<{
  version: typeof BOOK_INSPECTION_SESSION_VERSION;
  bookKey: string;
  pageIndex: number;
  pageCount: number;
  orbitSnapshot: BookInspectionOrbitSnapshot | null;
}>;

export type CreateBookInspectionSessionInput = Readonly<{
  bookKey: string;
  pageCount: number;
  pageIndex?: number;
  orbitSnapshot?: BookInspectionOrbitSnapshot | null;
  requestId?: number;
}>;

export type EndBookInspectionDragOptions = Readonly<{
  requestId: number;
  /** Signed logical velocity: positive is forward, negative is backward. */
  velocity: number;
  commitThreshold?: number;
  velocityThreshold?: number;
  reverseVelocityThreshold?: number;
}>;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const finiteNumber = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

const normalizeRequestId = (requestId: number) =>
  Math.max(0, Math.trunc(finiteNumber(requestId)));

const normalizePageCount = (pageCount: number) =>
  Math.max(0, Math.trunc(finiteNumber(pageCount)));

const normalizePageIndex = (pageIndex: number, pageCount: number) =>
  pageCount <= 0
    ? 0
    : clamp(Math.trunc(finiteNumber(pageIndex)), 0, pageCount - 1);

const normalizeUnit = (value: number, fallback: number) =>
  clamp(finiteNumber(value, fallback), 0, 1);

function normalizedBookKey(bookKey: string) {
  const normalized = bookKey.trim();
  if (!normalized) {
    throw new TypeError("Book inspection requires a non-empty book key");
  }
  return normalized;
}

function cloneOrbitSnapshot(
  snapshot: BookInspectionOrbitSnapshot | null | undefined
): BookInspectionOrbitSnapshot | null {
  if (!snapshot) return null;
  return {
    cameraPosition: [...snapshot.cameraPosition] as [number, number, number],
    target: [...snapshot.target] as [number, number, number],
    ...(snapshot.zoom === undefined ? {} : { zoom: snapshot.zoom }),
  };
}

export function createBookInspectionSession({
  bookKey,
  pageCount: requestedPageCount,
  pageIndex: requestedPageIndex = 0,
  orbitSnapshot = null,
  requestId = 0,
}: CreateBookInspectionSessionInput): BookInspectionSession {
  const pageCount = normalizePageCount(requestedPageCount);
  const pageIndex = normalizePageIndex(requestedPageIndex, pageCount);

  return {
    version: BOOK_INSPECTION_SESSION_VERSION,
    bookKey: normalizedBookKey(bookKey),
    pageIndex,
    pageCount,
    direction: "forward",
    dragProgress: 0,
    phase: "idle",
    pendingBookKey: null,
    orbitSnapshot: cloneOrbitSnapshot(orbitSnapshot),
    requestId: normalizeRequestId(requestId),
    settlePageIndex: pageIndex,
    pendingPageCount: 0,
    pendingPageIndex: 0,
    settlement: "none",
  };
}

export function getBookInspectionPageTarget(
  session: BookInspectionSession,
  direction: BookInspectionPageDirection
) {
  const delta = direction === "forward" ? 1 : -1;
  return normalizePageIndex(session.pageIndex + delta, session.pageCount);
}

export const getNextBookInspectionPageTarget = (
  session: BookInspectionSession
) => getBookInspectionPageTarget(session, "forward");

export const getPreviousBookInspectionPageTarget = (
  session: BookInspectionSession
) => getBookInspectionPageTarget(session, "backward");

/** Returns `null` for keys the inspection controller does not own. */
export function getBookInspectionKeyboardTarget(
  session: BookInspectionSession,
  key: string,
  shiftKey = false
): number | null {
  switch (key) {
    case "ArrowRight":
    case "PageDown":
      return getNextBookInspectionPageTarget(session);
    case "ArrowLeft":
    case "PageUp":
      return getPreviousBookInspectionPageTarget(session);
    case " ":
    case "Spacebar":
      return shiftKey
        ? getPreviousBookInspectionPageTarget(session)
        : getNextBookInspectionPageTarget(session);
    case "Home":
      return 0;
    case "End":
      return Math.max(0, session.pageCount - 1);
    default:
      return null;
  }
}

const acceptsNewRequest = (
  session: BookInspectionSession,
  requestId: number
) => normalizeRequestId(requestId) > session.requestId;

export function beginBookInspectionDrag(
  session: BookInspectionSession,
  requestId: number,
  direction: BookInspectionPageDirection
): BookInspectionSession {
  if (
    session.phase !== "idle" ||
    session.bookKey === null ||
    !acceptsNewRequest(session, requestId) ||
    getBookInspectionPageTarget(session, direction) === session.pageIndex
  ) {
    return session;
  }

  return {
    ...session,
    direction,
    dragProgress: 0,
    phase: "dragging",
    requestId: normalizeRequestId(requestId),
    settlePageIndex: session.pageIndex,
    settlement: "none",
  };
}

export function updateBookInspectionDrag(
  session: BookInspectionSession,
  requestId: number,
  dragProgress: number
): BookInspectionSession {
  if (
    session.phase !== "dragging" ||
    normalizeRequestId(requestId) !== session.requestId
  ) {
    return session;
  }

  const nextProgress = normalizeUnit(dragProgress, session.dragProgress);
  if (nextProgress === session.dragProgress) return session;
  return { ...session, dragProgress: nextProgress };
}

export function endBookInspectionDrag(
  session: BookInspectionSession,
  {
    requestId,
    velocity,
    commitThreshold = BOOK_PAGE_TURN_COMMIT_THRESHOLD,
    velocityThreshold = BOOK_PAGE_TURN_VELOCITY_THRESHOLD,
    reverseVelocityThreshold = BOOK_PAGE_TURN_REVERSE_VELOCITY_THRESHOLD,
  }: EndBookInspectionDragOptions
): BookInspectionSession {
  if (
    session.phase !== "dragging" ||
    normalizeRequestId(requestId) !== session.requestId
  ) {
    return session;
  }

  const target = getBookInspectionPageTarget(session, session.direction);
  const directionSign = session.direction === "forward" ? 1 : -1;
  const directionalVelocity = finiteNumber(velocity) * directionSign;
  const safeCommitThreshold = normalizeUnit(
    commitThreshold,
    BOOK_PAGE_TURN_COMMIT_THRESHOLD
  );
  const safeVelocityThreshold = Math.max(
    0,
    finiteNumber(velocityThreshold, BOOK_PAGE_TURN_VELOCITY_THRESHOLD)
  );
  const safeReverseThreshold = Math.max(
    0,
    finiteNumber(
      reverseVelocityThreshold,
      BOOK_PAGE_TURN_REVERSE_VELOCITY_THRESHOLD
    )
  );
  const stronglyReversed = directionalVelocity <= -safeReverseThreshold;
  const committed =
    target !== session.pageIndex &&
    !stronglyReversed &&
    (session.dragProgress >= safeCommitThreshold ||
      directionalVelocity >= safeVelocityThreshold);

  return {
    ...session,
    phase: "settling",
    dragProgress: committed ? 1 : 0,
    settlePageIndex: committed ? target : session.pageIndex,
    settlement: "page",
  };
}

export function requestBookInspectionPage(
  session: BookInspectionSession,
  requestId: number,
  requestedPageIndex: number
): BookInspectionSession {
  if (
    session.phase !== "idle" ||
    session.bookKey === null ||
    !acceptsNewRequest(session, requestId)
  ) {
    return session;
  }

  const target = normalizePageIndex(requestedPageIndex, session.pageCount);
  if (target === session.pageIndex) return session;
  return {
    ...session,
    direction: target > session.pageIndex ? "forward" : "backward",
    dragProgress: 1,
    phase: "settling",
    requestId: normalizeRequestId(requestId),
    settlePageIndex: target,
    settlement: "page",
  };
}

export const requestNextBookInspectionPage = (
  session: BookInspectionSession,
  requestId: number
) =>
  requestBookInspectionPage(
    session,
    requestId,
    getNextBookInspectionPageTarget(session)
  );

export const requestPreviousBookInspectionPage = (
  session: BookInspectionSession,
  requestId: number
) =>
  requestBookInspectionPage(
    session,
    requestId,
    getPreviousBookInspectionPageTarget(session)
  );

export function requestBookInspectionSwitch(
  session: BookInspectionSession,
  requestId: number,
  book: Readonly<{
    bookKey: string;
    pageCount: number;
    pageIndex?: number;
  }>
): BookInspectionSession {
  if (!acceptsNewRequest(session, requestId)) return session;
  const pendingBookKey = normalizedBookKey(book.bookKey);
  if (pendingBookKey === session.bookKey && session.phase === "idle") {
    return session;
  }
  const pendingPageCount = normalizePageCount(book.pageCount);

  return {
    ...session,
    phase: "settling",
    direction: "forward",
    dragProgress: 0,
    pendingBookKey,
    pendingPageCount,
    pendingPageIndex: normalizePageIndex(
      book.pageIndex ?? 0,
      pendingPageCount
    ),
    requestId: normalizeRequestId(requestId),
    settlePageIndex: session.pageIndex,
    settlement: "switch",
  };
}

export function requestBookInspectionClose(
  session: BookInspectionSession,
  requestId: number
): BookInspectionSession {
  if (session.bookKey === null || !acceptsNewRequest(session, requestId)) {
    return session;
  }
  return {
    ...session,
    phase: "settling",
    dragProgress: 0,
    pendingBookKey: null,
    pendingPageCount: 0,
    pendingPageIndex: 0,
    requestId: normalizeRequestId(requestId),
    settlePageIndex: session.pageIndex,
    settlement: "close",
  };
}

/**
 * Commits only the currently active request. A switch activates its pending
 * book after the old one has settled closed; stale animation callbacks are
 * identity-preserving no-ops.
 */
export function settleBookInspectionSession(
  session: BookInspectionSession,
  requestId: number
): BookInspectionSession {
  if (
    session.phase !== "settling" ||
    normalizeRequestId(requestId) !== session.requestId
  ) {
    return session;
  }

  if (session.settlement === "switch" && session.pendingBookKey) {
    return {
      ...session,
      bookKey: session.pendingBookKey,
      pageIndex: session.pendingPageIndex,
      pageCount: session.pendingPageCount,
      direction: "forward",
      dragProgress: 0,
      phase: "idle",
      pendingBookKey: null,
      settlePageIndex: session.pendingPageIndex,
      pendingPageCount: 0,
      pendingPageIndex: 0,
      settlement: "none",
    };
  }

  if (session.settlement === "close") {
    return {
      ...session,
      bookKey: null,
      pageIndex: 0,
      pageCount: 0,
      direction: "forward",
      dragProgress: 0,
      phase: "idle",
      pendingBookKey: null,
      settlePageIndex: 0,
      pendingPageCount: 0,
      pendingPageIndex: 0,
      settlement: "none",
    };
  }

  return {
    ...session,
    pageIndex: normalizePageIndex(
      session.settlePageIndex,
      session.pageCount
    ),
    dragProgress: 0,
    phase: "idle",
    settlePageIndex: normalizePageIndex(
      session.settlePageIndex,
      session.pageCount
    ),
    settlement: "none",
  };
}

export function captureBookInspectionSnapshot(
  session: BookInspectionSession
): BookInspectionRestoreSnapshot | null {
  if (!session.bookKey) return null;
  return {
    version: BOOK_INSPECTION_SESSION_VERSION,
    bookKey: session.bookKey,
    pageIndex: session.pageIndex,
    pageCount: session.pageCount,
    orbitSnapshot: cloneOrbitSnapshot(session.orbitSnapshot),
  };
}

export function restoreBookInspectionSnapshot(
  session: BookInspectionSession,
  requestId: number,
  snapshot: BookInspectionRestoreSnapshot
): BookInspectionSession {
  if (
    snapshot.version !== BOOK_INSPECTION_SESSION_VERSION ||
    !acceptsNewRequest(session, requestId)
  ) {
    return session;
  }
  const restored = createBookInspectionSession({
    bookKey: snapshot.bookKey,
    pageCount: snapshot.pageCount,
    pageIndex: snapshot.pageIndex,
    orbitSnapshot: snapshot.orbitSnapshot,
    requestId,
  });
  return restored;
}
