-- Isolated PG17 fixture only. Synthetic Auth/canonical fixtures precede the
-- unchanged Translation Operations/article/private SQL and the new migration.
reset role;
create table public.writer_operation_fixture_results(label text primary key,value jsonb not null);
alter table public.writer_operation_fixture_results enable row level security;
create policy writer_operation_fixture_staff on public.writer_operation_fixture_results for all to authenticated
  using(public.is_staff()) with check(public.is_staff());
grant select,insert,update on public.writer_operation_fixture_results to authenticated;
create function public.writer_operation_fixture_config()
returns jsonb language sql immutable set search_path='' as $$ select jsonb_build_object('version',1,'provider','cloudflare','model','fixture-translator',
  'reviewerModel','fixture-reviewer','twoPassReview',true,'translatorReasoningEffort','none','translatorReasoningMode','standard',
  'reviewerReasoningEffort','none','reviewerReasoningMode','standard','promptFingerprint',repeat('d',64),
  'schemaName','probpera_writer_biography_translation','maxOutputTokens',4000); $$;
create function public.writer_operation_fixture_begin(writer text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare args jsonb:=public.writer_private_fixture_args('operation-country:'||writer); fields jsonb;
begin
 select w.fields into fields from public.writer_profile_overrides w where country_id='operation-country' and writer_id=writer;
 return public.begin_writer_translation_operation(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'operation-country',writer,'cloudflare',
   args->>'sourceHash',args->'source',args->'sourceRevision',args->'targetRevision',fields,public.writer_operation_fixture_config(),'{"writerCursor":6}','{"writerCursor":7}');
end; $$;
create function public.writer_operation_fixture_dispatch(r jsonb,pass text)
returns jsonb language plpgsql set search_path='' as $$ begin
 return public.record_writer_translation_operation_dispatch((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,
  gen_random_uuid(),'cloudflare',case when pass='translation' then 'fixture-translator' else 'fixture-reviewer' end,pass,repeat('e',64));
end; $$;
create function public.writer_operation_fixture_response(r jsonb)
returns jsonb language sql set search_path='' as $$ select public.record_writer_translation_operation_response((r->>'jobId')::uuid,(r->>'itemId')::uuid,
 (r->>'operationId')::uuid,jsonb_build_object('callId',r->'pendingCallId','provider','cloudflare',
 'model',case when r->>'providerCalls'='1' then 'fixture-translator' else 'fixture-reviewer' end,
 'pass',case when r->>'providerCalls'='1' then 'translation' else 'review' end,
 'httpStatus',null,'requestId',null,'responseId',null,'inputTokens',5,'outputTokens',6),
 jsonb_build_object('version',1,'body',jsonb_build_object('response',jsonb_build_object('text','Ivan Author was born in 1900 and worked at the Archive, where he studied surviving manuscripts. He wrote a novel in 1930 and also taught literature during his scholarly career.')))); $$;
create function public.writer_operation_fixture_finish(r jsonb)
returns jsonb language plpgsql set search_path='' as $$ declare a jsonb; args jsonb; candidate jsonb; begin
 a:=public.get_writer_translation_operation_artifacts((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,r->>'intentHash',r->>'sourceHash');
 args:=public.writer_private_fixture_args(r->>'entityId');
 candidate:=jsonb_build_object('payload',args->'payload','provenance',(args->'provenance')||'{"translatorRequestId":null,"reviewerRequestId":null}'::jsonb,
   'translatorCallId',a->'calls'->0->'metadata'->'callId','reviewerCallId',a->'calls'->1->'metadata'->'callId');
 return public.finish_writer_translation_operation((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,
   '{"status":"succeeded","providerCalls":2,"model":"fixture-translator"}',candidate);
end; $$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ declare r jsonb; d jsonb; replay jsonb; a jsonb; begin
 assert public.writer_translation_operation_ready() is true;
 r:=public.writer_operation_fixture_begin('unknown-writer');assert r->'canExecute'='true'::jsonb;
 d:=public.writer_operation_fixture_dispatch(r,'translation');assert d->'canDispatch'='true'::jsonb;
 replay:=public.writer_operation_fixture_begin('unknown-writer');
 assert replay->>'operationId'=r->>'operationId' and replay->'canExecute'='false'::jsonb and replay->>'blockReason'='provider_outcome_unknown';
 assert replay->'resumeCursor'='{"writerCursor":6}'::jsonb;
 perform public.premium_fixture_error(format('select public.finish_writer_translation_operation(%L,%L,%L,%L::jsonb)',
  r->>'jobId',r->>'itemId',r->>'operationId','{"status":"dead_letter","providerCalls":1,"errorCode":"provider_request_failed"}'),'40001');
 a:=public.get_writer_translation_operation_artifacts((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,r->>'intentHash',r->>'sourceHash');
 assert a->'candidate'='null'::jsonb and a->'calls'->0->'metadata'->'responseReceivedAt'='null'::jsonb;
 insert into public.writer_operation_fixture_results values('unknown-admission',replay);
 r:=public.writer_operation_fixture_begin('complete-writer');
 r:=public.writer_operation_fixture_response(public.writer_operation_fixture_dispatch(r,'translation'));
 a:=public.get_writer_translation_operation_artifacts((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,r->>'intentHash',r->>'sourceHash');
 assert a->'candidate'='null'::jsonb and a->'calls'->0->'metadata'->'responseReceivedAt'<>'null'::jsonb;
 r:=public.writer_operation_fixture_response(public.writer_operation_fixture_dispatch(r,'review'));
 d:=public.writer_operation_fixture_finish(r);
 assert d->>'phase'='finished' and d->'result'->>'state'='translated' and d->'result'->>'persistence'='working-draft';
 assert d->'resumeCursor'='{"writerCursor":7}'::jsonb;
 replay:=public.writer_operation_fixture_finish(r);assert replay->'replayed'='true'::jsonb and replay->'canDispatch'='false'::jsonb;
 assert replay->'result'=d->'result';
 assert public.reconcile_writer_translation_operation('operation-country','complete-writer',(d->>'operationId')::uuid)->'result'=d->'result';
 insert into public.writer_operation_fixture_results values('complete-receipt-recovery',d);
end; $$;
reset role;
select 'M07_WRITER_OPERATIONS_INITIAL_PASS';

-- Authenticated has read-only journal ACL; private artifacts have no direct
-- staff/service table grants. A different staff actor can discover the barrier
-- but cannot replay a paid operation or read its raw private cache.
set role anon;
select public.premium_fixture_error('select public.writer_translation_operation_ready()','42501');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','',false);
select public.premium_fixture_error('select public.writer_translation_operation_ready()','42501');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.premium_fixture_error('select public.writer_translation_operation_ready()','42501');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$ declare r jsonb; newer jsonb; begin
 r:=public.reconcile_writer_translation_operation('operation-country','unknown-writer');
 assert r->>'blockReason'='operation_owned_by_another_actor';
 newer:=public.writer_operation_fixture_begin('unknown-writer');assert newer->>'operationId'=r->>'operationId' and newer->'canExecute'='false'::jsonb;
 perform public.premium_fixture_error(format('select public.get_writer_translation_operation_artifacts(%L,%L,%L,%L,%L)',
   r->>'jobId',r->>'itemId',r->>'operationId',r->>'intentHash',r->>'sourceHash'),'42501');
end; $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.premium_fixture_error('update public.translation_job_items set staff_retry=null','42501');
select public.premium_fixture_error('delete from public.translation_jobs','42501');
select public.premium_fixture_error('select * from premium_translation_private.writer_operation_artifacts','42501');
reset role;
set role service_role;
select public.premium_fixture_error($q$update public.translation_job_items set staff_retry=null where entity_id='operation-country:unknown-writer'$q$,'42501');
select public.premium_fixture_error($q$update public.translation_job_items set entity_id='operation-country:tampered' where entity_id='operation-country:unknown-writer'$q$,'42501');
select public.premium_fixture_error($q$update public.translation_job_items set id=gen_random_uuid() where entity_id='operation-country:unknown-writer'$q$,'42501');
select public.premium_fixture_error($q$update public.translation_job_items set staff_retry=jsonb_set(staff_retry,'{progress,calls,0,responseReceivedAt}','"2026-10-29T20:00:00Z"') where entity_id='operation-country:unknown-writer'$q$,'42501');
select public.premium_fixture_error($q$delete from public.translation_jobs where resume_cursor->'writerOperation'->>'operationId' is not null$q$,'42501');
select public.premium_fixture_error('select * from premium_translation_private.writer_operation_artifacts','42501');
reset role;
insert into public.writer_operation_fixture_results values('auth-and-direct-tamper','true');

-- Exact replay bindings, response retention, zero-dispatch reconciliation,
-- stopped unknown admissions, and no repeated call after acknowledged output.
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ declare r jsonb; d jsonb; replay jsonb; call jsonb; a jsonb; begin
 r:=public.writer_operation_fixture_begin('ack-writer');d:=public.writer_operation_fixture_dispatch(r,'translation');
 replay:=public.record_writer_translation_operation_dispatch((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,
   (d->>'pendingCallId')::uuid,'cloudflare','fixture-translator','translation',repeat('e',64));
 assert replay->'replayed'='true'::jsonb and replay->'canDispatch'='false'::jsonb;
 replay:=public.writer_operation_fixture_response(d);assert replay->>'phase'='running';
 replay:=public.writer_operation_fixture_response(d);assert replay->'replayed'='true'::jsonb;
 a:=public.get_writer_translation_operation_artifacts((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,r->>'intentHash',r->>'sourceHash');
 assert jsonb_array_length(a->'calls')=1 and a->'candidate'='null'::jsonb;
 call:=a->'calls'->0;
 perform public.premium_fixture_error(format('select public.record_writer_translation_operation_response(%L,%L,%L,%L::jsonb,%L::jsonb)',
   r->>'jobId',r->>'itemId',r->>'operationId',((call->'metadata')-array['dispatchRecordedAt','responseReceivedAt'])::text,'{"version":1,"body":"changed"}'),'40001');
 perform public.premium_fixture_error(format('select public.get_writer_translation_operation_artifacts(%L,%L,%L,%L,%L)',
   r->>'jobId',r->>'itemId',r->>'operationId',repeat('f',64),r->>'sourceHash'),'40001');
 r:=public.writer_operation_fixture_begin('zero-writer');
 replay:=public.finish_writer_translation_operation((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,'{"status":"skipped","providerCalls":0}');
 assert replay->>'phase'='finished' and replay->'resumeCursor'='{"writerCursor":6}'::jsonb;
 perform public.premium_fixture_error(format('select public.writer_operation_fixture_dispatch(%L::jsonb,''translation'')',r::text),'40001');
 r:=public.reconcile_writer_translation_operation('operation-country','unknown-writer');
 perform public.request_translation_job_cancel((r->>'jobId')::uuid,(r->>'jobVersion')::bigint);
 replay:=public.writer_operation_fixture_begin('unknown-writer');assert replay->>'blockReason'='provider_outcome_unknown';
 assert replay->'resumeCursor'='{"writerCursor":6}'::jsonb and replay->'providerCalls'='1'::jsonb;
 insert into public.writer_operation_fixture_results values('ack-replay-and-cancel',replay);
end; $$;
reset role;

-- Completed paid bodies survive RU/source, manual-EN and rights drift without
-- overwriting any canonical byte. Stale candidates remain unpromotable under
-- the pre-existing explicit-review/current-CAS contract.
insert into public.writer_profile_overrides(country_id,writer_id,fields,updated_at)
 select 'operation-country',name,public.writer_private_fixture_catalog(),'2026-10-01T10:00:00Z' from unnest(array['stale-writer','manual-writer','rights-writer']) name;
do $$ declare name text; r jsonb; done jsonb; before_row jsonb; before_outbox bigint; before_revision bigint; draft jsonb; begin
 for name in select unnest(array['stale-writer','manual-writer','rights-writer']) loop
  set local role authenticated;perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  r:=public.writer_operation_fixture_begin(name);
  r:=public.writer_operation_fixture_response(public.writer_operation_fixture_dispatch(r,'translation'));
  r:=public.writer_operation_fixture_response(public.writer_operation_fixture_dispatch(r,'review'));
  reset role;
  update public.writer_profile_overrides set fields=case name
    when 'stale-writer' then jsonb_set(fields,'{biographyTranslations,ru,text}','"AUTHOR CHANGED RU source while provider was running"')
    when 'manual-writer' then jsonb_set(fields,'{biographyTranslations,en,method}','"human-translation"')
    else jsonb_set(fields,'{rights}','{"owner":"NEW AUTHOR RIGHTS"}') end where country_id='operation-country' and writer_id=name;
  select to_jsonb(w) into before_row from public.writer_profile_overrides w where country_id='operation-country' and writer_id=name;
  select count(*) into before_outbox from public.premium_fixture_outbox;
  select count(*) into before_revision from public.writer_profile_override_revisions;
  set local role authenticated;
  done:=public.writer_operation_fixture_finish(r);
  assert done->'result'->>'persistence'='working-draft' and done->'result'->>'humanReview'='pending';
  assert done->'result'->>'state'=case when name='stale-writer' then 'stale' else 'conflict' end;
  draft:=public.get_premium_translation_working_draft('writer_biography','operation-country:'||name)->'draft';
  perform public.premium_fixture_error(format('select public.writer_private_fixture_promote(%L::jsonb)',draft::text),'40001');
  reset role;
  assert (select to_jsonb(w)=before_row from public.writer_profile_overrides w where country_id='operation-country' and writer_id=name);
  assert (select count(*)=before_outbox from public.premium_fixture_outbox);
  assert (select count(*)=before_revision from public.writer_profile_override_revisions);
  insert into public.writer_operation_fixture_results values(name,done);
 end loop;
end; $$;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ declare r jsonb; done jsonb; prior jsonb; args jsonb; a jsonb; begin
 r:=public.writer_operation_fixture_begin('slot-writer');
 r:=public.writer_operation_fixture_response(public.writer_operation_fixture_dispatch(r,'translation'));
 r:=public.writer_operation_fixture_response(public.writer_operation_fixture_dispatch(r,'review'));
 args:=public.writer_private_fixture_args('operation-country:slot-writer');
 prior:=public.premium_fixture_stage(args)->'draft';
 done:=public.writer_operation_fixture_finish(r);
 assert done->'result'->>'state'='conflict' and done->'result'->>'persistence'='private-artifact';
 assert done->'result'->'draftId'='null'::jsonb and done->'result'->'draftVersion'='null'::jsonb and done->'result'->'draftUpdatedAt'='null'::jsonb;
 assert public.get_premium_translation_working_draft('writer_biography','operation-country:slot-writer')->'draft'=prior;
 a:=public.get_writer_translation_operation_artifacts((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,r->>'intentHash',r->>'sourceHash');
 assert jsonb_typeof(a->'candidate')='object' and jsonb_array_length(a->'calls')=2;
 insert into public.writer_operation_fixture_results values('pending-slot-takeover',done);
end; $$;
reset role;
do $$ declare r jsonb; begin
 assert (select count(*)=1 from public.translation_job_attempts where item_id=(select item_id from premium_translation_private.writer_operation_artifacts where entity_id='operation-country:complete-writer'));
 assert not exists(select 1 from public.translation_job_items where staff_retry::text like '%Ivan Author%' or staff_retry::text like '%RAW RU RIGHTS%');
 assert not exists(select 1 from public.translation_job_attempts where staff_retry_receipt::text like '%Ivan Author%' or staff_retry_receipt::text like '%RAW RU RIGHTS%');
 assert not exists(select 1 from public.admin_audit_log where action like 'translation.writer_operation.%' and (metadata::text like '%Ivan Author%' or metadata::text like '%RAW RU RIGHTS%'));
 assert not has_function_privilege('authenticated','public.claim_translation_job_items(text,integer,integer)','EXECUTE');
 assert not has_function_privilege('authenticated','public.complete_translation_job_item(uuid,text,boolean,text,text,text,integer,integer,integer)','EXECUTE');
 insert into public.writer_operation_fixture_results values('metadata-privacy-and-one-attempt','true');
end; $$;
select 'M07_WRITER_OPERATIONS_FULL_PASS';

-- Metadata readiness checks the actual RPC and enabled integrity guard, not
-- merely the existence of a table. These alterations are fixture-local only.
do $$ begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 alter table public.translation_job_items disable trigger translation_items_writer_integrity;
 assert public.writer_translation_operation_ready() is false;
 alter table public.translation_job_items enable trigger translation_items_writer_integrity;
 alter function public.reconcile_writer_translation_operation(text,text,uuid) rename to writer_fixture_missing_reconcile;
 assert public.writer_translation_operation_ready() is false;
 alter function public.writer_fixture_missing_reconcile(text,text,uuid) rename to reconcile_writer_translation_operation;
 revoke execute on function public.get_writer_translation_operation_artifacts(uuid,uuid,uuid,text,text) from authenticated;
 assert public.writer_translation_operation_ready() is false;
 grant execute on function public.get_writer_translation_operation_artifacts(uuid,uuid,uuid,text,text) to authenticated;
 assert public.writer_translation_operation_ready() is true;
 insert into public.writer_operation_fixture_results values('readiness-current-missing-disabled-acl','true');
end; $$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ declare args jsonb; config jsonb; r jsonb; done jsonb; a jsonb; begin
 -- A different source/configuration/provider and a fresh UUID cannot bypass a
 -- prior unresolved request for the same canonical writer identity.
 args:=public.writer_private_fixture_args('operation-country:unknown-writer');
 config:=public.writer_operation_fixture_config()||'{"provider":"openai","model":"changed-translator"}';
 r:=public.begin_writer_translation_operation(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'operation-country','unknown-writer','openai',
   repeat('f',64),args->'source',jsonb_set(args->'sourceRevision','{catalogSourceHash}',to_jsonb(repeat('f',64))),args->'targetRevision',null,config,'{"writerCursor":90}','{"writerCursor":91}');
 assert r->>'blockReason'='provider_outcome_unknown' and r->'canExecute'='false'::jsonb and r->'providerCalls'='1'::jsonb;
 insert into public.writer_operation_fixture_results values('changed-source-provider-no-bypass',r);
 -- Cancellation after both confirmed responses retains the complete candidate
 -- and its private review path, while leaving the cancellation intent visible.
 r:=public.writer_operation_fixture_begin('cancel-complete-writer');
 r:=public.writer_operation_fixture_response(public.writer_operation_fixture_dispatch(r,'translation'));
 r:=public.writer_operation_fixture_response(public.writer_operation_fixture_dispatch(r,'review'));
 perform public.request_translation_job_cancel((r->>'jobId')::uuid,(r->>'jobVersion')::bigint);
 done:=public.writer_operation_fixture_finish(r);
 assert done->'result'->>'state'='cancelled' and done->'result'->>'persistence'='working-draft' and done->'result'->>'humanReview'='pending';
 assert done->'result'->>'publication'='unchanged';
 a:=public.get_writer_translation_operation_artifacts((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,r->>'intentHash',r->>'sourceHash');
 assert jsonb_typeof(a->'candidate')='object';
 insert into public.writer_operation_fixture_results values('cancel-complete-retains-pending',done);
end; $$;
reset role;
select 'M07_WRITER_OPERATIONS_EXTRA_PASS';
