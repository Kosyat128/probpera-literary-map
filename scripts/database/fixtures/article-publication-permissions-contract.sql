-- Compose the real bundle, working-draft and redirect-guard migrations. The
-- old failure probes run as authenticated staff, never as the schema owner.
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003');
insert into public.staff_memberships(user_id, role) values
  ('00000000-0000-4000-8000-000000000001', 'owner'),
  ('00000000-0000-4000-8000-000000000002', 'editor');
insert into public.categories(id, slug)
values ('00000000-0000-4000-8000-000000000010', 'tests');
insert into public.articles(
  id, title, slug, category_id, status, published_at, canonical_url,
  content_json, content_html, created_by, updated_by
) values (
  '00000000-0000-4000-8000-000000000101', 'Original Russian', 'original-russian',
  '00000000-0000-4000-8000-000000000010', 'published', now(),
  'https://example.test/original-russian', '{"type":"doc","content":[]}', '<p>Original</p>',
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'
);
truncate public.public_build_outbox restart identity;

create function public.fixture_publish_article(
  expected_draft_version bigint,
  next_slug text default null,
  expected_article_timestamp timestamptz default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare current_article public.articles%rowtype; saved_id uuid;
begin
  select * into current_article from public.articles
  where id = '00000000-0000-4000-8000-000000000101';
  select bundle.article_id into saved_id
  from public.promote_article_working_draft(
    current_article.id,
    coalesce(expected_article_timestamp, current_article.updated_at),
    expected_draft_version,
    to_jsonb(current_article) || jsonb_build_object(
      'title', 'Published Russian', 'status', 'published', 'published_at', now(),
      'slug', coalesce(next_slug, current_article.slug),
      'canonical_url', 'https://example.test/' || coalesce(next_slug, current_article.slug)
    ),
    'none', null, null,
    case when next_slug is null then null else '/' || current_article.slug end,
    case when next_slug is null then null else '/' || next_slug end,
    false, 'article.updated', '{}'::jsonb, false, '{}'::jsonb
  ) bundle;
  return saved_id;
end;
$$;
revoke all on function public.fixture_publish_article(bigint,text,timestamptz) from public;
grant execute on function public.fixture_publish_article(bigint,text,timestamptz) to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
do $$
begin
  begin
    perform public.fixture_publish_article(0);
    raise exception 'Old promotion unexpectedly bypassed missing draft UPDATE permission';
  exception when insufficient_privilege then
    if position('article_working_drafts' in sqlerrm) = 0 then raise; end if;
  end;
end;
$$;
select 'LEGACY_DRAFT_LOCK_PERMISSION_FAILURE_CONFIRMED';

do $$
declare a public.articles%rowtype; before_outbox bigint; before_revision bigint;
begin
  select * into a from public.articles where id='00000000-0000-4000-8000-000000000101';
  select count(*) into before_outbox from public.public_build_outbox;
  select count(*) into before_revision from public.article_revisions;
  begin
    perform * from public.save_article_bundle(
      a.id, a.updated_at,
      to_jsonb(a) || jsonb_build_object('title','Should roll back'),
      'none', null, null, '/original-russian', '/renamed-russian', false,
      'article.updated', '{}'::jsonb, false, '{}'::jsonb
    );
    raise exception 'Old bundle unexpectedly bypassed missing redirect INSERT permission';
  exception when insufficient_privilege then
    if position('redirects' in sqlerrm) = 0 then raise; end if;
  end;
  if (select title from public.articles where id=a.id) is distinct from a.title
    or (select count(*) from public.public_build_outbox) <> before_outbox
    or (select count(*) from public.article_revisions) <> before_revision then
    raise exception 'Old redirect permission failure left partial article side effects';
  end if;
end;
$$;
select 'LEGACY_REDIRECT_PERMISSION_FAILURE_CONFIRMED';
reset role;

-- __ARTICLE_PUBLICATION_PERMISSIONS_HOTFIX__

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
do $$
declare
  a public.articles%rowtype;
  before_outbox bigint;
  before_revision bigint;
  before_redirects bigint;
  draft_version bigint;
begin
  if has_table_privilege('authenticated', 'public.article_working_drafts', 'UPDATE')
    or has_table_privilege('authenticated', 'public.article_working_drafts', 'INSERT')
    or has_table_privilege('authenticated', 'public.article_working_drafts', 'DELETE')
    or has_table_privilege('authenticated', 'public.redirects', 'INSERT')
    or has_table_privilege('authenticated', 'public.redirects', 'UPDATE') then
    raise exception 'Publication fix reopened direct writes';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc
    where oid in (
      'public.save_article_bundle(uuid,timestamptz,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb)'::regprocedure,
      'public.promote_article_working_draft(uuid,timestamptz,bigint,jsonb,text,jsonb,timestamptz,text,text,boolean,text,jsonb,boolean,jsonb)'::regprocedure
    ) and prosecdef
  ) then raise exception 'Outer publication RPC must remain SECURITY INVOKER'; end if;

  perform public.fixture_publish_article(0);
  if (select status from public.articles where id='00000000-0000-4000-8000-000000000101') <> 'published'
    or exists (select 1 from public.article_translations where locale='en') then
    raise exception 'Russian release required or created an English translation';
  end if;

  select * into a from public.articles where id='00000000-0000-4000-8000-000000000101';
  perform public.save_article_working_draft(
    a.id, a.updated_at, to_jsonb(a) || jsonb_build_object('title','Saved private draft'),
    '{"mode":"disabled"}'::jsonb, null, 0
  );
  select version into draft_version from public.article_working_drafts where article_id=a.id;
  select count(*) into before_outbox from public.public_build_outbox;
  begin
    perform public.fixture_publish_article(0);
    raise exception 'Publication ignored the new working-draft version';
  exception when serialization_failure then
    if sqlerrm <> 'WORKING_DRAFT_CONFLICT' then raise; end if;
  end;
  if (select count(*) from public.public_build_outbox) <> before_outbox then
    raise exception 'Draft CAS conflict wrote publication side effects';
  end if;
  perform public.fixture_publish_article(draft_version, 'renamed-russian');
  if exists (select 1 from public.article_working_drafts where article_id=a.id)
    or not exists (select 1 from public.redirects
      where source_path='/original-russian' and destination_path='/renamed-russian' and is_active) then
    raise exception 'Promotion failed to atomically clear the draft and create its redirect';
  end if;
  select count(*) into before_outbox from public.public_build_outbox;
  begin
    perform public.fixture_publish_article(0, null, a.updated_at);
    raise exception 'Publication accepted a stale article timestamp';
  exception when serialization_failure then
    if sqlerrm <> 'ARTICLE_CONFLICT' then raise; end if;
  end;
  if (select count(*) from public.public_build_outbox) <> before_outbox then
    raise exception 'Article CAS conflict wrote publication side effects';
  end if;

  perform public.create_seo_redirect_guarded('/blocked-source', '/blocked-target', 301::smallint, true);
  select * into a from public.articles where id='00000000-0000-4000-8000-000000000101';
  select count(*) into before_outbox from public.public_build_outbox;
  select count(*) into before_revision from public.article_revisions;
  select count(*) into before_redirects from public.redirects;
  begin
    perform * from public.save_article_bundle(
      a.id, a.updated_at, to_jsonb(a) || jsonb_build_object('title','Guarded rollback'),
      'none', null, null, '/should-not-stick', '/blocked-source', false,
      'article.updated', '{}'::jsonb, false, '{}'::jsonb
    );
    raise exception 'Fixed publication bypassed redirect chain protection';
  exception when raise_exception then
    if sqlerrm <> 'REDIRECT_COLLISION_OR_CHAIN' then raise; end if;
  end;
  if (select title from public.articles where id=a.id) is distinct from a.title
    or (select count(*) from public.public_build_outbox) <> before_outbox
    or (select count(*) from public.article_revisions) <> before_revision
    or (select count(*) from public.redirects) <> before_redirects then
    raise exception 'Guarded redirect failure left partial publication side effects';
  end if;

  begin
    update public.article_working_drafts set version=version+1 where article_id=a.id;
    raise exception 'Direct working-draft update unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.redirects(source_path,destination_path,created_by)
    values ('/direct-write','/forbidden',auth.uid());
    raise exception 'Direct redirect insert unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
do $$
begin
  begin
    perform public.lock_article_working_draft_for_publication(
      '00000000-0000-4000-8000-000000000101', now()
    );
    raise exception 'Editor unexpectedly accessed the privileged draft lock';
  exception when insufficient_privilege then null; end;
  begin
    perform public.fixture_publish_article(0);
    raise exception 'Editor unexpectedly published an existing live article';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm not in ('ARTICLE_NOT_FOUND','STAFF_ACCESS_REQUIRED','ADMIN_HIGH_RISK_ROLE_REQUIRED') then raise; end if;
  end;
end;
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', false);
do $$
begin
  begin
    perform public.lock_article_working_draft_for_publication(
      '00000000-0000-4000-8000-000000000101', now()
    );
    raise exception 'Reader unexpectedly accessed the privileged draft lock';
  exception when insufficient_privilege then null; end;
  begin
    perform public.fixture_publish_article(0);
    raise exception 'Reader unexpectedly published an article';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set role anon;
do $$
begin
  begin
    perform public.lock_article_working_draft_for_publication(
      '00000000-0000-4000-8000-000000000101', now()
    );
    raise exception 'Anonymous caller unexpectedly accessed the privileged draft lock';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
select 'ARTICLE_PUBLICATION_PERMISSIONS_OK';
