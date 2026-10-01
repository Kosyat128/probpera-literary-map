import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { createPaymentRetryTestDatabase, SETUP_INPUT_PATHS } from "../../scripts/database/fixtures/literary-planet-payment-retry-context.mjs";
import { createCanonicalLicenseRateLimiter } from "./licenseRateLimiterSupabase";

const migrationPath = "supabase/migrations/20261001194458_planet_license_rate_limits.sql";
export const LICENSE_RATE_LIMIT_SETUP_INPUT_PATHS = Object.freeze([...SETUP_INPUT_PATHS, migrationPath]);
const migration = readFileSync(new URL("../../" + migrationPath, import.meta.url), "utf8");
const product = "fixture-base", otherProduct = "fixture-addon";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
interface Decision { allowed: boolean; retry_after_seconds: number }
let db: PGlite | undefined;
function database(): PGlite { if (!db) throw Error("Missing isolated test database"); return db; }
async function scalar<T = unknown>(sql: string, parameters: unknown[] = []): Promise<T | undefined> {
  return (await database().query<{ result: T }>(sql, parameters)).rows[0]?.result;
}
async function asRole<T>(role: "anon" | "authenticated" | "service_role", work: () => Promise<T>): Promise<T> {
  await database().exec("savepoint role_operation");
  try { await database().exec("set role " + role); return await work(); }
  catch (error) { await database().exec("rollback to savepoint role_operation"); throw error; }
  finally { await database().exec("reset role"); await database().exec("release savepoint role_operation"); }
}
const service = <T = unknown>(sql: string, parameters: unknown[] = []) => asRole("service_role", () => scalar<T>(sql, parameters));
const consumeSql = "select public.planet_consume_license_grant_budget($1::uuid,$2,$3::integer,$4::integer) as result";
async function consume(subject: string | null, item: string, limit: number, window: number): Promise<Decision> {
  const result = await service<Decision>(consumeSql, [subject, item, limit, window]);
  if (!result) throw Error("Missing budget decision");
  return result;
}
const budget = (subject: string, item: string) => scalar<Record<string, unknown>>(
  "select to_jsonb(b) as result from public.planet_license_grant_budgets b where user_id=$1::uuid and product_id=$2", [subject, item]);
async function reader(): Promise<string> {
  const subject = randomUUID(); await database().query("insert into auth.users(id) values($1::uuid)", [subject]);
  await database().query("insert into public.profiles(id,display_name,role) values($1::uuid,'Budget fixture reader','reader')", [subject]);
  return subject;
}
function expectDenied(decision: Decision, window: number) {
  expect(Object.keys(decision).sort()).toEqual(["allowed", "retry_after_seconds"]);
  expect(decision.allowed).toBe(false); expect(Number.isInteger(decision.retry_after_seconds)).toBe(true);
  expect(decision.retry_after_seconds).toBeGreaterThanOrEqual(1); expect(decision.retry_after_seconds).toBeLessThanOrEqual(window);
}

// The genuine SDK terminates at the actual local SQL RPC. This substitutes only
// HTTP transport; no production service, Auth token or network is contacted.
const project = "https://license-budget-fixture.supabase.invalid";
const localFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init), url = new URL(request.url);
  expect(url.origin).toBe(project);
  expect(url.pathname).toBe("/rest/v1/rpc/planet_consume_license_grant_budget");
  expect(request.headers.get("authorization")).toBe("Bearer isolated-service-fixture");
  const args = await request.json() as Record<string, unknown>;
  expect(Object.keys(args).sort()).toEqual(["p_limit", "p_product_id", "p_subject", "p_window_seconds"]);
  try {
    const result = await service<Decision>(consumeSql, [args.p_subject, args.p_product_id, args.p_limit, args.p_window_seconds]);
    return Response.json(result);
  } catch {
    return Response.json({ code: "P0001", message: "Isolated SQL rejected request" }, { status: 400 });
  }
};
const limiter = (limit: number, windowSeconds: number) => createCanonicalLicenseRateLimiter({
  canonicalProjectUrl: project, publishableKey: "isolated-publishable-fixture", serviceRoleKey: "isolated-service-fixture", recentAuthenticationSeconds: 300, fetch: localFetch,
}, { limit, windowSeconds });

// One actual PGlite connection verifies RPC/ACL/rollback and integration with
// existing deletion/payment constraints; it does not prove concurrent contention.
describe.sequential("durable canonical license grant budgets", () => {
  beforeEach(async () => {
    db = await createPaymentRetryTestDatabase();
    await database().exec(migration); await database().exec("begin");
  }, 60_000);
  afterEach(async () => {
    if (!db) return;
    try { await db.exec("rollback"); }
    finally { await db.close(); db = undefined; }
  });

  it("preserves exhaustion across adapter recreation and real commit, then resets only an expired window", async () => {
    const subject = await reader();
    expect(await limiter(2, 60).consume(subject, product)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(await limiter(2, 60).consume(subject, product)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    await database().exec("commit"); await database().exec("begin");
    const before = await budget(subject, product);
    expect(before).toMatchObject({ used: 2, grant_limit: 2, window_seconds: 60 });
    for (let attempt = 0; attempt < 2; attempt++) {
      const denied = await limiter(2, 60).consume(subject, product);
      expect(denied.allowed).toBe(false); expect(Number.isInteger(denied.retryAfterSeconds)).toBe(true);
      expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1); expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);
      expect(await budget(subject, product)).toEqual(before);
    }
    // Change only fixture data, without sleeping or supplying a client clock.
    await database().query("update public.planet_license_grant_budgets set window_started_at=statement_timestamp()-interval '61 seconds' where user_id=$1::uuid and product_id=$2", [subject, product]);
    expect(await limiter(3, 120).consume(subject, product)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(await budget(subject, product)).toMatchObject({ used: 1, grant_limit: 3, window_seconds: 120 });
  });

  it("isolates subject/product budgets and rejects policy churn, invalid input and browser access", async () => {
    const subject = await reader(), other = await reader();
    for (const [owner, item] of [[subject, product], [subject, otherProduct], [other, product]] as const) {
      expect(await consume(owner, item, 1, 60)).toEqual({ allowed: true, retry_after_seconds: 0 });
      expectDenied(await consume(owner, item, 1, 60), 60);
    }
    const before = await budget(subject, product);
    await expect(consume(subject, product, 2, 60)).rejects.toThrow("PLANET_LICENSE_GRANT_BUDGET_POLICY_CONFLICT");
    await expect(consume(subject, product, 1, 120)).rejects.toThrow("PLANET_LICENSE_GRANT_BUDGET_POLICY_CONFLICT");
    for (const parameters of [[subject, product, 0, 60], [subject, product, 10001, 60],
      [subject, product, 1, 0], [subject, product, 1, 86401], [subject, "x".repeat(121), 1, 60], [null, product, 1, 60]]) {
      await expect(service(consumeSql, parameters)).rejects.toThrow("PLANET_INVALID_LICENSE_GRANT_BUDGET");
    }
    for (const role of ["anon", "authenticated"] as const) {
      await expect(asRole(role, () => scalar(consumeSql, [subject, product, 1, 60]))).rejects.toThrow(/permission denied/u);
      await expect(asRole(role, () => database().query("select * from public.planet_license_grant_budgets"))).rejects.toThrow(/permission denied/u);
    }
    await expect(asRole("service_role", () => database().query("update public.planet_license_grant_budgets set user_id=$1::uuid where user_id=$2::uuid", [other, subject]))).rejects.toThrow(/permission denied/u);
    expect(await budget(subject, product)).toEqual(before);
    expect(await scalar<number>("select count(*)::integer as result from public.planet_license_grant_budgets")).toBe(3);
  });

  it("rejects an actual RPC permission outage through the adapter without resetting the stored quota", async () => {
    const subject = await reader();
    expect(await limiter(1, 60).consume(subject, product)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    const before = await budget(subject, product);
    await database().exec("revoke execute on function public.planet_consume_license_grant_budget(uuid,text,integer,integer) from service_role");
    await expect(limiter(1, 60).consume(subject, product)).rejects.toThrow();
    expect(await budget(subject, product)).toEqual(before);
    await database().exec("grant execute on function public.planet_consume_license_grant_budget(uuid,text,integer,integer) to service_role");
    const denied = await limiter(1, 60).consume(subject, product);
    expect(denied.allowed).toBe(false); expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60); expect(await budget(subject, product)).toEqual(before);
  });

  it("preserves canonical deletion preflight, fences consumption and cascades counters/queue while unlinking finance", async () => {
    const subject = await reader(), other = await reader(), eventId = randomUUID(), transactionId = randomUUID();
    await consume(subject, product, 2, 60); await consume(other, product, 2, 60);
    const before = await budget(subject, product);
    const paymentArgs = ["budget-fixture", eventId, hash("isolated payment"), transactionId, subject, product, "active", "2026-09-05T12:00:00Z"];
    await service("select public.planet_enqueue_verified_payment_retry($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as result", paymentArgs);
    await service("select public.planet_apply_verified_payment_event($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as result", paymentArgs);
    const auditBefore = await scalar("select to_jsonb(e)-'user_id' as result from public.planet_payment_events e where provider='budget-fixture' and event_id=$1", [eventId]);
    const receiptBefore = await scalar("select to_jsonb(r)-'user_id' as result from public.planet_purchase_receipts r where provider='budget-fixture' and transaction_id=$1", [transactionId]);
    expect(await scalar("select public.planet_reader_deletion_blockers($1::uuid) as result", [subject])).toEqual([]);
    const requestId = randomUUID(), deletionToken = randomUUID();
    await service("select public.planet_request_account_deletion($1::uuid,$2::uuid) as result", [subject, requestId]);
    expect(await service("select public.planet_claim_reader_deletion($1::uuid,$2::uuid,$3,60) as result", [requestId, deletionToken, "f".repeat(64)])).toEqual({ status: "claimed" });
    expect(await service("select public.planet_inspect_reader_deletion($1::uuid,$2::uuid,true) as result", [requestId, deletionToken])).toMatchObject({ phase: "auth-ready", subject, blockers: [], objects: [], objectCount: 0 });
    await expect(consume(subject, product, 2, 60)).rejects.toThrow("PLANET_READER_DELETION_FENCED");
    await expect(consume(subject, otherProduct, 2, 60)).rejects.toThrow("PLANET_READER_DELETION_FENCED");
    expect(await budget(subject, product)).toEqual(before);
    await database().query("delete from auth.users where id=$1::uuid", [subject]);
    expect(await service("select public.planet_finish_reader_deletion($1::uuid,$2::uuid,'completed',$3,array[]::text[]) as result", [requestId, deletionToken, hash("isolated deletion evidence")])).toMatchObject({ status: "completed" });
    expect(await budget(subject, product)).toBeUndefined(); expect(await budget(other, product)).toMatchObject({ user_id: other, used: 1 });
    expect(await scalar<number>("select count(*)::integer as result from public.planet_verified_payment_retries where user_id=$1::uuid", [subject])).toBe(0);
    expect(await scalar("select user_id as result from public.planet_payment_events where provider='budget-fixture' and event_id=$1", [eventId])).toBeNull();
    expect(await scalar("select user_id as result from public.planet_purchase_receipts where provider='budget-fixture' and transaction_id=$1", [transactionId])).toBeNull();
    expect(await scalar("select to_jsonb(e)-'user_id' as result from public.planet_payment_events e where provider='budget-fixture' and event_id=$1", [eventId])).toEqual(auditBefore);
    expect(await scalar("select to_jsonb(r)-'user_id' as result from public.planet_purchase_receipts r where provider='budget-fixture' and transaction_id=$1", [transactionId])).toEqual(receiptBefore);
  });
});
