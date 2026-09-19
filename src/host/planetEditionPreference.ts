import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  GLOBE_EDITION_BY_ID,
  isGlobeEditionId,
  parseStoredGlobeEdition,
  type GlobeEditionId,
} from "../planet/editions";
import type { PreferenceStore } from "../platform/ports";

export const PLANET_EDITION_PREFERENCE_KEY = "probpera.globe-edition.v2";
export const PLANET_EDITION_LEGACY_KEY = "probpera.globe-style.v1";
export const PLANET_EDITION_CONFIRMATION_TIMEOUT_MS = 5_000;
export type PlanetEditionSaveState = "idle" | "saving" | "failed";
export interface PlanetEditionPreferenceSnapshot {
  readonly restoredEditionId: GlobeEditionId | null;
  readonly saveState: PlanetEditionSaveState;
}
export interface PlanetEditionPreferenceController {
  getSnapshot(): PlanetEditionPreferenceSnapshot;
  getServerSnapshot(): PlanetEditionPreferenceSnapshot;
  subscribe(listener: () => void): () => void;
  activate(): () => void;
  /** Explicit intent fences restoration even if its texture subsequently fails. */
  requestEdition(editionId: GlobeEditionId): boolean;
  /** Called only for the style state machine's latest successful texture. */
  renderedEdition(editionId: GlobeEditionId): boolean;
  retrySave(): boolean;
}

const initialSnapshot: PlanetEditionPreferenceSnapshot = Object.freeze({
  restoredEditionId: null,
  saveState: "idle",
});
interface PreferenceQueue { tail: Promise<void>; revision: number; }
// A timeout limits confirmation, not the underlying native/storage mutation.
// Later writes and remount reads never overtake an already-started write.
const preferenceQueues = new WeakMap<PreferenceStore, PreferenceQueue>();
function queueFor(preferences: PreferenceStore) {
  let queue = preferenceQueues.get(preferences);
  if (!queue) {
    queue = { tail: Promise.resolve(), revision: 0 };
    preferenceQueues.set(preferences, queue);
  }
  return queue;
}
function availableEdition(value: unknown): value is GlobeEditionId {
  return isGlobeEditionId(value) && GLOBE_EDITION_BY_ID[value].visitorAvailable;
}

/** No constructor IO; this controller owns preferences, never the globe scene. */
export function createPlanetEditionPreferenceController({ preferences, enabled, readLegacyPreference }: {
  preferences: PreferenceStore;
  enabled: boolean;
  /** Native WebView migration only, after both platform keys are truly absent. */
  readLegacyPreference?: () => unknown;
}): PlanetEditionPreferenceController {
  let snapshot = initialSnapshot;
  let active = false;
  let lifetime = 0;
  let intent = 0;
  let saveRevision = 0;
  let hydrationFinished = false;
  let target: { id: GlobeEditionId; needsSave: boolean } | null = null;
  let lastRendered: GlobeEditionId | null = null;
  let readTimer: ReturnType<typeof setTimeout> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const current = (epoch: number) => active && lifetime === epoch;

  function publish(next: PlanetEditionPreferenceSnapshot) {
    if (snapshot.restoredEditionId === next.restoredEditionId && snapshot.saveState === next.saveState) return;
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) {
      if (!active) break;
      if (!listeners.has(listener)) continue;
      try { listener(); } catch { /* A view cannot undo the selected texture. */ }
    }
  }
  function clearReadTimer() {
    if (readTimer !== null) clearTimeout(readTimer);
    readTimer = null;
  }
  function clearSaveTimer() {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = null;
  }

  function hydrate(epoch: number) {
    if (hydrationFinished || intent !== 0) return;
    let expired = false;
    const ownsRead = () => current(epoch) && intent === 0 && !expired;
    readTimer = setTimeout(() => {
      if (!ownsRead()) return;
      expired = true;
      hydrationFinished = true;
      readTimer = null;
    }, PLANET_EDITION_CONFIRMATION_TIMEOUT_MS);
    const queue = queueFor(preferences);
    void (async () => {
      try {
        // Capture again if another mounted owner enqueued a write while waiting.
        let prior: Promise<void>;
        do {
          prior = queue.tail;
          await prior;
          if (!ownsRead()) return;
        } while (prior !== queue.tail);
        const revision = queue.revision;
        const stored = await preferences.get(PLANET_EDITION_PREFERENCE_KEY);
        if (!ownsRead() || revision !== queue.revision) return;
        const legacy = stored === null ? await preferences.get(PLANET_EDITION_LEGACY_KEY) : null;
        if (!ownsRead() || revision !== queue.revision) return;
        let value: unknown = stored ?? legacy;
        if (value === null && readLegacyPreference) {
          value = readLegacyPreference();
          if (!ownsRead() || revision !== queue.revision) return;
          if (!availableEdition(value) && value !== "antique" && value !== "modern" && value !== "earth") value = null;
        }
        hydrationFinished = true;
        clearReadTimer();
        if (value === null) return;
        const id = parseStoredGlobeEdition(value);
        target = { id, needsSave: stored !== id };
        publish({ ...snapshot, restoredEditionId: id });
      } catch {
        // Failed reads leave the canonical scene alone and never replace storage.
        if (ownsRead()) {
          hydrationFinished = true;
          clearReadTimer();
        }
      }
    })();
  }

  function save(editionId: GlobeEditionId) {
    const epoch = lifetime;
    const revision = ++saveRevision;
    clearSaveTimer();
    const ownsSave = () => current(epoch) && revision === saveRevision;
    const queue = queueFor(preferences);
    ++queue.revision;
    const result = queue.tail.then(async () => {
      if (!ownsSave()) return null;
      try { return await preferences.set(PLANET_EDITION_PREFERENCE_KEY, editionId) === true; }
      catch { return false; }
    });
    queue.tail = result.then(() => undefined, () => undefined);
    saveTimer = setTimeout(() => {
      if (!ownsSave()) return;
      saveTimer = null;
      publish({ ...snapshot, saveState: "failed" });
    }, PLANET_EDITION_CONFIRMATION_TIMEOUT_MS);
    // Establish ownership/queue before notifying reentrant observers.
    publish({ ...snapshot, restoredEditionId: null, saveState: "saving" });
    void result.then(saved => {
      if (!ownsSave() || saved === null) return;
      clearSaveTimer();
      // "idle" confirms port acceptance only, not durable storage on best-effort ports.
      publish({ ...snapshot, saveState: saved ? "idle" : "failed" });
    });
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
      if (active) throw new Error("Edition preference controller is already active");
      active = true;
      const epoch = ++lifetime;
      if (lastRendered && snapshot.saveState === "saving") save(lastRendered);
      else hydrate(epoch);
      return () => {
        if (!current(epoch)) return;
        active = false;
        ++lifetime;
        clearReadTimer();
        clearSaveTimer();
      };
    },
    requestEdition(editionId: GlobeEditionId) {
      if (!active || !availableEdition(editionId)) return false;
      ++intent;
      hydrationFinished = true;
      clearReadTimer();
      target = { id: editionId, needsSave: true };
      publish({ ...snapshot, restoredEditionId: null });
      return true;
    },
    renderedEdition(editionId: GlobeEditionId) {
      if (!active || !target || target.id !== editionId || !availableEdition(editionId)) return false;
      const needsSave = target.needsSave;
      target = null;
      lastRendered = editionId;
      if (needsSave) save(editionId);
      else publish({ ...snapshot, restoredEditionId: null });
      return true;
    },
    retrySave() {
      if (!active || !lastRendered || snapshot.saveState !== "failed") return false;
      save(lastRendered);
      return true;
    },
  });
}

export function usePlanetEditionPreference(options: {
  preferences: PreferenceStore;
  enabled: boolean;
  readLegacyPreference?: () => unknown;
}) {
  const { preferences, enabled, readLegacyPreference } = options;
  const controller = useMemo(
    () => createPlanetEditionPreferenceController({ preferences, enabled, readLegacyPreference }),
    [preferences, enabled, readLegacyPreference]
  );
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  useEffect(() => controller.activate(), [controller]);
  return { ...snapshot, requestEdition: controller.requestEdition, renderedEdition: controller.renderedEdition, retrySave: controller.retrySave };
}
