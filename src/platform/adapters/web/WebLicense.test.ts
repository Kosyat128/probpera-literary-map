import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  createWebLicenseClient,
  verifyWebLicenseGrant,
  WEB_LICENSE_SESSION_PATH,
  WEB_LICENSE_TYPE,
  type WebLicenseCache,
  type WebLicenseClaims,
  type WebLicenseContext,
  type WebLicenseKey,
} from "./WebLicense";

const subtle = webcrypto.subtle as unknown as SubtleCrypto;
const current = 1_800_000_000;
const context: WebLicenseContext = {
  issuer: "https://probpera.ru/planet/license-authority",
  audience: "literary-planet-web",
  product: "test-base-edition",
  subject: "independently-established-test-subject",
};
let pair: CryptoKeyPair;
let trustedKeys: WebLicenseKey[];
function base64url(value: string | ArrayBuffer): string {
  return Buffer.from(typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value)).toString("base64url");
}
function claims(overrides: Partial<WebLicenseClaims> = {}): WebLicenseClaims {
  return { v: 1, iss: context.issuer, aud: context.audience, sub: context.subject, product: context.product,
    model: "one-time", status: "active", jti: "test-only-license-assertion",
    iat: current - 60, nbf: current - 60, exp: current + 3600, offlineUntil: current + 300, ...overrides };
}
async function sign(payload: object | string = claims(), header: object | string = { alg: "ES256", typ: WEB_LICENSE_TYPE, kid: "ephemeral-test" }, key?: CryptoKey) {
  const input = `${base64url(typeof header === "string" ? header : JSON.stringify(header))}.${base64url(typeof payload === "string" ? payload : JSON.stringify(payload))}`;
  const signature = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key ?? pair.privateKey, new TextEncoder().encode(input));
  return `${input}.${base64url(signature)}`;
}
const verify = (token: unknown, overrides: Parameters<typeof verifyWebLicenseGrant>[2] = {}) =>
  verifyWebLicenseGrant(token, context, { trustedKeys, subtle, now: () => current * 1000, ...overrides });
function cache(initial: string | null = null) {
  let stored = initial;
  return {
    read: vi.fn(async () => stored),
    write: vi.fn(async (grant: string) => { stored = grant; }),
    remove: vi.fn(async () => { stored = null; }),
    stored: () => stored,
  } satisfies WebLicenseCache & { stored(): string | null };
}
function response(grant: string) {
  return new Response(JSON.stringify({ grant }), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
function client(extra: Partial<Parameters<typeof createWebLicenseClient>[0]> = {}) {
  return createWebLicenseClient({ context, trustedKeys, subtle, now: () => current * 1000, origin: "https://probpera.ru", ...extra });
}
beforeAll(async () => {
  // Actual signatures, with a fresh key generated only in the test process.
  pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  trustedKeys = [{ kid: "ephemeral-test", jwk: await subtle.exportKey("jwk", pair.publicKey) }];
});

describe("signed one-time Web grant verification", () => {
  it("verifies real ES256 bytes and returns immutable, strictly scoped claims", async () => {
    const token = await sign();
    const result = await verify(token);
    expect(result).toEqual({ status: "authorized", claims: claims(), validUntil: current + 3600 });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.status === "authorized") expect(Object.isFrozen(result.claims)).toBe(true);
    expect(await verify(token, { mode: "offline" })).toMatchObject({ status: "authorized", validUntil: current + 300 });
  });
  it("has no production trust keys or implicit crypto fallback for explicit SSR", async () => {
    expect(await verify(await sign(), { trustedKeys: [] })).toEqual({ status: "denied", reason: "unconfigured" });
    expect(await verify(await sign(), { subtle: null })).toEqual({ status: "denied", reason: "crypto-unavailable" });
  });
  it.each(["iss", "aud", "sub", "product"] as const)("rejects a genuine signature with the wrong %s", async (field) => {
    expect(await verify(await sign(claims({ [field]: "different-context" })))).toEqual({ status: "denied", reason: "context-mismatch" });
  });
  it("rejects tampering, other private keys, malformed signatures and unsigned paid flags", async () => {
    const token = await sign();
    const parts = token.split(".");
    expect(await verify(`${parts[0]}.${base64url(JSON.stringify(claims({ sub: "attacker" })))}.${parts[2]}`)).toMatchObject({ reason: "invalid-signature" });
    const other = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    expect(await verify(await sign(claims(), undefined, other.privateKey))).toMatchObject({ reason: "invalid-signature" });
    expect(await verify(`${parts[0]}.${parts[1]}.AA`)).toMatchObject({ reason: "invalid-signature" });
    expect(await verify({ paid: true, lastVerified: current })).toMatchObject({ reason: "malformed" });
  });
  it.each([
    { alg: "none", typ: WEB_LICENSE_TYPE, kid: "ephemeral-test" },
    { alg: "HS256", typ: WEB_LICENSE_TYPE, kid: "ephemeral-test" },
    { alg: "ES384", typ: WEB_LICENSE_TYPE, kid: "ephemeral-test" },
    { alg: "ES256", typ: "JWT", kid: "ephemeral-test" },
    { alg: "ES256", typ: WEB_LICENSE_TYPE, kid: "ephemeral-test", jku: "https://attacker.invalid/keys" },
    { alg: "ES256", typ: WEB_LICENSE_TYPE, kid: "ephemeral-test", crit: "custom" },
    { alg: "ES256", typ: WEB_LICENSE_TYPE, kid: "ephemeral-test", b64: false },
  ])("rejects unsupported header and key discovery %#", async (header) => {
    expect(await verify(await sign(claims(), header))).toMatchObject({ reason: "unsupported-header" });
  });
  it("rejects unknown or duplicate key IDs and private/symmetric/incorrect-use keys", async () => {
    expect(await verify(await sign(claims(), { alg: "ES256", typ: WEB_LICENSE_TYPE, kid: "unknown" }))).toMatchObject({ reason: "unknown-key" });
    const jwk = trustedKeys[0].jwk;
    for (const changed of [{ ...jwk, d: "private" }, { kty: "oct", k: "secret" }, { ...jwk, alg: "HS256" }, { ...jwk, use: "enc" }, { ...jwk, key_ops: ["sign"] }, { ...jwk, crv: "P-384" }, { ...jwk, x: "AA" }]) {
      expect(await verify(await sign(), { trustedKeys: [{ kid: "ephemeral-test", jwk: changed }] })).toMatchObject({ reason: "invalid-key" });
    }
    expect(await verify(await sign(), { trustedKeys: [trustedKeys[0], trustedKeys[0]] })).toMatchObject({ reason: "invalid-key" });
  });
  it("rejects duplicate JSON keys, invalid UTF-8, nested claims and noncanonical encodings", async () => {
    const payload = JSON.stringify(claims());
    expect(await verify(await sign(payload.replace('"v":1', '"v":1,"\\u0076":1')))).toMatchObject({ reason: "malformed" });
    expect(await verify(await sign({ ...claims(), extra: { paid: true } }))).toMatchObject({ reason: "malformed" });
    const token = await sign();
    const parts = token.split(".");
    expect(await verify(`${parts[0]}=.${parts[1]}.${parts[2]}`)).toMatchObject({ reason: "malformed" });
    expect(await verify(`${parts[0]}.wA.${parts[2]}`)).toMatchObject({ reason: "malformed" });
    expect(await verify("A".repeat(20_000))).toMatchObject({ reason: "malformed" });
  });
  it.each([
    { status: "unknown" }, { v: 2 }, { model: "subscription" }, { iat: 1.5 }, { exp: "1900000000" },
    { offlineUntil: current + 3601 }, { offlineUntil: current - 61 }, { nbf: current + 3600 },
    { exp: -1 }, { jti: "" }, { lastVerified: current },
  ])("rejects invalid/extended claim set %#", async (changed) => {
    expect(await verify(await sign({ ...claims(), ...changed }))).toMatchObject({ reason: "invalid-claims" });
  });
  it("enforces exact signed time boundaries with no grace and no inferred purchase expiry", async () => {
    const token = await sign();
    expect(await verify(token, { now: () => (current - 61) * 1000 })).toMatchObject({ reason: "clock-skew" });
    expect(await verify(await sign(claims({ nbf: current + 1 })))).toMatchObject({ reason: "not-yet-valid" });
    expect(await verify(token, { now: () => (current + 3600) * 1000 })).toMatchObject({ reason: "expired" });
    expect(await verify(token, { mode: "offline", now: () => (current + 300) * 1000 })).toMatchObject({ reason: "offline-expired" });
    expect(await verify(token, { mode: "online", now: () => (current + 300) * 1000 })).toMatchObject({ status: "authorized" });
    expect(await verify(token, { now: () => NaN })).toMatchObject({ reason: "clock-skew" });
  });
  it.each(["revoked", "refunded"] as const)("never authorizes signed %s status online or offline", async (status) => {
    for (const mode of ["online", "offline"] as const) expect(await verify(await sign(claims({ status })), { mode })).toEqual({ status: "denied", reason: status });
  });
});

describe("same-origin Web license session client", () => {
  it("does not fetch at creation, sends a credentialed JSON POST without secrets in URL, and caches only verified bytes", async () => {
    const token = await sign();
    const store = cache();
    const fetcher = vi.fn<typeof fetch>(async () => response(token));
    const service = client({ fetch: fetcher, cache: store });
    expect(fetcher).not.toHaveBeenCalled();
    expect(service.getSnapshot()).toMatchObject({ status: "denied", reason: "not-checked" });
    expect(await service.check({ mode: "online" })).toMatchObject({ status: "authorized" });
    expect(fetcher).toHaveBeenCalledWith(`https://probpera.ru${WEB_LICENSE_SESSION_PATH}`, expect.objectContaining({
      method: "POST", credentials: "include", mode: "same-origin", redirect: "error", cache: "no-store",
      body: JSON.stringify({ v: 1, audience: context.audience, product: context.product, subject: context.subject }),
    }));
    expect(store.stored()).toBe(token);
    expect(await service.check({ mode: "offline" })).toMatchObject({ status: "authorized", validUntil: current + 300 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("denies unconfigured trust and invalid origins before network access; loopback requires explicit QA", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response(await sign()));
    expect(await client({ trustedKeys: [], fetch: fetcher }).check({ mode: "online" })).toMatchObject({ reason: "unconfigured" });
    for (const origin of ["http://probpera.ru", "https://probpera.ru/path", "https://user:secret@probpera.ru", "http://localhost:4173", "https://probpera.ru/?token=secret"]) {
      expect(await client({ origin, fetch: fetcher }).check({ mode: "online" })).toMatchObject({ reason: "unconfigured" });
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(await client({ origin: "http://localhost:4173", allowLocalQa: true, fetch: fetcher }).check({ mode: "online" })).toMatchObject({ status: "authorized" });
  });
  it("fails closed on malformed trust configuration instead of throwing during client construction", async () => {
    for (const invalid of [null, {}, [null], [{ kid: "bad", jwk: null }], [{ kid: "bad", jwk: { key_ops: true } }]]) {
      const service = client({ trustedKeys: invalid as unknown as WebLicenseKey[] });
      expect(await service.check({ mode: "online" })).toMatchObject({ status: "denied" });
    }
  });
  it("re-verifies offline bytes against the independent identity and denies local paid/timestamp metadata", async () => {
    const token = await sign();
    expect(await client({ cache: cache(token), context: { ...context, subject: "other-user" } }).check({ mode: "offline" })).toMatchObject({ reason: "context-mismatch" });
    expect(await client({ cache: cache(JSON.stringify({ paid: true, lastVerified: current, grant: token })) }).check({ mode: "offline" })).toMatchObject({ reason: "malformed" });
    expect(await client().check({ mode: "offline" })).toMatchObject({ reason: "no-cached-grant" });
  });
  it.each([401, 402, 403, 410])("denial HTTP %i invalidates cached authorization and wins subsequent offline checks", async (status) => {
    const store = cache(await sign());
    const service = client({ cache: store, fetch: async () => new Response(null, { status }) });
    expect(await service.check({ mode: "offline" })).toMatchObject({ status: "authorized" });
    expect(await service.check({ mode: "online" })).toMatchObject({ reason: "session-denied" });
    expect(store.stored()).toBeNull();
    expect(await service.check({ mode: "offline" })).toMatchObject({ reason: "session-denied" });
  });
  it.each(["revoked", "refunded"] as const)("signed %s clears the old active grant", async (status) => {
    const store = cache(await sign());
    const service = client({ cache: store, fetch: async () => response(await sign(claims({ status }))) });
    expect(await service.check({ mode: "online" })).toMatchObject({ reason: status });
    expect(store.stored()).toBeNull();
    expect(await service.check({ mode: "offline" })).toMatchObject({ reason: "session-denied" });
  });
  it("does not infer permission from network failure, but separately verifies the signed offline window", async () => {
    let time = current;
    const service = client({ cache: cache(await sign()), now: () => time * 1000, fetch: async () => { throw new TypeError("Offline"); } });
    expect(await service.check({ mode: "online" })).toMatchObject({ reason: "network-unavailable" });
    expect(await service.check({ mode: "offline" })).toMatchObject({ status: "authorized" });
    time += 300;
    expect(await service.check({ mode: "offline" })).toMatchObject({ reason: "offline-expired" });
  });
  it("enforces in-process clock rollback and removes permission from a stale snapshot at expiry", async () => {
    let time = current;
    const service = client({ cache: cache(await sign()), now: () => time * 1000 });
    await service.check({ mode: "offline" });
    time -= 1;
    expect(service.getSnapshot()).toMatchObject({ reason: "clock-skew" });
    expect(await service.check({ mode: "offline" })).toMatchObject({ reason: "clock-skew" });
    time = current;
    await service.check({ mode: "offline" });
    time += 300;
    expect(service.getSnapshot()).toMatchObject({ reason: "expired" });
  });
  it("rejects HTML, duplicate/extra JSON properties, oversized responses and invalid grants instead of falling back", async () => {
    for (const badResponse of [
      new Response("<html>public shell</html>", { headers: { "Content-Type": "text/html" } }),
      new Response('{"grant":"x","grant":"y"}', { headers: { "Content-Type": "application/json" } }),
      new Response(JSON.stringify({ grant: await sign(), paid: true }), { headers: { "Content-Type": "application/json" } }),
      new Response(JSON.stringify({ grant: "x".repeat(20_000) }), { headers: { "Content-Type": "application/json" } }),
      response("invalid"),
    ]) {
      const store = cache(await sign());
      const service = client({ cache: store, fetch: async () => badResponse });
      expect(await service.check({ mode: "online" })).toMatchObject({ status: "denied" });
      expect(store.stored()).toBeNull();
      expect(await service.check({ mode: "offline" })).toMatchObject({ reason: "session-denied" });
    }
  });
  it("settles on timeout and external cancellation even if a transport ignores AbortSignal", async () => {
    let requestSignal: AbortSignal | null | undefined;
    const service = client({ timeoutMs: 10, fetch: (_url, request) => { requestSignal = request?.signal; return new Promise(() => undefined); } });
    expect(await service.check({ mode: "online" })).toMatchObject({ reason: "timeout" });
    expect(requestSignal?.aborted).toBe(true);
    const controller = new AbortController();
    const check = service.check({ mode: "online", signal: controller.signal });
    controller.abort();
    expect(await check).toMatchObject({ reason: "cancelled" });
  });
  it("cancels an unending response body at the same deadline", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const service = client({ timeoutMs: 10, fetch: async () => new Response(body, { headers: { "Content-Type": "application/json" } }) });
    expect(await service.check({ mode: "online" })).toMatchObject({ reason: "timeout" });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("a newer denial wins over an older signed response that ignores cancellation", async () => {
    let completeOld!: (response: Response) => void;
    const token = await sign();
    const store = cache(token);
    const fetcher = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise((resolve) => { completeOld = resolve; }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    const service = client({ cache: store, fetch: fetcher });
    const oldCheck = service.check({ mode: "online" });
    const newCheck = service.check({ mode: "online" });
    expect(await newCheck).toMatchObject({ reason: "session-denied" });
    completeOld(response(token));
    expect(await oldCheck).toMatchObject({ reason: "cancelled" });
    expect(service.getSnapshot()).toMatchObject({ reason: "session-denied" });
    expect(store.stored()).toBeNull();
  });
  it("serializes a pending older cache write before a newer revocation removal", async () => {
    let completeWrite!: () => void;
    let beganWrite!: () => void;
    const writing = new Promise<void>((resolve) => { beganWrite = resolve; });
    let stored: string | null = null;
    const token = await sign();
    const store: WebLicenseCache = {
      read: async () => stored,
      write: async (grant) => { beganWrite(); await new Promise<void>((resolve) => { completeWrite = resolve; }); stored = grant; },
      remove: async () => { stored = null; },
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(token)).mockResolvedValueOnce(new Response(null, { status: 403 }));
    const service = client({ cache: store, fetch: fetcher });
    const first = service.check({ mode: "online" });
    await writing;
    const second = service.check({ mode: "online" });
    completeWrite();
    expect(await first).toMatchObject({ reason: "cancelled" });
    expect(await second).toMatchObject({ reason: "session-denied" });
    expect(stored).toBeNull();
  });
  it("does not claim offline persistence after storage failure, while an actual online signature remains valid", async () => {
    const store: WebLicenseCache = { read: async () => { throw new Error("Blocked storage"); }, write: async () => { throw new Error("Quota"); }, remove: async () => { throw new Error("Blocked storage"); } };
    const service = client({ cache: store, fetch: async () => response(await sign()) });
    expect(await service.check({ mode: "online" })).toMatchObject({ status: "authorized" });
    expect(await service.check({ mode: "offline" })).toMatchObject({ reason: "cache-unavailable" });
  });
  it("a known denial still removes a late old write when a third offline check supersedes its request", async () => {
    let releaseWrite!: () => void;
    let beginWrite!: () => void;
    let removed!: () => void;
    const writing = new Promise<void>((resolve) => { beginWrite = resolve; });
    const removal = new Promise<void>((resolve) => { removed = resolve; });
    let stored: string | null = null;
    const token = await sign();
    const store: WebLicenseCache = {
      read: async () => stored,
      write: async (grant) => { beginWrite(); await new Promise<void>((resolve) => { releaseWrite = resolve; }); stored = grant; },
      remove: async () => { stored = null; removed(); },
    };
    const service = client({ cache: store, fetch: vi.fn<typeof fetch>().mockResolvedValueOnce(response(token)).mockResolvedValueOnce(new Response(null, { status: 403 })) });
    const first = service.check({ mode: "online" });
    await writing;
    const second = service.check({ mode: "online" });
    // The decision settles while the older write is still stalled; invalidation
    // remains queued after it even after a subsequent offline check.
    expect(await second).toMatchObject({ reason: "session-denied" });
    expect(await service.check({ mode: "offline" })).toMatchObject({ reason: "session-denied" });
    releaseWrite();
    await removal;
    expect(await first).toMatchObject({ reason: "cancelled" });
    expect(stored).toBeNull();
    expect(await client({ cache: store }).check({ mode: "offline" })).toMatchObject({ reason: "no-cached-grant" });
  });
  it.each([401, 402, 403, "revoked", "refunded"] as const)("known %s closes immediately while durable removal is stalled", async (denial) => {
    const oldGrant = await sign();
    let stored: string | null = oldGrant;
    let releaseRemoval!: () => void;
    let startedRemoval!: () => void;
    const removing = new Promise<void>((resolve) => { startedRemoval = resolve; });
    const removeFinished = new Promise<void>((resolve) => { releaseRemoval = resolve; });
    const store: WebLicenseCache = {
      read: async () => stored,
      write: async (grant) => { stored = grant; },
      remove: async () => { startedRemoval(); await removeFinished; stored = null; },
    };
    const reply = typeof denial === "number" ? new Response(null, { status: denial }) : response(await sign(claims({ status: denial })));
    const service = client({ cache: store, fetch: async () => reply });
    expect(await service.check({ mode: "offline" })).toMatchObject({ status: "authorized" });
    const request = new AbortController();
    // This await intentionally precedes releaseRemoval. An awaited cache purge
    // would stall until the request timeout instead of returning the denial.
    expect(await service.check({ mode: "online", signal: request.signal })).toMatchObject({
      status: "denied", reason: typeof denial === "number" ? "session-denied" : denial,
    });
    expect(service.getSnapshot()).toMatchObject({ status: "denied" });
    await removing;
    expect(stored).toBe(oldGrant);
    request.abort();
    expect(await service.check({ mode: "offline" })).toMatchObject({ reason: "session-denied" });
    releaseRemoval();
    await removeFinished;
    // Allow the native queue continuation to finish the durable removal.
    await Promise.resolve();
    expect(stored).toBeNull();
  });
  it("orders a later verified grant write after the irrevocable pending denial purge", async () => {
    const oldGrant = await sign();
    const newGrant = await sign(claims({ jti: "later-authority-assertion" }));
    let stored: string | null = oldGrant;
    let releaseRemoval!: () => void;
    let writeStarted!: () => void;
    const removing = new Promise<void>((resolve) => { releaseRemoval = resolve; });
    const written = new Promise<void>((resolve) => { writeStarted = resolve; });
    const operations: string[] = [];
    const store: WebLicenseCache = {
      read: async () => stored,
      remove: async () => { operations.push("remove-start"); await removing; stored = null; operations.push("remove-end"); },
      write: async (grant) => { operations.push("write"); stored = grant; writeStarted(); },
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 403 })).mockResolvedValueOnce(response(newGrant));
    const service = client({ cache: store, fetch: fetcher });
    expect(await service.check({ mode: "online" })).toMatchObject({ reason: "session-denied" });
    const renewed = service.check({ mode: "online" });
    expect(operations).toEqual(["remove-start"]);
    releaseRemoval();
    await written;
    expect(await renewed).toMatchObject({ status: "authorized", claims: { jti: "later-authority-assertion" } });
    expect(operations).toEqual(["remove-start", "remove-end", "write"]);
    expect(stored).toBe(newGrant);
  });
});
