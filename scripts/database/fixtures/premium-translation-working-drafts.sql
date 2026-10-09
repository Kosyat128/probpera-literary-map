-- Isolated native PG contract. The builder prepends unchanged canonical SQL and
-- the actual new migration. Auth/staff and public-build capture are local only.
create function public.premium_fixture_assert(ok boolean, label text)
returns void language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'PREMIUM ASSERT: %',label; end if;
end; $$;
create function public.premium_fixture_error(statement text, expected text)
returns void language plpgsql as $$ declare seen text; begin
  begin execute statement; exception when others then get stacked diagnostics seen=returned_sqlstate; end;
  if seen is distinct from expected then raise exception 'Expected SQLSTATE %, got %',expected,coalesce(seen,'success'); end if;
end; $$;

create table public.premium_fixture_outbox(kind text, identity text);
create function public.premium_fixture_capture() returns trigger language plpgsql security definer as $$
begin insert into public.premium_fixture_outbox values(tg_table_name,new.id::text); return new; end; $$;
create trigger premium_fixture_book_outbox after update on public.literary_work_translations
  for each row execute function public.premium_fixture_capture();
create trigger premium_fixture_country_outbox after insert or update on public.country_profile_overrides
  for each row execute function public.premium_fixture_capture();

insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
insert into public.staff_memberships(user_id,role) values('11111111-1111-4111-8111-111111111111','editor'),('22222222-2222-4222-8222-222222222222','admin');
insert into public.literary_works(id,legacy_id,country_id,writer_id,title,slug,original_title,first_published,original_language,editorial_status,metadata,updated_at)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','premium-fixture-work','fixture-country','fixture-author','Исходное название','premium-fixture-work','Original identity',1920,'Russian','reviewed',
 '{"authorPreserve":{"id":"authored"},"rights":{"owner":"author"}}','2026-10-08T10:00:00.123456Z');
insert into public.literary_work_sources(work_id,provider,source_url,field_names,usage,retrieved_at,metadata)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','verified-bibliography','https://fixture.test/title',array['title'],'reference-only','2026-10-08','{"rights":"title-only"}'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','editorial-source','https://fixture.test/ru',array['description'],'reference-only','2026-10-08','{"rights":"reference"}');
insert into public.literary_work_translations(id,work_id,locale,title,description,source_language,translation_method,editorial_status,source_urls,reviewed_at,metadata,updated_at)
values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ru','Исходное название',
 'Русский литературный текст описывает вымышленное произведение и его литературное значение для проверки сохранности редакторских данных. Второе предложение сохраняет исходное авторское содержание и подтверждённые сведения.',
 'Russian','editorial-original','reviewed',array['https://fixture.test/ru'],'2026-10-08','{"authored":"RU immutable"}','2026-10-08T10:00:00.123457Z'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','en','Exact Verified English Title',
 'This previously admitted English description remains available to public readers while a separate candidate awaits a human decision. Its second sentence preserves the existing reviewed editorial account and all bibliographic identifiers.',
 'Russian','machine-translation','reviewed',array['https://fixture.test/title','https://fixture.test/ru'],'2026-10-07',
 '{"authored":{"owner":"editor"},"rights":{"license":"unchanged"},"premiumTranslation":{"custom":"retained","bibliographicTitle":{"value":"Exact Verified English Title","sourceUrl":"https://fixture.test/title"}}}',
 '2026-10-08T10:00:00.123458Z');
grant select on public.literary_works,public.literary_work_translations,public.literary_work_sources to anon,authenticated;
alter table public.country_profile_overrides enable row level security;
create policy premium_fixture_country_public on public.country_profile_overrides for select to anon,authenticated using(is_enabled);
grant select on public.country_profile_overrides to anon,authenticated;

create table public.premium_fixture_saved(name text primary key, value jsonb not null);
create function public.premium_fixture_args(kind text, identity text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare work public.literary_works%rowtype; ru public.literary_work_translations%rowtype; en public.literary_work_translations%rowtype;
  country public.country_profile_overrides%rowtype; source jsonb; source_revision jsonb; target_revision jsonb; payload jsonb;
begin
  if kind='literary_work' then
    select * into work from public.literary_works where id=identity::uuid;
    select * into ru from public.literary_work_translations where work_id=work.id and locale='ru';
    select * into en from public.literary_work_translations where work_id=work.id and locale='en';
    source:=jsonb_build_object('russianTitle',ru.title,'verifiedEnglishTitle',btrim(en.title),'verifiedEnglishTitleSourceUrl','https://fixture.test/title',
      'description',ru.description,'originalTitle',work.original_title,'firstPublished',work.first_published,'originalLanguage',work.original_language,
      'sourceLanguage',ru.source_language,'sourceUrls',ru.source_urls);
    source_revision:=jsonb_build_object('workId',work.id,'workUpdatedAt',work.updated_at,'russianId',ru.id,'russianUpdatedAt',ru.updated_at);
    target_revision:=jsonb_build_object('id',en.id,'updatedAt',en.updated_at);
    payload:=jsonb_build_object('description',
      'This structurally valid candidate incorrectly states that the fictional book was written on the Moon by a committee of astronomers. A human editor must check the facts and sources before this deliberately wrong account can replace the reviewed text.',
      'sourceLanguage','Russian','sourceUrls',jsonb_build_array('https://fixture.test/title','https://fixture.test/ru'),
      'bibliographicTitle',jsonb_build_object('value',en.title,'provider','verified-bibliography','sourceUrl','https://fixture.test/title','retrievedAt','2026-10-08'));
  else
    select * into country from public.country_profile_overrides where country_id=identity;
    source:=jsonb_build_object('name','Страна','region','Регион','continent','Континент','officialLanguage','Язык','capital','Столица',
      'description','Редакторский текст страны','history','','historicalNote','','literaryPeriods',jsonb_build_array('Период'),
      'literaryMovements','[]'::jsonb,'periods','[]'::jsonb,'facts',jsonb_build_array('Факт'),'literaryPlaces','[]'::jsonb,
      'timeline',jsonb_build_array(jsonb_build_object('year','1900','title','Событие','description','Описание')),'chronology','[]'::jsonb);
    source_revision:=jsonb_build_object('overrideId',country.id,'overrideUpdatedAt',country.updated_at,'catalogSourceHash',repeat('b',64));
    target_revision:=jsonb_build_object('id',country.id,'updatedAt',country.updated_at);
    payload:=jsonb_build_object('fields',jsonb_build_object('name','Country','region','Region','continent','Continent','officialLanguage','Language','capital','Capital',
      'description','A separate English candidate.','history','','historicalNote','','literaryPeriods',jsonb_build_array('Period'),
      'literaryMovements','[]'::jsonb,'periods','[]'::jsonb,'facts',jsonb_build_array('Fact'),'literaryPlaces','[]'::jsonb,
      'timeline',jsonb_build_array(jsonb_build_object('year','1900','title','Event','description','Description')),'chronology','[]'::jsonb));
  end if;
  return jsonb_build_object('kind',kind,'identity',identity,'sourceHash',repeat('a',64),'source',source,'sourceRevision',source_revision,
    'targetRevision',target_revision,'payload',payload,'provenance',jsonb_build_object('provider','cloudflare','translatorModel','fixture-translator',
      'reviewerModel','fixture-reviewer','translatorRequestId','req-1','reviewerRequestId',null,'generatedAt','2026-10-08T10:10:00.123456Z'));
end; $$;
create function public.premium_fixture_stage(args jsonb)
returns jsonb language sql security invoker as $$
 select public.stage_premium_translation_working_draft(args->>'kind',args->>'identity',args->>'sourceHash',args->'source',args->'sourceRevision',
   args->'targetRevision',args->'payload',args->'provenance',null,0);
$$;
create function public.premium_fixture_promote(draft jsonb, catalog jsonb default null, confirm boolean default true)
returns jsonb language sql security invoker as $$
 select public.promote_premium_translation_working_draft(draft->>'entityType',draft->>'entityId',(draft->>'id')::uuid,
   (draft->>'version')::bigint,draft->>'candidateHash',draft->>'sourceHash',
   case when draft->>'entityType'='country' then draft#>>'{sourceRevision,catalogSourceHash}' else null end,catalog,confirm);
$$;
create function public.premium_fixture_discard(draft jsonb)
returns jsonb language sql security invoker as $$
 select public.discard_premium_translation_working_draft(draft->>'entityType',draft->>'entityId',(draft->>'id')::uuid,
   (draft->>'version')::bigint,draft->>'candidateHash');
$$;
grant select,insert,update,delete on public.premium_fixture_saved to authenticated;

-- Actual role ACL, including no actor and nonstaff actor, applies to every RPC.
do $$ declare fn regprocedure; begin
 perform public.premium_fixture_assert((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.premium_translation_working_drafts'::regclass),'private force RLS');
 perform public.premium_fixture_assert(not exists(select 1 from pg_trigger where tgrelid='public.premium_translation_working_drafts'::regclass and not tgisinternal),'no private triggers');
 perform public.premium_fixture_assert(not has_schema_privilege('authenticated','premium_translation_private','USAGE'),'private helper schema');
 for fn in select oid::regprocedure from pg_proc where proname in ('get_premium_translation_working_draft','stage_premium_translation_working_draft','promote_premium_translation_working_draft','discard_premium_translation_working_draft') loop
   perform public.premium_fixture_assert(not has_function_privilege('anon',fn,'EXECUTE') and has_function_privilege('authenticated',fn,'EXECUTE'),'RPC grants');
 end loop;
 set local role anon;
 perform public.premium_fixture_error('select * from public.premium_translation_working_drafts','42501');
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('country','fixture-country')$q$,'42501');
 reset role;
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','','true');
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('country','fixture-country')$q$,'42501');
 perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('country','fixture-country')$q$,'42501');
 perform public.premium_fixture_error($q$select public.stage_premium_translation_working_draft('country','fixture-country',null,null,null,null,null,null,null,0)$q$,'42501');
 perform public.premium_fixture_error($q$select public.promote_premium_translation_working_draft('country','fixture-country',null,1,null,null,null,null,true)$q$,'42501');
 perform public.premium_fixture_error($q$select public.discard_premium_translation_working_draft('country','fixture-country',null,1,null)$q$,'42501');
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform public.premium_fixture_error('select * from public.premium_translation_working_drafts','42501');
 perform public.premium_fixture_error('insert into public.premium_translation_working_drafts(entity_id) values(''forbidden'')','42501');
 perform public.premium_fixture_error('update public.premium_translation_working_drafts set version=2','42501');
 perform public.premium_fixture_error('delete from public.premium_translation_working_drafts','42501');
 perform public.premium_fixture_assert(public.get_premium_translation_working_draft('country','fixture-country')=
   '{"schemaVersion":1,"entityType":"country","entityId":"fixture-country","draft":null}'::jsonb,'explicit absent envelope');
end; $$;
select 'M07_T05_NATIVE_ACL_ACTOR_PASS';

-- Server refuses malformed JSON, forged snapshots and changed bibliography.
do $$ declare a jsonb; bad jsonb; begin
 a:=public.premium_fixture_args('literary_work','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 for bad in select value from jsonb_array_elements(jsonb_build_array(
   jsonb_set(a,'{payload,extra}','true'),jsonb_set(a,'{source,extra}','true'),jsonb_set(a,'{sourceRevision,extra}','true'),
   jsonb_set(a,'{targetRevision,updatedAt}','null'),jsonb_set(a,'{provenance,reviewedBy}','"forged"'),
   jsonb_set(a,'{provenance,provider}','null'),jsonb_set(a,'{provenance,generatedAt}','"2026-10-08"'),
   jsonb_set(a,'{payload,description}','"Too short."'),jsonb_set(a,'{payload,sourceUrls}','[1]'),
   jsonb_set(a,'{payload,description}',to_jsonb(rpad('A. B.',140,' '))),
   jsonb_set(a,'{payload,description}',to_jsonb(rpad('A. B.',140,chr(160)))),
   jsonb_set(a,'{sourceRevision,workUpdatedAt}','"2026-10-08T10:00:00"')
 )) loop perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',bad),'22023'); end loop;
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',jsonb_set(a,'{source,russianTitle}','"forged"')),'40001');
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',jsonb_set(a,'{payload,bibliographicTitle,provider}','"forged"')),'40001');
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',jsonb_set(a,'{payload,sourceUrls}','["https://fixture.test/title"]')),'40001');
 a:=public.premium_fixture_args('country','fixture-country');
 for bad in select value from jsonb_array_elements(jsonb_build_array(
   jsonb_set(a,'{payload,fields,extra}','true'),jsonb_set(a,'{payload,fields,facts}','[]'),
   jsonb_set(a,'{payload,fields,timeline,0,year}','"1901"'),jsonb_set(a,'{payload,fields,name}','"Страна"'),
   jsonb_set(a,'{payload,fields,name}',to_jsonb(E' \t\r\n'||chr(160)||chr(65279))),
   jsonb_set(a,'{payload,fields,timeline,0,extra}','true'),jsonb_set(a,'{sourceRevision,catalogSourceHash}','"bad"')
 )) loop perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',bad),'22023'); end loop;
end; $$;
select 'M07_T05_NATIVE_SHAPE_SOURCE_PASS';

do $$ declare a jsonb; bad jsonb; kind text; key text; begin
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 foreach kind in array array['literary_work','country'] loop
   a:=public.premium_fixture_args(kind,case when kind='country' then 'null-shape' else 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' end);
   foreach key in array array['source','sourceRevision','targetRevision','payload','provenance'] loop
     bad:=jsonb_set(a,array[key],'null'::jsonb);
     perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',bad),'22023');
     bad:=a-key;
     perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',bad),'22023');
   end loop;
 end loop;
end; $$;
select 'M07_T05_NATIVE_NULL_BOUNDARY_PASS';

insert into public.premium_fixture_saved values('before-work',(select to_jsonb(w) from public.literary_works w)),
 ('before-ru',(select to_jsonb(t) from public.literary_work_translations t where locale='ru')),
 ('before-en',(select to_jsonb(t) from public.literary_work_translations t where locale='en')),
 ('before-sources',(select jsonb_agg(to_jsonb(s) order by id) from public.literary_work_sources s));
truncate public.premium_fixture_outbox;
do $$ declare a jsonb; d jsonb; actual_hash text; begin
 a:=public.premium_fixture_args('literary_work','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 d:=public.premium_fixture_stage(a)->'draft';
 insert into public.premium_fixture_saved values('book-pending',d),('book-args',a);
 perform public.premium_fixture_assert(d->>'humanReview'='pending' and d->>'createdBy'='11111111-1111-4111-8111-111111111111','server actor pending');
 perform public.premium_fixture_assert(d->'sourceRevision'=a->'sourceRevision' and d->'targetRevision'=a->'targetRevision' and d->'payload'=a->'payload'
   and d->'provenance'=a->'provenance' and d->'sourceSnapshot'=a->'source','exact ACK full precision');
 perform public.premium_fixture_assert(public.get_premium_translation_working_draft('literary_work','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'draft'=d,'exact saved read');
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',a),'40001');
 perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb,null,false)',d),'22023');
 perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb,null,null)',d),'22023');
 perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb)',jsonb_set(d,'{candidateHash}',to_jsonb(repeat('f',64)))),'40001');
 perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb)',jsonb_set(d,'{sourceHash}',to_jsonb(repeat('f',64)))),'40001');
 perform public.premium_fixture_error(format('select public.premium_fixture_discard(%L::jsonb)',jsonb_set(d,'{version}','2')),'40001');
 reset role;
 select encode(sha256(convert_to(jsonb_build_object('entityType',d->'entityType','entityId',d->'entityId','targetLocale','en',
   'sourceHash',d->'sourceHash','sourceSnapshot',d->'sourceSnapshot','sourceRevision',d->'sourceRevision','targetRevision',d->'targetRevision',
   'payload',d->'payload','provenance',d->'provenance')::text,'UTF8')),'hex') into actual_hash;
 perform public.premium_fixture_assert(d->>'candidateHash'=actual_hash,'entire immutable candidate hash');
 perform public.premium_fixture_assert((select count(*)=0 from public.premium_fixture_outbox),'stage no canonical outbox');
 perform public.premium_fixture_assert((select to_jsonb(w)=(select value from public.premium_fixture_saved where name='before-work') from public.literary_works w),'stage complete work');
 perform public.premium_fixture_assert((select to_jsonb(t)=(select value from public.premium_fixture_saved where name='before-ru') from public.literary_work_translations t where locale='ru'),'stage complete RU');
 perform public.premium_fixture_assert((select to_jsonb(t)=(select value from public.premium_fixture_saved where name='before-en') from public.literary_work_translations t where locale='en'),'stage complete EN');
 set local role anon;
 perform public.premium_fixture_assert((select count(*)=1 from public.literary_work_translations where locale='en'),'existing admitted machine remains public');
end; $$;
select 'M07_T05_NATIVE_PRIVATE_PENDING_PASS';

-- Each stale-source/target test rolls the canonical mutation back in a nested
-- subtransaction after observing the actual RPC conflict, retaining one receipt.
do $$ declare d jsonb; field text; begin
 select value into d from public.premium_fixture_saved where name='book-pending';
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 foreach field in array array['work','ru','en','manual','title','title-source'] loop
   begin
     if field='work' then update public.literary_works set original_title='changed';
     elsif field='ru' then update public.literary_work_translations set description=description||' ' where locale='ru';
     elsif field='en' then update public.literary_work_translations set description=description||' ' where locale='en';
     elsif field='manual' then update public.literary_work_translations set translation_method='human-translation' where locale='en';
     elsif field='title' then update public.literary_work_translations set title='New verified title' where locale='en';
     else delete from public.literary_work_sources where provider='verified-bibliography'; end if;
     set local role authenticated;
     perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb)',d),'40001');
     reset role;
     raise exception using errcode='P0002',message='rollback test drift';
   exception when no_data_found then null; end;
 end loop;
 -- Manual target also prevents initial staging, independent of pending check.
 begin
   delete from public.premium_translation_working_drafts;
   update public.literary_work_translations set translation_method='human-translation' where locale='en';
   set local role authenticated;
   perform public.premium_fixture_error($q$select public.premium_fixture_stage(public.premium_fixture_args('literary_work','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))$q$,'40001');
   reset role;
   raise exception using errcode='P0002',message='rollback manual control';
 exception when no_data_found then null; end;
end; $$;
select 'M07_T05_NATIVE_BOOK_CAS_MANUAL_PASS';

do $$ declare d jsonb; receipt jsonb; before_en jsonb; begin
 select value into d from public.premium_fixture_saved where name='book-pending';
 select value into before_en from public.premium_fixture_saved where name='before-en';
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 receipt:=public.premium_fixture_promote(d);
 insert into public.premium_fixture_saved values('book-promoted',receipt);
 perform public.premium_fixture_assert(receipt->>'state'='promoted' and receipt->>'reviewedBy'='22222222-2222-4222-8222-222222222222','human actor receipt');
 perform public.premium_fixture_assert(public.get_premium_translation_working_draft('literary_work',d->>'entityId')->'draft'='null'::jsonb,'consumed exact book');
 perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb)',d),'40001');
 perform public.premium_fixture_error(format('select public.premium_fixture_discard(%L::jsonb)',d),'40001');
 reset role;
 perform public.premium_fixture_assert((select description=d#>>'{payload,description}' and title=before_en->>'title'
   and metadata->'authored'=before_en#>'{metadata,authored}' and metadata->'rights'=before_en#>'{metadata,rights}'
   and metadata#>>'{premiumTranslation,custom}'='retained' and editorial_status='reviewed'
   and metadata#>>'{premiumTranslation,humanReview,reviewedBy}'=receipt->>'reviewedBy'
   and metadata#>>'{premiumTranslation,humanReview,reviewedAt}'=receipt->>'reviewedAt'
   and metadata#>>'{premiumTranslation,translatorModel}'='fixture-translator'
   from public.literary_work_translations where locale='en'),'stored payload + preserved metadata + real human provenance');
 perform public.premium_fixture_assert((select to_jsonb(w)=(select value from public.premium_fixture_saved where name='before-work') from public.literary_works w),'promote work preserved');
 perform public.premium_fixture_assert((select to_jsonb(t)=(select value from public.premium_fixture_saved where name='before-ru') from public.literary_work_translations t where locale='ru'),'promote RU preserved');
 perform public.premium_fixture_assert((select jsonb_agg(to_jsonb(s) order by id)=(select value from public.premium_fixture_saved where name='before-sources') from public.literary_work_sources s),'sources rights preserved');
 perform public.premium_fixture_assert((select count(*)=1 from public.premium_fixture_outbox),'one canonical promotion');
end; $$;
select 'M07_T05_NATIVE_BOOK_PROMOTION_PASS';

-- Country absent override: no canonical insertion before approval. The trusted
-- current catalog includes other locales which must survive the new EN override.
truncate public.premium_fixture_outbox;
do $$ declare d jsonb; receipt jsonb; catalog jsonb := '{"name":"Страна","translations":{"ru":{"authored":"RU"},"fr":{"authored":"FR"}}}'; begin
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 d:=public.premium_fixture_stage(public.premium_fixture_args('country','fixture-country'))->'draft';
 insert into public.premium_fixture_saved values('country-pending',d);
 reset role;
 perform public.premium_fixture_assert((select count(*)=0 from public.country_profile_overrides),'pending country absent unchanged');
 perform public.premium_fixture_assert((select count(*)=0 from public.premium_fixture_outbox),'country pending no outbox');
 set local role authenticated;
 perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb,%L::jsonb)',d,'[]'),'22023');
 perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb,%L::jsonb)',d,'{"translations":"opaque authored data"}'),'22023');
 perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb,%L::jsonb)',jsonb_set(d,'{sourceRevision,catalogSourceHash}',to_jsonb(repeat('c',64))),catalog),'40001');
 perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb,%L::jsonb)',d,'{"translations":{"en":null}}'),'40001');
 receipt:=public.premium_fixture_promote(d,catalog);
 insert into public.premium_fixture_saved values('country-promoted',receipt);
 reset role;
 perform public.premium_fixture_assert((select fields#>'{translations,ru}'=catalog#>'{translations,ru}' and fields#>'{translations,fr}'=catalog#>'{translations,fr}'
   and fields#>>'{translations,en,status}'='reviewed' and fields#>>'{translations,en,method}'='machine-translation'
   and fields#>>'{translations,en,humanReview,reviewedBy}'=receipt->>'reviewedBy'
   and not (fields#>'{translations,en,fields}')?'history' and not (fields#>'{translations,en,fields}')?'chronology'
   from public.country_profile_overrides where country_id='fixture-country'),'catalog locales + compact fields + human review');
 perform public.premium_fixture_assert((select count(*)=1 from public.premium_fixture_outbox),'one new country approval');
end; $$;
select 'M07_T05_NATIVE_COUNTRY_CATALOG_PASS';

insert into public.country_profile_overrides(country_id,fields,is_enabled,updated_by) values
 ('own-machine','{"name":"Авторская страна","coordinates":[10,20],"rights":{"source":"retain"},"translations":{"fr":{"human":"FR"},"en":{"locale":"en","method":"machine-translation","status":"reviewed","custom":"retain"}}}',false,'11111111-1111-4111-8111-111111111111'),
 ('hidden-human','{"translations":{"fr":{"human":"FR"}}}',true,'11111111-1111-4111-8111-111111111111'),
 ('own-human','{"translations":{"en":{"locale":"en","method":"human-translation","fields":{"name":"Human country"}}}}',true,'11111111-1111-4111-8111-111111111111');
insert into public.premium_fixture_saved values('country-before',(select to_jsonb(c) from public.country_profile_overrides c where country_id='own-machine'));
truncate public.premium_fixture_outbox;
do $$ declare d jsonb; receipt jsonb; before_country jsonb; field text; catalog jsonb := '{"translations":{"en":{"locale":"en","method":"human-translation"},"de":{"keep":"base"}}}'; begin
 select value into before_country from public.premium_fixture_saved where name='country-before';
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 perform public.premium_fixture_error($q$select public.premium_fixture_stage(public.premium_fixture_args('country','own-human'))$q$,'40001');
 d:=public.premium_fixture_stage(public.premium_fixture_args('country','hidden-human'))->'draft';
 perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb,%L::jsonb)',d,catalog),'40001');
 perform public.premium_fixture_discard(d);
 d:=public.premium_fixture_stage(public.premium_fixture_args('country','own-machine'))->'draft';
 reset role;
 perform public.premium_fixture_assert((select to_jsonb(c)=before_country from public.country_profile_overrides c where country_id='own-machine'),'whole override unchanged while pending');
 foreach field in array array['source','manual','delete'] loop
   begin
     if field='source' then update public.country_profile_overrides set fields=fields||'{"name":"changed"}' where country_id='own-machine';
     elsif field='manual' then update public.country_profile_overrides set fields=jsonb_set(fields,'{translations,en,method}','"human-translation"') where country_id='own-machine';
     else delete from public.country_profile_overrides where country_id='own-machine'; end if;
     set local role authenticated;
     perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb,%L::jsonb)',d,catalog),'40001');
     reset role;
     raise exception using errcode='P0002',message='rollback country drift';
   exception when no_data_found then null; end;
 end loop;
 set local role authenticated;
 receipt:=public.premium_fixture_promote(d,catalog);
 perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb,%L::jsonb)',d,catalog),'40001');
 reset role;
 perform public.premium_fixture_assert((select not is_enabled and fields-'translations'=(before_country->'fields')-'translations'
   and fields#>'{translations,fr}'=before_country#>'{fields,translations,fr}' and not (fields->'translations')?'de'
   and fields#>>'{translations,en,custom}'='retain' and fields#>>'{translations,en,reviewedBy}'=receipt->>'reviewedBy'
   from public.country_profile_overrides where country_id='own-machine'),'own machine precedence preserves override map flags rights');
 perform public.premium_fixture_assert((select count(*)=1 from public.premium_fixture_outbox),'country canonical writes only approval');
end; $$;
select 'M07_T05_NATIVE_COUNTRY_CAS_MANUAL_PASS';

-- Lost stage ACK is recoverable through exact get; stale candidate can be
-- discarded even after a manual winner, but wrong version/hash cannot consume.
truncate public.premium_fixture_outbox;
do $$ declare d jsonb; later jsonb; before_country jsonb; begin
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform public.premium_fixture_stage(public.premium_fixture_args('country','late-override'));
 d:=public.get_premium_translation_working_draft('country','late-override')->'draft';
 reset role;
 insert into public.country_profile_overrides(country_id,fields) values('late-override','{"translations":{"en":{"locale":"en","method":"human-translation","fields":{"name":"Manual winner"}}}}');
 select to_jsonb(c) into before_country from public.country_profile_overrides c where country_id='late-override';
 truncate public.premium_fixture_outbox;
 set local role authenticated;
 perform public.premium_fixture_error(format('select public.premium_fixture_promote(%L::jsonb,''{}''::jsonb)',d),'40001');
 perform public.premium_fixture_error(format('select public.premium_fixture_discard(%L::jsonb)',jsonb_set(d,'{candidateHash}',to_jsonb(repeat('f',64)))),'40001');
 perform public.premium_fixture_assert(public.get_premium_translation_working_draft('country','late-override')->'draft'=d,'stale still inspectable');
 perform public.premium_fixture_assert(public.premium_fixture_discard(d)->>'state'='discarded','exact stale discard');
 perform public.premium_fixture_error(format('select public.premium_fixture_discard(%L::jsonb)',d),'40001');
 reset role;
 perform public.premium_fixture_assert((select to_jsonb(c)=before_country from public.country_profile_overrides c where country_id='late-override'),'discard preserves manual winner');
 perform public.premium_fixture_assert((select count(*)=0 from public.premium_fixture_outbox),'discard no canonical outbox');
 set local role authenticated;
 d:=public.premium_fixture_stage(public.premium_fixture_args('country','restage'))->'draft';
 perform public.premium_fixture_discard(d);
 later:=public.premium_fixture_stage(public.premium_fixture_args('country','restage'))->'draft';
 perform public.premium_fixture_assert(later->>'id'<>d->>'id','restage fresh identity');
 perform public.premium_fixture_error(format('select public.premium_fixture_discard(%L::jsonb)',d),'40001');
 perform public.premium_fixture_discard(later);
end; $$;
select 'M07_T05_NATIVE_DISCARD_REPLAY_PASS';

do $$ begin
 perform public.premium_fixture_assert((select count(*)=0 from public.premium_translation_working_drafts),'all candidates consumed explicitly');
 perform public.premium_fixture_assert(not exists(select 1 from public.admin_audit_log where action like 'premium_translation.candidate.%'
   and (metadata-array['draftId','version','candidateHash','sourceHash','canonicalId','outcome'])<>'{}'::jsonb),'audit only IDs hashes outcomes');
 perform public.premium_fixture_assert((select count(*)>5 from public.admin_audit_log where action like 'premium_translation.candidate.%'),'durable audit outcomes');
 perform public.premium_fixture_assert(not exists(select 1 from public.admin_audit_log where action like 'premium_translation.candidate.%' and
   metadata::text like '%astronomers%'),'no candidate prose in audit');
end; $$;
select 'M07_T05_NATIVE_AUDIT_FINAL_PASS';
select 'M07_T05_DTO='||jsonb_object_agg(name,value)::text from public.premium_fixture_saved
 where name in ('book-pending','country-pending','book-promoted','country-promoted','book-args');
select 'M07_T05_SUMMARY='||jsonb_build_object('groups',10,'providerCalls',0,'canonicalStagingWrites',0,
 'pendingNeverOverwritten',true,'explicitReviewActor',true,'protectedManualAndAdmittedMachine',true,
 'countryCatalogBoundary','trusted application reload; SQL override CAS and ownership','allCandidatesConsumed',true)::text;
