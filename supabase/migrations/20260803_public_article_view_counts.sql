create index if not exists content_views_normalized_path_idx
  on public.content_views (
    (split_part(split_part(path, '#', 1), '?', 1))
  );

create or replace function public.get_content_view_count(p_paths text[])
returns bigint
language sql
stable
security definer set search_path = ''
as $$
  select count(*)
  from public.content_views
  where split_part(split_part(path, '#', 1), '?', 1)
    = any (p_paths[1:16]);
$$;

revoke all on function public.get_content_view_count(text[]) from public;
grant execute on function public.get_content_view_count(text[])
  to anon, authenticated;
