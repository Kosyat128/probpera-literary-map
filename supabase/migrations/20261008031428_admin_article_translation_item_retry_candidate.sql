-- A validated full English candidate lives only in the existing private
-- working draft. Operation, audit and progress records contain bounded
-- metadata. A stored candidate is never authority for another model call.
create or replace function probpera_translation_operations.retry_candidate_outcome_valid(p_value jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare field text; value jsonb;
begin
  if jsonb_typeof(p_value) is distinct from 'object' or octet_length(p_value::text)>16384
    or not(p_value ?& array['status','providerCalls'])
    or p_value - array['status','providerCalls','errorCode','model','requestId','inputTokens','outputTokens','durationMs']<>'{}'::jsonb
    or p_value -> 'status' is distinct from '"succeeded"'::jsonb
    or jsonb_typeof(p_value -> 'providerCalls') is distinct from 'number'
    or (p_value ->> 'providerCalls') !~ '^[1-4]$'
    or (p_value ? 'errorCode' and p_value -> 'errorCode'<>'null'::jsonb) then return false; end if;
  foreach field in array array['model','requestId'] loop
    value:=p_value -> field;
    if value is not null and value<>'null'::jsonb and
      (jsonb_typeof(value) is distinct from 'string'
       or probpera_translation_operations.retry_text_length(p_value ->> field) not between 1 and 200) then return false; end if;
  end loop;
  foreach field in array array['inputTokens','outputTokens','durationMs'] loop
    value:=p_value -> field;
    if value is not null and value<>'null'::jsonb and
      (jsonb_typeof(value) is distinct from 'number' or (p_value ->> field) !~ '^[0-9]{1,8}$'
       or (p_value ->> field)::numeric>case when field='durationMs' then 3600000 else 10000000 end) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end; $$;

create or replace function probpera_translation_operations.retry_candidate_meta_valid(p_value jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare stamp timestamptz;
begin
  if jsonb_typeof(p_value) is distinct from 'object'
    or not(p_value ?& array['version','preparedAt','candidateHash','finishFingerprint','outcome','workingDraftVersion','workingDraftUpdatedAt'])
    or p_value - array['version','preparedAt','candidateHash','finishFingerprint','outcome','workingDraftVersion','workingDraftUpdatedAt']<>'{}'::jsonb
    or p_value -> 'version' is distinct from '1'::jsonb
    or jsonb_typeof(p_value -> 'preparedAt') is distinct from 'string'
    or jsonb_typeof(p_value -> 'workingDraftUpdatedAt') is distinct from 'string'
    or jsonb_typeof(p_value -> 'candidateHash') is distinct from 'string'
    or (p_value ->> 'candidateHash') !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_value -> 'finishFingerprint') is distinct from 'string'
    or (p_value ->> 'finishFingerprint') !~ '^[a-f0-9]{64}$'
    or p_value -> 'workingDraftVersion' is distinct from '1'::jsonb
    or not probpera_translation_operations.retry_candidate_outcome_valid(p_value -> 'outcome') then return false; end if;
  stamp:=(p_value ->> 'preparedAt')::timestamptz;
  if not isfinite(stamp) then return false; end if;
  stamp:=(p_value ->> 'workingDraftUpdatedAt')::timestamptz;
  return isfinite(stamp);
exception when others then return false;
end; $$;

-- The caller holds operation -> item -> job -> article -> English -> draft.
-- This check never writes a canonical article, translation or private draft.
create or replace function probpera_translation_operations.retry_candidate_block_reason(
  p_active jsonb,p_meta jsonb,p_article public.articles,p_english public.article_translations,
  p_draft public.article_working_drafts,p_provider text
)
returns text language plpgsql stable security invoker set search_path='' as $$
declare snapshot jsonb; progress jsonb:=p_active -> 'progress';
begin
  if not probpera_translation_operations.retry_candidate_meta_valid(p_meta) then
    raise exception 'article retry candidate metadata changed' using errcode='40001'; end if;
  if not probpera_translation_operations.retry_journal_valid(progress,p_provider)
    or jsonb_array_length(progress -> 'calls') is distinct from (p_meta -> 'outcome' ->> 'providerCalls')::integer
    or exists(select 1 from jsonb_array_elements(progress -> 'calls') call where call -> 'responseReceivedAt'='null'::jsonb) then
    return 'provider_outcome_unconfirmed'; end if;
  if p_article.id is null or p_article.status<>'published' or p_article.deleted_at is not null
    or p_article.updated_at is distinct from (p_active ->> 'sourceUpdatedAt')::timestamptz then return 'source_changed'; end if;
  begin snapshot:=probpera_translation_operations.retry_ru_snapshot(p_article);
  exception when invalid_parameter_value then return 'source_changed'; end;
  if probpera_translation_operations.retry_fingerprint(snapshot) is distinct from p_active ->> 'sourceSnapshotHash' then return 'source_changed'; end if;
  if p_english.updated_at is distinct from (p_active ->> 'englishUpdatedAt')::timestamptz
    or (p_english.id is not null and (p_english.deleted_at is not null or p_english.source_content_hash is null
      or p_english.content_json -> '__probperaPremiumTranslation' -> 'version' is distinct from '1'::jsonb
      or p_english.content_json -> '__probperaPremiumTranslation' -> 'method' is distinct from '"machine-translation"'::jsonb
      or p_english.content_json -> '__probperaPremiumTranslation' ->> 'sourceHash' is distinct from p_english.source_content_hash)) then return 'english_changed'; end if;
  if p_draft.article_id is null then return 'draft_missing'; end if;
  if p_draft.actor_id::text is distinct from p_active ->> 'actorId'
    or p_draft.version is distinct from (p_meta ->> 'workingDraftVersion')::bigint
    or p_draft.updated_at is distinct from (p_meta ->> 'workingDraftUpdatedAt')::timestamptz
    or p_draft.base_article_updated_at is distinct from (p_active ->> 'sourceUpdatedAt')::timestamptz
    or p_draft.expected_english_updated_at is distinct from (p_active ->> 'englishUpdatedAt')::timestamptz
    or p_draft.draft_scope is distinct from 'english-only' or p_draft.draft_english_enabled is distinct from true
    or p_draft.payload is distinct from snapshot
    or not probpera_translation_operations.retry_payload_valid(p_draft.english_payload -> 'payload',true)
    or p_draft.english_payload -> 'mode' is distinct from '"save"'::jsonb
    or p_draft.english_payload - array['mode','payload']<>'{}'::jsonb
    or p_draft.english_payload -> 'payload' ->> 'source_content_hash' is distinct from p_active -> 'beginIntent' ->> 6
    or probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_draft.payload,p_draft.english_payload,p_meta -> 'outcome'))
      is distinct from p_meta ->> 'candidateHash'
    or probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_meta -> 'outcome',p_draft.english_payload))
      is distinct from p_meta ->> 'finishFingerprint' then return 'draft_changed'; end if;
  return null;
end; $$;

create or replace function probpera_translation_operations.retry_candidate_view(
  p_receipt jsonb,p_meta jsonb,p_provider_calls integer,p_phase text,p_reason text,p_replayed boolean
)
returns jsonb language sql stable security invoker set search_path='' set timezone='UTC'
return jsonb_build_object('version',1,'jobId',p_receipt -> 'jobId','itemId',p_receipt -> 'itemId',
  'articleId',p_receipt -> 'articleId','operationId',p_receipt -> 'operationId','provider',p_receipt -> 'provider',
  'sourceHash',p_receipt -> 'sourceHash','sourceUpdatedAt',p_receipt -> 'sourceUpdatedAt',
  'englishUpdatedAt',p_receipt -> 'englishUpdatedAt','phase',p_phase,
  'candidateState',case when p_meta is null then 'missing' when p_phase='finished' then 'finished' else 'staged' end,
  'candidateHash',p_meta -> 'candidateHash','preparedAt',p_meta -> 'preparedAt',
  'workingDraftVersion',p_meta -> 'workingDraftVersion','workingDraftUpdatedAt',p_meta -> 'workingDraftUpdatedAt',
  'providerCalls',p_provider_calls,'canRecover',p_phase='running' and p_meta is not null and p_reason is null,
  'replayed',p_replayed,'blockReason',p_reason);

create or replace function probpera_translation_operations.get_article_item_retry_candidate(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare job public.translation_jobs%rowtype; item public.translation_job_items%rowtype;
  prior public.translation_job_attempts%rowtype; article public.articles%rowtype;
  english public.article_translations%rowtype; draft public.article_working_drafts%rowtype;
  receipt jsonb; active jsonb; meta jsonb; reason text; phase text; calls integer;
begin
  perform probpera_translation_operations.retry_access();
  if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
    or not probpera_translation_operations.retry_uuid(p_operation_id) then
    raise exception 'invalid article retry candidate identity' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,7047));
  select * into prior from public.translation_job_attempts where staff_retry_operation_id=p_operation_id;
  if prior.id is not null then
    if prior.staff_retry_receipt ->> 'actorId' is distinct from (select auth.uid())::text then
      raise exception 'article retry actor changed' using errcode='42501'; end if;
    receipt:=prior.staff_retry_receipt -> 'receipt';
    if receipt ->> 'jobId' is distinct from p_job_id::text or receipt ->> 'itemId' is distinct from p_item_id::text then
      raise exception 'article retry candidate identity changed' using errcode='40001'; end if;
    meta:=nullif(prior.staff_retry_receipt -> 'candidate','null'::jsonb);
    if prior.staff_retry_receipt ? 'candidate' and meta is null then
      raise exception 'article retry candidate metadata changed' using errcode='40001'; end if;
    active:=jsonb_build_object('actorId',prior.staff_retry_receipt -> 'actorId','beginIntent',prior.staff_retry_receipt -> 'beginIntent',
      'sourceUpdatedAt',receipt -> 'sourceUpdatedAt','englishUpdatedAt',receipt -> 'englishUpdatedAt',
      'sourceSnapshotHash',prior.staff_retry_receipt -> 'sourceSnapshotHash','progress',prior.staff_retry_receipt -> 'progress');
    phase:='finished'; calls:=(receipt -> 'result' ->> 'providerCalls')::integer;
  else
    select other.staff_retry into active from public.translation_job_items other where other.staff_retry ->> 'operationId'=p_operation_id::text;
    if active is not null then
      if active ->> 'actorId' is distinct from (select auth.uid())::text then
        raise exception 'article retry actor changed' using errcode='42501'; end if;
      if active -> 'beginIntent' ->> 0 is distinct from p_job_id::text or active -> 'beginIntent' ->> 1 is distinct from p_item_id::text then
        raise exception 'article retry candidate identity changed' using errcode='40001'; end if;
    end if;
    select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id for update;
    select * into job from public.translation_jobs where id=p_job_id for update;
    if item.id is null or job.id is null then raise exception 'article retry item not found' using errcode='P0002'; end if;
    perform probpera_translation_operations.retry_journal_active(job,item,p_operation_id);
    active:=item.staff_retry; meta:=nullif(active -> 'candidate','null'::jsonb);
    if active ? 'candidate' and meta is null then
      raise exception 'article retry candidate metadata changed' using errcode='40001'; end if;
    receipt:=probpera_translation_operations.retry_view(job,item,'running',null,active,
      (active ->> 'sourceUpdatedAt')::timestamptz,(active ->> 'englishUpdatedAt')::timestamptz,false,false);
    phase:='running'; calls:=jsonb_array_length(coalesce(active -> 'progress' -> 'calls','[]'::jsonb));
  end if;
  if meta is null then reason:='candidate_missing';
  else
    select * into article from public.articles where id=(receipt ->> 'articleId')::uuid for update;
    select * into english from public.article_translations where article_id=article.id and locale='en' for update;
    select * into draft from public.article_working_drafts where article_id=article.id for update;
    reason:=probpera_translation_operations.retry_candidate_block_reason(active,meta,article,english,draft,receipt ->> 'provider');
  end if;
  return probpera_translation_operations.retry_candidate_view(receipt,meta,calls,phase,reason,phase='finished');
end; $$;

create or replace function probpera_translation_operations.stage_article_item_retry_candidate(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_outcome jsonb,p_english_payload jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare job public.translation_jobs%rowtype; item public.translation_job_items%rowtype;
  prior public.translation_job_attempts%rowtype; article public.articles%rowtype;
  english public.article_translations%rowtype; draft public.article_working_drafts%rowtype;
  active jsonb; meta jsonb; snapshot jsonb; saved jsonb; receipt jsonb; candidate_hash text; finish_hash text;
  reason text; now_at timestamptz;
begin
  perform probpera_translation_operations.retry_access();
  if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
    or not probpera_translation_operations.retry_uuid(p_operation_id)
    or not probpera_translation_operations.retry_candidate_outcome_valid(p_outcome)
    or jsonb_typeof(p_english_payload) is distinct from 'object'
    or not(p_english_payload ?& array['mode','payload']) or p_english_payload - array['mode','payload']<>'{}'::jsonb
    or p_english_payload -> 'mode' is distinct from '"save"'::jsonb
    or not probpera_translation_operations.retry_payload_valid(p_english_payload -> 'payload',true) then
    raise exception 'invalid article retry candidate' using errcode='22023'; end if;
  finish_hash:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_outcome,p_english_payload));
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,7047));
  -- Reuse the global operation/actor binding before admitting a new body.
  perform probpera_translation_operations.get_article_item_retry_progress(p_job_id,p_item_id,p_operation_id);
  select * into prior from public.translation_job_attempts where staff_retry_operation_id=p_operation_id;
  if prior.id is not null then
    if prior.staff_retry_receipt ->> 'actorId' is distinct from (select auth.uid())::text then
      raise exception 'article retry actor changed' using errcode='42501'; end if;
    if prior.staff_retry_receipt -> 'receipt' ->> 'jobId' is distinct from p_job_id::text
      or prior.staff_retry_receipt -> 'receipt' ->> 'itemId' is distinct from p_item_id::text
      or prior.staff_retry_receipt -> 'candidate' ->> 'finishFingerprint' is distinct from finish_hash then
      raise exception 'article retry candidate intent changed' using errcode='40001'; end if;
    return probpera_translation_operations.get_article_item_retry_candidate(p_job_id,p_item_id,p_operation_id)||jsonb_build_object('replayed',true);
  end if;
  select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id for update;
  select * into job from public.translation_jobs where id=p_job_id for update;
  if item.id is null or job.id is null then raise exception 'article retry item not found' using errcode='P0002'; end if;
  perform probpera_translation_operations.retry_journal_active(job,item,p_operation_id);
  active:=item.staff_retry; meta:=nullif(active -> 'candidate','null'::jsonb);
  if active ? 'candidate' and meta is null then
    raise exception 'article retry candidate metadata changed' using errcode='40001'; end if;
  if p_english_payload -> 'payload' ->> 'source_content_hash' is distinct from item.source_hash then
    raise exception 'article retry candidate source changed' using errcode='22023'; end if;
  if meta is not null then
    if not probpera_translation_operations.retry_candidate_meta_valid(meta) or meta ->> 'finishFingerprint' is distinct from finish_hash then
      raise exception 'article retry candidate intent changed' using errcode='40001'; end if;
    return probpera_translation_operations.get_article_item_retry_candidate(p_job_id,p_item_id,p_operation_id)||jsonb_build_object('replayed',true);
  end if;
  if job.status<>'reviewing' or job.cancel_requested_at is not null then
    raise exception 'article retry candidate was stopped' using errcode='40001'; end if;
  if not probpera_translation_operations.retry_journal_valid(active -> 'progress',job.provider)
    or jsonb_array_length(active -> 'progress' -> 'calls') is distinct from (p_outcome ->> 'providerCalls')::integer
    or exists(select 1 from jsonb_array_elements(active -> 'progress' -> 'calls') call where call -> 'responseReceivedAt'='null'::jsonb) then
    raise exception 'article retry provider outcome is unconfirmed' using errcode='40001'; end if;
  select * into article from public.articles where id=item.entity_id::uuid for update;
  select * into english from public.article_translations where article_id=item.entity_id::uuid and locale='en' for update;
  select * into draft from public.article_working_drafts where article_id=item.entity_id::uuid for update;
  if article.id is null or article.status<>'published' or article.deleted_at is not null
    or article.updated_at is distinct from (active ->> 'sourceUpdatedAt')::timestamptz then
    raise exception 'article retry candidate source changed' using errcode='40001'; end if;
  snapshot:=probpera_translation_operations.retry_ru_snapshot(article);
  if probpera_translation_operations.retry_fingerprint(snapshot) is distinct from active ->> 'sourceSnapshotHash' then
    raise exception 'article retry candidate source changed' using errcode='40001'; end if;
  if english.updated_at is distinct from (active ->> 'englishUpdatedAt')::timestamptz or draft.article_id is not null
    or (english.id is not null and (english.deleted_at is not null or english.source_content_hash is null
      or english.content_json -> '__probperaPremiumTranslation' -> 'version' is distinct from '1'::jsonb
      or english.content_json -> '__probperaPremiumTranslation' -> 'method' is distinct from '"machine-translation"'::jsonb
      or english.content_json -> '__probperaPremiumTranslation' ->> 'sourceHash' is distinct from english.source_content_hash)) then
    raise exception 'article retry candidate English or draft changed' using errcode='40001'; end if;
  candidate_hash:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(snapshot,p_english_payload,p_outcome));
  saved:=public.save_article_working_draft(article.id,(active ->> 'sourceUpdatedAt')::timestamptz,snapshot,
    p_english_payload,(active ->> 'englishUpdatedAt')::timestamptz,0);
  if saved ->> 'articleId' is distinct from article.id::text or saved -> 'version' is distinct from '1'::jsonb
    or jsonb_typeof(saved -> 'updatedAt') is distinct from 'string' then
    raise exception 'invalid article retry candidate draft receipt' using errcode='22023'; end if;
  update public.article_working_drafts set draft_scope='english-only',draft_english_enabled=true where article_id=article.id and version=1;
  if not found then raise exception 'article retry candidate draft changed' using errcode='40001'; end if;
  now_at:=clock_timestamp();
  meta:=jsonb_build_object('version',1,'preparedAt',now_at,'candidateHash',candidate_hash,'finishFingerprint',finish_hash,
    'outcome',p_outcome,'workingDraftVersion',1,'workingDraftUpdatedAt',(saved ->> 'updatedAt')::timestamptz);
  active:=active||jsonb_build_object('candidate',meta);
  if octet_length(active::text)>16384 then raise exception 'article retry candidate metadata exceeds bound' using errcode='22023'; end if;
  update public.translation_job_items set staff_retry=active,updated_at=now_at where id=item.id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values((select auth.uid()),'translation.article_item_retry.candidate_staged','translation_job',job.id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',item.id,'candidateHash',candidate_hash,'workingDraftVersion',1,
        'workingDraftUpdatedAt',meta -> 'workingDraftUpdatedAt','recordedAdmissions',(p_outcome ->> 'providerCalls')::integer));
  return probpera_translation_operations.get_article_item_retry_candidate(p_job_id,p_item_id,p_operation_id)||jsonb_build_object('replayed',false);
end; $$;

create or replace function probpera_translation_operations.recover_article_item_retry_candidate(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_expected_candidate_hash text
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare view jsonb; prior jsonb; meta jsonb; item public.translation_job_items%rowtype;
  job public.translation_jobs%rowtype; draft public.article_working_drafts%rowtype;
begin
  perform probpera_translation_operations.retry_access();
  if p_expected_candidate_hash is null or p_expected_candidate_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid article retry candidate hash' using errcode='22023'; end if;
  view:=probpera_translation_operations.get_article_item_retry_candidate(p_job_id,p_item_id,p_operation_id);
  if view ->> 'candidateHash' is distinct from p_expected_candidate_hash then
    raise exception 'article retry candidate hash changed' using errcode='40001'; end if;
  if view ->> 'phase'='finished' then
    select staff_retry_receipt into prior from public.translation_job_attempts where staff_retry_operation_id=p_operation_id;
    return prior -> 'receipt'||jsonb_build_object('replayed',true,'canExecute',false);
  end if;
  if view -> 'canRecover' is distinct from 'true'::jsonb then
    raise exception 'article retry candidate cannot be recovered: %',view ->> 'blockReason' using errcode='40001'; end if;
  select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id for update;
  select * into job from public.translation_jobs where id=p_job_id for update;
  perform probpera_translation_operations.retry_journal_active(job,item,p_operation_id);
  meta:=item.staff_retry -> 'candidate';
  select * into draft from public.article_working_drafts where article_id=item.entity_id::uuid for update;
  return probpera_translation_operations.finish_article_item_retry(p_job_id,p_item_id,p_operation_id,meta -> 'outcome',draft.english_payload);
end; $$;

create or replace function public.stage_article_translation_item_retry_candidate(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_outcome jsonb,p_english_payload jsonb
)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.stage_article_item_retry_candidate(p_job_id,p_item_id,p_operation_id,p_outcome,p_english_payload);
create or replace function public.get_article_translation_item_retry_candidate(p_job_id uuid,p_item_id uuid,p_operation_id uuid)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.get_article_item_retry_candidate(p_job_id,p_item_id,p_operation_id);
create or replace function public.recover_article_translation_item_retry_candidate(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_expected_candidate_hash text
)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.recover_article_item_retry_candidate(p_job_id,p_item_id,p_operation_id,p_expected_candidate_hash);

revoke all on function probpera_translation_operations.retry_candidate_outcome_valid(jsonb) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.retry_candidate_meta_valid(jsonb) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.retry_candidate_block_reason(jsonb,jsonb,public.articles,public.article_translations,public.article_working_drafts,text) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.retry_candidate_view(jsonb,jsonb,integer,text,text,boolean) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.get_article_item_retry_candidate(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.stage_article_item_retry_candidate(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.recover_article_item_retry_candidate(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.get_article_translation_item_retry_candidate(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.stage_article_translation_item_retry_candidate(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.recover_article_translation_item_retry_candidate(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function probpera_translation_operations.get_article_item_retry_candidate(uuid,uuid,uuid) to authenticated;
grant execute on function probpera_translation_operations.stage_article_item_retry_candidate(uuid,uuid,uuid,jsonb,jsonb) to authenticated;
grant execute on function probpera_translation_operations.recover_article_item_retry_candidate(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.get_article_translation_item_retry_candidate(uuid,uuid,uuid) to authenticated;
grant execute on function public.stage_article_translation_item_retry_candidate(uuid,uuid,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.recover_article_translation_item_retry_candidate(uuid,uuid,uuid,text) to authenticated;

-- Additive prepared-aware replacements; previous SQL files remain unchanged.
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
  active:=item.staff_retry;
  -- The immutable marker survives a caller's explicit working-draft discard.
  -- A staged body never grants another paid pass, even if its row is absent.
  if active ? 'candidate' then
    raise exception 'article retry candidate is already staged' using errcode='40001'; end if;
  calls:=coalesce(active -> 'progress' -> 'calls','[]'::jsonb);
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
  candidate jsonb; candidate_reason text; draft public.article_working_drafts%rowtype;
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
  candidate:=nullif(active -> 'candidate','null'::jsonb);
  if active ? 'candidate' and (candidate is null or not probpera_translation_operations.retry_candidate_meta_valid(candidate)
    or candidate ->> 'finishFingerprint' is distinct from request_hash) then
    raise exception 'article retry prepared finish intent changed' using errcode='40001'; end if;
  select * into article from public.articles where id=item.entity_id::uuid for update;
  select * into english from public.article_translations where article_id=item.entity_id::uuid and locale='en' for update;
  -- A known provider outcome is always journaled. A cancelled or changed
  -- source has no draft write, and does not turn generated text into review.
  if candidate is not null then
    select * into draft from public.article_working_drafts where article_id=item.entity_id::uuid for update;
    candidate_reason:=probpera_translation_operations.retry_candidate_block_reason(active,candidate,article,english,draft,job.provider);
    if candidate_reason is not null then
      raise exception 'article retry prepared candidate changed: %',candidate_reason using errcode='40001'; end if;
    if job.cancel_requested_at is not null or job.status in ('cancelled','cancelling') then
      outcome:='cancelled'; code:=null;
      -- The private body was already saved at STAGE and remains available.
      -- This cancelled FINISH performs no draft write.
    else
      saved:=jsonb_build_object('articleId',draft.article_id,'version',draft.version,'updatedAt',draft.updated_at);
      draft_stamp:=draft.updated_at;
      -- Consume the protected SAME row: no second save or version increment.
    end if;
  elsif job.cancel_requested_at is not null or job.status in ('cancelled','cancelling') then
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
        'progress',active -> 'progress','startedAt',active -> 'startedAt')
        ||case when candidate is null then '{}'::jsonb else jsonb_build_object(
          'candidate',candidate,'sourceSnapshotHash',active -> 'sourceSnapshotHash') end);
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(actor,'translation.article_item_retry.finished','translation_job',job.id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',item.id,'attemptNumber',attempt_number,
        'outcome',outcome,'persistence',result -> 'persistence','jobVersion',job.version::text));
  return receipt;
end; $$;
