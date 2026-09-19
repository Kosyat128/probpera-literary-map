import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { PreferenceStore } from "../platform/ports";
import {
  DEFAULT_GLOBE_STAND_ID, GLOBE_STAND_PREFERENCE_KEY, isGlobeStandId,
  type GlobeStandId,
} from "../planet/globeStands";

export const PLANET_STAND_CONFIRMATION_TIMEOUT_MS = 5_000;
export const PLANET_STAND_PREVIEW_TIMEOUT_MS = 5_000;
export type PlanetStandCustomizationSnapshot = Readonly<{
  appliedId: GlobeStandId;
  displayedId: GlobeStandId;
  previewId: GlobeStandId | null;
  isOpen: boolean;
  phase: "idle" | "preparing" | "preview" | "error";
  renderRevision: number;
  saveState: "idle" | "saving" | "failed";
  reason: "render-failed" | "preview-timeout" | null;
}>;
export interface PlanetStandCustomizationController {
  getSnapshot(): PlanetStandCustomizationSnapshot;
  getServerSnapshot(): PlanetStandCustomizationSnapshot;
  subscribe(listener: () => void): () => void;
  activate(): () => void;
  setVisibility(visible: boolean): void;
  open(): boolean;
  preview(id: GlobeStandId): boolean;
  acknowledgeRendered(revision: number, id: GlobeStandId): boolean;
  failRendering(revision: number, id: GlobeStandId): boolean;
  apply(): boolean;
  cancel(): void;
  retrySave(): boolean;
}
export type PlanetStandCustomizationOptions = Readonly<{
  preferences: PreferenceStore;
  enabled: boolean;
  access: "adult" | "blocked";
}>;

const initialSnapshot: PlanetStandCustomizationSnapshot = Object.freeze({
  appliedId: DEFAULT_GLOBE_STAND_ID, displayedId: DEFAULT_GLOBE_STAND_ID,
  previewId: null, isOpen: false, phase: "idle", renderRevision: 0,
  saveState: "idle", reason: null,
});
interface PreferenceQueue { tail: Promise<void>; revision: number; }
const queues = new WeakMap<PreferenceStore, PreferenceQueue>();
function queueFor(preferences: PreferenceStore) {
  let queue = queues.get(preferences);
  if (!queue) { queue = { tail: Promise.resolve(), revision: 0 }; queues.set(preferences, queue); }
  return queue;
}

/** No constructor IO, entitlement grants or scene ownership. */
export function createPlanetStandCustomizationController({ preferences, enabled, access }: PlanetStandCustomizationOptions): PlanetStandCustomizationController {
  let snapshot = initialSnapshot;
  let active = false;
  let visible = true;
  let lifetime = 0;
  let readRevision = 0;
  let intent = 0;
  let saveRevision = 0;
  let hydrationFinished = false;
  let restoring = false;
  let readTimer: ReturnType<typeof setTimeout> | null = null;
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const current = (epoch: number) => active && lifetime === epoch;
  const clearRead = () => { if (readTimer !== null) clearTimeout(readTimer); readTimer = null; };
  const clearPreview = () => { if (previewTimer !== null) clearTimeout(previewTimer); previewTimer = null; };
  const clearSave = () => { if (saveTimer !== null) clearTimeout(saveTimer); saveTimer = null; };
  function publish(next: PlanetStandCustomizationSnapshot) {
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) {
      if (!active) break;
      if (!listeners.has(listener)) continue;
      try { listener(); } catch { /* The view cannot change transaction ownership. */ }
    }
  }
  function dropDraft(reason: PlanetStandCustomizationSnapshot["reason"], close: boolean) {
    clearPreview();
    restoring = false;
    publish({ ...snapshot, displayedId: snapshot.appliedId, previewId: null,
      isOpen: close ? false : snapshot.isOpen, phase: reason ? "error" : "idle",
      reason, renderRevision: snapshot.renderRevision + 1 });
  }
  function awaitFrame(next: PlanetStandCustomizationSnapshot) {
    clearPreview();
    const epoch = lifetime;
    const revision = next.renderRevision;
    previewTimer = setTimeout(() => {
      if (!current(epoch) || !visible || snapshot.renderRevision !== revision || snapshot.phase !== "preparing") return;
      previewTimer = null;
      dropDraft("preview-timeout", false);
    }, PLANET_STAND_PREVIEW_TIMEOUT_MS);
    publish(next);
  }
  function hydrate(epoch: number) {
    if (!visible || hydrationFinished || intent !== 0) return;
    const read = ++readRevision;
    let expired = false;
    const ownsRead = () => current(epoch) && visible && readRevision === read && intent === 0 && !expired;
    readTimer = setTimeout(() => {
      if (!ownsRead()) return;
      expired = true;
      hydrationFinished = true;
      readTimer = null;
    }, PLANET_STAND_CONFIRMATION_TIMEOUT_MS);
    const queue = queueFor(preferences);
    void (async () => {
      try {
        let prior: Promise<void>;
        do {
          prior = queue.tail;
          await prior;
          if (!ownsRead()) return;
        } while (prior !== queue.tail);
        const revision = queue.revision;
        const value = await preferences.get(GLOBE_STAND_PREFERENCE_KEY);
        if (!ownsRead() || revision !== queue.revision) return;
        hydrationFinished = true;
        clearRead();
        if (!isGlobeStandId(value) || value === DEFAULT_GLOBE_STAND_ID) return;
        restoring = true;
        awaitFrame({ ...snapshot, displayedId: value, phase: "preparing", reason: null,
          renderRevision: snapshot.renderRevision + 1 });
      } catch {
        if (ownsRead()) { hydrationFinished = true; clearRead(); }
      }
    })();
  }
  function save(id: GlobeStandId, next = snapshot) {
    clearSave();
    const epoch = lifetime;
    const revision = ++saveRevision;
    const ownsSave = () => current(epoch) && revision === saveRevision;
    const queue = queueFor(preferences);
    ++queue.revision;
    const result = queue.tail.then(async () => {
      if (!ownsSave()) return null;
      try { return await preferences.set(GLOBE_STAND_PREFERENCE_KEY, id) === true; }
      catch { return false; }
    });
    // Never release this queue on timeout: native writes may still complete.
    queue.tail = result.then(() => undefined, () => undefined);
    saveTimer = setTimeout(() => {
      if (!ownsSave()) return;
      saveTimer = null;
      publish({ ...snapshot, saveState: "failed" });
    }, PLANET_STAND_CONFIRMATION_TIMEOUT_MS);
    publish({ ...next, saveState: "saving" });
    void result.then(saved => {
      if (!ownsSave() || saved === null) return;
      clearSave();
      publish({ ...snapshot, saveState: saved ? "idle" : "failed" });
    });
  }
  function fenceRestoration() {
    ++intent;
    hydrationFinished = true;
    clearRead();
  }
  function cancel() {
    if (!active) return;
    fenceRestoration();
    dropDraft(null, true);
  }

  return Object.freeze({
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() {
      if (!enabled || access !== "adult") return () => undefined;
      if (active) throw new Error("Stand customization controller is already active");
      active = true;
      const epoch = ++lifetime;
      if (snapshot.saveState === "saving") save(snapshot.appliedId);
      else hydrate(epoch);
      return () => {
        if (!current(epoch)) return;
        active = false;
        ++lifetime;
        clearRead(); clearPreview(); clearSave();
        if (restoring && intent === 0) hydrationFinished = false;
        restoring = false;
        snapshot = Object.freeze({ ...snapshot, displayedId: snapshot.appliedId,
          previewId: null, isOpen: false, phase: "idle", reason: null,
          renderRevision: snapshot.renderRevision + 1 });
      };
    },
    setVisibility(isVisible: boolean) {
      const next = isVisible === true;
      if (visible === next) return;
      visible = next;
      if (!next) {
        const pendingRead = readTimer !== null;
        const pendingRestore = restoring;
        ++readRevision;
        clearRead();
        if (!active) return;
        if (snapshot.isOpen || snapshot.previewId !== null) {
          cancel();
        } else if (pendingRead || pendingRestore) {
          // Hidden views cannot acknowledge a frame. Pause restoration without
          // pretending that backgrounding was a new explicit stand choice.
          hydrationFinished = false;
          clearPreview();
          if (pendingRestore) dropDraft(null, true);
        }
      } else if (active) {
        hydrate(lifetime);
      }
    },
    open() {
      if (!active || !visible) return false;
      if (snapshot.isOpen) return true;
      fenceRestoration();
      clearPreview();
      restoring = false;
      publish({ ...snapshot, displayedId: snapshot.appliedId, isOpen: true,
        previewId: null, phase: "idle", reason: null, renderRevision: snapshot.renderRevision + 1 });
      return true;
    },
    preview(id: GlobeStandId) {
      if (!active || !visible || !snapshot.isOpen || !isGlobeStandId(id)) return false;
      fenceRestoration();
      restoring = false;
      awaitFrame({ ...snapshot, displayedId: id, previewId: id,
        phase: "preparing", reason: null, renderRevision: snapshot.renderRevision + 1 });
      return true;
    },
    acknowledgeRendered(revision: number, id: GlobeStandId) {
      if (!active || !visible || snapshot.renderRevision !== revision || snapshot.displayedId !== id || snapshot.phase !== "preparing") return false;
      clearPreview();
      if (restoring) {
        restoring = false;
        publish({ ...snapshot, appliedId: id, phase: "idle", reason: null });
      } else {
        if (!snapshot.isOpen || snapshot.previewId !== id) return false;
        publish({ ...snapshot, phase: "preview", reason: null });
      }
      return true;
    },
    failRendering(revision: number, id: GlobeStandId) {
      if (!active || !visible || snapshot.renderRevision !== revision || snapshot.displayedId !== id
        || (snapshot.phase !== "preparing" && snapshot.phase !== "preview")) return false;
      dropDraft("render-failed", false);
      return true;
    },
    apply() {
      if (!active || !visible || !snapshot.isOpen || snapshot.phase !== "preview" || snapshot.previewId === null) return false;
      fenceRestoration();
      clearPreview();
      const id = snapshot.previewId;
      save(id, { ...snapshot, appliedId: id, previewId: null, phase: "idle", reason: null });
      return true;
    },
    cancel,
    retrySave() {
      if (!active || snapshot.saveState !== "failed") return false;
      save(snapshot.appliedId);
      return true;
    },
  });
}

export function usePlanetStandCustomization(options: PlanetStandCustomizationOptions) {
  const { preferences, enabled, access } = options;
  const controller = useMemo(() => createPlanetStandCustomizationController({ preferences, enabled, access }), [preferences, enabled, access]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  useEffect(() => controller.activate(), [controller]);
  return { controller, snapshot };
}
