-- Native M13 scalar contract. Auth identities and staff membership are isolated
-- fixture data; guarded redirect and row-trigger functions are actual excerpts.
create table public.fixture_seo_scalar_result (result uuid primary key);
grant insert, select on public.fixture_seo_scalar_result to authenticated;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001');
insert into public.staff_memberships(user_id, role)
values ('00000000-0000-4000-8000-000000000001', 'owner');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
do $$
declare procedure_oid regprocedure := 'public.create_seo_redirect_guarded(text,text,smallint,boolean)'::regprocedure;
begin
  if pg_get_function_result(procedure_oid) <> 'uuid'
    or not (select prosecdef from pg_proc where oid=procedure_oid)
    or not (select 'search_path=""'=any(proconfig) from pg_proc where oid=procedure_oid)
    or not has_function_privilege('authenticated',procedure_oid,'EXECUTE')
    or has_function_privilege('anon',procedure_oid,'EXECUTE') then
    raise exception 'effective scalar RPC signature/security/ACL mismatch';
  end if;
  if has_table_privilege('authenticated','public.redirects','INSERT')
    or has_table_privilege('authenticated','public.redirects','UPDATE')
    or has_table_privilege('authenticated','public.redirects','DELETE') then
    raise exception 'direct redirect write guard reopened';
  end if;
end;
$$;
select 'M13_EFFECTIVE_SCALAR_UUID_SIGNATURE_AND_GUARDS_PASS';
insert into public.fixture_seo_scalar_result(result)
select public.create_seo_redirect_guarded('/m13-native-source','/m13-native-destination',301::smallint,true);
-- Inspect committed fixture state as its owner; do not grant audit SELECT.
reset role;

do $$
declare saved uuid := (select result from public.fixture_seo_scalar_result);
begin
  if pg_typeof(saved)::text <> 'uuid' or saved is null
    or (select count(*) from public.redirects) <> 1
    or not exists(select 1 from public.redirects where id=saved
      and source_path='/m13-native-source' and destination_path='/m13-native-destination'
      and status_code=301 and is_active
      and created_by='00000000-0000-4000-8000-000000000001') then
    raise exception 'single canonical redirect does not match actual scalar';
  end if;
  if (select count(*) from public.admin_audit_log) <> 1
    or not exists(select 1 from public.admin_audit_log where entity_id=saved::text
      and entity_type='redirect' and action='redirect.created'
      and actor_id='00000000-0000-4000-8000-000000000001'
      and metadata->>'sourcePath'='/m13-native-source'
      and metadata->>'destinationPath'='/m13-native-destination') then
    raise exception 'transactional audit does not match actual scalar redirect';
  end if;
  if (select count(*) from public.public_build_outbox) <> 1
    or not exists(select 1 from public.public_build_outbox where entity_id=saved::text
      and entity_type='redirects' and reason='database-insert' and status='requested'
      and actor_id='00000000-0000-4000-8000-000000000001'
      and metadata=jsonb_build_object('operation','insert','table','redirects')) then
    raise exception 'actual row-trigger append event does not match scalar redirect';
  end if;
end;
$$;
select 'M13_SINGLE_CANONICAL_REDIRECT_INSERT_PASS';
select 'M13_SINGLE_TRANSACTIONAL_AUDIT_UUID_PASS';
select 'M13_ACTUAL_ROW_TRIGGER_OUTBOX_UUID_PASS';

set role authenticated;
do $$
begin
  begin
    perform public.create_seo_redirect_guarded('/m13-native-source','/m13-native-destination',301::smallint,true);
    raise exception 'guard accepted duplicate canonical source';
  exception when sqlstate 'P0001' then
    if sqlerrm not in ('REDIRECT_COLLISION_OR_CHAIN','REDIRECT_SOURCE_EXISTS') then raise; end if;
  end;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.redirects) <> 1
    or (select count(*) from public.admin_audit_log) <> 1
    or (select count(*) from public.public_build_outbox) <> 1 then
    raise exception 'duplicate refusal appended side effects';
  end if;
end;
$$;
select 'M13_DUPLICATE_REFUSAL_NO_SECOND_SIDE_EFFECT_PASS';
select 'M13_SEO_DB_RESULT_JSON:' || jsonb_build_object(
  'scalar',s.result::text,'pgResultType',pg_typeof(s.result)::text,
  'regprocedureResult',pg_get_function_result('public.create_seo_redirect_guarded(text,text,smallint,boolean)'::regprocedure),
  'actorId',auth.uid(),'sourcePath',r.source_path,'destinationPath',r.destination_path,
  'statusCode',r.status_code,'isActive',r.is_active,
  'canonicalCount',(select count(*) from public.redirects),
  'auditCount',(select count(*) from public.admin_audit_log),
  'outboxCount',(select count(*) from public.public_build_outbox),
  'auditEntityId',(select entity_id from public.admin_audit_log),
  'auditEntityType',(select entity_type from public.admin_audit_log),
  'outboxEntityId',(select entity_id from public.public_build_outbox),
  'outboxEntityType',(select entity_type from public.public_build_outbox),
  'outboxReason',(select reason from public.public_build_outbox),
  'guardDefinitionMd5',md5(pg_get_functiondef('public.create_seo_redirect_guarded(text,text,smallint,boolean)'::regprocedure))
)::text
from public.fixture_seo_scalar_result s join public.redirects r on r.id=s.result;
reset role;
