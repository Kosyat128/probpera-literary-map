import { newsJsonDigest, newsJsonByteSize } from './literary-news-json.mjs';
import { DAILY_NEWS_DRAFT_PROTOCOL, dailyDraftFailure } from './literary-news-draft-diagnostics.mjs';

const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const fail = detail => { throw dailyDraftFailure(detail); };
export const LITERAL_EVIDENCE_LIMITS = Object.freeze({ textCharacters: 14000, spanCharacters: 125, spans: 256 });

// This is a hash of an explicitly defined canonical parsed wire object, not of
// provider transport bytes. Reordered JSON keys retain the same commitment.
export function literalEvidenceDigest(value) {
  const sorted = item => {
    if (Array.isArray(item)) return item.map(sorted);
    if (!object(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, sorted(item[key])]));
  };
  return newsJsonDigest(sorted(value));
}

export async function createLiteralEvidenceCatalog(text) {
  if (typeof text !== 'string' || text.trim().length < 120 || text.length > LITERAL_EVIDENCE_LIMITS.textCharacters)
    fail('evidence_catalog');
  const spans = [];
  for (let start = 0; start < text.length;) {
    while (start < text.length && /\s/u.test(text[start])) start++;
    if (start >= text.length) break;
    let end = Math.min(start + LITERAL_EVIDENCE_LIMITS.spanCharacters, text.length);
    if (end < text.length) {
      // Prefer complete sentences, then word boundaries; never normalize source
      // spelling, punctuation, whitespace or quotes to manufacture a match.
      const window = text.slice(start, end), minimum = Math.floor(window.length / 2);
      const sentences = [...window.matchAll(/[.!?。！？](?:\s|$)/gu)].filter(row => row.index >= minimum);
      const boundary = sentences.at(-1);
      if (boundary) end = start + boundary.index + 1;
      else {
        const space = window.search(/\s+\S*$/u);
        if (space >= minimum) end = start + space;
      }
    }
    if (end < text.length && /[\uD800-\uDBFF]/u.test(text[end - 1])) end--;
    while (end > start && /\s/u.test(text[end - 1])) end--;
    if (end <= start || spans.length >= LITERAL_EVIDENCE_LIMITS.spans) fail('evidence_catalog');
    spans.push({ id: 'e' + String(spans.length).padStart(3, '0'), start, end, text: text.slice(start, end) });
    start = end;
  }
  const payload = { protocolVersion: DAILY_NEWS_DRAFT_PROTOCOL, textSha256: await newsJsonDigest(text), spans };
  return { ...payload, catalogSha256: await literalEvidenceDigest(payload) };
}

export async function checkedLiteralEvidenceCatalog(catalog, text) {
  if (!exact(catalog, ['protocolVersion', 'textSha256', 'spans', 'catalogSha256'])
    || catalog.protocolVersion !== DAILY_NEWS_DRAFT_PROTOCOL || !hash(catalog.textSha256) || !hash(catalog.catalogSha256))
    fail('evidence_catalog');
  if (catalog.textSha256 !== await newsJsonDigest(text)) fail('evidence_source_hash');
  const actual = await createLiteralEvidenceCatalog(text);
  if (actual.catalogSha256 !== catalog.catalogSha256
    || await literalEvidenceDigest(actual.spans) !== await literalEvidenceDigest(catalog.spans)) fail('evidence_catalog');
  return catalog;
}

export function literalEvidenceWireProjection(wire) {
  if (!exact(wire, ['protocolVersion', 'catalogSha256', 'status', 'reason', 'title', 'summary', 'category',
    'eventIdentity', 'literaryEvidenceId', 'facts']) || wire.protocolVersion !== DAILY_NEWS_DRAFT_PROTOCOL
    || !hash(wire.catalogSha256) || !exact(wire.title, ['ru', 'en']) || !exact(wire.summary, ['ru', 'en'])
    || !Array.isArray(wire.facts) || wire.facts.length > 4
    || wire.facts.some(row => !exact(row, ['evidenceId']))) fail('schema');
  // Preserve every parsed value. Validation, not coercion, determines admission.
  return { protocolVersion: wire.protocolVersion, catalogSha256: wire.catalogSha256,
    status: wire.status, reason: wire.reason, title: { ru: wire.title.ru, en: wire.title.en },
    summary: { ru: wire.summary.ru, en: wire.summary.en }, category: wire.category,
    eventIdentity: wire.eventIdentity, literaryEvidenceId: wire.literaryEvidenceId,
    facts: wire.facts.map(row => ({ evidenceId: row.evidenceId })) };
}

export async function decodeLiteralEvidenceDraft(response, catalog, text) {
  await checkedLiteralEvidenceCatalog(catalog, text);
  const wire = literalEvidenceWireProjection(response);
  if (wire.catalogSha256 !== catalog.catalogSha256) fail('evidence_catalog');
  if (wire.status === 'held') {
    if (wire.literaryEvidenceId !== '' || wire.facts.length) fail('evidence_reference');
    return { draft: { status: wire.status, reason: wire.reason, title: wire.title, summary: wire.summary,
      category: wire.category, eventIdentity: wire.eventIdentity, literaryEvidence: '', facts: [] }, draftEvidence: null };
  }
  const byId = new Map(catalog.spans.map(row => [row.id, row]));
  const ids = [wire.literaryEvidenceId, ...wire.facts.map(row => row.evidenceId)];
  if (!wire.facts.length || ids.some(id => typeof id !== 'string' || !byId.has(id))
    || new Set(wire.facts.map(row => row.evidenceId)).size !== wire.facts.length) fail('evidence_reference');
  const draft = { status: wire.status, reason: wire.reason, title: wire.title, summary: wire.summary,
    category: wire.category, eventIdentity: wire.eventIdentity, literaryEvidence: byId.get(wire.literaryEvidenceId).text,
    facts: wire.facts.map(row => ({ quote: byId.get(row.evidenceId).text })) };
  const spans = [...new Set(ids)].map(id => {
    const { start, end } = byId.get(id);
    if (text.slice(start, end) !== byId.get(id).text) fail('evidence_source_hash');
    return { id, start, end };
  });
  const draftEvidence = { protocolVersion: DAILY_NEWS_DRAFT_PROTOCOL,
    catalogSha256: catalog.catalogSha256, textSha256: catalog.textSha256,
    canonicalWireSha256: await literalEvidenceDigest(wire), eventIdentity: wire.eventIdentity, reason: wire.reason,
    literaryEvidenceId: wire.literaryEvidenceId, factEvidenceIds: wire.facts.map(row => row.evidenceId), spans };
  if (newsJsonByteSize(draftEvidence) > 2048) fail('evidence_catalog');
  return { draft, draftEvidence };
}
