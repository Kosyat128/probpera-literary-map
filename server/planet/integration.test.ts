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
import { createReaderDeletionProcessor } from "./deletionProcessor";
import { createSupabaseReaderDeletionServices } from "./deletionProcessorSupabase";

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
async function environment(rateLimit = 10000) {
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
    planet_claim_reader_deletion: { query: "select public.planet_claim_reader_deletion($1::uuid,$2::uuid,$3,$4::integer) as value",
      fields: ["p_request_id", "p_lease_token", "p_policy_sha256", "p_lease_seconds"] },
    planet_inspect_reader_deletion: { query: "select public.planet_inspect_reader_deletion($1::uuid,$2::uuid,$3::boolean) as value",
      fields: ["p_request_id", "p_lease_token", "p_prepare"] },
    planet_finish_reader_deletion: { query: "select public.planet_finish_reader_deletion($1::uuid,$2::uuid,$3,$4,$5::text[]) as value",
      fields: ["p_request_id", "p_lease_token", "p_status", "p_evidence_sha256", "p_blocker_codes"] },
    planet_apply_verified_payment_event: { query: "select public.planet_apply_verified_payment_event($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as value",
      fields: ["p_provider", "p_event_id", "p_payload_sha256", "p_transaction_id", "p_user_id", "p_product_id", "p_status", "p_occurred_at"] },
    planet_enqueue_verified_payment_retry: { query: "select public.planet_enqueue_verified_payment_retry($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as value",
      fields: ["p_provider", "p_event_id", "p_payload_sha256", "p_transaction_id", "p_user_id", "p_product_id", "p_status", "p_occurred_at"] },
    planet_consume_license_grant_budget: { query: "select public.planet_consume_license_grant_budget($1::uuid,$2,$3::integer,$4::integer) as value",
      fields: ["p_subject", "p_product_id", "p_limit", "p_window_seconds"] },
  };
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  const deletionHttp: { beforeAvatarRemoval?: () => Promise<void>; calls: string[] } = { calls: [] };
  // Only Auth/Storage HTTP are controlled ports. JWT verification uses the real
  // SDK/WebCrypto; every ledger/processor RPC executes current canonical SQL.
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
    if (url.pathname === "/storage/v1/object/avatars" && init?.method === "DELETE") {
      expect(headers.get("authorization")).toBe("Bearer qa-service-role-fixture");
      const { prefixes } = JSON.parse(String(init.body));
      expect(prefixes).toEqual([`${subject}/avatar.webp`]);
      deletionHttp.calls.push(url.pathname);
      await deletionHttp.beforeAvatarRemoval?.();
      // Controlled Storage port removes metadata only after its simulated blob
      // removal; the product adapter still uses the genuine Storage SDK call.
      for (const path of prefixes) await db.query("delete from storage.objects where bucket_id='avatars' and name=$1", [path]);
      return json(prefixes.map((name: string) => ({ name })));
    }
    if (url.pathname === `/auth/v1/admin/users/${subject}` && init?.method === "DELETE") {
      expect(headers.get("authorization")).toBe("Bearer qa-service-role-fixture");
      expect(JSON.parse(String(init.body))).toEqual({ should_soft_delete: false });
      deletionHttp.calls.push(url.pathname);
      expect((await db.query("select status,processor_phase from public.planet_deletion_requests where user_id=$1::uuid", [subject])).rows[0])
        .toEqual({ status: "processing", processor_phase: "auth-ready" });
      // The actual canonical Auth deletion guard runs in this transaction.
      await db.query("delete from auth.users where id=$1::uuid", [subject]);
      return json({ id: subject, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-02T00:00:00Z" });
    }
    const name = url.pathname.replace("/rest/v1/rpc/", "");
    const operation = sql[name];
    if (!operation) throw new Error("Unexpected local fixture route");
    expect(headers.get("authorization")).toBe("Bearer qa-service-role-fixture");
    const args = JSON.parse(String(init?.body));
    expect(Object.keys(args).sort()).toEqual([...operation.fields].sort());
    if (["planet_claim_reader_deletion", "planet_inspect_reader_deletion", "planet_finish_reader_deletion"].includes(name)) deletionHttp.calls.push(url.pathname);
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
      licenseRateLimiter: createCanonicalLicenseRateLimiter(canonicalOptions, { limit: rateLimit, windowSeconds: 60 }),
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
    let clientTime = now * 1000;
    const sessions: { status: number; retryAfter: string | null }[] = [];
    const values = new Map<string, string>();
    const fetch: typeof globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      expect(new URL(url).origin).toBe(origin);
      const headers = new Headers(init?.headers);
      headers.set("origin", origin); headers.set("sec-fetch-site", "same-origin");
      if (cookie) headers.set("cookie", cookie);
      const response = await api(new Request(url, { ...init, headers }));
      if (new URL(url).pathname === "/planet/api/license/session") sessions.push({ status: response.status, retryAfter: response.headers.get("retry-after") });
      const next = response.headers.get("set-cookie");
      if (next) cookie = next.includes("Max-Age=0") ? "" : next.split(";")[0];
      return response;
    };
    const account = createPlanetAccountClient({ origin, fetch });
    const runtime = createPwaLicenseRuntime({ authority, origin, fetch, now: () => clientTime,
      storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } } });
    return { account, runtime, values, fetch, sessions, setClock: (milliseconds: number) => { clientTime = milliseconds; } };
  }
  async function payment(event: VerifiedPayment, signed = true) {
    const bytes = new TextEncoder().encode(JSON.stringify(event));
    const signature = Buffer.from(await crypto.subtle.sign("HMAC", webhookKey, bytes)).toString("base64url");
    return api(new Request(origin + "/planet/api/payments/webhook/local-fixture", { method: "POST", body: bytes,
      headers: { "Content-Type": "application/json", ...(signed ? { "x-local-fixture-signature": signature } : {}) } }));
  }
  const event = (patch: Partial<VerifiedPayment> = {}): VerifiedPayment => ({ eventId: crypto.randomUUID(), transactionId: crypto.randomUUID(), subject, product,
    status: "active", occurredAt: new Date(now * 1000).toISOString(), ...patch });
  return { subject, sessionId, token, api, browser, payment, event, canonical, deletionHttp,
    deletionServices: createSupabaseReaderDeletionServices(canonicalOptions) };
}

// One PGlite connection: real SQL/ACL and complete protocol integration, not a
// claim of production Auth/provider access or multi-connection concurrency QA.
describe.sequential("account → verified event → canonical SQL → signed PWA access", () => {
  it("honors actual durable grant exhaustion and Retry-After without losing signed offline proof or issuing another grant early", async () => {
    const f = await environment(1); await f.payment(f.event());
    const browser = f.browser(), config = await browser.account.configuration();
    await browser.account.bridge(config, f.token);
    const boot = await browser.runtime.bootstrap({ mode: "online" });
    expect(await boot.client!.check({ mode: "online" })).toMatchObject({ status: "authorized", claims: { sub: f.subject, product } });
    const saved = [...browser.values.entries()];
    const budget = async () => (await db.query<{ value: unknown }>("select to_jsonb(b) as value from public.planet_license_grant_budgets b where user_id=$1::uuid and product_id=$2", [f.subject, product])).rows[0].value;
    const before = await budget();
    browser.setClock(now * 1000 + 500);
    expect(await boot.client!.check({ mode: "online" })).toMatchObject({ reason: "rate-limited" });
    expect(browser.sessions.map(value => value.status)).toEqual([200, 429]);
    const seconds = Number(browser.sessions[1].retryAfter);
    expect(Number.isInteger(seconds)).toBe(true); expect(seconds).toBeGreaterThanOrEqual(1); expect(seconds).toBeLessThanOrEqual(60);
    expect(await budget()).toEqual(before); expect([...browser.values.entries()]).toEqual(saved);
    browser.setClock(now * 1000 + 500 + seconds * 1000 - 1);
    expect(await boot.client!.check({ mode: "online" })).toMatchObject({ reason: "rate-limited" });
    expect(await boot.client!.check({ mode: "offline" })).toMatchObject({ status: "authorized", claims: { sub: f.subject, product } });
    expect(browser.sessions.map(value => value.status)).toEqual([200, 429]);
    // Only controlled fixture row data expires the DB window; no sleep/client clock authority.
    await db.query("update public.planet_license_grant_budgets set window_started_at=statement_timestamp()-interval '61 seconds' where user_id=$1::uuid and product_id=$2", [f.subject, product]);
    browser.setClock(now * 1000 + 500 + seconds * 1000);
    expect(await boot.client!.check({ mode: "online" })).toMatchObject({ status: "authorized" });
    expect(browser.sessions.map(value => value.status)).toEqual([200, 429, 200]);
    expect(await budget()).toMatchObject({ used: 1, grant_limit: 1 });
  });
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

  it("composes a lost account acknowledgement with the real reader processor, durable completion and Auth denial", async () => {
    const f = await environment(), purchase = f.event();
    expect((await f.payment(purchase)).status).toBe(204);
    await db.query("insert into public.reader_book_collections(user_id,id,name) values($1::uuid,'deletion-shelf','Private shelf')", [f.subject]);
    await db.query("insert into public.reader_book_collection_items(user_id,collection_id,book_key,position) values($1::uuid,'deletion-shelf','fixture-book',1)", [f.subject]);
    await db.query("insert into public.reader_progress(user_id,item_type,item_id) values($1::uuid,'book','fixture-book')", [f.subject]);
    await db.query("insert into storage.objects(id,bucket_id,name,owner_id) values($1::uuid,'avatars',$2,$3)", [crypto.randomUUID(), `${f.subject}/avatar.webp`, f.subject]);
    const browser = f.browser(), config = await browser.account.configuration();
    await browser.account.bridge(config, f.token);
    const boot = await browser.runtime.bootstrap({ mode: "online" });
    expect(await boot.client!.check({ mode: "online" })).toMatchObject({ status: "authorized", claims: { sub: f.subject, product } });
    const finance = async () => ({
      event: (await db.query<{ value: unknown }>("select to_jsonb(e)-'user_id' as value from public.planet_payment_events e where provider='local-fixture' and event_id=$1", [purchase.eventId])).rows[0].value,
      receipt: (await db.query<{ value: unknown }>("select to_jsonb(r)-'user_id' as value from public.planet_purchase_receipts r where provider='local-fixture' and transaction_id=$1", [purchase.transactionId])).rows[0].value,
    });
    const financeBefore = await finance();
    const privateCounts = async () => (await db.query("select " +
      "(select count(*)::integer from auth.sessions where user_id=$1::uuid) as sessions," +
      "(select count(*)::integer from public.profiles where id=$1::uuid) as profiles," +
      "(select count(*)::integer from public.reader_book_collections where user_id=$1::uuid) as shelves," +
      "(select count(*)::integer from public.reader_book_collection_items where user_id=$1::uuid) as items," +
      "(select count(*)::integer from public.reader_progress where user_id=$1::uuid) as progress," +
      "(select count(*)::integer from public.planet_access_state where user_id=$1::uuid) as access," +
      "(select count(*)::integer from public.planet_verified_payment_retries where user_id=$1::uuid) as retries," +
      "(select count(*)::integer from public.planet_license_grant_budgets where user_id=$1::uuid) as budgets," +
      "(select count(*)::integer from storage.objects where owner_id=$1::text) as avatars", [f.subject])).rows[0];
    expect(await privateCounts()).toEqual({ sessions: 1, profiles: 1, shelves: 1, items: 1, progress: 1, access: 1, retries: 1, budgets: 1, avatars: 1 });
    const requestId = crypto.randomUUID();
    const lostAcknowledgement = createPlanetAccountClient({ origin, fetch: async (input, init) => {
      const response = await browser.fetch(input, init);
      if (String(input).endsWith("account/deletion-request")) {
        expect(response.status).toBe(202); await response.body?.cancel();
        throw new TypeError("Controlled account acknowledgement loss after actual SQL commit");
      }
      return response;
    } });
    await expect(lostAcknowledgement.requestDeletion(config, f.token, requestId)).rejects.toMatchObject({ reason: "unavailable" });
    const fresh = f.browser();
    expect(await fresh.account.deletionStatus(config, f.token)).toEqual({ requestId, status: "requested" });
    expect((await db.query("select request_id,status,processor_phase from public.planet_deletion_requests where user_id=$1::uuid", [f.subject])).rows)
      .toEqual([{ request_id: requestId, status: "requested", processor_phase: "pending" }]);
    await expect(fresh.account.bridge(config, f.token)).rejects.toMatchObject({ reason: "denied" });
    expect((await f.canonical.ledger.access(f.subject, product)).accessBlocked).toBe(true);
    expect((await browser.runtime.bootstrap({ mode: "online" })).client).toBeNull();

    let fenced = false;
    f.deletionHttp.beforeAvatarRemoval = async () => {
      expect(await fresh.account.deletionStatus(config, f.token)).toEqual({ requestId, status: "processing" });
      expect((await db.query("select processor_phase from public.planet_deletion_requests where request_id=$1::uuid", [requestId])).rows[0])
        .toEqual({ processor_phase: "fenced" });
      await expect(db.query("update public.profiles set display_name='Stale reader edit' where id=$1::uuid", [f.subject])).rejects.toThrow(/PLANET_READER_DELETION_FENCED/u);
      expect((await db.query("select display_name from public.profiles where id=$1::uuid", [f.subject])).rows[0])
        .toEqual({ display_name: "Local fixture reader" });
      fenced = true;
    };
    const processor = createReaderDeletionProcessor({ services: f.deletionServices, leaseSeconds: 60, maxStorageBatches: 2,
      // Synthetic local policy reference; this test grants no legal approval.
      policy: { version: "local-integration-fixture", reviewEvidenceSha256: "f".repeat(64), privateReaderData: "delete",
        ownedAvatars: "delete", publicContributions: "block", paymentRecords: "retain-provider-records-unlinked" } });
    expect(await processor.process(requestId)).toEqual({ status: "completed", codes: [] });
    expect(fenced).toBe(true);
    expect(f.deletionHttp.calls.filter(path => !path.startsWith("/rest/")))
      .toEqual(["/storage/v1/object/avatars", `/auth/v1/admin/users/${f.subject}`]);
    expect(f.deletionHttp.calls).toContain("/rest/v1/rpc/planet_finish_reader_deletion");
    const terminal = (await db.query<{ status: string; user_id: string | null; processor_phase: string; processor_policy_sha256: string; evidence_sha256: string; completed_at: unknown; blocker_codes: string[] }>(
      "select status,user_id,processor_phase,processor_policy_sha256,evidence_sha256,completed_at,blocker_codes from public.planet_deletion_requests where request_id=$1::uuid", [requestId])).rows[0];
    expect(terminal).toMatchObject({ status: "completed", user_id: null, processor_phase: "auth-deleted", blocker_codes: [] });
    expect(terminal.processor_policy_sha256).toMatch(/^[0-9a-f]{64}$/u); expect(terminal.evidence_sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(terminal.completed_at).not.toBeNull();
    expect(await rowCount("auth.users", f.subject)).toBe(0);
    expect(await privateCounts()).toEqual({ sessions: 0, profiles: 0, shelves: 0, items: 0, progress: 0, access: 0, retries: 0, budgets: 0, avatars: 0 });
    expect((await db.query("select user_id from public.planet_payment_events where provider='local-fixture' and event_id=$1", [purchase.eventId])).rows[0]).toEqual({ user_id: null });
    expect((await db.query("select user_id from public.planet_purchase_receipts where provider='local-fixture' and transaction_id=$1", [purchase.transactionId])).rows[0]).toEqual({ user_id: null });
    expect(await finance()).toEqual(financeBefore);
    // Completion comes from service-only processor RPCs and a durable SQL audit.
    // The original bearer cannot retrieve a terminal receipt or obtain a grant.
    expect(await f.canonical.auth.verify(f.token)).toBeNull();
    await expect(fresh.account.deletionStatus(config, f.token)).rejects.toMatchObject({ reason: "authentication" });
    await expect(fresh.account.bridge(config, f.token)).rejects.toMatchObject({ reason: "authentication" });
    expect((await fresh.runtime.bootstrap({ mode: "online" })).client).toBeNull();
  });
});
