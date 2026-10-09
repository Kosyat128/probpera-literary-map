-- Bind completed provider checks and pending leases to the effective runtime
-- configuration. The existing row, history, cooldown and staff-read policy stay
-- authoritative; historical migrations and unrelated translation jobs remain.
begin;

create or replace function probpera_translation_operations.self_test_model_valid(p_model text)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare utf16_length integer;
begin
  if p_model is null or char_length(p_model) not between 1 and 200
    or p_model<>btrim(p_model,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
    or p_model ~ U&'[\0001-\001F\007F]' then return false; end if;
  -- JavaScript's string length counts each astral code point as two UTF16 units.
  select char_length(p_model)+count(*) filter(where ascii(character)>65535)
  into utf16_length from regexp_split_to_table(p_model,'') characters(character);
  return utf16_length between 1 and 200;
end; $$;

create or replace function probpera_translation_operations.self_test_configuration_identity(p_configuration jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare fingerprint text;
begin
  if p_configuration is null or jsonb_typeof(p_configuration) is distinct from 'object'
    or octet_length(p_configuration::text)>8192
    or not (p_configuration ?& array['version','provider','model','reviewerModel','twoPassReview',
      'translatorReasoningEffort','translatorReasoningMode','reviewerReasoningEffort','reviewerReasoningMode','promptFingerprint'])
    or p_configuration-array['version','provider','model','reviewerModel','twoPassReview',
      'translatorReasoningEffort','translatorReasoningMode','reviewerReasoningEffort','reviewerReasoningMode','promptFingerprint']<>'{}'::jsonb
    or jsonb_typeof(p_configuration->'version') is distinct from 'number'
    or p_configuration->>'version'<>'1'
    or jsonb_typeof(p_configuration->'provider') is distinct from 'string'
    or p_configuration->>'provider' not in ('cloudflare','openai')
    or jsonb_typeof(p_configuration->'model') is distinct from 'string'
    or not probpera_translation_operations.self_test_model_valid(p_configuration->>'model')
    or jsonb_typeof(p_configuration->'reviewerModel') is distinct from 'string'
    or not probpera_translation_operations.self_test_model_valid(p_configuration->>'reviewerModel')
    or jsonb_typeof(p_configuration->'twoPassReview') is distinct from 'boolean'
    or jsonb_typeof(p_configuration->'translatorReasoningEffort') is distinct from 'string'
    or p_configuration->>'translatorReasoningEffort' not in ('none','low','medium','high','xhigh','max')
    or jsonb_typeof(p_configuration->'reviewerReasoningEffort') is distinct from 'string'
    or p_configuration->>'reviewerReasoningEffort' not in ('none','low','medium','high','xhigh','max')
    or jsonb_typeof(p_configuration->'translatorReasoningMode') is distinct from 'string'
    or p_configuration->>'translatorReasoningMode' not in ('standard','pro')
    or jsonb_typeof(p_configuration->'reviewerReasoningMode') is distinct from 'string'
    or p_configuration->>'reviewerReasoningMode' not in ('standard','pro')
    or jsonb_typeof(p_configuration->'promptFingerprint') is distinct from 'string'
    or (p_configuration->>'promptFingerprint') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid translation self-test configuration' using errcode='22023';
  end if;
  -- Array order and JSONB's comma-space encoding also define the client digest.
  fingerprint:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_array(
    1,p_configuration->>'provider',p_configuration->>'model',p_configuration->>'reviewerModel',
    (p_configuration->>'twoPassReview')::boolean,p_configuration->>'translatorReasoningEffort',
    p_configuration->>'translatorReasoningMode',p_configuration->>'reviewerReasoningEffort',
    p_configuration->>'reviewerReasoningMode',p_configuration->>'promptFingerprint')::text,'UTF8')),'hex');
  return jsonb_build_object('configuration',p_configuration,'fingerprint',fingerprint);
end; $$;

-- Built-in-only CHECK predicates preserve the pre-existing service-role table
-- privileges: PostgreSQL checks a user function's EXECUTE ACL even for NULL
-- legacy identities. No validator EXECUTE or private-schema USAGE is granted.
alter table public.translation_provider_self_tests
  add column configuration_identity jsonb,
  add column lease_context jsonb,
  add constraint translation_provider_self_test_configuration_identity_check check (
    configuration_identity is null or (
      jsonb_typeof((configuration_identity))='object'
      and (configuration_identity) ?& array['configuration','fingerprint']
      and (configuration_identity)-array['configuration','fingerprint']='{}'::jsonb
      and jsonb_typeof((configuration_identity)->'fingerprint')='string'
      and ((configuration_identity)->>'fingerprint') ~ '^[0-9a-f]{64}$'
      and jsonb_typeof(((configuration_identity)->'configuration'))='object'
      and octet_length(((configuration_identity)->'configuration')::text)<=8192
      and ((configuration_identity)->'configuration') ?& array['version','provider','model','reviewerModel','twoPassReview','translatorReasoningEffort','translatorReasoningMode','reviewerReasoningEffort','reviewerReasoningMode','promptFingerprint']
      and ((configuration_identity)->'configuration')-array['version','provider','model','reviewerModel','twoPassReview','translatorReasoningEffort','translatorReasoningMode','reviewerReasoningEffort','reviewerReasoningMode','promptFingerprint']='{}'::jsonb
      and jsonb_typeof(((configuration_identity)->'configuration')->'version')='number'
      and ((configuration_identity)->'configuration')->>'version'='1'
      and jsonb_typeof(((configuration_identity)->'configuration')->'provider')='string'
      and ((configuration_identity)->'configuration')->>'provider' in ('cloudflare','openai')
      and (((configuration_identity)->'configuration')->>'provider') is not distinct from provider
      and jsonb_typeof(((configuration_identity)->'configuration')->'model')='string'
      and char_length((((configuration_identity)->'configuration')->>'model')) between 1 and 200
      and (((configuration_identity)->'configuration')->>'model')=btrim((((configuration_identity)->'configuration')->>'model'),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
      and (((configuration_identity)->'configuration')->>'model') !~ U&'[\0001-\001F\007F]'
      and (char_length((((configuration_identity)->'configuration')->>'model'))+char_length(regexp_replace((((configuration_identity)->'configuration')->>'model'),U&'[\0001-\FFFF]','','g'))) between 1 and 200
      and jsonb_typeof(((configuration_identity)->'configuration')->'reviewerModel')='string'
      and char_length((((configuration_identity)->'configuration')->>'reviewerModel')) between 1 and 200
      and (((configuration_identity)->'configuration')->>'reviewerModel')=btrim((((configuration_identity)->'configuration')->>'reviewerModel'),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
      and (((configuration_identity)->'configuration')->>'reviewerModel') !~ U&'[\0001-\001F\007F]'
      and (char_length((((configuration_identity)->'configuration')->>'reviewerModel'))+char_length(regexp_replace((((configuration_identity)->'configuration')->>'reviewerModel'),U&'[\0001-\FFFF]','','g'))) between 1 and 200
      and (((configuration_identity)->'configuration')->>'model') is not distinct from model
      and jsonb_typeof(((configuration_identity)->'configuration')->'twoPassReview')='boolean'
      and jsonb_typeof(((configuration_identity)->'configuration')->'translatorReasoningEffort')='string'
      and ((configuration_identity)->'configuration')->>'translatorReasoningEffort' in ('none','low','medium','high','xhigh','max')
      and jsonb_typeof(((configuration_identity)->'configuration')->'translatorReasoningMode')='string'
      and ((configuration_identity)->'configuration')->>'translatorReasoningMode' in ('standard','pro')
      and jsonb_typeof(((configuration_identity)->'configuration')->'reviewerReasoningEffort')='string'
      and ((configuration_identity)->'configuration')->>'reviewerReasoningEffort' in ('none','low','medium','high','xhigh','max')
      and jsonb_typeof(((configuration_identity)->'configuration')->'reviewerReasoningMode')='string'
      and ((configuration_identity)->'configuration')->>'reviewerReasoningMode' in ('standard','pro')
      and jsonb_typeof(((configuration_identity)->'configuration')->'promptFingerprint')='string'
      and ((configuration_identity)->'configuration')->>'promptFingerprint' ~ '^[0-9a-f]{64}$'
      and ((configuration_identity)->>'fingerprint') is not distinct from pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_array(
        1,
        ((configuration_identity)->'configuration')->>'provider',
        ((configuration_identity)->'configuration')->>'model',
        ((configuration_identity)->'configuration')->>'reviewerModel',
        (((configuration_identity)->'configuration')->>'twoPassReview')::boolean,
        ((configuration_identity)->'configuration')->>'translatorReasoningEffort',
        ((configuration_identity)->'configuration')->>'translatorReasoningMode',
        ((configuration_identity)->'configuration')->>'reviewerReasoningEffort',
        ((configuration_identity)->'configuration')->>'reviewerReasoningMode',
        ((configuration_identity)->'configuration')->>'promptFingerprint'
      )::text,'UTF8')),'hex')
    )
  ),
  add constraint translation_provider_self_test_lease_context_check check (
    lease_context is null or (
      test_in_progress
      and jsonb_typeof(lease_context)='object'
      and lease_context ?& array['configurationIdentity','configured','bindingFound','actorId']
      and lease_context-array['configurationIdentity','configured','bindingFound','actorId']='{}'::jsonb
      and jsonb_typeof(lease_context->'configured')='boolean'
      and jsonb_typeof(lease_context->'bindingFound')='boolean'
      and jsonb_typeof(lease_context->'actorId')='string'
      and (lease_context->>'actorId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and jsonb_typeof((lease_context->'configurationIdentity'))='object'
      and (lease_context->'configurationIdentity') ?& array['configuration','fingerprint']
      and (lease_context->'configurationIdentity')-array['configuration','fingerprint']='{}'::jsonb
      and jsonb_typeof((lease_context->'configurationIdentity')->'fingerprint')='string'
      and ((lease_context->'configurationIdentity')->>'fingerprint') ~ '^[0-9a-f]{64}$'
      and jsonb_typeof(((lease_context->'configurationIdentity')->'configuration'))='object'
      and octet_length(((lease_context->'configurationIdentity')->'configuration')::text)<=8192
      and ((lease_context->'configurationIdentity')->'configuration') ?& array['version','provider','model','reviewerModel','twoPassReview','translatorReasoningEffort','translatorReasoningMode','reviewerReasoningEffort','reviewerReasoningMode','promptFingerprint']
      and ((lease_context->'configurationIdentity')->'configuration')-array['version','provider','model','reviewerModel','twoPassReview','translatorReasoningEffort','translatorReasoningMode','reviewerReasoningEffort','reviewerReasoningMode','promptFingerprint']='{}'::jsonb
      and jsonb_typeof(((lease_context->'configurationIdentity')->'configuration')->'version')='number'
      and ((lease_context->'configurationIdentity')->'configuration')->>'version'='1'
      and jsonb_typeof(((lease_context->'configurationIdentity')->'configuration')->'provider')='string'
      and ((lease_context->'configurationIdentity')->'configuration')->>'provider' in ('cloudflare','openai')
      and (((lease_context->'configurationIdentity')->'configuration')->>'provider') is not distinct from provider
      and jsonb_typeof(((lease_context->'configurationIdentity')->'configuration')->'model')='string'
      and char_length((((lease_context->'configurationIdentity')->'configuration')->>'model')) between 1 and 200
      and (((lease_context->'configurationIdentity')->'configuration')->>'model')=btrim((((lease_context->'configurationIdentity')->'configuration')->>'model'),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
      and (((lease_context->'configurationIdentity')->'configuration')->>'model') !~ U&'[\0001-\001F\007F]'
      and (char_length((((lease_context->'configurationIdentity')->'configuration')->>'model'))+char_length(regexp_replace((((lease_context->'configurationIdentity')->'configuration')->>'model'),U&'[\0001-\FFFF]','','g'))) between 1 and 200
      and jsonb_typeof(((lease_context->'configurationIdentity')->'configuration')->'reviewerModel')='string'
      and char_length((((lease_context->'configurationIdentity')->'configuration')->>'reviewerModel')) between 1 and 200
      and (((lease_context->'configurationIdentity')->'configuration')->>'reviewerModel')=btrim((((lease_context->'configurationIdentity')->'configuration')->>'reviewerModel'),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
      and (((lease_context->'configurationIdentity')->'configuration')->>'reviewerModel') !~ U&'[\0001-\001F\007F]'
      and (char_length((((lease_context->'configurationIdentity')->'configuration')->>'reviewerModel'))+char_length(regexp_replace((((lease_context->'configurationIdentity')->'configuration')->>'reviewerModel'),U&'[\0001-\FFFF]','','g'))) between 1 and 200
      and jsonb_typeof(((lease_context->'configurationIdentity')->'configuration')->'twoPassReview')='boolean'
      and jsonb_typeof(((lease_context->'configurationIdentity')->'configuration')->'translatorReasoningEffort')='string'
      and ((lease_context->'configurationIdentity')->'configuration')->>'translatorReasoningEffort' in ('none','low','medium','high','xhigh','max')
      and jsonb_typeof(((lease_context->'configurationIdentity')->'configuration')->'translatorReasoningMode')='string'
      and ((lease_context->'configurationIdentity')->'configuration')->>'translatorReasoningMode' in ('standard','pro')
      and jsonb_typeof(((lease_context->'configurationIdentity')->'configuration')->'reviewerReasoningEffort')='string'
      and ((lease_context->'configurationIdentity')->'configuration')->>'reviewerReasoningEffort' in ('none','low','medium','high','xhigh','max')
      and jsonb_typeof(((lease_context->'configurationIdentity')->'configuration')->'reviewerReasoningMode')='string'
      and ((lease_context->'configurationIdentity')->'configuration')->>'reviewerReasoningMode' in ('standard','pro')
      and jsonb_typeof(((lease_context->'configurationIdentity')->'configuration')->'promptFingerprint')='string'
      and ((lease_context->'configurationIdentity')->'configuration')->>'promptFingerprint' ~ '^[0-9a-f]{64}$'
      and ((lease_context->'configurationIdentity')->>'fingerprint') is not distinct from pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_array(
        1,
        ((lease_context->'configurationIdentity')->'configuration')->>'provider',
        ((lease_context->'configurationIdentity')->'configuration')->>'model',
        ((lease_context->'configurationIdentity')->'configuration')->>'reviewerModel',
        (((lease_context->'configurationIdentity')->'configuration')->>'twoPassReview')::boolean,
        ((lease_context->'configurationIdentity')->'configuration')->>'translatorReasoningEffort',
        ((lease_context->'configurationIdentity')->'configuration')->>'translatorReasoningMode',
        ((lease_context->'configurationIdentity')->'configuration')->>'reviewerReasoningEffort',
        ((lease_context->'configurationIdentity')->'configuration')->>'reviewerReasoningMode',
        ((lease_context->'configurationIdentity')->'configuration')->>'promptFingerprint'
      )::text,'UTF8')),'hex')
    )
  );

create or replace function probpera_translation_operations.begin_provider_config_self_test(
  p_configuration jsonb,p_configured boolean,p_binding_found boolean,p_cooldown_seconds integer default 300
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=(select auth.uid()); identity jsonb; provider_id text;
  probe public.translation_provider_self_tests%rowtype;
  token uuid:=gen_random_uuid(); cooldown integer:=greatest(60,least(coalesce(p_cooldown_seconds,300),1800));
begin
  if actor_id is null or not public.is_staff() then
    raise exception 'translation self-test requires staff access' using errcode='42501';
  end if;
  identity:=probpera_translation_operations.self_test_configuration_identity(p_configuration);
  if p_configured is null or p_binding_found is null then
    raise exception 'invalid translation self-test readiness' using errcode='22023';
  end if;
  provider_id:=p_configuration->>'provider';
  insert into public.translation_provider_self_tests(provider) values(provider_id) on conflict(provider) do nothing;
  select * into probe from public.translation_provider_self_tests where provider=provider_id for update;
  if probe.cooldown_until is not null and probe.cooldown_until>now() then
    raise exception 'translation self-test cooldown is active' using errcode='55000';
  end if;
  if probe.test_in_progress and probe.lease_expires_at>now() then
    raise exception 'translation self-test is already running' using errcode='55000';
  end if;
  -- Completed model, readiness, actor, result and timestamp are historical data.
  update public.translation_provider_self_tests
  set test_in_progress=true,lease_token=token,lease_expires_at=now()+interval '5 minutes',
    cooldown_until=now()+make_interval(secs=>cooldown),
    lease_context=jsonb_build_object('configurationIdentity',identity,'configured',p_configured,
      'bindingFound',p_binding_found,'actorId',actor_id),updated_at=now()
  where provider=provider_id returning * into probe;
  return jsonb_build_object('provider',provider_id,'configuration',p_configuration,
    'configurationFingerprint',identity->>'fingerprint','leaseToken',probe.lease_token,
    'leaseExpiresAt',probe.lease_expires_at,'cooldownUntil',probe.cooldown_until,
    'configured',p_configured,'bindingFound',p_binding_found);
end; $$;

create or replace function probpera_translation_operations.finish_provider_config_self_test(
  p_configuration jsonb,p_lease_token uuid,p_configured boolean,p_binding_found boolean,p_test_passed boolean,
  p_model text,p_reviewer_model text,p_latency_ms integer,p_error_code text default null
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=(select auth.uid()); identity jsonb; provider_id text;
  probe public.translation_provider_self_tests%rowtype;
begin
  if actor_id is null or not public.is_staff() then
    raise exception 'translation self-test completion requires staff access' using errcode='42501';
  end if;
  identity:=probpera_translation_operations.self_test_configuration_identity(p_configuration);
  if p_lease_token is null or p_configured is null or p_binding_found is null or p_test_passed is null
    or p_latency_ms is null or p_latency_ms not between 0 and 3600000
    or p_model is distinct from p_configuration->>'model'
    or (p_reviewer_model is not null and p_reviewer_model is distinct from p_configuration->>'reviewerModel')
    or (p_test_passed and (not p_configured or not p_binding_found or p_error_code is not null
      or p_reviewer_model is distinct from p_configuration->>'reviewerModel'))
    or (not p_test_passed and (p_error_code is null or p_error_code not in (
      'translation_not_configured','provider_unavailable','provider_request_failed','provider_invalid_response','unexpected'))) then
    raise exception 'invalid translation self-test completion' using errcode='22023';
  end if;
  provider_id:=p_configuration->>'provider';
  select * into probe from public.translation_provider_self_tests where provider=provider_id for update;
  if not found or not probe.test_in_progress or probe.lease_token is distinct from p_lease_token
    or probe.lease_expires_at is null or probe.lease_expires_at<=now()
    or probe.lease_context is null
    or probe.lease_context->'configurationIdentity' is distinct from identity
    or probe.lease_context->>'actorId' is distinct from actor_id::text
    or probe.lease_context->'configured' is distinct from to_jsonb(p_configured)
    or probe.lease_context->'bindingFound' is distinct from to_jsonb(p_binding_found) then
    raise exception 'translation self-test lease is not valid' using errcode='42501';
  end if;
  update public.translation_provider_self_tests
  set configured=p_configured,binding_found=p_binding_found,test_passed=p_test_passed,
    model=p_model,latency_ms=p_latency_ms,last_error_code=p_error_code,last_test_at=now(),
    configuration_identity=identity,test_in_progress=false,lease_token=null,lease_expires_at=null,
    lease_context=null,tested_by=actor_id,updated_at=now()
  where provider=provider_id returning * into probe;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(actor_id,'translation.provider.self_tested','translation_provider',provider_id,
    jsonb_build_object('configured',probe.configured,'bindingFound',probe.binding_found,'testPassed',probe.test_passed,
      'model',probe.model,'reviewerModel',p_reviewer_model,'configurationFingerprint',identity->>'fingerprint',
      'latencyMs',probe.latency_ms,'errorCode',probe.last_error_code));
  return jsonb_build_object('provider',provider_id,'configurationFingerprint',identity->>'fingerprint',
    'leaseToken',p_lease_token,'probe',jsonb_build_object(
      'provider',probe.provider,'configured',probe.configured,'binding_found',probe.binding_found,
      'test_passed',probe.test_passed,'model',probe.model,'latency_ms',probe.latency_ms,
      'last_error_code',probe.last_error_code,'last_test_at',probe.last_test_at,
      'cooldown_until',probe.cooldown_until,'test_in_progress',probe.test_in_progress,
      'configuration_identity',probe.configuration_identity));
end; $$;

create or replace function public.begin_translation_provider_config_self_test(
  p_configuration jsonb,p_configured boolean,p_binding_found boolean,p_cooldown_seconds integer default 300
)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.begin_provider_config_self_test(p_configuration,p_configured,p_binding_found,p_cooldown_seconds);

create or replace function public.finish_translation_provider_config_self_test(
  p_configuration jsonb,p_lease_token uuid,p_configured boolean,p_binding_found boolean,p_test_passed boolean,
  p_model text,p_reviewer_model text,p_latency_ms integer,p_error_code text default null
)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.finish_provider_config_self_test(p_configuration,p_lease_token,p_configured,p_binding_found,
  p_test_passed,p_model,p_reviewer_model,p_latency_ms,p_error_code);

-- Legacy signatures and grants satisfy the existing operations capability
-- contract, but cannot create or finish a configuration-free provider check.
create or replace function public.begin_translation_provider_self_test(
  p_provider text,p_configured boolean,p_binding_found boolean,p_model text,p_cooldown_seconds integer default 300
)
returns uuid language plpgsql volatile security invoker set search_path='' as $$
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception 'translation self-test requires staff access' using errcode='42501';
  end if;
  raise exception 'configuration-bound translation self-test is required' using errcode='0A000';
end; $$;

create or replace function public.finish_translation_provider_self_test(
  p_provider text,p_lease_token uuid,p_configured boolean,p_binding_found boolean,p_test_passed boolean,
  p_model text,p_latency_ms integer,p_error_code text default null
)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception 'translation self-test completion requires staff access' using errcode='42501';
  end if;
  raise exception 'configuration-bound translation self-test is required' using errcode='0A000';
end; $$;

revoke all on function probpera_translation_operations.self_test_configuration_identity(jsonb) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.self_test_model_valid(text) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.begin_provider_config_self_test(jsonb,boolean,boolean,integer) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.finish_provider_config_self_test(jsonb,uuid,boolean,boolean,boolean,text,text,integer,text) from public,anon,authenticated,service_role;
revoke all on function public.begin_translation_provider_config_self_test(jsonb,boolean,boolean,integer) from public,anon,authenticated,service_role;
revoke all on function public.finish_translation_provider_config_self_test(jsonb,uuid,boolean,boolean,boolean,text,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function probpera_translation_operations.begin_provider_config_self_test(jsonb,boolean,boolean,integer) to authenticated;
grant execute on function probpera_translation_operations.finish_provider_config_self_test(jsonb,uuid,boolean,boolean,boolean,text,text,integer,text) to authenticated;
grant execute on function public.begin_translation_provider_config_self_test(jsonb,boolean,boolean,integer) to authenticated;
grant execute on function public.finish_translation_provider_config_self_test(jsonb,uuid,boolean,boolean,boolean,text,text,integer,text) to authenticated;

commit;
