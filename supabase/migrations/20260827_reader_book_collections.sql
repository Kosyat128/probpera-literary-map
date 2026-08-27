-- Stage 5D-2: private, account-owned book collections and favorites.
--
-- The existing reader_favorites and reader_progress contracts remain intact.
-- This book-specific model is deliberately private; public sharing requires a
-- later migration with its own authorization and moderation contract.

create table if not exists public.reader_book_collections (
  id text not null check (id ~ '^[A-Za-z0-9:_-]{1,192}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (
    char_length(name) between 1 and 120
    and name = btrim(name)
  ),
  description text check (char_length(description) between 1 and 800),
  collection_type text not null default 'manual' check (
    collection_type in ('system', 'manual', 'smart', 'editorial')
  ),
  system_type text check (
    system_type in ('library', 'want-to-read', 'reading', 'finished')
  ),
  visibility text not null default 'private' check (visibility = 'private'),
  background_preset text check (
    char_length(background_preset) between 1 and 80
    and background_preset ~ '^[a-z0-9][a-z0-9-]*$'
  ),
  dynamic_book_themes boolean not null default true,
  theme_intensity smallint not null default 70 check (
    theme_intensity between 0 and 100
  ),
  sort_mode text not null default 'editorial-relevance' check (
    sort_mode in (
      'editorial-relevance',
      'title',
      'writer',
      'oldest',
      'newest',
      'cover-first',
      'manual',
      'recent'
    )
  ),
  filter_state jsonb not null default '{}'::jsonb check (
    jsonb_typeof(filter_state) = 'object'
  ),
  schema_version smallint not null default 1 check (schema_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  check (
    (collection_type = 'system' and system_type is not null)
    or (collection_type <> 'system' and system_type is null)
  )
);

drop index if exists public.reader_book_collections_owner_name_unique_idx;
create index if not exists reader_book_collections_owner_updated_idx
  on public.reader_book_collections(user_id, updated_at desc, id);

create table if not exists public.reader_book_collection_items (
  collection_id text not null check (
    collection_id ~ '^[A-Za-z0-9:_-]{1,192}$'
  ),
  user_id uuid not null,
  book_key text not null check (char_length(book_key) between 1 and 240),
  position integer not null check (position between 0 and 999999),
  schema_version smallint not null default 1 check (schema_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reader_book_collection_items_owner_fk
    foreign key (user_id, collection_id)
    references public.reader_book_collections(user_id, id)
    on delete cascade,
  primary key (user_id, collection_id, book_key)
);

drop index if exists public.reader_book_collection_items_order_unique_idx;
create index if not exists reader_book_collection_items_order_idx
  on public.reader_book_collection_items(user_id, collection_id, position);
create index if not exists reader_book_collection_items_owner_updated_idx
  on public.reader_book_collection_items(
    user_id,
    updated_at desc,
    collection_id,
    book_key
  );

create table if not exists public.reader_book_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_key text not null check (char_length(book_key) between 1 and 240),
  schema_version smallint not null default 1 check (schema_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_key)
);

create index if not exists reader_book_favorites_owner_created_idx
  on public.reader_book_favorites(user_id, created_at desc, book_key);

create or replace function public.set_reader_book_state_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_reader_book_state_updated_at() from public;

drop trigger if exists reader_book_collections_set_updated_at
  on public.reader_book_collections;
create trigger reader_book_collections_set_updated_at
  before update on public.reader_book_collections
  for each row execute function public.set_reader_book_state_updated_at();

drop trigger if exists reader_book_collection_items_set_updated_at
  on public.reader_book_collection_items;
create trigger reader_book_collection_items_set_updated_at
  before update on public.reader_book_collection_items
  for each row execute function public.set_reader_book_state_updated_at();

drop trigger if exists reader_book_favorites_set_updated_at
  on public.reader_book_favorites;
create trigger reader_book_favorites_set_updated_at
  before update on public.reader_book_favorites
  for each row execute function public.set_reader_book_state_updated_at();

alter table public.reader_book_collections enable row level security;
alter table public.reader_book_collections force row level security;
alter table public.reader_book_collection_items enable row level security;
alter table public.reader_book_collection_items force row level security;
alter table public.reader_book_favorites enable row level security;
alter table public.reader_book_favorites force row level security;

revoke all on table public.reader_book_collections from public, anon;
revoke all on table public.reader_book_collection_items from public, anon;
revoke all on table public.reader_book_favorites from public, anon;

grant select, insert, update, delete
  on table public.reader_book_collections,
    public.reader_book_collection_items,
    public.reader_book_favorites
  to authenticated;
grant all
  on table public.reader_book_collections,
    public.reader_book_collection_items,
    public.reader_book_favorites
  to service_role;

drop policy if exists "Readers view their own book collections"
  on public.reader_book_collections;
create policy "Readers view their own book collections"
on public.reader_book_collections for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Readers create their own book collections"
  on public.reader_book_collections;
create policy "Readers create their own book collections"
on public.reader_book_collections for insert
to authenticated
with check (user_id = (select auth.uid()) and visibility = 'private');

drop policy if exists "Readers update their own book collections"
  on public.reader_book_collections;
create policy "Readers update their own book collections"
on public.reader_book_collections for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and visibility = 'private');

drop policy if exists "Readers delete their own book collections"
  on public.reader_book_collections;
create policy "Readers delete their own book collections"
on public.reader_book_collections for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Readers view their own book collection items"
  on public.reader_book_collection_items;
create policy "Readers view their own book collection items"
on public.reader_book_collection_items for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Readers create their own book collection items"
  on public.reader_book_collection_items;
create policy "Readers create their own book collection items"
on public.reader_book_collection_items for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Readers update their own book collection items"
  on public.reader_book_collection_items;
create policy "Readers update their own book collection items"
on public.reader_book_collection_items for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Readers delete their own book collection items"
  on public.reader_book_collection_items;
create policy "Readers delete their own book collection items"
on public.reader_book_collection_items for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Readers view their own book favorites"
  on public.reader_book_favorites;
create policy "Readers view their own book favorites"
on public.reader_book_favorites for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Readers create their own book favorites"
  on public.reader_book_favorites;
create policy "Readers create their own book favorites"
on public.reader_book_favorites for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Readers update their own book favorites"
  on public.reader_book_favorites;
create policy "Readers update their own book favorites"
on public.reader_book_favorites for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Readers delete their own book favorites"
  on public.reader_book_favorites;
create policy "Readers delete their own book favorites"
on public.reader_book_favorites for delete
to authenticated
using (user_id = (select auth.uid()));
