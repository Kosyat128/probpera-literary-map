export type BookyWalkPoint = Readonly<{ left: number; top: number }>;
export type BookyWalkBounds = BookyWalkPoint & Readonly<{ width: number; height: number }>;
export type BookyWalkPath = Readonly<{ from: BookyWalkPoint; to: BookyWalkPoint; direction: -1 | 1 }>;
export const BOOKY_APPROACH_MS = 1600;

/** Place the open hand beside a visible target, keeping the whole companion
 * within the viewport. The selected control remains the only action owner. */
export function planBookyApproach(current: BookyWalkPoint, size: Readonly<{ width: number; height: number }>,
  viewport: BookyWalkBounds, target: BookyWalkBounds,
  hand = { left: size.width * .18, top: size.width * .48 }): (BookyWalkPath & { touch: BookyWalkPoint }) | null {
  if (![current.left, current.top, size.width, size.height, ...Object.values(viewport), ...Object.values(target)]
    .every(Number.isFinite) || !Number.isFinite(hand.left) || !Number.isFinite(hand.top)
    || hand.left < 0 || hand.left > size.width || hand.top < 0 || hand.top > size.height
    || size.width <= 0 || size.height <= 0 || target.width < 2 || target.height < 2
    || viewport.width < size.width + 24 || viewport.height < size.height + 24) return null;
  const clamp = (point: BookyWalkPoint) => ({
    left: Math.max(viewport.left + 12, Math.min(point.left, viewport.left + viewport.width - size.width - 12)),
    top: Math.max(viewport.top + 12, Math.min(point.top, viewport.top + viewport.height - size.height - 12)),
  });
  const handX = hand.left, handY = hand.top;
  const left = Math.max(target.left + 4, viewport.left + 12 + handX);
  const right = Math.min(target.left + target.width - 4, viewport.left + viewport.width - size.width - 12 + handX);
  const top = Math.max(target.top + 4, viewport.top + 12 + handY);
  const bottom = Math.min(target.top + target.height - 4, viewport.top + viewport.height - size.height - 12 + handY);
  if (right < left || bottom < top) return null;
  const touch = { left: right, top: (top + bottom) / 2 };
  const from = clamp(current), to = clamp({ left: touch.left - handX, top: touch.top - handY });
  return { from, to, touch, direction: to.left >= from.left ? 1 : -1 };
}

/** A deliberate short walk along the lower viewport margin. No camera,
 * persistence, timers or page coordinates are owned by the path. */
export function planBookyWalk(current: BookyWalkPoint, size: Readonly<{ width: number; height: number }>,
  viewport: BookyWalkBounds): BookyWalkPath | null {
  if (![current.left, current.top, size.width, size.height, viewport.left, viewport.top, viewport.width, viewport.height]
    .every(Number.isFinite) || size.width <= 0 || size.height <= 0) return null;
  const left = viewport.left + 12, right = viewport.left + viewport.width - size.width - 12;
  const top = viewport.top + viewport.height - size.height - 12;
  if (right - left < 32 || top < viewport.top + 12) return null;
  const x = Math.max(left, Math.min(right, current.left));
  const direction = x - left >= right - x ? -1 : 1;
  const distance = Math.min(220, direction < 0 ? x - left : right - x);
  return Object.freeze({ from: Object.freeze({ left: x, top }),
    to: Object.freeze({ left: x + direction * distance, top }), direction });
}

export function sampleBookyWalk(path: BookyWalkPath, progress: number): BookyWalkPoint {
  const phase = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const eased = phase * phase * (3 - 2 * phase);
  return { left: path.from.left + (path.to.left - path.from.left) * eased,
    top: path.from.top + (path.to.top - path.from.top) * eased };
}
