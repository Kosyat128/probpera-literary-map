import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { createPaymentRetryTestDatabase } from "./fixtures/literary-planet-payment-retry-context.mjs";

let db;
const hash = text => createHash("sha256").update(text).digest("hex");
const provider = "retry-fixture";
const product = "fixture-base";
async function scalar(sql, parameters = []) { return (await db.query(sql, parameters)).rows[0]?.result; }

// Every role operation has a savepoint. A deliberately rejected SQL statement
// is rolled back before RESET ROLE, so later assertions use a live transaction.
async function asRole(role, work) {
  if (!["anon", "authenticated", "service_role"].includes(role)) throw Error("Unexpected local role");
  await db.exec("savepoint role_operation");
  try {
    await db.exec("set role " + role);
    return await work();
  } catch (error) {
    await db.exec("rollback to savepoint role_operation");
    throw error;
  } finally {
    await db.exec("reset role");
    await db.exec("release savepoint role_operation");
  }
}
const service = (sql, parameters = []) => asRole("service_role", () => scalar(sql, parameters));
async function reader() {
  const subject = randomUUID();
  await db.query("insert into auth.users(id) values($1::uuid)", [subject]);
  await db.query("insert into public.profiles(id,display_name,role) values($1::uuid,'Retry fixture reader','reader')", [subject]);
  return subject;
}
function event(subject, patch = {}) {
  return { provider, eventId: randomUUID(), payloadSha256: hash(randomUUID()), transactionId: randomUUID(),
    subject, product, paymentStatus: "active", occurredAt: "2026-09-05T12:00:00.000Z", ...patch };
}
const eventArgs = job => [job.provider, job.eventId, job.payloadSha256, job.transactionId,
  job.subject, job.product, job.paymentStatus, job.occurredAt];
const enqueue = job => service("select public.planet_enqueue_verified_payment_retry($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as result", eventArgs(job));
const apply = job => service("select public.planet_apply_verified_payment_event($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as result", eventArgs(job));
const claim = (token = randomUUID()) => service("select public.planet_claim_verified_payment_retry($1::uuid,60) as result", [token]);
const finish = job => service("select public.planet_finish_verified_payment_retry($1,$2,$3::uuid) as result", [job.provider, job.eventId, job.leaseToken]);
const reschedule = (job, code = "payment-apply-unavailable", seconds = 60) => service(
  "select public.planet_reschedule_verified_payment_retry($1,$2,$3::uuid,$4,$5::integer) as result",
  [job.provider, job.eventId, job.leaseToken, code, seconds]);
const stored = job => scalar("select to_jsonb(q) as result from public.planet_verified_payment_retries q where provider=$1 and event_id=$2", [job.provider, job.eventId]);
const eventCount = () => scalar("select count(*)::integer as result from public.planet_payment_events");
const access = subject => service("select public.planet_get_web_access($1::uuid,$2) as result", [subject, product]);
async function expire(job) {
  // Advance only this fixture's stored deadline, without wall-clock sleeps.
  await db.query("update public.planet_verified_payment_retries set lease_until=statement_timestamp()-interval '1 second',next_attempt_at=statement_timestamp()-interval '1 second' where provider=$1 and event_id=$2", [job.provider, job.eventId]);
}
function expectOriginal(job, original) {
  expect(job).toMatchObject({ status: "claimed", provider: original.provider, eventId: original.eventId,
    payloadSha256: original.payloadSha256, transactionId: original.transactionId,
    subject: original.subject, product: original.product, paymentStatus: original.paymentStatus });
  expect(job.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u);
  expect(Date.parse(job.occurredAt)).toBe(Date.parse(original.occurredAt));
  expect(job.leaseUntil).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u);
}

// Real canonical SQL in one local PGlite connection. These tests establish
// rollback, lease ownership, access semantics and guarded deletion integration;
// they do not establish multi-connection SKIP LOCKED contention or live services.
describe.sequential("durable verified-payment retry on canonical SQL", () => {
  // Rebuild each isolated database so the lost-ack case can really COMMIT;
  // savepoints still recover deliberately rejected statements within each case.
  beforeEach(async () => { db = await createPaymentRetryTestDatabase(); await db.exec("begin"); }, 60_000);
  afterEach(async () => {
    if (!db) return;
    try { await db.exec("rollback"); }
    finally { await db.close(); db = undefined; }
  });

  it("keeps verified fields immutable, rejects conflicting replay and requires applied ledger proof", async () => {
    const original = event(await reader()), other = await reader();
    expect(await enqueue(original)).toEqual({ status: "queued", jobState: "pending" });
    expect(await enqueue(original)).toEqual({ status: "duplicate", jobState: "pending" });
    const before = await stored(original);
    for (const patch of [{ payloadSha256: hash("changed") }, { subject: other }, { product: "another-product" }]) {
      await expect(enqueue({ ...original, ...patch })).rejects.toThrow("PLANET_PAYMENT_RETRY_EVENT_CONFLICT");
    }
    expect(await stored(original)).toEqual(before);
    for (const role of ["anon", "authenticated"]) {
      await expect(asRole(role, () => scalar("select public.planet_enqueue_verified_payment_retry($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as result", eventArgs(original)))).rejects.toThrow(/permission denied/u);
      await expect(asRole(role, () => scalar("select public.planet_claim_verified_payment_retry($1::uuid,60) as result", [randomUUID()]))).rejects.toThrow(/permission denied/u);
      await expect(asRole(role, () => db.query("select * from public.planet_verified_payment_retries"))).rejects.toThrow(/permission denied/u);
    }
    await expect(asRole("service_role", () => db.query("update public.planet_verified_payment_retries set payload_sha256=$1 where provider=$2 and event_id=$3", [hash("forbidden"), original.provider, original.eventId]))).rejects.toThrow(/permission denied/u);
    const leased = await claim(); expectOriginal(leased, original);
    await expect(finish(leased)).rejects.toThrow("PLANET_PAYMENT_RETRY_APPLY_UNPROVEN");
    expect((await stored(original)).state).toBe("leased");
    expect(await eventCount()).toBe(0);
    expect(await scalar("select count(*)::integer as result from public.planet_purchase_receipts")).toBe(0);
  });

  it("retains work after actual ledger rollback and fences expired or replaced worker leases", async () => {
    const subject = await reader(), original = event(subject);
    // The existing safe-integer epoch CHECK causes a real authoritative apply
    // failure after receipt work starts, without replacing any product function.
    await db.query("insert into public.planet_access_state(user_id,session_epoch) values($1::uuid,9007199254740991)", [subject]);
    await enqueue(original); const first = await claim(); expectOriginal(first, original);
    await expect(apply(first)).rejects.toThrow(/check constraint/u);
    expect(await eventCount()).toBe(0);
    expect(await scalar("select count(*)::integer as result from public.planet_purchase_receipts")).toBe(0);
    const scheduled = await reschedule(first);
    expect(scheduled.status).toBe("pending");
    expect(scheduled.nextAttemptAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u);
    expect((await stored(original)).last_failure_code).toBe("payment-apply-unavailable");
    expect(await claim()).toEqual({ status: "empty" });
    await db.query("update public.planet_verified_payment_retries set next_attempt_at=statement_timestamp()-interval '1 second' where provider=$1 and event_id=$2", [original.provider, original.eventId]);
    const second = await claim(); expectOriginal(second, original); expect(second.attempts).toBe(2);
    await expire(second);
    await expect(finish(second)).rejects.toThrow("PLANET_PAYMENT_RETRY_LEASE_INVALID");
    await expect(reschedule(second)).rejects.toThrow("PLANET_PAYMENT_RETRY_LEASE_INVALID");
    expect(await claim(second.leaseToken)).toEqual({ status: "empty" });
    const replacement = await claim(); expectOriginal(replacement, original); expect(replacement.attempts).toBe(3);
    await expect(finish(second)).rejects.toThrow("PLANET_PAYMENT_RETRY_LEASE_INVALID");
    await expect(reschedule(second)).rejects.toThrow("PLANET_PAYMENT_RETRY_LEASE_INVALID");
    expect((await stored(original)).lease_token).toBe(replacement.leaseToken);
    // Restore only controlled fixture data and retry the identical retained job.
    await db.query("update public.planet_access_state set session_epoch=0 where user_id=$1::uuid", [subject]);
    expect(await apply(replacement)).toEqual({ duplicate: false, receiptApplied: true, receiptStatus: "active", sessionEpoch: 1 });
    expect(await finish(replacement)).toEqual({ status: "completed" });
    expect(await eventCount()).toBe(1); expect((await access(subject)).sessionEpoch).toBe(1);
  });

  it("replays a committed event after lost acknowledgement without duplicating grants or reviving refund", async () => {
    const subject = await reader(), original = event(subject);
    await enqueue(original); const first = await claim();
    expect(await apply(first)).toEqual({ duplicate: false, receiptApplied: true, receiptStatus: "active", sessionEpoch: 1 });
    await db.exec("commit"); await db.exec("begin");
    // The real ledger transaction committed before its caller finished the job.
    expect((await stored(original)).state).toBe("leased"); await expire(first);
    const retry = await claim(); expectOriginal(retry, original);
    expect(await apply(retry)).toEqual({ duplicate: true, receiptApplied: false, receiptStatus: "active", sessionEpoch: 1 });
    expect(await finish(retry)).toEqual({ status: "completed" });
    await db.exec("commit"); await db.exec("begin");
    // Completion may also commit before its response is observed. Repeated
    // completion cannot mutate the terminal job or schedule another grant.
    await expect(finish(retry)).rejects.toThrow("PLANET_PAYMENT_RETRY_LEASE_INVALID");
    expect(await enqueue(original)).toEqual({ status: "duplicate", jobState: "completed" });
    expect(await claim()).toEqual({ status: "empty" });
    expect(await eventCount()).toBe(1); expect((await access(subject)).sessionEpoch).toBe(1);
    const refund = event(subject, { transactionId: original.transactionId, paymentStatus: "refunded", occurredAt: "2026-09-04T12:00:00.000Z" });
    await enqueue(refund); const refundJob = await claim();
    expect(await apply(refundJob)).toEqual({ duplicate: false, receiptApplied: true, receiptStatus: "refunded", sessionEpoch: 2 });
    await finish(refundJob);
    const laterActive = event(subject, { transactionId: original.transactionId, occurredAt: "2026-09-06T12:00:00.000Z" });
    await enqueue(laterActive); const activeJob = await claim();
    expect(await apply(activeJob)).toEqual({ duplicate: false, receiptApplied: false, receiptStatus: "refunded", sessionEpoch: 2 });
    expect(await finish(activeJob)).toEqual({ status: "completed" });
    expect(await access(subject)).toEqual({ active: false, sessionEpoch: 2, accessBlocked: false, activeReceiptCount: 0 });
    expect(await eventCount()).toBe(3);
    expect(await scalar("select status as result from public.planet_purchase_receipts where provider=$1 and transaction_id=$2", [original.provider, original.transactionId])).toBe("refunded");
  });

  it("keeps real deletion preflight valid, fences queue mutations and cascades jobs while unlinking financial audit", async () => {
    const subject = await reader(), other = await reader(), paid = event(subject);
    await enqueue(paid); const leased = await claim(); await apply(leased);
    const pending = event(subject); await enqueue(pending);
    const untouched = event(other); await enqueue(untouched);
    await db.query("update public.planet_verified_payment_retries set next_attempt_at=statement_timestamp()+interval '1 day' where provider=$1 and event_id=$2", [untouched.provider, untouched.eventId]);
    const auditBefore = await scalar("select to_jsonb(e)-'user_id' as result from public.planet_payment_events e where provider=$1 and event_id=$2", [paid.provider, paid.eventId]);
    const receiptBefore = await scalar("select to_jsonb(r)-'user_id' as result from public.planet_purchase_receipts r where provider=$1 and transaction_id=$2", [paid.provider, paid.transactionId]);
    expect(await scalar("select public.planet_reader_deletion_blockers($1::uuid) as result", [subject])).toEqual([]);
    const requestId = randomUUID(), deletionToken = randomUUID();
    await service("select public.planet_request_account_deletion($1::uuid,$2::uuid) as result", [subject, requestId]);
    expect(await service("select public.planet_claim_reader_deletion($1::uuid,$2::uuid,$3,60) as result", [requestId, deletionToken, "f".repeat(64)])).toEqual({ status: "claimed" });
    // The actual inspected preflight arms processor_started_at and the fence;
    // a deletion lease by itself does not substitute for that canonical step.
    const prepared = await service("select public.planet_inspect_reader_deletion($1::uuid,$2::uuid,true) as result", [requestId, deletionToken]);
    expect(prepared).toMatchObject({ phase: "auth-ready", subject, blockers: [], objects: [], objectCount: 0 });
    await expect(enqueue(event(subject))).rejects.toThrow("PLANET_READER_DELETION_FENCED");
    await expect(claim()).rejects.toThrow("PLANET_READER_DELETION_FENCED");
    await expect(reschedule(leased)).rejects.toThrow("PLANET_READER_DELETION_FENCED");
    await expect(finish(leased)).rejects.toThrow("PLANET_READER_DELETION_FENCED");
    expect((await stored(pending)).state).toBe("pending"); expect((await stored(paid)).state).toBe("leased");
    await db.query("delete from auth.users where id=$1::uuid", [subject]);
    expect(await service("select public.planet_finish_reader_deletion($1::uuid,$2::uuid,'completed',$3,array[]::text[]) as result", [requestId, deletionToken, hash("isolated deletion evidence")])).toMatchObject({ status: "completed" });
    expect(await scalar("select exists(select 1 from auth.users where id=$1::uuid) as result", [subject])).toBe(false);
    expect(await stored(paid)).toBeUndefined(); expect(await stored(pending)).toBeUndefined();
    expect((await stored(untouched)).user_id).toBe(other);
    expect(await scalar("select user_id as result from public.planet_payment_events where provider=$1 and event_id=$2", [paid.provider, paid.eventId])).toBeNull();
    expect(await scalar("select user_id as result from public.planet_purchase_receipts where provider=$1 and transaction_id=$2", [paid.provider, paid.transactionId])).toBeNull();
    expect(await scalar("select to_jsonb(e)-'user_id' as result from public.planet_payment_events e where provider=$1 and event_id=$2", [paid.provider, paid.eventId])).toEqual(auditBefore);
    expect(await scalar("select to_jsonb(r)-'user_id' as result from public.planet_purchase_receipts r where provider=$1 and transaction_id=$2", [paid.provider, paid.transactionId])).toEqual(receiptBefore);
    expect(await scalar("select to_jsonb(r) as result from public.planet_deletion_requests r where request_id=$1::uuid", [requestId])).toMatchObject({ user_id: null, status: "completed", processor_phase: "auth-deleted" });
  });
});
