-- Owned loopback PostgreSQL17 only; synthetic Auth/CMS/provider artifacts.
-- Run after unchanged native scaffold/old fixtures and the new admission SQL.
-- The wire observer records actual closed RPC inputs/results; it grants no API.
reset role;
set timezone='UTC';
create table public.site_copy_operation_fixture_results(label text primary key,value jsonb not null);
alter table public.site_copy_operation_fixture_results enable row level security;
create policy site_copy_operation_fixture_staff on public.site_copy_operation_fixture_results for all to authenticated using(public.is_staff()) with check(public.is_staff());
grant select,insert,update on public.site_copy_operation_fixture_results to authenticated;
create table public.site_copy_operation_fixture_wire(id uuid primary key default gen_random_uuid(),at_time timestamptz default clock_timestamp(),rpc text,args jsonb,response jsonb);
alter table public.site_copy_operation_fixture_wire enable row level security;
create policy site_copy_operation_wire_staff on public.site_copy_operation_fixture_wire for all to authenticated using(public.is_staff()) with check(public.is_staff());
grant select,insert on public.site_copy_operation_fixture_wire to authenticated;
create function public.site_copy_operation_fixture_call(name text,args jsonb)
returns jsonb language plpgsql set search_path='' as $$ declare r jsonb;begin
 case name
 when 'site_copy_translation_operation_ready' then r:=to_jsonb(public.site_copy_translation_operation_ready());
 when 'begin_site_copy_translation_operation' then r:=public.begin_site_copy_translation_operation((args->>'p_job_id')::uuid,(args->>'p_item_id')::uuid,(args->>'p_operation_id')::uuid,(args->>'p_block_id')::uuid,args->>'p_provider',args->>'p_source_hash',args->'p_source_snapshot',args->'p_source_revision',args->'p_target_revision',args->'p_expected_state',args->'p_configuration');
 when 'reconcile_site_copy_translation_operation' then r:=public.reconcile_site_copy_translation_operation((args->>'p_operation_id')::uuid);
 when 'get_site_copy_translation_operation_artifacts' then r:=public.get_site_copy_translation_operation_artifacts((args->>'p_job_id')::uuid,(args->>'p_item_id')::uuid,(args->>'p_operation_id')::uuid,args->>'p_intent_hash',args->>'p_source_hash',args->>'p_raw_seed_hash');
 when 'record_site_copy_translation_operation_dispatch' then r:=public.record_site_copy_translation_operation_dispatch((args->>'p_job_id')::uuid,(args->>'p_item_id')::uuid,(args->>'p_operation_id')::uuid,(args->>'p_call_id')::uuid,args->>'p_provider',args->>'p_model',args->>'p_pass',args->>'p_request_hash');
 when 'record_site_copy_translation_operation_response' then r:=public.record_site_copy_translation_operation_response((args->>'p_job_id')::uuid,(args->>'p_item_id')::uuid,(args->>'p_operation_id')::uuid,args->'p_metadata',args->'p_response_artifact');
 when 'finish_site_copy_translation_operation' then r:=public.finish_site_copy_translation_operation((args->>'p_job_id')::uuid,(args->>'p_item_id')::uuid,(args->>'p_operation_id')::uuid,args->'p_outcome',nullif(args->'p_candidate','null'::jsonb));
 when 'get_site_copy_translation_candidate_freshness' then r:=public.get_site_copy_translation_candidate_freshness(args->>'p_entity_id',(args->>'p_draft_id')::uuid,(args->>'p_expected_version')::bigint,args->>'p_candidate_hash',args->>'p_source_hash');
 else raise exception 'Unknown Site Copy fixture RPC' using errcode='22023';end case;
 insert into public.site_copy_operation_fixture_wire(rpc,args,response) values(name,args,r);return r;
end; $$;
create function public.site_copy_operation_fixture_seed(review boolean default true)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare b public.homepage_blocks%rowtype;identity uuid:=gen_random_uuid();settings jsonb;items jsonb;begin
 delete from public.premium_translation_working_drafts where entity_type='site_copy';
 delete from public.homepage_blocks canonical where canonical.settings->>'systemKey'='site-copy-overrides';
 settings:=public.site_copy_fixture_settings();
 insert into public.homepage_blocks(id,block_type,title,settings,display_order,is_enabled,background_style,background_media_id,updated_by,updated_at)
 values(identity,'text','KEEP AUTHORED TITLE',settings,-17,false,'paper','99999999-9999-4999-8999-999999999999',
  '11111111-1111-4111-8111-111111111111',transaction_timestamp()) returning * into b;
 -- Original semantic hashes are opaque synthetic server inputs, distinct from
 -- the actual full-row native fingerprint. SQL never substitutes JSONB hash.
 items:=jsonb_build_array(jsonb_build_object('key','intro','text',E'Исходный \u2014 текст\r\nс новой строкой','sourceHash',repeat('c',64)),
  jsonb_build_object('key','cta','text','Открыть карту','sourceHash',repeat('d',64)));
 return jsonb_build_object('entityId',b.id,'sourceHash',repeat('b',64),'sourceSnapshot',jsonb_build_object('settings',b.settings,'items',items),
  'sourceRevision',jsonb_build_object('blockId',b.id,'blockUpdatedAt',b.updated_at),'targetRevision',jsonb_build_object('id',b.id,'updatedAt',b.updated_at),
  'expectedState',jsonb_build_object('version',1,'block',jsonb_build_object('id',b.id,'settings',b.settings,'updated_at',b.updated_at)),
  'configuration',public.writer_operation_fixture_config()||jsonb_build_object('schemaName','probpera_site_copy_translation','maxOutputTokens',12000,'twoPassReview',review),
  'payload',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('key','intro','text','Separate English copy awaiting explicit human review.'),jsonb_build_object('key','cta','text','Open the map'))));
end; $$;
create function public.site_copy_operation_fixture_begin_args(a jsonb)
returns jsonb language sql volatile set search_path='' as $$
 select jsonb_build_object('p_job_id',gen_random_uuid(),'p_item_id',gen_random_uuid(),'p_operation_id',gen_random_uuid(),'p_block_id',a->'entityId',
  'p_provider',a#>'{configuration,provider}','p_source_hash',a->'sourceHash','p_source_snapshot',a->'sourceSnapshot','p_source_revision',a->'sourceRevision',
  'p_target_revision',a->'targetRevision','p_expected_state',a->'expectedState','p_configuration',a->'configuration');
$$;
create function public.site_copy_operation_fixture_begin(a jsonb)
returns jsonb language sql set search_path='' as $$ select public.site_copy_operation_fixture_call('begin_site_copy_translation_operation',public.site_copy_operation_fixture_begin_args(a)); $$;
create function public.site_copy_operation_fixture_artifact(r jsonb)
returns jsonb language sql set search_path='' as $$ select public.site_copy_operation_fixture_call('get_site_copy_translation_operation_artifacts',jsonb_build_object(
 'p_job_id',r->'jobId','p_item_id',r->'itemId','p_operation_id',r->'operationId','p_intent_hash',r->'intentHash','p_source_hash',r->'sourceHash','p_raw_seed_hash',r->'rawSeedHash')); $$;
create function public.site_copy_operation_fixture_dispatch_args(r jsonb,pass text)
returns jsonb language sql volatile set search_path='' as $$ select jsonb_build_object('p_job_id',r->'jobId','p_item_id',r->'itemId','p_operation_id',r->'operationId','p_call_id',gen_random_uuid(),
 'p_provider',r->'provider','p_model',case pass when 'translation' then r#>'{configuration,model}' else r#>'{configuration,reviewerModel}' end,'p_pass',pass,'p_request_hash',repeat('e',64)); $$;
create function public.site_copy_operation_fixture_ack(r jsonb,payload jsonb)
returns jsonb language plpgsql set search_path='' as $$ declare calls jsonb;last jsonb;metadata jsonb;begin
 calls:=public.site_copy_operation_fixture_artifact(r)->'calls';last:=calls->(jsonb_array_length(calls)-1)->'metadata';
 metadata:=(last-array['dispatchRecordedAt','responseReceivedAt'])||jsonb_build_object('httpStatus',200,'requestId',null,'responseId','native-site-'||(last->>'pass'),'inputTokens',5,'outputTokens',6);
 return public.site_copy_operation_fixture_call('record_site_copy_translation_operation_response',jsonb_build_object('p_job_id',r->'jobId','p_item_id',r->'itemId','p_operation_id',r->'operationId',
  'p_metadata',metadata,'p_response_artifact',jsonb_build_object('version',1,'body',jsonb_build_object('response',payload::text))));
end; $$;
create function public.site_copy_operation_fixture_pass(r jsonb,pass text,payload jsonb)
returns jsonb language plpgsql set search_path='' as $$ begin return public.site_copy_operation_fixture_ack(public.site_copy_operation_fixture_call('record_site_copy_translation_operation_dispatch',public.site_copy_operation_fixture_dispatch_args(r,pass)),payload);end; $$;
create function public.site_copy_operation_fixture_candidate(r jsonb,payload jsonb)
returns jsonb language plpgsql set search_path='' as $$ declare calls jsonb;first jsonb;last jsonb;n integer;begin
 calls:=public.site_copy_operation_fixture_artifact(r)->'calls';n:=jsonb_array_length(calls);first:=calls->0->'metadata';last:=calls->(n-1)->'metadata';
 return jsonb_build_object('payload',payload,'provenance',jsonb_build_object('provider',r->'provider','translatorModel',first->'model','reviewerModel',case when n=1 then 'null'::jsonb else last->'model' end,
  'translatorRequestId',first->'responseId','reviewerRequestId',case when n=1 then 'null'::jsonb else last->'responseId' end,'generatedAt','2026-10-30T10:00:00.123456Z'),
  'translatorCallId',first->'callId','reviewerCallId',case when n=1 then 'null'::jsonb else last->'callId' end);
end; $$;
create function public.site_copy_operation_fixture_finish(r jsonb,payload jsonb)
returns jsonb language sql set search_path='' as $$ select public.site_copy_operation_fixture_call('finish_site_copy_translation_operation',jsonb_build_object(
 'p_job_id',r->'jobId','p_item_id',r->'itemId','p_operation_id',r->'operationId','p_outcome',jsonb_build_object('status','succeeded','providerCalls',r->'providerCalls','model',r#>'{configuration,model}'),
 'p_candidate',public.site_copy_operation_fixture_candidate(r,payload))); $$;
create function public.site_copy_operation_fixture_free(r jsonb)
returns jsonb language sql set search_path='' as $$ select public.site_copy_operation_fixture_call('finish_site_copy_translation_operation',jsonb_build_object(
 'p_job_id',r->'jobId','p_item_id',r->'itemId','p_operation_id',r->'operationId','p_outcome',jsonb_build_object('status','skipped','providerCalls',0),'p_candidate',null)); $$;
create function public.site_copy_operation_fixture_freshness(d jsonb)
returns jsonb language sql set search_path='' as $$ select public.site_copy_operation_fixture_call('get_site_copy_translation_candidate_freshness',jsonb_build_object(
 'p_entity_id',d->'entityId','p_draft_id',d->'id','p_expected_version',d->'version','p_candidate_hash',d->'candidateHash','p_source_hash',d->'sourceHash')); $$;

-- Exact actual old identities/ACL/RLS/checks remain; new scope is staff-only.
do $$ declare fn record;begin
 set local role anon;
 perform public.premium_fixture_error('select public.site_copy_translation_operation_ready()','42501');reset role;
 set local role authenticated;perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 perform public.premium_fixture_error('select public.site_copy_translation_operation_ready()','42501');
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 assert public.site_copy_operation_fixture_call('site_copy_translation_operation_ready','{}')='true'::jsonb;
 perform public.premium_fixture_error('select * from premium_translation_private.catalog_operation_artifacts','42501');
 assert public.site_copy_operation_fixture_call('reconcile_site_copy_translation_operation','{"p_operation_id":null}') is null;reset role;
 for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='premium_translation_private' and p.proname like 'site_copy_operation_%' loop
  assert not has_function_privilege('authenticated',fn.signature,'execute') and not has_function_privilege('service_role',fn.signature,'execute');
 end loop;
end; $$;
select 'M07_SITE_COPY_ADMISSION_ACL_PASS';

-- Fully received valid candidate requires explicit human promotion. Native old
-- promotion is exercised through its real entry point and real CMS mutation.
do $$ declare a jsonb;r jsonb;done jsonb;artifact jsonb;draft jsonb;before_row jsonb;promoted jsonb;review boolean;fresh jsonb;foreign_fresh jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach review in array array[false,true] loop
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete deferred;
  a:=public.site_copy_operation_fixture_seed(review);select to_jsonb(b) into before_row from public.homepage_blocks b where id=(a->>'entityId')::uuid;
  set local role authenticated;r:=public.site_copy_operation_fixture_begin(a);assert r->'canExecute'='true'::jsonb;
  reset role;
  set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete immediate;
  set local role authenticated;
  r:=public.site_copy_operation_fixture_pass(r,'translation',a->'payload');
  if review then r:=public.site_copy_operation_fixture_pass(r,'review',a->'payload');end if;
  done:=public.site_copy_operation_fixture_finish(r,a->'payload');artifact:=public.site_copy_operation_fixture_artifact(done);
  assert done#>>'{result,state}'='translated' and done#>>'{result,persistence}'='working-draft';
  assert artifact->'sourceSnapshot'=a->'sourceSnapshot','retained original semantic source';
  assert artifact#>'{rawSeed,block}'=before_row,'retained entire actual raw seed';
  assert done->>'sourceHash'<>done->>'rawSeedHash','semantic and full raw hashes stay distinct';
  assert (select to_jsonb(b)=before_row from public.homepage_blocks b where id=(a->>'entityId')::uuid);
  draft:=public.get_premium_translation_working_draft('site_copy',a->>'entityId')->'draft';
  perform public.premium_fixture_error(format('select public.site_copy_fixture_promote(%L::jsonb,false)',draft),'22023');
  fresh:=public.site_copy_operation_fixture_freshness(draft);assert fresh->'linked'='true'::jsonb and fresh->'canPromote'='true'::jsonb;
  perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
  foreign_fresh:=public.site_copy_operation_fixture_freshness(draft);assert foreign_fresh=fresh;
  perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_artifact(%L::jsonb)',done),'42501');
  set local timezone='Pacific/Kiritimati';
  promoted:=public.site_copy_fixture_promote(draft);assert promoted->>'state'='promoted';reset role;set local timezone='UTC';
  assert (select (to_jsonb(b)-array['settings','updated_at','updated_by'])=(before_row-array['settings','updated_at','updated_by']) from public.homepage_blocks b where id=(a->>'entityId')::uuid);
  assert (select settings#>'{siteCopy,ru}'=before_row#>'{settings,siteCopy,ru}' and settings#>'{siteCopy,fr}'=before_row#>'{settings,siteCopy,fr}'
   and settings#>>'{siteCopy,en,manual}'='Keep authored English' and settings#>>'{siteCopy,en,cta}'='Open the map' from public.homepage_blocks where id=(a->>'entityId')::uuid);
  assert not exists(select 1 from public.premium_translation_working_drafts where id=(draft->>'id')::uuid);
  fresh:=public.site_copy_operation_fixture_freshness(draft);assert fresh->>'reason'='candidate_missing' and fresh->'canPromote'='false'::jsonb;
  insert into public.site_copy_operation_fixture_results values('complete-review-'||review,jsonb_build_object('args',a,'finished',done,'artifact',artifact,'draft',draft,'promotion',promoted,'canonicalBefore',before_row,'crossStaffFreshness',foreign_fresh,'afterPromotionFreshness',fresh));
 end loop;
end; $$;
select 'M07_SITE_COPY_ADMISSION_COMPLETE_AND_NATIVE_PROMOTE_PASS';

-- Confirmed zero-call cleanup has no invented expense and allows a new intent.
do $$ declare a jsonb;r jsonb;done jsonb;args jsonb;again jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);a:=public.site_copy_operation_fixture_seed(false);args:=public.site_copy_operation_fixture_begin_args(a);
 set local role authenticated;r:=public.site_copy_operation_fixture_call('begin_site_copy_translation_operation',args);done:=public.site_copy_operation_fixture_free(r);
 again:=public.site_copy_operation_fixture_call('begin_site_copy_translation_operation',args);assert again->'replayed'='true'::jsonb and again->'canExecute'='false'::jsonb;
 assert done#>>'{result,persistence}'='none' and done->'providerCalls'='0'::jsonb;reset role;
 assert (select model is null and provider_request_id is null and input_tokens is null and output_tokens is null and duration_ms is null from public.translation_job_attempts where staff_retry_operation_id=(r->>'operationId')::uuid);
 insert into public.site_copy_operation_fixture_results values('zero-call-cleanup',jsonb_build_object('args',a,'begin',r,'finished',done,'replay',again));
end; $$;
select 'M07_SITE_COPY_ADMISSION_ZERO_CALL_PASS';

-- A synthetic transaction can roll back retained paid artifacts without a
-- DELETE bypass. Observed actual RPC records survive only as fixture evidence.
do $$ declare a jsonb;replacement jsonb;r jsonb;pending jsonb;blocked jsonb;late jsonb;artifact jsonb;args jsonb;
 before_wire uuid[];observed jsonb;trace jsonb;cancel jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 select coalesce(array_agg(id),'{}'::uuid[]) into before_wire from public.site_copy_operation_fixture_wire;
 begin
  a:=public.site_copy_operation_fixture_seed(true);set local role authenticated;r:=public.site_copy_operation_fixture_begin(a);
  pending:=public.site_copy_operation_fixture_call('record_site_copy_translation_operation_dispatch',public.site_copy_operation_fixture_dispatch_args(r,'translation'));
  blocked:=public.site_copy_operation_fixture_call('reconcile_site_copy_translation_operation',jsonb_build_object('p_operation_id',r->'operationId'));
  assert blocked->>'blockReason'='provider_outcome_unknown' and blocked->'canExecute'='false'::jsonb and blocked->'canDispatch'='false'::jsonb;
  perform public.premium_fixture_error(format('select public.finish_site_copy_translation_operation(%L,%L,%L,%L::jsonb,null)',r->>'jobId',r->>'itemId',r->>'operationId',
   jsonb_build_object('status','dead_letter','providerCalls',1)),'40001');
  reset role;replacement:=public.site_copy_operation_fixture_seed(false);args:=public.site_copy_operation_fixture_begin_args(replacement);
  args:=jsonb_set(args,'{p_configuration,model}','"changed-current-model"');
  set local role authenticated;blocked:=public.site_copy_operation_fixture_call('begin_site_copy_translation_operation',args);
  assert blocked->>'operationId'=r->>'operationId' and blocked->>'entityId'=a->>'entityId' and blocked->>'blockReason'='provider_outcome_unknown';
  perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
  blocked:=public.site_copy_operation_fixture_call('reconcile_site_copy_translation_operation',jsonb_build_object('p_operation_id',r->'operationId'));
  assert blocked->>'blockReason'='operation_owned_by_another_actor';
  perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_artifact(%L::jsonb)',r),'42501');
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  cancel:=public.request_translation_job_cancel((r->>'jobId')::uuid,(r->>'jobVersion')::bigint);
  late:=public.site_copy_operation_fixture_ack(pending,a->'payload');artifact:=public.site_copy_operation_fixture_artifact(late);
  assert late->>'blockReason'='operation_stopped' and late->'providerCalls'='1'::jsonb and late->'pendingCallId'='null'::jsonb;
  assert artifact#>'{calls,0,responseArtifact,body}'=jsonb_build_object('response',(a->'payload')::text) and artifact->'sourceSnapshot'=a->'sourceSnapshot';
  assert artifact#>>'{rawSeed,block,id}'=a->>'entityId' and artifact#>>'{rawSeed,block,id}'<>replacement->>'entityId';
  perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_call(%L,%L::jsonb)','record_site_copy_translation_operation_dispatch',public.site_copy_operation_fixture_dispatch_args(r,'review')),'40001');
  perform public.premium_fixture_error(format('select public.finish_site_copy_translation_operation(%L,%L,%L,%L::jsonb,null)',r->>'jobId',r->>'itemId',r->>'operationId',
   jsonb_build_object('status','dead_letter','providerCalls',1)),'40001');
  reset role;set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete immediate;
  select coalesce(jsonb_agg(to_jsonb(w) order by at_time,id),'[]'::jsonb) into trace from public.site_copy_operation_fixture_wire w where not(w.id=any(before_wire));
  observed:=jsonb_build_object('args',a,'replacement',replacement,'pending',pending,'blocked',blocked,'cancel',cancel,'late',late,'artifact',artifact,'observedWire',trace,
   'constantLogicalScopeHeld',true,'privateActorDenied',true,'lateBodyAfterCancelRetained',true,'partialNoTerminalRetry',true);
  raise exception 'Rollback synthetic retained paid state' using errcode='ZX001';
 exception when sqlstate 'ZX001' then null;end;
 assert observed is not null and not exists(select 1 from premium_translation_private.catalog_operation_artifacts where operation_id=(r->>'operationId')::uuid);
 insert into public.site_copy_operation_fixture_results values('unknown-scope-recreate-cancel-late-body',observed);
end; $$;
select 'M07_SITE_COPY_ADMISSION_UNKNOWN_CANCEL_RECREATE_PASS';

-- Construct a new private proof from actual zero-call native rows. This is a
-- fixture owner forgery input, never a production admission path or bypass.
create function public.site_copy_operation_fixture_forge(a premium_translation_private.catalog_operation_artifacts,patch jsonb default '{}')
returns premium_translation_private.catalog_operation_artifacts language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare j public.translation_jobs%rowtype;i public.translation_job_items%rowtype;marker jsonb;begin
 a:=jsonb_populate_record(a,patch);a.operation_id:=gen_random_uuid();a.job_id:=gen_random_uuid();a.item_id:=gen_random_uuid();
 a.calls:='[]';a.candidate:=null;a.final_receipt:=null;a.finish_fingerprint:=null;a.linked_draft_id:=null;a.linked_draft_version:=null;a.candidate_hash:=null;a.attempt_write_proof:=null;
 a.raw_seed_hash:=probpera_translation_operations.retry_fingerprint(a.raw_seed);a.configuration_hash:=probpera_translation_operations.retry_fingerprint(a.configuration);
 a.begin_request_hash:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(a.job_id,a.item_id,a.operation_id,a.actor_id,a.entity_id,a.provider,a.source_hash,
  a.source_snapshot,a.source_revision,a.target_revision,a.expected_state,a.configuration));
 a.intent_hash:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(a.begin_request_hash,a.raw_seed_hash));
 marker:=jsonb_build_object('version',1,'protocol','site-copy-translation','logicalScope','site-copy-overrides','operationId',a.operation_id,'actorId',a.actor_id,
  'sourceHash',a.source_hash,'intentHash',a.intent_hash,'rawSeedHash',a.raw_seed_hash,'configurationHash',a.configuration_hash,'startedAt',a.created_at,'attemptNumber',1,
  'progress',jsonb_build_object('version',1,'updatedAt',a.created_at,'calls','[]'::jsonb));
 j:=jsonb_populate_record(null::public.translation_jobs,a.job_write_proof||jsonb_build_object('id',a.job_id,'kind','site_copy','provider',a.provider,'requested_by',a.actor_id,
  'status','reviewing','version',1,'succeeded_items',0,'failed_items',0,'cancel_requested_at',null,'completed_at',null,
  'resume_cursor',jsonb_build_object('siteCopyOperation',jsonb_build_object('version',1,'logicalScope','site-copy-overrides','operationId',a.operation_id,'actorId',a.actor_id,'intentHash',a.intent_hash))));
 i:=jsonb_populate_record(null::public.translation_job_items,a.item_write_proof||jsonb_build_object('id',a.item_id,'job_id',a.job_id,'entity_type','site_copy','entity_id',a.entity_id,
  'source_hash',a.source_hash,'status','reviewing','attempt_count',0,'staff_retry',marker,'last_error_code',null));
 a.job_write_proof:=to_jsonb(j);a.item_write_proof:=to_jsonb(i);return a;
end; $$;

do $$ declare mode text;args jsonb;r jsonb;a premium_translation_private.catalog_operation_artifacts%rowtype;
 forged premium_translation_private.catalog_operation_artifacts%rowtype;j public.translation_jobs%rowtype;i public.translation_job_items%rowtype;
 rejected boolean;actual_code text;actual_message text;matrix jsonb:='[]';begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach mode in array array['missing-job-and-item','missing-item','preexisting-free-job-item','wrong-actual-job-kind','wrong-actual-job-provider','wrong-actual-job-actor','wrong-actual-item-source','missing-json-proof','wrong-intent-proof','forged-full-server-row'] loop
  rejected:=false;actual_code:=null;actual_message:=null;
  begin
   args:=public.site_copy_operation_fixture_seed(false);set local role authenticated;r:=public.site_copy_operation_fixture_begin(args);reset role;
   select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=(r->>'operationId')::uuid;
   forged:=public.site_copy_operation_fixture_forge(a);
   if mode='forged-full-server-row' then
    forged:=public.site_copy_operation_fixture_forge(a,jsonb_build_object('raw_seed',jsonb_set(a.raw_seed,'{block,title}','"FORGED RAW TITLE"')));
   end if;
   j:=jsonb_populate_record(null::public.translation_jobs,forged.job_write_proof);
   i:=jsonb_populate_record(null::public.translation_job_items,forged.item_write_proof);
   if mode in('preexisting-free-job-item','wrong-actual-job-kind','wrong-actual-job-provider','wrong-actual-job-actor','wrong-actual-item-source') then
    if mode='wrong-actual-job-kind' then j.kind:='country';end if;
    if mode='wrong-actual-job-provider' then j.provider:='openai';end if;
    if mode='wrong-actual-job-actor' then j.requested_by:='22222222-2222-4222-8222-222222222222';end if;
    i.staff_retry:=null;if mode='wrong-actual-item-source' then i.source_hash:=repeat('f',64);end if;
    insert into public.translation_jobs select j.*;insert into public.translation_job_items select i.*;
   end if;
   if mode='missing-json-proof' then forged.item_write_proof:=forged.item_write_proof-'id';end if;
   if mode='wrong-intent-proof' then forged.intent_hash:=repeat('f',64);end if;
   insert into premium_translation_private.catalog_operation_artifacts select forged.*;
   if mode='missing-item' then insert into public.translation_jobs select j.*;end if;
   set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete immediate;
  exception when insufficient_privilege then
   rejected:=true;actual_code:=sqlstate;actual_message:=sqlerrm;
   when serialization_failure then
    if mode<>'forged-full-server-row' then raise;end if;rejected:=true;actual_code:=sqlstate;actual_message:=sqlerrm;
  end;
  assert rejected,'forged construction committed: '||mode;
  assert not exists(select 1 from premium_translation_private.catalog_operation_artifacts where operation_id=forged.operation_id);
  assert not exists(select 1 from public.translation_jobs where id=forged.job_id);
  assert not exists(select 1 from public.translation_job_items where id=forged.item_id);
  matrix:=matrix||jsonb_build_array(jsonb_build_object('case',mode,'databaseCode',actual_code,'message',actual_message,'allNewRowsRolledBack',true));
 end loop;
 insert into public.site_copy_operation_fixture_results values('reverse-construction-forgeries',matrix);
end; $$;
select 'M07_SITE_COPY_ADMISSION_REVERSE_CONSTRUCTION_FORGERIES_PASS';



-- An ordinary guarded manual/history-shaped save remains possible while a new
-- paid candidate waits. Actual paid promotion still rechecks the whole OLD row,
-- even when a non-settings edit shares the exact same transaction-time CAS.
do $$ declare a jsonb;r jsonb;done jsonb;d jsonb;fresh jsonb;settings jsonb;payload jsonb;saved uuid;legacy jsonb;upper_id text;
 original_draft public.premium_translation_working_drafts%rowtype;b public.homepage_blocks%rowtype;
 before_wire uuid[];observed jsonb;trace jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 select coalesce(array_agg(id),'{}'::uuid[]) into before_wire from public.site_copy_operation_fixture_wire;
 begin
  a:=public.site_copy_operation_fixture_seed(false);set local role authenticated;r:=public.site_copy_operation_fixture_begin(a);
  r:=public.site_copy_operation_fixture_pass(r,'translation',a->'payload');done:=public.site_copy_operation_fixture_finish(r,a->'payload');
  d:=public.get_premium_translation_working_draft('site_copy',a->>'entityId')->'draft';reset role;
  select * into original_draft from public.premium_translation_working_drafts where id=(d->>'id')::uuid;
  perform public.premium_fixture_error(format('update public.premium_translation_working_drafts set payload=%L::jsonb where id=%L','{"items":[]}',d->>'id'),'42501');
  perform public.premium_fixture_error(format('update public.premium_translation_working_drafts set version=version+1 where id=%L',d->>'id'),'42501');
  perform public.premium_fixture_error(format('update public.premium_translation_working_drafts set id=gen_random_uuid() where id=%L',d->>'id'),'42501');
  update public.homepage_blocks set title=title||' RAW NONSETTINGS DRIFT' where id=(a->>'entityId')::uuid;
  select * into b from public.homepage_blocks where id=(a->>'entityId')::uuid;
  assert b.settings=a#>'{sourceSnapshot,settings}' and b.updated_at=(a#>>'{targetRevision,updatedAt}')::timestamptz,'same-CAS full-row drift is genuine';
  set local role authenticated;fresh:=public.site_copy_operation_fixture_freshness(d);
  assert fresh->'linked'='true'::jsonb and fresh->'canPromote'='false'::jsonb and fresh->>'reason'='source_changed';
  perform public.premium_fixture_error(format('select public.site_copy_fixture_promote(%L::jsonb)',d),'40001');reset role;
  settings:=jsonb_set(b.settings,'{siteCopy,en,intro}','"Historical approved English restored by a human"');
  settings:=jsonb_set(settings,'{premiumTranslation,siteCopyEn,intro,humanReview}',jsonb_build_object('status','approved','reviewedBy','11111111-1111-4111-8111-111111111111','reviewedAt','2026-10-01T10:00:00.123456Z'));
  payload:=jsonb_build_object('block_type','text','title',b.title,'settings',settings,'display_order',b.display_order,'is_enabled',b.is_enabled,
   'background_style',b.background_style,'background_media_id',b.background_media_id);
  set local role authenticated;saved:=public.save_site_copy_block(b.updated_at,payload,'{"nativeManualRestore":true}');
  assert saved=b.id and public.get_premium_translation_working_draft('site_copy',a->>'entityId')->'draft'=d;
  saved:=public.save_site_copy_block(b.updated_at,jsonb_set(payload,'{settings,premiumTranslation,siteCopyEn,intro,humanReview,reviewedBy}','"raw-manual-attribution"'),'{"nativeManualMetadata":true}');
  assert (select canonical.settings#>>'{premiumTranslation,siteCopyEn,intro,humanReview,reviewedBy}'='raw-manual-attribution' from public.homepage_blocks canonical where canonical.id=b.id),'ordinary raw human metadata is preserved';
  assert public.site_copy_operation_fixture_artifact(done)#>'{candidate,payload}'=a->'payload';
  perform public.premium_fixture_discard(d);reset role;
  assert not exists(select 1 from public.premium_translation_working_drafts where id=original_draft.id);
  begin insert into public.premium_translation_working_drafts select original_draft.*;raise exception 'Historical UUID reused' using errcode='ZX002';
  exception when insufficient_privilege then null;end;
  -- A new actual unlinked legacy UUID is not misidentified by cache history or
  -- source/candidate hashes, and its exact textual UUID case is preserved.
  select * into b from public.homepage_blocks where id=(a->>'entityId')::uuid;upper_id:=upper(b.id::text);
  set local role authenticated;
  legacy:=public.stage_premium_translation_working_draft('site_copy',upper_id,a->>'sourceHash',jsonb_build_object('settings',b.settings,'items',a#>'{sourceSnapshot,items}'),
   jsonb_build_object('blockId',upper_id,'blockUpdatedAt',b.updated_at),jsonb_build_object('id',upper_id,'updatedAt',b.updated_at),a->'payload',
   jsonb_build_object('provider','cloudflare','translatorModel','fixture-translator','reviewerModel',null,'translatorRequestId','legacy-native','reviewerRequestId',null,'generatedAt','2026-10-01T10:00:00.123456Z'),null,0)->'draft';
  fresh:=public.site_copy_operation_fixture_freshness(legacy);assert fresh->'linked'='false'::jsonb and fresh->'canPromote'='true'::jsonb and fresh->'reason'='null'::jsonb;
  reset role;
  begin
   update public.premium_translation_working_drafts set id=original_draft.id where id=(legacy->>'id')::uuid;
   raise exception 'Legacy renamed into consumed paid UUID' using errcode='ZX002';
  exception when insufficient_privilege then assert sqlerrm='Consumed Site Copy candidate UUID cannot be reused';end;
  set local role authenticated;
  fresh:=public.site_copy_operation_fixture_freshness(jsonb_set(legacy,'{entityId}',to_jsonb(lower(upper_id))));
  assert fresh->>'reason'='candidate_changed' and fresh->'canPromote'='false'::jsonb;
  assert public.site_copy_fixture_promote(legacy)->>'state'='promoted';
  assert public.site_copy_operation_fixture_artifact(done)#>'{candidate,payload}'=a->'payload';
  reset role;set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete immediate;
  select coalesce(jsonb_agg(to_jsonb(w) order by at_time,id),'[]'::jsonb) into trace from public.site_copy_operation_fixture_wire w where not(w.id=any(before_wire));
  observed:=jsonb_build_object('sameCasFullRowStaleDenied',true,'manualRestorePayload',payload,'manualSaveAllowed',true,'paidPreviewDiscardPreserved',true,
   'historicalPaidUuidReuseDenied',true,'legacyNewUuidAndTextCasePreserved',true,'oldPaidBodyRetained',true,'malformedManualMetadataPreserved',true,'observedWire',trace);
  raise exception 'Rollback synthetic review state' using errcode='ZX001';
 exception when sqlstate 'ZX001' then null;end;
 assert observed is not null;
 insert into public.site_copy_operation_fixture_results values('paid-fullrow-manual-restore-discard-legacy',observed);
end; $$;
select 'M07_SITE_COPY_ADMISSION_FULLROW_MANUAL_RESTORE_LEGACY_PASS';

-- Actual unchanged revision capture and staff history-shaped restore of an
-- ordinary block remain available. Direct system Site Copy UPDATE stays denied
-- by the old restrictive policy; the guarded save above is the allowed path.
do $$ declare ordinary uuid:=gen_random_uuid();snapshot jsonb;changed public.homepage_blocks%rowtype;rows_changed integer;observed jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 begin
  set local role authenticated;
  insert into public.homepage_blocks(id,block_type,title,settings,display_order,is_enabled,background_style,updated_by)
   values(ordinary,'text','Original ordinary authored title','{"ordinaryRaw":{"rights":"KEEP"}}',7,true,'paper','11111111-1111-4111-8111-111111111111');
  update public.homepage_blocks set title='Changed ordinary title',settings='{"ordinaryRaw":{"rights":"CHANGED"}}' where id=ordinary;
  reset role;
  -- The selected bare-PG foundation does not model managed default table
  -- grants. The fixture owner reads the actual captured old revision; the
  -- real staff role performs the exact ordinary CAS restore mutation below.
  select r.snapshot into snapshot from public.homepage_block_revisions r where homepage_block_id=ordinary order by revision_number desc limit 1;
  select * into changed from public.homepage_blocks where id=ordinary;
  set local role authenticated;
  update public.homepage_blocks set title=snapshot->>'title',settings=snapshot->'settings',display_order=(snapshot->>'display_order')::integer,
   is_enabled=(snapshot->>'is_enabled')::boolean,background_style=snapshot->>'background_style',updated_by='11111111-1111-4111-8111-111111111111'
   where id=ordinary and updated_at=changed.updated_at;
  get diagnostics rows_changed=row_count;assert rows_changed=1;
  assert (select title='Original ordinary authored title' and settings=snapshot->'settings' from public.homepage_blocks where id=ordinary);
  reset role;assert (select count(*)=2 from public.homepage_block_revisions where homepage_block_id=ordinary);set local role authenticated;
  update public.homepage_blocks set title='Unpermitted direct system restore' where settings->>'systemKey'='site-copy-overrides';
  get diagnostics rows_changed=row_count;assert rows_changed=0;
  reset role;observed:=jsonb_build_object('ordinaryHistoryShapedStaffMutationAllowed',true,'actualOldCaptureRevisions',2,'historySnapshotReadByFixtureOwner',true,
   'managedDefaultTableGrantsNotModeled',true,'directSystemRestoreOldRlsDenied',true,'providerCalls',0);
  raise exception 'Rollback synthetic ordinary restore' using errcode='ZX001';
 exception when sqlstate 'ZX001' then null;end;
 assert observed is not null;insert into public.site_copy_operation_fixture_results values('ordinary-history-restore-and-old-system-policy',observed);
end; $$;
select 'M07_SITE_COPY_ADMISSION_OLD_HISTORY_SHAPED_MUTATION_PASS';



do $$ declare a jsonb;args jsonb;bad jsonb;r jsonb;done jsonb;existing uuid;before_counts jsonb;after_counts jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);a:=public.site_copy_operation_fixture_seed(false);args:=public.site_copy_operation_fixture_begin_args(a);
 select id into existing from public.translation_jobs where kind<>'site_copy' limit 1;assert existing is not null;
 bad:=jsonb_set(args,'{p_job_id}',to_jsonb(existing));set local role authenticated;
 perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_call(%L,%L::jsonb)','begin_site_copy_translation_operation',bad),'40001');reset role;
 select id into existing from public.translation_job_items where entity_type<>'site_copy' limit 1;assert existing is not null;
 bad:=jsonb_set(args,'{p_item_id}',to_jsonb(existing));set local role authenticated;
 perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_call(%L,%L::jsonb)','begin_site_copy_translation_operation',bad),'40001');reset role;
 select operation_id into existing from premium_translation_private.writer_operation_artifacts limit 1;assert existing is not null;
 bad:=jsonb_set(args,'{p_operation_id}',to_jsonb(existing));set local role authenticated;
 perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_call(%L,%L::jsonb)','begin_site_copy_translation_operation',bad),'40001');reset role;
 select operation_id into existing from premium_translation_private.catalog_operation_artifacts where entity_type in('literary_work','country') limit 1;assert existing is not null;
 bad:=jsonb_set(args,'{p_operation_id}',to_jsonb(existing));set local role authenticated;
 perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_call(%L,%L::jsonb)','begin_site_copy_translation_operation',bad),'42501');reset role;
 before_counts:=jsonb_build_array((select count(*) from premium_translation_private.catalog_operation_artifacts),(select count(*) from public.translation_jobs),(select count(*) from public.translation_job_items));
 set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete immediate;
 set local role authenticated;
 perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_call(%L,%L::jsonb)','begin_site_copy_translation_operation',args),'42501');reset role;
 after_counts:=jsonb_build_array((select count(*) from premium_translation_private.catalog_operation_artifacts),(select count(*) from public.translation_jobs),(select count(*) from public.translation_job_items));
 assert before_counts=after_counts,'immediate incomplete construction rolled back all new rows';
 set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete deferred;
 set local role authenticated;r:=public.site_copy_operation_fixture_call('begin_site_copy_translation_operation',args);reset role;
 set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete immediate;
 set local role authenticated;done:=public.site_copy_operation_fixture_free(r);reset role;
 perform premium_translation_private.site_copy_operation_assert_constructed((r->>'operationId')::uuid);
 insert into public.site_copy_operation_fixture_results values('occupied-ids-and-manual-constraint-modes',jsonb_build_object('unrelatedJobDenied',true,'unrelatedItemDenied',true,
  'writerOperationUuidDenied',true,'catalogDomainUuidDenied',true,'immediateBeforeIncompleteRefused',true,'allNewRowsRolledBack',true,'immediateAfterCompletePassed',true,'finalActualAttemptProofPassed',true));
end; $$;
select 'M07_SITE_COPY_ADMISSION_IDS_SET_IMMEDIATE_PASS';

-- A forged zero-call terminal private receipt cannot omit its actual attempt,
-- even when real job/item writes exactly match its forged write projections.
do $$ declare args jsonb;r jsonb;done jsonb;a premium_translation_private.catalog_operation_artifacts%rowtype;
 forged premium_translation_private.catalog_operation_artifacts%rowtype;terminal premium_translation_private.catalog_operation_artifacts%rowtype;
 j public.translation_jobs%rowtype;i public.translation_job_items%rowtype;t public.translation_job_attempts%rowtype;
 rejected boolean:=false;actual_message text;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 begin
  args:=public.site_copy_operation_fixture_seed(false);set local role authenticated;r:=public.site_copy_operation_fixture_begin(args);done:=public.site_copy_operation_fixture_free(r);reset role;
  select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=(r->>'operationId')::uuid;
  forged:=public.site_copy_operation_fixture_forge(a);j:=jsonb_populate_record(null::public.translation_jobs,forged.job_write_proof);i:=jsonb_populate_record(null::public.translation_job_items,forged.item_write_proof);
  insert into premium_translation_private.catalog_operation_artifacts select forged.*;insert into public.translation_jobs select j.*;insert into public.translation_job_items select i.*;
  terminal:=forged;terminal.finish_fingerprint:=a.finish_fingerprint;
  terminal.final_receipt:=a.final_receipt||jsonb_build_object('jobId',forged.job_id,'itemId',forged.item_id,'operationId',forged.operation_id,'intentHash',forged.intent_hash);
  j:=jsonb_populate_record(null::public.translation_jobs,a.job_write_proof||jsonb_build_object('id',forged.job_id,'resume_cursor',forged.job_write_proof->'resume_cursor'));
  i:=jsonb_populate_record(null::public.translation_job_items,a.item_write_proof||jsonb_build_object('id',forged.item_id,'job_id',forged.job_id));
  t:=jsonb_populate_record(null::public.translation_job_attempts,a.attempt_write_proof||jsonb_build_object('id',nextval('public.translation_job_attempts_id_seq'),'item_id',forged.item_id,
   'staff_retry_operation_id',forged.operation_id,'staff_retry_receipt',(a.attempt_write_proof->'staff_retry_receipt')||jsonb_build_object('intentHash',forged.intent_hash,'receipt',terminal.final_receipt)));
  terminal.job_write_proof:=to_jsonb(j);terminal.item_write_proof:=to_jsonb(i);terminal.attempt_write_proof:=to_jsonb(t);
  update premium_translation_private.catalog_operation_artifacts set final_receipt=terminal.final_receipt,finish_fingerprint=terminal.finish_fingerprint,
   job_write_proof=terminal.job_write_proof,item_write_proof=terminal.item_write_proof,attempt_write_proof=terminal.attempt_write_proof where operation_id=forged.operation_id;
  update public.translation_jobs set status=j.status,version=j.version,completed_at=j.completed_at,updated_at=j.updated_at,resume_cursor=j.resume_cursor where id=forged.job_id;
  update public.translation_job_items set status=i.status,attempt_count=i.attempt_count,staff_retry=null,updated_at=i.updated_at,last_error_code=i.last_error_code where id=forged.item_id;
  -- Intentionally omit the real translation_job_attempts INSERT.
  set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete immediate;
 exception when insufficient_privilege then rejected:=true;actual_message:=sqlerrm;end;
 assert rejected and actual_message='Site Copy completed admission actual attempt differs','reverse proof must reach missing actual terminal attempt';
 assert not exists(select 1 from premium_translation_private.catalog_operation_artifacts where operation_id=forged.operation_id);
 assert not exists(select 1 from public.translation_jobs where id=forged.job_id);
 insert into public.site_copy_operation_fixture_results values('missing-real-terminal-attempt',jsonb_build_object('rejected',true,'databaseCode','42501','message',actual_message,'allConstructionRolledBack',true));
end; $$;
select 'M07_SITE_COPY_ADMISSION_REAL_TERMINAL_ATTEMPT_PASS';

-- Readiness covers the whole increment. Missing metadata freshness closes new
-- expense capability while original private artifact GET remains owner-readable.
do $$ declare r jsonb;artifact jsonb;before_wire uuid[];trace jsonb;observed jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 select coalesce(array_agg(id),'{}'::uuid[]) into before_wire from public.site_copy_operation_fixture_wire;
 begin
  drop function public.get_site_copy_translation_candidate_freshness(text,uuid,bigint,text,text);
  set local role authenticated;
  assert public.site_copy_operation_fixture_call('site_copy_translation_operation_ready','{}')='false'::jsonb;
  r:=public.site_copy_operation_fixture_call('reconcile_site_copy_translation_operation','{"p_operation_id":null}');
  artifact:=public.site_copy_operation_fixture_artifact(r);assert artifact#>>'{receipt,operationId}'=r->>'operationId';reset role;
  select coalesce(jsonb_agg(to_jsonb(w) order by at_time,id),'[]'::jsonb) into trace from public.site_copy_operation_fixture_wire w where not(w.id=any(before_wire));
  observed:=jsonb_build_object('missingFreshnessReadyFalse',true,'ownerArtifactStillReadable',true,'observedWire',trace);
  raise exception 'Rollback only new reader capability removal' using errcode='ZX001';
 exception when sqlstate 'ZX001' then null;end;
 set local role authenticated;assert public.site_copy_operation_fixture_call('site_copy_translation_operation_ready','{}')='true'::jsonb;reset role;
 assert observed is not null;insert into public.site_copy_operation_fixture_results values('missing-freshness-capability-restored',observed);
end; $$;
select 'M07_SITE_COPY_ADMISSION_READINESS_FULL_INCREMENT_PASS';

-- Every existing configured translation/repair/review sequence keeps its
-- original models and one-attempt/four-reservation cap for both providers.
do $$ declare sequence text;passes text[];pass text;a jsonb;r jsonb;done jsonb;review boolean;mode text;count_calls integer;observed jsonb:='[]';begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach sequence in array array['translation,repair','translation,repair,review','translation,review,repair','translation,repair,review,repair'] loop
  set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete deferred;
  review:=position('review' in sequence)>0;a:=public.site_copy_operation_fixture_seed(review);
  mode:=case when review then 'openai' else 'cloudflare' end;a:=jsonb_set(a,'{configuration,provider}',to_jsonb(mode));
  set local role authenticated;r:=public.site_copy_operation_fixture_begin(a);
  perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_call(%L,%L::jsonb)','record_site_copy_translation_operation_dispatch',public.site_copy_operation_fixture_dispatch_args(r,'review')),case when review then '40001' else '22023' end);
  passes:=string_to_array(sequence,',');count_calls:=0;
  foreach pass in array passes loop r:=public.site_copy_operation_fixture_pass(r,pass,a->'payload');count_calls:=count_calls+1;end loop;
  assert (r->>'providerCalls')::integer=count_calls;
  if count_calls=4 then
   perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_call(%L,%L::jsonb)','record_site_copy_translation_operation_dispatch',public.site_copy_operation_fixture_dispatch_args(r,'repair')),'40001');
  elsif not review then
   perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_call(%L,%L::jsonb)','record_site_copy_translation_operation_dispatch',public.site_copy_operation_fixture_dispatch_args(r,'repair')),'22023');
  end if;
  done:=public.site_copy_operation_fixture_finish(r,a->'payload');assert done#>>'{result,state}'='translated';reset role;
  set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete immediate;
  observed:=observed||jsonb_build_array(jsonb_build_object('sequence',sequence,'provider',mode,'providerCalls',count_calls,'finished',done));
 end loop;
 insert into public.site_copy_operation_fixture_results values('configured-repairs-and-reservation-caps',observed);
end; $$;
select 'M07_SITE_COPY_ADMISSION_REPAIR_POLICY_CAPS_PASS';

-- The original one structured batch admits exactly50 selected keys; SQL does
-- not silently slice51 or reserve more than one journal item/attempt.
do $$ declare a jsonb;r jsonb;done jsonb;items jsonb;ru jsonb;b public.homepage_blocks%rowtype;rejected boolean:=false;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);a:=public.site_copy_operation_fixture_seed(false);
 select jsonb_object_agg('key'||n,'Исходник '||n),jsonb_agg(jsonb_build_object('key','key'||n,'text','Исходник '||n,'sourceHash',repeat('f',64)) order by n)
  into ru,items from generate_series(1,51)n;
 update public.homepage_blocks set settings=jsonb_set(settings,'{siteCopy,ru}',(settings#>'{siteCopy,ru}')||ru) where id=(a->>'entityId')::uuid;
 select * into b from public.homepage_blocks where id=(a->>'entityId')::uuid;
 a:=a||jsonb_build_object('sourceSnapshot',jsonb_build_object('settings',b.settings,'items',items-50),
  'sourceRevision',jsonb_build_object('blockId',b.id,'blockUpdatedAt',b.updated_at),'targetRevision',jsonb_build_object('id',b.id,'updatedAt',b.updated_at),
  'expectedState',jsonb_build_object('version',1,'block',jsonb_build_object('id',b.id,'settings',b.settings,'updated_at',b.updated_at)));
 set local role authenticated;r:=public.site_copy_operation_fixture_begin(a);done:=public.site_copy_operation_fixture_free(r);reset role;
 assert (select total_items=1 from public.translation_jobs where id=(r->>'jobId')::uuid);
 assert (select max_attempts=1 and attempt_count=1 from public.translation_job_items where id=(r->>'itemId')::uuid);
 a:=jsonb_set(a,'{sourceSnapshot,items}',items);set local role authenticated;
 perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_begin(%L::jsonb)',a),'40001');reset role;
 begin
  insert into public.homepage_blocks(id,block_type,title,settings,display_order,is_enabled,background_style,updated_by)
   values(gen_random_uuid(),'text','DUPLICATE SHOULD FAIL',b.settings,0,false,'paper','11111111-1111-4111-8111-111111111111');
 exception when unique_violation then rejected:=true;end;
 assert rejected and(select count(*)=1 from public.homepage_blocks where settings->>'systemKey'='site-copy-overrides');
 insert into public.site_copy_operation_fixture_results values('fifty-selected-one-item-and-existing-singleton-index',jsonb_build_object('selected50Admitted',true,'selected51Refused',true,
  'oneItemOneAttempt',true,'oldSingletonIndexRejectedDuplicate',true,'providerCalls',0));
end; $$;
select 'M07_SITE_COPY_ADMISSION_FIFTY_SINGLETON_BOUNDARY_PASS';

-- New private triggers keep old book/country paid flows working and the old
-- public catalog RPC family still refuses the new site_copy domain.
do $$ declare kind text;a jsonb;r jsonb;done jsonb;site jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach kind in array array['literary_work','country'] loop
  a:=public.catalog_fixture_seed(kind,'after-site-copy-'||gen_random_uuid()::text,true);set local role authenticated;
  r:=public.catalog_fixture_begin(a);r:=public.catalog_fixture_pass(r,'translation',a->'payload');r:=public.catalog_fixture_pass(r,'review',a->'payload');
  done:=public.catalog_fixture_finish(r,a->'payload');assert done#>>'{result,state}'='translated';reset role;
 end loop;
 site:=public.site_copy_operation_fixture_seed(false);set local role authenticated;
 perform public.premium_fixture_error(format('select public.begin_catalog_translation_operation(%L,%L,%L,%L,%L,%L,%L,%L::jsonb,%L::jsonb,%L::jsonb,%L::jsonb,%L::jsonb,%L::jsonb,%L::jsonb)',
  gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'site_copy',site->>'entityId','cloudflare',site->>'sourceHash',site->'sourceSnapshot',site->'sourceRevision',site->'targetRevision',
  site->'expectedState',site->'configuration','{}'::jsonb,'{}'::jsonb),'22023');reset role;
 insert into public.site_copy_operation_fixture_results values('old-catalog-flows-after-new-triggers',jsonb_build_object('bookPaidFlow',true,'countryPaidFlow',true,'oldCatalogSiteCopyDomainRefused',true));
end; $$;
select 'M07_SITE_COPY_ADMISSION_OLD_DOMAINS_UNCHANGED_PASS';













-- Confirmed partial output before the real original deadline stays retained.
-- The elapsed wait uses the actual server clock; no changed clock function,
-- GUC deadline, cache rewrite, or expired-operation restart is used.
do $$ declare a jsonb;r jsonb;partial jsonb;blocked jsonb;artifact jsonb;before_wire uuid[];observed jsonb;trace jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 select coalesce(array_agg(id),'{}'::uuid[]) into before_wire from public.site_copy_operation_fixture_wire;
 begin
  a:=public.site_copy_operation_fixture_seed(true);set local role authenticated;r:=public.site_copy_operation_fixture_begin(a);
  partial:=public.site_copy_operation_fixture_pass(r,'translation',a->'payload');artifact:=public.site_copy_operation_fixture_artifact(partial);
  assert partial->>'phase'='running' and partial->'pendingCallId'='null'::jsonb and partial->'providerCalls'='1'::jsonb;
  perform pg_sleep(45.1);
  blocked:=public.site_copy_operation_fixture_call('reconcile_site_copy_translation_operation',jsonb_build_object('p_operation_id',r->'operationId'));
  assert blocked->>'blockReason'='operation_deadline' and blocked->'canExecute'='false'::jsonb and blocked->'canDispatch'='false'::jsonb;
  perform public.premium_fixture_error(format('select public.site_copy_operation_fixture_call(%L,%L::jsonb)','record_site_copy_translation_operation_dispatch',public.site_copy_operation_fixture_dispatch_args(r,'review')),'40001');
  perform public.premium_fixture_error(format('select public.finish_site_copy_translation_operation(%L,%L,%L,%L::jsonb,null)',r->>'jobId',r->>'itemId',r->>'operationId',jsonb_build_object('status','dead_letter','providerCalls',1)),'40001');
  blocked:=public.site_copy_operation_fixture_call('begin_site_copy_translation_operation',public.site_copy_operation_fixture_begin_args(a));
  assert blocked->>'operationId'=r->>'operationId' and blocked->>'blockReason'='operation_deadline';
  assert (public.site_copy_operation_fixture_artifact(blocked)->'calls')=artifact->'calls';
  reset role;set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete immediate;
  select coalesce(jsonb_agg(to_jsonb(w) order by at_time,id),'[]'::jsonb) into trace from public.site_copy_operation_fixture_wire w where not(w.id=any(before_wire));
  observed:=jsonb_build_object('beforeDeadline',partial,'afterDeadline',blocked,'artifact',artifact,'observedWire',trace,'realElapsedDeadline',true,'noReviewerStarted',true);
  raise exception 'Rollback synthetic partial state' using errcode='ZX001';
 exception when sqlstate 'ZX001' then null;end;
 assert observed is not null;
 insert into public.site_copy_operation_fixture_results values('confirmed-partial-real-deadline',observed);
end; $$;
select 'M07_SITE_COPY_ADMISSION_PARTIAL_REAL_DEADLINE_PASS';

-- A first body arriving after the actual original deadline is still retained.
-- Finishing its already complete optional-review sequence costs no new call.
do $$ declare a jsonb;r jsonb;pending jsonb;late jsonb;done jsonb;artifact jsonb;before_wire uuid[];observed jsonb;trace jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 select coalesce(array_agg(id),'{}'::uuid[]) into before_wire from public.site_copy_operation_fixture_wire;
 begin
  a:=public.site_copy_operation_fixture_seed(false);set local role authenticated;r:=public.site_copy_operation_fixture_begin(a);
  pending:=public.site_copy_operation_fixture_call('record_site_copy_translation_operation_dispatch',public.site_copy_operation_fixture_dispatch_args(r,'translation'));
  perform pg_sleep(45.1);
  late:=public.site_copy_operation_fixture_call('reconcile_site_copy_translation_operation',jsonb_build_object('p_operation_id',r->'operationId'));
  assert late->>'blockReason'='provider_outcome_unknown' and late->'pendingCallId'=pending->'pendingCallId';
  late:=public.site_copy_operation_fixture_ack(pending,a->'payload');assert late->>'blockReason'='operation_deadline';
  artifact:=public.site_copy_operation_fixture_artifact(late);
  assert artifact#>'{calls,0,responseArtifact,body}'=jsonb_build_object('response',(a->'payload')::text);
  done:=public.site_copy_operation_fixture_finish(late,a->'payload');assert done#>>'{result,state}'='translated' and done->'providerCalls'='1'::jsonb;
  reset role;set constraints premium_translation_private.catalog_artifacts_site_copy_admission_complete immediate;
  select coalesce(jsonb_agg(to_jsonb(w) order by at_time,id),'[]'::jsonb) into trace from public.site_copy_operation_fixture_wire w where not(w.id=any(before_wire));
  observed:=jsonb_build_object('unknownAfterDeadline',pending,'lateFirstAck',late,'artifact',artifact,'completeNoNewExpense',done,'realElapsedDeadline',true,'observedWire',trace);
  raise exception 'Rollback synthetic late response' using errcode='ZX001';
 exception when sqlstate 'ZX001' then null;end;
 assert observed is not null;insert into public.site_copy_operation_fixture_results values('first-body-after-real-deadline-complete-retention',observed);
end; $$;
select 'M07_SITE_COPY_ADMISSION_FIRST_BODY_AFTER_DEADLINE_PASS';

-- Actual unchanged JS builder/hash + actual production one-pass raw response,
-- then real native journal. The owner runner derives FINISH through the actual
-- installed SDK/retained helper from this native GET, never a copied test time.
create function public.site_copy_operation_fixture_real_js_input()
returns jsonb language sql immutable set search_path='' as $$ select $native_real_js${"sourceSnapshot":{"settings":{"siteCopy":{"en":{"intro":"Existing machine copy","manual":"Keep authored English","unrelated":{"raw":true}},"fr":{"intro":"  Fran\u00e7ais intact  ","rights":["\u00e9diteur",null]},"ru":{"cta":"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0440\u0442\u0443","intro":"  \u0418\u0441\u0445\u043e\u0434\u043d\u044b\u0439 \u2014 \u0442\u0435\u043a\u0441\u0442\r\n\u0441 \u043d\u043e\u0432\u043e\u0439 \u0441\u0442\u0440\u043e\u043a\u043e\u0439  ","manual":"\u0420\u0443\u0447\u043d\u043e\u0439 \u0440\u0443\u0441\u0441\u043a\u0438\u0439"},"localeExtension":{"preserve":true}},"systemKey":"site-copy-overrides","unknownSettings":{"empty":[],"rights":{"owner":"editor"}},"premiumTranslation":{"siteCopyEn":{"intro":{"sourceHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","customMachine":{"rights":"keep"}},"unselected":{"raw":"preserved"}},"customPremium":["keep",null]}},"items":[{"key":"cta","text":"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0440\u0442\u0443","sourceHash":"26e9cfce4f747547b41d586b515412a7ed47d71f37bab9afe42bb41b36fc0f21"},{"key":"intro","text":"\u0418\u0441\u0445\u043e\u0434\u043d\u044b\u0439 - \u0442\u0435\u043a\u0441\u0442\r\n\u0441 \u043d\u043e\u0432\u043e\u0439 \u0441\u0442\u0440\u043e\u043a\u043e\u0439","sourceHash":"98dd0fd83450cc0134dc053d9df7152805b640580254ff3eb0d5622c57a7fab0"}]},"sourceHash":"428450394708d92b258fe25a1360ef780c7899187952036ae000a13e8a851944","configuration":{"version":1,"provider":"cloudflare","model":"fixture-translator","reviewerModel":"fixture-reviewer","twoPassReview":false,"translatorReasoningEffort":"none","translatorReasoningMode":"standard","reviewerReasoningEffort":"none","reviewerReasoningMode":"standard","promptFingerprint":"472b1cbb789ca7df7bf60be740c7a3d724b4006cbe71f31b95d901d1a94f8e7f","schemaName":"probpera_site_copy_translation","maxOutputTokens":12000},"dispatch":{"p_job_id":"fb3babd6-416f-44d2-8fd2-dfb04280b6ee","p_item_id":"269be366-4459-4f4f-b412-ef7787c2f963","p_operation_id":"0c5659de-cc83-45fe-bd74-65bd4d3e396b","p_call_id":"a3f91af3-70b4-49d0-b205-0f22a7a0a83a","p_provider":"cloudflare","p_model":"fixture-translator","p_pass":"translation","p_request_hash":"083aedaa8788840e97bd8099d30d957d4e418e78fcd6ae4a7dd2aaa15af960e4"},"responseMetadata":{"callId":"a3f91af3-70b4-49d0-b205-0f22a7a0a83a","provider":"cloudflare","model":"fixture-translator","pass":"translation","httpStatus":null,"requestId":null,"responseId":"controlled-site-copy-1","inputTokens":11,"outputTokens":13},"responseArtifact":{"version":1,"body":{"id":"controlled-site-copy-1","response":"{\"items\":[{\"key\":\"cta\",\"text\":\"Find books in the catalogue\"},{\"key\":\"intro\",\"text\":\"Find books in the catalogue\"}]}","usage":{"prompt_tokens":11,"completion_tokens":13}}},"orderedPayload":{"items":[{"key":"cta","text":"Find books in the catalogue"},{"key":"intro","text":"Find books in the catalogue"}]}}$native_real_js$::jsonb; $$;
do $$ declare input jsonb;a jsonb;r jsonb;request jsonb;metadata jsonb;artifact jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 input:=public.site_copy_operation_fixture_real_js_input();a:=public.site_copy_operation_fixture_seed(false);
 assert a#>'{sourceSnapshot,settings}'=input#>'{sourceSnapshot,settings}','actual native canonical settings equal production builder input';
 a:=a||jsonb_build_object('sourceSnapshot',input->'sourceSnapshot','sourceHash',input->'sourceHash','configuration',input->'configuration','payload',input->'orderedPayload');
 set local role authenticated;r:=public.site_copy_operation_fixture_begin(a);
 request:=(input->'dispatch')||jsonb_build_object('p_job_id',r->'jobId','p_item_id',r->'itemId','p_operation_id',r->'operationId','p_call_id',gen_random_uuid());
 r:=public.site_copy_operation_fixture_call('record_site_copy_translation_operation_dispatch',request);
 metadata:=(input->'responseMetadata')||jsonb_build_object('callId',r->'pendingCallId');
 r:=public.site_copy_operation_fixture_call('record_site_copy_translation_operation_response',jsonb_build_object('p_job_id',r->'jobId','p_item_id',r->'itemId','p_operation_id',r->'operationId',
  'p_metadata',metadata,'p_response_artifact',input->'responseArtifact'));
 artifact:=public.site_copy_operation_fixture_artifact(r);reset role;
 assert artifact#>>'{receipt,sourceHash}'='428450394708d92b258fe25a1360ef780c7899187952036ae000a13e8a851944';
 insert into public.site_copy_operation_fixture_results values('real-js-native-input',jsonb_build_object('artifact',artifact,'expectedPayload',input->'orderedPayload',
  'actualBuilderSeedSha256','f5e49f4925b44ce0d2fcc023d2c9c40a7557bf2173b722f7171959808ca7354d','nativeReceiptBodyBeforeTrustedFinish',true));
end; $$;
select 'M07_SITE_COPY_NATIVE_REAL_JS_INPUT_RECORDED_PASS';
