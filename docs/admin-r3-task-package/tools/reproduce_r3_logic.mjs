/**
 * Local reproductions of small source expressions from main 63ce311.
 * No repository modules are imported; no SQL, provider, Auth or browser is run.
 * SOURCE_BEHAVIOR_REPRODUCED is not an application PASS and not a fixed-code test.
 */
import assert from 'node:assert/strict';

const observations = [];
function record(id, source, run, limitation) {
  const actual = run();
  observations.push({ id, source, result: 'SOURCE_BEHAVIOR_REPRODUCED', actual, limitation });
}

record('R3-L01', 'R3E11', () => {
  // SQL returns uuid; the caller currently reads data.id.
  const data = '11111111-1111-4111-8111-111111111111';
  assert.equal(data.id, undefined);
  return { rpcValueType: typeof data, accessedIdIsUndefined: data.id === undefined };
}, 'Demonstrates JS property access only; does not call the database or prove a deployment failure.');

record('R3-L02', 'R3E01', () => {
  // The published prefilter runs before the helper can compare hashes.
  const englishStatus = new Map([['fixture', 'published']]);
  let current = 0;
  let helperReached = false;
  const oldHash = 'old';
  const actualHash = 'new';
  for (const articleId of ['fixture']) {
    if (englishStatus.get(articleId) === 'published') {
      current += 1;
      continue;
    }
    helperReached = true;
  }
  assert.notEqual(oldHash, actualHash);
  assert.equal(current, 1);
  assert.equal(helperReached, false);
  return { current, helperReached, sourceHashActuallyCompared: false };
}, 'Isolated branch; no real translation has been classified or changed.');

record('R3-L03', 'R3E02', () => {
  const MAX_ARTICLE_TRANSLATIONS = 2;
  const MAX_ARTICLE_SCAN = 500;
  const translated = 0;
  const firstError = '';
  let failed = 0;
  const runItems = [];
  while (translated < MAX_ARTICLE_TRANSLATIONS && !firstError && runItems.length < MAX_ARTICLE_SCAN) {
    // A synthetic conflict after each hypothetical expensive operation.
    runItems.push({ state: 'conflict' });
    failed += 1;
  }
  assert.equal(runItems.length, 500);
  assert.equal(translated, 0);
  return { syntheticIterations: runItems.length, successes: translated, conflicts: failed };
}, 'Shows that success-count alone is not an attempt limit. No external calls, timing or costs measured.');

record('R3-L04', 'R3E07', () => {
  const malformedHttp200 = {};
  const actualEmptyHttp200 = { assets: [] };
  const project = (body) => Array.isArray(body.assets) ? body.assets : [];
  assert.deepEqual(project(malformedHttp200), project(actualEmptyHttp200));
  return { malformedAndEmptyHaveSameProjection: true };
}, 'Only the fallback expression; not a mounted React component or API execution.');

record('R3-L05', 'R3E08', () => {
  function safeNextPath(value) {
    if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
    return value;
  }
  const adminSiteUrl = 'https://admin.probpera.ru';
  const candidate = '/\\outside.example/path';
  const resolved = new URL(`${adminSiteUrl}${safeNextPath(candidate)}`);
  assert.equal(resolved.origin, adminSiteUrl);
  return { testedOriginStayedAdmin: true };
}, 'One local URL case. Does not prove complete redirect safety; prevents claiming a demonstrated open redirect from this case.');

console.log(JSON.stringify({
  scope: 'ISOLATED_SOURCE_EXPRESSIONS_ONLY',
  sourceRef: '63ce3112846e3e49f4b15d1cb64b3c29cb98af70',
  applicationTestsRun: false,
  sqlExecuted: false,
  networkCalls: 0,
  observations,
}, null, 2));
