import { readFileSync } from 'node:fs';
import { projectReviewedNextSecurityFollowup } from './reviewed-next-security-followup.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkedRussianExpansionReviewRow } from '../build-russian-calendar-expansion-r10.mjs';
import { russianCalendarExpansionAttestation as packet, russianCalendarExpansionSha256 as sha,
  projectReviewedRussianCalendarExpansion as project, isReviewedRussianCalendarExpansionAddition as addition } from './reviewed-russian-calendar-expansion.mjs';

const read = path => projectReviewedNextSecurityFollowup(path, readFileSync(path, 'utf8'));
const historical = path => execFileSync('git', ['-c', `safe.directory=${process.cwd()}`, 'show', `${packet.baselineCommitSha}:${path}`],
  { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }).replace(/\r\n?/gu, '\n');
const review = JSON.parse(read('reports/r10/calendar/russian-expansion-source-review-20261001.json'));

describe('Four source-backed Russian calendar changes with immutable earlier locks', () => {
  it('pins the additive packet, four exact choices and bounded agent review', () => {
    expect(sha(JSON.stringify(packet))).toBe('bc1330bda023dc1fe9172a6275230d51124d92c70475fe643c3e5d8dd9e9bd49');
    expect(packet).toMatchObject({ id: 'R10-RUSSIAN-CALENDAR-EXPANSION-20261001', historicalPinsChanged: false,
      authorization: { userAuthorized: true, humanReview: false, releaseAccepted: false, productionApplied: false },
      calendar: { priorCalendarFields: 25, newExactFields: 1, correctedJulianFields: 3, packetFields: 4,
        totalCalendarFields: 29, annualEventsBefore: 2339, annualEventsAfter: 2340, canonicalCountryProfilesUnchanged: true } });
    expect(packet.allowedProjectionPaths).toEqual(['src/data/countries/calendarWriterDatePatches.ts',
      'scripts/lib/reviewed-calendar-followup.mjs', 'scripts/lib/reviewed-calendar-followup.test.mjs',
      'scripts/build-calendar-followup-attestation-r10.mjs', 'scripts/lib/reviewed-calendar-security-followup.test.mjs',
      'scripts/lib/r10-exact-source-punctuation.test.mjs', 'scripts/audit-russian-calendar-r10.mjs',
      'scripts/audit-popular-calendar-r10.mjs', 'scripts/lib/reviewed-undici-security-followup.test.mjs',
      'src/data/countries/writerDatePatches.test.ts']);
    expect(packet.projections).toHaveLength(27);
    expect(new Set(packet.projections.map(delta => delta.id)).size).toBe(27);
    expect(review.ready.map(row => [row.writerKey, row.field, row.value])).toEqual([
      ['russia:andrei_platonov', 'birthDate', '1899-08-28'], ['russia:gogol', 'deathDate', '1852-03-04'],
      ['russia:pasternak', 'birthDate', '1890-02-10'], ['russia:leskov', 'birthDate', '1831-02-16']]);
    expect(review.held).toEqual([]);
    expect(review.unresolved.map(row => row.writerKey)).toEqual(['russia:nestor', 'russia:kirill-turovsky', 'russia:avvakum', 'russia:kantemir']);
  });
  it.each(['src/data/countries/calendarWriterDatePatches.ts', 'scripts/lib/reviewed-calendar-followup.mjs',
    'scripts/lib/reviewed-calendar-followup.test.mjs', 'scripts/build-calendar-followup-attestation-r10.mjs',
    'scripts/lib/reviewed-calendar-security-followup.test.mjs', 'scripts/lib/r10-exact-source-punctuation.test.mjs',
    'scripts/audit-russian-calendar-r10.mjs', 'scripts/audit-popular-calendar-r10.mjs',
    'scripts/lib/reviewed-undici-security-followup.test.mjs', 'src/data/countries/writerDatePatches.test.ts'])
    ('restores exact earlier bytes and rejects missing, duplicate or changed fragments: %s', path => {
      const current = read(path), before = project(path, current);
      expect(sha(current)).toBe(packet.reviewedSources[path]); expect(sha(before)).toBe(packet.sourceBaselines[path]);
      expect(before).toBe(historical(path)); expect(project(path, before)).toBe(before);
      expect(project(path, current.replaceAll('\n', '\r\n'))).toBe(before);
      const outside = '\n/* Unreviewed changes remain visible to every historical lock. */\n';
      expect(project(path, current + outside)).toBe(before + outside);
      expect(sha(before + outside)).not.toBe(packet.sourceBaselines[path]);
      for (const delta of packet.projections.filter(item => item.path === path))
        for (const changed of [current.replace(delta.after, ''), current + delta.after,
          current.replace(delta.after, delta.after.replace(/\S/u, '?'))])
          expect(() => project(path, changed)).toThrow('Missing or duplicate reviewed Russian calendar expansion delta');
    });
  it('preserves every earlier authority byte and accepts new additions only by exact hashes', () => {
    for (const entry of packet.foundations) {
      expect(sha(read(entry.path))).toBe(entry.sha256Lf); expect(read(entry.path)).toBe(historical(entry.path));
      expect(createHash('sha256').update(readFileSync(entry.path)).digest('hex')).toBe(entry.sha256Raw);
    }
    for (const entry of packet.additions) {
      const source = read(entry.path); expect(addition(entry.path, source)).toBe(true);
      expect(addition(entry.path, source.replaceAll('\n', '\r\n'))).toBe(true);
      expect(addition(entry.path, source + '\n')).toBe(false);
      expect(addition(entry.path + '.unreviewed', source)).toBe(false);
      expect(addition(entry.path, source.replace(/\S/u, '?'))).toBe(false);
    }
    expect(project('src/data/bookArchive.ts', 'unknown protected bytes\n')).toBe('unknown protected bytes\n');
  });
  it('accepts only the fixed writer, Gregorian day, source, old value and corroboration', () => {
    for (const row of review.ready) expect(checkedRussianExpansionReviewRow(row).row).toBe(row);
    const row = review.ready[0];
    for (const changed of [{ ...row, writerKey: '__proto__' }, { ...row, field: 'constructor' },
      { ...row, value: '1899-09-01' }, { ...row, expectedOld: '1899' },
      { ...row, sourceUrl: 'https://www.prlib.ru.attacker.invalid/history/2056240' },
      { ...row, finding: '1899' }, { ...row, sourceDocumentSha256: 'unknown' },
      { ...row, checkedAt: 'invalid' }, { ...row, corroborating: null },
      { ...row, corroborating: { ...row.corroborating, sourceUrl: 'https://unreviewed.invalid/' } }])
      expect(() => checkedRussianExpansionReviewRow(changed)).toThrow();
    expect({}.wikidataId).toBeUndefined();
  });
});
