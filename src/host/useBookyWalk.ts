import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BOOKY_WALK_MS } from "./bookyAnimation";
import { isBookyWalkPathClear, planBookyWalk, sampleBookyWalk, type BookyWalkBounds, type BookyWalkPoint, type BookyWalkPath } from "./bookyWalk";

export function useBookyWalk(options: {
  available: boolean; revision: number; position: BookyWalkPoint;
  committedPosition?: BookyWalkPoint;
  size: Readonly<{ width: number; height: number }>; viewport: BookyWalkBounds;
  controls?: readonly BookyWalkBounds[];
  onFinish: (point: BookyWalkPoint) => void;
}) {
  const latest = useRef(options); latest.current = options;
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [walk, setWalk] = useState<{ position: BookyWalkPoint; active: boolean; previous: BookyWalkPoint } | null>(null);
  const [direction, setDirection] = useState<-1 | 1>(-1);
  const point = useRef<BookyWalkPoint | null>(null), frame = useRef(0), sequence = useRef(0);
  const handoff = useRef<BookyWalkPoint | null>(null);
  const stop = useCallback(() => {
    sequence.current++;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    const final = point.current; point.current = null;
    if (final) {
      // Keep the final local point until the parent accepts the position. A
      // concurrent parent render can finish after the local stop render.
      const previous = latest.current.committedPosition ?? latest.current.position;
      handoff.current = final;
      setWalk({ position: final, active: false, previous });
      latest.current.onFinish(final);
    }
  }, []);
  const start = useCallback((planned?: BookyWalkPath, onArrive?: () => void, duration = BOOKY_WALK_MS,
    targetIsCurrent?: () => boolean) => {
    const current = latest.current;
    if (point.current || !current.available || document.hidden
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const path = planned ?? planBookyWalk(handoff.current ?? current.position, current.size, current.viewport, current.controls);
    if (!path) return false;
    const owner = ++sequence.current, began = performance.now();
    point.current = path.from; setWalk({ position: path.from, active: true, previous: current.position }); setDirection(path.direction);
    const draw = (time: number) => {
      frame.current = 0;
      if (owner !== sequence.current) return;
      const live = latest.current;
      const boundsChanged = (["width", "height"] as const).some(key => Math.abs(live.size[key] - current.size[key]) > .5)
        || (["left", "top", "width", "height"] as const).some(key => Math.abs(live.viewport[key] - current.viewport[key]) > .5);
      // A persistence notice or host toolbar can resize through ResizeObserver
      // without a window resize. Retire the old path before another moving frame.
      const stale = targetIsCurrent ? !targetIsCurrent() : live.revision !== current.revision;
      if (!live.available || stale || boundsChanged || document.hidden
        || !planned && !isBookyWalkPathClear(path, live.size, live.viewport, live.controls)) { stop(); return; }
      const progress = Math.min(1, Math.max(0, (time - began) / duration));
      point.current = sampleBookyWalk(path, progress);
      setWalk({ position: point.current, active: true, previous: current.position });
      if (progress === 1) { stop(); onArrive?.(); } else frame.current = requestAnimationFrame(draw);
    };
    frame.current = requestAnimationFrame(draw);
    return true;
  }, [stop]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => { setReducedMotion(media.matches); if (media.matches) stop(); };
    const hidden = () => { if (document.hidden) stop(); };
    const interrupt = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-booky-walk], [data-booky-walk-stop]')) stop();
    };
    media.addEventListener("change", motion); document.addEventListener("visibilitychange", hidden);
    document.addEventListener("pointerdown", interrupt, true); document.addEventListener("keydown", interrupt, true);
    window.addEventListener("resize", stop); window.visualViewport?.addEventListener("resize", stop);
    window.visualViewport?.addEventListener("scroll", stop);
    return () => {
      sequence.current++; if (frame.current) cancelAnimationFrame(frame.current); frame.current = 0; point.current = null; handoff.current = null;
      media.removeEventListener("change", motion); document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("pointerdown", interrupt, true); document.removeEventListener("keydown", interrupt, true);
      window.removeEventListener("resize", stop); window.visualViewport?.removeEventListener("resize", stop);
      window.visualViewport?.removeEventListener("scroll", stop);
    };
  }, [stop]);
  useEffect(() => { if (!options.available) stop(); }, [options.available, options.revision, stop]);
  const canStart = options.available && !reducedMotion
    && planBookyWalk(options.position, options.size, options.viewport, options.controls) !== null;
  const active = walk?.active === true;
  // A collision-free display position can stay unchanged after the parent has
  // accepted a different point. Acknowledge the committed coordinates, not
  // their many-to-one visual projection, before releasing the local handoff.
  const committed = options.committedPosition ?? options.position;
  const parentPending = walk && committed.left === walk.previous.left && committed.top === walk.previous.top;
  const position = walk && (active || parentPending) ? walk.position : null;
  useLayoutEffect(() => {
    if (walk && !walk.active && (!parentPending
      || (committed.left === walk.position.left && committed.top === walk.position.top))) {
      handoff.current = null; setWalk(null);
    }
  }, [walk, parentPending, committed.left, committed.top]);
  return { active, position, direction, reducedMotion, canStart, start, stop };
}
