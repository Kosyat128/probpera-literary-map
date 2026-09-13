-- Synthetic storage harness using the reviewed real packet and the unchanged
-- attestation/is-attested SQL. It never connects to a production database.
begin;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('fixture.role',true),''),'service_role');
$$;
create function public.literary_work_evidence_v2_sha256(value text) returns text language sql immutable strict as $$
  select encode(sha256(convert_to(value,'UTF8')),'hex');
$$;
create table public.literary_works(
  id uuid primary key, legacy_id text unique, country_id text, writer_id text,
  title text, metadata jsonb, description text, is_cms_locked boolean,
  updated_at timestamptz, created_at timestamptz default '2026-08-20T00:00:00Z',
  updated_by uuid, fixture_work jsonb
);
create table public.literary_work_translations(
  id uuid primary key default gen_random_uuid(), work_id uuid, locale text,
  title text, description text, source_language text, translation_method text,
  editorial_status text, source_urls text[], reviewed_at date, metadata jsonb,
  created_at timestamptz default '2026-08-20T00:00:00Z', updated_at timestamptz default '2026-08-20T00:00:00Z',
  unique(work_id,locale)
);
create table public.literary_work_sources(
  id uuid primary key default gen_random_uuid(), work_id uuid, provider text, source_url text,
  field_names text[], license_name text, usage text, retrieved_at date, metadata jsonb,
  created_at timestamptz default '2026-08-20T00:00:00Z', updated_at timestamptz default '2026-08-20T00:00:00Z',
  unique(work_id,provider,source_url)
);
create table public.literary_work_authors(work_id uuid, content jsonb);
create table public.literary_work_external_ids(work_id uuid, content jsonb);
create table public.book_editions(work_id uuid, content jsonb);
create table public.literary_work_cover_artworks(work_id uuid, content jsonb);
create table public.literary_archive_child_edit_preservations(id uuid);
create table public.literary_archive_child_edit_preservation_controls(id uuid);
create table public.literary_work_evidence_v2_controls(
  singleton boolean primary key default true, enforcement_enabled boolean default false,
  contract_version text default 'book-evidence-v2',
  validator_id text default 'src/data/bookEvidence.ts#bookEvidenceV2Issues',
  validator_version text default 'book-evidence-v2-validator-v1',
  validator_sha256 text default 'f2ef2c46ae78be553a190057f8833c5661dc1cbcc1902564708effa7f6db0026',
  canon_registry_version text default 'world-canon-2026-09-v2',
  canon_registry_sha256 text default 'd0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef',
  updated_at timestamptz default '2026-09-02T00:00:00Z'
);
insert into public.literary_work_evidence_v2_controls(singleton) values(true);
create table public.literary_work_evidence_v2_attestations(
  work_id uuid primary key, contract_version text, work_content_sha256 text,
  evidence jsonb, evidence_sha256 text, reviewer text, reviewed_at date,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create function public.literary_work_evidence_v2_content(target_work_id uuid) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'work', work.fixture_work || jsonb_build_object('title',work.title,'description',work.description,'metadata',work.metadata),
    'translations',coalesce((select jsonb_agg(jsonb_build_object(
      'locale',row.locale,'title',row.title,'description',row.description,'sourceLanguage',row.source_language,
      'method',row.translation_method,'status',row.editorial_status,'sourceUrls',row.source_urls,
      'reviewedAt',row.reviewed_at,'metadata',row.metadata) order by row.locale collate "C")
      from public.literary_work_translations row where row.work_id = work.id),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(jsonb_build_object('provider',row.provider,'url',row.source_url,
      'fields',row.field_names,'license',row.license_name,'usage',row.usage,'retrievedAt',row.retrieved_at,
      'metadata',row.metadata) order by row.provider collate "C",row.source_url collate "C")
      from public.literary_work_sources row where row.work_id = work.id),'[]'::jsonb),
    'authors',coalesce((select jsonb_agg(row.content order by (row.content ->> 'position')::int)
      from public.literary_work_authors row where row.work_id = work.id),'[]'::jsonb),
    'externalIds',coalesce((select jsonb_agg(row.content order by row.content ->> 'scheme' collate "C",row.content ->> 'value' collate "C")
      from public.literary_work_external_ids row where row.work_id = work.id),'[]'::jsonb),
    'editions',coalesce((select jsonb_agg(row.content order by row.content ->> 'legacyId' collate "C")
      from public.book_editions row where row.work_id = work.id),'[]'::jsonb),
    'artworks',coalesce((select jsonb_agg(row.content order by row.content ->> 'sourceArchiveSha256' collate "C",row.content ->> 'sourceImageSha256' collate "C")
      from public.literary_work_cover_artworks row where row.work_id = work.id),'[]'::jsonb)
  ) from public.literary_works work where work.id = target_work_id;
$$;
create function public.literary_work_evidence_v2_content_sha256(target_work_id uuid) returns text language sql stable as $$
  select public.literary_work_evidence_v2_sha256(public.literary_work_evidence_v2_content(target_work_id)::text);
$$;
-- __REAL_ATTESTATION_FUNCTION__
-- __REAL_IS_ATTESTED_FUNCTION__
create table public.fixture_attester_identity as select oid,proacl,prosecdef from pg_proc
  where oid = 'public.attest_literary_work_evidence_v2(uuid,text,jsonb,jsonb,text,date)'::regprocedure;
-- __WELLS_REPAIR_MIGRATION__
-- __WELLS_REPAIR_MIGRATION__
create table public.fixture_packet(value jsonb);
-- __REVIEWED_PACKET_INSERT__
create function public.fixture_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'assertion failed: %',label; end if; end;
$$;
create function public.fixture_reset_wells() returns void language plpgsql as $$
declare packet jsonb; row jsonb; work uuid;
begin
  select value into strict packet from public.fixture_packet;
  work := (packet ->> 'workId')::uuid;
  truncate public.literary_work_evidence_v2_attestations,public.literary_works,public.literary_work_translations,
    public.literary_work_sources,public.literary_work_authors,public.literary_work_external_ids,public.book_editions,public.literary_work_cover_artworks;
  perform set_config('fixture.role','service_role',true);
  perform set_config('fixture.fail_attestation','off',true);
  perform set_config('fixture.corrupt_description','off',true);
  update public.literary_work_evidence_v2_controls set canon_registry_sha256 = 'd0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef', enforcement_enabled = false;
  insert into public.literary_works(id,legacy_id,country_id,writer_id,title,description,metadata,is_cms_locked,updated_at,fixture_work)
  values(work,packet ->> 'legacyId','england','h_g_wells',packet #>> '{beforeContent,work,title}',
    packet #>> '{beforeContent,work,description}',packet #> '{beforeContent,work,metadata}',true,
    (packet ->> 'expectedUpdatedAt')::timestamptz,packet #> '{beforeContent,work}');
  for row in select value from jsonb_array_elements(packet #> '{beforeContent,translations}') loop
    insert into public.literary_work_translations(work_id,locale,title,description,source_language,translation_method,
      editorial_status,source_urls,reviewed_at,metadata) values(work,row ->> 'locale',row ->> 'title',row ->> 'description',
      row ->> 'sourceLanguage',row ->> 'method',row ->> 'status',array(select jsonb_array_elements_text(row -> 'sourceUrls')),
      (row ->> 'reviewedAt')::date,row -> 'metadata');
  end loop;
  for row in select value from jsonb_array_elements(packet #> '{beforeContent,sources}') loop
    insert into public.literary_work_sources(work_id,provider,source_url,field_names,license_name,usage,retrieved_at,metadata)
    values(work,row ->> 'provider',row ->> 'url',array(select jsonb_array_elements_text(row -> 'fields')),
      row ->> 'license',row ->> 'usage',(row ->> 'retrievedAt')::date,row -> 'metadata');
  end loop;
  insert into public.literary_work_authors select work,value from jsonb_array_elements(packet #> '{beforeContent,authors}');
  insert into public.literary_work_external_ids select work,value from jsonb_array_elements(packet #> '{beforeContent,externalIds}');
  insert into public.book_editions select work,value from jsonb_array_elements(packet #> '{beforeContent,editions}');
  insert into public.literary_work_cover_artworks select work,value from jsonb_array_elements(packet #> '{beforeContent,artworks}');
end;
$$;
create function public.fixture_attempt(expected_error text, patch jsonb default null) returns void language plpgsql as $$
declare packet jsonb;
begin
  select value into strict packet from public.fixture_packet;
  begin
    perform public.repair_wells_editorial_evidence_20260913(coalesce(patch,packet));
  exception when others then
    if position(expected_error in sqlerrm) = 0 then raise; end if;
    return;
  end;
  raise exception 'Expected Wells repair failure did not occur: %',expected_error;
end;
$$;
create function public.fixture_late_attestation_failure() returns trigger language plpgsql as $$
begin
  if current_setting('fixture.fail_attestation',true) = 'on' then raise exception 'fixture forced late attestation failure'; end if;
  return new;
end;
$$;
create trigger fixture_late_failure before insert or update on public.literary_work_evidence_v2_attestations
  for each row execute function public.fixture_late_attestation_failure();
create function public.fixture_work_update() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  if current_setting('fixture.corrupt_description',true) = 'on' then new.description := new.description || ' CORRUPTION'; end if;
  return new;
end;
$$;
create trigger fixture_work_update before update on public.literary_works for each row execute function public.fixture_work_update();
select public.fixture_assert(has_function_privilege('service_role','public.repair_wells_editorial_evidence_20260913(jsonb)','EXECUTE'),'service-only execute');
select public.fixture_assert(not has_function_privilege('anon','public.repair_wells_editorial_evidence_20260913(jsonb)','EXECUTE'),'anon denied');
select public.fixture_assert(not has_function_privilege('authenticated','public.repair_wells_editorial_evidence_20260913(jsonb)','EXECUTE'),'authenticated denied');
select public.fixture_assert((select (current.oid,current.proacl,current.prosecdef) is not distinct from (prior.oid,prior.proacl,prior.prosecdef)
  from pg_proc current cross join public.fixture_attester_identity prior where current.oid = prior.oid),'forward origin patch preserves attester OID and ACL');
select public.fixture_reset_wells();
select public.fixture_assert(public.literary_work_evidence_v2_content_sha256((value ->> 'workId')::uuid) = value ->> 'beforeContentSha256','exact source fixture') from public.fixture_packet;
select public.fixture_attempt('exact reviewed revision',jsonb_set(value,'{workId}','"11111111-1111-4111-8111-111111111111"')) from public.fixture_packet;
select public.fixture_attempt('exact reviewed revision',jsonb_set(value,'{afterContent,work,description}','"Forbidden replacement"')) from public.fixture_packet;
select set_config('fixture.role','authenticated',true);
select public.fixture_attempt('Service role is required');
select set_config('fixture.role','service_role',true);
update public.literary_works set is_cms_locked = false;
select public.fixture_attempt('CMS lock changed');
select public.fixture_reset_wells();
update public.literary_work_translations set description = description || ' Changed.' where locale = 'ru';
select public.fixture_attempt('precondition is stale');
select public.fixture_reset_wells();
update public.literary_work_evidence_v2_controls set canon_registry_sha256 = repeat('f',64);
select public.fixture_attempt('identity is unknown');
select public.fixture_reset_wells();
select set_config('fixture.fail_attestation','on',true);
select public.fixture_attempt('fixture forced late attestation failure');
select public.fixture_assert(public.literary_work_evidence_v2_content_sha256((value ->> 'workId')::uuid) = value ->> 'beforeContentSha256','late failure rolls back every content write') from public.fixture_packet;
select public.fixture_assert(not exists(select 1 from public.literary_work_evidence_v2_attestations),'late failure leaves no attestation');
select public.fixture_assert((select count(*) from public.literary_work_sources) = 2,'late failure rolls back added sources');
select public.fixture_reset_wells();
select set_config('fixture.corrupt_description','on',true);
select public.fixture_attempt('modified protected storage');
select public.fixture_assert(public.literary_work_evidence_v2_content_sha256((value ->> 'workId')::uuid) = value ->> 'beforeContentSha256','protected description corruption rolls back') from public.fixture_packet;
select public.fixture_reset_wells();
select public.fixture_assert(public.repair_wells_editorial_evidence_20260913(value) ->> 'status' = 'repaired','reviewed repair succeeds') from public.fixture_packet;
select public.fixture_assert(public.literary_work_evidence_v2_content_sha256((value ->> 'workId')::uuid) = value ->> 'afterContentSha256','exact reviewed after state') from public.fixture_packet;
select public.fixture_assert(public.is_literary_work_evidence_v2_attested((value ->> 'workId')::uuid),'real attestation is valid') from public.fixture_packet;
select public.fixture_assert((select description from public.literary_works) = value #>> '{beforeContent,work,description}','user-edited parent description retained') from public.fixture_packet;
select public.fixture_assert((select metadata -> 'wellsEditorialRepair20260913' -> 'previousTranslations' from public.literary_works) = value #> '{beforeContent,translations}','exact old bilingual text archived') from public.fixture_packet;
select public.fixture_assert((select is_cms_locked from public.literary_works),'CMS lock retained');
select public.fixture_assert(not (select enforcement_enabled from public.literary_work_evidence_v2_controls),'enforcement untouched');
select public.fixture_assert((select count(*) from public.literary_work_sources) = 8,'six reviewed sources added');
create table public.fixture_after as select public.literary_work_evidence_v2_content(id) content, updated_at from public.literary_works;
select public.fixture_assert(public.repair_wells_editorial_evidence_20260913(value) ->> 'status' = 'already-repaired','old-registry retry is idempotent') from public.fixture_packet;
select public.fixture_assert((select updated_at from public.literary_works) = (select updated_at from public.fixture_after),'retry performs no update');
update public.literary_work_evidence_v2_controls set canon_registry_sha256 = 'c8d2b6862c47c3215295951d2c5d1c406913b9879c616f1d8b787c6e05029f6c';
select public.fixture_attempt('precondition is stale');
select public.attest_literary_work_evidence_v2((value ->> 'workId')::uuid,value ->> 'afterContentSha256',value -> 'afterContent',
  jsonb_set(value -> 'evidence','{validation,canonRegistrySha256}','"c8d2b6862c47c3215295951d2c5d1c406913b9879c616f1d8b787c6e05029f6c"'),
  value ->> 'reviewer',(value ->> 'reviewedAt')::date) from public.fixture_packet;
select public.fixture_assert(public.repair_wells_editorial_evidence_20260913(value) ->> 'status' = 'already-repaired','known new-registry valid retry is idempotent') from public.fixture_packet;
select public.fixture_assert((select updated_at from public.literary_works) = (select updated_at from public.fixture_after),'new-registry retry performs no update');
create function public.fixture_attestation_origin_probe(origin text,method text,source_locale text,source_hash text,expected_error text)
returns void language plpgsql as $$
declare packet jsonb; proof jsonb; provenance jsonb; current_content jsonb; current_hash text;
begin
  select value into strict packet from public.fixture_packet;
  begin
    provenance := packet #> '{evidence,descriptions,en}';
    provenance := (provenance - 'descriptionSha256') || jsonb_build_object('origin',origin,
      'translatedFromLocale',source_locale,'translatedFromSourceHash',source_hash);
    update public.literary_work_translations set translation_method = method,
      metadata = jsonb_set(metadata,'{descriptionProvenance}',provenance)
      where work_id = (packet ->> 'workId')::uuid and locale = 'en';
    proof := jsonb_set(packet -> 'evidence','{descriptions,en}',provenance ||
      jsonb_build_object('descriptionSha256',packet #>> '{evidence,descriptions,en,descriptionSha256}'));
    proof := jsonb_set(proof,'{validation,canonRegistrySha256}',to_jsonb((select canon_registry_sha256 from public.literary_work_evidence_v2_controls)));
    current_content := public.literary_work_evidence_v2_content((packet ->> 'workId')::uuid);
    current_hash := public.literary_work_evidence_v2_sha256(current_content::text);
    perform public.attest_literary_work_evidence_v2((packet ->> 'workId')::uuid,current_hash,current_content,
      proof,packet ->> 'reviewer',(packet ->> 'reviewedAt')::date);
    if expected_error is not null then raise exception 'Expected origin probe rejection was absent'; end if;
    raise exception 'rollback successful origin probe' using errcode = 'ZX001';
  exception when sqlstate 'ZX001' then
    return;
  when others then
    if expected_error is not null and position(expected_error in sqlerrm) > 0 then return; end if;
    raise;
  end;
end;
$$;
select public.fixture_attestation_origin_probe('human-translation','human-translation','ru',null,'complete provenance');
select public.fixture_attestation_origin_probe('human-translation','human-translation','ru',repeat('f',64),'translation source binding is invalid');
select public.fixture_attestation_origin_probe('human-translation','human-translation','en',value #>> '{evidence,descriptions,ru,descriptionSha256}','complete provenance') from public.fixture_packet;
select public.fixture_attestation_origin_probe('human-translation','editorial-original','ru',value #>> '{evidence,descriptions,ru,descriptionSha256}','translation source binding is invalid') from public.fixture_packet;
select public.fixture_attestation_origin_probe('invented-origin','editorial-original',null,null,'translation source binding is invalid');
select public.fixture_attestation_origin_probe('official-source-synthesis','human-translation',null,null,'translation source binding is invalid');
select public.fixture_attestation_origin_probe('human-translation','human-translation','ru',value #>> '{evidence,descriptions,ru,descriptionSha256}',null) from public.fixture_packet;
select public.fixture_assert(public.literary_work_evidence_v2_content_sha256((value ->> 'workId')::uuid) = value ->> 'afterContentSha256','origin probes restore exact reviewed after state') from public.fixture_packet;
select 'WELLS_EDITORIAL_REPAIR_CONTRACT_OK';
rollback;
