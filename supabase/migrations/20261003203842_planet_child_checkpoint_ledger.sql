-- Local preparation only; no live apply, HTTP route or native issuer activation.
-- This is a private online checkpoint ledger, not signed/device/time/recovery
-- authority. A separately reviewed provisioner must bind a real installation,
-- authority epoch and guardian/recovery-owner subject to the initial full-record
-- digest. Missing provisioning denies; bundle/package identity is insufficient.
-- The future trusted backend must independently verify canonical Auth claims and
-- the original operation/context/full record before calling these service RPCs.
-- Database rollback/disaster recovery, cross-boot clock reanchor and recovery
-- proof are outside this slice. Ambiguous RPC results never authorize a retry.

create table public.planet_child_checkpoints (
  installation_id uuid not null,
  authority_epoch uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check (revision between 0 and 9007199254740990),
  record_sha256 text not null check (record_sha256 ~ '^[0-9a-f]{64}$'),
  last_server_at timestamptz not null check (pg_catalog.isfinite(last_server_at)),
  primary key (installation_id, authority_epoch, user_id),
  unique (installation_id)
);
create table public.planet_child_checkpoint_operations (
  installation_id uuid not null,
  authority_epoch uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_sha256 text not null check (operation_sha256 ~ '^[0-9a-f]{64}$'),
  context_sha256 text not null check (context_sha256 ~ '^[0-9a-f]{64}$'),
  expected_revision bigint not null check (expected_revision between 0 and 9007199254740989),
  expected_record_sha256 text not null check (expected_record_sha256 ~ '^[0-9a-f]{64}$'),
  next_record_sha256 text not null check (next_record_sha256 ~ '^[0-9a-f]{64}$'),
  guardian_session_id uuid not null,
  guardian_session_epoch bigint not null check (guardian_session_epoch between 0 and 9007199254740990),
  captured_server_ms bigint not null check (captured_server_ms between 0 and 9007199254680990),
  expires_at_ms bigint not null,
  consumed_server_ms bigint,
  primary key (installation_id, authority_epoch, operation_sha256),
  foreign key (installation_id, authority_epoch, user_id)
    references public.planet_child_checkpoints(installation_id, authority_epoch, user_id) on delete cascade,
  check (next_record_sha256 <> expected_record_sha256),
  check (expires_at_ms > captured_server_ms and expires_at_ms <= captured_server_ms + 60000),
  check (consumed_server_ms is null or (consumed_server_ms >= captured_server_ms and consumed_server_ms < expires_at_ms))
);
create index planet_child_checkpoints_user_id_idx on public.planet_child_checkpoints(user_id);
create index planet_child_checkpoint_operations_user_id_idx on public.planet_child_checkpoint_operations(user_id);
create index planet_child_checkpoint_operations_owner_idx
  on public.planet_child_checkpoint_operations(installation_id, authority_epoch, user_id);
-- Permanent operation hashes survive expiry/consumption and later revisions.
-- There is no prune, reset, installation enrolment or epoch replacement RPC.
create trigger planet_reader_mutation_fence
  before insert or update or delete on public.planet_child_checkpoints
  for each row execute function public.planet_reader_mutation_fence();
create trigger planet_reader_mutation_fence
  before insert or update or delete on public.planet_child_checkpoint_operations
  for each row execute function public.planet_reader_mutation_fence();
alter table public.planet_child_checkpoints enable row level security;
alter table public.planet_child_checkpoints force row level security;
alter table public.planet_child_checkpoint_operations enable row level security;
alter table public.planet_child_checkpoint_operations force row level security;
revoke all on table public.planet_child_checkpoints, public.planet_child_checkpoint_operations
  from public, anon, authenticated, service_role;
-- SECURITY INVOKER uses the existing trusted BYPASSRLS server role. Its table
-- rights are explicit and narrow; no browser role receives a policy or grant.
grant select on table public.planet_child_checkpoints, public.planet_child_checkpoint_operations to service_role;
grant update (revision, record_sha256, last_server_at) on public.planet_child_checkpoints to service_role;
grant insert (installation_id, authority_epoch, user_id, operation_sha256, context_sha256,
  expected_revision, expected_record_sha256, next_record_sha256, guardian_session_id,
  guardian_session_epoch, captured_server_ms, expires_at_ms)
  on public.planet_child_checkpoint_operations to service_role;
grant update (consumed_server_ms) on public.planet_child_checkpoint_operations to service_role;
-- Canonical Supabase auth.sessions.not_after is a deployment prerequisite.
-- The private definer helper is needed because FOR SHARE requires an Auth
-- table UPDATE privilege for an invoker. Do not grant service-role Auth writes.
-- It exposes only the exact owned session's locked expiry, never other rows.
grant usage on schema planet_private to service_role;
create function planet_private.lock_child_guardian_session(p_subject uuid, p_session_id uuid)
returns table(not_after timestamptz) language plpgsql volatile security definer set search_path = '' as $$
begin
  -- The canonical deletion assertion is private to its existing definer
  -- callers. Keep it here; the public invokers receive no extra privilege.
  perform public.planet_assert_reader_not_deleting(p_subject);
  return query select s.not_after from auth.sessions s
    where s.user_id=p_subject and s.id=p_session_id for share;
end;
$$;
revoke all on function planet_private.lock_child_guardian_session(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function planet_private.lock_child_guardian_session(uuid,uuid) to service_role;

create function public.planet_capture_child_checkpoint(
  p_installation_id uuid, p_authority_epoch uuid, p_guardian_subject uuid,
  p_guardian_session_id uuid, p_guardian_session_epoch bigint,
  p_expected_revision bigint, p_expected_record_sha256 text,
  p_operation_sha256 text, p_context_sha256 text, p_next_record_sha256 text,
  p_operation_timeout_ms integer
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.planet_child_checkpoints%rowtype; access jsonb; session_not_after timestamptz;
  server_now timestamptz; server_ms bigint; deadline_ms bigint; completed_at timestamptz; completed_ms bigint;
begin
  if p_installation_id is null or p_authority_epoch is null or p_guardian_subject is null
    or p_guardian_session_id is null or p_guardian_session_epoch is null
    or p_guardian_session_epoch not between 0 and 9007199254740990
    or p_expected_revision is null or p_expected_revision not between 0 and 9007199254740989
    or p_expected_record_sha256 is null or p_expected_record_sha256 !~ '^[0-9a-f]{64}$'
    or p_operation_sha256 is null or p_operation_sha256 !~ '^[0-9a-f]{64}$'
    or p_context_sha256 is null or p_context_sha256 !~ '^[0-9a-f]{64}$'
    or p_next_record_sha256 is null or p_next_record_sha256 !~ '^[0-9a-f]{64}$'
    or p_next_record_sha256 = p_expected_record_sha256
    or p_operation_timeout_ms is null or p_operation_timeout_ms not between 1 and 60000 then
    raise exception using errcode='22023', message='PLANET_INVALID_CHILD_CHECKPOINT_CONTEXT';
  end if;
  -- Match canonical subject -> Auth owner -> private row order. The existing
  -- access RPC takes the subject advisory lock and Auth user key-share lock;
  -- no purchase entitlement is inferred from its read-only product query.
  access := public.planet_get_web_access(p_guardian_subject, 'planet-child-checkpoint');
  select s.not_after into session_not_after from planet_private.lock_child_guardian_session(p_guardian_subject,p_guardian_session_id) s;
  if not found then
    raise exception using errcode='P0001', message='PLANET_CHILD_GUARDIAN_SESSION_DENIED';
  end if;
  if access->>'accessBlocked' is distinct from 'false'
    or (access->>'sessionEpoch')::bigint is distinct from p_guardian_session_epoch then
    raise exception using errcode='P0001', message='PLANET_CHILD_GUARDIAN_SESSION_DENIED';
  end if;
  select * into r from public.planet_child_checkpoints
    where installation_id=p_installation_id and authority_epoch=p_authority_epoch and user_id=p_guardian_subject for update;
  if not found then
    raise exception using errcode='P0001', message='PLANET_CHILD_CHECKPOINT_NOT_PROVISIONED';
  end if;
  server_now := pg_catalog.clock_timestamp();
  if not pg_catalog.isfinite(server_now) or server_now < r.last_server_at then
    raise exception using errcode='P0001', message='PLANET_CHILD_SERVER_CLOCK_DENIED';
  end if;
  server_ms := pg_catalog.floor(extract(epoch from server_now) * 1000)::bigint;
  if server_ms not between 0 and 9007199254680990 then
    raise exception using errcode='P0001', message='PLANET_CHILD_SERVER_CLOCK_DENIED';
  end if;
  if session_not_after is not null and (not pg_catalog.isfinite(session_not_after) or session_not_after <= server_now) then
    raise exception using errcode='P0001', message='PLANET_CHILD_GUARDIAN_SESSION_DENIED';
  end if;
  if r.revision <> p_expected_revision or r.record_sha256 <> p_expected_record_sha256 then
    raise exception using errcode='P0001', message='PLANET_CHILD_CHECKPOINT_STALE';
  end if;
  if exists(select 1 from public.planet_child_checkpoint_operations
    where installation_id=p_installation_id and authority_epoch=p_authority_epoch and operation_sha256=p_operation_sha256) then
    raise exception using errcode='P0001', message='PLANET_CHILD_OPERATION_REPLAYED';
  end if;
  deadline_ms := server_ms + p_operation_timeout_ms;
  insert into public.planet_child_checkpoint_operations
    (installation_id, authority_epoch, user_id, operation_sha256, context_sha256,
      expected_revision, expected_record_sha256, next_record_sha256, guardian_session_id,
      guardian_session_epoch, captured_server_ms, expires_at_ms)
    values (p_installation_id, p_authority_epoch, p_guardian_subject, p_operation_sha256, p_context_sha256,
      p_expected_revision, p_expected_record_sha256, p_next_record_sha256, p_guardian_session_id,
      p_guardian_session_epoch, server_ms, deadline_ms);
  update public.planet_child_checkpoints set last_server_at=server_now
    where installation_id=p_installation_id and authority_epoch=p_authority_epoch and user_id=p_guardian_subject;
  -- The persisted server_now is the decision/linearization sample. This final
  -- fence validates completed writes without another timestamp write/trigger
  -- cycle. completed_server_ms is a validity sample, not a durable high-water.
  completed_at := pg_catalog.clock_timestamp();
  if not pg_catalog.isfinite(completed_at) or completed_at < server_now or completed_at < r.last_server_at then
    raise exception using errcode='P0001', message='PLANET_CHILD_SERVER_CLOCK_DENIED';
  end if;
  completed_ms := pg_catalog.floor(extract(epoch from completed_at) * 1000)::bigint;
  if completed_ms >= deadline_ms then
    raise exception using errcode='P0001', message='PLANET_CHILD_OPERATION_EXPIRED';
  end if;
  if session_not_after is not null and session_not_after <= completed_at then
    raise exception using errcode='P0001', message='PLANET_CHILD_GUARDIAN_SESSION_DENIED';
  end if;
  return pg_catalog.jsonb_build_object('installation_id', p_installation_id, 'authority_epoch', p_authority_epoch,
    'guardian_subject', p_guardian_subject, 'guardian_session_id', p_guardian_session_id,
    'guardian_session_epoch', p_guardian_session_epoch, 'revision', r.revision,
    'record_sha256', r.record_sha256, 'operation_sha256', p_operation_sha256,
    'context_sha256', p_context_sha256, 'next_record_sha256', p_next_record_sha256,
    'captured_server_ms', server_ms, 'server_time_ms', server_ms,
    'completed_server_ms', completed_ms, 'expires_at_ms', deadline_ms);
end;
$$;

create function public.planet_advance_child_checkpoint(
  p_installation_id uuid, p_authority_epoch uuid, p_guardian_subject uuid,
  p_guardian_session_id uuid, p_guardian_session_epoch bigint,
  p_expected_revision bigint, p_expected_record_sha256 text,
  p_operation_sha256 text, p_context_sha256 text, p_next_record_sha256 text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.planet_child_checkpoints%rowtype; operation public.planet_child_checkpoint_operations%rowtype;
  access jsonb; session_not_after timestamptz; server_now timestamptz; server_ms bigint;
  completed_at timestamptz; completed_ms bigint;
begin
  if p_installation_id is null or p_authority_epoch is null or p_guardian_subject is null
    or p_guardian_session_id is null or p_guardian_session_epoch is null
    or p_guardian_session_epoch not between 0 and 9007199254740990
    or p_expected_revision is null or p_expected_revision not between 0 and 9007199254740989
    or p_expected_record_sha256 is null or p_expected_record_sha256 !~ '^[0-9a-f]{64}$'
    or p_operation_sha256 is null or p_operation_sha256 !~ '^[0-9a-f]{64}$'
    or p_context_sha256 is null or p_context_sha256 !~ '^[0-9a-f]{64}$'
    or p_next_record_sha256 is null or p_next_record_sha256 !~ '^[0-9a-f]{64}$'
    or p_next_record_sha256 = p_expected_record_sha256 then
    raise exception using errcode='22023', message='PLANET_INVALID_CHILD_CHECKPOINT_CONTEXT';
  end if;
  access := public.planet_get_web_access(p_guardian_subject, 'planet-child-checkpoint');
  select s.not_after into session_not_after from planet_private.lock_child_guardian_session(p_guardian_subject,p_guardian_session_id) s;
  if not found then
    raise exception using errcode='P0001', message='PLANET_CHILD_GUARDIAN_SESSION_DENIED';
  end if;
  if access->>'accessBlocked' is distinct from 'false'
    or (access->>'sessionEpoch')::bigint is distinct from p_guardian_session_epoch then
    raise exception using errcode='P0001', message='PLANET_CHILD_GUARDIAN_SESSION_DENIED';
  end if;
  select * into r from public.planet_child_checkpoints
    where installation_id=p_installation_id and authority_epoch=p_authority_epoch and user_id=p_guardian_subject for update;
  if not found then
    raise exception using errcode='P0001', message='PLANET_CHILD_CHECKPOINT_NOT_PROVISIONED';
  end if;
  select * into operation from public.planet_child_checkpoint_operations
    where installation_id=p_installation_id and authority_epoch=p_authority_epoch and operation_sha256=p_operation_sha256 for update;
  if not found or operation.user_id is distinct from p_guardian_subject
    or operation.guardian_session_id is distinct from p_guardian_session_id
    or operation.guardian_session_epoch is distinct from p_guardian_session_epoch
    or operation.expected_revision is distinct from p_expected_revision
    or operation.expected_record_sha256 is distinct from p_expected_record_sha256
    or operation.context_sha256 is distinct from p_context_sha256
    or operation.next_record_sha256 is distinct from p_next_record_sha256 then
    raise exception using errcode='P0001', message='PLANET_CHILD_OPERATION_BINDING_DENIED';
  end if;
  if operation.consumed_server_ms is not null then
    raise exception using errcode='P0001', message='PLANET_CHILD_OPERATION_REPLAYED';
  end if;
  -- Fresh time follows every lock/access guard; advance never refreshes capture.
  server_now := pg_catalog.clock_timestamp();
  if not pg_catalog.isfinite(server_now) or server_now < r.last_server_at then
    raise exception using errcode='P0001', message='PLANET_CHILD_SERVER_CLOCK_DENIED';
  end if;
  server_ms := pg_catalog.floor(extract(epoch from server_now) * 1000)::bigint;
  if server_ms not between 0 and 9007199254680990 or server_ms < operation.captured_server_ms then
    raise exception using errcode='P0001', message='PLANET_CHILD_SERVER_CLOCK_DENIED';
  end if;
  if session_not_after is not null and (not pg_catalog.isfinite(session_not_after) or session_not_after <= server_now) then
    raise exception using errcode='P0001', message='PLANET_CHILD_GUARDIAN_SESSION_DENIED';
  end if;
  if server_ms >= operation.expires_at_ms then
    raise exception using errcode='P0001', message='PLANET_CHILD_OPERATION_EXPIRED';
  end if;
  if r.revision <> p_expected_revision or r.record_sha256 <> p_expected_record_sha256 then
    raise exception using errcode='P0001', message='PLANET_CHILD_CHECKPOINT_STALE';
  end if;
  update public.planet_child_checkpoint_operations set consumed_server_ms=server_ms
    where installation_id=p_installation_id and authority_epoch=p_authority_epoch and operation_sha256=p_operation_sha256;
  update public.planet_child_checkpoints set revision=p_expected_revision+1,
    record_sha256=p_next_record_sha256, last_server_at=server_now
    where installation_id=p_installation_id and authority_epoch=p_authority_epoch and user_id=p_guardian_subject;
  completed_at := pg_catalog.clock_timestamp();
  if not pg_catalog.isfinite(completed_at) or completed_at < server_now or completed_at < r.last_server_at then
    raise exception using errcode='P0001', message='PLANET_CHILD_SERVER_CLOCK_DENIED';
  end if;
  completed_ms := pg_catalog.floor(extract(epoch from completed_at) * 1000)::bigint;
  if completed_ms >= operation.expires_at_ms then
    raise exception using errcode='P0001', message='PLANET_CHILD_OPERATION_EXPIRED';
  end if;
  if session_not_after is not null and session_not_after <= completed_at then
    raise exception using errcode='P0001', message='PLANET_CHILD_GUARDIAN_SESSION_DENIED';
  end if;
  return pg_catalog.jsonb_build_object('installation_id', p_installation_id, 'authority_epoch', p_authority_epoch,
    'guardian_subject', p_guardian_subject, 'guardian_session_id', p_guardian_session_id,
    'guardian_session_epoch', p_guardian_session_epoch, 'revision', p_expected_revision+1,
    'record_sha256', p_next_record_sha256, 'operation_sha256', p_operation_sha256,
    'context_sha256', p_context_sha256, 'next_record_sha256', p_next_record_sha256,
    'captured_server_ms', operation.captured_server_ms, 'server_time_ms', server_ms,
    'completed_server_ms', completed_ms, 'expires_at_ms', operation.expires_at_ms);
end;
$$;
revoke all on function public.planet_capture_child_checkpoint(uuid,uuid,uuid,uuid,bigint,bigint,text,text,text,text,integer),
  public.planet_advance_child_checkpoint(uuid,uuid,uuid,uuid,bigint,bigint,text,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.planet_capture_child_checkpoint(uuid,uuid,uuid,uuid,bigint,bigint,text,text,text,text,integer),
  public.planet_advance_child_checkpoint(uuid,uuid,uuid,uuid,bigint,bigint,text,text,text,text) to service_role;
-- Preserve the latest canonical deletion classifier, restore the already
-- reviewed license-budget identity omitted by the later sandbox definition,
-- and add only the two private checkpoint identities/exact owner dependency.
-- Financial SET NULL, queue/sandbox CASCADE, storage and editorial gates stay.
create or replace function public.planet_reader_deletion_blockers(p_subject uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare item record; populated boolean; safe boolean; expected_delete "char"; codes text[] := '{}';
  profile_role text; invalid_storage boolean; relation regclass;
begin
  if p_subject is null or not exists(select 1 from auth.users where id=p_subject) then return array['subject-missing']; end if;
  if not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.profiles'::regclass and attname='role' and not attisdropped) then
    return array['schema-profile-role'];
  end if;
  execute 'select role::text from public.profiles where id=$1' into profile_role using p_subject;
  if profile_role is distinct from 'reader' then codes:=array_append(codes,'staff-or-profile-role'); end if;
  -- Missing FKs are as unsafe as changed ones: iterating only existing FKs would
  -- otherwise silently leave private rows behind after a dropped constraint.
  for item in select * from (values
    ('profiles','id','auth.users','c'),
    ('reader_favorites','user_id','public.profiles','c'),
    ('reader_book_collections','user_id','public.profiles','c'),
    ('reader_book_favorites','user_id','public.profiles','c'),
    ('reader_progress','user_id','public.profiles','c'),
    ('reader_subscriptions','user_id','public.profiles','c'),
    ('reader_notifications','user_id','public.profiles','c'),
    ('content_views','user_id','public.profiles','n'),
    ('planet_access_state','user_id','auth.users','c'),
    ('planet_verified_payment_retries','user_id','auth.users','c'),
    ('planet_sandbox_orders','user_id','auth.users','c'),
    ('planet_license_grant_budgets','user_id','auth.users','c'),
    ('planet_child_checkpoints','user_id','auth.users','c'),
    ('planet_child_checkpoint_operations','user_id','auth.users','c'),
    ('planet_deletion_requests','user_id','auth.users','n'),
    ('planet_payment_events','user_id','auth.users','n'),
    ('planet_purchase_receipts','user_id','auth.users','n')
  ) x(name,col,parent,action) loop
    if not exists(select 1 from pg_catalog.pg_constraint c
      join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
      join pg_catalog.pg_attribute ra on ra.attrelid=c.confrelid and ra.attnum=c.confkey[1]
      where c.contype='f' and c.conrelid=pg_catalog.to_regclass('public.'||item.name)
        and c.confrelid=pg_catalog.to_regclass(item.parent) and c.convalidated and c.confdeltype::text=item.action
        and cardinality(c.conkey)=1 and cardinality(c.confkey)=1 and a.attname=item.col and a.atttypid='uuid'::regtype and ra.attname='id'
    ) then codes:=array_append(codes,'schema-required-identity-fk'); end if;
  end loop;
  if not exists(select 1 from pg_catalog.pg_constraint c where c.contype='f'
    and c.conrelid=pg_catalog.to_regclass('public.reader_book_collection_items')
    and c.confrelid=pg_catalog.to_regclass('public.reader_book_collections')) then
    codes:=array_append(codes,'schema-private-dependent');
  end if;
  if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='auth.users'::regclass
    and tgname='planet_guard_reader_auth_deletion' and tgfoid='public.planet_guard_reader_auth_deletion()'::regprocedure and tgenabled='O' and tgtype=11) then
    codes:=array_append(codes,'schema-auth-deletion-guard');
  end if;
  for item in select c.*,n.nspname,t.relname,a.attname,a.atttypid,ra.attname as referenced_column
    from pg_catalog.pg_constraint c join pg_catalog.pg_class t on t.oid=c.conrelid
    join pg_catalog.pg_namespace n on n.oid=t.relnamespace
    left join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    left join pg_catalog.pg_attribute ra on ra.attrelid=c.confrelid and ra.attnum=c.confkey[1]
    where c.contype='f' and c.confrelid in ('auth.users'::regclass,'public.profiles'::regclass)
      and n.nspname not in ('auth','storage')
  loop
    if item.nspname<>'public' or cardinality(item.conkey)<>1 or cardinality(item.confkey)<>1
      or item.atttypid<>'uuid'::regtype or item.referenced_column<>'id' or not item.convalidated then
      codes:=array_append(codes,'schema-identity-reference'); continue;
    end if;
    if item.relname not in ('planet_deletion_requests','planet_access_state') and not exists(
      select 1 from pg_catalog.pg_trigger where tgrelid=item.conrelid and tgname='planet_reader_mutation_fence'
        and tgenabled='O' and tgfoid='public.planet_reader_mutation_fence()'::regprocedure and tgtype=31
    ) then codes:=array_append(codes,'schema-mutation-fence'); continue; end if;
    safe := (item.relname='profiles' and item.attname='id') or
      (item.relname in ('reader_favorites','reader_book_collections','reader_book_favorites',
      'reader_progress','reader_subscriptions','reader_notifications','planet_access_state',
      'planet_verified_payment_retries','planet_sandbox_orders','planet_license_grant_budgets',
      'planet_child_checkpoints','planet_child_checkpoint_operations',
      'content_views','planet_deletion_requests','planet_payment_events','planet_purchase_receipts') and item.attname='user_id');
    expected_delete := case when item.relname in ('content_views','planet_deletion_requests','planet_payment_events','planet_purchase_receipts') then 'n' else 'c' end;
    if safe and item.confdeltype<>expected_delete then codes:=array_append(codes,'schema-private-cascade'); continue; end if;
    execute format('select exists(select 1 from %I.%I where %I=$1)',item.nspname,item.relname,item.attname) into populated using p_subject;
    if populated and not safe then
      codes:=array_append(codes,case when item.relname='staff_memberships' then 'staff-membership'
        when item.confdeltype='r' then 'editorial-reference'
        when item.relname in ('article_comments','forum_topics','forum_replies','community_votes','ratings','comment_reports','forum_reports') then 'public-contributions'
        else 'unsupported-linked-data' end);
    end if;
  end loop;
  -- Require the exact owner-matching operation FK as well as its Auth identity
  -- FK. A removed binding must not silently detach original operation metadata.
  if not exists(select 1 from pg_catalog.pg_constraint c where c.contype='f'
    and c.conrelid=pg_catalog.to_regclass('public.planet_child_checkpoint_operations')
    and c.confrelid=pg_catalog.to_regclass('public.planet_child_checkpoints')
    and c.confdeltype='c' and c.convalidated and cardinality(c.conkey)=3 and cardinality(c.confkey)=3
    and (select array_agg(attname::text order by array_position(c.conkey,attnum)) from pg_catalog.pg_attribute
      where attrelid=c.conrelid and attnum=any(c.conkey))=array['installation_id','authority_epoch','user_id']
    and (select array_agg(attname::text order by array_position(c.confkey,attnum)) from pg_catalog.pg_attribute
      where attrelid=c.confrelid and attnum=any(c.confkey))=array['installation_id','authority_epoch','user_id']
  ) then codes:=array_append(codes,'schema-private-dependent'); end if;
  -- New child cascades require exact reviewed owner bindings and fences. Keep
  -- the collection contract, adding only this checkpoint-operation dependency.
  for item in select c.*, t.relname, n.nspname, rt.relname as referenced_table
    from pg_catalog.pg_constraint c join pg_catalog.pg_class t on t.oid=c.conrelid
    join pg_catalog.pg_namespace n on n.oid=t.relnamespace join pg_catalog.pg_class rt on rt.oid=c.confrelid
    join pg_catalog.pg_namespace rn on rn.oid=rt.relnamespace
    where c.contype='f' and rn.nspname='public' and rt.relname in ('reader_favorites','reader_book_collections',
      'reader_book_collection_items','reader_book_favorites','reader_progress','reader_subscriptions','reader_notifications','content_views',
      'planet_child_checkpoints','planet_child_checkpoint_operations')
  loop
    if not (item.nspname='public' and item.relname='reader_book_collection_items' and item.referenced_table='reader_book_collections'
      and item.confdeltype='c' and item.convalidated
      and (select array_agg(attname::text order by array_position(item.conkey,attnum)) from pg_catalog.pg_attribute where attrelid=item.conrelid and attnum=any(item.conkey))=array['user_id','collection_id']
      and (select array_agg(attname::text order by array_position(item.confkey,attnum)) from pg_catalog.pg_attribute where attrelid=item.confrelid and attnum=any(item.confkey))=array['user_id','id']
      and exists(select 1 from pg_catalog.pg_trigger where tgrelid=item.conrelid and tgname='planet_reader_mutation_fence' and tgenabled='O' and tgtype=31)
    ) and not (item.nspname='public' and item.relname='planet_child_checkpoint_operations'
      and item.referenced_table='planet_child_checkpoints' and item.confdeltype='c' and item.convalidated
      and cardinality(item.conkey)=3 and cardinality(item.confkey)=3
      and (select array_agg(attname::text order by array_position(item.conkey,attnum)) from pg_catalog.pg_attribute
        where attrelid=item.conrelid and attnum=any(item.conkey))=array['installation_id','authority_epoch','user_id']
      and (select array_agg(attname::text order by array_position(item.confkey,attnum)) from pg_catalog.pg_attribute
        where attrelid=item.confrelid and attnum=any(item.confkey))=array['installation_id','authority_epoch','user_id']
      and exists(select 1 from pg_catalog.pg_trigger where tgrelid=item.conrelid and tgname='planet_reader_mutation_fence'
        and tgenabled='O' and tgfoid='public.planet_reader_mutation_fence()'::regprocedure and tgtype=31)
    ) then codes:=array_append(codes,'schema-private-dependent'); end if;
  end loop;
  -- Canonical view counters and admin reports derive counts directly by SELECT;
  -- there are no stored totals to patch. New side-effect triggers or columns need
  -- review before this exact private analytics deletion path can be reused.
  if (select array_agg(attname::text order by attname) from pg_catalog.pg_attribute where attrelid='public.content_views'::regclass
    and attnum>0 and not attisdropped) is distinct from
    array['created_at','id','navigation_source','path','previous_path','referrer_host','session_id','user_id','utm_campaign','utm_medium','utm_source']
    or exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.content_views'::regclass and not tgisinternal
      and (tgname<>'planet_reader_mutation_fence' or tgfoid<>'public.planet_reader_mutation_fence()'::regprocedure)) then
    codes:=array_append(codes,'schema-private-analytics');
  end if;
  -- The reviewed policy's receipt scope is these exact existing fields. A newly
  -- added email/address/payload column cannot be retained under this old policy.
  for item in select * from (values
    ('planet_payment_events',array['accepted_at','event_id','occurred_at','payload_sha256','product_id','provider','receipt_applied','status','transaction_id','user_id']),
    ('planet_purchase_receipts',array['created_at','last_occurred_at','product_id','provider','status','transaction_id','updated_at','user_id'])
  ) x(name,columns) loop
    if (select array_agg(attname::text order by attname) from pg_catalog.pg_attribute
      where attrelid=pg_catalog.to_regclass('public.'||item.name) and attnum>0 and not attisdropped) is distinct from item.columns then codes:=array_append(codes,'schema-payment-retention'); end if;
  end loop;
  relation:=pg_catalog.to_regclass('storage.objects');
  if relation is null or not exists(select 1 from pg_catalog.pg_trigger where tgrelid=relation and tgname='planet_reader_storage_fence'
    and tgenabled='O' and tgfoid='public.planet_reader_storage_fence()'::regprocedure and tgtype=23) then
    codes:=array_append(codes,'schema-storage-fence');
  else
    execute $query$ select exists(select 1 from storage.objects o where
      (lower(to_jsonb(o)->>'owner_id')=$1::text or lower(to_jsonb(o)->>'owner')=$1::text or (bucket_id='avatars' and lower(split_part(name,'/',1))=$1::text))
      and (bucket_id<>'avatars' or name not in ($1::text||'/avatar.jpg',$1::text||'/avatar.png',$1::text||'/avatar.webp')
        or coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner') is distinct from $1::text
        or (to_jsonb(o)->>'owner_id' is not null and to_jsonb(o)->>'owner_id'<>$1::text)
        or (to_jsonb(o)->>'owner' is not null and to_jsonb(o)->>'owner'<>$1::text))) $query$ into invalid_storage using p_subject;
    if invalid_storage then codes:=array_append(codes,'unsupported-storage-object'); end if;
  end if;
  return array(select distinct c from unnest(codes) c order by c limit 16);
end;
$$;
