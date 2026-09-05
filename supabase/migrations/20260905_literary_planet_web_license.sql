-- Controlled Web access uses the existing Supabase auth.users identity.
-- Only a trusted server may submit an event AFTER provider verification.
-- This migration configures no merchant, signing key, price or retention period.
-- Signed offline proofs remain usable until their signed deadline; session_epoch
-- is an online invalidation boundary, not a claim of instant offline revocation.

create table if not exists public.planet_payment_events (
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  event_id text not null check (char_length(event_id) between 1 and 240 and event_id !~ '[[:cntrl:]]'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  transaction_id text not null check (char_length(transaction_id) between 1 and 240 and transaction_id !~ '[[:cntrl:]]'),
  user_id uuid references auth.users(id) on delete set null,
  product_id text not null check (product_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'),
  status text not null check (status in ('active', 'refunded', 'revoked')),
  occurred_at timestamptz not null check (isfinite(occurred_at)),
  accepted_at timestamptz not null default clock_timestamp(),
  receipt_applied boolean not null,
  primary key (provider, event_id)
);

create table if not exists public.planet_purchase_receipts (
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  transaction_id text not null check (char_length(transaction_id) between 1 and 240 and transaction_id !~ '[[:cntrl:]]'),
  user_id uuid references auth.users(id) on delete set null,
  product_id text not null check (product_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'),
  status text not null check (status in ('active', 'refunded', 'revoked')),
  last_occurred_at timestamptz not null check (isfinite(last_occurred_at)),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (provider, transaction_id)
);
create index if not exists planet_purchase_receipts_active_subject_idx
  on public.planet_purchase_receipts(user_id, product_id) where status = 'active';

create table if not exists public.planet_access_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_epoch bigint not null default 0 check (session_epoch between 0 and 9007199254740991),
  access_blocked_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.planet_deletion_requests (
  request_id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'requested' check (status in ('requested', 'processing', 'blocked', 'completed')),
  requested_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  evidence_sha256 text check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  blocker_codes text[] not null default '{}',
  check (cardinality(blocker_codes) <= 16 and array_position(blocker_codes, null) is null),
  check ((status = 'completed') = (completed_at is not null)),
  check (status <> 'completed' or (user_id is null and evidence_sha256 is not null))
);
create unique index if not exists planet_deletion_requests_subject_idx
  on public.planet_deletion_requests(user_id) where user_id is not null;

-- Historical provider transaction/event identifiers need an explicit production
-- retention policy. Do not copy the removed account UUID into another column.
-- SET NULL permits a later authorized deletion worker to remove auth.users after
-- resolving EXISTING editorial/staff/storage constraints; no such worker runs here.
alter table public.planet_payment_events enable row level security;
alter table public.planet_payment_events force row level security;
alter table public.planet_purchase_receipts enable row level security;
alter table public.planet_purchase_receipts force row level security;
alter table public.planet_access_state enable row level security;
alter table public.planet_access_state force row level security;
alter table public.planet_deletion_requests enable row level security;
alter table public.planet_deletion_requests force row level security;

revoke all on table public.planet_payment_events, public.planet_purchase_receipts,
  public.planet_access_state, public.planet_deletion_requests
  from public, anon, authenticated, service_role;
grant select on table public.planet_payment_events, public.planet_purchase_receipts,
  public.planet_access_state, public.planet_deletion_requests to authenticated;

drop policy if exists "Planet readers see own payment events" on public.planet_payment_events;
create policy "Planet readers see own payment events" on public.planet_payment_events
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Planet readers see own receipts" on public.planet_purchase_receipts;
create policy "Planet readers see own receipts" on public.planet_purchase_receipts
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Planet readers see own access state" on public.planet_access_state;
create policy "Planet readers see own access state" on public.planet_access_state
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Planet readers see own deletion requests" on public.planet_deletion_requests;
create policy "Planet readers see own deletion requests" on public.planet_deletion_requests
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.planet_apply_verified_payment_event(
  p_provider text,
  p_event_id text,
  p_payload_sha256 text,
  p_transaction_id text,
  p_user_id uuid,
  p_product_id text,
  p_status text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_event public.planet_payment_events%rowtype;
  receipt public.planet_purchase_receipts%rowtype;
  applied boolean := false;
  epoch bigint;
begin
  if p_provider is null or p_provider !~ '^[a-z0-9][a-z0-9._-]{0,63}$'
    or p_event_id is null or char_length(p_event_id) not between 1 and 240 or p_event_id ~ '[[:cntrl:]]'
    or p_payload_sha256 is null or p_payload_sha256 !~ '^[0-9a-f]{64}$'
    or p_transaction_id is null or char_length(p_transaction_id) not between 1 and 240 or p_transaction_id ~ '[[:cntrl:]]'
    or p_user_id is null or p_product_id is null or p_product_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'
    or p_status is null or p_status not in ('active', 'refunded', 'revoked')
    or p_occurred_at is null or not isfinite(p_occurred_at) then
    raise exception using errcode = '22023', message = 'PLANET_INVALID_PAYMENT_EVENT';
  end if;

  -- All event writers acquire locks in event -> transaction -> subject order.
  -- Subject-only operations never acquire an event/transaction lock afterwards.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array('planet/event', p_provider, p_event_id)::text, 0));
  select * into existing_event from public.planet_payment_events
    where provider = p_provider and event_id = p_event_id;
  if found then
    if existing_event.payload_sha256 <> p_payload_sha256
      or existing_event.transaction_id <> p_transaction_id
      or (existing_event.user_id is not null and existing_event.user_id <> p_user_id)
      or existing_event.product_id <> p_product_id or existing_event.status <> p_status
      or existing_event.occurred_at <> p_occurred_at then
      raise exception using errcode = 'P0001', message = 'PLANET_EVENT_ID_CONFLICT';
    end if;
    select * into receipt from public.planet_purchase_receipts
      where provider = p_provider and transaction_id = p_transaction_id;
    select session_epoch into epoch from public.planet_access_state where user_id = existing_event.user_id;
    return pg_catalog.jsonb_build_object('duplicate', true, 'receiptApplied', false,
      'receiptStatus', receipt.status, 'sessionEpoch', coalesce(epoch, 0));
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array('planet/transaction', p_provider, p_transaction_id)::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array('planet/subject', p_user_id)::text, 0));
  perform id from auth.users where id = p_user_id for key share;
  if not found then
    raise exception using errcode = 'P0001', message = 'PLANET_SUBJECT_NOT_FOUND';
  end if;
  insert into public.planet_access_state(user_id) values (p_user_id) on conflict do nothing;

  select * into receipt from public.planet_purchase_receipts
    where provider = p_provider and transaction_id = p_transaction_id for update;
  if found then
    if receipt.user_id is null then
      raise exception using errcode = 'P0001', message = 'PLANET_TRANSACTION_SUBJECT_REMOVED';
    end if;
    if receipt.user_id <> p_user_id or receipt.product_id <> p_product_id then
      raise exception using errcode = 'P0001', message = 'PLANET_TRANSACTION_ID_CONFLICT';
    end if;
    -- A verified terminal event wins even if delivered out of order. Once a
    -- transaction is terminal, no event (including a newer active event) revives it.
    if receipt.status = 'active' and
      (p_status <> 'active' or p_occurred_at > receipt.last_occurred_at) then
      update public.planet_purchase_receipts set status = p_status,
        last_occurred_at = greatest(last_occurred_at, p_occurred_at), updated_at = clock_timestamp()
        where provider = p_provider and transaction_id = p_transaction_id returning * into receipt;
      applied := true;
    end if;
  else
    insert into public.planet_purchase_receipts(provider, transaction_id, user_id, product_id, status, last_occurred_at)
      values (p_provider, p_transaction_id, p_user_id, p_product_id, p_status, p_occurred_at)
      returning * into receipt;
    applied := true;
  end if;

  if applied then
    update public.planet_access_state set session_epoch = session_epoch + 1, updated_at = clock_timestamp()
      where user_id = p_user_id;
  end if;
  insert into public.planet_payment_events(provider, event_id, payload_sha256, transaction_id,
    user_id, product_id, status, occurred_at, receipt_applied)
    values (p_provider, p_event_id, p_payload_sha256, p_transaction_id,
      p_user_id, p_product_id, p_status, p_occurred_at, applied);
  select session_epoch into epoch from public.planet_access_state where user_id = p_user_id;
  return pg_catalog.jsonb_build_object('duplicate', false, 'receiptApplied', applied,
    'receiptStatus', receipt.status, 'sessionEpoch', epoch);
end;
$$;

create or replace function public.planet_get_web_access(p_user_id uuid, p_product_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_row public.planet_access_state%rowtype;
  receipt_count bigint;
begin
  if p_user_id is null or p_product_id is null or p_product_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$' then
    raise exception using errcode = '22023', message = 'PLANET_INVALID_ACCESS_CONTEXT';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array('planet/subject', p_user_id)::text, 0));
  perform id from auth.users where id = p_user_id for key share;
  if not found then raise exception using errcode = 'P0001', message = 'PLANET_SUBJECT_NOT_FOUND'; end if;
  select * into access_row from public.planet_access_state where user_id = p_user_id;
  select count(*) into receipt_count from public.planet_purchase_receipts
    where user_id = p_user_id and product_id = p_product_id and status = 'active';
  return pg_catalog.jsonb_build_object('active', receipt_count > 0 and access_row.access_blocked_at is null,
    'sessionEpoch', coalesce(access_row.session_epoch, 0),
    'accessBlocked', access_row.access_blocked_at is not null, 'activeReceiptCount', receipt_count);
end;
$$;

create or replace function public.planet_revoke_web_sessions(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare epoch bigint;
begin
  if p_user_id is null then raise exception using errcode = '22023', message = 'PLANET_INVALID_SUBJECT'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array('planet/subject', p_user_id)::text, 0));
  perform id from auth.users where id = p_user_id for key share;
  if not found then raise exception using errcode = 'P0001', message = 'PLANET_SUBJECT_NOT_FOUND'; end if;
  insert into public.planet_access_state(user_id, session_epoch) values (p_user_id, 1)
    on conflict (user_id) do update set session_epoch = public.planet_access_state.session_epoch + 1,
      updated_at = clock_timestamp() returning session_epoch into epoch;
  return pg_catalog.jsonb_build_object('sessionEpoch', epoch);
end;
$$;

create or replace function public.planet_request_account_deletion(p_user_id uuid, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.planet_deletion_requests%rowtype;
  epoch bigint;
begin
  if p_user_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'PLANET_INVALID_DELETION_REQUEST';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array('planet/subject', p_user_id)::text, 0));
  perform id from auth.users where id = p_user_id for key share;
  if not found then raise exception using errcode = 'P0001', message = 'PLANET_SUBJECT_NOT_FOUND'; end if;
  select * into request_row from public.planet_deletion_requests where request_id = p_request_id;
  if found and request_row.user_id is distinct from p_user_id then
    raise exception using errcode = 'P0001', message = 'PLANET_DELETION_REQUEST_ID_CONFLICT';
  end if;
  select * into request_row from public.planet_deletion_requests where user_id = p_user_id;
  if not found then
    insert into public.planet_deletion_requests(request_id, user_id) values (p_request_id, p_user_id)
      returning * into request_row;
    insert into public.planet_access_state(user_id, session_epoch, access_blocked_at)
      values (p_user_id, 1, clock_timestamp())
      on conflict (user_id) do update set session_epoch = public.planet_access_state.session_epoch + 1,
        access_blocked_at = coalesce(public.planet_access_state.access_blocked_at, excluded.access_blocked_at),
        updated_at = clock_timestamp();
  end if;
  select session_epoch into epoch from public.planet_access_state where user_id = p_user_id;
  return pg_catalog.jsonb_build_object('requestId', request_row.request_id, 'status', request_row.status,
    'sessionEpoch', epoch);
end;
$$;

create or replace function public.planet_record_deletion_outcome(
  p_request_id uuid,
  p_status text,
  p_evidence_sha256 text,
  p_blocker_codes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare request_row public.planet_deletion_requests%rowtype;
begin
  if p_request_id is null or p_status is null or p_status not in ('processing', 'blocked', 'completed')
    or p_evidence_sha256 is null or p_evidence_sha256 !~ '^[0-9a-f]{64}$'
    or p_blocker_codes is null or cardinality(p_blocker_codes) > 16
    or array_position(p_blocker_codes, null) is not null
    or exists (select 1 from unnest(p_blocker_codes) as code where code !~ '^[a-z][a-z0-9._-]{0,63}$')
    or (p_status = 'blocked' and cardinality(p_blocker_codes) = 0)
    or (p_status <> 'blocked' and cardinality(p_blocker_codes) <> 0) then
    raise exception using errcode = '22023', message = 'PLANET_INVALID_DELETION_OUTCOME';
  end if;
  select * into request_row from public.planet_deletion_requests where request_id = p_request_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'PLANET_DELETION_REQUEST_NOT_FOUND'; end if;
  if request_row.status = 'completed' then
    if p_status <> 'completed' or request_row.evidence_sha256 <> p_evidence_sha256 then
      raise exception using errcode = 'P0001', message = 'PLANET_DELETION_OUTCOME_CONFLICT';
    end if;
    return pg_catalog.jsonb_build_object('requestId', request_row.request_id, 'status', request_row.status);
  end if;
  if p_status = 'completed' and request_row.user_id is not null then
    raise exception using errcode = 'P0001', message = 'PLANET_DELETION_NOT_COMPLETED';
  end if;
  update public.planet_deletion_requests set status = p_status, evidence_sha256 = p_evidence_sha256,
    blocker_codes = p_blocker_codes, updated_at = clock_timestamp(),
    completed_at = case when p_status = 'completed' then clock_timestamp() else null end
    where request_id = p_request_id returning * into request_row;
  return pg_catalog.jsonb_build_object('requestId', request_row.request_id, 'status', request_row.status);
end;
$$;

-- The server supplies only a verified live canonical subject. This read is
-- independent of paid access/session epoch so a lost 202 remains recoverable.
-- After auth deletion SET NULL removes subject lookup; it is never a second
-- identity registry or proof of completion to a subsequently unauthenticated user.
create or replace function public.planet_get_account_deletion_status(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('requestId', request_id, 'status', status)
  from public.planet_deletion_requests where user_id = p_user_id;
$$;

-- The server verifies JWT claims and canonical user first, then checks that the
-- referenced Supabase session still exists. No browser role can query sessions.
create or replace function public.planet_has_auth_session(p_user_id uuid, p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and p_session_id is not null and exists (
    select 1 from auth.sessions where id = p_session_id and user_id = p_user_id
  );
$$;

revoke all on function public.planet_apply_verified_payment_event(text, text, text, text, uuid, text, text, timestamptz),
  public.planet_get_web_access(uuid, text), public.planet_revoke_web_sessions(uuid),
  public.planet_request_account_deletion(uuid, uuid), public.planet_record_deletion_outcome(uuid, text, text, text[]),
  public.planet_has_auth_session(uuid, uuid), public.planet_get_account_deletion_status(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.planet_apply_verified_payment_event(text, text, text, text, uuid, text, text, timestamptz),
  public.planet_get_web_access(uuid, text), public.planet_revoke_web_sessions(uuid),
  public.planet_request_account_deletion(uuid, uuid), public.planet_record_deletion_outcome(uuid, text, text, text[]),
  public.planet_has_auth_session(uuid, uuid), public.planet_get_account_deletion_status(uuid)
  to service_role;
