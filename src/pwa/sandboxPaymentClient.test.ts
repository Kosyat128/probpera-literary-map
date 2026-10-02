import { afterEach, describe, expect, it, vi } from "vitest";
import { createSandboxPaymentClient, createSandboxPurchaseSession, decodeSandboxCatalog, decodeSandboxOrder, safeSandboxConfirmationUrl,
  sandboxAmountLabel, type SandboxCatalog, type SandboxOrder, type SandboxPaymentClient } from "./sandboxPaymentClient";
import { sandboxPaymentCopy } from "./sandboxPaymentCopy";

const subject = "00000000-0000-4000-8000-000000000001", requestId = "00000000-0000-4000-8000-000000000002";
const orderId = "00000000-0000-4000-8000-000000000003", token = "synthetic.verified.token";
const config = { v: 1 as const, audience: "test-web", product: "sandbox.test-base", deletionDisclosure: null };
const catalog: SandboxCatalog = { ...config, catalogVersion: "fixture-v1", amountMinor: 12345, currency: "RUB", mode: "sandbox", channel: "web-direct" };
// Strip the account-only disclosure: this fixture models the exact public wire.
const publicCatalog: SandboxCatalog = { v: 1, audience: config.audience, product: config.product,
  catalogVersion: "fixture-v1", amountMinor: 12345, currency: "RUB", mode: "sandbox", channel: "web-direct" };
const order: SandboxOrder = { orderId, product: config.product, catalogVersion: "fixture-v1", status: "pending", amountMinor: 12345, currency: "RUB", environment: "sandbox",
  refundStatus: null, confirmationUrl: "https://yoomoney.ru/api-pages/v2/payment-confirm/test?orderId=synthetic" };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function wire() {
  const calls: { route: string; init: RequestInit; body: Record<string, unknown> }[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const route = String(input).replace("https://test.invalid/planet/api/", "");
    calls.push({ route, init: init!, body: JSON.parse(String(init!.body)) });
    return route === "payments/catalog" ? response({ catalog: publicCatalog }) : route === "license/bridge" ? response({ subject }) : response({ order });
  });
  return { fetcher, calls, client: createSandboxPaymentClient({ origin: "https://test.invalid", fetch: fetcher }) };
}
function controlledClient() {
  return { catalog: vi.fn<SandboxPaymentClient["catalog"]>(async () => publicCatalog), bridge: vi.fn<SandboxPaymentClient["bridge"]>(async () => subject),
    create: vi.fn<SandboxPaymentClient["create"]>(async () => order), status: vi.fn<SandboxPaymentClient["status"]>(async () => order),
    restore: vi.fn<SandboxPaymentClient["restore"]>(async () => order) };
}
afterEach(() => { vi.useRealTimers(); });

describe("optional sandbox payment wire and exact display", () => {
  it("has no constructor I/O and performs an exact same-origin, cookie-bound server-priced request", async () => {
    const f = wire(); expect(f.fetcher).not.toHaveBeenCalled();
    expect(await f.client.catalog(config)).toEqual(publicCatalog);
    const session = createSandboxPurchaseSession({ client: f.client, config, catalog: publicCatalog, subject, token, isCurrent: () => true, randomUUID: () => requestId });
    expect(await session.purchase()).toEqual(order);
    expect(f.calls.map(call => call.route)).toEqual(["payments/catalog", "license/bridge", "payments/order"]);
    const bridge = f.calls[1], purchase = f.calls[2];
    expect(bridge.init.headers).toMatchObject({ Authorization: "Bearer " + token });
    expect(purchase.body).toEqual({ v: 1, audience: config.audience, product: config.product, requestId, catalogVersion: "fixture-v1" });
    expect(purchase.init).toMatchObject({ credentials: "include", mode: "same-origin", redirect: "error", cache: "no-store" });
    expect(purchase.init.headers).not.toHaveProperty("Authorization"); session.dispose();
  });
  it("keeps an unconfigured catalog null and never infers a price, product or approval", async () => {
    const f = wire(); f.fetcher.mockResolvedValueOnce(response({ catalog: null }));
    expect(await f.client.catalog(config)).toBeNull(); expect(f.calls).toHaveLength(0);
    expect(decodeSandboxCatalog(catalog)).toBeNull(); // Extra disclosure is rejected rather than silently accepted.
  });
  it.each([{ mode: "production" }, { channel: "play-store" }, { product: "paid.base" }, { currency: "USD" }, { amountMinor: 1.5 },
    { amountMinor: 0 }, { amountMinor: Number.MAX_SAFE_INTEGER + 1 }, { audience: "other-web" }, { catalogVersion: "../x" }, { premium: true }])(
    "rejects a malformed, foreign or nonsandbox catalog %j", async patch => {
      const f = wire(); f.fetcher.mockResolvedValueOnce(response({ catalog: { ...publicCatalog, ...patch } }));
      await expect(f.client.catalog(config)).rejects.toMatchObject({ reason: "invalid-response" });
    });
  it.each(["https://attacker.invalid/api-pages/v2/payment-confirm/x", "http://yoomoney.ru/api-pages/v2/payment-confirm/x",
    "https://yoomoney.ru.evil.test/api-pages/v2/payment-confirm/x", "https://user:secret@yoomoney.ru/api-pages/v2/payment-confirm/x",
    "https://yoomoney.ru:444/api-pages/v2/payment-confirm/x", "https://yoomoney.ru/api-pages/v2/payment-confirm/x#secret",
    "javascript:alert(1)", "https://yoomoney.ru/other/path", "https://yoomoney.ru\\@attacker.invalid/api-pages/v2/payment-confirm/x"])(
    "rejects an unsafe confirmation redirect %s", value => {
      expect(safeSandboxConfirmationUrl(value)).toBeNull(); expect(decodeSandboxOrder({ ...order, confirmationUrl: value }, config.product)).toBeNull();
    });
  it("validates full order scope and immutable copied records without accepting entitlement or accessors", () => {
    const decoded = decodeSandboxOrder(order, config.product); expect(decoded).toEqual(order); expect(Object.isFrozen(decoded)).toBe(true);
    expect(decodeSandboxOrder({ ...order, product: "sandbox.other" }, config.product)).toBeNull();
    expect(decodeSandboxOrder({ ...order, environment: "production" }, config.product)).toBeNull();
    expect(decodeSandboxOrder({ ...order, grant: "forged" }, config.product)).toBeNull();
    expect(decodeSandboxOrder({ ...order, refundStatus: ["pending"] }, config.product)).toBeNull();
    expect(decodeSandboxOrder({ ...order, status: "succeeded" }, config.product)).toBeNull(); // A finished order must not retain a redirect.
    const getter = vi.fn(() => "sandbox");
    expect(decodeSandboxOrder(Object.defineProperty({ ...order }, "environment", { enumerable: true, get: getter }), config.product)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });
  it("shows exact minor-unit amounts and equal RU/EN message keys", () => {
    expect(sandboxAmountLabel(12345, "ru")).toBe("123,45 ₽"); expect(sandboxAmountLabel(12345, "en")).toBe("RUB 123.45");
    expect(sandboxAmountLabel(Number.MAX_SAFE_INTEGER, "en")).toBe("RUB 90,071,992,547,409.91");
    expect(Object.keys(sandboxPaymentCopy.ru).sort()).toEqual(Object.keys(sandboxPaymentCopy.en).sort());
    expect(sandboxPaymentCopy.reviewStatus).toBe("draft-requires-editorial-review");
  });
  it("bounds a fetch that ignores abort and sanitizes its late rejection", async () => {
    vi.useFakeTimers(); const never = deferred<Response>(), fetcher = vi.fn<typeof fetch>(() => never.promise);
    const client = createSandboxPaymentClient({ origin: "https://test.invalid", fetch: fetcher, timeoutMs: 100 });
    const pending = client.catalog(config), checked = expect(pending).rejects.toMatchObject({ reason: "unavailable" });
    await vi.advanceTimersByTimeAsync(101); await checked;
    never.resolve(response({ catalog: publicCatalog })); await Promise.resolve();
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("rejects oversized or invalid remote bodies without displaying upstream text", async () => {
    const f = wire(); f.fetcher.mockResolvedValueOnce(response({ message: "private-token".repeat(2000) }));
    await expect(f.client.catalog(config)).rejects.toMatchObject({ reason: "invalid-response" });
    f.fetcher.mockResolvedValueOnce(response({ error: "private-upstream-token" }, 503));
    await expect(f.client.catalog(config)).rejects.toThrow("unavailable");
  });
});

describe("exact canonical-session purchase intent and uncertain result", () => {
  it("holds stale price after a conflict, explicitly reviews new metadata without I/O, and retries the identical uncertain UUID", async () => {
    const f = wire(), session = createSandboxPurchaseSession({ client: f.client, config, catalog: publicCatalog, subject, token,
      isCurrent: () => true, randomUUID: () => requestId });
    f.fetcher.mockResolvedValueOnce(response({ subject })).mockResolvedValueOnce(response({ error: "payment-catalog-changed" }, 409));
    await expect(session.purchase()).rejects.toMatchObject({ reason: "catalog-changed" });
    const calls = f.fetcher.mock.calls.length;
    await expect(session.purchase()).rejects.toMatchObject({ reason: "catalog-changed" }); expect(f.fetcher).toHaveBeenCalledTimes(calls);
    const next: SandboxCatalog = { ...publicCatalog, catalogVersion: "fixture-v2", amountMinor: 23456 };
    session.reviewCatalog(next); expect(f.fetcher).toHaveBeenCalledTimes(calls);
    // The server restores an existing v1 reservation; its original amount is
    // kept as an explicitly versioned old order, never relabeled as the v2 price.
    expect(await session.purchase()).toEqual(order);
    const createCalls = f.fetcher.mock.calls.filter(([url]) => String(url).endsWith("payments/order"));
    expect(createCalls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { v: 1, audience: config.audience, product: config.product, requestId, catalogVersion: "fixture-v1" },
      { v: 1, audience: config.audience, product: config.product, requestId, catalogVersion: "fixture-v2" },
    ]); session.dispose();
  });
  it("rejects an order with a different amount for the displayed version but keeps explicitly older restore prices", async () => {
    const client = controlledClient(); client.create.mockResolvedValueOnce({ ...order, amountMinor: 999 });
    const session = createSandboxPurchaseSession({ client, config, catalog: publicCatalog, subject, token, isCurrent: () => true, randomUUID: () => requestId });
    await expect(session.purchase()).rejects.toMatchObject({ reason: "invalid-response" });
    client.restore.mockResolvedValueOnce({ ...order, catalogVersion: "fixture-older", amountMinor: 999 });
    expect(await session.restore()).toMatchObject({ catalogVersion: "fixture-older", amountMinor: 999 }); session.dispose();
  });
  it.each([() => "yes", () => { throw new Error("missing-host-proof"); }])("denies malformed host current-session proofs before I/O", async proof => {
    const client = controlledClient();
    const session = createSandboxPurchaseSession({ client, config, catalog: publicCatalog, subject, token,
      isCurrent: proof as unknown as () => boolean, randomUUID: () => requestId });
    await expect(session.purchase()).rejects.toMatchObject({ reason: "stale" }); expect(client.bridge).not.toHaveBeenCalled(); session.dispose();
  });
  it("retains one request UUID after uncertainty, rejects a concurrent double tap, and reconciles without another intent", async () => {
    const client = controlledClient(), wait = deferred<SandboxOrder | null>(), randomUUID = vi.fn(() => requestId);
    client.create.mockImplementationOnce(() => wait.promise);
    const session = createSandboxPurchaseSession({ client, config, catalog: publicCatalog, subject, token, isCurrent: () => true, randomUUID });
    const first = session.purchase(); await Promise.resolve();
    await expect(session.purchase()).rejects.toMatchObject({ reason: "busy" });
    wait.resolve(null); await expect(first).rejects.toMatchObject({ reason: "invalid-response" }); // A malformed/lost result cannot become authorization.
    await session.purchase(); await session.status(); await session.restore();
    expect(randomUUID).toHaveBeenCalledOnce(); expect(client.create.mock.calls.map(call => call[1])).toEqual([requestId, requestId]);
    expect(client.status).toHaveBeenCalledWith(publicCatalog, orderId, expect.any(AbortSignal)); session.dispose();
  });
  it("keeps the UUID after an actual rejected response and changes it only for an explicit new intent after a known refund", async () => {
    const client = controlledClient(), randomUUID = vi.fn().mockReturnValueOnce(requestId).mockReturnValueOnce(orderId);
    client.create.mockRejectedValueOnce(new Error("uncertain-private-network-details"));
    const session = createSandboxPurchaseSession({ client, config, catalog: publicCatalog, subject, token, isCurrent: () => true, randomUUID });
    await expect(session.purchase()).rejects.toThrow("unavailable");
    await session.purchase();
    client.status.mockResolvedValueOnce({ ...order, status: "refunded", confirmationUrl: null }); await session.status();
    client.create.mockRejectedValueOnce(new Error("second-uncertain")); await expect(session.purchase()).rejects.toThrow("unavailable");
    await session.purchase();
    expect(client.create.mock.calls.map(call => call[1])).toEqual([requestId, requestId, orderId, orderId]); session.dispose();
  });
  it("never sends the order when bridge ownership differs or the captured session changes during its await", async () => {
    const client = controlledClient(); client.bridge.mockResolvedValueOnce(orderId);
    const owner = {}, other = {}; let current = owner;
    const session = createSandboxPurchaseSession({ client, config, catalog: publicCatalog, subject, token, isCurrent: () => current === owner, randomUUID: () => requestId });
    await expect(session.purchase()).rejects.toMatchObject({ reason: "authentication" }); expect(client.create).not.toHaveBeenCalled();
    client.bridge.mockImplementationOnce(async () => { current = other; return subject; });
    await expect(session.purchase()).rejects.toMatchObject({ reason: "stale" }); expect(client.create).not.toHaveBeenCalled(); session.dispose();
  });
  it("disposal fences an old A→B→A promise even when subject and token strings are identical", async () => {
    const client = controlledClient(), wait = deferred<SandboxOrder | null>(); client.create.mockImplementationOnce(() => wait.promise);
    let current = true;
    const old = createSandboxPurchaseSession({ client, config, catalog: publicCatalog, subject, token, isCurrent: () => current, randomUUID: () => requestId });
    const pending = old.purchase(); await Promise.resolve(); current = false; old.dispose(); current = true;
    const replacement = createSandboxPurchaseSession({ client, config, catalog: publicCatalog, subject, token, isCurrent: () => current, randomUUID: () => orderId });
    wait.resolve(order); await expect(pending).rejects.toMatchObject({ reason: "stale" });
    await expect(old.purchase()).rejects.toMatchObject({ reason: "stale" });
    expect(await replacement.purchase()).toEqual(order); expect(client.create.mock.calls[1][1]).toBe(orderId); replacement.dispose();
  });
  it("uses only restore for a returning account with no known local order and has no constructor side effects", async () => {
    const client = controlledClient(); client.restore.mockResolvedValueOnce(null);
    const session = createSandboxPurchaseSession({ client, config, catalog: publicCatalog, subject, token, isCurrent: () => true });
    expect(client.bridge).not.toHaveBeenCalled(); expect(await session.restore()).toBeNull();
    expect(client.create).not.toHaveBeenCalled(); await expect(session.status()).rejects.toMatchObject({ reason: "invalid-response" }); session.dispose();
  });
});
