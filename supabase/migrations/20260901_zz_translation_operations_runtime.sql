-- Forward-only runtime closure for Translation Operations.
-- It persists real provider probes, rate-limits them before the provider call,
-- records bounded synchronous batches for durable resume, and fail-closes the
-- unused service-role lease API until a dedicated worker is deployed.

alter table public.translation_jobs
  drop constraint if exists translation_jobs_status_check;
alter table public.translation_jobs
  add constraint translation_jobs_status_check check (
    status in (
      'queued', 'running', 'reviewing', 'cancelling', 'completed', 'partial',
      'failed', 'conflict', 'stale', 'skipped', 'not-configured', 'cancelled'
    )
  );

alter table public.translation_jobs
  add column if not exists resume_cursor jsonb not null default '{}'::jsonb
  check (jsonb_typeof(resume_cursor) = 'object');

alter table public.translation_job_items
  drop constraint if exists translation_job_items_status_check;
alter table public.translation_job_items
  add constraint translation_job_items_status_check check (
    status in (
      'queued', 'leased', 'reviewing', 'retry_wait', 'succeeded', 'conflict',
      'stale', 'skipped', 'not-configured', 'dead_letter', 'cancelled'
    )
  );

alter table public.translation_job_items
  drop constraint if exists translation_job_items_last_error_code_check;
alter table public.translation_job_items
  add constraint translation_job_items_last_error_code_check check (
    last_error_code is null or last_error_code in (
      'translation_not_configured', 'provider_unavailable',
      'provider_request_failed', 'provider_invalid_response', 'source_changed',
      'write_conflict', 'database_read_failed', 'database_write_failed', 'unexpected'
    )
  );

alter table public.translation_job_attempts
  drop constraint if exists translation_job_attempts_outcome_check;
alter table public.translation_job_attempts
  add constraint translation_job_attempts_outcome_check check (
    outcome in (
      'succeeded', 'retry', 'dead_letter', 'conflict', 'stale',
      'skipped', 'not-configured'
    )
  );
alter table public.translation_job_attempts
  drop constraint if exists translation_job_attempts_error_code_check;
alter table public.translation_job_attempts
  add constraint translation_job_attempts_error_code_check check (
    error_code is null or error_code in (
      'translation_not_configured', 'provider_unavailable',
      'provider_request_failed', 'provider_invalid_response', 'source_changed',
      'write_conflict', 'database_read_failed', 'database_write_failed', 'unexpected'
    )
  );
alter table public.translation_job_attempts
  drop constraint if exists translation_job_attempts_check;
alter table public.translation_job_attempts
  drop constraint if exists translation_job_attempts_error_boundary_check;
alter table public.translation_job_attempts
  add constraint translation_job_attempts_error_boundary_check check (
    (outcome in ('succeeded', 'skipped') and error_code is null)
    or (outcome not in ('succeeded', 'skipped') and error_code is not null)
  );

create table if not exists public.translation_provider_self_tests (
  provider text primary key check (provider in ('cloudflare', 'openai')),
  configured boolean not null default false,
  binding_found boolean not null default false,
  test_passed boolean,
  model text check (model is null or char_length(model) between 1 and 200),
  latency_ms integer check (latency_ms is null or latency_ms between 0 and 3600000),
  last_error_code text check (
    last_error_code is null or last_error_code in (
      'translation_not_configured', 'provider_unavailable',
      'provider_request_failed', 'provider_invalid_response', 'unexpected'
    )
  ),
  last_test_at timestamptz,
  cooldown_until timestamptz,
  test_in_progress boolean not null default false,
  lease_token uuid,
  lease_expires_at timestamptz,
  tested_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (
    (test_in_progress and lease_token is not null and lease_expires_at is not null)
    or (not test_in_progress and lease_token is null and lease_expires_at is null)
  ),
  check (
    (test_passed is true and last_error_code is null)
    or test_passed is distinct from true
  )
);

alter table public.translation_provider_self_tests enable row level security;
alter table public.translation_provider_self_tests force row level security;
drop policy if exists "Staff read translation provider self tests"
  on public.translation_provider_self_tests;
create policy "Staff read translation provider self tests"
on public.translation_provider_self_tests for select to authenticated
using (public.is_staff());
revoke all on table public.translation_provider_self_tests
  from public, anon, authenticated;
grant select on table public.translation_provider_self_tests to authenticated;
grant all on table public.translation_provider_self_tests to service_role;

create or replace function public.begin_translation_provider_self_test(
  p_provider text,
  p_configured boolean,
  p_binding_found boolean,
  p_model text,
  p_cooldown_seconds integer default 300
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_probe public.translation_provider_self_tests%rowtype;
  token uuid := gen_random_uuid();
  cooldown integer := greatest(60, least(coalesce(p_cooldown_seconds, 300), 1800));
begin
  if actor_id is null or not public.is_staff() then
    raise exception 'translation self-test requires staff access' using errcode = '42501';
  end if;
  if p_provider not in ('cloudflare', 'openai') then
    raise exception 'invalid translation provider' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_model, ''))) not between 1 and 200 then
    raise exception 'invalid translation model' using errcode = '22023';
  end if;

  insert into public.translation_provider_self_tests (
    provider, configured, binding_found, model, tested_by
  ) values (
    p_provider, p_configured, p_binding_found, btrim(p_model), actor_id
  ) on conflict (provider) do nothing;

  select probe.* into current_probe
  from public.translation_provider_self_tests probe
  where probe.provider = p_provider
  for update;

  if current_probe.cooldown_until is not null and current_probe.cooldown_until > now() then
    raise exception 'translation self-test cooldown is active' using errcode = '55000';
  end if;
  if current_probe.test_in_progress
    and current_probe.lease_expires_at is not null
    and current_probe.lease_expires_at > now() then
    raise exception 'translation self-test is already running' using errcode = '55000';
  end if;

  update public.translation_provider_self_tests
  set configured = p_configured,
      binding_found = p_binding_found,
      model = btrim(p_model),
      test_in_progress = true,
      lease_token = token,
      lease_expires_at = now() + interval '5 minutes',
      cooldown_until = now() + make_interval(secs => cooldown),
      tested_by = actor_id,
      updated_at = now()
  where provider = p_provider;

  return token;
end;
$$;

create or replace function public.finish_translation_provider_self_test(
  p_provider text,
  p_lease_token uuid,
  p_configured boolean,
  p_binding_found boolean,
  p_test_passed boolean,
  p_model text,
  p_latency_ms integer,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  saved public.translation_provider_self_tests%rowtype;
begin
  if actor_id is null or not public.is_staff() then
    raise exception 'translation self-test completion requires staff access'
      using errcode = '42501';
  end if;
  if p_test_passed and p_error_code is not null then
    raise exception 'successful translation self-test cannot have an error code'
      using errcode = '22023';
  end if;
  if not p_test_passed and p_error_code not in (
    'translation_not_configured', 'provider_unavailable',
    'provider_request_failed', 'provider_invalid_response', 'unexpected'
  ) then
    raise exception 'invalid translation self-test error code' using errcode = '22023';
  end if;
  if p_latency_ms not between 0 and 3600000 then
    raise exception 'invalid translation self-test latency' using errcode = '22023';
  end if;

  update public.translation_provider_self_tests
  set configured = p_configured,
      binding_found = p_binding_found,
      test_passed = p_test_passed,
      model = nullif(btrim(coalesce(p_model, '')), ''),
      latency_ms = p_latency_ms,
      last_error_code = p_error_code,
      last_test_at = now(),
      test_in_progress = false,
      lease_token = null,
      lease_expires_at = null,
      tested_by = actor_id,
      updated_at = now()
  where provider = p_provider
    and lease_token = p_lease_token
    and test_in_progress
    and lease_expires_at > now()
  returning * into saved;
  if not found then
    raise exception 'translation self-test lease is not valid' using errcode = '42501';
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'translation.provider.self_tested',
    'translation_provider',
    p_provider,
    jsonb_build_object(
      'configured', saved.configured,
      'bindingFound', saved.binding_found,
      'testPassed', saved.test_passed,
      'model', saved.model,
      'latencyMs', saved.latency_ms,
      'errorCode', saved.last_error_code
    )
  );

  return jsonb_build_object(
    'provider', saved.provider,
    'configured', saved.configured,
    'bindingFound', saved.binding_found,
    'testPassed', saved.test_passed,
    'lastTestAt', saved.last_test_at,
    'lastErrorCode', saved.last_error_code,
    'latencyMs', saved.latency_ms
  );
end;
$$;

create or replace function public.record_translation_sync_run(
  p_kind text,
  p_provider text,
  p_items jsonb,
  p_outcomes jsonb,
  p_resume_cursor jsonb default '{}'::jsonb
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
  succeeded_count integer;
  failed_count integer;
  derived_status text;
begin
  if actor_id is null or not public.is_staff() then
    raise exception 'translation run recording requires staff access' using errcode = '42501';
  end if;
  if p_kind not in ('article', 'literary_work', 'writer', 'country', 'site_copy')
    or p_provider not in ('cloudflare', 'openai') then
    raise exception 'invalid translation run identity' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array'
    or jsonb_typeof(p_outcomes) <> 'array'
    or jsonb_typeof(p_resume_cursor) <> 'object' then
    raise exception 'invalid translation run payload' using errcode = '22023';
  end if;
  item_count := jsonb_array_length(p_items);
  if item_count < 1 or item_count > 500 or jsonb_array_length(p_outcomes) <> item_count then
    raise exception 'invalid translation run item count' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) item(value)
    where jsonb_typeof(item.value) <> 'object'
      or coalesce(item.value->>'entityType', '') <> p_kind
      or char_length(btrim(coalesce(item.value->>'entityId', ''))) not between 1 and 1200
      or coalesce(item.value->>'entityId', '') ~ '[[:cntrl:]]'
      or (
        item.value ? 'sourceHash'
        and coalesce(item.value->>'sourceHash', '') !~ '^[a-f0-9]{64}$'
      )
  ) then
    raise exception 'invalid translation run item' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) item(value)
    group by item.value->>'entityType', item.value->>'entityId'
    having count(*) > 1
  ) then
    raise exception 'duplicate translation run item' using errcode = '23505';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_outcomes) outcome(value)
    where coalesce(outcome.value->>'status', '') not in (
      'succeeded', 'conflict', 'stale', 'skipped', 'not-configured', 'dead_letter'
    )
      or (
        coalesce(outcome.value->>'status', '') in ('succeeded', 'skipped')
        and outcome.value ? 'errorCode'
        and nullif(outcome.value->>'errorCode', '') is not null
      )
  ) then
    raise exception 'invalid translation run outcome' using errcode = '22023';
  end if;

  select
    count(*) filter (where value->>'status' = 'succeeded'),
    count(*) filter (where value->>'status' = 'dead_letter')
  into succeeded_count, failed_count
  from jsonb_array_elements(p_outcomes) outcome(value);

  select case
    when exists (select 1 from jsonb_array_elements(p_outcomes) o(value) where value->>'status' = 'dead_letter')
      then case when succeeded_count > 0 then 'partial' else 'failed' end
    when exists (select 1 from jsonb_array_elements(p_outcomes) o(value) where value->>'status' = 'conflict') then 'conflict'
    when exists (select 1 from jsonb_array_elements(p_outcomes) o(value) where value->>'status' = 'stale') then 'stale'
    when exists (select 1 from jsonb_array_elements(p_outcomes) o(value) where value->>'status' = 'not-configured') then 'not-configured'
    when succeeded_count = 0 then 'skipped'
    else 'completed'
  end into derived_status;

  insert into public.translation_jobs (
    kind, provider, status, total_items, succeeded_items, failed_items,
    requested_by, started_at, completed_at, resume_cursor
  ) values (
    p_kind, p_provider, derived_status, item_count, succeeded_count, failed_count,
    actor_id, now(), now(), p_resume_cursor
  ) returning id into created_job_id;

  insert into public.translation_job_items (
    job_id, position, entity_type, entity_id, source_hash, status,
    attempt_count, max_attempts, last_error_code
  )
  select
    created_job_id,
    (item.position - 1)::integer,
    item.value->>'entityType',
    btrim(item.value->>'entityId'),
    nullif(item.value->>'sourceHash', ''),
    outcome.value->>'status',
    1,
    1,
    nullif(outcome.value->>'errorCode', '')
  from jsonb_array_elements(p_items) with ordinality item(value, position)
  join jsonb_array_elements(p_outcomes) with ordinality outcome(value, position)
    using (position);

  insert into public.translation_job_attempts (
    item_id, attempt_number, outcome, provider, model,
    provider_request_id, error_code, input_tokens, output_tokens, duration_ms
  )
  select
    item.id,
    1,
    outcome.value->>'status',
    p_provider,
    nullif(outcome.value->>'model', ''),
    nullif(outcome.value->>'requestId', ''),
    nullif(outcome.value->>'errorCode', ''),
    nullif(outcome.value->>'inputTokens', '')::integer,
    nullif(outcome.value->>'outputTokens', '')::integer,
    nullif(outcome.value->>'durationMs', '')::integer
  from public.translation_job_items item
  join jsonb_array_elements(p_outcomes) with ordinality outcome(value, position)
    on item.position = outcome.position - 1
  where item.job_id = created_job_id;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'translation.sync_run.recorded',
    'translation_job',
    created_job_id::text,
    jsonb_build_object(
      'kind', p_kind,
      'status', derived_status,
      'itemCount', item_count,
      'resumeCursor', p_resume_cursor
    )
  );

  return created_job_id;
end;
$$;

create or replace function public.get_translation_job_resume(p_job_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when public.is_staff() then jsonb_build_object(
    'id', job.id,
    'kind', job.kind,
    'resumeCursor', job.resume_cursor,
    'status', job.status
  ) else null end
  from public.translation_jobs job
  where job.id = p_job_id;
$$;

-- The bounded staff runner below is the active resume path. The base lease
-- worker remains service-role-only so a scheduled worker can use the same
-- durable rows without widening browser or authenticated-user privileges.
revoke all on function public.claim_translation_job_items(text,integer,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_translation_job_item(
  uuid,text,boolean,text,text,text,integer,integer,integer
) from public, anon, authenticated, service_role;
grant execute on function public.claim_translation_job_items(text,integer,integer)
  to service_role;
grant execute on function public.complete_translation_job_item(
  uuid,text,boolean,text,text,text,integer,integer,integer
) to service_role;

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
      count(*) filter (where job.status in ('running', 'reviewing', 'cancelling')) as running,
      count(*) filter (where job.status = 'completed') as completed,
      count(*) filter (
        where job.status in (
          'partial', 'failed', 'conflict', 'stale', 'not-configured'
        )
      ) as attention
    from public.translation_jobs job
  ), recent as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', job.id,
      'kind', job.kind,
      'status', job.status,
      'totalItems', job.total_items,
      'succeededItems', job.succeeded_items,
      'failedItems', job.failed_items,
      'resumeCursor', job.resume_cursor,
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
    'recent', recent.items,
    'runnerMode', 'staff-bounded-sync-resume'
  ) else null end
  from totals cross join recent;
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
    and to_regclass('public.translation_provider_self_tests') is not null
    and to_regprocedure(
      'public.create_translation_job(text,text,jsonb,integer)'
    ) is not null
    and to_regprocedure(
      'public.claim_translation_job_items(text,integer,integer)'
    ) is not null
    and to_regprocedure(
      'public.complete_translation_job_item(uuid,text,boolean,text,text,text,integer,integer,integer)'
    ) is not null
    and to_regprocedure(
      'public.begin_translation_provider_self_test(text,boolean,boolean,text,integer)'
    ) is not null
    and to_regprocedure(
      'public.record_translation_sync_run(text,text,jsonb,jsonb,jsonb)'
    ) is not null
    and to_regprocedure('public.get_translation_job_resume(uuid)') is not null
    and has_function_privilege(
      'authenticated',
      'public.create_translation_job(text,text,jsonb,integer)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.claim_translation_job_items(text,integer,integer)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.complete_translation_job_item(uuid,text,boolean,text,text,text,integer,integer,integer)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.begin_translation_provider_self_test(text,boolean,boolean,text,integer)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.finish_translation_provider_self_test(text,uuid,boolean,boolean,boolean,text,integer,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.record_translation_sync_run(text,text,jsonb,jsonb,jsonb)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.get_translation_job_resume(uuid)',
      'EXECUTE'
    );
$$;

revoke all on function public.begin_translation_provider_self_test(
  text,boolean,boolean,text,integer
) from public, anon, authenticated, service_role;
revoke all on function public.finish_translation_provider_self_test(
  text,uuid,boolean,boolean,boolean,text,integer,text
) from public, anon, authenticated, service_role;
revoke all on function public.record_translation_sync_run(
  text,text,jsonb,jsonb,jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.get_translation_job_resume(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.begin_translation_provider_self_test(
  text,boolean,boolean,text,integer
) to authenticated;
grant execute on function public.finish_translation_provider_self_test(
  text,uuid,boolean,boolean,boolean,text,integer,text
) to authenticated;
grant execute on function public.record_translation_sync_run(
  text,text,jsonb,jsonb,jsonb
) to authenticated;
grant execute on function public.get_translation_job_resume(uuid)
  to authenticated;
