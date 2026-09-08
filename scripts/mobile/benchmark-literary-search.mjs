// Test-only capacity measurement. No catalog records or editorial approvals are created.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
const baselineRef = process.argv[2];
const output = path.resolve(root, process.argv[3] || '');
assert.match(baselineRef || '', /^[a-f0-9]{40}$/);
const relativeOutput = path.relative(root, output).replaceAll('\\', '/');
assert.match(relativeOutput, /^(?:\.tmp|docs\/mobile\/evidence\/S10)\/[a-zA-Z0-9_./-]+$/);
assert.ok(!relativeOutput.split('/').includes('..'));
await assert.rejects(fs.stat(output), { code: 'ENOENT' });
await fs.mkdir(output, { recursive: true });
const json = value => JSON.stringify(value, null, 2) + '\n';
const sha = value => createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/').replace(/\/$/, '')}`, ...args], { cwd: root, windowsHide: true });
const enginePath = 'src/utils/literarySearch.ts';
const baselineSource = git(['show', `${baselineRef}:${enginePath}`]);
const baselinePath = path.join(output, 'baseline-engine.ts');
await fs.writeFile(baselinePath, baselineSource, { flag: 'wx' });
const before = await fs.readFile(path.join(root, enginePath));

function measureSearchCapacity(baseline, current) {
  const round = value => Math.round(value * 1000) / 1000;
  const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const documents = Array.from({ length: 10000 }, (_, index) => {
    const number = String(index).padStart(5, '0');
    const titles = [`Тестовый том ${number}`, `Benchmark volume ${number}`, `試験の本 ${number}`];
    const primary = titles;
    const secondary = [index % 2 ? 'Автор Северный' : 'Writer North', 'Тестовая страна', 'Test country',
      ['роман', 'poetry', 'история', 'children'][index % 4],
      `Synthetic capacity record ${number}. This description is test data only and has no editorial status.`,
      `Синтетическая запись ${number} для измерения скорости. Это не произведение и не биография.`];
    return { key: `capacity-fixture:${number}`, label: titles[index % 2], primary, secondary,
      joined: baseline.normalizeLiterarySearch([...primary, ...secondary].join(' ')) };
  });
  const queries = ['Тестовый том 00042', 'Benchmark volume 03173', 'volume', 'Северный', 'Severnyy',
    'Тестовый Северный', '03173 poetry', '試験の本 00042', 'synthetix', 'biography', 'in', 'no-such-zqxv', '"ТОМ"', 'а'];
  const collator = new Intl.Collator('en');
  const rank = values => values.sort((a, b) => a.score - b.score || collator.compare(a.key, b.key));
  function legacySearch(query, mode, source) {
    const normalized = baseline.normalizeLiterarySearch(query);
    const matches = [];
    for (const document of source) {
      const score = mode === 'atlas'
        ? baseline.literarySearchMatches(normalized, [document.joined])
          ? baseline.literarySearchScore(document.label, normalized) : null
        : baseline.literarySearchMatchScore(normalized, document.primary, document.secondary);
      if (score !== null) matches.push({ key: document.key, score });
    }
    return rank(matches);
  }
  function preparedSearch(query, mode, source) {
    const prepared = current.compileLiterarySearchQuery(query);
    const matches = [];
    for (const document of source) {
      const score = mode === 'atlas'
        ? current.compiledLiterarySearchMatches(prepared, document.fields)
          ? current.compiledLiterarySearchMatchScore(prepared, document.labelFields) ?? 6 : null
        : current.compiledLiterarySearchMatchScore(prepared, document.primaryFields, document.secondaryFields);
      if (score !== null) matches.push({ key: document.key, score });
    }
    return rank(matches);
  }
  const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)];
  const modes = [];
  for (const mode of ['atlas', 'shared-fields']) {
    globalThis.gc();
    const heapBefore = process.memoryUsage().heapUsed, started = performance.now();
    const prepared = documents.map(document => mode === 'atlas'
      ? { key: document.key, fields: current.compileLiterarySearchFields([document.joined]), labelFields: current.compileLiterarySearchFields([document.label]) }
      : { key: document.key, primaryFields: current.compileLiterarySearchFields(document.primary), secondaryFields: current.compileLiterarySearchFields(document.secondary) });
    const preparationMs = performance.now() - started;
    globalThis.gc();
    const retainedHeapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;
    // A bounded warmup uses only 64 records, then every measured query scans all 10000.
    for (const query of queries) {
      legacySearch(query, mode, documents.slice(0, 64));
      preparedSearch(query, mode, prepared.slice(0, 64));
    }
    const measurements = queries.map(query => ({ query, baselineMs: [], compiledMs: [], matches: null, digest: null }));
    for (let repeat = 0; repeat < 2; repeat += 1) {
      for (const [queryIndex, measurement] of measurements.entries()) {
        const order = (queryIndex + repeat) % 2 ? ['compiled', 'baseline'] : ['baseline', 'compiled'];
        const results = {};
        for (const engine of order) {
          const start = performance.now();
          const matches = engine === 'baseline' ? legacySearch(measurement.query, mode, documents)
            : preparedSearch(measurement.query, mode, prepared);
          const elapsed = performance.now() - start;
          measurement[`${engine}Ms`].push(round(elapsed));
          results[engine] = { count: matches.length, digest: digest(matches) };
        }
        assert.deepEqual(results.compiled, results.baseline, `${mode}: ${measurement.query}`);
        measurement.matches = results.compiled.count;
        measurement.digest = results.compiled.digest;
      }
    }
    const baselineTimes = measurements.flatMap(value => value.baselineMs);
    const compiledTimes = measurements.flatMap(value => value.compiledMs);
    modes.push({ mode, preparationMs: round(preparationMs), retainedHeapDeltaBytes, measurements,
      baseline: { medianMs: round(percentile(baselineTimes, .5)), p95Ms: round(percentile(baselineTimes, .95)), maxMs: Math.max(...baselineTimes) },
      compiled: { medianMs: round(percentile(compiledTimes, .5)), p95Ms: round(percentile(compiledTimes, .95)), maxMs: Math.max(...compiledTimes) },
      medianSpeedup: round(percentile(baselineTimes, .5) / percentile(compiledTimes, .5)), allRankedKeyAndScoreDigestsEqual: true });
  }
  return { schemaVersion: 1, recordedAt: new Date().toISOString(), pass: true, fixture: 'DETERMINISTIC_SYNTHETIC_NOT_PRODUCTION_CATALOG',
    count: documents.length, corpusSha256: digest(documents), queryCount: queries.length, repeats: 2,
    environment: { node: process.version, platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model, cpuCount: os.cpus().length }, modes,
    limits: ['Node desktop engine measurement; not installed-device or browser main-thread latency certification.',
      'Shared-fields mode measures matching/scoring, not full global suggestion grouping, article loading or publication checks.',
      'Preparation is synchronous and memory is an approximate retained V8 heap delta after GC; cold startup/chunk scheduling require separate measurement.',
      'Mixed-query percentiles describe these 28 samples per mode; no production SLA is inferred.',
      'No synthetic record has publication, translation, title evidence or rights approval.'],
    stageAccepted: false, releaseReady: false };
}

const bundlePath = path.join(output, 'benchmark.mjs');
await build({ stdin: { contents: [
  `import * as baseline from ${JSON.stringify(baselinePath)};`,
  `import * as current from ${JSON.stringify(path.join(root, enginePath))};`,
  'import assert from "node:assert/strict"; import { createHash } from "node:crypto"; import os from "node:os";',
  `const measure = ${measureSearchCapacity.toString()};`,
  'console.log(JSON.stringify(measure(baseline, current)));',
].join('\n'), resolveDir: root, sourcefile: 'literary-search-capacity-entry.mjs', loader: 'js' }, outfile: bundlePath, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const startedAt = new Date().toISOString();
let result;
try {
  result = JSON.parse(execFileSync(process.execPath, ['--expose-gc', fileURLToPath(pathToFileURL(bundlePath))], { cwd: root, windowsHide: true, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 240000 }));
} catch (error) {
  await fs.writeFile(path.join(output, 'failure.json'), json({ pass: false, startedAt, message: error.message, stdout: error.stdout?.toString(), stderr: error.stderr?.toString() }), { flag: 'wx' });
  throw error;
}
const after = await fs.readFile(path.join(root, enginePath));
assert.equal(sha(before), sha(after), 'Search engine changed during measurement');
Object.assign(result, { baselineRef, baselineEngineSha256: sha(baselineSource), currentEngineSha256: sha(before), runnerSha256: sha(await fs.readFile(bundlePath)), scriptSha256: sha(await fs.readFile(fileURLToPath(import.meta.url))), sourceUnchanged: true });
await fs.writeFile(path.join(output, 'result.json'), json(result), { flag: 'wx' });
console.log(json({ pass: result.pass, count: result.count, sourceUnchanged: result.sourceUnchanged, modes: result.modes.map(({ measurements, ...value }) => value), evidence: `${relativeOutput}/result.json` }));
