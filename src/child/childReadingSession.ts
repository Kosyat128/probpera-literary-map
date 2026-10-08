import { decodeChildEntityPayload, decodeChildEntityReference, type ChildEntityPayload, type ChildEntityReference } from "./childPackage";
import { decodeChildNativeReadingPosition, decodeChildReadingPosition, resolveChildReadingPosition,
  type ChildNativeReadingPosition, type ChildNativeReadingPositionController } from "./childReadingPosition";
import type { ChildNativeAppController } from "./childNativeAppBridge";

export type ChildReadingHost = Pick<ChildNativeAppController, "getSnapshot" | "subscribe"> & {
  readonly reading?: ChildNativeReadingPositionController;
};
export interface ChildReadingSessionSnapshot {
  readonly phase: "sealed" | "loading" | "ready" | "unavailable" | "disposed";
  readonly saved: ChildNativeReadingPosition | null;
  readonly saving: boolean; readonly failure: "read" | "save" | null;
}
/** Presentation correlation only. Every read/write still needs the original
 * native current context, package anchors, selected owner and durable ACK. */
export function createChildReadingSession({ controller, reference, payload, contextToken, language }: {
  controller: ChildReadingHost; reference: ChildEntityReference; payload: ChildEntityPayload;
  contextToken: string; language: "ru" | "en";
}) {
  const owner = decodeChildEntityReference(reference), content = decodeChildEntityPayload(payload), port = controller.reading;
  let snapshot: ChildReadingSessionSnapshot = Object.freeze({ phase: "sealed", saved: null, saving: false, failure: null });
  const originalContext = controller.getSnapshot().context;
  let context: ReturnType<ChildReadingHost["getSnapshot"]>["context"] = null, active = false, disposed = false, sequence = 0;
  let unsubscribe: (() => void) | null = null;
  const listeners = new Set<() => void>();
  function publish(next: ChildReadingSessionSnapshot) { snapshot = Object.freeze(next); for (const listener of listeners) listener(); }
  function originalIsCurrent() {
    const native = controller.getSnapshot();
    return !disposed && !!originalContext && native.phase === "ready" && native.status === "child"
      && native.context === originalContext && originalContext.mode === "child" && !!originalContext.profileId && !!originalContext.package
      && originalContext.token === contextToken && originalContext.locale === language && originalContext.remainingLifetimeMs > 0;
  }
  function current() { return active && context === originalContext && originalIsCurrent(); }
  function seal() { ++sequence; context = null; publish({ phase: "sealed", saved: null, saving: false, failure: null }); }
  async function read() {
    if (!current() || !owner || !content?.readingAnchors || !port || snapshot.saving) return false;
    const attempt = ++sequence, expectedContext = context; publish({ phase: "loading", saved: null, saving: false, failure: null });
    try {
      const raw = await port.readReadingPosition(owner);
      if (!current() || sequence !== attempt || context !== expectedContext) return false;
      const saved = decodeChildNativeReadingPosition(raw, context!.profileId!, owner);
      publish(saved ? { phase: "ready", saved, saving: false, failure: null }
        : { phase: "unavailable", saved: null, saving: false, failure: "read" });
      return !!saved;
    } catch {
      if (current() && sequence === attempt) publish({ phase: "unavailable", saved: null, saving: false, failure: "read" });
      return false;
    }
  }
  async function remember(anchorId: string) {
    if (!current() || !owner || !content?.readingAnchors || !port || snapshot.phase !== "ready" || !snapshot.saved || snapshot.saving) return false;
    const previous = snapshot.saved;
    if (previous.position && !resolveChildReadingPosition(previous.position, content.readingAnchors, owner)) return false;
    const proposal = decodeChildReadingPosition({ schemaVersion: 1, entity: { kind: owner.kind, id: owner.id },
      anchorVersion: content.readingAnchors.anchorVersion, anchorId });
    if (!proposal || !resolveChildReadingPosition(proposal, content.readingAnchors, owner)) return false;
    const attempt = ++sequence, expectedContext = context; publish({ phase: "ready", saved: previous, saving: true, failure: null });
    try {
      const raw = await port.rememberReadingPosition(owner, previous.revision, proposal);
      if (!current() || sequence !== attempt || context !== expectedContext) return false;
      const saved = decodeChildNativeReadingPosition(raw, context!.profileId!, owner, previous.revision, proposal);
      publish({ phase: "ready", saved: saved ?? previous, saving: false, failure: saved ? null : "save" });
      return !!saved;
    } catch {
      if (current() && sequence === attempt) publish({ phase: "ready", saved: previous, saving: false, failure: "save" });
      return false;
    }
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async activate() {
      if (active || disposed) return false;
      active = true; context = originalContext;
      if (!current() || !owner || !content?.readingAnchors || !port) { seal(); return false; }
      unsubscribe = controller.subscribe(() => { if (!current()) seal(); });
      return read();
    },
    refresh: read, remember,
    deactivate() { if (disposed) return; active = false; ++sequence; unsubscribe?.(); unsubscribe = null;
      context = null; publish({ phase: "sealed", saved: null, saving: false, failure: null }); },
    isCurrent: current,
    isCurrentContext: originalIsCurrent,
    dispose() { if (disposed) return; disposed = true; active = false; ++sequence; unsubscribe?.(); unsubscribe = null;
      context = null; publish({ phase: "disposed", saved: null, saving: false, failure: null }); listeners.clear(); },
  });
}
