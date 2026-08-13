-- Reorder custom homepage blocks in one database transaction. The row locks
-- serialize simultaneous admin clicks and prevent the three-step swap from
-- leaving duplicate or temporary display_order values after a partial error.
create or replace function public.move_homepage_block(
  p_block_id uuid,
  p_direction text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_block public.homepage_blocks%rowtype;
  target_block public.homepage_blocks%rowtype;
  temporary_order integer;
begin
  if not public.is_staff() then
    raise exception 'staff access required';
  end if;
  if p_direction not in ('up', 'down') then
    raise exception 'invalid homepage block direction';
  end if;

  -- Lock every movable row in the same deterministic order before choosing
  -- neighbours, so concurrent reorder transactions cannot interleave.
  perform id
  from public.homepage_blocks
  where not (settings ? 'systemKey')
    and not (settings ? 'coreSectionKey')
  order by display_order, id
  for update;

  select * into current_block
  from public.homepage_blocks
  where id = p_block_id
    and not (settings ? 'systemKey')
    and not (settings ? 'coreSectionKey');
  if not found then
    return false;
  end if;

  if p_direction = 'up' then
    select * into target_block
    from public.homepage_blocks
    where not (settings ? 'systemKey')
      and not (settings ? 'coreSectionKey')
      and (display_order, id) < (current_block.display_order, current_block.id)
    order by display_order desc, id desc
    limit 1;
  else
    select * into target_block
    from public.homepage_blocks
    where not (settings ? 'systemKey')
      and not (settings ? 'coreSectionKey')
      and (display_order, id) > (current_block.display_order, current_block.id)
    order by display_order, id
    limit 1;
  end if;
  if not found then
    return false;
  end if;

  select least(current_block.display_order, target_block.display_order, 0) - 1
  into temporary_order;

  update public.homepage_blocks
  set display_order = temporary_order,
      updated_by = (select auth.uid())
  where id = current_block.id;

  update public.homepage_blocks
  set display_order = current_block.display_order,
      updated_by = (select auth.uid())
  where id = target_block.id;

  update public.homepage_blocks
  set display_order = target_block.display_order,
      updated_by = (select auth.uid())
  where id = current_block.id;

  return true;
end;
$$;

revoke all on function public.move_homepage_block(uuid, text) from public;
grant execute on function public.move_homepage_block(uuid, text) to authenticated;
