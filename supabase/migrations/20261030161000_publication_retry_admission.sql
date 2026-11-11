-- Bind a publication retry command to one append-only outbox child.
-- The normal mutation/explicit queue and its scheduled consumer remain intact.

alter table public.public_build_outbox
  add column if not exists retry_operation_id uuid,
  add column if not exists retry_of_outbox_id bigint;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.public_build_outbox'::regclass
        and conname = 'public_build_outbox_retry_identity_check') then
    alter table public.public_build_outbox
      add constraint public_build_outbox_retry_identity_check check (
        (retry_operation_id is null and retry_of_outbox_id is null)
        or (retry_operation_id is not null and retry_of_outbox_id is not null
          and retry_of_outbox_id <> id)
      );
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.public_build_outbox'::regclass
        and conname = 'public_build_outbox_retry_source_fkey') then
    alter table public.public_build_outbox
      add constraint public_build_outbox_retry_source_fkey
      foreign key (retry_of_outbox_id) references public.public_build_outbox(id)
      on delete restrict;
  end if;
end;
$$;

-- Global identity survives the existing actor_id ON DELETE SET NULL behavior.
create unique index if not exists public_build_outbox_retry_operation_uidx
  on public.public_build_outbox(retry_operation_id)
  where retry_operation_id is not null;

-- Every current child status is held or complete. A source therefore gets one
-- native child for its lifetime; the unique fence also covers older snapshots.
create unique index if not exists public_build_outbox_retry_source_uidx
  on public.public_build_outbox(retry_of_outbox_id)
  where retry_of_outbox_id is not null;

create or replace function public.guard_public_build_retry_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_core_changed boolean;
  v_actor_changed boolean;
  v_actor_deleted boolean := false;
begin
  if tg_op = 'DELETE' then
    if old.retry_operation_id is not null then
      raise exception 'publication retry history cannot be deleted' using errcode = '23514';
    end if;
    return old;
  end if;

  v_core_changed := new.id is distinct from old.id
    or new.entity_type is distinct from old.entity_type
    or new.entity_id is distinct from old.entity_id
    or new.reason is distinct from old.reason
    or new.created_at is distinct from old.created_at
    or new.requested_at is distinct from old.requested_at
    or new.metadata is distinct from old.metadata;
  v_actor_changed := new.actor_id is distinct from old.actor_id;
  if v_actor_changed and old.actor_id is not null and new.actor_id is null then
    v_actor_deleted := not exists (select 1 from auth.users where id = old.actor_id);
  end if;

  if old.retry_operation_id is null then
    if new.retry_operation_id is not null or new.retry_of_outbox_id is not null then
      raise exception 'retry identity must be bound by a new outbox event'
        using errcode = '23514';
    end if;
    -- An older transaction snapshot may not yet see a committed child. Core
    -- changes in that scope stay closed; ordinary finalizer/status writes and
    -- the actual Auth deletion effect retain their existing behavior.
    if pg_catalog.current_setting('transaction_isolation') <> 'read committed'
      and (v_core_changed or (v_actor_changed and not v_actor_deleted)) then
      raise exception 'publication intent core cannot change in this snapshot'
        using errcode = '23514';
    end if;
    if not exists (select 1 from public.public_build_outbox where retry_of_outbox_id = old.id) then
      return new;
    end if;
  end if;

  if v_core_changed
    or new.retry_operation_id is distinct from old.retry_operation_id
    or new.retry_of_outbox_id is distinct from old.retry_of_outbox_id
  then
    raise exception 'publication retry intent is immutable' using errcode = '23514';
  end if;

  if v_actor_changed then
    -- Preserve the actual Auth FK's deletion effect, including its tombstone.
    if not v_actor_deleted then
      raise exception 'publication retry actor cannot be rebound' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_public_build_retry_identity() from public;

drop trigger if exists public_build_outbox_retry_identity_guard
  on public.public_build_outbox;
create trigger public_build_outbox_retry_identity_guard
  before update or delete on public.public_build_outbox
  for each row execute function public.guard_public_build_retry_identity();

-- Metadata supplied to the legacy generic API may reject a retry request;
-- it never grants retry authority. Ordinary queue calls retain their contract.
create or replace function public.enqueue_public_build_request(
  p_entity_type text,
  p_entity_id text,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'staff access required';
  end if;
  if p_metadata ? 'retry_of_outbox_id'
    or p_metadata ? 'retry_operation_id'
    or p_metadata ? 'native_publication_retry' then
    raise exception 'publication retry requires atomic admission'
      using errcode = '22023';
  end if;
  return public.append_public_build_outbox(
    (select auth.uid()), p_entity_type, p_entity_id, p_reason, p_metadata
  );
end;
$$;

revoke all on function public.enqueue_public_build_request(text, text, text, jsonb)
  from public;
grant execute on function public.enqueue_public_build_request(text, text, text, jsonb)
  to authenticated;

create or replace function public.admit_public_build_retry(
  p_outbox_id bigint,
  p_retry_operation_id uuid,
  p_expected_updated_at text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_expected timestamptz;
  v_source public.public_build_outbox%rowtype;
  v_observed public.public_build_outbox%rowtype;
  v_root_id bigint;
  v_outcome text;
  v_can_dispatch boolean := false;
  v_has_observed boolean := false;
begin
  if v_actor is null or not coalesce(public.is_staff(), false) then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if p_outbox_id is null or p_outbox_id <= 0 or p_retry_operation_id is null
    or p_expected_updated_at is null or char_length(p_expected_updated_at) > 64
    or p_expected_updated_at !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then
    raise exception 'invalid publication retry identity or source version'
      using errcode = '22023';
  end if;
  begin
    v_expected := p_expected_updated_at::timestamptz;
  exception when sqlstate '22007' or sqlstate '22008' or sqlstate '22009' then
    raise exception 'invalid publication retry source version' using errcode = '22023';
  end;

  -- One global command fence precedes the root row fence. Only this native
  -- admission API inserts native retry children; observing a child takes no
  -- child row lock, so the old unordered finalizer can still update its set.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('publication-retry:' || p_retry_operation_id::text, 0)
  );

  select * into v_observed from public.public_build_outbox
    where retry_operation_id = p_retry_operation_id;
  if found then
    if v_observed.actor_id is distinct from v_actor
      or v_observed.retry_of_outbox_id is distinct from p_outbox_id
      or (v_observed.metadata #>> '{native_publication_retry,expectedUpdatedAt}')
        is distinct from p_expected_updated_at then
      raise exception 'publication retry command binding does not match'
        using errcode = '22023';
    end if;
    select * into v_source from public.public_build_outbox where id = p_outbox_id;
    if not found then
      raise exception 'publication retry source is unavailable' using errcode = 'P0002';
    end if;
    v_root_id := p_outbox_id;
    v_outcome := 'replay';
    v_has_observed := true;
  else
    select * into v_source from public.public_build_outbox
      where id = p_outbox_id for update;
    if not found then
      raise exception 'publication retry source is unavailable' using errcode = 'P0002';
    end if;
    v_root_id := coalesce(v_source.retry_of_outbox_id, v_source.id);
    v_observed := v_source;
    v_has_observed := true;
    if v_source.retry_of_outbox_id is not null then
      v_outcome := 'root-required';
    elsif v_source.status = 'deployed' then
      v_outcome := 'complete';
    elsif v_source.status in ('requested', 'dispatched') then
      v_outcome := 'active';
    else
      if v_source.status is distinct from 'failed' then
        raise exception 'publication source status is invalid' using errcode = '22023';
      end if;
      -- Existing unbound legacy retry selectors are not native source/command
      -- identity. Keep that historical work for observation or an explicit
      -- separate full release instead of inferring a fresh dispatch grant.
      if v_source.metadata ? 'retry_of_outbox_id'
        or v_source.metadata ? 'retry_operation_id'
        or v_source.metadata ? 'native_publication_retry' then
        raise exception 'legacy publication retry binding is unconfirmed'
          using errcode = '22023';
      end if;
      -- One snapshot covers every child status, including child-only completion
      -- while the original source still says failed. No child row lock is taken.
      select * into v_observed from public.public_build_outbox
        where retry_of_outbox_id = v_source.id
        order by id desc limit 1;
      if found then
        v_outcome := case when v_observed.status = 'deployed' then 'complete' else 'active' end;
      else
        if v_source.updated_at is distinct from v_expected then
          v_outcome := 'stale';
          v_observed := v_source;
        else
          if nullif(trim(v_source.entity_type), '') is null
            or nullif(trim(v_source.entity_id), '') is null
            or nullif(trim(v_source.reason), '') is null then
            raise exception 'publication source identity is invalid' using errcode = '22023';
          end if;
          insert into public.public_build_outbox (
            actor_id, entity_type, entity_id, reason, status, metadata,
            retry_operation_id, retry_of_outbox_id
          ) values (
            v_actor, v_source.entity_type, v_source.entity_id,
            left('manual-retry:' || v_source.reason, 240), 'requested',
            v_source.metadata || jsonb_build_object(
              'retry_of_outbox_id', v_source.id::text,
              'native_publication_retry', jsonb_build_object(
                'version', 1, 'expectedUpdatedAt', p_expected_updated_at
              )
            ),
            p_retry_operation_id, v_source.id
          ) returning * into v_observed;

          -- Intent and required audit either both commit or neither commits.
          insert into public.admin_audit_log (
            actor_id, action, entity_type, entity_id, metadata
          ) values (
            v_actor, 'public_build.retry_admitted', v_observed.entity_type,
            v_observed.entity_id, jsonb_build_object(
              'outbox_id', v_observed.id::text,
              'retry_of_outbox_id', v_source.id::text,
              'retry_operation_id', p_retry_operation_id::text,
              'expected_updated_at', p_expected_updated_at
            )
          );
          v_outcome := 'admitted';
          v_can_dispatch := true;
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'version', 1,
    'requested', jsonb_build_object(
      'outboxId', p_outbox_id::text,
      'operationId', p_retry_operation_id::text,
      'expectedUpdatedAt', p_expected_updated_at
    ),
    'outcome', v_outcome,
    'canDispatch', v_can_dispatch,
    'source', jsonb_build_object(
      'outboxId', v_source.id::text,
      'retryOfOutboxId', v_source.retry_of_outbox_id::text,
      'status', v_source.status,
      'updatedAt', v_source.updated_at
    ),
    'rootOutboxId', v_root_id::text,
    'observed', case when v_has_observed then jsonb_build_object(
      'outboxId', v_observed.id::text,
      'retryOfOutboxId', v_observed.retry_of_outbox_id::text,
      'status', v_observed.status,
      'updatedAt', v_observed.updated_at,
      'operationId', v_observed.retry_operation_id::text,
      'actorId', v_observed.actor_id::text,
      'provider', left(v_observed.provider, 80)
    ) else null end,
    'dispatch', case when v_can_dispatch then jsonb_build_object(
      'entityType', v_observed.entity_type,
      'entityId', v_observed.entity_id,
      'reason', v_observed.reason
    ) else null end
  );
end;
$$;

revoke all on function public.admit_public_build_retry(bigint, uuid, text)
  from public;
grant execute on function public.admit_public_build_retry(bigint, uuid, text)
  to authenticated;
