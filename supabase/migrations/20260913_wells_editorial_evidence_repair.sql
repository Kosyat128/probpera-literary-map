-- One reviewed Wells revision. Installation does not mutate editorial content.
-- The service RPC retains the existing validator and never changes enforcement.
-- Match the unchanged TypeScript validator: an independently authored EN
-- synthesis has no translated-from claim. Human translations retain exact
-- opposite-locale/hash binding. Existing function OID, ACL and all other checks
-- survive these unique, version-checked replacements.
do $wells_description_origin_contract_20260913$
declare
  definition text;
  original_definition text;
  old_provenance text := $old_provenance$    or coalesce(
      p_evidence #>> '{descriptions,en,translatedFromSourceHash}',
      ''
    ) !~ '^[0-9a-f]{64}$' then$old_provenance$;
  new_provenance text := $new_provenance$    or (
      p_evidence #>> '{descriptions,en,origin}' = 'human-translation'
      and (coalesce(p_evidence #>> '{descriptions,en,translatedFromSourceHash}', '') !~ '^[0-9a-f]{64}$'
        or p_evidence #>> '{descriptions,en,translatedFromLocale}' is distinct from 'ru')
    ) then$new_provenance$;
  old_binding text := $old_binding$    or p_evidence #>> '{descriptions,en,translatedFromSourceHash}'
      is distinct from
      p_evidence #>> '{descriptions,ru,descriptionSha256}'$old_binding$;
  new_binding text := $new_binding$    or (
      p_evidence #>> '{descriptions,en,origin}' = 'human-translation'
      and p_evidence #>> '{descriptions,en,translatedFromSourceHash}' is distinct from
        p_evidence #>> '{descriptions,ru,descriptionSha256}'
    )$new_binding$;
  old_review_anchor text := '  if normalized_reviewer is null';
  new_review_anchor text := $new_review_anchor$  -- description-origin-contract-20260913: exact frozen-validator origin/method binding.
  if exists (
    select 1 from jsonb_array_elements(p_expected_content -> 'translations') translation
    where translation ->> 'locale' in ('ru','en') and (
      coalesce(p_evidence #>> array['descriptions',translation ->> 'locale','origin'],'')
        not in ('article-adapted','official-source-synthesis','human-translation')
      or (p_evidence #>> array['descriptions',translation ->> 'locale','origin'] in ('article-adapted','official-source-synthesis')
        and translation ->> 'method' is distinct from 'editorial-original')
      or (p_evidence #>> array['descriptions',translation ->> 'locale','origin'] = 'human-translation' and (
        translation ->> 'method' is distinct from 'human-translation'
        or p_evidence #>> array['descriptions',translation ->> 'locale','translatedFromLocale']
          is distinct from (case when translation ->> 'locale' = 'en' then 'ru' else 'en' end)
        or p_evidence #>> array['descriptions',translation ->> 'locale','translatedFromSourceHash']
          is distinct from p_evidence #>> array['descriptions',case when translation ->> 'locale' = 'en' then 'ru' else 'en' end,'descriptionSha256']
      ))
    )
  ) then
    raise exception 'Description origin, method or translation source binding is invalid' using errcode = '23514';
  end if;
  if normalized_reviewer is null$new_review_anchor$;
begin
  select pg_get_functiondef('public.attest_literary_work_evidence_v2(uuid,text,jsonb,jsonb,text,date)'::regprocedure)
  into definition;
  original_definition := definition;
  if position('description-origin-contract-20260913' in definition) > 0 then
    if (length(definition) - length(replace(definition,new_provenance,''))) <> length(new_provenance)
      or (length(definition) - length(replace(definition,new_binding,''))) <> length(new_binding)
      or (length(definition) - length(replace(definition,new_review_anchor,''))) <> length(new_review_anchor) then
      raise exception 'Installed description origin contract is not the reviewed version';
    end if;
  else
    if (length(definition) - length(replace(definition,old_provenance,''))) <> length(old_provenance)
      or (length(definition) - length(replace(definition,old_binding,''))) <> length(old_binding)
      or (length(definition) - length(replace(definition,old_review_anchor,''))) <> length(old_review_anchor) then
      raise exception 'Evidence V2 description origin contract cannot be patched safely';
    end if;
    definition := replace(replace(replace(definition,old_provenance,new_provenance),old_binding,new_binding),old_review_anchor,new_review_anchor);
    if replace(replace(replace(definition,new_provenance,old_provenance),new_binding,old_binding),new_review_anchor,old_review_anchor)
      is distinct from original_definition then
      raise exception 'Description origin patch changes unrelated attestation code';
    end if;
    execute definition;
  end if;
end;
$wells_description_origin_contract_20260913$;

create or replace function public.repair_wells_editorial_evidence_20260913(p_packet jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_id constant uuid := 'd48b285b-8278-4551-91d7-30b3703df154';
  target_key constant text := 'england:h_g_wells:when-the-sleeper-wakes';
  before_sha constant text := 'd91a7f950bd540ffaf36f9566f343b4f5c20e83f24610c741e5430bda569872a';
  after_sha constant text := '2a4ed4469ce7d6dc2af7f29ff04a0b94a612fc26eba0849887ed0eb5dc8febf4';
  packet_sha constant text := '015b97ada9cd080a67b5bea05c022405d1787faa1eea6540f4092b7ef41f774c';
  evidence_sha constant text := '9d4eadf20031b749bb247dc60eef0bf8c2707c9cd28d5c27d30842229b87127d';
  reviewed_by constant text := 'Codex AI /root/security_governance_finish';
  reviewed_on constant date := '2026-09-13';
  control public.literary_work_evidence_v2_controls%rowtype;
  current_work public.literary_works%rowtype;
  before_content jsonb;
  after_content jsonb;
  live_content jsonb;
  expected_history jsonb;
  old_translation jsonb;
  new_translation jsonb;
  source_row jsonb;
  work_protected jsonb;
  translations_protected jsonb;
  sources_preserved jsonb;
  original_control jsonb;
  previous_atomic_mode text;
  changed integer;
  proof_receipt jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required for the reviewed Wells repair' using errcode = '42501';
  end if;
  if jsonb_typeof(p_packet) is distinct from 'object'
    or not p_packet ?& array['contract','workId','legacyId','expectedUpdatedAt','beforeContentSha256','beforeContent','afterContentSha256','afterContent','evidence','reviewer','reviewedAt']
    or (p_packet - array['contract','workId','legacyId','expectedUpdatedAt','beforeContentSha256','beforeContent','afterContentSha256','afterContent','evidence','reviewer','reviewedAt']) <> '{}'::jsonb
    or p_packet ->> 'contract' is distinct from 'wells-editorial-repair-20260913'
    or p_packet ->> 'workId' is distinct from target_id::text
    or p_packet ->> 'legacyId' is distinct from target_key
    or p_packet ->> 'beforeContentSha256' is distinct from before_sha
    or p_packet ->> 'afterContentSha256' is distinct from after_sha
    or p_packet ->> 'reviewer' is distinct from reviewed_by
    or p_packet ->> 'reviewedAt' is distinct from reviewed_on::text
    or (p_packet ->> 'expectedUpdatedAt')::timestamptz is distinct from '2026-09-02T13:35:12.294003+03:00'::timestamptz
    or public.literary_work_evidence_v2_sha256(p_packet::text) is distinct from packet_sha
    or public.literary_work_evidence_v2_sha256((p_packet -> 'evidence')::text) is distinct from evidence_sha then
    raise exception 'Wells repair packet is outside the exact reviewed revision' using errcode = '22023';
  end if;
  before_content := p_packet -> 'beforeContent';
  after_content := p_packet -> 'afterContent';
  if jsonb_typeof(before_content) is distinct from 'object'
    or jsonb_typeof(after_content) is distinct from 'object'
    or public.literary_work_evidence_v2_sha256(before_content::text) is distinct from before_sha
    or public.literary_work_evidence_v2_sha256(after_content::text) is distinct from after_sha
    or (after_content - array['work','translations','sources']) is distinct from (before_content - array['work','translations','sources'])
    or ((after_content -> 'work') - array['title','metadata']) is distinct from ((before_content -> 'work') - array['title','metadata'])
    or after_content #>> '{work,title}' is distinct from 'Когда спящий проснется'
    or before_content #>> '{work,title}' is distinct from 'Когда спящий проснётся'
    or jsonb_typeof(after_content #> '{work,metadata}') is distinct from 'object'
    or ((after_content #> '{work,metadata}') - array['localizedTitles','wellsEditorialRepair20260913']) is distinct from (before_content #> '{work,metadata}')
    or jsonb_typeof(after_content #> '{work,metadata,localizedTitles}') is distinct from 'object'
    or jsonb_typeof(after_content -> 'translations') is distinct from 'array'
    or jsonb_array_length(after_content -> 'translations') <> 2
    or jsonb_typeof(after_content -> 'sources') is distinct from 'array' then
    raise exception 'Wells repair changes protected work content or structure' using errcode = '23514';
  end if;
  expected_history := jsonb_build_object(
    'contract','wells-editorial-repair-20260913', 'beforeContentSha256',before_sha,
    'previousWorkTitle', before_content #>> '{work,title}',
    'previousTranslations', before_content -> 'translations',
    'reviewer',reviewed_by, 'reviewedAt',reviewed_on::text,
    'reason','New bilingual source-based synopses; original authorship was undocumented. Prior text preserved without retrospective authorship claims.'
  );
  if after_content #> '{work,metadata,wellsEditorialRepair20260913}' is distinct from expected_history then
    raise exception 'Wells repair must archive the exact previous editorial text' using errcode = '23514';
  end if;
  for old_translation in select value from jsonb_array_elements(before_content -> 'translations') loop
    select value into new_translation from jsonb_array_elements(after_content -> 'translations')
    where value ->> 'locale' = old_translation ->> 'locale';
    if not found or old_translation ->> 'locale' not in ('ru','en')
      or (select count(*) from jsonb_array_elements(after_content -> 'translations') where value ->> 'locale' = old_translation ->> 'locale') <> 1
      or (new_translation - array['title','description','sourceUrls','reviewedAt','metadata']) is distinct from (old_translation - array['title','description','sourceUrls','reviewedAt','metadata'])
      or ((new_translation -> 'metadata') - array['titleEvidence','descriptionProvenance']) is distinct from (old_translation -> 'metadata')
      or new_translation ->> 'title' is distinct from (case when old_translation ->> 'locale' = 'ru' then 'Когда спящий проснется' else old_translation ->> 'title' end)
      or new_translation ->> 'reviewedAt' is distinct from reviewed_on::text
      or new_translation ->> 'description' is not distinct from old_translation ->> 'description'
      or new_translation #>> '{metadata,descriptionProvenance,origin}' is distinct from 'official-source-synthesis'
      or new_translation #>> '{metadata,descriptionProvenance,author}' is distinct from 'Codex AI /root'
      or new_translation #>> '{metadata,descriptionProvenance,createdAt}' is distinct from reviewed_on::text
      or new_translation #>> '{metadata,descriptionProvenance,reviewedBy}' is distinct from reviewed_by
      or new_translation #>> '{metadata,descriptionProvenance,reviewedAt}' is distinct from reviewed_on::text then
      raise exception 'Wells repair changes protected translation fields or invents retrospective provenance' using errcode = '23514';
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(before_content -> 'sources') old_source
    where not exists(select 1 from jsonb_array_elements(after_content -> 'sources') new_source where new_source = old_source))
    or (select count(*) from jsonb_array_elements(after_content -> 'sources')) <>
      (select count(distinct (value ->> 'provider',value ->> 'url')) from jsonb_array_elements(after_content -> 'sources')) then
    raise exception 'Wells repair must preserve existing structured sources without duplicates' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('literary-archive-atomic-release-v1',20260902));
  lock table public.literary_work_authors, public.literary_work_translations,
    public.literary_work_sources, public.literary_work_external_ids, public.book_editions,
    public.literary_work_cover_artworks, public.literary_archive_child_edit_preservations,
    public.literary_archive_child_edit_preservation_controls, public.literary_works,
    public.literary_work_evidence_v2_attestations, public.literary_work_evidence_v2_controls
    in share row exclusive mode nowait;
  select * into strict control from public.literary_work_evidence_v2_controls where singleton for update nowait;
  original_control := to_jsonb(control);
  if control.contract_version is distinct from 'book-evidence-v2'
    or control.validator_id is distinct from 'src/data/bookEvidence.ts#bookEvidenceV2Issues'
    or control.validator_version is distinct from 'book-evidence-v2-validator-v1'
    or control.validator_sha256 is distinct from 'f2ef2c46ae78be553a190057f8833c5661dc1cbcc1902564708effa7f6db0026'
    or control.canon_registry_version is distinct from 'world-canon-2026-09-v2'
    or control.canon_registry_sha256 not in ('d0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef','c8d2b6862c47c3215295951d2c5d1c406913b9879c616f1d8b787c6e05029f6c') then
    raise exception 'Wells repair active Evidence V2 identity is unknown' using errcode = '23514';
  end if;
  select * into current_work from public.literary_works where id = target_id for update nowait;
  if not found or current_work.legacy_id is distinct from target_key or current_work.country_id is distinct from 'england'
    or current_work.writer_id is distinct from 'h_g_wells' or current_work.is_cms_locked is distinct from true then
    raise exception 'Wells repair fixed work identity or CMS lock changed' using errcode = '40001';
  end if;
  live_content := public.literary_work_evidence_v2_content(target_id);
  if live_content = after_content and public.literary_work_evidence_v2_sha256(live_content::text) = after_sha
    and public.is_literary_work_evidence_v2_attested(target_id) then
    return jsonb_build_object('contract','wells-editorial-repair-20260913','workId',target_id,
      'contentSha256',after_sha,'attested',true,'idempotent',true,'status','already-repaired');
  end if;
  if control.canon_registry_sha256 is distinct from 'd0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef'
    or current_work.updated_at is distinct from (p_packet ->> 'expectedUpdatedAt')::timestamptz
    or live_content is distinct from before_content
    or public.literary_work_evidence_v2_sha256(live_content::text) is distinct from before_sha then
    raise exception 'Wells repair live content or old-registry precondition is stale' using errcode = '40001';
  end if;
  work_protected := to_jsonb(current_work) - array['title','metadata','updated_at'];
  select jsonb_agg(to_jsonb(row) - array['title','description','source_urls','reviewed_at','metadata','updated_at'] order by row.locale)
  into translations_protected from public.literary_work_translations row where row.work_id = target_id;
  select coalesce(jsonb_agg(to_jsonb(row) order by row.id),'[]'::jsonb)
  into sources_preserved from public.literary_work_sources row where row.work_id = target_id;
  previous_atomic_mode := coalesce(current_setting('probpera.literary_archive_atomic_release',true),'');
  perform pg_catalog.set_config('probpera.literary_archive_atomic_release','on',true);

  update public.literary_works set title = after_content #>> '{work,title}', metadata = after_content #> '{work,metadata}'
  where id = target_id and is_cms_locked;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Wells repair parent update lost its exact target' using errcode = '40001'; end if;
  for new_translation in select value from jsonb_array_elements(after_content -> 'translations') loop
    update public.literary_work_translations set title = new_translation ->> 'title',
      description = new_translation ->> 'description',
      source_urls = array(select jsonb_array_elements_text(new_translation -> 'sourceUrls')),
      reviewed_at = (new_translation ->> 'reviewedAt')::date, metadata = new_translation -> 'metadata'
    where work_id = target_id and locale = new_translation ->> 'locale';
    get diagnostics changed = row_count;
    if changed <> 1 then raise exception 'Wells repair translation coverage changed' using errcode = '40001'; end if;
  end loop;
  for source_row in select value from jsonb_array_elements(after_content -> 'sources') loop
    if not exists(select 1 from jsonb_array_elements(before_content -> 'sources') old_source where old_source = source_row) then
      insert into public.literary_work_sources(work_id,provider,source_url,field_names,license_name,usage,retrieved_at,metadata)
      values(target_id,source_row ->> 'provider',source_row ->> 'url',
        array(select jsonb_array_elements_text(source_row -> 'fields')),source_row ->> 'license',
        source_row ->> 'usage',(source_row ->> 'retrievedAt')::date,source_row -> 'metadata');
    end if;
  end loop;
  if (select to_jsonb(row) - array['title','metadata','updated_at'] from public.literary_works row where row.id = target_id) is distinct from work_protected
    or (select jsonb_agg(to_jsonb(row) - array['title','description','source_urls','reviewed_at','metadata','updated_at'] order by row.locale)
      from public.literary_work_translations row where row.work_id = target_id) is distinct from translations_protected
    or exists(select 1 from jsonb_array_elements(sources_preserved) old_source
      where not exists(select 1 from public.literary_work_sources row where row.work_id = target_id and to_jsonb(row) = old_source)) then
    raise exception 'Wells repair modified protected storage or prior source history' using errcode = '23514';
  end if;
  live_content := public.literary_work_evidence_v2_content(target_id);
  if live_content is distinct from after_content or public.literary_work_evidence_v2_sha256(live_content::text) is distinct from after_sha then
    raise exception 'Wells repair output differs from the exact reviewed revision' using errcode = '23514';
  end if;
  proof_receipt := public.attest_literary_work_evidence_v2(target_id,after_sha,live_content,
    p_packet -> 'evidence',reviewed_by,reviewed_on);
  if not public.is_literary_work_evidence_v2_attested(target_id)
    or (select to_jsonb(row) from public.literary_work_evidence_v2_controls row where singleton) is distinct from original_control then
    raise exception 'Wells repair failed its attestation or changed the publication controls' using errcode = '23514';
  end if;
  perform pg_catalog.set_config('probpera.literary_archive_atomic_release',previous_atomic_mode,true);
  return proof_receipt || jsonb_build_object('contract','wells-editorial-repair-20260913',
    'workId',target_id,'contentSha256',after_sha,'attested',true,'idempotent',false,'status','repaired');
end;
$$;

revoke all on function public.repair_wells_editorial_evidence_20260913(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.repair_wells_editorial_evidence_20260913(jsonb) to service_role;
