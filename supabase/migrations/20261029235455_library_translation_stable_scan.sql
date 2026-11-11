-- Stable staff-synchronous library windows on existing jobs/items.
-- No new table/column/role/lease grant; old paid APIs/guards/scalar cursors unchanged.


create function probpera_translation_operations.library_scan_marker_valid(v jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare key text; n bigint; total bigint;
begin
 if not premium_translation_private.exact_object(v,array['version','scanId','windowIndex','predecessorJobId','successorJobId','order','upperId','afterId','lastId','membershipHash','configurationHash','nextPosition','lastWindow','exhausted','activeChild','lastTransition'])
  or v->'version'<>'1'::jsonb or coalesce(v->>'order','')<>'work_id' or octet_length(v::text)>32768 then return false;end if;
 foreach key in array array['scanId','predecessorJobId','successorJobId','upperId','afterId','lastId'] loop
  if v->key<>'null'::jsonb and (jsonb_typeof(v->key)<>'string' or not probpera_translation_operations.retry_uuid((v->>key)::uuid) or v->>key<>((v->>key)::uuid)::text) then return false;end if;
 end loop;
 if v->'scanId'='null'::jsonb or jsonb_typeof(v->'windowIndex')<>'number' or v->>'windowIndex'!~'^[0-9]{1,7}$'
  or (v->>'windowIndex')::bigint>1999999 or jsonb_typeof(v->'nextPosition')<>'number' or v->>'nextPosition'!~'^[0-9]{1,3}$'
  or (v->>'nextPosition')::integer>500 or jsonb_typeof(v->'lastWindow')<>'boolean' or jsonb_typeof(v->'exhausted')<>'boolean'
  or coalesce(v->>'membershipHash','')!~'^[a-f0-9]{64}$' or coalesce(v->>'configurationHash','')!~'^[a-f0-9]{64}$' then return false;end if;
 if v->'activeChild'<>'null'::jsonb then
  if not premium_translation_private.exact_object(v->'activeChild',array['binding','jobId','itemId','operationId','actorId','intentHash','sourceHash','configurationHash','initialProviderCalls','attachedAt'])
   or coalesce(v#>>'{activeChild,binding}','') not in ('attached','observed-blocked') or coalesce(v#>>'{activeChild,initialProviderCalls}','')!~'^[0-4]$'
   or coalesce(v#>>'{activeChild,intentHash}','')!~'^[a-f0-9]{64}$' or coalesce(v#>>'{activeChild,sourceHash}','')!~'^[a-f0-9]{64}$'
   or coalesce(v#>>'{activeChild,configurationHash}','')!~'^[a-f0-9]{64}$' then return false;end if;
  foreach key in array array['jobId','itemId','operationId','actorId'] loop
   if not probpera_translation_operations.retry_uuid((v->'activeChild'->>key)::uuid) then return false;end if;
  end loop;
  perform (v#>>'{activeChild,attachedAt}')::timestamptz;
 end if;
 if v->'lastTransition'<>'null'::jsonb then
  if not premium_translation_private.exact_object(v->'lastTransition',array['id','fingerprint','itemId','kind','operationId'])
   or not probpera_translation_operations.retry_uuid((v#>>'{lastTransition,id}')::uuid)
   or coalesce(v#>>'{lastTransition,fingerprint}','')!~'^[a-f0-9]{64}$'
   or coalesce(v#>>'{lastTransition,kind}','') not in ('created','attached','advanced','zero-call-held','held','successor','exhausted') then return false;end if;
 end if;
 return true;
exception when others then return false;
end; $$;

create function probpera_translation_operations.library_scan_status(p_job_id uuid)
returns text language sql stable security invoker set search_path='' as $$
 select case when count(*)filter(where status='dead_letter')>0 then case when count(*)filter(where status='succeeded')>0 then 'partial' else 'failed' end
  when count(*)filter(where status='conflict')>0 then 'conflict' when count(*)filter(where status='stale')>0 then 'stale'
  when count(*)filter(where status='not-configured')>0 then 'not-configured' when count(*)filter(where status='cancelled')>0 then 'cancelled'
  when count(*)filter(where status='succeeded')>0 then 'completed' else 'skipped' end from public.translation_job_items where job_id=p_job_id;
$$;

create function probpera_translation_operations.library_scan_access(p_job_id uuid,p_lock boolean default false)
returns public.translation_jobs language plpgsql volatile security invoker set search_path='' as $$
declare actor uuid:=premium_translation_private.assert_actor();j public.translation_jobs%rowtype;
begin
 if not probpera_translation_operations.retry_uuid(p_job_id) then raise exception 'Invalid library scan job' using errcode='22023';end if;
 if p_lock then select * into j from public.translation_jobs where id=p_job_id for update;
 else select * into j from public.translation_jobs where id=p_job_id;end if;
 if j.id is null then raise exception 'Library scan job not found' using errcode='P0002';end if;
 if j.kind<>'literary_work' or probpera_translation_operations.library_scan_marker_valid(j.resume_cursor->'libraryScan') is distinct from true then
  raise exception 'Not a stable library scan' using errcode='22023';end if;
 if j.requested_by<>actor then raise exception 'Library scan actor differs' using errcode='42501';end if;
 return j;
end; $$;

create function probpera_translation_operations.library_scan_active(p_work_id text)
returns premium_translation_private.catalog_operation_artifacts language sql stable security invoker set search_path='' as $$
 select a from premium_translation_private.catalog_operation_artifacts a join public.translation_job_items i on i.id=a.item_id
 where a.entity_type='literary_work' and a.entity_id=p_work_id and i.staff_retry is not null and a.final_receipt is null limit 1;
$$;

create function probpera_translation_operations.library_scan_link(a premium_translation_private.catalog_operation_artifacts,binding text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('binding',binding,'jobId',a.job_id,'itemId',a.item_id,'operationId',a.operation_id,'actorId',a.actor_id,
  'intentHash',a.intent_hash,'sourceHash',a.source_hash,'configurationHash',a.configuration_hash,
  'initialProviderCalls',jsonb_array_length(a.calls),'attachedAt',clock_timestamp());
$$;

create function probpera_translation_operations.library_scan_view(j public.translation_jobs,p_replayed boolean default false,p_transition text default 'read')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare m jsonb:=j.resume_cursor->'libraryScan';members jsonb;member public.translation_job_items%rowtype;
 a premium_translation_private.catalog_operation_artifacts%rowtype;link jsonb;child jsonb:='null';reason text;receipt jsonb;cnt integer;fingerprint text;
begin
 select coalesce(jsonb_agg(jsonb_build_object('itemId',i.id,'position',i.position,'workId',i.entity_id,'status',i.status) order by i.position),'[]'::jsonb),count(*),
  probpera_translation_operations.retry_fingerprint(coalesce(jsonb_agg(i.entity_id order by i.position),'[]'::jsonb))
 into members,cnt,fingerprint from public.translation_job_items i where i.job_id=j.id;
 if cnt<>j.total_items or fingerprint<>m->>'membershipHash' or (m->>'nextPosition')::integer>cnt
  or (m->>'windowIndex')::bigint*500+cnt>999999999 then raise exception 'Library scan membership differs' using errcode='40001';end if;
 select * into member from public.translation_job_items where job_id=j.id and position=(m->>'nextPosition')::integer;
 if m->'activeChild'<>'null'::jsonb then
  link:=m->'activeChild';select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=(link->>'operationId')::uuid;
  if a.operation_id is null or a.job_id::text<>link->>'jobId' or a.item_id::text<>link->>'itemId' or a.intent_hash<>link->>'intentHash'
   or a.actor_id::text<>link->>'actorId' or a.source_hash<>link->>'sourceHash' or a.configuration_hash<>link->>'configurationHash'
   or a.entity_type<>'literary_work' or a.entity_id is distinct from member.entity_id then
   raise exception 'Library scan child binding differs' using errcode='40001';end if;
 elsif member.id is not null and p_transition not in ('advanced','zero-call-held') then
  a:=probpera_translation_operations.library_scan_active(member.entity_id);
  if a.operation_id is not null then link:=probpera_translation_operations.library_scan_link(a,'observed-blocked');end if;
 end if;
 if a.operation_id is not null then
  receipt:=premium_translation_private.catalog_operation_view(a,true,false,false);
  child:=jsonb_build_object('binding',link->'binding','initialProviderCalls',link->'initialProviderCalls','receipt',receipt);
  if a.actor_id<>j.requested_by then reason:='child_owned_by_another_actor';
  elsif exists(select 1 from public.translation_jobs x where x.id<>j.id and x.resume_cursor#>>'{libraryScan,activeChild,binding}'='attached'
    and x.resume_cursor#>>'{libraryScan,activeChild,operationId}'=a.operation_id::text) then reason:='child_attached_to_another_scan';
  else reason:='child_pending';end if;
 end if;
 if j.cancel_requested_at is not null or j.status in ('cancelled','cancelling') then reason:='scan_stopped';
 elsif reason is null and (m->>'nextPosition')::integer=j.total_items and m->'exhausted'='false'::jsonb then reason:='window_complete';end if;
 return jsonb_build_object('version',1,'scanId',m->'scanId','jobId',j.id,'jobVersion',j.version::text,'actorId',j.requested_by,'kind','literary_work','provider',j.provider,'status',j.status,
  'configurationHash',m->'configurationHash','windowIndex',m->'windowIndex','predecessorJobId',m->'predecessorJobId','successorJobId',m->'successorJobId',
  'upperId',m->'upperId','afterId',m->'afterId','lastId',m->'lastId','membershipHash',m->'membershipHash','totalItems',j.total_items,'nextPosition',m->'nextPosition',
  'lastWindow',m->'lastWindow','exhausted',m->'exhausted','members',members,'child',child,'replayed',p_replayed,'transition',p_transition,'blockReason',reason);
end; $$;

create function probpera_translation_operations.library_scan_create_window(
 p_scan_id uuid,p_window integer,p_predecessor uuid,p_upper uuid,p_after uuid,p_configuration_hash text,p_provider text,p_actor uuid)
returns public.translation_jobs language plpgsql volatile security invoker set search_path='' as $$
declare ids uuid[];upper_id uuid;last_window boolean;m jsonb;j public.translation_jobs%rowtype;identity uuid;
begin
 with eligible as materialized(select work_id from public.literary_work_translations where locale='ru' and editorial_status in ('reviewed','verified')),
 boundary as(select coalesce(p_upper,max(work_id::text)::uuid) upper_id from eligible)
 select b.upper_id,array(select work_id from eligible where work_id<=b.upper_id and (p_after is null or work_id>p_after) order by work_id limit 501)
 into upper_id,ids from boundary b;
 if p_predecessor is not null and cardinality(ids)=0 then return null;end if;
 last_window:=cardinality(ids)<=500;ids:=ids[1:500];
 if cardinality(ids) is null then ids:='{}'::uuid[];end if;
 if p_window::bigint*500+cardinality(ids)>999999999 then raise exception 'Library scan ordinal bound exceeded' using errcode='22023';end if;
 identity:=case when p_window=0 then p_scan_id else gen_random_uuid() end;
 m:=jsonb_build_object('version',1,'scanId',p_scan_id,'windowIndex',p_window,'predecessorJobId',p_predecessor,'successorJobId',null,'order','work_id',
  'upperId',upper_id,'afterId',p_after,'lastId',ids[cardinality(ids)],'membershipHash',probpera_translation_operations.retry_fingerprint(to_jsonb(ids)),
  'configurationHash',p_configuration_hash,'nextPosition',0,'lastWindow',last_window,'exhausted',cardinality(ids)=0,'activeChild',null,'lastTransition',null);
 insert into public.translation_jobs(id,kind,provider,status,total_items,succeeded_items,failed_items,requested_by,started_at,completed_at,version,resume_cursor)
 values(identity,'literary_work',p_provider,case when cardinality(ids)=0 then 'skipped' else 'reviewing' end,cardinality(ids),0,0,p_actor,clock_timestamp(),
  case when cardinality(ids)=0 then clock_timestamp() else null end,1,jsonb_build_object('libraryScan',m)) returning * into j;
 insert into public.translation_job_items(job_id,position,entity_type,entity_id,status,attempt_count,max_attempts,staff_retry,lease_owner,lease_expires_at)
 select j.id,n-1,'literary_work',v::text,'reviewing',0,1,null,null,null from unnest(ids) with ordinality x(v,n);
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(p_actor,'translation.library_scan.window_created','translation_job',j.id::text,
  jsonb_build_object('scanId',p_scan_id,'windowIndex',p_window,'predecessorJobId',p_predecessor,'totalItems',j.total_items,'membershipHash',m->'membershipHash','upperId',upper_id,'afterId',p_after));
 return j;
end; $$;

create unique index translation_library_scan_window_unique on public.translation_jobs
 ((resume_cursor#>>'{libraryScan,scanId}'),(resume_cursor#>>'{libraryScan,windowIndex}'))
 where kind='literary_work' and resume_cursor?'libraryScan';

create unique index translation_library_scan_successor_unique on public.translation_jobs
 ((resume_cursor#>>'{libraryScan,predecessorJobId}'))
 where kind='literary_work' and resume_cursor#>>'{libraryScan,predecessorJobId}' is not null;

create unique index translation_library_scan_attached_child_unique on public.translation_jobs
 ((resume_cursor#>>'{libraryScan,activeChild,operationId}'))
 where kind='literary_work' and resume_cursor#>>'{libraryScan,activeChild,binding}'='attached';

create function public.begin_library_translation_scan(p_scan_id uuid,p_configuration jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=premium_translation_private.assert_actor();j public.translation_jobs%rowtype;fingerprint text;
begin
 if not probpera_translation_operations.retry_uuid(p_scan_id) or premium_translation_private.catalog_operation_configuration_valid('literary_work',p_configuration,p_configuration->>'provider') is distinct from true then
  raise exception 'Invalid stable library scan intent' using errcode='22023';end if;
 fingerprint:=probpera_translation_operations.retry_fingerprint(p_configuration);
 perform pg_advisory_xact_lock(hashtextextended('library-scan:'||p_scan_id::text,7351));
 select * into j from public.translation_jobs where id=p_scan_id for update;
 if j.id is not null then
  j:=probpera_translation_operations.library_scan_access(p_scan_id,false);
  if j.resume_cursor#>>'{libraryScan,scanId}'<>p_scan_id::text or j.resume_cursor#>>'{libraryScan,windowIndex}'<>'0'
   or j.resume_cursor#>>'{libraryScan,configurationHash}'<>fingerprint or j.provider<>p_configuration->>'provider' then
   raise exception 'Stable library scan intent differs' using errcode='40001';end if;
  return probpera_translation_operations.library_scan_view(j,true,'read');
 end if;
 j:=probpera_translation_operations.library_scan_create_window(p_scan_id,0,null,null,null,fingerprint,p_configuration->>'provider',actor);
 return probpera_translation_operations.library_scan_view(j,false,'created');
end; $$;

create function public.get_library_translation_scan(p_job_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare j public.translation_jobs%rowtype;
begin
 -- Keep the parent position and member prefix coherent across a concurrent
 -- checkpoint. Child/cache and canonical metadata remain plain MVCC reads.
 j:=probpera_translation_operations.library_scan_access(p_job_id,true);
 return probpera_translation_operations.library_scan_view(j,false,'read');
end; $$;

create function public.attach_library_translation_scan_operation(
 p_window_job_id uuid,p_expected_version bigint,p_item_id uuid,p_operation_job_id uuid,p_operation_item_id uuid,p_operation_id uuid,p_intent_hash text,p_transition_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare j public.translation_jobs%rowtype;i public.translation_job_items%rowtype;a premium_translation_private.catalog_operation_artifacts%rowtype;
 m jsonb;fingerprint text;binding text;stamp timestamptz:=clock_timestamp();
begin
 j:=probpera_translation_operations.library_scan_access(p_window_job_id,false);
 if p_expected_version is null or p_expected_version<1 or not probpera_translation_operations.retry_uuid(p_item_id)
  or not probpera_translation_operations.retry_uuid(p_operation_job_id) or not probpera_translation_operations.retry_uuid(p_operation_item_id)
  or not probpera_translation_operations.retry_uuid(p_operation_id) or not probpera_translation_operations.retry_uuid(p_transition_id)
  or coalesce(p_intent_hash,'')!~'^[a-f0-9]{64}$' then raise exception 'Invalid library scan attachment' using errcode='22023';end if;
 select * into i from public.translation_job_items where id=p_item_id and job_id=j.id;
 if i.id is null then raise exception 'Library scan item differs' using errcode='40001';end if;
 -- Before parent lock: BEGIN holds entity->cache, dispatch holds cache->parent.
 perform pg_advisory_xact_lock(hashtextextended('catalog-operation:literary_work:'||i.entity_id,7291));
 j:=probpera_translation_operations.library_scan_access(p_window_job_id,true);m:=j.resume_cursor->'libraryScan';
 if i.position<>(m->>'nextPosition')::integer then raise exception 'Library scan current item changed' using errcode='40001';end if;
 fingerprint:=probpera_translation_operations.retry_fingerprint(jsonb_build_array('attach',j.id,p_item_id,p_operation_job_id,p_operation_item_id,p_operation_id,p_intent_hash,p_expected_version));
 if m#>>'{lastTransition,id}'=p_transition_id::text and m#>>'{lastTransition,fingerprint}'<>fingerprint then raise exception 'Library attachment replay differs' using errcode='40001';end if;
 if m->'activeChild'<>'null'::jsonb then
  if m#>>'{activeChild,operationId}'=p_operation_id::text and m#>>'{activeChild,jobId}'=p_operation_job_id::text
   and m#>>'{activeChild,itemId}'=p_operation_item_id::text and m#>>'{activeChild,intentHash}'=p_intent_hash then
   return probpera_translation_operations.library_scan_view(j,true,case when m#>>'{activeChild,binding}'='attached' then 'attached' else 'held' end);end if;
  return probpera_translation_operations.library_scan_view(j,false,'held');
 end if;
 if j.version<>p_expected_version then raise exception 'Library scan version changed' using errcode='40001';end if;
 if j.cancel_requested_at is not null or j.status in ('cancelled','cancelling') then return probpera_translation_operations.library_scan_view(j,false,'held');end if;
 select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=p_operation_id;
 if a.operation_id is null or a.entity_type<>'literary_work' or a.entity_id<>i.entity_id or a.job_id<>p_operation_job_id or a.item_id<>p_operation_item_id or a.intent_hash<>p_intent_hash then
  raise exception 'Library paid child differs' using errcode='40001';end if;
 if a.final_receipt is not null then raise exception 'Historical terminal child is a free observation' using errcode='40001';end if;
 binding:=case when a.actor_id=j.requested_by and a.provider=j.provider and a.configuration_hash=m->>'configurationHash' and jsonb_array_length(a.calls)=0
  and not exists(select 1 from jsonb_array_elements(a.calls) c where c->'metadata'->'responseReceivedAt'='null'::jsonb)
  and a.confirmed_cursor=jsonb_build_object('libraryCursor',(m->>'windowIndex')::bigint*500+i.position+1)
  and exists(select 1 from public.translation_jobs c where c.id=a.job_id and c.resume_cursor-'catalogOperation'=jsonb_build_object('libraryCursor',(m->>'windowIndex')::bigint*500+i.position))
  and not exists(select 1 from public.translation_jobs x where x.id<>j.id and x.resume_cursor#>>'{libraryScan,activeChild,binding}'='attached'
    and x.resume_cursor#>>'{libraryScan,activeChild,operationId}'=a.operation_id::text) then 'attached' else 'observed-blocked' end;
 m:=m||jsonb_build_object('activeChild',probpera_translation_operations.library_scan_link(a,binding),'lastTransition',
  jsonb_build_object('id',p_transition_id,'fingerprint',fingerprint,'itemId',i.id,'kind','attached','operationId',a.operation_id));
 update public.translation_jobs set resume_cursor=jsonb_build_object('libraryScan',m),version=version+1,updated_at=stamp where id=j.id returning * into j;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(j.requested_by,'translation.library_scan.child_attached','translation_job',j.id::text,
  jsonb_build_object('scanId',m->'scanId','itemId',i.id,'operationId',a.operation_id,'transitionId',p_transition_id,'binding',binding));
 return probpera_translation_operations.library_scan_view(j,false,case when binding='attached' then 'attached' else 'held' end);
end; $$;

create function public.checkpoint_library_translation_scan_item(
 p_window_job_id uuid,p_expected_version bigint,p_item_id uuid,p_transition_id uuid,p_observation jsonb,p_operation_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare j public.translation_jobs%rowtype;i public.translation_job_items%rowtype;prior public.translation_job_attempts%rowtype;
 a premium_translation_private.catalog_operation_artifacts%rowtype;m jsonb;fingerprint text;receipt jsonb;classification text;state text;code text;
 observed_source_hash text;item_status text;child_meta jsonb:='null';stamp timestamptz:=clock_timestamp();next_position integer;
begin
 j:=probpera_translation_operations.library_scan_access(p_window_job_id,false);
 if p_expected_version is null or p_expected_version<1 or not probpera_translation_operations.retry_uuid(p_item_id)
  or not probpera_translation_operations.retry_uuid(p_transition_id) or (p_operation_id is not null and not probpera_translation_operations.retry_uuid(p_operation_id))
  or p_transition_id=p_operation_id or jsonb_typeof(p_observation) is distinct from 'object' then
  raise exception 'Invalid library scan checkpoint' using errcode='22023';end if;
 if p_observation->>'type'='free' then
  if not premium_translation_private.exact_object(p_observation,array['version','type','state','reason','sourceHash']) or p_observation->'version'<>'1'::jsonb
   or coalesce(p_observation->>'state','') not in ('manual','current','review-pending','stale','skipped','failed')
   or (p_observation->'reason'<>'null'::jsonb and coalesce(p_observation->>'reason','') not in ('source_missing','ineligible','existing_candidate','database_read_failed'))
   or (p_observation->'sourceHash'<>'null'::jsonb and coalesce(p_observation->>'sourceHash','')!~'^[a-f0-9]{64}$') or p_operation_id is not null then
   raise exception 'Invalid free library observation' using errcode='22023';end if;
 elsif not premium_translation_private.exact_object(p_observation,array['version','type']) or p_observation->'version'<>'1'::jsonb
   or p_observation->>'type' is distinct from 'child-terminal' or p_operation_id is null then
   raise exception 'Invalid child library observation' using errcode='22023';end if;
 fingerprint:=probpera_translation_operations.retry_fingerprint(jsonb_build_array('checkpoint',j.id,p_item_id,p_expected_version,p_observation,p_operation_id));
 select * into prior from public.translation_job_attempts where staff_retry_operation_id=p_transition_id;
 if prior.id is not null then
  if prior.item_id<>p_item_id or prior.staff_retry_receipt->>'kind'<>'library-scan-observation'
   or prior.staff_retry_receipt->>'windowJobId'<>j.id::text or prior.staff_retry_receipt->>'fingerprint'<>fingerprint then
   raise exception 'Library checkpoint replay differs' using errcode='40001';end if;
  return probpera_translation_operations.library_scan_view(j,true,'advanced');
 end if;
 select * into i from public.translation_job_items where id=p_item_id and job_id=j.id;
 if i.id is null then raise exception 'Library scan item differs' using errcode='40001';end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog-operation:literary_work:'||i.entity_id,7291));
 j:=probpera_translation_operations.library_scan_access(p_window_job_id,true);m:=j.resume_cursor->'libraryScan';
 select * into prior from public.translation_job_attempts where staff_retry_operation_id=p_transition_id;
 if prior.id is not null then
  if prior.item_id<>p_item_id or prior.staff_retry_receipt->>'kind'<>'library-scan-observation' or prior.staff_retry_receipt->>'windowJobId'<>j.id::text
   or prior.staff_retry_receipt->>'fingerprint'<>fingerprint then raise exception 'Library concurrent replay differs' using errcode='40001';end if;
  return probpera_translation_operations.library_scan_view(j,true,'advanced');end if;
 if m#>>'{lastTransition,id}'=p_transition_id::text then
  if m#>>'{lastTransition,fingerprint}'<>fingerprint then raise exception 'Library held checkpoint replay differs' using errcode='40001';end if;
  return probpera_translation_operations.library_scan_view(j,true,case when m#>>'{lastTransition,kind}'='zero-call-held' then 'zero-call-held' else 'held' end);
 end if;
 if j.version<>p_expected_version or i.position<>(m->>'nextPosition')::integer or i.status<>'reviewing' then
  raise exception 'Library scan checkpoint changed' using errcode='40001';end if;
 if m->'activeChild'<>'null'::jsonb then
  select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=(m#>>'{activeChild,operationId}')::uuid;
  if a.operation_id is null then raise exception 'Library attached child missing' using errcode='40001';end if;
  if p_observation->>'type'<>'child-terminal' or a.operation_id is distinct from p_operation_id or a.final_receipt is null then
   return probpera_translation_operations.library_scan_view(j,false,'held');end if;
  -- FINISH/zero-call cleanup occurs outside this parent transaction. This is
  -- a plain read of its immutable proof, never parent -> child cache locking.
  if jsonb_array_length(a.calls)=0 then
   m:=m||jsonb_build_object('activeChild',null,'lastTransition',jsonb_build_object('id',p_transition_id,'fingerprint',fingerprint,'itemId',i.id,'kind','zero-call-held','operationId',a.operation_id));
   update public.translation_jobs set resume_cursor=jsonb_build_object('libraryScan',m),version=version+1,updated_at=stamp where id=j.id returning * into j;
   insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(j.requested_by,'translation.library_scan.zero_call_held','translation_job',j.id::text,
    jsonb_build_object('scanId',m->'scanId','itemId',i.id,'operationId',a.operation_id,'transitionId',p_transition_id));
   return probpera_translation_operations.library_scan_view(j,false,'zero-call-held');
  end if;
  state:=a.final_receipt#>>'{result,state}';code:=a.final_receipt#>>'{result,errorCode}';observed_source_hash:=a.source_hash;
  classification:=case when (m#>>'{activeChild,initialProviderCalls}')::integer>0 or m#>>'{activeChild,binding}'='observed-blocked' then 'existing-resolved' else 'child-completed' end;
  child_meta:=jsonb_build_object('jobId',a.job_id,'itemId',a.item_id,'operationId',a.operation_id,'intentHash',a.intent_hash,'state',state,
   'errorCode',code,'persistence',a.final_receipt#>'{result,persistence}','candidateHash',a.final_receipt#>'{result,candidateHash}',
   'draftId',a.final_receipt#>'{result,draftId}','draftVersion',a.final_receipt#>'{result,draftVersion}');
 else
  a:=probpera_translation_operations.library_scan_active(i.entity_id);
  if a.operation_id is not null then
   m:=m||jsonb_build_object('activeChild',probpera_translation_operations.library_scan_link(a,'observed-blocked'),'lastTransition',
    jsonb_build_object('id',p_transition_id,'fingerprint',fingerprint,'itemId',i.id,'kind','held','operationId',a.operation_id));
   update public.translation_jobs set resume_cursor=jsonb_build_object('libraryScan',m),version=version+1,updated_at=stamp where id=j.id returning * into j;
   return probpera_translation_operations.library_scan_view(j,false,'held');
  end if;
  if p_observation->>'type'='child-terminal' then
   select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=p_operation_id;
   if a.operation_id is null or a.entity_type<>'literary_work' or a.entity_id<>i.entity_id or a.final_receipt is null then
    raise exception 'Historical library result binding differs' using errcode='40001';end if;
   if jsonb_array_length(a.calls)=0 then
    m:=m||jsonb_build_object('lastTransition',jsonb_build_object('id',p_transition_id,'fingerprint',fingerprint,'itemId',i.id,'kind','zero-call-held','operationId',a.operation_id));
    update public.translation_jobs set resume_cursor=jsonb_build_object('libraryScan',m),version=version+1,updated_at=stamp where id=j.id returning * into j;
    return probpera_translation_operations.library_scan_view(j,false,'zero-call-held');end if;
   state:=a.final_receipt#>>'{result,state}';code:=a.final_receipt#>>'{result,errorCode}';observed_source_hash:=a.source_hash;classification:='existing-resolved';
   child_meta:=jsonb_build_object('jobId',a.job_id,'itemId',a.item_id,'operationId',a.operation_id,'intentHash',a.intent_hash,'state',state,
    'errorCode',code,'persistence',a.final_receipt#>'{result,persistence}','candidateHash',a.final_receipt#>'{result,candidateHash}',
    'draftId',a.final_receipt#>'{result,draftId}','draftVersion',a.final_receipt#>'{result,draftVersion}');
  else
   if j.cancel_requested_at is not null or j.status in ('cancelled','cancelling') then return probpera_translation_operations.library_scan_view(j,false,'held');end if;
   if p_observation->>'reason'='source_missing' and exists(select 1 from public.literary_works where id=i.entity_id::uuid)
    and exists(select 1 from public.literary_work_translations where work_id=i.entity_id::uuid and locale='ru') then
    raise exception 'Library source still exists' using errcode='40001';end if;
   state:=p_observation->>'state';observed_source_hash:=p_observation->>'sourceHash';classification:=coalesce(p_observation->>'reason',state);
   code:=case when state='failed' then 'database_read_failed' else null end;
  end if;
 end if;
 item_status:=case state when 'translated' then 'succeeded' when 'failed' then 'dead_letter' when 'conflict' then 'conflict'
  when 'stale' then 'stale' when 'cancelled' then 'cancelled' when 'not-configured' then 'not-configured' else 'skipped' end;
 receipt:=jsonb_build_object('version',1,'kind','library-scan-observation','scanId',m->'scanId','windowJobId',j.id,'itemId',i.id,'position',i.position,'workId',i.entity_id,
  'transitionId',p_transition_id,'fingerprint',fingerprint,'classification',classification,'state',state,'errorCode',code,'sourceHash',observed_source_hash,'providerCalls',0,'child',child_meta);
 insert into public.translation_job_attempts(item_id,attempt_number,outcome,provider,model,provider_request_id,error_code,input_tokens,output_tokens,duration_ms,staff_retry_operation_id,staff_retry_receipt)
 values(i.id,1,'skipped',j.provider,null,null,null,null,null,null,p_transition_id,receipt);
 update public.translation_job_items set status=item_status,attempt_count=1,last_error_code=code,source_hash=observed_source_hash,updated_at=stamp where id=i.id;
 next_position:=(m->>'nextPosition')::integer+1;
 m:=m||jsonb_build_object('nextPosition',next_position,'activeChild',null,'exhausted',next_position=j.total_items and (m->>'lastWindow')::boolean,
  'lastTransition',jsonb_build_object('id',p_transition_id,'fingerprint',fingerprint,'itemId',i.id,'kind','advanced','operationId',p_operation_id));
 update public.translation_jobs set resume_cursor=jsonb_build_object('libraryScan',m),version=version+1,updated_at=stamp,
  status=case when cancel_requested_at is not null then 'cancelled' when next_position=total_items then probpera_translation_operations.library_scan_status(id) else 'reviewing' end,
  succeeded_items=(select count(*) from public.translation_job_items where job_id=j.id and status='succeeded'),
  failed_items=(select count(*) from public.translation_job_items where job_id=j.id and status='dead_letter'),
  completed_at=case when next_position=total_items then stamp else null end where id=j.id returning * into j;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(j.requested_by,'translation.library_scan.observed','translation_job',j.id::text,
  jsonb_build_object('scanId',m->'scanId','itemId',i.id,'position',i.position,'transitionId',p_transition_id,'classification',classification,'childOperationId',p_operation_id,'providerCalls',0));
 return probpera_translation_operations.library_scan_view(j,false,'advanced');
end; $$;

create function public.continue_library_translation_scan(p_window_job_id uuid,p_expected_version bigint,p_configuration jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare j public.translation_jobs%rowtype;successor public.translation_jobs%rowtype;m jsonb;fingerprint text;
begin
 j:=probpera_translation_operations.library_scan_access(p_window_job_id,true);m:=j.resume_cursor->'libraryScan';
 if p_expected_version is null or p_expected_version<1 or premium_translation_private.catalog_operation_configuration_valid('literary_work',p_configuration,p_configuration->>'provider') is distinct from true then
  raise exception 'Invalid library continuation configuration' using errcode='22023';end if;
 if probpera_translation_operations.retry_fingerprint(p_configuration)<>m->>'configurationHash' or p_configuration->>'provider'<>j.provider then
  raise exception 'Library continuation configuration changed' using errcode='40001';end if;
 if j.cancel_requested_at is not null or j.status in ('cancelled','cancelling') then return probpera_translation_operations.library_scan_view(j,false,'held');end if;
 if m->'successorJobId'<>'null'::jsonb then
  successor:=probpera_translation_operations.library_scan_access((m->>'successorJobId')::uuid,false);
  return probpera_translation_operations.library_scan_view(successor,true,'successor');end if;
 -- Exhaustion is irreversible for this bounded intent. A lost empty-tail ACK
 -- must replay the accepted state, not reject the caller's prior version.
 if m->'exhausted'='true'::jsonb then return probpera_translation_operations.library_scan_view(j,true,'exhausted');end if;
 if j.version<>p_expected_version then raise exception 'Library continuation version changed' using errcode='40001';end if;
 if m->'activeChild'<>'null'::jsonb or (m->>'nextPosition')::integer<j.total_items then return probpera_translation_operations.library_scan_view(j,false,'read');end if;
 successor:=probpera_translation_operations.library_scan_create_window((m->>'scanId')::uuid,(m->>'windowIndex')::integer+1,j.id,(m->>'upperId')::uuid,(m->>'lastId')::uuid,m->>'configurationHash',j.provider,j.requested_by);
 if successor.id is null then
  m:=m||jsonb_build_object('lastWindow',true,'exhausted',true);
  update public.translation_jobs set resume_cursor=jsonb_build_object('libraryScan',m),version=version+1,updated_at=clock_timestamp() where id=j.id returning * into j;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(j.requested_by,'translation.library_scan.exhausted','translation_job',j.id::text,
   jsonb_build_object('scanId',m->'scanId','windowIndex',m->'windowIndex','lastId',m->'lastId','upperId',m->'upperId','jobVersion',j.version::text));
  return probpera_translation_operations.library_scan_view(j,false,'exhausted');end if;
 m:=m||jsonb_build_object('successorJobId',successor.id);
 update public.translation_jobs set resume_cursor=jsonb_build_object('libraryScan',m),version=version+1,updated_at=clock_timestamp() where id=j.id;
 return probpera_translation_operations.library_scan_view(successor,false,'successor');
end; $$;

create function probpera_translation_operations.library_scan_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare j public.translation_jobs%rowtype;p public.translation_jobs%rowtype;i public.translation_job_items%rowtype;
 a premium_translation_private.catalog_operation_artifacts%rowtype;m jsonb;om jsonb;r jsonb;old_position integer;new_position integer;
begin
 if tg_table_name='translation_jobs' then
  m:=case when tg_op='DELETE' then old.resume_cursor->'libraryScan' else new.resume_cursor->'libraryScan' end;
  om:=case when tg_op='INSERT' then null else old.resume_cursor->'libraryScan' end;
  if m is null and om is null then return case when tg_op='DELETE' then old else new end;end if;
  if tg_op='DELETE' then raise exception 'Stable scan history cannot be deleted' using errcode='42501';end if;
  if new.kind<>'literary_work' or new.resume_cursor-'libraryScan'<>'{}'::jsonb or probpera_translation_operations.library_scan_marker_valid(m) is distinct from true
   or (m->>'nextPosition')::integer>new.total_items or (m->>'windowIndex')::bigint*500+new.total_items>999999999
   or new.status not in ('reviewing','completed','partial','failed','conflict','stale','skipped','not-configured','cancelling','cancelled') then
   raise exception 'Invalid stable library scan row' using errcode='42501';end if;
  if tg_op='INSERT' then
   if (m->>'windowIndex')::integer=0 then
    if new.id::text<>m->>'scanId' or m->'predecessorJobId'<>'null'::jsonb or m->'afterId'<>'null'::jsonb then raise exception 'Invalid first library window' using errcode='42501';end if;
   else
    select * into p from public.translation_jobs where id=(m->>'predecessorJobId')::uuid;
    if p.id is null or p.kind<>'literary_work' or p.requested_by<>new.requested_by or p.provider<>new.provider
     or p.resume_cursor#>>'{libraryScan,scanId}'<>m->>'scanId'
     or (p.resume_cursor#>>'{libraryScan,windowIndex}')::integer+1<>(m->>'windowIndex')::integer
     or (p.resume_cursor#>>'{libraryScan,nextPosition}')::integer<>p.total_items or p.resume_cursor#>'{libraryScan,activeChild}'<>'null'::jsonb
     or p.resume_cursor#>'{libraryScan,upperId}' is distinct from m->'upperId' or p.resume_cursor#>'{libraryScan,lastId}' is distinct from m->'afterId'
     or p.resume_cursor#>'{libraryScan,configurationHash}' is distinct from m->'configurationHash' then
     raise exception 'Invalid library successor binding' using errcode='42501';end if;
   end if;
   return new;
  end if;
  if om is null or (to_jsonb(new)-array['resume_cursor','version','updated_at','status','succeeded_items','failed_items','completed_at','cancel_requested_at'])<>
    (to_jsonb(old)-array['resume_cursor','version','updated_at','status','succeeded_items','failed_items','completed_at','cancel_requested_at'])
   or (m-array['nextPosition','lastWindow','exhausted','activeChild','lastTransition','successorJobId'])<>
      (om-array['nextPosition','lastWindow','exhausted','activeChild','lastTransition','successorJobId'])
   or new.version<>old.version+1 or (old.cancel_requested_at is not null and new.cancel_requested_at is distinct from old.cancel_requested_at)
   or (om->'exhausted'='true'::jsonb and m->'exhausted'<>'true'::jsonb) then
   raise exception 'Stable library identity/history differs' using errcode='42501';end if;
  old_position:=(om->>'nextPosition')::integer;new_position:=(m->>'nextPosition')::integer;
  if new_position<old_position or new_position>old_position+1 then raise exception 'Invalid library cursor jump' using errcode='42501';end if;
  select * into i from public.translation_job_items where job_id=old.id and position=old_position;
  if om->'activeChild'<>'null'::jsonb then
   select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=(om#>>'{activeChild,operationId}')::uuid;
   if a.operation_id is null then raise exception 'Library child proof missing' using errcode='42501';end if;
   if m->'activeChild' is distinct from om->'activeChild' then
    if m->'activeChild'<>'null'::jsonb or a.final_receipt is null
     or (new_position=old_position and (jsonb_array_length(a.calls)<>0 or m#>>'{lastTransition,kind}'<>'zero-call-held'))
     or (new_position>old_position and jsonb_array_length(a.calls)=0) then
     raise exception 'Unknown or zero-call library child cannot advance' using errcode='42501';end if;
   end if;
  elsif m->'activeChild'<>'null'::jsonb then
   select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=(m#>>'{activeChild,operationId}')::uuid;
   if a.operation_id is null or a.final_receipt is not null or a.entity_type<>'literary_work' or a.entity_id is distinct from i.entity_id
    or a.job_id::text<>m#>>'{activeChild,jobId}' or a.item_id::text<>m#>>'{activeChild,itemId}'
    or a.actor_id::text<>m#>>'{activeChild,actorId}' or a.intent_hash<>m#>>'{activeChild,intentHash}'
    or a.source_hash<>m#>>'{activeChild,sourceHash}' or a.configuration_hash<>m#>>'{activeChild,configurationHash}'
    or (m#>>'{activeChild,initialProviderCalls}')::integer>jsonb_array_length(a.calls)
    or (m#>>'{activeChild,binding}'='attached' and (a.actor_id<>new.requested_by or a.provider<>new.provider or a.configuration_hash<>m->>'configurationHash'
      or jsonb_array_length(a.calls)<>0 or (m#>>'{activeChild,initialProviderCalls}')::integer<>0
      or a.confirmed_cursor<>jsonb_build_object('libraryCursor',(m->>'windowIndex')::bigint*500+i.position+1)
      or not exists(select 1 from public.translation_jobs c where c.id=a.job_id and c.resume_cursor-'catalogOperation'=jsonb_build_object('libraryCursor',(m->>'windowIndex')::bigint*500+i.position)))) then
    raise exception 'Invalid library child attachment proof' using errcode='42501';end if;
  end if;
  if new_position>old_position then
   select staff_retry_receipt into r from public.translation_job_attempts where item_id=i.id and attempt_number=1;
   if i.id is null or i.status='reviewing' or r->>'kind' is distinct from 'library-scan-observation' or r->>'windowJobId'<>old.id::text
    or r->>'transitionId' is distinct from m#>>'{lastTransition,id}' or r->>'fingerprint' is distinct from m#>>'{lastTransition,fingerprint}'
    or m->'activeChild'<>'null'::jsonb then raise exception 'Library advancement lacks logical observation' using errcode='42501';end if;
   if om->'activeChild'='null'::jsonb then
    a:=probpera_translation_operations.library_scan_active(i.entity_id);
    if a.operation_id is not null then raise exception 'Active library child cannot be skipped' using errcode='42501';end if;
   end if;
  end if;
  if m->'successorJobId' is distinct from om->'successorJobId' then
   if om->'successorJobId'<>'null'::jsonb or new_position<>new.total_items or m->'activeChild'<>'null'::jsonb then raise exception 'Invalid library successor rewrite' using errcode='42501';end if;
   select * into p from public.translation_jobs where id=(m->>'successorJobId')::uuid;
   if p.id is null or p.resume_cursor#>>'{libraryScan,predecessorJobId}'<>new.id::text or p.resume_cursor#>'{libraryScan,scanId}'<>m->'scanId' then
    raise exception 'Library successor missing' using errcode='42501';end if;
  end if;
  return new;
 elsif tg_table_name='translation_job_items' then
  select * into j from public.translation_jobs where id=case when tg_op='INSERT' then new.job_id else old.job_id end;
  if not(j.resume_cursor?'libraryScan') then return case when tg_op='DELETE' then old else new end;end if;
  if tg_op='DELETE' then raise exception 'Library scan member history cannot be deleted' using errcode='42501';end if;
  if new.entity_type<>'literary_work' or new.entity_id<>new.entity_id::uuid::text or new.position>=j.total_items or new.staff_retry is not null
   or new.lease_owner is not null or new.lease_expires_at is not null or new.status in ('queued','retry_wait','leased') or new.max_attempts<>1 then
   raise exception 'Library scan member is not a lease/retry item' using errcode='42501';end if;
  if tg_op='INSERT' then
   if new.status<>'reviewing' or new.attempt_count<>0 then raise exception 'Library member must start pending' using errcode='42501';end if;
  elsif to_jsonb(new) is distinct from to_jsonb(old) then
   if old.status<>'reviewing' or new.status='reviewing' or new.attempt_count<>1
    or (to_jsonb(new)-array['status','attempt_count','source_hash','last_error_code','updated_at'])<>(to_jsonb(old)-array['status','attempt_count','source_hash','last_error_code','updated_at'])
    or not exists(select 1 from public.translation_job_attempts t where t.item_id=new.id and t.attempt_number=1 and t.staff_retry_receipt->>'kind'='library-scan-observation'
      and t.staff_retry_receipt->>'windowJobId'=new.job_id::text) then
    raise exception 'Library member outcome/history is immutable' using errcode='42501';end if;
  end if;
  return new;
 else
  select * into i from public.translation_job_items where id=case when tg_op='INSERT' then new.item_id else old.item_id end;
  select * into j from public.translation_jobs where id=i.job_id;
  if not(j.resume_cursor?'libraryScan') then return case when tg_op='DELETE' then old else new end;end if;
  if tg_op<>'INSERT' then raise exception 'Library observation history is immutable' using errcode='42501';end if;
  r:=new.staff_retry_receipt;
  if not premium_translation_private.exact_object(r,array['version','kind','scanId','windowJobId','itemId','position','workId','transitionId','fingerprint','classification','state','errorCode','sourceHash','providerCalls','child'])
   or r->'version'<>'1'::jsonb or r->>'kind'<>'library-scan-observation' or r->'providerCalls'<>'0'::jsonb or r->>'scanId'<>j.resume_cursor#>>'{libraryScan,scanId}'
   or r->>'windowJobId'<>j.id::text or r->>'itemId'<>i.id::text or r->>'workId'<>i.entity_id or (r->>'position')::integer<>i.position
   or r->>'transitionId' is distinct from new.staff_retry_operation_id::text or new.attempt_number<>1 or new.outcome<>'skipped' or new.provider<>j.provider
   or new.model is not null or new.provider_request_id is not null or new.error_code is not null or new.input_tokens is not null or new.output_tokens is not null or new.duration_ms is not null
   or i.status<>'reviewing' or i.position<>(j.resume_cursor#>>'{libraryScan,nextPosition}')::integer then
   raise exception 'Invalid zero-provider library observation' using errcode='42501';end if;
  return new;
 end if;
end; $$;

create function probpera_translation_operations.library_scan_dispatch_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare j public.translation_jobs%rowtype;i public.translation_job_items%rowtype;m jsonb;
begin
 -- Responses/FINISH retain accepted output even after parent cancellation.
 if new.entity_type<>'literary_work' or jsonb_array_length(new.calls)<=jsonb_array_length(old.calls) then return new;end if;
 select * into j from public.translation_jobs where resume_cursor#>>'{libraryScan,activeChild,binding}'='attached'
  and resume_cursor#>>'{libraryScan,activeChild,operationId}'=new.operation_id::text for update;
 if j.id is null then return new;end if;
 m:=j.resume_cursor->'libraryScan';
 select * into i from public.translation_job_items where job_id=j.id and position=(m->>'nextPosition')::integer;
 if j.cancel_requested_at is not null or j.status in ('cancelled','cancelling') or j.status<>'reviewing' or i.id is null or i.status<>'reviewing'
  or i.entity_id<>new.entity_id or new.actor_id<>j.requested_by or new.provider<>j.provider or new.configuration_hash<>m->>'configurationHash'
  or m#>>'{activeChild,jobId}'<>new.job_id::text or m#>>'{activeChild,itemId}'<>new.item_id::text or m#>>'{activeChild,intentHash}'<>new.intent_hash then
  raise exception 'Attached library scan stopped before dispatch' using errcode='40001';end if;
 return new;
end; $$;

create trigger translation_jobs_library_scan_integrity before insert or update or delete on public.translation_jobs
 for each row execute function probpera_translation_operations.library_scan_guard();

create trigger translation_items_library_scan_integrity before insert or update or delete on public.translation_job_items
 for each row execute function probpera_translation_operations.library_scan_guard();

create trigger translation_attempts_library_scan_integrity before insert or update or delete on public.translation_job_attempts
 for each row execute function probpera_translation_operations.library_scan_guard();

create trigger catalog_operation_library_scan_dispatch before update on premium_translation_private.catalog_operation_artifacts
 for each row execute function probpera_translation_operations.library_scan_dispatch_guard();

revoke all on function probpera_translation_operations.library_scan_marker_valid(jsonb),
 probpera_translation_operations.library_scan_status(uuid),probpera_translation_operations.library_scan_access(uuid,boolean),
 probpera_translation_operations.library_scan_active(text),probpera_translation_operations.library_scan_link(premium_translation_private.catalog_operation_artifacts,text),
 probpera_translation_operations.library_scan_view(public.translation_jobs,boolean,text),
 probpera_translation_operations.library_scan_create_window(uuid,integer,uuid,uuid,uuid,text,text,uuid),
 probpera_translation_operations.library_scan_guard(),probpera_translation_operations.library_scan_dispatch_guard()
 from public,anon,authenticated,service_role;

revoke all on function public.begin_library_translation_scan(uuid,jsonb),public.get_library_translation_scan(uuid),
 public.attach_library_translation_scan_operation(uuid,bigint,uuid,uuid,uuid,uuid,text,uuid),
 public.checkpoint_library_translation_scan_item(uuid,bigint,uuid,uuid,jsonb,uuid),
 public.continue_library_translation_scan(uuid,bigint,jsonb) from public,anon,authenticated,service_role;

grant execute on function public.begin_library_translation_scan(uuid,jsonb),public.get_library_translation_scan(uuid),
 public.attach_library_translation_scan_operation(uuid,bigint,uuid,uuid,uuid,uuid,text,uuid),
 public.checkpoint_library_translation_scan_item(uuid,bigint,uuid,uuid,jsonb,uuid),
 public.continue_library_translation_scan(uuid,bigint,jsonb) to authenticated;
