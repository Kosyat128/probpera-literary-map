-- Phase 6 / Data Studio: canonical editorial references and transactional
-- primary-edition handoff. Static catalog files remain the reviewed fallback.

create table if not exists public.editorial_countries (
  id text primary key check (
    char_length(id) between 2 and 120
    and id ~ '^[a-z0-9][a-z0-9_-]*$'
  ),
  name_ru text not null check (char_length(btrim(name_ru)) between 1 and 240),
  name_en text not null default '' check (char_length(name_en) <= 240),
  iso_code text check (iso_code is null or iso_code ~ '^[A-Z]{2,3}$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  source text not null default 'editorial-catalog'
    check (source in ('editorial-catalog', 'legacy-backfill', 'manual')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.editorial_writers (
  country_id text not null references public.editorial_countries(id)
    on update cascade on delete restrict,
  id text not null check (
    char_length(id) between 2 and 180
    and id !~ '[[:space:][:cntrl:]/:]'
  ),
  name_ru text not null check (char_length(btrim(name_ru)) between 1 and 300),
  name_en text not null default '' check (char_length(name_en) <= 300),
  status text not null default 'active' check (status in ('active', 'archived')),
  source text not null default 'editorial-catalog'
    check (source in ('editorial-catalog', 'legacy-backfill', 'manual')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (country_id, id)
);

create index if not exists editorial_countries_status_idx
  on public.editorial_countries(status, name_ru, id);
create index if not exists editorial_writers_status_idx
  on public.editorial_writers(country_id, status, name_ru, id);

drop trigger if exists editorial_countries_set_updated_at on public.editorial_countries;
create trigger editorial_countries_set_updated_at before update on public.editorial_countries
  for each row execute function public.set_updated_at();
drop trigger if exists editorial_writers_set_updated_at on public.editorial_writers;
create trigger editorial_writers_set_updated_at before update on public.editorial_writers
  for each row execute function public.set_updated_at();

-- Backfill all identifiers already referenced in production before validating
-- foreign keys. Friendly labels are synchronized by the guarded RPC below.
insert into public.editorial_countries (id, name_ru, source)
select reference.country_id, reference.country_id, 'legacy-backfill'
from (
  select country_id from public.country_profile_overrides
  union select country_id from public.writer_profile_overrides
  union select country_id from public.literary_works
  union select country_id from public.book_import_candidates
) as reference
where reference.country_id ~ '^[a-z0-9][a-z0-9_-]*$'
on conflict (id) do nothing;

insert into public.editorial_writers (country_id, id, name_ru, source)
select reference.country_id, reference.writer_id, reference.writer_id, 'legacy-backfill'
from (
  select country_id, writer_id from public.writer_profile_overrides
  union select country_id, writer_id from public.literary_works
  union select country_id, writer_id from public.book_import_candidates
) as reference
where reference.country_id ~ '^[a-z0-9][a-z0-9_-]*$'
  and reference.writer_id !~ '[[:space:][:cntrl:]/:]'
on conflict (country_id, id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'country_profile_overrides_country_reference_fk'
      and conrelid = 'public.country_profile_overrides'::regclass
  ) then
    alter table public.country_profile_overrides
      add constraint country_profile_overrides_country_reference_fk
      foreign key (country_id) references public.editorial_countries(id)
      on update cascade on delete restrict not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'writer_profile_overrides_writer_reference_fk'
      and conrelid = 'public.writer_profile_overrides'::regclass
  ) then
    alter table public.writer_profile_overrides
      add constraint writer_profile_overrides_writer_reference_fk
      foreign key (country_id, writer_id)
      references public.editorial_writers(country_id, id)
      on update cascade on delete restrict not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'literary_works_writer_reference_fk'
      and conrelid = 'public.literary_works'::regclass
  ) then
    alter table public.literary_works
      add constraint literary_works_writer_reference_fk
      foreign key (country_id, writer_id)
      references public.editorial_writers(country_id, id)
      on update cascade on delete restrict not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'book_import_candidates_writer_reference_fk'
      and conrelid = 'public.book_import_candidates'::regclass
  ) then
    alter table public.book_import_candidates
      add constraint book_import_candidates_writer_reference_fk
      foreign key (country_id, writer_id)
      references public.editorial_writers(country_id, id)
      on update cascade on delete restrict not valid;
  end if;
end
$$;

alter table public.country_profile_overrides validate constraint country_profile_overrides_country_reference_fk;
alter table public.writer_profile_overrides validate constraint writer_profile_overrides_writer_reference_fk;
alter table public.literary_works validate constraint literary_works_writer_reference_fk;
alter table public.book_import_candidates validate constraint book_import_candidates_writer_reference_fk;

alter table public.editorial_countries enable row level security;
alter table public.editorial_writers enable row level security;
alter table public.editorial_countries force row level security;
alter table public.editorial_writers force row level security;
revoke all on table public.editorial_countries from anon, authenticated;
revoke all on table public.editorial_writers from anon, authenticated;
grant select on table public.editorial_countries to authenticated;
grant select on table public.editorial_writers to authenticated;
grant all on table public.editorial_countries to service_role;
grant all on table public.editorial_writers to service_role;

drop policy if exists "Staff manage editorial countries" on public.editorial_countries;
drop policy if exists "Staff read editorial countries" on public.editorial_countries;
create policy "Staff read editorial countries" on public.editorial_countries
  for select to authenticated using (public.is_staff());
drop policy if exists "Staff manage editorial writers" on public.editorial_writers;
drop policy if exists "Staff read editorial writers" on public.editorial_writers;
create policy "Staff read editorial writers" on public.editorial_writers
  for select to authenticated using (public.is_staff());

create or replace function public.ensure_editorial_reference(
  p_country_id text,
  p_country_name_ru text,
  p_country_name_en text default '',
  p_country_iso_code text default null,
  p_writer_id text default null,
  p_writer_name_ru text default null,
  p_writer_name_en text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  country_key text := lower(btrim(coalesce(p_country_id, '')));
  writer_key text := lower(btrim(coalesce(p_writer_id, '')));
  iso_code text := nullif(upper(btrim(coalesce(p_country_iso_code, ''))), '');
  country_rows integer := 0;
  writer_rows integer := 0;
begin
  if actor_id is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'staff-required';
  end if;
  if country_key !~ '^[a-z0-9][a-z0-9_-]{1,119}$'
     or char_length(btrim(coalesce(p_country_name_ru, ''))) not between 1 and 240
     or (iso_code is not null and iso_code !~ '^[A-Z]{2,3}$') then
    raise exception using errcode = '22023', message = 'invalid-country-reference';
  end if;
  if p_writer_id is not null and (
    char_length(writer_key) not between 2 and 180
    or writer_key ~ '[[:space:][:cntrl:]/:]'
    or char_length(btrim(coalesce(p_writer_name_ru, ''))) not between 1 and 300
  ) then
    raise exception using errcode = '22023', message = 'invalid-writer-reference';
  end if;

  insert into public.editorial_countries (
    id, name_ru, name_en, iso_code, source, created_by, updated_by
  ) values (
    country_key, btrim(p_country_name_ru), btrim(coalesce(p_country_name_en, '')),
    iso_code, 'editorial-catalog', actor_id, actor_id
  ) on conflict (id) do update set
    name_ru = excluded.name_ru,
    name_en = excluded.name_en,
    iso_code = excluded.iso_code,
    source = case
      when editorial_countries.source = 'manual' then 'manual'
      else 'editorial-catalog'
    end,
    updated_by = actor_id
  where editorial_countries.source <> 'manual'
    and (editorial_countries.name_ru is distinct from excluded.name_ru
     or editorial_countries.name_en is distinct from excluded.name_en
     or editorial_countries.iso_code is distinct from excluded.iso_code
     or editorial_countries.source is distinct from 'editorial-catalog');
  get diagnostics country_rows = row_count;

  if p_writer_id is not null then
    insert into public.editorial_writers (
      country_id, id, name_ru, name_en, source, created_by, updated_by
    ) values (
      country_key, writer_key, btrim(p_writer_name_ru),
      btrim(coalesce(p_writer_name_en, '')), 'editorial-catalog', actor_id, actor_id
    ) on conflict (country_id, id) do update set
      name_ru = excluded.name_ru,
      name_en = excluded.name_en,
      source = case
        when editorial_writers.source = 'manual' then 'manual'
        else 'editorial-catalog'
      end,
      updated_by = actor_id
    where editorial_writers.source <> 'manual'
      and (editorial_writers.name_ru is distinct from excluded.name_ru
       or editorial_writers.name_en is distinct from excluded.name_en
       or editorial_writers.source is distinct from 'editorial-catalog');
    get diagnostics writer_rows = row_count;
  end if;

  if country_rows > 0 or writer_rows > 0 then
    insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (
      actor_id, 'editorial_reference.synchronized', 'editorial_reference',
      country_key || coalesce(':' || nullif(writer_key, ''), ''),
      jsonb_build_object('countryChanged', country_rows > 0, 'writerChanged', writer_rows > 0)
    );
  end if;
  return jsonb_build_object(
    'countryId', country_key,
    'writerId', nullif(writer_key, ''),
    'changed', country_rows > 0 or writer_rows > 0
  );
end;
$$;

revoke all on function public.ensure_editorial_reference(text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.ensure_editorial_reference(text, text, text, text, text, text, text)
  to authenticated;

create or replace function public.save_manual_editorial_reference(
  p_country_id text,
  p_country_name_ru text,
  p_country_name_en text default '',
  p_country_iso_code text default null,
  p_writer_id text default null,
  p_writer_name_ru text default null,
  p_writer_name_en text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  country_key text := lower(btrim(coalesce(p_country_id, '')));
  writer_key text := lower(btrim(coalesce(p_writer_id, '')));
  iso_code text := nullif(upper(btrim(coalesce(p_country_iso_code, ''))), '');
begin
  if actor_id is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'staff-required';
  end if;
  if country_key !~ '^[a-z0-9][a-z0-9_-]{1,119}$'
     or char_length(btrim(coalesce(p_country_name_ru, ''))) not between 1 and 240
     or (iso_code is not null and iso_code !~ '^[A-Z]{2,3}$') then
    raise exception using errcode = '22023', message = 'invalid-country-reference';
  end if;
  if p_writer_id is not null and (
    char_length(writer_key) not between 2 and 180
    or writer_key ~ '[[:space:][:cntrl:]/:]'
    or char_length(btrim(coalesce(p_writer_name_ru, ''))) not between 1 and 300
  ) then
    raise exception using errcode = '22023', message = 'invalid-writer-reference';
  end if;

  insert into public.editorial_countries (
    id, name_ru, name_en, iso_code, source, created_by, updated_by
  ) values (
    country_key, btrim(p_country_name_ru), btrim(coalesce(p_country_name_en, '')),
    iso_code, 'manual', actor_id, actor_id
  ) on conflict (id) do update set
    name_ru = excluded.name_ru,
    name_en = excluded.name_en,
    iso_code = excluded.iso_code,
    source = 'manual',
    updated_by = actor_id;

  if p_writer_id is not null then
    insert into public.editorial_writers (
      country_id, id, name_ru, name_en, source, created_by, updated_by
    ) values (
      country_key, writer_key, btrim(p_writer_name_ru),
      btrim(coalesce(p_writer_name_en, '')), 'manual', actor_id, actor_id
    ) on conflict (country_id, id) do update set
      name_ru = excluded.name_ru,
      name_en = excluded.name_en,
      source = 'manual',
      updated_by = actor_id;
  end if;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor_id, 'editorial_reference.manual_saved', 'editorial_reference',
    country_key || coalesce(':' || nullif(writer_key, ''), ''),
    jsonb_build_object('source', 'manual')
  );
  perform public.append_public_build_outbox(
    'editorial_reference',
    country_key || coalesce(':' || nullif(writer_key, ''), ''),
    'editorial_reference.manual_saved',
    jsonb_build_object('source', 'manual')
  );
  return jsonb_build_object(
    'countryId', country_key, 'writerId', nullif(writer_key, ''), 'source', 'manual'
  );
end;
$$;

revoke all on function public.save_manual_editorial_reference(text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.save_manual_editorial_reference(text, text, text, text, text, text, text)
  to authenticated;

create or replace function public.sync_editorial_reference_catalog(
  p_countries jsonb,
  p_writers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  country_rows integer := 0;
  writer_rows integer := 0;
begin
  if actor_id is null or not public.is_staff(
    array['owner'::public.staff_role, 'admin'::public.staff_role]
  ) then
    raise exception using errcode = '42501', message = 'admin-required';
  end if;
  if jsonb_typeof(p_countries) <> 'array'
     or jsonb_typeof(p_writers) <> 'array'
     or jsonb_array_length(p_countries) not between 1 and 500
     or jsonb_array_length(p_writers) not between 1 and 5000 then
    raise exception using errcode = '22023', message = 'invalid-reference-catalog';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_countries) as entry(item)
    where jsonb_typeof(item) <> 'object'
       or not (item ?& array['id', 'nameRu'])
       or lower(btrim(item ->> 'id')) !~ '^[a-z0-9][a-z0-9_-]{1,119}$'
       or char_length(btrim(item ->> 'nameRu')) not between 1 and 240
  ) or exists (
    select 1 from jsonb_array_elements(p_writers) as entry(item)
    where jsonb_typeof(item) <> 'object'
       or not (item ?& array['countryId', 'id', 'nameRu'])
       or lower(btrim(item ->> 'countryId')) !~ '^[a-z0-9][a-z0-9_-]{1,119}$'
       or char_length(lower(btrim(item ->> 'id'))) not between 2 and 180
       or lower(btrim(item ->> 'id')) ~ '[[:space:][:cntrl:]/:]'
       or char_length(btrim(item ->> 'nameRu')) not between 1 and 300
  ) then
    raise exception using errcode = '22023', message = 'invalid-reference-catalog';
  end if;

  insert into public.editorial_countries (
    id, name_ru, name_en, iso_code, source, created_by, updated_by
  )
  select
    lower(btrim(item ->> 'id')),
    btrim(item ->> 'nameRu'),
    btrim(coalesce(item ->> 'nameEn', '')),
    nullif(upper(btrim(coalesce(item ->> 'isoCode', ''))), ''),
    'editorial-catalog', actor_id, actor_id
  from jsonb_array_elements(p_countries) as entry(item)
  on conflict (id) do update set
    name_ru = excluded.name_ru,
    name_en = excluded.name_en,
    iso_code = excluded.iso_code,
    source = case
      when editorial_countries.source = 'manual' then 'manual'
      else 'editorial-catalog'
    end,
    updated_by = actor_id
  where editorial_countries.source <> 'manual';
  get diagnostics country_rows = row_count;

  insert into public.editorial_writers (
    country_id, id, name_ru, name_en, source, created_by, updated_by
  )
  select
    lower(btrim(item ->> 'countryId')),
    lower(btrim(item ->> 'id')),
    btrim(item ->> 'nameRu'),
    btrim(coalesce(item ->> 'nameEn', '')),
    'editorial-catalog', actor_id, actor_id
  from jsonb_array_elements(p_writers) as entry(item)
  on conflict (country_id, id) do update set
    name_ru = excluded.name_ru,
    name_en = excluded.name_en,
    source = case
      when editorial_writers.source = 'manual' then 'manual'
      else 'editorial-catalog'
    end,
    updated_by = actor_id
  where editorial_writers.source <> 'manual';
  get diagnostics writer_rows = row_count;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor_id, 'editorial_reference.catalog_synchronized',
    'editorial_reference_catalog', 'code-owned',
    jsonb_build_object('countries', country_rows, 'writers', writer_rows)
  );
  perform public.append_public_build_outbox(
    'editorial_reference_catalog', 'code-owned',
    'editorial_reference.catalog_synchronized',
    jsonb_build_object('countries', country_rows, 'writers', writer_rows)
  );
  return jsonb_build_object('countries', country_rows, 'writers', writer_rows);
end;
$$;

revoke all on function public.sync_editorial_reference_catalog(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_editorial_reference_catalog(jsonb, jsonb)
  to authenticated;

-- Both the edition write and the primary handoff run in one transaction.
-- Locking the work serializes concurrent promotions; the existing partial
-- unique index remains the final invariant.
create or replace function public.update_book_edition_atomic(
  p_edition_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  existing public.book_editions%rowtype;
  saved public.book_editions%rowtype;
  target_work_id uuid;
  primary_state boolean;
begin
  if actor_id is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'staff-required';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
     or not (p_payload ?& array[
       'work_id', 'title', 'isbn_10', 'isbn_13', 'publisher',
       'publication_year', 'language', 'format', 'page_count', 'cover_url',
       'cover_source_url', 'cover_rights_status', 'license_name', 'license_url',
       'creator', 'rights_holder', 'rights_checked_at', 'source_url', 'is_primary'
     ])
     or exists (
       select 1 from jsonb_object_keys(p_payload) as key
       where key <> all(array[
         'work_id', 'title', 'isbn_10', 'isbn_13', 'publisher',
         'publication_year', 'language', 'format', 'page_count', 'cover_url',
         'cover_source_url', 'cover_rights_status', 'license_name', 'license_url',
         'creator', 'rights_holder', 'rights_checked_at', 'source_url', 'is_primary'
       ])
     ) then
    raise exception using errcode = '22023', message = 'invalid-edition-payload';
  end if;

  select * into existing from public.book_editions
  where id = p_edition_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'edition-not-found';
  end if;
  if existing.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'edition-version-conflict';
  end if;

  target_work_id := (p_payload ->> 'work_id')::uuid;
  primary_state := (p_payload ->> 'is_primary')::boolean;
  if target_work_id is distinct from existing.work_id then
    raise exception using errcode = '22023', message = 'edition-work-is-immutable';
  end if;
  perform 1 from public.literary_works where id = target_work_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'work-not-found';
  end if;

  if primary_state then
    update public.book_editions set is_primary = false
    where work_id = target_work_id
      and id <> p_edition_id and is_primary;
  end if;

  update public.book_editions set
    title = p_payload ->> 'title',
    isbn_10 = nullif(p_payload ->> 'isbn_10', ''),
    isbn_13 = nullif(p_payload ->> 'isbn_13', ''),
    publisher = p_payload ->> 'publisher',
    publication_year = nullif(p_payload ->> 'publication_year', '')::integer,
    language = p_payload ->> 'language',
    format = p_payload ->> 'format',
    page_count = nullif(p_payload ->> 'page_count', '')::integer,
    cover_url = nullif(p_payload ->> 'cover_url', ''),
    cover_source_url = nullif(p_payload ->> 'cover_source_url', ''),
    cover_rights_status = p_payload ->> 'cover_rights_status',
    license_name = p_payload ->> 'license_name',
    license_url = nullif(p_payload ->> 'license_url', ''),
    creator = p_payload ->> 'creator',
    rights_holder = p_payload ->> 'rights_holder',
    rights_checked_at = nullif(p_payload ->> 'rights_checked_at', '')::date,
    source_url = nullif(p_payload ->> 'source_url', ''),
    is_primary = primary_state
  where id = p_edition_id
  returning * into saved;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor_id, 'book_edition.updated', 'book_edition', saved.id::text,
    jsonb_build_object(
      'workId', saved.work_id, 'isbn10', saved.isbn_10,
      'isbn13', saved.isbn_13, 'primary', saved.is_primary,
      'atomicPrimaryHandoff', true
    )
  );
  return jsonb_build_object('id', saved.id, 'updatedAt', saved.updated_at);
end;
$$;

revoke all on function public.update_book_edition_atomic(uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_book_edition_atomic(uuid, timestamptz, jsonb)
  to authenticated;

create or replace function public.create_book_edition_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  saved public.book_editions%rowtype;
  target_work_id uuid;
  primary_state boolean;
begin
  if actor_id is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'staff-required';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
     or not (p_payload ?& array[
       'legacy_id', 'work_id', 'title', 'isbn_10', 'isbn_13', 'publisher',
       'publication_year', 'language', 'format', 'page_count', 'cover_url',
       'cover_source_url', 'cover_rights_status', 'license_name', 'license_url',
       'creator', 'rights_holder', 'rights_checked_at', 'source_url', 'is_primary',
       'metadata'
     ])
     or exists (
       select 1 from jsonb_object_keys(p_payload) as key
       where key <> all(array[
         'legacy_id', 'work_id', 'title', 'isbn_10', 'isbn_13', 'publisher',
         'publication_year', 'language', 'format', 'page_count', 'cover_url',
         'cover_source_url', 'cover_rights_status', 'license_name', 'license_url',
         'creator', 'rights_holder', 'rights_checked_at', 'source_url', 'is_primary',
         'metadata'
       ])
     )
     or jsonb_typeof(p_payload -> 'metadata') <> 'object' then
    raise exception using errcode = '22023', message = 'invalid-edition-payload';
  end if;

  target_work_id := (p_payload ->> 'work_id')::uuid;
  primary_state := (p_payload ->> 'is_primary')::boolean;
  perform 1 from public.literary_works where id = target_work_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'work-not-found';
  end if;
  if primary_state then
    update public.book_editions set is_primary = false
    where work_id = target_work_id and is_primary;
  end if;

  insert into public.book_editions (
    legacy_id, work_id, title, isbn_10, isbn_13, publisher,
    publication_year, language, format, page_count, cover_url,
    cover_source_url, cover_rights_status, license_name, license_url,
    creator, rights_holder, rights_checked_at, source_url, is_primary, metadata
  ) values (
    p_payload ->> 'legacy_id', target_work_id, p_payload ->> 'title',
    nullif(p_payload ->> 'isbn_10', ''), nullif(p_payload ->> 'isbn_13', ''),
    p_payload ->> 'publisher', nullif(p_payload ->> 'publication_year', '')::integer,
    p_payload ->> 'language', p_payload ->> 'format',
    nullif(p_payload ->> 'page_count', '')::integer,
    nullif(p_payload ->> 'cover_url', ''), nullif(p_payload ->> 'cover_source_url', ''),
    p_payload ->> 'cover_rights_status', p_payload ->> 'license_name',
    nullif(p_payload ->> 'license_url', ''), p_payload ->> 'creator',
    p_payload ->> 'rights_holder', nullif(p_payload ->> 'rights_checked_at', '')::date,
    nullif(p_payload ->> 'source_url', ''), primary_state, p_payload -> 'metadata'
  ) returning * into saved;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor_id, 'book_edition.created', 'book_edition', saved.id::text,
    jsonb_build_object(
      'workId', saved.work_id, 'isbn10', saved.isbn_10,
      'isbn13', saved.isbn_13, 'primary', saved.is_primary,
      'atomicPrimaryHandoff', true
    )
  );
  return jsonb_build_object('id', saved.id, 'updatedAt', saved.updated_at);
end;
$$;

revoke all on function public.create_book_edition_atomic(jsonb)
  from public, anon, authenticated;
grant execute on function public.create_book_edition_atomic(jsonb)
  to authenticated;

create or replace function public.get_data_studio_schema_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception using errcode = '42501', message = 'staff-required';
  end if;
  return jsonb_build_object(
    'version', '20260901_zz_data_studio_integrity',
    'countries', to_regclass('public.editorial_countries') is not null,
    'writers', to_regclass('public.editorial_writers') is not null,
    'forceRls',
      coalesce((
        select bool_and(c.relrowsecurity and c.relforcerowsecurity)
        from pg_catalog.pg_class c
        where c.oid = any(array[
          'public.editorial_countries'::regclass,
          'public.editorial_writers'::regclass
        ])
      ), false),
    'authenticatedSelectOnly',
      has_table_privilege('authenticated', 'public.editorial_countries', 'SELECT')
      and has_table_privilege('authenticated', 'public.editorial_writers', 'SELECT')
      and not has_table_privilege('authenticated', 'public.editorial_countries', 'INSERT')
      and not has_table_privilege('authenticated', 'public.editorial_countries', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.editorial_countries', 'DELETE')
      and not has_table_privilege('authenticated', 'public.editorial_countries', 'TRUNCATE')
      and not has_table_privilege('authenticated', 'public.editorial_writers', 'INSERT')
      and not has_table_privilege('authenticated', 'public.editorial_writers', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.editorial_writers', 'DELETE')
      and not has_table_privilege('authenticated', 'public.editorial_writers', 'TRUNCATE'),
    'directMutationClosed',
      not has_table_privilege('authenticated', 'public.editorial_countries', 'INSERT')
      and not has_table_privilege('authenticated', 'public.editorial_countries', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.editorial_countries', 'DELETE')
      and not has_table_privilege('authenticated', 'public.editorial_writers', 'INSERT')
      and not has_table_privilege('authenticated', 'public.editorial_writers', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.editorial_writers', 'DELETE'),
    'staffSelectPolicies',
      (select count(*) = 2
       from pg_catalog.pg_policies
       where schemaname = 'public'
         and tablename in ('editorial_countries', 'editorial_writers')
         and policyname in ('Staff read editorial countries', 'Staff read editorial writers')
         and cmd = 'SELECT'
         and roles = array['authenticated']::name[]
         and qual like '%is_staff%'),
    'validatedForeignKeys',
      (select count(*) = 4
       from pg_catalog.pg_constraint
       where conname in (
         'country_profile_overrides_country_reference_fk',
         'writer_profile_overrides_writer_reference_fk',
         'literary_works_writer_reference_fk',
         'book_import_candidates_writer_reference_fk'
       ) and contype = 'f' and convalidated),
    'ensureReferenceRpc',
      to_regprocedure('public.ensure_editorial_reference(text,text,text,text,text,text,text)') is not null
      and has_function_privilege('authenticated', 'public.ensure_editorial_reference(text,text,text,text,text,text,text)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.ensure_editorial_reference(text,text,text,text,text,text,text)', 'EXECUTE'),
    'manualReferenceRpc',
      to_regprocedure('public.save_manual_editorial_reference(text,text,text,text,text,text,text)') is not null
      and has_function_privilege('authenticated', 'public.save_manual_editorial_reference(text,text,text,text,text,text,text)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.save_manual_editorial_reference(text,text,text,text,text,text,text)', 'EXECUTE'),
    'catalogSyncRpc',
      to_regprocedure('public.sync_editorial_reference_catalog(jsonb,jsonb)') is not null
      and has_function_privilege('authenticated', 'public.sync_editorial_reference_catalog(jsonb,jsonb)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.sync_editorial_reference_catalog(jsonb,jsonb)', 'EXECUTE'),
    'manualReferencesValid',
      not exists (
        select 1 from public.editorial_countries
        where source = 'manual' and (
          id !~ '^[a-z0-9][a-z0-9_-]{1,119}$'
          or char_length(btrim(name_ru)) not between 1 and 240
          or (iso_code is not null and iso_code !~ '^[A-Z]{2,3}$')
        )
      ) and not exists (
        select 1 from public.editorial_writers w
        where w.source = 'manual' and (
          char_length(w.id) not between 2 and 180
          or w.id ~ '[[:space:][:cntrl:]/:]'
          or char_length(btrim(w.name_ru)) not between 1 and 300
          or not exists (
            select 1 from public.editorial_countries c where c.id = w.country_id
          )
        )
      ),
    'atomicEditionCreate',
      to_regprocedure('public.create_book_edition_atomic(jsonb)') is not null
      and has_function_privilege('authenticated', 'public.create_book_edition_atomic(jsonb)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.create_book_edition_atomic(jsonb)', 'EXECUTE'),
    'atomicEditionUpdate',
      to_regprocedure('public.update_book_edition_atomic(uuid,timestamptz,jsonb)') is not null
      and has_function_privilege('authenticated', 'public.update_book_edition_atomic(uuid,timestamptz,jsonb)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.update_book_edition_atomic(uuid,timestamptz,jsonb)', 'EXECUTE')
  );
end;
$$;

revoke all on function public.get_data_studio_schema_health()
  from public, anon, authenticated;
grant execute on function public.get_data_studio_schema_health() to authenticated;
