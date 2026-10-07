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
/** One bounded inspection session; changing tabs/candidates never renews it. */
export const PLANET_COMPOSITION_INSPECTION_TIMEOUT_MS = 60_000;
export type PlanetCompositionSnapshot = Readonly<{
  applied: GlobeCompositionSelection;
  displayed: GlobeCompositionSelection;
  renderRevision: number;
  phase: "idle" | "preparing" | "preview" | "error";
  editor: "stand" | "background" | null;
  saveState: "idle" | "saving" | "failed";
  previewSession: number | null;
  /** Repaints an already confirmed preview; never a new inspection grant. */
  environmentRepaint: boolean;
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
  cancelAndWait(): Promise<boolean>;
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

interface PreferenceQueue { tail: Promise<void>; revision: number; recovery: string | null; }
const queues = new WeakMap<PreferenceStore, PreferenceQueue>();
let commitSequence = 0;
function queueFor(preferences: PreferenceStore) {
  let queue = queues.get(preferences);
  if (!queue) { queue = { tail: Promise.resolve(), revision: 0, recovery: null }; queues.set(preferences, queue); }
  return queue;
}
const partKeys = Object.freeze({ edition: "editionId", stand: "standId", background: "backgroundId" } as const);
type PendingKind = "restore" | "migration" | "edition" | "preview" | "environment";
type SaveOperation = { result: Promise<boolean>; outcome: boolean | undefined; cancelled: boolean;
  selection: GlobeCompositionSelection; baseline: GlobeCompositionSelection; epoch: number; intent: number };

/** One local preference record; rendering, atlas leases and durable storage remain port responsibilities. */
export function createPlanetCompositionController(options: PlanetCompositionOptions): PlanetCompositionController {
  const { preferences, enabled, access, getEnvironment, readLegacyEdition } = options;
  const initialSnapshot: PlanetCompositionSnapshot = Object.freeze({
    applied: DEFAULT_GLOBE_COMPOSITION_SELECTION, displayed: DEFAULT_GLOBE_COMPOSITION_SELECTION,
    renderRevision: 0, phase: "idle", editor: null, saveState: "idle", reason: null, previewSession: null, environmentRepaint: false,
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
  let inspectionTimer: ReturnType<typeof setTimeout> | null = null, inspectionSequence = 0;
  const current = (epoch: number) => active && lifetime === epoch;
  const clearRead = () => { if (readTimer !== null) clearTimeout(readTimer); readTimer = null; };
  const clearFrame = () => { if (frameTimer !== null) clearTimeout(frameTimer); frameTimer = null; };
  const clearSave = () => { if (saveTimer !== null) clearTimeout(saveTimer); saveTimer = null; };
  const clearInspection = () => { if (inspectionTimer !== null) clearTimeout(inspectionTimer); inspectionTimer = null; };
  function retireSave() {
    if (saveOperation && saveOperation.outcome === undefined) {
      saveOperation.cancelled = true;
      if (snapshot.saveState === "saving") snapshot = Object.freeze({ ...snapshot, saveState: "failed" });
    }
    clearSave();
  }
  function compatible(selection: unknown): selection is GlobeCompositionSelection {
    if (!enabled || access !== "adult") return false;
    try { return validateGlobeCompositionSelection(selection, getEnvironment?.() ?? { qualityTier: "high", access }); }
    catch { return false; }
  }
  function publish(next: PlanetCompositionSnapshot) {
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) {
      if (!active || snapshot !== next) break;
      if (!listeners.has(listener)) continue;
      try { listener(); } catch { /* Observers cannot own a composition transaction. */ }
    }
  }
  function fenceHydration() {
    retireSave();
    ++intent; ++readRevision;
    hydrationFinished = true;
    clearRead();
  }
  function rollback(reason: PlanetCompositionSnapshot["reason"], close: boolean) {
    retireSave(); clearFrame(); clearInspection(); ready.clear(); pending = null;
    publish({ ...snapshot, displayed: snapshot.applied, renderRevision: snapshot.renderRevision + 1,
      editor: close ? null : snapshot.editor, phase: reason ? "error" : "idle", reason, previewSession: null, environmentRepaint: false });
  }
  function inspectionSession() {
    if (snapshot.previewSession !== null) return snapshot.previewSession;
    const session = ++inspectionSequence, epoch = lifetime;
    clearInspection();
    inspectionTimer = setTimeout(() => {
      if (!current(epoch) || snapshot.previewSession !== session) return;
      fenceHydration(); rollback("preview-timeout", true);
    }, PLANET_COMPOSITION_INSPECTION_TIMEOUT_MS);
    return session;
  }
  function prepare(selection: GlobeCompositionSelection, kind: PendingKind, editor = snapshot.editor, environmentRepaint = false) {
    clearFrame(); ready.clear(); pending = kind;
    const revision = snapshot.renderRevision + 1, epoch = lifetime;
    frameTimer = setTimeout(() => {
      if (!current(epoch) || !visible || snapshot.renderRevision !== revision || snapshot.phase !== "preparing") return;
      frameTimer = null;
      rollback("preview-timeout", false);
    }, PLANET_COMPOSITION_PREVIEW_TIMEOUT_MS);
    publish({ ...snapshot, displayed: copyGlobeCompositionSelection(selection), renderRevision: revision,
      editor, phase: "preparing", reason: null, environmentRepaint });
  }
  function watchSave(operation: SaveOperation) {
    clearSave();
    if (operation.outcome !== undefined) return;
    const epoch = lifetime;
    saveTimer = setTimeout(() => {
      if (!current(epoch) || saveOperation !== operation) return;
      saveTimer = null;
      operation.cancelled = true;
      rollback("preference-unavailable", false);
      if (saveOperation === operation) publish({ ...snapshot, saveState: "failed" });
    }, PLANET_COMPOSITION_CONFIRMATION_TIMEOUT_MS);
  }
  function save(selection: GlobeCompositionSelection, next = snapshot, recoveryOnly = false) {
    // A correlation token, never an authorization proof; entropy also separates independent runtimes.
    const commitId = `composition-${Date.now().toString(36)}-${(++commitSequence).toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    const raw = serializeGlobeComposition({ schemaVersion: 1, commitId, selection });
    const baseline = snapshot.applied;
    const original = serializeGlobeComposition({ schemaVersion: 1, commitId: `${commitId}-rollback`, selection: baseline });
    if (raw === null || original === null) { rollback("preference-unavailable", false); publish({ ...snapshot, saveState: "failed" }); return; }
    const queue = queueFor(preferences), revision = ++queue.revision;
    const operation: SaveOperation = { result: Promise.resolve(false), outcome: undefined, cancelled: false,
      selection, baseline, epoch: lifetime, intent };
    const write = async (value: string) => {
      try { return await preferences.set(GLOBE_COMPOSITION_PREFERENCE_KEY, value) === true; }
      catch { return false; }
    };
    const owns = () => !operation.cancelled && current(operation.epoch) && visible && intent === operation.intent
      && saveOperation === operation && queue.revision === revision && compatible(selection)
      && (recoveryOnly || sameGlobeComposition(snapshot.displayed, selection));
    const result = queue.tail.then(async () => {
      // A started write and its compensating baseline write are one queue item.
      // Timeout/cancel cannot let a late candidate overwrite the next intent.
      if (!owns() || queue.revision !== revision) return false;
      if (queue.recovery !== null) {
        const recovery = queue.recovery;
        if (!await write(recovery)) return false;
        if (queue.recovery === recovery) queue.recovery = null;
        if (!owns()) return false;
      }
      queue.recovery = original;
      const saved = await write(raw);
      if (saved && owns()) {
        queue.recovery = null;
        operation.outcome = true;
        clearSave();
        if (!recoveryOnly) clearInspection();
        // Publish the committed baseline in this continuation, before observers
        // or another intent can run between acknowledgment and ownership transfer.
        publish(recoveryOnly ? { ...snapshot, saveState: "idle" }
          : { ...snapshot, applied: copyGlobeCompositionSelection(selection), phase: "idle",
            previewSession: null, reason: null, saveState: "idle" });
        return true;
      }
      // Even false/rejected confirmation may follow a performed port write.
      // Keep uncertainty in the shared queue until the old selection is confirmed.
      if (await write(original)) queue.recovery = null;
      return false;
    });
    queue.tail = result.then(() => undefined, () => undefined);
    operation.result = result;
    saveOperation = operation;
    watchSave(operation);
    // Queue and ownership exist before reentrant scene/UI listeners run.
    publish({ ...next, applied: baseline, saveState: "saving" });
    void result.then(saved => {
      operation.outcome = saved;
      if (!active || saveOperation !== operation) return;
      clearSave();
      if (saved) return;
      const cancelled = operation.cancelled;
      if (!cancelled && intent === operation.intent && !recoveryOnly) rollback("preference-unavailable", false);
      if (saveOperation !== operation) return;
      publish({ ...snapshot, saveState: cancelled && queue.recovery === null ? "idle" : "failed" });
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
        if (queue.recovery !== null) { unavailable("preference-unavailable"); return; }
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
        retireSave(); clearRead(); clearFrame(); clearInspection(); ready.clear();
        if ((pending === "restore" || pending === "migration") && intent === 0) hydrationFinished = false;
        pending = null;
        snapshot = Object.freeze({ ...snapshot, displayed: snapshot.applied, editor: null,
          phase: "idle", reason: null, previewSession: null, environmentRepaint: false, renderRevision: snapshot.renderRevision + 1 });
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
      if (snapshot.editor !== null) {
        if (!compatible(snapshot.displayed)) return false;
        // Tabs are views of the same draft. Its receipts and deadline still belong
        // to the requested composition, including a frame that is not ready yet.
        if (snapshot.editor !== editor) publish({ ...snapshot, editor });
        return true;
      }
      // Opening an editor is new intent if restore or an immediate edition change
      // is in flight; neither may become part of the user's uncommitted draft.
      fenceHydration(); clearFrame(); ready.clear(); pending = null;
      publish({ ...snapshot, displayed: snapshot.applied, editor, phase: "idle", reason: null, environmentRepaint: false,
        renderRevision: snapshot.renderRevision + 1, previewSession: inspectionSession() });
      return true;
    },
    preview(part: "stand" | "background", id: string) {
      if (!active || !visible || snapshot.editor !== part || (part !== "stand" && part !== "background")) return false;
      const selection = { ...snapshot.displayed, [partKeys[part]]: id };
      if (!compatible(selection)) return false;
      fenceHydration();
      const session = inspectionSession();
      snapshot = Object.freeze({ ...snapshot, previewSession: session });
      prepare(selection, "preview"); return true;
    },
    requestEdition(id: GlobeEditionId) {
      if (!active || !visible) return false;
      const selection = { ...snapshot.applied, editionId: id };
      if (!compatible(selection)) return false;
      fenceHydration(); clearInspection(); snapshot = Object.freeze({ ...snapshot, previewSession: null });
      prepare(selection, "edition", null); return true;
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
      if (kind === "preview") publish({ ...snapshot, phase: "preview", reason: null, environmentRepaint: false });
      else {
        const next: PlanetCompositionSnapshot = { ...snapshot, phase: "preview", reason: null, environmentRepaint: false };
        if (kind === "edition" || kind === "migration") save(snapshot.displayed, next);
        else publish({ ...next, applied: snapshot.displayed, phase: "idle" });
      }
      return true;
    },
    failRendering(revision: number) {
      if (!active || !visible || snapshot.renderRevision !== revision
        || (snapshot.phase !== "preparing" && snapshot.phase !== "preview")) return false;
      rollback("render-failed", false); return true;
    },
    apply() {
      if (!active || !visible || snapshot.phase !== "preview" || snapshot.saveState === "saving" || snapshot.editor === null || !compatible(snapshot.displayed)) return false;
      fenceHydration(); clearFrame(); ready.clear(); pending = null;
      save(snapshot.displayed, { ...snapshot, reason: null });
      return true;
    },
    cancel,
    async cancelAndWait() {
      if (!active || !visible) return false;
      // Own this cancellation before notifying subscribers: a synchronous
      // newer choice must not become this older navigation's authority.
      const ticket = intent + 1, epoch = lifetime, queue = queueFor(preferences), tail = queue.tail;
      cancel();
      if (!current(epoch) || intent !== ticket || queue.tail !== tail) return false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const joined = await Promise.race([tail.then(() => true), new Promise<false>(resolve => {
        timer = setTimeout(() => resolve(false), PLANET_COMPOSITION_CONFIRMATION_TIMEOUT_MS);
      })]);
      if (timer !== undefined) clearTimeout(timer);
      return joined && current(epoch) && visible && intent === ticket && queue.tail === tail && queue.recovery === null;
    },
    retrySave() {
      if (!active || !visible || snapshot.saveState !== "failed" || !compatible(snapshot.applied)) return false;
      save(snapshot.applied, snapshot, true); return true;
    },
    refreshEnvironment() {
      if (!active) return;
      if (snapshot.saveState === "saving") rollback(null, true);
      if (!compatible(snapshot.displayed)) {
        ++readRevision; clearRead();
        rollback("incompatible", true); return;
      }
      if (!visible) { clearFrame(); ready.clear(); return; }
      // Preserve the requested transaction, but a changed environment needs three new part receipts.
      const kind = pending ?? (snapshot.phase === "preview" ? "preview" : "environment");
      const repaint = snapshot.editor !== null && snapshot.previewSession !== null && snapshot.saveState !== "saving"
        && (snapshot.phase === "preview" || (snapshot.phase === "preparing" && snapshot.environmentRepaint));
      prepare(snapshot.displayed, kind, snapshot.editor, repaint);
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
