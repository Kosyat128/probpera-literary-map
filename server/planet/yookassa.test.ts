import { describe, expect, it, vi } from "vitest";
import { createYooKassaSandboxGateway, paymentMatchesOrder, rublesFromMinor, rublesToMinor, type YooKassaOrderBinding } from "./yookassa";

const paymentId = "23d93cac-000f-5000-8000-126628f15141", refundId = "216749f7-0016-50be-b000-078d43a63ae4";
const binding: YooKassaOrderBinding = { id: "116749f7-0016-40be-8000-078d43a63ae4", subject: "b7d3c04e-a59a-4bda-8db4-4b2f8c573e74",
  product: "sandbox.base-v1", catalogVersion: "synthetic-test-v1", amountMinor: 12345, currency: "RUB", shopId: "100500",
  returnUrl: "https://payment-fixture.invalid/planet/ru/", createKey: "316749f7-0016-40be-8000-078d43a63ae4",
  refundKey: "416749f7-0016-40be-8000-078d43a63ae4", providerId: null };
function payment(change: Record<string, unknown> = {}) {
  return { id: paymentId, status: "pending", paid: false, test: true, amount: { value: "123.45", currency: "RUB" },
    recipient: { account_id: "100500" }, created_at: "2026-10-02T12:00:00Z",
    metadata: { order_id: binding.id, subject: binding.subject, product: binding.product, catalog_version: binding.catalogVersion },
    confirmation: { type: "redirect", confirmation_url: "https://yoomoney.ru/api-pages/v2/payment-confirm/epl?orderId=" + paymentId }, ...change };
}
function setup(value: unknown = payment()) {
  const transport = vi.fn<typeof fetch>(async () => Response.json(value));
  const gateway = createYooKassaSandboxGateway({ mode: "sandbox", shopId: "100500", secretKey: "test_synthetic_not_a_key", fetch: transport });
  return { gateway, transport };
}
describe("preliminary YooKassa web sandbox transport, entirely synthetic", () => {
  it.each([1, 99, 100, 12345, Number.MAX_SAFE_INTEGER])("round-trips exact minor units %s without floats", amount => {
    expect(rublesToMinor(rublesFromMinor(amount))).toBe(amount);
  });
  it.each(["1", "1.0", "01.00", "1.000", "1e2", "-1.00", "0.00", "90071992547409.92", 1.00, null])("rejects malformed or nonpositive money %s", amount => {
    expect(rublesToMinor(amount)).toBeNull();
  });
  it("does no network on construction and sends only server catalog/metadata with stable Basic/idempotence headers", async () => {
    const f = setup(); expect(f.transport).not.toHaveBeenCalled();
    const result = await f.gateway.createPayment(binding);
    const [url, init] = f.transport.mock.calls[0], headers = new Headers(init?.headers);
    expect(url).toBe("https://api.yookassa.ru/v3/payments"); expect(init?.redirect).toBe("error"); expect(init?.cache).toBe("no-store");
    expect(headers.get("authorization")).toBe("Basic " + btoa("100500:test_synthetic_not_a_key"));
    expect(headers.get("idempotence-key")).toBe(binding.createKey);
    expect(JSON.parse(String(init?.body))).toEqual({ amount: { value: "123.45", currency: "RUB" }, capture: true,
      confirmation: { type: "redirect", return_url: binding.returnUrl }, metadata: { order_id: binding.id, subject: binding.subject,
        product: binding.product, catalog_version: binding.catalogVersion } });
    expect(paymentMatchesOrder(result, binding)).toBe(true); expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("test_synthetic_not_a_key");
  });
  it.each([{ mode: "production" }, { secretKey: "live_synthetic_not_a_key" }, { shopId: "../merchant" }, { timeoutMs: Infinity }, { timeoutMs: 0 }])("rejects unsupported/live configuration %o before network", change => {
    const transport = vi.fn();
    expect(() => createYooKassaSandboxGateway({ mode: "sandbox", shopId: "100500", secretKey: "test_synthetic_not_a_key", fetch: transport,
      ...change } as Parameters<typeof createYooKassaSandboxGateway>[0])).toThrow(); expect(transport).not.toHaveBeenCalled();
  });
  it.each([{ test: false }, { test: "true" }, { recipient: { account_id: "other-shop" } }, { amount: { value: "123.46", currency: "RUB" } },
    { amount: { value: "123.45", currency: "USD" } }, { status: "succeeded", paid: false }, { id: "../../private" },
    { metadata: { ...payment().metadata, subject: "a7d3c04e-a59a-4bda-8db4-4b2f8c573e74" } },
    { metadata: { ...payment().metadata, product: "base-v1" } }, { metadata: { ...payment().metadata, catalog_version: "stale" } },
    { metadata: { ...payment().metadata, order_id: "a16749f7-0016-40be-8000-078d43a63ae4" } }])("denies unbound provider response %o", async change => {
    await expect(setup(payment(change)).gateway.createPayment(binding)).rejects.toThrow();
  });
  it.each(["https://attacker.invalid/pay", "https://yoomoney.ru.evil.invalid/pay", "https://yoomoney.ru@attacker.invalid/pay", "http://yoomoney.ru/api-pages/v2/payment-confirm/epl",
    "https://yoomoney.ru:8443/api-pages/v2/payment-confirm/epl", "https://yoomoney.ru/api-pages/v2/payment-confirm/epl#token", "javascript:alert(1)"])('rejects hostile checkout redirect %s', async url => {
    await expect(setup(payment({ confirmation: { type: "redirect", confirmation_url: url } })).gateway.payment(paymentId)).rejects.toThrow();
  });
  it("never trusts a same-shop unrelated payment or accepts a foreign refund", async () => {
    const f = setup(payment({ id: refundId })); await expect(f.gateway.payment(paymentId)).rejects.toThrow();
    f.transport.mockResolvedValue(Response.json({ id: refundId, payment_id: refundId, status: "succeeded", amount: { value: "123.45", currency: "RUB" }, created_at: "2026-10-02T12:00:00Z" }));
    await expect(f.gateway.createFullRefund({ ...binding, providerId: paymentId })).rejects.toThrow();
  });
  it("does not follow redirects, reflect provider errors, or retry POST automatically after unknown response", async () => {
    const f = setup(); f.transport.mockResolvedValue(Response.json({ error: "private-provider-secret" }, { status: 500 }));
    await expect(f.gateway.createPayment(binding)).rejects.toThrow("Sandbox provider unavailable"); expect(f.transport).toHaveBeenCalledTimes(1);
    f.transport.mockResolvedValue(new Response("private", { status: 302, headers: { location: "https://attacker.invalid" } }));
    await expect(f.gateway.payment(paymentId)).rejects.toThrow("Sandbox provider unavailable");
  });
  it("rejects malformed, overlimit and non-JSON provider bodies", async () => {
    const f = setup();
    for (const response of [new Response("not json", { headers: { "content-type": "text/html" } }),
      new Response("{bad", { headers: { "content-type": "application/json" } }),
      new Response("{}", { headers: { "content-type": "application/json", "content-length": "524289" } })]) {
      f.transport.mockResolvedValue(response); await expect(f.gateway.payment(paymentId)).rejects.toThrow();
    }
  });
  it("requires complete authenticated refund pagination and rejects replayed cursors/duplicate refunds", async () => {
    const f = setup({ type: "list", items: [], next_cursor: "page2" });
    await expect(f.gateway.successfulRefunds(paymentId)).rejects.toThrow("Invalid refund cursor"); expect(f.transport).toHaveBeenCalledTimes(2);
    const refund = { id: refundId, payment_id: paymentId, status: "succeeded", amount: { value: "123.45", currency: "RUB" }, created_at: "2026-10-02T12:00:00Z" };
    f.transport.mockResolvedValue(Response.json({ type: "list", items: [refund, refund] }));
    await expect(f.gateway.successfulRefunds(paymentId)).rejects.toThrow();
  });
  it("does not perform an aborted operation or accept a production order namespace", async () => {
    const f = setup(), controller = new AbortController(); controller.abort();
    await expect(f.gateway.payment(paymentId, controller.signal)).rejects.toThrow();
    await expect(f.gateway.createPayment({ ...binding, product: "base-v1" })).rejects.toThrow(); expect(f.transport).not.toHaveBeenCalled();
  });
  it("ends stalled transport/body work within its explicit deadline and observes late failure without another POST", async () => {
    let rejectLate: (reason: unknown) => void = () => undefined;
    const network = vi.fn<typeof fetch>(() => new Promise((_resolve, reject) => { rejectLate = reject; }));
    const gateway = createYooKassaSandboxGateway({ mode: "sandbox", shopId: "100500", secretKey: "test_synthetic_not_a_key", fetch: network, timeoutMs: 20 });
    await expect(gateway.createPayment(binding)).rejects.toThrow("interrupted"); rejectLate(Error("late-private-secret")); await Promise.resolve(); expect(network).toHaveBeenCalledTimes(1);
    network.mockResolvedValue(new Response(new ReadableStream({ start() { /* Deliberately never finishes. */ } }), { headers: { "content-type": "application/json" } }));
    await expect(gateway.payment(paymentId)).rejects.toThrow("interrupted");
  });
});
