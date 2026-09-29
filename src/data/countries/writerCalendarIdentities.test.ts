import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countries, editorialCatalogCountries } from './index';
import { calendarWriterQid } from './calendarWriterIdentities';
import { applyWriterDatePatches, type WriterDatePatch } from './writerDatePatches';
import { selectCalendarEvents, calendarWriterIdentity } from '../../components/LiteraryCalendar';
import scoped from './generated/writerDatePatches.r10-scoped.json';
import identity from './generated/writerCalendarIdentities.r10-popular.json';
import mainRegistry from './generated/curatedWriterQids.generated.json';
import type { Country } from './types';

const baseline = new Map(editorialCatalogCountries.flatMap(c => c.writers.map(w => [`${c.id}:${w.id}`, w])));
const review = JSON.parse(readFileSync(new URL('../../../reports/r10/calendar/scoped-source-review.json', import.meta.url), 'utf8'));
const snapshotText = readFileSync(new URL('../../../reports/r10/calendar/scoped-wikidata-evidence.json', import.meta.url), 'utf8');
const snapshot = JSON.parse(snapshotText);
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

describe('popular writer calendar identities', () => {
  it('binds every scoped date to an existing unchanged identity and an independently referenced exact statement', () => {
    expect(scoped.patches.length).toBeGreaterThan(0);
    for (const p of scoped.patches) {
      const writer = baseline.get(p.writerKey)!;
      const row = review.ready.find((r: any) => r.writerKey === p.writerKey);
      expect(writer).toBeDefined();
      expect([writer.name, writer.fullName].filter(Boolean)).toEqual(row.expectedNames);
      expect((mainRegistry.writers as Record<string, unknown>)[p.writerKey]).toBeUndefined();
      expect(calendarWriterQid(writer, p.writerKey)).toBe(p.evidence.wikidataId);
      expect(p.evidence.snapshotSha256).toBe(hash(snapshotText));
      expect(row.sourceDocumentSha256).toMatch(/^[a-f0-9]{64}$/);
      const entity = snapshot.entities.find((e: any) => e.qid === p.evidence.wikidataId);
      expect(entity.human).toBe(true);
      expect(p.evidence.sourceUrl).toContain(`oldid=${entity.lastrevid}`);
      const exact = entity.claims[p.field === 'birthDate' ? 'P569' : 'P570'].filter((c: any) => c.precision === 11 && c.rank !== 'deprecated');
      expect(exact.every((c: any) => c.time === `+${p.appliedValue}T00:00:00Z` && c.calendarmodel === p.evidence.calendarModel)).toBe(true);
      expect(exact.every((c: any) => c.before === 0 && c.after === 0 && Object.keys(c.qualifiers).length === 0)).toBe(true);
      for (const claimId of p.evidence.claimIds) {
        const claim = exact.find((c: any) => c.claimId === claimId);
        expect(claim.referenceCount).toBeGreaterThan(0);
        expect(claim.references.some((r: any) => r.snaks.P248)).toBe(true);
      }
    }
    expect(scoped.scopedIdentitySha256).toBe(hash(JSON.stringify(identity, null, 2) + '\n'));
  });

  it('rejects a later identity/name edit and a later date edit without mutating the writer', () => {
    for (const entry of scoped.patches) {
      const p = entry as WriterDatePatch;
      const original = baseline.get(p.writerKey)!;
      const [countryId] = p.writerKey.split(':');
      for (const change of [{ name: 'Another person', fullName: 'Another person' }, { [p.field]: '2001-03-10' }]) {
        const later = { ...original, ...change, bio: 'Later CMS biography' };
        const input = [{ id: countryId, writers: [later] }] as Country[];
        const result = applyWriterDatePatches(input, [p]);
        expect(result.applied).toEqual([]);
        expect(result.conflicts).toHaveLength(1);
        expect(result.countries[0].writers[0]).toEqual(later);
      }
    }
  });

  it('shows the accepted birthdays in both locales and adds no death to living authors', () => {
    for (const row of review.ready) {
      const [countryId, writerId] = row.writerKey.split(':');
      const writer = countries.find(c => c.id === countryId)!.writers.find(w => w.id === writerId)!;
      for (const language of ['ru', 'en'] as const) {
        const events = selectCalendarEvents(countries, language).filter(e => calendarWriterIdentity(e.writer, e.country.id) === `wikidata:${row.wikidataId}`);
        expect(events.filter(e => e.kind === 'birth')).toHaveLength(1);
        const claims = snapshot.entities.find((e: any) => e.qid === row.wikidataId).claims.P570;
        if (claims.length === 0) {
          expect(writer.deathDate).toBeUndefined();
          expect(events.filter(e => e.kind === 'memory')).toEqual([]);
        }
      }
    }
  });
});
