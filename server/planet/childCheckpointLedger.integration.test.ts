import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { createPaymentRetryTestDatabase, SETUP_INPUT_PATHS } from "../../scripts/database/fixtures/literary-planet-payment-retry-context.mjs";

const migrationPaths = [
  "supabase/migrations/20261001194458_planet_license_rate_limits.sql",
  "supabase/migrations/20261002172514_planet_yookassa_sandbox_orders.sql",
  "supabase/migrations/20261002173942_planet_reader_live_session_fence.sql",
  "supabase/migrations/20261003203842_planet_child_checkpoint_ledger.sql",
] as const;
export const CHILD_CHECKPOINT_SETUP_INPUT_PATHS = Object.freeze([...SETUP_INPUT_PATHS, ...migrationPaths]);
const migrations = migrationPaths.map(path => readFileSync(new URL("../../" + path, import.meta.url), "utf8"));
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const captureSql = "select public.planet_capture_child_checkpoint($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::bigint,$6::bigint,$7,$8,$9,$10,$11::integer) as result";
const advanceSql = "select public.planet_advance_child_checkpoint($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::bigint,$6::bigint,$7,$8,$9,$10) as result";
interface Binding {
  installation: string; epoch: string; subject: string; session: string; sessionEpoch: number;
  revision: number; record: string; operation: string; context: string; next: string;
}
interface Receipt {
  installation_id: string; authority_epoch: string; guardian_subject: string; guardian_session_id: string;
  guardian_session_epoch: number; revision: number; record_sha256: string; operation_sha256: string;
  context_sha256: string; next_record_sha256: string; captured_server_ms: number;
  server_time_ms: number; completed_server_ms: number; expires_at_ms: number;
}
let db: PGlite | undefined;
function database(): PGlite { if (!db) throw Error("Missing isolated checkpoint database"); return db; }
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
const args = (binding: Binding) => [binding.installation, binding.epoch, binding.subject, binding.session, binding.sessionEpoch,
  binding.revision, binding.record, binding.operation, binding.context, binding.next];
async function capture(binding: Binding, timeout = 60000): Promise<Receipt> {
  const receipt = await service<Receipt>(captureSql, [...args(binding), timeout]);
  if (!receipt) throw Error("Missing exact capture receipt"); return receipt;
}
async function advance(binding: Binding): Promise<Receipt> {
  const receipt = await service<Receipt>(advanceSql, args(binding));
  if (!receipt) throw Error("Missing exact advance receipt"); return receipt;
}
const checkpoint = (binding: Binding) => scalar<Record<string, unknown>>(
  "select to_jsonb(c) as result from public.planet_child_checkpoints c where installation_id=$1::uuid", [binding.installation]);
const operation = (binding: Binding) => scalar<Record<string, unknown>>(
  "select to_jsonb(o) as result from public.planet_child_checkpoint_operations o where installation_id=$1::uuid and authority_epoch=$2::uuid and operation_sha256=$3",
  [binding.installation, binding.epoch, binding.operation]);
// Test-only owner inspection of the private classifier; production calls it
// through the existing service-authorized deletion processor RPCs below.
const blockers = (subject: string) => scalar<string[]>("select public.planet_reader_deletion_blockers($1::uuid) as result", [subject]);
async function provisionFixture(): Promise<Binding> {
  const binding: Binding = { installation: randomUUID(), epoch: randomUUID(), subject: randomUUID(), session: randomUUID(), sessionEpoch: 0,
    revision: 0, record: hash("initial " + randomUUID()), operation: hash("original " + randomUUID()), context: hash("context " + randomUUID()), next: hash("next " + randomUUID()) };
  await database().query("insert into auth.users(id) values($1::uuid)", [binding.subject]);
  await database().query("insert into public.profiles(id,display_name,role) values($1::uuid,'Private checkpoint fixture','reader')", [binding.subject]);
  await database().query("insert into auth.sessions(id,user_id) values($1::uuid,$2::uuid)", [binding.session, binding.subject]);
  // Test-only superuser provisioning. The production service has no INSERT,
  // identity-update, reset or installation/epoch enrolment privilege/API.
  await database().query("insert into public.planet_child_checkpoints(installation_id,authority_epoch,user_id,revision,record_sha256,last_server_at) values($1::uuid,$2::uuid,$3::uuid,0,$4,clock_timestamp())",
    [binding.installation, binding.epoch, binding.subject, binding.record]);
  return binding;
}
function expectReceipt(receipt: Receipt, binding: Binding, revision: number, record: string) {
  expect(Object.keys(receipt).sort()).toEqual(["authority_epoch", "captured_server_ms", "completed_server_ms", "context_sha256", "expires_at_ms", "guardian_session_epoch", "guardian_session_id", "guardian_subject", "installation_id", "next_record_sha256", "operation_sha256", "record_sha256", "revision", "server_time_ms"]);
  expect(receipt).toMatchObject({ installation_id: binding.installation, authority_epoch: binding.epoch, guardian_subject: binding.subject,
    guardian_session_id: binding.session, guardian_session_epoch: binding.sessionEpoch, revision, record_sha256: record,
    operation_sha256: binding.operation, context_sha256: binding.context, next_record_sha256: binding.next });
  for (const time of [receipt.captured_server_ms, receipt.server_time_ms, receipt.completed_server_ms, receipt.expires_at_ms]) expect(Number.isSafeInteger(time)).toBe(true);
  expect(receipt.server_time_ms).toBeGreaterThanOrEqual(receipt.captured_server_ms);
  expect(receipt.completed_server_ms).toBeGreaterThanOrEqual(receipt.server_time_ms);
  expect(receipt.completed_server_ms).toBeLessThan(receipt.expires_at_ms);
}

// Actual canonical migrations/roles/constraints execute in one local PGlite
// connection. This proves SQL transactions and receipt/expiry/ACL contracts,
// not live Supabase Auth, simultaneous connections, signed/native authority,
// system time provenance, provisioning, recovery proof or device acceptance.
describe.sequential("private canonical child checkpoint ledger", () => {
  beforeAll(async () => {
    db = await createPaymentRetryTestDatabase();
    // Exact Auth-session expiry field from canonical Supabase; other private
    // fields make accidental broad server read grants observable in the fixture.
    await database().exec("alter table auth.sessions add column not_after timestamptz, add column private_fixture_secret text");
    for (const migration of migrations) await database().exec(migration);
  }, 60000);
  beforeEach(async () => { await database().exec("begin"); });
  afterEach(async () => { await database().exec("rollback"); });
  afterAll(async () => { if (db) { await db.close(); db = undefined; } });

  it("captures an exact current tuple and commits one next revision with durable operation replay refusal", async () => {
    const binding = await provisionFixture(), captured = await capture(binding);
    expectReceipt(captured, binding, 0, binding.record);
    expect(captured.expires_at_ms - captured.captured_server_ms).toBe(60000);
    expect(await checkpoint(binding)).toMatchObject({ user_id: binding.subject, revision: 0, record_sha256: binding.record });
    const advanced = await advance(binding);
    expectReceipt(advanced, binding, 1, binding.next);
    expect(advanced.expires_at_ms).toBe(captured.expires_at_ms);
    expect(advanced.captured_server_ms).toBe(captured.captured_server_ms);
    expect(await operation(binding)).toMatchObject({ consumed_server_ms: advanced.server_time_ms });
    // Commit the actual SQL mutation, discard its result, and retry the exact
    // original operation: uncertain delivery must not produce another success.
    await database().exec("commit"); await database().exec("begin");
    await expect(advance(binding)).rejects.toThrow("PLANET_CHILD_OPERATION_REPLAYED");
    const next = { ...binding, revision: 1, record: binding.next, operation: hash("second original"), next: hash("second record") };
    await expect(capture({ ...next, operation: binding.operation })).rejects.toThrow("PLANET_CHILD_OPERATION_REPLAYED");
    expectReceipt(await capture(next), next, 1, next.record);
    expectReceipt(await advance(next), next, 2, next.next);
    expect(await checkpoint(binding)).toMatchObject({ revision: 2, record_sha256: next.next });
  });

  it("denies every null coordinate, malformed digest/counter/timeout and typed malformed identity without creating fallback state", async () => {
    const binding = await provisionFixture(), before = await checkpoint(binding), original = args(binding);
    for (let index = 0; index < 11; index++) {
      const invalid: unknown[] = [...original, 60000]; invalid[index] = null;
      await expect(service(captureSql, invalid)).rejects.toThrow("PLANET_INVALID_CHILD_CHECKPOINT_CONTEXT");
    }
    for (let index = 0; index < 10; index++) {
      const invalid: unknown[] = [...original]; invalid[index] = null;
      await expect(service(advanceSql, invalid)).rejects.toThrow("PLANET_INVALID_CHILD_CHECKPOINT_CONTEXT");
    }
    for (const [index, value] of [[4, -1], [4, 9007199254740991], [5, -1], [5, 9007199254740990],
      [6, "A".repeat(64)], [7, "0".repeat(63)], [8, "{\"plainRecord\":true}"], [9, binding.record], [10, 0], [10, 60001]] as const) {
      const invalid: unknown[] = [...original, 60000]; invalid[index] = value;
      await expect(service(captureSql, invalid)).rejects.toThrow("PLANET_INVALID_CHILD_CHECKPOINT_CONTEXT");
    }
    await expect(service(captureSql, ["bundle.identifier", ...original.slice(1), 60000])).rejects.toThrow(/invalid input syntax for type uuid/u);
    expect(await checkpoint(binding)).toEqual(before); expect(await operation(binding)).toBeUndefined();
  });

  it("requires explicit installation, current epoch and bound owner, rejecting stale full-record coordinates", async () => {
    const binding = await provisionFixture(), other = await provisionFixture(), before = await checkpoint(binding);
    for (const mismatch of [{ installation: randomUUID() }, { epoch: randomUUID() }, { subject: other.subject, session: other.session }]) {
      await expect(capture({ ...binding, ...mismatch })).rejects.toThrow("PLANET_CHILD_CHECKPOINT_NOT_PROVISIONED");
      await expect(advance({ ...binding, ...mismatch })).rejects.toThrow("PLANET_CHILD_CHECKPOINT_NOT_PROVISIONED");
    }
    await expect(capture({ ...binding, subject: randomUUID() })).rejects.toThrow("PLANET_SUBJECT_NOT_FOUND");
    await expect(capture({ ...binding, revision: 1 })).rejects.toThrow("PLANET_CHILD_CHECKPOINT_STALE");
    await expect(capture({ ...binding, record: hash("partial or stale record") })).rejects.toThrow("PLANET_CHILD_CHECKPOINT_STALE");
    expect(await checkpoint(binding)).toEqual(before); expect(await operation(binding)).toBeUndefined();
  });

  it("binds original context, next full digest, expected record, session and revision without consuming a changed request", async () => {
    const binding = await provisionFixture(), secondSession = randomUUID(); await capture(binding);
    await database().query("insert into auth.sessions(id,user_id) values($1::uuid,$2::uuid)", [secondSession, binding.subject]);
    const before = await checkpoint(binding), pending = await operation(binding);
    for (const mismatch of [{ context: hash("changed context") }, { next: hash("changed next") }, { record: hash("changed expected") },
      { revision: 1 }, { operation: hash("uncaptured operation") }, { session: secondSession }]) {
      await expect(advance({ ...binding, ...mismatch })).rejects.toThrow("PLANET_CHILD_OPERATION_BINDING_DENIED");
      expect(await checkpoint(binding)).toEqual(before); expect(await operation(binding)).toEqual(pending);
    }
    expectReceipt(await advance(binding), binding, 1, binding.next);
  });

  it("retains the original exclusive expiry when another operation captures and never recreates an expired permission", async () => {
    const binding = await provisionFixture(), captured = await capture(binding, 1000);
    const newer = { ...binding, operation: hash("newer original"), next: hash("newer proposed record") };
    const fresh = await capture(newer);
    expect(fresh.expires_at_ms).toBeGreaterThan(captured.expires_at_ms);
    // Move fixture metadata to an already elapsed interval, never pass a client
    // clock to the production RPC. The original timeout itself is unchanged.
    await database().query("update public.planet_child_checkpoint_operations set captured_server_ms=floor(extract(epoch from clock_timestamp())*1000)::bigint-1000, expires_at_ms=floor(extract(epoch from clock_timestamp())*1000)::bigint where operation_sha256=$1", [binding.operation]);
    const expired = await operation(binding), before = await checkpoint(binding);
    await expect(advance(binding)).rejects.toThrow("PLANET_CHILD_OPERATION_EXPIRED");
    await expect(capture(binding)).rejects.toThrow("PLANET_CHILD_OPERATION_REPLAYED");
    expect(await operation(binding)).toEqual(expired); expect(await checkpoint(binding)).toEqual(before);
    expectReceipt(await advance(newer), newer, 1, newer.next);
  });

  it("denies server clock rollback for both capture and advance without replacing the durable checkpoint", async () => {
    const binding = await provisionFixture(); await capture(binding);
    await database().query("update public.planet_child_checkpoints set last_server_at=clock_timestamp()+interval '1 day' where installation_id=$1::uuid", [binding.installation]);
    const before = await checkpoint(binding), pending = await operation(binding);
    await expect(capture({ ...binding, operation: hash("rollback capture") })).rejects.toThrow("PLANET_CHILD_SERVER_CLOCK_DENIED");
    await expect(advance(binding)).rejects.toThrow("PLANET_CHILD_SERVER_CLOCK_DENIED");
    expect(await checkpoint(binding)).toEqual(before); expect(await operation(binding)).toEqual(pending);
  });

  it("denies missing, other-owner and expired Auth sessions at capture and after an original capture", async () => {
    const binding = await provisionFixture(), other = await provisionFixture(), before = await checkpoint(binding);
    await expect(capture({ ...binding, session: randomUUID() })).rejects.toThrow("PLANET_CHILD_GUARDIAN_SESSION_DENIED");
    await expect(capture({ ...binding, session: other.session })).rejects.toThrow("PLANET_CHILD_GUARDIAN_SESSION_DENIED");
    await database().query("update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1::uuid", [binding.session]);
    await expect(capture(binding)).rejects.toThrow("PLANET_CHILD_GUARDIAN_SESSION_DENIED");
    expect(await checkpoint(binding)).toEqual(before); expect(await operation(binding)).toBeUndefined();
    await database().query("update auth.sessions set not_after=clock_timestamp()+interval '1 minute' where id=$1::uuid", [binding.session]);
    await capture(binding); const pending = await operation(binding), current = await checkpoint(binding);
    await database().query("update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1::uuid", [binding.session]);
    await expect(advance(binding)).rejects.toThrow("PLANET_CHILD_GUARDIAN_SESSION_DENIED");
    await database().query("delete from auth.sessions where id=$1::uuid", [binding.session]);
    await expect(advance(binding)).rejects.toThrow("PLANET_CHILD_GUARDIAN_SESSION_DENIED");
    expect(await checkpoint(binding)).toEqual(current); expect(await operation(binding)).toEqual(pending);
  });

  it("preserves the captured guardian session epoch across canonical revocation and blocks denied subjects", async () => {
    const binding = await provisionFixture(); await capture(binding);
    const before = await checkpoint(binding), pending = await operation(binding);
    expect(await service("select public.planet_revoke_web_sessions($1::uuid) as result", [binding.subject])).toEqual({ sessionEpoch: 1 });
    await expect(advance(binding)).rejects.toThrow("PLANET_CHILD_GUARDIAN_SESSION_DENIED");
    await expect(capture({ ...binding, operation: hash("old epoch") })).rejects.toThrow("PLANET_CHILD_GUARDIAN_SESSION_DENIED");
    await expect(advance({ ...binding, sessionEpoch: 1 })).rejects.toThrow("PLANET_CHILD_OPERATION_BINDING_DENIED");
    await database().query("update public.planet_access_state set access_blocked_at=clock_timestamp() where user_id=$1::uuid", [binding.subject]);
    await expect(capture({ ...binding, sessionEpoch: 1, operation: hash("blocked epoch") })).rejects.toThrow("PLANET_CHILD_GUARDIAN_SESSION_DENIED");
    expect(await checkpoint(binding)).toEqual(before); expect(await operation(binding)).toEqual(pending);
  });

  it("keeps browser RPC/table/Auth-lock access private and service provisioning/immutable bindings unavailable", async () => {
    const binding = await provisionFixture(), other = await provisionFixture(); await capture(binding);
    for (const role of ["anon", "authenticated"] as const) {
      for (const sql of [captureSql, advanceSql]) await expect(asRole(role, () => scalar(sql, sql === captureSql ? [...args(binding), 60000] : args(binding)))).rejects.toThrow(/permission denied/u);
      for (const table of ["planet_child_checkpoints", "planet_child_checkpoint_operations"]) await expect(asRole(role, () => database().query("select * from public." + table))).rejects.toThrow(/permission denied/u);
      await expect(asRole(role, () => scalar("select * from planet_private.lock_child_guardian_session($1::uuid,$2::uuid)", [binding.subject, binding.session]))).rejects.toThrow(/permission denied/u);
    }
    await expect(asRole("service_role", () => database().query("select private_fixture_secret from auth.sessions"))).rejects.toThrow(/permission denied/u);
    await expect(asRole("service_role", () => database().query("update auth.sessions set not_after=null where id=$1::uuid", [binding.session]))).rejects.toThrow(/permission denied/u);
    await expect(asRole("service_role", () => database().query("insert into public.planet_child_checkpoints(installation_id,authority_epoch,user_id,revision,record_sha256,last_server_at) values($1::uuid,$2::uuid,$3::uuid,0,$4,clock_timestamp())", [randomUUID(), randomUUID(), binding.subject, binding.record]))).rejects.toThrow(/permission denied/u);
    await expect(asRole("service_role", () => database().query("delete from public.planet_child_checkpoints where installation_id=$1::uuid", [binding.installation]))).rejects.toThrow(/permission denied/u);
    await expect(asRole("service_role", () => database().query("delete from public.planet_child_checkpoint_operations where operation_sha256=$1", [binding.operation]))).rejects.toThrow(/permission denied/u);
    for (const [column, value, cast] of [["user_id", other.subject, "::uuid"], ["authority_epoch", randomUUID(), "::uuid"], ["context_sha256", hash("rewrite"), ""],
      ["next_record_sha256", hash("rewrite next"), ""], ["guardian_session_id", other.session, "::uuid"], ["guardian_session_epoch", 1, "::bigint"], ["expires_at_ms", 1, "::bigint"]] as const) {
      await expect(asRole("service_role", () => database().query("update public.planet_child_checkpoint_operations set " + column + "=$1" + cast + " where operation_sha256=$2", [value, binding.operation]))).rejects.toThrow(/permission denied/u);
    }
    const invalidOwner = [...args(binding)]; invalidOwner[2] = other.subject; invalidOwner[7] = hash("wrong-owner original");
    await expect(asRole("service_role", () => database().query("insert into public.planet_child_checkpoint_operations(installation_id,authority_epoch,user_id,guardian_session_id,guardian_session_epoch,expected_revision,expected_record_sha256,operation_sha256,context_sha256,next_record_sha256,captured_server_ms,expires_at_ms) values($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::bigint,$6::bigint,$7,$8,$9,$10,1,2)", invalidOwner))).rejects.toThrow(/foreign key constraint/u);
    const metadata = await scalar<{ rls: boolean; forced: boolean; policies: number; definer: boolean[] }>(`select jsonb_build_object(
      'rls',bool_and(c.relrowsecurity),'forced',bool_and(c.relforcerowsecurity),
      'policies',(select count(*) from pg_policies where tablename in ('planet_child_checkpoints','planet_child_checkpoint_operations')),
      'definer',(select jsonb_agg(prosecdef order by proname) from pg_proc where proname in ('planet_capture_child_checkpoint','planet_advance_child_checkpoint'))) as result
      from pg_class c where c.oid in ('public.planet_child_checkpoints'::regclass,'public.planet_child_checkpoint_operations'::regclass)`);
    expect(metadata).toEqual({ rls: true, forced: true, policies: 0, definer: [false, false] });
  });

  it("rolls back an operation consumption if the checkpoint write loses its actual column privilege", async () => {
    const binding = await provisionFixture(); await capture(binding);
    const before = await checkpoint(binding), pending = await operation(binding);
    await database().exec("revoke update(record_sha256) on public.planet_child_checkpoints from service_role");
    await expect(advance(binding)).rejects.toThrow(/permission denied/u);
    expect(await checkpoint(binding)).toEqual(before); expect(await operation(binding)).toEqual(pending);
    await database().exec("grant update(record_sha256) on public.planet_child_checkpoints to service_role");
    expectReceipt(await advance(binding), binding, 1, binding.next);
  });

  it.each(["capture", "advance"] as const)("rolls back %s whose actual mutation finishes after its unchanged original deadline", async mode => {
    const binding = await provisionFixture();
    if (mode === "advance") await capture(binding, 1000);
    const before = await checkpoint(binding), pending = await operation(binding);
    // Sequence increments are not rolled back, proving the actual mutation
    // trigger ran. An early pre-write expiry cannot make this test pass.
    await database().exec(`create sequence public.checkpoint_delay_observed;
      create function public.checkpoint_delay_fixture() returns trigger language plpgsql security definer set search_path='' as $$
      declare delay_seconds double precision;
      begin
        perform pg_catalog.nextval('public.checkpoint_delay_observed'::regclass);
        delay_seconds := greatest(0::double precision,(NEW.expires_at_ms - pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp())*1000))::double precision/1000)+0.05;
        perform pg_catalog.pg_sleep(delay_seconds);
        return NEW;
      end; $$;`);
    await database().exec(mode === "capture"
      ? "create trigger checkpoint_delay after insert on public.planet_child_checkpoint_operations for each row execute function public.checkpoint_delay_fixture()"
      : "create trigger checkpoint_delay after update of consumed_server_ms on public.planet_child_checkpoint_operations for each row when (NEW.consumed_server_ms is not null) execute function public.checkpoint_delay_fixture()");
    await expect(mode === "capture" ? capture(binding, 200) : advance(binding)).rejects.toThrow("PLANET_CHILD_OPERATION_EXPIRED");
    expect(await scalar("select is_called as result from public.checkpoint_delay_observed")).toBe(true);
    expect(await scalar("select last_value::integer as result from public.checkpoint_delay_observed")).toBe(1);
    expect(await checkpoint(binding)).toEqual(before); expect(await operation(binding)).toEqual(pending);
  });

  it("restores already-reviewed budget deletion and preserves ledger, sandbox and financial deletion contracts together", async () => {
    const binding = await provisionFixture(), other = await provisionFixture(); await capture(binding); await capture(other);
    const budgetSql = "select public.planet_consume_license_grant_budget($1::uuid,'fixture-base',3,60) as result";
    await service(budgetSql, [binding.subject]); await service(budgetSql, [other.subject]);
    const order = randomUUID();
    await service("select public.planet_reserve_sandbox_order($1::uuid,$2::uuid,$3::uuid,'sandbox.fixture','fixture-v1',100,'123','https://fixture.invalid/return',$4::uuid,$5::uuid) as result",
      [order, randomUUID(), binding.subject, randomUUID(), randomUUID()]);
    const event = randomUUID(), transaction = randomUUID(), payment = ["checkpoint-fixture", event, hash("payment fixture"), transaction, binding.subject, "fixture-base", "active", "2026-09-05T12:00:00Z"];
    await service("select public.planet_enqueue_verified_payment_retry($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as result", payment);
    await service("select public.planet_apply_verified_payment_event($1,$2,$3,$4,$5::uuid,$6,$7,$8::timestamptz) as result", payment);
    const auditBefore = await scalar("select to_jsonb(e)-'user_id' as result from public.planet_payment_events e where provider='checkpoint-fixture' and event_id=$1", [event]);
    expect(await blockers(binding.subject)).toEqual([]); expect(await blockers(other.subject)).toEqual([]);
    const request = randomUUID(), lease = randomUUID(), before = await checkpoint(binding), pending = await operation(binding);
    await service("select public.planet_request_account_deletion($1::uuid,$2::uuid) as result", [binding.subject, request]);
    // The accepted request fences before any processor claim, not merely after.
    await expect(capture({ ...binding, operation: hash("deletion pending") })).rejects.toThrow("PLANET_READER_DELETION_FENCED");
    await expect(advance(binding)).rejects.toThrow("PLANET_READER_DELETION_FENCED");
    await expect(service(budgetSql, [binding.subject])).rejects.toThrow("PLANET_READER_DELETION_FENCED");
    expect(await checkpoint(binding)).toEqual(before); expect(await operation(binding)).toEqual(pending);
    expect(await service("select public.planet_claim_reader_deletion($1::uuid,$2::uuid,$3,60) as result", [request, lease, hash("deletion policy")])).toEqual({ status: "claimed" });
    expect(await service("select public.planet_inspect_reader_deletion($1::uuid,$2::uuid,true) as result", [request, lease])).toMatchObject({ phase: "auth-ready", blockers: [] });
    await database().query("delete from auth.users where id=$1::uuid", [binding.subject]);
    expect(await service("select public.planet_finish_reader_deletion($1::uuid,$2::uuid,'completed',$3,array[]::text[]) as result", [request, lease, hash("deletion evidence")])).toMatchObject({ status: "completed" });
    expect(await checkpoint(binding)).toBeUndefined(); expect(await operation(binding)).toBeUndefined();
    for (const table of ["planet_license_grant_budgets", "planet_sandbox_orders", "planet_verified_payment_retries"]) expect(await scalar("select count(*)::integer as result from public." + table + " where user_id=$1::uuid", [binding.subject])).toBe(0);
    expect(await checkpoint(other)).toMatchObject({ revision: 0, record_sha256: other.record }); expect(await operation(other)).toMatchObject({ consumed_server_ms: null });
    expect(await scalar("select count(*)::integer as result from public.planet_license_grant_budgets where user_id=$1::uuid", [other.subject])).toBe(1);
    expect(await scalar("select user_id as result from public.planet_payment_events where provider='checkpoint-fixture' and event_id=$1", [event])).toBeNull();
    expect(await scalar("select user_id as result from public.planet_purchase_receipts where provider='checkpoint-fixture' and transaction_id=$1", [transaction])).toBeNull();
    expect(await scalar("select to_jsonb(e)-'user_id' as result from public.planet_payment_events e where provider='checkpoint-fixture' and event_id=$1", [event])).toEqual(auditBefore);
  });

  it("fails canonical deletion preflight when checkpoint ownership or a reviewed private dependency is removed or widened", async () => {
    const binding = await provisionFixture(); await capture(binding);
    const constraints = (await database().query<{ conname: string; parent: string }>("select conname,confrelid::regclass::text as parent from pg_constraint where contype='f' and conrelid='public.planet_child_checkpoint_operations'::regclass")).rows;
    for (const constraint of constraints) {
      await database().exec("savepoint schema_guard");
      await database().exec('alter table public.planet_child_checkpoint_operations drop constraint "' + constraint.conname + '"');
      expect(await blockers(binding.subject)).toContain(constraint.parent === "auth.users" ? "schema-required-identity-fk" : "schema-private-dependent");
      await database().exec("rollback to savepoint schema_guard"); await database().exec("release savepoint schema_guard");
    }
    await database().exec("create table public.unreviewed_checkpoint_link(id uuid references public.planet_child_checkpoints(installation_id) on delete cascade)");
    expect(await blockers(binding.subject)).toContain("schema-private-dependent");
  });
});
