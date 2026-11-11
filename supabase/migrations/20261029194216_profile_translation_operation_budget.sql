-- Preserve every existing operational error code and admit the explicit stop
-- outcome already understood by the application. Source/provider prose remains
-- outside the existing Translation Operations tables.
alter table public.translation_job_items
  drop constraint translation_job_items_last_error_code_check;
alter table public.translation_job_items
  add constraint translation_job_items_last_error_code_check check (
    last_error_code is null or last_error_code in (
      'translation_not_configured', 'provider_unavailable',
      'provider_request_failed', 'provider_invalid_response', 'source_changed',
      'write_conflict', 'database_read_failed', 'database_write_failed', 'unexpected',
      'translation_operation_stopped'
    )
  );

alter table public.translation_job_attempts
  drop constraint translation_job_attempts_error_code_check;
alter table public.translation_job_attempts
  add constraint translation_job_attempts_error_code_check check (
    error_code is null or error_code in (
      'translation_not_configured', 'provider_unavailable',
      'provider_request_failed', 'provider_invalid_response', 'source_changed',
      'write_conflict', 'database_read_failed', 'database_write_failed', 'unexpected',
      'translation_operation_stopped'
    )
  );

-- Read metadata only, using the current caller's permissions and a fresh staff
-- check. Fail closed on missing, unvalidated or altered error-code guards.
create function public.profile_translation_budget_ready()
returns boolean language plpgsql stable security invoker set search_path = '' as $$
declare
  expected_codes constant text[] := array[
    'translation_not_configured', 'provider_unavailable',
    'provider_request_failed', 'provider_invalid_response', 'source_changed',
    'write_conflict', 'database_read_failed', 'database_write_failed', 'unexpected',
    'translation_operation_stopped'
  ];
  codes_expression text;
  guard record;
  record_rpc oid := pg_catalog.to_regprocedure('public.record_translation_sync_run(text,text,jsonb,jsonb,jsonb)');
  resume_rpc oid := pg_catalog.to_regprocedure('public.get_translation_job_resume(uuid)');
begin
  if auth.uid() is null or not coalesce(public.is_staff(), false) then
    raise exception using errcode = '42501', message = 'Profile translation budget readiness requires staff access';
  end if;
  if record_rpc is null or resume_rpc is null then return false; end if;
  if not coalesce(pg_catalog.has_function_privilege('authenticated', record_rpc, 'EXECUTE'), false)
    or not coalesce(pg_catalog.has_function_privilege('authenticated', resume_rpc, 'EXECUTE'), false)
    or not exists (select 1 from pg_catalog.pg_proc where oid = record_rpc and prorettype = 'uuid'::regtype)
    or not exists (select 1 from pg_catalog.pg_proc where oid = resume_rpc and prorettype = 'jsonb'::regtype) then
    return false;
  end if;
  select pg_catalog.string_agg(pg_catalog.quote_literal(code) || '::text', ', ' order by position)
    into codes_expression from pg_catalog.unnest(expected_codes) with ordinality as code_list(code, position);
  for guard in select * from (values
    ('public.translation_job_items', 'translation_job_items_last_error_code_check', 'last_error_code'),
    ('public.translation_job_attempts', 'translation_job_attempts_error_code_check', 'error_code')
  ) as expected(table_name, constraint_name, column_name) loop
    if not exists (
      select 1 from pg_catalog.pg_constraint constraint_row
      join pg_catalog.pg_attribute attribute_row
        on attribute_row.attrelid = constraint_row.conrelid and attribute_row.attname = guard.column_name
      where constraint_row.conrelid = pg_catalog.to_regclass(guard.table_name)
        and constraint_row.conname = guard.constraint_name
        and constraint_row.contype = 'c' and constraint_row.convalidated
        and constraint_row.conkey = array[attribute_row.attnum]::smallint[]
        and pg_catalog.pg_get_expr(constraint_row.conbin, constraint_row.conrelid) =
          pg_catalog.format('((%1$I IS NULL) OR (%1$I = ANY (ARRAY[%2$s])))', guard.column_name, codes_expression)
    ) then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.profile_translation_budget_ready()
  from public, anon, authenticated, service_role;
grant execute on function public.profile_translation_budget_ready() to authenticated;
