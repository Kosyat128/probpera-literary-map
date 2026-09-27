-- Atomic compare-and-append in the EXISTING audit store; no new database or queue.
-- Migration is prepared for the guarded schema/review workflow, not applied by a sender.
create index if not exists admin_audit_literary_news_runtime_key_version
  on public.admin_audit_log(entity_id,id desc) where entity_type = 'literary_news_runtime';
create or replace function public.protect_literary_news_runtime_log()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if (case when tg_op = 'DELETE' then old.entity_type else new.entity_type end) = 'literary_news_runtime'
    and current_user not in ('postgres', 'service_role') then
    raise exception 'literary news runtime writes require the guarded RPC' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger protect_literary_news_runtime_log
before insert or update or delete on public.admin_audit_log
for each row execute function public.protect_literary_news_runtime_log();

create or replace function public.compare_append_literary_news_runtime(
  p_key text, p_expected_id bigint, p_state jsonb,
  p_control_key text default null, p_expected_control_id bigint default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_id bigint; v_state jsonb; v_inserted bigint; v_control_id bigint; v_control jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_key is null or length(p_key) > 400
    or p_key !~ '^(post|destination|admission|heartbeat|history):[A-Za-z0-9_%:.-]+$'
    or jsonb_typeof(p_state) <> 'object' or p_state is null
    or octet_length(p_state::text) > 262144 then
    raise exception 'invalid literary news state' using errcode = '22023';
  end if;
  -- Lock destination before job, matching all operator pause/resume transitions.
  if p_control_key is not null then
    if p_control_key is distinct from ('destination:' || (p_state #>> '{destination,platform}') || ':' || (p_state #>> '{destination,id}'))
      or p_control_key !~ '^destination:(telegram|vk):-[0-9]+$' then
      raise exception 'invalid destination guard' using errcode = '22023';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('literary-news-runtime:' || p_control_key, 0));
    select id, metadata into v_control_id, v_control from public.admin_audit_log
      where entity_type = 'literary_news_runtime' and entity_id = p_control_key order by id desc limit 1;
    if v_control_id is distinct from p_expected_control_id or v_control_id is null
      or coalesce(v_control->>'mode','off') not in ('on','canary')
      or coalesce((v_control->>'paused')::boolean, true)
      or not coalesce((v_control->>'historyReconciled')::boolean, false)
      or coalesce((v_control->>'nextDueAt')::timestamptz > clock_timestamp(), false)
      or (v_control->>'mode' = 'canary' and v_control->>'canaryNewsId' is distinct from p_state->>'newsId') then
      return jsonb_build_object('applied', false, 'reason', 'destination_changed');
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('literary-news-runtime:' || p_key, 0));
  select id, metadata into v_id, v_state from public.admin_audit_log
    where entity_type = 'literary_news_runtime' and entity_id = p_key
    order by id desc limit 1;
  if v_id is distinct from p_expected_id then
    return jsonb_build_object('applied', false, 'id', v_id, 'state', v_state);
  end if;
  if p_key like 'post:%' and p_state->>'dispatchStartedAt' is not null
    and v_state->>'dispatchStartedAt' is null and p_control_key is null then
    raise exception 'dispatch start requires atomic destination guard' using errcode = '22023';
  end if;
  insert into public.admin_audit_log(action, entity_type, entity_id, metadata)
    values ('literary_news.runtime_transition', 'literary_news_runtime', p_key, p_state)
    returning id into v_inserted;
  return jsonb_build_object('applied', true, 'id', v_inserted, 'state', p_state);
end;
$$;
revoke all on function public.compare_append_literary_news_runtime(text,bigint,jsonb,text,bigint) from public, anon, authenticated;
grant execute on function public.compare_append_literary_news_runtime(text,bigint,jsonb,text,bigint) to service_role;
comment on function public.compare_append_literary_news_runtime(text,bigint,jsonb,text,bigint) is
  'Service-only durable CAS for literary agenda admissions, destination controls, claims and receipts. External provider calls occur after transaction commit. Audit rows have no cache TTL.';

-- Explicit operator decisions in the existing journal. No destination bootstrap or external writes.
create or replace function public.operate_literary_news_runtime(
  p_key text, p_expected_id bigint, p_operation text, p_reason text,
  p_remote_id text default null, p_proof_url text default null, p_verified boolean default false
) returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid(); v_id bigint; v_state jsonb; v_next jsonb; v_inserted bigint;
  v_destination_key text; v_platform text; v_destination_id text; v_expected_url text;
begin
  if v_actor is null or not public.is_staff(array['owner'::public.staff_role,'admin'::public.staff_role]) then
    raise exception 'news operator access required' using errcode='42501';
  end if;
  if exists(select 1 from auth.mfa_factors where user_id=v_actor and status='verified')
    and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa-required' using errcode='42501';
  end if;
  if p_key is null or length(p_key)>400 or p_expected_id is null or p_expected_id<1
    or p_operation is null or p_operation not in ('pause','resume','bind_remote','not_sent','explicitly_close')
    or p_reason is null or length(btrim(p_reason)) not between 12 and 2000
    or length(p_remote_id)>20 or length(p_proof_url)>2048
    or (p_operation<>'bind_remote' and (p_remote_id is not null or p_proof_url is not null)) then
    raise exception 'invalid operator input' using errcode='22023';
  end if;
  if p_operation in ('pause','resume') then
    if p_key !~ '^destination:(telegram|vk):-[1-9][0-9]{0,15}$' then raise exception 'invalid destination' using errcode='22023'; end if;
    v_destination_key := p_key;
  else
    if p_key !~ '^post:news:[A-Za-z0-9_%.-]+:(telegram|vk):-[1-9][0-9]{0,15}$' then raise exception 'invalid news job' using errcode='22023'; end if;
    v_platform := split_part(p_key,':',4); v_destination_id := split_part(p_key,':',5);
    v_destination_key := 'destination:' || v_platform || ':' || v_destination_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('literary-news-runtime:' || v_destination_key,0));
  if v_destination_key <> p_key then perform pg_advisory_xact_lock(hashtextextended('literary-news-runtime:' || p_key,0)); end if;
  select id,metadata into v_id,v_state from public.admin_audit_log
    where entity_type='literary_news_runtime' and entity_id=p_key order by id desc limit 1;
  if v_id is null then return jsonb_build_object('applied',false,'reason','missing_state'); end if;
  if v_id is distinct from p_expected_id then return jsonb_build_object('applied',false,'reason','version_conflict'); end if;
  if p_operation in ('pause','resume') then
    -- Deliberately retain mode, canary scope, history approval and destination rights.
    v_next := v_state || jsonb_build_object('paused',p_operation='pause','pauseReason',case when p_operation='pause' then 'operator_pause' else null end);
  else
    if v_state #>> '{destination,platform}' is distinct from v_platform
      or v_state #>> '{destination,id}' is distinct from v_destination_id then
      return jsonb_build_object('applied',false,'reason','state_changed');
    end if;
    if v_state->>'status' = 'inflight'
      or (v_state->>'leaseUntil' is not null and (v_state->>'leaseUntil')::timestamptz > now()) then
      return jsonb_build_object('applied',false,'reason','active_request');
    end if;
    if p_operation='bind_remote' then
      if coalesce(v_state->>'status','') <> 'ambiguous' or not coalesce(p_verified,false)
        or p_remote_id is null or p_remote_id !~ '^[1-9][0-9]{0,14}$' then
        return jsonb_build_object('applied',false,'reason','state_changed');
      end if;
      if v_state->>'remoteId' is not null and v_state->>'remoteId' <> p_remote_id then
        return jsonb_build_object('applied',false,'reason','remote_mismatch');
      end if;
      v_expected_url := case when v_platform='telegram' and v_destination_id ~ '^-100[0-9]+$'
        then 'https://t.me/c/' || substring(v_destination_id from 5) || '/' || p_remote_id
        when v_platform='vk' then 'https://vk.com/wall' || v_destination_id || '_' || p_remote_id else null end;
      if v_expected_url is null or p_proof_url is distinct from v_expected_url then raise exception 'invalid remote proof' using errcode='22023'; end if;
      -- Verified identity permits an edit to the current version; it is not a delivery receipt.
      v_next := v_state || jsonb_build_object('remoteId',p_remote_id,'remoteUrl',p_proof_url,'status','correction_pending','nextDueAt',now());
    elsif p_operation='not_sent' then
      if coalesce(v_state->>'status','') not in ('ambiguous','blocked') or not coalesce(p_verified,false) then
        return jsonb_build_object('applied',false,'reason','state_changed');
      end if;
      v_next := v_state || jsonb_build_object('status',case when v_state->>'remoteId' is null then 'pending' else 'correction_pending' end,'nextDueAt',now());
    else
      if coalesce(v_state->>'status','') not in ('ambiguous','blocked','pending','correction_pending') then return jsonb_build_object('applied',false,'reason','state_changed'); end if;
      v_next := v_state || jsonb_build_object('status','explicitly_closed');
    end if;
    v_next := v_next || jsonb_build_object('dispatchStartedAt',null,'runnerId',null,'leaseUntil',null,'attemptId',null,'lastError',null);
  end if;
  v_next := v_next || jsonb_build_object('operatorDecision',jsonb_build_object(
    'operation',p_operation,'reason',btrim(p_reason),'actorId',v_actor,'decidedAt',now(),
    'previousVersion',v_id,'verified',p_verified,'proofUrl',p_proof_url,'remoteId',p_remote_id));
  if octet_length(v_next::text)>262144 then raise exception 'operator state too large' using errcode='22023'; end if;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(v_actor,'literary_news.operator.' || p_operation,'literary_news_runtime',p_key,v_next) returning id into v_inserted;
  return jsonb_build_object('applied',true,'id',v_inserted);
end;
$$;
revoke all on function public.operate_literary_news_runtime(text,bigint,text,text,text,text,boolean) from public,anon;
grant execute on function public.operate_literary_news_runtime(text,bigint,text,text,text,text,boolean) to authenticated;
