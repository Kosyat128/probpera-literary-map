-- Additive native PostgreSQL fixture. Run after the unchanged book/country
-- fixture, actual writer table/revision prefix, and both private migrations.
-- Auth/staff and outbox capture are synthetic local boundaries, not managed E2E.
reset role;
create trigger premium_fixture_writer_outbox after insert or update on public.writer_profile_overrides
  for each row execute function public.premium_fixture_capture();

create function public.writer_private_fixture_catalog()
returns jsonb language sql immutable as $$
select '{"fullName":"  Иван Автор  ","name":"Автор","rights":{"owner":"author","permission":"unchanged"},
 "biographyTranslations":{"ru":{"locale":"ru","text":"  Иван Автор родился в 1900 году и работал в Архиве. Он создал роман в 1930 году, преподавал литературу и подготовил исследование сохранившихся рукописей.  ",
 "sourceLanguage":" Russian ","status":"reviewed","method":"editorial-original","reviewedAt":"2026-10-01","reviewer":"Human RU editor",
 "sourceTextRights":"project-original","rights":{"license":"RAW RU RIGHTS"},"custom":{"nested":[null,true,"RAW RU VALUE"]},
 "sources":[{"provider":" Archive ","url":"https://fixture.test/writer","fields":["biography-facts"],"usage":"fact-check","retrievedAt":"2026-10-01",
   "author":"Original researcher","title":"Raw archive title","licenseName":"Permission","licenseUrl":"https://fixture.test/permission",
   "customRights":{"permissionId":"RAW-SOURCE-RIGHTS","conditions":["full-credit"]}}]},
 "en":{"locale":"en","text":"Previously admitted machine English remains visible while a private candidate awaits explicit human review. This existing biography and its metadata must remain untouched during staging.",
 "sourceLanguage":"Russian","status":"reviewed","method":"machine-translation","reviewedAt":"2026-10-02","sourceTextRights":"project-original",
 "customEnglish":{"editor":"EN AUTHOR METADATA"},"rights":{"credit":"KEEP EN RIGHTS"},
 "sources":[{"url":"https://fixture.test/previous-source","custom":"previous provenance"}],
 "translationMeta":{"customMachine":{"preserve":"EN META"},"generatedAt":"2026-10-01T01:00:00Z"}},
 "fr":{"locale":"fr","text":"Texte original conservé","rights":"OTHER LOCALE RIGHTS"}}}'::jsonb;
$$;

create function public.writer_private_fixture_args(identity text, catalog jsonb default public.writer_private_fixture_catalog(), replacement boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare writer public.writer_profile_overrides%rowtype; effective jsonb; russian jsonb; source jsonb;
begin
 select * into writer from public.writer_profile_overrides where country_id=split_part(identity,':',1) and writer_id=split_part(identity,':',2);
 effective:=catalog||coalesce(writer.fields,'{}'::jsonb); russian:=effective#>'{biographyTranslations,ru}';
 source:=jsonb_build_object('writerName',coalesce(nullif(btrim(effective->>'fullName'),''),nullif(btrim(effective->>'name'),''),split_part(identity,':',2)),
   'text',btrim(russian->>'text'),'sourceLanguage',btrim(russian->>'sourceLanguage'),
   'sources','[{"provider":"Archive","url":"https://fixture.test/writer","fields":["biography-facts"],"usage":"fact-check","retrievedAt":"2026-10-01","author":"Original researcher","title":"Raw archive title","licenseName":"Permission","licenseUrl":"https://fixture.test/permission"}]'::jsonb,
   'russianProfile',russian,'catalogFields',catalog);
 return jsonb_build_object('kind','writer_biography','identity',identity,'sourceHash',repeat('a',64),'source',source,
   'sourceRevision',jsonb_build_object('countryId',split_part(identity,':',1),'writerId',split_part(identity,':',2),
     'overrideId',writer.id,'overrideUpdatedAt',writer.updated_at,'catalogSourceHash',repeat('b',64),'replaceEnglishTombstone',replacement),
   'targetRevision',jsonb_build_object('id',writer.id,'updatedAt',writer.updated_at),
   'payload',jsonb_build_object('text','Ivan Author was born in 1900 and worked at the Archive, where he studied surviving manuscripts. He wrote a novel in 1930 and also taught literature during his scholarly career.'),
   'provenance',jsonb_build_object('provider','cloudflare','translatorModel','fixture-translator','reviewerModel','fixture-reviewer',
     'translatorRequestId','writer-request','reviewerRequestId',null,'generatedAt','2026-10-01T01:00:00.123456Z'));
end;
$$;
create function public.writer_private_fixture_promote(draft jsonb, catalog jsonb default public.writer_private_fixture_catalog(), confirm boolean default true)
returns jsonb language sql security invoker as $$
 select public.promote_premium_translation_working_draft(draft->>'entityType',draft->>'entityId',(draft->>'id')::uuid,
   (draft->>'version')::bigint,draft->>'candidateHash',draft->>'sourceHash',draft#>>'{sourceRevision,catalogSourceHash}',catalog,confirm);
$$;

-- No new public API/grants, helper schema access, direct DML, or trigger leak.
do $$ declare fn regprocedure; begin
 perform public.premium_fixture_assert((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.premium_translation_working_drafts'::regclass),'writer private force RLS');
 perform public.premium_fixture_assert(not exists(select 1 from pg_trigger where tgrelid='public.premium_translation_working_drafts'::regclass and not tgisinternal),'writer stage has no publication trigger');
 for fn in select oid::regprocedure from pg_proc where pronamespace='premium_translation_private'::regnamespace loop
   perform public.premium_fixture_assert(not has_function_privilege('anon',fn,'EXECUTE') and not has_function_privilege('authenticated',fn,'EXECUTE'),'writer helpers private');
 end loop;
 set local role anon;
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('writer_biography','fixture-country:writer-one')$q$,'42501');
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','','true');
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('writer_biography','fixture-country:writer-one')$q$,'42501');
 perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('writer_biography','fixture-country:writer-one')$q$,'42501');
 perform public.premium_fixture_error($q$select public.premium_fixture_stage(public.writer_private_fixture_args('fixture-country:writer-one'))$q$,'42501');
 perform public.premium_fixture_error($q$select public.promote_premium_translation_working_draft('writer_biography','fixture-country:writer-one',null,1,null,null,null,'{}',true)$q$,'42501');
 perform public.premium_fixture_error($q$select public.discard_premium_translation_working_draft('writer_biography','fixture-country:writer-one',null,1,null)$q$,'42501');
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform public.premium_fixture_error('select * from public.premium_translation_working_drafts','42501');
 perform public.premium_fixture_error($q$insert into public.premium_translation_working_drafts(entity_id) values('writer-direct')$q$,'42501');
 perform public.premium_fixture_error('update public.premium_translation_working_drafts set version=2','42501');
 perform public.premium_fixture_error('delete from public.premium_translation_working_drafts','42501');
end; $$;
select 'M07_WRITER_NATIVE_ACL_PASS';

-- The public/canonical row and revision/outbox graph do not change on stage.
insert into public.writer_profile_overrides(id,country_id,writer_id,fields,is_enabled,updated_at)
 values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','fixture-country','writer-one',public.writer_private_fixture_catalog()||'{"authoredOverride":{"keep":"ALL FIELDS"}}',false,'2026-10-09T10:00:00.123456Z');
do $$ declare a jsonb; d jsonb; staged jsonb; read_receipt jsonb; before_row jsonb; revision_count bigint; receipt jsonb; after_row jsonb; begin
 select to_jsonb(w) into before_row from public.writer_profile_overrides w where writer_id='writer-one';
 select count(*) into revision_count from public.writer_profile_override_revisions;
 truncate public.premium_fixture_outbox;
 a:=public.writer_private_fixture_args('fixture-country:writer-one');
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 staged:=public.premium_fixture_stage(a); d:=staged->'draft';
 read_receipt:=public.get_premium_translation_working_draft('writer_biography','fixture-country:writer-one');
 perform public.premium_fixture_assert(d->>'humanReview'='pending','writer pending review');
 perform public.premium_fixture_assert(public.get_premium_translation_working_draft('writer_biography','fixture-country:writer-one')->'draft'=d,'writer retained exact draft');
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',a),'40001');
 perform public.premium_fixture_error(format('select public.writer_private_fixture_promote(%L::jsonb,public.writer_private_fixture_catalog(),false)',d),'22023');
 reset role;
 perform public.premium_fixture_assert((select to_jsonb(w)=before_row from public.writer_profile_overrides w where writer_id='writer-one'),'stage preserves full disabled canonical row');
 perform public.premium_fixture_assert((select count(*)=revision_count from public.writer_profile_override_revisions),'stage no canonical revision');
 perform public.premium_fixture_assert((select count(*)=0 from public.premium_fixture_outbox),'stage no publication outbox');
 insert into public.premium_fixture_saved values('writer-pending',d),('writer-args',a),('writer-stage',staged),('writer-read',read_receipt);
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 set local timezone='Pacific/Kiritimati';
 receipt:=public.writer_private_fixture_promote(d);
 reset role;
 select to_jsonb(w) into after_row from public.writer_profile_overrides w where writer_id='writer-one';
 perform public.premium_fixture_assert(after_row->'is_enabled'='false'::jsonb,'promotion retains disabled flag');
 perform public.premium_fixture_assert(after_row#>'{fields,biographyTranslations,ru}'=before_row#>'{fields,biographyTranslations,ru}','raw RU including spaces and rights retained');
 perform public.premium_fixture_assert(after_row#>'{fields,biographyTranslations,fr}'=before_row#>'{fields,biographyTranslations,fr}','other locale retained');
 perform public.premium_fixture_assert(((after_row->'fields')-'biographyTranslations')=((before_row->'fields')-'biographyTranslations'),'unrelated override fields retained');
 perform public.premium_fixture_assert(after_row#>'{fields,biographyTranslations,en,sources}'=before_row#>'{fields,biographyTranslations,ru,sources}','raw source rights inherited without projection');
 perform public.premium_fixture_assert(after_row#>'{fields,biographyTranslations,en,rights}'=before_row#>'{fields,biographyTranslations,en,rights}','EN rights retained');
 perform public.premium_fixture_assert(after_row#>'{fields,biographyTranslations,en,customEnglish}'=before_row#>'{fields,biographyTranslations,en,customEnglish}','EN unknown metadata retained');
 perform public.premium_fixture_assert(after_row#>'{fields,biographyTranslations,en,translationMeta,customMachine}'=before_row#>'{fields,biographyTranslations,en,translationMeta,customMachine}','machine unknown metadata retained');
 perform public.premium_fixture_assert(after_row#>>'{fields,biographyTranslations,en,text}'=a#>>'{payload,text}','exact candidate text promoted');
 perform public.premium_fixture_assert(after_row#>>'{fields,biographyTranslations,en,reviewedAt}'=to_char((receipt->>'reviewedAt')::timestamptz at time zone 'UTC','YYYY-MM-DD'),'human review date UTC');
 perform public.premium_fixture_assert(after_row#>>'{fields,biographyTranslations,en,translationMeta,humanReview,reviewedBy}'='22222222-2222-4222-8222-222222222222','reviewer is current human actor');
 perform public.premium_fixture_assert((select count(*)=revision_count+1 from public.writer_profile_override_revisions),'one promotion revision');
 perform public.premium_fixture_assert((select count(*)=1 from public.premium_fixture_outbox),'one promotion outbox');
 perform public.premium_fixture_assert(not exists(select 1 from public.premium_translation_working_drafts where id=(d->>'id')::uuid),'promotion consumes private candidate');
 insert into public.premium_fixture_saved values('writer-promoted',receipt),('writer-after',after_row);
end; $$;
select 'M07_WRITER_NATIVE_STAGE_PROMOTE_PRESERVATION_PASS';

-- Malformed source/payload/reviewer and mismatched writer/source/target identity.
do $$ declare a jsonb; bad jsonb; begin
 a:=public.writer_private_fixture_args('fixture-country:writer-one');
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 bad:=jsonb_set(a,'{provenance,reviewerModel}','null');
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',bad),'22023');
 bad:=jsonb_set(a,'{payload,text}','"Too short"');
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',bad),'22023');
 bad:=jsonb_set(a,'{source,sources,0,licenseName}','"Forged permission"');
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',bad),'22023');
 bad:=jsonb_set(a,'{source,russianProfile,rights,license}','"Forged raw rights"');
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',bad),'40001');
 bad:=jsonb_set(a,'{sourceRevision,writerId}','"writer-other"');
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',bad),'40001');
 bad:=jsonb_set(a,'{targetRevision,id}','"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"');
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',bad),'40001');
 bad:=jsonb_set(a,'{sourceRevision,replaceEnglishTombstone}','"true"');
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',bad),'22023');
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('writer_biography','fixture-country:writer:other')$q$,'22023');
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('writer_biography','fixture-country:writer/other')$q$,'22023');
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('writer_biography','fixture-country:writer other')$q$,'22023');
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('country',repeat('a',121))$q$,'22023');
end; $$;
select 'M07_WRITER_NATIVE_SHAPE_IDENTITY_PASS';

-- Authored/ambiguous EN and parent-map tombstones must not be overwritten.
do $$ declare catalog jsonb; a jsonb; d jsonb; value jsonb; before_row jsonb; begin
 catalog:=public.writer_private_fixture_catalog();
 foreach value in array array['"human-translation"'::jsonb,'"editorial-original"'::jsonb,'"licensed-source"'::jsonb,'null'::jsonb] loop
   a:=public.writer_private_fixture_args('fixture-country:manual-catalog',jsonb_set(catalog,'{biographyTranslations,en,method}',value));
   set local role authenticated;
   perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
   perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',a),'40001');
   reset role;
 end loop;
 a:=public.writer_private_fixture_args('fixture-country:null-catalog',jsonb_set(catalog,'{biographyTranslations,en}','null'));
 set local role authenticated;
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',a),'40001');
 reset role;
 foreach value in array array['null'::jsonb,'"legacy metadata"'::jsonb,'[]'::jsonb] loop
   a:=public.writer_private_fixture_args('fixture-country:ambiguous-metadata',jsonb_set(catalog,'{biographyTranslations,en,translationMeta}',value));
   set local role authenticated;
   perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',a),'40001');
   reset role;
 end loop;
 insert into public.writer_profile_overrides(country_id,writer_id,fields)
   values('fixture-country','tombstone',jsonb_build_object('biographyTranslations',jsonb_build_object('ru',catalog#>'{biographyTranslations,ru}')));
 a:=public.writer_private_fixture_args('fixture-country:tombstone');
 set local role authenticated;
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',a),'40001');
 reset role;
 update public.writer_profile_overrides set fields=jsonb_set(fields,'{biographyTranslations,en}','null') where writer_id='tombstone';
 a:=public.writer_private_fixture_args('fixture-country:tombstone');
 set local role authenticated;
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',a),'40001');
 reset role;
 select to_jsonb(w) into before_row from public.writer_profile_overrides w where writer_id='tombstone';
 a:=public.writer_private_fixture_args('fixture-country:tombstone',catalog,true);
 set local role authenticated;
 d:=public.premium_fixture_stage(a)->'draft';
 perform public.premium_fixture_discard(d);
 reset role;
 perform public.premium_fixture_assert((select to_jsonb(w)=before_row from public.writer_profile_overrides w where writer_id='tombstone'),'explicit replacement staging/discard retains tombstone');
 set local role authenticated;
 d:=public.premium_fixture_stage(a)->'draft';
 perform public.writer_private_fixture_promote(d);
 reset role;
 perform public.premium_fixture_assert((select fields#>'{biographyTranslations,ru}'=before_row#>'{fields,biographyTranslations,ru}' from public.writer_profile_overrides where writer_id='tombstone'),'replacement retains raw authored RU');
 update public.writer_profile_overrides set fields=jsonb_set(fields,'{biographyTranslations,en,method}','"human-translation"') where writer_id='tombstone';
 a:=public.writer_private_fixture_args('fixture-country:tombstone',catalog,true);
 set local role authenticated;
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',a),'40001');
 reset role;
 foreach value in array array['{}'::jsonb,'null'::jsonb] loop
   update public.writer_profile_overrides set fields=jsonb_build_object('biographyTranslations',value) where writer_id='tombstone';
   a:=public.writer_private_fixture_args('fixture-country:tombstone',catalog,true);
   set local role authenticated;
   perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',a),'22023');
   reset role;
 end loop;
end; $$;
select 'M07_WRITER_NATIVE_OWNERSHIP_TOMBSTONES_PASS';

-- Exact microsecond CAS, takeover, disappearance, raw source change, catalog
-- change and absent-to-present target all refuse promotion; discard still works.
do $$ declare a jsonb; d jsonb; changed jsonb; case_name text; before_row jsonb; begin
 foreach case_name in array array['microsecond','manual','source','deleted','catalog','absent'] loop
   if case_name<>'absent' then
     insert into public.writer_profile_overrides(country_id,writer_id,fields,updated_at)
       values('fixture-country','stale-'||case_name,public.writer_private_fixture_catalog(),'2026-10-09T10:00:00.123456Z');
   end if;
   a:=public.writer_private_fixture_args('fixture-country:stale-'||case_name);
   set local role authenticated;
   perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
   d:=public.premium_fixture_stage(a)->'draft';
   reset role;
   if case_name='microsecond' then
     alter table public.writer_profile_overrides disable trigger writer_profile_overrides_set_updated_at;
     update public.writer_profile_overrides set updated_at=updated_at+interval '1 microsecond' where writer_id='stale-'||case_name;
     alter table public.writer_profile_overrides enable trigger writer_profile_overrides_set_updated_at;
   elsif case_name='manual' then
     update public.writer_profile_overrides set fields=jsonb_set(fields,'{biographyTranslations,en,method}','"human-translation"') where writer_id='stale-'||case_name;
   elsif case_name='source' then
     -- Keep the timestamp fixed to prove full raw source equality is independent.
     alter table public.writer_profile_overrides disable trigger writer_profile_overrides_set_updated_at;
     update public.writer_profile_overrides set fields=jsonb_set(fields,'{biographyTranslations,ru,rights,license}','"changed raw source rights"') where writer_id='stale-'||case_name;
     alter table public.writer_profile_overrides enable trigger writer_profile_overrides_set_updated_at;
   elsif case_name='deleted' then
     delete from public.writer_profile_overrides where writer_id='stale-'||case_name;
   elsif case_name='absent' then
     insert into public.writer_profile_overrides(country_id,writer_id,fields) values('fixture-country','stale-absent',public.writer_private_fixture_catalog());
   end if;
   select to_jsonb(w) into before_row from public.writer_profile_overrides w where writer_id='stale-'||case_name;
   truncate public.premium_fixture_outbox;
   changed:=case when case_name='catalog' then jsonb_set(public.writer_private_fixture_catalog(),'{rights,permission}','"changed catalog rights"') else public.writer_private_fixture_catalog() end;
   set local role authenticated;
   perform public.premium_fixture_error(format('select public.writer_private_fixture_promote(%L::jsonb,%L::jsonb)',d,changed),'40001');
   perform public.premium_fixture_assert(public.get_premium_translation_working_draft('writer_biography','fixture-country:stale-'||case_name)->'draft'=d,'stale candidate retained');
   perform public.premium_fixture_assert(public.premium_fixture_discard(d)->>'state'='discarded','stale candidate discard');
   reset role;
   perform public.premium_fixture_assert((select to_jsonb(w) from public.writer_profile_overrides w where writer_id='stale-'||case_name) is not distinct from before_row,'stale discard preserves source winner');
   perform public.premium_fixture_assert((select count(*)=0 from public.premium_fixture_outbox),'stale failure/discard no outbox');
 end loop;
end; $$;
select 'M07_WRITER_NATIVE_STALE_DISCARD_PASS';

-- Long Unicode identifiers, cross-country selection and new override creation.
do $$ declare identity text; a jsonb; d jsonb; wrong jsonb; receipt jsonb; begin
 identity:=repeat('a',120)||':'||repeat(chr(128512),180);
 a:=public.writer_private_fixture_args(identity);
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 d:=public.premium_fixture_stage(a)->'draft';
 perform public.premium_fixture_assert(d->>'entityId'=identity,'301-codepoint writer identity accepted');
 receipt:=public.premium_fixture_discard(d);
 reset role;
 insert into public.premium_fixture_saved values('writer-long-pending',d),('writer-long-args',a),('writer-discarded',receipt);
 set local role authenticated;
 a:=public.writer_private_fixture_args('fixture-country:new-writer');
 d:=public.premium_fixture_stage(a)->'draft';
 wrong:=jsonb_set(d,'{entityId}','"other-country:new-writer"');
 perform public.premium_fixture_error(format('select public.writer_private_fixture_promote(%L::jsonb)',wrong),'40001');
 perform public.premium_fixture_error(format('select public.premium_fixture_discard(%L::jsonb)',wrong),'40001');
 perform public.premium_fixture_error(format('select public.premium_fixture_discard(%L::jsonb)',jsonb_set(d,'{candidateHash}',to_jsonb(repeat('f',64)))),'40001');
 perform public.premium_fixture_error(format('select public.premium_fixture_discard(%L::jsonb)',jsonb_set(d,'{version}','2')),'40001');
 receipt:=public.writer_private_fixture_promote(d);
 perform public.premium_fixture_error(format('select public.writer_private_fixture_promote(%L::jsonb)',d),'40001');
 receipt:=public.get_premium_translation_working_draft('writer_biography','fixture-country:new-writer');
 reset role;
 perform public.premium_fixture_assert((select fields#>'{biographyTranslations,ru}'=public.writer_private_fixture_catalog()#>'{biographyTranslations,ru}' from public.writer_profile_overrides where writer_id='new-writer'),'new override retains raw catalog RU');
 perform public.premium_fixture_assert((select fields#>'{biographyTranslations,fr}'=public.writer_private_fixture_catalog()#>'{biographyTranslations,fr}' from public.writer_profile_overrides where writer_id='new-writer'),'new override retains other catalog locales');
 insert into public.premium_fixture_saved values('writer-absent',receipt);
end; $$;
select 'M07_WRITER_NATIVE_IDENTITY_NEW_OVERRIDE_PASS';

create function public.writer_private_fixture_fail_update() returns trigger language plpgsql as $$
begin raise exception using errcode='23514',message='Synthetic canonical writer failure'; end; $$;
create trigger writer_fixture_failure before update on public.writer_profile_overrides
  for each row when (old.writer_id='rollback-writer') execute function public.writer_private_fixture_fail_update();
insert into public.writer_profile_overrides(country_id,writer_id,fields) values('fixture-country','rollback-writer',public.writer_private_fixture_catalog());
do $$ declare d jsonb; before_row jsonb; audit_count bigint; begin
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 d:=public.premium_fixture_stage(public.writer_private_fixture_args('fixture-country:rollback-writer'))->'draft';
 reset role;
 select to_jsonb(w) into before_row from public.writer_profile_overrides w where writer_id='rollback-writer';
 select count(*) into audit_count from public.admin_audit_log;
 truncate public.premium_fixture_outbox;
 set local role authenticated;
 perform public.premium_fixture_error(format('select public.writer_private_fixture_promote(%L::jsonb)',d),'23514');
 perform public.premium_fixture_assert(public.get_premium_translation_working_draft('writer_biography','fixture-country:rollback-writer')->'draft'=d,'failed promotion retains candidate');
 reset role;
 perform public.premium_fixture_assert((select to_jsonb(w)=before_row from public.writer_profile_overrides w where writer_id='rollback-writer'),'failed promotion retains canonical bytes');
 perform public.premium_fixture_assert((select count(*)=audit_count from public.admin_audit_log),'failed promotion no audit receipt');
 perform public.premium_fixture_assert((select count(*)=0 from public.premium_fixture_outbox),'failed promotion no outbox');
 set local role authenticated;
 perform public.premium_fixture_discard(d);
end; $$;
select 'M07_WRITER_NATIVE_ROLLBACK_PASS';

do $$ begin
 perform public.premium_fixture_assert((select count(*)=0 from public.premium_translation_working_drafts),'all writer candidates consumed explicitly');
 perform public.premium_fixture_assert(not exists(select 1 from public.admin_audit_log where action like 'premium_translation.candidate.%'
   and (metadata-array['draftId','version','candidateHash','sourceHash','canonicalId','outcome'])<>'{}'::jsonb),'writer audit only identities hashes outcomes');
end; $$;
select 'M07_WRITER_DTO='||jsonb_object_agg(name,value)::text from public.premium_fixture_saved where name like 'writer-%';
select 'M07_WRITER_SUMMARY='||jsonb_build_object('groups',7,'providerCalls',0,'canonicalStagingWrites',0,'rawSourceRightsPreserved',true,
 'catalogBoundary','trusted application reload, exact hash and raw fields comparison','managedAuthPostgrestVerified',false)::text;
