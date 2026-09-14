begin;
create table public.literary_works(id uuid primary key);
-- __EXACT_OLD_STORAGE__
create table public.fixture_translation_input(value jsonb not null);
-- __ACTUAL_TRANSLATION_ROWS__

create function public.fixture_insert_translation(candidate jsonb)
returns void language plpgsql as $$
declare target uuid := gen_random_uuid();
begin
  insert into public.literary_works values(target);
  insert into public.literary_work_translations(
    work_id, locale, title, description, source_language, translation_method,
    editorial_status, source_urls, reviewed_at, metadata
  ) select target, candidate->>'locale', candidate->>'title', candidate->>'description',
    candidate->>'source_language', candidate->>'translation_method', candidate->>'editorial_status',
    array(select jsonb_array_elements_text(candidate->'source_urls')),
    (candidate->>'reviewed_at')::date, candidate->'metadata';
end;
$$;

create function public.fixture_reject_translation(candidate jsonb)
returns void language plpgsql as $$
declare violated text;
begin
  begin
    perform public.fixture_insert_translation(candidate);
  exception when check_violation then
    get stacked diagnostics violated = constraint_name;
    if violated <> 'literary_work_translations_description_check' then
      raise exception 'Unexpected constraint: %', violated;
    end if;
    return;
  end;
  raise exception 'Expected description CHECK rejection';
end;
$$;

-- The first known source-ordered incompatible row must fail on the original schema.
do $$
declare candidate jsonb;
begin
  select value into strict candidate from public.fixture_translation_input
  where value->>'work_id' = 'afghanistan:khaled_hosseini:legacy-khaled_hosseini-a-thousand-splendid-suns'
    and value->>'locale' = 'ru';
  if char_length(candidate->>'description') <> 139 then
    raise exception 'Exact retained 139-character source changed';
  end if;
  perform public.fixture_reject_translation(candidate);
  -- Existing 140 and 900 character descriptions stay valid, including reviewed text.
  perform public.fixture_insert_translation(candidate || jsonb_build_object('description', repeat('a', 140)));
  perform public.fixture_insert_translation(candidate || jsonb_build_object('description', repeat(' ', 140)));
  perform public.fixture_insert_translation(candidate || jsonb_build_object('description', repeat('a', 900),
    'editorial_status', 'reviewed', 'reviewed_at', '2026-09-14'));
end;
$$;
create table public.fixture_prior_rows as select * from public.literary_work_translations;
-- __DRAFT_STORAGE_MIGRATION__

do $$
begin
  if exists(select * from public.fixture_prior_rows except select * from public.literary_work_translations) then
    raise exception 'Migration changed existing row bytes';
  end if;
end;
$$;
delete from public.literary_work_translations;
insert into public.literary_works(id)
select distinct md5(value->>'work_id')::uuid from public.fixture_translation_input;
insert into public.literary_work_translations(
  work_id, locale, title, description, source_language, translation_method,
  editorial_status, source_urls, reviewed_at, metadata
) select md5(value->>'work_id')::uuid, value->>'locale', value->>'title', value->>'description',
  value->>'source_language', value->>'translation_method', value->>'editorial_status',
  array(select jsonb_array_elements_text(value->'source_urls')),
  (value->>'reviewed_at')::date, value->'metadata'
from public.fixture_translation_input;

do $$
declare candidate jsonb; target uuid;
begin
  if (select count(*) from public.literary_work_translations)
    <> (select count(*) from public.fixture_translation_input) then
    raise exception 'The complete prepared translation set was not stored';
  end if;
  if (select count(*) from public.literary_work_translations where char_length(description) < 140) <> 89 then
    raise exception 'The 89 exact retained short drafts were not all stored';
  end if;
  if exists(select 1 from public.fixture_translation_input input
    join public.literary_work_translations stored
      on stored.work_id = md5(input.value->>'work_id')::uuid and stored.locale = input.value->>'locale'
    where stored.description is distinct from input.value->>'description'
      or stored.title is distinct from input.value->>'title'
      or stored.editorial_status is distinct from input.value->>'editorial_status'
      or stored.metadata is distinct from input.value->'metadata') then
    raise exception 'Storage rewrote exact input text or editorial metadata';
  end if;
  select value into candidate from public.fixture_translation_input where char_length(value->>'description') < 140 limit 1;
  perform public.fixture_insert_translation(candidate || jsonb_build_object('description', 'x'));
  perform public.fixture_reject_translation(candidate || jsonb_build_object('description', ''));
  perform public.fixture_reject_translation(candidate || jsonb_build_object('description', '   '));
  perform public.fixture_reject_translation(candidate || jsonb_build_object('description', E'\t'));
  perform public.fixture_reject_translation(candidate || jsonb_build_object('description', E'\n'));
  perform public.fixture_reject_translation(candidate || jsonb_build_object('description', E'\r\n'));
  perform public.fixture_reject_translation(candidate || jsonb_build_object('description', repeat('x', 901)));
  perform public.fixture_reject_translation(candidate || jsonb_build_object('editorial_status', 'reviewed', 'reviewed_at', '2026-09-14'));
  perform public.fixture_reject_translation(candidate || jsonb_build_object('editorial_status', 'verified', 'reviewed_at', '2026-09-14'));
  perform public.fixture_reject_translation(candidate || jsonb_build_object('reviewed_at', '2026-09-14'));
  -- Promotion must fail atomically: metadata/status cannot manufacture a valid review.
  select id into target from public.literary_work_translations where char_length(description) = 139 limit 1;
  begin
    update public.literary_work_translations set editorial_status = 'verified', reviewed_at = '2026-09-14' where id = target;
    raise exception 'Short draft promotion unexpectedly succeeded';
  exception when check_violation then null;
  end;
  if (select editorial_status <> 'draft' or reviewed_at is not null from public.literary_work_translations where id = target) then
    raise exception 'Failed promotion modified the prior draft';
  end if;
end;
$$;
create table public.fixture_before_replay as select * from public.literary_work_translations;
create table public.fixture_constraint_before_replay as
select oid, pg_get_constraintdef(oid, false) definition from pg_constraint
where conrelid='public.literary_work_translations'::regclass and conname='literary_work_translations_description_check';
-- __DRAFT_STORAGE_MIGRATION__
do $$
begin
  if exists(select * from public.fixture_before_replay except select * from public.literary_work_translations)
    or exists(select * from public.literary_work_translations except select * from public.fixture_before_replay) then
    raise exception 'Idempotent replay changed a stored row';
  end if;
  if not exists(select 1 from public.fixture_constraint_before_replay prior join pg_constraint current
    on current.oid=prior.oid and pg_get_constraintdef(current.oid,false)=prior.definition and current.convalidated) then
    raise exception 'Idempotent replay replaced or weakened the installed constraint';
  end if;
end;
$$;

-- Unknown and absent predecessor definitions must not be silently accepted.
do $negative_install$
declare migration text := -- __MIGRATION_LITERAL__
; rejected boolean; known_definition text; drift_definition text;
begin
  select definition into known_definition from public.fixture_constraint_before_replay;
  -- Altered string-literal bytes must never disappear during definition comparison.
  delete from public.literary_work_translations where char_length(description) < 140;
  drift_definition := replace(known_definition, quote_literal('draft') || '::text', quote_literal('draft ') || '::text');
  if drift_definition = known_definition then raise exception 'Drift fixture did not change the status literal'; end if;
  alter table public.literary_work_translations drop constraint literary_work_translations_description_check;
  execute 'alter table public.literary_work_translations add constraint literary_work_translations_description_check '
    || drift_definition;
  rejected := false;
  begin execute migration; exception when raise_exception then rejected := true; end;
  if not rejected then raise exception 'Changed draft-space literal was accepted'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.literary_work_translations'::regclass
    and conname='literary_work_translations_description_check' and convalidated
    and pg_get_constraintdef(oid,false)=drift_definition) then
    raise exception 'Rejected migration modified the changed status literal';
  end if;
  alter table public.literary_work_translations drop constraint literary_work_translations_description_check;
  execute 'alter table public.literary_work_translations add constraint literary_work_translations_description_check '
    || known_definition || ' not valid';
  rejected := false;
  begin execute migration; exception when raise_exception then rejected := true; end;
  if not rejected then raise exception 'Unvalidated target constraint was accepted'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.literary_work_translations'::regclass
    and conname='literary_work_translations_description_check' and not convalidated) then
    raise exception 'Rejected migration modified the unvalidated constraint';
  end if;
  alter table public.literary_work_translations drop constraint literary_work_translations_description_check;
  alter table public.literary_work_translations add constraint literary_work_translations_description_check check (description is not null);
  rejected := false;
  begin execute migration; exception when raise_exception then rejected := true; end;
  if not rejected then raise exception 'Unknown predecessor was accepted'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.literary_work_translations'::regclass
    and conname='literary_work_translations_description_check' and pg_get_constraintdef(oid,false)='CHECK ((description IS NOT NULL))') then
    raise exception 'Rejected migration modified the unknown constraint';
  end if;
  alter table public.literary_work_translations drop constraint literary_work_translations_description_check;
  rejected := false;
  begin execute migration; exception when raise_exception then rejected := true; end;
  if not rejected then raise exception 'Missing predecessor was accepted'; end if;
end;
$negative_install$;
select 'LITERARY_TRANSLATION_DRAFT_STORAGE_OK';
select jsonb_build_object('preparedTranslations', count(*), 'shortDrafts',
  count(*) filter(where char_length(value->>'description') < 140))::text from public.fixture_translation_input;
rollback;
