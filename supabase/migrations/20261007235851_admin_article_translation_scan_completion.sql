-- Finish an existing staff synchronous article scan without fabricating an
-- item or changing the result of its already recorded batch. No content,
-- worker leases, direct table privileges or existing private schema changes.
create schema if not exists probpera_translation_operations;
revoke all on schema probpera_translation_operations
  from public, anon, authenticated, service_role;

create or replace function probpera_translation_operations.complete_article_scan(
  p_job_id uuid,
  p_expected_cursor jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  uuid_pattern constant text := '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$';
  expected_scan jsonb;
  desired_cursor jsonb;
  upper_id uuid;
  after_id uuid;
  locked_job public.translation_jobs%rowtype;
begin
  if actor_id is null or not public.is_staff() then
    raise exception 'article scan completion requires staff access' using errcode = '42501';
  end if;
  if p_job_id is null or p_job_id::text !~* uuid_pattern
    or jsonb_typeof(p_expected_cursor) is distinct from 'object'
    or octet_length(p_expected_cursor::text) > 65536 then
    raise exception 'invalid article scan completion identity' using errcode = '22023';
  end if;
  expected_scan := p_expected_cursor -> 'articleScan';
  if jsonb_typeof(expected_scan) is distinct from 'object' then
    raise exception 'invalid article scan completion cursor' using errcode = '22023';
  end if;
  if not (expected_scan ?& array[
      'version', 'order', 'upperId', 'afterId', 'pendingIds',
      'nextIndex', 'lastWindow', 'exhausted'
    ]) or expected_scan - array[
      'version', 'order', 'upperId', 'afterId', 'pendingIds',
      'nextIndex', 'lastWindow', 'exhausted'
    ] <> '{}'::jsonb
    or expected_scan -> 'version' <> '1'::jsonb
    or expected_scan -> 'order' <> '"id"'::jsonb
    or expected_scan -> 'pendingIds' <> '[]'::jsonb
    or expected_scan -> 'nextIndex' <> '0'::jsonb
    or expected_scan -> 'lastWindow' <> 'false'::jsonb
    or expected_scan -> 'exhausted' <> 'false'::jsonb
    or jsonb_typeof(expected_scan -> 'upperId') <> 'string'
    or jsonb_typeof(expected_scan -> 'afterId') <> 'string'
    or (expected_scan ->> 'upperId') !~* uuid_pattern
    or (expected_scan ->> 'afterId') !~* uuid_pattern then
    raise exception 'invalid article scan completion boundary' using errcode = '22023';
  end if;
  upper_id := (expected_scan ->> 'upperId')::uuid;
  after_id := (expected_scan ->> 'afterId')::uuid;
  if after_id > upper_id then
    raise exception 'invalid article scan completion order' using errcode = '22023';
  end if;

  select * into locked_job from public.translation_jobs
    where id = p_job_id for update;
  if not found then
    raise exception 'article scan job not found' using errcode = 'P0002';
  end if;
  if locked_job.kind <> 'article' then
    raise exception 'invalid article scan job kind' using errcode = '22023';
  end if;
  if locked_job.status not in (
    'completed', 'partial', 'failed', 'conflict', 'stale', 'skipped', 'not-configured'
  ) then
    raise exception 'article scan job cannot continue' using errcode = '42501';
  end if;
  desired_cursor := jsonb_set(
    jsonb_set(p_expected_cursor, '{articleScan,lastWindow}', 'true'::jsonb, false),
    '{articleScan,exhausted}', 'true'::jsonb, false
  );
  -- A replay of the same accepted intent has no second audit or version bump.
  if locked_job.resume_cursor = desired_cursor then
    return jsonb_build_object('id', locked_job.id, 'kind', locked_job.kind,
      'status', locked_job.status, 'resumeCursor', locked_job.resume_cursor);
  end if;
  if locked_job.resume_cursor is distinct from p_expected_cursor then
    raise exception 'article scan cursor changed' using errcode = '40001';
  end if;
  -- Recheck in the database after the empty client-side selection. This is
  -- completion at this read snapshot, not immutable membership of the archive.
  if exists (
    select 1 from public.articles article
    where article.status = 'published' and article.deleted_at is null
      and article.id > after_id and article.id <= upper_id
  ) then
    raise exception 'article scan still has candidates' using errcode = '40001';
  end if;
  update public.translation_jobs
    set resume_cursor = desired_cursor, version = version + 1,
      updated_at = clock_timestamp()
    where id = locked_job.id
    returning * into locked_job;
  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, metadata)
    values (actor_id, 'translation.article_scan.completed', 'translation_job',
      locked_job.id::text, jsonb_build_object('upperId', upper_id,
        'afterId', after_id, 'jobVersion', locked_job.version::text));
  return jsonb_build_object('id', locked_job.id, 'kind', locked_job.kind,
    'status', locked_job.status, 'resumeCursor', locked_job.resume_cursor);
end;
$$;

revoke all on function probpera_translation_operations.complete_article_scan(uuid,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function probpera_translation_operations.complete_article_scan(uuid,jsonb)
  to authenticated;

-- The SQL-standard body binds the helper at definition time. The invoker
-- needs only its EXECUTE grant, never USAGE on the private namespace.
create or replace function public.complete_article_translation_scan(
  p_job_id uuid,
  p_expected_cursor jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
return probpera_translation_operations.complete_article_scan(p_job_id, p_expected_cursor);

revoke all on function public.complete_article_translation_scan(uuid,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_article_translation_scan(uuid,jsonb)
  to authenticated;
