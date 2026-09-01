-- Phase 5 / Site Studio database core.
-- Design values are typed data, never arbitrary CSS or JavaScript. Drafts and
-- review snapshots stay private; only an atomic release changes public design.

create or replace function public.is_valid_site_design_identifier_list(
  p_values text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_values is not null
    and cardinality(p_values) <= 32
    and not exists (
      select 1
      from pg_catalog.unnest(p_values) as item(value)
      where item.value is null
        or item.value !~ '^[a-z][a-z0-9-]{0,39}$'
    )
    and cardinality(p_values) = (
      select count(distinct item.value)
      from pg_catalog.unnest(p_values) as item(value)
    );
$$;

create or replace function public.is_valid_site_design_allowed_list(
  p_values text[],
  p_allowed text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.is_valid_site_design_identifier_list(p_values)
    and not exists (
      select 1
      from pg_catalog.unnest(p_values) as item(value)
      where not (item.value = any(p_allowed))
    );
$$;

create or replace function public.is_valid_site_design_length(
  p_value jsonb,
  p_min numeric,
  p_max numeric,
  p_units text[]
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  numeric_value numeric;
begin
  if p_value is null
    or jsonb_typeof(p_value) <> 'object'
    or not (p_value ?& array['value', 'unit'])
    or (p_value - 'value' - 'unit') <> '{}'::jsonb
    or jsonb_typeof(p_value -> 'value') <> 'number'
    or jsonb_typeof(p_value -> 'unit') <> 'string'
    or not ((p_value ->> 'unit') = any(p_units)) then
    return false;
  end if;
  numeric_value := (p_value ->> 'value')::numeric;
  return numeric_value between p_min and p_max;
exception
  when others then return false;
end;
$$;

create or replace function public.is_valid_site_design_category_type(
  p_category text,
  p_value_type text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'color' then p_value_type = 'color'
    when 'typography' then p_value_type in ('color', 'length', 'number')
    when 'spacing' then p_value_type = 'length'
    when 'radius' then p_value_type = 'length'
    when 'shadow' then p_value_type = 'shadow'
    when 'motion' then p_value_type in ('duration', 'easing', 'effect')
    when 'layout' then p_value_type in ('layout', 'length', 'number')
    else false
  end;
$$;

create or replace function public.is_valid_site_design_token_value(
  p_category text,
  p_value_type text,
  p_value jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  numeric_value numeric;
  max_length numeric;
begin
  if p_value is null
    or octet_length(p_value::text) > 8192
    or not public.is_valid_site_design_category_type(
      p_category,
      p_value_type
    ) then
    return false;
  end if;

  if p_value_type = 'color' then
    return jsonb_typeof(p_value) = 'string'
      and (
        p_value #>> '{}' = 'transparent'
        or (p_value #>> '{}') ~* '^#[0-9a-f]{3,4}$|^#[0-9a-f]{6}([0-9a-f]{2})?$'
      );
  elsif p_value_type = 'length' then
    max_length := case p_category
      when 'typography' then 256
      when 'layout' then 8192
      else 512
    end;
    return public.is_valid_site_design_length(
      p_value,
      0,
      max_length,
      array['px', 'rem', 'em', '%', 'vw', 'vh']
    );
  elsif p_value_type = 'number' then
    if jsonb_typeof(p_value) <> 'number' then return false; end if;
    numeric_value := (p_value #>> '{}')::numeric;
    return numeric_value between -10000 and 10000;
  elsif p_value_type = 'duration' then
    if jsonb_typeof(p_value) <> 'number' then return false; end if;
    numeric_value := (p_value #>> '{}')::numeric;
    return numeric_value between 0 and 5000
      and trunc(numeric_value) = numeric_value;
  elsif p_value_type = 'easing' then
    return jsonb_typeof(p_value) = 'string'
      and p_value #>> '{}' in (
        'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'
      );
  elsif p_value_type = 'shadow' then
    return jsonb_typeof(p_value) = 'object'
      and (p_value ?& array['x', 'y', 'blur', 'spread', 'color', 'inset'])
      and (
        p_value - array['x', 'y', 'blur', 'spread', 'color', 'inset']
      ) = '{}'::jsonb
      and public.is_valid_site_design_length(
        p_value -> 'x', -128, 128, array['px']
      )
      and public.is_valid_site_design_length(
        p_value -> 'y', -128, 128, array['px']
      )
      and public.is_valid_site_design_length(
        p_value -> 'blur', 0, 256, array['px']
      )
      and public.is_valid_site_design_length(
        p_value -> 'spread', -128, 128, array['px']
      )
      and public.is_valid_site_design_token_value(
        'color', 'color', p_value -> 'color'
      )
      and jsonb_typeof(p_value -> 'inset') = 'boolean';
  elsif p_value_type = 'effect' then
    if jsonb_typeof(p_value) <> 'object'
      or not (
        p_value ?& array[
          'name', 'durationMs', 'easing', 'reducedMotionFallback'
        ]
      )
      or (
        p_value - array[
          'name', 'durationMs', 'easing', 'reducedMotionFallback'
        ]
      ) <> '{}'::jsonb
      or jsonb_typeof(p_value -> 'name') <> 'string'
      or p_value ->> 'name' not in ('none', 'fade', 'reveal-up', 'zoom-soft')
      or not public.is_valid_site_design_token_value(
        'motion', 'duration', p_value -> 'durationMs'
      )
      or not public.is_valid_site_design_token_value(
        'motion', 'easing', p_value -> 'easing'
      )
      or jsonb_typeof(p_value -> 'reducedMotionFallback') <> 'string' then
      return false;
    end if;
    return (
      p_value ->> 'name' in ('none', 'fade')
      and p_value ->> 'reducedMotionFallback' = 'none'
    ) or (
      p_value ->> 'name' in ('reveal-up', 'zoom-soft')
      and p_value ->> 'reducedMotionFallback' = 'fade'
    );
  elsif p_value_type = 'layout' then
    if jsonb_typeof(p_value) <> 'object'
      or not (p_value ? 'display')
      or (
        p_value - array[
          'display', 'columns', 'gap', 'padding', 'maxWidth',
          'borderRadius', 'alignItems', 'justifyContent', 'overflow'
        ]
      ) <> '{}'::jsonb
      or jsonb_typeof(p_value -> 'display') <> 'string'
      or p_value ->> 'display' not in ('block', 'flex', 'grid') then
      return false;
    end if;
    if p_value ? 'columns' and (
      p_value ->> 'display' <> 'grid'
      or jsonb_typeof(p_value -> 'columns') <> 'number'
      or (p_value ->> 'columns')::numeric not between 1 and 12
      or trunc((p_value ->> 'columns')::numeric) <>
        (p_value ->> 'columns')::numeric
    ) then return false; end if;
    if p_value ? 'gap' and not public.is_valid_site_design_length(
      p_value -> 'gap', 0, 512, array['px', 'rem', 'em', '%', 'vw', 'vh']
    ) then return false; end if;
    if p_value ? 'padding' and not public.is_valid_site_design_length(
      p_value -> 'padding', 0, 512, array['px', 'rem', 'em', '%', 'vw', 'vh']
    ) then return false; end if;
    if p_value ? 'maxWidth' and not public.is_valid_site_design_length(
      p_value -> 'maxWidth', 1, 8192, array['px', 'rem']
    ) then return false; end if;
    if p_value ? 'borderRadius' and not public.is_valid_site_design_length(
      p_value -> 'borderRadius', 0, 512,
      array['px', 'rem', 'em', '%', 'vw', 'vh']
    ) then return false; end if;
    if p_value ? 'alignItems' and (
      jsonb_typeof(p_value -> 'alignItems') <> 'string'
      or p_value ->> 'alignItems' not in ('start', 'center', 'end', 'stretch')
    ) then return false; end if;
    if p_value ? 'justifyContent' and (
      jsonb_typeof(p_value -> 'justifyContent') <> 'string'
      or p_value ->> 'justifyContent' not in (
        'start', 'center', 'end', 'space-between'
      )
    ) then return false; end if;
    if p_value ? 'overflow' and (
      jsonb_typeof(p_value -> 'overflow') <> 'string'
      or p_value ->> 'overflow' not in ('visible', 'hidden', 'clip', 'auto')
    ) then return false; end if;
    return true;
  end if;

  return false;
exception
  when others then return false;
end;
$$;

create table if not exists public.site_component_registry (
  component_key text primary key check (
    component_key ~ '^[a-z][a-z0-9-]{0,79}$'
  ),
  display_name text not null check (
    char_length(btrim(display_name)) between 1 and 120
  ),
  capabilities text[] not null default array[]::text[] check (
    public.is_valid_site_design_allowed_list(
      capabilities,
      array['tokens', 'layout', 'effects', 'visibility', 'content']
    )
  ),
  slots text[] not null default array[]::text[] check (
    public.is_valid_site_design_identifier_list(slots)
  ),
  states text[] not null default array['default']::text[] check (
    cardinality(states) >= 1
    and 'default' = any(states)
    and public.is_valid_site_design_allowed_list(
      states,
      array[
        'default', 'hover', 'focus', 'active', 'selected', 'open', 'disabled'
      ]
    )
  ),
  owner_lock boolean not null default true,
  is_active boolean not null default true,
  registry_version bigint not null default 1 check (registry_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The component registry is code-owned. Keep this seed aligned with
-- src/data/cms/siteStudioContract.ts and change it only through a reviewed
-- migration. The conditional conflict update keeps reconciliation idempotent
-- while still repairing drift from an older registry version.
insert into public.site_component_registry as registry (
  component_key,
  display_name,
  capabilities,
  slots,
  states,
  owner_lock,
  is_active
)
values
  (
    'site-header',
    'Шапка сайта',
    array['tokens', 'layout', 'effects', 'visibility']::text[],
    array['brand', 'navigation', 'actions']::text[],
    array['default', 'hover', 'focus', 'active']::text[],
    false,
    true
  ),
  (
    'magazine',
    'Литературный журнал',
    array['tokens', 'layout', 'effects', 'visibility', 'content']::text[],
    array['heading', 'featured', 'feed']::text[],
    array['default', 'hover', 'focus', 'selected']::text[],
    false,
    true
  ),
  (
    'journal',
    'Каталог журнала',
    array['tokens', 'layout', 'effects', 'visibility', 'content']::text[],
    array['heading', 'filters', 'entries']::text[],
    array['default', 'hover', 'focus', 'selected']::text[],
    false,
    true
  ),
  (
    'article-reader',
    'Чтение статьи',
    array['tokens', 'layout', 'visibility', 'content']::text[],
    array['header', 'lead', 'body', 'footer']::text[],
    array['default', 'focus']::text[],
    false,
    true
  ),
  (
    'cms-page-reader',
    'Обычная страница',
    array['tokens', 'layout', 'visibility', 'content']::text[],
    array['header', 'body', 'footer']::text[],
    array['default', 'focus']::text[],
    false,
    true
  ),
  (
    'literary-globe',
    'Литературный глобус',
    array['tokens', 'visibility']::text[],
    array['canvas', 'markers', 'labels', 'controls']::text[],
    array['default', 'focus', 'active', 'selected']::text[],
    true,
    true
  ),
  (
    'bookshelf',
    'Книжная полка',
    array['tokens', 'visibility']::text[],
    array['scene', 'shelf', 'books', 'details', 'controls']::text[],
    array['default', 'focus', 'active', 'selected', 'open']::text[],
    true,
    true
  ),
  (
    'site-footer',
    'Подвал сайта',
    array['tokens', 'layout', 'effects', 'visibility', 'content']::text[],
    array['navigation', 'legal', 'social']::text[],
    array['default', 'hover', 'focus']::text[],
    false,
    true
  )
on conflict (component_key) do update
set display_name = excluded.display_name,
    capabilities = excluded.capabilities,
    slots = excluded.slots,
    states = excluded.states,
    owner_lock = excluded.owner_lock,
    is_active = excluded.is_active,
    registry_version = registry.registry_version + 1
where (
  registry.display_name,
  registry.capabilities,
  registry.slots,
  registry.states,
  registry.owner_lock,
  registry.is_active
) is distinct from (
  excluded.display_name,
  excluded.capabilities,
  excluded.slots,
  excluded.states,
  excluded.owner_lock,
  excluded.is_active
);

create table if not exists public.site_design_tokens (
  id uuid primary key default gen_random_uuid(),
  layer text not null check (
    layer in ('site', 'component', 'template', 'page', 'instance')
  ),
  target_key text not null check (
    target_key ~ '^[a-z][a-z0-9_-]{0,119}$'
  ),
  token_key text not null check (
    token_key ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)*$'
    and char_length(token_key) <= 160
    and token_key not in ('constructor', 'prototype', '__proto__')
  ),
  category text not null check (
    category in (
      'color', 'typography', 'spacing', 'radius', 'shadow', 'motion', 'layout'
    )
  ),
  value_type text not null check (
    value_type in (
      'color', 'length', 'number', 'shadow', 'duration', 'easing',
      'effect', 'layout'
    )
  ),
  check (
    public.is_valid_site_design_category_type(category, value_type)
  ),
  breakpoint text not null default 'base' check (
    breakpoint in ('base', 'mobile', 'tablet', 'desktop')
  ),
  state text not null default 'default' check (
    state in (
      'default', 'hover', 'focus', 'active', 'selected', 'open', 'disabled'
    )
  ),
  description text not null default '' check (char_length(description) <= 500),
  draft_value jsonb not null check (
    public.is_valid_site_design_token_value(
      category,
      value_type,
      draft_value
    )
  ),
  published_value jsonb check (
    published_value is null
    or public.is_valid_site_design_token_value(
      category,
      value_type,
      published_value
    )
  ),
  cas_version bigint not null default 1 check (cas_version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  published_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check (
    layer <> 'site' or target_key = 'site'
  ),
  check (
    (published_value is null and published_by is null and published_at is null)
    or (
      published_value is not null
      and published_by is not null
      and published_at is not null
    )
  )
);

create table if not exists public.site_design_change_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1200),
  status text not null default 'draft' check (
    status in ('draft', 'review', 'approved', 'published', 'cancelled')
  ),
  scheduled_at timestamptz,
  cas_version bigint not null default 1 check (cas_version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  submitted_by uuid references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  published_by uuid references auth.users(id) on delete restrict,
  cancelled_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  cancelled_at timestamptz,
  check ((submitted_at is null) = (submitted_by is null)),
  check ((approved_at is null) = (approved_by is null)),
  check ((published_at is null) = (published_by is null)),
  check ((cancelled_at is null) = (cancelled_by is null)),
  check (scheduled_at is null or status in ('approved', 'published')),
  check (
    (
      status = 'draft'
      and submitted_at is null
      and approved_at is null
      and published_at is null
      and cancelled_at is null
    )
    or (
      status = 'review'
      and submitted_at is not null
      and approved_at is null
      and published_at is null
      and cancelled_at is null
    )
    or (
      status = 'approved'
      and submitted_at is not null
      and approved_at is not null
      and published_at is null
      and cancelled_at is null
    )
    or (
      status = 'published'
      and submitted_at is not null
      and approved_at is not null
      and published_at is not null
      and cancelled_at is null
    )
    or (
      status = 'cancelled'
      and published_at is null
      and cancelled_at is not null
    )
  )
);

create table if not exists public.site_design_change_set_items (
  id bigint generated always as identity primary key,
  change_set_id uuid not null references public.site_design_change_sets(id)
    on delete restrict,
  token_id uuid not null references public.site_design_tokens(id)
    on delete restrict,
  expected_token_cas_version bigint not null check (
    expected_token_cas_version > 0
  ),
  proposed_value jsonb not null check (
    octet_length(proposed_value::text) <= 8192
  ),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (change_set_id, token_id)
);

create table if not exists public.site_design_releases (
  id uuid primary key default gen_random_uuid(),
  release_number bigint generated always as identity unique,
  action text not null check (action in ('publish', 'rollback')),
  change_set_id uuid unique references public.site_design_change_sets(id)
    on delete restrict,
  rollback_of_release_id uuid references public.site_design_releases(id)
    on delete restrict,
  token_count integer not null check (token_count between 1 and 256),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (
      action = 'publish'
      and change_set_id is not null
      and rollback_of_release_id is null
    )
    or (
      action = 'rollback'
      and change_set_id is null
      and rollback_of_release_id is not null
    )
  )
);

create table if not exists public.site_design_token_revisions (
  id bigint generated always as identity primary key,
  release_id uuid not null references public.site_design_releases(id)
    on delete restrict,
  token_id uuid not null references public.site_design_tokens(id)
    on delete restrict,
  revision_number bigint not null check (revision_number > 0),
  action text not null check (action in ('publish', 'rollback')),
  previous_published_value jsonb check (
    previous_published_value is null
    or octet_length(previous_published_value::text) <= 8192
  ),
  published_value jsonb check (
    published_value is null
    or octet_length(published_value::text) <= 8192
  ),
  previous_cas_version bigint not null check (previous_cas_version > 0),
  published_cas_version bigint not null check (
    published_cas_version = previous_cas_version + 1
  ),
  source_revision_id bigint references public.site_design_token_revisions(id)
    on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (release_id, token_id),
  unique (token_id, revision_number),
  check (previous_published_value is not null or published_value is not null),
  check (
    (action = 'publish' and source_revision_id is null)
    or (action = 'rollback' and source_revision_id is not null)
  )
);

create unique index if not exists site_design_tokens_identity_idx
  on public.site_design_tokens(
    layer,
    target_key,
    token_key,
    breakpoint,
    state
  );
create index if not exists site_design_tokens_public_idx
  on public.site_design_tokens(
    layer, target_key, token_key, breakpoint, state
  )
  where published_value is not null;
create index if not exists site_design_change_sets_scheduled_idx
  on public.site_design_change_sets(scheduled_at, id)
  where status = 'approved' and scheduled_at is not null;
create index if not exists site_design_change_set_items_order_idx
  on public.site_design_change_set_items(change_set_id, token_id);
create index if not exists site_design_token_revisions_history_idx
  on public.site_design_token_revisions(token_id, revision_number desc);
create index if not exists site_design_releases_order_idx
  on public.site_design_releases(release_number desc);

drop trigger if exists site_component_registry_set_updated_at
  on public.site_component_registry;
create trigger site_component_registry_set_updated_at
  before update on public.site_component_registry
  for each row execute function public.set_updated_at();

drop trigger if exists site_design_tokens_set_updated_at
  on public.site_design_tokens;
create trigger site_design_tokens_set_updated_at
  before update on public.site_design_tokens
  for each row execute function public.set_updated_at();

drop trigger if exists site_design_change_sets_set_updated_at
  on public.site_design_change_sets;
create trigger site_design_change_sets_set_updated_at
  before update on public.site_design_change_sets
  for each row execute function public.set_updated_at();

drop trigger if exists site_design_change_set_items_set_updated_at
  on public.site_design_change_set_items;
create trigger site_design_change_set_items_set_updated_at
  before update on public.site_design_change_set_items
  for each row execute function public.set_updated_at();

alter table public.site_component_registry enable row level security;
alter table public.site_component_registry force row level security;
alter table public.site_design_tokens enable row level security;
alter table public.site_design_tokens force row level security;
alter table public.site_design_change_sets enable row level security;
alter table public.site_design_change_sets force row level security;
alter table public.site_design_change_set_items enable row level security;
alter table public.site_design_change_set_items force row level security;
alter table public.site_design_releases enable row level security;
alter table public.site_design_releases force row level security;
alter table public.site_design_token_revisions enable row level security;
alter table public.site_design_token_revisions force row level security;

drop policy if exists "Staff read site component registry"
  on public.site_component_registry;
create policy "Staff read site component registry"
on public.site_component_registry for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read site design tokens"
  on public.site_design_tokens;
create policy "Staff read site design tokens"
on public.site_design_tokens for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read site design change sets"
  on public.site_design_change_sets;
create policy "Staff read site design change sets"
on public.site_design_change_sets for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read site design change set items"
  on public.site_design_change_set_items;
create policy "Staff read site design change set items"
on public.site_design_change_set_items for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read site design releases"
  on public.site_design_releases;
create policy "Staff read site design releases"
on public.site_design_releases for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read site design token revisions"
  on public.site_design_token_revisions;
create policy "Staff read site design token revisions"
on public.site_design_token_revisions for select
to authenticated
using (public.is_staff());

revoke all on table public.site_component_registry
  from anon, authenticated, service_role;
revoke all on table public.site_design_tokens
  from anon, authenticated, service_role;
revoke all on table public.site_design_change_sets
  from anon, authenticated, service_role;
revoke all on table public.site_design_change_set_items
  from anon, authenticated, service_role;
revoke all on table public.site_design_releases
  from anon, authenticated, service_role;
revoke all on table public.site_design_token_revisions
  from anon, authenticated, service_role;

grant select on table public.site_component_registry
  to authenticated, service_role;
grant select on table public.site_design_tokens
  to authenticated, service_role;
grant select on table public.site_design_change_sets
  to authenticated, service_role;
grant select on table public.site_design_change_set_items
  to authenticated, service_role;
grant select on table public.site_design_releases
  to authenticated, service_role;
grant select on table public.site_design_token_revisions
  to authenticated, service_role;

create or replace function public.require_site_design_manager()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ]) then
    raise exception 'owner or admin access required' using errcode = '42501';
  end if;
  return actor_id;
end;
$$;

create or replace function public.register_site_component_registry_record(
  p_component_key text,
  p_display_name text,
  p_capabilities text[],
  p_slots text[],
  p_states text[],
  p_owner_lock boolean,
  p_is_active boolean,
  p_expected_registry_version bigint
)
returns public.site_component_registry
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_component public.site_component_registry%rowtype;
  saved_component public.site_component_registry%rowtype;
  action_name text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service role access required' using errcode = '42501';
  end if;
  if p_component_key is null
    or p_component_key !~ '^[a-z][a-z0-9-]{0,79}$'
    or p_display_name is null
    or char_length(btrim(p_display_name)) not between 1 and 120
    or not public.is_valid_site_design_allowed_list(
      p_capabilities,
      array['tokens', 'layout', 'effects', 'visibility', 'content']
    )
    or not public.is_valid_site_design_identifier_list(p_slots)
    or cardinality(p_states) < 1
    or not ('default' = any(p_states))
    or not public.is_valid_site_design_allowed_list(
      p_states,
      array[
        'default', 'hover', 'focus', 'active', 'selected', 'open', 'disabled'
      ]
    )
    or p_owner_lock is null
    or p_is_active is null then
    raise exception 'component registry record is invalid'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(52050101::bigint);
  select component.* into current_component
  from public.site_component_registry component
  where component.component_key = p_component_key
  for update;

  if not found then
    if p_expected_registry_version is not null then
      raise exception 'new component cannot have an expected version'
        using errcode = '22023';
    end if;
    if (select count(*) from public.site_component_registry) >= 256 then
      raise exception 'component registry limit reached' using errcode = '54000';
    end if;
    insert into public.site_component_registry (
      component_key, display_name, capabilities, slots, states,
      owner_lock, is_active
    ) values (
      p_component_key, btrim(p_display_name), p_capabilities, p_slots,
      p_states, p_owner_lock, p_is_active
    ) returning * into saved_component;
    action_name := 'site_design.component_registered';
  else
    if p_expected_registry_version is null
      or current_component.registry_version <> p_expected_registry_version then
      raise exception 'component registry changed in another session'
        using errcode = '40001';
    end if;
    update public.site_component_registry component
    set display_name = btrim(p_display_name),
        capabilities = p_capabilities,
        slots = p_slots,
        states = p_states,
        owner_lock = p_owner_lock,
        is_active = p_is_active,
        registry_version = current_component.registry_version + 1
    where component.component_key = p_component_key
    returning * into saved_component;
    action_name := 'site_design.component_updated';
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    (select auth.uid()),
    action_name,
    'site_component_registry',
    saved_component.component_key,
    jsonb_build_object(
      'ownerLock', saved_component.owner_lock,
      'active', saved_component.is_active,
      'registryVersion', saved_component.registry_version
    )
  );

  return saved_component;
end;
$$;

create or replace function public.save_site_design_token(
  p_token_id uuid,
  p_layer text,
  p_target_key text,
  p_token_key text,
  p_category text,
  p_value_type text,
  p_breakpoint text,
  p_state text,
  p_description text,
  p_draft_value jsonb,
  p_expected_cas_version bigint
)
returns public.site_design_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_site_design_manager();
  current_component public.site_component_registry%rowtype;
  current_token public.site_design_tokens%rowtype;
  saved_token public.site_design_tokens%rowtype;
begin
  if p_layer not in ('site', 'component', 'template', 'page', 'instance')
    or p_target_key is null
    or p_target_key !~ '^[a-z][a-z0-9_-]{0,119}$'
    or (p_layer = 'site' and p_target_key <> 'site')
    or p_token_key is null
    or p_token_key !~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)*$'
    or char_length(p_token_key) > 160
    or p_token_key in ('constructor', 'prototype', '__proto__')
    or p_category not in (
      'color', 'typography', 'spacing', 'radius', 'shadow', 'motion', 'layout'
    )
    or p_value_type not in (
      'color', 'length', 'number', 'shadow', 'duration', 'easing',
      'effect', 'layout'
    )
    or p_breakpoint not in ('base', 'mobile', 'tablet', 'desktop')
    or p_state not in (
      'default', 'hover', 'focus', 'active', 'selected', 'open', 'disabled'
    )
    or p_description is null
    or char_length(p_description) > 500
    or not public.is_valid_site_design_category_type(
      p_category,
      p_value_type
    )
    or not public.is_valid_site_design_token_value(
      p_category,
      p_value_type,
      p_draft_value
    ) then
    raise exception 'site design token is invalid' using errcode = '22023';
  end if;

  if p_layer = 'component' then
    select component.* into current_component
    from public.site_component_registry component
    where component.component_key = p_target_key
    for share;
    if not found or not current_component.is_active then
      raise exception 'active registered component is required'
        using errcode = '23503';
    end if;
    if current_component.owner_lock and not public.is_staff(array[
      'owner'::public.staff_role
    ]) then
      raise exception 'component is owner locked' using errcode = '42501';
    end if;
  end if;

  if p_token_id is null then
    if p_expected_cas_version is not null then
      raise exception 'new design token cannot have an expected version'
        using errcode = '22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(52050102::bigint);
    if (select count(*) from public.site_design_tokens) >= 1024 then
      raise exception 'site design token limit reached' using errcode = '54000';
    end if;
    insert into public.site_design_tokens (
      layer, target_key, token_key, category, value_type, breakpoint, state,
      description, draft_value, created_by, updated_by
    ) values (
      p_layer, p_target_key, p_token_key, p_category, p_value_type,
      p_breakpoint, p_state, p_description, p_draft_value, actor_id, actor_id
    ) returning * into saved_token;
  else
    select token.* into current_token
    from public.site_design_tokens token
    where token.id = p_token_id
    for update;
    if not found then
      raise exception 'site design token not found' using errcode = 'P0002';
    end if;
    if p_expected_cas_version is null
      or current_token.cas_version <> p_expected_cas_version then
      raise exception 'site design token changed in another session'
        using errcode = '40001';
    end if;
    if current_token.layer is distinct from p_layer
      or current_token.target_key is distinct from p_target_key
      or current_token.token_key is distinct from p_token_key
      or current_token.category is distinct from p_category
      or current_token.value_type is distinct from p_value_type
      or current_token.breakpoint is distinct from p_breakpoint
      or current_token.state is distinct from p_state then
      raise exception 'site design token identity is immutable'
        using errcode = '22023';
    end if;
    update public.site_design_tokens token
    set description = p_description,
        draft_value = p_draft_value,
        updated_by = actor_id,
        cas_version = current_token.cas_version + 1
    where token.id = p_token_id
    returning * into saved_token;
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'site_design.token_saved',
    'site_design_token',
    saved_token.id::text,
    jsonb_build_object(
      'layer', saved_token.layer,
      'targetKey', saved_token.target_key,
      'tokenKey', saved_token.token_key,
      'breakpoint', saved_token.breakpoint,
      'state', saved_token.state,
      'casVersion', saved_token.cas_version
    )
  );

  return saved_token;
end;
$$;

create or replace function public.save_site_design_change_set(
  p_change_set_id uuid,
  p_name text,
  p_description text,
  p_expected_cas_version bigint
)
returns public.site_design_change_sets
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_site_design_manager();
  current_change_set public.site_design_change_sets%rowtype;
  saved_change_set public.site_design_change_sets%rowtype;
begin
  if p_name is null
    or char_length(btrim(p_name)) not between 1 and 160
    or p_description is null
    or char_length(p_description) > 1200 then
    raise exception 'site design change set is invalid' using errcode = '22023';
  end if;

  if p_change_set_id is null then
    if p_expected_cas_version is not null then
      raise exception 'new change set cannot have an expected version'
        using errcode = '22023';
    end if;
    insert into public.site_design_change_sets (
      name, description, created_by, updated_by
    ) values (
      btrim(p_name), p_description, actor_id, actor_id
    ) returning * into saved_change_set;
  else
    select change_set.* into current_change_set
    from public.site_design_change_sets change_set
    where change_set.id = p_change_set_id
    for update;
    if not found then
      raise exception 'site design change set not found' using errcode = 'P0002';
    end if;
    if current_change_set.status <> 'draft' then
      raise exception 'only a draft change set can be edited'
        using errcode = '55000';
    end if;
    if p_expected_cas_version is null
      or current_change_set.cas_version <> p_expected_cas_version then
      raise exception 'site design change set changed in another session'
        using errcode = '40001';
    end if;
    update public.site_design_change_sets change_set
    set name = btrim(p_name),
        description = p_description,
        updated_by = actor_id,
        cas_version = current_change_set.cas_version + 1
    where change_set.id = p_change_set_id
    returning * into saved_change_set;
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'site_design.change_set_saved',
    'site_design_change_set',
    saved_change_set.id::text,
    jsonb_build_object('casVersion', saved_change_set.cas_version)
  );

  return saved_change_set;
end;
$$;

create or replace function public.set_site_design_change_set_item(
  p_change_set_id uuid,
  p_token_id uuid,
  p_expected_change_set_cas_version bigint,
  p_expected_token_cas_version bigint
)
returns public.site_design_change_set_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_site_design_manager();
  current_change_set public.site_design_change_sets%rowtype;
  current_token public.site_design_tokens%rowtype;
  staged_item public.site_design_change_set_items%rowtype;
begin
  select change_set.* into current_change_set
  from public.site_design_change_sets change_set
  where change_set.id = p_change_set_id
  for update;
  if not found then
    raise exception 'site design change set not found' using errcode = 'P0002';
  end if;
  if current_change_set.status <> 'draft' then
    raise exception 'change set items are immutable outside draft'
      using errcode = '55000';
  end if;
  if p_expected_change_set_cas_version is null
    or current_change_set.cas_version <>
      p_expected_change_set_cas_version then
    raise exception 'site design change set changed in another session'
      using errcode = '40001';
  end if;

  select token.* into current_token
  from public.site_design_tokens token
  where token.id = p_token_id
  for share;
  if not found then
    raise exception 'site design token not found' using errcode = 'P0002';
  end if;
  if p_expected_token_cas_version is null
    or current_token.cas_version <> p_expected_token_cas_version then
    raise exception 'site design token changed in another session'
      using errcode = '40001';
  end if;
  if not public.is_valid_site_design_token_value(
    current_token.category,
    current_token.value_type,
    current_token.draft_value
  ) then
    raise exception 'site design token draft is invalid' using errcode = '22023';
  end if;
  if current_token.layer = 'component' and exists (
    select 1
    from public.site_component_registry component
    where component.component_key = current_token.target_key
      and (
        not component.is_active
        or (
          component.owner_lock
          and not public.is_staff(array['owner'::public.staff_role])
        )
      )
  ) then
    raise exception 'component is inactive or owner locked'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.site_design_change_set_items item
    where item.change_set_id = p_change_set_id
      and item.token_id = p_token_id
  ) and (
    select count(*)
    from public.site_design_change_set_items item
    where item.change_set_id = p_change_set_id
  ) >= 256 then
    raise exception 'change set item limit reached' using errcode = '54000';
  end if;

  insert into public.site_design_change_set_items (
    change_set_id, token_id, expected_token_cas_version, proposed_value,
    created_by, updated_by
  ) values (
    p_change_set_id, p_token_id, current_token.cas_version,
    current_token.draft_value, actor_id, actor_id
  )
  on conflict (change_set_id, token_id) do update set
    expected_token_cas_version = excluded.expected_token_cas_version,
    proposed_value = excluded.proposed_value,
    updated_by = excluded.updated_by
  returning * into staged_item;

  update public.site_design_change_sets change_set
  set updated_by = actor_id,
      cas_version = current_change_set.cas_version + 1
  where change_set.id = p_change_set_id;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'site_design.change_set_item_staged',
    'site_design_change_set',
    p_change_set_id::text,
    jsonb_build_object(
      'tokenId', p_token_id,
      'tokenCasVersion', current_token.cas_version,
      'changeSetCasVersion', current_change_set.cas_version + 1
    )
  );

  return staged_item;
end;
$$;

create or replace function public.remove_site_design_change_set_item(
  p_change_set_id uuid,
  p_token_id uuid,
  p_expected_change_set_cas_version bigint
)
returns public.site_design_change_sets
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_site_design_manager();
  current_change_set public.site_design_change_sets%rowtype;
  saved_change_set public.site_design_change_sets%rowtype;
begin
  select change_set.* into current_change_set
  from public.site_design_change_sets change_set
  where change_set.id = p_change_set_id
  for update;
  if not found then
    raise exception 'site design change set not found' using errcode = 'P0002';
  end if;
  if current_change_set.status <> 'draft' then
    raise exception 'change set items are immutable outside draft'
      using errcode = '55000';
  end if;
  if p_expected_change_set_cas_version is null
    or current_change_set.cas_version <>
      p_expected_change_set_cas_version then
    raise exception 'site design change set changed in another session'
      using errcode = '40001';
  end if;

  delete from public.site_design_change_set_items item
  where item.change_set_id = p_change_set_id
    and item.token_id = p_token_id;
  if not found then
    raise exception 'site design change set item not found' using errcode = 'P0002';
  end if;

  update public.site_design_change_sets change_set
  set updated_by = actor_id,
      cas_version = current_change_set.cas_version + 1
  where change_set.id = p_change_set_id
  returning * into saved_change_set;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'site_design.change_set_item_removed',
    'site_design_change_set',
    p_change_set_id::text,
    jsonb_build_object(
      'tokenId', p_token_id,
      'changeSetCasVersion', saved_change_set.cas_version
    )
  );

  return saved_change_set;
end;
$$;

create or replace function public.transition_site_design_change_set(
  p_change_set_id uuid,
  p_expected_cas_version bigint,
  p_target_status text,
  p_scheduled_at timestamptz
)
returns public.site_design_change_sets
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_site_design_manager();
  current_change_set public.site_design_change_sets%rowtype;
  transitioned_change_set public.site_design_change_sets%rowtype;
begin
  select change_set.* into current_change_set
  from public.site_design_change_sets change_set
  where change_set.id = p_change_set_id
  for update;
  if not found then
    raise exception 'site design change set not found' using errcode = 'P0002';
  end if;
  if p_expected_cas_version is null
    or current_change_set.cas_version <> p_expected_cas_version then
    raise exception 'site design change set changed in another session'
      using errcode = '40001';
  end if;

  if p_target_status in ('review', 'approved') then
    if not exists (
      select 1
      from public.site_design_change_set_items item
      where item.change_set_id = p_change_set_id
    ) then
      raise exception 'change set must contain at least one item'
        using errcode = '22023';
    end if;
    perform token.id
    from public.site_design_tokens token
    join public.site_design_change_set_items item
      on item.token_id = token.id
    where item.change_set_id = p_change_set_id
    order by token.id
    for share of token;
    if exists (
      select 1
      from public.site_design_change_set_items item
      join public.site_design_tokens token on token.id = item.token_id
      where item.change_set_id = p_change_set_id
        and (
          token.cas_version <> item.expected_token_cas_version
          or not public.is_valid_site_design_token_value(
            token.category,
            token.value_type,
            item.proposed_value
          )
        )
    ) then
      raise exception 'change set contains stale or invalid token snapshots'
        using errcode = '40001';
    end if;
  end if;

  if current_change_set.status = 'draft' and p_target_status = 'review' then
    if p_scheduled_at is not null then
      raise exception 'review change set cannot be scheduled'
        using errcode = '22023';
    end if;
    update public.site_design_change_sets change_set
    set status = 'review',
        submitted_by = actor_id,
        submitted_at = now(),
        updated_by = actor_id,
        cas_version = current_change_set.cas_version + 1
    where change_set.id = p_change_set_id
    returning * into transitioned_change_set;
  elsif current_change_set.status = 'review'
    and p_target_status = 'approved' then
    update public.site_design_change_sets change_set
    set status = 'approved',
        scheduled_at = p_scheduled_at,
        approved_by = actor_id,
        approved_at = now(),
        updated_by = actor_id,
        cas_version = current_change_set.cas_version + 1
    where change_set.id = p_change_set_id
    returning * into transitioned_change_set;
  elsif current_change_set.status in ('draft', 'review', 'approved')
    and p_target_status = 'cancelled' then
    if p_scheduled_at is not null then
      raise exception 'cancelled change set cannot be scheduled'
        using errcode = '22023';
    end if;
    update public.site_design_change_sets change_set
    set status = 'cancelled',
        scheduled_at = null,
        cancelled_by = actor_id,
        cancelled_at = now(),
        updated_by = actor_id,
        cas_version = current_change_set.cas_version + 1
    where change_set.id = p_change_set_id
    returning * into transitioned_change_set;
  else
    raise exception 'invalid site design change set transition'
      using errcode = '22023';
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'site_design.change_set_transitioned',
    'site_design_change_set',
    p_change_set_id::text,
    jsonb_build_object(
      'from', current_change_set.status,
      'to', transitioned_change_set.status,
      'scheduledAt', transitioned_change_set.scheduled_at,
      'casVersion', transitioned_change_set.cas_version
    )
  );

  return transitioned_change_set;
end;
$$;

create or replace function public.publish_site_design_change_set(
  p_change_set_id uuid,
  p_expected_cas_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_role text := coalesce((select auth.role()), '');
  current_change_set public.site_design_change_sets%rowtype;
  published_change_set public.site_design_change_sets%rowtype;
  created_release public.site_design_releases%rowtype;
  item_count integer;
  outbox_id bigint;
begin
  if request_role <> 'service_role' and (
    actor_id is null or not public.is_staff(array[
      'owner'::public.staff_role,
      'admin'::public.staff_role
    ])
  ) then
    raise exception 'owner, admin or scheduler access required'
      using errcode = '42501';
  end if;

  -- Every public design release shares this transaction-scoped lock. The RPC
  -- either commits its complete token group, release, audit and outbox row, or
  -- PostgreSQL rolls the entire call back.
  perform pg_catalog.pg_advisory_xact_lock(52050103::bigint);
  select change_set.* into current_change_set
  from public.site_design_change_sets change_set
  where change_set.id = p_change_set_id
  for update;
  if not found then
    raise exception 'site design change set not found' using errcode = 'P0002';
  end if;
  if request_role = 'service_role' then
    actor_id := current_change_set.approved_by;
  end if;
  if actor_id is null then
    raise exception 'approved actor is required' using errcode = '42501';
  end if;
  if request_role = 'service_role' and not exists (
    select 1
    from public.staff_memberships membership
    where membership.user_id = actor_id
      and membership.role in (
        'owner'::public.staff_role,
        'admin'::public.staff_role
      )
  ) then
    raise exception 'approved actor no longer has publish access'
      using errcode = '42501';
  end if;
  if current_change_set.status <> 'approved' then
    raise exception 'only an approved change set can be published'
      using errcode = '55000';
  end if;
  if p_expected_cas_version is null
    or current_change_set.cas_version <> p_expected_cas_version then
    raise exception 'site design change set changed in another session'
      using errcode = '40001';
  end if;
  if current_change_set.scheduled_at is not null
    and current_change_set.scheduled_at > now() then
    raise exception 'site design change set is not due yet'
      using errcode = '55000';
  end if;

  select count(*) into item_count
  from public.site_design_change_set_items item
  where item.change_set_id = p_change_set_id;
  if item_count not between 1 and 256 then
    raise exception 'change set item count is invalid' using errcode = '22023';
  end if;

  perform component.component_key
  from public.site_component_registry component
  join public.site_design_tokens token
    on token.layer = 'component'
    and token.target_key = component.component_key
  join public.site_design_change_set_items item on item.token_id = token.id
  where item.change_set_id = p_change_set_id
  order by component.component_key
  for share of component;

  perform token.id
  from public.site_design_tokens token
  join public.site_design_change_set_items item on item.token_id = token.id
  where item.change_set_id = p_change_set_id
  order by token.id
  for update of token;

  if exists (
    select 1
    from public.site_design_change_set_items item
    join public.site_design_tokens token on token.id = item.token_id
    left join public.site_component_registry component
      on token.layer = 'component'
      and component.component_key = token.target_key
    where item.change_set_id = p_change_set_id
      and (
        token.cas_version <> item.expected_token_cas_version
        or not public.is_valid_site_design_token_value(
          token.category,
          token.value_type,
          item.proposed_value
        )
        or (
          token.layer = 'component'
          and (
            component.component_key is null
            or not component.is_active
            or (
              component.owner_lock
              and not exists (
                select 1
                from public.staff_memberships membership
                where membership.user_id = actor_id
                  and membership.role = 'owner'::public.staff_role
              )
            )
          )
        )
      )
  ) then
    raise exception 'change set contains stale, invalid or locked tokens'
      using errcode = '40001';
  end if;

  insert into public.site_design_releases (
    action, change_set_id, token_count, created_by
  ) values (
    'publish', p_change_set_id, item_count, actor_id
  ) returning * into created_release;

  insert into public.site_design_token_revisions (
    release_id, token_id, revision_number, action,
    previous_published_value, published_value,
    previous_cas_version, published_cas_version, created_by
  )
  select
    created_release.id,
    token.id,
    coalesce((
      select max(history.revision_number)
      from public.site_design_token_revisions history
      where history.token_id = token.id
    ), 0) + 1,
    'publish',
    token.published_value,
    item.proposed_value,
    token.cas_version,
    token.cas_version + 1,
    actor_id
  from public.site_design_change_set_items item
  join public.site_design_tokens token on token.id = item.token_id
  where item.change_set_id = p_change_set_id
  order by token.id;

  update public.site_design_tokens token
  set published_value = item.proposed_value,
      published_by = actor_id,
      published_at = now(),
      updated_by = actor_id,
      cas_version = token.cas_version + 1
  from public.site_design_change_set_items item
  where item.change_set_id = p_change_set_id
    and item.token_id = token.id;

  update public.site_design_change_sets change_set
  set status = 'published',
      published_by = actor_id,
      published_at = now(),
      updated_by = actor_id,
      cas_version = current_change_set.cas_version + 1
  where change_set.id = p_change_set_id
  returning * into published_change_set;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'site_design.change_set_published',
    'site_design_change_set',
    p_change_set_id::text,
    jsonb_build_object(
      'releaseId', created_release.id,
      'releaseNumber', created_release.release_number,
      'tokenCount', item_count,
      'scheduledAt', current_change_set.scheduled_at,
      'casVersion', published_change_set.cas_version
    )
  );
  outbox_id := public.append_public_build_outbox(
    actor_id,
    'site_design_release',
    created_release.id::text,
    'site-design-change-set-published',
    jsonb_build_object(
      'changeSetId', p_change_set_id,
      'releaseNumber', created_release.release_number,
      'tokenCount', item_count
    )
  );

  return jsonb_build_object(
    'changeSetId', p_change_set_id,
    'releaseId', created_release.id,
    'releaseNumber', created_release.release_number,
    'tokenCount', item_count,
    'casVersion', published_change_set.cas_version,
    'outboxId', outbox_id
  );
end;
$$;

create or replace function public.rollback_site_design_release(
  p_release_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_site_design_manager();
  source_release public.site_design_releases%rowtype;
  rollback_release public.site_design_releases%rowtype;
  source_revision_count integer;
  outbox_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(52050103::bigint);
  select release.* into source_release
  from public.site_design_releases release
  where release.id = p_release_id
  for update;
  if not found then
    raise exception 'site design release not found' using errcode = 'P0002';
  end if;
  if source_release.action <> 'publish' then
    raise exception 'only a publish release can be rolled back'
      using errcode = '55000';
  end if;
  if source_release.release_number <> (
    select max(release.release_number)
    from public.site_design_releases release
  ) then
    raise exception 'only the latest site design release can be rolled back'
      using errcode = '40001';
  end if;

  select count(*) into source_revision_count
  from public.site_design_token_revisions revision
  where revision.release_id = p_release_id;
  if source_revision_count <> source_release.token_count then
    raise exception 'site design release revision group is incomplete'
      using errcode = '55000';
  end if;
  if exists (
    select 1
    from public.site_design_token_revisions revision
    where revision.release_id = p_release_id
      and revision.action <> 'publish'
  ) then
    raise exception 'site design release revision group is invalid'
      using errcode = '55000';
  end if;

  perform component.component_key
  from public.site_component_registry component
  join public.site_design_tokens token
    on token.layer = 'component'
    and token.target_key = component.component_key
  join public.site_design_token_revisions revision
    on revision.token_id = token.id
  where revision.release_id = p_release_id
  order by component.component_key
  for share of component;

  perform token.id
  from public.site_design_tokens token
  join public.site_design_token_revisions revision
    on revision.token_id = token.id
  where revision.release_id = p_release_id
  order by token.id
  for update of token;

  if exists (
    select 1
    from public.site_design_token_revisions revision
    join public.site_design_tokens token on token.id = revision.token_id
    left join public.site_component_registry component
      on token.layer = 'component'
      and component.component_key = token.target_key
    where revision.release_id = p_release_id
      and (
        token.published_value is distinct from revision.published_value
        or (
          revision.previous_published_value is not null
          and not public.is_valid_site_design_token_value(
            token.category,
            token.value_type,
            revision.previous_published_value
          )
        )
        or (
          token.layer = 'component'
          and (
            component.component_key is null
            or not component.is_active
            or (
              component.owner_lock
              and not exists (
                select 1
                from public.staff_memberships membership
                where membership.user_id = actor_id
                  and membership.role = 'owner'::public.staff_role
              )
            )
          )
        )
      )
  ) then
    raise exception 'site design release is no longer the public boundary'
      using errcode = '40001';
  end if;

  insert into public.site_design_releases (
    action, rollback_of_release_id, token_count, created_by
  ) values (
    'rollback', source_release.id, source_revision_count, actor_id
  ) returning * into rollback_release;

  insert into public.site_design_token_revisions (
    release_id, token_id, revision_number, action,
    previous_published_value, published_value,
    previous_cas_version, published_cas_version,
    source_revision_id, created_by
  )
  select
    rollback_release.id,
    token.id,
    coalesce((
      select max(history.revision_number)
      from public.site_design_token_revisions history
      where history.token_id = token.id
    ), 0) + 1,
    'rollback',
    token.published_value,
    source_revision.previous_published_value,
    token.cas_version,
    token.cas_version + 1,
    source_revision.id,
    actor_id
  from public.site_design_token_revisions source_revision
  join public.site_design_tokens token on token.id = source_revision.token_id
  where source_revision.release_id = p_release_id
  order by token.id;

  update public.site_design_tokens token
  set published_value = source_revision.previous_published_value,
      published_by = case
        when source_revision.previous_published_value is null then null
        else actor_id
      end,
      published_at = case
        when source_revision.previous_published_value is null then null
        else now()
      end,
      updated_by = actor_id,
      cas_version = token.cas_version + 1
  from public.site_design_token_revisions source_revision
  where source_revision.release_id = p_release_id
    and source_revision.token_id = token.id;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'site_design.release_rolled_back',
    'site_design_release',
    rollback_release.id::text,
    jsonb_build_object(
      'sourceReleaseId', source_release.id,
      'sourceReleaseNumber', source_release.release_number,
      'releaseNumber', rollback_release.release_number,
      'tokenCount', source_revision_count
    )
  );
  outbox_id := public.append_public_build_outbox(
    actor_id,
    'site_design_release',
    rollback_release.id::text,
    'site-design-release-rolled-back',
    jsonb_build_object(
      'sourceReleaseId', source_release.id,
      'releaseNumber', rollback_release.release_number,
      'tokenCount', source_revision_count
    )
  );

  return jsonb_build_object(
    'sourceReleaseId', source_release.id,
    'releaseId', rollback_release.id,
    'releaseNumber', rollback_release.release_number,
    'tokenCount', source_revision_count,
    'outboxId', outbox_id
  );
end;
$$;

create or replace function public.get_published_site_design()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with bounded_tokens as (
    select
      token.id,
      token.layer,
      token.target_key,
      token.token_key,
      token.category,
      token.value_type,
      token.breakpoint,
      token.state,
      token.published_value
    from public.site_design_tokens token
    left join public.site_component_registry component
      on token.layer = 'component'
      and component.component_key = token.target_key
    where token.published_value is not null
      and (
        token.layer <> 'component'
        or (
          token.layer = 'component'
          and component.is_active
        )
      )
    order by
      token.layer,
      token.target_key,
      token.token_key,
      token.breakpoint,
      token.state,
      token.id
    limit 1024
  ), bounded_components as (
    select
      component.component_key,
      component.capabilities,
      component.slots,
      component.states,
      component.owner_lock
    from public.site_component_registry component
    where component.is_active
    order by component.component_key
    limit 256
  ), latest_release as (
    select release.id, release.release_number, release.action
    from public.site_design_releases release
    order by release.release_number desc
    limit 1
  )
  select jsonb_build_object(
    'release', (
      select jsonb_build_object(
        'id', release.id,
        'number', release.release_number,
        'action', release.action
      )
      from latest_release release
    ),
    'tokens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', token.id,
        'layer', token.layer,
        'targetKey', token.target_key,
        'key', token.token_key,
        'category', token.category,
        'valueType', token.value_type,
        'breakpoint', token.breakpoint,
        'state', token.state,
        'value', token.published_value
      ) order by
        token.layer,
        token.target_key,
        token.token_key,
        token.breakpoint,
        token.state,
        token.id
      )
      from bounded_tokens token
    ), '[]'::jsonb),
    'components', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', component.component_key,
        'capabilities', component.capabilities,
        'slots', component.slots,
        'states', component.states,
        'ownerLock', component.owner_lock
      ) order by component.component_key)
      from bounded_components component
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.is_valid_site_design_identifier_list(text[])
  from public, anon, authenticated, service_role;
revoke all on function public.is_valid_site_design_allowed_list(text[], text[])
  from public, anon, authenticated, service_role;
revoke all on function public.is_valid_site_design_length(
  jsonb, numeric, numeric, text[]
) from public, anon, authenticated, service_role;
revoke all on function public.is_valid_site_design_category_type(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.is_valid_site_design_token_value(
  text, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.require_site_design_manager()
  from public, anon, authenticated, service_role;
revoke all on function public.register_site_component_registry_record(
  text, text, text[], text[], text[], boolean, boolean, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.save_site_design_token(
  uuid, text, text, text, text, text, text, text, text, jsonb, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.save_site_design_change_set(
  uuid, text, text, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.set_site_design_change_set_item(
  uuid, uuid, bigint, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.remove_site_design_change_set_item(
  uuid, uuid, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.transition_site_design_change_set(
  uuid, bigint, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.publish_site_design_change_set(uuid, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.rollback_site_design_release(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_published_site_design()
  from public, anon, authenticated, service_role;

grant execute on function public.register_site_component_registry_record(
  text, text, text[], text[], text[], boolean, boolean, bigint
) to service_role;
grant execute on function public.save_site_design_token(
  uuid, text, text, text, text, text, text, text, text, jsonb, bigint
) to authenticated;
grant execute on function public.save_site_design_change_set(
  uuid, text, text, bigint
) to authenticated;
grant execute on function public.set_site_design_change_set_item(
  uuid, uuid, bigint, bigint
) to authenticated;
grant execute on function public.remove_site_design_change_set_item(
  uuid, uuid, bigint
) to authenticated;
grant execute on function public.transition_site_design_change_set(
  uuid, bigint, text, timestamptz
) to authenticated;
grant execute on function public.publish_site_design_change_set(uuid, bigint)
  to authenticated, service_role;
grant execute on function public.rollback_site_design_release(uuid)
  to authenticated;
grant execute on function public.get_published_site_design()
  to anon, authenticated, service_role;

-- Extend the complete predecessor probe instead of replacing older checks.
do $site_studio_health_predecessor$
begin
  if to_regprocedure(
    'public.get_editorial_schema_health_pre_site_studio()'
  ) is null then
    if to_regprocedure('public.get_editorial_schema_health()') is null then
      raise exception 'preceding editorial schema health RPC is missing';
    end if;
    alter function public.get_editorial_schema_health()
      rename to get_editorial_schema_health_pre_site_studio;
  end if;
end;
$site_studio_health_predecessor$;

revoke all on function public.get_editorial_schema_health_pre_site_studio()
  from public, anon, authenticated, service_role;

create or replace function public.get_editorial_schema_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_staff() then
    coalesce(
      public.get_editorial_schema_health_pre_site_studio(),
      '{}'::jsonb
    ) || jsonb_build_object(
      'version', '20260901_zz_site_studio_engine',
      'checkedAt', now(),
      'siteStudioEngine',
        to_regclass('public.site_component_registry') is not null
        and to_regclass('public.site_design_tokens') is not null
        and to_regclass('public.site_design_change_sets') is not null
        and to_regclass('public.site_design_change_set_items') is not null
        and to_regclass('public.site_design_releases') is not null
        and to_regclass('public.site_design_token_revisions') is not null
        and to_regprocedure(
          'public.register_site_component_registry_record(text,text,text[],text[],text[],boolean,boolean,bigint)'
        ) is not null
        and to_regprocedure(
          'public.save_site_design_token(uuid,text,text,text,text,text,text,text,text,jsonb,bigint)'
        ) is not null
        and to_regprocedure(
          'public.transition_site_design_change_set(uuid,bigint,text,timestamp with time zone)'
        ) is not null
        and to_regprocedure(
          'public.publish_site_design_change_set(uuid,bigint)'
        ) is not null
        and to_regprocedure(
          'public.rollback_site_design_release(uuid)'
        ) is not null
        and to_regprocedure(
          'public.get_published_site_design()'
        ) is not null
        and public.is_valid_site_design_token_value(
          'color', 'color', '"#aabbcc"'::jsonb
        )
        and public.is_valid_site_design_token_value(
          'spacing', 'length', '{"value":16,"unit":"px"}'::jsonb
        )
        and public.is_valid_site_design_token_value(
          'motion',
          'effect',
          '{"name":"fade","durationMs":180,"easing":"ease-out","reducedMotionFallback":"none"}'::jsonb
        )
        and not public.is_valid_site_design_token_value(
          'color', 'color', '"url(javascript:alert(1))"'::jsonb
        )
        and not public.is_valid_site_design_token_value(
          'spacing', 'layout', '{"display":"block"}'::jsonb
        )
        and (
          select count(*) <= 1024 from public.site_design_tokens
        )
        and (
          select
            count(*) = 8
            and pg_catalog.bool_and(component.is_active)
            and pg_catalog.bool_and(
              component.owner_lock = (
                component.component_key = any(
                  array['bookshelf', 'literary-globe']::text[]
                )
              )
            )
            and pg_catalog.array_agg(
              component.component_key order by component.component_key
            ) = array[
              'article-reader',
              'bookshelf',
              'cms-page-reader',
              'journal',
              'literary-globe',
              'magazine',
              'site-footer',
              'site-header'
            ]::text[]
          from public.site_component_registry component
        )
        and (
          select count(*) = 6
          from pg_catalog.pg_class relation
          join pg_catalog.pg_namespace namespace
            on namespace.oid = relation.relnamespace
          where namespace.nspname = 'public'
            and relation.relname = any(array[
              'site_component_registry',
              'site_design_tokens',
              'site_design_change_sets',
              'site_design_change_set_items',
              'site_design_releases',
              'site_design_token_revisions'
            ]::name[])
            and relation.relrowsecurity
            and relation.relforcerowsecurity
        )
        and (
          select count(*) = 6
          from pg_catalog.pg_policies policy
          where policy.schemaname = 'public'
            and policy.tablename = any(array[
              'site_component_registry',
              'site_design_tokens',
              'site_design_change_sets',
              'site_design_change_set_items',
              'site_design_releases',
              'site_design_token_revisions'
            ])
            and policy.cmd = 'SELECT'
            and policy.roles = array['authenticated'::name]
            and position('is_staff' in coalesce(policy.qual, '')) > 0
        )
        and not has_table_privilege(
          'anon', 'public.site_component_registry', 'SELECT'
        )
        and not has_table_privilege(
          'anon', 'public.site_design_tokens', 'SELECT'
        )
        and not has_table_privilege(
          'authenticated', 'public.site_design_tokens', 'INSERT'
        )
        and not has_table_privilege(
          'authenticated', 'public.site_design_tokens', 'UPDATE'
        )
        and not has_table_privilege(
          'authenticated', 'public.site_design_change_sets', 'INSERT'
        )
        and not has_table_privilege(
          'authenticated', 'public.site_design_change_set_items', 'UPDATE'
        )
        and has_function_privilege(
          'anon', 'public.get_published_site_design()', 'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.publish_site_design_change_set(uuid,bigint)',
          'EXECUTE'
        )
        and has_function_privilege(
          'authenticated',
          'public.publish_site_design_change_set(uuid,bigint)',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.publish_site_design_change_set(uuid,bigint)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.register_site_component_registry_record(text,text,text[],text[],text[],boolean,boolean,bigint)',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.register_site_component_registry_record(text,text,text[],text[],text[],boolean,boolean,bigint)',
          'EXECUTE'
        )
    )
    else null
  end;
$$;

revoke all on function public.get_editorial_schema_health()
  from public, anon, authenticated, service_role;
grant execute on function public.get_editorial_schema_health()
  to authenticated;
