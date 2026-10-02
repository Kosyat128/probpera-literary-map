import type { PreferenceStore } from "../platform/ports";

export const BOOKY_SIZE_PREFERENCE_KEY = "probpera-booky-size-v1";
export const BOOKY_COMPANION_SIZES = ["small", "normal", "large"] as const;
export type BookyCompanionSize = typeof BOOKY_COMPANION_SIZES[number];
export type BookySizeSnapshot = Readonly<{
  size: BookyCompanionSize;
  state: "loading" | "ready" | "saving" | "failed";
  error: "read" | "write" | null;
}>;
export interface BookySizeController {
  getSnapshot(): BookySizeSnapshot;
  getServerSnapshot(): BookySizeSnapshot;
  subscribe(listener: () => void): () => void;
  activate(): () => void;
  selectSize(size: BookyCompanionSize): boolean;
  retry(): boolean;
}
const initial: BookySizeSnapshot = Object.freeze({ size: "normal", state: "loading", error: null });
const disabled: BookySizeSnapshot = Object.freeze({ size: "normal", state: "ready", error: null });
const skipped = Symbol("inactive size preference operation");
// A started set is not cancellable. Remounted owners on this port wait for it.
const writes = new WeakMap<PreferenceStore, Promise<void>>();
function serializeWrite<T>(preferences: PreferenceStore, work: () => Promise<T>) {
  const result = (writes.get(preferences) ?? Promise.resolve()).then(work);
  const tail = result.then(() => undefined, () => undefined);
  writes.set(preferences, tail);
  void tail.then(() => { if (writes.get(preferences) === tail) writes.delete(preferences); });
  return result;
}
export function isBookyCompanionSize(value: unknown): value is BookyCompanionSize {
  return value === "small" || value === "normal" || value === "large";
}

/** No constructor IO or automatic default writes. Unknown bytes survive until
 * an explicit choice; an older read cannot undo that immediate local choice. */
export function createBookySizeController({ preferences, enabled, confirmationTimeoutMs = 5_000 }: {
  preferences: PreferenceStore;
  enabled: boolean;
  confirmationTimeoutMs?: number;
}): BookySizeController {
  if (!Number.isInteger(confirmationTimeoutMs) || confirmationTimeoutMs < 1 || confirmationTimeoutMs > 60_000) {
    throw new RangeError("Booky size confirmation timeout must be 1-60000 ms");
  }
  let snapshot = enabled ? initial : disabled;
  let active = false, lifetime = 0, operation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const current = (epoch: number, sequence: number) => active && lifetime === epoch && operation === sequence;
  function clearTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
  function publish(next: BookySizeSnapshot) {
    if (snapshot.size === next.size && snapshot.state === next.state && snapshot.error === next.error) return;
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) {
      if (!active) break;
      if (listeners.has(listener)) try { listener(); } catch { /* A view cannot undo the choice. */ }
    }
  }
  function start(kind: "read" | "write", size = snapshot.size) {
    const epoch = lifetime, sequence = ++operation;
    let settled = false;
    clearTimer();
    const finish = (next: BookySizeSnapshot) => {
      if (settled || !current(epoch, sequence)) return;
      settled = true; clearTimer(); publish(next);
    };
    const failure = () => finish({ size, state: "failed", error: kind });
    timer = setTimeout(failure, confirmationTimeoutMs);
    publish({ size, state: kind === "read" ? "loading" : "saving", error: null });
    const work = async (): Promise<string | null | boolean | typeof skipped> => {
      if (settled || !current(epoch, sequence)) return skipped;
      if (kind === "read") return preferences.get(BOOKY_SIZE_PREFERENCE_KEY);
      if (await preferences.set(BOOKY_SIZE_PREFERENCE_KEY, size) !== true) return false;
      if (settled || !current(epoch, sequence)) return skipped;
      return await preferences.get(BOOKY_SIZE_PREFERENCE_KEY) === size;
    };
    // Reads wait for already-started writes, but a hung read must not strand an
    // explicit choice or read retry. Read callbacks only publish their own epoch.
    const pending = kind === "write" ? serializeWrite(preferences, work)
      : (writes.get(preferences) ?? Promise.resolve()).then(work);
    void pending.then(value => {
      if (value === skipped || settled || !current(epoch, sequence)) return;
      if (kind === "read") {
        if (value === null || isBookyCompanionSize(value)) {
          finish({ size: value === null ? "normal" : value, state: "ready", error: null });
        } else failure();
      } else if (value === true) finish({ size, state: "ready", error: null });
      else failure();
    }, failure);
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    getServerSnapshot: () => enabled ? initial : disabled,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() {
      if (!enabled) return () => undefined;
      if (active) throw new Error("Booky size controller is already active");
      active = true; const epoch = ++lifetime;
      if (snapshot.state === "saving") start("write");
      else if (snapshot.state !== "failed") start("read");
      return () => {
        if (!active || lifetime !== epoch) return;
        active = false; ++lifetime; ++operation; clearTimer();
      };
    },
    selectSize(size: BookyCompanionSize) {
      if (!enabled || !active || !isBookyCompanionSize(size)
        || snapshot.size === size && snapshot.state === "ready") return false;
      start("write", size); return true;
    },
    retry() {
      if (!enabled || !active || snapshot.state !== "failed") return false;
      start(snapshot.error === "write" ? "write" : "read"); return true;
    },
  });
}
