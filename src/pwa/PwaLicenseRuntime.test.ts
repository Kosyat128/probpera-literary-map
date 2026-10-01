import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { WEB_LICENSE_TYPE, WEB_LICENSE_SESSION_PATH, type WebLicenseKey } from "../platform/adapters/web/WebLicense";
import { createPwaLicenseRuntime, PWA_LICENSE_IDENTITY_PATH, type PwaLicenseAuthority, type PwaLicenseRuntimeOptions } from "./PwaLicenseRuntime";

const ORIGIN = "https://probpera.ru";
const NOW = 1_800_000_000;
const SUBJECT = "independent-adult-session-1";
const subtle = webcrypto.subtle as unknown as SubtleCrypto;
let pair: CryptoKeyPair;
let keys: WebLicenseKey[];
const authority = (): PwaLicenseAuthority => ({ issuer: ORIGIN + "/test-authority", audience: "test-web", product: "test-base", trustedKeys: keys });
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const namespace = () => "literary-planet-web-license-v1:" + sha(JSON.stringify([authority().issuer, authority().audience, authority().product]));
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }) };
}
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json; charset=utf-8" } });
function options(extra: Partial<PwaLicenseRuntimeOptions> = {}): PwaLicenseRuntimeOptions {
  return { authority: authority(), origin: ORIGIN, storage: storage(), subtle, now: () => NOW * 1000, ...extra };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function grant(subject = SUBJECT, product = authority().product): Promise<string> {
  const header = { alg: "ES256", typ: WEB_LICENSE_TYPE, kid: keys[0].kid };
  const claims = { v: 1, iss: authority().issuer, aud: authority().audience, sub: subject, product,
    model: "one-time", status: "active", jti: "ephemeral-runtime-test", iat: NOW - 60, nbf: NOW - 60, exp: NOW + 600, offlineUntil: NOW + 120 };
  const input = [header, claims].map((value) => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".");
  const signature = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(input));
  return input + "." + Buffer.from(signature).toString("base64url");
}
function server(token: string) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === ORIGIN + PWA_LICENSE_IDENTITY_PATH) return json({ subject: SUBJECT });
    if (url === ORIGIN + WEB_LICENSE_SESSION_PATH) return json({ grant: token });
    throw new Error("Unexpected request");
  });
}
beforeAll(async () => {
  pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  keys = [{ kid: "ephemeral-runtime-key", jwk: await subtle.exportKey("jwk", pair.publicKey) }];
});
afterEach(() => vi.useRealTimers());

describe("independently established Web license identity", () => {
  it("reuses a current identity client and its wait across online/offline bootstrap without persisting quota", async () => {
    const token = await grant(), store = storage(); let time = NOW * 1000 + 500, grants = 0;
    const fetcher = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.endsWith(PWA_LICENSE_IDENTITY_PATH)) return json({ subject: SUBJECT });
      grants++; return grants === 1 ? json({ grant: token }) : new Response(null, { status: 429, headers: { "Retry-After": "2" } });
    });
    const runtime = createPwaLicenseRuntime(options({ storage: store, fetch: fetcher, now: () => time }));
    const first = await runtime.bootstrap({ mode: "online" }); await first.client!.check({ mode: "online" });
    const saved = [...store.values.entries()]; await first.client!.check({ mode: "online" });
    const again = await runtime.bootstrap({ mode: "online" }); expect(again.client).toBe(first.client);
    const offline = await runtime.bootstrap({ mode: "offline" }); expect(offline.client).toBe(first.client);
    expect(await offline.client!.check({ mode: "offline" })).toMatchObject({ status: "authorized" });
    time += 1999; expect(await again.client!.check({ mode: "online" })).toMatchObject({ reason: "rate-limited" });
    expect(grants).toBe(2); expect([...store.values.entries()]).toEqual(saved);
    time++; expect(await again.client!.check({ mode: "online" })).toMatchObject({ reason: "rate-limited" }); expect(grants).toBe(3);
  });
  it("does not transfer an old identity's wait to a newly verified identity", async () => {
    const other = "independent-adult-session-2", store = storage(); let subject = SUBJECT;
    const token = await grant(other), fetcher = vi.fn<typeof fetch>(async input => String(input).endsWith(PWA_LICENSE_IDENTITY_PATH)
      ? json({ subject }) : subject === SUBJECT ? new Response(null, { status: 429, headers: { "Retry-After": "60" } }) : json({ grant: token }));
    const runtime = createPwaLicenseRuntime(options({ storage: store, fetch: fetcher }));
    const first = await runtime.bootstrap({ mode: "online" }); expect(await first.client!.check({ mode: "online" })).toMatchObject({ reason: "rate-limited" });
    subject = other; const second = await runtime.bootstrap({ mode: "online" }); expect(second.client).not.toBe(first.client);
    expect(await second.client!.check({ mode: "online" })).toMatchObject({ status: "authorized", claims: { sub: other } });
    expect(await first.client!.check({ mode: "online" })).toMatchObject({ reason: "session-denied" });
    expect(store.values.get(namespace() + ":identity")).toBe(other);
  });
  it("does no constructor I/O and defaults to closed without configured authority", async () => {
    const store = storage();
    const fetcher = vi.fn<typeof fetch>();
    const runtime = createPwaLicenseRuntime(options({ authority: null, storage: store, fetch: fetcher }));
    expect(runtime.getSnapshot()).toEqual({ client: null, reason: "not-checked" });
    expect(store.getItem).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(await runtime.bootstrap({ mode: "online" })).toEqual({ client: null, reason: "unconfigured" });
    expect(store.getItem).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("establishes opaque identity only through the exact credentialed same-origin POST", async () => {
    const fetcher = server(await grant());
    const store = storage();
    const runtime = createPwaLicenseRuntime(options({ fetch: fetcher, storage: store }));
    const result = await runtime.bootstrap({ mode: "online" });
    expect(result.reason).toBeNull();
    expect(result.client).not.toBeNull();
    expect(fetcher).toHaveBeenCalledWith(ORIGIN + PWA_LICENSE_IDENTITY_PATH, expect.objectContaining({
      method: "POST", mode: "same-origin", credentials: "include", cache: "no-store", redirect: "error",
      body: JSON.stringify({ v: 1, audience: authority().audience, product: authority().product }),
    }));
    expect(store.values.get(namespace() + ":identity")).toBe(SUBJECT);
    expect([...store.values.keys()]).toEqual([namespace() + ":identity"]);
    expect(result.client?.getSnapshot()).toMatchObject({ status: "denied", reason: "not-checked" });
    expect(await result.client?.check({ mode: "online" })).toMatchObject({ status: "authorized", claims: { sub: SUBJECT } });
    expect([...store.values.keys()]).toContain(namespace() + ":grant:" + sha(SUBJECT));
  });
  it("reuses the same client for the same identity across online/offline bootstrap and transient failure", async () => {
    const fetcher = server(await grant());
    const store = storage();
    const runtime = createPwaLicenseRuntime(options({ fetch: fetcher, storage: store }));
    const first = await runtime.bootstrap({ mode: "online" });
    await first.client?.check({ mode: "online" });
    expect((await runtime.bootstrap({ mode: "online" })).client).toBe(first.client);
    fetcher.mockRejectedValueOnce(new TypeError("Offline"));
    expect(await runtime.bootstrap({ mode: "online" })).toMatchObject({ client: null, reason: "network-unavailable" });
    const offline = await runtime.bootstrap({ mode: "offline" });
    expect(offline.client).toBe(first.client);
    expect(await offline.client?.check({ mode: "offline" })).toMatchObject({ status: "authorized", validUntil: NOW + 120 });
  });
  it("does not discover identity from a signed receipt when separate identity is absent", async () => {
    const store = storage();
    store.values.set(namespace() + ":grant:" + sha(SUBJECT), await grant());
    const fetcher = vi.fn<typeof fetch>();
    const runtime = createPwaLicenseRuntime(options({ storage: store, fetch: fetcher }));
    expect(await runtime.bootstrap({ mode: "offline" })).toEqual({ client: null, reason: "no-cached-grant" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reverifies cached signed bytes after reload and denies context/subject substitutions", async () => {
    const store = storage();
    const runtime = createPwaLicenseRuntime(options({ storage: store, fetch: server(await grant()) }));
    await (await runtime.bootstrap({ mode: "online" })).client?.check({ mode: "online" });
    const reload = createPwaLicenseRuntime(options({ storage: store, fetch: vi.fn() }));
    expect(await (await reload.bootstrap({ mode: "offline" })).client?.check({ mode: "offline" })).toMatchObject({ status: "authorized" });
    store.values.set(namespace() + ":identity", "other-subject");
    store.values.set(namespace() + ":grant:" + sha("other-subject"), await grant());
    const altered = createPwaLicenseRuntime(options({ storage: store }));
    expect(await (await altered.bootstrap({ mode: "offline" })).client?.check({ mode: "offline" })).toMatchObject({ reason: "context-mismatch" });
    const otherProduct = createPwaLicenseRuntime(options({ storage: store, authority: { ...authority(), product: "other-product" } }));
    expect(await otherProduct.bootstrap({ mode: "offline" })).toMatchObject({ reason: "no-cached-grant" });
  });
  it.each([401, 403])("identity HTTP %i clears both records and invalidates retained client instances", async (status) => {
    const store = storage();
    const fetcher = server(await grant());
    const runtime = createPwaLicenseRuntime(options({ storage: store, fetch: fetcher }));
    const first = await runtime.bootstrap({ mode: "online" });
    await first.client?.check({ mode: "online" });
    fetcher.mockResolvedValueOnce(new Response(null, { status }));
    expect(await runtime.bootstrap({ mode: "online" })).toEqual({ client: null, reason: "session-denied" });
    expect(store.values.size).toBe(0);
    expect(await first.client?.check({ mode: "offline" })).toMatchObject({ reason: "session-denied" });
    expect(first.client?.getSnapshot()).toMatchObject({ reason: "session-denied" });
    expect(await runtime.bootstrap({ mode: "offline" })).toMatchObject({ reason: "session-denied" });
    expect(await createPwaLicenseRuntime(options({ storage: store })).bootstrap({ mode: "offline" })).toMatchObject({ reason: "no-cached-grant" });
  });
  it("license-session denial also clears separately cached identity and receipt", async () => {
    const store = storage();
    const fetcher = server(await grant());
    const runtime = createPwaLicenseRuntime(options({ storage: store, fetch: fetcher }));
    const result = await runtime.bootstrap({ mode: "online" });
    await result.client?.check({ mode: "online" });
    fetcher.mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect(await result.client?.check({ mode: "online" })).toMatchObject({ reason: "session-denied" });
    expect(store.values.size).toBe(0);
    expect(await runtime.bootstrap({ mode: "offline" })).toMatchObject({ reason: "no-cached-grant" });
  });
});

describe("strict authority, identity response and storage handling", () => {
  it.each([
    {}, { issuer: "x", audience: "y", product: "z", trustedKeys: [] },
    { issuer: "x", audience: "y", product: "z", trustedKeys: [{ kid: "private", jwk: { kty: "EC", crv: "P-256", d: "private" } }] },
  ])("rejects malformed/untrusted authority configuration %# before discovery", async (config) => {
    const fetcher = vi.fn<typeof fetch>();
    const runtime = createPwaLicenseRuntime(options({ authority: config as PwaLicenseAuthority, fetch: fetcher }));
    expect(await runtime.bootstrap({ mode: "online" })).toMatchObject({ client: null, reason: "invalid-key" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["http://probpera.ru", "https://probpera.ru/path", "http://localhost:4173", "https://user:secret@probpera.ru"])("rejects unsafe origin %s without production HTTP exceptions", async (origin) => {
    const runtime = createPwaLicenseRuntime(options({ origin, fetch: vi.fn() }));
    expect(await runtime.bootstrap({ mode: "online" })).toMatchObject({ reason: "unconfigured" });
  });
  it.each([
    '{}', '{"subject":""}', '{"subject":"x","subject":"y"}', '{"subject":"x","paid":true}',
    '{"subject":{"sub":"x"}}', '{"subject":"../../account"}', '{"subject":"user name"}',
    JSON.stringify({ subject: "a".repeat(257) }), JSON.stringify({ subject: "a".repeat(3000) }),
  ])("rejects malformed/ambiguous identity response %#", async (body) => {
    const store = storage();
    const runtime = createPwaLicenseRuntime(options({ storage: store, fetch: async () => new Response(body, { headers: { "Content-Type": "application/json" } }) }));
    expect(await runtime.bootstrap({ mode: "online" })).toMatchObject({ client: null, reason: "invalid-response" });
    expect(store.values.size).toBe(0);
  });
  it("rejects a redirected or HTML identity response even with an apparent subject", async () => {
    for (const response of [new Response('{"subject":"x"}', { headers: { "Content-Type": "text/html" } }), Object.defineProperty(json({ subject: SUBJECT }), "redirected", { value: true })]) {
      expect(await createPwaLicenseRuntime(options({ fetch: async () => response })).bootstrap({ mode: "online" })).toMatchObject({ reason: "invalid-response" });
    }
  });
  it("reports initial storage read/write failures and does not create a client", async () => {
    const readFailure = storage();
    readFailure.getItem.mockImplementation(() => { throw new Error("Blocked storage"); });
    expect(await createPwaLicenseRuntime(options({ storage: readFailure })).bootstrap({ mode: "online" })).toMatchObject({ reason: "cache-unavailable" });
    const noWrite = storage();
    noWrite.setItem.mockImplementation(() => undefined);
    expect(await createPwaLicenseRuntime(options({ storage: noWrite, fetch: async () => json({ subject: SUBJECT }) })).bootstrap({ mode: "online" })).toMatchObject({ client: null, reason: "cache-unavailable" });
    expect(await createPwaLicenseRuntime(options({ storage: null })).bootstrap({ mode: "online" })).toMatchObject({ reason: "cache-unavailable" });
  });
  it("does not expose a newly authorized result when signed-grant persistence fails", async () => {
    const store = storage();
    store.setItem.mockImplementation((key, value) => { if (key.includes(":grant:")) throw new Error("Quota"); store.values.set(key, value); });
    const runtime = createPwaLicenseRuntime(options({ storage: store, fetch: server(await grant()) }));
    const result = await runtime.bootstrap({ mode: "online" });
    expect(await result.client?.check({ mode: "online" })).toMatchObject({ status: "denied", reason: "cache-unavailable" });
    expect(result.client?.getSnapshot()).toMatchObject({ status: "denied", reason: "cache-unavailable" });
    expect(store.values.size).toBe(0);
  });
});

describe("bootstrap timeouts and competing identity/license requests", () => {
  it("cancels a stalled identity body on the bounded deadline", async () => {
    vi.useFakeTimers();
    const reading = deferred<void>();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull() { reading.resolve(); }, cancel }, { highWaterMark: 0 });
    const runtime = createPwaLicenseRuntime(options({ timeoutMs: 1000, fetch: async () => new Response(body, { headers: { "Content-Type": "application/json" } }) }));
    const checking = runtime.bootstrap({ mode: "online" });
    await reading.promise;
    // Response stream startup can precede the fetch continuation by a microtask.
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1001);
    expect(await checking).toMatchObject({ reason: "timeout" });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("external abort settles even when a transport ignores its signal", async () => {
    const started = deferred<void>();
    const runtime = createPwaLicenseRuntime(options({ fetch: () => { started.resolve(); return new Promise(() => undefined); } }));
    const abort = new AbortController();
    const checking = runtime.bootstrap({ mode: "online", signal: abort.signal });
    await started.promise;
    abort.abort();
    expect(await checking).toMatchObject({ reason: "cancelled" });
  });
  it("an old identity response cannot override a newer denial", async () => {
    const started = deferred<void>();
    const old = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => { started.resolve(); return old.promise; }).mockResolvedValueOnce(new Response(null, { status: 403 }));
    const store = storage();
    const runtime = createPwaLicenseRuntime(options({ storage: store, fetch: fetcher }));
    const first = runtime.bootstrap({ mode: "online" });
    await started.promise;
    expect(await runtime.bootstrap({ mode: "online" })).toMatchObject({ reason: "session-denied" });
    old.resolve(json({ subject: SUBJECT }));
    expect(await first).toMatchObject({ reason: "cancelled" });
    expect(runtime.getSnapshot()).toMatchObject({ client: null, reason: "session-denied" });
    expect(store.values.size).toBe(0);
  });
  it("a delayed old signed license cannot restore identity after a newer identity denial", async () => {
    const store = storage();
    const old = deferred<Response>();
    const started = deferred<void>();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ subject: SUBJECT }))
      .mockImplementationOnce(() => { started.resolve(); return old.promise; }).mockResolvedValueOnce(new Response(null, { status: 403 }));
    const runtime = createPwaLicenseRuntime(options({ storage: store, fetch: fetcher }));
    const first = await runtime.bootstrap({ mode: "online" });
    const checking = first.client!.check({ mode: "online" });
    await started.promise;
    expect(await runtime.bootstrap({ mode: "online" })).toMatchObject({ reason: "session-denied" });
    old.resolve(json({ grant: await grant() }));
    expect(await checking).toMatchObject({ status: "denied", reason: "session-denied" });
    expect(store.values.size).toBe(0);
  });
  it("old-client cleanup preserves a newly established different identity and its verified grant", async () => {
    const store = storage();
    const old = deferred<Response>();
    const started = deferred<void>();
    const other = "independent-adult-session-2";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ subject: SUBJECT }))
      .mockImplementationOnce(() => { started.resolve(); return old.promise; })
      .mockResolvedValueOnce(json({ subject: other })).mockResolvedValueOnce(json({ grant: await grant(other) }));
    const runtime = createPwaLicenseRuntime(options({ storage: store, fetch: fetcher }));
    const first = await runtime.bootstrap({ mode: "online" });
    const checking = first.client!.check({ mode: "online" });
    await started.promise;
    const second = await runtime.bootstrap({ mode: "online" });
    expect(second.client).not.toBe(first.client);
    expect(await second.client?.check({ mode: "online" })).toMatchObject({ status: "authorized", claims: { sub: other } });
    old.resolve(json({ grant: await grant() }));
    expect(await checking).toMatchObject({ reason: "session-denied" });
    expect(store.values.get(namespace() + ":identity")).toBe(other);
    expect(await second.client?.check({ mode: "offline" })).toMatchObject({ status: "authorized", claims: { sub: other } });
  });
});
