-- Reader profiles, avatar storage and forum reputation.
-- Apply after the community foundation and community safety migrations.

alter table public.profiles
  add column if not exists reputation integer not null default 0
    check (reputation >= 0),
  add column if not exists favorite_country_codes text[] not null default '{}',
  add column if not exists favorite_writer_ids text[] not null default '{}';

alter table public.forum_topics
  add column if not exists score integer not null default 0;

alter table public.forum_replies
  add column if not exists score integer not null default 0;

create table if not exists public.community_votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.profiles(id) on delete cascade,
  subject_type text not null check (subject_type in ('topic', 'reply')),
  subject_id uuid not null,
  score smallint not null check (score in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (voter_id, subject_type, subject_id)
);

create index if not exists community_votes_subject_idx
  on public.community_votes(subject_type, subject_id);

create or replace function public.vote_forum_item(
  p_subject_type text,
  p_subject_id uuid,
  p_score smallint
)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  item_author_id uuid;
  previous_score smallint := 0;
  score_delta integer;
  updated_score integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_subject_type not in ('topic', 'reply') or p_score not in (-1, 1) then
    raise exception 'Invalid vote';
  end if;

  if p_subject_type = 'topic' then
    select author_id into item_author_id
    from public.forum_topics
    where id = p_subject_id and status = 'published';
  else
    select author_id into item_author_id
    from public.forum_replies
    where id = p_subject_id and status = 'published';
  end if;

  if item_author_id is null then
    raise exception 'Forum item not found';
  end if;
  if item_author_id = current_user_id then
    raise exception 'Authors cannot vote for their own posts';
  end if;

  select score into previous_score
  from public.community_votes
  where voter_id = current_user_id
    and subject_type = p_subject_type
    and subject_id = p_subject_id;
  previous_score := coalesce(previous_score, 0);

  if previous_score = p_score then
    delete from public.community_votes
    where voter_id = current_user_id
      and subject_type = p_subject_type
      and subject_id = p_subject_id;
    score_delta := -previous_score;
  else
    insert into public.community_votes (
      voter_id,
      subject_type,
      subject_id,
      score
    ) values (
      current_user_id,
      p_subject_type,
      p_subject_id,
      p_score
    )
    on conflict (voter_id, subject_type, subject_id)
    do update set score = excluded.score, updated_at = now();
    score_delta := p_score - previous_score;
  end if;

  if p_subject_type = 'topic' then
    update public.forum_topics
    set score = score + score_delta, updated_at = now()
    where id = p_subject_id
    returning score into updated_score;
  else
    update public.forum_replies
    set score = score + score_delta, updated_at = now()
    where id = p_subject_id
    returning score into updated_score;
  end if;

  update public.profiles
  set reputation = greatest(0, reputation + score_delta), updated_at = now()
  where id = item_author_id;

  return coalesce(updated_score, 0);
end;
$$;

grant execute on function public.vote_forum_item(text, uuid, smallint)
  to authenticated;

alter table public.community_votes enable row level security;

drop policy if exists "Readers see their own forum votes"
  on public.community_votes;
create policy "Readers see their own forum votes"
on public.community_votes for select
to authenticated
using (voter_id = (select auth.uid()));

-- A reader may edit only public profile fields. Roles and reputation remain
-- server-managed even when the reader owns the profile row.
revoke update on public.profiles from authenticated;
grant update (
  display_name,
  avatar_url,
  bio,
  favorite_country_codes,
  favorite_writer_ids,
  updated_at
) on public.profiles to authenticated;

-- Comments are written through the rate-limited security-definer function.
-- This prevents direct API inserts from bypassing link and frequency checks.
revoke insert on public.article_comments from anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public avatars are readable" on storage.objects;
create policy "Public avatars are readable"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'avatars');

drop policy if exists "Readers upload their own avatar" on storage.objects;
create policy "Readers upload their own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Readers update their own avatar" on storage.objects;
create policy "Readers update their own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Readers delete their own avatar" on storage.objects;
create policy "Readers delete their own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
