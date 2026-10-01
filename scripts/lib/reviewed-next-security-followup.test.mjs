import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { nextSecurityFollowupAttestation as packet, nextSecurityFollowupSha256 as sha,
  projectReviewedNextSecurityFollowup as project } from './reviewed-next-security-followup.mjs';

const read = path => readFileSync(path, 'utf8').replace(/\r\n?/gu, '\n');
const historical = path => execFileSync('git', ['-c', `safe.directory=${process.cwd()}`, 'show',
  `${packet.baselineCommitSha}:${path}`], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 }).replace(/\r\n?/gu, '\n');

describe('Exact Next security patch with historical dependency locks preserved', () => {
  it('pins the bounded patch without claiming deployment or human review', () => {
    expect(sha(JSON.stringify(packet))).toBe('7cd5c87f83d924c33232b1cc495a35004a0a049989457a4e7ca8f7e4cd47d3bc');
    expect(packet).toMatchObject({ id: 'R10-NEXT-SECURITY-FOLLOWUP-20261002', historicalPinsChanged: false,
      baselineCommitSha: '59350b6a5728b06403fcfa2d705528da57684ed6',
      authorization: { userAuthorized: true, humanReview: false, releaseAccepted: false, productionApplied: false } });
    expect(packet.projections).toHaveLength(21);
    expect(packet.projections.filter(delta => delta.path.startsWith('scripts/lib/'))).toHaveLength(8);
    expect(new Set(packet.projections.map(delta => delta.id)).size).toBe(21);
  });

  it.each(packet.allowedProjectionPaths)('restores only the exact accepted bytes: %s', path => {
    const current = read(path), before = project(path, current);
    expect(sha(current)).toBe(packet.reviewedSources[path]);
    expect(sha(before)).toBe(packet.sourceBaselines[path]);
    expect(before).toBe(historical(path)); expect(project(path, before)).toBe(before);
    expect(project(path, current.replaceAll('\n', '\r\n'))).toBe(before);
    const outside = '\n/* Unreviewed dependency changes remain visible. */\n';
    expect(project(path, current + outside)).toBe(before + outside);
    expect(sha(project(path, current + outside))).not.toBe(packet.sourceBaselines[path]);
    for (const delta of packet.projections.filter(item => item.path === path)) {
      for (const changed of [current.replace(delta.after, ''), current + delta.after,
        current.replace(delta.after, delta.after.replace(/\S/u, '?'))])
        expect(() => project(path, changed)).toThrow('Missing or duplicate reviewed Next security delta');
    }
  });

  it('changes only the admin Next dependency and its own lock graph', () => {
    const manifest = JSON.parse(read('apps/admin/package.json'));
    const oldManifest = JSON.parse(historical('apps/admin/package.json'));
    expect(manifest).toEqual({ ...oldManifest, dependencies: { ...oldManifest.dependencies, next: '16.3.8' } });
    const current = JSON.parse(read('package-lock.json')), previous = JSON.parse(historical('package-lock.json'));
    const changed = [...new Set([...Object.keys(previous.packages), ...Object.keys(current.packages)])]
      .filter(path => JSON.stringify(previous.packages[path]) !== JSON.stringify(current.packages[path]));
    expect(changed).toEqual(packet.changedPackages);
    expect(changed.every(path => path === 'apps/admin' || /^node_modules\/(?:@next\/|next(?:\/|$))/u.test(path))).toBe(true);
    expect(current.packages['apps/admin']).toEqual({ ...previous.packages['apps/admin'],
      dependencies: { ...previous.packages['apps/admin'].dependencies, next: '16.3.8' } });
    expect({ ...current, packages: null }).toEqual({ ...previous, packages: null });
    for (const path of changed.filter(path => path.startsWith('node_modules/') && current.packages[path])) {
      expect(current.packages[path].version).toBe('16.3.8');
      expect(current.packages[path].resolved).toMatch(/^https:\/\/registry\.npmjs\.org\//u);
      expect(current.packages[path].integrity).toMatch(/^sha512-/u);
    }
    expect(read('package.json')).toBe(historical('package.json'));
  });

  it('retains all earlier authority hashes and mandatory audit', () => {
    for (const entry of packet.foundations) {
      expect(read(entry.path)).toBe(historical(entry.path));
      expect(sha(read(entry.path))).toBe(entry.sha256Lf);
      expect(sha(JSON.stringify(JSON.parse(read(entry.path))))).toBe(entry.jsonSha256);
    }
    expect(sha(read(packet.evidence.path))).toBe(packet.evidence.sha256Lf);
    const evidence = JSON.parse(read(packet.evidence.path));
    expect(evidence).toMatchObject({ historicalPinsChanged: false, lifecycleScriptsExecuted: false,
      sharedNodeModulesChanged: false, releaseAccepted: false, productionApplied: false });
    expect(evidence.productionAudit.before.result.metadata.vulnerabilities.critical).toBe(1);
    expect(evidence.productionAudit.after.result.metadata.vulnerabilities.total).toBe(0);
    expect(evidence.productionAudit.after.exitCode).toBe(0);
    expect(read('.github/workflows/quality.yml')).toBe(historical('.github/workflows/quality.yml'));
    expect(project('src/data/bookArchive.ts', 'unreviewed bytes\n')).toBe('unreviewed bytes\n');
  });
});
