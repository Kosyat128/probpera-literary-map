import { beforeAll, describe, expect, it } from "vitest";
import { verifyWebLicenseGrant } from "../../src/platform/adapters/web/WebLicense";
import { createCookieCodec, createGrantSigner, type CookiePayload, type GrantSignerOptions } from "./crypto";

const subject = "bf1804aa-d40d-41c3-895d-27b643c36fa8";
const sessionId = "3caa6d18-bc61-4917-9a6a-55c03c758982";
const origin = "https://probpera.ru";
const cookieName = "__Host-planet-license";
const nowSeconds = 1_788_576_000;
const payload: CookiePayload = { accessToken: "verified.existing.supabase-token", subject, sessionId, sessionEpoch: 0, expiresAt: nowSeconds + 3600 };
const context = { issuer: "https://probpera.ru/planet", audience: "literary-planet-web", product: "base-edition", subject };
let cookieKey: CryptoKey;
let otherCookieKey: CryptoKey;
let extractableCookieKey: CryptoKey;
let shortCookieKey: CryptoKey;
let encryptionOnlyKey: CryptoKey;
let signingKeys: CryptoKeyPair;
let extractableSigningKeys: CryptoKeyPair;
let wrongCurveKeys: CryptoKeyPair;
let publicJwk: JsonWebKey;

beforeAll(async () => {
  [cookieKey, otherCookieKey, extractableCookieKey, shortCookieKey, encryptionOnlyKey] = await Promise.all([
    crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]),
    crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]),
    crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]),
    crypto.subtle.generateKey({ name: "AES-GCM", length: 128 }, false, ["encrypt", "decrypt"]),
    crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt"]),
  ]);
  [signingKeys, extractableSigningKeys, wrongCurveKeys] = await Promise.all([
    crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]),
    crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]),
    crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-384" }, false, ["sign", "verify"]),
  ]);
  publicJwk = await crypto.subtle.exportKey("jwk", signingKeys.publicKey);
});

const codec = (key = cookieKey) => createCookieCodec({ key, origin, cookieName });
function signerOptions(overrides: Partial<GrantSignerOptions> = {}): GrantSignerOptions {
  return { privateKey: signingKeys.privateKey, kid: "test-ephemeral", ...context,
    grantSeconds: 3600, offlineSeconds: 600, now: () => nowSeconds * 1000, ...overrides };
}
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
async function encryptedPlaintext(source: string | Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(JSON.stringify({ version: 1, origin, cookieName }));
  const bytes = typeof source === "string" ? new TextEncoder().encode(source) : Uint8Array.from(source);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 }, cookieKey, bytes);
  return "v1." + b64(iv) + "." + b64(new Uint8Array(ciphertext));
}

describe("server cookie envelope with actual AES-GCM", () => {
  it("roundtrips the verified identity snapshot without exposing access token/subject and uses a new IV", async () => {
    const api = codec();
    const first = await api.seal(payload);
    const second = await api.seal(payload);
    expect(first).not.toContain(payload.accessToken);
    expect(first).not.toContain(subject);
    expect(first.split(".")[1]).not.toBe(second.split(".")[1]);
    expect(first.length).toBeLessThanOrEqual(3800);
    const opened = await api.open(first, nowSeconds);
    expect(opened).toEqual(payload);
    expect(Object.isFrozen(opened)).toBe(true);
  });
  it("accepts the maximum ASCII token while keeping the encrypted cookie within its independent bound", async () => {
    const maximum = { ...payload, accessToken: "a".repeat(2500), sessionEpoch: Number.MAX_SAFE_INTEGER };
    const value = await codec().seal(maximum);
    expect(value.length).toBeLessThanOrEqual(3800);
    expect(await codec().open(value, nowSeconds)).toEqual(maximum);
  });
  it("fails closed at the exact exclusive expiry and never derives identity from cookie text", async () => {
    const value = await codec().seal(payload);
    expect(await codec().open(value, payload.expiresAt - 1)).toEqual(payload);
    expect(await codec().open(value, payload.expiresAt)).toBeNull();
    expect(await codec().open(value, payload.expiresAt + 1)).toBeNull();
    expect(await codec().open(JSON.stringify(payload), nowSeconds)).toBeNull();
  });
  it("binds encryption to the exact origin, cookie name and key", async () => {
    const value = await codec().seal(payload);
    expect(await createCookieCodec({ key: cookieKey, origin: "https://other.test", cookieName }).open(value, nowSeconds)).toBeNull();
    expect(await createCookieCodec({ key: cookieKey, origin, cookieName: "__Host-other" }).open(value, nowSeconds)).toBeNull();
    expect(await codec(otherCookieKey).open(value, nowSeconds)).toBeNull();
  });
  it.each(["iv", "ciphertext"])("rejects tampered %s with otherwise valid encoding", async (field) => {
    const parts = (await codec().seal(payload)).split(".");
    const index = field === "iv" ? 1 : 2;
    parts[index] = (parts[index][0] === "A" ? "B" : "A") + parts[index].slice(1);
    expect(await codec().open(parts.join("."), nowSeconds)).toBeNull();
  });
  it.each([
    ["empty", ""], ["version", "v2.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAA"],
    ["short IV", "v1.AA.AAAAAAAAAAAAAAAAAAAAAAA"], ["short tag", "v1.AAAAAAAAAAAAAAAA.AA"],
    ["padding", "v1.AAAAAAAAAAAAAAAA=.AAAAAAAAAAAAAAAAAAAAAAA"],
    ["additional segment", "v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAA.extra"],
    ["oversized", "a".repeat(3801)],
  ])("rejects %s envelope", async (_name, value) => {
    expect(await codec().open(value, nowSeconds)).toBeNull();
  });
  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid current timestamp %s", async (now) => {
    expect(await codec().open(await codec().seal(payload), now)).toBeNull();
  });
  it.each([
    ["duplicate", JSON.stringify(payload).replace('"sessionEpoch":0', '"sessionEpoch":0,"sessionEpoch":1')],
    ["escaped duplicate", JSON.stringify(payload).replace('"sessionEpoch":0', '"sessionEpoch":0,"sessionEpo\\u0063h":1')],
    ["extension", JSON.stringify({ ...payload, paid: true })],
    ["nested", JSON.stringify({ ...payload, accessToken: { value: "token" } })],
    ["missing", JSON.stringify({ accessToken: "token", subject, sessionId, expiresAt: payload.expiresAt })],
    ["fractional epoch", JSON.stringify({ ...payload, sessionEpoch: 1.5 })],
    ["negative epoch", JSON.stringify({ ...payload, sessionEpoch: -1 })],
    ["string expiry", JSON.stringify({ ...payload, expiresAt: "1788579600" })],
    ["invalid UUID", JSON.stringify({ ...payload, subject: "unverified-name" })],
    ["invalid UTF-8", new Uint8Array([123, 0xff, 125])],
  ])("rejects authenticated ciphertext containing %s payload", async (_name, source) => {
    expect(await codec().open(await encryptedPlaintext(source), nowSeconds)).toBeNull();
  });
  it.each([
    { ...payload, accessToken: "a".repeat(2501) }, { ...payload, accessToken: "" },
    { ...payload, accessToken: "token\nvalue" }, { ...payload, accessToken: "token value" },
    { ...payload, accessToken: "токен" }, { ...payload, sessionId: "untrusted" },
    { ...payload, sessionEpoch: Number.MAX_SAFE_INTEGER + 1 }, { ...payload, expiresAt: -1 },
    { ...payload, paid: true },
  ])("refuses to seal malformed input %#", async (value) => {
    await expect(codec().seal(value)).rejects.toThrow();
  });
  it("rejects extractable, short, wrong-algorithm and insufficient-usage keys", () => {
    for (const key of [extractableCookieKey, shortCookieKey, encryptionOnlyKey, signingKeys.privateKey]) {
      expect(() => codec(key)).toThrow();
    }
  });
  it.each([
    ["https://probpera.ru/", cookieName], ["https://probpera.ru/path", cookieName],
    ["https://user:secret@probpera.ru", cookieName], ["file:///planet", cookieName],
    [origin, "cookie; Domain=other.test"], [origin, ""],
  ])("rejects ambiguous cookie context %s / %s", (testOrigin, name) => {
    expect(() => createCookieCodec({ key: cookieKey, origin: testOrigin, cookieName: name })).toThrow();
  });
});

describe("server grant signer interoperates with the actual Web verifier", () => {
  it("signs exactly the current ES256 one-time protocol with independent random grant IDs", async () => {
    const signer = createGrantSigner(signerOptions());
    const token = await signer.sign(subject);
    const next = await signer.sign(subject);
    const result = await verifyWebLicenseGrant(token, context, {
      trustedKeys: [{ kid: "test-ephemeral", jwk: publicJwk }], now: () => nowSeconds * 1000,
    });
    expect(result.status).toBe("authorized");
    if (result.status !== "authorized") throw new Error(result.reason);
    expect(result.claims).toEqual({ v: 1, iss: context.issuer, aud: context.audience, sub: subject, product: context.product,
      model: "one-time", status: "active", jti: expect.any(String), iat: nowSeconds, nbf: nowSeconds,
      exp: nowSeconds + 3600, offlineUntil: nowSeconds + 600 });
    expect(result.claims.jti).toMatch(/^[0-9a-f-]{36}$/u);
    expect(JSON.parse(Buffer.from(next.split(".")[1], "base64url").toString()).jti).not.toBe(result.claims.jti);
    expect(JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString())).toEqual({ alg: "ES256", typ: "lp-web-license+jwt", kid: "test-ephemeral" });
  });
  it("respects exclusive online/offline deadlines in the real verifier", async () => {
    const token = await createGrantSigner(signerOptions()).sign(subject);
    const verify = (seconds: number, mode: "online" | "offline") => verifyWebLicenseGrant(token, context, {
      trustedKeys: [{ kid: "test-ephemeral", jwk: publicJwk }], now: () => seconds * 1000, mode,
    });
    expect((await verify(nowSeconds + 599, "offline")).status).toBe("authorized");
    expect(await verify(nowSeconds + 600, "offline")).toEqual({ status: "denied", reason: "offline-expired" });
    expect((await verify(nowSeconds + 3599, "online")).status).toBe("authorized");
    expect(await verify(nowSeconds + 3600, "online")).toEqual({ status: "denied", reason: "expired" });
  });
  it("cannot authenticate a changed subject, changed signed bytes or unknown signing key", async () => {
    const token = await createGrantSigner(signerOptions()).sign(subject);
    const verification = { trustedKeys: [{ kid: "test-ephemeral", jwk: publicJwk }], now: () => nowSeconds * 1000 };
    expect(await verifyWebLicenseGrant(token, { ...context, subject: sessionId }, verification)).toEqual({ status: "denied", reason: "context-mismatch" });
    const segments = token.split(".");
    const claims = JSON.parse(Buffer.from(segments[1], "base64url").toString());
    segments[1] = Buffer.from(JSON.stringify({ ...claims, product: "other" })).toString("base64url");
    expect(await verifyWebLicenseGrant(segments.join("."), context, verification)).toEqual({ status: "denied", reason: "invalid-signature" });
    expect(await verifyWebLicenseGrant(token, context, { ...verification, trustedKeys: [{ kid: "other", jwk: publicJwk }] })).toEqual({ status: "denied", reason: "unknown-key" });
  });
  it.each([
    { grantSeconds: undefined }, { offlineSeconds: undefined }, { grantSeconds: 0 }, { grantSeconds: 86_401 },
    { grantSeconds: 1.5 }, { offlineSeconds: 0 }, { offlineSeconds: 3601 }, { offlineSeconds: NaN },
  ])("requires explicit bounded durations %#", (change) => {
    expect(() => createGrantSigner(signerOptions(change as Partial<GrantSignerOptions>))).toThrow();
  });
  it("accepts explicit minimum and maximum duration bounds", async () => {
    await expect(createGrantSigner(signerOptions({ grantSeconds: 1, offlineSeconds: 1 })).sign(subject)).resolves.toMatch(/^ey/u);
    await expect(createGrantSigner(signerOptions({ grantSeconds: 86_400, offlineSeconds: 86_400 })).sign(subject)).resolves.toMatch(/^ey/u);
  });
  it("rejects wrong key types, extractable private keys, and wrong curves", () => {
    for (const privateKey of [cookieKey, signingKeys.publicKey, extractableSigningKeys.privateKey, wrongCurveKeys.privateKey]) {
      expect(() => createGrantSigner(signerOptions({ privateKey }))).toThrow();
    }
  });
  it.each(["", "username", "user@example.test", "../../other-user"])("rejects a non-UUID subject %s", async (value) => {
    await expect(createGrantSigner(signerOptions()).sign(value)).rejects.toThrow();
  });
  it.each([NaN, Infinity, -1, Number.MAX_VALUE])("cannot mint grants with invalid authority clock %s", async (value) => {
    await expect(createGrantSigner(signerOptions({ now: () => value })).sign(subject)).rejects.toThrow();
  });
  it.each([{ kid: "" }, { issuer: "x\ny" }, { audience: "" }, { product: "x".repeat(1025) }])("rejects invalid authority context %#", (change) => {
    expect(() => createGrantSigner(signerOptions(change))).toThrow();
  });
});
