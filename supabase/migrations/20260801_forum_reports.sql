-- Native forum reports and moderation queue.
-- Apply after 20260801_reader_profiles_and_forum_votes.sql.

create table if not exists public.forum_reports (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('topic', 'reply')),
  subject_id uuid not null,
  subject_title text not null default '',
  subject_excerpt text not null default '',
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 10 and 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  unique (reporter_id, subject_type, subject_id)
);

create index if not exists forum_reports_open_idx
  on public.forum_reports(status, created_at desc);

create or replace function public.report_forum_item(
  p_subject_type text,
  p_subject_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  item_author_id uuid;
  item_title text := '';
  item_excerpt text := '';
  report_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_subject_type not in ('topic', 'reply') then
    raise exception 'Invalid forum subject';
  end if;
  if char_length(trim(p_reason)) not between 10 and 500 then
    raise exception 'Invalid report reason';
  end if;

  if p_subject_type = 'topic' then
    select author_id, title, left(body, 500)
      into item_author_id, item_title, item_excerpt
    from public.forum_topics
    where id = p_subject_id and status = 'published';
  else
    select author_id, 'Ответ в обсуждении', left(body, 500)
      into item_author_id, item_title, item_excerpt
    from public.forum_replies
    where id = p_subject_id and status = 'published';
  end if;

  if item_author_id is null then
    raise exception 'Forum item not found';
  end if;
  if item_author_id = current_user_id then
    raise exception 'Authors cannot report their own posts';
  end if;

  insert into public.forum_reports (
    subject_type,
    subject_id,
    subject_title,
    subject_excerpt,
    reporter_id,
    reason
  ) values (
    p_subject_type,
    p_subject_id,
    item_title,
    item_excerpt,
    current_user_id,
    trim(p_reason)
  )
  on conflict (reporter_id, subject_type, subject_id)
  do update set
    reason = excluded.reason,
    subject_title = excluded.subject_title,
    subject_excerpt = excluded.subject_excerpt,
    status = 'open',
    created_at = now(),
    resolved_at = null,
    resolved_by = null
  returning id into report_id;

  return report_id;
end;
$$;

create or replace function public.resolve_forum_report(
  p_report_id uuid,
  p_hide_item boolean
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  report_subject_type text;
  report_subject_id uuid;
begin
  if not public.is_community_moderator() then
    raise exception 'Moderator access required';
  end if;

  select subject_type, subject_id
    into report_subject_type, report_subject_id
  from public.forum_reports
  where id = p_report_id and status = 'open';

  if report_subject_id is null then
    raise exception 'Open report not found';
  end if;

  if p_hide_item and report_subject_type = 'topic' then
    update public.forum_topics set status = 'hidden', updated_at = now()
    where id = report_subject_id;
  elsif p_hide_item and report_subject_type = 'reply' then
    update public.forum_replies set status = 'hidden', updated_at = now()
    where id = report_subject_id;
  end if;

  update public.forum_reports
  set status = 'resolved', resolved_at = now(), resolved_by = (select auth.uid())
  where id = p_report_id;
end;
$$;

grant execute on function public.report_forum_item(text, uuid, text)
  to authenticated;
grant execute on function public.resolve_forum_report(uuid, boolean)
  to authenticated;

alter table public.forum_reports enable row level security;

drop policy if exists "Readers see their own forum reports"
  on public.forum_reports;
create policy "Readers see their own forum reports"
on public.forum_reports for select
to authenticated
using (
  reporter_id = (select auth.uid())
  or public.is_community_moderator()
);

