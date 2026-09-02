-- Fail-closed publication attestations for the work-level Evidence V2 contract.
-- Enforcement is installed in shadow mode and can be enabled only after every
-- record accepted by the predecessor gate has a current content-bound proof.

-- Supabase normally installs pgcrypto in extensions, while a plain PostgreSQL
-- bootstrap may install it in public. Resolve the extension-owned digest
-- function once at migration time instead of trusting either search path.
do $literary_work_evidence_v2_sha256_helper$
declare
  pgcrypto_schema name;
begin
  select namespace.nspname
  into pgcrypto_schema
  from pg_catalog.pg_extension extension_record
  join pg_catalog.pg_namespace namespace
    on namespace.oid = extension_record.extnamespace
  where extension_record.extname = 'pgcrypto';

  if pgcrypto_schema is null then
    raise exception 'pgcrypto extension is required for Evidence V2'
      using errcode = '55000';
  end if;

  execute format(
    $definition$
      create or replace function public.literary_work_evidence_v2_sha256(
        p_payload text
      )
      returns text
      language sql
      immutable
      strict
      security invoker
      set search_path = ''
      as $function$
        select pg_catalog.encode(
          %I.digest(
            pg_catalog.convert_to(p_payload, 'UTF8'),
            'sha256'
          ),
          'hex'
        )
      $function$
    $definition$,
    pgcrypto_schema
  );
end;
$literary_work_evidence_v2_sha256_helper$;

revoke all on function public.literary_work_evidence_v2_sha256(text)
  from public, anon, authenticated, service_role;

create table if not exists public.literary_work_evidence_v2_controls (
  singleton boolean primary key default true check (singleton),
  enforcement_enabled boolean not null default false,
  contract_version text not null default 'book-evidence-v2'
    check (contract_version = 'book-evidence-v2'),
  validator_id text not null
    default 'src/data/bookEvidence.ts#bookEvidenceV2Issues'
    check (
      validator_id = 'src/data/bookEvidence.ts#bookEvidenceV2Issues'
    ),
  validator_version text not null
    default 'book-evidence-v2-validator-v1'
    check (validator_version = 'book-evidence-v2-validator-v1'),
  -- Source-content hashes use canonical UTF-8 with CRLF/CR normalized to LF;
  -- validator_sha256 length-frames bookEvidence.ts and bookQuality.ts.
  validator_sha256 text not null
    default 'f2ef2c46ae78be553a190057f8833c5661dc1cbcc1902564708effa7f6db0026'
    check (validator_sha256 ~ '^[0-9a-f]{64}$'),
  canon_registry_version text not null
    default 'world-canon-2026-09-v2'
    check (canon_registry_version = 'world-canon-2026-09-v2'),
  canon_registry_sha256 text not null
    default 'd0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef'
    check (canon_registry_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.literary_work_evidence_v2_controls (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.literary_work_evidence_v2_attestations (
  work_id uuid primary key
    references public.literary_works(id) on update cascade on delete cascade,
  contract_version text not null
    check (contract_version = 'book-evidence-v2'),
  work_content_sha256 text not null
    check (work_content_sha256 ~ '^[0-9a-f]{64}$'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  evidence_sha256 text not null
    check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  reviewer text not null
    check (char_length(btrim(reviewer)) between 2 and 160),
  reviewed_at date not null check (reviewed_at <= current_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists literary_work_evidence_v2_content_idx
  on public.literary_work_evidence_v2_attestations(
    work_content_sha256,
    reviewed_at desc
  );

drop trigger if exists literary_work_evidence_v2_controls_set_updated_at
  on public.literary_work_evidence_v2_controls;
create trigger literary_work_evidence_v2_controls_set_updated_at
  before update on public.literary_work_evidence_v2_controls
  for each row execute function public.set_updated_at();

drop trigger if exists literary_work_evidence_v2_attestations_set_updated_at
  on public.literary_work_evidence_v2_attestations;
create trigger literary_work_evidence_v2_attestations_set_updated_at
  before update on public.literary_work_evidence_v2_attestations
  for each row execute function public.set_updated_at();

create or replace function public.literary_work_evidence_v2_content(
  target_work_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
          'work', jsonb_build_object(
            'legacyId', work.legacy_id,
            'countryId', work.country_id,
            'writerId', work.writer_id,
            'title', work.title,
            'slug', work.slug,
            'originalTitle', work.original_title,
            'firstPublished', work.first_published,
            'originalLanguage', work.original_language,
            'genres', work.genres,
            'tags', work.tags,
            'description', work.description,
            'sourceUrl', work.source_url,
            'editorialStatus', work.editorial_status,
            'reviewedAt', work.reviewed_at,
            'metadata', work.metadata,
            'authorshipKind', work.authorship_kind
          ),
          'translations', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'locale', translation.locale,
                'title', translation.title,
                'description', translation.description,
                'sourceLanguage', translation.source_language,
                'method', translation.translation_method,
                'status', translation.editorial_status,
                'sourceUrls', translation.source_urls,
                'reviewedAt', translation.reviewed_at,
                'metadata', translation.metadata
              ) order by translation.locale collate "C"
            )
            from public.literary_work_translations translation
            where translation.work_id = work.id
          ), '[]'::jsonb),
          'sources', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'provider', source.provider,
                'url', source.source_url,
                'fields', source.field_names,
                'license', source.license_name,
                'usage', source.usage,
                'retrievedAt', source.retrieved_at,
                'metadata', source.metadata
              ) order by
                source.provider collate "C",
                source.source_url collate "C"
            )
            from public.literary_work_sources source
            where source.work_id = work.id
          ), '[]'::jsonb),
          'externalIds', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'scheme', external_id.scheme,
                'value', external_id.external_id,
                'sourceUrl', external_id.source_url
              ) order by
                external_id.scheme collate "C",
                external_id.external_id collate "C"
            )
            from public.literary_work_external_ids external_id
            where external_id.work_id = work.id
          ), '[]'::jsonb),
          'authors', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'position', author.position,
                'countryId', author.writer_country_id,
                'writerId', author.writer_id,
                'creditNameRu', author.credit_name_ru,
                'creditNameEn', author.credit_name_en,
                'attribution', author.attribution_status,
                'metadata', author.metadata
              ) order by author.position
            )
            from public.literary_work_authors author
            where author.work_id = work.id
          ), '[]'::jsonb),
          'editions', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'legacyId', edition.legacy_id,
                'title', edition.title,
                'isbn10', edition.isbn_10,
                'isbn13', edition.isbn_13,
                'publisher', edition.publisher,
                'publicationYear', edition.publication_year,
                'language', edition.language,
                'format', edition.format,
                'pageCount', edition.page_count,
                'coverUrl', edition.cover_url,
                'coverSourceUrl', edition.cover_source_url,
                'coverRightsStatus', edition.cover_rights_status,
                'licenseName', edition.license_name,
                'licenseUrl', edition.license_url,
                'creator', edition.creator,
                'rightsHolder', edition.rights_holder,
                'rightsCheckedAt', edition.rights_checked_at,
                'sourceUrl', edition.source_url,
                'isPrimary', edition.is_primary,
                'metadata', edition.metadata
              ) order by edition.legacy_id collate "C"
            )
            from public.book_editions edition
            where edition.work_id = work.id
          ), '[]'::jsonb),
          'artworks', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'coverUrl', artwork.cover_url,
                'thumbnailUrl', artwork.thumbnail_url,
                'coverWidth', artwork.cover_width,
                'coverHeight', artwork.cover_height,
                'thumbnailWidth', artwork.thumbnail_width,
                'thumbnailHeight', artwork.thumbnail_height,
                'rightsStatus', artwork.rights_status,
                'coverSourceUrl', artwork.cover_source_url,
                'rightsCheckedAt', artwork.rights_checked_at,
                'sourceArchiveSha256', artwork.source_archive_sha256,
                'sourceImageSha256', artwork.source_image_sha256,
                'sourceFilename', artwork.source_filename,
                'sourceRelativePath', artwork.source_relative_path,
                'sourceIndex', artwork.source_index,
                'isPrimary', artwork.is_primary,
                'provenance', artwork.provenance
              ) order by
                artwork.source_archive_sha256 collate "C",
                artwork.source_image_sha256 collate "C"
            )
            from public.literary_work_cover_artworks artwork
            where artwork.work_id = work.id
          ), '[]'::jsonb)
  )
  from public.literary_works work
  where work.id = target_work_id;
$$;

revoke all on function public.literary_work_evidence_v2_content(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.literary_work_evidence_v2_content_sha256(
  target_work_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.literary_work_evidence_v2_sha256(
    public.literary_work_evidence_v2_content(target_work_id)::text
  );
$$;

revoke all on function
  public.literary_work_evidence_v2_content_sha256(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.literary_work_evidence_v2_content_sha256(uuid)
  to service_role;

create or replace function
  public.literary_work_evidence_v2_content_sha256_batch(
    p_work_ids uuid[]
  )
returns table(work_id uuid, content_sha256 text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requested_count integer;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if p_work_ids is null then
    raise exception 'Work IDs are required' using errcode = '22023';
  end if;
  requested_count := cardinality(p_work_ids);
  if requested_count > 500 then
    raise exception 'At most 500 work hashes are allowed per batch'
      using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_work_ids) listed(id) where id is null) then
    raise exception 'Null work IDs are not allowed' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(p_work_ids) listed(id)
    group by listed.id
    having count(*) > 1
  ) then
    raise exception 'A work may occur only once per hash batch'
      using errcode = '22023';
  end if;

  return query
  select
    requested.id,
    public.literary_work_evidence_v2_content_sha256(requested.id)
  from unnest(p_work_ids) with ordinality requested(id, position)
  order by requested.position;
end;
$$;

revoke all on function
  public.literary_work_evidence_v2_content_sha256_batch(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function
  public.literary_work_evidence_v2_content_sha256_batch(uuid[])
  to service_role;

create or replace function public.attest_literary_work_evidence_v2(
  p_work_id uuid,
  p_expected_content_sha256 text,
  p_expected_content jsonb,
  p_evidence jsonb,
  p_reviewer text,
  p_reviewed_at date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_content_sha256 text;
  current_content jsonb;
  normalized_reviewer text := nullif(btrim(p_reviewer), '');
  evidence_sha256 text;
  current_legacy_id text;
  current_canon jsonb;
  current_ru_title_evidence jsonb;
  current_en_title_evidence jsonb;
  current_ru_description text;
  current_en_description text;
  current_ru_description_provenance jsonb;
  current_en_description_provenance jsonb;
  control_contract_version text;
  control_validator_id text;
  control_validator_version text;
  control_validator_sha256 text;
  control_canon_registry_version text;
  control_canon_registry_sha256 text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if p_work_id is null
    or coalesce(p_expected_content_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Work and expected SHA-256 are required'
      using errcode = '22023';
  end if;
  if p_expected_content is null
    or jsonb_typeof(p_expected_content) <> 'object' then
    raise exception 'Expected work content must be a JSON object'
      using errcode = '22023';
  end if;
  if p_evidence is null or jsonb_typeof(p_evidence) <> 'object' then
    raise exception 'Evidence must be a JSON object' using errcode = '22023';
  end if;
  if p_evidence ->> 'contractVersion' is distinct from 'book-evidence-v2'
    or nullif(btrim(p_evidence ->> 'recordKey'), '') is null then
    raise exception 'Evidence contract version and record key are required'
      using errcode = '22023';
  end if;
  if p_evidence #>> '{validation,validator}' is distinct from
      'src/data/bookEvidence.ts#bookEvidenceV2Issues'
    or nullif(btrim(
      p_evidence #>> '{validation,validatorVersion}'
    ), '') is null
    or coalesce(
      p_evidence #>> '{validation,validatorSha256}',
      ''
    ) !~ '^[0-9a-f]{64}$'
    or p_evidence #>> '{validation,status}' is distinct from 'passed'
    or (
      case
        when jsonb_typeof(p_evidence #> '{validation,issues}') = 'array'
          then jsonb_array_length(p_evidence #> '{validation,issues}') <> 0
        else true
      end
    )
    or nullif(btrim(
      p_evidence #>> '{validation,canonRegistryVersion}'
    ), '') is null
    or coalesce(
      p_evidence #>> '{validation,canonRegistrySha256}',
      ''
    ) !~ '^[0-9a-f]{64}$' then
    raise exception 'Evidence must contain a zero-issue local V2 validation'
      using errcode = '23514';
  end if;
  if (
    case
      when jsonb_typeof(
        p_evidence #> '{localizedTitles,ru,evidence}'
      ) = 'array'
        then jsonb_array_length(
          p_evidence #> '{localizedTitles,ru,evidence}'
        ) < 2
      else true
    end
  ) or (
    case
      when jsonb_typeof(
        p_evidence #> '{localizedTitles,en,evidence}'
      ) = 'array'
        then jsonb_array_length(
          p_evidence #> '{localizedTitles,en,evidence}'
        ) < 2
      else true
    end
  ) then
    raise exception 'Both localized titles require at least two evidence records'
      using errcode = '23514';
  end if;
  if jsonb_typeof(p_evidence #> '{descriptions,ru}') is distinct from 'object'
    or jsonb_typeof(
      p_evidence #> '{descriptions,en}'
    ) is distinct from 'object'
    or (
      case
        when jsonb_typeof(
          p_evidence #> '{descriptions,ru,sourceUrls}'
        ) = 'array'
          then jsonb_array_length(
            p_evidence #> '{descriptions,ru,sourceUrls}'
          ) < 2
        else true
      end
    )
    or (
      case
        when jsonb_typeof(
          p_evidence #> '{descriptions,en,sourceUrls}'
        ) = 'array'
          then jsonb_array_length(
            p_evidence #> '{descriptions,en,sourceUrls}'
          ) < 2
        else true
      end
    )
    or coalesce(
      p_evidence #>> '{descriptions,ru,descriptionSha256}',
      ''
    ) !~ '^[0-9a-f]{64}$'
    or coalesce(
      p_evidence #>> '{descriptions,en,descriptionSha256}',
      ''
    ) !~ '^[0-9a-f]{64}$'
    or coalesce(
      p_evidence #>> '{descriptions,en,translatedFromSourceHash}',
      ''
    ) !~ '^[0-9a-f]{64}$' then
    raise exception 'Both descriptions require complete provenance'
      using errcode = '23514';
  end if;
  if normalized_reviewer is null
    or char_length(normalized_reviewer) not between 2 and 160
    or p_reviewed_at is null
    or p_reviewed_at > current_date then
    raise exception 'Reviewer and valid review date are required'
      using errcode = '22023';
  end if;
  if p_evidence #>> '{validation,reviewer}' is distinct from
      normalized_reviewer
    or p_evidence #>> '{validation,reviewedAt}' is distinct from
      p_reviewed_at::text then
    raise exception 'Attestation reviewer does not match local evidence'
      using errcode = '23514';
  end if;

  -- Serialize attestation with every invalidation for the same work. This
  -- closes the race in which a related row changed after hashing but before
  -- the attestation insert.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_work_id::text, 20260902)
  );

  select
    control.contract_version,
    control.validator_id,
    control.validator_version,
    control.validator_sha256,
    control.canon_registry_version,
    control.canon_registry_sha256
  into
    control_contract_version,
    control_validator_id,
    control_validator_version,
    control_validator_sha256,
    control_canon_registry_version,
    control_canon_registry_sha256
  from public.literary_work_evidence_v2_controls control
  where control.singleton
  for share;
  if not found then
    raise exception 'Evidence V2 control row is missing'
      using errcode = '55000';
  end if;
  if p_evidence ->> 'contractVersion' is distinct from
      control_contract_version
    or p_evidence #>> '{validation,validator}' is distinct from
      control_validator_id
    or p_evidence #>> '{validation,validatorVersion}' is distinct from
      control_validator_version
    or p_evidence #>> '{validation,validatorSha256}' is distinct from
      control_validator_sha256
    or p_evidence #>> '{validation,canonRegistryVersion}' is distinct from
      control_canon_registry_version
    or p_evidence #>> '{validation,canonRegistrySha256}' is distinct from
      control_canon_registry_sha256 then
    raise exception 'Evidence validator or canon registry identity is stale'
      using errcode = '23514';
  end if;

  select
    work.legacy_id,
    coalesce(work.metadata -> 'canon', 'null'::jsonb),
    coalesce(
      work.metadata #> '{localizedTitles,ru}',
      ru_translation.metadata -> 'titleEvidence'
    ),
    coalesce(
      work.metadata #> '{localizedTitles,en}',
      en_translation.metadata -> 'titleEvidence'
    ),
    ru_translation.description,
    en_translation.description,
    ru_translation.metadata -> 'descriptionProvenance',
    en_translation.metadata -> 'descriptionProvenance'
  into
    current_legacy_id,
    current_canon,
    current_ru_title_evidence,
    current_en_title_evidence,
    current_ru_description,
    current_en_description,
    current_ru_description_provenance,
    current_en_description_provenance
  from public.literary_works work
  left join public.literary_work_translations ru_translation
    on ru_translation.work_id = work.id
   and ru_translation.locale = 'ru'
  left join public.literary_work_translations en_translation
    on en_translation.work_id = work.id
   and en_translation.locale = 'en'
  where work.id = p_work_id;

  current_content := public.literary_work_evidence_v2_content(p_work_id);
  current_content_sha256 :=
    public.literary_work_evidence_v2_sha256(current_content::text);
  if current_legacy_id is null or current_content is null
    or current_content_sha256 is null then
    raise exception 'Literary work not found' using errcode = 'P0002';
  end if;
  if current_content is distinct from p_expected_content
    or public.literary_work_evidence_v2_sha256(p_expected_content::text)
      is distinct from p_expected_content_sha256 then
    raise exception 'Database content differs from the local V2 projection'
      using errcode = '40001';
  end if;
  if current_content_sha256 <> p_expected_content_sha256 then
    raise exception 'Literary work changed after local evidence validation'
      using errcode = '40001';
  end if;
  if p_evidence ->> 'recordKey' is distinct from current_legacy_id then
    raise exception 'Evidence record key does not match the work'
      using errcode = '23514';
  end if;
  if p_evidence #> '{localizedTitles,ru}' is distinct from
      current_ru_title_evidence
    or p_evidence #> '{localizedTitles,en}' is distinct from
      current_en_title_evidence then
    raise exception 'Localized-title evidence does not match stored content'
      using errcode = '23514';
  end if;
  if p_evidence #>> '{descriptions,ru,descriptionSha256}' is distinct from
      public.literary_work_evidence_v2_sha256(current_ru_description)
    or p_evidence #>> '{descriptions,en,descriptionSha256}' is distinct from
      public.literary_work_evidence_v2_sha256(current_en_description)
    or p_evidence #>> '{descriptions,en,translatedFromSourceHash}'
      is distinct from
      p_evidence #>> '{descriptions,ru,descriptionSha256}'
    or (p_evidence #> '{descriptions,ru}') - 'descriptionSha256'
      is distinct from current_ru_description_provenance
    or (p_evidence #> '{descriptions,en}') - 'descriptionSha256'
      is distinct from current_en_description_provenance then
    raise exception 'Description evidence does not match stored content'
      using errcode = '23514';
  end if;
  if coalesce(p_evidence -> 'canon', 'null'::jsonb)
      is distinct from current_canon then
    raise exception 'Canon evidence does not match stored content'
      using errcode = '23514';
  end if;

  evidence_sha256 :=
    public.literary_work_evidence_v2_sha256(p_evidence::text);
  insert into public.literary_work_evidence_v2_attestations (
    work_id,
    contract_version,
    work_content_sha256,
    evidence,
    evidence_sha256,
    reviewer,
    reviewed_at
  ) values (
    p_work_id,
    control_contract_version,
    current_content_sha256,
    p_evidence,
    evidence_sha256,
    normalized_reviewer,
    p_reviewed_at
  )
  on conflict (work_id) do update set
    contract_version = excluded.contract_version,
    work_content_sha256 = excluded.work_content_sha256,
    evidence = excluded.evidence,
    evidence_sha256 = excluded.evidence_sha256,
    reviewer = excluded.reviewer,
    reviewed_at = excluded.reviewed_at;

  return jsonb_build_object(
    'workId', p_work_id,
    'contentSha256', current_content_sha256,
    'evidenceSha256', evidence_sha256,
    'attested', true
  );
end;
$$;

revoke all on function public.attest_literary_work_evidence_v2(
  uuid, text, jsonb, jsonb, text, date
) from public, anon, authenticated, service_role;
grant execute on function public.attest_literary_work_evidence_v2(
  uuid, text, jsonb, jsonb, text, date
) to service_role;

create or replace function public.sync_literary_work_evidence_v2_batch(
  p_attestations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  processed integer;
  locked_work_id uuid;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if p_attestations is null or jsonb_typeof(p_attestations) <> 'array' then
    raise exception 'Attestations must be a JSON array' using errcode = '22023';
  end if;
  processed := jsonb_array_length(p_attestations);
  if processed > 500 then
    raise exception 'At most 500 attestations are allowed per batch'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_attestations) listed(value)
    where jsonb_typeof(listed.value) <> 'object'
      or nullif(btrim(listed.value ->> 'workId'), '') is null
  ) then
    raise exception 'Every attestation must be an object with a work ID'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_attestations) listed(value)
    group by (listed.value ->> 'workId')::uuid
    having count(*) > 1
  ) then
    raise exception 'A work may occur only once per attestation batch'
      using errcode = '22023';
  end if;

  -- Every lock held by this transaction is acquired in UUID order. Two
  -- overlapping batches therefore cannot deadlock by presenting reversed
  -- client-side arrays, and child-row move triggers use the same ordering.
  for locked_work_id in
    select (listed.value ->> 'workId')::uuid
    from jsonb_array_elements(p_attestations) listed(value)
    order by (listed.value ->> 'workId')::uuid
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(locked_work_id::text, 20260902)
    );
  end loop;

  for item in
    select listed.value
    from jsonb_array_elements(p_attestations) listed(value)
    order by (listed.value ->> 'workId')::uuid
  loop
    perform public.attest_literary_work_evidence_v2(
      (item ->> 'workId')::uuid,
      item ->> 'expectedContentSha256',
      item -> 'expectedContent',
      item -> 'evidence',
      item ->> 'reviewer',
      (item ->> 'reviewedAt')::date
    );
  end loop;
  return jsonb_build_object('processed', processed, 'attested', processed);
end;
$$;

revoke all on function
  public.sync_literary_work_evidence_v2_batch(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function
  public.sync_literary_work_evidence_v2_batch(jsonb)
  to service_role;

create or replace function public.invalidate_literary_work_evidence_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_work_ids uuid[];
  locked_work_id uuid;
begin
  if tg_table_name = 'literary_works' then
    target_work_ids := case
      when tg_op = 'INSERT' then array[new.id]
      when tg_op = 'DELETE' then array[old.id]
      else array[old.id, new.id]
    end;
  elsif tg_op = 'INSERT' then
    target_work_ids := array[new.work_id];
  elsif tg_op = 'DELETE' then
    target_work_ids := array[old.work_id];
  else
    -- Moving a child row changes the content of both parent works. Lock in a
    -- deterministic order to avoid deadlocks between opposing moves.
    target_work_ids := array[old.work_id, new.work_id];
  end if;

  for locked_work_id in
    select distinct listed.work_id
    from unnest(target_work_ids) listed(work_id)
    where listed.work_id is not null
    order by listed.work_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(locked_work_id::text, 20260902)
    );
  end loop;

  delete from public.literary_work_evidence_v2_attestations attestation
  where attestation.work_id = any(target_work_ids);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.invalidate_literary_work_evidence_v2()
  from public, anon, authenticated, service_role;

drop trigger if exists literary_works_invalidate_evidence_v2
  on public.literary_works;
create trigger literary_works_invalidate_evidence_v2
  after update on public.literary_works
  for each row execute function public.invalidate_literary_work_evidence_v2();

drop trigger if exists literary_work_translations_invalidate_evidence_v2
  on public.literary_work_translations;
create trigger literary_work_translations_invalidate_evidence_v2
  after insert or update or delete on public.literary_work_translations
  for each row execute function public.invalidate_literary_work_evidence_v2();

drop trigger if exists literary_work_sources_invalidate_evidence_v2
  on public.literary_work_sources;
create trigger literary_work_sources_invalidate_evidence_v2
  after insert or update or delete on public.literary_work_sources
  for each row execute function public.invalidate_literary_work_evidence_v2();

drop trigger if exists literary_work_external_ids_invalidate_evidence_v2
  on public.literary_work_external_ids;
create trigger literary_work_external_ids_invalidate_evidence_v2
  after insert or update or delete on public.literary_work_external_ids
  for each row execute function public.invalidate_literary_work_evidence_v2();

drop trigger if exists literary_work_authors_invalidate_evidence_v2
  on public.literary_work_authors;
create trigger literary_work_authors_invalidate_evidence_v2
  after insert or update or delete on public.literary_work_authors
  for each row execute function public.invalidate_literary_work_evidence_v2();

drop trigger if exists book_editions_invalidate_evidence_v2
  on public.book_editions;
create trigger book_editions_invalidate_evidence_v2
  after insert or update or delete on public.book_editions
  for each row execute function public.invalidate_literary_work_evidence_v2();

drop trigger if exists literary_work_cover_artworks_invalidate_evidence_v2
  on public.literary_work_cover_artworks;
create trigger literary_work_cover_artworks_invalidate_evidence_v2
  after insert or update or delete on public.literary_work_cover_artworks
  for each row execute function public.invalidate_literary_work_evidence_v2();

create or replace function public.is_literary_work_evidence_v2_attested(
  target_work_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.literary_work_evidence_v2_attestations attestation
    join public.literary_work_evidence_v2_controls control
      on control.singleton
    where attestation.work_id = target_work_id
      and attestation.contract_version = control.contract_version
      and attestation.evidence ->> 'contractVersion' =
        control.contract_version
      and attestation.evidence #>> '{validation,validator}' =
        control.validator_id
      and attestation.evidence #>> '{validation,validatorVersion}' =
        control.validator_version
      and attestation.evidence #>> '{validation,validatorSha256}' =
        control.validator_sha256
      and attestation.evidence #>> '{validation,canonRegistryVersion}' =
        control.canon_registry_version
      and attestation.evidence #>> '{validation,canonRegistrySha256}' =
        control.canon_registry_sha256
      and attestation.evidence_sha256 =
        public.literary_work_evidence_v2_sha256(attestation.evidence::text)
      and attestation.work_content_sha256 =
        public.literary_work_evidence_v2_content_sha256(target_work_id)
  );
$$;

revoke all on function public.is_literary_work_evidence_v2_attested(uuid)
  from public, anon, authenticated, service_role;

do $literary_work_evidence_v2_publication_predecessor$
declare
  predecessor_definition text;
begin
  if to_regprocedure(
    'public.is_publishable_literary_work_pre_evidence_v2(uuid)'
  ) is null then
    if to_regprocedure('public.is_publishable_literary_work(uuid)') is null then
      raise exception 'preceding literary-work publication gate is missing';
    end if;
    select pg_catalog.pg_get_functiondef(
      to_regprocedure('public.is_publishable_literary_work(uuid)')::oid
    ) into predecessor_definition;
    if position(
      'FUNCTION public.is_publishable_literary_work('
      in predecessor_definition
    ) = 0 then
      raise exception 'preceding publication gate cannot be cloned safely';
    end if;
    execute replace(
      predecessor_definition,
      'FUNCTION public.is_publishable_literary_work(',
      'FUNCTION public.is_publishable_literary_work_pre_evidence_v2('
    );
  end if;
end;
$literary_work_evidence_v2_publication_predecessor$;

revoke all on function
  public.is_publishable_literary_work_pre_evidence_v2(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.is_publishable_literary_work(
  target_work_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_publishable_literary_work_pre_evidence_v2(target_work_id)
    and (
      not coalesce((
        select control.enforcement_enabled
        from public.literary_work_evidence_v2_controls control
        where control.singleton
      ), false)
      or public.is_literary_work_evidence_v2_attested(target_work_id)
    );
$$;

revoke all on function public.is_publishable_literary_work(uuid) from public;
grant execute on function public.is_publishable_literary_work(uuid)
  to anon, authenticated;

-- CREATE OR REPLACE preserves the wrapper's original OID for unknown database
-- dependants. Recreate every known policy as defence in depth and bring the
-- edition policy, which checked only editorial_status, under the same gate.
drop policy if exists "Public read publishable literary works"
  on public.literary_works;
create policy "Public read publishable literary works"
on public.literary_works for select
to anon, authenticated
using (public.is_publishable_literary_work(id));

drop policy if exists "Public read publishable work translations"
  on public.literary_work_translations;
create policy "Public read publishable work translations"
on public.literary_work_translations for select
to anon, authenticated
using (public.is_publishable_literary_work(work_id));

drop policy if exists "Public read publishable work sources"
  on public.literary_work_sources;
create policy "Public read publishable work sources"
on public.literary_work_sources for select
to anon, authenticated
using (public.is_publishable_literary_work(work_id));

drop policy if exists "Public read publishable work external ids"
  on public.literary_work_external_ids;
create policy "Public read publishable work external ids"
on public.literary_work_external_ids for select
to anon, authenticated
using (public.is_publishable_literary_work(work_id));

drop policy if exists "Public read verified book editions"
  on public.book_editions;
create policy "Public read verified book editions"
on public.book_editions for select
to anon, authenticated
using (
  (
    cover_url is null
    or (
      cover_rights_status <> 'unverified'
      and cover_source_url is not null
      and rights_checked_at is not null
    )
  )
  and public.is_publishable_literary_work(work_id)
);

drop policy if exists "Public read publishable literary work artwork"
  on public.literary_work_cover_artworks;
create policy "Public read publishable literary work artwork"
on public.literary_work_cover_artworks for select
to anon, authenticated
using (
  rights_status = 'editorial-original'
  and rights_checked_at is not null
  and public.is_publishable_literary_work(work_id)
);

drop policy if exists "Public read publishable literary work authors"
  on public.literary_work_authors;
create policy "Public read publishable literary work authors"
on public.literary_work_authors for select
to anon, authenticated
using (public.is_publishable_literary_work(work_id));

create or replace function
  public.literary_work_evidence_v2_predecessor_manifest_sha256()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.literary_work_evidence_v2_sha256(
    coalesce(
      jsonb_agg(work.id::text order by work.id),
      '[]'::jsonb
    )::text
  )
  from public.literary_works work
  where public.is_publishable_literary_work_pre_evidence_v2(work.id);
$$;

revoke all on function
  public.literary_work_evidence_v2_predecessor_manifest_sha256()
  from public, anon, authenticated, service_role;

create or replace function public.set_literary_work_evidence_v2_enforcement(
  p_enabled boolean,
  p_expected_predecessor_manifest_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  predecessor_public_count integer;
  predecessor_manifest_sha256 text;
  invalid_attestation_count integer;
  control_contract_version text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if p_enabled is null
    or coalesce(p_expected_predecessor_manifest_sha256, '')
      !~ '^[0-9a-f]{64}$' then
    raise exception 'Enabled flag and expected public manifest are required'
      using errcode = '22023';
  end if;

  -- The switch must observe one stable predecessor-public set. SHARE blocks
  -- every INSERT/UPDATE/DELETE until the checked control update commits, while
  -- ordinary public reads continue without interruption. Tables are locked
  -- before the control row so the standalone switch and the stronger atomic
  -- release RPC use one deadlock-safe child-tables → parent → evidence order,
  -- matching ordinary child mutations that obtain RowExclusive before their
  -- parent-integrity trigger runs.
  lock table
    public.literary_work_authors,
    public.literary_work_translations,
    public.literary_work_sources,
    public.literary_work_external_ids,
    public.book_editions,
    public.literary_work_cover_artworks,
    public.literary_works,
    public.literary_work_evidence_v2_attestations
  in share mode;

  select control.contract_version
  into control_contract_version
  from public.literary_work_evidence_v2_controls control
  where control.singleton
  for update;
  if not found or control_contract_version <> 'book-evidence-v2' then
    raise exception 'Evidence V2 control row is missing or invalid'
      using errcode = '55000';
  end if;

  select count(*)::integer
  into predecessor_public_count
  from public.literary_works work
  where public.is_publishable_literary_work_pre_evidence_v2(work.id);
  predecessor_manifest_sha256 :=
    public.literary_work_evidence_v2_predecessor_manifest_sha256();
  if predecessor_manifest_sha256 is distinct from
      p_expected_predecessor_manifest_sha256 then
    raise exception 'Predecessor public manifest changed: expected %, found %',
      p_expected_predecessor_manifest_sha256,
      predecessor_manifest_sha256
      using errcode = '40001';
  end if;

  select count(*)::integer
  into invalid_attestation_count
  from public.literary_works work
  where public.is_publishable_literary_work_pre_evidence_v2(work.id)
    and not public.is_literary_work_evidence_v2_attested(work.id);
  if p_enabled and invalid_attestation_count <> 0 then
    raise exception 'Evidence V2 rollout blocked by % unattested public works',
      invalid_attestation_count
      using errcode = '23514';
  end if;

  update public.literary_work_evidence_v2_controls control
  set
    enforcement_enabled = p_enabled,
    updated_by = (select auth.uid())
  where control.singleton;
  return jsonb_build_object(
    'enabled', p_enabled,
    'predecessorPublic', predecessor_public_count,
    'predecessorManifestSha256', predecessor_manifest_sha256,
    'invalidAttestations', invalid_attestation_count
  );
end;
$$;

revoke all on function public.set_literary_work_evidence_v2_enforcement(
  boolean, text
) from public, anon, authenticated, service_role;
grant execute on function public.set_literary_work_evidence_v2_enforcement(
  boolean, text
) to service_role;

alter table public.literary_work_evidence_v2_controls enable row level security;
alter table public.literary_work_evidence_v2_controls force row level security;
alter table public.literary_work_evidence_v2_attestations enable row level security;
alter table public.literary_work_evidence_v2_attestations force row level security;

revoke all on table public.literary_work_evidence_v2_controls
  from public, anon, authenticated, service_role;
revoke all on table public.literary_work_evidence_v2_attestations
  from public, anon, authenticated, service_role;
grant select on table public.literary_work_evidence_v2_controls
  to authenticated;
grant select on table public.literary_work_evidence_v2_attestations
  to authenticated;
-- service_role can read rollout state, but all writes remain RPC-only. Direct
-- table grants here would allow bypassing content checks or atomic enablement.
grant select on table public.literary_work_evidence_v2_controls
  to service_role;
grant select on table public.literary_work_evidence_v2_attestations
  to service_role;

drop policy if exists "Staff read literary work evidence V2 controls"
  on public.literary_work_evidence_v2_controls;
create policy "Staff read literary work evidence V2 controls"
on public.literary_work_evidence_v2_controls for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff read literary work evidence V2 attestations"
  on public.literary_work_evidence_v2_attestations;
create policy "Staff read literary work evidence V2 attestations"
on public.literary_work_evidence_v2_attestations for select
to authenticated
using (public.is_staff());

-- This is deliberately separate from the staff-facing aggregate health RPC.
-- Synchronizers authenticate as service_role and must receive an explicit,
-- exception-backed contract rather than treating a NULL staff payload as OK.
create or replace function public.assert_literary_work_evidence_v2_health(
  p_expected_contract_version text,
  p_expected_validator_version text,
  p_expected_validator_sha256 text,
  p_expected_canon_registry_version text,
  p_expected_canon_registry_sha256 text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  control_record public.literary_work_evidence_v2_controls%rowtype;
  controls_rls_forced boolean := false;
  attestations_rls_forced boolean := false;
  rpc_only_evidence_writes boolean := false;
  policy_count integer := 0;
  invalidation_trigger_count integer := 0;
  predecessor_public_count integer := 0;
  invalid_attestation_count integer := 0;
  predecessor_manifest_sha256 text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if nullif(btrim(p_expected_contract_version), '') is null
    or nullif(btrim(p_expected_validator_version), '') is null
    or coalesce(p_expected_validator_sha256, '') !~ '^[0-9a-f]{64}$'
    or nullif(btrim(p_expected_canon_registry_version), '') is null
    or coalesce(p_expected_canon_registry_sha256, '')
      !~ '^[0-9a-f]{64}$' then
    raise exception 'Exact local Evidence V2 identities are required'
      using errcode = '22023';
  end if;

  select control.*
  into control_record
  from public.literary_work_evidence_v2_controls control
  where control.singleton;
  if not found then
    raise exception 'Evidence V2 control row is missing'
      using errcode = '55000';
  end if;
  if control_record.contract_version is distinct from
      p_expected_contract_version
    or control_record.validator_id is distinct from
      'src/data/bookEvidence.ts#bookEvidenceV2Issues'
    or control_record.validator_version is distinct from
      p_expected_validator_version
    or control_record.validator_sha256 is distinct from
      p_expected_validator_sha256
    or control_record.canon_registry_version is distinct from
      p_expected_canon_registry_version
    or control_record.canon_registry_sha256 is distinct from
      p_expected_canon_registry_sha256 then
    raise exception 'Database Evidence V2 identities differ from local files'
      using errcode = '55000';
  end if;

  select relation.relrowsecurity and relation.relforcerowsecurity
  into controls_rls_forced
  from pg_catalog.pg_class relation
  where relation.oid =
    'public.literary_work_evidence_v2_controls'::regclass;
  select relation.relrowsecurity and relation.relforcerowsecurity
  into attestations_rls_forced
  from pg_catalog.pg_class relation
  where relation.oid =
    'public.literary_work_evidence_v2_attestations'::regclass;

  rpc_only_evidence_writes :=
    to_regprocedure(
      'public.attest_literary_work_evidence_v2(uuid,text,jsonb,jsonb,text,date)'
    ) is not null
    and to_regprocedure(
      'public.sync_literary_work_evidence_v2_batch(jsonb)'
    ) is not null
    and to_regprocedure(
      'public.set_literary_work_evidence_v2_enforcement(boolean,text)'
    ) is not null
    and has_function_privilege(
      'service_role',
      'public.attest_literary_work_evidence_v2(uuid,text,jsonb,jsonb,text,date)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.sync_literary_work_evidence_v2_batch(jsonb)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.set_literary_work_evidence_v2_enforcement(boolean,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.attest_literary_work_evidence_v2(uuid,text,jsonb,jsonb,text,date)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.sync_literary_work_evidence_v2_batch(jsonb)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.set_literary_work_evidence_v2_enforcement(boolean,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.attest_literary_work_evidence_v2(uuid,text,jsonb,jsonb,text,date)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.sync_literary_work_evidence_v2_batch(jsonb)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.set_literary_work_evidence_v2_enforcement(boolean,text)',
      'EXECUTE'
    )
    and not exists (
      select 1
      from unnest(array['anon', 'authenticated', 'service_role'])
        client_role(role_name)
      cross join unnest(array['INSERT', 'UPDATE', 'DELETE'])
        mutation_privilege(privilege_name)
      cross join unnest(array[
        'public.literary_work_evidence_v2_controls',
        'public.literary_work_evidence_v2_attestations'
      ]) evidence_relation(relation_name)
      where has_table_privilege(
        client_role.role_name,
        evidence_relation.relation_name,
        mutation_privilege.privilege_name
      )
    );

  select count(*)::integer
  into invalidation_trigger_count
  from pg_catalog.pg_trigger invalidation_trigger
  where not invalidation_trigger.tgisinternal
    and invalidation_trigger.tgfoid =
      'public.invalidate_literary_work_evidence_v2()'::regprocedure
    and (
      invalidation_trigger.tgrelid,
      invalidation_trigger.tgname
    ) in (
      (
        'public.literary_works'::regclass,
        'literary_works_invalidate_evidence_v2'
      ),
      (
        'public.literary_work_translations'::regclass,
        'literary_work_translations_invalidate_evidence_v2'
      ),
      (
        'public.literary_work_sources'::regclass,
        'literary_work_sources_invalidate_evidence_v2'
      ),
      (
        'public.literary_work_external_ids'::regclass,
        'literary_work_external_ids_invalidate_evidence_v2'
      ),
      (
        'public.literary_work_authors'::regclass,
        'literary_work_authors_invalidate_evidence_v2'
      ),
      (
        'public.book_editions'::regclass,
        'book_editions_invalidate_evidence_v2'
      ),
      (
        'public.literary_work_cover_artworks'::regclass,
        'literary_work_cover_artworks_invalidate_evidence_v2'
      )
    );

  select count(*)::integer
  into policy_count
  from pg_catalog.pg_policies policy_record
  where policy_record.schemaname = 'public'
    and (
      policy_record.tablename,
      policy_record.policyname
    ) in (
      ('literary_works', 'Public read publishable literary works'),
      (
        'literary_work_translations',
        'Public read publishable work translations'
      ),
      ('literary_work_sources', 'Public read publishable work sources'),
      (
        'literary_work_external_ids',
        'Public read publishable work external ids'
      ),
      ('book_editions', 'Public read verified book editions'),
      (
        'literary_work_cover_artworks',
        'Public read publishable literary work artwork'
      ),
      (
        'literary_work_authors',
        'Public read publishable literary work authors'
      )
    )
    and policy_record.qual like '%is_publishable_literary_work(%'
    and policy_record.qual not like
      '%is_publishable_literary_work_pre_evidence_v2(%';

  select count(*)::integer
  into predecessor_public_count
  from public.literary_works work
  where public.is_publishable_literary_work_pre_evidence_v2(work.id);
  select count(*)::integer
  into invalid_attestation_count
  from public.literary_works work
  where public.is_publishable_literary_work_pre_evidence_v2(work.id)
    and not public.is_literary_work_evidence_v2_attested(work.id);
  predecessor_manifest_sha256 :=
    public.literary_work_evidence_v2_predecessor_manifest_sha256();

  if controls_rls_forced is distinct from true
    or attestations_rls_forced is distinct from true
    or rpc_only_evidence_writes is distinct from true
    or policy_count <> 7
    or invalidation_trigger_count <> 7
    or coalesce(predecessor_manifest_sha256, '') !~ '^[0-9a-f]{64}$'
    or (
      control_record.enforcement_enabled
      and invalid_attestation_count <> 0
    ) then
    raise exception 'Evidence V2 database invariants are not healthy'
      using errcode = '55000';
  end if;

  return jsonb_build_object(
    'ok', true,
    'schemaVersion', '20260902_literary_work_evidence_v2_attestations',
    'contractVersion', control_record.contract_version,
    'validatorVersion', control_record.validator_version,
    'canonRegistryVersion', control_record.canon_registry_version,
    'enforcementEnabled', control_record.enforcement_enabled,
    'rpcOnlyEvidenceWrites', rpc_only_evidence_writes,
    'controlsRlsForced', controls_rls_forced,
    'attestationsRlsForced', attestations_rls_forced,
    'policyCount', policy_count,
    'invalidationTriggerCount', invalidation_trigger_count,
    'predecessorPublicCount', predecessor_public_count,
    'invalidAttestationCount', invalid_attestation_count,
    'manifestSha256', predecessor_manifest_sha256
  );
end;
$$;

revoke all on function public.assert_literary_work_evidence_v2_health(
  text, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.assert_literary_work_evidence_v2_health(
  text, text, text, text, text
) to service_role;

-- Extend the accumulated staff-only health contract without overwriting the
-- predecessor's version marker; another same-day migration may be newer.
do $literary_work_evidence_v2_health_predecessor$
declare
  predecessor_definition text;
begin
  if to_regprocedure(
    'public.get_editorial_schema_health_pre_literary_work_evidence_v2()'
  ) is null then
    if to_regprocedure('public.get_editorial_schema_health()') is null then
      raise exception 'preceding editorial schema health RPC is missing';
    end if;
    select pg_catalog.pg_get_functiondef(
      to_regprocedure('public.get_editorial_schema_health()')::oid
    ) into predecessor_definition;
    if position(
      'FUNCTION public.get_editorial_schema_health('
      in predecessor_definition
    ) = 0 then
      raise exception 'preceding schema health RPC cannot be cloned safely';
    end if;
    execute replace(
      predecessor_definition,
      'FUNCTION public.get_editorial_schema_health(',
      'FUNCTION public.get_editorial_schema_health_pre_literary_work_evidence_v2('
    );
  end if;
end;
$literary_work_evidence_v2_health_predecessor$;

revoke all on function
  public.get_editorial_schema_health_pre_literary_work_evidence_v2()
  from public, anon, authenticated, service_role;

create or replace function public.get_editorial_schema_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_staff() then
    coalesce(
      public.get_editorial_schema_health_pre_literary_work_evidence_v2(),
      '{}'::jsonb
    ) || jsonb_build_object(
      'checkedAt', now(),
      'literaryWorkEvidenceV2',
        to_regclass(
          'public.literary_work_evidence_v2_attestations'
        ) is not null
        and to_regclass(
          'public.literary_work_evidence_v2_controls'
        ) is not null
        and to_regprocedure(
          'public.literary_work_evidence_v2_sha256(text)'
        ) is not null
        and to_regprocedure(
          'public.literary_work_evidence_v2_content(uuid)'
        ) is not null
        and to_regprocedure(
          'public.literary_work_evidence_v2_content_sha256(uuid)'
        ) is not null
        and to_regprocedure(
          'public.literary_work_evidence_v2_content_sha256_batch(uuid[])'
        ) is not null
        and to_regprocedure(
          'public.attest_literary_work_evidence_v2(uuid,text,jsonb,jsonb,text,date)'
        ) is not null
        and to_regprocedure(
          'public.sync_literary_work_evidence_v2_batch(jsonb)'
        ) is not null
        and to_regprocedure(
          'public.literary_work_evidence_v2_predecessor_manifest_sha256()'
        ) is not null
        and to_regprocedure(
          'public.set_literary_work_evidence_v2_enforcement(boolean,text)'
        ) is not null
        and to_regprocedure(
          'public.assert_literary_work_evidence_v2_health(text,text,text,text,text)'
        ) is not null
        and not has_function_privilege(
          'authenticated',
          'public.attest_literary_work_evidence_v2(uuid,text,jsonb,jsonb,text,date)',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.attest_literary_work_evidence_v2(uuid,text,jsonb,jsonb,text,date)',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.literary_work_evidence_v2_content_sha256_batch(uuid[])',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.sync_literary_work_evidence_v2_batch(jsonb)',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.set_literary_work_evidence_v2_enforcement(boolean,text)',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.assert_literary_work_evidence_v2_health(text,text,text,text,text)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.sync_literary_work_evidence_v2_batch(jsonb)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.set_literary_work_evidence_v2_enforcement(boolean,text)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.assert_literary_work_evidence_v2_health(text,text,text,text,text)',
          'EXECUTE'
        )
        and not has_table_privilege(
          'service_role',
          'public.literary_work_evidence_v2_controls',
          'INSERT'
        )
        and not has_table_privilege(
          'service_role',
          'public.literary_work_evidence_v2_controls',
          'UPDATE'
        )
        and not has_table_privilege(
          'service_role',
          'public.literary_work_evidence_v2_controls',
          'DELETE'
        )
        and not has_table_privilege(
          'service_role',
          'public.literary_work_evidence_v2_attestations',
          'INSERT'
        )
        and not has_table_privilege(
          'service_role',
          'public.literary_work_evidence_v2_attestations',
          'UPDATE'
        )
        and not has_table_privilege(
          'service_role',
          'public.literary_work_evidence_v2_attestations',
          'DELETE'
        )
        and (
          select relation.relrowsecurity and relation.relforcerowsecurity
          from pg_catalog.pg_class relation
          where relation.oid =
            'public.literary_work_evidence_v2_controls'::regclass
        )
        and (
          select relation.relrowsecurity and relation.relforcerowsecurity
          from pg_catalog.pg_class relation
          where relation.oid =
            'public.literary_work_evidence_v2_attestations'::regclass
        )
        and 1 = (
          select count(*)
          from public.literary_work_evidence_v2_controls control
          where control.singleton
            and control.contract_version = 'book-evidence-v2'
            and control.validator_id =
              'src/data/bookEvidence.ts#bookEvidenceV2Issues'
            and control.validator_version =
              'book-evidence-v2-validator-v1'
            and control.validator_sha256 ~ '^[0-9a-f]{64}$'
            and control.canon_registry_version =
              'world-canon-2026-09-v2'
            and control.canon_registry_sha256 ~ '^[0-9a-f]{64}$'
        )
        and 7 = (
          select count(*)
          from pg_catalog.pg_trigger invalidation_trigger
          where not invalidation_trigger.tgisinternal
            and invalidation_trigger.tgfoid =
              'public.invalidate_literary_work_evidence_v2()'::regprocedure
            and (
              invalidation_trigger.tgrelid,
              invalidation_trigger.tgname
            ) in (
              (
                'public.literary_works'::regclass,
                'literary_works_invalidate_evidence_v2'
              ),
              (
                'public.literary_work_translations'::regclass,
                'literary_work_translations_invalidate_evidence_v2'
              ),
              (
                'public.literary_work_sources'::regclass,
                'literary_work_sources_invalidate_evidence_v2'
              ),
              (
                'public.literary_work_external_ids'::regclass,
                'literary_work_external_ids_invalidate_evidence_v2'
              ),
              (
                'public.literary_work_authors'::regclass,
                'literary_work_authors_invalidate_evidence_v2'
              ),
              (
                'public.book_editions'::regclass,
                'book_editions_invalidate_evidence_v2'
              ),
              (
                'public.literary_work_cover_artworks'::regclass,
                'literary_work_cover_artworks_invalidate_evidence_v2'
              )
            )
        )
        and 7 = (
          select count(*)
          from pg_catalog.pg_policies policy_record
          where policy_record.schemaname = 'public'
            and (
              policy_record.tablename,
              policy_record.policyname
            ) in (
              (
                'literary_works',
                'Public read publishable literary works'
              ),
              (
                'literary_work_translations',
                'Public read publishable work translations'
              ),
              (
                'literary_work_sources',
                'Public read publishable work sources'
              ),
              (
                'literary_work_external_ids',
                'Public read publishable work external ids'
              ),
              ('book_editions', 'Public read verified book editions'),
              (
                'literary_work_cover_artworks',
                'Public read publishable literary work artwork'
              ),
              (
                'literary_work_authors',
                'Public read publishable literary work authors'
              )
            )
            and policy_record.qual like
              '%is_publishable_literary_work(%'
            and policy_record.qual not like
              '%is_publishable_literary_work_pre_evidence_v2(%'
        ),
      'literaryWorkEvidenceV2Enforced', coalesce((
        select control.enforcement_enabled
        from public.literary_work_evidence_v2_controls control
        where control.singleton
      ), false),
      'literaryWorkEvidenceV2InvalidAttestations', (
        select count(*)
        from public.literary_works work
        where public.is_publishable_literary_work_pre_evidence_v2(work.id)
          and not public.is_literary_work_evidence_v2_attested(work.id)
      ),
      'literaryWorkEvidenceV2PredecessorPublic', (
        select count(*)
        from public.literary_works work
        where public.is_publishable_literary_work_pre_evidence_v2(work.id)
      ),
      'literaryWorkEvidenceV2AttestedPredecessorPublic', (
        select count(*)
        from public.literary_works work
        where public.is_publishable_literary_work_pre_evidence_v2(work.id)
          and public.is_literary_work_evidence_v2_attested(work.id)
      )
    )
    else null
  end;
$$;

revoke all on function public.get_editorial_schema_health()
  from public, anon, authenticated, service_role;
grant execute on function public.get_editorial_schema_health()
  to authenticated;
