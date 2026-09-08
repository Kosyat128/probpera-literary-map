import { useCallback, useLayoutEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from "react";
import type { AtlasExperienceSheetState } from "./atlasExperienceState";
import { ATLAS_SHEET_STATES, atlasSheetDragIntent, atlasSheetSnap, clampAtlasSheetHeight, type AtlasSheetHeights } from "./atlasSheetGesture";
import "./atlasSheetGesture.css";

type Options = {
  enabled: boolean;
  countryId: string | null;
  state: AtlasExperienceSheetState;
  panelRef: RefObject<HTMLElement>;
  onSnap: (state: AtlasExperienceSheetState) => void;
};
type Gesture = {
  pointerId: number;
  handle: HTMLButtonElement;
  panel: HTMLElement;
  surface: HTMLElement | null;
  state: AtlasExperienceSheetState;
  heights: AtlasSheetHeights;
  startX: number;
  startY: number;
  startHeight: number;
  y: number;
  time: number;
  velocityY: number;
  height: number;
  dragging: boolean;
  frame: number | null;
  detach: () => void;
};

/** Read the same panel's authored snap sizes without cloning or committing state. */
function measureHeights(panel: HTMLElement): AtlasSheetHeights {
  const surface = panel.closest<HTMLElement>(".atlas-experience-surface");
  const elements = [panel, ...(surface ? [surface] : [])];
  const states = elements.map(element => element.getAttribute("data-atlas-sheet-state"));
  const transition = panel.style.getPropertyValue("transition");
  const priority = panel.style.getPropertyPriority("transition");
  const heights = {} as AtlasSheetHeights;
  try {
    panel.style.setProperty("transition", "none", "important");
    for (const state of ATLAS_SHEET_STATES) {
      for (const element of elements) element.setAttribute("data-atlas-sheet-state", state);
      heights[state] = panel.getBoundingClientRect().height;
    }
  } finally {
    elements.forEach((element, index) => {
      if (states[index] === null) element.removeAttribute("data-atlas-sheet-state");
      else element.setAttribute("data-atlas-sheet-state", states[index]!);
    });
    // Commit the restored geometry while transitions are still disabled.
    panel.getBoundingClientRect();
    if (transition) panel.style.setProperty("transition", transition, priority);
    else panel.style.removeProperty("transition");
  }
  return heights;
}

/** Handle-only direct manipulation. React receives just the final existing snap. */
export function useAtlasSheetGesture(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const gesture = useRef<Gesture | null>(null);
  const suppressPointerClick = useRef(false);

  const finish = useCallback((suppressClick: boolean) => {
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    suppressPointerClick.current = suppressClick;
    if (current.frame !== null) window.cancelAnimationFrame(current.frame);
    current.detach();
    current.surface?.removeAttribute("data-atlas-sheet-dragging");
    current.panel.removeAttribute("data-atlas-sheet-dragging");
    current.panel.removeAttribute("data-atlas-sheet-holding");
    current.panel.style.removeProperty("--atlas-sheet-drag-height");
    if (current.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
  }, []);
  const cancel = useCallback(() => finish(true), [finish]);

  useLayoutEffect(() => cancel, [cancel, options.enabled, options.countryId, options.state]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) { cancel(); return; }
    if (gesture.current) { cancel(); return; }
    suppressPointerClick.current = false;
    const current = latest.current;
    const panel = current.panelRef.current;
    if (!current.enabled || !current.countryId || !panel || panel.closest("[inert]") || document.visibilityState === "hidden") return;
    const handle = event.currentTarget;
    try { handle.setPointerCapture(event.pointerId); } catch { return; }
    const startHeight = panel.getBoundingClientRect().height;
    const heights = measureHeights(panel);
    if (!ATLAS_SHEET_STATES.every(state => Number.isFinite(heights[state]) && heights[state] > 0)) {
      handle.releasePointerCapture(event.pointerId);
      return;
    }
    // Grabbing an animating sheet holds its actual position, not its future snap.
    // Measurement and restoration finish synchronously before this held height.
    panel.style.setProperty("--atlas-sheet-drag-height", `${startHeight}px`);
    panel.setAttribute("data-atlas-sheet-holding", "true");
    panel.getBoundingClientRect();
    const cancelOtherPointer = (next: globalThis.PointerEvent) => {
      if (next.pointerId !== event.pointerId) cancel();
    };
    const cancelHidden = () => { if (document.visibilityState === "hidden") cancel(); };
    window.addEventListener("pointerdown", cancelOtherPointer, true);
    window.addEventListener("resize", cancel);
    window.addEventListener("orientationchange", cancel);
    window.visualViewport?.addEventListener("resize", cancel);
    document.addEventListener("visibilitychange", cancelHidden);
    gesture.current = {
      pointerId:event.pointerId, handle, panel, surface:panel.closest<HTMLElement>(".atlas-experience-surface"), state:current.state, heights,
      startX:event.clientX, startY:event.clientY, startHeight, y:event.clientY,
      time:event.timeStamp, velocityY:0, height:startHeight, dragging:false, frame:null,
      detach:() => {
        window.removeEventListener("pointerdown", cancelOtherPointer, true);
        window.removeEventListener("resize", cancel);
        window.removeEventListener("orientationchange", cancel);
        window.visualViewport?.removeEventListener("resize", cancel);
        document.removeEventListener("visibilitychange", cancelHidden);
      },
    };
  }, [cancel]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX, dy = event.clientY - current.startY;
    if (!current.dragging) {
      const intent = atlasSheetDragIntent(dx, dy);
      if (intent === "cancel") { cancel(); return; }
      if (intent === "pending") return;
      current.dragging = true;
    }
    event.preventDefault();
    current.velocityY = (event.clientY - current.y) / Math.max(8, event.timeStamp - current.time);
    current.y = event.clientY;
    current.time = event.timeStamp;
    current.height = clampAtlasSheetHeight(current.startHeight - dy, current.heights);
    if (current.frame !== null) return;
    current.frame = window.requestAnimationFrame(() => {
      current.frame = null;
      if (gesture.current !== current) return;
      current.panel.style.setProperty("--atlas-sheet-drag-height", `${current.height}px`);
      current.surface?.setAttribute("data-atlas-sheet-dragging", "true");
      current.panel.setAttribute("data-atlas-sheet-dragging", "true");
    });
  }, [cancel]);

  const onPointerUp = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.dragging) { finish(false); return; }
    event.preventDefault();
    const state = atlasSheetSnap({ state:current.state, heights:current.heights, height:current.height,
      deltaY:current.y-current.startY, velocityY:event.timeStamp-current.time > 100 ? 0 : current.velocityY });
    finish(true);
    if (latest.current.enabled && state !== latest.current.state) latest.current.onSnap(state);
  }, [finish]);

  const onPointerCancel = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (gesture.current?.pointerId === event.pointerId) cancel();
  }, [cancel]);
  const onClickCapture = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    // Keep keyboard activation (detail=0), suppress a drag's compatibility click.
    // A fresh pointerdown clears this guard; no delayed timer can eat a later tap.
    if (event.detail !== 0 && suppressPointerClick.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
    onLostPointerCapture:onPointerCancel, onClickCapture };
}
