-- Extend the existing private review protocol to Site Copy. Staging does not
-- write canonical settings or request publication. Existing book/country/writer
-- branches, RPC signatures, table/RPC grants and RLS remain unchanged.
alter table public.premium_translation_working_drafts
  drop constraint premium_translation_working_drafts_entity_type_check,
  add constraint premium_translation_working_drafts_entity_type_check
    check (entity_type in ('literary_work','country','writer_biography','site_copy'));

create or replace function premium_translation_private.assert_identity(kind text, identity text)
returns void language plpgsql immutable set search_path = '' as $$
declare country_identity text; writer_identity text;
begin
  if kind='site_copy' then
    if identity is null or identity !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception using errcode='22023',message='Invalid candidate identity';
    end if;
    return;
  end if;
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

-- Match JavaScript/Zod maxima without altering source text: astral Unicode
-- characters occupy two UTF-16 code units, all other characters occupy one.
create function premium_translation_private.site_copy_utf16_length(value text)
returns integer language sql immutable strict set search_path='' as $$
  select char_length(value)+(select count(*)::integer
    from unnest(string_to_array(value,null::text)) glyph where ascii(glyph)>65535);
$$;

-- Full raw settings are the canonical binding. Selected item text/hash is the
-- trusted server/provider projection, not a claim that SQL reads the UI catalog.
create function premium_translation_private.assert_site_copy_shape(snapshot jsonb,
  source_revision jsonb, target_revision jsonb, payload jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare item jsonb; source_item jsonb; idx integer; keys text[] := array[]::text[]; item_key text;
begin
  if not premium_translation_private.exact_object(source_revision,array['blockId','blockUpdatedAt'])
    or not premium_translation_private.valid_revision(jsonb_build_object('id',source_revision->'blockId','updatedAt',source_revision->'blockUpdatedAt'))
    or source_revision->>'blockId' is null
    or jsonb_build_object('id',source_revision->'blockId','updatedAt',source_revision->'blockUpdatedAt') is distinct from target_revision
    or not premium_translation_private.exact_object(snapshot,array['settings','items'])
    or jsonb_typeof(snapshot->'settings') is distinct from 'object'
    or snapshot#>>'{settings,systemKey}' is distinct from 'site-copy-overrides'
    or jsonb_typeof(snapshot->'items') is distinct from 'array'
    or not premium_translation_private.exact_object(payload,array['items'])
    or jsonb_typeof(payload->'items') is distinct from 'array' then
    raise exception using errcode='22023',message='Invalid Site Copy candidate shape';
  end if;
  if jsonb_array_length(snapshot->'items') not between 1 and 50
    or jsonb_array_length(payload->'items') is distinct from jsonb_array_length(snapshot->'items') then
    raise exception using errcode='22023',message='Invalid Site Copy item count';
  end if;
  for idx in 0..jsonb_array_length(snapshot->'items')-1 loop
    source_item := snapshot->'items'->idx; item := payload->'items'->idx;
    if not premium_translation_private.exact_object(source_item,array['key','text','sourceHash'])
      or not premium_translation_private.exact_object(item,array['key','text'])
      or jsonb_typeof(source_item->'key') is distinct from 'string'
      or jsonb_typeof(source_item->'text') is distinct from 'string'
      or jsonb_typeof(source_item->'sourceHash') is distinct from 'string'
      or source_item->>'sourceHash' !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(item->'key') is distinct from 'string'
      or jsonb_typeof(item->'text') is distinct from 'string'
      or item->'key' is distinct from source_item->'key'
      or premium_translation_private.site_copy_utf16_length(source_item->>'text') not between 1 and 4000
      or char_length(premium_translation_private.trim_text(source_item->>'text'))=0
      or premium_translation_private.site_copy_utf16_length(item->>'text') not between 1 and 4000
      or char_length(premium_translation_private.trim_text(item->>'text'))=0 then
      raise exception using errcode='22023',message='Invalid Site Copy item shape';
    end if;
    item_key := source_item->>'key';
    if premium_translation_private.site_copy_utf16_length(item_key) not between 1 and 1200
      or item_key is distinct from premium_translation_private.trim_text(item_key)
      or item_key ~ '[[:cntrl:]]'
      or item_key ~* '(^|\.)(__proto__|prototype|constructor)(\.|$)'
      or item_key=any(keys)
      or exists(select 1 from unnest(string_to_array(item->>'text',null::text)) glyph
        where ascii(glyph) between 1024 and 1327 or ascii(glyph) between 7296 and 7311
          or ascii(glyph) between 11744 and 11775 or ascii(glyph) between 42560 and 42655
          or ascii(glyph) between 65070 and 65071 or ascii(glyph) between 122928 and 123023) then
      raise exception using errcode='22023',message='Invalid Site Copy key or English text';
    end if;
    keys := array_append(keys,item_key);
  end loop;
end;
$$;

-- Durable private provider output survives a concurrent canonical edit or
-- deletion. Validate the recorded source/ownership here; only promotion reloads
-- and locks the current singleton and enforces its full settings/CAS binding.
create function premium_translation_private.assert_site_copy_recorded(snapshot jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare copy jsonb; premium jsonb; machine jsonb; source_item jsonb; item_key text; marker jsonb;
begin
  copy := snapshot->'settings'->'siteCopy'; premium := snapshot->'settings'->'premiumTranslation';
  if jsonb_typeof(copy) is distinct from 'object'
    or jsonb_typeof(copy->'ru') is distinct from 'object'
    or (copy ? 'en' and copy->'en'<>'null'::jsonb and jsonb_typeof(copy->'en') is distinct from 'object')
    or (premium is not null and premium<>'null'::jsonb and jsonb_typeof(premium) is distinct from 'object') then
    raise exception using errcode='40001',message='Site Copy locale or metadata ownership is ambiguous';
  end if;
  machine := premium->'siteCopyEn';
  if machine is not null and machine<>'null'::jsonb and jsonb_typeof(machine) is distinct from 'object' then
    raise exception using errcode='40001',message='Site Copy machine metadata is malformed';
  end if;
  for source_item in select jsonb_array_elements(snapshot->'items') loop
    item_key := source_item->>'key'; marker := machine->item_key;
    if not (copy->'ru' ? item_key) or jsonb_typeof(copy->'ru'->item_key) is distinct from 'string'
      or char_length(premium_translation_private.trim_text(copy->'ru'->>item_key))=0 then
      raise exception using errcode='40001',message='Site Copy Russian key changed';
    end if;
    if (machine ? item_key) and jsonb_typeof(marker) is distinct from 'object' then
      raise exception using errcode='40001',message='Site Copy selected machine metadata is malformed';
    end if;
    if copy->'en' ? item_key and (jsonb_typeof(copy->'en'->item_key) is distinct from 'string'
      or jsonb_typeof(marker) is distinct from 'object'
      or jsonb_typeof(marker->'sourceHash') is distinct from 'string'
      or marker->>'sourceHash' !~ '^[a-f0-9]{64}$') then
      raise exception using errcode='40001',message='Manual or ambiguous Site Copy English is protected';
    end if;
  end loop;
end;
$$;

create function premium_translation_private.assert_site_copy_current(identity text,
  snapshot jsonb, source_revision jsonb, target_revision jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare block public.homepage_blocks%rowtype; singleton_count bigint; copy jsonb;
  premium jsonb; machine jsonb; source_item jsonb; item_key text; marker jsonb;
begin
  if (source_revision->>'blockId')::uuid is distinct from identity::uuid
    or jsonb_build_object('id',source_revision->'blockId','updatedAt',source_revision->'blockUpdatedAt') is distinct from target_revision then
    raise exception using errcode='40001',message='Site Copy source and target identities differ';
  end if;
  -- Same singleton boundary as save_site_copy_block. All candidate writers take
  -- their per-entity lock before this singleton lock and then the canonical row.
  perform pg_advisory_xact_lock(188654771, 2);
  select count(*) into singleton_count from public.homepage_blocks
    where settings @> '{"systemKey":"site-copy-overrides"}'::jsonb;
  if singleton_count<>1 then
    raise exception using errcode='40001',message='Site Copy master is missing or ambiguous';
  end if;
  select * into block from public.homepage_blocks where id=identity::uuid for update;
  if not found or block.settings#>>'{systemKey}' is distinct from 'site-copy-overrides'
    or block.updated_at is distinct from (target_revision->>'updatedAt')::timestamptz
    or block.settings is distinct from snapshot->'settings' then
    raise exception using errcode='40001',message='Site Copy settings or revision changed';
  end if;
  perform premium_translation_private.assert_site_copy_recorded(snapshot);
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
  if kind='site_copy' then
    perform premium_translation_private.assert_site_copy_shape(snapshot,source_revision,target_revision,payload);
    return;
  end if;
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
  if kind='site_copy' then
    perform premium_translation_private.assert_site_copy_current(identity,snapshot,source_revision,target_revision);
    return;
  end if;
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

create or replace function public.stage_premium_translation_working_draft(p_entity_type text, p_entity_id text,
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
  if p_entity_type='site_copy' then
    if p_source_revision->>'blockId' is distinct from p_entity_id or p_target_revision->>'id' is distinct from p_entity_id then
      raise exception using errcode='22023',message='Site Copy recorded identity differs';
    end if;
    perform premium_translation_private.assert_site_copy_recorded(p_source_snapshot);
  else
    perform premium_translation_private.assert_current(p_entity_type,p_entity_id,p_source_snapshot,p_source_revision,p_target_revision,p_payload);
  end if;
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

create or replace function public.promote_premium_translation_working_draft(p_entity_type text, p_entity_id text,
  p_draft_id uuid, p_expected_version bigint, p_candidate_hash text, p_source_hash text,
  p_catalog_source_hash text, p_catalog_source_fields jsonb, p_confirm_human_review boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; candidate public.premium_translation_working_drafts%rowtype; review_time timestamptz;
  canonical_id uuid; canonical_updated_at timestamptz; en public.literary_work_translations%rowtype;
  country public.country_profile_overrides%rowtype; human jsonb; meta jsonb; english jsonb; next_fields jsonb; translations jsonb;
  catalog_translations jsonb; protected_english jsonb; writer public.writer_profile_overrides%rowtype;
  block public.homepage_blocks%rowtype; item jsonb; source_item jsonb; item_key text; machine jsonb; item_meta jsonb; idx integer;
begin
  actor := premium_translation_private.assert_actor();
  perform premium_translation_private.assert_identity(p_entity_type,p_entity_id);
  if p_confirm_human_review is distinct from true then raise exception using errcode='22023',message='Explicit human review is required'; end if;
  if (p_entity_type='writer_biography' and jsonb_typeof(p_catalog_source_fields) is distinct from 'object')
    or (p_entity_type in ('literary_work','site_copy') and p_catalog_source_fields is not null)
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
    or (p_entity_type in ('literary_work','site_copy') and p_catalog_source_hash is not null)
    or (p_entity_type='country' and candidate.source_revision->>'catalogSourceHash' is distinct from p_catalog_source_hash) then
    raise exception using errcode='40001',message='Candidate or source changed';
  end if;
  perform premium_translation_private.assert_current(p_entity_type,p_entity_id,candidate.source_snapshot,
    candidate.source_revision,candidate.target_revision,candidate.payload);
  review_time := clock_timestamp();
  human := jsonb_build_object('status','approved','reviewedBy',actor,'reviewedAt',review_time);
  if p_entity_type='site_copy' then
    select * into block from public.homepage_blocks where id=p_entity_id::uuid;
    translations := block.settings->'siteCopy';
    english := case when jsonb_typeof(translations->'en')='object' then translations->'en' else '{}'::jsonb end;
    meta := case when jsonb_typeof(block.settings->'premiumTranslation')='object' then block.settings->'premiumTranslation' else '{}'::jsonb end;
    machine := case when jsonb_typeof(meta->'siteCopyEn')='object' then meta->'siteCopyEn' else '{}'::jsonb end;
    for idx in 0..jsonb_array_length(candidate.payload->'items')-1 loop
      item := candidate.payload->'items'->idx; source_item := candidate.source_snapshot->'items'->idx; item_key := item->>'key';
      item_meta := coalesce(machine->item_key,'{}'::jsonb)||jsonb_build_object('sourceHash',source_item->'sourceHash',
        'provider',candidate.provenance->'provider','model',candidate.provenance->'translatorModel',
        'reviewerModel',candidate.provenance->'reviewerModel','generatedAt',candidate.provenance->'generatedAt',
        'translatorRequestId',candidate.provenance->'translatorRequestId','reviewerRequestId',candidate.provenance->'reviewerRequestId',
        'humanReview',human,'reviewedBy',actor,'reviewedAt',review_time);
      machine := machine||jsonb_build_object(item_key,item_meta);
      english := english||jsonb_build_object(item_key,item->'text');
    end loop;
    next_fields := block.settings||jsonb_build_object('siteCopy',translations||jsonb_build_object('en',english),
      'premiumTranslation',meta||jsonb_build_object('siteCopyEn',machine));
    update public.homepage_blocks set settings=next_fields,updated_by=actor where id=block.id
      returning id,updated_at into canonical_id,canonical_updated_at;
  elsif p_entity_type='writer_biography' then
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

-- Read-only recovery discovery includes candidates whose canonical master was
-- deleted. Keyset paging exposes only identities, never private source/payload.
create function public.list_site_copy_premium_translation_working_drafts(
  p_after_id uuid default null, p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path='' as $$
declare identities jsonb; last_id uuid; has_more boolean;
begin
  perform premium_translation_private.assert_actor();
  if p_limit is null or p_limit not between 1 and 10 then
    raise exception using errcode='22023',message='Invalid Site Copy candidate page size';
  end if;
  with requested as (
    select id,entity_id from public.premium_translation_working_drafts
    where entity_type='site_copy' and (p_after_id is null or id>p_after_id)
    order by id limit p_limit+1
  ), visible as (
    select id,entity_id from requested order by id limit p_limit
  )
  select coalesce(jsonb_agg(entity_id order by id),'[]'::jsonb),
    (select id from visible order by id desc limit 1),
    (select count(*)>p_limit from requested)
    into identities,last_id,has_more from visible;
  return jsonb_build_object('schemaVersion',1,'entityIds',identities,
    'nextCursor',case when has_more then last_id else null end);
end;
$$;
revoke all on function public.list_site_copy_premium_translation_working_drafts(uuid,integer) from public,anon,authenticated;
grant execute on function public.list_site_copy_premium_translation_working_drafts(uuid,integer) to authenticated;


revoke all on function premium_translation_private.site_copy_utf16_length(text) from public,anon,authenticated;
revoke all on function premium_translation_private.assert_site_copy_shape(jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function premium_translation_private.assert_site_copy_recorded(jsonb) from public,anon,authenticated;
revoke all on function premium_translation_private.assert_site_copy_current(text,jsonb,jsonb,jsonb) from public,anon,authenticated;
