import { describe, expect, it } from 'vitest';
import { newsJsonDigest } from './literary-news-json.mjs';
import { createLiteralEvidenceCatalog, decodeLiteralEvidenceDraft, literalEvidenceDigest } from './literary-news-literal-evidence.mjs';
import { validateDailyDraftEvidenceDraftProof, validateDailyDraftEvidenceProof } from './literary-news-draft-proof.mjs';
import { DAILY_NEWS_MODELS, DAILY_NEWS_POLICY, dailyRecordHashPayload, makeDailyApprovedPayload,
  validateDailyApprovedPayload, validateDailyNewsRecord } from './literary-news-daily-profile.mjs';

const current = new Date('2026-11-11T12:00:00Z');
const sources = [{ id: 'fixture', name: 'Literary fixture', url: 'https://publisher.example/news/', language: 'en',
  topics: ['releases'], linkPattern: /^\/news\/[^/]+$/ }];
const body = '🙂 Émile’s publisher announced the literary novel “Example”. The catalogue identifies this work as a newly published literary novel for readers.';
async function fixture({ proof = true } = {}) {
  const catalog = await createLiteralEvidenceCatalog(body);
  const wire = { protocolVersion: 'literal-evidence-refs-v1', catalogSha256: catalog.catalogSha256, status: 'draft', reason: '',
    title: { ru: 'Издатель объявил о романе Эмиля', en: 'Publisher announced Émile’s novel' },
    summary: { ru: 'Издатель объявил о литературном романе «Example» Эмиля.', en: 'Émile’s publisher announced the literary novel “Example”.' },
    category: 'releases', eventIdentity: 'emile example novel publication', literaryEvidenceId: 'e000', facts: [{ evidenceId: 'e000' }] };
  const decoded = await decodeLiteralEvidenceDraft(wire, catalog, body);
  const url = 'https://publisher.example/news/example', publishedAt = '2026-11-11T08:00:00Z';
  const record = { id: 'daily-' + (await newsJsonDigest(url)).slice(0, 32),
    eventKey: 'daily-topic:' + (await newsJsonDigest(wire.eventIdentity)).slice(0, 40), sourceId: 'fixture',
    category: 'releases', kind: 'news', eventDate: '2026-11-11', publishedAt,
    verifiedAt: current.toISOString(), verification: 'confirmed', title: wire.title, summary: wire.summary,
    source: { name: sources[0].name, url, language: 'en' }, provenance: { reviewKind: 'machineReviewed', policy: DAILY_NEWS_POLICY,
      firstAcceptedAt: current.toISOString(), draftModel: DAILY_NEWS_MODELS.draft, reviewModel: DAILY_NEWS_MODELS.review,
      draftSha256: await newsJsonDigest(decoded.draft), reviewSha256: 'b'.repeat(64), reviewPassed: true,
      eventDateBasis: 'source-publication', sourceEvidence: { documentSha256: 'd'.repeat(64), textSha256: catalog.textSha256,
        accessedAt: current.toISOString(), publication: { value: publishedAt, method: 'meta[property="article:published_time"]' },
        quotes: decoded.draft.facts.map(fact => fact.quote), literaryQuote: decoded.draft.literaryEvidence },
      ...(proof ? { draftEvidence: decoded.draftEvidence } : {}) } };
  await rehash(record);
  return { catalog, wire, decoded, record };
}
async function rehash(record) { record.provenance.recordSha256 = await newsJsonDigest(dailyRecordHashPayload(record)); }

describe('compact literal evidence proof retained in published records', () => {
  it('reconstructs the exact reviewed draft and canonical parsed wire without storing duplicate excerpt text', async () => {
    const f = await fixture(), originalHash = f.record.provenance.recordSha256;
    const result = await validateDailyDraftEvidenceProof(f.record);
    expect(result).toEqual({ draft: f.decoded.draft, wire: f.wire });
    expect(result.draft.facts[0].quote).toContain('🙂 Émile’s');
    expect(f.record.provenance.draftEvidence.spans).toEqual([{ id: 'e000', start: 0, end: f.decoded.draft.facts[0].quote.length }]);
    expect(body.slice(0, f.record.provenance.draftEvidence.spans[0].end)).toBe(f.decoded.draft.facts[0].quote);
    expect(f.record.provenance.draftEvidence.spans[0]).not.toHaveProperty('text');
    expect(await validateDailyNewsRecord(f.record, current, { sources })).toBe(f.record);
    expect(f.record.provenance.recordSha256).toBe(originalHash);
  });
  it('keeps prior records and profile hashes unchanged when the optional proof is absent', async () => {
    const { record } = await fixture({ proof: false }), original = JSON.stringify(record);
    const profile = await makeDailyApprovedPayload([record], current), beforeHash = profile.sha256;
    expect(await validateDailyDraftEvidenceProof(record)).toBeNull();
    await validateDailyApprovedPayload(profile, current, { sources });
    expect(JSON.stringify(record)).toBe(original);
    expect((await makeDailyApprovedPayload([record], current)).sha256).toBe(beforeHash);
  });
  it('defines the wire commitment independently of parsed object key order', async () => {
    const f = await fixture(), reorder = item => Array.isArray(item) ? item.map(reorder)
      : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).reverse().map(key => [key, reorder(item[key])])) : item;
    expect(await literalEvidenceDigest(reorder(f.wire))).toBe(f.record.provenance.draftEvidence.canonicalWireSha256);
    expect(await newsJsonDigest(reorder(f.wire))).not.toBe(await newsJsonDigest(f.wire));
    expect((await validateDailyDraftEvidenceProof(f.record)).wire).toEqual(f.wire);
  });
  it.each([
    ['unknown protocol', p => { p.protocolVersion = 'literal-evidence-refs-v2'; }],
    ['unknown proof field', p => { p.transportText = 'untrusted'; }],
    ['null proof', (_p, r) => { r.provenance.draftEvidence = null; }],
    ['uppercase digest', p => { p.catalogSha256 = 'A'.repeat(64); }],
    ['changed catalogue commitment', p => { p.catalogSha256 = 'c'.repeat(64); }],
    ['changed source text commitment', p => { p.textSha256 = 'c'.repeat(64); }],
    ['changed wire commitment', p => { p.canonicalWireSha256 = 'c'.repeat(64); }],
    ['changed event identity', p => { p.eventIdentity = 'another literary novel release'; }],
    ['changed draft reason', p => { p.reason = 'changed'; }],
    ['unbound literary reference', p => { p.literaryEvidenceId = 'e099'; }],
    ['duplicate fact reference', p => { p.factEvidenceIds.push(p.factEvidenceIds[0]); }],
    ['unbound fact reference', p => { p.factEvidenceIds[0] = 'e099'; }],
    ['duplicate span', p => { p.spans.push({ ...p.spans[0] }); }],
    ['unused span', p => { p.spans.push({ id: 'e099', start: 0, end: 1 }); }],
    ['missing span', p => { p.spans = []; }],
    ['noninteger offset', p => { p.spans[0].start = 0.5; }],
    ['negative offset', p => { p.spans[0].start = -1; }],
    ['out of source bound offset', p => { p.spans[0].end = 14001; }],
    ['wrong UTF-16 width', p => { p.spans[0].end--; }],
    ['unexpected span text', p => { p.spans[0].text = body; }],
    ['changed hydrated quote', (_p, r) => { r.provenance.sourceEvidence.quotes[0] = body.replace('Émile', 'Emile'); }],
    ['conflicting reused reference', (_p, r) => { r.provenance.sourceEvidence.literaryQuote = body.replace('Émile', 'Emile'); }],
    ['changed decoded draft digest', (_p, r) => { r.provenance.draftSha256 = 'c'.repeat(64); }],
    ['changed event key', (_p, r) => { r.eventKey = 'daily-topic:' + 'c'.repeat(40); }],
    ['uncommitted title field', (_p, r) => { r.title.extra = 'unexpected'; }],
  ])('rejects %s after recomputing the outer record hash', async (_name, mutate) => {
    const { record } = await fixture();
    mutate(record.provenance.draftEvidence, record); await rehash(record);
    await expect(validateDailyNewsRecord(record, current, { sources })).rejects.toThrow('daily_record_proof_invalid');
  });
  it('validates cached canonical drafts through the same reference checks without requiring a public record', async () => {
    const f = await fixture();
    const options = { textSha256: f.catalog.textSha256, eventKey: f.record.eventKey };
    expect(await validateDailyDraftEvidenceDraftProof(f.decoded.draft, f.decoded.draftEvidence, options))
      .toEqual({ draft: f.decoded.draft, wire: f.wire });
    const extra = { ...f.decoded.draft, hiddenClaim: 'not in wire' };
    await expect(validateDailyDraftEvidenceDraftProof(extra, f.decoded.draftEvidence, options)).rejects.toThrow('daily_record_proof_invalid');
    await expect(validateDailyDraftEvidenceDraftProof(f.decoded.draft, f.decoded.draftEvidence,
      { textSha256: 'f'.repeat(64) })).rejects.toThrow('daily_record_proof_invalid');
  });
  it.each(['textSha256', 'eventKey'])('does not treat a missing record %s binding as an optional cached-draft check', async field => {
    const { record } = await fixture();
    if (field === 'eventKey') delete record.eventKey;
    else delete record.provenance.sourceEvidence.textSha256;
    await expect(validateDailyDraftEvidenceProof(record)).rejects.toThrow('daily_record_proof_invalid');
  });
});
