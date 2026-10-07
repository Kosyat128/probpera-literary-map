export type PlanetSceneInspectionSnapshot = Readonly<{
  available: boolean;
  mode: "closed" | "scene" | "object";
  sessionId: number | null;
}>;
export type PlanetSceneInspectionContext = Readonly<{
  enabled: boolean;
  access: "adult" | "child" | "blocked";
  visible: boolean;
  editorOpen: boolean;
  appliedBackgroundId: string;
  displayedBackgroundId: string;
  /** Ready, reversible display acknowledged by the existing composition owner. */
  previewReady?: boolean;
  /** Existing adult preview repaint only; holds intent without fresh actions. */
  previewRepainting?: boolean;
}>;
export type PlanetSceneInspectionTarget = Readonly<{
  backgroundId: string;
  /** Consult the currently shown resource and its actual rendered-frame readiness. */
  canActivate: () => boolean;
  /** Native content is admitted only by its resource owner, never this UI controller. */
  kind?: "included" | "native";
}>;
export interface PlanetSceneInspectionController {
  getSnapshot(): PlanetSceneInspectionSnapshot;
  subscribe(listener: () => void): () => void;
  setContext(context: PlanetSceneInspectionContext): void;
  registerTarget(key: object, target: PlanetSceneInspectionTarget): () => void;
  refreshTarget(): void;
  open(): boolean;
  openObject(): boolean;
  closeObject(): void;
  close(): void;
  openBooks(callback: () => void): boolean;
  dispose(): void;
}

type Mode = PlanetSceneInspectionSnapshot["mode"];
type Lease = PlanetSceneInspectionTarget & { key: object };
const STUDY = "background.base.writer-study";

/** Transient interaction intent; actual resource/native admission stays with the registered owner. */
export function createPlanetSceneInspectionController(): PlanetSceneInspectionController {
  let snapshot: PlanetSceneInspectionSnapshot = Object.freeze({ available: false, mode: "closed", sessionId: null });
  let context: PlanetSceneInspectionContext | null = null;
  let target: Lease | null = null;
  let revision = 0, sessionSequence = 0, disposed = false, evaluating = false;
  const listeners = new Set<() => void>();
  const holdingRepaint = () => snapshot.mode !== "closed" && context?.access === "adult"
    && context.editorOpen && context.previewReady !== true && context.previewRepainting === true;
  const allowed = () => !disposed && context?.enabled === true && context.visible === true
    && (context.editorOpen ? context.previewReady === true || holdingRepaint() : context.appliedBackgroundId === context.displayedBackgroundId)
    && (context.access === "adult" ? context.displayedBackgroundId === STUDY : context.access === "child");
  function publish(available: boolean, mode: Mode) {
    if (snapshot.available === available && snapshot.mode === mode) return;
    const next = Object.freeze({ available, mode, sessionId: mode === "closed" ? null : snapshot.sessionId ?? ++sessionSequence }); snapshot = next;
    for (const listener of [...listeners]) {
      if (snapshot !== next) break;
      if (listeners.has(listener)) {
        try { listener(); } catch { /* Observers do not own interaction authority. */ }
      }
    }
  }
  function readiness() {
    const epoch = revision, lease = target;
    const eligible = allowed() && lease?.backgroundId === context?.displayedBackgroundId
      && (context?.access === "child" ? lease?.kind === "native" : lease?.kind !== "native");
    let available = false;
    // A reentrant query cannot recursively invoke the renderer's readiness port.
    // Any authority mutation it triggers fences the outer result below.
    if (eligible && lease && !holdingRepaint() && !evaluating) {
      evaluating = true;
      try { available = lease.canActivate() === true; } catch { available = false; }
      finally { evaluating = false; }
    }
    if (disposed || epoch !== revision || target !== lease) return null;
    return { epoch, lease, eligible, available };
  }
  function refresh(mode?: Mode) {
    const state = readiness();
    if (!state) return;
    publish(state.available, state.eligible ? mode ?? snapshot.mode : "closed");
  }
  function enter(mode: Mode): boolean {
    if (disposed) return false;
    ++revision;
    const state = readiness();
    if (!state) return false;
    if (!state.available) {
      publish(false, state.eligible ? snapshot.mode : "closed");
      return false;
    }
    publish(true, mode);
    return !disposed && revision === state.epoch && target === state.lease && snapshot.mode === mode;
  }
  const controller: PlanetSceneInspectionController = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    setContext(value) {
      if (disposed) return;
      const next = Object.freeze({ enabled: value.enabled, access: value.access, visible: value.visible,
        editorOpen: value.editorOpen, appliedBackgroundId: value.appliedBackgroundId, displayedBackgroundId: value.displayedBackgroundId,
        previewReady: value.previewReady === true, previewRepainting: value.previewRepainting === true });
      if (context && Object.keys(next).every(key => next[key as keyof typeof next] === context![key as keyof typeof next])) return;
      ++revision; context = next; refresh();
    },
    registerTarget(key, value) {
      if (disposed) return () => undefined;
      const sameResource = target?.key === key;
      const lease: Lease = Object.freeze({ key, backgroundId: value.backgroundId, canActivate: value.canActivate, kind: value.kind ?? "included" });
      ++revision; target = lease; refresh(sameResource ? undefined : "closed");
      return () => {
        if (disposed || target !== lease) return;
        ++revision; target = null; publish(false, "closed");
      };
    },
    refreshTarget() { if (!disposed) { ++revision; refresh(); } },
    open() { return enter(snapshot.mode === "closed" ? "scene" : snapshot.mode); },
    openObject() { return snapshot.mode !== "closed" && enter("object"); },
    closeObject() {
      if (disposed || snapshot.mode !== "object") return;
      ++revision; publish(snapshot.available, "scene");
    },
    close() {
      if (disposed) return;
      ++revision; publish(snapshot.available, "closed");
    },
    openBooks(callback) {
      if (disposed || snapshot.mode !== "object") return false;
      ++revision;
      const state = readiness();
      if (!state) return false;
      if (!state.available) { publish(false, state.eligible ? snapshot.mode : "closed"); return false; }
      publish(true, "closed");
      // A close observer may dispose, replace the resource or take interaction
      // for another surface. Never navigate using the authorization it revoked.
      if (disposed || revision !== state.epoch || target !== state.lease || controller.getSnapshot().mode !== "closed") return false;
      const confirmed = readiness();
      if (!confirmed || !confirmed.available) { if (confirmed) publish(false, "closed"); return false; }
      try { callback(); return true; } catch { return false; }
    },
    dispose() {
      if (disposed) return;
      ++revision; disposed = true; context = null; target = null;
      publish(false, "closed"); listeners.clear();
    },
  };
  return Object.freeze(controller);
}
