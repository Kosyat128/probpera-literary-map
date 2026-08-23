-- Record AI-generated literary-work translations explicitly instead of
-- misclassifying them as human translations. Public publication rules remain
-- source-aware and still require reviewed/verified RU+EN records.

alter table public.literary_work_translations
  drop constraint if exists literary_work_translations_translation_method_check;

alter table public.literary_work_translations
  add constraint literary_work_translations_translation_method_check
  check (
    translation_method in (
      'editorial-original',
      'human-translation',
      'machine-translation',
      'licensed-source'
    )
  );

create or replace function public.premium_machine_translation_ready()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class relation
      on relation.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'literary_work_translations'
      and constraint_row.conname =
        'literary_work_translations_translation_method_check'
      and pg_catalog.pg_get_constraintdef(constraint_row.oid)
        like '%machine-translation%'
  );
$$;

revoke all on function public.premium_machine_translation_ready() from public;
grant execute on function public.premium_machine_translation_ready()
  to authenticated;
