-- Bilingual, source-aware publication workflow for literary works.
-- Discovery imports land in book_import_candidates. Only reviewed works with
-- complete RU/EN editorial text and provenance are visible through public RLS.

create table if not exists public.literary_work_translations (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.literary_works(id) on delete cascade,
  locale text not null check (locale in ('ru', 'en')),
  title text not null check (char_length(title) between 1 and 300),
  description text not null check (char_length(description) between 140 and 900),
  source_language text not null check (char_length(source_language) between 2 and 40),
  translation_method text not null
    check (
      translation_method in (
        'editorial-original',
        'human-translation',
        'licensed-source'
      )
    ),
  editorial_status text not null default 'draft'
    check (editorial_status in ('draft', 'reviewed', 'verified')),
  source_urls text[] not null default '{}',
  reviewed_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, locale),
  check (
    editorial_status = 'draft'
    or (
      reviewed_at is not null
      and cardinality(source_urls) > 0
    )
  )
);

create table if not exists public.literary_work_sources (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.literary_works(id) on delete cascade,
  provider text not null check (char_length(provider) between 2 and 160),
  source_url text not null check (source_url ~ '^https://'),
  field_names text[] not null check (cardinality(field_names) > 0),
  license_name text,
  usage text not null
    check (usage in ('structured-data', 'reference-only', 'licensed-copy')),
  retrieved_at date not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, provider, source_url)
);

create table if not exists public.literary_work_external_ids (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.literary_works(id) on delete cascade,
  scheme text not null check (scheme ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  external_id text not null check (char_length(external_id) between 1 and 180),
  source_url text not null check (source_url ~ '^https://'),
  created_at timestamptz not null default now(),
  unique (scheme, external_id),
  unique (work_id, scheme, external_id)
);

create table if not exists public.book_import_candidates (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  external_id text not null check (char_length(external_id) between 1 and 180),
  country_id text not null check (char_length(country_id) between 2 and 120),
  writer_id text not null check (char_length(writer_id) between 2 and 180),
  writer_key text not null check (char_length(writer_key) between 3 and 320),
  title text not null check (char_length(title) between 1 and 300),
  source_url text not null check (source_url ~ '^https://'),
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  status text not null default 'candidate'
    check (status in ('candidate', 'rejected', 'reviewed', 'promoted')),
  rejection_reasons text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  promoted_work_id uuid references public.literary_works(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id),
  check (
    status not in ('reviewed', 'promoted')
    or (reviewed_by is not null and reviewed_at is not null)
  ),
  check (status <> 'promoted' or promoted_work_id is not null)
);

create index if not exists literary_work_translations_public_idx
  on public.literary_work_translations(work_id, locale, editorial_status);
create index if not exists literary_work_sources_work_idx
  on public.literary_work_sources(work_id);
create index if not exists literary_work_external_ids_work_idx
  on public.literary_work_external_ids(work_id);
create index if not exists book_import_candidates_queue_idx
  on public.book_import_candidates(status, quality_score desc, created_at);
create index if not exists book_import_candidates_writer_idx
  on public.book_import_candidates(writer_key, status);

drop trigger if exists literary_work_translations_set_updated_at
  on public.literary_work_translations;
create trigger literary_work_translations_set_updated_at
  before update on public.literary_work_translations
  for each row execute function public.set_updated_at();

drop trigger if exists literary_work_sources_set_updated_at
  on public.literary_work_sources;
create trigger literary_work_sources_set_updated_at
  before update on public.literary_work_sources
  for each row execute function public.set_updated_at();

drop trigger if exists book_import_candidates_set_updated_at
  on public.book_import_candidates;
create trigger book_import_candidates_set_updated_at
  before update on public.book_import_candidates
  for each row execute function public.set_updated_at();

alter table public.literary_work_translations enable row level security;
alter table public.literary_work_sources enable row level security;
alter table public.literary_work_external_ids enable row level security;
alter table public.book_import_candidates enable row level security;

create or replace function public.is_publishable_literary_work(target_work_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.literary_works as work
    where work.id = target_work_id
      and work.editorial_status in ('reviewed', 'verified')
      and exists (
        select 1
        from public.literary_work_sources as source
        where source.work_id = work.id
      )
      and not exists (
        select 1
        from public.literary_work_sources as source
        where source.work_id = work.id
          and (
            btrim(source.provider) = ''
            or source.source_url !~* '^https://'
            or cardinality(source.field_names) = 0
            or source.retrieved_at is null
          )
      )
      and 2 = (
        select count(distinct translation.locale)
        from public.literary_work_translations as translation
        where translation.work_id = work.id
          and translation.locale in ('ru', 'en')
          and translation.editorial_status in ('reviewed', 'verified')
          and translation.reviewed_at is not null
          and btrim(translation.title) <> ''
          and btrim(translation.source_language) <> ''
          and char_length(btrim(translation.description)) between 140 and 900
          and (
            select count(*)
            from regexp_matches(
              btrim(translation.description),
              '[.!?…]+([[:space:]]|$)',
              'g'
            )
          ) between 2 and 3
          and case
            when translation.locale = 'ru'
              then translation.description ~ '[А-Яа-яЁё]'
            when translation.locale = 'en'
              then translation.description ~ '[A-Za-z]'
                -- PostgreSQL ARE has no portable Unicode Script=Cyrillic class.
                -- Check every code point across the current Cyrillic blocks.
                and not exists (
                  select 1
                  from unnest(
                    string_to_array(
                      translation.title || translation.description,
                      null::text
                    )
                  ) as glyph(value)
                  where ascii(glyph.value) between 1024 and 1327
                    or ascii(glyph.value) between 7296 and 7311
                    or ascii(glyph.value) between 11744 and 11775
                    or ascii(glyph.value) between 42560 and 42655
                    or ascii(glyph.value) between 65070 and 65071
                    or ascii(glyph.value) between 122928 and 123023
                )
            else false
          end
          and position('Р°' in translation.description) = 0
          and position('Рµ' in translation.description) = 0
          and position('Рё' in translation.description) = 0
          and position('СЃ' in translation.description) = 0
          and position('С‚' in translation.description) = 0
          and position('вЂ' in translation.description) = 0
          and cardinality(translation.source_urls) > 0
          and not exists (
            select 1
            from unnest(translation.source_urls) as declared(source_url)
            where declared.source_url is null
              or btrim(declared.source_url) !~* '^https://'
              or not exists (
                select 1
                from public.literary_work_sources as source
                where source.work_id = translation.work_id
                  and source.source_url = btrim(declared.source_url)
              )
          )
          and (
            translation.translation_method <> 'licensed-source'
            or exists (
              select 1
              from unnest(translation.source_urls) as declared(source_url)
              join public.literary_work_sources as source
                on source.work_id = translation.work_id
               and source.source_url = btrim(declared.source_url)
              where source.usage = 'licensed-copy'
                and btrim(coalesce(source.license_name, '')) <> ''
            )
          )
      )
  );
$$;

revoke all on function public.is_publishable_literary_work(uuid) from public;
grant execute on function public.is_publishable_literary_work(uuid)
  to anon, authenticated;

drop policy if exists "Public read reviewed literary works"
  on public.literary_works;
drop policy if exists "Public read publishable literary works"
  on public.literary_works;
create policy "Public read publishable literary works"
on public.literary_works for select
to anon, authenticated
using (public.is_publishable_literary_work(id));

drop policy if exists "Public read publishable work translations"
  on public.literary_work_translations;
create policy "Public read publishable work translations"
on public.literary_work_translations for select
to anon, authenticated
using (public.is_publishable_literary_work(work_id));

drop policy if exists "Staff manage work translations"
  on public.literary_work_translations;
create policy "Staff manage work translations"
on public.literary_work_translations for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Public read publishable work sources"
  on public.literary_work_sources;
create policy "Public read publishable work sources"
on public.literary_work_sources for select
to anon, authenticated
using (public.is_publishable_literary_work(work_id));

drop policy if exists "Staff manage work sources"
  on public.literary_work_sources;
create policy "Staff manage work sources"
on public.literary_work_sources for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Public read publishable work external ids"
  on public.literary_work_external_ids;
create policy "Public read publishable work external ids"
on public.literary_work_external_ids for select
to anon, authenticated
using (public.is_publishable_literary_work(work_id));

drop policy if exists "Staff manage work external ids"
  on public.literary_work_external_ids;
create policy "Staff manage work external ids"
on public.literary_work_external_ids for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Staff manage book import candidates"
  on public.book_import_candidates;
create policy "Staff manage book import candidates"
on public.book_import_candidates for all
to authenticated
using (public.is_staff())
with check (public.is_staff());
