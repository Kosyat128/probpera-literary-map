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

export function bookyCardHeightLimit(view: BookyPlacementRect, pet: BookyPlacementRect, cardWidth: number): number {
  const beside = pet.left - view.left >= cardWidth + GAP * 2
    || view.left + view.width - pet.left - pet.width >= cardWidth + GAP * 2;
  return Math.max(100, Math.min(view.height - GAP * 2, beside ? view.height - GAP * 2
    : Math.max(pet.top - view.top - GAP * 2, view.top + view.height - pet.top - pet.height - GAP * 2)));
}
