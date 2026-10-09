-- Same authored dataset and observations for the pre-admission and current SQL.
-- Auth claims/schema are fixture-owned. No provider call or PostgREST is used.
call public.fixture_seed();
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
create table public.fixture_ordinary_admission_observations(label text primary key,value jsonb not null);
grant select,insert on public.fixture_ordinary_admission_observations to authenticated;
grant select on public.fixture_ordinary_admission_observations to service_role;
insert into public.fixture_ordinary_admission_observations values('native-mode',jsonb_build_object('mode',current_setting('fixture.ordinary.admission.mode')));

create function public.fixture_ordinary_admission_observe(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('article',(select to_jsonb(a) from public.articles a where id=p_id),
  'english',(select to_jsonb(e) from public.article_translations e where article_id=p_id and locale='en'),
  'draft',(select to_jsonb(d) from public.article_working_drafts d where article_id=p_id));
$$;
create function public.fixture_ordinary_admission_seed(p_slug text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare fixture_article_id uuid;ru jsonb;en jsonb;args jsonb;begin
  ru:=public.fixture_payload(p_slug,U&'  Авторский RU \2014 текст - без замены  ')||jsonb_build_object(
    'status','published','published_at','2026-09-30T09:00:00Z','legacy_path','/legacy/'||p_slug,
    'sources','[{"text":"  Authored RU source and permission  "},{"text":"  Authored RU source and permission  "}]'::jsonb,
    'bibliography','[{"text":"Author bibliography; retained rights"}]'::jsonb);
  en:=(public.fixture_english(p_slug||'-en')-array['source_article_updated_at','reviewed_by','approved_by'])||jsonb_build_object(
    'status','published','reviewed_at','2026-09-30T09:00:00Z','approved_at','2026-09-30T09:00:00Z',
    'published_at','2026-09-30T09:00:00Z','deleted_at',null,'source_content_hash',repeat('a',64),
    'sources','[{"text":"Old public EN author source"}]'::jsonb,'bibliography','[{"text":"Old author EN bibliography"}]'::jsonb,
    'content_json',jsonb_set(public.fixture_english()->'content_json','{__probperaPremiumTranslation}',
      jsonb_build_object('version',1,'method','machine-translation','sourceHash',repeat('a',64))));
  select article_id into fixture_article_id from public.save_article_bundle(null,null,ru,'save',en,null,null,null,false,'fixture.ordinary_admission.seed','{}',false,'{}');
  select jsonb_build_object('p_article_id',fixture_article_id,'p_source_hash',repeat('a',64),'p_source_updated_at',a.updated_at,
    'p_source_snapshot',probpera_translation_operations.retry_ru_snapshot(a),
    'p_expected_english_updated_at',(select updated_at from public.article_translations where article_id=fixture_article_id and locale='en'))
    into args from public.articles a where a.id=fixture_article_id;
  en:=en||jsonb_build_object('status','draft','reviewed_at',null,'approved_at',null,'published_at',null,
    'title','Private machine EN pending explicit human review',
    'content_html','<p>'||repeat('Validated English with retained author sources and licensed media. ',250)||'</p><img src="https://fixture.test/en.jpg" alt="EN photo">');
  return jsonb_build_object('articleId',fixture_article_id,'contextArgs',args,'englishEnvelope',jsonb_build_object('mode','save','payload',en),
    'baseline',public.fixture_ordinary_admission_observe(fixture_article_id));
end;$$;
create function public.fixture_ordinary_admission_cursor(p_id uuid,p_index integer default 0)
returns jsonb language sql immutable as $$
select jsonb_build_object('articleScan',jsonb_build_object('version',1,'order','id','upperId',p_id,'afterId',null,
  'pendingIds',jsonb_build_array(p_id),'nextIndex',p_index,'lastWindow',true,'exhausted',false));
$$;
create function public.fixture_ordinary_admission_args(p_seed jsonb,p_job uuid default gen_random_uuid(),p_item uuid default gen_random_uuid(),p_op uuid default gen_random_uuid())
returns jsonb language sql stable as $$
select jsonb_build_object('p_job_id',p_job,'p_item_id',p_item,'p_operation_id',p_op,'p_article_id',p_seed->'articleId',
 'p_expected_job_version',0,'p_expected_source_hash',p_seed#>'{contextArgs,p_source_hash}',
 'p_expected_article_updated_at',p_seed#>'{contextArgs,p_source_updated_at}',
 'p_expected_english_updated_at',p_seed#>'{contextArgs,p_expected_english_updated_at}',
 'p_provider','openai','p_expected_cursor','{}'::jsonb,
 'p_resume_cursor',public.fixture_ordinary_admission_cursor((p_seed->>'articleId')::uuid,1),
 'p_expected_source_snapshot',p_seed#>'{contextArgs,p_source_snapshot}');
$$;
create function public.fixture_ordinary_admission_begin(a jsonb)
returns jsonb language plpgsql security invoker as $$
begin return public.begin_article_translation_sync_item((a->>'p_job_id')::uuid,(a->>'p_item_id')::uuid,(a->>'p_operation_id')::uuid,
  (a->>'p_article_id')::uuid,(a->>'p_expected_job_version')::bigint,a->>'p_expected_source_hash',
  (a->>'p_expected_article_updated_at')::timestamptz,(a->>'p_expected_english_updated_at')::timestamptz,
  a->>'p_provider',a->'p_expected_cursor',a->'p_resume_cursor',a->'p_expected_source_snapshot');end;
$$;
create function public.fixture_ordinary_admission_context(a jsonb)
returns jsonb language sql security invoker as $$
select public.get_article_machine_english_draft_context((a->>'p_article_id')::uuid,a->>'p_source_hash',
 (a->>'p_source_updated_at')::timestamptz,a->'p_source_snapshot',(a->>'p_expected_english_updated_at')::timestamptz);
$$;
create function public.fixture_ordinary_admission_expect(p_sql text,p_code text)
returns void language plpgsql security invoker as $$
declare actual text;begin begin execute p_sql;exception when others then actual:=sqlstate;end;
perform public.fixture_assert(actual is not distinct from p_code,'ordinary admission SQLSTATE wanted '||p_code||' actual '||coalesce(actual,'none'));end;
$$;

set role authenticated;
do $$declare s jsonb;a jsonb;first jsonb;second jsonb;replay jsonb;running jsonb;before_rows jsonb;begin
  s:=public.fixture_ordinary_admission_seed('same-dataset-admission');a:=public.fixture_ordinary_admission_args(s);
  before_rows:=public.fixture_ordinary_admission_observe((s->>'articleId')::uuid);
  first:=public.fixture_ordinary_admission_context(s->'contextArgs');
  second:=public.fixture_ordinary_admission_context(s->'contextArgs');
  perform public.fixture_assert(first->'canGenerate'='true' and second->'canGenerate'='true','same old read-only preflight admits both callers');
  insert into public.fixture_ordinary_admission_observations values('same-baseline',s),('same-intent',a);
  if current_setting('fixture.ordinary.admission.mode')='before' then
    perform public.fixture_ordinary_admission_expect(format('select public.fixture_ordinary_admission_begin(%L::jsonb)',a::text),'42883');
    insert into public.fixture_ordinary_admission_observations values('before-two-read-authorities',jsonb_build_object('first',first,'second',second));
  else
    first:=public.fixture_ordinary_admission_begin(a);
    perform public.fixture_assert(first->'canExecute'='true' and first->>'phase'='running' and first->'attemptCount'='0' and first->'maxAttempts'='3',
      'actual atomic first admission with truthful remaining lifetime attempts');
    running:=public.get_article_translation_sync_run((a->>'p_job_id')::uuid);
    perform public.fixture_assert(running->'totalItems'='1' and running->'activeItems'='1' and running->'failedItems'='0' and
      running->'resumeCursor'=a->'p_resume_cursor','same durable run records admitted active item and cursor before dispatch');
    replay:=public.fixture_ordinary_admission_begin(a);
    perform public.fixture_assert(replay->'canExecute'='false' and replay->'replayed'='true','same operation replay never authorises fresh call');
    perform public.fixture_ordinary_admission_expect(format('select public.fixture_ordinary_admission_begin(%L::jsonb)',
      public.fixture_ordinary_admission_args(s)::text),'40001');
    perform public.fixture_assert(public.fixture_ordinary_admission_observe((s->>'articleId')::uuid)=before_rows,
      'admission does not mutate complete canonical RU/EN or create a draft');
    insert into public.fixture_ordinary_admission_observations values('current-first',first),('current-run',running),('current-replay',replay);
  end if;
end;$$;
reset role;
do $$begin
  perform public.fixture_assert((select count(*)=9 from pg_proc where pronamespace='probpera_editor_operations'::regnamespace),'M02 exact9 namespace');
  perform public.fixture_assert(not exists(select 1 from public.fixture_ordinary_admission_old_editor_functions f
    join pg_proc p on p.oid=f.oid where pg_get_functiondef(p.oid)<>f.definition),'M02 private definitions unchanged');
end;$$;
select case current_setting('fixture.ordinary.admission.mode') when 'before' then 'M07_ORDINARY_ADMISSION_NATIVE_BEFORE_REPRODUCED'
  else 'M07_ORDINARY_ADMISSION_NATIVE_CORE_PASS' end;

-- Additional current-schema evidence. Calls below execute actual SQL guards,
-- journals and private persistence. The provider is NOT called: received-call
-- metadata is a controlled fixture, not provider or production acceptance.
create table public.fixture_sync_items(
  label text primary key,position integer,seed jsonb,args jsonb,begin_receipt jsonb,
  finish_receipt jsonb,baseline jsonb
);
grant select,insert,update on public.fixture_sync_items to authenticated;

create function public.fixture_sync_cursor(p_ids jsonb,p_index integer,p_final boolean default false)
returns jsonb language sql immutable as $$
select jsonb_build_object('articleScan',jsonb_build_object('version',1,'order','id',
  'upperId',p_ids -> (jsonb_array_length(p_ids)-1),
  'afterId',case when p_final then p_ids -> (jsonb_array_length(p_ids)-1) else 'null'::jsonb end,
  'pendingIds',case when p_final then '[]'::jsonb else p_ids end,
  'nextIndex',case when p_final then 0 else p_index end,'lastWindow',true,'exhausted',p_final));
$$;

create function public.fixture_sync_known_outcome(p_args jsonb,p_seed jsonb,p_succeeded boolean)
returns jsonb language plpgsql security invoker as $$
declare call_id uuid;pass text;progress jsonb;outcome jsonb;candidate jsonb;receipt jsonb;
begin
  foreach pass in array array['translation','review'] loop
    call_id:=gen_random_uuid();
    progress:=public.record_article_translation_item_retry_dispatch(
      (p_args->>'p_job_id')::uuid,(p_args->>'p_item_id')::uuid,(p_args->>'p_operation_id')::uuid,
      call_id,'openai','controlled-native-fixture-model',pass);
    perform public.fixture_assert(progress -> 'canDispatch'='true','known native call admission is new');
    progress:=public.record_article_translation_item_retry_response(
      (p_args->>'p_job_id')::uuid,(p_args->>'p_item_id')::uuid,(p_args->>'p_operation_id')::uuid,
      jsonb_build_object('callId',call_id,'provider','openai','model','controlled-native-fixture-model',
        'pass',pass,'httpStatus',200,'requestId','native-fixture-request','responseId','native-fixture-response',
        'inputTokens',11,'outputTokens',13));
    perform public.fixture_assert(progress -> 'providerCalls'=case when pass='translation' then '1'::jsonb else '2'::jsonb end,
      'each acknowledged native call remains in the journal');
  end loop;
  outcome:=jsonb_build_object('status',case when p_succeeded then 'succeeded' else 'dead_letter' end,
    'providerCalls',2,'model','controlled-native-fixture-model','requestId','native-fixture-request',
    'inputTokens',22,'outputTokens',26,'durationMs',100);
  if not p_succeeded then outcome:=outcome||jsonb_build_object('errorCode','provider_invalid_response'); end if;
  if p_succeeded then
    candidate:=public.stage_article_translation_item_retry_candidate(
      (p_args->>'p_job_id')::uuid,(p_args->>'p_item_id')::uuid,(p_args->>'p_operation_id')::uuid,
      outcome,p_seed -> 'englishEnvelope');
    perform public.fixture_assert(candidate ->> 'candidateState'='staged' and candidate -> 'canRecover'='true','validated private candidate is recoverable');
  end if;
  receipt:=public.finish_article_translation_item_retry(
    (p_args->>'p_job_id')::uuid,(p_args->>'p_item_id')::uuid,(p_args->>'p_operation_id')::uuid,
    outcome,case when p_succeeded then p_seed -> 'englishEnvelope' else null end);
  return receipt;
end; $$;

set role authenticated;
do $$
declare s jsonb;a jsonb;changed jsonb;first jsonb;run jsonb;before_rows jsonb;owner_role text;
begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  s:=public.fixture_ordinary_admission_seed('full-snapshot-admission');a:=public.fixture_ordinary_admission_args(s);
  before_rows:=public.fixture_ordinary_admission_observe((s->>'articleId')::uuid);
  changed:=jsonb_set(a,'{p_expected_source_snapshot,title}','"Different full source snapshot"');
  perform public.fixture_ordinary_admission_expect(format('select public.fixture_ordinary_admission_begin(%L::jsonb)',changed::text),'40001');
  perform public.fixture_assert(public.fixture_ordinary_admission_observe((s->>'articleId')::uuid)=before_rows,
    'changed full snapshot with unchanged timestamp/hash has no author mutation');
  first:=public.fixture_ordinary_admission_begin(a);
  run:=public.get_article_translation_sync_run((a->>'p_job_id')::uuid);
  perform public.fixture_ordinary_admission_expect(format('select public.checkpoint_article_translation_sync_run(%L::uuid,%s,%L::jsonb,%L::jsonb,%L::jsonb,%L)',
    a->>'p_job_id',run->>'jobVersion',(run->'resumeCursor')::text,(run->'resumeCursor')::text,'[]','openai'),'40001');
  insert into public.fixture_ordinary_admission_observations values('full-snapshot-first',jsonb_build_object('seed',s,'args',a,'receipt',first,'run',run));
end; $$;
reset role;
select case when current_setting('fixture.ordinary.admission.mode')='current'
  then 'M07_ORDINARY_FULL_SNAPSHOT_AND_PENDING_CURSOR_PASS' else 'M07_ORDINARY_EXTRA_BEFORE_NOT_RUN' end;

-- Two distinct articles can be admitted into one run. Finishing the first
-- must not mark the run terminal while the second admission is unresolved.
set role authenticated;
do $$
#variable_conflict use_variable
declare seeds jsonb:='[]';ids jsonb;job_id uuid:=gen_random_uuid();a jsonb;b jsonb;first jsonb;second jsonb;run jsonb;
begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  seeds:=jsonb_build_array(public.fixture_ordinary_admission_seed('two-active-a'),public.fixture_ordinary_admission_seed('two-active-b'));
  select jsonb_agg(value->'articleId' order by (value->>'articleId')::uuid) into ids from jsonb_array_elements(seeds);
  select value into first from jsonb_array_elements(seeds) where value->'articleId'=ids->0;
  select value into second from jsonb_array_elements(seeds) where value->'articleId'=ids->1;
  a:=public.fixture_ordinary_admission_args(first,job_id)||jsonb_build_object('p_resume_cursor',public.fixture_sync_cursor(ids,1));
  first:=public.fixture_ordinary_admission_begin(a);
  b:=public.fixture_ordinary_admission_args(second,job_id)||jsonb_build_object('p_expected_job_version',(first->>'jobVersion')::bigint,
    'p_expected_cursor',a->'p_resume_cursor','p_resume_cursor',public.fixture_sync_cursor(ids,2));
  perform public.fixture_ordinary_admission_begin(b);
  run:=public.get_article_translation_sync_run(job_id);
  perform public.fixture_assert(run->'activeItems'='2' and run->'totalItems'='2','same job has two real admissions');
  select value into first from jsonb_array_elements(seeds) where value->'articleId'=ids->0;
  first:=public.fixture_sync_known_outcome(a,first,true);
  run:=public.get_article_translation_sync_run(job_id);
  perform public.fixture_assert(first->>'jobStatus'='reviewing' and run->>'status'='reviewing'
    and run->'activeItems'='1' and run->'succeededItems'='1','first FINISH preserves second active item');
  select value into second from jsonb_array_elements(seeds) where value->'articleId'=ids->1;
  second:=public.fixture_sync_known_outcome(b,second,false);
  run:=public.get_article_translation_sync_run(job_id);
  perform public.fixture_assert(run->>'status'='partial' and run->'activeItems'='0'
    and run->'succeededItems'='1' and run->'failedItems'='1','both terminal outcomes belong to the original job');
  insert into public.fixture_ordinary_admission_observations values('two-active-finished',jsonb_build_object('first',first,'second',second,'run',run));
end; $$;
reset role;
select case when current_setting('fixture.ordinary.admission.mode')='current'
  then 'M07_ORDINARY_FINISH_PRESERVES_OTHER_ACTIVE_ITEMS_PASS' else 'M07_ORDINARY_ACTIVE_BEFORE_NOT_RUN' end;

-- Eleven fixed candidates: ten observed outcomes (8 success + 2 known
-- response-validation failures), then Continue processes candidate eleven.
-- Selected failed-item retries subsequently touch only those two failures.
set role authenticated;
do $$
#variable_conflict use_variable
declare seeds jsonb:='[]';ids jsonb;job_id uuid:=gen_random_uuid();n integer;s jsonb;a jsonb;r jsonb;run jsonb;
  cursor jsonb:='{}';version bigint:=0;before_run jsonb;after_continue jsonb;item record;retry_args jsonb;
begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  for n in 1..11 loop seeds:=seeds||jsonb_build_array(public.fixture_ordinary_admission_seed('bounded-accounting-'||n)); end loop;
  select jsonb_agg(value->'articleId' order by (value->>'articleId')::uuid) into ids from jsonb_array_elements(seeds);
  for n in 1..10 loop
    select value into s from jsonb_array_elements(seeds) where value->'articleId'=ids->(n-1);
    a:=public.fixture_ordinary_admission_args(s,job_id)||jsonb_build_object('p_expected_job_version',version,
      'p_expected_cursor',cursor,'p_resume_cursor',public.fixture_sync_cursor(ids,n));
    r:=public.fixture_ordinary_admission_begin(a);
    insert into public.fixture_sync_items(label,position,seed,args,begin_receipt,baseline)
      values('batch-'||n,n,s,a,r,s->'baseline');
    r:=public.fixture_sync_known_outcome(a,s,n<=8);
    update public.fixture_sync_items set finish_receipt=r where label='batch-'||n;
    version:=(r->>'jobVersion')::bigint;cursor:=a->'p_resume_cursor';
    if n%2=0 then
      run:=public.checkpoint_article_translation_sync_run(job_id,version,cursor,cursor,'[]','openai');
      version:=(run->>'jobVersion')::bigint;
    end if;
  end loop;
  before_run:=public.get_article_translation_sync_run(job_id);
  perform public.fixture_assert(before_run->'totalItems'='10' and before_run->'succeededItems'='8'
    and before_run->'failedItems'='2' and before_run->>'status'='partial'
    and before_run#>'{resumeCursor,articleScan,exhausted}'='false','ten actual outcomes retain the unfinished scan cursor');
  -- Continue admits the remaining fixed candidate, not either failed item.
  select value into s from jsonb_array_elements(seeds) where value->'articleId'=ids->10;
  a:=public.fixture_ordinary_admission_args(s,job_id)||jsonb_build_object('p_expected_job_version',version,
    'p_expected_cursor',cursor,'p_resume_cursor',public.fixture_sync_cursor(ids,11));
  perform public.fixture_ordinary_admission_begin(a);
  r:=public.fixture_sync_known_outcome(a,s,true);
  cursor:=a->'p_resume_cursor';version:=(r->>'jobVersion')::bigint;
  after_continue:=public.checkpoint_article_translation_sync_run(job_id,version,cursor,public.fixture_sync_cursor(ids,11,true),'[]','openai');
  perform public.fixture_assert(after_continue->'totalItems'='11' and after_continue->'succeededItems'='9'
    and after_continue->'failedItems'='2','Continue appends candidate eleven without redoing either failure');
  perform public.fixture_assert((select count(*)=11 from public.translation_job_items i where i.job_id=job_id and i.attempt_count=1),
    'completed items are not automatically retried by Continue');
  for item in select * from public.fixture_sync_items where position in (9,10) order by position loop
    run:=public.get_article_translation_sync_run(job_id);
    r:=public.get_article_translation_item_retry(job_id,(item.args->>'p_item_id')::uuid,null);
    perform public.fixture_assert(r->>'phase'='ready' and r->'maxAttempts'='3','selected failure still has its real lifetime allowance');
    retry_args:=item.args||jsonb_build_object('p_operation_id',gen_random_uuid(),
      'p_expected_job_version',(run->>'jobVersion')::bigint,'p_expected_attempt_count',1);
    r:=public.begin_article_translation_item_retry(job_id,(item.args->>'p_item_id')::uuid,
      (retry_args->>'p_operation_id')::uuid,(run->>'jobVersion')::bigint,1,
      item.args->>'p_expected_source_hash',(item.args->>'p_expected_article_updated_at')::timestamptz,
      (item.args->>'p_expected_english_updated_at')::timestamptz,'openai');
    perform public.fixture_assert(r->'canExecute'='true' and r->'maxAttempts'='3','failed retry preserves ordinary lifetime cap');
    r:=public.fixture_sync_known_outcome(retry_args,item.seed,true);
    perform public.fixture_assert(r->'attemptCount'='2' and r->'maxAttempts'='3','only the selected failed item gains a second attempt');
    insert into public.fixture_ordinary_admission_observations values('selected-retry-'||item.position,
      jsonb_build_object('args',retry_args,'receipt',r));
  end loop;
  run:=public.get_article_translation_sync_run(job_id);
  perform public.fixture_assert(run->'totalItems'='11' and run->'succeededItems'='11'
    and run->'failedItems'='0' and run->>'status'='completed','all results remain in the same original durable run');
  perform public.fixture_assert((select count(*)=2 from public.translation_job_items i where i.job_id=job_id and i.attempt_count=2)
    and (select count(*)=9 from public.translation_job_items i where i.job_id=job_id and i.attempt_count=1),
    'nine successes were not generated again during selected failure retries');
  for item in select * from public.fixture_sync_items order by position loop
    r:=public.fixture_ordinary_admission_observe((item.seed->>'articleId')::uuid);
    perform public.fixture_assert(r->'article'=item.baseline->'article' and r->'english'=item.baseline->'english',
      'complete canonical author RU/EN preserved for every initial candidate');
    perform public.fixture_assert(r#>>'{draft,draft_scope}'='english-only' and r#>>'{draft,english_payload,payload,status}'='draft'
      and r#>'{draft,english_payload,payload,reviewed_at}'='null' and r#>'{draft,english_payload,payload,approved_at}'='null',
      'machine completion is private and awaits actual human review');
  end loop;
  insert into public.fixture_ordinary_admission_observations values('same-job-ten-eight-two',before_run),
    ('same-job-continue-eleven',after_continue),('same-job-selected-two-final',run);
end; $$;
reset role;
select case when current_setting('fixture.ordinary.admission.mode')='current'
  then 'M07_ORDINARY_TEN_ITEMS_EIGHT_SUCCESS_TWO_FAILURES_PASS' else 'M07_ORDINARY_BATCH_BEFORE_NOT_RUN' end;
select case when current_setting('fixture.ordinary.admission.mode')='current'
  then 'M07_ORDINARY_CONTINUE_AND_SELECTED_FAILED_RETRY_PASS' else 'M07_ORDINARY_CONTINUE_BEFORE_NOT_RUN' end;
-- These observation helpers read fixture-owned rows as their owner. Mutation
-- assertions below still call the public RPC as authenticated/service_role.
create function public.fixture_sync_operation_observe(a jsonb)
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('job',(select to_jsonb(j) from public.translation_jobs j where id=(a->>'p_job_id')::uuid),
  'item',(select to_jsonb(i) from public.translation_job_items i where id=(a->>'p_item_id')::uuid),
  'attempts',(select coalesce(jsonb_agg(to_jsonb(t) order by attempt_number),'[]') from public.translation_job_attempts t
    where item_id=(a->>'p_item_id')::uuid),
  'article',public.fixture_ordinary_admission_observe((a->>'p_article_id')::uuid));
$$;
create function public.fixture_sync_stage_only(a jsonb,s jsonb)
returns jsonb language plpgsql security invoker as $$
declare call_id uuid;pass text;progress jsonb;outcome jsonb;candidate jsonb;
begin
  foreach pass in array array['translation','review'] loop
    call_id:=gen_random_uuid();
    progress:=public.record_article_translation_item_retry_dispatch((a->>'p_job_id')::uuid,
      (a->>'p_item_id')::uuid,(a->>'p_operation_id')::uuid,call_id,'openai','controlled-native-fixture-model',pass);
    perform public.fixture_assert(progress->'canDispatch'='true','staged fixture call admitted once');
    perform public.record_article_translation_item_retry_response((a->>'p_job_id')::uuid,
      (a->>'p_item_id')::uuid,(a->>'p_operation_id')::uuid,jsonb_build_object('callId',call_id,'provider','openai',
        'model','controlled-native-fixture-model','pass',pass,'httpStatus',200,
        'requestId','stage-fixture-request','responseId','stage-fixture-response','inputTokens',11,'outputTokens',13));
  end loop;
  outcome:=jsonb_build_object('status','succeeded','providerCalls',2,'model','controlled-native-fixture-model',
    'requestId','stage-fixture-request','inputTokens',22,'outputTokens',26,'durationMs',100);
  candidate:=public.stage_article_translation_item_retry_candidate((a->>'p_job_id')::uuid,
    (a->>'p_item_id')::uuid,(a->>'p_operation_id')::uuid,outcome,s->'englishEnvelope');
  perform public.fixture_assert(candidate->>'candidateState'='staged' and candidate->'canRecover'='true','actual candidate durably staged');
  return candidate;
end;$$;

set role authenticated;
do $$declare s jsonb;a jsonb;c jsonb;frozen jsonb;r jsonb;after_recover jsonb;bad_outcome jsonb;begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  s:=public.fixture_ordinary_admission_seed('candidate-ack-loss');a:=public.fixture_ordinary_admission_args(s);
  perform public.fixture_ordinary_admission_begin(a);c:=public.fixture_sync_stage_only(a,s);
  frozen:=public.fixture_sync_operation_observe(a);
  bad_outcome:='{"status":"dead_letter","errorCode":"provider_request_failed","providerCalls":2,"durationMs":100}';
  perform public.fixture_ordinary_admission_expect(format('select public.finish_article_translation_item_retry(%L::uuid,%L::uuid,%L::uuid,%L::jsonb,null)',
    a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id',bad_outcome::text),'40001');
  perform public.fixture_assert(public.fixture_sync_operation_observe(a)=frozen,'failed transport outcome cannot overwrite staged candidate or release its admission');
  c:=public.get_article_translation_item_retry_candidate((a->>'p_job_id')::uuid,(a->>'p_item_id')::uuid,(a->>'p_operation_id')::uuid);
  perform public.fixture_assert(c->'canRecover'='true','lost stage acknowledgement leaves the same recoverable candidate');
  r:=public.recover_article_translation_item_retry_candidate((a->>'p_job_id')::uuid,(a->>'p_item_id')::uuid,
    (a->>'p_operation_id')::uuid,c->>'candidateHash');
  perform public.fixture_assert(r->>'phase'='finished' and r->>'itemStatus'='succeeded','recovery finishes the already staged body');
  after_recover:=public.fixture_sync_operation_observe(a);
  perform public.fixture_assert(after_recover#>'{article,draft,english_payload}'=frozen#>'{article,draft,english_payload}'
    and after_recover#>'{article,draft,version}'=frozen#>'{article,draft,version}','recovery reuses body and private version');
  r:=public.recover_article_translation_item_retry_candidate((a->>'p_job_id')::uuid,(a->>'p_item_id')::uuid,
    (a->>'p_operation_id')::uuid,c->>'candidateHash');
  perform public.fixture_assert(r->'replayed'='true' and public.fixture_sync_operation_observe(a)=after_recover,'recovery replay writes nothing and has no provider dispatch');
  insert into public.fixture_ordinary_admission_observations values('candidate-ack-loss',jsonb_build_object('args',a,'candidate',c,'receipt',r));
end;$$;
reset role;
select case when current_setting('fixture.ordinary.admission.mode')='current'
  then 'M07_ORDINARY_STAGED_ACK_LOSS_RECOVERY_PASS' else 'M07_ORDINARY_CANDIDATE_BEFORE_NOT_RUN' end;

-- A genuine historical failed record is seeded ONLY for the negative OLD
-- BEGIN test; it is not the ordinary admission or batch accounting fixture.
set role authenticated;
do $$declare s jsonb;a jsonb;legacy uuid;legacy_item uuid;legacy_version bigint;before_rows jsonb;begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  s:=public.fixture_ordinary_admission_seed('global-old-begin');a:=public.fixture_ordinary_admission_args(s);
  perform public.fixture_ordinary_admission_begin(a);
  legacy:=public.record_translation_sync_run('article','openai',jsonb_build_array(jsonb_build_object('entityType','article',
    'entityId',upper(s->>'articleId'),'sourceHash',repeat('a',64))),
    '[{"status":"dead_letter","errorCode":"provider_invalid_response","providerCalls":2}]','{}');
  select id into legacy_item from public.translation_job_items where job_id=legacy;
  select version into legacy_version from public.translation_jobs where id=legacy;
  before_rows:=public.fixture_sync_operation_observe(a);
  perform public.fixture_ordinary_admission_expect(format('select public.begin_article_translation_item_retry(%L::uuid,%L::uuid,%L::uuid,%s,1,%L,%L::timestamptz,%L::timestamptz,%L)',
    legacy,legacy_item,gen_random_uuid(),legacy_version,repeat('a',64),s#>>'{contextArgs,p_source_updated_at}',
    s#>>'{contextArgs,p_expected_english_updated_at}','openai'),'40001');
  perform public.fixture_assert(public.fixture_sync_operation_observe(a)=before_rows,'OLD failed BEGIN cannot mutate the ordinary admission');
  perform public.fixture_assert((select staff_retry is null and attempt_count=1 and status='dead_letter'
    from public.translation_job_items where id=legacy_item),'OLD item remains genuinely failed without a second active operation');
  insert into public.fixture_ordinary_admission_observations values('global-old-begin',jsonb_build_object('args',a,'legacyJob',legacy,'legacyItem',legacy_item));
end;$$;
reset role;
select case when current_setting('fixture.ordinary.admission.mode')='current'
  then 'M07_ORDINARY_GLOBAL_OLD_BEGIN_GUARD_PASS' else 'M07_ORDINARY_GLOBAL_BEFORE_NOT_RUN' end;

-- Keep one staged admission while its actual actor loses owner/admin.
set role authenticated;
do $$declare s jsonb;a jsonb;c jsonb;begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  s:=public.fixture_ordinary_admission_seed('role-demotion');a:=public.fixture_ordinary_admission_args(s);
  perform public.fixture_ordinary_admission_begin(a);c:=public.fixture_sync_stage_only(a,s);
  insert into public.fixture_ordinary_admission_observations values('role-demotion-before',
    jsonb_build_object('seed',s,'args',a,'candidate',c,'frozen',public.fixture_sync_operation_observe(a)));
end;$$;
reset role;
do $$begin if current_setting('fixture.ordinary.admission.mode')='current' then
  update public.staff_memberships set role='editor' where user_id='00000000-0000-4000-8000-000000000001';
end if;end;$$;
set role authenticated;
do $$declare proof jsonb;a jsonb;c jsonb;statement text;statements text[];begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  select value into proof from public.fixture_ordinary_admission_observations where label='role-demotion-before';a:=proof->'args';c:=proof->'candidate';
  perform public.fixture_assert(public.article_translation_sync_ready()=false,'demoted actor has no ordinary capability');
  statements:=array[
    format('select public.fixture_ordinary_admission_begin(%L::jsonb)',a::text),
    format('select public.get_article_translation_sync_run(%L::uuid)',a->>'p_job_id'),
    format('select public.get_article_translation_item_retry(%L::uuid,%L::uuid,%L::uuid)',a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id'),
    format('select public.begin_article_translation_item_retry(%L::uuid,%L::uuid,%L::uuid,1,0,%L,%L::timestamptz,%L::timestamptz,%L)',
      a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id',repeat('a',64),a->>'p_expected_article_updated_at',a->>'p_expected_english_updated_at','openai'),
    format('select public.get_article_translation_item_retry_progress(%L::uuid,%L::uuid,%L::uuid)',a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id'),
    format('select public.record_article_translation_item_retry_dispatch(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,%L,%L)',
      a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id',gen_random_uuid(),'openai','controlled-native-fixture-model','correction'),
    format('select public.record_article_translation_item_retry_response(%L::uuid,%L::uuid,%L::uuid,%L::jsonb)',a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id','{}'),
    format('select public.get_article_translation_item_retry_candidate(%L::uuid,%L::uuid,%L::uuid)',a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id'),
    format('select public.stage_article_translation_item_retry_candidate(%L::uuid,%L::uuid,%L::uuid,%L::jsonb,%L::jsonb)',a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id','{}','{}'),
    format('select public.finish_article_translation_item_retry(%L::uuid,%L::uuid,%L::uuid,%L::jsonb,null)',a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id','{}'),
    format('select public.recover_article_translation_item_retry_candidate(%L::uuid,%L::uuid,%L::uuid,%L)',a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id',c->>'candidateHash'),
    format('select public.checkpoint_article_translation_sync_run(%L::uuid,1,%L::jsonb,%L::jsonb,%L::jsonb,%L)',a->>'p_job_id','{}','{}','[]','openai')
  ];
  foreach statement in array statements loop perform public.fixture_ordinary_admission_expect(statement,'42501');end loop;
  perform public.fixture_assert(public.fixture_sync_operation_observe(a)=proof->'frozen','demotion rejects every direct ordinary mutation and replay without changing the private body');
end;$$;
reset role;
do $$begin if current_setting('fixture.ordinary.admission.mode')='current' then
  update public.staff_memberships set role='owner' where user_id='00000000-0000-4000-8000-000000000001';
end if;end;$$;
select case when current_setting('fixture.ordinary.admission.mode')='current'
  then 'M07_ORDINARY_ACTOR_DEMOTION_ALL_RPC_GUARDS_PASS' else 'M07_ORDINARY_ROLE_BEFORE_NOT_RUN' end;

-- Removal is isolated and rolled back. The same intact full fixture must
-- refuse admission before any job/item is created when capability is absent.
begin;
set role authenticated;
do $$declare s jsonb;a jsonb;begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  s:=public.fixture_ordinary_admission_seed('missing-index-capability');a:=public.fixture_ordinary_admission_args(s);
  insert into public.fixture_ordinary_admission_observations values('missing-index-capability',jsonb_build_object('args',a,'baseline',public.fixture_sync_operation_observe(a)));
  perform public.fixture_assert(public.article_translation_sync_ready()=true,'intact admission capability is ready for owner');
end;$$;
reset role;
do $$begin if current_setting('fixture.ordinary.admission.mode')='current' then
  execute 'drop index public.translation_article_active_operation_unique';
end if;end;$$;
set role authenticated;
do $$declare proof jsonb;a jsonb;begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  select value into proof from public.fixture_ordinary_admission_observations where label='missing-index-capability';a:=proof->'args';
  perform public.fixture_assert(public.article_translation_sync_ready()=false,'partial capability is read-only false');
  perform public.fixture_ordinary_admission_expect(format('select public.fixture_ordinary_admission_begin(%L::jsonb)',a::text),'42883');
  perform public.fixture_assert(public.fixture_sync_operation_observe(a)=proof->'baseline','partial capability blocks direct BEGIN before writes');
end;$$;
reset role;
rollback;
select case when current_setting('fixture.ordinary.admission.mode')='current'
  then 'M07_ORDINARY_DIRECT_BEGIN_CAPABILITY_GUARD_PASS' else 'M07_ORDINARY_CAPABILITY_BEFORE_NOT_RUN' end;

-- The actual existing service-role lease API cannot claim or complete an
-- ordinary reviewing item; its old grants remain unchanged.
set role authenticated;
do $$begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  perform public.fixture_ordinary_admission_expect('select * from public.claim_translation_job_items(''fixture-worker'',500,300)','42501');
end;$$;
reset role;
select set_config('request.jwt.claim.sub','',false);
set role service_role;
do $$declare proof jsonb;a jsonb;begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  select value into proof from public.fixture_ordinary_admission_observations where label='global-old-begin';a:=proof->'args';
  perform public.fixture_assert(not exists(select 1 from public.claim_translation_job_items('fixture-worker',500,300)
    where item_id=(a->>'p_item_id')::uuid),'worker cannot claim a durable ordinary reviewing admission');
  perform public.fixture_ordinary_admission_expect(format('select public.complete_translation_job_item(%L::uuid,%L,true)',a->>'p_item_id','fixture-worker'),'42501');
  perform public.fixture_ordinary_admission_expect(format('update public.translation_job_items set status=''leased'' where id=%L::uuid',a->>'p_item_id'),'42501');
end;$$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select case when current_setting('fixture.ordinary.admission.mode')='current'
  then 'M07_ORDINARY_WORKER_SEPARATION_PASS' else 'M07_ORDINARY_WORKER_BEFORE_NOT_RUN' end;

set role authenticated;
do $$declare s jsonb;a jsonb;call_id uuid:=gen_random_uuid();frozen jsonb;r jsonb;begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  s:=public.fixture_ordinary_admission_seed('unknown-provider-dispatch');a:=public.fixture_ordinary_admission_args(s);
  perform public.fixture_ordinary_admission_begin(a);
  perform public.record_article_translation_item_retry_dispatch((a->>'p_job_id')::uuid,(a->>'p_item_id')::uuid,
    (a->>'p_operation_id')::uuid,call_id,'openai','controlled-native-fixture-model','translation');
  frozen:=public.fixture_sync_operation_observe(a);
  perform public.fixture_ordinary_admission_expect(format('select public.finish_article_translation_item_retry(%L::uuid,%L::uuid,%L::uuid,%L::jsonb,null)',
    a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id',
    '{"status":"dead_letter","errorCode":"provider_request_failed","providerCalls":1}'),'40001');
  r:=public.fixture_ordinary_admission_begin(a);
  perform public.fixture_assert(r->'canExecute'='false' and r->'replayed'='true','unknown dispatch never becomes a fresh admission');
  perform public.fixture_assert(public.fixture_sync_operation_observe(a)=frozen,'unconfirmed provider result preserves the active admission and call ledger');
  insert into public.fixture_ordinary_admission_observations values('unknown-provider-dispatch',jsonb_build_object('args',a,'receipt',r,'operation',frozen));
end;$$;
do $$declare s jsonb;a jsonb;r jsonb;run jsonb;n integer;before_rows jsonb;begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  s:=public.fixture_ordinary_admission_seed('ordinary-lifetime-three');a:=public.fixture_ordinary_admission_args(s);
  perform public.fixture_ordinary_admission_begin(a);
  for n in 1..3 loop
    if n>1 then
      run:=public.get_article_translation_sync_run((a->>'p_job_id')::uuid);
      a:=a||jsonb_build_object('p_operation_id',gen_random_uuid(),'p_expected_job_version',(run->>'jobVersion')::bigint);
      r:=public.begin_article_translation_item_retry((a->>'p_job_id')::uuid,(a->>'p_item_id')::uuid,
        (a->>'p_operation_id')::uuid,(run->>'jobVersion')::bigint,n-1,a->>'p_expected_source_hash',
        (a->>'p_expected_article_updated_at')::timestamptz,(a->>'p_expected_english_updated_at')::timestamptz,'openai');
      perform public.fixture_assert(r->'canExecute'='true' and r->'maxAttempts'='3','selected lifetime retry admits one further operation');
    end if;
    r:=public.fixture_sync_known_outcome(a,s,false);
    perform public.fixture_assert(r->'attemptCount'=to_jsonb(n) and r->'maxAttempts'='3','actual known failure consumes one lifetime attempt');
  end loop;
  run:=public.get_article_translation_sync_run((a->>'p_job_id')::uuid);
  r:=public.get_article_translation_item_retry((a->>'p_job_id')::uuid,(a->>'p_item_id')::uuid,null);
  perform public.fixture_assert(r->>'phase'='blocked' and r->>'blockReason'='attempt_limit' and r->'attemptCount'='3','exhausted lifetime item is blocked truthfully');
  before_rows:=public.fixture_sync_operation_observe(a);
  perform public.fixture_ordinary_admission_expect(format('select public.begin_article_translation_item_retry(%L::uuid,%L::uuid,%L::uuid,%s,3,%L,%L::timestamptz,%L::timestamptz,%L)',
    a->>'p_job_id',a->>'p_item_id',gen_random_uuid(),run->>'jobVersion',a->>'p_expected_source_hash',
    a->>'p_expected_article_updated_at',a->>'p_expected_english_updated_at','openai'),'40001');
  perform public.fixture_assert(public.fixture_sync_operation_observe(a)=before_rows,'fourth lifetime operation performs no admission, dispatch or mutation');
  insert into public.fixture_ordinary_admission_observations values('ordinary-lifetime-three',jsonb_build_object('args',a,'run',run,'receipt',r));
end;$$;
reset role;
select case when current_setting('fixture.ordinary.admission.mode')='current'
  then 'M07_ORDINARY_UNKNOWN_DISPATCH_AND_LIFETIME_CAP_PASS' else 'M07_ORDINARY_LIFETIME_BEFORE_NOT_RUN' end;

-- This exact post-STAGE dataset runs against both the frozen first admission
-- migration and its targeted CAS-finalization repair. The BEFORE branch
-- captures actual 40001 and a retained admission; it is not a PASS substitute.
set role authenticated;
do $$declare s jsonb;a jsonb;c jsonb;frozen jsonb;changed jsonb;r jsonb;after_finish jsonb;kind text;
  before_fix boolean:=coalesce(current_setting('fixture.ordinary.poststage.mode',true),'current')='before';
begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  foreach kind in array array['ru','en'] loop
    s:=public.fixture_ordinary_admission_seed('poststage-cas-'||kind);a:=public.fixture_ordinary_admission_args(s);
    perform public.fixture_ordinary_admission_begin(a);c:=public.fixture_sync_stage_only(a,s);
    frozen:=public.fixture_sync_operation_observe(a);
    if kind='ru' then
      perform public.save_article_bundle((s->>'articleId')::uuid,
        (a->>'p_expected_article_updated_at')::timestamptz,
        s#>'{contextArgs,p_source_snapshot}'||jsonb_build_object('title','New authored RU after acknowledged STAGE',
          'status','draft','scheduled_at',null,'published_at',null,
          'content_html','<p>'||repeat('New authored RU text with retained rights and author sources. ',250)||'</p>'),
        'none',null,(a->>'p_expected_english_updated_at')::timestamptz,null,null,false,
        'fixture.ordinary.poststage.author_change','{}',false,'{}');
    else
      update public.article_translations set title='New manual EN after acknowledged STAGE',
        content_html='<p>'||repeat('New manually authored English with retained sources and rights. ',250)||'</p>',
        content_json=content_json-'__probperaPremiumTranslation',source_content_hash=null,
        updated_at=clock_timestamp() where article_id=(s->>'articleId')::uuid and locale='en';
    end if;
    changed:=public.fixture_sync_operation_observe(a);
    perform public.fixture_assert(changed#>'{article,draft}'=frozen#>'{article,draft}','actual canonical author edit keeps the staged full private body/version');
    if kind='ru' then
      perform public.fixture_assert(changed#>>'{article,article,status}'='draft',
        'native RU scenario is an explicit authored draft-status/body change, not a guarded published-row bypass');
    end if;
    c:=public.get_article_translation_item_retry_candidate((a->>'p_job_id')::uuid,(a->>'p_item_id')::uuid,(a->>'p_operation_id')::uuid);
    perform public.fixture_assert(c->'canRecover'='false' and c->>'blockReason'=case when kind='ru' then 'source_changed' else 'english_changed' end,
      'GET remains truthful about the canonical CAS refusal');
    perform public.fixture_ordinary_admission_expect(format('select public.finish_article_translation_item_retry(%L::uuid,%L::uuid,%L::uuid,%L::jsonb,null)',
      a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id',
      '{"status":"stale","errorCode":"source_changed","providerCalls":2}'),'40001');
    perform public.fixture_assert(public.fixture_sync_operation_observe(a)=changed,'caller cannot replace the original prepared outcome after canonical CAS refusal');
    if before_fix then
      perform public.fixture_ordinary_admission_expect(format('select public.recover_article_translation_item_retry_candidate(%L::uuid,%L::uuid,%L::uuid,%L)',
        a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id',c->>'candidateHash'),'40001');
      perform public.fixture_assert(public.fixture_sync_operation_observe(a)=changed,'original CAS refusal retains the full admission and candidate');
      insert into public.fixture_ordinary_admission_observations values('poststage-cas-'||kind,jsonb_build_object('mode','before','args',a,'candidate',c,'operation',changed));
    else
      r:=public.recover_article_translation_item_retry_candidate((a->>'p_job_id')::uuid,(a->>'p_item_id')::uuid,
        (a->>'p_operation_id')::uuid,c->>'candidateHash');
      perform public.fixture_assert(r->>'phase'='finished' and r->>'itemStatus'=case when kind='ru' then 'stale' else 'conflict' end
        and r#>>'{result,errorCode}'=case when kind='ru' then 'source_changed' else 'write_conflict' end
        and r#>>'{result,persistence}'='none' and r#>'{result,providerCalls}'='2',
        'server finishes the original known candidate as a canonical CAS refusal');
      after_finish:=public.fixture_sync_operation_observe(a);
      perform public.fixture_assert(after_finish->'article'=changed->'article'
        and after_finish#>'{item,staff_retry}'='null' and after_finish#>'{item,attempt_count}'='1',
        'known CAS finalization preserves new author content and private candidate while releasing admission');
      perform public.fixture_assert(after_finish#>'{attempts,0,staff_retry_receipt,progress}'=changed#>'{item,staff_retry,progress}'
        and after_finish#>'{attempts,0,staff_retry_receipt,finishFingerprint}'=changed#>'{item,staff_retry,candidate,finishFingerprint}',
        'finalization retains acknowledged calls and original prepared fingerprint');
      r:=public.recover_article_translation_item_retry_candidate((a->>'p_job_id')::uuid,(a->>'p_item_id')::uuid,
        (a->>'p_operation_id')::uuid,c->>'candidateHash');
      perform public.fixture_assert(r->'replayed'='true' and public.fixture_sync_operation_observe(a)=after_finish,
        'known CAS finalization replay has no save, dispatch or mutation');
      insert into public.fixture_ordinary_admission_observations values('poststage-cas-'||kind,
        jsonb_build_object('mode','current','args',a,'candidate',c,'receipt',r,'operation',after_finish));
    end if;
  end loop;
end;$$;
-- A canonical source change must not hide a separately changed private body.
do $$declare s jsonb;a jsonb;c jsonb;changed jsonb;begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  s:=public.fixture_ordinary_admission_seed('poststage-private-body-changed');a:=public.fixture_ordinary_admission_args(s);
  perform public.fixture_ordinary_admission_begin(a);c:=public.fixture_sync_stage_only(a,s);
  changed:=public.fixture_sync_operation_observe(a);
  perform public.fixture_assert(changed#>>'{article,article,status}'='published',
    'guarded manual private edit starts with the original published canonical row');
  perform public.save_article_working_draft((s->>'articleId')::uuid,
    (changed#>>'{article,article,updated_at}')::timestamptz,
    s#>'{contextArgs,p_source_snapshot}',
    jsonb_set(s->'englishEnvelope','{payload,title}','"New manually changed private English"'),
    (a->>'p_expected_english_updated_at')::timestamptz,(changed#>>'{article,draft,version}')::bigint);
  changed:=public.fixture_sync_operation_observe(a);
  perform public.fixture_assert(changed#>'{article,draft,version}'='2','actual guarded manual private save advances version');
  perform public.save_article_bundle((s->>'articleId')::uuid,
    (a->>'p_expected_article_updated_at')::timestamptz,
    s#>'{contextArgs,p_source_snapshot}'||jsonb_build_object('title','New canonical author RU',
      'status','draft','scheduled_at',null,'published_at',null),
    'none',null,(a->>'p_expected_english_updated_at')::timestamptz,null,null,false,
    'fixture.ordinary.poststage.private_change','{}',false,'{}');
  changed:=public.fixture_sync_operation_observe(a);
  perform public.fixture_assert(changed#>'{article,draft,version}'='2' and changed#>>'{article,article,status}'='draft',
    'subsequent allowed canonical source change retains the full manual private version');
  perform public.fixture_ordinary_admission_expect(format('select public.recover_article_translation_item_retry_candidate(%L::uuid,%L::uuid,%L::uuid,%L)',
    a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id',c->>'candidateHash'),'40001');
  perform public.fixture_assert(public.fixture_sync_operation_observe(a)=changed,'canonical CAS refusal cannot finalize a separately altered private body');
  insert into public.fixture_ordinary_admission_observations values('poststage-private-body-changed',jsonb_build_object('args',a,'operation',changed));
end;$$;
reset role;
select case when current_setting('fixture.ordinary.admission.mode')='before' then 'M07_ORDINARY_POSTSTAGE_BASELINE_NOT_RUN'
  when coalesce(current_setting('fixture.ordinary.poststage.mode',true),'current')='before'
    then 'M07_ORDINARY_POSTSTAGE_CAS_BEFORE_REPRODUCED'
  else 'M07_ORDINARY_POSTSTAGE_CAS_FINALIZATION_PASS' end;

select 'M07_ORDINARY_ADMISSION_NATIVE_OBSERVATIONS:'||coalesce((select jsonb_agg(to_jsonb(x) order by label)::text
  from public.fixture_ordinary_admission_observations x),'[]');

-- Compatibility evidence for the unchanged atomic scan-completion RPC. Read
-- snapshots use a fixture-owned definer; public mutations still run as staff.
create function public.fixture_sync_completion_observe(p_job uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object(
  'job',(select to_jsonb(j) from public.translation_jobs j where id=p_job),
  'jobCount',(select count(*) from public.translation_jobs),
  'itemCount',(select count(*) from public.translation_job_items where job_id=p_job),
  'itemsHash',(select md5(coalesce(jsonb_agg(to_jsonb(i) order by position),'[]')::text)
    from public.translation_job_items i where job_id=p_job),
  'attemptsHash',(select md5(coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]')::text)
    from public.translation_job_attempts a join public.translation_job_items i on i.id=a.item_id where i.job_id=p_job),
  'completionAuditCount',(select count(*) from public.admin_audit_log
    where action='translation.article_scan.completed' and entity_id=p_job::text),
  'articlesHash',(select md5(coalesce(jsonb_agg(to_jsonb(a) order by id),'[]')::text) from public.articles a),
  'englishHash',(select md5(coalesce(jsonb_agg(to_jsonb(e) order by id),'[]')::text) from public.article_translations e),
  'draftsHash',(select md5(coalesce(jsonb_agg(to_jsonb(d) order by article_id),'[]')::text) from public.article_working_drafts d));
$$;

set role authenticated;
do $$
declare item_count integer;job_id uuid;observed jsonb;cursor jsonb;run jsonb;full_resume jsonb;
  before_rows jsonb;after_rows jsonb;receipt jsonb;desired_cursor jsonb;
begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  foreach item_count in array array[499,500] loop
    job_id:=gen_random_uuid();
    select jsonb_agg(jsonb_build_object('entityId',
      ('f9999999-9999-4999-8999-'||lpad(to_hex(n),12,'0'))::uuid,'state','skipped') order by n)
      into observed from generate_series(1,item_count) n;
    cursor:=jsonb_build_object('articleScan',jsonb_build_object('version',1,'order','id',
      'upperId','f9999999-9999-4999-8999-000000000600',
      'afterId','f9999999-9999-4999-8999-000000000500','pendingIds','[]'::jsonb,
      'nextIndex',0,'lastWindow',false,'exhausted',false));
    run:=public.checkpoint_article_translation_sync_run(job_id,0,'{}',cursor,observed,'openai');
    perform public.fixture_assert(run->'totalItems'=to_jsonb(item_count) and run->'activeItems'='0'
      and run->'resumeCursor'=cursor,'actual bounded ordinary run contains only cheap skipped observations');
    full_resume:=public.get_translation_job_resume(job_id);
    perform public.fixture_assert(full_resume->>'id'=job_id::text and full_resume->>'kind'='article'
      and ((full_resume->'resumeCursor')-'articleOrdinary')=cursor
      and full_resume#>'{resumeCursor,articleOrdinary,version}'='1'
      and full_resume#>>'{resumeCursor,articleOrdinary,actorId}'=auth.uid()::text,
      'actual resume RPC returns the original full ordinary marker and scan');
    before_rows:=public.fixture_sync_completion_observe(job_id);
    perform public.fixture_ordinary_admission_expect(format(
      'select public.complete_article_translation_scan(%L::uuid,%L::jsonb)',job_id,cursor::text),'40001');
    perform public.fixture_assert(public.fixture_sync_completion_observe(job_id)=before_rows,
      'stripping the saved ordinary marker refuses completion without any write');
    receipt:=public.complete_article_translation_scan(job_id,full_resume->'resumeCursor');
    after_rows:=public.fixture_sync_completion_observe(job_id);
    desired_cursor:=jsonb_set(jsonb_set(full_resume->'resumeCursor',
      '{articleScan,lastWindow}','true',false),'{articleScan,exhausted}','true',false);
    perform public.fixture_assert(receipt->>'id'=job_id::text and receipt->'resumeCursor'=desired_cursor
      and receipt->>'status'=full_resume->>'status',
      'full saved cursor seals the original job, including the full500 boundary');
    perform public.fixture_assert(after_rows-array['job','completionAuditCount']=before_rows-array['job','completionAuditCount']
      and after_rows->>'completionAuditCount'='1'
      and (after_rows#>>'{job,version}')::bigint=(before_rows#>>'{job,version}')::bigint+1
      and after_rows#>'{job,resume_cursor}'=desired_cursor
      and ((after_rows->'job')-array['resume_cursor','version','updated_at'])=
        ((before_rows->'job')-array['resume_cursor','version','updated_at']),
      'completion only advances cursor/version/audit; no new job, item, attempt or author/private-body changes');
    receipt:=public.complete_article_translation_scan(job_id,full_resume->'resumeCursor');
    perform public.fixture_assert(receipt->'resumeCursor'=desired_cursor
      and public.fixture_sync_completion_observe(job_id)=after_rows,
      'replaying the original full completion intent has no additional audit, version or content mutation');
    insert into public.fixture_ordinary_admission_observations values('compat-empty-tail-'||item_count,
      jsonb_build_object('before',before_rows,'after',after_rows,'receipt',receipt));
  end loop;
end;$$;
reset role;
select case when current_setting('fixture.ordinary.admission.mode')='current'
  then 'M07_ORDINARY_FULL_CURSOR_EMPTY_TAIL_PASS' else 'M07_ORDINARY_COMPAT_COMPLETION_BEFORE_NOT_RUN' end;

-- A fulfilled pre-STAGE CAS refusal has no private candidate. The known two
-- response ACKs can finish accounting without a second provider or body save.
set role authenticated;
do $$
declare s jsonb;a jsonb;call_id uuid;pass text;progress jsonb;outcome jsonb;candidate jsonb;
  changed jsonb;receipt jsonb;finished jsonb;
begin
  if current_setting('fixture.ordinary.admission.mode')='before' then return; end if;
  s:=public.fixture_ordinary_admission_seed('compat-prestage-source-refusal');a:=public.fixture_ordinary_admission_args(s);
  perform public.fixture_ordinary_admission_begin(a);
  foreach pass in array array['translation','review'] loop
    call_id:=gen_random_uuid();
    progress:=public.record_article_translation_item_retry_dispatch((a->>'p_job_id')::uuid,
      (a->>'p_item_id')::uuid,(a->>'p_operation_id')::uuid,call_id,'openai','controlled-native-fixture-model',pass);
    perform public.fixture_assert(progress->'canDispatch'='true','prestage fixture records one new dispatch per pass');
    progress:=public.record_article_translation_item_retry_response((a->>'p_job_id')::uuid,
      (a->>'p_item_id')::uuid,(a->>'p_operation_id')::uuid,jsonb_build_object('callId',call_id,'provider','openai',
        'model','controlled-native-fixture-model','pass',pass,'httpStatus',200,
        'requestId','prestage-fixture-request','responseId','prestage-fixture-response','inputTokens',11,'outputTokens',13));
  end loop;
  perform public.fixture_assert(progress->'providerCalls'='2','both known responses are acknowledged before the CAS refusal');
  perform public.save_article_bundle((s->>'articleId')::uuid,(a->>'p_expected_article_updated_at')::timestamptz,
    s#>'{contextArgs,p_source_snapshot}'||jsonb_build_object('title','New author RU retained after pre-stage refusal',
      'status','draft','scheduled_at',null,'published_at',null),
    'none',null,(a->>'p_expected_english_updated_at')::timestamptz,null,null,false,
    'fixture.ordinary.compat.prestage','{}',false,'{}');
  changed:=public.fixture_sync_operation_observe(a);
  outcome:=jsonb_build_object('status','succeeded','providerCalls',2,'model','controlled-native-fixture-model',
    'requestId','prestage-fixture-request','inputTokens',22,'outputTokens',26,'durationMs',100);
  perform public.fixture_ordinary_admission_expect(format(
    'select public.stage_article_translation_item_retry_candidate(%L::uuid,%L::uuid,%L::uuid,%L::jsonb,%L::jsonb)',
    a->>'p_job_id',a->>'p_item_id',a->>'p_operation_id',outcome::text,(s->'englishEnvelope')::text),'40001');
  candidate:=public.get_article_translation_item_retry_candidate((a->>'p_job_id')::uuid,
    (a->>'p_item_id')::uuid,(a->>'p_operation_id')::uuid);
  perform public.fixture_assert(candidate->>'phase'='running' and candidate->>'candidateState'='missing'
    and candidate->>'blockReason'='candidate_missing' and candidate->'providerCalls'='2'
    and public.fixture_sync_operation_observe(a)=changed,
    'actual missing-candidate read confirms no STAGE commit and preserves the full admitted operation');
  outcome:=outcome||jsonb_build_object('status','conflict','errorCode','write_conflict');
  receipt:=public.finish_article_translation_item_retry((a->>'p_job_id')::uuid,(a->>'p_item_id')::uuid,
    (a->>'p_operation_id')::uuid,outcome,null);
  finished:=public.fixture_sync_operation_observe(a);
  perform public.fixture_assert(receipt->>'phase'='finished' and receipt#>>'{result,outcome}'='conflict'
    and receipt#>>'{result,errorCode}'='write_conflict' and receipt#>>'{result,persistence}'='none'
    and receipt#>'{result,providerCalls}'='2' and finished->'article'=changed->'article'
    and finished#>'{item,staff_retry}'='null' and finished#>'{item,attempt_count}'='1'
    and finished#>'{attempts,0,staff_retry_receipt,progress}'=changed#>'{item,staff_retry,progress}',
    'known pre-stage refusal finishes original accounting and preserves new author RU, old public EN and exact acknowledged ledger');
  receipt:=public.finish_article_translation_item_retry((a->>'p_job_id')::uuid,(a->>'p_item_id')::uuid,
    (a->>'p_operation_id')::uuid,outcome,null);
  perform public.fixture_assert(receipt->'replayed'='true' and public.fixture_sync_operation_observe(a)=finished,
    'known refusal FINISH replay has no dispatch, private save or author mutation');
  insert into public.fixture_ordinary_admission_observations values('compat-prestage-refusal',
    jsonb_build_object('args',a,'candidate',candidate,'changed',changed,'finished',finished,'receipt',receipt));
end;$$;
reset role;
select case when current_setting('fixture.ordinary.admission.mode')='current'
  then 'M07_ORDINARY_PRESTAGE_REFUSAL_ACCOUNTING_PASS' else 'M07_ORDINARY_COMPAT_PRESTAGE_BEFORE_NOT_RUN' end;
select 'M07_ORDINARY_COMPAT_NATIVE_OBSERVATIONS:'||coalesce((select jsonb_agg(to_jsonb(x) order by label)::text
  from public.fixture_ordinary_admission_observations x),'[]');
