/** Server-only envelopes. These functions never authenticate a raw user/token. */
export interface CookiePayload {
  readonly accessToken: string;
  readonly subject: string;
  readonly sessionId: string;
  readonly sessionEpoch: number;
  readonly expiresAt: number;
}
export interface CookieCodecOptions {
  readonly key: CryptoKey;
  readonly origin: string;
  readonly cookieName: string;
  readonly subtle?: SubtleCrypto;
}
export interface CookieCodec {
  seal(payload: CookiePayload): Promise<string>;
  open(value: string, nowUnixSec: number): Promise<Readonly<CookiePayload> | null>;
}
export interface GrantSignerOptions {
  readonly privateKey: CryptoKey;
  readonly kid: string;
  readonly issuer: string;
  readonly audience: string;
  readonly product: string;
  readonly grantSeconds: number;
  readonly offlineSeconds: number;
  readonly subtle?: SubtleCrypto;
  readonly now?: () => number;
}
export interface GrantSigner {
  sign(subject: string): Promise<string>;
}

const MAX_COOKIE_CHARS = 3800;
const MAX_TOKEN_CHARS = 2500;
const COOKIE_FIELDS = ["accessToken", "subject", "sessionId", "sessionEpoch", "expiresAt"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const encoder = new TextEncoder();

function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024
    && !/[\u0000-\u001f\u007f]/u.test(value);
}
function uuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function payloadCopy(value: unknown): Readonly<CookiePayload> {
  if (!record(value) || Reflect.ownKeys(value).length !== COOKIE_FIELDS.length
    || !COOKIE_FIELDS.every((field) => Object.hasOwn(value, field))) throw new Error("Invalid cookie payload fields");
  // Read values once: the checked snapshot is the one that is encrypted.
  const copy = Object.fromEntries(COOKIE_FIELDS.map((field) => [field, value[field]]));
  if (typeof copy.accessToken !== "string" || copy.accessToken.length < 1
    || copy.accessToken.length > MAX_TOKEN_CHARS || /[^\x21-\x7e]/u.test(copy.accessToken)
    || !uuid(copy.subject) || !uuid(copy.sessionId) || !integer(copy.sessionEpoch)
    || !integer(copy.expiresAt)) throw new Error("Invalid cookie payload values");
  return Object.freeze(copy) as unknown as Readonly<CookiePayload>;
}
function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}
function decodeBase64url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/u.test(value) || value.length % 4 === 1) throw new Error("Invalid base64url");
  const binary = atob(value.replace(/-/gu, "+").replace(/_/gu, "/"));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (base64url(bytes) !== value) throw new Error("Noncanonical base64url");
  return bytes;
}
function flatJson(source: string): Record<string, unknown> {
  let offset = 0;
  const whitespace = () => { while (offset < source.length && /[\t\n\r ]/u.test(source[offset])) offset++; };
  const scalar = () => {
    whitespace();
    const match = /^(?:"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|true|false|null)/u.exec(source.slice(offset));
    if (!match) throw new Error("Invalid flat JSON");
    offset += match[0].length;
    return JSON.parse(match[0]) as unknown;
  };
  const result: Record<string, unknown> = Object.create(null);
  whitespace();
  if (source[offset++] !== "{") throw new Error("Invalid object");
  whitespace();
  if (source[offset] !== "}") while (true) {
    const key = scalar();
    if (typeof key !== "string" || Object.hasOwn(result, key)) throw new Error("Duplicate/invalid field");
    whitespace();
    if (source[offset++] !== ":") throw new Error("Invalid field");
    result[key] = scalar();
    whitespace();
    if (source[offset] !== ",") break;
    offset++;
  }
  if (source[offset++] !== "}") throw new Error("Invalid object end");
  whitespace();
  if (offset !== source.length) throw new Error("Trailing JSON");
  return result;
}
function cryptoRuntime(subtle: SubtleCrypto | undefined): { subtle: SubtleCrypto; random: Crypto } {
  const random = globalThis.crypto;
  const implementation = subtle ?? random?.subtle;
  if (!implementation || !random?.getRandomValues || !random.randomUUID) throw new Error("WebCrypto unavailable");
  return { subtle: implementation, random };
}
function keyUsages(key: CryptoKey, expected: readonly KeyUsage[]): boolean {
  return Array.isArray(key.usages) && key.usages.length === expected.length
    && expected.every((usage) => key.usages.includes(usage));
}

/** v1.<96-bit IV>.<AES-GCM ciphertext+128-bit tag>; AAD binds the exact cookie. */
export function createCookieCodec(options: CookieCodecOptions): CookieCodec {
  const { key, origin, cookieName } = options;
  const { subtle, random } = cryptoRuntime(options.subtle);
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new Error("Invalid cookie origin"); }
  if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)
    || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]{1,128}$/u.test(cookieName)) throw new Error("Invalid cookie context");
  if (!key || key.type !== "secret" || key.extractable !== false
    || key.algorithm?.name !== "AES-GCM" || (key.algorithm as AesKeyAlgorithm).length !== 256
    || !keyUsages(key, ["encrypt", "decrypt"])) throw new Error("A nonextractable AES-GCM-256 encrypt/decrypt key is required");
  const additionalData = encoder.encode(JSON.stringify({ version: 1, origin, cookieName }));
  return Object.freeze({
    async seal(value: CookiePayload): Promise<string> {
      const payload = payloadCopy(value);
      const iv = random.getRandomValues(new Uint8Array(12));
      const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 }, key, encoder.encode(JSON.stringify(payload)));
      const output = "v1." + base64url(iv) + "." + base64url(new Uint8Array(ciphertext));
      if (output.length > MAX_COOKIE_CHARS) throw new Error("Encrypted cookie exceeds size bound");
      return output;
    },
    async open(value: string, nowUnixSec: number): Promise<Readonly<CookiePayload> | null> {
      try {
        if (typeof value !== "string" || value.length > MAX_COOKIE_CHARS || !integer(nowUnixSec)) return null;
        const parts = value.split(".");
        if (parts.length !== 3 || parts[0] !== "v1") return null;
        const iv = decodeBase64url(parts[1]);
        const ciphertext = decodeBase64url(parts[2]);
        if (iv.length !== 12 || ciphertext.length < 17) return null;
        const plaintext = await subtle.decrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 }, key, ciphertext);
        const payload = payloadCopy(flatJson(new TextDecoder("utf-8", { fatal: true }).decode(plaintext)));
        return nowUnixSec < payload.expiresAt ? payload : null;
      } catch { return null; }
    },
  });
}

/** Signs a server-authorized decision; callers must authenticate and check purchase/revocation first. */
export function createGrantSigner(options: GrantSignerOptions): GrantSigner {
  const { privateKey, kid, issuer, audience, product, grantSeconds, offlineSeconds } = options;
  const { subtle, random } = cryptoRuntime(options.subtle);
  const now = options.now ?? Date.now;
  if (![kid, issuer, audience, product].every(text)) throw new Error("Invalid license authority context");
  if (!integer(grantSeconds) || grantSeconds < 1 || grantSeconds > 86_400
    || !integer(offlineSeconds) || offlineSeconds < 1 || offlineSeconds > grantSeconds) throw new Error("Explicit valid grant/offline durations are required");
  if (!privateKey || privateKey.type !== "private" || privateKey.extractable !== false
    || privateKey.algorithm?.name !== "ECDSA" || (privateKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256"
    || !keyUsages(privateKey, ["sign"])) throw new Error("A nonextractable P-256 private signing key is required");
  const header = base64url(encoder.encode(JSON.stringify({ alg: "ES256", typ: "lp-web-license+jwt", kid })));
  return Object.freeze({
    async sign(subject: string): Promise<string> {
      if (!uuid(subject)) throw new Error("Invalid authenticated subject UUID");
      const milliseconds = now();
      if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error("Invalid authority clock");
      const issuedAt = Math.floor(milliseconds / 1000);
      if (!integer(issuedAt) || !integer(issuedAt + grantSeconds)) throw new Error("Authority clock exceeds timestamp bounds");
      const claims = { v: 1, iss: issuer, aud: audience, sub: subject, product, model: "one-time", status: "active",
        jti: random.randomUUID(), iat: issuedAt, nbf: issuedAt, exp: issuedAt + grantSeconds, offlineUntil: issuedAt + offlineSeconds };
      const signingInput = header + "." + base64url(encoder.encode(JSON.stringify(claims)));
      const signature = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, encoder.encode(signingInput)));
      if (signature.length !== 64) throw new Error("Unexpected ES256 signature format");
      return signingInput + "." + base64url(signature);
    },
  });
}
