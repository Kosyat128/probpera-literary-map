import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildLiteraryNewsSchemaPlan,NEWS_SCHEMA_RECEIPT_KEY } from "./build-literary-news-schema-plan.mjs";

const modulePath=process.argv.find(arg=>arg.startsWith("--pglite="))?.slice(9);
if(!modulePath)throw new Error("Provide isolated --pglite=module; no remote connection is used");
const {PGlite}=await import(pathToFileURL(path.resolve(modulePath)).href);
const db=new PGlite(),checks=[];
const plan=buildLiteraryNewsSchemaPlan({repositorySha:"a".repeat(40)});
const rejectTransaction=async(name,sql,expected)=>{await db.exec("begin");try{await assert.rejects(db.exec(sql),expected);checks.push(name);}finally{await db.exec("rollback");}};
const baseFixture=`create role anon;create role authenticated;create role service_role;create role supabase_admin superuser;
    create schema auth;create type public.staff_role as enum('owner','admin','editor');
    create table auth.users(id uuid primary key);
    create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
    create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
    create function public.is_staff(public.staff_role[]) returns boolean language sql stable as $$select false$$;
    create table public.admin_audit_log(id bigint generated always as identity primary key,actor_id uuid,action text not null,entity_type text not null,entity_id text,metadata jsonb not null default '{}',created_at timestamptz not null default now());
    alter table public.admin_audit_log enable row level security;
    create policy fixture_staff_audit on public.admin_audit_log for all to authenticated using(true) with check(true);
    grant usage on schema auth to authenticated,service_role;
    grant select,insert,update,delete on public.admin_audit_log to authenticated;
    grant usage on sequence public.admin_audit_log_id_seq to authenticated;
    insert into public.admin_audit_log(action,entity_type,entity_id,metadata)values('existing','article','unrelated','{"preserved":true}');`;
const completeAuthFixture=`create table auth.mfa_factors(user_id uuid,status text);
    create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;`;
const applicationPrerequisites=`create table public.probpera_schema_migrations(version text primary key,migration_sha256 text);
    insert into public.probpera_schema_migrations values('historical-fixture','unchanged');
    create table public.public_build_outbox(id bigint);
    create function public.get_editorial_schema_health() returns jsonb language sql as $$select '{}'::jsonb$$;`;
try{
  await db.exec(baseFixture+completeAuthFixture);
  await rejectTransaction("missing prerequisite stops read-only preflight",plan.preflight);
  await db.exec(applicationPrerequisites);
  const historical=(await db.query("select * from public.probpera_schema_migrations")).rows;
  const unrelated=(await db.query("select * from public.admin_audit_log")).rows;
  await db.exec(`begin;${plan.preflight}commit;`);
  assert.equal((await db.query("select to_regprocedure('public.compare_append_literary_news_runtime(text,bigint,jsonb,text,bigint)') as value")).rows[0].value,null);
  checks.push("fresh read-only preflight creates nothing");
  await rejectTransaction("unknown pre-existing function fails closed",`create function public.protect_literary_news_runtime_log() returns trigger language plpgsql as $$begin return new;end;$$;${plan.plan}`);
  await rejectTransaction("unknown pre-existing index fails closed",`create index admin_audit_literary_news_runtime_key_version on public.admin_audit_log(id);${plan.plan}`);
  await rejectTransaction("verification refuses missing schema/receipt",plan.verification);
  await rejectTransaction("schema and protected receipt rollback together",`${plan.plan} do $$begin raise exception 'rollback proof';end;$$;`);
  assert.equal((await db.query("select count(*)::int n from public.admin_audit_log")).rows[0].n,1);
  await db.exec(`begin;alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;${plan.plan}rollback;`);
  checks.push("Supabase default grants normalize to the same narrow reviewed callers");
  await db.exec(`begin;${plan.plan}commit;begin;${plan.verification}commit;`);
  assert.deepEqual((await db.query("select * from public.probpera_schema_migrations")).rows,historical);
  assert.deepEqual((await db.query("select * from public.admin_audit_log where entity_type='article'")).rows,unrelated);
  checks.push("fixed migration installs atomically without historical ledger or article changes");
  const receipt=(await db.query("select * from public.admin_audit_log where entity_id=$1",[NEWS_SCHEMA_RECEIPT_KEY])).rows;
  assert.equal(receipt.length,1);assert.equal(receipt[0].metadata.repositorySha,"a".repeat(40));
  await db.exec(`begin;${plan.plan}commit;begin;${plan.verification}commit;`);
  assert.deepEqual((await db.query("select * from public.admin_audit_log where entity_id=$1",[NEWS_SCHEMA_RECEIPT_KEY])).rows,receipt);
  checks.push("second exact apply is idempotent and does not append another receipt");
  await rejectTransaction("changed function definition fails closed",`alter function public.compare_append_literary_news_runtime(text,bigint,jsonb,text,bigint) set statement_timeout='1s';${plan.plan}`);
  await rejectTransaction("changed function owner fails closed",`alter function public.compare_append_literary_news_runtime(text,bigint,jsonb,text,bigint) owner to supabase_admin;${plan.plan}`,/path\/owner missing/);
  await rejectTransaction("broad CAS grant fails closed",`grant execute on function public.compare_append_literary_news_runtime(text,bigint,jsonb,text,bigint) to authenticated;${plan.plan}`,/permission invariant/);
  await rejectTransaction("extra nonstandard role grant fails closed",`create role unexpected_news_grantee;grant execute on function public.compare_append_literary_news_runtime(text,bigint,jsonb,text,bigint) to unexpected_news_grantee;${plan.plan}`,/exact function ACL invariant/);
  await rejectTransaction("grant option escalation fails closed",`grant execute on function public.compare_append_literary_news_runtime(text,bigint,jsonb,text,bigint) to service_role with grant option;${plan.plan}`,/exact function ACL invariant/);
  await rejectTransaction("disabled protection trigger fails closed",`alter table public.admin_audit_log disable trigger protect_literary_news_runtime_log;${plan.plan}`);
  await rejectTransaction("missing runtime index fails closed",`drop index public.admin_audit_literary_news_runtime_key_version;${plan.plan}`);
  await rejectTransaction("receipt hash drift fails closed",`update public.admin_audit_log set metadata=jsonb_set(metadata,'{migrationSha256}','"wrong"') where entity_id='${NEWS_SCHEMA_RECEIPT_KEY}';${plan.plan}`);
  await rejectTransaction("duplicate receipt fails closed",`insert into public.admin_audit_log(action,entity_type,entity_id,metadata)select action,entity_type,entity_id,metadata from public.admin_audit_log where entity_id='${NEWS_SCHEMA_RECEIPT_KEY}';${plan.plan}`);
  await rejectTransaction("rehearsal cannot run against production database identity",plan.rehearsal);
  await db.exec("set role authenticated");
  await assert.rejects(db.exec(`insert into public.admin_audit_log(action,entity_type,entity_id,metadata) values('forged','literary_news_runtime','${NEWS_SCHEMA_RECEIPT_KEY}','{}')`));
  await assert.rejects(db.exec("select public.compare_append_literary_news_runtime('history:forged',null,'{}')"));
  await db.exec("reset role");checks.push("staff cannot forge protected receipt or invoke service CAS");
  await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
  const result=(await db.query("select public.compare_append_literary_news_runtime('heartbeat:local-test',null,'{\"ok\":true}') result")).rows[0].result;
  assert.equal(result.applied,true);checks.push("installed owner/path permits actual service CAS after deployment");
  await db.exec("drop table auth.mfa_factors;drop function auth.jwt();set role supabase_admin");
  await rejectTransaction("non-isolated database rejects rehearsal before creating missing Auth fixtures",plan.rehearsal,/News rehearsal requires isolated restore/);
  assert.deepEqual((await db.query(`select to_regclass('auth.mfa_factors')::text mfa,
    to_regprocedure('auth.jwt()')::text jwt`)).rows[0],{mfa:null,jwt:null});
  await db.exec("reset role");
  // Model the pinned Docker image's old Auth base, not a full GoTrue restore.
  // The real plan runs unchanged against a genuinely named isolated database.
  // PGlite 0.3.x starts fresh data in template1 even with the database option.
  // Create the real database first, then reopen its in-memory cluster snapshot.
  const seed=new PGlite();
  let isolatedData;
  try{await seed.exec("create database probpera_restore");isolatedData=await seed.dumpDataDir("none");}
  finally{await seed.close();}
  const isolated=new PGlite({database:"probpera_restore",loadDataDir:isolatedData});
  try{
    assert.equal((await isolated.query("select current_database() name")).rows[0].name,"probpera_restore");
    await isolated.exec(baseFixture+applicationPrerequisites);
    const authObjects=async()=> (await isolated.query(`select to_regclass('auth.mfa_factors')::text mfa,
      to_regprocedure('auth.jwt()')::text jwt`)).rows[0];
    const identities=(await isolated.query(`select pg_get_functiondef('auth.role()'::regprocedure) role,
      pg_get_functiondef('auth.uid()'::regprocedure) uid`)).rows;
    assert.deepEqual(await authObjects(),{mfa:null,jwt:null});
    for(const [name,sql,error] of [
      ["unchanged production preflight rejects missing Auth platform objects",plan.preflight,/News schema prerequisite missing/],
      ["unchanged production plan rejects missing Auth platform objects",plan.plan,/News schema prerequisite missing/],
      ["rehearsal rejects the wrong current user before creating Auth fixtures",plan.rehearsal,/News rehearsal requires isolated restore/]
    ]){
      await isolated.exec("begin");
      try{await assert.rejects(isolated.exec(sql),error);}finally{await isolated.exec("rollback");}
      assert.deepEqual(await authObjects(),{mfa:null,jwt:null});checks.push(name);
    }
    await isolated.exec("alter role supabase_admin nosuperuser;set role supabase_admin;begin");
    try{await assert.rejects(isolated.exec(plan.rehearsal),/News rehearsal requires isolated restore/);}
    finally{await isolated.exec("rollback;reset role;alter role supabase_admin superuser");}
    assert.deepEqual(await authObjects(),{mfa:null,jwt:null});
    checks.push("rehearsal rejects a non-superuser before creating Auth fixtures");
    await isolated.exec("set role supabase_admin");
    await isolated.exec(`begin;${plan.rehearsal}commit;`);
    await isolated.exec(`begin;${plan.verification}commit;`);
    assert.deepEqual(await authObjects(),{mfa:"auth.mfa_factors",jwt:"auth.jwt()"});
    assert.equal((await isolated.query("select count(*)::int n from auth.mfa_factors")).rows[0].n,0);
    assert.deepEqual((await isolated.query(`select pg_get_functiondef('auth.role()'::regprocedure) role,
      pg_get_functiondef('auth.uid()'::regprocedure) uid`)).rows,identities);
    checks.push("isolated rehearsal creates only missing empty Auth fixtures and preserves role/uid definitions");
    const isolatedReceipt=(await isolated.query("select metadata from public.admin_audit_log where entity_id=$1",[NEWS_SCHEMA_RECEIPT_KEY])).rows;
    assert.equal(isolatedReceipt.length,1);
    await isolated.exec(`begin;${plan.rehearsal}commit;`);
    assert.deepEqual((await isolated.query("select metadata from public.admin_audit_log where entity_id=$1",[NEWS_SCHEMA_RECEIPT_KEY])).rows,isolatedReceipt);
    checks.push("second isolated rehearsal preserves the exact receipt");
    await isolated.exec(`create or replace function auth.jwt() returns jsonb language sql stable as $$select '{"synthetic":"preserve-existing"}'::jsonb$$;
      insert into auth.mfa_factors values('11111111-1111-4111-8111-111111111111','synthetic-only');`);
    const existingJwt=(await isolated.query("select pg_get_functiondef('auth.jwt()'::regprocedure) definition")).rows;
    const existingFactors=(await isolated.query("select * from auth.mfa_factors")).rows;
    await isolated.exec(`begin;${plan.rehearsal}commit;`);
    assert.deepEqual((await isolated.query("select pg_get_functiondef('auth.jwt()'::regprocedure) definition")).rows,existingJwt);
    assert.deepEqual((await isolated.query("select * from auth.mfa_factors")).rows,existingFactors);
    checks.push("existing Auth objects and synthetic factor rows are not replaced or altered");
  }finally{await isolated.close();}
  const report={checkedAt:new Date().toISOString(),engine:"PGlite isolated PostgreSQL",remoteDatabase:false,dockerRestoreExecuted:false,
    workflowDispatched:false,productionApplied:false,authRuntimeAccepted:false,
    rehearsalAuthScope:"minimal empty platform fixtures only; no production Auth data or MFA acceptance",
    passed:checks.length,checks,migration:plan.manifest.migration};
  await mkdir(new URL("../../reports/r10/social/schema-rollout/",import.meta.url),{recursive:true});
  await writeFile(new URL("../../reports/r10/social/schema-rollout/rehearsal-auth-fixture-check.json",import.meta.url),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report));
}finally{await db.close();}
