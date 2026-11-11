-- Staff metadata-only freshness for new linked book/country candidates.
-- Legacy drafts retain their existing review checks and exact text identity.
-- Existing atomic promotion, seven admission RPCs and writer/site-copy stay
-- byte-unchanged. This read returns only a snapshot freshness gate.
create function public.get_catalog_translation_candidate_freshness(
  p_entity_type text,p_entity_id text,p_draft_id uuid,p_expected_version bigint,
  p_candidate_hash text,p_source_hash text,p_catalog_source_hash text default null,
  p_catalog_source_fields jsonb default null
)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare actor uuid; d public.premium_translation_working_drafts%rowtype; linked boolean:=false; envelope jsonb;
begin
  actor:=premium_translation_private.assert_actor();
  if p_entity_type is null or p_entity_type not in ('literary_work','country') then
    raise exception 'Unsupported catalog candidate freshness identity' using errcode='22023'; end if;
  -- Preserve legacy textual UUID case: the old private candidate/promote lookup
  -- uses exact entity_id text. No lower()/normalization of legacy identities.
  perform premium_translation_private.assert_identity(p_entity_type,p_entity_id);
  if not probpera_translation_operations.retry_uuid(p_draft_id) or p_expected_version is null
    or p_expected_version not between 1 and 9007199254740991
    or p_candidate_hash is null or p_candidate_hash !~ '^[a-f0-9]{64}$'
    or p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$'
    or (p_entity_type='literary_work' and (p_catalog_source_hash is not null or p_catalog_source_fields is not null))
    or (p_entity_type='country' and (p_catalog_source_hash is null or p_catalog_source_hash !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(p_catalog_source_fields) is distinct from 'object'
      or (p_catalog_source_fields ? 'translations' and jsonb_typeof(p_catalog_source_fields->'translations') is distinct from 'object'))) then
    raise exception 'Invalid catalog candidate freshness request' using errcode='22023'; end if;
  envelope:=jsonb_build_object('version',1,'entityType',p_entity_type,'entityId',p_entity_id,'draftId',p_draft_id,
    'draftVersion',p_expected_version,'candidateHash',p_candidate_hash,'sourceHash',p_source_hash);
  perform pg_advisory_xact_lock(hashtextextended('premium-translation:'||p_entity_type||':'||p_entity_id,0));
  -- Actual draft UUID first; no entity-history or hash-only fallback.
  select * into d from public.premium_translation_working_drafts where id=p_draft_id for share;
  if d.id is null then
    return envelope||jsonb_build_object('linked',false,'canPromote',false,'reason','candidate_missing'); end if;
  if d.entity_type is distinct from p_entity_type or d.entity_id is distinct from p_entity_id then
    return envelope||jsonb_build_object('linked',false,'canPromote',false,'reason','candidate_changed'); end if;
  select exists(select 1 from premium_translation_private.catalog_operation_artifacts where linked_draft_id=d.id) into linked;
  if d.version is distinct from p_expected_version or d.candidate_hash is distinct from p_candidate_hash or d.source_hash is distinct from p_source_hash then
    return envelope||jsonb_build_object('linked',linked,'canPromote',false,'reason','candidate_changed'); end if;
  if not linked then
    -- Only this complete triple is a confirmed legacy passthrough. Existing
    -- review-domain checks still apply; this is not an approval authorization.
    return envelope||jsonb_build_object('linked',false,'canPromote',true,'reason',null); end if;
  begin
    -- Existing guard compares complete stored server rows/licences and fresh
    -- country catalogue, with the same canonical lock order as atomic promote.
    -- It reads completed cache without a row lock, avoiding FINISH inversion.
    perform premium_translation_private.assert_catalog_operation_promotion_current(d,p_catalog_source_hash,p_catalog_source_fields);
  exception when serialization_failure then
    -- source_changed means recorded source/candidate context is no longer
    -- intact. Other DB errors are deliberately NOT mislabeled as stale.
    return envelope||jsonb_build_object('linked',true,'canPromote',false,'reason','source_changed');
  end;
  return envelope||jsonb_build_object('linked',true,'canPromote',true,'reason',null);
end; $$;
revoke all on function public.get_catalog_translation_candidate_freshness(text,text,uuid,bigint,text,text,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.get_catalog_translation_candidate_freshness(text,text,uuid,bigint,text,text,text,jsonb) to authenticated;
