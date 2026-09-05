import { beforeAll, describe, expect, it } from "vitest";
import { createCanonicalSupabaseServices } from "./supabase";

const subject = "b7d3c04e-a59a-4bda-8db4-4b2f8c573e74";
const sessionId = "c3e02b27-057b-487e-b4f3-6a3b749f9cfa";
let keys: CryptoKeyPair;
let jwk: JsonWebKey;
beforeAll(async () => {
  keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
});
function encode(value: unknown) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
async function setup(overrides: Record<string, unknown> = {}) {
  const origin = "https://test-" + crypto.randomUUID() + ".supabase.invalid";
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: origin + "/auth/v1", aud: "authenticated", sub: subject, session_id: sessionId,
    iat: now - 1, exp: now + 300, aal: "aal1", amr: [{ method: "password", timestamp: now - 1 }], ...overrides };
  const unsigned = encode({ alg: "ES256", typ: "JWT", kid: "qa-supabase-key" }) + "." + encode(claims);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, new TextEncoder().encode(unsigned));
  const token = unsigned + "." + Buffer.from(signature).toString("base64url");
  const calls: { path: string; method: string; headers: Headers; body: unknown; redirect?: RequestRedirect; cache?: RequestCache }[] = [];
  const state = {
    live: true, userStatus: 200, userId: subject, rpcError: false, factors: [] as object[],
    access: { active: true, accessBlocked: false, activeReceiptCount: 1, sessionEpoch: 3 } as Record<string, unknown>,
    deletion: null as unknown, deletionHttpStatus: 200,
  };
  const options = { canonicalProjectUrl: origin, publishableKey: "qa-public-not-a-real-key", serviceRoleKey: "qa-secret-not-a-real-key", recentAuthenticationSeconds: 300, now: () => now * 1000 };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    expect(url.origin).toBe(origin);
    const path = url.pathname + url.search;
    calls.push({ path, method: init?.method ?? "GET", headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : null, redirect: init?.redirect, cache: init?.cache });
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "x-supabase-api-version": "2024-01-01" } });
    if (path === "/auth/v1/.well-known/jwks.json") return json({ keys: [{ ...jwk, kid: "qa-supabase-key", alg: "ES256", use: "sig" }] });
    if (path === "/auth/v1/user") return state.userStatus === 200 ? json({ id: state.userId, aud: "authenticated", role: "authenticated", factors: state.factors, is_anonymous: false }) : json({ code: "user_not_found", message: "untrusted-upstream-detail" }, state.userStatus);
    if (path === "/auth/v1/logout?scope=global") return new Response(null, { status: 204 });
    if (path.startsWith("/rest/v1/rpc/")) {
      if (state.rpcError) return json({ code: "XX000", message: "untrusted-ledger-detail" }, 500);
      const name = path.slice("/rest/v1/rpc/".length);
      if (name === "planet_has_auth_session") return json(state.live);
      if (name === "planet_get_web_access") return json(state.access);
      if (name === "planet_get_account_deletion_status") return state.deletionHttpStatus === 204 ? new Response(null, { status: 204 }) : json(state.deletion, state.deletionHttpStatus);
      if (name === "planet_revoke_web_sessions") return json({ sessionEpoch: 4 });
      if (name === "planet_request_account_deletion") return json({ requestId: (calls.at(-1)!.body as Record<string, unknown>).p_request_id, status: "requested", sessionEpoch: 4 });
      if (name === "planet_apply_verified_payment_event") return json({ duplicate: false, receiptApplied: true, receiptStatus: "active", sessionEpoch: 4 });
    }
    throw new Error("Unexpected fixture request " + path);
  };
  return { services: createCanonicalSupabaseServices({ ...options, fetch: fetcher }), token, claims, state, calls, options, fetcher, principal: { subject, sessionId, expiresAt: now + 300 } };
}

describe("canonical Supabase server adapter with actual SDK and signed test JWTs", () => {
  it("reads exact own-subject deletion status through service RPC independently of access", async () => {
    const f = await setup(); expect(await f.services.ledger.deletionStatus(subject)).toBeNull();
    for (const status of ["requested", "processing", "blocked", "completed"]) {
      f.state.deletion = { requestId: crypto.randomUUID(), status };
      expect(await f.services.ledger.deletionStatus(subject)).toEqual(f.state.deletion);
    }
    expect(f.calls.every(call => call.path === "/rest/v1/rpc/planet_get_account_deletion_status"
      && JSON.stringify(call.body) === JSON.stringify({ p_user_id: subject }) && call.headers.get("authorization") === "Bearer " + f.options.serviceRoleKey)).toBe(true);
  });
  it("does not interpret RPC failure, empty HTTP output or malformed response as no deletion request", async () => {
    const f = await setup(); f.state.rpcError = true;
    await expect(f.services.ledger.deletionStatus(subject)).rejects.toThrow(); f.state.rpcError = false;
    f.state.deletionHttpStatus = 204; await expect(f.services.ledger.deletionStatus(subject)).rejects.toThrow(); f.state.deletionHttpStatus = 200;
    for (const value of [{}, [], { requestId: subject, status: ["completed"] }, { requestId: subject, status: "unknown" }, { requestId: subject, status: "requested", subject }]) {
      f.state.deletion = value; await expect(f.services.ledger.deletionStatus(subject)).rejects.toThrow("Invalid canonical deletion status");
    }
  });
  it("verifies signature, fresh canonical user and matching live auth session", async () => {
    const f = await setup();
    expect(await f.services.auth.verify(f.token)).toEqual(f.principal);
    expect(f.calls.map(call => call.path)).toEqual(["/auth/v1/.well-known/jwks.json", "/auth/v1/user", "/rest/v1/rpc/planet_has_auth_session"]);
    expect(f.calls[2].body).toEqual({ p_user_id: subject, p_session_id: sessionId });
    expect(f.calls.every(call => call.redirect === "error" && call.cache === "no-store")).toBe(true);
    expect(f.calls[1].headers.get("authorization")).toBe("Bearer " + f.token);
    expect(f.calls[2].headers.get("authorization")).toBe("Bearer " + f.options.serviceRoleKey);
    expect(f.calls.some(call => call.path.includes("refresh_token"))).toBe(false);
  });
  it("rejects a genuinely invalid signature before user or ledger lookup", async () => {
    const f = await setup();
    const segments = f.token.split(".");
    const bytes = Buffer.from(segments[2], "base64url");
    bytes[0] ^= 1;
    segments[2] = bytes.toString("base64url");
    expect(await f.services.auth.verify(segments.join("."))).toBeNull();
    expect(f.calls.every(call => call.path.endsWith("jwks.json"))).toBe(true);
  });
  it.each([
    { iss: "https://foreign.invalid/auth/v1" }, { aud: "service_role" }, { sub: "not-uuid" },
    { session_id: "not-uuid" }, { exp: 1 }, { exp: "9999999999" }, { is_anonymous: true },
  ])("rejects wrong or malformed verified JWT context %j", async overrides => {
    const f = await setup(overrides);
    expect(await f.services.auth.verify(f.token)).toBeNull();
    expect(f.calls.some(call => call.path.startsWith("/rest/"))).toBe(false);
  });
  it("checks session removal even while the JWT is still unexpired", async () => {
    const f = await setup();
    expect(await f.services.auth.verify(f.token)).not.toBeNull();
    f.state.live = false;
    expect(await f.services.auth.verify(f.token)).toBeNull();
  });
  it("rejects mismatched or removed canonical user", async () => {
    const f = await setup();
    f.state.userId = "57d7652d-c9b8-4397-9c0a-1eb311a91b7f";
    expect(await f.services.auth.verify(f.token)).toBeNull();
    f.state.userStatus = 403;
    expect(await f.services.auth.verify(f.token)).toBeNull();
  });
  it("keeps upstream unavailability separate from known authentication denial", async () => {
    const f = await setup();
    f.state.rpcError = true;
    await expect(f.services.auth.verify(f.token)).rejects.toThrow("Canonical ledger unavailable");
  });
  it.each(["password", "otp", "totp"])("accepts recent verified %s authentication", async method => {
    const now = Math.floor(Date.now() / 1000);
    const f = await setup({ aal: "aal2", amr: [{ method, timestamp: now - 5 }] });
    expect(await f.services.auth.verifyRecentAuthentication(f.principal, f.token)).toBe(true);
  });
  it.each(["token_refresh", "recovery", "invite", "anonymous", "email_change", "signup"])("does not confuse %s with reauthentication", async method => {
    const now = Math.floor(Date.now() / 1000);
    const f = await setup({ amr: [{ method, timestamp: now - 1 }] });
    expect(await f.services.auth.verifyRecentAuthentication(f.principal, f.token)).toBe(false);
  });
  it.each([-300, -301, 1])("rejects AMR at excluded age boundary %s", async delta => {
    const now = Math.floor(Date.now() / 1000);
    const f = await setup({ amr: [{ method: "password", timestamp: now + delta }] });
    expect(await f.services.auth.verifyRecentAuthentication(f.principal, f.token)).toBe(false);
  });
  it("rejects different proof session, absent AMR, and MFA downgrade", async () => {
    const f = await setup();
    expect(await f.services.auth.verifyRecentAuthentication({ ...f.principal, sessionId: crypto.randomUUID() }, f.token)).toBe(false);
    f.state.factors = [{ id: crypto.randomUUID(), factor_type: "totp", status: "verified" }];
    expect(await f.services.auth.verifyRecentAuthentication(f.principal, f.token)).toBe(false);
    const missing = await setup({ amr: undefined });
    expect(await missing.services.auth.verifyRecentAuthentication(missing.principal, missing.token)).toBe(false);
  });
  it("calls exact service-only ledger RPCs and acknowledges requested deletion only", async () => {
    const f = await setup();
    expect(await f.services.ledger.access(subject, "base-v1")).toEqual(f.state.access);
    await f.services.ledger.revokeSessions(subject);
    const requestId = crypto.randomUUID();
    expect(await f.services.ledger.requestDeletion(subject, requestId)).toEqual({ requestId, status: "requested" });
    await f.services.ledger.applyPayment("qa-provider", { eventId: "e1", transactionId: "t1", subject, product: "base-v1", status: "active", occurredAt: "2026-09-05T00:00:00Z" }, "a".repeat(64));
    expect(f.calls.at(-1)?.body).toEqual({ p_provider: "qa-provider", p_event_id: "e1", p_transaction_id: "t1", p_user_id: subject,
      p_product_id: "base-v1", p_status: "active", p_occurred_at: "2026-09-05T00:00:00Z", p_payload_sha256: "a".repeat(64) });
    expect(f.calls.every(call => call.path.startsWith("/rest/v1/rpc/"))).toBe(true);
  });
  it.each([{ active: true, activeReceiptCount: 0 }, { sessionEpoch: "1" }, { activeReceiptCount: -1 }, { extra: true }])("rejects malformed ledger result %j", async changes => {
    const f = await setup();
    Object.assign(f.state.access, changes);
    await expect(f.services.ledger.access(subject, "base-v1")).rejects.toThrow("Invalid canonical access response");
  });
  it("uses canonical Auth global signout without account deletion", async () => {
    const f = await setup();
    await f.services.auth.signOut(f.token);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].path).toBe("/auth/v1/logout?scope=global");
    expect(f.calls[0].method).toBe("POST");
  });
  it("requires explicit same-project credentials and bounded reauthentication policy", async () => {
    const f = await setup();
    for (const bad of [{ recentAuthenticationSeconds: 0 }, { recentAuthenticationSeconds: 901 },
      { canonicalProjectUrl: "http://localhost:54321" }, { canonicalProjectUrl: f.options.canonicalProjectUrl + "/nested" },
      { serviceRoleKey: f.options.publishableKey }]) {
      expect(() => createCanonicalSupabaseServices({ ...f.options, ...bad, fetch: f.fetcher })).toThrow("Invalid canonical Supabase configuration");
    }
  });
});
