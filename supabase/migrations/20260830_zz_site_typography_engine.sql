-- Stage 5 / Site Studio: immutable font assets and versioned typography.
-- Draft values stay private to staff. Only an explicit publish/restore RPC
-- changes the public snapshot and appends a durable public-build request.

create table if not exists public.font_assets (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (
    source_type in ('system', 'bundled', 'uploaded')
  ),
  storage_bucket text,
  object_path text,
  original_name text,
  display_name text not null check (char_length(display_name) between 1 and 120),
  family_name text not null check (char_length(family_name) between 1 and 120),
  format text check (format is null or format in ('woff', 'woff2')),
  mime_type text,
  sha256_hex text check (
    sha256_hex is null or sha256_hex ~ '^[0-9a-f]{64}$'
  ),
  byte_size bigint check (
    byte_size is null or byte_size between 1 and 2097152
  ),
  is_variable boolean not null default false,
  weight_min smallint not null default 400 check (weight_min between 1 and 1000),
  weight_max smallint not null default 400 check (weight_max between 1 and 1000),
  font_style text not null default 'normal' check (
    font_style in ('normal', 'italic', 'oblique')
  ),
  license_name text check (
    license_name is null or char_length(license_name) between 1 and 180
  ),
  license_url text check (
    license_url is null
    or (
      char_length(license_url) <= 2048
      and license_url ~* '^https?://'
    )
  ),
  uploaded_by uuid references auth.users(id) on delete restrict,
  cas_version bigint not null default 1 check (cas_version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete restrict,
  deleted_reason text check (
    deleted_reason is null or char_length(deleted_reason) between 1 and 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (weight_min <= weight_max),
  check (is_variable or weight_min = weight_max),
  check (
    (deleted_at is null and deleted_by is null and deleted_reason is null)
    or (
      deleted_at is not null
      and deleted_by is not null
      and deleted_reason is not null
    )
  ),
  check (
    (
      source_type = 'system'
      and storage_bucket is null
      and object_path is null
      and original_name is null
      and format is null
      and mime_type is null
      and sha256_hex is null
      and byte_size is null
      and uploaded_by is null
    )
    or (
      source_type in ('bundled', 'uploaded')
      and storage_bucket = 'site-fonts'
      and object_path is not null
      and original_name is not null
      and char_length(original_name) between 1 and 255
      and format in ('woff', 'woff2')
      and mime_type = case format
        when 'woff' then 'font/woff'
        when 'woff2' then 'font/woff2'
      end
      and sha256_hex is not null
      and byte_size is not null
      and license_name is not null
      and object_path = (
        'sha256/' || substr(sha256_hex, 1, 2) || '/' ||
        sha256_hex || '.' || format
      )
      and (
        (source_type = 'bundled' and uploaded_by is null)
        or (source_type = 'uploaded' and uploaded_by is not null)
      )
    )
  )
);

create table if not exists public.site_typography_overrides (
  id uuid primary key default gen_random_uuid(),
  layer text not null check (
    layer in ('site', 'component', 'template', 'page', 'instance')
  ),
  target_key text not null check (
    target_key ~ '^[a-z0-9][a-z0-9_-]{0,79}$'
  ),
  semantic_scope text not null check (
    semantic_scope in (
      'body', 'navigation', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'article', 'page', 'lead', 'quote', 'caption', 'button', 'card',
      'footer'
    )
  ),
  breakpoint text not null check (
    breakpoint in ('base', 'mobile', 'tablet', 'desktop')
  ),
  draft_settings jsonb not null default '{}'::jsonb,
  published_settings jsonb,
  cas_version bigint not null default 1 check (cas_version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  published_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (layer, target_key, semantic_scope, breakpoint),
  check ((layer = 'site' and target_key = 'site') or layer <> 'site'),
  check (jsonb_typeof(draft_settings) = 'object'),
  check (
    published_settings is null
    or jsonb_typeof(published_settings) = 'object'
  ),
  check (
    (published_settings is null and published_at is null and published_by is null)
    or (
      published_settings is not null
      and published_at is not null
      and published_by is not null
    )
  )
);

create table if not exists public.site_typography_revisions (
  id bigint generated always as identity primary key,
  override_id uuid not null references public.site_typography_overrides(id)
    on delete restrict,
  revision_number bigint not null check (revision_number > 0),
  action text not null check (action in ('publish', 'restore')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  restored_from_revision_id bigint references public.site_typography_revisions(id)
    on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (override_id, revision_number)
);

create unique index if not exists font_assets_active_sha256_idx
  on public.font_assets(sha256_hex)
  where sha256_hex is not null and deleted_at is null;
create unique index if not exists font_assets_storage_object_idx
  on public.font_assets(storage_bucket, object_path)
  where storage_bucket is not null
    and object_path is not null
    and deleted_at is null;
create index if not exists font_assets_active_family_idx
  on public.font_assets(family_name, weight_min, weight_max, font_style)
  where deleted_at is null;
create index if not exists site_typography_published_lookup_idx
  on public.site_typography_overrides(
    layer, target_key, semantic_scope, breakpoint
  )
  where published_settings is not null;
create index if not exists site_typography_revision_history_idx
  on public.site_typography_revisions(override_id, revision_number desc);

create or replace function public.is_valid_site_typography_settings(
  p_settings jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  setting_key text;
  numeric_value numeric;
  family_id text;
begin
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    return false;
  end if;

  for setting_key in select jsonb_object_keys(p_settings)
  loop
    if setting_key <> all(array[
      'familyId', 'systemFamily', 'fontSize', 'fontWeight',
      'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign',
      'textTransform', 'textDecoration', 'textIndent', 'wordSpacing'
    ]::text[]) then
      return false;
    end if;
  end loop;

  if p_settings ? 'familyId' and p_settings ? 'systemFamily' then
    return false;
  end if;

  family_id := p_settings ->> 'familyId';
  if family_id is not null and family_id !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  if p_settings ? 'systemFamily' and (
    jsonb_typeof(p_settings -> 'systemFamily') <> 'string'
    or p_settings ->> 'systemFamily' not in (
      'system-sans', 'system-serif', 'georgia', 'arial', 'times'
    )
  ) then
    return false;
  end if;

  if p_settings ? 'fontSize' then
    if jsonb_typeof(p_settings -> 'fontSize') <> 'number' then return false; end if;
    numeric_value := (p_settings ->> 'fontSize')::numeric;
    if numeric_value < 8 or numeric_value > 144 then return false; end if;
  end if;
  if p_settings ? 'fontWeight' then
    if jsonb_typeof(p_settings -> 'fontWeight') <> 'number' then return false; end if;
    numeric_value := (p_settings ->> 'fontWeight')::numeric;
    if numeric_value < 1 or numeric_value > 1000
      or trunc(numeric_value) <> numeric_value then return false; end if;
  end if;
  if p_settings ? 'lineHeight' then
    if jsonb_typeof(p_settings -> 'lineHeight') <> 'number' then return false; end if;
    numeric_value := (p_settings ->> 'lineHeight')::numeric;
    if numeric_value < 0.8 or numeric_value > 3 then return false; end if;
  end if;
  if p_settings ? 'letterSpacing' then
    if jsonb_typeof(p_settings -> 'letterSpacing') <> 'number' then return false; end if;
    numeric_value := (p_settings ->> 'letterSpacing')::numeric;
    if numeric_value < -0.2 or numeric_value > 1 then return false; end if;
  end if;
  if p_settings ? 'textIndent' then
    if jsonb_typeof(p_settings -> 'textIndent') <> 'number' then return false; end if;
    numeric_value := (p_settings ->> 'textIndent')::numeric;
    if numeric_value < 0 or numeric_value > 12 then return false; end if;
  end if;
  if p_settings ? 'wordSpacing' then
    if jsonb_typeof(p_settings -> 'wordSpacing') <> 'number' then return false; end if;
    numeric_value := (p_settings ->> 'wordSpacing')::numeric;
    if numeric_value < -0.2 or numeric_value > 2 then return false; end if;
  end if;

  if p_settings ? 'fontStyle' and (
    jsonb_typeof(p_settings -> 'fontStyle') <> 'string'
    or p_settings ->> 'fontStyle' not in ('normal', 'italic', 'oblique')
  ) then return false; end if;
  if p_settings ? 'textAlign' and (
    jsonb_typeof(p_settings -> 'textAlign') <> 'string'
    or p_settings ->> 'textAlign' not in ('left', 'center', 'right', 'justify')
  ) then return false; end if;
  if p_settings ? 'textTransform' and (
    jsonb_typeof(p_settings -> 'textTransform') <> 'string'
    or p_settings ->> 'textTransform' not in (
      'none', 'uppercase', 'lowercase', 'capitalize'
    )
  ) then return false; end if;
  if p_settings ? 'textDecoration' and (
    jsonb_typeof(p_settings -> 'textDecoration') <> 'string'
    or p_settings ->> 'textDecoration' not in (
      'none', 'underline', 'line-through'
    )
  ) then return false; end if;

  return true;
exception
  when others then return false;
end;
$$;

create or replace function public.assert_site_typography_font_reference(
  p_settings jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  font_id uuid;
begin
  if not public.is_valid_site_typography_settings(p_settings) then
    raise exception 'typography settings are invalid' using errcode = '22023';
  end if;
  if p_settings ->> 'familyId' is null then
    return;
  end if;
  font_id := (p_settings ->> 'familyId')::uuid;
  if not exists (
    select 1
    from public.font_assets asset
    where asset.id = font_id
      and asset.source_type in ('bundled', 'uploaded')
      and asset.deleted_at is null
  ) then
    raise exception 'active self-hosted font asset is required'
      using errcode = '23503';
  end if;
end;
$$;

create or replace function public.guard_font_asset_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if row(
    new.source_type, new.storage_bucket, new.object_path, new.original_name,
    new.format, new.mime_type, new.sha256_hex, new.byte_size, new.uploaded_by
  ) is distinct from row(
    old.source_type, old.storage_bucket, old.object_path, old.original_name,
    old.format, old.mime_type, old.sha256_hex, old.byte_size, old.uploaded_by
  ) then
    raise exception 'font binary identity is immutable' using errcode = '55000';
  end if;
  if new.cas_version <> old.cas_version + 1 then
    raise exception 'font asset changed in another session' using errcode = '40001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.audit_font_asset_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    coalesce(new.uploaded_by, (select auth.uid())),
    'typography.font_registered',
    'font_asset',
    new.id::text,
    jsonb_build_object(
      'sourceType', new.source_type,
      'familyName', new.family_name,
      'format', new.format,
      'sha256Hex', new.sha256_hex,
      'byteSize', new.byte_size,
      'casVersion', new.cas_version
    )
  );
  return new;
end;
$$;

drop trigger if exists font_assets_guard_update on public.font_assets;
create trigger font_assets_guard_update
  before update on public.font_assets
  for each row execute function public.guard_font_asset_update();

drop trigger if exists font_assets_audit_insert on public.font_assets;
create trigger font_assets_audit_insert
  after insert on public.font_assets
  for each row execute function public.audit_font_asset_insert();

drop trigger if exists site_typography_overrides_set_updated_at
  on public.site_typography_overrides;
create trigger site_typography_overrides_set_updated_at
  before update on public.site_typography_overrides
  for each row execute function public.set_updated_at();

alter table public.font_assets enable row level security;
alter table public.site_typography_overrides enable row level security;
alter table public.site_typography_revisions enable row level security;

drop policy if exists "Staff read font assets" on public.font_assets;
create policy "Staff read font assets"
on public.font_assets for select
to authenticated
using (public.is_staff());

drop policy if exists "Owners and admins register uploaded fonts"
  on public.font_assets;
create policy "Owners and admins register uploaded fonts"
on public.font_assets for insert
to authenticated
with check (
  source_type = 'uploaded'
  and uploaded_by = (select auth.uid())
  and public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ])
);

drop policy if exists "Owners and admins archive font assets"
  on public.font_assets;

drop policy if exists "Staff read typography overrides"
  on public.site_typography_overrides;
create policy "Staff read typography overrides"
on public.site_typography_overrides for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read typography revisions"
  on public.site_typography_revisions;
create policy "Staff read typography revisions"
on public.site_typography_revisions for select
to authenticated
using (public.is_staff());

revoke all on public.font_assets from anon, authenticated;
revoke all on public.site_typography_overrides from anon, authenticated;
revoke all on public.site_typography_revisions from anon, authenticated;
grant select on public.font_assets to authenticated;
grant insert (
  source_type, storage_bucket, object_path, original_name, display_name,
  family_name, format, mime_type, sha256_hex, byte_size, is_variable,
  weight_min, weight_max, font_style, license_name, license_url, uploaded_by
) on public.font_assets to authenticated;
grant select on public.site_typography_overrides to authenticated;
grant select on public.site_typography_revisions to authenticated;

create or replace function public.archive_font_asset(
  p_font_id uuid,
  p_expected_cas_version bigint,
  p_reason text
)
returns public.font_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_asset public.font_assets%rowtype;
  archived_asset public.font_assets%rowtype;
begin
  if actor_id is null or not public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ]) then
    raise exception 'owner or admin access required' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null or char_length(trim(p_reason)) > 500 then
    raise exception 'font archive reason is required' using errcode = '22023';
  end if;
  select asset.* into current_asset
  from public.font_assets asset
  where asset.id = p_font_id
  for update;
  if not found then
    raise exception 'font asset not found' using errcode = 'P0002';
  end if;
  if current_asset.deleted_at is not null then
    raise exception 'font asset is already archived' using errcode = '55000';
  end if;
  if p_expected_cas_version is null
    or current_asset.cas_version <> p_expected_cas_version then
    raise exception 'font asset changed in another session'
      using errcode = '40001';
  end if;
  if exists (
    select 1
    from public.site_typography_overrides override_row
    where override_row.draft_settings ->> 'familyId' = p_font_id::text
      or override_row.published_settings ->> 'familyId' = p_font_id::text
  ) or exists (
    select 1
    from public.site_typography_revisions revision
    where revision.snapshot -> 'publishedSettings' ->> 'familyId' =
      p_font_id::text
  ) then
    raise exception 'font asset is referenced by typography'
      using errcode = '23503';
  end if;

  update public.font_assets asset
  set deleted_at = now(),
      deleted_by = actor_id,
      deleted_reason = trim(p_reason),
      cas_version = current_asset.cas_version + 1
  where asset.id = p_font_id
  returning * into archived_asset;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'typography.font_archived',
    'font_asset',
    p_font_id::text,
    jsonb_build_object(
      'sourceType', archived_asset.source_type,
      'familyName', archived_asset.family_name,
      'reason', archived_asset.deleted_reason,
      'casVersion', archived_asset.cas_version,
      'physicalObjectDeleted', false
    )
  );

  return archived_asset;
end;
$$;

create or replace function public.save_site_typography_override(
  p_override_id uuid,
  p_layer text,
  p_target_key text,
  p_semantic_scope text,
  p_breakpoint text,
  p_draft_settings jsonb,
  p_expected_cas_version bigint
)
returns public.site_typography_overrides
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_override public.site_typography_overrides%rowtype;
  saved_override public.site_typography_overrides%rowtype;
begin
  if actor_id is null or not public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ]) then
    raise exception 'owner or admin access required' using errcode = '42501';
  end if;
  if p_layer not in ('site', 'component', 'template', 'page', 'instance')
    or p_target_key is null
    or p_target_key !~ '^[a-z0-9][a-z0-9_-]{0,79}$'
    or (p_layer = 'site' and p_target_key <> 'site')
    or p_semantic_scope not in (
      'body', 'navigation', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'article', 'page', 'lead', 'quote', 'caption', 'button', 'card',
      'footer'
    )
    or p_breakpoint not in ('base', 'mobile', 'tablet', 'desktop') then
    raise exception 'typography override identity is invalid'
      using errcode = '22023';
  end if;
  perform public.assert_site_typography_font_reference(p_draft_settings);

  if p_override_id is null then
    if p_expected_cas_version is not null then
      raise exception 'new typography override cannot have an expected version'
        using errcode = '22023';
    end if;
    insert into public.site_typography_overrides (
      layer, target_key, semantic_scope, breakpoint, draft_settings,
      created_by, updated_by
    ) values (
      p_layer, p_target_key, p_semantic_scope, p_breakpoint,
      p_draft_settings, actor_id, actor_id
    ) returning * into saved_override;
  else
    select override_row.* into current_override
    from public.site_typography_overrides override_row
    where override_row.id = p_override_id
    for update;
    if not found then
      raise exception 'typography override not found' using errcode = 'P0002';
    end if;
    if p_expected_cas_version is null
      or current_override.cas_version <> p_expected_cas_version then
      raise exception 'typography override changed in another session'
        using errcode = '40001';
    end if;
    update public.site_typography_overrides override_row
    set layer = p_layer,
        target_key = p_target_key,
        semantic_scope = p_semantic_scope,
        breakpoint = p_breakpoint,
        draft_settings = p_draft_settings,
        updated_by = actor_id,
        cas_version = current_override.cas_version + 1
    where override_row.id = p_override_id
    returning * into saved_override;
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'typography.override_saved',
    'site_typography_override',
    saved_override.id::text,
    jsonb_build_object(
      'layer', saved_override.layer,
      'targetKey', saved_override.target_key,
      'semanticScope', saved_override.semantic_scope,
      'breakpoint', saved_override.breakpoint,
      'casVersion', saved_override.cas_version
    )
  );

  return saved_override;
end;
$$;

create or replace function public.publish_site_typography_override(
  p_override_id uuid,
  p_expected_cas_version bigint
)
returns public.site_typography_overrides
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_override public.site_typography_overrides%rowtype;
  published_override public.site_typography_overrides%rowtype;
  next_revision bigint;
begin
  if actor_id is null or not public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ]) then
    raise exception 'owner or admin access required' using errcode = '42501';
  end if;
  select override_row.* into current_override
  from public.site_typography_overrides override_row
  where override_row.id = p_override_id
  for update;
  if not found then
    raise exception 'typography override not found' using errcode = 'P0002';
  end if;
  if p_expected_cas_version is null
    or current_override.cas_version <> p_expected_cas_version then
    raise exception 'typography override changed in another session'
      using errcode = '40001';
  end if;
  perform public.assert_site_typography_font_reference(
    current_override.draft_settings
  );

  update public.site_typography_overrides override_row
  set published_settings = current_override.draft_settings,
      published_by = actor_id,
      published_at = now(),
      updated_by = actor_id,
      cas_version = current_override.cas_version + 1
  where override_row.id = p_override_id
  returning * into published_override;

  select coalesce(max(revision.revision_number), 0) + 1
  into next_revision
  from public.site_typography_revisions revision
  where revision.override_id = p_override_id;

  insert into public.site_typography_revisions (
    override_id, revision_number, action, snapshot, created_by
  ) values (
    p_override_id,
    next_revision,
    'publish',
    jsonb_build_object(
      'layer', published_override.layer,
      'targetKey', published_override.target_key,
      'semanticScope', published_override.semantic_scope,
      'breakpoint', published_override.breakpoint,
      'publishedSettings', published_override.published_settings,
      'casVersion', published_override.cas_version
    ),
    actor_id
  );

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'typography.override_published',
    'site_typography_override',
    p_override_id::text,
    jsonb_build_object(
      'revisionNumber', next_revision,
      'casVersion', published_override.cas_version
    )
  );
  perform public.append_public_build_outbox(
    actor_id,
    'site_typography_override',
    p_override_id::text,
    'typography-published',
    jsonb_build_object(
      'revisionNumber', next_revision,
      'casVersion', published_override.cas_version
    )
  );

  return published_override;
end;
$$;

create or replace function public.restore_site_typography_revision(
  p_revision_id bigint,
  p_expected_cas_version bigint
)
returns public.site_typography_overrides
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  source_revision public.site_typography_revisions%rowtype;
  current_override public.site_typography_overrides%rowtype;
  restored_override public.site_typography_overrides%rowtype;
  restored_settings jsonb;
  restored_layer text;
  restored_target_key text;
  restored_semantic_scope text;
  restored_breakpoint text;
  next_revision bigint;
begin
  if actor_id is null or not public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ]) then
    raise exception 'owner or admin access required' using errcode = '42501';
  end if;
  select revision.* into source_revision
  from public.site_typography_revisions revision
  where revision.id = p_revision_id;
  if not found then
    raise exception 'typography revision not found' using errcode = 'P0002';
  end if;

  select override_row.* into current_override
  from public.site_typography_overrides override_row
  where override_row.id = source_revision.override_id
  for update;
  if not found then
    raise exception 'typography override not found' using errcode = 'P0002';
  end if;
  if p_expected_cas_version is null
    or current_override.cas_version <> p_expected_cas_version then
    raise exception 'typography override changed in another session'
      using errcode = '40001';
  end if;
  restored_settings := source_revision.snapshot -> 'publishedSettings';
  restored_layer := source_revision.snapshot ->> 'layer';
  restored_target_key := source_revision.snapshot ->> 'targetKey';
  restored_semantic_scope := source_revision.snapshot ->> 'semanticScope';
  restored_breakpoint := source_revision.snapshot ->> 'breakpoint';
  if restored_layer not in (
      'site', 'component', 'template', 'page', 'instance'
    )
    or restored_target_key is null
    or restored_target_key !~ '^[a-z0-9][a-z0-9_-]{0,79}$'
    or (restored_layer = 'site' and restored_target_key <> 'site')
    or restored_semantic_scope not in (
      'body', 'navigation', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'article', 'page', 'lead', 'quote', 'caption', 'button', 'card',
      'footer'
    )
    or restored_breakpoint not in ('base', 'mobile', 'tablet', 'desktop') then
    raise exception 'typography revision identity is invalid'
      using errcode = '22023';
  end if;
  perform public.assert_site_typography_font_reference(restored_settings);
  if exists (
    select 1
    from public.site_typography_overrides conflicting_override
    where conflicting_override.id <> current_override.id
      and conflicting_override.layer = restored_layer
      and conflicting_override.target_key = restored_target_key
      and conflicting_override.semantic_scope = restored_semantic_scope
      and conflicting_override.breakpoint = restored_breakpoint
  ) then
    raise exception 'typography revision identity is already in use'
      using errcode = '23505';
  end if;

  update public.site_typography_overrides override_row
  set layer = restored_layer,
      target_key = restored_target_key,
      semantic_scope = restored_semantic_scope,
      breakpoint = restored_breakpoint,
      draft_settings = restored_settings,
      published_settings = restored_settings,
      published_by = actor_id,
      published_at = now(),
      updated_by = actor_id,
      cas_version = current_override.cas_version + 1
  where override_row.id = current_override.id
  returning * into restored_override;

  select coalesce(max(revision.revision_number), 0) + 1
  into next_revision
  from public.site_typography_revisions revision
  where revision.override_id = restored_override.id;

  insert into public.site_typography_revisions (
    override_id, revision_number, action, snapshot,
    restored_from_revision_id, created_by
  ) values (
    restored_override.id,
    next_revision,
    'restore',
    jsonb_build_object(
      'layer', restored_override.layer,
      'targetKey', restored_override.target_key,
      'semanticScope', restored_override.semantic_scope,
      'breakpoint', restored_override.breakpoint,
      'publishedSettings', restored_override.published_settings,
      'casVersion', restored_override.cas_version
    ),
    source_revision.id,
    actor_id
  );

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor_id,
    'typography.revision_restored',
    'site_typography_override',
    restored_override.id::text,
    jsonb_build_object(
      'sourceRevisionId', source_revision.id,
      'revisionNumber', next_revision,
      'casVersion', restored_override.cas_version
    )
  );
  perform public.append_public_build_outbox(
    actor_id,
    'site_typography_override',
    restored_override.id::text,
    'typography-restored',
    jsonb_build_object(
      'sourceRevisionId', source_revision.id,
      'revisionNumber', next_revision,
      'casVersion', restored_override.cas_version
    )
  );

  return restored_override;
end;
$$;

create or replace function public.get_published_site_typography()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with published_overrides as (
    select
      override_row.layer,
      override_row.target_key,
      override_row.semantic_scope,
      override_row.breakpoint,
      override_row.published_settings
    from public.site_typography_overrides override_row
    where override_row.published_settings is not null
  ), referenced_fonts as (
    select distinct (override_row.published_settings ->> 'familyId')::uuid as id
    from published_overrides override_row
    where override_row.published_settings ->> 'familyId' is not null
  )
  select jsonb_build_object(
    'overrides', coalesce((
      select jsonb_agg(jsonb_build_object(
        'layer', override_row.layer,
        'targetKey', override_row.target_key,
        'semanticScope', override_row.semantic_scope,
        'breakpoint', override_row.breakpoint,
        'settings', override_row.published_settings
      ) order by
        override_row.layer,
        override_row.target_key,
        override_row.semantic_scope,
        override_row.breakpoint
      )
      from published_overrides override_row
    ), '[]'::jsonb),
    'fonts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', asset.id,
        'familyName', asset.family_name,
        'sourceType', asset.source_type,
        'format', asset.format,
        'fontStyle', asset.font_style,
        'isVariable', asset.is_variable,
        'weightMin', asset.weight_min,
        'weightMax', asset.weight_max
      ) order by asset.id)
      from public.font_assets asset
      join referenced_fonts reference on reference.id = asset.id
      where asset.deleted_at is null
        and asset.source_type in ('bundled', 'uploaded')
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.is_valid_site_typography_settings(jsonb)
  from public;
revoke all on function public.assert_site_typography_font_reference(jsonb)
  from public;
revoke all on function public.guard_font_asset_update() from public;
revoke all on function public.audit_font_asset_insert() from public;
revoke all on function public.archive_font_asset(uuid, bigint, text)
  from public;
revoke all on function public.save_site_typography_override(
  uuid, text, text, text, text, jsonb, bigint
) from public;
revoke all on function public.publish_site_typography_override(uuid, bigint)
  from public;
revoke all on function public.restore_site_typography_revision(bigint, bigint)
  from public;
revoke all on function public.get_published_site_typography() from public;
grant execute on function public.save_site_typography_override(
  uuid, text, text, text, text, jsonb, bigint
) to authenticated;
grant execute on function public.archive_font_asset(uuid, bigint, text)
  to authenticated;
grant execute on function public.publish_site_typography_override(uuid, bigint)
  to authenticated;
grant execute on function public.restore_site_typography_revision(bigint, bigint)
  to authenticated;
grant execute on function public.get_published_site_typography()
  to anon, authenticated;

-- Supabase Storage keeps font objects immutable, content-addressed and private.
-- The trusted publication exporter verifies and copies bytes to its public
-- artifact; browsers never receive a Storage object path from this schema.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'site-fonts',
  'site-fonts',
  false,
  2097152,
  array['font/woff', 'font/woff2']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read site fonts" on storage.objects;

drop policy if exists "Owners and admins upload site fonts"
  on storage.objects;
create policy "Owners and admins upload site fonts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'site-fonts'
  and name ~ '^sha256/[0-9a-f]{2}/[0-9a-f]{64}\.(woff|woff2)$'
  and owner_id = (select auth.uid())::text
  and public.is_staff(array[
    'owner'::public.staff_role,
    'admin'::public.staff_role
  ])
);

-- Preserve the complete preceding health contract without duplicating it.
-- Renaming keeps the original function body and OID; the new public name adds
-- the typography checks and remains the sole callable health endpoint.
do $typography_health_predecessor$
begin
  if to_regprocedure(
    'public.get_editorial_schema_health_pre_typography()'
  ) is null then
    if to_regprocedure('public.get_editorial_schema_health()') is null then
      raise exception 'preceding editorial schema health RPC is missing';
    end if;
    alter function public.get_editorial_schema_health()
      rename to get_editorial_schema_health_pre_typography;
  end if;
end;
$typography_health_predecessor$;

revoke all on function public.get_editorial_schema_health_pre_typography()
  from public, anon, authenticated;

create or replace function public.get_editorial_schema_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_staff() then
    coalesce(
      public.get_editorial_schema_health_pre_typography(),
      '{}'::jsonb
    ) || jsonb_build_object(
      'version', '20260830_zz_site_typography_engine',
      'checkedAt', now(),
      'siteTypographyEngine',
        to_regclass('public.font_assets') is not null
        and to_regclass('public.site_typography_overrides') is not null
        and to_regclass('public.site_typography_revisions') is not null
        and to_regprocedure(
          'public.archive_font_asset(uuid,bigint,text)'
        ) is not null
        and to_regprocedure(
          'public.audit_font_asset_insert()'
        ) is not null
        and to_regprocedure(
          'public.save_site_typography_override(uuid,text,text,text,text,jsonb,bigint)'
        ) is not null
        and to_regprocedure(
          'public.publish_site_typography_override(uuid,bigint)'
        ) is not null
        and to_regprocedure(
          'public.restore_site_typography_revision(bigint,bigint)'
        ) is not null
        and to_regprocedure(
          'public.get_published_site_typography()'
        ) is not null
        and public.is_valid_site_typography_settings('{}'::jsonb)
        and not public.is_valid_site_typography_settings(
          '{"unknownToken": true}'::jsonb
        )
        and not has_table_privilege(
          'anon', 'public.font_assets', 'SELECT'
        )
        and not has_table_privilege(
          'anon', 'public.site_typography_revisions', 'SELECT'
        )
        and not has_table_privilege(
          'authenticated', 'public.font_assets', 'UPDATE'
        )
        and not has_table_privilege(
          'authenticated', 'public.font_assets', 'DELETE'
        )
        and not has_table_privilege(
          'authenticated', 'public.font_assets', 'INSERT'
        )
        and has_column_privilege(
          'authenticated', 'public.font_assets', 'uploaded_by', 'INSERT'
        )
        and not has_table_privilege(
          'anon', 'public.site_typography_overrides', 'SELECT'
        )
        and not has_table_privilege(
          'authenticated', 'public.site_typography_overrides', 'INSERT'
        )
        and not has_table_privilege(
          'authenticated', 'public.site_typography_overrides', 'UPDATE'
        )
        and not has_table_privilege(
          'authenticated', 'public.site_typography_overrides', 'DELETE'
        )
        and has_function_privilege(
          'anon', 'public.get_published_site_typography()', 'EXECUTE'
        )
        and not has_function_privilege(
          'anon', 'public.archive_font_asset(uuid,bigint,text)', 'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.save_site_typography_override(uuid,text,text,text,text,jsonb,bigint)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.publish_site_typography_override(uuid,bigint)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.restore_site_typography_revision(bigint,bigint)',
          'EXECUTE'
        )
        and has_function_privilege(
          'authenticated',
          'public.archive_font_asset(uuid,bigint,text)',
          'EXECUTE'
        )
        and has_function_privilege(
          'authenticated',
          'public.save_site_typography_override(uuid,text,text,text,text,jsonb,bigint)',
          'EXECUTE'
        )
        and has_function_privilege(
          'authenticated',
          'public.publish_site_typography_override(uuid,bigint)',
          'EXECUTE'
        )
        and has_function_privilege(
          'authenticated',
          'public.restore_site_typography_revision(bigint,bigint)',
          'EXECUTE'
        )
        and exists (
          select 1
          from storage.buckets bucket
          where bucket.id = 'site-fonts'
            and bucket.name = 'site-fonts'
            and not bucket.public
            and bucket.file_size_limit = 2097152
            and bucket.allowed_mime_types = array['font/woff', 'font/woff2']
        )
        and (
          select count(*) = 3
          from pg_catalog.pg_policies policy
          where policy.schemaname = 'public'
            and policy.roles = array['authenticated'::name]
            and position('is_staff' in coalesce(policy.qual, '')) > 0
            and (
              (
                policy.tablename = 'font_assets'
                and policy.policyname = 'Staff read font assets'
                and policy.cmd = 'SELECT'
              )
              or (
                policy.tablename = 'site_typography_overrides'
                and policy.policyname = 'Staff read typography overrides'
                and policy.cmd = 'SELECT'
              )
              or (
                policy.tablename = 'site_typography_revisions'
                and policy.policyname = 'Staff read typography revisions'
                and policy.cmd = 'SELECT'
              )
            )
        )
        and exists (
          select 1 from pg_catalog.pg_policies policy
          where policy.schemaname = 'public'
            and policy.tablename = 'font_assets'
            and policy.policyname =
              'Owners and admins register uploaded fonts'
            and policy.cmd = 'INSERT'
            and policy.roles = array['authenticated'::name]
            and position('uploaded' in coalesce(policy.with_check, '')) > 0
            and position('is_staff' in coalesce(policy.with_check, '')) > 0
        )
        and exists (
          select 1
          from pg_catalog.pg_trigger audit_trigger
          where audit_trigger.tgrelid = 'public.font_assets'::regclass
            and not audit_trigger.tgisinternal
            and audit_trigger.tgname = 'font_assets_audit_insert'
            and audit_trigger.tgfoid =
              'public.audit_font_asset_insert()'::regprocedure
        )
        and not exists (
          select 1 from pg_catalog.pg_policies policy
          where policy.schemaname = 'storage'
            and policy.tablename = 'objects'
            and policy.policyname = 'Public read site fonts'
        )
        and exists (
          select 1 from pg_catalog.pg_policies policy
          where policy.schemaname = 'storage'
            and policy.tablename = 'objects'
            and policy.policyname = 'Owners and admins upload site fonts'
            and policy.cmd = 'INSERT'
            and position('site-fonts' in coalesce(policy.with_check, '')) > 0
            and position('sha256' in coalesce(policy.with_check, '')) > 0
            and position('is_staff' in coalesce(policy.with_check, '')) > 0
        )
    )
    else null
  end;
$$;

revoke all on function public.get_editorial_schema_health() from public;
grant execute on function public.get_editorial_schema_health()
  to authenticated;
