-- «Проба Пера»: защищённая CMS и редакционный контур.
-- Выполняется после базовой схемы supabase/schema.sql.

create extension if not exists pgcrypto;

do $$
begin
  create type public.staff_role as enum ('owner', 'admin', 'editor');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.article_status as enum (
    'draft',
    'review',
    'scheduled',
    'published',
    'hidden',
    'archived'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.page_status as enum ('draft', 'published', 'hidden');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.staff_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.staff_role not null default 'editor',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_staff(
  allowed_roles public.staff_role[] default array[
    'owner'::public.staff_role,
    'admin'::public.staff_role,
    'editor'::public.staff_role
  ]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_memberships
    where user_id = (select auth.uid())
      and role = any(allowed_roles)
  );
$$;

revoke all on function public.is_staff(public.staff_role[]) from public;
grant execute on function public.is_staff(public.staff_role[]) to authenticated;

-- Роль сообщества больше не берётся из саморедактируемого профиля.
create or replace function public.is_community_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff();
$$;

-- Профиль можно редактировать самостоятельно, но роль сообщества - только
-- через доверенный серверный контур. Одной RLS для защиты отдельного столбца
-- недостаточно, поэтому права выдаются только на безопасные поля.
revoke update on public.profiles from authenticated;
grant update(display_name, avatar_url, bio) on public.profiles to authenticated;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '',
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,119}$'),
  parent_id uuid references public.categories(id) on delete set null,
  image_url text,
  seo_title text check (char_length(seo_title) <= 180),
  seo_description text check (char_length(seo_description) <= 400),
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'editorial-media',
  object_path text not null unique,
  original_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 26214400),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  alt_text text not null default '' check (char_length(alt_text) <= 500),
  caption text not null default '' check (char_length(caption) <= 1000),
  creator text not null default '',
  source_url text,
  license_name text not null default '',
  license_url text,
  focus_x numeric(5,4) not null default 0.5 check (focus_x between 0 and 1),
  focus_y numeric(5,4) not null default 0.5 check (focus_y between 0 and 1),
  collection_name text not null default 'Общее',
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title text not null check (char_length(title) between 3 and 240),
  subtitle text not null default '' check (char_length(subtitle) <= 360),
  excerpt text not null default '' check (char_length(excerpt) <= 700),
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_html text not null default '',
  cover_media_id uuid references public.media_assets(id) on delete set null,
  cover_external_url text,
  cover_alt text not null default '' check (char_length(cover_alt) <= 500),
  category_id uuid references public.categories(id) on delete set null,
  author_id uuid references auth.users(id) on delete set null,
  status public.article_status not null default 'draft',
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,179}$'),
  legacy_path text unique check (legacy_path is null or legacy_path like '/%'),
  published_at timestamptz,
  scheduled_at timestamptz,
  featured boolean not null default false,
  show_on_homepage boolean not null default false,
  pinned boolean not null default false,
  related_article_id uuid references public.articles(id) on delete set null,
  sources jsonb not null default '[]'::jsonb,
  bibliography jsonb not null default '[]'::jsonb,
  seo_title text check (char_length(seo_title) <= 180),
  seo_description text check (char_length(seo_description) <= 400),
  seo_keywords text[] not null default '{}',
  canonical_url text,
  og_title text check (char_length(og_title) <= 180),
  og_description text check (char_length(og_description) <= 400),
  og_media_id uuid references public.media_assets(id) on delete set null,
  allow_indexing boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    status <> 'scheduled'
    or scheduled_at is not null
  ),
  check (
    status <> 'published'
    or published_at is not null
  )
);

create table if not exists public.article_tags (
  article_id uuid not null references public.articles(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (article_id, tag_id)
);

create table if not exists public.article_revisions (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles(id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  change_summary text not null default '',
  created_at timestamptz not null default now(),
  unique (article_id, revision_number)
);

create table if not exists public.media_usages (
  media_id uuid not null references public.media_assets(id) on delete cascade,
  entity_type text not null check (
    entity_type in ('article', 'page', 'banner', 'homepage', 'category')
  ),
  entity_id uuid not null,
  field_name text not null default 'content',
  created_at timestamptz not null default now(),
  primary key (media_id, entity_type, entity_id, field_name)
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,119}$'),
  excerpt text not null default '',
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_html text not null default '',
  status public.page_status not null default 'draft',
  seo_title text,
  seo_description text,
  canonical_url text,
  allow_indexing boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.page_revisions (
  id bigint generated always as identity primary key,
  page_id uuid not null references public.pages(id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (page_id, revision_number)
);

create table if not exists public.homepage_blocks (
  id uuid primary key default gen_random_uuid(),
  block_type text not null check (
    block_type in (
      'hero',
      'article-grid',
      'carousel',
      'editors-choice',
      'popular',
      'latest',
      'categories',
      'book-vs-screen',
      'literary-map',
      'awards',
      'subscription',
      'text'
    )
  ),
  title text not null default '',
  settings jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  is_enabled boolean not null default true,
  background_style text not null default 'light' check (
    background_style in ('light', 'violet', 'orange', 'paper', 'transparent')
  ),
  background_media_id uuid references public.media_assets(id) on delete set null,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  desktop_media_id uuid references public.media_assets(id) on delete set null,
  tablet_media_id uuid references public.media_assets(id) on delete set null,
  mobile_media_id uuid references public.media_assets(id) on delete set null,
  title text not null default '',
  description text not null default '',
  target_url text,
  button_text text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  display_order integer not null default 0,
  is_active boolean not null default false,
  page_patterns text[] not null default array['/'],
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.navigation_menus (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text not null unique check (location in ('header', 'footer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.navigation_menus(id) on delete cascade,
  parent_id uuid references public.navigation_items(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 100),
  href text not null,
  open_in_new_tab boolean not null default false,
  is_visible boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique check (source_path like '/%'),
  destination_path text not null check (destination_path like '/%' or destination_path ~ '^https://'),
  status_code smallint not null default 301 check (status_code in (301, 302, 307, 308)),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.publication_jobs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete cascade,
  run_at timestamptz not null,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed', 'cancelled')
  ),
  last_error text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_status_published_idx
  on public.articles(status, published_at desc)
  where deleted_at is null;
create index if not exists articles_category_idx
  on public.articles(category_id, published_at desc)
  where deleted_at is null;
create index if not exists articles_updated_idx on public.articles(updated_at desc);
create index if not exists articles_scheduled_idx
  on public.articles(scheduled_at)
  where status = 'scheduled' and deleted_at is null;
create index if not exists article_revisions_article_idx
  on public.article_revisions(article_id, revision_number desc);
create index if not exists media_assets_created_idx
  on public.media_assets(created_at desc)
  where deleted_at is null;
create index if not exists admin_audit_created_idx
  on public.admin_audit_log(created_at desc);
create index if not exists publication_jobs_run_idx
  on public.publication_jobs(run_at)
  where status = 'pending';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.capture_article_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision integer;
begin
  if old is not distinct from new then
    return new;
  end if;

  select coalesce(max(revision_number), 0) + 1
  into next_revision
  from public.article_revisions
  where article_id = old.id;

  insert into public.article_revisions (
    article_id,
    revision_number,
    snapshot,
    changed_by
  )
  values (
    old.id,
    next_revision,
    to_jsonb(old),
    coalesce(new.updated_by, (select auth.uid()))
  );

  return new;
end;
$$;

drop trigger if exists articles_capture_revision on public.articles;
create trigger articles_capture_revision
  before update on public.articles
  for each row execute function public.capture_article_revision();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'staff_memberships',
    'categories',
    'media_assets',
    'articles',
    'pages',
    'homepage_blocks',
    'banners',
    'navigation_menus',
    'navigation_items',
    'redirects',
    'publication_jobs'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end
$$;

alter table public.staff_memberships enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.media_assets enable row level security;
alter table public.articles enable row level security;
alter table public.article_tags enable row level security;
alter table public.article_revisions enable row level security;
alter table public.media_usages enable row level security;
alter table public.pages enable row level security;
alter table public.page_revisions enable row level security;
alter table public.homepage_blocks enable row level security;
alter table public.banners enable row level security;
alter table public.navigation_menus enable row level security;
alter table public.navigation_items enable row level security;
alter table public.redirects enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.publication_jobs enable row level security;

create policy "Staff read their membership"
on public.staff_memberships for select
to authenticated
using (user_id = (select auth.uid()) or public.is_staff(array['owner'::public.staff_role]));

create policy "Owners manage staff"
on public.staff_memberships for all
to authenticated
using (public.is_staff(array['owner'::public.staff_role]))
with check (public.is_staff(array['owner'::public.staff_role]));

create policy "Public read visible categories"
on public.categories for select
to anon, authenticated
using (is_visible);

create policy "Staff manage categories"
on public.categories for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Public read tags"
on public.tags for select
to anon, authenticated
using (true);

create policy "Staff manage tags"
on public.tags for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Public read active media metadata"
on public.media_assets for select
to anon, authenticated
using (deleted_at is null);

create policy "Staff create media metadata"
on public.media_assets for insert
to authenticated
with check (public.is_staff() and uploaded_by = (select auth.uid()));

create policy "Staff update media metadata"
on public.media_assets for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Staff delete media metadata"
on public.media_assets for delete
to authenticated
using (public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role]));

create policy "Public read published articles"
on public.articles for select
to anon, authenticated
using (
  (
    status = 'published'
    and published_at <= now()
    and deleted_at is null
  )
);

create policy "Staff create articles"
on public.articles for insert
to authenticated
with check (
  public.is_staff()
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy "Staff update articles"
on public.articles for update
to authenticated
using (public.is_staff())
with check (public.is_staff() and updated_by = (select auth.uid()));

create policy "Owners and admins delete articles"
on public.articles for delete
to authenticated
using (public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role]));

create policy "Public read published article tags"
on public.article_tags for select
to anon, authenticated
using (
  exists (
    select 1 from public.articles
    where id = article_id
      and status = 'published'
      and published_at <= now()
      and deleted_at is null
  )
);

create policy "Staff manage article tags"
on public.article_tags for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Staff read revisions"
on public.article_revisions for select
to authenticated
using (public.is_staff());

create policy "Staff manage media usage"
on public.media_usages for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Public read published pages"
on public.pages for select
to anon, authenticated
using (
  (status = 'published' and deleted_at is null)
);

create policy "Staff manage pages"
on public.pages for all
to authenticated
using (public.is_staff())
with check (
  public.is_staff()
  and created_by is not null
  and updated_by = (select auth.uid())
);

create policy "Staff read page revisions"
on public.page_revisions for select
to authenticated
using (public.is_staff());

create policy "Public read enabled homepage blocks"
on public.homepage_blocks for select
to anon, authenticated
using (is_enabled);

create policy "Staff manage homepage blocks"
on public.homepage_blocks for all
to authenticated
using (public.is_staff())
with check (public.is_staff() and updated_by = (select auth.uid()));

create policy "Public read active banners"
on public.banners for select
to anon, authenticated
using (
  (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  )
);

create policy "Staff manage banners"
on public.banners for all
to authenticated
using (public.is_staff())
with check (
  public.is_staff()
  and created_by is not null
  and updated_by = (select auth.uid())
);

create policy "Public read navigation menus"
on public.navigation_menus for select
to anon, authenticated
using (true);

create policy "Staff manage navigation menus"
on public.navigation_menus for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Public read visible navigation items"
on public.navigation_items for select
to anon, authenticated
using (is_visible);

create policy "Staff manage navigation items"
on public.navigation_items for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Public read active redirects"
on public.redirects for select
to anon, authenticated
using (is_active);

create policy "Staff manage redirects"
on public.redirects for all
to authenticated
using (public.is_staff())
with check (
  public.is_staff()
  and created_by = (select auth.uid())
);

create policy "Staff read audit log"
on public.admin_audit_log for select
to authenticated
using (public.is_staff());

create policy "Staff append audit log"
on public.admin_audit_log for insert
to authenticated
with check (public.is_staff() and actor_id = (select auth.uid()));

create policy "Staff manage publication jobs"
on public.publication_jobs for all
to authenticated
using (public.is_staff())
with check (
  public.is_staff()
  and created_by = (select auth.uid())
);

-- Публичная корзина Storage: читать можно всем, изменять - только редакции.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'editorial-media',
  'editorial-media',
  true,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public read editorial media"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'editorial-media');

create policy "Staff upload editorial media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'editorial-media' and public.is_staff());

create policy "Staff update editorial media"
on storage.objects for update
to authenticated
using (bucket_id = 'editorial-media' and public.is_staff())
with check (bucket_id = 'editorial-media' and public.is_staff());

create policy "Owners and admins delete editorial media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'editorial-media'
  and public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role])
);

insert into public.navigation_menus (name, location)
values
  ('Верхнее меню', 'header'),
  ('Меню подвала', 'footer')
on conflict (location) do nothing;

insert into public.categories (name, slug, description, display_order)
values
  ('Мнение о книге', 'book-opinions', 'Авторские рецензии и размышления о книгах.', 10),
  ('Книга и экранизация', 'screen-adaptations', 'Сравнение литературного текста и экранной версии.', 20),
  ('Писатели мира', 'writers-world', 'Биографии, судьбы и литературные маршруты.', 30),
  ('Книжный гид и подборки', 'book-guides', 'Тематические подборки и рекомендации.', 40),
  ('Литературные премии', 'awards', 'История наград, лауреаты и произведения.', 50),
  ('Фольклор и мифология', 'folklore', 'Мифы, легенды и устная традиция.', 60),
  ('Русский язык', 'language', 'Редкие слова, история и культура речи.', 70),
  ('О литературе и культуре', 'literary-essays', 'Эссе о литературе и культурных явлениях.', 80),
  ('Литературные истории', 'author-stories', 'Профессии писателей и необычные истории.', 90)
on conflict (slug) do nothing;

-- Первый владелец назначается вручную после регистрации:
-- insert into public.staff_memberships (user_id, role)
-- select id, 'owner' from auth.users where email = 'owner@example.com';
