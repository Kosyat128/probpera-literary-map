-- Ordinary machine completion saves only a private English working copy.
-- Existing canonical RU/EN, editorial approvals and public-build triggers are
-- untouched. The private writer delegates the existing draft/CAS/audit API.
create function probpera_translation_operations.machine_english_draft_access()
returns void language plpgsql stable security invoker set search_path='' as $$
begin
  if (select auth.uid()) is null or not public.is_staff(array['owner'::public.staff_role,'admin'::public.staff_role]) then
    raise exception 'article machine English draft requires owner or admin' using errcode='42501';
  end if;
end; $$;

-- Match the complete author snapshot, independently of the TS content hash.
-- SQL jsonb::text fingerprints are not the JavaScript content-hash format.
create function probpera_translation_operations.machine_english_source_matches(
  p_article public.articles,p_source_updated_at timestamptz,p_source_snapshot jsonb
)
returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
  if p_article.id is null or p_article.status<>'published' or p_article.deleted_at is not null
    or p_article.updated_at is distinct from p_source_updated_at then return false; end if;
  return probpera_translation_operations.retry_ru_snapshot(p_article) is not distinct from p_source_snapshot;
exception when invalid_parameter_value then return false;
end; $$;

create function probpera_translation_operations.get_article_machine_english_draft_context(
  p_article_id uuid,p_source_hash text,p_source_updated_at timestamptz,p_source_snapshot jsonb,
  p_expected_english_updated_at timestamptz
)
returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare article public.articles%rowtype; english public.article_translations%rowtype;
  draft public.article_working_drafts%rowtype; reason text;
begin
  perform probpera_translation_operations.machine_english_draft_access();
  if not probpera_translation_operations.retry_uuid(p_article_id)
    or p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$'
    or p_source_updated_at is null or not isfinite(p_source_updated_at)
    or (p_expected_english_updated_at is not null and not isfinite(p_expected_english_updated_at))
    or not probpera_translation_operations.retry_payload_valid(p_source_snapshot,false) then
    raise exception 'invalid article machine English context' using errcode='22023'; end if;
  select * into article from public.articles where id=p_article_id;
  select * into english from public.article_translations where article_id=p_article_id and locale='en';
  select * into draft from public.article_working_drafts where article_id=p_article_id;
  if not probpera_translation_operations.machine_english_source_matches(article,p_source_updated_at,p_source_snapshot) then
    reason:='source_changed';
  elsif english.updated_at is distinct from p_expected_english_updated_at then reason:='english_changed';
  elsif english.id is not null and (english.deleted_at is not null or english.source_content_hash is null
    or english.content_json -> '__probperaPremiumTranslation' -> 'version' is distinct from '1'::jsonb
    or english.content_json -> '__probperaPremiumTranslation' -> 'method' is distinct from '"machine-translation"'::jsonb
    or english.content_json -> '__probperaPremiumTranslation' ->> 'sourceHash' is distinct from english.source_content_hash) then
    reason:='manual_english';
  elsif draft.article_id is not null then reason:='draft_exists'; end if;
  return jsonb_build_object('version',1,'articleId',p_article_id,'sourceHash',p_source_hash,
    'sourceUpdatedAt',p_source_updated_at,'englishUpdatedAt',p_expected_english_updated_at,
    'canGenerate',reason is null,'blockReason',reason);
end; $$;

create function probpera_translation_operations.save_article_machine_english_draft(
  p_article_id uuid,p_source_hash text,p_source_updated_at timestamptz,p_source_snapshot jsonb,
  p_expected_english_updated_at timestamptz,p_english_payload jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare actor uuid:=(select auth.uid()); article public.articles%rowtype;
  english public.article_translations%rowtype; draft public.article_working_drafts%rowtype;
  saved jsonb; metadata jsonb; affected integer;
begin
  perform probpera_translation_operations.machine_english_draft_access();
  -- Reject malformed requests before acquiring row locks. The locked canonical
  -- records, not a client role or previous context response, decide admission.
  if not probpera_translation_operations.retry_uuid(p_article_id)
    or p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$'
    or p_source_updated_at is null or not isfinite(p_source_updated_at)
    or (p_expected_english_updated_at is not null and not isfinite(p_expected_english_updated_at))
    or not probpera_translation_operations.retry_payload_valid(p_source_snapshot,false)
    or jsonb_typeof(p_english_payload) is distinct from 'object'
    or p_english_payload - array['mode','payload']<>'{}'::jsonb
    or not(p_english_payload ?& array['mode','payload'])
    or p_english_payload -> 'mode' is distinct from '"save"'::jsonb
    or not probpera_translation_operations.retry_payload_valid(p_english_payload -> 'payload',true)
    or p_english_payload -> 'payload' ->> 'source_content_hash' is distinct from p_source_hash then
    raise exception 'invalid article machine English draft' using errcode='22023'; end if;
  -- Keep the established article -> English -> working-draft lock order.
  select * into article from public.articles where id=p_article_id for update;
  select * into english from public.article_translations where article_id=p_article_id and locale='en' for update;
  select * into draft from public.article_working_drafts where article_id=p_article_id for update;
  if not probpera_translation_operations.machine_english_source_matches(article,p_source_updated_at,p_source_snapshot) then
    raise exception 'article machine English source changed' using errcode='40001'; end if;
  if english.updated_at is distinct from p_expected_english_updated_at then
    raise exception 'article machine English translation changed' using errcode='40001'; end if;
  if english.id is not null and (english.deleted_at is not null or english.source_content_hash is null
    or english.content_json -> '__probperaPremiumTranslation' -> 'version' is distinct from '1'::jsonb
    or english.content_json -> '__probperaPremiumTranslation' -> 'method' is distinct from '"machine-translation"'::jsonb
    or english.content_json -> '__probperaPremiumTranslation' ->> 'sourceHash' is distinct from english.source_content_hash) then
    raise exception 'article machine English translation is manual or deleted' using errcode='40001'; end if;
  if draft.article_id is not null then
    raise exception 'article machine English author draft exists' using errcode='40001'; end if;
  saved:=public.save_article_working_draft(p_article_id,p_source_updated_at,p_source_snapshot,
    p_english_payload,p_expected_english_updated_at,0);
  if saved ->> 'articleId' is distinct from p_article_id::text or saved -> 'version' is distinct from '1'::jsonb then
    raise exception 'article machine English draft save unconfirmed' using errcode='40001'; end if;
  update public.article_working_drafts set draft_scope='english-only',draft_english_enabled=true
    where article_id=p_article_id and version=1 and actor_id=actor;
  get diagnostics affected=ROW_COUNT;
  select * into draft from public.article_working_drafts where article_id=p_article_id;
  if affected<>1 or draft.payload is distinct from p_source_snapshot or draft.english_payload is distinct from p_english_payload
    or draft.draft_scope is distinct from 'english-only' or draft.draft_english_enabled is distinct from true
    or draft.base_article_updated_at is distinct from p_source_updated_at
    or draft.expected_english_updated_at is distinct from p_expected_english_updated_at
    or draft.updated_at is distinct from (saved ->> 'updatedAt')::timestamptz then
    raise exception 'article machine English draft save unconfirmed' using errcode='40001'; end if;
  metadata:=p_english_payload -> 'payload' -> 'content_json' -> '__probperaPremiumTranslation';
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,metadata) values(actor,
    'article.premium_translation.backfill.succeeded','article',p_article_id::text,
    jsonb_build_object('locale','en','source_hash',p_source_hash,'source_updated_at',p_source_updated_at,
      'ownership','machine-translation','workingDraftVersion',1,'workingDraftUpdatedAt',draft.updated_at,
      'scope','english-only','publication','unchanged','humanReview','pending',
      'model',case when jsonb_typeof(metadata -> 'model')='string' and probpera_translation_operations.retry_text_length(metadata ->> 'model') between 1 and 200 then metadata -> 'model' else 'null'::jsonb end,
      'reviewer_model',case when jsonb_typeof(metadata -> 'reviewerModel')='string' and probpera_translation_operations.retry_text_length(metadata ->> 'reviewerModel') between 1 and 200 then metadata -> 'reviewerModel' else 'null'::jsonb end));
  return jsonb_build_object('version',1,'articleId',p_article_id,'sourceHash',p_source_hash,
    'sourceUpdatedAt',p_source_updated_at,'englishUpdatedAt',p_expected_english_updated_at,
    'workingDraftVersion',1,'workingDraftUpdatedAt',draft.updated_at,'scope','english-only',
    'publication','unchanged','humanReview','pending','persistence','working-draft');
end; $$;

create function public.get_article_machine_english_draft_context(
  p_article_id uuid,p_source_hash text,p_source_updated_at timestamptz,p_source_snapshot jsonb,
  p_expected_english_updated_at timestamptz
)
returns jsonb language sql stable security invoker set search_path=''
return probpera_translation_operations.get_article_machine_english_draft_context(p_article_id,p_source_hash,
  p_source_updated_at,p_source_snapshot,p_expected_english_updated_at);
create function public.save_article_machine_english_draft(
  p_article_id uuid,p_source_hash text,p_source_updated_at timestamptz,p_source_snapshot jsonb,
  p_expected_english_updated_at timestamptz,p_english_payload jsonb
)
returns jsonb language sql volatile security invoker set search_path=''
return probpera_translation_operations.save_article_machine_english_draft(p_article_id,p_source_hash,
  p_source_updated_at,p_source_snapshot,p_expected_english_updated_at,p_english_payload);

revoke all on function probpera_translation_operations.machine_english_draft_access() from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.machine_english_source_matches(public.articles,timestamptz,jsonb) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.get_article_machine_english_draft_context(uuid,text,timestamptz,jsonb,timestamptz) from public,anon,authenticated,service_role;
revoke all on function probpera_translation_operations.save_article_machine_english_draft(uuid,text,timestamptz,jsonb,timestamptz,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.get_article_machine_english_draft_context(uuid,text,timestamptz,jsonb,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.save_article_machine_english_draft(uuid,text,timestamptz,jsonb,timestamptz,jsonb) from public,anon,authenticated,service_role;
grant execute on function probpera_translation_operations.get_article_machine_english_draft_context(uuid,text,timestamptz,jsonb,timestamptz) to authenticated;
grant execute on function probpera_translation_operations.save_article_machine_english_draft(uuid,text,timestamptz,jsonb,timestamptz,jsonb) to authenticated;
grant execute on function public.get_article_machine_english_draft_context(uuid,text,timestamptz,jsonb,timestamptz) to authenticated;
grant execute on function public.save_article_machine_english_draft(uuid,text,timestamptz,jsonb,timestamptz,jsonb) to authenticated;
