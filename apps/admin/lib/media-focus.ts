export type MediaFocusBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function clampMediaFocus(value: number) {
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

export function mediaFocusFromPoint(
  clientX: number,
  clientY: number,
  bounds: MediaFocusBounds
) {
  if (!bounds.width || !bounds.height) return null;
  return {
    x: clampMediaFocus((clientX - bounds.left) / bounds.width),
    y: clampMediaFocus((clientY - bounds.top) / bounds.height),
  };
}
