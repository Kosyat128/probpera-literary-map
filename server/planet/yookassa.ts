/** Preliminary web/direct sandbox candidate. This module neither selects a
 * commercial PSP nor enables a store purchase channel. Construction is local;
 * only an explicitly configured server may invoke the injected transport.
 * Protocol: https://yookassa.ru/developers/using-api/interaction-format
 * Webhook bodies are hints, never payment authority. There is no generic HMAC.
 */
export const YOOKASSA_SANDBOX_PROVIDER = "yookassa-sandbox" as const;
const API = "https://api.yookassa.ru/v3/";
const PROVIDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export interface YooKassaOrderBinding {
  id: string; subject: string; product: string; catalogVersion: string;
  amountMinor: number; currency: "RUB"; shopId: string; returnUrl: string;
  createKey: string; refundKey: string; providerId: string | null;
}
export interface SandboxPayment {
  id: string; status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  amountMinor: number; currency: "RUB"; shopId: string; test: true; paid: boolean;
  orderId: string; subject: string; product: string; catalogVersion: string;
  createdAt: string; confirmationUrl: string | null;
}
export interface SandboxRefund {
  id: string; paymentId: string; status: "pending" | "succeeded" | "canceled";
  amountMinor: number; currency: "RUB"; createdAt: string;
}
export interface SandboxPaymentGateway {
  readonly provider: typeof YOOKASSA_SANDBOX_PROVIDER; readonly shopId: string;
  createPayment(order: Readonly<YooKassaOrderBinding>, signal?: AbortSignal): Promise<SandboxPayment>;
  payment(id: string, signal?: AbortSignal): Promise<SandboxPayment>;
  successfulRefunds(paymentId: string, signal?: AbortSignal): Promise<readonly SandboxRefund[]>;
  createFullRefund(order: Readonly<YooKassaOrderBinding>, signal?: AbortSignal): Promise<SandboxRefund>;
  refund(id: string, signal?: AbortSignal): Promise<SandboxRefund>;
}
export function rublesFromMinor(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Invalid exact money");
  const minor = BigInt(value);
  return `${minor / 100n}.${String(minor % 100n).padStart(2, "0")}`;
}
export function rublesToMinor(value: unknown, allowZero = false): number | null {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,13})\.[0-9]{2}$/u.test(value)) return null;
  const [whole, fraction] = value.split("."), minor = BigInt(whole) * 100n + BigInt(fraction);
  return minor <= BigInt(Number.MAX_SAFE_INTEGER) && (allowZero ? minor >= 0n : minor > 0n) ? Number(minor) : null;
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function own(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") && descriptor.enumerable ? descriptor.value : undefined;
}
function timestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/u.test(value) && Number.isFinite(Date.parse(value));
}
function amount(value: unknown): number | null {
  return record(value) && own(value, "currency") === "RUB" ? rublesToMinor(own(value, "value")) : null;
}
function safeConfirmation(value: unknown): string | null {
  if (!record(value) || own(value, "type") !== "redirect") return null;
  const url = own(value, "confirmation_url");
  if (typeof url !== "string" || url.length > 2048 || /[\u0000-\u0020\u007f\\]/u.test(url)) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "yoomoney.ru" && !parsed.port && !parsed.username && !parsed.password
      && parsed.pathname.startsWith("/api-pages/v2/payment-confirm/") && !parsed.hash ? parsed.href : null;
  } catch { return null; }
}
function paymentObject(value: unknown, shopId: string): SandboxPayment {
  if (!record(value)) throw new Error("Invalid provider payment");
  const id = own(value, "id"), status = own(value, "status"), paid = own(value, "paid"), createdAt = own(value, "created_at");
  const recipient = own(value, "recipient"), metadata = own(value, "metadata"), amountMinor = amount(own(value, "amount"));
  if (typeof id !== "string" || !PROVIDER_ID.test(id) || typeof status !== "string" || !["pending", "waiting_for_capture", "succeeded", "canceled"].includes(status)
    || typeof paid !== "boolean" || (status === "succeeded" && !paid) || own(value, "test") !== true || !timestamp(createdAt) || amountMinor === null
    || !record(recipient) || own(recipient, "account_id") !== shopId || !record(metadata)
    || Reflect.ownKeys(metadata).sort().join(",") !== "catalog_version,order_id,product,subject") throw new Error("Invalid provider payment");
  const orderId = own(metadata, "order_id"), subject = own(metadata, "subject"), product = own(metadata, "product"), catalogVersion = own(metadata, "catalog_version");
  if (typeof orderId !== "string" || !UUID.test(orderId) || typeof subject !== "string" || !UUID.test(subject)
    || typeof product !== "string" || !/^sandbox\.[A-Za-z0-9][A-Za-z0-9._-]{0,111}$/u.test(product)
    || typeof catalogVersion !== "string" || !/^[A-Za-z0-9._-]{1,80}$/u.test(catalogVersion)) throw new Error("Invalid provider payment binding");
  const confirmation = own(value, "confirmation");
  const confirmationUrl = confirmation === undefined ? null : safeConfirmation(confirmation);
  if (confirmation !== undefined && confirmationUrl === null) throw new Error("Invalid provider confirmation");
  return Object.freeze({ id, status: status as SandboxPayment["status"], paid, amountMinor, currency: "RUB", shopId, test: true,
    orderId, subject, product, catalogVersion, createdAt, confirmationUrl });
}
function refundObject(value: unknown): SandboxRefund {
  if (!record(value)) throw new Error("Invalid provider refund");
  const id = own(value, "id"), paymentId = own(value, "payment_id"), status = own(value, "status"), createdAt = own(value, "created_at");
  const amountMinor = amount(own(value, "amount"));
  if (typeof id !== "string" || !PROVIDER_ID.test(id) || typeof paymentId !== "string" || !PROVIDER_ID.test(paymentId)
    || typeof status !== "string" || !["pending", "succeeded", "canceled"].includes(status) || !timestamp(createdAt) || amountMinor === null) throw new Error("Invalid provider refund");
  return Object.freeze({ id, paymentId, status: status as SandboxRefund["status"], amountMinor, currency: "RUB", createdAt });
}
export function paymentMatchesOrder(payment: Readonly<SandboxPayment>, order: Readonly<YooKassaOrderBinding>): boolean {
  return payment.test === true && payment.shopId === order.shopId && payment.orderId === order.id && payment.subject === order.subject
    && payment.product === order.product && payment.catalogVersion === order.catalogVersion && payment.amountMinor === order.amountMinor
    && payment.currency === order.currency && (order.providerId === null || payment.id === order.providerId);
}
function checkedOrder(order: Readonly<YooKassaOrderBinding>, shopId: string): void {
  if (!record(order) || !UUID.test(order.id) || !UUID.test(order.subject) || !UUID.test(order.createKey) || !UUID.test(order.refundKey)
    || !/^sandbox\.[A-Za-z0-9][A-Za-z0-9._-]{0,111}$/u.test(order.product) || !/^[A-Za-z0-9._-]{1,80}$/u.test(order.catalogVersion)
    || order.shopId !== shopId || order.currency !== "RUB" || !Number.isSafeInteger(order.amountMinor) || order.amountMinor <= 0
    || (order.providerId !== null && !PROVIDER_ID.test(order.providerId))) throw new Error("Invalid sandbox order");
  const url = new URL(order.returnUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search || order.returnUrl.length > 2048) throw new Error("Invalid return route");
}
export interface YooKassaSandboxOptions { mode: "sandbox"; shopId: string; secretKey: string; fetch?: typeof fetch; timeoutMs?: number }
export function createYooKassaSandboxGateway(options: YooKassaSandboxOptions): SandboxPaymentGateway {
  const { mode, shopId, secretKey } = options, timeoutMs = options.timeoutMs ?? 10_000, fetcher = options.fetch ?? globalThis.fetch;
  // A key prefix is an additional fence, not evidence of a completed test. All
  // fetched payments must independently carry test:true and this exact shop ID.
  if (mode !== "sandbox" || !/^[1-9][0-9]{0,19}$/u.test(shopId) || typeof secretKey !== "string" || !/^test_[A-Za-z0-9_-]{10,250}$/u.test(secretKey)
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000 || typeof fetcher !== "function") throw new Error("Invalid sandbox provider configuration");
  const authorization = "Basic " + btoa(shopId + ":" + secretKey);
  function bounded<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const abort = () => { signal.removeEventListener("abort", abort); reject(new Error("Sandbox provider operation interrupted")); };
      // Observe late completion/rejection even when the caller has stopped. The
      // cancellation fence cannot claim that an already accepted charge stopped.
      work.then(value => { signal.removeEventListener("abort", abort); signal.aborted ? abort() : resolve(value); },
        () => { signal.removeEventListener("abort", abort); reject(new Error("Sandbox provider unavailable")); });
      if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
    });
  }
  async function request(path: string, method: "POST" | "GET", body?: object, key?: string, signal?: AbortSignal): Promise<unknown> {
    if (signal?.aborted) throw new Error("Payment operation cancelled");
    const operationSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    const response = await bounded(fetcher(API + path, { method, redirect: "error", cache: "no-store",
      signal: operationSignal,
      headers: { Authorization: authorization, Accept: "application/json", ...(method === "POST" ? { "Content-Type": "application/json", "Idempotence-Key": key! } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) }), operationSignal);
    // No redirect may receive credentials. Never reflect provider error bodies.
    if (response.redirected || (response.url && response.url !== API + path) || response.status !== 200
      || !/^application\/json(?:\s*;|$)/iu.test(response.headers.get("content-type") ?? "")) throw new Error("Sandbox provider unavailable");
    const length = response.headers.get("content-length");
    if (length && (!/^\d+$/u.test(length) || Number(length) > 524_288)) throw new Error("Invalid provider response size");
    if (!response.body) throw new Error("Invalid provider response");
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const result = await bounded(reader.read(), operationSignal); if (result.done) break;
        size += result.value.length; if (size > 524_288) throw new Error("Invalid provider response size"); chunks.push(result.value);
      }
    } finally { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
    if (operationSignal.aborted) throw new Error("Payment operation cancelled");
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new Error("Invalid provider response"); }
  }
  const checkedId = (id: string) => { if (!PROVIDER_ID.test(id)) throw new Error("Invalid provider identifier"); return id; };
  return Object.freeze({ provider: YOOKASSA_SANDBOX_PROVIDER, shopId,
    async createPayment(order: Readonly<YooKassaOrderBinding>, signal?: AbortSignal) {
      checkedOrder(order, shopId);
      const value = await request("payments", "POST", { amount: { value: rublesFromMinor(order.amountMinor), currency: "RUB" }, capture: true,
        confirmation: { type: "redirect", return_url: order.returnUrl },
        metadata: { order_id: order.id, subject: order.subject, product: order.product, catalog_version: order.catalogVersion } }, order.createKey, signal);
      const payment = paymentObject(value, shopId);
      if (!paymentMatchesOrder(payment, order)) throw new Error("Provider order mismatch");
      return payment;
    },
    async payment(id: string, signal?: AbortSignal) {
      const value = paymentObject(await request("payments/" + checkedId(id), "GET", undefined, undefined, signal), shopId);
      if (value.id !== id) throw new Error("Provider payment mismatch"); return value;
    },
    async successfulRefunds(paymentId: string, signal?: AbortSignal) {
      checkedId(paymentId); const refunds: SandboxRefund[] = [], ids = new Set<string>(), cursors = new Set<string>(); let cursor: string | null = null;
      for (let page = 0; page < 10; page++) {
        const query = new URLSearchParams({ payment_id: paymentId, status: "succeeded", limit: "100", ...(cursor ? { cursor } : {}) });
        const value = await request("refunds?" + query.toString(), "GET", undefined, undefined, signal);
        if (!record(value) || own(value, "type") !== "list" || !Array.isArray(own(value, "items"))) throw new Error("Invalid refund list");
        const items = own(value, "items") as unknown[]; if (items.length > 100) throw new Error("Invalid refund list");
        for (const item of items) {
          const refund = refundObject(item);
          if (refund.paymentId !== paymentId || refund.status !== "succeeded" || ids.has(refund.id)) throw new Error("Invalid refund list binding");
          ids.add(refund.id); refunds.push(refund);
        }
        const next = own(value, "next_cursor");
        if (next === undefined || next === null) return Object.freeze(refunds);
        if (typeof next !== "string" || !/^[\u0021-\u007e]{1,512}$/u.test(next) || cursors.has(next)) throw new Error("Invalid refund cursor");
        cursors.add(next); cursor = next;
      }
      // A truncated list cannot establish that no refund exists.
      throw new Error("Refund reconciliation incomplete");
    },
    async createFullRefund(order: Readonly<YooKassaOrderBinding>, signal?: AbortSignal) {
      checkedOrder(order, shopId); if (order.providerId === null) throw new Error("Payment identifier required");
      const refund = refundObject(await request("refunds", "POST", { payment_id: order.providerId,
        amount: { value: rublesFromMinor(order.amountMinor), currency: "RUB" } }, order.refundKey, signal));
      if (refund.paymentId !== order.providerId || refund.amountMinor !== order.amountMinor) throw new Error("Provider refund mismatch"); return refund;
    },
    async refund(id: string, signal?: AbortSignal) {
      const value = refundObject(await request("refunds/" + checkedId(id), "GET", undefined, undefined, signal));
      if (value.id !== id) throw new Error("Provider refund mismatch"); return value;
    },
  });
}
