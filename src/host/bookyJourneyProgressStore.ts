import type { PreferenceStore } from "../platform/ports";
import { BOOKY_JOURNEY_PROGRESS_KEY, DEFAULT_BOOKY_JOURNEY_PROGRESS, decodeBookyJourneyProgress,
  parseBookyJourneyProgress, serializeBookyJourneyProgress, type BookyJourneyProgressPreference } from "./bookyJourneyProgress";

export type BookyJourneyProgressSnapshot = Readonly<{
  state: "idle" | "loading" | "ready" | "saving" | "failed";
  /** Confirmed data only; structural progress never authorizes a route or navigation. */
  preference: BookyJourneyProgressPreference | null;
  error: "read" | "write" | "unsupported" | "invalid" | null;
  revision: number;
}>;
type ErrorKind = BookyJourneyProgressSnapshot["error"];
type Intent = {
  preference: BookyJourneyProgressPreference | null;
  serialized: string | null;
  state: "pending" | "running" | "confirmed" | "failed";
  error: ErrorKind;
  job: Promise<void> | null;
};
type Queue = {
  tail: Promise<void>;
  revision: number;
  preferenceRevision: number;
  latest: Intent | null;
  blocked: "unsupported" | "invalid" | null;
  listeners: Set<() => void>;
};
const queues = new WeakMap<PreferenceStore, Queue>();
function queueFor(preferences: PreferenceStore): Queue {
  let queue = queues.get(preferences);
  if (!queue) {
    queue = { tail: Promise.resolve(), revision: 0, preferenceRevision: 0, latest: null, blocked: null, listeners: new Set() };
    queues.set(preferences, queue);
  }
  return queue;
}
function announce(queue: Queue) {
  for (const listener of [...queue.listeners]) if (queue.listeners.has(listener)) {
    try { listener(); } catch { /* Observers cannot cancel an explicit storage intent. */ }
  }
}

/** No constructor IO or implicit saves. All instances sharing a preference
 * port share one serial write queue. A timed-out operation retains that queue
 * slot until its raw IO settles; stop only revokes the current observer.
 * Readback confirms the port's current value, not durable disk persistence. */
export function createBookyJourneyProgressStore({ preferences, confirmationTimeoutMs = 5_000 }: {
  preferences: PreferenceStore;
  confirmationTimeoutMs?: number;
}) {
  if (!Number.isFinite(confirmationTimeoutMs) || confirmationTimeoutMs < 1 || confirmationTimeoutMs > 60_000) {
    throw new Error("invalid-booky-journey-progress-timeout");
  }
  const queue = queueFor(preferences), listeners = new Set<() => void>();
  let snapshot: BookyJourneyProgressSnapshot = Object.freeze({ state: "idle", preference: null, error: null, revision: 0 });
  let active = false, hydrated = false, operation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const owns = (token: number) => active && operation === token;
  function cancel() { ++operation; if (timer !== null) clearTimeout(timer); timer = null; }
  function publish(state: BookyJourneyProgressSnapshot["state"], error: ErrorKind = null,
    preference: BookyJourneyProgressPreference | null = null) {
    if (snapshot.state === state && snapshot.error === error && snapshot.preference === preference) return;
    const next = Object.freeze({ state, error, preference, revision: snapshot.revision + 1 }); snapshot = next;
    for (const listener of [...listeners]) {
      if (snapshot !== next) break;
      if (listeners.has(listener)) { try { listener(); } catch { /* Views do not own storage. */ } }
    }
  }
  function deadline(token: number, error: "read" | "write") {
    timer = setTimeout(() => {
      if (!owns(token)) return;
      timer = null;
      // Expired reads can never reopen authority. A current write may still
      // confirm later, without permitting another write to pass its serial slot.
      if (error === "read") { ++operation; hydrated = false; }
      publish("failed", error);
    }, confirmationTimeoutMs);
  }
  function watch(intent: Intent) {
    cancel(); const token = operation;
    deadline(token, "write"); publish("saving");
    void intent.job?.then(() => {
      if (!owns(token) || queue.latest !== intent) return;
      cancel();
      if (intent.state === "confirmed") {
        hydrated = true; publish("ready", null, intent.preference ?? DEFAULT_BOOKY_JOURNEY_PROGRESS);
      } else publish("failed", intent.error ?? "write");
    });
  }
  function read() {
    cancel(); hydrated = false; const token = operation;
    deadline(token, "read"); publish("loading");
    void (async () => {
      try {
        let tail: Promise<void>;
        do { tail = queue.tail; await tail; if (!owns(token)) return; } while (tail !== queue.tail);
        const revision = queue.revision;
        const stored = await preferences.get(BOOKY_JOURNEY_PROGRESS_KEY);
        if (!owns(token)) return;
        if (revision !== queue.revision) { read(); return; }
        const decoded = decodeBookyJourneyProgress(stored);
        cancel();
        if (decoded.error) {
          queue.blocked = decoded.error; announce(queue); return;
        }
        queue.blocked = null; hydrated = true;
        queue.preferenceRevision = Math.max(queue.preferenceRevision, decoded.preference?.revision ?? 0);
        if (queue.latest && queue.latest.state !== "confirmed") publish("failed", queue.latest.error ?? "write");
        else publish("ready", null, decoded.preference ?? DEFAULT_BOOKY_JOURNEY_PROGRESS);
      } catch {
        if (!owns(token)) return;
        cancel(); publish("failed", "read");
      }
    })();
  }
  function changed() {
    if (!active) return;
    const intent = queue.latest;
    if (queue.blocked && (!intent || intent.preference !== null || intent.state === "confirmed")) {
      cancel(); hydrated = false; publish("failed", queue.blocked);
    } else if (intent && (hydrated || intent.preference === null)) watch(intent);
    else read(); // Every new lifetime requires an authoritative read of its own.
  }
  function enqueue(preference: BookyJourneyProgressPreference | null, serialized: string | null) {
    const intent: Intent = { preference, serialized, state: "pending", error: null, job: null };
    queue.latest = intent; ++queue.revision;
    const job = queue.tail.then(async () => {
      if (queue.latest !== intent) return; // Coalesce only writes which have not started.
      if (preference && queue.blocked) { intent.state = "failed"; intent.error = queue.blocked; return; }
      intent.state = "running";
      try {
        if (preference) {
          // A format introduced since hydration must not be overwritten by an
          // ordinary save. Only explicit clear may remove unread/future data.
          const current = decodeBookyJourneyProgress(await preferences.get(BOOKY_JOURNEY_PROGRESS_KEY));
          if (current.error) {
            queue.blocked = current.error; intent.state = "failed"; intent.error = current.error; return;
          }
          queue.preferenceRevision = Math.max(queue.preferenceRevision, current.preference?.revision ?? 0);
          if (queue.latest !== intent) return;
          // A newer external preference also cannot be silently replaced with
          // an older revision. A new explicit save receives the observed revision.
          if (current.preference && current.preference.revision >= preference.revision
            && serializeBookyJourneyProgress(current.preference) !== serialized) {
            intent.state = "failed"; intent.error = "write"; return;
          }
        }
        const success = preference ? await preferences.set(BOOKY_JOURNEY_PROGRESS_KEY, serialized!)
          : await preferences.remove(BOOKY_JOURNEY_PROGRESS_KEY);
        if (success === true) {
          const raw = await preferences.get(BOOKY_JOURNEY_PROGRESS_KEY);
          const confirmed = decodeBookyJourneyProgress(raw);
          if (confirmed.error) {
            queue.blocked = confirmed.error;
            intent.state = "failed"; intent.error = preference ? confirmed.error : "write"; return;
          }
          queue.preferenceRevision = Math.max(queue.preferenceRevision, confirmed.preference?.revision ?? 0);
          const matches = preference ? serializeBookyJourneyProgress(confirmed.preference) === serialized : raw === null;
          if (matches) {
            intent.state = "confirmed"; queue.blocked = null;
            // A confirmed explicit deletion resets the sequence only when no
            // newer local save has already reserved its own revision.
            if (!preference && queue.latest === intent) queue.preferenceRevision = 0;
            return;
          }
        }
      } catch { /* Explicit retry retains the same semantic data and revision. */ }
      intent.state = "failed"; intent.error = "write";
    });
    intent.job = job;
    queue.tail = job.then(() => undefined, () => undefined);
    // Establish serial ownership before notifying reentrant views.
    announce(queue);
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() {
      if (active) return;
      active = true; queue.listeners.add(changed); read();
    },
    stop() {
      if (!active) return;
      active = false; hydrated = false; queue.listeners.delete(changed); cancel(); publish("idle");
    },
    save(input: BookyJourneyProgressPreference): boolean {
      if (!active || !hydrated || queue.blocked || queue.preferenceRevision >= Number.MAX_SAFE_INTEGER) return false;
      const parsed = parseBookyJourneyProgress(input);
      if (!parsed) return false;
      const preference = Object.freeze({ ...parsed, revision: queue.preferenceRevision + 1 });
      const serialized = serializeBookyJourneyProgress(preference);
      if (!serialized) return false;
      queue.preferenceRevision = preference.revision; enqueue(preference, serialized); return true;
    },
    /** Caller must obtain explicit user confirmation. This alone may remove an
     * unread, invalid or unsupported record; only this preference key is touched. */
    clear(): boolean {
      if (!active) return false;
      enqueue(null, null); return true;
    },
    retry(): boolean {
      if (!active || snapshot.state !== "failed") return false;
      const intent = queue.latest;
      if (snapshot.error === "write" && intent && (hydrated || intent.preference === null)) {
        if (intent.state === "running" || intent.state === "pending") watch(intent);
        else enqueue(intent.preference, intent.serialized);
      } else read();
      return true;
    },
  });
}
export type BookyJourneyProgressStore = ReturnType<typeof createBookyJourneyProgressStore>;
