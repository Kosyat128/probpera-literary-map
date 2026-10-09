-- Ordinary article translation uses the existing jobs, items, attempt journal
-- and private English candidate. Admission is committed before provider work.
-- Historical migrations and the unused service-role lease API stay intact.
begin;

create or replace function probpera_translation_operations.ordinary_marker(p_job public.translation_jobs)
returns boolean language sql immutable security invoker set search_path=''
return p_job.kind='article' and p_job.resume_cursor ? 'articleOrdinary';

create or replace function probpera_translation_operations.ordinary_access(p_job_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare job public.translation_jobs%rowtype;
begin
  select * into job from public.translation_jobs where id=p_job_id;
  if job.id is not null and probpera_translation_operations.ordinary_marker(job) then
    if (select auth.uid()) is null
      or not public.is_staff(array['owner','admin']::public.staff_role[])
      or job.requested_by is distinct from (select auth.uid()) then
      raise exception 'ordinary article translation requires its owner or admin actor' using errcode='42501';
    end if;
  end if;
  return true;
end; $$;

create or replace function probpera_translation_operations.ordinary_cursor_valid(p_cursor jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare scan jsonb; value jsonb; ids uuid[]; upper_id uuid; after_id uuid; next_index integer;
begin
  if p_cursor is null or jsonb_typeof(p_cursor) is distinct from 'object'
    or octet_length(p_cursor::text)>65536
    or p_cursor-array['articleScan','articleCursor','libraryCursor','writerCursor','countryCursor']<>'{}'::jsonb then return false; end if;
  for value in select entry.value from jsonb_each(p_cursor-'articleScan') entry loop
    if jsonb_typeof(value) is distinct from 'number' or value::text !~ '^[0-9]{1,9}$' then return false; end if;
  end loop;
  if not(p_cursor ? 'articleScan') then return true; end if;
  scan:=p_cursor -> 'articleScan';
  if jsonb_typeof(scan) is distinct from 'object'
    or not(scan ?& array['version','order','upperId','afterId','pendingIds','nextIndex','lastWindow','exhausted'])
    or scan-array['version','order','upperId','afterId','pendingIds','nextIndex','lastWindow','exhausted']<>'{}'::jsonb
    or scan -> 'version' is distinct from '1'::jsonb or scan -> 'order' is distinct from '"id"'::jsonb
    or jsonb_typeof(scan -> 'upperId') is distinct from 'string'
    or not probpera_translation_operations.retry_uuid((scan ->> 'upperId')::uuid)
    or (scan -> 'afterId'<>'null'::jsonb and (jsonb_typeof(scan -> 'afterId') is distinct from 'string'
      or not probpera_translation_operations.retry_uuid((scan ->> 'afterId')::uuid)))
    or jsonb_typeof(scan -> 'pendingIds') is distinct from 'array' or jsonb_array_length(scan -> 'pendingIds')>500
    or jsonb_typeof(scan -> 'nextIndex') is distinct from 'number' or (scan ->> 'nextIndex') !~ '^[0-9]{1,3}$'
    or jsonb_typeof(scan -> 'lastWindow') is distinct from 'boolean'
    or jsonb_typeof(scan -> 'exhausted') is distinct from 'boolean' then return false; end if;
  upper_id:=(scan ->> 'upperId')::uuid; after_id:=(scan ->> 'afterId')::uuid;
  next_index:=(scan ->> 'nextIndex')::integer;
  if after_id>upper_id or next_index>jsonb_array_length(scan -> 'pendingIds') then return false; end if;
  if exists(select 1 from jsonb_array_elements(scan -> 'pendingIds') element
    where jsonb_typeof(element) is distinct from 'string'
      or not probpera_translation_operations.retry_uuid((element #>> '{}')::uuid)) then return false; end if;
  select coalesce(array_agg((element #>> '{}')::uuid order by position),'{}'::uuid[]) into ids
    from jsonb_array_elements(scan -> 'pendingIds') with ordinality entries(element,position);
  if exists(select 1 from unnest(ids) with ordinality entries(id,position)
    where id>upper_id or id<=after_id or (position>1 and id<=ids[position-1])) then return false; end if;
  if scan -> 'exhausted'='true'::jsonb and (scan -> 'lastWindow'<>'true'::jsonb
    or cardinality(ids)<>0 or next_index<>0) then return false; end if;
  return true;
exception when others then return false;
end; $$;

create or replace function probpera_translation_operations.ordinary_run_view(p_job public.translation_jobs,p_replayed boolean default false)
returns jsonb language sql stable security invoker set search_path=''
return jsonb_build_object('version',1,'jobId',p_job.id,'provider',p_job.provider,'actorId',p_job.requested_by,
  'jobVersion',p_job.version::text,'status',p_job.status,'totalItems',p_job.total_items,
  'succeededItems',p_job.succeeded_items,'failedItems',p_job.failed_items,
  'activeItems',(select count(*) from public.translation_job_items where job_id=p_job.id and staff_retry is not null),
  'pendingItems',(select count(*) from public.translation_job_items where job_id=p_job.id and status in ('queued','leased','retry_wait')),
  'resumeCursor',p_job.resume_cursor-'articleOrdinary','replayed',p_replayed);

create or replace function probpera_translation_operations.ordinary_refresh_job(p_job_id uuid)
returns public.translation_jobs language plpgsql volatile security invoker set search_path='' as $$
declare job public.translation_jobs%rowtype; succeeded integer; failed integer; conflicts integer;
  stale integer; unavailable integer; active integer; pending integer;
begin
  select * into job from public.translation_jobs where id=p_job_id for update;
  select count(*) filter(where status='succeeded'),count(*) filter(where status='dead_letter'),
    count(*) filter(where status='conflict'),count(*) filter(where status='stale'),
    count(*) filter(where status='not-configured'),count(*) filter(where staff_retry is not null or status='reviewing'),
    count(*) filter(where status in ('queued','leased','retry_wait'))
    into succeeded,failed,conflicts,stale,unavailable,active,pending
    from public.translation_job_items where job_id=p_job_id;
  update public.translation_jobs set succeeded_items=succeeded,failed_items=failed,
    status=case when cancel_requested_at is not null or job.status in ('cancelled','cancelling')
      then case when active+pending>0 then 'cancelling' else 'cancelled' end
      when active>0 then 'reviewing' when pending>0 then 'running'
      when failed>0 then case when succeeded>0 then 'partial' else 'failed' end
      when conflicts>0 then 'conflict' when stale>0 then 'stale' when unavailable>0 then 'not-configured'
      when succeeded=0 then 'skipped' else 'completed' end,
    completed_at=case when active+pending>0 then null else coalesce(completed_at,clock_timestamp()) end,
    updated_at=clock_timestamp() where id=p_job_id returning * into job;
  return job;
end; $$;

-- Pre-existing duplicate active operations need reconciliation. Never delete
-- their state, expire an unknown provider admission, or silently choose one.
do $$
begin
  if exists(select 1 from public.translation_job_items where entity_type='article' and staff_retry is not null
    group by entity_type,entity_id::uuid having count(*)>1) then
    raise exception 'active article translation operations require reconciliation before admission upgrade' using errcode='40001';
  end if;
end; $$;
create unique index translation_article_active_operation_unique
  on public.translation_job_items(entity_type,(entity_id::uuid))
  where entity_type='article' and staff_retry is not null;

create or replace function probpera_translation_operations.ordinary_write_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare job public.translation_jobs%rowtype; old_job public.translation_jobs%rowtype; job_id uuid;
  marked boolean:=false; actor uuid:=(select auth.uid());
begin
  if tg_table_name='translation_jobs' then
    job:=case when tg_op='DELETE' then old else new end;
    marked:=probpera_translation_operations.ordinary_marker(job)
      or (tg_op='UPDATE' and probpera_translation_operations.ordinary_marker(old));
    if tg_op='UPDATE' and probpera_translation_operations.ordinary_marker(old)
      and ((new.resume_cursor -> 'articleOrdinary')-'lastCheckpointHash') is distinct from
        ((old.resume_cursor -> 'articleOrdinary')-'lastCheckpointHash') then
      raise exception 'ordinary article run identity changed' using errcode='40001'; end if;
  elsif tg_table_name='translation_job_items' then
    job_id:=case when tg_op='DELETE' then old.job_id else new.job_id end;
    select * into job from public.translation_jobs where id=job_id;
    marked:=probpera_translation_operations.ordinary_marker(job);
    if tg_op='UPDATE' then
      select * into old_job from public.translation_jobs where id=old.job_id;
      if probpera_translation_operations.ordinary_marker(old_job) then
        perform probpera_translation_operations.ordinary_access(old_job.id);
        if new.job_id is distinct from old.job_id or new.id is distinct from old.id
          or new.entity_type is distinct from old.entity_type or new.entity_id is distinct from old.entity_id then
          raise exception 'ordinary article item identity changed' using errcode='40001'; end if;
      end if;
    end if;
  else
    select item.job_id into job_id from public.translation_job_items item
      where item.id=case when tg_op='DELETE' then old.item_id else new.item_id end;
    select * into job from public.translation_jobs where id=job_id;
    marked:=probpera_translation_operations.ordinary_marker(job);
    if tg_op='UPDATE' then
      select jobs.* into old_job from public.translation_job_items items
        join public.translation_jobs jobs on jobs.id=items.job_id where items.id=old.item_id;
      if probpera_translation_operations.ordinary_marker(old_job) then
        perform probpera_translation_operations.ordinary_access(old_job.id);
        if new.item_id is distinct from old.item_id or new.id is distinct from old.id
          or new.attempt_number is distinct from old.attempt_number then
          raise exception 'ordinary article attempt identity changed' using errcode='40001'; end if;
      end if;
    end if;
  end if;
  if marked and (actor is null or not public.is_staff(array['owner','admin']::public.staff_role[])
    or job.requested_by is distinct from actor) then
    raise exception 'ordinary article translation mutation requires its owner or admin actor' using errcode='42501'; end if;
  if marked and tg_table_name='translation_jobs' and (jsonb_typeof(job.resume_cursor -> 'articleOrdinary') is distinct from 'object'
    or job.resume_cursor -> 'articleOrdinary' -> 'version' is distinct from '1'::jsonb
    or job.resume_cursor -> 'articleOrdinary' ->> 'actorId' is distinct from job.requested_by::text
    or job.resume_cursor -> 'articleOrdinary' ->> 'provider' is distinct from job.provider) then
    raise exception 'invalid ordinary article run marker' using errcode='22023'; end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;

create trigger translation_jobs_ordinary_access before insert or update or delete on public.translation_jobs
  for each row execute function probpera_translation_operations.ordinary_write_guard();
create trigger translation_job_items_ordinary_access before insert or update or delete on public.translation_job_items
  for each row execute function probpera_translation_operations.ordinary_write_guard();
create trigger translation_job_attempts_ordinary_access before insert or update or delete on public.translation_job_attempts
  for each row execute function probpera_translation_operations.ordinary_write_guard();

create or replace function probpera_translation_operations.get_article_sync_run(p_job_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare job public.translation_jobs%rowtype;
begin
  perform probpera_translation_operations.retry_access();
  perform probpera_translation_operations.ordinary_access(p_job_id);
  if not probpera_translation_operations.retry_uuid(p_job_id) then raise exception 'invalid ordinary article job identity' using errcode='22023'; end if;
  select * into job from public.translation_jobs where id=p_job_id;
  if job.id is null then raise exception 'ordinary article job not found' using errcode='P0002'; end if;
  if not probpera_translation_operations.ordinary_marker(job) then raise exception 'ordinary article job not found' using errcode='P0002'; end if;
  return probpera_translation_operations.ordinary_run_view(job);
end; $$;

create or replace function probpera_translation_operations.begin_article_sync_item(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_article_id uuid,p_expected_job_version bigint,
  p_expected_source_hash text,p_expected_article_updated_at timestamptz,p_expected_english_updated_at timestamptz,
  p_provider text,p_expected_cursor jsonb,p_resume_cursor jsonb,p_expected_source_snapshot jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=(select auth.uid()); job public.translation_jobs%rowtype; item public.translation_job_items%rowtype;
  article public.articles%rowtype; english public.article_translations%rowtype; prior jsonb; active jsonb;
  snapshot jsonb; snapshot_hash text; intent jsonb; marker jsonb; created boolean:=false; violated_constraint text;
begin
  if actor is null or not public.is_staff(array['owner','admin']::public.staff_role[]) then
    raise exception 'ordinary article translation requires owner or admin access' using errcode='42501'; end if;
  if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
    or not probpera_translation_operations.retry_uuid(p_operation_id) or not probpera_translation_operations.retry_uuid(p_article_id)
    or p_expected_job_version is null or p_expected_job_version not between 0 and 9223372036854775805
    or p_expected_source_hash is null or p_expected_source_hash !~ '^[a-f0-9]{64}$'
    or p_expected_article_updated_at is null or not isfinite(p_expected_article_updated_at)
    or (p_expected_english_updated_at is not null and not isfinite(p_expected_english_updated_at))
    or p_provider is null or p_provider not in ('openai','cloudflare')
    or not probpera_translation_operations.ordinary_cursor_valid(p_expected_cursor)
    or not probpera_translation_operations.ordinary_cursor_valid(p_resume_cursor)
    or not probpera_translation_operations.retry_payload_valid(p_expected_source_snapshot,false) then
    raise exception 'invalid ordinary article translation intent' using errcode='22023'; end if;
  snapshot_hash:=probpera_translation_operations.retry_fingerprint(p_expected_source_snapshot);
  intent:=jsonb_build_array(p_job_id,p_item_id,p_operation_id,actor,p_expected_job_version::text,0,
    p_expected_source_hash,p_expected_article_updated_at,p_expected_english_updated_at,p_provider,
    snapshot_hash,probpera_translation_operations.retry_fingerprint(p_expected_cursor),
    probpera_translation_operations.retry_fingerprint(p_resume_cursor),'ordinary');
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,7047));
  perform pg_advisory_xact_lock(hashtextextended(p_job_id::text,7048));
  select staff_retry_receipt into prior from public.translation_job_attempts where staff_retry_operation_id=p_operation_id;
  if prior is not null then
    perform probpera_translation_operations.ordinary_access(p_job_id);
    if prior ->> 'actorId' is distinct from actor::text then raise exception 'ordinary article actor changed' using errcode='42501'; end if;
    if prior -> 'beginIntent' is distinct from intent then raise exception 'ordinary article intent changed' using errcode='40001'; end if;
    return prior -> 'receipt'||jsonb_build_object('replayed',true,'canExecute',false);
  end if;
  select * into item from public.translation_job_items where id=p_item_id for update;
  if item.id is not null then
    perform probpera_translation_operations.ordinary_access(item.job_id);
    if item.job_id is distinct from p_job_id or item.staff_retry is null or item.staff_retry -> 'beginIntent' is distinct from intent then
      raise exception 'ordinary article item or intent changed' using errcode='40001'; end if;
    select * into job from public.translation_jobs where id=p_job_id;
    return probpera_translation_operations.retry_view(job,item,'running',null,item.staff_retry,
      p_expected_article_updated_at,p_expected_english_updated_at,false,true);
  end if;
  if exists(select 1 from public.translation_job_items where staff_retry ->> 'operationId'=p_operation_id::text) then
    raise exception 'ordinary article operation belongs to another item' using errcode='40001'; end if;
  if probpera_translation_operations.article_sync_ready() is distinct from true then
    raise exception 'ordinary article admission capability is unavailable' using errcode='42883'; end if;
  select * into job from public.translation_jobs where id=p_job_id for update;
  if job.id is null then
    if p_expected_job_version<>0 then raise exception 'ordinary article job not found' using errcode='P0002'; end if;
    marker:=jsonb_build_object('version',1,'actorId',actor,'provider',p_provider,
      'initialCursorHash',probpera_translation_operations.retry_fingerprint(p_expected_cursor),'lastCheckpointHash',null);
    insert into public.translation_jobs(id,kind,provider,status,total_items,requested_by,started_at,resume_cursor)
      values(p_job_id,'article',p_provider,'running',0,actor,clock_timestamp(),
        p_expected_cursor||jsonb_build_object('articleOrdinary',marker)) returning * into job;
    created:=true;
  else
    perform probpera_translation_operations.ordinary_access(p_job_id);
    if not probpera_translation_operations.ordinary_marker(job) or job.provider is distinct from p_provider
      or job.version is distinct from p_expected_job_version
      or (job.resume_cursor-'articleOrdinary') is distinct from p_expected_cursor then
      raise exception 'ordinary article job or cursor changed' using errcode='40001'; end if;
  end if;
  if job.cancel_requested_at is not null or job.status in ('cancelled','cancelling') then
    raise exception 'ordinary article run was stopped' using errcode='42501'; end if;
  if job.total_items>=500 or exists(select 1 from public.translation_job_items where job_id=job.id and entity_type='article' and entity_id=p_article_id::text) then
    raise exception 'ordinary article is already recorded or run is full' using errcode='40001'; end if;
  if exists(select 1 from public.translation_job_items where entity_type='article' and staff_retry is not null and entity_id::uuid=p_article_id) then
    raise exception 'article translation operation is already active' using errcode='40001'; end if;
  if p_expected_cursor ? 'articleScan' and p_resume_cursor -> 'articleScan' -> 'upperId' is distinct from p_expected_cursor -> 'articleScan' -> 'upperId' then
    raise exception 'ordinary article scan boundary changed' using errcode='40001'; end if;
  select * into article from public.articles where id=p_article_id for update;
  select * into english from public.article_translations where article_id=p_article_id and locale='en' for update;
  if article.id is null or article.status<>'published' or article.deleted_at is not null
    or article.updated_at is distinct from p_expected_article_updated_at
    or english.updated_at is distinct from p_expected_english_updated_at
    or exists(select 1 from public.article_working_drafts where article_id=p_article_id) then
    raise exception 'ordinary article source, English or draft changed' using errcode='40001'; end if;
  if english.id is not null and (english.deleted_at is not null or english.source_content_hash is null
    or english.content_json -> '__probperaPremiumTranslation' -> 'version' is distinct from '1'::jsonb
    or english.content_json -> '__probperaPremiumTranslation' -> 'method' is distinct from '"machine-translation"'::jsonb
    or english.content_json -> '__probperaPremiumTranslation' ->> 'sourceHash' is distinct from english.source_content_hash) then
    raise exception 'ordinary article English is manual or unavailable' using errcode='40001'; end if;
  snapshot:=probpera_translation_operations.retry_ru_snapshot(article);
  if snapshot is distinct from p_expected_source_snapshot then
    raise exception 'ordinary article full source snapshot changed' using errcode='40001'; end if;
  active:=jsonb_build_object('version',1,'operationId',p_operation_id,'actorId',actor,'articleId',p_article_id,
    'beginIntent',intent,'sourceUpdatedAt',p_expected_article_updated_at,'englishUpdatedAt',p_expected_english_updated_at,
    'attemptNumber',1,'startedAt',clock_timestamp(),'sourceSnapshotHash',snapshot_hash,
    'progress',jsonb_build_object('version',1,'updatedAt',clock_timestamp(),'calls','[]'::jsonb));
  insert into public.translation_job_items(id,job_id,position,entity_type,entity_id,source_hash,status,max_attempts,staff_retry)
    values(p_item_id,p_job_id,job.total_items,'article',p_article_id::text,p_expected_source_hash,'reviewing',3,active)
    returning * into item;
  update public.translation_jobs set total_items=total_items+1,status='reviewing',completed_at=null,
    resume_cursor=p_resume_cursor||jsonb_build_object('articleOrdinary',resume_cursor -> 'articleOrdinary'),
    version=case when created then version else version+1 end,updated_at=clock_timestamp()
    where id=p_job_id returning * into job;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(actor,'translation.article_sync.admitted','translation_job',p_job_id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'articleId',p_article_id,
        'sourceHash',p_expected_source_hash,'sourceSnapshotHash',snapshot_hash,'jobVersion',job.version::text));
  return probpera_translation_operations.retry_view(job,item,'running',null,active,
    p_expected_article_updated_at,p_expected_english_updated_at,true,false);
exception when unique_violation then
  get stacked diagnostics violated_constraint=constraint_name;
  if violated_constraint='translation_article_active_operation_unique' then
    raise exception 'article translation operation is already active' using errcode='40001';
  end if;
  raise;
end; $$;

create or replace function probpera_translation_operations.checkpoint_article_sync_run(
  p_job_id uuid,p_expected_job_version bigint,p_expected_cursor jsonb,p_resume_cursor jsonb,p_observed_items jsonb,p_provider text
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); job public.translation_jobs%rowtype; observation jsonb;
  item public.translation_job_items%rowtype; marker jsonb; request_hash text; created boolean:=false;
begin
  if actor is null or not public.is_staff(array['owner','admin']::public.staff_role[]) then
    raise exception 'ordinary article checkpoint requires owner or admin access' using errcode='42501'; end if;
  if not probpera_translation_operations.retry_uuid(p_job_id) or p_expected_job_version is null
    or p_expected_job_version not between 0 and 9223372036854775805
    or p_provider is null or p_provider not in ('openai','cloudflare')
    or not probpera_translation_operations.ordinary_cursor_valid(p_expected_cursor)
    or not probpera_translation_operations.ordinary_cursor_valid(p_resume_cursor)
    or jsonb_typeof(p_observed_items) is distinct from 'array' or jsonb_array_length(p_observed_items)>500
    or octet_length(p_observed_items::text)>262144 then
    raise exception 'invalid ordinary article checkpoint' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_observed_items) value where
    jsonb_typeof(value) is distinct from 'object' or not(value ?& array['entityId','state'])
    or value-array['entityId','state','sourceHash']<>'{}'::jsonb
    or jsonb_typeof(value -> 'entityId') is distinct from 'string'
    or not probpera_translation_operations.retry_uuid((value ->> 'entityId')::uuid)
    or jsonb_typeof(value -> 'state') is distinct from 'string' or value ->> 'state' not in ('current','manual','skipped')
    or (value ? 'sourceHash' and (jsonb_typeof(value -> 'sourceHash') is distinct from 'string'
      or value ->> 'sourceHash' !~ '^[a-f0-9]{64}$'))) then
    raise exception 'invalid ordinary article observation' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_observed_items) value group by (value ->> 'entityId')::uuid having count(*)>1) then
    raise exception 'duplicate ordinary article observation' using errcode='22023'; end if;
  request_hash:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_job_id,actor,
    p_expected_job_version::text,p_expected_cursor,p_resume_cursor,p_observed_items,p_provider));
  perform pg_advisory_xact_lock(hashtextextended(p_job_id::text,7048));
  select * into job from public.translation_jobs where id=p_job_id for update;
  if job.id is null then
    if p_expected_job_version<>0 or jsonb_array_length(p_observed_items)=0 then
      raise exception 'ordinary article checkpoint job not found' using errcode='P0002'; end if;
    marker:=jsonb_build_object('version',1,'actorId',actor,'provider',p_provider,
      'initialCursorHash',probpera_translation_operations.retry_fingerprint(p_expected_cursor),'lastCheckpointHash',null);
    insert into public.translation_jobs(id,kind,provider,status,total_items,requested_by,started_at,resume_cursor)
      values(p_job_id,'article',p_provider,'running',0,actor,clock_timestamp(),
        p_expected_cursor||jsonb_build_object('articleOrdinary',marker)) returning * into job;
    created:=true;
  else
    perform probpera_translation_operations.ordinary_access(p_job_id);
    if not probpera_translation_operations.ordinary_marker(job) or job.provider is distinct from p_provider then
      raise exception 'ordinary article checkpoint domain changed' using errcode='40001'; end if;
    if job.resume_cursor -> 'articleOrdinary' ->> 'lastCheckpointHash'=request_hash then
      return probpera_translation_operations.ordinary_run_view(job,true); end if;
    if job.version is distinct from p_expected_job_version or (job.resume_cursor-'articleOrdinary') is distinct from p_expected_cursor then
      raise exception 'ordinary article checkpoint cursor changed' using errcode='40001'; end if;
  end if;
  if job.cancel_requested_at is not null or job.status in ('cancelled','cancelling') then
    raise exception 'ordinary article checkpoint was stopped' using errcode='42501'; end if;
  if exists(select 1 from public.translation_job_items where job_id=p_job_id and (staff_retry is not null or status in ('queued','leased','reviewing','retry_wait'))) then
    raise exception 'ordinary article checkpoint has unresolved items' using errcode='40001'; end if;
  if p_expected_cursor ? 'articleScan' and p_resume_cursor -> 'articleScan' -> 'upperId' is distinct from p_expected_cursor -> 'articleScan' -> 'upperId' then
    raise exception 'ordinary article scan boundary changed' using errcode='40001'; end if;
  for observation in select value from jsonb_array_elements(p_observed_items) loop
    if exists(select 1 from public.translation_job_items where job_id=p_job_id and entity_id=((observation ->> 'entityId')::uuid)::text) then
      raise exception 'ordinary article observation already recorded' using errcode='40001'; end if;
    if job.total_items>=500 then raise exception 'ordinary article run is full' using errcode='40001'; end if;
    insert into public.translation_job_items(job_id,position,entity_type,entity_id,source_hash,status,max_attempts)
      values(p_job_id,job.total_items,'article',((observation ->> 'entityId')::uuid)::text,
        observation ->> 'sourceHash','skipped',3);
    update public.translation_jobs set total_items=total_items+1 where id=p_job_id returning * into job;
  end loop;
  marker:=(job.resume_cursor -> 'articleOrdinary')||jsonb_build_object('lastCheckpointHash',request_hash);
  update public.translation_jobs set resume_cursor=p_resume_cursor||jsonb_build_object('articleOrdinary',marker),
    version=case when created then version else version+1 end,updated_at=clock_timestamp()
    where id=p_job_id returning * into job;
  job:=probpera_translation_operations.ordinary_refresh_job(p_job_id);
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(actor,'translation.article_sync.checkpointed','translation_job',p_job_id::text,
      jsonb_build_object('observedItems',p_observed_items,'jobVersion',job.version::text,'requestHash',request_hash));
  return probpera_translation_operations.ordinary_run_view(job);
end; $$;

create or replace function public.get_article_translation_sync_run(p_job_id uuid)
returns jsonb language sql stable security invoker set search_path=''
return probpera_translation_operations.get_article_sync_run(p_job_id);
create or replace function public.begin_article_translation_sync_item(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_article_id uuid,p_expected_job_version bigint,
  p_expected_source_hash text,p_expected_article_updated_at timestamptz,p_expected_english_updated_at timestamptz,
  p_provider text,p_expected_cursor jsonb,p_resume_cursor jsonb,p_expected_source_snapshot jsonb
)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.begin_article_sync_item(p_job_id,p_item_id,p_operation_id,p_article_id,
  p_expected_job_version,p_expected_source_hash,p_expected_article_updated_at,p_expected_english_updated_at,
  p_provider,p_expected_cursor,p_resume_cursor,p_expected_source_snapshot);
create or replace function public.checkpoint_article_translation_sync_run(
  p_job_id uuid,p_expected_job_version bigint,p_expected_cursor jsonb,p_resume_cursor jsonb,p_observed_items jsonb,p_provider text
)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.checkpoint_article_sync_run(p_job_id,p_expected_job_version,p_expected_cursor,
  p_resume_cursor,p_observed_items,p_provider);

create or replace function probpera_translation_operations.article_sync_ready()
returns boolean language sql stable security definer set search_path=''
return (select auth.uid()) is not null
  and public.is_staff(array['owner','admin']::public.staff_role[])
  and public.translation_operations_ready()
  and to_regprocedure('public.begin_article_translation_sync_item(uuid,uuid,uuid,uuid,bigint,text,timestamp with time zone,timestamp with time zone,text,jsonb,jsonb,jsonb)') is not null
  and to_regprocedure('public.get_article_translation_sync_run(uuid)') is not null
  and to_regprocedure('public.checkpoint_article_translation_sync_run(uuid,bigint,jsonb,jsonb,jsonb,text)') is not null
  and to_regprocedure('public.get_article_translation_item_retry(uuid,uuid,uuid)') is not null
  and to_regprocedure('public.begin_article_translation_item_retry(uuid,uuid,uuid,bigint,integer,text,timestamp with time zone,timestamp with time zone,text)') is not null
  and to_regprocedure('public.finish_article_translation_item_retry(uuid,uuid,uuid,jsonb,jsonb)') is not null
  and to_regprocedure('public.get_article_translation_item_retry_progress(uuid,uuid,uuid)') is not null
  and to_regprocedure('public.record_article_translation_item_retry_dispatch(uuid,uuid,uuid,uuid,text,text,text)') is not null
  and to_regprocedure('public.record_article_translation_item_retry_response(uuid,uuid,uuid,jsonb)') is not null
  and to_regprocedure('public.stage_article_translation_item_retry_candidate(uuid,uuid,uuid,jsonb,jsonb)') is not null
  and to_regprocedure('public.get_article_translation_item_retry_candidate(uuid,uuid,uuid)') is not null
  and to_regprocedure('public.recover_article_translation_item_retry_candidate(uuid,uuid,uuid,text)') is not null
  and to_regprocedure('probpera_translation_operations.ordinary_candidate_intact(jsonb,jsonb,public.article_working_drafts,text)') is not null
  and exists(select 1 from pg_index where indexrelid=to_regclass('public.translation_article_active_operation_unique')
    and indisunique and indisvalid and indpred is not null)
  and (select count(*)=3 from pg_trigger where tgfoid=to_regprocedure('probpera_translation_operations.ordinary_write_guard()')
    and tgrelid=any(array['public.translation_jobs'::regclass,'public.translation_job_items'::regclass,'public.translation_job_attempts'::regclass])
    and not tgisinternal and tgenabled in ('O','A'));
create or replace function public.article_translation_sync_ready()
returns boolean language sql stable security invoker set search_path=''
return probpera_translation_operations.article_sync_ready();

-- Additive replacements retain the existing private retry contracts.
create or replace function probpera_translation_operations.get_article_item_retry(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare job public.translation_jobs%rowtype; item public.translation_job_items%rowtype;
  article public.articles%rowtype; english public.article_translations%rowtype;
  prior jsonb; reason text; active jsonb;
begin
  perform probpera_translation_operations.retry_access();
  perform probpera_translation_operations.ordinary_access(p_job_id);
  if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
    or (p_operation_id is not null and not probpera_translation_operations.retry_uuid(p_operation_id)) then
    raise exception 'invalid article item retry identity' using errcode='22023'; end if;
  select * into job from public.translation_jobs where id=p_job_id;
  select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id;
  if job.id is null or item.id is null then raise exception 'article retry item not found' using errcode='P0002'; end if;
  if job.kind<>'article' or item.entity_type<>'article' or job.source_locale<>'ru' or job.target_locale<>'en'
    or item.entity_id !~* '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$' then
    raise exception 'invalid article retry domain' using errcode='22023'; end if;
  if p_operation_id is not null then
    select staff_retry_receipt into prior from public.translation_job_attempts where staff_retry_operation_id=p_operation_id;
    if prior is not null then
      if prior ->> 'actorId' is distinct from (select auth.uid())::text then
        raise exception 'article retry actor changed' using errcode='42501'; end if;
      if prior -> 'receipt' ->> 'jobId' is distinct from p_job_id::text
        or prior -> 'receipt' ->> 'itemId' is distinct from p_item_id::text then
        raise exception 'article retry identity changed' using errcode='40001'; end if;
      return prior -> 'receipt' || jsonb_build_object('replayed',true);
    end if;
    if item.staff_retry ->> 'operationId' is distinct from p_operation_id::text then
      raise exception 'article retry operation not found' using errcode='P0002'; end if;
    if item.staff_retry ->> 'actorId' is distinct from (select auth.uid())::text then
      raise exception 'article retry actor changed' using errcode='42501'; end if;
  end if;
  if item.staff_retry is not null then
    if item.staff_retry ->> 'actorId' is distinct from (select auth.uid())::text then
      return probpera_translation_operations.retry_view(job,item,'blocked','retry_busy',null,null,null);
    end if;
    active:=item.staff_retry;
    return probpera_translation_operations.retry_view(job,item,'running',null,active,
      (active ->> 'sourceUpdatedAt')::timestamptz,(active ->> 'englishUpdatedAt')::timestamptz,false,true);
  end if;
  if job.cancel_requested_at is not null or job.status in ('cancelled','cancelling') then reason:='operation_stopped';
  elsif not probpera_translation_operations.ordinary_marker(job) and not exists(select 1 from public.admin_audit_log a where a.action='translation.sync_run.recorded'
    and a.entity_type='translation_job' and a.entity_id=job.id::text) then reason:='job_not_sync';
  elsif job.status not in ('completed','partial','failed','conflict','stale','skipped','not-configured') then reason:='job_not_finished';
  elsif item.source_hash is null then reason:='source_hash_missing';
  elsif item.status not in ('dead_letter','conflict','stale','not-configured') then reason:='item_not_failed';
  elsif item.attempt_count>=5 or item.max_attempts>5
    or (probpera_translation_operations.ordinary_marker(job) and item.attempt_count>=item.max_attempts) then reason:='attempt_limit';
  elsif exists(select 1 from public.translation_job_items other where other.job_id=job.id
    and (other.status in ('queued','leased','reviewing','retry_wait') or other.staff_retry is not null)) then reason:='retry_busy'; end if;
  select * into article from public.articles where id=item.entity_id::uuid;
  select * into english from public.article_translations where article_id=item.entity_id::uuid and locale='en';
  if reason is null then
    if article.id is null or article.deleted_at is not null or article.status<>'published' then reason:='source_unavailable';
    elsif exists(select 1 from public.article_working_drafts where article_id=article.id) then reason:='author_draft_exists';
    elsif english.id is not null and (english.deleted_at is not null
      or english.source_content_hash is null or english.content_json -> '__probperaPremiumTranslation' -> 'version' is distinct from '1'::jsonb
      or english.content_json -> '__probperaPremiumTranslation' -> 'method' is distinct from '"machine-translation"'::jsonb
      or english.content_json -> '__probperaPremiumTranslation' ->> 'sourceHash' is distinct from english.source_content_hash) then reason:='manual_english';
    else
      begin perform probpera_translation_operations.retry_ru_snapshot(article);
      exception when invalid_parameter_value then reason:='source_shape_unsupported'; end;
    end if;
  end if;
  return probpera_translation_operations.retry_view(job,item,case when reason is null then 'ready' else 'blocked' end,
    reason,null,article.updated_at,english.updated_at);
end; $$;

create or replace function probpera_translation_operations.begin_article_item_retry(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_expected_job_version bigint,
  p_expected_attempt_count integer,p_expected_source_hash text,p_expected_article_updated_at timestamptz,
  p_expected_english_updated_at timestamptz,p_provider text
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare job public.translation_jobs%rowtype; item public.translation_job_items%rowtype;
  article public.articles%rowtype; english public.article_translations%rowtype;
  actor uuid:=(select auth.uid()); intent jsonb; prior jsonb; view jsonb; active jsonb; snapshot jsonb; violated_constraint text;
begin
  perform probpera_translation_operations.retry_access();
  perform probpera_translation_operations.ordinary_access(p_job_id);
  if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
    or not probpera_translation_operations.retry_uuid(p_operation_id)
    or p_expected_job_version is null or p_expected_job_version<1 or p_expected_job_version>9223372036854775805
    or p_expected_attempt_count is null or p_expected_attempt_count not between 0 and 4
    or p_expected_source_hash is null or p_expected_source_hash !~ '^[a-f0-9]{64}$'
    or p_expected_article_updated_at is null or p_provider is null or p_provider not in ('cloudflare','openai') then
    raise exception 'invalid article retry intent' using errcode='22023'; end if;
  intent:=jsonb_build_array(p_job_id,p_item_id,p_operation_id,actor,p_expected_job_version::text,
    p_expected_attempt_count,p_expected_source_hash,p_expected_article_updated_at,p_expected_english_updated_at,p_provider);
  -- Bind the UUID globally across active items and completed attempts before
  -- admitting any provider work. This lock lasts only for the SQL request.
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,7047));
  select staff_retry_receipt into prior from public.translation_job_attempts where staff_retry_operation_id=p_operation_id;
  if prior is not null then
    if prior ->> 'actorId' is distinct from actor::text then
      raise exception 'article retry actor changed' using errcode='42501'; end if;
    if prior -> 'beginIntent' is distinct from intent then
      raise exception 'article retry intent changed' using errcode='40001'; end if;
    return prior -> 'receipt' || jsonb_build_object('replayed',true,'canExecute',false);
  end if;
  if exists(select 1 from public.translation_job_items other where other.staff_retry ->> 'operationId'=p_operation_id::text
    and (other.id<>p_item_id or other.job_id<>p_job_id)) then
    raise exception 'article retry UUID already belongs to another item' using errcode='40001'; end if;
  -- Existing worker completion locks item before job. Cancellation locks job
  -- before queued/retry_wait items; this path admits only finished failed
  -- items and excludes every worker-active item before changing state.
  select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id for update;
  select * into job from public.translation_jobs where id=p_job_id for update;
  if item.id is null or job.id is null then raise exception 'article retry item not found' using errcode='P0002'; end if;
  if item.staff_retry is not null then
    if item.staff_retry ->> 'actorId' is distinct from actor::text then
      raise exception 'article retry actor changed' using errcode='42501'; end if;
    if item.staff_retry -> 'beginIntent' is distinct from intent then
      raise exception 'article retry already active or intent changed' using errcode='40001'; end if;
    return probpera_translation_operations.retry_view(job,item,'running',null,item.staff_retry,
      (item.staff_retry ->> 'sourceUpdatedAt')::timestamptz,
      (item.staff_retry ->> 'englishUpdatedAt')::timestamptz,false,true);
  end if;
  if job.version is distinct from p_expected_job_version or item.attempt_count is distinct from p_expected_attempt_count
    or item.source_hash is distinct from p_expected_source_hash or job.provider is distinct from p_provider then
    raise exception 'article retry item or job changed' using errcode='40001'; end if;
  if probpera_translation_operations.ordinary_marker(job)
    and probpera_translation_operations.article_sync_ready() is distinct from true then
    raise exception 'ordinary article admission capability is unavailable' using errcode='42883'; end if;
  view:=probpera_translation_operations.get_article_item_retry(p_job_id,p_item_id,null);
  if view ->> 'phase'<>'ready' then
    if view ->> 'blockReason'='operation_stopped' then
      raise exception 'article retry was stopped' using errcode='42501'; end if;
    raise exception 'article retry is not eligible' using errcode='40001';
  end if;
  select * into article from public.articles where id=item.entity_id::uuid for update;
  select * into english from public.article_translations where article_id=article.id and locale='en' for update;
  if article.updated_at is distinct from p_expected_article_updated_at
    or english.updated_at is distinct from p_expected_english_updated_at then
    raise exception 'article retry source or English changed' using errcode='40001'; end if;
  if article.id is null or article.deleted_at is not null or article.status<>'published'
    or exists(select 1 from public.article_working_drafts where article_id=article.id) then
    raise exception 'article retry source or draft changed' using errcode='40001'; end if;
  if english.id is not null and (english.deleted_at is not null or english.source_content_hash is null
    or english.content_json -> '__probperaPremiumTranslation' -> 'version' is distinct from '1'::jsonb
    or english.content_json -> '__probperaPremiumTranslation' -> 'method' is distinct from '"machine-translation"'::jsonb
    or english.content_json -> '__probperaPremiumTranslation' ->> 'sourceHash' is distinct from english.source_content_hash) then
    raise exception 'article retry English ownership changed' using errcode='40001'; end if;
  snapshot:=probpera_translation_operations.retry_ru_snapshot(article);
  active:=jsonb_build_object('version',1,'operationId',p_operation_id,'actorId',actor,'articleId',article.id,
    'beginIntent',intent,'sourceUpdatedAt',p_expected_article_updated_at,'englishUpdatedAt',p_expected_english_updated_at,
    'attemptNumber',item.attempt_count+1,'startedAt',clock_timestamp(),
    'sourceSnapshotHash',probpera_translation_operations.retry_fingerprint(snapshot));
  if probpera_translation_operations.ordinary_marker(job) then
    active:=active||jsonb_build_object('progress',jsonb_build_object('version',1,'updatedAt',active -> 'startedAt','calls','[]'::jsonb));
  end if;
  update public.translation_job_items set staff_retry=active,status='reviewing',
    max_attempts=case when probpera_translation_operations.ordinary_marker(job) then max_attempts else attempt_count+1 end,lease_owner=null,lease_expires_at=null,updated_at=clock_timestamp()
    where id=item.id returning * into item;
  update public.translation_jobs set status='reviewing',failed_items=(select count(*) from public.translation_job_items
    where job_id=job.id and status='dead_letter'),completed_at=null,version=version+1,updated_at=clock_timestamp()
    where id=job.id returning * into job;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(actor,'translation.article_item_retry.began','translation_job',job.id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',item.id,'attemptNumber',item.attempt_count+1,
        'sourceHash',item.source_hash,'jobVersion',job.version::text));
  return probpera_translation_operations.retry_view(job,item,'running',null,active,
    p_expected_article_updated_at,p_expected_english_updated_at,true,false);
exception when unique_violation then
  get stacked diagnostics violated_constraint=constraint_name;
  if violated_constraint='translation_article_active_operation_unique' then
    raise exception 'article translation operation is already active' using errcode='40001';
  end if;
  raise;
end; $$;

create or replace function probpera_translation_operations.retry_journal_active(
  p_job public.translation_jobs,p_item public.translation_job_items,p_operation_id uuid
)
returns void language plpgsql stable security invoker set search_path='' as $$
declare active jsonb:=p_item.staff_retry; actor uuid:=(select auth.uid());
begin
  perform probpera_translation_operations.ordinary_access(p_job.id);
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
    or p_item.attempt_count not between 0 and 4
    or (not probpera_translation_operations.ordinary_marker(p_job) and p_item.max_attempts<>p_item.attempt_count+1)
    or (probpera_translation_operations.ordinary_marker(p_job) and p_item.max_attempts<p_item.attempt_count+1)
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

-- A canonical CAS refusal does not invalidate the already staged private
-- body. Validate that body against its ORIGINAL snapshot/metadata, without
-- comparing it to the newly authored canonical RU or English.
create or replace function probpera_translation_operations.ordinary_candidate_intact(
  p_active jsonb,p_meta jsonb,p_draft public.article_working_drafts,p_provider text
)
returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
  return probpera_translation_operations.retry_candidate_meta_valid(p_meta)
    and probpera_translation_operations.retry_journal_valid(p_active -> 'progress',p_provider)
    and jsonb_array_length(p_active -> 'progress' -> 'calls')=(p_meta -> 'outcome' ->> 'providerCalls')::integer
    and not exists(select 1 from jsonb_array_elements(p_active -> 'progress' -> 'calls') call
      where call -> 'responseReceivedAt'='null'::jsonb)
    and p_draft.article_id::text=p_active ->> 'articleId'
    and p_draft.actor_id::text=p_active ->> 'actorId'
    and p_draft.version=(p_meta ->> 'workingDraftVersion')::bigint
    and p_draft.updated_at=(p_meta ->> 'workingDraftUpdatedAt')::timestamptz
    and p_draft.base_article_updated_at=(p_active ->> 'sourceUpdatedAt')::timestamptz
    and p_draft.expected_english_updated_at is not distinct from (p_active ->> 'englishUpdatedAt')::timestamptz
    and p_draft.draft_scope='english-only' and p_draft.draft_english_enabled=true
    and probpera_translation_operations.retry_payload_valid(p_draft.payload,false)
    and probpera_translation_operations.retry_fingerprint(p_draft.payload)=p_active ->> 'sourceSnapshotHash'
    and probpera_translation_operations.retry_payload_valid(p_draft.english_payload -> 'payload',true)
    and p_draft.english_payload -> 'mode'='"save"'::jsonb
    and p_draft.english_payload-array['mode','payload']='{}'::jsonb
    and p_draft.english_payload -> 'payload' ->> 'source_content_hash'=p_active -> 'beginIntent' ->> 6
    and probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_draft.payload,p_draft.english_payload,p_meta -> 'outcome'))
      =p_meta ->> 'candidateHash'
    and probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_meta -> 'outcome',p_draft.english_payload))
      =p_meta ->> 'finishFingerprint';
exception when others then return false;
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
  perform probpera_translation_operations.ordinary_access(p_job_id);
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
      if probpera_translation_operations.ordinary_marker(job)
        and candidate_reason in ('source_changed','english_changed')
        and probpera_translation_operations.ordinary_candidate_intact(active,candidate,draft,job.provider) is true then
        outcome:=case when candidate_reason='source_changed' then 'stale' else 'conflict' end;
        code:=case when candidate_reason='source_changed' then 'source_changed' else 'write_conflict' end;
        -- Journal the known outcome, preserve both the original private body
        -- and the new canonical author content, and release this admission.
      else
        raise exception 'article retry prepared candidate changed: %',candidate_reason using errcode='40001';
      end if;
    end if;
    if job.cancel_requested_at is not null or job.status in ('cancelled','cancelling') then
      outcome:='cancelled'; code:=null;
      -- The private body was already saved at STAGE and remains available.
      -- This cancelled FINISH performs no draft write.
    elsif candidate_reason is null then
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
  if probpera_translation_operations.ordinary_marker(job) then
    job:=probpera_translation_operations.ordinary_refresh_job(job.id);
  end if;
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

-- GET remains truthful: a changed source/English has canRecover=false and its
-- original blockReason. Explicit ordinary finalization accepts only these
-- two known CAS refusals with an intact, fully acknowledged stored candidate.
create or replace function probpera_translation_operations.recover_article_item_retry_candidate(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_expected_candidate_hash text
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare view jsonb; prior jsonb; meta jsonb; item public.translation_job_items%rowtype;
  job public.translation_jobs%rowtype; draft public.article_working_drafts%rowtype;
begin
  perform probpera_translation_operations.retry_access();
  perform probpera_translation_operations.ordinary_access(p_job_id);
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
    select * into job from public.translation_jobs where id=p_job_id;
    if not probpera_translation_operations.ordinary_marker(job)
      or view ->> 'blockReason' not in ('source_changed','english_changed') then
      raise exception 'article retry candidate cannot be recovered: %',view ->> 'blockReason' using errcode='40001';
    end if;
  end if;
  select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id for update;
  select * into job from public.translation_jobs where id=p_job_id for update;
  perform probpera_translation_operations.retry_journal_active(job,item,p_operation_id);
  meta:=item.staff_retry -> 'candidate';
  select * into draft from public.article_working_drafts where article_id=item.entity_id::uuid for update;
  if view -> 'canRecover' is distinct from 'true'::jsonb
    and probpera_translation_operations.ordinary_candidate_intact(item.staff_retry,meta,draft,job.provider) is distinct from true then
    raise exception 'article retry prepared candidate changed' using errcode='40001'; end if;
  return probpera_translation_operations.finish_article_item_retry(p_job_id,p_item_id,p_operation_id,meta -> 'outcome',draft.english_payload);
end; $$;

create or replace function public.get_article_translation_item_retry(p_job_id uuid,p_item_id uuid,p_operation_id uuid default null)
returns jsonb language sql stable security invoker set search_path=''
return case when probpera_translation_operations.ordinary_access(p_job_id) then probpera_translation_operations.get_article_item_retry(p_job_id,p_item_id,p_operation_id) else null end;

create or replace function public.begin_article_translation_item_retry(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_expected_job_version bigint,p_expected_attempt_count integer,
  p_expected_source_hash text,p_expected_article_updated_at timestamptz,p_expected_english_updated_at timestamptz,p_provider text)
returns jsonb language sql volatile security invoker set search_path=''
return case when probpera_translation_operations.ordinary_access(p_job_id) then probpera_translation_operations.begin_article_item_retry(p_job_id,p_item_id,p_operation_id,p_expected_job_version,
  p_expected_attempt_count,p_expected_source_hash,p_expected_article_updated_at,p_expected_english_updated_at,p_provider) else null end;

create or replace function public.finish_article_translation_item_retry(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_outcome jsonb,p_english_payload jsonb default null)
returns jsonb language sql volatile security invoker set search_path=''
return case when probpera_translation_operations.ordinary_access(p_job_id) then probpera_translation_operations.finish_article_item_retry(p_job_id,p_item_id,p_operation_id,p_outcome,p_english_payload) else null end;

create or replace function public.record_article_translation_item_retry_dispatch(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_call_id uuid,p_provider text,p_model text,p_pass text
)
returns jsonb language sql volatile security invoker set search_path=''
return case when probpera_translation_operations.ordinary_access(p_job_id) then probpera_translation_operations.record_article_item_retry_dispatch(p_job_id,p_item_id,p_operation_id,p_call_id,p_provider,p_model,p_pass) else null end;

create or replace function public.record_article_translation_item_retry_response(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_metadata jsonb
)
returns jsonb language sql volatile security invoker set search_path=''
return case when probpera_translation_operations.ordinary_access(p_job_id) then probpera_translation_operations.record_article_item_retry_response(p_job_id,p_item_id,p_operation_id,p_metadata) else null end;

create or replace function public.get_article_translation_item_retry_progress(p_job_id uuid,p_item_id uuid,p_operation_id uuid)
returns jsonb language sql volatile security invoker set search_path=''
return case when probpera_translation_operations.ordinary_access(p_job_id) then probpera_translation_operations.get_article_item_retry_progress(p_job_id,p_item_id,p_operation_id) else null end;

create or replace function public.stage_article_translation_item_retry_candidate(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_outcome jsonb,p_english_payload jsonb
)
returns jsonb language sql volatile security invoker set search_path=''
return case when probpera_translation_operations.ordinary_access(p_job_id) then probpera_translation_operations.stage_article_item_retry_candidate(p_job_id,p_item_id,p_operation_id,p_outcome,p_english_payload) else null end;

create or replace function public.get_article_translation_item_retry_candidate(p_job_id uuid,p_item_id uuid,p_operation_id uuid)
returns jsonb language sql volatile security invoker set search_path=''
return case when probpera_translation_operations.ordinary_access(p_job_id) then probpera_translation_operations.get_article_item_retry_candidate(p_job_id,p_item_id,p_operation_id) else null end;

create or replace function public.recover_article_translation_item_retry_candidate(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_expected_candidate_hash text
)
returns jsonb language sql volatile security invoker set search_path=''
return case when probpera_translation_operations.ordinary_access(p_job_id) then probpera_translation_operations.recover_article_item_retry_candidate(p_job_id,p_item_id,p_operation_id,p_expected_candidate_hash) else null end;

revoke all on function probpera_translation_operations.ordinary_marker(public.translation_jobs) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.ordinary_candidate_intact(jsonb,jsonb,public.article_working_drafts,text) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.ordinary_access(uuid) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.ordinary_cursor_valid(jsonb) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.ordinary_run_view(public.translation_jobs,boolean) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.ordinary_refresh_job(uuid) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.ordinary_write_guard() from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.article_sync_ready() from public,anon,authenticated,service_role;
revoke all on function public.article_translation_sync_ready() from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.get_article_sync_run(uuid) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.begin_article_sync_item(uuid,uuid,uuid,uuid,bigint,text,timestamptz,timestamptz,text,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.checkpoint_article_sync_run(uuid,bigint,jsonb,jsonb,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.get_article_translation_sync_run(uuid) from public,anon,authenticated,service_role;
revoke all on function public.begin_article_translation_sync_item(uuid,uuid,uuid,uuid,bigint,text,timestamptz,timestamptz,text,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.checkpoint_article_translation_sync_run(uuid,bigint,jsonb,jsonb,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function probpera_translation_operations.ordinary_access(uuid) to authenticated;
grant execute on function probpera_translation_operations.article_sync_ready() to authenticated;
grant execute on function public.article_translation_sync_ready() to authenticated;
grant execute on function probpera_translation_operations.get_article_sync_run(uuid) to authenticated;
grant execute on function probpera_translation_operations.begin_article_sync_item(uuid,uuid,uuid,uuid,bigint,text,timestamptz,timestamptz,text,jsonb,jsonb,jsonb) to authenticated;
grant execute on function probpera_translation_operations.checkpoint_article_sync_run(uuid,bigint,jsonb,jsonb,jsonb,text) to authenticated;
grant execute on function public.get_article_translation_sync_run(uuid) to authenticated;
grant execute on function public.begin_article_translation_sync_item(uuid,uuid,uuid,uuid,bigint,text,timestamptz,timestamptz,text,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.checkpoint_article_translation_sync_run(uuid,bigint,jsonb,jsonb,jsonb,text) to authenticated;
commit;
