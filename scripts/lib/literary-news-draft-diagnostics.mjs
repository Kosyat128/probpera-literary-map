// Server-owned counters only. Never expose model text or arbitrary error fields.
export const DAILY_NEWS_DRAFT_DETAIL_REASONS = Object.freeze([
  'schema', 'status', 'category', 'length', 'whitespace', 'language', 'identity',
  'literal_evidence', 'fact_shape', 'fact_total_length', 'evidence_reference',
  'evidence_catalog', 'evidence_source_hash',
]);
export const DAILY_NEWS_DRAFT_PROTOCOLS = Object.freeze(['literal-evidence-refs-v1']);
export const DAILY_NEWS_DRAFT_PROTOCOL = DAILY_NEWS_DRAFT_PROTOCOLS[0];

export function dailyDraftFailure(detailReason) {
  return Object.assign(Error('daily_draft_ungrounded'), {
    detailReason: DAILY_NEWS_DRAFT_DETAIL_REASONS.includes(detailReason) ? detailReason : 'schema',
  });
}
