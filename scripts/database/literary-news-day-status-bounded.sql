-- Additive replacement of the service-only read RPC; the immutable journal,
-- first receipts, publication policy and provider fences remain authoritative.
-- Materialize the complete latest-state join before any JSON predicate. Without
-- this fence PostgreSQL can push the destination filter onto a journal scan and
-- re-run the latest-key Unique subplan for every matching historical payload.
create or replace function public.literary_news_delivery_day_status(
  p_destination_id text, p_now timestamptz default now()
) returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare p_day date; creates bigint; photos bigint; fresh bigint; fresh_photos bigint; unknown_first bigint;
  daily_minimum integer; daily_maximum integer;
begin
  if p_destination_id is null or p_destination_id !~ '^-[1-9][0-9]{0,15}$' or p_now is null then
    raise exception 'invalid literary news daily status query' using errcode = '22023';
  end if;
  p_day := (p_now at time zone 'Europe/Moscow')::date;
  daily_minimum := case when p_day >= date '2026-10-09' then 8 else 10 end;
  daily_maximum := case when p_day >= date '2026-10-09' then 10 else 20 end;
  with latest_ids as (
    select distinct on (a.entity_id collate "C") a.id, a.entity_id
    from public.admin_audit_log a where a.entity_type = 'literary_news_runtime'
      and a.entity_id like 'post:news:%:telegram:' || p_destination_id
    order by a.entity_id collate "C", a.id desc
  ), latest_rows as materialized (
    select a.metadata
    from latest_ids l join public.admin_audit_log a on a.id = l.id
  ), receipt_fields as materialized (
    select a.metadata->>'firstAcknowledgedAt' as first_acknowledged,
      a.metadata->'prepared'->'temporal'->>'publishedAt' as published,
      a.metadata->>'remoteMediaKind' = 'photo' as is_photo,
      a.metadata->'prepared'->'temporal'->>'kind' in ('news','announcement') as is_story
    from latest_rows a
    where a.metadata->'destination'->>'id' = p_destination_id
      and a.metadata->'destination'->>'platform' = 'telegram'
      and nullif(a.metadata->>'remoteId','') is not null
  ), receipt as materialized (
    select is_photo, is_story,
      case when pg_catalog.pg_input_is_valid(first_acknowledged,'timestamp with time zone')
        then first_acknowledged::timestamptz else null end as first_at,
      case when pg_catalog.pg_input_is_valid(published,'timestamp with time zone')
        then case when published ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          then (published || 'T00:00:00+03:00')::timestamptz
          else published::timestamptz end else null end as published_at
    from receipt_fields
  ) select
    count(*) filter (where (first_at at time zone 'Europe/Moscow')::date = p_day),
    count(*) filter (where (first_at at time zone 'Europe/Moscow')::date = p_day and is_photo),
    count(*) filter (where (first_at at time zone 'Europe/Moscow')::date = p_day
      and is_story and published_at between first_at - interval '7 days' and first_at),
    count(*) filter (where (first_at at time zone 'Europe/Moscow')::date = p_day and is_photo
      and is_story and published_at between first_at - interval '7 days' and first_at),
    count(*) filter (where first_at is null)
  into creates, photos, fresh, fresh_photos, unknown_first from receipt;
  return pg_catalog.jsonb_build_object('editorialDay',p_day::text,'timeZone','Europe/Moscow',
    'acknowledgedCreates',creates,'acknowledgedPhotoCreates',photos,'freshCreates',fresh,'freshPhotoCreates',fresh_photos,
    'legacyReceiptsWithUnknownFirstDate',unknown_first,'minimum',daily_minimum,'maximum',daily_maximum,
    'deficitToMinimum',greatest(0,daily_minimum-fresh));
end;
$$;
revoke all on function public.literary_news_delivery_day_status(text,timestamptz) from public, anon, authenticated;
grant execute on function public.literary_news_delivery_day_status(text,timestamptz) to service_role;
comment on function public.literary_news_delivery_day_status(text,timestamptz) is
  'Service-only Moscow-day first-receipt metrics, materialized latest journal states, invoker RLS, unchanged publication limits and no journal or provider writes.';
