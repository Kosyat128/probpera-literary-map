export const BOOK_SHELF_PAGE_SIZE = 13;

export type BookShelfNavigationDirection = -1 | 0 | 1;

export type BookShelfNavigationKey =
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown";

export type BookShelfNavigationState = Readonly<{
  focusIndex: number;
  total: number;
  pageSize: number;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  canMovePagePrevious: boolean;
  canMovePageNext: boolean;
  previousIndex: number;
  nextIndex: number;
  pagePreviousIndex: number;
  pageNextIndex: number;
}>;

function finiteInteger(value: number, fallback = 0) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function normalizedTotal(total: number) {
  return Math.max(0, finiteInteger(total));
}

function normalizedPageSize(pageSize: number) {
  return Math.max(1, finiteInteger(pageSize, BOOK_SHELF_PAGE_SIZE));
}

/** Returns -1 for an empty shelf and otherwise clamps without wrapping. */
export function clampBookShelfFocusIndex(focusIndex: number, total: number) {
  const safeTotal = normalizedTotal(total);
  if (safeTotal === 0) return -1;
  return Math.min(safeTotal - 1, Math.max(0, finiteInteger(focusIndex)));
}

export function getBookShelfNavigationState(
  focusIndex: number,
  total: number,
  pageSize = BOOK_SHELF_PAGE_SIZE
): BookShelfNavigationState {
  const safeTotal = normalizedTotal(total);
  const safePageSize = normalizedPageSize(pageSize);
  const safeIndex = clampBookShelfFocusIndex(focusIndex, safeTotal);

  if (safeIndex < 0) {
    return {
      focusIndex: -1,
      total: 0,
      pageSize: safePageSize,
      canMovePrevious: false,
      canMoveNext: false,
      canMovePagePrevious: false,
      canMovePageNext: false,
      previousIndex: -1,
      nextIndex: -1,
      pagePreviousIndex: -1,
      pageNextIndex: -1,
    };
  }

  const lastIndex = safeTotal - 1;
  const previousIndex = Math.max(0, safeIndex - 1);
  const nextIndex = Math.min(lastIndex, safeIndex + 1);
  const pagePreviousIndex = Math.max(0, safeIndex - safePageSize);
  const pageNextIndex = Math.min(lastIndex, safeIndex + safePageSize);

  return {
    focusIndex: safeIndex,
    total: safeTotal,
    pageSize: safePageSize,
    canMovePrevious: previousIndex !== safeIndex,
    canMoveNext: nextIndex !== safeIndex,
    canMovePagePrevious: pagePreviousIndex !== safeIndex,
    canMovePageNext: pageNextIndex !== safeIndex,
    previousIndex,
    nextIndex,
    pagePreviousIndex,
    pageNextIndex,
  };
}

/**
 * Resolves the six shelf-navigation keys to a finite index. Unsupported keys
 * return null; edge keys return the current edge and never modulo-wrap.
 */
export function resolveBookShelfKeyboardNavigation({
  key,
  focusIndex,
  total,
  pageSize = BOOK_SHELF_PAGE_SIZE,
}: Readonly<{
  key: string;
  focusIndex: number;
  total: number;
  pageSize?: number;
}>): number | null {
  const state = getBookShelfNavigationState(focusIndex, total, pageSize);
  if (state.focusIndex < 0) return null;

  switch (key as BookShelfNavigationKey) {
    case "ArrowLeft":
      return state.previousIndex;
    case "ArrowRight":
      return state.nextIndex;
    case "Home":
      return 0;
    case "End":
      return state.total - 1;
    case "PageUp":
      return state.pagePreviousIndex;
    case "PageDown":
      return state.pageNextIndex;
    default:
      return null;
  }
}

export type BookShelfWheelInput = Readonly<{
  deltaX: number;
  deltaY?: number;
  deltaMode?: number;
  shiftKey?: boolean;
}>;

export type BookShelfWheelOptions = Readonly<{
  linePixels?: number;
  pagePixels?: number;
  maximumDelta?: number;
  threshold?: number;
}>;

/**
 * Converts horizontal wheel/trackpad input to a bounded pixel-like delta.
 * Horizontal trackpad input has priority; a conventional vertical wheel is
 * also accepted while focus is over the shelf. The controller decides whether
 * an edge event should pass through to ordinary page scrolling.
 */
export function normalizeBookShelfWheelDelta(
  input: BookShelfWheelInput,
  options: BookShelfWheelOptions = {}
) {
  const deltaX = Number.isFinite(input.deltaX) ? input.deltaX : 0;
  const deltaY = Number.isFinite(input.deltaY) ? (input.deltaY ?? 0) : 0;
  const rawDelta = deltaX !== 0 ? deltaX : deltaY;
  if (rawDelta === 0) return 0;

  const linePixels = Math.max(1, options.linePixels ?? 16);
  const pagePixels = Math.max(linePixels, options.pagePixels ?? 800);
  const maximumDelta = Math.max(1, options.maximumDelta ?? 160);
  const modeScale = input.deltaMode === 1 ? linePixels : input.deltaMode === 2 ? pagePixels : 1;
  const scaledDelta = rawDelta * modeScale;
  return Math.max(-maximumDelta, Math.min(maximumDelta, scaledDelta));
}

/** Resolves one sufficiently strong wheel event to previous/next intent. */
export function resolveBookShelfWheelIntent(
  input: BookShelfWheelInput,
  options: BookShelfWheelOptions = {}
): BookShelfNavigationDirection {
  const delta = normalizeBookShelfWheelDelta(input, options);
  const threshold = Math.max(0, options.threshold ?? 4);
  if (Math.abs(delta) < threshold) return 0;
  return delta > 0 ? 1 : -1;
}

export type BookShelfWheelAccumulator = Readonly<{
  remainder: number;
  direction: BookShelfNavigationDirection;
}>;

/**
 * Accumulates small trackpad deltas into one finite navigation step. A change
 * of direction clears the latent opposite-direction remainder.
 */
export function accumulateBookShelfWheelIntent(
  previousRemainder: number,
  input: BookShelfWheelInput,
  options: BookShelfWheelOptions = {}
): BookShelfWheelAccumulator {
  const delta = normalizeBookShelfWheelDelta(input, options);
  if (delta === 0) return { remainder: 0, direction: 0 };

  const safePrevious = Number.isFinite(previousRemainder)
    ? previousRemainder
    : 0;
  const sameDirection = safePrevious === 0 || Math.sign(safePrevious) === Math.sign(delta);
  const remainder = (sameDirection ? safePrevious : 0) + delta;
  const threshold = Math.max(1, options.threshold ?? 32);
  if (Math.abs(remainder) < threshold) {
    return { remainder, direction: 0 };
  }
  return { remainder: 0, direction: remainder > 0 ? 1 : -1 };
}

export type BookShelfSwipeInput = Readonly<{
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}>;

export type BookShelfSwipeOptions = Readonly<{
  threshold?: number;
  axisLockRatio?: number;
}>;

/** A leftward swipe advances; a rightward swipe moves to the previous book. */
export function resolveBookShelfSwipeIntent(
  input: BookShelfSwipeInput,
  options: BookShelfSwipeOptions = {}
): BookShelfNavigationDirection {
  const values = [input.startX, input.startY, input.endX, input.endY];
  if (values.some((value) => !Number.isFinite(value))) return 0;

  const deltaX = input.endX - input.startX;
  const deltaY = input.endY - input.startY;
  const threshold = Math.max(1, options.threshold ?? 44);
  const axisLockRatio = Math.max(1, options.axisLockRatio ?? 1.15);
  if (
    Math.abs(deltaX) < threshold ||
    Math.abs(deltaX) < Math.abs(deltaY) * axisLockRatio
  ) {
    return 0;
  }
  return deltaX < 0 ? 1 : -1;
}

export type BookShelfProgressState = Readonly<{
  focusIndex: number;
  current: number;
  total: number;
  minimum: number;
  maximum: number;
  value: number;
  disabled: boolean;
}>;

export function getBookShelfProgressState(
  focusIndex: number,
  total: number
): BookShelfProgressState {
  const safeTotal = normalizedTotal(total);
  const safeIndex = clampBookShelfFocusIndex(focusIndex, safeTotal);
  if (safeIndex < 0) {
    return {
      focusIndex: -1,
      current: 0,
      total: 0,
      minimum: 0,
      maximum: 0,
      value: 0,
      disabled: true,
    };
  }
  return {
    focusIndex: safeIndex,
    current: safeIndex + 1,
    total: safeTotal,
    minimum: 1,
    maximum: safeTotal,
    value: safeIndex + 1,
    disabled: safeTotal <= 1,
  };
}

/** Converts the one-based range value back to the controller's zero-based index. */
export function bookShelfProgressValueToFocusIndex(value: number, total: number) {
  if (normalizedTotal(total) === 0) return -1;
  return clampBookShelfFocusIndex(finiteInteger(value, 1) - 1, total);
}
