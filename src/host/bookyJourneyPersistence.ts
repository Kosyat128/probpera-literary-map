import type { BookyJourneyRuntime } from "./bookyJourneyRuntime";
import type { BookyJourneyProgressStore, BookyJourneyProgressSnapshot } from "./bookyJourneyProgressStore";
import { serializeBookyJourneyProgress, type BookyJourneyProgressPreference } from "./bookyJourneyProgress";

export type BookyJourneyPersistenceSnapshot = Readonly<{
  revision: number;
  storage: BookyJourneyProgressSnapshot;
  canAct: boolean;
  unsaved: boolean;
  clearing: boolean;
}>;

/** The App owns this binding. Only explicit semantic runtime intents write;
 * camera, panel, locale and storage acknowledgements never produce writes. */
export function createBookyJourneyPersistence(runtime: BookyJourneyRuntime, store: BookyJourneyProgressStore) {
  let active = false, hydrated = false, clearing = false, unsaved = false;
  let intentRevision = runtime.getProgressIntent().revision, clearRevision = intentRevision;
  let submittedRevision: number | null = null;
  let unsubscribeRuntime: (() => void) | null = null, unsubscribeStore: (() => void) | null = null;
  const listeners = new Set<() => void>();
  let snapshot: BookyJourneyPersistenceSnapshot = Object.freeze({ revision: 0, storage: store.getSnapshot(),
    canAct: false, unsaved: false, clearing: false });
  function publish() {
    const storage = store.getSnapshot();
    const canAct = active && hydrated && !clearing && storage.state !== "idle" && storage.state !== "loading"
      && (storage.state !== "failed" || storage.error === "write");
    if (snapshot.storage === storage && snapshot.canAct === canAct && snapshot.unsaved === unsaved && snapshot.clearing === clearing) return;
    const next = Object.freeze({ revision: snapshot.revision + 1, storage, canAct, unsaved, clearing }); snapshot = next;
    for (const listener of [...listeners]) {
      if (snapshot !== next) break;
      if (listeners.has(listener)) { try { listener(); } catch { /* A view cannot own a saved intent. */ } }
    }
  }
  function runtimeChanged() {
    if (!active) return;
    const intent = runtime.getProgressIntent();
    if (intent.revision === intentRevision) return;
    intentRevision = intent.revision;
    // No late read may discard a newer local gesture, including reset.
    unsaved = true;
    if (hydrated && !clearing) {
      if (store.save(intent.preference)) submittedRevision = intent.revision;
    }
    publish();
  }
  function matchesIntent(preference: BookyJourneyProgressPreference) {
    const intent = runtime.getProgressIntent();
    return intent.revision === submittedRevision
      && serializeBookyJourneyProgress({ ...intent.preference, revision: preference.revision })
        === serializeBookyJourneyProgress(preference);
  }
  function storageChanged() {
    if (!active) return;
    const state = store.getSnapshot();
    if (state.state === "ready" && state.preference) {
      if (clearing) {
        if (runtime.restoreProgress(state.preference, clearRevision)) {
          clearing = false; unsaved = false; hydrated = true; submittedRevision = null;
        } else if (runtime.getProgressIntent().revision !== clearRevision) {
          // Deletion was confirmed, but a later explicit gesture still owns
          // local state. Do not overwrite it or leave the controls locked.
          clearing = false; hydrated = true; unsaved = true;
        }
      } else if (!hydrated) {
        if (unsaved) {
          // An authoritative read opens the gate without replacing a newer
          // gesture. Persist that retained gesture only on an explicit retry.
          hydrated = true;
          if (matchesIntent(state.preference)) unsaved = false;
        } else {
          hydrated = runtime.restoreProgress(state.preference, intentRevision);
          if (!hydrated && runtime.getProgressIntent().revision !== intentRevision) {
            intentRevision = runtime.getProgressIntent().revision; unsaved = true; hydrated = true;
          }
        }
      } else if (unsaved && matchesIntent(state.preference)) {
        unsaved = false;
      }
    } else if (state.state === "failed" && state.error === "write" && !clearing) {
      // The store has reread supported data before reporting a retained save
      // failure on remount. Local progress remains usable during explicit retry.
      hydrated = true;
    }
    publish();
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() {
      if (active) return;
      active = true;
      unsubscribeRuntime = runtime.subscribe(runtimeChanged);
      unsubscribeStore = store.subscribe(storageChanged);
      runtimeChanged(); // Observe explicit changes made while this binding was stopped.
      store.start(); storageChanged();
    },
    stop() {
      if (!active) return;
      active = false; hydrated = false;
      unsubscribeRuntime?.(); unsubscribeStore?.(); unsubscribeRuntime = null; unsubscribeStore = null;
      store.stop(); publish();
    },
    retry(): boolean {
      if (!active) return false;
      const intent = runtime.getProgressIntent();
      if (unsaved && hydrated && !clearing
        && (store.getSnapshot().state === "ready" || submittedRevision !== intent.revision)) {
        const accepted = store.save(intent.preference);
        if (accepted) submittedRevision = intent.revision;
        publish(); if (accepted) return true;
      }
      return store.retry();
    },
    /** UI confirms both versions; a later acknowledgement invalidates consent. */
    clear(expectedRevision: number, expectedIntentRevision: number): boolean {
      if (!active || clearing || expectedRevision !== snapshot.revision
        || expectedIntentRevision !== runtime.getProgressIntent().revision) return false;
      const storage = store.getSnapshot();
      clearing = true; clearRevision = expectedIntentRevision; publish();
      if (!active || runtime.getProgressIntent().revision !== clearRevision || store.getSnapshot() !== storage) {
        clearing = false; publish(); return false;
      }
      const accepted = store.clear();
      if (!accepted) { clearing = false; publish(); }
      return accepted;
    },
  });
}
export type BookyJourneyPersistence = ReturnType<typeof createBookyJourneyPersistence>;
