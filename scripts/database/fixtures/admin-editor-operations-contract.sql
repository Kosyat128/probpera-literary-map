-- Isolated native PostgreSQL contract. Auth JWT claims and article schema are
-- fixture-owned; the actual predecessor save/promotion SQL and new migration
-- are executed verbatim. No HTTP transport or real GoTrue is asserted here.

create or replace function public.fixture_assert(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin if p_condition is not true then raise exception 'FIXTURE_ASSERT: %', p_message; end if; end;
$$;

create or replace function public.fixture_error(p_query text, p_message text default null)
returns void language plpgsql security invoker as $$
declare failed boolean := false;
begin
  begin execute p_query;
  exception when others then
    failed := true;
    if p_message is not null and sqlerrm not like '%' || p_message || '%' then
      raise exception 'FIXTURE_ERROR: wanted %, got %', p_message, sqlerrm;
    end if;
  end;
  perform public.fixture_assert(failed, 'expected rejection: ' || coalesce(p_message, 'ACL'));
end;
$$;

create or replace function public.fixture_payload(p_slug text default 'same-fixture', p_title text default U&'Авторский RU \2014 текст')
returns jsonb language sql immutable as $$
select jsonb_build_object(
  'title', p_title, 'slug', p_slug, 'subtitle', U&'Подзаголовок \2014 ручной', 'excerpt', 'Авторское вступление',
  'content_html', U&'<p>Авторский RU \2014 текст; дефис - и тире \2014 сохранены.</p><img src="https://fixture.test/ru.jpg" alt="РУ фото">',
  'content_json', U&'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Авторский RU \2014 текст; дефис - и тире \2014 сохранены."}]},{"type":"image","attrs":{"src":"https://fixture.test/ru.jpg","alt":"РУ фото","caption":"Авторская подпись","credit":"Иванов","source":"https://fixture.test/photo-source","license":"CC BY","licenseUrl":"https://fixture.test/license"}}]}'::jsonb,
  'cover_external_url', 'https://fixture.test/cover.jpg', 'cover_alt', U&'Обложка \2014 RU',
  'category_id', '00000000-0000-4000-8000-000000000010', 'status', 'draft',
  'sources', U&'[{"url":"https://fixture.test/ru-source","title":"Источник RU","note":"Ручной источник \2014 без правки"}]'::jsonb,
  'bibliography', U&'[{"title":"Книга \2014 RU","author":"Автор","rights":"Автор разрешил"}]'::jsonb,
  'seo_title', U&'SEO \2014 RU', 'seo_description', U&'Описание \2014 RU', 'seo_keywords', jsonb_build_array('литература', 'ручное'),
  'canonical_url', 'https://fixture.test/article', 'og_title', U&'OG \2014 RU', 'og_description', 'OG ручной',
  'allow_indexing', true, 'featured', true, 'show_on_homepage', false, 'pinned', true,
  'published_at', null, 'scheduled_at', null
);
$$;

create or replace function public.fixture_english(p_slug text default 'same-fixture-en')
returns jsonb language sql immutable as $$
select jsonb_build_object(
  'title', U&'Manual EN \2014 author text', 'slug', p_slug, 'subtitle', U&'Manual subtitle \2014 EN', 'excerpt', 'Author introduction',
  'content_html', U&'<p>Manual EN \2014 text; hyphen - and dash \2014 retained.</p><img src="https://fixture.test/en.jpg" alt="EN photo">',
  'content_json', U&'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Manual EN \2014 text; hyphen - and dash \2014 retained."}]},{"type":"image","attrs":{"src":"https://fixture.test/en.jpg","credit":"Author","source":"https://fixture.test/en-photo-source","license":"Permission","licenseUrl":"https://fixture.test/permission"}}]}'::jsonb,
  'cover_alt', 'Manual EN cover', 'sources', U&'[{"url":"https://fixture.test/en-source","title":"EN source","note":"Manual source \2014 unchanged"}]'::jsonb,
  'bibliography', '[{"title":"EN book","rights":"Author permission"}]'::jsonb,
  'seo_title', U&'SEO \2014 EN', 'seo_description', U&'Description \2014 EN', 'seo_keywords', jsonb_build_array('manual', 'literature'),
  'canonical_url', 'https://fixture.test/en/article', 'og_title', U&'OG \2014 EN', 'og_description', 'Manual OG',
  'status', 'draft', 'source_content_hash', 'manual-source-hash', 'source_article_updated_at', '2026-09-30T10:00:00.123456Z',
  'reviewed_by', null, 'reviewed_at', null, 'approved_by', null, 'approved_at', null, 'published_at', null
);
$$;

create or replace function public.fixture_intent(
  p_id uuid, p_ru timestamptz, p_en timestamptz, p_version bigint default 0,
  p_intent text default 'save', p_payload jsonb default public.fixture_payload()
)
returns jsonb language sql stable as $$
select jsonb_build_object('version', 1, 'entityType', 'article', 'entityId', p_id,
  'intent', p_intent, 'expectedUpdatedAt', case when p_ru is null then null else to_char(p_ru at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
  'englishExpectedUpdatedAt', case when p_en is null then null else to_char(p_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
  'workingDraftVersion', p_version, 'previewLocale', 'ru', 'fields', (
    select jsonb_agg(jsonb_build_array(key, value) order by key collate "C") from jsonb_each_text(jsonb_build_object(
      'id', coalesce(p_id::text, ''), 'expected_updated_at', coalesce(to_char(p_ru at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), ''),
      'english_expected_updated_at', coalesce(to_char(p_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), ''),
      'working_draft_version', p_version::text, 'intent', p_intent, 'preview_locale', 'ru',
      'title', p_payload ->> 'title', 'content_html', p_payload ->> 'content_html',
      'content_json', (p_payload -> 'content_json')::text,
      'sources', (p_payload -> 'sources')::text, 'bibliography', (p_payload -> 'bibliography')::text,
      'english_content_html', public.fixture_english() ->> 'content_html'
    ))
  ));
$$;

-- Assertion-only privileged reads: never used to authorize/mutate a save.
create or replace function public.fixture_observation(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
select jsonb_build_object('article', (select to_jsonb(a) from public.articles a where id = p_id),
  'english', (select to_jsonb(e) from public.article_translations e where article_id = p_id and locale = 'en'),
  'draft', (select to_jsonb(d) from public.article_working_drafts d where article_id = p_id),
  'revisions', (select count(*) from public.article_revisions where article_id = p_id),
  'englishRevisions', (select count(*) from public.article_translation_revisions where article_translation_id in
    (select id from public.article_translations where article_id = p_id)),
  'audit', (select count(*) from public.admin_audit_log), 'outbox', (select count(*) from public.public_build_outbox));
$$;

create or replace procedure public.fixture_seed()
language plpgsql as $$
begin
  insert into auth.users(id) values
    ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002'),
    ('00000000-0000-4000-8000-000000000003'), ('00000000-0000-4000-8000-000000000004');
  insert into public.staff_memberships(user_id, role) values
    ('00000000-0000-4000-8000-000000000001', 'owner'),
    ('00000000-0000-4000-8000-000000000002', 'editor'),
    ('00000000-0000-4000-8000-000000000003', 'admin');
  insert into public.categories(id, slug) values ('00000000-0000-4000-8000-000000000010', 'manual');
  insert into public.articles(id, title, slug, created_by, updated_by, updated_at, status, published_at)
  values
    ('00000000-0000-4000-8000-000000000101', 'Исходный RU', 'same-fixture', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '2026-09-30T10:00:00.123456Z', 'draft', null),
    ('00000000-0000-4000-8000-000000000102', 'Опубликованный RU', 'published-fixture', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '2026-09-30T10:00:00.123456Z', 'published', '2026-10-01T10:00:00Z');
  insert into public.article_translations(article_id, locale, title, slug, created_by, updated_by, updated_at)
  values
    ('00000000-0000-4000-8000-000000000101', 'en', 'Original EN', 'same-fixture-en', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '2026-09-30T10:00:00.654321Z'),
    ('00000000-0000-4000-8000-000000000102', 'en', 'Published original EN', 'published-fixture-en', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '2026-09-30T10:00:00.654321Z');
end;
$$;

call public.fixture_seed();
create table public.fixture_receipt_outputs (id bigint generated always as identity, envelope jsonb not null, context jsonb not null);
grant insert, select on public.fixture_receipt_outputs to authenticated;
grant usage, select on sequence public.fixture_receipt_outputs_id_seq to authenticated;
set session authorization authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);

-- Original producer, identical first-commit input. Its returned row is ignored
-- to simulate a caller without acknowledgement; this is not a HTTP loss test.
do $baseline$
declare
  id uuid := '00000000-0000-4000-8000-000000000101';
  ru timestamptz := '2026-09-30T10:00:00.123456Z';
  en timestamptz := '2026-09-30T10:00:00.654321Z';
  committed jsonb;
begin
  perform * from public.save_article_bundle(id, ru, public.fixture_payload(), 'save', public.fixture_english(), en,
    null, null, false, 'article.fixture.saved', '{}'::jsonb, false, '{}'::jsonb);
  committed := public.fixture_observation(id);
  perform public.fixture_error(format('select * from public.save_article_bundle(%L::uuid,%L::timestamptz,%L::jsonb,''save'',%L::jsonb,%L::timestamptz,null,null,false,''article.fixture.saved'',''{}'',false,''{}'')',
    id, ru, public.fixture_payload(), public.fixture_english(), en), 'ARTICLE_CONFLICT');
  perform public.fixture_assert(public.fixture_observation(id) = committed, 'legacy retry mutates no further data but cannot acknowledge saved state');
  perform public.fixture_assert((committed ->> 'revisions')::int = 1 and (committed ->> 'englishRevisions')::int = 1, 'legacy first commit has one RU and EN revision');
end;
$baseline$;
select 'LEGACY_COMMITTED_RETRY_CAS_FAILURE_CONFIRMED';

do $baseline_new$
declare saved_id uuid; committed jsonb;
begin
  select article_id into saved_id from public.save_article_bundle(null, null, public.fixture_payload('copy-fixture'), 'none', null, null,
    null, null, false, 'article.fixture.copy', '{}'::jsonb, false, '{}'::jsonb);
  committed := public.fixture_observation(saved_id);
  perform public.fixture_error(format('select * from public.save_article_bundle(null,null,%L::jsonb,''none'',null,null,null,null,false,''article.fixture.copy'',''{}'',false,''{}'')', public.fixture_payload('copy-fixture')), 'unique');
  perform public.fixture_assert(public.fixture_observation(saved_id) = committed, 'legacy duplicate new retry is rolled back');
end;
$baseline_new$;
select 'LEGACY_COMMITTED_NEW_RETRY_DUPLICATE_CONFIRMED';
set session authorization default;

-- Reset the exact fixture (including fixed IDs/CAS and trigger observations)
-- before the additive wrappers. Both variants call unchanged actual producers.
truncate public.article_translation_revisions, public.article_revisions, public.article_working_drafts,
  public.article_translations, public.articles, public.categories, public.staff_memberships,
  public.redirects, public.admin_audit_log, public.public_build_outbox, auth.users restart identity cascade;
call public.fixture_seed();

-- Mimic managed migrations: CREATEROLE and BYPASSRLS, never SUPERUSER. Initial
-- bootstrap is explicitly refused without retaining creator ADMIN privileges.
create role m02_migration_executor nologin nosuperuser createrole bypassrls;
grant authenticated to m02_migration_executor with admin true;
do $database_grant$
begin execute format('grant create on database %I to m02_migration_executor', current_database()); end;
$database_grant$;
grant usage, create on schema public to m02_migration_executor;
-- Managed postgres owns the public schema (directly or via database ownership),
-- which permits temporary function-owner CREATE grants. CREATE alone cannot
-- grant CREATE to another role; this ownership is explicit in the local stand.
alter schema public owner to m02_migration_executor;
grant usage on schema auth to m02_migration_executor;
grant references on auth.users to m02_migration_executor;
set session authorization m02_migration_executor;
select public.fixture_error('select public.fixture_apply_migration()', 'EDITOR_OPERATION_PRIVILEGED_BOOTSTRAP_REQUIRED');
select public.fixture_assert(to_regnamespace('probpera_editor_operations') is null and
  not exists(select 1 from pg_roles where rolname='probpera_editor_operation_writer'), 'managed bootstrap refusal has no schema/role/DDL side effects');
set session authorization default;
select 'EDITOR_OPERATIONS_NON_SUPERUSER_BOOTSTRAP_REFUSED';
select public.fixture_error('select public.fixture_apply_invalid_migration()', 'EDITOR_OPERATION_IMPLEMENTATION_INVALID');
select public.fixture_assert(to_regnamespace('probpera_editor_operations') is null and
  not exists(select 1 from pg_roles where rolname='probpera_editor_operation_writer') and
  to_regprocedure('public.get_editor_operation_result(uuid,jsonb)') is null,
  'failed first verification rolls back schema, role, public function and owner privileges');
select 'EDITOR_OPERATIONS_FAILED_FIRST_VERIFY_ROLLBACK_OK';
-- __ADMIN_EDITOR_OPERATIONS_MIGRATION__
select 'EDITOR_OPERATIONS_PRIVILEGED_LOCAL_BOOTSTRAP_OK';
set session authorization m02_migration_executor;
-- __ADMIN_EDITOR_OPERATIONS_REAPPLY__
set session authorization default;
select 'EDITOR_OPERATIONS_NON_SUPERUSER_SECOND_APPLY_OK';

-- Each tamper case rolls back its fixture-only mutation after proving that the
-- repeat verifier rejected it. The initializer never repairs accepted objects.
create or replace function public.fixture_reject_tamper(p_mutation text, p_expected text)
returns void language plpgsql security invoker as $$
begin
  begin
    execute p_mutation;
    perform public.fixture_error('select public.fixture_apply_migration()',p_expected);
    raise exception 'FIXTURE_TAMPER_ROLLBACK';
  exception when others then
    if sqlerrm <> 'FIXTURE_TAMPER_ROLLBACK' then raise; end if;
  end;
end;
$$;
select public.fixture_reject_tamper('alter table probpera_editor_operations.receipts rename column actor_id to forged_actor', 'EDITOR_OPERATION_JOURNAL_SCHEMA_INVALID');
select public.fixture_reject_tamper('alter table probpera_editor_operations.receipts disable row level security', 'EDITOR_OPERATION_PRIVILEGE_BOUNDARY_INVALID');
select public.fixture_reject_tamper('drop trigger editor_operation_receipt_append_only on probpera_editor_operations.receipts', 'EDITOR_OPERATION_JOURNAL_SCHEMA_INVALID');
select public.fixture_reject_tamper('alter policy "Private writer reads own editor receipts" on probpera_editor_operations.receipts using (true)', 'EDITOR_OPERATION_JOURNAL_SCHEMA_INVALID');
select public.fixture_reject_tamper('alter table probpera_editor_operations.receipts drop constraint receipts_working_draft_version_check', 'EDITOR_OPERATION_JOURNAL_SCHEMA_INVALID');
select public.fixture_reject_tamper('grant execute on function public.get_editor_operation_result(uuid,jsonb) to authenticated with grant option', 'EDITOR_OPERATION_IMPLEMENTATION_INVALID');
select public.fixture_reject_tamper('grant execute on function public.get_editor_operation_result(uuid,jsonb) to service_role', 'EDITOR_OPERATION_PRIVILEGE_BOUNDARY_INVALID');
select public.fixture_reject_tamper('alter function public.get_editor_operation_result(uuid,jsonb) stable', 'EDITOR_OPERATION_PRIVILEGE_BOUNDARY_INVALID');
select public.fixture_reject_tamper('alter function public.get_editor_operation_result(uuid,jsonb) strict', 'EDITOR_OPERATION_IMPLEMENTATION_INVALID');
select public.fixture_reject_tamper('alter function public.get_editor_operation_result(uuid,jsonb) set search_path to public', 'EDITOR_OPERATION_IMPLEMENTATION_INVALID');
select public.fixture_reject_tamper('grant probpera_editor_operation_writer to m02_migration_executor', 'EDITOR_OPERATION_PRIVILEGE_BOUNDARY_INVALID');
select public.fixture_reject_tamper('alter table probpera_editor_operations.receipts set unlogged', 'EDITOR_OPERATION_JOURNAL_SCHEMA_INVALID');
select public.fixture_reject_tamper('drop schema probpera_editor_operations cascade', 'EDITOR_OPERATION_PARTIAL_INSTALLATION');
select public.fixture_apply_migration();
select 'EDITOR_OPERATIONS_TAMPER_FAIL_CLOSED_OK';

set session authorization authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);

do $saved_replay$
declare
  id uuid := '00000000-0000-4000-8000-000000000101';
  op uuid := '10000000-0000-4000-8000-000000000001';
  ru timestamptz := '2026-09-30T10:00:00.123456Z';
  en timestamptz := '2026-09-30T10:00:00.654321Z';
  intent jsonb := public.fixture_intent(id, ru, en);
  original jsonb; replay jsonb; committed jsonb; payload jsonb := public.fixture_payload();
  english jsonb := public.fixture_english(); key text;
begin
  original := public.save_article_bundle_operation(id, ru, payload, 'save', english, en,
    null, null, false, 'article.fixture.saved', '{}'::jsonb, false, '{}'::jsonb, op, intent);
  perform public.fixture_assert(original ->> 'englishWrite' = 'saved' and not (original -> 'result' ? 'englishWrite')
    and (select count(*) from jsonb_object_keys(original -> 'result')) = 4,
    'accepted full EN write scope is durable while original raw RPC shape stays exact');
  committed := public.fixture_observation(id);
  replay := public.save_article_bundle_operation(id, ru, payload, 'save', english, en,
    null, null, false, 'article.fixture.saved', '{}'::jsonb, false, '{}'::jsonb, op, intent);
  perform public.fixture_assert(original ->> 'replayed' = 'false' and replay ->> 'replayed' = 'true', 'first commit versus replay');
  perform public.fixture_assert((original #>> '{result,article_updated_at}')::timestamptz > ru and
    (original #>> '{result,english_updated_at}')::timestamptz > en, 'actual RU/EN acknowledgement strictly advances microsecond CAS');
  insert into public.fixture_receipt_outputs(envelope,context) values
    (original,jsonb_build_object('operationId',op,'submittedIntent',intent)),(replay,jsonb_build_object('operationId',op,'submittedIntent',intent));
  perform public.fixture_assert(original - 'replayed' = replay - 'replayed', 'same original durable receipt after stale-CAS replay');
  perform public.fixture_assert(public.get_editor_operation_result(op, intent) = replay, 'read-only reconciliation returns committed original result');
  perform public.fixture_assert(public.fixture_observation(id) = committed, 'replay and reconciliation cause no RU/EN/revision/audit/outbox mutations');
  perform public.fixture_assert((committed ->> 'revisions')::int = 1 and (committed ->> 'englishRevisions')::int = 1 and (committed ->> 'audit')::int = 1,
    'same fixture has exactly one actual save and its side effects');
  foreach key in array array['title','subtitle','excerpt','content_html','content_json','cover_external_url','cover_alt','category_id','sources','bibliography','seo_title','seo_description','canonical_url','og_title','og_description'] loop
    perform public.fixture_assert(committed -> 'article' -> key = payload -> key, 'RU authored field preserved: ' || key);
  end loop;
  foreach key in array array['title','subtitle','excerpt','content_html','content_json','cover_alt','sources','bibliography','seo_title','seo_description','canonical_url','og_title','og_description'] loop
    perform public.fixture_assert(committed -> 'english' -> key = english -> key, 'EN authored field preserved: ' || key);
  end loop;
  perform public.fixture_error(format('select public.get_editor_operation_result(%L::uuid,%L::jsonb)', op,
    jsonb_set(intent, '{fields,0,1}', '"changed"')), 'EDITOR_OPERATION_CONFLICT');
  perform public.fixture_error(format('select public.save_article_bundle_operation(%L::uuid,%L::timestamptz,%L::jsonb,''save'',%L::jsonb,%L::timestamptz,null,null,false,''article.fixture.saved'',''{}'',false,''{}'',%L::uuid,%L::jsonb)',
    id, ru, jsonb_set(payload, '{title}', '"Changed prepared RU"'), english, en, op, intent), 'EDITOR_OPERATION_CONFLICT');
  perform public.fixture_error(format('select public.save_article_bundle_operation(%L::uuid,%L::timestamptz,%L::jsonb,''save'',%L::jsonb,%L::timestamptz,null,null,false,''different.audit'',''{}'',false,''{}'',%L::uuid,%L::jsonb)',
    id, ru, payload, english, en, op, intent), 'EDITOR_OPERATION_CONFLICT');
  perform public.fixture_assert(public.fixture_observation(id) = committed, 'both frozen intent and prepared command mismatches leave all committed state unchanged');
end;
$saved_replay$;
select 'EDITOR_OPERATIONS_SAME_FIXTURE_REPLAY_OK';

do $new_replay$
declare
  op uuid := '10000000-0000-4000-8000-000000000002';
  payload jsonb := public.fixture_payload('copy-fixture');
  intent jsonb := public.fixture_intent(null, null, null, 0, 'preview', payload);
  saved jsonb; replay jsonb; committed jsonb; id uuid;
begin
  saved := public.save_article_bundle_operation(null, null, payload, 'none', null, null,
    null, null, false, 'article.fixture.copy', '{}'::jsonb, false, '{}'::jsonb, op, intent);
  id := (saved #>> '{result,article_id}')::uuid;
  committed := public.fixture_observation(id);
  replay := public.save_article_bundle_operation(null, null, payload, 'none', null, null,
    null, null, false, 'article.fixture.copy', '{}'::jsonb, false, '{}'::jsonb, op, intent);
  insert into public.fixture_receipt_outputs(envelope,context) values
    (saved,jsonb_build_object('operationId',op,'submittedIntent',intent)),(replay,jsonb_build_object('operationId',op,'submittedIntent',intent));
  perform public.fixture_assert(saved -> 'requestedEntityId' = 'null'::jsonb and saved #>> '{result,english_updated_at}' is null,
    'new/copy original identity and EN-none null retained');
  perform public.fixture_assert(saved ->> 'englishWrite' = 'preserved' and replay ->> 'englishWrite' = 'preserved'
    and not (saved -> 'result' ? 'englishWrite'), 'EN-none new/copy cannot acknowledge submitted manual EN');
  perform public.fixture_assert(saved - 'replayed' = replay - 'replayed' and replay ->> 'replayed' = 'true', 'new/copy replay returns the created original ID');
  perform public.fixture_assert(public.fixture_observation(id) = committed and (select count(*) from public.articles where slug = 'copy-fixture') = 1, 'new/copy once only');
end;
$new_replay$;
select 'EDITOR_OPERATIONS_NEW_COPY_REPLAY_OK';

-- Published working copies remain canonical-CAS bound. An editor is permitted
-- to prepare a draft by the actual guarded SECURITY DEFINER predecessor.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
do $draft_replay$
declare
  id uuid := '00000000-0000-4000-8000-000000000102'; op uuid := '10000000-0000-4000-8000-000000000003';
  ru timestamptz := '2026-09-30T10:00:00.123456Z'; en timestamptz := '2026-09-30T10:00:00.654321Z';
  payload jsonb := public.fixture_payload('published-fixture');
  english jsonb := jsonb_build_object('mode', 'save', 'payload', public.fixture_english('published-fixture-en'));
  intent jsonb := public.fixture_intent(id, ru, en, 0, 'save', payload);
  before_save jsonb := public.fixture_observation(id); saved jsonb; replay jsonb; committed jsonb;
begin
  saved := public.save_article_working_draft_operation(id, ru, payload, english, en, 0, op, intent);
  committed := public.fixture_observation(id);
  replay := public.save_article_working_draft_operation(id, ru, payload, english, en, 0, op, intent);
  insert into public.fixture_receipt_outputs(envelope,context) values
    (saved,jsonb_build_object('operationId',op,'submittedIntent',intent)),(replay,jsonb_build_object('operationId',op,'submittedIntent',intent));
  perform public.fixture_assert(saved ->> 'canonicalStatus' = 'published' and saved #>> '{result,version}' = '1', 'actual working copy receipt/version');
  perform public.fixture_assert(saved ->> 'englishWrite' = 'saved' and replay ->> 'englishWrite' = 'saved'
    and not (saved -> 'result' ? 'englishWrite') and (select count(*) from jsonb_object_keys(saved -> 'result')) = 3,
    'actual working copy accepted full English payload without extending original RPC result');
  perform public.fixture_assert(saved - 'replayed' = replay - 'replayed' and public.fixture_observation(id) = committed, 'working copy replay never increments version or audits');
  perform public.fixture_assert(committed -> 'article' = before_save -> 'article' and committed -> 'english' = before_save -> 'english', 'working copy leaves public RU/EN CAS and text intact');
  perform public.fixture_assert(committed #> '{draft,payload}' = payload and committed #> '{draft,english_payload}' = english, 'private draft preserves full authored payload');
  perform public.fixture_error(format('select public.save_article_working_draft_operation(%L::uuid,%L::timestamptz,%L::jsonb,%L::jsonb,%L::timestamptz,0,%L::uuid,%L::jsonb)',
    id, ru, jsonb_set(payload, '{sources}', '[]'), english, en, op, intent), 'EDITOR_OPERATION_CONFLICT');
  perform public.fixture_error(format('select public.save_article_bundle_operation(%L::uuid,%L::timestamptz,%L::jsonb,''none'',null,null,null,null,false,null,''{}'',false,''{}'',%L::uuid,%L::jsonb)',
    id, ru, payload || '{"status":"published","published_at":"2026-10-07T11:00:00Z"}',
    '10000000-0000-4000-8000-000000000013', intent), null);
  perform public.fixture_assert(public.fixture_observation(id) = committed, 'private role wrapper cannot bypass editor publication boundary');
end;
$draft_replay$;
select 'EDITOR_OPERATIONS_WORKING_DRAFT_REPLAY_OK';

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
do $promotion_replay$
declare
  id uuid := '00000000-0000-4000-8000-000000000102'; op uuid := '10000000-0000-4000-8000-000000000004';
  ru timestamptz := '2026-09-30T10:00:00.123456Z'; en timestamptz := '2026-09-30T10:00:00.654321Z';
  payload jsonb := public.fixture_payload('published-fixture') || '{"status":"published","published_at":"2026-10-07T11:00:00Z"}';
  english jsonb := public.fixture_english('published-fixture-en');
  intent jsonb := public.fixture_intent(id, ru, en, 1, 'publish', payload);
  saved jsonb; replay jsonb; committed jsonb;
begin
  saved := public.promote_article_working_draft_operation(id, ru, 1, payload, 'save', english, en,
    null, null, false, 'article.fixture.promoted', '{}'::jsonb, false, '{}'::jsonb, op, intent);
  committed := public.fixture_observation(id);
  replay := public.promote_article_working_draft_operation(id, ru, 1, payload, 'save', english, en,
    null, null, false, 'article.fixture.promoted', '{}'::jsonb, false, '{}'::jsonb, op, intent);
  perform public.fixture_assert((saved #>> '{result,article_updated_at}')::timestamptz > ru and
    (saved #>> '{result,english_updated_at}')::timestamptz > en, 'actual promotion RU/EN acknowledgement advances CAS');
  insert into public.fixture_receipt_outputs(envelope,context) values
    (saved,jsonb_build_object('operationId',op,'submittedIntent',intent)),(replay,jsonb_build_object('operationId',op,'submittedIntent',intent));
  perform public.fixture_assert(saved ->> 'canonicalStatus' = 'published' and saved ->> 'persistence' = 'working-draft-promotion', 'actual promotion status/path');
  perform public.fixture_assert(saved ->> 'englishWrite' = 'saved' and replay ->> 'englishWrite' = 'saved',
    'promotion full EN scope is replayed from the committed command');
  perform public.fixture_assert(committed -> 'draft' = 'null'::jsonb, 'actual promotion removed committed working draft');
  perform public.fixture_assert(saved - 'replayed' = replay - 'replayed' and public.fixture_observation(id) = committed, 'promotion replays before missing draft/stale canonical CAS checks');
end;
$promotion_replay$;
select 'EDITOR_OPERATIONS_PROMOTION_REPLAY_OK';

-- En-none accepts a captured old EN token while binding the original legacy
-- argument NULL exactly. Disabled EN does not manufacture an EN acknowledgement.
do $none_english_context$
#variable_conflict use_variable
declare id uuid := '00000000-0000-4000-8000-000000000101'; ru timestamptz; en timestamptz;
  intent jsonb; saved jsonb;
begin
  select updated_at into ru from public.articles where articles.id = id;
  select updated_at into en from public.article_translations where article_id = id and locale = 'en';
  intent := public.fixture_intent(id, ru, en);
  saved := public.save_article_bundle_operation(id, ru, public.fixture_payload(), 'none', null, null,
    null, null, false, null, '{}', false, '{}', '10000000-0000-4000-8000-000000000005', intent);
  insert into public.fixture_receipt_outputs(envelope,context) values
    (saved,jsonb_build_object('operationId','10000000-0000-4000-8000-000000000005','submittedIntent',intent)),
    (public.get_editor_operation_result('10000000-0000-4000-8000-000000000005',intent),
      jsonb_build_object('operationId','10000000-0000-4000-8000-000000000005','submittedIntent',intent));
  perform public.fixture_assert(saved #>> '{result,english_updated_at}' is null and
    (select updated_at from public.article_translations where article_id = id and locale = 'en') = en, 'none preserves EN canonical CAS and returns null original RPC EN');
  perform public.fixture_assert(saved ->> 'englishWrite' = 'preserved' and
    public.get_editor_operation_result('10000000-0000-4000-8000-000000000005',intent) ->> 'englishWrite' = 'preserved',
    'none durable receipt reports preserved English even with captured old EN CAS');
end;
$none_english_context$;
select 'EDITOR_OPERATIONS_EN_NONE_CONTEXT_OK';

-- The old producer may advance EN CAS while changing status only. That token
-- must not claim that the manual EN body in the frozen form was accepted.
do $stale_english_scope$
#variable_conflict use_variable
declare id uuid := '00000000-0000-4000-8000-000000000101'; ru timestamptz; en timestamptz;
  op uuid := '10000000-0000-4000-8000-000000000007'; intent jsonb; saved jsonb; replay jsonb; before_save jsonb;
begin
  select updated_at into ru from public.articles where articles.id = id;
  select updated_at into en from public.article_translations where article_id = id and locale = 'en';
  intent := public.fixture_intent(id, ru, en); before_save := public.fixture_observation(id);
  saved := public.save_article_bundle_operation(id, ru, public.fixture_payload(), 'stale', null, en,
    null, null, false, null, '{}', false, '{}', op, intent);
  replay := public.get_editor_operation_result(op,intent);
  perform public.fixture_assert(saved ->> 'englishWrite' = 'status-only' and replay ->> 'englishWrite' = 'status-only'
    and (saved #>> '{result,english_updated_at}')::timestamptz > en,
    'nonnull advanced EN CAS represents status-only scope, never full manual EN acceptance');
  perform public.fixture_assert(((public.fixture_observation(id) -> 'english') - array['status','approved_by','approved_at','published_at','updated_by','updated_at']) =
    ((before_save -> 'english') - array['status','approved_by','approved_at','published_at','updated_by','updated_at']),
    'status-only producer preserves authored English bytes and ownership fields');
  perform public.fixture_assert(saved - 'replayed' = replay - 'replayed', 'status-only scope is durable at read-only lookup');
  insert into public.fixture_receipt_outputs(envelope,context) values
    (saved,jsonb_build_object('operationId',op,'submittedIntent',intent)),(replay,jsonb_build_object('operationId',op,'submittedIntent',intent));
end;
$stale_english_scope$;
select 'EDITOR_OPERATIONS_EN_STATUS_ONLY_SCOPE_OK';

do $invalid_intents$
#variable_conflict use_variable
declare
  intent jsonb := public.fixture_intent(null, null, null); invalid jsonb;
  id uuid := '00000000-0000-4000-8000-000000000102'; ru timestamptz; en timestamptz;
begin
  foreach invalid in array array[
    intent || '{"extra":true}', intent || '{"version":2}', intent || '{"entityType":"page"}',
    intent || '{"workingDraftVersion":true}', intent || '{"workingDraftVersion":9007199254740992}',
    intent || '{"workingDraftVersion":1.5}', intent || '{"entityId":"bad"}',
    intent || '{"expectedUpdatedAt":"2026-02-30T10:00:00Z"}',
    intent || '{"fields":[["title","A"],["title","B"]]}',
    intent || '{"fields":[["z","A"],["a","B"]]}',
    intent || '{"fields":[["title",42]]}', intent || '{"fields":[["article_result_mode","receipt"]]}',
    intent || '{"fields":[["working_draft_version"," 0"]]}',
    intent || '{"fields":[["working_draft_version","0.0"]]}',
    intent || '{"fields":[["working_draft_version","0e0"]]}',
    intent || '{"fields":[["intent","unknown"]]}',
    intent || '{"fields":[["preview_locale","unknown"]]}'
  ] loop
    perform public.fixture_error(format('select public.get_editor_operation_result(%L::uuid,%L::jsonb)',
      '10000000-0000-4000-8000-000000000099', invalid), 'EDITOR_OPERATION_INTENT_INVALID');
  end loop;
  invalid := intent || jsonb_build_object('fields', jsonb_build_array(jsonb_build_array(repeat('a', 101), 'x')));
  perform public.fixture_error(format('select public.get_editor_operation_result(%L::uuid,%L::jsonb)',
    '10000000-0000-4000-8000-000000000099', invalid), 'EDITOR_OPERATION_INTENT_INVALID');
  invalid := intent || jsonb_build_object('fields', jsonb_build_array(jsonb_build_array('content_html', repeat('😀', 1000001))));
  perform public.fixture_error(format('select public.get_editor_operation_result(%L::uuid,%L::jsonb)',
    '10000000-0000-4000-8000-000000000099', invalid), 'EDITOR_OPERATION_INTENT_INVALID');
  perform public.fixture_assert(public.get_editor_operation_result('10000000-0000-4000-8000-000000000099', intent) is null, 'valid unknown operation has no fabricated receipt');
  select updated_at into ru from public.articles where articles.id = id;
  select updated_at into en from public.article_translations where article_id = id and locale = 'en';
  invalid := public.fixture_intent(id,ru,en,9007199254740991);
  perform public.fixture_error(format('select public.save_article_working_draft_operation(%L::uuid,%L::timestamptz,%L::jsonb,%L::jsonb,%L::timestamptz,9007199254740991,%L::uuid,%L::jsonb)',
    id,ru,public.fixture_payload('published-fixture'),jsonb_build_object('mode','disabled'),en,'10000000-0000-4000-8000-000000000099',invalid), 'EDITOR_OPERATION_INTENT_INVALID');
end;
$invalid_intents$;
select 'EDITOR_OPERATIONS_INVALID_INTENTS_OK';

-- Foreign actors cannot read the original receipt even if they know its exact
-- operationId and intent. A colliding insert also rolls back their attempted save.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', false);
do $actor_boundary$
#variable_conflict use_variable
declare id uuid := '00000000-0000-4000-8000-000000000101'; ru timestamptz; en timestamptz;
  before_save jsonb; intent jsonb;
begin
  perform public.fixture_assert(public.get_editor_operation_result('10000000-0000-4000-8000-000000000001',
    public.fixture_intent(id, '2026-09-30T10:00:00.123456Z', '2026-09-30T10:00:00.654321Z')) is null, 'foreign staff receives no receipt');
  select updated_at into ru from public.articles where articles.id = id;
  select updated_at into en from public.article_translations where article_id = id and locale = 'en';
  intent := public.fixture_intent(id, ru, en);
  before_save := public.fixture_observation(id);
  perform public.fixture_error(format('select public.save_article_bundle_operation(%L::uuid,%L::timestamptz,%L::jsonb,''none'',null,null,null,null,false,null,''{}'',false,''{}'',%L::uuid,%L::jsonb)',
    id, ru, public.fixture_payload(), '10000000-0000-4000-8000-000000000001', intent), 'duplicate');
  perform public.fixture_assert(public.fixture_observation(id) = before_save, 'foreign operation collision rolls back canonical/side effects');
  perform public.fixture_error('select * from probpera_editor_operations.receipts', 'permission denied');
  perform public.fixture_error('select probpera_editor_operations.find_replay(null,null,null)', 'permission denied');
  perform public.fixture_error('set role probpera_editor_operation_writer', 'permission denied');
end;
$actor_boundary$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', false);
select public.fixture_error(format('select public.get_editor_operation_result(%L::uuid,%L::jsonb)',
  '10000000-0000-4000-8000-000000000001', public.fixture_intent('00000000-0000-4000-8000-000000000101', '2026-09-30T10:00:00.123456Z', '2026-09-30T10:00:00.654321Z')), 'EDITOR_OPERATION_ACCESS_REQUIRED');
set session authorization default;
select 'EDITOR_OPERATIONS_ACTOR_ACL_BOUNDARY_OK';

-- A late ledger failure must abort the already executed canonical/EN transaction
-- and all authoritative fixture revision/outbox/audit triggers.
create or replace function public.fixture_fail_receipt()
returns trigger language plpgsql as $$
begin
  if new.operation_id in ('10000000-0000-4000-8000-000000000090'::uuid, '10000000-0000-4000-8000-000000000091'::uuid,
    '10000000-0000-4000-8000-000000000092'::uuid, '10000000-0000-4000-8000-000000000093'::uuid) then
    raise exception 'FIXTURE_RECEIPT_INSERT_FAILURE';
  end if;
  return new;
end;
$$;
create trigger fixture_fail_receipt before insert on probpera_editor_operations.receipts
for each row execute function public.fixture_fail_receipt();
set session authorization authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
do $late_failure$
#variable_conflict use_variable
declare id uuid := '00000000-0000-4000-8000-000000000101'; ru timestamptz; en timestamptz;
  before_save jsonb; payload jsonb := public.fixture_payload(); intent jsonb;
begin
  select updated_at into ru from public.articles where articles.id = id;
  select updated_at into en from public.article_translations where article_id = id and locale = 'en';
  intent := public.fixture_intent(id, ru, en); before_save := public.fixture_observation(id);
  perform public.fixture_error(format('select public.save_article_bundle_operation(%L::uuid,%L::timestamptz,%L::jsonb,''save'',%L::jsonb,%L::timestamptz,null,null,false,null,''{}'',false,''{}'',%L::uuid,%L::jsonb)',
    id, ru, payload, public.fixture_english(), en, '10000000-0000-4000-8000-000000000090', intent), 'FIXTURE_RECEIPT_INSERT_FAILURE');
  perform public.fixture_assert(public.fixture_observation(id) = before_save, 'late receipt failure rolls back full RU/EN, revisions, audit, outbox');
  payload := public.fixture_payload('failed-copy'); intent := public.fixture_intent(null,null,null,0,'save',payload);
  perform public.fixture_error(format('select public.save_article_bundle_operation(null,null,%L::jsonb,''none'',null,null,null,null,false,null,''{}'',false,''{}'',%L::uuid,%L::jsonb)',
    payload, '10000000-0000-4000-8000-000000000091', intent), 'FIXTURE_RECEIPT_INSERT_FAILURE');
  perform public.fixture_assert(not exists(select 1 from public.articles where slug = 'failed-copy') and public.fixture_observation(id) = before_save,
    'late receipt failure rolls back new/copy row plus all side effects');
end;
$late_failure$;

do $draft_promotion_late_failure$
#variable_conflict use_variable
declare id uuid := '00000000-0000-4000-8000-000000000102'; ru timestamptz; en timestamptz;
  before_save jsonb; payload jsonb := public.fixture_payload('published-fixture'); intent jsonb; saved jsonb; replay jsonb;
begin
  select updated_at into ru from public.articles where articles.id = id;
  select updated_at into en from public.article_translations where article_id = id and locale = 'en';
  intent := public.fixture_intent(id,ru,en,0,'save',payload); before_save := public.fixture_observation(id);
  perform public.fixture_error(format('select public.save_article_working_draft_operation(%L::uuid,%L::timestamptz,%L::jsonb,%L::jsonb,%L::timestamptz,0,%L::uuid,%L::jsonb)',
    id,ru,payload,jsonb_build_object('mode','save','payload',public.fixture_english('published-fixture-en')),en,'10000000-0000-4000-8000-000000000092',intent), 'FIXTURE_RECEIPT_INSERT_FAILURE');
  perform public.fixture_assert(public.fixture_observation(id) = before_save, 'late receipt failure rolls back working copy/audit');
  intent := jsonb_set(intent,'{fields}',(select jsonb_agg(pair order by (pair ->> 0) collate "C") from
    (select value as pair from jsonb_array_elements(intent -> 'fields') union all select '["english_enabled","on"]'::jsonb) fields));
  saved := public.save_article_working_draft_operation(id,ru,payload,jsonb_build_object('mode','disabled'),en,0,
    '10000000-0000-4000-8000-000000000006',intent);
  replay := public.get_editor_operation_result('10000000-0000-4000-8000-000000000006',intent);
  perform public.fixture_assert(saved ->> 'englishWrite' = 'preserved' and replay ->> 'englishWrite' = 'preserved'
    and exists (select 1 from jsonb_array_elements(intent -> 'fields') pair where pair = '["english_enabled","on"]'::jsonb),
    'accepted disabled English draft cannot acknowledge English enabled in the frozen submitted form');
  perform public.fixture_assert(public.fixture_observation(id) -> 'english' = before_save -> 'english'
    and public.fixture_observation(id) #> '{draft,english_payload}' = '{"mode":"disabled"}'::jsonb,
    'disabled draft stores accepted envelope and preserves canonical English exactly');
  insert into public.fixture_receipt_outputs(envelope,context) values
    (saved,jsonb_build_object('operationId','10000000-0000-4000-8000-000000000006','submittedIntent',intent)),
    (replay,jsonb_build_object('operationId','10000000-0000-4000-8000-000000000006','submittedIntent',intent));
  before_save := public.fixture_observation(id);
  payload := payload || '{"status":"published","published_at":"2026-10-07T11:00:00Z"}';
  intent := public.fixture_intent(id,ru,en,1,'publish',payload);
  perform public.fixture_error(format('select public.promote_article_working_draft_operation(%L::uuid,%L::timestamptz,1,%L::jsonb,''none'',null,null,null,null,false,null,''{}'',false,''{}'',%L::uuid,%L::jsonb)',
    id,ru,payload,'10000000-0000-4000-8000-000000000093',intent), 'FIXTURE_RECEIPT_INSERT_FAILURE');
  perform public.fixture_assert(public.fixture_observation(id) = before_save, 'late receipt failure restores working copy, canonical RU/EN and all side effects');
end;
$draft_promotion_late_failure$;
set session authorization default;
drop trigger fixture_fail_receipt on probpera_editor_operations.receipts;
select 'EDITOR_OPERATIONS_ATOMIC_LATE_FAILURE_OK';
select 'EDITOR_OPERATIONS_EN_DISABLED_DRAFT_SCOPE_OK';

-- Copy the actual private CHECK constraints into a disposable local table to
-- reject contradictory scope metadata without bypassing the append-only log.
create temporary table fixture_receipt_scope_constraints (like probpera_editor_operations.receipts including constraints);
do $scope_constraints$
declare invalid jsonb;
begin
  foreach invalid in array array['null'::jsonb, '42'::jsonb, '{}'::jsonb, '"unknown"'::jsonb] loop
    perform public.fixture_error(format('insert into pg_temp.fixture_receipt_scope_constraints select (jsonb_populate_record(null::probpera_editor_operations.receipts,to_jsonb(r) || jsonb_build_object(''result'',r.result || jsonb_build_object(''englishWrite'',%L::jsonb)))).* from probpera_editor_operations.receipts r where persistence=''article-bundle'' limit 1', invalid),
      'editor_operation_receipt_shape');
  end loop;
  perform public.fixture_error('insert into pg_temp.fixture_receipt_scope_constraints select (jsonb_populate_record(null::probpera_editor_operations.receipts,to_jsonb(r) || jsonb_build_object(''result'',(r.result - ''englishWrite'') || ''{"workingDraft":null}''::jsonb))).* from probpera_editor_operations.receipts r limit 1',
    'editor_operation_receipt_shape');
  perform public.fixture_error('insert into pg_temp.fixture_receipt_scope_constraints select (jsonb_populate_record(null::probpera_editor_operations.receipts,to_jsonb(r) || jsonb_build_object(''result'',r.result || ''{"englishWrite":"status-only"}''::jsonb))).* from probpera_editor_operations.receipts r where persistence=''working-draft'' limit 1',
    'editor_operation_receipt_shape');
  perform public.fixture_error('insert into pg_temp.fixture_receipt_scope_constraints select (jsonb_populate_record(null::probpera_editor_operations.receipts,to_jsonb(r) || jsonb_build_object(''result'',r.result || ''{"englishWrite":"saved","english_updated_at":null}''::jsonb))).* from probpera_editor_operations.receipts r where persistence=''article-bundle'' limit 1',
    'editor_operation_receipt_shape');
  perform public.fixture_error('insert into pg_temp.fixture_receipt_scope_constraints select (jsonb_populate_record(null::probpera_editor_operations.receipts,to_jsonb(r) || jsonb_build_object(''result'',r.result || ''{"englishWrite":"preserved"}''::jsonb))).* from probpera_editor_operations.receipts r where persistence=''article-bundle'' and result ->> ''englishWrite'' = ''saved'' limit 1',
    'editor_operation_receipt_shape');
  perform public.fixture_assert((select count(*) from pg_temp.fixture_receipt_scope_constraints) = 0,
    'scope constraints reject missing, corrupt, forbidden and CAS-contradictory metadata');
end;
$scope_constraints$;
drop table pg_temp.fixture_receipt_scope_constraints;
select 'EDITOR_OPERATIONS_EN_SCOPE_CONSTRAINTS_OK';

do $journal_assertions$
begin
  perform public.fixture_assert((select count(*) from probpera_editor_operations.receipts) = 7, 'only seven committed original operations have receipts');
  perform public.fixture_assert(not exists(select 1 from probpera_editor_operations.receipts where result::text like '%Авторский%' or result::text like '%Manual EN%' or result::text like '%fixture.test%'),
    'journal contains original small receipts and no authored body/media/source text');
  perform public.fixture_assert(not exists(select 1 from information_schema.columns where table_schema='probpera_editor_operations' and column_name in ('payload','body','fields','submitted_intent','prepared_command')),
    'journal stores hashes rather than a second content master');
  perform public.fixture_assert(not has_table_privilege('authenticated','probpera_editor_operations.receipts','SELECT,INSERT,UPDATE,DELETE') and
    not has_table_privilege('anon','probpera_editor_operations.receipts','SELECT,INSERT,UPDATE,DELETE') and
    not has_table_privilege('service_role','probpera_editor_operations.receipts','SELECT,INSERT,UPDATE,DELETE'), 'API has no ledger grants');
  perform public.fixture_assert((select relrowsecurity and relforcerowsecurity from pg_class where oid='probpera_editor_operations.receipts'::regclass), 'ledger FORCE RLS');
  perform public.fixture_error('update probpera_editor_operations.receipts set intent = ''preview''', 'EDITOR_OPERATION_RECEIPT_IMMUTABLE');
  perform public.fixture_error('delete from probpera_editor_operations.receipts', 'EDITOR_OPERATION_RECEIPT_IMMUTABLE');
  perform public.fixture_assert(not exists(select 1 from pg_roles where rolname='probpera_editor_operation_writer' and (rolsuper or rolbypassrls or rolcanlogin or rolcreaterole)), 'private owner has no elevated runtime bypass');
end;
$journal_assertions$;

-- Current entity readability and staff membership are checked again at lookup,
-- while the receipt's stored canonicalStatus remains its original transaction.
update public.articles set deleted_at = clock_timestamp() where id='00000000-0000-4000-8000-000000000101';
set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.fixture_error(format('select public.get_editor_operation_result(%L::uuid,%L::jsonb)',
  '10000000-0000-4000-8000-000000000001', public.fixture_intent('00000000-0000-4000-8000-000000000101','2026-09-30T10:00:00.123456Z','2026-09-30T10:00:00.654321Z')), 'EDITOR_OPERATION_ACCESS_REQUIRED');
set session authorization default;
delete from public.staff_memberships where user_id='00000000-0000-4000-8000-000000000001';
set session authorization authenticated;
select public.fixture_error(format('select public.get_editor_operation_result(%L::uuid,%L::jsonb)',
  '10000000-0000-4000-8000-000000000002', public.fixture_intent(null,null,null,0,'preview',public.fixture_payload('copy-fixture'))), 'EDITOR_OPERATION_ACCESS_REQUIRED');
set session authorization default;

set session authorization anon;
select public.fixture_error('select public.get_editor_operation_result(null,null)', 'permission denied');
set session authorization default;
set session authorization service_role;
select public.fixture_error('select public.get_editor_operation_result(null,null)', 'permission denied');
set session authorization default;
select 'EDITOR_OPERATIONS_CURRENT_ACCESS_RECHECK_OK';
select 'ARTICLE_OPERATION_DTO:' || jsonb_build_object('envelope',envelope,'context',context)::text from public.fixture_receipt_outputs order by id;
select 'ADMIN_EDITOR_OPERATIONS_OK';

-- The SAME authored E0/A setup and three actual legacy transitions as the
-- captured loss fixture. Baseline must fail preservation; current must pass.
create table public.fixture_pending_en_cases (
 article_id uuid primary key, slug text not null, transition text not null,
 ru_cas timestamptz not null, en_cas timestamptz not null, draft_version bigint not null,
 private_en_sha text not null, canonical_en_sha text not null
);
grant select, insert on public.fixture_pending_en_cases to authenticated;
create or replace function public.fixture_en_author_projection(p_row jsonb)
returns jsonb language sql immutable as $$
select jsonb_object_agg(key,value) from jsonb_each(p_row) where key = any(array[
 'title','subtitle','excerpt','slug','content_html','content_json','cover_alt','sources','bibliography',
 'seo_title','seo_description','seo_keywords','canonical_url','og_title','og_description']);
$$;
create or replace function public.fixture_pending_en_canonical_seed(p_id uuid,p_slug text,p_transition text)
returns void language plpgsql as $$
declare bundle record; ru_payload jsonb := public.fixture_payload(p_slug) || '{"legacy_path":null}'::jsonb;
 canonical_en jsonb := public.fixture_english(p_slug || '-en') || jsonb_build_object('title','Canonical EN E0',
   'status',case when p_transition='promotion-stale' then 'published' else 'draft' end) || case when p_transition='promotion-stale' then '{"approved_at":"2026-10-01T10:00:00Z","published_at":"2026-10-01T10:00:00Z"}'::jsonb else '{}'::jsonb end;
begin
 insert into public.articles(id,title,slug,created_by,updated_by,updated_at,status,published_at)
 values(p_id,'Исходный RU',p_slug,auth.uid(),auth.uid(),'2026-09-30T10:00:00.123456Z','published','2026-10-01T10:00:00Z');
 select * into strict bundle from public.save_article_bundle(p_id,'2026-09-30T10:00:00.123456Z',
   ru_payload || '{"status":"published","published_at":"2026-10-01T10:00:00Z"}'::jsonb,
   'save',canonical_en,null,null,null,false,null,'{}',false,'{}');
end;
$$;
create or replace function public.fixture_pending_en_seed(p_id uuid,p_slug text,p_transition text)
returns void language plpgsql as $$
declare bundle record; draft jsonb; before_save jsonb; after_save jsonb;
 ru_payload jsonb := public.fixture_payload(p_slug) || '{"legacy_path":null}'::jsonb;
 private_en jsonb;
begin
 before_save := public.fixture_observation(p_id);
 select (before_save #>> '{article,updated_at}')::timestamptz as article_updated_at, (before_save #>> '{english,updated_at}')::timestamptz as english_updated_at into bundle;
 private_en := (public.fixture_english(p_slug || '-en') - array['source_article_updated_at','reviewed_by','approved_by'])
   || '{"title":"Private pending manual EN A","deleted_at":null}'::jsonb;
 private_en := jsonb_set(private_en,'{content_html}',to_jsonb('<p>Private pending manual EN A body.</p>' || (private_en ->> 'content_html')));
 private_en := jsonb_set(private_en,'{content_json,content,0,content,0,text}',to_jsonb('Private pending manual EN A body. ' || (private_en #>> '{content_json,content,0,content,0,text}')));
 private_en := jsonb_set(private_en,'{sources}',(private_en -> 'sources') || '[{"text":"Private pending EN A source"}]'::jsonb);
 draft := public.save_article_working_draft(p_id,bundle.article_updated_at,ru_payload,
   jsonb_build_object('mode','save','payload',private_en),bundle.english_updated_at,0);
 after_save := public.fixture_observation(p_id);
 perform public.fixture_assert(after_save -> 'english' = before_save -> 'english','full private EN save leaves canonical E0 untouched');
 perform public.fixture_assert(after_save #> '{draft,english_payload,payload}' = private_en,
   'full private EN A with body/media/rights/sources is durable in working draft before transition');
 perform public.fixture_assert(public.fixture_en_author_projection(private_en) <> public.fixture_en_author_projection(before_save -> 'english'),
   'pending author A differs from canonical E0');
 insert into public.fixture_pending_en_cases values(p_id,p_slug,p_transition,bundle.article_updated_at,bundle.english_updated_at,(draft ->> 'version')::bigint,
   encode(pg_catalog.sha256(convert_to(public.fixture_en_author_projection(private_en)::text,'UTF8')),'hex'),
   encode(pg_catalog.sha256(convert_to(public.fixture_en_author_projection(before_save -> 'english')::text,'UTF8')),'hex'));
end;
$$;
create or replace function public.fixture_pending_en_transition(p_id uuid)
returns jsonb language plpgsql as $$
declare ctx public.fixture_pending_en_cases%rowtype; before_save jsonb; after_save jsonb; result jsonb;
 canonical_after_sha text; private_before_sha text; mode text;
begin
 select * into strict ctx from public.fixture_pending_en_cases where article_id=p_id;
 before_save := public.fixture_observation(p_id);
 private_before_sha := encode(pg_catalog.sha256(convert_to(public.fixture_en_author_projection(before_save #> '{draft,english_payload,payload}')::text,'UTF8')),'hex');
 perform public.fixture_assert(private_before_sha=ctx.private_en_sha and before_save #>> '{draft,version}'=ctx.draft_version::text,
   'prior committed full EN A draft is present at the independent transition RPC');
 if ctx.transition='draft-disabled' then
   result := public.save_article_working_draft(p_id,ctx.ru_cas,public.fixture_payload(ctx.slug) || '{"legacy_path":null}'::jsonb,
     '{"mode":"disabled"}',ctx.en_cas,ctx.draft_version);
 else
   mode := case ctx.transition when 'promotion-none' then 'none' else 'stale' end;
   select to_jsonb(bundle) into strict result from public.promote_article_working_draft(p_id,ctx.ru_cas,ctx.draft_version,
     public.fixture_payload(ctx.slug) || '{"legacy_path":null,"status":"published","published_at":"2026-10-01T10:00:00Z"}'::jsonb,
     mode,null,case when mode='none' then null else ctx.en_cas end,null,null,false,null,'{}',false,'{}') bundle;
 end if;
 after_save := public.fixture_observation(p_id);
 canonical_after_sha := encode(pg_catalog.sha256(convert_to(public.fixture_en_author_projection(after_save -> 'english')::text,'UTF8')),'hex');
 perform public.fixture_assert(canonical_after_sha=ctx.canonical_en_sha and canonical_after_sha<>ctx.private_en_sha,
   'canonical retains E0 author bytes and never receives pending A author bytes');
 perform public.fixture_assert(after_save #> '{draft,english_payload}' = before_save #> '{draft,english_payload}',
   'PENDING_EN_PRESERVATION_REQUIRED: full private A survives successful partial/disabled transition');
 perform public.fixture_assert((after_save #>> '{draft,version}')::bigint=ctx.draft_version+1,
   'retained private version advances exactly once');
 if ctx.transition='draft-disabled' then
   perform public.fixture_assert(after_save #>> '{draft,draft_scope}'='bundle' and after_save #> '{draft,draft_english_enabled}'='false'::jsonb,
     'disabled flag does not remove prior complete English A');
 else
   perform public.fixture_assert(after_save #>> '{draft,draft_scope}'='english-only' and after_save #> '{draft,draft_english_enabled}'='true'::jsonb,
     'RU-only release retains private English scope and its prior enabled flag');
   perform public.fixture_assert((result ->> 'article_updated_at')::timestamptz>ctx.ru_cas
     and after_save #> '{draft,base_article_updated_at}'=after_save #> '{article,updated_at}'
     and after_save #> '{draft,expected_english_updated_at}'=after_save #> '{english,updated_at}',
     'retained scope rebases both actual final canonical tokens');
   if mode='none' then
     perform public.fixture_assert(result -> 'english_updated_at'='null'::jsonb,'none still returns no EN acknowledgement');
   else
     perform public.fixture_assert((result ->> 'english_updated_at')::timestamptz>ctx.en_cas
       and after_save #>> '{english,status}'='stale','stale changes status/CAS without publishing private A');
   end if;
 end if;
 return jsonb_build_object('transition',ctx.transition,'articleId',p_id,'priorFullDraftVersion',ctx.draft_version,
   'pendingAuthorSha256',ctx.private_en_sha,'canonicalAuthorSha256Before',ctx.canonical_en_sha,
   'canonicalAuthorSha256After',canonical_after_sha,'pendingAAbsentFromCanonical',true,
   'pendingAAbsentFromWorkingDraft',false,'draftAfter','retained',
   'actualRpcResult',result);
end;
$$;

insert into public.staff_memberships(user_id,role) values('00000000-0000-4000-8000-000000000001','owner');
set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.fixture_pending_en_canonical_seed('00000000-0000-4000-8000-000000000201','pending-en-none','promotion-none');
select public.fixture_pending_en_canonical_seed('00000000-0000-4000-8000-000000000202','pending-en-stale','promotion-stale');
select public.fixture_pending_en_canonical_seed('00000000-0000-4000-8000-000000000203','pending-en-disabled','draft-disabled');
select public.fixture_pending_en_seed('00000000-0000-4000-8000-000000000201','pending-en-none','promotion-none');
select public.fixture_pending_en_seed('00000000-0000-4000-8000-000000000202','pending-en-stale','promotion-stale');
select public.fixture_pending_en_seed('00000000-0000-4000-8000-000000000203','pending-en-disabled','draft-disabled');
select 'PENDING_ENGLISH_PRESERVATION_DTO:' || public.fixture_pending_en_transition('00000000-0000-4000-8000-000000000201')::text;
select 'EDITOR_OPERATIONS_PENDING_EN_NONE_LEGACY_OK';
select 'PENDING_ENGLISH_PRESERVATION_DTO:' || public.fixture_pending_en_transition('00000000-0000-4000-8000-000000000202')::text;
select 'EDITOR_OPERATIONS_PENDING_EN_STALE_LEGACY_OK';
select 'PENDING_ENGLISH_PRESERVATION_DTO:' || public.fixture_pending_en_transition('00000000-0000-4000-8000-000000000203')::text;
select 'EDITOR_OPERATIONS_PENDING_EN_DISABLED_LEGACY_OK';

do $pending_english_operations$
declare
  id uuid := '00000000-0000-4000-8000-000000000201'; observation jsonb; frozen jsonb; saved jsonb; replay jsonb;
  payload jsonb := public.fixture_payload('pending-en-none') || '{"legacy_path":null}'::jsonb;
  ru timestamptz; en timestamptz; draft_version bigint; original_english jsonb; ignored jsonb;
begin
  observation:=public.fixture_observation(id); original_english:=observation #> '{draft,english_payload}';
  ru:=(observation #>> '{article,updated_at}')::timestamptz; en:=(observation #>> '{english,updated_at}')::timestamptz;
  draft_version:=(observation #>> '{draft,version}')::bigint;
  frozen:=public.fixture_intent(id,ru,en,draft_version,'save',payload);
  saved:=public.save_article_working_draft_operation(id,ru,payload,'{"mode":"disabled"}',en,draft_version,
    '20000000-0000-4000-8000-000000000001',frozen);
  perform public.fixture_assert(saved #> '{workingDraft,englishEnabled}'='false'::jsonb
    and saved #>> '{workingDraft,scope}'='bundle' and saved #>> '{workingDraft,englishWrite}'='preserved'
    and public.fixture_observation(id) #> '{draft,english_payload}'=original_english,
    'wrapper disabled continuation preserves A and captures actual private metadata');
  insert into public.fixture_receipt_outputs(envelope,context) values(saved,jsonb_build_object('operationId','20000000-0000-4000-8000-000000000001','submittedIntent',frozen));
  draft_version:=(saved #>> '{workingDraft,version}')::bigint;
  payload:=payload || '{"status":"published","published_at":"2026-10-01T10:00:00Z"}'::jsonb;
  frozen:=public.fixture_intent(id,ru,en,draft_version,'publish',payload);
  saved:=public.promote_article_working_draft_operation(id,ru,draft_version,payload,'none',null,null,null,null,false,null,'{}',false,'{}',
    '20000000-0000-4000-8000-000000000002',frozen);
  observation:=public.fixture_observation(id);
  perform public.fixture_assert(saved ->> 'englishWrite'='preserved' and saved #>> '{workingDraft,scope}'='english-only'
    and saved #> '{workingDraft,englishEnabled}'='false'::jsonb
    and observation #> '{draft,english_payload}'=original_english,
    'partial operation release keeps disabled A private while committing RU');
  insert into public.fixture_receipt_outputs(envelope,context) values(saved,jsonb_build_object('operationId','20000000-0000-4000-8000-000000000002','submittedIntent',frozen));
  replay:=public.promote_article_working_draft_operation(id,ru,draft_version,payload,'none',null,null,null,null,false,null,'{}',false,'{}',
    '20000000-0000-4000-8000-000000000002',frozen);
  perform public.fixture_assert(replay= saved || '{"replayed":true}'::jsonb and public.fixture_observation(id)=observation,
    'partial replay returns immutable original metadata without revision/audit/outbox/draft changes');
  insert into public.fixture_receipt_outputs(envelope,context) values(replay,jsonb_build_object('operationId','20000000-0000-4000-8000-000000000002','submittedIntent',frozen));
  ru:=(observation #>> '{article,updated_at}')::timestamptz; en:=(observation #>> '{english,updated_at}')::timestamptz;
  draft_version:=(observation #>> '{draft,version}')::bigint;
  ignored:=public.save_article_working_draft(id,ru,public.fixture_payload('pending-en-none') || '{"legacy_path":null}',original_english,en,draft_version);
  replay:=public.get_editor_operation_result('20000000-0000-4000-8000-000000000002',frozen);
  perform public.fixture_assert(replay=saved || '{"replayed":true}'::jsonb
    and (public.fixture_observation(id) #>> '{draft,version}')::bigint=draft_version+1,
    'lookup never replaces original receipt with later private metadata');
  observation:=public.fixture_observation(id); draft_version:=(observation #>> '{draft,version}')::bigint;
  select to_jsonb(bundle) into ignored from public.promote_article_working_draft(id,ru,draft_version,payload,'save',original_english -> 'payload',en,null,null,false,null,'{}',false,'{}') bundle;
  observation:=public.fixture_observation(id);
  perform public.fixture_assert(observation -> 'draft'='null'::jsonb
    and public.fixture_en_author_projection(observation -> 'english')=public.fixture_en_author_projection(original_english -> 'payload'),
    'full English promotion still consumes the private row and writes exact A author projection');
end;
$pending_english_operations$;
select 'EDITOR_OPERATIONS_PENDING_EN_OPERATION_REPLAY_FULL_SAVE_OK';

-- NONE deliberately has no canonical EN write dependency. An independent EN
-- change is retained in canonical E0, and the private A descriptor rebases to
-- the actual current EN token without claiming a new EN write.
select public.fixture_pending_en_canonical_seed('00000000-0000-4000-8000-000000000204','pending-en-concurrent','promotion-none');
select public.fixture_pending_en_seed('00000000-0000-4000-8000-000000000204','pending-en-concurrent','promotion-none');
update public.article_translations set title='Independent canonical E1',updated_by=auth.uid()
where article_id='00000000-0000-4000-8000-000000000204' and locale='en';
do $concurrent_english_none$
declare ctx public.fixture_pending_en_cases%rowtype; before_save jsonb; after_save jsonb; payload jsonb; frozen jsonb; saved jsonb;
begin
  select * into strict ctx from public.fixture_pending_en_cases where article_id='00000000-0000-4000-8000-000000000204';
  before_save:=public.fixture_observation(ctx.article_id);
  perform public.fixture_assert((before_save #>> '{english,updated_at}')::timestamptz <> ctx.en_cas,'independent canonical EN CAS really changed');
  payload:=public.fixture_payload(ctx.slug) || '{"legacy_path":null,"status":"published","published_at":"2026-10-01T10:00:00Z"}';
  frozen:=public.fixture_intent(ctx.article_id,ctx.ru_cas,ctx.en_cas,ctx.draft_version,'publish',payload);
  saved:=public.promote_article_working_draft_operation(ctx.article_id,ctx.ru_cas,ctx.draft_version,payload,'none',null,null,null,null,false,null,'{}',false,'{}',
    '20000000-0000-4000-8000-000000000003',frozen);
  after_save:=public.fixture_observation(ctx.article_id);
  perform public.fixture_assert(saved #> '{result,english_updated_at}'='null'::jsonb
    and (saved #>> '{workingDraft,englishExpectedUpdatedAt}')::timestamptz=(after_save #>> '{english,updated_at}')::timestamptz
    and (saved #>> '{workingDraft,englishExpectedUpdatedAt}')::timestamptz <> ctx.en_cas
    and after_save #> '{draft,english_payload}'=before_save #> '{draft,english_payload}'
    and public.fixture_en_author_projection(after_save -> 'english')=public.fixture_en_author_projection(before_save -> 'english'),
    'none rebases actual independent EN CAS and preserves private A without canonical EN acknowledgement');
  insert into public.fixture_receipt_outputs(envelope,context) values(saved,jsonb_build_object('operationId','20000000-0000-4000-8000-000000000003','submittedIntent',frozen));
end;
$concurrent_english_none$;
select 'EDITOR_OPERATIONS_PENDING_EN_INDEPENDENT_CAS_OK';

do $protected_private_continuation$
declare target text; id uuid; slug text; ctx public.fixture_pending_en_cases%rowtype; before_save jsonb; after_save jsonb; output jsonb;
begin
  foreach target in array array['scheduled','hidden','archived'] loop
    id:=case target when 'scheduled' then '00000000-0000-4000-8000-000000000211'::uuid when 'hidden' then '00000000-0000-4000-8000-000000000212'::uuid else '00000000-0000-4000-8000-000000000213'::uuid end;
    slug:='pending-en-' || target;
    perform public.fixture_pending_en_canonical_seed(id,slug,'promotion-none');
    perform public.fixture_pending_en_seed(id,slug,'promotion-none');
    select * into strict ctx from public.fixture_pending_en_cases where article_id=id;
    select to_jsonb(bundle) into output from public.promote_article_working_draft(id,ctx.ru_cas,ctx.draft_version,
      public.fixture_payload(slug) || jsonb_build_object('legacy_path',null,'status',target,'published_at',null,'scheduled_at',case when target='scheduled' then '2027-01-01T10:00:00Z' else null end),
      'none',null,null,null,null,false,null,'{}',false,'{}') bundle;
    before_save:=public.fixture_observation(id);
    output:=public.save_article_working_draft(id,(before_save #>> '{article,updated_at}')::timestamptz,
      public.fixture_payload(slug) || '{"legacy_path":null}', '{"mode":"disabled"}',
      (before_save #>> '{english,updated_at}')::timestamptz,(before_save #>> '{draft,version}')::bigint);
    after_save:=public.fixture_observation(id);
    perform public.fixture_assert(after_save -> 'article'=before_save -> 'article' and after_save -> 'english'=before_save -> 'english'
      and after_save #> '{draft,english_payload}'=before_save #> '{draft,english_payload}'
      and after_save #>> '{draft,draft_scope}'='bundle' and after_save #> '{draft,draft_english_enabled}'='false'::jsonb,
      'positive-version private continuation preserves protected canonical state and private English');
    perform public.fixture_error(format('select public.save_article_working_draft(%L::uuid,%L::timestamptz,%L::jsonb,''{"mode":"disabled"}'',%L::timestamptz,0)',
      id,(after_save #>> '{article,updated_at}'),public.fixture_payload(slug),(after_save #>> '{english,updated_at}')), 'published-article-required');
  end loop;
end;
$protected_private_continuation$;
select 'EDITOR_OPERATIONS_PENDING_EN_PROTECTED_CONTINUATION_OK';

do $explicit_discard$
declare id uuid:='00000000-0000-4000-8000-000000000203'; before_save jsonb; output jsonb;
begin
  before_save:=public.fixture_observation(id);
  output:=public.discard_article_working_draft(id,(before_save #>> '{draft,version}')::bigint);
  perform public.fixture_assert(output -> 'discarded'='true'::jsonb and public.fixture_observation(id) -> 'draft'='null'::jsonb
    and public.fixture_observation(id) -> 'english'=before_save -> 'english','explicit discard remains the separate destructive intent');
end;
$explicit_discard$;
select 'EDITOR_OPERATIONS_PENDING_EN_EXPLICIT_DISCARD_OK';
do $incomplete_english_inputs$
declare id uuid:='00000000-0000-4000-8000-000000000202'; before_save jsonb; envelope jsonb; invalid jsonb; missing text; payload jsonb; frozen jsonb;
begin
  before_save:=public.fixture_observation(id); envelope:=before_save #> '{draft,english_payload}';
  payload:=public.fixture_payload('pending-en-stale') || '{"legacy_path":null}';
  frozen:=public.fixture_intent(id,(before_save #>> '{article,updated_at}')::timestamptz,
    (before_save #>> '{english,updated_at}')::timestamptz,(before_save #>> '{draft,version}')::bigint,'save',payload);
  foreach invalid in array array['null'::jsonb,'{}','{"mode":null}','{"mode":"save"}','{"mode":"save","payload":null}',
    '{"mode":"save","payload":{}}','{"mode":"save","payload":{"title":"Partial copy"}}',
    '{"mode":"disabled","payload":null}','{"mode":"save","payload":[],"unknown":true}'] loop
    perform public.fixture_error(format('select public.save_article_working_draft(%L::uuid,%L::timestamptz,%L::jsonb,%L::jsonb,%L::timestamptz,%s)',
      id,(before_save #>> '{article,updated_at}'),payload,invalid,(before_save #>> '{english,updated_at}'),(before_save #>> '{draft,version}')), 'working-draft-invalid');
    perform public.fixture_error(format('select public.save_article_working_draft_operation(%L::uuid,%L::timestamptz,%L::jsonb,%L::jsonb,%L::timestamptz,%s,%L::uuid,%L::jsonb)',
      id,(before_save #>> '{article,updated_at}'),payload,invalid,(before_save #>> '{english,updated_at}'),(before_save #>> '{draft,version}'),
      '20000000-0000-4000-8000-000000000080',frozen), 'working-draft-invalid');
    perform public.fixture_assert(public.fixture_observation(id)=before_save,'invalid envelope cannot replace A or append audit/revision/outbox');
  end loop;
  foreach missing in array array['title','subtitle','excerpt','slug','content_html','content_json','cover_alt','sources','bibliography',
    'seo_title','seo_description','seo_keywords','canonical_url','og_title','og_description','status','source_content_hash','reviewed_at','approved_at','published_at'] loop
    invalid:=jsonb_set(envelope,'{payload}',(envelope -> 'payload') - missing);
    perform public.fixture_error(format('select public.save_article_working_draft(%L::uuid,%L::timestamptz,%L::jsonb,%L::jsonb,%L::timestamptz,%s)',
      id,(before_save #>> '{article,updated_at}'),payload,invalid,(before_save #>> '{english,updated_at}'),(before_save #>> '{draft,version}')), 'working-draft-invalid');
    perform public.fixture_assert(public.fixture_observation(id)=before_save,'every omitted complete-author field leaves exact prior A and context');
  end loop;
  foreach missing in array array['title','content_html','content_json','sources','bibliography','seo_keywords','source_content_hash','reviewed_at','status'] loop
    invalid:=jsonb_set(envelope,array['payload',missing],'42');
    perform public.fixture_error(format('select public.save_article_working_draft(%L::uuid,%L::timestamptz,%L::jsonb,%L::jsonb,%L::timestamptz,%s)',
      id,(before_save #>> '{article,updated_at}'),payload,invalid,(before_save #>> '{english,updated_at}'),(before_save #>> '{draft,version}')), 'working-draft-invalid');
    perform public.fixture_assert(public.fixture_observation(id)=before_save,'corrupt author type leaves exact prior A');
  end loop;
  perform public.fixture_assert(public.get_editor_operation_result('20000000-0000-4000-8000-000000000080',frozen) is null,
    'invalid operation inputs cannot create an acknowledgement');
end;
$incomplete_english_inputs$;
select 'EDITOR_OPERATIONS_PENDING_EN_INCOMPLETE_INPUTS_OK';
set session authorization default;

create or replace function public.fixture_fail_pending_english_after_rebase()
returns trigger language plpgsql as $$
begin
  if new.article_id='00000000-0000-4000-8000-000000000202' then
    raise exception 'FIXTURE_PENDING_EN_LATE_FAIL';
  end if;
  return new;
end;
$$;
create trigger zz_fixture_pending_english_late_failure after update on public.article_translations
for each row execute function public.fixture_fail_pending_english_after_rebase();
set session authorization authenticated;
do $pending_english_late_rollback$
declare id uuid:='00000000-0000-4000-8000-000000000202'; before_save jsonb; payload jsonb; frozen jsonb;
begin
  before_save:=public.fixture_observation(id);
  payload:=public.fixture_payload('pending-en-stale') || '{"legacy_path":null,"status":"published","published_at":"2026-10-01T10:00:00Z"}';
  frozen:=public.fixture_intent(id,(before_save #>> '{article,updated_at}')::timestamptz,
    (before_save #>> '{english,updated_at}')::timestamptz,(before_save #>> '{draft,version}')::bigint,'publish',payload);
  perform public.fixture_error(format('select public.promote_article_working_draft_operation(%L::uuid,%L::timestamptz,%s,%L::jsonb,''stale'',null,%L::timestamptz,null,null,false,null,''{}'',false,''{}'',%L::uuid,%L::jsonb)',
    id,(before_save #>> '{article,updated_at}'),(before_save #>> '{draft,version}'),payload,(before_save #>> '{english,updated_at}'),
    '20000000-0000-4000-8000-000000000090',frozen),'FIXTURE_PENDING_EN_LATE_FAIL');
  perform public.fixture_assert(public.fixture_observation(id)=before_save,
    'late English failure rolls back canonical RU/EN, retained A/version/CAS, revisions/audit/outbox together');
  perform public.fixture_assert(public.get_editor_operation_result('20000000-0000-4000-8000-000000000090',frozen) is null,
    'failed partial release has no durable receipt');
end;
$pending_english_late_rollback$;
set session authorization default;
drop trigger zz_fixture_pending_english_late_failure on public.article_translations;
update public.article_working_drafts set base_article_updated_at=base_article_updated_at-interval '1 hour'
where article_id='00000000-0000-4000-8000-000000000202';
set session authorization authenticated;
do $pending_english_stale_base$
declare id uuid:='00000000-0000-4000-8000-000000000202'; before_save jsonb;
begin
  before_save:=public.fixture_observation(id);
  perform public.fixture_error(format('select * from public.promote_article_working_draft(%L::uuid,%L::timestamptz,%s,%L::jsonb,''none'',null,null,null,null,false,null,''{}'',false,''{}'')',
    id,(before_save #>> '{article,updated_at}'),(before_save #>> '{draft,version}'),
    public.fixture_payload('pending-en-stale') || '{"legacy_path":null,"status":"published","published_at":"2026-10-01T10:00:00Z"}'),
    'WORKING_DRAFT_CONFLICT');
  perform public.fixture_assert(public.fixture_observation(id)=before_save,
    'stale private base fails without erasing A or any canonical side effect');
end;
$pending_english_stale_base$;
set session authorization default;
update public.article_working_drafts set base_article_updated_at=(select updated_at from public.articles where id=article_id),version=9007199254740991
where article_id='00000000-0000-4000-8000-000000000202';
set session authorization authenticated;
do $pending_english_max_version$
declare id uuid:='00000000-0000-4000-8000-000000000202'; before_save jsonb;
begin
  before_save:=public.fixture_observation(id);
  perform public.fixture_error(format('select * from public.promote_article_working_draft(%L::uuid,%L::timestamptz,9007199254740991,%L::jsonb,''none'',null,null,null,null,false,null,''{}'',false,''{}'')',
    id,(before_save #>> '{article,updated_at}'),public.fixture_payload('pending-en-stale') || '{"legacy_path":null,"status":"published","published_at":"2026-10-01T10:00:00Z"}'),
    'WORKING_DRAFT_VERSION_INVALID');
  perform public.fixture_assert(public.fixture_observation(id)=before_save,'unsafe increment fails atomically and keeps A');
end;
$pending_english_max_version$;
select 'EDITOR_OPERATIONS_PENDING_EN_ROLLBACK_BASE_VERSION_OK';
set session authorization default;

-- Seed two synthetic historical journal rows only in this isolated fixture.
-- Their immutable raw receipts omit the new descriptor; one also predates
-- English write metadata. A later draft cannot fabricate retention for them.
insert into probpera_editor_operations.receipts
select (jsonb_populate_record(null::probpera_editor_operations.receipts,to_jsonb(r) || jsonb_build_object(
  'operation_id','20000000-0000-4000-8000-000000000091','result',r.result - 'workingDraft'))).* from probpera_editor_operations.receipts r
where operation_id='20000000-0000-4000-8000-000000000002';
insert into probpera_editor_operations.receipts
select (jsonb_populate_record(null::probpera_editor_operations.receipts,to_jsonb(r) || jsonb_build_object(
  'operation_id','20000000-0000-4000-8000-000000000092','result',r.result - array['workingDraft','englishWrite']))).* from probpera_editor_operations.receipts r
where operation_id='20000000-0000-4000-8000-000000000002';
set session authorization authenticated;
do $old_receipt_truth$
declare frozen jsonb; receipt jsonb; op uuid;
begin
  select context -> 'submittedIntent' into strict frozen from public.fixture_receipt_outputs where context ->> 'operationId'='20000000-0000-4000-8000-000000000002' and envelope ->> 'replayed'='false';
  foreach op in array array['20000000-0000-4000-8000-000000000091'::uuid,'20000000-0000-4000-8000-000000000092'::uuid] loop
    receipt:=public.get_editor_operation_result(op,frozen);
    perform public.fixture_assert(not (receipt ? 'workingDraft') and not ((receipt -> 'result') ?| array['workingDraft','englishWrite']),
      'old immutable receipt cannot claim a later retained private version');
    if op='20000000-0000-4000-8000-000000000092' then perform public.fixture_assert(not (receipt ? 'englishWrite'),'nine-key receipt remains nine-key original truth'); end if;
    insert into public.fixture_receipt_outputs(envelope,context) values(receipt,jsonb_build_object('operationId',op,'submittedIntent',frozen));
  end loop;
end;
$old_receipt_truth$;
select 'EDITOR_OPERATIONS_PENDING_EN_OLD_RECEIPT_COMPATIBILITY_OK';
set session authorization default;
do $retention_catalog_tamper$
declare command text; expected text;
begin
  foreach command in array array[
    'alter table public.article_working_drafts alter column draft_scope set default ''english-only''',
    'alter table public.article_working_drafts alter column draft_english_enabled set default true',
    'alter table public.article_working_drafts drop constraint article_working_drafts_english_payload_check',
    'alter table public.articles disable trigger articles_clear_working_draft_after_promotion',
    'alter table public.articles disable trigger articles_guard_working_draft_promotion',
    'alter table public.article_translations disable trigger article_translations_rebase_retained_working_draft',
    'revoke execute on function public.save_article_working_draft(uuid,timestamptz,jsonb,jsonb,timestamptz,bigint) from authenticated',
    'revoke execute on function public.promote_article_working_draft(uuid,timestamptz,bigint,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb) from authenticated'
  ] loop
    expected:=case when command like 'revoke%' then 'EDITOR_OPERATION_RETENTION_IMPLEMENTATION_INVALID' else 'EDITOR_OPERATION_RETENTION_SCHEMA_INVALID' end;
    begin
      execute command;
      perform public.fixture_error('select public.fixture_apply_migration()',expected);
      raise exception 'FIXTURE_ROLLBACK_TAMPER';
    exception when raise_exception then
      if sqlerrm <> 'FIXTURE_ROLLBACK_TAMPER' then raise; end if;
    end;
  end loop;
  perform public.fixture_apply_migration();
end;
$retention_catalog_tamper$;
select 'EDITOR_OPERATIONS_PENDING_EN_CATALOG_TAMPER_OK';
create temporary table fixture_retained_receipt_constraints (like probpera_editor_operations.receipts including constraints);
do $retained_receipt_corruption$
declare invalid jsonb; original jsonb; mutations jsonb[];
begin
  select result -> 'workingDraft' into strict original from probpera_editor_operations.receipts where operation_id='20000000-0000-4000-8000-000000000002';
  mutations:=array['null'::jsonb,'{}',original - 'englishEnabled',original || '{"unknown":true}',
    original || '{"scope":"bundle"}', original || '{"scope":null}', original || '{"version":true}', original || '{"version":0}',
    original || '{"version":9007199254740992}',original || jsonb_build_object('version',(original ->> 'version')::bigint+1),
    original || '{"englishWrite":"saved"}',original || '{"englishWrite":null}',original || '{"englishEnabled":null}',
    original || '{"updatedAt":null}',original || '{"baseArticleUpdatedAt":null}',original || '{"englishExpectedUpdatedAt":42}'];
  foreach invalid in array mutations loop
    perform public.fixture_error(format('insert into pg_temp.fixture_retained_receipt_constraints select (jsonb_populate_record(null::probpera_editor_operations.receipts,to_jsonb(r) || jsonb_build_object(''result'',r.result || jsonb_build_object(''workingDraft'',%L::jsonb)))).* from probpera_editor_operations.receipts r where operation_id=''20000000-0000-4000-8000-000000000002''',invalid),null);
  end loop;
  perform public.fixture_assert((select count(*) from pg_temp.fixture_retained_receipt_constraints)=0,
    'corrupt retention metadata cannot pass CHECK through a SQL NULL result');
end;
$retained_receipt_corruption$;
drop table pg_temp.fixture_retained_receipt_constraints;
select 'EDITOR_OPERATIONS_PENDING_EN_METADATA_CONSTRAINTS_OK';
select 'ARTICLE_OPERATION_DTO:' || jsonb_build_object('envelope',envelope,'context',context)::text
from public.fixture_receipt_outputs where context ->> 'operationId' like '20000000-%' order by id;
select 'EDITOR_OPERATIONS_PENDING_EN_PRESERVATION_OK';

-- Page commands share only the private hash/receipt ledger. These exact
-- fixtures also run against the captured predecessor candidate; its legacy
-- committed UPDATE cannot reconcile a retry after the response is lost.
set session authorization default;
create or replace function public.fixture_page_payload(p_status text default 'draft', p_slug text default 'manual-page')
returns jsonb language sql immutable as $$
select jsonb_build_object(
  'title',U&'Авторская страница \2014 manual EN', 'slug',p_slug, 'excerpt',U&'Ручное вступление \2014 unchanged',
  'content_html',U&'<p>Авторский RU \2014 manual EN; дефис - сохранён.</p><img src="https://fixture.test/page.jpg" alt="Авторское фото" data-caption="Ручная подпись" data-credit="Автор" data-source="https://fixture.test/source" data-license="Author permission" data-license-url="https://fixture.test/permission">',
  'content_json',U&'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Авторский RU \2014 manual EN; дефис - сохранён."}]},{"type":"image","attrs":{"src":"https://fixture.test/page.jpg","alt":"Авторское фото","caption":"Ручная подпись","credit":"Автор","source":"https://fixture.test/source","license":"Author permission","licenseUrl":"https://fixture.test/permission"}}]}'::jsonb,
  'status',p_status, 'seo_title',U&'SEO \2014 ручное', 'seo_description',U&'Описание \2014 manual',
  'canonical_url','https://fixture.test/stranitsy/manual-page/', 'allow_indexing',false,
  'updated_by','00000000-0000-4000-8000-000000000001'
);
$$;
create or replace function public.fixture_page_intent(p_id uuid,p_stamp timestamptz,p_payload jsonb,p_intent text default 'save')
returns jsonb language sql stable as $$
select jsonb_build_object('version',1,'entityType','page','entityId',p_id,'expectedUpdatedAt',
  to_char(p_stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'intent',p_intent,'fields',(
    select jsonb_agg(jsonb_build_array(key,value) order by key collate "C") from jsonb_each_text(
      (p_payload - array['updated_by','allow_indexing']) || jsonb_build_object('id',p_id,
        'expected_updated_at',to_char(p_stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'intent',p_intent,'allow_indexing',case when (p_payload ->> 'allow_indexing')::boolean then 'on' else '' end))));
$$;
create or replace function public.fixture_page_observation(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
select jsonb_build_object('page',(select to_jsonb(p) from public.pages p where id=p_id),
  'revisions',(select jsonb_agg(to_jsonb(r) order by r.id) from public.page_revisions r where page_id=p_id),
  'outbox',(select jsonb_agg(to_jsonb(o) order by o.id) from public.public_build_outbox o where entity_type='pages' and entity_id=p_id::text));
$$;
insert into public.pages(id,title,slug,excerpt,content_html,content_json,status,created_by,updated_by,updated_at)
select ('31000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  U&'Исходная страница \2014 manual EN','page-seed-' || n,'Исходное вступление',
  '<p>Original RU/EN page</p>','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original RU/EN page"}]}]}'::jsonb,
  'draft','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','2026-09-30T10:00:00.123456Z'
from generate_series(1,9) n;

set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $legacy_page_commit$
declare id uuid:='31000000-0000-4000-8000-000000000009'; first_stamp timestamptz; committed jsonb; affected bigint;
begin
  update public.pages set title=public.fixture_page_payload() ->> 'title',
    content_html=public.fixture_page_payload() ->> 'content_html',content_json=public.fixture_page_payload() -> 'content_json',
    updated_by=auth.uid() where pages.id='31000000-0000-4000-8000-000000000009' and updated_at='2026-09-30T10:00:00.123456Z' returning updated_at into first_stamp;
  perform public.fixture_assert(first_stamp is not null,'legacy Page first UPDATE commits authored body');
  committed:=public.fixture_page_observation(id);
  update public.pages set title='Retry must not replace A',updated_by=auth.uid()
    where pages.id='31000000-0000-4000-8000-000000000009' and updated_at='2026-09-30T10:00:00.123456Z';
  get diagnostics affected=row_count;
  perform public.fixture_assert(affected=0 and public.fixture_page_observation(id)=committed,
    'lost legacy Page acknowledgement leaves only stale CAS and no durable operation receipt');
end;
$legacy_page_commit$;
select 'LEGACY_PAGE_COMMITTED_RETRY_CAS_FAILURE_CONFIRMED';

-- A missing API on the predecessor stops here with an explicit failure. Later
-- Page assertions are NOT_RUN there, rather than invented baseline successes.
select public.fixture_assert(to_regprocedure('public.save_page_operation(jsonb,timestamptz,uuid,jsonb)') is not null,
  'PAGE_DURABLE_OPERATION_REQUIRED: predecessor has no transactional Page receipt');
create temporary table fixture_page_outputs(operation_id uuid,envelope jsonb,context jsonb);
do $page_saved_replay$
declare id uuid; op uuid; payload jsonb; intent jsonb; result jsonb; replay jsonb; committed jsonb; n integer; status text;
begin
  for n,status in select * from (values (1,'draft'),(2,'published'),(3,'hidden')) s(n,status) loop
    id:=('31000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid;
    op:=('30000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid;
    payload:=public.fixture_page_payload(status,'page-operation-' || n);
    intent:=public.fixture_page_intent(id,'2026-09-30T10:00:00.123456Z',payload,case when status='published' then 'publish' else 'save' end);
    result:=public.save_page_operation(payload,'2026-09-30T10:00:00.123456Z',op,intent);
    perform public.fixture_assert((select count(*) from jsonb_object_keys(result))=8 and result ->> 'entityType'='page'
      and result ->> 'operationId'=op::text and result ->> 'requestedEntityId'=id::text
      and result ->> 'persistence'='page' and result -> 'replayed'='false'::jsonb
      and result -> 'receipt' ->> 'page_id'=id::text and result -> 'receipt' ->> 'page_status'=status
      and (result -> 'receipt' ->> 'page_updated_at')::timestamptz>'2026-09-30T10:00:00.123456Z',
      'fresh Page acknowledgement has exactly eight fields and its actual status/advanced CAS');
    perform public.fixture_assert((select to_jsonb(p) - array['id','created_by','created_at','updated_at','deleted_at'] from public.pages p where p.id=(result -> 'receipt' ->> 'page_id')::uuid)=payload,
      'all eleven authored/prepared Page fields, manual RU/EN, JSON media rights and sources persist without replacement');
    committed:=public.fixture_page_observation(id);
    replay:=public.save_page_operation(payload,'2026-09-30T10:00:00.123456Z',op,intent);
    perform public.fixture_assert(replay=result || '{"replayed":true}'::jsonb
      and public.get_editor_operation_result(op,intent)=replay and public.fixture_page_observation(id)=committed,
      'Page write retry and read-only lookup return the same original receipt before stale CAS without revisions/outbox');
    insert into pg_temp.fixture_page_outputs values
      (op,result,jsonb_build_object('operationId',op,'submittedIntent',intent)),
      (op,replay,jsonb_build_object('operationId',op,'submittedIntent',intent));
  end loop;
end;
$page_saved_replay$;
select 'EDITOR_OPERATIONS_PAGE_STATUS_AUTHOR_REPLAY_OK';

do $page_new_operation$
declare id uuid:='31000000-0000-4000-8000-000000000001'; old_context jsonb; old_result jsonb; stamp timestamptz;
  op uuid:='30000000-0000-4000-8000-000000000004'; payload jsonb; intent jsonb; result jsonb; committed jsonb;
begin
  select context,envelope into old_context,old_result from pg_temp.fixture_page_outputs where operation_id='30000000-0000-4000-8000-000000000001';
  select updated_at into stamp from public.pages where pages.id='31000000-0000-4000-8000-000000000001';
  payload:=public.fixture_page_payload('hidden','page-next-command') || jsonb_build_object('title',U&'Поздний B \2014 manual EN','content_html','<p>Late B RU/EN</p>');
  intent:=public.fixture_page_intent(id,stamp,payload);
  result:=public.save_page_operation(payload,stamp,op,intent);
  committed:=public.fixture_page_observation(id);
  perform public.fixture_assert(result -> 'receipt' ->> 'page_status'='hidden' and
    (result -> 'receipt' ->> 'page_updated_at')::timestamptz>stamp,
    'next Page B operation uses the accepted CAS and a new ID');
  perform public.fixture_assert(public.get_editor_operation_result('30000000-0000-4000-8000-000000000001',old_context -> 'submittedIntent')=
    old_result || '{"replayed":true}'::jsonb and public.fixture_page_observation(id)=committed,
    'original Page A receipt remains immutable after later B/status change');
  insert into pg_temp.fixture_page_outputs values
    (op,result,jsonb_build_object('operationId',op,'submittedIntent',intent)),
    ('30000000-0000-4000-8000-000000000001',public.get_editor_operation_result('30000000-0000-4000-8000-000000000001',old_context -> 'submittedIntent'),old_context);
end;
$page_new_operation$;
select 'EDITOR_OPERATIONS_PAGE_NEXT_CAS_ORIGINAL_RECEIPT_OK';

do $page_changed_operation$
declare id uuid:='31000000-0000-4000-8000-000000000002'; op uuid:='30000000-0000-4000-8000-000000000002';
  payload jsonb:=public.fixture_page_payload('published','page-operation-2'); intent jsonb; before_save jsonb;
begin
  select context -> 'submittedIntent' into intent from pg_temp.fixture_page_outputs where operation_id=op;
  before_save:=public.fixture_page_observation(id);
  perform public.fixture_error(format('select public.save_page_operation(%L::jsonb,%L::timestamptz,%L::uuid,%L::jsonb)',
    payload || '{"title":"Changed prepared author text"}', '2026-09-30T10:00:00.123456Z',op,intent),'EDITOR_OPERATION_CONFLICT');
  perform public.fixture_error(format('select public.get_editor_operation_result(%L::uuid,%L::jsonb)',op,
    public.fixture_page_intent(id,'2026-09-30T10:00:00.123456Z',payload || '{"title":"Changed original author text"}','publish')),'EDITOR_OPERATION_CONFLICT');
  perform public.fixture_error(format('select public.get_editor_operation_result(%L::uuid,%L::jsonb)',op,
    public.fixture_page_intent('31000000-0000-4000-8000-000000000005','2026-09-30T10:00:00.123456Z',payload,'publish')),'EDITOR_OPERATION_CONFLICT');
  perform public.fixture_error(format('select public.get_editor_operation_result(%L::uuid,%L::jsonb)',op,
    public.fixture_intent('31000000-0000-4000-8000-000000000002','2026-09-30T10:00:00.123456Z',null)),'EDITOR_OPERATION_CONFLICT');
  perform public.fixture_error(format('select public.save_page_operation(%L::jsonb,%L::timestamptz,%L::uuid,%L::jsonb)',payload,
    '2026-09-30T10:00:00.123456Z','10000000-0000-4000-8000-000000000001',intent),'EDITOR_OPERATION_CONFLICT');
  perform public.fixture_assert(public.fixture_page_observation(id)=before_save,'changed Page original/prepared/entity/type never writes or replaces original receipt');
  perform public.fixture_assert(public.get_editor_operation_result('39999999-0000-4000-8000-000000000099',intent) is null,
    'Page absent lookup is null, not proof of a failed earlier request');
end;
$page_changed_operation$;
select 'EDITOR_OPERATIONS_PAGE_HASH_ENTITY_BINDING_OK';

do $page_invalid_input$
declare id uuid:='31000000-0000-4000-8000-000000000005'; op uuid:='30000000-0000-4000-8000-000000000005';
  payload jsonb:=public.fixture_page_payload('draft','page-invalid-input'); intent jsonb; invalid jsonb; field text; before_save jsonb;
begin
  intent:=public.fixture_page_intent(id,'2026-09-30T10:00:00.123456Z',payload);
  before_save:=public.fixture_page_observation(id);
  foreach field in array array['title','slug','excerpt','content_html','content_json','status','seo_title','seo_description','canonical_url','allow_indexing','updated_by'] loop
    perform public.fixture_error(format('select public.save_page_operation(%L::jsonb,%L::timestamptz,%L::uuid,%L::jsonb)',
      payload - field,'2026-09-30T10:00:00.123456Z',op,intent),'EDITOR_OPERATION_INTENT_INVALID');
  end loop;
  foreach invalid in array array['null'::jsonb,'{}',payload || '{"id":"31000000-0000-4000-8000-000000000005"}',
    payload || '{"deleted_at":null}',payload || '{"status":null}',payload || '{"status":"scheduled"}',
    payload || '{"content_json":[]}',payload || '{"content_json":{"type":"invalid"}}',payload || '{"allow_indexing":null}',
    payload || '{"updated_by":"00000000-0000-4000-8000-000000000002"}',payload || '{"canonical_url":null}',
    payload || '{"title":false}',payload || jsonb_build_object('content_html',repeat('x',2000001))] loop
    perform public.fixture_error(format('select public.save_page_operation(%L::jsonb,%L::timestamptz,%L::uuid,%L::jsonb)',
      invalid,'2026-09-30T10:00:00.123456Z',op,intent),'EDITOR_OPERATION_INTENT_INVALID');
  end loop;
  foreach invalid in array array['null'::jsonb,'{}',intent - 'entityId',intent || '{"entityId":null}',
    intent || '{"expectedUpdatedAt":null}',intent || '{"intent":"preview"}',intent || '{"unknown":true}',
    intent || '{"fields":[["id",null]]}',intent || '{"fields":[["id","x"],["id","x"]]}',
    intent || '{"fields":[["page_operation_id","x"]]}',intent || '{"fields":[["page_result_mode","receipt"]]}',
    intent || '{"fields":[["$ACTION_ID_1","metadata"]]}',intent || '{"fields":[["z","a"],["a","b"]]}'] loop
    perform public.fixture_error(format('select public.save_page_operation(%L::jsonb,%L::timestamptz,%L::uuid,%L::jsonb)',
      payload,'2026-09-30T10:00:00.123456Z',op,invalid),'EDITOR_OPERATION_INTENT_INVALID');
  end loop;
  perform public.fixture_error(format('select public.save_page_operation(%L::jsonb,%L::timestamptz,%L::uuid,%L::jsonb)',
    payload,'2026-09-30T10:00:00.123457Z',op,intent),'EDITOR_OPERATION_INTENT_INVALID');
  perform public.fixture_error(format('select public.save_page_operation(%L::jsonb,%L::timestamptz,%L::uuid,%L::jsonb)',
    payload,'2026-09-30T10:00:00.123456Z',op,public.fixture_page_intent(id,'2026-09-30T10:00:00.123456Z',payload,'publish')),'EDITOR_OPERATION_INTENT_INVALID');
  perform public.fixture_error(format('select public.save_page_operation(%L::jsonb,%L::timestamptz,%L::uuid,%L::jsonb)',
    payload,'2026-09-30T10:00:00.123457Z',op,public.fixture_page_intent(id,'2026-09-30T10:00:00.123457Z',payload)),'PAGE_CONFLICT');
  perform public.fixture_error(format('select public.save_page_operation(%L::jsonb,%L::timestamptz,%L::uuid,%L::jsonb)',
    payload || '{"status":"published"}','2026-09-30T10:00:00.123456Z',op,intent),'EDITOR_OPERATION_INTENT_INVALID');
  perform public.fixture_assert(public.fixture_page_observation(id)=before_save,'invalid Page command cannot mutate author seed/revision/outbox');
  perform public.fixture_assert(public.get_editor_operation_result(op,intent) is null,
    'raw save draft cannot become prepared published or leave a receipt/revision/outbox');
end;
$page_invalid_input$;
select 'EDITOR_OPERATIONS_PAGE_STRICT_INPUT_OK';

set session authorization default;
create or replace function public.fixture_page_receipt_failure()
returns trigger language plpgsql as $$
begin
  if new.operation_id='30000000-0000-4000-8000-000000000006' then
    raise exception 'FIXTURE_PAGE_RECEIPT_INSERT_FAILURE';
  end if;
  return new;
end;
$$;
create trigger fixture_page_receipt_failure before insert on probpera_editor_operations.receipts
for each row execute function public.fixture_page_receipt_failure();
set session authorization authenticated;
do $page_atomic_failure$
declare id uuid:='31000000-0000-4000-8000-000000000006'; payload jsonb:=public.fixture_page_payload('published','page-late-failure'); before_save jsonb;
begin
  before_save:=public.fixture_page_observation(id);
  perform public.fixture_error(format('select public.save_page_operation(%L::jsonb,%L::timestamptz,%L::uuid,%L::jsonb)',payload,
    '2026-09-30T10:00:00.123456Z','30000000-0000-4000-8000-000000000006',
    public.fixture_page_intent(id,'2026-09-30T10:00:00.123456Z',payload,'publish')),'FIXTURE_PAGE_RECEIPT_INSERT_FAILURE');
  perform public.fixture_assert(public.fixture_page_observation(id)=before_save,
    'late immutable Page receipt insertion failure rolls back page, actual revision and synthetic outbox together');
  perform public.fixture_assert(public.get_editor_operation_result('30000000-0000-4000-8000-000000000006',
    public.fixture_page_intent(id,'2026-09-30T10:00:00.123456Z',payload,'publish')) is null,'rolled back Page operation has no receipt');
end;
$page_atomic_failure$;
set session authorization default;
drop trigger fixture_page_receipt_failure on probpera_editor_operations.receipts;
select 'EDITOR_OPERATIONS_PAGE_ATOMIC_RECEIPT_ROLLBACK_OK';

-- Current Page policies are re-evaluated for lookup; receipt existence does not
-- confer access. The direct authenticated legacy grants remain unchanged.
create policy fixture_page_restrict_current_read on public.pages as restrictive for select to authenticated
using (id <> '31000000-0000-4000-8000-000000000002');
set session authorization authenticated;
do $page_current_access$
declare intent jsonb;
begin
  select context -> 'submittedIntent' into intent from pg_temp.fixture_page_outputs where operation_id='30000000-0000-4000-8000-000000000002';
  perform public.fixture_error(format('select public.get_editor_operation_result(%L::uuid,%L::jsonb)',
    '30000000-0000-4000-8000-000000000002',intent),'EDITOR_OPERATION_ACCESS_REQUIRED');
end;
$page_current_access$;
set session authorization default;
drop policy fixture_page_restrict_current_read on public.pages;
set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $page_other_actor$
declare intent jsonb; payload jsonb; before_save jsonb;
begin
  select context -> 'submittedIntent' into intent from pg_temp.fixture_page_outputs where operation_id='30000000-0000-4000-8000-000000000002';
  perform public.fixture_assert(public.get_editor_operation_result('30000000-0000-4000-8000-000000000002',intent) is null,
    'another allowed staff actor cannot disclose the original Page receipt');
  payload:=public.fixture_page_payload('draft','page-other-actor') || '{"updated_by":"00000000-0000-4000-8000-000000000002"}';
  before_save:=public.fixture_page_observation('31000000-0000-4000-8000-000000000007');
  perform public.fixture_error(format('select public.save_page_operation(%L::jsonb,%L::timestamptz,%L::uuid,%L::jsonb)',payload,
    '2026-09-30T10:00:00.123456Z','30000000-0000-4000-8000-000000000002',
    public.fixture_page_intent('31000000-0000-4000-8000-000000000007','2026-09-30T10:00:00.123456Z',payload)),null);
  perform public.fixture_assert(public.fixture_page_observation('31000000-0000-4000-8000-000000000007')=before_save,
    'foreign actor operation-ID collision cannot commit another page/revision/outbox');
end;
$page_other_actor$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select 'EDITOR_OPERATIONS_PAGE_ACTOR_CURRENT_RLS_OK';

set session authorization anon;
select public.fixture_error('select public.save_page_operation(public.fixture_page_payload(),''2026-09-30T10:00:00.123456Z'',
  ''30000000-0000-4000-8000-000000000008'',public.fixture_page_intent(''31000000-0000-4000-8000-000000000008'',
  ''2026-09-30T10:00:00.123456Z'',public.fixture_page_payload()))','permission denied');
select public.fixture_error('select public.get_editor_operation_result(''30000000-0000-4000-8000-000000000008'',
  public.fixture_page_intent(''31000000-0000-4000-8000-000000000008'',''2026-09-30T10:00:00.123456Z'',public.fixture_page_payload()))','permission denied');
set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
select public.fixture_error('select public.save_page_operation(public.fixture_page_payload() || ''{"updated_by":"00000000-0000-4000-8000-000000000004"}''::jsonb,
  ''2026-09-30T10:00:00.123456Z'',''30000000-0000-4000-8000-000000000008'',public.fixture_page_intent(''31000000-0000-4000-8000-000000000008'',
  ''2026-09-30T10:00:00.123456Z'',public.fixture_page_payload()))','EDITOR_OPERATION_ACCESS_REQUIRED');
select public.fixture_error('select public.get_editor_operation_result(''30000000-0000-4000-8000-000000000008'',
  public.fixture_page_intent(''31000000-0000-4000-8000-000000000008'',''2026-09-30T10:00:00.123456Z'',public.fixture_page_payload()))','EDITOR_OPERATION_ACCESS_REQUIRED');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $page_existing_editor_permission$
declare id uuid:='31000000-0000-4000-8000-000000000008'; op uuid:='30000000-0000-4000-8000-000000000008';
  payload jsonb; intent jsonb; result jsonb;
begin
  payload:=public.fixture_page_payload('published','page-authorized-editor') || '{"updated_by":"00000000-0000-4000-8000-000000000002"}';
  intent:=public.fixture_page_intent(id,'2026-09-30T10:00:00.123456Z',payload,'publish');
  result:=public.save_page_operation(payload,'2026-09-30T10:00:00.123456Z',op,intent);
  perform public.fixture_assert(result -> 'receipt' ->> 'page_status'='published',
    'existing staff Page publication permission remains available to editor without adding Article role restrictions');
  insert into pg_temp.fixture_page_outputs values(op,result,jsonb_build_object('operationId',op,'submittedIntent',intent));
end;
$page_existing_editor_permission$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select 'EDITOR_OPERATIONS_PAGE_ANON_NONSTAFF_EDITOR_BOUNDARY_OK';
set session authorization default;
update public.pages set deleted_at=clock_timestamp() where id='31000000-0000-4000-8000-000000000003';
set session authorization authenticated;
do $page_deleted_receipt$
declare id uuid:='31000000-0000-4000-8000-000000000003'; intent jsonb; payload jsonb:=public.fixture_page_payload('hidden','page-soft-deleted');
  stamp timestamptz; before_save jsonb;
begin
  select context -> 'submittedIntent' into intent from pg_temp.fixture_page_outputs where operation_id='30000000-0000-4000-8000-000000000003';
  before_save:=public.fixture_page_observation(id);
  stamp:=(before_save -> 'page' ->> 'updated_at')::timestamptz;
  perform public.fixture_error(format('select public.get_editor_operation_result(%L::uuid,%L::jsonb)',
    '30000000-0000-4000-8000-000000000003',intent),'EDITOR_OPERATION_ACCESS_REQUIRED');
  perform public.fixture_error(format('select public.save_page_operation(%L::jsonb,%L::timestamptz,%L::uuid,%L::jsonb)',payload,stamp,
    '30000000-0000-4000-8000-000000000009',public.fixture_page_intent(id,stamp,payload)),'PAGE_CONFLICT');
  perform public.fixture_assert(public.fixture_page_observation(id)=before_save,'soft-deleted Page receipt gives no access or write even to original staff actor');
end;
$page_deleted_receipt$;
select 'EDITOR_OPERATIONS_PAGE_DELETED_CURRENT_ACCESS_OK';

set session authorization default;
create temporary table fixture_page_constraints (like probpera_editor_operations.receipts including constraints);
do $page_receipt_constraints$
declare original jsonb; invalid jsonb;
begin
  select result into strict original from probpera_editor_operations.receipts where operation_id='30000000-0000-4000-8000-000000000001';
  foreach invalid in array array['null'::jsonb,'{}',original - 'page_status',original || '{"page_status":null}',
    original || '{"page_status":"scheduled"}',original || '{"page_updated_at":null}',original || '{"page_updated_at":42}',
    original || '{"page_updated_at":"2026-09-30T10:00:00.123456Z"}',original || '{"page_id":null}',
    original || '{"page_id":"31000000-0000-4000-8000-000000000008"}',original || '{"extra":true}'] loop
    perform public.fixture_error(format('insert into pg_temp.fixture_page_constraints select (jsonb_populate_record(null::probpera_editor_operations.receipts,
      to_jsonb(r) || jsonb_build_object(''result'',%L::jsonb))).* from probpera_editor_operations.receipts r
      where operation_id=''30000000-0000-4000-8000-000000000001''',invalid),null);
  end loop;
  perform public.fixture_assert((select count(*) from pg_temp.fixture_page_constraints)=0,
    'Page receipt CHECK rejects null/missing/foreign/status/CAS corruption instead of SQL NULL acceptance');
  perform public.fixture_error('update probpera_editor_operations.receipts set result=result where operation_id=''30000000-0000-4000-8000-000000000001''','EDITOR_OPERATION_RECEIPT_IMMUTABLE');
  perform public.fixture_error('delete from probpera_editor_operations.receipts where operation_id=''30000000-0000-4000-8000-000000000001''','EDITOR_OPERATION_RECEIPT_IMMUTABLE');
end;
$page_receipt_constraints$;
drop table pg_temp.fixture_page_constraints;
select 'EDITOR_OPERATIONS_PAGE_STRICT_IMMUTABLE_RECEIPT_OK';
select public.fixture_reject_tamper('alter table public.pages disable row level security','EDITOR_OPERATION_PRIVILEGE_BOUNDARY_INVALID');
select public.fixture_reject_tamper('grant execute on function public.save_page_operation(jsonb,timestamptz,uuid,jsonb) to anon','EDITOR_OPERATION_PRIVILEGE_BOUNDARY_INVALID');
select public.fixture_reject_tamper('alter function public.save_page_operation(jsonb,timestamptz,uuid,jsonb) strict','EDITOR_OPERATION_IMPLEMENTATION_INVALID');
select public.fixture_reject_tamper('alter function probpera_editor_operations.validate_page_intent(jsonb) volatile','EDITOR_OPERATION_IMPLEMENTATION_INVALID');
select public.fixture_reject_tamper('alter table probpera_editor_operations.receipts drop constraint editor_operation_entity_contract','EDITOR_OPERATION_JOURNAL_SCHEMA_INVALID');
select public.fixture_apply_migration();
select 'EDITOR_OPERATIONS_PAGE_REPEAT_FAIL_CLOSED_OK';
select 'PAGE_OPERATION_DTO:' || jsonb_build_object('envelope',envelope,'context',context)::text
from pg_temp.fixture_page_outputs order by operation_id;
select 'ADMIN_EDITOR_PAGE_OPERATIONS_OK';
