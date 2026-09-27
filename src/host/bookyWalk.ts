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

const validBounds = (rect: BookyWalkBounds) => [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
  && rect.width > 0 && rect.height > 0;
const overlaps = (a: BookyWalkBounds, b: BookyWalkBounds) => a.left < b.left + b.width
  && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
function walkLimits(size: Readonly<{ width: number; height: number }>, viewport: BookyWalkBounds) {
  if (!validBounds(viewport) || !Number.isFinite(size.width) || !Number.isFinite(size.height)
    || size.width <= 0 || size.height <= 0) return null;
  const left = viewport.left + 12, right = viewport.left + viewport.width - size.width - 12;
  const top = viewport.top + 12, bottom = viewport.top + viewport.height - size.height - 12;
  return right < left || bottom < top ? null : { left, right, top, bottom };
}

/** A moving header can change only the reserved top edge without changing
 * the physical viewport. An explicit, still-current target route may continue
 * only when its entire straight path remains inside the new safe area. */
export function isBookyWalkTopInsetSafe(path: BookyWalkPath, size: Readonly<{ width: number; height: number }>,
  previous: BookyWalkBounds, current: BookyWalkBounds): boolean {
  const limits = walkLimits(size, current);
  if (!limits || !validBounds(previous)
    || Math.abs(previous.left - current.left) > .5 || Math.abs(previous.width - current.width) > .5
    || Math.abs(previous.top + previous.height - current.top - current.height) > .5) return false;
  // sampleBookyWalk interpolates monotonically between these endpoints, so
  // their containment also proves containment of every intermediate frame.
  return [path.from, path.to].every(point => Number.isFinite(point.left) && Number.isFinite(point.top)
    && point.left >= limits.left && point.left <= limits.right && point.top >= limits.top && point.top <= limits.bottom);
}

/** Validate the whole horizontal row swept by a manual walk, including controls
 * that appeared after planning. This does not govern an explicit target approach. */
export function isBookyWalkPathClear(path: BookyWalkPath, size: Readonly<{ width: number; height: number }>,
  viewport: BookyWalkBounds, controls: readonly BookyWalkBounds[] = []): boolean {
  const limits = walkLimits(size, viewport);
  if (!limits || ![path.from.left, path.from.top, path.to.left, path.to.top].every(Number.isFinite)
    || path.from.top !== path.to.top) return false;
  for (const point of [path.from, path.to]) {
    if (point.left < limits.left || point.left > limits.right || point.top < limits.top || point.top > limits.bottom) return false;
  }
  const swept = { left: Math.min(path.from.left, path.to.left), top: path.from.top,
    width: Math.abs(path.to.left - path.from.left) + size.width, height: size.height };
  return !controls.some(rect => validBounds(rect) && overlaps(rect, viewport) && overlaps(rect, swept));
}

/** A deliberate short horizontal walk from the current resting row. No camera,
 * persistence, timers or page coordinates are owned by the path. */
export function planBookyWalk(current: BookyWalkPoint, size: Readonly<{ width: number; height: number }>,
  viewport: BookyWalkBounds, controls: readonly BookyWalkBounds[] = []): BookyWalkPath | null {
  const limits = walkLimits(size, viewport);
  if (!limits || ![current.left, current.top].every(Number.isFinite)) return null;
  let { left, right } = limits;
  const top = Math.max(limits.top, Math.min(limits.bottom, current.top));
  const x = Math.max(left, Math.min(right, current.left));
  for (const rect of controls) {
    if (!validBounds(rect) || !overlaps(rect, viewport) || rect.top >= top + size.height || rect.top + rect.height <= top) continue;
    if (rect.left + rect.width <= x) left = Math.max(left, rect.left + rect.width);
    else if (rect.left >= x + size.width) right = Math.min(right, rect.left - size.width);
    else return null;
  }
  const direction = x - left >= right - x ? -1 : 1;
  const distance = Math.min(220, direction < 0 ? x - left : right - x);
  if (distance < 32) return null;
  return Object.freeze({ from: Object.freeze({ left: x, top }),
    to: Object.freeze({ left: x + direction * distance, top }), direction });
}

/** Finish an explicitly requested demonstration in a measured, reserved dock.
 * Never repair the starting point by teleporting it into a different viewport. */
export function planBookyDockReturn(current: BookyWalkPoint, size: Readonly<{ width: number; height: number }>,
  viewport: BookyWalkBounds, dock: BookyWalkBounds): BookyWalkPath | null {
  const full = walkLimits(size, viewport);
  if (!full || !validBounds(dock) || ![current.left, current.top].every(Number.isFinite)
    || current.left < full.left || current.left > full.right || current.top < full.top || current.top > full.bottom) return null;
  const left = Math.max(viewport.left, dock.left), top = Math.max(viewport.top, dock.top);
  const bounds = walkLimits(size, { left, top,
    width: Math.min(viewport.left + viewport.width, dock.left + dock.width) - left,
    height: Math.min(viewport.top + viewport.height, dock.top + dock.height) - top });
  if (!bounds) return null;
  const to = { left: Math.max(bounds.left, Math.min(bounds.right, current.left)),
    top: Math.max(bounds.top, Math.min(bounds.bottom, current.top)) };
  return { from: { ...current }, to, direction: to.left >= current.left ? 1 : -1 };
}

export function sampleBookyWalk(path: BookyWalkPath, progress: number): BookyWalkPoint {
  const phase = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const eased = phase * phase * (3 - 2 * phase);
  return { left: path.from.left + (path.to.left - path.from.left) * eased,
    top: path.from.top + (path.to.top - path.from.top) * eased };
}
