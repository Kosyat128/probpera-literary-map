import { createClient } from "@supabase/supabase-js";
import type { CanonicalSupabaseOptions } from "./supabase";
import type { PaymentOrderStore } from "./paymentOrders";

/** Reuses the canonical server project, with no new identity/backend. All order
 * operations are service-only RPCs with a subject deletion fence. Construction
 * makes no network call and neither reads environment files nor creates keys.
 */
export function createCanonicalPaymentOrderStore(options: CanonicalSupabaseOptions): PaymentOrderStore {
  const url = new URL(options.canonicalProjectUrl), fetcher = options.fetch ?? globalThis.fetch;
  if (url.origin !== options.canonicalProjectUrl || url.protocol !== "https:" || url.username || url.password
    || typeof options.serviceRoleKey !== "string" || !/^[^\s\u0000-\u001f]{11,8192}$/u.test(options.serviceRoleKey)
    || options.serviceRoleKey === options.publishableKey || typeof fetcher !== "function") throw new Error("Invalid canonical order configuration");
  async function rpc(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    if (signal?.aborted) throw new Error("Order operation cancelled");
    const serverFetch: typeof fetch = async (input, init) => {
      const endpoint = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (endpoint.origin !== url.origin || endpoint.username || endpoint.password) throw new Error("Canonical order origin mismatch");
      const signals = [signal, init?.signal, AbortSignal.timeout(10_000)].filter((value): value is AbortSignal => !!value);
      return fetcher(input, { ...init, signal: AbortSignal.any(signals), redirect: "error", cache: "no-store" });
    };
    const client = createClient(options.canonicalProjectUrl, options.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: serverFetch },
    });
    const result = await client.rpc(name, args);
    if (result.error || result.status !== 200) throw new Error("Canonical payment order unavailable");
    return result.data;
  }
  return {
    reserve(input, signal) { return rpc("planet_reserve_sandbox_order", { p_id: input.id, p_request_id: input.requestId,
      p_subject: input.subject, p_product: input.product, p_catalog_version: input.catalogVersion, p_amount_minor: input.amountMinor,
      p_shop_id: input.shopId, p_return_url: input.returnUrl, p_create_key: input.createKey, p_refund_key: input.refundKey }, signal); },
    read(query, signal) { return rpc("planet_read_sandbox_order", { p_subject: query.subject, p_order_id: query.orderId,
      p_payment_id: query.paymentId, p_product: query.product }, signal); },
    claim(subject, orderId, leaseToken, operation, leaseSeconds, signal) {
      return rpc("planet_claim_sandbox_order", { p_subject: subject, p_order_id: orderId, p_lease_token: leaseToken,
        p_operation: operation, p_lease_seconds: leaseSeconds }, signal);
    },
    recordPayment(subject, orderId, paymentId, status, confirmationUrl, signal) {
      return rpc("planet_record_sandbox_payment", { p_subject: subject, p_order_id: orderId,
        p_payment_id: paymentId, p_status: status, p_confirmation_url: confirmationUrl }, signal);
    },
    recordRefund(subject, orderId, refund, signal) {
      return rpc("planet_record_sandbox_refund", { p_subject: subject, p_order_id: orderId,
        p_payment_id: refund.paymentId, p_refund_id: refund.id, p_status: refund.status, p_amount_minor: refund.amountMinor }, signal);
    },
  };
}
