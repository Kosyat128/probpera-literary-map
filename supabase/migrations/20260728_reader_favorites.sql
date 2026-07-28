create table if not exists public.reader_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('article', 'book')),
  item_id text not null check (char_length(item_id) between 1 and 240),
  title text not null check (char_length(title) between 1 and 300),
  section_id text check (char_length(section_id) <= 120),
  section_label text not null check (char_length(section_label) between 1 and 240),
  href text check (char_length(href) <= 500),
  added_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

create index if not exists reader_favorites_user_idx
  on public.reader_favorites(user_id, added_at desc);

alter table public.reader_favorites enable row level security;

drop policy if exists "Readers view their own favorites"
  on public.reader_favorites;
create policy "Readers view their own favorites"
on public.reader_favorites for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Readers create their own favorites"
  on public.reader_favorites;
create policy "Readers create their own favorites"
on public.reader_favorites for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Readers update their own favorites"
  on public.reader_favorites;
create policy "Readers update their own favorites"
on public.reader_favorites for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Readers delete their own favorites"
  on public.reader_favorites;
create policy "Readers delete their own favorites"
on public.reader_favorites for delete
to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete
  on public.reader_favorites
  to authenticated;
