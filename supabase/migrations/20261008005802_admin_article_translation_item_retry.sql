-- An explicit, bounded staff retry of one existing article item. Provider
-- calls happen outside SQL; an admitted operation never expires into a new
-- admission. Only a private English working copy can be persisted here.
alter table public.translation_job_items add column staff_retry jsonb;
alter table public.translation_job_items add constraint translation_item_staff_retry_shape
  check (staff_retry is null or (jsonb_typeof(staff_retry) = 'object'
    and octet_length(staff_retry::text) <= 16384));
alter table public.translation_job_attempts add column staff_retry_operation_id uuid;
alter table public.translation_job_attempts add column staff_retry_receipt jsonb;
alter table public.translation_job_attempts add constraint translation_attempt_staff_retry_shape
  check ((staff_retry_operation_id is null and staff_retry_receipt is null)
    or (staff_retry_operation_id is not null and jsonb_typeof(staff_retry_receipt) is not distinct from 'object'
      and octet_length(staff_retry_receipt::text) <= 32768));
create unique index translation_item_staff_retry_operation_unique
  on public.translation_job_items ((staff_retry ->> 'operationId')) where staff_retry is not null;
create unique index translation_attempt_staff_retry_operation_unique
  on public.translation_job_attempts (staff_retry_operation_id) where staff_retry_operation_id is not null;

create or replace function probpera_translation_operations.retry_access()
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null or not public.is_staff() then
    raise exception 'article item retry requires staff access' using errcode = '42501';
  end if;
end; $$;

create or replace function probpera_translation_operations.retry_uuid(p_value uuid)
returns boolean language sql immutable security invoker set search_path = ''
return p_value is not null and p_value::text ~* '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$';

create or replace function probpera_translation_operations.retry_fingerprint(p_value jsonb)
returns text language sql immutable security invoker set search_path = ''
return encode(sha256(convert_to(p_value::text, 'UTF8')), 'hex');

-- Match the existing JavaScript/Zod string bounds, including astral symbols.
create or replace function probpera_translation_operations.retry_text_length(p_value text)
returns integer language sql immutable security invoker set search_path=''
return char_length(p_value)+regexp_count(p_value,U&'[\+010000-\+10FFFF]');

-- A conservative HTTP(S) subset of the existing URL parser. Unsupported
-- legacy URLs block admission instead of creating an unreadable copy.
create or replace function probpera_translation_operations.retry_url(p_value text)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare parts text[]; address inet;
begin
  if p_value is null or p_value ~ '[[:space:][:cntrl:]]' then return false; end if;
  parts:=regexp_match(p_value,'^https?://([A-Za-z0-9][A-Za-z0-9.-]*|\[[0-9A-Fa-f:]+\])(:[0-9]{1,5})?([/?#].*)?$','i');
  if parts is null or (parts[2] is not null and substr(parts[2],2)::integer>65535) then return false; end if;
  if left(parts[1],1)='[' then
    address:=substr(parts[1],2,char_length(parts[1])-2)::inet;
    if family(address)<>6 then return false; end if;
  elsif parts[1] ~ '^[0-9.]+$' then
    if parts[1] !~ '^(0|[1-9][0-9]{0,2})([.](0|[1-9][0-9]{0,2})){3}$' then return false; end if;
    address:=parts[1]::inet;
    if family(address)<>4 then return false; end if;
  elsif parts[1] ~* '(^|[.])([0-9]+|0x[0-9a-f]+)[.]?$' then
    return false;
  end if;
  return true;
exception when invalid_text_representation then return false;
end; $$;

create or replace function probpera_translation_operations.retry_payload_valid(p_value jsonb,p_english boolean)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare keys text[]; rule record; value jsonb; document jsonb;
begin
  keys := case when p_english then array[
    'title','subtitle','excerpt','content_json','content_html','cover_alt','slug','sources','bibliography',
    'seo_title','seo_description','seo_keywords','canonical_url','og_title','og_description','status',
    'source_content_hash','reviewed_at','approved_at','published_at','deleted_at'
  ] else array[
    'title','subtitle','excerpt','slug','content_html','content_json','category_id','status','scheduled_at',
    'published_at','cover_external_url','cover_alt','legacy_path','seo_title','seo_description','seo_keywords',
    'canonical_url','og_title','og_description','allow_indexing','sources','bibliography','featured','show_on_homepage','pinned'
  ] end;
  if p_value is null or jsonb_typeof(p_value) is distinct from 'object'
    or octet_length(p_value::text) > 5242880 or not(p_value ?& keys)
    or p_value - keys <> '{}'::jsonb or p_value -> 'status' <> '"draft"'::jsonb
    or jsonb_typeof(p_value -> 'content_json') is distinct from 'object' then return false; end if;
  for rule in select * from (values
    ('title',3,240),('subtitle',0,360),('excerpt',0,700),('slug',case when p_english then 2 else 1 end,180),
    ('content_html',0,2000000),('cover_alt',0,500),('seo_title',0,180),('seo_description',0,400),
    ('og_title',0,180),('og_description',0,400)
  ) as fields(name,minimum,maximum) loop
    if jsonb_typeof(p_value -> rule.name) is distinct from 'string'
      or probpera_translation_operations.retry_text_length(p_value ->> rule.name) not between rule.minimum and rule.maximum then return false; end if;
  end loop;
  if p_value -> 'canonical_url' = 'null'::jsonb then
    if not p_english then return false; end if;
  elsif jsonb_typeof(p_value -> 'canonical_url') is distinct from 'string'
    or not probpera_translation_operations.retry_url(p_value ->> 'canonical_url') then return false; end if;
  for rule in select * from (values ('sources',100),('bibliography',100),('seo_keywords',30)) as fields(name,maximum) loop
    if jsonb_typeof(p_value -> rule.name) is distinct from 'array'
      or jsonb_array_length(p_value -> rule.name) > rule.maximum then return false; end if;
    for value in select item.value from jsonb_array_elements(p_value -> rule.name) item(value) loop
      if rule.name = 'seo_keywords' then
        if jsonb_typeof(value) is distinct from 'string' or probpera_translation_operations.retry_text_length(value #>> '{}') > 80 then return false; end if;
      elsif jsonb_typeof(value) is distinct from 'object' or not(value ? 'text')
        or value - 'text' <> '{}'::jsonb or jsonb_typeof(value -> 'text') is distinct from 'string'
        or probpera_translation_operations.retry_text_length(value ->> 'text') > 1000 then return false; end if;
    end loop;
  end loop;
  if p_english then
    if jsonb_typeof(p_value -> 'source_content_hash') is distinct from 'string'
      or (p_value ->> 'source_content_hash') !~ '^[a-f0-9]{64}$'
      or p_value -> 'reviewed_at' <> 'null'::jsonb or p_value -> 'approved_at' <> 'null'::jsonb
      or p_value -> 'published_at' <> 'null'::jsonb or p_value -> 'deleted_at' <> 'null'::jsonb then return false; end if;
    document := p_value -> 'content_json' -> '__probperaPremiumTranslation';
    if jsonb_typeof(document) is distinct from 'object'
      or document -> 'version' is distinct from '1'::jsonb or document -> 'method' is distinct from '"machine-translation"'::jsonb
      or document -> 'sourceHash' is distinct from p_value -> 'source_content_hash' then return false; end if;
  else
    if p_value -> 'scheduled_at' <> 'null'::jsonb or p_value -> 'published_at' <> 'null'::jsonb
      or (p_value -> 'category_id' <> 'null'::jsonb and
        (jsonb_typeof(p_value -> 'category_id') is distinct from 'string'
          or (p_value ->> 'category_id') !~* '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$'))
      or (p_value -> 'legacy_path' <> 'null'::jsonb and jsonb_typeof(p_value -> 'legacy_path') is distinct from 'string')
      or (p_value -> 'cover_external_url' <> 'null'::jsonb and
        (jsonb_typeof(p_value -> 'cover_external_url') is distinct from 'string'
          or not probpera_translation_operations.retry_url(p_value ->> 'cover_external_url'))) then return false; end if;
    for rule in select name from (values('allow_indexing'),('featured'),('show_on_homepage'),('pinned')) fields(name) loop
      if jsonb_typeof(p_value -> rule.name) is distinct from 'boolean' then return false; end if;
    end loop;
  end if;
  return true;
exception when others then return false;
end; $$;

create or replace function probpera_translation_operations.begin_article_item_retry(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_expected_job_version bigint,
  p_expected_attempt_count integer,p_expected_source_hash text,p_expected_article_updated_at timestamptz,
  p_expected_english_updated_at timestamptz,p_provider text
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare job public.translation_jobs%rowtype; item public.translation_job_items%rowtype;
  article public.articles%rowtype; english public.article_translations%rowtype;
  actor uuid:=(select auth.uid()); intent jsonb; prior jsonb; view jsonb; active jsonb; snapshot jsonb;
begin
  perform probpera_translation_operations.retry_access();
  if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
    or not probpera_translation_operations.retry_uuid(p_operation_id)
    or p_expected_job_version is null or p_expected_job_version<1 or p_expected_job_version>9223372036854775805
    or p_expected_attempt_count is null or p_expected_attempt_count not between 0 and 4
    or p_expected_source_hash is null or p_expected_source_hash !~ '^[a-f0-9]{64}$'
    or p_expected_article_updated_at is null or p_provider is null or p_provider not in ('cloudflare','openai') then
    raise exception 'invalid article retry intent' using errcode='22023'; end if;
  intent:=jsonb_build_array(p_job_id,p_item_id,p_operation_id,actor,p_expected_job_version::text,
    p_expected_attempt_count,p_expected_source_hash,p_expected_article_updated_at,p_expected_english_updated_at,p_provider);
  -- Bind the UUID globally across active items and completed attempts before
  -- admitting any provider work. This lock lasts only for the SQL request.
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,7047));
  select staff_retry_receipt into prior from public.translation_job_attempts where staff_retry_operation_id=p_operation_id;
  if prior is not null then
    if prior ->> 'actorId' is distinct from actor::text then
      raise exception 'article retry actor changed' using errcode='42501'; end if;
    if prior -> 'beginIntent' is distinct from intent then
      raise exception 'article retry intent changed' using errcode='40001'; end if;
    return prior -> 'receipt' || jsonb_build_object('replayed',true,'canExecute',false);
  end if;
  if exists(select 1 from public.translation_job_items other where other.staff_retry ->> 'operationId'=p_operation_id::text
    and (other.id<>p_item_id or other.job_id<>p_job_id)) then
    raise exception 'article retry UUID already belongs to another item' using errcode='40001'; end if;
  -- Existing worker completion locks item before job. Cancellation locks job
  -- before queued/retry_wait items; this path admits only finished failed
  -- items and excludes every worker-active item before changing state.
  select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id for update;
  select * into job from public.translation_jobs where id=p_job_id for update;
  if item.id is null or job.id is null then raise exception 'article retry item not found' using errcode='P0002'; end if;
  if item.staff_retry is not null then
    if item.staff_retry ->> 'actorId' is distinct from actor::text then
      raise exception 'article retry actor changed' using errcode='42501'; end if;
    if item.staff_retry -> 'beginIntent' is distinct from intent then
      raise exception 'article retry already active or intent changed' using errcode='40001'; end if;
    return probpera_translation_operations.retry_view(job,item,'running',null,item.staff_retry,
      (item.staff_retry ->> 'sourceUpdatedAt')::timestamptz,
      (item.staff_retry ->> 'englishUpdatedAt')::timestamptz,false,true);
  end if;
  if job.version is distinct from p_expected_job_version or item.attempt_count is distinct from p_expected_attempt_count
    or item.source_hash is distinct from p_expected_source_hash or job.provider is distinct from p_provider then
    raise exception 'article retry item or job changed' using errcode='40001'; end if;
  view:=probpera_translation_operations.get_article_item_retry(p_job_id,p_item_id,null);
  if view ->> 'phase'<>'ready' then
    if view ->> 'blockReason'='operation_stopped' then
      raise exception 'article retry was stopped' using errcode='42501'; end if;
    raise exception 'article retry is not eligible' using errcode='40001';
  end if;
  select * into article from public.articles where id=item.entity_id::uuid for update;
  select * into english from public.article_translations where article_id=article.id and locale='en' for update;
  if article.updated_at is distinct from p_expected_article_updated_at
    or english.updated_at is distinct from p_expected_english_updated_at then
    raise exception 'article retry source or English changed' using errcode='40001'; end if;
  if article.id is null or article.deleted_at is not null or article.status<>'published'
    or exists(select 1 from public.article_working_drafts where article_id=article.id) then
    raise exception 'article retry source or draft changed' using errcode='40001'; end if;
  if english.id is not null and (english.deleted_at is not null or english.source_content_hash is null
    or english.content_json -> '__probperaPremiumTranslation' -> 'version' is distinct from '1'::jsonb
    or english.content_json -> '__probperaPremiumTranslation' -> 'method' is distinct from '"machine-translation"'::jsonb
    or english.content_json -> '__probperaPremiumTranslation' ->> 'sourceHash' is distinct from english.source_content_hash) then
    raise exception 'article retry English ownership changed' using errcode='40001'; end if;
  snapshot:=probpera_translation_operations.retry_ru_snapshot(article);
  active:=jsonb_build_object('version',1,'operationId',p_operation_id,'actorId',actor,'articleId',article.id,
    'beginIntent',intent,'sourceUpdatedAt',p_expected_article_updated_at,'englishUpdatedAt',p_expected_english_updated_at,
    'attemptNumber',item.attempt_count+1,'startedAt',clock_timestamp(),
    'sourceSnapshotHash',probpera_translation_operations.retry_fingerprint(snapshot));
  update public.translation_job_items set staff_retry=active,status='reviewing',
    max_attempts=attempt_count+1,lease_owner=null,lease_expires_at=null,updated_at=clock_timestamp()
    where id=item.id returning * into item;
  update public.translation_jobs set status='reviewing',failed_items=(select count(*) from public.translation_job_items
    where job_id=job.id and status='dead_letter'),completed_at=null,version=version+1,updated_at=clock_timestamp()
    where id=job.id returning * into job;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(actor,'translation.article_item_retry.began','translation_job',job.id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',item.id,'attemptNumber',item.attempt_count+1,
        'sourceHash',item.source_hash,'jobVersion',job.version::text));
  return probpera_translation_operations.retry_view(job,item,'running',null,active,
    p_expected_article_updated_at,p_expected_english_updated_at,true,false);
end; $$;

create or replace function probpera_translation_operations.retry_ru_snapshot(p_article public.articles)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare payload jsonb;
begin
  payload := jsonb_build_object(
    'title',p_article.title,'subtitle',coalesce(p_article.subtitle,''),'excerpt',coalesce(p_article.excerpt,''),
    'slug',p_article.slug,'content_html',p_article.content_html,'content_json',p_article.content_json,
    'category_id',p_article.category_id,'status','draft','scheduled_at',null,'published_at',null,
    'cover_external_url',p_article.cover_external_url,'cover_alt',coalesce(p_article.cover_alt,''),
    'legacy_path',p_article.legacy_path,'seo_title',coalesce(p_article.seo_title,''),
    'seo_description',coalesce(p_article.seo_description,''),'seo_keywords',coalesce(to_jsonb(p_article.seo_keywords),'[]'::jsonb),
    'canonical_url',p_article.canonical_url,'og_title',coalesce(p_article.og_title,''),
    'og_description',coalesce(p_article.og_description,''),'allow_indexing',p_article.allow_indexing,
    'sources',coalesce(p_article.sources,'[]'::jsonb),'bibliography',coalesce(p_article.bibliography,'[]'::jsonb),
    'featured',p_article.featured,'show_on_homepage',p_article.show_on_homepage,'pinned',p_article.pinned);
  if not probpera_translation_operations.retry_payload_valid(payload,false) then
    raise exception 'article source cannot form a compatible private copy' using errcode='22023';
  end if;
  return payload;
end; $$;

create or replace function probpera_translation_operations.retry_view(
  p_job public.translation_jobs,p_item public.translation_job_items,p_phase text,
  p_reason text,p_active jsonb,p_source_updated_at timestamptz,p_english_updated_at timestamptz,
  p_can_execute boolean default false,p_replayed boolean default false,p_result jsonb default null
)
returns jsonb language sql stable security invoker set search_path='' set timezone='UTC'
return jsonb_build_object('version',1,'jobId',p_job.id,'itemId',p_item.id,'articleId',coalesce(p_active -> 'articleId',to_jsonb(p_item.entity_id::uuid)),
  'provider',p_job.provider,'sourceHash',p_item.source_hash,'sourceUpdatedAt',p_source_updated_at,
  'englishUpdatedAt',p_english_updated_at,'jobVersion',p_job.version::text,
  'attemptCount',p_item.attempt_count,'maxAttempts',p_item.max_attempts,'jobStatus',p_job.status,
  'itemStatus',p_item.status,'operationId',p_active -> 'operationId','phase',p_phase,
  'canExecute',p_can_execute,'replayed',p_replayed,'retryable',p_phase='ready',
  'blockReason',p_reason,'result',p_result);

create or replace function probpera_translation_operations.get_article_item_retry(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare job public.translation_jobs%rowtype; item public.translation_job_items%rowtype;
  article public.articles%rowtype; english public.article_translations%rowtype;
  prior jsonb; reason text; active jsonb;
begin
  perform probpera_translation_operations.retry_access();
  if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
    or (p_operation_id is not null and not probpera_translation_operations.retry_uuid(p_operation_id)) then
    raise exception 'invalid article item retry identity' using errcode='22023'; end if;
  select * into job from public.translation_jobs where id=p_job_id;
  select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id;
  if job.id is null or item.id is null then raise exception 'article retry item not found' using errcode='P0002'; end if;
  if job.kind<>'article' or item.entity_type<>'article' or job.source_locale<>'ru' or job.target_locale<>'en'
    or item.entity_id !~* '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$' then
    raise exception 'invalid article retry domain' using errcode='22023'; end if;
  if p_operation_id is not null then
    select staff_retry_receipt into prior from public.translation_job_attempts where staff_retry_operation_id=p_operation_id;
    if prior is not null then
      if prior ->> 'actorId' is distinct from (select auth.uid())::text then
        raise exception 'article retry actor changed' using errcode='42501'; end if;
      if prior -> 'receipt' ->> 'jobId' is distinct from p_job_id::text
        or prior -> 'receipt' ->> 'itemId' is distinct from p_item_id::text then
        raise exception 'article retry identity changed' using errcode='40001'; end if;
      return prior -> 'receipt' || jsonb_build_object('replayed',true);
    end if;
    if item.staff_retry ->> 'operationId' is distinct from p_operation_id::text then
      raise exception 'article retry operation not found' using errcode='P0002'; end if;
    if item.staff_retry ->> 'actorId' is distinct from (select auth.uid())::text then
      raise exception 'article retry actor changed' using errcode='42501'; end if;
  end if;
  if item.staff_retry is not null then
    if item.staff_retry ->> 'actorId' is distinct from (select auth.uid())::text then
      return probpera_translation_operations.retry_view(job,item,'blocked','retry_busy',null,null,null);
    end if;
    active:=item.staff_retry;
    return probpera_translation_operations.retry_view(job,item,'running',null,active,
      (active ->> 'sourceUpdatedAt')::timestamptz,(active ->> 'englishUpdatedAt')::timestamptz,false,true);
  end if;
  if job.cancel_requested_at is not null or job.status in ('cancelled','cancelling') then reason:='operation_stopped';
  elsif not exists(select 1 from public.admin_audit_log a where a.action='translation.sync_run.recorded'
    and a.entity_type='translation_job' and a.entity_id=job.id::text) then reason:='job_not_sync';
  elsif job.status not in ('completed','partial','failed','conflict','stale','skipped','not-configured') then reason:='job_not_finished';
  elsif item.source_hash is null then reason:='source_hash_missing';
  elsif item.status not in ('dead_letter','conflict','stale','not-configured') then reason:='item_not_failed';
  elsif item.attempt_count>=5 or item.max_attempts>5 then reason:='attempt_limit';
  elsif exists(select 1 from public.translation_job_items other where other.job_id=job.id
    and (other.status in ('queued','leased','reviewing','retry_wait') or other.staff_retry is not null)) then reason:='retry_busy'; end if;
  select * into article from public.articles where id=item.entity_id::uuid;
  select * into english from public.article_translations where article_id=item.entity_id::uuid and locale='en';
  if reason is null then
    if article.id is null or article.deleted_at is not null or article.status<>'published' then reason:='source_unavailable';
    elsif exists(select 1 from public.article_working_drafts where article_id=article.id) then reason:='author_draft_exists';
    elsif english.id is not null and (english.deleted_at is not null
      or english.source_content_hash is null or english.content_json -> '__probperaPremiumTranslation' -> 'version' is distinct from '1'::jsonb
      or english.content_json -> '__probperaPremiumTranslation' -> 'method' is distinct from '"machine-translation"'::jsonb
      or english.content_json -> '__probperaPremiumTranslation' ->> 'sourceHash' is distinct from english.source_content_hash) then reason:='manual_english';
    else
      begin perform probpera_translation_operations.retry_ru_snapshot(article);
      exception when invalid_parameter_value then reason:='source_shape_unsupported'; end;
    end if;
  end if;
  return probpera_translation_operations.retry_view(job,item,case when reason is null then 'ready' else 'blocked' end,
    reason,null,article.updated_at,english.updated_at);
end; $$;

create or replace function probpera_translation_operations.finish_article_item_retry(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_outcome jsonb,p_english_payload jsonb default null
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare job public.translation_jobs%rowtype; item public.translation_job_items%rowtype;
  article public.articles%rowtype; english public.article_translations%rowtype;
  actor uuid:=(select auth.uid()); active jsonb; prior jsonb; request_hash text;
  outcome text; code text; attempt_outcome text; snapshot jsonb; saved jsonb; result jsonb; receipt jsonb;
  source_stamp timestamptz; english_stamp timestamptz; attempt_number integer;
  succeeded integer; failed integer; conflicts integer; stale integer; not_configured integer;
  field text; field_value jsonb; draft_stamp timestamptz;
begin
  perform probpera_translation_operations.retry_access();
  if not probpera_translation_operations.retry_uuid(p_job_id) or not probpera_translation_operations.retry_uuid(p_item_id)
    or not probpera_translation_operations.retry_uuid(p_operation_id)
    or jsonb_typeof(p_outcome) is distinct from 'object' or octet_length(p_outcome::text)>16384
    or not(p_outcome ?& array['status','providerCalls'])
    or p_outcome - array['status','providerCalls','errorCode','model','requestId','inputTokens','outputTokens','durationMs'] <> '{}'::jsonb
    or jsonb_typeof(p_outcome -> 'status') is distinct from 'string'
    or p_outcome ->> 'status' not in ('succeeded','dead_letter','conflict','stale','skipped','not-configured')
    or jsonb_typeof(p_outcome -> 'providerCalls') is distinct from 'number'
    or (p_outcome ->> 'providerCalls') !~ '^[0-4]$' then
    raise exception 'invalid article retry outcome' using errcode='22023'; end if;
  outcome:=p_outcome ->> 'status'; code:=p_outcome ->> 'errorCode';
  if (p_outcome ? 'errorCode' and p_outcome -> 'errorCode'<>'null'::jsonb
      and jsonb_typeof(p_outcome -> 'errorCode') is distinct from 'string')
    or (outcome in ('succeeded','skipped') and code is not null)
    or (outcome not in ('succeeded','skipped') and (code is null or code not in (
      'translation_not_configured','provider_unavailable','provider_request_failed','provider_invalid_response',
      'source_changed','write_conflict','database_read_failed','database_write_failed','unexpected'))) then
    raise exception 'invalid article retry error' using errcode='22023'; end if;
  foreach field in array array['model','requestId'] loop
    field_value:=p_outcome -> field;
    if field_value is not null and field_value<>'null'::jsonb and
      (jsonb_typeof(field_value) is distinct from 'string' or probpera_translation_operations.retry_text_length(p_outcome ->> field) not between 1 and 200) then
      raise exception 'invalid article retry provider metadata' using errcode='22023'; end if;
  end loop;
  foreach field in array array['inputTokens','outputTokens','durationMs'] loop
    field_value:=p_outcome -> field;
    if field_value is not null and field_value<>'null'::jsonb and
      (jsonb_typeof(field_value) is distinct from 'number' or (p_outcome ->> field) !~ '^[0-9]{1,8}$'
        or (p_outcome ->> field)::numeric > case when field='durationMs' then 3600000 else 10000000 end) then
      raise exception 'invalid article retry usage metadata' using errcode='22023'; end if;
  end loop;
  if outcome='succeeded' then
    if jsonb_typeof(p_english_payload) is distinct from 'object'
      or not(p_english_payload ?& array['mode','payload']) or p_english_payload - array['mode','payload']<>'{}'::jsonb
      or p_english_payload -> 'mode' is distinct from '"save"'::jsonb
      or not probpera_translation_operations.retry_payload_valid(p_english_payload -> 'payload',true) then
      raise exception 'invalid article retry private English' using errcode='22023'; end if;
  elsif p_english_payload is not null then
    raise exception 'non-successful article retry cannot persist English' using errcode='22023';
  end if;
  request_hash:=probpera_translation_operations.retry_fingerprint(jsonb_build_array(p_outcome,p_english_payload));
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,7047));
  select staff_retry_receipt into prior from public.translation_job_attempts where staff_retry_operation_id=p_operation_id;
  if prior is not null then
    if prior ->> 'actorId' is distinct from actor::text then
      raise exception 'article retry actor changed' using errcode='42501'; end if;
    if prior -> 'receipt' ->> 'jobId' is distinct from p_job_id::text
      or prior -> 'receipt' ->> 'itemId' is distinct from p_item_id::text
      or prior ->> 'finishFingerprint' is distinct from request_hash then
      raise exception 'article retry finish intent changed' using errcode='40001'; end if;
    return prior -> 'receipt' || jsonb_build_object('replayed',true,'canExecute',false);
  end if;
  select * into item from public.translation_job_items where id=p_item_id and job_id=p_job_id for update;
  select * into job from public.translation_jobs where id=p_job_id for update;
  if item.id is null or job.id is null then raise exception 'article retry item not found' using errcode='P0002'; end if;
  active:=item.staff_retry;
  if active ->> 'operationId' is distinct from p_operation_id::text then
    raise exception 'article retry operation not found' using errcode='P0002'; end if;
  if active ->> 'actorId' is distinct from actor::text then
    raise exception 'article retry actor changed' using errcode='42501'; end if;
  source_stamp:=(active ->> 'sourceUpdatedAt')::timestamptz;
  english_stamp:=(active ->> 'englishUpdatedAt')::timestamptz;
  attempt_number:=(active ->> 'attemptNumber')::integer;
  if item.status<>'reviewing' or item.lease_owner is not null or item.lease_expires_at is not null
    or attempt_number is distinct from item.attempt_count+1 or attempt_number not between 1 and 5
    or job.kind<>'article' or item.entity_type<>'article' or job.source_locale<>'ru' or job.target_locale<>'en'
    or active -> 'version' is distinct from '1'::jsonb
    or (active ->> 'articleId')::uuid is distinct from item.entity_id::uuid
    or active -> 'beginIntent' ->> 0 is distinct from job.id::text
    or active -> 'beginIntent' ->> 1 is distinct from item.id::text
    or active -> 'beginIntent' ->> 2 is distinct from p_operation_id::text
    or active -> 'beginIntent' ->> 3 is distinct from actor::text
    or active -> 'beginIntent' ->> 6 is distinct from item.source_hash
    or active -> 'beginIntent' ->> 9 is distinct from job.provider then
    raise exception 'article retry active item changed' using errcode='40001'; end if;
  if outcome='succeeded' and p_english_payload -> 'payload' ->> 'source_content_hash' is distinct from item.source_hash then
    raise exception 'article retry English source changed' using errcode='22023'; end if;
  select * into article from public.articles where id=item.entity_id::uuid for update;
  select * into english from public.article_translations where article_id=item.entity_id::uuid and locale='en' for update;
  -- A known provider outcome is always journaled. A cancelled or changed
  -- source has no draft write, and does not turn generated text into review.
  if job.cancel_requested_at is not null or job.status in ('cancelled','cancelling') then
    outcome:='cancelled'; code:=null;
  elsif outcome='succeeded' then
    if article.id is null or article.deleted_at is not null or article.status<>'published'
      or article.updated_at is distinct from source_stamp then outcome:='stale'; code:='source_changed';
    elsif english.updated_at is distinct from english_stamp
      or exists(select 1 from public.article_working_drafts where article_id=article.id)
      or (english.id is not null and (english.deleted_at is not null or english.source_content_hash is null
        or english.content_json -> '__probperaPremiumTranslation' -> 'version' is distinct from '1'::jsonb
        or english.content_json -> '__probperaPremiumTranslation' -> 'method' is distinct from '"machine-translation"'::jsonb
        or english.content_json -> '__probperaPremiumTranslation' ->> 'sourceHash' is distinct from english.source_content_hash)) then
      outcome:='conflict'; code:='write_conflict';
    else
      begin snapshot:=probpera_translation_operations.retry_ru_snapshot(article);
      exception when invalid_parameter_value then snapshot:=null; end;
      if snapshot is null or probpera_translation_operations.retry_fingerprint(snapshot) is distinct from active ->> 'sourceSnapshotHash' then
        outcome:='stale'; code:='source_changed';
      else
        saved:=public.save_article_working_draft(article.id,source_stamp,snapshot,p_english_payload,english_stamp,0);
        if saved ->> 'articleId' is distinct from article.id::text or saved -> 'version' is distinct from '1'::jsonb
          or jsonb_typeof(saved -> 'updatedAt') is distinct from 'string' then
          raise exception 'invalid article retry private draft receipt' using errcode='22023'; end if;
        draft_stamp:=(saved ->> 'updatedAt')::timestamptz;
        update public.article_working_drafts set draft_scope='english-only',draft_english_enabled=true
          where article_id=article.id and version=1;
        if not found then raise exception 'article retry private draft changed' using errcode='40001'; end if;
      end if;
    end if;
  end if;
  update public.translation_job_items set status=case when outcome='cancelled' then 'cancelled' else outcome end,
    attempt_count=attempt_number,staff_retry=null,lease_owner=null,lease_expires_at=null,last_error_code=code,
    updated_at=clock_timestamp() where id=item.id returning * into item;
  select count(*) filter(where status='succeeded'),count(*) filter(where status='dead_letter'),
    count(*) filter(where status='conflict'),count(*) filter(where status='stale'),count(*) filter(where status='not-configured')
    into succeeded,failed,conflicts,stale,not_configured from public.translation_job_items where job_id=job.id;
  update public.translation_jobs set succeeded_items=succeeded,failed_items=failed,
    status=case when outcome='cancelled' then 'cancelled'
      when failed>0 then case when succeeded>0 then 'partial' else 'failed' end
      when conflicts>0 then 'conflict' when stale>0 then 'stale' when not_configured>0 then 'not-configured'
      when succeeded=0 then 'skipped' else 'completed' end,
    completed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()
    where id=job.id returning * into job;
  result:=jsonb_build_object('outcome',outcome,'errorCode',code,
    'persistence',case when saved is not null then 'working-draft' else 'none' end,
    'workingDraftVersion',case when saved is not null then 1 else null end,'workingDraftUpdatedAt',draft_stamp,
    'publication','unchanged','humanReview',case when saved is not null then 'pending' else 'unchanged' end,
    'providerCalls',(p_outcome ->> 'providerCalls')::integer);
  receipt:=probpera_translation_operations.retry_view(job,item,'finished',null,active,source_stamp,english_stamp,false,false,result);
  attempt_outcome:=case when outcome='cancelled' then 'skipped' else outcome end;
  insert into public.translation_job_attempts(item_id,attempt_number,outcome,provider,model,provider_request_id,
    error_code,input_tokens,output_tokens,duration_ms,staff_retry_operation_id,staff_retry_receipt)
    values(item.id,attempt_number,attempt_outcome,job.provider,p_outcome ->> 'model',p_outcome ->> 'requestId',code,
      (p_outcome ->> 'inputTokens')::integer,(p_outcome ->> 'outputTokens')::integer,(p_outcome ->> 'durationMs')::integer,
      p_operation_id,jsonb_build_object('actorId',actor,'beginIntent',active -> 'beginIntent',
        'finishFingerprint',request_hash,'receipt',receipt));
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(actor,'translation.article_item_retry.finished','translation_job',job.id::text,
      jsonb_build_object('operationId',p_operation_id,'itemId',item.id,'attemptNumber',attempt_number,
        'outcome',outcome,'persistence',result -> 'persistence','jobVersion',job.version::text));
  return receipt;
end; $$;

create or replace function public.get_article_translation_item_retry(p_job_id uuid,p_item_id uuid,p_operation_id uuid default null)
returns jsonb language sql stable security invoker set search_path=''
return probpera_translation_operations.get_article_item_retry(p_job_id,p_item_id,p_operation_id);
create or replace function public.begin_article_translation_item_retry(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_expected_job_version bigint,p_expected_attempt_count integer,
  p_expected_source_hash text,p_expected_article_updated_at timestamptz,p_expected_english_updated_at timestamptz,p_provider text)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.begin_article_item_retry(p_job_id,p_item_id,p_operation_id,p_expected_job_version,
  p_expected_attempt_count,p_expected_source_hash,p_expected_article_updated_at,p_expected_english_updated_at,p_provider);
create or replace function public.finish_article_translation_item_retry(
  p_job_id uuid,p_item_id uuid,p_operation_id uuid,p_outcome jsonb,p_english_payload jsonb default null)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.finish_article_item_retry(p_job_id,p_item_id,p_operation_id,p_outcome,p_english_payload);

do $retry_acl$
declare signature text;
begin
  foreach signature in array array[
    'probpera_translation_operations.retry_access()',
    'probpera_translation_operations.retry_uuid(uuid)',
    'probpera_translation_operations.retry_fingerprint(jsonb)',
    'probpera_translation_operations.retry_text_length(text)',
    'probpera_translation_operations.retry_url(text)',
    'probpera_translation_operations.retry_payload_valid(jsonb,boolean)',
    'probpera_translation_operations.retry_ru_snapshot(public.articles)',
    'probpera_translation_operations.retry_view(public.translation_jobs,public.translation_job_items,text,text,jsonb,timestamp with time zone,timestamp with time zone,boolean,boolean,jsonb)',
    'probpera_translation_operations.get_article_item_retry(uuid,uuid,uuid)',
    'probpera_translation_operations.begin_article_item_retry(uuid,uuid,uuid,bigint,integer,text,timestamp with time zone,timestamp with time zone,text)',
    'probpera_translation_operations.finish_article_item_retry(uuid,uuid,uuid,jsonb,jsonb)',
    'public.get_article_translation_item_retry(uuid,uuid,uuid)',
    'public.begin_article_translation_item_retry(uuid,uuid,uuid,bigint,integer,text,timestamp with time zone,timestamp with time zone,text)',
    'public.finish_article_translation_item_retry(uuid,uuid,uuid,jsonb,jsonb)'
  ] loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',signature::regprocedure);
  end loop;
end; $retry_acl$;
grant execute on function probpera_translation_operations.get_article_item_retry(uuid,uuid,uuid) to authenticated;
grant execute on function probpera_translation_operations.begin_article_item_retry(uuid,uuid,uuid,bigint,integer,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function probpera_translation_operations.finish_article_item_retry(uuid,uuid,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.get_article_translation_item_retry(uuid,uuid,uuid) to authenticated;
grant execute on function public.begin_article_translation_item_retry(uuid,uuid,uuid,bigint,integer,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.finish_article_translation_item_retry(uuid,uuid,uuid,jsonb,jsonb) to authenticated;
