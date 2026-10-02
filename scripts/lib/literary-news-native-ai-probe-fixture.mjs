import { DAILY_NEWS_MODELS } from './literary-news-daily-profile.mjs';

export const NATIVE_AI_PROBE_URL = 'https://native-ai-probe.invalid/protocols';
export const NATIVE_AI_PROBE_DRAFT = Object.freeze({ status: 'held', reason: 'connectivity_fixture',
  title: { ru: '', en: '' }, summary: { ru: '', en: '' }, category: 'publishing',
  eventIdentity: 'connectivity fixture', literaryEvidence: '', facts: [] });
export const NATIVE_AI_PROBE_REVIEW = Object.freeze({ accepted: false, literaryTopic: false, categoryMatches: false,
  translationsMatch: false, titleSupported: false, summarySupported: false,
  publicationDateMatches: false, duplicateOf: null, unsupportedClaims: [], factChecks: [] });
export const NATIVE_AI_PROBE_MESSAGES = Object.freeze([{ role: 'system', content:
  'This is a connectivity check using an isolated fixture, not a real source or publication. '
  + 'Return valid JSON for the supplied schema. For a draft return status held, reason connectivity_fixture, '
  + 'empty strings in both title and summary languages, category publishing, eventIdentity connectivity fixture, '
  + 'literaryEvidence empty and facts empty. For a review return accepted false, all other booleans false, '
  + 'duplicateOf null, unsupportedClaims and factChecks empty. Do not invent news.' }]);

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
