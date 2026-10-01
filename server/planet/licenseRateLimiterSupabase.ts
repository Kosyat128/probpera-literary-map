import { createClient } from "@supabase/supabase-js";
import type { PlanetLicenseRateLimitDecision } from "./api";
import { createCanonicalSupabaseServices, type CanonicalSupabaseOptions } from "./supabase";

export interface LicenseRateLimitPolicy { limit: number; windowSeconds: number }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PRODUCT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u;

/** Server-only capability. Policy is explicit; no process-local quota or defaults. */
export function createCanonicalLicenseRateLimiter(options: CanonicalSupabaseOptions, policy: LicenseRateLimitPolicy) {
  const config = Object.freeze({ ...options });
  const limit = policy.limit, windowSeconds = policy.windowSeconds;
  if (Object.keys(policy).sort().join(",") !== "limit,windowSeconds"
    || !Number.isSafeInteger(limit) || limit < 1 || limit > 10000
    || !Number.isSafeInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86400) throw new Error("Invalid explicit license rate policy");
  // Reuse canonical project/key validation without creating a network request.
  // Payment retry services retain their independent configuration contract.
  createCanonicalSupabaseServices(config);
  const url = new URL(config.canonicalProjectUrl), fetcher = config.fetch ?? globalThis.fetch;
  const serverFetch: typeof fetch = async (input, init) => {
    const endpoint = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (endpoint.origin !== url.origin || endpoint.username || endpoint.password) throw new Error("License budget origin mismatch");
    const signal = init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000);
    return fetcher(input, { ...init, signal, redirect: "error", cache: "no-store" });
  };
  const service = createClient(config.canonicalProjectUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: serverFetch },
  });
  return Object.freeze({
    async consume(subject: string, product: string): Promise<PlanetLicenseRateLimitDecision> {
      if (typeof subject !== "string" || !UUID.test(subject) || typeof product !== "string" || !PRODUCT.test(product)) throw new Error("Invalid license budget identity");
      try {
        const { data, error } = await service.rpc("planet_consume_license_grant_budget", {
          p_subject: subject, p_product_id: product, p_limit: limit, p_window_seconds: windowSeconds,
        });
        if (error || !data || typeof data !== "object" || Array.isArray(data)
          || Object.keys(data).sort().join(",") !== "allowed,retry_after_seconds"
          || typeof data.allowed !== "boolean" || !Number.isSafeInteger(data.retry_after_seconds)
          || (data.allowed ? data.retry_after_seconds !== 0 : data.retry_after_seconds < 1 || data.retry_after_seconds > windowSeconds)) throw new Error("Invalid license budget response");
        return Object.freeze({ allowed: data.allowed, retryAfterSeconds: data.retry_after_seconds });
      } catch { throw new Error("Canonical license grant budget unavailable"); }
    },
  });
}
