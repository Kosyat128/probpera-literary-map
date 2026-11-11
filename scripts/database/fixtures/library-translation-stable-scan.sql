-- Actual isolated PG17 library-window protocol. Synthetic rows/Auth only.
-- Builder prepends verified unchanged canonical/operations/private/native SQL.
reset role;
create table public.library_scan_fixture_results(label text primary key,value jsonb not null);
alter table public.library_scan_fixture_results enable row level security;
create policy library_scan_fixture_staff on public.library_scan_fixture_results for all to authenticated using(public.is_staff()) with check(public.is_staff());
grant select,insert,update on public.library_scan_fixture_results to authenticated;
create table public.library_scan_fixture_wire(id uuid primary key default gen_random_uuid(),at_time timestamptz default clock_timestamp(),rpc text,args jsonb,response jsonb);
alter table public.library_scan_fixture_wire enable row level security;
create policy library_scan_wire_staff on public.library_scan_fixture_wire for all to authenticated using(public.is_staff()) with check(public.is_staff());
grant select,insert on public.library_scan_fixture_wire to authenticated;
create function public.library_scan_fixture_call(name text,args jsonb)
returns jsonb language plpgsql set search_path='' as $$ declare r jsonb;begin
 case name
 when 'begin_library_translation_scan' then r:=public.begin_library_translation_scan((args->>'p_scan_id')::uuid,args->'p_configuration');
 when 'get_library_translation_scan' then r:=public.get_library_translation_scan((args->>'p_job_id')::uuid);
 when 'attach_library_translation_scan_operation' then r:=public.attach_library_translation_scan_operation((args->>'p_window_job_id')::uuid,(args->>'p_expected_version')::bigint,(args->>'p_item_id')::uuid,(args->>'p_operation_job_id')::uuid,(args->>'p_operation_item_id')::uuid,(args->>'p_operation_id')::uuid,args->>'p_intent_hash',(args->>'p_transition_id')::uuid);
 when 'checkpoint_library_translation_scan_item' then r:=public.checkpoint_library_translation_scan_item((args->>'p_window_job_id')::uuid,(args->>'p_expected_version')::bigint,(args->>'p_item_id')::uuid,(args->>'p_transition_id')::uuid,args->'p_observation',(args->>'p_operation_id')::uuid);
 when 'continue_library_translation_scan' then r:=public.continue_library_translation_scan((args->>'p_window_job_id')::uuid,(args->>'p_expected_version')::bigint,args->'p_configuration');
 else raise exception 'Unknown fixture RPC' using errcode='22023';end case;
 insert into public.library_scan_fixture_wire(rpc,args,response) values(name,args,r);return r;
end; $$;
create function public.library_scan_fixture_clear()
returns void language sql security definer set search_path='' as $$
 update public.literary_work_translations set editorial_status='draft' where locale='ru';
$$;
create function public.library_scan_fixture_seed(n integer,tag text)
returns void language plpgsql security definer set search_path='' as $$ declare idx integer;wid uuid;begin
 for idx in 1..n loop
  wid:=('fa000000-0000-4000-8000-'||lpad((tag::integer*10000+idx)::text,12,'0'))::uuid;
  insert into public.literary_works(id,legacy_id,country_id,writer_id,title,slug,editorial_status,metadata)
   values(wid,'scan-'||wid,'fixture-country','fixture-writer','Авторское название','scan-'||replace(wid::text,'-',''),'reviewed','{"rights":"KEEP WORK RIGHTS"}');
  insert into public.literary_work_translations(work_id,locale,title,description,source_language,translation_method,editorial_status,source_urls,reviewed_at,metadata,updated_at)
   values(wid,'ru','Русское название',repeat('Авторское литературное описание сохраняет все исходные сведения, последовательность и оговорки. ',2),'Russian','editorial-original','reviewed',array['https://fixture.test/ru'],'2026-10-30','{"rights":"KEEP RU AUTHOR"}','2026-10-01T00:00:00Z'),
    (wid,'en','Manual exact title','This deliberate human translation retains the authorial literary account and its precise sequence. Its source terms, rights and editorial qualifications remain unchanged during the scan.','Russian','human-translation','reviewed',array['https://fixture.test/en'],'2026-10-30','{"rights":"KEEP HUMAN EN"}','2026-10-01T00:00:00Z');
  insert into public.literary_work_sources(work_id,provider,source_url,field_names,usage,license_name,retrieved_at,metadata)
   values(wid,'editorial-source','https://fixture.test/ru',array['description'],'reference-only','AUTHOR SOURCE TERMS','2026-10-30','{"rights":"KEEP SOURCE TERMS"}');
 end loop;
end; $$;
create function public.library_scan_fixture_free(r jsonb,state text default 'manual',reason text default null,transition_id uuid default gen_random_uuid())
returns jsonb language sql set search_path='' as $$
 select public.checkpoint_library_translation_scan_item((r->>'jobId')::uuid,(r->>'jobVersion')::bigint,
  (r->'members'->(r->>'nextPosition')::integer->>'itemId')::uuid,transition_id,jsonb_build_object('version',1,'type','free','state',state,'reason',reason,'sourceHash',null),null);
$$;
create function public.library_scan_fixture_attach(r jsonb,child jsonb,transition_id uuid default gen_random_uuid())
returns jsonb language sql set search_path='' as $$
 select public.library_scan_fixture_call('attach_library_translation_scan_operation',jsonb_build_object('p_window_job_id',r->'jobId','p_expected_version',r->'jobVersion',
  'p_item_id',r->'members'->(r->>'nextPosition')::integer->'itemId','p_operation_job_id',child->'jobId','p_operation_item_id',child->'itemId','p_operation_id',child->'operationId',
  'p_intent_hash',child->'intentHash','p_transition_id',transition_id));
$$;
create function public.library_scan_fixture_checkpoint_child(r jsonb,child jsonb,transition_id uuid default gen_random_uuid())
returns jsonb language sql set search_path='' as $$
 select public.library_scan_fixture_call('checkpoint_library_translation_scan_item',jsonb_build_object('p_window_job_id',r->'jobId','p_expected_version',r->'jobVersion',
  'p_item_id',r->'members'->(r->>'nextPosition')::integer->'itemId','p_transition_id',transition_id,'p_observation',jsonb_build_object('version',1,'type','child-terminal'),'p_operation_id',child->'operationId'));
$$;
create function public.library_scan_fixture_single(tag text,attach boolean default true)
returns jsonb language plpgsql set search_path='' as $$ declare args jsonb;scan jsonb;child jsonb;begin
 perform public.library_scan_fixture_clear();args:=public.catalog_fixture_seed('literary_work',tag,true)||'{"currentCursor":{"libraryCursor":0},"resumeCursor":{"libraryCursor":1}}';
 scan:=public.begin_library_translation_scan(gen_random_uuid(),args->'configuration');child:=public.catalog_fixture_begin(args);
 if attach then scan:=public.library_scan_fixture_attach(scan,child);end if;
 return jsonb_build_object('args',args,'scan',scan,'child',child);
end; $$;

--501 members exceed ONE real job bound. The first500 and their logical free
-- observations are immutable; duplicate continuation creates one successor.
do $$ declare r jsonb;original jsonb;successor jsonb;created_successor jsonb;again jsonb;config jsonb;idx integer;root_id uuid:=gen_random_uuid();before_rows jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform public.library_scan_fixture_clear();perform public.library_scan_fixture_seed(501,'1');config:=public.catalog_fixture_config('literary_work',true);
 select jsonb_build_object('works',(select jsonb_agg(to_jsonb(t) order by id) from public.literary_works t),'translations',(select jsonb_agg(to_jsonb(t) order by id) from public.literary_work_translations t),'sources',(select jsonb_agg(to_jsonb(t) order by id) from public.literary_work_sources t)) into before_rows;
 set local role authenticated;
 r:=public.begin_library_translation_scan(root_id,config);original:=r;
 assert r->'totalItems'='500'::jsonb and r->'windowIndex'='0'::jsonb and r->>'jobId'=root_id::text and r->'lastWindow'='false'::jsonb;
 assert public.begin_library_translation_scan(root_id,config)->>'jobId'=r->>'jobId';
 assert public.continue_library_translation_scan(root_id,(r->>'jobVersion')::bigint,config)->>'jobId'=r->>'jobId';
 for idx in 1..500 loop r:=public.library_scan_fixture_free(r);end loop;
 assert r->'nextPosition'='500'::jsonb and r->'exhausted'='false'::jsonb and r->>'blockReason'='window_complete';
 successor:=public.library_scan_fixture_call('continue_library_translation_scan',jsonb_build_object('p_window_job_id',root_id,'p_expected_version',r->'jobVersion','p_configuration',config));created_successor:=successor;
 again:=public.continue_library_translation_scan(root_id,(r->>'jobVersion')::bigint,config);
 assert successor->>'jobId'=again->>'jobId' and successor->'windowIndex'='1'::jsonb and successor->'totalItems'='1'::jsonb and successor->>'predecessorJobId'=root_id::text;
 successor:=public.library_scan_fixture_free(successor);
 assert successor->'exhausted'='true'::jsonb and successor->'nextPosition'='1'::jsonb and jsonb_array_length(successor->'members')=1;
 insert into public.library_scan_fixture_results values('501-successor-window',jsonb_build_object('initial',original,'atBound',r,'createdSuccessor',created_successor,'completedFirst',public.get_library_translation_scan(root_id),'completedSuccessor',successor));
 reset role;
 assert (select count(*)=500 and count(*)filter(where status='reviewing')=0 from public.translation_job_items where job_id=root_id);
 assert (select count(*)=500 and bool_and(model is null and provider_request_id is null and input_tokens is null and output_tokens is null and staff_retry_receipt->'providerCalls'='0'::jsonb)
  from public.translation_job_attempts where item_id in(select id from public.translation_job_items where job_id=root_id));
 assert (select jsonb_build_object('works',(select jsonb_agg(to_jsonb(t) order by id) from public.literary_works t),'translations',(select jsonb_agg(to_jsonb(t) order by id) from public.literary_work_translations t),'sources',(select jsonb_agg(to_jsonb(t) order by id) from public.literary_work_sources t))=before_rows);
end; $$;
select 'M07_LIBRARY_SCAN_FIRST_PASS';

-- Own zero-call BEGIN attaches before any dispatch. Two actual private journal
-- passes+FINISH yield one real child attempt and one logical0-provider parent
-- observation. Native candidate remains private and canonical rows stay exact.
do $$ declare args jsonb;scan jsonb;child jsonb;done jsonb;attached jsonb;transition_id uuid:=gen_random_uuid();first_attached jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);perform public.library_scan_fixture_clear();
 args:=public.catalog_fixture_seed('literary_work','scan-paid-normal',true)||'{"currentCursor":{"libraryCursor":0},"resumeCursor":{"libraryCursor":1}}';
 set local role authenticated;
 scan:=public.begin_library_translation_scan(gen_random_uuid(),args->'configuration');assert scan->'totalItems'='1'::jsonb;
 child:=public.catalog_fixture_begin(args);attached:=public.library_scan_fixture_attach(scan,child,transition_id);first_attached:=attached;
 assert attached->>'transition'='attached' and attached#>>'{child,binding}'='attached' and attached#>'{child,receipt,providerCalls}'='0'::jsonb;
 assert public.library_scan_fixture_attach(scan,child,transition_id)->'replayed'='true'::jsonb;
 child:=public.catalog_fixture_pass(child,'translation',args->'payload');child:=public.catalog_fixture_pass(child,'review',args->'payload');done:=public.catalog_fixture_finish(child,args->'payload');
 scan:=public.library_scan_fixture_checkpoint_child(attached,done,gen_random_uuid());
 assert scan->'nextPosition'='1'::jsonb and scan->'exhausted'='true'::jsonb and scan->'child'='null'::jsonb;
 insert into public.library_scan_fixture_results values('paid-child-normal',jsonb_build_object('attached',first_attached,'finishedParent',scan,'child',done));
 reset role;
 assert (select count(*)=1 from public.translation_job_attempts where item_id=(done->>'itemId')::uuid);
 assert (select count(*)=1 and bool_and(model is null and provider_request_id is null and input_tokens is null and output_tokens is null and staff_retry_receipt->'providerCalls'='0'::jsonb)
  from public.translation_job_attempts where item_id=(scan#>>'{members,0,itemId}')::uuid);
 assert (select description=args#>>'{source,description}' from public.literary_work_translations where work_id=(args->>'entityId')::uuid and locale='ru');
end; $$;

-- An already charged active operation is observed-blocked, never formal
-- admission. Its terminal outcome becomes one existing-resolved FREE scan
-- observation, not a second paid attempt or an automatic retry.
do $$ declare args jsonb;scan jsonb;child jsonb;blocked jsonb;done jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);perform public.library_scan_fixture_clear();
 args:=public.catalog_fixture_seed('literary_work','scan-observed',true);
 set local role authenticated;scan:=public.begin_library_translation_scan(gen_random_uuid(),args->'configuration');child:=public.catalog_fixture_begin(args);
 child:=public.catalog_fixture_pass(child,'translation',args->'payload');
 assert public.get_library_translation_scan((scan->>'jobId')::uuid)#>>'{child,binding}'='observed-blocked';
 blocked:=public.library_scan_fixture_attach(scan,child);
 assert blocked->>'transition'='held' and blocked#>>'{child,binding}'='observed-blocked' and blocked#>'{child,receipt,providerCalls}'='1'::jsonb;
 child:=public.catalog_fixture_pass(child,'review',args->'payload');done:=public.catalog_fixture_finish(child,args->'payload');
 assert public.get_library_translation_scan((scan->>'jobId')::uuid)#>>'{child,receipt,phase}'='finished';
 scan:=public.library_scan_fixture_checkpoint_child(blocked,done);
 assert scan->'nextPosition'='1'::jsonb and scan->'child'='null'::jsonb and scan->'exhausted'='true'::jsonb;
 insert into public.library_scan_fixture_results values('persisted-observed-terminal',jsonb_build_object('blocked',blocked,'finishedParent',scan,'child',done));
 reset role;
 assert (select staff_retry_receipt->>'classification'='existing-resolved' and staff_retry_receipt->'providerCalls'='0'::jsonb and model is null
  from public.translation_job_attempts where item_id=(scan#>>'{members,0,itemId}')::uuid);
end; $$;

-- Unknown accepted dispatch survives source deletion and cannot be skipped,
-- unlinked, leased or reset by native direct metadata mutations.
do $$ declare args jsonb;scan jsonb;child jsonb;held jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);perform public.library_scan_fixture_clear();
 args:=public.catalog_fixture_seed('literary_work','scan-unknown-delete',true)||'{"currentCursor":{"libraryCursor":0},"resumeCursor":{"libraryCursor":1}}';
 set local role authenticated;scan:=public.begin_library_translation_scan(gen_random_uuid(),args->'configuration');child:=public.catalog_fixture_begin(args);
 scan:=public.library_scan_fixture_attach(scan,child);
 child:=public.record_catalog_translation_operation_dispatch((child->>'jobId')::uuid,(child->>'itemId')::uuid,(child->>'operationId')::uuid,gen_random_uuid(),'cloudflare','fixture-translator','translation',repeat('c',64));
 reset role;delete from public.literary_works where id=(args->>'entityId')::uuid;
 set local role authenticated;held:=public.get_library_translation_scan((scan->>'jobId')::uuid);
 assert held->'nextPosition'='0'::jsonb and held#>>'{child,receipt,blockReason}'='provider_outcome_unknown';
 assert public.library_scan_fixture_free(held,'skipped','source_missing')->>'transition'='held';
 perform public.premium_fixture_error(format('select public.finish_catalog_translation_operation(%L,%L,%L,''{"status":"skipped","providerCalls":0}'')',child->>'jobId',child->>'itemId',child->>'operationId'),'22023');
 perform public.premium_fixture_error(format('update public.translation_jobs set resume_cursor=jsonb_set(resume_cursor,''{libraryScan,activeChild}'',''null''),version=version+1 where id=%L',scan->>'jobId'),'42501');
 reset role;set local role service_role;
 perform public.premium_fixture_error(format('update public.translation_jobs set resume_cursor=jsonb_set(resume_cursor,''{libraryScan,activeChild}'',''null''),version=version+1 where id=%L',scan->>'jobId'),'42501');
 perform public.premium_fixture_error(format('delete from public.translation_jobs where id=%L',scan->>'jobId'),'42501');
 perform public.premium_fixture_error(format('update public.translation_job_items set status=''queued'' where id=%L',scan#>>'{members,0,itemId}'),'42501');
 perform public.premium_fixture_error(format('update public.translation_job_items set staff_retry=''{}'' where id=%L',scan#>>'{members,0,itemId}'),'42501');
 reset role;insert into public.library_scan_fixture_results values('unknown-source-deleted',jsonb_build_object('held',held,'child',child));
end; $$;

-- Deliberately separate transactions: no parent lock is held while the old
-- child FINISH records its confirmed0-call cleanup.
do $$ declare args jsonb;scan jsonb;child jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);perform public.library_scan_fixture_clear();
 args:=public.catalog_fixture_seed('literary_work','scan-zero',true)||'{"currentCursor":{"libraryCursor":0},"resumeCursor":{"libraryCursor":1}}';
 set local role authenticated;scan:=public.begin_library_translation_scan(gen_random_uuid(),args->'configuration');child:=public.catalog_fixture_begin(args);scan:=public.library_scan_fixture_attach(scan,child);
 insert into public.library_scan_fixture_results values('zero-call-setup',jsonb_build_object('scan',scan,'child',child,'args',args));reset role;
end; $$;
do $$ declare child jsonb;done jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 select value->'child' into child from public.library_scan_fixture_results where label='zero-call-setup';set local role authenticated;
 done:=public.finish_catalog_translation_operation((child->>'jobId')::uuid,(child->>'itemId')::uuid,(child->>'operationId')::uuid,'{"status":"skipped","providerCalls":0}',null);
 insert into public.library_scan_fixture_results values('zero-call-finished-child',done);reset role;
end; $$;
do $$ declare scan jsonb;child jsonb;held jsonb;again jsonb;transition_id uuid:=gen_random_uuid();begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 select value->'scan' into scan from public.library_scan_fixture_results where label='zero-call-setup';
 select value into child from public.library_scan_fixture_results where label='zero-call-finished-child';set local role authenticated;
 held:=public.library_scan_fixture_checkpoint_child(scan,child,transition_id);again:=public.library_scan_fixture_checkpoint_child(scan,child,transition_id);
 assert held->>'transition'='zero-call-held' and held->'nextPosition'='0'::jsonb and held->'child'='null'::jsonb and again->'replayed'='true'::jsonb;
 insert into public.library_scan_fixture_results values('zero-call-holds-no-advance',held);reset role;
 assert not exists(select 1 from public.translation_job_attempts where item_id=(scan#>>'{members,0,itemId}')::uuid);
end; $$;

-- Deleted pending is explicitly observed without shrinking immutable members;
-- the stored unknown case above is never treated as this free deletion.
do $$ declare scan jsonb;before_members jsonb;work text;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);perform public.library_scan_fixture_clear();perform public.library_scan_fixture_seed(2,'2');
 set local role authenticated;scan:=public.begin_library_translation_scan(gen_random_uuid(),public.catalog_fixture_config('literary_work',false));before_members:=scan->'members';work:=scan#>>'{members,0,workId}';reset role;
 delete from public.literary_works where id=work::uuid;set local role authenticated;
 scan:=public.library_scan_fixture_free(scan,'skipped','source_missing');assert scan->'nextPosition'='1'::jsonb and jsonb_array_length(scan->'members')=2;
 assert scan#>>'{members,0,workId}'=work;
 insert into public.library_scan_fixture_results values('deleted-pending-explicit-observation',scan);reset role;
end; $$;
select 'M07_LIBRARY_SCAN_PAID_AND_HOLDS_PASS';

-- Exact five-RPC request/response goldens, actual functions through a transparent
-- fixture observer. The observer itself writes only its synthetic trace table.
do $$ declare r jsonb;request jsonb;begin_request jsonb;config jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);perform public.library_scan_fixture_clear();perform public.library_scan_fixture_seed(2,'3');
 config:=public.catalog_fixture_config('literary_work',false);begin_request:=jsonb_build_object('p_scan_id',gen_random_uuid(),'p_configuration',config);
 set local role authenticated;
 r:=public.library_scan_fixture_call('begin_library_translation_scan',begin_request);
 assert public.library_scan_fixture_call('begin_library_translation_scan',begin_request)->'replayed'='true'::jsonb;
 r:=public.library_scan_fixture_call('get_library_translation_scan',jsonb_build_object('p_job_id',r->'jobId'));
 r:=public.library_scan_fixture_call('continue_library_translation_scan',jsonb_build_object('p_window_job_id',r->'jobId','p_expected_version',r->'jobVersion','p_configuration',config));
 request:=jsonb_build_object('p_window_job_id',r->'jobId','p_expected_version',r->'jobVersion','p_item_id',r#>'{members,0,itemId}','p_transition_id',gen_random_uuid(),
  'p_observation',jsonb_build_object('version',1,'type','free','state','manual','reason',null,'sourceHash',null),'p_operation_id',null);
 r:=public.library_scan_fixture_call('checkpoint_library_translation_scan_item',request);
 assert public.library_scan_fixture_call('checkpoint_library_translation_scan_item',request)->'replayed'='true'::jsonb;
 r:=public.library_scan_fixture_free(r);
 r:=public.library_scan_fixture_call('continue_library_translation_scan',jsonb_build_object('p_window_job_id',r->'jobId','p_expected_version',r->'jobVersion','p_configuration',config));
 assert r->'exhausted'='true'::jsonb;
 insert into public.library_scan_fixture_results values('wire-free-replay-exhausted',r);reset role;
end; $$;

-- No working candidate can be borrowed from a completed historical child.
-- A pending-slot takeover makes FINISH retain the paid candidate only in its
-- own private artifact. The unbound scan records a zero-provider existing result.
do $$ declare args jsonb;r jsonb;child jsonb;done jsonb;slot jsonb;before_slot jsonb;request jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);perform public.library_scan_fixture_clear();
 args:=public.catalog_fixture_seed('literary_work','scan-historical-private',true)||'{"currentCursor":{"libraryCursor":0},"resumeCursor":{"libraryCursor":1}}';
 set local role authenticated;r:=public.begin_library_translation_scan(gen_random_uuid(),args->'configuration');child:=public.catalog_fixture_begin(args);
 child:=public.catalog_fixture_pass(child,'translation',args->'payload');child:=public.catalog_fixture_pass(child,'review',args->'payload');
 slot:=public.premium_fixture_stage(args)->'draft';before_slot:=slot;done:=public.catalog_fixture_finish(child,args->'payload');
 assert done#>>'{result,persistence}'='private-artifact' and done#>>'{result,state}'='conflict';
 assert public.get_premium_translation_working_draft('literary_work',args->>'entityId')->'draft'=before_slot;
 request:=jsonb_build_object('p_window_job_id',r->'jobId','p_expected_version',r->'jobVersion','p_item_id',r#>'{members,0,itemId}','p_transition_id',gen_random_uuid(),
  'p_observation',jsonb_build_object('version',1,'type','child-terminal'),'p_operation_id',done->'operationId');
 r:=public.library_scan_fixture_call('checkpoint_library_translation_scan_item',request);
 assert r->'nextPosition'='1'::jsonb and r->'child'='null'::jsonb and r->'exhausted'='true'::jsonb;
 assert public.library_scan_fixture_call('checkpoint_library_translation_scan_item',request)->'replayed'='true'::jsonb;
 assert public.catalog_fixture_artifact(done)->'candidate'<>'null'::jsonb;
 assert public.get_premium_translation_working_draft('literary_work',args->>'entityId')->'draft'=before_slot;
 insert into public.library_scan_fixture_results values('historical-private-result-free-observation',jsonb_build_object('scan',r,'child',done,'slotPreserved',true));reset role;
 assert (select staff_retry_receipt->>'classification'='existing-resolved' and staff_retry_receipt->'providerCalls'='0'::jsonb and model is null and input_tokens is null and output_tokens is null
  from public.translation_job_attempts where item_id=(r#>>'{members,0,itemId}')::uuid);
end; $$;

-- First empty and empty remaining-tail completions keep real existing bounds.
do $$ declare r jsonb;config jsonb;root_id uuid;idx integer;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);perform public.library_scan_fixture_clear();
 config:=public.catalog_fixture_config('literary_work',false);set local role authenticated;
 r:=public.library_scan_fixture_call('begin_library_translation_scan',jsonb_build_object('p_scan_id',gen_random_uuid(),'p_configuration',config));
 assert r->'totalItems'='0'::jsonb and r->>'status'='skipped' and r->'exhausted'='true'::jsonb and r->'members'='[]'::jsonb;
 insert into public.library_scan_fixture_results values('first-empty',r);reset role;
end; $$;

-- Fresh actor/config/CAS and old table permissions remain real native checks.
do $$ declare r jsonb;config jsonb;fn regprocedure;statement text;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);perform public.library_scan_fixture_clear();perform public.library_scan_fixture_seed(1,'4');
 config:=public.catalog_fixture_config('literary_work',true);set local role authenticated;r:=public.begin_library_translation_scan(gen_random_uuid(),config);
 perform public.premium_fixture_error(format('select public.continue_library_translation_scan(%L,%s,%L::jsonb)',r->>'jobId',r->>'jobVersion',(config||'{"model":"different-model"}')::text),'40001');
 perform public.premium_fixture_error(format('select public.continue_library_translation_scan(%L,999,%L::jsonb)',r->>'jobId',config::text),'40001');
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 perform public.premium_fixture_error(format('select public.get_library_translation_scan(%L)',r->>'jobId'),'42501');
 perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 perform public.premium_fixture_error(format('select public.get_library_translation_scan(%L)',r->>'jobId'),'42501');
 perform set_config('request.jwt.claim.sub','',true);perform public.premium_fixture_error(format('select public.get_library_translation_scan(%L)',r->>'jobId'),'42501');reset role;
 for fn in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in('begin_library_translation_scan','get_library_translation_scan','attach_library_translation_scan_operation','checkpoint_library_translation_scan_item','continue_library_translation_scan') loop
  assert has_function_privilege('authenticated',fn,'EXECUTE') and not has_function_privilege('anon',fn,'EXECUTE') and not has_function_privilege('service_role',fn,'EXECUTE');
 end loop;
 insert into public.library_scan_fixture_results values('fresh-staff-config-cas-acl',jsonb_build_object('passed',true,'sqlstates',jsonb_build_array('40001','42501')));
end; $$;
select 'M07_LIBRARY_SCAN_FULL_PASS';

-- An empty remaining tail creates no phantom successor. Lost completion ACK
-- replays with the exact previous version and preserves all500 member history.
do $$ declare r jsonb;done jsonb;again jsonb;config jsonb;request jsonb;idx integer;root_id uuid;tail_id uuid;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);perform public.library_scan_fixture_clear();perform public.library_scan_fixture_seed(501,'5');
 config:=public.catalog_fixture_config('literary_work',false);set local role authenticated;
 r:=public.begin_library_translation_scan(gen_random_uuid(),config);root_id:=(r->>'jobId')::uuid;tail_id:=(r->>'upperId')::uuid;assert r->'lastWindow'='false'::jsonb;reset role;
 delete from public.literary_works where id=tail_id;set local role authenticated;
 for idx in 1..500 loop r:=public.library_scan_fixture_free(r);end loop;
 request:=jsonb_build_object('p_window_job_id',r->'jobId','p_expected_version',r->'jobVersion','p_configuration',config);
 done:=public.library_scan_fixture_call('continue_library_translation_scan',request);again:=public.library_scan_fixture_call('continue_library_translation_scan',request);
 assert done->'exhausted'='true'::jsonb and done->'lastWindow'='true'::jsonb and done->'successorJobId'='null'::jsonb
  and done->'totalItems'='500'::jsonb and again->'replayed'='true'::jsonb and done->'jobVersion'=again->'jobVersion';
 insert into public.library_scan_fixture_results values('empty-tail-ack-replay',jsonb_build_object('atBound',r,'completed',done,'replay',again));reset role;
 assert (select count(*)=1 from public.translation_jobs where resume_cursor#>>'{libraryScan,scanId}'=root_id::text);
 assert (select count(*)=500 from public.translation_job_items where job_id=root_id);
 assert (select count(*)=1 from public.admin_audit_log where entity_id=root_id::text and action='translation.library_scan.exhausted');
end; $$;
select 'M07_LIBRARY_SCAN_EMPTY_TAIL_REPLAY_PASS';
