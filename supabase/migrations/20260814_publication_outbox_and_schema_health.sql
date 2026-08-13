-- Transactional public-build outbox and a staff-only production schema probe.
--
-- Editorial writes and their publication request must either commit together or
-- fail together.  The trigger below therefore runs inside every content
-- mutation transaction.  The admin still attempts a fast GitHub dispatch, but
-- the five-minute scheduled workflow can always recover an accepted write.

-- Repository-owned ledger for the guarded production reconciliation workflow.
-- It is intentionally separate from Supabase CLI's internal migration table:
-- changing vendor-owned bookkeeping would make later CLI reconciliation
-- ambiguous.  A recorded checksum is immutable; the workflow refuses to run
-- an edited historical migration under the same version.
create table if not exists public.probpera_schema_migrations (
  version text primary key
    check (version ~ '^20[0-9]{6}_[a-z0-9_]+$'),
  migration_sha256 text not null
    check (migration_sha256 ~ '^[0-9a-f]{64}$'),
  repository_sha text not null
    check (repository_sha ~ '^[0-9a-f]{40}$'),
  applied_at timestamptz not null default now()
);

alter table public.probpera_schema_migrations enable row level security;
revoke all on table public.probpera_schema_migrations from anon, authenticated;
grant select on table public.probpera_schema_migrations to service_role;

create or replace function public.protect_probpera_schema_migration_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'probpera schema migration ledger is append-only';
end;
$$;

revoke all on function public.protect_probpera_schema_migration_ledger()
  from public;

drop trigger if exists probpera_schema_migrations_append_only
  on public.probpera_schema_migrations;
create trigger probpera_schema_migrations_append_only
  before update or delete on public.probpera_schema_migrations
  for each row
  execute function public.protect_probpera_schema_migration_ledger();

create table if not exists public.public_build_outbox (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (char_length(entity_type) between 1 and 120),
  entity_id text not null check (char_length(entity_id) between 1 and 240),
  reason text not null default 'editorial-mutation'
    check (char_length(reason) between 1 and 240),
  status text not null default 'requested'
    check (status in ('requested', 'dispatched', 'deployed', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  provider text,
  requested_at timestamptz not null default now(),
  dispatched_at timestamptz,
  deployed_at timestamptz,
  deployment_run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

-- Each accepted request is immutable until it is finalized.  Do not collapse
-- pending rows by entity: a mutation can commit after a deploy has read its
-- high-water mark but before that deploy finalizes it.  Reusing the old row/id
-- in that window would acknowledge content that was never in the build.
drop index if exists public.public_build_outbox_pending_entity_idx;
create index public_build_outbox_pending_entity_idx
  on public.public_build_outbox(entity_type, entity_id, id)
  where status in ('requested', 'dispatched', 'failed');

create index if not exists public_build_outbox_pending_order_idx
  on public.public_build_outbox(id)
  where status in ('requested', 'dispatched', 'failed');

-- The compatibility consumer keeps checking the audit queue during rollout.
-- A partial index prevents that five-minute probe from scanning the full
-- editorial audit history once the transactional outbox is live.
create index if not exists admin_audit_public_build_queue_idx
  on public.admin_audit_log(id desc)
  where action in (
    'public_build.requested',
    'public_build.failed',
    'public_build.deployed'
  );

drop trigger if exists public_build_outbox_set_updated_at
  on public.public_build_outbox;
create trigger public_build_outbox_set_updated_at
  before update on public.public_build_outbox
  for each row execute function public.set_updated_at();

create or replace function public.append_public_build_outbox(
  p_actor_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  outbox_id bigint;
begin
  if nullif(trim(p_entity_type), '') is null
    or nullif(trim(p_entity_id), '') is null then
    raise exception 'public build entity identity is required';
  end if;

  insert into public.public_build_outbox (
    actor_id,
    entity_type,
    entity_id,
    reason,
    metadata,
    status,
    requested_at
  ) values (
    p_actor_id,
    left(trim(p_entity_type), 120),
    left(trim(p_entity_id), 240),
    left(coalesce(nullif(trim(p_reason), ''), 'editorial-mutation'), 240),
    coalesce(p_metadata, '{}'::jsonb),
    'requested',
    now()
  )
  returning id into outbox_id;

  return outbox_id;
end;
$$;

revoke all on function public.append_public_build_outbox(
  uuid, text, text, text, jsonb
) from public;

create or replace function public.enqueue_public_build_request(
  p_entity_type text,
  p_entity_id text,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'staff access required';
  end if;

  -- This explicit event intentionally coexists with row-trigger events.  The
  -- RPC also covers manual republish operations and gives the fast dispatch a
  -- concrete event to annotate.  At-least-once duplicates are harmless;
  -- mutating/reusing an older pending row is not.
  return public.append_public_build_outbox(
    (select auth.uid()),
    p_entity_type,
    p_entity_id,
    p_reason,
    p_metadata
  );
end;
$$;

revoke all on function public.enqueue_public_build_request(
  text, text, text, jsonb
) from public;
grant execute on function public.enqueue_public_build_request(
  text, text, text, jsonb
) to authenticated;

create or replace function public.mark_public_build_dispatched(
  p_outbox_id bigint,
  p_provider text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'staff access required';
  end if;

  update public.public_build_outbox
  set status = 'dispatched',
      provider = left(nullif(trim(p_provider), ''), 80),
      dispatched_at = now(),
      attempt_count = attempt_count + 1,
      last_error = null
  where id = p_outbox_id
    and status in ('requested', 'dispatched', 'failed');

  return found;
end;
$$;

revoke all on function public.mark_public_build_dispatched(bigint, text)
  from public;
grant execute on function public.mark_public_build_dispatched(bigint, text)
  to authenticated;

create or replace function public.capture_public_build_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  mutation_id text;
begin
  if tg_op = 'UPDATE' and old is not distinct from new then
    return new;
  end if;

  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  mutation_id := coalesce(
    row_data ->> 'id',
    row_data ->> 'article_id',
    row_data ->> 'work_id',
    row_data ->> 'homepage_block_id',
    row_data ->> 'country_id',
    row_data ->> 'writer_id',
    tg_table_name
  );

  perform public.append_public_build_outbox(
    (select auth.uid()),
    tg_table_name,
    mutation_id,
    'database-' || lower(tg_op),
    jsonb_build_object('operation', lower(tg_op), 'table', tg_table_name)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.capture_public_build_outbox() from public;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'articles',
    'article_tags',
    'article_translations',
    'pages',
    'homepage_blocks',
    'banners',
    'navigation_menus',
    'navigation_items',
    'redirects',
    'categories',
    'tags',
    'media_assets',
    'media_usages',
    'literary_works',
    'literary_work_translations',
    'literary_work_sources',
    'literary_work_external_ids',
    'book_editions',
    'writer_profile_overrides',
    'country_profile_overrides'
  ]
  loop
    execute format(
      'drop trigger if exists %I_public_build_outbox on public.%I',
      table_name,
      table_name
    );
    execute format(
      'create trigger %I_public_build_outbox after insert or update or delete on public.%I for each row execute function public.capture_public_build_outbox()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

alter table public.public_build_outbox enable row level security;

revoke all on table public.public_build_outbox from anon, authenticated;
grant select on table public.public_build_outbox to authenticated;
grant select, update on table public.public_build_outbox to service_role;

drop policy if exists "Staff read public build outbox"
  on public.public_build_outbox;
create policy "Staff read public build outbox"
on public.public_build_outbox for select
to authenticated
using (public.is_staff());

-- This probe is deliberately staff-only.  The migration depends on every
-- listed table/function, so a successful response proves that the production
-- schema has reached the current editorial contract.
create or replace function public.get_editorial_schema_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_staff() then jsonb_build_object(
      'version', '20260814_publication_outbox_and_schema_health',
      'checkedAt', now(),
      'outbox', to_regclass('public.public_build_outbox') is not null,
      'outboxRpc',
        to_regprocedure(
          'public.enqueue_public_build_request(text,text,text,jsonb)'
        ) is not null,
      'migrationLedger',
        to_regclass('public.probpera_schema_migrations') is not null,
      'publicationTriggers', (
        select count(*) = 20
        from pg_catalog.pg_trigger outbox_trigger
        join pg_catalog.pg_class relation
          on relation.oid = outbox_trigger.tgrelid
        join pg_catalog.pg_namespace namespace
          on namespace.oid = relation.relnamespace
        where namespace.nspname = 'public'
          and not outbox_trigger.tgisinternal
          and outbox_trigger.tgfoid =
            'public.capture_public_build_outbox()'::regprocedure
          and outbox_trigger.tgname =
            (relation.relname::text || '_public_build_outbox')::name
          and relation.relname = any(array[
            'articles',
            'article_tags',
            'article_translations',
            'pages',
            'homepage_blocks',
            'banners',
            'navigation_menus',
            'navigation_items',
            'redirects',
            'categories',
            'tags',
            'media_assets',
            'media_usages',
            'literary_works',
            'literary_work_translations',
            'literary_work_sources',
            'literary_work_external_ids',
            'book_editions',
            'writer_profile_overrides',
            'country_profile_overrides'
          ]::name[])
      ),
      'pendingPublicBuilds', (
        select count(*)
        from public.public_build_outbox
        where status in ('requested', 'dispatched', 'failed')
      ),
      'revisionHistory', to_regclass('public.admin_revision_history') is not null,
      'workTranslations', to_regclass('public.literary_work_translations') is not null,
      'countryOverrides', to_regclass('public.country_profile_overrides') is not null,
      'writerOverrides', to_regclass('public.writer_profile_overrides') is not null,
      'homepageMove', to_regprocedure('public.move_homepage_block(uuid,text)') is not null,
      'tagsUpdatedAt', exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'tags'
          and column_name = 'updated_at'
      )
    )
    else null
  end;
$$;

revoke all on function public.get_editorial_schema_health() from public;
grant execute on function public.get_editorial_schema_health() to authenticated;
