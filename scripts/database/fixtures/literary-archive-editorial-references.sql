-- The real migrations36/37/38 and real Stowe/Alcott proof helpers are executed.
-- This small commit harness models only storage and a forced later failure;
-- the complete unchanged archive commit has its separate integration coverage.
-- __STORAGE_AND_REAL_ATTESTER__
create table public.editorial_countries(id text primary key,name_ru text not null,name_en text not null default '',
  iso_code text,status text not null default 'active',source text not null,metadata jsonb not null default '{}',
  created_at timestamptz default now(),updated_at timestamptz default now());
create table public.editorial_writers(country_id text references public.editorial_countries,id text,
  name_ru text not null,name_en text not null default '',status text not null default 'active',source text not null,
  metadata jsonb not null default '{}',is_routing_only boolean default false,
  created_at timestamptz default now(),updated_at timestamptz default now(),primary key(country_id,id));
alter table public.literary_works add foreign key(country_id,writer_id) references public.editorial_writers(country_id,id);
alter table public.literary_work_authors add writer_country_id text, add writer_id text;
alter table public.literary_work_authors add foreign key(writer_country_id,writer_id) references public.editorial_writers(country_id,id);
create table public.literary_archive_releases(id uuid primary key,metadata jsonb,enable_evidence_v2 boolean default false,
  status text default 'staging',expected_item_count integer);
create table public.literary_archive_release_items(release_id uuid,legacy_id text,payload jsonb,canonical_payload text,payload_sha256 text);
create function public.is_publishable_literary_work_pre_evidence_v2(uuid) returns boolean language sql as $$ select false; $$;
create function public.assert_literary_work_evidence_v2_health(text,text,text,text,text) returns jsonb language sql as $$ select '{}'::jsonb; $$;
create function public.commit_literary_archive_release(p_release_id uuid,p_expected_manifest_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.literary_archive_releases%rowtype; staged record; author jsonb; predecessor_public_count integer;
begin
  if coalesce((select auth.role()),'') <> 'service_role' then raise exception 'Service role is required' using errcode='42501'; end if;
  select * into strict target from public.literary_archive_releases where id=p_release_id for update;
  if target.status = 'committed' then return jsonb_build_object('idempotent',true); end if;
  perform set_config('probpera.literary_archive_atomic_release','on',true);
  if exists(select 1 from public.literary_archive_release_items item where item.release_id=target.id
    and (item.payload_sha256 is distinct from public.literary_work_evidence_v2_sha256(item.canonical_payload)
      or item.payload is distinct from item.canonical_payload::jsonb)) then
    raise exception 'fixture staged transport mismatch';
  end if;
  set constraints all deferred;

  -- Full replacement semantics: modeled storage insertion retains real FKs.
  for staged in select * from public.literary_archive_release_items where release_id=target.id loop
    insert into public.literary_works(id,legacy_id,country_id,writer_id,title,metadata,is_cms_locked)
    values(md5(staged.legacy_id)::uuid,staged.legacy_id,staged.payload #>> '{work,country_id}',staged.payload #>> '{work,writer_id}',
      'Fixture title','{}',false) on conflict(id) do nothing;
    for author in select value from jsonb_array_elements(staged.payload -> 'authors') loop
      insert into public.literary_work_authors(work_id,content,writer_country_id,writer_id)
      values(md5(staged.legacy_id)::uuid,author,author ->> 'writer_country_id',author ->> 'writer_id');
    end loop;
  end loop;
  select count(*)::integer
  into predecessor_public_count
  from public.literary_works work
  where public.is_publishable_literary_work_pre_evidence_v2(work.id);
  if current_setting('fixture.fail_late',true)='on' then raise exception 'fixture later gate failed'; end if;
  update public.literary_archive_releases set status='committed' where id=target.id;
  return jsonb_build_object('status','committed');
end;
$$;
revoke all on function public.commit_literary_archive_release(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.commit_literary_archive_release(uuid,text) to service_role;
create table public.fixture_commit_identity as select oid,proacl,prosecdef from pg_proc
  where oid='public.commit_literary_archive_release(uuid,text)'::regprocedure;
-- __REPLAY_36_37_38__
-- Replay exactly what the production plan does, not migration38 in isolation.
-- __REPLAY_36_37_38__
create table public.fixture_metadata(value jsonb);
create table public.fixture_items(legacy_id text,canonical_payload text,payload jsonb,payload_sha256 text);
-- __REFERENCE_CATALOG_FIXTURE__
create function public.fixture_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'assertion failed: %',label; end if; end;
$$;
create function public.fixture_reset_references() returns void language plpgsql as $$
begin
  truncate public.literary_work_authors,public.literary_works,public.editorial_writers,public.editorial_countries,
    public.literary_archive_releases,public.literary_archive_release_items;
  perform set_config('fixture.role','service_role',true);
  perform set_config('fixture.fail_late','off',true);
  perform set_config('probpera.literary_archive_atomic_release','off',true);
  insert into public.literary_archive_releases(id,metadata,expected_item_count)
    select '00000000-0000-4000-8000-000000000001',value,3 from public.fixture_metadata;
  insert into public.literary_archive_release_items(release_id,legacy_id,canonical_payload,payload,payload_sha256)
    select '00000000-0000-4000-8000-000000000001',legacy_id,canonical_payload,payload,payload_sha256 from public.fixture_items;
end;
$$;
create function public.fixture_reference_attempt(expected_error text) returns void language plpgsql as $$
begin
  begin perform public.commit_literary_archive_release('00000000-0000-4000-8000-000000000001',repeat('a',64));
  exception when others then if position(expected_error in sqlerrm)=0 then raise; end if; return; end;
  raise exception 'Expected reference failure did not occur: %',expected_error;
end;
$$;
create table public.fixture_installer(value text);
-- __INSTALLER_SOURCE__
create function public.fixture_reject_changed_commit(changed_definition text,expected_error text) returns void language plpgsql as $$
declare original_definition text; rejected boolean:=false;
begin
  original_definition:=pg_get_functiondef('public.commit_literary_archive_release(uuid,text)'::regprocedure);
  execute changed_definition;
  begin execute (select value from public.fixture_installer);
  exception when others then if position(expected_error in sqlerrm)=0 then raise; end if; rejected:=true; end;
  execute original_definition;
  perform public.fixture_assert(rejected,'unknown duplicated or displaced installer boundary rejected');
end;
$$;
do $$ declare definition text; hook text:='  perform public.prepare_literary_archive_editorial_references_20260914(target.id);';
  anchor text:='  perform public.prepare_literary_archive_registry_rotation(target.id);';
begin
  definition:=pg_get_functiondef('public.commit_literary_archive_release(uuid,text)'::regprocedure);
  perform public.fixture_reject_changed_commit(replace(definition,hook,hook || E'\n' || hook),'partial or displaced');
  perform public.fixture_reject_changed_commit(replace(definition,hook || E'\n' || anchor,anchor || E'\n' || hook),'partial or displaced');
  perform public.fixture_reject_changed_commit(replace(definition,hook || E'\n' || anchor,'  -- fixture absent boundary'),'cannot be patched safely');
end; $$;
select public.fixture_assert((select (current.oid,current.proacl,current.prosecdef) is not distinct from (prior.oid,prior.proacl,prior.prosecdef)
  from pg_proc current cross join public.fixture_commit_identity prior where current.oid=prior.oid),'commit OID/ACL retained across36/37/38 replay');
select public.fixture_assert(not has_function_privilege('service_role','public.prepare_literary_archive_editorial_references_20260914(uuid)','EXECUTE'),'initializer private to commit');
select public.fixture_assert(not has_function_privilege('anon','public.prepare_literary_archive_editorial_references_20260914(uuid)','EXECUTE'),'anon initializer denied');
select public.fixture_assert(not has_function_privilege('authenticated','public.prepare_literary_archive_editorial_references_20260914(uuid)','EXECUTE'),'authenticated initializer denied');
do $$ declare definition text; hook text:='  perform public.prepare_literary_archive_editorial_references_20260914(target.id);';
begin
  definition:=pg_get_functiondef('public.commit_literary_archive_release(uuid,text)'::regprocedure);
  perform public.fixture_assert((length(definition)-length(replace(definition,hook,'')))/length(hook)=1,'one initializer after replay');
  perform public.fixture_assert(position(hook || E'\n  perform public.prepare_literary_archive_registry_rotation(target.id);' in definition)>0,'initializer before original rotation');
end; $$;

select public.fixture_reset_references();
do $$ begin
  begin perform public.prepare_literary_archive_editorial_references_20260914('00000000-0000-4000-8000-000000000001');
  exception when sqlstate '42501' then return; end;
  raise exception 'standalone initializer should fail';
end; $$;
select set_config('fixture.role','authenticated',true);
select public.fixture_reference_attempt('Service role is required');
select public.fixture_reset_references();
delete from public.literary_archive_release_items where legacy_id='usa:louisa_may_alcott:little-women';
select public.fixture_reference_attempt('complete staged target');
select public.fixture_reset_references();
update public.literary_archive_releases set metadata=jsonb_set(metadata,'{referenceCatalog,payloadSha256}',to_jsonb(repeat('0',64)));
select public.fixture_reference_attempt('not the exact reviewed payload');
select public.fixture_assert((select count(*) from public.editorial_countries)=0,'wrong hash creates no country');
select public.fixture_reset_references();
update public.literary_archive_releases set metadata=jsonb_set(metadata,'{referenceCatalog,payloadText}',to_jsonb((metadata #>> '{referenceCatalog,payloadText}') || ' '));
select public.fixture_reference_attempt('not the exact reviewed payload');
select public.fixture_reset_references();
update public.literary_archive_releases set metadata=metadata-'referenceCatalog';
select public.fixture_reference_attempt('not the exact reviewed payload');
select public.fixture_reset_references();
update public.literary_archive_release_items set payload=jsonb_set(payload,'{work,writer_id}','"unreviewed_writer"') where legacy_id like '__PRIMARY_COUNTRY__:%';
update public.literary_archive_release_items set canonical_payload=payload::text,payload_sha256=public.literary_work_evidence_v2_sha256(payload::text);
select public.fixture_reference_attempt('outside the reviewed catalog');
select public.fixture_assert((select count(*) from public.editorial_writers)=0,'unknown staged tuple creates nothing');
select public.fixture_reset_references();
update public.literary_archive_release_items set payload=jsonb_set(payload,'{authors,0,writer_id}','null') where legacy_id like '__PRIMARY_COUNTRY__:%';
update public.literary_archive_release_items set canonical_payload=payload::text,payload_sha256=public.literary_work_evidence_v2_sha256(payload::text);
select public.fixture_reference_attempt('outside the reviewed catalog');
select public.fixture_reset_references();
insert into public.editorial_countries(id,name_ru,status,source,metadata) values('usa','Manual archived country','archived','manual','{"keep":"country"}');
select public.fixture_reference_attempt('Required editorial country is archived');
select public.fixture_assert((select status='archived' and name_ru='Manual archived country' and metadata='{"keep":"country"}'::jsonb from public.editorial_countries where id='usa'),'archived country unchanged');
select public.fixture_reset_references();
insert into public.editorial_countries(id,name_ru,source) values('__LINKED_COUNTRY__','Manual country','manual');
insert into public.editorial_writers(country_id,id,name_ru,status,source,metadata)
  values('__LINKED_COUNTRY__','__LINKED_WRITER__','Manual archived writer','archived','manual','{"keep":"writer"}');
select public.fixture_reference_attempt('Required editorial writer is archived');
select public.fixture_assert((select count(*) from public.editorial_countries)=1,'archived linked writer inserts no countries');
select public.fixture_assert((select status='archived' and metadata='{"keep":"writer"}'::jsonb from public.editorial_writers),'archived writer unchanged');

-- A later content/proof gate rolls back every newly initialized reference.
select public.fixture_reset_references();
select set_config('fixture.fail_late','on',true);
select public.fixture_reference_attempt('fixture later gate failed');
select public.fixture_assert((select count(*) from public.editorial_countries)=0 and (select count(*) from public.editorial_writers)=0,'later failure rolls back all references');
select public.fixture_assert((select count(*) from public.literary_works)=0,'later failure rolls back works');
select public.fixture_reset_references();
update public.literary_archive_releases set metadata=jsonb_set(metadata,'{reviewedWriterReference,stagedItemSha256}',to_jsonb(repeat('0',64)));
select public.fixture_reference_attempt('exact fresh staged work proof');
select public.fixture_assert((select count(*) from public.editorial_countries)=0,'Stowe proof failure rolls back initializer');
select public.fixture_reset_references();
update public.literary_archive_releases set metadata=jsonb_set(metadata,'{draftWriterReference,stagedItemSha256}',to_jsonb(repeat('0',64)));
select public.fixture_reference_attempt('exact unverified 1868 staged content');
select public.fixture_assert((select count(*) from public.editorial_writers)=0,'Alcott proof failure rolls back initializer and Stowe');

-- Existing manual rows, metadata, timestamps and linked attribution are retained.
select public.fixture_reset_references();
insert into public.editorial_countries(id,name_ru,name_en,iso_code,source,metadata,created_at,updated_at)
  values('__PRIMARY_COUNTRY__','Manual country name','Custom name','ZZ','manual','{"manual":true}','2020-01-01','2021-01-01');
insert into public.editorial_writers(country_id,id,name_ru,name_en,source,metadata,created_at,updated_at)
  values('__PRIMARY_COUNTRY__','__PRIMARY_WRITER__','Manual writer','Custom writer','manual','{"manual":true}','2020-01-01','2021-01-01');
create table public.fixture_manual_snapshot as select to_jsonb(c) as country,to_jsonb(w) as writer
  from public.editorial_countries c cross join public.editorial_writers w;
select public.commit_literary_archive_release('00000000-0000-4000-8000-000000000001',repeat('a',64));
select public.fixture_assert((select count(*) from public.editorial_countries)=3,'only3 needed countries inserted');
select public.fixture_assert((select count(*) from public.editorial_writers)=4,'primary linked and2 separately proven writers');
select public.fixture_assert(not exists(select 1 from public.editorial_countries where id='__UNUSED_COUNTRY__'),'unused reviewed country not inserted');
select public.fixture_assert(not exists(select 1 from public.editorial_writers where country_id='__UNUSED_COUNTRY__' and id='__UNUSED_WRITER__'),'unused reviewed writer not inserted');
select public.fixture_assert((select to_jsonb(c)=snapshot.country and to_jsonb(w)=snapshot.writer
  from public.editorial_countries c join public.editorial_writers w on w.country_id=c.id
  cross join public.fixture_manual_snapshot snapshot where c.id='__PRIMARY_COUNTRY__'),'manual rows byte-equivalent');
select public.fixture_assert((select name_en='Harriet Beecher Stowe' and metadata ? 'reviewedReferenceContract' from public.editorial_writers where id='harriet_beecher_stowe'),'Stowe insertion belongs to original proof helper');
select public.fixture_assert((select name_en='Louisa May Alcott' and metadata ? 'draftReferenceContract' from public.editorial_writers where id='louisa_may_alcott'),'Alcott insertion belongs to original draft helper');
select public.fixture_assert((select content ->> 'attribution_status'='disputed' from public.literary_work_authors where writer_id='__LINKED_WRITER__'),'linked attribution unchanged');
create table public.fixture_committed_reference_snapshot as select jsonb_agg(value order by value::text) as value
  from (select to_jsonb(c) as value from public.editorial_countries c union all select to_jsonb(w) from public.editorial_writers w) rows;
select public.fixture_assert(public.commit_literary_archive_release('00000000-0000-4000-8000-000000000001',repeat('a',64)) ->> 'idempotent'='true','committed retry is idempotent');
select public.fixture_assert((select jsonb_agg(value order by value::text) from
  (select to_jsonb(c) as value from public.editorial_countries c union all select to_jsonb(w) from public.editorial_writers w) rows)
  =(select value from public.fixture_committed_reference_snapshot),'retry does not touch references');
-- __OPTIONAL_FULL_SCALE__
select 'EDITORIAL_REFERENCE_CONTRACT_OK' as marker;
rollback;
