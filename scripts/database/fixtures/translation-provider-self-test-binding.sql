-- Paired native PostgreSQL fixture: the same bytes execute against the original
-- runtime and the additive configuration-binding migration. Auth claims and
-- fixture clocks are synthetic. No providers, HTTP, external DB or GoTrue run.
call public.fixture_seed();

create table public.fixture_t06_markers(marker text primary key);
create table public.fixture_t06_outputs(label text primary key, payload jsonb not null);
grant select,insert on public.fixture_t06_markers,public.fixture_t06_outputs to authenticated;

create or replace function public.fixture_t06_configuration(p_patch jsonb default '{}'::jsonb)
returns jsonb language sql immutable as $$
select jsonb_build_object('version',1,'provider','cloudflare',
  'model',U&'@cf/fixture/model "RU \2014 EN"','reviewerModel',E'@cf/fixture/repair \\ slot',
  'twoPassReview',true,'translatorReasoningEffort','low','translatorReasoningMode','standard',
  'reviewerReasoningEffort','none','reviewerReasoningMode','standard','promptFingerprint',repeat('1',64))||p_patch;
$$;

create or replace function public.fixture_t06_error(p_query text,p_state text)
returns void language plpgsql security invoker as $$
declare rejected boolean:=false;
begin
  begin execute p_query;
  exception when others then
    if sqlstate<>p_state then raise exception 'T06 expected SQLSTATE %, got %: %',p_state,sqlstate,sqlerrm; end if;
    rejected:=true;
  end;
  perform public.fixture_assert(rejected,'T06 required rejection: '||p_state);
end; $$;

-- Privileged observation/clock controls are fixture-only. They do not authorize
-- the RPC calls, which execute as actual authenticated/anon/service_role roles.
create or replace function public.fixture_t06_observation(p_provider text)
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('probe',(select to_jsonb(p) from public.translation_provider_self_tests p where provider=p_provider),
  'audit',(select count(*) from public.admin_audit_log));
$$;
create or replace function public.fixture_t06_clock(p_provider text,p_expire_lease boolean default true,p_expire_cooldown boolean default true)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.translation_provider_self_tests
  set cooldown_until=case when p_expire_cooldown then now()-interval '1 second' else cooldown_until end,
    lease_expires_at=case when p_expire_lease and test_in_progress then now()-interval '1 second' else lease_expires_at end
  where provider=p_provider;
end; $$;

set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$
declare ru_at timestamptz; en_at timestamptz;
begin
  select updated_at into ru_at from public.articles where id='00000000-0000-4000-8000-000000000101';
  select updated_at into en_at from public.article_translations where article_id='00000000-0000-4000-8000-000000000101' and locale='en';
  perform * from public.save_article_bundle('00000000-0000-4000-8000-000000000101',ru_at,public.fixture_payload(),
    'save',public.fixture_english(),en_at);
  insert into public.fixture_t06_outputs(label,payload)
  values('author-before',public.fixture_observation('00000000-0000-4000-8000-000000000101')-'audit');
end; $$;

do $$
declare token uuid; initial jsonb; retargeted jsonb; receipt jsonb;
begin
  token:=public.begin_translation_provider_self_test('cloudflare',true,true,'fixture-model-A',60);
  perform public.finish_translation_provider_self_test('cloudflare',token,true,true,true,'fixture-model-A',17,null);
  initial:=public.fixture_t06_observation('cloudflare');
  perform public.fixture_t06_clock('cloudflare');
  token:=public.begin_translation_provider_self_test('cloudflare',true,true,'fixture-model-B',60);
  retargeted:=public.fixture_t06_observation('cloudflare');
  perform public.fixture_assert(retargeted->'probe'->>'model'='fixture-model-B'
    and retargeted->'probe'->'test_passed'='true'::jsonb
    and retargeted->'probe'->'last_test_at'=initial->'probe'->'last_test_at'
    and retargeted->'probe'->'test_in_progress'='true'::jsonb,
    'original BEGIN exposes new model alongside prior PASS and timestamp');
  insert into public.fixture_t06_outputs values('legacy-retarget',retargeted);
  insert into public.fixture_t06_markers values('M07_T06_LEGACY_RETARGET_OBSERVED');
  receipt:=public.finish_translation_provider_self_test('cloudflare',token,true,true,true,'fixture-model-C',19,null);
  perform public.fixture_assert(public.fixture_t06_observation('cloudflare')->'probe'->>'model'='fixture-model-C',
    'original FINISH accepts a primary model different from BEGIN');
  insert into public.fixture_t06_outputs values('legacy-wrong-model',public.fixture_t06_observation('cloudflare'));
  insert into public.fixture_t06_markers values('M07_T06_LEGACY_WRONG_MODEL_OBSERVED');
  token:=public.begin_translation_provider_self_test('openai',true,true,'fixture-model-A',60);
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
  perform public.finish_translation_provider_self_test('openai',token,true,true,true,'fixture-model-A',21,null);
  perform public.fixture_assert(public.fixture_t06_observation('openai')->'probe'->>'tested_by'='00000000-0000-4000-8000-000000000003',
    'original FINISH accepts a different staff actor');
  insert into public.fixture_t06_outputs values('legacy-cross-actor',public.fixture_t06_observation('openai'));
  insert into public.fixture_t06_markers values('M07_T06_LEGACY_CROSS_ACTOR_OBSERVED');
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
  perform public.fixture_t06_clock('cloudflare');
  token:=public.begin_translation_provider_self_test('cloudflare',true,true,'fixture-model-D',60);
  insert into public.fixture_t06_outputs values('legacy-active-before-migration',public.fixture_t06_observation('cloudflare'));
  insert into public.fixture_t06_outputs values('legacy-openai-before-migration',public.fixture_t06_observation('openai'));
  insert into public.fixture_t06_markers values('M07_T06_LEGACY_ACTIVE_CAPTURED');
end; $$;
reset session authorization;

-- __M07_T06_BINDING_MIGRATION__

set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$
declare mode text:=current_setting('fixture.m07.t06.mode'); config jsonb:=public.fixture_t06_configuration();
  reservation jsonb; receipt jsonb; previous jsonb; observation jsonb; completed jsonb; candidate jsonb;
  field text; patch jsonb; token uuid; old_token uuid; changed jsonb; audit_before bigint;
begin
  if mode='before' then
    insert into public.fixture_t06_markers values('M07_T06_BEFORE_REPRODUCED');
    return;
  end if;
  perform public.fixture_assert(mode='current','only explicitly paired fixture modes');
  observation:=public.fixture_t06_observation('cloudflare');
  previous:=(select payload from public.fixture_t06_outputs where label='legacy-active-before-migration');
  perform public.fixture_assert((observation->'probe')-array['configuration_identity','lease_context']=previous->'probe'
    and observation->'audit'=previous->'audit','migration preserves active legacy row and history');
  perform public.fixture_assert((public.fixture_t06_observation('openai')->'probe')-array['configuration_identity','lease_context']
    =(select payload->'probe' from public.fixture_t06_outputs where label='legacy-openai-before-migration'),
    'migration preserves completed legacy provider row');
  perform public.fixture_assert(public.translation_operations_ready(),'legacy operations capability remains available');
  insert into public.fixture_t06_markers values('M07_T06_MIGRATION_HISTORY_PRESERVED_PASS');
  old_token:=(previous->'probe'->>'lease_token')::uuid;
  perform public.fixture_t06_error(format('select public.begin_translation_provider_self_test(%L,true,true,%L,60)',
    'cloudflare','fixture-model-D'),'0A000');
  perform public.fixture_t06_error(format('select public.finish_translation_provider_self_test(%L,%L::uuid,true,true,true,%L,1,null)',
    'cloudflare',old_token,'fixture-model-D'),'0A000');
  perform public.fixture_t06_error(format('select public.finish_translation_provider_config_self_test(%L::jsonb,%L::uuid,true,true,true,%L,%L,1,null)',
    config,old_token,config->>'model',config->>'reviewerModel'),'42501');
  perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,true,true,60)',config),'55000');
  perform public.fixture_assert(public.fixture_t06_observation('cloudflare')=observation,'legacy API refusals preserve row and audit');

  perform public.fixture_t06_clock('cloudflare');
  previous:=public.fixture_t06_observation('cloudflare');
  reservation:=public.begin_translation_provider_config_self_test(config,true,true,0);
  token:=(reservation->>'leaseToken')::uuid;
  observation:=public.fixture_t06_observation('cloudflare');
  perform public.fixture_assert(reservation ?& array['provider','configuration','configurationFingerprint','leaseToken',
    'leaseExpiresAt','cooldownUntil','configured','bindingFound']
    and reservation-array['provider','configuration','configurationFingerprint','leaseToken','leaseExpiresAt','cooldownUntil','configured','bindingFound']='{}'::jsonb
    and reservation->'configuration'=config and reservation->>'provider'='cloudflare'
    and reservation->'configured'='true'::jsonb and reservation->'bindingFound'='true'::jsonb
    and (reservation->>'leaseExpiresAt')::timestamptz=now()+interval '5 minutes'
    and (reservation->>'cooldownUntil')::timestamptz=now()+interval '60 seconds','exact bound reservation and original cooldown floor/TTL');
  perform public.fixture_assert(reservation->>'configurationFingerprint'='ee6fc95dd58a489171dc316e5b95d1a2d422996235d203263c5c85408020b11e',
    'native JSONB-array digest matches independently calculated Node SHA256 including quotes, backslash and Unicode');
  insert into public.fixture_t06_outputs values('current-reservation',reservation);
  insert into public.fixture_t06_markers values('M07_T06_CONFIGURATION_DIGEST_PASS');
  perform public.fixture_assert((observation->'probe')-array['test_in_progress','lease_token','lease_expires_at','cooldown_until','lease_context','updated_at']
    =(previous->'probe')-array['test_in_progress','lease_token','lease_expires_at','cooldown_until','lease_context','updated_at'],
    'bound BEGIN preserves every completed field, including model, pass, time, error, actor and readiness');
  perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,true,true,60)',config),'55000');
  perform public.fixture_assert(public.fixture_t06_observation('cloudflare')=observation,'cooldown denial preserves row and audit');
  perform public.fixture_t06_clock('cloudflare',false,true);
  observation:=public.fixture_t06_observation('cloudflare');
  perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,true,true,60)',config),'55000');
  perform public.fixture_assert(public.fixture_t06_observation('cloudflare')=observation,'active lease blocks BEGIN after cooldown expiry');
  insert into public.fixture_t06_markers values('M07_T06_BEGIN_HISTORY_COOLDOWN_PASS');

  for field in select key from jsonb_object_keys(config) entries(key) loop
    perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,true,true,60)',config-field),'22023');
    perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,true,true,60)',
      jsonb_set(config,array[field],'null'::jsonb)),'22023');
  end loop;
  for candidate in select value from jsonb_array_elements(jsonb_build_array(
    'null'::jsonb,'[]'::jsonb,'true'::jsonb,config||'{"extra":true}'::jsonb,
    config||'{"version":2}'::jsonb,config||'{"version":"1"}'::jsonb,config||'{"provider":"unknown"}'::jsonb,
    config||'{"model":" spaced "}'::jsonb,config||jsonb_build_object('model',E'line\nbreak'),
    config||jsonb_build_object('model',U&'\00A0edge'),config||jsonb_build_object('reviewerModel',U&'edge\FEFF'),
    config||jsonb_build_object('model',repeat(U&'\+01F600',101)),
    config||jsonb_build_object('model',repeat('m',201)),config||'{"reviewerModel":""}'::jsonb,
    config||'{"twoPassReview":"false"}'::jsonb,config||'{"translatorReasoningEffort":"minimal"}'::jsonb,
    config||'{"reviewerReasoningEffort":"invalid"}'::jsonb,config||'{"translatorReasoningMode":"invalid"}'::jsonb,
    config||'{"reviewerReasoningMode":"invalid"}'::jsonb,config||jsonb_build_object('promptFingerprint',repeat('A',64)))) loop
    perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,true,true,60)',candidate),'22023');
  end loop;
  perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,null,true,60)',config),'22023');
  perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,true,null,60)',config),'22023');
  perform public.fixture_assert(public.fixture_t06_observation('cloudflare')=observation,'malformed inputs preserve active row and audit');
  insert into public.fixture_t06_markers values('M07_T06_MALFORMED_CONFIGURATION_PASS');

  for patch in select value from jsonb_array_elements(jsonb_build_array(
    '{"provider":"openai"}'::jsonb,'{"model":"another-model"}'::jsonb,'{"reviewerModel":"another-repair-model"}'::jsonb,
    '{"twoPassReview":false}'::jsonb,'{"translatorReasoningEffort":"high"}'::jsonb,
    '{"translatorReasoningMode":"pro"}'::jsonb,'{"reviewerReasoningEffort":"max"}'::jsonb,
    '{"reviewerReasoningMode":"pro"}'::jsonb,jsonb_build_object('promptFingerprint',repeat('2',64)))) loop
    changed:=config||patch;
    perform public.fixture_t06_error(format('select public.finish_translation_provider_config_self_test(%L::jsonb,%L::uuid,true,true,true,%L,%L,1,null)',
      changed,token,changed->>'model',changed->>'reviewerModel'),'42501');
  end loop;
  perform public.fixture_t06_error(format('select public.finish_translation_provider_config_self_test(%L::jsonb,%L::uuid,true,true,true,%L,%L,1,null)',
    config,'00000000-0000-4000-8000-000000000099',config->>'model',config->>'reviewerModel'),'42501');
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
  perform public.fixture_t06_error(format('select public.finish_translation_provider_config_self_test(%L::jsonb,%L::uuid,true,true,true,%L,%L,1,null)',
    config,token,config->>'model',config->>'reviewerModel'),'42501');
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
  perform public.fixture_t06_error(format('select public.finish_translation_provider_config_self_test(%L::jsonb,%L::uuid,false,true,false,%L,null,1,%L)',
    config,token,config->>'model','provider_unavailable'),'42501');
  perform public.fixture_t06_error(format('select public.finish_translation_provider_config_self_test(%L::jsonb,%L::uuid,true,false,false,%L,null,1,%L)',
    config,token,config->>'model','provider_unavailable'),'42501');
  for candidate in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_build_array('null','true','true',config->>'model',config->>'reviewerModel','1','null'),
    jsonb_build_array('true','null','true',config->>'model',config->>'reviewerModel','1','null'),
    jsonb_build_array('true','true','null',config->>'model',config->>'reviewerModel','1','null'),
    jsonb_build_array('true','true','true','wrong-primary',config->>'reviewerModel','1','null'),
    jsonb_build_array('true','true','true',config->>'model','wrong-secondary','1','null'),
    jsonb_build_array('true','true','true',config->>'model',null,'1','null'),
    jsonb_build_array('true','true','true',config->>'model',config->>'reviewerModel','null','null'),
    jsonb_build_array('true','true','true',config->>'model',config->>'reviewerModel','-1','null'),
    jsonb_build_array('true','true','true',config->>'model',config->>'reviewerModel','3600001','null'),
    jsonb_build_array('true','true','true',config->>'model',config->>'reviewerModel','1',quote_literal('unexpected')),
    jsonb_build_array('true','true','false',config->>'model',null,'1','null'),
    jsonb_build_array('true','true','false',config->>'model',null,'1',quote_literal('unknown')))) loop
    perform public.fixture_t06_error(format('select public.finish_translation_provider_config_self_test(%L::jsonb,%L::uuid,%s,%s,%s,%L,%L,%s,%s)',
      config,token,candidate->>0,candidate->>1,candidate->>2,candidate->>3,candidate->>4,candidate->>5,candidate->>6),'22023');
  end loop;
  perform public.fixture_assert(public.fixture_t06_observation('cloudflare')=observation,'every FINISH binding/input denial preserves full row and audit');
  insert into public.fixture_t06_markers values('M07_T06_FINISH_BINDING_DENIALS_PASS');

  receipt:=public.finish_translation_provider_config_self_test(config,token,true,true,true,config->>'model',config->>'reviewerModel',23,null);
  completed:=public.fixture_t06_observation('cloudflare');
  perform public.fixture_assert(receipt ?& array['provider','configurationFingerprint','leaseToken','probe']
    and receipt-array['provider','configurationFingerprint','leaseToken','probe']='{}'::jsonb
    and receipt->>'leaseToken'=token::text and receipt->>'provider'='cloudflare'
    and receipt->'configurationFingerprint'=reservation->'configurationFingerprint'
    and receipt->'probe' ?& array['provider','configured','binding_found','test_passed','model','latency_ms',
      'last_error_code','last_test_at','cooldown_until','test_in_progress','configuration_identity']
    and (receipt->'probe')-array['provider','configured','binding_found','test_passed','model','latency_ms',
      'last_error_code','last_test_at','cooldown_until','test_in_progress','configuration_identity']='{}'::jsonb
    and receipt->'probe'->'configuration_identity'=jsonb_build_object('configuration',config,'fingerprint',reservation->>'configurationFingerprint')
    and receipt->'probe'->'test_passed'='true'::jsonb and receipt->'probe'->'test_in_progress'='false'::jsonb
    and receipt->'probe'->'last_error_code'='null'::jsonb
    and completed->'probe'->'lease_context'='null'::jsonb
    and completed->'probe'->'lease_token'='null'::jsonb
    and completed->'probe'->'lease_expires_at'='null'::jsonb
    and (completed->>'audit')::bigint=(observation->>'audit')::bigint+1,'exact completion DTO and single atomic audit');
  perform public.fixture_t06_error(format('select public.finish_translation_provider_config_self_test(%L::jsonb,%L::uuid,true,true,true,%L,%L,23,null)',
    config,token,config->>'model',config->>'reviewerModel'),'42501');
  perform public.fixture_assert(public.fixture_t06_observation('cloudflare')=completed,'duplicate FINISH does not replay history or audit');
  insert into public.fixture_t06_outputs values('current-success-receipt',receipt);
  insert into public.fixture_t06_markers values('M07_T06_EXACT_RECEIPT_PASS');

  perform public.fixture_t06_clock('cloudflare');
  config:=config||'{"twoPassReview":false}'::jsonb;
  previous:=public.fixture_t06_observation('cloudflare');
  reservation:=public.begin_translation_provider_config_self_test(config,true,true,999999);
  token:=(reservation->>'leaseToken')::uuid;
  perform public.fixture_assert((reservation->>'cooldownUntil')::timestamptz=now()+interval '1800 seconds','original cooldown ceiling preserved');
  perform public.fixture_assert((public.fixture_t06_observation('cloudflare')->'probe')-array['test_in_progress','lease_token','lease_expires_at','cooldown_until','lease_context','updated_at']
    =(previous->'probe')-array['test_in_progress','lease_token','lease_expires_at','cooldown_until','lease_context','updated_at'],
    'changed review setting BEGIN preserves previous complete identity and PASS');
  perform public.fixture_t06_clock('cloudflare',true,false);
  observation:=public.fixture_t06_observation('cloudflare');
  perform public.fixture_t06_error(format('select public.finish_translation_provider_config_self_test(%L::jsonb,%L::uuid,true,true,true,%L,%L,1,null)',
    config,token,config->>'model',config->>'reviewerModel'),'42501');
  perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,true,true,60)',config),'55000');
  perform public.fixture_assert(public.fixture_t06_observation('cloudflare')=observation,'expired FINISH and remaining cooldown do not change history');
  perform public.fixture_t06_clock('cloudflare');
  old_token:=token;
  reservation:=public.begin_translation_provider_config_self_test(config,true,true,60);
  token:=(reservation->>'leaseToken')::uuid;
  perform public.fixture_assert(token<>old_token,'expired reservation can be reclaimed with a new token');
  observation:=public.fixture_t06_observation('cloudflare');
  perform public.fixture_t06_error(format('select public.finish_translation_provider_config_self_test(%L::jsonb,%L::uuid,true,true,true,%L,%L,1,null)',
    config,old_token,config->>'model',config->>'reviewerModel'),'42501');
  perform public.fixture_assert(public.fixture_t06_observation('cloudflare')=observation,'reclaimed old token cannot overwrite newer reservation');
  insert into public.fixture_t06_markers values('M07_T06_STALE_LEASE_CLOSED_PASS');
  receipt:=public.finish_translation_provider_config_self_test(config,token,true,true,false,config->>'model',null,29,'provider_request_failed');
  perform public.fixture_assert(receipt->'probe'->'test_passed'='false'::jsonb
    and receipt->'probe'->>'last_error_code'='provider_request_failed'
    and receipt->'probe'->'configuration_identity'->'configuration'->'twoPassReview'='false'::jsonb
    and receipt->'probe'->'configuration_identity'->'configuration'->'reviewerModel'=config->'reviewerModel',
    'truthful failure preserves full identity and effective repair slot when content review is disabled');
  insert into public.fixture_t06_outputs values('current-failure-receipt',receipt);
  insert into public.fixture_t06_markers values('M07_T06_FAILURE_HISTORY_PASS');
end; $$;

reset session authorization;
do $$
declare config jsonb:=public.fixture_t06_configuration();
begin
  if current_setting('fixture.m07.t06.mode')<>'current' then return; end if;
  perform public.fixture_assert(not has_schema_privilege('authenticated','probpera_translation_operations','USAGE'),
    'private schema USAGE remains closed');
  perform public.fixture_assert(not has_table_privilege('authenticated','public.translation_provider_self_tests','INSERT')
    and not has_table_privilege('authenticated','public.translation_provider_self_tests','UPDATE')
    and not has_table_privilege('authenticated','public.translation_provider_self_tests','DELETE')
    and has_table_privilege('authenticated','public.translation_provider_self_tests','SELECT')
    and not has_table_privilege('anon','public.translation_provider_self_tests','SELECT'),
    'provider probe direct-write/read ACL remains unchanged');
  perform public.fixture_assert((select relrowsecurity and relforcerowsecurity from pg_class
    where oid='public.translation_provider_self_tests'::regclass),'provider probe actual RLS stays forced');
  perform public.fixture_assert((select count(*)=4 and bool_and(not prosecdef and proconfig@>array['search_path=""'])
    from pg_proc where oid in(
      'public.begin_translation_provider_config_self_test(jsonb,boolean,boolean,integer)'::regprocedure,
      'public.finish_translation_provider_config_self_test(jsonb,uuid,boolean,boolean,boolean,text,text,integer,text)'::regprocedure,
      'public.begin_translation_provider_self_test(text,boolean,boolean,text,integer)'::regprocedure,
      'public.finish_translation_provider_self_test(text,uuid,boolean,boolean,boolean,text,integer,text)'::regprocedure)),
    'all public probe RPCs use invoker and empty search path');
  perform public.fixture_assert((select count(*)=2 and bool_and(prosecdef and proconfig@>array['search_path=""'])
    from pg_proc where oid in(
      'probpera_translation_operations.begin_provider_config_self_test(jsonb,boolean,boolean,integer)'::regprocedure,
      'probpera_translation_operations.finish_provider_config_self_test(jsonb,uuid,boolean,boolean,boolean,text,text,integer,text)'::regprocedure)),
    'privileged guarded implementations remain private with empty search path');
  perform public.fixture_assert(not has_function_privilege('anon',
    'public.begin_translation_provider_config_self_test(jsonb,boolean,boolean,integer)','EXECUTE')
    and not has_function_privilege('service_role',
    'public.finish_translation_provider_config_self_test(jsonb,uuid,boolean,boolean,boolean,text,text,integer,text)','EXECUTE')
    and not has_function_privilege('authenticated',
    'probpera_translation_operations.self_test_configuration_identity(jsonb)','EXECUTE'),
    'unrelated roles and private validation helpers receive no new execute grant');
  perform public.fixture_assert(public.fixture_observation('00000000-0000-4000-8000-000000000101')-'audit'
    =(select payload from public.fixture_t06_outputs where label='author-before'),
    'author RU/EN, sources, rights, image fields, revisions and public outbox unchanged');
  insert into public.fixture_t06_markers values('M07_T06_AUTHOR_PRESERVATION_PASS');
end; $$;

set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
do $$
begin
  if current_setting('fixture.m07.t06.mode')<>'current' then return; end if;
  perform public.fixture_assert((select count(*)=0 from public.translation_provider_self_tests),'nonstaff sees no provider probes under actual RLS');
  perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,true,true,60)',
    public.fixture_t06_configuration()),'42501');
  perform public.fixture_t06_error('update public.translation_provider_self_tests set test_passed=true','42501');
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  perform public.fixture_assert((select count(*)=2 from public.translation_provider_self_tests),'existing staff editor SELECT policy is retained');
  perform public.fixture_t06_error('update public.translation_provider_self_tests set test_passed=true','42501');
  perform set_config('request.jwt.claim.sub','',false);
  perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,true,true,60)',
    public.fixture_t06_configuration()),'42501');
end; $$;
reset session authorization;
set session authorization anon;
do $$
begin
  if current_setting('fixture.m07.t06.mode')<>'current' then return; end if;
  perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,true,true,60)',
    public.fixture_t06_configuration()),'42501');
end; $$;
reset session authorization;
set session authorization service_role;
do $$
begin
  if current_setting('fixture.m07.t06.mode')<>'current' then return; end if;
  update public.translation_provider_self_tests set model=model where provider='openai';
  perform public.fixture_assert((select configuration_identity is null and lease_context is null
    from public.translation_provider_self_tests where provider='openai'),'nullable legacy service writes remain compatible');
  perform public.fixture_t06_error(format('select public.begin_translation_provider_config_self_test(%L::jsonb,true,true,60)',
    public.fixture_t06_configuration()),'42501');
end; $$;
reset session authorization;
insert into public.fixture_t06_markers select 'M07_T06_ROLE_RLS_ACL_PASS' where current_setting('fixture.m07.t06.mode')='current';
insert into public.fixture_t06_markers select 'M07_T06_CURRENT_PASS' where current_setting('fixture.m07.t06.mode')='current';
select marker from public.fixture_t06_markers order by marker;
select 'M07_T06_NATIVE_OBSERVATIONS',jsonb_object_agg(label,payload order by label) from public.fixture_t06_outputs;
