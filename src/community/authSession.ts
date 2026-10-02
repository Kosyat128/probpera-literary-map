import type { Session, SupabaseClient } from "@supabase/supabase-js";

export type AuthSessionError = "unavailable" | "invalid-session";
export type DeletionStatusIdentity = Readonly<{ subject: string; token: string; scope: object }>;
export type AuthSessionSnapshot = Readonly<{ session: Session | null; loading: boolean; error: AuthSessionError | null;
  deletionStatusIdentity?: DeletionStatusIdentity }>;
type AuthPort = Pick<SupabaseClient["auth"], "getSession" | "getUser" | "onAuthStateChange">;
type AuthClient = { auth: AuthPort; rpc: SupabaseClient["rpc"] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/** Observes the existing SDK only: no second client, persistence or authority.
 * Cached getSession data is only a candidate. getUser(exact token) verifies it
 * with canonical Auth, then an exact-token RPC checks the real live session and
 * deletion state before local private data can be shown. RLS independently
 * rechecks every sensitive operation. SDK work is deferred outside its
 * synchronous auth notification lock. Every event invalidates older work. */
export function observeCanonicalAuthSession(options: {
  loadClient(): Promise<AuthClient | null>;
  timeoutMs: number;
  onChange(snapshot: AuthSessionSnapshot): void;
  onSignedOut?(verifiedSubject?: string): void;
}) {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 30_000)
    throw new TypeError("Invalid authentication timeout");
  let active = true, generation = 0;
  let auth: AuthPort | null = null, unsubscribe: (() => void) | null = null;
  let rpc: SupabaseClient["rpc"] | null = null;
  const clock = globalThis.performance?.now?.bind(globalThis.performance) ?? (() => Number.NaN);
  type Operation = { generation: number; startedAt: number; abort: AbortController; timer: ReturnType<typeof setTimeout>; task?: ReturnType<typeof setTimeout> };
  let pending: Operation | null = null;
  const current = (operation: Operation) => active && pending === operation && generation === operation.generation && !operation.abort.signal.aborted;
  const publish = (session: Session | null, loading: boolean, error: AuthSessionError | null, deletionStatusIdentity?: DeletionStatusIdentity) => {
    if (active) options.onChange(Object.freeze({ session, loading, error, ...(deletionStatusIdentity ? { deletionStatusIdentity } : {}) }));
  };
  function retire() {
    const operation = pending; pending = null; generation++;
    if (operation) { clearTimeout(operation.timer); if (operation.task !== undefined) clearTimeout(operation.task); operation.abort.abort(); }
  }
  function finish(operation: Operation, session: Session | null, error: AuthSessionError | null, verifiedSubject?: string, deletionStatusIdentity?: DeletionStatusIdentity) {
    if (!current(operation)) return;
    const elapsed = clock() - operation.startedAt;
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= options.timeoutMs) {
      session = null; error = "unavailable"; verifiedSubject = undefined; deletionStatusIdentity = undefined;
    }
    retire(); publish(session, false, error, deletionStatusIdentity);
    if (error === "invalid-session") options.onSignedOut?.(verifiedSubject);
  }
  function begin(): Operation {
    retire();
    const operation: Operation = { generation, startedAt: clock(), abort: new AbortController(), timer: setTimeout(() => {
      finish(operation, null, "unavailable");
    }, options.timeoutMs) };
    pending = operation;
    publish(null, true, null);
    return operation;
  }
  async function wait<T>(value: PromiseLike<T>, operation: Operation): Promise<T> {
    if (!current(operation)) throw new Error("Authentication interrupted");
    const signal = operation.abort.signal;
    let abort = () => {};
    const interrupted = new Promise<never>((_resolve, reject) => {
      abort = () => reject(new Error("Authentication interrupted"));
      signal.addEventListener("abort", abort, { once: true });
    });
    try { return await Promise.race([value, interrupted]); }
    finally { signal.removeEventListener("abort", abort); }
  }
  async function verify(candidate: Session | null, operation: Operation) {
    try {
      if (!current(operation)) return;
      if (!candidate) { finish(operation, null, null); return; }
      if (!auth || typeof candidate.access_token !== "string" || candidate.access_token.length < 1 || candidate.access_token.length > 8192
        || /[\s\u0000-\u001f\u007f]/u.test(candidate.access_token) || !candidate.user || !uuid.test(candidate.user.id)) {
        finish(operation, null, "invalid-session"); return;
      }
      const captured = { ...candidate }, token = captured.access_token, subject = captured.user.id;
      const result = await wait(auth.getUser(token), operation);
      if (!current(operation)) return;
      const user = result.data.user ? { ...result.data.user } : null;
      if (result.error || !user || user.id !== subject || user.is_anonymous === true) {
        const status = result.error?.status;
        finish(operation, null, result.error && (status === undefined || status >= 500) ? "unavailable" : "invalid-session"); return;
      }
      if (!rpc) { finish(operation, null, "unavailable"); return; }
      // Installed PostgREST/Supabase fetch preserves explicit Authorization.
      // Its mutable SDK session cannot substitute a different account's token.
      const live = await wait(rpc("planet_reader_session_active", {}).setHeader("Authorization", `Bearer ${token}`)
        .abortSignal(operation.abort.signal), operation);
      if (!current(operation)) return;
      if (live.error || live.data !== true) {
        const denied = !live.error && live.data === false;
        // This identity is only for the existing server deletion-status read.
        // That route independently validates its actual live session and may
        // recover an accepted receipt. It never reaches private hooks/payments.
        finish(operation, null, denied ? "invalid-session" : "unavailable", denied ? subject : undefined,
          denied ? Object.freeze({ subject, token, scope: Object.freeze({}) }) : undefined);
        return;
      }
      finish(operation, { ...captured, access_token: token, user }, null);
    } catch { if (current(operation)) finish(operation, null, "unavailable"); }
  }
  function accept(candidate: Session | null) {
    if (!active) return;
    const operation = begin();
    if (!current(operation)) return;
    if (!candidate) { finish(operation, null, null); return; }
    operation.task = setTimeout(() => { operation.task = undefined; void verify(candidate, operation); }, 0);
  }
  async function lookup() {
    if (!active) return;
    const operation = begin();
    if (!current(operation)) return;
    try {
      if (!auth) {
        const client = await wait(options.loadClient(), operation);
        if (!current(operation)) return;
        if (!client) { finish(operation, null, "unavailable"); return; }
        auth = client.auth;
        rpc = typeof client.rpc === "function" ? client.rpc.bind(client) as SupabaseClient["rpc"] : null;
        const listener = auth.onAuthStateChange((event, session) => {
          accept(session);
          if (event === "SIGNED_OUT") options.onSignedOut?.();
        });
        unsubscribe = () => listener.data.subscription.unsubscribe();
        if (!active) { unsubscribe(); unsubscribe = null; return; }
        if (!current(operation)) return;
      }
      const restored = await wait(auth.getSession(), operation);
      if (!current(operation)) return;
      if (restored.error) { finish(operation, null, "unavailable"); return; }
      await verify(restored.data.session, operation);
    } catch { if (current(operation)) finish(operation, null, "unavailable"); }
  }
  void lookup();
  return Object.freeze({
    retry(): void { if (active) void lookup(); },
    dispose(): void { if (!active) return; active = false; retire(); unsubscribe?.(); unsubscribe = null; auth = null; rpc = null; },
  });
}
