import type { SupabaseClient } from "@supabase/supabase-js";

export type RecoveryIdentity = { subject: string; accessToken: string };
type RecoveryAuth = Pick<SupabaseClient["auth"], "getClaims" | "getUser" | "getSession" | "onAuthStateChange" | "resetPasswordForEmail" | "signOut">;
export type PasswordRecoveryReason = "unavailable" | "recovery-required" | "changed" | "invalid-email" | "invalid-password" | "captcha-required" | "updated-signout-incomplete";
export class PasswordRecoveryError extends Error {
  constructor(readonly reason: PasswordRecoveryReason) { super(reason); this.name = "PasswordRecoveryError"; }
}
export interface PasswordRecoveryOptions {
  auth: RecoveryAuth;
  projectUrl: string;
  publishableKey: string;
  siteOrigin: string;
  currentIdentity: () => RecoveryIdentity | null;
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
function canonicalOrigin(value: string): string {
  const url = new URL(value);
  if (url.origin !== value || url.protocol !== "https:" || url.username || url.password) throw new PasswordRecoveryError("unavailable");
  return url.origin;
}
export function recoveryRedirectUrl(siteOrigin: string, language: "ru" | "en"): string {
  if (language !== "ru" && language !== "en") throw new PasswordRecoveryError("unavailable");
  return `${canonicalOrigin(siteOrigin)}/${language}/planet-account/?recovery=1`;
}
export function hasRecoveryPresentationHint(search: string): boolean {
  const values = new URLSearchParams(search).getAll("recovery");
  return values.length === 1 && values[0] === "1";
}
function currentMatches(identity: RecoveryIdentity, current: RecoveryIdentity | null): boolean {
  return current?.subject === identity.subject && current.accessToken === identity.accessToken;
}

/** Uses the existing canonical Auth client only. No session is created or stored
 * here, and neither a URL marker nor locally decoded claims authorize a reset. */
export function createPasswordRecoveryService(options: PasswordRecoveryOptions) {
  const project = canonicalOrigin(options.projectUrl);
  const siteOrigin = canonicalOrigin(options.siteOrigin);
  const publicKey = options.publishableKey;
  if (typeof publicKey !== "string" || !publicKey || publicKey.length > 8192 || /[\s\u0000-\u001f\u007f]/u.test(publicKey)
    || publicKey.startsWith("sb_secret_")) throw new PasswordRecoveryError("unavailable");
  const auth = options.auth; const current = options.currentIdentity;
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const now = options.now ?? Date.now; const timeoutMs = options.timeoutMs ?? 10000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new PasswordRecoveryError("unavailable");

  function operation(signal?: AbortSignal) {
    const controller = new AbortController();
    let reason: PasswordRecoveryReason = "changed";
    const cancel = () => controller.abort();
    if (signal?.aborted) cancel(); else signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(() => { reason = "unavailable"; controller.abort(); }, timeoutMs);
    function assert() { if (controller.signal.aborted) throw new PasswordRecoveryError(reason); }
    async function wait<T>(promise: PromiseLike<T>): Promise<T> {
      assert();
      let rejectAbort: () => void = () => undefined;
      const interrupted = new Promise<never>((_resolve, reject) => {
        rejectAbort = () => reject(new PasswordRecoveryError(reason));
        controller.signal.addEventListener("abort", rejectAbort, { once: true });
      });
      try { return await Promise.race([promise, interrupted]); }
      finally { controller.signal.removeEventListener("abort", rejectAbort); }
    }
    return { signal: controller.signal, assert, wait, cancel,
      close() { clearTimeout(timer); signal?.removeEventListener("abort", cancel); } };
  }

  async function requestEmail(email: string, language: "ru" | "en", captchaToken: string | undefined, captchaRequired: boolean, signal?: AbortSignal): Promise<void> {
    const normalized = email.trim();
    if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) throw new PasswordRecoveryError("invalid-email");
    if (captchaRequired && !captchaToken) throw new PasswordRecoveryError("captcha-required");
    const op = operation(signal);
    try {
      op.assert();
      const result = await op.wait(auth.resetPasswordForEmail(normalized, { redirectTo: recoveryRedirectUrl(siteOrigin, language), ...(captchaToken ? { captchaToken } : {}) }));
      op.assert(); if (result.error) throw new PasswordRecoveryError("unavailable");
      // Deliberately does not claim that an account exists or an email arrived.
    } catch (error) { throw error instanceof PasswordRecoveryError ? error : new PasswordRecoveryError("unavailable"); }
    finally { op.close(); }
  }

  async function changePassword(password: string, confirmation: string, signal?: AbortSignal): Promise<void> {
    if (password.length < 10 || password.length > 1024 || password !== confirmation) throw new PasswordRecoveryError("invalid-password");
    const candidate = current();
    if (!candidate || !UUID.test(candidate.subject) || typeof candidate.accessToken !== "string" || candidate.accessToken.length > 8192
      || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(candidate.accessToken)) throw new PasswordRecoveryError("recovery-required");
    const identity = { ...candidate }; const op = operation(signal); let updated = false;
    const listener = auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== identity.subject || session.access_token !== identity.accessToken) op.cancel();
    });
    let listening = true;
    const stop = () => { if (listening) { listening = false; listener.data.subscription.unsubscribe(); } };
    function assert() {
      op.assert(); if (!currentMatches(identity, current())) throw new PasswordRecoveryError("changed");
    }
    try {
      assert();
      const [claimsResult, userResult] = await op.wait(Promise.all([auth.getClaims(identity.accessToken), auth.getUser(identity.accessToken)]));
      assert();
      const claims = claimsResult.data?.claims; const user = userResult.data.user;
      const time = Math.floor(now() / 1000);
      if (claimsResult.error || userResult.error || !claims || !user || user.id !== identity.subject || user.is_anonymous === true
        || claims.sub !== identity.subject || claims.iss !== project + "/auth/v1" || claims.aud !== "authenticated" || claims.role !== "authenticated"
        || claims.is_anonymous === true || typeof claims.session_id !== "string" || !UUID.test(claims.session_id)
        || !Number.isSafeInteger(time) || !Number.isSafeInteger(claims.exp) || claims.exp <= time
        || !Number.isSafeInteger(claims.iat) || claims.iat > time || claims.iat >= claims.exp
        || (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > time))
        || !Array.isArray(claims.amr) || !claims.amr.some(value => value !== null && typeof value === "object" && value.method === "recovery" && Number.isSafeInteger(value.timestamp) && value.timestamp > 0 && value.timestamp <= claims.iat)) {
        throw new PasswordRecoveryError("recovery-required");
      }
      // Also fence the SDK's current session, which can change before React
      // publishes the AuthContext update.
      const session = await op.wait(auth.getSession()); assert();
      if (session.error || session.data.session?.user.id !== identity.subject || session.data.session.access_token !== identity.accessToken) throw new PasswordRecoveryError("changed");
      const headers = { apikey: publicKey, Authorization: `Bearer ${identity.accessToken}`, "Content-Type": "application/json" };
      assert();
      // updateUser() reads a mutable SDK session after awaiting its lock. This
      // exact-token request cannot accidentally change a replacement account.
      const response = await op.wait(fetcher(project + "/auth/v1/user", { method: "PUT", headers, body: JSON.stringify({ password }), credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal: op.signal }));
      if (response.status !== 200 || response.redirected) { void response.body?.cancel().catch(() => undefined); throw new PasswordRecoveryError("unavailable"); }
      updated = true;
      // The authoritative success status is sufficient; never retain or expose
      // the returned user metadata, password or an upstream diagnostic body.
      void response.body?.cancel().catch(() => undefined);
      assert();
      const logout = await op.wait(fetcher(project + "/auth/v1/logout?scope=global", { method: "POST", headers, credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal: op.signal }));
      void logout.body?.cancel().catch(() => undefined);
      if (![200, 204].includes(logout.status) || logout.redirected) throw new PasswordRecoveryError("updated-signout-incomplete");
      assert(); stop();
      // Clear the existing canonical provider/session after the same account's
      // global revocation. No separate recovery session store is introduced.
      const local = await op.wait(auth.signOut({ scope: "local" }));
      if (local.error) throw new PasswordRecoveryError("updated-signout-incomplete");
    } catch (error) {
      if (updated) throw new PasswordRecoveryError("updated-signout-incomplete");
      throw error instanceof PasswordRecoveryError ? error : new PasswordRecoveryError("unavailable");
    } finally { stop(); op.close(); }
  }
  return { requestEmail, changePassword };
}
