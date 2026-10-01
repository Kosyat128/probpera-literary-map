import type { CookiePayload } from "./crypto";

export interface PlanetPrincipal {
  subject: string;
  sessionId: string;
  expiresAt: number;
}
export interface PlanetAccess {
  active: boolean;
  sessionEpoch: number;
  accessBlocked: boolean;
  activeReceiptCount: number;
}
export interface VerifiedPayment {
  eventId: string;
  transactionId: string;
  subject: string;
  product: string;
  status: "active" | "refunded" | "revoked";
  occurredAt: string;
}
export interface PlanetDeletionStatus {
  requestId: string;
  status: "requested" | "processing" | "blocked" | "completed";
}
export interface PlanetLicenseRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}
export interface PlanetApiServices {
  auth: {
    verify(token: string): Promise<PlanetPrincipal | null>;
    verifyRecentAuthentication(principal: PlanetPrincipal, proofToken: string): Promise<boolean>;
    signOut(token: string): Promise<void>;
  };
  ledger: {
    access(subject: string, product: string): Promise<PlanetAccess>;
    revokeSessions(subject: string): Promise<void>;
    requestDeletion(subject: string, requestId: string): Promise<{ requestId: string; status: "requested" }>;
    deletionStatus(subject: string): Promise<PlanetDeletionStatus | null>;
    /** Server-verifier output only. This port cannot claim or complete retry jobs. */
    enqueueVerifiedEvent(provider: string, event: Readonly<VerifiedPayment>, payloadSha256: string): Promise<void>;
    applyPayment(provider: string, event: VerifiedPayment, payloadSha256: string): Promise<void>;
  };
  cookies: {
    seal(payload: CookiePayload): Promise<string>;
    open(value: string, nowUnixSeconds: number): Promise<CookiePayload | null>;
  };
  signer: { sign(subject: string): Promise<string> };
  /** Private durable grant budget. An absent capability denies license/session. */
  licenseRateLimiter?: { consume(subject: string, product: string): Promise<PlanetLicenseRateLimitDecision> };
  payments?: {
    provider: string;
    verify(request: Request, bytes: Uint8Array): Promise<VerifiedPayment | null>;
  };
}
export interface PlanetApiOptions {
  origin: string;
  audience: string;
  product: string;
  cookieName: string;
  services: PlanetApiServices;
  now?: () => number;
  allowLocalQa?: boolean;
  /** Populated only from the synchronized legal disclosure workflow. No default
   * retention period or approval is invented by this server implementation. */
  deletionDisclosure?: { version: string; ru: string; en: string } | null;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ROOT = "/planet/api/";
class RequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
function scalarRecord(source: string): Record<string, unknown> {
  // The wire protocol is deliberately flat. Parsing each scalar separately also
  // detects escaped duplicate keys before JSON can silently overwrite a value.
  let offset = 0;
  const skip = () => { while (offset < source.length && /[\t\r\n ]/u.test(source[offset])) offset++; };
  const token = (): unknown => {
    skip();
    const found = /^(?:"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|true|false|null)/u.exec(source.slice(offset));
    if (!found) throw new RequestError(400, "invalid-request");
    offset += found[0].length;
    return JSON.parse(found[0]);
  };
  skip();
  if (source[offset++] !== "{") throw new RequestError(400, "invalid-request");
  const value: Record<string, unknown> = Object.create(null);
  skip();
  if (source[offset] !== "}") while (true) {
    const key = token();
    skip();
    if (typeof key !== "string" || Object.hasOwn(value, key) || source[offset++] !== ":") throw new RequestError(400, "invalid-request");
    value[key] = token();
    skip();
    if (source[offset] !== ",") break;
    offset++;
  }
  if (source[offset++] !== "}") throw new RequestError(400, "invalid-request");
  skip();
  if (offset !== source.length) throw new RequestError(400, "invalid-request");
  return value;
}
async function boundedBody(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if (request.signal.aborted) throw new RequestError(408, "request-cancelled");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/u.test(length) || Number(length) > limit)) throw new RequestError(413, "request-too-large");
  if (!request.body) throw new RequestError(400, "invalid-request");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timedOut = false;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  request.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; abort(); }, 10_000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) throw new RequestError(413, "request-too-large");
      chunks.push(value);
    }
    if (timedOut || request.signal.aborted) throw new RequestError(408, timedOut ? "request-timeout" : "request-cancelled");
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
function validPrincipal(value: PlanetPrincipal | null, now: number): value is PlanetPrincipal {
  return !!value && UUID.test(value.subject) && UUID.test(value.sessionId)
    && Number.isSafeInteger(value.expiresAt) && value.expiresAt > now;
}
function validAccess(value: PlanetAccess): boolean {
  return !!value && typeof value.active === "boolean" && typeof value.accessBlocked === "boolean"
    && Number.isSafeInteger(value.sessionEpoch) && value.sessionEpoch >= 0
    && Number.isSafeInteger(value.activeReceiptCount) && value.activeReceiptCount >= 0
    && value.active === (!value.accessBlocked && value.activeReceiptCount > 0);
}
function validLicenseRateLimit(value: unknown): value is PlanetLicenseRateLimitDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).sort().join(",") !== "allowed,retryAfterSeconds"
    || ![descriptors.allowed, descriptors.retryAfterSeconds].every(field => field && Object.hasOwn(field, "value") && field.enumerable)) return false;
  const allowed: unknown = descriptors.allowed.value, retry: unknown = descriptors.retryAfterSeconds.value;
  return typeof allowed === "boolean" && Number.isSafeInteger(retry)
    && (allowed ? retry === 0 : (retry as number) >= 1 && (retry as number) <= 86400);
}
function cookieValue(request: Request, name: string): string | null {
  const values = (request.headers.get("cookie") ?? "").split(";").map(part => part.trim()).filter(part => part.startsWith(name + "="));
  if (values.length !== 1) return null;
  const value = values[0].slice(name.length + 1);
  return /^[A-Za-z0-9_.-]{1,3800}$/u.test(value) ? value : null;
}
function samePrincipal(left: PlanetPrincipal, right: PlanetPrincipal): boolean {
  return left.subject === right.subject && left.sessionId === right.sessionId && left.expiresAt === right.expiresAt;
}

/** Host adapter supplies secrets and a canonical Supabase service. No network,
 * account, signing authority, payment provider or production mount is implicit. */
export function createPlanetApi(options: PlanetApiOptions): (request: Request) => Promise<Response> {
  const origin = new URL(options.origin);
  if (origin.origin !== options.origin || origin.username || origin.password
    || !(origin.protocol === "https:" || (options.allowLocalQa && origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))
    || !/^__Host-[A-Za-z0-9_-]{1,64}$/u.test(options.cookieName)
    || typeof options.audience !== "string" || !/^[A-Za-z0-9:._/-]{1,128}$/u.test(options.audience)
    || typeof options.product !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(options.product)) throw new Error("Invalid Planet API configuration");
  const { services } = options;
  const disclosure = options.deletionDisclosure ? { ...options.deletionDisclosure } : null;
  if (disclosure && (Object.keys(disclosure).sort().join(",") !== "en,ru,version"
    || !/^[A-Za-z0-9._-]{1,80}$/u.test(disclosure.version)
    || ![disclosure.ru, disclosure.en].every(value => typeof value === "string" && value.trim().length > 0 && value.length <= 8000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)))) throw new Error("Invalid deletion disclosure");
  if (services.payments && !/^[a-z0-9][a-z0-9-]{0,63}$/u.test(services.payments.provider)) throw new Error("Invalid payment provider");
  const now = () => {
    const seconds = Math.floor((options.now ?? Date.now)() / 1000);
    if (!Number.isSafeInteger(seconds) || seconds < 0) throw new Error("Invalid clock");
    return seconds;
  };
  const cookie = (value: string, maxAge: number) => options.cookieName + "=" + value + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + maxAge;
  const response = (status: number, body: object | null, setCookie?: string, extraHeaders: Record<string, string> = {}) => new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { "Cache-Control": "no-store", "Pragma": "no-cache", "Vary": "Origin", "X-Content-Type-Options": "nosniff",
      ...(body ? { "Content-Type": "application/json; charset=utf-8" } : {}), ...(setCookie ? { "Set-Cookie": setCookie } : {}),
      ...(status === 405 ? { Allow: "POST" } : {}), ...extraHeaders },
  });
  const access = async (subject: string) => {
    const result = await services.ledger.access(subject, options.product);
    if (!validAccess(result)) throw new Error("Invalid access response");
    return result;
  };
  async function authenticate(request: Request) {
    const encoded = cookieValue(request, options.cookieName);
    const session = encoded ? await services.cookies.open(encoded, now()) : null;
    if (!session) throw new RequestError(401, "authentication-required");
    const principal = await services.auth.verify(session.accessToken);
    if (!validPrincipal(principal, now()) || principal.subject !== session.subject || principal.sessionId !== session.sessionId
      || principal.expiresAt < session.expiresAt) throw new RequestError(401, "authentication-required");
    const state = await access(principal.subject);
    if (state.accessBlocked || state.sessionEpoch !== session.sessionEpoch) throw new RequestError(403, "access-denied");
    return { principal, session, state };
  }
  return async (request: Request) => {
    try {
      const url = new URL(request.url);
      if (url.origin !== options.origin || url.search || url.hash || !url.pathname.startsWith(ROOT)) return response(404, { error: "not-found" });
      const route = url.pathname.slice(ROOT.length);
      const isWebhook = route.startsWith("payments/webhook/");
      if (!["configuration", "license/bridge", "license/identity", "license/session", "license/sign-out", "account/deletion-request", "account/deletion-status"].includes(route) && !isWebhook) return response(404, { error: "not-found" });
      if (request.method !== "POST") return response(405, { error: "method-not-allowed" });
      if (isWebhook) {
        const provider = services.payments;
        const providerName = provider?.provider;
        if (!provider || typeof providerName !== "string" || route !== "payments/webhook/" + providerName) return response(503, { error: "payment-provider-unconfigured" });
        const bytes = await boundedBody(request, 262_144);
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
        // Provider verification receives the original bytes and signature headers.
        // It must validate its real provider protocol before returning any event.
        const verified = await provider.verify(request, bytes);
        if (!verified) return response(401, { error: "invalid-payment-signature" });
        // Snapshot only normalized fields before any ledger await. Raw payload,
        // headers and extra provider fields never become retry-job data.
        const event = Object.freeze({ eventId: verified.eventId, transactionId: verified.transactionId,
          subject: verified.subject, product: verified.product, status: verified.status, occurredAt: verified.occurredAt });
        if (![event.eventId, event.transactionId].every(value => typeof value === "string" && /^[A-Za-z0-9:._/-]{1,240}$/u.test(value))
          || !UUID.test(event.subject) || event.product !== options.product || !["active", "refunded", "revoked"].includes(event.status)
          || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/u.test(event.occurredAt) || !Number.isFinite(Date.parse(event.occurredAt))) throw new Error("Invalid verified payment event");
        await services.ledger.enqueueVerifiedEvent(providerName, event, hash);
        // Preserve the existing 204 contract: durable enqueue alone is not an
        // applied payment. Only the separate internal processor completes jobs.
        await services.ledger.applyPayment(providerName, event, hash);
        return response(204, null);
      }
      if (request.headers.get("origin") !== options.origin || ![null, "same-origin"].includes(request.headers.get("sec-fetch-site"))) return response(403, { error: "origin-denied" });
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get("content-type") ?? "")) return response(415, { error: "json-required" });
      const bytes = await boundedBody(request, 8192);
      let body: Record<string, unknown>;
      try { body = scalarRecord(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
      catch { throw new RequestError(400, "invalid-request"); }
      if (route === "configuration") {
        if (Object.keys(body).join(",") !== "v" || body.v !== 1) return response(400, { error: "invalid-request" });
        return response(200, { v: 1, audience: options.audience, product: options.product, deletionDisclosure: disclosure });
      }
      const fields = ["v", "audience", "product", ...(route === "license/session" ? ["subject"] : []), ...(route === "account/deletion-request" ? ["requestId", "reauthToken"] : [])];
      if (Object.keys(body).sort().join(",") !== fields.sort().join(",") || body.v !== 1 || body.audience !== options.audience || body.product !== options.product) return response(400, { error: "invalid-request" });
      if (route === "account/deletion-status") {
        // A deletion request blocks paid access and clears its cookie. The same
        // live canonical account must still be able to recover its receipt.
        const bearer = /^Bearer ([A-Za-z0-9_.-]{1,2500})$/u.exec(request.headers.get("authorization") ?? "");
        const principal = bearer ? await services.auth.verify(bearer[1]) : null;
        if (!validPrincipal(principal, now())) return response(401, { error: "authentication-required" });
        const status = await services.ledger.deletionStatus(principal.subject);
        if (status !== null && (!status || Object.keys(status).sort().join(",") !== "requestId,status"
          || typeof status.requestId !== "string" || !UUID.test(status.requestId) || typeof status.status !== "string"
          || !["requested", "processing", "blocked", "completed"].includes(status.status))) throw new Error("Invalid deletion status");
        const confirmed = await services.auth.verify(bearer![1]);
        if (!validPrincipal(confirmed, now()) || !samePrincipal(confirmed, principal)) return response(401, { error: "authentication-required" });
        return response(200, { request: status });
      }
      if (route === "license/bridge") {
        const bearer = /^Bearer ([A-Za-z0-9_.-]{1,2500})$/u.exec(request.headers.get("authorization") ?? "");
        const principal = bearer ? await services.auth.verify(bearer[1]) : null;
        if (!validPrincipal(principal, now())) return response(401, { error: "authentication-required" }, cookie("", 0));
        const state = await access(principal.subject);
        if (state.accessBlocked) return response(403, { error: "access-denied" }, cookie("", 0));
        const encoded = await services.cookies.seal({ accessToken: bearer![1], subject: principal.subject,
          sessionId: principal.sessionId, sessionEpoch: state.sessionEpoch, expiresAt: principal.expiresAt });
        return response(200, { subject: principal.subject }, cookie(encoded, principal.expiresAt - now()));
      }
      const { principal, session, state } = await authenticate(request);
      if (route === "license/identity") return response(200, { subject: principal.subject });
      if (route === "license/sign-out") {
        await services.auth.signOut(session.accessToken);
        await services.ledger.revokeSessions(principal.subject);
        return response(204, null, cookie("", 0));
      }
      if (route === "account/deletion-request") {
        if (!disclosure) return response(503, { error: "deletion-disclosure-unavailable" });
        if (typeof body.requestId !== "string" || !UUID.test(body.requestId) || typeof body.reauthToken !== "string" || !/^[A-Za-z0-9_.-]{1,2500}$/u.test(body.reauthToken)) return response(400, { error: "invalid-request" });
        if (!await services.auth.verifyRecentAuthentication(principal, body.reauthToken)) return response(403, { error: "reauthentication-required" });
        const confirmed = await services.auth.verify(session.accessToken);
        if (!validPrincipal(confirmed, now()) || !samePrincipal(confirmed, principal)) return response(401, { error: "authentication-required" }, cookie("", 0));
        const deletionState = await access(principal.subject);
        if (deletionState.accessBlocked || deletionState.sessionEpoch !== session.sessionEpoch) return response(403, { error: "access-denied" });
        if (!validPrincipal(confirmed, now())) return response(401, { error: "authentication-required" }, cookie("", 0));
        const receipt = await services.ledger.requestDeletion(principal.subject, body.requestId);
        if (receipt.requestId !== body.requestId || receipt.status !== "requested") throw new Error("Invalid deletion receipt");
        return response(202, receipt, cookie("", 0));
      }
      if (body.subject !== principal.subject) return response(403, { error: "subject-mismatch" });
      if (!state.active) return response(402, { error: "purchase-required" });
      if (!services.licenseRateLimiter) throw new Error("License grant budget unavailable");
      const budget = await services.licenseRateLimiter.consume(principal.subject, options.product);
      if (!validLicenseRateLimit(budget)) throw new Error("Invalid license grant budget response");
      if (!budget.allowed) return response(429, { error: "license-rate-limit-exceeded" }, undefined, { "Retry-After": String(budget.retryAfterSeconds) });
      const grant = await services.signer.sign(principal.subject);
      // Budget consumption and signing may await remote services. Recheck current
      // state after both settle before releasing a grant after refund or logout.
      const freshPrincipal = await services.auth.verify(session.accessToken);
      if (!validPrincipal(freshPrincipal, now()) || !samePrincipal(freshPrincipal, principal)) return response(401, { error: "authentication-required" }, cookie("", 0));
      const freshState = await access(principal.subject);
      if (!validPrincipal(freshPrincipal, now())) return response(401, { error: "authentication-required" }, cookie("", 0));
      if (freshState.accessBlocked || freshState.sessionEpoch !== session.sessionEpoch) return response(403, { error: "access-denied" });
      if (!freshState.active) return response(402, { error: "purchase-required" });
      return response(200, { grant });
    } catch (error) {
      // No credential, password, webhook body or upstream exception is reflected.
      return error instanceof RequestError ? response(error.status, { error: error.code }) : response(503, { error: "service-unavailable" });
    }
  };
}
