-- Prepared additive query; not applied to any database by a news sender.
-- The existing immutable CAS journal and its per-key index remain authoritative.
create index if not exists admin_audit_literary_news_runtime_latest_key_c
  on public.admin_audit_log(entity_id collate "C", id desc)
  where entity_type = 'literary_news_runtime';

create or replace function public.read_latest_literary_news_runtime(
  p_prefix text default 'post:', p_after_key text default null, p_limit integer default 500
) returns table(id bigint, entity_id text, metadata jsonb)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if p_prefix is null or length(p_prefix) > 400
    or p_prefix !~ '^(post|destination|admission|heartbeat|history):[A-Za-z0-9_%:.-]*$'
    or p_limit is null or p_limit < 1 or p_limit > 500
    or (p_after_key is not null and (length(p_after_key) > 400 or left(p_after_key, length(p_prefix)) <> p_prefix)) then
    raise exception 'invalid literary news latest query' using errcode = '22023';
  end if;
  return query
    with latest_ids as (
      select distinct on (a.entity_id collate "C") a.id, a.entity_id
      from public.admin_audit_log a
      where a.entity_type = 'literary_news_runtime'
        and a.entity_id like replace(replace(p_prefix, '%', '\%'), '_', '\_') || '%' escape '\'
        and (p_after_key is null or a.entity_id collate "C" > p_after_key collate "C")
      order by a.entity_id collate "C", a.id desc
      limit p_limit
    )
    select a.id, a.entity_id, a.metadata
    from latest_ids l join public.admin_audit_log a on a.id = l.id
    order by l.entity_id collate "C";
end;
$$;
revoke all on function public.read_latest_literary_news_runtime(text,text,integer) from public, anon, authenticated;
grant execute on function public.read_latest_literary_news_runtime(text,text,integer) to service_role;
comment on function public.read_latest_literary_news_runtime(text,text,integer) is
  'Service-only read of latest complete CAS states; invoker permissions/RLS, keyset pagination, no journal mutation or retention change.';

-- The 30-minute sender returns only due jobs, never the whole historical payload journal.
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
        or (a.metadata->'prepared'->'media'->>'assetId' is not null
          and a.metadata->'prepared'->'temporal'->>'kind' in ('news','announcement')
          and case when pg_catalog.pg_input_is_valid(a.metadata->'prepared'->'temporal'->>'publishedAt','timestamp with time zone')
            then (case when a.metadata->'prepared'->'temporal'->>'publishedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              then ((a.metadata->'prepared'->'temporal'->>'publishedAt') || 'T00:00:00+03:00')::timestamptz
              else (a.metadata->'prepared'->'temporal'->>'publishedAt')::timestamptz end) between p_now - interval '7 days' and p_now
            else false end))
    order by (nullif(a.metadata->>'remoteId','') is not null) desc,
      a.metadata->'prepared'->'temporal'->>'publishedAt' desc nulls last, a.entity_id collate "C"
    limit p_limit;
end;
$$;
revoke all on function public.read_due_literary_news_runtime_posts(text,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.read_due_literary_news_runtime_posts(text,timestamptz,integer) to service_role;

create or replace function public.literary_news_delivery_day_status(
  p_destination_id text, p_now timestamptz default now()
) returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare p_day date; creates bigint; photos bigint; fresh bigint; unknown_first bigint;
begin
  if p_destination_id is null or p_destination_id !~ '^-[1-9][0-9]{0,15}$' or p_now is null then
    raise exception 'invalid literary news daily status query' using errcode = '22023';
  end if;
  p_day := (p_now at time zone 'Europe/Moscow')::date;
  with latest_ids as (
    select distinct on (a.entity_id collate "C") a.id, a.entity_id
    from public.admin_audit_log a where a.entity_type = 'literary_news_runtime'
      and a.entity_id like 'post:news:%:telegram:' || p_destination_id
    order by a.entity_id collate "C", a.id desc
  ), receipt as (
    select a.metadata,
      case when pg_catalog.pg_input_is_valid(a.metadata->>'firstAcknowledgedAt','timestamp with time zone')
        then (a.metadata->>'firstAcknowledgedAt')::timestamptz else null end as first_at,
      case when pg_catalog.pg_input_is_valid(a.metadata->'prepared'->'temporal'->>'publishedAt','timestamp with time zone')
        then case when a.metadata->'prepared'->'temporal'->>'publishedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          then ((a.metadata->'prepared'->'temporal'->>'publishedAt') || 'T00:00:00+03:00')::timestamptz
          else (a.metadata->'prepared'->'temporal'->>'publishedAt')::timestamptz end else null end as published_at
    from latest_ids l join public.admin_audit_log a on a.id = l.id
    where a.metadata->'destination'->>'id' = p_destination_id and a.metadata->'destination'->>'platform' = 'telegram'
  ) select
    count(*) filter (where nullif(metadata->>'remoteId','') is not null and (first_at at time zone 'Europe/Moscow')::date = p_day),
    count(*) filter (where nullif(metadata->>'remoteId','') is not null and (first_at at time zone 'Europe/Moscow')::date = p_day and metadata->>'remoteMediaKind' = 'photo'),
    count(*) filter (where nullif(metadata->>'remoteId','') is not null and (first_at at time zone 'Europe/Moscow')::date = p_day and metadata->>'remoteMediaKind' = 'photo'
      and metadata->'prepared'->'temporal'->>'kind' in ('news','announcement') and published_at between first_at - interval '7 days' and first_at),
    count(*) filter (where nullif(metadata->>'remoteId','') is not null and first_at is null)
  into creates, photos, fresh, unknown_first from receipt;
  return pg_catalog.jsonb_build_object('editorialDay',p_day::text,'timeZone','Europe/Moscow',
    'acknowledgedCreates',creates,'acknowledgedPhotoCreates',photos,'freshPhotoCreates',fresh,
    'legacyReceiptsWithUnknownFirstDate',unknown_first,'minimum',10,'maximum',15,'deficitToMinimum',greatest(0,10-fresh));
end;
$$;
revoke all on function public.literary_news_delivery_day_status(text,timestamptz) from public, anon, authenticated;
grant execute on function public.literary_news_delivery_day_status(text,timestamptz) to service_role;
