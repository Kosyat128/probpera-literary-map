create table if not exists public.comment_reports (
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

alter table public.comment_reports
  add column if not exists status text not null default 'open'
    check (status in ('open', 'resolved')),
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid
    references public.profiles(id) on delete set null;

create index if not exists comment_reports_created_idx
  on public.comment_reports(created_at desc);
create unique index if not exists comment_reports_session_unique_idx
  on public.comment_reports(comment_id, session_id);

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

grant execute on function public.submit_article_comment(text, uuid, text, text, uuid)
  to anon, authenticated;
grant execute on function public.report_article_comment(uuid, uuid, text)
  to anon, authenticated;
grant execute on function public.resolve_comment_report(uuid, boolean)
  to authenticated;

alter table public.comment_reports enable row level security;

drop policy if exists "Editors read comment reports" on public.comment_reports;
create policy "Editors read comment reports"
on public.comment_reports for select
to authenticated
using (public.is_community_moderator());
