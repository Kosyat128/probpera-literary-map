-- Phase 8: make the last-owner invariant a database boundary.
-- Staff membership writes are possible only through the two owner RPCs below.

alter table public.staff_memberships enable row level security;
alter table public.staff_memberships force row level security;

drop policy if exists "Owners manage staff" on public.staff_memberships;
drop policy if exists "Staff read their membership" on public.staff_memberships;
create policy "Staff read their membership"
on public.staff_memberships for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_staff(array['owner'::public.staff_role])
);

revoke all on table public.staff_memberships from public, anon, authenticated;
grant select on table public.staff_memberships to authenticated;

create or replace function public.owner_set_staff_member(
  p_email text,
  p_role public.staff_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  target_user_id uuid;
  current_role public.staff_role;
  owner_count integer;
begin
  -- Serialize every owner-changing operation, including changes to different rows.
  perform pg_advisory_xact_lock(188654771, 1);

  if actor_user_id is null
    or not public.is_staff(array['owner'::public.staff_role]) then
    raise exception using errcode = 'P0001', message = 'STAFF_OWNER_REQUIRED';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if target_user_id is null then
    raise exception using errcode = 'P0001', message = 'STAFF_USER_NOT_REGISTERED';
  end if;

  select role into current_role
  from public.staff_memberships
  where user_id = target_user_id
  for update;

  if current_role = 'owner'::public.staff_role
    and p_role <> 'owner'::public.staff_role then
    select count(*) into owner_count
    from public.staff_memberships
    where role = 'owner'::public.staff_role;
    if owner_count <= 1 then
      raise exception using errcode = 'P0001', message = 'STAFF_LAST_OWNER';
    end if;
  end if;

  insert into public.staff_memberships (user_id, role, created_by)
  values (target_user_id, p_role, actor_user_id)
  on conflict (user_id) do update
  set role = excluded.role,
      updated_at = now();

  insert into public.admin_audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    actor_user_id,
    'staff.updated',
    'staff',
    target_user_id::text,
    jsonb_build_object(
      'email', lower(btrim(p_email)),
      'previous_role', current_role,
      'role', p_role
    )
  );

  return target_user_id;
end;
$$;

create or replace function public.owner_remove_staff_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  target_role public.staff_role;
  owner_count integer;
begin
  perform pg_advisory_xact_lock(188654771, 1);

  if actor_user_id is null
    or not public.is_staff(array['owner'::public.staff_role]) then
    raise exception using errcode = 'P0001', message = 'STAFF_OWNER_REQUIRED';
  end if;
  if p_user_id = actor_user_id then
    raise exception using errcode = 'P0001', message = 'STAFF_SELF_REMOVE_FORBIDDEN';
  end if;

  select role into target_role
  from public.staff_memberships
  where user_id = p_user_id
  for update;

  if target_role is null then
    raise exception using errcode = 'P0001', message = 'STAFF_MEMBER_NOT_FOUND';
  end if;

  if target_role = 'owner'::public.staff_role then
    select count(*) into owner_count
    from public.staff_memberships
    where role = 'owner'::public.staff_role;
    if owner_count <= 1 then
      raise exception using errcode = 'P0001', message = 'STAFF_LAST_OWNER';
    end if;
  end if;

  delete from public.staff_memberships where user_id = p_user_id;

  insert into public.admin_audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    actor_user_id,
    'staff.removed',
    'staff',
    p_user_id::text,
    jsonb_build_object('previous_role', target_role)
  );
end;
$$;

revoke all on function public.owner_set_staff_member(text, public.staff_role)
  from public, anon, authenticated;
revoke all on function public.owner_remove_staff_member(uuid)
  from public, anon, authenticated;
grant execute on function public.owner_set_staff_member(text, public.staff_role)
  to authenticated;
grant execute on function public.owner_remove_staff_member(uuid)
  to authenticated;
