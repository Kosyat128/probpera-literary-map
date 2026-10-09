-- Bounded metadata for an explicit staff item retry. A dispatch record is an
-- admission, not evidence that a provider accepted or completed a request.
-- Unknown admission/transport results never expire into another admission.
create or replace function probpera_translation_operations.retry_journal_valid(p_value jsonb,p_provider text)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare call jsonb; previous jsonb; seen text[]:='{}'; n integer:=0; field text; stamp timestamptz;
begin
  if p_provider is null or p_provider not in ('openai','cloudflare')
    or p_value is null or jsonb_typeof(p_value) is distinct from 'object'
    or p_value - array['version','updatedAt','calls'] <> '{}'::jsonb
    or not(p_value ?& array['version','updatedAt','calls']) or p_value -> 'version' is distinct from '1'::jsonb
    or jsonb_typeof(p_value -> 'updatedAt') is distinct from 'string'
    or jsonb_typeof(p_value -> 'calls') is distinct from 'array' or jsonb_array_length(p_value -> 'calls')>4 then return false; end if;
  stamp:=(p_value ->> 'updatedAt')::timestamptz;
  if not isfinite(stamp) then return false; end if;
  for call in select value from jsonb_array_elements(p_value -> 'calls') loop
    n:=n+1;
    if jsonb_typeof(call) is distinct from 'object'
      or not(call ?& array['callId','provider','model','pass','dispatchRecordedAt','responseReceivedAt','httpStatus','requestId','responseId','inputTokens','outputTokens'])
      or call - array['callId','provider','model','pass','dispatchRecordedAt','responseReceivedAt','httpStatus','requestId','responseId','inputTokens','outputTokens'] <> '{}'::jsonb
      or jsonb_typeof(call -> 'callId') is distinct from 'string'
      or not probpera_translation_operations.retry_uuid((call ->> 'callId')::uuid)
      or call ->> 'callId' <> ((call ->> 'callId')::uuid)::text or call ->> 'callId'=any(seen)
      or jsonb_typeof(call -> 'provider') is distinct from 'string' or call ->> 'provider' is distinct from p_provider
      or jsonb_typeof(call -> 'model') is distinct from 'string'
      or probpera_translation_operations.retry_text_length(call ->> 'model') not between 1 and 200
      or jsonb_typeof(call -> 'pass') is distinct from 'string' or call ->> 'pass' not in ('translation','repair','review')
      or jsonb_typeof(call -> 'dispatchRecordedAt') is distinct from 'string' then return false; end if;
    stamp:=(call ->> 'dispatchRecordedAt')::timestamptz;
    if not isfinite(stamp) then return false; end if;
    if (n=1 and call ->> 'pass'<>'translation')
      or (n>1 and (previous -> 'responseReceivedAt'='null'::jsonb or not(
        (n=2 and call ->> 'pass' in ('repair','review'))
        or (n=3 and previous ->> 'pass'='repair' and call ->> 'pass'='review')
        or (n=3 and previous ->> 'pass'='review' and call ->> 'pass'='repair')
        or (n=4 and previous ->> 'pass'='review' and call ->> 'pass'='repair')))) then return false; end if;
    if call -> 'responseReceivedAt'='null'::jsonb then
      foreach field in array array['httpStatus','requestId','responseId','inputTokens','outputTokens'] loop
        if call -> field <> 'null'::jsonb then return false; end if;
      end loop;
    elsif jsonb_typeof(call -> 'responseReceivedAt')='string' then
      stamp:=(call ->> 'responseReceivedAt')::timestamptz;
      if not isfinite(stamp) then return false; end if;
      if call -> 'httpStatus'<>'null'::jsonb and (jsonb_typeof(call -> 'httpStatus')<>'number'
        or (call ->> 'httpStatus') !~ '^[1-5][0-9]{2}$') then return false; end if;
      foreach field in array array['requestId','responseId'] loop
        if call -> field<>'null'::jsonb and (jsonb_typeof(call -> field)<>'string'
          or probpera_translation_operations.retry_text_length(call ->> field) not between 1 and 200) then return false; end if;
      end loop;
      foreach field in array array['inputTokens','outputTokens'] loop
        if call -> field<>'null'::jsonb and (jsonb_typeof(call -> field)<>'number'
          or (call ->> field) !~ '^[0-9]{1,8}$' or (call ->> field)::numeric>10000000) then return false; end if;
      end loop;
    else return false; end if;
    seen:=array_append(seen,call ->> 'callId'); previous:=call;
  end loop;
  return true;
exception when others then return false;
end; $$;

create or replace function probpera_translation_operations.retry_journal_active(
  p_job public.translation_jobs,p_item public.translation_job_items,p_operation_id uuid
)
returns void language plpgsql stable security invoker set search_path='' as $$
declare active jsonb:=p_item.staff_retry; actor uuid:=(select auth.uid());
begin
  if active ->> 'operationId' is distinct from p_operation_id::text then
    raise exception 'article retry operation not found' using errcode='P0002'; end if;
  if active ->> 'actorId' is distinct from actor::text then
    raise exception 'article retry actor changed' using errcode='42501'; end if;
  if p_item.status<>'reviewing' or p_item.lease_owner is not null or p_item.lease_expires_at is not null
    or p_job.kind<>'article' or p_item.entity_type<>'article' or p_job.source_locale<>'ru' or p_job.target_locale<>'en'
    or p_job.provider not in ('openai','cloudflare') or p_item.source_hash is null or p_item.source_hash !~ '^[a-f0-9]{64}$'
    or active -> 'version' is distinct from '1'::jsonb
    or not probpera_translation_operations.retry_uuid(p_item.entity_id::uuid)
    or (active ->> 'articleId')::uuid is distinct from p_item.entity_id::uuid
    or (active ->> 'attemptNumber')::integer is distinct from p_item.attempt_count+1
    or p_item.attempt_count not between 0 and 4 or p_item.max_attempts<>p_item.attempt_count+1
    or active -> 'beginIntent' ->> 0 is distinct from p_job.id::text
    or active -> 'beginIntent' ->> 1 is distinct from p_item.id::text
    or active -> 'beginIntent' ->> 2 is distinct from p_operation_id::text
    or active -> 'beginIntent' ->> 3 is distinct from actor::text
    or active -> 'beginIntent' ->> 6 is distinct from p_item.source_hash
    or active -> 'beginIntent' ->> 9 is distinct from p_job.provider
    or active -> 'sourceUpdatedAt' is distinct from active -> 'beginIntent' -> 7
    or active -> 'englishUpdatedAt' is distinct from active -> 'beginIntent' -> 8
    or (active -> 'progress' is not null and active -> 'progress'<>'null'::jsonb
      and not probpera_translation_operations.retry_journal_valid(active -> 'progress',p_job.provider)) then
    raise exception 'article retry active item changed' using errcode='40001'; end if;
end; $$;

create or replace function probpera_translation_operations.retry_journal_view(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_receipt jsonb,p_progress jsonb,
  p_started_at jsonb,p_updated_at timestamptz,p_phase text,p_can_dispatch boolean,p_replayed boolean
)
returns jsonb language sql stable security invoker set search_path='' set timezone='UTC'
return jsonb_build_object('version',1,'jobId',p_job_id,'itemId',p_item_id,
  'articleId',p_receipt -> 'articleId','operationId',p_operation_id,'provider',p_receipt -> 'provider',
  'phase',p_phase,'startedAt',p_started_at,'updatedAt',coalesce(p_progress -> 'updatedAt',to_jsonb(p_updated_at)),
  'providerCalls',jsonb_array_length(coalesce(p_progress -> 'calls','[]'::jsonb)),
  'canDispatch',p_can_dispatch,'replayed',p_replayed,'calls',coalesce(p_progress -> 'calls','[]'::jsonb));

create or replace function probpera_translation_operations.get_article_item_retry_progress(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare job public.translation_jobs%rowtype; item public.translation_job_items%rowtype;
  prior public.translation_job_attempts%rowtype; receipt jsonb; progress jsonb; active jsonb;
begin
  perform probpera_translation_operations.retry_access();
  if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
    or not probpera_translation_operations.retry_uuid(p_operation_id) then
    raise exception 'invalid article retry progress identity' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,7047));
  select * into prior from public.translation_job_attempts where staff_retry_operation_id=p_operation_id;
  if prior.id is not null then
    if prior.staff_retry_receipt ->> 'actorId' is distinct from (select auth.uid())::text then
      raise exception 'article retry actor changed' using errcode='42501'; end if;
    receipt:=prior.staff_retry_receipt -> 'receipt'; progress:=nullif(prior.staff_retry_receipt -> 'progress','null'::jsonb);
    if receipt ->> 'jobId' is distinct from p_job_id::text or receipt ->> 'itemId' is distinct from p_item_id::text
      or (progress is not null and not probpera_translation_operations.retry_journal_valid(progress,receipt ->> 'provider')) then
      raise exception 'article retry progress identity changed' using errcode='40001'; end if;
    return probpera_translation_operations.retry_journal_view(p_job_id,p_item_id,p_operation_id,receipt,progress,
      prior.staff_retry_receipt -> 'startedAt',prior.created_at,'finished',false,true);
  end if;
  select other.staff_retry into active from public.translation_job_items other
    where other.staff_retry ->> 'operationId'=p_operation_id::text;
  if active is not null then
    if active ->> 'actorId' is distinct from (select auth.uid())::text then
      raise exception 'article retry actor changed' using errcode='42501'; end if;
    if active -> 'beginIntent' ->> 0 is distinct from p_job_id::text
      or active -> 'beginIntent' ->> 1 is distinct from p_item_id::text then
      raise exception 'article retry progress identity changed' using errcode='40001'; end if;
  end if;
  select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id;
  select * into job from public.translation_jobs where id=p_job_id;
  if item.id is null or job.id is null then raise exception 'article retry item not found' using errcode='P0002'; end if;
  perform probpera_translation_operations.retry_journal_active(job,item,p_operation_id);
  active:=item.staff_retry; progress:=nullif(active -> 'progress','null'::jsonb);
  receipt:=jsonb_build_object('articleId',item.entity_id::uuid,'provider',job.provider);
  return probpera_translation_operations.retry_journal_view(p_job_id,p_item_id,p_operation_id,receipt,progress,
    active -> 'startedAt',item.updated_at,'running',false,false);
end; $$;

create or replace function probpera_translation_operations.record_article_item_retry_dispatch(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_call_id uuid,p_provider text,p_model text,p_pass text
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare job public.translation_jobs%rowtype; item public.translation_job_items%rowtype;
  article public.articles%rowtype; english public.article_translations%rowtype;
  view jsonb; active jsonb; progress jsonb; calls jsonb; call jsonb; last_call jsonb; now_at timestamptz;
begin
  perform probpera_translation_operations.retry_access();
  if not probpera_translation_operations.retry_uuid(p_call_id) or p_provider is null or p_provider not in ('openai','cloudflare')
    or p_model is null or probpera_translation_operations.retry_text_length(p_model) not between 1 and 200
    or p_pass is null or p_pass not in ('translation','repair','review') then
    raise exception 'invalid article retry dispatch metadata' using errcode='22023'; end if;
  -- GET holds the same operation advisory lock. Mutations preserve item -> job
  -- order used by retry FINISH and worker completion; no lease is granted.
  view:=probpera_translation_operations.get_article_item_retry_progress(p_job_id,p_item_id,p_operation_id);
  for call in select value from jsonb_array_elements(view -> 'calls') loop
    if call ->> 'callId'=p_call_id::text then
      if call ->> 'provider' is distinct from p_provider or call ->> 'model' is distinct from p_model
        or call ->> 'pass' is distinct from p_pass then
        raise exception 'article retry dispatch intent changed' using errcode='40001'; end if;
      return view || jsonb_build_object('canDispatch',false,'replayed',true);
    end if;
  end loop;
  if view ->> 'phase'='finished' then return view || jsonb_build_object('canDispatch',false,'replayed',true); end if;
  select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id for update;
  select * into job from public.translation_jobs where id=p_job_id for update;
  perform probpera_translation_operations.retry_journal_active(job,item,p_operation_id);
  if p_provider is distinct from job.provider or job.status<>'reviewing' or job.cancel_requested_at is not null then
    raise exception 'article retry dispatch was stopped' using errcode='40001'; end if;
  active:=item.staff_retry; calls:=coalesce(active -> 'progress' -> 'calls','[]'::jsonb);
  if jsonb_array_length(calls)>=4 then raise exception 'article retry dispatch budget exhausted' using errcode='40001'; end if;
  if jsonb_array_length(calls)>0 then
    last_call:=calls -> (jsonb_array_length(calls)-1);
    if last_call -> 'responseReceivedAt'='null'::jsonb then
      raise exception 'article retry previous response is unknown' using errcode='40001'; end if;
  end if;
  select * into article from public.articles where id=item.entity_id::uuid for update;
  select * into english from public.article_translations where article_id=item.entity_id::uuid and locale='en' for update;
  if article.id is null or article.status<>'published' or article.deleted_at is not null
    or article.updated_at is distinct from (active ->> 'sourceUpdatedAt')::timestamptz
    or english.updated_at is distinct from (active ->> 'englishUpdatedAt')::timestamptz
    or exists(select 1 from public.article_working_drafts where article_id=article.id)
    or probpera_translation_operations.retry_fingerprint(probpera_translation_operations.retry_ru_snapshot(article))
      is distinct from active ->> 'sourceSnapshotHash' then
    raise exception 'article retry source or draft changed before dispatch' using errcode='40001'; end if;
  if english.id is not null and (english.deleted_at is not null or english.source_content_hash is null
    or english.content_json -> '__probperaPremiumTranslation' -> 'version' is distinct from '1'::jsonb
    or english.content_json -> '__probperaPremiumTranslation' -> 'method' is distinct from '"machine-translation"'::jsonb
    or english.content_json -> '__probperaPremiumTranslation' ->> 'sourceHash' is distinct from english.source_content_hash) then
    raise exception 'article retry English ownership changed before dispatch' using errcode='40001'; end if;
  now_at:=clock_timestamp();
  call:=jsonb_build_object('callId',p_call_id,'provider',p_provider,'model',p_model,'pass',p_pass,
    'dispatchRecordedAt',now_at,'responseReceivedAt',null,'httpStatus',null,'requestId',null,'responseId',null,
    'inputTokens',null,'outputTokens',null);
  progress:=jsonb_build_object('version',1,'updatedAt',now_at,'calls',calls||jsonb_build_array(call));
  if not probpera_translation_operations.retry_journal_valid(progress,job.provider) then
    raise exception 'article retry pass sequence changed' using errcode='40001'; end if;
  active:=active||jsonb_build_object('progress',progress);
  update public.translation_job_items set staff_retry=active,updated_at=now_at where id=item.id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values((select auth.uid()),'translation.article_item_retry.dispatch_recorded','translation_job',job.id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',item.id,'callId',p_call_id,
        'provider',p_provider,'model',p_model,'pass',p_pass,'recordedAdmissions',jsonb_array_length(progress -> 'calls')));
  return probpera_translation_operations.retry_journal_view(p_job_id,p_item_id,p_operation_id,view,progress,
    active -> 'startedAt',now_at,'running',true,false);
end; $$;

create or replace function probpera_translation_operations.record_article_item_retry_response(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_metadata jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare job public.translation_jobs%rowtype; item public.translation_job_items%rowtype;
  view jsonb; progress jsonb; call jsonb; fields text[]:=array['callId','provider','model','pass','httpStatus','requestId','responseId','inputTokens','outputTokens'];
  position integer; idx integer:=0; now_at timestamptz; candidate jsonb;
begin
  perform probpera_translation_operations.retry_access();
  if jsonb_typeof(p_metadata) is distinct from 'object' or not(p_metadata ?& fields)
    or p_metadata-fields<>'{}'::jsonb or octet_length(p_metadata::text)>4096
    or jsonb_typeof(p_metadata -> 'pass') is distinct from 'string'
    or jsonb_typeof(p_metadata -> 'callId') is distinct from 'string'
    or (p_metadata ->> 'callId') !~* '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$' then
    raise exception 'invalid article retry response metadata' using errcode='22023'; end if;
  p_metadata:=p_metadata||jsonb_build_object('callId',(p_metadata ->> 'callId')::uuid);
  candidate:=p_metadata||jsonb_build_object('dispatchRecordedAt',clock_timestamp(),'responseReceivedAt',clock_timestamp());
  -- Validate each metadata field without admitting a new call or trusting prose.
  if not probpera_translation_operations.retry_journal_valid(jsonb_build_object('version',1,'updatedAt',clock_timestamp(),
      'calls',jsonb_build_array(candidate||jsonb_build_object('pass','translation'))),p_metadata ->> 'provider')
    or p_metadata ->> 'provider' not in ('openai','cloudflare') or p_metadata ->> 'pass' not in ('translation','repair','review') then
    raise exception 'invalid article retry response fields' using errcode='22023'; end if;
  view:=probpera_translation_operations.get_article_item_retry_progress(p_job_id,p_item_id,p_operation_id);
  for call in select value from jsonb_array_elements(view -> 'calls') loop
    if call ->> 'callId'=p_metadata ->> 'callId' then position:=idx; exit; end if;
    idx:=idx+1;
  end loop;
  if position is null then raise exception 'article retry response dispatch not found' using errcode='40001'; end if;
  if call ->> 'provider' is distinct from p_metadata ->> 'provider' or call ->> 'model' is distinct from p_metadata ->> 'model'
    or call ->> 'pass' is distinct from p_metadata ->> 'pass' then
    raise exception 'article retry response identity changed' using errcode='40001'; end if;
  if call -> 'responseReceivedAt'<>'null'::jsonb then
    if call-array['dispatchRecordedAt','responseReceivedAt'] is distinct from p_metadata then
      raise exception 'article retry response evidence changed' using errcode='40001'; end if;
    return view||jsonb_build_object('canDispatch',false,'replayed',true);
  end if;
  if view ->> 'phase'='finished' then raise exception 'article retry finished without this response' using errcode='40001'; end if;
  select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id for update;
  select * into job from public.translation_jobs where id=p_job_id for update;
  perform probpera_translation_operations.retry_journal_active(job,item,p_operation_id);
  now_at:=clock_timestamp(); progress:=item.staff_retry -> 'progress';
  progress:=jsonb_set(progress,array['calls',position::text],call||p_metadata||jsonb_build_object('responseReceivedAt',now_at));
  progress:=progress||jsonb_build_object('updatedAt',now_at);
  if not probpera_translation_operations.retry_journal_valid(progress,job.provider) then
    raise exception 'article retry response journal changed' using errcode='40001'; end if;
  update public.translation_job_items set staff_retry=staff_retry||jsonb_build_object('progress',progress),updated_at=now_at where id=item.id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values((select auth.uid()),'translation.article_item_retry.response_received','translation_job',job.id::text,
      p_metadata||jsonb_build_object('operationId',p_operation_id,'itemId',item.id));
  return probpera_translation_operations.retry_journal_view(p_job_id,p_item_id,p_operation_id,view,progress,
    item.staff_retry -> 'startedAt',now_at,'running',false,false);
end; $$;

-- Preserve the existing private-draft/attempt/audit transaction and freeze
-- the bounded journal in that same attempt. The original migration is intact.
create or replace function probpera_translation_operations.finish_article_item_retry(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_outcome jsonb,p_english_payload jsonb default null
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare job public.translation_jobs%rowtype; item public.translation_job_items%rowtype;
  article public.articles%rowtype; english public.article_translations%rowtype;
  actor uuid:=(select auth.uid()); active jsonb; prior jsonb; request_hash text;
  outcome text; code text; attempt_outcome text; snapshot jsonb; saved jsonb; result jsonb; receipt jsonb;
  source_stamp timestamptz; english_stamp timestamptz; attempt_number integer;
  succeeded integer; failed integer; conflicts integer; stale integer; not_configured integer;
  field text; field_value jsonb; draft_stamp timestamptz;
begin
  perform probpera_translation_operations.retry_access();
  if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
    or not probpera_translation_operations.retry_uuid(p_operation_id)
    or jsonb_typeof(p_outcome) is distinct from 'object' or octet_length(p_outcome::text)>16384
    or not(p_outcome ?& array['status','providerCalls'])
    or p_outcome - array['status','providerCalls','errorCode','model','requestId','inputTokens','outputTokens','durationMs'] <> '{}'::jsonb
    or jsonb_typeof(p_outcome -> 'status') is distinct from 'string'
    or p_outcome ->> 'status' not in ('succeeded','dead_letter','conflict','stale','skipped','not-configured')
    or jsonb_typeof(p_outcome -> 'providerCalls') is distinct from 'number'
    or (p_outcome ->> 'providerCalls') !~ '^[0-4]$' then
    raise exception 'invalid article retry outcome' using errcode='22023'; end if;
  outcome:=p_outcome ->> 'status'; code:=p_outcome ->> 'errorCode';
  if (p_outcome ? 'errorCode' and p_outcome -> 'errorCode'<>'null'::jsonb
      and jsonb_typeof(p_outcome -> 'errorCode') is distinct from 'string')
    or (outcome in ('succeeded','skipped') and code is not null)
    or (outcome not in ('succeeded','skipped') and (code is null or code not in (
      'translation_not_configured','provider_unavailable','provider_request_failed','provider_invalid_response',
      'source_changed','write_conflict','database_read_failed','database_write_failed','unexpected'))) then
    raise exception 'invalid article retry error' using errcode='22023'; end if;
  foreach field in array array['model','requestId'] loop
    field_value:=p_outcome -> field;
    if field_value is not null and field_value<>'null'::jsonb and
      (jsonb_typeof(field_value) is distinct from 'string' or probpera_translation_operations.retry_text_length(p_outcome ->> field) not between 1 and 200) then
      raise exception 'invalid article retry provider metadata' using errcode='22023'; end if;
  end loop;
  foreach field in array array['inputTokens','outputTokens','durationMs'] loop
    field_value:=p_outcome -> field;
    if field_value is not null and field_value<>'null'::jsonb and
      (jsonb_typeof(field_value) is distinct from 'number' or (p_outcome ->> field) !~ '^[0-9]{1,8}$'
        or (p_outcome ->> field)::numeric > case when field='durationMs' then 3600000 else 10000000 end) then
      raise exception 'invalid article retry usage metadata' using errcode='22023'; end if;
  end loop;
  if outcome='succeeded' then
    if jsonb_typeof(p_english_payload) is distinct from 'object'
      or not(p_english_payload ?& array['mode','payload']) or p_english_payload - array['mode','payload']<>'{}'::jsonb
      or p_english_payload -> 'mode' is distinct from '"save"'::jsonb
      or not probpera_translation_operations.retry_payload_valid(p_english_payload -> 'payload',true) then
      raise exception 'invalid article retry private English' using errcode='22023'; end if;
  elsif p_english_payload is not null then
    raise exception 'non-successful article retry cannot persist English' using errcode='22023';
  end if;
  request_hash:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_outcome,p_english_payload));
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,7047));
  select staff_retry_receipt into prior from public.translation_job_attempts where staff_retry_operation_id=p_operation_id;
  if prior is not null then
    if prior ->> 'actorId' is distinct from actor::text then
      raise exception 'article retry actor changed' using errcode='42501'; end if;
    if prior -> 'receipt' ->> 'jobId' is distinct from p_job_id::text
      or prior -> 'receipt' ->> 'itemId' is distinct from p_item_id::text
      or prior ->> 'finishFingerprint' is distinct from request_hash then
      raise exception 'article retry finish intent changed' using errcode='40001'; end if;
    return prior -> 'receipt' || jsonb_build_object('replayed',true,'canExecute',false);
  end if;
  select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id for update;
  select * into job from public.translation_jobs where id=p_job_id for update;
  if item.id is null or job.id is null then raise exception 'article retry item not found' using errcode='P0002'; end if;
  active:=item.staff_retry;
  if active ->> 'operationId' is distinct from p_operation_id::text then
    raise exception 'article retry operation not found' using errcode='P0002'; end if;
  if active ->> 'actorId' is distinct from actor::text then
    raise exception 'article retry actor changed' using errcode='42501'; end if;
  source_stamp:=(active ->> 'sourceUpdatedAt')::timestamptz;
  english_stamp:=(active ->> 'englishUpdatedAt')::timestamptz;
  attempt_number:=(active ->> 'attemptNumber')::integer;
  if item.status<>'reviewing' or item.lease_owner is not null or item.lease_expires_at is not null
    or attempt_number is distinct from item.attempt_count+1 or attempt_number not between 1 and 5
    or job.kind<>'article' or item.entity_type<>'article' or job.source_locale<>'ru' or job.target_locale<>'en'
    or active -> 'version' is distinct from '1'::jsonb
    or (active ->> 'articleId')::uuid is distinct from item.entity_id::uuid
    or active -> 'beginIntent' ->> 0 is distinct from job.id::text
    or active -> 'beginIntent' ->> 1 is distinct from item.id::text
    or active -> 'beginIntent' ->> 2 is distinct from p_operation_id::text
    or active -> 'beginIntent' ->> 3 is distinct from actor::text
    or active -> 'beginIntent' ->> 6 is distinct from item.source_hash
    or active -> 'beginIntent' ->> 9 is distinct from job.provider then
    raise exception 'article retry active item changed' using errcode='40001'; end if;
  if outcome='succeeded' and p_english_payload -> 'payload' ->> 'source_content_hash' is distinct from item.source_hash then
    raise exception 'article retry English source changed' using errcode='22023'; end if;
  -- A durable dispatch remains unknown until its received-response record is
  -- acknowledged. Neither a timer nor a caller-supplied failure closes it.
  if active -> 'progress' is not null and active -> 'progress'<>'null'::jsonb then
    if not probpera_translation_operations.retry_journal_valid(active -> 'progress',job.provider)
      or jsonb_array_length(active -> 'progress' -> 'calls') is distinct from (p_outcome ->> 'providerCalls')::integer
      or exists(select 1 from jsonb_array_elements(active -> 'progress' -> 'calls') recorded
        where recorded -> 'responseReceivedAt'='null'::jsonb) then
      raise exception 'article retry provider outcome is unconfirmed' using errcode='40001'; end if;
  end if;
  select * into article from public.articles where id=item.entity_id::uuid for update;
  select * into english from public.article_translations where article_id=item.entity_id::uuid and locale='en' for update;
  -- A known provider outcome is always journaled. A cancelled or changed
  -- source has no draft write, and does not turn generated text into review.
  if job.cancel_requested_at is not null or job.status in ('cancelled','cancelling') then
    outcome:='cancelled'; code:=null;
  elsif outcome='succeeded' then
    if article.id is null or article.deleted_at is not null or article.status<>'published'
      or article.updated_at is distinct from source_stamp then outcome:='stale'; code:='source_changed';
    elsif english.updated_at is distinct from english_stamp
      or exists(select 1 from public.article_working_drafts where article_id=article.id)
      or (english.id is not null and (english.deleted_at is not null or english.source_content_hash is null
        or english.content_json -> '__probperaPremiumTranslation' -> 'version' is distinct from '1'::jsonb
        or english.content_json -> '__probperaPremiumTranslation' -> 'method' is distinct from '"machine-translation"'::jsonb
        or english.content_json -> '__probperaPremiumTranslation' ->> 'sourceHash' is distinct from english.source_content_hash)) then
      outcome:='conflict'; code:='write_conflict';
    else
      begin snapshot:=probpera_translation_operations.retry_ru_snapshot(article);
      exception when invalid_parameter_value then snapshot:=null; end;
      if snapshot is null or probpera_translation_operations.retry_fingerprint(snapshot) is distinct from active ->> 'sourceSnapshotHash' then
        outcome:='stale'; code:='source_changed';
      else
        saved:=public.save_article_working_draft(article.id,source_stamp,snapshot,p_english_payload,english_stamp,0);
        if saved ->> 'articleId' is distinct from article.id::text or saved -> 'version' is distinct from '1'::jsonb
          or jsonb_typeof(saved -> 'updatedAt') is distinct from 'string' then
          raise exception 'invalid article retry private draft receipt' using errcode='22023'; end if;
        draft_stamp:=(saved ->> 'updatedAt')::timestamptz;
        update public.article_working_drafts set draft_scope='english-only',draft_english_enabled=true
          where article_id=article.id and version=1;
        if not found then raise exception 'article retry private draft changed' using errcode='40001'; end if;
      end if;
    end if;
  end if;
  update public.translation_job_items set status=case when outcome='cancelled' then 'cancelled' else outcome end,
    attempt_count=attempt_number,staff_retry=null,lease_owner=null,lease_expires_at=null,last_error_code=code,
    updated_at=clock_timestamp() where id=item.id returning * into item;
  select count(*) filter(where status='succeeded'),count(*) filter(where status='dead_letter'),
    count(*) filter(where status='conflict'),count(*) filter(where status='stale'),count(*) filter(where status='not-configured')
    into succeeded,failed,conflicts,stale,not_configured from public.translation_job_items where job_id=job.id;
  update public.translation_jobs set succeeded_items=succeeded,failed_items=failed,
    status=case when outcome='cancelled' then 'cancelled'
      when failed>0 then case when succeeded>0 then 'partial' else 'failed' end
      when conflicts>0 then 'conflict' when stale>0 then 'stale' when not_configured>0 then 'not-configured'
      when succeeded=0 then 'skipped' else 'completed' end,
    completed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()
    where id=job.id returning * into job;
  result:=jsonb_build_object('outcome',outcome,'errorCode',code,
    'persistence',case when saved is not null then 'working-draft' else 'none' end,
    'workingDraftVersion',case when saved is not null then 1 else null end,'workingDraftUpdatedAt',draft_stamp,
    'publication','unchanged','humanReview',case when saved is not null then 'pending' else 'unchanged' end,
    'providerCalls',(p_outcome ->> 'providerCalls')::integer);
  receipt:=probpera_translation_operations.retry_view(job,item,'finished',null,active,source_stamp,english_stamp,false,false,result);
  attempt_outcome:=case when outcome='cancelled' then 'skipped' else outcome end;
  insert into public.translation_job_attempts(item_id,attempt_number,outcome,provider,model,provider_request_id,
    error_code,input_tokens,output_tokens,duration_ms,staff_retry_operation_id,staff_retry_receipt)
    values(item.id,attempt_number,attempt_outcome,job.provider,p_outcome ->> 'model',p_outcome ->> 'requestId',code,
      (p_outcome ->> 'inputTokens')::integer,(p_outcome ->> 'outputTokens')::integer,(p_outcome ->> 'durationMs')::integer,
      p_operation_id,jsonb_build_object('actorId',actor,'beginIntent',active -> 'beginIntent',
        'finishFingerprint',request_hash,'receipt',receipt,
        'progress',active -> 'progress','startedAt',active -> 'startedAt'));
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(actor,'translation.article_item_retry.finished','translation_job',job.id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',item.id,'attemptNumber',attempt_number,
        'outcome',outcome,'persistence',result -> 'persistence','jobVersion',job.version::text));
  return receipt;
end; $$;


create or replace function public.record_article_translation_item_retry_dispatch(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_call_id uuid,p_provider text,p_model text,p_pass text
)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.record_article_item_retry_dispatch(p_job_id,p_item_id,p_operation_id,p_call_id,p_provider,p_model,p_pass);
create or replace function public.record_article_translation_item_retry_response(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_metadata jsonb
)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.record_article_item_retry_response(p_job_id,p_item_id,p_operation_id,p_metadata);
create or replace function public.get_article_translation_item_retry_progress(p_job_id uuid,p_item_id uuid,p_operation_id uuid)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.get_article_item_retry_progress(p_job_id,p_item_id,p_operation_id);

-- No private schema USAGE or service admission privilege is added. Public
-- invoker wrappers call only the staff-guarded definer entry points.
revoke all on function probpera_translation_operations.retry_journal_valid(jsonb,text) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.retry_journal_active(public.translation_jobs,public.translation_job_items,uuid) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.retry_journal_view(uuid,uuid,uuid,jsonb,jsonb,jsonb,timestamptz,text,boolean,boolean) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.get_article_item_retry_progress(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.record_article_item_retry_dispatch(uuid,uuid,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.record_article_item_retry_response(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.get_article_translation_item_retry_progress(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.record_article_translation_item_retry_dispatch(uuid,uuid,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.record_article_translation_item_retry_response(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function probpera_translation_operations.get_article_item_retry_progress(uuid,uuid,uuid) to authenticated;
grant execute on function probpera_translation_operations.record_article_item_retry_dispatch(uuid,uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function probpera_translation_operations.record_article_item_retry_response(uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.get_article_translation_item_retry_progress(uuid,uuid,uuid) to authenticated;
grant execute on function public.record_article_translation_item_retry_dispatch(uuid,uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.record_article_translation_item_retry_response(uuid,uuid,uuid,jsonb) to authenticated;
