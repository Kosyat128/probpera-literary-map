-- Catalog provider admission reuses Translation Operations. This private table
-- is an artifact cache, not a queue: scheduling/status/attempts stay in the
-- existing public journal. Unknown dispatches never expire into a new request.
begin;

create table premium_translation_private.catalog_operation_artifacts (
  operation_id uuid primary key,
  job_id uuid not null unique references public.translation_jobs(id) on delete restrict deferrable initially deferred,
  item_id uuid not null unique references public.translation_job_items(id) on delete restrict deferrable initially deferred,
  actor_id uuid not null references auth.users(id) on delete restrict,
  entity_type text not null check(entity_type in ('literary_work','country')),
  entity_id text not null,
  begin_request_hash text not null,
  raw_seed_hash text not null,
  raw_seed jsonb not null check(jsonb_typeof(raw_seed)='object' and octet_length(raw_seed::text)<=4194304),
  linked_draft_id uuid unique,
  linked_draft_version bigint,
  candidate_hash text,
  provider text not null check(provider in ('openai','cloudflare')),
  source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
  intent_hash text not null check(intent_hash ~ '^[a-f0-9]{64}$'),
  configuration_hash text not null,
  configuration jsonb not null,
  source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object' and octet_length(source_snapshot::text)<=4194304),
  source_revision jsonb not null,
  target_revision jsonb not null,
  expected_state jsonb not null check(jsonb_typeof(expected_state)='object' and octet_length(expected_state::text)<=4194304),
  confirmed_cursor jsonb not null,
  calls jsonb not null default '[]'::jsonb check(jsonb_typeof(calls)='array' and jsonb_array_length(calls)<=4 and octet_length(calls::text)<=4194304),
  candidate jsonb check(candidate is null or (jsonb_typeof(candidate)='object' and octet_length(candidate::text)<=1048576)),
  final_receipt jsonb,
  finish_fingerprint text,
  job_write_proof jsonb not null,
  item_write_proof jsonb not null,
  attempt_write_proof jsonb,
  created_at timestamptz not null default clock_timestamp()
);
alter table premium_translation_private.catalog_operation_artifacts enable row level security;
alter table premium_translation_private.catalog_operation_artifacts force row level security;
revoke all on premium_translation_private.catalog_operation_artifacts from public,anon,authenticated,service_role;

create unique index translation_catalog_active_operation_unique
  on public.translation_job_items(entity_type,entity_id)
  where entity_type in ('literary_work','country') and staff_retry is not null;

create function premium_translation_private.catalog_operation_identity(k text,v text)
returns text language plpgsql immutable security invoker set search_path='' as $$
begin
  if k is null or k not in ('literary_work','country') then raise exception 'Unsupported catalog operation kind' using errcode='22023'; end if;
  perform premium_translation_private.assert_identity(k,v);
  if k='literary_work' then return v::uuid::text; end if;
  if v<>btrim(v) or v ~ '[[:cntrl:]]' then raise exception 'Invalid country identity' using errcode='22023'; end if;
  return v;
end; $$;

create function premium_translation_private.catalog_operation_cursor_valid(k text,v jsonb)
returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_typeof(v)='object' and v-(case k when 'literary_work' then 'libraryCursor' else 'countryCursor' end)='{}'::jsonb
   and (v='{}'::jsonb or (jsonb_typeof(v->(case k when 'literary_work' then 'libraryCursor' else 'countryCursor' end))='number'
     and v->>(case k when 'literary_work' then 'libraryCursor' else 'countryCursor' end) ~ '^[0-9]{1,9}$')),false);
$$;

-- Client projections are deliberately distinguished from full server rows.
-- Timestamp offsets are equivalent instants; every authored value is exact.
create function premium_translation_private.catalog_operation_projection(actual jsonb,expected jsonb,keys text[])
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare projection jsonb;
begin
  if not premium_translation_private.exact_object(expected,keys) then return false; end if;
  select jsonb_object_agg(key,value) into projection from jsonb_each(actual) where key=any(keys);
  return (projection-'updated_at')=(expected-'updated_at')
    and (projection->>'updated_at')::timestamptz is not distinct from (expected->>'updated_at')::timestamptz;
exception when others then return false;
end; $$;

create function premium_translation_private.catalog_operation_capture(k text,identity text,expected jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare w public.literary_works%rowtype; ru public.literary_work_translations%rowtype; en public.literary_work_translations%rowtype;
  c public.country_profile_overrides%rowtype; sources jsonb; selected uuid;
begin
  if k='literary_work' then
    select * into w from public.literary_works where id=identity::uuid for update;
    select * into ru from public.literary_work_translations where work_id=identity::uuid and locale='ru' for update;
    select * into en from public.literary_work_translations where work_id=identity::uuid and locale='en' for update;
    if w.id is null or ru.id is null or en.id is null then raise exception 'Book source disappeared' using errcode='40001'; end if;
    -- Parent FOR UPDATE also excludes new FK source inserts until transaction
    -- completion. Deterministic source locks exclude licence/update/delete races.
    perform 1 from public.literary_work_sources where work_id=w.id order by id for share;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) into sources from public.literary_work_sources s where work_id=w.id;
    select id into selected from public.literary_work_sources where work_id=w.id
      and provider=expected#>>'{titleSource,provider}' and source_url=expected#>>'{titleSource,source_url}'
      and retrieved_at=(expected#>>'{titleSource,retrieved_at}')::date and 'title'=any(field_names);
    if selected is null then raise exception 'Verified bibliographic source changed' using errcode='40001'; end if;
    return jsonb_build_object('version',1,'work',to_jsonb(w),'russian',to_jsonb(ru),'english',to_jsonb(en),'sources',sources,'selectedTitleSourceId',selected);
  end if;
  select * into c from public.country_profile_overrides where country_id=identity for update;
  return jsonb_build_object('version',1,'catalogFields',expected->'catalogFields','override',case when c.id is null then 'null'::jsonb else to_jsonb(c) end);
end; $$;

create function premium_translation_private.catalog_operation_expected_valid(k text,expected jsonb,seed jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare selected jsonb;
begin
  if expected->'version' is distinct from '1'::jsonb then return false; end if;
  if k='literary_work' then
    if not premium_translation_private.exact_object(expected,array['version','work','russian','english','titleSource'])
      or not premium_translation_private.exact_object(expected->'titleSource',array['provider','source_url','retrieved_at']) then return false; end if;
    select value into selected from jsonb_array_elements(seed->'sources') where value->>'id'=seed->>'selectedTitleSourceId';
    return premium_translation_private.catalog_operation_projection(seed->'work',expected->'work',array['id','title','original_title','first_published','original_language','editorial_status','updated_at'])
      and premium_translation_private.catalog_operation_projection(seed->'russian',expected->'russian',array['id','title','description','source_language','source_urls','editorial_status','updated_at','metadata'])
      and premium_translation_private.catalog_operation_projection(seed->'english',expected->'english',array['id','title','description','source_urls','translation_method','editorial_status','updated_at','metadata'])
      and jsonb_build_object('provider',selected->'provider','source_url',selected->'source_url','retrieved_at',selected->'retrieved_at')=expected->'titleSource';
  end if;
  if not premium_translation_private.exact_object(expected,array['version','catalogFields','override'])
    or jsonb_typeof(expected->'catalogFields') is distinct from 'object' or expected->'catalogFields' is distinct from seed->'catalogFields' then return false; end if;
  if seed->'override'='null'::jsonb then return expected->'override'='null'::jsonb; end if;
  return premium_translation_private.catalog_operation_projection(seed->'override',expected->'override',array['id','fields','updated_at']);
exception when others then return false;
end; $$;


create function premium_translation_private.catalog_operation_configuration_valid(k text,v jsonb,p text)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare key text;
begin
  if not premium_translation_private.exact_object(v,array['version','provider','model','reviewerModel','promptFingerprint',
    'translatorReasoningEffort','translatorReasoningMode','reviewerReasoningEffort','reviewerReasoningMode','schemaName','maxOutputTokens','twoPassReview'])
    or v->'version' is distinct from '1'::jsonb or v->>'provider' is distinct from p
    or v->>'schemaName' is distinct from (case k when 'literary_work' then 'probpera_literary_work_translation' else 'probpera_country_profile_translation' end)
    or v->'maxOutputTokens' is distinct from to_jsonb(case k when 'literary_work' then 4000 else 12000 end)
    or jsonb_typeof(v->'twoPassReview') is distinct from 'boolean'
    or jsonb_typeof(v->'promptFingerprint') is distinct from 'string' or v->>'promptFingerprint' !~ '^[a-f0-9]{64}$' or octet_length(v::text)>4096 then return false; end if;
  foreach key in array array['model','reviewerModel'] loop
    if jsonb_typeof(v->key) is distinct from 'string' or char_length(v->>key) not between 1 and 200 or v->>key ~ '[[:cntrl:]]' then return false; end if;
  end loop;
  foreach key in array array['translatorReasoningEffort','reviewerReasoningEffort'] loop
    if jsonb_typeof(v->key) is distinct from 'string' or v->>key not in ('none','low','medium','high','xhigh','max') then return false; end if;
  end loop;
  foreach key in array array['translatorReasoningMode','reviewerReasoningMode'] loop
    if jsonb_typeof(v->key) is distinct from 'string' or v->>key not in ('standard','pro') then return false; end if;
  end loop;
  return true;
end; $$;


create function premium_translation_private.catalog_operation_source_valid(k text,identity text,s jsonb,r jsonb,t jsonb,seed jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare w jsonb:=seed->'work'; ru jsonb:=seed->'russian'; en jsonb:=seed->'english'; selected jsonb;
  effective jsonb; translations jsonb; catalog_translations jsonb; protected jsonb; current_source jsonb;
begin
  if not premium_translation_private.valid_revision(t) or octet_length(s::text)>4194304 then return false; end if;
  if k='literary_work' then
    if not premium_translation_private.exact_object(r,array['workId','workUpdatedAt','russianId','russianUpdatedAt'])
      or not premium_translation_private.exact_object(s,array['russianTitle','verifiedEnglishTitle','verifiedEnglishTitleSourceUrl','description','originalTitle','firstPublished','originalLanguage','sourceLanguage','sourceUrls'])
      or r->>'workId' is distinct from identity or (w->>'id')::uuid is distinct from identity::uuid
      or (r->>'russianId')::uuid is distinct from (ru->>'id')::uuid or (t->>'id')::uuid is distinct from (en->>'id')::uuid
      or (r->>'workUpdatedAt')::timestamptz is distinct from (w->>'updated_at')::timestamptz
      or (r->>'russianUpdatedAt')::timestamptz is distinct from (ru->>'updated_at')::timestamptz
      or (t->>'updatedAt')::timestamptz is distinct from (en->>'updated_at')::timestamptz
      or w->>'editorial_status' not in ('reviewed','verified') or ru->>'editorial_status' not in ('reviewed','verified')
      or jsonb_array_length(ru->'source_urls')=0 or en->>'translation_method' is distinct from 'machine-translation' then return false; end if;
    select value into selected from jsonb_array_elements(seed->'sources') where value->>'id'=seed->>'selectedTitleSourceId';
    current_source:=jsonb_build_object('russianTitle',ru->'title','verifiedEnglishTitle',premium_translation_private.trim_text(en->>'title'),
      'verifiedEnglishTitleSourceUrl',selected->'source_url','description',ru->'description','originalTitle',coalesce(w->>'original_title',''),
      'firstPublished',w->'first_published','originalLanguage',coalesce(w->>'original_language',''),'sourceLanguage',ru->'source_language','sourceUrls',ru->'source_urls');
    return current_source=s and char_length(s->>'verifiedEnglishTitle')>0
      and not exists(select 1 from unnest(string_to_array(s->>'verifiedEnglishTitle',null::text)) glyph
        where ascii(glyph) between 1024 and 1327 or ascii(glyph) between 7296 and 7311 or ascii(glyph) between 11744 and 11775
          or ascii(glyph) between 42560 and 42655 or ascii(glyph) between 65070 and 65071 or ascii(glyph) between 122928 and 123023)
      and en#>>'{metadata,premiumTranslation,bibliographicTitle,value}'=s->>'verifiedEnglishTitle'
      and en#>>'{metadata,premiumTranslation,bibliographicTitle,sourceUrl}'=s->>'verifiedEnglishTitleSourceUrl'
      and en->'source_urls' ? (s->>'verifiedEnglishTitleSourceUrl') and selected->'field_names' ? 'title';
  end if;
  if not premium_translation_private.exact_object(r,array['overrideId','overrideUpdatedAt','catalogSourceHash'])
    or coalesce(r->>'catalogSourceHash','') !~ '^[a-f0-9]{64}$'
    or jsonb_build_object('id',r->'overrideId','updatedAt',r->'overrideUpdatedAt') is distinct from t
    or not premium_translation_private.valid_country_fields(s,false) or coalesce(s->>'name','')=''
    or (coalesce(s->>'description','')='' and coalesce(s->>'history','')='' and coalesce(s->>'historicalNote','')='') then return false; end if;
  if seed->'override'='null'::jsonb then
    if t->>'id' is not null then return false; end if;
  elsif (seed#>>'{override,id}')::uuid is distinct from (t->>'id')::uuid
    or (seed#>>'{override,updated_at}')::timestamptz is distinct from (t->>'updatedAt')::timestamptz then return false; end if;
  if (seed->'catalogFields' ? 'translations' and jsonb_typeof(seed#>'{catalogFields,translations}') is distinct from 'object')
    or (seed#>'{override,fields}' ? 'translations' and jsonb_typeof(seed#>'{override,fields,translations}') is distinct from 'object') then return false; end if;
  effective:=seed->'catalogFields'||coalesce(nullif(seed#>'{override,fields}','null'::jsonb),'{}'::jsonb);
  translations:=coalesce(effective->'translations','{}'::jsonb);catalog_translations:=coalesce(seed#>'{catalogFields,translations}','{}'::jsonb);
  protected:=case when translations ? 'en' then translations->'en' when catalog_translations ? 'en' then catalog_translations->'en' else null end;
  return protected is null or (protected->>'locale'='en' and protected->>'method'='machine-translation');
exception when others then return false;
end; $$;


create function premium_translation_private.catalog_operation_progress(c jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('version',1,'updatedAt',coalesce(nullif(c->(jsonb_array_length(c)-1)->'metadata'->'responseReceivedAt','null'::jsonb),
      c->(jsonb_array_length(c)-1)->'metadata'->'dispatchRecordedAt',to_jsonb('1970-01-01T00:00:00Z'::text)),
    'calls',coalesce(jsonb_agg(value->'metadata' order by n),'[]'::jsonb))
  from jsonb_array_elements(c) with ordinality x(value,n);
$$;

create function premium_translation_private.catalog_operation_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype; identity uuid;
begin
  if tg_table_name='translation_jobs' then
    identity:=case when tg_op='INSERT' then new.id else old.id end;
    select * into a from premium_translation_private.catalog_operation_artifacts where job_id=identity;
    if a.operation_id is null then return case when tg_op='DELETE' then old else new end; end if;
    if tg_op='DELETE' then raise exception 'Catalog operation journal cannot be deleted' using errcode='42501'; end if;
    if to_jsonb(new)=a.job_write_proof then return new; end if;
    -- Existing cancellation is monotonic. It stops further dispatch, but cannot
    -- erase an admission, change a cursor or turn an unknown response into retry.
    if tg_op='UPDATE' and auth.uid()=a.actor_id and public.is_staff()
      and new.cancel_requested_at is not null and (old.cancel_requested_at is null or new.cancel_requested_at=old.cancel_requested_at)
      and new.status in ('cancelling','cancelled') and new.version=old.version+1
      and (to_jsonb(new)-array['cancel_requested_at','status','version','updated_at','completed_at'])=
          (to_jsonb(old)-array['cancel_requested_at','status','version','updated_at','completed_at']) then return new; end if;
  elsif tg_table_name='translation_job_items' then
    identity:=case when tg_op='INSERT' then new.id else old.id end;
    select * into a from premium_translation_private.catalog_operation_artifacts where item_id=identity;
    if a.operation_id is null then
      if (tg_op<>'DELETE' and new.entity_type in ('literary_work','country') and new.staff_retry is not null)
        or (tg_op<>'INSERT' and old.entity_type in ('literary_work','country') and old.staff_retry is not null) then
        raise exception 'Catalog operation requires private admission proof' using errcode='42501'; end if;
      return case when tg_op='DELETE' then old else new end;
    end if;
    if tg_op='DELETE' then raise exception 'Catalog operation item cannot be deleted' using errcode='42501'; end if;
    if to_jsonb(new)=a.item_write_proof then return new; end if;
  else
    identity:=case when tg_op='INSERT' then new.item_id else old.item_id end;
    select * into a from premium_translation_private.catalog_operation_artifacts where item_id=identity;
    if a.operation_id is null then return case when tg_op='DELETE' then old else new end; end if;
    if tg_op='INSERT' and to_jsonb(new)=a.attempt_write_proof then return new; end if;
  end if;
  raise exception 'Catalog operation private journal proof differs' using errcode='42501';
end; $$;
create trigger translation_jobs_catalog_integrity before insert or update or delete on public.translation_jobs
  for each row execute function premium_translation_private.catalog_operation_guard();
create trigger translation_items_catalog_integrity before insert or update or delete on public.translation_job_items
  for each row execute function premium_translation_private.catalog_operation_guard();
create trigger translation_attempts_catalog_integrity before insert or update or delete on public.translation_job_attempts
  for each row execute function premium_translation_private.catalog_operation_guard();

create function premium_translation_private.catalog_operation_view(a premium_translation_private.catalog_operation_artifacts,
  replayed boolean default false,execute_allowed boolean default false,dispatch_allowed boolean default false)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare j public.translation_jobs%rowtype; pending text; reason text; phase text:='running';
begin
  select * into j from public.translation_jobs where id=a.job_id;
  select value->'metadata'->>'callId' into pending from jsonb_array_elements(a.calls) where value->'metadata'->'responseReceivedAt'='null'::jsonb limit 1;
  if a.final_receipt is not null then return a.final_receipt||jsonb_build_object('replayed',replayed,'canExecute',false,'canDispatch',false);
  elsif auth.uid() is distinct from a.actor_id then reason:='operation_owned_by_another_actor';phase:='blocked';
  elsif pending is not null and not dispatch_allowed then reason:='provider_outcome_unknown';phase:='blocked';
  elsif j.cancel_requested_at is not null then reason:='operation_stopped';phase:='blocked'; end if;
  return jsonb_build_object('version',1,'jobId',a.job_id,'itemId',a.item_id,'operationId',a.operation_id,'entityType',a.entity_type,'entityId',a.entity_id,
    'actorId',a.actor_id,'provider',a.provider,'sourceHash',a.source_hash,'intentHash',a.intent_hash,'rawSeedHash',a.raw_seed_hash,
    'configurationHash',a.configuration_hash,'configuration',a.configuration,'sourceRevision',a.source_revision,'targetRevision',a.target_revision,
    'jobVersion',j.version::text,'phase',phase,'canExecute',execute_allowed and reason is null,'canDispatch',dispatch_allowed,
    'replayed',replayed,'providerCalls',jsonb_array_length(a.calls),'pendingCallId',pending,'blockReason',reason,'resumeCursor',j.resume_cursor-'catalogOperation','result',null);
end; $$;


create function public.finish_catalog_translation_operation(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_outcome jsonb,p_candidate jsonb default null
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype; j public.translation_jobs%rowtype;
  i public.translation_job_items%rowtype; attempt public.translation_job_attempts%rowtype;
  draft public.premium_translation_working_drafts%rowtype; current_work jsonb; current_ru jsonb; current_sources jsonb; selected_source jsonb; urls jsonb; n integer;
  fingerprint text; digest text; status text; code text; state text; persistence text:='none'; result jsonb; receipt jsonb;
  first_call jsonb; last_call jsonb; stamp timestamptz:=clock_timestamp(); current_bound boolean:=true;
begin
  a:=premium_translation_private.catalog_operation_owned(p_job_id,p_item_id,p_operation_id);
  if p_outcome is null or jsonb_typeof(p_outcome)<>'object'
    or not(p_outcome ?& array['status','providerCalls'])
    or p_outcome-array['status','providerCalls','errorCode','model','requestId','inputTokens','outputTokens','durationMs']<>'{}'::jsonb
    or coalesce(p_outcome->>'status','') not in ('succeeded','dead_letter','conflict','stale','skipped','not-configured','cancelled')
    or jsonb_typeof(p_outcome->'providerCalls') is distinct from 'number'
    or p_outcome->>'providerCalls' !~ '^[0-4]$'
    or (p_outcome->>'providerCalls')::integer<>jsonb_array_length(a.calls)
    or (p_outcome->>'errorCode' is not null and p_outcome->>'errorCode' not in
      ('translation_not_configured','provider_unavailable','provider_request_failed','provider_invalid_response',
       'source_changed','write_conflict','database_read_failed','database_write_failed','unexpected','translation_operation_stopped')) then
    raise exception 'Invalid catalog finish outcome' using errcode='22023'; end if;
  fingerprint:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_outcome,p_candidate));
  if a.final_receipt is not null then
    if a.finish_fingerprint is distinct from fingerprint then raise exception 'Catalog finish intent differs' using errcode='40001'; end if;
    return premium_translation_private.catalog_operation_view(a,true);
  end if;
  if exists(select 1 from jsonb_array_elements(a.calls) value where value->'metadata'->'responseReceivedAt'='null'::jsonb) then
    raise exception 'Catalog provider outcome remains unknown' using errcode='40001'; end if;
  select * into j from public.translation_jobs where id=p_job_id for update;
  select * into i from public.translation_job_items where id=p_item_id for update;
  status:=p_outcome->>'status';code:=p_outcome->>'errorCode';
  if (status='succeeded') is distinct from (p_candidate is not null) then
    raise exception 'Catalog completed candidate required only for success' using errcode='22023'; end if;
  if p_candidate is not null then
    n:=jsonb_array_length(a.calls);
    if not premium_translation_private.exact_object(p_candidate,array['payload','provenance','translatorCallId','reviewerCallId'])
      or n<1 or octet_length(p_candidate::text)>1048576
      or (a.configuration->'twoPassReview'='true'::jsonb and not exists(select 1 from jsonb_array_elements(a.calls) value where value->'metadata'->>'pass'='review'))
      or (a.configuration->'twoPassReview'='false'::jsonb and (n>2 or exists(select 1 from jsonb_array_elements(a.calls) value where value->'metadata'->>'pass'='review'))) then
      raise exception 'Catalog independent review proof missing' using errcode='22023'; end if;
    first_call:=a.calls->0->'metadata';last_call:=a.calls->(jsonb_array_length(a.calls)-1)->'metadata';
    if p_candidate->>'translatorCallId' is distinct from first_call->>'callId'
      or p_candidate->>'reviewerCallId' is distinct from (case when n=1 then null else last_call->>'callId' end)
      or p_candidate->'provenance'->>'provider' is distinct from a.provider
      or p_candidate->'provenance'->>'translatorModel' is distinct from first_call->>'model'
      or p_candidate->'provenance'->>'reviewerModel' is distinct from (case when n=1 then null else last_call->>'model' end)
      or p_candidate->'provenance'->>'translatorRequestId' is distinct from coalesce(first_call->>'requestId',first_call->>'responseId')
      or p_candidate->'provenance'->>'reviewerRequestId' is distinct from (case when n=1 then null else coalesce(last_call->>'requestId',last_call->>'responseId') end) then
      raise exception 'Catalog candidate provider evidence differs' using errcode='40001'; end if;
    perform premium_translation_private.assert_shape(a.entity_type,a.source_snapshot,a.source_revision,a.target_revision,
      p_candidate->'payload',p_candidate->'provenance');
    if a.entity_type='literary_work' then
      select value into selected_source from jsonb_array_elements(a.raw_seed->'sources') where value->>'id'=a.raw_seed->>'selectedTitleSourceId';
      select coalesce(jsonb_agg(url order by position),'[]'::jsonb) into urls from (
        select url,min(position) position from (
          select value #>> '{}' url,position from jsonb_array_elements(a.raw_seed#>'{english,source_urls}') with ordinality e(value,position) where value #>> '{}' ~ '^https://'
          union all select value #>> '{}',position+jsonb_array_length(a.raw_seed#>'{english,source_urls}') from jsonb_array_elements(a.raw_seed#>'{russian,source_urls}') with ordinality r(value,position)
        ) combined group by url
      ) ordered_urls;
      if p_candidate->'payload'->'sourceUrls' is distinct from urls
        or p_candidate->'payload'->'bibliographicTitle' is distinct from jsonb_build_object('value',a.source_snapshot->'verifiedEnglishTitle',
          'provider',selected_source->'provider','sourceUrl',selected_source->'source_url','retrievedAt',selected_source->'retrieved_at') then
        raise exception 'Catalog recorded bibliography/source rights binding differs' using errcode='40001'; end if;
    end if;
    -- Promotion takes draft -> canonical row locks; use the same order.
    perform pg_advisory_xact_lock(hashtextextended('premium-translation:'||a.entity_type||':'||a.entity_id,0));
    select * into draft from public.premium_translation_working_drafts where entity_type=a.entity_type and entity_id=a.entity_id for update;
    begin
      perform premium_translation_private.catalog_operation_assert_current(a);
    exception when serialization_failure then current_bound:=false; end;
    if not current_bound then
      status:='conflict';code:='write_conflict';
      if a.entity_type='literary_work' then
        select to_jsonb(w) into current_work from public.literary_works w where id=a.entity_id::uuid;
        select to_jsonb(r) into current_ru from public.literary_work_translations r where work_id=a.entity_id::uuid and locale='ru';
        select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]'::jsonb) into current_sources from public.literary_work_sources s where work_id=a.entity_id::uuid;
        if current_work is distinct from a.raw_seed->'work' or current_ru is distinct from a.raw_seed->'russian'
          or current_sources is distinct from a.raw_seed->'sources' then status:='stale';code:='source_changed'; end if;
      end if;
    end if;
    digest:=probpera_translation_operations.retry_fingerprint(jsonb_build_object('entityType',a.entity_type,'entityId',a.entity_id,
      'targetLocale','en','sourceHash',a.source_hash,'sourceSnapshot',a.source_snapshot,'sourceRevision',a.source_revision,
      'targetRevision',a.target_revision,'payload',p_candidate->'payload','provenance',p_candidate->'provenance'));
    -- A fully validated body is retained independently of live CAS/cancel.
    -- Existing pending author/review work is never replaced.
    if draft.id is null then
      insert into public.premium_translation_working_drafts(entity_type,entity_id,source_hash,candidate_hash,source_snapshot,
        source_revision,target_revision,payload,provenance,created_by)
        values(a.entity_type,a.entity_id,a.source_hash,digest,a.source_snapshot,a.source_revision,a.target_revision,
          p_candidate->'payload',p_candidate->'provenance',a.actor_id) returning * into draft;
      persistence:='working-draft';
    elsif draft.candidate_hash=digest and draft.source_snapshot=a.source_snapshot and draft.source_revision=a.source_revision
      and draft.target_revision=a.target_revision and draft.payload=p_candidate->'payload' and draft.provenance=p_candidate->'provenance' then
      persistence:='working-draft';
    else
      persistence:='private-artifact';status:='conflict';code:='write_conflict';draft:=null;
    end if;
  end if;
  if j.cancel_requested_at is not null then status:='cancelled';code:=null; end if;
  if status in ('succeeded','skipped','cancelled') then code:=null;
  elsif code is null then code:=case status when 'stale' then 'source_changed' when 'conflict' then 'write_conflict'
    when 'not-configured' then 'translation_not_configured' else 'unexpected' end; end if;
  state:=case status when 'succeeded' then 'translated' when 'dead_letter' then 'failed' else status end;
  result:=jsonb_build_object('state',state,'errorCode',code,'persistence',persistence,
    'draftId',case when persistence='working-draft' then draft.id else null end,
    'draftVersion',case when persistence='working-draft' then draft.version else null end,
    'draftUpdatedAt',case when persistence='working-draft' then draft.created_at else null end,'candidateHash',digest,'publication','unchanged',
    'humanReview',case when p_candidate is null then 'unchanged' else 'pending' end);
  j.status:=case status when 'succeeded' then 'completed' when 'dead_letter' then 'failed' else status end;
  j.succeeded_items:=case when status='succeeded' then 1 else 0 end;j.failed_items:=case when status='dead_letter' then 1 else 0 end;
  j.version:=j.version+1;j.updated_at:=stamp;j.completed_at:=stamp;
  if not(status='skipped' and jsonb_array_length(a.calls)=0) then
    j.resume_cursor:=a.confirmed_cursor||jsonb_build_object('catalogOperation',j.resume_cursor->'catalogOperation');
  end if;
  receipt:=premium_translation_private.catalog_operation_view(a)||jsonb_build_object('phase','finished','blockReason',null,'pendingCallId',null,
    'canExecute',false,'canDispatch',false,'jobVersion',j.version::text,'resumeCursor',j.resume_cursor-'catalogOperation','result',result);
  i.status:=case status when 'succeeded' then 'succeeded' when 'cancelled' then 'cancelled' else status end;
  i.attempt_count:=1;i.staff_retry:=null;i.last_error_code:=code;i.updated_at:=stamp;
  attempt:=jsonb_populate_record(null::public.translation_job_attempts,jsonb_build_object(
    'id',nextval('public.translation_job_attempts_id_seq'),'item_id',p_item_id,'attempt_number',1,
    'outcome',case when status='cancelled' then 'skipped' else status end,'provider',a.provider,
    'model',p_outcome->'model','provider_request_id',p_outcome->'requestId','error_code',code,
    'input_tokens',p_outcome->'inputTokens','output_tokens',p_outcome->'outputTokens','duration_ms',p_outcome->'durationMs',
    'created_at',stamp,'staff_retry_operation_id',p_operation_id,'staff_retry_receipt',jsonb_build_object('version',1,
      'actorId',a.actor_id,'intentHash',a.intent_hash,'finishFingerprint',fingerprint,'receipt',receipt,
      'progress',premium_translation_private.catalog_operation_progress(a.calls))));
  if persistence='working-draft' then a.linked_draft_id:=draft.id;a.linked_draft_version:=draft.version; end if;
  a.candidate_hash:=digest;
  a.candidate:=p_candidate;a.final_receipt:=receipt;a.finish_fingerprint:=fingerprint;
  a.job_write_proof:=to_jsonb(j);a.item_write_proof:=to_jsonb(i);a.attempt_write_proof:=to_jsonb(attempt);
  update premium_translation_private.catalog_operation_artifacts set candidate=a.candidate,final_receipt=receipt,finish_fingerprint=fingerprint,
    linked_draft_id=a.linked_draft_id,linked_draft_version=a.linked_draft_version,candidate_hash=digest,
    job_write_proof=a.job_write_proof,item_write_proof=a.item_write_proof,attempt_write_proof=a.attempt_write_proof where operation_id=p_operation_id;
  insert into public.translation_job_attempts overriding system value select attempt.*;
  update public.translation_job_items set status=i.status,attempt_count=i.attempt_count,staff_retry=null,last_error_code=code,updated_at=stamp where id=p_item_id;
  update public.translation_jobs set status=j.status,succeeded_items=j.succeeded_items,failed_items=j.failed_items,version=j.version,
    updated_at=stamp,completed_at=stamp,resume_cursor=j.resume_cursor where id=p_job_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(a.actor_id,'translation.catalog_operation.finished','translation_job',p_job_id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'state',state,'persistence',persistence,'candidateHash',digest));
  return receipt;
end; $$;


create function public.reconcile_catalog_translation_operation(p_entity_type text,p_entity_id text,p_operation_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype; identity text;
begin
  perform premium_translation_private.assert_actor();identity:=premium_translation_private.catalog_operation_identity(p_entity_type,p_entity_id);
  perform pg_advisory_xact_lock(hashtextextended('catalog-operation:'||p_entity_type||':'||identity,7291));
  select cache.* into a from premium_translation_private.catalog_operation_artifacts cache join public.translation_job_items item on item.id=cache.item_id
    where cache.entity_type=p_entity_type and cache.entity_id=identity and (p_operation_id is null or cache.operation_id=p_operation_id)
    order by (item.staff_retry is not null) desc,cache.created_at desc,cache.operation_id desc limit 1;
  if a.operation_id is null then return null; end if;
  return premium_translation_private.catalog_operation_view(a,true);
end; $$;


create function public.get_catalog_translation_operation_artifacts(p_job_id uuid,p_item_id uuid,p_operation_id uuid,
  p_entity_type text,p_entity_id text,p_intent_hash text,p_source_hash text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype;
begin
  a:=premium_translation_private.catalog_operation_owned(p_job_id,p_item_id,p_operation_id);
  if a.entity_type is distinct from p_entity_type or a.entity_id is distinct from premium_translation_private.catalog_operation_identity(p_entity_type,p_entity_id)
    or a.intent_hash is distinct from p_intent_hash or a.source_hash is distinct from p_source_hash then
    raise exception 'Catalog private artifact binding differs' using errcode='40001'; end if;
  return jsonb_build_object('version',1,'receipt',premium_translation_private.catalog_operation_view(a,true),'expectedState',a.expected_state,'rawSeed',a.raw_seed,
    'sourceSnapshot',a.source_snapshot,'sourceRevision',a.source_revision,'targetRevision',a.target_revision,'configuration',a.configuration,'calls',a.calls,'candidate',a.candidate);
end; $$;




create function premium_translation_private.catalog_operation_owned(p_job uuid,p_item uuid,p_operation uuid)
returns premium_translation_private.catalog_operation_artifacts language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype;
begin
  perform premium_translation_private.assert_actor();
  select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=p_operation for update;
  if a.operation_id is null then raise exception 'Catalog operation not found' using errcode='P0002'; end if;
  if a.actor_id is distinct from auth.uid() then raise exception 'Catalog operation actor differs' using errcode='42501'; end if;
  if a.job_id is distinct from p_job or a.item_id is distinct from p_item or a.entity_type not in ('literary_work','country') then
    raise exception 'Catalog operation identity differs' using errcode='40001'; end if;
  return a;
end; $$;


create function premium_translation_private.catalog_operation_assert_current(a premium_translation_private.catalog_operation_artifacts)
returns void language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare current_seed jsonb;
begin
  current_seed:=premium_translation_private.catalog_operation_capture(a.entity_type,a.entity_id,a.expected_state);
  if current_seed is distinct from a.raw_seed then raise exception 'Catalog full source/target seed changed' using errcode='40001'; end if;
  if premium_translation_private.catalog_operation_source_valid(a.entity_type,a.entity_id,a.source_snapshot,a.source_revision,a.target_revision,current_seed) is distinct from true then
    raise exception 'Catalog source eligibility or English ownership changed' using errcode='40001'; end if;
end; $$;


create function public.catalog_translation_operation_ready()
returns boolean language plpgsql stable security definer set search_path='' as $$
declare signature text; routine regprocedure;
begin
  perform premium_translation_private.assert_actor();
  foreach signature in array array[
    'public.begin_catalog_translation_operation(uuid,uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'public.record_catalog_translation_operation_dispatch(uuid,uuid,uuid,uuid,text,text,text,text)',
    'public.record_catalog_translation_operation_response(uuid,uuid,uuid,jsonb,jsonb)',
    'public.finish_catalog_translation_operation(uuid,uuid,uuid,jsonb,jsonb)',
    'public.reconcile_catalog_translation_operation(text,text,uuid)',
    'public.get_catalog_translation_operation_artifacts(uuid,uuid,uuid,text,text,text,text)'] loop
    routine:=to_regprocedure(signature);
    if routine is null or not has_function_privilege('authenticated',routine,'EXECUTE') then return false; end if;
  end loop;
  return to_regclass('premium_translation_private.catalog_operation_artifacts') is not null
    and to_regprocedure('premium_translation_private.assert_catalog_operation_promotion_current(public.premium_translation_working_drafts,text,jsonb)') is not null
    and exists(select 1 from pg_index where indexrelid=to_regclass('public.translation_catalog_active_operation_unique') and indisunique and indisvalid and indpred is not null)
    and (select count(*)=3 from pg_trigger where not tgisinternal and tgenabled='O'
      and tgfoid=to_regprocedure('premium_translation_private.catalog_operation_guard()')
      and tgname in ('translation_jobs_catalog_integrity','translation_items_catalog_integrity','translation_attempts_catalog_integrity'));
end; $$;


create function public.begin_catalog_translation_operation(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_entity_type text,p_entity_id text,p_provider text,p_source_hash text,
  p_source_snapshot jsonb,p_source_revision jsonb,p_target_revision jsonb,p_expected_state jsonb,p_configuration jsonb,
  p_current_cursor jsonb default '{}'::jsonb,p_resume_cursor jsonb default '{}'::jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=premium_translation_private.assert_actor(); a premium_translation_private.catalog_operation_artifacts%rowtype;
  j public.translation_jobs%rowtype; i public.translation_job_items%rowtype; identity text; request_hash text; marker jsonb; view jsonb;
  stamp timestamptz:=clock_timestamp();
begin
  identity:=premium_translation_private.catalog_operation_identity(p_entity_type,p_entity_id);
  if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
    or not probpera_translation_operations.retry_uuid(p_operation_id) or p_provider is null or p_provider not in ('openai','cloudflare')
    or p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_expected_state) is distinct from 'object' or octet_length(p_expected_state::text)>4194304
    or premium_translation_private.catalog_operation_configuration_valid(p_entity_type,p_configuration,p_provider) is distinct from true
    or premium_translation_private.catalog_operation_cursor_valid(p_entity_type,p_current_cursor) is distinct from true
    or premium_translation_private.catalog_operation_cursor_valid(p_entity_type,p_resume_cursor) is distinct from true then
    raise exception 'Invalid catalog operation admission' using errcode='22023'; end if;
  request_hash:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_job_id,p_item_id,p_operation_id,actor,p_entity_type,identity,
    p_provider,p_source_hash,p_source_snapshot,p_source_revision,p_target_revision,p_expected_state,p_configuration,p_current_cursor,p_resume_cursor));
  perform pg_advisory_xact_lock(hashtextextended('catalog-operation:'||p_entity_type||':'||identity,7291));
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,7292));
  select * into a from premium_translation_private.catalog_operation_artifacts where operation_id=p_operation_id for update;
  if a.operation_id is not null then
    if a.actor_id is distinct from actor then raise exception 'Catalog operation actor differs' using errcode='42501'; end if;
    if a.begin_request_hash is distinct from request_hash then raise exception 'Catalog begin intent differs' using errcode='40001'; end if;
    return premium_translation_private.catalog_operation_view(a,true);
  end if;
  select cache.* into a from premium_translation_private.catalog_operation_artifacts cache
    join public.translation_job_items item on item.id=cache.item_id
    where cache.entity_type=p_entity_type and cache.entity_id=identity and item.staff_retry is not null for update of cache;
  if a.operation_id is not null then
    view:=premium_translation_private.catalog_operation_view(a,true);
    if a.final_receipt is not null then return view; end if;
    return view||jsonb_build_object('phase','blocked','blockReason',coalesce(view->>'blockReason','operation_in_progress'));
  end if;
  -- FINISH serializes private candidate creation on this same lock. Recheck
  -- after waiting: a completed prior admission cannot be paid for again.
  perform pg_advisory_xact_lock(hashtextextended('premium-translation:'||p_entity_type||':'||identity,0));
  if exists(select 1 from public.translation_jobs where id=p_job_id)
    or exists(select 1 from public.translation_job_items where id=p_item_id)
    or exists(select 1 from public.premium_translation_working_drafts where entity_type=p_entity_type
      and (case when p_entity_type='literary_work' then lower(entity_id)=identity else entity_id=identity end)) then
    raise exception 'Catalog job identity or private candidate already exists' using errcode='40001'; end if;
  a.operation_id:=p_operation_id;a.job_id:=p_job_id;a.item_id:=p_item_id;a.actor_id:=actor;a.entity_type:=p_entity_type;a.entity_id:=identity;
  a.provider:=p_provider;a.source_hash:=p_source_hash;a.begin_request_hash:=request_hash;a.expected_state:=p_expected_state;
  a.raw_seed:=premium_translation_private.catalog_operation_capture(p_entity_type,identity,p_expected_state);
  if octet_length(a.raw_seed::text)>4194304 then raise exception 'Catalog raw source exceeds admission limit' using errcode='22023'; end if;
  if premium_translation_private.catalog_operation_expected_valid(p_entity_type,p_expected_state,a.raw_seed) is distinct from true then
    raise exception 'Catalog expected client projection changed' using errcode='40001'; end if;
  if premium_translation_private.catalog_operation_source_valid(p_entity_type,identity,p_source_snapshot,p_source_revision,p_target_revision,a.raw_seed) is distinct from true then
    raise exception 'Catalog source/target eligibility changed' using errcode='40001'; end if;
  a.raw_seed_hash:=probpera_translation_operations.retry_fingerprint(a.raw_seed);
  a.intent_hash:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(request_hash,a.raw_seed_hash));
  a.configuration:=p_configuration;a.configuration_hash:=probpera_translation_operations.retry_fingerprint(p_configuration);
  a.source_snapshot:=p_source_snapshot;a.source_revision:=p_source_revision;a.target_revision:=p_target_revision;
  a.confirmed_cursor:=p_resume_cursor;a.calls:='[]'::jsonb;a.created_at:=stamp;
  marker:=jsonb_build_object('version',1,'protocol','catalog-translation','operationId',p_operation_id,'actorId',actor,'entityType',p_entity_type,
    'entityId',identity,'sourceHash',p_source_hash,'intentHash',a.intent_hash,'rawSeedHash',a.raw_seed_hash,
    'configurationHash',a.configuration_hash,'startedAt',stamp,'attemptNumber',1,'progress',jsonb_build_object('version',1,'updatedAt',stamp,'calls','[]'::jsonb));
  j:=jsonb_populate_record(null::public.translation_jobs,jsonb_build_object('id',p_job_id,'kind',p_entity_type,'source_locale','ru','target_locale','en',
    'provider',p_provider,'status','reviewing','total_items',1,'succeeded_items',0,'failed_items',0,'requested_by',actor,'started_at',stamp,'version',1,
    'created_at',stamp,'updated_at',stamp,'resume_cursor',p_current_cursor||jsonb_build_object('catalogOperation',
      jsonb_build_object('version',1,'entityType',p_entity_type,'operationId',p_operation_id,'actorId',actor,'intentHash',a.intent_hash))));
  i:=jsonb_populate_record(null::public.translation_job_items,jsonb_build_object('id',p_item_id,'job_id',p_job_id,'position',0,'entity_type',p_entity_type,
    'entity_id',identity,'source_hash',p_source_hash,'status','reviewing','attempt_count',0,'max_attempts',3,'next_attempt_at',stamp,'created_at',stamp,'updated_at',stamp,'staff_retry',marker));
  a.job_write_proof:=to_jsonb(j);a.item_write_proof:=to_jsonb(i);
  insert into premium_translation_private.catalog_operation_artifacts select a.*;
  insert into public.translation_jobs select j.*;
  insert into public.translation_job_items select i.*;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(actor,'translation.catalog_operation.admitted','translation_job',p_job_id::text,
    jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'entityType',p_entity_type,'entityId',identity,'sourceHash',p_source_hash,'rawSeedHash',a.raw_seed_hash));
  return premium_translation_private.catalog_operation_view(a,false,true);
end; $$;


create function public.record_catalog_translation_operation_dispatch(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_call_id uuid,p_provider text,p_model text,p_pass text,p_request_hash text
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype; j public.translation_jobs%rowtype;
  i public.translation_job_items%rowtype; call jsonb; metadata jsonb; progress jsonb; stamp timestamptz:=clock_timestamp();
begin
  a:=premium_translation_private.catalog_operation_owned(p_job_id,p_item_id,p_operation_id);
  if not probpera_translation_operations.retry_uuid(p_call_id) or p_provider is distinct from a.provider
    or p_model is null or p_pass is null or p_pass not in ('translation','repair','review')
    or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$'
    or p_model is distinct from a.configuration->>(case when p_pass='translation' then 'model' else 'reviewerModel' end) then
    raise exception 'Invalid catalog dispatch binding' using errcode='22023'; end if;
  for call in select value from jsonb_array_elements(a.calls) loop
    if call->'metadata'->>'callId'=p_call_id::text then
      if call->>'requestHash' is distinct from p_request_hash or call->'metadata'->>'pass' is distinct from p_pass
        or call->'metadata'->>'model' is distinct from p_model then raise exception 'Catalog dispatch intent differs' using errcode='40001'; end if;
      return premium_translation_private.catalog_operation_view(a,true);
    end if;
  end loop;
  select * into j from public.translation_jobs where id=p_job_id for update;
  if a.final_receipt is not null or j.cancel_requested_at is not null or j.status<>'reviewing'
    or jsonb_array_length(a.calls)>=4 or exists(select 1 from jsonb_array_elements(a.calls) value where value->'metadata'->'responseReceivedAt'='null'::jsonb) then
    raise exception 'Catalog dispatch is blocked or outcome unknown' using errcode='40001'; end if;
  if a.configuration->'twoPassReview'='false'::jsonb and (p_pass='review' or jsonb_array_length(a.calls)>=2) then
    raise exception 'Unconfigured catalog review pass' using errcode='22023'; end if;
  perform premium_translation_private.catalog_operation_assert_current(a);
  metadata:=jsonb_build_object('callId',p_call_id,'provider',p_provider,'model',p_model,'pass',p_pass,
    'dispatchRecordedAt',stamp,'responseReceivedAt',null,'httpStatus',null,'requestId',null,'responseId',null,'inputTokens',null,'outputTokens',null);
  a.calls:=a.calls||jsonb_build_array(jsonb_build_object('requestHash',p_request_hash,'metadata',metadata,'responseArtifact',null));
  progress:=premium_translation_private.catalog_operation_progress(a.calls);
  if not probpera_translation_operations.retry_journal_valid(progress,a.provider) then
    raise exception 'Catalog dispatch sequence differs' using errcode='40001'; end if;
  select * into i from public.translation_job_items where id=p_item_id for update;
  i.staff_retry:=i.staff_retry||jsonb_build_object('progress',progress);i.updated_at:=stamp;
  a.item_write_proof:=to_jsonb(i);
  update premium_translation_private.catalog_operation_artifacts set calls=a.calls,item_write_proof=a.item_write_proof where operation_id=p_operation_id;
  update public.translation_job_items set staff_retry=i.staff_retry,updated_at=i.updated_at where id=p_item_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(a.actor_id,'translation.catalog_operation.dispatch_recorded','translation_job',p_job_id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'callId',p_call_id,'provider',p_provider,'model',p_model,'pass',p_pass,'requestHash',p_request_hash));
  return premium_translation_private.catalog_operation_view(a,false,false,true);
end; $$;

create function public.record_catalog_translation_operation_response(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_metadata jsonb,p_response_artifact jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype; i public.translation_job_items%rowtype;
  call jsonb; position integer; progress jsonb; stamp timestamptz:=clock_timestamp();
begin
  a:=premium_translation_private.catalog_operation_owned(p_job_id,p_item_id,p_operation_id);
  if not premium_translation_private.exact_object(p_metadata,array['callId','provider','model','pass','httpStatus','requestId','responseId','inputTokens','outputTokens'])
    or not premium_translation_private.exact_object(p_response_artifact,array['version','body'])
    or p_response_artifact->'version' is distinct from '1'::jsonb or octet_length(p_response_artifact::text)>1048576 then
    raise exception 'Invalid catalog response artifact' using errcode='22023'; end if;
  select value,(n-1)::integer into call,position from jsonb_array_elements(a.calls) with ordinality x(value,n)
    where value->'metadata'->>'callId'=p_metadata->>'callId';
  if position is null then raise exception 'Catalog response dispatch not found' using errcode='40001'; end if;
  if call->'metadata'->>'provider' is distinct from p_metadata->>'provider'
    or call->'metadata'->>'model' is distinct from p_metadata->>'model' or call->'metadata'->>'pass' is distinct from p_metadata->>'pass' then
    raise exception 'Catalog response identity differs' using errcode='40001'; end if;
  if call->'metadata'->'responseReceivedAt'<>'null'::jsonb then
    if (call->'metadata')-array['dispatchRecordedAt','responseReceivedAt'] is distinct from p_metadata
      or call->'responseArtifact' is distinct from p_response_artifact then raise exception 'Catalog response evidence differs' using errcode='40001'; end if;
    return premium_translation_private.catalog_operation_view(a,true);
  end if;
  if a.final_receipt is not null then raise exception 'Catalog operation already finished' using errcode='40001'; end if;
  call:=call||jsonb_build_object('metadata',p_metadata||jsonb_build_object('dispatchRecordedAt',call->'metadata'->'dispatchRecordedAt','responseReceivedAt',stamp),
    'responseArtifact',p_response_artifact);
  a.calls:=jsonb_set(a.calls,array[position::text],call);
  if octet_length(a.calls::text)>4194304 then raise exception 'Catalog aggregate response artifact limit exceeded' using errcode='22023'; end if;
  progress:=premium_translation_private.catalog_operation_progress(a.calls);
  if not probpera_translation_operations.retry_journal_valid(progress,a.provider) then
    raise exception 'Catalog response metadata differs' using errcode='22023'; end if;
  select * into i from public.translation_job_items where id=p_item_id for update;
  i.staff_retry:=i.staff_retry||jsonb_build_object('progress',progress);i.updated_at:=stamp;a.item_write_proof:=to_jsonb(i);
  update premium_translation_private.catalog_operation_artifacts set calls=a.calls,item_write_proof=a.item_write_proof where operation_id=p_operation_id;
  update public.translation_job_items set staff_retry=i.staff_retry,updated_at=i.updated_at where id=p_item_id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(a.actor_id,'translation.catalog_operation.response_received','translation_job',p_job_id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',p_item_id,'callId',p_metadata->'callId','responseHash',probpera_translation_operations.retry_fingerprint(p_response_artifact)));
  return premium_translation_private.catalog_operation_view(a);
end; $$;

create function premium_translation_private.assert_catalog_operation_promotion_current(
  d public.premium_translation_working_drafts,catalog_hash text,catalog_fields jsonb)
returns void language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare a premium_translation_private.catalog_operation_artifacts%rowtype;
begin
  -- Link by the actual draft UUID first. Altering its hash/version/body cannot
  -- downgrade a newly bound candidate into an unbound legacy candidate.
  -- Plain read avoids cache -> draft / draft -> cache lock inversion at FINISH.
  select * into a from premium_translation_private.catalog_operation_artifacts where linked_draft_id=d.id;
  if a.operation_id is null then return; end if;
  if a.final_receipt is null or a.entity_type is distinct from d.entity_type or a.entity_id is distinct from d.entity_id
    or a.linked_draft_version is distinct from d.version or a.candidate_hash is distinct from d.candidate_hash
    or a.source_hash is distinct from d.source_hash or a.source_snapshot is distinct from d.source_snapshot
    or a.source_revision is distinct from d.source_revision or a.target_revision is distinct from d.target_revision
    or a.candidate->'payload' is distinct from d.payload or a.candidate->'provenance' is distinct from d.provenance then
    raise exception 'Catalog linked candidate binding changed' using errcode='40001'; end if;
  if d.entity_type='country' and (catalog_fields is distinct from a.raw_seed->'catalogFields'
    or catalog_hash is distinct from a.source_revision->>'catalogSourceHash') then
    raise exception 'Catalog country source changed' using errcode='40001'; end if;
  perform premium_translation_private.catalog_operation_assert_current(a);
end; $$;


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
  if p_entity_type in ('literary_work','country') then
    perform premium_translation_private.assert_catalog_operation_promotion_current(candidate,p_catalog_source_hash,p_catalog_source_fields);
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

revoke all on function premium_translation_private.catalog_operation_identity(text,text) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.catalog_operation_cursor_valid(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.catalog_operation_projection(jsonb,jsonb,text[]) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.catalog_operation_capture(text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.catalog_operation_expected_valid(text,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.catalog_operation_configuration_valid(text,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.catalog_operation_source_valid(text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.catalog_operation_progress(jsonb) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.catalog_operation_guard() from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.catalog_operation_view(premium_translation_private.catalog_operation_artifacts,boolean,boolean,boolean) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.catalog_operation_owned(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.catalog_operation_assert_current(premium_translation_private.catalog_operation_artifacts) from public,anon,authenticated,service_role;
revoke all on function premium_translation_private.assert_catalog_operation_promotion_current(public.premium_translation_working_drafts,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.catalog_translation_operation_ready() from public,anon,authenticated,service_role;
revoke all on function public.begin_catalog_translation_operation(uuid,uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.record_catalog_translation_operation_dispatch(uuid,uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.record_catalog_translation_operation_response(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.finish_catalog_translation_operation(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.reconcile_catalog_translation_operation(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_catalog_translation_operation_artifacts(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.catalog_translation_operation_ready() to authenticated;
grant execute on function public.begin_catalog_translation_operation(uuid,uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.record_catalog_translation_operation_dispatch(uuid,uuid,uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.record_catalog_translation_operation_response(uuid,uuid,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.finish_catalog_translation_operation(uuid,uuid,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.reconcile_catalog_translation_operation(text,text,uuid) to authenticated;
grant execute on function public.get_catalog_translation_operation_artifacts(uuid,uuid,uuid,text,text,text,text) to authenticated;

commit;
