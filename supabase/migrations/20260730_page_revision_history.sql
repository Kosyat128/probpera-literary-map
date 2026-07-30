-- Version history for permanent CMS pages.
-- Article revisions were part of the initial CMS migration; pages use the
-- same immutable-snapshot model so every editorial change is recoverable.

create or replace function public.capture_page_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision integer;
begin
  if old is not distinct from new then
    return new;
  end if;

  select coalesce(max(revision_number), 0) + 1
  into next_revision
  from public.page_revisions
  where page_id = old.id;

  insert into public.page_revisions (
    page_id,
    revision_number,
    snapshot,
    changed_by
  )
  values (
    old.id,
    next_revision,
    to_jsonb(old),
    coalesce(new.updated_by, (select auth.uid()))
  );

  return new;
end;
$$;

drop trigger if exists pages_capture_revision on public.pages;
create trigger pages_capture_revision
  before update on public.pages
  for each row execute function public.capture_page_revision();

create index if not exists page_revisions_page_idx
  on public.page_revisions(page_id, revision_number desc);
