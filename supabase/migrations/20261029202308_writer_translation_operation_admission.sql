-- Writer provider admission reuses Translation Operations. This private table
-- is an artifact cache, not a queue: scheduling/status/attempts stay in the
-- existing public journal. Unknown dispatches never expire into a new request.
begin;

create table premium_translation_private.writer_operation_artifacts (
  operation_id uuid primary key,
  job_id uuid not null unique references public.translation_jobs(id) on delete restrict deferrable initially deferred,
  item_id uuid not null unique references public.translation_job_items(id) on delete restrict deferrable initially deferred,
  actor_id uuid not null references auth.users(id) on delete restrict,
  entity_id text not null,
  provider text not null check(provider in ('openai','cloudflare')),
  source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
  intent_hash text not null check(intent_hash ~ '^[a-f0-9]{64}$'),
  configuration_hash text not null,
  configuration jsonb not null,
  source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object' and octet_length(source_snapshot::text)<=1048576),
  source_revision jsonb not null,
  target_revision jsonb not null,
  expected_override_fields jsonb check(expected_override_fields is null or (jsonb_typeof(expected_override_fields)='object' and octet_length(expected_override_fields::text)<=1048576)),
  confirmed_cursor jsonb not null,
  calls jsonb not null default '[]'::jsonb check(jsonb_typeof(calls)='array' and jsonb_array_length(calls)<=4 and octet_length(calls::text)<=1048576),
  candidate jsonb,
  final_receipt jsonb,
  finish_fingerprint text,
  job_write_proof jsonb not null,
  item_write_proof jsonb not null,
  attempt_write_proof jsonb,
  created_at timestamptz not null default clock_timestamp()
);
alter table premium_translation_private.writer_operation_artifacts enable row level security;
alter table premium_translation_private.writer_operation_artifacts force row level security;
revoke all on premium_translation_private.writer_operation_artifacts from public,anon,authenticated,service_role;

create unique index translation_writer_active_operation_unique
  on public.translation_job_items(entity_type,entity_id)
  where entity_type='writer' and staff_retry is not null;

create function premium_translation_private.writer_operation_configuration_valid(v jsonb,p text)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text;
begin
  if not premium_translation_private.exact_object(v,array['version','provider','model','reviewerModel','promptFingerprint',
    'translatorReasoningEffort','translatorReasoningMode','reviewerReasoningEffort','reviewerReasoningMode',
    'schemaName','maxOutputTokens','twoPassReview']) or v->'version' is distinct from '1'::jsonb
    or v->>'provider' is distinct from p or v->>'schemaName' is distinct from 'probpera_writer_biography_translation'
    or v->'maxOutputTokens' is distinct from '4000'::jsonb or v->'twoPassReview' is distinct from 'true'::jsonb
    or jsonb_typeof(v->'promptFingerprint') is distinct from 'string' or v->>'promptFingerprint' !~ '^[a-f0-9]{64}$'
    or octet_length(v::text)>4096 then return false; end if;
  foreach k in array array['model','reviewerModel'] loop
    if jsonb_typeof(v->k) is distinct from 'string' or char_length(v->>k) not between 1 and 200
      or (v->>k) ~ '[[:cntrl:]]' then return false; end if;
  end loop;
  foreach k in array array['translatorReasoningEffort','reviewerReasoningEffort'] loop
    if jsonb_typeof(v->k) is distinct from 'string' or (v->>k) not in ('none','low','medium','high','xhigh','max') then return false; end if;
  end loop;
  foreach k in array array['translatorReasoningMode','reviewerReasoningMode'] loop
    if jsonb_typeof(v->k) is distinct from 'string' or (v->>k) not in ('standard','pro') then return false; end if;
  end loop;
  return true;
end; $$;

create function premium_translation_private.writer_operation_source_valid(s jsonb,r jsonb,t jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare ru jsonb;
begin
  if not premium_translation_private.exact_object(r,array['countryId','writerId','overrideId','overrideUpdatedAt','catalogSourceHash','replaceEnglishTombstone'])
    or not premium_translation_private.valid_revision(t)
    or t is distinct from jsonb_build_object('id',r->'overrideId','updatedAt',r->'overrideUpdatedAt')
    or jsonb_typeof(r->'countryId') is distinct from 'string' or jsonb_typeof(r->'writerId') is distinct from 'string'
    or jsonb_typeof(r->'replaceEnglishTombstone') is distinct from 'boolean'
    or coalesce(r->>'catalogSourceHash','') !~ '^[a-f0-9]{64}$'
    or not premium_translation_private.exact_object(s,array['writerName','text','sourceLanguage','sources','russianProfile','catalogFields'])
    or jsonb_typeof(s->'writerName') is distinct from 'string' or jsonb_typeof(s->'text') is distinct from 'string'
    or jsonb_typeof(s->'sourceLanguage') is distinct from 'string' or jsonb_typeof(s->'russianProfile') is distinct from 'object'
    or jsonb_typeof(s->'catalogFields') is distinct from 'object' or jsonb_typeof(s->'sources') is distinct from 'array'
    or octet_length(s::text)>1048576 then return false; end if;
  perform premium_translation_private.assert_identity('writer_biography',(r->>'countryId')||':'||(r->>'writerId'));
  ru:=s->'russianProfile';
  return coalesce(ru->>'locale'='ru' and ru->>'method'='editorial-original' and ru->>'status' in ('reviewed','verified')
    and jsonb_typeof(ru->'reviewedAt')='string' and ru->>'reviewedAt'<>''
    and jsonb_typeof(ru->'text')='string' and jsonb_typeof(ru->'sourceLanguage')='string'
    and jsonb_typeof(ru->'sources')='array'
    and s->>'text'=premium_translation_private.trim_text(ru->>'text')
    and s->>'sourceLanguage'=premium_translation_private.trim_text(ru->>'sourceLanguage')
    and s->'sources'=premium_translation_private.writer_source_projection(ru->'sources')
    and jsonb_array_length(s->'sources')>0,false);
exception when others then return false;
end; $$;

create function premium_translation_private.writer_operation_progress(c jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('version',1,'updatedAt',coalesce(nullif(c->(jsonb_array_length(c)-1)->'metadata'->'responseReceivedAt','null'::jsonb),
      c->(jsonb_array_length(c)-1)->'metadata'->'dispatchRecordedAt',to_jsonb('1970-01-01T00:00:00Z'::text)),
    'calls',coalesce(jsonb_agg(value->'metadata' order by n),'[]'::jsonb))
  from jsonb_array_elements(c) with ordinality x(value,n);
$$;

create function premium_translation_private.writer_operation_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare a premium_translation_private.writer_operation_artifacts%rowtype; identity uuid;
begin
  if tg_table_name='translation_jobs' then
    identity:=case when tg_op='INSERT' then new.id else old.id end;
    select * into a from premium_translation_private.writer_operation_artifacts where job_id=identity;
    if a.operation_id is null then return case when tg_op='DELETE' then old else new end; end if;
    if tg_op='DELETE' then raise exception 'Writer operation journal cannot be deleted' using errcode='42501'; end if;
    if to_jsonb(new)=a.job_write_proof then return new; end if;
    -- Existing cancellation is monotonic. It stops further dispatch, but cannot
    -- erase an admission, change a cursor or turn an unknown response into retry.
    if tg_op='UPDATE' and auth.uid()=a.actor_id and public.is_staff()
      and new.cancel_requested_at is not null and (old.cancel_requested_at is null or new.cancel_requested_at=old.cancel_requested_at)
      and new.status in ('cancelling','cancelled') and new.version=old.version+1
      and (to_jsonb(new)-array['cancel_requested_at','status','version','updated_at','completed_at'])=
          (to_jsonb(old)-array['cancel_requested_at','status','version','updated_at','completed_at']) then return new; end if;
  elsif tg_table_name='translation_job_items' then
    identity:=case when tg_op='INSERT' then new.id else old.id end;
    select * into a from premium_translation_private.writer_operation_artifacts where item_id=identity;
    if a.operation_id is null then
      if (tg_op<>'DELETE' and new.entity_type='writer' and new.staff_retry is not null)
        or (tg_op<>'INSERT' and old.entity_type='writer' and old.staff_retry is not null) then
        raise exception 'Writer operation requires private admission proof' using errcode='42501'; end if;
      return case when tg_op='DELETE' then old else new end;
    end if;
    if tg_op='DELETE' then raise exception 'Writer operation item cannot be deleted' using errcode='42501'; end if;
    if to_jsonb(new)=a.item_write_proof then return new; end if;
  else
    identity:=case when tg_op='INSERT' then new.item_id else old.item_id end;
    select * into a from premium_translation_private.writer_operation_artifacts where item_id=identity;
    if a.operation_id is null then return case when tg_op='DELETE' then old else new end; end if;
    if tg_op='INSERT' and to_jsonb(new)=a.attempt_write_proof then return new; end if;
  end if;
  raise exception 'Writer operation private journal proof differs' using errcode='42501';
end; $$;
create trigger translation_jobs_writer_integrity before insert or update or delete on public.translation_jobs
  for each row execute function premium_translation_private.writer_operation_guard();
create trigger translation_items_writer_integrity before insert or update or delete on public.translation_job_items
  for each row execute function premium_translation_private.writer_operation_guard();
create trigger translation_attempts_writer_integrity before insert or update or delete on public.translation_job_attempts
  for each row execute function premium_translation_private.writer_operation_guard();

create function premium_translation_private.writer_operation_view(a premium_translation_private.writer_operation_artifacts,
  replayed boolean default false, execute_allowed boolean default false, dispatch_allowed boolean default false)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare j public.translation_jobs%rowtype; pending text; reason text; phase text:='running';
begin
  select * into j from public.translation_jobs where id=a.job_id;
  select value->'metadata'->>'callId' into pending from jsonb_array_elements(a.calls)
    where value->'metadata'->'responseReceivedAt'='null'::jsonb limit 1;
  if a.final_receipt is not null then
    return a.final_receipt||jsonb_build_object('replayed',replayed,'canExecute',false,'canDispatch',false);
  elsif auth.uid() is distinct from a.actor_id then reason:='operation_owned_by_another_actor';phase:='blocked';
  elsif pending is not null and not dispatch_allowed then reason:='provider_outcome_unknown';phase:='blocked';
  elsif j.cancel_requested_at is not null then reason:='operation_stopped';phase:='blocked'; end if;
  return jsonb_build_object('version',1,'jobId',a.job_id,'itemId',a.item_id,'operationId',a.operation_id,
    'entityId',a.entity_id,'countryId',a.source_revision->'countryId','writerId',a.source_revision->'writerId',
    'actorId',a.actor_id,'provider',a.provider,'sourceHash',a.source_hash,'intentHash',a.intent_hash,
    'configurationHash',a.configuration_hash,'configuration',a.configuration,
    'sourceRevision',a.source_revision,'targetRevision',a.target_revision,'jobVersion',j.version::text,
    'phase',phase,'canExecute',execute_allowed and reason is null,'canDispatch',dispatch_allowed,
    'replayed',replayed,'providerCalls',jsonb_array_length(a.calls),'pendingCallId',pending,'blockReason',reason,
    'resumeCursor',j.resume_cursor-'writerOperation','result',null);
end; $$;

create function public.finish_writer_translation_operation(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_outcome jsonb,p_candidate jsonb default null
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.writer_operation_artifacts%rowtype; j public.translation_jobs%rowtype;
  i public.translation_job_items%rowtype; attempt public.translation_job_attempts%rowtype;
  draft public.premium_translation_working_drafts%rowtype; w public.writer_profile_overrides%rowtype;
  fingerprint text; digest text; status text; code text; state text; persistence text:='none'; result jsonb; receipt jsonb;
  first_call jsonb; last_call jsonb; stamp timestamptz:=clock_timestamp(); current_bound boolean:=true;
begin
  a:=premium_translation_private.writer_operation_owned(p_job_id,p_item_id,p_operation_id);
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
    raise exception 'Invalid writer finish outcome' using errcode='22023'; end if;
  fingerprint:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_outcome,p_candidate));
  if a.final_receipt is not null then
    if a.finish_fingerprint is distinct from fingerprint then raise exception 'Writer finish intent differs' using errcode='40001'; end if;
    return premium_translation_private.writer_operation_view(a,true);
  end if;
  if exists(select 1 from jsonb_array_elements(a.calls) value where value->'metadata'->'responseReceivedAt'='null'::jsonb) then
    raise exception 'Writer provider outcome remains unknown' using errcode='40001'; end if;
  select * into j from public.translation_jobs where id=p_job_id for update;
  select * into i from public.translation_job_items where id=p_item_id for update;
  status:=p_outcome->>'status';code:=p_outcome->>'errorCode';
  if (status='succeeded') is distinct from (p_candidate is not null) then
    raise exception 'Writer completed candidate required only for success' using errcode='22023'; end if;
  if p_candidate is not null then
    if not premium_translation_private.exact_object(p_candidate,array['payload','provenance','translatorCallId','reviewerCallId'])
      or jsonb_array_length(a.calls)<2 or octet_length(p_candidate::text)>32768
      or not exists(select 1 from jsonb_array_elements(a.calls) value where value->'metadata'->>'pass'='review') then
      raise exception 'Writer independent review proof missing' using errcode='22023'; end if;
    first_call:=a.calls->0->'metadata';last_call:=a.calls->(jsonb_array_length(a.calls)-1)->'metadata';
    if p_candidate->>'translatorCallId' is distinct from first_call->>'callId'
      or p_candidate->>'reviewerCallId' is distinct from last_call->>'callId'
      or p_candidate->'provenance'->>'provider' is distinct from a.provider
      or p_candidate->'provenance'->>'translatorModel' is distinct from first_call->>'model'
      or p_candidate->'provenance'->>'reviewerModel' is distinct from last_call->>'model'
      or p_candidate->'provenance'->>'translatorRequestId' is distinct from coalesce(first_call->>'requestId',first_call->>'responseId')
      or p_candidate->'provenance'->>'reviewerRequestId' is distinct from coalesce(last_call->>'requestId',last_call->>'responseId') then
      raise exception 'Writer candidate provider evidence differs' using errcode='40001'; end if;
    perform premium_translation_private.assert_shape('writer_biography',a.source_snapshot,a.source_revision,a.target_revision,
      p_candidate->'payload',p_candidate->'provenance');
    -- Promotion takes draft -> canonical row locks; use the same order.
    perform pg_advisory_xact_lock(hashtextextended('premium-translation:writer_biography:'||a.entity_id,0));
    select * into draft from public.premium_translation_working_drafts where entity_type='writer_biography' and entity_id=a.entity_id for update;
    begin
      perform premium_translation_private.writer_operation_assert_current(a);
    exception when serialization_failure then current_bound:=false; end;
    if not current_bound then
      select * into w from public.writer_profile_overrides where country_id=a.source_revision->>'countryId' and writer_id=a.source_revision->>'writerId';
      if (a.source_snapshot->'catalogFields'||coalesce(w.fields,'{}'::jsonb))->'biographyTranslations'->'ru'
        is distinct from a.source_snapshot->'russianProfile' or (w.id is null and a.target_revision->>'id' is not null) then
        status:='stale';code:='source_changed';
      else status:='conflict';code:='write_conflict'; end if;
    end if;
    digest:=probpera_translation_operations.retry_fingerprint(jsonb_build_object('entityType','writer_biography','entityId',a.entity_id,
      'targetLocale','en','sourceHash',a.source_hash,'sourceSnapshot',a.source_snapshot,'sourceRevision',a.source_revision,
      'targetRevision',a.target_revision,'payload',p_candidate->'payload','provenance',p_candidate->'provenance'));
    -- A fully validated body is retained independently of live CAS/cancel.
    -- Existing pending author/review work is never replaced.
    if draft.id is null then
      insert into public.premium_translation_working_drafts(entity_type,entity_id,source_hash,candidate_hash,source_snapshot,
        source_revision,target_revision,payload,provenance,created_by)
        values('writer_biography',a.entity_id,a.source_hash,digest,a.source_snapshot,a.source_revision,a.target_revision,
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
    j.resume_cursor:=a.confirmed_cursor||jsonb_build_object('writerOperation',j.resume_cursor->'writerOperation');
  end if;
  receipt:=premium_translation_private.writer_operation_view(a)||jsonb_build_object('phase','finished','blockReason',null,'pendingCallId',null,
    'canExecute',false,'canDispatch',false,'jobVersion',j.version::text,'resumeCursor',j.resume_cursor-'writerOperation','result',result);
  i.status:=case status when 'succeeded' then 'succeeded' when 'cancelled' then 'cancelled' else status end;
  i.attempt_count:=1;i.staff_retry:=null;i.last_error_code:=code;i.updated_at:=stamp;
  attempt:=jsonb_populate_record(null::public.translation_job_attempts,jsonb_build_object(
    'id',nextval('public.translation_job_attempts_id_seq'),'item_id',p_item_id,'attempt_number',1,
    'outcome',case when status='cancelled' then 'skipped' else status end,'provider',a.provider,
    'model',p_outcome->'model','provider_request_id',p_outcome->'requestId','error_code',code,
    'input_tokens',p_outcome->'inputTokens','output_tokens',p_outcome->'outputTokens','duration_ms',p_outcome->'durationMs',
    'created_at',stamp,'staff_retry_operation_id',p_operation_id,'staff_retry_receipt',jsonb_build_object('version',1,
      'actorId',a.actor_id,'intentHash',a.intent_hash,'finishFingerprint',fingerprint,'receipt',receipt,
      'progress',premium_translation_private.writer_operation_progress(a.calls))));
  a.candidate:=p_candidate;a.final_receipt:=receipt;a.finish_fingerprint:=fingerprint;
  a.job_write_proof:=to_jsonb(j);a.item_write_proof:=to_jsonb(i);a.attempt_write_proof:=to_jsonb(attempt);
  update premium_translation_private.writer_operation_artifacts set candidate=a.candidate,final_receipt=receipt,finish_fingerprint=fingerprint,
    job_write_proof=a.job_write_proof,item_write_proof=a.item_write_proof,attempt_write_proof=a.attempt_write_proof where operation_id=p_operation_id;
  insert into public.translation_job_attempts overriding system value select attempt.*;
  update public.translation_job_items set status=i.status,attempt_count=i.attempt_count,staff_retry=null,last_error_code=code,updated_at=stamp where id=p_item_id;
  update public.translation_jobs set status=j.status,succeeded_items=j.succeeded_items,failed_items=j.failed_items,version=j.version,
    updated_at=stamp,completed_at=stamp,resume_cursor=j.resume_cursor where id=p_job_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(a.actor_id,'translation.writer_operation.finished','translation_job',p_job_id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'state',state,'persistence',persistence,'candidateHash',digest));
  return receipt;
end; $$;

create function public.reconcile_writer_translation_operation(p_country_id text,p_writer_id text,p_operation_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.writer_operation_artifacts%rowtype; entity text:=p_country_id||':'||p_writer_id;
begin
  perform premium_translation_private.assert_actor();
  perform premium_translation_private.assert_identity('writer_biography',entity);
  perform pg_advisory_xact_lock(hashtextextended('writer-operation:'||entity,7191));
  select cache.* into a from premium_translation_private.writer_operation_artifacts cache
    join public.translation_job_items item on item.id=cache.item_id where cache.entity_id=entity
      and (p_operation_id is null or cache.operation_id=p_operation_id)
    order by (item.staff_retry is not null) desc,cache.created_at desc,cache.operation_id desc limit 1;
  if a.operation_id is null then return null; end if;
  return premium_translation_private.writer_operation_view(a,true);
end; $$;

create function public.get_writer_translation_operation_artifacts(p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_intent_hash text,p_source_hash text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.writer_operation_artifacts%rowtype;
begin
  a:=premium_translation_private.writer_operation_owned(p_job_id,p_item_id,p_operation_id);
  if p_intent_hash is distinct from a.intent_hash or p_source_hash is distinct from a.source_hash then
    raise exception 'Writer private artifact binding differs' using errcode='40001'; end if;
  return jsonb_build_object('version',1,'receipt',premium_translation_private.writer_operation_view(a,true),
    'sourceSnapshot',a.source_snapshot,'sourceRevision',a.source_revision,'targetRevision',a.target_revision,
    'expectedOverrideFields',a.expected_override_fields,'configuration',a.configuration,'calls',a.calls,'candidate',a.candidate);
end; $$;



create function premium_translation_private.writer_operation_owned(p_job uuid,p_item uuid,p_operation uuid)
returns premium_translation_private.writer_operation_artifacts language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.writer_operation_artifacts%rowtype;
begin
  perform premium_translation_private.assert_actor();
  select * into a from premium_translation_private.writer_operation_artifacts where operation_id=p_operation for update;
  if a.operation_id is null then raise exception 'Writer operation not found' using errcode='P0002'; end if;
  if a.actor_id is distinct from auth.uid() then raise exception 'Writer operation actor differs' using errcode='42501'; end if;
  if a.job_id is distinct from p_job or a.item_id is distinct from p_item then
    raise exception 'Writer operation identity differs' using errcode='40001'; end if;
  return a;
end; $$;

create function premium_translation_private.writer_operation_assert_current(a premium_translation_private.writer_operation_artifacts)
returns void language plpgsql security invoker set search_path='' as $$
declare w public.writer_profile_overrides%rowtype;
begin
  select * into w from public.writer_profile_overrides where country_id=a.source_revision->>'countryId'
    and writer_id=a.source_revision->>'writerId';
  if (w.id is null) is distinct from (a.expected_override_fields is null)
    or (w.id is not null and w.fields is distinct from a.expected_override_fields) then
    raise exception 'Writer full override changed' using errcode='40001'; end if;
  perform premium_translation_private.assert_writer_current(a.entity_id,a.source_snapshot,a.source_revision,a.target_revision);
end; $$;

create function public.writer_translation_operation_ready()
returns boolean language plpgsql stable security definer set search_path='' as $$
declare signature text; routine regprocedure;
begin
  perform premium_translation_private.assert_actor();
  foreach signature in array array[
    'public.begin_writer_translation_operation(uuid,uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'public.record_writer_translation_operation_dispatch(uuid,uuid,uuid,uuid,text,text,text,text)',
    'public.record_writer_translation_operation_response(uuid,uuid,uuid,jsonb,jsonb)',
    'public.finish_writer_translation_operation(uuid,uuid,uuid,jsonb,jsonb)',
    'public.reconcile_writer_translation_operation(text,text,uuid)',
    'public.get_writer_translation_operation_artifacts(uuid,uuid,uuid,text,text)'] loop
    routine:=to_regprocedure(signature);
    if routine is null or not has_function_privilege('authenticated',routine,'EXECUTE') then return false; end if;
  end loop;
  return to_regclass('premium_translation_private.writer_operation_artifacts') is not null
    and exists(select 1 from pg_index where indexrelid=to_regclass('public.translation_writer_active_operation_unique')
      and indisunique and indisvalid and indpred is not null)
    and (select count(*)=3 from pg_trigger where not tgisinternal and tgenabled='O'
      and tgfoid=to_regprocedure('premium_translation_private.writer_operation_guard()') and tgname in
      ('translation_jobs_writer_integrity','translation_items_writer_integrity','translation_attempts_writer_integrity'));
end; $$;

create function public.begin_writer_translation_operation(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_country_id text,p_writer_id text,p_provider text,
  p_source_hash text,p_source_snapshot jsonb,p_source_revision jsonb,p_target_revision jsonb,
  p_expected_override_fields jsonb,p_configuration jsonb,p_current_cursor jsonb default '{}'::jsonb,p_resume_cursor jsonb default '{}'::jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=premium_translation_private.assert_actor(); a premium_translation_private.writer_operation_artifacts%rowtype;
  j public.translation_jobs%rowtype; i public.translation_job_items%rowtype; entity text; intent text;
  stamp timestamptz:=clock_timestamp(); marker jsonb; view jsonb;
begin
  entity:=p_country_id||':'||p_writer_id;
  perform premium_translation_private.assert_identity('writer_biography',entity);
  if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
    or not probpera_translation_operations.retry_uuid(p_operation_id) or p_provider is null or p_provider not in ('openai','cloudflare')
    or p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$'
    or not premium_translation_private.writer_operation_source_valid(p_source_snapshot,p_source_revision,p_target_revision)
    or p_source_revision->>'countryId' is distinct from p_country_id or p_source_revision->>'writerId' is distinct from p_writer_id
    or not premium_translation_private.writer_operation_configuration_valid(p_configuration,p_provider)
    or ((p_target_revision->>'id' is null) is distinct from (p_expected_override_fields is null))
    or (p_expected_override_fields is not null and (jsonb_typeof(p_expected_override_fields)<>'object' or octet_length(p_expected_override_fields::text)>1048576))
    or p_current_cursor is null or jsonb_typeof(p_current_cursor)<>'object' or p_current_cursor-'writerCursor'<>'{}'::jsonb
    or (p_current_cursor ? 'writerCursor' and (jsonb_typeof(p_current_cursor->'writerCursor')<>'number' or (p_current_cursor->>'writerCursor') !~ '^[0-9]{1,9}$'))
    or p_resume_cursor is null or jsonb_typeof(p_resume_cursor)<>'object' or p_resume_cursor-'writerCursor'<>'{}'::jsonb
    or (p_resume_cursor ? 'writerCursor' and (jsonb_typeof(p_resume_cursor->'writerCursor')<>'number' or (p_resume_cursor->>'writerCursor') !~ '^[0-9]{1,9}$')) then
    raise exception 'Invalid writer operation admission' using errcode='22023'; end if;
  intent:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_job_id,p_item_id,p_operation_id,actor,
    entity,p_provider,p_source_hash,p_source_snapshot,p_source_revision,p_target_revision,p_expected_override_fields,p_configuration,p_current_cursor,p_resume_cursor));
  perform pg_advisory_xact_lock(hashtextextended('writer-operation:'||entity,7191));
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,7192));
  select * into a from premium_translation_private.writer_operation_artifacts where operation_id=p_operation_id for update;
  if a.operation_id is not null then
    if a.actor_id is distinct from actor then raise exception 'Writer operation actor differs' using errcode='42501'; end if;
    if a.intent_hash is distinct from intent then raise exception 'Writer operation intent differs' using errcode='40001'; end if;
    return premium_translation_private.writer_operation_view(a,true);
  end if;
  select cache.* into a from premium_translation_private.writer_operation_artifacts cache
    join public.translation_job_items item on item.id=cache.item_id
    where cache.entity_id=entity and item.entity_type='writer' and item.staff_retry is not null for update of cache;
  if a.operation_id is not null then
    view:=premium_translation_private.writer_operation_view(a,true);
    return view||jsonb_build_object('phase','blocked','blockReason',coalesce(view->>'blockReason','operation_in_progress'));
  end if;
  if exists(select 1 from public.translation_jobs where id=p_job_id)
    or exists(select 1 from public.translation_job_items where id=p_item_id)
    or exists(select 1 from public.premium_translation_working_drafts where entity_type='writer_biography' and entity_id=entity) then
    raise exception 'Writer job identity or private candidate already exists' using errcode='40001'; end if;
  a.operation_id:=p_operation_id;a.job_id:=p_job_id;a.item_id:=p_item_id;a.actor_id:=actor;a.entity_id:=entity;
  a.provider:=p_provider;a.source_hash:=p_source_hash;a.intent_hash:=intent;
  a.configuration:=p_configuration;a.configuration_hash:=probpera_translation_operations.retry_fingerprint(p_configuration);
  a.source_snapshot:=p_source_snapshot;a.source_revision:=p_source_revision;a.target_revision:=p_target_revision;
  a.expected_override_fields:=p_expected_override_fields;a.confirmed_cursor:=p_resume_cursor;a.calls:='[]';a.created_at:=stamp;
  perform premium_translation_private.writer_operation_assert_current(a);
  marker:=jsonb_build_object('version',1,'protocol','writer-biography','operationId',p_operation_id,'actorId',actor,
    'entityId',entity,'sourceHash',p_source_hash,'intentHash',intent,'configurationHash',a.configuration_hash,
    'startedAt',stamp,'attemptNumber',1,'progress',jsonb_build_object('version',1,'updatedAt',stamp,'calls','[]'::jsonb));
  j:=jsonb_populate_record(null::public.translation_jobs,jsonb_build_object('id',p_job_id,'kind','writer','source_locale','ru',
    'target_locale','en','provider',p_provider,'status','reviewing','total_items',1,'succeeded_items',0,'failed_items',0,
    'requested_by',actor,'started_at',stamp,'version',1,'created_at',stamp,'updated_at',stamp,
    'resume_cursor',p_current_cursor||jsonb_build_object('writerOperation',jsonb_build_object('version',1,'operationId',p_operation_id,'actorId',actor,'intentHash',intent))));
  i:=jsonb_populate_record(null::public.translation_job_items,jsonb_build_object('id',p_item_id,'job_id',p_job_id,'position',0,
    'entity_type','writer','entity_id',entity,'source_hash',p_source_hash,'status','reviewing','attempt_count',0,'max_attempts',3,
    'next_attempt_at',stamp,'created_at',stamp,'updated_at',stamp,'staff_retry',marker));
  a.job_write_proof:=to_jsonb(j);a.item_write_proof:=to_jsonb(i);
  insert into premium_translation_private.writer_operation_artifacts select a.*;
  insert into public.translation_jobs select j.*;
  insert into public.translation_job_items select i.*;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(actor,'translation.writer_operation.admitted','translation_job',p_job_id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'entityId',entity,'sourceHash',p_source_hash,'configurationHash',a.configuration_hash));
  return premium_translation_private.writer_operation_view(a,false,true);
end; $$;

create function public.record_writer_translation_operation_dispatch(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_call_id uuid,p_provider text,p_model text,p_pass text,p_request_hash text
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.writer_operation_artifacts%rowtype; j public.translation_jobs%rowtype;
  i public.translation_job_items%rowtype; call jsonb; metadata jsonb; progress jsonb; stamp timestamptz:=clock_timestamp();
begin
  a:=premium_translation_private.writer_operation_owned(p_job_id,p_item_id,p_operation_id);
  if not probpera_translation_operations.retry_uuid(p_call_id) or p_provider is distinct from a.provider
    or p_model is null or p_pass is null or p_pass not in ('translation','repair','review')
    or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$'
    or p_model is distinct from a.configuration->>(case when p_pass='translation' then 'model' else 'reviewerModel' end) then
    raise exception 'Invalid writer dispatch binding' using errcode='22023'; end if;
  for call in select value from jsonb_array_elements(a.calls) loop
    if call->'metadata'->>'callId'=p_call_id::text then
      if call->>'requestHash' is distinct from p_request_hash or call->'metadata'->>'pass' is distinct from p_pass
        or call->'metadata'->>'model' is distinct from p_model then raise exception 'Writer dispatch intent differs' using errcode='40001'; end if;
      return premium_translation_private.writer_operation_view(a,true);
    end if;
  end loop;
  select * into j from public.translation_jobs where id=p_job_id for update;
  if a.final_receipt is not null or j.cancel_requested_at is not null or j.status<>'reviewing'
    or jsonb_array_length(a.calls)>=4 or exists(select 1 from jsonb_array_elements(a.calls) value where value->'metadata'->'responseReceivedAt'='null'::jsonb) then
    raise exception 'Writer dispatch is blocked or outcome unknown' using errcode='40001'; end if;
  perform premium_translation_private.writer_operation_assert_current(a);
  metadata:=jsonb_build_object('callId',p_call_id,'provider',p_provider,'model',p_model,'pass',p_pass,
    'dispatchRecordedAt',stamp,'responseReceivedAt',null,'httpStatus',null,'requestId',null,'responseId',null,'inputTokens',null,'outputTokens',null);
  a.calls:=a.calls||jsonb_build_array(jsonb_build_object('requestHash',p_request_hash,'metadata',metadata,'responseArtifact',null));
  progress:=premium_translation_private.writer_operation_progress(a.calls);
  if not probpera_translation_operations.retry_journal_valid(progress,a.provider) then
    raise exception 'Writer dispatch sequence differs' using errcode='40001'; end if;
  select * into i from public.translation_job_items where id=p_item_id for update;
  i.staff_retry:=i.staff_retry||jsonb_build_object('progress',progress);i.updated_at:=stamp;
  a.item_write_proof:=to_jsonb(i);
  update premium_translation_private.writer_operation_artifacts set calls=a.calls,item_write_proof=a.item_write_proof where operation_id=p_operation_id;
  update public.translation_job_items set staff_retry=i.staff_retry,updated_at=i.updated_at where id=p_item_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(a.actor_id,'translation.writer_operation.dispatch_recorded','translation_job',p_job_id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'callId',p_call_id,'provider',p_provider,'model',p_model,'pass',p_pass,'requestHash',p_request_hash));
  return premium_translation_private.writer_operation_view(a,false,false,true);
end; $$;

create function public.record_writer_translation_operation_response(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_metadata jsonb,p_response_artifact jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.writer_operation_artifacts%rowtype; i public.translation_job_items%rowtype;
  call jsonb; position integer; progress jsonb; stamp timestamptz:=clock_timestamp();
begin
  a:=premium_translation_private.writer_operation_owned(p_job_id,p_item_id,p_operation_id);
  if not premium_translation_private.exact_object(p_metadata,array['callId','provider','model','pass','httpStatus','requestId','responseId','inputTokens','outputTokens'])
    or not premium_translation_private.exact_object(p_response_artifact,array['version','body'])
    or p_response_artifact->'version' is distinct from '1'::jsonb or octet_length(p_response_artifact::text)>262144 then
    raise exception 'Invalid writer response artifact' using errcode='22023'; end if;
  select value,(n-1)::integer into call,position from jsonb_array_elements(a.calls) with ordinality x(value,n)
    where value->'metadata'->>'callId'=p_metadata->>'callId';
  if position is null then raise exception 'Writer response dispatch not found' using errcode='40001'; end if;
  if call->'metadata'->>'provider' is distinct from p_metadata->>'provider'
    or call->'metadata'->>'model' is distinct from p_metadata->>'model' or call->'metadata'->>'pass' is distinct from p_metadata->>'pass' then
    raise exception 'Writer response identity differs' using errcode='40001'; end if;
  if call->'metadata'->'responseReceivedAt'<>'null'::jsonb then
    if (call->'metadata')-array['dispatchRecordedAt','responseReceivedAt'] is distinct from p_metadata
      or call->'responseArtifact' is distinct from p_response_artifact then raise exception 'Writer response evidence differs' using errcode='40001'; end if;
    return premium_translation_private.writer_operation_view(a,true);
  end if;
  if a.final_receipt is not null then raise exception 'Writer operation already finished' using errcode='40001'; end if;
  call:=call||jsonb_build_object('metadata',p_metadata||jsonb_build_object('dispatchRecordedAt',call->'metadata'->'dispatchRecordedAt','responseReceivedAt',stamp),
    'responseArtifact',p_response_artifact);
  a.calls:=jsonb_set(a.calls,array[position::text],call);
  progress:=premium_translation_private.writer_operation_progress(a.calls);
  if not probpera_translation_operations.retry_journal_valid(progress,a.provider) then
    raise exception 'Writer response metadata differs' using errcode='22023'; end if;
  select * into i from public.translation_job_items where id=p_item_id for update;
  i.staff_retry:=i.staff_retry||jsonb_build_object('progress',progress);i.updated_at:=stamp;a.item_write_proof:=to_jsonb(i);
  update premium_translation_private.writer_operation_artifacts set calls=a.calls,item_write_proof=a.item_write_proof where operation_id=p_operation_id;
  update public.translation_job_items set staff_retry=i.staff_retry,updated_at=i.updated_at where id=p_item_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(a.actor_id,'translation.writer_operation.response_received','translation_job',p_job_id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'callId',p_metadata->'callId','responseHash',probpera_translation_operations.retry_fingerprint(p_response_artifact)));
  return premium_translation_private.writer_operation_view(a);
end; $$;

revoke all on function premium_translation_private.writer_operation_configuration_valid(jsonb,text) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.writer_operation_source_valid(jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.writer_operation_progress(jsonb) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.writer_operation_guard() from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.writer_operation_view(premium_translation_private.writer_operation_artifacts,boolean,boolean,boolean) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.writer_operation_owned(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.writer_operation_assert_current(premium_translation_private.writer_operation_artifacts) from public,anon,authenticated,service_role;
revoke all on function public.writer_translation_operation_ready() from public,anon,authenticated,service_role;
revoke all on function public.begin_writer_translation_operation(uuid,uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.record_writer_translation_operation_dispatch(uuid,uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.record_writer_translation_operation_response(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.finish_writer_translation_operation(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.reconcile_writer_translation_operation(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_writer_translation_operation_artifacts(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.writer_translation_operation_ready() to authenticated;
grant execute on function public.begin_writer_translation_operation(uuid,uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.record_writer_translation_operation_dispatch(uuid,uuid,uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.record_writer_translation_operation_response(uuid,uuid,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.finish_writer_translation_operation(uuid,uuid,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.reconcile_writer_translation_operation(text,text,uuid) to authenticated;
grant execute on function public.get_writer_translation_operation_artifacts(uuid,uuid,uuid,text,text) to authenticated;
commit;
