-- Reader journey: library status, reading progress and first-party subscriptions.
-- This migration stores personal state only. Editorial country/book/article data
-- remains in the existing project sources and CMS.

alter table public.reader_favorites
  add column if not exists reading_status text not null default 'saved';

alter table public.reader_favorites
  drop constraint if exists reader_favorites_reading_status_check;
alter table public.reader_favorites
  add constraint reader_favorites_reading_status_check
  check (reading_status in ('saved', 'reading', 'finished'));

create table if not exists public.reader_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('article', 'book')),
  item_id text not null check (char_length(item_id) between 1 and 240),
  progress_percent smallint not null default 0
    check (progress_percent between 0 and 100),
  position_hint text check (char_length(position_hint) <= 240),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

create index if not exists reader_progress_recent_idx
  on public.reader_progress(user_id, updated_at desc);

alter table public.reader_progress enable row level security;

drop policy if exists "Readers view their own progress" on public.reader_progress;
create policy "Readers view their own progress"
on public.reader_progress for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Readers create their own progress" on public.reader_progress;
create policy "Readers create their own progress"
on public.reader_progress for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Readers update their own progress" on public.reader_progress;
create policy "Readers update their own progress"
on public.reader_progress for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Readers delete their own progress" on public.reader_progress;
create policy "Readers delete their own progress"
on public.reader_progress for delete to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.reader_progress to authenticated;

create table if not exists public.reader_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_type text not null check (subject_type in ('country', 'writer', 'section')),
  subject_id text not null check (char_length(subject_id) between 1 and 240),
  label text not null check (char_length(label) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (user_id, subject_type, subject_id)
);

create index if not exists reader_subscriptions_user_idx
  on public.reader_subscriptions(user_id, created_at desc);

alter table public.reader_subscriptions enable row level security;

drop policy if exists "Readers view their own subscriptions" on public.reader_subscriptions;
create policy "Readers view their own subscriptions"
on public.reader_subscriptions for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Readers create their own subscriptions" on public.reader_subscriptions;
create policy "Readers create their own subscriptions"
on public.reader_subscriptions for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Readers delete their own subscriptions" on public.reader_subscriptions;
create policy "Readers delete their own subscriptions"
on public.reader_subscriptions for delete to authenticated
using (user_id = (select auth.uid()));

grant select, insert, delete on public.reader_subscriptions to authenticated;

create table if not exists public.reader_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  body text not null check (char_length(body) between 1 and 1000),
  href text check (char_length(href) <= 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reader_notifications_unread_idx
  on public.reader_notifications(user_id, read_at, created_at desc);

alter table public.reader_notifications enable row level security;

drop policy if exists "Readers view their own notifications" on public.reader_notifications;
create policy "Readers view their own notifications"
on public.reader_notifications for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Readers update their own notifications" on public.reader_notifications;
create policy "Readers update their own notifications"
on public.reader_notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Staff create reader notifications" on public.reader_notifications;
create policy "Staff create reader notifications"
on public.reader_notifications for insert to authenticated
with check (public.is_staff());

grant select, update on public.reader_notifications to authenticated;
grant insert on public.reader_notifications to authenticated;
