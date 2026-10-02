import type { PlanetApiServices, VerifiedPayment } from "./api";
import { paymentMatchesOrder, YOOKASSA_SANDBOX_PROVIDER, type SandboxPayment, type SandboxPaymentGateway,
  type SandboxRefund, type YooKassaOrderBinding } from "./yookassa";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PROVIDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const PRODUCT = /^sandbox\.[A-Za-z0-9][A-Za-z0-9._-]{0,111}$/u;
export type PaymentOrderStatus = "new" | "pending" | "waiting_for_capture" | "succeeded" | "canceled" | "refunded" | "refund-review-required";
export interface PaymentOrder extends YooKassaOrderBinding {
  status: PaymentOrderStatus; createdAt: string; firstSubmittedAt: string | null;
  confirmationUrl: string | null; refundId: string | null;
  refundStatus: "pending" | "succeeded" | "canceled" | null; refundFirstSubmittedAt: string | null;
}
export interface PaymentCatalogEntry { product: string; version: string; amountMinor: number; currency: "RUB" }
export interface PaymentOrderSummary {
  orderId: string; product: string; catalogVersion: string; status: PaymentOrderStatus | "reconcile-required";
  amountMinor: number; currency: "RUB"; confirmationUrl: string | null; environment: "sandbox";
  refundStatus: "pending" | "succeeded" | "canceled" | null;
}
export class PaymentOrderError extends Error {
  constructor(readonly code: "invalid-payment-request" | "payment-order-not-found" | "payment-reconciliation-required" | "payment-refund-policy-required") { super(code); }
}
export interface OrderReservation {
  id: string; requestId: string; subject: string; product: string; catalogVersion: string;
  amountMinor: number; currency: "RUB"; shopId: string; returnUrl: string; createKey: string; refundKey: string;
}
/** Server-only durable authority. reserve coalesces concurrent purchase intents;
 * claim writes the first-submission timestamp BEFORE any provider mutation.
 * Claims may retry the identical operation only within YooKassa's 24h horizon.
 * A lost response outside that horizon must stay unresolved, never charge again.
 * SQL uses the canonical subject deletion fence and lease/CAS ownership.
 */
export interface PaymentOrderStore {
  reserve(input: Readonly<OrderReservation>, signal?: AbortSignal): Promise<unknown>;
  read(query: { subject: string | null; orderId: string | null; paymentId: string | null; product: string | null }, signal?: AbortSignal): Promise<unknown>;
  claim(subject: string, orderId: string, leaseToken: string, operation: "payment" | "refund", leaseSeconds: number, signal?: AbortSignal): Promise<unknown>;
  recordPayment(subject: string, orderId: string, paymentId: string, status: Exclude<PaymentOrderStatus, "new">, confirmationUrl: string | null, signal?: AbortSignal): Promise<unknown>;
  recordRefund(subject: string, orderId: string, refund: Readonly<SandboxRefund>, signal?: AbortSignal): Promise<unknown>;
}
export interface PlanetPaymentOrders {
  /** Immutable server test catalog; publishing it grants no entitlement. */
  catalog(): readonly Readonly<PaymentCatalogEntry>[];
  create(subject: string, requestId: string, product: string, signal?: AbortSignal): Promise<PaymentOrderSummary>;
  status(subject: string, orderId: string, signal?: AbortSignal): Promise<PaymentOrderSummary>;
  restore(subject: string, product: string, signal?: AbortSignal): Promise<PaymentOrderSummary | null>;
}
const ORDER_FIELDS = "amountMinor,catalogVersion,confirmationUrl,createKey,createdAt,currency,firstSubmittedAt,id,product,providerId,refundFirstSubmittedAt,refundId,refundKey,refundStatus,returnUrl,shopId,status,subject";
function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), output: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string" || !Object.hasOwn(descriptors[key], "value") || !descriptors[key].enumerable) return null;
    output[key] = descriptors[key].value;
  }
  return output;
}
function date(value: unknown): value is string {
  // PostgreSQL JSON preserves its configured timezone. An explicit RFC3339
  // offset denotes the same instant; changing server/fixture timezone is neither
  // necessary nor authority to accept a missing or malformed offset.
  return typeof value === "string" && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u.test(value) && Number.isFinite(Date.parse(value));
}
export function decodePaymentOrder(value: unknown): Readonly<PaymentOrder> | null {
  const item = record(value); if (!item || Object.keys(item).sort().join(",") !== ORDER_FIELDS) return null;
  if (![item.id, item.subject, item.createKey, item.refundKey].every(id => typeof id === "string" && UUID.test(id))
    || typeof item.product !== "string" || !PRODUCT.test(item.product) || typeof item.catalogVersion !== "string" || !/^[A-Za-z0-9._-]{1,80}$/u.test(item.catalogVersion)
    || !Number.isSafeInteger(item.amountMinor) || (item.amountMinor as number) <= 0 || item.currency !== "RUB"
    || typeof item.shopId !== "string" || !/^[1-9][0-9]{0,19}$/u.test(item.shopId) || !date(item.createdAt)
    || (item.firstSubmittedAt !== null && !date(item.firstSubmittedAt)) || (item.refundFirstSubmittedAt !== null && !date(item.refundFirstSubmittedAt))
    || (item.providerId !== null && (typeof item.providerId !== "string" || !PROVIDER_ID.test(item.providerId)))
    || (item.refundId !== null && (typeof item.refundId !== "string" || !PROVIDER_ID.test(item.refundId)))
    || typeof item.status !== "string" || !["new", "pending", "waiting_for_capture", "succeeded", "canceled", "refunded", "refund-review-required"].includes(item.status)
    || (item.refundStatus !== null && (typeof item.refundStatus !== "string" || !["pending", "succeeded", "canceled"].includes(item.refundStatus)))
    || typeof item.returnUrl !== "string" || item.returnUrl.length > 2048 || (item.confirmationUrl !== null && (typeof item.confirmationUrl !== "string" || item.confirmationUrl.length > 2048))) return null;
  try {
    const url = new URL(item.returnUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || /[\u0000-\u0020\u007f\\]/u.test(item.returnUrl)) return null;
    if (item.confirmationUrl !== null) {
      const confirmation = new URL(item.confirmationUrl as string);
      if (confirmation.protocol !== "https:" || confirmation.hostname !== "yoomoney.ru" || confirmation.port || confirmation.username || confirmation.password
        || confirmation.hash || !confirmation.pathname.startsWith("/api-pages/v2/payment-confirm/") || /[\u0000-\u0020\u007f\\]/u.test(item.confirmationUrl as string)) return null;
    }
  } catch { return null; }
  if ((item.status === "new" && item.providerId !== null) || (item.status !== "new" && item.providerId === null)
    || (item.refundId !== null && item.providerId === null) || ((item.refundId === null) !== (item.refundStatus === null))) return null;
  return Object.freeze(item) as unknown as Readonly<PaymentOrder>;
}
export async function normalizedPaymentHash(event: Readonly<VerifiedPayment>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ eventId: event.eventId, transactionId: event.transactionId,
    subject: event.subject, product: event.product, status: event.status, occurredAt: event.occurredAt }));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export interface SandboxOrderOptions {
  catalog: readonly PaymentCatalogEntry[]; gateway: SandboxPaymentGateway; store: PaymentOrderStore;
  ledger: Pick<PlanetApiServices["ledger"], "enqueueVerifiedEvent" | "applyPayment">;
  returnUrl: string; leaseSeconds: number; randomUUID?: () => string;
}
/** No production mode, native checkout, subscriptions, anonymous purchases or
 * guest transfer is inferred. Catalog prices are explicit server test inputs.
 * This candidate never creates receipts for a non-sandbox product namespace.
 */
export function createSandboxPaymentOrders(options: SandboxOrderOptions): PlanetPaymentOrders & {
  verification: NonNullable<PlanetApiServices["payments"]>;
  /** Privileged service capability only: deliberately absent from reader HTTP. */
  refund(subject: string, orderId: string, signal?: AbortSignal): Promise<PaymentOrderSummary>;
  /** Operator supplies an existing provider ID after manual reconciliation of
   * an unknown reply beyond 24h; this cannot create another charge. */
  reconcilePayment(paymentId: string, signal?: AbortSignal): Promise<PaymentOrderSummary>;
} {
  const { gateway, store, ledger, returnUrl, leaseSeconds } = options, catalog = new Map<string, Readonly<PaymentCatalogEntry>>();
  const returnRoute = new URL(returnUrl);
  if (returnRoute.protocol !== "https:" || returnRoute.username || returnRoute.password || returnRoute.hash || returnRoute.search
    || returnUrl.length > 2048 || gateway.provider !== YOOKASSA_SANDBOX_PROVIDER || !/^[1-9][0-9]{0,19}$/u.test(gateway.shopId)
    || !Number.isSafeInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 600 || !Array.isArray(options.catalog) || options.catalog.length < 1 || options.catalog.length > 64) throw new Error("Invalid sandbox order configuration");
  for (const raw of options.catalog) {
    const entry = record(raw);
    if (!entry || Object.keys(entry).sort().join(",") !== "amountMinor,currency,product,version" || typeof entry.product !== "string" || !PRODUCT.test(entry.product)
      || typeof entry.version !== "string" || !/^[A-Za-z0-9._-]{1,80}$/u.test(entry.version) || entry.currency !== "RUB"
      || !Number.isSafeInteger(entry.amountMinor) || (entry.amountMinor as number) <= 0 || catalog.has(entry.product)) throw new Error("Invalid server sandbox catalog");
    catalog.set(entry.product, Object.freeze({ ...entry }) as unknown as Readonly<PaymentCatalogEntry>);
  }
  const uuid = () => { const value = (options.randomUUID ?? (() => crypto.randomUUID()))(); if (!UUID.test(value)) throw new Error("Invalid server operation identity"); return value; };
  function order(value: unknown, subject?: string, product?: string): Readonly<PaymentOrder> {
    const result = decodePaymentOrder(value);
    if (!result || result.shopId !== gateway.shopId || result.returnUrl !== returnUrl || (subject !== undefined && result.subject !== subject)
      || (product !== undefined && result.product !== product)) throw new Error("Invalid durable order response");
    return result;
  }
  function summary(value: Readonly<PaymentOrder>, reconcile = false): PaymentOrderSummary {
    return Object.freeze({ orderId: value.id, product: value.product, catalogVersion: value.catalogVersion, status: reconcile ? "reconcile-required" : value.status,
      amountMinor: value.amountMinor, currency: "RUB", confirmationUrl: value.status === "pending" && !reconcile ? value.confirmationUrl : null,
      environment: "sandbox", refundStatus: value.refundStatus });
  }
  async function read(subject: string | null, orderId: string | null, product: string | null, signal?: AbortSignal) {
    const value = await store.read({ subject, orderId, paymentId: null, product }, signal);
    return value === null ? null : order(value, subject ?? undefined, product ?? undefined);
  }
  async function claim(value: Readonly<PaymentOrder>, operation: "payment" | "refund", signal?: AbortSignal) {
    const leaseToken = uuid(), result = record(await store.claim(value.subject, value.id, leaseToken, operation, leaseSeconds, signal));
    if (!result || Object.keys(result).sort().join(",") !== "leaseToken,order,status" || !["claimed", "busy", "reconcile-required"].includes(String(result.status))
      || (result.status === "claimed" ? result.leaseToken !== leaseToken : result.leaseToken !== null)) throw new Error("Invalid durable order claim");
    const current = order(result.order, value.subject, value.product);
    if (current.id !== value.id || current.createKey !== value.createKey || current.refundKey !== value.refundKey || current.amountMinor !== value.amountMinor
      || current.catalogVersion !== value.catalogVersion) throw new Error("Durable order identity changed");
    return { status: result.status as "claimed" | "busy" | "reconcile-required", order: current };
  }
  async function verified(value: Readonly<PaymentOrder>, payment: Readonly<SandboxPayment>, signal?: AbortSignal) {
    if (!paymentMatchesOrder(payment, value)) throw new Error("Provider purchase ownership mismatch");
    let status: Exclude<PaymentOrderStatus, "new"> = payment.status;
    let occurredAt = new Date(payment.createdAt).toISOString();
    if (payment.status === "succeeded") {
      const refunds = await gateway.successfulRefunds(payment.id, signal);
      let total = 0n;
      for (const refund of refunds) {
        if (refund.paymentId !== payment.id || refund.currency !== "RUB" || refund.status !== "succeeded" || !Number.isSafeInteger(refund.amountMinor) || refund.amountMinor <= 0) throw new Error("Invalid verified refund");
        total += BigInt(refund.amountMinor);
        if (Date.parse(refund.createdAt) > Date.parse(occurredAt)) occurredAt = new Date(refund.createdAt).toISOString();
      }
      if (total > BigInt(value.amountMinor)) throw new Error("Provider refund total mismatch");
      if (total === BigInt(value.amountMinor)) status = "refunded";
      else if (total > 0n) status = "refund-review-required";
    }
    const saved = order(await store.recordPayment(value.subject, value.id, payment.id, status, payment.confirmationUrl, signal), value.subject, value.product);
    if (saved.id !== value.id || saved.providerId !== payment.id) throw new Error("Invalid recorded provider identity");
    // Terminal database state wins over an older verified payment observation.
    const normalizedStatus = saved.status === "succeeded" && status === "succeeded" ? "active"
      : saved.status === "refunded" && status === "refunded" ? "refunded"
      : saved.status === "canceled" && status === "canceled" ? "revoked" : null;
    const event: Readonly<VerifiedPayment> | null = normalizedStatus ? Object.freeze({ eventId: `payment.${payment.id}.${normalizedStatus}`,
      transactionId: payment.id, subject: value.subject, product: value.product, status: normalizedStatus, occurredAt }) : null;
    return { saved, event };
  }
  async function publish(event: Readonly<VerifiedPayment> | null) {
    if (!event) return;
    const hash = await normalizedPaymentHash(event);
    await ledger.enqueueVerifiedEvent(YOOKASSA_SANDBOX_PROVIDER, event, hash);
    await ledger.applyPayment(YOOKASSA_SANDBOX_PROVIDER, event, hash);
  }
  async function reconcile(value: Readonly<PaymentOrder>, signal?: AbortSignal): Promise<PaymentOrderSummary> {
    if (signal?.aborted) throw new Error("Payment operation cancelled");
    let payment: SandboxPayment;
    if (value.providerId !== null) payment = await gateway.payment(value.providerId, signal);
    else {
      const claimed = await claim(value, "payment", signal);
      if (claimed.order.providerId !== null) return reconcile(claimed.order, signal);
      if (claimed.status !== "claimed") return summary(claimed.order, claimed.status === "reconcile-required");
      // Durable reservation precedes POST; an uncertain response preserves the
      // same key/body for future reconciliation and never releases a new intent.
      payment = await gateway.createPayment(claimed.order, signal);
      value = claimed.order;
    }
    const result = await verified(value, payment, signal); await publish(result.event); return summary(result.saved);
  }
  const checkedSubject = (subject: string) => { if (!UUID.test(subject)) throw new PaymentOrderError("invalid-payment-request"); };
  return {
    catalog: () => Object.freeze([...catalog.values()]),
    async create(subject, requestId, product, signal) {
      checkedSubject(subject); const entry = catalog.get(product);
      if (!UUID.test(requestId) || !entry) throw new PaymentOrderError("invalid-payment-request");
      const value = order(await store.reserve({ id: uuid(), requestId, subject, product, catalogVersion: entry.version,
        amountMinor: entry.amountMinor, currency: "RUB", shopId: gateway.shopId, returnUrl, createKey: uuid(), refundKey: uuid() }, signal), subject, product);
      return reconcile(value, signal);
    },
    async status(subject, orderId, signal) {
      checkedSubject(subject); if (!UUID.test(orderId)) throw new PaymentOrderError("invalid-payment-request");
      const value = await read(subject, orderId, null, signal); if (!value) throw new PaymentOrderError("payment-order-not-found");
      return reconcile(value, signal);
    },
    async restore(subject, product, signal) {
      checkedSubject(subject); if (!catalog.has(product)) throw new PaymentOrderError("invalid-payment-request");
      const value = await read(subject, null, product, signal); return value ? reconcile(value, signal) : null;
    },
    async refund(subject, orderId, signal) {
      checkedSubject(subject); if (!UUID.test(orderId)) throw new PaymentOrderError("invalid-payment-request");
      let value = await read(subject, orderId, null, signal); if (!value) throw new PaymentOrderError("payment-order-not-found");
      await reconcile(value, signal); value = (await read(subject, orderId, null, signal))!;
      if (value.status === "refunded") return summary(value);
      if (value.status === "refund-review-required") throw new PaymentOrderError("payment-refund-policy-required");
      if (value.status !== "succeeded" || value.providerId === null) throw new PaymentOrderError("invalid-payment-request");
      let refund: SandboxRefund;
      if (value.refundId) refund = await gateway.refund(value.refundId, signal);
      else {
        const claimed = await claim(value, "refund", signal);
        if (claimed.order.refundId) refund = await gateway.refund(claimed.order.refundId, signal);
        else {
          if (claimed.status !== "claimed") return summary(claimed.order, true);
          refund = await gateway.createFullRefund(claimed.order, signal);
        }
        value = claimed.order;
      }
      if (refund.paymentId !== value.providerId || refund.amountMinor !== value.amountMinor || refund.currency !== "RUB") throw new Error("Verified refund order mismatch");
      value = order(await store.recordRefund(subject, orderId, refund, signal), subject, value.product);
      // Refund bookkeeping alone does not grant/revoke. Re-fetch the payment and
      // complete refund set, then use the same canonical event/ledger path.
      return reconcile(value, signal);
    },
    async reconcilePayment(paymentId, signal) {
      if (!PROVIDER_ID.test(paymentId)) throw new PaymentOrderError("invalid-payment-request");
      const payment = await gateway.payment(paymentId, signal), value = await read(null, payment.orderId, null, signal);
      if (!value) throw new PaymentOrderError("payment-order-not-found");
      const result = await verified(value, payment, signal); await publish(result.event); return summary(result.saved);
    },
    verification: { provider: YOOKASSA_SANDBOX_PROVIDER, acknowledgementStatus: 200, eventHashMode: "normalized",
      async verify(request, bytes) {
        let hint: unknown;
        try { hint = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return null; }
        const envelope = record(hint), object = envelope ? record(envelope.object) : null;
        if (!envelope || envelope.type !== "notification" || typeof envelope.event !== "string" || !["payment.succeeded", "payment.canceled", "payment.waiting_for_capture", "refund.succeeded"].includes(envelope.event)
          || !object || typeof object.id !== "string" || !PROVIDER_ID.test(object.id)) return null;
        // Read-only authenticated provider GET establishes every property. Neither
        // the supplied object metadata nor its status/amount is trusted.
        const refund = envelope.event === "refund.succeeded" ? await gateway.refund(object.id, request.signal) : null;
        if (refund && refund.status !== "succeeded") return null;
        const payment = await gateway.payment(refund ? refund.paymentId : object.id, request.signal);
        const value = await read(null, payment.orderId, null, request.signal); if (!value) return null;
        const result = await verified(value, payment, request.signal);
        return result.event ?? Object.freeze({ acknowledgeOnly: true as const });
      },
    },
  };
}
