-- Additive measured-layout revision. The applied v2 migration and all dossier records remain unchanged.
-- Same local font bytes (owner-book-typography-v2); new pagination requires a fresh human design review.

create or replace function public.book_dossier_design_proof_valid(proof jsonb, draft jsonb, checksum text)
returns boolean language plpgsql stable set search_path = '' as $$
declare progress text[]; expected text[]; entry jsonb; ordinal integer := 0; maximum integer;
begin
  if jsonb_typeof(proof) is distinct from 'object' or not (proof ?& array['version','contentChecksum','fontVersion','layoutVersion','measuredAt','method','variantPages'])
    or proof - array['version','contentChecksum','fontVersion','layoutVersion','measuredAt','method','variantPages'] <> '{}'::jsonb
    or proof->>'version' is distinct from 'book-dossier-design-v1' or proof->>'contentChecksum' is distinct from checksum
    or proof->>'fontVersion' is distinct from 'owner-book-typography-v2' or proof->>'layoutVersion' is distinct from 'book-inspection-layout-v4'
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
  -- A layout revision invalidates the old measured approval without rewriting its history.
  if public.book_dossier_design_proof_valid(stored.record->'reviews'->3->'designProof', stored.record->'draft', stored.record->>'contentChecksum') is distinct from true then return null; end if;
  if reached is distinct from coalesce((select jsonb_agg(id order by i) from jsonb_array_elements(stored.variant_bank->'progressItemIds') with ordinality x(id,i) where i<=jsonb_array_length(reached)),'[]'::jsonb) then return null; end if;
  for candidate in select value from jsonb_array_elements(stored.variant_bank->'variants') loop
    if candidate->>'mode'=mode and candidate->>'revealSpoilers'=reveal and (candidate->'reachedItemIds') @> reached and reached @> (candidate->'reachedItemIds') and jsonb_array_length(candidate->'reachedItemIds')=jsonb_array_length(reached) then
      return jsonb_set(candidate->'document','{validUntil}',to_jsonb(to_char(least(now()+interval '60 seconds',(stored.variant_bank->>'validUntil')::timestamptz) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
    end if;
  end loop;
  return null;
exception when others then return null;
end; $$;

revoke all on function public.book_dossier_design_proof_valid(jsonb,jsonb,text) from public, anon, authenticated;
revoke all on function public.get_published_book_dossier(jsonb) from public, anon, authenticated;
grant execute on function public.get_published_book_dossier(jsonb) to anon, authenticated;
