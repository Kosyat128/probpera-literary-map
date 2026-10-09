-- Durable acknowledgements for the existing Article transactions. This journal
-- stores hashes and original receipts, never another copy of editorial bodies.
-- The existing RPCs, RLS, revision triggers and public-build outbox stay authoritative.

-- Install once. On replay the checks below verify the frozen implementation;
-- a damaged installation fails closed instead of regranting owner membership.
do $editor_operation_install$
begin
  if pg_catalog.to_regnamespace('probpera_editor_operations') is null then
    -- CREATEROLE creates an automatic ADMIN membership granted by the bootstrap
    -- superuser; a managed non-superuser cannot fully revoke that grant. Refuse
    -- before any DDL rather than retaining a private-role administration path.
    if not exists (select 1 from pg_catalog.pg_roles where rolname = current_user and rolsuper) then
      raise exception using errcode = '42501', message = 'EDITOR_OPERATION_PRIVILEGED_BOOTSTRAP_REQUIRED';
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = 'probpera_editor_operation_writer')
      or exists (select 1 from pg_catalog.pg_proc
        where pronamespace = 'public'::regnamespace and proname in (
          'get_editor_operation_result', 'save_article_bundle_operation',
          'save_article_working_draft_operation', 'promote_article_working_draft_operation', 'save_page_operation'
        )) then
      raise exception using errcode = '42501', message = 'EDITOR_OPERATION_PARTIAL_INSTALLATION';
    end if;
    execute $editor_operation_initial_sql$
do $editor_operation_role$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'probpera_editor_operation_writer') then
    create role probpera_editor_operation_writer nologin inherit nosuperuser
      nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'probpera_editor_operation_writer'
      and (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls or not rolinherit)
  ) or exists (
    select 1 from pg_catalog.pg_auth_members membership
    join pg_catalog.pg_roles member_role on member_role.oid = membership.member
    join pg_catalog.pg_roles parent_role on parent_role.oid = membership.roleid
    where member_role.rolname = 'probpera_editor_operation_writer'
      and parent_role.rolname <> 'authenticated'
  ) then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_ROLE_INVALID';
  end if;
end;
$editor_operation_role$;

-- In this direction only the private writer inherits existing authenticated
-- privileges/policies. API clients never become the private writer.
grant authenticated to probpera_editor_operation_writer with inherit true;
grant authenticated to probpera_editor_operation_writer with admin false;
grant authenticated to probpera_editor_operation_writer with set false;
grant probpera_editor_operation_writer to current_user with inherit true;
grant probpera_editor_operation_writer to current_user with set true;
grant create on schema public to probpera_editor_operation_writer;

create schema if not exists probpera_editor_operations;
revoke all on schema probpera_editor_operations from public, anon, authenticated, service_role;
grant usage, create on schema probpera_editor_operations to probpera_editor_operation_writer;

-- Retain private English in the existing working-copy master. The original
-- RPC signatures, invoker publication boundary and explicit discard remain.
alter table public.article_working_drafts add column draft_scope text not null default 'bundle';
alter table public.article_working_drafts add column draft_english_enabled boolean not null default false;
update public.article_working_drafts set draft_english_enabled = english_payload ->> 'mode' = 'save';
alter table public.article_working_drafts add constraint article_working_drafts_scope_check
  check (draft_scope in ('bundle','english-only') and (draft_scope <> 'english-only' or english_payload ->> 'mode' = 'save'));
alter table public.article_working_drafts drop constraint article_working_drafts_english_payload_check;
alter table public.article_working_drafts add constraint article_working_drafts_english_payload_check check ((
  jsonb_typeof(english_payload) = 'object' and octet_length(english_payload::text) <= 5242880
  and (english_payload = '{"mode":"disabled"}'::jsonb or (
    english_payload ->> 'mode' = 'save' and english_payload ?& array['mode','payload']
    and english_payload - array['mode','payload'] = '{}'::jsonb and jsonb_typeof(english_payload -> 'payload') = 'object'))
) is true);
create or replace function public.save_article_working_draft(
  p_article_id uuid,
  p_base_article_updated_at timestamptz,
  p_payload jsonb,
  p_english_payload jsonb,
  p_expected_english_updated_at timestamptz,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_article public.articles%rowtype;
  current_english_updated_at timestamptz;
  current_draft public.article_working_drafts%rowtype;
  saved public.article_working_drafts%rowtype;
  english_document jsonb;
  field_rule record;
  item jsonb;
begin
  if actor is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'staff-required';
  end if;
  if p_article_id is null
    or p_base_article_updated_at is null
    or p_expected_version is null
    or p_expected_version < 0
    or p_expected_version >= 9007199254740991
    or jsonb_typeof(p_payload) is distinct from 'object'
    or octet_length(p_payload::text) > 5242880
    or (
      jsonb_typeof(p_english_payload) is distinct from 'object'
      or octet_length(p_english_payload::text) > 5242880
      or not ((
        p_english_payload = '{"mode":"disabled"}'::jsonb
        or (
          p_english_payload ->> 'mode' = 'save'
          and p_english_payload ?& array['mode','payload']
          and p_english_payload - array['mode','payload'] = '{}'::jsonb
          and jsonb_typeof(p_english_payload -> 'payload') = 'object'
        )
      ) is true)
    ) then
    raise exception using errcode = '22023', message = 'working-draft-invalid';
  end if;

  if p_english_payload ->> 'mode' = 'save' then
    english_document := p_english_payload -> 'payload';
    -- Require a complete author copy before replacing prior private English.
    -- Legacy provenance/source object additions are retained byte for byte.
    if not (english_document ?& array['title','subtitle','excerpt','slug','content_html','content_json',
      'cover_alt','sources','bibliography','seo_title','seo_description','seo_keywords','canonical_url',
      'og_title','og_description','status','source_content_hash','reviewed_at','approved_at','published_at'])
      or jsonb_typeof(english_document -> 'content_json') is distinct from 'object'
      or jsonb_typeof(english_document -> 'status') is distinct from 'string'
      or english_document ->> 'status' not in ('draft','review','approved','published','stale','archived')
      or (english_document ? 'deleted_at' and english_document -> 'deleted_at' <> 'null'::jsonb)
      or (english_document -> 'canonical_url' <> 'null'::jsonb and jsonb_typeof(english_document -> 'canonical_url') is distinct from 'string') then
      raise exception using errcode = '22023', message = 'working-draft-invalid';
    end if;
    for field_rule in select * from (values
      ('title',3,240),('subtitle',0,360),('excerpt',0,700),('slug',2,180),('content_html',0,2000000),
      ('cover_alt',0,500),('seo_title',0,180),('seo_description',0,400),('source_content_hash',1,5242880),
      ('og_title',0,180),('og_description',0,400)
    ) as fields(name,minimum,maximum) loop
      if jsonb_typeof(english_document -> field_rule.name) is distinct from 'string'
        or char_length(english_document ->> field_rule.name) not between field_rule.minimum and field_rule.maximum then
        raise exception using errcode = '22023', message = 'working-draft-invalid';
      end if;
    end loop;
    for field_rule in select * from (values ('sources',100),('bibliography',100),('seo_keywords',30)) as fields(name,maximum) loop
      if jsonb_typeof(english_document -> field_rule.name) is distinct from 'array' then
        raise exception using errcode = '22023', message = 'working-draft-invalid';
      end if;
      if jsonb_array_length(english_document -> field_rule.name) > field_rule.maximum then
        raise exception using errcode = '22023', message = 'working-draft-invalid';
      end if;
      for item in select value from jsonb_array_elements(english_document -> field_rule.name) loop
        if (field_rule.name='seo_keywords' and (jsonb_typeof(item) is distinct from 'string' or char_length(item #>> '{}')>80))
          or (field_rule.name<>'seo_keywords' and jsonb_typeof(item) is distinct from 'object') then
          raise exception using errcode = '22023', message = 'working-draft-invalid';
        end if;
      end loop;
    end loop;
    for field_rule in select * from (values ('reviewed_at'),('approved_at'),('published_at')) as fields(name) loop
      if english_document -> field_rule.name <> 'null'::jsonb then
        if jsonb_typeof(english_document -> field_rule.name) is distinct from 'string'
          or (english_document ->> field_rule.name) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
          raise exception using errcode = '22023', message = 'working-draft-invalid';
        end if;
        perform (english_document ->> field_rule.name)::timestamptz;
      end if;
    end loop;
  end if;

  select * into current_article
  from public.articles
  where id = p_article_id
  for update;
  if not found or current_article.deleted_at is not null
    or current_article.status not in ('published','scheduled','hidden','archived')
    or (current_article.status <> 'published' and p_expected_version = 0) then
    raise exception using errcode = 'P0001', message = 'published-article-required';
  end if;
  if current_article.updated_at is distinct from p_base_article_updated_at then
    raise exception using errcode = '40001', message = 'article-version-conflict';
  end if;

  select translation.updated_at into current_english_updated_at
  from public.article_translations translation
  where translation.article_id = p_article_id
    and translation.locale = 'en'
    and translation.deleted_at is null
  for update;
  if current_english_updated_at is distinct from p_expected_english_updated_at then
    raise exception using errcode = '40001', message = 'english-version-conflict';
  end if;

  select * into current_draft
  from public.article_working_drafts
  where article_id = p_article_id
  for update;
  if found then
    if current_draft.version is distinct from p_expected_version then
      raise exception using errcode = '40001', message = 'working-draft-version-conflict';
    end if;
    update public.article_working_drafts
    set base_article_updated_at = p_base_article_updated_at,
        payload = p_payload,
        english_payload = case when p_english_payload ->> 'mode' = 'save' then p_english_payload
          when current_draft.english_payload ->> 'mode' = 'save' then current_draft.english_payload
          else p_english_payload end,
        draft_scope = 'bundle',
        draft_english_enabled = p_english_payload ->> 'mode' = 'save',
        expected_english_updated_at = p_expected_english_updated_at,
        version = current_draft.version + 1,
        actor_id = actor,
        updated_at = now()
    where article_id = p_article_id and version = p_expected_version
    returning * into saved;
  else
    if p_expected_version <> 0 then
      raise exception using errcode = '40001', message = 'working-draft-version-conflict';
    end if;
    insert into public.article_working_drafts (
      article_id, base_article_updated_at, payload, english_payload,
      expected_english_updated_at, version, actor_id, draft_english_enabled
    ) values (
      p_article_id, p_base_article_updated_at, p_payload, p_english_payload,
      p_expected_english_updated_at, 1, actor, p_english_payload ->> 'mode' = 'save'
    ) returning * into saved;
  end if;

  if saved.article_id is null then
    raise exception using errcode = '40001', message = 'working-draft-version-conflict';
  end if;
  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor,
    'article.working_draft.saved',
    'article',
    saved.article_id::text,
    jsonb_build_object(
      'version', saved.version,
      'baseArticleUpdatedAt', saved.base_article_updated_at,
      'hasEnglish', saved.english_payload ->> 'mode' = 'save'
    )
  );
  return jsonb_build_object(
    'articleId', saved.article_id,
    'version', saved.version,
    'updatedAt', saved.updated_at
  );
end;
$$;
create or replace function public.clear_article_working_draft_after_promotion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  draft public.article_working_drafts%rowtype;
  english_stamp timestamptz;
  context text := current_setting('probpera.retained_working_draft_promotion', true);
begin
  select * into draft from public.article_working_drafts where article_id = new.id for update;
  if found and draft.english_payload ->> 'mode' = 'save'
    and (select auth.uid()) is not null and public.is_staff()
    and current_setting('probpera.expected_working_draft_promotion', true) = new.id::text || ':' || draft.version::text
    and context in (new.id::text || ':' || draft.version::text || ':none', new.id::text || ':' || draft.version::text || ':stale') then
    if draft.base_article_updated_at is distinct from old.updated_at then
      raise exception using errcode = '40001', message = 'WORKING_DRAFT_CONFLICT';
    end if;
    if draft.version >= 9007199254740991 then
      raise exception using errcode = '22023', message = 'WORKING_DRAFT_VERSION_INVALID';
    end if;
    select updated_at into english_stamp from public.article_translations
    where article_id = new.id and locale = 'en' and deleted_at is null;
    update public.article_working_drafts set draft_scope = 'english-only',
      base_article_updated_at = new.updated_at, expected_english_updated_at = english_stamp,
      version = draft.version + 1, updated_at = clock_timestamp()
    where article_id = new.id and version = draft.version;
  else
    delete from public.article_working_drafts where article_id = new.id;
  end if;
  return new;
end;
$$;
create or replace function public.rebase_retained_article_working_draft_english()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_id uuid := case when tg_op = 'DELETE' then old.article_id else new.article_id end;
  target_locale text := case when tg_op = 'DELETE' then old.locale else new.locale end;
  draft public.article_working_drafts%rowtype;
  article_stamp timestamptz;
  context text := current_setting('probpera.retained_working_draft_promotion', true);
begin
  if target_locale <> 'en' or (select auth.uid()) is null or not public.is_staff() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  select updated_at into article_stamp from public.articles where id = target_id;
  select * into draft from public.article_working_drafts where article_id = target_id;
  if found and draft.draft_scope = 'english-only' and draft.version > 1
    and draft.base_article_updated_at = article_stamp
    and current_setting('probpera.expected_working_draft_promotion', true) = target_id::text || ':' || (draft.version - 1)::text
    and context in (target_id::text || ':' || (draft.version - 1)::text || ':none', target_id::text || ':' || (draft.version - 1)::text || ':stale') then
    update public.article_working_drafts set expected_english_updated_at =
      case when tg_op = 'DELETE' or new.deleted_at is not null then null else new.updated_at end
    where article_id = target_id and version = draft.version and draft_scope = 'english-only'
      and base_article_updated_at = article_stamp;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public.rebase_retained_article_working_draft_english() from public, anon, authenticated, service_role;
create trigger article_translations_rebase_retained_working_draft
after insert or update or delete on public.article_translations for each row
execute function public.rebase_retained_article_working_draft_english();
create or replace function public.promote_article_working_draft(
  p_article_id uuid,
  p_expected_article_updated_at timestamptz,
  p_expected_working_draft_version bigint,
  p_article_payload jsonb,
  p_english_mode text,
  p_english_payload jsonb,
  p_expected_english_updated_at timestamptz,
  p_redirect_source_path text,
  p_redirect_destination_path text,
  p_replace_homepage boolean,
  p_audit_action text,
  p_audit_metadata jsonb,
  p_social_publish_requested boolean,
  p_social_metadata jsonb
)
returns table (
  article_id uuid,
  article_updated_at timestamptz,
  english_updated_at timestamptz,
  homepage_replaced integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_article_updated_at timestamptz;
  current_draft_version bigint;
  has_working_draft boolean := false;
  previous_retention_context text := current_setting('probpera.retained_working_draft_promotion', true);
  target_status text := p_article_payload ->> 'status';
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED';
  end if;
  if p_article_id is null
    or p_expected_article_updated_at is null
    or p_expected_working_draft_version is null
    or p_expected_working_draft_version < 0
    or p_expected_working_draft_version > 9007199254740991 then
    raise exception using errcode = '22023', message = 'PROMOTION_INPUT_INVALID';
  end if;
  if target_status is null
    or target_status not in ('published', 'scheduled', 'hidden', 'archived') then
    raise exception using errcode = '22023', message = 'PROMOTION_STATUS_REQUIRED';
  end if;

  select article.updated_at
  into current_article_updated_at
  from public.articles article
  where article.id = p_article_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ARTICLE_NOT_FOUND';
  end if;
  if current_article_updated_at is distinct from p_expected_article_updated_at then
    raise exception using errcode = '40001', message = 'ARTICLE_CONFLICT';
  end if;

  -- Match save bundle's article -> translation -> draft lock order.
  perform 1 from public.article_translations translation
  where translation.article_id = p_article_id and translation.locale = 'en'
    and translation.deleted_at is null for update;

  current_draft_version := public.lock_article_working_draft_for_publication(

    p_article_id, p_expected_article_updated_at
  );
  has_working_draft := current_draft_version is not null;
  if (
    p_expected_working_draft_version = 0
    and has_working_draft
  ) or (
    p_expected_working_draft_version > 0
    and (
      not has_working_draft
      or current_draft_version is distinct from p_expected_working_draft_version
    )
  ) then
    raise exception using errcode = '40001', message = 'WORKING_DRAFT_CONFLICT';
  end if;

  perform set_config(
    'probpera.expected_working_draft_promotion',
    p_article_id::text || ':' || p_expected_working_draft_version::text,
    true
  );

  perform set_config('probpera.retained_working_draft_promotion',
    case when p_english_mode in ('none','stale') then
      p_article_id::text || ':' || p_expected_working_draft_version::text || ':' || p_english_mode
    else '' end, true);

  return query
  select bundle.article_id,
         bundle.article_updated_at,
         bundle.english_updated_at,
         bundle.homepage_replaced
  from public.save_article_bundle(
    p_article_id,
    p_expected_article_updated_at,
    p_article_payload,
    p_english_mode,
    p_english_payload,
    p_expected_english_updated_at,
    p_redirect_source_path,
    p_redirect_destination_path,
    p_replace_homepage,
    p_audit_action,
    p_audit_metadata,
    p_social_publish_requested,
    p_social_metadata
  ) bundle;
  perform set_config('probpera.retained_working_draft_promotion', coalesce(previous_retention_context,''), true);
end;
$$;

create or replace function probpera_editor_operations.valid_receipt_shape(
  p_result jsonb, p_persistence text, p_expected_ru timestamptz, p_expected_en timestamptz, p_expected_version bigint
)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  raw jsonb := p_result - array['englishWrite','workingDraft'];
  metadata jsonb := p_result -> 'workingDraft';
  scope text := p_result ->> 'englishWrite';
  draft_version numeric;
begin
  if p_persistence = 'page' then
    return (jsonb_typeof(p_result) = 'object'
      and p_result ?& array['page_id','page_updated_at','page_status']
      and p_result - array['page_id','page_updated_at','page_status'] = '{}'::jsonb
      and jsonb_typeof(p_result -> 'page_id') = 'string'
      and (p_result ->> 'page_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and probpera_editor_operations.iso_stamp(p_result -> 'page_updated_at') > p_expected_ru
      and jsonb_typeof(p_result -> 'page_status') = 'string'
      and p_result ->> 'page_status' in ('draft','published','hidden')
      and p_expected_ru is not null and p_expected_en is null and p_expected_version = 0) is true;
  end if;
  if p_persistence = 'working-draft' then
    if not (raw ?& array['articleId','version','updatedAt']) or raw - array['articleId','version','updatedAt'] <> '{}'::jsonb
      or (p_result ? 'englishWrite' and (scope is null or scope not in ('saved','preserved'))) then return false; end if;
    if jsonb_typeof(raw -> 'articleId') is distinct from 'string'
      or (raw ->> 'articleId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(raw -> 'version') is distinct from 'number' or (raw ->> 'version') !~ '^[0-9]+$'
      or (raw ->> 'version')::numeric < 1 or (raw ->> 'version')::numeric > 9007199254740991
      or probpera_editor_operations.iso_stamp(raw -> 'updatedAt') is null then return false; end if;
  else
    if not (raw ?& array['article_id','article_updated_at','english_updated_at','homepage_replaced'])
      or raw - array['article_id','article_updated_at','english_updated_at','homepage_replaced'] <> '{}'::jsonb
      or (p_result ? 'englishWrite' and (scope is null or not (
        (scope = 'preserved' and raw -> 'english_updated_at' = 'null'::jsonb)
        or (scope in ('saved','status-only') and jsonb_typeof(raw -> 'english_updated_at') = 'string')))) then return false; end if;
    if jsonb_typeof(raw -> 'article_id') is distinct from 'string'
      or (raw ->> 'article_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or probpera_editor_operations.iso_stamp(raw -> 'article_updated_at') is null
      or (raw -> 'english_updated_at' <> 'null'::jsonb and probpera_editor_operations.iso_stamp(raw -> 'english_updated_at') is null)
      or jsonb_typeof(raw -> 'homepage_replaced') is distinct from 'number'
      or (raw ->> 'homepage_replaced') !~ '^[0-9]+$' then return false; end if;
  end if;
  -- Older immutable journal rows lack this descriptor. Absence never proves
  -- retention or a later private version; replay returns their original truth.
  if not (p_result ? 'workingDraft') then return true; end if;
  if scope is null or not (p_result ? 'englishWrite') then return false; end if;
  if jsonb_typeof(metadata) is distinct from 'object'
    or not (metadata ?& array['scope','version','updatedAt','baseArticleUpdatedAt','englishExpectedUpdatedAt','englishWrite','englishEnabled'])
    or metadata - array['scope','version','updatedAt','baseArticleUpdatedAt','englishExpectedUpdatedAt','englishWrite','englishEnabled'] <> '{}'::jsonb
    or jsonb_typeof(metadata -> 'scope') is distinct from 'string'
    or metadata ->> 'scope' not in ('bundle','english-only')
    or jsonb_typeof(metadata -> 'version') is distinct from 'number'
    or (metadata ->> 'version') !~ '^[0-9]+$'
    or jsonb_typeof(metadata -> 'englishEnabled') is distinct from 'boolean'
    or metadata ->> 'englishWrite' not in ('saved','preserved')
    or jsonb_typeof(metadata -> 'englishWrite') is distinct from 'string' then return false; end if;
  draft_version := (metadata ->> 'version')::numeric;
  if draft_version < 1 or draft_version > 9007199254740991 or draft_version <> p_expected_version::numeric + 1
    or probpera_editor_operations.iso_stamp(metadata -> 'updatedAt') is null
    or probpera_editor_operations.iso_stamp(metadata -> 'baseArticleUpdatedAt') is null then return false; end if;
  perform probpera_editor_operations.iso_stamp(metadata -> 'englishExpectedUpdatedAt');
  if p_persistence = 'working-draft' then
    return metadata ->> 'scope' = 'bundle' and metadata ->> 'englishWrite' = scope
      and (metadata ->> 'version')::numeric = (raw ->> 'version')::numeric
      and probpera_editor_operations.iso_stamp(metadata -> 'updatedAt') = probpera_editor_operations.iso_stamp(raw -> 'updatedAt')
      and probpera_editor_operations.iso_stamp(metadata -> 'baseArticleUpdatedAt') = p_expected_ru
      and probpera_editor_operations.iso_stamp(metadata -> 'englishExpectedUpdatedAt') is not distinct from p_expected_en
      and (metadata -> 'englishEnabled') = case scope when 'saved' then 'true'::jsonb else 'false'::jsonb end;
  end if;
  return p_persistence = 'working-draft-promotion' and scope in ('preserved','status-only')
    and metadata ->> 'scope' = 'english-only' and metadata ->> 'englishWrite' = 'preserved'
    and probpera_editor_operations.iso_stamp(metadata -> 'baseArticleUpdatedAt') = probpera_editor_operations.iso_stamp(raw -> 'article_updated_at')
    and (raw -> 'english_updated_at' = 'null'::jsonb or
      probpera_editor_operations.iso_stamp(metadata -> 'englishExpectedUpdatedAt') = probpera_editor_operations.iso_stamp(raw -> 'english_updated_at'));
exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation or numeric_value_out_of_range then
  return false;
end;
$$;

create table if not exists probpera_editor_operations.receipts (
  operation_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  entity_type text not null check (entity_type in ('article','page')),
  requested_entity_id uuid,
  actual_entity_id uuid not null,
  intent text not null check (intent in ('save', 'preview', 'publish')),
  persistence text not null check (persistence in ('article-bundle', 'working-draft', 'working-draft-promotion','page')),
  expected_updated_at timestamptz,
  english_expected_updated_at timestamptz,
  working_draft_version bigint not null check (working_draft_version between 0 and 9007199254740991),
  preview_locale text not null check (preview_locale in ('ru', 'en')),
  submitted_intent_sha256 text not null check (submitted_intent_sha256 ~ '^[0-9a-f]{64}$'),
  prepared_command_sha256 text not null check (prepared_command_sha256 ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 8192),
  canonical_status public.article_status not null,
  committed_at timestamptz not null default clock_timestamp(),
  constraint editor_operation_receipt_shape check (
    probpera_editor_operations.valid_receipt_shape(result, persistence, expected_updated_at, english_expected_updated_at, working_draft_version)
  ),
  constraint editor_operation_entity_contract check ((
    (entity_type = 'article' and persistence in ('article-bundle','working-draft','working-draft-promotion'))
    or (entity_type = 'page' and persistence = 'page' and requested_entity_id = actual_entity_id
      and actual_entity_id::text = lower(result ->> 'page_id')
      and expected_updated_at is not null and english_expected_updated_at is null
      and working_draft_version = 0 and preview_locale = 'ru'
      and canonical_status::text = result ->> 'page_status')
  ) is true)
);

alter table probpera_editor_operations.receipts enable row level security;
alter table probpera_editor_operations.receipts force row level security;
revoke all on table probpera_editor_operations.receipts from public, anon, authenticated, service_role;
grant select, insert on table probpera_editor_operations.receipts to probpera_editor_operation_writer;

drop policy if exists "Private writer reads own editor receipts" on probpera_editor_operations.receipts;
create policy "Private writer reads own editor receipts"
on probpera_editor_operations.receipts for select to probpera_editor_operation_writer
using (actor_id = (select auth.uid()) and public.is_staff());
drop policy if exists "Private writer creates own editor receipts" on probpera_editor_operations.receipts;
create policy "Private writer creates own editor receipts"
on probpera_editor_operations.receipts for insert to probpera_editor_operation_writer
with check (actor_id = (select auth.uid()) and public.is_staff());

create or replace function probpera_editor_operations.protect_receipt()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception using errcode = '42501', message = 'EDITOR_OPERATION_RECEIPT_IMMUTABLE';
end;
$$;
drop trigger if exists editor_operation_receipt_append_only on probpera_editor_operations.receipts;
create trigger editor_operation_receipt_append_only before update or delete
on probpera_editor_operations.receipts for each row
execute function probpera_editor_operations.protect_receipt();

create or replace function probpera_editor_operations.iso_stamp(p_value jsonb)
returns timestamptz language plpgsql immutable security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_value) = 'null' then return null; end if;
  if jsonb_typeof(p_value) is distinct from 'string'
    or char_length(p_value #>> '{}') > 80
    or (p_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$' then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  return (p_value #>> '{}')::timestamptz;
exception when invalid_text_representation or datetime_field_overflow then
  raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
end;
$$;

create or replace function probpera_editor_operations.intent_field(p_intent jsonb, p_name text)
returns text language sql immutable security invoker set search_path = '' as $$
  select field ->> 1 from jsonb_array_elements(p_intent -> 'fields') field where field ->> 0 = p_name;
$$;

-- Match optionalText's ECMAScript trim only for technical CAS/UUID metadata.
-- Editorial field bytes in the submitted intent are never rewritten.
create or replace function probpera_editor_operations.trim_context(p_value text)
returns text language sql immutable security invoker set search_path = '' as $$
  select regexp_replace(p_value,
    '^[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$', '', 'g');
$$;

create or replace function probpera_editor_operations.validate_intent(p_intent jsonb)
returns void language plpgsql immutable security invoker set search_path = '' as $$
declare
  field jsonb;
  field_name text;
  previous_name text;
  version_value numeric;
  field_version numeric;
  field_value text;
  field_entity uuid;
  entity_id uuid;
  expected_stamp timestamptz;
  english_stamp timestamptz;
begin
  if p_intent is null or jsonb_typeof(p_intent) <> 'object'
    or octet_length(p_intent::text) > 5242880
    or not (p_intent ?& array['version', 'entityType', 'entityId', 'intent', 'expectedUpdatedAt',
      'englishExpectedUpdatedAt', 'workingDraftVersion', 'previewLocale', 'fields'])
    or p_intent - array['version', 'entityType', 'entityId', 'intent', 'expectedUpdatedAt',
      'englishExpectedUpdatedAt', 'workingDraftVersion', 'previewLocale', 'fields'] <> '{}'::jsonb
    or p_intent -> 'version' is distinct from '1'::jsonb
    or p_intent ->> 'entityType' is distinct from 'article'
    or jsonb_typeof(p_intent -> 'intent') <> 'string' or p_intent ->> 'intent' not in ('save', 'preview', 'publish')
    or jsonb_typeof(p_intent -> 'previewLocale') <> 'string' or p_intent ->> 'previewLocale' not in ('ru', 'en')
    or jsonb_typeof(p_intent -> 'workingDraftVersion') <> 'number'
    or jsonb_typeof(p_intent -> 'fields') <> 'array' or jsonb_array_length(p_intent -> 'fields') > 128 then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  if jsonb_typeof(p_intent -> 'entityId') not in ('null', 'string') then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  entity_id := (p_intent ->> 'entityId')::uuid;
  expected_stamp := probpera_editor_operations.iso_stamp(p_intent -> 'expectedUpdatedAt');
  english_stamp := probpera_editor_operations.iso_stamp(p_intent -> 'englishExpectedUpdatedAt');
  version_value := (p_intent ->> 'workingDraftVersion')::numeric;
  if version_value < 0 or version_value > 9007199254740991 or trunc(version_value) <> version_value
    or (entity_id is null and (expected_stamp is not null or version_value <> 0))
    or (entity_id is not null and expected_stamp is null) then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  for field in select value from jsonb_array_elements(p_intent -> 'fields') loop
    if jsonb_typeof(field) <> 'array' or jsonb_array_length(field) <> 2
      or jsonb_typeof(field -> 0) <> 'string' or jsonb_typeof(field -> 1) <> 'string' then
      raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
    end if;
    field_name := field ->> 0;
    field_value := field ->> 1;
    if field_name !~ '^[a-z][a-z0-9_]*$' or char_length(field_name) > 100
      or field_name in ('article_operation_id', 'article_result_mode')
      or char_length(field_value) + char_length(field_value)
        - char_length(regexp_replace(field_value, '[\U00010000-\U0010FFFF]', '', 'g')) > 2000000
      or previous_name is not null and field_name collate "C" <= previous_name collate "C" then
      raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
    end if;
    previous_name := field_name;
  end loop;
  field_entity := nullif(probpera_editor_operations.trim_context(probpera_editor_operations.intent_field(p_intent, 'id')), '')::uuid;
  if field_entity is distinct from entity_id then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  field_value := nullif(probpera_editor_operations.trim_context(probpera_editor_operations.intent_field(p_intent, 'expected_updated_at')), '');
  if probpera_editor_operations.iso_stamp(coalesce(to_jsonb(field_value), 'null'::jsonb)) is distinct from expected_stamp then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  field_value := nullif(probpera_editor_operations.trim_context(probpera_editor_operations.intent_field(p_intent, 'english_expected_updated_at')), '');
  if probpera_editor_operations.iso_stamp(coalesce(to_jsonb(field_value), 'null'::jsonb)) is distinct from english_stamp then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  field_value := coalesce(nullif(probpera_editor_operations.intent_field(p_intent, 'working_draft_version'), ''), '0');
  if field_value !~ '^[0-9]+$' then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  field_version := field_value::numeric;
  if field_version is distinct from version_value
    or coalesce(nullif(probpera_editor_operations.intent_field(p_intent, 'intent'), ''), 'save') <> p_intent ->> 'intent'
    or coalesce(nullif(probpera_editor_operations.intent_field(p_intent, 'preview_locale'), ''), 'ru') <> p_intent ->> 'previewLocale' then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_parameter_value then
  raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
end;
$$;

-- Pages keep their own frozen command shape; article intent validation stays
-- unchanged. Only original string fields and technical context are hashed.
create or replace function probpera_editor_operations.validate_page_intent(p_intent jsonb)
returns void language plpgsql immutable security invoker set search_path = '' as $$
declare
  field jsonb;
  field_name text;
  field_value text;
  previous_name text;
  entity_id uuid;
  expected_stamp timestamptz;
begin
  if p_intent is null or jsonb_typeof(p_intent) is distinct from 'object'
    or octet_length(p_intent::text) > 5242880
    or not (p_intent ?& array['version','entityType','entityId','expectedUpdatedAt','intent','fields'])
    or p_intent - array['version','entityType','entityId','expectedUpdatedAt','intent','fields'] <> '{}'::jsonb
    or p_intent -> 'version' is distinct from '1'::jsonb
    or p_intent ->> 'entityType' is distinct from 'page'
    or jsonb_typeof(p_intent -> 'entityId') is distinct from 'string'
    or jsonb_typeof(p_intent -> 'intent') is distinct from 'string'
    or p_intent ->> 'intent' not in ('save','publish')
    or jsonb_typeof(p_intent -> 'fields') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  entity_id := (p_intent ->> 'entityId')::uuid;
  expected_stamp := probpera_editor_operations.iso_stamp(p_intent -> 'expectedUpdatedAt');
  if entity_id is null or expected_stamp is null or jsonb_array_length(p_intent -> 'fields') > 128 then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  for field in select value from jsonb_array_elements(p_intent -> 'fields') loop
    if jsonb_typeof(field) is distinct from 'array' then
      raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
    end if;
    if jsonb_array_length(field) <> 2 or jsonb_typeof(field -> 0) is distinct from 'string'
      or jsonb_typeof(field -> 1) is distinct from 'string' then
      raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
    end if;
    field_name := field ->> 0;
    field_value := field ->> 1;
    if field_name !~ '^[a-z][a-z0-9_]*$' or char_length(field_name) > 100
      or field_name in ('page_operation_id','page_result_mode')
      or char_length(field_value) + char_length(field_value)
        - char_length(regexp_replace(field_value, '[\U00010000-\U0010FFFF]', '', 'g')) > 2000000
      or previous_name is not null and field_name collate "C" <= previous_name collate "C" then
      raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
    end if;
    previous_name := field_name;
  end loop;
  if nullif(probpera_editor_operations.trim_context(probpera_editor_operations.intent_field(p_intent,'id')),'')::uuid is distinct from entity_id
    or probpera_editor_operations.iso_stamp(coalesce(to_jsonb(nullif(probpera_editor_operations.trim_context(
      probpera_editor_operations.intent_field(p_intent,'expected_updated_at')),'')),'null'::jsonb)) is distinct from expected_stamp
    or coalesce(nullif(probpera_editor_operations.intent_field(p_intent,'intent'),''),'save') <> p_intent ->> 'intent' then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_parameter_value then
  raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
end;
$$;

create or replace function probpera_editor_operations.sha256_json(p_value jsonb)
returns text language sql immutable security invoker set search_path = '' as $$
  select encode(pg_catalog.sha256(convert_to(p_value::text, 'UTF8')), 'hex');
$$;

create or replace function probpera_editor_operations.find_replay(
  p_operation_id uuid, p_submitted_intent jsonb, p_prepared_sha256 text default null
)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  saved probpera_editor_operations.receipts%rowtype;
begin
  if actor is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_ACCESS_REQUIRED';
  end if;
  if p_operation_id is null then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  if p_submitted_intent ->> 'entityType' = 'page' then
    perform probpera_editor_operations.validate_page_intent(p_submitted_intent);
  else
    perform probpera_editor_operations.validate_intent(p_submitted_intent);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-editor-operation:' || p_operation_id::text, 61007));
  select * into saved from probpera_editor_operations.receipts
  where operation_id = p_operation_id and actor_id = actor;
  if not found then return null; end if;
  if saved.submitted_intent_sha256 <> probpera_editor_operations.sha256_json(p_submitted_intent)
    or p_prepared_sha256 is not null and saved.prepared_command_sha256 <> p_prepared_sha256 then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_CONFLICT';
  end if;
  if saved.entity_type = 'page' then
    -- The private writer inherits the existing Page staff policy and UPDATE
    -- grants; it owns neither the page table nor a BYPASSRLS role.
    perform 1 from public.pages where id = saved.actual_entity_id and deleted_at is null;
    if not found then
      raise exception using errcode = '42501', message = 'EDITOR_OPERATION_ACCESS_REQUIRED';
    end if;
    return jsonb_build_object('version',1,'operationId',saved.operation_id,
      'entityType','page','requestedEntityId',saved.requested_entity_id,'intent',saved.intent,
      'persistence','page','replayed',true,'receipt',saved.result);
  end if;
  -- This SELECT runs with the RLS-bound private writer, not the table owner.
  perform 1 from public.articles where id = saved.actual_entity_id and deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_ACCESS_REQUIRED';
  end if;
  return jsonb_build_object('version', 1, 'operationId', saved.operation_id,
    'entityType', saved.entity_type, 'requestedEntityId', saved.requested_entity_id,
    'intent', saved.intent, 'persistence', saved.persistence, 'replayed', true,
     'result', saved.result - array['englishWrite','workingDraft'], 'canonicalStatus', saved.canonical_status)
    || case when saved.result ? 'englishWrite' then jsonb_build_object('englishWrite', saved.result -> 'englishWrite') else '{}'::jsonb end
    || case when saved.result ? 'workingDraft' then jsonb_build_object('workingDraft', saved.result -> 'workingDraft') else '{}'::jsonb end;
end;
$$;

create or replace function public.get_editor_operation_result(p_operation_id uuid, p_submitted_intent jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
begin
  return probpera_editor_operations.find_replay(p_operation_id, p_submitted_intent);
end;
$$;

create or replace function public.save_page_operation(
  p_payload jsonb, p_expected_updated_at timestamptz, p_operation_id uuid, p_submitted_intent jsonb
)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  actor uuid := (select auth.uid());
  page_id uuid;
  saved public.pages%rowtype;
  field_rule record;
  prepared_sha text;
  replay jsonb;
  receipt jsonb;
begin
  if actor is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_ACCESS_REQUIRED';
  end if;
  perform probpera_editor_operations.validate_page_intent(p_submitted_intent);
  page_id := (p_submitted_intent ->> 'entityId')::uuid;
  if p_operation_id is null or p_expected_updated_at is null
    or probpera_editor_operations.iso_stamp(p_submitted_intent -> 'expectedUpdatedAt') is distinct from p_expected_updated_at
    or jsonb_typeof(p_payload) is distinct from 'object'
    or octet_length(p_payload::text) > 5242880
    or not (p_payload ?& array['title','slug','excerpt','content_html','content_json','status',
      'seo_title','seo_description','canonical_url','allow_indexing','updated_by'])
    or p_payload - array['title','slug','excerpt','content_html','content_json','status',
      'seo_title','seo_description','canonical_url','allow_indexing','updated_by'] <> '{}'::jsonb
    or jsonb_typeof(p_payload -> 'content_json') is distinct from 'object'
    or p_payload -> 'content_json' ->> 'type' is distinct from 'doc'
    or jsonb_typeof(p_payload -> 'status') is distinct from 'string'
    or p_payload ->> 'status' not in ('draft','published','hidden')
    or (p_submitted_intent ->> 'intent' = 'publish' and p_payload ->> 'status' <> 'published')
    or (p_submitted_intent ->> 'intent' = 'save' and p_payload ->> 'status' is distinct from
      coalesce(nullif(probpera_editor_operations.intent_field(p_submitted_intent,'status'),''),'draft'))
    or jsonb_typeof(p_payload -> 'allow_indexing') is distinct from 'boolean'
    or jsonb_typeof(p_payload -> 'updated_by') is distinct from 'string'
    or lower(p_payload ->> 'updated_by') is distinct from actor::text then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  for field_rule in select * from (values
    ('title',2,180),('slug',2,120),('excerpt',0,700),('content_html',0,2000000),
    ('seo_title',0,180),('seo_description',0,400),('canonical_url',1,5242880)
  ) as fields(name,minimum,maximum) loop
    if jsonb_typeof(p_payload -> field_rule.name) is distinct from 'string'
      or char_length(p_payload ->> field_rule.name) not between field_rule.minimum and field_rule.maximum then
      raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
    end if;
  end loop;
  prepared_sha := probpera_editor_operations.sha256_json(jsonb_build_object(
    'pageId',page_id,'expectedUpdatedAt',p_expected_updated_at,'payload',p_payload));
  replay := probpera_editor_operations.find_replay(p_operation_id,p_submitted_intent,prepared_sha);
  if replay is not null then return replay; end if;
  -- Preserve the existing producer's eleven fields. The existing timestamp,
  -- revision and public-build triggers participate in this same transaction.
  update public.pages set
    title=p_payload ->> 'title', slug=p_payload ->> 'slug', excerpt=p_payload ->> 'excerpt',
    content_html=p_payload ->> 'content_html', content_json=p_payload -> 'content_json',
    status=(p_payload ->> 'status')::public.page_status,
    seo_title=p_payload ->> 'seo_title', seo_description=p_payload ->> 'seo_description',
    canonical_url=p_payload ->> 'canonical_url', allow_indexing=(p_payload ->> 'allow_indexing')::boolean,
    updated_by=actor
  where id=page_id and updated_at=p_expected_updated_at and deleted_at is null
  returning * into saved;
  if not found then
    raise exception using errcode = '40001', message = 'PAGE_CONFLICT';
  end if;
  receipt := jsonb_build_object('page_id',saved.id,'page_updated_at',saved.updated_at,'page_status',saved.status);
  if not probpera_editor_operations.valid_receipt_shape(receipt,'page',p_expected_updated_at,null,0) then
    raise exception using errcode = '22023', message = 'PAGE_OPERATION_RECEIPT_INVALID';
  end if;
  insert into probpera_editor_operations.receipts (
    operation_id,actor_id,entity_type,requested_entity_id,actual_entity_id,intent,persistence,
    expected_updated_at,english_expected_updated_at,working_draft_version,preview_locale,
    submitted_intent_sha256,prepared_command_sha256,result,canonical_status
  ) values (
    p_operation_id,actor,'page',page_id,saved.id,p_submitted_intent ->> 'intent','page',
    p_expected_updated_at,null,0,'ru',probpera_editor_operations.sha256_json(p_submitted_intent),prepared_sha,
    receipt,saved.status::text::public.article_status
  );
  return jsonb_build_object('version',1,'operationId',p_operation_id,'entityType','page',
    'requestedEntityId',page_id,'intent',p_submitted_intent ->> 'intent','persistence','page',
    'replayed',false,'receipt',receipt);
end;
$$;

create or replace function public.save_article_bundle_operation(
  p_article_id uuid, p_expected_article_updated_at timestamptz, p_article_payload jsonb,
  p_english_mode text, p_english_payload jsonb, p_expected_english_updated_at timestamptz,
  p_redirect_source_path text, p_redirect_destination_path text, p_replace_homepage boolean,
  p_audit_action text, p_audit_metadata jsonb, p_social_publish_requested boolean, p_social_metadata jsonb,
  p_operation_id uuid, p_submitted_intent jsonb
)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  prepared jsonb;
  prepared_sha text;
  replay jsonb;
  raw_result jsonb;
  saved_status public.article_status;
  english_write text;
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_ACCESS_REQUIRED';
  end if;
  perform probpera_editor_operations.validate_intent(p_submitted_intent);
  if (p_submitted_intent ->> 'entityId')::uuid is distinct from p_article_id
    or probpera_editor_operations.iso_stamp(p_submitted_intent -> 'expectedUpdatedAt') is distinct from p_expected_article_updated_at
    or p_english_mode is null or p_english_mode not in ('none', 'save', 'stale')
    or (p_english_mode = 'none' and p_expected_english_updated_at is not null)
    or (p_english_mode <> 'none' and probpera_editor_operations.iso_stamp(p_submitted_intent -> 'englishExpectedUpdatedAt') is distinct from p_expected_english_updated_at) then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  prepared := jsonb_build_array('article-bundle', p_article_id, p_expected_article_updated_at,
    p_article_payload, p_english_mode, p_english_payload, p_expected_english_updated_at,
    p_redirect_source_path, p_redirect_destination_path, p_replace_homepage,
    p_audit_action, p_audit_metadata, p_social_publish_requested, p_social_metadata);
  if octet_length(prepared::text) > 10485760 then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  prepared_sha := probpera_editor_operations.sha256_json(prepared);
  replay := probpera_editor_operations.find_replay(p_operation_id, p_submitted_intent, prepared_sha);
  if replay is not null then return replay; end if;
  select to_jsonb(bundle) into strict raw_result from public.save_article_bundle(
    p_article_id, p_expected_article_updated_at, p_article_payload, p_english_mode,
    p_english_payload, p_expected_english_updated_at, p_redirect_source_path,
    p_redirect_destination_path, p_replace_homepage, p_audit_action, p_audit_metadata,
    p_social_publish_requested, p_social_metadata
  ) bundle;
  select status into strict saved_status from public.articles where id = (raw_result ->> 'article_id')::uuid;
  english_write := case p_english_mode when 'save' then 'saved' when 'stale' then 'status-only' else 'preserved' end;
  insert into probpera_editor_operations.receipts (
    operation_id, actor_id, entity_type, requested_entity_id, actual_entity_id, intent, persistence,
    expected_updated_at, english_expected_updated_at, working_draft_version, preview_locale,
    submitted_intent_sha256, prepared_command_sha256, result, canonical_status
  ) values (
    p_operation_id, (select auth.uid()), 'article', p_article_id, (raw_result ->> 'article_id')::uuid,
    p_submitted_intent ->> 'intent', 'article-bundle', p_expected_article_updated_at,
    probpera_editor_operations.iso_stamp(p_submitted_intent -> 'englishExpectedUpdatedAt'),
    (p_submitted_intent ->> 'workingDraftVersion')::bigint, p_submitted_intent ->> 'previewLocale',
    probpera_editor_operations.sha256_json(p_submitted_intent), prepared_sha,
    raw_result || jsonb_build_object('englishWrite', english_write), saved_status
  );
  return jsonb_build_object('version', 1, 'operationId', p_operation_id, 'entityType', 'article',
    'requestedEntityId', p_article_id, 'intent', p_submitted_intent ->> 'intent',
    'persistence', 'article-bundle', 'replayed', false, 'result', raw_result, 'canonicalStatus', saved_status,
    'englishWrite', english_write);
end;
$$;

create or replace function public.save_article_working_draft_operation(
  p_article_id uuid, p_base_article_updated_at timestamptz, p_payload jsonb,
  p_english_payload jsonb, p_expected_english_updated_at timestamptz, p_expected_version bigint,
  p_operation_id uuid, p_submitted_intent jsonb
)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  prepared jsonb;
  prepared_sha text;
  replay jsonb;
  raw_result jsonb;
  saved_status public.article_status;
  english_write text;
  working_draft jsonb;
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_ACCESS_REQUIRED';
  end if;
  perform probpera_editor_operations.validate_intent(p_submitted_intent);
  if p_article_id is null or p_base_article_updated_at is null
    or (p_submitted_intent ->> 'entityId')::uuid is distinct from p_article_id
    or probpera_editor_operations.iso_stamp(p_submitted_intent -> 'expectedUpdatedAt') is distinct from p_base_article_updated_at
    or probpera_editor_operations.iso_stamp(p_submitted_intent -> 'englishExpectedUpdatedAt') is distinct from p_expected_english_updated_at
    or (p_submitted_intent ->> 'workingDraftVersion')::bigint is distinct from p_expected_version
    or p_expected_version < 0 or p_expected_version >= 9007199254740991 then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  prepared := jsonb_build_array('working-draft', p_article_id, p_base_article_updated_at,
    p_payload, p_english_payload, p_expected_english_updated_at, p_expected_version);
  if octet_length(prepared::text) > 10485760 then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  prepared_sha := probpera_editor_operations.sha256_json(prepared);
  replay := probpera_editor_operations.find_replay(p_operation_id, p_submitted_intent, prepared_sha);
  if replay is not null then return replay; end if;
  raw_result := public.save_article_working_draft(p_article_id, p_base_article_updated_at,
    p_payload, p_english_payload, p_expected_english_updated_at, p_expected_version);
  if (raw_result ->> 'articleId')::uuid is distinct from p_article_id
    or jsonb_typeof(raw_result -> 'version') is distinct from 'number'
    or (raw_result ->> 'version')::numeric is distinct from (p_expected_version + 1)::numeric
    or probpera_editor_operations.iso_stamp(raw_result -> 'updatedAt') is null then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_RESULT_INVALID';
  end if;
  select status into strict saved_status from public.articles where id = p_article_id;
  if saved_status not in ('published','scheduled','hidden','archived') then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_RESULT_INVALID';
  end if;
  english_write := case when p_english_payload ->> 'mode' = 'save' then 'saved' else 'preserved' end;
  select jsonb_build_object('scope', draft_scope, 'version', version, 'updatedAt', updated_at,
    'baseArticleUpdatedAt', base_article_updated_at, 'englishExpectedUpdatedAt', expected_english_updated_at,
    'englishWrite', english_write, 'englishEnabled', draft_english_enabled)
  into working_draft from public.article_working_drafts where article_id = p_article_id;
  insert into probpera_editor_operations.receipts (
    operation_id, actor_id, entity_type, requested_entity_id, actual_entity_id, intent, persistence,
    expected_updated_at, english_expected_updated_at, working_draft_version, preview_locale,
    submitted_intent_sha256, prepared_command_sha256, result, canonical_status
  ) values (
    p_operation_id, (select auth.uid()), 'article', p_article_id, p_article_id,
    p_submitted_intent ->> 'intent', 'working-draft', p_base_article_updated_at, p_expected_english_updated_at,
    p_expected_version, p_submitted_intent ->> 'previewLocale',
    probpera_editor_operations.sha256_json(p_submitted_intent), prepared_sha,
    raw_result || jsonb_build_object('englishWrite', english_write)
      || case when working_draft is not null then jsonb_build_object('workingDraft', working_draft) else '{}'::jsonb end, saved_status
  );
  return jsonb_build_object('version', 1, 'operationId', p_operation_id, 'entityType', 'article',
    'requestedEntityId', p_article_id, 'intent', p_submitted_intent ->> 'intent',
    'persistence', 'working-draft', 'replayed', false, 'result', raw_result, 'canonicalStatus', saved_status,
    'englishWrite', english_write)
    || case when working_draft is not null then jsonb_build_object('workingDraft', working_draft) else '{}'::jsonb end;
end;
$$;

create or replace function public.promote_article_working_draft_operation(
  p_article_id uuid, p_expected_article_updated_at timestamptz, p_expected_working_draft_version bigint,
  p_article_payload jsonb, p_english_mode text, p_english_payload jsonb, p_expected_english_updated_at timestamptz,
  p_redirect_source_path text, p_redirect_destination_path text, p_replace_homepage boolean,
  p_audit_action text, p_audit_metadata jsonb, p_social_publish_requested boolean, p_social_metadata jsonb,
  p_operation_id uuid, p_submitted_intent jsonb
)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  prepared jsonb;
  prepared_sha text;
  replay jsonb;
  raw_result jsonb;
  saved_status public.article_status;
  english_write text;
  working_draft jsonb;
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_ACCESS_REQUIRED';
  end if;
  perform probpera_editor_operations.validate_intent(p_submitted_intent);
  if p_article_id is null or p_expected_article_updated_at is null
    or (p_submitted_intent ->> 'entityId')::uuid is distinct from p_article_id
    or probpera_editor_operations.iso_stamp(p_submitted_intent -> 'expectedUpdatedAt') is distinct from p_expected_article_updated_at
    or (p_submitted_intent ->> 'workingDraftVersion')::bigint is distinct from p_expected_working_draft_version
    or p_english_mode is null or p_english_mode not in ('none', 'save', 'stale')
    or (p_english_mode = 'none' and p_expected_english_updated_at is not null)
    or (p_english_mode <> 'none' and probpera_editor_operations.iso_stamp(p_submitted_intent -> 'englishExpectedUpdatedAt') is distinct from p_expected_english_updated_at) then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  prepared := jsonb_build_array('working-draft-promotion', p_article_id, p_expected_article_updated_at,
    p_expected_working_draft_version, p_article_payload, p_english_mode, p_english_payload,
    p_expected_english_updated_at, p_redirect_source_path, p_redirect_destination_path,
    p_replace_homepage, p_audit_action, p_audit_metadata, p_social_publish_requested, p_social_metadata);
  if octet_length(prepared::text) > 10485760 then
    raise exception using errcode = '22023', message = 'EDITOR_OPERATION_INTENT_INVALID';
  end if;
  prepared_sha := probpera_editor_operations.sha256_json(prepared);
  replay := probpera_editor_operations.find_replay(p_operation_id, p_submitted_intent, prepared_sha);
  if replay is not null then return replay; end if;
  select to_jsonb(bundle) into strict raw_result from public.promote_article_working_draft(
    p_article_id, p_expected_article_updated_at, p_expected_working_draft_version,
    p_article_payload, p_english_mode, p_english_payload, p_expected_english_updated_at,
    p_redirect_source_path, p_redirect_destination_path, p_replace_homepage,
    p_audit_action, p_audit_metadata, p_social_publish_requested, p_social_metadata
  ) bundle;
  select status into strict saved_status from public.articles where id = (raw_result ->> 'article_id')::uuid;
  english_write := case p_english_mode when 'save' then 'saved' when 'stale' then 'status-only' else 'preserved' end;
  select jsonb_build_object('scope', draft_scope, 'version', version, 'updatedAt', updated_at,
    'baseArticleUpdatedAt', base_article_updated_at, 'englishExpectedUpdatedAt', expected_english_updated_at,
    'englishWrite', 'preserved', 'englishEnabled', draft_english_enabled)
  into working_draft from public.article_working_drafts where article_id = p_article_id;
  insert into probpera_editor_operations.receipts (
    operation_id, actor_id, entity_type, requested_entity_id, actual_entity_id, intent, persistence,
    expected_updated_at, english_expected_updated_at, working_draft_version, preview_locale,
    submitted_intent_sha256, prepared_command_sha256, result, canonical_status
  ) values (
    p_operation_id, (select auth.uid()), 'article', p_article_id, (raw_result ->> 'article_id')::uuid,
    p_submitted_intent ->> 'intent', 'working-draft-promotion', p_expected_article_updated_at,
    probpera_editor_operations.iso_stamp(p_submitted_intent -> 'englishExpectedUpdatedAt'),
    p_expected_working_draft_version, p_submitted_intent ->> 'previewLocale',
    probpera_editor_operations.sha256_json(p_submitted_intent), prepared_sha,
    raw_result || jsonb_build_object('englishWrite', english_write)
      || case when working_draft is not null then jsonb_build_object('workingDraft', working_draft) else '{}'::jsonb end, saved_status
  );
  return jsonb_build_object('version', 1, 'operationId', p_operation_id, 'entityType', 'article',
    'requestedEntityId', p_article_id, 'intent', p_submitted_intent ->> 'intent',
    'persistence', 'working-draft-promotion', 'replayed', false, 'result', raw_result, 'canonicalStatus', saved_status,
    'englishWrite', english_write)
    || case when working_draft is not null then jsonb_build_object('workingDraft', working_draft) else '{}'::jsonb end;
end;
$$;

-- Ownership transfer needs CREATE on each function schema and SET-able role
-- membership even when managed Supabase postgres is not a superuser.
do $editor_operation_function_owners$
declare
  signature text;
begin
  foreach signature in array array[
    'probpera_editor_operations.valid_receipt_shape(jsonb,text,timestamptz,timestamptz,bigint)',
    'probpera_editor_operations.protect_receipt()',
    'probpera_editor_operations.iso_stamp(jsonb)',
    'probpera_editor_operations.intent_field(jsonb,text)',
    'probpera_editor_operations.trim_context(text)',
    'probpera_editor_operations.validate_intent(jsonb)',
    'probpera_editor_operations.validate_page_intent(jsonb)',
    'probpera_editor_operations.sha256_json(jsonb)',
    'probpera_editor_operations.find_replay(uuid,jsonb,text)',
    'public.get_editor_operation_result(uuid,jsonb)',
    'public.save_page_operation(jsonb,timestamptz,uuid,jsonb)',
    'public.save_article_bundle_operation(uuid,timestamptz,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb,uuid,jsonb)',
    'public.save_article_working_draft_operation(uuid,timestamptz,jsonb,jsonb,timestamptz,bigint,uuid,jsonb)',
    'public.promote_article_working_draft_operation(uuid,timestamptz,bigint,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb,uuid,jsonb)'
  ] loop
    execute format('alter function %s owner to probpera_editor_operation_writer', signature::regprocedure);
    execute format('revoke all on function %s from public, anon, authenticated, service_role', signature::regprocedure);
  end loop;
end;
$editor_operation_function_owners$;

grant execute on function public.get_editor_operation_result(uuid,jsonb) to authenticated;
grant execute on function public.save_page_operation(jsonb,timestamptz,uuid,jsonb) to authenticated;
grant execute on function public.save_article_bundle_operation(uuid,timestamptz,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb,uuid,jsonb) to authenticated;
grant execute on function public.save_article_working_draft_operation(uuid,timestamptz,jsonb,jsonb,timestamptz,bigint,uuid,jsonb) to authenticated;
grant execute on function public.promote_article_working_draft_operation(uuid,timestamptz,bigint,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb,uuid,jsonb) to authenticated;

revoke create on schema public, probpera_editor_operations from probpera_editor_operation_writer;
revoke probpera_editor_operation_writer from current_user;

    $editor_operation_initial_sql$;
  end if;
  -- Verification belongs to this same statement/transaction: a failed first
  -- installation cannot commit partially installed roles, functions or ACLs.
  execute $editor_operation_verification_sql$

do $editor_operation_invariants$
declare
  signature text;
  wrapper_oid oid;
  expected_function record;
  actual_function pg_catalog.pg_proc%rowtype;
  expected_columns jsonb;
  actual_columns jsonb;
  constraint_row record;
  private_schema_oid oid;
  receipt_oid oid;
  protect_oid oid;
  expected_argtypes oidvector;
begin
  perform pg_catalog.set_config('search_path', 'pg_catalog', true);
  -- Catalog OIDs permit a verifier without private-schema USAGE or execution
  -- privileges. No runtime grant is needed merely to check installed objects.
  select oid into strict private_schema_oid from pg_catalog.pg_namespace where nspname='probpera_editor_operations';
  select oid into strict receipt_oid from pg_catalog.pg_class where relnamespace=private_schema_oid and relname='receipts' and relkind='r';
  select oid into strict protect_oid from pg_catalog.pg_proc where pronamespace=private_schema_oid and proname='protect_receipt' and pronargs=0;
  if not pg_catalog.pg_has_role('probpera_editor_operation_writer', 'authenticated', 'USAGE')
    or pg_catalog.pg_has_role('authenticated', 'probpera_editor_operation_writer', 'MEMBER')
    or pg_catalog.pg_has_role('anon', 'probpera_editor_operation_writer', 'MEMBER')
    or exists (select 1 from pg_catalog.pg_roles where rolname = 'probpera_editor_operation_writer'
      and (rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication))
    or has_table_privilege('authenticated', receipt_oid, 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('anon', receipt_oid, 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('service_role', receipt_oid, 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('probpera_editor_operation_writer', receipt_oid, 'UPDATE,DELETE')
    or not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
      where oid = receipt_oid)
    or not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.pages'::regclass)
    or not has_table_privilege('probpera_editor_operation_writer','public.pages','SELECT')
    or not has_table_privilege('probpera_editor_operation_writer','public.pages','UPDATE')
    or exists (select 1 from pg_catalog.pg_proc where oid in (
      'public.save_article_bundle(uuid,timestamptz,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb)'::regprocedure,
      'public.promote_article_working_draft(uuid,timestamptz,bigint,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb)'::regprocedure
  ) and prosecdef) then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_PRIVILEGE_BOUNDARY_INVALID';
  end if;
  foreach signature in array array[
    'public.get_editor_operation_result(uuid,jsonb)',
    'public.save_page_operation(jsonb,timestamptz,uuid,jsonb)',
    'public.save_article_bundle_operation(uuid,timestamptz,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb,uuid,jsonb)',
    'public.save_article_working_draft_operation(uuid,timestamptz,jsonb,jsonb,timestamptz,bigint,uuid,jsonb)',
    'public.promote_article_working_draft_operation(uuid,timestamptz,bigint,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb,uuid,jsonb)'
  ] loop
    wrapper_oid := signature::regprocedure;
    if not exists (select 1 from pg_catalog.pg_proc function_row
      join pg_catalog.pg_roles owner_role on owner_role.oid = function_row.proowner
      where function_row.oid = wrapper_oid and function_row.prosecdef and function_row.provolatile = 'v'
        and owner_role.rolname = 'probpera_editor_operation_writer')
      or not has_function_privilege('authenticated', wrapper_oid, 'EXECUTE')
      or has_function_privilege('anon', wrapper_oid, 'EXECUTE')
      or has_function_privilege('service_role', wrapper_oid, 'EXECUTE') then
      raise exception using errcode = '42501', message = 'EDITOR_OPERATION_PRIVILEGE_BOUNDARY_INVALID';
    end if;
  end loop;
  if exists (select 1 from pg_catalog.pg_proc function_row
    where function_row.pronamespace = private_schema_oid
      and (has_function_privilege('authenticated', function_row.oid, 'EXECUTE')
        or has_function_privilege('anon', function_row.oid, 'EXECUTE')
        or has_function_privilege('service_role', function_row.oid, 'EXECUTE')))
    or (select count(*) from pg_catalog.pg_attribute
      where attrelid = receipt_oid and attnum > 0 and not attisdropped) <> 16
    or exists (select 1 from pg_catalog.pg_auth_members membership
      where membership.member = 'probpera_editor_operation_writer'::regrole
        and (membership.roleid <> 'authenticated'::regrole or membership.admin_option
          or not membership.inherit_option or membership.set_option))
    or exists (select 1 from pg_catalog.pg_auth_members membership
      where membership.roleid = 'probpera_editor_operation_writer'::regrole) then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_PRIVILEGE_BOUNDARY_INVALID';
  end if;
  expected_columns := '[
    ["operation_id","uuid",true,false],["actor_id","uuid",true,false],
    ["entity_type","text",true,false],["requested_entity_id","uuid",false,false],
    ["actual_entity_id","uuid",true,false],["intent","text",true,false],["persistence","text",true,false],
    ["expected_updated_at","timestamp with time zone",false,false],
    ["english_expected_updated_at","timestamp with time zone",false,false],
    ["working_draft_version","bigint",true,false],["preview_locale","text",true,false],
    ["submitted_intent_sha256","text",true,false],["prepared_command_sha256","text",true,false],
    ["result","jsonb",true,false],["canonical_status","public.article_status",true,false],
    ["committed_at","timestamp with time zone",true,true]
  ]'::jsonb;
  select jsonb_agg(jsonb_build_array(attname, pg_catalog.format_type(atttypid, atttypmod), attnotnull, atthasdef) order by attnum)
    into actual_columns from pg_catalog.pg_attribute
    where attrelid = receipt_oid and attnum > 0 and not attisdropped;
  if actual_columns is distinct from expected_columns
    or not (select relpersistence = 'p' from pg_catalog.pg_class where oid = receipt_oid)
    or (select pg_catalog.pg_get_expr(adbin, adrelid) from pg_catalog.pg_attrdef
      where adrelid = receipt_oid) is distinct from 'clock_timestamp()'
    or (select relowner from pg_catalog.pg_class where oid = receipt_oid)
      in ('probpera_editor_operation_writer'::regrole, 'authenticated'::regrole, 'anon'::regrole, 'service_role'::regrole)
    or exists (select 1 from pg_catalog.pg_class where oid in ('public.articles'::regclass, 'public.article_translations'::regclass, 'public.pages'::regclass)
      and relowner = 'probpera_editor_operation_writer'::regrole)
    or exists (select 1 from pg_catalog.pg_class relation_row,
      lateral pg_catalog.aclexplode(relation_row.relacl) permission
      where relation_row.oid = receipt_oid and permission.grantee <> relation_row.relowner
        and (permission.grantee <> 'probpera_editor_operation_writer'::regrole
          or permission.privilege_type not in ('SELECT','INSERT') or permission.is_grantable))
    or exists (select 1 from pg_catalog.pg_namespace schema_row,
      lateral pg_catalog.aclexplode(schema_row.nspacl) permission
      where schema_row.oid = private_schema_oid and permission.grantee <> schema_row.nspowner
        and (permission.grantee <> 'probpera_editor_operation_writer'::regrole
          or permission.privilege_type <> 'USAGE' or permission.is_grantable)) then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_JOURNAL_SCHEMA_INVALID';
  end if;
  if (select count(*) from pg_catalog.pg_constraint where conrelid = receipt_oid) <> 12 then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_JOURNAL_SCHEMA_INVALID';
  end if;
  for constraint_row in select * from (values
    ('receipts_pkey', 'PRIMARY KEY (operation_id)'),
    ('receipts_actor_id_fkey', 'FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE RESTRICT'),
    ('receipts_entity_type_check', 'CHECK ((entity_type = ANY (ARRAY[''article''::text, ''page''::text])))'),
    ('receipts_intent_check', 'CHECK ((intent = ANY (ARRAY[''save''::text, ''preview''::text, ''publish''::text])))'),
    ('receipts_persistence_check', 'CHECK ((persistence = ANY (ARRAY[''article-bundle''::text, ''working-draft''::text, ''working-draft-promotion''::text, ''page''::text])))'),
    ('receipts_working_draft_version_check', 'CHECK (((working_draft_version >= 0) AND (working_draft_version <= ''9007199254740991''::bigint)))'),
    ('receipts_preview_locale_check', 'CHECK ((preview_locale = ANY (ARRAY[''ru''::text, ''en''::text])))'),
    ('receipts_submitted_intent_sha256_check', 'CHECK ((submitted_intent_sha256 ~ ''^[0-9a-f]{64}$''::text))'),
    ('receipts_prepared_command_sha256_check', 'CHECK ((prepared_command_sha256 ~ ''^[0-9a-f]{64}$''::text))'),
    ('receipts_result_check', 'CHECK (((jsonb_typeof(result) = ''object''::text) AND (octet_length((result)::text) <= 8192)))'),
    ('editor_operation_receipt_shape', 'CHECK (probpera_editor_operations.valid_receipt_shape(result, persistence, expected_updated_at, english_expected_updated_at, working_draft_version))'),
    ('editor_operation_entity_contract', 'CHECK (((((entity_type = ''article''::text) AND (persistence = ANY (ARRAY[''article-bundle''::text, ''working-draft''::text, ''working-draft-promotion''::text]))) OR ((entity_type = ''page''::text) AND (persistence = ''page''::text) AND (requested_entity_id = actual_entity_id) AND ((actual_entity_id)::text = lower((result ->> ''page_id''::text))) AND (expected_updated_at IS NOT NULL) AND (english_expected_updated_at IS NULL) AND (working_draft_version = 0) AND (preview_locale = ''ru''::text) AND ((canonical_status)::text = (result ->> ''page_status''::text)))) IS TRUE))')
  ) as frozen(name, definition) loop
    if not exists (select 1 from pg_catalog.pg_constraint
      where conrelid = receipt_oid and conname = constraint_row.name
        and pg_catalog.pg_get_constraintdef(oid) = constraint_row.definition and convalidated and not condeferrable) then
      raise exception using errcode = '42501', message = 'EDITOR_OPERATION_JOURNAL_SCHEMA_INVALID';
    end if;
  end loop;
  if (select count(*) from pg_catalog.pg_policy where polrelid = receipt_oid) <> 2
    or not exists (select 1 from pg_catalog.pg_policy where polrelid = receipt_oid
      and polname = 'Private writer reads own editor receipts' and polcmd = 'r' and polpermissive
      and polroles = array['probpera_editor_operation_writer'::regrole::oid]
      and pg_catalog.pg_get_expr(polqual, polrelid) = '((actor_id = ( SELECT auth.uid() AS uid)) AND public.is_staff())'
      and polwithcheck is null)
    or not exists (select 1 from pg_catalog.pg_policy where polrelid = receipt_oid
      and polname = 'Private writer creates own editor receipts' and polcmd = 'a' and polpermissive
      and polroles = array['probpera_editor_operation_writer'::regrole::oid] and polqual is null
      and pg_catalog.pg_get_expr(polwithcheck, polrelid) = '((actor_id = ( SELECT auth.uid() AS uid)) AND public.is_staff())')
    or (select count(*) from pg_catalog.pg_trigger where tgrelid = receipt_oid and not tgisinternal) <> 1
    or not exists (select 1 from pg_catalog.pg_trigger where tgrelid = receipt_oid
      and tgname = 'editor_operation_receipt_append_only' and not tgisinternal and tgenabled = 'O' and tgtype = 27
      and tgfoid = protect_oid and tgnargs = 0 and tgqual is null) then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_JOURNAL_SCHEMA_INVALID';
  end if;

  -- Retention remains a private row, never an API UPDATE capability. These
  -- additive producer/trigger bodies are verified without owner repair.
  if not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid='public.article_working_drafts'::regclass)
    or has_table_privilege('authenticated','public.article_working_drafts','INSERT,UPDATE,DELETE')
    or exists (select 1 from pg_catalog.pg_class where oid='public.article_working_drafts'::regclass
      and (relkind <> 'r' or relpersistence <> 'p'))
    or not exists (select 1 from pg_catalog.pg_attribute where attrelid='public.article_working_drafts'::regclass
      and attname='draft_scope' and atttypid='text'::regtype and attnotnull and not attisdropped)
    or not exists (select 1 from pg_catalog.pg_attribute where attrelid='public.article_working_drafts'::regclass
      and attname='draft_english_enabled' and atttypid='boolean'::regtype and attnotnull and not attisdropped)
    or (select count(*) from pg_catalog.pg_attribute where attrelid='public.article_working_drafts'::regclass and attnum>0 and not attisdropped) <> 11
    or (select pg_catalog.pg_get_expr(adbin,adrelid) from pg_catalog.pg_attrdef where adrelid='public.article_working_drafts'::regclass
      and adnum=(select attnum from pg_catalog.pg_attribute where attrelid='public.article_working_drafts'::regclass and attname='draft_scope')) is distinct from '''bundle''::text'
    or (select pg_catalog.pg_get_expr(adbin,adrelid) from pg_catalog.pg_attrdef where adrelid='public.article_working_drafts'::regclass
      and adnum=(select attnum from pg_catalog.pg_attribute where attrelid='public.article_working_drafts'::regclass and attname='draft_english_enabled')) is distinct from 'false'
    or not exists (select 1 from pg_catalog.pg_constraint where conrelid='public.article_working_drafts'::regclass
      and conname='article_working_drafts_scope_check' and convalidated and not condeferrable
      and pg_catalog.pg_get_constraintdef(oid) = 'CHECK (((draft_scope = ANY (ARRAY[''bundle''::text, ''english-only''::text])) AND ((draft_scope <> ''english-only''::text) OR ((english_payload ->> ''mode''::text) = ''save''::text))))')
    or not exists (select 1 from pg_catalog.pg_constraint where conrelid='public.article_working_drafts'::regclass
      and conname='article_working_drafts_english_payload_check' and convalidated and not condeferrable
      and pg_catalog.pg_get_constraintdef(oid) = 'CHECK ((((jsonb_typeof(english_payload) = ''object''::text) AND (octet_length((english_payload)::text) <= 5242880) AND ((english_payload = ''{"mode": "disabled"}''::jsonb) OR (((english_payload ->> ''mode''::text) = ''save''::text) AND (english_payload ?& ARRAY[''mode''::text, ''payload''::text]) AND ((english_payload - ARRAY[''mode''::text, ''payload''::text]) = ''{}''::jsonb) AND (jsonb_typeof((english_payload -> ''payload''::text)) = ''object''::text)))) IS TRUE))')
    or not exists (select 1 from pg_catalog.pg_trigger where tgrelid='public.article_translations'::regclass
      and tgname='article_translations_rebase_retained_working_draft' and not tgisinternal and tgenabled='O'
      and tgtype=29 and tgfoid='public.rebase_retained_article_working_draft_english()'::regprocedure
      and tgnargs=0 and tgqual is null)
    or not exists (select 1 from pg_catalog.pg_trigger where tgrelid='public.articles'::regclass
      and tgname='articles_clear_working_draft_after_promotion' and not tgisinternal and tgenabled='O'
      and tgtype=17 and tgfoid='public.clear_article_working_draft_after_promotion()'::regprocedure and tgnargs=0
      and pg_catalog.pg_get_triggerdef(oid) = 'CREATE TRIGGER articles_clear_working_draft_after_promotion AFTER UPDATE ON public.articles FOR EACH ROW WHEN ((new.status = ANY (ARRAY[''published''::public.article_status, ''scheduled''::public.article_status, ''hidden''::public.article_status, ''archived''::public.article_status]))) EXECUTE FUNCTION public.clear_article_working_draft_after_promotion()')
    or not exists (select 1 from pg_catalog.pg_trigger where tgrelid='public.articles'::regclass
      and tgname='articles_guard_working_draft_promotion' and not tgisinternal and tgenabled='O'
      and tgtype=19 and tgfoid='public.guard_article_working_draft_promotion()'::regprocedure and tgnargs=0
      and pg_catalog.pg_get_triggerdef(oid) = 'CREATE TRIGGER articles_guard_working_draft_promotion BEFORE UPDATE ON public.articles FOR EACH ROW WHEN ((new.status = ANY (ARRAY[''published''::public.article_status, ''scheduled''::public.article_status, ''hidden''::public.article_status, ''archived''::public.article_status]))) EXECUTE FUNCTION public.guard_article_working_draft_promotion()') then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_RETENTION_SCHEMA_INVALID';
  end if;
  for expected_function in select * from (values
    ('public.save_article_working_draft(uuid,timestamptz,jsonb,jsonb,timestamptz,bigint)', '28479375612f5fceca08799de04c15c6a0edf5a2046a96830ea41be668155313'),
    ('public.promote_article_working_draft(uuid,timestamptz,bigint,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb)', '44e85738897bf4efaff01fe669bfcb2099d0f88efdaf99fbff420b4d37225f83'),
    ('public.clear_article_working_draft_after_promotion()', '188a04186e4aa3ade58365fc9e3999dec052f52a58d1c3b180d43e5735e81b78'),
    ('public.rebase_retained_article_working_draft_english()', 'f2baa94b5d7f035a967233f2269dc0a721b3e49aa0e96caba14c0246e8010c41')
  ) as frozen(signature, body_sha256) loop
    select * into strict actual_function from pg_catalog.pg_proc where oid=expected_function.signature::regprocedure;
    if encode(pg_catalog.sha256(convert_to(replace(actual_function.prosrc,chr(13),''),'UTF8')),'hex') <> expected_function.body_sha256
      or actual_function.proowner in ('authenticated'::regrole,'anon'::regrole,'service_role'::regrole,'probpera_editor_operation_writer'::regrole)
      or actual_function.prosecdef <> (expected_function.signature not like '%promote_article_working_draft(%')
      or actual_function.provolatile <> 'v' or actual_function.proconfig is distinct from array['search_path=""']::text[]
      or actual_function.proretset <> (expected_function.signature like '%promote_article_working_draft(%')
      or actual_function.prorettype <> (case when expected_function.signature like '%save_article_working_draft(%' then 'jsonb'::regtype
        when expected_function.signature like '%promote_article_working_draft(%' then 'record'::regtype else 'trigger'::regtype end)
      or actual_function.prolang <> (select oid from pg_catalog.pg_language where lanname='plpgsql')
      or actual_function.proisstrict or actual_function.proleakproof or actual_function.prokind <> 'f'
      or actual_function.proparallel <> 'u' or actual_function.prosupport <> 0 or actual_function.pronargdefaults <> 0
      or ((expected_function.signature like '%save_article_working_draft(%' or expected_function.signature like '%promote_article_working_draft(%')
        and not has_function_privilege('authenticated',actual_function.oid,'EXECUTE'))
      or actual_function.proargnames is distinct from (case
        when expected_function.signature like '%save_article_working_draft(%' then
          array['p_article_id','p_base_article_updated_at','p_payload','p_english_payload','p_expected_english_updated_at','p_expected_version']
        when expected_function.signature like '%promote_article_working_draft(%' then
          array['p_article_id','p_expected_article_updated_at','p_expected_working_draft_version','p_article_payload','p_english_mode','p_english_payload','p_expected_english_updated_at','p_redirect_source_path','p_redirect_destination_path','p_replace_homepage','p_audit_action','p_audit_metadata','p_social_publish_requested','p_social_metadata','article_id','article_updated_at','english_updated_at','homepage_replaced']
        else null::text[] end)
      or actual_function.proargmodes is distinct from (case when expected_function.signature like '%promote_article_working_draft(%'
        then array['i','i','i','i','i','i','i','i','i','i','i','i','i','i','t','t','t','t']::"char"[] else null::"char"[] end)
      or exists (select 1 from pg_catalog.aclexplode(coalesce(actual_function.proacl,pg_catalog.acldefault('f',actual_function.proowner))) permission
        where permission.grantee <> actual_function.proowner and
          (not ((expected_function.signature like '%save_article_working_draft(%' or expected_function.signature like '%promote_article_working_draft(%')
            and permission.grantee='authenticated'::regrole and permission.privilege_type='EXECUTE' and not permission.is_grantable))) then
      raise exception using errcode = '42501', message = 'EDITOR_OPERATION_RETENTION_IMPLEMENTATION_INVALID';
    end if;
  end loop;

  -- Frozen body hashes ignore CRLF transport only. This branch never repairs a
  -- changed installed body or recreates ownership grants on a repeat apply.
  for expected_function in select * from (values
    ('probpera_editor_operations.valid_receipt_shape(jsonb,text,timestamptz,timestamptz,bigint)', '47d4a28b2982bcbee3a235f8468b63b003c75ff30ea1e838b3c20a1d44575c6e'),
    ('probpera_editor_operations.validate_page_intent(jsonb)', '5bd4afbea6a32723b3be90bc00ba7f526d91f09146a227275d0d1ed8edadd6f2'),
    ('public.save_page_operation(jsonb,timestamptz,uuid,jsonb)', 'aae68647199a664c670ccd894f205ca4a29d415107ad91df22a61e8c1fb5f031'),
    ('probpera_editor_operations.protect_receipt()', '16031ef57a236c0f712517d744d37c2b9174d350faf02871dbd6a75eb1207aa6'),
    ('probpera_editor_operations.iso_stamp(jsonb)', '4c4a4fd9afc8306de00a24760beb1ae2e9aa78a6ce0a43cde1d8ddafa5b383ec'),
    ('probpera_editor_operations.intent_field(jsonb,text)', 'd3fa73aeb6af7382f8d592902213c92c69bdd18a5431ac4ebf75857c09911b61'),
    ('probpera_editor_operations.trim_context(text)', '559659d13f6dee66a8db8d1c1b3f3b2b9a53d41dc679939827256a8e75135930'),
    ('probpera_editor_operations.validate_intent(jsonb)', 'cf7d3cefce9910ec5578cb342ba88ba81432a1f2f6bd9e175a1b6328ea93bd71'),
    ('probpera_editor_operations.sha256_json(jsonb)', '26e59134b1aadb31f611f8a80d0b3bf1cead82044113a5da708cf052b9bd4474'),
    ('probpera_editor_operations.find_replay(uuid,jsonb,text)', 'ded6a9a3826399ccf66c1e92d93091ce538e4284b9c3ab25a1464bdb5a57447f'),
    ('public.get_editor_operation_result(uuid,jsonb)', '30fc600a988af58485a660eefffbcaa6b1521ac2606d5fa3fd7aea4efff10f4f'),
    ('public.save_article_bundle_operation(uuid,timestamptz,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb,uuid,jsonb)', '7f847b474582772ab7ab5110a4bb6ff03ab811e9bc812017e66ea8405ee9a9f4'),
    ('public.save_article_working_draft_operation(uuid,timestamptz,jsonb,jsonb,timestamptz,bigint,uuid,jsonb)', 'a99a7acf91aa8a11479d6627d59e9ed8b7079ad45763fcc3edf41649c3c3b212'),
    ('public.promote_article_working_draft_operation(uuid,timestamptz,bigint,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb,uuid,jsonb)', 'cb77968533546399195c406726625ebf13ca5161364641ab9b3ade011f470c14')
  ) as frozen(signature, body_sha256) loop
    select coalesce(string_agg((arg_type::regtype::oid)::text, ' '), '')::oidvector into expected_argtypes
      from unnest(string_to_array(split_part(split_part(expected_function.signature, '(', 2), ')', 1), ',')) arg_type;
    select * into strict actual_function from pg_catalog.pg_proc
      where pronamespace = (case when expected_function.signature like 'public.%' then 'public'::regnamespace else private_schema_oid end)
        and proname = split_part(split_part(expected_function.signature, '.', 2), '(', 1) and proargtypes = expected_argtypes;
    if encode(pg_catalog.sha256(convert_to(replace(actual_function.prosrc, chr(13), ''), 'UTF8')), 'hex') <> expected_function.body_sha256
      or actual_function.proowner <> 'probpera_editor_operation_writer'::regrole
      or actual_function.prorettype <> (case when expected_function.signature like '%protect_receipt(%' then 'trigger'::regtype
        when expected_function.signature like '%iso_stamp(%' then 'timestamptz'::regtype
        when expected_function.signature like '%validate_intent(%' or expected_function.signature like '%validate_page_intent(%' then 'void'::regtype
        when expected_function.signature like '%valid_receipt_shape(%' then 'boolean'::regtype
        when expected_function.signature like '%intent_field(%' or expected_function.signature like '%trim_context(%'
          or expected_function.signature like '%sha256_json(%' then 'text'::regtype else 'jsonb'::regtype end)
      or actual_function.prosecdef <> (expected_function.signature like 'public.%')
      or actual_function.provolatile <> (case when expected_function.signature like 'public.%'
        or expected_function.signature like '%protect_receipt(%' or expected_function.signature like '%find_replay(%' then 'v' else 'i' end)
      or actual_function.proconfig is distinct from (case when expected_function.signature like 'public.%'
        then array['search_path=""', 'TimeZone=UTC']::text[] else array['search_path=""']::text[] end)
      or actual_function.proretset or actual_function.proisstrict or actual_function.proleakproof
      or actual_function.prokind <> 'f' or actual_function.proparallel <> 'u' or actual_function.prosupport <> 0
      or actual_function.proargmodes is not null
      or actual_function.prolang <> (case when expected_function.signature like '%intent_field(%'
          or expected_function.signature like '%trim_context(%' or expected_function.signature like '%sha256_json(%'
        then (select oid from pg_catalog.pg_language where lanname='sql')
        else (select oid from pg_catalog.pg_language where lanname='plpgsql') end)
      or actual_function.pronargdefaults <> (case when expected_function.signature like '%find_replay(%' then 1 else 0 end)
      or (expected_function.signature like '%find_replay(%' and pg_catalog.pg_get_expr(actual_function.proargdefaults,0) is distinct from 'NULL::text')
      or actual_function.proargnames is distinct from (case
        when expected_function.signature like '%protect_receipt(%' then null::text[]
        when expected_function.signature like '%iso_stamp(%' or expected_function.signature like '%trim_context(%' or expected_function.signature like '%sha256_json(%' then array['p_value']
        when expected_function.signature like '%intent_field(%' then array['p_intent','p_name']
        when expected_function.signature like '%validate_intent(%' then array['p_intent']
        when expected_function.signature like '%validate_page_intent(%' then array['p_intent']
        when expected_function.signature like '%valid_receipt_shape(%' then array['p_result','p_persistence','p_expected_ru','p_expected_en','p_expected_version']
        when expected_function.signature like '%find_replay(%' then array['p_operation_id','p_submitted_intent','p_prepared_sha256']
        when expected_function.signature like '%get_editor_operation_result(%' then array['p_operation_id','p_submitted_intent']
        when expected_function.signature like '%save_page_operation(%' then array['p_payload','p_expected_updated_at','p_operation_id','p_submitted_intent']
        when expected_function.signature like '%save_article_working_draft_operation(%' then
          array['p_article_id','p_base_article_updated_at','p_payload','p_english_payload','p_expected_english_updated_at','p_expected_version','p_operation_id','p_submitted_intent']
        when expected_function.signature like '%promote_article_working_draft_operation(%' then
          array['p_article_id','p_expected_article_updated_at','p_expected_working_draft_version','p_article_payload','p_english_mode','p_english_payload','p_expected_english_updated_at','p_redirect_source_path','p_redirect_destination_path','p_replace_homepage','p_audit_action','p_audit_metadata','p_social_publish_requested','p_social_metadata','p_operation_id','p_submitted_intent']
        else array['p_article_id','p_expected_article_updated_at','p_article_payload','p_english_mode','p_english_payload','p_expected_english_updated_at','p_redirect_source_path','p_redirect_destination_path','p_replace_homepage','p_audit_action','p_audit_metadata','p_social_publish_requested','p_social_metadata','p_operation_id','p_submitted_intent'] end)
      or exists (select 1 from pg_catalog.aclexplode(coalesce(actual_function.proacl, pg_catalog.acldefault('f', actual_function.proowner))) permission
        where permission.grantee <> actual_function.proowner and
          (not (expected_function.signature like 'public.%' and permission.grantee = 'authenticated'::regrole
            and permission.privilege_type = 'EXECUTE' and not permission.is_grantable))) then
      raise exception using errcode = '42501', message = 'EDITOR_OPERATION_IMPLEMENTATION_INVALID';
    end if;
  end loop;
  if (select count(*) from pg_catalog.pg_proc where pronamespace = private_schema_oid) <> 9
    or not has_table_privilege('probpera_editor_operation_writer',receipt_oid,'SELECT')
    or not has_table_privilege('probpera_editor_operation_writer',receipt_oid,'INSERT') then
    raise exception using errcode = '42501', message = 'EDITOR_OPERATION_IMPLEMENTATION_INVALID';
  end if;
end;
$editor_operation_invariants$;
  $editor_operation_verification_sql$;
end;
$editor_operation_install$;
