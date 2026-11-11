-- Site-copy durable provider admission and retained response artifacts.
-- Seven closed staff RPCs; no new queue/table/column/role/lease grant.
-- One additional staff metadata read proves paid candidate full-row freshness.
-- Existing book/country functions and old migration files are not replaced.
begin;
do $check$ declare name text;n integer;att smallint;begin
 select attnum into att from pg_attribute where attrelid='premium_translation_private.catalog_operation_artifacts'::regclass and attname='entity_type';
 select count(*),min(conname) into n,name from pg_constraint where conrelid='premium_translation_private.catalog_operation_artifacts'::regclass and contype='c' and conkey=array[att];
 if n<>1 then raise exception 'Unexpected catalog artifact identity CHECK layout' using errcode='42501';end if;
 execute format('alter table premium_translation_private.catalog_operation_artifacts drop constraint %I',name);
 alter table premium_translation_private.catalog_operation_artifacts add constraint catalog_operation_artifacts_catalog_site_copy_type_check check(entity_type in ('literary_work','country','site_copy'));
end;$check$;
create unique index translation_site_copy_active_operation_unique on public.translation_job_items(entity_type)
 where entity_type='site_copy' and staff_retry is not null;


create function premium_translation_private.site_copy_operation_configuration_valid(v jsonb,p text)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare key text;
begin
  if not premium_translation_private.exact_object(v,array['version','provider','model','reviewerModel','promptFingerprint',
    'translatorReasoningEffort','translatorReasoningMode','reviewerReasoningEffort','reviewerReasoningMode','schemaName','maxOutputTokens','twoPassReview'])
    or v->'version' is distinct from '1'::jsonb or v->>'provider' is distinct from p
    or v->>'schemaName' is distinct from 'probpera_site_copy_translation'
    or v->'maxOutputTokens' is distinct from '12000'::jsonb
    or jsonb_typeof(v->'twoPassReview') is distinct from 'boolean'
    or jsonb_typeof(v->'promptFingerprint') is distinct from 'string' or v->>'promptFingerprint' !~ '^[a-f0-9]{64}$' or octet_length(v::text)>4096 then return false; end if;
  foreach key in array array['model','reviewerModel'] loop
    if jsonb_typeof(v->key) is distinct from 'string' or char_length(v->>key) not between 1 and 200 or v->>key ~ '[[:cntrl:]]' then return false; end if;
  end loop;
  foreach key in array array['translatorReasoningEffort','reviewerReasoningEffort'] loop
    if jsonb_typeof(v->key) is distinct from 'string' or v->>key not in ('none','low','medium','high','xhigh','max') then return false; end if;
  end loop;
  foreach key in array array['translatorReasoningMode','reviewerReasoningMode'] loop
    if jsonb_typeof(v->key) is distinct from 'string' or v->>key not in ('standard','pro') then return false; end if;
  end loop;
  return true;
end; $$;

create function premium_translation_private.site_copy_operation_progress(c jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('version',1,'updatedAt',coalesce(nullif(c->(jsonb_array_length(c)-1)->'metadata'->'responseReceivedAt','null'::jsonb),
      c->(jsonb_array_length(c)-1)->'metadata'->'dispatchRecordedAt',to_jsonb('1970-01-01T00:00:00Z'::text)),
    'calls',coalesce(jsonb_agg(value->'metadata' order by n),'[]'::jsonb))
  from jsonb_array_elements(c) with ordinality x(value,n);
$$;

create function premium_translation_private.site_copy_operation_scope_lock()
returns void language sql volatile security invoker set search_path='' as $$
 select pg_advisory_xact_lock(hashtextextended('site-copy-operation:site-copy-overrides',7391));
$$;
create function premium_translation_private.site_copy_operation_source_valid(identity text,s jsonb,r jsonb,t jsonb,seed jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb;seen text[]:='{}';k text;begin
 perform premium_translation_private.assert_identity('site_copy',identity);
 if not premium_translation_private.exact_object(s,array['settings','items']) or jsonb_typeof(s->'settings') is distinct from 'object'
  or s#>>'{settings,systemKey}' is distinct from 'site-copy-overrides' or jsonb_typeof(s->'items') is distinct from 'array'
  or jsonb_array_length(s->'items') not between 1 and 50 or octet_length(s::text)>4194304
  or not premium_translation_private.exact_object(r,array['blockId','blockUpdatedAt'])
  or (r->>'blockId')::uuid is distinct from identity::uuid
  or not premium_translation_private.valid_revision(t)
  or jsonb_build_object('id',r->'blockId','updatedAt',r->'blockUpdatedAt') is distinct from t
  or not premium_translation_private.exact_object(seed,array['version','block']) or seed->'version'<>'1'::jsonb
  or seed#>'{block,settings}' is distinct from s->'settings'
  or (seed#>>'{block,id}')::uuid is distinct from identity::uuid
  or (seed#>>'{block,updated_at}')::timestamptz is distinct from (r->>'blockUpdatedAt')::timestamptz then return false;end if;
 for item in select value from jsonb_array_elements(s->'items') loop
  if not premium_translation_private.exact_object(item,array['key','text','sourceHash']) or jsonb_typeof(item->'key') is distinct from 'string'
   or jsonb_typeof(item->'text') is distinct from 'string' or jsonb_typeof(item->'sourceHash') is distinct from 'string'
   or coalesce(item->>'sourceHash','')!~'^[a-f0-9]{64}$'
   or premium_translation_private.site_copy_utf16_length(item->>'text') not between 1 and 4000
   or premium_translation_private.trim_text(item->>'text')='' then return false;end if;
  k:=item->>'key';if premium_translation_private.site_copy_utf16_length(k) not between 1 and 1200 or k<>premium_translation_private.trim_text(k)
   or k~'[[:cntrl:]]' or k~*'(^|\.)(__proto__|prototype|constructor)(\.|$)' or k=any(seen) then return false;end if;
  seen:=array_append(seen,k);
 end loop;
 -- Existing server JS projection/hash semantics stay opaque: no SQL hyphen
 -- normalizer or JSONB replacement for SHA256(JSON.stringify(items)).
 perform premium_translation_private.assert_site_copy_recorded(s);return true;
exception when others then return false;end; $$;
create function premium_translation_private.site_copy_operation_capture(identity text,expected jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare b public.homepage_blocks%rowtype;n integer;begin
 perform pg_advisory_xact_lock(188654771,2);
 select count(*) into n from public.homepage_blocks where settings @> '{"systemKey":"site-copy-overrides"}';
 if n<>1 then raise exception 'Site Copy master missing or ambiguous' using errcode='40001';end if;
 select * into b from public.homepage_blocks where id=identity::uuid for update;
 if b.id is null or b.settings->>'systemKey'<>'site-copy-overrides'
  or not premium_translation_private.exact_object(expected,array['version','block']) or expected->'version'<>'1'::jsonb
  or not premium_translation_private.exact_object(expected->'block',array['id','settings','updated_at'])
  or (expected#>>'{block,id}')::uuid is distinct from b.id or expected#>'{block,settings}' is distinct from b.settings
  or (expected#>>'{block,updated_at}')::timestamptz is distinct from b.updated_at then
  raise exception 'Site Copy expected projection changed' using errcode='40001';end if;
 return jsonb_build_object('version',1,'block',to_jsonb(b));
end; $$;
create function premium_translation_private.site_copy_operation_assert_current(a premium_translation_private.catalog_operation_artifacts)
returns void language plpgsql volatile security invoker set search_path='' as $$ declare seed jsonb;begin
 seed:=premium_translation_private.site_copy_operation_capture(a.entity_id,a.expected_state);
 if seed is distinct from a.raw_seed or premium_translation_private.site_copy_operation_source_valid(a.entity_id,a.source_snapshot,a.source_revision,a.target_revision,seed) is distinct from true then
  raise exception 'Site Copy full recorded source changed' using errcode='40001';end if;
end; $$;
create function premium_translation_private.site_copy_operation_owned(p_job uuid,p_item uuid,p_operation uuid)
returns premium_translation_private.catalog_operation_artifacts language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype;begin
 perform premium_translation_private.assert_actor();perform premium_translation_private.site_copy_operation_scope_lock();
 select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=p_operation for update;
 if a.operation_id is null then raise exception 'Site Copy operation not found' using errcode='P0002';end if;
 if a.actor_id is distinct from auth.uid() then raise exception 'Site Copy operation actor differs' using errcode='42501';end if;
 if a.job_id is distinct from p_job or a.item_id is distinct from p_item or a.entity_type<>'site_copy' then
  raise exception 'Site Copy operation identity differs' using errcode='40001';end if;return a;
end; $$;
create function premium_translation_private.site_copy_operation_view(a premium_translation_private.catalog_operation_artifacts,
 replayed boolean default false,execute_allowed boolean default false,dispatch_allowed boolean default false)
returns jsonb language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare j public.translation_jobs%rowtype;pending uuid;reason text;phase text:='running';begin
 select * into j from public.translation_jobs where id=a.job_id;
 select (value#>>'{metadata,callId}')::uuid into pending from jsonb_array_elements(a.calls) where value#>'{metadata,responseReceivedAt}'='null'::jsonb limit 1;
 if a.final_receipt is not null then return a.final_receipt||jsonb_build_object('replayed',replayed,'canExecute',false,'canDispatch',false);end if;
 if auth.uid() is distinct from a.actor_id then reason:='operation_owned_by_another_actor';
 elsif pending is not null and not dispatch_allowed then reason:='provider_outcome_unknown';
 elsif j.cancel_requested_at is not null then reason:='operation_stopped';
 elsif clock_timestamp()>=a.created_at+interval '45 seconds' and not dispatch_allowed then reason:='operation_deadline';end if;
 if reason is not null then phase:='blocked';end if;
 return jsonb_build_object('version',1,'logicalScope','site-copy-overrides','jobId',a.job_id,'itemId',a.item_id,'operationId',a.operation_id,
  'entityType','site_copy','entityId',a.entity_id,'actorId',a.actor_id,'provider',a.provider,'sourceHash',a.source_hash,'intentHash',a.intent_hash,'rawSeedHash',a.raw_seed_hash,
  'configurationHash',a.configuration_hash,'configuration',a.configuration,'sourceRevision',a.source_revision,'targetRevision',a.target_revision,
  'startedAt',a.created_at,'deadlineAt',a.created_at+interval '45 seconds','jobVersion',j.version::text,'phase',phase,
  'canExecute',execute_allowed and reason is null,'canDispatch',dispatch_allowed,'replayed',replayed,'providerCalls',jsonb_array_length(a.calls),
  'pendingCallId',pending,'blockReason',reason,'resumeCursor','{}'::jsonb,'result',null);
end; $$;
create function public.reconcile_site_copy_translation_operation(p_operation_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype;begin
 perform premium_translation_private.assert_actor();perform premium_translation_private.site_copy_operation_scope_lock();
 if p_operation_id is not null and not probpera_translation_operations.retry_uuid(p_operation_id) then raise exception 'Invalid Site Copy operation' using errcode='22023';end if;
 -- Logical active scope first, before a recreated block ID/config/feature read.
 select c.* into a from premium_translation_private.catalog_operation_artifacts c join public.translation_job_items i on i.id=c.item_id
  where c.entity_type='site_copy' and i.entity_type='site_copy' and i.staff_retry is not null order by c.created_at desc,c.operation_id desc limit 1;
 if a.operation_id is null then
  select * into a from premium_translation_private.catalog_operation_artifacts where entity_type='site_copy' and(p_operation_id is null or operation_id=p_operation_id)
   order by created_at desc,operation_id desc limit 1;
 end if;
 if a.operation_id is null then return null;end if;return premium_translation_private.site_copy_operation_view(a,true);
end; $$;
create function public.get_site_copy_translation_operation_artifacts(p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_intent_hash text,p_source_hash text,p_raw_seed_hash text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$ declare a premium_translation_private.catalog_operation_artifacts%rowtype;begin
 a:=premium_translation_private.site_copy_operation_owned(p_job_id,p_item_id,p_operation_id);
 if a.intent_hash is distinct from p_intent_hash or a.source_hash is distinct from p_source_hash or a.raw_seed_hash is distinct from p_raw_seed_hash then
  raise exception 'Site Copy private artifact binding differs' using errcode='40001';end if;
 return jsonb_build_object('version',1,'receipt',premium_translation_private.site_copy_operation_view(a,true),'expectedState',a.expected_state,'rawSeed',a.raw_seed,
  'sourceSnapshot',a.source_snapshot,'sourceRevision',a.source_revision,'targetRevision',a.target_revision,'configuration',a.configuration,'calls',a.calls,'candidate',a.candidate);
end; $$;

create function public.begin_site_copy_translation_operation(p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_block_id uuid,p_provider text,
 p_source_hash text,p_source_snapshot jsonb,p_source_revision jsonb,p_target_revision jsonb,p_expected_state jsonb,p_configuration jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=premium_translation_private.assert_actor();a premium_translation_private.catalog_operation_artifacts%rowtype;
 j public.translation_jobs%rowtype;i public.translation_job_items%rowtype;request_hash text;marker jsonb;view jsonb;stamp timestamptz:=clock_timestamp();identity text;begin
 perform premium_translation_private.site_copy_operation_scope_lock();
 select c.* into a from premium_translation_private.catalog_operation_artifacts c join public.translation_job_items x on x.id=c.item_id where c.entity_type='site_copy' and x.entity_type='site_copy' and x.staff_retry is not null for update of c;
 if a.operation_id is not null then
  view:=premium_translation_private.site_copy_operation_view(a,true);
  return view||jsonb_build_object('phase','blocked','blockReason',coalesce(view->>'blockReason','operation_in_progress'),'canExecute',false,'canDispatch',false);
 end if;
 identity:=p_block_id::text;
 if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
  or not probpera_translation_operations.retry_uuid(p_operation_id) or not probpera_translation_operations.retry_uuid(p_block_id)
  or p_provider is null or p_provider not in('cloudflare','openai') or coalesce(p_source_hash,'')!~'^[a-f0-9]{64}$'
  or premium_translation_private.site_copy_operation_configuration_valid(p_configuration,p_provider) is distinct from true
  or jsonb_typeof(p_expected_state) is distinct from 'object' or octet_length(p_expected_state::text)>4194304 then
  raise exception 'Invalid Site Copy admission' using errcode='22023';end if;
 request_hash:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_job_id,p_item_id,p_operation_id,actor,identity,p_provider,p_source_hash,
  p_source_snapshot,p_source_revision,p_target_revision,p_expected_state,p_configuration));
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,7292));
 select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=p_operation_id for update;
 if a.operation_id is not null then
  if a.entity_type<>'site_copy' or a.actor_id<>actor then raise exception 'Site Copy operation actor/domain differs' using errcode='42501';end if;
  if a.begin_request_hash<>request_hash then raise exception 'Site Copy begin intent differs' using errcode='40001';end if;
  return premium_translation_private.site_copy_operation_view(a,true);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('premium-translation:site_copy:'||identity,0));
 if exists(select 1 from public.translation_jobs where id=p_job_id) or exists(select 1 from public.translation_job_items where id=p_item_id)
  or exists(select 1 from premium_translation_private.catalog_operation_artifacts where job_id=p_job_id or item_id=p_item_id)
  or exists(select 1 from premium_translation_private.writer_operation_artifacts where operation_id=p_operation_id)
  or exists(select 1 from public.translation_job_attempts where staff_retry_operation_id=p_operation_id)
  or exists(select 1 from public.translation_job_items where staff_retry is not null and staff_retry->>'operationId'=p_operation_id::text)
  or exists(select 1 from public.premium_translation_working_drafts where entity_type='site_copy' and lower(entity_id)=identity) then
  raise exception 'Site Copy identity or pending candidate already exists' using errcode='40001';end if;
 a.raw_seed:=premium_translation_private.site_copy_operation_capture(identity,p_expected_state);
 if octet_length(a.raw_seed::text)>4194304 or premium_translation_private.site_copy_operation_source_valid(identity,p_source_snapshot,p_source_revision,p_target_revision,a.raw_seed) is distinct from true then
  raise exception 'Site Copy source/target eligibility changed' using errcode='40001';end if;
 a.operation_id:=p_operation_id;a.job_id:=p_job_id;a.item_id:=p_item_id;a.actor_id:=actor;a.entity_type:='site_copy';a.entity_id:=identity;
 a.provider:=p_provider;a.source_hash:=p_source_hash;a.begin_request_hash:=request_hash;a.expected_state:=p_expected_state;
 a.raw_seed_hash:=probpera_translation_operations.retry_fingerprint(a.raw_seed);a.intent_hash:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(request_hash,a.raw_seed_hash));
 a.configuration:=p_configuration;a.configuration_hash:=probpera_translation_operations.retry_fingerprint(p_configuration);
 a.source_snapshot:=p_source_snapshot;a.source_revision:=p_source_revision;a.target_revision:=p_target_revision;a.confirmed_cursor:='{}';a.calls:='[]';a.created_at:=stamp;
 marker:=jsonb_build_object('version',1,'protocol','site-copy-translation','logicalScope','site-copy-overrides','operationId',p_operation_id,'actorId',actor,
  'sourceHash',p_source_hash,'intentHash',a.intent_hash,'rawSeedHash',a.raw_seed_hash,'configurationHash',a.configuration_hash,'startedAt',stamp,'attemptNumber',1,
  'progress',jsonb_build_object('version',1,'updatedAt',stamp,'calls','[]'::jsonb));
 j:=jsonb_populate_record(null::public.translation_jobs,jsonb_build_object('id',p_job_id,'kind','site_copy','source_locale','ru','target_locale','en','provider',p_provider,
  'status','reviewing','total_items',1,'succeeded_items',0,'failed_items',0,'requested_by',actor,'started_at',stamp,'version',1,'created_at',stamp,'updated_at',stamp,
  'resume_cursor',jsonb_build_object('siteCopyOperation',jsonb_build_object('version',1,'logicalScope','site-copy-overrides','operationId',p_operation_id,'actorId',actor,'intentHash',a.intent_hash))));
 i:=jsonb_populate_record(null::public.translation_job_items,jsonb_build_object('id',p_item_id,'job_id',p_job_id,'position',0,'entity_type','site_copy','entity_id',identity,
  'source_hash',p_source_hash,'status','reviewing','attempt_count',0,'max_attempts',1,'next_attempt_at',stamp,'created_at',stamp,'updated_at',stamp,'staff_retry',marker));
 a.job_write_proof:=to_jsonb(j);a.item_write_proof:=to_jsonb(i);
 insert into premium_translation_private.catalog_operation_artifacts select a.*;insert into public.translation_jobs select j.*;insert into public.translation_job_items select i.*;
 perform premium_translation_private.site_copy_operation_assert_constructed(p_operation_id);
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)values(actor,'translation.site_copy_operation.admitted','translation_job',p_job_id::text,
  jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'logicalScope','site-copy-overrides','blockId',identity,'sourceHash',p_source_hash,'rawSeedHash',a.raw_seed_hash));
 return premium_translation_private.site_copy_operation_view(a,false,true);
end; $$;

create function public.record_site_copy_translation_operation_dispatch(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_call_id uuid,p_provider text,p_model text,p_pass text,p_request_hash text
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype; j public.translation_jobs%rowtype;
  i public.translation_job_items%rowtype; call jsonb; metadata jsonb; progress jsonb; stamp timestamptz:=clock_timestamp();
begin
  a:=premium_translation_private.site_copy_operation_owned(p_job_id,p_item_id,p_operation_id);
  if not probpera_translation_operations.retry_uuid(p_call_id) or p_provider is distinct from a.provider
    or p_model is null or p_pass is null or p_pass not in ('translation','repair','review')
    or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$'
    or p_model is distinct from a.configuration->>(case when p_pass='translation' then 'model' else 'reviewerModel' end) then
    raise exception 'Invalid catalog dispatch binding' using errcode='22023'; end if;
  for call in select value from jsonb_array_elements(a.calls) loop
    if call->'metadata'->>'callId'=p_call_id::text then
      if call->>'requestHash' is distinct from p_request_hash or call->'metadata'->>'pass' is distinct from p_pass
        or call->'metadata'->>'model' is distinct from p_model then raise exception 'Catalog dispatch intent differs' using errcode='40001'; end if;
      return premium_translation_private.site_copy_operation_view(a,true);
    end if;
  end loop;
  select * into j from public.translation_jobs where id=p_job_id for update;
  if a.final_receipt is not null or j.cancel_requested_at is not null or j.status<>'reviewing' or stamp>=a.created_at+interval '45 seconds'
    or jsonb_array_length(a.calls)>=4 or exists(select 1 from jsonb_array_elements(a.calls) value where value->'metadata'->'responseReceivedAt'='null'::jsonb) then
    raise exception 'Catalog dispatch is blocked or outcome unknown' using errcode='40001'; end if;
  if a.configuration->'twoPassReview'='false'::jsonb and (p_pass='review' or jsonb_array_length(a.calls)>=2) then
    raise exception 'Unconfigured catalog review pass' using errcode='22023'; end if;
  perform premium_translation_private.site_copy_operation_assert_current(a);
  metadata:=jsonb_build_object('callId',p_call_id,'provider',p_provider,'model',p_model,'pass',p_pass,
    'dispatchRecordedAt',stamp,'responseReceivedAt',null,'httpStatus',null,'requestId',null,'responseId',null,'inputTokens',null,'outputTokens',null);
  a.calls:=a.calls||jsonb_build_array(jsonb_build_object('requestHash',p_request_hash,'metadata',metadata,'responseArtifact',null));
  progress:=premium_translation_private.site_copy_operation_progress(a.calls);
  if not probpera_translation_operations.retry_journal_valid(progress,a.provider) then
    raise exception 'Catalog dispatch sequence differs' using errcode='40001'; end if;
  select * into i from public.translation_job_items where id=p_item_id for update;
  i.staff_retry:=i.staff_retry||jsonb_build_object('progress',progress);i.updated_at:=stamp;
  a.item_write_proof:=to_jsonb(i);
  update premium_translation_private.catalog_operation_artifacts set calls=a.calls,item_write_proof=a.item_write_proof where operation_id=p_operation_id;
  update public.translation_job_items set staff_retry=i.staff_retry,updated_at=i.updated_at where id=p_item_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(a.actor_id,'translation.site_copy_operation.dispatch_recorded','translation_job',p_job_id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'callId',p_call_id,'provider',p_provider,'model',p_model,'pass',p_pass,'requestHash',p_request_hash));
  return premium_translation_private.site_copy_operation_view(a,false,false,true);
end; $$;

create function public.record_site_copy_translation_operation_response(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_metadata jsonb,p_response_artifact jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype; i public.translation_job_items%rowtype;
  call jsonb; position integer; progress jsonb; stamp timestamptz:=clock_timestamp();
begin
  a:=premium_translation_private.site_copy_operation_owned(p_job_id,p_item_id,p_operation_id);
  if not premium_translation_private.exact_object(p_metadata,array['callId','provider','model','pass','httpStatus','requestId','responseId','inputTokens','outputTokens'])
    or not premium_translation_private.exact_object(p_response_artifact,array['version','body'])
    or p_response_artifact->'version' is distinct from '1'::jsonb or octet_length(p_response_artifact::text)>1048576 then
    raise exception 'Invalid catalog response artifact' using errcode='22023'; end if;
  select value,(n-1)::integer into call,position from jsonb_array_elements(a.calls) with ordinality x(value,n)
    where value->'metadata'->>'callId'=p_metadata->>'callId';
  if position is null then raise exception 'Catalog response dispatch not found' using errcode='40001'; end if;
  if call->'metadata'->>'provider' is distinct from p_metadata->>'provider'
    or call->'metadata'->>'model' is distinct from p_metadata->>'model' or call->'metadata'->>'pass' is distinct from p_metadata->>'pass' then
    raise exception 'Catalog response identity differs' using errcode='40001'; end if;
  if call->'metadata'->'responseReceivedAt'<>'null'::jsonb then
    if (call->'metadata')-array['dispatchRecordedAt','responseReceivedAt'] is distinct from p_metadata
      or call->'responseArtifact' is distinct from p_response_artifact then raise exception 'Catalog response evidence differs' using errcode='40001'; end if;
    return premium_translation_private.site_copy_operation_view(a,true);
  end if;
  if a.final_receipt is not null then raise exception 'Catalog operation already finished' using errcode='40001'; end if;
  call:=call||jsonb_build_object('metadata',p_metadata||jsonb_build_object('dispatchRecordedAt',call->'metadata'->'dispatchRecordedAt','responseReceivedAt',stamp),
    'responseArtifact',p_response_artifact);
  a.calls:=jsonb_set(a.calls,array[position::text],call);
  if octet_length(a.calls::text)>4194304 then raise exception 'Catalog aggregate response artifact limit exceeded' using errcode='22023'; end if;
  progress:=premium_translation_private.site_copy_operation_progress(a.calls);
  if not probpera_translation_operations.retry_journal_valid(progress,a.provider) then
    raise exception 'Catalog response metadata differs' using errcode='22023'; end if;
  select * into i from public.translation_job_items where id=p_item_id for update;
  i.staff_retry:=i.staff_retry||jsonb_build_object('progress',progress);i.updated_at:=stamp;a.item_write_proof:=to_jsonb(i);
  update premium_translation_private.catalog_operation_artifacts set calls=a.calls,item_write_proof=a.item_write_proof where operation_id=p_operation_id;
  update public.translation_job_items set staff_retry=i.staff_retry,updated_at=i.updated_at where id=p_item_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(a.actor_id,'translation.site_copy_operation.response_received','translation_job',p_job_id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'callId',p_metadata->'callId','responseHash',probpera_translation_operations.retry_fingerprint(p_response_artifact)));
  return premium_translation_private.site_copy_operation_view(a);
end; $$;

create function public.finish_site_copy_translation_operation(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_outcome jsonb,p_candidate jsonb default null
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype; j public.translation_jobs%rowtype;
  i public.translation_job_items%rowtype; attempt public.translation_job_attempts%rowtype;
  draft public.premium_translation_working_drafts%rowtype; current_work jsonb; current_ru jsonb; current_sources jsonb; selected_source jsonb; urls jsonb; n integer;
  fingerprint text; digest text; status text; code text; state text; persistence text:='none'; result jsonb; receipt jsonb;
  first_call jsonb; last_call jsonb; stamp timestamptz:=clock_timestamp(); current_bound boolean:=true;
begin
  a:=premium_translation_private.site_copy_operation_owned(p_job_id,p_item_id,p_operation_id);
  if p_outcome is null or jsonb_typeof(p_outcome)<>'object'
    or not(p_outcome ?& array['status','providerCalls'])
    or p_outcome-array['status','providerCalls','errorCode','model','requestId','inputTokens','outputTokens','durationMs']<>'{}'::jsonb
    or coalesce(p_outcome->>'status','') not in ('succeeded','dead_letter','conflict','stale','skipped','not-configured','cancelled')
    or jsonb_typeof(p_outcome->'providerCalls') is distinct from 'number'
    or p_outcome->>'providerCalls' !~ '^[0-4]$'
    or (p_outcome->>'providerCalls')::integer<>jsonb_array_length(a.calls)
    or (p_outcome->>'errorCode' is not null and p_outcome->>'errorCode' not in
      ('translation_not_configured','provider_unavailable','provider_request_failed','provider_invalid_response',
       'source_changed','write_conflict','database_read_failed','database_write_failed','unexpected','translation_operation_stopped')) then
    raise exception 'Invalid catalog finish outcome' using errcode='22023'; end if;
  fingerprint:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_outcome,p_candidate));
  if a.final_receipt is not null then
    if a.finish_fingerprint is distinct from fingerprint then raise exception 'Catalog finish intent differs' using errcode='40001'; end if;
    return premium_translation_private.site_copy_operation_view(a,true);
  end if;
  if exists(select 1 from jsonb_array_elements(a.calls) value where value->'metadata'->'responseReceivedAt'='null'::jsonb) then
    raise exception 'Catalog provider outcome remains unknown' using errcode='40001'; end if;
  select * into j from public.translation_jobs where id=p_job_id for update;
  select * into i from public.translation_job_items where id=p_item_id for update;
  status:=p_outcome->>'status';code:=p_outcome->>'errorCode';
  -- A paid unfinished pass is not a terminal failure/retry grant. Retain it.
  if jsonb_array_length(a.calls)>0 and p_candidate is null then raise exception 'Site Copy paid partial response must remain retained' using errcode='40001';end if;
  if (status='succeeded') is distinct from (p_candidate is not null) then
    raise exception 'Catalog completed candidate required only for success' using errcode='22023'; end if;
  if p_candidate is not null then
    n:=jsonb_array_length(a.calls);
    if not premium_translation_private.exact_object(p_candidate,array['payload','provenance','translatorCallId','reviewerCallId'])
      or n<1 or octet_length(p_candidate::text)>1048576
      or (a.configuration->'twoPassReview'='true'::jsonb and not exists(select 1 from jsonb_array_elements(a.calls) value where value->'metadata'->>'pass'='review'))
      or (a.configuration->'twoPassReview'='false'::jsonb and (n>2 or exists(select 1 from jsonb_array_elements(a.calls) value where value->'metadata'->>'pass'='review'))) then
      raise exception 'Catalog independent review proof missing' using errcode='22023'; end if;
    first_call:=a.calls->0->'metadata';last_call:=a.calls->(jsonb_array_length(a.calls)-1)->'metadata';
    if p_candidate->>'translatorCallId' is distinct from first_call->>'callId'
      or p_candidate->>'reviewerCallId' is distinct from (case when n=1 then null else last_call->>'callId' end)
      or p_candidate->'provenance'->>'provider' is distinct from a.provider
      or p_candidate->'provenance'->>'translatorModel' is distinct from first_call->>'model'
      or p_candidate->'provenance'->>'reviewerModel' is distinct from (case when n=1 then null else last_call->>'model' end)
      or p_candidate->'provenance'->>'translatorRequestId' is distinct from coalesce(first_call->>'requestId',first_call->>'responseId')
      or p_candidate->'provenance'->>'reviewerRequestId' is distinct from (case when n=1 then null else coalesce(last_call->>'requestId',last_call->>'responseId') end) then
      raise exception 'Catalog candidate provider evidence differs' using errcode='40001'; end if;
    perform premium_translation_private.assert_shape(a.entity_type,a.source_snapshot,a.source_revision,a.target_revision,
      p_candidate->'payload',p_candidate->'provenance');
    perform premium_translation_private.assert_site_copy_recorded(a.source_snapshot);
    perform pg_advisory_xact_lock(hashtextextended('premium-translation:site_copy:'||a.entity_id,0));
    select * into draft from public.premium_translation_working_drafts where entity_type='site_copy' and entity_id=a.entity_id for update;
    begin perform premium_translation_private.site_copy_operation_assert_current(a);
    exception when serialization_failure then current_bound:=false;status:='stale';code:='source_changed';end;
    digest:=probpera_translation_operations.retry_fingerprint(jsonb_build_object('entityType',a.entity_type,'entityId',a.entity_id,
      'targetLocale','en','sourceHash',a.source_hash,'sourceSnapshot',a.source_snapshot,'sourceRevision',a.source_revision,
      'targetRevision',a.target_revision,'payload',p_candidate->'payload','provenance',p_candidate->'provenance'));
    -- A fully validated body is retained independently of live CAS/cancel.
    -- Existing pending author/review work is never replaced.
    if draft.id is null then
      insert into public.premium_translation_working_drafts(entity_type,entity_id,source_hash,candidate_hash,source_snapshot,
        source_revision,target_revision,payload,provenance,created_by)
        values(a.entity_type,a.entity_id,a.source_hash,digest,a.source_snapshot,a.source_revision,a.target_revision,
          p_candidate->'payload',p_candidate->'provenance',a.actor_id) returning * into draft;
      persistence:='working-draft';
    elsif draft.candidate_hash=digest and draft.source_snapshot=a.source_snapshot and draft.source_revision=a.source_revision
      and draft.target_revision=a.target_revision and draft.payload=p_candidate->'payload' and draft.provenance=p_candidate->'provenance' then
      persistence:='working-draft';
    else
      persistence:='private-artifact';status:='conflict';code:='write_conflict';draft:=null;
    end if;
  end if;
  if j.cancel_requested_at is not null then status:='cancelled';code:=null; end if;
  if status in ('succeeded','skipped','cancelled') then code:=null;
  elsif code is null then code:=case status when 'stale' then 'source_changed' when 'conflict' then 'write_conflict'
    when 'not-configured' then 'translation_not_configured' else 'unexpected' end; end if;
  state:=case status when 'succeeded' then 'translated' when 'dead_letter' then 'failed' else status end;
  result:=jsonb_build_object('state',state,'errorCode',code,'persistence',persistence,
    'draftId',case when persistence='working-draft' then draft.id else null end,
    'draftVersion',case when persistence='working-draft' then draft.version else null end,
    'draftUpdatedAt',case when persistence='working-draft' then draft.created_at else null end,'candidateHash',digest,'publication','unchanged',
    'humanReview',case when p_candidate is null then 'unchanged' else 'pending' end);
  j.status:=case status when 'succeeded' then 'completed' when 'dead_letter' then 'failed' else status end;
  j.succeeded_items:=case when status='succeeded' then 1 else 0 end;j.failed_items:=case when status='dead_letter' then 1 else 0 end;
  j.version:=j.version+1;j.updated_at:=stamp;j.completed_at:=stamp;
  if not(status='skipped' and jsonb_array_length(a.calls)=0) then
    j.resume_cursor:=a.confirmed_cursor||jsonb_build_object('siteCopyOperation',j.resume_cursor->'siteCopyOperation');
  end if;
  receipt:=premium_translation_private.site_copy_operation_view(a)||jsonb_build_object('phase','finished','blockReason',null,'pendingCallId',null,
    'canExecute',false,'canDispatch',false,'jobVersion',j.version::text,'resumeCursor',j.resume_cursor-'siteCopyOperation','result',result);
  i.status:=case status when 'succeeded' then 'succeeded' when 'cancelled' then 'cancelled' else status end;
  i.attempt_count:=1;i.staff_retry:=null;i.last_error_code:=code;i.updated_at:=stamp;
  attempt:=jsonb_populate_record(null::public.translation_job_attempts,jsonb_build_object(
    'id',nextval('public.translation_job_attempts_id_seq'),'item_id',p_item_id,'attempt_number',1,
    'outcome',case when status='cancelled' then 'skipped' else status end,'provider',a.provider,
    'model',p_outcome->'model','provider_request_id',p_outcome->'requestId','error_code',code,
    'input_tokens',p_outcome->'inputTokens','output_tokens',p_outcome->'outputTokens','duration_ms',p_outcome->'durationMs',
    'created_at',stamp,'staff_retry_operation_id',p_operation_id,'staff_retry_receipt',jsonb_build_object('version',1,
      'actorId',a.actor_id,'intentHash',a.intent_hash,'finishFingerprint',fingerprint,'receipt',receipt,
      'progress',premium_translation_private.site_copy_operation_progress(a.calls))));
  if persistence='working-draft' then a.linked_draft_id:=draft.id;a.linked_draft_version:=draft.version; end if;
  a.candidate_hash:=digest;
  a.candidate:=p_candidate;a.final_receipt:=receipt;a.finish_fingerprint:=fingerprint;
  a.job_write_proof:=to_jsonb(j);a.item_write_proof:=to_jsonb(i);a.attempt_write_proof:=to_jsonb(attempt);
  update premium_translation_private.catalog_operation_artifacts set candidate=a.candidate,final_receipt=receipt,finish_fingerprint=fingerprint,
    linked_draft_id=a.linked_draft_id,linked_draft_version=a.linked_draft_version,candidate_hash=digest,
    job_write_proof=a.job_write_proof,item_write_proof=a.item_write_proof,attempt_write_proof=a.attempt_write_proof where operation_id=p_operation_id;
  insert into public.translation_job_attempts overriding system value select attempt.*;
  update public.translation_job_items set status=i.status,attempt_count=i.attempt_count,staff_retry=null,last_error_code=code,updated_at=stamp where id=p_item_id;
  update public.translation_jobs set status=j.status,succeeded_items=j.succeeded_items,failed_items=j.failed_items,version=j.version,
    updated_at=stamp,completed_at=stamp,resume_cursor=j.resume_cursor where id=p_job_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(a.actor_id,'translation.site_copy_operation.finished','translation_job',p_job_id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'state',state,'persistence',persistence,'candidateHash',digest));
  return receipt;
end; $$;

-- ADDITIVE guard part for parent-only unexecuted admission draft.
create function premium_translation_private.site_copy_operation_complete_valid(a premium_translation_private.catalog_operation_artifacts,candidate jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare first jsonb;last jsonb;n integer;sequence text;begin
 n:=jsonb_array_length(a.calls);
 if n<1 or not premium_translation_private.exact_object(candidate,array['payload','provenance','translatorCallId','reviewerCallId'])
  or octet_length(candidate::text)>1048576 then return false;end if;
 select string_agg(value#>>'{metadata,pass}',',' order by pos) into sequence from jsonb_array_elements(a.calls) with ordinality x(value,pos);
 if a.configuration->'twoPassReview'='true'::jsonb then
  if sequence not in('translation,review','translation,repair,review','translation,review,repair','translation,repair,review,repair') then return false;end if;
 elsif sequence not in('translation','translation,repair') then return false;end if;
 if exists(select 1 from jsonb_array_elements(a.calls) c where c#>'{metadata,responseReceivedAt}'='null'::jsonb or c->'responseArtifact'='null'::jsonb
  or(c#>'{metadata,httpStatus}'<>'null'::jsonb and(c#>>'{metadata,httpStatus}')::integer not between 200 and 299)) then return false;end if;
 first:=a.calls->0->'metadata';last:=a.calls->(n-1)->'metadata';
 if candidate->>'translatorCallId' is distinct from first->>'callId'
  or candidate->>'reviewerCallId' is distinct from(case when n=1 then null else last->>'callId' end)
  or candidate#>>'{provenance,provider}' is distinct from a.provider
  or candidate#>>'{provenance,translatorModel}' is distinct from first->>'model'
  or candidate#>>'{provenance,reviewerModel}' is distinct from(case when n=1 then null else last->>'model' end)
  or candidate#>>'{provenance,translatorRequestId}' is distinct from coalesce(first->>'requestId',first->>'responseId')
  or candidate#>>'{provenance,reviewerRequestId}' is distinct from(case when n=1 then null else coalesce(last->>'requestId',last->>'responseId') end) then return false;end if;
 perform premium_translation_private.assert_shape('site_copy',a.source_snapshot,a.source_revision,a.target_revision,candidate->'payload',candidate->'provenance');
 perform premium_translation_private.assert_site_copy_recorded(a.source_snapshot);return true;
exception when others then return false;end; $$;

create function premium_translation_private.site_copy_operation_cache_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare n integer;previous integer;idx integer;c jsonb;old_call jsonb;d public.premium_translation_working_drafts%rowtype;digest text;j public.translation_jobs%rowtype;
begin
 if tg_op='DELETE' then
  if old.entity_type='site_copy' then raise exception 'Site Copy paid artifacts cannot be deleted' using errcode='42501';end if;return old;
 end if;
 if new.entity_type<>'site_copy' and(tg_op='INSERT' or old.entity_type<>'site_copy') then return new;end if;
 if new.entity_type<>'site_copy' or new.entity_id<>((new.entity_id)::uuid)::text
  or new.confirmed_cursor<>'{}'::jsonb or new.raw_seed_hash<>probpera_translation_operations.retry_fingerprint(new.raw_seed)
  or new.configuration_hash<>probpera_translation_operations.retry_fingerprint(new.configuration)
  or new.intent_hash<>probpera_translation_operations.retry_fingerprint(jsonb_build_array(new.begin_request_hash,new.raw_seed_hash))
  or premium_translation_private.site_copy_operation_configuration_valid(new.configuration,new.provider) is distinct from true
  or premium_translation_private.site_copy_operation_source_valid(new.entity_id,new.source_snapshot,new.source_revision,new.target_revision,new.raw_seed) is distinct from true
  or probpera_translation_operations.retry_journal_valid(premium_translation_private.site_copy_operation_progress(new.calls),new.provider) is distinct from true
  or new.job_write_proof->>'id' is distinct from new.job_id::text or new.job_write_proof->>'kind' is distinct from 'site_copy'
  or new.job_write_proof->>'requested_by' is distinct from new.actor_id::text
  or new.item_write_proof->>'id' is distinct from new.item_id::text or new.item_write_proof->>'job_id' is distinct from new.job_id::text
  or new.item_write_proof->>'entity_type' is distinct from 'site_copy' or new.item_write_proof->>'entity_id' is distinct from new.entity_id
  or new.item_write_proof->>'source_hash' is distinct from new.source_hash
  or new.item_write_proof->>'position' is distinct from '0' or new.item_write_proof->>'max_attempts' is distinct from '1'
  or new.begin_request_hash is distinct from probpera_translation_operations.retry_fingerprint(jsonb_build_array(new.job_id,new.item_id,new.operation_id,new.actor_id,
   new.entity_id,new.provider,new.source_hash,new.source_snapshot,new.source_revision,new.target_revision,new.expected_state,new.configuration)) then
  raise exception 'Invalid Site Copy private artifact proof' using errcode='42501';end if;
 n:=jsonb_array_length(new.calls);
 for c in select value from jsonb_array_elements(new.calls) loop
  if not premium_translation_private.exact_object(c,array['requestHash','metadata','responseArtifact']) or coalesce(c->>'requestHash','')!~'^[a-f0-9]{64}$'
   or(c#>'{metadata,responseReceivedAt}'='null'::jsonb) is distinct from(c->'responseArtifact'='null'::jsonb)
   or(c->'responseArtifact'<>'null'::jsonb and(not premium_translation_private.exact_object(c->'responseArtifact',array['version','body']) or c#>'{responseArtifact,version}' is distinct from '1'::jsonb))
   or c#>>'{metadata,provider}' is distinct from new.provider
   or c#>>'{metadata,model}' is distinct from new.configuration->>(case when c#>>'{metadata,pass}'='translation' then 'model' else 'reviewerModel' end) then
   raise exception 'Invalid Site Copy private call proof' using errcode='42501';end if;
 end loop;
 if new.configuration->'twoPassReview'='false'::jsonb and(n>2 or exists(select 1 from jsonb_array_elements(new.calls) entry(value) where entry.value#>>'{metadata,pass}'='review')) then
  raise exception 'Site Copy review not configured' using errcode='42501';end if;
 if tg_op='INSERT' then
  if n<>0 or new.candidate is not null or new.final_receipt is not null or new.finish_fingerprint is not null or new.linked_draft_id is not null
   or new.linked_draft_version is not null or new.candidate_hash is not null or new.attempt_write_proof is not null
   or new.job_write_proof->>'status' is distinct from 'reviewing' or new.job_write_proof->>'provider' is distinct from new.provider
   or new.item_write_proof->>'status' is distinct from 'reviewing' or new.item_write_proof->>'attempt_count' is distinct from '0'
   or new.item_write_proof#>>'{staff_retry,protocol}' is distinct from 'site-copy-translation'
   or new.item_write_proof#>>'{staff_retry,logicalScope}' is distinct from 'site-copy-overrides'
   or new.item_write_proof#>>'{staff_retry,operationId}' is distinct from new.operation_id::text
   or new.item_write_proof#>>'{staff_retry,actorId}' is distinct from new.actor_id::text
   or new.item_write_proof#>>'{staff_retry,sourceHash}' is distinct from new.source_hash
   or new.item_write_proof#>>'{staff_retry,intentHash}' is distinct from new.intent_hash
   or new.item_write_proof#>>'{staff_retry,rawSeedHash}' is distinct from new.raw_seed_hash
   or new.item_write_proof#>>'{staff_retry,configurationHash}' is distinct from new.configuration_hash
   or new.item_write_proof#>>'{staff_retry,attemptNumber}' is distinct from '1' then
   raise exception 'Invalid initial Site Copy admission proof' using errcode='42501';end if;
  perform premium_translation_private.site_copy_operation_assert_current(new);return new;
 end if;
 if old.entity_type<>'site_copy' or(to_jsonb(new)-array['calls','candidate','final_receipt','finish_fingerprint','linked_draft_id','linked_draft_version','candidate_hash','job_write_proof','item_write_proof','attempt_write_proof'])
  is distinct from(to_jsonb(old)-array['calls','candidate','final_receipt','finish_fingerprint','linked_draft_id','linked_draft_version','candidate_hash','job_write_proof','item_write_proof','attempt_write_proof']) then
  raise exception 'Site Copy admission identity/source is immutable' using errcode='42501';end if;
 if old.final_receipt is not null then
  if to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'Site Copy completed artifacts are immutable' using errcode='42501';end if;return new;
 end if;
 previous:=jsonb_array_length(old.calls);
 if new.final_receipt is null then
  if(to_jsonb(new)-array['calls','item_write_proof']) is distinct from(to_jsonb(old)-array['calls','item_write_proof'])
   or(new.item_write_proof-array['staff_retry','updated_at']) is distinct from(old.item_write_proof-array['staff_retry','updated_at'])
   or((new.item_write_proof->'staff_retry')-'progress') is distinct from((old.item_write_proof->'staff_retry')-'progress')
   or new.item_write_proof#>'{staff_retry,progress}' is distinct from premium_translation_private.site_copy_operation_progress(new.calls) then
   raise exception 'Site Copy call transition cannot replace journal history' using errcode='42501';end if;
  if n=previous+1 then
   select * into j from public.translation_jobs where id=old.job_id for update;
   if previous>=4 or clock_timestamp()>=old.created_at+interval '45 seconds'
    or j.id is null or j.status is distinct from 'reviewing' or j.cancel_requested_at is not null
    or exists(select 1 from jsonb_array_elements(old.calls) entry(value) where entry.value#>'{metadata,responseReceivedAt}'='null'::jsonb)
    or new.calls->previous->'responseArtifact'<>'null'::jsonb then raise exception 'Site Copy call transition stopped or unknown' using errcode='42501';end if;
   if previous>0 then for idx in 0..previous-1 loop if new.calls->idx is distinct from old.calls->idx then raise exception 'Site Copy old call changed' using errcode='42501';end if;end loop;end if;
   -- The exact recorded full source/manual/CAS check holds canonical locks.
   perform premium_translation_private.site_copy_operation_assert_current(old);
  elsif n=previous and n>0 then
   if n>1 then for idx in 0..n-2 loop if new.calls->idx is distinct from old.calls->idx then raise exception 'Site Copy acknowledged call changed' using errcode='42501';end if;end loop;end if;
   c:=new.calls->(n-1);old_call:=old.calls->(n-1);
   if old_call#>'{metadata,responseReceivedAt}'<>'null'::jsonb or c#>'{metadata,responseReceivedAt}'='null'::jsonb
    or c->>'requestHash' is distinct from old_call->>'requestHash'
    or((c->'metadata')-array['responseReceivedAt','httpStatus','requestId','responseId','inputTokens','outputTokens'])
     is distinct from((old_call->'metadata')-array['responseReceivedAt','httpStatus','requestId','responseId','inputTokens','outputTokens']) then
    raise exception 'Site Copy response cannot replace acceptance evidence' using errcode='42501';end if;
  elsif new.calls is distinct from old.calls or new.item_write_proof is distinct from old.item_write_proof then
   raise exception 'Invalid Site Copy call update' using errcode='42501';end if;
  return new;
 end if;
 if new.calls is distinct from old.calls or new.finish_fingerprint is null
  or exists(select 1 from jsonb_array_elements(new.calls) entry(value) where entry.value#>'{metadata,responseReceivedAt}'='null'::jsonb)
  or(n>0 and premium_translation_private.site_copy_operation_complete_valid(new,new.candidate) is distinct from true)
  or(n=0 and(new.candidate is not null or new.candidate_hash is not null or new.linked_draft_id is not null))
  or new.final_receipt->>'phase' is distinct from 'finished' or new.final_receipt->'canExecute' is distinct from 'false'::jsonb or new.final_receipt->'canDispatch' is distinct from 'false'::jsonb
  or new.final_receipt->>'operationId' is distinct from new.operation_id::text or new.final_receipt->>'logicalScope' is distinct from 'site-copy-overrides'
  or new.item_write_proof->'staff_retry' is distinct from 'null'::jsonb or new.item_write_proof->>'attempt_count' is distinct from '1'
  or new.attempt_write_proof->>'staff_retry_operation_id' is distinct from new.operation_id::text then
  raise exception 'Site Copy unknown/partial result cannot become a fresh retry' using errcode='42501';end if;
 if n=0 and(new.attempt_write_proof->'model' is distinct from 'null'::jsonb or new.attempt_write_proof->'provider_request_id' is distinct from 'null'::jsonb
  or new.attempt_write_proof->'input_tokens' is distinct from 'null'::jsonb or new.attempt_write_proof->'output_tokens' is distinct from 'null'::jsonb or new.attempt_write_proof->'duration_ms' is distinct from 'null'::jsonb) then
  raise exception 'Zero-call Site Copy cleanup cannot carry expense fields' using errcode='42501';end if;
 if new.candidate is not null then
  digest:=probpera_translation_operations.retry_fingerprint(jsonb_build_object('entityType','site_copy','entityId',new.entity_id,'targetLocale','en',
   'sourceHash',new.source_hash,'sourceSnapshot',new.source_snapshot,'sourceRevision',new.source_revision,'targetRevision',new.target_revision,
   'payload',new.candidate->'payload','provenance',new.candidate->'provenance'));
  if new.candidate_hash is distinct from digest then raise exception 'Site Copy paid candidate hash differs' using errcode='42501';end if;
 end if;
 if new.linked_draft_id is not null then
  select * into d from public.premium_translation_working_drafts where id=new.linked_draft_id;
  if d.id is null or d.entity_type<>'site_copy' or d.entity_id<>new.entity_id or d.version is distinct from new.linked_draft_version
   or d.candidate_hash is distinct from new.candidate_hash or d.source_hash is distinct from new.source_hash
   or d.source_snapshot is distinct from new.source_snapshot or d.source_revision is distinct from new.source_revision or d.target_revision is distinct from new.target_revision
   or d.payload is distinct from new.candidate->'payload' or d.provenance is distinct from new.candidate->'provenance' then
   raise exception 'Site Copy paid candidate pointer differs' using errcode='42501';end if;
 end if;return new;
end; $$;
create trigger catalog_artifacts_site_copy_private_integrity before insert or update or delete on premium_translation_private.catalog_operation_artifacts
 for each row execute function premium_translation_private.site_copy_operation_cache_guard();

create function premium_translation_private.site_copy_operation_item_guard()
returns trigger language plpgsql security definer set search_path='' as $$ declare a premium_translation_private.catalog_operation_artifacts%rowtype;begin
 if tg_op='INSERT' then
  if new.entity_type<>'site_copy' or new.staff_retry is null then return new;end if;
  select * into a from premium_translation_private.catalog_operation_artifacts where item_id=new.id;
 else
  if old.entity_type<>'site_copy' and new.entity_type<>'site_copy' then return new;end if;
  select * into a from premium_translation_private.catalog_operation_artifacts where item_id=old.id;
 end if;
 if a.operation_id is null then
  if new.staff_retry is not null then raise exception 'Site Copy item requires private admission proof' using errcode='42501';end if;return new;
 end if;
 if a.entity_type<>'site_copy' or to_jsonb(new) is distinct from a.item_write_proof then
  raise exception 'Site Copy item private proof differs' using errcode='42501';end if;return new;
end; $$;
create trigger translation_items_site_copy_integrity before insert or update on public.translation_job_items
 for each row execute function premium_translation_private.site_copy_operation_item_guard();

-- One cache INSERT event checks the reverse cache-to-real-journal direction at
-- COMMIT. Cache-first deferred foreign keys remain valid during construction;
-- neither existing public journal rows nor absent rows can be blindly adopted.
-- The same assertion runs explicitly after the fresh BEGIN inserts, before it
-- returns the one new execution capability. No session flag authorizes a skip.
create function premium_translation_private.site_copy_operation_assert_constructed(p_operation uuid)
returns void language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype;j public.translation_jobs%rowtype;
 i public.translation_job_items%rowtype;t public.translation_job_attempts%rowtype;marker jsonb;progress jsonb;job_matches boolean;
begin
 select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=p_operation;
 if a.operation_id is null or a.entity_type is distinct from 'site_copy' then
  raise exception 'Site Copy admission cache missing or changed' using errcode='42501';end if;
 select * into j from public.translation_jobs where id=a.job_id;
 select * into i from public.translation_job_items where id=a.item_id;
 marker:=jsonb_build_object('version',1,'logicalScope','site-copy-overrides','operationId',a.operation_id,'actorId',a.actor_id,'intentHash',a.intent_hash);
 if j.id is null or i.id is null or j.kind is distinct from 'site_copy' or j.provider is distinct from a.provider
  or j.requested_by is distinct from a.actor_id or j.source_locale is distinct from 'ru' or j.target_locale is distinct from 'en'
  or j.total_items is distinct from 1 or j.created_at is distinct from a.created_at or j.started_at is distinct from a.created_at
  or j.resume_cursor is distinct from jsonb_build_object('siteCopyOperation',marker)
  or i.job_id is distinct from a.job_id or i.entity_type is distinct from 'site_copy' or i.entity_id is distinct from a.entity_id
  or i.source_hash is distinct from a.source_hash or i.position is distinct from 0 or i.max_attempts is distinct from 1
  or i.created_at is distinct from a.created_at or to_jsonb(i) is distinct from a.item_write_proof
  or a.configuration_hash is distinct from probpera_translation_operations.retry_fingerprint(a.configuration)
  or a.raw_seed_hash is distinct from probpera_translation_operations.retry_fingerprint(a.raw_seed)
  or a.begin_request_hash is distinct from probpera_translation_operations.retry_fingerprint(jsonb_build_array(a.job_id,a.item_id,a.operation_id,a.actor_id,
   a.entity_id,a.provider,a.source_hash,a.source_snapshot,a.source_revision,a.target_revision,a.expected_state,a.configuration))
  or a.intent_hash is distinct from probpera_translation_operations.retry_fingerprint(jsonb_build_array(a.begin_request_hash,a.raw_seed_hash)) then
  raise exception 'Site Copy admission actual journal binding differs' using errcode='42501';end if;
 job_matches:=to_jsonb(j)=a.job_write_proof;
 -- Existing catalog journal cancellation is the sole monotonic exception: it
 -- changes only these fields and never grants another dispatch or clears item.
 if not job_matches then
  job_matches:=j.cancel_requested_at is not null and j.status in('cancelling','cancelled')
   and j.version=(a.job_write_proof->>'version')::bigint+1
   and a.job_write_proof->'cancel_requested_at'='null'::jsonb
   and(to_jsonb(j)-array['cancel_requested_at','status','version','updated_at','completed_at'])=
      (a.job_write_proof-array['cancel_requested_at','status','version','updated_at','completed_at']);
 end if;
 if job_matches is distinct from true then
  raise exception 'Site Copy admission actual job proof differs' using errcode='42501';end if;
 if a.final_receipt is null then
  progress:=case when jsonb_array_length(a.calls)=0 then jsonb_build_object('version',1,'updatedAt',a.created_at,'calls','[]'::jsonb)
   else premium_translation_private.site_copy_operation_progress(a.calls) end;
  marker:=jsonb_build_object('version',1,'protocol','site-copy-translation','logicalScope','site-copy-overrides','operationId',a.operation_id,'actorId',a.actor_id,
   'sourceHash',a.source_hash,'intentHash',a.intent_hash,'rawSeedHash',a.raw_seed_hash,'configurationHash',a.configuration_hash,'startedAt',a.created_at,
   'attemptNumber',1,'progress',progress);
  if i.staff_retry is distinct from marker or i.attempt_count is distinct from 0 or i.status is distinct from 'reviewing'
   or a.attempt_write_proof is not null or exists(select 1 from public.translation_job_attempts where item_id=a.item_id or staff_retry_operation_id=a.operation_id) then
   raise exception 'Site Copy unfinished admission attempt proof differs' using errcode='42501';end if;
 else
  if a.attempt_write_proof is null or i.staff_retry is not null or i.attempt_count is distinct from 1 then
   raise exception 'Site Copy completed admission lacks actual attempt proof' using errcode='42501';end if;
  select * into t from public.translation_job_attempts where id=(a.attempt_write_proof->>'id')::bigint;
  if t.id is null or t.item_id is distinct from a.item_id or t.attempt_number is distinct from 1 or t.provider is distinct from a.provider
   or t.staff_retry_operation_id is distinct from a.operation_id or to_jsonb(t) is distinct from a.attempt_write_proof
   or t.staff_retry_receipt->>'actorId' is distinct from a.actor_id::text
   or t.staff_retry_receipt->>'intentHash' is distinct from a.intent_hash
   or t.staff_retry_receipt->>'finishFingerprint' is distinct from a.finish_fingerprint
   or t.staff_retry_receipt->'receipt' is distinct from a.final_receipt
   or t.staff_retry_receipt->'progress' is distinct from premium_translation_private.site_copy_operation_progress(a.calls)
   or(select count(*) from public.translation_job_attempts where item_id=a.item_id or staff_retry_operation_id=a.operation_id)<>1 then
   raise exception 'Site Copy completed admission actual attempt differs' using errcode='42501';end if;
 end if;
end; $$;
create function premium_translation_private.site_copy_operation_cache_commit_guard()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 perform premium_translation_private.site_copy_operation_assert_constructed(new.operation_id);return null;
end; $$;
create constraint trigger catalog_artifacts_site_copy_admission_complete
 after insert on premium_translation_private.catalog_operation_artifacts deferrable initially deferred
 for each row when(new.entity_type='site_copy') execute function premium_translation_private.site_copy_operation_cache_commit_guard();

-- Linked site-copy candidates are immutable; explicit DELETE/discard remains.
-- The completed private cache keeps the paid body after consumption/discard.
create function premium_translation_private.site_copy_linked_candidate_update_guard()
returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='INSERT' then
  if exists(select 1 from premium_translation_private.catalog_operation_artifacts where entity_type='site_copy' and linked_draft_id=new.id) then
   raise exception 'Consumed Site Copy candidate UUID cannot be reused' using errcode='42501';end if;return new;
 end if;
 if new.id is distinct from old.id and exists(select 1 from premium_translation_private.catalog_operation_artifacts where entity_type='site_copy' and linked_draft_id=new.id) then
  raise exception 'Consumed Site Copy candidate UUID cannot be reused' using errcode='42501';end if;
 if exists(select 1 from premium_translation_private.catalog_operation_artifacts where entity_type='site_copy' and linked_draft_id=old.id)
  and to_jsonb(new) is distinct from to_jsonb(old) then
  raise exception 'Linked Site Copy candidate is immutable' using errcode='42501';end if;return new;
end; $$;
create trigger premium_site_copy_linked_candidate_immutable before insert or update on public.premium_translation_working_drafts
 for each row execute function premium_translation_private.site_copy_linked_candidate_update_guard();

create function premium_translation_private.site_copy_paid_approval_settings(d public.premium_translation_working_drafts,b public.homepage_blocks,human jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare translations jsonb;english jsonb;meta jsonb;machine jsonb;item jsonb;source_item jsonb;k text;idx integer;begin
 if not premium_translation_private.exact_object(human,array['status','reviewedBy','reviewedAt']) or human->>'status'<>'approved'
  or (human->>'reviewedBy')::uuid is distinct from auth.uid() or not premium_translation_private.valid_timestamp(human->>'reviewedAt') then
  raise exception 'Invalid Site Copy human approval marker' using errcode='40001';end if;
 perform premium_translation_private.assert_shape('site_copy',d.source_snapshot,d.source_revision,d.target_revision,d.payload,d.provenance);
 translations:=b.settings->'siteCopy';english:=case when jsonb_typeof(translations->'en')='object' then translations->'en' else '{}'::jsonb end;
 meta:=case when jsonb_typeof(b.settings->'premiumTranslation')='object' then b.settings->'premiumTranslation' else '{}'::jsonb end;
 machine:=case when jsonb_typeof(meta->'siteCopyEn')='object' then meta->'siteCopyEn' else '{}'::jsonb end;
 for idx in 0..jsonb_array_length(d.payload->'items')-1 loop
  item:=d.payload->'items'->idx;source_item:=d.source_snapshot->'items'->idx;k:=item->>'key';
  machine:=machine||jsonb_build_object(k,coalesce(machine->k,'{}'::jsonb)||jsonb_build_object('sourceHash',source_item->'sourceHash',
   'provider',d.provenance->'provider','model',d.provenance->'translatorModel','reviewerModel',d.provenance->'reviewerModel','generatedAt',d.provenance->'generatedAt',
   'translatorRequestId',d.provenance->'translatorRequestId','reviewerRequestId',d.provenance->'reviewerRequestId',
   'humanReview',human,'reviewedBy',human->'reviewedBy','reviewedAt',human->'reviewedAt'));
  english:=english||jsonb_build_object(k,item->'text');
 end loop;
 return b.settings||jsonb_build_object('siteCopy',translations||jsonb_build_object('en',english),'premiumTranslation',meta||jsonb_build_object('siteCopyEn',machine));
end; $$;

create function premium_translation_private.site_copy_paid_promotion_guard()
returns trigger language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare changed boolean;d public.premium_translation_working_drafts%rowtype;selected public.premium_translation_working_drafts%rowtype;
 a premium_translation_private.catalog_operation_artifacts%rowtype;human jsonb;expected jsonb;k text;matches integer:=0;begin
 if old.settings->>'systemKey' is distinct from 'site-copy-overrides' then return new;end if;
 select exists(select 1 from jsonb_each(case when jsonb_typeof(new.settings#>'{premiumTranslation,siteCopyEn}')='object' then new.settings#>'{premiumTranslation,siteCopyEn}' else '{}'::jsonb end)m
  where m.value#>>'{humanReview,status}'='approved' and(m.value->'humanReview' is distinct from old.settings#>array['premiumTranslation','siteCopyEn',m.key,'humanReview']
   or new.settings#>array['siteCopy','en',m.key] is distinct from old.settings#>array['siteCopy','en',m.key])) into changed;
 if not changed then return new;end if;
 -- Recognize the actual pending pointer by the exact old promotion layout,
 -- not a caller GUC, query text, cache-history guess or UI freshness decision.
 for d in select * from public.premium_translation_working_drafts where entity_type='site_copy' and lower(entity_id)=old.id::text loop
  begin
   k:=d.payload#>>'{items,0,key}';human:=new.settings#>array['premiumTranslation','siteCopyEn',k,'humanReview'];
   expected:=premium_translation_private.site_copy_paid_approval_settings(d,old,human);
   if expected=new.settings then selected:=d;matches:=matches+1;end if;
  exception when invalid_parameter_value or invalid_text_representation or serialization_failure then null;
  end;
 end loop;
 -- Ordinary authored saves/history-shaped restores may change approved text
 -- independently. The actual old promotion always produces its exact pending
 -- layout, so only an ambiguous match is refused before UUID-first linkage.
 if matches=0 then return new;end if;
 if matches>1 then raise exception 'Site Copy approval pending pointer is ambiguous' using errcode='40001';end if;
 -- Actual draft UUID first, with no identity/hash-only legacy downgrade.
 select * into a from premium_translation_private.catalog_operation_artifacts where linked_draft_id=selected.id;
 if a.operation_id is null then return new;end if;
 perform premium_translation_private.assert_actor();
 perform premium_translation_private.site_copy_operation_assert_paid_candidate(selected,old);
 if new.updated_by is distinct from auth.uid()
  or(to_jsonb(new)-array['settings','updated_at','updated_by']) is distinct from(to_jsonb(old)-array['settings','updated_at','updated_by'])
  then
  raise exception 'Site Copy paid approval source/candidate/cache changed' using errcode='40001';end if;
 return new;
end; $$;
create trigger homepage_blocks_site_copy_paid_approval before update of settings on public.homepage_blocks
 for each row execute function premium_translation_private.site_copy_paid_promotion_guard();

create function public.site_copy_translation_operation_ready()
returns boolean language plpgsql stable security definer set search_path='' as $$ declare signature text;begin
 perform premium_translation_private.assert_actor();
 foreach signature in array array[
  'public.begin_site_copy_translation_operation(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,jsonb)',
  'public.reconcile_site_copy_translation_operation(uuid)',
  'public.get_site_copy_translation_operation_artifacts(uuid,uuid,uuid,text,text,text)',
  'public.record_site_copy_translation_operation_dispatch(uuid,uuid,uuid,uuid,text,text,text,text)',
  'public.record_site_copy_translation_operation_response(uuid,uuid,uuid,jsonb,jsonb)',
  'public.finish_site_copy_translation_operation(uuid,uuid,uuid,jsonb,jsonb)',
  'public.get_site_copy_translation_candidate_freshness(text,uuid,bigint,text,text)'] loop
  if to_regprocedure(signature) is null then return false;end if;
 end loop;
 return exists(select 1 from pg_index where indexrelid=to_regclass('public.translation_site_copy_active_operation_unique') and indisunique and indisvalid)
  and(select count(*)=4 from pg_trigger where tgenabled='O' and not tgisinternal and tgname in('catalog_artifacts_site_copy_private_integrity','translation_items_site_copy_integrity','premium_site_copy_linked_candidate_immutable','homepage_blocks_site_copy_paid_approval'))
  and exists(select 1 from pg_trigger where tgrelid='premium_translation_private.catalog_operation_artifacts'::regclass
   and tgname='catalog_artifacts_site_copy_admission_complete' and tgenabled='O' and tgdeferrable and tginitdeferred
   and tgfoid='premium_translation_private.site_copy_operation_cache_commit_guard()'::regprocedure);
end; $$;


-- Shared private proof for the actual CMS OLD row and staff metadata read.
-- Cache lookup starts with the actual pending draft UUID and takes no cache
-- row lock, preserving the existing per-entity/draft/singleton/row order.
create function premium_translation_private.site_copy_operation_assert_paid_candidate(d public.premium_translation_working_drafts,b public.homepage_blocks)
returns void language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype;count_blocks integer;begin
 select * into a from premium_translation_private.catalog_operation_artifacts where linked_draft_id=d.id;
 select count(*) into count_blocks from public.homepage_blocks where settings @> '{"systemKey":"site-copy-overrides"}';
 if a.operation_id is null or b.id is null or count_blocks<>1 or b.settings->>'systemKey' is distinct from 'site-copy-overrides'
  or a.entity_type is distinct from 'site_copy' or d.entity_type is distinct from 'site_copy' or a.entity_id is distinct from b.id::text
  or d.entity_id is distinct from a.entity_id or a.final_receipt is null or a.actor_id is distinct from d.created_by
  or a.linked_draft_version is distinct from d.version or a.candidate_hash is distinct from d.candidate_hash
  or a.source_hash is distinct from d.source_hash or a.source_snapshot is distinct from d.source_snapshot
  or a.source_revision is distinct from d.source_revision or a.target_revision is distinct from d.target_revision
  or a.candidate->'payload' is distinct from d.payload or a.candidate->'provenance' is distinct from d.provenance
  or a.final_receipt#>>'{result,persistence}' is distinct from 'working-draft'
  or a.final_receipt#>>'{result,draftId}' is distinct from d.id::text
  or a.final_receipt#>>'{result,draftVersion}' is distinct from d.version::text
  or a.final_receipt#>>'{result,candidateHash}' is distinct from d.candidate_hash
  or to_jsonb(b) is distinct from a.raw_seed->'block' or d.source_snapshot->'settings' is distinct from b.settings
  or (d.target_revision->>'id')::uuid is distinct from b.id or (d.target_revision->>'updatedAt')::timestamptz is distinct from b.updated_at
  or premium_translation_private.site_copy_operation_complete_valid(a,a.candidate) is distinct from true then
  raise exception 'Site Copy paid approval source/candidate/cache changed' using errcode='40001';end if;
end; $$;

-- Metadata only: a fresh staff reviewer may inspect linkage/full-row freshness
-- without obtaining the owner's private response artifacts or expense flags.
create function public.get_site_copy_translation_candidate_freshness(
 p_entity_id text,p_draft_id uuid,p_expected_version bigint,p_candidate_hash text,p_source_hash text)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare d public.premium_translation_working_drafts%rowtype;b public.homepage_blocks%rowtype;linked boolean;envelope jsonb;begin
 perform premium_translation_private.assert_actor();perform premium_translation_private.assert_identity('site_copy',p_entity_id);
 if not probpera_translation_operations.retry_uuid(p_draft_id) or p_expected_version is null or p_expected_version not between 1 and 9007199254740991
  or coalesce(p_candidate_hash,'')!~'^[a-f0-9]{64}$' or coalesce(p_source_hash,'')!~'^[a-f0-9]{64}$' then
  raise exception 'Invalid Site Copy candidate freshness binding' using errcode='22023';end if;
 envelope:=jsonb_build_object('version',1,'entityType','site_copy','entityId',p_entity_id,'draftId',p_draft_id,'draftVersion',p_expected_version,'candidateHash',p_candidate_hash,'sourceHash',p_source_hash);
 -- Exact legacy entity text remains the old pending/promote identity.
 perform pg_advisory_xact_lock(hashtextextended('premium-translation:site_copy:'||p_entity_id,0));
 select * into d from public.premium_translation_working_drafts where id=p_draft_id for share;
 if d.id is null then return envelope||jsonb_build_object('linked',false,'canPromote',false,'reason','candidate_missing');end if;
 if d.entity_type is distinct from 'site_copy' or d.entity_id is distinct from p_entity_id then
  return envelope||jsonb_build_object('linked',false,'canPromote',false,'reason','candidate_changed');end if;
 select exists(select 1 from premium_translation_private.catalog_operation_artifacts where linked_draft_id=d.id) into linked;
 if d.version is distinct from p_expected_version or d.candidate_hash is distinct from p_candidate_hash or d.source_hash is distinct from p_source_hash then
  return envelope||jsonb_build_object('linked',linked,'canPromote',false,'reason','candidate_changed');end if;
 if not linked then
  return envelope||jsonb_build_object('linked',false,'canPromote',true,'reason',null);end if;
 begin
  perform pg_advisory_xact_lock(188654771,2);
  select * into b from public.homepage_blocks where id=p_entity_id::uuid for update;
  perform premium_translation_private.site_copy_operation_assert_paid_candidate(d,b);
 exception when serialization_failure then
  return envelope||jsonb_build_object('linked',true,'canPromote',false,'reason','source_changed');
 end;
 return envelope||jsonb_build_object('linked',true,'canPromote',true,'reason',null);
end; $$;

revoke all on function premium_translation_private.site_copy_operation_configuration_valid(jsonb,text),
 premium_translation_private.site_copy_operation_progress(jsonb),
 premium_translation_private.site_copy_operation_scope_lock(),
 premium_translation_private.site_copy_operation_source_valid(text,jsonb,jsonb,jsonb,jsonb),
 premium_translation_private.site_copy_operation_capture(text,jsonb),
 premium_translation_private.site_copy_operation_assert_current(premium_translation_private.catalog_operation_artifacts),
 premium_translation_private.site_copy_operation_owned(uuid,uuid,uuid),
 premium_translation_private.site_copy_operation_view(premium_translation_private.catalog_operation_artifacts,boolean,boolean,boolean),
 premium_translation_private.site_copy_operation_complete_valid(premium_translation_private.catalog_operation_artifacts,jsonb),
 premium_translation_private.site_copy_operation_cache_guard(),
 premium_translation_private.site_copy_operation_item_guard(),
 premium_translation_private.site_copy_operation_assert_constructed(uuid),
 premium_translation_private.site_copy_operation_cache_commit_guard(),
 premium_translation_private.site_copy_linked_candidate_update_guard(),
 premium_translation_private.site_copy_paid_approval_settings(public.premium_translation_working_drafts,public.homepage_blocks,jsonb),
 premium_translation_private.site_copy_paid_promotion_guard(),
 premium_translation_private.site_copy_operation_assert_paid_candidate(public.premium_translation_working_drafts,public.homepage_blocks) from public,anon,authenticated,service_role;
revoke all on function public.reconcile_site_copy_translation_operation(uuid),
 public.get_site_copy_translation_operation_artifacts(uuid,uuid,uuid,text,text,text),
 public.begin_site_copy_translation_operation(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,jsonb),
 public.record_site_copy_translation_operation_dispatch(uuid,uuid,uuid,uuid,text,text,text,text),
 public.record_site_copy_translation_operation_response(uuid,uuid,uuid,jsonb,jsonb),
 public.finish_site_copy_translation_operation(uuid,uuid,uuid,jsonb,jsonb),
 public.site_copy_translation_operation_ready(),
 public.get_site_copy_translation_candidate_freshness(text,uuid,bigint,text,text) from public,anon,authenticated,service_role;
grant execute on function public.reconcile_site_copy_translation_operation(uuid),
 public.get_site_copy_translation_operation_artifacts(uuid,uuid,uuid,text,text,text),
 public.begin_site_copy_translation_operation(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,jsonb),
 public.record_site_copy_translation_operation_dispatch(uuid,uuid,uuid,uuid,text,text,text,text),
 public.record_site_copy_translation_operation_response(uuid,uuid,uuid,jsonb,jsonb),
 public.finish_site_copy_translation_operation(uuid,uuid,uuid,jsonb,jsonb),
 public.site_copy_translation_operation_ready(),
 public.get_site_copy_translation_candidate_freshness(text,uuid,bigint,text,text) to authenticated;
commit;
