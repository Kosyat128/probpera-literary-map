import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session, SupabaseClient, User } from "@supabase/supabase-js";
import { observeCanonicalAuthSession, type AuthSessionSnapshot } from "./authSession";
const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222";
const session = (subject = a, token = "synthetic.access.token"): Session => ({ access_token: token, refresh_token: "synthetic-refresh",
  expires_in: 3600, token_type: "bearer", user: { id: subject, aud: "authenticated", created_at: "2026-10-02T00:00:00Z", app_metadata: {}, user_metadata: {} } });
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
function fixture() {
  const updates: AuthSessionSnapshot[] = [], unsubscribe = vi.fn();
  let handler: ((event: AuthChangeEvent, value: Session | null) => void) | undefined;
  const getSession = vi.fn(async (): Promise<{ data: { session: Session | null }; error: object | null }> => ({ data: { session: session() }, error: null }));
  const getUser = vi.fn(async (_token: string): Promise<{ data: { user: User | null }; error: { status?: number; message?: string } | null }> => ({ data: { user: session().user }, error: null }));
  const onAuthStateChange = vi.fn((callback: typeof handler) => { handler = callback; return { data: { subscription: { unsubscribe } } }; });
  const auth = { getSession, getUser, onAuthStateChange } as unknown as Pick<SupabaseClient["auth"], "getSession" | "getUser" | "onAuthStateChange">;
  const getLiveSession = vi.fn(async (): Promise<{ data: unknown; error: object | null }> => ({ data: true, error: null }));
  const queries: Array<{ setHeader: ReturnType<typeof vi.fn>; abortSignal: ReturnType<typeof vi.fn> }> = [];
  const rpc = vi.fn((_name: string, _arguments: object) => {
    const builder = { setHeader: vi.fn((_name: string, _value: string) => builder), abortSignal: vi.fn((_signal: AbortSignal) => builder),
      then: (done: (value: Awaited<ReturnType<typeof getLiveSession>>) => unknown, fail: (reason: unknown) => unknown) => getLiveSession().then(done, fail) };
    queries.push(builder); return builder;
  }) as unknown as SupabaseClient["rpc"];
  const loadClient = vi.fn(async () => ({ auth, rpc }));
  return { updates, getSession, getUser, getLiveSession, queries, rpc, loadClient, unsubscribe, auth,
    publish: (value: Session | null, event: AuthChangeEvent = value ? "SIGNED_IN" : "SIGNED_OUT") => handler?.(event, value),
    start: () => observeCanonicalAuthSession({ loadClient, timeoutMs: 100, onChange: value => updates.push(value) }) };
}
const settle = async () => { for (let index = 0; index < 24; index++) await Promise.resolve(); };
afterEach(() => vi.useRealTimers());
describe("canonical verified session observation", () => {
  it("verifies an exact cached token and replaces cached user metadata with canonical Auth", async () => {
    const f = fixture();
    f.getUser.mockResolvedValue({ data: { user: { ...session().user, email: "synthetic-verified@example.test" } }, error: null });
    const observer = f.start(); await settle();
    expect(f.getUser).toHaveBeenCalledWith("synthetic.access.token");
    expect(f.rpc).toHaveBeenCalledWith("planet_reader_session_active", {});
    expect(f.queries[0].setHeader).toHaveBeenCalledWith("Authorization", "Bearer synthetic.access.token");
    expect(f.updates[f.updates.length - 1]).toMatchObject({ loading: false, error: null, session: { user: { email: "synthetic-verified@example.test" } } });
    expect(f.updates[0]).toEqual({ session: null, loading: true, error: null });
    observer.dispose();
  });
  it("never lets an initial cached read overwrite a newer signout", async () => {
    const f = fixture(), old = deferred<Awaited<ReturnType<typeof f.getSession>>>();
    f.getSession.mockImplementationOnce(() => old.promise);
    const observer = f.start(); await settle(); f.publish(null);
    old.resolve({ data: { session: session() }, error: null }); await settle();
    expect(f.updates[f.updates.length - 1]).toEqual({ session: null, loading: false, error: null });
    expect(f.getUser).not.toHaveBeenCalled(); observer.dispose();
  });
  it("defers SDK calls outside the synchronous auth notification", async () => {
    vi.useFakeTimers(); const f = fixture(), observer = f.start(); await settle();
    const before = f.getUser.mock.calls.length;
    f.publish(session(a, "synthetic.refreshed.token"), "TOKEN_REFRESHED");
    expect(f.getUser).toHaveBeenCalledTimes(before);
    expect(f.updates[f.updates.length - 1]).toEqual({ session: null, loading: true, error: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.getUser).toHaveBeenLastCalledWith("synthetic.refreshed.token"); observer.dispose();
  });
  it("rejects stale A verification after B and even an equal-value A return", async () => {
    vi.useFakeTimers(); const f = fixture(), old = deferred<Awaited<ReturnType<typeof f.getUser>>>();
    f.getUser.mockImplementationOnce(() => old.promise);
    const observer = f.start(); await settle();
    f.publish(session(b, "synthetic.other.token")); f.getUser.mockResolvedValueOnce({ data: { user: session(b).user }, error: null });
    await vi.advanceTimersByTimeAsync(0); expect(f.updates[f.updates.length - 1]?.session?.user.id).toBe(b);
    f.publish(session()); await vi.advanceTimersByTimeAsync(0);
    const before = f.updates.length;
    old.resolve({ data: { user: session().user }, error: null }); await settle();
    expect(f.updates).toHaveLength(before); expect(f.updates[f.updates.length - 1]?.session?.user.id).toBe(a); observer.dispose();
  });
  it("ignores an old rejection after the current session is verified", async () => {
    vi.useFakeTimers(); const f = fixture(), old = deferred<Awaited<ReturnType<typeof f.getUser>>>();
    f.getUser.mockImplementationOnce(() => old.promise);
    const observer = f.start(); await settle(); f.publish(session()); await vi.advanceTimersByTimeAsync(0);
    old.reject(new Error("SYNTHETIC PRIVATE DIAGNOSTIC")); await settle();
    expect(f.updates[f.updates.length - 1]).toMatchObject({ error: null, loading: false, session: { user: { id: a } } }); observer.dispose();
  });
  it.each(["missing", "other-user", "anonymous", "revoked"] as const)("does not publish %s canonical user", async type => {
    const f = fixture();
    const user = type === "missing" || type === "revoked" ? null : type === "other-user" ? session(b).user : { ...session().user, is_anonymous: true };
    f.getUser.mockResolvedValue({ data: { user }, error: type === "revoked" ? { status: 401, message: "SYNTHETIC PRIVATE DIAGNOSTIC" } : null } as Awaited<ReturnType<typeof f.getUser>>);
    const observer = f.start(); await settle();
    expect(f.updates[f.updates.length - 1]).toEqual({ session: null, loading: false, error: "invalid-session" });
    expect(JSON.stringify(f.updates)).not.toContain("PRIVATE DIAGNOSTIC"); observer.dispose();
  });
  it("bounds a hung load and safely ignores the eventual client", async () => {
    vi.useFakeTimers(); const f = fixture(), late = deferred<Awaited<ReturnType<typeof f.loadClient>>>(); f.loadClient.mockImplementationOnce(() => late.promise);
    const observer = f.start(); await vi.advanceTimersByTimeAsync(100);
    expect(f.updates[f.updates.length - 1]).toEqual({ session: null, loading: false, error: "unavailable" });
    late.resolve({ auth: f.auth, rpc: f.rpc }); await settle(); expect(f.getSession).not.toHaveBeenCalled(); observer.dispose();
  });
  it("bounds lookup and verification without trusting late success", async () => {
    for (const stage of ["getSession", "getUser"] as const) {
      vi.useFakeTimers(); const f = fixture(), late = deferred<never>(); f[stage].mockImplementationOnce(() => late.promise);
      const observer = f.start(); await settle(); await vi.advanceTimersByTimeAsync(100);
      expect(f.updates[f.updates.length - 1]).toEqual({ session: null, loading: false, error: "unavailable" });
      late.reject(new Error("synthetic late rejection")); await settle(); observer.dispose(); vi.useRealTimers();
    }
  });
  it("keeps network failure local to Auth and allows explicit bounded retry", async () => {
    const f = fixture(); f.getUser.mockRejectedValueOnce(new Error("synthetic network failure"));
    const observer = f.start(); await settle(); expect(f.updates[f.updates.length - 1]).toEqual({ session: null, loading: false, error: "unavailable" });
    observer.retry(); await settle(); expect(f.updates[f.updates.length - 1]).toMatchObject({ error: null, session: { user: { id: a } } }); observer.dispose();
  });
  it("does not verify malformed candidates or anonymous restoration", async () => {
    for (const candidate of [session("../other"), { ...session(), access_token: "bad\nheader" }, { ...session(), access_token: "" }]) {
      const f = fixture(); f.getSession.mockResolvedValue({ data: { session: candidate }, error: null }); const observer = f.start(); await settle();
      expect(f.updates[f.updates.length - 1]).toEqual({ session: null, loading: false, error: "invalid-session" }); expect(f.getUser).not.toHaveBeenCalled(); observer.dispose();
    }
  });
  it("disposes subscriptions and prevents late verification or retry from publishing", async () => {
    const f = fixture(), late = deferred<Awaited<ReturnType<typeof f.getUser>>>(); f.getUser.mockImplementationOnce(() => late.promise);
    const observer = f.start(); await settle(); observer.dispose(); const count = f.updates.length;
    late.resolve({ data: { user: session().user }, error: null }); observer.retry(); f.publish(session()); await settle();
    expect(f.updates).toHaveLength(count); expect(f.unsubscribe).toHaveBeenCalledTimes(1);
  });
  it("handles synchronous initial notification without a duplicate cached lookup", async () => {
    vi.useFakeTimers(); const f = fixture();
    f.auth.onAuthStateChange = vi.fn((callback: Parameters<typeof f.auth.onAuthStateChange>[0]) => { callback("INITIAL_SESSION", session()); return { data: { subscription: { id: "synthetic-initial-subscription", callback, unsubscribe: f.unsubscribe } } }; });
    const observer = f.start(); await settle(); await vi.advanceTimersByTimeAsync(0);
    expect(f.getSession).not.toHaveBeenCalled(); expect(f.getUser).toHaveBeenCalledTimes(1); observer.dispose();
  });
});


it("canonical signed-out notification seals privacy synchronously without another SDK call", async () => {
  const f = fixture(), onSignedOut = vi.fn();
  const observer = observeCanonicalAuthSession({ loadClient: f.loadClient, timeoutMs: 100, onChange: value => f.updates.push(value), onSignedOut });
  await settle(); const verified = f.getUser.mock.calls.length;
  f.publish(null); expect(onSignedOut).toHaveBeenCalledTimes(1); expect(f.updates[f.updates.length - 1]?.session).toBeNull();
  expect(f.getUser).toHaveBeenCalledTimes(verified); observer.dispose();
});


it.each([false, "true", { approved: true }])("does not publish cached identity when live-session RPC returns %j", async data => {
  const f = fixture(), onSignedOut = vi.fn(); f.getLiveSession.mockResolvedValue({ data, error: null });
  const observer = observeCanonicalAuthSession({ loadClient: f.loadClient, timeoutMs: 100, onChange: value => f.updates.push(value), onSignedOut });
  await settle(); expect(f.getUser).toHaveBeenCalled(); expect(f.updates[f.updates.length - 1]).toMatchObject({ session: null, loading: false, error: data === false ? "invalid-session" : "unavailable" });
  if (data === false) expect(f.updates[f.updates.length - 1]?.deletionStatusIdentity).toMatchObject({ subject: a, token: "synthetic.access.token" });
  else expect(f.updates[f.updates.length - 1]?.deletionStatusIdentity).toBeUndefined();
  if (data === false) expect(onSignedOut).toHaveBeenCalledWith(a); else expect(onSignedOut).not.toHaveBeenCalled(); observer.dispose();
});
it("reports unavailable without fallback until the canonical live-session migration is present", async () => {
  const f = fixture(); f.getLiveSession.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
  const observer = f.start(); await settle(); expect(f.updates[f.updates.length - 1]).toEqual({ session: null, loading: false, error: "unavailable" });
  observer.retry(); await settle(); expect(f.updates[f.updates.length - 1]?.session?.user.id).toBe(a); observer.dispose();
});
it("a late live-session proof cannot overwrite a newer account and uses its own exact token", async () => {
  vi.useFakeTimers(); const f = fixture(), old = deferred<Awaited<ReturnType<typeof f.getLiveSession>>>();
  f.getLiveSession.mockReturnValueOnce(old.promise); const observer = f.start(); await settle();
  f.getUser.mockResolvedValueOnce({ data: { user: session(b).user }, error: null }); f.publish(session(b, "synthetic.B.token"));
  await vi.advanceTimersByTimeAsync(0); expect(f.updates[f.updates.length - 1]?.session?.user.id).toBe(b);
  expect(f.queries[f.queries.length - 1]?.setHeader).toHaveBeenCalledWith("Authorization", "Bearer synthetic.B.token");
  const before = f.updates.length; old.resolve({ data: true, error: null }); await settle();
  expect(f.updates).toHaveLength(before); observer.dispose();
});
it("bounds a hung live-session RPC and aborts its captured request before any local identity publication", async () => {
  vi.useFakeTimers(); const f = fixture(), late = deferred<Awaited<ReturnType<typeof f.getLiveSession>>>(); f.getLiveSession.mockReturnValueOnce(late.promise);
  const observer = f.start(); await settle(); const signal = f.queries[0].abortSignal.mock.calls[0][0] as AbortSignal;
  await vi.advanceTimersByTimeAsync(100); expect(signal.aborted).toBe(true);
  expect(f.updates[f.updates.length - 1]).toEqual({ session: null, loading: false, error: "unavailable" });
  late.resolve({ data: true, error: null }); await settle(); expect(f.updates[f.updates.length - 1]?.session).toBeNull(); observer.dispose();
});


it("snapshots the cached token and canonical user before an outstanding live-session proof", async () => {
  vi.useFakeTimers(); const f = fixture(), candidate = session(), canonical = session().user, proof = deferred<Awaited<ReturnType<typeof f.getLiveSession>>>();
  f.getSession.mockResolvedValue({ data: { session: candidate }, error: null });
  f.getUser.mockResolvedValue({ data: { user: canonical }, error: null }); f.getLiveSession.mockReturnValue(proof.promise);
  const observer = f.start(); await settle();
  candidate.access_token = "unverified.B.token"; candidate.refresh_token = "unverified-B-refresh"; candidate.user.id = b; canonical.id = b;
  proof.resolve({ data: true, error: null }); await settle();
  expect(f.updates[f.updates.length - 1]?.session).toMatchObject({ access_token: "synthetic.access.token", refresh_token: "synthetic-refresh", user: { id: a } });
  expect(f.queries[0].setHeader).toHaveBeenCalledWith("Authorization", "Bearer synthetic.access.token"); observer.dispose();
});


it.each([110, 9])("checks the monotonic completion deadline even before timer delivery (clock %s)", async completionTime => {
  let now = 10; const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  const f = fixture(), proof = deferred<Awaited<ReturnType<typeof f.getLiveSession>>>(); f.getLiveSession.mockReturnValue(proof.promise);
  const observer = f.start();
  try {
    await settle(); now = completionTime; proof.resolve({ data: true, error: null }); await settle();
    expect(f.updates[f.updates.length - 1]).toEqual({ session: null, loading: false, error: "unavailable" });
  } finally { observer.dispose(); clock.mockRestore(); }
});
