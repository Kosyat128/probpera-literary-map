import type { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPaymentRetryTestDatabase } from "../../scripts/database/fixtures/literary-planet-payment-retry-context.mjs";

const privateTables = ["reader_favorites", "reader_progress", "reader_subscriptions", "reader_notifications",
  "reader_book_collections", "reader_book_collection_items", "reader_book_favorites"] as const;
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const SA = "33333333-3333-4333-8333-333333333333", SB = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
const read = (path: string) => readFile(path, "utf8");

// Local PGlite with ordinary PostgreSQL roles, real existing owner policies and
// both current migrations. Claims represent the verified PostgREST handoff, not
// a JWT signature verifier, a remote Auth project or cross-connection races.
beforeAll(async () => {
  db = await createPaymentRetryTestDatabase();
  const canonical = await read("supabase/schema.sql"), journey = await read("supabase/migrations/20260802_reader_journey.sql");
  const cms = await read("supabase/migrations/20260728_cms_foundation.sql");
  const staff = cms.match(/create or replace function public\.is_staff\([\s\S]*?\$\$;/u);
  if (!staff) throw new Error("Missing actual staff policy dependency");
  await db.exec(staff[0]);
  await db.exec("revoke all on function public.is_staff(public.staff_role[]) from public; grant execute on function public.is_staff(public.staff_role[]) to authenticated;");
  const targets = new Set<string>([...privateTables, "profiles"]);
  for (const source of [canonical, journey]) {
    // Replay the actual canonical RLS enable/force statements as well as
    // policies: extracted CREATE TABLE fixtures do not inherit these flags.
    for (const statement of source.matchAll(/alter table public\.([a-z_]+) (?:enable|force) row level security;/gu)) {
      if (targets.has(statement[1])) await db.exec(statement[0]);
    }
    for (const statement of source.matchAll(/create policy\s+[\s\S]*?;/gu)) {
      const table = statement[0].match(/on public\.([a-z_]+)/u)?.[1];
      if (table && targets.has(table)) await db.exec(statement[0]);
    }
    for (const statement of source.matchAll(/(?:^|\n)(grant|revoke)\s+[\s\S]*?;/gu)) {
      if (statement[0].includes("on function")) continue;
      if (privateTables.some(table => statement[0].includes("public." + table))) await db.exec(statement[0]);
    }
  }
  // Existing platform default profile SELECT/UPDATE permissions are explicit
  // here because this fixture executes extracted tables, not Supabase defaults.
  await db.exec("alter table public.profiles enable row level security; grant select on public.profiles to anon,authenticated; grant update on public.profiles to authenticated; alter table auth.sessions add column not_after timestamptz;");
  await db.exec(await read("supabase/migrations/20261002172514_planet_yookassa_sandbox_orders.sql"));
  await db.exec(await read("supabase/migrations/20261002173942_planet_reader_live_session_fence.sql"));
}, 60_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("reset role; select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claims','{}',false); truncate auth.users cascade;");
  for (const [subject, session] of [[A, SA], [B, SB]]) {
    await db.query("insert into auth.users(id) values($1::uuid)", [subject]);
    await db.query("insert into public.profiles(id,display_name) values($1::uuid,'Synthetic reader')", [subject]);
    await db.query("insert into auth.sessions(id,user_id) values($1::uuid,$2::uuid)", [session, subject]);
    await db.query("insert into public.reader_favorites(user_id,item_type,item_id,title,section_label) values($1::uuid,'book','synthetic-book','Synthetic book','Fixture')", [subject]);
    await db.query("insert into public.reader_progress(user_id,item_type,item_id) values($1::uuid,'book','synthetic-book')", [subject]);
    await db.query("insert into public.reader_subscriptions(user_id,subject_type,subject_id,label) values($1::uuid,'writer','synthetic-writer','Synthetic writer')", [subject]);
    await db.query("insert into public.reader_notifications(user_id,title,body) values($1::uuid,'Synthetic message','Synthetic text')", [subject]);
    await db.query("insert into public.reader_book_collections(user_id,id,name) values($1::uuid,'synthetic-shelf','Synthetic shelf')", [subject]);
    await db.query("insert into public.reader_book_collection_items(user_id,collection_id,book_key,position) values($1::uuid,'synthetic-shelf','synthetic-book',0)", [subject]);
    await db.query("insert into public.reader_book_favorites(user_id,book_key) values($1::uuid,'synthetic-book')", [subject]);
  }
});
async function asReader(subject = A, sessionId: string | null = SA, changes: Record<string, unknown> = {}) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [subject,
    JSON.stringify({ sub: subject, role: "authenticated", session_id: sessionId, exp: Math.floor(Date.now() / 1000) + 3600, is_anonymous: false, ...changes })]);
  await db.exec("set role authenticated");
}
async function count(table: typeof privateTables[number]) { return (await db.query<{ count: number }>(`select count(*)::integer as count from public.${table}`)).rows[0].count; }
async function noPrivateRead() { for (const table of privateTables) expect(await count(table), table).toBe(0); }

describe("private reader live-session fence", () => {
  it("ordinary A and B see only their seven private namespaces; public profiles stay readable", async () => {
    for (const [subject, session] of [[A, SA], [B, SB]]) {
      await asReader(subject, session);
      expect((await db.query<{ active: boolean }>("select public.planet_reader_session_active() as active")).rows[0].active).toBe(true);
      for (const table of privateTables) {
        const rows = (await db.query<{ user_id: string }>(`select user_id from public.${table}`)).rows;
        expect(rows, table).toEqual([{ user_id: subject }]);
      }
      expect((await db.query("select id from public.profiles")).rows).toHaveLength(2);
    }
    await db.exec("reset role; set role anon");
    expect((await db.query("select id from public.profiles")).rows).toHaveLength(2);
    await expect(db.exec("select * from public.reader_book_favorites")).rejects.toThrow(/permission denied/u);
    await expect(db.exec("select planet_private.reader_session_active()")).rejects.toThrow(/permission denied/u);
    await expect(db.exec("select public.planet_reader_session_active()")).rejects.toThrow(/permission denied/u);
  });
  it("real subscription upsert updates its owner, rejects reassignment, and leaves B untouched", async () => {
    await asReader();
    await db.query("insert into public.reader_subscriptions(user_id,subject_type,subject_id,label) values($1::uuid,'writer','synthetic-writer','Updated by A') on conflict(user_id,subject_type,subject_id) do update set label=excluded.label", [A]);
    await expect(db.query("update public.reader_subscriptions set user_id=$1::uuid", [B])).rejects.toThrow(/row-level security|DELETION_FENCED/u);
    await db.exec("reset role");
    expect((await db.query<{ label: string }>("select label from public.reader_subscriptions where user_id=$1::uuid", [B])).rows[0].label).toBe("Synthetic writer");
  });
  it("cached claims cannot borrow another session or metadata session id and fail closed on malformed/expired authority", async () => {
    const cases: Array<[string | null, Record<string, unknown>]> = [[null, { user_metadata: { session_id: SA } }], [SB, {}], ["malformed", {}],
      [SA, { exp: Math.floor(Date.now() / 1000) - 1 }], [SA, { exp: "999999999999" }], [SA, { is_anonymous: true }], [SA, { role: "service_role" }]];
    for (const [session, changes] of cases) { await asReader(A, session, changes); await noPrivateRead(); }
    await expect(db.query("insert into public.reader_progress(user_id,item_type,item_id) values($1::uuid,'book','forbidden')", [A])).rejects.toThrow(/row-level security/u);
  });
  it("a still-unexpired JWT cannot read or write after its actual auth.sessions row is revoked", async () => {
    await db.query("delete from auth.sessions where id=$1::uuid", [SA]);
    await asReader(); await noPrivateRead();
    expect((await db.query<{ active: boolean }>("select public.planet_reader_session_active() as active")).rows[0].active).toBe(false);
    await expect(db.query("insert into public.reader_subscriptions(user_id,subject_type,subject_id,label) values($1::uuid,'writer','forbidden','Forbidden')", [A])).rejects.toThrow(/row-level security/u);
    expect((await db.query("update public.profiles set display_name='Forbidden' returning id")).rows).toHaveLength(0);
  });
  it("database session lifetime expiration is independent of the JWT expiry", async () => {
    await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1::uuid", [SA]);
    await asReader(); await noPrivateRead();
  });
  it("accepted deletion immediately fences private access before processor claim, without hiding another reader", async () => {
    await db.query("select public.planet_request_account_deletion($1::uuid,$2::uuid)", [A, crypto.randomUUID()]);
    const request = (await db.query<{ processor_started_at: unknown }>("select processor_started_at from public.planet_deletion_requests where user_id=$1::uuid", [A])).rows[0];
    expect(request.processor_started_at).toBeNull();
    await asReader(); await noPrivateRead();
    await expect(db.query("insert into public.reader_progress(user_id,item_type,item_id) values($1::uuid,'book','late-private-write')", [A])).rejects.toThrow(/DELETION_FENCED|row-level security/u);
    await asReader(B, SB); expect(await count("reader_book_favorites")).toBe(1);
    // Even an otherwise privileged mutation cannot bypass the same subject
    // lock merely because the scheduled processor has not started yet.
    await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)");
    await expect(db.query("insert into public.reader_progress(user_id,item_type,item_id) values($1::uuid,'book','privileged-late-write')", [A])).rejects.toThrow(/DELETION_FENCED/u);
  });
  it("preserves approved staff notification creation while an ordinary reader cannot send one to B", async () => {
    await asReader();
    await expect(db.query("insert into public.reader_notifications(user_id,title,body) values($1::uuid,'Forbidden','Forbidden')", [B])).rejects.toThrow(/row-level security/u);
    await db.exec("reset role");
    await db.query("insert into public.staff_memberships(user_id,role) values($1::uuid,'editor')", [A]);
    await asReader();
    await db.query("insert into public.reader_notifications(user_id,title,body) values($1::uuid,'Staff message','Approved staff path')", [B]);
    expect(await count("reader_notifications")).toBe(1);
    await asReader(B, SB); expect(await count("reader_notifications")).toBe(2);
  });
});
