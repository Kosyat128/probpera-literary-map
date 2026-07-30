-- Owner-only staff management by email. The dashboard never receives a
-- service-role key and cannot enumerate auth.users.

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
  target_user_id uuid;
  current_role public.staff_role;
  owner_count integer;
begin
  if not public.is_staff(array['owner'::public.staff_role]) then
    raise exception 'Owner access required';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if target_user_id is null then
    raise exception 'User must register before being added to the editorial team';
  end if;

  select role into current_role
  from public.staff_memberships
  where user_id = target_user_id;

  if current_role = 'owner'::public.staff_role
    and p_role <> 'owner'::public.staff_role then
    select count(*) into owner_count
    from public.staff_memberships
    where role = 'owner'::public.staff_role;
    if owner_count <= 1 then
      raise exception 'The last owner cannot be demoted';
    end if;
  end if;

  insert into public.staff_memberships (user_id, role, created_by)
  values (target_user_id, p_role, (select auth.uid()))
  on conflict (user_id) do update
  set role = excluded.role, updated_at = now();

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
  target_role public.staff_role;
  owner_count integer;
begin
  if not public.is_staff(array['owner'::public.staff_role]) then
    raise exception 'Owner access required';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'Use another owner account to remove your own access';
  end if;

  select role into target_role
  from public.staff_memberships
  where user_id = p_user_id;

  if target_role = 'owner'::public.staff_role then
    select count(*) into owner_count
    from public.staff_memberships
    where role = 'owner'::public.staff_role;
    if owner_count <= 1 then
      raise exception 'The last owner cannot be removed';
    end if;
  end if;

  delete from public.staff_memberships where user_id = p_user_id;
end;
$$;

revoke all on function public.owner_set_staff_member(text, public.staff_role)
  from public;
revoke all on function public.owner_remove_staff_member(uuid) from public;
grant execute on function public.owner_set_staff_member(text, public.staff_role)
  to authenticated;
grant execute on function public.owner_remove_staff_member(uuid)
  to authenticated;
