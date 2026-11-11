import { describe, expect, it, vi } from 'vitest';
import { createLiteralEvidenceCatalog, checkedLiteralEvidenceCatalog, decodeLiteralEvidenceDraft,
  literalEvidenceDigest, LITERAL_EVIDENCE_LIMITS } from './literary-news-literal-evidence.mjs';
import { runDailyNewsAutomation, emptyDailyLedger, dailyNewsModelRequest, validateDailyLedger } from './literary-news-daily-automation.mjs';
import { dailyNewsDigest, validateDailyNewsRecord } from './literary-news-daily-profile.mjs';
import { referencedDraftFixture } from './literary-news-evidence.test-fixture.mjs';
import { createPreparationBindingAi } from './literary-news-preparation-binding-ai.mjs';

const current = new Date('2026-11-11T11:00:00Z');
const source = { id: 'literal-fixture', name: 'Literary fixture', url: 'https://publisher.example/news/',
  language: 'en', topics: ['releases'], linkPattern: /^\/news\/[^/]+$/ };
const text = 'The publisher released Émile’s novel “Nouveau”. Literature readers can find the new literary book in its catalogue. '
  + 'The author’s original spelling and punctuation remain unchanged. Further details describe the literary publishing announcement.';
const canonical = () => ({ status: 'draft', reason: '', title: { ru: 'Издатель выпустил роман Эмиля', en: 'Publisher releases Émile’s novel' },
  summary: { ru: 'Издатель выпустил роман «Nouveau».', en: 'The publisher released Émile’s novel “Nouveau”.' },
  category: 'releases', eventIdentity: 'emile nouveau novel release', literaryEvidence: 'literary book',
  facts: [{ quote: 'The publisher released Émile’s novel “Nouveau”.' }] });
const review = { accepted: true, literaryTopic: true, categoryMatches: true, translationsMatch: true,
  titleSupported: true, summarySupported: true, publicationDateMatches: true, duplicateOf: null,
  unsupportedClaims: [], factChecks: [{ factIndex: 0, supported: true }] };
const detail = (at = current, body = text) => ({ sourceId: source.id, source: { url: 'https://publisher.example/news/novel' },
  evidence: { url: 'https://publisher.example/news/novel', canonical: 'https://publisher.example/news/novel', httpStatus: 200,
    responseSha256: 'a'.repeat(64), accessedAt: at.toISOString(), headline: 'Publisher releases Émile’s novel', text: body,
    publishedDates: [{ value: '2026-11-11T08:00:00Z', method: 'jsonld.datePublished' }] } });
const options = (ai, extra = {}) => ({ current, sources: [source], intake: { details: [detail()] }, ai, ...extra });
const wireFor = async (body = text) => {
  const catalog = await createLiteralEvidenceCatalog(body);
  const messages = [{ role: 'system', content: 'isolated fixture' },
    { role: 'user', content: JSON.stringify({ SOURCE_DATA: { evidenceCatalog: catalog } }) }];
  return { catalog, wire: referencedDraftFixture(canonical(), messages) };
};

describe('bounded exact source evidence references', () => {
  it.each([
    'x'.repeat(124) + '😀' + 'y'.repeat(300),
    '😀'.repeat(7000),
    ('Émile’s\u00a0novel “Nouveau” has not won the prize. '.repeat(500)).slice(0, 14000),
    ('a'.repeat(63) + '. ').repeat(210).slice(0, 14000),
  ])('preserves every non-whitespace source character without splitting surrogate pairs %#', async body => {
    const catalog = await createLiteralEvidenceCatalog(body);
    expect(catalog.spans.length).toBeLessThanOrEqual(256);
    expect(catalog.spans.map(span => span.text).join('').replace(/\s/gu, '')).toBe(body.replace(/\s/gu, ''));
    let previous = 0;
    for (const span of catalog.spans) {
      expect(span.text).toBe(body.slice(span.start, span.end));
      expect(body.slice(previous, span.start).trim()).toBe('');
      expect(span.text.length).toBeLessThanOrEqual(125);
      expect(/[\uD800-\uDBFF]$/u.test(span.text)).toBe(false);
      expect(/^[\uDC00-\uDFFF]/u.test(span.text)).toBe(false);
      previous = span.end;
    }
    expect(body.slice(previous).trim()).toBe('');
    const ids = [...catalog.spans].sort((a, b) => b.text.length - a.text.length).slice(0, 4);
    expect(ids.reduce((sum, span) => sum + span.text.length, 0)).toBeLessThanOrEqual(500);
    expect(LITERAL_EVIDENCE_LIMITS).toMatchObject({ spanCharacters: 125, spans: 256 });
    const messages = [{ role: 'system', content: 'Read the source catalogue.' }, { role: 'user', content: JSON.stringify({
      SOURCE_DATA: { evidenceCatalog: catalog }, allowedTopics: ['releases'] }) }];
    expect(new TextEncoder().encode(JSON.stringify(dailyNewsModelRequest({ phase: 'draft', messages }).input)).length).toBeLessThanOrEqual(80000);
  });

  it('uses an order-independent canonical parsed-wire proof and rejects unknown values before projection', async () => {
    const { catalog, wire } = await wireFor();
    const reordered = Object.fromEntries(Object.entries(wire).reverse());
    reordered.title = { en: wire.title.en, ru: wire.title.ru };
    const a = await decodeLiteralEvidenceDraft(wire, catalog, text);
    const b = await decodeLiteralEvidenceDraft(reordered, catalog, text);
    expect(a).toEqual(b);
    expect(a.draftEvidence.canonicalWireSha256).toBe(await literalEvidenceDigest(wire));
    expect(a.draft.facts[0].quote).toContain('Émile’s novel “Nouveau”');
    expect(text.includes(a.draft.facts[0].quote)).toBe(true);
    await expect(decodeLiteralEvidenceDraft({ ...wire, invented: 'cannot disappear into the projection' }, catalog, text))
      .rejects.toMatchObject({ detailReason: 'schema' });
    await expect(decodeLiteralEvidenceDraft({ ...wire, title: { ...wire.title, extra: 'ignored?' } }, catalog, text))
      .rejects.toMatchObject({ detailReason: 'schema' });
  });

  it.each(['id', 'wire_hash', 'catalog_hash', 'source_hash', 'span_text', 'span_offset'])('fails closed on a forged %s', async field => {
    const { catalog, wire } = await wireFor();
    if (field === 'id') wire.literaryEvidenceId = 'e999';
    if (field === 'wire_hash') wire.catalogSha256 = 'b'.repeat(64);
    if (field === 'catalog_hash') catalog.catalogSha256 = 'b'.repeat(64);
    if (field === 'source_hash') catalog.textSha256 = 'b'.repeat(64);
    if (field === 'span_text') catalog.spans[0].text += ' Invented';
    if (field === 'span_offset') catalog.spans[0].start++;
    await expect(decodeLiteralEvidenceDraft(wire, catalog, text)).rejects.toMatchObject({ message: 'daily_draft_ungrounded' });
  });
  it('rejects an oversized source rather than silently dropping its tail', async () => {
    await expect(createLiteralEvidenceCatalog(text.repeat(100))).rejects.toMatchObject({ detailReason: 'evidence_catalog' });
    const { catalog } = await wireFor();
    await expect(checkedLiteralEvidenceCatalog(catalog, text + ' changed')).rejects.toMatchObject({ detailReason: 'evidence_source_hash' });
  });
});

describe('real automation and native AI adapter retain the independent factual review and budget', () => {
  it('restores source literals, sends full text to the independent model and spends exactly two existing calls', async () => {
    const binding = { run: vi.fn(async (model, input) => {
      if (model.includes('gpt-oss')) return { status: 'completed', output_text: JSON.stringify(referencedDraftFixture(canonical(), input.input)) };
      const payload = JSON.parse(input.messages[1].content);
      expect(payload.SOURCE_DATA.text).toBe(text);
      expect(payload.SOURCE_DATA).not.toHaveProperty('evidenceCatalog');
      expect(text.includes(payload.draft.facts[0].quote)).toBe(true);
      expect(input.messages[0].content).toContain('A literal quote alone does not imply a claim');
      return { response: review };
    }) };
    const previous = emptyDailyLedger(current);
    previous.inferenceBudgets = [{ day: '2026-11-11', reservedCalls: 47, draftRequests: 40 }];
    const checkpoints = [], result = await runDailyNewsAutomation(options(createPreparationBindingAi(binding), {
      previous, saveCheckpoint: value => checkpoints.push(structuredClone(value)) }));
    expect(result.report).toMatchObject({ newlyAccepted: 1, aiCalls: 2, reservedAiCallsToday: 49, draftRequestsToday: 41 });
    expect(binding.run).toHaveBeenCalledTimes(2);
    expect(checkpoints[0].inferenceBudgets[0]).toMatchObject({ reservedCalls: 48, draftRequests: 41 });
    expect(result.state.accepted[0].provenance.draftEvidence.protocolVersion).toBe('literal-evidence-refs-v1');
    await expect(validateDailyNewsRecord(result.state.accepted[0], current, { sources: [source] })).resolves.toBeDefined();
  });

  it('never treats exact quotations as independent semantic approval', async () => {
    const request = vi.fn(async ({ phase, messages }) => phase === 'draft' ? referencedDraftFixture(canonical(), messages)
      : { ...review, translationsMatch: false });
    const result = await runDailyNewsAutomation(options({ request }));
    expect(result.profile.records).toEqual([]);
    expect(result.report.held[0].reason).toBe('daily_independent_review_rejected');
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.state.inferenceBudgets[0]).toMatchObject({ reservedCalls: 2, draftRequests: 1 });
  });

  it('rejects an old-format fresh provider response rather than silently falling back', async () => {
    const request = vi.fn(async () => canonical()), result = await runDailyNewsAutomation(options({ request }));
    expect(result.profile.records).toEqual([]); expect(request).toHaveBeenCalledTimes(1);
    expect(result.report.held[0]).toMatchObject({ reason: 'daily_draft_ungrounded', detailReason: 'schema' });
  });

  it('validates complete provider input size before reserving any call', async () => {
    const request = vi.fn(), huge = { ...source, name: '名'.repeat(30000) };
    const result = await runDailyNewsAutomation(options({ request }, { sources: [huge] }));
    expect(request).not.toHaveBeenCalled();
    expect(result.report).toMatchObject({ stoppedReason: 'daily_ai_input_invalid', aiCalls: 0, reservedAiCallsToday: 0, draftRequestsToday: 0 });
  });

  it('rechecks cached compact offsets against the actual full source before spending a review call', async () => {
    const request = vi.fn(async ({ phase, messages }) => {
      if (phase === 'draft') return referencedDraftFixture(canonical(), messages);
      throw Error('ai_request_unavailable');
    });
    const first = await runDailyNewsAutomation(options({ request }));
    expect(first.state.reviewCache[0].status).toBe('draft');
    const changed = structuredClone(first.state), proof = changed.reviewCache[0].draftEvidence;
    proof.spans.forEach(span => { span.start++; span.end++; });
    await expect(validateDailyLedger(changed, current, { sources: [source] })).resolves.toBe(changed);
    const later = vi.fn(), result = await runDailyNewsAutomation(options({ request: later }, { previous: changed }));
    expect(later).not.toHaveBeenCalled();
    expect(result.report.stoppedReason).toBe('daily_review_cache_corrupt');
    expect(result.state.inferenceBudgets).toEqual(first.state.inferenceBudgets);
  });

  it('fails before inference when the saved canonical-wire proof is corrupt even if the draft hash is intact', async () => {
    const request = vi.fn(async ({ phase, messages }) => {
      if (phase === 'draft') return referencedDraftFixture(canonical(), messages);
      throw Error('ai_request_unavailable');
    });
    const first = await runDailyNewsAutomation(options({ request })), changed = structuredClone(first.state);
    changed.reviewCache[0].draftEvidence.canonicalWireSha256 = 'f'.repeat(64);
    expect(changed.reviewCache[0].draftSha256).toBe(await dailyNewsDigest(changed.reviewCache[0].draft));
    await expect(runDailyNewsAutomation(options({ request: vi.fn() }, { previous: changed }))).rejects.toThrow('daily_review_cache_corrupt');
  });
});
