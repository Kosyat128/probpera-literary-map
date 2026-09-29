-- Prepared staff read optimization. Apply through the authorized schema release.
-- Requires the existing CMS is_staff(), audit SELECT grant/RLS, and runtime C index.
-- No journal mutation, new table grant, RLS policy, or service-query permission change.
create or replace function public.read_staff_latest_literary_news_runtime(
  p_after_key text default null, p_limit integer default 500, p_upper_id bigint default null
) returns table(id bigint, entity_id text, metadata jsonb, snapshot_upper_id bigint)
language plpgsql stable security invoker set search_path = ''
as $$
declare v_upper_id bigint;
begin
  if not coalesce(public.is_staff(), false) then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500
    or (p_after_key is not null and (length(p_after_key) < 1 or length(p_after_key) > 400))
    or (p_upper_id is not null and p_upper_id < 1)
    or (p_after_key is not null and p_upper_id is null) then
    raise exception 'invalid staff literary news latest query' using errcode = '22023';
  end if;
  if p_upper_id is null then
    select max(a.id) into v_upper_id
    from public.admin_audit_log a where a.entity_type = 'literary_news_runtime';
  else v_upper_id := p_upper_id;
  end if;
  if v_upper_id is null then return; end if;
  return query
    with latest_ids as (
      select distinct on (a.entity_id collate "C") a.id, a.entity_id
      from public.admin_audit_log a
      where a.entity_type = 'literary_news_runtime' and a.id <= v_upper_id
        and (a.entity_id like 'post:news:%' or a.entity_id like 'destination:%'
          or a.entity_id in ('heartbeat:scheduler', 'heartbeat:native-delivery', 'history:coverage'))
        and (p_after_key is null or a.entity_id collate "C" > p_after_key collate "C")
      order by a.entity_id collate "C", a.id desc
      limit p_limit
    )
    select a.id, a.entity_id, a.metadata, v_upper_id
    from latest_ids l join public.admin_audit_log a on a.id = l.id
    order by l.entity_id collate "C";
end;
$$;
revoke all on function public.read_staff_latest_literary_news_runtime(text,integer,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.read_staff_latest_literary_news_runtime(text,integer,bigint) to authenticated;
comment on function public.read_staff_latest_literary_news_runtime(text,integer,bigint) is
  'Staff-gated invoker SELECT of latest UI states at a fixed audit upper-ID; existing table RLS applies. Bounded keyset pages; immutable CAS IDs retained.';
