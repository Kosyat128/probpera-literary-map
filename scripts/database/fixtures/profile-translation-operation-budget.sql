-- Synthetic data only. Run in an owned disposable database with the existing
-- synthetic Auth/staff/audit bootstrap, both original Translation Operations
-- migrations and the additive profile budget migration. Never run on production.
create table public.profile_budget_fixture_results(label text primary key, value jsonb not null);
grant select, insert on public.profile_budget_fixture_results to authenticated;

insert into auth.users(id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.staff_memberships(user_id, role)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner');

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
do $fixture$
begin
  assert public.profile_translation_budget_ready() is true, 'Current staff capability must be a strict true';
  insert into public.profile_budget_fixture_results values ('staff-ready', 'true'::jsonb);
end;
$fixture$;
reset role;

-- A code mentioned by a check is not proof that the check admits that code.
-- Verify both canonical expressions and their validation flags independently.
do $fixture$
declare guard record; definition text;
begin
  for guard in select * from (values
    ('public.translation_job_items', 'translation_job_items_last_error_code_check', 'last_error_code'),
    ('public.translation_job_attempts', 'translation_job_attempts_error_code_check', 'error_code')
  ) as guards(table_name, constraint_name, field_name) loop
    select pg_get_constraintdef(oid) into strict definition from pg_constraint
      where conrelid = guard.table_name::regclass and conname = guard.constraint_name;
    execute format('alter table %s drop constraint %I', guard.table_name, guard.constraint_name);
    execute format('alter table %s add constraint %I %s not valid', guard.table_name, guard.constraint_name, definition);
    assert public.profile_translation_budget_ready() is false, 'An unvalidated guard is not a capability';
    execute format('alter table %s validate constraint %I', guard.table_name, guard.constraint_name);
    assert public.profile_translation_budget_ready() is true;
    execute format('alter table %s drop constraint %I', guard.table_name, guard.constraint_name);
    execute format('alter table %s add constraint %I check (%I is null or %I <> %L)',
      guard.table_name, guard.constraint_name, guard.field_name, guard.field_name, 'translation_operation_stopped');
    assert public.profile_translation_budget_ready() is false, 'A validated rejecting expression must fail closed';
    execute format('alter table %s drop constraint %I', guard.table_name, guard.constraint_name);
    execute format('alter table %s add constraint %I %s', guard.table_name, guard.constraint_name, definition);
    assert public.profile_translation_budget_ready() is true;
  end loop;
  insert into public.profile_budget_fixture_results values ('validated-exact-guards', '{"guards":2,"negativeChecks":4}'::jsonb);
end;
$fixture$;

do $fixture$
begin
  alter function public.record_translation_sync_run(text,text,jsonb,jsonb,jsonb) rename to profile_budget_fixture_record_missing;
  assert public.profile_translation_budget_ready() is false, 'Missing record RPC blocks admission';
  alter function public.profile_budget_fixture_record_missing(text,text,jsonb,jsonb,jsonb) rename to record_translation_sync_run;
  alter function public.get_translation_job_resume(uuid) rename to profile_budget_fixture_resume_missing;
  assert public.profile_translation_budget_ready() is false, 'Missing resume RPC blocks admission';
  alter function public.profile_budget_fixture_resume_missing(uuid) rename to get_translation_job_resume;
  revoke execute on function public.get_translation_job_resume(uuid) from authenticated;
  assert public.profile_translation_budget_ready() is false, 'Unavailable authenticated resume permission blocks admission';
  grant execute on function public.get_translation_job_resume(uuid) to authenticated;
  assert public.profile_translation_budget_ready() is true;
  insert into public.profile_budget_fixture_results values ('required-rpc-guards', '{"negativeChecks":3}'::jsonb);
end;
$fixture$;

set role authenticated;
do $fixture$
declare kind text; prefix text; cap integer; budget jsonb; cursor jsonb; job uuid; returned jsonb;
  old_code text; baseline_count integer; stored_item_code text; stored_attempt_code text;
begin
  foreach kind in array array['literary_work','writer','country'] loop
    prefix := case kind when 'literary_work' then 'library' when 'writer' then 'writer' else 'country' end;
    cap := case kind when 'literary_work' then 4 when 'writer' then 3 else 2 end;
    budget := jsonb_build_object('version',1,'attempts',1,'providerCalls',1,'maxAttempts',cap,'maxProviderCalls',cap*4,
      'elapsedMs',300000,'deadlineMs',300000,'stopped',false,'stopReason','deadline');
    cursor := jsonb_build_object(prefix||'Cursor',1,prefix||'Budget',budget);
    job := public.record_translation_sync_run(kind,'cloudflare',
      jsonb_build_array(jsonb_build_object('entityType',kind,'entityId','profile-budget-fixture-'||kind)),
      '[{"status":"dead_letter","errorCode":"translation_operation_stopped"}]'::jsonb,cursor);
    returned := public.get_translation_job_resume(job);
    assert returned->'resumeCursor' = cursor, 'Operational JSON must round trip exactly';
    assert returned->>'kind' = kind and returned->>'status' = 'failed';
    select last_error_code into strict stored_item_code from public.translation_job_items where job_id = job;
    select attempt.error_code into strict stored_attempt_code from public.translation_job_attempts attempt
      join public.translation_job_items item on item.id = attempt.item_id where item.job_id = job;
    assert stored_item_code = 'translation_operation_stopped' and stored_attempt_code = 'translation_operation_stopped';
    assert not ((returned->'resumeCursor') ?| array['source','sourceSnapshot','payload','SOURCE_DATA','DRAFT_TRANSLATION']);
    insert into public.profile_budget_fixture_results values ('stopped-roundtrip-'||kind,returned);
  end loop;

  foreach old_code in array array[
    'translation_not_configured','provider_unavailable','provider_request_failed','provider_invalid_response',
    'source_changed','write_conflict','database_read_failed','database_write_failed','unexpected'
  ] loop
    job := public.record_translation_sync_run('writer','cloudflare',
      jsonb_build_array(jsonb_build_object('entityType','writer','entityId','old-code-'||old_code)),
      jsonb_build_array(jsonb_build_object('status','dead_letter','errorCode',old_code)), '{"writerCursor":0}'::jsonb);
    assert exists (select 1 from public.translation_job_items where job_id = job and last_error_code = old_code);
    assert exists (select 1 from public.translation_job_attempts attempt join public.translation_job_items item
      on item.id = attempt.item_id where item.job_id = job and attempt.error_code = old_code);
  end loop;
  insert into public.profile_budget_fixture_results values ('all-old-error-codes', '{"codes":9,"bothTables":true}'::jsonb);

  job := public.record_translation_sync_run('writer','cloudflare','[{"entityType":"writer","entityId":"old-null-success"}]'::jsonb,
    '[{"status":"succeeded"}]'::jsonb,'{}'::jsonb);
  assert exists (select 1 from public.translation_job_items where job_id = job and last_error_code is null);
  select count(*) into baseline_count from public.translation_jobs;
  begin
    perform public.record_translation_sync_run('writer','cloudflare','[{"entityType":"writer","entityId":"invalid-error-code"}]'::jsonb,
      '[{"status":"dead_letter","errorCode":"not_an_allowed_error"}]'::jsonb,'{}'::jsonb);
    raise exception 'Unknown error codes must remain rejected';
  exception when check_violation then null;
  end;
  assert (select count(*) from public.translation_jobs) = baseline_count, 'Rejected code must not leave an orphan job';
  insert into public.profile_budget_fixture_results values ('null-and-invalid-code-boundaries', '{"nullAccepted":true,"invalidRejected":true,"rollbackExact":true}'::jsonb);
end;
$fixture$;

select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $fixture$
declare item record;
begin
  begin
    perform public.profile_translation_budget_ready();
    raise exception 'Nonstaff readiness must be an access error, not a migration signal';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_translation_sync_run('writer','cloudflare','[{"entityType":"writer","entityId":"nonstaff"}]'::jsonb,
      '[{"status":"dead_letter","errorCode":"translation_operation_stopped"}]'::jsonb,'{}'::jsonb);
    raise exception 'Nonstaff record must be denied';
  exception when insufficient_privilege then null;
  end;
  for item in select value from public.profile_budget_fixture_results where label like 'stopped-roundtrip-%' loop
    assert public.get_translation_job_resume((item.value->>'id')::uuid) is null, 'Nonstaff RLS hides job receipts';
  end loop;
  perform set_config('request.jwt.claim.sub','',false);
  begin
    perform public.profile_translation_budget_ready();
    raise exception 'Missing actor readiness must be denied';
  exception when insufficient_privilege then null;
  end;
  insert into public.profile_budget_fixture_results values ('nonstaff-and-null-actor', '{"readinessSqlstate":"42501","recordDenied":true,"resumeHidden":true,"nullActorDenied":true}'::jsonb);
end;
$fixture$;
reset role;

do $fixture$
begin
  assert not has_function_privilege('anon','public.profile_translation_budget_ready()','EXECUTE');
  assert not has_function_privilege('service_role','public.profile_translation_budget_ready()','EXECUTE');
  assert has_function_privilege('authenticated','public.profile_translation_budget_ready()','EXECUTE');
  assert not has_function_privilege('authenticated','public.claim_translation_job_items(text,integer,integer)','EXECUTE');
  assert not has_function_privilege('authenticated',
    'public.complete_translation_job_item(uuid,text,boolean,text,text,text,integer,integer,integer)','EXECUTE');
  assert exists (select 1 from pg_proc where oid = 'public.profile_translation_budget_ready()'::regprocedure
    and prosecdef is false and proconfig @> array['search_path=""']);
  assert (select count(*) from public.translation_jobs) = 13;
  assert (select count(*) from public.translation_job_items) = 13;
  assert (select count(*) from public.translation_job_attempts) = 13;
  insert into public.profile_budget_fixture_results values ('acl-and-lease-boundaries', '{"anonDenied":true,"noServiceGrant":true,"staffExecute":true,"leaseApiUnchanged":true,"invoker":true,"emptySearchPath":true}'::jsonb);
end;
$fixture$;
select jsonb_build_object('profileBudgetChecks',jsonb_object_agg(label,value)) from public.profile_budget_fixture_results;
