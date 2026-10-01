import type { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createPaymentRetryTestDatabase } from "../../scripts/database/fixtures/literary-planet-payment-retry-context.mjs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createPlanetApi, type VerifiedPayment } from "./api";
import { createCookieCodec, createGrantSigner } from "./crypto";
import { createCanonicalSupabaseServices } from "./supabase";
import { createCanonicalLicenseRateLimiter } from "./licenseRateLimiterSupabase";
import { createPwaLicenseRuntime } from "../../src/pwa/PwaLicenseRuntime";
import { createPlanetAccountClient } from "../../src/pwa/accountAccess";

const origin = "https://probpera.ru";
const issuer = origin + "/planet";
const audience = "fixture-planet-web";
const product = "fixture-base-v1";
const now = Math.floor(Date.now() / 1000);
let db: PGlite;
let authKeys: CryptoKeyPair;
let grantKeys: CryptoKeyPair;
let publicAuthKey: JsonWebKey;
let publicGrantKey: JsonWebKey;
let cookieKey: CryptoKey;
let webhookKey: CryptoKey;
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

beforeAll(async () => {
  db = await createPaymentRetryTestDatabase();
  await db.exec(await readFile("supabase/migrations/20261001194458_planet_license_rate_limits.sql", "utf8"));
  authKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  grantKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  publicAuthKey = await crypto.subtle.exportKey("jwk", authKeys.publicKey);
  publicGrantKey = await crypto.subtle.exportKey("jwk", grantKeys.publicKey);
  cookieKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  webhookKey = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}, 60_000);
afterAll(async () => { await db?.close(); });

async function rowCount(table: "auth.users" | "public.planet_payment_events", subject: string) {
  const column = table === "auth.users" ? "id" : "user_id";
  return Number((await db.query<{ count: number }>("select count(*)::integer as count from " + table + " where " + column + "=$1::uuid", [subject])).rows[0].count);
}
async function environment() {
  const subject = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  await db.query("insert into auth.users(id) values($1::uuid)", [subject]);
  await db.query("insert into public.profiles(id,display_name,role) values($1::uuid,'Local fixture reader','reader')", [subject]);
  await db.query("insert into auth.sessions(id,user_id) values($1::uuid,$2::uuid)", [sessionId, subject]);
  const project = "https://fixture-" + crypto.randomUUID() + ".supabase.invalid";
  const unsigned = encode({ alg: "ES256", typ: "JWT", kid: "fixture-auth" }) + "." + encode({
    iss: project + "/auth/v1", aud: "authenticated", sub: subject, session_id: sessionId, iat: now - 1, exp: now + 3600,
    amr: [{ method: "password", timestamp: now - 1 }], aal: "aal1", is_anonymous: false,
  });
  const token = unsigned + "." + Buffer.from(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, authKeys.privateKey, new TextEncoder().encode(unsigned))).toString("base64url");
  const sql: Record<string, { query: string; fields: string[] }> = {
    planet_has_auth_session: { query: "select public.planet_has_auth_session($1::uuid,$2::uuid) as value", fields: ["p_user_id", "p_session_id"] },
    planet_get_web_access: { query: "select public.planet_get_web_access($1::uuid,$2) as value", fields: ["p_user_id", "p_product_id"] },
    planet_revoke_web_sessions: { query: "select public.planet_revoke_web_sessions($1::uuid) as value", fields: ["p_user_id"] },
    planet_request_account_deletion: { query: "select public.planet_request_account_deletion($1::uuid,$2::uuid) as value", fields: ["p_user_id", "p_request_id"] },
    planet_get_account_deletion_status: { query: "select public.planet_get_account_deletion_status($1::uuid) as value", fields: ["p_user_id"] },
    planet_apply_verified_payment_event: { query: "select public.planet_apply_verified_payment_event($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as value",
      fields: ["p_provider", "p_event_id", "p_payload_sha256", "p_transaction_id", "p_user_id", "p_product_id", "p_status", "p_occurred_at"] },
    planet_enqueue_verified_payment_retry: { query: "select public.planet_enqueue_verified_payment_retry($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as value",
      fields: ["p_provider", "p_event_id", "p_payload_sha256", "p_transaction_id", "p_user_id", "p_product_id", "p_status", "p_occurred_at"] },
    planet_consume_license_grant_budget: { query: "select public.planet_consume_license_grant_budget($1::uuid,$2,$3::integer,$4::integer) as value",
      fields: ["p_subject", "p_product_id", "p_limit", "p_window_seconds"] },
  };
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  // This fixture stands in for Supabase Auth HTTP only. JWT verification uses the
  // actual SDK/WebCrypto; every ledger RPC executes the actual migration in PG.
  const fetchSupabase: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    expect(url.origin).toBe(project);
    const headers = new Headers(init?.headers);
    if (url.pathname === "/auth/v1/.well-known/jwks.json") return json({ keys: [{ ...publicAuthKey, kid: "fixture-auth", alg: "ES256", use: "sig" }] });
    if (url.pathname === "/auth/v1/user") {
      if (headers.get("authorization") !== "Bearer " + token || await rowCount("auth.users", subject) !== 1) return json({ message: "User missing" }, 403);
      return json({ id: subject, aud: "authenticated", factors: [], is_anonymous: false });
    }
    if (url.pathname === "/auth/v1/logout" && url.search === "?scope=global") {
      expect(headers.get("authorization")).toBe("Bearer " + token);
      await db.query("delete from auth.sessions where user_id=$1::uuid", [subject]);
      return new Response(null, { status: 204 });
    }
    const name = url.pathname.replace("/rest/v1/rpc/", "");
    const operation = sql[name];
    if (!operation) throw new Error("Unexpected local fixture route");
    expect(headers.get("authorization")).toBe("Bearer qa-service-role-fixture");
    const args = JSON.parse(String(init?.body));
    expect(Object.keys(args).sort()).toEqual([...operation.fields].sort());
    await db.exec("set role service_role");
    try {
      const value = (await db.query<{ value: unknown }>(operation.query, operation.fields.map(field => args[field]))).rows[0].value;
      return json(value);
    } catch { return json({ code: "P0001", message: "Rejected by fixture SQL" }, 400); }
    finally { await db.exec("reset role"); }
  };
  const canonicalOptions = { canonicalProjectUrl: project, publishableKey: "qa-publishable-fixture",
    serviceRoleKey: "qa-service-role-fixture", recentAuthenticationSeconds: 300, fetch: fetchSupabase, now: () => now * 1000 };
  const canonical = createCanonicalSupabaseServices(canonicalOptions);
  const api = createPlanetApi({ origin, audience, product, cookieName: "__Host-planet-integration",
    now: () => now * 1000,
    deletionDisclosure: { version: "local-integration-fixture", ru: "Тестовый текст; не юридическое заключение.", en: "Test text; not a legal approval." },
    services: { ...canonical,
      licenseRateLimiter: createCanonicalLicenseRateLimiter(canonicalOptions, { limit: 10000, windowSeconds: 60 }),
      cookies: createCookieCodec({ key: cookieKey, origin, cookieName: "__Host-planet-integration" }),
      signer: createGrantSigner({ privateKey: grantKeys.privateKey, kid: "fixture-license", issuer, audience, product, grantSeconds: 600, offlineSeconds: 300, now: () => now * 1000 }),
      payments: { provider: "local-fixture", async verify(request, bytes) {
        const signature = request.headers.get("x-local-fixture-signature");
        if (!signature || !/^[A-Za-z0-9_-]{43}$/u.test(signature)) return null;
        if (!await crypto.subtle.verify("HMAC", webhookKey, Buffer.from(signature, "base64url"), Uint8Array.from(bytes))) return null;
        return JSON.parse(new TextDecoder().decode(bytes)) as VerifiedPayment;
      } },
    },
  });
  const authority = { issuer, audience, product, trustedKeys: [{ kid: "fixture-license", jwk: publicGrantKey }] };
  function browser() {
    let cookie = "";
    const values = new Map<string, string>();
    const fetch: typeof globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      expect(new URL(url).origin).toBe(origin);
      const headers = new Headers(init?.headers);
      headers.set("origin", origin); headers.set("sec-fetch-site", "same-origin");
      if (cookie) headers.set("cookie", cookie);
      const response = await api(new Request(url, { ...init, headers }));
      const next = response.headers.get("set-cookie");
      if (next) cookie = next.includes("Max-Age=0") ? "" : next.split(";")[0];
      return response;
    };
    const account = createPlanetAccountClient({ origin, fetch });
    const runtime = createPwaLicenseRuntime({ authority, origin, fetch, now: () => now * 1000,
      storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } } });
    return { account, runtime, values, fetch };
  }
  async function payment(event: VerifiedPayment, signed = true) {
    const bytes = new TextEncoder().encode(JSON.stringify(event));
    const signature = Buffer.from(await crypto.subtle.sign("HMAC", webhookKey, bytes)).toString("base64url");
    return api(new Request(origin + "/planet/api/payments/webhook/local-fixture", { method: "POST", body: bytes,
      headers: { "Content-Type": "application/json", ...(signed ? { "x-local-fixture-signature": signature } : {}) } }));
  }
  const event = (patch: Partial<VerifiedPayment> = {}): VerifiedPayment => ({ eventId: crypto.randomUUID(), transactionId: crypto.randomUUID(), subject, product,
    status: "active", occurredAt: new Date(now * 1000).toISOString(), ...patch });
  return { subject, sessionId, token, api, browser, payment, event, canonical };
}

// One PGlite connection: real SQL/ACL and complete protocol integration, not a
// claim of production Auth/provider access or multi-connection concurrency QA.
describe.sequential("account → verified event → canonical SQL → signed PWA access", () => {
  it("recovers a committed deletion after a lost 202 in a fresh browser without paid cookie or access", async () => {
    const f = await environment(), browser = f.browser(); const config = await browser.account.configuration();
    await browser.account.bridge(config, f.token); const requestId = crypto.randomUUID();
    const droppedResponse = createPlanetAccountClient({ origin, fetch: async (input, init) => {
      const response = await browser.fetch(input, init);
      if (String(input).endsWith("account/deletion-request")) {
        expect(response.status).toBe(202); await response.body?.cancel(); throw new TypeError("Controlled response loss after actual SQL commit");
      }
      return response;
    } });
    await expect(droppedResponse.requestDeletion(config, f.token, requestId)).rejects.toMatchObject({ reason: "unavailable" });
    const fresh = f.browser();
    await expect(fresh.account.bridge(config, f.token)).rejects.toMatchObject({ reason: "denied" });
    expect(await fresh.account.deletionStatus(config, f.token)).toEqual({ requestId, status: "requested" });
    expect(Number((await db.query<{ count: number }>("select count(*)::integer as count from public.planet_deletion_requests where user_id=$1::uuid", [f.subject])).rows[0].count)).toBe(1);
    const leaseToken = crypto.randomUUID();
    await db.exec("set role service_role");
    try {
      await db.query("select public.planet_claim_reader_deletion($1::uuid,$2::uuid,$3,60)", [requestId, leaseToken, "a".repeat(64)]);
      const inspection = (await db.query<{ value: { phase: string; blockers: string[] } }>("select public.planet_inspect_reader_deletion($1::uuid,$2::uuid,true) as value", [requestId, leaseToken])).rows[0].value;
      expect(inspection.phase).toBe("auth-ready"); expect(inspection.blockers).toEqual([]);
    }
    finally { await db.exec("reset role"); }
    expect(await fresh.account.deletionStatus(config, f.token)).toEqual({ requestId, status: "processing" });
    // Local SQL stands in for authorized Auth HTTP only after the real reader
    // processor lease/preflight arms the canonical guard; no live Auth acceptance.
    await db.query("delete from auth.users where id=$1::uuid", [f.subject]);
    await db.exec("set role service_role");
    try { await db.query("select public.planet_finish_reader_deletion($1::uuid,$2::uuid,'completed',$3,array[]::text[])", [requestId, leaseToken, "b".repeat(64)]); }
    finally { await db.exec("reset role"); }
    await expect(fresh.account.deletionStatus(config, f.token)).rejects.toMatchObject({ reason: "authentication" });
    expect(await f.canonical.ledger.deletionStatus(f.subject)).toBeNull();
  });
  it("starts unpaid, applies only verified events, restores access, then denies refund and stale revival", async () => {
    const f = await environment(); const browser = f.browser();
    const config = await browser.account.configuration();
    expect(await browser.account.bridge(config, f.token)).toBe(f.subject);
    const boot = await browser.runtime.bootstrap({ mode: "online" });
    expect(boot.client).not.toBeNull();
    expect((await boot.client!.check({ mode: "online" })).status).toBe("denied");
    const purchase = f.event();
    expect((await f.payment(purchase, false)).status).toBe(401);
    expect(await rowCount("public.planet_payment_events", f.subject)).toBe(0);
    expect((await f.payment(purchase)).status).toBe(204);
    expect((await f.payment(purchase)).status).toBe(204);
    expect(await rowCount("public.planet_payment_events", f.subject)).toBe(1);
    expect((await boot.client!.check({ mode: "online" })).status).toBe("denied"); // Epoch changed.
    await browser.account.bridge(config, f.token);
    const restored = await browser.runtime.bootstrap({ mode: "online" });
    expect((await restored.client!.check({ mode: "online" })).status).toBe("authorized");
    expect((await restored.client!.check({ mode: "offline" })).status).toBe("authorized");
    expect(await rowCount("auth.users", f.subject)).toBe(1);
    expect((await f.payment(f.event({ transactionId: purchase.transactionId, status: "refunded" }))).status).toBe(204);
    expect((await restored.client!.check({ mode: "online" })).status).toBe("denied");
    expect((await restored.client!.check({ mode: "offline" })).status).toBe("denied");
    expect((await f.payment(f.event({ transactionId: purchase.transactionId, occurredAt: new Date((now + 10) * 1000).toISOString() }))).status).toBe(204);
    expect((await f.canonical.ledger.access(f.subject, product)).active).toBe(false);
  });

  it("restores the same purchase in a fresh browser without duplicating identity, and observes real session removal", async () => {
    const f = await environment();
    await f.payment(f.event());
    const first = f.browser(); const second = f.browser();
    expect((await second.runtime.bootstrap({ mode: "online" })).client).toBeNull();
    for (const browser of [first, second]) {
      const config = await browser.account.configuration();
      await browser.account.bridge(config, f.token);
      const boot = await browser.runtime.bootstrap({ mode: "online" });
      expect((await boot.client!.check({ mode: "online" })).status).toBe("authorized");
    }
    expect(await rowCount("auth.users", f.subject)).toBe(1);
    expect((await first.fetch(origin + "/planet/api/license/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ v: 1, audience, product }) })).status).toBe(204);
    expect((await second.runtime.bootstrap({ mode: "online" })).client).toBeNull();
    expect((await second.runtime.bootstrap({ mode: "offline" })).client).toBeNull();
    expect(await rowCount("auth.users", f.subject)).toBe(1);
  });

  it("accepts recent same-session deletion, blocks access, and preserves the account until actual deletion work", async () => {
    const f = await environment(); await f.payment(f.event());
    const browser = f.browser(); const config = await browser.account.configuration();
    await browser.account.bridge(config, f.token);
    const requestId = crypto.randomUUID();
    expect(await browser.account.requestDeletion(config, f.token, requestId)).toEqual({ requestId, status: "requested" });
    expect(await rowCount("auth.users", f.subject)).toBe(1);
    const request = (await db.query<{ status: string; user_id: string }>("select status,user_id from public.planet_deletion_requests where request_id=$1::uuid", [requestId])).rows[0];
    expect(request).toEqual({ status: "requested", user_id: f.subject });
    expect((await f.canonical.ledger.access(f.subject, product)).accessBlocked).toBe(true);
    expect((await browser.runtime.bootstrap({ mode: "online" })).client).toBeNull();
  });
});
