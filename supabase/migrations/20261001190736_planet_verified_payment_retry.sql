-- Local preparation only; no live database apply or provider activation.
-- S03 COMMERCE-001/008 remain OPEN. No provider, scheduler, merchant, secret,
-- production acceptance, deletion-policy approval or retention period is added.
-- Enqueue only provider-verified fields and the original payload SHA256. Never
-- persist raw payloads, request headers, card details, credentials or error text.
-- The existing planet_apply_verified_payment_event remains ledger authority.
-- A processor applies the exact claimed event through that authority, then
-- finishes this job. Lost acknowledgements replay the same immutable event.
-- The queue does not create receipts, session epochs or access grants.
-- Queue jobs are transient private reader work: authorized account removal
-- cascades them, while the existing payment events/receipts remain SET NULL.

create table public.planet_verified_payment_retries (
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  event_id text not null check (pg_catalog.char_length(event_id) between 1 and 240 and event_id !~ '[[:cntrl:]]'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  transaction_id text not null check (pg_catalog.char_length(transaction_id) between 1 and 240 and transaction_id !~ '[[:cntrl:]]'),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'),
  payment_status text not null check (payment_status in ('active', 'refunded', 'revoked')),
  occurred_at timestamptz not null check (pg_catalog.isfinite(occurred_at)),
  state text not null default 'pending' check (state in ('pending', 'leased', 'completed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default pg_catalog.clock_timestamp() check (pg_catalog.isfinite(next_attempt_at)),
  lease_token uuid,
  lease_until timestamptz check (pg_catalog.isfinite(lease_until)),
  last_failure_code text check (last_failure_code in ('payment-apply-unavailable', 'payment-completion-unavailable')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  completed_at timestamptz check (pg_catalog.isfinite(completed_at)),
  primary key (provider, event_id),
  check ((state = 'leased') = (lease_token is not null and lease_until is not null)),
  check (state = 'leased' or (lease_token is null and lease_until is null)),
  check (state <> 'leased' or next_attempt_at = lease_until),
  check ((state = 'completed') = (completed_at is not null))
);

-- next_attempt_at is also the reclaim deadline while a job is leased. One
-- partial index therefore serves both pending retries and abandoned leases.
create index planet_verified_payment_retries_due_idx
  on public.planet_verified_payment_retries(next_attempt_at, created_at, provider, event_id)
  where state in ('pending', 'leased');

create trigger planet_reader_mutation_fence
  before insert or update or delete on public.planet_verified_payment_retries
  for each row execute function public.planet_reader_mutation_fence();

alter table public.planet_verified_payment_retries enable row level security;
alter table public.planet_verified_payment_retries force row level security;
-- No browser policies: access defaults to denied. service_role is the existing
-- trusted server role with BYPASSRLS; it is never exposed to browser clients.
revoke all on table public.planet_verified_payment_retries from public, anon, authenticated, service_role;
grant select on table public.planet_verified_payment_retries to service_role;
grant insert (provider, event_id, payload_sha256, transaction_id, user_id, product_id, payment_status, occurred_at)
  on public.planet_verified_payment_retries to service_role;
-- Column privileges keep verified identity/payment fields immutable to the
-- processor role. State metadata can change; no DELETE privilege is granted.
grant update (state, attempts, next_attempt_at, lease_token, lease_until, last_failure_code, updated_at, completed_at)
  on public.planet_verified_payment_retries to service_role;
-- Invoker completion reads only original event-proof columns. The existing
-- SECURITY DEFINER apply authority still owns every receipt/access mutation.
grant select (provider, event_id, payload_sha256, transaction_id, user_id, product_id, status, occurred_at)
  on public.planet_payment_events to service_role;

-- Preserve the complete canonical deletion guard. Exactly two body deltas:
-- (1) require the queue's validated CASCADE identity FK; (2) classify the
-- queue user_id as safe private reader data. Every retained-payment column
-- check, mutation fence, editorial/staff/storage blocker and policy gate stays.
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
      'planet_verified_payment_retries',
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
  -- A new child cascade from a private table needs its own review; permit only
  -- the canonical owner-matching collection item FK, with a matching fence.
  for item in select c.*, t.relname, n.nspname, rt.relname as referenced_table
    from pg_catalog.pg_constraint c join pg_catalog.pg_class t on t.oid=c.conrelid
    join pg_catalog.pg_namespace n on n.oid=t.relnamespace join pg_catalog.pg_class rt on rt.oid=c.confrelid
    join pg_catalog.pg_namespace rn on rn.oid=rt.relnamespace
    where c.contype='f' and rn.nspname='public' and rt.relname in ('reader_favorites','reader_book_collections',
      'reader_book_collection_items','reader_book_favorites','reader_progress','reader_subscriptions','reader_notifications','content_views')
  loop
    if not (item.nspname='public' and item.relname='reader_book_collection_items' and item.referenced_table='reader_book_collections'
      and item.confdeltype='c' and item.convalidated
      and (select array_agg(attname::text order by array_position(item.conkey,attnum)) from pg_catalog.pg_attribute where attrelid=item.conrelid and attnum=any(item.conkey))=array['user_id','collection_id']
      and (select array_agg(attname::text order by array_position(item.confkey,attnum)) from pg_catalog.pg_attribute where attrelid=item.confrelid and attnum=any(item.confkey))=array['user_id','id']
      and exists(select 1 from pg_catalog.pg_trigger where tgrelid=item.conrelid and tgname='planet_reader_mutation_fence' and tgenabled='O' and tgtype=31)
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

create function public.planet_enqueue_verified_payment_retry(
  p_provider text, p_event_id text, p_payload_sha256 text, p_transaction_id text,
  p_user_id uuid, p_product_id text, p_status text, p_occurred_at timestamptz
)
returns jsonb language plpgsql security invoker set search_path = '' set timezone = 'UTC' as $$
declare r public.planet_verified_payment_retries%rowtype; inserted_state text;
begin
  if p_provider is null or p_provider !~ '^[a-z0-9][a-z0-9._-]{0,63}$'
    or p_event_id is null or pg_catalog.char_length(p_event_id) not between 1 and 240 or p_event_id ~ '[[:cntrl:]]'
    or p_payload_sha256 is null or p_payload_sha256 !~ '^[0-9a-f]{64}$'
    or p_transaction_id is null or pg_catalog.char_length(p_transaction_id) not between 1 and 240 or p_transaction_id ~ '[[:cntrl:]]'
    or p_user_id is null or p_product_id is null or p_product_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'
    or p_status is null or p_status not in ('active', 'refunded', 'revoked')
    or p_occurred_at is null or not pg_catalog.isfinite(p_occurred_at) then
    raise exception using errcode = '22023', message = 'PLANET_INVALID_PAYMENT_RETRY_EVENT';
  end if;

  insert into public.planet_verified_payment_retries
    (provider, event_id, payload_sha256, transaction_id, user_id, product_id, payment_status, occurred_at)
    values (p_provider, p_event_id, p_payload_sha256, p_transaction_id, p_user_id, p_product_id, p_status, p_occurred_at)
    on conflict (provider, event_id) do nothing returning state into inserted_state;
  if found then
    return pg_catalog.jsonb_build_object('status', 'queued', 'jobState', inserted_state);
  end if;
  select * into r from public.planet_verified_payment_retries
    where provider = p_provider and event_id = p_event_id for update;
  if not found or r.payload_sha256 is distinct from p_payload_sha256
    or r.transaction_id is distinct from p_transaction_id
    or r.user_id is distinct from p_user_id
    or r.product_id is distinct from p_product_id or r.payment_status is distinct from p_status
    or r.occurred_at is distinct from p_occurred_at then
    raise exception using errcode = 'P0001', message = 'PLANET_PAYMENT_RETRY_EVENT_CONFLICT';
  end if;
  -- Exact replay never rewrites fields, renews a lease or revives a completed job.
  return pg_catalog.jsonb_build_object('status', 'duplicate', 'jobState', r.state);
end;
$$;

create function public.planet_claim_verified_payment_retry(p_lease_token uuid, p_lease_seconds integer)
returns jsonb language plpgsql security invoker set search_path = '' set timezone = 'UTC' as $$
declare r public.planet_verified_payment_retries%rowtype; server_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_lease_token is null or p_lease_seconds is null or p_lease_seconds not between 30 and 600 then
    raise exception using errcode = '22023', message = 'PLANET_INVALID_PAYMENT_RETRY_CLAIM';
  end if;
  -- Each claim uses a fresh UUID. A repeated old token cannot reclaim its own
  -- expired lease. Authorized account removal cascades its transient jobs.
  select * into r from public.planet_verified_payment_retries q
    where q.state in ('pending', 'leased')
      and q.next_attempt_at <= server_now
      and (q.state = 'pending' or q.lease_until <= server_now)
      and q.lease_token is distinct from p_lease_token
    order by q.next_attempt_at, q.created_at, q.provider, q.event_id
    limit 1 for update skip locked;
  if not found then return pg_catalog.jsonb_build_object('status', 'empty'); end if;

  -- The canonical mutation fence locks the subject. Never wait row -> subject
  -- against the deletion processor's subject -> row lock order.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array('planet/subject', r.user_id)::text, 0)) then
    return pg_catalog.jsonb_build_object('status', 'empty');
  end if;
  server_now := pg_catalog.clock_timestamp();
  update public.planet_verified_payment_retries set state = 'leased',
    lease_token = p_lease_token, lease_until = server_now + pg_catalog.make_interval(secs => p_lease_seconds),
    next_attempt_at = server_now + pg_catalog.make_interval(secs => p_lease_seconds),
    attempts = attempts + 1, updated_at = server_now
    where provider = r.provider and event_id = r.event_id returning * into r;
  return pg_catalog.jsonb_build_object('status', 'claimed', 'provider', r.provider,
    'eventId', r.event_id, 'payloadSha256', r.payload_sha256, 'transactionId', r.transaction_id,
    'subject', r.user_id, 'product', r.product_id, 'paymentStatus', r.payment_status,
    'occurredAt', pg_catalog.to_char(r.occurred_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'leaseToken', r.lease_token, 'leaseUntil', pg_catalog.to_char(r.lease_until, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'attempts', r.attempts);
end;
$$;

create function public.planet_finish_verified_payment_retry(p_provider text, p_event_id text, p_lease_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' set timezone = 'UTC' as $$
declare r public.planet_verified_payment_retries%rowtype; subject uuid; server_now timestamptz;
begin
  if p_provider is null or p_event_id is null or p_lease_token is null then
    raise exception using errcode = '22023', message = 'PLANET_INVALID_PAYMENT_RETRY_FINISH';
  end if;
  select user_id into subject from public.planet_verified_payment_retries
    where provider = p_provider and event_id = p_event_id;
  if subject is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      pg_catalog.jsonb_build_array('planet/subject', subject)::text, 0));
  end if;
  select * into r from public.planet_verified_payment_retries
    where provider = p_provider and event_id = p_event_id for update;
  server_now := pg_catalog.clock_timestamp();
  if not found or r.state <> 'leased' or r.lease_token is distinct from p_lease_token
    or r.lease_until is null or r.lease_until <= server_now then
    raise exception using errcode = 'P0001', message = 'PLANET_PAYMENT_RETRY_LEASE_INVALID';
  end if;
  -- Completion needs committed evidence from the sole ledger authority.
  -- Completion through this RPC cannot discard an event whose apply did not commit.
  if not exists (select 1 from public.planet_payment_events e
    where e.provider = r.provider and e.event_id = r.event_id
      and e.payload_sha256 = r.payload_sha256 and e.transaction_id = r.transaction_id
      and e.user_id is not distinct from r.user_id and e.product_id = r.product_id
      and e.status = r.payment_status and e.occurred_at = r.occurred_at) then
    raise exception using errcode = 'P0001', message = 'PLANET_PAYMENT_RETRY_APPLY_UNPROVEN';
  end if;
  update public.planet_verified_payment_retries set state = 'completed', completed_at = server_now,
    lease_token = null, lease_until = null, updated_at = server_now
    where provider = r.provider and event_id = r.event_id;
  return pg_catalog.jsonb_build_object('status', 'completed');
end;
$$;

create function public.planet_reschedule_verified_payment_retry(
  p_provider text, p_event_id text, p_lease_token uuid, p_failure_code text, p_retry_seconds integer
)
returns jsonb language plpgsql security invoker set search_path = '' set timezone = 'UTC' as $$
declare r public.planet_verified_payment_retries%rowtype; subject uuid; server_now timestamptz;
begin
  if p_provider is null or p_event_id is null or p_lease_token is null
    or p_failure_code is null or p_failure_code not in ('payment-apply-unavailable', 'payment-completion-unavailable')
    or p_retry_seconds is null or p_retry_seconds not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'PLANET_INVALID_PAYMENT_RETRY_RESCHEDULE';
  end if;
  select user_id into subject from public.planet_verified_payment_retries
    where provider = p_provider and event_id = p_event_id;
  if subject is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      pg_catalog.jsonb_build_array('planet/subject', subject)::text, 0));
  end if;
  select * into r from public.planet_verified_payment_retries
    where provider = p_provider and event_id = p_event_id for update;
  server_now := pg_catalog.clock_timestamp();
  if not found or r.state <> 'leased' or r.lease_token is distinct from p_lease_token
    or r.lease_until is null or r.lease_until <= server_now then
    raise exception using errcode = 'P0001', message = 'PLANET_PAYMENT_RETRY_LEASE_INVALID';
  end if;
  update public.planet_verified_payment_retries set state = 'pending',
    next_attempt_at = server_now + pg_catalog.make_interval(secs => p_retry_seconds),
    last_failure_code = p_failure_code, lease_token = null, lease_until = null, updated_at = server_now
    where provider = r.provider and event_id = r.event_id returning * into r;
  -- No attempt cap discards verified work. Bounded backoff and worker scheduling
  -- are distinct from a future reviewed retention/deletion policy.
  return pg_catalog.jsonb_build_object('status', 'pending',
    'nextAttemptAt', pg_catalog.to_char(r.next_attempt_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end;
$$;

revoke all on function
  public.planet_enqueue_verified_payment_retry(text, text, text, text, uuid, text, text, timestamptz),
  public.planet_claim_verified_payment_retry(uuid, integer),
  public.planet_finish_verified_payment_retry(text, text, uuid),
  public.planet_reschedule_verified_payment_retry(text, text, uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function
  public.planet_enqueue_verified_payment_retry(text, text, text, text, uuid, text, text, timestamptz),
  public.planet_claim_verified_payment_retry(uuid, integer),
  public.planet_finish_verified_payment_retry(text, text, uuid),
  public.planet_reschedule_verified_payment_retry(text, text, uuid, text, integer)
  to service_role;
