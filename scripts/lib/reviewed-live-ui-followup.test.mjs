import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { liveUiFollowupAttestation as packet, liveUiFollowupSha256 as sha,
  projectReviewedLiveUiFollowup as project } from './reviewed-live-ui-followup.mjs';

const read = path => readFileSync(path, 'utf8').replace(/\r\n?/gu, '\n');
const historical = path => execFileSync('git', ['-c', `safe.directory=${process.cwd()}`, 'show',
  `${packet.baselineCommitSha}:${path}`], {encoding: 'utf8', maxBuffer: 20 * 1024 * 1024}).replace(/\r\n?/gu, '\n');

describe('User-requested showcase and calendar UI repair preserves historical acceptance', () => {
  it('pins an independent exact delta without granting release acceptance', () => {
    expect(sha(JSON.stringify(packet))).toBe('951e041cd53bb776d2acd9606c92d56e06d49cfde91b8f998c8b0f5a8f33b352');
    expect(packet).toMatchObject({id: 'R10-LIVE-UI-FOLLOWUP-20261002',
      baselineCommitSha: '4e4e1e1dff6425083154f0cf67ff01eb88e95b25', historicalPinsChanged: false,
      articleBodyChanged: false, canonicalGlobeChanged: false,
      authorization: {userAuthorized: true, humanReview: false, releaseAccepted: false, productionApplied: false}});
    expect(packet.allowedProjectionPaths).toHaveLength(11);
    expect(new Set(packet.projections.map(delta => delta.id)).size).toBe(packet.projections.length);
    expect([...new Set(packet.projections.map(delta => delta.path))]).toEqual(packet.allowedProjectionPaths);
  });

  it.each(packet.allowedProjectionPaths)('restores only reviewed fragments and rejects drift: %s', path => {
    const current = read(path), before = project(path, current);
    expect(sha(current)).toBe(packet.reviewedSources[path]);
    expect(sha(before)).toBe(packet.sourceBaselines[path]);
    expect(before).toBe(historical(path));
    expect(project(path, before)).toBe(before);
    expect(project(path, current.replaceAll('\n', '\r\n'))).toBe(before);
    const unknown = '\n/* Unreviewed changes remain visible to earlier locks. */\n';
    expect(project(path, current + unknown)).toBe(before + unknown);
    expect(sha(project(path, current + unknown))).not.toBe(packet.sourceBaselines[path]);
    for (const delta of packet.projections.filter(entry => entry.path === path))
      for (const altered of [current.replace(delta.after, ''), current + delta.after,
        current.replace(delta.after, delta.after.replace(/\S/u, '?'))])
        expect(() => project(path, altered)).toThrow('Missing or duplicate R10 delta (reviewed live UI)');
  });

  it('retains earlier acceptance packets, CMS selection and the canonical globe', () => {
    for (const path of ['scripts/governance/r10-forward-delta-20260926.json',
      'scripts/governance/header-showcase-owner-refinement-20260914.json',
      'scripts/governance/calendar-followup-reviewed-20260929.json',
      'scripts/governance/russian-calendar-expansion-reviewed-20261001.json',
      'scripts/governance/next-security-followup-reviewed-20261002.json',
      'src/App.tsx', 'src/utils/headerArticleSelection.ts', 'src/utils/headerArticleLoader.ts']) {
      expect(read(path)).toBe(historical(path));
      expect(project(path, read(path))).toBe(read(path));
    }
    expect(project('src/data/bookArchive.ts', 'Unreviewed content\n')).toBe('Unreviewed content\n');
  });
});
