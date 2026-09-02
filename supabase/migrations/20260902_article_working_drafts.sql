-- Private working copies for editing an already published article without
-- mutating its public row until the normal atomic publication flow succeeds.

create table if not exists public.article_working_drafts (
  article_id uuid primary key
    references public.articles(id) on update cascade on delete cascade,
  base_article_updated_at timestamptz not null,
  payload jsonb not null,
  english_payload jsonb not null,
  expected_english_updated_at timestamptz,
  version bigint not null default 1,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_working_drafts_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  constraint article_working_drafts_payload_size_check
    check (octet_length(payload::text) <= 5242880),
  constraint article_working_drafts_english_payload_check
    check (
      jsonb_typeof(english_payload) = 'object'
      and octet_length(english_payload::text) <= 5242880
      and (
        english_payload = '{"mode":"disabled"}'::jsonb
        or (
          english_payload ->> 'mode' = 'save'
          and jsonb_typeof(english_payload -> 'payload') = 'object'
        )
      )
    ),
  constraint article_working_drafts_version_check check (version > 0),
  constraint article_working_drafts_timestamp_order_check
    check (updated_at >= created_at)
);

create index if not exists article_working_drafts_updated_idx
  on public.article_working_drafts(updated_at desc, article_id);
create index if not exists article_working_drafts_actor_idx
  on public.article_working_drafts(actor_id, updated_at desc);

alter table public.article_working_drafts enable row level security;
alter table public.article_working_drafts force row level security;
revoke all on table public.article_working_drafts from public, anon, authenticated;
grant select on table public.article_working_drafts to authenticated;
grant all on table public.article_working_drafts to service_role;

-- Editors may prepare drafts and send them to review, but only owners/admins
-- may mutate the public/scheduled article rows.  Keep this boundary in RLS so
-- a handcrafted PostgREST/RPC request cannot bypass the server action check.
drop policy if exists "Staff create articles" on public.articles;
create policy "Staff create articles"
  on public.articles for insert to authenticated
  with check (
    public.is_staff()
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and (
      public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role])
      or status in ('draft', 'review')
    )
  );

drop policy if exists "Staff update articles" on public.articles;
create policy "Staff update articles"
  on public.articles for update to authenticated
  using (
    public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role])
    or (
      public.is_staff(array['editor'::public.staff_role])
      and status in ('draft', 'review')
    )
  )
  with check (
    updated_by = (select auth.uid())
    and (
      public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role])
      or (
        public.is_staff(array['editor'::public.staff_role])
        and status in ('draft', 'review')
      )
    )
  );

-- Apply the same release boundary to article translations.  Editors may work
-- only inside an unpublished parent and may never manufacture an approved,
-- published or archived translation through direct PostgREST writes.
drop policy if exists "Staff create article translations"
  on public.article_translations;
create policy "Staff create article translations"
  on public.article_translations for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and (
      public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role])
      or (
        public.is_staff(array['editor'::public.staff_role])
        and status in ('draft', 'review')
        and approved_by is null
        and approved_at is null
        and published_at is null
        and deleted_at is null
        and exists (
          select 1
          from public.articles parent_article
          where parent_article.id = article_id
            and parent_article.status in ('draft', 'review')
            and parent_article.deleted_at is null
        )
      )
    )
  );

drop policy if exists "Staff update article translations"
  on public.article_translations;
create policy "Staff update article translations"
  on public.article_translations for update to authenticated
  using (
    public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role])
    or (
      public.is_staff(array['editor'::public.staff_role])
      and deleted_at is null
      and exists (
        select 1
        from public.articles parent_article
        where parent_article.id = article_id
          and parent_article.status in ('draft', 'review')
          and parent_article.deleted_at is null
      )
    )
  )
  with check (
    updated_by = (select auth.uid())
    and (
      public.is_staff(array['owner'::public.staff_role, 'admin'::public.staff_role])
      or (
        public.is_staff(array['editor'::public.staff_role])
        and status in ('draft', 'review', 'stale')
        and approved_by is null
        and approved_at is null
        and published_at is null
        and deleted_at is null
        and exists (
          select 1
          from public.articles parent_article
          where parent_article.id = article_id
            and parent_article.status in ('draft', 'review')
            and parent_article.deleted_at is null
        )
      )
    )
  );

drop policy if exists "Staff read article working drafts"
  on public.article_working_drafts;
create policy "Staff read article working drafts"
  on public.article_working_drafts
  for select to authenticated
  using (public.is_staff());

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
begin
  if actor is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'staff-required';
  end if;
  if p_article_id is null
    or p_base_article_updated_at is null
    or p_expected_version is null
    or p_expected_version < 0
    or jsonb_typeof(p_payload) is distinct from 'object'
    or octet_length(p_payload::text) > 5242880
    or (
      jsonb_typeof(p_english_payload) is distinct from 'object'
      or octet_length(p_english_payload::text) > 5242880
      or not (
        p_english_payload = '{"mode":"disabled"}'::jsonb
        or (
          p_english_payload ->> 'mode' = 'save'
          and jsonb_typeof(p_english_payload -> 'payload') = 'object'
        )
      )
    ) then
    raise exception using errcode = '22023', message = 'working-draft-invalid';
  end if;

  select * into current_article
  from public.articles
  where id = p_article_id
  for update;
  if not found or current_article.deleted_at is not null
    or current_article.status is distinct from 'published'::public.article_status then
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
        english_payload = p_english_payload,
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
      expected_english_updated_at, version, actor_id
    ) values (
      p_article_id, p_base_article_updated_at, p_payload, p_english_payload,
      p_expected_english_updated_at, 1, actor
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

create or replace function public.discard_article_working_draft(
  p_article_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_version bigint;
begin
  if actor is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'staff-required';
  end if;
  if p_article_id is null or p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'working-draft-invalid';
  end if;
  select version into current_version
  from public.article_working_drafts
  where article_id = p_article_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'working-draft-not-found';
  end if;
  if current_version is distinct from p_expected_version then
    raise exception using errcode = '40001', message = 'working-draft-version-conflict';
  end if;
  delete from public.article_working_drafts
  where article_id = p_article_id and version = p_expected_version;
  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor,
    'article.working_draft.discarded',
    'article',
    p_article_id::text,
    jsonb_build_object('version', p_expected_version)
  );
  return jsonb_build_object('articleId', p_article_id, 'discarded', true);
end;
$$;

create or replace function public.clear_article_working_draft_after_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.article_working_drafts where article_id = new.id;
  return new;
end;
$$;

-- An existing privileged release must not erase a newer working copy.  The
-- guard makes the legacy bundle RPC fail closed whenever a working draft is
-- present; only the promotion RPC below installs the transaction-local CAS
-- evidence after locking article -> draft in the canonical order.
create or replace function public.guard_article_working_draft_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_draft_version bigint;
  expected_promotion text;
begin
  if new.status not in ('published', 'scheduled', 'hidden', 'archived') then
    return new;
  end if;

  select draft.version
  into current_draft_version
  from public.article_working_drafts draft
  where draft.article_id = new.id
  for update;
  if not found then
    return new;
  end if;

  expected_promotion := nullif(
    current_setting('probpera.expected_working_draft_promotion', true),
    ''
  );
  if expected_promotion is distinct from
    (new.id::text || ':' || current_draft_version::text) then
    raise exception using
      errcode = '40001',
      message = 'WORKING_DRAFT_CONFLICT';
  end if;
  return new;
end;
$$;

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
  target_status text := p_article_payload ->> 'status';
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception using errcode = '42501', message = 'STAFF_ACCESS_REQUIRED';
  end if;
  if p_article_id is null
    or p_expected_article_updated_at is null
    or p_expected_working_draft_version is null
    or p_expected_working_draft_version < 0 then
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

  select draft.version
  into current_draft_version
  from public.article_working_drafts draft
  where draft.article_id = p_article_id
  for update;
  has_working_draft := found;
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
end;
$$;

drop trigger if exists articles_guard_working_draft_promotion
  on public.articles;
create trigger articles_guard_working_draft_promotion
before update on public.articles
for each row
when (new.status in ('published', 'scheduled', 'hidden', 'archived'))
execute function public.guard_article_working_draft_promotion();

drop trigger if exists articles_clear_working_draft_after_promotion
  on public.articles;
create trigger articles_clear_working_draft_after_promotion
after update on public.articles
for each row
when (new.status in ('published', 'scheduled', 'hidden', 'archived'))
execute function public.clear_article_working_draft_after_promotion();

revoke all on function public.save_article_working_draft(
  uuid, timestamptz, jsonb, jsonb, timestamptz, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.discard_article_working_draft(uuid, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.clear_article_working_draft_after_promotion()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_article_working_draft_promotion()
  from public, anon, authenticated, service_role;
revoke all on function public.promote_article_working_draft(
  uuid, timestamptz, bigint, jsonb, text, jsonb, timestamptz, text, text,
  boolean, text, jsonb, boolean, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.save_article_working_draft(
  uuid, timestamptz, jsonb, jsonb, timestamptz, bigint
) to authenticated;
grant execute on function public.discard_article_working_draft(uuid, bigint)
  to authenticated;
grant execute on function public.promote_article_working_draft(
  uuid, timestamptz, bigint, jsonb, text, jsonb, timestamptz, text, text,
  boolean, text, jsonb, boolean, jsonb
) to authenticated;
