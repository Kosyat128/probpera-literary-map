-- Prepared additive, read-only operations query. No queue or journal mutation.
-- At most 24 exact indexed latest-key lookups; public semantic revisions and
-- temporal metadata must still match the currently verified full public feed.
create or replace function public.literary_news_operations_supply(
  p_destination_id text, p_candidates jsonb, p_now timestamptz default now()
) returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare v_count integer; v_close timestamptz; v_result jsonb;
begin
  if p_destination_id is null or p_destination_id !~ '^-[1-9][0-9]{0,15}$' or p_now is null
    or p_candidates is null or jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) > 24 or octet_length(p_candidates::text) > 32768 then
    raise exception 'invalid literary news supply query' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_candidates);
  if exists (
    select 1 from jsonb_array_elements(p_candidates) c
    where jsonb_typeof(c) <> 'object' or (select count(*) from jsonb_object_keys(c)) <> 3
      or c->>'key' is null or length(c->>'key') > 400
      or c->>'key' !~ ('^post:news:[A-Za-z0-9_%.-]+:telegram:' || p_destination_id || '$')
      or c->>'textRevision' is null or c->>'textRevision' !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(c->'temporal') is distinct from 'object'
      or c->'temporal'->>'kind' is null or c->'temporal'->>'kind' not in ('news','announcement')
      or c->'temporal'->>'publishedAt' is null
      or length(c->'temporal'->>'publishedAt') > 35
      or not pg_catalog.pg_input_is_valid(c->'temporal'->>'publishedAt','timestamp with time zone')
      or exists (select 1 from jsonb_object_keys(c->'temporal') t
        where t not in ('kind','eventDate','publishedAt','verifiedAt'))
  ) or (select count(distinct c->>'key') from jsonb_array_elements(p_candidates) c) <> v_count then
    raise exception 'invalid literary news supply candidates' using errcode = '22023';
  end if;
  v_close := (((p_now at time zone 'Europe/Moscow')::date)::text || 'T23:00:00+03:00')::timestamptz;
  with requested as (
    select c->>'key' as key, c->>'textRevision' as revision, c->'temporal' as temporal
    from jsonb_array_elements(p_candidates) c
  ), latest as (
    select c.*, a.id, a.metadata
    from requested c left join lateral (
      select a.id, a.metadata from public.admin_audit_log a
      where a.entity_type = 'literary_news_runtime' and a.entity_id = c.key
      order by a.id desc limit 1
    ) a on true
  ), checked as (
    select l.*,
      l.metadata->>'key' = l.key
        and l.metadata->'destination'->>'platform' = 'telegram'
        and l.metadata->'destination'->>'id' = p_destination_id
        and l.metadata->'prepared'->>'textRevision' = l.revision
        and l.metadata->'prepared'->'temporal' = l.temporal
        and l.metadata->>'desiredRevision' = l.metadata->'prepared'->>'revision'
        as current_revision,
      case when pg_catalog.pg_input_is_valid(l.metadata->>'nextDueAt','timestamp with time zone')
        then (l.metadata->>'nextDueAt')::timestamptz else null end as due_at,
      case when pg_catalog.pg_input_is_valid(l.metadata->>'leaseUntil','timestamp with time zone')
        then (l.metadata->>'leaseUntil')::timestamptz else null end as lease_until
    from latest l
  ), states as (
    select c.*,
      c.metadata->>'status' = 'ambiguous'
        or (c.metadata->>'status' = 'inflight' and c.metadata->>'dispatchStartedAt' is not null
          and (c.lease_until is null or c.lease_until <= p_now)) as ambiguous,
      c.current_revision and nullif(c.metadata->>'remoteId','') is null
        and c.metadata->>'firstAcknowledgedAt' is null and (c.metadata->'withdrawal' is null or c.metadata->'withdrawal' = 'null'::jsonb)
        and c.metadata->>'dispatchStartedAt' is null
        and (c.metadata->>'status' = 'pending'
          or c.metadata->>'status' = 'inflight' and c.lease_until <= p_now)
        and (c.metadata->>'nextDueAt' is null or c.due_at is not null) as pending
    from checked c
  ) select pg_catalog.jsonb_build_object(
    'schemaVersion',1,'checkedAt',p_now,'candidateCount',v_count,
    'readyNow',count(*) filter (where pending and (due_at is null or due_at <= p_now)),
    'readyByClose',count(*) filter (where pending and (due_at is null or due_at < v_close)),
    'ambiguous',count(*) filter (where ambiguous),
    'ambiguousFingerprint',md5(string_agg(key || ':' || coalesce(metadata->>'attemptId',''),',' order by key) filter (where ambiguous)),
    'acknowledged',count(*) filter (where nullif(metadata->>'remoteId','') is not null),
    'inflight',count(*) filter (where metadata->>'status' = 'inflight' and lease_until > p_now),
    'missing',count(*) filter (where id is null),
    'stale',count(*) filter (where id is not null and current_revision is not true)
  ) into v_result from states;
  return v_result;
end;
$$;
revoke all on function public.literary_news_operations_supply(text,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.literary_news_operations_supply(text,jsonb,timestamptz) to service_role;
comment on function public.literary_news_operations_supply(text,jsonb,timestamptz) is
  'Service-only bounded current-publication reserve counts, exact latest-key reads, invoker RLS, no article bodies, no writes or ambiguous-send recovery.';
