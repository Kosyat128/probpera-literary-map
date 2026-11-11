-- Synthetic data only. Run after the unchanged book/country/writer fixtures,
-- actual homepage definitions/guards and the additive Site Copy migration.
create trigger premium_fixture_site_copy_outbox after update on public.homepage_blocks
  for each row execute function public.premium_fixture_capture();

insert into public.media_assets(id,object_path,original_name,mime_type,byte_size,uploaded_by)
values('99999999-9999-4999-8999-999999999999','fixture/site-copy.png','site-copy.png','image/png',1,'11111111-1111-4111-8111-111111111111');

create function public.site_copy_fixture_settings()
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('systemKey','site-copy-overrides','siteCopy',jsonb_build_object(
   'ru',jsonb_build_object('intro',E'  Исходный \u2014 текст\r\nс новой строкой  ','cta','Открыть карту','manual','Ручной русский'),
   'en',jsonb_build_object('intro','Existing machine copy','manual','Keep authored English','unrelated',jsonb_build_object('raw',true)),
   'fr',jsonb_build_object('intro','  Français intact  ','rights',jsonb_build_array('éditeur',null)),
   'localeExtension',jsonb_build_object('preserve',true)),
   'premiumTranslation',jsonb_build_object('siteCopyEn',jsonb_build_object(
     'intro',jsonb_build_object('sourceHash',repeat('a',64),'customMachine',jsonb_build_object('rights','keep')),
     'unselected',jsonb_build_object('raw','preserved')),'customPremium',jsonb_build_array('keep',null)),
   'unknownSettings',jsonb_build_object('empty',jsonb_build_array(),'rights',jsonb_build_object('owner','editor')))
$$;

insert into public.homepage_blocks(id,block_type,title,settings,display_order,is_enabled,background_style,background_media_id,updated_by,updated_at)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','text','Authored title',public.site_copy_fixture_settings(),-17,false,'paper',
 '99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','2026-10-29T10:00:00.123456Z');

create function public.site_copy_fixture_args()
returns jsonb language plpgsql security definer set search_path='' as $$
declare block public.homepage_blocks%rowtype;
begin
 select * into block from public.homepage_blocks where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 return jsonb_build_object('kind','site_copy','identity',block.id,'sourceHash',repeat('b',64),
   'source',jsonb_build_object('settings',block.settings,'items',jsonb_build_array(
     jsonb_build_object('key','intro','text',E'Исходный \u2014 текст\nс новой строкой','sourceHash',repeat('c',64)),
     jsonb_build_object('key','cta','text','Открыть карту','sourceHash',repeat('d',64)))),
   'sourceRevision',jsonb_build_object('blockId',block.id,'blockUpdatedAt',block.updated_at),
   'targetRevision',jsonb_build_object('id',block.id,'updatedAt',block.updated_at),
   'payload',jsonb_build_object('items',jsonb_build_array(
     jsonb_build_object('key','intro','text','Separate English copy awaiting explicit human review.'),
     jsonb_build_object('key','cta','text','Open the map'))),
   'provenance',jsonb_build_object('provider','openai','translatorModel','controlled-translator','reviewerModel',null,
     'translatorRequestId','controlled-translation','reviewerRequestId',null,'generatedAt','2026-10-29T10:00:01.123456Z'));
end;
$$;
create function public.site_copy_fixture_promote(draft jsonb, confirm_review boolean default true)
returns jsonb language sql security invoker set search_path='' as $$
 select public.promote_premium_translation_working_draft(draft->>'entityType',draft->>'entityId',(draft->>'id')::uuid,
   (draft->>'version')::bigint,draft->>'candidateHash',draft->>'sourceHash',null,null,confirm_review);
$$;

do $$ declare fn record; begin
 perform public.premium_fixture_assert((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.premium_translation_working_drafts'::regclass),'Site Copy private force RLS');
 for fn in select oid::regprocedure as signature from pg_proc where proname in
   ('get_premium_translation_working_draft','stage_premium_translation_working_draft','promote_premium_translation_working_draft','discard_premium_translation_working_draft') loop
   perform public.premium_fixture_assert(not has_function_privilege('anon',fn.signature,'execute'),'anon RPC denied');
   perform public.premium_fixture_assert(has_function_privilege('authenticated',fn.signature,'execute'),'authenticated RPC retained');
 end loop;
 set local role anon;
 perform public.premium_fixture_error('select public.list_site_copy_premium_translation_working_drafts()','42501');
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('site_copy','dddddddd-dddd-4ddd-8ddd-dddddddddddd')$q$,'42501');
 reset role;
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 perform public.premium_fixture_error('select public.list_site_copy_premium_translation_working_drafts()','42501');
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('site_copy','dddddddd-dddd-4ddd-8ddd-dddddddddddd')$q$,'42501');
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform public.premium_fixture_error('select * from public.premium_translation_working_drafts','42501');
 perform public.premium_fixture_error($q$select public.get_premium_translation_working_draft('site_copy','not-a-block-uuid')$q$,'22023');
 reset role;
end; $$;
select 'M07_SITE_COPY_NATIVE_ACL_PASS';

do $$ declare a jsonb; staged jsonb; d jsonb; receipt jsonb; before_row jsonb; after_row jsonb; begin
 select to_jsonb(b) into before_row from public.homepage_blocks b where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 a:=public.site_copy_fixture_args(); truncate public.premium_fixture_outbox;
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 staged:=public.premium_fixture_stage(a); d:=staged->'draft';
 perform public.premium_fixture_assert(d->>'humanReview'='pending','Site Copy stage pending');
 perform public.premium_fixture_assert(public.get_premium_translation_working_draft('site_copy',d->>'entityId')->'draft'=d,'Site Copy exact private read');
 perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',a),'40001');
 perform public.premium_fixture_error(format('select public.site_copy_fixture_promote(%L::jsonb,false)',d),'22023');
 reset role;
 perform public.premium_fixture_assert((select to_jsonb(b)=before_row from public.homepage_blocks b where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'stage preserves entire canonical block');
 perform public.premium_fixture_assert((select count(*)=0 from public.premium_fixture_outbox),'stage emits no canonical outbox');
 insert into public.premium_fixture_saved values('site-copy-args',a),('site-copy-stage',staged),
   ('site-copy-read',public.get_premium_translation_working_draft('site_copy',d->>'entityId'));
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 set local timezone='Pacific/Kiritimati';
 receipt:=public.site_copy_fixture_promote(d);
 reset role;
 select to_jsonb(b) into after_row from public.homepage_blocks b where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 perform public.premium_fixture_assert((after_row-array['settings','updated_at','updated_by','created_at'])=(before_row-array['settings','updated_at','updated_by','created_at'])
   and (after_row->>'created_at')::timestamptz=(before_row->>'created_at')::timestamptz,'all block attrs retained across timezone rendering');
 perform public.premium_fixture_assert(after_row#>'{settings,siteCopy,ru}'=before_row#>'{settings,siteCopy,ru}','raw RU spaces CRLF and long dash preserved');
 perform public.premium_fixture_assert(after_row#>'{settings,siteCopy,fr}'=before_row#>'{settings,siteCopy,fr}','raw French and rights preserved');
 perform public.premium_fixture_assert(((after_row#>'{settings,siteCopy}')-array['en'])=((before_row#>'{settings,siteCopy}')-array['en']),'other locale maps preserved');
 perform public.premium_fixture_assert(after_row#>'{settings,siteCopy,en,manual}'=before_row#>'{settings,siteCopy,en,manual}','unselected manual English retained');
 perform public.premium_fixture_assert(after_row#>'{settings,siteCopy,en,unrelated}'=before_row#>'{settings,siteCopy,en,unrelated}','unselected malformed raw English retained');
 perform public.premium_fixture_assert(after_row#>>'{settings,siteCopy,en,intro}'=a#>>'{payload,items,0,text}' and after_row#>>'{settings,siteCopy,en,cta}'='Open the map','selected candidate text exact');
 perform public.premium_fixture_assert(after_row#>'{settings,premiumTranslation,siteCopyEn,intro,customMachine}'=before_row#>'{settings,premiumTranslation,siteCopyEn,intro,customMachine}','selected unknown machine metadata retained');
 perform public.premium_fixture_assert(after_row#>'{settings,premiumTranslation,siteCopyEn,unselected}'=before_row#>'{settings,premiumTranslation,siteCopyEn,unselected}','unselected machine metadata retained');
 perform public.premium_fixture_assert(((after_row#>'{settings,premiumTranslation}')-'siteCopyEn')=((before_row#>'{settings,premiumTranslation}')-'siteCopyEn'),'other premium metadata retained');
 perform public.premium_fixture_assert(((after_row->'settings')-array['siteCopy','premiumTranslation'])=((before_row->'settings')-array['siteCopy','premiumTranslation']),'other raw settings retained');
 perform public.premium_fixture_assert(after_row#>>'{settings,premiumTranslation,siteCopyEn,intro,humanReview,reviewedBy}'='22222222-2222-4222-8222-222222222222','reviewer is actual current actor');
 perform public.premium_fixture_assert(after_row#>'{settings,premiumTranslation,siteCopyEn,intro,reviewerModel}'='null'::jsonb,'configured no model reviewer accepted without claiming review');
 perform public.premium_fixture_assert((select count(*)=1 from public.premium_fixture_outbox),'one canonical promotion outbox');
 perform public.premium_fixture_assert(not exists(select 1 from public.premium_translation_working_drafts where id=(d->>'id')::uuid),'explicit promotion consumes private draft');
 insert into public.premium_fixture_saved values('site-copy-promoted',receipt),('site-copy-after',after_row);
end; $$;
select 'M07_SITE_COPY_NATIVE_PRESERVATION_PASS';

do $$ declare a jsonb; modified jsonb; case_name text; begin
 a:=public.site_copy_fixture_args();
 foreach case_name in array array['empty','too-many','reorder','duplicate','extra-item-key','bad-hash','null-source-id','mismatched-revision','wrong-request-identity','bad-timestamp','unsafe-key','cyrillic-output'] loop
  modified:=a;
  case case_name
   when 'empty' then modified:=jsonb_set(modified,'{source,items}','[]');
   when 'too-many' then modified:=jsonb_set(modified,'{source,items}',(select jsonb_agg(a#>'{source,items,0}') from generate_series(1,51)));
   when 'reorder' then modified:=jsonb_set(modified,'{payload,items}',jsonb_build_array(a#>'{payload,items,1}',a#>'{payload,items,0}'));
   when 'duplicate' then modified:=jsonb_set(jsonb_set(modified,'{payload,items,1,key}','"intro"'),'{source,items,1,key}','"intro"');
   when 'extra-item-key' then modified:=jsonb_set(modified,'{payload,items,0}',(a#>'{payload,items,0}')||'{"extra":true}');
   when 'bad-hash' then modified:=jsonb_set(modified,'{source,items,0,sourceHash}','"bad"');
   when 'null-source-id' then modified:=jsonb_set(modified,'{sourceRevision,blockId}','null');
   when 'mismatched-revision' then modified:=jsonb_set(modified,'{targetRevision,updatedAt}','"2026-10-28T01:00:00Z"');
   when 'wrong-request-identity' then modified:=jsonb_set(modified,'{identity}','"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"');
   when 'bad-timestamp' then modified:=jsonb_set(modified,'{sourceRevision,blockUpdatedAt}','"not-a-time"');
   when 'unsafe-key' then modified:=jsonb_set(jsonb_set(modified,'{payload,items,0,key}','"__proto__.polluted"'),'{source,items,0,key}','"__proto__.polluted"');
   when 'cyrillic-output' then modified:=jsonb_set(modified,'{payload,items,0,text}','"Русский вместо перевода"');
  end case;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',modified),'22023');
  reset role;
 end loop;
end; $$;
select 'M07_SITE_COPY_NATIVE_SHAPE_PASS';

do $$ declare a jsonb; d jsonb; invalid jsonb; item_key text; case_name text; begin
 foreach case_name in array array['key','source','payload'] loop
  a:=public.site_copy_fixture_args();
  a:=jsonb_set(a,'{source,items}',jsonb_build_array(a#>'{source,items,0}'));
  a:=jsonb_set(a,'{payload,items}',jsonb_build_array(a#>'{payload,items,0}'));
  if case_name='key' then
   item_key:='k'||repeat('😀',599)||'a';
   a:=jsonb_set(jsonb_set(a,'{source,items,0,key}',to_jsonb(item_key)),'{payload,items,0,key}',to_jsonb(item_key));
   a:=jsonb_set(a,'{source,settings,siteCopy,ru}',(a#>'{source,settings,siteCopy,ru}')||jsonb_build_object(item_key,'Новый исходный текст'));
   invalid:=jsonb_set(jsonb_set(a,'{source,items,0,key}',to_jsonb(item_key||'a')),'{payload,items,0,key}',to_jsonb(item_key||'a'));
   invalid:=jsonb_set(invalid,'{source,settings,siteCopy,ru}',(a#>'{source,settings,siteCopy,ru}')||jsonb_build_object(item_key||'a','Новый исходный текст'));
  elsif case_name='source' then
   a:=jsonb_set(a,'{source,items,0,text}',to_jsonb(repeat('😀',2000)));
   invalid:=jsonb_set(a,'{source,items,0,text}',to_jsonb(repeat('😀',2000)||'a'));
  else
   a:=jsonb_set(a,'{payload,items,0,text}',to_jsonb(repeat('😀',2000)));
   invalid:=jsonb_set(a,'{payload,items,0,text}',to_jsonb(repeat('😀',2000)||'a'));
  end if;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',invalid),'22023');
  d:=public.premium_fixture_stage(a)->'draft';
  insert into public.premium_fixture_saved values('site-copy-boundary-'||case_name,d);
  perform public.premium_fixture_discard(d); reset role;
 end loop;
end; $$;
select 'M07_SITE_COPY_NATIVE_UTF16_LIMITS_PASS';

do $$ declare a jsonb; base jsonb; modified jsonb; raw_en jsonb; case_name text; begin
 base:=public.site_copy_fixture_settings();
 foreach raw_en in array array['null'::jsonb,'""'::jsonb,'{}'::jsonb,'[]'::jsonb,'42'::jsonb,'"Manual English"'::jsonb] loop
  modified:=jsonb_set(base#-'{premiumTranslation,siteCopyEn,intro}','{siteCopy,en,intro}',raw_en);
  update public.homepage_blocks set settings=modified where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'; a:=public.site_copy_fixture_args();
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',a),'40001'); reset role;
 end loop;
 foreach case_name in array array['locale-array','en-array','premium-array','machine-array','selected-null','selected-array','invalid-marker','missing-russian','non-string-russian'] loop
  modified:=base;
  case case_name
   when 'locale-array' then modified:=jsonb_set(base,'{siteCopy}','[]');
   when 'en-array' then modified:=jsonb_set(base,'{siteCopy,en}','[]');
   when 'premium-array' then modified:=jsonb_set(base,'{premiumTranslation}','[]');
   when 'machine-array' then modified:=jsonb_set(base,'{premiumTranslation,siteCopyEn}','[]');
   when 'selected-null' then modified:=jsonb_set(base,'{premiumTranslation,siteCopyEn,intro}','null');
   when 'selected-array' then modified:=jsonb_set(base,'{premiumTranslation,siteCopyEn,intro}','[]');
   when 'invalid-marker' then modified:=jsonb_set(base,'{premiumTranslation,siteCopyEn,intro,sourceHash}','"bad"');
   when 'missing-russian' then modified:=base#-'{siteCopy,ru,intro}';
   when 'non-string-russian' then modified:=jsonb_set(base,'{siteCopy,ru,intro}','{}');
  end case;
  update public.homepage_blocks set settings=modified where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'; a:=public.site_copy_fixture_args();
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  perform public.premium_fixture_error(format('select public.premium_fixture_stage(%L::jsonb)',a),'40001'); reset role;
 end loop;
 update public.homepage_blocks set settings=base where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
end; $$;
select 'M07_SITE_COPY_NATIVE_OWNERSHIP_PASS';

do $$ declare a jsonb; d jsonb; old_row jsonb; case_name text; begin
 foreach case_name in array array['raw-source','raw-fr','unknown-metadata'] loop
  update public.homepage_blocks set settings=public.site_copy_fixture_settings() where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  a:=public.site_copy_fixture_args(); set local role authenticated;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  d:=public.premium_fixture_stage(a)->'draft'; reset role;
  case case_name
   when 'raw-source' then update public.homepage_blocks set settings=jsonb_set(settings,'{siteCopy,ru,intro}','"Изменённый исходник"') where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
   when 'raw-fr' then update public.homepage_blocks set settings=jsonb_set(settings,'{siteCopy,fr,intro}','"French changed"') where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
   when 'unknown-metadata' then update public.homepage_blocks set settings=settings||'{"extraRaw":true}' where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  end case;
  truncate public.premium_fixture_outbox; select to_jsonb(b) into old_row from public.homepage_blocks b where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  perform public.premium_fixture_error(format('select public.site_copy_fixture_promote(%L::jsonb)',d),'40001');
  perform public.premium_fixture_assert(public.get_premium_translation_working_draft('site_copy',d->>'entityId')->'draft'=d,'stale pending remains readable');
  perform public.premium_fixture_discard(d); reset role;
  perform public.premium_fixture_assert((select to_jsonb(b)=old_row from public.homepage_blocks b where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'stale promote/discard canonical unchanged');
  perform public.premium_fixture_assert((select count(*)=0 from public.premium_fixture_outbox),'stale discard emits no outbox');
 end loop;
 update public.homepage_blocks set settings=public.site_copy_fixture_settings() where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
end; $$;
select 'M07_SITE_COPY_NATIVE_STALE_DISCARD_PASS';

do $$ declare a jsonb; d jsonb; begin
 a:=public.site_copy_fixture_args(); set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 d:=public.premium_fixture_stage(a)->'draft'; reset role;
 insert into public.homepage_blocks(id,block_type,title,settings,updated_by) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','text','Duplicate master',public.site_copy_fixture_settings(),'11111111-1111-4111-8111-111111111111');
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform public.premium_fixture_error(format('select public.site_copy_fixture_promote(%L::jsonb)',d),'40001');
 perform public.premium_fixture_discard(d);
 d:=public.premium_fixture_stage(a)->'draft';
 perform public.premium_fixture_error(format('select public.site_copy_fixture_promote(%L::jsonb)',d),'40001');
 perform public.premium_fixture_discard(d); reset role;
 delete from public.homepage_blocks where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
end; $$;
select 'M07_SITE_COPY_NATIVE_DUPLICATE_MASTER_PASS';

do $$ declare a jsonb; d jsonb; before_row jsonb; changed_row jsonb; case_name text; recovery_page jsonb; begin
 foreach case_name in array array['russian-takeover','english-takeover','deleted-master'] loop
  update public.homepage_blocks set settings=public.site_copy_fixture_settings() where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  a:=public.site_copy_fixture_args();
  select to_jsonb(b) into before_row from public.homepage_blocks b where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  case case_name
   when 'russian-takeover' then update public.homepage_blocks set settings=jsonb_set(settings,'{siteCopy,ru,intro}','"Новый ручной русский"') where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
   when 'english-takeover' then update public.homepage_blocks set settings=jsonb_set(settings#-'{premiumTranslation,siteCopyEn,intro}','{siteCopy,en,intro}','"New authored English"') where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
   when 'deleted-master' then delete from public.homepage_blocks where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  end case;
  select to_jsonb(b) into changed_row from public.homepage_blocks b where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  truncate public.premium_fixture_outbox;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  d:=public.premium_fixture_stage(a)->'draft';
  perform public.premium_fixture_assert(d->'sourceSnapshot'=a->'source','provider output survives concurrent source/target takeover');
  perform public.premium_fixture_assert(public.get_premium_translation_working_draft('site_copy',d->>'entityId')->'draft'=d,'concurrent stale output remains inspectable');
  if case_name='deleted-master' then
   recovery_page:=public.list_site_copy_premium_translation_working_drafts();
   perform public.premium_fixture_assert(recovery_page=jsonb_build_object('schemaVersion',1,'entityIds',jsonb_build_array(d->>'entityId'),'nextCursor',null),'deleted master candidate remains discoverable after reload');
   insert into public.premium_fixture_saved values('site-copy-list-deleted-master',recovery_page);
  end if;
  perform public.premium_fixture_error(format('select public.site_copy_fixture_promote(%L::jsonb)',d),'40001');
  perform public.premium_fixture_discard(d); reset role;
  perform public.premium_fixture_assert((select to_jsonb(b) from public.homepage_blocks b where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') is not distinct from changed_row,'stale stage and failed promotion preserve concurrent canonical state');
  perform public.premium_fixture_assert((select count(*)=0 from public.premium_fixture_outbox),'stale provider output never emits canonical outbox');
  if case_name='deleted-master' then
   insert into public.homepage_blocks select * from jsonb_populate_record(null::public.homepage_blocks,before_row);
  end if;
 end loop;
 update public.homepage_blocks set settings=public.site_copy_fixture_settings() where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
end; $$;
select 'M07_SITE_COPY_NATIVE_DURABLE_STALE_OUTPUT_PASS';

-- Separate real transactions ensure the actual now()-based foundation trigger
-- creates a new revision, without replacing it with a fixture timestamp rule.
do $$ declare d jsonb; begin
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 d:=public.premium_fixture_stage(public.site_copy_fixture_args())->'draft';
 insert into public.premium_fixture_saved values('site-copy-cas-candidate',d);
end; $$;
update public.homepage_blocks set settings=settings where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$ declare d jsonb; begin
 select value into d from public.premium_fixture_saved where name='site-copy-cas-candidate';
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform public.premium_fixture_error(format('select public.site_copy_fixture_promote(%L::jsonb)',d),'40001');
 perform public.premium_fixture_discard(d);
end; $$;
select 'M07_SITE_COPY_NATIVE_EXACT_CAS_PASS';

do $$ declare a jsonb; d jsonb; n integer; identity text; page jsonb; seen jsonb:='[]'; expected jsonb; cursor_id uuid;
  before_canonical jsonb; audit_count bigint; last_expected uuid;
begin
 a:=public.site_copy_fixture_args();
 for n in 1..11 loop
  identity:='90000000-0000-4000-8000-'||lpad(n::text,12,'0');
  a:=jsonb_set(jsonb_set(jsonb_set(a,'{identity}',to_jsonb(identity)),'{sourceRevision,blockId}',to_jsonb(identity)),'{targetRevision,id}',to_jsonb(identity));
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  perform public.premium_fixture_stage(a); reset role;
 end loop;
 select jsonb_agg(entity_id order by id) into expected from public.premium_translation_working_drafts where entity_type='site_copy';
 select to_jsonb(b) into before_canonical from public.homepage_blocks b where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 select count(*) into audit_count from public.admin_audit_log;
 truncate public.premium_fixture_outbox;
 cursor_id:=null; n:=0;
 loop
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  page:=public.list_site_copy_premium_translation_working_drafts(cursor_id,3); reset role;
  perform public.premium_fixture_assert(premium_translation_private.exact_object(page,array['schemaVersion','entityIds','nextCursor']),'list exact response exposes no source/payload');
  perform public.premium_fixture_assert(jsonb_array_length(page->'entityIds') between 1 and 3,'list requested bounded page size');
  seen:=seen||(page->'entityIds'); n:=n+1;
  if n=1 then
   select id into last_expected from public.premium_translation_working_drafts where entity_type='site_copy' order by id offset 2 limit 1;
   perform public.premium_fixture_assert(page->>'nextCursor'=last_expected::text,'list cursor is last visible draft UUID');
   insert into public.premium_fixture_saved values('site-copy-list-page-1',page);
  end if;
  exit when page->'nextCursor'='null'::jsonb;
  cursor_id:=(page->>'nextCursor')::uuid;
  if n>4 then raise exception 'Unexpected pagination loop'; end if;
 end loop;
 perform public.premium_fixture_assert(n=4 and seen=expected,'keyset list visits all eleven candidate identities once in draft order');
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform public.premium_fixture_error('select public.list_site_copy_premium_translation_working_drafts(null,0)','22023');
 perform public.premium_fixture_error('select public.list_site_copy_premium_translation_working_drafts(null,11)','22023');
 perform public.premium_fixture_error('select public.list_site_copy_premium_translation_working_drafts(null,null)','22023');
 page:=public.list_site_copy_premium_translation_working_drafts(null,10);
 perform public.premium_fixture_assert(jsonb_array_length(page->'entityIds')=10 and page->>'nextCursor' is not null,'list max ten page has continuation');
 insert into public.premium_fixture_saved values('site-copy-list-max-page',page);
 page:=public.list_site_copy_premium_translation_working_drafts((page->>'nextCursor')::uuid,10);
 perform public.premium_fixture_assert(jsonb_array_length(page->'entityIds')=1 and page->'nextCursor'='null'::jsonb,'list final page has exact null cursor');
 insert into public.premium_fixture_saved values('site-copy-list-max-last-page',page);
 reset role;
 perform public.premium_fixture_assert((select to_jsonb(b)=before_canonical from public.homepage_blocks b where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'read-only list canonical unchanged');
 perform public.premium_fixture_assert((select count(*)=audit_count from public.admin_audit_log),'read-only list audit unchanged');
 perform public.premium_fixture_assert((select count(*)=0 from public.premium_fixture_outbox),'read-only list outbox unchanged');
 for d in select premium_translation_private.dto(c) from public.premium_translation_working_drafts c where entity_type='site_copy' loop
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  perform public.premium_fixture_discard(d); reset role;
 end loop;
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 page:=public.list_site_copy_premium_translation_working_drafts();
 perform public.premium_fixture_assert(page='{"schemaVersion":1,"entityIds":[],"nextCursor":null}'::jsonb,'empty list exact null cursor');
 insert into public.premium_fixture_saved values('site-copy-list-empty',page);
 a:=public.site_copy_fixture_args(); identity:='ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF';
 a:=jsonb_set(jsonb_set(jsonb_set(a,'{identity}',to_jsonb(identity)),'{sourceRevision,blockId}',to_jsonb(identity)),'{targetRevision,id}',to_jsonb(identity));
 d:=public.premium_fixture_stage(a)->'draft';
 page:=public.list_site_copy_premium_translation_working_drafts();
 perform public.premium_fixture_assert(page->'entityIds'=jsonb_build_array(identity),'list retains stored UUID identity case for exact get');
 perform public.premium_fixture_assert(public.get_premium_translation_working_draft('site_copy',identity)->'draft'=d,'listed uppercase identity remains exactly readable');
 insert into public.premium_fixture_saved values('site-copy-list-uppercase',page);
 perform public.premium_fixture_discard(d);
end; $$;
select 'M07_SITE_COPY_NATIVE_READONLY_DISCOVERY_PAGING_PASS';

create function public.site_copy_fixture_reject_update() returns trigger language plpgsql set search_path='' as $$
begin raise exception using errcode='P0099',message='controlled canonical failure'; end; $$;
do $$ declare a jsonb; d jsonb; before_row jsonb; audit_count bigint; begin
 a:=public.site_copy_fixture_args(); set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 d:=public.premium_fixture_stage(a)->'draft'; reset role;
 select to_jsonb(b) into before_row from public.homepage_blocks b where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 select count(*) into audit_count from public.admin_audit_log;
 truncate public.premium_fixture_outbox;
 create trigger site_copy_fixture_reject_update before update on public.homepage_blocks for each row execute function public.site_copy_fixture_reject_update();
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform public.premium_fixture_error(format('select public.site_copy_fixture_promote(%L::jsonb)',d),'P0099'); reset role;
 drop trigger site_copy_fixture_reject_update on public.homepage_blocks;
 perform public.premium_fixture_assert((select to_jsonb(b)=before_row from public.homepage_blocks b where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'failed promotion rolls back canonical');
 perform public.premium_fixture_assert((select count(*)=audit_count from public.admin_audit_log),'failed promotion rolls back audit');
 perform public.premium_fixture_assert((select count(*)=0 from public.premium_fixture_outbox),'failed promotion rolls back outbox');
 perform public.premium_fixture_assert((select premium_translation_private.dto(c)=d from public.premium_translation_working_drafts c where id=(d->>'id')::uuid),'failed promotion retains exact private candidate');
 insert into public.premium_fixture_saved values('site-copy-lock-candidate',d);
end; $$;
select 'M07_SITE_COPY_NATIVE_ROLLBACK_PASS';

select 'M07_SITE_COPY_NATIVE_SUMMARY',jsonb_build_object('groups',11,'providerCalls',0,'managedAuthPostgrest',false);
