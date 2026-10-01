import assert from 'node:assert/strict';
import { projectReviewedNextBuilderFollowup } from './lib/reviewed-next-builder-followup.mjs';
import { projectReviewedNextSecurityFollowup } from './lib/reviewed-next-security-followup.mjs';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const lf = source => source.replace(/\r\n?/gu, '\n');
const sha = source => createHash('sha256').update(lf(source)).digest('hex');
const rawSha = source => createHash('sha256').update(source).digest('hex');
const read = path => lf(projectReviewedNextSecurityFollowup(path, projectReviewedNextBuilderFollowup(path, readFileSync(path, 'utf8'))));
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${process.cwd()}`, ...args], { maxBuffer: 50 * 1024 * 1024 });
const attestationPath = 'scripts/governance/russian-calendar-expansion-reviewed-20261001.json';
const baselineCommitSha = '031821';
const changes = [
  ['src/data/countries/calendarWriterDatePatches.ts', 'russian-date-overlay-import',
    "import scoped from './generated/writerDatePatches.r10-scoped.json';",
    "import scoped from './generated/writerDatePatches.r10-scoped.json';\nimport russianExpansion from './generated/writerDatePatches.r10-russian-expansion.json';"],
  ['src/data/countries/calendarWriterDatePatches.ts', 'russian-date-overlay-array',
    'export const calendarWriterDatePatches = [...russian.patches, ...popular.patches, ...scoped.patches] as WriterDatePatch[];',
    'export const calendarWriterDatePatches = [...russian.patches, ...popular.patches, ...scoped.patches, ...russianExpansion.patches] as WriterDatePatch[];'],
  ['scripts/lib/reviewed-calendar-followup.mjs', 'russian-date-governance-import',
    'import { readFileSync } from "node:fs";',
    'import { readFileSync } from "node:fs";\nimport { projectReviewedRussianCalendarExpansion, isReviewedRussianCalendarExpansionAddition, reviewedRussianCalendarExpansionAdditionPaths } from "./reviewed-russian-calendar-expansion.mjs";'],
  ['scripts/lib/reviewed-calendar-followup.mjs', 'russian-date-addition-paths',
    'export const reviewedCalendarAdditionPaths = new Set(calendarFollowupAttestation.additions.map(entry => entry.path));',
    'export const reviewedCalendarAdditionPaths = new Set([...calendarFollowupAttestation.additions.map(entry => entry.path), ...reviewedRussianCalendarExpansionAdditionPaths]);'],
  ['scripts/lib/reviewed-calendar-followup.mjs', 'russian-date-project-before-historical',
    "  let projected = source.replace(/\\r\\n?/gu, \"\\n\");",
    '  let projected = projectReviewedRussianCalendarExpansion(relativePath, source);'],
  ['scripts/lib/reviewed-calendar-followup.mjs', 'russian-date-exact-addition-review',
    '  return Boolean(entry && calendarFollowupSha256(source) === entry.sha256Lf);',
    '  try {\n    return isReviewedRussianCalendarExpansionAddition(relativePath, source) ||\n      Boolean(entry && calendarFollowupSha256(projectReviewedRussianCalendarExpansion(relativePath, source)) === entry.sha256Lf);\n  } catch { return false; }'],
  ['scripts/lib/reviewed-calendar-followup.test.mjs', 'russian-date-prior-test-import',
    "import { readFileSync } from 'node:fs';",
    "import { readFileSync } from 'node:fs';\nimport { projectReviewedRussianCalendarExpansion, reviewedRussianCalendarExpansionAdditionPaths } from './reviewed-russian-calendar-expansion.mjs';"],
  ['scripts/lib/reviewed-calendar-followup.test.mjs', 'russian-date-prior-test-read',
    "const read=path=>projectReviewedUndiciSecurityFollowup(path,readFileSync(path,'utf8').replace(/\\r\\n?/gu,'\\n'));",
    "const read=path=>projectReviewedUndiciSecurityFollowup(path,projectReviewedRussianCalendarExpansion(path,readFileSync(path,'utf8').replace(/\\r\\n?/gu,'\\n')));"],
  ['scripts/lib/reviewed-calendar-followup.test.mjs', 'russian-date-prior-test-paths',
    '    expect([...reviewedCalendarAdditionPaths]).toEqual(packet.additions.map(item=>item.path));',
    '    expect([...reviewedCalendarAdditionPaths]).toEqual([...packet.additions.map(item=>item.path), ...reviewedRussianCalendarExpansionAdditionPaths]);'],
  ['scripts/build-calendar-followup-attestation-r10.mjs', 'russian-date-prior-builder-import',
    "import assert from 'node:assert/strict';",
    "import assert from 'node:assert/strict';\nimport { projectReviewedRussianCalendarExpansion } from './lib/reviewed-russian-calendar-expansion.mjs';"],
  ['scripts/build-calendar-followup-attestation-r10.mjs', 'russian-date-prior-builder-read',
    "const read=path=>projectReviewedCalendarSecurityFollowup(path,readFileSync(path,'utf8'));",
    "const read=path=>projectReviewedCalendarSecurityFollowup(path,projectReviewedRussianCalendarExpansion(path,readFileSync(path,'utf8')));"],
  ['scripts/lib/reviewed-calendar-security-followup.test.mjs', 'russian-date-prior-security-test-import',
    "import {readFileSync} from 'node:fs';",
    "import {readFileSync} from 'node:fs';\nimport {projectReviewedRussianCalendarExpansion} from './reviewed-russian-calendar-expansion.mjs';"],
  ['scripts/lib/reviewed-calendar-security-followup.test.mjs', 'russian-date-prior-security-test-read',
    "const raw=path=>readFileSync(path,'utf8').replace(/\\r\\n?/gu,'\\n');",
    "const raw=path=>projectReviewedRussianCalendarExpansion(path,readFileSync(path,'utf8').replace(/\\r\\n?/gu,'\\n'));"],
  ['scripts/lib/r10-exact-source-punctuation.test.mjs', 'russian-date-prior-punctuation-test-import',
    'import { projectReviewedCalendarSecurityFollowup } from "./reviewed-calendar-security-followup.mjs";',
    'import { projectReviewedCalendarSecurityFollowup } from "./reviewed-calendar-security-followup.mjs";\nimport { projectReviewedRussianCalendarExpansion } from "./reviewed-russian-calendar-expansion.mjs";'],
  ['scripts/lib/r10-exact-source-punctuation.test.mjs', 'russian-date-prior-punctuation-test-read',
    'const read = path => projectReviewedCalendarSecurityFollowup(path, readFileSync(path, "utf8"));',
    'const read = path => projectReviewedCalendarSecurityFollowup(path, projectReviewedRussianCalendarExpansion(path, readFileSync(path, "utf8")));'],
  ['scripts/audit-russian-calendar-r10.mjs', 'russian-date-historical-russian-audit-export',
    "export { applyCalendarWriterDatePatches } from './src/data/countries/calendarWriterDatePatches';",
    "export { applyCalendarWriterDatePatches, calendarWriterDatePatches } from './src/data/countries/calendarWriterDatePatches';"],
  ['scripts/audit-russian-calendar-r10.mjs', 'russian-date-historical-russian-audit-packet',
    "const { countries, applyCalendarWriterDatePatches, selectCalendarEvents, calendarWriterIdentity } = await import(`${pathToFileURL(`${process.cwd()}/${target}`).href}?t=${Date.now()}`);\nconst russia = applyCalendarWriterDatePatches(countries).countries.find(c => c.id === 'russia');\nassert.ok(russia);\nconst allEvents = selectCalendarEvents(countries, 'ru');",
    "const { countries, applyCalendarWriterDatePatches, calendarWriterDatePatches, selectCalendarEvents, calendarWriterIdentity } = await import(`${pathToFileURL(`${process.cwd()}/${target}`).href}?t=${Date.now()}`);\n// This historical audit retains its accepted 25-field packet; the expansion has a separate current audit.\nconst historicalPacket = calendarWriterDatePatches.filter(patch => !patch.id.startsWith('r10-russian-expansion:'));\nconst russia = applyCalendarWriterDatePatches(countries, historicalPacket).countries.find(c => c.id === 'russia');\nassert.ok(russia);\nconst allEvents = selectCalendarEvents(countries, 'ru', undefined, historicalPacket);"],
  ['scripts/audit-popular-calendar-r10.mjs', 'russian-date-historical-popular-audit-packet',
    'const allPatches = [...rt.writerDatePatches, ...rt.calendarWriterDatePatches];',
    "// This historical audit retains its accepted 25-field packet; the expansion has a separate current audit.\nconst historicalPacket = rt.calendarWriterDatePatches.filter(patch => !patch.id.startsWith('r10-russian-expansion:'));\nconst allPatches = [...rt.writerDatePatches, ...historicalPacket];"],
  ['scripts/audit-popular-calendar-r10.mjs', 'russian-date-historical-popular-audit-clones',
    'assert.deepEqual(after, rt.applyCalendarWriterDatePatches(rt.countries).countries, \'Actual calendar clones differ from audited date overlay\');',
    'assert.deepEqual(after, rt.applyCalendarWriterDatePatches(rt.countries, historicalPacket).countries, \'Actual calendar clones differ from audited date overlay\');'],
  ['scripts/audit-popular-calendar-r10.mjs', 'russian-date-historical-popular-audit-fields',
    'const packet = rt.calendarWriterDatePatches;', 'const packet = historicalPacket;'],
  ['scripts/lib/reviewed-undici-security-followup.test.mjs', 'russian-date-prior-undici-test-import',
    "import {readFileSync} from 'node:fs';",
    "import {readFileSync} from 'node:fs';\nimport {projectReviewedRussianCalendarExpansion} from './reviewed-russian-calendar-expansion.mjs';"],
  ['scripts/lib/reviewed-undici-security-followup.test.mjs', 'russian-date-prior-undici-test-read',
    "const read=path=>projectReviewedR10SourcePunctuation(path,readFileSync(path,'utf8'));",
    "const read=path=>projectReviewedR10SourcePunctuation(path,projectReviewedRussianCalendarExpansion(path,readFileSync(path,'utf8')));"],
  ['src/data/countries/writerDatePatches.test.ts', 'russian-date-production-test-import',
    "import scoped from './generated/writerDatePatches.r10-scoped.json';",
    "import scoped from './generated/writerDatePatches.r10-scoped.json';\nimport russianExpansion from './generated/writerDatePatches.r10-russian-expansion.json';"],
  ['src/data/countries/writerDatePatches.test.ts', 'russian-date-production-test-identity',
    'const russianIds=new Set(russian.patches.map(p=>p.id));',
    "const russianIds=new Set(russian.patches.map(p=>p.id));\nconst russianExpansionIds=new Set(russianExpansion.patches.map(p=>p.id));\nconst russianExpansionReview=JSON.parse(readFileSync(new URL('../../../reports/r10/calendar/russian-expansion-source-review-20261001.json',import.meta.url),'utf8'));"],
  ['src/data/countries/writerDatePatches.test.ts', 'russian-date-production-test-snapshot',
    '      const isCached=isSupplemental||isRussian||isPopular;',
    '      const isRussianExpansion=russianExpansionIds.has(p.id);\n      const isCached=isSupplemental||isRussian||isPopular||isRussianExpansion;'],
  ['src/data/countries/writerDatePatches.test.ts', 'russian-date-production-test-calendar-model',
    "          if(isRussian&&p.evidence.method==='referenced-julian-claim-with-institutional-gregorian-source'){",
    "          if((isRussian||isRussianExpansion)&&p.evidence.method==='referenced-julian-claim-with-institutional-gregorian-source'){"],
  ['src/data/countries/writerDatePatches.test.ts', 'russian-date-production-test-review',
    "      if(p.field==='deathDate')expect(p.appliedValue<='2026-09-26').toBe(true);",
    "      if(isRussianExpansion){\n        expect(p.writerKey.startsWith('russia:')).toBe(true);\n        expect(p.evidence.retrievedAt).toBe(cached.retrievedAt);\n        const review=russianExpansionReview.ready.find((row:any)=>row.writerKey===p.writerKey&&row.field===p.field);\n        expect(review.value).toBe(p.appliedValue);\n        expect(p.expectedOld).toBe(review.expectedOld);\n        expect(p.evidence.supportingSources?.[0]).toMatchObject({sourceUrl:review.sourceUrl,checkedAt:review.checkedAt,\n          sourceDocumentSha256:review.sourceDocumentSha256,finding:review.finding});\n        if(review.corroborating)expect(p.evidence.supportingSources?.[1]).toEqual(review.corroborating);\n      }\n      if(p.field==='deathDate')expect(p.appliedValue<='2026-09-26').toBe(true);"],
];

if (process.argv.includes('--integrate')) {
  for (const path of [...new Set(changes.map(change => change[0]))]) {
    let source = read(path);
    for (const [candidatePath, id, before, after] of changes.filter(change => change[0] === path)) {
      assert.equal(candidatePath, path);
      if (source.includes(after)) { assert.equal(source.split(after).length, 2, id); continue; }
      assert.equal(source.split(before).length, 2, id); source = source.replace(before, after);
    }
    writeFileSync(path, source);
  }
}

const paths = [...new Set(changes.map(change => change[0]))];
const sourceBaselines = {}, reviewedSources = {};
for (const path of paths) {
  const source = read(path); let before = source;
  for (const [, id, old, current] of changes.filter(change => change[0] === path)) {
    assert.equal(before.split(current).length, 2, id); before = before.replace(current, old);
  }
  assert.equal(before, lf(git('show', `${baselineCommitSha}:${path}`).toString('utf8')), `Unattested drift: ${path}`);
  sourceBaselines[path] = sha(before); reviewedSources[path] = sha(source);
}
const reviewPath = 'reports/r10/calendar/russian-expansion-source-review-20261001.json';
const review = JSON.parse(read(reviewPath));
const datePacket = JSON.parse(read('src/data/countries/generated/writerDatePatches.r10-russian-expansion.json'));
assert.equal(datePacket.patches.length, 4);
assert.equal(datePacket.patches.filter(patch => patch.expectedOld === null).length, 1);
const additionPaths = [
  'src/data/countries/generated/writerDatePatches.r10-russian-expansion.json', reviewPath,
  'scripts/build-russian-calendar-expansion-r10.mjs', 'scripts/build-russian-calendar-expansion-attestation-r10.mjs',
  'scripts/lib/reviewed-russian-calendar-expansion.mjs', 'scripts/lib/reviewed-russian-calendar-expansion.d.mts',
  'src/data/countries/calendarWriterDatePatches.test.ts',
  'scripts/audit-russian-calendar-expansion-r10.mjs', 'reports/r10/calendar/russian-expansion-coverage-20261001.json',
];
const foundationPaths = [
  'scripts/governance/calendar-followup-reviewed-20260929.json',
  'scripts/governance/calendar-governance-integration-reviewed-20260929.json',
  'scripts/governance/calendar-security-followup-reviewed-20260930.json',
  'scripts/governance/r10-forward-delta-20260926.json',
  'src/data/countries/generated/writerDatePatches.r10.json',
  'src/data/countries/generated/writerDatePatches.r10-supplemental.json',
  'src/data/countries/generated/writerDatePatches.r10-russian.json',
  'src/data/countries/generated/writerDatePatches.r10-popular.json',
  'src/data/countries/generated/writerDatePatches.r10-scoped.json',
  'src/data/countries/generated/curatedWriterQids.generated.json',
  'src/data/countries/generated/writerFacts.wikidata.json',
  'reports/r10/calendar/russian-source-review.json',
];
const foundations = foundationPaths.map(path => {
  const source = readFileSync(path), historical = git('show', `${baselineCommitSha}:${path}`);
  assert.equal(lf(source.toString('utf8')), lf(historical.toString('utf8')), `Foundation changed: ${path}`);
  return { path, sha256Lf: sha(source.toString('utf8')), sha256Raw: rawSha(source) };
});
const packet = { schemaVersion: 1, id: 'R10-RUSSIAN-CALENDAR-EXPANSION-20261001',
  baselineCommitSha: git('rev-parse', baselineCommitSha).toString('utf8').trim(), evaluatedAt: review.evaluatedAt,
  scope: 'Four exact date changes for existing Russian writers, applied only to derived calendar clones. No new writers, event types, database, UI or export.',
  historicalPinsChanged: false,
  authorization: { userAuthorized: true, userInstruction: 'Доделай по новостям все, доработай качественно и чтобы постоянно шел поток новостей с большого количества проверенных источников, а также каленжарные даты расширь и закомить все в мейн это', humanReview: false, releaseAccepted: false, productionApplied: false },
  calendar: { priorCalendarFields: 25, newExactFields: 1, correctedJulianFields: 3, packetFields: 4,
    totalCalendarFields: 29, annualEventsBefore: 2339, annualEventsAfter: 2340, canonicalCountryProfilesUnchanged: true },
  allowedProjectionPaths: paths, sourceBaselines, reviewedSources,
  additions: additionPaths.map(path => ({ path, sha256Lf: sha(read(path)) })), foundations,
  projections: changes.map(([path, id, before, after]) => ({ path, id, before, after })),
};
const serialized = JSON.stringify(packet, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(read(attestationPath), serialized, 'Russian calendar expansion attestation stale');
else writeFileSync(attestationPath, serialized);
console.log(JSON.stringify({ projections: changes.length, paths: paths.length, calendarFields: 29,
  unchangedFoundations: foundations.length, attestationSha256: sha(JSON.stringify(packet)) }));
