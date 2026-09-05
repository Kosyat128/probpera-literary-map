import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DOSSIER_MIGRATION = Object.freeze({
  filename: "20260905_book_dossiers_v2.sql",
  sha256: "825e562a16bea91318e3e043876d5d5912824180837d038cabe68fdd9b66165e",
});
const dependencyVersion = "20260902_literary_work_evidence_v2_attestations";
const dependencySha256 = "26e1e0cb57368c772a02d397e5df0cb2960725a7ad05ae35fbc299ddf41c4966";
const ledger = "public.book_dossier_schema_migrations";
const version = DOSSIER_MIGRATION.filename.replace(/\.sql$/u, "");
const literal = value => `'${value.replaceAll("'", "''")}'`;
const functions = [
  "book_dossier_public_progress_steps(jsonb)",
  "book_dossier_draft_shape_valid(jsonb)", "book_dossier_design_proof_valid(jsonb,jsonb,text)",
  "book_dossier_canonical_json(jsonb)", "book_dossier_content(jsonb)",
  "book_dossier_public_document_valid(jsonb,jsonb)", "save_book_dossier(jsonb,jsonb,bigint)",
  "get_published_book_dossier(jsonb)",
];
const functionOids = `array[${functions.map(name => `to_regprocedure(${literal(`public.${name}`)})`).join(",")} ]`;
const functionFingerprint = `(select public.literary_work_evidence_v2_sha256(string_agg(pg_get_functiondef(oid), E'\\n' order by proname)) from pg_proc where oid = any(${functionOids}))`;

const preflightGuard = `do $dossier_preflight$
declare receipt record;
begin
  if to_regclass('public.probpera_schema_migrations') is null
    or to_regclass('public.literary_works') is null or to_regclass('auth.users') is null
    or to_regprocedure('public.is_staff(public.staff_role[])') is null
    or to_regprocedure('public.literary_work_evidence_v2_sha256(text)') is null then
    raise exception 'Dossier prerequisite schema is missing';
  end if;
  if not exists (select 1 from public.probpera_schema_migrations where version='${dependencyVersion}' and migration_sha256='${dependencySha256}') then
    raise exception 'Reviewed Evidence V2 prerequisite receipt is missing or changed';
  end if;
  if to_regclass('${ledger}') is null then
    if to_regclass('public.book_dossiers') is not null or exists(select 1 from unnest(${functionOids}) f where f is not null) then
      raise exception 'Unreceipted dossier schema exists; explicit investigation required';
    end if;
  else
    execute 'select count(*) as count, min(version) as version, min(migration_sha256) as sha256 from ${ledger}' into receipt;
    if receipt.count <> 1 or receipt.version is distinct from '${version}' or receipt.sha256 is distinct from '${DOSSIER_MIGRATION.sha256}'
      or to_regclass('public.book_dossiers') is null then
      raise exception 'Dossier receipt or schema is inconsistent';
    end if;
  end if;
end; $dossier_preflight$;`;

const healthGuard = `do $dossier_health$
declare f regprocedure; helper text; saved_digest text;
begin
  if (select count(*) from ${ledger} where version='${version}' and migration_sha256='${DOSSIER_MIGRATION.sha256}') <> 1
    or (select count(*) from ${ledger}) <> 1 then raise exception 'Dossier ledger invariant failed'; end if;
  if not exists(select 1 from pg_class where oid='public.book_dossiers'::regclass and relrowsecurity)
    or not exists(select 1 from pg_class where oid='${ledger}'::regclass and relrowsecurity)
    or has_table_privilege('anon','public.book_dossiers','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege('authenticated','public.book_dossiers','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or not has_table_privilege('authenticated','public.book_dossiers','SELECT')
    or has_table_privilege('anon','${ledger}','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege('authenticated','${ledger}','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'Dossier table permission invariant failed';
  end if;
  if (select count(*) from pg_policy where polrelid='public.book_dossiers'::regclass) <> 1
    or not exists(select 1 from pg_policy where polrelid='public.book_dossiers'::regclass and polname='Staff read private book dossiers'
      and polcmd='r' and polroles=array['authenticated'::regrole::oid] and pg_get_expr(polqual,polrelid)='is_staff()') then
    raise exception 'Dossier staff policy invariant failed';
  end if;
  if (select count(*) from information_schema.columns where table_schema='public' and table_name='book_dossiers') <> 7
    or exists(select 1 from pg_index where indrelid='public.book_dossiers'::regclass and not indisvalid) then
    raise exception 'Dossier table shape invariant failed';
  end if;
  foreach f in array ${functionOids} loop
    if f is null or not exists(select 1 from pg_proc where oid=f and proconfig @> array['search_path=""']) then
      raise exception 'Dossier function or fixed search path missing';
    end if;
  end loop;
  foreach helper in array array[${functions.slice(0, -2).map(name => literal(`public.${name}`)).join(",")}] loop
    if has_function_privilege('anon',helper,'EXECUTE') or has_function_privilege('authenticated',helper,'EXECUTE') then
      raise exception 'Private dossier helper is publicly executable';
    end if;
  end loop;
  if has_function_privilege('anon','public.save_book_dossier(jsonb,jsonb,bigint)','EXECUTE')
    or not has_function_privilege('authenticated','public.save_book_dossier(jsonb,jsonb,bigint)','EXECUTE')
    or not has_function_privilege('anon','public.get_published_book_dossier(jsonb)','EXECUTE')
    or not has_function_privilege('authenticated','public.get_published_book_dossier(jsonb)','EXECUTE')
    or (select count(*) from pg_proc where oid=any(${functionOids}) and prosecdef) <> 2 then
    raise exception 'Dossier RPC permission invariant failed';
  end if;
  select functions_sha256 into saved_digest from ${ledger};
  if saved_digest is distinct from ${functionFingerprint} then raise exception 'Dossier function definition drift detected'; end if;
end; $dossier_health$;`;

export function buildBookDossierMigrationPlan({ root = process.cwd(), repositorySha, source } = {}) {
  if (!/^[0-9a-f]{40}$/u.test(repositorySha || "")) throw new Error("Exact lowercase repository SHA required");
  const migration = (source ?? readFileSync(path.join(root, "supabase/migrations", DOSSIER_MIGRATION.filename), "utf8")).replace(/\r\n?/gu, "\n");
  if (createHash("sha256").update(migration).digest("hex") !== DOSSIER_MIGRATION.sha256) throw new Error("Reviewed dossier migration SHA-256 mismatch");
  const controls = "set local lock_timeout='15s';\nset local statement_timeout='5min';";
  const readOnly = `set transaction read only;\n${controls}\n`;
  const preflight = `${readOnly}${preflightGuard}\nselect 'dossier_preflight=passed';\n`;
  const verification = `${readOnly}${preflightGuard}\n${healthGuard}\nselect 'dossier_schema=v2;ledger=verified;rls=verified;rpc=verified;function_drift=none';\n`;
  const plan = `${controls}
set local idle_in_transaction_session_timeout='5min';
select pg_advisory_xact_lock(hashtextextended('probpera-production-database-reconciliation',0));
${preflightGuard}
-- A separate private ledger leaves the reviewed historical 35-migration plan unchanged.
create table if not exists ${ledger} (
  version text primary key, migration_sha256 text not null check(migration_sha256 ~ '^[0-9a-f]{64}$'),
  repository_sha text not null check(repository_sha ~ '^[0-9a-f]{40}$'),
  functions_sha256 text not null check(functions_sha256 ~ '^[0-9a-f]{64}$'), applied_at timestamptz not null default now()
);
alter table ${ledger} enable row level security;
revoke all on ${ledger} from public, anon, authenticated;
do $dossier_apply$
begin
  if not exists(select 1 from ${ledger}) then
    execute $reviewed_dossier_sql$${migration}$reviewed_dossier_sql$;
    insert into ${ledger}(version,migration_sha256,repository_sha,functions_sha256)
      values('${version}','${DOSSIER_MIGRATION.sha256}','${repositorySha}',${functionFingerprint});
  end if;
end; $dossier_apply$;
${healthGuard}
notify pgrst, 'reload schema';
`;
  // The trusted restore drill uses pg_restore --no-privileges. Restore only these
  // known ACLs on its disposable database before rehearsing an already applied plan.
  const rehearsal = `do $restore_acl$
begin
  if to_regclass('${ledger}') is not null and to_regclass('public.book_dossiers') is not null then
    revoke all on public.book_dossiers from public, anon, authenticated;
    grant select on public.book_dossiers to authenticated;
    revoke all on function ${functions.map(name => `public.${name}`).join(",")} from public, anon, authenticated;
    grant execute on function public.save_book_dossier(jsonb,jsonb,bigint) to authenticated;
    grant execute on function public.get_published_book_dossier(jsonb) to anon, authenticated;
  end if;
end; $restore_acl$;
${plan}`;
  return { plan, rehearsal, preflight, verification, manifest: { repositorySha, mode: "schema-only", migration: DOSSIER_MIGRATION, ledger, prerequisite: { version: dependencyVersion, sha256: dependencySha256 }, transaction: "existing safety helper psql --single-transaction", archivePublication: false, rehearsalAclNormalization: "disposable restore only; production plan unchanged" } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--repository-sha" || args[2] !== "--output-dir") throw new Error("Usage: --repository-sha SHA --output-dir DIRECTORY");
  const result = buildBookDossierMigrationPlan({ repositorySha: args[1] });
  mkdirSync(args[3], { recursive: true });
  for (const name of ["plan", "rehearsal", "preflight", "verification"]) writeFileSync(path.join(args[3], `${name}.sql`), result[name]);
  writeFileSync(path.join(args[3], "manifest.json"), `${JSON.stringify(result.manifest, null, 2)}\n`);
}
