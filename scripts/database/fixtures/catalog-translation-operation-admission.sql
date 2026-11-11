-- Synthetic local-only PG17 contract; never a production/provider operation.
-- Original book/country/writer/site-copy SQL and writer admission tests precede
-- this fixture. No old migration or private-draft DTO is rewritten.
reset role;
create table public.catalog_operation_fixture_results(label text primary key,value jsonb not null);
alter table public.catalog_operation_fixture_results enable row level security;
create policy catalog_operation_fixture_staff on public.catalog_operation_fixture_results for all to authenticated using(public.is_staff()) with check(public.is_staff());
grant select,insert,update on public.catalog_operation_fixture_results to authenticated;
create function public.catalog_fixture_compact_json(v jsonb)
returns text language plpgsql immutable set search_path='' as $$
declare result text;
begin
 if jsonb_typeof(v)='array' then select '['||coalesce(string_agg(public.catalog_fixture_compact_json(value),',' order by n),'')||']' into result from jsonb_array_elements(v) with ordinality x(value,n);return result;
 elsif jsonb_typeof(v)='object' then select '{'||coalesce(string_agg(to_jsonb(key)::text||':'||public.catalog_fixture_compact_json(value),',' order by array_position(array['year','title','description'],key),key),'')||'}' into result from jsonb_each(v);return result;
 else return v::text;end if;
end; $$;
create function public.catalog_fixture_hash(k text,s jsonb)
returns text language plpgsql immutable set search_path='' as $$
declare keys text[]; result text;
begin
 keys:=case k when 'literary_work' then array['russianTitle','verifiedEnglishTitle','verifiedEnglishTitleSourceUrl','description','originalTitle','firstPublished','originalLanguage','sourceLanguage','sourceUrls']
 else array['name','region','continent','officialLanguage','capital','description','history','historicalNote','literaryPeriods','literaryMovements','periods','facts','literaryPlaces','timeline','chronology'] end;
 select '{'||string_agg(to_jsonb(key)::text||':'||public.catalog_fixture_compact_json(s->key),',' order by n)||'}' into result from unnest(keys) with ordinality x(key,n);
 return encode(sha256(convert_to(result,'UTF8')),'hex');
end; $$;
create function public.catalog_fixture_config(k text,review boolean)
returns jsonb language sql immutable set search_path='' as $$
 select public.writer_operation_fixture_config()||jsonb_build_object('schemaName',case k when 'literary_work' then 'probpera_literary_work_translation' else 'probpera_country_profile_translation' end,
  'maxOutputTokens',case k when 'literary_work' then 4000 else 12000 end,'twoPassReview',review);
$$;
create function public.catalog_fixture_seed(k text,tag text,review boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare identity text; wid uuid; args jsonb; expected jsonb; raw_catalog jsonb; country_id text;
 w public.literary_works%rowtype; ru public.literary_work_translations%rowtype; en public.literary_work_translations%rowtype; c public.country_profile_overrides%rowtype;
begin
 if k='literary_work' then
  wid:=gen_random_uuid();identity:=wid::text;
  insert into public.literary_works(id,legacy_id,country_id,writer_id,title,slug,original_title,first_published,original_language,editorial_status,metadata,updated_at)
   values(wid,'native-'||wid,'fixture-country','fixture-writer','Исходное название','native-'||wid,'Original title',1900,'Russian','reviewed','{"rights":{"owner":"AUTHOR"},"exact":[null,"keep"]}','2026-10-01T10:00:00.123456Z');
  insert into public.literary_work_translations(work_id,locale,title,description,source_language,translation_method,editorial_status,source_urls,reviewed_at,metadata,updated_at)
   values(wid,'ru','Русское название','Русское авторское описание сохраняет все исходные литературные сведения и последовательность повествования. Права, лицензии источников и авторские уточнения должны сохраняться без изменений.','Russian','editorial-original','reviewed',array['https://fixture.test/ru'],'2026-10-01','{"rights":"RU AUTHOR EXACT"}','2026-10-01T10:00:00.123457Z'),
   (wid,'en','Exact Verified English Title','The retained English literary description preserves its documented setting and the original narrative sequence. Its sources, rights and editorial qualifications remain available for human review.','Russian','machine-translation','reviewed',array['https://fixture.test/title','https://fixture.test/ru'],'2026-10-01',
    '{"rights":"EN AUTHOR EXACT","premiumTranslation":{"bibliographicTitle":{"value":"Exact Verified English Title","sourceUrl":"https://fixture.test/title"}}}','2026-10-01T10:00:00.123458Z');
  insert into public.literary_work_sources(work_id,provider,source_url,field_names,license_name,usage,retrieved_at,metadata)
   values(wid,'verified-bibliography','https://fixture.test/title',array['title'],'ORIGINAL SOURCE LICENCE','reference-only','2026-10-08','{"rights":{"permission":"KEEP EXACT"}}');
  select * into w from public.literary_works where id=wid;
  select * into ru from public.literary_work_translations where work_id=wid and locale='ru';
  select * into en from public.literary_work_translations where work_id=wid and locale='en';
  args:=public.premium_fixture_args(k,identity);
  expected:=jsonb_build_object('version',1,'work',jsonb_build_object('id',w.id,'title',w.title,'original_title',w.original_title,'first_published',w.first_published,'original_language',w.original_language,'editorial_status',w.editorial_status,'updated_at',w.updated_at),
   'russian',jsonb_build_object('id',ru.id,'title',ru.title,'description',ru.description,'source_language',ru.source_language,'source_urls',ru.source_urls,'editorial_status',ru.editorial_status,'updated_at',ru.updated_at,'metadata',ru.metadata),
   'english',jsonb_build_object('id',en.id,'title',en.title,'description',en.description,'source_urls',en.source_urls,'translation_method',en.translation_method,'editorial_status',en.editorial_status,'updated_at',en.updated_at,'metadata',en.metadata),
   'titleSource',jsonb_build_object('provider','verified-bibliography','source_url','https://fixture.test/title','retrieved_at','2026-10-08'));
 else
  identity:='catalog-'||tag;
  args:=public.premium_fixture_args(k,'fixture-country');raw_catalog:=args->'source'||'{"rights":{"catalog":"KEEP RAW CATALOG RIGHTS"},"translations":{"fr":{"locale":"fr","text":"Texte exact"}}}';
  insert into public.country_profile_overrides(country_id,fields,updated_at) values(identity,raw_catalog||jsonb_build_object('rights','RAW OVERRIDE RIGHTS',
   'translations',jsonb_build_object('fr',jsonb_build_object('locale','fr','text','Exact private French'),
    'en',jsonb_build_object('locale','en','method','machine-translation','status','reviewed','sourceHash',repeat('0',64),'fields',args#>'{payload,fields}','rights','KEEP RAW EN RIGHTS'))),'2026-10-01T10:00:00.123456Z') returning * into c;
  args:=public.premium_fixture_args(k,identity);
  expected:=jsonb_build_object('version',1,'catalogFields',raw_catalog,'override',jsonb_build_object('id',c.id,'fields',c.fields,'updated_at',c.updated_at));
 end if;
 return args||jsonb_build_object('entityType',k,'entityId',identity,'sourceHash',public.catalog_fixture_hash(k,args->'source'),
  'expectedState',expected,'configuration',public.catalog_fixture_config(k,review),'currentCursor',jsonb_build_object(case k when 'literary_work' then 'libraryCursor' else 'countryCursor' end,6),
  'resumeCursor',jsonb_build_object(case k when 'literary_work' then 'libraryCursor' else 'countryCursor' end,7));
end; $$;
create function public.catalog_fixture_begin(a jsonb)
returns jsonb language sql set search_path='' as $$
 select public.begin_catalog_translation_operation(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),a->>'entityType',a->>'entityId','cloudflare',a->>'sourceHash',
  a->'source',a->'sourceRevision',a->'targetRevision',a->'expectedState',a->'configuration',a->'currentCursor',a->'resumeCursor');
$$;
create function public.catalog_fixture_artifact(r jsonb)
returns jsonb language sql set search_path='' as $$ select public.get_catalog_translation_operation_artifacts((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,
 r->>'entityType',r->>'entityId',r->>'intentHash',r->>'sourceHash'); $$;
create function public.catalog_fixture_pass(r jsonb,pass text,payload jsonb)
returns jsonb language plpgsql set search_path='' as $$ declare d jsonb; metadata jsonb;begin
 d:=public.record_catalog_translation_operation_dispatch((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,gen_random_uuid(),'cloudflare',
  case pass when 'translation' then 'fixture-translator' else 'fixture-reviewer' end,pass,repeat('c',64));
 metadata:=jsonb_build_object('callId',d->'pendingCallId','provider','cloudflare','model',case pass when 'translation' then 'fixture-translator' else 'fixture-reviewer' end,
  'pass',pass,'httpStatus',null,'requestId',null,'responseId',case pass when 'translation' then 'native-translation' else 'native-editorial' end,'inputTokens',5,'outputTokens',6);
 return public.record_catalog_translation_operation_response((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,metadata,
   jsonb_build_object('version',1,'body',jsonb_build_object('response',(case r->>'entityType' when 'literary_work' then jsonb_build_object('description',payload->'description') else payload->'fields' end)::text)));
end; $$;
create function public.catalog_fixture_finish(r jsonb,payload jsonb)
returns jsonb language plpgsql set search_path='' as $$ declare a jsonb; calls jsonb; first jsonb; last jsonb; candidate jsonb; n integer;begin
 a:=public.catalog_fixture_artifact(r);calls:=a->'calls';n:=jsonb_array_length(calls);first:=calls->0->'metadata';last:=calls->(n-1)->'metadata';
 candidate:=jsonb_build_object('payload',payload,'provenance',jsonb_build_object('provider','cloudflare','translatorModel',first->'model',
   'reviewerModel',case when n=1 then 'null'::jsonb else last->'model' end,'translatorRequestId',first->'responseId',
   'reviewerRequestId',case when n=1 then 'null'::jsonb else last->'responseId' end,
   'generatedAt',to_char((last->>'responseReceivedAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  'translatorCallId',first->'callId','reviewerCallId',case when n=1 then 'null'::jsonb else last->'callId' end);
 return public.finish_catalog_translation_operation((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,
   jsonb_build_object('status','succeeded','providerCalls',n,'model','fixture-translator'),candidate);
end; $$;
do $$ declare k text; args jsonb; r jsonb; done jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach k in array array['literary_work','country'] loop
  args:=public.catalog_fixture_seed(k,'normal-'||k,true);
  set local role authenticated;
  assert public.catalog_translation_operation_ready() is true;
  r:=public.catalog_fixture_begin(args);assert r->'canExecute'='true'::jsonb;
  r:=public.catalog_fixture_pass(r,'translation',args->'payload');r:=public.catalog_fixture_pass(r,'review',args->'payload');
  done:=public.catalog_fixture_finish(r,args->'payload');assert done#>>'{result,state}'='translated' and done#>>'{result,persistence}'='working-draft';
  assert done->'resumeCursor'=args->'resumeCursor';
  insert into public.catalog_operation_fixture_results values('normal-'||k,jsonb_build_object('args',args,'receipt',done,'artifact',public.catalog_fixture_artifact(done)));
  reset role;
 end loop;
end; $$;
select 'M07_CATALOG_INITIAL_PASS';

create function public.catalog_fixture_approve(r jsonb,p_catalog_fields jsonb default null)
returns jsonb language plpgsql set search_path='' as $$ declare d jsonb; catalog jsonb;begin
 d:=public.get_premium_translation_working_draft(r->>'entityType',r->>'entityId')->'draft';
 if r->>'entityType'='country' then catalog:=coalesce(p_catalog_fields,public.catalog_fixture_artifact(r)#>'{rawSeed,catalogFields}');end if;
 return public.promote_premium_translation_working_draft(r->>'entityType',r->>'entityId',(d->>'id')::uuid,(d->>'version')::bigint,
  d->>'candidateHash',d->>'sourceHash',case r->>'entityType' when 'country' then d#>>'{sourceRevision,catalogSourceHash}' else null end,catalog,true);
end; $$;
-- Optional review remains optional: one translation or translation+repair.
-- The configured repair model stays non-null; actual reviewer provenance does
-- not claim a pass that never ran. Old writer admission still requires review.
do $$ declare k text; repair boolean; args jsonb; r jsonb; done jsonb; artifact jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach k in array array['literary_work','country'] loop
  foreach repair in array array[false,true] loop
   args:=public.catalog_fixture_seed(k,'optional-'||k||'-'||repair,false);
   set local role authenticated;
   r:=public.catalog_fixture_begin(args);r:=public.catalog_fixture_pass(r,'translation',args->'payload');
   if repair then r:=public.catalog_fixture_pass(r,'repair',args->'payload');end if;
   done:=public.catalog_fixture_finish(r,args->'payload');artifact:=public.catalog_fixture_artifact(done);
   assert done#>>'{result,state}'='translated';
   if not repair then
    assert done->'providerCalls'='1'::jsonb and artifact#>'{candidate,reviewerCallId}'='null'::jsonb and artifact#>'{candidate,provenance,reviewerModel}'='null'::jsonb;
   else assert done->'providerCalls'='2'::jsonb and artifact#>>'{candidate,provenance,reviewerModel}'='fixture-reviewer';end if;
   insert into public.catalog_operation_fixture_results values('optional-'||k||'-'||repair,jsonb_build_object('receipt',done,'artifact',artifact));
   reset role;
  end loop;
 end loop;
end; $$;

-- The full raw title-source licence/metadata inventory is independent of all
-- master timestamps and old title projections. A NEW linked draft must refuse
-- approval both before FINISH and after it. Canonical rows/builds stay exact.
do $$ declare mode text; args jsonb; r jsonb; done jsonb; before_master jsonb; after_master jsonb; before_outbox bigint;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach mode in array array['before-finish','after-finish'] loop
  args:=public.catalog_fixture_seed('literary_work','licence-'||mode,true);
  set local role authenticated;
  r:=public.catalog_fixture_begin(args);r:=public.catalog_fixture_pass(r,'translation',args->'payload');r:=public.catalog_fixture_pass(r,'review',args->'payload');
  if mode='after-finish' then done:=public.catalog_fixture_finish(r,args->'payload');end if;
  reset role;
  select jsonb_build_object('work',to_jsonb(w),'ru',to_jsonb(ru),'en',to_jsonb(en)) into before_master
   from public.literary_works w join public.literary_work_translations ru on ru.work_id=w.id and ru.locale='ru'
   join public.literary_work_translations en on en.work_id=w.id and en.locale='en' where w.id=(r->>'entityId')::uuid;
  update public.literary_work_sources set license_name='CHANGED SOURCE LICENCE ONLY',metadata='{"rights":{"permission":"NEW SOURCE CONDITIONS"}}' where work_id=(r->>'entityId')::uuid;
  select jsonb_build_object('work',to_jsonb(w),'ru',to_jsonb(ru),'en',to_jsonb(en)) into after_master
   from public.literary_works w join public.literary_work_translations ru on ru.work_id=w.id and ru.locale='ru'
   join public.literary_work_translations en on en.work_id=w.id and en.locale='en' where w.id=(r->>'entityId')::uuid;
  assert before_master=after_master,'Licence-only change must leave work/RU/EN INCLUDING timestamps exact';
  select count(*) into before_outbox from public.premium_fixture_outbox;
  set local role authenticated;
  if mode='before-finish' then done:=public.catalog_fixture_finish(r,args->'payload');assert done#>>'{result,state}'='stale';end if;
  assert done#>>'{result,persistence}'='working-draft' and public.catalog_fixture_artifact(done)->'candidate'<>'null'::jsonb;
  perform public.premium_fixture_error(format('select public.catalog_fixture_approve(%L::jsonb)',done::text),'40001');
  reset role;
  assert (select jsonb_build_object('work',to_jsonb(w),'ru',to_jsonb(ru),'en',to_jsonb(en))=after_master from public.literary_works w
   join public.literary_work_translations ru on ru.work_id=w.id and ru.locale='ru' join public.literary_work_translations en on en.work_id=w.id and en.locale='en' where w.id=(r->>'entityId')::uuid);
  assert (select count(*)=before_outbox from public.premium_fixture_outbox);
  insert into public.catalog_operation_fixture_results values('linked-licence-'||mode,jsonb_build_object('receipt',done,'masterRowsAndTimestampsExact',before_master=after_master,'artifact',public.catalog_fixture_artifact(done)));
 end loop;
end; $$;

-- A different catalogue JSON must not slip through by supplying its old hash.
-- Full canonical override/map drift is retained privately and never approved.
do $$ declare mode text; args jsonb; r jsonb; done jsonb; fields jsonb; before_row jsonb; before_outbox bigint;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach mode in array array['catalog','override','manual'] loop
  args:=public.catalog_fixture_seed('country','drift-'||mode,true);
  set local role authenticated;
  r:=public.catalog_fixture_begin(args);r:=public.catalog_fixture_pass(r,'translation',args->'payload');r:=public.catalog_fixture_pass(r,'review',args->'payload');
  reset role;
  if mode='override' then update public.country_profile_overrides c set fields=jsonb_set(c.fields,'{rights}','"NEW OVERRIDE RIGHTS"') where country_id=r->>'entityId';
  elsif mode='manual' then update public.country_profile_overrides c set fields=jsonb_set(c.fields,'{translations,en,method}','"human-translation"') where country_id=r->>'entityId';end if;
  select to_jsonb(c) into before_row from public.country_profile_overrides c where country_id=r->>'entityId';
  select count(*) into before_outbox from public.premium_fixture_outbox;
  fields:=args#>'{expectedState,catalogFields}';if mode='catalog' then fields:=jsonb_set(fields,'{rights}','{"catalog":"NEW CATALOG RIGHTS"}');end if;
  set local role authenticated;
  done:=public.catalog_fixture_finish(r,args->'payload');assert done#>>'{result,persistence}'='working-draft';
  if mode<>'catalog' then assert done#>>'{result,state}'='conflict';end if;
  perform public.premium_fixture_error(format('select public.catalog_fixture_approve(%L::jsonb,%L::jsonb)',done::text,fields::text),'40001');
  reset role;
  assert (select to_jsonb(c)=before_row from public.country_profile_overrides c where country_id=r->>'entityId');
  assert (select count(*)=before_outbox from public.premium_fixture_outbox);
  insert into public.catalog_operation_fixture_results values('country-'||mode||'-drift',jsonb_build_object('receipt',done,'canonicalExact',true));
 end loop;
end; $$;

-- Link by UUID first: changed version/hash/payload/provenance must never turn a
-- new candidate into a weaker legacy candidate. Unlinked legacy drafts retain
-- the existing explicit-review path; all original branch bytes are preserved.
do $$ declare mode text; args jsonb; r jsonb; done jsonb; d public.premium_translation_working_drafts%rowtype; original public.premium_translation_working_drafts%rowtype;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 args:=public.catalog_fixture_seed('literary_work','tamper',true);
 set local role authenticated;
 r:=public.catalog_fixture_begin(args);r:=public.catalog_fixture_pass(r,'translation',args->'payload');r:=public.catalog_fixture_pass(r,'review',args->'payload');done:=public.catalog_fixture_finish(r,args->'payload');
 reset role;
 select * into original from public.premium_translation_working_drafts where id=(done#>>'{result,draftId}')::uuid;
 foreach mode in array array['version','hash','payload','provenance'] loop
  update public.premium_translation_working_drafts set version=case mode when 'version' then 2 else original.version end,
   candidate_hash=case mode when 'hash' then repeat('f',64) else original.candidate_hash end,
   payload=case mode when 'payload' then jsonb_set(original.payload,'{description}',to_jsonb('Tampered payload with a fresh public receipt. Source and licence approval must still fail for this linked private candidate.'::text)) else original.payload end,
   provenance=case mode when 'provenance' then jsonb_set(original.provenance,'{translatorModel}','"TAMPERED MODEL"') else original.provenance end where id=original.id;
  set local role authenticated;
  perform public.premium_fixture_error(format('select public.catalog_fixture_approve(%L::jsonb)',done::text),'40001');
  reset role;
 end loop;
 update public.premium_translation_working_drafts set version=original.version,candidate_hash=original.candidate_hash,payload=original.payload,provenance=original.provenance where id=original.id;
 args:=public.catalog_fixture_seed('literary_work','legacy',true);
 set local role authenticated;
 r:=public.premium_fixture_stage(args)->'draft';
 assert public.premium_fixture_promote(r)->>'state'='promoted';
 reset role;
 insert into public.catalog_operation_fixture_results values('linked-tamper-and-unlinked-legacy','true');
end; $$;
select 'M07_CATALOG_BINDING_PASS';

do $$ declare k text; args jsonb; r jsonb; done jsonb; artifact jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach k in array array['literary_work','country'] loop
  args:=public.catalog_fixture_seed(k,'positive-'||k,true);
  set local role authenticated;
  r:=public.catalog_fixture_begin(args);r:=public.catalog_fixture_pass(r,'translation',args->'payload');r:=public.catalog_fixture_pass(r,'review',args->'payload');done:=public.catalog_fixture_finish(r,args->'payload');
  assert public.catalog_fixture_approve(done)->>'state'='promoted';
  assert public.catalog_fixture_artifact(done)->'candidate'<>'null'::jsonb;
  insert into public.catalog_operation_fixture_results values('new-linked-positive-'||k,done);
  reset role;
 end loop;
 -- The existing writer protocol runs under the new triggers and promotion
 -- function with its original forced-review contract and cache untouched.
 set local role authenticated;
 r:=public.writer_operation_fixture_begin('catalog-compat-writer');
 r:=public.writer_operation_fixture_response(public.writer_operation_fixture_dispatch(r,'translation'));
 r:=public.writer_operation_fixture_response(public.writer_operation_fixture_dispatch(r,'review'));
 done:=public.writer_operation_fixture_finish(r);assert done#>>'{result,state}'='translated';
 reset role;
 insert into public.catalog_operation_fixture_results values('writer-api-compatibility',done);
end; $$;

-- Unknown dispatch survives new source/provider/actor/UUID, cancellation and
-- native direct mutation attempts. Raw received output is not a candidate.
do $$ declare k text; args jsonb; r jsonb; d jsonb; other jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach k in array array['literary_work','country'] loop
  args:=public.catalog_fixture_seed(k,'unknown-'||k,true);
  set local role authenticated;
  r:=public.catalog_fixture_begin(args);
  d:=public.record_catalog_translation_operation_dispatch((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,gen_random_uuid(),'cloudflare','fixture-translator','translation',repeat('c',64));
  assert public.catalog_fixture_begin(args)->>'operationId'=r->>'operationId';
  assert public.catalog_fixture_begin(args)->>'blockReason'='provider_outcome_unknown';
  other:=args||jsonb_build_object('sourceHash',repeat('f',64),'configuration',(args->'configuration')||'{"provider":"openai","model":"other-model"}');
  other:=public.begin_catalog_translation_operation(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),k,args->>'entityId','openai',repeat('f',64),
   args->'source',args->'sourceRevision',args->'targetRevision',args->'expectedState',other->'configuration',args->'currentCursor',args->'resumeCursor');
  assert other->>'operationId'=r->>'operationId' and other->'canExecute'='false'::jsonb;
  perform public.premium_fixture_error(format('select public.finish_catalog_translation_operation(%L,%L,%L,''{"status":"dead_letter","providerCalls":1,"errorCode":"provider_request_failed"}'')',r->>'jobId',r->>'itemId',r->>'operationId'),'40001');
  perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
  assert public.catalog_fixture_begin(args)->>'blockReason'='operation_owned_by_another_actor';
  perform public.premium_fixture_error(format('select public.catalog_fixture_artifact(%L::jsonb)',r::text),'42501');
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  perform public.request_translation_job_cancel((r->>'jobId')::uuid,(r->>'jobVersion')::bigint);
  other:=public.reconcile_catalog_translation_operation(k,args->>'entityId');
  assert other->>'blockReason'='provider_outcome_unknown' and other->'resumeCursor'=args->'currentCursor';
  insert into public.catalog_operation_fixture_results values('unknown-'||k,jsonb_build_object('receipt',other,'artifact',public.catalog_fixture_artifact(other)));
  reset role;
 end loop;
end; $$;
set role authenticated;
select public.premium_fixture_error('update public.translation_job_items set staff_retry=null','42501');
select public.premium_fixture_error('select * from premium_translation_private.catalog_operation_artifacts','42501');
reset role;
set role service_role;
select public.premium_fixture_error($q$update public.translation_job_items set staff_retry=null where staff_retry->>'protocol'='catalog-translation'$q$,'42501');
select public.premium_fixture_error($q$update public.translation_job_items set entity_id='tampered' where staff_retry->>'protocol'='catalog-translation'$q$,'42501');
select public.premium_fixture_error($q$delete from public.translation_jobs where resume_cursor ? 'catalogOperation'$q$,'42501');
select public.premium_fixture_error('select * from premium_translation_private.catalog_operation_artifacts','42501');
reset role;
insert into public.catalog_operation_fixture_results values('native-auth-service-tamper','true');

-- Confirmed zero-call cleanup preserves CURRENT cursor. Cancellation after
-- complete response retains valid pending output and cancellation semantics.
do $$ declare k text; args jsonb; r jsonb; done jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach k in array array['literary_work','country'] loop
  args:=public.catalog_fixture_seed(k,'zero-'||k,true);
  set local role authenticated;r:=public.catalog_fixture_begin(args);
  done:=public.finish_catalog_translation_operation((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,'{"status":"skipped","providerCalls":0}');
  assert done->'resumeCursor'=args->'currentCursor';
  insert into public.catalog_operation_fixture_results values('zero-current-'||k,done);reset role;
  args:=public.catalog_fixture_seed(k,'cancel-complete-'||k,true);
  set local role authenticated;r:=public.catalog_fixture_begin(args);r:=public.catalog_fixture_pass(r,'translation',args->'payload');r:=public.catalog_fixture_pass(r,'review',args->'payload');
  perform public.request_translation_job_cancel((r->>'jobId')::uuid,(r->>'jobVersion')::bigint);
  done:=public.catalog_fixture_finish(r,args->'payload');
  assert done#>>'{result,state}'='cancelled' and done#>>'{result,persistence}'='working-draft' and done#>>'{result,humanReview}'='pending';
  insert into public.catalog_operation_fixture_results values('cancel-complete-'||k,done);reset role;
 end loop;
end; $$;

do $$ declare k text; args jsonb; r jsonb; prior jsonb; done jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach k in array array['literary_work','country'] loop
  args:=public.catalog_fixture_seed(k,'slot-'||k,true);
  set local role authenticated;r:=public.catalog_fixture_begin(args);r:=public.catalog_fixture_pass(r,'translation',args->'payload');r:=public.catalog_fixture_pass(r,'review',args->'payload');
  prior:=public.premium_fixture_stage(args)->'draft';done:=public.catalog_fixture_finish(r,args->'payload');
  assert done#>>'{result,persistence}'='private-artifact' and done#>'{result,draftId}'='null'::jsonb and done#>'{result,draftVersion}'='null'::jsonb and done#>'{result,draftUpdatedAt}'='null'::jsonb;
  assert public.get_premium_translation_working_draft(k,args->>'entityId')->'draft'=prior;
  assert public.catalog_fixture_artifact(done)->'candidate'<>'null'::jsonb;
  insert into public.catalog_operation_fixture_results values('pending-slot-'||k,done);reset role;
 end loop;
end; $$;

-- Hard limits fail closed before mutation; the oversized server row is NOT in
-- the expected client projection. Received/oversized bodies never masquerade
-- as acknowledged successful output or grant another dispatch.
do $$ declare args jsonb; r jsonb; d jsonb; count_before bigint; metadata jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 args:=public.catalog_fixture_seed('literary_work','server-oversize',true);
 update public.literary_work_sources set metadata=jsonb_build_object('rights',repeat('x',4194304)) where work_id=(args->>'entityId')::uuid;
 select count(*) into count_before from public.translation_jobs;
 set local role authenticated;perform public.premium_fixture_error(format('select public.catalog_fixture_begin(%L::jsonb)',args::text),'22023');reset role;
 assert (select count(*)=count_before from public.translation_jobs);
 args:=public.catalog_fixture_seed('country','response-oversize',true);
 set local role authenticated;r:=public.catalog_fixture_begin(args);
 d:=public.record_catalog_translation_operation_dispatch((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,gen_random_uuid(),'cloudflare','fixture-translator','translation',repeat('c',64));
 metadata:=jsonb_build_object('callId',d->'pendingCallId','provider','cloudflare','model','fixture-translator','pass','translation','httpStatus',null,'requestId',null,'responseId',null,'inputTokens',null,'outputTokens',null);
 perform public.premium_fixture_error(format('select public.record_catalog_translation_operation_response(%L,%L,%L,%L::jsonb,%L::jsonb)',
  r->>'jobId',r->>'itemId',r->>'operationId',metadata::text,jsonb_build_object('version',1,'body',repeat('x',1048576))::text),'22023');
 assert public.catalog_fixture_artifact(r)#>'{calls,0,metadata,responseReceivedAt}'='null'::jsonb;
 insert into public.catalog_operation_fixture_results values('oversize-source-response',jsonb_build_object('sourceOrphanJobs',0,'responseStillUnknown',true));
 reset role;
end; $$;

set role anon;select public.premium_fixture_error('select public.catalog_translation_operation_ready()','42501');reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','',false);select public.premium_fixture_error('select public.catalog_translation_operation_ready()','42501');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);select public.premium_fixture_error('select public.catalog_translation_operation_ready()','42501');
reset role;
do $$ begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 alter table public.translation_job_items disable trigger translation_items_catalog_integrity;assert public.catalog_translation_operation_ready() is false;
 alter table public.translation_job_items enable trigger translation_items_catalog_integrity;
 alter function public.reconcile_catalog_translation_operation(text,text,uuid) rename to catalog_fixture_missing_reconcile;
 assert public.catalog_translation_operation_ready() is false;
 alter function public.catalog_fixture_missing_reconcile(text,text,uuid) rename to reconcile_catalog_translation_operation;
 assert public.catalog_translation_operation_ready() is true;
 assert not exists(select 1 from public.translation_job_items where staff_retry->>'protocol'='catalog-translation' and (staff_retry::text like '%RU AUTHOR EXACT%' or staff_retry::text like '%ORIGINAL SOURCE LICENCE%'));
 assert not exists(select 1 from public.translation_job_attempts where staff_retry_receipt::text like '%ORIGINAL SOURCE LICENCE%');
 assert not has_function_privilege('authenticated','public.claim_translation_job_items(text,integer,integer)','EXECUTE');
 assert not has_function_privilege('authenticated','public.complete_translation_job_item(uuid,text,boolean,text,text,text,integer,integer,integer)','EXECUTE');
 insert into public.catalog_operation_fixture_results values('ready-privacy-unchanged-lease-boundary','true');
end; $$;
select 'M07_CATALOG_FULL_PASS';

do $$ declare args jsonb; r jsonb; a jsonb; call jsonb; replay jsonb; bad jsonb;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 args:=public.catalog_fixture_seed('literary_work','replay',true);
 set local role authenticated;
 r:=public.catalog_fixture_begin(args);r:=public.catalog_fixture_pass(r,'translation',args->'payload');
 a:=public.catalog_fixture_artifact(r);call:=a->'calls'->0;
 replay:=public.record_catalog_translation_operation_dispatch((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,
  (call#>>'{metadata,callId}')::uuid,'cloudflare','fixture-translator','translation',call->>'requestHash');
 assert replay->'canDispatch'='false'::jsonb and replay->'replayed'='true'::jsonb;
 replay:=public.record_catalog_translation_operation_response((r->>'jobId')::uuid,(r->>'itemId')::uuid,(r->>'operationId')::uuid,
  (call->'metadata')-array['dispatchRecordedAt','responseReceivedAt'],call->'responseArtifact');
 assert replay->'replayed'='true'::jsonb and replay->'providerCalls'='1'::jsonb;
 r:=public.catalog_fixture_pass(r,'review',args->'payload');
 bad:=args->'payload'||jsonb_build_object('description',repeat('x',1048576));
 perform public.premium_fixture_error(format('select public.catalog_fixture_finish(%L::jsonb,%L::jsonb)',r::text,bad::text),'22023');
 assert public.catalog_fixture_artifact(r)->'candidate'='null'::jsonb;
 replay:=public.catalog_fixture_finish(r,args->'payload');
 assert public.catalog_fixture_finish(r,args->'payload')->'result'=replay->'result';
 assert (select count(*)=1 from public.translation_job_attempts where item_id=(r->>'itemId')::uuid);
 insert into public.catalog_operation_fixture_results values('ack-replay-candidate-limit-one-attempt',replay);
 reset role;
end; $$;
select 'M07_CATALOG_FINAL_PASS';
