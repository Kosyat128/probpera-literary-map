import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const NEWS_RUNTIME_MIGRATION = Object.freeze({ filename:"20260926_literary_news_runtime_cas.sql",
  sha256:"4a097df7cadca82b59f1685d730aca7f8afe40704cabc409d5cf20ac8c54c402" });
export const NEWS_SCHEMA_RECEIPT_KEY = "history:schema:20260926_literary_news_runtime_cas";
const functions = ["protect_literary_news_runtime_log()", "compare_append_literary_news_runtime(text,bigint,jsonb,text,bigint)",
  "operate_literary_news_runtime(text,bigint,text,text,text,text,boolean)"];
const names = functions.map(name=>name.split("(")[0]);
const literal = value=>`'${value.replaceAll("'","''")}'`;
const oids = `array[${functions.map(name=>`to_regprocedure('public.${name}')`).join(",")}]`;
const effectiveAcl = `(select jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable)
  order by case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable)
  from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)`;
// Supabase default privileges differ from a --no-privileges restore. Limit the
// new functions to their reviewed callers before recording one reproducible ACL.
const normalizeAcl = `do $news_acl$ begin
  if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.oid=any(${oids}) and a.grantee<>0 and pg_get_userbyid(a.grantee) not in ('postgres','anon','authenticated','service_role')) then
    raise exception 'Unexpected news function ACL role';
  end if;
end; $news_acl$;
${functions.map(name=>`revoke all on function public.${name} from public,anon,authenticated,service_role;`).join("\n")}
grant execute on function public.${functions[0]} to public;
grant execute on function public.${functions[1]} to service_role;
grant execute on function public.${functions[2]} to authenticated;`;
const receiptWhere = `entity_type='literary_news_runtime' and entity_id='${NEWS_SCHEMA_RECEIPT_KEY}'`;
const receipt = `(select metadata from public.admin_audit_log where ${receiptWhere} order by id desc limit 1)`;
const objectsExist = `(exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname=any(array[${names.map(literal).join(",")}]))
  or to_regclass('public.admin_audit_literary_news_runtime_key_version') is not null
  or exists(select 1 from pg_trigger where tgrelid='public.admin_audit_log'::regclass and tgname='protect_literary_news_runtime_log'))`;
const fingerprint = `encode(sha256(convert_to(jsonb_build_object(
  'functions',(select jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner),${effectiveAcl}) order by p.proname) from pg_proc p where p.oid=any(${oids})),
  'index',(select pg_get_indexdef(indexrelid) from pg_index where indexrelid=to_regclass('public.admin_audit_literary_news_runtime_key_version')),
  'trigger',(select jsonb_build_array(pg_get_triggerdef(oid),tgenabled) from pg_trigger where tgrelid='public.admin_audit_log'::regclass and tgname='protect_literary_news_runtime_log')
  )::text,'UTF8')),'hex')`;

const prerequisites = `do $news_prerequisites$ begin
  if to_regclass('public.admin_audit_log') is null or to_regclass('public.probpera_schema_migrations') is null
    or to_regclass('public.public_build_outbox') is null or to_regprocedure('public.get_editorial_schema_health()') is null
    or to_regclass('auth.users') is null or to_regclass('auth.mfa_factors') is null
    or to_regprocedure('auth.role()') is null or to_regprocedure('auth.uid()') is null or to_regprocedure('auth.jwt()') is null
    or to_regprocedure('public.is_staff(public.staff_role[])') is null then
    raise exception 'News schema prerequisite missing';
  end if;
  if current_user not in ('postgres','supabase_admin')
    or not exists(select 1 from pg_roles where rolname='service_role')
    or not exists(select 1 from pg_class where oid='public.admin_audit_log'::regclass and relrowsecurity)
    or (select count(*) from information_schema.columns where table_schema='public' and table_name='admin_audit_log'
      and (column_name,udt_name) in (('id','int8'),('actor_id','uuid'),('action','text'),('entity_type','text'),('entity_id','text'),('metadata','jsonb'),('created_at','timestamptz'))) <> 7
    or not has_table_privilege('postgres','public.admin_audit_log','SELECT,INSERT') then
    raise exception 'News schema audit/owner prerequisite invalid';
  end if;
end; $news_prerequisites$;`;

const health = `do $news_health$
declare f regprocedure;
begin
  if (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname=any(array[${names.map(literal).join(",")}]))<>3 then
    raise exception 'News function set incomplete or overloaded';
  end if;
  foreach f in array ${oids} loop
    if f is null or not exists(select 1 from pg_proc where oid=f and proconfig @> array['search_path=public, pg_temp'] and proowner='postgres'::regrole) then
      raise exception 'News fixed function path/owner missing';
    end if;
  end loop;
  if (select count(*) from pg_proc where oid=any(${oids}) and prosecdef)<>2
    or has_function_privilege('anon','public.${functions[1]}','EXECUTE')
    or has_function_privilege('authenticated','public.${functions[1]}','EXECUTE')
    or not has_function_privilege('service_role','public.${functions[1]}','EXECUTE')
    or has_function_privilege('anon','public.${functions[2]}','EXECUTE')
    or not has_function_privilege('authenticated','public.${functions[2]}','EXECUTE') then
    raise exception 'News RPC permission invariant failed';
  end if;
  if exists(select 1 from pg_proc p where p.oid=any(${oids}) and ${effectiveAcl} is distinct from
    case p.proname
      when '${names[0]}' then '[["PUBLIC","EXECUTE",false],["postgres","EXECUTE",false]]'::jsonb
      when '${names[1]}' then '[["postgres","EXECUTE",false],["service_role","EXECUTE",false]]'::jsonb
      when '${names[2]}' then '[["authenticated","EXECUTE",false],["postgres","EXECUTE",false]]'::jsonb end) then
    raise exception 'News exact function ACL invariant failed';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.admin_audit_log'::regclass
    and tgname='protect_literary_news_runtime_log' and tgfoid='public.${functions[0]}'::regprocedure
    and tgtype=31 and tgenabled='O' and tgnargs=0 and tgqual is null and not tgisinternal) then
    raise exception 'News audit protection trigger invalid';
  end if;
  if not exists(select 1 from pg_index where indexrelid=to_regclass('public.admin_audit_literary_news_runtime_key_version')
    and indrelid='public.admin_audit_log'::regclass and indisvalid and indisready and not indisunique and indnkeyatts=2
    and indkey[0]=(select attnum from pg_attribute where attrelid='public.admin_audit_log'::regclass and attname='entity_id')
    and indkey[1]=(select attnum from pg_attribute where attrelid='public.admin_audit_log'::regclass and attname='id')
    and (indoption[1] & 1)=1 and pg_get_expr(indpred,indrelid)='(entity_type = ''literary_news_runtime''::text)') then
    raise exception 'News runtime index invalid';
  end if;
end; $news_health$;`;

const drift = `do $news_drift$
declare saved jsonb; receipt_count bigint;
begin
  select count(*) into receipt_count from public.admin_audit_log where ${receiptWhere};
  saved := ${receipt};
  if receipt_count<>1 or saved->>'migrationSha256' is distinct from '${NEWS_RUNTIME_MIGRATION.sha256}'
    or saved->>'version' is distinct from '${NEWS_RUNTIME_MIGRATION.filename.slice(0,-4)}'
    or coalesce(saved->>'repositorySha','') !~ '^[0-9a-f]{40}$'
    or saved->>'schemaSha256' is distinct from ${fingerprint} then
    raise exception 'News schema receipt or definition drift';
  end if;
end; $news_drift$;`;

const preflightGuard = `${prerequisites}
do $news_existing$ begin
  if not exists(select 1 from public.admin_audit_log where ${receiptWhere}) then
    if ${objectsExist} then raise exception 'Unreceipted news schema exists'; end if;
  else
    execute ${literal(health)};
    execute ${literal(drift)};
  end if;
end; $news_existing$;`;

export function buildLiteraryNewsSchemaPlan({ root=process.cwd(),repositorySha,migrationSha=NEWS_RUNTIME_MIGRATION.sha256,source }={}) {
  if(!/^[a-f0-9]{40}$/.test(repositorySha||""))throw new Error("Exact lowercase repository SHA required");
  const sql=(source??readFileSync(path.join(root,"supabase/migrations",NEWS_RUNTIME_MIGRATION.filename),"utf8")).replace(/\r\n?/g,"\n");
  if(migrationSha!==NEWS_RUNTIME_MIGRATION.sha256 || createHash("sha256").update(sql).digest("hex")!==migrationSha)
    throw new Error("Reviewed news migration SHA-256 mismatch");
  const controls="set local lock_timeout='15s';\nset local statement_timeout='5min';\nset local idle_in_transaction_session_timeout='5min';";
  const preflight=`set transaction read only;\n${controls}\n${preflightGuard}\nselect 'news_schema_preflight=passed';\n`;
  const verification=`set transaction read only;\n${controls}\n${prerequisites}\n${health}\n${drift}\nselect 'news_schema=verified;receipt=verified;drift=none;destinations_unchanged=true';\n`;
  const plan=`${controls}
select pg_advisory_xact_lock(hashtextextended('probpera-production-database-reconciliation',0));
${preflightGuard}
do $news_apply$
declare result jsonb; original_claim text := current_setting('request.jwt.claim.role',true);
begin
  if not exists(select 1 from public.admin_audit_log where ${receiptWhere}) then
    execute $reviewed_news_sql$${sql}$reviewed_news_sql$;
    ${functions.map(name=>`alter function public.${name} owner to postgres;`).join("\n    ")}
    execute ${literal(normalizeAcl)};
    execute ${literal(health)};
    perform set_config('request.jwt.claim.role','service_role',true);
    result:=public.compare_append_literary_news_runtime('${NEWS_SCHEMA_RECEIPT_KEY}',null,jsonb_build_object(
      'version','${NEWS_RUNTIME_MIGRATION.filename.slice(0,-4)}','migrationSha256','${migrationSha}',
      'repositorySha','${repositorySha}','schemaSha256',${fingerprint},'appliedAt',now(),'scope','schema-only'));
    if result->>'applied' is distinct from 'true' then raise exception 'News schema receipt conflict'; end if;
    perform set_config('request.jwt.claim.role',coalesce(original_claim,''),true);
  end if;
end; $news_apply$;
${health}
${drift}
notify pgrst, 'reload schema';
`;
  // The unchanged safety helper restores public with --no-owner --no-privileges,
  // under its verified isolated superuser. Normalize ONLY that disposable copy.
  const rehearsal=`do $news_restore_only$ begin
  if current_database()<>'probpera_restore' or current_user<>'supabase_admin'
    or not (select rolsuper from pg_roles where rolname=current_user) then raise exception 'News rehearsal requires isolated restore'; end if;
  grant select,insert on public.admin_audit_log to postgres;
  execute 'grant usage,select on sequence ' || pg_get_serial_sequence('public.admin_audit_log','id') || ' to postgres';
  if exists(select 1 from public.admin_audit_log where ${receiptWhere}) then
    ${functions.map(name=>`alter function public.${name} owner to postgres;`).join("\n    ")}
    execute ${literal(normalizeAcl)};
  end if;
end; $news_restore_only$;
${plan}`;
  const digest=value=>createHash("sha256").update(value).digest("hex");
  return {plan,rehearsal,preflight,verification,manifest:{repositorySha,migration:NEWS_RUNTIME_MIGRATION,
    scope:"schema-only",receipt:{table:"public.admin_audit_log",entityType:"literary_news_runtime",key:NEWS_SCHEMA_RECEIPT_KEY},
    newTables:0,destinationBootstrap:false,externalPublication:false,historicalMigrationLedgerChanged:false,
    transaction:"existing safety helper psql --single-transaction",hashEncoding:"UTF-8, LF-normalized migration bytes",
    planSha256:digest(plan),rehearsalSha256:digest(rehearsal),preflightSha256:digest(preflight),verificationSha256:digest(verification)}};
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  if(args.length!==6 || args[0]!=="--repository-sha" || args[2]!=="--migration-sha" || args[4]!=="--output-dir")
    throw new Error("Usage: --repository-sha SHA --migration-sha SHA256 --output-dir DIRECTORY");
  const result=buildLiteraryNewsSchemaPlan({repositorySha:args[1],migrationSha:args[3]});mkdirSync(args[5],{recursive:true});
  for(const name of ["plan","rehearsal","preflight","verification"])writeFileSync(path.join(args[5],`${name}.sql`),result[name]);
  writeFileSync(path.join(args[5],"manifest.json"),JSON.stringify(result.manifest,null,2)+"\n");
}
