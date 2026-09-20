import { isIncludedGlobeStandId } from "../planet/globeStands";
import type { GlobeStandInspectionBridge, GlobeStandInspectionRequest } from "../components/globeStandInspection";

export type PlanetStandInspectionContext = Readonly<{
  enabled: boolean;
  visible: boolean;
  editorOpen: boolean;
  ready: boolean;
  standId: unknown;
  renderRevision: number;
}>;
export type PlanetStandInspectionSnapshot = Readonly<Pick<GlobeStandInspectionBridge, "sessionId" | "request" | "phase">>;
type Event = Parameters<GlobeStandInspectionBridge["onState"]>[0];

/** Transient UI intent only. The existing camera rig owns every camera value;
 * this controller has no scene, animation, storage or entitlement authority. */
export function createPlanetStandInspectionController() {
  const initial: PlanetStandInspectionSnapshot = Object.freeze({ sessionId: null, request: null, phase: "closed" });
  let snapshot = initial, context: PlanetStandInspectionContext | null = null;
  let sequence = 0, disposed = false;
  const listeners = new Set<() => void>();
  const eligible = () => !disposed && context?.enabled === true && context.visible === true && context.editorOpen === true
    && isIncludedGlobeStandId(context.standId) && Number.isSafeInteger(context.renderRevision) && context.renderRevision >= 0;
  function publish(next: PlanetStandInspectionSnapshot) {
    if (snapshot.sessionId === next.sessionId && snapshot.request === next.request && snapshot.phase === next.phase) return;
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) {
      if (snapshot !== next) break;
      if (listeners.has(listener)) { try { listener(); } catch { /* Observers cannot own the session. */ } }
    }
  }
  function request(sessionId: number): GlobeStandInspectionRequest | null {
    if (!eligible() || !context || !isIncludedGlobeStandId(context.standId)) return null;
    const current = snapshot.request;
    if (current?.sessionId === sessionId && current.standId === context.standId && current.renderRevision === context.renderRevision) return current;
    return Object.freeze({ sessionId, standId: context.standId, renderRevision: context.renderRevision });
  }
  function returnToGlobe() {
    if (disposed || snapshot.sessionId === null) return false;
    publish({ sessionId: snapshot.sessionId, request: null, phase: "returning" });
    return true;
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (disposed) return () => undefined;
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    setContext(value: PlanetStandInspectionContext) {
      if (disposed) return;
      context = Object.freeze({ ...value });
      if (snapshot.sessionId === null || !snapshot.request) return;
      const next = request(snapshot.sessionId);
      if (!next) returnToGlobe();
      else publish({ ...snapshot, request: next });
    },
    start() {
      if (!eligible() || !context?.ready || snapshot.sessionId !== null || sequence >= Number.MAX_SAFE_INTEGER) return false;
      const sessionId = ++sequence, next = request(sessionId);
      if (!next) return false;
      publish({ sessionId, request: next, phase: "waiting" });
      return snapshot.request === next;
    },
    returnToGlobe,
    report(event: Event) {
      if (disposed || snapshot.sessionId === null || event.sessionId !== snapshot.sessionId) return false;
      if (event.phase === "closed") { publish(initial); return true; }
      // A late readiness/frame callback cannot resurrect a cancelled session.
      if (!snapshot.request && event.phase !== "returning") return false;
      if (!["waiting", "focusing", "active", "returning"].includes(event.phase)) return false;
      publish({ ...snapshot, phase: event.phase }); return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; context = null; publish(initial); listeners.clear();
    },
  });
}

export type PlanetStandInspectionController = ReturnType<typeof createPlanetStandInspectionController>;
