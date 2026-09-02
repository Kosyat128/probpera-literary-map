-- Add factual authorship without changing the legacy country_id/writer_id key.
-- Null authorship_kind preserves every pre-migration work as implicit-single.

alter table public.literary_works
  add column if not exists authorship_kind text;

do $literary_work_authorship_kind_constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = 'public.literary_works'::regclass
      and constraint_record.conname = 'literary_works_authorship_kind_check'
  ) then
    alter table public.literary_works
      add constraint literary_works_authorship_kind_check
      check (
        authorship_kind is null
        or authorship_kind in (
          'single',
          'multiple',
          'anonymous',
          'collective',
          'traditional',
          'disputed'
        )
      );
  end if;
end;
$literary_work_authorship_kind_constraint$;

alter table public.editorial_writers
  add column if not exists is_routing_only boolean not null default false;

-- Install the country-scoped replacement before removing the older global
-- writer/slug constraint, so uniqueness is continuously enforced.
do $literary_work_country_writer_slug_constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = 'public.literary_works'::regclass
      and constraint_record.conname = 'literary_works_country_writer_slug_key'
  ) then
    alter table public.literary_works
      add constraint literary_works_country_writer_slug_key
      unique (country_id, writer_id, slug);
  end if;
end;
$literary_work_country_writer_slug_constraint$;

alter table public.literary_works
  drop constraint if exists literary_works_writer_id_slug_key;

create table if not exists public.literary_work_authors (
  work_id uuid not null
    references public.literary_works(id) on update cascade on delete cascade,
  position smallint not null check (position between 0 and 999),
  writer_country_id text,
  writer_id text,
  credit_name_ru text check (
    credit_name_ru is null
    or char_length(btrim(credit_name_ru)) between 1 and 300
  ),
  credit_name_en text check (
    credit_name_en is null
    or char_length(btrim(credit_name_en)) between 1 and 300
  ),
  attribution_status text not null default 'credited'
    check (attribution_status in ('credited', 'attributed', 'disputed')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (work_id, position),
  constraint literary_work_authors_writer_pair_check check (
    (writer_country_id is null and writer_id is null)
    or (writer_country_id is not null and writer_id is not null)
  ),
  constraint literary_work_authors_identity_check check (
    writer_id is not null
    or nullif(btrim(credit_name_ru), '') is not null
    or nullif(btrim(credit_name_en), '') is not null
  ),
  constraint literary_work_authors_writer_reference_fk
    foreign key (writer_country_id, writer_id)
    references public.editorial_writers(country_id, id)
    on update cascade on delete restrict
);

create unique index if not exists literary_work_authors_linked_writer_key
  on public.literary_work_authors(work_id, writer_country_id, writer_id)
  where writer_id is not null;

create index if not exists literary_work_authors_writer_idx
  on public.literary_work_authors(writer_country_id, writer_id, work_id);

drop trigger if exists literary_work_authors_set_updated_at
  on public.literary_work_authors;
create trigger literary_work_authors_set_updated_at
  before update on public.literary_work_authors
  for each row execute function public.set_updated_at();

-- Cross-table cardinality cannot be expressed as a CHECK constraint. Keep it
-- deferred so the replacement RPC may delete and insert an ordered author set
-- in one transaction, while the committed state can never contradict kind.
create or replace function public.enforce_literary_work_authorship_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_work_id uuid;
  target_kind text;
  explicit_author_count integer;
begin
  if tg_table_name = 'literary_works' then
    target_work_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    target_work_id := case
      when tg_op = 'DELETE' then old.work_id
      else new.work_id
    end;
  end if;

  select work.authorship_kind
  into target_kind
  from public.literary_works work
  where work.id = target_work_id;
  if not found then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select count(*)::integer
  into explicit_author_count
  from public.literary_work_authors author
  where author.work_id = target_work_id;

  if target_kind is null and explicit_author_count <> 0 then
    raise exception 'Legacy implicit authorship cannot contain explicit authors'
      using errcode = '23514';
  elsif target_kind in ('anonymous', 'traditional')
    and explicit_author_count <> 0 then
    raise exception 'Anonymous or traditional authorship must contain no authors'
      using errcode = '23514';
  elsif target_kind = 'single' and explicit_author_count <> 1 then
    raise exception 'Single authorship must contain exactly one author'
      using errcode = '23514';
  elsif target_kind = 'multiple' and explicit_author_count < 2 then
    raise exception 'Multiple authorship must contain at least two authors'
      using errcode = '23514';
  elsif target_kind in ('collective', 'disputed')
    and explicit_author_count < 1 then
    raise exception 'Explicit authorship must contain at least one credit'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.enforce_literary_work_authorship_consistency()
  from public, anon, authenticated, service_role;

drop trigger if exists literary_works_authorship_consistency
  on public.literary_works;
create constraint trigger literary_works_authorship_consistency
  after insert or update on public.literary_works
  deferrable initially deferred
  for each row execute function
    public.enforce_literary_work_authorship_consistency();

drop trigger if exists literary_work_authors_consistency
  on public.literary_work_authors;
create constraint trigger literary_work_authors_consistency
  after insert or update or delete on public.literary_work_authors
  deferrable initially deferred
  for each row execute function
    public.enforce_literary_work_authorship_consistency();

create table if not exists public.literary_work_authorship_revisions (
  id bigint generated always as identity primary key,
  work_id uuid references public.literary_works(id) on delete set null,
  legacy_id text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  revised_at timestamptz not null default now(),
  revised_by uuid references auth.users(id) on delete set null
);

create index if not exists literary_work_authorship_revisions_work_idx
  on public.literary_work_authorship_revisions(
    work_id,
    revised_at desc,
    id desc
  );

create or replace function public.literary_work_authorship_snapshot(
  target_work_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'kind', work.authorship_kind,
    'authors', coalesce(
      (
        select jsonb_agg(
          jsonb_strip_nulls(
            jsonb_build_object(
              'countryId', author.writer_country_id,
              'writerId', author.writer_id,
              'creditNames', nullif(
                jsonb_strip_nulls(
                  jsonb_build_object(
                    'ru', nullif(btrim(author.credit_name_ru), ''),
                    'en', nullif(btrim(author.credit_name_en), '')
                  )
                ),
                '{}'::jsonb
              ),
              'attribution', author.attribution_status
            )
          )
          order by author.position
        )
        from public.literary_work_authors author
        where author.work_id = work.id
      ),
      '[]'::jsonb
    )
  )
  from public.literary_works work
  where work.id = target_work_id;
$$;

revoke all on function public.literary_work_authorship_snapshot(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.replace_literary_work_authorship(
  p_work_id uuid,
  p_expected_updated_at timestamp with time zone,
  p_authorship_kind text,
  p_authors jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.literary_works%rowtype;
  author_record jsonb;
  normalized_kind text := nullif(lower(btrim(p_authorship_kind)), '');
  normalized_authors jsonb := '[]'::jsonb;
  old_snapshot jsonb;
  requested_snapshot jsonb;
  saved_snapshot jsonb;
  author_count integer;
  author_writer_id text;
  author_country_id text;
  author_credit_ru text;
  author_credit_en text;
  author_attribution text;
  request_role text := coalesce((select auth.role()), '');
begin
  if request_role <> 'service_role' and not public.is_staff() then
    raise exception 'Staff role is required'
      using errcode = '42501';
  end if;
  if p_expected_updated_at is null then
    raise exception 'Expected work timestamp is required'
      using errcode = '22023';
  end if;
  if p_authors is null or jsonb_typeof(p_authors) <> 'array' then
    raise exception 'Authors must be a JSON array'
      using errcode = '22023';
  end if;
  if normalized_kind is not null and normalized_kind not in (
    'single',
    'multiple',
    'anonymous',
    'collective',
    'traditional',
    'disputed'
  ) then
    raise exception 'Unsupported authorship kind'
      using errcode = '22023';
  end if;

  select work.*
  into target
  from public.literary_works work
  where work.id = p_work_id
  for update;
  if not found then
    raise exception 'Literary work not found'
      using errcode = 'P0002';
  end if;
  if target.updated_at is distinct from p_expected_updated_at then
    raise exception 'Literary work changed since it was loaded'
      using errcode = '40001';
  end if;
  if request_role = 'service_role' and target.is_cms_locked then
    raise exception 'CMS-locked authorship cannot be synchronized'
      using errcode = '42501';
  end if;

  author_count := jsonb_array_length(p_authors);
  if author_count > 1000 then
    raise exception 'At most 1000 author credits are allowed'
      using errcode = '22023';
  end if;
  if normalized_kind is null and author_count <> 0 then
    raise exception 'Legacy implicit authorship cannot contain explicit authors'
      using errcode = '23514';
  elsif normalized_kind in ('anonymous', 'traditional')
    and author_count <> 0 then
    raise exception 'Anonymous or traditional authorship must contain no authors'
      using errcode = '23514';
  elsif normalized_kind = 'single' and author_count <> 1 then
    raise exception 'Single authorship must contain exactly one author'
      using errcode = '23514';
  elsif normalized_kind = 'multiple' and author_count < 2 then
    raise exception 'Multiple authorship must contain at least two authors'
      using errcode = '23514';
  elsif normalized_kind in ('collective', 'disputed')
    and author_count < 1 then
    raise exception 'Explicit authorship must contain at least one credit'
      using errcode = '23514';
  end if;

  for author_record in
    select listed.value
    from jsonb_array_elements(p_authors) listed(value)
  loop
    if jsonb_typeof(author_record) <> 'object' then
      raise exception 'Every author must be a JSON object'
        using errcode = '22023';
    end if;
    author_writer_id := nullif(btrim(author_record ->> 'writerId'), '');
    author_country_id := nullif(btrim(author_record ->> 'countryId'), '');
    if author_writer_id is not null and author_country_id is null then
      author_country_id := target.country_id;
    end if;
    author_credit_ru := nullif(
      btrim(author_record #>> '{creditNames,ru}'),
      ''
    );
    author_credit_en := nullif(
      btrim(author_record #>> '{creditNames,en}'),
      ''
    );
    author_attribution := coalesce(
      nullif(btrim(author_record ->> 'attribution'), ''),
      'credited'
    );
    if (author_writer_id is null) <> (author_country_id is null) then
      raise exception 'Writer country and writer id must be supplied together'
        using errcode = '23514';
    end if;
    if author_writer_id is null
      and author_credit_ru is null
      and author_credit_en is null then
      raise exception 'Every author requires a writer reference or credit name'
        using errcode = '23514';
    end if;
    if author_attribution not in ('credited', 'attributed', 'disputed') then
      raise exception 'Unsupported author attribution status'
        using errcode = '23514';
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'countryId', case
            when nullif(btrim(listed.value ->> 'writerId'), '') is not null
              then coalesce(
                nullif(btrim(listed.value ->> 'countryId'), ''),
                target.country_id
              )
            else null
          end,
          'writerId', nullif(btrim(listed.value ->> 'writerId'), ''),
          'creditNames', nullif(
            jsonb_strip_nulls(
              jsonb_build_object(
                'ru', nullif(
                  btrim(listed.value #>> '{creditNames,ru}'),
                  ''
                ),
                'en', nullif(
                  btrim(listed.value #>> '{creditNames,en}'),
                  ''
                )
              )
            ),
            '{}'::jsonb
          ),
          'attribution', coalesce(
            nullif(btrim(listed.value ->> 'attribution'), ''),
            'credited'
          )
        )
      )
      order by listed.ordinality
    ),
    '[]'::jsonb
  )
  into normalized_authors
  from jsonb_array_elements(p_authors)
    with ordinality listed(value, ordinality);

  old_snapshot := public.literary_work_authorship_snapshot(target.id);
  requested_snapshot := jsonb_build_object(
    'kind', normalized_kind,
    'authors', normalized_authors
  );
  if old_snapshot = requested_snapshot then
    return jsonb_build_object(
      'workId', target.id,
      'updatedAt', target.updated_at,
      'authorship', old_snapshot,
      'changed', false
    );
  end if;

  insert into public.literary_work_authorship_revisions (
    work_id,
    legacy_id,
    snapshot,
    revised_by
  ) values (
    target.id,
    target.legacy_id,
    old_snapshot,
    (select auth.uid())
  );

  delete from public.literary_work_authors author
  where author.work_id = target.id;

  insert into public.literary_work_authors (
    work_id,
    position,
    writer_country_id,
    writer_id,
    credit_name_ru,
    credit_name_en,
    attribution_status
  )
  select
    target.id,
    (listed.ordinality - 1)::smallint,
    nullif(btrim(listed.value ->> 'countryId'), ''),
    nullif(btrim(listed.value ->> 'writerId'), ''),
    nullif(btrim(listed.value #>> '{creditNames,ru}'), ''),
    nullif(btrim(listed.value #>> '{creditNames,en}'), ''),
    coalesce(
      nullif(btrim(listed.value ->> 'attribution'), ''),
      'credited'
    )
  from jsonb_array_elements(normalized_authors)
    with ordinality listed(value, ordinality);

  update public.literary_works work
  set
    authorship_kind = normalized_kind,
    updated_by = coalesce((select auth.uid()), work.updated_by),
    is_cms_locked = case
      when request_role = 'service_role' then work.is_cms_locked
      else true
    end
  where work.id = target.id
  returning work.* into target;

  saved_snapshot := public.literary_work_authorship_snapshot(target.id);
  return jsonb_build_object(
    'workId', target.id,
    'updatedAt', target.updated_at,
    'authorship', saved_snapshot,
    'changed', true
  );
end;
$$;

revoke all on function public.replace_literary_work_authorship(
  uuid,
  timestamp with time zone,
  text,
  jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.replace_literary_work_authorship(
  uuid,
  timestamp with time zone,
  text,
  jsonb
) to authenticated, service_role;

-- Static archive synchronization uses one transaction per bounded batch. The
-- worker still delegates every composition to the optimistic full-set RPC, so
-- it cannot observe or publish a half-replaced author list.
create or replace function public.sync_literary_work_authorship_batch(
  p_replacements jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  replacement jsonb;
  replacement_result jsonb;
  replacement_count integer;
  changed_count integer := 0;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required'
      using errcode = '42501';
  end if;
  if p_replacements is null or jsonb_typeof(p_replacements) <> 'array' then
    raise exception 'Replacements must be a JSON array'
      using errcode = '22023';
  end if;
  replacement_count := jsonb_array_length(p_replacements);
  if replacement_count > 500 then
    raise exception 'At most 500 authorship replacements are allowed per batch'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_replacements) listed(value)
    group by listed.value ->> 'workId'
    having count(*) > 1
  ) then
    raise exception 'A work may occur only once per authorship batch'
      using errcode = '22023';
  end if;

  for replacement in
    select listed.value
    from jsonb_array_elements(p_replacements) listed(value)
  loop
    if jsonb_typeof(replacement) <> 'object'
      or nullif(btrim(replacement ->> 'workId'), '') is null
      or nullif(btrim(replacement ->> 'expectedUpdatedAt'), '') is null
      or jsonb_typeof(replacement -> 'authors') <> 'array' then
      raise exception 'Every replacement requires workId, expectedUpdatedAt and authors'
        using errcode = '22023';
    end if;
    replacement_result := public.replace_literary_work_authorship(
      (replacement ->> 'workId')::uuid,
      (replacement ->> 'expectedUpdatedAt')::timestamptz,
      replacement ->> 'kind',
      replacement -> 'authors'
    );
    if coalesce((replacement_result ->> 'changed')::boolean, false) then
      changed_count := changed_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'processed', replacement_count,
    'changed', changed_count,
    'unchanged', replacement_count - changed_count
  );
end;
$$;

revoke all on function public.sync_literary_work_authorship_batch(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.sync_literary_work_authorship_batch(jsonb)
  to service_role;

alter table public.literary_work_authors enable row level security;
alter table public.literary_work_authors force row level security;
alter table public.literary_work_authorship_revisions enable row level security;
alter table public.literary_work_authorship_revisions force row level security;

revoke all on table public.literary_work_authors from public, anon, authenticated;
grant select on table public.literary_work_authors to anon, authenticated;
grant all on table public.literary_work_authors to service_role;

revoke all on table public.literary_work_authorship_revisions
  from public, anon, authenticated;
grant select on table public.literary_work_authorship_revisions
  to authenticated;
grant all on table public.literary_work_authorship_revisions to service_role;
grant usage, select on sequence public.literary_work_authorship_revisions_id_seq
  to service_role;

drop policy if exists "Public read publishable literary work authors"
  on public.literary_work_authors;
create policy "Public read publishable literary work authors"
on public.literary_work_authors for select
to anon, authenticated
using (public.is_publishable_literary_work(work_id));

drop policy if exists "Staff manage literary work authors"
  on public.literary_work_authors;
drop policy if exists "Staff read literary work authors"
  on public.literary_work_authors;
create policy "Staff read literary work authors"
on public.literary_work_authors for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read literary work authorship revisions"
  on public.literary_work_authorship_revisions;
create policy "Staff read literary work authorship revisions"
on public.literary_work_authorship_revisions for select
to authenticated
using (public.is_staff());

-- Use a dedicated trigger function so the predecessor health check's exact
-- count of generic capture_public_build_outbox triggers remains valid.
create or replace function public.capture_literary_work_authorship_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_work_id uuid;
begin
  target_work_id := case
    when tg_op = 'DELETE' then old.work_id
    else new.work_id
  end;
  perform public.append_public_build_outbox(
    (select auth.uid()),
    'literary_work_authorship',
    target_work_id::text,
    'database-' || lower(tg_op),
    jsonb_build_object(
      'operation', lower(tg_op),
      'table', tg_table_name,
      'workId', target_work_id
    )
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.capture_literary_work_authorship_outbox()
  from public, anon, authenticated, service_role;

drop trigger if exists literary_work_authors_public_build_outbox
  on public.literary_work_authors;
create trigger literary_work_authors_public_build_outbox
  after insert or update or delete on public.literary_work_authors
  for each row execute function public.capture_literary_work_authorship_outbox();

-- Extend, rather than replace, the accumulated health contract.
do $literary_work_authorship_health_predecessor$
begin
  if to_regprocedure(
    'public.get_editorial_schema_health_pre_literary_work_authorship()'
  ) is null then
    if to_regprocedure('public.get_editorial_schema_health()') is null then
      raise exception 'preceding editorial schema health RPC is missing';
    end if;
    alter function public.get_editorial_schema_health()
      rename to get_editorial_schema_health_pre_literary_work_authorship;
  end if;
end;
$literary_work_authorship_health_predecessor$;

revoke all on function
  public.get_editorial_schema_health_pre_literary_work_authorship()
  from public, anon, authenticated, service_role;

create or replace function public.get_editorial_schema_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_staff() then
    coalesce(
      public.get_editorial_schema_health_pre_literary_work_authorship(),
      '{}'::jsonb
    ) || jsonb_build_object(
      -- Preserve whichever health-contract version the predecessor exposes.
      -- Later same-day migrations may already have advanced that marker.
      'checkedAt', now(),
      'literaryWorkAuthorship',
        to_regclass('public.literary_work_authors') is not null
        and to_regclass(
          'public.literary_work_authorship_revisions'
        ) is not null
        and exists (
          select 1
          from information_schema.columns column_record
          where column_record.table_schema = 'public'
            and column_record.table_name = 'literary_works'
            and column_record.column_name = 'authorship_kind'
            and column_record.is_nullable = 'YES'
        )
        and exists (
          select 1
          from information_schema.columns column_record
          where column_record.table_schema = 'public'
            and column_record.table_name = 'editorial_writers'
            and column_record.column_name = 'is_routing_only'
            and column_record.is_nullable = 'NO'
        )
        and exists (
          select 1
          from pg_catalog.pg_constraint constraint_record
          where constraint_record.conrelid =
              'public.literary_works'::regclass
            and constraint_record.conname =
              'literary_works_country_writer_slug_key'
            and constraint_record.convalidated
        )
        and not exists (
          select 1
          from pg_catalog.pg_constraint constraint_record
          where constraint_record.conrelid =
              'public.literary_works'::regclass
            and constraint_record.conname =
              'literary_works_writer_id_slug_key'
        )
        and (
          select relation.relrowsecurity and relation.relforcerowsecurity
          from pg_catalog.pg_class relation
          where relation.oid = 'public.literary_work_authors'::regclass
        )
        and to_regprocedure(
          'public.replace_literary_work_authorship(uuid,timestamp with time zone,text,jsonb)'
        ) is not null
        and to_regprocedure(
          'public.sync_literary_work_authorship_batch(jsonb)'
        ) is not null
        and to_regprocedure(
          'public.enforce_literary_work_authorship_consistency()'
        ) is not null
        and has_function_privilege(
          'authenticated',
          'public.replace_literary_work_authorship(uuid,timestamp with time zone,text,jsonb)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.replace_literary_work_authorship(uuid,timestamp with time zone,text,jsonb)',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.sync_literary_work_authorship_batch(jsonb)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.sync_literary_work_authorship_batch(jsonb)',
          'EXECUTE'
        )
        and not has_table_privilege(
          'authenticated',
          'public.literary_work_authors',
          'INSERT'
        )
        and not has_table_privilege(
          'authenticated',
          'public.literary_work_authors',
          'UPDATE'
        )
        and not has_table_privilege(
          'authenticated',
          'public.literary_work_authors',
          'DELETE'
        )
        and exists (
          select 1
          from pg_catalog.pg_trigger outbox_trigger
          where outbox_trigger.tgrelid =
              'public.literary_work_authors'::regclass
            and not outbox_trigger.tgisinternal
            and outbox_trigger.tgname =
              'literary_work_authors_public_build_outbox'
            and outbox_trigger.tgfoid =
              'public.capture_literary_work_authorship_outbox()'::regprocedure
        )
        and exists (
          select 1
          from pg_catalog.pg_policies policy_record
          where policy_record.schemaname = 'public'
            and policy_record.tablename = 'literary_work_authors'
            and policy_record.policyname =
              'Public read publishable literary work authors'
            and policy_record.cmd = 'SELECT'
        )
        and exists (
          select 1
          from pg_catalog.pg_policies policy_record
          where policy_record.schemaname = 'public'
            and policy_record.tablename = 'literary_work_authors'
            and policy_record.policyname =
              'Staff read literary work authors'
            and policy_record.cmd = 'SELECT'
        )
    )
    else null
  end;
$$;

revoke all on function public.get_editorial_schema_health()
  from public, anon, authenticated, service_role;
grant execute on function public.get_editorial_schema_health()
  to authenticated;
