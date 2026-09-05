import { beforeAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createPasswordRecoveryService, hasRecoveryPresentationHint, PasswordRecoveryError, recoveryRedirectUrl, type PasswordRecoveryOptions, type RecoveryIdentity } from "./passwordRecovery";
import { passwordRecoveryCopy } from "./passwordRecoveryCopy";

const project = "https://canonical-fixture.supabase.co";
const site = "https://probpera.ru";
const subject = "123e4567-e89b-42d3-a456-426614174000";
const otherSubject = "223e4567-e89b-42d3-a456-426614174000";
const sessionId = "323e4567-e89b-42d3-a456-426614174000";
const now = Math.floor(Date.now() / 1000);
const password = "new-test-password";
const publicKey = "sb_publishable_fixture_only";
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
let key: CryptoKey; let jwk: JsonWebKey; let token: string;
const verifier = createClient(project, publicKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const claims = () => ({ iss: project + "/auth/v1", aud: "authenticated", sub: subject, session_id: sessionId, iat: now - 10, exp: now + 600,
  role: "authenticated", aal: "aal1", amr: [{ method: "recovery", timestamp: now - 10 }], is_anonymous: false });
async function signed(change: Record<string, unknown> = {}) {
  const payload = encode({ alg: "ES256", kid: "recovery-test", typ: "JWT" }) + "." + encode({ ...claims(), ...change });
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(payload));
  return payload + "." + Buffer.from(signature).toString("base64url");
}
beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  key = pair.privateKey; jwk = { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: "recovery-test", alg: "ES256" } as JsonWebKey;
  token = await signed();
});
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };

function fixture(accessToken = token) {
  let current: RecoveryIdentity | null = { subject, accessToken };
  let callback: ((event: string, session: unknown) => void) | null = null;
  const unsubscribe = vi.fn(() => { callback = null; });
  const getClaims = vi.fn((jwt: string) => verifier.auth.getClaims(jwt, { jwks: { keys: [jwk as never] } }));
  const getUser = vi.fn(async () => ({ data: { user: { id: subject, is_anonymous: false } }, error: null }));
  const getSession = vi.fn(async () => ({ data: { session: current ? { access_token: current.accessToken, user: { id: current.subject } } : null }, error: null }));
  const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }));
  const signOut = vi.fn(async () => { current = null; return { error: null }; });
  const onAuthStateChange = vi.fn((handler: typeof callback) => { callback = handler; return { data: { subscription: { unsubscribe } } }; });
  const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => new Response(init?.method === "PUT" ? JSON.stringify({ id: subject }) : null, { status: init?.method === "PUT" ? 200 : 204 }));
  const auth = { getClaims, getUser, getSession, onAuthStateChange, resetPasswordForEmail, signOut };
  const options: PasswordRecoveryOptions = { projectUrl: project, siteOrigin: site, publishableKey: publicKey, auth: auth as unknown as PasswordRecoveryOptions["auth"], currentIdentity: () => current, fetch, now: () => now * 1000 };
  return { options, service: createPasswordRecoveryService(options), auth, fetch, unsubscribe,
    switch(value: RecoveryIdentity | null, emit = false) { current = value; if (emit) callback?.("SIGNED_IN", value ? { access_token: value.accessToken, user: { id: value.subject } } : null); } };
}

describe("canonical recovery email and presentation", () => {
  it.each(["ru", "en"] as const)("builds the exact safe %s recovery redirect", language => {
    expect(recoveryRedirectUrl(site, language)).toBe(site + `/${language}/planet-account/?recovery=1`);
  });
  it.each(["http://probpera.ru", "https://probpera.ru/", "https://user@probpera.ru", "https://probpera.ru/?next=https://bad.test", "javascript:alert(1)"])("refuses unsafe origin %s", origin => {
    expect(() => recoveryRedirectUrl(origin, "en")).toThrow(PasswordRecoveryError);
  });
  it("treats a query marker as presentation only and rejects ambiguous duplicate hints", () => {
    expect(hasRecoveryPresentationHint("?recovery=1")).toBe(true);
    for (const search of ["", "?recovery=true", "?recovery=1&recovery=0"]) expect(hasRecoveryPresentationHint(search)).toBe(false);
    const env = fixture(); env.switch(null);
    return expect(env.service.changePassword(password, password)).rejects.toMatchObject({ reason: "recovery-required" });
  });
  it("uses canonical SDK reset with explicit one-use CAPTCHA and does not query account existence", async () => {
    const env = fixture();
    await env.service.requestEmail(" reader@example.test ", "en", "captcha-one-use", true);
    expect(env.auth.resetPasswordForEmail).toHaveBeenCalledWith("reader@example.test", { redirectTo: site + "/en/planet-account/?recovery=1", captchaToken: "captcha-one-use" });
    expect(env.auth.getUser).not.toHaveBeenCalled(); expect(env.fetch).not.toHaveBeenCalled();
  });
  it("rejects missing CAPTCHA and invalid email before any reset request", async () => {
    const env = fixture();
    await expect(env.service.requestEmail("reader@example.test", "ru", undefined, true)).rejects.toMatchObject({ reason: "captcha-required" });
    await expect(env.service.requestEmail("broken address", "ru", undefined, false)).rejects.toMatchObject({ reason: "invalid-email" });
    expect(env.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it("does not reflect upstream errors or claim delivery", async () => {
    const env = fixture(); env.auth.resetPasswordForEmail.mockRejectedValueOnce(new Error("SECRET DIAGNOSTIC"));
    await expect(env.service.requestEmail("reader@example.test", "ru", undefined, false)).rejects.toMatchObject({ message: "unavailable" });
  });
  it("keeps both locale dictionaries complete and explicitly unreviewed", () => {
    expect(passwordRecoveryCopy.reviewStatus).toBe("draft"); expect(passwordRecoveryCopy.productionReady).toBe(false);
    expect(Object.keys(passwordRecoveryCopy.locales.ru)).toEqual(Object.keys(passwordRecoveryCopy.locales.en));
    expect(Object.keys(passwordRecoveryCopy.locales.ru.errors)).toEqual(Object.keys(passwordRecoveryCopy.locales.en.errors));
  });
});

describe("verified exact-token password update", () => {
  it("verifies a genuine signature/current identity and updates only its fixed Auth endpoint before global logout", async () => {
    const env = fixture(); await env.service.changePassword(password, password);
    expect(env.auth.getClaims).toHaveBeenCalledWith(token); expect(env.auth.getUser).toHaveBeenCalledWith(token);
    expect(env.auth.getSession).toHaveBeenCalledOnce(); expect(env.fetch).toHaveBeenCalledTimes(2);
    const [url, init] = env.fetch.mock.calls[0]; expect(url).toBe(project + "/auth/v1/user");
    expect(init).toMatchObject({ method: "PUT", body: JSON.stringify({ password }), credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer" });
    expect(new Headers(init!.headers).get("authorization")).toBe("Bearer " + token);
    expect(new Headers(init!.headers).get("apikey")).toBe(publicKey);
    expect(env.fetch.mock.calls[1][0]).toBe(project + "/auth/v1/logout?scope=global");
    expect(env.auth.signOut).toHaveBeenCalledWith({ scope: "local" }); expect(env.unsubscribe).toHaveBeenCalledOnce();
  });
  it.each([
    { amr: [{ method: "password", timestamp: now - 10 }] }, { amr: [] }, { amr: [{ method: "recovery", timestamp: now + 10 }] },
    { exp: now }, { iat: now + 1 }, { nbf: now + 1 }, { iss: "https://wrong.supabase.co/auth/v1" }, { aud: "anon" },
    { role: "service_role" }, { sub: otherSubject }, { session_id: "not-a-session" }, { is_anonymous: true },
  ])("never writes for a signed but inapplicable recovery claim %#", async changed => {
    const env = fixture(await signed(changed));
    await expect(env.service.changePassword(password, password)).rejects.toMatchObject({ reason: "recovery-required" });
    expect(env.fetch).not.toHaveBeenCalled(); expect(env.auth.signOut).not.toHaveBeenCalled();
  });
  it("rejects a forged signature even if local identity matches", async () => {
    const parts = token.split("."); parts[2] = (parts[2][0] === "a" ? "b" : "a") + parts[2].slice(1);
    const env = fixture(parts.join("."));
    await expect(env.service.changePassword(password, password)).rejects.toMatchObject({ reason: "recovery-required" });
    expect(env.fetch).not.toHaveBeenCalled();
  });
  it("requires current server user to match the signed recovery subject", async () => {
    const env = fixture(); env.auth.getUser.mockResolvedValueOnce({ data: { user: { id: otherSubject, is_anonymous: false } }, error: null });
    await expect(env.service.changePassword(password, password)).rejects.toMatchObject({ reason: "recovery-required" });
    expect(env.fetch).not.toHaveBeenCalled();
  });
  it.each([["short", "short"], [password, "different-password"], ["a".repeat(1025), "a".repeat(1025)]])("rejects invalid password input before authentication", async (value, confirmation) => {
    const env = fixture(); await expect(env.service.changePassword(value, confirmation)).rejects.toMatchObject({ reason: "invalid-password" });
    expect(env.auth.getClaims).not.toHaveBeenCalled(); expect(env.fetch).not.toHaveBeenCalled();
  });
  it("blocks a replacement SDK session even while React still exposes the original identity", async () => {
    const env = fixture(); env.auth.getSession.mockResolvedValueOnce({ data: { session: { access_token: "replacement", user: { id: otherSubject } } }, error: null });
    await expect(env.service.changePassword(password, password)).rejects.toMatchObject({ reason: "changed" });
    expect(env.fetch).not.toHaveBeenCalled();
  });
  it("cancels pending verification immediately on a canonical auth event", async () => {
    const env = fixture(); const pending = deferred<Awaited<ReturnType<typeof env.auth.getUser>>>();
    env.auth.getUser.mockReturnValueOnce(pending.promise);
    const result = env.service.changePassword(password, password);
    env.switch({ subject: otherSubject, accessToken: "replacement" }, true);
    await expect(result).rejects.toMatchObject({ reason: "changed" });
    pending.resolve({ data: { user: { id: subject, is_anonymous: false } }, error: null });
    expect(env.fetch).not.toHaveBeenCalled(); expect(env.unsubscribe).toHaveBeenCalledOnce();
  });
  it("never substitutes a replacement account's bearer during an in-flight password update", async () => {
    const env = fixture(); const pending = deferred<Response>(); const began = deferred<void>();
    env.fetch.mockImplementationOnce(async () => { began.resolve(); return pending.promise; });
    const result = env.service.changePassword(password, password); await began.promise;
    env.switch({ subject: otherSubject, accessToken: "replacement" }, true);
    await expect(result).rejects.toMatchObject({ reason: "changed" });
    expect(new Headers(env.fetch.mock.calls[0][1]!.headers).get("authorization")).toBe("Bearer " + token);
    expect(env.fetch.mock.calls[0][1]!.signal!.aborted).toBe(true); expect(env.auth.signOut).not.toHaveBeenCalled();
    pending.resolve(new Response(null, { status: 200 }));
  });
  it("reports a confirmed update separately when global sign-out fails", async () => {
    const env = fixture(); env.fetch.mockResolvedValueOnce(new Response(null, { status: 200 })).mockResolvedValueOnce(new Response("PRIVATE", { status: 503 }));
    await expect(env.service.changePassword(password, password)).rejects.toMatchObject({ reason: "updated-signout-incomplete" });
    expect(env.auth.signOut).not.toHaveBeenCalled();
  });
  it("does not locally sign out a replacement account after global revocation is pending", async () => {
    const env = fixture(); const pending = deferred<Response>(); const began = deferred<void>();
    env.fetch.mockResolvedValueOnce(new Response(null, { status: 200 })).mockImplementationOnce(async () => { began.resolve(); return pending.promise; });
    const result = env.service.changePassword(password, password); await began.promise;
    env.switch({ subject: otherSubject, accessToken: "replacement" }); pending.resolve(new Response(null, { status: 204 }));
    await expect(result).rejects.toMatchObject({ reason: "updated-signout-incomplete" });
    expect(env.auth.signOut).not.toHaveBeenCalled();
  });
  it("sanitizes a password update failure without falsely reporting success", async () => {
    const env = fixture(); env.fetch.mockResolvedValueOnce(new Response("PRIVATE PASSWORD DIAGNOSTIC", { status: 400 }));
    await expect(env.service.changePassword(password, password)).rejects.toMatchObject({ message: "unavailable" });
    expect(env.fetch).toHaveBeenCalledOnce(); expect(env.auth.signOut).not.toHaveBeenCalled();
  });
  it("does nothing after a pre-aborted request", async () => {
    const env = fixture(); const controller = new AbortController(); controller.abort();
    await expect(env.service.changePassword(password, password, controller.signal)).rejects.toMatchObject({ reason: "changed" });
    expect(env.auth.getClaims).not.toHaveBeenCalled(); expect(env.fetch).not.toHaveBeenCalled();
  });
  it("bounds a stalled SDK verification and disposes the listener", async () => {
    const env = fixture(); const pending = deferred<Awaited<ReturnType<typeof env.auth.getUser>>>(); env.auth.getUser.mockReturnValueOnce(pending.promise);
    const service = createPasswordRecoveryService({ ...env.options, timeoutMs: 5 });
    await expect(service.changePassword(password, password)).rejects.toMatchObject({ reason: "unavailable" });
    expect(env.unsubscribe).toHaveBeenCalledOnce(); expect(env.fetch).not.toHaveBeenCalled();
    pending.resolve({ data: { user: { id: subject, is_anonymous: false } }, error: null });
  });
});
