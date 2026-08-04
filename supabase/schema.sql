create extension if not exists pgcrypto;

create type public.community_role as enum ('reader', 'moderator', 'editor', 'admin');
create type public.publication_status as enum ('published', 'hidden', 'pending');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  avatar_url text,
  bio text check (char_length(bio) <= 1000),
  role public.community_role not null default 'reader',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 5 and 140),
  body text not null check (char_length(body) between 10 and 8000),
  category text not null check (char_length(category) between 2 and 80),
  status public.publication_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 2 and 4000),
  status public.publication_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_slug text not null check (char_length(article_slug) between 2 and 180),
  parent_id uuid references public.article_comments(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  guest_name text check (char_length(guest_name) between 2 and 80),
  session_id uuid not null,
  body text not null check (char_length(body) between 2 and 4000),
  status public.publication_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (author_id is not null or guest_name is not null)
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('article', 'book')),
  subject_id text not null check (char_length(subject_id) between 2 and 180),
  user_id uuid references public.profiles(id) on delete set null,
  session_id uuid not null,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_views (
  id bigint generated always as identity primary key,
  path text not null check (char_length(path) between 1 and 320),
  session_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  referrer_host text check (char_length(referrer_host) <= 180),
  previous_path text check (char_length(previous_path) between 1 and 320),
  navigation_source text not null default 'direct' check (
    navigation_source in ('direct', 'internal', 'external', 'campaign')
  ),
  utm_source text check (char_length(utm_source) <= 120),
  utm_medium text check (char_length(utm_medium) <= 80),
  utm_campaign text check (char_length(utm_campaign) <= 180),
  created_at timestamptz not null default now()
);

create table public.reader_favorites (
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

create table public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.article_comments(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  session_id uuid not null,
  reason text not null check (char_length(reason) between 5 and 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index forum_topics_created_idx on public.forum_topics(created_at desc);
create index forum_replies_topic_idx on public.forum_replies(topic_id, created_at);
create index article_comments_slug_idx on public.article_comments(article_slug, created_at desc);
create index ratings_subject_idx on public.ratings(subject_type, subject_id);
create unique index ratings_user_unique_idx
  on public.ratings(subject_type, subject_id, user_id)
  where user_id is not null;
create unique index ratings_guest_unique_idx
  on public.ratings(subject_type, subject_id, session_id)
  where user_id is null;
create index content_views_created_idx on public.content_views(created_at desc);
create index content_views_path_idx on public.content_views(path, created_at desc);
create index content_views_normalized_path_idx
  on public.content_views (
    (split_part(split_part(path, '#', 1), '?', 1))
  );
create index reader_favorites_user_idx
  on public.reader_favorites(user_id, added_at desc);
create index comment_reports_created_idx on public.comment_reports(created_at desc);
create unique index comment_reports_session_unique_idx
  on public.comment_reports(comment_id, session_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_community_moderator()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('moderator', 'editor', 'admin')
  );
$$;

create or replace function public.rate_content(
  p_subject_type text,
  p_subject_id text,
  p_score smallint,
  p_session_id uuid
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_subject_type not in ('article', 'book')
    or char_length(p_subject_id) not between 2 and 180
    or p_score not between 1 and 5 then
    raise exception 'Invalid rating';
  end if;

  if (select auth.uid()) is null then
    update public.ratings
      set score = p_score, updated_at = now()
      where subject_type = p_subject_type
        and subject_id = p_subject_id
        and user_id is null
        and session_id = p_session_id;

    if not found then
      insert into public.ratings
        (subject_type, subject_id, user_id, session_id, score)
      values
        (p_subject_type, p_subject_id, null, p_session_id, p_score);
    end if;
  else
    update public.ratings
      set score = p_score, session_id = p_session_id, updated_at = now()
      where subject_type = p_subject_type
        and subject_id = p_subject_id
        and user_id = (select auth.uid());

    if not found then
      insert into public.ratings
        (subject_type, subject_id, user_id, session_id, score)
      values
        (p_subject_type, p_subject_id, (select auth.uid()), p_session_id, p_score);
    end if;
  end if;
end;
$$;

create or replace function public.get_rating_summary(
  p_subject_type text,
  p_subject_id text,
  p_session_id uuid
)
returns table (
  average_score numeric,
  rating_count bigint,
  my_score smallint
)
language sql
stable
security definer set search_path = ''
as $$
  select
    round(avg(score)::numeric, 2) as average_score,
    count(*) as rating_count,
    max(score) filter (
      where (
        (select auth.uid()) is not null
        and user_id = (select auth.uid())
      ) or (
        (select auth.uid()) is null
        and user_id is null
        and session_id = p_session_id
      )
    ) as my_score
  from public.ratings
  where subject_type = p_subject_type
    and subject_id = p_subject_id;
$$;

create or replace function public.get_content_view_count(p_paths text[])
returns bigint
language sql
stable
security definer set search_path = ''
as $$
  select count(*)
  from public.content_views
  where split_part(split_part(path, '#', 1), '?', 1)
    = any (p_paths[1:16]);
$$;

create or replace function public.submit_article_comment(
  p_article_slug text,
  p_session_id uuid,
  p_body text,
  p_guest_name text default null,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  new_comment_id uuid;
  current_user_id uuid := (select auth.uid());
  normalized_body text := btrim(p_body);
  normalized_guest_name text := nullif(btrim(p_guest_name), '');
  recent_comments integer;
  link_count integer;
begin
  if char_length(p_article_slug) not between 2 and 180
    or char_length(normalized_body) not between 2 and 4000 then
    raise exception 'Invalid comment';
  end if;

  if current_user_id is null
    and (
      normalized_guest_name is null
      or char_length(normalized_guest_name) not between 2 and 80
    ) then
    raise exception 'Guest name required';
  end if;

  select count(*) into recent_comments
  from public.article_comments
  where session_id = p_session_id
    and created_at > now() - interval '10 minutes';

  if recent_comments >= 4 then
    raise exception 'Too many comments';
  end if;

  select count(*) into link_count
  from regexp_matches(normalized_body, 'https?://', 'gi');

  if link_count > 3 then
    raise exception 'Too many links';
  end if;

  insert into public.article_comments (
    article_slug,
    parent_id,
    author_id,
    guest_name,
    session_id,
    body
  )
  values (
    p_article_slug,
    p_parent_id,
    current_user_id,
    case when current_user_id is null then normalized_guest_name else null end,
    p_session_id,
    normalized_body
  )
  returning id into new_comment_id;

  return new_comment_id;
end;
$$;

create or replace function public.report_article_comment(
  p_comment_id uuid,
  p_session_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if char_length(btrim(p_reason)) not between 5 and 500
    or not exists (
      select 1
      from public.article_comments
      where id = p_comment_id and status = 'published'
    ) then
    raise exception 'Invalid report';
  end if;

  insert into public.comment_reports (
    comment_id,
    reporter_id,
    session_id,
    reason
  )
  values (
    p_comment_id,
    (select auth.uid()),
    p_session_id,
    btrim(p_reason)
  )
  on conflict (comment_id, session_id) do nothing;
end;
$$;

create or replace function public.resolve_comment_report(
  p_report_id uuid,
  p_hide_comment boolean default false
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  reported_comment_id uuid;
begin
  if not public.is_community_moderator() then
    raise exception 'Moderator access required';
  end if;

  select comment_id into reported_comment_id
  from public.comment_reports
  where id = p_report_id and status = 'open';

  if reported_comment_id is null then
    raise exception 'Report not found';
  end if;

  if p_hide_comment then
    update public.article_comments
    set status = 'hidden', updated_at = now()
    where id = reported_comment_id;
  end if;

  update public.comment_reports
  set
    status = 'resolved',
    resolved_at = now(),
    resolved_by = (select auth.uid())
  where id = p_report_id;
end;
$$;

grant execute on function public.rate_content(text, text, smallint, uuid)
  to anon, authenticated;
grant execute on function public.get_rating_summary(text, text, uuid)
  to anon, authenticated;
grant execute on function public.get_content_view_count(text[])
  to anon, authenticated;
grant execute on function public.submit_article_comment(text, uuid, text, text, uuid)
  to anon, authenticated;
grant execute on function public.report_article_comment(uuid, uuid, text)
  to anon, authenticated;
grant execute on function public.resolve_comment_report(uuid, boolean)
  to authenticated;
grant select, insert, update, delete
  on public.reader_favorites
  to authenticated;

alter table public.profiles enable row level security;
alter table public.forum_topics enable row level security;
alter table public.forum_replies enable row level security;
alter table public.article_comments enable row level security;
alter table public.ratings enable row level security;
alter table public.content_views enable row level security;
alter table public.reader_favorites enable row level security;
alter table public.comment_reports enable row level security;

create policy "Public profiles are readable"
on public.profiles for select
to anon, authenticated
using (true);

create policy "Users update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Published topics are readable"
on public.forum_topics for select
to anon, authenticated
using (status = 'published' or author_id = (select auth.uid()) or public.is_community_moderator());

create policy "Authenticated users create topics"
on public.forum_topics for insert
to authenticated
with check ((select auth.uid()) = author_id);

create policy "Authors manage their topics"
on public.forum_topics for update
to authenticated
using (author_id = (select auth.uid()) or public.is_community_moderator())
with check (author_id = (select auth.uid()) or public.is_community_moderator());

create policy "Published replies are readable"
on public.forum_replies for select
to anon, authenticated
using (status = 'published' or author_id = (select auth.uid()) or public.is_community_moderator());

create policy "Authenticated users create replies"
on public.forum_replies for insert
to authenticated
with check ((select auth.uid()) = author_id);

create policy "Authors manage their replies"
on public.forum_replies for update
to authenticated
using (author_id = (select auth.uid()) or public.is_community_moderator())
with check (author_id = (select auth.uid()) or public.is_community_moderator());

create policy "Published comments are readable"
on public.article_comments for select
to anon, authenticated
using (status = 'published' or author_id = (select auth.uid()) or public.is_community_moderator());

create policy "Authenticated users create comments"
on public.article_comments for insert
to anon, authenticated
with check (
  (
    (select auth.uid()) is not null
    and (select auth.uid()) = author_id
    and guest_name is null
  ) or (
    (select auth.uid()) is null
    and author_id is null
    and guest_name is not null
  )
);

create policy "Authors manage their comments"
on public.article_comments for update
to authenticated
using (author_id = (select auth.uid()) or public.is_community_moderator())
with check (author_id = (select auth.uid()) or public.is_community_moderator());

create policy "Ratings are readable"
on public.ratings for select
to anon, authenticated
using (true);

create policy "Visitors record anonymous page views"
on public.content_views for insert
to anon, authenticated
with check (user_id is null or user_id = (select auth.uid()));

create policy "Editors read page views"
on public.content_views for select
to authenticated
using (public.is_community_moderator());

create policy "Readers view their own favorites"
on public.reader_favorites for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Readers create their own favorites"
on public.reader_favorites for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Readers update their own favorites"
on public.reader_favorites for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Readers delete their own favorites"
on public.reader_favorites for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "Editors read comment reports"
on public.comment_reports for select
to authenticated
using (public.is_community_moderator());

alter publication supabase_realtime add table
  public.forum_topics,
  public.forum_replies,
  public.article_comments,
  public.ratings;
