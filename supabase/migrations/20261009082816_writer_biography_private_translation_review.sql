-- Extend the existing private review contract to writer biographies. No queue,
-- publication trigger or canonical row is created/changed by staging a candidate.
-- Earlier migrations and the book/country contracts remain unchanged.
alter table public.premium_translation_working_drafts
  drop constraint premium_translation_working_drafts_entity_type_check,
  add constraint premium_translation_working_drafts_entity_type_check
    check (entity_type in ('literary_work','country','writer_biography')),
  drop constraint premium_translation_working_drafts_entity_id_check,
  add constraint premium_translation_working_drafts_entity_id_check
    check (char_length(entity_id) between 1 and
      case when entity_type='writer_biography' then 301 else 120 end);

create or replace function premium_translation_private.assert_identity(kind text, identity text)
returns void language plpgsql immutable set search_path = '' as $$
declare country_identity text; writer_identity text;
begin
  if kind='writer_biography' then
    country_identity := split_part(identity,':',1);
    writer_identity := split_part(identity,':',2);
    if identity is null or char_length(identity)>301
      or identity is distinct from country_identity||':'||writer_identity
      or char_length(country_identity) not between 2 and 120
      or country_identity !~ '^[a-z0-9][a-z0-9_-]*$'
      or char_length(writer_identity) not between 2 and 180
      or writer_identity ~ '[[:space:][:cntrl:]/:]' then
      raise exception using errcode='22023',message='Invalid candidate identity';
    end if;
    return;
  end if;
  if kind is null or kind not in ('literary_work','country') or identity is null
    or char_length(identity) not between 1 and 120
    or (kind = 'literary_work' and identity !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') then
    raise exception using errcode = '22023', message = 'Invalid candidate identity';
  end if;
end;
$$;

-- Provider projection only. The complete raw source remains in russianProfile
-- and is copied unchanged at promotion, including rights and unknown metadata.
create function premium_translation_private.writer_source_projection(raw_sources jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare source jsonb; field jsonb; fields jsonb; projected jsonb; result jsonb := '[]'::jsonb;
  provider text; url text; usage text; retrieved text; key text;
begin
  if jsonb_typeof(raw_sources) is distinct from 'array' then return result; end if;
  for source in select jsonb_array_elements(raw_sources) loop
    if jsonb_typeof(source) is distinct from 'object' then continue; end if;
    provider := case when jsonb_typeof(source->'provider')='string' then premium_translation_private.trim_text(source->>'provider') else '' end;
    url := case when jsonb_typeof(source->'url')='string' then premium_translation_private.trim_text(source->>'url') else '' end;
    usage := case when jsonb_typeof(source->'usage')='string' then premium_translation_private.trim_text(source->>'usage') else '' end;
    retrieved := case when jsonb_typeof(source->'retrievedAt')='string' then premium_translation_private.trim_text(source->>'retrievedAt') else '' end;
    fields := '[]'::jsonb;
    if jsonb_typeof(source->'fields')='array' then
      for field in select jsonb_array_elements(source->'fields') loop
        if jsonb_typeof(field)='string' and premium_translation_private.trim_text(field#>>'{}') in
          ('identity','life-dates','biography-facts','awards','works') then
          fields := fields || jsonb_build_array(premium_translation_private.trim_text(field#>>'{}'));
        end if;
      end loop;
    end if;
    if provider='' or url !~* '^https://' or jsonb_array_length(fields)=0
      or usage not in ('structured-data','fact-check','licensed-copy') or retrieved='' then continue; end if;
    projected := jsonb_build_object('provider',provider,'url',url,'fields',fields,'usage',usage,'retrievedAt',retrieved);
    foreach key in array array['author','title','licenseName','licenseUrl'] loop
      if jsonb_typeof(source->key)='string' then projected := projected||jsonb_build_object(key,source->key); end if;
    end loop;
    result := result||jsonb_build_array(projected);
  end loop;
  return result;
end;
$$;

create function premium_translation_private.assert_writer_shape(snapshot jsonb, source_revision jsonb,
  target_revision jsonb, payload jsonb, provenance jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare russian jsonb;
begin
  if not premium_translation_private.exact_object(source_revision,
      array['countryId','writerId','overrideId','overrideUpdatedAt','catalogSourceHash','replaceEnglishTombstone'])
    or jsonb_typeof(source_revision->'countryId') is distinct from 'string'
    or jsonb_typeof(source_revision->'writerId') is distinct from 'string'
    or not premium_translation_private.valid_revision(jsonb_build_object('id',source_revision->'overrideId','updatedAt',source_revision->'overrideUpdatedAt'))
    or jsonb_typeof(source_revision->'catalogSourceHash') is distinct from 'string'
    or source_revision->>'catalogSourceHash' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(source_revision->'replaceEnglishTombstone') is distinct from 'boolean'
    or not premium_translation_private.exact_object(snapshot,array['writerName','text','sourceLanguage','sources','russianProfile','catalogFields'])
    or jsonb_typeof(snapshot->'writerName') is distinct from 'string'
    or jsonb_typeof(snapshot->'text') is distinct from 'string'
    or jsonb_typeof(snapshot->'sourceLanguage') is distinct from 'string'
    or jsonb_typeof(snapshot->'sources') is distinct from 'array'
    or jsonb_typeof(snapshot->'russianProfile') is distinct from 'object'
    or jsonb_typeof(snapshot->'catalogFields') is distinct from 'object'
    or not premium_translation_private.exact_object(payload,array['text'])
    or jsonb_typeof(payload->'text') is distinct from 'string'
    or char_length(payload->>'text') not between 120 and 1600
    or char_length(premium_translation_private.trim_text(payload->>'text')) not between 120 and 1600
    or jsonb_typeof(provenance->'reviewerModel') is distinct from 'string'
    or char_length(premium_translation_private.trim_text(provenance->>'reviewerModel')) not between 1 and 300 then
    raise exception using errcode='22023',message='Invalid writer candidate shape';
  end if;
  perform premium_translation_private.assert_identity('writer_biography',(source_revision->>'countryId')||':'||(source_revision->>'writerId'));
  russian := snapshot->'russianProfile';
  if russian->>'locale' is distinct from 'ru'
    or russian->>'method' is distinct from 'editorial-original'
    or coalesce(russian->>'status','') not in ('reviewed','verified')
    or jsonb_typeof(russian->'reviewedAt') is distinct from 'string' or russian->>'reviewedAt'=''
    or jsonb_typeof(russian->'text') is distinct from 'string'
    or jsonb_typeof(russian->'sourceLanguage') is distinct from 'string'
    or jsonb_typeof(russian->'sources') is distinct from 'array'
    or snapshot->>'text' is distinct from premium_translation_private.trim_text(russian->>'text')
    or snapshot->>'sourceLanguage' is distinct from premium_translation_private.trim_text(russian->>'sourceLanguage')
    or snapshot->'sources' is distinct from premium_translation_private.writer_source_projection(russian->'sources')
    or jsonb_array_length(snapshot->'sources')=0 then
    raise exception using errcode='22023',message='Invalid writer source provenance';
  end if;
end;
$$;

-- Catalog fields/hash are a trusted server reload binding, not a claim that SQL
-- can read the checked-in TypeScript catalog. SQL independently binds the live
-- override, its exact timestamp, the raw RU profile, and parent-map ownership.
create function premium_translation_private.assert_writer_current(identity text, snapshot jsonb,
  source_revision jsonb, target_revision jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare writer public.writer_profile_overrides%rowtype; effective jsonb; translations jsonb;
  raw_english jsonb; writer_name text; override_owned boolean;
begin
  if identity is distinct from (source_revision->>'countryId')||':'||(source_revision->>'writerId')
    or jsonb_build_object('id',source_revision->'overrideId','updatedAt',source_revision->'overrideUpdatedAt') is distinct from target_revision then
    raise exception using errcode='40001',message='Writer source and target identities differ';
  end if;
  select * into writer from public.writer_profile_overrides
    where country_id=source_revision->>'countryId' and writer_id=source_revision->>'writerId' for update;
  if found then
    if writer.id is distinct from (target_revision->>'id')::uuid
      or writer.updated_at is distinct from (target_revision->>'updatedAt')::timestamptz then
      raise exception using errcode='40001',message='Writer override changed';
    end if;
  elsif target_revision->>'id' is not null then
    raise exception using errcode='40001',message='Writer override disappeared';
  end if;
  effective := snapshot->'catalogFields'||coalesce(writer.fields,'{}'::jsonb);
  translations := effective->'biographyTranslations';
  if jsonb_typeof(translations) is distinct from 'object'
    or translations->'ru' is distinct from snapshot->'russianProfile' then
    raise exception using errcode='40001',message='Writer Russian source changed';
  end if;
  writer_name := coalesce(nullif(case when jsonb_typeof(effective->'fullName')='string'
      then premium_translation_private.trim_text(effective->>'fullName') end,''),
    nullif(case when jsonb_typeof(effective->'name')='string'
      then premium_translation_private.trim_text(effective->>'name') end,''),source_revision->>'writerId');
  if writer_name is distinct from snapshot->>'writerName' then
    raise exception using errcode='40001',message='Writer source identity changed';
  end if;
  override_owned := coalesce(writer.fields ? 'biographyTranslations',false);
  if override_owned and (not (translations ? 'en') or translations->'en'='null'::jsonb)
    and source_revision->'replaceEnglishTombstone' is distinct from 'true'::jsonb then
    raise exception using errcode='40001',message='Writer English tombstone is protected';
  end if;
  raw_english := translations->'en';
  if not override_owned and translations ? 'en' and raw_english='null'::jsonb then
    raise exception using errcode='40001',message='Ambiguous catalog writer English is protected';
  end if;
  if raw_english is not null and raw_english<>'null'::jsonb and
    (jsonb_typeof(raw_english) is distinct from 'object'
      or raw_english->>'locale' is distinct from 'en'
      or raw_english->>'method' is distinct from 'machine-translation'
      or jsonb_typeof(raw_english->'text') is distinct from 'string'
      or jsonb_typeof(raw_english->'sourceLanguage') is distinct from 'string'
      or coalesce(raw_english->>'status','') not in ('draft','reviewed','verified')
      or (raw_english ? 'translationMeta' and jsonb_typeof(raw_english->'translationMeta') is distinct from 'object')) then
    raise exception using errcode='40001',message='Manual or ambiguous writer English is protected';
  end if;
end;
$$;

create or replace function premium_translation_private.assert_shape(kind text, snapshot jsonb, source_revision jsonb,
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
  if kind='writer_biography' then
    perform premium_translation_private.assert_writer_shape(snapshot,source_revision,target_revision,payload,provenance);
    return;
  end if;
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

create or replace function premium_translation_private.assert_current(kind text, identity text, snapshot jsonb,
  source_revision jsonb, target_revision jsonb, payload jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare work public.literary_works%rowtype; ru public.literary_work_translations%rowtype;
  en public.literary_work_translations%rowtype; title_source public.literary_work_sources%rowtype;
  country public.country_profile_overrides%rowtype; current_source jsonb; urls jsonb;
begin
  if kind='writer_biography' then
    perform premium_translation_private.assert_writer_current(identity,snapshot,source_revision,target_revision);
    return;
  end if;
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

create or replace function public.promote_premium_translation_working_draft(p_entity_type text, p_entity_id text,
  p_draft_id uuid, p_expected_version bigint, p_candidate_hash text, p_source_hash text,
  p_catalog_source_hash text, p_catalog_source_fields jsonb, p_confirm_human_review boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; candidate public.premium_translation_working_drafts%rowtype; review_time timestamptz;
  canonical_id uuid; canonical_updated_at timestamptz; en public.literary_work_translations%rowtype;
  country public.country_profile_overrides%rowtype; human jsonb; meta jsonb; english jsonb; next_fields jsonb; translations jsonb;
  catalog_translations jsonb; protected_english jsonb; writer public.writer_profile_overrides%rowtype;
begin
  actor := premium_translation_private.assert_actor();
  perform premium_translation_private.assert_identity(p_entity_type,p_entity_id);
  if p_confirm_human_review is distinct from true then raise exception using errcode='22023',message='Explicit human review is required'; end if;
  if (p_entity_type='writer_biography' and jsonb_typeof(p_catalog_source_fields) is distinct from 'object')
    or (p_entity_type='literary_work' and p_catalog_source_fields is not null)
    or (p_entity_type='country' and (jsonb_typeof(p_catalog_source_fields) is distinct from 'object'
      or (p_catalog_source_fields ? 'translations' and jsonb_typeof(p_catalog_source_fields->'translations') is distinct from 'object'))) then
    raise exception using errcode='22023',message='Invalid current catalog shape';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('premium-translation:'||p_entity_type||':'||p_entity_id,0));
  select * into candidate from public.premium_translation_working_drafts
    where entity_type=p_entity_type and entity_id=p_entity_id and target_locale='en' for update;
  if not found or candidate.id is distinct from p_draft_id or candidate.version is distinct from p_expected_version
    or candidate.candidate_hash is distinct from p_candidate_hash or candidate.source_hash is distinct from p_source_hash
    or (p_entity_type='writer_biography' and (
      candidate.source_revision->>'catalogSourceHash' is distinct from p_catalog_source_hash
      or candidate.source_snapshot->'catalogFields' is distinct from p_catalog_source_fields))
    or (p_entity_type='literary_work' and p_catalog_source_hash is not null)
    or (p_entity_type='country' and candidate.source_revision->>'catalogSourceHash' is distinct from p_catalog_source_hash) then
    raise exception using errcode='40001',message='Candidate or source changed';
  end if;
  perform premium_translation_private.assert_current(p_entity_type,p_entity_id,candidate.source_snapshot,
    candidate.source_revision,candidate.target_revision,candidate.payload);
  review_time := clock_timestamp();
  human := jsonb_build_object('status','approved','reviewedBy',actor,'reviewedAt',review_time);
  if p_entity_type='writer_biography' then
    select * into writer from public.writer_profile_overrides
      where country_id=candidate.source_revision->>'countryId' and writer_id=candidate.source_revision->>'writerId';
    next_fields := coalesce(writer.fields,'{}'::jsonb);
    translations := case when next_fields ? 'biographyTranslations' then next_fields->'biographyTranslations'
      else p_catalog_source_fields->'biographyTranslations' end;
    english := case when jsonb_typeof(translations->'en')='object' then translations->'en' else '{}'::jsonb end;
    meta := case when jsonb_typeof(english->'translationMeta')='object' then english->'translationMeta' else '{}'::jsonb end;
    meta := meta||jsonb_build_object('provider',candidate.provenance->'provider','model',candidate.provenance->'translatorModel',
      'reviewerModel',candidate.provenance->'reviewerModel','sourceHash',candidate.source_hash,
      'generatedAt',candidate.provenance->'generatedAt','translatorRequestId',candidate.provenance->'translatorRequestId',
      'reviewerRequestId',candidate.provenance->'reviewerRequestId','humanReview',human,'reviewedBy',actor,'reviewedAt',review_time);
    english := english||jsonb_build_object('locale','en','text',candidate.payload->'text','sourceLanguage','Russian',
      'status','reviewed','method','machine-translation','reviewedAt',to_char(review_time at time zone 'UTC','YYYY-MM-DD'),
      'reviewer',actor::text,'translatedFromLocale','ru','sourceTextRights','project-original',
      'sources',candidate.source_snapshot#>'{russianProfile,sources}','translationMeta',meta);
    next_fields := next_fields||jsonb_build_object('biographyTranslations',translations||jsonb_build_object('en',english));
    if writer.id is null then
      insert into public.writer_profile_overrides(country_id,writer_id,fields,updated_by)
        values(candidate.source_revision->>'countryId',candidate.source_revision->>'writerId',next_fields,actor)
        returning id,updated_at into canonical_id,canonical_updated_at;
    else
      update public.writer_profile_overrides set fields=next_fields,updated_by=actor
        where id=writer.id returning id,updated_at into canonical_id,canonical_updated_at;
    end if;
  elsif p_entity_type='literary_work' then
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

-- New helpers are implementation details. Existing public RPC grants remain
-- unchanged; CREATE OR REPLACE retains them, and no new public endpoint is added.
revoke all on function premium_translation_private.writer_source_projection(jsonb) from public,anon,authenticated;
revoke all on function premium_translation_private.assert_writer_shape(jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function premium_translation_private.assert_writer_current(text,jsonb,jsonb,jsonb) from public,anon,authenticated;
