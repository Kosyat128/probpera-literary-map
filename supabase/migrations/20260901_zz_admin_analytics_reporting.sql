create index if not exists content_views_created_path_idx
  on public.content_views(created_at desc, path);

create index if not exists ratings_created_at_idx
  on public.ratings(created_at desc);

create index if not exists article_comments_created_at_idx
  on public.article_comments(created_at desc);

create or replace function public.get_admin_analytics_report(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  report jsonb;
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'analytics_staff_access_required';
  end if;

  if p_from is null
    or p_to is null
    or p_from >= p_to
    or p_to > now() + interval '5 minutes'
    or p_to - p_from > interval '366 days' then
    raise exception using errcode = '22023', message = 'analytics_invalid_date_range';
  end if;

  with scoped_views as materialized (
    select
      split_part(split_part(view_row.path, '#', 1), '?', 1) as path,
      view_row.session_id,
      nullif(split_part(split_part(view_row.previous_path, '#', 1), '?', 1), '') as previous_path,
      case
        when nullif(btrim(view_row.utm_source), '') is not null
          then 'Кампания: ' || left(btrim(view_row.utm_source), 120)
        when view_row.navigation_source = 'internal' or view_row.previous_path is not null
          then 'Внутренние переходы'
        when nullif(btrim(view_row.referrer_host), '') is not null
          then left(btrim(view_row.referrer_host), 180)
        else 'Прямой переход'
      end as source,
      date_trunc('day', view_row.created_at at time zone 'UTC')::date as day
    from public.content_views as view_row
    where view_row.created_at >= p_from
      and view_row.created_at < p_to
  ),
  daily as (
    select
      generated.day::date as day,
      count(scoped.path)::bigint as views
    from generate_series(
      date_trunc('day', p_from at time zone 'UTC'),
      date_trunc('day', (p_to - interval '1 microsecond') at time zone 'UTC'),
      interval '1 day'
    ) as generated(day)
    left join scoped_views as scoped on scoped.day = generated.day::date
    group by generated.day
    order by generated.day
  ),
  top_paths as (
    select path, count(*)::bigint as views
    from scoped_views
    group by path
    order by views desc, path asc
    limit 100
  ),
  top_sources as (
    select source, count(*)::bigint as views
    from scoped_views
    group by source
    order by views desc, source asc
    limit 50
  ),
  top_transitions as (
    select previous_path, path, count(*)::bigint as views
    from scoped_views
    where previous_path is not null and previous_path <> path
    group by previous_path, path
    order by views desc, previous_path asc, path asc
    limit 100
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'views', (select count(*)::bigint from scoped_views),
    'visitors', (select count(distinct session_id)::bigint from scoped_views),
    'pages', (select count(distinct path)::bigint from scoped_views),
    'ratings', (
      select count(*)::bigint
      from public.ratings
      where created_at >= p_from and created_at < p_to
    ),
    'averageRating', (
      select round(avg(score)::numeric, 2)
      from public.ratings
      where created_at >= p_from and created_at < p_to
    ),
    'comments', (
      select count(*)::bigint
      from public.article_comments
      where created_at >= p_from and created_at < p_to
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'day', day,
      'views', views
    ) order by day) from daily), '[]'::jsonb),
    'topPaths', coalesce((select jsonb_agg(jsonb_build_object(
      'path', path,
      'views', views
    ) order by views desc, path asc) from top_paths), '[]'::jsonb),
    'topSources', coalesce((select jsonb_agg(jsonb_build_object(
      'source', source,
      'views', views
    ) order by views desc, source asc) from top_sources), '[]'::jsonb),
    'topTransitions', coalesce((select jsonb_agg(jsonb_build_object(
      'from', previous_path,
      'to', path,
      'views', views
    ) order by views desc, previous_path asc, path asc) from top_transitions), '[]'::jsonb)
  ) into report;

  return report;
end;
$$;

revoke all on function public.get_admin_analytics_report(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_admin_analytics_report(timestamptz, timestamptz)
  to authenticated;
