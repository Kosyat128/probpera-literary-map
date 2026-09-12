-- Isolated boundary fixture. The rotation functions and installer are the exact
-- production migration. Ordinary storage/attest/health are minimal test doubles;
-- the unchanged real validator and historical SQL contract have separate tests.
set check_function_bodies = on;
begin;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('fixture.role', true), ''), 'service_role');
$$;
create table public.literary_work_evidence_v2_controls (
  singleton boolean primary key default true,
  enforcement_enabled boolean not null default true,
  contract_version text not null default 'book-evidence-v2',
  validator_id text not null default 'src/data/bookEvidence.ts#bookEvidenceV2Issues',
  validator_version text not null default 'book-evidence-v2-validator-v1',
  validator_sha256 text not null default 'f2ef2c46ae78be553a190057f8833c5661dc1cbcc1902564708effa7f6db0026',
  canon_registry_version text not null default 'world-canon-2026-09-v2',
  canon_registry_sha256 text not null default 'd0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef',
  updated_at timestamptz default now()
);
insert into public.literary_work_evidence_v2_controls(singleton) values(true);
create table public.editorial_countries(id text primary key, status text default 'active');
insert into public.editorial_countries(id) values('usa');
create table public.editorial_writers(country_id text references public.editorial_countries(id), id text,
  name_ru text, name_en text, status text default 'active', source text, metadata jsonb,
  primary key(country_id,id));
create table public.literary_works (
  id uuid primary key, legacy_id text unique, is_cms_locked boolean,
  updated_at timestamptz, content jsonb, predecessor_public boolean,
  country_id text, writer_id text,
  foreign key(country_id,writer_id) references public.editorial_writers(country_id,id)
);
create table public.literary_work_evidence_v2_attestations(work_id uuid primary key, registry_sha text);
create table public.literary_archive_releases(id uuid primary key, metadata jsonb, enable_evidence_v2 boolean, status text);
create table public.literary_archive_release_items(release_id uuid, legacy_id text, payload jsonb);
create function public.literary_work_evidence_v2_sha256(p_value text) returns text language sql immutable as $$
  select encode(sha256(convert_to(p_value, 'UTF8')), 'hex');
$$;
create function public.literary_work_evidence_v2_content(p_work_id uuid) returns jsonb language sql stable as $$
  select content from public.literary_works where id = p_work_id;
$$;
create function public.literary_work_evidence_v2_content_sha256(p_work_id uuid) returns text language sql stable as $$
  select public.literary_work_evidence_v2_sha256(content::text) from public.literary_works where id = p_work_id;
$$;
create function public.is_publishable_literary_work_pre_evidence_v2(p_work_id uuid) returns boolean language sql stable as $$
  select predecessor_public from public.literary_works where id = p_work_id;
$$;
create function public.is_literary_work_evidence_v2_attested(p_work_id uuid) returns boolean language sql stable as $$
  select exists(select 1 from public.literary_work_evidence_v2_attestations proof
    cross join public.literary_work_evidence_v2_controls control
    where proof.work_id = p_work_id and proof.registry_sha = control.canon_registry_sha256);
$$;
create function public.attest_literary_work_evidence_v2(
  p_work_id uuid, p_hash text, p_content jsonb, p_evidence jsonb, p_reviewer text, p_date date
) returns jsonb language plpgsql as $$
begin
  if p_content is distinct from public.literary_work_evidence_v2_content(p_work_id)
    or p_hash is distinct from public.literary_work_evidence_v2_content_sha256(p_work_id)
    or p_evidence #>> '{validation,canonRegistrySha256}' is distinct from
      (select canon_registry_sha256 from public.literary_work_evidence_v2_controls where singleton) then
    raise exception 'fixture attestation rejects stale proof';
  end if;
  insert into public.literary_work_evidence_v2_attestations values(p_work_id, p_evidence #>> '{validation,canonRegistrySha256}')
  on conflict(work_id) do update set registry_sha = excluded.registry_sha;
  return jsonb_build_object('ok', true);
end;
$$;
create function public.assert_literary_work_evidence_v2_health(text,text,text,text,text)
returns jsonb language plpgsql as $$
begin
  if $5 is distinct from (select canon_registry_sha256 from public.literary_work_evidence_v2_controls where singleton)
    or exists(select 1 from public.literary_works where predecessor_public and not public.is_literary_work_evidence_v2_attested(id)) then
    raise exception 'fixture health rejects invalid active proofs';
  end if;
  return jsonb_build_object('ok',true);
end;
$$;
create function public.commit_literary_archive_release(p_release_id uuid, p_manifest text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.literary_archive_releases%rowtype;
  staged record;
  predecessor_public_count integer;
begin
  select * into strict target from public.literary_archive_releases where id = p_release_id for update;
  if target.status = 'committed' then return jsonb_build_object('idempotent', true); end if;
  lock table public.literary_works, public.literary_work_evidence_v2_attestations,
    public.literary_work_evidence_v2_controls in share row exclusive mode;
  perform set_config('probpera.literary_archive_atomic_release', 'on', true);
  set constraints all deferred;

  -- Full replacement semantics: fixture simulates the unchanged ordinary write path.
  for staged in select coalesce(work.id, md5(item.legacy_id)::uuid) as id, item.legacy_id, item.payload
    from public.literary_archive_release_items item
    left join public.literary_works work on item.legacy_id = work.legacy_id
    where item.release_id = target.id and not coalesce(work.is_cms_locked, false) loop
    insert into public.literary_works(id,legacy_id,is_cms_locked,updated_at,content,predecessor_public,country_id,writer_id)
    values(staged.id, staged.legacy_id, false, '2026-09-12', staged.payload -> 'expectedContent',
      staged.payload #>> '{work,editorial_status}' = 'verified', staged.payload #>> '{work,country_id}', staged.payload #>> '{work,writer_id}')
    on conflict(id) do nothing;
    update public.literary_works set content = staged.payload -> 'expectedContent' where id = staged.id;
    if jsonb_typeof(staged.payload -> 'attestation') = 'object' then
      perform public.attest_literary_work_evidence_v2(staged.id,
        public.literary_work_evidence_v2_content_sha256(staged.id),
        staged.payload -> 'expectedContent', staged.payload #> '{attestation,evidence}', 'Fixture', '2026-09-12');
    end if;
  end loop;
  if current_setting('fixture.drop_predecessor', true) = 'on' then
    update public.literary_works set predecessor_public = false where not is_cms_locked;
  end if;
  select count(*)::integer
  into predecessor_public_count
  from public.literary_works work
  where public.is_publishable_literary_work_pre_evidence_v2(work.id);
  if current_setting('fixture.fail_late', true) = 'on' then raise exception 'fixture late failure'; end if;
  if target.enable_evidence_v2 then
    update public.literary_work_evidence_v2_controls set enforcement_enabled = true where singleton;
  end if;
  update public.literary_archive_releases set status = 'committed' where id = target.id;
  return jsonb_build_object('idempotent', false);
end;
$$;

-- __REGISTRY_ROTATION_MIGRATION__

create function public.fixture_assert(p_ok boolean, p_label text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception 'ASSERTION FAILED: %', p_label; end if; end;
$$;
create function public.fixture_refresh_coverage() returns void language sql as $$
  update public.literary_archive_releases set metadata = jsonb_set(metadata,
    '{evidenceV2RegistryRotation,coverageSha256}', to_jsonb(public.literary_work_evidence_v2_sha256(
      jsonb_build_object('priorPublicLegacyIds', metadata #> '{evidenceV2RegistryRotation,priorPublicLegacyIds}',
        'cmsLockedProofs', metadata #> '{evidenceV2RegistryRotation,cmsLockedProofs}')::text)));
$$;
create function public.fixture_reset() returns void language plpgsql as $$
declare
  transition jsonb;
  proof jsonb;
  cms public.literary_works%rowtype;
begin
  perform set_config('fixture.role', 'service_role', true);
  perform set_config('fixture.drop_predecessor', 'off', true);
  perform set_config('fixture.fail_late', 'off', true);
  delete from public.literary_archive_release_items;
  delete from public.literary_archive_releases;
  delete from public.literary_work_evidence_v2_attestations;
  delete from public.literary_works;
  delete from public.editorial_writers;
  update public.literary_work_evidence_v2_controls set enforcement_enabled = true,
    canon_registry_sha256 = 'd0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef';
  insert into public.literary_works(id,legacy_id,is_cms_locked,updated_at,content,predecessor_public) values
    ('00000000-0000-4000-8000-000000000001', 'country:writer:cms', true, '2026-09-12', '{"text":"CMS original"}', true),
    ('00000000-0000-4000-8000-000000000002', 'country:writer:unlocked', false, '2026-09-12', '{"text":"unlocked old"}', true);
  insert into public.literary_work_evidence_v2_attestations select id,
    'd0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef' from public.literary_works;
  transition := public.get_literary_work_evidence_v2_registry_transition();
  select * into strict cms from public.literary_works where is_cms_locked;
  proof := jsonb_build_object('workId', cms.id, 'legacyId', cms.legacy_id,
    'expectedUpdatedAt', cms.updated_at, 'expectedContent', cms.content,
    'expectedContentSha256', public.literary_work_evidence_v2_content_sha256(cms.id),
    'reviewer', 'Original review', 'reviewedAt', '2026-09-02',
    'evidence', jsonb_build_object('recordKey', cms.legacy_id, 'validation', jsonb_build_object(
      'canonRegistrySha256', transition ->> 'targetSha256', 'validatorSha256', transition ->> 'validatorSha256')));
  insert into public.literary_archive_releases values (
    '00000000-0000-4000-8000-000000000010', jsonb_build_object(
      'canonRegistrySha256', transition ->> 'targetSha256', 'canonRegistryVersion', transition ->> 'canonRegistryVersion',
      'validatorSha256', transition ->> 'validatorSha256', 'validatorVersion', transition ->> 'validatorVersion',
      'evidenceV2RegistryRotation', transition || jsonb_build_object(
        'priorPublicLegacyIds', '["country:writer:cms","country:writer:unlocked"]'::jsonb,
        'cmsLockedProofs', jsonb_build_array(proof))), true, 'staging');
  perform public.fixture_refresh_coverage();
  insert into public.literary_archive_release_items values (
    '00000000-0000-4000-8000-000000000010', 'country:writer:unlocked', jsonb_build_object(
      'expectedContent', '{"text":"unlocked new"}'::jsonb,
      'attestation', jsonb_build_object('evidence', jsonb_build_object(
        'recordKey', 'country:writer:unlocked', 'validation', jsonb_build_object(
          'canonRegistrySha256', transition ->> 'targetSha256', 'validatorSha256', transition ->> 'validatorSha256')))));
end;
$$;
create function public.fixture_add_stowe() returns void language plpgsql as $$
declare
  proof jsonb;
begin
  proof := jsonb_build_object('evidence', jsonb_build_object(
    'recordKey', 'usa:harriet_beecher_stowe:uncle-toms-cabin',
    'validation', jsonb_build_object('status', 'passed', 'issues', '[]'::jsonb,
      'validatorSha256', 'f2ef2c46ae78be553a190057f8833c5661dc1cbcc1902564708effa7f6db0026',
      'canonRegistrySha256', 'c8d2b6862c47c3215295951d2c5d1c406913b9879c616f1d8b787c6e05029f6c')));
  insert into public.literary_archive_release_items values(
    '00000000-0000-4000-8000-000000000010', 'usa:harriet_beecher_stowe:uncle-toms-cabin',
    jsonb_build_object('work', jsonb_build_object('country_id','usa', 'writer_id','harriet_beecher_stowe', 'editorial_status','verified'),
      'expectedContent', '{"text":"Reviewed Stowe work"}'::jsonb, 'attestation', proof));
  update public.literary_archive_releases set metadata = metadata || jsonb_build_object('reviewedWriterReference',
    jsonb_build_object('contract','book-evidence-v2-reviewed-writer-reference-20260912',
      'countryId','usa', 'writerId','harriet_beecher_stowe', 'nameRu','Гарриет Бичер-Стоу', 'nameEn','Harriet Beecher Stowe',
      'workKey','usa:harriet_beecher_stowe:uncle-toms-cabin', 'stagedProofSha256', public.literary_work_evidence_v2_sha256(proof::text)));
end;
$$;
create function public.fixture_expect_failure(p_message text) returns void language plpgsql as $$
begin
  begin
    perform public.commit_literary_archive_release('00000000-0000-4000-8000-000000000010', 'fixture');
    raise exception 'UNEXPECTED SUCCESS';
  exception when others then
    if position(p_message in sqlerrm) = 0 then raise; end if;
  end;
  perform public.fixture_assert((select status = 'staging' from public.literary_archive_releases), 'failed release is still staged');
end;
$$;
create function public.fixture_add_alcott() returns void language plpgsql as $$
declare
  content jsonb := '{"work":{"legacyId":"usa:louisa_may_alcott:little-women","firstPublished":1868},"text":"Original supplied annotation"}';
begin
  insert into public.literary_archive_release_items values(
    '00000000-0000-4000-8000-000000000010', 'usa:louisa_may_alcott:little-women',
    jsonb_build_object('work', jsonb_build_object('country_id','usa', 'writer_id','louisa_may_alcott',
      'editorial_status','draft', 'first_published',1868), 'expectedContent', content, 'attestation', 'null'::jsonb));
  update public.literary_archive_releases set metadata = metadata || jsonb_build_object('draftWriterReference',
    jsonb_build_object('contract','book-evidence-v2-draft-writer-reference-20260912',
      'countryId','usa', 'writerId','louisa_may_alcott', 'nameRu','Луиза Мэй Олкотт', 'nameEn','Louisa May Alcott',
      'workKey','usa:louisa_may_alcott:little-women', 'sourceRecordSha256','b21364f9bb413707c39e6023ebec3de5fa0b1da41e38f2f670cef3795badd231',
      'stagedContentSha256',public.literary_work_evidence_v2_sha256(content::text)));
end;
$$;

select public.fixture_assert((select canon_registry_sha256 =
  'd0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef'
  from public.literary_work_evidence_v2_controls), 'migration did not rotate live controls');
select public.fixture_assert(not has_function_privilege('service_role',
  'public.prepare_literary_archive_registry_rotation(uuid)', 'EXECUTE'), 'prepare hook is private');
select public.fixture_assert(not has_function_privilege('service_role',
  'public.assert_literary_archive_registry_rotation(uuid)', 'EXECUTE'), 'final hook is private');
select public.fixture_assert(not has_function_privilege('anon',
  'public.get_literary_work_evidence_v2_rotation_snapshot()', 'EXECUTE'), 'CMS snapshot is private');
select public.fixture_reset();
select public.fixture_assert(jsonb_array_length(public.get_literary_work_evidence_v2_rotation_snapshot() -> 'cmsLockedWorks') = 1, 'snapshot contains only locked public work');

-- Old public and CMS coverage are not replaceable with a claimed count.
delete from public.literary_archive_release_items;
select public.fixture_expect_failure('lacks fresh staged predecessor evidence');
select public.fixture_reset();
update public.literary_archive_releases set metadata = jsonb_set(metadata, '{evidenceV2RegistryRotation,cmsLockedProofs}', '[]');
select public.fixture_refresh_coverage();
select public.fixture_expect_failure('predecessor coverage changed');
select public.fixture_reset();
update public.literary_archive_releases set metadata = jsonb_set(metadata, '{evidenceV2RegistryRotation,cmsLockedProofs}',
  (metadata #> '{evidenceV2RegistryRotation,cmsLockedProofs}') || (metadata #> '{evidenceV2RegistryRotation,cmsLockedProofs}'));
select public.fixture_refresh_coverage();
select public.fixture_expect_failure('predecessor coverage changed');
select public.fixture_reset();
update public.literary_archive_releases set metadata = jsonb_set(metadata, '{evidenceV2RegistryRotation,coverageSha256}', '"bad"');
select public.fixture_expect_failure('coverage checksum is invalid');

-- Exact live content, timestamp, active identity and existing CMS proof matter.
select public.fixture_reset();
update public.literary_works set content = '{"text":"new CMS owner edit"}' where is_cms_locked;
select public.fixture_expect_failure('CMS registry rotation snapshot or current evidence is stale');
select public.fixture_assert((select content ->> 'text' = 'new CMS owner edit' from public.literary_works where is_cms_locked), 'owner edit was preserved');
select public.fixture_reset();
update public.literary_works set updated_at = '2026-09-13' where is_cms_locked;
select public.fixture_expect_failure('CMS registry rotation snapshot or current evidence is stale');
select public.fixture_reset();
delete from public.literary_work_evidence_v2_attestations where work_id = '00000000-0000-4000-8000-000000000001';
select public.fixture_expect_failure('CMS registry rotation snapshot or current evidence is stale');
select public.fixture_reset();
update public.literary_work_evidence_v2_controls set canon_registry_sha256 = repeat('f',64);
select public.fixture_expect_failure('identity or enforcement precondition is stale');
select public.fixture_assert((select canon_registry_sha256 = repeat('f',64) from public.literary_work_evidence_v2_controls), 'unknown identity not silently changed');
select public.fixture_reset();
update public.literary_work_evidence_v2_controls set enforcement_enabled = false;
update public.literary_archive_releases set enable_evidence_v2 = false;
select public.fixture_expect_failure('identity or enforcement precondition is stale');

-- Failure after both fresh attestations restores all earlier transaction writes.
select public.fixture_reset();
select set_config('fixture.fail_late', 'on', true);
select public.fixture_expect_failure('fixture late failure');
select public.fixture_assert((select canon_registry_sha256 =
  'd0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef'
  and enforcement_enabled from public.literary_work_evidence_v2_controls), 'late failure preserved old active identity and enforcement');
select public.fixture_assert((select bool_and(public.is_literary_work_evidence_v2_attested(id)) from public.literary_works), 'late failure restored every old attestation');
select public.fixture_assert((select content ->> 'text' = 'unlocked old' from public.literary_works where not is_cms_locked), 'late failure restored ordinary content');
select public.fixture_reset();
select set_config('fixture.drop_predecessor', 'on', true);
select public.fixture_expect_failure('would lose an attested prior-public work');

-- Successful retry switches once, preserves CMS content/lock, and keeps all old
-- public works attested at the new pin. A committed retry does not rotate twice.
select public.fixture_reset();
select public.commit_literary_archive_release('00000000-0000-4000-8000-000000000010', 'fixture');
select public.fixture_assert((select canon_registry_sha256 =
  'c8d2b6862c47c3215295951d2c5d1c406913b9879c616f1d8b787c6e05029f6c'
  and enforcement_enabled from public.literary_work_evidence_v2_controls), 'successful atomic rotation retains enforcement');
select public.fixture_assert((select bool_and(public.is_literary_work_evidence_v2_attested(id)) from public.literary_works), 'all predecessors re-attested');
select public.fixture_assert((select content ->> 'text' = 'CMS original' and is_cms_locked and updated_at = '2026-09-12'
  from public.literary_works where legacy_id = 'country:writer:cms'), 'CMS content and lock unchanged');
select public.fixture_assert((public.commit_literary_archive_release('00000000-0000-4000-8000-000000000010', 'fixture') ->> 'idempotent')::boolean, 'committed retry is idempotent');
select public.fixture_reset();
update public.literary_work_evidence_v2_controls set enforcement_enabled = false;
select public.commit_literary_archive_release('00000000-0000-4000-8000-000000000010', 'fixture');
select public.fixture_assert((select enforcement_enabled from public.literary_work_evidence_v2_controls), 'shadow state enables only with successful full atomic release');

-- The one reviewed reference can satisfy the actual writer FK without an
-- out-of-transaction insert or changing any existing manual identity.
select public.fixture_reset();
select public.fixture_add_stowe();
select set_config('fixture.fail_late', 'on', true);
select public.fixture_expect_failure('fixture late failure');
select public.fixture_assert(not exists(select 1 from public.editorial_writers), 'late failure rolled back new writer reference');
select public.fixture_assert(not exists(select 1 from public.literary_works where writer_id = 'harriet_beecher_stowe'), 'late failure rolled back new work and its FK');
select public.fixture_reset();
select public.fixture_add_stowe();
select public.commit_literary_archive_release('00000000-0000-4000-8000-000000000010', 'fixture');
select public.fixture_assert((select count(*) = 1 from public.editorial_writers where country_id='usa' and id='harriet_beecher_stowe'), 'exact missing writer inserted');
select public.fixture_assert((select public.is_literary_work_evidence_v2_attested(id) from public.literary_works where writer_id='harriet_beecher_stowe'), 'new Stowe work has fresh evidence');
select public.fixture_reset();
select public.fixture_add_stowe();
insert into public.editorial_writers values('usa','harriet_beecher_stowe','Гарриет Бичер-Стоу','Harriet Beecher Stowe','active','manual','{"private":"preserve"}');
select public.commit_literary_archive_release('00000000-0000-4000-8000-000000000010', 'fixture');
select public.fixture_assert((select source='manual' and metadata='{"private":"preserve"}'::jsonb from public.editorial_writers), 'matching manual identity never overwritten');
select public.fixture_reset();
select public.fixture_add_stowe();
insert into public.editorial_writers values('usa','harriet_beecher_stowe','Different manual name','Harriet Beecher Stowe','active','manual','{}');
select public.fixture_expect_failure('Existing Stowe writer reference conflicts');
select public.fixture_assert((select name_ru='Different manual name' from public.editorial_writers), 'conflicting manual identity preserved');
select public.fixture_reset();
select public.fixture_add_stowe();
update public.literary_archive_releases set metadata=jsonb_set(metadata,'{reviewedWriterReference,stagedProofSha256}','"invalid"');
select public.fixture_expect_failure('Writer reference lacks the exact fresh staged work proof');

-- The second explicit identity only admits the supplied draft; it cannot grant
-- verified status or use a combined 1870 edition in place of 1868 Part I.
select public.fixture_reset();
select public.fixture_add_alcott();
select set_config('fixture.fail_late','on',true);
select public.fixture_expect_failure('fixture late failure');
select public.fixture_assert(not exists(select 1 from public.editorial_writers), 'draft reference also rolls back on later failure');
select public.fixture_reset();
select public.fixture_add_alcott();
update public.literary_archive_release_items set payload=jsonb_set(payload,'{work,editorial_status}','"verified"')
  where legacy_id='usa:louisa_may_alcott:little-women';
select public.fixture_expect_failure('Draft writer reference lacks the exact unverified 1868 staged content');
select public.fixture_reset();
select public.fixture_add_alcott();
update public.literary_archive_release_items set payload=jsonb_set(payload,'{work,first_published}','1870')
  where legacy_id='usa:louisa_may_alcott:little-women';
select public.fixture_expect_failure('Draft writer reference lacks the exact unverified 1868 staged content');
select public.fixture_reset();
select public.fixture_add_alcott();
update public.literary_archive_releases set metadata=jsonb_set(metadata,'{draftWriterReference,sourceRecordSha256}','"unapproved"');
select public.fixture_expect_failure('outside the reviewed exact source identity');
select public.fixture_reset();
select public.fixture_add_alcott();
insert into public.editorial_writers values('usa','louisa_may_alcott','Other owner name','Louisa May Alcott','active','manual','{}');
select public.fixture_expect_failure('Existing Alcott writer reference conflicts');
select public.fixture_reset();
select public.fixture_add_stowe();
select public.fixture_add_alcott();
select public.commit_literary_archive_release('00000000-0000-4000-8000-000000000010','fixture');
select public.fixture_assert((select count(*)=2 from public.editorial_writers), 'only the two exact author references inserted');
select public.fixture_assert((select not predecessor_public and not public.is_literary_work_evidence_v2_attested(id)
  from public.literary_works where writer_id='louisa_may_alcott'), 'Alcott remains draft without evidence attestation');
select public.fixture_assert((select predecessor_public and public.is_literary_work_evidence_v2_attested(id)
  from public.literary_works where writer_id='harriet_beecher_stowe'), 'Stowe still requires real attestation path');
select 'REGISTRY_ROTATION_CONTRACT_OK';
rollback;
