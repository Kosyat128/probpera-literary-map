import type { PreferenceStore } from "../platform/ports";

export const BOOKY_MOTION_PREFERENCE_KEY = "probpera-booky-motion-v1";
export type BookyMotionMode = "system" | "calm";
export type BookyMotionSnapshot = Readonly<{
  mode: BookyMotionMode;
  state: "loading" | "ready" | "saving" | "failed";
  hydrated: boolean;
  error: "read" | "write" | null;
}>;
export interface BookyMotionController {
  getSnapshot(): BookyMotionSnapshot;
  getServerSnapshot(): BookyMotionSnapshot;
  subscribe(listener: () => void): () => void;
  activate(): () => void;
  selectMode(mode: BookyMotionMode): boolean;
  retry(): boolean;
  recoverWithCalm(): boolean;
}

const initial: BookyMotionSnapshot = Object.freeze({ mode: "system", state: "loading", hydrated: false, error: null });
const disabled: BookyMotionSnapshot = Object.freeze({ mode: "system", state: "ready", hydrated: true, error: null });
const skipped = Symbol("inactive motion preference operation");
// An already-started write is not cancellable. A remounted owner sharing this
// port must read after it, rather than restore an older value and race its save.
const tails = new WeakMap<PreferenceStore, Promise<void>>();
function serialize<T>(preferences: PreferenceStore, work: () => Promise<T>) {
  const result = (tails.get(preferences) ?? Promise.resolve()).then(work);
  const tail = result.then(() => undefined, () => undefined);
  tails.set(preferences, tail);
  void tail.then(() => { if (tails.get(preferences) === tail) tails.delete(preferences); });
  return result;
}
export function isBookyMotionMode(value: unknown): value is BookyMotionMode {
  return value === "system" || value === "calm";
}

/** No constructor IO or automatic default writes. Until an authoritative read
 * succeeds, callers use !snapshot.hydrated || snapshot.mode === "calm". */
export function createBookyMotionController({ preferences, enabled, confirmationTimeoutMs = 5_000 }: {
  preferences: PreferenceStore;
  enabled: boolean;
  confirmationTimeoutMs?: number;
}): BookyMotionController {
  if (!Number.isInteger(confirmationTimeoutMs) || confirmationTimeoutMs < 1 || confirmationTimeoutMs > 60_000) {
    throw new RangeError("Booky motion confirmation timeout must be 1-60000 ms");
  }
  let snapshot = enabled ? initial : disabled;
  let active = false, lifetime = 0, operation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const current = (epoch: number, sequence: number) => active && lifetime === epoch && operation === sequence;
  function clearTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
  function publish(next: BookyMotionSnapshot) {
    if (snapshot.mode === next.mode && snapshot.state === next.state
      && snapshot.hydrated === next.hydrated && snapshot.error === next.error) return;
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) {
      if (!active) break;
      if (listeners.has(listener)) try { listener(); } catch { /* A view cannot undo the current choice. */ }
    }
  }
  function start(kind: "read" | "write", mode = snapshot.mode) {
    const epoch = lifetime, sequence = ++operation;
    let settled = false;
    clearTimer();
    const finish = (next: BookyMotionSnapshot) => {
      if (settled || !current(epoch, sequence)) return;
      settled = true; clearTimer(); publish(next);
    };
    const failure = () => finish({ mode, hydrated: kind === "write", state: "failed", error: kind });
    timer = setTimeout(failure, confirmationTimeoutMs);
    publish({ mode, hydrated: kind === "write", state: kind === "read" ? "loading" : "saving", error: null });
    void serialize<string | null | boolean | typeof skipped>(preferences, async () => {
      if (settled || !current(epoch, sequence)) return skipped;
      if (kind === "read") return preferences.get(BOOKY_MOTION_PREFERENCE_KEY);
      if (await preferences.set(BOOKY_MOTION_PREFERENCE_KEY, mode) !== true) return false;
      // Readback belongs to the same serialized operation. A port's successful
      // return alone cannot confirm storage, and an old lifetime cannot hydrate.
      if (settled || !current(epoch, sequence)) return skipped;
      return await preferences.get(BOOKY_MOTION_PREFERENCE_KEY) === mode;
    }).then(value => {
      if (value === skipped || settled || !current(epoch, sequence)) return;
      if (kind === "read") {
        if (value === null || isBookyMotionMode(value)) {
          finish({ mode: value === null ? "system" : value, state: "ready", hydrated: true, error: null });
        } else failure();
      } else if (value === true) finish({ mode, state: "ready", hydrated: true, error: null });
      else failure();
    }, failure);
  }
  function selectMode(mode: BookyMotionMode) {
    if (!enabled || !active || !snapshot.hydrated || !isBookyMotionMode(mode)) return false;
    start("write", mode); return true;
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    getServerSnapshot: () => enabled ? initial : disabled,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() {
      if (!enabled) return () => undefined;
      if (active) throw new Error("Booky motion controller is already active");
      active = true; const epoch = ++lifetime;
      if (!snapshot.hydrated && snapshot.state !== "failed") start("read");
      else if (snapshot.state === "saving") start("write");
      return () => {
        if (!active || lifetime !== epoch) return;
        active = false; ++lifetime; ++operation; clearTimer();
      };
    },
    selectMode,
    retry() {
      if (!enabled || !active || snapshot.state !== "failed") return false;
      start(snapshot.hydrated ? "write" : "read"); return true;
    },
    recoverWithCalm() {
      // Only an explicit recovery confirmation may replace an unreadable value.
      // Ordinary hydration/retry never writes, including unknown future strings.
      if (!enabled || !active || snapshot.hydrated || snapshot.state !== "failed" || snapshot.error !== "read") return false;
      start("write", "calm"); return true;
    },
  });
}
