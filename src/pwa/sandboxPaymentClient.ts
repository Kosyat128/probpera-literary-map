import { createPlanetAccountClient, PlanetAccountError, type PlanetAccountConfiguration } from "./accountAccess";

export type SandboxCatalog = Readonly<{ v: 1; audience: string; product: string; catalogVersion: string;
  amountMinor: number; currency: "RUB"; mode: "sandbox"; channel: "web-direct" }>;
export type SandboxOrder = Readonly<{ orderId: string; product: string; catalogVersion: string; status: "new" | "pending" | "waiting_for_capture"
  | "succeeded" | "canceled" | "refunded" | "refund-review-required" | "reconcile-required";
  amountMinor: number; currency: "RUB"; environment: "sandbox"; confirmationUrl: string | null;
  refundStatus: "pending" | "succeeded" | "canceled" | null }>;
export class SandboxPaymentError extends Error {
  constructor(readonly reason: "unavailable" | "authentication" | "denied" | "invalid-response" | "stale" | "busy" | "catalog-changed") { super(reason); }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PRODUCT = /^sandbox\.[A-Za-z0-9][A-Za-z0-9._-]{0,111}$/u;
function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), output: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string" || !descriptors[key].enumerable || !Object.prototype.hasOwnProperty.call(descriptors[key], "value")) return null;
    output[key] = descriptors[key].value;
  }
  return output;
}
function exact(value: Record<string, unknown>, fields: string) { return Object.keys(value).sort().join(",") === fields; }
export function decodeSandboxCatalog(value: unknown): SandboxCatalog | null {
  try {
    const item = record(value);
    if (!item || !exact(item, "amountMinor,audience,catalogVersion,channel,currency,mode,product,v") || item.v !== 1
      || item.mode !== "sandbox" || item.channel !== "web-direct" || item.currency !== "RUB"
      || typeof item.audience !== "string" || !/^[A-Za-z0-9:._/-]{1,128}$/u.test(item.audience)
      || typeof item.product !== "string" || !PRODUCT.test(item.product)
      || typeof item.catalogVersion !== "string" || !/^[A-Za-z0-9._-]{1,80}$/u.test(item.catalogVersion)
      || !Number.isSafeInteger(item.amountMinor) || (item.amountMinor as number) <= 0) return null;
    return Object.freeze(item) as unknown as SandboxCatalog;
  } catch { return null; }
}
/** Provider redirect allowlist, independent of server and JSX rendering. */
export function safeSandboxConfirmationUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "yoomoney.ru" && !url.port && !url.username && !url.password
      && !url.hash && url.pathname.startsWith("/api-pages/v2/payment-confirm/") ? value : null;
  } catch { return null; }
}
export function decodeSandboxOrder(value: unknown, product: string): SandboxOrder | null {
  try {
    const item = record(value);
    if (!item || !exact(item, "amountMinor,catalogVersion,confirmationUrl,currency,environment,orderId,product,refundStatus,status")
      || typeof item.orderId !== "string" || !UUID.test(item.orderId) || !PRODUCT.test(product) || item.product !== product
      || typeof item.catalogVersion !== "string" || !/^[A-Za-z0-9._-]{1,80}$/u.test(item.catalogVersion)
      || item.currency !== "RUB" || item.environment !== "sandbox" || !Number.isSafeInteger(item.amountMinor) || (item.amountMinor as number) <= 0
      || typeof item.status !== "string" || !["new", "pending", "waiting_for_capture", "succeeded", "canceled", "refunded", "refund-review-required", "reconcile-required"].includes(item.status)
      || (item.refundStatus !== null && (typeof item.refundStatus !== "string" || !["pending", "succeeded", "canceled"].includes(item.refundStatus)))
      || (item.confirmationUrl !== null && (item.status !== "pending" || !safeSandboxConfirmationUrl(item.confirmationUrl)))) return null;
    return Object.freeze(item) as unknown as SandboxOrder;
  } catch { return null; }
}
/** Exact display, including large safe-integer kopeck amounts. No floating price calculation. */
export function sandboxAmountLabel(amountMinor: number, locale: "ru" | "en"): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new TypeError("Invalid sandbox amount");
  const amount = BigInt(amountMinor), whole = (amount / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/gu, locale === "ru" ? "\u202f" : ",");
  const fraction = (amount % 100n).toString().padStart(2, "0");
  return locale === "ru" ? `${whole},${fraction} ₽` : `RUB ${whole}.${fraction}`;
}

/** Optional same-origin sandbox capability. It never accepts client money,
 * selects a PSP, stores an Auth token or creates a native/store entitlement. */
export function createSandboxPaymentClient(options: { origin: string; fetch?: typeof fetch; allowLocalQa?: boolean; timeoutMs?: number }) {
  const account = createPlanetAccountClient(options), fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new TypeError("Invalid sandbox timeout");
  async function bounded<T>(signal: AbortSignal | undefined, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    let rejectInterrupted!: (error: SandboxPaymentError) => void;
    const interrupted = new Promise<never>((_resolve, reject) => { rejectInterrupted = reject; });
    const abort = () => { controller.abort(); rejectInterrupted(new SandboxPaymentError("stale")); };
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => { controller.abort(); rejectInterrupted(new SandboxPaymentError("unavailable")); }, timeoutMs);
    if (signal?.aborted) abort();
    const pending = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new SandboxPaymentError("stale");
      return work(controller.signal);
    });
    try { return await Promise.race([pending, interrupted]); }
    catch (error) {
      if (error instanceof SandboxPaymentError) throw error;
      if (error instanceof PlanetAccountError) throw new SandboxPaymentError(error.reason === "authentication" ? "authentication" : error.reason === "denied" ? "denied" : "unavailable");
      throw new SandboxPaymentError("unavailable");
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); controller.abort(); }
  }
  async function post(route: string, body: object, signal?: AbortSignal): Promise<unknown> {
    return bounded(signal, async abortSignal => {
      const endpoint = options.origin + "/planet/api/payments/" + route;
      const response = await fetcher(endpoint, { method: "POST", credentials: "include", mode: "same-origin", redirect: "error", cache: "no-store",
        signal: abortSignal, headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
      if (abortSignal.aborted) throw new SandboxPaymentError("stale");
      if (response.redirected || (response.url && response.url !== endpoint) || !/^application\/json(?:\s*;|$)/iu.test(response.headers.get("content-type") ?? "") || !response.body)
        throw new SandboxPaymentError("invalid-response");
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
      const cancel = () => { void reader.cancel().catch(() => undefined); };
      abortSignal.addEventListener("abort", cancel, { once: true });
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > 16_384) throw new SandboxPaymentError("invalid-response");
          chunks.push(part.value);
        }
      } finally { abortSignal.removeEventListener("abort", cancel); cancel(); reader.releaseLock(); }
      if (abortSignal.aborted) throw new SandboxPaymentError("stale");
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let value: unknown;
      try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
      catch { throw new SandboxPaymentError("invalid-response"); }
      if (response.status === 401) throw new SandboxPaymentError("authentication");
      if (response.status === 403) throw new SandboxPaymentError("denied");
      if (response.status === 409) {
        const failure = record(value);
        if (failure && exact(failure, "error") && failure.error === "payment-catalog-changed") throw new SandboxPaymentError("catalog-changed");
      }
      if (response.status !== 200) throw new SandboxPaymentError("unavailable");
      return value;
    });
  }
  const context = (catalog: SandboxCatalog) => ({ v: 1, audience: catalog.audience, product: catalog.product });
  async function result(route: string, catalog: SandboxCatalog, extra: object, signal?: AbortSignal) {
    const scopedCatalog = decodeSandboxCatalog(catalog);
    if (!scopedCatalog) throw new SandboxPaymentError("invalid-response");
    const value = record(await post(route, { ...context(scopedCatalog), ...extra }, signal));
    if (!value || !exact(value, "order")) throw new SandboxPaymentError("invalid-response");
    if (route === "restore" && value.order === null) return null;
    const order = decodeSandboxOrder(value.order, scopedCatalog.product);
    if (!order) throw new SandboxPaymentError("invalid-response");
    return order;
  }
  return Object.freeze({
    async catalog(config: PlanetAccountConfiguration, signal?: AbortSignal): Promise<SandboxCatalog | null> {
      const value = record(await post("catalog", { v: 1 }, signal));
      if (!value || !exact(value, "catalog")) throw new SandboxPaymentError("invalid-response");
      if (value.catalog === null) return null;
      const catalog = decodeSandboxCatalog(value.catalog);
      if (!catalog || catalog.audience !== config.audience || catalog.product !== config.product) throw new SandboxPaymentError("invalid-response");
      return catalog;
    },
    bridge: (config: PlanetAccountConfiguration, token: string, signal?: AbortSignal) => bounded(signal, childSignal => account.bridge(config, token, childSignal)),
    create: (catalog: SandboxCatalog, requestId: string, signal?: AbortSignal) => {
      if (!UUID.test(requestId)) return Promise.reject(new SandboxPaymentError("invalid-response"));
      return result("order", catalog, { requestId, catalogVersion: catalog.catalogVersion }, signal);
    },
    status: (catalog: SandboxCatalog, orderId: string, signal?: AbortSignal) => {
      if (!UUID.test(orderId)) return Promise.reject(new SandboxPaymentError("invalid-response"));
      return result("status", catalog, { orderId }, signal);
    },
    restore: (catalog: SandboxCatalog, signal?: AbortSignal) => result("restore", catalog, {}, signal),
  });
}
export type SandboxPaymentClient = ReturnType<typeof createSandboxPaymentClient>;

/** One mounted, exact canonical-session scope. The host's isCurrent must bind
 * the captured verified session OBJECT/generation, not just subject/token.
 * Dispose is sticky; re-login cannot revive a retired intent or late response.
 * Uncertain replies retain one UUID. Refresh uses provider reconciliation, never
 * starts another intent. Only an explicit purchase after a known terminal order
 * gets a fresh UUID. Nothing here establishes entitlement or payment acceptance. */
export function createSandboxPurchaseSession(options: {
  client: SandboxPaymentClient; config: PlanetAccountConfiguration; catalog: SandboxCatalog;
  subject: string; token: string; isCurrent(): boolean; randomUUID?: () => string;
}) {
  let catalog = decodeSandboxCatalog(options.catalog);
  const { client, subject, token } = options;
  if (!catalog || options.config.v !== 1 || catalog.audience !== options.config.audience || catalog.product !== options.config.product || !UUID.test(subject)
    || !/^[A-Za-z0-9_.-]{1,2500}$/u.test(token)) throw new SandboxPaymentError("invalid-response");
  const config: PlanetAccountConfiguration = Object.freeze({ v: 1, audience: catalog.audience, product: catalog.product, deletionDisclosure: null });
  const controller = new AbortController();
  let disposed = false, busy = false, priceHold = false, requestId: string | null = null, known: SandboxOrder | null = null;
  function guard() {
    let current = false;
    try { current = options.isCurrent() === true; } catch { /* Missing host proof denies this scope. */ }
    if (disposed || controller.signal.aborted || !current) throw new SandboxPaymentError("stale");
  }
  async function execute(mode: "purchase" | "status" | "restore") {
    guard(); if (busy) throw new SandboxPaymentError("busy");
    if (mode === "purchase" && priceHold) throw new SandboxPaymentError("catalog-changed");
    busy = true;
    try {
      if (mode === "purchase" && (!requestId || (known && ["canceled", "refunded"].includes(known.status)))) {
        requestId = (options.randomUUID ?? (() => crypto.randomUUID()))();
        if (!UUID.test(requestId)) throw new SandboxPaymentError("unavailable");
        known = null;
      }
      if (mode === "status" && !known) throw new SandboxPaymentError("invalid-response");
      const bridgedSubject = await client.bridge(config, token, controller.signal); guard();
      if (bridgedSubject !== subject) throw new SandboxPaymentError("authentication");
      const value = mode === "purchase" ? await client.create(catalog!, requestId!, controller.signal)
        : mode === "status" ? await client.status(catalog!, known!.orderId, controller.signal)
        : await client.restore(catalog!, controller.signal);
      guard();
      const order = value === null && mode === "restore" ? null : decodeSandboxOrder(value, catalog!.product);
      if (order === null && !(value === null && mode === "restore")) throw new SandboxPaymentError("invalid-response");
      if (order && order.catalogVersion === catalog!.catalogVersion && order.amountMinor !== catalog!.amountMinor)
        throw new SandboxPaymentError("invalid-response");
      known = order; return order;
    } catch (error) {
      if (error instanceof SandboxPaymentError && error.reason === "catalog-changed") priceHold = true;
      throw error instanceof SandboxPaymentError ? error : new SandboxPaymentError("unavailable");
    } finally { busy = false; }
  }
  return Object.freeze({ purchase: () => execute("purchase"), status: () => execute("status"), restore: () => execute("restore"),
    /** Explicit review only; never retries a purchase, drops its UUID or changes
     * the durable order's previous price. The next purchase is a separate click. */
    reviewCatalog(value: SandboxCatalog) {
      guard(); if (busy) throw new SandboxPaymentError("busy");
      const next = decodeSandboxCatalog(value);
      if (!next || next.audience !== config.audience || next.product !== config.product) throw new SandboxPaymentError("invalid-response");
      catalog = next; priceHold = false;
    },
    dispose() { if (disposed) return; disposed = true; controller.abort(); known = null; requestId = null; } });
}
