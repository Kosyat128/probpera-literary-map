-- Private review candidates for books/countries. This is not a job queue.
-- Existing canonical rows, publication policies and public-build triggers are
-- unchanged. Only explicit human promotion writes canonical English.
create schema if not exists premium_translation_private;
revoke all on schema premium_translation_private from public, anon, authenticated;

create table public.premium_translation_working_drafts (
  id uuid primary key default gen_random_uuid(),
  version bigint not null default 1 check (version between 1 and 9007199254740991),
  entity_type text not null check (entity_type in ('literary_work', 'country')),
  entity_id text not null check (char_length(entity_id) between 1 and 120),
  target_locale text not null default 'en' check (target_locale = 'en'),
  human_review text not null default 'pending' check (human_review = 'pending'),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  candidate_hash text not null check (candidate_hash ~ '^[a-f0-9]{64}$'),
  source_revision jsonb not null check (jsonb_typeof(source_revision) = 'object'),
  target_revision jsonb not null check (jsonb_typeof(target_revision) = 'object'),
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot) = 'object'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references auth.users(id) on delete restrict,
  unique (entity_type, entity_id, target_locale)
);
alter table public.premium_translation_working_drafts enable row level security;
alter table public.premium_translation_working_drafts force row level security;
-- No policies and no direct table grants: all access goes through the four
-- staff-checked RPCs. In particular no public content/outbox trigger exists.
revoke all on public.premium_translation_working_drafts from public, anon, authenticated;

create function premium_translation_private.assert_actor()
returns uuid language plpgsql security invoker set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not coalesce(public.is_staff(), false) then
    raise exception using errcode = '42501', message = 'Staff actor required';
  end if;
  return actor;
end;
$$;

create function premium_translation_private.assert_identity(kind text, identity text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if kind is null or kind not in ('literary_work','country') or identity is null
    or char_length(identity) not between 1 and 120
    or (kind = 'literary_work' and identity !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') then
    raise exception using errcode = '22023', message = 'Invalid candidate identity';
  end if;
end;
$$;

create function premium_translation_private.exact_object(value jsonb, keys text[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'object' and value ?& keys
    and (value - keys) = '{}'::jsonb, false);
$$;

create function premium_translation_private.string_array(value jsonb, max_items integer, max_length integer)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb;
begin
  if jsonb_typeof(value) is distinct from 'array' then return false; end if;
  if jsonb_array_length(value) > max_items then return false; end if;
  for item in select jsonb_array_elements(value) loop
    if jsonb_typeof(item) <> 'string' or char_length(item #>> '{}') > max_length then return false; end if;
  end loop;
  return true;
end;
$$;

create function premium_translation_private.valid_timestamp(value text)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if value is null or value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then return false; end if;
  perform value::timestamptz;
  return true;
exception when invalid_datetime_format or datetime_field_overflow then return false;
end;
$$;

create function premium_translation_private.valid_revision(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if not premium_translation_private.exact_object(value, array['id','updatedAt']) then return false; end if;
  if value->'id' = 'null'::jsonb then return value->'updatedAt' = 'null'::jsonb; end if;
  return coalesce(jsonb_typeof(value->'id') = 'string'
    and value->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and jsonb_typeof(value->'updatedAt') = 'string'
    and premium_translation_private.valid_timestamp(value->>'updatedAt'), false);
end;
$$;

-- ECMAScript String.trim whitespace, matching the existing Zod generators.
-- Used only for validation; candidate bytes and source snapshots stay intact.
create function premium_translation_private.trim_text(value text)
returns text language sql immutable set search_path = '' as $$
  select btrim(value, E' \t\n\r\f' || chr(11) || chr(160) || chr(5760)
    || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
    || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201)
    || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287)
    || chr(12288) || chr(65279));
$$;

create function premium_translation_private.valid_country_fields(value jsonb, translated boolean)
returns boolean language plpgsql immutable set search_path = '' as $$
declare key text; max_length integer; item jsonb;
begin
  if not premium_translation_private.exact_object(value, array['name','region','continent','officialLanguage','capital',
      'description','history','historicalNote','literaryPeriods','literaryMovements','periods','facts','literaryPlaces','timeline','chronology']) then return false; end if;
  foreach key in array array['name','region','continent','officialLanguage','capital','description','history','historicalNote'] loop
    max_length := case key when 'name' then 160 when 'region' then 160 when 'continent' then 160
      when 'officialLanguage' then 300 when 'capital' then 200 when 'history' then 8000 else 4000 end;
    if jsonb_typeof(value->key) <> 'string' or (translated and char_length(value->>key) > max_length) then return false; end if;
  end loop;
  if char_length(premium_translation_private.trim_text(value->>'name')) = 0 then return false; end if;
  foreach key in array array['literaryPeriods','literaryMovements','periods','facts','literaryPlaces'] loop
    if not premium_translation_private.string_array(value->key,
      case when translated then case when key in ('facts','literaryPlaces') then 80 else 40 end else 10000 end,
      case when translated then case key when 'facts' then 1000 when 'literaryPlaces' then 500 else 300 end else 100000 end)
      then return false; end if;
  end loop;
  foreach key in array array['timeline','chronology'] loop
    if jsonb_typeof(value->key) <> 'array' then return false; end if;
    if jsonb_array_length(value->key) > (case when translated then 100 else 10000 end) then return false; end if;
    for item in select jsonb_array_elements(value->key) loop
      if not premium_translation_private.exact_object(item,array['year','title','description'])
        or jsonb_typeof(item->'year') <> 'string' or jsonb_typeof(item->'title') <> 'string'
        or jsonb_typeof(item->'description') <> 'string' then return false; end if;
      if translated and (char_length(item->>'year') > 80 or char_length(item->>'title') > 500
        or char_length(item->>'description') > 2000) then return false; end if;
    end loop;
  end loop;
  if translated and exists(select 1 from unnest(string_to_array(value::text,null::text)) glyph
    where ascii(glyph) between 1024 and 1327 or ascii(glyph) between 7296 and 7311
      or ascii(glyph) between 11744 and 11775 or ascii(glyph) between 42560 and 42655
      or ascii(glyph) between 65070 and 65071 or ascii(glyph) between 122928 and 123023) then return false; end if;
  return true;
end;
$$;

create function premium_translation_private.assert_shape(kind text, snapshot jsonb, source_revision jsonb,
  target_revision jsonb, payload jsonb, provenance jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare key text; item jsonb; source_item jsonb; idx integer;
begin
  if not premium_translation_private.valid_revision(target_revision)
    or not premium_translation_private.exact_object(provenance,array['provider','translatorModel','reviewerModel',
      'translatorRequestId','reviewerRequestId','generatedAt']) then
    raise exception using errcode='22023', message='Invalid candidate shape';
  end if;
  if provenance->>'provider' not in ('cloudflare','openai') or jsonb_typeof(provenance->'provider') <> 'string'
    or jsonb_typeof(provenance->'translatorModel') <> 'string' or char_length(provenance->>'translatorModel') not between 1 and 300
    or jsonb_typeof(provenance->'generatedAt') <> 'string' or not premium_translation_private.valid_timestamp(provenance->>'generatedAt') then
    raise exception using errcode='22023', message='Invalid candidate provenance';
  end if;
  foreach key in array array['reviewerModel','translatorRequestId','reviewerRequestId'] loop
    if jsonb_typeof(provenance->key) not in ('string','null') or
      (key='reviewerModel' and jsonb_typeof(provenance->key)='string' and char_length(provenance->>key) not between 1 and 300) then
      raise exception using errcode='22023', message='Invalid candidate provenance';
    end if;
  end loop;
  if kind = 'literary_work' then
    if not premium_translation_private.exact_object(source_revision,array['workId','workUpdatedAt','russianId','russianUpdatedAt'])
      or not premium_translation_private.valid_revision(jsonb_build_object('id',source_revision->'workId','updatedAt',source_revision->'workUpdatedAt'))
      or not premium_translation_private.valid_revision(jsonb_build_object('id',source_revision->'russianId','updatedAt',source_revision->'russianUpdatedAt'))
      or source_revision->>'workId' is null or source_revision->>'russianId' is null or target_revision->>'id' is null
      or not premium_translation_private.exact_object(snapshot,array['russianTitle','verifiedEnglishTitle','verifiedEnglishTitleSourceUrl',
        'description','originalTitle','firstPublished','originalLanguage','sourceLanguage','sourceUrls'])
      or not premium_translation_private.exact_object(payload,array['description','sourceLanguage','sourceUrls','bibliographicTitle'])
      or not premium_translation_private.exact_object(payload->'bibliographicTitle',array['value','provider','sourceUrl','retrievedAt']) then
      raise exception using errcode='22023', message='Invalid book candidate shape';
    end if;
    foreach key in array array['russianTitle','verifiedEnglishTitle','verifiedEnglishTitleSourceUrl','description','originalTitle','originalLanguage','sourceLanguage'] loop
      if jsonb_typeof(snapshot->key) <> 'string' then raise exception using errcode='22023', message='Invalid book source shape'; end if;
    end loop;
    if jsonb_typeof(snapshot->'firstPublished') not in ('number','null')
      or not premium_translation_private.string_array(snapshot->'sourceUrls',10000,100000)
      or jsonb_typeof(payload->'description') <> 'string' or char_length(payload->>'description') not between 140 and 900
      or char_length(premium_translation_private.trim_text(payload->>'description')) not between 140 and 900
      or exists(select 1 from unnest(string_to_array(payload->>'description',null::text)) glyph
        where ascii(glyph) between 1024 and 1327 or ascii(glyph) between 7296 and 7311
          or ascii(glyph) between 11744 and 11775 or ascii(glyph) between 42560 and 42655
          or ascii(glyph) between 65070 and 65071 or ascii(glyph) between 122928 and 123023)
      or (select count(*) from regexp_matches(payload->>'description','[.!?:]+(?=\s|$)','g')) not between 2 and 3
      or payload->>'sourceLanguage' is distinct from 'Russian'
      or not premium_translation_private.string_array(payload->'sourceUrls',10000,100000) then
      raise exception using errcode='22023', message='Invalid book candidate content';
    end if;
    foreach key in array array['value','provider','sourceUrl'] loop
      if jsonb_typeof(payload->'bibliographicTitle'->key) <> 'string' or char_length(payload->'bibliographicTitle'->>key)=0 then
        raise exception using errcode='22023', message='Invalid title provenance';
      end if;
    end loop;
    if jsonb_typeof(payload#>'{bibliographicTitle,retrievedAt}') not in ('string','null') then
      raise exception using errcode='22023', message='Invalid title provenance';
    end if;
    for item in select jsonb_array_elements(payload->'sourceUrls') loop
      if item #>> '{}' !~ '^https://' then raise exception using errcode='22023', message='Invalid candidate source URL'; end if;
    end loop;
  else
    if not premium_translation_private.exact_object(source_revision,array['overrideId','overrideUpdatedAt','catalogSourceHash'])
      or not premium_translation_private.valid_revision(jsonb_build_object('id',source_revision->'overrideId','updatedAt',source_revision->'overrideUpdatedAt'))
      or jsonb_typeof(source_revision->'catalogSourceHash') <> 'string'
      or source_revision->>'catalogSourceHash' is null or source_revision->>'catalogSourceHash' !~ '^[a-f0-9]{64}$'
      or not premium_translation_private.valid_country_fields(snapshot,false)
      or not premium_translation_private.exact_object(payload,array['fields'])
      or not premium_translation_private.valid_country_fields(payload->'fields',true) then
      raise exception using errcode='22023', message='Invalid country candidate shape';
    end if;
    foreach key in array array['literaryPeriods','literaryMovements','periods','facts','literaryPlaces','timeline','chronology'] loop
      if jsonb_array_length(snapshot->key) <> jsonb_array_length(payload->'fields'->key) then
        raise exception using errcode='22023', message='Country candidate changed item count';
      end if;
      if key in ('timeline','chronology') then
        for idx in 0..jsonb_array_length(snapshot->key)-1 loop
          if snapshot->key->idx->'year' is distinct from payload->'fields'->key->idx->'year' then
            raise exception using errcode='22023', message='Country candidate changed year';
          end if;
        end loop;
      end if;
    end loop;
  end if;
end;
$$;

-- Locks and verifies live SQL state on BOTH stage and promotion. Country static
-- catalog content is application-owned: catalogSourceHash is an additional
-- trusted-app binding, not a claim that SQL can independently read TS catalogs.
create function premium_translation_private.assert_current(kind text, identity text, snapshot jsonb,
  source_revision jsonb, target_revision jsonb, payload jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare work public.literary_works%rowtype; ru public.literary_work_translations%rowtype;
  en public.literary_work_translations%rowtype; title_source public.literary_work_sources%rowtype;
  country public.country_profile_overrides%rowtype; current_source jsonb; urls jsonb;
begin
  if kind = 'literary_work' then
    select * into work from public.literary_works where id=identity::uuid for update;
    if not found or work.editorial_status not in ('reviewed','verified')
      or source_revision->>'workId' is distinct from identity
      or work.updated_at is distinct from (source_revision->>'workUpdatedAt')::timestamptz then
      raise exception using errcode='40001',message='Book source changed';
    end if;
    select * into ru from public.literary_work_translations where work_id=work.id and locale='ru' for update;
    if not found or ru.id is distinct from (source_revision->>'russianId')::uuid
      or ru.updated_at is distinct from (source_revision->>'russianUpdatedAt')::timestamptz
      or ru.editorial_status not in ('reviewed','verified') or cardinality(ru.source_urls)=0 then
      raise exception using errcode='40001',message='Russian source changed';
    end if;
    select * into en from public.literary_work_translations where work_id=work.id and locale='en' for update;
    if not found or en.id is distinct from (target_revision->>'id')::uuid
      or en.updated_at is distinct from (target_revision->>'updatedAt')::timestamptz
      or en.translation_method <> 'machine-translation'
      or btrim(en.title)='' or exists(select 1 from unnest(string_to_array(en.title,null::text)) glyph
        where ascii(glyph) between 1024 and 1327 or ascii(glyph) between 7296 and 7311
          or ascii(glyph) between 11744 and 11775 or ascii(glyph) between 42560 and 42655
          or ascii(glyph) between 65070 and 65071 or ascii(glyph) between 122928 and 123023)
      or en.metadata#>>'{premiumTranslation,bibliographicTitle,value}' is distinct from btrim(en.title)
      or en.metadata#>>'{premiumTranslation,bibliographicTitle,sourceUrl}' is distinct from snapshot->>'verifiedEnglishTitleSourceUrl'
      or not coalesce(snapshot->>'verifiedEnglishTitleSourceUrl'=any(en.source_urls),false) then
      raise exception using errcode='40001',message='English target or title ownership changed';
    end if;
    select * into title_source from public.literary_work_sources
      where work_id=work.id and source_url=snapshot->>'verifiedEnglishTitleSourceUrl'
        and provider=payload#>>'{bibliographicTitle,provider}' and 'title'=any(field_names)
      order by id limit 1 for share;
    if not found or jsonb_build_object('value',btrim(en.title),'provider',title_source.provider,
      'sourceUrl',title_source.source_url,'retrievedAt',title_source.retrieved_at) is distinct from payload->'bibliographicTitle' then
      raise exception using errcode='40001',message='Bibliographic title provenance changed';
    end if;
    current_source := jsonb_build_object('russianTitle',ru.title,'verifiedEnglishTitle',btrim(en.title),
      'verifiedEnglishTitleSourceUrl',title_source.source_url,'description',ru.description,
      'originalTitle',coalesce(work.original_title,''),'firstPublished',work.first_published,
      'originalLanguage',coalesce(work.original_language,''),'sourceLanguage',ru.source_language,'sourceUrls',ru.source_urls);
    if current_source is distinct from snapshot then raise exception using errcode='40001',message='Book source snapshot changed'; end if;
    -- Ordered JS Set union used by the existing helper, preserving source rights.
    select coalesce(jsonb_agg(url order by position),'[]'::jsonb) into urls from (
      select url,min(position) position from (
        select url,position from unnest(en.source_urls) with ordinality as english(url,position) where url ~ '^https://'
        union all select url,position+cardinality(en.source_urls) from unnest(ru.source_urls) with ordinality as russian(url,position)
      ) combined group by url
    ) unique_urls;
    if urls is distinct from payload->'sourceUrls' then raise exception using errcode='40001',message='Candidate source provenance changed'; end if;
  else
    if jsonb_build_object('id',source_revision->'overrideId','updatedAt',source_revision->'overrideUpdatedAt') is distinct from target_revision then
      raise exception using errcode='40001',message='Country source and target revisions differ';
    end if;
    select * into country from public.country_profile_overrides where country_id=identity for update;
    if found then
      if country.id is distinct from (target_revision->>'id')::uuid
        or country.updated_at is distinct from (target_revision->>'updatedAt')::timestamptz then
        raise exception using errcode='40001',message='Country override changed';
      end if;
      if country.fields ? 'translations' and jsonb_typeof(country.fields->'translations') <> 'object' then
        raise exception using errcode='40001',message='Country translation ownership is ambiguous';
      end if;
      if country.fields->'translations' ? 'en' and (
        country.fields#>>'{translations,en,locale}' is distinct from 'en'
        or country.fields#>>'{translations,en,method}' is distinct from 'machine-translation') then
        raise exception using errcode='40001',message='Manual country English is protected';
      end if;
    elsif target_revision->>'id' is not null then
      raise exception using errcode='40001',message='Country override disappeared';
    end if;
  end if;
end;
$$;

create function premium_translation_private.dto(candidate public.premium_translation_working_drafts)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',candidate.id,'version',candidate.version,'entityType',candidate.entity_type,'entityId',candidate.entity_id,
    'targetLocale',candidate.target_locale,'humanReview',candidate.human_review,'sourceHash',candidate.source_hash,'candidateHash',candidate.candidate_hash,
    'sourceRevision',candidate.source_revision,'targetRevision',candidate.target_revision,'sourceSnapshot',candidate.source_snapshot,
    'payload',candidate.payload,'provenance',candidate.provenance,'createdAt',candidate.created_at,'createdBy',candidate.created_by);
$$;

create function public.get_premium_translation_working_draft(p_entity_type text, p_entity_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare candidate public.premium_translation_working_drafts%rowtype;
begin
  perform premium_translation_private.assert_actor();
  perform premium_translation_private.assert_identity(p_entity_type,p_entity_id);
  select * into candidate from public.premium_translation_working_drafts
    where entity_type=p_entity_type and entity_id=p_entity_id and target_locale='en';
  return jsonb_build_object('schemaVersion',1,'entityType',p_entity_type,'entityId',p_entity_id,
    'draft',case when candidate.id is null then null else premium_translation_private.dto(candidate) end);
end;
$$;

create function public.stage_premium_translation_working_draft(p_entity_type text, p_entity_id text,
  p_source_hash text, p_source_snapshot jsonb, p_source_revision jsonb, p_target_revision jsonb,
  p_payload jsonb, p_provenance jsonb, p_expected_draft_id uuid, p_expected_draft_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; candidate public.premium_translation_working_drafts%rowtype; digest text;
begin
  actor := premium_translation_private.assert_actor();
  perform premium_translation_private.assert_identity(p_entity_type,p_entity_id);
  if p_expected_draft_id is not null or p_expected_draft_version is distinct from 0
    or p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='22023',message='Invalid initial candidate request';
  end if;
  perform premium_translation_private.assert_shape(p_entity_type,p_source_snapshot,p_source_revision,p_target_revision,p_payload,p_provenance);
  perform pg_advisory_xact_lock(hashtextextended('premium-translation:'||p_entity_type||':'||p_entity_id,0));
  if exists(select 1 from public.premium_translation_working_drafts where entity_type=p_entity_type and entity_id=p_entity_id and target_locale='en') then
    raise exception using errcode='40001',message='Pending candidate must be explicitly discarded';
  end if;
  perform premium_translation_private.assert_current(p_entity_type,p_entity_id,p_source_snapshot,p_source_revision,p_target_revision,p_payload);
  digest := encode(sha256(convert_to(jsonb_build_object('entityType',p_entity_type,'entityId',p_entity_id,'targetLocale','en',
    'sourceHash',p_source_hash,'sourceSnapshot',p_source_snapshot,'sourceRevision',p_source_revision,
    'targetRevision',p_target_revision,'payload',p_payload,'provenance',p_provenance)::text,'UTF8')),'hex');
  insert into public.premium_translation_working_drafts(entity_type,entity_id,source_hash,candidate_hash,source_snapshot,
    source_revision,target_revision,payload,provenance,created_by)
    values(p_entity_type,p_entity_id,p_source_hash,digest,p_source_snapshot,p_source_revision,p_target_revision,p_payload,p_provenance,actor)
    returning * into candidate;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(actor,'premium_translation.candidate.staged',p_entity_type,p_entity_id,
      jsonb_build_object('draftId',candidate.id,'version',candidate.version,'candidateHash',digest,'sourceHash',p_source_hash,'outcome','pending'));
  return jsonb_build_object('schemaVersion',1,'entityType',p_entity_type,'entityId',p_entity_id,'draft',premium_translation_private.dto(candidate));
exception when unique_violation then raise exception using errcode='40001',message='Candidate changed concurrently';
end;
$$;

create function public.promote_premium_translation_working_draft(p_entity_type text, p_entity_id text,
  p_draft_id uuid, p_expected_version bigint, p_candidate_hash text, p_source_hash text,
  p_catalog_source_hash text, p_catalog_source_fields jsonb, p_confirm_human_review boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; candidate public.premium_translation_working_drafts%rowtype; review_time timestamptz;
  canonical_id uuid; canonical_updated_at timestamptz; en public.literary_work_translations%rowtype;
  country public.country_profile_overrides%rowtype; human jsonb; meta jsonb; english jsonb; next_fields jsonb; translations jsonb;
  catalog_translations jsonb; protected_english jsonb;
begin
  actor := premium_translation_private.assert_actor();
  perform premium_translation_private.assert_identity(p_entity_type,p_entity_id);
  if p_confirm_human_review is distinct from true then raise exception using errcode='22023',message='Explicit human review is required'; end if;
  if (p_entity_type='literary_work' and p_catalog_source_fields is not null)
    or (p_entity_type='country' and (jsonb_typeof(p_catalog_source_fields) is distinct from 'object'
      or (p_catalog_source_fields ? 'translations' and jsonb_typeof(p_catalog_source_fields->'translations') is distinct from 'object'))) then
    raise exception using errcode='22023',message='Invalid current catalog shape';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('premium-translation:'||p_entity_type||':'||p_entity_id,0));
  select * into candidate from public.premium_translation_working_drafts
    where entity_type=p_entity_type and entity_id=p_entity_id and target_locale='en' for update;
  if not found or candidate.id is distinct from p_draft_id or candidate.version is distinct from p_expected_version
    or candidate.candidate_hash is distinct from p_candidate_hash or candidate.source_hash is distinct from p_source_hash
    or (p_entity_type='literary_work' and p_catalog_source_hash is not null)
    or (p_entity_type='country' and candidate.source_revision->>'catalogSourceHash' is distinct from p_catalog_source_hash) then
    raise exception using errcode='40001',message='Candidate or source changed';
  end if;
  perform premium_translation_private.assert_current(p_entity_type,p_entity_id,candidate.source_snapshot,
    candidate.source_revision,candidate.target_revision,candidate.payload);
  review_time := clock_timestamp();
  human := jsonb_build_object('status','approved','reviewedBy',actor,'reviewedAt',review_time);
  if p_entity_type='literary_work' then
    select * into en from public.literary_work_translations where id=(candidate.target_revision->>'id')::uuid;
    meta := case when jsonb_typeof(en.metadata)='object' then en.metadata else '{}'::jsonb end;
    meta := meta || jsonb_build_object('premiumTranslation',
      (case when jsonb_typeof(meta->'premiumTranslation')='object' then meta->'premiumTranslation' else '{}'::jsonb end)
      || jsonb_build_object('sourceHash',candidate.source_hash,'provider',candidate.provenance->'provider',
        'translatorModel',candidate.provenance->'translatorModel','reviewerModel',candidate.provenance->'reviewerModel',
        'translatorRequestId',candidate.provenance->'translatorRequestId','reviewerRequestId',candidate.provenance->'reviewerRequestId',
        'generatedAt',candidate.provenance->'generatedAt','bibliographicTitle',candidate.payload->'bibliographicTitle',
        'humanReview',human,'reviewedBy',actor,'reviewedAt',review_time));
    update public.literary_work_translations set description=candidate.payload->>'description',source_language='Russian',
      translation_method='machine-translation',editorial_status='reviewed',reviewed_at=review_time::date,
      source_urls=array(select jsonb_array_elements_text(candidate.payload->'sourceUrls')),metadata=meta
      where id=en.id returning id,updated_at into canonical_id,canonical_updated_at;
  else
    select * into country from public.country_profile_overrides where country_id=p_entity_id;
    next_fields := coalesce(country.fields,'{}'::jsonb);
    catalog_translations := case when jsonb_typeof(p_catalog_source_fields->'translations')='object'
      then p_catalog_source_fields->'translations' else '{}'::jsonb end;
    translations := case when next_fields ? 'translations' then next_fields->'translations' else catalog_translations end;
    if translations ? 'en' then protected_english := translations->'en';
    elsif catalog_translations ? 'en' then protected_english := catalog_translations->'en'; end if;
    if protected_english is not null and (protected_english->>'locale' is distinct from 'en'
      or protected_english->>'method' is distinct from 'machine-translation') then
      raise exception using errcode='40001',message='Manual catalog English is protected';
    end if;
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into meta from jsonb_each(candidate.payload->'fields')
      where value <> '""'::jsonb and value <> '[]'::jsonb;
    english := (case when jsonb_typeof(translations->'en')='object' then translations->'en' else '{}'::jsonb end)
      || jsonb_build_object('locale','en','status','reviewed','method','machine-translation','sourceHash',candidate.source_hash,
        'generatedAt',candidate.provenance->'generatedAt','provider',candidate.provenance->'provider',
        'model',candidate.provenance->'translatorModel','reviewerModel',candidate.provenance->'reviewerModel',
        'fields',meta,'humanReview',human,'reviewedBy',actor,'reviewedAt',review_time);
    next_fields := next_fields || jsonb_build_object('translations',translations || jsonb_build_object('en',english));
    if country.id is null then
      insert into public.country_profile_overrides(country_id,fields,updated_by)
        values(p_entity_id,next_fields,actor) returning id,updated_at into canonical_id,canonical_updated_at;
    else
      update public.country_profile_overrides set fields=next_fields,updated_by=actor
        where id=country.id returning id,updated_at into canonical_id,canonical_updated_at;
    end if;
  end if;
  delete from public.premium_translation_working_drafts where id=candidate.id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(actor,'premium_translation.candidate.promoted',p_entity_type,p_entity_id,
      jsonb_build_object('draftId',candidate.id,'version',candidate.version,'candidateHash',candidate.candidate_hash,
        'sourceHash',candidate.source_hash,'canonicalId',canonical_id,'outcome','promoted'));
  return jsonb_build_object('schemaVersion',1,'entityType',p_entity_type,'entityId',p_entity_id,'state','promoted',
    'draftId',candidate.id,'version',candidate.version,'candidateHash',candidate.candidate_hash,
    'canonicalId',canonical_id,'canonicalUpdatedAt',canonical_updated_at,'reviewedBy',actor,'reviewedAt',review_time);
exception when unique_violation then raise exception using errcode='40001',message='Canonical target changed concurrently';
end;
$$;

create function public.discard_premium_translation_working_draft(p_entity_type text, p_entity_id text,
  p_draft_id uuid, p_expected_version bigint, p_candidate_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; candidate public.premium_translation_working_drafts%rowtype;
begin
  actor := premium_translation_private.assert_actor();
  perform premium_translation_private.assert_identity(p_entity_type,p_entity_id);
  perform pg_advisory_xact_lock(hashtextextended('premium-translation:'||p_entity_type||':'||p_entity_id,0));
  select * into candidate from public.premium_translation_working_drafts
    where entity_type=p_entity_type and entity_id=p_entity_id and target_locale='en' for update;
  if not found or candidate.id is distinct from p_draft_id or candidate.version is distinct from p_expected_version
    or candidate.candidate_hash is distinct from p_candidate_hash then
    raise exception using errcode='40001',message='Candidate changed';
  end if;
  delete from public.premium_translation_working_drafts where id=candidate.id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(actor,'premium_translation.candidate.discarded',p_entity_type,p_entity_id,
      jsonb_build_object('draftId',candidate.id,'version',candidate.version,'candidateHash',candidate.candidate_hash,'outcome','discarded'));
  return jsonb_build_object('schemaVersion',1,'entityType',p_entity_type,'entityId',p_entity_id,'state','discarded',
    'draftId',candidate.id,'version',candidate.version,'candidateHash',candidate.candidate_hash);
end;
$$;

revoke all on all functions in schema premium_translation_private from public, anon, authenticated;
revoke all on function public.get_premium_translation_working_draft(text,text) from public, anon, authenticated;
revoke all on function public.stage_premium_translation_working_draft(text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,bigint) from public, anon, authenticated;
revoke all on function public.promote_premium_translation_working_draft(text,text,uuid,bigint,text,text,text,jsonb,boolean) from public, anon, authenticated;
revoke all on function public.discard_premium_translation_working_draft(text,text,uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.get_premium_translation_working_draft(text,text) to authenticated;
grant execute on function public.stage_premium_translation_working_draft(text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,bigint) to authenticated;
grant execute on function public.promote_premium_translation_working_draft(text,text,uuid,bigint,text,text,text,jsonb,boolean) to authenticated;
grant execute on function public.discard_premium_translation_working_draft(text,text,uuid,bigint,text) to authenticated;
