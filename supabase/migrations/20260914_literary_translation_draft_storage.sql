-- Preserve short, unreviewed draft text without changing publication rules.
-- Reviewed and verified descriptions retain the existing 140..900 limit.
do $literary_translation_draft_storage$
declare
  existing_constraint record;
  old_definition constant text :=
    'CHECK (((char_length(description) >= 140) AND (char_length(description) <= 900)))';
  target_definition constant text :=
    'CHECK ((((char_length(description) >= 140) AND (char_length(description) <= 900)) OR ((editorial_status = ''draft''::text) AND (reviewed_at IS NULL) AND ((char_length(description) >= 1) AND (char_length(description) <= 139)) AND (description ~ ''[^[:space:]]''::text))))';
begin
  lock table public.literary_work_translations
    in access exclusive mode nowait;

  select constraint_row.*,
    pg_catalog.pg_get_constraintdef(constraint_row.oid, false) as definition
  into existing_constraint
  from pg_catalog.pg_constraint constraint_row
  where constraint_row.conrelid =
      'public.literary_work_translations'::regclass
    and constraint_row.conname =
      'literary_work_translations_description_check';

  if not found
    or existing_constraint.contype <> 'c'
    or not existing_constraint.convalidated
    or not existing_constraint.conislocal
    or existing_constraint.coninhcount <> 0
    or existing_constraint.connoinherit
    or existing_constraint.condeferrable
    or existing_constraint.condeferred then
    raise exception 'Reviewed translation description constraint is missing or incompatible';
  end if;

  if existing_constraint.definition = target_definition then
    return;
  end if;
  if existing_constraint.definition <> old_definition then
    raise exception 'Translation description constraint differs from the reviewed predecessor';
  end if;

  alter table public.literary_work_translations
    drop constraint literary_work_translations_description_check;
  -- Adding a validated CHECK scans existing rows inside the same transaction.
  alter table public.literary_work_translations
    add constraint literary_work_translations_description_check check (
      char_length(description) between 140 and 900
      or (
        editorial_status = 'draft'
        and reviewed_at is null
        and char_length(description) between 1 and 139
        and description ~ '[^[:space:]]'
      )
    );
end;
$literary_translation_draft_storage$;
