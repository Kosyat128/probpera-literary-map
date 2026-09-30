import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const modulePath = process.argv.find(arg => arg.startsWith("--pglite="))?.slice(9);
if (!modulePath) throw Error("Provide --pglite=path; this checker never connects to a remote DB.");
const { PGlite } = await import(pathToFileURL(path.resolve(modulePath)).href);
const db = new PGlite(), checks = [];
const staffId = "11111111-1111-4111-8111-111111111111", readerId = "22222222-2222-4222-8222-222222222222";
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $auth$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $auth$;
    grant usage on schema auth to authenticated;
    create type public.staff_role as enum ('owner','admin','editor');
    create table public.staff_memberships(user_id uuid primary key, role public.staff_role);
    create function public.is_staff(allowed_roles public.staff_role[] default array['owner'::public.staff_role,'admin'::public.staff_role,'editor'::public.staff_role])
    returns boolean language sql stable security definer set search_path='' as $staff$
      select exists(select 1 from public.staff_memberships where user_id=(select auth.uid()) and role=any(allowed_roles))
    $staff$;
    revoke all on function public.is_staff(public.staff_role[]) from public;
    grant execute on function public.is_staff(public.staff_role[]) to authenticated;
    create table public.admin_audit_log(id bigint generated always as identity primary key, entity_type text, entity_id text, metadata jsonb);
    grant select on public.admin_audit_log to authenticated, service_role;
    alter table public.admin_audit_log enable row level security;
    create policy staff_read on public.admin_audit_log for select to authenticated using(public.is_staff() and entity_id <> 'post:news:rls-hidden');
    create policy runtime_service_read on public.admin_audit_log for select to service_role using(entity_type='literary_news_runtime');
  `);
  await db.query("insert into public.staff_memberships values($1,'editor')", [staffId]);
  await db.exec(await readFile(new URL("./database/literary-news-runtime-latest-query.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("./database/literary-news-runtime-staff-latest-query.sql", import.meta.url), "utf8"));
  await db.exec(`
    insert into public.admin_audit_log(entity_type,entity_id,metadata)
    select 'literary_news_runtime','post:news:replayed','{"status":"pending"}'::jsonb from generate_series(1,50000);
    insert into public.admin_audit_log(entity_type,entity_id,metadata) values
      ('literary_news_runtime','post:news:replayed','{"status":"sent_current","remoteId":"17"}'),
      ('literary_news_runtime','post:news:old','{"status":"ambiguous","remoteId":"4"}'),
      ('literary_news_runtime','destination:telegram:-100123','{"mode":"on","paused":false}'),
      ('literary_news_runtime','heartbeat:scheduler','{"finishedAt":"2026-09-30T12:00:00Z"}'),
      ('literary_news_runtime','history:coverage','{"status":"gap_before_first_observation"}'),
      ('literary_news_runtime','admission:news:unused','{"privateUnusedUi":"not in staff overview"}'),
      ('literary_news_runtime','post:news:rls-hidden','{"private":"RLS_RESTRICTED"}'),
      ('article','post:news:unrelated','{"private":"OTHER_ENTITY"}'),
      ('literary_news_runtime','heartbeat:native-delivery','{"runner":"native-cron","status":"daily_target_deficit","finishedAt":"2026-09-30T11:00:00Z","dayStatus":{"freshPhotoCreates":1}}'),
      ('literary_news_runtime','heartbeat:native-delivery','{"runner":"native-cron","status":"daily_target_deficit","finishedAt":"2026-09-30T12:00:00Z","dayStatus":{"freshPhotoCreates":6}}'),
      ('literary_news_runtime','heartbeat:native-delivery:extra','{"private":"UNEXPECTED_HEARTBEAT"}');
  `);
  const before = (await db.query("select count(*)::int as n from public.admin_audit_log")).rows[0].n;
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [staffId]);
  const query = (after=null,limit=500,upper=null) => db.query(
    "select * from public.read_staff_latest_literary_news_runtime($1,$2,$3)", [after,limit,upper]);
  const all = (await query()).rows;
  assert.equal(all.length, 6);
  assert.equal(all.find(row=>row.entity_id==='post:news:replayed').metadata.remoteId,"17");
  assert.equal(all.find(row=>row.entity_id==='post:news:replayed').id,50001);
  assert.equal(all.some(row=>row.entity_id.includes("old")),true);
  checks.push("50000 replay versions collapse to exact latest receipt plus old durable job");
  assert.equal(JSON.stringify(all).includes("RLS_RESTRICTED"),false);
  assert.equal(JSON.stringify(all).includes("OTHER_ENTITY"),false);
  assert.equal(all.some(row=>row.entity_id.startsWith("admission:")),false);
  checks.push("staff guard, existing invoker RLS and four UI namespaces retain private boundaries");
  assert.equal(all.find(row=>row.entity_id==="heartbeat:native-delivery").metadata.dayStatus.freshPhotoCreates,6);
  assert.equal(all.some(row=>row.entity_id==="heartbeat:native-delivery:extra"),false);
  checks.push("exact native heartbeat latest record included; arbitrary heartbeat suffix excluded");
  const first=(await query(null,2,null)).rows, upper=first[0].snapshot_upper_id;
  await db.exec("reset role");
  await db.exec("insert into public.admin_audit_log(entity_type,entity_id,metadata) values('literary_news_runtime','post:news:replayed','{\"status\":\"inflight\",\"remoteId\":\"new\"}'),('literary_news_runtime','post:news:late','{}')");
  await db.exec("set role authenticated");
  const combined=[...first];let cursor=first.at(-1).entity_id;
  while(true){const page=(await query(cursor,2,upper)).rows;if(!page.length)break;combined.push(...page);cursor=page.at(-1).entity_id;}
  assert.equal(combined.length,6);assert.equal(new Set(combined.map(row=>row.entity_id)).size,6);
  assert.equal(combined.some(row=>row.entity_id==='post:news:late'),false);
  assert.equal(combined.find(row=>row.entity_id==='post:news:replayed').metadata.remoteId,"17");
  assert.equal(combined.every(row=>row.snapshot_upper_id===upper),true);
  checks.push("keyset pages retain fixed upper-ID snapshot despite concurrent append");
  for(const args of [[null,501,null],[null,0,null],[null,1,-1],["destination:telegram:-100123",1,null],["x".repeat(401),1,upper]])
    await assert.rejects(query(...args));
  checks.push("invalid page/cursor/watermark rejected");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [readerId]);
  await assert.rejects(query(), error=>error.code==='42501');
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(query(), error=>error.code==='42501');
  checks.push("ordinary and missing authenticated identities fail closed");
  await assert.rejects(db.query("select * from public.read_latest_literary_news_runtime('post:')"));
  await db.exec("reset role; set role anon");await assert.rejects(query());
  await db.exec("reset role; set role service_role");await assert.rejects(query());
  checks.push("anon/service cannot execute staff function; service-only RPC stays forbidden to authenticated");
  await db.exec("reset role");
  const definition=(await db.query("select prosecdef,proconfig from pg_proc where proname='read_staff_latest_literary_news_runtime'")).rows[0];
  assert.equal(definition.prosecdef,false);assert.equal(definition.proconfig.includes('search_path=""'),true);
  assert.equal((await db.query("select count(*)::int as n from public.admin_audit_log")).rows[0].n,before+2);
  checks.push("invoker empty search_path and unchanged append-only historical rows");
  console.log(JSON.stringify({status:"passed",checks,remoteDatabaseWrites:0},null,2));
} finally {await db.close();}
