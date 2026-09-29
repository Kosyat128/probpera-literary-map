import { probePathPattern } from './literary-news-probe-patterns.mjs';

/** Reports contain observations, never executable configuration. Keep selectors,
 * patterns and pagination from the reviewed endpoint with the same identity. */
export function promotedNewsSourceEndpoint(endpoint, report, trustedSources) {
  const trusted = trustedSources.find(source => source.id === endpoint.id && source.url === endpoint.url
    && source.format === endpoint.format);
  const { linkPattern: ignoredLink, keywordPattern: ignoredKeyword, pagination: ignoredPagination, ...data } = endpoint;
  const result = { ...data };
  if (trusted?.linkPattern) result.linkPattern = trusted.linkPattern;
  else if (endpoint.format === 'html') {
    const origin = new URL(endpoint.url).origin;
    const urls = (report.foundItems || [report.sample]).slice(0, 100).flatMap(item => {
      try { const url = new URL(item?.source?.url); return url.origin === origin ? [url.href] : []; } catch { return []; }
    });
    result.linkPattern = probePathPattern(urls);
  }
  if (trusted?.keywordPattern) result.keywordPattern = trusted.keywordPattern;
  if (trusted?.pagination) result.pagination = trusted.pagination;
  return result;
}

/** Only RegExp instances admitted above are rendered as JavaScript. JSON report
 * strings remain strings, including nested objects and regex-like payloads. */
export function serializeNewsSourceCode(value) {
  if (value instanceof RegExp) return `new RegExp(${JSON.stringify(value.source)}, ${JSON.stringify(value.flags)})`;
  if (Array.isArray(value)) return JSON.stringify(value, null, 2);
  if (value && typeof value === 'object' && !Object.values(value).some(entry => entry instanceof RegExp
    || entry && typeof entry === 'object' && Object.values(entry).some(nested => nested instanceof RegExp)))
    return JSON.stringify(value, null, 2);
  if (value && typeof value === 'object') return '{\n' + Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .map(([key, entry]) => `  ${JSON.stringify(key)}: ${serializeNewsSourceCode(entry)}`).join(',\n') + '\n}';
  return JSON.stringify(value);
}
