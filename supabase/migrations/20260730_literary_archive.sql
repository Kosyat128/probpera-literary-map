-- Нормализованный редакционный контур книжного архива.
-- Главным источником энциклопедических данных остаётся src/data/countries.
-- Эти таблицы дают CMS безопасный рабочий слой для проверки произведений,
-- конкретных изданий и ISBN без дублирования одной обложки на уровне произведения.

create table if not exists public.literary_works (
  id uuid primary key default gen_random_uuid(),
  legacy_id text not null unique check (char_length(legacy_id) between 2 and 180),
  country_id text not null check (char_length(country_id) between 2 and 120),
  writer_id text not null check (char_length(writer_id) between 2 and 180),
  title text not null check (char_length(title) between 1 and 300),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,179}$'),
  original_title text not null default '' check (char_length(original_title) <= 300),
  first_published integer check (first_published between -3000 and 2100),
  original_language text not null default '' check (char_length(original_language) <= 120),
  genres text[] not null default '{}',
  tags text[] not null default '{}',
  description text not null default '' check (char_length(description) <= 5000),
  source_url text,
  editorial_status text not null default 'draft'
    check (editorial_status in ('draft', 'reviewed', 'verified')),
  reviewed_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (writer_id, slug)
);

create table if not exists public.book_editions (
  id uuid primary key default gen_random_uuid(),
  legacy_id text not null unique check (char_length(legacy_id) between 2 and 240),
  work_id uuid not null references public.literary_works(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 300),
  isbn_10 text check (
    isbn_10 is null
    or regexp_replace(isbn_10, '[^0-9Xx]', '', 'g') ~ '^[0-9]{9}[0-9Xx]$'
  ),
  isbn_13 text check (
    isbn_13 is null
    or regexp_replace(isbn_13, '[^0-9]', '', 'g') ~ '^[0-9]{13}$'
  ),
  publisher text not null default '' check (char_length(publisher) <= 240),
  publication_year integer check (publication_year between 1400 and 2100),
  language text not null default '' check (char_length(language) <= 120),
  format text not null default '' check (char_length(format) <= 120),
  page_count integer check (page_count is null or page_count > 0),
  cover_url text,
  cover_source_url text,
  cover_rights_status text not null default 'unverified'
    check (
      cover_rights_status in (
        'public-domain',
        'licensed',
        'permission',
        'editorial-original',
        'external-preview',
        'unverified'
      )
    ),
  license_name text not null default '' check (char_length(license_name) <= 240),
  license_url text,
  creator text not null default '' check (char_length(creator) <= 240),
  rights_holder text not null default '' check (char_length(rights_holder) <= 240),
  rights_checked_at date,
  source_url text,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    cover_url is null
    or (
      cover_source_url is not null
      and cover_rights_status <> 'unverified'
      and rights_checked_at is not null
    )
  )
);

create unique index if not exists literary_works_country_legacy_idx
  on public.literary_works(country_id, legacy_id);

create index if not exists literary_works_writer_idx
  on public.literary_works(country_id, writer_id, editorial_status);

create index if not exists literary_works_search_idx
  on public.literary_works
  using gin (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(original_title, '') || ' ' ||
      coalesce(description, '')
    )
  );

create unique index if not exists book_editions_isbn_10_unique_idx
  on public.book_editions (
    regexp_replace(upper(isbn_10), '[^0-9X]', '', 'g')
  )
  where isbn_10 is not null;

create unique index if not exists book_editions_isbn_13_unique_idx
  on public.book_editions (
    regexp_replace(isbn_13, '[^0-9]', '', 'g')
  )
  where isbn_13 is not null;

create unique index if not exists book_editions_one_primary_idx
  on public.book_editions(work_id)
  where is_primary;

create index if not exists book_editions_work_idx
  on public.book_editions(work_id, publication_year desc);

drop trigger if exists literary_works_set_updated_at on public.literary_works;
create trigger literary_works_set_updated_at
  before update on public.literary_works
  for each row execute function public.set_updated_at();

drop trigger if exists book_editions_set_updated_at on public.book_editions;
create trigger book_editions_set_updated_at
  before update on public.book_editions
  for each row execute function public.set_updated_at();

alter table public.literary_works enable row level security;
alter table public.book_editions enable row level security;

create policy "Public read reviewed literary works"
on public.literary_works for select
to anon, authenticated
using (editorial_status in ('reviewed', 'verified') or public.is_staff());

create policy "Staff manage literary works"
on public.literary_works for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Public read verified book editions"
on public.book_editions for select
to anon, authenticated
using (
  (
    cover_url is null
    or (
      cover_rights_status <> 'unverified'
      and cover_source_url is not null
      and rights_checked_at is not null
    )
  )
  and exists (
    select 1
    from public.literary_works
    where literary_works.id = book_editions.work_id
      and literary_works.editorial_status in ('reviewed', 'verified')
  )
  or public.is_staff()
);

create policy "Staff manage book editions"
on public.book_editions for all
to authenticated
using (public.is_staff())
with check (public.is_staff());
