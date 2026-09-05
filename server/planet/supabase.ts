import { createClient, type AuthError } from "@supabase/supabase-js";
import type { PlanetApiServices, PlanetAccess, PlanetPrincipal, VerifiedPayment } from "./api";

export interface CanonicalSupabaseOptions {
  /** Same project URL and publishable key as the canonical site, supplied by host. */
  canonicalProjectUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
  /** Explicit security policy, not the age of a refreshed access token. */
  recentAuthenticationSeconds: number;
  fetch?: typeof fetch;
  now?: () => number;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function invalidAuthentication(error: AuthError): boolean {
  if ([400, 401, 403].includes(error.status ?? 0)) return true;
  // A transport/outage failure must not masquerade as known account revocation.
  throw new Error("Canonical authentication unavailable");
}
export function createCanonicalSupabaseServices(options: CanonicalSupabaseOptions): Pick<PlanetApiServices, "auth" | "ledger"> {
  const url = new URL(options.canonicalProjectUrl);
  if (url.origin !== options.canonicalProjectUrl || url.protocol !== "https:" || url.username || url.password
    || ![options.publishableKey, options.serviceRoleKey].every(value => typeof value === "string" && value.length > 10 && value.length <= 8192 && !/[\s\u0000-\u001f]/u.test(value))
    || options.publishableKey === options.serviceRoleKey
    || !Number.isSafeInteger(options.recentAuthenticationSeconds) || options.recentAuthenticationSeconds < 1 || options.recentAuthenticationSeconds > 900) throw new Error("Invalid canonical Supabase configuration");
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new Error("Server fetch unavailable");
  const serverFetch: typeof fetch = async (input, init) => {
    const endpoint = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (endpoint.origin !== url.origin || endpoint.username || endpoint.password) throw new Error("Canonical service origin mismatch");
    const signal = init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000);
    return fetcher(input, { ...init, signal, redirect: "error", cache: "no-store" });
  };
  const settings = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: serverFetch } };
  // Service credentials never enter browser bundles, cookies, returned grants or
  // a client's global Authorization header. All calls below use explicit tokens.
  const reader = createClient(options.canonicalProjectUrl, options.publishableKey, settings);
  const service = createClient(options.canonicalProjectUrl, options.serviceRoleKey, settings);
  const now = () => {
    const value = Math.floor((options.now ?? Date.now)() / 1000);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid server clock");
    return value;
  };
  async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await service.rpc(name, args);
    if (error) throw new Error("Canonical ledger unavailable");
    return data;
  }
  async function verified(token: string): Promise<{ principal: PlanetPrincipal; claims: Record<string, unknown>; hasVerifiedFactor: boolean } | null> {
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(token) || token.length > 2500) return null;
    const claimsResult = await reader.auth.getClaims(token);
    if (claimsResult.error) { invalidAuthentication(claimsResult.error); return null; }
    const claims: unknown = claimsResult.data?.claims;
    if (!record(claims) || claims.iss !== options.canonicalProjectUrl + "/auth/v1" || claims.aud !== "authenticated"
      || typeof claims.sub !== "string" || !UUID.test(claims.sub) || typeof claims.session_id !== "string" || !UUID.test(claims.session_id)
      || !Number.isSafeInteger(claims.exp) || (claims.exp as number) <= now() || claims.is_anonymous === true) return null;
    const userResult = await reader.auth.getUser(token);
    if (userResult.error) { invalidAuthentication(userResult.error); return null; }
    const user = userResult.data.user;
    if (!user || user.id !== claims.sub || user.is_anonymous === true) return null;
    const session = await rpc("planet_has_auth_session", { p_user_id: user.id, p_session_id: claims.session_id });
    if (typeof session !== "boolean") throw new Error("Invalid canonical session response");
    if (!session || (claims.exp as number) <= now()) return null;
    return { principal: { subject: user.id, sessionId: claims.session_id, expiresAt: claims.exp as number }, claims,
      hasVerifiedFactor: user.factors?.some(factor => factor.status === "verified") ?? false };
  }
  return {
    auth: {
      async verify(token) { return (await verified(token))?.principal ?? null; },
      async verifyRecentAuthentication(principal, proofToken) {
        const proof = await verified(proofToken);
        if (!proof || proof.principal.subject !== principal.subject || proof.principal.sessionId !== principal.sessionId
          || (proof.hasVerifiedFactor && proof.claims.aal !== "aal2") || !Array.isArray(proof.claims.amr)) return false;
        const current = now();
        return proof.claims.amr.some((method: unknown) => record(method)
          && ["password", "otp", "totp"].includes(String(method.method))
          && (method.method !== "totp" || proof.claims.aal === "aal2")
          && Number.isSafeInteger(method.timestamp) && (method.timestamp as number) <= current
          && (method.timestamp as number) > current - options.recentAuthenticationSeconds);
      },
      async signOut(token) {
        const { error } = await service.auth.admin.signOut(token, "global");
        if (error) throw new Error("Canonical sign out unavailable");
      },
    },
    ledger: {
      async access(subject, product) {
        const value = await rpc("planet_get_web_access", { p_user_id: subject, p_product_id: product });
        if (!record(value) || Object.keys(value).sort().join(",") !== "accessBlocked,active,activeReceiptCount,sessionEpoch"
          || typeof value.active !== "boolean" || typeof value.accessBlocked !== "boolean"
          || !Number.isSafeInteger(value.sessionEpoch) || (value.sessionEpoch as number) < 0
          || !Number.isSafeInteger(value.activeReceiptCount) || (value.activeReceiptCount as number) < 0
          || value.active !== (!value.accessBlocked && (value.activeReceiptCount as number) > 0)) throw new Error("Invalid canonical access response");
        return value as unknown as PlanetAccess;
      },
      async revokeSessions(subject) {
        const value = await rpc("planet_revoke_web_sessions", { p_user_id: subject });
        if (!record(value) || !Number.isSafeInteger(value.sessionEpoch) || (value.sessionEpoch as number) < 0) throw new Error("Invalid canonical revocation response");
      },
      async requestDeletion(subject, requestId) {
        const value = await rpc("planet_request_account_deletion", { p_user_id: subject, p_request_id: requestId });
        if (!record(value) || typeof value.requestId !== "string" || !UUID.test(value.requestId) || value.status !== "requested"
          || !Number.isSafeInteger(value.sessionEpoch) || (value.sessionEpoch as number) < 0) throw new Error("Invalid canonical deletion response");
        return { requestId: value.requestId, status: "requested" };
      },
      async deletionStatus(subject) {
        const result = await service.rpc("planet_get_account_deletion_status", { p_user_id: subject });
        if (result.error || result.status !== 200) throw new Error("Canonical deletion status unavailable");
        const value: unknown = result.data;
        if (value === null) return null;
        if (!record(value) || Object.keys(value).sort().join(",") !== "requestId,status"
          || typeof value.requestId !== "string" || !UUID.test(value.requestId)
          || typeof value.status !== "string" || !["requested", "processing", "blocked", "completed"].includes(value.status)) throw new Error("Invalid canonical deletion status");
        return { requestId: value.requestId, status: value.status as "requested" | "processing" | "blocked" | "completed" };
      },
      async applyPayment(provider: string, event: VerifiedPayment, payloadSha256: string) {
        const value = await rpc("planet_apply_verified_payment_event", { p_provider: provider, p_event_id: event.eventId,
          p_payload_sha256: payloadSha256, p_transaction_id: event.transactionId, p_user_id: event.subject,
          p_product_id: event.product, p_status: event.status, p_occurred_at: event.occurredAt });
        if (!record(value) || typeof value.duplicate !== "boolean" || typeof value.receiptApplied !== "boolean"
          || !["active", "refunded", "revoked"].includes(String(value.receiptStatus))
          || !Number.isSafeInteger(value.sessionEpoch) || (value.sessionEpoch as number) < 0) throw new Error("Invalid canonical payment response");
      },
    },
  };
}
