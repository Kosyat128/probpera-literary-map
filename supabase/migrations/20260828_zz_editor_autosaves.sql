-- Private, actor-owned recovery copies for the shared editorial workspace.
--
-- Autosaves are deliberately isolated from canonical editorial tables,
-- revision history and the public-build outbox. They can therefore preserve
-- interrupted work without publishing or silently overwriting newer content.

create table if not exists public.editor_autosaves (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('article', 'page')),
  entity_id uuid,
  draft_scope text not null check (
    char_length(draft_scope) between 1 and 160
    and draft_scope = btrim(draft_scope)
  ),
  locale_scope text not null check (
    char_length(locale_scope) between 1 and 32
    and locale_scope ~ '^[a-z][a-z0-9_-]*$'
  ),
  base_updated_at timestamptz,
  client_session_id uuid not null,
  client_sequence bigint not null check (client_sequence > 0),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  recovery_state text not null check (recovery_state in ('saved', 'conflict')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  unique (
    actor_id,
    entity_type,
    draft_scope,
    locale_scope,
    client_session_id
  ),
  check (expires_at > created_at),
  check (octet_length(snapshot::text) <= 3500000)
);

create index if not exists editor_autosaves_actor_recent_idx
  on public.editor_autosaves(
    actor_id,
    entity_type,
    draft_scope,
    locale_scope,
    updated_at desc
  );
create index if not exists editor_autosaves_expiry_idx
  on public.editor_autosaves(expires_at);

alter table public.editor_autosaves enable row level security;
alter table public.editor_autosaves force row level security;

revoke all on table public.editor_autosaves from public, anon;
grant select, insert, update, delete on table public.editor_autosaves
  to authenticated;
grant all on table public.editor_autosaves to service_role;

drop policy if exists "Staff read their own editor autosaves"
  on public.editor_autosaves;
create policy "Staff read their own editor autosaves"
on public.editor_autosaves for select
to authenticated
using (
  actor_id = (select auth.uid())
  and public.is_staff()
);

drop policy if exists "Staff create their own editor autosaves"
  on public.editor_autosaves;
create policy "Staff create their own editor autosaves"
on public.editor_autosaves for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and public.is_staff()
);

drop policy if exists "Staff update their own editor autosaves"
  on public.editor_autosaves;
create policy "Staff update their own editor autosaves"
on public.editor_autosaves for update
to authenticated
using (
  actor_id = (select auth.uid())
  and public.is_staff()
)
with check (
  actor_id = (select auth.uid())
  and public.is_staff()
);

drop policy if exists "Staff delete their own editor autosaves"
  on public.editor_autosaves;
create policy "Staff delete their own editor autosaves"
on public.editor_autosaves for delete
to authenticated
using (
  actor_id = (select auth.uid())
  and public.is_staff()
);

create or replace function public.save_editor_autosave(
  p_entity_type text,
  p_entity_id uuid,
  p_draft_scope text,
  p_locale_scope text,
  p_base_updated_at timestamptz,
  p_client_session_id uuid,
  p_client_sequence bigint,
  p_snapshot_hash text,
  p_snapshot jsonb,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_actor uuid := (select auth.uid());
  canonical_updated_at timestamptz;
  next_state text := 'saved';
  saved_row public.editor_autosaves%rowtype;
begin
  if current_actor is null or not public.is_staff() then
    raise exception 'A staff session is required';
  end if;
  if p_entity_type not in ('article', 'page')
    or p_draft_scope is null
    or char_length(p_draft_scope) not between 1 and 160
    or p_draft_scope <> btrim(p_draft_scope)
    or p_locale_scope is null
    or p_locale_scope !~ '^[a-z][a-z0-9_-]{0,31}$'
    or p_client_session_id is null
    or p_client_sequence is null
    or p_client_sequence <= 0
    or p_snapshot_hash is null
    or p_snapshot_hash !~ '^[0-9a-f]{64}$'
    or p_snapshot is null
    or jsonb_typeof(p_snapshot) <> 'object'
    or octet_length(p_snapshot::text) > 3500000
    or p_expires_at is null
    or p_expires_at <= now()
    or p_expires_at > now() + interval '45 days' then
    raise exception 'Invalid editor autosave payload';
  end if;

  if p_entity_id is not null then
    if p_entity_type = 'article' then
      select article.updated_at
      into canonical_updated_at
      from public.articles as article
      where article.id = p_entity_id;
    else
      select page_record.updated_at
      into canonical_updated_at
      from public.pages as page_record
      where page_record.id = p_entity_id;
    end if;

    if canonical_updated_at is null
      or p_base_updated_at is null
      or canonical_updated_at is distinct from p_base_updated_at then
      next_state := 'conflict';
    end if;
  elsif p_base_updated_at is not null then
    next_state := 'conflict';
  end if;

  insert into public.editor_autosaves as current_autosave (
    actor_id,
    entity_type,
    entity_id,
    draft_scope,
    locale_scope,
    base_updated_at,
    client_session_id,
    client_sequence,
    snapshot_hash,
    snapshot,
    recovery_state,
    expires_at
  )
  values (
    current_actor,
    p_entity_type,
    p_entity_id,
    p_draft_scope,
    p_locale_scope,
    p_base_updated_at,
    p_client_session_id,
    p_client_sequence,
    p_snapshot_hash,
    p_snapshot,
    next_state,
    p_expires_at
  )
  on conflict (
    actor_id,
    entity_type,
    draft_scope,
    locale_scope,
    client_session_id
  ) do update
  set
    entity_id = excluded.entity_id,
    base_updated_at = excluded.base_updated_at,
    client_sequence = excluded.client_sequence,
    snapshot_hash = excluded.snapshot_hash,
    snapshot = excluded.snapshot,
    recovery_state = excluded.recovery_state,
    updated_at = now(),
    expires_at = excluded.expires_at
  where current_autosave.client_sequence < excluded.client_sequence
  returning * into saved_row;

  if saved_row.id is null then
    select autosave.*
    into saved_row
    from public.editor_autosaves as autosave
    where autosave.actor_id = current_actor
      and autosave.entity_type = p_entity_type
      and autosave.draft_scope = p_draft_scope
      and autosave.locale_scope = p_locale_scope
      and autosave.client_session_id = p_client_session_id;
  end if;

  return jsonb_build_object(
    'id', saved_row.id,
    'state', saved_row.recovery_state,
    'sequence', saved_row.client_sequence,
    'snapshotHash', saved_row.snapshot_hash,
    'baseUpdatedAt', saved_row.base_updated_at,
    'updatedAt', saved_row.updated_at,
    'expiresAt', saved_row.expires_at
  );
end;
$$;

revoke all on function public.save_editor_autosave(
  text,
  uuid,
  text,
  text,
  timestamptz,
  uuid,
  bigint,
  text,
  jsonb,
  timestamptz
) from public, anon;
grant execute on function public.save_editor_autosave(
  text,
  uuid,
  text,
  text,
  timestamptz,
  uuid,
  bigint,
  text,
  jsonb,
  timestamptz
) to authenticated, service_role;
