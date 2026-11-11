-- Stable finite country/writer scan membership in the existing journal.
-- Eager bounded windows and five metadata-only staff RPCs; old paid APIs remain.
-- Deferred job-insert chain proof has at most20 events, never one per item.
begin;

create function probpera_translation_operations.profile_scan_configuration_valid(kind text,v jsonb)
returns boolean language sql immutable security invoker set search_path='' as $$
 select case kind when 'writer' then premium_translation_private.writer_operation_configuration_valid(v,v->>'provider')
  when 'country' then premium_translation_private.catalog_operation_configuration_valid('country',v,v->>'provider') else false end;
$$;

create function probpera_translation_operations.profile_scan_record(kind text,entity text,catalog_hash text)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
begin
 if coalesce(catalog_hash,'')!~'^[a-f0-9]{64}$' then raise exception 'Invalid profile catalog hash' using errcode='22023';end if;
 if kind='writer' then
  perform premium_translation_private.assert_identity('writer_biography',entity);
  if exists(select 1 from unnest(string_to_array(split_part(entity,':',2),null::text)) glyph
   where ascii(glyph) between 0 and 31 or ascii(glyph) between 127 and 159 or premium_translation_private.trim_text(glyph)='') then
   raise exception 'Invalid profile writer identity' using errcode='22023';end if;
  return jsonb_build_object('countryId',split_part(entity,':',1),'writerId',split_part(entity,':',2),'catalogSourceHash',catalog_hash);
 elsif kind='country' then
  -- Existing country text is preserved; JavaScript length is UTF-16, not SQL code points.
  perform premium_translation_private.assert_identity('country',entity);
  if premium_translation_private.site_copy_utf16_length(entity) not between 1 and 120
   or entity is distinct from premium_translation_private.trim_text(entity)
   or exists(select 1 from unnest(string_to_array(entity,null::text)) glyph where ascii(glyph) between 0 and 31 or ascii(glyph) between 127 and 159) then
   raise exception 'Invalid profile country identity' using errcode='22023';end if;
  return jsonb_build_object('countryId',entity,'catalogSourceHash',catalog_hash);
 end if;
 raise exception 'Invalid profile kind' using errcode='22023';
end; $$;

create function probpera_translation_operations.profile_scan_manifest_valid(kind text,v jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare r jsonb;identity text;
begin
 if kind is null or kind not in ('writer','country') or jsonb_typeof(v) is distinct from 'array'
  or jsonb_array_length(v)>10000 or octet_length(v::text)>4194304 then return false;end if;
 for r in select value from jsonb_array_elements(v) loop
  if not premium_translation_private.exact_object(r,case when kind='writer' then array['countryId','writerId','catalogSourceHash'] else array['countryId','catalogSourceHash'] end)
   or jsonb_typeof(r->'countryId') is distinct from 'string' or jsonb_typeof(r->'catalogSourceHash') is distinct from 'string'
   or (kind='writer' and jsonb_typeof(r->'writerId') is distinct from 'string') then return false;end if;
  identity:=case when kind='writer' then (r->>'countryId')||':'||(r->>'writerId') else r->>'countryId' end;
  if probpera_translation_operations.profile_scan_record(kind,identity,r->>'catalogSourceHash') is distinct from r then return false;end if;
 end loop;
 return (select count(distinct case when kind='writer' then (value->>'countryId')||':'||(value->>'writerId') else value->>'countryId' end)=jsonb_array_length(v)
  from jsonb_array_elements(v));
exception when others then return false;
end; $$;

create function probpera_translation_operations.profile_scan_marker_valid(v jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text;n integer;windows integer;idx integer;expected integer;h jsonb;
begin
 if not premium_translation_private.exact_object(v,array['version','scanId','windowIndex','windowCount','totalMembership','predecessorJobId','successorJobId',
  'fullManifestHash','membershipHash','configurationHash','catalogSourceHashes','nextPosition','lastWindow','exhausted','activeChild','lastTransition'])
  or v->'version'<>'1'::jsonb or octet_length(v::text)>65536 then return false;end if;
 foreach k in array array['scanId','predecessorJobId','successorJobId'] loop
  if v->k<>'null'::jsonb and (jsonb_typeof(v->k)<>'string' or not probpera_translation_operations.retry_uuid((v->>k)::uuid)
   or v->>k<>((v->>k)::uuid)::text) then return false;end if;
 end loop;
 if v->'scanId'='null'::jsonb then return false;end if;
 foreach k in array array['windowIndex','windowCount','totalMembership','nextPosition'] loop
  if jsonb_typeof(v->k)<>'number' or coalesce(v->>k,'')!~'^[0-9]{1,5}$' then return false;end if;
 end loop;
 n:=(v->>'totalMembership')::integer;windows:=(v->>'windowCount')::integer;idx:=(v->>'windowIndex')::integer;
 if n>10000 or windows<>greatest(1,(n+499)/500) or windows>20 or idx>=windows then return false;end if;
 expected:=least(500,greatest(0,n-idx*500));
 if (v->>'nextPosition')::integer>expected or jsonb_typeof(v->'lastWindow')<>'boolean' or jsonb_typeof(v->'exhausted')<>'boolean'
  or v->'lastWindow' is distinct from to_jsonb(idx=windows-1)
  or (v->'exhausted'='true'::jsonb and (idx<>windows-1 or (v->>'nextPosition')::integer<>expected or v->'activeChild'<>'null'::jsonb))
  or (idx=0) is distinct from (v->'predecessorJobId'='null'::jsonb)
  or (idx=windows-1) is distinct from (v->'successorJobId'='null'::jsonb) then return false;end if;
 foreach k in array array['fullManifestHash','membershipHash','configurationHash'] loop
  if jsonb_typeof(v->k)<>'string' or coalesce(v->>k,'')!~'^[a-f0-9]{64}$' then return false;end if;
 end loop;
 if jsonb_typeof(v->'catalogSourceHashes')<>'array' or jsonb_array_length(v->'catalogSourceHashes')<>expected then return false;end if;
 for h in select value from jsonb_array_elements(v->'catalogSourceHashes') loop
  if jsonb_typeof(h)<>'string' or h#>>'{}'!~'^[a-f0-9]{64}$' then return false;end if;
 end loop;
 if v->'activeChild'<>'null'::jsonb then
  if not premium_translation_private.exact_object(v->'activeChild',array['binding','jobId','itemId','operationId','actorId','intentHash','sourceHash','configurationHash','initialProviderCalls','attachedAt'])
   or coalesce(v#>>'{activeChild,binding}','') not in ('attached','observed-blocked') or coalesce(v#>>'{activeChild,initialProviderCalls}','')!~'^[0-4]$'
   or coalesce(v#>>'{activeChild,intentHash}','')!~'^[a-f0-9]{64}$' or coalesce(v#>>'{activeChild,sourceHash}','')!~'^[a-f0-9]{64}$'
   or coalesce(v#>>'{activeChild,configurationHash}','')!~'^[a-f0-9]{64}$' then return false;end if;
  foreach k in array array['jobId','itemId','operationId','actorId'] loop
   if not probpera_translation_operations.retry_uuid((v->'activeChild'->>k)::uuid) then return false;end if;
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

-- A CLOSED metadata projection, not a replacement paid receipt or private-body reader.
-- The old writer/country views and final receipts remain the sole child DTOs.
create function probpera_translation_operations.profile_scan_operation(p_kind text,p_entity_id text,p_operation_id uuid default null,p_active_only boolean default false)
returns table(operation_id uuid,job_id uuid,item_id uuid,actor_id uuid,entity_type text,entity_id text,provider text,source_hash text,intent_hash text,
 configuration_hash text,catalog_source_hash text,confirmed_cursor jsonb,current_cursor jsonb,provider_calls integer,has_pending boolean,final_receipt jsonb,receipt jsonb)
language plpgsql stable security invoker set search_path='' as $$
begin
 if p_kind='writer' then
  return query select a.operation_id,a.job_id,a.item_id,a.actor_id,'writer'::text,a.entity_id,a.provider,a.source_hash,a.intent_hash,a.configuration_hash,
   a.source_revision->>'catalogSourceHash',a.confirmed_cursor,j.resume_cursor-'writerOperation',jsonb_array_length(a.calls),
   exists(select 1 from jsonb_array_elements(a.calls) c where c#>'{metadata,responseReceivedAt}'='null'::jsonb),a.final_receipt,
   premium_translation_private.writer_operation_view(a,true,false,false)
  from premium_translation_private.writer_operation_artifacts a join public.translation_job_items i on i.id=a.item_id join public.translation_jobs j on j.id=a.job_id
  where a.entity_id=p_entity_id and (p_operation_id is null or a.operation_id=p_operation_id)
   and (not p_active_only or (i.staff_retry is not null and a.final_receipt is null))
  order by (i.staff_retry is not null) desc,a.created_at desc,a.operation_id desc limit 1;
 elsif p_kind='country' then
  return query select a.operation_id,a.job_id,a.item_id,a.actor_id,'country'::text,a.entity_id,a.provider,a.source_hash,a.intent_hash,a.configuration_hash,
   a.source_revision->>'catalogSourceHash',a.confirmed_cursor,j.resume_cursor-'catalogOperation',jsonb_array_length(a.calls),
   exists(select 1 from jsonb_array_elements(a.calls) c where c#>'{metadata,responseReceivedAt}'='null'::jsonb),a.final_receipt,
   premium_translation_private.catalog_operation_view(a,true,false,false)
  from premium_translation_private.catalog_operation_artifacts a join public.translation_job_items i on i.id=a.item_id join public.translation_jobs j on j.id=a.job_id
  where a.entity_type='country' and a.entity_id=p_entity_id and (p_operation_id is null or a.operation_id=p_operation_id)
   and (not p_active_only or (i.staff_retry is not null and a.final_receipt is null))
  order by (i.staff_retry is not null) desc,a.created_at desc,a.operation_id desc limit 1;
 else raise exception 'Invalid profile operation kind' using errcode='22023';end if;
end; $$;

create function probpera_translation_operations.profile_scan_entity_lock(kind text,entity text)
returns void language plpgsql volatile security invoker set search_path='' as $$
begin
 if kind='writer' then perform pg_advisory_xact_lock(hashtextextended('writer-operation:'||entity,7191));
 elsif kind='country' then perform pg_advisory_xact_lock(hashtextextended('catalog-operation:country:'||entity,7291));
 else raise exception 'Invalid profile lock kind' using errcode='22023';end if;
end; $$;

create function probpera_translation_operations.profile_scan_link(a jsonb,binding text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('binding',binding,'jobId',a->'job_id','itemId',a->'item_id','operationId',a->'operation_id','actorId',a->'actor_id',
  'intentHash',a->'intent_hash','sourceHash',a->'source_hash','configurationHash',a->'configuration_hash','initialProviderCalls',a->'provider_calls','attachedAt',clock_timestamp());
$$;

create function probpera_translation_operations.profile_scan_access(p_job_id uuid,p_lock boolean default false)
returns public.translation_jobs language plpgsql volatile security invoker set search_path='' as $$
declare actor uuid:=premium_translation_private.assert_actor();j public.translation_jobs%rowtype;
begin
 if not probpera_translation_operations.retry_uuid(p_job_id) then raise exception 'Invalid profile scan job' using errcode='22023';end if;
 if p_lock then select * into j from public.translation_jobs where id=p_job_id for update;
 else select * into j from public.translation_jobs where id=p_job_id;end if;
 if j.id is null then raise exception 'Profile scan job not found' using errcode='P0002';end if;
 if j.kind not in ('writer','country') or probpera_translation_operations.profile_scan_marker_valid(j.resume_cursor->'profileScan') is distinct from true then
  raise exception 'Not a stable profile scan' using errcode='22023';end if;
 if j.requested_by<>actor then raise exception 'Profile scan actor differs' using errcode='42501';end if;
 return j;
end; $$;

-- Metadata only. Past positions cannot rewind, so this takes no cache/ancestor row locks.
-- Eager successor UUIDs never authorize consuming an unfinished future window.
create function probpera_translation_operations.profile_scan_predecessors_ready(j public.translation_jobs)
returns boolean language sql stable security invoker set search_path='' as $$
 select not exists(select 1 from public.translation_jobs p where p.resume_cursor#>>'{profileScan,scanId}'=j.resume_cursor#>>'{profileScan,scanId}'
  and (p.resume_cursor#>>'{profileScan,windowIndex}')::integer<(j.resume_cursor#>>'{profileScan,windowIndex}')::integer
  and ((p.resume_cursor#>>'{profileScan,nextPosition}')::integer<>p.total_items or p.resume_cursor#>'{profileScan,activeChild}'<>'null'::jsonb));
$$;

create function probpera_translation_operations.profile_scan_assert_chain(p_scan_id uuid)
returns void language plpgsql volatile security invoker set search_path='' as $$
declare root public.translation_jobs%rowtype;j public.translation_jobs%rowtype;m jsonb;rm jsonb;ids uuid[];n integer;idx integer;
 manifest jsonb:='[]';part jsonb;cnt integer;distinct_count integer;item_count integer;
begin
 select * into root from public.translation_jobs where id=p_scan_id;rm:=root.resume_cursor->'profileScan';
 if root.id is null or probpera_translation_operations.profile_scan_marker_valid(rm) is distinct from true or rm->>'windowIndex'<>'0'
  or root.id::text<>rm->>'scanId' or root.kind not in ('writer','country') then raise exception 'Profile scan root proof missing' using errcode='42501';end if;
 select array_agg(id order by (resume_cursor#>>'{profileScan,windowIndex}')::integer),count(*) into ids,cnt
 from public.translation_jobs where resume_cursor#>>'{profileScan,scanId}'=p_scan_id::text;
 if cnt<>(rm->>'windowCount')::integer or cnt not between 1 and 20 then raise exception 'Profile window chain count differs' using errcode='42501';end if;
 for idx in 0..cnt-1 loop
  select * into j from public.translation_jobs where id=ids[idx+1];m:=j.resume_cursor->'profileScan';
  n:=least(500,greatest(0,(rm->>'totalMembership')::integer-idx*500));
  if j.kind<>root.kind or j.provider<>root.provider or j.requested_by<>root.requested_by or j.total_items<>n
   or probpera_translation_operations.profile_scan_marker_valid(m) is distinct from true or (m->>'windowIndex')::integer<>idx
   or m->'fullManifestHash' is distinct from rm->'fullManifestHash' or m->'configurationHash' is distinct from rm->'configurationHash'
   or m->'totalMembership' is distinct from rm->'totalMembership' or m->'windowCount' is distinct from rm->'windowCount'
   or m->>'predecessorJobId' is distinct from (case when idx=0 then null else ids[idx]::text end)
   or m->>'successorJobId' is distinct from (case when idx=cnt-1 then null else ids[idx+2]::text end) then
   raise exception 'Profile eager chain binding differs' using errcode='42501';end if;
  select count(*),coalesce(jsonb_agg(probpera_translation_operations.profile_scan_record(j.kind,i.entity_id,m->'catalogSourceHashes'->>i.position) order by i.position),'[]')
   into item_count,part from public.translation_job_items i where i.job_id=j.id;
  if item_count<>n or exists(select 1 from public.translation_job_items i where i.job_id=j.id and
   (i.position>=n or i.entity_type<>j.kind or (i.position<(m->>'nextPosition')::integer) is distinct from (i.status<>'reviewing')))
   or probpera_translation_operations.retry_fingerprint(part)<>m->>'membershipHash' then raise exception 'Profile immutable member proof differs' using errcode='42501';end if;
  manifest:=manifest||part;
 end loop;
 if jsonb_array_length(manifest)<>(rm->>'totalMembership')::integer or probpera_translation_operations.profile_scan_manifest_valid(root.kind,manifest) is distinct from true
  or probpera_translation_operations.retry_fingerprint(manifest)<>rm->>'fullManifestHash' then raise exception 'Profile full manifest proof differs' using errcode='42501';end if;
end; $$;

create function probpera_translation_operations.profile_scan_insert_chain_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- The root's deferred event proves the entire immutable chain once. Child
 -- INSERTs must already prove their existing root/predecessor immediately;
 -- a previously committed full chain has no unused legal unique window slot.
 if new.resume_cursor?'profileScan' and new.resume_cursor#>>'{profileScan,windowIndex}'='0' then
  perform probpera_translation_operations.profile_scan_assert_chain((new.resume_cursor#>>'{profileScan,scanId}')::uuid);
 end if;
 return new;
end; $$;

create function probpera_translation_operations.profile_scan_view(j public.translation_jobs,p_replayed boolean default false,p_transition text default 'read')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare m jsonb:=j.resume_cursor->'profileScan';members jsonb;part jsonb;member public.translation_job_items%rowtype;a record;
 link jsonb;child jsonb:='null';reason text;cnt integer;fingerprint text;
begin
 select coalesce(jsonb_agg(jsonb_build_object('itemId',i.id,'position',i.position,'entityId',i.entity_id,'status',i.status)
  ||probpera_translation_operations.profile_scan_record(j.kind,i.entity_id,m->'catalogSourceHashes'->>i.position) order by i.position),'[]'),
  count(*),probpera_translation_operations.retry_fingerprint(coalesce(jsonb_agg(probpera_translation_operations.profile_scan_record(j.kind,i.entity_id,m->'catalogSourceHashes'->>i.position) order by i.position),'[]'))
 into members,cnt,fingerprint from public.translation_job_items i where i.job_id=j.id;
 if cnt<>j.total_items or fingerprint<>m->>'membershipHash' or (m->>'nextPosition')::integer>cnt
  or exists(select 1 from public.translation_job_items i where i.job_id=j.id and (i.position<(m->>'nextPosition')::integer) is distinct from (i.status<>'reviewing')) then
  raise exception 'Profile scan membership differs' using errcode='40001';end if;
 select * into member from public.translation_job_items where job_id=j.id and position=(m->>'nextPosition')::integer;
 if m->'activeChild'<>'null'::jsonb then
  link:=m->'activeChild';select * into a from probpera_translation_operations.profile_scan_operation(j.kind,member.entity_id,(link->>'operationId')::uuid,false);
  if a.operation_id is null or a.job_id::text<>link->>'jobId' or a.item_id::text<>link->>'itemId' or a.intent_hash<>link->>'intentHash'
   or a.actor_id::text<>link->>'actorId' or a.source_hash<>link->>'sourceHash' or a.configuration_hash<>link->>'configurationHash' then
   raise exception 'Profile scan child binding differs' using errcode='40001';end if;
 elsif member.id is not null and p_transition not in ('advanced','zero-call-held') then
  select * into a from probpera_translation_operations.profile_scan_operation(j.kind,member.entity_id,null,true);
  if a.operation_id is not null then link:=probpera_translation_operations.profile_scan_link(to_jsonb(a),'observed-blocked');end if;
 else select * into a from probpera_translation_operations.profile_scan_operation(j.kind,'',null,true);
 end if;
 if a.operation_id is not null then
  child:=jsonb_build_object('binding',link->'binding','initialProviderCalls',link->'initialProviderCalls','receipt',a.receipt);
  if a.actor_id<>j.requested_by then reason:='child_owned_by_another_actor';
  elsif exists(select 1 from public.translation_jobs x where x.id<>j.id and x.resume_cursor#>>'{profileScan,activeChild,binding}'='attached'
   and x.resume_cursor#>>'{profileScan,activeChild,operationId}'=a.operation_id::text) then reason:='child_attached_to_another_scan';else reason:='child_pending';end if;
 end if;
 if j.cancel_requested_at is not null or j.status in ('cancelled','cancelling') then reason:='scan_stopped';
 elsif reason is null and (m->>'nextPosition')::integer=j.total_items and m->'exhausted'='false'::jsonb then reason:='window_complete';end if;
 return jsonb_build_object('version',1,'scanId',m->'scanId','jobId',j.id,'jobVersion',j.version::text,'actorId',j.requested_by,'kind',j.kind,'provider',j.provider,'status',j.status,
  'configurationHash',m->'configurationHash','fullManifestHash',m->'fullManifestHash','membershipHash',m->'membershipHash','totalMembership',m->'totalMembership',
  'windowCount',m->'windowCount','windowIndex',m->'windowIndex','predecessorJobId',m->'predecessorJobId','successorJobId',m->'successorJobId',
  'totalItems',j.total_items,'nextPosition',m->'nextPosition','lastWindow',m->'lastWindow','exhausted',m->'exhausted','members',members,'child',child,
  'replayed',p_replayed,'transition',p_transition,'blockReason',reason);
end; $$;

create unique index translation_profile_scan_window_unique on public.translation_jobs
 ((resume_cursor#>>'{profileScan,scanId}'),(resume_cursor#>>'{profileScan,windowIndex}')) where resume_cursor?'profileScan';
create unique index translation_profile_scan_successor_unique on public.translation_jobs
 ((resume_cursor#>>'{profileScan,predecessorJobId}')) where resume_cursor#>>'{profileScan,predecessorJobId}' is not null;
create unique index translation_profile_scan_attached_child_unique on public.translation_jobs
 ((resume_cursor#>>'{profileScan,activeChild,operationId}')) where resume_cursor#>>'{profileScan,activeChild,binding}'='attached';

create function public.begin_profile_translation_scan(p_scan_id uuid,p_kind text,p_configuration jsonb,p_manifest jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=premium_translation_private.assert_actor();j public.translation_jobs%rowtype;ids uuid[];manifest_hash text;config_hash text;total integer;
 windows integer;idx integer;chunk jsonb;hashes jsonb;m jsonb;entry jsonb;stamp timestamptz:=clock_timestamp();
begin
 if not probpera_translation_operations.retry_uuid(p_scan_id) or probpera_translation_operations.profile_scan_configuration_valid(p_kind,p_configuration) is distinct from true
  or probpera_translation_operations.profile_scan_manifest_valid(p_kind,p_manifest) is distinct from true then raise exception 'Invalid profile scan intent' using errcode='22023';end if;
 manifest_hash:=probpera_translation_operations.retry_fingerprint(p_manifest);config_hash:=probpera_translation_operations.retry_fingerprint(p_configuration);
 perform pg_advisory_xact_lock(hashtextextended('profile-scan:'||p_scan_id::text,7451));
 select * into j from public.translation_jobs where id=p_scan_id for update;
 if j.id is not null then
  j:=probpera_translation_operations.profile_scan_access(p_scan_id,false);
  if j.kind<>p_kind or j.provider<>p_configuration->>'provider' or j.resume_cursor#>>'{profileScan,scanId}'<>p_scan_id::text
   or j.resume_cursor#>>'{profileScan,windowIndex}'<>'0' or j.resume_cursor#>>'{profileScan,configurationHash}'<>config_hash
   or j.resume_cursor#>>'{profileScan,fullManifestHash}'<>manifest_hash then raise exception 'Profile scan intent differs' using errcode='40001';end if;
  return probpera_translation_operations.profile_scan_view(j,true,'read');
 end if;
 total:=jsonb_array_length(p_manifest);windows:=greatest(1,(total+499)/500);ids:=array[p_scan_id];
 if windows>1 then for idx in 2..windows loop ids:=array_append(ids,gen_random_uuid());end loop;end if;
 -- All IDs exist in memory before any INSERT. Deferred job-only guards validate
 -- the final circular references, never a caller-controlled construction flag.
 for idx in 0..windows-1 loop
  select coalesce(jsonb_agg(value order by n),'[]'),coalesce(jsonb_agg(value->'catalogSourceHash' order by n),'[]') into chunk,hashes
   from jsonb_array_elements(p_manifest) with ordinality x(value,n) where n>idx*500 and n<=idx*500+500;
  m:=jsonb_build_object('version',1,'scanId',p_scan_id,'windowIndex',idx,'windowCount',windows,'totalMembership',total,
   'predecessorJobId',case when idx=0 then null else ids[idx] end,'successorJobId',case when idx=windows-1 then null else ids[idx+2] end,
   'fullManifestHash',manifest_hash,'membershipHash',probpera_translation_operations.retry_fingerprint(chunk),'configurationHash',config_hash,
   'catalogSourceHashes',hashes,'nextPosition',0,'lastWindow',idx=windows-1,'exhausted',total=0,'activeChild',null,'lastTransition',null);
  insert into public.translation_jobs(id,kind,provider,status,total_items,succeeded_items,failed_items,requested_by,started_at,completed_at,version,resume_cursor)
   values(ids[idx+1],p_kind,p_configuration->>'provider',case when total=0 then 'skipped' else 'reviewing' end,jsonb_array_length(chunk),0,0,actor,stamp,
    case when total=0 then stamp else null end,1,jsonb_build_object('profileScan',m)) returning * into j;
  insert into public.translation_job_items(job_id,position,entity_type,entity_id,status,attempt_count,max_attempts,staff_retry,lease_owner,lease_expires_at)
   select j.id,n-1,p_kind,case when p_kind='writer' then (value->>'countryId')||':'||(value->>'writerId') else value->>'countryId' end,
    'reviewing',0,1,null,null,null from jsonb_array_elements(chunk) with ordinality x(value,n);
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(actor,'translation.profile_scan.window_created','translation_job',j.id::text,
   jsonb_build_object('scanId',p_scan_id,'kind',p_kind,'windowIndex',idx,'windowCount',windows,'totalMembership',total,'totalItems',j.total_items,
    'fullManifestHash',manifest_hash,'membershipHash',m->'membershipHash'));
 end loop;
 perform probpera_translation_operations.profile_scan_assert_chain(p_scan_id);
 select * into j from public.translation_jobs where id=p_scan_id;
 return probpera_translation_operations.profile_scan_view(j,false,'created');
end; $$;

create function public.get_profile_translation_scan(p_job_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare j public.translation_jobs%rowtype;
begin
 j:=probpera_translation_operations.profile_scan_access(p_job_id,true);
 return probpera_translation_operations.profile_scan_view(j,false,'read');
end; $$;


create function probpera_translation_operations.profile_scan_status(p_job_id uuid)
returns text language sql stable security invoker set search_path='' as $$
 select case when count(*)filter(where status='dead_letter')>0 then case when count(*)filter(where status='succeeded')>0 then 'partial' else 'failed' end
  when count(*)filter(where status='conflict')>0 then 'conflict' when count(*)filter(where status='stale')>0 then 'stale'
  when count(*)filter(where status='not-configured')>0 then 'not-configured' when count(*)filter(where status='cancelled')>0 then 'cancelled'
  when count(*)filter(where status='succeeded')>0 then 'completed' else 'skipped' end from public.translation_job_items where job_id=p_job_id;
$$;

create function public.attach_profile_translation_scan_operation(
 p_window_job_id uuid,p_expected_version bigint,p_item_id uuid,p_operation_job_id uuid,p_operation_item_id uuid,p_operation_id uuid,p_intent_hash text,p_transition_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare j public.translation_jobs%rowtype;i public.translation_job_items%rowtype;a record;
 m jsonb;fingerprint text;binding text;stamp timestamptz:=clock_timestamp();
begin
 j:=probpera_translation_operations.profile_scan_access(p_window_job_id,false);
 if p_expected_version is null or p_expected_version<1 or not probpera_translation_operations.retry_uuid(p_item_id)
  or not probpera_translation_operations.retry_uuid(p_operation_job_id) or not probpera_translation_operations.retry_uuid(p_operation_item_id)
  or not probpera_translation_operations.retry_uuid(p_operation_id) or not probpera_translation_operations.retry_uuid(p_transition_id)
  or coalesce(p_intent_hash,'')!~'^[a-f0-9]{64}$' then raise exception 'Invalid profile scan attachment' using errcode='22023';end if;
 select * into i from public.translation_job_items where id=p_item_id and job_id=j.id;
 if i.id is null then raise exception 'Profile scan item differs' using errcode='40001';end if;
 -- Before parent lock: BEGIN holds entity->cache, dispatch holds cache->parent.
 perform probpera_translation_operations.profile_scan_entity_lock(j.kind,i.entity_id);
 j:=probpera_translation_operations.profile_scan_access(p_window_job_id,true);m:=j.resume_cursor->'profileScan';
 if not probpera_translation_operations.profile_scan_predecessors_ready(j) or i.position<>(m->>'nextPosition')::integer then raise exception 'Profile scan current item changed' using errcode='40001';end if;
 fingerprint:=probpera_translation_operations.retry_fingerprint(jsonb_build_array('attach',j.id,p_item_id,p_operation_job_id,p_operation_item_id,p_operation_id,p_intent_hash,p_expected_version));
 if m#>>'{lastTransition,id}'=p_transition_id::text and m#>>'{lastTransition,fingerprint}'<>fingerprint then raise exception 'Profile attachment replay differs' using errcode='40001';end if;
 if m->'activeChild'<>'null'::jsonb then
  if m#>>'{activeChild,operationId}'=p_operation_id::text and m#>>'{activeChild,jobId}'=p_operation_job_id::text
   and m#>>'{activeChild,itemId}'=p_operation_item_id::text and m#>>'{activeChild,intentHash}'=p_intent_hash then
   return probpera_translation_operations.profile_scan_view(j,true,case when m#>>'{activeChild,binding}'='attached' then 'attached' else 'held' end);end if;
  return probpera_translation_operations.profile_scan_view(j,false,'held');
 end if;
 if j.version<>p_expected_version then raise exception 'Profile scan version changed' using errcode='40001';end if;
 if j.cancel_requested_at is not null or j.status in ('cancelled','cancelling') then return probpera_translation_operations.profile_scan_view(j,false,'held');end if;
 select * into a from probpera_translation_operations.profile_scan_operation(j.kind,i.entity_id,p_operation_id,false);
 if a.operation_id is null or a.entity_type<>j.kind or a.entity_id<>i.entity_id or a.job_id<>p_operation_job_id or a.item_id<>p_operation_item_id or a.intent_hash<>p_intent_hash then
  raise exception 'Profile paid child differs' using errcode='40001';end if;
 if a.final_receipt is not null then raise exception 'Historical terminal child is a free observation' using errcode='40001';end if;
 binding:=case when a.actor_id=j.requested_by and a.provider=j.provider and a.configuration_hash=m->>'configurationHash' and a.provider_calls=0
  and not a.has_pending and a.catalog_source_hash=m->'catalogSourceHashes'->>i.position
  and a.confirmed_cursor=jsonb_build_object(case when j.kind='writer' then 'writerCursor' else 'countryCursor' end,(m->>'windowIndex')::integer*500+i.position+1)
  and a.current_cursor=jsonb_build_object(case when j.kind='writer' then 'writerCursor' else 'countryCursor' end,(m->>'windowIndex')::integer*500+i.position)
  and not exists(select 1 from public.translation_jobs x where x.id<>j.id and x.resume_cursor#>>'{profileScan,activeChild,binding}'='attached'
    and x.resume_cursor#>>'{profileScan,activeChild,operationId}'=a.operation_id::text) then 'attached' else 'observed-blocked' end;
 m:=m||jsonb_build_object('activeChild',probpera_translation_operations.profile_scan_link(to_jsonb(a),binding),'lastTransition',
  jsonb_build_object('id',p_transition_id,'fingerprint',fingerprint,'itemId',i.id,'kind','attached','operationId',a.operation_id));
 update public.translation_jobs set resume_cursor=jsonb_build_object('profileScan',m),version=version+1,updated_at=stamp where id=j.id returning * into j;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(j.requested_by,'translation.profile_scan.child_attached','translation_job',j.id::text,
  jsonb_build_object('scanId',m->'scanId','itemId',i.id,'operationId',a.operation_id,'transitionId',p_transition_id,'binding',binding));
 return probpera_translation_operations.profile_scan_view(j,false,case when binding='attached' then 'attached' else 'held' end);
end; $$;

create function public.checkpoint_profile_translation_scan_item(
 p_window_job_id uuid,p_expected_version bigint,p_item_id uuid,p_transition_id uuid,p_observation jsonb,p_operation_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare j public.translation_jobs%rowtype;i public.translation_job_items%rowtype;prior public.translation_job_attempts%rowtype;
 a record;m jsonb;fingerprint text;receipt jsonb;classification text;state text;code text;
 observed_source_hash text;item_status text;child_meta jsonb:='null';stamp timestamptz:=clock_timestamp();next_position integer;
begin
 j:=probpera_translation_operations.profile_scan_access(p_window_job_id,false);
 if p_expected_version is null or p_expected_version<1 or not probpera_translation_operations.retry_uuid(p_item_id)
  or not probpera_translation_operations.retry_uuid(p_transition_id) or (p_operation_id is not null and not probpera_translation_operations.retry_uuid(p_operation_id))
  or p_transition_id=p_operation_id or jsonb_typeof(p_observation) is distinct from 'object' then
  raise exception 'Invalid profile scan checkpoint' using errcode='22023';end if;
 if p_observation->>'type'='free' then
  if not premium_translation_private.exact_object(p_observation,array['version','type','state','reason','sourceHash']) or p_observation->'version'<>'1'::jsonb
   or coalesce(p_observation->>'state','') not in ('manual','current','review-pending','stale','skipped','failed')
   or (p_observation->'reason'<>'null'::jsonb and coalesce(p_observation->>'reason','') not in ('source_missing','ineligible','existing_candidate','database_read_failed','catalog_changed'))
   or (p_observation->>'reason'='catalog_changed' and p_observation->>'state'<>'stale')
   or (p_observation->'sourceHash'<>'null'::jsonb and coalesce(p_observation->>'sourceHash','')!~'^[a-f0-9]{64}$') or p_operation_id is not null then
   raise exception 'Invalid free profile observation' using errcode='22023';end if;
 elsif not premium_translation_private.exact_object(p_observation,array['version','type']) or p_observation->'version'<>'1'::jsonb
   or p_observation->>'type' is distinct from 'child-terminal' or p_operation_id is null then
   raise exception 'Invalid child profile observation' using errcode='22023';end if;
 fingerprint:=probpera_translation_operations.retry_fingerprint(jsonb_build_array('checkpoint',j.id,p_item_id,p_expected_version,p_observation,p_operation_id));
 select * into prior from public.translation_job_attempts where staff_retry_operation_id=p_transition_id;
 if prior.id is not null then
  if prior.item_id<>p_item_id or prior.staff_retry_receipt->>'type'<>'profile-scan-observation'
   or prior.staff_retry_receipt->>'windowJobId'<>j.id::text or prior.staff_retry_receipt->>'fingerprint'<>fingerprint then
   raise exception 'Profile checkpoint replay differs' using errcode='40001';end if;
  return probpera_translation_operations.profile_scan_view(j,true,'advanced');
 end if;
 select * into i from public.translation_job_items where id=p_item_id and job_id=j.id;
 if i.id is null then raise exception 'Profile scan item differs' using errcode='40001';end if;
 perform probpera_translation_operations.profile_scan_entity_lock(j.kind,i.entity_id);
 j:=probpera_translation_operations.profile_scan_access(p_window_job_id,true);m:=j.resume_cursor->'profileScan';
 select * into prior from public.translation_job_attempts where staff_retry_operation_id=p_transition_id;
 if prior.id is not null then
  if prior.item_id<>p_item_id or prior.staff_retry_receipt->>'type'<>'profile-scan-observation' or prior.staff_retry_receipt->>'windowJobId'<>j.id::text
   or prior.staff_retry_receipt->>'fingerprint'<>fingerprint then raise exception 'Profile concurrent replay differs' using errcode='40001';end if;
  return probpera_translation_operations.profile_scan_view(j,true,'advanced');end if;
 if m#>>'{lastTransition,id}'=p_transition_id::text then
  if m#>>'{lastTransition,fingerprint}'<>fingerprint then raise exception 'Profile held checkpoint replay differs' using errcode='40001';end if;
  return probpera_translation_operations.profile_scan_view(j,true,case when m#>>'{lastTransition,kind}'='zero-call-held' then 'zero-call-held' else 'held' end);
 end if;
 if not probpera_translation_operations.profile_scan_predecessors_ready(j) or j.version<>p_expected_version or i.position<>(m->>'nextPosition')::integer or i.status<>'reviewing' then
  raise exception 'Profile scan checkpoint changed' using errcode='40001';end if;
 if m->'activeChild'<>'null'::jsonb then
  select * into a from probpera_translation_operations.profile_scan_operation(j.kind,i.entity_id,(m#>>'{activeChild,operationId}')::uuid,false);
  if a.operation_id is null then raise exception 'Profile attached child missing' using errcode='40001';end if;
  if p_observation->>'type'<>'child-terminal' or a.operation_id is distinct from p_operation_id or a.final_receipt is null then
   return probpera_translation_operations.profile_scan_view(j,false,'held');end if;
  -- FINISH/zero-call cleanup occurs outside this parent transaction. This is
  -- a plain read of its immutable proof, never parent -> child cache locking.
  if a.provider_calls=0 then
   m:=m||jsonb_build_object('activeChild',null,'lastTransition',jsonb_build_object('id',p_transition_id,'fingerprint',fingerprint,'itemId',i.id,'kind','zero-call-held','operationId',a.operation_id));
   update public.translation_jobs set resume_cursor=jsonb_build_object('profileScan',m),version=version+1,updated_at=stamp where id=j.id returning * into j;
   insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(j.requested_by,'translation.profile_scan.zero_call_held','translation_job',j.id::text,
    jsonb_build_object('scanId',m->'scanId','itemId',i.id,'operationId',a.operation_id,'transitionId',p_transition_id));
   return probpera_translation_operations.profile_scan_view(j,false,'zero-call-held');
  end if;
  state:=a.final_receipt#>>'{result,state}';code:=a.final_receipt#>>'{result,errorCode}';observed_source_hash:=a.source_hash;
  classification:=case when (m#>>'{activeChild,initialProviderCalls}')::integer>0 or m#>>'{activeChild,binding}'='observed-blocked' then 'existing-resolved' else 'child-completed' end;
  child_meta:=jsonb_build_object('jobId',a.job_id,'itemId',a.item_id,'operationId',a.operation_id,'intentHash',a.intent_hash,'state',state,
   'errorCode',code,'persistence',a.final_receipt#>'{result,persistence}','candidateHash',a.final_receipt#>'{result,candidateHash}',
   'draftId',a.final_receipt#>'{result,draftId}','draftVersion',a.final_receipt#>'{result,draftVersion}');
 else
  select * into a from probpera_translation_operations.profile_scan_operation(j.kind,i.entity_id,null,true);
  if a.operation_id is not null then
   m:=m||jsonb_build_object('activeChild',probpera_translation_operations.profile_scan_link(to_jsonb(a),'observed-blocked'),'lastTransition',
    jsonb_build_object('id',p_transition_id,'fingerprint',fingerprint,'itemId',i.id,'kind','held','operationId',a.operation_id));
   update public.translation_jobs set resume_cursor=jsonb_build_object('profileScan',m),version=version+1,updated_at=stamp where id=j.id returning * into j;
   return probpera_translation_operations.profile_scan_view(j,false,'held');
  end if;
  if p_observation->>'type'='child-terminal' then
   select * into a from probpera_translation_operations.profile_scan_operation(j.kind,i.entity_id,p_operation_id,false);
   if a.operation_id is null or a.entity_type<>j.kind or a.entity_id<>i.entity_id or a.final_receipt is null then
    raise exception 'Historical profile result binding differs' using errcode='40001';end if;
   if a.provider_calls=0 then
    m:=m||jsonb_build_object('lastTransition',jsonb_build_object('id',p_transition_id,'fingerprint',fingerprint,'itemId',i.id,'kind','zero-call-held','operationId',a.operation_id));
    update public.translation_jobs set resume_cursor=jsonb_build_object('profileScan',m),version=version+1,updated_at=stamp where id=j.id returning * into j;
    return probpera_translation_operations.profile_scan_view(j,false,'zero-call-held');end if;
   state:=a.final_receipt#>>'{result,state}';code:=a.final_receipt#>>'{result,errorCode}';observed_source_hash:=a.source_hash;classification:='existing-resolved';
   child_meta:=jsonb_build_object('jobId',a.job_id,'itemId',a.item_id,'operationId',a.operation_id,'intentHash',a.intent_hash,'state',state,
    'errorCode',code,'persistence',a.final_receipt#>'{result,persistence}','candidateHash',a.final_receipt#>'{result,candidateHash}',
    'draftId',a.final_receipt#>'{result,draftId}','draftVersion',a.final_receipt#>'{result,draftVersion}');
  else
   if j.cancel_requested_at is not null or j.status in ('cancelled','cancelling') then return probpera_translation_operations.profile_scan_view(j,false,'held');end if;
   -- KV/catalog membership is authenticated application metadata, not an SQL
   -- attestation of today's remote asset. Only the old owned admission/CAS can pay.
   state:=p_observation->>'state';observed_source_hash:=p_observation->>'sourceHash';classification:=coalesce(p_observation->>'reason',state);
   code:=case when state='failed' then 'database_read_failed' else null end;
  end if;
 end if;
 item_status:=case state when 'translated' then 'succeeded' when 'failed' then 'dead_letter' when 'conflict' then 'conflict'
  when 'stale' then 'stale' when 'cancelled' then 'cancelled' when 'not-configured' then 'not-configured' else 'skipped' end;
 receipt:=jsonb_build_object('version',1,'type','profile-scan-observation','scanId',m->'scanId','windowJobId',j.id,'itemId',i.id,'position',i.position,'entityId',i.entity_id,'kind',j.kind,'catalogSourceHash',m->'catalogSourceHashes'->i.position,
  'transitionId',p_transition_id,'fingerprint',fingerprint,'classification',classification,'state',state,'errorCode',code,'sourceHash',observed_source_hash,'providerCalls',0,'child',child_meta);
 insert into public.translation_job_attempts(item_id,attempt_number,outcome,provider,model,provider_request_id,error_code,input_tokens,output_tokens,duration_ms,staff_retry_operation_id,staff_retry_receipt)
 values(i.id,1,'skipped',j.provider,null,null,null,null,null,null,p_transition_id,receipt);
 update public.translation_job_items set status=item_status,attempt_count=1,last_error_code=code,source_hash=observed_source_hash,updated_at=stamp where id=i.id;
 next_position:=(m->>'nextPosition')::integer+1;
 m:=m||jsonb_build_object('nextPosition',next_position,'activeChild',null,'exhausted',next_position=j.total_items and (m->>'lastWindow')::boolean,
  'lastTransition',jsonb_build_object('id',p_transition_id,'fingerprint',fingerprint,'itemId',i.id,'kind','advanced','operationId',p_operation_id));
 update public.translation_jobs set resume_cursor=jsonb_build_object('profileScan',m),version=version+1,updated_at=stamp,
  status=case when cancel_requested_at is not null then 'cancelled' when next_position=total_items then probpera_translation_operations.profile_scan_status(id) else 'reviewing' end,
  succeeded_items=(select count(*) from public.translation_job_items where job_id=j.id and status='succeeded'),
  failed_items=(select count(*) from public.translation_job_items where job_id=j.id and status='dead_letter'),
  completed_at=case when next_position=total_items then stamp else null end where id=j.id returning * into j;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(j.requested_by,'translation.profile_scan.observed','translation_job',j.id::text,
  jsonb_build_object('scanId',m->'scanId','itemId',i.id,'position',i.position,'transitionId',p_transition_id,'classification',classification,'childOperationId',p_operation_id,'providerCalls',0));
 return probpera_translation_operations.profile_scan_view(j,false,'advanced');
end; $$;

create function public.continue_profile_translation_scan(p_window_job_id uuid,p_expected_version bigint,p_configuration jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare j public.translation_jobs%rowtype;successor public.translation_jobs%rowtype;m jsonb;
begin
 j:=probpera_translation_operations.profile_scan_access(p_window_job_id,true);m:=j.resume_cursor->'profileScan';
 if p_expected_version is null or p_expected_version<1 or probpera_translation_operations.profile_scan_configuration_valid(j.kind,p_configuration) is distinct from true then
  raise exception 'Invalid profile continuation configuration' using errcode='22023';end if;
 if probpera_translation_operations.retry_fingerprint(p_configuration)<>m->>'configurationHash' or p_configuration->>'provider'<>j.provider then
  raise exception 'Profile continuation configuration changed' using errcode='40001';end if;
 if j.cancel_requested_at is not null or j.status in ('cancelled','cancelling') then return probpera_translation_operations.profile_scan_view(j,false,'held');end if;
 -- The eager pointer is NOT a shortcut through unfinished members or a paid hold.
 if m->'activeChild'<>'null'::jsonb or (m->>'nextPosition')::integer<j.total_items then
  if j.version<>p_expected_version then raise exception 'Profile continuation version changed' using errcode='40001';end if;
  return probpera_translation_operations.profile_scan_view(j,false,'read');end if;
 if m->'exhausted'='true'::jsonb then return probpera_translation_operations.profile_scan_view(j,true,'exhausted');end if;
 if m->'successorJobId'='null'::jsonb then raise exception 'Profile eager successor missing' using errcode='40001';end if;
 -- Completed parent membership/pointer is immutable: an old accepted continuation
 -- ACK can replay the same successor without allocating or changing any row.
 successor:=probpera_translation_operations.profile_scan_access((m->>'successorJobId')::uuid,false);
 if successor.resume_cursor#>>'{profileScan,predecessorJobId}'<>j.id::text then raise exception 'Profile predecessor differs' using errcode='40001';end if;
 return probpera_translation_operations.profile_scan_view(successor,true,'successor');
end; $$;

create function probpera_translation_operations.profile_scan_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare j public.translation_jobs%rowtype;p public.translation_jobs%rowtype;root public.translation_jobs%rowtype;i public.translation_job_items%rowtype;
 a record;m jsonb;om jsonb;r jsonb;old_position integer;new_position integer;
begin
 if tg_table_name='translation_jobs' then
  m:=case when tg_op='DELETE' then old.resume_cursor->'profileScan' else new.resume_cursor->'profileScan' end;
  om:=case when tg_op='INSERT' then null else old.resume_cursor->'profileScan' end;
  if m is null and om is null then return case when tg_op='DELETE' then old else new end;end if;
  if tg_op='DELETE' then raise exception 'Stable scan history cannot be deleted' using errcode='42501';end if;
  if new.kind not in ('writer','country') or new.resume_cursor-'profileScan'<>'{}'::jsonb or probpera_translation_operations.profile_scan_marker_valid(m) is distinct from true
   or new.total_items<>least(500,greatest(0,(m->>'totalMembership')::integer-(m->>'windowIndex')::integer*500)) or (m->>'nextPosition')::integer>new.total_items
   or new.status not in ('reviewing','completed','partial','failed','conflict','stale','skipped','not-configured','cancelling','cancelled') then
   raise exception 'Invalid stable profile scan row' using errcode='42501';end if;
  if tg_op='INSERT' then
   if new.version<>1 or (m->>'nextPosition')::integer<>0 or m->'activeChild'<>'null'::jsonb or m->'lastTransition'<>'null'::jsonb
    or new.succeeded_items<>0 or new.failed_items<>0 or new.cancel_requested_at is not null
    or ((m->>'windowIndex')::integer=0 and new.id::text<>m->>'scanId') then raise exception 'Invalid initial profile window' using errcode='42501';end if;
   if (m->>'windowIndex')::integer>0 then
    select * into root from public.translation_jobs where id=(m->>'scanId')::uuid;
    select * into p from public.translation_jobs where id=(m->>'predecessorJobId')::uuid;
    if root.id is null or probpera_translation_operations.profile_scan_marker_valid(root.resume_cursor->'profileScan') is distinct from true
     or root.resume_cursor#>>'{profileScan,windowIndex}' is distinct from '0'
     or root.resume_cursor#>>'{profileScan,scanId}' is distinct from root.id::text
     or new.kind is distinct from root.kind or new.provider is distinct from root.provider or new.requested_by is distinct from root.requested_by
     or m->'configurationHash' is distinct from root.resume_cursor#>'{profileScan,configurationHash}'
     or m->'fullManifestHash' is distinct from root.resume_cursor#>'{profileScan,fullManifestHash}'
     or m->'totalMembership' is distinct from root.resume_cursor#>'{profileScan,totalMembership}'
     or m->'windowCount' is distinct from root.resume_cursor#>'{profileScan,windowCount}'
     or p.id is null or probpera_translation_operations.profile_scan_marker_valid(p.resume_cursor->'profileScan') is distinct from true
     or p.resume_cursor#>'{profileScan,scanId}' is distinct from m->'scanId'
     or p.resume_cursor#>>'{profileScan,successorJobId}' is distinct from new.id::text
     or (p.resume_cursor#>>'{profileScan,windowIndex}')::integer+1<>(m->>'windowIndex')::integer then
     raise exception 'Profile eager child lacks its immutable root/predecessor binding' using errcode='42501';
    end if;
   end if;
   -- Circular eager pointers receive their full committed proof from the deferred
   -- job-INSERT trigger, and from the explicit BEGIN assertion, never a GUC.
   return new;
  end if;
  if om is null or (to_jsonb(new)-array['resume_cursor','version','updated_at','status','succeeded_items','failed_items','completed_at','cancel_requested_at'])<>
    (to_jsonb(old)-array['resume_cursor','version','updated_at','status','succeeded_items','failed_items','completed_at','cancel_requested_at'])
   or (m-array['nextPosition','exhausted','activeChild','lastTransition'])<>
      (om-array['nextPosition','exhausted','activeChild','lastTransition'])
   or new.version<>old.version+1 or (old.cancel_requested_at is not null and new.cancel_requested_at is distinct from old.cancel_requested_at)
   or (om->'exhausted'='true'::jsonb and m->'exhausted'<>'true'::jsonb) then
   raise exception 'Stable profile identity/history differs' using errcode='42501';end if;
  old_position:=(om->>'nextPosition')::integer;new_position:=(m->>'nextPosition')::integer;
  if new_position<old_position or new_position>old_position+1 then raise exception 'Invalid profile cursor jump' using errcode='42501';end if;
  select * into i from public.translation_job_items where job_id=old.id and position=old_position;
  if om->'activeChild'<>'null'::jsonb then
   select * into a from probpera_translation_operations.profile_scan_operation(old.kind,i.entity_id,(om#>>'{activeChild,operationId}')::uuid,false);
   if a.operation_id is null then raise exception 'Profile child proof missing' using errcode='42501';end if;
   if m->'activeChild' is distinct from om->'activeChild' then
    if m->'activeChild'<>'null'::jsonb or a.final_receipt is null
     or (new_position=old_position and (a.provider_calls<>0 or m#>>'{lastTransition,kind}'<>'zero-call-held'))
     or (new_position>old_position and a.provider_calls=0) then
     raise exception 'Unknown or zero-call profile child cannot advance' using errcode='42501';end if;
   end if;
  elsif m->'activeChild'<>'null'::jsonb then
   select * into a from probpera_translation_operations.profile_scan_operation(new.kind,i.entity_id,(m#>>'{activeChild,operationId}')::uuid,false);
   if a.operation_id is null or a.final_receipt is not null or a.entity_type<>new.kind or a.entity_id is distinct from i.entity_id
    or a.job_id::text<>m#>>'{activeChild,jobId}' or a.item_id::text<>m#>>'{activeChild,itemId}'
    or a.actor_id::text<>m#>>'{activeChild,actorId}' or a.intent_hash<>m#>>'{activeChild,intentHash}'
    or a.source_hash<>m#>>'{activeChild,sourceHash}' or a.configuration_hash<>m#>>'{activeChild,configurationHash}'
    or (m#>>'{activeChild,initialProviderCalls}')::integer>a.provider_calls
    or (m#>>'{activeChild,binding}'='attached' and (a.actor_id<>new.requested_by or a.provider<>new.provider or a.configuration_hash<>m->>'configurationHash'
      or a.provider_calls<>0 or (m#>>'{activeChild,initialProviderCalls}')::integer<>0
      or a.has_pending or a.catalog_source_hash<>m->'catalogSourceHashes'->>i.position
      or a.confirmed_cursor<>jsonb_build_object(case when new.kind='writer' then 'writerCursor' else 'countryCursor' end,(m->>'windowIndex')::integer*500+i.position+1)
      or a.current_cursor<>jsonb_build_object(case when new.kind='writer' then 'writerCursor' else 'countryCursor' end,(m->>'windowIndex')::integer*500+i.position))) then
    raise exception 'Invalid profile child attachment proof' using errcode='42501';end if;
  end if;
  if new_position>old_position then
   select staff_retry_receipt into r from public.translation_job_attempts where item_id=i.id and attempt_number=1;
   if i.id is null or i.status='reviewing' or r->>'type' is distinct from 'profile-scan-observation' or r->>'windowJobId'<>old.id::text
    or r->>'transitionId' is distinct from m#>>'{lastTransition,id}' or r->>'fingerprint' is distinct from m#>>'{lastTransition,fingerprint}'
    or m->'activeChild'<>'null'::jsonb then raise exception 'Profile advancement lacks logical observation' using errcode='42501';end if;
   if om->'activeChild'='null'::jsonb then
    select * into a from probpera_translation_operations.profile_scan_operation(new.kind,i.entity_id,null,true);
    if a.operation_id is not null then raise exception 'Active profile child cannot be skipped' using errcode='42501';end if;
   end if;
  end if;
  if (new_position>old_position or (om->'activeChild'='null'::jsonb and m->'activeChild'<>'null'::jsonb))
   and not probpera_translation_operations.profile_scan_predecessors_ready(new) then raise exception 'Prior profile window is unfinished' using errcode='42501';end if;
  return new;
 elsif tg_table_name='translation_job_items' then
  select * into j from public.translation_jobs where id=case when tg_op='INSERT' then new.job_id else old.job_id end;
  if not(j.resume_cursor?'profileScan') then return case when tg_op='DELETE' then old else new end;end if;
  if tg_op='DELETE' then raise exception 'Profile scan member history cannot be deleted' using errcode='42501';end if;
  if new.entity_type<>j.kind or new.position>=j.total_items or new.staff_retry is not null
   or new.lease_owner is not null or new.lease_expires_at is not null or new.status in ('queued','retry_wait','leased') or new.max_attempts<>1 then
   raise exception 'Profile scan member is not a lease/retry item' using errcode='42501';end if;
  perform probpera_translation_operations.profile_scan_record(j.kind,new.entity_id,j.resume_cursor->'profileScan'->'catalogSourceHashes'->>new.position);
  if tg_op='INSERT' then
   if new.status<>'reviewing' or new.attempt_count<>0 then raise exception 'Profile member must start pending' using errcode='42501';end if;
  elsif to_jsonb(new) is distinct from to_jsonb(old) then
   if old.status<>'reviewing' or new.status='reviewing' or new.attempt_count<>1
    or (to_jsonb(new)-array['status','attempt_count','source_hash','last_error_code','updated_at'])<>(to_jsonb(old)-array['status','attempt_count','source_hash','last_error_code','updated_at'])
    or not exists(select 1 from public.translation_job_attempts t where t.item_id=new.id and t.attempt_number=1 and t.staff_retry_receipt->>'type'='profile-scan-observation'
      and t.staff_retry_receipt->>'windowJobId'=new.job_id::text) then
    raise exception 'Profile member outcome/history is immutable' using errcode='42501';end if;
  end if;
  return new;
 else
  select * into i from public.translation_job_items where id=case when tg_op='INSERT' then new.item_id else old.item_id end;
  select * into j from public.translation_jobs where id=i.job_id;
  if not(j.resume_cursor?'profileScan') then return case when tg_op='DELETE' then old else new end;end if;
  if tg_op<>'INSERT' then raise exception 'Profile observation history is immutable' using errcode='42501';end if;
  r:=new.staff_retry_receipt;
  if not premium_translation_private.exact_object(r,array['version','type','scanId','windowJobId','itemId','position','entityId','kind','catalogSourceHash','transitionId','fingerprint','classification','state','errorCode','sourceHash','providerCalls','child'])
   or r->'version'<>'1'::jsonb or r->>'type'<>'profile-scan-observation' or r->'providerCalls'<>'0'::jsonb or r->>'scanId'<>j.resume_cursor#>>'{profileScan,scanId}'
   or r->>'windowJobId'<>j.id::text or r->>'itemId'<>i.id::text or r->>'entityId'<>i.entity_id or r->>'kind'<>j.kind or r->'catalogSourceHash' is distinct from j.resume_cursor->'profileScan'->'catalogSourceHashes'->i.position or (r->>'position')::integer<>i.position
   or r->>'transitionId' is distinct from new.staff_retry_operation_id::text or new.attempt_number<>1 or new.outcome<>'skipped' or new.provider<>j.provider
   or new.model is not null or new.provider_request_id is not null or new.error_code is not null or new.input_tokens is not null or new.output_tokens is not null or new.duration_ms is not null
   or i.status<>'reviewing' or i.position<>(j.resume_cursor#>>'{profileScan,nextPosition}')::integer then
   raise exception 'Invalid zero-provider profile observation' using errcode='42501';end if;
  return new;
 end if;
end; $$;

-- One guard body is attached separately to the existing writer and country
-- artifact caches. Only a NEW reservation is checked; responses and FINISH keep
-- accepted output after stop. Ordinary unrelated operations are unchanged.
create function probpera_translation_operations.profile_scan_dispatch_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare j public.translation_jobs%rowtype;i public.translation_job_items%rowtype;m jsonb;kind text;
begin
 if jsonb_array_length(new.calls)<=jsonb_array_length(old.calls) then return new;end if;
 if tg_table_name='writer_operation_artifacts' then kind:='writer';
 else if new.entity_type<>'country' then return new;end if;kind:='country';end if;
 select * into j from public.translation_jobs where resume_cursor#>>'{profileScan,activeChild,binding}'='attached'
  and resume_cursor#>>'{profileScan,activeChild,operationId}'=new.operation_id::text for update;
 if j.id is null then return new;end if;
 m:=j.resume_cursor->'profileScan';select * into i from public.translation_job_items where job_id=j.id and position=(m->>'nextPosition')::integer;
 if j.kind<>kind or j.cancel_requested_at is not null or j.status in ('cancelled','cancelling') or j.status<>'reviewing' or i.id is null or i.status<>'reviewing'
  or i.entity_id<>new.entity_id or new.actor_id<>j.requested_by or new.provider<>j.provider or new.configuration_hash<>m->>'configurationHash'
  or new.source_revision->>'catalogSourceHash'<>m->'catalogSourceHashes'->>i.position
  or m#>>'{activeChild,jobId}'<>new.job_id::text or m#>>'{activeChild,itemId}'<>new.item_id::text or m#>>'{activeChild,intentHash}'<>new.intent_hash
  or not probpera_translation_operations.profile_scan_predecessors_ready(j) then raise exception 'Attached profile scan stopped before dispatch' using errcode='40001';end if;
 return new;
end; $$;

create trigger translation_jobs_profile_scan_integrity before insert or update or delete on public.translation_jobs
 for each row execute function probpera_translation_operations.profile_scan_guard();
create trigger translation_items_profile_scan_integrity before insert or update or delete on public.translation_job_items
 for each row execute function probpera_translation_operations.profile_scan_guard();
create trigger translation_attempts_profile_scan_integrity before insert or update or delete on public.translation_job_attempts
 for each row execute function probpera_translation_operations.profile_scan_guard();
-- ONLY job INSERT, maximum20 events per manifest. Never10000 item events.
create constraint trigger translation_profile_scan_committed_chain after insert on public.translation_jobs
 deferrable initially deferred for each row execute function probpera_translation_operations.profile_scan_insert_chain_guard();
create trigger writer_operation_profile_scan_dispatch before update on premium_translation_private.writer_operation_artifacts
 for each row execute function probpera_translation_operations.profile_scan_dispatch_guard();
create trigger catalog_operation_profile_scan_dispatch before update on premium_translation_private.catalog_operation_artifacts
 for each row execute function probpera_translation_operations.profile_scan_dispatch_guard();

revoke all on function probpera_translation_operations.profile_scan_configuration_valid(text,jsonb),
 probpera_translation_operations.profile_scan_record(text,text,text),probpera_translation_operations.profile_scan_manifest_valid(text,jsonb),
 probpera_translation_operations.profile_scan_marker_valid(jsonb),probpera_translation_operations.profile_scan_operation(text,text,uuid,boolean),
 probpera_translation_operations.profile_scan_entity_lock(text,text),probpera_translation_operations.profile_scan_link(jsonb,text),
 probpera_translation_operations.profile_scan_access(uuid,boolean),probpera_translation_operations.profile_scan_predecessors_ready(public.translation_jobs),
 probpera_translation_operations.profile_scan_status(uuid),
 probpera_translation_operations.profile_scan_assert_chain(uuid),probpera_translation_operations.profile_scan_insert_chain_guard(),
 probpera_translation_operations.profile_scan_view(public.translation_jobs,boolean,text),probpera_translation_operations.profile_scan_guard(),
 probpera_translation_operations.profile_scan_dispatch_guard() from public,anon,authenticated,service_role;

revoke all on function public.begin_profile_translation_scan(uuid,text,jsonb,jsonb),public.get_profile_translation_scan(uuid),
 public.attach_profile_translation_scan_operation(uuid,bigint,uuid,uuid,uuid,uuid,text,uuid),
 public.checkpoint_profile_translation_scan_item(uuid,bigint,uuid,uuid,jsonb,uuid),public.continue_profile_translation_scan(uuid,bigint,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.begin_profile_translation_scan(uuid,text,jsonb,jsonb),public.get_profile_translation_scan(uuid),
 public.attach_profile_translation_scan_operation(uuid,bigint,uuid,uuid,uuid,uuid,text,uuid),
 public.checkpoint_profile_translation_scan_item(uuid,bigint,uuid,uuid,jsonb,uuid),public.continue_profile_translation_scan(uuid,bigint,jsonb) to authenticated;
commit;
