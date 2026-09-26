type Point = Readonly<{ left: number; top: number }>;
type Size = Readonly<{ width: number; height: number }>;
export type BookyPlacementRect = Point & Size;
const GAP = 12;
const valid = (rect: BookyPlacementRect) => Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0;
const intersection = (a: BookyPlacementRect, b: BookyPlacementRect) =>
  Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

/** Nearest free resting place, with deterministic minimum obstruction if no place fits.
 * The finite edge candidates include holes between controls; there is no frame polling.
 */
export function placeBooky(preferred: Point, size: Size, view: BookyPlacementRect,
  controls: readonly BookyPlacementRect[]): Point {
  const minX = view.left + GAP, minY = view.top + GAP;
  const maxX = Math.max(minX, view.left + view.width - size.width - GAP);
  const maxY = Math.max(minY, view.top + view.height - size.height - GAP);
  const clampX = (x: number) => Math.max(minX, Math.min(maxX, x));
  const clampY = (y: number) => Math.max(minY, Math.min(maxY, y));
  const origin = { left: clampX(Number.isFinite(preferred.left) ? preferred.left : maxX),
    top: clampY(Number.isFinite(preferred.top) ? preferred.top : maxY) };
  const obstacles = controls.filter(rect => valid(rect) && intersection(rect, view) > 0);
  const area = (point: Point) => obstacles.reduce((sum, rect) => sum + intersection({ ...point, ...size }, rect), 0);
  if (area(origin) === 0) return origin;
  const xs = new Set([origin.left, minX, maxX]), ys = new Set([origin.top, minY, maxY]);
  for (const rect of obstacles) {
    xs.add(clampX(rect.left - size.width - GAP)); xs.add(clampX(rect.left + rect.width + GAP));
    ys.add(clampY(rect.top - size.height - GAP)); ys.add(clampY(rect.top + rect.height + GAP));
  }
  let best = origin, bestArea = area(origin), bestDistance = 0;
  for (const left of xs) for (const top of ys) {
    const point = { left, top }, covered = area(point);
    const distance = (left - origin.left) ** 2 + (top - origin.top) ** 2;
    if (covered < bestArea || (covered === bestArea && distance < bestDistance)) {
      best = point; bestArea = covered; bestDistance = distance;
    }
  }
  return best;
}

/** A full-width lower navigation strip also limits a portrait help sheet.
 * Short landscape screens retain side-by-side space instead of clipping the pet.
 */
export function bookyCardViewport(view: BookyPlacementRect, size: Size,
  controls: readonly BookyPlacementRect[]): BookyPlacementRect {
  let bottom = view.top + view.height;
  for (const rect of controls) {
    if (valid(rect) && rect.width >= view.width * .6 && rect.top > view.top + view.height / 2
      && rect.top - view.top >= size.height + 100 + GAP * 3) bottom = Math.min(bottom, rect.top);
  }
  return { ...view, height: bottom - view.top };
}

export function bookyCardWidth(view: BookyPlacementRect, pet: BookyPlacementRect): number {
  const fullWidth = Math.min(340, Math.max(180, view.width - GAP * 2));
  const beside = Math.max(pet.left - view.left,
    view.left + view.width - pet.left - pet.width) - GAP * 2;
  // A short landscape screen can have a readable column just under 340 px.
  // Keep portrait cards full width when neither side can hold readable text.
  return beside >= 240 ? Math.min(fullWidth, beside) : fullWidth;
}

export function bookyCardHeightLimit(view: BookyPlacementRect, pet: BookyPlacementRect, cardWidth: number): number {
  const beside = pet.left - view.left >= cardWidth + GAP * 2
    || view.left + view.width - pet.left - pet.width >= cardWidth + GAP * 2;
  return Math.max(100, Math.min(view.height - GAP * 2, beside ? view.height - GAP * 2
    : Math.max(pet.top - view.top - GAP * 2, view.top + view.height - pet.top - pet.height - GAP * 2)));
}

/** Search the finite gaps between controls before accepting an overlay.
 * Keep a readable scroll area; a crowded screen cannot promise zero overlap.
 */
export function placeBookyCard(preferred: Point, size: Size, view: BookyPlacementRect,
  pet: BookyPlacementRect, controls: readonly BookyPlacementRect[], minimumHeight = 200): BookyPlacementRect {
  const width = Math.min(size.width, Math.max(1, view.width - GAP * 2));
  const height = Math.min(size.height, Math.max(1, view.height - GAP * 2));
  // Leave room below the sticky heading and selected-entity summary to read a
  // useful part of the page. Enlarged text may need a taller actionable area;
  // neither that request nor the default can exceed the actual card/view space.
  const requestedMinimum = Number.isFinite(minimumHeight) && minimumHeight > 0 ? Math.max(1, minimumHeight) : 200;
  const minHeight = Math.min(requestedMinimum, height);
  const leftEdge = view.left + GAP, topEdge = view.top + GAP;
  const rightEdge = view.left + view.width - GAP, bottomEdge = view.top + view.height - GAP;
  const clampX = (x: number) => Math.max(leftEdge, Math.min(rightEdge - width, x));
  const clampY = (y: number, h: number) => Math.max(topEdge, Math.min(bottomEdge - h, y));
  const origin = { left: clampX(preferred.left), top: clampY(preferred.top, height), width, height };
  const obstacles = controls.filter(rect => valid(rect) && intersection(rect, view) > 0);
  const edges = [pet, ...obstacles].filter(valid);
  const xs = new Set([origin.left, leftEdge, clampX(rightEdge - width)]);
  const ys = new Set([origin.top, topEdge, clampY(bottomEdge - height, height)]);
  for (const rect of edges) {
    xs.add(clampX(rect.left - width - GAP)); xs.add(clampX(rect.left + rect.width + GAP));
    ys.add(clampY(rect.top - height - GAP, height));
    ys.add(clampY(rect.top + rect.height + GAP, minHeight));
  }
  const score = (rect: BookyPlacementRect) => [intersection(rect, pet),
    obstacles.reduce((sum, obstacle) => sum + intersection(rect, obstacle), 0), -rect.height,
    (rect.left - origin.left) ** 2 + (rect.top - origin.top) ** 2];
  const better = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };
  let best = origin, bestScore = score(best);
  if (bestScore[0] === 0 && bestScore[1] === 0) return best;
  for (const left of xs) for (const top of ys) {
    const available = bottomEdge - top;
    if (available < minHeight) continue;
    const heights = new Set([Math.min(height, available), minHeight]);
    for (const rect of edges) {
      const h = rect.top - GAP - top;
      if (h >= minHeight && h <= height && h <= available) heights.add(h);
    }
    for (const h of heights) {
      const candidate = { left, top, width, height: h }, candidateScore = score(candidate);
      if (better(candidateScore, bestScore)) { best = candidate; bestScore = candidateScore; }
    }
  }
  return best;
}
