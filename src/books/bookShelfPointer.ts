export type BookShelfPointerStart = Readonly<{
  pointerId: number;
  pointerType: string;
  x: number;
  y: number;
  at: number;
  moved: boolean;
}>;

export function advanceBookShelfPointer(
  start: BookShelfPointerStart,
  pointer: { pointerId: number; x: number; y: number },
): BookShelfPointerStart {
  if (pointer.pointerId !== start.pointerId || start.moved) return start;
  const threshold = start.pointerType === "mouse" ? 5 : 10;
  return Math.hypot(pointer.x - start.x, pointer.y - start.y) > threshold
    ? { ...start, moved: true } : start;
}

export function bookShelfPointerIsClick(
  start: BookShelfPointerStart | null,
  pointer: { pointerId: number; x: number; y: number; at: number; cancelled?: boolean },
) {
  if (!start || pointer.cancelled || pointer.pointerId !== start.pointerId) return false;
  const elapsed = pointer.at - start.at;
  return elapsed >= 0 && elapsed <= 650 && !advanceBookShelfPointer(start, pointer).moved;
}

export type BookShelfSpineHit = Readonly<{
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

/** Overlapping touch targets resolve by the nearest visible spine centre. */
export function nearestBookShelfSpine(
  candidates: readonly BookShelfSpineHit[], x: number, y: number,
) {
  let result: BookShelfSpineHit | null = null;
  let distance = Infinity;
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.x + candidate.y + candidate.width + candidate.height)) continue;
    if (candidate.width <= 0 || candidate.height <= 0) continue;
    const halfWidth = Math.max(22, candidate.width / 2);
    if (Math.abs(x - candidate.x) > halfWidth || Math.abs(y - candidate.y) > candidate.height / 2 + 6) continue;
    const nextDistance = Math.abs(x - candidate.x);
    if (nextDistance < distance) { result = candidate; distance = nextDistance; }
  }
  return result;
}
