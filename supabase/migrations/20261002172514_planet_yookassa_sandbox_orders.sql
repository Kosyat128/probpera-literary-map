-- Preliminary web/direct YooKassa sandbox candidate, never commercial approval.
-- No default prices, shop, credentials, deployment, HTTP mount or scheduler.
-- All product IDs are sandbox.* and cannot grant a real product entitlement.
-- This private sandbox intent journal is deleted with the canonical account;
-- the existing separately reviewed retained receipt/event schema is unchanged.
create table public.planet_sandbox_orders (
  id uuid primary key,
  request_id uuid not null,
  -- Coalesced double-tap IDs remain bound even after the order becomes terminal.
  -- Otherwise retrying a second original ID after refund could charge again.
  intent_request_ids uuid[] not null check (cardinality(intent_request_ids) between 1 and 128 and array_position(intent_request_ids,null) is null),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id ~ '^sandbox\.[A-Za-z0-9][A-Za-z0-9._-]{0,111}$'),
  catalog_version text not null check (catalog_version ~ '^[A-Za-z0-9._-]{1,80}$'),
  amount_minor bigint not null check (amount_minor between 1 and 9007199254740991),
  shop_id text not null check (shop_id ~ '^[1-9][0-9]{0,19}$'),
  return_url text not null check (char_length(return_url) between 1 and 2048 and return_url ~ '^https://' and return_url !~ '[[:cntrl:] ]'),
  create_key uuid not null unique,
  refund_key uuid not null unique,
  provider_payment_id text unique check (provider_payment_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  status text not null default 'new' check (status in ('new','pending','waiting_for_capture','succeeded','canceled','refunded','refund-review-required')),
  confirmation_url text check (char_length(confirmation_url) between 1 and 2048 and confirmation_url ~ '^https://yoomoney\.ru/api-pages/v2/payment-confirm/' and confirmation_url !~ '[[:cntrl:] ]'),
  created_at timestamptz not null default clock_timestamp(),
  first_submitted_at timestamptz,
  refund_id text unique check (refund_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  refund_status text check (refund_status in ('pending','succeeded','canceled')),
  refund_first_submitted_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  lease_operation text check (lease_operation in ('payment','refund')),
  unique(user_id,request_id),
  check ((status='new')=(provider_payment_id is null)),
  check ((refund_id is null)=(refund_status is null)),
  check (refund_id is null or provider_payment_id is not null),
  check ((lease_token is null)=(lease_until is null) and (lease_token is null)=(lease_operation is null)),
  check (isfinite(created_at) and (first_submitted_at is null or isfinite(first_submitted_at)) and (refund_first_submitted_at is null or isfinite(refund_first_submitted_at)))
);
-- Distinct concurrent request IDs/double taps reuse one unresolved or successful
-- nonconsumable intent. A terminal refunded/canceled order remains immutable and
-- a new explicit intent may be created; retries of the old request never do so.
create unique index planet_sandbox_order_open_subject_product on public.planet_sandbox_orders(user_id,product_id)
  where status not in ('refunded','canceled');
create trigger planet_reader_mutation_fence before insert or update or delete on public.planet_sandbox_orders
  for each row execute function public.planet_reader_mutation_fence();
alter table public.planet_sandbox_orders enable row level security;
alter table public.planet_sandbox_orders force row level security;
revoke all on table public.planet_sandbox_orders from public,anon,authenticated,service_role;

create function public.planet_assert_sandbox_order_access(p_subject uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.planet_assert_reader_not_deleting(p_subject);
  if exists(select 1 from public.planet_access_state where user_id=p_subject and access_blocked_at is not null) then
    raise exception using errcode='P0001',message='PLANET_ORDER_ACCESS_BLOCKED'; end if;
end;
$$;

create function public.planet_sandbox_order_json(p public.planet_sandbox_orders) returns jsonb
language sql stable security definer set search_path='' as $$
  select pg_catalog.jsonb_build_object('id',(p).id,'subject',(p).user_id,'product',(p).product_id,'catalogVersion',(p).catalog_version,
    'amountMinor',(p).amount_minor,'currency','RUB','shopId',(p).shop_id,'returnUrl',(p).return_url,'createKey',(p).create_key,
    'refundKey',(p).refund_key,'providerId',(p).provider_payment_id,'status',(p).status,'createdAt',(p).created_at,
    'firstSubmittedAt',(p).first_submitted_at,'confirmationUrl',(p).confirmation_url,'refundId',(p).refund_id,
    'refundStatus',(p).refund_status,'refundFirstSubmittedAt',(p).refund_first_submitted_at);
$$;
create function public.planet_reserve_sandbox_order(p_id uuid,p_request_id uuid,p_subject uuid,p_product text,p_catalog_version text,
  p_amount_minor bigint,p_shop_id text,p_return_url text,p_create_key uuid,p_refund_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.planet_sandbox_orders%rowtype;
begin
  if p_id is null or p_request_id is null or p_subject is null or p_create_key is null or p_refund_key is null
    or p_product is null or p_product !~ '^sandbox\.[A-Za-z0-9][A-Za-z0-9._-]{0,111}$'
    or p_catalog_version is null or p_catalog_version !~ '^[A-Za-z0-9._-]{1,80}$'
    or p_amount_minor is null or p_amount_minor not between 1 and 9007199254740991
    or p_shop_id is null or p_shop_id !~ '^[1-9][0-9]{0,19}$' or p_return_url is null
    or char_length(p_return_url) not between 1 and 2048 or p_return_url !~ '^https://' or p_return_url ~ '[[:cntrl:] ]'
    then raise exception using errcode='22023',message='PLANET_INVALID_SANDBOX_ORDER'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.jsonb_build_array('planet/subject',p_subject)::text,0));
  perform public.planet_assert_sandbox_order_access(p_subject);
  if not exists(select 1 from auth.users where id=p_subject) then raise exception using errcode='P0001',message='PLANET_SUBJECT_NOT_FOUND'; end if;
  select * into r from public.planet_sandbox_orders where user_id=p_subject and p_request_id=any(intent_request_ids) for update;
  if found then
    if r.product_id<>p_product then raise exception using errcode='P0001',message='PLANET_ORDER_REQUEST_CONFLICT'; end if;
    return public.planet_sandbox_order_json(r);
  end if;
  select * into r from public.planet_sandbox_orders where user_id=p_subject and product_id=p_product and status not in ('refunded','canceled') for update;
  if found then
    if r.shop_id<>p_shop_id or r.return_url<>p_return_url then raise exception using errcode='P0001',message='PLANET_ORDER_CONFIG_CHANGED'; end if;
    if cardinality(r.intent_request_ids)>=128 then raise exception using errcode='P0001',message='PLANET_ORDER_INTENT_CAPACITY'; end if;
    update public.planet_sandbox_orders set intent_request_ids=array_append(intent_request_ids,p_request_id) where id=r.id returning * into r;
    return public.planet_sandbox_order_json(r);
  end if;
  insert into public.planet_sandbox_orders(id,request_id,intent_request_ids,user_id,product_id,catalog_version,amount_minor,shop_id,return_url,create_key,refund_key)
    values(p_id,p_request_id,array[p_request_id],p_subject,p_product,p_catalog_version,p_amount_minor,p_shop_id,p_return_url,p_create_key,p_refund_key) returning * into r;
  return public.planet_sandbox_order_json(r);
end;
$$;
create function public.planet_read_sandbox_order(p_subject uuid,p_order_id uuid,p_payment_id text,p_product text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.planet_sandbox_orders%rowtype;
begin
  if (p_order_id is null)::integer+(p_payment_id is null)::integer+(p_product is null)::integer<>2
    or (p_subject is null and p_order_id is null and p_payment_id is null) then
    raise exception using errcode='22023',message='PLANET_INVALID_ORDER_LOOKUP'; end if;
  if p_subject is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.jsonb_build_array('planet/subject',p_subject)::text,0));
    perform public.planet_assert_sandbox_order_access(p_subject);
  end if;
  select * into r from public.planet_sandbox_orders where (p_subject is null or user_id=p_subject)
    and (p_order_id is null or id=p_order_id) and (p_payment_id is null or provider_payment_id=p_payment_id)
    and (p_product is null or product_id=p_product) order by created_at desc,id desc limit 1;
  if not found then return null; end if;
  return public.planet_sandbox_order_json(r);
end;
$$;
create function public.planet_claim_sandbox_order(p_subject uuid,p_order_id uuid,p_lease_token uuid,p_operation text,p_lease_seconds integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.planet_sandbox_orders%rowtype; t timestamptz:=clock_timestamp(); first_at timestamptz;
begin
  if p_subject is null or p_order_id is null or p_lease_token is null or p_operation is null or p_operation not in ('payment','refund')
    or p_lease_seconds is null or p_lease_seconds not between 30 and 600 then raise exception using errcode='22023',message='PLANET_INVALID_ORDER_CLAIM'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.jsonb_build_array('planet/subject',p_subject)::text,0));
  perform public.planet_assert_sandbox_order_access(p_subject);
  select * into r from public.planet_sandbox_orders where id=p_order_id and user_id=p_subject for update;
  if not found then raise exception using errcode='P0001',message='PLANET_ORDER_NOT_FOUND'; end if;
  if (p_operation='payment' and r.provider_payment_id is not null) or (p_operation='refund' and r.refund_id is not null)
    or (r.lease_until is not null and r.lease_until>t) then
    return pg_catalog.jsonb_build_object('status','busy','leaseToken',null,'order',public.planet_sandbox_order_json(r)); end if;
  if p_operation='refund' and (r.status<>'succeeded' or r.provider_payment_id is null) then raise exception using errcode='P0001',message='PLANET_REFUND_NOT_ELIGIBLE'; end if;
  first_at:=case when p_operation='payment' then r.first_submitted_at else r.refund_first_submitted_at end;
  -- Clock rollback also fails closed. The 24h limit is the provider guarantee,
  -- not a locally invented commerce timeout or permission to retry a charge.
  if first_at is not null and (t<first_at or t>=first_at+interval '24 hours') then
    return pg_catalog.jsonb_build_object('status','reconcile-required','leaseToken',null,'order',public.planet_sandbox_order_json(r)); end if;
  update public.planet_sandbox_orders set lease_token=p_lease_token,lease_until=t+pg_catalog.make_interval(secs=>p_lease_seconds),lease_operation=p_operation,
    first_submitted_at=case when p_operation='payment' then coalesce(first_submitted_at,t) else first_submitted_at end,
    refund_first_submitted_at=case when p_operation='refund' then coalesce(refund_first_submitted_at,t) else refund_first_submitted_at end
    where id=r.id returning * into r;
  return pg_catalog.jsonb_build_object('status','claimed','leaseToken',p_lease_token,'order',public.planet_sandbox_order_json(r));
end;
$$;
create function public.planet_record_sandbox_payment(p_subject uuid,p_order_id uuid,p_payment_id text,p_status text,p_confirmation_url text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.planet_sandbox_orders%rowtype;
begin
  if p_subject is null or p_order_id is null or p_payment_id is null or p_payment_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_status is null or p_status not in ('pending','waiting_for_capture','succeeded','canceled','refunded','refund-review-required')
    or (p_confirmation_url is not null and (char_length(p_confirmation_url) not between 1 and 2048 or p_confirmation_url !~ '^https://yoomoney\.ru/api-pages/v2/payment-confirm/' or p_confirmation_url ~ '[[:cntrl:] ]'))
    then raise exception using errcode='22023',message='PLANET_INVALID_PAYMENT_OBSERVATION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.jsonb_build_array('planet/subject',p_subject)::text,0));
  perform public.planet_assert_sandbox_order_access(p_subject);
  select * into r from public.planet_sandbox_orders where id=p_order_id and user_id=p_subject for update;
  if not found then raise exception using errcode='P0001',message='PLANET_ORDER_NOT_FOUND'; end if;
  if r.provider_payment_id is not null and r.provider_payment_id<>p_payment_id then raise exception using errcode='P0001',message='PLANET_PAYMENT_ORDER_CONFLICT'; end if;
  if r.status not in ('refunded','canceled') then
    update public.planet_sandbox_orders set provider_payment_id=p_payment_id,
      status=case when status='refund-review-required' and p_status not in ('refunded','canceled') then status
        when status='succeeded' and p_status in ('pending','waiting_for_capture') then status else p_status end,
      confirmation_url=case when p_status='pending' then p_confirmation_url else null end,
      lease_token=case when lease_operation='payment' then null else lease_token end,
      lease_until=case when lease_operation='payment' then null else lease_until end,
      lease_operation=case when lease_operation='payment' then null else lease_operation end where id=r.id returning * into r;
  end if;
  return public.planet_sandbox_order_json(r);
end;
$$;
create function public.planet_record_sandbox_refund(p_subject uuid,p_order_id uuid,p_payment_id text,p_refund_id text,p_status text,p_amount_minor bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.planet_sandbox_orders%rowtype;
begin
  if p_subject is null or p_order_id is null or p_payment_id is null or p_refund_id is null
    or p_refund_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_status is null or p_status not in ('pending','succeeded','canceled') or p_amount_minor is null then
    raise exception using errcode='22023',message='PLANET_INVALID_REFUND_OBSERVATION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.jsonb_build_array('planet/subject',p_subject)::text,0));
  perform public.planet_assert_sandbox_order_access(p_subject);
  select * into r from public.planet_sandbox_orders where id=p_order_id and user_id=p_subject for update;
  if not found then raise exception using errcode='P0001',message='PLANET_ORDER_NOT_FOUND'; end if;
  if r.provider_payment_id is distinct from p_payment_id or r.amount_minor<>p_amount_minor or (r.refund_id is not null and r.refund_id<>p_refund_id)
    then raise exception using errcode='P0001',message='PLANET_REFUND_ORDER_CONFLICT'; end if;
  update public.planet_sandbox_orders set refund_id=p_refund_id,
    refund_status=case when refund_status in ('succeeded','canceled') then refund_status else p_status end,
    lease_token=null,lease_until=null,lease_operation=null where id=r.id returning * into r;
  return public.planet_sandbox_order_json(r);
end;
$$;
revoke all on function public.planet_assert_sandbox_order_access(uuid),public.planet_sandbox_order_json(public.planet_sandbox_orders),
  public.planet_reserve_sandbox_order(uuid,uuid,uuid,text,text,bigint,text,text,uuid,uuid),public.planet_read_sandbox_order(uuid,uuid,text,text),
  public.planet_claim_sandbox_order(uuid,uuid,uuid,text,integer),public.planet_record_sandbox_payment(uuid,uuid,text,text,text),
  public.planet_record_sandbox_refund(uuid,uuid,text,text,text,bigint) from public,anon,authenticated,service_role;
grant execute on function public.planet_reserve_sandbox_order(uuid,uuid,uuid,text,text,bigint,text,text,uuid,uuid),public.planet_read_sandbox_order(uuid,uuid,text,text),
  public.planet_claim_sandbox_order(uuid,uuid,uuid,text,integer),public.planet_record_sandbox_payment(uuid,uuid,text,text,text),
  public.planet_record_sandbox_refund(uuid,uuid,text,text,text,bigint) to service_role;

-- Keep the canonical response/locking/privileges and live-provider eligibility
-- unchanged. A sandbox receipt alone is not sufficient: its exact current
-- sandbox order must remain succeeded. Review holds neither fabricate a refund
-- decision nor terminally rewrite a previously paid receipt. Fresh online
-- grants fail closed; already signed offline proofs retain their bound expiry.
create or replace function public.planet_get_web_access(p_user_id uuid, p_product_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare access_row public.planet_access_state%rowtype; receipt_count bigint;
begin
  if p_user_id is null or p_product_id is null or p_product_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$' then
    raise exception using errcode='22023',message='PLANET_INVALID_ACCESS_CONTEXT'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.jsonb_build_array('planet/subject',p_user_id)::text,0));
  perform id from auth.users where id=p_user_id for key share;
  if not found then raise exception using errcode='P0001',message='PLANET_SUBJECT_NOT_FOUND'; end if;
  select * into access_row from public.planet_access_state where user_id=p_user_id;
  select count(*) into receipt_count from public.planet_purchase_receipts r
    where r.user_id=p_user_id and r.product_id=p_product_id and r.status='active'
      and (r.provider<>'yookassa-sandbox' or (r.product_id like 'sandbox.%' and exists(
        select 1 from public.planet_sandbox_orders o where o.user_id=r.user_id and o.product_id=r.product_id
          and o.provider_payment_id=r.transaction_id and o.status='succeeded')));
  return pg_catalog.jsonb_build_object('active',receipt_count>0 and access_row.access_blocked_at is null,
    'sessionEpoch',coalesce(access_row.session_epoch,0),'accessBlocked',access_row.access_blocked_at is not null,'activeReceiptCount',receipt_count);
end;
$$;

-- Preserve the exact existing deletion classifier and extend only the reviewed
-- private sandbox journal FK/cascade whitelist. Existing retention checks stay.
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
      'planet_verified_payment_retries','planet_sandbox_orders',
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
