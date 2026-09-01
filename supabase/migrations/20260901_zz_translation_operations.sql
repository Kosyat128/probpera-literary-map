-- Durable, private Translation Operations control plane.
-- Source prose and provider payloads are deliberately not persisted here:
-- jobs contain stable entity references and hashes, attempts contain only
-- allow-listed error codes and bounded operational metadata.

create table if not exists public.translation_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (
    kind in ('article', 'literary_work', 'writer', 'country', 'site_copy')
  ),
  source_locale text not null default 'ru' check (source_locale = 'ru'),
  target_locale text not null default 'en' check (target_locale = 'en'),
  provider text not null check (provider in ('cloudflare', 'openai')),
  status text not null default 'queued' check (
    status in ('queued', 'running', 'cancelling', 'completed', 'partial', 'failed', 'cancelled')
  ),
  total_items integer not null default 0 check (total_items between 0 and 500),
  succeeded_items integer not null default 0 check (succeeded_items between 0 and total_items),
  failed_items integer not null default 0 check (failed_items between 0 and total_items),
  requested_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  cancel_requested_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (succeeded_items + failed_items <= total_items)
);

create table if not exists public.translation_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.translation_jobs(id) on delete cascade,
  position integer not null check (position between 0 and 499),
  entity_type text not null check (
    entity_type in ('article', 'literary_work', 'writer', 'country', 'site_copy')
  ),
  entity_id text not null check (
    char_length(btrim(entity_id)) between 1 and 1_200
    and entity_id !~ '[[:cntrl:]]'
  ),
  source_hash text check (source_hash is null or source_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'queued' check (
    status in ('queued', 'leased', 'retry_wait', 'succeeded', 'dead_letter', 'cancelled')
  ),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  next_attempt_at timestamptz not null default now(),
  lease_owner text check (
    lease_owner is null or (
      char_length(btrim(lease_owner)) between 1 and 120
      and lease_owner !~ '[[:cntrl:]]'
    )
  ),
  lease_expires_at timestamptz,
  last_error_code text check (
    last_error_code is null or last_error_code in (
      'provider_unavailable',
      'provider_request_failed',
      'provider_invalid_response',
      'source_changed',
      'write_conflict',
      'database_read_failed',
      'database_write_failed',
      'unexpected'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, position),
  unique (job_id, entity_type, entity_id),
  check (
    (status = 'leased' and lease_owner is not null and lease_expires_at is not null)
    or (status <> 'leased' and lease_owner is null and lease_expires_at is null)
  )
);

create table if not exists public.translation_job_attempts (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.translation_job_items(id) on delete cascade,
  attempt_number integer not null check (attempt_number between 1 and 10),
  outcome text not null check (outcome in ('succeeded', 'retry', 'dead_letter')),
  provider text not null check (provider in ('cloudflare', 'openai')),
  model text check (model is null or char_length(model) between 1 and 200),
  provider_request_id text check (
    provider_request_id is null or char_length(provider_request_id) between 1 and 200
  ),
  error_code text check (
    error_code is null or error_code in (
      'provider_unavailable',
      'provider_request_failed',
      'provider_invalid_response',
      'source_changed',
      'write_conflict',
      'database_read_failed',
      'database_write_failed',
      'unexpected'
    )
  ),
  input_tokens integer check (input_tokens is null or input_tokens between 0 and 10000000),
  output_tokens integer check (output_tokens is null or output_tokens between 0 and 10000000),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 3600000),
  created_at timestamptz not null default now(),
  unique (item_id, attempt_number),
  check (
    (outcome = 'succeeded' and error_code is null)
    or (outcome <> 'succeeded' and error_code is not null)
  )
);

create index if not exists translation_job_items_claim_idx
  on public.translation_job_items(status, next_attempt_at, lease_expires_at, job_id, position);
create index if not exists translation_jobs_status_idx
  on public.translation_jobs(status, created_at desc);
create index if not exists translation_job_attempts_item_idx
  on public.translation_job_attempts(item_id, attempt_number desc);

alter table public.translation_jobs enable row level security;
alter table public.translation_jobs force row level security;
alter table public.translation_job_items enable row level security;
alter table public.translation_job_items force row level security;
alter table public.translation_job_attempts enable row level security;
alter table public.translation_job_attempts force row level security;

drop policy if exists "Staff read translation jobs" on public.translation_jobs;
create policy "Staff read translation jobs"
on public.translation_jobs for select to authenticated
using (public.is_staff());

drop policy if exists "Staff read translation job items" on public.translation_job_items;
create policy "Staff read translation job items"
on public.translation_job_items for select to authenticated
using (public.is_staff());

drop policy if exists "Staff read translation job attempts" on public.translation_job_attempts;
create policy "Staff read translation job attempts"
on public.translation_job_attempts for select to authenticated
using (public.is_staff());

revoke all on table public.translation_jobs from public, anon, authenticated;
revoke all on table public.translation_job_items from public, anon, authenticated;
revoke all on table public.translation_job_attempts from public, anon, authenticated;
grant select on table public.translation_jobs to authenticated;
grant select on table public.translation_job_items to authenticated;
grant select on table public.translation_job_attempts to authenticated;
grant all on table public.translation_jobs to service_role;
grant all on table public.translation_job_items to service_role;
grant all on table public.translation_job_attempts to service_role;
grant usage, select on sequence public.translation_job_attempts_id_seq to service_role;

create or replace function public.create_translation_job(
  p_kind text,
  p_provider text,
  p_items jsonb,
  p_max_attempts integer default 3
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  created_job_id uuid;
  item_count integer;
begin
  if actor_id is null or not public.is_staff() then
    raise exception 'translation job requires staff access' using errcode = '42501';
  end if;
  if p_kind not in ('article', 'literary_work', 'writer', 'country', 'site_copy') then
    raise exception 'invalid translation job kind' using errcode = '22023';
  end if;
  if p_provider not in ('cloudflare', 'openai') then
    raise exception 'invalid translation provider' using errcode = '22023';
  end if;
  if p_max_attempts not between 1 and 5 then
    raise exception 'invalid translation attempt limit' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'translation items must be an array' using errcode = '22023';
  end if;

  item_count := jsonb_array_length(p_items);
  if item_count < 1 or item_count > 500 then
    raise exception 'translation job item count is out of range' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) with ordinality as item(value, position)
    where jsonb_typeof(item.value) <> 'object'
      or coalesce(item.value->>'entityType', '') <> p_kind
      or char_length(btrim(coalesce(item.value->>'entityId', ''))) not between 1 and 1200
      or coalesce(item.value->>'entityId', '') ~ '[[:cntrl:]]'
      or (
        item.value ? 'sourceHash'
        and coalesce(item.value->>'sourceHash', '') !~ '^[a-f0-9]{64}$'
      )
  ) then
    raise exception 'invalid translation job item' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    group by item.value->>'entityType', item.value->>'entityId'
    having count(*) > 1
  ) then
    raise exception 'duplicate translation job item' using errcode = '23505';
  end if;

  insert into public.translation_jobs (
    kind, provider, total_items, requested_by
  ) values (
    p_kind, p_provider, item_count, actor_id
  ) returning id into created_job_id;

  insert into public.translation_job_items (
    job_id, position, entity_type, entity_id, source_hash, max_attempts
  )
  select
    created_job_id,
    (item.position - 1)::integer,
    item.value->>'entityType',
    btrim(item.value->>'entityId'),
    nullif(item.value->>'sourceHash', ''),
    p_max_attempts
  from jsonb_array_elements(p_items) with ordinality as item(value, position);

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'translation.job.created',
    'translation_job',
    created_job_id::text,
    jsonb_build_object(
      'kind', p_kind,
      'provider', p_provider,
      'itemCount', item_count,
      'maxAttempts', p_max_attempts
    )
  );

  return created_job_id;
end;
$$;

create or replace function public.request_translation_job_cancel(
  p_job_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_job public.translation_jobs%rowtype;
  next_status text;
begin
  if actor_id is null or not public.is_staff() then
    raise exception 'translation job cancellation requires staff access'
      using errcode = '42501';
  end if;

  select job.* into current_job
  from public.translation_jobs job
  where job.id = p_job_id
  for update;
  if not found then
    raise exception 'translation job not found' using errcode = 'P0002';
  end if;
  if current_job.version <> p_expected_version then
    raise exception 'translation job version conflict' using errcode = '40001';
  end if;
  if current_job.status in ('completed', 'partial', 'failed', 'cancelled') then
    return jsonb_build_object(
      'id', current_job.id,
      'status', current_job.status,
      'version', current_job.version
    );
  end if;

  update public.translation_job_items
  set status = 'cancelled',
      lease_owner = null,
      lease_expires_at = null,
      updated_at = now()
  where job_id = current_job.id
    and status in ('queued', 'retry_wait');

  next_status := case
    when exists (
      select 1 from public.translation_job_items item
      where item.job_id = current_job.id and item.status = 'leased'
    ) then 'cancelling'
    else 'cancelled'
  end;

  update public.translation_jobs
  set status = next_status,
      cancel_requested_at = coalesce(cancel_requested_at, now()),
      completed_at = case when next_status = 'cancelled' then now() else null end,
      version = version + 1,
      updated_at = now()
  where id = current_job.id
  returning * into current_job;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'translation.job.cancel_requested',
    'translation_job',
    current_job.id::text,
    jsonb_build_object('status', current_job.status, 'version', current_job.version)
  );

  return jsonb_build_object(
    'id', current_job.id,
    'status', current_job.status,
    'version', current_job.version
  );
end;
$$;

create or replace function public.claim_translation_job_items(
  p_worker_id text,
  p_limit integer default 10,
  p_lease_seconds integer default 300
)
returns table (
  item_id uuid,
  job_id uuid,
  kind text,
  provider text,
  entity_type text,
  entity_id text,
  source_hash text,
  attempt_number integer,
  lease_expires_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select item.id
    from public.translation_job_items item
    join public.translation_jobs job on job.id = item.job_id
    where job.status in ('queued', 'running')
      and job.cancel_requested_at is null
      and (
        (item.status in ('queued', 'retry_wait') and item.next_attempt_at <= now())
        or (item.status = 'leased' and item.lease_expires_at <= now())
      )
    order by job.created_at, item.position
    for update of item skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ), claimed as (
    update public.translation_job_items item
    set status = 'leased',
        lease_owner = btrim(p_worker_id),
        lease_expires_at = now() + make_interval(
          secs => greatest(30, least(coalesce(p_lease_seconds, 300), 900))
        ),
        updated_at = now()
    from candidates
    where item.id = candidates.id
      and char_length(btrim(coalesce(p_worker_id, ''))) between 1 and 120
      and coalesce(p_worker_id, '') !~ '[[:cntrl:]]'
    returning item.*
  ), started_jobs as (
    update public.translation_jobs job
    set status = 'running',
        started_at = coalesce(job.started_at, now()),
        version = job.version + 1,
        updated_at = now()
    where job.id in (select distinct claimed.job_id from claimed)
      and job.status = 'queued'
    returning job.id
  )
  select
    claimed.id,
    claimed.job_id,
    job.kind,
    job.provider,
    claimed.entity_type,
    claimed.entity_id,
    claimed.source_hash,
    claimed.attempt_count + 1,
    claimed.lease_expires_at
  from claimed
  join public.translation_jobs job on job.id = claimed.job_id;
$$;

create or replace function public.complete_translation_job_item(
  p_item_id uuid,
  p_worker_id text,
  p_succeeded boolean,
  p_error_code text default null,
  p_model text default null,
  p_provider_request_id text default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_duration_ms integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_item public.translation_job_items%rowtype;
  current_job public.translation_jobs%rowtype;
  new_attempt integer;
  next_item_status text;
  attempt_outcome text;
  succeeded_count integer;
  failed_count integer;
  active_count integer;
  cancelled_count integer;
  next_job_status text;
begin
  select item.* into current_item
  from public.translation_job_items item
  where item.id = p_item_id
  for update;
  if not found then
    raise exception 'translation job item not found' using errcode = 'P0002';
  end if;
  if current_item.status <> 'leased'
    or current_item.lease_owner <> btrim(coalesce(p_worker_id, ''))
    or current_item.lease_expires_at <= now() then
    raise exception 'translation job lease is not valid' using errcode = '42501';
  end if;

  select job.* into current_job
  from public.translation_jobs job
  where job.id = current_item.job_id
  for update;

  new_attempt := current_item.attempt_count + 1;
  if p_succeeded then
    if p_error_code is not null then
      raise exception 'successful translation attempt cannot have an error code'
        using errcode = '22023';
    end if;
    next_item_status := 'succeeded';
    attempt_outcome := 'succeeded';
  else
    if p_error_code not in (
      'provider_unavailable', 'provider_request_failed',
      'provider_invalid_response', 'source_changed', 'write_conflict',
      'database_read_failed', 'database_write_failed', 'unexpected'
    ) then
      raise exception 'invalid translation error code' using errcode = '22023';
    end if;
    if new_attempt >= current_item.max_attempts then
      next_item_status := 'dead_letter';
      attempt_outcome := 'dead_letter';
    else
      next_item_status := 'retry_wait';
      attempt_outcome := 'retry';
    end if;
  end if;

  insert into public.translation_job_attempts (
    item_id, attempt_number, outcome, provider, model,
    provider_request_id, error_code, input_tokens, output_tokens, duration_ms
  ) values (
    current_item.id,
    new_attempt,
    attempt_outcome,
    current_job.provider,
    nullif(btrim(coalesce(p_model, '')), ''),
    nullif(btrim(coalesce(p_provider_request_id, '')), ''),
    p_error_code,
    p_input_tokens,
    p_output_tokens,
    p_duration_ms
  );

  update public.translation_job_items
  set status = next_item_status,
      attempt_count = new_attempt,
      next_attempt_at = case
        when next_item_status = 'retry_wait'
          then now() + make_interval(secs => least(900, 30 * (2 ^ (new_attempt - 1))::integer))
        else next_attempt_at
      end,
      lease_owner = null,
      lease_expires_at = null,
      last_error_code = p_error_code,
      updated_at = now()
  where id = current_item.id;

  if current_job.cancel_requested_at is not null then
    update public.translation_job_items
    set status = 'cancelled', updated_at = now()
    where job_id = current_job.id and status in ('queued', 'retry_wait');
  end if;

  select
    count(*) filter (where status = 'succeeded'),
    count(*) filter (where status = 'dead_letter'),
    count(*) filter (where status in ('queued', 'leased', 'retry_wait')),
    count(*) filter (where status = 'cancelled')
  into succeeded_count, failed_count, active_count, cancelled_count
  from public.translation_job_items
  where job_id = current_job.id;

  next_job_status := case
    when active_count > 0 and current_job.cancel_requested_at is not null then 'cancelling'
    when active_count > 0 then 'running'
    when current_job.cancel_requested_at is not null then 'cancelled'
    when succeeded_count = current_job.total_items then 'completed'
    when succeeded_count > 0 then 'partial'
    else 'failed'
  end;

  update public.translation_jobs
  set status = next_job_status,
      succeeded_items = succeeded_count,
      failed_items = failed_count,
      completed_at = case
        when next_job_status in ('completed', 'partial', 'failed', 'cancelled') then now()
        else null
      end,
      version = version + 1,
      updated_at = now()
  where id = current_job.id
  returning * into current_job;

  return jsonb_build_object(
    'jobId', current_job.id,
    'jobStatus', current_job.status,
    'itemId', current_item.id,
    'itemStatus', next_item_status,
    'attemptNumber', new_attempt
  );
end;
$$;

create or replace function public.translation_operations_ready()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.is_staff()
    and to_regclass('public.translation_jobs') is not null
    and to_regclass('public.translation_job_items') is not null
    and to_regclass('public.translation_job_attempts') is not null
    and to_regprocedure('public.create_translation_job(text,text,jsonb,integer)') is not null
    and to_regprocedure('public.claim_translation_job_items(text,integer,integer)') is not null
    and to_regprocedure(
      'public.complete_translation_job_item(uuid,text,boolean,text,text,text,integer,integer,integer)'
    ) is not null;
$$;

create or replace function public.get_translation_operations_status()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with totals as (
    select
      count(*) filter (where job.status = 'queued') as queued,
      count(*) filter (where job.status in ('running', 'cancelling')) as running,
      count(*) filter (where job.status = 'completed') as completed,
      count(*) filter (where job.status in ('partial', 'failed')) as attention
    from public.translation_jobs job
  ), recent as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', job.id,
      'kind', job.kind,
      'status', job.status,
      'totalItems', job.total_items,
      'succeededItems', job.succeeded_items,
      'failedItems', job.failed_items,
      'createdAt', job.created_at,
      'updatedAt', job.updated_at
    ) order by job.created_at desc), '[]'::jsonb) as items
    from (
      select * from public.translation_jobs order by created_at desc limit 12
    ) job
  )
  select case when public.is_staff() then jsonb_build_object(
    'queued', totals.queued,
    'running', totals.running,
    'completed', totals.completed,
    'attention', totals.attention,
    'deadLetterItems', (
      select count(*) from public.translation_job_items item
      where item.status = 'dead_letter'
    ),
    'recent', recent.items
  ) else null end
  from totals cross join recent;
$$;

revoke all on function public.create_translation_job(text,text,jsonb,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.request_translation_job_cancel(uuid,bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_translation_job_items(text,integer,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_translation_job_item(
  uuid,text,boolean,text,text,text,integer,integer,integer
) from public, anon, authenticated, service_role;
revoke all on function public.translation_operations_ready()
  from public, anon, authenticated, service_role;
revoke all on function public.get_translation_operations_status()
  from public, anon, authenticated, service_role;

grant execute on function public.create_translation_job(text,text,jsonb,integer)
  to authenticated;
grant execute on function public.request_translation_job_cancel(uuid,bigint)
  to authenticated;
grant execute on function public.translation_operations_ready()
  to authenticated;
grant execute on function public.get_translation_operations_status()
  to authenticated;
grant execute on function public.claim_translation_job_items(text,integer,integer)
  to service_role;
grant execute on function public.complete_translation_job_item(
  uuid,text,boolean,text,text,text,integer,integer,integer
) to service_role;
