-- Immutable history for visual edits of homepage blocks. The public snapshot
-- still comes from homepage_blocks; this table is editorial recovery data only.

create table if not exists public.homepage_block_revisions (
  id bigint generated always as identity primary key,
  homepage_block_id uuid references public.homepage_blocks(id) on delete set null,
  revision_number integer not null,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (homepage_block_id, revision_number)
);

create or replace function public.capture_homepage_block_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision integer;
begin
  if tg_op = 'UPDATE' and old is not distinct from new then
    return new;
  end if;

  select coalesce(max(revision_number), 0) + 1
  into next_revision
  from public.homepage_block_revisions
  where homepage_block_id = old.id;

  insert into public.homepage_block_revisions (
    homepage_block_id,
    revision_number,
    snapshot,
    changed_by
  )
  values (
    old.id,
    next_revision,
    to_jsonb(old),
    coalesce(
      case when tg_op = 'UPDATE' then new.updated_by else old.updated_by end,
      (select auth.uid())
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists homepage_blocks_capture_revision on public.homepage_blocks;
create trigger homepage_blocks_capture_revision
  before update or delete on public.homepage_blocks
  for each row execute function public.capture_homepage_block_revision();

create index if not exists homepage_block_revisions_block_idx
  on public.homepage_block_revisions(homepage_block_id, revision_number desc);

-- System blocks are singletons. This also turns a simultaneous first save
-- from two admin tabs into a visible uniqueness conflict instead of two
-- divergent records whose last-updated row silently wins.
with ranked_system_blocks as (
  select
    id,
    row_number() over (
      partition by settings ->> 'systemKey'
      order by updated_at desc, id desc
    ) as position
  from public.homepage_blocks
  where settings ? 'systemKey'
)
delete from public.homepage_blocks as block
using ranked_system_blocks as ranked
where block.id = ranked.id
  and ranked.position > 1;

create unique index if not exists homepage_blocks_system_key_unique_idx
  on public.homepage_blocks ((settings ->> 'systemKey'))
  where settings ? 'systemKey';

-- Every built-in public section is also a singleton. Keep the newest row if
-- an older deployment already allowed a race, then reject future duplicates.
with ranked_core_blocks as (
  select
    id,
    row_number() over (
      partition by settings ->> 'coreSectionKey'
      order by updated_at desc, id desc
    ) as position
  from public.homepage_blocks
  where settings ? 'coreSectionKey'
)
delete from public.homepage_blocks as block
using ranked_core_blocks as ranked
where block.id = ranked.id
  and ranked.position > 1;

create unique index if not exists homepage_blocks_core_section_key_unique_idx
  on public.homepage_blocks ((settings ->> 'coreSectionKey'))
  where settings ? 'coreSectionKey';

alter table public.homepage_block_revisions enable row level security;

drop policy if exists "Staff read homepage block revisions"
  on public.homepage_block_revisions;
create policy "Staff read homepage block revisions"
on public.homepage_block_revisions for select
to authenticated
using (public.is_staff());
