import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { GlobeQualityTier } from "../components/globeQuality";
import type { PreferenceStore } from "../platform/ports";

export const PLANET_GRAPHICS_QUALITY_KEY = "probpera-planet-graphics-quality-v1";
export const PLANET_GRAPHICS_CONFIRMATION_TIMEOUT_MS = 5_000;
export const PLANET_GRAPHICS_QUALITY_TIERS = ["high", "balanced", "economy"] as const;
export type PlanetGraphicsSaveState = "idle" | "saving" | "failed";
export interface PlanetGraphicsQualitySnapshot {
  readonly qualityTier: GlobeQualityTier;
  readonly saveState: PlanetGraphicsSaveState;
}
export interface PlanetGraphicsQualityController {
  getSnapshot(): PlanetGraphicsQualitySnapshot;
  getServerSnapshot(): PlanetGraphicsQualitySnapshot;
  subscribe(listener: () => void): () => void;
  activate(): () => void;
  selectQuality(tier: GlobeQualityTier): boolean;
}

const initialSnapshot: PlanetGraphicsQualitySnapshot = Object.freeze({
  qualityTier: "high",
  saveState: "idle",
});
const skipped = Symbol("inactive graphics preference operation");
// Operation ordering only, never a second owner of quality. A new mount sharing
// the same port waits for any already-started old write before reading/saving.
const preferenceTails = new WeakMap<PreferenceStore, Promise<void>>();

function serializePreference<T>(preferences: PreferenceStore, work: () => T | Promise<T>) {
  const result = (preferenceTails.get(preferences) ?? Promise.resolve()).then(work);
  const tail = result.then(() => undefined, () => undefined);
  preferenceTails.set(preferences, tail);
  void tail.then(() => {
    if (preferenceTails.get(preferences) === tail) preferenceTails.delete(preferences);
  });
  return result;
}

function isQualityTier(value: unknown): value is GlobeQualityTier {
  return value === "high" || value === "balanced" || value === "economy";
}

/** Creates no IO. Each active app owns one value; locale and route are not keys. */
export function createPlanetGraphicsQualityController({
  preferences,
  enabled,
}: {
  preferences: PreferenceStore;
  enabled: boolean;
}): PlanetGraphicsQualityController {
  let snapshot = initialSnapshot;
  let active = false;
  let lifetime = 0;
  let intent = 0;
  let confirmationTimer: ReturnType<typeof setTimeout> | null = null;
  let hydration: Promise<string | null | typeof skipped> | null = null;
  const listeners = new Set<() => void>();
  const current = (epoch: number) => active && lifetime === epoch;

  function clearConfirmationTimer() {
    if (confirmationTimer !== null) clearTimeout(confirmationTimer);
    confirmationTimer = null;
  }

  function publish(next: PlanetGraphicsQualitySnapshot) {
    if (snapshot.qualityTier === next.qualityTier && snapshot.saveState === next.saveState) return;
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) {
      if (!active) break;
      if (!listeners.has(listener)) continue;
      try { listener(); } catch { /* A view subscriber cannot undo the selected value. */ }
    }
  }

  function hydrate(epoch: number) {
    if (!current(epoch) || intent !== 0) return;
    if (!hydration) {
      hydration = serializePreference<string | null | typeof skipped>(preferences, async () => {
        if (!current(epoch) || intent !== 0) return skipped;
        try { return await preferences.get(PLANET_GRAPHICS_QUALITY_KEY); }
        catch { return null; }
      });
    }
    const pending = hydration;
    void pending.then(value => {
      if (value === skipped && hydration === pending) hydration = null;
      if (!current(epoch) || intent !== 0) return;
      // StrictMode may end an activation before its queued read starts. Retry
      // only that skipped read, without reading a completed preference twice.
      if (value === skipped) { hydrate(epoch); return; }
      if (isQualityTier(value)) publish({ qualityTier: value, saveState: "idle" });
    });
  }

  function selectQuality(tier: GlobeQualityTier): boolean {
    if (!enabled || !active || !isQualityTier(tier)) return false;
    const revision = ++intent;
    const epoch = lifetime;
    clearConfirmationTimer();
    const timer = setTimeout(() => {
      if (confirmationTimer === timer) confirmationTimer = null;
      if (current(epoch) && revision === intent) {
        publish({ qualityTier: tier, saveState: "failed" });
      }
    }, PLANET_GRAPHICS_CONFIRMATION_TIMEOUT_MS);
    confirmationTimer = timer;
    publish({ qualityTier: tier, saveState: "saving" });
    void serializePreference<boolean | typeof skipped>(preferences, async () => {
      if (!current(epoch) || revision !== intent) return skipped;
      try { return await preferences.set(PLANET_GRAPHICS_QUALITY_KEY, tier) === true; }
      catch { return false; }
    }).then(saved => {
      if (!current(epoch) || revision !== intent || saved === skipped) return;
      clearConfirmationTimer();
      // Acceptance by a best-effort port can be memory-only. "idle" deliberately
      // does not promise durable storage; a failed write never rolls back quality.
      publish({ qualityTier: tier, saveState: saved ? "idle" : "failed" });
    });
    return true;
  }

  return Object.freeze({
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    activate() {
      if (!enabled) return () => undefined;
      if (active) throw new Error("Graphics quality controller is already active");
      active = true;
      const epoch = ++lifetime;
      if (intent !== 0 && snapshot.saveState === "saving") selectQuality(snapshot.qualityTier);
      else hydrate(epoch);
      return () => {
        if (!current(epoch)) return;
        active = false;
        ++lifetime;
        clearConfirmationTimer();
        // Already-started port writes cannot be cancelled or undone. The shared
        // queue prevents a later mount from overtaking them; queued work is skipped.
      };
    },
    selectQuality,
  });
}

export function usePlanetGraphicsQuality({
  preferences,
  enabled,
}: {
  preferences: PreferenceStore;
  enabled: boolean;
}) {
  const controller = useMemo(
    () => createPlanetGraphicsQualityController({ preferences, enabled }),
    [preferences, enabled]
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot
  );
  useEffect(() => controller.activate(), [controller]);
  return { ...snapshot, selectQuality: controller.selectQuality };
}
