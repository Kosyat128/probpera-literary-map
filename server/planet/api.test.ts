import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { createPlanetApi, type PlanetApiServices, type PlanetAccess, type PlanetPrincipal, type VerifiedPayment, type PlanetDeletionStatus } from "./api";
import { createCookieCodec, createGrantSigner } from "./crypto";
import { verifyWebLicenseGrant } from "../../src/platform/adapters/web/WebLicense";
import { createPwaLicenseRuntime } from "../../src/pwa/PwaLicenseRuntime";

const origin = "https://probpera.ru";
const audience = "literary-planet-web";
const product = "literary-planet-base";
const issuer = "https://probpera.ru/planet";
const cookieName = "__Host-planet-fixture";
const token = "fixture.verified.token";
const baseBody = { v: 1, audience, product };
const start = Date.parse("2026-09-05T12:00:00Z");
let aesKey: CryptoKey;
let signingKeys: CryptoKeyPair;
let publicJwk: JsonWebKey;

beforeAll(async () => {
  aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  signingKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  publicJwk = await crypto.subtle.exportKey("jwk", signingKeys.publicKey);
});
afterEach(() => { vi.useRealTimers(); });

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

// These ports are explicitly controlled fixtures, not claims of a merchant or
// live Supabase deployment. AES-GCM cookies and ES256 grants use real WebCrypto.
function fixture() {
  let time = start;
  let sessionAlive = true;
  let deletion: PlanetDeletionStatus | null = null;
  const principal: PlanetPrincipal = { subject: crypto.randomUUID(), sessionId: crypto.randomUUID(), expiresAt: start / 1000 + 3600 };
  const state: PlanetAccess = { active: true, sessionEpoch: 2, accessBlocked: false, activeReceiptCount: 1 };
  const cookies = createCookieCodec({ key: aesKey, origin, cookieName });
  const signer = createGrantSigner({ privateKey: signingKeys.privateKey, kid: "fixture-key", issuer, audience, product,
    grantSeconds: 1800, offlineSeconds: 900, now: () => time });
  const auth = {
    verify: vi.fn(async (value: string) => value === token && sessionAlive ? { ...principal } : null),
    verifyRecentAuthentication: vi.fn(async (_principal: PlanetPrincipal, proofToken: string) => proofToken === "fixture.recent.proof"),
    signOut: vi.fn(async (_token: string) => { sessionAlive = false; }),
  };
  const ledger = {
    access: vi.fn(async (_subject: string, _product: string) => ({ ...state })),
    revokeSessions: vi.fn(async (_subject: string) => { state.sessionEpoch++; }),
    requestDeletion: vi.fn(async (_subject: string, requestId: string) => {
      state.accessBlocked = true; state.active = false; state.sessionEpoch++;
      deletion = { requestId, status: "requested" };
      return { requestId, status: "requested" as const };
    }),
    deletionStatus: vi.fn(async (_subject: string): Promise<PlanetDeletionStatus | null> => deletion),
    enqueueVerifiedEvent: vi.fn(async (_provider: string, _event: Readonly<VerifiedPayment>, _hash: string) => undefined),
    applyPayment: vi.fn(async (_provider: string, _event: VerifiedPayment, _hash: string) => undefined),
  };
  const services: PlanetApiServices = { auth, ledger, cookies, signer };
  const api = createPlanetApi({ origin, audience, product, cookieName, services, now: () => time,
    deletionDisclosure: { version: "local-test-fixture", ru: "Тестовые сведения для локального сценария.", en: "Test disclosure for the local scenario." } });
  const request = (route: string, body: object | string = baseBody, headers: Record<string, string> = {}, method = "POST") => new Request(`${origin}/planet/api/${route}`, {
    method, headers: { origin, "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers },
    ...(method === "GET" || method === "HEAD" ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
  const bridge = async () => {
    const response = await api(request("license/bridge", baseBody, { authorization: `Bearer ${token}` }));
    expect(response.status).toBe(200);
    const value = response.headers.get("set-cookie")!;
    return { response, cookie: value.split(";")[0], encoded: value.split(";")[0].slice(cookieName.length + 1) };
  };
  return { api, services, principal, state, auth, ledger, cookies, signer, request, bridge,
    clock: () => time, setClock: (value: number) => { time = value; },
    removeSession: () => { sessionAlive = false; } };
}

describe("controlled Planet HTTP API with real crypto", () => {
  it("recovers a deletion receipt after the original 202 was lost and paid access/cookie are revoked", async () => {
    const f = fixture(); const { cookie } = await f.bridge(); const requestId = crypto.randomUUID();
    await f.api(f.request("account/deletion-request", { ...baseBody, requestId, reauthToken: "fixture.recent.proof" }, { cookie }));
    expect((await f.api(f.request("license/bridge", baseBody, { authorization: `Bearer ${token}` }))).status).toBe(403);
    f.ledger.access.mockClear();
    const response = await f.api(f.request("account/deletion-status", baseBody, { authorization: `Bearer ${token}` }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ request: { requestId, status: "requested" } });
    expect(f.ledger.deletionStatus).toHaveBeenCalledWith(f.principal.subject); expect(f.ledger.requestDeletion).toHaveBeenCalledTimes(1);
    expect(f.ledger.access).not.toHaveBeenCalled(); expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each(["requested", "processing", "blocked", "completed"] as const)("reports exact verified ledger status %s without inferring completion", async status => {
    const f = fixture(); const requestId = crypto.randomUUID(); f.ledger.deletionStatus.mockResolvedValue({ requestId, status });
    const response = await f.api(f.request("account/deletion-status", baseBody, { authorization: `Bearer ${token}` }));
    expect(await response.json()).toEqual({ request: { requestId, status } });
  });
  it("keeps absent requests distinct from upstream failures", async () => {
    const f = fixture();
    expect(await (await f.api(f.request("account/deletion-status", baseBody, { authorization: `Bearer ${token}` }))).json()).toEqual({ request: null });
    f.ledger.deletionStatus.mockRejectedValue(new Error("private-service-detail"));
    const failure = await f.api(f.request("account/deletion-status", baseBody, { authorization: `Bearer ${token}` }));
    expect(failure.status).toBe(503); expect(await failure.json()).toEqual({ error: "service-unavailable" });
  });
  it("requires the same-origin verified live Bearer and accepts no caller subject/request ID", async () => {
    const f = fixture(); const headers = { authorization: `Bearer ${token}` };
    expect((await f.api(f.request("account/deletion-status"))).status).toBe(401);
    expect((await f.api(f.request("account/deletion-status", baseBody, { ...headers, origin: "https://foreign.invalid" }))).status).toBe(403);
    for (const extra of [{ subject: crypto.randomUUID() }, { requestId: crypto.randomUUID() }]) expect((await f.api(f.request("account/deletion-status", { ...baseBody, ...extra }, headers))).status).toBe(400);
    f.removeSession(); expect((await f.api(f.request("account/deletion-status", baseBody, headers))).status).toBe(401);
    expect(f.ledger.deletionStatus).not.toHaveBeenCalled();
  });
  it("rechecks live principal after asynchronous status lookup and fails closed on malformed status", async () => {
    const f = fixture(); f.ledger.deletionStatus.mockImplementation(async () => { f.removeSession(); return null; });
    expect((await f.api(f.request("account/deletion-status", baseBody, { authorization: `Bearer ${token}` }))).status).toBe(401);
    for (const invalid of [undefined, {}, { requestId: "invalid", status: "requested" }, { requestId: crypto.randomUUID(), status: ["completed"] }, { requestId: crypto.randomUUID(), status: "completed", evidence: "private" }]) {
      const other = fixture(); other.ledger.deletionStatus.mockResolvedValue(invalid as PlanetDeletionStatus);
      expect((await other.api(other.request("account/deletion-status", baseBody, { authorization: `Bearer ${token}` }))).status).toBe(503);
    }
  });
  it("exposes only public product/disclosure configuration without signing or session material", async () => {
    const f = fixture();
    const response = await f.api(f.request("configuration", { v: 1 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ v: 1, audience, product,
      deletionDisclosure: { version: "local-test-fixture", ru: "Тестовые сведения для локального сценария.", en: "Test disclosure for the local scenario." } });
    expect(f.auth.verify).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await f.api(f.request("configuration", { v: 1, subject: f.principal.subject }))).status).toBe(400);
  });

  it("keeps deletion unavailable until synchronized disclosures are supplied", async () => {
    const f = fixture();
    const api = createPlanetApi({ origin, audience, product, cookieName, services: f.services, now: f.clock });
    expect((await (await api(f.request("configuration", { v: 1 }))).json()).deletionDisclosure).toBeNull();
    const { cookie } = await f.bridge();
    const response = await api(f.request("account/deletion-request", { ...baseBody, requestId: crypto.randomUUID(), reauthToken: "fixture.recent.proof" }, { cookie }));
    expect(response.status).toBe(503);
    expect(f.ledger.requestDeletion).not.toHaveBeenCalled();
  });
  it("bridges a verified canonical token to a confidential host cookie and exact identity response", async () => {
    const f = fixture(); const result = await f.bridge();
    expect(await result.response.json()).toEqual({ subject: f.principal.subject });
    expect(result.response.headers.get("set-cookie")).toContain("; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600");
    expect(result.cookie).not.toContain(token);
    expect(result.cookie).not.toContain(f.principal.subject);
    expect(await f.cookies.open(result.encoded, start / 1000)).toEqual({ accessToken: token, ...f.principal, sessionEpoch: 2 });
    const response = await f.api(f.request("license/identity", baseBody, { cookie: result.cookie }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ subject: f.principal.subject });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("issues a real grant accepted by the canonical client online and offline", async () => {
    const f = fixture(); const { cookie } = await f.bridge();
    const response = await f.api(f.request("license/session", { ...baseBody, subject: f.principal.subject }, { cookie }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body)).toEqual(["grant"]);
    for (const mode of ["online", "offline"] as const) {
      const verified = await verifyWebLicenseGrant(body.grant, { issuer, audience, product, subject: f.principal.subject },
        { trustedKeys: [{ kid: "fixture-key", jwk: publicJwk }], now: f.clock, mode });
      expect(verified.status).toBe("authorized");
    }
    expect(f.ledger.access).toHaveBeenLastCalledWith(f.principal.subject, product);
  });

  it("supports the exact PWA identity/session protocol and re-verifies its signed offline cache", async () => {
    const f = fixture(); const { cookie } = await f.bridge(); const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const paths: string[] = [];
    const transport: typeof fetch = async (input, init) => {
      const incoming = new Request(input, init); const headers = new Headers(incoming.headers);
      headers.set("origin", origin); headers.set("sec-fetch-site", "same-origin"); headers.set("cookie", cookie);
      paths.push(new URL(incoming.url).pathname);
      return f.api(new Request(incoming, { headers }));
    };
    const runtime = createPwaLicenseRuntime({ origin, authority: { issuer, audience, product, trustedKeys: [{ kid: "fixture-key", jwk: publicJwk }] },
      storage, fetch: transport, now: f.clock });
    const initial = await runtime.bootstrap({ mode: "online" });
    expect(initial.reason).toBeNull();
    if (!initial.client) throw Error("Expected canonical PWA client");
    expect((await initial.client.check({ mode: "online" })).status).toBe("authorized");
    expect(paths).toEqual(["/planet/api/license/identity", "/planet/api/license/session"]);
    expect((await initial.client.check({ mode: "offline" })).status).toBe("authorized");
    expect(paths).toHaveLength(2);
  });

  it.each([null, "https://attacker.invalid", "null", `${origin}/`])("rejects missing or mismatched origin %s before authentication", async (requestOrigin) => {
    const f = fixture(); const request = f.request("license/bridge", baseBody, { authorization: `Bearer ${token}` });
    if (requestOrigin === null) request.headers.delete("origin"); else request.headers.set("origin", requestOrigin);
    const response = await f.api(request);
    expect(response.status).toBe(403); expect(f.auth.verify).not.toHaveBeenCalled();
  });

  it.each(["cross-site", "same-site", "none"])("rejects CSRF fetch metadata %s", async (site) => {
    const f = fixture();
    expect((await f.api(f.request("license/bridge", baseBody, { "sec-fetch-site": site, authorization: `Bearer ${token}` }))).status).toBe(403);
    expect(f.auth.verify).not.toHaveBeenCalled();
  });

  it.each(["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"])("does not accept a simple cross-origin form content type %s", async (contentType) => {
    const f = fixture();
    expect((await f.api(f.request("license/bridge", baseBody, { "content-type": contentType }))).status).toBe(415);
    expect(f.auth.verify).not.toHaveBeenCalled();
  });

  it.each([
    `{"v":1,"v":1,"audience":"${audience}","product":"${product}"}`,
    `{"v":1,"\\u0076":1,"audience":"${audience}","product":"${product}"}`,
    JSON.stringify({ ...baseBody, subject: "spoofed" }),
    JSON.stringify({ ...baseBody, v: "1" }),
    JSON.stringify({ ...baseBody, audience: "other" }),
    JSON.stringify({ ...baseBody, product: "other" }),
    JSON.stringify({ ...baseBody, extra: {} }),
  ])("rejects duplicate, nested or unapproved protocol fields %#", async (body) => {
    const f = fixture();
    expect((await f.api(f.request("license/bridge", body, { authorization: `Bearer ${token}` }))).status).toBe(400);
    expect(f.auth.verify).not.toHaveBeenCalled();
  });

  it("rejects a session request trying to select a different subject", async () => {
    const f = fixture(); const { cookie } = await f.bridge();
    const sign = vi.fn(f.signer.sign); f.services.signer = { sign };
    const response = await f.api(f.request("license/session", { ...baseBody, subject: crypto.randomUUID() }, { cookie }));
    expect(response.status).toBe(403); expect(await response.json()).toEqual({ error: "subject-mismatch" });
    expect(sign).not.toHaveBeenCalled();
  });

  it("denies unsigned, changed, duplicated and expired cookies", async () => {
    const f = fixture(); const { cookie, encoded } = await f.bridge();
    const changed = encoded.slice(0, 25) + (encoded[25] === "A" ? "B" : "A") + encoded.slice(26);
    for (const candidate of ["", `${cookieName}=unsigned`, `${cookieName}=${changed}`, `${cookie}; ${cookie}`]) {
      expect((await f.api(f.request("license/identity", baseBody, { cookie: candidate }))).status).toBe(401);
    }
    f.setClock(f.principal.expiresAt * 1000);
    expect((await f.api(f.request("license/identity", baseBody, { cookie }))).status).toBe(401);
  });

  it("denies a removed canonical auth session and an epoch changed on another device", async () => {
    const f = fixture(); const { cookie } = await f.bridge();
    f.state.sessionEpoch++;
    expect((await f.api(f.request("license/identity", baseBody, { cookie }))).status).toBe(403);
    f.state.sessionEpoch--; f.removeSession();
    expect((await f.api(f.request("license/identity", baseBody, { cookie }))).status).toBe(401);
  });

  it("rejects even a valid encrypted cookie when its bound subject or session differs from canonical auth", async () => {
    const f = fixture();
    for (const change of [{ subject: crypto.randomUUID() }, { sessionId: crypto.randomUUID() }, { expiresAt: f.principal.expiresAt + 1 }]) {
      const encoded = await f.cookies.seal({ accessToken: token, ...f.principal, sessionEpoch: 2, ...change });
      const response = await f.api(f.request("license/identity", baseBody, { cookie: `${cookieName}=${encoded}` }));
      expect(response.status).toBe(401);
    }
    expect(f.ledger.access).not.toHaveBeenCalled();
  });

  it("returns purchase-required for unpaid access without invoking the signer", async () => {
    const f = fixture(); f.state.active = false; f.state.activeReceiptCount = 0;
    const { cookie } = await f.bridge();
    const sign = vi.fn(f.signer.sign); f.services.signer = { sign };
    expect((await f.api(f.request("license/session", { ...baseBody, subject: f.principal.subject }, { cookie }))).status).toBe(402);
    expect(sign).not.toHaveBeenCalled();
  });

  it.each(["epoch", "refund", "logout", "expiry"] as const)("does not release a grant after %s during asynchronous signing", async (change) => {
    const f = fixture(); const { cookie } = await f.bridge(); const entered = deferred(); const release = deferred();
    f.services.signer = { sign: async (subject) => { entered.resolve(); await release.promise; return f.signer.sign(subject); } };
    const pending = f.api(f.request("license/session", { ...baseBody, subject: f.principal.subject }, { cookie }));
    await entered.promise;
    if (change === "epoch") f.state.sessionEpoch++;
    if (change === "refund") { f.state.active = false; f.state.activeReceiptCount = 0; }
    if (change === "logout") f.removeSession();
    if (change === "expiry") f.setClock(f.principal.expiresAt * 1000);
    release.resolve();
    const response = await pending;
    expect(response.status).toBe(change === "epoch" ? 403 : change === "refund" ? 402 : 401);
    expect(await response.json()).not.toHaveProperty("grant");
  });

  it("requires canonical recent authentication proof before deletion and acknowledges it with 202, never completed", async () => {
    const f = fixture(); const { cookie } = await f.bridge(); const requestId = crypto.randomUUID();
    const bad = await f.api(f.request("account/deletion-request", { ...baseBody, requestId, reauthToken: "wrong" }, { cookie }));
    expect(bad.status).toBe(403); expect(f.ledger.requestDeletion).not.toHaveBeenCalled();
    const response = await f.api(f.request("account/deletion-request", { ...baseBody, requestId, reauthToken: "fixture.recent.proof" }, { cookie }));
    expect(response.status).toBe(202); expect(await response.json()).toEqual({ requestId, status: "requested" });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(f.auth.verifyRecentAuthentication).toHaveBeenLastCalledWith(f.principal, "fixture.recent.proof");
    expect(f.ledger.requestDeletion).toHaveBeenCalledWith(f.principal.subject, requestId);
  });

  it.each(["logout", "expiry", "epoch", "blocked"] as const)("does not request deletion after %s while recent authentication verification was pending", async (change) => {
    const f = fixture(); const { cookie } = await f.bridge(); const entered = deferred(); const release = deferred();
    f.auth.verifyRecentAuthentication.mockImplementation(async () => { entered.resolve(); await release.promise; return true; });
    const pending = f.api(f.request("account/deletion-request", { ...baseBody, requestId: crypto.randomUUID(), reauthToken: "fixture.recent.proof" }, { cookie }));
    await entered.promise;
    if (change === "logout") f.removeSession();
    if (change === "expiry") f.setClock(f.principal.expiresAt * 1000);
    if (change === "epoch") f.state.sessionEpoch++;
    if (change === "blocked") { f.state.accessBlocked = true; f.state.active = false; }
    release.resolve();
    expect((await pending).status).toBe(change === "epoch" || change === "blocked" ? 403 : 401);
    expect(f.ledger.requestDeletion).not.toHaveBeenCalled();
  });

  it("signs out the canonical session, advances the epoch and clears the host cookie", async () => {
    const f = fixture(); const { cookie } = await f.bridge();
    const response = await f.api(f.request("license/sign-out", baseBody, { cookie }));
    expect(response.status).toBe(204); expect(await response.text()).toBe("");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(f.auth.signOut).toHaveBeenCalledWith(token); expect(f.ledger.revokeSessions).toHaveBeenCalledWith(f.principal.subject);
    expect((await f.api(f.request("license/identity", baseBody, { cookie }))).status).toBe(401);
  });

  it("keeps an unconfigured or unverified webhook away from the ledger", async () => {
    const f = fixture();
    expect((await f.api(f.request("payments/webhook/fixture-provider", "provider bytes"))).status).toBe(503);
    const verify = vi.fn(async () => null);
    f.services.payments = { provider: "fixture-provider", verify };
    expect((await f.api(f.request("payments/webhook/other-provider", "provider bytes"))).status).toBe(503);
    expect(verify).not.toHaveBeenCalled();
    expect((await f.api(f.request("payments/webhook/fixture-provider", "provider bytes"))).status).toBe(401);
    expect(f.ledger.applyPayment).not.toHaveBeenCalled();
    expect(f.ledger.enqueueVerifiedEvent).not.toHaveBeenCalled();
  });

  it("passes exact webhook bytes and headers to its verifier, hashes them and delegates idempotency to SQL", async () => {
    const f = fixture(); const bytes = new TextEncoder().encode('{ "provider": "fixture", "amount": 1 }\r\n');
    const event: VerifiedPayment = { eventId: "fixture-event-1", transactionId: "fixture-transaction-1", subject: f.principal.subject,
      product, status: "active", occurredAt: "2026-09-05T12:00:00Z" };
    const seen: Uint8Array[] = [];
    f.services.payments = { provider: "fixture-provider", verify: vi.fn(async (request, raw) => {
      expect(request.headers.get("x-fixture-signature")).toBe("fixture-signature"); seen.push(raw.slice()); return event;
    }) };
    for (let i = 0; i < 2; i++) {
      const request = new Request(`${origin}/planet/api/payments/webhook/fixture-provider`, { method: "POST", body: bytes,
        headers: { "x-fixture-signature": "fixture-signature", "content-type": "application/octet-stream" } });
      expect((await f.api(request)).status).toBe(204);
    }
    expect(seen).toEqual([bytes, bytes]);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
    expect(f.ledger.applyPayment).toHaveBeenCalledTimes(2);
    expect(f.ledger.applyPayment).toHaveBeenLastCalledWith("fixture-provider", event, hash);
    expect(f.ledger.enqueueVerifiedEvent).toHaveBeenCalledTimes(2);
    expect(f.ledger.enqueueVerifiedEvent).toHaveBeenLastCalledWith("fixture-provider", event, hash);
  });

  it("queues a normalized immutable verifier snapshot before apply without copying provider extras", async () => {
    const f = fixture(); const raw = "fixture-signed-message";
    const event = { eventId: "snapshot-event", transactionId: "snapshot-transaction", subject: f.principal.subject,
      product, status: "active" as const, occurredAt: "2026-09-05T12:00:00Z", rawToken: "must-not-be-stored" };
    const expected = { eventId: event.eventId, transactionId: event.transactionId, subject: event.subject,
      product, status: event.status, occurredAt: event.occurredAt };
    const order: string[] = [];
    f.services.payments = { provider: "fixture-provider", verify: async () => event };
    f.ledger.enqueueVerifiedEvent.mockImplementation(async (_provider, snapshot) => {
      order.push("enqueue"); expect(snapshot).toEqual(expected); expect(Object.isFrozen(snapshot)).toBe(true);
      event.eventId = "changed-after-verification"; event.rawToken = "changed-private-field";
    });
    f.ledger.applyPayment.mockImplementation(async (_provider, snapshot) => { order.push("apply"); expect(snapshot).toEqual(expected); });
    expect((await f.api(f.request("payments/webhook/fixture-provider", raw))).status).toBe(204);
    expect(order).toEqual(["enqueue", "apply"]);
    const hash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))).toString("hex");
    expect(f.ledger.enqueueVerifiedEvent).toHaveBeenCalledWith("fixture-provider", expected, hash);
  });

  it("returns no payment acknowledgement when enqueue or apply fails and never reflects private errors", async () => {
    const f = fixture(); const event: VerifiedPayment = { eventId: "durable-event", transactionId: "durable-transaction",
      subject: f.principal.subject, product, status: "active", occurredAt: "2026-09-05T12:00:00Z" };
    f.services.payments = { provider: "fixture-provider", verify: async () => event };
    f.ledger.enqueueVerifiedEvent.mockRejectedValueOnce(new Error("private-queue-details"));
    const failedQueue = await f.api(f.request("payments/webhook/fixture-provider", "verified-message"));
    expect(failedQueue.status).toBe(503); expect(await failedQueue.json()).toEqual({ error: "service-unavailable" });
    expect(f.ledger.applyPayment).not.toHaveBeenCalled();
    f.ledger.applyPayment.mockRejectedValueOnce(new Error("private-ledger-details"));
    const failedApply = await f.api(f.request("payments/webhook/fixture-provider", "verified-message"));
    expect(failedApply.status).toBe(503); expect(await failedApply.json()).toEqual({ error: "service-unavailable" });
    expect(f.ledger.enqueueVerifiedEvent).toHaveBeenCalledTimes(2); expect(f.ledger.applyPayment).toHaveBeenCalledTimes(1);
    const invalid = { ...event, eventId: "invalid id" }; f.services.payments.verify = async () => invalid;
    expect((await f.api(f.request("payments/webhook/fixture-provider", "invalid-normalized-message"))).status).toBe(503);
    expect(f.ledger.enqueueVerifiedEvent).toHaveBeenCalledTimes(2);
  });

  it("binds the webhook ledger hash to received bytes even if the provider adapter mutates its input buffer", async () => {
    const f = fixture(); const bytes = new TextEncoder().encode("unaltered-provider-message");
    const expected = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map(value => value.toString(16).padStart(2, "0")).join("");
    f.services.payments = { provider: "fixture-provider", verify: async (_request, raw) => {
      raw[0] = 0;
      return { eventId: "fixture-event", transactionId: "fixture-transaction", subject: f.principal.subject,
        product, status: "active", occurredAt: "2026-09-05T12:00:00Z" };
    } };
    const response = await f.api(new Request(`${origin}/planet/api/payments/webhook/fixture-provider`, { method: "POST", body: bytes }));
    expect(response.status).toBe(204);
    expect(f.ledger.applyPayment.mock.calls[0][2]).toBe(expected);
  });

  it.each(["auth", "ledger", "signer", "reauth", "webhook"] as const)("does not reflect sensitive %s upstream errors", async (failure) => {
    const f = fixture(); const { cookie } = await f.bridge(); const secret = "fixture-sensitive-password-token-upstream-body";
    const fail = async () => { throw Error(secret); };
    let route = "license/session"; let body: object = { ...baseBody, subject: f.principal.subject };
    if (failure === "auth") f.auth.verify.mockImplementation(fail);
    if (failure === "ledger") f.ledger.access.mockImplementation(fail);
    if (failure === "signer") f.services.signer = { sign: fail };
    if (failure === "reauth") {
      f.auth.verifyRecentAuthentication.mockImplementation(fail); route = "account/deletion-request";
      body = { ...baseBody, requestId: crypto.randomUUID(), reauthToken: secret };
    }
    if (failure === "webhook") { f.services.payments = { provider: "fixture-provider", verify: fail }; route = "payments/webhook/fixture-provider"; }
    const response = await f.api(f.request(route, body, { cookie }));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "service-unavailable" });
    expect([...response.headers.values()].join(" ")).not.toContain(secret);
  });

  it("rejects oversized input before auth and times out an unfinished body even if its first chunk is valid JSON", async () => {
    const f = fixture();
    expect((await f.api(f.request("license/bridge", "x".repeat(8193)))).status).toBe(413);
    expect(f.auth.verify).not.toHaveBeenCalled();
    vi.useFakeTimers();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify(baseBody))); } });
    const options: RequestInit & { duplex: "half" } = { method: "POST", body: stream, duplex: "half",
      headers: { origin, "content-type": "application/json", authorization: `Bearer ${token}` } };
    const pending = f.api(new Request(`${origin}/planet/api/license/bridge`, options));
    await vi.advanceTimersByTimeAsync(10_001);
    expect((await pending).status).toBe(408);
    expect(f.auth.verify).not.toHaveBeenCalled();
  });

  it("rejects invalid UTF-8 and already-aborted requests without invoking authentication", async () => {
    const f = fixture();
    const invalid = new Request(`${origin}/planet/api/license/bridge`, { method: "POST", body: new Uint8Array([0xc3, 0x28]),
      headers: { origin, "content-type": "application/json" } });
    expect((await f.api(invalid)).status).toBe(400);
    const controller = new AbortController(); controller.abort();
    const aborted = new Request(f.request("license/bridge"), { signal: controller.signal });
    expect((await f.api(aborted)).status).toBe(408);
    expect(aborted.body?.locked).toBe(false);
    expect(f.auth.verify).not.toHaveBeenCalled();
  });

  it("exposes only exact local POST endpoints without redirects or permissive preflight", async () => {
    const f = fixture();
    for (const url of [`https://attacker.invalid/planet/api/license/identity`, `${origin}/planet/api/license/identity?x=1`,
      `${origin}/planet/api/license/identity#x`, `${origin}/planet/api/license/identity/`, `${origin}/planet/api/unknown`]) {
      expect((await f.api(new Request(url, { method: "POST", body: JSON.stringify(baseBody) }))).status).toBe(404);
    }
    for (const method of ["GET", "OPTIONS"]) {
      const response = await f.api(f.request("license/identity", baseBody, {}, method));
      expect(response.status).toBe(405); expect(response.headers.get("allow")).toBe("POST");
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
  });
});
