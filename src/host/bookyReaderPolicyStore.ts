import type { PreferenceStore } from "../platform/ports";
import { BOOKY_READER_POLICY_KEY, createBookyReaderPolicy, decodeBookyReaderPolicy,
  type BookyReaderPolicy, type BookyReaderPolicyInput } from "./bookyReaderPolicy";

export type BookyReaderPolicySnapshot = Readonly<{
  state: "idle" | "loading" | "ready" | "saving" | "failed";
  /** Effective policy only. Draft, unread and unconfirmed values are never exposed. */
  policy: BookyReaderPolicy | null;
  error: "read" | "write" | "unsupported" | "invalid" | null;
  revision: number;
}>;
type ErrorKind = BookyReaderPolicySnapshot["error"];
type Intent = { policy: BookyReaderPolicy | null; state: "pending" | "running" | "confirmed" | "failed";
  error: ErrorKind; job: Promise<void> | null };
type Queue = { tail: Promise<void>; revision: number; policyRevision: number; latest: Intent | null;
  blocked: "unsupported" | "invalid" | null; listeners: Set<() => void> };
const queues = new WeakMap<PreferenceStore, Queue>();
function queueFor(preferences: PreferenceStore) {
  let queue = queues.get(preferences);
  if (!queue) {
    queue = { tail: Promise.resolve(), revision: 0, policyRevision: 0, latest: null, blocked: null, listeners: new Set() };
    queues.set(preferences, queue);
  }
  return queue;
}
function announce(queue: Queue) {
  for (const listener of [...queue.listeners]) if (queue.listeners.has(listener)) {
    try { listener(); } catch { /* Observers cannot cancel explicit storage intent. */ }
  }
}

/** No constructor IO. Successful writes confirm the preference port, not disk
 * durability. A started write keeps its serial slot after timeout or stop;
 * explicit later intents survive unmount and supersede unstarted earlier ones. */
export function createBookyReaderPolicyStore({ preferences, confirmationTimeoutMs = 5_000 }: {
  preferences: PreferenceStore;
  confirmationTimeoutMs?: number;
}) {
  if (!Number.isFinite(confirmationTimeoutMs) || confirmationTimeoutMs < 1 || confirmationTimeoutMs > 60_000) {
    throw new Error("invalid-booky-reader-policy-timeout");
  }
  const queue = queueFor(preferences), listeners = new Set<() => void>();
  let snapshot: BookyReaderPolicySnapshot = Object.freeze({ state: "idle", policy: null, error: null, revision: 0 });
  let active = false, hydrated = false, operation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const owns = (token: number) => active && operation === token;
  function cancel() { ++operation; if (timer !== null) clearTimeout(timer); timer = null; }
  function publish(state: BookyReaderPolicySnapshot["state"], error: ErrorKind = null, policy: BookyReaderPolicy | null = null) {
    if (snapshot.state === state && snapshot.error === error && snapshot.policy === policy) return;
    const next = Object.freeze({ state, error, policy, revision: snapshot.revision + 1 }); snapshot = next;
    for (const listener of [...listeners]) {
      if (snapshot !== next) break;
      if (listeners.has(listener)) { try { listener(); } catch { /* Views do not own storage. */ } }
    }
  }
  function deadline(token: number, error: "read" | "write") {
    timer = setTimeout(() => {
      if (!owns(token)) return;
      timer = null;
      // A late read cannot reopen authority. A current raw write can still
      // confirm later, but cannot release its serial slot on this deadline.
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
      if (intent.state === "confirmed") { hydrated = true; publish("ready", null, intent.policy); }
      else publish("failed", intent.error ?? "write");
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
        const stored = await preferences.get(BOOKY_READER_POLICY_KEY);
        if (!owns(token)) return;
        if (revision !== queue.revision) { read(); return; }
        const decoded = decodeBookyReaderPolicy(stored);
        cancel();
        if (decoded.error) {
          queue.blocked = decoded.error;
          announce(queue);
          return;
        }
        queue.blocked = null; hydrated = true;
        queue.policyRevision = Math.max(queue.policyRevision, decoded.policy?.revision ?? 0);
        if (queue.latest && queue.latest.state !== "confirmed") publish("failed", queue.latest.error ?? "write");
        else publish("ready", null, decoded.policy);
      } catch {
        if (!owns(token)) return;
        cancel(); publish("failed", "read");
      }
    })();
  }
  function changed() {
    if (!active) return;
    const intent = queue.latest;
    if (queue.blocked && (!intent || intent.policy !== null || intent.state === "confirmed")) {
      cancel(); hydrated = false; publish("failed", queue.blocked);
    } else if (intent && (hydrated || intent.policy === null)) watch(intent);
    else read(); // Every new lifetime still requires its own authoritative read.
  }
  function enqueue(policy: BookyReaderPolicy | null) {
    const intent: Intent = { policy, state: "pending", error: null, job: null };
    queue.latest = intent; ++queue.revision;
    const job = queue.tail.then(async () => {
      if (queue.latest !== intent) return;
      if (policy && queue.blocked) { intent.state = "failed"; intent.error = queue.blocked; return; }
      intent.state = "running";
      try {
        const success = policy ? await preferences.set(BOOKY_READER_POLICY_KEY, JSON.stringify(policy))
          : await preferences.remove(BOOKY_READER_POLICY_KEY);
        if (success === true) {
          intent.state = "confirmed"; queue.blocked = null;
          queue.policyRevision = policy ? Math.max(queue.policyRevision, policy.revision) : 0;
          return;
        }
      } catch { /* Retry retains the same explicit input and confirmation time. */ }
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
    save(input: BookyReaderPolicyInput, nowISO: string): boolean {
      if (!active || !hydrated || queue.blocked || queue.policyRevision >= Number.MAX_SAFE_INTEGER) return false;
      const policy = createBookyReaderPolicy(input, nowISO, queue.policyRevision + 1);
      if (!policy) return false;
      queue.policyRevision = policy.revision; enqueue(policy); return true;
    },
    /** Caller must obtain the user's explicit reset confirmation. This alone
     * may remove an unread, invalid or unsupported future record. */
    clear(): boolean {
      if (!active) return false;
      enqueue(null); return true;
    },
    retry(): boolean {
      if (!active || snapshot.state !== "failed") return false;
      const intent = queue.latest;
      if (snapshot.error === "write" && intent && (hydrated || intent.policy === null)) {
        if (intent.state === "running" || intent.state === "pending") watch(intent);
        else enqueue(intent.policy);
      } else read();
      return true;
    },
  });
}
export type BookyReaderPolicyStore = ReturnType<typeof createBookyReaderPolicyStore>;
