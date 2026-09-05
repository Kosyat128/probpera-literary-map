export type BookShelfLayoutRect = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

export type BookShelfViewportInsets = Readonly<{
  top: number;
  right: number;
  bottom: number;
  left: number;
}>;

export const EMPTY_BOOK_SHELF_INSETS: BookShelfViewportInsets = Object.freeze({
  top: 0, right: 0, bottom: 0, left: 0,
});

/** Insets are pixels in the canvas, measured from actual intersecting surfaces. */
export function measureBookShelfViewportInsets({
  scene,
  viewport,
  overlays = [],
}: Readonly<{
  scene: BookShelfLayoutRect;
  viewport?: BookShelfLayoutRect;
  overlays?: readonly Readonly<{
    edge: keyof BookShelfViewportInsets;
    rect: BookShelfLayoutRect;
  }>[];
}>): BookShelfViewportInsets {
  if (!Object.values(scene).every(Number.isFinite)) return EMPTY_BOOK_SHELF_INSETS;
  const width = Math.max(0, scene.right - scene.left);
  const height = Math.max(0, scene.bottom - scene.top);
  if (!width || !height) return EMPTY_BOOK_SHELF_INSETS;
  const insets = { ...EMPTY_BOOK_SHELF_INSETS };
  if (viewport && Object.values(viewport).every(Number.isFinite)) {
    insets.left = Math.max(0, viewport.left - scene.left);
    insets.top = Math.max(0, viewport.top - scene.top);
    insets.right = Math.max(0, scene.right - viewport.right);
    insets.bottom = Math.max(0, scene.bottom - viewport.bottom);
  }
  for (const { edge, rect } of overlays) {
    if (!Object.values(rect).every(Number.isFinite)) continue;
    const left = Math.max(scene.left, rect.left);
    const right = Math.min(scene.right, rect.right);
    const top = Math.max(scene.top, rect.top);
    const bottom = Math.min(scene.bottom, rect.bottom);
    if (right <= left || bottom <= top) continue;
    const occlusion = edge === 'right' ? scene.right - left
      : edge === 'left' ? right - scene.left
      : edge === 'top' ? bottom - scene.top
      : scene.bottom - top;
    insets[edge] = Math.max(insets[edge], occlusion);
  }
  for (const [first, second, size] of [
    ['left', 'right', width], ['top', 'bottom', height],
  ] as const) {
    insets[first] = Math.min(size, insets[first]);
    insets[second] = Math.min(size - insets[first], insets[second]);
  }
  return Object.fromEntries(Object.entries(insets).map(([edge, value]) => [edge, Math.round(value * 100) / 100])) as BookShelfViewportInsets;
}

export function equalBookShelfViewportInsets(a: BookShelfViewportInsets, b: BookShelfViewportInsets) {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}

export function shouldRestoreBookShelfAfterOrientation(
  previous: Readonly<{ width: number; height: number; visible: boolean }>,
  next: Readonly<{ width: number; height: number }>,
  editingText = false,
) {
  if (!previous.visible || editingText) return false;
  if (![previous.width, previous.height, next.width, next.height].every(value => Number.isFinite(value) && value > 0)) return false;
  if ((previous.width > previous.height) === (next.width > next.height)) return false;
  // Browser chrome can change the usable height. A keyboard-only resize does
  // not exchange the viewport axes and must never move the user's scroll.
  return Math.abs(previous.width - next.width) >= 64 &&
    Math.abs(previous.height - next.height) >= 64 &&
    Math.abs(previous.width - next.height) <= Math.max(64, previous.width * 0.2) &&
    Math.abs(previous.height - next.width) <= Math.max(64, previous.height * 0.2);
}
