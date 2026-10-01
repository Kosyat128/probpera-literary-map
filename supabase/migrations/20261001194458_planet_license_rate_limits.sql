-- Local preparation only; no live database apply, provider activation or release.
-- Explicit server policy only. No default limit/window, IP, token, request body,
-- account-copy identifier or error detail is persisted. These private counters
-- cascade on authorized reader removal; the existing financial audit stays SET NULL.

create table public.planet_license_grant_budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'),
  window_started_at timestamptz not null check (pg_catalog.isfinite(window_started_at)),
  used integer not null check (used between 1 and 10000),
  grant_limit integer not null check (grant_limit between 1 and 10000),
  window_seconds integer not null check (window_seconds between 1 and 86400),
  primary key (user_id, product_id),
  check (used <= grant_limit)
);
create trigger planet_reader_mutation_fence
  before insert or update or delete on public.planet_license_grant_budgets
  for each row execute function public.planet_reader_mutation_fence();
alter table public.planet_license_grant_budgets enable row level security;
alter table public.planet_license_grant_budgets force row level security;
-- No browser policy or privilege. The existing trusted server role has BYPASSRLS.
revoke all on table public.planet_license_grant_budgets from public, anon, authenticated, service_role;
grant select on table public.planet_license_grant_budgets to service_role;
grant insert (user_id, product_id, window_started_at, used, grant_limit, window_seconds)
  on public.planet_license_grant_budgets to service_role;
grant update (window_started_at, used, grant_limit, window_seconds)
  on public.planet_license_grant_budgets to service_role;

create function public.planet_consume_license_grant_budget(
  p_subject uuid, p_product_id text, p_limit integer, p_window_seconds integer
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.planet_license_grant_budgets%rowtype; server_now timestamptz; retry_seconds integer;
begin
  if p_subject is null or p_product_id is null or p_product_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'
    or p_limit is null or p_limit not between 1 and 10000
    or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'PLANET_INVALID_LICENSE_GRANT_BUDGET';
  end if;
  -- Match deletion/payment subject ordering before taking any budget-row lock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array('planet/subject', p_subject)::text, 0));
  select * into r from public.planet_license_grant_budgets
    where user_id = p_subject and product_id = p_product_id for update;
  server_now := pg_catalog.clock_timestamp();
  if not found then
    insert into public.planet_license_grant_budgets
      (user_id, product_id, window_started_at, used, grant_limit, window_seconds)
      values (p_subject, p_product_id, server_now, 1, p_limit, p_window_seconds);
    return pg_catalog.jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
  end if;
  if server_now >= r.window_started_at + pg_catalog.make_interval(secs => r.window_seconds) then
    update public.planet_license_grant_budgets set window_started_at = server_now,
      used = 1, grant_limit = p_limit, window_seconds = p_window_seconds
      where user_id = p_subject and product_id = p_product_id;
    return pg_catalog.jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
  end if;
  -- Configuration changes do not create fresh quota inside an active window.
  -- The caller must handle this RPC error as unavailable; expiry adopts the
  -- newly supplied explicit policy on the next successful consumption.
  if r.grant_limit <> p_limit or r.window_seconds <> p_window_seconds then
    raise exception using errcode = 'P0001', message = 'PLANET_LICENSE_GRANT_BUDGET_POLICY_CONFLICT';
  end if;
  if r.used >= r.grant_limit then
    retry_seconds := least(r.window_seconds::numeric, greatest(1::numeric,
      pg_catalog.ceil(extract(epoch from (r.window_started_at + pg_catalog.make_interval(secs => r.window_seconds) - server_now)))))::integer;
    -- Denial preserves the original count and window; it never slides/reset them.
    return pg_catalog.jsonb_build_object('allowed', false, 'retry_after_seconds', retry_seconds);
  end if;
  update public.planet_license_grant_budgets set used = used + 1
    where user_id = p_subject and product_id = p_product_id;
  return pg_catalog.jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;
revoke all on function public.planet_consume_license_grant_budget(uuid, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.planet_consume_license_grant_budget(uuid, text, integer, integer) to service_role;

-- Preserve the full latest D250 guard with exactly two new body additions:
-- require the budget CASCADE identity FK; classify its user_id as private reader
-- data. Queue CASCADE, financial SET NULL and every other gate remain exact.
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
    ('planet_license_grant_budgets','user_id','auth.users','c'),
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
      'planet_license_grant_budgets',
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

