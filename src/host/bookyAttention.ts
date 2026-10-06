import { boundedBookyLook, type BookyLook } from "./bookyAnimation";
export type BookyAttentionKind = "pointer" | "press" | "focus";
type Point = Readonly<{ x: number; y: number }>;
type Rect = Readonly<{ left: number; top: number; width: number; height: number }>;
type View = Readonly<{ width: number; height: number }>;
export const BOOKY_ATTENTION_RETURN_MS = 2200;
const PRESS_HOLD_MS = 650;

/** Local visual intent only: no DOM, storage, content, identities or listeners. */
export function createBookyAttention() {
  let target: BookyLook | null = null, until = 0, heldUntil = 0;
  const clear = () => { target = null; until = heldUntil = 0; };
  return {
    clear,
    offer(kind: BookyAttentionKind, point: Point, avatar: Rect, view: View, now: number, calm: boolean): number | null {
      if ((kind !== "pointer" && kind !== "press" && kind !== "focus") || ![point.x, point.y, avatar.left, avatar.top, avatar.width, avatar.height, view.width, view.height, now].every(Number.isFinite)
        || avatar.width <= 0 || avatar.height <= 0 || view.width <= 0 || view.height <= 0 || now < 0) return null;
      if (kind === "pointer" && (calm || now < heldUntil)) return null;
      target = boundedBookyLook({ x: (point.x - avatar.left - avatar.width / 2) / Math.max(96, view.width * .32),
        y: (point.y - avatar.top - avatar.height / 2) / Math.max(96, view.height * .32) });
      until = now + BOOKY_ATTENTION_RETURN_MS;
      heldUntil = kind === "pointer" ? 0 : now + PRESS_HOLD_MS;
      return until;
    },
    read(now: number): BookyLook | null {
      if (!Number.isFinite(now) || now < 0 || now >= until) { clear(); return null; }
      return target;
    },
  };
}