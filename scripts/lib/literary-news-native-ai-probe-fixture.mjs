import { DAILY_NEWS_MODELS } from './literary-news-daily-profile.mjs';

export const NATIVE_AI_PROBE_URL = 'https://native-ai-probe.invalid/protocols';
// Fixed offline catalogue, independently regenerated in the fixture tests. It
// exercises the same const/ID-enum schema as production without a real source.
export const NATIVE_AI_PROBE_TEXT = 'This isolated connectivity fixture contains no news, publication permission or factual claim. '
  + 'Its only purpose is to verify the bounded native schema and literal-reference protocol without publishing anything.';
export const NATIVE_AI_PROBE_CATALOG = Object.freeze({ protocolVersion: 'literal-evidence-refs-v1',
  textSha256: '6b60ed9de2de8bf01af45953acf398d815b7f174f0df2e2b07cb3c3be16b5caa',
  spans: Object.freeze([
    Object.freeze({ id: 'e000', start: 0, end: 93,
      text: 'This isolated connectivity fixture contains no news, publication permission or factual claim.' }),
    Object.freeze({ id: 'e001', start: 94, end: 209,
      text: 'Its only purpose is to verify the bounded native schema and literal-reference protocol without publishing anything.' }),
  ]), catalogSha256: 'f8c4732dcbf180bd08d2de813ef5ae8fbccd17865453bf9cf9c187ba64dae6c2' });
export const NATIVE_AI_PROBE_DRAFT = Object.freeze({ protocolVersion: 'literal-evidence-refs-v1',
  catalogSha256: NATIVE_AI_PROBE_CATALOG.catalogSha256, status: 'held', reason: 'connectivity_fixture',
  title: { ru: '', en: '' }, summary: { ru: '', en: '' }, category: 'publishing',
  eventIdentity: '', literaryEvidenceId: '', facts: [] });
export const NATIVE_AI_PROBE_REVIEW = Object.freeze({ accepted: false, literaryTopic: false, categoryMatches: false,
  translationsMatch: false, titleSupported: false, summarySupported: false,
  publicationDateMatches: false, duplicateOf: null, unsupportedClaims: [], factChecks: [] });
export const NATIVE_AI_PROBE_MESSAGES = Object.freeze([{ role: 'system', content:
  'This is a connectivity check using an isolated fixture, not a real source or publication. '
  + 'Return valid JSON for the supplied schema. For a draft return status held, reason connectivity_fixture, '
  + 'protocolVersion and catalogSha256 exactly as supplied in SOURCE_DATA.evidenceCatalog, '
  + 'empty strings in both title and summary languages, category publishing, eventIdentity empty, '
  + 'literaryEvidenceId empty and facts empty. Do not return literaryEvidence or quote strings. '
  + 'For a review return accepted false, all other booleans false, '
  + 'duplicateOf null, unsupportedClaims and factChecks empty. Do not invent news.' },
  { role: 'user', content: JSON.stringify({ SOURCE_DATA: { evidenceCatalog: NATIVE_AI_PROBE_CATALOG } }) }]);

export function matchesNativeAiProbeFixture(value, expected) {
  if (Array.isArray(expected)) return Array.isArray(value) && value.length === expected.length
    && expected.every((item, index) => matchesNativeAiProbeFixture(value[index], item));
  if (!expected || typeof expected !== 'object') return value === expected;
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, item]) => Object.hasOwn(value, key) && matchesNativeAiProbeFixture(value[key], item)));
}

export function nativeAiProbeReport() {
  return { transport: 'native-ai-remote-binding', calls: 2,
    phases: ['draft', 'review'].map(phase => ({ phase, model: DAILY_NEWS_MODELS[phase], protocolConfirmed: true, published: false })),
    published: false, publicationBindings: 0, oauthFallback: false };
}
