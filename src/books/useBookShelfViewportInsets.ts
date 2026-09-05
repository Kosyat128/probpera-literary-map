import { useLayoutEffect, useState, type RefObject } from 'react';

import {
  EMPTY_BOOK_SHELF_INSETS,
  equalBookShelfViewportInsets,
  measureBookShelfViewportInsets,
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
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!active || !scene) {
      setInsets(previous => equalBookShelfViewportInsets(previous, EMPTY_BOOK_SHELF_INSETS) ? previous : EMPTY_BOOK_SHELF_INSETS);
      return;
    }
    const detail = detailRef.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      timer = undefined;
      if (!scene.isConnected) return;
      const rect = scene.getBoundingClientRect();
      const visual = window.visualViewport;
      const viewport = {
        left: visual?.offsetLeft || 0,
        top: visual?.offsetTop || 0,
        right: (visual?.offsetLeft || 0) + (visual?.width || window.innerWidth),
        bottom: (visual?.offsetTop || 0) + (visual?.height || window.innerHeight),
      };
      const overlays: { edge: keyof BookShelfViewportInsets; rect: BookShelfLayoutRect }[] = [];
      if (detail && detail.getClientRects().length) {
        const handle = detail.querySelector<HTMLElement>('.book-detail-mobile-handle');
        const mobile = handle && getComputedStyle(handle).display !== 'none';
        overlays.push({ edge: mobile ? 'bottom' : 'right', rect: detail.getBoundingClientRect() });
      }
      const next = measureBookShelfViewportInsets({ scene: rect, viewport, overlays });
      setInsets(previous => equalBookShelfViewportInsets(previous, next) ? previous : next);
    };
    // Coalesce transient layout changes; canvas animation never drives React state.
    const schedule = () => { timer ??= setTimeout(measure, 80); };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(scene);
    if (detail) observer?.observe(detail);
    const visibility = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(schedule, {
      threshold: Array.from({ length: 21 }, (_, index) => index / 20),
    });
    visibility?.observe(scene);
    detail?.addEventListener('transitionend', schedule);
    detail?.addEventListener('animationend', schedule);
    window.addEventListener('resize', schedule, { passive: true });
    // Only an active inspection observes scroll layout; unchanged rectangles do
    // not update React or wake the canvas. This is not a render-loop listener.
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('scrollend', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      observer?.disconnect();
      visibility?.disconnect();
      detail?.removeEventListener('transitionend', schedule);
      detail?.removeEventListener('animationend', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('scrollend', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [sceneRef, detailRef, active, layoutKey]);
  return insets;
}
