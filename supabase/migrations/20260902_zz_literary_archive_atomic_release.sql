-- Private, content-addressed staging for an all-or-nothing literary archive
-- release. Staging never touches publication-bearing tables. The final RPC
-- performs every live mutation, Evidence V2 attestation and optional gate
-- enablement in one PostgreSQL transaction, so MVCC readers observe either
-- the complete old archive or the complete new archive.

-- Editions and work-level artwork are part of the publication surface. Bind
-- them into the Evidence V2 content hash before accepting an atomic release.
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

-- A full release can touch thousands of works. Holding one transaction-level
-- advisory lock per work would exhaust PostgreSQL's shared lock table on a
-- realistic archive. The commit RPC therefore establishes a control-row
-- barrier and a transaction-local marker before any live mutation. Only that
-- service-role transaction may skip the redundant per-work locks; all normal
-- mutations retain the original Evidence V2 serialization.
create or replace function public.invalidate_literary_work_evidence_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_work_ids uuid[];
  locked_work_id uuid;
  atomic_release_mode boolean :=
    coalesce((select auth.role()), '') = 'service_role'
    and coalesce(
      pg_catalog.current_setting(
        'probpera.literary_archive_atomic_release',
        true
      ),
      ''
    ) = 'on';
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
    target_work_ids := array[old.work_id, new.work_id];
  end if;

  if not atomic_release_mode then
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
  end if;

  delete from public.literary_work_evidence_v2_attestations attestation
  where attestation.work_id = any(target_work_ids);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.invalidate_literary_work_evidence_v2()
  from public, anon, authenticated, service_role;

-- The existing attestation validator is intentionally reused without copying
-- its long evidence contract. Replace only its advisory-lock statement and
-- fail the migration if the predecessor definition is not exactly patchable.
-- The commit owns the Evidence control row before setting the marker, so a
-- concurrent normal attestation either finishes first or waits and revalidates
-- against the committed archive; it can never insert a stale proof afterward.
do $literary_archive_atomic_attestation_lock_contract$
declare
  predecessor_definition text;
  advisory_lock_statement text := $attestation_lock_needle$  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_work_id::text, 20260902)
  );$attestation_lock_needle$;
  conditional_lock_statement text := $attestation_lock_replacement$  if not (
    coalesce((select auth.role()), '') = 'service_role'
    and coalesce(
      pg_catalog.current_setting(
        'probpera.literary_archive_atomic_release',
        true
      ),
      ''
    ) = 'on'
  ) then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_work_id::text, 20260902)
    );
  end if;$attestation_lock_replacement$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.attest_literary_work_evidence_v2(uuid,text,jsonb,jsonb,text,date)'
      ::regprocedure
  ) into predecessor_definition;
  if position(
      'probpera.literary_archive_atomic_release'
      in predecessor_definition
    ) = 0 then
    if position(advisory_lock_statement in predecessor_definition) = 0 then
      raise exception
        'Evidence V2 attestation advisory-lock contract cannot be patched safely';
    end if;
    execute replace(
      predecessor_definition,
      advisory_lock_statement,
      conditional_lock_statement
    );
  end if;
end;
$literary_archive_atomic_attestation_lock_contract$;

revoke all on function public.attest_literary_work_evidence_v2(
  uuid, text, jsonb, jsonb, text, date
) from public, anon, authenticated, service_role;
grant execute on function public.attest_literary_work_evidence_v2(
  uuid, text, jsonb, jsonb, text, date
) to service_role;

-- Any edition or artwork mutation now invalidates the content-bound proof.
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

-- Historical child edits predate the parent-lock trigger below. Preserve their
-- authoritative database evidence in a private append-only ledger before a
-- full-set release can replace any child table. admin_audit_log covers the
-- original CMS actions; public_build_outbox additionally covers the underlying
-- authenticated row mutation transaction even if the application process died
-- before writing its friendly audit entry.
do $literary_archive_child_edit_preservation_prerequisites$
begin
  if to_regclass('public.admin_audit_log') is null then
    raise exception
      'Historical child-edit preservation requires public.admin_audit_log; apply 20260728_cms_foundation.sql first'
      using errcode = '42P01';
  end if;
  if to_regclass('public.public_build_outbox') is null then
    raise exception
      'Historical child-edit preservation requires public.public_build_outbox; apply 20260814_publication_outbox_and_schema_health.sql first'
      using errcode = '42P01';
  end if;
end;
$literary_archive_child_edit_preservation_prerequisites$;

create table if not exists public.literary_archive_child_edit_preservations (
  id bigint generated always as identity primary key,
  source_kind text not null check (
    source_kind in ('admin-audit', 'public-build-outbox', 'database-trigger')
  ),
  source_event_id bigint,
  relation_name text not null check (
    relation_name in (
      'literary_work_authors',
      'literary_work_translations',
      'literary_work_sources',
      'literary_work_external_ids',
      'book_editions',
      'literary_work_cover_artworks'
    )
  ),
  operation text not null check (char_length(btrim(operation)) between 1 and 120),
  work_id uuid not null references public.literary_works(id) on delete restrict,
  work_legacy_id text not null check (char_length(work_legacy_id) between 2 and 180),
  record_id text check (
    record_id is null or char_length(btrim(record_id)) between 1 and 240
  ),
  actor_id uuid,
  occurred_at timestamptz not null,
  source_payload_sha256 text not null check (
    source_payload_sha256 ~ '^[0-9a-f]{64}$'
  ),
  recorded_at timestamptz not null default now(),
  check (
    (source_kind = 'database-trigger' and source_event_id is null)
    or
    (source_kind <> 'database-trigger' and source_event_id is not null)
  )
);

create unique index if not exists
  literary_archive_child_edit_preservations_source_idx
  on public.literary_archive_child_edit_preservations(
    source_kind,
    source_event_id
  )
  where source_event_id is not null;

create index if not exists
  literary_archive_child_edit_preservations_work_idx
  on public.literary_archive_child_edit_preservations(work_id, id);

create table if not exists
  public.literary_archive_child_edit_preservation_controls (
    singleton boolean primary key default true check (singleton),
    schema_version text not null check (
      schema_version = 'literary-archive-child-edit-preservation-v1'
    ),
    audit_high_water_id bigint not null check (audit_high_water_id >= 0),
    outbox_high_water_id bigint not null check (outbox_high_water_id >= 0),
    backfilled_at timestamptz not null
  );

create or replace function
  public.protect_literary_archive_child_edit_preservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Literary archive child-edit preservation evidence is append-only'
    using errcode = '55000';
end;
$$;

revoke all on function
  public.protect_literary_archive_child_edit_preservation()
  from public, anon, authenticated, service_role;

drop trigger if exists literary_archive_child_edit_preservations_append_only
  on public.literary_archive_child_edit_preservations;
create trigger literary_archive_child_edit_preservations_append_only
  before update or delete
  on public.literary_archive_child_edit_preservations
  for each row execute function
    public.protect_literary_archive_child_edit_preservation();

drop trigger if exists literary_archive_child_edit_preservation_controls_immutable
  on public.literary_archive_child_edit_preservation_controls;
create trigger literary_archive_child_edit_preservation_controls_immutable
  before update or delete
  on public.literary_archive_child_edit_preservation_controls
  for each row execute function
    public.protect_literary_archive_child_edit_preservation();

alter table public.literary_archive_child_edit_preservations enable row level security;
alter table public.literary_archive_child_edit_preservations force row level security;
alter table public.literary_archive_child_edit_preservation_controls enable row level security;
alter table public.literary_archive_child_edit_preservation_controls force row level security;

revoke all on table public.literary_archive_child_edit_preservations
  from public, anon, authenticated, service_role;
revoke all on table public.literary_archive_child_edit_preservation_controls
  from public, anon, authenticated, service_role;

create or replace function
  public.literary_archive_child_edit_preservation_receipt()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  control_row
    public.literary_archive_child_edit_preservation_controls%rowtype;
  evidence_event_count bigint;
  protected_work_count integer;
  evidence_sha256 text;
begin
  select control.*
  into control_row
  from public.literary_archive_child_edit_preservation_controls control
  where control.singleton;
  if not found
    or control_row.schema_version is distinct from
      'literary-archive-child-edit-preservation-v1' then
    raise exception 'Historical child-edit provenance was not backfilled'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.literary_archive_child_edit_preservations evidence
    left join public.literary_works work on work.id = evidence.work_id
    where work.id is null
      or not work.is_cms_locked
      or work.legacy_id is distinct from evidence.work_legacy_id
  ) then
    raise exception
      'Historical child-edit evidence is not protected by an exact CMS lock'
      using errcode = '40001';
  end if;

  select count(*)
  into evidence_event_count
  from public.literary_archive_child_edit_preservations;

  select count(distinct evidence.work_id)::integer
  into protected_work_count
  from public.literary_archive_child_edit_preservations evidence;

  select public.literary_work_evidence_v2_sha256(
    coalesce(string_agg(
      evidence.id::text || ':' ||
      pg_catalog.encode(
        pg_catalog.convert_to(evidence.source_kind, 'UTF8'),
        'hex'
      ) || ':' || coalesce(evidence.source_event_id::text, '~') || ':' ||
      pg_catalog.encode(
        pg_catalog.convert_to(evidence.relation_name, 'UTF8'),
        'hex'
      ) || ':' ||
      pg_catalog.encode(
        pg_catalog.convert_to(evidence.operation, 'UTF8'),
        'hex'
      ) || ':' || evidence.work_id::text || ':' ||
      pg_catalog.encode(
        pg_catalog.convert_to(evidence.work_legacy_id, 'UTF8'),
        'hex'
      ) || ':' ||
      coalesce(
        pg_catalog.encode(
          pg_catalog.convert_to(evidence.record_id, 'UTF8'),
          'hex'
        ),
        '~'
      ) || ':' || coalesce(evidence.actor_id::text, '~') || ':' ||
      pg_catalog.encode(
        pg_catalog.convert_to(
          pg_catalog.to_char(
            evidence.occurred_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ),
          'UTF8'
        ),
        'hex'
      ) || ':' || evidence.source_payload_sha256,
      E'\n' order by evidence.id
    ), '')
  )
  into evidence_sha256
  from public.literary_archive_child_edit_preservations evidence;

  return jsonb_build_object(
    'schemaVersion', control_row.schema_version,
    'evidenceEvents', evidence_event_count,
    'protectedWorks', protected_work_count,
    'evidenceSha256', evidence_sha256,
    'auditHighWaterId', control_row.audit_high_water_id::text,
    'outboxHighWaterId', control_row.outbox_high_water_id::text
  );
end;
$$;

revoke all on function
  public.literary_archive_child_edit_preservation_receipt()
  from public, anon, authenticated, service_role;

-- A manual edit to any child relation protects its parent from a later static
-- archive release. Service-role changes remain governed by release snapshot
-- hashes and do not silently convert a source sync into a CMS edit.
create or replace function public.lock_literary_work_parent_on_child_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_work_ids uuid[];
  target_work_id uuid;
  target_legacy_id text;
  record_identity text;
  source_payload_sha256 text;
begin
  if coalesce((select auth.role()), '') = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    target_work_ids := array[new.work_id];
  elsif tg_op = 'DELETE' then
    target_work_ids := array[old.work_id];
  else
    target_work_ids := array[old.work_id, new.work_id];
  end if;

  record_identity := coalesce(
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
      ->> 'id',
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
      ->> 'work_id'
  );
  source_payload_sha256 := public.literary_work_evidence_v2_sha256(
    jsonb_build_object(
      'table', tg_table_name,
      'operation', lower(tg_op),
      'old', case when tg_op = 'INSERT' then null else to_jsonb(old) end,
      'new', case when tg_op = 'DELETE' then null else to_jsonb(new) end
    )::text
  );

  for target_work_id in
    select distinct listed.work_id
    from unnest(target_work_ids) listed(work_id)
    where listed.work_id is not null
    order by listed.work_id
  loop
    select work.legacy_id
    into target_legacy_id
    from public.literary_works work
    where work.id = target_work_id;
    if not found then
      raise exception 'Child edit parent work cannot be resolved'
        using errcode = '23503';
    end if;

    insert into public.literary_archive_child_edit_preservations (
      source_kind,
      relation_name,
      operation,
      work_id,
      work_legacy_id,
      record_id,
      actor_id,
      occurred_at,
      source_payload_sha256
    ) values (
      'database-trigger',
      tg_table_name,
      lower(tg_op),
      target_work_id,
      target_legacy_id,
      record_identity,
      (select auth.uid()),
      statement_timestamp(),
      source_payload_sha256
    );
  end loop;

  update public.literary_works work
  set
    is_cms_locked = true,
    updated_by = coalesce((select auth.uid()), work.updated_by)
  where work.id in (
    select distinct listed.work_id
    from unnest(target_work_ids) listed(work_id)
    where listed.work_id is not null
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.lock_literary_work_parent_on_child_edit()
  from public, anon, authenticated, service_role;

drop trigger if exists literary_work_authors_lock_parent_on_edit
  on public.literary_work_authors;
create trigger literary_work_authors_lock_parent_on_edit
  before insert or update or delete on public.literary_work_authors
  for each row execute function public.lock_literary_work_parent_on_child_edit();

drop trigger if exists literary_work_translations_lock_parent_on_edit
  on public.literary_work_translations;
create trigger literary_work_translations_lock_parent_on_edit
  before insert or update or delete on public.literary_work_translations
  for each row execute function public.lock_literary_work_parent_on_child_edit();

drop trigger if exists literary_work_sources_lock_parent_on_edit
  on public.literary_work_sources;
create trigger literary_work_sources_lock_parent_on_edit
  before insert or update or delete on public.literary_work_sources
  for each row execute function public.lock_literary_work_parent_on_child_edit();

drop trigger if exists literary_work_external_ids_lock_parent_on_edit
  on public.literary_work_external_ids;
create trigger literary_work_external_ids_lock_parent_on_edit
  before insert or update or delete on public.literary_work_external_ids
  for each row execute function public.lock_literary_work_parent_on_child_edit();

drop trigger if exists book_editions_lock_parent_on_edit
  on public.book_editions;
create trigger book_editions_lock_parent_on_edit
  before insert or update or delete on public.book_editions
  for each row execute function public.lock_literary_work_parent_on_child_edit();

drop trigger if exists literary_work_cover_artworks_lock_parent_on_edit
  on public.literary_work_cover_artworks;
create trigger literary_work_cover_artworks_lock_parent_on_edit
  before insert or update or delete on public.literary_work_cover_artworks
  for each row execute function public.lock_literary_work_parent_on_child_edit();

-- Backfill every historical manual child mutation visible in either durable
-- journal. A relevant event must resolve to exactly one current parent work.
-- In particular, an authenticated outbox DELETE without a companion audit/work
-- hint aborts this migration: silently guessing its parent would risk restoring
-- content an editor intentionally removed.
do $literary_archive_historical_child_edit_backfill$
declare
  audit_high_water bigint;
  outbox_high_water bigint;
  unresolved_event record;
  conflicting_event record;
begin
  if exists (
    select 1
    from public.literary_archive_child_edit_preservation_controls control
    where control.singleton
  ) then
    perform public.literary_archive_child_edit_preservation_receipt();
    return;
  end if;

  select coalesce(max(audit.id), 0)
  into audit_high_water
  from public.admin_audit_log audit;
  select coalesce(max(outbox.id), 0)
  into outbox_high_water
  from public.public_build_outbox outbox;

  -- Generic actor-less database-* outbox rows are the expected service-role
  -- bulk-sync trail and are deliberately ignored. An actor-less event carrying
  -- a CMS action name is different: user deletion and service impersonation
  -- are indistinguishable after the fact, so provenance cannot be proved.
  if exists (
    select 1
    from public.admin_audit_log audit
    where audit.id <= audit_high_water
      and audit.actor_id is null
      and (
        audit.action ~
          '^(literary_work_(translation|source|external_id|cover_artwork)\.(created|updated|deleted)|book_edition\.(upserted|created|updated|deleted)|literary_work\.auto_translation\.succeeded)$'
        or audit.action = 'public_build.requested'
          and audit.entity_type in (
            'literary_work_translation',
            'literary_work_source',
            'literary_work_external_id',
            'book_edition',
            'literary_work_cover_artwork'
          )
          and audit.metadata ->> 'reason' ~
            '^(literary_work_(translation|source|external_id|cover_artwork)\.(created|updated|deleted)|book_edition\.(upserted|created|updated|deleted))$'
      )
  ) or exists (
    select 1
    from public.public_build_outbox outbox
    where outbox.id <= outbox_high_water
      and outbox.actor_id is null
      and outbox.reason ~
        '^(literary_work_(translation|source|external_id|cover_artwork)\.(created|updated|deleted)|book_edition\.(upserted|created|updated|deleted))$'
  ) then
    raise exception
      'Historical child-edit event has ambiguous actor provenance'
      using errcode = '23514';
  end if;

  create temporary table literary_archive_historical_child_edit_events (
    source_kind text not null,
    source_event_id bigint not null,
    relation_name text not null,
    operation text not null,
    entity_type text not null,
    entity_id text,
    record_id text,
    work_hint text,
    actor_id uuid,
    occurred_at timestamptz not null,
    source_payload_sha256 text not null,
    primary key (source_kind, source_event_id)
  ) on commit drop;

  insert into literary_archive_historical_child_edit_events (
    source_kind,
    source_event_id,
    relation_name,
    operation,
    entity_type,
    entity_id,
    record_id,
    work_hint,
    actor_id,
    occurred_at,
    source_payload_sha256
  )
  select
    'admin-audit',
    audit.id,
    case
      when audit.action like 'literary_work_translation.%'
        or audit.action = 'literary_work.auto_translation.succeeded'
        then 'literary_work_translations'
      when audit.action like 'literary_work_source.%'
        then 'literary_work_sources'
      when audit.action like 'literary_work_external_id.%'
        then 'literary_work_external_ids'
      when audit.action like 'book_edition.%' then 'book_editions'
      when audit.action like 'literary_work_cover_artwork.%'
        then 'literary_work_cover_artworks'
      when audit.entity_type = 'literary_work_translation'
        then 'literary_work_translations'
      when audit.entity_type = 'literary_work_source'
        then 'literary_work_sources'
      when audit.entity_type = 'literary_work_external_id'
        then 'literary_work_external_ids'
      when audit.entity_type = 'book_edition' then 'book_editions'
      when audit.entity_type = 'literary_work_cover_artwork'
        then 'literary_work_cover_artworks'
    end,
    case
      when audit.action = 'public_build.requested'
        then coalesce(audit.metadata ->> 'reason', audit.action)
      else audit.action
    end,
    audit.entity_type,
    audit.entity_id,
    coalesce(
      nullif(btrim(audit.metadata ->> 'recordId'), ''),
      case
        when audit.action = 'literary_work.auto_translation.succeeded'
          then null
        else nullif(btrim(audit.entity_id), '')
      end
    ),
    coalesce(
      nullif(btrim(audit.metadata ->> 'workId'), ''),
      case
        when audit.action = 'literary_work.auto_translation.succeeded'
          then nullif(btrim(audit.entity_id), '')
        else null
      end
    ),
    audit.actor_id,
    audit.created_at,
    public.literary_work_evidence_v2_sha256(to_jsonb(audit)::text)
  from public.admin_audit_log audit
  where audit.id <= audit_high_water
    and audit.actor_id is not null
    and (
      audit.action = any(array[
        'literary_work_translation.created',
        'literary_work_translation.updated',
        'literary_work_translation.deleted',
        'literary_work_source.created',
        'literary_work_source.updated',
        'literary_work_source.deleted',
        'literary_work_external_id.created',
        'literary_work_external_id.updated',
        'literary_work_external_id.deleted',
        'book_edition.upserted',
        'book_edition.created',
        'book_edition.updated',
        'book_edition.deleted',
        'literary_work_cover_artwork.created',
        'literary_work_cover_artwork.updated',
        'literary_work_cover_artwork.deleted',
        'literary_work.auto_translation.succeeded'
      ]::text[])
      or (
        audit.action = 'public_build.requested'
        and audit.entity_type = any(array[
          'literary_work_translation',
          'literary_work_source',
          'literary_work_external_id',
          'book_edition',
          'literary_work_cover_artwork'
        ]::text[])
        and audit.metadata ->> 'reason' = any(array[
          'literary_work_translation.created',
          'literary_work_translation.updated',
          'literary_work_translation.deleted',
          'literary_work_source.created',
          'literary_work_source.updated',
          'literary_work_source.deleted',
          'literary_work_external_id.created',
          'literary_work_external_id.updated',
          'literary_work_external_id.deleted',
          'book_edition.upserted',
          'book_edition.created',
          'book_edition.updated',
          'book_edition.deleted',
          'literary_work_cover_artwork.created',
          'literary_work_cover_artwork.updated',
          'literary_work_cover_artwork.deleted'
        ]::text[])
      )
    )
  order by audit.id;

  insert into literary_archive_historical_child_edit_events (
    source_kind,
    source_event_id,
    relation_name,
    operation,
    entity_type,
    entity_id,
    record_id,
    work_hint,
    actor_id,
    occurred_at,
    source_payload_sha256
  )
  select
    'public-build-outbox',
    outbox.id,
    case
      when outbox.entity_type in (
        'literary_work_translations', 'literary_work_translation'
      ) or outbox.reason like 'literary_work_translation.%'
        then 'literary_work_translations'
      when outbox.entity_type in (
        'literary_work_sources', 'literary_work_source'
      ) or outbox.reason like 'literary_work_source.%'
        then 'literary_work_sources'
      when outbox.entity_type in (
        'literary_work_external_ids', 'literary_work_external_id'
      ) or outbox.reason like 'literary_work_external_id.%'
        then 'literary_work_external_ids'
      when outbox.entity_type in ('book_editions', 'book_edition')
        or outbox.reason like 'book_edition.%'
        then 'book_editions'
      when outbox.entity_type in (
        'literary_work_cover_artworks', 'literary_work_cover_artwork'
      ) or outbox.reason like 'literary_work_cover_artwork.%'
        then 'literary_work_cover_artworks'
    end,
    coalesce(nullif(btrim(outbox.metadata ->> 'operation'), ''), outbox.reason),
    outbox.entity_type,
    outbox.entity_id,
    nullif(btrim(outbox.entity_id), ''),
    nullif(btrim(outbox.metadata ->> 'workId'), ''),
    outbox.actor_id,
    outbox.requested_at,
    public.literary_work_evidence_v2_sha256(to_jsonb(outbox)::text)
  from public.public_build_outbox outbox
  where outbox.id <= outbox_high_water
    and outbox.actor_id is not null
    and (
      (
        outbox.entity_type = any(array[
          'literary_work_translations',
          'literary_work_sources',
          'literary_work_external_ids',
          'book_editions',
          'literary_work_cover_artworks'
        ]::text[])
      )
      or outbox.reason = any(array[
        'literary_work_translation.created',
        'literary_work_translation.updated',
        'literary_work_translation.deleted',
        'literary_work_source.created',
        'literary_work_source.updated',
        'literary_work_source.deleted',
        'literary_work_external_id.created',
        'literary_work_external_id.updated',
        'literary_work_external_id.deleted',
        'book_edition.upserted',
        'book_edition.created',
        'book_edition.updated',
        'book_edition.deleted',
        'literary_work_cover_artwork.created',
        'literary_work_cover_artwork.updated',
        'literary_work_cover_artwork.deleted'
      ]::text[])
    )
  order by outbox.id;

  if exists (
    select 1
    from literary_archive_historical_child_edit_events event
    where event.relation_name is null
      or event.work_hint is not null and event.work_hint !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or case event.relation_name
        when 'literary_work_translations' then
          event.entity_type not in (
            'literary_work_translation',
            'literary_work_translations',
            'literary_work'
          )
          or event.entity_type = 'literary_work'
            and event.operation <> 'literary_work.auto_translation.succeeded'
        when 'literary_work_sources' then
          event.entity_type not in (
            'literary_work_source', 'literary_work_sources'
          )
        when 'literary_work_external_ids' then
          event.entity_type not in (
            'literary_work_external_id', 'literary_work_external_ids'
          )
        when 'book_editions' then
          event.entity_type not in ('book_edition', 'book_editions')
        when 'literary_work_cover_artworks' then
          event.entity_type not in (
            'literary_work_cover_artwork',
            'literary_work_cover_artworks'
          )
        else true
      end
  ) then
    raise exception 'Historical child-edit evidence has an invalid schema'
      using errcode = '23514';
  end if;

  create temporary table literary_archive_current_child_identities (
    relation_name text not null,
    record_id text not null,
    work_id uuid not null,
    primary key (relation_name, record_id)
  ) on commit drop;

  insert into literary_archive_current_child_identities
  select 'literary_work_translations', child.id::text, child.work_id
  from public.literary_work_translations child
  union all
  select 'literary_work_sources', child.id::text, child.work_id
  from public.literary_work_sources child
  union all
  select 'literary_work_external_ids', child.id::text, child.work_id
  from public.literary_work_external_ids child
  union all
  select 'book_editions', child.id::text, child.work_id
  from public.book_editions child
  union all
  select 'literary_work_cover_artworks', child.id::text, child.work_id
  from public.literary_work_cover_artworks child;

  create temporary table literary_archive_historical_child_edit_candidates (
    source_kind text not null,
    source_event_id bigint not null,
    work_id uuid not null,
    primary key (source_kind, source_event_id, work_id)
  ) on commit drop;

  insert into literary_archive_historical_child_edit_candidates
  select event.source_kind, event.source_event_id, work.id
  from literary_archive_historical_child_edit_events event
  join public.literary_works work on work.id = event.work_hint::uuid
  where event.work_hint is not null
  on conflict do nothing;

  if exists (
    select 1
    from literary_archive_historical_child_edit_events event
    where event.work_hint is not null
      and not exists (
        select 1
        from public.literary_works work
        where work.id = event.work_hint::uuid
      )
  ) then
    raise exception 'Historical child-edit evidence points to a missing work'
      using errcode = '23503';
  end if;

  insert into literary_archive_historical_child_edit_candidates
  select event.source_kind, event.source_event_id, work.id
  from literary_archive_historical_child_edit_events event
  join public.literary_works work on work.id::text = event.entity_id
  on conflict do nothing;

  insert into literary_archive_historical_child_edit_candidates
  select event.source_kind, event.source_event_id, child.work_id
  from literary_archive_historical_child_edit_events event
  join literary_archive_current_child_identities child
    on child.relation_name = event.relation_name
    and child.record_id in (event.record_id, event.entity_id)
  on conflict do nothing;

  -- Propagate an explicit audit/work hint to its transactional outbox event (or
  -- vice versa) through their common child record identity. This is what makes
  -- a historical DELETE resolvable even though the child row no longer exists.
  insert into literary_archive_historical_child_edit_candidates
  select distinct
    target.source_kind,
    target.source_event_id,
    source_candidate.work_id
  from literary_archive_historical_child_edit_events target
  join literary_archive_historical_child_edit_events source
    on source.relation_name = target.relation_name
    and (
      target.record_id is not null
        and target.record_id in (source.record_id, source.entity_id)
      or target.entity_id is not null
        and target.entity_id in (source.record_id, source.entity_id)
    )
  join literary_archive_historical_child_edit_candidates source_candidate
    on source_candidate.source_kind = source.source_kind
    and source_candidate.source_event_id = source.source_event_id
  on conflict do nothing;

  select
    event.source_kind,
    event.source_event_id,
    event.relation_name,
    event.operation
  into conflicting_event
  from literary_archive_historical_child_edit_events event
  join literary_archive_historical_child_edit_candidates candidate
    on candidate.source_kind = event.source_kind
    and candidate.source_event_id = event.source_event_id
  group by
    event.source_kind,
    event.source_event_id,
    event.relation_name,
    event.operation
  having count(distinct candidate.work_id) <> 1
  limit 1;
  if found then
    raise exception
      'Historical child-edit evidence %:% resolves to conflicting parents',
      conflicting_event.source_kind,
      conflicting_event.source_event_id
      using errcode = '23514';
  end if;

  select
    event.source_kind,
    event.source_event_id,
    event.relation_name,
    event.operation
  into unresolved_event
  from literary_archive_historical_child_edit_events event
  where not exists (
    select 1
    from literary_archive_historical_child_edit_candidates candidate
    where candidate.source_kind = event.source_kind
      and candidate.source_event_id = event.source_event_id
  )
  order by event.source_kind, event.source_event_id
  limit 1;
  if found then
    raise exception
      'Historical child-edit evidence %:% has no provable parent work',
      unresolved_event.source_kind,
      unresolved_event.source_event_id
      using errcode = '23514';
  end if;

  -- These metadata markers can only be produced by the CMS edit paths. If a
  -- prior non-transactional audit write was lost, refuse replacement instead
  -- of treating the missing journal row as proof that no edit happened.
  if exists (
    select 1
    from public.book_editions edition
    where (edition.metadata ? 'importedBy' or edition.metadata ? 'importedAt')
      and not exists (
        select 1
        from literary_archive_historical_child_edit_events event
        join literary_archive_historical_child_edit_candidates candidate
          on candidate.source_kind = event.source_kind
          and candidate.source_event_id = event.source_event_id
        where event.relation_name = 'book_editions'
          and candidate.work_id = edition.work_id
          and edition.id::text in (event.record_id, event.entity_id)
      )
  ) or exists (
    select 1
    from public.literary_work_translations translation
    where translation.metadata ? 'premiumTranslation'
      and not exists (
        select 1
        from literary_archive_historical_child_edit_events event
        join literary_archive_historical_child_edit_candidates candidate
          on candidate.source_kind = event.source_kind
          and candidate.source_event_id = event.source_event_id
        where event.relation_name = 'literary_work_translations'
          and candidate.work_id = translation.work_id
          and translation.id::text in (event.record_id, event.entity_id)
      )
  ) then
    raise exception
      'Manual child-row metadata exists without authoritative edit evidence'
      using errcode = '23514';
  end if;

  insert into public.literary_archive_child_edit_preservations (
    source_kind,
    source_event_id,
    relation_name,
    operation,
    work_id,
    work_legacy_id,
    record_id,
    actor_id,
    occurred_at,
    source_payload_sha256
  )
  select
    event.source_kind,
    event.source_event_id,
    event.relation_name,
    event.operation,
    candidate.work_id,
    work.legacy_id,
    event.record_id,
    event.actor_id,
    event.occurred_at,
    event.source_payload_sha256
  from literary_archive_historical_child_edit_events event
  join literary_archive_historical_child_edit_candidates candidate
    on candidate.source_kind = event.source_kind
    and candidate.source_event_id = event.source_event_id
  join public.literary_works work on work.id = candidate.work_id
  order by event.source_kind, event.source_event_id
  on conflict do nothing;

  update public.literary_works work
  set is_cms_locked = true
  where not work.is_cms_locked
    and exists (
      select 1
      from public.literary_archive_child_edit_preservations evidence
      where evidence.work_id = work.id
    );

  insert into public.literary_archive_child_edit_preservation_controls (
    singleton,
    schema_version,
    audit_high_water_id,
    outbox_high_water_id,
    backfilled_at
  ) values (
    true,
    'literary-archive-child-edit-preservation-v1',
    audit_high_water,
    outbox_high_water,
    clock_timestamp()
  );

  perform public.literary_archive_child_edit_preservation_receipt();
end;
$literary_archive_historical_child_edit_backfill$;

create table if not exists public.literary_archive_releases (
  id uuid primary key default gen_random_uuid(),
  release_key text not null unique
    check (release_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{6,159}$'),
  source_revision text not null
    check (char_length(btrim(source_revision)) between 7 and 160),
  contract_version text not null default 'literary-archive-release-v1'
    check (contract_version = 'literary-archive-release-v1'),
  expected_item_count integer not null
    check (expected_item_count between 1 and 20000),
  expected_batch_count integer not null
    check (expected_batch_count between 1 and 2000),
  expected_unlocked_work_count integer not null
    check (expected_unlocked_work_count between 0 and 20000),
  expected_unlocked_scope_sha256 text not null
    check (expected_unlocked_scope_sha256 ~ '^[0-9a-f]{64}$'),
  expected_child_edit_preservation jsonb not null check (
    jsonb_typeof(expected_child_edit_preservation) = 'object'
  ),
  expected_target_manifest_sha256 text not null
    check (expected_target_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  expected_predecessor_public_count integer not null
    check (expected_predecessor_public_count between 0 and 20000),
  expected_predecessor_public_manifest_sha256 text not null
    check (
      expected_predecessor_public_manifest_sha256 ~ '^[0-9a-f]{64}$'
    ),
  enable_evidence_v2 boolean not null,
  status text not null default 'staging'
    check (status in ('staging', 'committed')),
  staged_item_count integer not null default 0 check (staged_item_count >= 0),
  staged_batch_count integer not null default 0 check (staged_batch_count >= 0),
  staged_manifest_sha256 text
    check (staged_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  committed_manifest_sha256 text
    check (committed_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  commit_receipt jsonb check (
    commit_receipt is null or jsonb_typeof(commit_receipt) = 'object'
  ),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  committed_at timestamptz,
  check (expected_batch_count <= expected_item_count),
  check (expected_batch_count >= (expected_item_count + 99) / 100),
  check (
    (status = 'staging'
      and committed_at is null
      and committed_manifest_sha256 is null
      and commit_receipt is null)
    or
    (status = 'committed'
      and committed_at is not null
      and committed_manifest_sha256 is not null
      and commit_receipt is not null)
  )
);

create table if not exists public.literary_archive_release_batches (
  release_id uuid not null
    references public.literary_archive_releases(id) on delete cascade,
  batch_number integer not null check (batch_number between 1 and 2000),
  first_ordinal integer not null check (first_ordinal >= 0),
  last_ordinal integer not null check (last_ordinal >= first_ordinal),
  item_count integer not null check (item_count between 1 and 100),
  batch_sha256 text not null check (batch_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (release_id, batch_number),
  check (last_ordinal - first_ordinal + 1 = item_count)
);

create table if not exists public.literary_archive_release_items (
  release_id uuid not null,
  batch_number integer not null,
  ordinal integer not null check (ordinal >= 0),
  legacy_id text not null check (
    char_length(legacy_id) between 2 and 180
    and legacy_id !~ '(^[[:space:]])|([[:space:]]$)'
  ),
  expected_live_exists boolean not null,
  expected_live_updated_at timestamptz,
  expected_live_integrity_sha256 text,
  canonical_payload text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (release_id, ordinal),
  unique (release_id, legacy_id),
  foreign key (release_id, batch_number)
    references public.literary_archive_release_batches(
      release_id,
      batch_number
    ) on delete cascade,
  check (
    (expected_live_exists
      and expected_live_updated_at is not null
      and expected_live_integrity_sha256 ~ '^[0-9a-f]{64}$')
    or
    (not expected_live_exists
      and expected_live_updated_at is null
      and expected_live_integrity_sha256 is null)
  )
);

create index if not exists literary_archive_release_items_batch_idx
  on public.literary_archive_release_items(release_id, batch_number, ordinal);

drop trigger if exists literary_archive_releases_set_updated_at
  on public.literary_archive_releases;
create trigger literary_archive_releases_set_updated_at
  before update on public.literary_archive_releases
  for each row execute function public.set_updated_at();

alter table public.literary_archive_releases enable row level security;
alter table public.literary_archive_releases force row level security;
alter table public.literary_archive_release_batches enable row level security;
alter table public.literary_archive_release_batches force row level security;
alter table public.literary_archive_release_items enable row level security;
alter table public.literary_archive_release_items force row level security;

revoke all on table public.literary_archive_releases
  from public, anon, authenticated, service_role;
revoke all on table public.literary_archive_release_batches
  from public, anon, authenticated, service_role;
revoke all on table public.literary_archive_release_items
  from public, anon, authenticated, service_role;

-- Direct writes are deliberately unavailable even to service_role. A narrow
-- read policy permits operational diagnosis; every state change goes through
-- one of the three service-only RPCs below.
grant select on table public.literary_archive_releases to service_role;
grant select on table public.literary_archive_release_batches to service_role;
grant select on table public.literary_archive_release_items to service_role;

drop policy if exists "Service read literary archive releases"
  on public.literary_archive_releases;
create policy "Service read literary archive releases"
on public.literary_archive_releases for select
to service_role
using (coalesce((select auth.role()), '') = 'service_role');

drop policy if exists "Service read literary archive release batches"
  on public.literary_archive_release_batches;
create policy "Service read literary archive release batches"
on public.literary_archive_release_batches for select
to service_role
using (coalesce((select auth.role()), '') = 'service_role');

drop policy if exists "Service read literary archive release items"
  on public.literary_archive_release_items;
create policy "Service read literary archive release items"
on public.literary_archive_release_items for select
to service_role
using (coalesce((select auth.role()), '') = 'service_role');

create or replace function public.literary_archive_release_object_has_keys(
  p_value jsonb,
  p_allowed_keys text[],
  p_required_keys text[]
)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'object'
    and p_value - p_allowed_keys = '{}'::jsonb
    and not exists (
      select 1
      from unnest(p_required_keys) required(key)
      where not p_value ? required.key
    );
$$;

revoke all on function public.literary_archive_release_object_has_keys(
  jsonb,
  text[],
  text[]
) from public, anon, authenticated, service_role;

create or replace function public.literary_archive_release_array_has_keys(
  p_value jsonb,
  p_allowed_keys text[],
  p_required_keys text[]
)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(p_value) listed(value)
      where not public.literary_archive_release_object_has_keys(
        listed.value,
        p_allowed_keys,
        p_required_keys
      )
    );
$$;

revoke all on function public.literary_archive_release_array_has_keys(
  jsonb,
  text[],
  text[]
) from public, anon, authenticated, service_role;

-- The validator rejects unknown keys: a misspelled field must never be
-- accepted into a signed manifest and then silently ignored by commit.
create or replace function public.validate_literary_archive_release_item(
  p_item jsonb,
  p_expected_item_count integer
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  item_ordinal integer;
  item_legacy_id text;
  expected_live jsonb;
  work_payload jsonb;
  attestation_payload jsonb;
  child_payload jsonb;
begin
  if p_item is null
    or pg_catalog.octet_length(
      pg_catalog.convert_to(p_item::text, 'UTF8')
    ) > 262144 then
    raise exception 'Release item exceeds the 256 KiB staging limit'
      using errcode = '22023';
  end if;
  if not public.literary_archive_release_object_has_keys(
    p_item,
    array[
      'ordinal',
      'legacyId',
      'expectedLive',
      'work',
      'expectedContent',
      'authors',
      'translations',
      'sources',
      'externalIds',
      'editions',
      'artworks',
      'attestation'
    ],
    array[
      'ordinal',
      'legacyId',
      'expectedLive',
      'work',
      'expectedContent',
      'authors',
      'translations',
      'sources',
      'externalIds',
      'editions',
      'artworks',
      'attestation'
    ]
  ) then
    raise exception 'Release item has missing or unknown top-level fields'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_item -> 'ordinal') is distinct from 'number'
    or coalesce(p_item ->> 'ordinal', '') !~ '^(0|[1-9][0-9]{0,4})$' then
    raise exception 'Release item ordinal is invalid' using errcode = '22023';
  end if;
  item_ordinal := (p_item ->> 'ordinal')::integer;
  if p_expected_item_count is null
    or item_ordinal < 0
    or item_ordinal >= p_expected_item_count then
    raise exception 'Release item ordinal is outside the declared manifest'
      using errcode = '22023';
  end if;

  item_legacy_id := p_item ->> 'legacyId';
  if jsonb_typeof(p_item -> 'legacyId') is distinct from 'string'
    or item_legacy_id is null
    or item_legacy_id is distinct from btrim(item_legacy_id)
    or item_legacy_id ~ '(^[[:space:]])|([[:space:]]$)'
    or char_length(item_legacy_id) not between 2 and 180 then
    raise exception 'Release item legacyId must be an exact non-padded string'
      using errcode = '22023';
  end if;

  expected_live := p_item -> 'expectedLive';
  if not public.literary_archive_release_object_has_keys(
    expected_live,
    array['exists', 'updatedAt', 'integritySha256'],
    array['exists', 'updatedAt', 'integritySha256']
  ) or jsonb_typeof(expected_live -> 'exists') is distinct from 'boolean' then
    raise exception 'Release item expectedLive snapshot is invalid'
      using errcode = '22023';
  end if;
  if (expected_live ->> 'exists')::boolean then
    if nullif(btrim(expected_live ->> 'updatedAt'), '') is null
      or coalesce(expected_live ->> 'integritySha256', '')
        !~ '^[0-9a-f]{64}$' then
      raise exception 'Existing work requires timestamp and integrity SHA-256'
        using errcode = '22023';
    end if;
    perform (expected_live ->> 'updatedAt')::timestamptz;
  elsif jsonb_typeof(expected_live -> 'updatedAt') <> 'null'
    or jsonb_typeof(expected_live -> 'integritySha256') <> 'null' then
    raise exception 'Absent work must have null live preconditions'
      using errcode = '22023';
  end if;

  work_payload := p_item -> 'work';
  if not public.literary_archive_release_object_has_keys(
    work_payload,
    array[
      'legacy_id', 'country_id', 'writer_id', 'title', 'slug',
      'original_title', 'first_published', 'original_language', 'genres',
      'tags', 'description', 'source_url', 'editorial_status', 'reviewed_at',
      'metadata', 'authorship_kind'
    ],
    array[
      'legacy_id', 'country_id', 'writer_id', 'title', 'slug',
      'original_title', 'first_published', 'original_language', 'genres',
      'tags', 'description', 'source_url', 'editorial_status', 'reviewed_at',
      'metadata', 'authorship_kind'
    ]
  ) or jsonb_typeof(work_payload -> 'legacy_id') is distinct from 'string'
    or work_payload ->> 'legacy_id' is distinct from item_legacy_id
    or jsonb_typeof(work_payload -> 'genres') is distinct from 'array'
    or jsonb_typeof(work_payload -> 'tags') is distinct from 'array'
    or jsonb_typeof(work_payload -> 'metadata') is distinct from 'object' then
    raise exception 'Release work payload is invalid or mismatched'
      using errcode = '22023';
  end if;
  if jsonb_typeof(work_payload -> 'first_published') <> 'null' then
    perform (work_payload ->> 'first_published')::integer;
  end if;
  if jsonb_typeof(work_payload -> 'reviewed_at') <> 'null' then
    perform (work_payload ->> 'reviewed_at')::date;
  end if;
  if jsonb_typeof(p_item -> 'expectedContent') is distinct from 'object' then
    raise exception 'Release item expectedContent projection is required'
      using errcode = '22023';
  end if;

  if not public.literary_archive_release_array_has_keys(
    p_item -> 'authors',
    array[
      'position', 'writer_country_id', 'writer_id', 'credit_name_ru',
      'credit_name_en', 'attribution_status', 'metadata'
    ],
    array[
      'position', 'writer_country_id', 'writer_id', 'credit_name_ru',
      'credit_name_en', 'attribution_status', 'metadata'
    ]
  ) or jsonb_array_length(p_item -> 'authors') > 1000 then
    raise exception 'Release authors array is invalid or exceeds 1000 rows'
      using errcode = '22023';
  end if;
  for child_payload in
    select listed.value
    from jsonb_array_elements(p_item -> 'authors') listed(value)
  loop
    if coalesce(child_payload ->> 'position', '') !~ '^(0|[1-9][0-9]{0,2})$'
      or (child_payload ->> 'position')::integer > 999
      or jsonb_typeof(child_payload -> 'metadata') is distinct from 'object' then
      raise exception 'Release author row has invalid position or metadata'
        using errcode = '22023';
    end if;
  end loop;

  if not public.literary_archive_release_array_has_keys(
    p_item -> 'translations',
    array[
      'locale', 'title', 'description', 'source_language',
      'translation_method', 'editorial_status', 'source_urls', 'reviewed_at',
      'metadata'
    ],
    array[
      'locale', 'title', 'description', 'source_language',
      'translation_method', 'editorial_status', 'source_urls', 'reviewed_at',
      'metadata'
    ]
  ) or jsonb_array_length(p_item -> 'translations') > 2 then
    raise exception 'Release translations array is invalid or exceeds 2 rows'
      using errcode = '22023';
  end if;
  for child_payload in
    select listed.value
    from jsonb_array_elements(p_item -> 'translations') listed(value)
  loop
    if jsonb_typeof(child_payload -> 'source_urls') is distinct from 'array'
      or jsonb_typeof(child_payload -> 'metadata') is distinct from 'object'
      or jsonb_typeof(child_payload -> 'reviewed_at') not in ('null', 'string') then
      raise exception 'Release translation row has invalid nested values'
        using errcode = '22023';
    end if;
    if jsonb_typeof(child_payload -> 'reviewed_at') = 'string' then
      perform (child_payload ->> 'reviewed_at')::date;
    end if;
  end loop;

  if not public.literary_archive_release_array_has_keys(
    p_item -> 'sources',
    array[
      'provider', 'source_url', 'field_names', 'license_name', 'usage',
      'retrieved_at', 'metadata'
    ],
    array[
      'provider', 'source_url', 'field_names', 'license_name', 'usage',
      'retrieved_at', 'metadata'
    ]
  ) or jsonb_array_length(p_item -> 'sources') > 200 then
    raise exception 'Release sources array is invalid or exceeds 200 rows'
      using errcode = '22023';
  end if;
  for child_payload in
    select listed.value
    from jsonb_array_elements(p_item -> 'sources') listed(value)
  loop
    if jsonb_typeof(child_payload -> 'field_names') is distinct from 'array'
      or jsonb_typeof(child_payload -> 'metadata') is distinct from 'object'
      or jsonb_typeof(child_payload -> 'retrieved_at') is distinct from 'string' then
      raise exception 'Release source row has invalid nested values'
        using errcode = '22023';
    end if;
    perform (child_payload ->> 'retrieved_at')::date;
  end loop;

  if not public.literary_archive_release_array_has_keys(
    p_item -> 'externalIds',
    array['scheme', 'external_id', 'source_url'],
    array['scheme', 'external_id', 'source_url']
  ) or jsonb_array_length(p_item -> 'externalIds') > 200 then
    raise exception 'Release externalIds array is invalid or exceeds 200 rows'
      using errcode = '22023';
  end if;

  if not public.literary_archive_release_array_has_keys(
    p_item -> 'editions',
    array[
      'legacy_id', 'title', 'isbn_10', 'isbn_13', 'publisher',
      'publication_year', 'language', 'format', 'page_count', 'cover_url',
      'cover_source_url', 'cover_rights_status', 'license_name', 'license_url',
      'creator', 'rights_holder', 'rights_checked_at', 'source_url',
      'is_primary', 'metadata'
    ],
    array[
      'legacy_id', 'title', 'isbn_10', 'isbn_13', 'publisher',
      'publication_year', 'language', 'format', 'page_count', 'cover_url',
      'cover_source_url', 'cover_rights_status', 'license_name', 'license_url',
      'creator', 'rights_holder', 'rights_checked_at', 'source_url',
      'is_primary', 'metadata'
    ]
  ) or jsonb_array_length(p_item -> 'editions') > 100 then
    raise exception 'Release editions array is invalid or exceeds 100 rows'
      using errcode = '22023';
  end if;
  for child_payload in
    select listed.value
    from jsonb_array_elements(p_item -> 'editions') listed(value)
  loop
    if jsonb_typeof(child_payload -> 'metadata') is distinct from 'object'
      or jsonb_typeof(child_payload -> 'is_primary') is distinct from 'boolean'
      or jsonb_typeof(child_payload -> 'publication_year')
        not in ('null', 'number')
      or jsonb_typeof(child_payload -> 'page_count') not in ('null', 'number')
      or jsonb_typeof(child_payload -> 'rights_checked_at')
        not in ('null', 'string') then
      raise exception 'Release edition row has invalid typed values'
        using errcode = '22023';
    end if;
    if jsonb_typeof(child_payload -> 'publication_year') = 'number' then
      perform (child_payload ->> 'publication_year')::integer;
    end if;
    if jsonb_typeof(child_payload -> 'page_count') = 'number' then
      perform (child_payload ->> 'page_count')::integer;
    end if;
    if jsonb_typeof(child_payload -> 'rights_checked_at') = 'string' then
      perform (child_payload ->> 'rights_checked_at')::date;
    end if;
  end loop;

  if not public.literary_archive_release_array_has_keys(
    p_item -> 'artworks',
    array[
      'cover_url', 'thumbnail_url', 'cover_width', 'cover_height',
      'thumbnail_width', 'thumbnail_height', 'rights_status',
      'cover_source_url', 'rights_checked_at', 'source_archive_sha256',
      'source_image_sha256', 'source_filename', 'source_relative_path',
      'source_index', 'is_primary', 'provenance'
    ],
    array[
      'cover_url', 'thumbnail_url', 'cover_width', 'cover_height',
      'thumbnail_width', 'thumbnail_height', 'rights_status',
      'cover_source_url', 'rights_checked_at', 'source_archive_sha256',
      'source_image_sha256', 'source_filename', 'source_relative_path',
      'source_index', 'is_primary', 'provenance'
    ]
  ) or jsonb_array_length(p_item -> 'artworks') > 100 then
    raise exception 'Release artworks array is invalid or exceeds 100 rows'
      using errcode = '22023';
  end if;
  for child_payload in
    select listed.value
    from jsonb_array_elements(p_item -> 'artworks') listed(value)
  loop
    if jsonb_typeof(child_payload -> 'provenance') is distinct from 'object'
      or jsonb_typeof(child_payload -> 'is_primary') is distinct from 'boolean'
      or coalesce(child_payload ->> 'source_archive_sha256', '')
        !~ '^[0-9a-f]{64}$'
      or coalesce(child_payload ->> 'source_image_sha256', '')
        !~ '^[0-9a-f]{64}$'
      or coalesce(child_payload ->> 'source_index', '')
        !~ '^[1-9][0-9]*$' then
      raise exception 'Release artwork row has invalid provenance or identity'
        using errcode = '22023';
    end if;
    perform (child_payload ->> 'cover_width')::integer;
    perform (child_payload ->> 'cover_height')::integer;
    perform (child_payload ->> 'thumbnail_width')::integer;
    perform (child_payload ->> 'thumbnail_height')::integer;
    perform (child_payload ->> 'source_index')::integer;
    perform (child_payload ->> 'rights_checked_at')::date;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_item -> 'authors') listed(value)
    group by listed.value ->> 'position'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_item -> 'translations') listed(value)
    group by listed.value ->> 'locale'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_item -> 'sources') listed(value)
    group by listed.value ->> 'provider', listed.value ->> 'source_url'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_item -> 'externalIds') listed(value)
    group by listed.value ->> 'scheme', listed.value ->> 'external_id'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_item -> 'editions') listed(value)
    group by listed.value ->> 'legacy_id'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_item -> 'artworks') listed(value)
    group by
      listed.value ->> 'source_archive_sha256',
      listed.value ->> 'source_image_sha256'
    having count(*) > 1
  ) then
    raise exception 'Release item contains a duplicate child identity'
      using errcode = '22023';
  end if;

  if 1 < (
    select count(*)
    from jsonb_array_elements(p_item -> 'editions') listed(value)
    where coalesce((listed.value ->> 'is_primary')::boolean, false)
  ) or 1 < (
    select count(*)
    from jsonb_array_elements(p_item -> 'artworks') listed(value)
    where coalesce((listed.value ->> 'is_primary')::boolean, false)
  ) then
    raise exception 'A release item may have at most one primary edition/artwork'
      using errcode = '23514';
  end if;

  attestation_payload := p_item -> 'attestation';
  if jsonb_typeof(attestation_payload) <> 'null' then
    if not public.literary_archive_release_object_has_keys(
      attestation_payload,
      array['expectedContent', 'evidence', 'reviewer', 'reviewedAt'],
      array['expectedContent', 'evidence', 'reviewer', 'reviewedAt']
    ) or jsonb_typeof(attestation_payload -> 'expectedContent')
        is distinct from 'object'
      or jsonb_typeof(attestation_payload -> 'evidence')
        is distinct from 'object'
      or attestation_payload -> 'expectedContent'
        is distinct from p_item -> 'expectedContent'
      or attestation_payload #>> '{evidence,recordKey}'
        is distinct from item_legacy_id then
      raise exception 'Release Evidence V2 attestation payload is invalid'
        using errcode = '22023';
    end if;
    perform (attestation_payload ->> 'reviewedAt')::date;
  end if;
end;
$$;

revoke all on function public.validate_literary_archive_release_item(
  jsonb,
  integer
) from public, anon, authenticated, service_role;

create or replace function public.literary_archive_release_manifest_entry(
  p_ordinal integer,
  p_legacy_id text,
  p_payload_sha256 text
)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select p_ordinal::text || ':' || pg_catalog.encode(
    pg_catalog.convert_to(p_legacy_id, 'UTF8'),
    'hex'
  ) || ':' || p_payload_sha256;
$$;

revoke all on function public.literary_archive_release_manifest_entry(
  integer,
  text,
  text
) from public, anon, authenticated, service_role;

create or replace function public.literary_archive_release_manifest_sha256(
  p_release_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.literary_work_evidence_v2_sha256(
    coalesce(string_agg(
      public.literary_archive_release_manifest_entry(
        item.ordinal,
        item.legacy_id,
        item.payload_sha256
      ),
      E'\n' order by item.ordinal
    ), '')
  )
  from public.literary_archive_release_items item
  where item.release_id = p_release_id;
$$;

revoke all on function public.literary_archive_release_manifest_sha256(uuid)
  from public, anon, authenticated, service_role;

create or replace function
  public.literary_archive_release_unlocked_scope_sha256()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.literary_work_evidence_v2_sha256(
    coalesce(string_agg(
      pg_catalog.encode(
        pg_catalog.convert_to(work.legacy_id, 'UTF8'),
        'hex'
      ) || ':' || pg_catalog.encode(
        pg_catalog.convert_to(
          pg_catalog.to_char(
            work.updated_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ),
          'UTF8'
        ),
        'hex'
      ) || ':' ||
        public.literary_work_evidence_v2_content_sha256(work.id),
      E'\n' order by work.legacy_id collate "C"
    ), '')
  )
  from public.literary_works work
  where not work.is_cms_locked;
$$;

revoke all on function public.literary_archive_release_unlocked_scope_sha256()
  from public, anon, authenticated, service_role;

create or replace function
  public.literary_archive_release_predecessor_legacy_manifest_sha256()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.literary_work_evidence_v2_sha256(
    coalesce(string_agg(
      pg_catalog.encode(
        pg_catalog.convert_to(work.legacy_id, 'UTF8'),
        'hex'
      ),
      E'\n' order by work.legacy_id collate "C"
    ), '')
  )
  from public.literary_works work
  where public.is_publishable_literary_work_pre_evidence_v2(work.id);
$$;

revoke all on function
  public.literary_archive_release_predecessor_legacy_manifest_sha256()
  from public, anon, authenticated, service_role;

-- A content-addressed projection of the complete unlocked live archive. The
-- manifest covers the work row, all six replaceable child sets (including
-- editions and artworks) through the Evidence V2 content hash, and the exact
-- Evidence V2 attestation state. CMS-locked rows are deliberately outside the
-- replaceable target and remain protected by the predecessor precondition.
create or replace function
  public.literary_archive_live_target_manifest_sha256()
returns text
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select public.literary_work_evidence_v2_sha256(
    coalesce(string_agg(
      pg_catalog.encode(
        pg_catalog.convert_to(work.legacy_id, 'UTF8'),
        'hex'
      ) || ':' ||
      public.literary_work_evidence_v2_content_sha256(work.id) || ':' ||
      case when attestation.work_id is null then '~' else
        pg_catalog.encode(
          pg_catalog.convert_to(attestation.contract_version, 'UTF8'),
          'hex'
        ) || ':' ||
        attestation.work_content_sha256 || ':' ||
        attestation.evidence_sha256 || ':' ||
        pg_catalog.encode(
          pg_catalog.convert_to(attestation.reviewer, 'UTF8'),
          'hex'
        ) || ':' ||
        attestation.reviewed_at::text
      end,
      E'\n' order by work.legacy_id collate "C"
    ), '')
  )
  from public.literary_works work
  left join public.literary_work_evidence_v2_attestations attestation
    on attestation.work_id = work.id
  where not work.is_cms_locked;
$$;

revoke all on function
  public.literary_archive_live_target_manifest_sha256()
  from public, anon, authenticated, service_role;

create or replace function public.get_literary_archive_release_precondition()
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
    'unlockedWorks', (
      select count(*)
      from public.literary_works work
      where not work.is_cms_locked
    ),
    'unlockedScopeSha256',
      public.literary_archive_release_unlocked_scope_sha256(),
    'childEditPreservation',
      public.literary_archive_child_edit_preservation_receipt(),
    'predecessorPublic', (
      select count(*)
      from public.literary_works work
      where public.is_publishable_literary_work_pre_evidence_v2(work.id)
    ),
    'predecessorLegacyManifestSha256',
      public.literary_archive_release_predecessor_legacy_manifest_sha256(),
    'cmsLockedPredecessorLegacyIds', coalesce((
      select jsonb_agg(
        work.legacy_id order by work.legacy_id collate "C"
      )
      from public.literary_works work
      where work.is_cms_locked
        and public.is_publishable_literary_work_pre_evidence_v2(work.id)
    ), '[]'::jsonb),
    'cmsLockedUnattestedPredecessorLegacyIds', coalesce((
      select jsonb_agg(
        work.legacy_id order by work.legacy_id collate "C"
      )
      from public.literary_works work
      where work.is_cms_locked
        and public.is_publishable_literary_work_pre_evidence_v2(work.id)
        and not public.is_literary_work_evidence_v2_attested(work.id)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_literary_archive_release_precondition()
  from public, anon, authenticated, service_role;
grant execute on function public.get_literary_archive_release_precondition()
  to service_role;

-- One read-only, statement-snapshot postflight. It binds the durable commit
-- receipt to its immutable staged expectedContent/attestation payloads and
-- proves the complete unlocked live archive still materializes that target.
create or replace function public.assert_literary_archive_live_target(
  p_release_id uuid,
  p_expected_committed_manifest_sha256 text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  target public.literary_archive_releases%rowtype;
  actual_unlocked_work_count integer;
  actual_live_target_manifest_sha256 text;
  actual_predecessor_public_count integer;
  actual_predecessor_public_manifest_sha256 text;
  actual_child_edit_preservation jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if p_release_id is null
    or coalesce(p_expected_committed_manifest_sha256, '')
      !~ '^[0-9a-f]{64}$' then
    raise exception 'Release ID and committed manifest are required'
      using errcode = '22023';
  end if;

  select release.*
  into target
  from public.literary_archive_releases release
  where release.id = p_release_id;
  if target.id is null
    or target.status <> 'committed'
    or target.committed_manifest_sha256 is distinct from
      p_expected_committed_manifest_sha256
    or target.commit_receipt ->> 'manifestSha256' is distinct from
      p_expected_committed_manifest_sha256
    or public.literary_archive_release_manifest_sha256(target.id)
      is distinct from p_expected_committed_manifest_sha256
    or (
      select count(*)
      from public.literary_archive_release_items item
      where item.release_id = target.id
    ) <> target.expected_item_count then
    raise exception 'Committed release receipt or staged manifest is invalid'
      using errcode = '40001';
  end if;

  actual_child_edit_preservation :=
    public.literary_archive_child_edit_preservation_receipt();
  if actual_child_edit_preservation is distinct from
      target.expected_child_edit_preservation
    or target.commit_receipt -> 'childEditPreservation' is distinct from
      target.expected_child_edit_preservation then
    raise exception
      'Historical child-edit preservation receipt differs from committed release'
      using errcode = '40001';
  end if;

  select count(*)::integer
  into actual_unlocked_work_count
  from public.literary_works work
  where not work.is_cms_locked;

  if actual_unlocked_work_count <> target.expected_item_count
    or exists (
      select 1
      from public.literary_archive_release_items item
      left join public.literary_works work
        on work.legacy_id = item.legacy_id
      where item.release_id = target.id
        and (
          work.id is null
          or work.is_cms_locked
          or public.literary_work_evidence_v2_content(work.id)
            is distinct from item.payload -> 'expectedContent'
        )
    )
    or exists (
      select 1
      from public.literary_works work
      where not work.is_cms_locked
        and not exists (
          select 1
          from public.literary_archive_release_items item
          where item.release_id = target.id
            and item.legacy_id = work.legacy_id
        )
    ) then
    raise exception 'Live core archive differs from staged expectedContent'
      using errcode = '40001';
  end if;

  if exists (
    select 1
    from public.literary_archive_release_items item
    join public.literary_works work
      on work.legacy_id = item.legacy_id
    left join public.literary_work_evidence_v2_attestations attestation
      on attestation.work_id = work.id
    where item.release_id = target.id
      and case
        when jsonb_typeof(item.payload -> 'attestation') = 'null' then
          attestation.work_id is not null
        else
          attestation.work_id is null
          or attestation.contract_version is distinct from 'book-evidence-v2'
          or attestation.work_content_sha256 is distinct from
            public.literary_work_evidence_v2_sha256(
              (item.payload -> 'expectedContent')::text
            )
          or attestation.evidence_sha256 is distinct from
            public.literary_work_evidence_v2_sha256(
              (item.payload #> '{attestation,evidence}')::text
            )
          or attestation.reviewer is distinct from
            btrim(item.payload #>> '{attestation,reviewer}')
          or attestation.reviewed_at is distinct from
            (item.payload #>> '{attestation,reviewedAt}')::date
      end
  ) then
    raise exception 'Live Evidence V2 attestations differ from staged target'
      using errcode = '40001';
  end if;

  actual_live_target_manifest_sha256 :=
    public.literary_archive_live_target_manifest_sha256();

  select count(*)::integer
  into actual_predecessor_public_count
  from public.literary_works work
  where public.is_publishable_literary_work_pre_evidence_v2(work.id);

  actual_predecessor_public_manifest_sha256 :=
    public.literary_archive_release_predecessor_legacy_manifest_sha256();

  if actual_predecessor_public_count is distinct from
      target.expected_predecessor_public_count
    or actual_predecessor_public_manifest_sha256 is distinct from
      target.expected_predecessor_public_manifest_sha256 then
    raise exception 'Live predecessor-public set differs from committed target'
      using errcode = '40001';
  end if;

  return jsonb_build_object(
    'releaseId', target.id,
    'committedManifestSha256', target.committed_manifest_sha256,
    'unlockedWorks', actual_unlocked_work_count,
    'childEditPreservation', actual_child_edit_preservation,
    'liveTargetManifestSha256', actual_live_target_manifest_sha256,
    'predecessorPublic', actual_predecessor_public_count,
    'predecessorPublicManifestSha256',
      actual_predecessor_public_manifest_sha256
  );
end;
$$;

revoke all on function public.assert_literary_archive_live_target(
  uuid,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.assert_literary_archive_live_target(
  uuid,
  text
) to service_role;

create or replace function public.create_literary_archive_release(
  p_release_key text,
  p_source_revision text,
  p_expected_item_count integer,
  p_expected_batch_count integer,
  p_expected_unlocked_work_count integer,
  p_expected_unlocked_scope_sha256 text,
  p_expected_child_edit_preservation jsonb,
  p_expected_target_manifest_sha256 text,
  p_expected_predecessor_public_count integer,
  p_expected_predecessor_public_manifest_sha256 text,
  p_enable_evidence_v2 boolean,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  normalized_release_key text := nullif(btrim(p_release_key), '');
  normalized_source_revision text := nullif(btrim(p_source_revision), '');
  target public.literary_archive_releases%rowtype;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if normalized_release_key is null
    or normalized_release_key !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{6,159}$'
    or normalized_source_revision is null
    or char_length(normalized_source_revision) not between 7 and 160 then
    raise exception 'Release key and source revision are invalid'
      using errcode = '22023';
  end if;
  if p_expected_item_count is null
    or p_expected_item_count not between 1 and 20000
    or p_expected_batch_count is null
    or p_expected_batch_count not between 1 and 2000
    or p_expected_batch_count > p_expected_item_count
    or p_expected_batch_count < (p_expected_item_count + 99) / 100 then
    raise exception 'Release item/batch bounds are invalid'
      using errcode = '22023';
  end if;
  if p_expected_predecessor_public_count is null
    or p_expected_predecessor_public_count not between 0 and 20000
    or p_expected_unlocked_work_count is null
    or p_expected_unlocked_work_count not between 0 and 20000
    or coalesce(p_expected_unlocked_scope_sha256, '')
      !~ '^[0-9a-f]{64}$'
    or p_expected_child_edit_preservation is null
    or jsonb_typeof(p_expected_child_edit_preservation) <> 'object'
    or coalesce(p_expected_target_manifest_sha256, '')
      !~ '^[0-9a-f]{64}$'
    or coalesce(p_expected_predecessor_public_manifest_sha256, '')
      !~ '^[0-9a-f]{64}$'
    or p_enable_evidence_v2 is null
    or p_metadata is null
    or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Release publication expectation or metadata is invalid'
      using errcode = '22023';
  end if;
  select release.*
  into target
  from public.literary_archive_releases release
  where release.release_key = normalized_release_key
  for update;
  if not found then
    if p_expected_unlocked_work_count <> (
        select count(*)::integer
        from public.literary_works work
        where not work.is_cms_locked
      ) or p_expected_unlocked_scope_sha256 is distinct from
        public.literary_archive_release_unlocked_scope_sha256() then
      raise exception 'Live unlocked archive scope changed before release creation'
        using errcode = '40001';
    end if;
    if p_expected_child_edit_preservation is distinct from
        public.literary_archive_child_edit_preservation_receipt() then
      raise exception
        'Historical child-edit preservation changed before release creation'
        using errcode = '40001';
    end if;

    insert into public.literary_archive_releases (
      release_key,
      source_revision,
      expected_item_count,
      expected_batch_count,
      expected_unlocked_work_count,
      expected_unlocked_scope_sha256,
      expected_child_edit_preservation,
      expected_target_manifest_sha256,
      expected_predecessor_public_count,
      expected_predecessor_public_manifest_sha256,
      enable_evidence_v2,
      metadata
    ) values (
      normalized_release_key,
      normalized_source_revision,
      p_expected_item_count,
      p_expected_batch_count,
      p_expected_unlocked_work_count,
      p_expected_unlocked_scope_sha256,
      p_expected_child_edit_preservation,
      p_expected_target_manifest_sha256,
      p_expected_predecessor_public_count,
      p_expected_predecessor_public_manifest_sha256,
      p_enable_evidence_v2,
      p_metadata
    )
    on conflict (release_key) do nothing;

    select release.*
    into target
    from public.literary_archive_releases release
    where release.release_key = normalized_release_key
    for update;
  end if;

  if target.source_revision is distinct from normalized_source_revision
    or target.expected_item_count is distinct from p_expected_item_count
    or target.expected_batch_count is distinct from p_expected_batch_count
    or target.expected_unlocked_work_count is distinct from
      p_expected_unlocked_work_count
    or target.expected_unlocked_scope_sha256 is distinct from
      p_expected_unlocked_scope_sha256
    or target.expected_child_edit_preservation is distinct from
      p_expected_child_edit_preservation
    or target.expected_target_manifest_sha256 is distinct from
      p_expected_target_manifest_sha256
    or target.expected_predecessor_public_count is distinct from
      p_expected_predecessor_public_count
    or target.expected_predecessor_public_manifest_sha256 is distinct from
      p_expected_predecessor_public_manifest_sha256
    or target.enable_evidence_v2 is distinct from p_enable_evidence_v2
    or target.metadata is distinct from p_metadata then
    raise exception 'Release key is already bound to a different manifest'
      using errcode = '23505';
  end if;

  return jsonb_build_object(
    'releaseId', target.id,
    'releaseKey', target.release_key,
    'sourceRevision', target.source_revision,
    'contractVersion', target.contract_version,
    'status', target.status,
    'expectedItems', target.expected_item_count,
    'expectedBatches', target.expected_batch_count,
    'expectedChildEditPreservation',
      target.expected_child_edit_preservation,
    'expectedTargetManifestSha256', target.expected_target_manifest_sha256,
    'stagedItems', target.staged_item_count,
    'stagedBatches', target.staged_batch_count,
    'manifestSha256', coalesce(
      target.committed_manifest_sha256,
      target.staged_manifest_sha256,
      public.literary_archive_release_manifest_sha256(target.id)
    ),
    'commitReceipt', target.commit_receipt
  );
end;
$$;

revoke all on function public.create_literary_archive_release(
  text,
  text,
  integer,
  integer,
  integer,
  text,
  jsonb,
  text,
  integer,
  text,
  boolean,
  jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.create_literary_archive_release(
  text,
  text,
  integer,
  integer,
  integer,
  text,
  jsonb,
  text,
  integer,
  text,
  boolean,
  jsonb
) to service_role;

create or replace function public.stage_literary_archive_release_batch(
  p_release_id uuid,
  p_batch_number integer,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target public.literary_archive_releases%rowtype;
  existing_batch public.literary_archive_release_batches%rowtype;
  item jsonb;
  parsed_item jsonb;
  canonical_payload text;
  incoming_count integer;
  incoming_first_ordinal integer;
  incoming_last_ordinal integer;
  incoming_batch_sha256 text;
  receipt_items jsonb;
  current_manifest_sha256 text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if p_release_id is null
    or p_batch_number is null
    or p_items is null
    or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Release, batch number and item array are required'
      using errcode = '22023';
  end if;

  select release.*
  into target
  from public.literary_archive_releases release
  where release.id = p_release_id
  for update;
  if not found then
    raise exception 'Literary archive release not found'
      using errcode = 'P0002';
  end if;
  if p_batch_number < 1 or p_batch_number > target.expected_batch_count then
    raise exception 'Batch number is outside the declared manifest'
      using errcode = '22023';
  end if;

  incoming_count := jsonb_array_length(p_items);
  if incoming_count not between 1 and 100 then
    raise exception 'Every staging batch must contain 1 to 100 items'
      using errcode = '22023';
  end if;
  if pg_catalog.octet_length(
    pg_catalog.convert_to(p_items::text, 'UTF8')
  ) > 8388608 then
    raise exception 'Staging batch exceeds the 8 MiB request limit'
      using errcode = '22023';
  end if;
  for item in
    select listed.value
    from jsonb_array_elements(p_items) listed(value)
  loop
    if not public.literary_archive_release_object_has_keys(
      item,
      array['ordinal', 'legacyId', 'canonicalPayload', 'payloadSha256'],
      array['ordinal', 'legacyId', 'canonicalPayload', 'payloadSha256']
    ) or jsonb_typeof(item -> 'canonicalPayload') is distinct from 'string'
      or coalesce(item ->> 'payloadSha256', '') !~ '^[0-9a-f]{64}$' then
      raise exception 'Staging envelope has missing or unknown fields'
        using errcode = '22023';
    end if;
    canonical_payload := item ->> 'canonicalPayload';
    if pg_catalog.octet_length(
        pg_catalog.convert_to(canonical_payload, 'UTF8')
      ) > 262144
      or public.literary_work_evidence_v2_sha256(canonical_payload)
        is distinct from item ->> 'payloadSha256' then
      raise exception 'Staging payload exceeds bounds or its SHA-256 mismatches'
        using errcode = '23514';
    end if;
    begin
      parsed_item := canonical_payload::jsonb;
    exception when others then
      raise exception 'Canonical staging payload is not valid JSON'
        using errcode = '22023';
    end;
    if item ->> 'ordinal' is distinct from parsed_item ->> 'ordinal'
      or item ->> 'legacyId' is distinct from parsed_item ->> 'legacyId' then
      raise exception 'Staging envelope identity does not match its payload'
        using errcode = '23514';
    end if;
    perform public.validate_literary_archive_release_item(
      parsed_item,
      target.expected_item_count
    );
  end loop;
  if exists (
    select 1
    from jsonb_array_elements(p_items) listed(value)
    group by listed.value ->> 'ordinal'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_items) listed(value)
    group by listed.value ->> 'legacyId'
    having count(*) > 1
  ) then
    raise exception 'A batch contains duplicate ordinals or legacy IDs'
      using errcode = '22023';
  end if;

  select
    min((listed.value ->> 'ordinal')::integer),
    max((listed.value ->> 'ordinal')::integer),
    jsonb_agg(
      jsonb_build_object(
        'ordinal', (listed.value ->> 'ordinal')::integer,
        'legacyId', listed.value ->> 'legacyId',
        'payloadSha256', listed.value ->> 'payloadSha256',
        'payload', (listed.value ->> 'canonicalPayload')::jsonb
      ) order by (listed.value ->> 'ordinal')::integer
    )
  into
    incoming_first_ordinal,
    incoming_last_ordinal,
    receipt_items
  from jsonb_array_elements(p_items) listed(value);

  if incoming_last_ordinal - incoming_first_ordinal + 1 <> incoming_count then
    raise exception 'Batch ordinals must be contiguous'
      using errcode = '22023';
  end if;
  select public.literary_work_evidence_v2_sha256(
    coalesce(string_agg(
      public.literary_archive_release_manifest_entry(
        (listed.value ->> 'ordinal')::integer,
        listed.value ->> 'legacyId',
        listed.value ->> 'payloadSha256'
      ),
      E'\n' order by (listed.value ->> 'ordinal')::integer
    ), '')
  )
  into incoming_batch_sha256
  from jsonb_array_elements(p_items) listed(value);

  select batch.*
  into existing_batch
  from public.literary_archive_release_batches batch
  where batch.release_id = target.id
    and batch.batch_number = p_batch_number;
  if found then
    if existing_batch.item_count <> incoming_count
      or existing_batch.first_ordinal <> incoming_first_ordinal
      or existing_batch.last_ordinal <> incoming_last_ordinal
      or existing_batch.batch_sha256 <> incoming_batch_sha256 then
      raise exception 'Batch number is already bound to different content'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'releaseId', target.id,
      'releaseKey', target.release_key,
      'status', target.status,
      'batchNumber', existing_batch.batch_number,
      'itemCount', existing_batch.item_count,
      'batchSha256', existing_batch.batch_sha256,
      'items', receipt_items,
      'stagedItems', target.staged_item_count,
      'stagedBatches', target.staged_batch_count,
      'manifestSha256', coalesce(
        target.committed_manifest_sha256,
        target.staged_manifest_sha256
      ),
      'idempotent', true
    );
  end if;
  if target.status <> 'staging' then
    raise exception 'Committed releases cannot accept new batches'
      using errcode = '55000';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) incoming(value)
    join public.literary_archive_release_items existing
      on existing.release_id = target.id
     and (
       existing.ordinal = (incoming.value ->> 'ordinal')::integer
       or existing.legacy_id = incoming.value ->> 'legacyId'
     )
  ) then
    raise exception 'Batch overlaps an ordinal or legacy ID already staged'
      using errcode = '23505';
  end if;

  insert into public.literary_archive_release_batches (
    release_id,
    batch_number,
    first_ordinal,
    last_ordinal,
    item_count,
    batch_sha256
  ) values (
    target.id,
    p_batch_number,
    incoming_first_ordinal,
    incoming_last_ordinal,
    incoming_count,
    incoming_batch_sha256
  );

  insert into public.literary_archive_release_items (
    release_id,
    batch_number,
    ordinal,
    legacy_id,
    expected_live_exists,
    expected_live_updated_at,
    expected_live_integrity_sha256,
    canonical_payload,
    payload,
    payload_sha256
  )
  select
    target.id,
    p_batch_number,
    (listed.value ->> 'ordinal')::integer,
    listed.value ->> 'legacyId',
    (parsed.payload #>> '{expectedLive,exists}')::boolean,
    case
      when (parsed.payload #>> '{expectedLive,exists}')::boolean
        then (parsed.payload #>> '{expectedLive,updatedAt}')::timestamptz
      else null
    end,
    nullif(parsed.payload #>> '{expectedLive,integritySha256}', ''),
    listed.value ->> 'canonicalPayload',
    parsed.payload,
    listed.value ->> 'payloadSha256'
  from jsonb_array_elements(p_items) listed(value)
  cross join lateral (
    select (listed.value ->> 'canonicalPayload')::jsonb as payload
  ) parsed;

  current_manifest_sha256 :=
    public.literary_archive_release_manifest_sha256(target.id);
  update public.literary_archive_releases release
  set
    staged_item_count = (
      select count(*)::integer
      from public.literary_archive_release_items staged_item
      where staged_item.release_id = target.id
    ),
    staged_batch_count = (
      select count(*)::integer
      from public.literary_archive_release_batches staged_batch
      where staged_batch.release_id = target.id
    ),
    staged_manifest_sha256 = current_manifest_sha256
  where release.id = target.id
  returning release.* into target;

  if target.staged_item_count = target.expected_item_count
    and target.staged_batch_count = target.expected_batch_count
    and target.staged_manifest_sha256 is distinct from
      target.expected_target_manifest_sha256 then
    raise exception 'Completed staging does not match the create-bound manifest'
      using errcode = '23514';
  end if;

  return jsonb_build_object(
    'releaseId', target.id,
    'releaseKey', target.release_key,
    'status', target.status,
    'batchNumber', p_batch_number,
    'itemCount', incoming_count,
    'batchSha256', incoming_batch_sha256,
    'items', receipt_items,
    'stagedItems', target.staged_item_count,
    'stagedBatches', target.staged_batch_count,
    'manifestSha256', target.staged_manifest_sha256,
    'idempotent', false
  );
end;
$$;

revoke all on function public.stage_literary_archive_release_batch(
  uuid,
  integer,
  jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.stage_literary_archive_release_batch(
  uuid,
  integer,
  jsonb
) to service_role;

create or replace function public.commit_literary_archive_release(
  p_release_id uuid,
  p_expected_manifest_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target public.literary_archive_releases%rowtype;
  staged_item record;
  recomputed_manifest_sha256 text;
  predecessor_manifest_sha256 text;
  predecessor_legacy_manifest_sha256 text;
  predecessor_public_count integer;
  invalid_attestation_count integer;
  staged_attestation_count integer := 0;
  gate_already_enabled boolean;
  child_edit_preservation jsonb;
  commit_time timestamptz;
  receipt jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required' using errcode = '42501';
  end if;
  if p_release_id is null
    or coalesce(p_expected_manifest_sha256, '')
      !~ '^[0-9a-f]{64}$' then
    raise exception 'Release ID and expected manifest SHA-256 are required'
      using errcode = '22023';
  end if;

  select release.*
  into target
  from public.literary_archive_releases release
  where release.id = p_release_id
  for update;
  if not found then
    raise exception 'Literary archive release not found'
      using errcode = 'P0002';
  end if;
  if target.status = 'committed' then
    if target.committed_manifest_sha256 <> p_expected_manifest_sha256 then
      raise exception 'Committed release manifest does not match the retry'
        using errcode = '40001';
    end if;
    return target.commit_receipt || jsonb_build_object('idempotent', true);
  end if;

  -- Only one full archive commit may run at a time. SHARE ROW EXCLUSIVE blocks
  -- every concurrent writer while allowing public readers to retain their old
  -- MVCC snapshot until this transaction commits.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'literary-archive-atomic-release-v1',
      20260902
    )
  );
  lock table
    public.literary_work_authors,
    public.literary_work_translations,
    public.literary_work_sources,
    public.literary_work_external_ids,
    public.book_editions,
    public.literary_work_cover_artworks,
    public.literary_archive_child_edit_preservations,
    public.literary_archive_child_edit_preservation_controls,
    public.literary_works,
    public.literary_work_evidence_v2_attestations,
    public.literary_work_evidence_v2_controls
  in share row exclusive mode nowait;

  -- This NOWAIT row barrier closes the only race left by table locks: a normal
  -- attestation takes its per-work advisory lock before reading the control
  -- row. If it already passed that point, this release aborts and is retryable;
  -- otherwise it waits here without blocking the release's per-work changes.
  select control.enforcement_enabled
  into gate_already_enabled
  from public.literary_work_evidence_v2_controls control
  where control.singleton
  for update nowait;
  if not found then
    raise exception 'Evidence V2 control row is missing'
      using errcode = '55000';
  end if;
  perform pg_catalog.set_config(
    'probpera.literary_archive_atomic_release',
    'on',
    true
  );

  child_edit_preservation :=
    public.literary_archive_child_edit_preservation_receipt();
  if child_edit_preservation is distinct from
      target.expected_child_edit_preservation then
    raise exception
      'Historical child-edit preservation changed before atomic commit'
      using errcode = '40001';
  end if;

  if target.staged_item_count <> target.expected_item_count
    or target.staged_batch_count <> target.expected_batch_count
    or target.staged_item_count <> (
      select count(*)::integer
      from public.literary_archive_release_items item
      where item.release_id = target.id
    )
    or target.staged_batch_count <> (
      select count(*)::integer
      from public.literary_archive_release_batches batch
      where batch.release_id = target.id
    ) then
    raise exception 'Release staging coverage is incomplete'
      using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.literary_archive_release_items item
    where item.release_id = target.id
    having min(item.ordinal) = 0
      and max(item.ordinal) = target.expected_item_count - 1
      and count(*) = target.expected_item_count
  ) or not exists (
    select 1
    from public.literary_archive_release_batches batch
    where batch.release_id = target.id
    having min(batch.batch_number) = 1
      and max(batch.batch_number) = target.expected_batch_count
      and count(*) = target.expected_batch_count
      and sum(batch.item_count) = target.expected_item_count
  ) then
    raise exception 'Release ordinals or batch numbers are not contiguous'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.literary_archive_release_items item
    where item.release_id = target.id
      and (
        item.payload_sha256 <>
          public.literary_work_evidence_v2_sha256(item.canonical_payload)
        or item.payload is distinct from item.canonical_payload::jsonb
        or item.ordinal <> (item.payload ->> 'ordinal')::integer
        or item.legacy_id is distinct from item.payload ->> 'legacyId'
        or item.expected_live_exists is distinct from
          (item.payload #>> '{expectedLive,exists}')::boolean
        or item.expected_live_updated_at is distinct from case
          when (item.payload #>> '{expectedLive,exists}')::boolean
            then (item.payload #>> '{expectedLive,updatedAt}')::timestamptz
          else null
        end
        or item.expected_live_integrity_sha256 is distinct from
          nullif(item.payload #>> '{expectedLive,integritySha256}', '')
      )
  ) or exists (
    select 1
    from public.literary_archive_release_batches batch
    where batch.release_id = target.id
      and (
        batch.item_count <> (
          select count(*)::integer
          from public.literary_archive_release_items item
          where item.release_id = batch.release_id
            and item.batch_number = batch.batch_number
        )
        or batch.first_ordinal <> (
          select min(item.ordinal)
          from public.literary_archive_release_items item
          where item.release_id = batch.release_id
            and item.batch_number = batch.batch_number
        )
        or batch.last_ordinal <> (
          select max(item.ordinal)
          from public.literary_archive_release_items item
          where item.release_id = batch.release_id
            and item.batch_number = batch.batch_number
        )
        or batch.batch_sha256 <> (
          select public.literary_work_evidence_v2_sha256(
            coalesce(string_agg(
              public.literary_archive_release_manifest_entry(
                item.ordinal,
                item.legacy_id,
                item.payload_sha256
              ),
              E'\n' order by item.ordinal
            ), '')
          )
          from public.literary_archive_release_items item
          where item.release_id = batch.release_id
            and item.batch_number = batch.batch_number
        )
      )
  ) then
    raise exception 'Release staging receipt verification failed'
      using errcode = '23514';
  end if;

  for staged_item in
    select item.payload
    from public.literary_archive_release_items item
    where item.release_id = target.id
    order by item.ordinal
  loop
    perform public.validate_literary_archive_release_item(
      staged_item.payload,
      target.expected_item_count
    );
  end loop;

  recomputed_manifest_sha256 :=
    public.literary_archive_release_manifest_sha256(target.id);
  if target.staged_manifest_sha256 is distinct from
      recomputed_manifest_sha256
    or target.expected_target_manifest_sha256 is distinct from
      recomputed_manifest_sha256
    or recomputed_manifest_sha256 <> p_expected_manifest_sha256 then
    raise exception 'Release manifest SHA-256 mismatch'
      using errcode = '40001';
  end if;

  if target.expected_unlocked_work_count <> (
      select count(*)::integer
      from public.literary_works work
      where not work.is_cms_locked
    ) or target.expected_unlocked_scope_sha256 is distinct from
      public.literary_archive_release_unlocked_scope_sha256() then
    raise exception 'Unlocked live archive scope changed after release creation'
      using errcode = '40001';
  end if;

  -- Reject inserts that unexpectedly became updates, missing expected rows,
  -- every CMS-owned parent, direct work edits and child-only edits. The latter
  -- are covered by the content hash even for privileged service mutations.
  if exists (
    select 1
    from public.literary_archive_release_items item
    left join public.literary_works work
      on work.legacy_id = item.legacy_id
    where item.release_id = target.id
      and item.expected_live_exists <> (work.id is not null)
  ) then
    raise exception 'Live work existence changed after release staging'
      using errcode = '40001';
  end if;
  if exists (
    select 1
    from public.literary_archive_release_items item
    join public.literary_works work
      on work.legacy_id = item.legacy_id
    where item.release_id = target.id
      and (
        work.is_cms_locked
        or work.updated_at is distinct from item.expected_live_updated_at
        or public.literary_work_evidence_v2_content_sha256(work.id)
          is distinct from item.expected_live_integrity_sha256
      )
  ) then
    raise exception 'CMS lock or stale live content blocks archive release'
      using errcode = '40001';
  end if;

  set constraints all deferred;

  -- Full replacement semantics: every currently unlocked work omitted from
  -- the exact target manifest is removed. CMS-locked rows are intentionally
  -- outside this delete and remain byte-for-byte under editorial ownership.
  delete from public.literary_works work
  where not work.is_cms_locked
    and not exists (
      select 1
      from public.literary_archive_release_items item
      where item.release_id = target.id
        and item.legacy_id = work.legacy_id
    );

  insert into public.literary_works (
    legacy_id,
    country_id,
    writer_id,
    title,
    slug,
    original_title,
    first_published,
    original_language,
    genres,
    tags,
    description,
    source_url,
    editorial_status,
    reviewed_at,
    metadata,
    authorship_kind
  )
  select
    item.payload #>> '{work,legacy_id}',
    item.payload #>> '{work,country_id}',
    item.payload #>> '{work,writer_id}',
    item.payload #>> '{work,title}',
    item.payload #>> '{work,slug}',
    item.payload #>> '{work,original_title}',
    (item.payload #>> '{work,first_published}')::integer,
    item.payload #>> '{work,original_language}',
    array(
      select jsonb_array_elements_text(item.payload #> '{work,genres}')
    ),
    array(
      select jsonb_array_elements_text(item.payload #> '{work,tags}')
    ),
    item.payload #>> '{work,description}',
    item.payload #>> '{work,source_url}',
    item.payload #>> '{work,editorial_status}',
    (item.payload #>> '{work,reviewed_at}')::date,
    item.payload #> '{work,metadata}',
    item.payload #>> '{work,authorship_kind}'
  from public.literary_archive_release_items item
  where item.release_id = target.id
  order by item.ordinal
  on conflict (legacy_id) do update set
    country_id = excluded.country_id,
    writer_id = excluded.writer_id,
    title = excluded.title,
    slug = excluded.slug,
    original_title = excluded.original_title,
    first_published = excluded.first_published,
    original_language = excluded.original_language,
    genres = excluded.genres,
    tags = excluded.tags,
    description = excluded.description,
    source_url = excluded.source_url,
    editorial_status = excluded.editorial_status,
    reviewed_at = excluded.reviewed_at,
    metadata = excluded.metadata,
    authorship_kind = excluded.authorship_kind;

  -- Full-set deletion is intentional. It removes stale rows that an upsert
  -- cannot see, and all inserts below bind children to the preserved/new work
  -- UUID by legacy_id inside this same transaction.
  delete from public.literary_work_authors child
  using public.literary_works work,
    public.literary_archive_release_items item
  where item.release_id = target.id
    and work.legacy_id = item.legacy_id
    and child.work_id = work.id;

  delete from public.literary_work_translations child
  using public.literary_works work,
    public.literary_archive_release_items item
  where item.release_id = target.id
    and work.legacy_id = item.legacy_id
    and child.work_id = work.id;

  delete from public.literary_work_sources child
  using public.literary_works work,
    public.literary_archive_release_items item
  where item.release_id = target.id
    and work.legacy_id = item.legacy_id
    and child.work_id = work.id;

  delete from public.literary_work_external_ids child
  using public.literary_works work,
    public.literary_archive_release_items item
  where item.release_id = target.id
    and work.legacy_id = item.legacy_id
    and child.work_id = work.id;

  delete from public.book_editions child
  using public.literary_works work,
    public.literary_archive_release_items item
  where item.release_id = target.id
    and work.legacy_id = item.legacy_id
    and child.work_id = work.id;

  delete from public.literary_work_cover_artworks child
  using public.literary_works work,
    public.literary_archive_release_items item
  where item.release_id = target.id
    and work.legacy_id = item.legacy_id
    and child.work_id = work.id;

  insert into public.literary_work_authors (
    work_id,
    position,
    writer_country_id,
    writer_id,
    credit_name_ru,
    credit_name_en,
    attribution_status,
    metadata
  )
  select
    work.id,
    (author.value ->> 'position')::smallint,
    author.value ->> 'writer_country_id',
    author.value ->> 'writer_id',
    author.value ->> 'credit_name_ru',
    author.value ->> 'credit_name_en',
    author.value ->> 'attribution_status',
    author.value -> 'metadata'
  from public.literary_archive_release_items item
  join public.literary_works work
    on work.legacy_id = item.legacy_id
  cross join lateral jsonb_array_elements(item.payload -> 'authors')
    author(value)
  where item.release_id = target.id
  order by item.ordinal, (author.value ->> 'position')::integer;

  insert into public.literary_work_translations (
    work_id,
    locale,
    title,
    description,
    source_language,
    translation_method,
    editorial_status,
    source_urls,
    reviewed_at,
    metadata
  )
  select
    work.id,
    translation.value ->> 'locale',
    translation.value ->> 'title',
    translation.value ->> 'description',
    translation.value ->> 'source_language',
    translation.value ->> 'translation_method',
    translation.value ->> 'editorial_status',
    array(
      select jsonb_array_elements_text(translation.value -> 'source_urls')
    ),
    (translation.value ->> 'reviewed_at')::date,
    translation.value -> 'metadata'
  from public.literary_archive_release_items item
  join public.literary_works work
    on work.legacy_id = item.legacy_id
  cross join lateral jsonb_array_elements(item.payload -> 'translations')
    translation(value)
  where item.release_id = target.id
  order by item.ordinal, translation.value ->> 'locale';

  insert into public.literary_work_sources (
    work_id,
    provider,
    source_url,
    field_names,
    license_name,
    usage,
    retrieved_at,
    metadata
  )
  select
    work.id,
    source.value ->> 'provider',
    source.value ->> 'source_url',
    array(
      select jsonb_array_elements_text(source.value -> 'field_names')
    ),
    source.value ->> 'license_name',
    source.value ->> 'usage',
    (source.value ->> 'retrieved_at')::date,
    source.value -> 'metadata'
  from public.literary_archive_release_items item
  join public.literary_works work
    on work.legacy_id = item.legacy_id
  cross join lateral jsonb_array_elements(item.payload -> 'sources')
    source(value)
  where item.release_id = target.id
  order by
    item.ordinal,
    source.value ->> 'provider',
    source.value ->> 'source_url';

  insert into public.literary_work_external_ids (
    work_id,
    scheme,
    external_id,
    source_url
  )
  select
    work.id,
    external_id.value ->> 'scheme',
    external_id.value ->> 'external_id',
    external_id.value ->> 'source_url'
  from public.literary_archive_release_items item
  join public.literary_works work
    on work.legacy_id = item.legacy_id
  cross join lateral jsonb_array_elements(item.payload -> 'externalIds')
    external_id(value)
  where item.release_id = target.id
  order by
    item.ordinal,
    external_id.value ->> 'scheme',
    external_id.value ->> 'external_id';

  insert into public.book_editions (
    legacy_id,
    work_id,
    title,
    isbn_10,
    isbn_13,
    publisher,
    publication_year,
    language,
    format,
    page_count,
    cover_url,
    cover_source_url,
    cover_rights_status,
    license_name,
    license_url,
    creator,
    rights_holder,
    rights_checked_at,
    source_url,
    is_primary,
    metadata
  )
  select
    edition.value ->> 'legacy_id',
    work.id,
    edition.value ->> 'title',
    edition.value ->> 'isbn_10',
    edition.value ->> 'isbn_13',
    edition.value ->> 'publisher',
    (edition.value ->> 'publication_year')::integer,
    edition.value ->> 'language',
    edition.value ->> 'format',
    (edition.value ->> 'page_count')::integer,
    edition.value ->> 'cover_url',
    edition.value ->> 'cover_source_url',
    edition.value ->> 'cover_rights_status',
    edition.value ->> 'license_name',
    edition.value ->> 'license_url',
    edition.value ->> 'creator',
    edition.value ->> 'rights_holder',
    (edition.value ->> 'rights_checked_at')::date,
    edition.value ->> 'source_url',
    (edition.value ->> 'is_primary')::boolean,
    edition.value -> 'metadata'
  from public.literary_archive_release_items item
  join public.literary_works work
    on work.legacy_id = item.legacy_id
  cross join lateral jsonb_array_elements(item.payload -> 'editions')
    edition(value)
  where item.release_id = target.id
  order by item.ordinal, edition.value ->> 'legacy_id';

  insert into public.literary_work_cover_artworks (
    work_id,
    cover_url,
    thumbnail_url,
    cover_width,
    cover_height,
    thumbnail_width,
    thumbnail_height,
    rights_status,
    cover_source_url,
    rights_checked_at,
    source_archive_sha256,
    source_image_sha256,
    source_filename,
    source_relative_path,
    source_index,
    is_primary,
    provenance
  )
  select
    work.id,
    artwork.value ->> 'cover_url',
    artwork.value ->> 'thumbnail_url',
    (artwork.value ->> 'cover_width')::integer,
    (artwork.value ->> 'cover_height')::integer,
    (artwork.value ->> 'thumbnail_width')::integer,
    (artwork.value ->> 'thumbnail_height')::integer,
    artwork.value ->> 'rights_status',
    artwork.value ->> 'cover_source_url',
    (artwork.value ->> 'rights_checked_at')::date,
    artwork.value ->> 'source_archive_sha256',
    artwork.value ->> 'source_image_sha256',
    artwork.value ->> 'source_filename',
    artwork.value ->> 'source_relative_path',
    (artwork.value ->> 'source_index')::integer,
    (artwork.value ->> 'is_primary')::boolean,
    artwork.value -> 'provenance'
  from public.literary_archive_release_items item
  join public.literary_works work
    on work.legacy_id = item.legacy_id
  cross join lateral jsonb_array_elements(item.payload -> 'artworks')
    artwork(value)
  where item.release_id = target.id
  order by
    item.ordinal,
    artwork.value ->> 'source_archive_sha256',
    artwork.value ->> 'source_image_sha256';

  if exists (
    select 1
    from public.literary_archive_release_items item
    join public.literary_works work
      on work.legacy_id = item.legacy_id
    where item.release_id = target.id
      and public.literary_work_evidence_v2_content(work.id)
        is distinct from item.payload -> 'expectedContent'
  ) then
    raise exception 'Materialized live content differs from staged target'
      using errcode = '40001';
  end if;

  -- Attestation is part of the same transaction. The existing Evidence V2
  -- RPC revalidates exact staged projection, evidence provenance and the
  -- content hash after all child replacement has completed.
  for staged_item in
    select
      work.id as work_id,
      item.payload -> 'attestation' as attestation
    from public.literary_archive_release_items item
    join public.literary_works work
      on work.legacy_id = item.legacy_id
    where item.release_id = target.id
      and jsonb_typeof(item.payload -> 'attestation') = 'object'
    order by item.ordinal
  loop
    perform public.attest_literary_work_evidence_v2(
      staged_item.work_id,
      public.literary_work_evidence_v2_sha256(
        (staged_item.attestation -> 'expectedContent')::text
      ),
      staged_item.attestation -> 'expectedContent',
      staged_item.attestation -> 'evidence',
      staged_item.attestation ->> 'reviewer',
      (staged_item.attestation ->> 'reviewedAt')::date
    );
    staged_attestation_count := staged_attestation_count + 1;
  end loop;

  select count(*)::integer
  into predecessor_public_count
  from public.literary_works work
  where public.is_publishable_literary_work_pre_evidence_v2(work.id);
  if predecessor_public_count <>
      target.expected_predecessor_public_count then
    raise exception 'Predecessor-public count changed: expected %, found %',
      target.expected_predecessor_public_count,
      predecessor_public_count
      using errcode = '40001';
  end if;
  predecessor_legacy_manifest_sha256 :=
    public.literary_archive_release_predecessor_legacy_manifest_sha256();
  if predecessor_legacy_manifest_sha256 is distinct from
      target.expected_predecessor_public_manifest_sha256 then
    raise exception 'Post-release predecessor-public legacy manifest mismatch'
      using errcode = '40001';
  end if;

  select count(*)::integer
  into invalid_attestation_count
  from public.literary_works work
  where public.is_publishable_literary_work_pre_evidence_v2(work.id)
    and not public.is_literary_work_evidence_v2_attested(work.id);

  if (gate_already_enabled or target.enable_evidence_v2)
    and invalid_attestation_count <> 0 then
    raise exception 'Atomic release leaves % public works unattested',
      invalid_attestation_count
      using errcode = '23514';
  end if;

  predecessor_manifest_sha256 :=
    public.literary_work_evidence_v2_predecessor_manifest_sha256();
  if target.enable_evidence_v2 and not gate_already_enabled then
    perform public.set_literary_work_evidence_v2_enforcement(
      true,
      predecessor_manifest_sha256
    );
    gate_already_enabled := true;
  end if;

  commit_time := clock_timestamp();
  receipt := jsonb_build_object(
    'releaseId', target.id,
    'releaseKey', target.release_key,
    'sourceRevision', target.source_revision,
    'contractVersion', target.contract_version,
    'status', 'committed',
    'manifestSha256', recomputed_manifest_sha256,
    'items', target.expected_item_count,
    'batches', target.expected_batch_count,
    'childEditPreservation', child_edit_preservation,
    'attestations', staged_attestation_count,
    'predecessorPublic', predecessor_public_count,
    'predecessorLegacyManifestSha256',
      predecessor_legacy_manifest_sha256,
    'predecessorManifestSha256', predecessor_manifest_sha256,
    'invalidAttestations', invalid_attestation_count,
    'evidenceV2Enabled', gate_already_enabled,
    'committedAt', commit_time
  );

  update public.literary_archive_releases release
  set
    status = 'committed',
    committed_manifest_sha256 = recomputed_manifest_sha256,
    commit_receipt = receipt,
    committed_at = commit_time
  where release.id = target.id;

  return receipt || jsonb_build_object('idempotent', false);
end;
$$;

revoke all on function public.commit_literary_archive_release(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.commit_literary_archive_release(uuid, text)
  to service_role;

comment on table public.literary_archive_releases is
  'Private immutable contract and durable receipt for one atomic literary archive release.';
comment on table public.literary_archive_release_batches is
  'Server-hashed bounded staging batches; writable only through the service-role staging RPC.';
comment on table public.literary_archive_release_items is
  'Content-addressed private work payloads and optimistic live preconditions for atomic commit.';

-- Extend the accumulated staff health document while preserving the admin
-- client's existing version marker.
do $literary_archive_atomic_release_health_predecessor$
declare
  predecessor_definition text;
begin
  if to_regprocedure(
    'public.get_editorial_schema_health_pre_literary_archive_atomic_release()'
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
      'FUNCTION public.get_editorial_schema_health_pre_literary_archive_atomic_release('
    );
  end if;
end;
$literary_archive_atomic_release_health_predecessor$;

revoke all on function
  public.get_editorial_schema_health_pre_literary_archive_atomic_release()
  from public, anon, authenticated, service_role;

create or replace function public.get_editorial_schema_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select case when public.is_staff() then
    coalesce(
      public.get_editorial_schema_health_pre_literary_archive_atomic_release(),
      '{}'::jsonb
    ) || jsonb_build_object(
      'checkedAt', now(),
      'literaryArchiveAtomicRelease',
        to_regclass('public.literary_archive_releases') is not null
        and to_regclass('public.literary_archive_release_batches') is not null
        and to_regclass('public.literary_archive_release_items') is not null
        and to_regclass(
          'public.literary_archive_child_edit_preservations'
        ) is not null
        and to_regclass(
          'public.literary_archive_child_edit_preservation_controls'
        ) is not null
        and to_regprocedure(
          'public.create_literary_archive_release(text,text,integer,integer,integer,text,jsonb,text,integer,text,boolean,jsonb)'
        ) is not null
        and to_regprocedure(
          'public.stage_literary_archive_release_batch(uuid,integer,jsonb)'
        ) is not null
        and to_regprocedure(
          'public.commit_literary_archive_release(uuid,text)'
        ) is not null
        and to_regprocedure(
          'public.get_literary_archive_release_precondition()'
        ) is not null
        and to_regprocedure(
          'public.assert_literary_archive_live_target(uuid,text)'
        ) is not null
        and to_regprocedure(
          'public.literary_archive_child_edit_preservation_receipt()'
        ) is not null
        and has_function_privilege(
          'service_role',
          'public.create_literary_archive_release(text,text,integer,integer,integer,text,jsonb,text,integer,text,boolean,jsonb)',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.stage_literary_archive_release_batch(uuid,integer,jsonb)',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.commit_literary_archive_release(uuid,text)',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.get_literary_archive_release_precondition()',
          'EXECUTE'
        )
        and has_function_privilege(
          'service_role',
          'public.assert_literary_archive_live_target(uuid,text)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.create_literary_archive_release(text,text,integer,integer,integer,text,jsonb,text,integer,text,boolean,jsonb)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'service_role',
          'public.literary_archive_child_edit_preservation_receipt()',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.literary_archive_child_edit_preservation_receipt()',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.stage_literary_archive_release_batch(uuid,integer,jsonb)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.commit_literary_archive_release(uuid,text)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.get_literary_archive_release_precondition()',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.assert_literary_archive_live_target(uuid,text)',
          'EXECUTE'
        )
        and not has_table_privilege(
          'service_role', 'public.literary_archive_releases', 'INSERT'
        )
        and not has_table_privilege(
          'service_role', 'public.literary_archive_releases', 'UPDATE'
        )
        and not has_table_privilege(
          'service_role', 'public.literary_archive_releases', 'DELETE'
        )
        and not has_table_privilege(
          'service_role', 'public.literary_archive_release_batches', 'INSERT'
        )
        and not has_table_privilege(
          'service_role', 'public.literary_archive_release_batches', 'UPDATE'
        )
        and not has_table_privilege(
          'service_role', 'public.literary_archive_release_batches', 'DELETE'
        )
        and not has_table_privilege(
          'service_role', 'public.literary_archive_release_items', 'INSERT'
        )
        and not has_table_privilege(
          'service_role', 'public.literary_archive_release_items', 'UPDATE'
        )
        and not has_table_privilege(
          'service_role', 'public.literary_archive_release_items', 'DELETE'
        )
        and not has_table_privilege(
          'service_role',
          'public.literary_archive_child_edit_preservations',
          'INSERT'
        )
        and not has_table_privilege(
          'service_role',
          'public.literary_archive_child_edit_preservations',
          'UPDATE'
        )
        and not has_table_privilege(
          'service_role',
          'public.literary_archive_child_edit_preservations',
          'DELETE'
        )
        and not has_table_privilege(
          'service_role',
          'public.literary_archive_child_edit_preservation_controls',
          'INSERT'
        )
        and not has_table_privilege(
          'service_role',
          'public.literary_archive_child_edit_preservation_controls',
          'UPDATE'
        )
        and not has_table_privilege(
          'service_role',
          'public.literary_archive_child_edit_preservation_controls',
          'DELETE'
        )
        and 5 = (
          select count(*)
          from pg_catalog.pg_class relation
          where relation.oid = any(array[
            'public.literary_archive_releases'::regclass,
            'public.literary_archive_release_batches'::regclass,
            'public.literary_archive_release_items'::regclass,
            'public.literary_archive_child_edit_preservations'::regclass,
            'public.literary_archive_child_edit_preservation_controls'::regclass
          ])
            and relation.relrowsecurity
            and relation.relforcerowsecurity
        )
        and 2 = (
          select count(*)
          from pg_catalog.pg_trigger preservation_guard
          where not preservation_guard.tgisinternal
            and preservation_guard.tgfoid =
              'public.protect_literary_archive_child_edit_preservation()'
                ::regprocedure
        )
        and 6 = (
          select count(*)
          from pg_catalog.pg_trigger parent_lock_trigger
          where not parent_lock_trigger.tgisinternal
            and parent_lock_trigger.tgfoid =
              'public.lock_literary_work_parent_on_child_edit()'::regprocedure
        )
        and 2 = (
          select count(*)
          from pg_catalog.pg_trigger evidence_invalidation_trigger
          where not evidence_invalidation_trigger.tgisinternal
            and evidence_invalidation_trigger.tgfoid =
              'public.invalidate_literary_work_evidence_v2()'::regprocedure
            and evidence_invalidation_trigger.tgname in (
              'book_editions_invalidate_evidence_v2',
              'literary_work_cover_artworks_invalidate_evidence_v2'
            )
        )
        and position(
          'probpera.literary_archive_atomic_release'
          in pg_catalog.pg_get_functiondef(
            'public.attest_literary_work_evidence_v2(uuid,text,jsonb,jsonb,text,date)'
              ::regprocedure
          )
        ) > 0
        and position(
          'probpera.literary_archive_atomic_release'
          in pg_catalog.pg_get_functiondef(
            'public.invalidate_literary_work_evidence_v2()'::regprocedure
          )
        ) > 0,
      'literaryArchiveStagingReleases', (
        select count(*)
        from public.literary_archive_releases release
        where release.status = 'staging'
      ),
      'literaryArchiveCommittedReleases', (
        select count(*)
        from public.literary_archive_releases release
        where release.status = 'committed'
      )
    )
    else null
  end;
$$;

revoke all on function public.get_editorial_schema_health()
  from public, anon, authenticated, service_role;
grant execute on function public.get_editorial_schema_health()
  to authenticated;
