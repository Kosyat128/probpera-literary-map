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
