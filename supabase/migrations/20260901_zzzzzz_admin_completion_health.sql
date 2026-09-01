-- Final fail-closed health contract for the completed administrative surface.
-- Operational outcomes (provider availability, backup freshness) remain separate
-- runtime probes; this RPC certifies the installed schema and authorization edges.

do $admin_completion_health_predecessor$
begin
  if to_regprocedure(
    'public.get_editorial_schema_health_pre_admin_completion()'
  ) is null then
    if to_regprocedure('public.get_editorial_schema_health()') is null then
      raise exception 'preceding editorial schema health RPC is missing';
    end if;
    alter function public.get_editorial_schema_health()
      rename to get_editorial_schema_health_pre_admin_completion;
  end if;
end;
$admin_completion_health_predecessor$;

revoke all on function public.get_editorial_schema_health_pre_admin_completion()
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
      public.get_editorial_schema_health_pre_admin_completion(),
      '{}'::jsonb
    ) || jsonb_build_object(
      'version', '20260901_zzzzzz_admin_completion_health',
      'checkedAt', now(),
      'visualDirectEditV2',
        to_regprocedure(
          'public.save_visual_content_field_v2(text,uuid,text,jsonb,timestamp with time zone)'
        ) is not null
        and to_regprocedure(
          'public.save_homepage_visual_settings_v2(uuid,jsonb,boolean,timestamp with time zone)'
        ) is not null
        and has_function_privilege(
          'authenticated',
          'public.save_visual_content_field_v2(text,uuid,text,jsonb,timestamp with time zone)',
          'EXECUTE'
        )
        and has_function_privilege(
          'authenticated',
          'public.save_homepage_visual_settings_v2(uuid,jsonb,boolean,timestamp with time zone)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.save_visual_content_field_v2(text,uuid,text,jsonb,timestamp with time zone)',
          'EXECUTE'
        ),
      'staffOwnerInvariant',
        to_regprocedure(
          'public.owner_set_staff_member(text,public.staff_role)'
        ) is not null
        and to_regprocedure(
          'public.owner_remove_staff_member(uuid)'
        ) is not null
        and (
          select relation.relrowsecurity and relation.relforcerowsecurity
          from pg_catalog.pg_class relation
          where relation.oid = 'public.staff_memberships'::regclass
        )
        and not has_table_privilege(
          'authenticated', 'public.staff_memberships', 'INSERT'
        )
        and not has_table_privilege(
          'authenticated', 'public.staff_memberships', 'UPDATE'
        )
        and not has_table_privilege(
          'authenticated', 'public.staff_memberships', 'DELETE'
        )
        and has_function_privilege(
          'authenticated',
          'public.owner_set_staff_member(text,public.staff_role)',
          'EXECUTE'
        )
        and has_function_privilege(
          'authenticated',
          'public.owner_remove_staff_member(uuid)',
          'EXECUTE'
        ),
      'dataStudioIntegrity',
        (
          select health @> jsonb_build_object(
            'version', '20260901_zz_data_studio_integrity',
            'countries', true,
            'writers', true,
            'forceRls', true,
            'authenticatedSelectOnly', true,
            'directMutationClosed', true,
            'staffSelectPolicies', true,
            'validatedForeignKeys', true,
            'ensureReferenceRpc', true,
            'manualReferenceRpc', true,
            'catalogSyncRpc', true,
            'manualReferencesValid', true,
            'atomicEditionCreate', true,
            'atomicEditionUpdate', true
          )
          from (
            select public.get_data_studio_schema_health() as health
          ) data_studio_probe
        ),
      'translationOperations',
        to_regclass('public.translation_jobs') is not null
        and to_regclass('public.translation_job_items') is not null
        and to_regclass('public.translation_job_attempts') is not null
        and to_regclass('public.translation_provider_self_tests') is not null
        and public.translation_operations_ready(),
      'adminMutationGuards',
        to_regprocedure(
          'public.save_site_copy_block(timestamp with time zone,jsonb,jsonb)'
        ) is not null
        and to_regprocedure(
          'public.create_seo_redirect_guarded(text,text,smallint,boolean)'
        ) is not null
        and to_regprocedure(
          'public.update_seo_redirect_guarded(uuid,timestamp with time zone,text,text,smallint,boolean)'
        ) is not null
        and to_regprocedure(
          'public.delete_seo_redirect_guarded(uuid,timestamp with time zone)'
        ) is not null
        and to_regprocedure(
          'public.moderate_comments_guarded(jsonb,public.publication_status)'
        ) is not null
        and (
          select count(*) = 3
          from pg_catalog.pg_policies policy
          where policy.schemaname = 'public'
            and policy.tablename = 'homepage_blocks'
            and policy.policyname = any(array[
              'Site Copy insert requires guarded RPC',
              'Site Copy update requires guarded RPC',
              'Site Copy delete requires guarded RPC'
            ]::text[])
            and policy.permissive = 'RESTRICTIVE'
            and policy.roles = array['authenticated'::name]
        )
        and not has_table_privilege(
          'authenticated', 'public.article_comments', 'UPDATE'
        )
        and not has_table_privilege(
          'authenticated', 'public.article_comments', 'DELETE'
        )
        and has_column_privilege(
          'authenticated', 'public.article_comments', 'body', 'UPDATE'
        )
        and not has_column_privilege(
          'authenticated', 'public.article_comments', 'status', 'UPDATE'
        )
        and has_function_privilege(
          'authenticated',
          'public.moderate_comments_guarded(jsonb,public.publication_status)',
          'EXECUTE'
        ),
      'adminAnalyticsReporting',
        to_regprocedure(
          'public.get_admin_analytics_report(timestamp with time zone,timestamp with time zone)'
        ) is not null
        and has_function_privilege(
          'authenticated',
          'public.get_admin_analytics_report(timestamp with time zone,timestamp with time zone)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'anon',
          'public.get_admin_analytics_report(timestamp with time zone,timestamp with time zone)',
          'EXECUTE'
        ),
      'adminOpsObservability',
        to_regclass('public.admin_ops_markers') is not null
        and (
          select relation.relrowsecurity and relation.relforcerowsecurity
          from pg_catalog.pg_class relation
          where relation.oid = 'public.admin_ops_markers'::regclass
        )
        and has_table_privilege(
          'authenticated', 'public.admin_ops_markers', 'SELECT'
        )
        and not has_table_privilege(
          'authenticated', 'public.admin_ops_markers', 'INSERT'
        )
        and not has_table_privilege(
          'authenticated', 'public.admin_ops_markers', 'UPDATE'
        )
        and not has_table_privilege(
          'authenticated', 'public.admin_ops_markers', 'DELETE'
        )
        and (
          select count(*) = 1
          from pg_catalog.pg_policies policy
          where policy.schemaname = 'public'
            and policy.tablename = 'admin_ops_markers'
            and policy.policyname = 'Staff read operational markers'
            and policy.cmd = 'SELECT'
            and policy.roles = array['authenticated'::name]
            and position('is_staff' in coalesce(policy.qual, '')) > 0
        )
    )
    else null
  end;
$$;

revoke all on function public.get_editorial_schema_health()
  from public, anon, authenticated, service_role;
grant execute on function public.get_editorial_schema_health()
  to authenticated;
