import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createReaderDeletionProcessor } from "../../server/planet/deletionProcessor.ts";
import { createSupabaseReaderDeletionServices } from "../../server/planet/deletionProcessorSupabase.ts";
import { runReaderDeletionCommand } from "../../server/planet/deletionProcessorCli.ts";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const canonical = read("../../supabase/schema.sql");
const journey = read("../../supabase/migrations/20260802_reader_journey.sql");
const dossiers = read("../../supabase/migrations/20260905_book_dossiers_v2.sql");
const foundation = read("../../supabase/migrations/20260905_literary_planet_web_license.sql");
const processorSql = read("../../supabase/migrations/20260906_literary_planet_reader_deletion_processor.sql");
function table(source, name) {
  const match = source.match(new RegExp(`create table (?:if not exists )?public\\.${name} \\([\\s\\S]*?\\n\\);`, "u"));
  if (!match) throw Error("Missing canonical table " + name);
  return match[0];
}
const policy = { version: "isolated-fixture-only", reviewEvidenceSha256: "f".repeat(64), privateReaderData: "delete",
  ownedAvatars: "delete", publicContributions: "block", paymentRecords: "retain-provider-records-unlinked" };
let db;
let calls;
let loseAuthResponse;
let refuseAuth;
let keepStorage;
async function scalar(sql, params = []) { return (await db.query(sql, params)).rows[0]?.result; }
async function rpc(name, args) {
  const signatures = {
    planet_claim_reader_deletion: ["p_request_id", "p_lease_token", "p_policy_sha256", "p_lease_seconds"],
    planet_inspect_reader_deletion: ["p_request_id", "p_lease_token", "p_prepare"],
    planet_finish_reader_deletion: ["p_request_id", "p_lease_token", "p_status", "p_evidence_sha256", "p_blocker_codes"],
  };
  if (!signatures[name]) throw Error("Unexpected isolated fixture RPC");
  await db.exec("set role service_role");
  try { return await scalar(`select public.${name}(${signatures[name].map((_, index) => `$${index + 1}`).join(",")}) as result`, signatures[name].map(key => args[key])); }
  finally { await db.exec("reset role").catch(() => {}); /* failed SQL leaves the test transaction aborted until its savepoint rollback */ }
}
// Genuine Supabase SDK requests terminate only in this local PostgreSQL fixture.
// Metadata deletion below simulates the Storage service AFTER blob deletion; the
// product adapter never issues SQL DELETE against storage.objects.
const localFetch = async (input, init) => {
  const request = new Request(input, init), url = new URL(request.url);
  calls.push({ path: url.pathname, method: request.method, body: await request.clone().text() });
  expect(url.origin).toBe("https://canonical-fixture.supabase.co");
  expect(init.redirect).toBe("error"); expect(init.cache).toBe("no-store");
  if (request.signal.aborted) throw Error("aborted");
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const data = await rpc(url.pathname.split("/").at(-1), await request.json());
    return Response.json(data);
  }
  if (url.pathname === "/storage/v1/object/avatars" && request.method === "DELETE") {
    const { prefixes } = await request.json();
    if (!keepStorage) for (const path of prefixes) await db.query("delete from storage.objects where bucket_id='avatars' and name=$1", [path]);
    return Response.json(prefixes.map(name => ({ name })));
  }
  if (url.pathname.startsWith("/auth/v1/admin/users/") && request.method === "DELETE") {
    expect(await request.json()).toEqual({ should_soft_delete: false });
    const id = url.pathname.split("/").at(-1);
    if (refuseAuth) return Response.json({ message: "fixture denied", code: "unexpected_failure" }, { status: 500 });
    await db.query("delete from auth.users where id=$1::uuid", [id]);
    if (loseAuthResponse) throw Error("Response lost after real SQL commit");
    return Response.json({ id, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-09-05T00:00:00Z" });
  }
  throw Error("Unexpected network request in isolated fixture");
};
const services = () => createSupabaseReaderDeletionServices({ canonicalProjectUrl: "https://canonical-fixture.supabase.co", serviceRoleKey: "isolated-fixture-service-key-not-a-secret", fetch: localFetch });
const processor = (override = {}) => createReaderDeletionProcessor({ services: services(), policy, leaseSeconds: 60, maxStorageBatches: 3, ...override });
async function reader(role = "reader") {
  const id = randomUUID(); await db.query("insert into auth.users(id) values($1::uuid)", [id]);
  await db.query("insert into public.profiles(id,display_name,role) values($1::uuid,'Fixture reader',$2::public.community_role)", [id, role]);
  return id;
}
async function request(subject) {
  const id = randomUUID();
  await scalar("select public.planet_request_account_deletion($1::uuid,$2::uuid) as result", [subject, id]);
  return id;
}
async function claim(id, token = randomUUID(), hash = "f".repeat(64)) {
  const result = await rpc("planet_claim_reader_deletion", { p_request_id: id, p_lease_token: token, p_policy_sha256: hash, p_lease_seconds: 60 });
  return { token, result };
}
const inspect = (id, token, prepare = false) => rpc("planet_inspect_reader_deletion", { p_request_id: id, p_lease_token: token, p_prepare: prepare });
const exists = subject => scalar("select exists(select 1 from auth.users where id=$1::uuid) as result", [subject]);
const row = id => scalar("select to_jsonb(r) as result from public.planet_deletion_requests r where request_id=$1::uuid", [id]);
async function avatar(subject, extension = "webp", owner = subject, bucket = "avatars") {
  await db.query("insert into storage.objects(id,bucket_id,name,owner_id) values($1::uuid,$2,$3,$4)", [randomUUID(), bucket, `${subject}/avatar.${extension}`, owner]);
}

// One real PostgreSQL connection: ACL, FK, trigger, rollback and retry behavior.
// This does not claim multi-connection lock-contention or live GoTrue/Storage QA.
describe.sequential("guarded reader deletion on canonical constraints", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth; create schema storage; grant usage on schema public,auth to anon,authenticated,service_role;
      create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.objects(id uuid primary key,bucket_id text not null,name text not null,owner_id text,owner uuid,unique(bucket_id,name));
      create type public.community_role as enum ('reader','moderator','editor','admin');
      create type public.publication_status as enum ('published','hidden','pending');`);
    for (const name of ["profiles", "forum_topics", "forum_replies", "article_comments", "ratings", "content_views", "reader_favorites", "reader_book_collections", "reader_book_collection_items", "reader_book_favorites", "comment_reports"]) await db.exec(table(canonical, name));
    for (const name of ["reader_progress", "reader_subscriptions", "reader_notifications"]) await db.exec(table(journey, name));
    await db.exec(table(dossiers, "book_dossiers"));
    const cms = read("../../supabase/migrations/20260728_cms_foundation.sql");
    const staff = table(cms, "staff_memberships");
    // Staff enum comes verbatim from the canonical migration as well.
    const enumMatch = cms.match(/create type public\.staff_role as enum \([\s\S]*?\);/u);
    if (!enumMatch) throw Error("Missing canonical staff enum");
    await db.exec(enumMatch[0]); await db.exec(staff);
    await db.exec(foundation); await db.exec(processorSql);
  }, 60_000);
  beforeEach(async () => { calls = []; loseAuthResponse = false; refuseAuth = false; keepStorage = false; await db.exec("begin"); });
  afterEach(async () => { await db.exec("rollback"); });
  afterAll(async () => { await db?.close(); });

  it("hard-deletes private reader state and owned avatar through the real SDK protocol", async () => {
    const subject = await reader(), other = await reader(), id = await request(subject);
    await avatar(subject, "jpg"); await avatar(subject, "webp"); await avatar(other);
    await db.query("insert into reader_book_collections(user_id,id,name) values($1::uuid,'shelf','My shelf')", [subject]);
    await db.query("insert into reader_book_collection_items(user_id,collection_id,book_key,position) values($1::uuid,'shelf','book',1)", [subject]);
    await db.query("insert into reader_progress(user_id,item_type,item_id) values($1::uuid,'book','book')", [subject]);
    const result = await processor().process(id);
    expect(result).toEqual({ status: "completed", codes: [] }); expect(await exists(subject)).toBe(false); expect(await exists(other)).toBe(true);
    expect(await scalar("select count(*)::int as result from reader_book_collection_items")).toBe(0);
    expect(await scalar("select count(*)::int as result from reader_progress")).toBe(0);
    expect(await scalar("select count(*)::int as result from storage.objects")).toBe(1);
    expect((await row(id)).user_id).toBeNull(); expect((await row(id)).processor_phase).toBe("auth-deleted");
    expect((await row(id)).evidence_sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(calls.filter(call => call.method === "DELETE").map(call => call.path)).toEqual(["/storage/v1/object/avatars", `/auth/v1/admin/users/${subject}`]);
    expect(await processor().process(id)).toEqual({ status: "completed", codes: [] });
  });
  it("supports paid readers under explicit policy, unlinks UUID and preserves exact provider ledger", async () => {
    const subject = await reader();
    await scalar("select planet_apply_verified_payment_event('fixture','event',$1,'transaction',$2::uuid,'base','active','2026-09-05T00:00:00Z'::timestamptz) as result", ["c".repeat(64), subject]);
    const before = await scalar("select to_jsonb(r)-'user_id' as result from planet_purchase_receipts r");
    const id = await request(subject);
    // Actual operator composition with local-only SDK/PGlite transport, never live.
    const command = await runReaderDeletionCommand(["--execute", "--request-id", id, "--policy", "isolated-fixture.json"],
      { SUPABASE_URL: "https://canonical-fixture.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "isolated-fixture-service-key-not-a-secret" },
      { readPolicyFile: async () => JSON.stringify(policy), createServices: config => createSupabaseReaderDeletionServices({ ...config, fetch: localFetch }) });
    expect(command).toMatchObject({ mode: "execute", status: "completed", requestId: id });
    expect(await scalar("select user_id as result from planet_purchase_receipts")).toBeNull();
    expect(await scalar("select user_id as result from planet_payment_events")).toBeNull();
    expect(await scalar("select to_jsonb(r)-'user_id' as result from planet_purchase_receipts r")).toEqual(before);
  });
  it("does nothing without an externally supplied policy reference", async () => {
    const subject = await reader(), id = await request(subject);
    expect(await processor({ policy: null }).process(id)).toEqual({ status: "blocked", codes: ["reviewed-policy-required"] });
    expect(calls).toHaveLength(0); expect((await row(id)).status).toBe("requested"); expect(await exists(subject)).toBe(true);
  });
  it.each(["owner", "admin", "editor"])("blocks staff membership %s without removing the last owner", async role => {
    const subject = await reader(); await db.query("insert into staff_memberships(user_id,role) values($1::uuid,$2::public.staff_role)", [subject, role]);
    const id = await request(subject); const result = await processor().process(id);
    expect(result.status).toBe("blocked"); expect(result.codes).toContain("staff-membership");
    expect(await exists(subject)).toBe(true); expect((await row(id)).processor_started_at).toBeNull();
  });
  it("blocks authored comments and protects another reader's forum reply", async () => {
    const subject = await reader(), other = await reader(), topic = randomUUID();
    await db.query("insert into forum_topics(id,author_id,title,body,category) values($1::uuid,$2::uuid,'Title','Long enough body','Other')", [topic, subject]);
    await db.query("insert into forum_replies(topic_id,author_id,body) values($1::uuid,$2::uuid,'Reply')", [topic, other]);
    await db.query("insert into article_comments(article_slug,author_id,session_id,body) values('article',$1::uuid,$2::uuid,'Comment')", [subject, randomUUID()]);
    const result = await processor().process(await request(subject)); expect(result.codes).toContain("public-contributions");
    expect(await scalar("select count(*)::int as result from forum_replies")).toBe(1); expect(await exists(subject)).toBe(true);
  });
  it("blocks the newly integrated book_dossiers updated_by RESTRICT reference", async () => {
    const subject = await reader(); await db.query("insert into book_dossiers(book_key,locale,revision,record,updated_by) values('book','ru',1,'{}',$1::uuid)", [subject]);
    expect((await processor().process(await request(subject))).codes).toContain("editorial-reference"); expect(await exists(subject)).toBe(true);
  });
  it("deletes only authenticated owned views; preserves other readers and anonymous rows sharing a session", async () => {
    const subject = await reader(), other = await reader(), session = randomUUID();
    for (const owner of [subject, subject, other, null]) await db.query("insert into content_views(path,session_id,user_id) values('/read/',$1::uuid,$2::uuid)", [session, owner]);
    expect((await processor().process(await request(subject))).status).toBe("completed");
    expect(await scalar("select count(*)::int as result from content_views")).toBe(2);
    expect(await scalar("select count(*)::int as result from content_views where user_id=$1::uuid", [other])).toBe(1);
    expect(await scalar("select count(*)::int as result from content_views where user_id is null")).toBe(1);
  });
  it("rolls back owned view removal if Auth's surrounding transaction fails", async () => {
    const subject = await reader(), id = await request(subject), { token } = await claim(id);
    await db.query("insert into content_views(path,session_id,user_id) values('/read/',$1::uuid,$2::uuid)", [randomUUID(), subject]);
    await inspect(id, token, true);
    await db.exec("create function auth.fixture_abort_delete() returns trigger language plpgsql as $$ begin raise exception 'fixture-auth-failure'; end $$; create trigger zz_fixture_abort after delete on auth.users for each row execute function auth.fixture_abort_delete()");
    await db.exec("savepoint rejected"); await expect(db.query("delete from auth.users where id=$1::uuid", [subject])).rejects.toThrow(/fixture-auth-failure/u); await db.exec("rollback to rejected");
    expect(await scalar("select count(*)::int as result from content_views where user_id=$1::uuid", [subject])).toBe(1);
    expect((await row(id)).processor_phase).toBe("auth-ready"); expect(await exists(subject)).toBe(true);
  });
  it("blocks unknown analytics cascades and anonymous fallback inserts from a fenced session", async () => {
    const subject = await reader(), id = await request(subject), { token } = await claim(id); await inspect(id, token);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [subject]);
    await db.exec("savepoint rejected"); await expect(db.query("insert into content_views(path,session_id) values('/read/',$1::uuid)", [randomUUID()])).rejects.toThrow(/FENCED/u); await db.exec("rollback to rejected");
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await db.exec("create table public.unknown_view_child(view_id bigint references content_views(id) on delete cascade)");
    expect((await inspect(id, token)).blockers).toContain("schema-private-dependent");
  });
  it.each(["gif", "pdf"])("does not remove unsupported avatar extension %s", async extension => {
    const subject = await reader(); await avatar(subject, extension);
    expect((await processor().process(await request(subject))).codes).toContain("unsupported-storage-object");
    expect(calls.some(call => call.method === "DELETE")).toBe(false);
  });
  it("rejects another owner's object under this reader's prefix", async () => {
    const subject = await reader(), other = await reader(); await avatar(subject, "webp", other);
    expect((await processor().process(await request(subject))).codes).toContain("unsupported-storage-object"); expect(await exists(other)).toBe(true);
  });
  it("detects uppercase textual storage ownership without deleting an unsupported object", async () => {
    const subject = await reader();
    await db.query("insert into storage.objects(id,bucket_id,name,owner_id) values($1::uuid,'other-bucket','unsupported.pdf',$2)", [randomUUID(), subject.toUpperCase()]);
    expect((await processor().process(await request(subject))).codes).toContain("unsupported-storage-object");
    expect(calls.some(call => call.method === "DELETE")).toBe(false);
  });
  it("fences ownership/path transfer of an OLD pending avatar as well as NEW uploads", async () => {
    const subject = await reader(), other = await reader(); await avatar(subject);
    const id = await request(subject), { token } = await claim(id); await inspect(id, token);
    await db.exec("savepoint rejected");
    await expect(db.query("update storage.objects set owner_id=$1,name=$2 where owner_id=$3", [other, `${other}/avatar.webp`, subject])).rejects.toThrow(/PLANET_READER_DELETION_FENCED/u);
    await db.exec("rollback to rejected");
    expect(await scalar("select name as result from storage.objects")).toBe(`${subject}/avatar.webp`);
  });
  it("fences profile edits, staff promotion, new contribution and new Storage upload after preflight", async () => {
    const subject = await reader(), id = await request(subject), { token } = await claim(id);
    expect((await inspect(id, token)).blockers).toEqual([]);
    for (const [sql, args] of [
      ["update profiles set display_name='Changed' where id=$1::uuid", [subject]],
      ["insert into staff_memberships(user_id,role) values($1::uuid,'owner')", [subject]],
      ["insert into article_comments(article_slug,author_id,session_id,body) values('article',$1::uuid,$2::uuid,'Comment')", [subject, randomUUID()]],
      ["insert into storage.objects(id,bucket_id,name,owner_id) values($1::uuid,'avatars',$2,$3)", [randomUUID(), `${subject}/avatar.png`, subject]],
    ]) {
      await db.exec("savepoint rejected"); await expect(db.query(sql, args)).rejects.toThrow(/PLANET_READER_DELETION_FENCED/u); await db.exec("rollback to rejected");
    }
  });
  it("does not arm Auth deletion until the actual Storage objects are absent", async () => {
    const subject = await reader(), id = await request(subject); await avatar(subject);
    const { token } = await claim(id); expect((await inspect(id, token, true)).phase).toBe("fenced");
    await db.exec("savepoint rejected"); await expect(db.query("delete from auth.users where id=$1::uuid", [subject])).rejects.toThrow(/NOT_ARMED/u); await db.exec("rollback to rejected");
  });
  it("never completes from Storage HTTP success that left actual objects behind", async () => {
    const subject = await reader(); await avatar(subject); keepStorage = true;
    expect(await processor({ maxStorageBatches: 2 }).process(await request(subject))).toEqual({ status: "retry", codes: ["storage-batch-budget"] });
    expect(calls.filter(call => call.path.startsWith("/auth/")).length).toBe(0); expect(await exists(subject)).toBe(true);
  });
  it("reconciles lost Auth response using the guarded transaction and nullable original FK", async () => {
    const subject = await reader(), id = await request(subject); loseAuthResponse = true;
    expect((await processor().process(id)).status).toBe("completed"); expect(await exists(subject)).toBe(false);
  });
  it("resumes after Auth failure and lease expiry without pretending the account disappeared", async () => {
    const subject = await reader(), id = await request(subject); refuseAuth = true;
    expect((await processor().process(id)).status).toBe("retry"); expect(await exists(subject)).toBe(true);
    expect((await processor().process(id)).status).toBe("busy");
    await db.query("update planet_deletion_requests set processor_lease_until=clock_timestamp()-interval '1 second' where request_id=$1::uuid", [id]);
    refuseAuth = false; expect((await processor().process(id)).status).toBe("completed");
  });
  it("recovers a committed deletion after the old lease expired before outcome", async () => {
    const subject = await reader(), id = await request(subject), { token } = await claim(id);
    await inspect(id, token, true); await db.query("delete from auth.users where id=$1::uuid", [subject]);
    await db.query("update planet_deletion_requests set processor_lease_until=clock_timestamp()-interval '1 second' where request_id=$1::uuid", [id]);
    // Keep exactly the same policy digest as the first claim in this fixture.
    const next = await claim(id); expect(next.result.status).toBe("claimed");
    expect(await inspect(id, next.token)).toEqual({ phase: "auth-deleted", subject: null, blockers: [], objects: [], objectCount: 0 });
    const result = await rpc("planet_finish_reader_deletion", { p_request_id: id, p_lease_token: next.token, p_status: "completed", p_evidence_sha256: "e".repeat(64), p_blocker_codes: [] });
    expect(result.status).toBe("completed");
  });
  it("rejects new unfenced identity tables and modified payment retention fields", async () => {
    const subject = await reader(), id = await request(subject);
    await db.exec("create table public.new_identity_ref(id uuid primary key,user_id uuid references auth.users(id) on delete cascade)");
    const { token } = await claim(id); expect((await inspect(id, token)).blockers).toContain("schema-mutation-fence");
    await db.exec("drop table public.new_identity_ref; alter table planet_purchase_receipts add column email text");
    expect((await inspect(id, token)).blockers).toContain("schema-payment-retention");
  });
  it("rejects unknown dependents of private shelves", async () => {
    const subject = await reader(), id = await request(subject);
    await db.exec("create table public.unknown_shelf_ref(user_id uuid,collection_id text,foreign key(user_id,collection_id) references reader_book_collections(user_id,id) on delete cascade)");
    const { token } = await claim(id); expect((await inspect(id, token)).blockers).toContain("schema-private-dependent");
  });
  it("detects dropped private owner FKs and a disabled Auth deletion guard before side effects", async () => {
    const subject = await reader(), id = await request(subject);
    await db.exec("alter table reader_progress drop constraint reader_progress_user_id_fkey");
    const { token } = await claim(id); expect((await inspect(id, token)).blockers).toContain("schema-required-identity-fk");
    await db.exec("alter table auth.users disable trigger planet_guard_reader_auth_deletion");
    expect((await inspect(id, token)).blockers).toContain("schema-auth-deletion-guard");
  });
  it("refuses to relabel an old outcome-only completed request as processor-verified", async () => {
    const id = randomUUID();
    await db.query("insert into planet_deletion_requests(request_id,status,completed_at,evidence_sha256) values($1::uuid,'completed',clock_timestamp(),$2)", [id, "a".repeat(64)]);
    await db.exec("savepoint rejected"); await expect(claim(id)).rejects.toThrow(/LEGACY_COMPLETION_UNVERIFIED/u); await db.exec("rollback to rejected; reset role");
  });
  it("checks lease ownership, policy binding, ACL and closes the old outcome bypass", async () => {
    const subject = await reader(), id = await request(subject); const { token } = await claim(id);
    expect((await claim(id)).result.status).toBe("busy"); expect((await claim(id, randomUUID(), "a".repeat(64))).result.status).toBe("policy-conflict");
    const attempts = [
      ["select planet_inspect_reader_deletion($1::uuid,$2::uuid,false)", [id, randomUUID()], "postgres", /LEASE_INVALID/u],
      ["select planet_finish_reader_deletion($1::uuid,$2::uuid,'completed',$3,'{}')", [id, token, "f".repeat(64)], "service_role", /COMPLETION_UNPROVEN/u],
      ["select planet_record_deletion_outcome($1::uuid,'completed',$2,'{}')", [id, "f".repeat(64)], "service_role", /permission denied/u],
      ["select planet_claim_reader_deletion($1::uuid,$2::uuid,$3,60)", [id, token, "f".repeat(64)], "authenticated", /permission denied/u],
      ["select planet_inspect_reader_deletion($1::uuid,$2::uuid,false)", [id, token], "anon", /permission denied/u],
    ];
    for (const [sql, args, role, error] of attempts) {
      await db.exec("savepoint rejected"); await db.exec(`set role ${role}`); await expect(db.query(sql, args)).rejects.toThrow(error); await db.exec("rollback to rejected; reset role");
    }
  });
});
