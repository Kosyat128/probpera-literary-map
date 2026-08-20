-- Correct the editorial attribution of the core book-of-the-month block.
-- The narrow value guard preserves every later or intentionally customized
-- caption. The existing homepage revision trigger records the previous row.
update public.homepage_blocks
set
  settings = jsonb_set(
    settings,
    '{eyebrow}',
    to_jsonb('Выбор редакции'::text),
    true
  ),
  updated_at = now()
where settings ->> 'coreSectionKey' = 'book-month'
  and settings ->> 'eyebrow' = 'Выбор энциклопедии';
