-- Private finite editorial dossiers. No draft, evidence or variant bank is public.
-- Requires the existing Evidence V2 SHA-256 helper; does not publish catalogue data.
create table if not exists public.book_dossiers (
  book_key text not null check (char_length(book_key) between 3 and 240),
  locale text not null check (locale in ('ru', 'en')),
  revision bigint not null check (revision > 0),
  record jsonb not null check (jsonb_typeof(record) = 'object' and octet_length(record::text) <= 500000),
  variant_bank jsonb check (variant_bank is null or octet_length(variant_bank::text) <= 2200000),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (book_key, locale)
);
alter table public.book_dossiers enable row level security;
revoke all on public.book_dossiers from public, anon, authenticated;
grant select on public.book_dossiers to authenticated;
create policy "Staff read private book dossiers" on public.book_dossiers for select to authenticated using (public.is_staff());

create or replace function public.book_dossier_draft_shape_valid(d jsonb)
returns boolean language plpgsql immutable strict set search_path = '' as $$
declare entry jsonb; item jsonb; field text;
begin
  if jsonb_typeof(d) is distinct from 'object' or not (d ?& array['schemaVersion','bookKey','locale','dossierVersion','title','writer','profile','tier','requiredLocales','translationReadyLocales','sections','blocks','sources','rights'])
    or d - array['schemaVersion','bookKey','locale','dossierVersion','title','writer','profile','tier','requiredLocales','translationReadyLocales','sections','blocks','sources','rights'] <> '{}'::jsonb
    or d->>'schemaVersion' is distinct from '2' or coalesce(d->>'locale','') not in ('ru','en') or coalesce(d->>'tier','') not in ('CORE','ENRICHED','SIGNATURE') then return false; end if;
  foreach field in array array['bookKey','locale','dossierVersion','title','writer','profile','tier'] loop
    if jsonb_typeof(d->field) is distinct from 'string' then return false; end if;
  end loop;
  foreach field in array array['requiredLocales','translationReadyLocales','sections','blocks','sources','rights'] loop
    if jsonb_typeof(d->field) is distinct from 'array' then return false; end if;
  end loop;
  if jsonb_array_length(d->'sections')>18 or jsonb_array_length(d->'blocks')>72 or jsonb_array_length(d->'sources')>24 or jsonb_array_length(d->'rights')>72 then return false; end if;
  for entry in select value from jsonb_array_elements(d->'sections') loop
    if not (entry ?& array['id','title','template','purpose','spoiler','blockIds']) or entry - array['id','title','template','purpose','spoiler','blockIds'] <> '{}'::jsonb or jsonb_typeof(entry->'blockIds') is distinct from 'array' then return false; end if;
    foreach field in array array['id','title','template','purpose','spoiler'] loop if jsonb_typeof(entry->field) is distinct from 'string' then return false; end if; end loop;
  end loop;
  for entry in select value from jsonb_array_elements(d->'blocks') loop
    if not (entry ?& array['id','sectionId','kind','title','paragraphs','items','sourceIds','rightsId','spoiler','readingModes']) or entry - array['id','sectionId','kind','title','paragraphs','items','sourceIds','rightsId','spoiler','readingModes','availableAfterItemId','translationId','articleReuse'] <> '{}'::jsonb then return false; end if;
    foreach field in array array['id','sectionId','kind','title','rightsId','spoiler'] loop if jsonb_typeof(entry->field) is distinct from 'string' then return false; end if; end loop;
    foreach field in array array['paragraphs','items','sourceIds','readingModes'] loop if jsonb_typeof(entry->field) is distinct from 'array' then return false; end if; end loop;
    for item in select value from jsonb_array_elements(entry->'items') loop
      if not (item ?& array['id','label','sourceIds','spoiler']) or item - array['id','label','value','text','href','sourceIds','spoiler','fromId','toId'] <> '{}'::jsonb or jsonb_typeof(item->'sourceIds') is distinct from 'array' then return false; end if;
      foreach field in array array['id','label','spoiler'] loop if jsonb_typeof(item->field) is distinct from 'string' then return false; end if; end loop;
    end loop;
  end loop;
  for entry in select value from jsonb_array_elements(d->'sources') loop
    if not (entry ?& array['id','provider','title','url','kind','reviewedAt','reviewedBy','attribution']) or entry - array['id','provider','title','url','kind','reviewedAt','reviewedBy','attribution'] <> '{}'::jsonb then return false; end if;
    foreach field in array array['id','provider','title','url','kind','attribution'] loop if jsonb_typeof(entry->field) is distinct from 'string' then return false; end if; end loop;
  end loop;
  for entry in select value from jsonb_array_elements(d->'rights') loop
    if not (entry ?& array['id','classification','contentType','author','rightsBasis','rightsHolder','sourceIds','territories','allowedSurfaces','allow3D','allowHTML','allowIndexing','allowDownload','allowOfflineCache','startsAt','expiresAt','revokedAt','recheckAt','attribution','evidenceIds','reviewedBy','reviewedAt','reviewKind','contentChecksum','originalWork','originalAuthor','sourceLanguage'])
      or entry - array['id','classification','contentType','author','rightsBasis','rightsHolder','sourceIds','territories','allowedSurfaces','allow3D','allowHTML','allowIndexing','allowDownload','allowOfflineCache','startsAt','expiresAt','revokedAt','recheckAt','attribution','evidenceIds','reviewedBy','reviewedAt','reviewKind','contentChecksum','originalWork','originalAuthor','sourceLanguage','translation'] <> '{}'::jsonb then return false; end if;
    foreach field in array array['id','classification','contentType','author','rightsBasis','rightsHolder','startsAt','recheckAt','attribution','reviewKind','contentChecksum','originalWork','originalAuthor','sourceLanguage'] loop if jsonb_typeof(entry->field) is distinct from 'string' then return false; end if; end loop;
    foreach field in array array['sourceIds','territories','allowedSurfaces','evidenceIds'] loop if jsonb_typeof(entry->field) is distinct from 'array' then return false; end if; end loop;
    foreach field in array array['allow3D','allowHTML','allowIndexing','allowDownload','allowOfflineCache'] loop if jsonb_typeof(entry->field) is distinct from 'boolean' then return false; end if; end loop;
  end loop;
  return true;
exception when others then return false;
end; $$;

-- Only already-public spoiler-free checkpoints can name a private reading prefix.
create or replace function public.book_dossier_public_progress_steps(draft jsonb)
returns jsonb language plpgsql immutable strict set search_path = '' as $$
declare block jsonb; step jsonb; checkpoint text; seen text[] := '{}'; result jsonb := '[]';
begin
  for block in select value from jsonb_array_elements(draft->'blocks') loop
    checkpoint := block->>'availableAfterItemId';
    if checkpoint is null or checkpoint=any(seen) then continue; end if;
    seen := array_append(seen,checkpoint);
    select jsonb_build_object('id',i->>'id','label',i->>'label') into step
      from jsonb_array_elements(draft->'blocks') b, jsonb_array_elements(b->'items') i,
        jsonb_array_elements(draft->'sections') s
      where s->>'id'=b->>'sectionId' and s->>'spoiler'='NONE' and b->>'spoiler'='NONE'
        and b->'readingModes' @> '["BEFORE_READING"]'::jsonb and not (b ? 'availableAfterItemId')
        and i->>'id'=checkpoint and i->>'spoiler'='NONE' and not (i ? 'fromId') and not (i ? 'toId') limit 1;
    if step is null or coalesce(step->>'label','')='' or jsonb_array_length(result)>=24 then exit; end if;
    result := result || jsonb_build_array(step);
  end loop;
  return result;
end; $$;

create or replace function public.book_dossier_design_proof_valid(proof jsonb, draft jsonb, checksum text)
returns boolean language plpgsql stable set search_path = '' as $$
declare progress text[]; expected text[]; entry jsonb; ordinal integer := 0; maximum integer;
begin
  if jsonb_typeof(proof) is distinct from 'object' or not (proof ?& array['version','contentChecksum','fontVersion','layoutVersion','measuredAt','method','variantPages'])
    or proof - array['version','contentChecksum','fontVersion','layoutVersion','measuredAt','method','variantPages'] <> '{}'::jsonb
    or proof->>'version' is distinct from 'book-dossier-design-v1' or proof->>'contentChecksum' is distinct from checksum
    or proof->>'fontVersion' is distinct from 'owner-book-typography-v2' or proof->>'layoutVersion' is distinct from 'book-inspection-layout-v3'
    or proof->>'method' is distinct from 'CANVAS_LOCAL_FONTS' or jsonb_typeof(proof->'measuredAt') is distinct from 'string'
    or (proof->>'measuredAt')::timestamptz>now() or jsonb_typeof(proof->'variantPages') is distinct from 'array' then return false; end if;
  select coalesce(array_agg(s->>'id' order by i),'{}'::text[]) into progress from jsonb_array_elements(public.book_dossier_public_progress_steps(draft)) with ordinality x(s,i);
  select array_agg(mode || '|' || spoiler || '|' || coalesce(array_to_string(progress[1:step],','),'') order by mode_index,spoiler_index,step) into expected
    from (values ('BEFORE_READING',1),('DURING_READING',2),('AFTER_READING',3)) m(mode,mode_index),
      (values ('NONE',1),('LIGHT',2),('MAJOR',3),('ENDING',4)) s(spoiler,spoiler_index),
      lateral generate_series(0,case when mode='DURING_READING' then cardinality(progress) else 0 end) step
    where mode<>'BEFORE_READING' or spoiler='NONE';
  maximum := case draft->>'tier' when 'CORE' then 7 when 'ENRICHED' then 12 when 'SIGNATURE' then 18 else 0 end;
  if jsonb_array_length(proof->'variantPages')<>cardinality(expected) then return false; end if;
  for entry in select value from jsonb_array_elements(proof->'variantPages') loop
    ordinal := ordinal+1;
    if not (entry ?& array['id','pageCount']) or entry - array['id','pageCount'] <> '{}'::jsonb or entry->>'id' is distinct from expected[ordinal]
      or jsonb_typeof(entry->'pageCount') is distinct from 'number' or (entry->>'pageCount')::integer not between 1 and maximum then return false; end if;
  end loop;
  return true;
exception when others then return false;
end; $$;

create or replace function public.book_dossier_canonical_json(p_value jsonb)
returns text language plpgsql immutable strict set search_path = '' as $$
declare result text;
begin
  if jsonb_typeof(p_value) = 'object' then
    select '{' || coalesce(string_agg(to_jsonb(key)::text || ':' || public.book_dossier_canonical_json(value), ',' order by key collate "C"), '') || '}' into result from jsonb_each(p_value);
  elsif jsonb_typeof(p_value) = 'array' then
    select '[' || coalesce(string_agg(public.book_dossier_canonical_json(value), ',' order by ordinal), '') || ']' into result from jsonb_array_elements(p_value) with ordinality a(value, ordinal);
  else result := p_value::text;
  end if;
  return result;
end; $$;

create or replace function public.book_dossier_content(p_draft jsonb)
returns jsonb language sql immutable strict set search_path = '' as $$
  select jsonb_set(jsonb_set(p_draft, '{sources}', coalesce((select jsonb_agg(s - 'reviewedBy' - 'reviewedAt') from jsonb_array_elements(p_draft->'sources') s), '[]'::jsonb)),
    '{rights}', coalesce((select jsonb_agg(case when g ? 'translation' then jsonb_set(g - 'reviewedBy' - 'reviewedAt' - 'reviewKind', '{translation}', (g->'translation') - 'reviewedBy' - 'reviewedAt') else g - 'reviewedBy' - 'reviewedAt' - 'reviewKind' end) from jsonb_array_elements(p_draft->'rights') g), '[]'::jsonb));
$$;

-- Defence in depth: public blocks must be exact subsets of reviewed source blocks.
-- Unknown keys and all hosted protected kinds are rejected, even for administrators.
create or replace function public.book_dossier_public_document_valid(p_document jsonb, p_draft jsonb)
returns boolean language plpgsql stable strict set search_path = '' as $$
declare page jsonb; block jsonb; source_block jsonb; item jsonb; source jsonb; source_row jsonb; section jsonb; ordinal integer := 0; grant_row jsonb;
begin
  if jsonb_typeof(p_document) is distinct from 'object' or not (p_document ?& array['schemaVersion','bookKey','locale','dossierVersion','profile','tier','themeVersion','pageDataVersion','cacheKey','contentMode','readingMode','validUntil','progressSteps','pages','contents'])
    or p_document->>'contentMode' is distinct from 'DOSSIER_ONLY' or p_document->>'schemaVersion' is distinct from '2'
    or p_document->>'bookKey' is distinct from p_draft->>'bookKey' or p_document->>'locale' is distinct from p_draft->>'locale'
    or p_document->>'dossierVersion' is distinct from p_draft->>'dossierVersion'
    or p_document->>'readingMode' not in ('BEFORE_READING','DURING_READING','AFTER_READING')
    or p_document - array['schemaVersion','bookKey','locale','dossierVersion','profile','tier','themeVersion','pageDataVersion','cacheKey','contentMode','readingMode','validUntil','progressSteps','pages','contents'] <> '{}'::jsonb
    or jsonb_typeof(p_document->'pages') is distinct from 'array' or jsonb_typeof(p_document->'contents') is distinct from 'array'
    or jsonb_array_length(p_document->'pages') not between 1 and 18 or p_document->'progressSteps' is distinct from public.book_dossier_public_progress_steps(p_draft) then return false; end if;
  for page in select value from jsonb_array_elements(p_document->'pages') loop
    select value into section from jsonb_array_elements(p_draft->'sections') where value->>'id' = page->>'id';
    if not (page ?& array['id','index','sectionId','template','anchor','eyebrow','title','rows','paragraphs','sources','blocks']) or section is null or page->>'title' is distinct from section->>'title' or page->>'sectionId' is distinct from section->>'id' or page->>'template' is distinct from section->>'template'
      or (page->>'index')::integer <> ordinal or page->'rows' <> '[]'::jsonb
      or page - array['id','index','sectionId','template','anchor','eyebrow','title','rows','paragraphs','sources','blocks'] <> '{}'::jsonb
      or jsonb_array_length(page->'blocks') not between 1 and 8 then return false; end if;
    ordinal := ordinal + 1;
    for block in select value from jsonb_array_elements(page->'blocks') loop
      select value into source_block from jsonb_array_elements(p_draft->'blocks') where value->>'id' = block->>'id';
      select value into grant_row from jsonb_array_elements(p_draft->'rights') where value->>'id' = source_block->>'rightsId';
      if not (block ?& array['id','sectionId','kind','title','paragraphs','items','sources','anchor']) or source_block is null or grant_row is null or block->>'kind' not in ('metadata','editorial','key-points','timeline','characters','relationships','themes','related-articles','sources','legal-links','colophon')
        or block - array['id','sectionId','kind','title','paragraphs','items','sources','anchor'] <> '{}'::jsonb
        or block->>'sectionId' is distinct from page->>'id' or block->>'kind' is distinct from source_block->>'kind'
        or block->>'title' is distinct from source_block->>'title' or block->'paragraphs' is distinct from source_block->'paragraphs'
        or grant_row->>'reviewKind' <> 'HUMAN' or grant_row->>'allowHTML' <> 'true' or grant_row->>'allow3D' <> 'true'
        or grant_row->>'classification' not in ('EDITORIAL_OWNED','FACTUAL_METADATA','EXTERNAL_LINK_ONLY')
        or grant_row->>'revokedAt' is not null or grant_row->>'allowDownload' <> 'false'
        or grant_row->>'contentChecksum' is distinct from public.literary_work_evidence_v2_sha256(public.book_dossier_canonical_json(source_block - 'rightsId')) then return false; end if;
      if block->'anchor' is distinct from jsonb_build_object('sectionId',page->>'id','blockId',block->>'id','dossierVersion',p_draft->>'dossierVersion','locale',p_draft->>'locale','readingMode',p_document->>'readingMode') then return false; end if;
      for item in select value from jsonb_array_elements(block->'items') loop
        if item - array['id','label','value','text','href','sourceIds','spoiler','fromId','toId'] <> '{}'::jsonb or not (source_block->'items' @> jsonb_build_array(item)) then return false; end if;
      end loop;
      for source in select value from jsonb_array_elements(block->'sources') loop
        select value into source_row from jsonb_array_elements(p_draft->'sources') where value->>'id' = source->>'id';
        if source_row is null or source - array['id','provider','title','sourceUrl','usageLabel','reviewedAt','attribution'] <> '{}'::jsonb
          or source->>'sourceUrl' is distinct from source_row->>'url' or source->>'provider' is distinct from source_row->>'provider'
          or source->>'title' is distinct from source_row->>'title' or source->>'attribution' is distinct from source_row->>'attribution' then return false; end if;
      end loop;
    end loop;
    if page->'paragraphs' is distinct from coalesce((select jsonb_agg(paragraph order by bi, pi) from jsonb_array_elements(page->'blocks') with ordinality b(value,bi), lateral jsonb_array_elements(b.value->'paragraphs') with ordinality p(paragraph,pi)), '[]'::jsonb)
      or page->'anchor' is distinct from page->'blocks'->0->'anchor'
      or exists(select 1 from jsonb_array_elements(page->'sources') s where not exists(select 1 from jsonb_array_elements(page->'blocks') b where b->'sources' @> jsonb_build_array(s))) then return false; end if;
  end loop;
  return p_document->'contents' = (select jsonb_agg(jsonb_build_object('id',p->>'id','title',p->>'title','anchor',p->'anchor')) from jsonb_array_elements(p_document->'pages') p);
exception when others then return false;
end; $$;

create or replace function public.save_book_dossier(p_record jsonb, p_variant_bank jsonb, p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); prior public.book_dossiers%rowtype; draft jsonb := p_record->'draft'; action text; event jsonb; review jsonb; stage text; stage_index integer; stages text[] := array['facts','rights','editorial','design','accessibility','final']; candidate jsonb; block jsonb; grant_row jsonb; expected text; deadline timestamptz; page jsonb; public_block jsonb; section jsonb; item jsonb; reveal_rank integer; spoiler_levels text[] := array['NONE','LIGHT','MAJOR','ENDING'];
begin
  if actor is null or not public.is_staff() then raise exception 'staff-required' using errcode='42501'; end if;
  if exists(select 1 from auth.mfa_factors where user_id=actor and status='verified') and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then raise exception 'mfa-required' using errcode='42501'; end if;
  if p_record is null or not (p_record ?& array['draft','status','revision','contentChecksum','reviews','audit']) or octet_length(p_record::text) > 500000 or p_record - array['draft','status','revision','contentChecksum','reviews','audit'] <> '{}'::jsonb then raise exception 'invalid-dossier-record'; end if;
  if public.book_dossier_draft_shape_valid(draft) is distinct from true or jsonb_typeof(p_record->'reviews') is distinct from 'array' or jsonb_typeof(p_record->'audit') is distinct from 'array'
    or jsonb_typeof(p_record->'status') is distinct from 'string' or jsonb_typeof(p_record->'revision') is distinct from 'number' or p_expected_revision is null then raise exception 'invalid-dossier-shape'; end if;
  if not exists(select 1 from public.literary_works where country_id=split_part(draft->>'bookKey',':',1) and writer_id=split_part(draft->>'bookKey',':',2) and legacy_id=split_part(draft->>'bookKey',':',3)) then raise exception 'canonical-work-required'; end if;
  select * into prior from public.book_dossiers where book_key=draft->>'bookKey' and locale=draft->>'locale' for update;
  if coalesce(prior.revision,0) <> p_expected_revision or (p_record->>'revision')::bigint <> p_expected_revision+1 then raise exception 'dossier-version-conflict' using errcode='40001'; end if;
  if jsonb_array_length(p_record->'audit') <> coalesce(jsonb_array_length(prior.record->'audit'),0)+1 or jsonb_array_length(p_record->'audit') > 256
    or ((p_record->'audit') - (jsonb_array_length(p_record->'audit')-1)) <> coalesce(prior.record->'audit','[]'::jsonb) then raise exception 'invalid-dossier-audit'; end if;
  event := p_record->'audit'->-1; action := event->>'action';
  -- Keep one final append-only audit slot available for immediate withdrawal.
  if jsonb_array_length(p_record->'audit')=256 and coalesce(action,'') not in ('REVOKE','ARCHIVE') then raise exception 'audit-slot-reserved-for-withdrawal'; end if;
  if not (event ?& array['id','actorId','at','action','reason','previousChecksum','contentChecksum']) or event - array['id','actorId','at','action','reason','previousChecksum','contentChecksum'] <> '{}'::jsonb
    or jsonb_typeof(event->'at') is distinct from 'string' or jsonb_typeof(event->'action') is distinct from 'string' then raise exception 'invalid-audit-event'; end if;
  if event->>'actorId' is distinct from actor::text or abs(extract(epoch from (now()-(event->>'at')::timestamptz))) > 300 then raise exception 'invalid-dossier-actor'; end if;
  expected := public.literary_work_evidence_v2_sha256(public.book_dossier_canonical_json(public.book_dossier_content(draft)));
  if p_record->>'contentChecksum' is distinct from expected or event->>'contentChecksum' is distinct from expected then raise exception 'dossier-checksum-mismatch'; end if;
  if action in ('CREATE','EDIT') then
    if (action='CREATE') <> (prior.revision is null) or p_record->'reviews' <> '[]'::jsonb or p_variant_bank is not null
      or p_record->>'status' <> (case when action='CREATE' then 'DRAFT' else 'RE_REVIEW_REQUIRED' end)
      or exists(select 1 from jsonb_array_elements(draft->'rights') g where g->>'reviewKind' <> 'UNREVIEWED' or g->>'reviewedBy' is not null or g->>'reviewedAt' is not null)
      or exists(select 1 from jsonb_array_elements(draft->'sources') s where s->>'reviewedBy' is not null or s->>'reviewedAt' is not null) then raise exception 'draft-cannot-self-approve'; end if;
  elsif action='REVIEW' then
    if prior.revision is null or prior.record->>'status' in ('PUBLISHED','BLOCKED','ARCHIVED') or public.book_dossier_content(draft) <> public.book_dossier_content(prior.record->'draft') or p_variant_bank is not null then raise exception 'review-content-changed'; end if;
    review := p_record->'reviews'->-1; stage := review->>'stage'; stage_index := array_position(stages,stage);
    if stage_index is null or review->>'actorId' is distinct from actor::text or review->>'actorKind' <> 'HUMAN' or review->>'contentChecksum' <> expected or review->>'reviewedAt' is distinct from event->>'at'
      or review->>'dossierVersion' is distinct from draft->>'dossierVersion' or review->>'decision' not in ('APPROVED','CHANGES_REQUIRED') then raise exception 'invalid-human-review'; end if;
    if stage in ('rights','final') and not public.is_staff(array['owner'::public.staff_role,'admin'::public.staff_role]) then raise exception 'owner-or-admin-required' using errcode='42501'; end if;
    if stage='design' and review->>'decision'='APPROVED' and public.book_dossier_design_proof_valid(review->'designProof',draft,expected) is distinct from true then raise exception 'measured-design-review-required'; end if;
    if (p_record->'reviews') - (jsonb_array_length(p_record->'reviews')-1) <> coalesce((select jsonb_agg(r) from jsonb_array_elements(prior.record->'reviews') r where array_position(stages,r->>'stage') < stage_index),'[]'::jsonb) then raise exception 'review-history-changed'; end if;
    if review->>'decision'='APPROVED' and (jsonb_array_length(p_record->'reviews') <> stage_index or exists(select 1 from jsonb_array_elements(p_record->'reviews') r where r->>'decision'<>'APPROVED' or r->>'contentChecksum'<>expected)) then raise exception 'previous-human-review-required'; end if;
    if p_record->>'status' <> (case when review->>'decision'='CHANGES_REQUIRED' then 'RE_REVIEW_REQUIRED' else (array['RIGHTS_REVIEW','EDITORIAL_REVIEW','DESIGN_REVIEW','ACCESSIBILITY_REVIEW','READY','READY'])[stage_index] end) then raise exception 'invalid-review-state'; end if;
  elsif action='PUBLISH' then
    if jsonb_typeof(p_variant_bank) is distinct from 'object' or not (p_variant_bank ?& array['schemaVersion','contentChecksum','validUntil','progressItemIds','variants']) or jsonb_typeof(p_variant_bank->'variants') is distinct from 'array' or jsonb_typeof(p_variant_bank->'validUntil') is distinct from 'string' or p_variant_bank->'progressItemIds' is distinct from coalesce((select jsonb_agg(s->'id') from jsonb_array_elements(public.book_dossier_public_progress_steps(draft)) s),'[]'::jsonb) then raise exception 'invalid-variant-bank'; end if;
    if not public.is_staff(array['owner'::public.staff_role,'admin'::public.staff_role]) or prior.record->>'status'<>'READY' or p_record->>'status'<>'PUBLISHED' or draft<>prior.record->'draft' or p_record->'reviews'<>prior.record->'reviews'
      or jsonb_array_length(p_record->'reviews')<>6 or p_variant_bank is null or p_variant_bank->>'contentChecksum'<>expected then raise exception 'publication-not-approved'; end if;
    for stage_index in 1..6 loop
      review := p_record->'reviews'->(stage_index-1);
      if review->>'stage'<>stages[stage_index] or review->>'decision'<>'APPROVED' or review->>'actorKind'<>'HUMAN' or review->>'contentChecksum'<>expected then raise exception 'human-review-required'; end if;
    end loop;
    if public.book_dossier_design_proof_valid(p_record->'reviews'->3->'designProof',draft,expected) is distinct from true then raise exception 'measured-design-review-required'; end if;
    if exists(select 1 from jsonb_array_elements(draft->'sources') s where s->>'reviewedBy' is distinct from p_record->'reviews'->0->>'actorId' or s->>'reviewedAt' is distinct from p_record->'reviews'->0->>'reviewedAt') then raise exception 'source-human-review-required'; end if;
    for grant_row in select value from jsonb_array_elements(draft->'rights') loop
      if grant_row->>'reviewedBy' is distinct from p_record->'reviews'->1->>'actorId' or grant_row->>'reviewedAt' is distinct from p_record->'reviews'->1->>'reviewedAt'
        or grant_row->>'reviewKind' is distinct from 'HUMAN' or grant_row->>'revokedAt' is not null or (grant_row->>'startsAt')::timestamptz>now()
        or (grant_row->>'recheckAt')::timestamptz<=now() or (grant_row->>'expiresAt')::timestamptz<=now()
        or not (grant_row->'territories' @> '["WORLDWIDE"]'::jsonb) or jsonb_array_length(grant_row->'evidenceIds')<1 then raise exception 'rights-not-current'; end if;
    end loop;
    select min(d) into deadline from jsonb_array_elements(draft->'rights') g, lateral (values ((g->>'recheckAt')::timestamptz),((g->>'expiresAt')::timestamptz)) v(d);
    if deadline<=now() or (p_variant_bank->>'validUntil')::timestamptz > deadline or jsonb_array_length(p_variant_bank->'variants') not between 9 and 105 then raise exception 'invalid-finite-delivery'; end if;
    for candidate in select value from jsonb_array_elements(p_variant_bank->'variants') loop
      if not public.book_dossier_public_document_valid(candidate->'document',draft) or candidate->>'mode' is distinct from candidate->'document'->>'readingMode' then raise exception 'invalid-public-projection'; end if;
      reveal_rank := array_position(spoiler_levels,candidate->>'revealSpoilers');
      if candidate->'reachedItemIds' is distinct from coalesce((select jsonb_agg(id order by i) from jsonb_array_elements(p_variant_bank->'progressItemIds') with ordinality x(id,i) where i<=jsonb_array_length(candidate->'reachedItemIds')),'[]'::jsonb)
        or candidate->>'mode'<>'DURING_READING' and candidate->'reachedItemIds'<>'[]'::jsonb then raise exception 'invalid-public-progress-prefix'; end if;
      if reveal_rank is null or jsonb_array_length(candidate->'reachedItemIds')>24 or candidate->>'mode'='BEFORE_READING' and candidate->>'revealSpoilers'<>'NONE' then raise exception 'invalid-reading-variant'; end if;
      for page in select value from jsonb_array_elements(candidate->'document'->'pages') loop
        select value into section from jsonb_array_elements(draft->'sections') where value->>'id'=page->>'id';
        if array_position(spoiler_levels,section->>'spoiler') is null or array_position(spoiler_levels,section->>'spoiler')>reveal_rank then raise exception 'hidden-section-in-public-payload'; end if;
        for public_block in select value from jsonb_array_elements(page->'blocks') loop
          select value into block from jsonb_array_elements(draft->'blocks') where value->>'id'=public_block->>'id';
          if array_position(spoiler_levels,block->>'spoiler') is null or array_position(spoiler_levels,block->>'spoiler')>reveal_rank
            or not (block->'readingModes' @> jsonb_build_array(candidate->>'mode'))
            or block ? 'availableAfterItemId' and not (candidate->>'mode'='AFTER_READING' or candidate->>'mode'='DURING_READING' and candidate->'reachedItemIds' @> jsonb_build_array(block->>'availableAfterItemId')) then raise exception 'hidden-block-in-public-payload'; end if;
          for item in select value from jsonb_array_elements(public_block->'items') loop
            if array_position(spoiler_levels,item->>'spoiler') is null or array_position(spoiler_levels,item->>'spoiler')>reveal_rank then raise exception 'hidden-item-in-public-payload'; end if;
          end loop;
        end loop;
      end loop;
      for block in select value from jsonb_array_elements(draft->'blocks') loop
        if block->>'kind' in ('quote','media','full-text') then raise exception 'hosted-protected-content-disabled'; end if;
        -- Source-block approvals are not yet present in the article CMS schema.
        if block ? 'articleReuse' then raise exception 'article-reuse-source-approval-unavailable'; end if;
      end loop;
    end loop;
  elsif action in ('REVOKE','ARCHIVE') then
    if not public.is_staff(array['owner'::public.staff_role,'admin'::public.staff_role]) or prior.revision is null or p_variant_bank is not null or p_record->'reviews'<>'[]'::jsonb
      or p_record->>'status'<>(case when action='REVOKE' then 'BLOCKED' else 'ARCHIVED' end) then raise exception 'invalid-withdrawal'; end if;
  else raise exception 'invalid-dossier-action'; end if;
  insert into public.book_dossiers(book_key,locale,revision,record,variant_bank,updated_by) values(draft->>'bookKey',draft->>'locale',p_expected_revision+1,p_record,p_variant_bank,actor)
    on conflict(book_key,locale) do update set revision=excluded.revision,record=excluded.record,variant_bank=excluded.variant_bank,updated_by=actor,updated_at=now()
      where public.book_dossiers.revision=p_expected_revision;
  if not found then raise exception 'dossier-version-conflict' using errcode='40001'; end if;
  return p_expected_revision+1;
end; $$;

-- POST only: the reading mode and personal progress remain in the request body.
create or replace function public.get_published_book_dossier(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare stored public.book_dossiers%rowtype; candidate jsonb; reached jsonb := coalesce(p_request->'reachedItemIds','[]'::jsonb); mode text := coalesce(p_request->>'mode','BEFORE_READING'); reveal text := coalesce(p_request->>'revealSpoilers','NONE');
begin
  perform set_config('response.headers','[{"Cache-Control":"private, no-store, max-age=0"}]',true);
  if coalesce(current_setting('request.method',true),'POST') <> 'POST' then return null; end if;
  if jsonb_typeof(p_request) is distinct from 'object' or not (p_request ?& array['bookKey','locale']) or jsonb_typeof(reached) is distinct from 'array'
    or p_request - array['bookKey','locale','mode','revealSpoilers','reachedItemIds'] <> '{}'::jsonb or mode not in ('BEFORE_READING','DURING_READING','AFTER_READING') or reveal not in ('NONE','LIGHT','MAJOR','ENDING') or jsonb_array_length(reached)>24 or mode<>'DURING_READING' and reached<>'[]'::jsonb or mode='BEFORE_READING' and reveal<>'NONE' then return null; end if;
  select * into stored from public.book_dossiers where book_key=p_request->>'bookKey' and locale=p_request->>'locale';
  if stored.revision is null or stored.record->>'status'<>'PUBLISHED' or stored.variant_bank is null or (stored.variant_bank->>'validUntil')::timestamptz<=now() then return null; end if;
  if reached is distinct from coalesce((select jsonb_agg(id order by i) from jsonb_array_elements(stored.variant_bank->'progressItemIds') with ordinality x(id,i) where i<=jsonb_array_length(reached)),'[]'::jsonb) then return null; end if;
  for candidate in select value from jsonb_array_elements(stored.variant_bank->'variants') loop
    if candidate->>'mode'=mode and candidate->>'revealSpoilers'=reveal and (candidate->'reachedItemIds') @> reached and reached @> (candidate->'reachedItemIds') and jsonb_array_length(candidate->'reachedItemIds')=jsonb_array_length(reached) then
      return jsonb_set(candidate->'document','{validUntil}',to_jsonb(to_char(least(now()+interval '60 seconds',(stored.variant_bank->>'validUntil')::timestamptz) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
    end if;
  end loop;
  return null;
exception when others then return null;
end; $$;

revoke all on function public.book_dossier_public_progress_steps(jsonb), public.book_dossier_design_proof_valid(jsonb,jsonb,text), public.book_dossier_draft_shape_valid(jsonb), public.book_dossier_canonical_json(jsonb), public.book_dossier_content(jsonb), public.book_dossier_public_document_valid(jsonb,jsonb), public.save_book_dossier(jsonb,jsonb,bigint), public.get_published_book_dossier(jsonb) from public, anon, authenticated;
grant execute on function public.save_book_dossier(jsonb,jsonb,bigint) to authenticated;
grant execute on function public.get_published_book_dossier(jsonb) to anon, authenticated;
