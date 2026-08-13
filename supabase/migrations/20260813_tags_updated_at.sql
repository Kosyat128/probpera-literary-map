-- Optimistic locking for taxonomy tags. Existing rows receive a deterministic
-- version based on their creation time before the column becomes NOT NULL.
alter table public.tags
  add column if not exists updated_at timestamptz;

update public.tags
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.tags
  alter column updated_at set default now(),
  alter column updated_at set not null;

drop trigger if exists tags_set_updated_at on public.tags;
create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

create index if not exists tags_catalog_name_idx
  on public.tags(name asc, id asc);
