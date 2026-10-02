import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createPaymentRetryTestDatabase } from "../../scripts/database/fixtures/literary-planet-payment-retry-context.mjs";
import { createSandboxPaymentOrders, decodePaymentOrder, normalizedPaymentHash, type PaymentOrder, type OrderReservation } from "./paymentOrders";
import { createCanonicalPaymentOrderStore } from "./paymentOrdersSupabase";
import { createCanonicalSupabaseServices } from "./supabase";
import { YOOKASSA_SANDBOX_PROVIDER, type SandboxPayment, type SandboxPaymentGateway, type SandboxRefund, type YooKassaOrderBinding } from "./yookassa";

// Actual local PostgreSQL schema/functions and actual Supabase SDK; transport and
// provider objects are explicitly synthetic. PGlite's one connection does not
// prove cross-process database contention or a genuine YooKassa sandbox payment.
const migration = readFileSync(new URL("../../supabase/migrations/20261002172514_planet_yookassa_sandbox_orders.sql", import.meta.url), "utf8");
const project = "https://orders-fixture.supabase.invalid", product = "sandbox.base-v1";
let db: PGlite;
beforeAll(async () => { db = await createPaymentRetryTestDatabase(); await db.exec(migration); }, 30_000);
beforeEach(async () => { await db.exec("begin"); });
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db?.close(); });
async function scalar<T = unknown>(sql: string, values: unknown[] = []): Promise<T> {
  return (await db.query<{ value: T }>(sql, values)).rows[0]?.value;
}
async function reader() {
  const subject = crypto.randomUUID(); await db.query("insert into auth.users(id) values($1::uuid)", [subject]);
  await db.query("insert into public.profiles(id,display_name,role) values($1::uuid,'Synthetic payment reader','reader')", [subject]); return subject;
}
const RPC: Record<string, { sql: string; keys: string[] }> = {
  planet_reserve_sandbox_order: { sql: "select public.planet_reserve_sandbox_order($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::bigint,$7,$8,$9::uuid,$10::uuid) as value",
    keys: ["p_id", "p_request_id", "p_subject", "p_product", "p_catalog_version", "p_amount_minor", "p_shop_id", "p_return_url", "p_create_key", "p_refund_key"] },
  planet_read_sandbox_order: { sql: "select public.planet_read_sandbox_order($1::uuid,$2::uuid,$3,$4) as value", keys: ["p_subject", "p_order_id", "p_payment_id", "p_product"] },
  planet_claim_sandbox_order: { sql: "select public.planet_claim_sandbox_order($1::uuid,$2::uuid,$3::uuid,$4,$5::integer) as value", keys: ["p_subject", "p_order_id", "p_lease_token", "p_operation", "p_lease_seconds"] },
  planet_record_sandbox_payment: { sql: "select public.planet_record_sandbox_payment($1::uuid,$2::uuid,$3,$4,$5) as value", keys: ["p_subject", "p_order_id", "p_payment_id", "p_status", "p_confirmation_url"] },
  planet_record_sandbox_refund: { sql: "select public.planet_record_sandbox_refund($1::uuid,$2::uuid,$3,$4,$5,$6::bigint) as value", keys: ["p_subject", "p_order_id", "p_payment_id", "p_refund_id", "p_status", "p_amount_minor"] },
  planet_get_web_access: { sql: "select public.planet_get_web_access($1::uuid,$2) as value", keys: ["p_user_id", "p_product_id"] },
  planet_enqueue_verified_payment_retry: { sql: "select public.planet_enqueue_verified_payment_retry($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as value",
    keys: ["p_provider", "p_event_id", "p_payload_sha256", "p_transaction_id", "p_user_id", "p_product_id", "p_status", "p_occurred_at"] },
  planet_apply_verified_payment_event: { sql: "select public.planet_apply_verified_payment_event($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as value",
    keys: ["p_provider", "p_event_id", "p_payload_sha256", "p_transaction_id", "p_user_id", "p_product_id", "p_status", "p_occurred_at"] },
};
const localFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init), url = new URL(request.url);
  expect(url.origin).toBe(project); expect(url.pathname.startsWith("/rest/v1/rpc/")).toBe(true);
  expect(request.headers.get("authorization")).toBe("Bearer synthetic-service-role"); expect(request.cache).toBe("no-store"); expect(request.redirect).toBe("error");
  const args = await request.json() as Record<string, unknown>, operation = RPC[url.pathname.slice("/rest/v1/rpc/".length)];
  expect(operation).toBeDefined(); expect(Object.keys(args).sort()).toEqual([...operation.keys].sort());
  await db.exec("savepoint synthetic_rpc");
  try {
    const value = await scalar(operation.sql, operation.keys.map(key => args[key])); await db.exec("release savepoint synthetic_rpc"); return Response.json(value);
  } catch {
    await db.exec("rollback to savepoint synthetic_rpc"); await db.exec("release savepoint synthetic_rpc");
    return Response.json({ code: "P0001", message: "Synthetic SQL rejected operation" }, { status: 400 });
  }
};
const canonical = { canonicalProjectUrl: project, publishableKey: "synthetic-publishable", serviceRoleKey: "synthetic-service-role", recentAuthenticationSeconds: 300, fetch: localFetch };
async function fixture() {
  const subject = await reader(), store = createCanonicalPaymentOrderStore(canonical), ledger = createCanonicalSupabaseServices(canonical).ledger;
  const payments = new Map<string, SandboxPayment>(), refunds = new Map<string, SandboxRefund>(), created: YooKassaOrderBinding[] = [];
  const successful: SandboxRefund[] = []; let unknownAfterCreate = false, unknownAfterRefund = false, failLedger = false;
  const gateway: SandboxPaymentGateway = { provider: YOOKASSA_SANDBOX_PROVIDER, shopId: "100500",
    createPayment: vi.fn(async (order) => {
      created.push({ ...order });
      let payment = payments.get(order.id);
      if (!payment) {
        payment = Object.freeze({ id: crypto.randomUUID(), status: "pending", amountMinor: order.amountMinor, currency: "RUB", shopId: order.shopId, test: true,
          paid: false, orderId: order.id, subject: order.subject, product: order.product, catalogVersion: order.catalogVersion,
          createdAt: "2026-10-02T12:00:00.000Z", confirmationUrl: "https://yoomoney.ru/api-pages/v2/payment-confirm/epl?orderId=" + order.id });
        payments.set(order.id, payment);
      }
      if (unknownAfterCreate) { unknownAfterCreate = false; throw new Error("Synthetic provider accepted, reply lost"); }
      return payment;
    }),
    payment: vi.fn(async id => { const value = [...payments.values()].find(item => item.id === id); if (!value) throw Error("Synthetic missing payment"); return value; }),
    successfulRefunds: vi.fn(async id => successful.filter(item => item.paymentId === id)),
    createFullRefund: vi.fn(async order => {
      let refund = refunds.get(order.id);
      if (!refund) { refund = { id: crypto.randomUUID(), paymentId: order.providerId!, status: "succeeded", amountMinor: order.amountMinor,
        currency: "RUB", createdAt: "2026-10-02T13:00:00.000Z" }; refunds.set(order.id, refund); successful.push(refund); }
      if (unknownAfterRefund) { unknownAfterRefund = false; throw Error("Synthetic refund accepted, reply lost"); } return refund;
    }),
    refund: vi.fn(async id => { const value = successful.find(item => item.id === id); if (!value) throw Error("Synthetic missing refund"); return value; }),
  };
  const create = (version = "synthetic-v1", amountMinor = 12345) => createSandboxPaymentOrders({ gateway, store, ledger: { enqueueVerifiedEvent: (...args) => ledger.enqueueVerifiedEvent(...args),
    applyPayment: (...args) => failLedger ? Promise.reject(new Error("Synthetic ledger unavailable")) : ledger.applyPayment(...args) },
    returnUrl: "https://orders-fixture.invalid/planet/ru/", leaseSeconds: 30, catalog: [{ product, version, amountMinor, currency: "RUB" }] });
  const succeed = (orderId: string) => { const payment = payments.get(orderId)!; payments.set(orderId, { ...payment, status: "succeeded", paid: true, confirmationUrl: null }); };
  const expireLease = (orderId: string) => db.query("update public.planet_sandbox_orders set lease_until=clock_timestamp()-interval '1 second' where id=$1::uuid", [orderId]);
  return { subject, store, ledger, gateway, payments, refunds, successful, created, create, service: create(), succeed, expireLease,
    loseCreate: () => { unknownAfterCreate = true; }, loseRefund: () => { unknownAfterRefund = true; }, failApply: (value: boolean) => { failLedger = value; } };
}
describe("durable sandbox orders using actual local SQL/SDK", () => {
  it("restores the same uncertain operation/body/key after a catalog change without charging the new price", async () => {
    const f = await fixture(), intent = crypto.randomUUID(); f.loseCreate();
    await expect(f.service.create(f.subject, intent, product)).rejects.toThrow();
    const original = f.created[0]; await f.expireLease(original.id);
    const changed = f.create("synthetic-v2", 23456), recovered = await changed.restore(f.subject, product);
    expect(recovered).toMatchObject({ orderId: original.id, catalogVersion: "synthetic-v1", amountMinor: 12345 });
    expect(f.created).toHaveLength(2); expect(f.created[1]).toEqual(original);
    const retry = await changed.create(f.subject, intent, product);
    expect(retry).toMatchObject({ orderId: original.id, catalogVersion: "synthetic-v1", amountMinor: 12345 });
    expect(f.created).toHaveLength(2); expect(await scalar("select count(*)::integer as value from public.planet_sandbox_orders")).toBe(1);
  });
  it("coalesces request IDs and keeps immutable catalog price/key, including after service restart", async () => {
    const f = await fixture(), first = crypto.randomUUID(), second = crypto.randomUUID();
    const a = await f.service.create(f.subject, first, product), b = await f.service.create(f.subject, second, product);
    expect(a.orderId).toBe(b.orderId); expect(f.gateway.createPayment).toHaveBeenCalledTimes(1);
    expect((await f.create().create(f.subject, first, product)).orderId).toBe(a.orderId);
    expect(await scalar("select count(*)::integer as value from public.planet_sandbox_orders")).toBe(1);
    const row = await scalar<Record<string, unknown>>("select to_jsonb(o) as value from public.planet_sandbox_orders o");
    expect(row.intent_request_ids).toEqual([first, second]); expect(row.amount_minor).toBe(12345);
  });
  it("fences overlapping double taps while the first provider reply is pending, including a reconstructed server", async () => {
    const f = await fixture(), original = f.gateway.createPayment;
    let release: () => void = () => undefined, entered: () => void = () => undefined;
    const pending = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
    const delayed = vi.fn<typeof f.gateway.createPayment>(async (value, signal) => { entered(); await pending; return original(value, signal); });
    f.gateway.createPayment = delayed;
    const first = f.service.create(f.subject, crypto.randomUUID(), product); await started;
    const second = await f.create().create(f.subject, crypto.randomUUID(), product);
    expect(delayed).toHaveBeenCalledTimes(1); expect(second.status).toBe("new"); release();
    expect((await first).orderId).toBe(second.orderId); expect(f.created).toHaveLength(1);
  });
  it("preserves the original body/key after a lost accepted response and blocks a new charge after the provider horizon", async () => {
    const f = await fixture(), intent = crypto.randomUUID(); f.loseCreate();
    await expect(f.service.create(f.subject, intent, product)).rejects.toThrow(); const first = f.created[0];
    const busy = await f.create().create(f.subject, crypto.randomUUID(), product); expect(busy.orderId).toBe(first.id); expect(f.created).toHaveLength(1);
    await f.expireLease(first.id); await f.create().create(f.subject, intent, product);
    expect(f.created).toHaveLength(2); expect(f.created[1]).toEqual(first);
    const other = await fixture(); other.loseCreate(); await expect(other.service.create(other.subject, crypto.randomUUID(), product)).rejects.toThrow();
    await db.query("update public.planet_sandbox_orders set first_submitted_at=clock_timestamp()-interval '25 hours',lease_until=clock_timestamp()-interval '1 second' where id=$1::uuid", [other.created[0].id]);
    const unresolved = await other.service.create(other.subject, crypto.randomUUID(), product);
    expect(unresolved.status).toBe("reconcile-required"); expect(other.gateway.createPayment).toHaveBeenCalledTimes(1);
  });
  it("denies backward clock/horizon uncertainty without reusing a mutating operation", async () => {
    const f = await fixture(); f.loseCreate(); await expect(f.service.create(f.subject, crypto.randomUUID(), product)).rejects.toThrow();
    await db.query("update public.planet_sandbox_orders set first_submitted_at=clock_timestamp()+interval '1 hour',lease_until=clock_timestamp()-interval '1 second' where id=$1::uuid", [f.created[0].id]);
    expect((await f.service.status(f.subject, f.created[0].id)).status).toBe("reconcile-required"); expect(f.created).toHaveLength(1);
  });
  it("accepts a manually recovered existing provider ID after the horizon by GET only, never a new charge", async () => {
    const f = await fixture(); f.loseCreate(); await expect(f.service.create(f.subject, crypto.randomUUID(), product)).rejects.toThrow();
    const existing = f.created[0]; f.succeed(existing.id);
    await db.query("update public.planet_sandbox_orders set first_submitted_at=clock_timestamp()-interval '25 hours',lease_until=clock_timestamp()-interval '1 second' where id=$1::uuid", [existing.id]);
    expect((await f.service.status(f.subject, existing.id)).status).toBe("reconcile-required");
    expect((await f.create().reconcilePayment(f.payments.get(existing.id)!.id)).status).toBe("succeeded"); expect(f.created).toHaveLength(1);
    expect((await f.ledger.access(f.subject, product)).active).toBe(true);
  });
  it("grants only the sandbox product from an independently bound succeeded payment and restores on a new service", async () => {
    const f = await fixture(), initial = await f.service.create(f.subject, crypto.randomUUID(), product);
    expect((await f.ledger.access(f.subject, product)).active).toBe(false); f.succeed(initial.orderId);
    expect((await f.service.status(f.subject, initial.orderId)).status).toBe("succeeded");
    expect((await f.ledger.access(f.subject, product)).active).toBe(true); expect((await f.ledger.access(f.subject, "base-v1")).active).toBe(false);
    expect((await f.create().restore(f.subject, product))?.orderId).toBe(initial.orderId);
    expect(await scalar("select count(*)::integer as value from public.planet_payment_events")).toBe(1);
    expect(await scalar("select count(*)::integer as value from public.planet_purchase_receipts")).toBe(1);
  });
  it("keeps failed application durably queued and resumes the same event without duplicate grant", async () => {
    const f = await fixture(), initial = await f.service.create(f.subject, crypto.randomUUID(), product); f.succeed(initial.orderId); f.failApply(true);
    await expect(f.service.status(f.subject, initial.orderId)).rejects.toThrow();
    expect(await scalar("select count(*)::integer as value from public.planet_verified_payment_retries")).toBe(1);
    expect((await f.ledger.access(f.subject, product)).active).toBe(false); f.failApply(false);
    await f.create().restore(f.subject, product); await f.service.status(f.subject, initial.orderId);
    expect((await f.ledger.access(f.subject, product)).activeReceiptCount).toBe(1);
  });
  it("rejects foreign account restore/status and forged ownership/amount/shop/test response without entitlement", async () => {
    const f = await fixture(), initial = await f.service.create(f.subject, crypto.randomUUID(), product), other = await reader();
    await expect(f.service.status(other, initial.orderId)).rejects.toThrow("payment-order-not-found"); expect(await f.service.restore(other, product)).toBeNull();
    const payment = f.payments.get(initial.orderId)!;
    for (const change of [{ subject: other }, { amountMinor: 12344 }, { product: "base-v1" }, { shopId: "other" }, { test: false }, { catalogVersion: "stale" }]) {
      f.payments.set(initial.orderId, { ...payment, status: "succeeded", paid: true, ...change } as SandboxPayment);
      await expect(f.service.status(f.subject, initial.orderId)).rejects.toThrow();
      expect((await f.ledger.access(f.subject, product)).active).toBe(false);
    }
  });
  it("reconciles missed full refunds, revokes online receipt/session epoch, and prevents stale success revival", async () => {
    const f = await fixture(), initial = await f.service.create(f.subject, crypto.randomUUID(), product); f.succeed(initial.orderId);
    await f.service.status(f.subject, initial.orderId); const before = await f.ledger.access(f.subject, product), payment = f.payments.get(initial.orderId)!;
    f.successful.push({ id: crypto.randomUUID(), paymentId: payment.id, status: "succeeded", amountMinor: 12345, currency: "RUB", createdAt: "2026-10-02T13:00:00Z" });
    expect((await f.create().restore(f.subject, product))?.status).toBe("refunded");
    const after = await f.ledger.access(f.subject, product); expect(after.active).toBe(false); expect(after.sessionEpoch).toBeGreaterThan(before.sessionEpoch);
    f.successful.splice(0); await f.service.status(f.subject, initial.orderId);
    expect((await f.ledger.access(f.subject, product)).active).toBe(false);
  });
  it("preserves all coalesced original intents after refund; a new explicit intent alone may create another order", async () => {
    const f = await fixture(), firstId = crypto.randomUUID(), secondId = crypto.randomUUID();
    const initial = await f.service.create(f.subject, firstId, product); await f.service.create(f.subject, secondId, product); f.succeed(initial.orderId);
    await f.service.status(f.subject, initial.orderId); await f.service.refund(f.subject, initial.orderId);
    expect((await f.service.create(f.subject, secondId, product)).orderId).toBe(initial.orderId); expect(f.created).toHaveLength(1);
    expect((await f.service.create(f.subject, crypto.randomUUID(), product)).orderId).not.toBe(initial.orderId); expect(f.created).toHaveLength(2);
  });
  it("recovers a lost successful refund by GET before another mutation, including after restart", async () => {
    const f = await fixture(), initial = await f.service.create(f.subject, crypto.randomUUID(), product); f.succeed(initial.orderId); await f.service.status(f.subject, initial.orderId);
    f.loseRefund(); await expect(f.service.refund(f.subject, initial.orderId)).rejects.toThrow();
    expect((await f.create().refund(f.subject, initial.orderId)).status).toBe("refunded"); expect(f.gateway.createFullRefund).toHaveBeenCalledTimes(1);
    expect((await f.ledger.access(f.subject, product)).active).toBe(false);
  });
  it("holds partial refunds for the missing policy, never inventing a grant or full refund outcome", async () => {
    const f = await fixture(), initial = await f.service.create(f.subject, crypto.randomUUID(), product); f.succeed(initial.orderId);
    f.successful.push({ id: crypto.randomUUID(), paymentId: f.payments.get(initial.orderId)!.id, status: "succeeded", amountMinor: 100, currency: "RUB", createdAt: "2026-10-02T13:00:00Z" });
    expect((await f.service.status(f.subject, initial.orderId)).status).toBe("refund-review-required");
    expect((await f.ledger.access(f.subject, product)).active).toBe(false);
    await expect(f.service.refund(f.subject, initial.orderId)).rejects.toThrow("payment-refund-policy-required"); expect(f.gateway.createFullRefund).not.toHaveBeenCalled();
    f.successful.splice(0); expect((await f.create().restore(f.subject, product))?.status).toBe("refund-review-required");
    expect((await f.ledger.access(f.subject, product)).active).toBe(false);
  });
  it("holds fresh online entitlement after paid-to-partial-refund without falsely terminally refunding the paid receipt", async () => {
    const f = await fixture(), initial = await f.service.create(f.subject, crypto.randomUUID(), product); f.succeed(initial.orderId);
    await f.service.status(f.subject, initial.orderId); expect((await f.ledger.access(f.subject, product)).active).toBe(true);
    f.successful.push({ id: crypto.randomUUID(), paymentId: f.payments.get(initial.orderId)!.id, status: "succeeded", amountMinor: 100,
      currency: "RUB", createdAt: "2026-10-02T13:00:00Z" });
    expect((await f.create().restore(f.subject, product))?.status).toBe("refund-review-required");
    const held = await f.ledger.access(f.subject, product); expect(held.active).toBe(false); expect(held.activeReceiptCount).toBe(0); expect(held.accessBlocked).toBe(false);
    expect(await scalar("select status as value from public.planet_purchase_receipts where user_id=$1::uuid and product_id=$2", [f.subject, product])).toBe("active");
    f.successful.splice(0); await f.create().restore(f.subject, product); expect((await f.ledger.access(f.subject, product)).active).toBe(false);
  });
  it("uses authenticated current objects instead of notification amount/status/metadata and returns deterministic event hash", async () => {
    const f = await fixture(), initial = await f.service.create(f.subject, crypto.randomUUID(), product); f.succeed(initial.orderId);
    const payment = f.payments.get(initial.orderId)!, request = new Request("https://orders-fixture.invalid/planet/api/payments/webhook/yookassa-sandbox", { method: "POST" });
    const bytes = new TextEncoder().encode(JSON.stringify({ type: "notification", event: "payment.succeeded", object: { id: payment.id, paid: false, metadata: { subject: await reader() }, amount: { value: "0.01" } } }));
    const event = await f.service.verification.verify(request, bytes); expect(event).toMatchObject({ subject: f.subject, product, status: "active", transactionId: payment.id });
    if (!event || "acknowledgeOnly" in event) throw Error("Expected normalized synthetic event");
    const replay = await f.create().verification.verify(request, new TextEncoder().encode(JSON.stringify({ object: { id: payment.id }, event: "payment.succeeded", type: "notification" })));
    expect(replay).toEqual(event); expect(await normalizedPaymentHash(event)).toHaveLength(64);
    expect(f.service.verification.acknowledgementStatus).toBe(200); expect(f.service.verification.eventHashMode).toBe("normalized");
  });
  it("fences order creation and observation immediately after deletion request; classifier accepts only the new private cascade", async () => {
    const f = await fixture(), initial = await f.service.create(f.subject, crypto.randomUUID(), product);
    expect(await scalar("select public.planet_reader_deletion_blockers($1::uuid) as value", [f.subject])).toEqual([]);
    await scalar("select public.planet_request_account_deletion($1::uuid,$2::uuid) as value", [f.subject, crypto.randomUUID()]);
    await expect(f.service.create(f.subject, crypto.randomUUID(), product)).rejects.toThrow();
    await expect(f.service.status(f.subject, initial.orderId)).rejects.toThrow();
    expect(f.created).toHaveLength(1);
  });
  it("keeps table and every mutation RPC unavailable to anonymous/readers and grants only intended service functions", async () => {
    for (const role of ["anon", "authenticated"]) {
      expect(await scalar("select has_table_privilege($1,'public.planet_sandbox_orders','SELECT') as value", [role])).toBe(false);
      expect(await scalar("select has_table_privilege($1,'public.planet_sandbox_orders','INSERT') as value", [role])).toBe(false);
      for (const name of Object.keys(RPC).filter(name => name.includes("sandbox"))) {
        expect(await scalar("select has_function_privilege($1,p.oid,'EXECUTE') as value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$2", [role, name])).toBe(false);
      }
    }
    expect(await scalar("select has_table_privilege('service_role','public.planet_sandbox_orders','UPDATE') as value")).toBe(false);
    expect(await scalar("select has_function_privilege('service_role','public.planet_read_sandbox_order(uuid,uuid,text,text)','EXECUTE') as value")).toBe(true);
  });
  it("rejects unknown prices/products and malformed local store responses without provider calls", async () => {
    const f = await fixture();
    await expect(f.service.create(f.subject, crypto.randomUUID(), "base-v1")).rejects.toThrow("invalid-payment-request");
    expect(f.gateway.createPayment).not.toHaveBeenCalled();
    expect(() => createSandboxPaymentOrders({ catalog: [{ product, version: "synthetic", amountMinor: 1.1, currency: "RUB" }], gateway: f.gateway,
      store: f.store, ledger: f.ledger, returnUrl: "https://orders-fixture.invalid/planet/ru/", leaseSeconds: 30 })).toThrow();
    const reservation: OrderReservation = { id: crypto.randomUUID(), requestId: crypto.randomUUID(), subject: f.subject, product,
      catalogVersion: "synthetic", amountMinor: 100, currency: "RUB", shopId: "100500", returnUrl: "https://orders-fixture.invalid/planet/ru/", createKey: crypto.randomUUID(), refundKey: crypto.randomUUID() };
    const value = await f.store.reserve(reservation) as PaymentOrder;
    expect(decodePaymentOrder(value)).not.toBeNull(); expect(Object.isFrozen(decodePaymentOrder(value))).toBe(true);
    for (const createdAt of ["2026-10-02T12:00:00Z", "2026-10-02T15:00:00.123456+03:00", "2026-10-02T08:00:00-04:00"])
      expect(decodePaymentOrder({ ...value, createdAt })).not.toBeNull();
    for (const invalid of [null, {}, { ...value, amountMinor: Infinity }, { ...value, product: "base-v1" }, { ...value, extra: "private" },
      { ...value, createdAt: "2026-10-02T12:00:00" }, { ...value, createdAt: "2026-10-02T12:00:00+24:00" },
      { ...value, createdAt: "2026-10-02T12:00:00+03:60" }, { ...value, firstSubmittedAt: "not-a-clock" },
      Object.defineProperty({ ...value }, "subject", { get() { throw Error("Getter must not run"); }, enumerable: true })]) expect(decodePaymentOrder(invalid)).toBeNull();
  });
  it("coexists with the later live-session RLS migration while fencing both order writes and ordinary reader mutations", async () => {
    // Explicit joint current-schema assertion; historical setup graph is intact.
    const sessionSql = readFileSync(new URL("../../supabase/migrations/20261002173942_planet_reader_live_session_fence.sql", import.meta.url), "utf8");
    await db.exec(sessionSql); const f = await fixture(), initial = await f.service.create(f.subject, crypto.randomUUID(), product);
    expect(await scalar("select public.planet_reader_deletion_blockers($1::uuid) as value", [f.subject])).toEqual([]);
    expect(await scalar("select auth.jwt() as value")).toEqual({});
    await scalar("select public.planet_request_account_deletion($1::uuid,$2::uuid) as value", [f.subject, crypto.randomUUID()]);
    await expect(f.service.status(f.subject, initial.orderId)).rejects.toThrow();
    await db.exec("savepoint blocked_reader_write");
    try {
      await expect(db.query("insert into public.reader_book_collections(id,user_id,name) values('synthetic-fenced',$1::uuid,'Synthetic fenced collection')", [f.subject])).rejects.toThrow("PLANET_READER_DELETION_FENCED");
    } finally { await db.exec("rollback to savepoint blocked_reader_write"); await db.exec("release savepoint blocked_reader_write"); }
    expect(await scalar("select has_table_privilege('authenticated','public.planet_sandbox_orders','SELECT') as value")).toBe(false);
  });
});
