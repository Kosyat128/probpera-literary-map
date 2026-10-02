-- Local preparation only. Apply through the separately authorized canonical DB
-- workflow. This supplements existing owner policies rather than replacing them.
-- Supabase access JWTs can outlive logout/deletion; private reader Data API access
-- must independently require its signed JWT session_id in live auth.sessions.
create schema if not exists planet_private;
revoke all on schema planet_private from public, anon;
grant usage on schema planet_private to authenticated;

create function planet_private.reader_session_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    auth.uid() is not null
    and auth.jwt()->>'role' = 'authenticated'
    and coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'true'
    and pg_catalog.jsonb_typeof(auth.jwt()->'exp') = 'number'
    and case when auth.jwt()->>'exp' ~ '^[0-9]{1,12}$'
      then (auth.jwt()->>'exp')::bigint > extract(epoch from pg_catalog.now()) else false end
    and case when auth.jwt()->>'session_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then exists(select 1 from auth.sessions s join auth.users u on u.id = s.user_id
        where s.id = (auth.jwt()->>'session_id')::uuid and s.user_id = auth.uid()
        and (pg_catalog.to_jsonb(s)->>'not_after' is null or (pg_catalog.to_jsonb(s)->>'not_after')::timestamptz > pg_catalog.now()))
      else false end
    and not exists(select 1 from public.planet_deletion_requests r where r.user_id = auth.uid())
    and not exists(select 1 from public.planet_access_state a where a.user_id = auth.uid() and a.access_blocked_at is not null), false);
$$;
revoke all on function planet_private.reader_session_active() from public, anon, service_role;
grant execute on function planet_private.reader_session_active() to authenticated;

-- No arguments or metadata can choose another user/session. The browser sends
-- its exact captured bearer token; verified PostgREST claims bind this read.
-- The result reveals only the caller's admission state, no private rows/IDs.
create function public.planet_reader_session_active()
returns boolean language sql stable set search_path = '' as $$
  select planet_private.reader_session_active();
$$;
revoke all on function public.planet_reader_session_active() from public, anon, service_role;
grant execute on function public.planet_reader_session_active() to authenticated;

-- These existing tables contain private reader data. Public books, editions,
-- author/editorial materials and public community profile views stay untouched.
do $$ declare relation text; begin
  foreach relation in array array['reader_favorites','reader_progress','reader_subscriptions',
    'reader_book_collections','reader_book_collection_items','reader_book_favorites'] loop
    execute format('alter table public.%I enable row level security', relation);
    execute format('create policy planet_reader_live_session_fence on public.%I as restrictive for all to authenticated
      using (user_id = (select auth.uid()) and (select planet_private.reader_session_active()))
      with check (user_id = (select auth.uid()) and (select planet_private.reader_session_active()))', relation);
  end loop;
end $$;

-- Staff may create a notification addressed to another reader. Keep that
-- existing INSERT contract, while reads and updates stay private to its owner.
create policy planet_notification_live_session_select on public.reader_notifications as restrictive for select to authenticated
  using (user_id = (select auth.uid()) and (select planet_private.reader_session_active()));
create policy planet_notification_live_session_update on public.reader_notifications as restrictive for update to authenticated
  using (user_id = (select auth.uid()) and (select planet_private.reader_session_active()))
  with check (user_id = (select auth.uid()) and (select planet_private.reader_session_active()));
create policy planet_notification_live_session_insert on public.reader_notifications as restrictive for insert to authenticated
  with check ((select planet_private.reader_session_active()));

-- Fence every accepted request under the same subject lock used by request
-- creation and licensing, before a scheduled processor has claimed the job.
-- The processor's guarded delete path does not use this reader mutation fence.
create or replace function public.planet_assert_reader_not_deleting(p_subject uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_subject is null then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array('planet/subject', p_subject)::text,0));
  if exists (select 1 from public.planet_deletion_requests where user_id=p_subject) then
    raise exception using errcode='P0001', message='PLANET_READER_DELETION_FENCED';
  end if;
end;
$$;
revoke all on function public.planet_assert_reader_not_deleting(uuid) from public, anon, authenticated;

-- The existing client uses upsert for an already followed subject. UPDATE needs
-- SELECT plus both owner predicates; no user can assign that row to another user.
grant update on public.reader_subscriptions to authenticated;
create policy "Readers update their own subscriptions" on public.reader_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Public profile read access is an intentional community contract. Its mutations
-- still require the caller's live non-deleting session in addition to the existing
-- own-profile/staff policies; this grants no new profile or administrative rights.
create policy planet_profile_live_session_insert on public.profiles as restrictive for insert to authenticated
  with check ((select planet_private.reader_session_active()));
create policy planet_profile_live_session_update on public.profiles as restrictive for update to authenticated
  using ((select planet_private.reader_session_active())) with check ((select planet_private.reader_session_active()));
create policy planet_profile_live_session_delete on public.profiles as restrictive for delete to authenticated
  using ((select planet_private.reader_session_active()));
