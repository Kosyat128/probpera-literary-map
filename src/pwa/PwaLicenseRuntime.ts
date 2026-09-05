import {
  createWebLicenseClient,
  validateWebLicenseKeys,
  type WebLicenseClient,
  type WebLicenseContext,
  type WebLicenseDenial,
  type WebLicenseKey,
  type WebLicenseResult,
} from "../platform/adapters/web/WebLicense";

export const PWA_LICENSE_IDENTITY_PATH = "/planet/api/license/identity";
const MAX_IDENTITY_BYTES = 2048;
const SUBJECT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
export interface PwaLicenseAuthority {
  readonly issuer: string;
  readonly audience: string;
  readonly product: string;
  readonly trustedKeys: readonly WebLicenseKey[];
}
export type PwaLicenseStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface PwaLicenseRuntimeOptions {
  readonly authority?: PwaLicenseAuthority | null;
  readonly origin: string;
  readonly storage: PwaLicenseStorage | null;
  readonly fetch?: typeof fetch;
  readonly subtle?: SubtleCrypto | null;
  readonly now?: () => number;
  readonly timeoutMs?: number;
  readonly allowLocalQa?: boolean;
}
export interface PwaLicenseBootstrapResult {
  readonly client: WebLicenseClient | null;
  readonly reason: WebLicenseDenial | null;
}
export interface PwaLicenseBootstrapRequest {
  readonly mode: "online" | "offline";
  readonly signal?: AbortSignal;
}
export interface PwaLicenseRuntime {
  bootstrap(request: PwaLicenseBootstrapRequest): Promise<PwaLicenseBootstrapResult>;
  getSnapshot(): PwaLicenseBootstrapResult;
}
function unavailable(reason: WebLicenseDenial): PwaLicenseBootstrapResult {
  return Object.freeze({ client: null, reason });
}
function plainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}
function validContext(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !/[\u0000-\u001f\u007f]/u.test(value);
}
function copyAuthority(value: unknown): PwaLicenseAuthority | null {
  if (!plainRecord(value) || !exactKeys(value, ["issuer", "audience", "product", "trustedKeys"])
    || !validContext(value.issuer) || !validContext(value.audience) || !validContext(value.product)
    || validateWebLicenseKeys(value.trustedKeys as readonly WebLicenseKey[])) return null;
  return Object.freeze({ issuer: value.issuer, audience: value.audience, product: value.product,
    trustedKeys: (value.trustedKeys as readonly WebLicenseKey[]).map((key) => Object.freeze({ kid: key.kid,
      jwk: Object.freeze({ ...key.jwk, ...(key.jwk.key_ops ? { key_ops: [...key.jwk.key_ops] } : {}) }),
    })),
  });
}
function identityUrl(origin: string, allowLocalQa: boolean): string | null {
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.username || parsed.password) return null;
    if (parsed.protocol !== "https:" && !(allowLocalQa && parsed.protocol === "http:"
      && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))) return null;
    return origin + PWA_LICENSE_IDENTITY_PATH;
  } catch { return null; }
}
function parseIdentity(source: string): string {
  // One exact scalar field, including rejection of duplicates, extra fields and
  // nested JSON. The subject is opaque; it is never treated as a path or URL.
  const match = /^[\t\n\r ]*\{[\t\n\r ]*"subject"[\t\n\r ]*:[\t\n\r ]*("(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*")[\t\n\r ]*\}[\t\n\r ]*$/u.exec(source);
  if (!match) throw new Error("Invalid identity response");
  const subject: unknown = JSON.parse(match[1]);
  if (typeof subject !== "string" || !SUBJECT.test(subject)) throw new Error("Invalid opaque subject");
  return subject;
}

/**
 * No identity discovery or storage reads during construction. A trusted cookie
 * session establishes subject online; offline reads its separate saved value.
 * Receipt bytes never supply identity and are reverified by WebLicense on use.
 */
export function createPwaLicenseRuntime(options: PwaLicenseRuntimeOptions): PwaLicenseRuntime {
  const authority = copyAuthority(options.authority);
  const configurationError: WebLicenseDenial | null = options.authority == null ? "unconfigured" : authority ? null : "invalid-key";
  const endpoint = identityUrl(options.origin, options.allowLocalQa === true);
  const storage = options.storage;
  const timeoutMs = options.timeoutMs ?? 10_000;
  let snapshot = unavailable("not-checked");
  let generation = 0;
  let pending: AbortController | null = null;
  let existing: { subject: string; client: WebLicenseClient } | null = null;
  let identityDenied = false;
  let identityEpoch = 0;
  async function digest(value: string, subtle: SubtleCrypto): Promise<string> {
    const bytes = await subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  function writeChecked(key: string, value: string) {
    storage!.setItem(key, value);
    if (storage!.getItem(key) !== value) throw new Error("Storage did not retain the value");
  }
  function removeChecked(key: string) {
    storage!.removeItem(key);
    if (storage!.getItem(key) !== null) throw new Error("Storage did not remove the value");
  }
  function clearStored(identityKey: string, grantKeys: readonly string[]) {
    let failed = false;
    // Clear both independent identity and receipt even if one operation fails.
    for (const key of [identityKey, ...new Set(grantKeys)]) {
      try { removeChecked(key); } catch { failed = true; }
    }
    if (failed) throw new Error("Storage unavailable during invalidation");
  }
  async function bootstrap(request: PwaLicenseBootstrapRequest): Promise<PwaLicenseBootstrapResult> {
    const id = ++generation;
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    const active = () => id === generation && !controller.signal.aborted;
    let timedOut = false;
    const externalAbort = () => controller.abort();
    request.signal?.addEventListener("abort", externalAbort, { once: true });
    if (request.signal?.aborted) controller.abort();
    let onAbort: (() => void) | undefined;
    const abortResult = new Promise<PwaLicenseBootstrapResult>((resolve) => {
      onAbort = () => resolve(unavailable(timedOut ? "timeout" : "cancelled"));
      controller.signal.addEventListener("abort", onAbort, { once: true });
      if (controller.signal.aborted) onAbort();
    });
    const timeoutValid = Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60_000;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutValid ? timeoutMs : 10_000);
    async function run(): Promise<PwaLicenseBootstrapResult> {
      if (configurationError) return unavailable(configurationError);
      if (!authority || !endpoint || !timeoutValid) return unavailable("unconfigured");
      if (!storage) return unavailable("cache-unavailable");
      if (request.mode !== "online" && request.mode !== "offline") return unavailable("invalid-context");
      const subtle = options.subtle === undefined ? globalThis.crypto?.subtle : options.subtle;
      if (!subtle) return unavailable("crypto-unavailable");
      const namespace = "literary-planet-web-license-v1:" + await digest(JSON.stringify([authority.issuer, authority.audience, authority.product]), subtle);
      if (!active()) return unavailable("cancelled");
      const identityKey = namespace + ":identity";
      const grantKey = async (subject: string) => namespace + ":grant:" + await digest(subject, subtle);
      let savedSubject: string | null;
      try { savedSubject = storage.getItem(identityKey); }
      catch { return unavailable("cache-unavailable"); }
      const savedIsValid = typeof savedSubject === "string" && SUBJECT.test(savedSubject);
      const obsoleteGrantKeys: string[] = [];
      if (savedIsValid) obsoleteGrantKeys.push(await grantKey(savedSubject!));
      if (existing) obsoleteGrantKeys.push(await grantKey(existing.subject));
      if (!active()) return unavailable("cancelled");
      let subject: string;
      if (request.mode === "offline") {
        if (identityDenied) return unavailable("session-denied");
        if (!savedIsValid) return unavailable(savedSubject === null ? "no-cached-grant" : "invalid-response");
        subject = savedSubject!;
      } else {
        const fetcher = options.fetch ?? globalThis.fetch;
        if (!fetcher) return unavailable("network-unavailable");
        let response: Response;
        try {
          response = await fetcher(endpoint!, { method: "POST", credentials: "include", mode: "same-origin",
            cache: "no-store", redirect: "error", signal: controller.signal,
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ v: 1, audience: authority.audience, product: authority.product }),
          });
        } catch { return unavailable("network-unavailable"); }
        if (!active()) return unavailable("cancelled");
        if ([401, 403].includes(response.status)) {
          ++identityEpoch;
          identityDenied = true;
          existing = null;
          try { clearStored(identityKey, obsoleteGrantKeys); } catch { /* The known denial still closes access. */ }
          return unavailable("session-denied");
        }
        if (response.status !== 200) return unavailable("network-unavailable");
        try {
          if (response.redirected || (response.url && response.url !== endpoint)
            || !/^application\/json(?:\s*;|$)/iu.test(response.headers.get("content-type") ?? "") || !response.body) throw new Error("Invalid identity response");
          const reader = response.body.getReader();
          const cancel = () => { void reader.cancel().catch(() => undefined); };
          controller.signal.addEventListener("abort", cancel, { once: true });
          const chunks: Uint8Array[] = [];
          let total = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              total += value.byteLength;
              if (!active() || total > MAX_IDENTITY_BYTES) throw new Error("Identity response too large");
              chunks.push(value);
            }
          } finally { controller.signal.removeEventListener("abort", cancel); cancel(); reader.releaseLock(); }
          const bytes = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
          subject = parseIdentity(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        } catch { return unavailable("invalid-response"); }
        if (!active()) return unavailable("cancelled");
        try {
          if (existing && existing.subject !== subject) { ++identityEpoch; existing = null; }
          if (savedSubject !== subject) clearStored(identityKey, obsoleteGrantKeys);
          writeChecked(identityKey, subject);
        } catch { return unavailable("cache-unavailable"); }
        identityDenied = false;
      }
      const receiptKey = await grantKey(subject);
      if (!active()) return unavailable("cancelled");
      if (existing?.subject === subject) return Object.freeze({ client: existing.client, reason: null });
      const context: WebLicenseContext = { issuer: authority.issuer, audience: authority.audience, product: authority.product, subject };
      const clientEpoch = identityEpoch;
      const currentIdentity = () => clientEpoch === identityEpoch && !identityDenied;
      let storageErrors = 0;
      let checkGeneration = 0;
      let lastResult: WebLicenseResult = Object.freeze({ status: "denied", reason: "not-checked" });
      const inner = createWebLicenseClient({ context, trustedKeys: authority.trustedKeys, origin: options.origin,
        allowLocalQa: options.allowLocalQa, subtle, now: options.now, timeoutMs, fetch: options.fetch,
        cache: {
          async read() {
            try { return currentIdentity() && storage.getItem(identityKey) === subject ? storage.getItem(receiptKey) : null; }
            catch (error) { storageErrors++; throw error; }
          },
          async write(grant) {
            try {
              if (!currentIdentity()) throw new Error("Identity no longer current");
              writeChecked(receiptKey, grant); writeChecked(identityKey, subject);
            }
            catch (error) {
              storageErrors++;
              try {
                if (storage.getItem(identityKey) === subject) clearStored(identityKey, [receiptKey]);
                else removeChecked(receiptKey);
              } catch { /* Fail closed; no persistence claim. */ }
              throw error;
            }
          },
          async remove() {
            try {
              if (storage.getItem(identityKey) === subject) clearStored(identityKey, [receiptKey]);
              else removeChecked(receiptKey);
            }
            catch (error) { storageErrors++; throw error; }
          },
        },
      });
      // Persistence failure is visible and cannot turn a newly issued grant into
      // an apparent installed/offline entitlement. Base verifier semantics stay
      // reusable for clients that deliberately do not require durable storage.
      const wrapped: WebLicenseClient = Object.freeze({
        async check(checkRequest: Parameters<WebLicenseClient["check"]>[0]) {
          const checkId = ++checkGeneration;
          if (!currentIdentity()) return Object.freeze({ status: "denied", reason: "session-denied" });
          const before = storageErrors;
          const result = await inner.check(checkRequest);
          if (checkId !== checkGeneration) return Object.freeze({ status: "denied", reason: "cancelled" });
          lastResult = !currentIdentity() ? Object.freeze({ status: "denied", reason: "session-denied" }) : result.status === "authorized" && storageErrors !== before
            ? Object.freeze({ status: "denied", reason: "cache-unavailable" }) : result;
          return lastResult;
        },
        getSnapshot() {
          if (!currentIdentity()) return Object.freeze({ status: "denied", reason: "session-denied" });
          const current = inner.getSnapshot();
          return lastResult.status === "denied" || current.status === "denied" ? (current.status === "denied" ? current : lastResult) : current;
        },
      });
      existing = { subject, client: wrapped };
      return Object.freeze({ client: wrapped, reason: null });
    }
    try {
      const result = await Promise.race([run().catch(() => unavailable("invalid-response")), abortResult]);
      if (id !== generation) return unavailable("cancelled");
      snapshot = result;
      return result;
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", externalAbort);
      if (onAbort) controller.signal.removeEventListener("abort", onAbort);
      if (id === generation) pending = null;
    }
  }
  return Object.freeze({ bootstrap, getSnapshot: () => snapshot });
}
