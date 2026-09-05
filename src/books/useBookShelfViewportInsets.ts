import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

import {
  EMPTY_BOOK_SHELF_INSETS,
  equalBookShelfViewportInsets,
  measureBookShelfViewportInsets,
  shouldRestoreBookShelfAfterOrientation,
  type BookShelfLayoutRect,
  type BookShelfViewportInsets,
} from './bookShelfViewportInsets';

export function useBookShelfViewportInsets({
  sceneRef, detailRef, active, layoutKey,
}: Readonly<{
  sceneRef: RefObject<HTMLElement | null>;
  detailRef: RefObject<HTMLElement | null>;
  active: boolean;
  layoutKey: string;
}>): BookShelfViewportInsets {
  const [insets, setInsets] = useState(EMPTY_BOOK_SHELF_INSETS);
  const lastViewport = useRef<{ width: number; height: number; visible: boolean } | null>(null);
  const restoreAfterOrientation = useRef(false);
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!active || !scene) {
      lastViewport.current = null;
      restoreAfterOrientation.current = false;
      setInsets(previous => equalBookShelfViewportInsets(previous, EMPTY_BOOK_SHELF_INSETS) ? previous : EMPTY_BOOK_SHELF_INSETS);
      return;
    }
    const detail = detailRef.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const topBars = [...document.querySelectorAll<HTMLElement>('.site-header, .mobile-nav, .topline')];
    const detectOrientation = () => {
      const next = { width: window.innerWidth, height: window.innerHeight };
      const previous = lastViewport.current;
      const editing = Boolean(document.activeElement?.matches('input, textarea, [contenteditable="true"]'));
      if (previous && shouldRestoreBookShelfAfterOrientation(previous, next, editing)) restoreAfterOrientation.current = true;
      lastViewport.current = { ...next, visible: previous?.visible || false };
    };
    const measure = () => {
      timer = undefined;
      if (!scene.isConnected) return;
      detectOrientation();
      let rect = scene.getBoundingClientRect();
      const visual = window.visualViewport;
      const viewport = {
        left: visual?.offsetLeft || 0,
        top: visual?.offsetTop || 0,
        right: (visual?.offsetLeft || 0) + (visual?.width || window.innerWidth),
        bottom: (visual?.offsetTop || 0) + (visual?.height || window.innerHeight),
      };
      const overlays: { edge: keyof BookShelfViewportInsets; rect: BookShelfLayoutRect }[] = [];
      for (const bar of topBars) {
        const style = getComputedStyle(bar);
        if (!bar.getClientRects().length || style.visibility === 'hidden' || !['sticky', 'fixed'].includes(style.position)) continue;
        const bounds = bar.getBoundingClientRect();
        if (bounds.bottom > viewport.top && bounds.top < viewport.bottom) overlays.push({ edge: 'top', rect: bounds });
      }
      if (restoreAfterOrientation.current) {
        restoreAfterOrientation.current = false;
        const top = Math.max(viewport.top, ...overlays.map(overlay => overlay.rect.bottom)) + 8;
        const availableHeight = Math.max(0, viewport.bottom - top);
        if (availableHeight >= 64) {
          const targetTop = top + Math.max(0, (availableHeight - rect.height) / 2);
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - targetTop), behavior: 'instant' });
          rect = scene.getBoundingClientRect();
        }
      }
      if (detail && detail.getClientRects().length) {
        const handle = detail.querySelector<HTMLElement>('.book-detail-mobile-handle');
        const mobile = handle && getComputedStyle(handle).display !== 'none';
        overlays.push({ edge: mobile ? 'bottom' : 'right', rect: detail.getBoundingClientRect() });
      }
      const next = measureBookShelfViewportInsets({ scene: rect, viewport, overlays });
      lastViewport.current = {
        width: window.innerWidth, height: window.innerHeight,
        visible: rect.width - next.left - next.right >= 64 && rect.height - next.top - next.bottom >= 64,
      };
      setInsets(previous => equalBookShelfViewportInsets(previous, next) ? previous : next);
    };
    // Coalesce transient layout changes; canvas animation never drives React state.
    const schedule = () => { timer ??= setTimeout(measure, 80); };
    const resize = () => { detectOrientation(); schedule(); };
    const cancelRestore = () => { restoreAfterOrientation.current = false; };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(scene);
    if (detail) observer?.observe(detail);
    topBars.forEach(bar => observer?.observe(bar));
    const visibility = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(schedule, {
      threshold: Array.from({ length: 21 }, (_, index) => index / 20),
    });
    visibility?.observe(scene);
    detail?.addEventListener('transitionend', schedule);
    detail?.addEventListener('animationend', schedule);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointerdown', cancelRestore, { passive: true });
    window.addEventListener('wheel', cancelRestore, { passive: true });
    window.addEventListener('keydown', cancelRestore);
    // Only an active inspection observes scroll layout; unchanged rectangles do
    // not update React or wake the canvas. This is not a render-loop listener.
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('scrollend', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', resize, { passive: true });
    window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      observer?.disconnect();
      visibility?.disconnect();
      detail?.removeEventListener('transitionend', schedule);
      detail?.removeEventListener('animationend', schedule);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', cancelRestore);
      window.removeEventListener('wheel', cancelRestore);
      window.removeEventListener('keydown', cancelRestore);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('scrollend', schedule);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [sceneRef, detailRef, active, layoutKey]);
  return insets;
}
