import { newsJsonDigest } from './literary-news-json.mjs';
import { literalEvidenceDigest } from './literary-news-literal-evidence.mjs';
import { DAILY_NEWS_DRAFT_PROTOCOL as PROTOCOL } from './literary-news-draft-diagnostics.mjs';

const fail = () => { throw Error('daily_record_proof_invalid'); };
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const evidenceId = value => typeof value === 'string' && /^e\d{3}$/.test(value);
function exactObject(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expected.length || keys.some(key => typeof key !== 'string' || !expected.includes(key))) fail();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail();
  }
  return value;
}
function bilingual(value) {
  exactObject(value, ['ru', 'en']);
  if (!['ru', 'en'].every(key => typeof value[key] === 'string')) fail();
  return { ru: value.ru, en: value.en };
}

/** Verify retained reference/draft consistency. Full-source catalogue membership
 * is checked during ingestion; retained records do not contain the source body. */
export async function validateDailyDraftEvidenceDraftProof(value, suppliedProof, { textSha256, eventKey } = {}) {
  exactObject(value, ['status', 'reason', 'title', 'summary', 'category', 'eventIdentity', 'literaryEvidence', 'facts']);
  const proof = exactObject(suppliedProof, ['protocolVersion', 'catalogSha256', 'textSha256',
    'canonicalWireSha256', 'eventIdentity', 'reason', 'literaryEvidenceId', 'factEvidenceIds', 'spans']);
  if (proof.protocolVersion !== PROTOCOL || !hash(proof.catalogSha256) || !hash(proof.textSha256)
    || !hash(proof.canonicalWireSha256) || textSha256 !== undefined && proof.textSha256 !== textSha256
    || typeof proof.eventIdentity !== 'string' || !/^[a-z0-9][a-z0-9 .:'-]{5,180}$/.test(proof.eventIdentity)
    || typeof proof.reason !== 'string' || proof.reason.length > 160 || proof.reason.trim() !== proof.reason
    || !evidenceId(proof.literaryEvidenceId) || !Array.isArray(proof.factEvidenceIds)
    || !proof.factEvidenceIds.length || proof.factEvidenceIds.length > 4
    || proof.factEvidenceIds.some(id => !evidenceId(id))
    || new Set(proof.factEvidenceIds).size !== proof.factEvidenceIds.length
    || !Array.isArray(proof.spans) || !proof.spans.length || proof.spans.length > 5) fail();
  if (value.status !== 'draft' || value.reason !== proof.reason || value.eventIdentity !== proof.eventIdentity
    || !Array.isArray(value.facts) || value.facts.length !== proof.factEvidenceIds.length) fail();
  const quotes = value.facts.map(fact => {
    exactObject(fact, ['quote']); return fact.quote;
  });
  const texts = new Map();
  const bind = (id, text) => {
    if (typeof text !== 'string' || !text.trim() || text.trim() !== text || text.length > 180
      || texts.has(id) && texts.get(id) !== text) fail();
    texts.set(id, text);
  };
  bind(proof.literaryEvidenceId, value.literaryEvidence);
  proof.factEvidenceIds.forEach((id, index) => bind(id, quotes[index]));
  const spans = new Map();
  for (const span of proof.spans) {
    exactObject(span, ['id', 'start', 'end']);
    if (!evidenceId(span.id) || spans.has(span.id) || !texts.has(span.id)
      || !Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end)
      || span.start < 0 || span.end > 14000 || span.end <= span.start
      || span.end - span.start !== texts.get(span.id).length) fail();
    spans.set(span.id, span);
  }
  if (spans.size !== texts.size) fail();
  const title = bilingual(value.title), summary = bilingual(value.summary);
  const draft = { status: 'draft', reason: proof.reason, title, summary, category: value.category,
    eventIdentity: proof.eventIdentity, literaryEvidence: value.literaryEvidence,
    facts: quotes.map(quote => ({ quote })) };
  const wire = { protocolVersion: PROTOCOL, catalogSha256: proof.catalogSha256, status: 'draft', reason: proof.reason,
    title, summary, category: value.category, eventIdentity: proof.eventIdentity,
    literaryEvidenceId: proof.literaryEvidenceId, facts: proof.factEvidenceIds.map(evidenceId => ({ evidenceId })) };
  if (proof.canonicalWireSha256 !== await literalEvidenceDigest(wire)
    || eventKey !== undefined && eventKey !== 'daily-topic:' + (await newsJsonDigest(proof.eventIdentity)).slice(0, 40)) fail();
  return { draft, wire };
}

export async function validateDailyDraftEvidenceProof(record) {
  const p = record?.provenance;
  if (p?.draftEvidence === undefined) return null;
  const e = p.sourceEvidence;
  if (!e || !hash(e.textSha256) || !hash(p.draftSha256) || !Array.isArray(e.quotes)
    || typeof record.eventKey !== 'string' || !/^daily-topic:[a-f0-9]{40}$/.test(record.eventKey)) fail();
  const value = { status: 'draft', reason: p.draftEvidence?.reason, title: record.title, summary: record.summary,
    category: record.category, eventIdentity: p.draftEvidence?.eventIdentity, literaryEvidence: e.literaryQuote,
    facts: e.quotes.map(quote => ({ quote })) };
  const result = await validateDailyDraftEvidenceDraftProof(value, p.draftEvidence,
    { textSha256: e.textSha256, eventKey: record.eventKey });
  if (p.draftSha256 !== await newsJsonDigest(result.draft)) fail();
  return result;
}
