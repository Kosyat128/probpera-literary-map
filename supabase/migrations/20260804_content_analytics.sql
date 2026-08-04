alter table public.content_views
  add column if not exists previous_path text,
  add column if not exists navigation_source text not null default 'direct',
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

alter table public.content_views
  drop constraint if exists content_views_previous_path_length,
  add constraint content_views_previous_path_length
    check (previous_path is null or char_length(previous_path) between 1 and 320),
  drop constraint if exists content_views_navigation_source_check,
  add constraint content_views_navigation_source_check
    check (navigation_source in ('direct', 'internal', 'external', 'campaign')),
  drop constraint if exists content_views_utm_source_length,
  add constraint content_views_utm_source_length
    check (utm_source is null or char_length(utm_source) <= 120),
  drop constraint if exists content_views_utm_medium_length,
  add constraint content_views_utm_medium_length
    check (utm_medium is null or char_length(utm_medium) <= 80),
  drop constraint if exists content_views_utm_campaign_length,
  add constraint content_views_utm_campaign_length
    check (utm_campaign is null or char_length(utm_campaign) <= 180);

create index if not exists content_views_session_created_idx
  on public.content_views(session_id, created_at desc);

create index if not exists content_views_source_created_idx
  on public.content_views(navigation_source, created_at desc);

create or replace function public.get_content_view_count(p_paths text[])
returns bigint
language sql
stable
security definer set search_path = ''
as $$
  select count(*)::bigint
  from public.content_views
  where split_part(split_part(path, '#', 1), '?', 1)
    = any (p_paths[1:16]);
$$;

grant execute on function public.get_content_view_count(text[])
  to anon, authenticated;
