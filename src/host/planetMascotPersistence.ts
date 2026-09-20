import type { PreferenceStore } from "../platform/ports";
import type { PlanetMascotController } from "./planetMascot";
import { BOOKY_PREFERENCE_KEY, BookyPreferenceUnsupportedError, decodeBookyPreference, isUnsupportedBookyPreference,
  parseBookyPreference, serializeBookyPreference, type BookyPreference } from "./planetMascotPreference";

export const BOOKY_CONFIRMATION_TIMEOUT_MS = 5_000;
export type PlanetMascotPersistenceSnapshot = Readonly<{
  state: "idle" | "loading" | "saving" | "failed";
  error: "read" | "write" | "unsupported" | null;
}>;
type Outcome = "confirmed" | "failed" | "skipped";
type Intent = { revision: number; value: BookyPreference; serialized: string; allowOverwrite: boolean; resumeExplicit: boolean;
  state: "pending" | "running" | "confirmed" | "failed"; job: Promise<Outcome> | null };
type Queue = { tail: Promise<void>; revision: number; latest: Intent | null; confirmed: string | null;
  authority: "unknown" | "known" | "unsupported" | "reset-authorized" };
// One key per store. Unabortable started writes retain the serial slot even
// after a view timeout/unmount; the latest unconfirmed intent survives remount.
const queues = new WeakMap<PreferenceStore, Queue>();
function queueFor(store: PreferenceStore): Queue {
  let queue = queues.get(store);
  if (!queue) { queue = { tail: Promise.resolve(), revision: 0, latest: null, confirmed: null, authority: "unknown" }; queues.set(store, queue); }
  return queue;
}
const initial: PlanetMascotPersistenceSnapshot = Object.freeze({ state: "idle", error: null });

/** No constructor IO/subscriptions; availability is owned by the adult
 * controller. A successful set confirms the preference port, not disk durability. */
export function createPlanetMascotPersistence({ controller, preferences, confirmationTimeoutMs = BOOKY_CONFIRMATION_TIMEOUT_MS }: {
  controller: PlanetMascotController;
  preferences: PreferenceStore;
  confirmationTimeoutMs?: number;
}) {
  if (!Number.isFinite(confirmationTimeoutMs) || confirmationTimeoutMs < 1 || confirmationTimeoutMs > 60_000) {
    throw new Error("invalid-booky-confirmation-timeout");
  }
  let snapshot = initial, active = false, lifetime = 0, hydrated = false, readFailed = false, applyingRead = false;
  // Shared serial history is not a fresh mount's read authority. In particular,
  // an old unabortable write may settle after this mount's read has timed out.
  let authorityReady = false;
  let observedRevision = 0, desired: Intent | null = null, available = false;
  let activation: object | null = null;
  let unsubscribe: (() => void) | null = null;
  let readOwner: { token: object; timer: ReturnType<typeof setTimeout> } | null = null;
  let writeOwner: { intent: Intent; epoch: number; timer: ReturnType<typeof setTimeout> | null; job: Promise<Outcome> | null } | null = null;
  const listeners = new Set<() => void>();
  const eligible = () => active && controller.getSnapshot().available;
  const canWrite = (queue: Queue, intent: Intent) => intent.allowOverwrite
    || queue.authority === "reset-authorized" || authorityReady && queue.authority === "known";

  function publish(state: PlanetMascotPersistenceSnapshot["state"], error: PlanetMascotPersistenceSnapshot["error"] = null) {
    if (snapshot.state === state && snapshot.error === error) return;
    const next = Object.freeze({ state, error }); snapshot = next;
    for (const listener of [...listeners]) {
      if (snapshot !== next) break;
      if (listeners.has(listener)) { try { listener(); } catch { /* Observers do not own storage. */ } }
    }
  }
  function cancelRead() {
    if (readOwner) clearTimeout(readOwner.timer);
    readOwner = null;
  }
  function cancelWriteWatch() {
    if (writeOwner?.timer !== null && writeOwner?.timer !== undefined) clearTimeout(writeOwner.timer);
    writeOwner = null;
  }
  function pause() {
    ++lifetime; cancelRead(); cancelWriteWatch();
    if (snapshot.state === "loading" || snapshot.state === "saving") publish("idle");
  }

  function schedule(intent: Intent): Promise<Outcome> {
    if (intent.job) return intent.job;
    const queue = queueFor(preferences);
    const job = queue.tail.then(async (): Promise<Outcome> => {
      if (!eligible() || queue.latest !== intent || !canWrite(queue, intent)) return "skipped";
      const writeLifetime = lifetime;
      intent.state = "running";
      try {
        if (await preferences.set(BOOKY_PREFERENCE_KEY, intent.serialized) === true) {
          intent.state = "confirmed"; queue.confirmed = intent.serialized; queue.authority = "known";
          if (active && lifetime === writeLifetime) authorityReady = true;
          return "confirmed";
        }
      } catch { /* Rejected ports do not discard local intent. */ }
      intent.state = "failed"; return "failed";
    });
    intent.job = job;
    queue.tail = job.then(() => undefined, () => undefined);
    void job.then(() => { if (intent.job === job) intent.job = null; });
    return job;
  }

  function watchWrite(intent: Intent) {
    if (!eligible()) return;
    const queue = queueFor(preferences);
    if (queue.latest !== intent) { cancelWriteWatch(); desired = null; publish("idle"); return; }
    if (!canWrite(queue, intent)) { hydrate(); return; }
    if (intent.state === "confirmed") { cancelWriteWatch(); publish("idle"); return; }
    if (!writeOwner || writeOwner.intent !== intent) {
      cancelWriteWatch();
      const owner = { intent, epoch: lifetime, timer: null as ReturnType<typeof setTimeout> | null, job: null as Promise<Outcome> | null };
      writeOwner = owner;
      owner.timer = setTimeout(() => {
        if (writeOwner !== owner || !eligible() || owner.epoch !== lifetime) return;
        owner.timer = null; publish("failed", "write");
      }, confirmationTimeoutMs);
    }
    const owner = writeOwner, job = schedule(intent);
    if (owner.job === job) return;
    owner.job = job;
    // Register ownership before publishing: a listener may hide/unmount now.
    if (snapshot.state !== "failed" || snapshot.error !== "write") publish("saving");
    void job.then(outcome => {
      if (writeOwner !== owner || owner.epoch !== lifetime || !eligible()) return;
      if (queue.latest !== intent) { cancelWriteWatch(); desired = null; publish("idle"); return; }
      if (outcome === "skipped") { owner.job = null; watchWrite(intent); return; }
      cancelWriteWatch(); publish(outcome === "confirmed" ? "idle" : "failed", outcome === "confirmed" ? null : "write");
    });
  }

  function acceptIntent(value: BookyPreference, allowOverwrite: boolean, resumeExplicit: boolean) {
    const queue = queueFor(preferences), serialized = serializeBookyPreference(value)!;
    // A local gesture fences restoration, not the unknown storage format.
    // Only the deliberate reset can replace a record before a valid read.
    if (allowOverwrite) {
      hydrated = true; readFailed = false; cancelRead();
      // Deliberate reset authorizes this replacement transaction, including
      // newer local choices coalesced before its pending write can start.
      queue.authority = "reset-authorized"; authorityReady = true;
    }
    if (queue.latest?.serialized === serialized && queue.latest.state !== "failed"
      && queue.latest.allowOverwrite === allowOverwrite
      && queue.latest.resumeExplicit === resumeExplicit
      && (queue.latest.state !== "confirmed" || queue.confirmed === serialized)) desired = queue.latest;
    else if (authorityReady && queue.authority === "known" && (!queue.latest || queue.latest.state === "confirmed") && queue.confirmed === serialized) desired = null;
    else {
      desired = { revision: ++queue.revision, value, serialized, allowOverwrite, resumeExplicit, state: "pending", job: null };
      queue.latest = desired;
    }
    cancelWriteWatch();
    if (eligible() && desired) watchWrite(desired);
    else if (!desired) publish("idle");
  }

  function hydrate() {
    if (!eligible() || readFailed || readOwner || applyingRead) return;
    const queue = queueFor(preferences), intent = controller.getPreferenceIntent();
    if (hydrated && authorityReady && (queue.authority === "known" || queue.authority === "reset-authorized")) return;
    // A previous mounted owner may have accepted a write that is still queued,
    // running or failed. Preserve that newer semantic intent across remount.
    if (!desired && queue.latest && queue.latest.state !== "confirmed") {
      const pending = queue.latest;
      desired = pending;
      // This is an earlier explicit local intent, not a storage restoration.
      // Mark its cursor provenance so a later authoritative read merges old
      // progress without reverting visibility or inventing a cursor choice.
      applyingRead = true;
      try { controller.adoptPendingPreference(pending.value, intent.revision, pending.resumeExplicit); }
      finally { applyingRead = false; }
      if (!eligible()) return;
      if (desired && canWrite(queue, desired)) {
        hydrated = true; authorityReady = true;
        watchWrite(desired);
        return;
      }
    }
    const epoch = lifetime, token = {}, revision = 0;
    const owns = () => eligible() && lifetime === epoch && readOwner?.token === token;
    queue.authority = "unknown"; authorityReady = false;
    const timer = setTimeout(() => {
      if (!owns()) return;
      readOwner = null; readFailed = true; publish("failed", "read");
    }, confirmationTimeoutMs);
    readOwner = { token, timer };
    publish("loading");
    void (async () => {
      try {
        let tail: Promise<void>;
        do { tail = queue.tail; await tail; if (!owns()) return; } while (tail !== queue.tail);
        const stored = await preferences.get(BOOKY_PREFERENCE_KEY);
        if (!owns()) return;
        if (isUnsupportedBookyPreference(stored)) throw new BookyPreferenceUnsupportedError();
        const decoded = stored === null ? null : decodeBookyPreference(stored);
        if (stored !== null && !decoded) throw new Error("invalid-booky-preference");
        cancelRead(); hydrated = true; readFailed = false;
        // This bounded fresh read is authoritative, including absence. A
        // confirmed intent from an older mount must not suppress a later
        // explicit write after another owner removed/changed the record.
        // Retain the actual v1 bytes. A later explicit action must migrate to
        // v2 even if normalization produced the same semantic UI preference.
        queue.confirmed = stored;
        if (queue.latest?.state === "confirmed") queue.latest = null;
        applyingRead = true;
        try {
          if (decoded && !controller.restorePreference(decoded.value, revision)) controller.mergePreference(decoded.value, revision);
        } finally { applyingRead = false; }
        // Merge can synchronously emit a replacement intent. Keep write
        // authority closed until it finishes so old progress is not erased.
        queue.authority = "known"; authorityReady = true;
        if (eligible() && lifetime === epoch) {
          if (desired) watchWrite(desired);
          else publish("idle");
        }
      } catch (error) {
        if (!owns()) return;
        cancelRead(); readFailed = true;
        const unsupported = error instanceof BookyPreferenceUnsupportedError;
        queue.authority = unsupported ? "unsupported" : "unknown"; authorityReady = false;
        publish("failed", unsupported ? "unsupported" : "read");
      }
    })();
  }

  function reconcile() {
    if (!active) return;
    const intent = controller.getPreferenceIntent();
    const changed = intent.revision !== observedRevision;
    observedRevision = intent.revision;
    if (changed) {
      const value = parseBookyPreference(intent.value);
      if (value) acceptIntent(value, intent.allowOverwrite === true, intent.resumeExplicit === true);
    }
    const nextAvailable = eligible(), resumed = nextAvailable && !available;
    available = nextAvailable;
    if (!available) { pause(); return; }
    if (desired) {
      if (snapshot.state !== "failed" || resumed || changed) watchWrite(desired);
    } else hydrate();
  }

  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() {
      if (active) throw new Error("booky-persistence-already-active");
      const queue = queueFor(preferences);
      if (!hydrated) {
        // Ordinary failed/unstarted intents survive, but their earlier read
        // cannot authorize overwriting a record changed between mounts.
        authorityReady = queue.authority === "reset-authorized";
        if (!authorityReady) queue.authority = "unknown";
      }
      active = true; const epoch = ++lifetime, token = {};
      activation = token;
      unsubscribe = controller.subscribe(reconcile);
      // StrictMode's discarded activation performs no storage work.
      queueMicrotask(() => { if (active && lifetime === epoch) reconcile(); });
      return () => {
        if (activation !== token) return;
        activation = null; active = false; available = false; unsubscribe?.(); unsubscribe = null;
        // Effect reactivation can reuse this object. It still starts a new
        // lifetime and must re-read ordinary storage authority. Background
        // pause alone retains the existing validated session.
        hydrated = false; authorityReady = false; readFailed = false;
        if (desired?.state === "confirmed") desired = null;
        pause();
      };
    },
    retry() {
      if (!eligible() || snapshot.state !== "failed") return false;
      if (snapshot.error === "read" || snapshot.error === "unsupported") { readFailed = false; hydrated = false; hydrate(); }
      else if (desired) { cancelWriteWatch(); publish("idle"); watchWrite(desired); }
      else return false;
      return true;
    },
  });
}

export type PlanetMascotPersistence = ReturnType<typeof createPlanetMascotPersistence>;
