-- Existing service-role lease API regression, executed on isolated native PG.
-- This is job cancellation, not an environment kill switch or a runtime worker.
-- Auth/schema/outbox are the existing controlled fixtures. No provider is called.
-- The accepted result below is operational metadata, never generated prose.
call public.fixture_seed();
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);

create table public.fixture_active_stop_observations(label text primary key,value jsonb not null);
grant select,insert on public.fixture_active_stop_observations to authenticated,service_role;

create function public.fixture_active_stop_expect(p_query text,p_code text)
returns void language plpgsql security invoker as $$
declare actual text;begin
  begin execute p_query;exception when others then actual:=sqlstate;end;
  perform public.fixture_assert(actual is not distinct from p_code,
    'active stop SQLSTATE wanted '||p_code||' actual '||coalesce(actual,'none'));
end;$$;

-- Assertion-only full row reads. They never authorize a production operation.
create function public.fixture_active_stop_authored()
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object(
  'articles',(select jsonb_agg(to_jsonb(t) order by id) from public.articles t),
  'english',(select jsonb_agg(to_jsonb(t) order by id) from public.article_translations t),
  'drafts',(select jsonb_agg(to_jsonb(t) order by article_id) from public.article_working_drafts t),
  'ruRevisions',(select jsonb_agg(to_jsonb(t) order by id) from public.article_revisions t),
  'enRevisions',(select jsonb_agg(to_jsonb(t) order by id) from public.article_translation_revisions t),
  'outbox',(select jsonb_agg(to_jsonb(t) order by id) from public.public_build_outbox t),
  'receipts',(select jsonb_agg(to_jsonb(t) order by operation_id) from probpera_editor_operations.receipts t),
  'authorAudit',(select jsonb_agg(to_jsonb(t) order by id) from public.admin_audit_log t
    where action not like 'translation.job.%'));
$$;
create function public.fixture_active_stop_ledger()
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object(
  'jobs',(select jsonb_agg(to_jsonb(t) order by id) from public.translation_jobs t),
  'items',(select jsonb_agg(to_jsonb(t) order by id) from public.translation_job_items t),
  'attempts',(select jsonb_agg(to_jsonb(t) order by id) from public.translation_job_attempts t),
  'audit',(select jsonb_agg(to_jsonb(t) order by id) from public.admin_audit_log t));
$$;
create table public.fixture_active_stop_editor_definitions as
select oid,pg_get_functiondef(oid) definition from pg_proc
where pronamespace='probpera_editor_operations'::regnamespace;

-- Reuse the original authored payload helpers without modifying any literal.
-- Preserve both full manual RU/EN and a private working copy of a public article.
set role authenticated;
do $$declare receipt jsonb;begin
  perform * from public.save_article_bundle('00000000-0000-4000-8000-000000000101',
    '2026-09-30T10:00:00.123456Z',public.fixture_payload(),'save',public.fixture_english(),
    '2026-09-30T10:00:00.654321Z',null,null,false,'article.fixture.saved','{}',false,'{}');
  receipt:=public.save_article_working_draft_operation('00000000-0000-4000-8000-000000000102',
    '2026-09-30T10:00:00.123456Z',public.fixture_payload('published-fixture'),
    jsonb_build_object('mode','save','payload',public.fixture_english('published-fixture-en')),
    '2026-09-30T10:00:00.654321Z',0,'10000000-0000-4000-8000-000000000704',
    public.fixture_intent('00000000-0000-4000-8000-000000000102','2026-09-30T10:00:00.123456Z',
      '2026-09-30T10:00:00.654321Z',0,'save',public.fixture_payload('published-fixture')));
  perform public.fixture_assert(receipt->>'canonicalStatus'='published' and receipt#>>'{result,version}'='1',
    'existing published article has a separate accepted private authored draft');
end;$$;
reset role;
insert into public.fixture_active_stop_observations values('authored-before',public.fixture_active_stop_authored());
do $$begin
  perform public.fixture_assert((select count(*)=9 from public.fixture_active_stop_editor_definitions),'M02 exact9');
  perform public.fixture_assert((select count(*)=3 from pg_class where oid in
    ('public.translation_jobs'::regclass,'public.translation_job_items'::regclass,'public.translation_job_attempts'::regclass)
    and relrowsecurity and relforcerowsecurity),'all three translation ledger tables force RLS');
  perform public.fixture_assert(not exists(select 1 from pg_roles where rolname in ('anon','authenticated')
    and (rolsuper or rolbypassrls)),'actual fixture user roles cannot bypass PostgreSQL RLS');
  perform public.fixture_assert(to_regprocedure('public.begin_translation_provider_config_self_test(jsonb,boolean,boolean,integer)') is not null,
    'current T06 binding migration is included');
end;$$;
select 'M07_T04_NATIVE_FOUNDATION_PASS';

-- Staff creates two items; worker A receives only the first existing lease.
set role authenticated;
insert into public.fixture_active_stop_observations
select 'job',to_jsonb(public.create_translation_job('article','openai',jsonb_build_array(
  jsonb_build_object('entityType','article','entityId','00000000-0000-4000-8000-000000000101','sourceHash',repeat('a',64)),
  jsonb_build_object('entityType','article','entityId','00000000-0000-4000-8000-000000000102','sourceHash',repeat('b',64))),3));
reset role;
set role service_role;
insert into public.fixture_active_stop_observations
select 'claim-a',coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.claim_translation_job_items('fixture-worker-a',1,300) c;
do $$declare c jsonb;begin
  select value->0 into c from public.fixture_active_stop_observations where label='claim-a';
  perform public.fixture_assert((select jsonb_array_length(value)=1 from public.fixture_active_stop_observations where label='claim-a')
    and c->>'entity_id'='00000000-0000-4000-8000-000000000101' and c->>'attempt_number'='1','worker A receives exactly first item');
  perform public.fixture_assert((select status='running' and version=2 and cancel_requested_at is null
    from public.translation_jobs where id=(c->>'job_id')::uuid),'actual claim starts job at version2');
  perform public.fixture_assert((select status='leased' and lease_owner='fixture-worker-a' and lease_expires_at>now() and attempt_count=0
    from public.translation_job_items where id=(c->>'item_id')::uuid),'accepted in-flight lease records no completed attempt yet');
  insert into public.fixture_active_stop_observations select 'leased-before-cancel',to_jsonb(i)
    from public.translation_job_items i where id=(c->>'item_id')::uuid;
end;$$;
reset role;

-- Real role ACL, actor and expected-version guards fail without mutation.
insert into public.fixture_active_stop_observations values('ledger-before-controls',public.fixture_active_stop_ledger());
set role anon;
select public.fixture_active_stop_expect('select public.request_translation_job_cancel(''00000000-0000-4000-8000-000000000000'',2)','42501');
select public.fixture_active_stop_expect('select * from public.claim_translation_job_items(''fixture-worker-b'',1,300)','42501');
select public.fixture_active_stop_expect('select public.complete_translation_job_item(''00000000-0000-4000-8000-000000000000'',''fixture-worker-a'',true)','42501');
reset role;
set role authenticated;
select public.fixture_active_stop_expect('select * from public.claim_translation_job_items(''fixture-worker-b'',1,300)','42501');
select public.fixture_active_stop_expect('select public.complete_translation_job_item(''00000000-0000-4000-8000-000000000000'',''fixture-worker-a'',true)','42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
select public.fixture_active_stop_expect(format('select public.request_translation_job_cancel(%L::uuid,2)',
  (select value#>>'{}' from public.fixture_active_stop_observations where label='job')),'42501');
select set_config('request.jwt.claim.sub','',false);
select public.fixture_active_stop_expect(format('select public.request_translation_job_cancel(%L::uuid,2)',
  (select value#>>'{}' from public.fixture_active_stop_observations where label='job')),'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.fixture_active_stop_expect(format('select public.request_translation_job_cancel(%L::uuid,1)',
  (select value#>>'{}' from public.fixture_active_stop_observations where label='job')),'40001');
reset role;
set role service_role;
select public.fixture_active_stop_expect(format('select public.request_translation_job_cancel(%L::uuid,2)',
  (select value#>>'{}' from public.fixture_active_stop_observations where label='job')),'42501');
select public.fixture_active_stop_expect(format('select public.complete_translation_job_item(%L::uuid,''fixture-worker-b'',true)',
  (select value#>>'{0,item_id}' from public.fixture_active_stop_observations where label='claim-a')),'42501');
reset role;
select public.fixture_assert(public.fixture_active_stop_ledger()=(select value from public.fixture_active_stop_observations where label='ledger-before-controls'),
  'all denied actor ACL version and worker controls preserve every ledger row');
select 'M07_T04_NATIVE_ACL_ACTOR_CAS_PASS';

set role authenticated;
insert into public.fixture_active_stop_observations
select 'cancel',public.request_translation_job_cancel((value#>>'{}')::uuid,2)
from public.fixture_active_stop_observations where label='job';
do $$declare job uuid;begin
  select (value#>>'{}')::uuid into job from public.fixture_active_stop_observations where label='job';
  perform public.fixture_assert((select value->>'id'=job::text and value->>'status'='cancelling' and value->>'version'='3'
    from public.fixture_active_stop_observations where label='cancel'),'staff cancel receipt is cancelling version3');
  perform public.fixture_assert((select status='cancelling' and cancel_requested_at is not null and completed_at is null
    from public.translation_jobs where id=job),'cancellation does not invent terminal success while A is in flight');
  perform public.fixture_assert((select to_jsonb(i)=(select value from public.fixture_active_stop_observations where label='leased-before-cancel')
    from public.translation_job_items i where job_id=job and position=0),'cancel preserves exact in-flight lease row');
  perform public.fixture_assert((select status='cancelled' and attempt_count=0 and lease_owner is null and lease_expires_at is null
    from public.translation_job_items where job_id=job and position=1),'queued second item cancelled without dispatch or attempt');
end;$$;
reset role;
insert into public.fixture_active_stop_observations values('ledger-after-cancel',public.fixture_active_stop_ledger());
set role service_role;
insert into public.fixture_active_stop_observations
select 'claim-b-after-stop',coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.claim_translation_job_items('fixture-worker-b',50,300) c;
reset role;
select public.fixture_assert((select value='[]'::jsonb from public.fixture_active_stop_observations where label='claim-b-after-stop')
  and public.fixture_active_stop_ledger()=(select value from public.fixture_active_stop_observations where label='ledger-after-cancel'),
  'worker B receives no item after cancel and changes no ledger row');
select 'M07_T04_NATIVE_ACTIVE_CANCEL_PASS';

-- Commit the already accepted A result after cancellation. No provider call is made.
set role service_role;
insert into public.fixture_active_stop_observations
select 'complete-a',public.complete_translation_job_item((value#>>'{0,item_id}')::uuid,'fixture-worker-a',true,
  null,'fixture-model','fixture-accepted-response',17,9,25)
from public.fixture_active_stop_observations where label='claim-a';
do $$declare job uuid;item uuid;r jsonb;begin
  select (value#>>'{}')::uuid into job from public.fixture_active_stop_observations where label='job';
  select (value#>>'{0,item_id}')::uuid into item from public.fixture_active_stop_observations where label='claim-a';
  select value into r from public.fixture_active_stop_observations where label='complete-a';
  perform public.fixture_assert(r=jsonb_build_object('jobId',job,'jobStatus','cancelled','itemId',item,'itemStatus','succeeded','attemptNumber',1),
    'exact completion receipt preserves A success while reporting cancelled job');
  perform public.fixture_assert((select status='cancelled' and version=4 and total_items=2 and succeeded_items=1 and failed_items=0
    and completed_at is not null and cancel_requested_at is not null from public.translation_jobs where id=job),
    'original job durably closes with one success and one cancelled item');
  perform public.fixture_assert((select status='succeeded' and attempt_count=1 and lease_owner is null and lease_expires_at is null
    and last_error_code is null from public.translation_job_items where id=item),'successful item releases only its completed lease');
  perform public.fixture_assert((select count(*)=1 from public.translation_job_attempts where item_id=item and attempt_number=1
    and outcome='succeeded' and provider='openai' and model='fixture-model' and provider_request_id='fixture-accepted-response'
    and error_code is null and input_tokens=17 and output_tokens=9 and duration_ms=25),'accepted call metadata recorded once');
  perform public.fixture_assert((select count(*)=1 from public.translation_job_attempts), 'unissued second item has no attempt');
end;$$;
reset role;
select 'M07_T04_NATIVE_COMPLETION_DURABLE_PASS';

insert into public.fixture_active_stop_observations values('ledger-after-completion',public.fixture_active_stop_ledger());
set role service_role;
select public.fixture_active_stop_expect(format('select public.complete_translation_job_item(%L::uuid,''fixture-worker-a'',true)',
  (select value#>>'{0,item_id}' from public.fixture_active_stop_observations where label='claim-a')),'42501');
select public.fixture_assert(not exists(select 1 from public.claim_translation_job_items('fixture-worker-b',50,300)),
  'completed cancellation never redispatches original success or cancelled remainder');
reset role;
set role authenticated;
insert into public.fixture_active_stop_observations
select 'repeat-cancel',public.request_translation_job_cancel((value#>>'{}')::uuid,4)
from public.fixture_active_stop_observations where label='job';
reset role;
select public.fixture_assert(public.fixture_active_stop_ledger()=(select value from public.fixture_active_stop_observations where label='ledger-after-completion'),
  'duplicate completion and terminal cancellation produce no duplicate journal audit or version');
select 'M07_T04_NATIVE_REPLAY_PASS';

-- Expiry is a controlled fixture transition, not a timing sleep or a runtime worker.
-- Reclaim is allowed before stop; the former holder cannot acknowledge that lease.
set role authenticated;
insert into public.fixture_active_stop_observations
select 'expiry-job',to_jsonb(public.create_translation_job('article','openai',jsonb_build_array(
  jsonb_build_object('entityType','article','entityId','00000000-0000-4000-8000-000000000101','sourceHash',repeat('a',64))),3));
reset role;
set role service_role;
insert into public.fixture_active_stop_observations
select 'expired-claim',coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.claim_translation_job_items('fixture-expired-worker',1,300) c;
reset role;
update public.translation_job_items set lease_expires_at=now()-interval '1 second'
where id=(select (value#>>'{0,item_id}')::uuid from public.fixture_active_stop_observations where label='expired-claim');
insert into public.fixture_active_stop_observations values('ledger-expired',public.fixture_active_stop_ledger());
set role service_role;
select public.fixture_active_stop_expect(format('select public.complete_translation_job_item(%L::uuid,''fixture-expired-worker'',true)',
  (select value#>>'{0,item_id}' from public.fixture_active_stop_observations where label='expired-claim')),'42501');
select public.fixture_assert(public.fixture_active_stop_ledger()=(select value from public.fixture_active_stop_observations where label='ledger-expired'),
  'expired lease cannot record a successful accepted response');
insert into public.fixture_active_stop_observations
select 'reclaimed',coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.claim_translation_job_items('fixture-recovery-worker',1,300) c;
select public.fixture_assert((select jsonb_array_length(value)=1 and value#>>'{0,item_id}'=
  (select value#>>'{0,item_id}' from public.fixture_active_stop_observations where label='expired-claim')
  from public.fixture_active_stop_observations where label='reclaimed'),'existing expired item can be reclaimed before cancellation');
select public.fixture_active_stop_expect(format('select public.complete_translation_job_item(%L::uuid,''fixture-expired-worker'',true)',
  (select value#>>'{0,item_id}' from public.fixture_active_stop_observations where label='expired-claim')),'42501');
reset role;
set role authenticated;
select public.fixture_assert(public.request_translation_job_cancel((select (value#>>'{}')::uuid
  from public.fixture_active_stop_observations where label='expiry-job'),2)->>'status'='cancelling',
  'reclaimed active job cancels at the current version');
reset role;
set role service_role;
select public.fixture_assert(not exists(select 1 from public.claim_translation_job_items('fixture-worker-b',50,300)),
  'stop also blocks further claims after safe pre-stop reclaim');
insert into public.fixture_active_stop_observations
select 'reclaimed-completion',public.complete_translation_job_item((value#>>'{0,item_id}')::uuid,'fixture-recovery-worker',true)
from public.fixture_active_stop_observations where label='reclaimed';
select public.fixture_assert((select value->>'jobStatus'='cancelled' and value->>'itemStatus'='succeeded' and value->>'attemptNumber'='1'
  from public.fixture_active_stop_observations where label='reclaimed-completion'),'only current unexpired holder completes after stop');
reset role;
select 'M07_T04_NATIVE_EXPIRED_LEASE_PASS';

do $$begin
  perform public.fixture_assert(public.fixture_active_stop_authored()=(select value from public.fixture_active_stop_observations where label='authored-before'),
    'full authored RU EN sources rights media working drafts revisions receipts and public outbox remain identical');
  perform public.fixture_assert((select count(*)=9 from pg_proc where pronamespace='probpera_editor_operations'::regnamespace)
    and not exists(select 1 from public.fixture_active_stop_editor_definitions f join pg_proc p on p.oid=f.oid
      where pg_get_functiondef(p.oid)<>f.definition),'M02 exact9 definitions unchanged');
  perform public.fixture_assert((select count(*)=2 from public.translation_jobs where status='cancelled' and succeeded_items=1 and failed_items=0)
    and (select count(*)=2 from public.translation_job_attempts),'only two controlled completions persist across two scenarios');
  perform public.fixture_assert((select count(*)=2 from public.admin_audit_log where action='translation.job.cancel_requested'
    and actor_id='00000000-0000-4000-8000-000000000001'),'both stop commands retain the authorized staff actor');
end;$$;
select 'M07_T04_NATIVE_AUTHOR_PRESERVATION_PASS';
select 'M07_T04_NATIVE_SUMMARY='||jsonb_build_object(
  'groups',7,'jobs',2,'completedAttempts',2,'mainSucceededItems',1,'mainCancelledItems',1,
  'postStopClaims',0,'providerCalls',0,'authorRowsUnchanged',true,'m02Definitions',9,
  'boundary','existing service-role lease cancellation only; no runtime worker or environment kill switch')::text;
