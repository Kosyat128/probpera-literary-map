-- Rollback only the reviewed due-page eligibility function. No journal/data changes.
begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
do $guard$ begin
  if not exists(select 1 from pg_proc
    where oid='public.read_due_literary_news_runtime_posts(text,timestamptz,integer)'::regprocedure
      and encode(sha256(convert_to(prosrc,'UTF8')),'hex')='a48057e3e8c5530e2c4cdace4a4c663363832376a8c3a401e4a105d2e12843d4'
      and not prosecdef and proowner='postgres'::regrole) then
    raise exception 'news_due_query_forward_version_changed';
  end if;
end; $guard$;
create or replace function public.read_due_literary_news_runtime_posts(
  p_destination_id text, p_now timestamptz default now(), p_limit integer default 20
) returns table(id bigint, entity_id text, metadata jsonb)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if p_destination_id is null or p_destination_id !~ '^-[1-9][0-9]{0,15}$'
    or p_now is null or p_limit is null or p_limit < 1 or p_limit > 20 then
    raise exception 'invalid literary news due query' using errcode = '22023';
  end if;
  return query
    with latest_ids as (
      select distinct on (a.entity_id collate "C") a.id, a.entity_id
      from public.admin_audit_log a
      where a.entity_type = 'literary_news_runtime'
        and a.entity_id like 'post:news:%:telegram:' || p_destination_id
      order by a.entity_id collate "C", a.id desc
    ), latest as (
      select a.id, a.entity_id, a.metadata from latest_ids l join public.admin_audit_log a on a.id = l.id
    )
    select a.id, a.entity_id, a.metadata from latest a
    where a.metadata->'destination'->>'platform' = 'telegram'
      and a.metadata->'destination'->>'id' = p_destination_id
      and (a.metadata->>'status' in ('pending','correction_pending')
        or (a.metadata->>'status' = 'inflight'
          and case when pg_catalog.pg_input_is_valid(a.metadata->>'leaseUntil','timestamp with time zone')
            then (a.metadata->>'leaseUntil')::timestamptz <= p_now else false end))
      and (a.metadata->>'nextDueAt' is null
        or case when pg_catalog.pg_input_is_valid(a.metadata->>'nextDueAt','timestamp with time zone')
          then (a.metadata->>'nextDueAt')::timestamptz <= p_now else false end)
      and (nullif(a.metadata->>'remoteId','') is not null
        or (a.metadata->'prepared'->'temporal'->>'kind' in ('news','announcement')
          and case when pg_catalog.pg_input_is_valid(a.metadata->'prepared'->'temporal'->>'publishedAt','timestamp with time zone')
            then (case when a.metadata->'prepared'->'temporal'->>'publishedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              then ((a.metadata->'prepared'->'temporal'->>'publishedAt') || 'T00:00:00+03:00')::timestamptz
              else (a.metadata->'prepared'->'temporal'->>'publishedAt')::timestamptz end) between p_now - interval '7 days' and p_now
            else false end))
    order by (nullif(a.metadata->>'remoteId','') is not null) desc,
      (a.metadata->'prepared'->'media'->>'assetId' is not null) desc,
      a.metadata->'prepared'->'temporal'->>'publishedAt' desc nulls last, a.entity_id collate "C"
    limit p_limit;
end;
$$;
notify pgrst, 'reload schema';
commit;
