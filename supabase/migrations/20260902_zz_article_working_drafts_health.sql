-- Fail-closed schema-health extension for private working copies of already
-- published articles. Operational delivery remains a separate runtime probe.

do $article_working_drafts_health_predecessor$
begin
  if to_regprocedure(
    'public.get_editorial_schema_health_pre_article_working_drafts()'
  ) is null then
    if to_regprocedure('public.get_editorial_schema_health()') is null then
      raise exception 'preceding editorial schema health RPC is missing';
    end if;
    alter function public.get_editorial_schema_health()
      rename to get_editorial_schema_health_pre_article_working_drafts;
  end if;
end;
$article_working_drafts_health_predecessor$;

revoke all on function
  public.get_editorial_schema_health_pre_article_working_drafts()
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
      public.get_editorial_schema_health_pre_article_working_drafts(),
      '{}'::jsonb
    ) || jsonb_build_object(
      'version', '20260902_zz_article_working_drafts_health',
      'checkedAt', now(),
      'articleWorkingDrafts',
        to_regclass('public.article_working_drafts') is not null
        and (
          select relation.relrowsecurity and relation.relforcerowsecurity
          from pg_catalog.pg_class relation
          where relation.oid = 'public.article_working_drafts'::regclass
        )
        and (
          select count(*) = 2
          from pg_catalog.pg_constraint payload_bound
          where payload_bound.conrelid =
              'public.article_working_drafts'::regclass
            and payload_bound.conname = any(array[
              'article_working_drafts_payload_size_check',
              'article_working_drafts_english_payload_check'
            ]::name[])
            and payload_bound.convalidated
            and position(
              '5242880' in pg_get_constraintdef(payload_bound.oid)
            ) > 0
        )
        and has_table_privilege(
          'authenticated', 'public.article_working_drafts', 'SELECT'
        )
        and not has_table_privilege(
          'authenticated', 'public.article_working_drafts', 'INSERT'
        )
        and not has_table_privilege(
          'authenticated', 'public.article_working_drafts', 'UPDATE'
        )
        and not has_table_privilege(
          'authenticated', 'public.article_working_drafts', 'DELETE'
        )
        and (
          select count(*) = 1
          from pg_catalog.pg_policies policy
          where policy.schemaname = 'public'
            and policy.tablename = 'article_working_drafts'
        )
        and (
          select count(*) = 1
          from pg_catalog.pg_policies policy
          where policy.schemaname = 'public'
            and policy.tablename = 'article_working_drafts'
            and policy.policyname = 'Staff read article working drafts'
            and policy.cmd = 'SELECT'
            and policy.roles = array['authenticated'::name]
            and position('is_staff' in coalesce(policy.qual, '')) > 0
        )
        and to_regprocedure(
          'public.save_article_working_draft(uuid,timestamp with time zone,jsonb,jsonb,timestamp with time zone,bigint)'
        ) is not null
        and to_regprocedure(
          'public.discard_article_working_draft(uuid,bigint)'
        ) is not null
        and to_regprocedure(
          'public.clear_article_working_draft_after_promotion()'
        ) is not null
        and (
          select count(*) = 3
          from pg_catalog.pg_proc rpc
          where rpc.oid = any(array[
            'public.save_article_working_draft(uuid,timestamp with time zone,jsonb,jsonb,timestamp with time zone,bigint)'::regprocedure,
            'public.discard_article_working_draft(uuid,bigint)'::regprocedure,
            'public.clear_article_working_draft_after_promotion()'::regprocedure
          ])
            and rpc.prosecdef
        )
        and has_function_privilege(
          'authenticated',
          'public.save_article_working_draft(uuid,timestamp with time zone,jsonb,jsonb,timestamp with time zone,bigint)',
          'EXECUTE'
        )
        and has_function_privilege(
          'authenticated',
          'public.discard_article_working_draft(uuid,bigint)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.save_article_working_draft(uuid,timestamp with time zone,jsonb,jsonb,timestamp with time zone,bigint)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.discard_article_working_draft(uuid,bigint)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.clear_article_working_draft_after_promotion()',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.clear_article_working_draft_after_promotion()',
          'EXECUTE'
        )
        and exists (
          select 1
          from pg_catalog.pg_trigger cleanup_trigger
          join pg_catalog.pg_class relation
            on relation.oid = cleanup_trigger.tgrelid
          join pg_catalog.pg_namespace namespace
            on namespace.oid = relation.relnamespace
          where namespace.nspname = 'public'
            and relation.relname = 'articles'
            and cleanup_trigger.tgname =
              'articles_clear_working_draft_after_promotion'
            and not cleanup_trigger.tgisinternal
            and cleanup_trigger.tgenabled = 'O'
            and cleanup_trigger.tgfoid =
              'public.clear_article_working_draft_after_promotion()'::regprocedure
            and position('published' in pg_get_triggerdef(cleanup_trigger.oid)) > 0
            and position('scheduled' in pg_get_triggerdef(cleanup_trigger.oid)) > 0
            and position('hidden' in pg_get_triggerdef(cleanup_trigger.oid)) > 0
            and position('archived' in pg_get_triggerdef(cleanup_trigger.oid)) > 0
        ),
      'articleWorkingDraftPromotionCas',
        to_regprocedure(
          'public.promote_article_working_draft(uuid,timestamp with time zone,bigint,jsonb,text,jsonb,timestamp with time zone,text,text,boolean,text,jsonb,boolean,jsonb)'
        ) is not null
        and to_regprocedure(
          'public.guard_article_working_draft_promotion()'
        ) is not null
        and has_function_privilege(
          'authenticated',
          'public.promote_article_working_draft(uuid,timestamp with time zone,bigint,jsonb,text,jsonb,timestamp with time zone,text,text,boolean,text,jsonb,boolean,jsonb)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.promote_article_working_draft(uuid,timestamp with time zone,bigint,jsonb,text,jsonb,timestamp with time zone,text,text,boolean,text,jsonb,boolean,jsonb)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.guard_article_working_draft_promotion()',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.guard_article_working_draft_promotion()',
          'EXECUTE'
        )
        and (
          select not promotion_rpc.prosecdef
          from pg_catalog.pg_proc promotion_rpc
          where promotion_rpc.oid =
            'public.promote_article_working_draft(uuid,timestamp with time zone,bigint,jsonb,text,jsonb,timestamp with time zone,text,text,boolean,text,jsonb,boolean,jsonb)'::regprocedure
        )
        and (
          select promotion_guard.prosecdef
          from pg_catalog.pg_proc promotion_guard
          where promotion_guard.oid =
            'public.guard_article_working_draft_promotion()'::regprocedure
        )
        and exists (
          select 1
          from pg_catalog.pg_trigger guard_trigger
          join pg_catalog.pg_class relation
            on relation.oid = guard_trigger.tgrelid
          join pg_catalog.pg_namespace namespace
            on namespace.oid = relation.relnamespace
          where namespace.nspname = 'public'
            and relation.relname = 'articles'
            and guard_trigger.tgname =
              'articles_guard_working_draft_promotion'
            and not guard_trigger.tgisinternal
            and guard_trigger.tgenabled = 'O'
            and guard_trigger.tgfoid =
              'public.guard_article_working_draft_promotion()'::regprocedure
            and position('BEFORE UPDATE' in pg_get_triggerdef(guard_trigger.oid)) > 0
            and position('published' in pg_get_triggerdef(guard_trigger.oid)) > 0
            and position('scheduled' in pg_get_triggerdef(guard_trigger.oid)) > 0
            and position('hidden' in pg_get_triggerdef(guard_trigger.oid)) > 0
            and position('archived' in pg_get_triggerdef(guard_trigger.oid)) > 0
        ),
      'articlePublicationRbac',
        (
          select count(*) = 2
          from pg_catalog.pg_policies policy
          where policy.schemaname = 'public'
            and policy.tablename = 'articles'
            and policy.cmd in ('INSERT', 'UPDATE')
        )
        and (
          select count(*) = 2
          from pg_catalog.pg_policies policy
          where policy.schemaname = 'public'
            and policy.tablename = 'articles'
            and policy.roles = array['authenticated'::name]
            and (
              (
                policy.policyname = 'Staff create articles'
                and policy.cmd = 'INSERT'
                and policy.qual is null
                and position('owner' in coalesce(policy.with_check, '')) > 0
                and position('admin' in coalesce(policy.with_check, '')) > 0
                and position('draft' in coalesce(policy.with_check, '')) > 0
                and position('review' in coalesce(policy.with_check, '')) > 0
              )
              or (
                policy.policyname = 'Staff update articles'
                and policy.cmd = 'UPDATE'
                and position('owner' in coalesce(policy.qual, '')) > 0
                and position('admin' in coalesce(policy.qual, '')) > 0
                and position('editor' in coalesce(policy.qual, '')) > 0
                and position('draft' in coalesce(policy.qual, '')) > 0
                and position('review' in coalesce(policy.qual, '')) > 0
                and position('owner' in coalesce(policy.with_check, '')) > 0
                and position('admin' in coalesce(policy.with_check, '')) > 0
                and position('editor' in coalesce(policy.with_check, '')) > 0
                and position('draft' in coalesce(policy.with_check, '')) > 0
                and position('review' in coalesce(policy.with_check, '')) > 0
              )
            )
        ),
      'articleTranslationRbac',
        (
          select count(*) = 2
          from pg_catalog.pg_policies policy
          where policy.schemaname = 'public'
            and policy.tablename = 'article_translations'
            and policy.cmd in ('INSERT', 'UPDATE')
        )
        and (
          select count(*) = 2
          from pg_catalog.pg_policies policy
          where policy.schemaname = 'public'
            and policy.tablename = 'article_translations'
            and policy.roles = array['authenticated'::name]
            and (
              (
                policy.policyname = 'Staff create article translations'
                and policy.cmd = 'INSERT'
                and policy.qual is null
                and position('created_by' in coalesce(policy.with_check, '')) > 0
                and position('updated_by' in coalesce(policy.with_check, '')) > 0
                and position('owner' in coalesce(policy.with_check, '')) > 0
                and position('admin' in coalesce(policy.with_check, '')) > 0
                and position('editor' in coalesce(policy.with_check, '')) > 0
                and position('draft' in coalesce(policy.with_check, '')) > 0
                and position('review' in coalesce(policy.with_check, '')) > 0
                and position('approved_by' in coalesce(policy.with_check, '')) > 0
                and position('approved_at' in coalesce(policy.with_check, '')) > 0
                and position('published_at' in coalesce(policy.with_check, '')) > 0
                and position('''approved''' in coalesce(policy.with_check, '')) = 0
                and position('''published''' in coalesce(policy.with_check, '')) = 0
                and position('''archived''' in coalesce(policy.with_check, '')) = 0
              )
              or (
                policy.policyname = 'Staff update article translations'
                and policy.cmd = 'UPDATE'
                and position('owner' in coalesce(policy.qual, '')) > 0
                and position('admin' in coalesce(policy.qual, '')) > 0
                and position('editor' in coalesce(policy.qual, '')) > 0
                and position('draft' in coalesce(policy.qual, '')) > 0
                and position('review' in coalesce(policy.qual, '')) > 0
                and position('updated_by' in coalesce(policy.with_check, '')) > 0
                and position('owner' in coalesce(policy.with_check, '')) > 0
                and position('admin' in coalesce(policy.with_check, '')) > 0
                and position('editor' in coalesce(policy.with_check, '')) > 0
                and position('draft' in coalesce(policy.with_check, '')) > 0
                and position('review' in coalesce(policy.with_check, '')) > 0
                and position('stale' in coalesce(policy.with_check, '')) > 0
                and position('approved_by' in coalesce(policy.with_check, '')) > 0
                and position('approved_at' in coalesce(policy.with_check, '')) > 0
                and position('published_at' in coalesce(policy.with_check, '')) > 0
                and position('''approved''' in coalesce(policy.with_check, '')) = 0
                and position('''published''' in coalesce(policy.with_check, '')) = 0
                and position('''archived''' in coalesce(policy.with_check, '')) = 0
              )
            )
        )
    )
    else null
  end;
$$;

revoke all on function public.get_editorial_schema_health()
  from public, anon, authenticated, service_role;
grant execute on function public.get_editorial_schema_health()
  to authenticated;
