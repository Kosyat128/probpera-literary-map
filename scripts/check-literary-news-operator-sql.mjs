import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const modulePath = process.argv.find(arg => arg.startsWith("--pglite="))?.slice(9);
if (!modulePath) throw new Error("Provide --pglite=path; this checker uses only an isolated in-memory database.");
const { PGlite } = await import(pathToFileURL(path.resolve(modulePath)).href);
const db = new PGlite();
const checks = [];
const actor = "11111111-1111-4111-8111-111111111111";
const reason = "Operator verified this attempt against available evidence.";
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create type public.staff_role as enum ('owner','admin','editor');
    create function auth.role() returns text language sql as 'select current_setting(''request.jwt.claim.role'',true)';
    create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create function auth.jwt() returns jsonb language sql as 'select jsonb_build_object(''aal'',current_setting(''test.aal'',true))';
    create table auth.mfa_factors(user_id uuid,status text);
    create function public.is_staff(allowed_roles public.staff_role[]) returns boolean language sql as
      'select coalesce(current_setting(''test.staff_role'',true),'''')=any(allowed_roles::text[])';
    create table public.admin_audit_log(id bigint generated always as identity primary key, actor_id uuid,
      action text not null, entity_type text not null, entity_id text, metadata jsonb not null default '{}');
    grant usage on schema auth to authenticated,service_role;`);
  await db.exec(await readFile(new URL("../supabase/migrations/20260926_literary_news_runtime_cas.sql", import.meta.url), "utf8"));
  const setting = async (key, value) => db.query("select set_config($1,$2,false)", [key, value]);
  await setting("request.jwt.claim.role", "authenticated");
  await setting("request.jwt.claim.sub", actor);
  await setting("test.staff_role", "admin");
  await setting("test.aal", "aal1");
  const seed = async (key, state) => String((await db.query("insert into public.admin_audit_log(action,entity_type,entity_id,metadata) values('fixture','literary_news_runtime',$1,$2::jsonb) returning id", [key, JSON.stringify(state)])).rows[0].id);
  const state = async key => (await db.query("select metadata from public.admin_audit_log where entity_id=$1 order by id desc limit 1", [key])).rows[0].metadata;
  const size = async () => (await db.query("select count(*)::int as n from public.admin_audit_log")).rows[0].n;
  const operate = async (key, version, operation, extra = {}) => (await db.query(
    "select public.operate_literary_news_runtime($1,$2,$3,$4,$5,$6,$7) as result",
    [key, version, operation, extra.reason ?? reason, extra.remoteId ?? null, extra.proofUrl ?? null, extra.verified ?? false]
  )).rows[0].result;
  const destinationKey = "destination:telegram:-10012345";
  const destination = {mode:"off",paused:false,historyReconciled:false,canaryNewsId:"fixed-canary",rights:{canPost:false},nextDueAt:"2099-01-01T00:00:00Z"};
  let version = await seed(destinationKey, destination);

  await setting("request.jwt.claim.sub", "");
  await assert.rejects(operate(destinationKey, version, "pause"), /access required/);
  await setting("request.jwt.claim.sub", actor);
  await setting("test.staff_role", "editor");
  await assert.rejects(operate(destinationKey, version, "pause"), /access required/);
  await setting("test.staff_role", "admin");
  await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')", [actor]);
  await assert.rejects(operate(destinationKey, version, "pause"), /mfa-required/);
  await setting("test.aal", "aal2");
  checks.push("anonymous/editor and enrolled-MFA AAL1 fail closed");
  await db.exec("set role anon");
  await assert.rejects(operate(destinationKey, version, "pause"), /permission denied/);
  await db.exec("reset role; set role authenticated");
  const paused = await operate(destinationKey, version, "pause");
  assert.equal(paused.applied, true);
  await db.exec("reset role");
  const staleCount = await size();
  assert.equal((await operate(destinationKey, version, "resume")).reason, "version_conflict");
  assert.equal(await size(), staleCount);
  version = paused.id;
  assert.equal((await operate(destinationKey, version, "resume")).applied, true);
  const resumed = await state(destinationKey);
  for (const [key,value] of Object.entries(destination)) assert.deepEqual(resumed[key],value);
  assert.equal(resumed.operatorDecision.actorId,actor);
  assert.equal(resumed.operatorDecision.previousVersion,Number(version));
  checks.push("authorized pause/resume CAS preserves mode, history, rights, canary and rate state");
  assert.equal((await operate("destination:vk:-99",version,"pause")).reason,"missing_state");
  await assert.rejects(operate("destination:telegram:@name",version,"pause"));
  await assert.rejects(operate(destinationKey,version,"on"));
  await assert.rejects(operate(destinationKey,version,"pause",{remoteId:"1",proofUrl:"https://bad.test/"}));
  await assert.rejects(operate(destinationKey,version,"pause",{reason:"short"}));
  checks.push("no destination bootstrap, mode enable, extra payload or unbounded reason");

  let sequence = 0;
  const fixture = async extra => {
    const key = `post:news:case-${++sequence}:telegram:-10012345`;
    const record = {newsId:`case-${sequence}`,destination:{platform:"telegram",id:"-10012345"},status:"ambiguous",desiredRevision:"a".repeat(64),originalAdmission:"2026-09-01T00:00:00Z",prepared:{payload:{text:"Exact prepared text."}},dispatchStartedAt:"2026-09-01T00:00:00Z",attemptId:"prior-attempt",runnerId:"prior-runner",...extra};
    return {key,version:await seed(key,record),record};
  };
  let job = await fixture({});
  const proof = {remoteId:"19",proofUrl:"https://t.me/c/12345/19",verified:true};
  assert.equal((await operate(job.key,job.version,"bind_remote",{...proof,verified:false})).applied,false);
  await assert.rejects(operate(job.key,job.version,"bind_remote",{...proof,proofUrl:"https://t.me/c/other/19"}));
  assert.equal((await operate(job.key,job.version,"bind_remote",{...proof,remoteId:"0"})).applied,false);
  const bound = await operate(job.key,job.version,"bind_remote",proof);
  assert.equal(bound.applied,true);
  const boundState = await state(job.key);
  assert.equal(boundState.status,"correction_pending"); assert.equal(boundState.remoteId,"19");
  assert.equal(boundState.remoteUrl,proof.proofUrl); assert.equal(boundState.acknowledgedAt,undefined);
  assert.equal(boundState.dispatchStartedAt,null); assert.equal(boundState.attemptId,null);
  assert.equal(boundState.prepared.payload.text,"Exact prepared text.");
  checks.push("verified exact-channel bind records identity and correction pending, never a fake receipt");

  job=await fixture({remoteId:"18",remoteUrl:"https://t.me/c/12345/18"});
  assert.equal((await operate(job.key,job.version,"bind_remote",proof)).reason,"remote_mismatch");
  assert.equal((await operate(job.key,job.version,"not_sent",{verified:true})).applied,true);
  assert.equal((await state(job.key)).status,"correction_pending");assert.equal((await state(job.key)).remoteId,"18");
  job=await fixture({});
  assert.equal((await operate(job.key,job.version,"not_sent",{verified:false})).applied,false);
  assert.equal((await operate(job.key,job.version,"not_sent",{verified:true})).applied,true);
  assert.equal((await state(job.key)).status,"pending");
  checks.push("not-sent requires explicit evidence and preserves known remote identity");
  for (const extra of [{status:null},{status:"sent_current"},{status:"inflight"},{leaseUntil:"2099-01-01T00:00:00Z"}]) {
    job=await fixture(extra);
    for(const operation of ["not_sent","explicitly_close","bind_remote"])
      assert.equal((await operate(job.key,job.version,operation,operation==="bind_remote"?proof:{verified:true})).applied,false);
  }
  checks.push("missing status, completed records and active attempts cannot be resolved");
  job=await fixture({remoteId:"19",acknowledgedRevision:"b".repeat(64),acknowledgedAt:"2026-09-02T00:00:00Z"});
  const [one,two]=await Promise.all([operate(job.key,job.version,"explicitly_close"),operate(job.key,job.version,"not_sent",{verified:true})]);
  assert.equal([one,two].filter(item=>item.applied).length,1);
  const closed=await state(job.key); assert.equal(closed.remoteId,"19");assert.equal(closed.acknowledgedRevision,"b".repeat(64));
  checks.push("two operator decisions against one version append once and retain remote history");
  const vkKey="post:news:vk-proof:vk:-77";
  version=await seed(vkKey,{destination:{platform:"vk",id:"-77"},status:"ambiguous"});
  assert.equal((await operate(vkKey,version,"bind_remote",{remoteId:"31",proofUrl:"https://vk.com/wall-77_31",verified:true})).applied,true);
  checks.push("VK bind validates a positive post ID and exact negative-community proof URL");
  const receipt={checkedAt:new Date().toISOString(),engine:"isolated PGlite PostgreSQL WASM",remoteDatabase:false,realConcurrentProcesses:false,staffHelper:"public.is_staff(owner/admin)",mfa:"existing verified factor requires aal2",checks,passed:checks.length,deployment:"not_applied"};
  await mkdir(new URL("../reports/r10/social/",import.meta.url),{recursive:true});
  await writeFile(new URL("../reports/r10/social/operator-sql-check.json",import.meta.url),JSON.stringify(receipt,null,2)+"\n");
  console.log(JSON.stringify(receipt));
} finally { await db.close(); }
