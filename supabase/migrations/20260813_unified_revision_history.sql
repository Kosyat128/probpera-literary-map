-- Единый read-only каталог версий нужен админке для честного server-side
-- поиска и глобальной пагинации по всем типам контента.

create or replace view public.admin_revision_history
with (security_invoker = true)
as
select
  'article'::text as kind,
  revision.id as revision_id,
  revision.article_id::text as entity_id,
  revision.snapshot,
  revision.changed_by as actor_id,
  revision.created_at,
  revision.revision_number,
  entity.id is not null as restorable,
  concat_ws(' ', revision.article_id::text, revision.snapshot ->> 'title', revision.snapshot ->> 'name', revision.snapshot ->> 'legacy_id') as search_text,
  entity.updated_at as entity_updated_at
from public.article_revisions revision
left join public.articles entity on entity.id = revision.article_id
union all
select 'page', revision.id, revision.page_id::text, revision.snapshot,
  revision.changed_by, revision.created_at, revision.revision_number,
  entity.id is not null,
  concat_ws(' ', revision.page_id::text, revision.snapshot ->> 'title', revision.snapshot ->> 'name', revision.snapshot ->> 'legacy_id'),
  entity.updated_at
from public.page_revisions revision
left join public.pages entity on entity.id = revision.page_id
union all
select 'homepage', revision.id,
  coalesce(revision.homepage_block_id::text, revision.snapshot ->> 'id'),
  revision.snapshot, revision.changed_by, revision.created_at,
  revision.revision_number,
  entity.id is not null,
  concat_ws(' ', revision.homepage_block_id::text, revision.snapshot ->> 'title', revision.snapshot ->> 'name', revision.snapshot ->> 'systemKey'),
  entity.updated_at
from public.homepage_block_revisions revision
left join public.homepage_blocks entity on entity.id = revision.homepage_block_id
union all
select 'country', revision.id,
  coalesce(revision.override_id::text, revision.snapshot ->> 'id', revision.country_id),
  revision.snapshot, revision.revised_by, revision.revised_at, null::integer,
  entity.id is not null,
  concat_ws(' ', revision.override_id::text, revision.country_id, revision.snapshot ->> 'name', revision.snapshot ->> 'title'),
  entity.updated_at
from public.country_profile_override_revisions revision
left join public.country_profile_overrides entity on entity.id = revision.override_id
union all
select 'writer', revision.id,
  coalesce(revision.override_id::text, revision.snapshot ->> 'id', revision.country_id || ':' || revision.writer_id),
  revision.snapshot, revision.revised_by, revision.revised_at, null::integer,
  entity.id is not null,
  concat_ws(' ', revision.override_id::text, revision.country_id, revision.writer_id, revision.snapshot ->> 'name', revision.snapshot ->> 'title'),
  entity.updated_at
from public.writer_profile_override_revisions revision
left join public.writer_profile_overrides entity on entity.id = revision.override_id
union all
select 'work', revision.id,
  coalesce(revision.work_id::text, revision.snapshot ->> 'id', revision.legacy_id),
  revision.snapshot, revision.revised_by, revision.revised_at, null::integer,
  entity.id is not null,
  concat_ws(' ', revision.work_id::text, revision.legacy_id, revision.snapshot ->> 'title', revision.snapshot ->> 'original_title'),
  entity.updated_at
from public.literary_work_revisions revision
left join public.literary_works entity on entity.id = revision.work_id
union all
select 'edition', revision.id,
  coalesce(revision.edition_id::text, revision.snapshot ->> 'id', revision.legacy_id),
  revision.snapshot, revision.revised_by, revision.revised_at, null::integer,
  entity.id is not null,
  concat_ws(' ', revision.edition_id::text, revision.legacy_id, revision.snapshot ->> 'title', revision.snapshot ->> 'isbn_10', revision.snapshot ->> 'isbn_13'),
  entity.updated_at
from public.book_edition_revisions revision
left join public.book_editions entity on entity.id = revision.edition_id
union all
select
  case revision.entity_type when 'banner' then 'banner' else 'navigation' end,
  revision.id, revision.entity_id::text, revision.snapshot, revision.revised_by,
  revision.revised_at, null::integer,
  case revision.entity_type
    when 'banner' then banner.id is not null
    else navigation.id is not null
  end,
  concat_ws(' ', revision.entity_id::text, revision.snapshot ->> 'title', revision.snapshot ->> 'name', revision.snapshot ->> 'label'),
  coalesce(banner.updated_at, navigation.updated_at)
from public.site_chrome_revisions revision
left join public.banners banner
  on revision.entity_type = 'banner' and banner.id = revision.entity_id
left join public.navigation_items navigation
  on revision.entity_type = 'navigation_item' and navigation.id = revision.entity_id
where revision.entity_type in ('banner', 'navigation_item');

revoke all on public.admin_revision_history from public, anon;
grant select on public.admin_revision_history to authenticated;
