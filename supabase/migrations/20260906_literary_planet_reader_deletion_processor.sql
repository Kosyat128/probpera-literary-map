-- Local preparation only: no schedule, credentials, reviewed policy or retention
-- period is installed. Apply only through the repository's authorized DB workflow.
-- The narrow reader path deletes private reader data and owned canonical avatars;
-- authored/public/editorial references block. Provider records are UNLINKED, not
-- asserted anonymous: an externally reviewed policy digest is required to proceed.
alter table public.planet_deletion_requests
  add column processor_phase text not null default 'pending'
    check (processor_phase in ('pending','fenced','auth-ready','auth-deleted')),
  add column processor_policy_sha256 text check (processor_policy_sha256 ~ '^[0-9a-f]{64}$'),
  add column processor_lease_token uuid,
  add column processor_lease_until timestamptz,
  add column processor_started_at timestamptz,
  add column processor_attempts integer not null default 0 check (processor_attempts >= 0);

-- All mutation fences use the same subject lock as licensing/request creation.
create function public.planet_assert_reader_not_deleting(p_subject uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_subject is null then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array('planet/subject', p_subject)::text,0));
  if exists (select 1 from public.planet_deletion_requests where user_id=p_subject
    and processor_started_at is not null) then
    raise exception using errcode='P0001', message='PLANET_READER_DELETION_FENCED';
  end if;
end;
$$;

create function public.planet_reader_mutation_fence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare column_name text; subject uuid; payload jsonb; old_payload jsonb;
begin
  payload := case when TG_OP='DELETE' then pg_catalog.to_jsonb(OLD) else pg_catalog.to_jsonb(NEW) end;
  old_payload := case when TG_OP='INSERT' then '{}'::jsonb else pg_catalog.to_jsonb(OLD) end;
  -- Also fence authenticated fallback writes with NULL user_id (e.g. the view
  -- tracker retrying as a guest). Truly anonymous rows have no provable owner.
  perform public.planet_assert_reader_not_deleting(auth.uid());
  -- Discover all real UUID identity FK columns, including newly added ones on an
  -- already fenced table. Composite identity references fail preflight globally.
  for column_name in
    select distinct a.attname from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
    where c.contype='f' and c.conrelid=TG_RELID
      and c.confrelid in ('auth.users'::regclass,'public.profiles'::regclass)
      and a.atttypid='uuid'::regtype
    union select 'user_id' where TG_RELID=pg_catalog.to_regclass('public.reader_book_collection_items')
  loop
    for subject in select distinct v::uuid from unnest(array[payload->>column_name,old_payload->>column_name]) v where v is not null
    loop
      -- Cascades/SET NULL after a committed parent-row removal are allowed; new
      -- orphan references still fail the canonical FK. No user can disable it.
      if exists(select 1 from auth.users where id=subject) then
        -- Only the already armed Auth transaction may remove linked view rows
        -- before their canonical SET NULL FK would detach them. No external
        -- request can observe auth-deleted while its Auth user still exists.
        if TG_OP='DELETE' and TG_RELID=pg_catalog.to_regclass('public.content_views') and pg_trigger_depth()>1
          and exists(select 1 from public.planet_deletion_requests where user_id=subject and processor_phase='auth-deleted'
            and processor_lease_until>clock_timestamp()) then continue; end if;
        perform public.planet_assert_reader_not_deleting(subject);
      end if;
    end loop;
  end loop;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end;
$$;

-- Never DELETE storage.objects directly: only the Storage API removes the blob.
-- Metadata reads and this INSERT/UPDATE fence prevent post-preflight uploads.
create function public.planet_reader_storage_fence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare subject uuid; value text; payload jsonb := pg_catalog.to_jsonb(NEW); prior jsonb;
begin
  prior:=case when TG_OP='UPDATE' then pg_catalog.to_jsonb(OLD) else '{}'::jsonb end;
  for value in select distinct v from unnest(array[payload->>'owner_id',payload->>'owner',
    case when payload->>'bucket_id'='avatars' then split_part(payload->>'name','/',1) end,
    prior->>'owner_id',prior->>'owner',case when prior->>'bucket_id'='avatars' then split_part(prior->>'name','/',1) end]) v where v is not null
  loop
    if value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      subject := value::uuid;
      perform public.planet_assert_reader_not_deleting(subject);
      perform id from auth.users where id=subject for key share;
      if not found then raise exception using errcode='P0001',message='PLANET_STORAGE_OWNER_MISSING'; end if;
    end if;
  end loop;
  return NEW;
end;
$$;

-- Install only on existing canonical public identity references. Future tables
-- without this fence are detected by preflight and cannot silently widen scope.
do $$ declare relation regclass; begin
  for relation in select distinct c.conrelid::regclass from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid=c.conrelid join pg_catalog.pg_namespace n on n.oid=t.relnamespace
    where c.contype='f' and c.confrelid in ('auth.users'::regclass,'public.profiles'::regclass)
      and n.nspname='public' and t.relname not in ('planet_deletion_requests','planet_access_state')
    union select pg_catalog.to_regclass('public.reader_book_collection_items')
  loop
    if relation is not null then execute format('create trigger planet_reader_mutation_fence before insert or update or delete on %s for each row execute function public.planet_reader_mutation_fence()',relation); end if;
  end loop;
  if pg_catalog.to_regclass('storage.objects') is not null then
    execute 'create trigger planet_reader_storage_fence before insert or update on storage.objects for each row execute function public.planet_reader_storage_fence()';
  end if;
end $$;

create function public.planet_reader_deletion_blockers(p_subject uuid)
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

create function public.planet_claim_reader_deletion(p_request_id uuid,p_lease_token uuid,p_policy_sha256 text,p_lease_seconds integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.planet_deletion_requests%rowtype; subject uuid;
begin
  if p_request_id is null or p_lease_token is null or p_policy_sha256 is null or p_policy_sha256 !~ '^[0-9a-f]{64}$'
    or p_lease_seconds is null or p_lease_seconds not between 30 and 600 then raise exception using errcode='22023',message='PLANET_INVALID_PROCESSOR_CLAIM'; end if;
  select user_id into subject from public.planet_deletion_requests where request_id=p_request_id;
  if subject is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.jsonb_build_array('planet/subject',subject)::text,0)); end if;
  select * into r from public.planet_deletion_requests where request_id=p_request_id for update;
  if not found then return jsonb_build_object('status','not-found'); end if;
  if r.status='completed' then
    if r.processor_phase<>'auth-deleted' or r.processor_started_at is null then
      raise exception using errcode='P0001',message='PLANET_LEGACY_COMPLETION_UNVERIFIED'; end if;
    return jsonb_build_object('status','completed');
  end if;
  if r.processor_policy_sha256 is not null and r.processor_policy_sha256<>p_policy_sha256 then return jsonb_build_object('status','policy-conflict'); end if;
  if r.processor_lease_until>clock_timestamp() then return jsonb_build_object('status','busy'); end if;
  update public.planet_deletion_requests set status='processing', processor_policy_sha256=p_policy_sha256,
    processor_lease_token=p_lease_token,processor_lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),
    processor_attempts=processor_attempts+1,updated_at=clock_timestamp(),blocker_codes='{}' where request_id=p_request_id;
  return jsonb_build_object('status','claimed');
end;
$$;

create function public.planet_inspect_reader_deletion(p_request_id uuid,p_lease_token uuid,p_prepare boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.planet_deletion_requests%rowtype; subject uuid; blockers text[]; objects jsonb:='[]'; amount bigint:=0;
begin
  select user_id into subject from public.planet_deletion_requests where request_id=p_request_id;
  if subject is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.jsonb_build_array('planet/subject',subject)::text,0)); end if;
  select * into r from public.planet_deletion_requests where request_id=p_request_id for update;
  if not found or p_lease_token is null or r.processor_lease_token is distinct from p_lease_token
    or r.processor_lease_until is null or r.processor_lease_until<=clock_timestamp() or r.status<>'processing' then
    raise exception using errcode='P0001',message='PLANET_PROCESSOR_LEASE_INVALID'; end if;
  if r.processor_phase='auth-deleted' and r.user_id is null then
    return jsonb_build_object('phase','auth-deleted','subject',null,'blockers','[]'::jsonb,'objects','[]'::jsonb,'objectCount',0);
  end if;
  blockers:=public.planet_reader_deletion_blockers(r.user_id);
  if cardinality(blockers)=0 then
    -- This starts fencing only after preflight: an ineligible staff request must
    -- not freeze unrelated editorial operations while awaiting policy resolution.
    execute 'select count(*),coalesce(jsonb_agg(name order by name),''[]''::jsonb) from storage.objects where bucket_id=''avatars'' and name in ($1::text||''/avatar.jpg'',$1::text||''/avatar.png'',$1::text||''/avatar.webp'')'
      into amount,objects using r.user_id;
    update public.planet_deletion_requests set processor_started_at=coalesce(processor_started_at,clock_timestamp()),
      processor_phase=case when p_prepare and amount=0 then 'auth-ready' else 'fenced' end,updated_at=clock_timestamp()
      where request_id=p_request_id returning * into r;
  end if;
  -- A missing user in a request never armed by this processor is NOT proof that
  -- required preflight/storage cleanup occurred. Return a block, never completed.
  if r.user_id is null then raise exception using errcode='P0001',message='PLANET_UNVERIFIED_ACCOUNT_REMOVAL'; end if;
  return jsonb_build_object('phase',case when r.processor_phase='auth-ready' then 'auth-ready' else 'fenced' end,
    'subject',r.user_id,'blockers',to_jsonb(blockers),'objects',objects,'objectCount',amount);
end;
$$;

create function public.planet_guard_reader_auth_deletion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.planet_deletion_requests%rowtype; blockers text[]; objects_remain boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.jsonb_build_array('planet/subject',OLD.id)::text,0));
  select * into r from public.planet_deletion_requests where user_id=OLD.id for update;
  -- Accounts without a Planet request retain the canonical administrative path.
  if not found then return OLD; end if;
  if r.processor_phase<>'auth-ready' or r.processor_started_at is null or r.processor_policy_sha256 is null
    or r.status<>'processing' or r.processor_lease_until is null or r.processor_lease_until<=clock_timestamp() then
    raise exception using errcode='P0001',message='PLANET_AUTH_DELETION_NOT_ARMED'; end if;
  blockers:=public.planet_reader_deletion_blockers(OLD.id);
  if cardinality(blockers)>0 then raise exception using errcode='P0001',message='PLANET_AUTH_DELETION_BLOCKED'; end if;
  execute 'select exists(select 1 from storage.objects o where lower(to_jsonb(o)->>''owner_id'')=$1::text or lower(to_jsonb(o)->>''owner'')=$1::text or (bucket_id=''avatars'' and lower(split_part(name,''/'',1))=$1::text))' into objects_remain using OLD.id;
  if objects_remain then raise exception using errcode='P0001',message='PLANET_AUTH_DELETION_STORAGE_REMAINS'; end if;
  update public.planet_deletion_requests set processor_phase='auth-deleted',updated_at=clock_timestamp() where request_id=r.request_id;
  -- Atomic with Auth hard-delete: any later FK/trigger/Auth SQL failure rolls this
  -- deletion and the proof phase back together. Never delete by a shared session_id.
  delete from public.content_views where user_id=OLD.id;
  return OLD;
end;
$$;
create trigger planet_guard_reader_auth_deletion before delete on auth.users for each row execute function public.planet_guard_reader_auth_deletion();

create function public.planet_finish_reader_deletion(p_request_id uuid,p_lease_token uuid,p_status text,p_evidence_sha256 text,p_blocker_codes text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.planet_deletion_requests%rowtype; result jsonb;
begin
  select * into r from public.planet_deletion_requests where request_id=p_request_id for update;
  if not found or p_lease_token is null or r.processor_lease_token is distinct from p_lease_token
    or r.processor_lease_until is null or r.processor_lease_until<=clock_timestamp() or r.status<>'processing' then
    raise exception using errcode='P0001',message='PLANET_PROCESSOR_LEASE_INVALID'; end if;
  if p_status not in ('blocked','completed') or (p_status='completed' and
    (r.processor_phase<>'auth-deleted' or r.user_id is not null or r.processor_started_at is null)) then
    raise exception using errcode='P0001',message='PLANET_PROCESSOR_COMPLETION_UNPROVEN'; end if;
  result:=public.planet_record_deletion_outcome(p_request_id,p_status,p_evidence_sha256,p_blocker_codes);
  update public.planet_deletion_requests set processor_lease_token=null,processor_lease_until=null where request_id=p_request_id;
  return result;
end;
$$;

-- Close the older outcome-only path: only the lease-bound guarded wrapper may
-- now claim completion. Browser roles cannot claim/inspect/process any request.
revoke execute on function public.planet_record_deletion_outcome(uuid,text,text,text[]) from service_role;
revoke all on function public.planet_assert_reader_not_deleting(uuid), public.planet_reader_mutation_fence(),
  public.planet_reader_storage_fence(), public.planet_reader_deletion_blockers(uuid),public.planet_guard_reader_auth_deletion(),
  public.planet_claim_reader_deletion(uuid,uuid,text,integer),public.planet_inspect_reader_deletion(uuid,uuid,boolean),
  public.planet_finish_reader_deletion(uuid,uuid,text,text,text[]) from public,anon,authenticated,service_role;
grant execute on function public.planet_claim_reader_deletion(uuid,uuid,text,integer),
  public.planet_inspect_reader_deletion(uuid,uuid,boolean),public.planet_finish_reader_deletion(uuid,uuid,text,text,text[]) to service_role;
