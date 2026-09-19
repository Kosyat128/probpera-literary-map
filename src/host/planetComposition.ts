import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { PreferenceStore } from "../platform/ports";
import { parseStoredGlobeEdition, type GlobeEditionId } from "../planet/editions";
import { GLOBE_STAND_PREFERENCE_KEY, isGlobeStandId } from "../planet/globeStands";
import { GLOBE_BACKGROUND_PREFERENCE_KEY, isGlobeBackgroundId } from "../planet/globeBackgrounds";
import {
  copyGlobeCompositionSelection, DEFAULT_GLOBE_COMPOSITION_SELECTION, GLOBE_COMPOSITION_PREFERENCE_KEY,
  parseGlobeComposition, sameGlobeComposition, serializeGlobeComposition, validateGlobeCompositionSelection,
  type GlobeCompositionEnvironment, type GlobeCompositionPart, type GlobeCompositionSelection,
} from "../planet/globeComposition";

export const PLANET_COMPOSITION_CONFIRMATION_TIMEOUT_MS = 5_000;
export const PLANET_COMPOSITION_PREVIEW_TIMEOUT_MS = 5_000;
export type PlanetCompositionSnapshot = Readonly<{
  applied: GlobeCompositionSelection;
  displayed: GlobeCompositionSelection;
  renderRevision: number;
  phase: "idle" | "preparing" | "preview" | "error";
  editor: "stand" | "background" | null;
  saveState: "idle" | "saving" | "failed";
  reason: "render-failed" | "preview-timeout" | "invalid-preference" | "preference-unavailable" | "incompatible" | null;
}>;
export interface PlanetCompositionController {
  getSnapshot(): PlanetCompositionSnapshot;
  getServerSnapshot(): PlanetCompositionSnapshot;
  subscribe(listener: () => void): () => void;
  activate(): () => void;
  setVisibility(visible: boolean): void;
  open(editor: "stand" | "background"): boolean;
  preview(part: "stand" | "background", id: string): boolean;
  requestEdition(id: GlobeEditionId): boolean;
  acknowledgePartRendered(part: GlobeCompositionPart, revision: number, id: string): boolean;
  acknowledgeRendered(revision: number, selection: GlobeCompositionSelection): boolean;
  failRendering(revision: number): boolean;
  apply(): boolean;
  cancel(): void;
  retrySave(): boolean;
  refreshEnvironment(): void;
}
export type PlanetCompositionOptions = Readonly<{
  preferences: PreferenceStore;
  enabled: boolean;
  access: "adult" | "blocked";
  /** Stable getter: locale/quality/policy remain owned by their existing controllers. */
  getEnvironment?: () => GlobeCompositionEnvironment;
  /** Prior native WebView storage, only after both platform edition keys are absent. */
  readLegacyEdition?: () => unknown;
}>;

interface PreferenceQueue { tail: Promise<void>; revision: number; }
const queues = new WeakMap<PreferenceStore, PreferenceQueue>();
let commitSequence = 0;
function queueFor(preferences: PreferenceStore) {
  let queue = queues.get(preferences);
  if (!queue) { queue = { tail: Promise.resolve(), revision: 0 }; queues.set(preferences, queue); }
  return queue;
}
const partKeys = Object.freeze({ edition: "editionId", stand: "standId", background: "backgroundId" } as const);
type PendingKind = "restore" | "migration" | "edition" | "preview" | "environment";
type SaveOperation = { result: Promise<boolean>; outcome: boolean | undefined };

/** One local preference record; rendering, atlas leases and durable storage remain port responsibilities. */
export function createPlanetCompositionController(options: PlanetCompositionOptions): PlanetCompositionController {
  const { preferences, enabled, access, getEnvironment, readLegacyEdition } = options;
  const initialSnapshot: PlanetCompositionSnapshot = Object.freeze({
    applied: DEFAULT_GLOBE_COMPOSITION_SELECTION, displayed: DEFAULT_GLOBE_COMPOSITION_SELECTION,
    renderRevision: 0, phase: "idle", editor: null, saveState: "idle", reason: null,
  });
  let snapshot = initialSnapshot;
  let active = false, visible = true;
  let lifetime = 0, intent = 0, readRevision = 0;
  let hydrationFinished = false;
  let pending: PendingKind | null = null;
  let saveOperation: SaveOperation | null = null;
  const ready = new Set<GlobeCompositionPart>();
  const listeners = new Set<() => void>();
  let readTimer: ReturnType<typeof setTimeout> | null = null;
  let frameTimer: ReturnType<typeof setTimeout> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const current = (epoch: number) => active && lifetime === epoch;
  const clearRead = () => { if (readTimer !== null) clearTimeout(readTimer); readTimer = null; };
  const clearFrame = () => { if (frameTimer !== null) clearTimeout(frameTimer); frameTimer = null; };
  const clearSave = () => { if (saveTimer !== null) clearTimeout(saveTimer); saveTimer = null; };
  function compatible(selection: unknown): selection is GlobeCompositionSelection {
    if (!enabled || access !== "adult") return false;
    try { return validateGlobeCompositionSelection(selection, getEnvironment?.() ?? { qualityTier: "high", access }); }
    catch { return false; }
  }
  function publish(next: PlanetCompositionSnapshot) {
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) {
      if (!active) break;
      if (!listeners.has(listener)) continue;
      try { listener(); } catch { /* Observers cannot own a composition transaction. */ }
    }
  }
  function fenceHydration() {
    ++intent; ++readRevision;
    hydrationFinished = true;
    clearRead();
  }
  function rollback(reason: PlanetCompositionSnapshot["reason"], close: boolean) {
    clearFrame(); ready.clear(); pending = null;
    publish({ ...snapshot, displayed: snapshot.applied, renderRevision: snapshot.renderRevision + 1,
      editor: close ? null : snapshot.editor, phase: reason ? "error" : "idle", reason });
  }
  function prepare(selection: GlobeCompositionSelection, kind: PendingKind, editor = snapshot.editor) {
    clearFrame(); ready.clear(); pending = kind;
    const revision = snapshot.renderRevision + 1, epoch = lifetime;
    frameTimer = setTimeout(() => {
      if (!current(epoch) || !visible || snapshot.renderRevision !== revision || snapshot.phase !== "preparing") return;
      frameTimer = null;
      rollback("preview-timeout", false);
    }, PLANET_COMPOSITION_PREVIEW_TIMEOUT_MS);
    publish({ ...snapshot, displayed: copyGlobeCompositionSelection(selection), renderRevision: revision,
      editor, phase: "preparing", reason: null });
  }
  function watchSave(operation: SaveOperation) {
    clearSave();
    if (operation.outcome !== undefined) {
      publish({ ...snapshot, saveState: operation.outcome ? "idle" : "failed" });
      return;
    }
    const epoch = lifetime;
    saveTimer = setTimeout(() => {
      if (!current(epoch) || saveOperation !== operation) return;
      saveTimer = null;
      publish({ ...snapshot, saveState: "failed" });
    }, PLANET_COMPOSITION_CONFIRMATION_TIMEOUT_MS);
  }
  function save(selection: GlobeCompositionSelection, next = snapshot) {
    // A correlation token, never an authorization proof; entropy also separates independent runtimes.
    const commitId = `composition-${Date.now().toString(36)}-${(++commitSequence).toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    const raw = serializeGlobeComposition({ schemaVersion: 1, commitId, selection });
    if (raw === null) { publish({ ...next, saveState: "failed" }); return; }
    const queue = queueFor(preferences), revision = ++queue.revision;
    const result = queue.tail.then(async () => {
      // An unstarted older commit may be superseded; a started port write must settle first.
      if (queue.revision !== revision) return false;
      try { return await preferences.set(GLOBE_COMPOSITION_PREFERENCE_KEY, raw) === true; }
      catch { return false; }
    });
    queue.tail = result.then(() => undefined, () => undefined);
    const operation: SaveOperation = { result, outcome: undefined };
    saveOperation = operation;
    watchSave(operation);
    // Queue and ownership exist before reentrant scene/UI listeners run.
    publish({ ...next, saveState: "saving" });
    void result.then(saved => {
      operation.outcome = saved;
      if (!active || saveOperation !== operation) return;
      clearSave();
      // Port confirmation is not a power-loss durability guarantee on best-effort stores.
      publish({ ...snapshot, saveState: saved ? "idle" : "failed" });
    });
  }
  function hydrate(epoch: number) {
    if (!current(epoch) || !visible || hydrationFinished || intent !== 0 || readTimer !== null || !compatible(snapshot.applied)) return;
    const revision = ++readRevision;
    let expired = false;
    const ownsRead = () => current(epoch) && visible && readRevision === revision && intent === 0 && !expired;
    function unavailable(reason: "invalid-preference" | "preference-unavailable") {
      if (!ownsRead()) return;
      hydrationFinished = true; clearRead();
      rollback(reason, true);
    }
    readTimer = setTimeout(() => {
      if (!ownsRead()) return;
      unavailable("preference-unavailable");
      expired = true;
    }, PLANET_COMPOSITION_CONFIRMATION_TIMEOUT_MS);
    const queue = queueFor(preferences);
    void (async () => {
      try {
        let prior: Promise<void>;
        do {
          prior = queue.tail; await prior;
          if (!ownsRead()) return;
        } while (prior !== queue.tail);
        const queueRevision = queue.revision;
        const read = async (key: string) => {
          const value = await preferences.get(key);
          if (!ownsRead() || queueRevision !== queue.revision) throw new Error("obsolete-composition-read");
          return value;
        };
        const stored = await read(GLOBE_COMPOSITION_PREFERENCE_KEY);
        if (stored !== null) {
          const record = parseGlobeComposition(stored);
          if (!record || !compatible(record.selection)) { unavailable("invalid-preference"); return; }
          hydrationFinished = true; clearRead();
          prepare(record.selection, "restore", null);
          return;
        }
        // Null alone proves absence. Errors, malformed values and timeouts never authorize migration.
        const edition = await read("probpera.globe-edition.v2");
        const style = edition === null ? await read("probpera.globe-style.v1") : null;
        const stand = await read(GLOBE_STAND_PREFERENCE_KEY);
        const background = await read(GLOBE_BACKGROUND_PREFERENCE_KEY);
        let legacyEdition: unknown = edition ?? style;
        if (legacyEdition === null && readLegacyEdition) legacyEdition = readLegacyEdition();
        if (!ownsRead() || queueRevision !== queue.revision) return;
        const hasLegacy = (legacyEdition !== null && legacyEdition !== undefined) || stand !== null || background !== null;
        const selection = copyGlobeCompositionSelection({
          editionId: parseStoredGlobeEdition(legacyEdition),
          standId: isGlobeStandId(stand) ? stand : DEFAULT_GLOBE_COMPOSITION_SELECTION.standId,
          backgroundId: isGlobeBackgroundId(background) ? background : DEFAULT_GLOBE_COMPOSITION_SELECTION.backgroundId,
        });
        if (!compatible(selection)) { unavailable("invalid-preference"); return; }
        hydrationFinished = true; clearRead();
        if (hasLegacy) prepare(selection, "migration", null);
      } catch { unavailable("preference-unavailable"); }
    })();
  }
  function cancel() {
    if (!active) return;
    fenceHydration();
    rollback(null, true);
  }

  return Object.freeze({
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() {
      if (!enabled || access !== "adult") return () => undefined;
      if (active) throw new Error("Composition controller is already active");
      active = true;
      const epoch = ++lifetime;
      if (saveOperation) watchSave(saveOperation);
      hydrate(epoch);
      return () => {
        if (!current(epoch)) return;
        active = false; ++lifetime; ++readRevision;
        clearRead(); clearFrame(); clearSave(); ready.clear();
        if ((pending === "restore" || pending === "migration") && intent === 0) hydrationFinished = false;
        pending = null;
        snapshot = Object.freeze({ ...snapshot, displayed: snapshot.applied, editor: null,
          phase: "idle", reason: null, renderRevision: snapshot.renderRevision + 1 });
      };
    },
    setVisibility(nextVisible: boolean) {
      const next = nextVisible === true;
      if (next === visible) return;
      visible = next;
      if (!next) {
        const untouched = intent === 0 && (readTimer !== null || pending === "restore" || pending === "migration");
        ++readRevision; clearRead();
        if (!active) return;
        if (untouched) {
          hydrationFinished = false;
          rollback(null, true);
        } else if (snapshot.editor !== null || pending === "edition" || pending === "preview") cancel();
        else rollback(null, true);
      } else if (active) {
        if (!hydrationFinished && intent === 0) hydrate(lifetime);
        else if (compatible(snapshot.applied)) prepare(snapshot.applied, "environment", null);
      }
    },
    open(editor: "stand" | "background") {
      if (!active || !visible || (editor !== "stand" && editor !== "background") || !compatible(snapshot.applied)) return false;
      if (snapshot.editor === editor) return true;
      fenceHydration(); clearFrame(); ready.clear(); pending = null;
      publish({ ...snapshot, displayed: snapshot.applied, editor, phase: "idle", reason: null,
        renderRevision: snapshot.renderRevision + 1 });
      return true;
    },
    preview(part: "stand" | "background", id: string) {
      if (!active || !visible || snapshot.editor !== part || (part !== "stand" && part !== "background")) return false;
      const selection = { ...snapshot.applied, [partKeys[part]]: id };
      if (!compatible(selection)) return false;
      fenceHydration(); prepare(selection, "preview"); return true;
    },
    requestEdition(id: GlobeEditionId) {
      if (!active || !visible) return false;
      const selection = { ...snapshot.applied, editionId: id };
      if (!compatible(selection)) return false;
      fenceHydration(); prepare(selection, "edition", null); return true;
    },
    acknowledgePartRendered(part: GlobeCompositionPart, revision: number, id: string) {
      if (!active || !visible || snapshot.phase !== "preparing" || snapshot.renderRevision !== revision
        || !Object.prototype.hasOwnProperty.call(partKeys, part) || snapshot.displayed[partKeys[part]] !== id || !compatible(snapshot.displayed)) return false;
      ready.add(part); return true;
    },
    acknowledgeRendered(revision: number, selection: GlobeCompositionSelection) {
      if (!active || !visible || snapshot.phase !== "preparing" || snapshot.renderRevision !== revision
        || !pending || ready.size !== 3 || !compatible(selection) || !sameGlobeComposition(selection, snapshot.displayed)) return false;
      const kind = pending;
      clearFrame(); ready.clear(); pending = null;
      if (kind === "preview") publish({ ...snapshot, phase: "preview", reason: null });
      else {
        const next: PlanetCompositionSnapshot = { ...snapshot, applied: snapshot.displayed, phase: "idle", reason: null };
        if (kind === "edition" || kind === "migration") save(snapshot.displayed, next);
        else publish(next);
      }
      return true;
    },
    failRendering(revision: number) {
      if (!active || !visible || snapshot.renderRevision !== revision
        || (snapshot.phase !== "preparing" && snapshot.phase !== "preview")) return false;
      rollback("render-failed", false); return true;
    },
    apply() {
      if (!active || !visible || snapshot.phase !== "preview" || snapshot.editor === null || !compatible(snapshot.displayed)) return false;
      fenceHydration(); clearFrame(); ready.clear(); pending = null;
      save(snapshot.displayed, { ...snapshot, applied: snapshot.displayed, phase: "idle", reason: null });
      return true;
    },
    cancel,
    retrySave() {
      if (!active || snapshot.saveState !== "failed" || !compatible(snapshot.applied)) return false;
      save(snapshot.applied); return true;
    },
    refreshEnvironment() {
      if (!active) return;
      if (!compatible(snapshot.displayed)) {
        ++readRevision; clearRead();
        rollback("incompatible", true); return;
      }
      if (!visible) { clearFrame(); ready.clear(); return; }
      // Preserve the requested transaction, but a changed environment needs three new part receipts.
      const kind = pending ?? (snapshot.phase === "preview" ? "preview" : "environment");
      prepare(snapshot.displayed, kind);
      hydrate(lifetime);
    },
  });
}

export function usePlanetComposition(options: PlanetCompositionOptions) {
  const { preferences, enabled, access, getEnvironment, readLegacyEdition } = options;
  const controller = useMemo(() => createPlanetCompositionController({ preferences, enabled, access, getEnvironment, readLegacyEdition }),
    [preferences, enabled, access, getEnvironment, readLegacyEdition]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  useEffect(() => controller.activate(), [controller]);
  return { controller, snapshot };
}
