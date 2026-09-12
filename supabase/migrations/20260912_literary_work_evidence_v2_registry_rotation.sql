-- Forward-only registry capability. Existing controls/proofs remain valid until
-- the existing atomic archive transaction can re-attest every prior-public work.
alter table public.literary_work_evidence_v2_controls
  alter column canon_registry_sha256 set default
    'c8d2b6862c47c3215295951d2c5d1c406913b9879c616f1d8b787c6e05029f6c';

create or replace function public.get_literary_work_evidence_v2_registry_transition()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  commit_definition text;
  registry_default text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  select pg_catalog.pg_get_functiondef(
    'public.commit_literary_archive_release(uuid,text)'::regprocedure
  ) into commit_definition;
  select pg_catalog.pg_get_expr(value.adbin, value.adrelid)
  into registry_default
  from pg_catalog.pg_attrdef value
  join pg_catalog.pg_attribute attribute
    on attribute.attrelid = value.adrelid and attribute.attnum = value.adnum
  where value.adrelid = 'public.literary_work_evidence_v2_controls'::regclass
    and attribute.attname = 'canon_registry_sha256';
  if position('perform public.prepare_literary_archive_registry_rotation(target.id);'
      in commit_definition) = 0
    or position('perform public.assert_literary_archive_registry_rotation(target.id);'
      in commit_definition) = 0
    or registry_default is distinct from
      '''c8d2b6862c47c3215295951d2c5d1c406913b9879c616f1d8b787c6e05029f6c''::text' then
    raise exception 'Registry transition is not completely installed' using errcode = '55000';
  end if;
  return jsonb_build_object(
    'contract', 'book-evidence-v2-registry-rotation-20260912',
    'contractVersion', 'book-evidence-v2',
    'validator', 'src/data/bookEvidence.ts#bookEvidenceV2Issues',
    'validatorVersion', 'book-evidence-v2-validator-v1',
    'validatorSha256', 'f2ef2c46ae78be553a190057f8833c5661dc1cbcc1902564708effa7f6db0026',
    'canonRegistryVersion', 'world-canon-2026-09-v2',
    'expectedOldSha256', 'd0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef',
    'targetSha256', 'c8d2b6862c47c3215295951d2c5d1c406913b9879c616f1d8b787c6e05029f6c'
  );
end;
$$;

revoke all on function public.get_literary_work_evidence_v2_registry_transition()
  from public, anon, authenticated, service_role;
grant execute on function public.get_literary_work_evidence_v2_registry_transition()
  to service_role;

-- One read snapshot. Private CMS content never enters the public export and
-- cannot be replaced by a checked-in overlay during registry re-attestation.
create or replace function public.get_literary_work_evidence_v2_rotation_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'contract', 'book-evidence-v2-registry-rotation-20260912',
    'priorPublicLegacyIds', coalesce((
      select jsonb_agg(work.legacy_id order by work.legacy_id collate "C")
      from public.literary_works work
      where public.is_publishable_literary_work_pre_evidence_v2(work.id)
    ), '[]'::jsonb),
    'cmsLockedWorks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'workId', work.id, 'legacyId', work.legacy_id,
        'updatedAt', work.updated_at, 'isCmsLocked', work.is_cms_locked,
        'contentSha256', public.literary_work_evidence_v2_content_sha256(work.id),
        'content', public.literary_work_evidence_v2_content(work.id)
      ) order by work.legacy_id collate "C")
      from public.literary_works work
      where work.is_cms_locked
        and public.is_publishable_literary_work_pre_evidence_v2(work.id)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_literary_work_evidence_v2_rotation_snapshot()
  from public, anon, authenticated, service_role;
grant execute on function public.get_literary_work_evidence_v2_rotation_snapshot()
  to service_role;

-- The sole new author reference required by the reviewed Stowe work. An existing
-- CMS/manual identity is never updated. The insertion is rolled back with the
-- ordinary archive commit if its later Evidence V2 attestation fails.
create or replace function public.prepare_literary_archive_reviewed_writer_reference(p_release_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  reference jsonb;
  item jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role'
    or current_setting('probpera.literary_archive_atomic_release', true) is distinct from 'on' then
    raise exception 'Reviewed writer reference requires the atomic archive commit' using errcode = '42501';
  end if;
  select metadata -> 'reviewedWriterReference' into reference
  from public.literary_archive_releases where id = p_release_id;
  if reference is null then return; end if;
  if (reference - 'stagedProofSha256') is distinct from jsonb_build_object(
    'contract', 'book-evidence-v2-reviewed-writer-reference-20260912',
    'countryId', 'usa', 'writerId', 'harriet_beecher_stowe',
    'nameRu', 'Гарриет Бичер-Стоу', 'nameEn', 'Harriet Beecher Stowe',
    'workKey', 'usa:harriet_beecher_stowe:uncle-toms-cabin'
  ) then
    raise exception 'Writer reference is outside the reviewed exact identity' using errcode = '23514';
  end if;
  select payload into item from public.literary_archive_release_items
  where release_id = p_release_id and legacy_id = 'usa:harriet_beecher_stowe:uncle-toms-cabin';
  if not found
    or item #>> '{work,country_id}' is distinct from 'usa'
    or item #>> '{work,writer_id}' is distinct from 'harriet_beecher_stowe'
    or item #>> '{attestation,evidence,recordKey}' is distinct from 'usa:harriet_beecher_stowe:uncle-toms-cabin'
    or item #>> '{attestation,evidence,validation,status}' is distinct from 'passed'
    or item #> '{attestation,evidence,validation,issues}' is distinct from '[]'::jsonb
    or item #>> '{attestation,evidence,validation,validatorSha256}' is distinct from
      'f2ef2c46ae78be553a190057f8833c5661dc1cbcc1902564708effa7f6db0026'
    or item #>> '{attestation,evidence,validation,canonRegistrySha256}' is distinct from
      'c8d2b6862c47c3215295951d2c5d1c406913b9879c616f1d8b787c6e05029f6c'
    or reference ->> 'stagedProofSha256' is distinct from
      public.literary_work_evidence_v2_sha256((item -> 'attestation')::text) then
    raise exception 'Writer reference lacks the exact fresh staged work proof' using errcode = '23514';
  end if;
  -- NOWAIT avoids waiting in the opposite order to an interactive editorial
  -- reference mutation. A busy or conflicting identity causes a clean retry.
  lock table public.editorial_writers in share row exclusive mode nowait;
  perform 1 from public.editorial_countries where id = 'usa' and status = 'active' for key share nowait;
  if not found then
    raise exception 'Reviewed writer country reference is missing or archived' using errcode = '23514';
  end if;
  if exists(select 1 from public.editorial_writers where country_id = 'usa' and id = 'harriet_beecher_stowe') then
    if not exists(select 1 from public.editorial_writers where country_id = 'usa' and id = 'harriet_beecher_stowe'
      and name_ru = 'Гарриет Бичер-Стоу' and name_en = 'Harriet Beecher Stowe' and status = 'active') then
      raise exception 'Existing Stowe writer reference conflicts with the reviewed identity' using errcode = '40001';
    end if;
    return;
  end if;
  insert into public.editorial_writers(country_id, id, name_ru, name_en, source, metadata)
  values('usa', 'harriet_beecher_stowe', 'Гарриет Бичер-Стоу', 'Harriet Beecher Stowe', 'editorial-catalog',
    jsonb_build_object('reviewedReferenceContract', reference ->> 'contract',
      'workKey', reference ->> 'workKey', 'stagedProofSha256', reference ->> 'stagedProofSha256'));
end;
$$;

revoke all on function public.prepare_literary_archive_reviewed_writer_reference(uuid)
  from public, anon, authenticated, service_role;

-- Separately scoped draft reference: no attestation and no verified status are
-- permitted. The owner requested the supplied 1868 Part I catalog entry with an
-- unverified label; this does not change the verified-public database predicate.
create or replace function public.prepare_literary_archive_draft_writer_reference(p_release_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  reference jsonb;
  item jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role'
    or current_setting('probpera.literary_archive_atomic_release', true) is distinct from 'on' then
    raise exception 'Draft writer reference requires the atomic archive commit' using errcode = '42501';
  end if;
  select metadata -> 'draftWriterReference' into reference
  from public.literary_archive_releases where id = p_release_id;
  if reference is null then return; end if;
  if (reference - 'stagedContentSha256') is distinct from jsonb_build_object(
    'contract', 'book-evidence-v2-draft-writer-reference-20260912',
    'countryId', 'usa', 'writerId', 'louisa_may_alcott',
    'nameRu', 'Луиза Мэй Олкотт', 'nameEn', 'Louisa May Alcott',
    'workKey', 'usa:louisa_may_alcott:little-women',
    'sourceRecordSha256', 'b21364f9bb413707c39e6023ebec3de5fa0b1da41e38f2f670cef3795badd231'
  ) then
    raise exception 'Draft writer reference is outside the reviewed exact source identity' using errcode = '23514';
  end if;
  select payload into item from public.literary_archive_release_items
  where release_id = p_release_id and legacy_id = 'usa:louisa_may_alcott:little-women';
  if not found or item #>> '{work,country_id}' is distinct from 'usa'
    or item #>> '{work,writer_id}' is distinct from 'louisa_may_alcott'
    or item #>> '{work,editorial_status}' is distinct from 'draft'
    or item #>> '{work,first_published}' is distinct from '1868'
    or item #>> '{expectedContent,work,legacyId}' is distinct from 'usa:louisa_may_alcott:little-women'
    or item -> 'attestation' is distinct from 'null'::jsonb
    or reference ->> 'stagedContentSha256' is distinct from
      public.literary_work_evidence_v2_sha256((item -> 'expectedContent')::text) then
    raise exception 'Draft writer reference lacks the exact unverified 1868 staged content' using errcode = '23514';
  end if;
  lock table public.editorial_writers in share row exclusive mode nowait;
  perform 1 from public.editorial_countries where id = 'usa' and status = 'active' for key share nowait;
  if not found then
    raise exception 'Draft writer country reference is missing or archived' using errcode = '23514';
  end if;
  if exists(select 1 from public.editorial_writers where country_id = 'usa' and id = 'louisa_may_alcott') then
    if not exists(select 1 from public.editorial_writers where country_id = 'usa' and id = 'louisa_may_alcott'
      and name_ru = 'Луиза Мэй Олкотт' and name_en = 'Louisa May Alcott' and status = 'active') then
      raise exception 'Existing Alcott writer reference conflicts with the supplied identity' using errcode = '40001';
    end if;
    return;
  end if;
  insert into public.editorial_writers(country_id, id, name_ru, name_en, source, metadata)
  values('usa', 'louisa_may_alcott', 'Луиза Мэй Олкотт', 'Louisa May Alcott', 'editorial-catalog',
    jsonb_build_object('draftReferenceContract', reference ->> 'contract',
      'sourceRecordSha256', reference ->> 'sourceRecordSha256', 'workKey', reference ->> 'workKey'));
end;
$$;

revoke all on function public.prepare_literary_archive_draft_writer_reference(uuid)
  from public, anon, authenticated, service_role;

-- Private hook: the outer commit has already acquired its complete table lock
-- set and verified every staged/live precondition. No new lock order is added.
create or replace function public.prepare_literary_archive_registry_rotation(p_release_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target public.literary_archive_releases%rowtype;
  control public.literary_work_evidence_v2_controls%rowtype;
  rotation jsonb;
  transition jsonb;
  prior_keys jsonb;
  cms_keys jsonb;
  proof jsonb;
  live_work public.literary_works%rowtype;
begin
  if coalesce((select auth.role()), '') <> 'service_role'
    or current_setting('probpera.literary_archive_atomic_release', true) is distinct from 'on' then
    raise exception 'Registry rotation requires the atomic archive commit' using errcode = '42501';
  end if;
  select * into strict target from public.literary_archive_releases where id = p_release_id;
  perform public.prepare_literary_archive_reviewed_writer_reference(target.id);
  perform public.prepare_literary_archive_draft_writer_reference(target.id);
  select * into strict control from public.literary_work_evidence_v2_controls where singleton;
  rotation := target.metadata -> 'evidenceV2RegistryRotation';
  if rotation is null then
    if target.metadata ? 'canonRegistrySha256'
      and target.metadata ->> 'canonRegistrySha256' is distinct from control.canon_registry_sha256 then
      raise exception 'A registry identity change requires the reviewed atomic rotation' using errcode = '23514';
    end if;
    return;
  end if;
  transition := public.get_literary_work_evidence_v2_registry_transition();
  if jsonb_typeof(rotation) is distinct from 'object'
    or (rotation - array['priorPublicLegacyIds', 'cmsLockedProofs', 'coverageSha256']) is distinct from transition
    or control.contract_version is distinct from transition ->> 'contractVersion'
    or control.validator_id is distinct from transition ->> 'validator'
    or control.validator_version is distinct from transition ->> 'validatorVersion'
    or control.validator_sha256 is distinct from transition ->> 'validatorSha256'
    or control.canon_registry_version is distinct from transition ->> 'canonRegistryVersion'
    or control.canon_registry_sha256 is distinct from transition ->> 'expectedOldSha256'
    or target.metadata ->> 'canonRegistrySha256' is distinct from transition ->> 'targetSha256'
    or target.metadata ->> 'canonRegistryVersion' is distinct from transition ->> 'canonRegistryVersion'
    or target.metadata ->> 'validatorSha256' is distinct from transition ->> 'validatorSha256'
    or target.metadata ->> 'validatorVersion' is distinct from transition ->> 'validatorVersion'
    or not (control.enforcement_enabled or target.enable_evidence_v2) then
    raise exception 'Registry rotation identity or enforcement precondition is stale' using errcode = '40001';
  end if;
  if jsonb_typeof(rotation -> 'priorPublicLegacyIds') is distinct from 'array'
    or jsonb_typeof(rotation -> 'cmsLockedProofs') is distinct from 'array'
    or rotation ->> 'coverageSha256' is distinct from public.literary_work_evidence_v2_sha256(
      jsonb_build_object('priorPublicLegacyIds', rotation -> 'priorPublicLegacyIds',
        'cmsLockedProofs', rotation -> 'cmsLockedProofs')::text
    ) then
    raise exception 'Registry rotation proof coverage checksum is invalid' using errcode = '23514';
  end if;
  select coalesce(jsonb_agg(work.legacy_id order by work.legacy_id collate "C"), '[]'::jsonb)
  into prior_keys from public.literary_works work
  where public.is_publishable_literary_work_pre_evidence_v2(work.id);
  select coalesce(jsonb_agg(work.legacy_id order by work.legacy_id collate "C"), '[]'::jsonb)
  into cms_keys from public.literary_works work
  where work.is_cms_locked and public.is_publishable_literary_work_pre_evidence_v2(work.id);
  if rotation -> 'priorPublicLegacyIds' is distinct from prior_keys
    or (select coalesce(jsonb_agg(value ->> 'legacyId' order by (value ->> 'legacyId') collate "C"), '[]'::jsonb)
        from jsonb_array_elements(rotation -> 'cmsLockedProofs')) is distinct from cms_keys then
    raise exception 'Registry rotation predecessor coverage changed' using errcode = '40001';
  end if;
  if exists (
    select 1 from public.literary_works work
    left join public.literary_archive_release_items item
      on item.release_id = target.id and item.legacy_id = work.legacy_id
    where not work.is_cms_locked
      and public.is_publishable_literary_work_pre_evidence_v2(work.id)
      and (jsonb_typeof(item.payload -> 'attestation') is distinct from 'object'
        or item.payload #>> '{attestation,evidence,recordKey}' is distinct from work.legacy_id
        or item.payload #>> '{attestation,evidence,validation,canonRegistrySha256}' is distinct from transition ->> 'targetSha256'
        or item.payload #>> '{attestation,evidence,validation,validatorSha256}' is distinct from transition ->> 'validatorSha256')
  ) then
    raise exception 'Registry rotation lacks fresh staged predecessor evidence' using errcode = '23514';
  end if;
  for proof in select value from jsonb_array_elements(rotation -> 'cmsLockedProofs') loop
    select * into live_work from public.literary_works where id = (proof ->> 'workId')::uuid;
    if not found or not live_work.is_cms_locked
      or live_work.legacy_id is distinct from proof ->> 'legacyId'
      or live_work.updated_at is distinct from (proof ->> 'expectedUpdatedAt')::timestamptz
      or not public.is_literary_work_evidence_v2_attested(live_work.id)
      or proof ->> 'expectedContentSha256' is distinct from public.literary_work_evidence_v2_content_sha256(live_work.id)
      or proof -> 'expectedContent' is distinct from public.literary_work_evidence_v2_content(live_work.id)
      or proof #>> '{evidence,recordKey}' is distinct from live_work.legacy_id
      or proof #>> '{evidence,validation,canonRegistrySha256}' is distinct from transition ->> 'targetSha256'
      or proof #>> '{evidence,validation,validatorSha256}' is distinct from transition ->> 'validatorSha256' then
      raise exception 'CMS registry rotation snapshot or current evidence is stale' using errcode = '40001';
    end if;
  end loop;

  -- This identity update, CMS proofs, ordinary target proofs and final health
  -- assertion are one transaction. There is deliberately no standalone rotate RPC.
  update public.literary_work_evidence_v2_controls
  set canon_registry_sha256 = transition ->> 'targetSha256', updated_at = clock_timestamp()
  where singleton and canon_registry_sha256 = transition ->> 'expectedOldSha256';
  if not found then
    raise exception 'Registry rotation control changed' using errcode = '40001';
  end if;
  for proof in select value from jsonb_array_elements(rotation -> 'cmsLockedProofs') loop
    perform public.attest_literary_work_evidence_v2(
      (proof ->> 'workId')::uuid, proof ->> 'expectedContentSha256',
      proof -> 'expectedContent', proof -> 'evidence', proof ->> 'reviewer',
      (proof ->> 'reviewedAt')::date
    );
  end loop;
end;
$$;

revoke all on function public.prepare_literary_archive_registry_rotation(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.assert_literary_archive_registry_rotation(p_release_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  rotation jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role'
    or current_setting('probpera.literary_archive_atomic_release', true) is distinct from 'on' then
    raise exception 'Registry rotation requires the atomic archive commit' using errcode = '42501';
  end if;
  select metadata -> 'evidenceV2RegistryRotation' into rotation
  from public.literary_archive_releases where id = p_release_id;
  if rotation is null then return; end if;
  if exists (
    select 1 from jsonb_array_elements_text(rotation -> 'priorPublicLegacyIds') prior(legacy_id)
    left join public.literary_works work on work.legacy_id = prior.legacy_id
    where work.id is null
      or not public.is_publishable_literary_work_pre_evidence_v2(work.id)
      or not public.is_literary_work_evidence_v2_attested(work.id)
  ) then
    raise exception 'Registry rotation would lose an attested prior-public work' using errcode = '23514';
  end if;
  perform public.assert_literary_work_evidence_v2_health(
    rotation ->> 'contractVersion', rotation ->> 'validatorVersion',
    rotation ->> 'validatorSha256', rotation ->> 'canonRegistryVersion', rotation ->> 'targetSha256'
  );
end;
$$;

revoke all on function public.assert_literary_archive_registry_rotation(uuid)
  from public, anon, authenticated, service_role;

-- Extend precisely two boundaries in the existing commit. Historical migration
-- bytes, its lock order, idempotent return, CMS preservation and final gate stay intact.
do $literary_archive_registry_rotation_hooks$
declare
  definition text;
  before_anchor text := E'  set constraints all deferred;\n\n  -- Full replacement semantics:';
  after_anchor text := E'  select count(*)::integer\n  into predecessor_public_count\n  from public.literary_works work\n  where public.is_publishable_literary_work_pre_evidence_v2(work.id);';
  before_hook text := '  perform public.prepare_literary_archive_registry_rotation(target.id);';
  after_hook text := '  perform public.assert_literary_archive_registry_rotation(target.id);';
begin
  select pg_catalog.pg_get_functiondef('public.commit_literary_archive_release(uuid,text)'::regprocedure)
  into definition;
  if position(before_hook in definition) = 0 and position(after_hook in definition) = 0 then
    if (length(definition) - length(replace(definition, before_anchor, ''))) / length(before_anchor) <> 1
      or (length(definition) - length(replace(definition, after_anchor, ''))) / length(after_anchor) <> 1 then
      raise exception 'Atomic archive registry boundaries cannot be patched safely';
    end if;
    definition := replace(definition, before_anchor, before_hook || E'\n\n' || before_anchor);
    definition := replace(definition, after_anchor, after_hook || E'\n\n' || after_anchor);
    execute definition;
  elsif position(before_hook || E'\n\n' || before_anchor in definition) = 0
    or position(after_hook || E'\n\n' || after_anchor in definition) = 0 then
    raise exception 'Atomic archive registry hooks are partial or displaced';
  end if;
end;
$literary_archive_registry_rotation_hooks$;

revoke all on function public.commit_literary_archive_release(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.commit_literary_archive_release(uuid,text) to service_role;
