/**
 * Verification of a time-bounded assertion about a one-time Web purchase.
 * The assertion expiry is not a subscription or an invented purchase duration.
 * Authority, identity and offline window come from configured services. No keys,
 * identities, prices, local paid flags or grace periods are supplied by default.
 * JWS/ES256: RFC 7515, RFC 7518 section 3.4; validation: RFC 8725 section 3.
 * WebCrypto ECDSA signatures use the same fixed-width r || s representation.
 */
export const WEB_LICENSE_TYPE = "lp-web-license+jwt";
export const WEB_LICENSE_SESSION_PATH = "/planet/api/license/session";
const MAX_GRANT_BYTES = 16_384;

export interface WebLicenseContext {
  readonly issuer: string;
  readonly audience: string;
  readonly product: string;
  /** Established independently of the unverified grant, never decoded from it. */
  readonly subject: string;
}
export interface WebLicenseKey {
  readonly kid: string;
  readonly jwk: JsonWebKey;
}
export interface WebLicenseClaims {
  readonly v: 1;
  readonly iss: string;
  readonly aud: string;
  readonly sub: string;
  readonly product: string;
  readonly model: "one-time";
  readonly status: "active" | "revoked" | "refunded";
  readonly jti: string;
  /** All timestamps are integer Unix seconds, with exclusive upper bounds. */
  readonly iat: number;
  readonly nbf: number;
  readonly exp: number;
  readonly offlineUntil: number;
}
export type WebLicenseDenial =
  | "not-checked" | "unconfigured" | "invalid-context" | "crypto-unavailable"
  | "malformed" | "unsupported-header" | "unknown-key" | "invalid-key"
  | "invalid-signature" | "invalid-claims" | "context-mismatch"
  | "clock-skew" | "not-yet-valid" | "expired" | "offline-expired"
  | "revoked" | "refunded" | "no-cached-grant" | "cache-unavailable"
  | "session-denied" | "invalid-response" | "network-unavailable"
  | "timeout" | "cancelled";
export type WebLicenseResult =
  | { readonly status: "authorized"; readonly claims: WebLicenseClaims; readonly validUntil: number }
  | { readonly status: "denied"; readonly reason: WebLicenseDenial };
export interface WebLicenseVerificationOptions {
  readonly trustedKeys?: readonly WebLicenseKey[];
  /** Omitted resolves the current environment on demand; null disables it. */
  readonly subtle?: SubtleCrypto | null;
  /** Milliseconds, like Date.now. No allowance for clocks preceding issuedAt. */
  readonly now?: () => number;
  readonly mode?: "online" | "offline";
}
function denied(reason: WebLicenseDenial): WebLicenseResult {
  return Object.freeze({ status: "denied", reason });
}
function textValue(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024
    && !/[\u0000-\u001f\u007f]/u.test(value);
}
function contextValid(context: WebLicenseContext): boolean {
  return !!context && [context.issuer, context.audience, context.product, context.subject].every(textValue);
}
function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/u.test(value) || value.length % 4 === 1) throw new Error("Invalid base64url");
  const binary = atob(value.replace(/-/gu, "+").replace(/_/gu, "/"));
  if (btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "") !== value) {
    throw new Error("Noncanonical base64url");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

// This protocol deliberately has flat scalar objects. Reject duplicate (also
// escaped duplicate) keys and extensions instead of accepting parser ambiguity.
function parseFlatObject(source: string): Record<string, unknown> {
  let offset = 0;
  const whitespace = () => { while (/[\t\n\r ]/u.test(source[offset] ?? "!") && offset < source.length) offset++; };
  const token = () => {
    whitespace();
    const match = /^(?:"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|true|false|null)/u.exec(source.slice(offset));
    if (!match) throw new Error("Invalid scalar");
    offset += match[0].length;
    return JSON.parse(match[0]) as unknown;
  };
  whitespace();
  if (source[offset++] !== "{") throw new Error("Expected object");
  const output: Record<string, unknown> = Object.create(null);
  whitespace();
  if (source[offset] !== "}") {
    while (true) {
      const key = token();
      if (typeof key !== "string" || Object.prototype.hasOwnProperty.call(output, key)) throw new Error("Invalid/duplicate key");
      whitespace();
      if (source[offset++] !== ":") throw new Error("Expected colon");
      output[key] = token();
      whitespace();
      if (source[offset] !== ",") break;
      offset++;
    }
  }
  if (source[offset++] !== "}") throw new Error("Expected end");
  whitespace();
  if (offset !== source.length) throw new Error("Trailing data");
  return output;
}
function exactKeys(object: object, expected: readonly string[]): boolean {
  const keys = Object.keys(object);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}
function configuredKeys(keys: readonly WebLicenseKey[]): WebLicenseDenial | null {
  if (!Array.isArray(keys) || keys.length === 0) return "unconfigured";
  const ids = new Set<string>();
  for (const key of keys) {
    if (!key || !textValue(key.kid) || ids.has(key.kid)) return "invalid-key";
    ids.add(key.kid);
    const jwk = key.jwk;
    if (!jwk || typeof jwk !== "object" || Array.isArray(jwk)) return "invalid-key";
    const fields = ["kty", "crv", "x", "y", "alg", "use", "key_ops", "ext", "kid"];
    if (Object.keys(jwk).some((field) => !fields.includes(field))
      || jwk.kty !== "EC" || jwk.crv !== "P-256"
      || (jwk.alg !== undefined && jwk.alg !== "ES256")
      || (jwk.use !== undefined && jwk.use !== "sig")
      || (jwk.ext !== undefined && typeof jwk.ext !== "boolean")
      || (jwk.key_ops !== undefined && (!Array.isArray(jwk.key_ops) || jwk.key_ops.length !== 1 || jwk.key_ops[0] !== "verify"))
      || (Object.prototype.hasOwnProperty.call(jwk, "kid") && (jwk as JsonWebKey & { kid: string }).kid !== key.kid)) return "invalid-key";
    try {
      if (typeof jwk.x !== "string" || typeof jwk.y !== "string"
        || decodeBase64Url(jwk.x).length !== 32 || decodeBase64Url(jwk.y).length !== 32) return "invalid-key";
    } catch { return "invalid-key"; }
  }
  return null;
}
/** Shared public-key validation for build-selected Web authority configuration. */
export { configuredKeys as validateWebLicenseKeys };
function unixNow(now: () => number): number {
  try {
    const milliseconds = now();
    return Number.isFinite(milliseconds) && milliseconds >= 0 ? Math.floor(milliseconds / 1000) : NaN;
  } catch { return NaN; }
}

/** Verifies fresh bytes on every invocation, including every offline cache read. */
export async function verifyWebLicenseGrant(
  compactJws: unknown,
  context: WebLicenseContext,
  options: WebLicenseVerificationOptions = {}
): Promise<WebLicenseResult> {
  if (!contextValid(context)) return denied("invalid-context");
  const expected = { ...context };
  const keys = options.trustedKeys ?? [];
  const keyError = configuredKeys(keys);
  if (keyError) return denied(keyError);
  const subtle = options.subtle === undefined ? globalThis.crypto?.subtle : options.subtle;
  if (!subtle) return denied("crypto-unavailable");
  if (options.mode !== undefined && options.mode !== "online" && options.mode !== "offline") return denied("invalid-context");
  let segments: string[];
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  let signature: Uint8Array<ArrayBuffer>;
  try {
    if (typeof compactJws !== "string" || compactJws.length > MAX_GRANT_BYTES) return denied("malformed");
    segments = compactJws.split(".");
    if (segments.length !== 3) return denied("malformed");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    header = parseFlatObject(decoder.decode(decodeBase64Url(segments[0])));
    payload = parseFlatObject(decoder.decode(decodeBase64Url(segments[1])));
    signature = decodeBase64Url(segments[2]);
  } catch { return denied("malformed"); }
  if (!exactKeys(header, ["alg", "typ", "kid"]) || header.alg !== "ES256"
    || header.typ !== WEB_LICENSE_TYPE || !textValue(header.kid)) return denied("unsupported-header");
  const selected = keys.find((key) => key.kid === header.kid);
  if (!selected) return denied("unknown-key");
  if (signature.length !== 64) return denied("invalid-signature");
  let publicKey: CryptoKey;
  try {
    publicKey = await subtle.importKey("jwk", { ...selected.jwk }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  } catch { return denied("invalid-key"); }
  try {
    const verified = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signature, new TextEncoder().encode(`${segments[0]}.${segments[1]}`));
    if (!verified) return denied("invalid-signature");
  } catch { return denied("invalid-signature"); }
  if (!exactKeys(payload, ["v", "iss", "aud", "sub", "product", "model", "status", "jti", "iat", "nbf", "exp", "offlineUntil"])
    || payload.v !== 1 || payload.model !== "one-time"
    || !["active", "revoked", "refunded"].includes(String(payload.status))
    || ![payload.iss, payload.aud, payload.sub, payload.product, payload.jti].every(textValue)
    || ![payload.iat, payload.nbf, payload.exp, payload.offlineUntil].every((value) => Number.isSafeInteger(value) && (value as number) >= 0)) return denied("invalid-claims");
  const claims = Object.freeze({ ...payload }) as unknown as WebLicenseClaims;
  if (claims.iss !== expected.issuer || claims.aud !== expected.audience
    || claims.product !== expected.product || claims.sub !== expected.subject) return denied("context-mismatch");
  if (claims.iat > claims.nbf || claims.nbf >= claims.exp || claims.offlineUntil < claims.iat || claims.offlineUntil > claims.exp) return denied("invalid-claims");
  if (claims.status !== "active") return denied(claims.status);
  const current = unixNow(options.now ?? Date.now);
  if (!Number.isSafeInteger(current) || current < claims.iat) return denied("clock-skew");
  if (current < claims.nbf) return denied("not-yet-valid");
  if (current >= claims.exp) return denied("expired");
  if (options.mode === "offline" && current >= claims.offlineUntil) return denied("offline-expired");
  return Object.freeze({ status: "authorized", claims, validUntil: options.mode === "offline" ? claims.offlineUntil : claims.exp });
}

/** Store only compact signed bytes; no cached boolean or lastVerified timestamp. */
export interface WebLicenseCache {
  read(): Promise<string | null>;
  write(grant: string): Promise<void>;
  remove(): Promise<void>;
}
export interface WebLicenseClientOptions extends Omit<WebLicenseVerificationOptions, "mode"> {
  readonly context: WebLicenseContext;
  /** Exact current origin supplied by the shell, never a URL from a grant. */
  readonly origin: string;
  /** HTTP loopback is accepted only for an explicitly configured local QA build. */
  readonly allowLocalQa?: boolean;
  readonly fetch?: typeof fetch;
  readonly cache?: WebLicenseCache;
  readonly timeoutMs?: number;
}
export interface WebLicenseCheckOptions {
  readonly mode: "online" | "offline";
  readonly signal?: AbortSignal;
}
export interface WebLicenseClient {
  check(options: WebLicenseCheckOptions): Promise<WebLicenseResult>;
  /** A consumer must also recheck at validUntil and on online/visibility events. */
  getSnapshot(): WebLicenseResult;
}
function sessionUrl(origin: string, allowLocalQa: boolean): string | null {
  try {
    const url = new URL(origin);
    if (origin !== url.origin || url.username || url.password) return null;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(allowLocalQa && local && url.protocol === "http:")) return null;
    return `${url.origin}${WEB_LICENSE_SESSION_PATH}`;
  } catch { return null; }
}

/**
 * One client belongs to one independently established identity. Recreate on
 * identity changes. Does not fetch in its constructor or alter auth/scene state.
 * Online errors never silently authorize from cache: the shell may request an
 * explicit offline check, which re-verifies signed offlineUntil. Instant remote
 * revocation knowledge while disconnected is impossible and is not claimed.
 */
export function createWebLicenseClient(options: WebLicenseClientOptions): WebLicenseClient {
  const context = Object.freeze({ ...options.context });
  const configurationKeyError = configuredKeys(options.trustedKeys ?? []);
  const keys = configurationKeyError ? [] : options.trustedKeys!.map((key) => ({ ...key, jwk: { ...key.jwk, ...(key.jwk.key_ops ? { key_ops: [...key.jwk.key_ops] } : {}) } }));
  const verification = { trustedKeys: keys, subtle: options.subtle, now: options.now };
  const now = options.now ?? Date.now;
  const endpoint = sessionUrl(options.origin, options.allowLocalQa === true);
  const timeoutMs = options.timeoutMs ?? 10_000;
  let snapshot: WebLicenseResult = denied("not-checked");
  let generation = 0;
  let pending: AbortController | undefined;
  let highWater = -1;
  let onlineDenial = false;
  // Serialize cache mutations so a slow superseded write cannot overwrite a
  // newer revocation/removal. All cached bytes are still untrusted on read.
  let cacheTail = Promise.resolve();
  function cacheOperation<T>(id: number, signal: AbortSignal, operation: () => Promise<T>, authoritativeRemoval = false): Promise<T | undefined> {
    // Once an observed denial has queued removal, cancellation of the request
    // must not cancel invalidation. Later legitimate writes still follow it.
    const next = cacheTail.then(() => authoritativeRemoval || (id === generation && !signal.aborted) ? operation() : undefined);
    cacheTail = next.then(() => undefined, () => undefined);
    return next;
  }
  function clockValid(): boolean {
    const current = unixNow(now);
    if (!Number.isSafeInteger(current) || current < highWater) return false;
    highWater = current;
    return true;
  }
  function getSnapshot(): WebLicenseResult {
    if (!clockValid()) snapshot = denied("clock-skew");
    if (snapshot.status === "authorized" && highWater >= snapshot.validUntil) snapshot = denied("expired");
    return snapshot;
  }
  async function check(request: WebLicenseCheckOptions): Promise<WebLicenseResult> {
    const id = ++generation;
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    snapshot = denied("not-checked");
    let timedOut = false;
    const externalAbort = () => controller.abort();
    request.signal?.addEventListener("abort", externalAbort, { once: true });
    if (request.signal?.aborted) controller.abort();
    let rejectAbort: (() => void) | undefined;
    const aborted = new Promise<WebLicenseResult>((resolve) => {
      rejectAbort = () => resolve(denied(timedOut ? "timeout" : "cancelled"));
      controller.signal.addEventListener("abort", rejectAbort, { once: true });
      if (controller.signal.aborted) rejectAbort();
    });
    const timeoutValid = Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60_000;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutValid ? timeoutMs : 10_000);
    const active = () => id === generation && !controller.signal.aborted;
    function clearCache() {
      if (!active()) return;
      onlineDenial = true;
      if (options.cache) {
        // The access decision must not wait behind a stalled storage operation.
        // This irrevocable removal remains queued after older writes and before
        // later verified writes even if this check has already settled/aborted.
        void cacheOperation(id, controller.signal, () => options.cache!.remove(), true)
          .catch(() => undefined);
      }
    }
    async function run(): Promise<WebLicenseResult> {
      if (!timeoutValid || !endpoint) return denied("unconfigured");
      if (!contextValid(context) || !["online", "offline"].includes(request.mode)) return denied("invalid-context");
      const keyError = configurationKeyError ?? configuredKeys(keys);
      if (keyError) return denied(keyError);
      if (!clockValid()) return denied("clock-skew");
      if (!active()) return denied("cancelled");
      if (request.mode === "offline") {
        if (onlineDenial) return denied("session-denied");
        if (!options.cache) return denied("no-cached-grant");
        let cached: string | null | undefined;
        try { cached = await cacheOperation(id, controller.signal, () => options.cache!.read()); }
        catch { return denied("cache-unavailable"); }
        if (!active()) return denied("cancelled");
        if (!cached) return denied("no-cached-grant");
        return verifyWebLicenseGrant(cached, context, { ...verification, mode: "offline" });
      }
      const fetcher = options.fetch ?? globalThis.fetch;
      if (!fetcher) return denied("network-unavailable");
      let response: Response;
      try {
        response = await fetcher(endpoint!, {
          method: "POST", credentials: "include", mode: "same-origin", cache: "no-store", redirect: "error",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ v: 1, audience: context.audience, product: context.product, subject: context.subject }),
          signal: controller.signal,
        });
      } catch { return denied("network-unavailable"); }
      if (!active()) return denied("cancelled");
      if (response.status !== 200) {
        if ([400, 401, 402, 403, 404, 410].includes(response.status)) clearCache();
        return denied([401, 402, 403, 410].includes(response.status) ? "session-denied" : "network-unavailable");
      }
      let grant: string;
      try {
        if (response.redirected || (response.url && response.url !== endpoint)
          || !/^application\/json(?:\s*;|$)/iu.test(response.headers.get("content-type") ?? "")) throw new Error("Invalid response");
        // Limit consumption before parsing; a hostile/incorrect endpoint cannot
        // force an unbounded response.json allocation or leave the gate waiting.
        if (!response.body) throw new Error("Empty response");
        const reader = response.body.getReader();
        const cancelRead = () => { void reader.cancel().catch(() => undefined); };
        controller.signal.addEventListener("abort", cancelRead, { once: true });
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (!active() || size > MAX_GRANT_BYTES + 128) throw new Error("Invalid response size");
            chunks.push(part.value);
          }
        } finally {
          controller.signal.removeEventListener("abort", cancelRead);
          void reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        const body = parseFlatObject(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        if (!exactKeys(body, ["grant"]) || typeof body.grant !== "string") throw new Error("Invalid response body");
        grant = body.grant;
      } catch {
        clearCache();
        return denied("invalid-response");
      }
      const result = await verifyWebLicenseGrant(grant, context, { ...verification, mode: "online" });
      if (!active()) return denied("cancelled");
      if (result.status === "denied") {
        clearCache();
        return result;
      }
      onlineDenial = false;
      if (options.cache) {
        try { await cacheOperation(id, controller.signal, () => options.cache!.write(grant)); }
        catch { /* A valid online grant does not claim durable offline storage. */ }
      }
      return result;
    }
    try {
      const result = await Promise.race([run().catch(() => denied("invalid-response")), aborted]);
      if (id !== generation) return denied("cancelled");
      snapshot = result;
      return getSnapshot();
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", externalAbort);
      if (rejectAbort) controller.signal.removeEventListener("abort", rejectAbort);
      if (id === generation) pending = undefined;
    }
  }
  return Object.freeze({ check, getSnapshot });
}
