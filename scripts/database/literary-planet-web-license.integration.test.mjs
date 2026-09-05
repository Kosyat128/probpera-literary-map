import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const migration = read("../../supabase/migrations/20260905_literary_planet_web_license.sql");
const fixture = read("./fixtures/literary-planet-web-license-contract.sql");
const paymentSql = "select public.planet_apply_verified_payment_event($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as result";
const product = "fixture-base";
const tables = ["planet_payment_events", "planet_purchase_receipts", "planet_access_state", "planet_deletion_requests"];
const signatures = [
  "planet_apply_verified_payment_event(text,text,text,text,uuid,text,text,timestamp with time zone)",
  "planet_get_web_access(uuid,text)", "planet_revoke_web_sessions(uuid)",
  "planet_request_account_deletion(uuid,uuid)", "planet_record_deletion_outcome(uuid,text,text,text[])",
  "planet_has_auth_session(uuid,uuid)", "planet_get_account_deletion_status(uuid)",
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
let db;

async function scalar(sql, parameters = []) {
  return (await db.query(sql, parameters)).rows[0]?.result;
}
async function asRole(role, userId, callback) {
  if (!["service_role", "authenticated", "anon"].includes(role)) throw Error("Unexpected fixture role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId || ""]);
  await db.exec(`set role ${role}`);
  try { return await callback(); }
  finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
async function user() {
  const id = randomUUID();
  await db.query("insert into auth.users(id) values ($1::uuid)", [id]);
  return id;
}
function payment(userId, overrides = {}) {
  const eventId = overrides.eventId || randomUUID();
  return {
    provider: "fixture-provider", eventId, hash: sha(eventId), transactionId: randomUUID(),
    userId, productId: product, status: "active", occurredAt: "2026-09-05T12:00:00Z", ...overrides,
  };
}
function apply(event) {
  return asRole("service_role", null, () => scalar(paymentSql, [event.provider, event.eventId,
    event.hash, event.transactionId, event.userId, event.productId, event.status, event.occurredAt]));
}
function access(userId, productId = product) {
  return asRole("service_role", null, () => scalar("select public.planet_get_web_access($1::uuid,$2) as result", [userId, productId]));
}
function requestDeletion(userId, requestId = randomUUID()) {
  return asRole("service_role", null, () => scalar("select public.planet_request_account_deletion($1::uuid,$2::uuid) as result", [userId, requestId]));
}
function deletionStatus(userId) {
  return asRole("service_role", null, () => scalar("select public.planet_get_account_deletion_status($1::uuid) as result", [userId]));
}
function deletionOutcome(requestId, status, evidence = sha("deletion-evidence"), blockers = []) {
  return asRole("service_role", null, () => scalar("select public.planet_record_deletion_outcome($1::uuid,$2,$3,$4::text[]) as result", [requestId, status, evidence, blockers]));
}

// Real PostgreSQL engine in an isolated in-memory PGlite instance. Its single
// connection proves SQL/ACL/RLS/rollback behavior, not concurrent lock contention.
describe.sequential("canonical Supabase Web license SQL foundation", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(fixture);
    await db.exec(migration);
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  it("starts unpaid and grants access only for the verified subject and product", async () => {
    const owner = await user();
    const other = await user();
    expect(await access(owner)).toEqual({ active: false, sessionEpoch: 0, accessBlocked: false, activeReceiptCount: 0 });
    expect(await apply(payment(owner))).toEqual({ duplicate: false, receiptApplied: true, receiptStatus: "active", sessionEpoch: 1 });
    expect(await access(owner)).toEqual({ active: true, sessionEpoch: 1, accessBlocked: false, activeReceiptCount: 1 });
    expect((await access(other)).active).toBe(false);
    expect((await access(owner, "fixture-other")).active).toBe(false);
  });
  it("recovers exact deletion state by canonical subject despite blocked access and no cookie", async () => {
    const owner = await user(), other = await user(), requestId = randomUUID();
    expect(await deletionStatus(owner)).toBeNull(); await requestDeletion(owner, requestId);
    expect(await deletionStatus(owner)).toEqual({ requestId, status: "requested" });
    expect((await access(owner)).accessBlocked).toBe(true); expect(await deletionStatus(other)).toBeNull();
    await deletionOutcome(requestId, "processing"); expect(await deletionStatus(owner)).toEqual({ requestId, status: "processing" });
    await deletionOutcome(requestId, "blocked", sha("fixture-policy-review"), ["policy-review"]);
    expect(await deletionStatus(owner)).toEqual({ requestId, status: "blocked" });
    await db.query("delete from auth.users where id=$1::uuid", [owner]); await deletionOutcome(requestId, "completed");
    expect(await deletionStatus(owner)).toBeNull();
    expect(await scalar("select status as result from public.planet_deletion_requests where request_id=$1::uuid", [requestId])).toBe("completed");
    expect(await deletionStatus(null)).toBeNull();
  });
  it("keeps deletion lookup server-only with no account-copy or paid-state mutation", async () => {
    const owner = await user();
    for (const role of ["anon", "authenticated"]) {
      await expect(asRole(role, owner, () => scalar("select public.planet_get_account_deletion_status($1::uuid) as result", [owner]))).rejects.toThrow(/permission denied/u);
    }
    const before = await access(owner); await deletionStatus(owner); expect(await access(owner)).toEqual(before);
    const functionInfo = (await db.query("select prosecdef,proconfig from pg_proc where oid='public.planet_get_account_deletion_status(uuid)'::regprocedure")).rows[0];
    expect(functionInfo.prosecdef).toBe(true); expect(functionInfo.proconfig).toContain('search_path=""');
  });

  it("makes exact event replay idempotent and rejects changed hash or mapped claims", async () => {
    const owner = await user(); const event = payment(owner);
    await apply(event);
    expect(await apply(event)).toEqual({ duplicate: true, receiptApplied: false, receiptStatus: "active", sessionEpoch: 1 });
    for (const patch of [{ hash: sha("different") }, { productId: "different" }, { status: "refunded" },
      { transactionId: randomUUID() }, { userId: await user() }, { occurredAt: "2026-09-05T12:00:01Z" }]) {
      await expect(apply({ ...event, ...patch })).rejects.toThrow("PLANET_EVENT_ID_CONFLICT");
    }
    expect(await scalar("select count(*)::int as result from public.planet_payment_events where user_id=$1::uuid", [owner])).toBe(1);
    expect((await access(owner)).sessionEpoch).toBe(1);
  });

  it("binds transactions to one subject and product and rolls back rejected events", async () => {
    const owner = await user(); const other = await user(); const first = payment(owner);
    await apply(first);
    for (const change of [{ userId: other }, { productId: "fixture-other" }]) {
      await expect(apply(payment(owner, { transactionId: first.transactionId, ...change }))).rejects.toThrow("PLANET_TRANSACTION_ID_CONFLICT");
    }
    expect(await scalar("select count(*)::int as result from public.planet_payment_events where transaction_id=$1", [first.transactionId])).toBe(1);
    expect(await scalar("select count(*)::int as result from public.planet_access_state where user_id=$1::uuid", [other])).toBe(0);
  });

  it.each(["refunded", "revoked"])("keeps %s terminal despite older or newer active events", async (status) => {
    const owner = await user(); const first = payment(owner);
    await apply(first);
    expect((await apply(payment(owner, { transactionId: first.transactionId, status, occurredAt: "2026-09-04T12:00:00Z" }))).receiptStatus).toBe(status);
    for (const occurredAt of ["2026-09-01T12:00:00Z", "2026-09-06T12:00:00Z"]) {
      expect(await apply(payment(owner, { transactionId: first.transactionId, occurredAt })))
        .toEqual({ duplicate: false, receiptApplied: false, receiptStatus: status, sessionEpoch: 2 });
    }
    expect((await access(owner)).active).toBe(false);
    expect(await scalar("select count(*)::int as result from public.planet_payment_events where user_id=$1::uuid", [owner])).toBe(4);
  });

  it("records a terminal event arriving before the active event without enabling access", async () => {
    const owner = await user(); const event = payment(owner, { status: "refunded" });
    await apply(event);
    expect((await apply(payment(owner, { transactionId: event.transactionId }))).receiptApplied).toBe(false);
    expect((await access(owner)).active).toBe(false);
  });

  it("ignores an older active update and computes access from every surviving receipt", async () => {
    const owner = await user(); const first = payment(owner);
    await apply(first); await apply(payment(owner));
    expect((await apply(payment(owner, { transactionId: first.transactionId, occurredAt: "2026-09-01T00:00:00Z" }))).receiptApplied).toBe(false);
    await apply(payment(owner, { transactionId: first.transactionId, status: "refunded" }));
    expect(await access(owner)).toEqual({ active: true, sessionEpoch: 3, accessBlocked: false, activeReceiptCount: 1 });
  });

  it("revokes online sessions without inventing a refund or removing purchase receipts", async () => {
    const owner = await user(); await apply(payment(owner));
    expect(await asRole("service_role", null, () => scalar("select public.planet_revoke_web_sessions($1::uuid) as result", [owner])))
      .toEqual({ sessionEpoch: 2 });
    expect(await access(owner)).toEqual({ active: true, sessionEpoch: 2, accessBlocked: false, activeReceiptCount: 1 });
  });

  it("checks a live canonical auth session with matching subject and notices its removal", async () => {
    const owner = await user(); const other = await user(); const sessionId = randomUUID();
    await db.query("insert into auth.sessions(id,user_id) values ($1::uuid,$2::uuid)", [sessionId, owner]);
    const check = (subject, session) => asRole("service_role", null, () => scalar("select public.planet_has_auth_session($1::uuid,$2::uuid) as result", [subject, session]));
    expect(await check(owner, sessionId)).toBe(true);
    expect(await check(other, sessionId)).toBe(false);
    expect(await check(owner, randomUUID())).toBe(false);
    expect(await check(null, sessionId)).toBe(false);
    await db.query("delete from auth.sessions where id=$1::uuid", [sessionId]);
    expect(await check(owner, sessionId)).toBe(false);
  });

  it("acknowledges deletion once, blocks new access and leaves canonical account and staff records intact", async () => {
    const owner = await user(); await apply(payment(owner));
    await db.query("insert into public.staff_memberships(user_id,role) values ($1::uuid,'owner')", [owner]);
    const requestId = randomUUID();
    expect(await requestDeletion(owner, requestId)).toEqual({ requestId, status: "requested", sessionEpoch: 2 });
    expect(await requestDeletion(owner, requestId)).toEqual({ requestId, status: "requested", sessionEpoch: 2 });
    expect((await requestDeletion(owner)).requestId).toBe(requestId);
    await apply(payment(owner));
    expect(await access(owner)).toEqual({ active: false, accessBlocked: true, activeReceiptCount: 2, sessionEpoch: 3 });
    expect(await scalar("select count(*)::int as result from auth.users where id=$1::uuid", [owner])).toBe(1);
    expect(await scalar("select role as result from public.staff_memberships where user_id=$1::uuid", [owner])).toBe("owner");
    await expect(deletionOutcome(requestId, "completed")).rejects.toThrow("PLANET_DELETION_NOT_COMPLETED");
    await expect(requestDeletion(await user(), requestId)).rejects.toThrow("PLANET_DELETION_REQUEST_ID_CONFLICT");
    expect(await deletionOutcome(requestId, "blocked", sha("staff-check"), ["staff-owner-review-required"]))
      .toEqual({ requestId, status: "blocked" });
  });

  it("preserves existing comment and editorial FK deletion blockers", async () => {
    const owner = await user(); const requestId = randomUUID();
    await db.query("insert into public.profiles(id) values ($1::uuid)", [owner]);
    await db.query("insert into public.article_comments(id,author_id) values ($1::uuid,$2::uuid)", [randomUUID(), owner]);
    await requestDeletion(owner, requestId);
    await expect(db.query("delete from auth.users where id=$1::uuid", [owner])).rejects.toThrow(/check constraint/u);
    const editor = await user();
    await db.query("insert into public.editorial_reference_fixture(id,created_by) values ($1::uuid,$2::uuid)", [randomUUID(), editor]);
    await requestDeletion(editor);
    await expect(db.query("delete from auth.users where id=$1::uuid", [editor])).rejects.toThrow(/foreign key constraint/u);
    expect(await scalar("select status as result from public.planet_deletion_requests where request_id=$1::uuid", [requestId])).toBe("requested");
  });

  it("allows evidence-bound completion only after external account removal and never rebinds retained receipts", async () => {
    const owner = await user(); const first = payment(owner); await apply(first);
    const requestId = randomUUID(); await requestDeletion(owner, requestId);
    await deletionOutcome(requestId, "processing");
    // Test-fixture superuser stands in for a separately authorized deletion worker.
    await db.query("delete from auth.users where id=$1::uuid", [owner]);
    for (const table of ["planet_payment_events", "planet_purchase_receipts", "planet_deletion_requests"]) {
      expect(await scalar(`select count(*)::int as result from public.${table} where user_id=$1::uuid`, [owner])).toBe(0);
    }
    expect(await scalar("select count(*)::int as result from public.planet_access_state where user_id=$1::uuid", [owner])).toBe(0);
    expect(await deletionOutcome(requestId, "completed")).toEqual({ requestId, status: "completed" });
    expect(await deletionOutcome(requestId, "completed")).toEqual({ requestId, status: "completed" });
    await expect(deletionOutcome(requestId, "completed", sha("changed-proof"))).rejects.toThrow("PLANET_DELETION_OUTCOME_CONFLICT");
    await expect(deletionOutcome(requestId, "processing")).rejects.toThrow("PLANET_DELETION_OUTCOME_CONFLICT");
    expect((await apply(first)).duplicate).toBe(true);
    await expect(apply(payment(await user(), { transactionId: first.transactionId }))).rejects.toThrow("PLANET_TRANSACTION_SUBJECT_REMOVED");
    await expect(access(owner)).rejects.toThrow("PLANET_SUBJECT_NOT_FOUND");
  });

  it("enforces own-subject RLS on every ledger view, including an empty/missing JWT subject", async () => {
    const owner = await user(); const other = await user();
    await apply(payment(owner)); await requestDeletion(owner);
    await apply(payment(other)); await requestDeletion(other);
    for (const table of tables) {
      expect(await asRole("authenticated", owner, () => scalar(`select count(*)::int as result from public.${table}`))).toBe(1);
      expect(await asRole("authenticated", owner, () => scalar(`select count(*)::int as result from public.${table} where user_id=$1::uuid`, [other]))).toBe(0);
      expect(await asRole("authenticated", null, () => scalar(`select count(*)::int as result from public.${table}`))).toBe(0);
      await expect(asRole("anon", null, () => db.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/u);
    }
  });

  it("denies direct application-role writes and all non-server RPC execution", async () => {
    const owner = await user(); const event = payment(owner); await apply(event);
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const table of tables) {
        await expect(asRole(role, owner, () => db.query(`delete from public.${table} where user_id=$1::uuid`, [owner]))).rejects.toThrow(/permission denied/u);
        expect(await scalar("select has_table_privilege($1,$2,'INSERT,UPDATE,DELETE') as result", [role, `public.${table}`])).toBe(false);
      }
    }
    for (const signature of signatures) {
      for (const role of ["anon", "authenticated"]) {
        expect(await scalar("select has_function_privilege($1,$2,'EXECUTE') as result", [role, `public.${signature}`])).toBe(false);
      }
      expect(await scalar("select has_function_privilege('service_role',$1,'EXECUTE') as result", [`public.${signature}`])).toBe(true);
    }
    await expect(asRole("authenticated", owner, () => scalar(paymentSql, [event.provider, randomUUID(), event.hash, event.transactionId, owner, product, "active", event.occurredAt])))
      .rejects.toThrow(/permission denied for function/u);
    await expect(asRole("authenticated", owner, () => scalar("select public.planet_has_auth_session($1::uuid,$2::uuid) as result", [owner, randomUUID()])))
      .rejects.toThrow(/permission denied for function/u);
    await expect(asRole("authenticated", owner, () => db.query("select * from auth.sessions"))).rejects.toThrow(/permission denied/u);
  });

  it("rejects malformed events and impossible timestamps without recording partial state", async () => {
    const owner = await user(); const valid = payment(owner);
    for (const patch of [{ provider: "" }, { eventId: "bad\n" }, { hash: "0" }, { transactionId: "" },
      { userId: null }, { productId: "" }, { status: "paid" }, { occurredAt: "infinity" }, { occurredAt: null }]) {
      await expect(apply({ ...valid, ...patch })).rejects.toThrow("PLANET_INVALID_PAYMENT_EVENT");
    }
    await expect(apply(payment(randomUUID()))).rejects.toThrow("PLANET_SUBJECT_NOT_FOUND");
    expect(await scalar("select count(*)::int as result from public.planet_access_state where user_id=$1::uuid", [owner])).toBe(0);
    expect(await scalar("select count(*)::int as result from public.planet_payment_events where user_id=$1::uuid", [owner])).toBe(0);
  });

  it("rejects unbounded or contradictory deletion evidence instead of accepting a completion claim", async () => {
    const owner = await user(); const requestId = randomUUID(); await requestDeletion(owner, requestId);
    for (const [status, evidence, blockers] of [["completed", null, []], ["blocked", sha("x"), []],
      ["blocked", sha("x"), ["invalid code"]], ["blocked", sha("x"), [null]],
      ["blocked", sha("x"), Array(17).fill("blocked")], ["processing", sha("x"), ["blocked"]]]) {
      await expect(deletionOutcome(requestId, status, evidence, blockers)).rejects.toThrow("PLANET_INVALID_DELETION_OUTCOME");
    }
  });

  it("rolls back both receipt and event if the session epoch cannot advance safely", async () => {
    const owner = await user(); await apply(payment(owner));
    await db.query("update public.planet_access_state set session_epoch=9007199254740991 where user_id=$1::uuid", [owner]);
    const event = payment(owner);
    await expect(apply(event)).rejects.toThrow(/check constraint/u);
    expect(await scalar("select count(*)::int as result from public.planet_purchase_receipts where transaction_id=$1", [event.transactionId])).toBe(0);
    expect(await scalar("select count(*)::int as result from public.planet_payment_events where event_id=$1", [event.eventId])).toBe(0);
  });

  it("reapplies the migration without losing receipts, identity, RLS or RPC permissions", async () => {
    const owner = await user(); await apply(payment(owner));
    const before = await access(owner);
    await db.exec(migration);
    expect(await access(owner)).toEqual(before);
    expect(await scalar("select count(*)::int as result from pg_class where relname = any($1::text[]) and relrowsecurity and relforcerowsecurity", [tables])).toBe(4);
    expect(await scalar("select count(*)::int as result from auth.users where id=$1::uuid", [owner])).toBe(1);
    expect(await scalar("select has_function_privilege('authenticated','public.planet_get_web_access(uuid,text)','EXECUTE') as result")).toBe(false);
  });
});
