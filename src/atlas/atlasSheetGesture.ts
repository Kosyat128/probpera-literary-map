import type { AtlasExperienceSheetState } from "./atlasExperienceState";

export type AtlasSheetHeights = Record<AtlasExperienceSheetState, number>;
export const ATLAS_SHEET_STATES: readonly AtlasExperienceSheetState[] = ["collapsed", "half", "expanded"];
export const ATLAS_SHEET_DRAG_THRESHOLD = 8;

export function atlasSheetDragIntent(x: number, y: number): "pending" | "vertical" | "cancel" {
  if (Math.max(Math.abs(x), Math.abs(y)) < ATLAS_SHEET_DRAG_THRESHOLD) return "pending";
  return Math.abs(y) > Math.abs(x) ? "vertical" : "cancel";
}

export function clampAtlasSheetHeight(height: number, heights: AtlasSheetHeights): number {
  const values = ATLAS_SHEET_STATES.map(state => heights[state]);
  return Math.min(Math.max(...values), Math.max(Math.min(...values), height));
}

/** Settle an actual CSS-sized sheet; an intentional flick can cross a midpoint. */
export function atlasSheetSnap({ state, heights, height, deltaY, velocityY }: {
  state: AtlasExperienceSheetState;
  heights: AtlasSheetHeights;
  height: number;
  deltaY: number;
  velocityY: number;
}): AtlasExperienceSheetState {
  const flick = Math.abs(deltaY) >= 24 && Math.abs(velocityY) >= 0.55;
  const projected = clampAtlasSheetHeight(height - (flick ? Math.max(-2, Math.min(2, velocityY)) * 140 : 0), heights);
  // Keep the current semantic state when cramped layouts share a snap height.
  let nearest = state;
  for (const candidate of ATLAS_SHEET_STATES) {
    if (Math.abs(heights[candidate] - projected) < Math.abs(heights[nearest] - projected)) nearest = candidate;
  }
  if (flick && nearest === state) {
    const step = velocityY < 0 ? 1 : -1;
    return ATLAS_SHEET_STATES[Math.max(0, Math.min(2, ATLAS_SHEET_STATES.indexOf(state) + step))];
  }
  return nearest;
}
