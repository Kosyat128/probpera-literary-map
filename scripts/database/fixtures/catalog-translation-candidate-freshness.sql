-- Isolated native PG contract. Prepend the unchanged catalog-operation native
-- foundation and the CLI-generated freshness migration, then this fixture.
-- Existing catalog_fixture_* and premium_fixture_* are actual maintained
-- admission/review fixtures, not replacements for the production algorithms.
reset role;
create table public.catalog_freshness_fixture_results(label text primary key,value jsonb not null);
alter table public.catalog_freshness_fixture_results enable row level security;
create policy catalog_freshness_fixture_staff on public.catalog_freshness_fixture_results for all to authenticated
  using(public.is_staff()) with check(public.is_staff());
grant select,insert,update on public.catalog_freshness_fixture_results to authenticated;

create function public.catalog_freshness_fixture_read(d jsonb,catalog_fields jsonb default null)
returns jsonb language sql set search_path='' as $$
 select public.get_catalog_translation_candidate_freshness(d->>'entityType',d->>'entityId',(d->>'id')::uuid,
   (d->>'version')::bigint,d->>'candidateHash',d->>'sourceHash',
   case when d->>'entityType'='country' then d#>>'{sourceRevision,catalogSourceHash}' else null end,catalog_fields);
$$;
create function public.catalog_freshness_fixture_shape(v jsonb,d jsonb)
returns void language plpgsql set search_path='' as $$ begin
 assert jsonb_typeof(v)='object' and v ?& array['version','entityType','entityId','draftId','draftVersion','candidateHash','sourceHash','linked','canPromote','reason'];
 assert v-array['version','entityType','entityId','draftId','draftVersion','candidateHash','sourceHash','linked','canPromote','reason']='{}'::jsonb,
   'Metadata response must not expose any private body, source, provider or extra field';
 assert v->'version'='1'::jsonb and v->'entityType'=d->'entityType' and v->'entityId'=d->'entityId'
   and v->'draftId'=d->'id' and v->'draftVersion'=d->'version'
   and v->'candidateHash'=d->'candidateHash' and v->'sourceHash'=d->'sourceHash';
 assert jsonb_typeof(v->'linked')='boolean' and jsonb_typeof(v->'canPromote')='boolean';
 assert v->'reason'='null'::jsonb or v->>'reason' in ('candidate_missing','candidate_changed','source_changed');
 assert (v->'canPromote'='true'::jsonb)=(v->'reason'='null'::jsonb);
end; $$;
create function public.catalog_freshness_fixture_complete(a jsonb)
returns jsonb language plpgsql set search_path='' as $$ declare r jsonb;begin
 r:=public.catalog_fixture_begin(a);r:=public.catalog_fixture_pass(r,'translation',a->'payload');
 r:=public.catalog_fixture_pass(r,'review',a->'payload');return public.catalog_fixture_finish(r,a->'payload');
end; $$;

-- Entire journal/cache/candidate contents are fingerprinted internally so a
-- read cannot quietly record a call, consume a receipt, or mutate operations.
-- This helper is fixture-only and intentionally has no client execute grant.
create function public.catalog_freshness_fixture_journal_hash()
returns text language sql set search_path='' as $$
 select probpera_translation_operations.retry_fingerprint(jsonb_build_object(
  'jobs',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from public.translation_jobs t),
  'items',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from public.translation_job_items t),
  'attempts',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from public.translation_job_attempts t),
  'cache',(select coalesce(jsonb_agg(to_jsonb(t) order by operation_id),'[]'::jsonb) from premium_translation_private.catalog_operation_artifacts t),
  'drafts',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from public.premium_translation_working_drafts t)));
$$;
revoke all on function public.catalog_freshness_fixture_journal_hash() from public,anon,authenticated,service_role;

-- A real newly linked candidate is current. A different fresh staff actor may
-- inspect safe metadata, but cannot read the original actor's private cache.
do $$ declare k text;a jsonb;r jsonb;d jsonb;v jsonb;fields jsonb;before_audit bigint;before_outbox bigint;before_journal text;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach k in array array['literary_work','country'] loop
  a:=public.catalog_fixture_seed(k,'freshness-current-'||k,true);
  fields:=case when k='country' then a#>'{expectedState,catalogFields}' else null end;
  set local role authenticated;
  r:=public.catalog_freshness_fixture_complete(a);
  d:=public.get_premium_translation_working_draft(k,a->>'entityId')->'draft';
  reset role;
  select count(*) into before_audit from public.admin_audit_log;
  select count(*) into before_outbox from public.premium_fixture_outbox;
  before_journal:=public.catalog_freshness_fixture_journal_hash();
  set local role authenticated;
  v:=public.catalog_freshness_fixture_read(d,fields);perform public.catalog_freshness_fixture_shape(v,d);
  assert v->'linked'='true'::jsonb and v->'canPromote'='true'::jsonb and v->'reason'='null'::jsonb;
  perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
  assert public.catalog_freshness_fixture_read(d,fields)=v;
  perform public.premium_fixture_error(format('select public.catalog_fixture_artifact(%L::jsonb)',r::text),'42501');
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  insert into public.catalog_freshness_fixture_results values('linked-current-other-staff-'||k,v);
  reset role;
  assert (select count(*)=before_audit from public.admin_audit_log) and (select count(*)=before_outbox from public.premium_fixture_outbox),
    'Metadata inspection must not audit, publish, consume or mutate the candidate';
  assert before_journal=public.catalog_freshness_fixture_journal_hash(),'Exact journal/calls/cache/candidate contents unchanged';
 end loop;
end; $$;

-- Link lookup by actual draft UUID must survive tampered receipt or body. A
-- linked candidate never downgrades into the legacy passthrough on mismatch.
do $$ declare mode text;a jsonb;r jsonb;d jsonb;changed jsonb;v jsonb;
 original public.premium_translation_working_drafts%rowtype;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 a:=public.catalog_fixture_seed('literary_work','freshness-linked-tamper',true);
 set local role authenticated;r:=public.catalog_freshness_fixture_complete(a);
 d:=public.get_premium_translation_working_draft('literary_work',a->>'entityId')->'draft';reset role;
 select * into original from public.premium_translation_working_drafts where id=(d->>'id')::uuid;
 foreach mode in array array['version','hash','sourceHash','payload','provenance'] loop
  update public.premium_translation_working_drafts set
   version=case mode when 'version' then original.version+1 else original.version end,
   candidate_hash=case mode when 'hash' then repeat('f',64) else original.candidate_hash end,
   source_hash=case mode when 'sourceHash' then repeat('e',64) else original.source_hash end,
   payload=case mode when 'payload' then jsonb_set(original.payload,'{description}','"TAMPERED PRIVATE PAYLOAD"') else original.payload end,
   provenance=case mode when 'provenance' then jsonb_set(original.provenance,'{translatorModel}','"TAMPERED MODEL"') else original.provenance end where id=original.id;
  set local role authenticated;v:=public.catalog_freshness_fixture_read(d);perform public.catalog_freshness_fixture_shape(v,d);
  assert v->'linked'='true'::jsonb and v->'canPromote'='false'::jsonb;
  assert v->>'reason'=case when mode in ('version','hash','sourceHash') then 'candidate_changed' else 'source_changed' end;
  insert into public.catalog_freshness_fixture_results values('linked-tamper-'||mode,v);reset role;
 end loop;
 update public.premium_translation_working_drafts set version=original.version,candidate_hash=original.candidate_hash,source_hash=original.source_hash,
  payload=original.payload,provenance=original.provenance where id=original.id;
 set local role authenticated;
 assert public.catalog_freshness_fixture_read(d)->'canPromote'='true'::jsonb;
 v:=public.catalog_freshness_fixture_read(d||jsonb_build_object('entityId',gen_random_uuid()));
 assert v->'canPromote'='false'::jsonb and v->>'reason'='candidate_changed';
 perform public.premium_fixture_discard(d);
 v:=public.catalog_freshness_fixture_read(d);perform public.catalog_freshness_fixture_shape(v,d);
 assert v->'linked'='false'::jsonb and v->'canPromote'='false'::jsonb and v->>'reason'='candidate_missing';
 insert into public.catalog_freshness_fixture_results values('consumed-candidate-no-legacy',v);reset role;
end; $$;

-- Fault injection is isolated in rollback subtransactions. Only a40001 from
-- the linked guard becomes stale; permissions/other database errors propagate.
-- The original existing guard definition is restored before the next test.
do $$ declare a jsonb;r jsonb;d jsonb;v jsonb;code text;seen text;definition text;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 a:=public.catalog_fixture_seed('literary_work','freshness-error-mapping',true);
 set local role authenticated;r:=public.catalog_freshness_fixture_complete(a);
 d:=public.get_premium_translation_working_draft('literary_work',a->>'entityId')->'draft';reset role;
 select pg_get_functiondef('premium_translation_private.assert_catalog_operation_promotion_current(public.premium_translation_working_drafts,text,jsonb)'::regprocedure) into definition;
 foreach code in array array['40001','42501','XX000'] loop
  begin
   execute format('create or replace function premium_translation_private.assert_catalog_operation_promotion_current(d public.premium_translation_working_drafts,catalog_hash text,catalog_fields jsonb) returns void language plpgsql security invoker set search_path='''' set timezone=''UTC'' as $fault$begin raise exception ''Synthetic fixture fault'' using errcode=%L;end;$fault$',code);
   set local role authenticated;seen:=null;v:=null;
   begin v:=public.catalog_freshness_fixture_read(d);exception when others then get stacked diagnostics seen=returned_sqlstate;end;
   if code='40001' then assert seen is null and v->>'reason'='source_changed' and v->'canPromote'='false'::jsonb;
   else assert seen=code and v is null;end if;
   reset role;
   raise exception 'Rollback only synthetic replacement' using errcode='ZX001';
  exception when sqlstate 'ZX001' then null;end;
  assert (select pg_get_functiondef('premium_translation_private.assert_catalog_operation_promotion_current(public.premium_translation_working_drafts,text,jsonb)'::regprocedure))=definition;
  set local role authenticated;assert public.catalog_freshness_fixture_read(d)->'canPromote'='true'::jsonb;reset role;
  insert into public.catalog_freshness_fixture_results values('only40001-stale-'||code,jsonb_build_object('propagatedSqlstate',seen,'freshness',v));
 end loop;
end; $$;

-- Reproduce the actual book UI defect without touching any master timestamp.
-- The unchanged atomic promote guard must reject the same linked candidate.
do $$ declare a jsonb;r jsonb;d jsonb;v jsonb;before_master jsonb;after_master jsonb;before_outbox bigint;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 a:=public.catalog_fixture_seed('literary_work','freshness-source-licence',true);
 set local role authenticated;r:=public.catalog_freshness_fixture_complete(a);
 d:=public.get_premium_translation_working_draft('literary_work',a->>'entityId')->'draft';
 assert public.catalog_freshness_fixture_read(d)->'canPromote'='true'::jsonb;reset role;
 select jsonb_build_object('work',to_jsonb(w),'ru',to_jsonb(ru),'en',to_jsonb(en)) into before_master
  from public.literary_works w join public.literary_work_translations ru on ru.work_id=w.id and ru.locale='ru'
  join public.literary_work_translations en on en.work_id=w.id and en.locale='en' where w.id=(a->>'entityId')::uuid;
 update public.literary_work_sources set license_name='NEW LICENCE ONLY',metadata='{"rights":{"permission":"CHANGED ONLY SOURCE TERMS"}}'
  where work_id=(a->>'entityId')::uuid;
 select jsonb_build_object('work',to_jsonb(w),'ru',to_jsonb(ru),'en',to_jsonb(en)) into after_master
  from public.literary_works w join public.literary_work_translations ru on ru.work_id=w.id and ru.locale='ru'
  join public.literary_work_translations en on en.work_id=w.id and en.locale='en' where w.id=(a->>'entityId')::uuid;
 assert before_master=after_master,'Master work/RU/EN rows INCLUDING timestamps stay exact';
 select count(*) into before_outbox from public.premium_fixture_outbox;
 set local role authenticated;v:=public.catalog_freshness_fixture_read(d);perform public.catalog_freshness_fixture_shape(v,d);
 assert v->'linked'='true'::jsonb and v->'canPromote'='false'::jsonb and v->>'reason'='source_changed';
 perform public.premium_fixture_error(format('select public.catalog_fixture_approve(%L::jsonb)',r::text),'40001');
 insert into public.catalog_freshness_fixture_results values('linked-book-source-licence-master-exact',v);
 reset role;assert (select count(*)=before_outbox from public.premium_fixture_outbox);
 assert (select jsonb_build_object('work',to_jsonb(w),'ru',to_jsonb(ru),'en',to_jsonb(en))=after_master from public.literary_works w
  join public.literary_work_translations ru on ru.work_id=w.id and ru.locale='ru'
  join public.literary_work_translations en on en.work_id=w.id and en.locale='en' where w.id=(a->>'entityId')::uuid);
end; $$;

-- Full override opaque rights can drift with an unchanged timestamp. Normalize
-- at transaction now(), capture, then modify rights in this SAME transaction;
-- the unchanged real set_updated_at() trigger also uses transaction now().
do $$ declare mode text;a jsonb;r jsonb;d jsonb;v jsonb;fresh jsonb;fields jsonb;before_row jsonb;after_row jsonb;
 c public.country_profile_overrides%rowtype;before_outbox bigint;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach mode in array array['catalog','override-rights'] loop
  a:=public.catalog_fixture_seed('country','freshness-'||mode,true);
  update public.country_profile_overrides set updated_at=now() where country_id=a->>'entityId' returning * into c;
  fresh:=public.premium_fixture_args('country',a->>'entityId');
  a:=a||jsonb_build_object('sourceRevision',fresh->'sourceRevision','targetRevision',fresh->'targetRevision',
    'expectedState',jsonb_build_object('version',1,'catalogFields',a#>'{expectedState,catalogFields}',
       'override',jsonb_build_object('id',c.id,'fields',c.fields,'updated_at',c.updated_at)));
  fields:=a#>'{expectedState,catalogFields}';
  set local role authenticated;r:=public.catalog_freshness_fixture_complete(a);
  d:=public.get_premium_translation_working_draft('country',a->>'entityId')->'draft';
  assert public.catalog_freshness_fixture_read(d,fields)->'canPromote'='true'::jsonb;reset role;
  select to_jsonb(t) into before_row from public.country_profile_overrides t where country_id=a->>'entityId';
  if mode='catalog' then fields:=jsonb_set(fields,'{rights}','{"catalog":"NEW RAW CATALOG TERMS"}');
  else update public.country_profile_overrides set fields=jsonb_set(country_profile_overrides.fields,'{rights}','"NEW RAW OVERRIDE TERMS"') where country_id=a->>'entityId';end if;
  select to_jsonb(t) into after_row from public.country_profile_overrides t where country_id=a->>'entityId';
  assert before_row->'updated_at'=after_row->'updated_at';
  if mode='catalog' then assert before_row=after_row;
  else assert before_row-'fields'=after_row-'fields' and before_row#>'{fields,translations}'=after_row#>'{fields,translations}';end if;
  select count(*) into before_outbox from public.premium_fixture_outbox;
  set local role authenticated;v:=public.catalog_freshness_fixture_read(d,fields);perform public.catalog_freshness_fixture_shape(v,d);
  assert v->'linked'='true'::jsonb and v->'canPromote'='false'::jsonb and v->>'reason'='source_changed';
  perform public.premium_fixture_error(format('select public.catalog_fixture_approve(%L::jsonb,%L::jsonb)',r::text,fields::text),'40001');
  insert into public.catalog_freshness_fixture_results values('linked-country-'||mode||'-timestamp-exact',v);
  reset role;assert (select to_jsonb(t)=after_row from public.country_profile_overrides t where country_id=a->>'entityId');
  assert (select count(*)=before_outbox from public.premium_fixture_outbox);
 end loop;
end; $$;

-- A concrete unlinked legacy candidate passes only this extra predicate; the
-- existing review and explicit human/atomic guards still decide publication.
-- Uppercase textual UUID is deliberately retained, matching the old contract.
do $$ declare k text;a jsonb;d jsonb;v jsonb;fields jsonb;identity text;begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach k in array array['literary_work','country'] loop
  a:=public.catalog_fixture_seed(k,'freshness-legacy-'||k,true);fields:=case when k='country' then a#>'{expectedState,catalogFields}' else null end;
  if k='literary_work' then identity:=upper(a->>'identity');a:=a||jsonb_build_object('identity',identity,'sourceRevision',jsonb_set(a->'sourceRevision','{workId}',to_jsonb(identity)));end if;
  set local role authenticated;d:=public.premium_fixture_stage(a)->'draft';
  v:=public.catalog_freshness_fixture_read(d,fields);perform public.catalog_freshness_fixture_shape(v,d);
  assert v->'linked'='false'::jsonb and v->'canPromote'='true'::jsonb and v->'reason'='null'::jsonb;
  insert into public.catalog_freshness_fixture_results values('legacy-exact-text-and-bound-receipt-'||k,v);
  v:=public.catalog_freshness_fixture_read(d||jsonb_build_object('version',(d->>'version')::bigint+1),fields);
  assert v->'canPromote'='false'::jsonb and v->>'reason'='candidate_changed';
  insert into public.catalog_freshness_fixture_results values('legacy-wrong-version-'||k,v);
  v:=public.catalog_freshness_fixture_read(d||jsonb_build_object('candidateHash',repeat('f',64)),fields);
  assert v->'canPromote'='false'::jsonb and v->>'reason'='candidate_changed';
  insert into public.catalog_freshness_fixture_results values('legacy-wrong-candidate-hash-'||k,v);
  v:=public.catalog_freshness_fixture_read(d||jsonb_build_object('sourceHash',repeat('e',64)),fields);
  assert v->'canPromote'='false'::jsonb and v->>'reason'='candidate_changed';
  insert into public.catalog_freshness_fixture_results values('legacy-wrong-source-hash-'||k,v);
  v:=public.catalog_freshness_fixture_read(d||jsonb_build_object('id',gen_random_uuid()),fields);
  assert v->'canPromote'='false'::jsonb and v->>'reason'='candidate_missing';
  insert into public.catalog_freshness_fixture_results values('legacy-wrong-draft-id-'||k,v);
  if k='literary_work' then
   v:=public.catalog_freshness_fixture_read(d||jsonb_build_object('entityId',lower(d->>'entityId')),fields);
   assert v->'canPromote'='false'::jsonb and v->>'reason'='candidate_changed';
   insert into public.catalog_freshness_fixture_results values('legacy-uuid-text-case-mismatch',v);
  end if;
  reset role;
 end loop;
end; $$;

-- Auth/ACL cannot turn denied reads into legacy/current claims. Null and
-- nonstaff fail fresh actor verification before domain validation.
do $$ declare fn regprocedure:='public.get_catalog_translation_candidate_freshness(text,text,uuid,bigint,text,text,text,jsonb)'::regprocedure;
 statement text:='select public.get_catalog_translation_candidate_freshness(''country'',''fixture-country'',gen_random_uuid(),1,repeat(''a'',64),repeat(''b'',64),repeat(''c'',64),''{}''::jsonb)';begin
 assert has_function_privilege('authenticated',fn,'EXECUTE') and not has_function_privilege('anon',fn,'EXECUTE')
   and not has_function_privilege('service_role',fn,'EXECUTE');
 set local role anon;perform public.premium_fixture_error(statement,'42501');reset role;
 set local role service_role;perform public.premium_fixture_error(statement,'42501');reset role;
 set local role authenticated;perform set_config('request.jwt.claim.sub','',true);perform public.premium_fixture_error(statement,'42501');
 perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);perform public.premium_fixture_error(statement,'42501');
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform public.premium_fixture_error('select public.get_catalog_translation_candidate_freshness(''writer_biography'',''fixture-country:writer'',gen_random_uuid(),1,repeat(''a'',64),repeat(''b'',64))','22023');
 perform public.premium_fixture_error('select public.get_catalog_translation_candidate_freshness(''site_copy'',gen_random_uuid()::text,gen_random_uuid(),1,repeat(''a'',64),repeat(''b'',64))','22023');
 reset role;
 insert into public.catalog_freshness_fixture_results values('staff-only-closed-kinds','true');
end; $$;
select 'M07_CATALOG_FRESHNESS_INITIAL_PASS';
