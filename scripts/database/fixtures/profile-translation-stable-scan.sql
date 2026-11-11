-- Isolated PG17 profile-scan protocol fixture; synthetic Auth/catalog rows.
-- Synthetic owned PG17 only; actual existing journal/private admission functions.
reset role;
create table public.profile_scan_fixture_results(label text primary key,value jsonb not null);
alter table public.profile_scan_fixture_results enable row level security;
create policy profile_scan_fixture_staff on public.profile_scan_fixture_results for all to authenticated using(public.is_staff()) with check(public.is_staff());
grant select,insert,update on public.profile_scan_fixture_results to authenticated;
create table public.profile_scan_fixture_wire(id uuid primary key default gen_random_uuid(),at_time timestamptz default clock_timestamp(),rpc text,args jsonb,response jsonb);
alter table public.profile_scan_fixture_wire enable row level security;
create policy profile_scan_wire_staff on public.profile_scan_fixture_wire for all to authenticated using(public.is_staff()) with check(public.is_staff());
grant select,insert on public.profile_scan_fixture_wire to authenticated;
create function public.profile_scan_fixture_call(name text,args jsonb)
returns jsonb language plpgsql set search_path='' as $$ declare r jsonb;begin
 case name
 when 'begin_profile_translation_scan' then r:=public.begin_profile_translation_scan((args->>'p_scan_id')::uuid,args->>'p_kind',args->'p_configuration',args->'p_manifest');
 when 'get_profile_translation_scan' then r:=public.get_profile_translation_scan((args->>'p_job_id')::uuid);
 when 'attach_profile_translation_scan_operation' then r:=public.attach_profile_translation_scan_operation((args->>'p_window_job_id')::uuid,(args->>'p_expected_version')::bigint,(args->>'p_item_id')::uuid,(args->>'p_operation_job_id')::uuid,(args->>'p_operation_item_id')::uuid,(args->>'p_operation_id')::uuid,args->>'p_intent_hash',(args->>'p_transition_id')::uuid);
 when 'checkpoint_profile_translation_scan_item' then r:=public.checkpoint_profile_translation_scan_item((args->>'p_window_job_id')::uuid,(args->>'p_expected_version')::bigint,(args->>'p_item_id')::uuid,(args->>'p_transition_id')::uuid,args->'p_observation',(args->>'p_operation_id')::uuid);
 when 'continue_profile_translation_scan' then r:=public.continue_profile_translation_scan((args->>'p_window_job_id')::uuid,(args->>'p_expected_version')::bigint,args->'p_configuration');
 else raise exception 'Unknown fixture RPC' using errcode='22023';end case;
 insert into public.profile_scan_fixture_wire(rpc,args,response) values(name,args,r);return r;
end; $$;
create function public.profile_scan_fixture_config(kind text)
returns jsonb language sql immutable set search_path='' as $$
 select case kind when 'writer' then public.writer_operation_fixture_config() else public.catalog_fixture_config('country',true) end;
$$;
create function public.profile_scan_fixture_manifest(kind text,n integer)
returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('countryId',case when kind='writer' then 'profile-country' else 'profile-country-'||idx end,
  'catalogSourceHash',repeat('b',64))||case when kind='writer' then jsonb_build_object('writerId','profile-writer-'||idx) else '{}' end order by idx),'[]')
 from generate_series(1,n) idx;
$$;
create function public.profile_scan_fixture_begin(kind text,manifest jsonb,scan_id uuid default gen_random_uuid())
returns jsonb language sql set search_path='' as $$
 select public.profile_scan_fixture_call('begin_profile_translation_scan',jsonb_build_object('p_scan_id',scan_id,'p_kind',kind,'p_configuration',public.profile_scan_fixture_config(kind),'p_manifest',manifest));
$$;
create function public.profile_scan_fixture_free(r jsonb,state text default 'manual',reason text default null,transition_id uuid default gen_random_uuid())
returns jsonb language sql set search_path='' as $$
 select public.checkpoint_profile_translation_scan_item((r->>'jobId')::uuid,(r->>'jobVersion')::bigint,
 (r->'members'->(r->>'nextPosition')::integer->>'itemId')::uuid,transition_id,jsonb_build_object('version',1,'type','free','state',state,'reason',reason,'sourceHash',null),null);
$$;
create function public.profile_scan_fixture_attach(r jsonb,child jsonb,transition_id uuid default gen_random_uuid())
returns jsonb language sql set search_path='' as $$
 select public.profile_scan_fixture_call('attach_profile_translation_scan_operation',jsonb_build_object('p_window_job_id',r->'jobId','p_expected_version',r->'jobVersion',
 'p_item_id',r->'members'->(r->>'nextPosition')::integer->'itemId','p_operation_job_id',child->'jobId','p_operation_item_id',child->'itemId','p_operation_id',child->'operationId',
 'p_intent_hash',child->'intentHash','p_transition_id',transition_id));
$$;
create function public.profile_scan_fixture_checkpoint_child(r jsonb,child jsonb,transition_id uuid default gen_random_uuid())
returns jsonb language sql set search_path='' as $$
 select public.profile_scan_fixture_call('checkpoint_profile_translation_scan_item',jsonb_build_object('p_window_job_id',r->'jobId','p_expected_version',r->'jobVersion',
 'p_item_id',r->'members'->(r->>'nextPosition')::integer->'itemId','p_transition_id',transition_id,'p_observation',jsonb_build_object('version',1,'type','child-terminal'),'p_operation_id',child->'operationId'));
$$;
create function public.profile_scan_fixture_seed(kind text,tag text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare a jsonb;fields jsonb;entity text;begin
 if kind='country' then return public.catalog_fixture_seed('country','profile-'||tag,true)||'{"currentCursor":{"countryCursor":0},"resumeCursor":{"countryCursor":1}}';end if;
 entity:='profile-country:'||tag||'-writer';fields:=public.writer_private_fixture_catalog()||'{"authorProfileRights":"KEEP ALL EXACT"}';
 insert into public.writer_profile_overrides(country_id,writer_id,fields,is_enabled,updated_at) values('profile-country',tag||'-writer',fields,false,'2026-10-01T10:00:00.123456Z');
 a:=public.writer_private_fixture_args(entity);
 return a||jsonb_build_object('entityType','writer','entityId',entity,'expectedOverrideFields',fields,'configuration',public.writer_operation_fixture_config(),
 'currentCursor',jsonb_build_object('writerCursor',0),'resumeCursor',jsonb_build_object('writerCursor',1));
end; $$;
create function public.profile_scan_fixture_member(kind text,a jsonb)
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_array(case kind when 'writer' then jsonb_build_object('countryId',a#>'{sourceRevision,countryId}','writerId',a#>'{sourceRevision,writerId}',
 'catalogSourceHash',a#>'{sourceRevision,catalogSourceHash}') else jsonb_build_object('countryId',a->'entityId','catalogSourceHash',a#>'{sourceRevision,catalogSourceHash}') end);
$$;
create function public.profile_scan_fixture_paid_begin(kind text,a jsonb)
returns jsonb language plpgsql set search_path='' as $$ begin
 if kind='country' then return public.catalog_fixture_begin(a);end if;
 return public.begin_writer_translation_operation(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),a#>>'{sourceRevision,countryId}',a#>>'{sourceRevision,writerId}','cloudflare',
 a->>'sourceHash',a->'source',a->'sourceRevision',a->'targetRevision',a->'expectedOverrideFields',a->'configuration',a->'currentCursor',a->'resumeCursor');
end; $$;
create function public.profile_scan_fixture_pass(kind text,r jsonb,pass text,payload jsonb)
returns jsonb language plpgsql set search_path='' as $$ begin
 if kind='country' then return public.catalog_fixture_pass(r,pass,payload);end if;
 return public.writer_operation_fixture_response(public.writer_operation_fixture_dispatch(r,pass));
end; $$;
create function public.profile_scan_fixture_finish(kind text,r jsonb,payload jsonb)
returns jsonb language plpgsql set search_path='' as $$ begin
 if kind='country' then return public.catalog_fixture_finish(r,payload);end if;
 return public.writer_operation_fixture_finish(r);
end; $$;
create function public.profile_scan_fixture_dispatch(kind text,r jsonb)
returns jsonb language plpgsql set search_path='' as $$ begin
 if kind='writer' then return public.writer_operation_fixture_dispatch(r,'translation');end if;
 return public.record_catalog_translation_operation_dispatch((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,gen_random_uuid(),'cloudflare','fixture-translator','translation',repeat('c',64));
end; $$;

-- Empty scans are explicit exhaustion, idempotent and do not create more jobs.
do $$ declare kind text;r jsonb;again jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);set local role authenticated;
 foreach kind in array array['writer','country'] loop
  r:=public.profile_scan_fixture_begin(kind,'[]');
  assert r->'totalMembership'='0'::jsonb and r->'windowCount'='1'::jsonb and r->'exhausted'='true'::jsonb and r->'members'='[]'::jsonb;
  again:=public.continue_profile_translation_scan((r->>'jobId')::uuid,1,public.profile_scan_fixture_config(kind));
  assert again->>'jobId'=r->>'jobId' and again->>'transition'='exhausted';
  insert into public.profile_scan_fixture_results values('empty-'||kind,r);
 end loop;reset role;
end; $$;

-- Eager501: frozen successor exists immediately but cannot consume before500.
do $$ declare r jsonb;initial jsonb;successor jsonb;again jsonb;manifest jsonb;idx integer;root_id uuid:=gen_random_uuid();begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);manifest:=public.profile_scan_fixture_manifest('country',501);set local role authenticated;
 r:=public.profile_scan_fixture_begin('country',manifest,root_id);initial:=r;
 assert r->'totalItems'='500'::jsonb and r->'windowCount'='2'::jsonb and r->'successorJobId'<>'null'::jsonb;
 successor:=public.profile_scan_fixture_call('get_profile_translation_scan',jsonb_build_object('p_job_id',r->'successorJobId'));
 assert successor->'totalItems'='1'::jsonb and successor->'windowIndex'='1'::jsonb and successor->'nextPosition'='0'::jsonb;
 perform public.premium_fixture_error(format('select public.profile_scan_fixture_free(%L::jsonb)',successor),'40001');
 assert public.continue_profile_translation_scan(root_id,1,public.profile_scan_fixture_config('country'))->>'jobId'=root_id::text;
 assert public.begin_profile_translation_scan(root_id,'country',public.profile_scan_fixture_config('country'),manifest)->'replayed'='true'::jsonb;
 perform public.premium_fixture_error(format('select public.begin_profile_translation_scan(%L,''country'',public.profile_scan_fixture_config(''country''),%L::jsonb)',root_id,manifest||'[ {"countryId":"changed-tail","catalogSourceHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}]'),'40001');
 for idx in 1..500 loop r:=public.profile_scan_fixture_free(r);end loop;
 assert r->'nextPosition'='500'::jsonb and r->'exhausted'='false'::jsonb and r->>'successorJobId'=initial->>'successorJobId';
 successor:=public.profile_scan_fixture_call('continue_profile_translation_scan',jsonb_build_object('p_window_job_id',root_id,'p_expected_version',r->'jobVersion','p_configuration',public.profile_scan_fixture_config('country')));
 again:=public.continue_profile_translation_scan(root_id,1,public.profile_scan_fixture_config('country'));
 assert successor->>'jobId'=initial->>'successorJobId' and again->>'jobId'=successor->>'jobId';
 successor:=public.profile_scan_fixture_free(successor);
 assert successor->'exhausted'='true'::jsonb and successor->'nextPosition'='1'::jsonb;
 insert into public.profile_scan_fixture_results values('eager-501',jsonb_build_object('initial',initial,'completedFirst',r,'completedSuccessor',successor));
 reset role;
 assert (select count(*)=2 from public.translation_jobs where resume_cursor#>>'{profileScan,scanId}'=root_id::text);
 assert (select count(*)=501 and bool_and(model is null and provider_request_id is null and input_tokens is null and output_tokens is null and staff_retry_receipt->'providerCalls'='0'::jsonb)
  from public.translation_job_attempts where item_id in(select id from public.translation_job_items where job_id in(select id from public.translation_jobs where resume_cursor#>>'{profileScan,scanId}'=root_id::text)));
end; $$;

-- Full bounded10000 manifest produces20 windows atomically; never10000 jobs.
do $$ declare r jsonb;manifest jsonb;stamp timestamptz:=clock_timestamp();begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);manifest:=public.profile_scan_fixture_manifest('writer',10000);set local role authenticated;
 r:=public.begin_profile_translation_scan(gen_random_uuid(),'writer',public.profile_scan_fixture_config('writer'),manifest);
 reset role;
 assert (select count(*)=20 and sum(total_items)=10000 and max(total_items)=500 from public.translation_jobs where resume_cursor#>>'{profileScan,scanId}'=r->>'scanId');
 assert (select count(*)=10000 from public.translation_job_items where job_id in(select id from public.translation_jobs where resume_cursor#>>'{profileScan,scanId}'=r->>'scanId'));
 assert (select tgdeferrable and tginitdeferred and tgtype=5 from pg_trigger where tgname='translation_profile_scan_committed_chain');
 insert into public.profile_scan_fixture_results values('eager-10000',jsonb_build_object('rootId',r->'scanId','windows',20,'members',10000,'beginElapsedMs',extract(epoch from(clock_timestamp()-stamp))*1000,'deferredJobInsertEvents',20,'itemDeferredEvents',0));
end; $$;

-- Reject malformed/overflow/duplicate manifest before any new job is written.
do $$ declare kind text;manifest jsonb;before_count bigint;bad jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);select count(*) into before_count from public.translation_jobs;
 set local role authenticated;
 foreach kind in array array['country','writer'] loop
  manifest:=public.profile_scan_fixture_manifest(kind,1);
  perform public.premium_fixture_error(format('select public.begin_profile_translation_scan(gen_random_uuid(),%L,public.profile_scan_fixture_config(%L),%L::jsonb)',kind,kind,manifest||manifest),'22023');
  perform public.premium_fixture_error(format('select public.begin_profile_translation_scan(gen_random_uuid(),%L,public.profile_scan_fixture_config(%L),%L::jsonb)',kind,kind,public.profile_scan_fixture_manifest(kind,10001)),'22023');
  bad:=jsonb_set(manifest,'{0,catalogSourceHash}','"forged"');
  perform public.premium_fixture_error(format('select public.begin_profile_translation_scan(gen_random_uuid(),%L,public.profile_scan_fixture_config(%L),%L::jsonb)',kind,kind,bad),'22023');
 end loop;
 select jsonb_agg(jsonb_build_object('countryId',repeat('c',119),'writerId',lpad(idx::text,6,'0')||repeat('😀',174),'catalogSourceHash',repeat('b',64))) into manifest from generate_series(1,10000) idx;
 assert octet_length(manifest::text)>4194304;
 perform public.premium_fixture_error(format('select public.begin_profile_translation_scan(gen_random_uuid(),''writer'',public.profile_scan_fixture_config(''writer''),%L::jsonb)',manifest),'22023');
 manifest:=jsonb_build_array(jsonb_build_object('countryId',repeat('😀',60),'catalogSourceHash',repeat('b',64)));
 assert public.begin_profile_translation_scan(gen_random_uuid(),'country',public.profile_scan_fixture_config('country'),manifest)->'totalItems'='1'::jsonb;
 bad:=jsonb_set(manifest,'{0,countryId}',to_jsonb(repeat('😀',61)));
 perform public.premium_fixture_error(format('select public.begin_profile_translation_scan(gen_random_uuid(),''country'',public.profile_scan_fixture_config(''country''),%L::jsonb)',bad),'22023');
 manifest:=jsonb_build_array(jsonb_build_object('countryId','profile-country','writerId',repeat('😀',180),'catalogSourceHash',repeat('b',64)),
 jsonb_build_object('countryId','second-country','writerId',repeat('😀',180),'catalogSourceHash',repeat('b',64)));
 assert public.begin_profile_translation_scan(gen_random_uuid(),'writer',public.profile_scan_fixture_config('writer'),manifest)->'totalItems'='2'::jsonb;
 reset role;assert (select count(*)=before_count+2 from public.translation_jobs);
 insert into public.profile_scan_fixture_results values('bounds-and-exact-tuples','{"invalidWrites":0,"countryUtf16":120,"writerCodePoints":180,"sameWriterDifferentCountry":true}');
end; $$;

-- A real zero-call child cannot attach directly to a preallocated future UUID.
do $$ declare a jsonb;r jsonb;future jsonb;child jsonb;manifest jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 a:=public.profile_scan_fixture_seed('country','future')||'{"currentCursor":{"countryCursor":500},"resumeCursor":{"countryCursor":501}}';
 manifest:=public.profile_scan_fixture_manifest('country',500)||public.profile_scan_fixture_member('country',a);set local role authenticated;
 r:=public.profile_scan_fixture_begin('country',manifest);future:=public.get_profile_translation_scan((r->>'successorJobId')::uuid);child:=public.profile_scan_fixture_paid_begin('country',a);
 perform public.premium_fixture_error(format('select public.profile_scan_fixture_attach(%L::jsonb,%L::jsonb)',future,child),'40001');
 assert public.get_profile_translation_scan((future->>'jobId')::uuid)->'nextPosition'='0'::jsonb;
 assert public.get_catalog_translation_operation_artifacts((child->>'jobId')::uuid,(child->>'itemId')::uuid,(child->>'operationId')::uuid,'country',child->>'entityId',child->>'intentHash',child->>'sourceHash')->'calls'='[]'::jsonb;
 insert into public.profile_scan_fixture_results values('future-attach-refused',jsonb_build_object('rootId',r->'jobId','futureId',future->'jobId','child',child,'providerCalls',0));reset role;
end; $$;

-- Deferred job-INSERT proof rejects an incomplete eager chain and rolls back it.
-- No construction GUC, disabled trigger or source/routine replacement is used.
do $$ declare original public.translation_jobs%rowtype;forged_id uuid:=gen_random_uuid();marker jsonb;rejected boolean:=false;begin
 select * into original from public.translation_jobs where resume_cursor#>>'{profileScan,windowIndex}'='0' and resume_cursor#>>'{profileScan,totalMembership}'='501' limit 1;
 marker:=original.resume_cursor->'profileScan'||jsonb_build_object('scanId',forged_id,'nextPosition',0,'exhausted',false,'activeChild',null,'lastTransition',null,'successorJobId',gen_random_uuid());
 begin
  insert into public.translation_jobs(id,kind,provider,status,total_items,succeeded_items,failed_items,requested_by,started_at,version,resume_cursor)
   values(forged_id,original.kind,original.provider,'reviewing',500,0,0,original.requested_by,clock_timestamp(),1,jsonb_build_object('profileScan',marker));
  set constraints public.translation_profile_scan_committed_chain immediate;
 exception when insufficient_privilege then rejected:=true;
 end;
 assert rejected and not exists(select 1 from public.translation_jobs where id=forged_id);
 insert into public.profile_scan_fixture_results values('deferred-forged-chain-rollback',jsonb_build_object('rejected',true,'rowsAfter',0,'gucBypass',false));
end; $$;

-- Exact old writer/country native paid callbacks and one zero-expense parent result.
do $$ declare kind text;a jsonb;r jsonb;attached jsonb;child jsonb;done jsonb;before_row jsonb;after_row jsonb;transition_id uuid;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach kind in array array['writer','country'] loop
  a:=public.profile_scan_fixture_seed(kind,'normal');
  if kind='writer' then select to_jsonb(w) into before_row from public.writer_profile_overrides w where country_id='profile-country' and writer_id='normal-writer';
  else select to_jsonb(c) into before_row from public.country_profile_overrides c where country_id=a->>'entityId';end if;
  set local role authenticated;
  r:=public.profile_scan_fixture_begin(kind,public.profile_scan_fixture_member(kind,a));child:=public.profile_scan_fixture_paid_begin(kind,a);transition_id:=gen_random_uuid();
  attached:=public.profile_scan_fixture_attach(r,child,transition_id);
  assert attached->>'transition'='attached' and attached#>>'{child,binding}'='attached' and attached#>'{child,receipt,canExecute}'='false'::jsonb;
  assert public.profile_scan_fixture_attach(r,child,transition_id)->'replayed'='true'::jsonb;
  child:=public.profile_scan_fixture_pass(kind,child,'translation',a->'payload');child:=public.profile_scan_fixture_pass(kind,child,'review',a->'payload');done:=public.profile_scan_fixture_finish(kind,child,a->'payload');
  r:=public.profile_scan_fixture_checkpoint_child(attached,done);assert r->'exhausted'='true'::jsonb and r->'nextPosition'='1'::jsonb and r->'child'='null'::jsonb;
  insert into public.profile_scan_fixture_results values('paid-normal-'||kind,jsonb_build_object('attached',attached,'finished',r,'child',done));reset role;
  if kind='writer' then select to_jsonb(w) into after_row from public.writer_profile_overrides w where country_id='profile-country' and writer_id='normal-writer';
  else select to_jsonb(c) into after_row from public.country_profile_overrides c where country_id=a->>'entityId';end if;
  assert before_row=after_row;
  assert (select count(*)=1 and bool_and(staff_retry_receipt->'providerCalls'='0'::jsonb and model is null and provider_request_id is null and input_tokens is null and output_tokens is null)
   from public.translation_job_attempts where item_id=(r#>>'{members,0,itemId}')::uuid);
 end loop;
end; $$;

-- Existing calls are holds; actual terminal outcome advances once as free metadata.
do $$ declare kind text;a jsonb;r jsonb;child jsonb;held jsonb;done jsonb;transition_id uuid;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach kind in array array['writer','country'] loop
  a:=public.profile_scan_fixture_seed(kind,'observed');set local role authenticated;
  r:=public.profile_scan_fixture_begin(kind,public.profile_scan_fixture_member(kind,a));child:=public.profile_scan_fixture_paid_begin(kind,a);
  child:=public.profile_scan_fixture_pass(kind,child,'translation',a->'payload');held:=public.profile_scan_fixture_attach(r,child);
  assert held#>>'{child,binding}'='observed-blocked' and held->>'transition'='held';
  child:=public.profile_scan_fixture_pass(kind,child,'review',a->'payload');done:=public.profile_scan_fixture_finish(kind,child,a->'payload');transition_id:=gen_random_uuid();
  r:=public.profile_scan_fixture_checkpoint_child(held,done,transition_id);
  assert r->'nextPosition'='1'::jsonb and r->'child'='null'::jsonb;
  assert public.profile_scan_fixture_checkpoint_child(held,done,transition_id)->'replayed'='true'::jsonb;
  insert into public.profile_scan_fixture_results values('observed-terminal-'||kind,jsonb_build_object('held',held,'finished',r));reset role;
  assert (select staff_retry_receipt->>'classification'='existing-resolved' and staff_retry_receipt->'providerCalls'='0'::jsonb from public.translation_job_attempts where item_id=(r#>>'{members,0,itemId}')::uuid);
 end loop;
end; $$;

-- Unknown dispatch pins membership even after underlying source rows disappear.
do $$ declare kind text;a jsonb;r jsonb;child jsonb;held jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach kind in array array['writer','country'] loop
  a:=public.profile_scan_fixture_seed(kind,'unknown');set local role authenticated;
  r:=public.profile_scan_fixture_begin(kind,public.profile_scan_fixture_member(kind,a));child:=public.profile_scan_fixture_paid_begin(kind,a);r:=public.profile_scan_fixture_attach(r,child);
  child:=public.profile_scan_fixture_dispatch(kind,child);reset role;
  if kind='writer' then delete from public.writer_profile_overrides where country_id='profile-country' and writer_id='unknown-writer';
  else delete from public.country_profile_overrides where country_id=a->>'entityId';end if;
  set local role authenticated;held:=public.profile_scan_fixture_call('get_profile_translation_scan',jsonb_build_object('p_job_id',r->'jobId'));
  assert held#>>'{child,receipt,blockReason}'='provider_outcome_unknown' and held->'nextPosition'='0'::jsonb;
  assert public.profile_scan_fixture_free(held,'skipped','source_missing')->>'transition'='held';
  reset role;set local role service_role;
  perform public.premium_fixture_error(format('update public.translation_jobs set resume_cursor=jsonb_set(resume_cursor,''{profileScan,activeChild}'',''null''),version=version+1 where id=%L',r->>'jobId'),'42501');
  perform public.premium_fixture_error(format('delete from public.translation_jobs where id=%L',r->>'jobId'),'42501');
  perform public.premium_fixture_error(format('update public.translation_job_items set staff_retry=''{}'' where id=%L',r#>>'{members,0,itemId}'),'42501');
  reset role;insert into public.profile_scan_fixture_results values('unknown-source-missing-'||kind,jsonb_build_object('held',held,'child',child));
 end loop;
end; $$;

-- Zero-call cleanup happens in a separate transaction from parent consumption.
do $$ declare kind text;a jsonb;r jsonb;child jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach kind in array array['writer','country'] loop
  a:=public.profile_scan_fixture_seed(kind,'zero');set local role authenticated;
  r:=public.profile_scan_fixture_begin(kind,public.profile_scan_fixture_member(kind,a));child:=public.profile_scan_fixture_paid_begin(kind,a);r:=public.profile_scan_fixture_attach(r,child);
  insert into public.profile_scan_fixture_results values('zero-setup-'||kind,jsonb_build_object('scan',r,'child',child));reset role;
 end loop;
end; $$;
do $$ declare kind text;child jsonb;done jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach kind in array array['writer','country'] loop
  select value->'child' into child from public.profile_scan_fixture_results where label='zero-setup-'||kind;set local role authenticated;
  if kind='writer' then done:=public.finish_writer_translation_operation((child->>'jobId')::uuid,(child->>'itemId')::uuid,(child->>'operationId')::uuid,'{"status":"skipped","providerCalls":0}',null);
  else done:=public.finish_catalog_translation_operation((child->>'jobId')::uuid,(child->>'itemId')::uuid,(child->>'operationId')::uuid,'{"status":"skipped","providerCalls":0}',null);end if;
  insert into public.profile_scan_fixture_results values('zero-finished-'||kind,done);reset role;
 end loop;
end; $$;
do $$ declare kind text;r jsonb;child jsonb;held jsonb;transition_id uuid;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach kind in array array['writer','country'] loop
  select value->'scan' into r from public.profile_scan_fixture_results where label='zero-setup-'||kind;
  select value into child from public.profile_scan_fixture_results where label='zero-finished-'||kind;set local role authenticated;transition_id:=gen_random_uuid();
  held:=public.profile_scan_fixture_checkpoint_child(r,child,transition_id);
  assert held->>'transition'='zero-call-held' and held->'nextPosition'='0'::jsonb and held->'child'='null'::jsonb;
  assert public.profile_scan_fixture_checkpoint_child(r,child,transition_id)->'replayed'='true'::jsonb;
  insert into public.profile_scan_fixture_results values('zero-held-'||kind,held);reset role;
  assert not exists(select 1 from public.translation_job_attempts where item_id=(r#>>'{members,0,itemId}')::uuid);
 end loop;
end; $$;

-- Fresh staff ownership and closed internal ACL, including status(uuid).
do $$ declare r jsonb;fn regprocedure;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);set local role authenticated;
 r:=public.profile_scan_fixture_begin('writer',public.profile_scan_fixture_manifest('writer',1));
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 perform public.premium_fixture_error(format('select public.get_profile_translation_scan(%L)',r->>'jobId'),'42501');
 perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 perform public.premium_fixture_error(format('select public.get_profile_translation_scan(%L)',r->>'jobId'),'42501');reset role;
 for fn in select oid::regprocedure from pg_proc where pronamespace='probpera_translation_operations'::regnamespace and proname like 'profile_scan_%' loop
  assert not has_function_privilege('anon',fn,'EXECUTE') and not has_function_privilege('authenticated',fn,'EXECUTE') and not has_function_privilege('service_role',fn,'EXECUTE');
 end loop;
 assert not has_function_privilege('anon','public.get_profile_translation_scan(uuid)','EXECUTE') and not has_function_privilege('service_role','public.get_profile_translation_scan(uuid)','EXECUTE');
 insert into public.profile_scan_fixture_results values('auth-acl','{"foreignDenied":true,"nonstaffDenied":true,"internalClosed":true}');
end; $$;
select 'M07_PROFILE_SCAN_NATIVE_CORE_PASS';

-- Immediate child/root proofs plus one root committed full-chain assertion.
-- Each deliberately malformed construction is contained in a subtransaction.
create function public.profile_scan_fixture_reject_eager_child(mode text)
returns boolean language plpgsql set search_path='' as $$
declare template public.translation_jobs%rowtype;root_id uuid:=gen_random_uuid();child_id uuid:=gen_random_uuid();
 root_marker jsonb;child_marker jsonb;child_kind text:='country';child_provider text:='cloudflare';child_actor uuid;
 child_total integer:=1;rejected boolean:=false;
begin
 select * into template from public.translation_jobs where resume_cursor#>>'{profileScan,windowIndex}'='0' and resume_cursor#>>'{profileScan,totalMembership}'='501' limit 1;
 child_actor:=template.requested_by;
 root_marker:=template.resume_cursor->'profileScan'||jsonb_build_object('scanId',root_id,'nextPosition',0,'exhausted',false,'activeChild',null,'lastTransition',null,'successorJobId',child_id);
 select resume_cursor->'profileScan' into child_marker from public.translation_jobs where id=(template.resume_cursor#>>'{profileScan,successorJobId}')::uuid;
 child_marker:=child_marker||jsonb_build_object('scanId',root_id,'predecessorJobId',root_id,'nextPosition',0,'exhausted',false,'activeChild',null,'lastTransition',null);
 case mode
 when 'without-root' then null;
 when 'outside-index' then child_marker:=child_marker||'{"windowIndex":2}';
 when 'root-configuration' then child_marker:=jsonb_set(child_marker,'{configurationHash}',to_jsonb(repeat('c',64)));
 when 'root-manifest' then child_marker:=jsonb_set(child_marker,'{fullManifestHash}',to_jsonb(repeat('c',64)));
 when 'root-kind' then child_kind:='writer';
 when 'root-provider' then child_provider:='openai';
 when 'root-actor' then child_actor:='22222222-2222-4222-8222-222222222222';
 when 'root-count' then child_total:=500;child_marker:=child_marker||jsonb_build_object('totalMembership',1001,'windowCount',3,'lastWindow',false,'successorJobId',gen_random_uuid(),'catalogSourceHashes',root_marker->'catalogSourceHashes');
 when 'wrong-predecessor' then child_marker:=jsonb_set(child_marker,'{predecessorJobId}',to_jsonb(gen_random_uuid()));
 when 'wrong-parent-pointer' then root_marker:=jsonb_set(root_marker,'{successorJobId}',to_jsonb(gen_random_uuid()));
 when 'missing-middle' then
  root_marker:=root_marker||jsonb_build_object('totalMembership',1001,'windowCount',3,'successorJobId',gen_random_uuid());
  child_marker:=child_marker||jsonb_build_object('totalMembership',1001,'windowCount',3,'windowIndex',2,'predecessorJobId',root_marker->'successorJobId');
 when 'missing-last' then null;
 when 'missing-members' then null;
 when 'committed-additional' then
  root_id:=template.id;child_marker:=child_marker||jsonb_build_object('scanId',root_id,'predecessorJobId',root_id);
 else raise exception 'Unknown native malformed eager case';end case;
 begin
  if mode not in ('without-root','committed-additional') then
   insert into public.translation_jobs(id,kind,provider,status,total_items,succeeded_items,failed_items,requested_by,started_at,version,resume_cursor)
    values(root_id,'country','cloudflare','reviewing',500,0,0,template.requested_by,clock_timestamp(),1,jsonb_build_object('profileScan',root_marker));
  end if;
  if mode<>'missing-last' then
   insert into public.translation_jobs(id,kind,provider,status,total_items,succeeded_items,failed_items,requested_by,started_at,version,resume_cursor)
    values(child_id,child_kind,child_provider,'reviewing',child_total,0,0,child_actor,clock_timestamp(),1,jsonb_build_object('profileScan',child_marker));
  end if;
  set constraints public.translation_profile_scan_committed_chain immediate;
 exception when insufficient_privilege then rejected:=true;
 end;
 assert rejected and not exists(select 1 from public.translation_jobs where id=child_id);
 if mode<>'committed-additional' then assert not exists(select 1 from public.translation_jobs where id=root_id);end if;
 return true;
end; $$;
do $$ declare mode text;cases jsonb:='[]';before_count bigint;r jsonb;rejected boolean:=false;root_id uuid;begin
 foreach mode in array array['without-root','outside-index','root-configuration','root-manifest','root-kind','root-provider','root-actor','root-count','wrong-predecessor','wrong-parent-pointer','missing-middle','missing-last','missing-members','committed-additional'] loop
  assert public.profile_scan_fixture_reject_eager_child(mode);cases:=cases||to_jsonb(mode);
 end loop;
 select count(*) into before_count from public.translation_jobs;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 begin
  set constraints public.translation_profile_scan_committed_chain immediate;
  perform public.begin_profile_translation_scan(gen_random_uuid(),'country',public.profile_scan_fixture_config('country'),public.profile_scan_fixture_manifest('country',2));
 exception when insufficient_privilege then rejected:=true;
 end;
 assert rejected and (select count(*)=before_count from public.translation_jobs);
 set constraints public.translation_profile_scan_committed_chain deferred;
 set local role authenticated;
 r:=public.profile_scan_fixture_begin('country',public.profile_scan_fixture_manifest('country',2));
 set constraints public.translation_profile_scan_committed_chain immediate;
 assert r->'totalItems'='2'::jsonb;reset role;
 select id into root_id from public.translation_jobs where resume_cursor#>>'{profileScan,windowIndex}'='0' and resume_cursor#>>'{profileScan,totalMembership}'='501' limit 1;
 perform public.premium_fixture_error(format('delete from public.translation_jobs where id=%L',root_id),'42501');
 perform public.premium_fixture_error(format('delete from public.translation_jobs where id=(select (resume_cursor#>>''{profileScan,successorJobId}'')::uuid from public.translation_jobs where id=%L)',root_id),'42501');
 perform public.premium_fixture_error(format('update public.translation_jobs set resume_cursor=jsonb_set(resume_cursor,''{profileScan,fullManifestHash}'',to_jsonb(repeat(''c'',64))),version=version+1 where id=%L',root_id),'42501');
 insert into public.profile_scan_fixture_results values('eager-root-child-forgeries',jsonb_build_object('rejected',cases,'allRolledBack',true,'setImmediateBeforeCompleteRejected',true,'setImmediateAfterCompletePassed',true,'committedDeleteAndReplacementDenied',true));
end; $$;
select 'M07_PROFILE_SCAN_EAGER_ROOT_AND_CHILD_PROOFS_PASS';
